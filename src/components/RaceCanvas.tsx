"use client";

import { useEffect, useRef, useState } from "react";
import { RaceEngine, RacerConfig, HudState, RaceResult } from "@/game/engine";
import { audio } from "@/game/audio";

const ORD = ["1", "2", "3", "4", "5", "6", "7", "8"];
const SUF = ["ST", "ND", "RD", "TH", "TH", "TH", "TH", "TH"];

function Tachometer({ speed, boost }: { speed: number; boost: number }) {
  const maxSpeed = 120;
  const pct = Math.max(0, Math.min(1, speed / maxSpeed));
  const R = 44;
  const C = 2 * Math.PI * R;
  const SWEEP = 0.72; // 260 deg arc
  const arc = C * SWEEP;

  return (
    <div className="relative h-28 w-28 drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]">
      <svg viewBox="0 0 110 110" className="h-full w-full">
        <g transform="rotate(140 55 55)">
          {/* Outer Housing */}
          <circle cx="55" cy="55" r="51" fill="rgba(8,14,18,0.78)" />
          <circle cx="55" cy="55" r="51" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />

          {/* Background Arc */}
          <circle
            cx="55"
            cy="55"
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="7"
            strokeLinecap="butt"
            strokeDasharray={`${arc} ${C}`}
          />

          {/* Speed Value Arc */}
          <circle
            cx="55"
            cy="55"
            r={R}
            fill="none"
            stroke={pct > 0.8 ? "#ff2a5f" : "#00f0ff"}
            strokeWidth="7"
            strokeLinecap="butt"
            strokeDasharray={`${arc * pct} ${C}`}
            style={{ transition: "stroke-dasharray 80ms linear" }}
          />

          {/* Inner Nitro Ring */}
          <circle
            cx="55"
            cy="55"
            r={R - 9}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * (R - 9) * SWEEP} ${2 * Math.PI * (R - 9)}`}
          />
          <circle
            cx="55"
            cy="55"
            r={R - 9}
            fill="none"
            stroke="#ffd700"
            strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * (R - 9) * SWEEP * boost} ${2 * Math.PI * (R - 9)}`}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pb-1">
        <span className="tabnum font-mono text-2xl font-black leading-none text-white tracking-tight">
          {Math.round(speed)}
        </span>
        <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.25em] text-cyan-400/80">
          KM/H
        </span>
      </div>
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

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-slate-950 font-display touch-none">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />

      {/* Cinematic Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0.05) 0%, transparent 60%, rgba(0,0,0,0.45) 100%)",
        }}
      />

      {/* Pause Button */}
      <button
        onClick={togglePause}
        className="pointer-events-auto absolute left-3 top-3 z-20 rounded-full border border-white/20 bg-black/50 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white/90 backdrop-blur-md transition hover:bg-black/70 hover:text-cyan-300 touch-manipulation sm:left-5 sm:top-4"
      >
        ❚❚ Pause
      </button>

      {/* Race Position Overlay (Top Center Arcade Badge) */}
      <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center sm:top-5">
        <div
          className="relative -rotate-2 text-[4.5rem] font-black italic leading-none tracking-[-0.08em] sm:text-[5.6rem]"
          style={{
            color: "#ffd700",
            WebkitTextStroke: "5px #0a0d14",
            textShadow: "0 6px 0 #b35900, 0 12px 22px rgba(0,0,0,.6), 0 0 20px rgba(255,215,0,.4)",
          }}
        >
          <span
            className="absolute inset-0 bg-gradient-to-b from-white via-[#ffe600] to-[#ff6600] bg-clip-text text-transparent"
            style={{ WebkitTextStroke: "0 transparent" }}
          >
            {ORD[place - 1] ?? "1"}
            <span className="text-[0.45em] tracking-[-0.12em]">{(SUF[place - 1] ?? "TH").toLowerCase()}</span>
          </span>
          <span aria-hidden="true">
            {ORD[place - 1] ?? "1"}
            <span className="text-[0.45em] tracking-[-0.12em]">{(SUF[place - 1] ?? "TH").toLowerCase()}</span>
          </span>
        </div>
      </div>

      {/* Top Right Tachometer & Speed Display */}
      <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-end sm:right-5 sm:top-4">
        <Tachometer speed={hud?.speed ?? 0} boost={boost} />

        {/* Nitro Charge Bar */}
        <div className="mt-1 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-md border border-white/10">
          <span className="text-[9px] font-bold uppercase tracking-widest text-yellow-400">
            {ready ? "NITRO READY!" : "NITRO"}
          </span>
          <div className="h-2 w-20 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-100 ${
                ready
                  ? "bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500 shadow-[0_0_12px_#ffd700]"
                  : "bg-cyan-400"
              }`}
              style={{ width: `${Math.round(boost * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Left Leaderboard Ladder */}
      <div className="pointer-events-none absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-1 sm:flex sm:left-5">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">
          Grid Position
        </div>
        {hud?.racers.slice(0, 8).map((r, i) => (
          <div
            key={r.id}
            className={`flex items-center gap-2 border-l-2 py-1 pl-2 pr-3 backdrop-blur-md transition-colors ${
              r.isPlayer ? "bg-white/15 border-cyan-400" : "bg-black/40 border-white/20"
            }`}
            style={{ borderColor: r.isPlayer ? "#00f0ff" : r.color }}
          >
            <span className="tabnum w-3 font-mono text-[11px] font-bold text-white/50">{i + 1}</span>
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: r.color, boxShadow: `0 0 8px ${r.color}` }}
            />
            <span
              className={`w-20 truncate text-[11px] font-black uppercase tracking-wider ${
                r.isPlayer ? "text-cyan-300" : "text-white/70"
              }`}
            >
              {r.name}
            </span>
            <span className="tabnum font-mono text-[10px] text-white/40">
              {(r.progress * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>

      {/* Circuit Progress Bar (Bottom Telemetry) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-1 sm:bottom-3 z-10 px-4 sm:px-8">
        <div className="mx-auto max-w-xl">
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/50">
            <span>Track Progress</span>
            <span className="font-mono text-cyan-400">{((hud?.progress ?? 0) * 100).toFixed(0)}%</span>
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-black/60 border border-white/15 backdrop-blur-md">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-yellow-300 transition-all duration-75 shadow-[0_0_10px_rgba(0,240,255,0.6)]"
              style={{ width: `${((hud?.progress ?? 0) * 100).toFixed(1)}%` }}
            />
            {hud?.racers
              .filter((r) => !r.isPlayer)
              .map((r) => (
                <div
                  key={r.id}
                  className="absolute top-0 h-full w-1 rounded-full opacity-80"
                  style={{ left: `${(r.progress * 100).toFixed(1)}%`, background: r.color }}
                />
              ))}
          </div>
        </div>
      </div>

      {/* On-Screen Mobile Touch Controls */}
      {touchUi ? (
        <div className="absolute inset-x-0 bottom-8 z-20 flex items-end justify-between px-4 pb-2">
          {/* Steering Pad (Left/Right) */}
          <div className="flex gap-3">
            <button
              onPointerDown={() => eng()?.touch(-1)}
              onPointerUp={() => eng()?.touch(0)}
              onPointerLeave={() => eng()?.touch(0)}
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-black/50 text-2xl text-white/80 backdrop-blur-md active:scale-95 active:border-cyan-400 active:bg-cyan-500/20 active:text-white touch-manipulation"
            >
              ◀
            </button>
            <button
              onPointerDown={() => eng()?.touch(1)}
              onPointerUp={() => eng()?.touch(0)}
              onPointerLeave={() => eng()?.touch(0)}
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-black/50 text-2xl text-white/80 backdrop-blur-md active:scale-95 active:border-cyan-400 active:bg-cyan-500/20 active:text-white touch-manipulation"
            >
              ▶
            </button>
          </div>

          {/* Action Buttons (Nitro & Jump) */}
          <div className="flex items-center gap-3">
            <button
              onPointerDown={() => eng()?.doBoost()}
              className={`relative flex h-16 w-16 flex-col items-center justify-center rounded-2xl border backdrop-blur-md transition active:scale-95 touch-manipulation ${
                ready
                  ? "border-yellow-400 bg-yellow-500/25 text-yellow-300 shadow-[0_0_24px_rgba(255,215,0,0.5)] animate-pulse"
                  : "border-white/15 bg-black/50 text-white/40"
              }`}
            >
              <span className="text-xl">⚡</span>
              <span className="text-[9px] font-black uppercase tracking-widest">NITRO</span>
            </button>

            <button
              onPointerDown={() => eng()?.doJump()}
              className="flex h-16 w-16 flex-col items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/20 text-emerald-300 backdrop-blur-md active:scale-95 active:bg-emerald-400/40 touch-manipulation"
            >
              <span className="text-xl">▲</span>
              <span className="text-[9px] font-black uppercase tracking-widest">JUMP</span>
            </button>
          </div>
        </div>
      ) : (
        /* Desktop Keyboard Hint Legend */
        <div className="pointer-events-none absolute bottom-12 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-3 sm:flex">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/50 px-3 py-1.5 backdrop-blur-md">
            <kbd className="font-mono text-xs font-bold text-cyan-400">A / D</kbd>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Steer</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/50 px-3 py-1.5 backdrop-blur-md">
            <kbd className="font-mono text-xs font-bold text-cyan-400">SPACE</kbd>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Jump</span>
          </div>
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 backdrop-blur-md ${
              ready ? "border-yellow-400 bg-yellow-500/20 text-yellow-300" : "border-white/10 bg-black/50 text-white/50"
            }`}
          >
            <kbd className="font-mono text-xs font-bold">SHIFT</kbd>
            <span className="text-[10px] font-bold uppercase tracking-widest">
              {ready ? "NITRO READY" : "Nitro"}
            </span>
          </div>
        </div>
      )}

      {/* 3-2-1 Countdown Overlay */}
      {cd !== null && cd > 0 && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.6em] text-cyan-400">
            GET READY
          </div>
          <div className="relative flex h-36 w-36 items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-400/40" />
            <div className="absolute inset-0 animate-ping rounded-full border-2 border-yellow-400/60" />
            <span
              key={cd}
              className="tabnum font-mono text-[6.5rem] font-black leading-none text-white drop-shadow-[0_0_40px_rgba(0,240,255,0.8)]"
            >
              {cd}
            </span>
          </div>
        </div>
      )}

      {/* GO Splash Overlay */}
      {cd === 0 && go && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div
            className="animate-[go_.85s_ease-out_forwards] text-8xl font-black italic uppercase tracking-tight text-emerald-400"
            style={{ textShadow: "0 0 60px rgba(0,255,136,.9)" }}
          >
            GO!
          </div>
        </div>
      )}

      {/* Pause Menu Overlay */}
      {paused && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-sm border border-cyan-400/40 bg-slate-900/90 p-6 text-center rounded-2xl shadow-[0_0_50px_rgba(0,240,255,0.25)] animate-[fadeUp_.25s_ease-out]">
            <h2 className="mb-1 text-2xl font-black uppercase tracking-widest text-cyan-400">
              GAME PAUSED
            </h2>
            <p className="mb-6 font-mono text-xs uppercase tracking-wider text-white/50">
              Race on pause
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={togglePause}
                className="w-full rounded-xl border border-cyan-400/60 bg-cyan-500/20 py-3 text-sm font-black uppercase tracking-wider text-cyan-300 transition hover:bg-cyan-500/30 touch-manipulation"
              >
                Resume Race
              </button>
              <button
                onClick={() => {
                  try {
                    audio.uiBack();
                  } catch {}
                  onExit();
                }}
                className="w-full rounded-xl border border-white/20 bg-white/5 py-3 text-sm font-black uppercase tracking-wider text-white/70 transition hover:bg-white/10 hover:text-white touch-manipulation"
              >
                Exit to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Race Finish Banner */}
      {hud?.finished && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 flex -translate-y-1/2 justify-center">
          <div className="animate-[fadeUp_.4s_ease-out] rounded-2xl border border-cyan-400/40 bg-black/80 px-10 py-6 text-center backdrop-blur-xl shadow-[0_0_50px_rgba(0,240,255,0.3)]">
            <div className="text-xs font-bold uppercase tracking-[0.5em] text-white/50">
              RACE FINISHED
            </div>
            <div className="mt-1 text-4xl font-black uppercase tracking-tight text-cyan-300">
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
