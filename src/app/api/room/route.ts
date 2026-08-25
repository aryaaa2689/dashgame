import { NextRequest, NextResponse } from "next/server";
import { createRoom, joinRoom, quickMatch, roomState, cleanup } from "@/lib/roomStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.toUpperCase();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
  const state = await roomState(code);
  if (!state) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  return NextResponse.json(state);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as string;
  const profile = {
    clientId: String(body.clientId ?? ""),
    name: String(body.name ?? "Racer").slice(0, 14),
    color: String(body.color ?? "#ffffff"),
    hat: String(body.hat ?? "none"),
  };
  if (!profile.clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  if (action === "quick") {
    const code = await quickMatch(profile);
    return NextResponse.json(await roomState(code));
  }
  if (action === "create") {
    await cleanup();
    const room = await createRoom({ isPublic: false, trackId: body.trackId });
    await joinRoom({ ...profile, code: room.code });
    return NextResponse.json(await roomState(room.code));
  }
  if (action === "join") {
    const code = String(body.code ?? "").toUpperCase().trim();
    const res = await joinRoom({ ...profile, code });
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json(await roomState(code));
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
