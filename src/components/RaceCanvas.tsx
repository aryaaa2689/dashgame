"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RaceEngine, RacerConfig, HudState, RaceResult } from "@/game/engine";
import { audio } from "@/game/audio";
import { buildPath, getTrack } from "@/lib/track";

const ORD = ["1", "2", "3", "4", "5", "6", "7", "8"];
const SUF = ["ST", "ND", "RD", "TH", "TH", "TH", "TH", "TH"];

function formatTime(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

function Tachometer({ speed, boost, nitro }: { speed: number; boost: number; nitro: boolean }) {
  const maxSpeed = 220;
  const pct = Math.max(0, Math.min(1, speed / maxSpeed));
  const R = 46;
  const C = 2 * Math.PI * R;
  const SWEEP = 0.75;
  const arc = C * SWEEP;

  return (
    <div className="relative h-[7.4rem] w-[7.4rem]">
      <svg viewBox="0 0 114 114" className="h-full w-full drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)]">
        <g transform="rotate(135 57 57)">
          <circle cx="57" cy="57" r="54" fill="rgba(6,10,16,0.78)" />
          <circle cx="57" cy="57" r="54" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.4" />
          <circle
            cx="57"
            cy="57"
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
            strokeDasharray={`${arc} ${C}`}
          />
          <circle
            cx="57"
            cy="57"
            r={R}
            fill="none"
            stroke={pct > 0.82 ? "#ff3b6b" : nitro ? "#ffe27a" : "#6cf3ff"}
            strokeWidth="8"
            strokeDasharray={`${arc * pct} ${C}`}
            style={{ transition: "stroke-dasharray 70ms linear" }}
          />
          <circle
            cx="57"
            cy="57"
            r={R - 11}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="3.2"
            strokeDasharray={`${2 * Math.PI * (R - 11) * SWEEP} ${2 * Math.PI * (R - 11)}`}
          />
          <circle
            cx="57"
            cy="57"
            r={R - 11}
            fill="none"
            stroke="#ffd24a"
            strokeWidth="3.2"
            strokeDasharray={`${2 * Math.PI * (R - 11) * SWEEP * boost} ${2 * Math.PI * (R - 11)}`}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pb-1">
        <span className="tabnum font-mono text-[1.65rem] font-black leading-none tracking-tight text-white">
          {Math.round(speed)}
        </span>
        <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.28em] text-cyan-300/75">km/h</span>
      </div>
    </div>
  );
}

function MiniMap({
  trackId,
  racers,
}: {
  trackId: string;
  racers: HudState["racers"] | undefined;
}) {
  const pts = useMemo(() => {
    const path = buildPath(getTrack(trackId));
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    const raw = path.points.filter((_, i) => i % 3 === 0);
    for (const p of raw) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    const pad = 12;
    const sx = 108 / Math.max(1, maxX - minX + pad * 2);
    const sz = 78 / Math.max(1, maxZ - minZ + pad * 2);
    const s = Math.min(sx, sz);
    const d = raw
      .map((p, i) => {
        const x = 8 + (p.x - minX + pad) * s;
        const y = 8 + (p.z - minZ + pad) * s;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
    return { d, minX, minZ, pad, s, points: path.points };
  }, [trackId]);

  return (
    <div className="pointer-events-none hidden overflow-hidden rounded-xl border border-white/15 bg-black/45 p-1.5 backdrop-blur-md sm:block">
      <svg viewBox="0 0 124 94" className="h-[5.6rem] w-[7.6rem]">
        <path d={pts.d} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="6" strokeLinecap="round" />
        <path d={pts.d} fill="none" stroke="#6cf3ff" strokeWidth="2.1" strokeLinecap="round" />
        {racers?.map((r) => {
          const idx = Math.min(
            pts.points.length - 1,
            Math.max(0, Math.round(r.progress * (pts.points.length - 1))),
          );
          const p = pts.points[idx];
          const x = 8 + (p.x - pts.minX + pts.pad) * pts.s;
          const y = 8 + (p.z - pts.minZ + pts.pad) * pts.s;
          return (
            <circle
              key={r.id}
              cx={x}
              cy={y}
              r={r.isPlayer ? 3.4 : 2.2}
              fill={r.isPlayer ? "#fff" : r.color}
              stroke={r.isPlayer ? "#6cf3ff" : "rgba(0,0,0,0.45)"}
              strokeWidth={r.isPlayer ? 1.4 : 0.6}
            />
          );
        })}
      </svg>
    </div>
  );
}

export default function RaceCanvas({
  trackId,
  racers,
  startAt,
  netPush,
  onEngine,
  onFinish,
  onExit,
}: {
  trackId: string;
  racers: RacerConfig[];
  startAt: number;
  netPush?: (s: { dist: number; lane: number; hop: number; speed: number }) => void;
  onEngine?: (e: RaceEngine | null) => void;
  onFinish: (r: RaceResult[]) => void;
  onExit: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RaceEngine | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [go, setGo] = useState(false);
  const [touchUi, setTouchUi] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setTouchUi(window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 900);
    const canvas = canvasRef.current!;
    const engine = new RaceEngine(canvas, trackId, racers, setHud, onFinish);
    engine.setStartAt(startAt);
    if (netPush) engine.netPush = netPush;
    engineRef.current = engine;
    onEngine?.(engine);
    const onResize = () =>
      engine.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
    window.addEventListener("resize", onResize);
    onResize();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        setPaused((prev) => {
          const next = !prev;
          if (engineRef.current) engineRef.current.running = !next;
          return next;
        });
      }
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", handleKey);
      engine.dispose();
      engineRef.current = null;
      onEngine?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hud?.countdown === 0 && !go) setGo(true);
  }, [hud?.countdown, go]);

  const togglePause = () => {
    try {
      audio.uiClick();
    } catch {}
    setPaused((prev) => {
      const next = !prev;
      if (engineRef.current) engineRef.current.running = !next;
      return next;
    });
  };

  const eng = () => engineRef.current;
  const cd = hud?.countdown ?? null;
  const place = hud?.place ?? 1;
  const boost = hud?.boostCharge ?? 0;
  const ready = boost >= 0.95;
  const nitro = !!hud?.nitroActive;

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-[#05080d] font-display touch-none">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 42%, transparent 40%, rgba(0,0,0,0.38) 100%)",
        }}
      />
      {nitro && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,230,255,0.08),transparent_60%)]" />
      )}

      {/* Top chrome */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="flex items-start gap-2">
          <button
            onClick={togglePause}
            className="pointer-events-auto rounded-full border border-white/18 bg-black/50 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white/90 backdrop-blur-md transition hover:border-cyan-300/50 hover:text-cyan-200 touch-manipulation"
          >
            Pause
          </button>
          <div className="hidden rounded-full border border-white/12 bg-black/40 px-3 py-1.5 backdrop-blur-md sm:block">
            <div className="text-[9px] font-bold uppercase tracking-[0.28em] text-white/40">Circuit</div>
            <div className="text-[11px] font-black uppercase tracking-wide text-white/85">{hud?.trackName}</div>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div
            className="-rotate-2 text-[4.2rem] font-black italic leading-none tracking-[-0.08em] sm:text-[5.4rem]"
            style={{
              color: "#ffd24a",
              WebkitTextStroke: "5px #0a0d14",
              textShadow: "0 6px 0 #9a4d00, 0 12px 22px rgba(0,0,0,.55)",
            }}
          >
            <span
              className="absolute inset-0 bg-gradient-to-b from-white via-[#ffe600] to-[#ff7a1a] bg-clip-text text-transparent"
              style={{ WebkitTextStroke: "0 transparent" }}
            >
              {ORD[place - 1] ?? "1"}
              <span className="text-[0.42em] tracking-[-0.1em]">{(SUF[place - 1] ?? "TH").toLowerCase()}</span>
            </span>
            <span aria-hidden="true">
              {ORD[place - 1] ?? "1"}
              <span className="text-[0.42em] tracking-[-0.1em]">{(SUF[place - 1] ?? "TH").toLowerCase()}</span>
            </span>
          </div>
          <div className="mt-1 rounded-full border border-white/12 bg-black/45 px-3 py-0.5 font-mono text-[11px] text-white/70 backdrop-blur-md">
            {hud?.gapAhead && hud.gapAhead > 0.04 ? (
              <span>
                <span className="text-white/40">GAP </span>
                <span className="text-cyan-300">+{hud.gapAhead.toFixed(2)}s</span>
              </span>
            ) : (
              <span className="text-amber-300">P1 · LEADING</span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Tachometer speed={hud?.speed ?? 0} boost={boost} nitro={nitro} />
          <div className="flex items-center gap-2 rounded-full border border-white/12 bg-black/50 px-2.5 py-1 backdrop-blur-md">
            <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${ready ? "text-amber-300" : "text-white/45"}`}>
              {ready ? "NITRO READY" : "NITRO"}
            </span>
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${
                  ready ? "bg-gradient-to-r from-amber-300 to-orange-500" : "bg-cyan-400"
                }`}
                style={{ width: `${Math.round(boost * 100)}%` }}
              />
            </div>
          </div>
          <div className="hidden rounded-lg border border-white/12 bg-black/45 px-2.5 py-1.5 text-right backdrop-blur-md sm:block">
            <div className="tabnum font-mono text-sm font-bold text-white">{formatTime(hud?.time ?? 0)}</div>
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">
              {hud?.score ?? 0} pts
            </div>
          </div>
          <MiniMap trackId={trackId} racers={hud?.racers} />
        </div>
      </div>

      {/* Ladder */}
      <div className="pointer-events-none absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-1 sm:flex sm:left-5">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.3em] text-white/35">Live order</div>
        {hud?.racers.slice(0, 8).map((r, i) => (
          <div
            key={r.id}
            className={`flex items-center gap-2 border-l-2 py-1 pl-2 pr-3 backdrop-blur-md ${
              r.isPlayer ? "bg-cyan-400/15" : "bg-black/40"
            }`}
            style={{ borderColor: r.isPlayer ? "#6cf3ff" : r.color }}
          >
            <span className="tabnum w-3 font-mono text-[11px] font-bold text-white/45">{i + 1}</span>
            <span className="h-2 w-2 rounded-full" style={{ background: r.color, boxShadow: `0 0 8px ${r.color}` }} />
            <span className={`w-[4.6rem] truncate text-[11px] font-black uppercase tracking-wider ${r.isPlayer ? "text-cyan-200" : "text-white/70"}`}>
              {r.name}
            </span>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="pointer-events-none absolute inset-x-0 bottom-1 z-10 px-4 sm:bottom-3 sm:px-8">
        <div className="mx-auto max-w-xl">
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/45">
            <span>Lap progress</span>
            <span className="font-mono text-cyan-300">{((hud?.progress ?? 0) * 100).toFixed(0)}%</span>
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full border border-white/15 bg-black/55 backdrop-blur-md">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-300"
              style={{ width: `${((hud?.progress ?? 0) * 100).toFixed(1)}%` }}
            />
            {hud?.racers
              .filter((r) => !r.isPlayer)
              .map((r) => (
                <div
                  key={r.id}
                  className="absolute top-0 h-full w-1 rounded-full opacity-85"
                  style={{ left: `${(r.progress * 100).toFixed(1)}%`, background: r.color }}
                />
              ))}
          </div>
        </div>
      </div>

      {touchUi ? (
        <div className="absolute inset-x-0 bottom-8 z-20 flex items-end justify-between px-4 pb-2">
          <div className="flex gap-3">
            <button
              onPointerDown={() => eng()?.touch(-1)}
              onPointerUp={() => eng()?.touch(0)}
              onPointerLeave={() => eng()?.touch(0)}
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-black/50 text-2xl text-white/80 backdrop-blur-md active:scale-95 active:border-cyan-400 touch-manipulation"
            >
              ◀
            </button>
            <button
              onPointerDown={() => eng()?.touch(1)}
              onPointerUp={() => eng()?.touch(0)}
              onPointerLeave={() => eng()?.touch(0)}
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-black/50 text-2xl text-white/80 backdrop-blur-md active:scale-95 active:border-cyan-400 touch-manipulation"
            >
              ▶
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onPointerDown={() => eng()?.doBoost()}
              className={`relative flex h-16 w-16 flex-col items-center justify-center rounded-2xl border backdrop-blur-md active:scale-95 touch-manipulation ${
                ready
                  ? "border-yellow-400 bg-yellow-500/25 text-yellow-300 shadow-[0_0_24px_rgba(255,215,0,0.45)]"
                  : "border-white/15 bg-black/50 text-white/40"
              }`}
            >
              <span className="text-xl">⚡</span>
              <span className="text-[9px] font-black uppercase tracking-widest">Nitro</span>
            </button>
            <button
              onPointerDown={() => eng()?.doJump()}
              className="flex h-16 w-16 flex-col items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/20 text-emerald-300 backdrop-blur-md active:scale-95 touch-manipulation"
            >
              <span className="text-xl">▲</span>
              <span className="text-[9px] font-black uppercase tracking-widest">Jump</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-12 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-2 sm:flex">
          {[
            ["A / D", "Steer"],
            ["SPACE", "Jump"],
          ].map(([k, l]) => (
            <div key={k} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/50 px-3 py-1.5 backdrop-blur-md">
              <kbd className="font-mono text-xs font-bold text-cyan-300">{k}</kbd>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">{l}</span>
            </div>
          ))}
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 backdrop-blur-md ${
              ready ? "border-yellow-400 bg-yellow-500/20 text-yellow-300" : "border-white/10 bg-black/50 text-white/50"
            }`}
          >
            <kbd className="font-mono text-xs font-bold">SHIFT</kbd>
            <span className="text-[10px] font-bold uppercase tracking-widest">{ready ? "Nitro ready" : "Nitro"}</span>
          </div>
        </div>
      )}

      {cd !== null && cd > 0 && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/35 backdrop-blur-[2px]">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.62em] text-cyan-300">Lights out</div>
          <div className="relative flex h-40 w-40 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-cyan-300/35" />
            <div className="absolute inset-0 animate-ping rounded-full border border-amber-300/40" />
            <span key={cd} className="tabnum font-mono text-[7rem] font-black leading-none text-white drop-shadow-[0_0_40px_rgba(0,240,255,0.75)]">
              {cd}
            </span>
          </div>
        </div>
      )}

      {cd === 0 && go && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div
            className="animate-[go_.85s_ease-out_forwards] text-8xl font-black italic uppercase tracking-tight text-emerald-400"
            style={{ textShadow: "0 0 60px rgba(0,255,136,.85)" }}
          >
            GO!
          </div>
        </div>
      )}

      {paused && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/72 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-cyan-400/35 bg-[#0a121c]/92 p-6 text-center shadow-[0_0_50px_rgba(0,240,255,0.18)]">
            <h2 className="mb-1 text-2xl font-black uppercase tracking-[0.22em] text-cyan-300">Paused</h2>
            <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.22em] text-white/45">Race held</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={togglePause}
                className="w-full rounded-xl border border-cyan-400/55 bg-cyan-500/20 py-3 text-sm font-black uppercase tracking-wider text-cyan-200 hover:bg-cyan-500/30"
              >
                Resume
              </button>
              <button
                onClick={() => {
                  try {
                    audio.uiBack();
                  } catch {}
                  onExit();
                }}
                className="w-full rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-black uppercase tracking-wider text-white/70 hover:bg-white/10"
              >
                Exit to menu
              </button>
            </div>
          </div>
        </div>
      )}

      {hud?.finished && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 flex -translate-y-1/2 justify-center">
          <div className="animate-[fadeUp_.4s_ease-out] rounded-2xl border border-cyan-400/35 bg-black/78 px-10 py-6 text-center backdrop-blur-xl shadow-[0_0_50px_rgba(0,240,255,0.22)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.5em] text-white/45">Chequered flag</div>
            <div className="mt-1 text-4xl font-black uppercase tracking-tight text-cyan-200">
              P{place} · {(hud.time ?? 0).toFixed(2)}s
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes go {
          0% {
            transform: scale(0.4) skewX(-10deg);
            opacity: 0;
          }
          30% {
            transform: scale(1.15) skewX(-10deg);
            opacity: 1;
          }
          100% {
            transform: scale(1.8) skewX(-10deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
