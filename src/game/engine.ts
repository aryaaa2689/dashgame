import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { buildPath, getTrack, TrackPath, Feature, PickupOp } from "@/lib/track";
import { makeCar, animateCar, CarParts } from "@/game/cars";
import { buildWorld } from "@/game/world";
import { audio } from "@/game/audio";

export type RacerConfig = {
  id: string;
  name: string;
  color: string;
  hat: string;
  isPlayer?: boolean;
  isBot?: boolean;
  isRemote?: boolean;
  skill?: number;
};

export type HudState = {
  place: number;
  total: number;
  progress: number;
  countdown: number | null;
  speed: number;
  boostCharge: number;
  time: number;
  score: number;
  finished: boolean;
  racers: { id: string; name: string; color: string; progress: number; isPlayer: boolean }[];
};

export type RaceResult = {
  id: string;
  name: string;
  color: string;
  place: number;
  timeMs: number;
  isPlayer: boolean;
};

type Racer = {
  cfg: RacerConfig;
  parts: CarParts;
  dist: number;
  lane: number;
  laneVel: number;
  speed: number;
  boost: number; // nitro ability charge (0..~1.6), decays
  speedMod: number; // additive speed offset from +/- pickups, decays to 0
  speedMult: number; // multiplicative burst from x pickups, decays to 1
  stun: number;
  air: number;
  airVel: number;
  stumble: number;
  finished: boolean;
  finishTime: number;
  nextFeature: number;
  targetLane: number;
  label?: THREE.Sprite;
  arrow?: THREE.Mesh;
  netDist?: number;
  netLane?: number;
};

const BASE_SPEED = 48;

/** Arcade racer floating nameplate / licence plate. */
function namePlate(text: string, accent: string, isPlayer: boolean) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 160;
  const g = c.getContext("2d")!;
  const label = text.toUpperCase();
  const fontSize = isPlayer ? 68 : 52;

  g.font = `900 italic ${fontSize}px "Arial Black", "Barlow Condensed", Arial, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = "rgba(0,0,0,0.5)";
  g.shadowBlur = 12;
  g.shadowOffsetY = 6;
  g.lineJoin = "round";
  g.lineWidth = isPlayer ? 14 : 10;
  g.strokeStyle = "#11141a";
  g.strokeText(label, 256, 78);
  g.lineWidth = isPlayer ? 5 : 4;
  g.strokeStyle = isPlayer ? "#00f0ff" : accent;
  g.strokeText(label, 256, 78);
  g.shadowColor = "transparent";
  g.fillStyle = "#ffffff";
  g.fillText(label, 256, 78);

  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, opacity: isPlayer ? 1 : 0.88 }),
  );
  sp.scale.set(isPlayer ? 2.6 : 2.1, isPlayer ? 0.8 : 0.65, 1);
  return sp;
}

/** Crisp numeric callout used for +N / -N / xN / ÷N feedback. */
function textSprite(text: string, color: string, outline = "#050807", size = 128) {
  const c = document.createElement("canvas");
  c.width = 380;
  c.height = 160;
  const g = c.getContext("2d")!;
  g.font = `900 ${size * 0.72}px "Barlow Condensed", "Arial Narrow", Arial, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = "rgba(0,0,0,0.7)";
  g.shadowBlur = 16;
  g.shadowOffsetY = 4;
  g.lineWidth = 10;
  g.strokeStyle = outline;
  g.strokeText(text, 190, 84);
  g.shadowColor = "transparent";
  g.fillStyle = color;
  g.fillText(text, 190, 84);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }),
  );
  sp.scale.set(3.4, 1.7, 1);
  return sp;
}

function pickupLabel(op: PickupOp, value: number) {
  return op === "x" ? `×${value} NITRO!` : op === "÷" ? `÷${value} SLOW!` : op === "+" ? `+${value} SPEED!` : `-${value} SLOW!`;
}

function pickupColor(op: PickupOp) {
  return op === "+" ? "#00ff88" : op === "x" ? "#ffd700" : op === "-" ? "#ff7700" : "#ff0055";
}

export class RaceEngine {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  path: TrackPath;
  racers: Racer[] = [];
  player!: Racer;
  clock = new THREE.Clock();
  raf = 0;
  time = 0;
  startAtMs: number | null = null;
  running = true;
  score = 0;
  boostCharge = 1;
  floaters: { sp: THREE.Sprite; life: number }[] = [];
  featureMeshes: THREE.Object3D[] = [];
  input = { left: 0, right: 0, jump: false, boost: false };
  onHud: (h: HudState) => void;
  onFinish: (r: RaceResult[]) => void;
  finishedEmitted = false;
  netPush?: (s: { dist: number; lane: number; hop: number; speed: number; finishTime?: number }) => void;
  remote = new Map<string, { dist: number; lane: number; hop: number; speed: number }>();
  camPos = new THREE.Vector3();
  shake = 0;
  sun: THREE.DirectionalLight;
  lastWallSfx = -1;
  private stepPhase = 0;
  private lastCountdown = -1;
  private lastPlace = -1;
  private speedLineMaterial!: THREE.LineBasicMaterial;
  private speedLines: { line: THREE.Line; lane: number; phase: number; len: number; y: number }[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    trackId: string,
    configs: RacerConfig[],
    onHud: (h: HudState) => void,
    onFinish: (r: RaceResult[]) => void,
  ) {
    this.onHud = onHud;
    this.onFinish = onFinish;
    const def = getTrack(trackId);
    this.path = buildPath(def);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(58, canvas.clientWidth / canvas.clientHeight, 0.5, 1500);
    this.scene.fog = new THREE.Fog(new THREE.Color(def.fog), 110, 480);
    this.speedLineMaterial = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const hemi = new THREE.HemisphereLight(0xdcefff, 0x223322, 0.85);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d4, 2.2);
    sun.position.set(35, 60, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 160;
    sun.shadow.bias = -0.0018;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    const fill = new THREE.DirectionalLight(0xbfe3ff, 0.4);
    fill.position.set(-25, 20, -15);
    this.scene.add(fill);

    const w = buildWorld(this.scene, this.path);
    this.featureMeshes = w.featureMeshes;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
      0.28,
      0.7,
      0.9,
    );
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());

    // Arrange racers in a neat Staggered 2-by-2 Starting Grid so cars are NOT congested!
    configs.forEach((cfg, i) => {
      const parts = makeCar(cfg.color, cfg.hat);
      this.scene.add(parts.root);

      const row = Math.floor(i / 2);
      const col = i % 2;
      const lane = col === 0 ? -0.42 : 0.42;
      const startDist = -row * 8; // Row 0 is at 0, Row 1 at -8, Row 2 at -16, Row 3 at -24

      const r: Racer = {
        cfg,
        parts,
        dist: startDist,
        lane,
        laneVel: 0,
        speed: 0,
        boost: 0,
        speedMod: 0,
        speedMult: 1,
        stun: 0,
        air: 0,
        airVel: 0,
        stumble: 0,
        finished: false,
        finishTime: 0,
        nextFeature: 0,
        targetLane: lane,
      };

      if (cfg.isPlayer) {
        this.player = r;
        const label = namePlate("YOU", cfg.color, true);
        this.scene.add(label);
        r.label = label;
        const arrow = new THREE.Mesh(
          new THREE.ConeGeometry(0.3, 0.5, 4),
          new THREE.MeshBasicMaterial({ color: 0x00f0ff, depthTest: false, transparent: true, opacity: 0.95 }),
        );
        arrow.rotation.x = Math.PI;
        arrow.renderOrder = 10;
        this.scene.add(arrow);
        r.arrow = arrow;
      } else {
        const label = namePlate(cfg.name.slice(0, 9), cfg.color, false);
        this.scene.add(label);
        r.label = label;
      }
      this.racers.push(r);
    });

    for (let i = 0; i < 42; i++) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
      const line = new THREE.Line(geom, this.speedLineMaterial);
      line.frustumCulled = false;
      line.renderOrder = 2;
      this.scene.add(line);
      const side = i % 2 === 0 ? -1 : 1;
      this.speedLines.push({
        line,
        lane: side * (1.1 + Math.random() * 0.8),
        phase: Math.random() * 60,
        len: 8 + Math.random() * 14,
        y: 0.8 + Math.random() * 1.8,
      });
    }

    try {
      audio.resume();
      audio.startEngine();
    } catch {}
    this.bindInput(canvas);
    this.loop();
  }

  setStartAt(ms: number | null) {
    this.startAtMs = ms;
  }

  private keyHandler = (e: KeyboardEvent, down: boolean) => {
    const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a") this.input.left = down ? 1 : 0;
    if (k === "arrowright" || k === "d") this.input.right = down ? 1 : 0;
    if (k === " " || k === "arrowup" || k === "w") {
      this.input.jump = down;
      if (down) e.preventDefault();
    }
    if (k === "shift" || k === "arrowdown" || k === "s") this.input.boost = down;
  };
  private kd = (e: KeyboardEvent) => this.keyHandler(e, true);
  private ku = (e: KeyboardEvent) => this.keyHandler(e, false);

  bindInput(canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.kd);
    window.addEventListener("keyup", this.ku);
    let touchId: number | null = null;
    let startX = 0;
    const pd = (e: PointerEvent) => {
      if (touchId === null) {
        touchId = e.pointerId;
        startX = e.clientX;
      }
    };
    const pm = (e: PointerEvent) => {
      if (e.pointerId !== touchId) return;
      const dx = (e.clientX - startX) / (window.innerWidth * 0.22);
      this.input.left = dx < -0.08 ? Math.min(1, -dx) : 0;
      this.input.right = dx > 0.08 ? Math.min(1, dx) : 0;
    };
    const pu = (e: PointerEvent) => {
      if (e.pointerId !== touchId) return;
      touchId = null;
      this.input.left = this.input.right = 0;
    };
    canvas.addEventListener("pointerdown", pd);
    canvas.addEventListener("pointermove", pm);
    canvas.addEventListener("pointerup", pu);
    canvas.addEventListener("pointercancel", pu);
    this.unbind = () => {
      window.removeEventListener("keydown", this.kd);
      window.removeEventListener("keyup", this.ku);
      canvas.removeEventListener("pointerdown", pd);
      canvas.removeEventListener("pointermove", pm);
      canvas.removeEventListener("pointerup", pu);
      canvas.removeEventListener("pointercancel", pu);
    };
  }
  unbind: () => void = () => {};

  touch(dir: -1 | 0 | 1) {
    this.input.left = dir === -1 ? 1 : 0;
    this.input.right = dir === 1 ? 1 : 0;
  }
  doJump() {
    this.input.jump = true;
    setTimeout(() => (this.input.jump = false), 120);
  }
  doBoost() {
    if (this.boostCharge >= 0.95 && !this.player.finished) {
      this.boostCharge = 0;
      this.player.boost = Math.max(this.player.boost, 1.8);
      this.spawnFloater(this.player, "NITRO BOOST!", "#00ffff");
      this.shake = 0.6;
      try {
        audio.turbo();
      } catch {}
    } else {
      try {
        audio.uiError();
      } catch {}
    }
  }

  spawnFloater(r: Racer, text: string, color: string) {
    const sp = textSprite(text, color, "#111822", 130);
    const w = this.path.worldAt(r.dist, r.lane);
    sp.position.set(w.x, w.y + 3.2, w.z);
    sp.scale.set(3.6, 1.8, 1);
    this.scene.add(sp);
    this.floaters.push({ sp, life: 1 });
  }

  // Arithmetic operator pickups directly affect car speed (+, -, x, ÷)
  applyFeature(r: Racer, f: Feature) {
    const isPlayer = r.cfg.isPlayer;
    if (f.type === "pickup") {
      const op = f.op ?? "+";
      if (op === "+") {
        r.speedMod = Math.min(32, r.speedMod + f.value * 2.8);
        if (isPlayer) {
          this.spawnFloater(r, pickupLabel(op, f.value), pickupColor(op));
          this.boostCharge = Math.min(1, this.boostCharge + f.value * 0.08);
          this.score += f.value * 10;
          try {
            audio.pickupPlus(f.value);
          } catch {}
        }
      } else if (op === "-") {
        if (r.air > 0.35) return;
        r.speedMod = Math.max(-28, r.speedMod - f.value * 2.8);
        r.stumble = 1;
        r.stun = 0.3;
        if (isPlayer) {
          this.spawnFloater(r, pickupLabel(op, f.value), pickupColor(op));
          this.shake = 0.6;
          this.score = Math.max(0, this.score - f.value * 5);
          try {
            audio.pickupMinus(f.value);
          } catch {}
        }
      } else if (op === "÷") {
        if (r.air > 0.35) return;
        // Division cuts current speed in half/third!
        r.speedMult = Math.max(0.4, 1 / f.value);
        r.stumble = 1.2;
        r.stun = 0.4;
        if (isPlayer) {
          this.spawnFloater(r, pickupLabel(op, f.value), pickupColor(op));
          this.shake = 0.7;
          try {
            audio.pickupMinus(f.value);
          } catch {}
        }
      } else {
        // "x" Multiplication
        r.speedMult = Math.max(r.speedMult, f.value * 1.1);
        if (isPlayer) {
          this.spawnFloater(r, pickupLabel(op, f.value), pickupColor(op));
          this.boostCharge = Math.min(1, this.boostCharge + 0.4);
          this.shake = 0.6;
          this.score += f.value * 25;
          try {
            audio.pickupMult(f.value);
          } catch {}
        }
      }
    } else if (f.type === "ramp") {
      r.airVel = 12;
      if (isPlayer) {
        this.spawnFloater(r, "AIR JUMP!", "#00e1ff");
        try {
          audio.ramp();
        } catch {}
      }
    } else if (f.type === "bump") {
      if (r.air > 0.2) return;
      r.airVel = 6;
      r.speedMod = Math.max(-28, r.speedMod - 2.5);
      if (isPlayer) {
        this.spawnFloater(r, "HAZARD!", "#ff7700");
        try {
          audio.hit();
        } catch {}
      }
    }
  }

  stepRacer(r: Racer, dt: number, racing: boolean) {
    if (r.cfg.isRemote) {
      const n = this.remote.get(r.cfg.id);
      if (n) {
        r.netDist = n.dist;
        r.netLane = n.lane;
        r.speed = n.speed;
        r.air = n.hop;
      }
      const targetD = (r.netDist ?? r.dist) + (r.speed || 0) * 0.12;
      r.dist += (targetD - r.dist) * Math.min(1, dt * 6);
      r.lane += ((r.netLane ?? r.lane) - r.lane) * Math.min(1, dt * 8);
      if (!r.finished && r.dist >= this.path.length) {
        r.finished = true;
        r.finishTime = this.time;
      }
      return;
    }

    if (r.finished) {
      r.speed *= 1 - dt * 1.4;
      r.dist += r.speed * dt;
      return;
    }

    if (!racing) {
      r.speed *= 1 - dt * 3;
      return;
    }

    // ---- Car steering
    if (r.cfg.isPlayer) {
      const steer = (this.input.right - this.input.left) * 3.8;
      r.laneVel += (steer - r.laneVel) * Math.min(1, dt * 10);
      if (this.input.jump && r.air <= 0.01) {
        r.airVel = 9.0;
        this.input.jump = false;
        try {
          audio.jump();
        } catch {}
      }
    } else {
      // Bot AI steering: pick advantageous arithmetic gates (+, x), avoid bad gates (-, ÷)
      const skill = r.cfg.skill ?? 0.7;
      const look = this.path.features.filter((f) => f.s > r.dist + 4 && f.s < r.dist + 45);
      let want = r.targetLane;
      const good = look.find((f) => f.type === "pickup" && f.op !== "-" && f.op !== "÷");
      const bad = look.find(
        (f) =>
          ((f.type === "pickup" && (f.op === "-" || f.op === "÷")) || f.type === "bump") &&
          Math.abs(f.lane - r.lane) < 0.28,
      );
      if (bad && Math.random() < skill) want = Math.max(-0.85, Math.min(0.85, bad.lane + (bad.lane > 0 ? -0.45 : 0.45)));
      else if (good && Math.random() < skill * 0.7) want = good.lane;
      r.targetLane = want;
      r.laneVel += ((want - r.lane) * 3.2 - r.laneVel) * Math.min(1, dt * 6);
      if (
        Math.random() < dt * 1.4 * skill &&
        look.some(
          (f) => f.type === "pickup" && (f.op === "-" || f.op === "÷") && Math.abs(f.lane - r.lane) < 0.3 && f.s - r.dist < 12,
        )
      )
        r.airVel = 9;
    }

    r.lane += r.laneVel * dt;

    // Track wall guardrail collision
    for (const edge of [-1, 1] as const) {
      if ((edge === -1 && r.lane < -1) || (edge === 1 && r.lane > 1)) {
        r.lane = edge;
        r.laneVel = -edge * Math.abs(r.laneVel) * 0.4;
        r.speedMod -= 2;
        r.stumble = Math.max(r.stumble, 0.5);
        if (r.cfg.isPlayer) {
          this.shake = 0.35;
          if (this.time - this.lastWallSfx > 0.35) {
            try {
              audio.wall();
            } catch {}
            this.lastWallSfx = this.time;
          }
        }
      }
    }

    // Car-to-Car Repulsion (prevents 8 cars from stacking into a clump)
    for (const other of this.racers) {
      if (other === r) continue;
      const dDist = Math.abs(r.dist - other.dist);
      const dLane = Math.abs(r.lane - other.lane);
      if (dDist < 3.8 && dLane < 0.32) {
        const pushSide = r.lane >= other.lane ? 1 : -1;
        r.laneVel += pushSide * dt * 4.0;
      }
    }

    // ---- Air Physics
    if (r.airVel !== 0 || r.air > 0) {
      const wasAir = r.air > 0.05;
      r.air += r.airVel * dt;
      r.airVel -= 28 * dt;
      if (r.air <= 0) {
        r.air = 0;
        r.airVel = 0;
        if (wasAir && r.cfg.isPlayer) {
          try {
            audio.land();
          } catch {}
        }
      }
    }

    // ---- Car Speed Calculation
    const slope = this.path.sample(r.dist).pitch;
    const skill = r.cfg.isPlayer ? 1 : 0.9 + (r.cfg.skill ?? 0.7) * 0.16;
    let target = BASE_SPEED * skill * (1 + r.boost * 0.6) - slope * 28 + r.speedMod;
    target *= r.speedMult;
    if (r.stun > 0) {
      target *= 0.4;
      r.stun -= dt;
    }
    r.speed += (target - r.speed) * Math.min(1, dt * 2.8);
    r.speed = Math.max(6, r.speed);
    r.boost = Math.max(0, r.boost - dt * 0.75);
    r.speedMod *= 1 - Math.min(1, dt * 0.6);
    r.speedMult += (1 - r.speedMult) * Math.min(1, dt * 1.5);
    r.stumble = Math.max(0, r.stumble - dt * 2.2);
    r.dist += r.speed * dt;

    // ---- Features / Pickups Check
    while (
      r.nextFeature < this.path.features.length &&
      this.path.features[r.nextFeature].s < r.dist
    ) {
      const f = this.path.features[r.nextFeature];
      if (Math.abs(f.lane - r.lane) < f.half + 0.22) this.applyFeature(r, f);
      r.nextFeature++;
    }

    if (r.dist >= this.path.length) {
      r.finished = true;
      r.finishTime = this.time;
      if (r.cfg.isPlayer) this.emitFinish();
    }
  }

  emitFinish() {
    if (this.finishedEmitted) return;
    this.finishedEmitted = true;
    const livePlace =
      [...this.racers].sort((a, b) => b.dist - a.dist).findIndex((r) => r === this.player) + 1;
    try {
      audio.finish(livePlace <= 3);
    } catch {}
    setTimeout(() => {
      const sorted = [...this.racers].sort(
        (a, b) => (b.finished ? 1e9 - b.finishTime : b.dist) - (a.finished ? 1e9 - a.finishTime : a.dist),
      );
      this.onFinish(
        sorted.map((r, i) => ({
          id: r.cfg.id,
          name: r.cfg.name,
          color: r.cfg.color,
          place: i + 1,
          timeMs: Math.round((r.finished ? r.finishTime : this.time) * 1000),
          isPlayer: !!r.cfg.isPlayer,
        })),
      );
    }, 1400);
  }

  loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.running) return;
    const dt = Math.min(0.05, this.clock.getDelta());

    let countdown: number | null = null;
    let racing = true;
    if (this.startAtMs !== null) {
      const diff = (this.startAtMs - Date.now()) / 1000;
      if (diff > -0.2) {
        racing = diff <= 0;
        countdown = diff > 0 ? Math.ceil(diff) : 0;
      }
    }
    if (racing) this.time += dt;

    // Countdown / start audio cues
    if (countdown !== null && countdown !== this.lastCountdown) {
      try {
        if (countdown > 0) audio.countdownBeep(countdown);
        else audio.goHorn();
      } catch {}
      this.lastCountdown = countdown;
    }

    for (const r of this.racers) this.stepRacer(r, dt, racing);

    // Render placement
    const order = [...this.racers].sort((a, b) => b.dist - a.dist);
    const place = order.findIndex((r) => r === this.player) + 1;

    // Position change audio stingers
    if (this.lastPlace > 0 && place !== this.lastPlace && !this.player.finished) {
      try {
        if (place < this.lastPlace) audio.overtake();
        else audio.overtaken();
      } catch {}
    }
    this.lastPlace = place;

    // Reactive engine audio
    const sp01 = this.player.speed / 65;
    try {
      audio.updateEngine(racing && !this.player.finished ? sp01 : 0, this.player.air > 0.05 ? 1 : 0);
    } catch {}

    // 3D Car Transforms & Animation
    const t = this.time;
    for (const r of this.racers) {
      const w = this.path.worldAt(r.dist, r.lane);
      r.parts.root.position.set(w.x, w.y + r.air, w.z);
      r.parts.root.rotation.y = w.yaw + Math.PI + r.laneVel * 0.1;

      const steerDir = Math.max(-1, Math.min(1, r.laneVel * 0.35));
      const isBoosting = r.boost > 0.2 || r.speedMult > 1.2;

      animateCar(
        r.parts,
        t + r.dist * 0.02,
        Math.min(1.4, r.speed / 50),
        r.air > 0.05 ? 1 : 0,
        r.stumble,
        steerDir,
        isBoosting,
      );

      if (r.label) {
        r.label.position.set(w.x, w.y + r.air + (r.cfg.isPlayer ? 2.4 : 2.1), w.z);
        r.label.material.opacity = r.cfg.isPlayer ? 1 : 0.85;
      }
      if (r.arrow) {
        r.arrow.position.set(w.x, w.y + r.air + 2.85 + Math.sin(t * 6) * 0.15, w.z);
      }
    }

    // Chase Camera positioned behind player's car
    const p = this.player;
    const back = this.path.worldAt(Math.max(0, p.dist - 9.5), p.lane * 0.5);
    const ahead = this.path.worldAt(p.dist + 14, p.lane * 0.3);
    const desired = new THREE.Vector3(back.x, back.y + 3.8 + p.air * 0.5, back.z);

    if (this.camPos.lengthSq() === 0) this.camPos.copy(desired);
    this.camPos.lerp(desired, Math.min(1, dt * 7));
    this.camera.position.copy(this.camPos);

    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 2.2);
    }
    this.camera.lookAt(ahead.x, ahead.y + 1.6, ahead.z);
    this.camera.fov += (58 + Math.min(18, (p.speedMult - 1) * 12 + p.boost * 10) - this.camera.fov) * Math.min(1, dt * 5);
    this.camera.updateProjectionMatrix();

    // High speed streaks on turbo
    const streakIntensity = Math.max(
      0,
      Math.min(1, (p.speed - 48) / 40 + p.boost * 0.4 + Math.max(0, p.speedMult - 1) * 0.25),
    );
    this.speedLineMaterial.opacity = streakIntensity * 0.5;
    const attrTmp = new THREE.Vector3();
    for (const sLine of this.speedLines) {
      sLine.line.visible = streakIntensity > 0.03;
      if (!sLine.line.visible) continue;
      const s0 = p.dist + 5 + ((this.time * 80 + sLine.phase) % 48);
      const s1 = s0 - sLine.len;
      const a = this.path.worldAt(s0, sLine.lane);
      const b = this.path.worldAt(s1, sLine.lane * 0.96);
      const pos = sLine.line.geometry.getAttribute("position") as THREE.BufferAttribute;
      attrTmp.set(a.x, a.y + sLine.y, a.z);
      pos.setXYZ(0, attrTmp.x, attrTmp.y, attrTmp.z);
      attrTmp.set(b.x, b.y + sLine.y * 0.72, b.z);
      pos.setXYZ(1, attrTmp.x, attrTmp.y, attrTmp.z);
      pos.needsUpdate = true;
    }

    // Sun light follows player for shadows
    const pw = this.path.worldAt(p.dist, p.lane);
    this.sun.position.set(pw.x + 35, pw.y + 60, pw.z + 25);
    this.sun.target.position.set(pw.x, pw.y, pw.z);

    // Floaters
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt * 0.85;
      f.sp.position.y += dt * 3.4;
      f.sp.material.opacity = Math.max(0, f.life);
      if (f.life <= 0) {
        this.scene.remove(f.sp);
        this.floaters.splice(i, 1);
      }
    }
    for (const m of this.featureMeshes) {
      if (m.userData.bob) m.position.y += Math.sin(t * 3 + (m.userData.t0 ?? 0)) * dt * 0.4;
    }

    this.boostCharge = Math.min(1, this.boostCharge + dt * 0.08);

    if (this.netPush)
      this.netPush({
        dist: p.dist,
        lane: p.lane,
        hop: p.air,
        speed: p.speed,
        finishTime: p.finished ? p.finishTime : undefined,
      });

    this.onHud({
      place,
      total: this.racers.length,
      progress: Math.min(1, p.dist / this.path.length),
      countdown,
      speed: p.speed,
      boostCharge: this.boostCharge,
      time: this.time,
      score: this.score,
      finished: p.finished,
      racers: order.map((r) => ({
        id: r.cfg.id,
        name: r.cfg.name,
        color: r.cfg.color,
        progress: Math.min(1, Math.max(0, r.dist / this.path.length)),
        isPlayer: !!r.cfg.isPlayer,
      })),
    });

    this.composer.render();
  };

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unbind();
    try {
      audio.stopEngine();
    } catch {}
    this.renderer.dispose();
  }
}
