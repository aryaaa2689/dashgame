"use client";

import React from "react";
import { audio } from "@/game/audio";

type Accent = "primary" | "ghost" | "amber" | "danger";

const ACCENTS: Record<Accent, { text: string; border: string; glow: string; bg: string }> = {
  primary: {
    text: "#00f0ff",
    border: "rgba(0,240,255,.45)",
    glow: "0 0 26px rgba(0,240,255,.2)",
    bg: "linear-gradient(100deg, rgba(0,240,255,.18), rgba(0,240,255,.04))",
  },
  amber: {
    text: "#ffd700",
    border: "rgba(255,215,0,.45)",
    glow: "0 0 26px rgba(255,215,0,.18)",
    bg: "linear-gradient(100deg, rgba(255,215,0,.16), rgba(255,215,0,.03))",
  },
  danger: {
    text: "#ff3366",
    border: "rgba(255,51,102,.45)",
    glow: "0 0 26px rgba(255,51,102,.18)",
    bg: "linear-gradient(100deg, rgba(255,51,102,.15), rgba(255,51,102,.03))",
  },
  ghost: {
    text: "rgba(235,245,255,.88)",
    border: "rgba(255,255,255,.14)",
    glow: "none",
    bg: "linear-gradient(100deg, rgba(255,255,255,.07), rgba(255,255,255,.02))",
  },
};

function safeAudio(fn: () => void) {
  try {
    fn();
  } catch {}
}

/** Primary navigation row — angled car telemetry button plate. */
export function MenuRow({
  index,
  label,
  sub,
  accent = "ghost",
  onClick,
  disabled,
  badge,
}: {
  index: string;
  label: string;
  sub?: string;
  accent?: Accent;
  onClick?: () => void;
  disabled?: boolean;
  badge?: string;
}) {
  const a = ACCENTS[accent];
  return (
    <button
      disabled={disabled}
      onMouseEnter={() => !disabled && safeAudio(() => audio.uiHover())}
      onClick={() => {
        if (disabled) return;
        safeAudio(() => audio.uiClick());
        onClick?.();
      }}
      className="group relative w-full overflow-hidden border text-left transition-all duration-200 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40 clip-plate touch-manipulation min-h-[54px]"
      style={{ borderColor: a.border, background: a.bg, boxShadow: a.glow }}
    >
      <span
        className="absolute inset-y-0 left-0 w-[4px] transition-all duration-200 group-hover:w-[6px]"
        style={{ background: a.text, boxShadow: `0 0 12px ${a.text}` }}
      />
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      <span className="relative flex items-center gap-3 py-3 pl-5 pr-4">
        <span className="font-mono text-xs font-bold tracking-widest text-cyan-400/40">
          {index}
        </span>
        <span className="flex-1">
          <span
            className="block text-xl font-black uppercase leading-none tracking-wide transition-colors"
            style={{ color: a.text }}
          >
            {label}
          </span>
          {sub && (
            <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
              {sub}
            </span>
          )}
        </span>
        {badge && (
          <span className="rounded-sm border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-cyan-300">
            {badge}
          </span>
        )}
        <span
          className="text-base font-black transition-transform duration-200 group-hover:translate-x-1"
          style={{ color: a.text, opacity: 0.8 }}
        >
          ›
        </span>
      </span>
    </button>
  );
}

/** Action button. */
export function ActionButton({
  children,
  onClick,
  accent = "primary",
  full,
  small,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  accent?: Accent;
  full?: boolean;
  small?: boolean;
  disabled?: boolean;
}) {
  const a = ACCENTS[accent];
  return (
    <button
      disabled={disabled}
      onMouseEnter={() => !disabled && safeAudio(() => audio.uiHover())}
      onClick={() => {
        if (disabled) return;
        safeAudio(() => audio.uiClick());
        onClick?.();
      }}
      className={`clip-plate border font-black uppercase tracking-[0.18em] transition-all duration-150 active:translate-y-px disabled:opacity-40 touch-manipulation ${
        full ? "w-full" : ""
      } ${small ? "px-3.5 py-2 text-xs" : "px-6 py-3 text-sm"}`}
      style={{ borderColor: a.border, background: a.bg, color: a.text, boxShadow: a.glow }}
    >
      {children}
    </button>
  );
}

/** Framed content surface. */
export function Panel({
  children,
  title,
  eyebrow,
  onBack,
  wide,
}: {
  children: React.ReactNode;
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className={`relative w-full animate-[fadeUp_.35s_ease-out] border border-white/15 bg-[#060c14]/90 backdrop-blur-2xl rounded-xl ${
        wide ? "max-w-2xl" : "max-w-md"
      }`}
      style={{ boxShadow: "0 30px 80px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.08)" }}
    >
      {/* Corner ticks */}
      {[
        "left-0 top-0 border-l-2 border-t-2",
        "right-0 top-0 border-r-2 border-t-2",
        "left-0 bottom-0 border-l-2 border-b-2",
        "right-0 bottom-0 border-r-2 border-b-2",
      ].map((c) => (
        <span key={c} className={`pointer-events-none absolute h-3.5 w-3.5 border-cyan-400/60 ${c}`} />
      ))}

      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          {eyebrow && (
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-400">
              {eyebrow}
            </div>
          )}
          <h2 className="text-xl font-black uppercase leading-tight tracking-[0.1em] text-white">
            {title}
          </h2>
        </div>
        {onBack && (
          <button
            onMouseEnter={() => safeAudio(() => audio.uiHover())}
            onClick={() => {
              safeAudio(() => audio.uiBack());
              onBack();
            }}
            className="border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-white/70 transition hover:border-white/30 hover:text-white touch-manipulation"
          >
            ← Back
          </button>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-400/70">
        {label}
      </div>
      {children}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border border-white/15 bg-black/50 px-3.5 py-3 text-sm font-bold tracking-wide text-white outline-none transition placeholder:text-white/20 focus:border-cyan-400 focus:bg-black/70 rounded-lg touch-manipulation ${
        props.className ?? ""
      }`}
    />
  );
}

export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      onClick={() => {
        safeAudio(() => audio.uiClick());
        onChange(!on);
      }}
      className="flex w-full items-center justify-between border border-white/12 bg-white/[0.04] px-3.5 py-3 transition hover:border-white/25 rounded-lg touch-manipulation min-h-[48px]"
    >
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
        {label}
      </span>
      <span
        className="relative h-5 w-10 rounded-full transition-colors"
        style={{ background: on ? "rgba(0,240,255,.4)" : "rgba(255,255,255,.12)" }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full transition-all"
          style={{
            left: on ? "1.35rem" : "0.125rem",
            background: on ? "#00f0ff" : "rgba(255,255,255,.5)",
            boxShadow: on ? "0 0 10px rgba(0,240,255,.8)" : "none",
          }}
        />
      </span>
    </button>
  );
}
