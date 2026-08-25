import { db } from "@/db";
import { rooms, roomPlayers } from "@/db/schema";
import { and, eq, lt, sql } from "drizzle-orm";
import { TRACKS } from "@/lib/track";

export const STALE_MS = 20000;

export function makeCode() {
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += alpha[Math.floor(Math.random() * alpha.length)];
  return s;
}

export async function cleanup() {
  const cutoff = new Date(Date.now() - STALE_MS);
  await db.delete(roomPlayers).where(lt(roomPlayers.updatedAt, cutoff));
  const oldRooms = new Date(Date.now() - 1000 * 60 * 30);
  await db.delete(rooms).where(lt(rooms.createdAt, oldRooms));
}

export async function roomState(code: string) {
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
  if (!room) return null;
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
}

export type RoomState = NonNullable<Awaited<ReturnType<typeof roomState>>>;

export async function createRoom(opts: { isPublic: boolean; trackId?: string }) {
  const trackId = opts.trackId ?? TRACKS[Math.floor(Math.random() * TRACKS.length)].id;
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
  throw new Error("could not allocate room code");
}

export async function joinRoom(params: {
  code: string;
  clientId: string;
  name: string;
  color: string;
  hat: string;
}) {
  const { code, clientId } = params;
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
  if (!room) return { error: "Room not found" as const };
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
}

export async function quickMatch(p: { clientId: string; name: string; color: string; hat: string }) {
  await cleanup();
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
}
