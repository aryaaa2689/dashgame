import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rooms, roomPlayers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { roomState, MemoryRoom, MemoryPlayer } from "@/lib/roomStore";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = await req.json();
  const code = String(b.code ?? "").toUpperCase();
  const clientId = String(b.clientId ?? "");
  if (!code || !clientId) return NextResponse.json({ error: "bad request" }, { status: 400 });

  if (!db) {
    return handleMemorySync(code, clientId, b);
  }

  try {
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
    if (!room) return handleMemorySync(code, clientId, b);

    if (b.leave) {
      await db
        .delete(roomPlayers)
        .where(and(eq(roomPlayers.roomCode, code), eq(roomPlayers.clientId, clientId)));
      return NextResponse.json({ ok: true });
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof b.dist === "number") patch.dist = b.dist;
    if (typeof b.lane === "number") patch.lane = b.lane;
    if (typeof b.hop === "number") patch.hop = b.hop;
    if (typeof b.speed === "number") patch.speed = b.speed;
    if (typeof b.ready === "boolean") patch.ready = b.ready;
    if (typeof b.finishTime === "number") patch.finishTime = b.finishTime;

    await db
      .update(roomPlayers)
      .set(patch)
      .where(and(eq(roomPlayers.roomCode, code), eq(roomPlayers.clientId, clientId)));

    if (b.start && room.status === "lobby") {
      await db
        .update(rooms)
        .set({ status: "racing", startAt: new Date(Date.now() + 4200) })
        .where(eq(rooms.code, code));
    }

    const state = await roomState(code);
    return NextResponse.json(state);
  } catch {
    return handleMemorySync(code, clientId, b);
  }
}

async function handleMemorySync(code: string, clientId: string, b: Record<string, unknown>) {
  const state = await roomState(code);
  if (!state) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  return NextResponse.json(state);
}
