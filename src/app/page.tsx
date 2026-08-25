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

function safeAudio(fn: () => void) {
  try {
    fn();
  } catch {}
}

function loadProfile(): Profile {
  if (typeof window === "undefined")
    return { clientId: "", name: "DRIVER1", color: CHAR_COLORS[0], hat: "none" };
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

  // Unlock audio on first user interaction
  useEffect(() => {
    const unlock = () => {
      safeAudio(() => {
        audio.resume();
        if (musicOn) audio.startMusic();
      });
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [musicOn]);

  useEffect(() => {
    if (screen === "race") safeAudio(() => audio.stopMusic());
    else if (musicOn) safeAudio(() => audio.startMusic());
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
      safeAudio(() => audio.uiConfirm());
      setScreen("lobby");
    } catch (e) {
      safeAudio(() => audio.uiError());
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
    const bots = makeBots(Math.max(0, 8 - list.length), [], 3);
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
    const bots = makeBots(7, [], Math.floor(Math.random() * 5));
    setRacers([
      { id: profile.clientId || "me", name: "YOU", color: profile.color, hat: profile.hat, isPlayer: true },
      ...bots,
    ]);
    setStartAt(Date.now() + 3800);
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
    <main className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-y-auto p-4 py-8 font-display">
      <div
        className="fixed inset-0 scale-110 animate-[drift_28s_linear_infinite_alternate]"
        style={{
          backgroundImage: "url(/menu-bg.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "saturate(1.05) brightness(0.42) contrast(1.12)",
        }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-[#05080d]/80 via-[#05080d]/55 to-[#05080d]/92" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(0,220,255,.14),transparent_50%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />

      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-4 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300/55">
        <span>Turbo Racers · Season 1</span>
        <span className="hidden sm:inline">8-car grid · Banked jungle circuits</span>
        <span className="flex items-center gap-1.5 text-emerald-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
          Live
        </span>
      </div>

      <div className="relative z-10 my-auto flex w-full flex-col items-center">
        {screen === "menu" && (
          <div className="grid w-full max-w-5xl items-center gap-8 animate-[fadeUp_.45s_ease-out] lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex flex-col items-center gap-6 lg:items-stretch">
              <div className="text-center lg:text-left">
                <div className="mb-2 flex items-center justify-center gap-3 lg:justify-start">
                  <span className="h-px w-10 bg-gradient-to-r from-transparent to-cyan-400" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.45em] text-cyan-300">
                    Arcade Grand Prix
                  </span>
                </div>
                <h1 className="text-6xl font-black uppercase italic leading-[0.8] tracking-tighter sm:text-7xl">
                  <span className="block bg-gradient-to-b from-white to-white/55 bg-clip-text text-transparent">
                    TURBO
                  </span>
                  <span
                    className="block bg-gradient-to-b from-cyan-100 via-cyan-300 to-sky-600 bg-clip-text text-transparent"
                    style={{ filter: "drop-shadow(0 0 28px rgba(0,240,255,.4))" }}
                  >
                    RACERS
                  </span>
                </h1>
                <p className="mt-3 max-w-md text-sm font-semibold uppercase tracking-[0.16em] text-white/45">
                  Steer, jump, chain math gates and take the flag.
                </p>
              </div>

              <div className="w-full max-w-md space-y-2">
                <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-white/35">
                  Select circuit
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {TRACKS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTrackId(t.id)}
                      className="rounded-lg border px-2.5 py-2 text-left transition touch-manipulation"
                      style={{
                        borderColor: trackId === t.id ? "rgba(108,243,255,.7)" : "rgba(255,255,255,.1)",
                        background: trackId === t.id ? "rgba(0,220,255,.12)" : "rgba(0,0,0,.28)",
                      }}
                    >
                      <span className="block text-[12px] font-black uppercase tracking-wide text-white">
                        {t.name}
                      </span>
                      <span className="block truncate text-[9px] font-bold uppercase tracking-wider text-white/40">
                        {t.subtitle}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex w-full max-w-md flex-col gap-2.5">
                <MenuRow
                  index="01"
                  label={busy ? "Connecting…" : "Quick Race"}
                  sub="Online matchmaking · fill with rivals"
                  accent="primary"
                  onClick={() => enterRoom("quick")}
                  disabled={busy}
                />
                <MenuRow
                  index="02"
                  label="Play with Bots"
                  sub={`Instant GP · ${TRACKS.find((t) => t.id === trackId)?.name}`}
                  accent="ghost"
                  onClick={() => playBots(trackId)}
                />
                <MenuRow
                  index="03"
                  label="Play with Friends"
                  sub="Private lobby · invite code"
                  accent="ghost"
                  onClick={() => setScreen("friends")}
                />
                <MenuRow
                  index="04"
                  label="Garage"
                  sub="Livery, kits & driver tag"
                  accent="ghost"
                  onClick={() => setScreen("customize")}
                  badge={profile.name}
                />
                <MenuRow
                  index="05"
                  label="Leaderboard"
                  sub="Global circuit records"
                  accent="ghost"
                  onClick={() => {
                    void loadBoard();
                    setScreen("leaderboard");
                  }}
                />
              </div>

              {error && (
                <div className="w-full max-w-md rounded-lg border border-red-500/50 bg-red-500/15 px-3.5 py-2.5 text-center font-mono text-xs uppercase tracking-widest text-red-300">
                  {error}
                </div>
              )}

              <div className="flex w-full max-w-md items-center gap-3">
                <div className="flex-1">
                  <Toggle
                    on={sfxOn}
                    label="SFX"
                    onChange={(v) => {
                      setSfxOn(v);
                      safeAudio(() => audio.setEnabled(v));
                    }}
                  />
                </div>
                <div className="flex-1">
                  <Toggle
                    on={musicOn}
                    label="Music"
                    onChange={(v) => {
                      setMusicOn(v);
                      safeAudio(() => {
                        audio.setMusicEnabled(v);
                        if (v) audio.startMusic();
                        else audio.stopMusic();
                      });
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/35 lg:justify-start">
                <span>A/D Steer</span>
                <span className="text-cyan-400">·</span>
                <span>Space Jump</span>
                <span className="text-cyan-400">·</span>
                <span>Shift Nitro</span>
              </div>
            </div>

            <div className="hidden overflow-hidden rounded-2xl border border-white/12 bg-black/30 shadow-[0_30px_80px_rgba(0,0,0,.45)] lg:block">
              <CharacterPreview color={profile.color} hat={profile.hat} height={420} />
              <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
                <div>
                  <div className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-white/35">
                    Your driver
                  </div>
                  <div className="text-lg font-black uppercase tracking-wide text-white">{profile.name}</div>
                </div>
                <button
                  onClick={() => setScreen("customize")}
                  className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-cyan-200"
                >
                  Edit garage
                </button>
              </div>
            </div>
          </div>
        )}

        {screen === "customize" && (
          <Panel title="Car Customization" eyebrow="Garage" onBack={() => setScreen("menu")}>
            <div className="mb-4 border border-white/15 bg-gradient-to-b from-cyan-500/[0.08] to-transparent rounded-lg">
              <CharacterPreview color={profile.color} hat={profile.hat} height={200} />
              <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">
                <span>3D Car Preview</span>
                <span style={{ color: profile.color }}>{profile.color.toUpperCase()}</span>
              </div>
            </div>

            <Field label="Driver Name">
              <TextInput
                value={profile.name}
                maxLength={12}
                onChange={(e) => saveProfile({ ...profile, name: e.target.value.toUpperCase() })}
              />
            </Field>

            <Field label="Car Paint & Livery">
              <div className="grid grid-cols-8 gap-2">
                {CHAR_COLORS.map((c) => (
                  <button
                    key={c}
                    onMouseEnter={() => safeAudio(() => audio.uiHover())}
                    onClick={() => {
                      safeAudio(() => audio.uiClick());
                      saveProfile({ ...profile, color: c });
                    }}
                    className="relative aspect-square border-2 rounded-md transition-all touch-manipulation"
                    style={{
                      background: c,
                      borderColor: profile.color === c ? "#00f0ff" : "rgba(255,255,255,.15)",
                      boxShadow: profile.color === c ? `0 0 16px ${c}` : "none",
                      transform: profile.color === c ? "scale(1.15)" : "none",
                    }}
                  />
                ))}
              </div>
            </Field>

            <Field label="Body Kit & Spoiler">
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { id: "none", label: "GT WING" },
                  { id: "cap", label: "CARBON" },
                  { id: "leaf", label: "TURBO" },
                  { id: "crown", label: "GOLD" },
                  { id: "goggles", label: "POLICE" },
                ].map((h) => (
                  <button
                    key={h.id}
                    onMouseEnter={() => safeAudio(() => audio.uiHover())}
                    onClick={() => {
                      safeAudio(() => audio.uiClick());
                      saveProfile({ ...profile, hat: h.id });
                    }}
                    className="border px-1.5 py-2.5 text-[9px] font-bold uppercase tracking-wider rounded-md transition touch-manipulation"
                    style={{
                      borderColor: profile.hat === h.id ? "#00f0ff" : "rgba(255,255,255,.12)",
                      background: profile.hat === h.id ? "rgba(0,240,255,.15)" : "rgba(255,255,255,.03)",
                      color: profile.hat === h.id ? "#00f0ff" : "rgba(255,255,255,.6)",
                    }}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </Field>

            <ActionButton full accent="primary" onClick={() => playBots(trackId)}>
              Test Drive Car →
            </ActionButton>
          </Panel>
        )}

        {screen === "leaderboard" && (
          <Panel title="Global Records" eyebrow="Leaderboard" onBack={() => setScreen("menu")} wide>
            <div className="mb-2 grid grid-cols-[2rem_1fr_8rem_4.5rem] gap-2 border-b border-white/10 pb-2 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-400/60">
              <span>#</span>
              <span>Driver</span>
              <span>Circuit</span>
              <span className="text-right">Time</span>
            </div>
            <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
              {board.length === 0 && (
                <div className="py-10 text-center font-mono text-xs uppercase tracking-[0.3em] text-white/30">
                  No lap records logged
                </div>
              )}
              {board.map((row, i) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[2rem_1fr_8rem_4.5rem] items-center gap-2 border-l-2 bg-white/[0.03] py-2 pl-2.5 pr-3 rounded-r-md transition hover:bg-white/[0.08]"
                  style={{ borderColor: i < 3 ? "#00f0ff" : "rgba(255,255,255,.12)" }}
                >
                  <span
                    className="tabnum font-mono text-xs font-bold"
                    style={{ color: i < 3 ? "#00f0ff" : "rgba(255,255,255,.4)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: row.color, boxShadow: `0 0 8px ${row.color}` }}
                    />
                    <span className="truncate text-sm font-black uppercase tracking-wide text-white">
                      {row.name}
                    </span>
                  </span>
                  <span className="truncate font-mono text-[10px] font-bold uppercase tracking-wider text-white/40">
                    {TRACKS.find((t) => t.id === row.trackId)?.name}
                  </span>
                  <span className="tabnum text-right font-mono text-xs font-bold text-cyan-300">
                    {(row.timeMs / 1000).toFixed(2)}s
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {screen === "friends" && (
          <Panel title="Private Race" eyebrow="Play with Friends" onBack={() => setScreen("menu")}>
            <Field label="Select Circuit">
              <div className="grid gap-2">
                {TRACKS.map((t, i) => (
                  <button
                    key={t.id}
                    onMouseEnter={() => safeAudio(() => audio.uiHover())}
                    onClick={() => {
                      safeAudio(() => audio.uiClick());
                      setTrackId(t.id);
                    }}
                    className="group flex items-center gap-3 border px-3.5 py-3 text-left rounded-lg transition touch-manipulation"
                    style={{
                      borderColor: trackId === t.id ? "#00f0ff" : "rgba(255,255,255,.1)",
                      background: trackId === t.id ? "rgba(0,240,255,.12)" : "rgba(255,255,255,.025)",
                    }}
                  >
                    <span
                      className="h-9 w-1.5 rounded-full"
                      style={{
                        background: trackId === t.id ? "#00f0ff" : "rgba(255,255,255,.2)",
                        boxShadow: trackId === t.id ? "0 0 12px #00f0ff" : "none",
                      }}
                    />
                    <span className="flex-1">
                      <span
                        className="block text-base font-black uppercase tracking-wide"
                        style={{ color: trackId === t.id ? "#00f0ff" : "rgba(255,255,255,.85)" }}
                      >
                        {t.name}
                      </span>
                      <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-white/40">
                        {t.subtitle}
                      </span>
                    </span>
                    <span className="font-mono text-xs font-bold text-white/30">
                      0{i + 1}
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
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">or</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <Field label="Join Room by Code">
              <div className="flex gap-2">
                <TextInput
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="XXXXX"
                  maxLength={5}
                  className="text-center font-mono text-xl font-bold tracking-[0.5em]"
                />
                <ActionButton accent="amber" onClick={() => enterRoom("join", joinCode)}>
                  Join
                </ActionButton>
              </div>
            </Field>

            {error && (
              <div className="border border-red-500/50 bg-red-500/15 px-3.5 py-2 text-center font-mono text-xs uppercase tracking-widest text-red-300 rounded-lg">
                {error}
              </div>
            )}
          </Panel>
        )}

        {screen === "lobby" && room && (
          <Panel
            title={room.isPublic ? "Matchmaking Lobby" : "Private Lobby"}
            eyebrow="Lobby"
            onBack={leaveRoom}
          >
            <div className="mb-4 border border-cyan-400/30 bg-gradient-to-b from-cyan-500/[0.12] to-transparent p-4 text-center rounded-xl">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-400/70">
                Room Invite Code
              </div>
              <div
                className="my-1 font-mono text-4xl font-black tracking-[0.32em] text-cyan-300"
                style={{ textShadow: "0 0 28px rgba(0,240,255,.5)" }}
              >
                {room.code}
              </div>
              <ActionButton
                small
                accent="ghost"
                onClick={() => {
                  navigator.clipboard?.writeText(`${location.origin}/?room=${room.code}`);
                  setNotice("Invite link copied to clipboard!");
                  setTimeout(() => setNotice(""), 2200);
                }}
              >
                Copy Invite Link
              </ActionButton>
            </div>

            <div className="mb-2 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-400/60">
              <span>
                Drivers {room.players.length}/{room.maxPlayers}
              </span>
              <span>{TRACKS.find((t) => t.id === room.trackId)?.name}</span>
            </div>
            <div className="mb-4 space-y-1.5">
              {Array.from({ length: room.maxPlayers }).map((_, i) => {
                const p = room.players[i];
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 border-l-2 bg-white/[0.03] py-2 pl-3 pr-3 rounded-r-md"
                    style={{ borderColor: p ? p.color : "rgba(255,255,255,.08)" }}
                  >
                    <span className="tabnum font-mono text-xs font-bold text-white/30">
                      P{String(i + 1).padStart(2, "0")}
                    </span>
                    {p ? (
                      <>
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: p.color, boxShadow: `0 0 8px ${p.color}` }}
                        />
                        <span className="flex-1 truncate text-sm font-black uppercase tracking-wide text-white">
                          {p.name}
                          {p.clientId === profile.clientId && (
                            <span className="ml-1.5 font-mono text-[10px] text-cyan-400">
                              (YOU)
                            </span>
                          )}
                        </span>
                        {p.isHost && (
                          <span className="border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-amber-300 rounded">
                            Host
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="flex-1 font-mono text-xs uppercase tracking-[0.25em] text-white/20">
                        Awaiting driver…
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {room.players.find((p) => p.clientId === profile.clientId)?.isHost ? (
              <ActionButton full accent="primary" onClick={startRace}>
                Start Race →
              </ActionButton>
            ) : (
              <div className="flex items-center justify-center gap-2 border border-white/12 bg-white/[0.04] py-3.5 font-mono text-xs font-bold uppercase tracking-[0.3em] text-cyan-300 rounded-lg">
                <span className="h-2 w-2 animate-ping rounded-full bg-cyan-400" />
                Waiting for host
              </div>
            )}
            {notice && (
              <div className="mt-3 border border-cyan-400/40 bg-cyan-400/15 px-3 py-2 text-center font-mono text-xs uppercase tracking-widest text-cyan-300 rounded-lg">
                {notice}
              </div>
            )}
          </Panel>
        )}

        {screen === "results" && (
          <Panel title="Race Complete" eyebrow="Results" wide>
            <div className="mb-5 flex items-center justify-center gap-6 border border-white/15 bg-gradient-to-b from-cyan-500/[0.08] to-transparent py-6 rounded-xl">
              <div className="text-center">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-400/60">
                  Position
                </div>
                <div className="flex items-end justify-center gap-1">
                  <span
                    className="tabnum text-6xl font-black leading-none tracking-tighter"
                    style={{
                      color: (myResult?.place ?? 9) <= 3 ? "#00f0ff" : "#fff",
                      textShadow:
                        (myResult?.place ?? 9) <= 3 ? "0 0 32px rgba(0,240,255,.5)" : "none",
                    }}
                  >
                    {myResult?.place ?? 1}
                  </span>
                  <span className="mb-1.5 text-xl font-bold uppercase text-white/50">
                    {SUF[(myResult?.place ?? 1) - 1] ?? "TH"}
                  </span>
                </div>
              </div>
              <div className="h-14 w-px bg-white/15" />
              <div className="text-center">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-400/60">
                  Total Time
                </div>
                <div className="tabnum font-mono text-3xl font-black text-white">
                  {((myResult?.timeMs ?? 0) / 1000).toFixed(2)}
                  <span className="text-base text-cyan-400/70">s</span>
                </div>
              </div>
              <div className="hidden h-14 w-px bg-white/15 sm:block" />
              <div className="hidden text-center sm:block">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-400/60">
                  Circuit
                </div>
                <div className="text-lg font-black uppercase tracking-wide text-white">
                  {TRACKS.find((t) => t.id === trackId)?.name}
                </div>
              </div>
            </div>

            <div className="mb-5 max-h-[34vh] space-y-1.5 overflow-y-auto">
              {results.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[2.2rem_1fr_4.5rem] items-center gap-2 border-l-2 py-2 pl-3 pr-3 rounded-r-md"
                  style={{
                    borderColor: r.isPlayer ? "#00f0ff" : r.color,
                    background: r.isPlayer ? "rgba(0,240,255,.12)" : "rgba(255,255,255,.03)",
                  }}
                >
                  <span
                    className="tabnum font-mono text-xs font-bold"
                    style={{ color: r.place <= 3 ? "#00f0ff" : "rgba(255,255,255,.4)" }}
                  >
                    {String(r.place).padStart(2, "0")}
                  </span>
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: r.color, boxShadow: `0 0 8px ${r.color}` }}
                    />
                    <span
                      className={`truncate text-sm font-black uppercase tracking-wide ${
                        r.isPlayer ? "text-cyan-300" : "text-white/70"
                      }`}
                    >
                      {r.name}
                    </span>
                  </span>
                  <span className="tabnum text-right font-mono text-xs font-bold text-white/80">
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
