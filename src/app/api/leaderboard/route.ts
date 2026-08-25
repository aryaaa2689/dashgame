import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leaderboard } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type BoardRow = {
  id: number;
  name: string;
  color: string;
  trackId: string;
  timeMs: number;
  placement: number;
  mode: string;
};

const memoryLeaderboard: BoardRow[] = [
  { id: 1, name: "TURBO FOX", color: "#4bb4ff", trackId: "emerald-canopy", timeMs: 42150, placement: 1, mode: "bots" },
  { id: 2, name: "APEX DASH", color: "#ffd93d", trackId: "emerald-canopy", timeMs: 44820, placement: 1, mode: "bots" },
  { id: 3, name: "SPEED DEMON", color: "#ff5a5a", trackId: "vine-spiral", timeMs: 46900, placement: 1, mode: "bots" },
  { id: 4, name: "CYBER DRIFT", color: "#4bead0", trackId: "thunder-falls", timeMs: 49300, placement: 1, mode: "bots" },
];
let memId = 5;

export async function GET(req: NextRequest) {
  const trackId = req.nextUrl.searchParams.get("trackId");
  if (!db) {
    let rows = [...memoryLeaderboard].sort((a, b) => a.timeMs - b.timeMs);
    if (trackId) rows = rows.filter((r) => r.trackId === trackId);
    return NextResponse.json({ rows: rows.slice(0, 20) });
  }
  try {
    const q = db
      .select()
      .from(leaderboard)
      .orderBy(asc(leaderboard.timeMs))
      .limit(20);
    const rows = trackId ? await q.where(eq(leaderboard.trackId, trackId)) : await q;
    return NextResponse.json({ rows });
  } catch {
    let rows = [...memoryLeaderboard].sort((a, b) => a.timeMs - b.timeMs);
    if (trackId) rows = rows.filter((r) => r.trackId === trackId);
    return NextResponse.json({ rows: rows.slice(0, 20) });
  }
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  if (typeof b.timeMs !== "number" || !b.trackId)
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const entry: BoardRow = {
    id: memId++,
    name: String(b.name ?? "Racer").slice(0, 14),
    color: String(b.color ?? "#ffffff"),
    trackId: String(b.trackId),
    timeMs: Math.round(b.timeMs),
    placement: Number(b.placement ?? 1),
    mode: String(b.mode ?? "bots"),
  };

  memoryLeaderboard.push(entry);

  if (!db) {
    return NextResponse.json({ row: entry });
  }

  try {
    const [row] = await db
      .insert(leaderboard)
      .values({
        name: entry.name,
        color: entry.color,
        trackId: entry.trackId,
        timeMs: entry.timeMs,
        placement: entry.placement,
        mode: entry.mode,
      })
      .returning();
    return NextResponse.json({ row });
  } catch {
    return NextResponse.json({ row: entry });
  }
}
