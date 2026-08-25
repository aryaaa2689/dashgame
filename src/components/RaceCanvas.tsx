"use client";

import { useEffect, useRef, useState } from "react";
import { RaceEngine, RacerConfig, HudState, RaceResult } from "@/game/engine";
import { audio } from "@/game/audio";

const SUF = ["st", "nd", "rd", "th", "th", "th", "th", "th"];

function formatTime(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
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
  const [hints, setHints] = useState(true);

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
    const hintT = window.setTimeout(() => setHints(false), 5200);

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
      window.clearTimeout(hintT);
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
  const speedPct = Math.min(1, (hud?.speed ?? 0) / 240);

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-[#071018] font-display touch-none">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.28)_100%)]" />
      {nitro && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(80,220,255,0.07),transparent_62%)]" />}

      <button
        onClick={togglePause}
        className="pointer-events-auto absolute left-4 top-4 z-20 rounded-full bg-black/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/80 backdrop-blur-sm hover:text-white"
      >
        Pause
      </button>

      <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 text-center">
        <div className="text-[2.6rem] font-black italic leading-none tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,.65)] sm:text-5xl">
          {place}
          <span className="text-[0.42em] uppercase text-white/70">{SUF[place - 1] ?? "th"}</span>
        </div>
        <div className="mt-0.5 font-mono text-[11px] font-bold text-white/70">
          {hud?.gapAhead && hud.gapAhead > 0.05 ? `+${hud.gapAhead.toFixed(2)}s` : "lead"}
        </div>
      </div>

      <div className="pointer-events-none absolute right-4 top-4 z-10 w-28 text-right">
        <div className="tabnum text-3xl font-black leading-none text-white drop-shadow-[0_2px_10px_rgba(0,0,0,.6)]">
          {Math.round(hud?.speed ?? 0)}
        </div>
        <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/45">km/h</div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/15">
          <div className={`h-full ${nitro ? "bg-amber-300" : "bg-cyan-300"}`} style={{ width: `${speedPct * 100}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-end gap-1.5">
          <span className={`text-[9px] font-black uppercase tracking-widest ${ready ? "text-amber-300" : "text-white/40"}`}>
            {ready ? "nitro" : "n2o"}
          </span>
          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/15">
            <div className={`h-full ${ready ? "bg-amber-300" : "bg-white/50"}`} style={{ width: `${boost * 100}%` }} />
          </div>
        </div>
        <div className="mt-2 font-mono text-[11px] text-white/55">{formatTime(hud?.time ?? 0)}</div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 px-8">
        <div className="relative mx-auto h-1.5 max-w-md overflow-hidden rounded-full bg-black/40">
          <div className="h-full bg-white/80" style={{ width: `${((hud?.progress ?? 0) * 100).toFixed(1)}%` }} />
          {hud?.racers
            .filter((r) => !r.isPlayer)
            .map((r) => (
              <div
                key={r.id}
                className="absolute top-0 h-full w-1 rounded-full"
                style={{ left: `${(r.progress * 100).toFixed(1)}%`, background: r.color }}
              />
            ))}
        </div>
      </div>

      {touchUi && (
        <div className="absolute inset-x-0 bottom-8 z-20 flex items-end justify-between px-5">
          <div className="flex gap-2">
            <button
              onPointerDown={() => eng()?.touch(-1)}
              onPointerUp={() => eng()?.touch(0)}
              onPointerLeave={() => eng()?.touch(0)}
              className="h-14 w-14 rounded-full bg-black/40 text-xl text-white/80 backdrop-blur-sm active:bg-white/20"
            >
              ◀
            </button>
            <button
              onPointerDown={() => eng()?.touch(1)}
              onPointerUp={() => eng()?.touch(0)}
              onPointerLeave={() => eng()?.touch(0)}
              className="h-14 w-14 rounded-full bg-black/40 text-xl text-white/80 backdrop-blur-sm active:bg-white/20"
            >
              ▶
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onPointerDown={() => eng()?.doBoost()}
              className={`h-14 w-14 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-sm ${
                ready ? "bg-amber-400/80 text-black" : "bg-black/40 text-white/40"
              }`}
            >
              N2O
            </button>
            <button
              onPointerDown={() => eng()?.doJump()}
              className="h-14 w-14 rounded-full bg-black/40 text-[10px] font-black uppercase tracking-widest text-white/80 backdrop-blur-sm"
            >
              Jump
            </button>
          </div>
        </div>
      )}

      {hints && !touchUi && (
        <div className="pointer-events-none absolute bottom-10 left-1/2 z-10 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
          A D steer · space jump · shift nitro
        </div>
      )}

      {cd !== null && cd > 0 && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <span key={cd} className="tabnum text-[7rem] font-black text-white drop-shadow-[0_0_30px_rgba(0,0,0,.7)]">
            {cd}
          </span>
        </div>
      )}
      {cd === 0 && go && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="animate-[go_.7s_ease-out_forwards] text-7xl font-black italic text-white">GO</div>
        </div>
      )}

      {paused && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-72 rounded-2xl bg-[#0c141c]/95 p-6 text-center">
            <div className="mb-5 text-xl font-black uppercase tracking-[0.2em]">Paused</div>
            <button onClick={togglePause} className="mb-2 w-full rounded-xl bg-white py-3 text-sm font-black uppercase tracking-wider text-black">
              Resume
            </button>
            <button
              onClick={() => {
                try {
                  audio.uiBack();
                } catch {}
                onExit();
              }}
              className="w-full rounded-xl bg-white/10 py-3 text-sm font-black uppercase tracking-wider text-white/70"
            >
              Menu
            </button>
          </div>
        </div>
      )}

      {hud?.finished && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 -translate-y-1/2 text-center">
          <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-white/50">Finished</div>
          <div className="text-4xl font-black text-white">
            P{place} · {(hud.time ?? 0).toFixed(2)}s
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes go {
          0% { transform: scale(0.6); opacity: 0; }
          25% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
