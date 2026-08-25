"use client";

import React from "react";
import { audio } from "@/game/audio";

type Accent = "primary" | "ghost" | "amber" | "danger";

const ACCENTS: Record<Accent, { text: string; border: string; glow: string; bg: string }> = {
  primary: {
    text: "#35e08a",
    border: "rgba(53,224,138,.45)",
    glow: "0 0 26px rgba(53,224,138,.18)",
    bg: "linear-gradient(100deg, rgba(53,224,138,.16), rgba(53,224,138,.04))",
  },
  amber: {
    text: "#ffc93d",
    border: "rgba(255,201,61,.4)",
    glow: "0 0 26px rgba(255,201,61,.15)",
    bg: "linear-gradient(100deg, rgba(255,201,61,.14), rgba(255,201,61,.03))",
  },
  danger: {
    text: "#ff6b7a",
    border: "rgba(255,107,122,.4)",
    glow: "0 0 26px rgba(255,107,122,.14)",
    bg: "linear-gradient(100deg, rgba(255,107,122,.13), rgba(255,107,122,.03))",
  },
  ghost: {
    text: "rgba(230,240,235,.82)",
    border: "rgba(255,255,255,.12)",
    glow: "none",
    bg: "linear-gradient(100deg, rgba(255,255,255,.06), rgba(255,255,255,.015))",
  },
};

/** Primary navigation row — angled telemetry plate with index + chevron. */
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
      onMouseEnter={() => !disabled && audio.uiHover()}
      onClick={() => {
        if (disabled) return;
        audio.uiClick();
        onClick?.();
      }}
      className="group relative w-full overflow-hidden border text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 clip-plate"
      style={{ borderColor: a.border, background: a.bg, boxShadow: a.glow }}
    >
      <span
        className="absolute inset-y-0 left-0 w-[3px] transition-all duration-200 group-hover:w-[5px]"
        style={{ background: a.text, boxShadow: `0 0 12px ${a.text}` }}
      />
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/8 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      <span className="relative flex items-center gap-3 py-3 pl-5 pr-4">
        <span className="font-mono text-[10px] font-medium tracking-widest text-white/25">
          {index}
        </span>
        <span className="flex-1">
          <span
            className="block text-xl font-semibold uppercase leading-none tracking-wide transition-colors"
            style={{ color: a.text }}
          >
            {label}
          </span>
          {sub && (
            <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
              {sub}
            </span>
          )}
        </span>
        {badge && (
          <span className="rounded-sm border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-white/50">
            {badge}
          </span>
        )}
        <span
          className="text-sm transition-transform duration-200 group-hover:translate-x-1"
          style={{ color: a.text, opacity: 0.6 }}
        >
          ›
        </span>
      </span>
    </button>
  );
}

/** Compact action button. */
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
      onMouseEnter={() => !disabled && audio.uiHover()}
      onClick={() => {
        if (disabled) return;
        audio.uiClick();
        onClick?.();
      }}
      className={`clip-plate border font-semibold uppercase tracking-[0.16em] transition-all duration-150 active:translate-y-px disabled:opacity-40 ${
        full ? "w-full" : ""
      } ${small ? "px-3 py-1.5 text-[10px]" : "px-5 py-2.5 text-xs"}`}
      style={{ borderColor: a.border, background: a.bg, color: a.text, boxShadow: a.glow }}
    >
      {children}
    </button>
  );
}

/** Framed content surface with a technical header. */
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
      className={`relative w-full animate-[fadeUp_.35s_ease-out] border border-white/10 bg-[#060d0a]/85 backdrop-blur-2xl ${
        wide ? "max-w-2xl" : "max-w-md"
      }`}
      style={{ boxShadow: "0 30px 80px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.05)" }}
    >
      {/* corner ticks */}
      {[
        "left-0 top-0 border-l border-t",
        "right-0 top-0 border-r border-t",
        "left-0 bottom-0 border-l border-b",
        "right-0 bottom-0 border-r border-b",
      ].map((c) => (
        <span key={c} className={`pointer-events-none absolute h-3 w-3 border-emerald-400/50 ${c}`} />
      ))}

      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
        <div>
          {eyebrow && (
            <div className="font-mono text-[9px] font-medium uppercase tracking-[0.35em] text-emerald-400/50">
              {eyebrow}
            </div>
          )}
          <h2 className="text-lg font-semibold uppercase leading-tight tracking-[0.1em] text-white/90">
            {title}
          </h2>
        </div>
        {onBack && (
          <button
            onMouseEnter={() => audio.uiHover()}
            onClick={() => {
              audio.uiBack();
              onBack();
            }}
            className="border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50 transition hover:border-white/25 hover:text-white/90"
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
      <div className="mb-2 font-mono text-[9px] font-medium uppercase tracking-[0.3em] text-white/30">
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
      className={`w-full border border-white/12 bg-black/40 px-3 py-2.5 text-sm font-medium tracking-wide text-white outline-none transition placeholder:text-white/20 focus:border-emerald-400/50 focus:bg-black/60 ${
        props.className ?? ""
      }`}
    />
  );
}

/** Toggle used for audio settings. */
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
        audio.uiClick();
        onChange(!on);
      }}
      className="flex w-full items-center justify-between border border-white/10 bg-white/[0.03] px-3 py-2.5 transition hover:border-white/20"
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
        {label}
      </span>
      <span
        className="relative h-4 w-9 rounded-full transition-colors"
        style={{ background: on ? "rgba(53,224,138,.35)" : "rgba(255,255,255,.1)" }}
      >
        <span
          className="absolute top-0.5 h-3 w-3 rounded-full transition-all"
          style={{
            left: on ? "1.35rem" : "0.125rem",
            background: on ? "#35e08a" : "rgba(255,255,255,.45)",
            boxShadow: on ? "0 0 10px rgba(53,224,138,.7)" : "none",
          }}
        />
      </span>
    </button>
  );
}
