import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { buildPath, getTrack, TrackPath, Feature, PickupOp } from "@/lib/track";
import { makeCharacter, animateChar, CharParts } from "@/game/characters";
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
  parts: CharParts;
  dist: number;
  lane: number;
  laneVel: number;
  speed: number;
  boost: number; // turbo ability charge (0..~1.6), decays
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

const BASE_SPEED = 30;

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/**
 * Sleek telemetry-style nameplate (dark glass pill + thin accent rule)
 * instead of the old chunky outlined arcade text.
 */
function namePlate(text: string, accent: string, isPlayer: boolean) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 160;
  const g = c.getContext("2d")!;
  const label = text.toUpperCase();
  g.font = `700 ${isPlayer ? 62 : 52}px "Barlow Condensed", "Arial Narrow", Arial, sans-serif`;
  const tw = g.measureText(label).width;
  const padX = 34;
  const w = Math.min(500, tw + padX * 2);
  const h = isPlayer ? 84 : 72;
  const x = (512 - w) / 2;
  const y = (160 - h) / 2;

  g.shadowColor = "rgba(0,0,0,0.55)";
  g.shadowBlur = 16;
  g.shadowOffsetY = 4;
  roundRect(g, x, y, w, h, h / 2);
  g.fillStyle = isPlayer ? "rgba(10,14,12,0.82)" : "rgba(10,14,12,0.6)";
  g.fill();
  g.shadowColor = "transparent";
  g.lineWidth = isPlayer ? 4 : 2.5;
  g.strokeStyle = isPlayer ? "rgba(255,255,255,0.85)" : `${accent}bb`;
  g.stroke();

  // accent dot
  g.beginPath();
  g.arc(x + 22, 80, 9, 0, Math.PI * 2);
  g.fillStyle = accent;
  g.fill();

  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = isPlayer ? "#ffffff" : "rgba(255,255,255,0.9)";
  g.font = `700 ${isPlayer ? 62 : 52}px "Barlow Condensed", "Arial Narrow", Arial, sans-serif`;
  g.fillText(label, 256 + 8, 82);

  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, opacity: 0.95 }),
  );
  sp.scale.set(isPlayer ? 3.4 : 2.9, isPlayer ? 1.06 : 0.9, 1);
  return sp;
}

/** Crisp numeric callout used for +N / -N / xN feedback. */
function textSprite(text: string, color: string, outline = "#050807", size = 128) {
  const c = document.createElement("canvas");
  c.width = 320;
  c.height = 160;
  const g = c.getContext("2d")!;
  g.font = `800 ${size * 0.72}px "Barlow Condensed", "Arial Narrow", Arial, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = "rgba(0,0,0,0.6)";
  g.shadowBlur = 14;
  g.shadowOffsetY = 3;
  g.lineWidth = 9;
  g.strokeStyle = outline;
  g.strokeText(text, 160, 84);
  g.shadowColor = "transparent";
  g.fillStyle = color;
  g.fillText(text, 160, 84);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }),
  );
  sp.scale.set(3.0, 1.5, 1);
  return sp;
}

function pickupLabel(op: PickupOp, value: number) {
  return op === "x" ? `×${value}` : `${op}${value}`;
}
function pickupColor(op: PickupOp) {
  return op === "+" ? "#ffe14d" : op === "-" ? "#ff5566" : "#ff9f2e";
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
    this.renderer.toneMappingExposure = 1.22;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(58, canvas.clientWidth / canvas.clientHeight, 0.5, 1500);
    this.scene.fog = new THREE.Fog(new THREE.Color(def.fog), 110, 420);

    const hemi = new THREE.HemisphereLight(0xdcefff, 0x35592f, 0.85);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d4, 2.1);
    sun.position.set(30, 55, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.left = -26;
    sun.shadow.camera.right = 26;
    sun.shadow.camera.top = 26;
    sun.shadow.camera.bottom = -26;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 150;
    sun.shadow.bias = -0.0018;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    const fill = new THREE.DirectionalLight(0xbfe3ff, 0.35);
    fill.position.set(-25, 20, -15);
    this.scene.add(fill);

    const w = buildWorld(this.scene, this.path);
    this.featureMeshes = w.featureMeshes;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // restrained bloom: only genuinely bright highlights glow, so HUD sprites
    // and nameplates stay crisp instead of blowing out
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
      0.22,
      0.7,
      0.95,
    );
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());

    const lanes = configs.length;
    configs.forEach((cfg, i) => {
      const parts = makeCharacter(cfg.color, cfg.hat);
      this.scene.add(parts.root);
      const lane = lanes > 1 ? -0.7 + (1.4 * i) / (lanes - 1) : 0;
      const r: Racer = {
        cfg,
        parts,
        dist: 0,
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
          new THREE.ConeGeometry(0.26, 0.44, 4),
          new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.9 }),
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

    audio.resume();
    audio.startEngine();
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
    if (this.boostCharge >= 1 && !this.player.finished) {
      this.boostCharge = 0;
      this.player.boost = Math.max(this.player.boost, 1.6);
      this.spawnFloater(this.player, "TURBO", "#ffe14d");
      this.shake = 0.5;
      audio.turbo();
    } else {
      audio.uiError();
    }
  }

  spawnFloater(r: Racer, text: string, color: string) {
    const sp = textSprite(text, color, "#3a2100", 130);
    const w = this.path.worldAt(r.dist, r.lane);
    sp.position.set(w.x, w.y + 3, w.z);
    sp.scale.set(3.2, 1.6, 1);
    this.scene.add(sp);
    this.floaters.push({ sp, life: 1 });
  }

  // Pickups now behave like arithmetic operators applied directly to the
  // racer's live speed: "+3" adds 3 speed points, "-2" removes 2, "x3"
  // multiplies current speed by 3 for a short, decaying burst.
  applyFeature(r: Racer, f: Feature) {
    const isPlayer = r.cfg.isPlayer;
    if (f.type === "pickup") {
      const op = f.op ?? "+";
      if (op === "+") {
        r.speedMod = Math.min(26, r.speedMod + f.value * 2.1);
        if (isPlayer) {
          this.spawnFloater(r, pickupLabel(op, f.value), pickupColor(op));
          this.boostCharge = Math.min(1, this.boostCharge + f.value * 0.045);
          this.score += f.value;
          audio.pickupPlus(f.value);
        }
      } else if (op === "-") {
        if (r.air > 0.35) return;
        r.speedMod = Math.max(-22, r.speedMod - f.value * 2.1);
        r.stumble = 1;
        r.stun = 0.35;
        if (isPlayer) {
          this.spawnFloater(r, pickupLabel(op, f.value), pickupColor(op));
          this.shake = 0.6;
          this.score = Math.max(0, this.score - f.value);
          audio.pickupMinus(f.value);
        }
      } else {
        r.speedMult = Math.max(r.speedMult, f.value);
        if (isPlayer) {
          this.spawnFloater(r, pickupLabel(op, f.value), pickupColor(op));
          this.boostCharge = Math.min(1, this.boostCharge + 0.3);
          this.shake = 0.5;
          this.score += f.value * 2;
          audio.pickupMult(f.value);
        }
      }
    } else if (f.type === "ramp") {
      r.airVel = 11;
      if (isPlayer) {
        this.spawnFloater(r, "AIR", "#7fe7ff");
        audio.ramp();
      }
    } else if (f.type === "bump") {
      if (r.air > 0.2) return;
      r.airVel = 5;
      r.speedMod = Math.max(-22, r.speedMod - 1.5);
      if (isPlayer) {
        this.spawnFloater(r, "-1", "#ff9f43");
        audio.hit();
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

    // ---- steering
    if (r.cfg.isPlayer) {
      const steer = (this.input.right - this.input.left) * 3.4;
      r.laneVel += (steer - r.laneVel) * Math.min(1, dt * 9);
      if (this.input.jump && r.air <= 0.01) {
        r.airVel = 8.2;
        this.input.jump = false;
        audio.jump();
      }
    } else {
      // bot AI: aim for beneficial pickups, avoid penalties/hazards
      const skill = r.cfg.skill ?? 0.7;
      const look = this.path.features.filter((f) => f.s > r.dist + 4 && f.s < r.dist + 40);
      let want = r.targetLane;
      const good = look.find((f) => f.type === "pickup" && f.op !== "-");
      const bad = look.find(
        (f) =>
          ((f.type === "pickup" && f.op === "-") || f.type === "bump") &&
          Math.abs(f.lane - r.lane) < 0.25,
      );
      if (bad && Math.random() < skill) want = Math.max(-0.85, Math.min(0.85, bad.lane + (bad.lane > 0 ? -0.5 : 0.5)));
      else if (good && Math.random() < skill * 0.6) want = good.lane;
      r.targetLane = want;
      r.laneVel += ((want - r.lane) * 3 - r.laneVel) * Math.min(1, dt * 5);
      if (
        Math.random() < dt * 1.4 * skill &&
        look.some(
          (f) => f.type === "pickup" && f.op === "-" && Math.abs(f.lane - r.lane) < 0.3 && f.s - r.dist < 12,
        )
      )
        r.airVel = 8;
    }

    r.lane += r.laneVel * dt;
    for (const edge of [-1, 1] as const) {
      if ((edge === -1 && r.lane < -1) || (edge === 1 && r.lane > 1)) {
        r.lane = edge;
        r.laneVel = -edge * Math.abs(r.laneVel) * 0.4;
        r.speedMod -= 1;
        r.stumble = Math.max(r.stumble, 0.5);
        if (r.cfg.isPlayer) {
          this.shake = 0.3;
          if (this.time - this.lastWallSfx > 0.35) {
            audio.wall();
            this.lastWallSfx = this.time;
          }
        }
      }
    }

    // ---- air
    if (r.airVel !== 0 || r.air > 0) {
      const wasAir = r.air > 0.05;
      r.air += r.airVel * dt;
      r.airVel -= 26 * dt;
      if (r.air <= 0) {
        r.air = 0;
        r.airVel = 0;
        if (wasAir && r.cfg.isPlayer) audio.land();
      }
    }

    // ---- speed: base pace + turbo ability + live arithmetic pickup modifiers
    const slope = this.path.sample(r.dist).pitch;
    const skill = r.cfg.isPlayer ? 1 : 0.9 + (r.cfg.skill ?? 0.7) * 0.16;
    let target = BASE_SPEED * skill * (1 + r.boost * 0.55) - slope * 26 + r.speedMod;
    target *= r.speedMult;
    if (r.stun > 0) {
      target *= 0.45;
      r.stun -= dt;
    }
    r.speed += (target - r.speed) * Math.min(1, dt * 2.6);
    r.speed = Math.max(4, r.speed);
    r.boost = Math.max(0, r.boost - dt * 0.7);
    r.speedMod *= 1 - Math.min(1, dt * 0.65);
    r.speedMult += (1 - r.speedMult) * Math.min(1, dt * 1.6);
    r.stumble = Math.max(0, r.stumble - dt * 2.2);
    r.dist += r.speed * dt;

    // ---- features
    while (
      r.nextFeature < this.path.features.length &&
      this.path.features[r.nextFeature].s < r.dist
    ) {
      const f = this.path.features[r.nextFeature];
      if (Math.abs(f.lane - r.lane) < f.half + 0.16) this.applyFeature(r, f);
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
    audio.finish(livePlace <= 3);
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

    // countdown / start audio cues
    if (countdown !== null && countdown !== this.lastCountdown) {
      if (countdown > 0) audio.countdownBeep(countdown);
      else audio.goHorn();
      this.lastCountdown = countdown;
    }

    for (const r of this.racers) this.stepRacer(r, dt, racing);

    // render placement
    const order = [...this.racers].sort((a, b) => b.dist - a.dist);
    const place = order.findIndex((r) => r === this.player) + 1;

    // position-change stingers
    if (this.lastPlace > 0 && place !== this.lastPlace && !this.player.finished) {
      if (place < this.lastPlace) audio.overtake();
      else audio.overtaken();
    }
    this.lastPlace = place;

    // ---- reactive audio: wind/rumble bed + footstep cadence
    const sp01 = this.player.speed / 45;
    audio.updateEngine(racing && !this.player.finished ? sp01 : 0, this.player.air > 0.05 ? 1 : 0);
    if (racing && !this.player.finished && this.player.air <= 0.05) {
      this.stepPhase += dt * (7 + Math.min(1, sp01) * 9) * 2;
      if (this.stepPhase >= Math.PI) {
        this.stepPhase -= Math.PI;
        audio.footstep(0.5 + Math.min(1, sp01) * 0.8);
      }
    }

    // transforms
    const t = this.time;
    for (const r of this.racers) {
      const w = this.path.worldAt(r.dist, r.lane);
      r.parts.root.position.set(w.x, w.y + r.air, w.z);
      r.parts.root.rotation.y = w.yaw + Math.PI + r.laneVel * 0.12;
      animateChar(
        r.parts,
        t + r.dist * 0.02,
        Math.min(1, r.speed / 45),
        r.air > 0.05 ? 1 : 0,
        r.stumble,
      );
      if (r.label) {
        r.label.position.set(w.x, w.y + r.air + (r.cfg.isPlayer ? 3.5 : 3.2), w.z);
        r.label.material.opacity = r.cfg.isPlayer ? 1 : 0.85;
      }
      if (r.arrow) {
        r.arrow.position.set(w.x, w.y + r.air + 2.75 + Math.sin(t * 5) * 0.12, w.z);
      }
    }

    // camera
    const p = this.player;
    const back = this.path.worldAt(Math.max(0, p.dist - 8.5), p.lane * 0.55);
    const ahead = this.path.worldAt(p.dist + 12, p.lane * 0.35);
    const desired = new THREE.Vector3(back.x, back.y + 4.6 + p.air * 0.55, back.z);
    if (this.camPos.lengthSq() === 0) this.camPos.copy(desired);
    this.camPos.lerp(desired, Math.min(1, dt * 6));
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 2);
    }
    this.camera.lookAt(ahead.x, ahead.y + 1.9, ahead.z);
    this.camera.fov += (58 + Math.min(16, (p.speedMult - 1) * 10 + p.boost * 8) - this.camera.fov) * Math.min(1, dt * 4);
    this.camera.updateProjectionMatrix();

    // sun follows player so shadows always stay in a tight, high quality frustum
    const pw = this.path.worldAt(p.dist, p.lane);
    this.sun.position.set(pw.x + 30, pw.y + 55, pw.z + 20);
    this.sun.target.position.set(pw.x, pw.y, pw.z);

    // floaters + spinning/bobbing props
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt * 0.85;
      f.sp.position.y += dt * 3.2;
      f.sp.material.opacity = Math.max(0, f.life);
      if (f.life <= 0) {
        this.scene.remove(f.sp);
        this.floaters.splice(i, 1);
      }
    }
    for (const m of this.featureMeshes) {
      if (m.userData.spin) m.rotation.y += dt * 1.6;
      if (m.userData.bob) m.position.y += Math.sin(t * 3 + (m.userData.t0 ?? 0)) * dt * 0.4;
    }

    this.boostCharge = Math.min(1, this.boostCharge + dt * 0.06);

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
        progress: Math.min(1, r.dist / this.path.length),
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
    audio.stopEngine();
    this.renderer.dispose();
  }
}
