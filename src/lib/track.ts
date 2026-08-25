// Shared, deterministic track definitions used by both rendering and simulation.

export type Segment = { len: number; curve: number; slope: number };

export type PickupOp = "+" | "-" | "x" | "÷";

export type Feature = {
  s: number; // distance along track
  lane: number; // -1..1
  half: number; // half width in lane units
  type: "pickup" | "ramp" | "bump";
  op?: PickupOp; // arithmetic operator for pickups
  value: number; // magnitude used both for gameplay effect and HUD label (+5 / -3 / x2 / ÷2)
};

export type TrackDef = {
  id: string;
  name: string;
  subtitle: string;
  seed: number;
  width: number;
  segments: Segment[];
  sky: [string, string];
  fog: string;
  grass: [string, string];
  wall: string;
};

export const TRACKS: TrackDef[] = [
  {
    id: "emerald-canopy",
    name: "Emerald Speedway",
    subtitle: "Wide 4-lane circuit • Big arithmetic boosts",
    seed: 1337,
    width: 28,
    segments: [
      { len: 90, curve: 0, slope: 0 },
      { len: 120, curve: 0.012, slope: 0.05 },
      { len: 90, curve: -0.016, slope: -0.04 },
      { len: 130, curve: 0.008, slope: 0.02 },
      { len: 110, curve: -0.02, slope: 0.06 },
      { len: 140, curve: 0.014, slope: -0.07 },
      { len: 120, curve: 0, slope: 0.03 },
      { len: 150, curve: -0.01, slope: -0.02 },
      { len: 100, curve: 0.018, slope: 0.0 },
      { len: 120, curve: 0, slope: 0 },
    ],
    sky: ["#8fe3ff", "#d9fbe6"],
    fog: "#bfeede",
    grass: ["#4fd14f", "#2fa838"],
    wall: "#8a4a2a",
  },
  {
    id: "vine-spiral",
    name: "Apex Raceway",
    subtitle: "High-speed turns • Division traps",
    seed: 90210,
    width: 30,
    segments: [
      { len: 80, curve: 0, slope: 0 },
      { len: 100, curve: 0.026, slope: 0.08 },
      { len: 80, curve: 0.03, slope: -0.09 },
      { len: 120, curve: -0.028, slope: 0.05 },
      { len: 90, curve: -0.032, slope: -0.06 },
      { len: 130, curve: 0.02, slope: 0.1 },
      { len: 100, curve: -0.024, slope: -0.12 },
      { len: 110, curve: 0.03, slope: 0.04 },
      { len: 140, curve: -0.014, slope: 0 },
      { len: 100, curve: 0, slope: 0 },
    ],
    sky: ["#7fd8ff", "#eaffd0"],
    fog: "#a9e6c8",
    grass: ["#57d95c", "#279c46"],
    wall: "#7a3f24",
  },
  {
    id: "thunder-falls",
    name: "Thunder GP",
    subtitle: "Mega ramp jump • Speed multipliers",
    seed: 4242,
    width: 30,
    segments: [
      { len: 100, curve: 0, slope: 0.02 },
      { len: 140, curve: -0.01, slope: 0.12 },
      { len: 120, curve: 0.022, slope: -0.14 },
      { len: 100, curve: -0.026, slope: 0.03 },
      { len: 150, curve: 0.012, slope: 0.09 },
      { len: 120, curve: -0.018, slope: -0.11 },
      { len: 140, curve: 0.024, slope: 0.02 },
      { len: 120, curve: 0, slope: -0.03 },
      { len: 160, curve: -0.012, slope: 0.05 },
      { len: 110, curve: 0, slope: 0 },
    ],
    sky: ["#9ce8ff", "#fff2c9"],
    fog: "#c8e8cf",
    grass: ["#63e06a", "#31ab3c"],
    wall: "#95502c",
  },
  {
    id: "sunset-lagoon",
    name: "Sunset Circuit",
    subtitle: "Sweeping straights • Sprint finish",
    seed: 777,
    width: 28,
    segments: [
      { len: 110, curve: 0, slope: 0 },
      { len: 130, curve: 0.018, slope: -0.05 },
      { len: 110, curve: -0.022, slope: 0.07 },
      { len: 140, curve: 0.01, slope: 0.03 },
      { len: 120, curve: -0.016, slope: -0.08 },
      { len: 150, curve: 0.02, slope: 0.06 },
      { len: 110, curve: -0.012, slope: -0.02 },
      { len: 130, curve: 0.016, slope: 0.04 },
      { len: 120, curve: 0, slope: 0 },
    ],
    sky: ["#ffc98f", "#ffe9c1"],
    fog: "#f2d9b0",
    grass: ["#5ad86a", "#2f9f42"],
    wall: "#8f4b2f",
  },
];

export function getTrack(id: string): TrackDef {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0];
}

export function trackLength(t: TrackDef) {
  return t.segments.reduce((a, s) => a + s.len, 0);
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Sample = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
};

export type TrackPath = {
  def: TrackDef;
  length: number;
  step: number;
  points: Sample[];
  features: Feature[];
  sample(s: number): Sample;
  sideVector(yaw: number): { x: number; z: number };
  worldAt(s: number, lane: number): { x: number; y: number; z: number; yaw: number };
};

const cache = new Map<string, TrackPath>();

export function buildPath(def: TrackDef): TrackPath {
  const cached = cache.get(def.id);
  if (cached) return cached;

  const step = 2;
  const total = trackLength(def);
  const points: Sample[] = [];
  let x = 0;
  let y = 0;
  let z = 0;
  let yaw = 0;

  let segIdx = 0;
  let segLeft = def.segments[0].len;
  for (let s = 0; s <= total + step; s += step) {
    const seg = def.segments[Math.min(segIdx, def.segments.length - 1)];
    const pitch = Math.atan(seg.slope);
    points.push({ x, y, z, yaw, pitch });
    // advance
    yaw += seg.curve * step;
    x += Math.sin(yaw) * step;
    z += Math.cos(yaw) * step;
    y += seg.slope * step;
    segLeft -= step;
    if (segLeft <= 0 && segIdx < def.segments.length - 1) {
      segIdx++;
      segLeft = def.segments[segIdx].len;
    }
  }

  // deterministic arithmetic features (+, -, x, ÷)
  const rnd = mulberry32(def.seed);
  const features: Feature[] = [];

  // Spread features across the wide 4-lane road:
  // Lanes can be roughly -0.75, -0.25, 0.25, 0.75
  const lanes = [-0.72, -0.24, 0.24, 0.72];

  for (let s = 70; s < total - 80; s += 24 + rnd() * 20) {
    const pickLane = lanes[Math.floor(rnd() * lanes.length)];
    const roll = rnd();

    if (pickLane === undefined) continue;

    if (roll < 0.32) {
      // "+N" speed addition pickup (Green)
      features.push({
        s: Math.round(s),
        lane: pickLane,
        half: 0.22,
        type: "pickup",
        op: "+",
        value: 2 + Math.floor(rnd() * 6), // +2 to +7
      });
    } else if (roll < 0.52) {
      // "-N" speed subtraction pickup (Orange/Red)
      features.push({
        s: Math.round(s),
        lane: pickLane,
        half: 0.22,
        type: "pickup",
        op: "-",
        value: 2 + Math.floor(rnd() * 5), // -2 to -6
      });
    } else if (roll < 0.68) {
      // "÷N" speed division trap (Pink/Crimson) - cuts speed!
      features.push({
        s: Math.round(s),
        lane: pickLane,
        half: 0.22,
        type: "pickup",
        op: "÷",
        value: 2 + Math.floor(rnd() * 2), // ÷2 or ÷3
      });
    } else if (roll < 0.82) {
      // "xN" speed multiplier pickup (Gold/Yellow) - super boost!
      features.push({
        s: Math.round(s),
        lane: pickLane,
        half: 0.22,
        type: "pickup",
        op: "x",
        value: 2 + Math.floor(rnd() * 2), // x2 or x3
      });
    } else if (roll < 0.92) {
      // Ramp jump
      features.push({ s: Math.round(s), lane: pickLane, half: 0.2, type: "ramp", value: 2 });
    } else {
      // Bumpy hazard
      features.push({ s: Math.round(s), lane: pickLane, half: 0.2, type: "bump", value: -1 });
    }

    // Often place a contrasting gate on an adjacent lane (e.g. +5 vs ÷2 risk/reward choice!)
    if (rnd() > 0.35) {
      const otherLane = lanes.find((l) => Math.abs(l - pickLane) > 0.3 && Math.abs(l - pickLane) < 0.8) ?? -pickLane;
      const goodChoice = roll >= 0.32; // if main was bad, give a good choice, and vice versa
      features.push({
        s: Math.round(s),
        lane: otherLane,
        half: 0.22,
        type: "pickup",
        op: goodChoice ? "+" : "x",
        value: goodChoice ? 3 + Math.floor(rnd() * 5) : 2,
      });
    }
  }

  const path: TrackPath = {
    def,
    length: total,
    step,
    points,
    features,
    sample(s: number) {
      const clamped = Math.max(0, Math.min(total, s));
      const f = clamped / step;
      const i = Math.min(points.length - 2, Math.floor(f));
      const t = f - i;
      const a = points[i];
      const b = points[i + 1];
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
        yaw: a.yaw + (b.yaw - a.yaw) * t,
        pitch: a.pitch + (b.pitch - a.pitch) * t,
      };
    },
    sideVector(yaw: number) {
      return { x: Math.cos(yaw), z: -Math.sin(yaw) };
    },
    worldAt(s: number, lane: number) {
      const p = path.sample(s);
      const side = path.sideVector(p.yaw);
      const off = lane * (def.width / 2 - 1.5);
      return { x: p.x + side.x * off, y: p.y, z: p.z + side.z * off, yaw: p.yaw };
    },
  };
  cache.set(def.id, path);
  return path;
}

export const CHAR_COLORS = [
  "#e63946", // Racing Red
  "#00f0ff", // Electric Cyan
  "#ffd166", // Cyber Yellow
  "#35e08a", // Emerald Green
  "#ff70a6", // Neon Pink
  "#7052ff", // Deep Purple
  "#ff9f1c", // Blaze Orange
  "#ffffff", // Alpine White
];

export const HATS = ["none", "cap", "leaf", "crown", "goggles"] as const;
export type Hat = (typeof HATS)[number];

export const BOT_NAMES = [
  "Apex",
  "Nitro",
  "Viper",
  "Blaze",
  "Storm",
  "Phantom",
  "Shadow",
  "Bolt",
  "Turbo",
  "RacerX",
];
