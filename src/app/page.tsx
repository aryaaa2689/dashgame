"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MenuRow, ActionButton, Panel, Field, TextInput, Toggle } from "@/components/ui";
import { CHAR_COLORS, HATS, TRACKS, BOT_NAMES } from "@/lib/track";
import { audio } from "@/game/audio";
import type { RacerConfig, RaceResult, RaceEngine } from "@/game/engine";

const RaceCanvas = dynamic(() => import("@/components/RaceCanvas"), { ssr: false });
const CharacterPreview = dynamic(() => import("@/components/CharacterPreview"), { ssr: false });

type Screen = "menu" | "customize" | "leaderboard" | "friends" | "lobby" | "race" | "results";

type RoomPlayer = {
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
};
type RoomState = {
  code: string;
  trackId: string;
  status: string;
  isPublic: boolean;
  maxPlayers: number;
  startAt: number | null;
  serverNow: number;
  players: RoomPlayer[];
};

type Profile = { clientId: string; name: string; color: string; hat: string };

const SUF = ["ST", "ND", "RD", "TH", "TH", "TH", "TH", "TH"];

function loadProfile(): Profile {
  if (typeof window === "undefined")
    return { clientId: "", name: "Racer", color: CHAR_COLORS[0], hat: "none" };
  const raw = localStorage.getItem("jr_profile");
  if (raw) {
    try {
      return JSON.parse(raw) as Profile;
    } catch {}
  }
  const p: Profile = {
    clientId: Math.random().toString(36).slice(2) + Date.now().toString(36),
    name: "RACER" + Math.floor(Math.random() * 900 + 100),
    color: CHAR_COLORS[Math.floor(Math.random() * CHAR_COLORS.length)],
    hat: "none",
  };
  localStorage.setItem("jr_profile", JSON.stringify(p));
  return p;
}

function makeBots(count: number, exclude: string[], seedOffset = 0): RacerConfig[] {
  const out: RacerConfig[] = [];
  for (let i = 0; i < count; i++) {
    const name = BOT_NAMES[(i + seedOffset) % BOT_NAMES.length];
    out.push({
      id: "bot" + i + seedOffset,
      name,
      color: CHAR_COLORS[(i + seedOffset + 1) % CHAR_COLORS.length],
      hat: HATS[(i + seedOffset) % HATS.length],
      isBot: true,
      skill: 0.55 + Math.random() * 0.42,
    });
  }
  return out.filter((b) => !exclude.includes(b.name));
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [profile, setProfile] = useState<Profile>({
    clientId: "",
    name: "RACER",
    color: CHAR_COLORS[0],
    hat: "none",
  });
  const [trackId, setTrackId] = useState(TRACKS[0].id);
  const [racers, setRacers] = useState<RacerConfig[]>([]);
  const [startAt, setStartAt] = useState(0);
  const [results, setResults] = useState<RaceResult[]>([]);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [board, setBoard] = useState<
    { id: number; name: string; color: string; trackId: string; timeMs: number; placement: number }[]
  >([]);
  const [mode, setMode] = useState<"bots" | "online">("bots");
  const [sfxOn, setSfxOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);

  const engineRef = useRef<RaceEngine | null>(null);
  const roomRef = useRef<RoomState | null>(null);
  const lastState = useRef({ dist: 0, lane: 0, hop: 0, speed: 0 });
  const clockOffset = useRef(0);
  const lobbySince = useRef(0);

  useEffect(() => setProfile(loadProfile()), []);
  const autoJoined = useRef(false);
  useEffect(() => {
    if (!profile.clientId || autoJoined.current) return;
    const code = new URLSearchParams(window.location.search).get("room");
    if (code) {
      autoJoined.current = true;
      setJoinCode(code.toUpperCase());
      void enterRoom("join", code.toUpperCase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.clientId]);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  // unlock audio on first interaction, run the menu bed outside races
  useEffect(() => {
    const unlock = () => {
      audio.resume();
      if (musicOn) audio.startMusic();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [musicOn]);

  useEffect(() => {
    if (screen === "race") audio.stopMusic();
    else if (musicOn) audio.startMusic();
  }, [screen, musicOn]);

  const saveProfile = (p: Profile) => {
    setProfile(p);
    localStorage.setItem("jr_profile", JSON.stringify(p));
  };

  // ---------------- networking ----------------
  const api = useCallback(async (url: string, body?: unknown) => {
    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Network error");
    return json;
  }, []);

  const enterRoom = async (action: "quick" | "create" | "join", code?: string) => {
    setBusy(true);
    setError("");
    try {
      const state: RoomState = await api("/api/room", {
        action,
        code,
        trackId: action === "create" ? trackId : undefined,
        ...profile,
      });
      clockOffset.current = state.serverNow - Date.now();
      setRoom(state);
      setTrackId(state.trackId);
      setMode("online");
      lobbySince.current = Date.now();
      audio.uiConfirm();
      setScreen("lobby");
    } catch (e) {
      audio.uiError();
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // polling loop for lobby + race
  useEffect(() => {
    if (!room || (screen !== "lobby" && screen !== "race")) return;
    let alive = true;
    const tick = async () => {
      const cur = roomRef.current;
      if (!alive || !cur) return;
      try {
        const payload: Record<string, unknown> = {
          code: cur.code,
          clientId: profile.clientId,
          ...lastState.current,
        };
        const st: RoomState = await api("/api/room/sync", payload);
        if (!alive) return;
        clockOffset.current = st.serverNow - Date.now();
        setRoom(st);
        const eng = engineRef.current;
        if (eng) {
          for (const p of st.players) {
            if (p.clientId === profile.clientId) continue;
            eng.remote.set(p.clientId, {
              dist: p.dist,
              lane: p.lane,
              hop: p.hop,
              speed: p.speed,
            });
          }
        }
      } catch {
        /* ignore transient */
      }
    };
    const iv = setInterval(tick, screen === "race" ? 220 : 900);
    tick();
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [room?.code, screen, profile.clientId, api]); // eslint-disable-line react-hooks/exhaustive-deps

  // host auto-start for public rooms
  useEffect(() => {
    if (screen !== "lobby" || !room || room.status !== "lobby") return;
    const me = room.players.find((p) => p.clientId === profile.clientId);
    if (!me?.isHost || !room.isPublic) return;
    const full = room.players.length >= room.maxPlayers;
    const waited = Date.now() - lobbySince.current > 18000 && room.players.length >= 2;
    if (full || waited) void startRace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, screen]);

  // launch race when server says racing
  useEffect(() => {
    if (screen !== "lobby" || !room || room.status !== "racing" || !room.startAt) return;
    const list: RacerConfig[] = room.players.map((p) => ({
      id: p.clientId,
      name: p.clientId === profile.clientId ? "YOU" : p.name,
      color: p.color,
      hat: p.hat,
      isPlayer: p.clientId === profile.clientId,
      isRemote: p.clientId !== profile.clientId,
    }));
    const bots = makeBots(Math.max(0, 4 - list.length), [], 3);
    setRacers([...list, ...bots]);
    setTrackId(room.trackId);
    setStartAt(room.startAt - clockOffset.current);
    setScreen("race");
  }, [room, screen, profile.clientId]);

  const startRace = async () => {
    const cur = roomRef.current;
    if (!cur) return;
    try {
      const st: RoomState = await api("/api/room/sync", {
        code: cur.code,
        clientId: profile.clientId,
        start: true,
        ...lastState.current,
      });
      setRoom(st);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const leaveRoom = async () => {
    const cur = roomRef.current;
    engineRef.current = null;
    setRoom(null);
    setScreen("menu");
    if (cur)
      await api("/api/room/sync", { code: cur.code, clientId: profile.clientId, leave: true }).catch(
        () => {},
      );
  };

  // ---------------- bots mode ----------------
  const playBots = (tid?: string) => {
    const t = tid ?? TRACKS[Math.floor(Math.random() * TRACKS.length)].id;
    setTrackId(t);
    setMode("bots");
    const bots = makeBots(5 + Math.floor(Math.random() * 3), [], Math.floor(Math.random() * 5));
    setRacers([
      { id: profile.clientId || "me", name: "YOU", color: profile.color, hat: profile.hat, isPlayer: true },
      ...bots,
    ]);
    setStartAt(Date.now() + 4200);
    setScreen("race");
  };

  const onFinish = async (r: RaceResult[]) => {
    setResults(r);
    setScreen("results");
    const me = r.find((x) => x.isPlayer);
    if (me) {
      await api("/api/leaderboard", {
        name: profile.name,
        color: profile.color,
        trackId,
        timeMs: me.timeMs,
        placement: me.place,
        mode,
      }).catch(() => {});
    }
  };

  const loadBoard = async () => {
    try {
      const j = await api("/api/leaderboard");
      setBoard(j.rows);
    } catch {}
  };

  const myResult = results.find((r) => r.isPlayer);

  // ---------------- screens ----------------
  if (screen === "race")
    return (
      <RaceCanvas
        trackId={trackId}
        racers={racers}
        startAt={startAt}
        onEngine={(e) => (engineRef.current = e)}
        netPush={
          mode === "online"
            ? (s) => {
                lastState.current = s;
              }
            : undefined
        }
        onFinish={onFinish}
        onExit={() => (mode === "online" ? leaveRoom() : setScreen("menu"))}
      />
    );

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 font-display">
      {/* backdrop */}
      <div
        className="absolute inset-0 scale-105"
        style={{
          backgroundImage: "url(/menu-bg.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "saturate(0.72) brightness(0.42) contrast(1.05)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#04100b]/85 via-[#04100b]/70 to-[#020805]/95" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_10%,rgba(53,224,138,.14),transparent_55%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,.9) 0px, rgba(255,255,255,.9) 1px, transparent 1px, transparent 3px)",
        }}
      />
      {/* frame ticks */}
      <div className="pointer-events-none absolute inset-4 border border-white/[0.06]" />

      {/* top status bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-4 font-mono text-[9px] uppercase tracking-[0.3em] text-white/25">
        <span>Jungle Dashers · v1.0</span>
        <span className="hidden sm:inline">
          {TRACKS.length} Circuits · 4–8 Racers · Realtime
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#35e08a]" />
          Online
        </span>
      </div>

      <div className="relative z-10 flex w-full flex-col items-center">
        {screen === "menu" && (
          <div className="flex w-full max-w-md flex-col items-center gap-7 animate-[fadeUp_.45s_ease-out]">
            <div className="text-center">
              <div className="mb-2 flex items-center justify-center gap-3">
                <span className="h-px w-10 bg-gradient-to-r from-transparent to-emerald-400/50" />
                <span className="font-mono text-[9px] uppercase tracking-[0.45em] text-emerald-400/60">
                  Sprint Racing
                </span>
                <span className="h-px w-10 bg-gradient-to-l from-transparent to-emerald-400/50" />
              </div>
              <h1 className="text-6xl font-bold uppercase italic leading-[0.82] tracking-tighter sm:text-7xl">
                <span className="block bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent">
                  Jungle
                </span>
                <span
                  className="block bg-gradient-to-b from-emerald-200 via-emerald-400 to-emerald-700 bg-clip-text text-transparent"
                  style={{ filter: "drop-shadow(0 0 26px rgba(53,224,138,.35))" }}
                >
                  Dashers
                </span>
              </h1>
            </div>

            <div className="flex w-full flex-col gap-2">
              <MenuRow
                index="01"
                label={busy ? "Searching…" : "Play"}
                sub="Quick online matchmaking"
                accent="primary"
                onClick={() => enterRoom("quick")}
                disabled={busy}
              />
              <MenuRow
                index="02"
                label="Play with Bots"
                sub="Instant race · AI opponents"
                accent="ghost"
                onClick={() => playBots()}
              />
              <MenuRow
                index="03"
                label="Play with Friends"
                sub="Private room · invite code"
                accent="ghost"
                onClick={() => setScreen("friends")}
              />
              <MenuRow
                index="04"
                label="Customize"
                sub="Racer identity & livery"
                accent="ghost"
                onClick={() => setScreen("customize")}
                badge={profile.name}
              />
              <MenuRow
                index="05"
                label="Leaderboard"
                sub="Global best times"
                accent="ghost"
                onClick={() => {
                  void loadBoard();
                  setScreen("leaderboard");
                }}
              />
            </div>

            {error && (
              <div className="w-full border border-red-500/40 bg-red-500/10 px-3 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-red-300">
                {error}
              </div>
            )}

            <div className="flex w-full items-center gap-2">
              <div className="flex-1">
                <Toggle
                  on={sfxOn}
                  label="SFX"
                  onChange={(v) => {
                    setSfxOn(v);
                    audio.setEnabled(v);
                  }}
                />
              </div>
              <div className="flex-1">
                <Toggle
                  on={musicOn}
                  label="Music"
                  onChange={(v) => {
                    setMusicOn(v);
                    audio.setMusicEnabled(v);
                    if (v) audio.startMusic();
                    else audio.stopMusic();
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-4 font-mono text-[9px] uppercase tracking-[0.22em] text-white/20">
              <span>A / D Steer</span>
              <span className="text-white/10">·</span>
              <span>Space Jump</span>
              <span className="text-white/10">·</span>
              <span>Shift Turbo</span>
            </div>
          </div>
        )}

        {screen === "customize" && (
          <Panel title="Racer Profile" eyebrow="Customize" onBack={() => setScreen("menu")}>
            <div className="mb-4 border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent">
              <CharacterPreview color={profile.color} hat={profile.hat} height={190} />
              <div className="flex items-center justify-between border-t border-white/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.25em] text-white/30">
                <span>Preview</span>
                <span style={{ color: profile.color }}>{profile.color.toUpperCase()}</span>
              </div>
            </div>

            <Field label="Call Sign">
              <TextInput
                value={profile.name}
                maxLength={14}
                onChange={(e) => saveProfile({ ...profile, name: e.target.value.toUpperCase() })}
              />
            </Field>

            <Field label="Livery">
              <div className="grid grid-cols-8 gap-1.5">
                {CHAR_COLORS.map((c) => (
                  <button
                    key={c}
                    onMouseEnter={() => audio.uiHover()}
                    onClick={() => {
                      audio.uiClick();
                      saveProfile({ ...profile, color: c });
                    }}
                    className="relative aspect-square border transition-all"
                    style={{
                      background: c,
                      borderColor: profile.color === c ? "#fff" : "rgba(255,255,255,.12)",
                      boxShadow: profile.color === c ? `0 0 14px ${c}` : "none",
                      transform: profile.color === c ? "scale(1.12)" : "none",
                    }}
                  />
                ))}
              </div>
            </Field>

            <Field label="Headgear">
              <div className="grid grid-cols-5 gap-1.5">
                {HATS.map((h) => (
                  <button
                    key={h}
                    onMouseEnter={() => audio.uiHover()}
                    onClick={() => {
                      audio.uiClick();
                      saveProfile({ ...profile, hat: h });
                    }}
                    className="border px-1 py-2 text-[9px] font-semibold uppercase tracking-widest transition"
                    style={{
                      borderColor: profile.hat === h ? "rgba(53,224,138,.6)" : "rgba(255,255,255,.1)",
                      background: profile.hat === h ? "rgba(53,224,138,.12)" : "rgba(255,255,255,.02)",
                      color: profile.hat === h ? "#35e08a" : "rgba(255,255,255,.45)",
                    }}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </Field>

            <ActionButton full accent="primary" onClick={() => playBots()}>
              Test Drive →
            </ActionButton>
          </Panel>
        )}

        {screen === "leaderboard" && (
          <Panel title="Global Records" eyebrow="Leaderboard" onBack={() => setScreen("menu")} wide>
            <div className="mb-2 grid grid-cols-[2rem_1fr_7rem_4.5rem] gap-2 border-b border-white/10 pb-2 font-mono text-[9px] uppercase tracking-[0.25em] text-white/25">
              <span>#</span>
              <span>Racer</span>
              <span>Circuit</span>
              <span className="text-right">Time</span>
            </div>
            <div className="max-h-[50vh] space-y-1 overflow-y-auto">
              {board.length === 0 && (
                <div className="py-10 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-white/25">
                  No records logged
                </div>
              )}
              {board.map((row, i) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[2rem_1fr_7rem_4.5rem] items-center gap-2 border-l-2 bg-white/[0.025] py-2 pl-2 pr-3 transition hover:bg-white/[0.06]"
                  style={{ borderColor: i < 3 ? "#35e08a" : "rgba(255,255,255,.1)" }}
                >
                  <span
                    className="tabnum font-mono text-xs font-medium"
                    style={{ color: i < 3 ? "#35e08a" : "rgba(255,255,255,.3)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: row.color, boxShadow: `0 0 8px ${row.color}` }}
                    />
                    <span className="truncate text-sm font-semibold uppercase tracking-wide text-white/85">
                      {row.name}
                    </span>
                  </span>
                  <span className="truncate font-mono text-[9px] uppercase tracking-wider text-white/30">
                    {TRACKS.find((t) => t.id === row.trackId)?.name}
                  </span>
                  <span className="tabnum text-right font-mono text-xs font-medium text-white/80">
                    {(row.timeMs / 1000).toFixed(2)}s
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {screen === "friends" && (
          <Panel title="Private Match" eyebrow="Play with Friends" onBack={() => setScreen("menu")}>
            <Field label="Select Circuit">
              <div className="grid gap-1.5">
                {TRACKS.map((t, i) => (
                  <button
                    key={t.id}
                    onMouseEnter={() => audio.uiHover()}
                    onClick={() => {
                      audio.uiClick();
                      setTrackId(t.id);
                    }}
                    className="group flex items-center gap-3 border px-3 py-2.5 text-left transition"
                    style={{
                      borderColor: trackId === t.id ? "rgba(53,224,138,.5)" : "rgba(255,255,255,.08)",
                      background: trackId === t.id ? "rgba(53,224,138,.09)" : "rgba(255,255,255,.02)",
                    }}
                  >
                    <span
                      className="h-8 w-1"
                      style={{
                        background: trackId === t.id ? "#35e08a" : "rgba(255,255,255,.15)",
                        boxShadow: trackId === t.id ? "0 0 10px #35e08a" : "none",
                      }}
                    />
                    <span className="flex-1">
                      <span
                        className="block text-sm font-semibold uppercase tracking-wide"
                        style={{ color: trackId === t.id ? "#35e08a" : "rgba(255,255,255,.8)" }}
                      >
                        {t.name}
                      </span>
                      <span className="block font-mono text-[9px] uppercase tracking-wider text-white/30">
                        {t.subtitle}
                      </span>
                    </span>
                    <span className="font-mono text-[9px] text-white/20">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </button>
                ))}
              </div>
            </Field>

            <ActionButton full accent="primary" onClick={() => enterRoom("create")}>
              Create Room
            </ActionButton>

            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/20">or</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <Field label="Join by Code">
              <div className="flex gap-2">
                <TextInput
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="XXXXX"
                  maxLength={5}
                  className="text-center font-mono text-lg tracking-[0.5em]"
                />
                <ActionButton accent="amber" onClick={() => enterRoom("join", joinCode)}>
                  Join
                </ActionButton>
              </div>
            </Field>

            {error && (
              <div className="border border-red-500/40 bg-red-500/10 px-3 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-red-300">
                {error}
              </div>
            )}
          </Panel>
        )}

        {screen === "lobby" && room && (
          <Panel
            title={room.isPublic ? "Matchmaking" : "Private Room"}
            eyebrow="Lobby"
            onBack={leaveRoom}
          >
            <div className="mb-4 border border-white/10 bg-gradient-to-b from-emerald-400/[0.07] to-transparent p-4 text-center">
              <div className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/30">
                Room Code
              </div>
              <div
                className="my-1 font-mono text-4xl font-bold tracking-[0.32em] text-emerald-300"
                style={{ textShadow: "0 0 28px rgba(53,224,138,.4)" }}
              >
                {room.code}
              </div>
              <ActionButton
                small
                accent="ghost"
                onClick={() => {
                  navigator.clipboard?.writeText(`${location.origin}/?room=${room.code}`);
                  setNotice("Invite link copied to clipboard");
                  setTimeout(() => setNotice(""), 2200);
                }}
              >
                Copy Invite Link
              </ActionButton>
            </div>

            <div className="mb-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.25em] text-white/30">
              <span>
                Grid {room.players.length}/{room.maxPlayers}
              </span>
              <span>{TRACKS.find((t) => t.id === room.trackId)?.name}</span>
            </div>
            <div className="mb-4 space-y-1">
              {Array.from({ length: room.maxPlayers }).map((_, i) => {
                const p = room.players[i];
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 border-l-2 bg-white/[0.025] py-2 pl-2.5 pr-3"
                    style={{ borderColor: p ? p.color : "rgba(255,255,255,.07)" }}
                  >
                    <span className="tabnum font-mono text-[10px] text-white/25">
                      P{String(i + 1).padStart(2, "0")}
                    </span>
                    {p ? (
                      <>
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: p.color, boxShadow: `0 0 8px ${p.color}` }}
                        />
                        <span className="flex-1 truncate text-sm font-semibold uppercase tracking-wide text-white/85">
                          {p.name}
                          {p.clientId === profile.clientId && (
                            <span className="ml-1.5 font-mono text-[9px] text-emerald-400/70">
                              (YOU)
                            </span>
                          )}
                        </span>
                        {p.isHost && (
                          <span className="border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-amber-300">
                            Host
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="flex-1 font-mono text-[10px] uppercase tracking-[0.25em] text-white/15">
                        Awaiting racer…
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {room.players.find((p) => p.clientId === profile.clientId)?.isHost ? (
              <ActionButton full accent="primary" onClick={startRace}>
                Launch Race →
              </ActionButton>
            ) : (
              <div className="flex items-center justify-center gap-2 border border-white/10 bg-white/[0.03] py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Waiting for host
              </div>
            )}
            {notice && (
              <div className="mt-3 border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-emerald-300">
                {notice}
              </div>
            )}
          </Panel>
        )}

        {screen === "results" && (
          <Panel title="Race Complete" eyebrow="Results" wide>
            <div className="mb-5 flex items-center justify-center gap-6 border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent py-5">
              <div className="text-center">
                <div className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/30">
                  Position
                </div>
                <div className="flex items-end justify-center gap-1">
                  <span
                    className="tabnum text-6xl font-bold leading-none tracking-tighter"
                    style={{
                      color: (myResult?.place ?? 9) <= 3 ? "#35e08a" : "#fff",
                      textShadow:
                        (myResult?.place ?? 9) <= 3 ? "0 0 32px rgba(53,224,138,.45)" : "none",
                    }}
                  >
                    {myResult?.place ?? 1}
                  </span>
                  <span className="mb-1.5 text-xl font-semibold uppercase text-white/40">
                    {SUF[(myResult?.place ?? 1) - 1] ?? "TH"}
                  </span>
                </div>
              </div>
              <div className="h-14 w-px bg-white/10" />
              <div className="text-center">
                <div className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/30">
                  Time
                </div>
                <div className="tabnum font-mono text-3xl font-medium text-white/90">
                  {((myResult?.timeMs ?? 0) / 1000).toFixed(2)}
                  <span className="text-base text-white/35">s</span>
                </div>
              </div>
              <div className="hidden h-14 w-px bg-white/10 sm:block" />
              <div className="hidden text-center sm:block">
                <div className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/30">
                  Circuit
                </div>
                <div className="text-lg font-semibold uppercase tracking-wide text-white/80">
                  {TRACKS.find((t) => t.id === trackId)?.name}
                </div>
              </div>
            </div>

            <div className="mb-5 max-h-[34vh] space-y-1 overflow-y-auto">
              {results.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[2.2rem_1fr_4.5rem] items-center gap-2 border-l-2 py-2 pl-2.5 pr-3"
                  style={{
                    borderColor: r.isPlayer ? "#35e08a" : r.color,
                    background: r.isPlayer ? "rgba(53,224,138,.09)" : "rgba(255,255,255,.025)",
                  }}
                >
                  <span
                    className="tabnum font-mono text-xs font-medium"
                    style={{ color: r.place <= 3 ? "#35e08a" : "rgba(255,255,255,.3)" }}
                  >
                    {String(r.place).padStart(2, "0")}
                  </span>
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: r.color, boxShadow: `0 0 8px ${r.color}` }}
                    />
                    <span
                      className={`truncate text-sm font-semibold uppercase tracking-wide ${
                        r.isPlayer ? "text-white" : "text-white/60"
                      }`}
                    >
                      {r.name}
                    </span>
                  </span>
                  <span className="tabnum text-right font-mono text-xs text-white/70">
                    {(r.timeMs / 1000).toFixed(2)}s
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <ActionButton full accent="primary" onClick={() => playBots(trackId)}>
                Race Again
              </ActionButton>
              <ActionButton
                full
                accent="ghost"
                onClick={() => {
                  setRoom(null);
                  setScreen("menu");
                }}
              >
                Main Menu
              </ActionButton>
            </div>
          </Panel>
        )}
      </div>
    </main>
  );
}
