import * as THREE from "three";
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
  gapAhead: number;
  nitroActive: boolean;
  trackName: string;
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
  accel: number;
  boost: number;
  speedMod: number;
  speedMult: number;
  stun: number;
  air: number;
  airVel: number;
  stumble: number;
  slip: number;
  landSquash: number;
  draft: number;
  finished: boolean;
  finishTime: number;
  nextFeature: number;
  targetLane: number;
  label?: THREE.Sprite;
  arrow?: THREE.Mesh;
  netDist?: number;
  netLane?: number;
};

const GRAVITY = 42;
const JUMP_VEL = 12.4;
const CRUISE = 82;
const ENGINE = 62;
const DRAG = 0.007;
const ROLL_RES = 2.2;
const LANE_LIMIT = 0.94;
const WALL_REST = 0.28;

function namePlate(text: string, accent: string, isPlayer: boolean) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 160;
  const g = c.getContext("2d")!;
  const label = text.toUpperCase();
  const fontSize = isPlayer ? 66 : 50;
  g.font = `900 italic ${fontSize}px "Arial Black", "Barlow Condensed", Arial, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = "rgba(0,0,0,0.55)";
  g.shadowBlur = 12;
  g.shadowOffsetY = 6;
  g.lineJoin = "round";
  g.lineWidth = isPlayer ? 14 : 10;
  g.strokeStyle = "#0b1018";
  g.strokeText(label, 256, 78);
  g.lineWidth = isPlayer ? 5 : 4;
  g.strokeStyle = isPlayer ? "#7af7ff" : accent;
  g.strokeText(label, 256, 78);
  g.shadowColor = "transparent";
  g.fillStyle = "#ffffff";
  g.fillText(label, 256, 78);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, opacity: isPlayer ? 1 : 0.88 }),
  );
  sp.scale.set(1.7, 0.52, 1);
  return sp;
}

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
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  sp.scale.set(3.4, 1.7, 1);
  return sp;
}

function pickupLabel(op: PickupOp, value: number) {
  return op === "x" ? `×${value} NITRO!` : op === "÷" ? `÷${value} SLOW!` : op === "+" ? `+${value} SPEED!` : `-${value} SLOW!`;
}

function pickupColor(op: PickupOp) {
  return op === "+" ? "#00ff88" : op === "x" ? "#ffd700" : op === "-" ? "#ff7700" : "#ff0055";
}

type Dust = { sprite: THREE.Sprite; vel: THREE.Vector3; life: number };

export class RaceEngine {
  renderer: THREE.WebGLRenderer;
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
  camLook = new THREE.Vector3();
  shake = 0;
  sun: THREE.DirectionalLight;
  lastWallSfx = -1;
  private lastCountdown = -1;
  private lastPlace = -1;
  private speedLineMaterial!: THREE.LineBasicMaterial;
  private speedLines: { line: THREE.Line; lane: number; phase: number; len: number; y: number }[] = [];
  private dust: Dust[] = [];
  private dustMat!: THREE.SpriteMaterial;
  private dustSpawn = 0;
  private trackName: string;
  private euler = new THREE.Euler();

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
    this.trackName = def.name;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(62, canvas.clientWidth / canvas.clientHeight, 0.35, 900);
    this.scene.fog = new THREE.Fog(new THREE.Color(def.fog), 140, 480);
    this.scene.background = new THREE.Color(def.sky[1]);

    this.speedLineMaterial = new THREE.LineBasicMaterial({
      color: 0xb8ffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.scene.add(new THREE.HemisphereLight(0xe7f1ff, 0x3a4a32, 0.95));
    const sun = new THREE.DirectionalLight(def.id === "sunset-lagoon" ? 0xffd2a8 : 0xfff1d6, 2.05);
    sun.position.set(40, 70, 28);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -22;
    sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0018;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    this.scene.add(new THREE.DirectionalLight(0xb7d8ff, 0.28).translateX(-20));

    const w = buildWorld(this.scene, this.path);
    this.featureMeshes = w.featureMeshes;

    configs.forEach((cfg, i) => {
      const parts = makeCar(cfg.color, cfg.hat);
      this.scene.add(parts.root);
      const row = Math.floor(i / 2);
      const col = i % 2;
      const lane = col === 0 ? -0.4 : 0.4;
      const startDist = -row * 8.4;
      const r: Racer = {
        cfg,
        parts,
        dist: startDist,
        lane,
        laneVel: 0,
        speed: 0,
        accel: 0,
        boost: 0,
        speedMod: 0,
        speedMult: 1,
        stun: 0,
        air: 0,
        airVel: 0,
        stumble: 0,
        slip: 0,
        landSquash: 0,
        draft: 0,
        finished: false,
        finishTime: 0,
        nextFeature: 0,
        targetLane: lane,
      };
      if (cfg.isPlayer) {
        this.player = r;
      } else {
        const label = namePlate(cfg.name.slice(0, 9), cfg.color, false);
        this.scene.add(label);
        r.label = label;
      }
      this.racers.push(r);
    });

    for (let i = 0; i < 18; i++) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
      const line = new THREE.Line(geom, this.speedLineMaterial);
      line.visible = false;
      line.frustumCulled = false;
      line.renderOrder = 2;
      this.scene.add(line);
      const side = i % 2 === 0 ? -1 : 1;
      this.speedLines.push({
        line,
        lane: side * (1.05 + Math.random() * 0.85),
        phase: Math.random() * 60,
        len: 7 + Math.random() * 14,
        y: 0.7 + Math.random() * 1.7,
      });
    }

    const dustCanvas = document.createElement("canvas");
    dustCanvas.width = dustCanvas.height = 64;
    const dg = dustCanvas.getContext("2d")!;
    const grd = dg.createRadialGradient(32, 32, 4, 32, 32, 30);
    grd.addColorStop(0, "rgba(210,200,180,0.55)");
    grd.addColorStop(1, "rgba(210,200,180,0)");
    dg.fillStyle = grd;
    dg.fillRect(0, 0, 64, 64);
    this.dustMat = new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(dustCanvas),
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
    });

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
      this.player.boost = Math.max(this.player.boost, 1.85);
      this.spawnFloater(this.player, "NITRO BOOST!", "#7af7ff");
      this.shake = 0.55;
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
    this.scene.add(sp);
    this.floaters.push({ sp, life: 1 });
  }

  spawnDust(r: Racer, count: number, burst = false) {
    const w = this.path.worldAt(r.dist - 1.4, r.lane);
    for (let i = 0; i < count; i++) {
      if (this.dust.length > 70) {
        const old = this.dust.shift();
        if (old) this.scene.remove(old.sprite);
      }
      const sprite = new THREE.Sprite(this.dustMat.clone());
      sprite.position.set(w.x + (Math.random() - 0.5) * 1.2, w.y + 0.2, w.z + (Math.random() - 0.5) * 1.2);
      const s = burst ? 1.4 + Math.random() : 0.55 + Math.random() * 0.7;
      sprite.scale.setScalar(s);
      this.scene.add(sprite);
      this.dust.push({
        sprite,
        vel: new THREE.Vector3((Math.random() - 0.5) * 2, burst ? 2 + Math.random() * 3 : 0.6, (Math.random() - 0.5) * 2),
        life: burst ? 0.7 : 0.45,
      });
    }
  }

  applyFeature(r: Racer, f: Feature) {
    const isPlayer = r.cfg.isPlayer;
    if (f.type === "pickup") {
      const op = f.op ?? "+";
      if (op === "+") {
        r.speedMod = Math.min(30, r.speedMod + f.value * 2.6);
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
        r.speedMod = Math.max(-26, r.speedMod - f.value * 2.6);
        r.stumble = 1;
        r.stun = 0.28;
        if (isPlayer) {
          this.spawnFloater(r, pickupLabel(op, f.value), pickupColor(op));
          this.shake = 0.55;
          this.score = Math.max(0, this.score - f.value * 5);
          try {
            audio.pickupMinus(f.value);
          } catch {}
        }
      } else if (op === "÷") {
        if (r.air > 0.35) return;
        r.speedMult = Math.max(0.42, 1 / f.value);
        r.stumble = 1.15;
        r.stun = 0.38;
        if (isPlayer) {
          this.spawnFloater(r, pickupLabel(op, f.value), pickupColor(op));
          this.shake = 0.65;
          try {
            audio.pickupMinus(f.value);
          } catch {}
        }
      } else {
        r.speedMult = Math.max(r.speedMult, f.value * 1.08);
        if (isPlayer) {
          this.spawnFloater(r, pickupLabel(op, f.value), pickupColor(op));
          this.boostCharge = Math.min(1, this.boostCharge + 0.4);
          this.shake = 0.5;
          this.score += f.value * 25;
          try {
            audio.pickupMult(f.value);
          } catch {}
        }
      }
    } else if (f.type === "ramp") {
      r.airVel = Math.max(r.airVel, 14.5);
      r.air = Math.max(r.air, 0.08);
      if (isPlayer) {
        this.spawnFloater(r, "BIG AIR!", "#7af7ff");
        try {
          audio.ramp();
        } catch {}
      }
    } else if (f.type === "bump") {
      if (r.air > 0.2) return;
      r.airVel = 5.4;
      r.speedMod = Math.max(-26, r.speedMod - 2.4);
      r.stumble = Math.max(r.stumble, 0.7);
      if (isPlayer) {
        this.spawnFloater(r, "HAZARD!", "#ff7700");
        this.shake = 0.4;
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
      r.accel = -r.speed * 1.6;
      r.speed = Math.max(0, r.speed + r.accel * dt);
      r.dist += r.speed * dt;
      r.laneVel *= 1 - dt * 4;
      r.lane += r.laneVel * dt;
      return;
    }

    if (!racing) {
      r.speed = Math.max(0, r.speed - dt * 18);
      r.laneVel *= 1 - dt * 6;
      return;
    }

    const sample = this.path.sample(r.dist);
    const grounded = r.air <= 0.02;
    let steer = 0;

    if (r.cfg.isPlayer) {
      steer = this.input.right - this.input.left;
      if (this.input.jump && grounded) {
        r.airVel = JUMP_VEL;
        r.air = 0.05;
        this.input.jump = false;
        try {
          audio.jump();
        } catch {}
      }
    } else {
      const skill = r.cfg.skill ?? 0.7;
      const look = this.path.features.filter((f) => f.s > r.dist + 4 && f.s < r.dist + 48);
      let want = r.targetLane;
      const good = look.find((f) => f.type === "pickup" && f.op !== "-" && f.op !== "÷");
      const bad = look.find(
        (f) =>
          ((f.type === "pickup" && (f.op === "-" || f.op === "÷")) || f.type === "bump") &&
          Math.abs(f.lane - r.lane) < 0.28,
      );
      if (bad && Math.random() < skill)
        want = Math.max(-0.82, Math.min(0.82, bad.lane + (bad.lane > 0 ? -0.46 : 0.46)));
      else if (good && Math.random() < skill * 0.72) want = good.lane;
      r.targetLane = want;
      steer = THREE.MathUtils.clamp((want - r.lane) * 1.8, -1, 1);
      if (
        grounded &&
        Math.random() < dt * 1.35 * skill &&
        look.some(
          (f) => f.type === "pickup" && (f.op === "-" || f.op === "÷") && Math.abs(f.lane - r.lane) < 0.3 && f.s - r.dist < 12,
        )
      ) {
        r.airVel = JUMP_VEL * 0.92;
        r.air = 0.05;
      }
    }

    // Speed-sensitive grip. Fast cars wash wide; slow cars snap.
    const grip = 1 / (1 + r.speed * 0.009);
    const airMul = grounded ? 1 : 0.32;
    const steerForce = steer * (16.5 + Math.abs(sample.curve) * 28) * grip * airMul;
    r.laneVel += (steerForce - r.laneVel * (4.2 + r.speed * 0.008)) * dt;
    r.slip += (r.laneVel * 0.22 - r.slip) * Math.min(1, dt * 6);
    r.lane += r.laneVel * dt;

    // Walls with restitution
    if (r.lane < -LANE_LIMIT || r.lane > LANE_LIMIT) {
      const edge = r.lane < 0 ? -1 : 1;
      r.lane = edge * LANE_LIMIT;
      const impact = Math.abs(r.laneVel);
      r.laneVel = -edge * impact * WALL_REST;
      r.speed = Math.max(8, r.speed - impact * 3.2);
      r.stumble = Math.max(r.stumble, 0.45 + impact * 0.08);
      if (r.cfg.isPlayer) {
        this.shake = Math.min(0.7, 0.22 + impact * 0.08);
        if (this.time - this.lastWallSfx > 0.32) {
          try {
            audio.wall();
          } catch {}
          this.lastWallSfx = this.time;
        }
      }
    }

    // Car-to-car: separate + transfer longitudinal speed on rear-end
    for (const other of this.racers) {
      if (other === r) continue;
      const dDist = r.dist - other.dist;
      const dLane = r.lane - other.lane;
      if (Math.abs(dDist) < 3.6 && Math.abs(dLane) < 0.3) {
        const push = dLane === 0 ? (r.cfg.id > other.cfg.id ? 1 : -1) : Math.sign(dLane);
        r.laneVel += push * dt * 7.5;
        if (dDist < 0 && dDist > -3.2 && Math.abs(dLane) < 0.22) {
          const rel = other.speed - r.speed;
          if (rel > 2) {
            r.speed += rel * 0.18;
            other.speed -= rel * 0.12;
            r.stumble = Math.max(r.stumble, 0.35);
          }
        }
      }
    }

    // Drafting
    r.draft = 0;
    for (const other of this.racers) {
      if (other === r) continue;
      const ahead = other.dist - r.dist;
      if (ahead > 2.5 && ahead < 14 && Math.abs(other.lane - r.lane) < 0.22) {
        r.draft = Math.max(r.draft, 1 - ahead / 14);
      }
    }

    // Air / gravity
    if (!grounded || r.airVel !== 0) {
      const wasAir = r.air > 0.06;
      r.airVel -= GRAVITY * dt;
      r.air += r.airVel * dt;
      if (r.air <= 0) {
        const impact = wasAir ? Math.abs(r.airVel) : 0;
        r.air = 0;
        r.airVel = 0;
        if (wasAir) {
          r.landSquash = Math.min(1, impact / 22);
          r.speed *= 1 - Math.min(0.12, impact * 0.004);
          if (r.cfg.isPlayer) {
            this.shake = Math.max(this.shake, Math.min(0.55, impact * 0.02));
            this.spawnDust(r, 6, true);
            try {
              audio.land();
            } catch {}
          }
        }
      }
    }

    // Longitudinal: force vs drag vs slope vs modifiers
    const slope = sample.pitch;
    const skill = r.cfg.isPlayer ? 1 : 0.9 + (r.cfg.skill ?? 0.7) * 0.15;
    const nitro = r.boost > 0 ? 1 : 0;
    const cruise = CRUISE * skill + r.speedMod + r.draft * 10 + nitro * 28;
    const drive = ENGINE * skill + nitro * 70;
    const drag = r.speed * r.speed * DRAG + ROLL_RES;
    const grav = Math.sin(slope) * 26;
    r.accel = drive * (1 - Math.min(0.92, r.speed / Math.max(12, cruise + 36))) - drag - grav;
    if (r.stun > 0) {
      r.accel *= 0.35;
      r.stun -= dt;
    }
    r.speed += r.accel * dt;
    const want = Math.max(8, (cruise - grav * 0.35) * THREE.MathUtils.clamp(r.speedMult, 0.4, 3.2));
    r.speed += (want - r.speed) * Math.min(1, dt * 2.05);
    r.speed = Math.max(6, r.speed);

    r.boost = Math.max(0, r.boost - dt * 0.72);
    r.speedMod *= 1 - Math.min(1, dt * 0.55);
    r.speedMult += (1 - r.speedMult) * Math.min(1, dt * 1.35);
    r.stumble = Math.max(0, r.stumble - dt * 2.1);
    r.landSquash = Math.max(0, r.landSquash - dt * 3.4);
    r.dist += r.speed * dt;

    while (r.nextFeature < this.path.features.length && this.path.features[r.nextFeature].s < r.dist) {
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
    const livePlace = [...this.racers].sort((a, b) => b.dist - a.dist).findIndex((r) => r === this.player) + 1;
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
    const dt = Math.min(0.033, this.clock.getDelta());

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

    if (countdown !== null && countdown !== this.lastCountdown) {
      try {
        if (countdown > 0) audio.countdownBeep(countdown);
        else audio.goHorn();
      } catch {}
      this.lastCountdown = countdown;
    }

    for (const r of this.racers) this.stepRacer(r, dt, racing);

    const order = [...this.racers].sort((a, b) => b.dist - a.dist);
    const place = order.findIndex((r) => r === this.player) + 1;
    if (this.lastPlace > 0 && place !== this.lastPlace && !this.player.finished) {
      try {
        if (place < this.lastPlace) audio.overtake();
        else audio.overtaken();
      } catch {}
    }
    this.lastPlace = place;

    const ahead = order[place - 2];
    const gapAhead = ahead ? (ahead.dist - this.player.dist) / Math.max(12, this.player.speed) : 0;

    try {
        audio.updateEngine(
        racing && !this.player.finished ? this.player.speed / 110 : 0,
        this.player.air > 0.05 ? 1 : 0,
      );
    } catch {}

    const t = this.time;
    for (const r of this.racers) {
      const w = this.path.worldAt(r.dist, r.lane);
      r.parts.root.position.set(w.x, w.y + r.air, w.z);
      this.euler.set(-w.pitch * 0.92, w.yaw + Math.PI + r.slip * 0.12, w.roll * 0.85, "YXZ");
      r.parts.root.quaternion.setFromEuler(this.euler);

      const steerDir = THREE.MathUtils.clamp(r.laneVel * 0.28, -1, 1);
      animateCar(r.parts, t + r.dist * 0.015, Math.min(1.5, r.speed / 48), r.air > 0.05 ? 1 : 0, r.stumble, steerDir, r.boost > 0.2 || r.speedMult > 1.18, {
        pitch: -r.accel * 0.012,
        roll: w.roll,
        slip: r.slip,
        landSquash: r.landSquash,
        dt,
      });

      if (r.label) {
        const near = Math.abs(r.dist - this.player.dist);
        r.label.visible = near < 28;
        r.label.position.set(w.x, w.y + r.air + 1.85, w.z);
        (r.label.material as THREE.SpriteMaterial).opacity = THREE.MathUtils.clamp(1 - near / 28, 0, 0.85);
      }
    }

    // Chase camera with speed look-ahead and landing dip
    const p = this.player;
    const lookAhead = 9 + p.speed * 0.07;
    const back = 6.1 + Math.min(1.6, p.speed * 0.012);
    const camSample = this.path.worldAt(Math.max(0, p.dist - back), p.lane * 0.28);
    const lookSample = this.path.worldAt(p.dist + lookAhead, p.lane * 0.16);
    const desired = new THREE.Vector3(camSample.x, camSample.y + 2.15 + p.air * 0.28 - p.landSquash * 0.2, camSample.z);
    if (this.camPos.lengthSq() === 0) {
      this.camPos.copy(desired);
      this.camLook.set(lookSample.x, lookSample.y + 1.5, lookSample.z);
    }
    this.camPos.lerp(desired, Math.min(1, dt * 6.2));
    this.camLook.lerp(new THREE.Vector3(lookSample.x, lookSample.y + 0.85 + p.air * 0.12, lookSample.z), Math.min(1, dt * 8));
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.7;
      this.shake = Math.max(0, this.shake - dt * 2.4);
    }
    this.camera.lookAt(this.camLook);
    const fovWant = 60 + Math.min(10, (p.speed - 70) * 0.12 + p.boost * 6);
    this.camera.fov += (fovWant - this.camera.fov) * Math.min(1, dt * 4.5);
    this.camera.updateProjectionMatrix();

    this.speedLineMaterial.opacity = 0;
    for (const sLine of this.speedLines) {
      sLine.line.visible = false;
      if (!sLine.line.visible) continue;
      const s0 = p.dist + 6 + ((this.time * 90 + sLine.phase) % 50);
      const s1 = s0 - sLine.len;
      const a = this.path.worldAt(s0, sLine.lane);
      const b = this.path.worldAt(s1, sLine.lane * 0.96);
      const pos = sLine.line.geometry.getAttribute("position") as THREE.BufferAttribute;
      pos.setXYZ(0, a.x, a.y + sLine.y, a.z);
      pos.setXYZ(1, b.x, b.y + sLine.y * 0.7, b.z);
      pos.needsUpdate = true;
    }

    if (p.air < 0.04 && p.speed > 70 && racing) {
      this.dustSpawn += dt;
      if (this.dustSpawn > 0.09) {
        this.dustSpawn = 0;
        this.spawnDust(p, 1);
      }
    }
    for (let i = this.dust.length - 1; i >= 0; i--) {
      const d = this.dust[i];
      d.life -= dt;
      d.sprite.position.addScaledVector(d.vel, dt);
      d.sprite.material.opacity = Math.max(0, d.life * 0.7);
      d.sprite.scale.multiplyScalar(1 + dt * 1.4);
      if (d.life <= 0) {
        this.scene.remove(d.sprite);
        this.dust.splice(i, 1);
      }
    }

    const pw = this.path.worldAt(p.dist, p.lane);
    this.sun.position.set(pw.x + 38, pw.y + 68, pw.z + 26);
    this.sun.target.position.set(pw.x, pw.y, pw.z);

    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt * 0.85;
      f.sp.position.y += dt * 3.2;
      (f.sp.material as THREE.SpriteMaterial).opacity = Math.max(0, f.life);
      if (f.life <= 0) {
        this.scene.remove(f.sp);
        this.floaters.splice(i, 1);
      }
    }
    for (const m of this.featureMeshes) {
      if (m.userData.spin) {
        const badge = m.getObjectByName("badge");
        const ring = m.getObjectByName("ring");
        if (badge) badge.rotation.z += dt * 1.6;
        if (ring) {
          ring.rotation.z += dt * 2.2;
          ring.scale.setScalar(1 + Math.sin(t * 3 + (m.userData.t0 ?? 0)) * 0.06);
        }
      }
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
      speed: p.speed * 2.35,
      boostCharge: this.boostCharge,
      time: this.time,
      score: this.score,
      finished: p.finished,
      gapAhead,
      nitroActive: p.boost > 0.15,
      trackName: this.trackName,
      racers: order.map((r) => ({
        id: r.cfg.id,
        name: r.cfg.name,
        color: r.cfg.color,
        progress: Math.min(1, Math.max(0, r.dist / this.path.length)),
        isPlayer: !!r.cfg.isPlayer,
      })),
    });

    this.renderer.render(this.scene, this.camera);
  };

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
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
