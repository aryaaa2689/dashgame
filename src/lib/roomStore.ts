import { db } from "@/db";
import { rooms, roomPlayers } from "@/db/schema";
import { and, eq, lt, sql } from "drizzle-orm";
import { TRACKS } from "@/lib/track";

export const STALE_MS = 20000;

export type MemoryPlayer = {
  id: number;
  roomCode: string;
  clientId: string;
  name: string;
  color: string;
  hat: string;
  isHost: boolean;
  ready: boolean;
  dist: number;
  lane: number;
  hop: number;
  speed: number;
  finishTime: number | null;
  updatedAt: Date;
};

export type MemoryRoom = {
  id: number;
  code: string;
  trackId: string;
  status: string;
  isPublic: boolean;
  maxPlayers: number;
  startAt: Date | null;
  createdAt: Date;
};

// In-memory fallback tables
const memoryRooms = new Map<string, MemoryRoom>();
const memoryPlayers = new Map<string, MemoryPlayer[]>(); // roomCode -> players
let memRoomId = 1;
let memPlayerId = 1;

export function makeCode() {
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += alpha[Math.floor(Math.random() * alpha.length)];
  return s;
}

export async function cleanup() {
  const cutoff = new Date(Date.now() - STALE_MS);
  const oldRoomsCutoff = new Date(Date.now() - 1000 * 60 * 30);

  // In-memory cleanup
  for (const [code, pList] of memoryPlayers.entries()) {
    const valid = pList.filter((p) => p.updatedAt >= cutoff);
    if (valid.length === 0) memoryPlayers.delete(code);
    else memoryPlayers.set(code, valid);
  }
  for (const [code, r] of memoryRooms.entries()) {
    if (r.createdAt < oldRoomsCutoff) {
      memoryRooms.delete(code);
      memoryPlayers.delete(code);
    }
  }

  if (!db) return;
  try {
    await db.delete(roomPlayers).where(lt(roomPlayers.updatedAt, cutoff));
    await db.delete(rooms).where(lt(rooms.createdAt, oldRoomsCutoff));
  } catch (err) {
    console.warn("DB cleanup failed, using memory store:", err);
  }
}

export async function roomState(code: string) {
  if (!db) return memoryRoomState(code);
  try {
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
    if (!room) return memoryRoomState(code);
    const players = await db
      .select()
      .from(roomPlayers)
      .where(eq(roomPlayers.roomCode, code))
      .orderBy(roomPlayers.id);
    return {
      code: room.code,
      trackId: room.trackId,
      status: room.status,
      isPublic: room.isPublic,
      maxPlayers: room.maxPlayers,
      startAt: room.startAt ? room.startAt.getTime() : null,
      serverNow: Date.now(),
      players: players.map((p) => ({
        clientId: p.clientId,
        name: p.name,
        color: p.color,
        hat: p.hat,
        isHost: p.isHost,
        ready: p.ready,
        dist: p.dist,
        lane: p.lane,
        hop: p.hop,
        speed: p.speed,
        finishTime: p.finishTime,
      })),
    };
  } catch {
    return memoryRoomState(code);
  }
}

function memoryRoomState(code: string) {
  const room = memoryRooms.get(code);
  if (!room) return null;
  const players = memoryPlayers.get(code) ?? [];
  return {
    code: room.code,
    trackId: room.trackId,
    status: room.status,
    isPublic: room.isPublic,
    maxPlayers: room.maxPlayers,
    startAt: room.startAt ? room.startAt.getTime() : null,
    serverNow: Date.now(),
    players: players.map((p) => ({
      clientId: p.clientId,
      name: p.name,
      color: p.color,
      hat: p.hat,
      isHost: p.isHost,
      ready: p.ready,
      dist: p.dist,
      lane: p.lane,
      hop: p.hop,
      speed: p.speed,
      finishTime: p.finishTime,
    })),
  };
}

export type RoomState = NonNullable<Awaited<ReturnType<typeof roomState>>>;

export async function createRoom(opts: { isPublic: boolean; trackId?: string }) {
  const trackId = opts.trackId ?? TRACKS[Math.floor(Math.random() * TRACKS.length)].id;
  if (!db) return memoryCreateRoom(opts.isPublic, trackId);

  try {
    for (let i = 0; i < 6; i++) {
      const code = makeCode();
      const existing = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
      if (existing.length) continue;
      const [row] = await db
        .insert(rooms)
        .values({ code, trackId, isPublic: opts.isPublic })
        .returning();
      return row;
    }
  } catch {
    return memoryCreateRoom(opts.isPublic, trackId);
  }
  return memoryCreateRoom(opts.isPublic, trackId);
}

function memoryCreateRoom(isPublic: boolean, trackId: string) {
  for (let i = 0; i < 10; i++) {
    const code = makeCode();
    if (memoryRooms.has(code)) continue;
    const room: MemoryRoom = {
      id: memRoomId++,
      code,
      trackId,
      status: "lobby",
      isPublic,
      maxPlayers: 8,
      startAt: null,
      createdAt: new Date(),
    };
    memoryRooms.set(code, room);
    memoryPlayers.set(code, []);
    return room;
  }
  throw new Error("could not allocate room code");
}

export async function joinRoom(params: {
  code: string;
  clientId: string;
  name: string;
  color: string;
  hat: string;
}) {
  if (!db) return memoryJoinRoom(params);
  try {
    const { code, clientId } = params;
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
    if (!room) return memoryJoinRoom(params);
    const players = await db.select().from(roomPlayers).where(eq(roomPlayers.roomCode, code));
    const mine = players.find((p) => p.clientId === clientId);
    if (!mine) {
      if (players.length >= room.maxPlayers) return { error: "Room is full" as const };
      if (room.status !== "lobby") return { error: "Race already started" as const };
      await db.insert(roomPlayers).values({
        roomCode: code,
        clientId,
        name: params.name,
        color: params.color,
        hat: params.hat,
        isHost: players.length === 0,
      });
    } else {
      await db
        .update(roomPlayers)
        .set({ name: params.name, color: params.color, hat: params.hat, updatedAt: new Date() })
        .where(and(eq(roomPlayers.roomCode, code), eq(roomPlayers.clientId, clientId)));
    }
    return { room };
  } catch {
    return memoryJoinRoom(params);
  }
}

function memoryJoinRoom(params: {
  code: string;
  clientId: string;
  name: string;
  color: string;
  hat: string;
}) {
  const { code, clientId } = params;
  const room = memoryRooms.get(code);
  if (!room) return { error: "Room not found" as const };
  const players = memoryPlayers.get(code) ?? [];
  const mine = players.find((p) => p.clientId === clientId);
  if (!mine) {
    if (players.length >= room.maxPlayers) return { error: "Room is full" as const };
    if (room.status !== "lobby") return { error: "Race already started" as const };
    const newPlayer: MemoryPlayer = {
      id: memPlayerId++,
      roomCode: code,
      clientId,
      name: params.name,
      color: params.color,
      hat: params.hat,
      isHost: players.length === 0,
      ready: true,
      dist: 0,
      lane: 0,
      hop: 0,
      speed: 0,
      finishTime: null,
      updatedAt: new Date(),
    };
    players.push(newPlayer);
    memoryPlayers.set(code, players);
  } else {
    mine.name = params.name;
    mine.color = params.color;
    mine.hat = params.hat;
    mine.updatedAt = new Date();
  }
  return { room };
}

export async function quickMatch(p: { clientId: string; name: string; color: string; hat: string }) {
  await cleanup();
  if (!db) return memoryQuickMatch(p);

  try {
    const open = await db
      .select({
        code: rooms.code,
        max: rooms.maxPlayers,
        count: sql<number>`(select count(*) from ${roomPlayers} where ${roomPlayers.roomCode} = ${rooms.code})`,
      })
      .from(rooms)
      .where(and(eq(rooms.isPublic, true), eq(rooms.status, "lobby")))
      .orderBy(rooms.id);
    const target = open.find((r) => Number(r.count) > 0 && Number(r.count) < r.max);
    if (target) {
      const res = await joinRoom({ ...p, code: target.code });
      if (!("error" in res)) return target.code;
    }
    const room = await createRoom({ isPublic: true });
    await joinRoom({ ...p, code: room.code });
    return room.code;
  } catch {
    return memoryQuickMatch(p);
  }
}

function memoryQuickMatch(p: { clientId: string; name: string; color: string; hat: string }) {
  for (const [code, room] of memoryRooms.entries()) {
    if (room.isPublic && room.status === "lobby") {
      const players = memoryPlayers.get(code) ?? [];
      if (players.length > 0 && players.length < room.maxPlayers) {
        const res = memoryJoinRoom({ ...p, code });
        if (!("error" in res)) return code;
      }
    }
  }
  const room = memoryCreateRoom(true, TRACKS[0].id);
  memoryJoinRoom({ ...p, code: room.code });
  return room.code;
}
