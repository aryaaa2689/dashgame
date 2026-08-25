"use client";

import { useEffect, useRef, useState } from "react";
import { RaceEngine, RacerConfig, HudState, RaceResult } from "@/game/engine";
import { getTrack } from "@/lib/track";
import { audio } from "@/game/audio";

const ORD = ["1", "2", "3", "4", "5", "6", "7", "8"];
const SUF = ["ST", "ND", "RD", "TH", "TH", "TH", "TH", "TH"];

function Tach({ speed, boost }: { speed: number; boost: number }) {
  const max = 95;
  const pct = Math.max(0, Math.min(1, speed / max));
  const R = 46;
  const C = 2 * Math.PI * R;
  const SWEEP = 0.68; // 245deg
  const arc = C * SWEEP;
  const redline = 0.78;

  return (
    <div className="relative h-[7.5rem] w-[7.5rem]">
      <svg viewBox="0 0 110 110" className="h-full w-full">
        <g transform="rotate(148 55 55)">
          {/* housing */}
          <circle cx="55" cy="55" r="52" fill="rgba(6,12,9,0.62)" />
          <circle cx="55" cy="55" r="52" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="1" />
          {/* track */}
          <circle
            cx="55"
            cy="55"
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="6"
            strokeLinecap="butt"
            strokeDasharray={`${arc} ${C}`}
          />
          {/* redline zone */}
          <circle
            cx="55"
            cy="55"
            r={R}
            fill="none"
            stroke="rgba(255,72,88,0.35)"
            strokeWidth="6"
            strokeDasharray={`${arc * (1 - redline)} ${C}`}
            strokeDashoffset={-arc * redline}
          />
          {/* value */}
          <circle
            cx="55"
            cy="55"
            r={R}
            fill="none"
            stroke={pct > redline ? "#ff5566" : "#35e08a"}
            strokeWidth="6"
            strokeLinecap="butt"
            strokeDasharray={`${arc * pct} ${C}`}
            style={{ transition: "stroke-dasharray 90ms linear" }}
          />
          {/* boost inner ring */}
          <circle
            cx="55"
            cy="55"
            r={R - 8}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="2.5"
            strokeDasharray={`${2 * Math.PI * (R - 8) * SWEEP} ${2 * Math.PI * (R - 8)}`}
          />
          <circle
            cx="55"
            cy="55"
            r={R - 8}
            fill="none"
            stroke="#ffc93d"
            strokeWidth="2.5"
            strokeDasharray={`${2 * Math.PI * (R - 8) * SWEEP * boost} ${2 * Math.PI * (R - 8)}`}
          />
          {/* ticks */}
          {Array.from({ length: 11 }).map((_, i) => {
            const a = (i / 10) * SWEEP * 360;
            const rad = (a * Math.PI) / 180;
            const r1 = i % 5 === 0 ? 37 : 40;
            return (
              <line
                key={i}
                x1={55 + Math.cos(rad) * r1}
                y1={55 + Math.sin(rad) * r1}
                x2={55 + Math.cos(rad) * 42}
                y2={55 + Math.sin(rad) * 42}
                stroke="rgba(255,255,255,0.28)"
                strokeWidth={i % 5 === 0 ? 1.6 : 0.8}
              />
            );
          })}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pb-1">
        <span className="tabnum font-mono text-[1.7rem] font-bold leading-none text-white">
          {String(Math.round(speed)).padStart(2, "0")}
        </span>
        <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.28em] text-white/35">
          km/h
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
    return () => {
      window.removeEventListener("resize", onResize);
      engine.dispose();
      engineRef.current = null;
      onEngine?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hud?.countdown === 0 && !go) setGo(true);
  }, [hud?.countdown, go]);

  const eng = () => engineRef.current;
  const track = getTrack(trackId);
  const cd = hud?.countdown ?? null;
  const place = hud?.place ?? 1;
  const total = hud?.total ?? racers.length;
  const boost = hud?.boostCharge ?? 0;
  const ready = boost >= 1;
  const leader = hud?.racers?.[0];
  const gapToNext = (() => {
    if (!hud?.racers || place <= 1) return null;
    const me = hud.racers.find((r) => r.isPlayer);
    const ahead = hud.racers[place - 2];
    if (!me || !ahead) return null;
    return (ahead.progress - me.progress) * 100;
  })();

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-black font-display">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />

      {/* cinematic grade: vignette + faint scanline sheen */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0,0,0,0.45) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,.9) 0px, rgba(255,255,255,.9) 1px, transparent 1px, transparent 3px)",
        }}
      />

      {/* ══ TOP BAR ══ */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-3 pt-3 sm:px-5 sm:pt-4">
        {/* left: exit + track */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              audio.uiBack();
              onExit();
            }}
            className="pointer-events-auto clip-plate border border-white/10 bg-black/55 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60 backdrop-blur-md transition hover:border-white/25 hover:text-white"
          >
            Exit
          </button>
          <div className="clip-plate hidden border border-white/10 bg-black/45 px-3 py-1.5 backdrop-blur-md sm:block">
            <div className="text-[8px] font-semibold uppercase tracking-[0.3em] text-white/35">
              Circuit
            </div>
            <div className="-mt-0.5 text-[13px] font-semibold uppercase tracking-wider text-white/85">
              {track.name}
            </div>
          </div>
        </div>

        {/* center: position plate */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <div
              className="clip-plate flex items-end gap-1 border border-white/15 bg-black/60 px-5 py-2 backdrop-blur-xl"
              style={{
                boxShadow:
                  place === 1
                    ? "0 0 30px rgba(53,224,138,.28), inset 0 1px 0 rgba(255,255,255,.12)"
                    : "0 8px 30px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08)",
              }}
            >
              <span
                className="tabnum text-5xl font-bold leading-[0.85] tracking-tight sm:text-6xl"
                style={{
                  color: place === 1 ? "#35e08a" : "#fff",
                  textShadow: place === 1 ? "0 0 24px rgba(53,224,138,.5)" : "0 2px 10px rgba(0,0,0,.6)",
                }}
              >
                {ORD[place - 1] ?? "1"}
              </span>
              <span className="mb-1.5 text-lg font-semibold uppercase tracking-tight text-white/50">
                {SUF[place - 1] ?? "TH"}
              </span>
              <span className="mb-2 ml-1.5 border-l border-white/15 pl-2 text-[11px] font-medium uppercase tracking-widest text-white/40">
                of {total}
              </span>
            </div>
            {place === 1 && (
              <div className="pointer-events-none absolute inset-0 animate-[pulseRing_2.4s_ease-out_infinite] border border-emerald-400/40 clip-plate" />
            )}
          </div>
          {gapToNext !== null && (
            <div className="mt-1.5 font-mono text-[10px] font-medium tracking-widest text-white/45">
              ▲ {gapToNext.toFixed(1)}% TO P{place - 1}
            </div>
          )}
          {place === 1 && leader && (
            <div className="mt-1.5 font-mono text-[10px] font-medium tracking-widest text-emerald-300/70">
              ◆ LEADING
            </div>
          )}
        </div>

        {/* right: telemetry */}
        <div className="flex flex-col items-end gap-1.5">
          <Tach speed={hud?.speed ?? 0} boost={boost} />
          <div className="clip-plate-r flex items-center gap-3 border border-white/10 bg-black/50 px-3 py-1.5 backdrop-blur-md">
            <div className="text-right">
              <div className="text-[8px] font-semibold uppercase tracking-[0.25em] text-white/35">
                Time
              </div>
              <div className="tabnum -mt-0.5 font-mono text-sm font-medium text-white/90">
                {(hud?.time ?? 0).toFixed(2)}
              </div>
            </div>
            <div className="h-7 w-px bg-white/10" />
            <div className="text-right">
              <div className="text-[8px] font-semibold uppercase tracking-[0.25em] text-white/35">
                Score
              </div>
              <div className="tabnum -mt-0.5 font-mono text-sm font-medium text-amber-300">
                {String(hud?.score ?? 0).padStart(3, "0")}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ LEFT: race order ladder ══ */}
      <div className="pointer-events-none absolute left-3 top-1/2 hidden -translate-y-1/2 flex-col gap-1 sm:flex sm:left-5">
        {hud?.racers.slice(0, 8).map((r, i) => (
          <div
            key={r.id}
            className={`flex items-center gap-2 border-l-2 py-0.5 pl-2 pr-3 backdrop-blur-sm transition-colors ${
              r.isPlayer ? "bg-white/10" : "bg-black/25"
            }`}
            style={{ borderColor: r.isPlayer ? "#fff" : r.color }}
          >
            <span className="tabnum w-3 font-mono text-[10px] font-medium text-white/40">{i + 1}</span>
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: r.color, boxShadow: `0 0 6px ${r.color}` }}
            />
            <span
              className={`w-16 truncate text-[11px] font-semibold uppercase tracking-wider ${
                r.isPlayer ? "text-white" : "text-white/55"
              }`}
            >
              {r.name}
            </span>
            <span className="tabnum font-mono text-[9px] text-white/30">
              {(r.progress * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>

      {/* ══ BOTTOM: progress telemetry strip ══ */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0">
        <div className="mx-3 mb-3 sm:mx-5 sm:mb-4">
          <div className="mb-1.5 flex items-end justify-between px-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.3em] text-white/35">
              Circuit Progress
            </span>
            <span className="tabnum font-mono text-[11px] font-medium text-white/70">
              {((hud?.progress ?? 0) * 100).toFixed(0)}
              <span className="text-white/30">%</span>
            </span>
          </div>
          <div className="relative h-[6px] overflow-hidden rounded-sm bg-white/8 shadow-[inset_0_1px_3px_rgba(0,0,0,.7)]">
            {/* segment ticks */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, transparent 0, transparent calc(10% - 1px), rgba(255,255,255,.14) calc(10% - 1px), rgba(255,255,255,.14) 10%)",
              }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-200"
              style={{
                width: `${((hud?.progress ?? 0) * 100).toFixed(1)}%`,
                boxShadow: "0 0 10px rgba(53,224,138,.65)",
                transition: "width 90ms linear",
              }}
            />
            {/* rival ghost markers */}
            {hud?.racers
              .filter((r) => !r.isPlayer)
              .map((r) => (
                <div
                  key={r.id}
                  className="absolute top-0 h-full w-[2px] opacity-70"
                  style={{ left: `${(r.progress * 100).toFixed(1)}%`, background: r.color }}
                />
              ))}
          </div>
        </div>
      </div>

      {/* ══ CONTROLS ══ */}
      {touchUi ? (
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 pb-10">
          <div className="flex gap-2.5">
            {([-1, 1] as const).map((d) => (
              <button
                key={d}
                onPointerDown={() => eng()?.touch(d)}
                onPointerUp={() => eng()?.touch(0)}
                onPointerLeave={() => eng()?.touch(0)}
                className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-black/40 text-lg text-white/70 backdrop-blur-md transition active:scale-90 active:border-white/40 active:bg-white/15 active:text-white"
              >
                {d === -1 ? "◀" : "▶"}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2.5">
            <button
              onPointerDown={() => eng()?.doBoost()}
              className="relative flex h-16 w-16 flex-col items-center justify-center overflow-hidden rounded-full border transition active:scale-90"
              style={{
                borderColor: ready ? "rgba(255,201,61,.7)" : "rgba(255,255,255,.14)",
                background: ready ? "rgba(255,201,61,.16)" : "rgba(0,0,0,.4)",
                boxShadow: ready ? "0 0 22px rgba(255,201,61,.35)" : "none",
                backdropFilter: "blur(10px)",
              }}
            >
              <span
                className="relative z-10 text-base leading-none"
                style={{ color: ready ? "#ffc93d" : "rgba(255,255,255,.4)" }}
              >
                ⚡
              </span>
              <span
                className="relative z-10 mt-0.5 text-[8px] font-semibold uppercase tracking-widest"
                style={{ color: ready ? "#ffc93d" : "rgba(255,255,255,.3)" }}
              >
                Turbo
              </span>
              <div
                className="absolute inset-x-0 bottom-0 bg-black/55 transition-[height]"
                style={{ height: `${(1 - boost) * 100}%` }}
              />
            </button>
            <button
              onPointerDown={() => eng()?.doJump()}
              className="flex h-[4.6rem] w-[4.6rem] flex-col items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/15 text-emerald-200 backdrop-blur-md transition active:scale-90 active:bg-emerald-400/30"
              style={{ boxShadow: "0 0 22px rgba(53,224,138,.22)" }}
            >
              <span className="text-lg leading-none">▲</span>
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest">Jump</span>
            </button>
          </div>
        </div>
      ) : (
        /* desktop: minimal key legend + turbo status */
        <div className="pointer-events-none absolute bottom-14 left-1/2 flex -translate-x-1/2 items-center gap-2">
          {[
            { k: "A / D", l: "Steer" },
            { k: "SPACE", l: "Jump" },
          ].map((x) => (
            <div
              key={x.k}
              className="flex items-center gap-1.5 border border-white/10 bg-black/40 px-2 py-1 backdrop-blur-md"
            >
              <kbd className="font-mono text-[9px] font-medium tracking-wider text-white/70">{x.k}</kbd>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-white/35">
                {x.l}
              </span>
            </div>
          ))}
          <div
            className="flex items-center gap-1.5 border px-2 py-1 backdrop-blur-md transition-colors"
            style={{
              borderColor: ready ? "rgba(255,201,61,.55)" : "rgba(255,255,255,.1)",
              background: ready ? "rgba(255,201,61,.12)" : "rgba(0,0,0,.4)",
            }}
          >
            <kbd
              className="font-mono text-[9px] font-medium tracking-wider"
              style={{ color: ready ? "#ffc93d" : "rgba(255,255,255,.7)" }}
            >
              SHIFT
            </kbd>
            <span
              className="text-[9px] font-semibold uppercase tracking-widest"
              style={{ color: ready ? "#ffc93d" : "rgba(255,255,255,.35)" }}
            >
              {ready ? "Turbo Ready" : `Turbo ${Math.round(boost * 100)}%`}
            </span>
          </div>
        </div>
      )}

      {/* ══ COUNTDOWN ══ */}
      {cd !== null && cd > 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/25 backdrop-blur-[1.5px]">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.6em] text-white/40">
            Race Start
          </div>
          <div className="relative flex h-40 w-40 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-white/15" />
            <div className="absolute inset-0 animate-[pulseRing_1s_ease-out] rounded-full border-2 border-emerald-400/60" />
            <span
              key={cd}
              className="tabnum font-mono text-[6rem] font-bold leading-none text-white"
              style={{ textShadow: "0 0 50px rgba(53,224,138,.55)" }}
            >
              {cd}
            </span>
          </div>
        </div>
      )}
      {cd === 0 && go && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="animate-[go_.9s_ease-out_forwards] text-7xl font-bold uppercase italic tracking-tight text-emerald-300"
            style={{ textShadow: "0 0 60px rgba(53,224,138,.8)" }}
          >
            GO
          </div>
        </div>
      )}

      {/* finished banner while other racers complete */}
      {hud?.finished && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
          <div className="clip-plate animate-[fadeUp_.4s_ease-out] border border-emerald-400/30 bg-black/70 px-8 py-4 text-center backdrop-blur-xl">
            <div className="text-[10px] font-semibold uppercase tracking-[0.5em] text-white/40">
              Finished
            </div>
            <div className="text-3xl font-bold uppercase tracking-tight text-emerald-300">
              P{place} · {(hud.time ?? 0).toFixed(2)}s
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes go {
          0% {
            transform: scale(0.5) skewX(-8deg);
            opacity: 0;
          }
          25% {
            transform: scale(1.1) skewX(-8deg);
            opacity: 1;
          }
          100% {
            transform: scale(1.8) skewX(-8deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
