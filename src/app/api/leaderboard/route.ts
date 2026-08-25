import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leaderboard } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const trackId = req.nextUrl.searchParams.get("trackId");
  const q = db
    .select()
    .from(leaderboard)
    .orderBy(asc(leaderboard.timeMs))
    .limit(20);
  const rows = trackId ? await q.where(eq(leaderboard.trackId, trackId)) : await q;
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  if (typeof b.timeMs !== "number" || !b.trackId)
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  const [row] = await db
    .insert(leaderboard)
    .values({
      name: String(b.name ?? "Racer").slice(0, 14),
      color: String(b.color ?? "#ffffff"),
      trackId: String(b.trackId),
      timeMs: Math.round(b.timeMs),
      placement: Number(b.placement ?? 1),
      mode: String(b.mode ?? "bots"),
    })
    .returning();
  return NextResponse.json({ row });
}
