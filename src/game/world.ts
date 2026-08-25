import * as THREE from "three";
import { TrackPath, PickupOp } from "@/lib/track";

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function asphaltRoadTexture(warmth = 0) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1024;
  const g = c.getContext("2d")!;
  const base = 28 + warmth * 10;
  g.fillStyle = `rgb(${base + 4},${base},${base - 2})`;
  g.fillRect(0, 0, 1024, 1024);

  for (let i = 0; i < 42000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const shade = Math.random() > 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${shade},${shade},${shade},${Math.random() * 0.07})`;
    g.fillRect(x, y, 2, 2);
  }

  // Wear streaks
  g.globalAlpha = 0.05;
  for (let i = 0; i < 18; i++) {
    const x = 80 + Math.random() * 860;
    g.fillStyle = "#000";
    g.fillRect(x, 0, 6 + Math.random() * 10, 1024);
  }
  g.globalAlpha = 1;

  const kerbW = 52;
  const kerbH = 56;
  for (let y = 0; y < 1024; y += kerbH) {
    const red = (y / kerbH) % 2 === 0;
    g.fillStyle = red ? "#e23b3b" : "#f4f4f4";
    g.fillRect(0, y, kerbW, kerbH);
    g.fillRect(1024 - kerbW, y, kerbW, kerbH);
  }

  g.fillStyle = "rgba(255,255,255,0.88)";
  g.fillRect(kerbW, 0, 10, 1024);
  g.fillRect(1024 - kerbW - 10, 0, 10, 1024);

  g.fillStyle = "#f0c94a";
  g.fillRect(504, 0, 5, 1024);
  g.fillRect(515, 0, 5, 1024);

  g.fillStyle = "rgba(255,255,255,0.72)";
  const dashH = 52;
  const gapH = 38;
  for (let y = 0; y < 1024; y += dashH + gapH) {
    g.fillRect(278, y, 7, dashH);
    g.fillRect(740, y, 7, dashH);
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function grassTexture(a: string, b: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = a;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = Math.random() > 0.5 ? b : a;
    g.globalAlpha = 0.35 + Math.random() * 0.4;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 3, 6 + Math.random() * 10);
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function barkTexture(hex: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const base = new THREE.Color(hex);
  g.fillStyle = `#${base.getHexString()}`;
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 70; i++) {
    const shade = base.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.18);
    g.fillStyle = `#${shade.getHexString()}`;
    g.fillRect(Math.random() * 128, 0, 2 + Math.random() * 5, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function cloudTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(128, 128, 20, 128, 128, 120);
  grd.addColorStop(0, "rgba(255,255,255,0.85)");
  grd.addColorStop(0.45, "rgba(255,255,255,0.35)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function symbolTexture(op: PickupOp, value: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const label = op === "x" ? `×${value}` : op === "÷" ? `÷${value}` : `${op}${value}`;
  const palette =
    op === "+"
      ? { core: "#00ff88", shadow: "#033b1f", bg: "rgba(0,50,25,0.88)" }
      : op === "x"
        ? { core: "#ffd700", shadow: "#423200", bg: "rgba(50,40,0,0.88)" }
        : op === "-"
          ? { core: "#ff7700", shadow: "#421800", bg: "rgba(50,20,0,0.88)" }
          : { core: "#ff0055", shadow: "#420014", bg: "rgba(50,0,20,0.88)" };

  const glow = g.createRadialGradient(128, 128, 16, 128, 128, 128);
  glow.addColorStop(0, palette.core);
  glow.addColorStop(0.5, `${palette.core}55`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, 256, 256);

  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
    const x = 128 + Math.cos(a) * 88;
    const y = 128 + Math.sin(a) * 88;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fillStyle = palette.bg;
  g.fill();
  g.lineWidth = 11;
  g.strokeStyle = palette.core;
  g.stroke();

  g.fillStyle = "rgba(255,255,255,0.22)";
  g.beginPath();
  g.ellipse(108, 80, 52, 16, -0.3, 0, Math.PI * 2);
  g.fill();

  g.font = "900 100px Arial Black, Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 16;
  g.strokeStyle = palette.shadow;
  g.strokeText(label, 128, 134);
  g.fillStyle = "#ffffff";
  g.fillText(label, 128, 134);

  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function bannerTexture(title: string, color: string) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#10141c";
  g.fillRect(0, 0, 1024, 256);
  const stripe = 36;
  for (let x = 0; x < 1024; x += stripe) {
    g.fillStyle = ((x / stripe) | 0) % 2 === 0 ? "#f4f4f4" : "#111";
    g.fillRect(x, 0, stripe, 28);
    g.fillRect(x, 228, stripe, 28);
  }
  g.font = "900 120px Arial Black, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = color;
  g.fillText(title, 512, 136);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function buildRibbon(
  pts: { x: number; y: number; z: number; yaw: number }[],
  halfW: number,
  yOff: number,
  step: number,
  vScale: number,
) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const sx = Math.cos(p.yaw);
    const sz = -Math.sin(p.yaw);
    positions.push(p.x - sx * halfW, p.y + yOff, p.z - sz * halfW);
    positions.push(p.x + sx * halfW, p.y + yOff, p.z + sz * halfW);
    const v = (i * step) / vScale;
    uvs.push(0, v, 1, v);
    if (i < pts.length - 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildWorld(scene: THREE.Scene, path: TrackPath) {
  const def = path.def;
  const group = new THREE.Group();
  scene.add(group);
  const pts = path.points;
  const halfW = def.width / 2;
  const rnd = mulberry32(def.seed);
  const warm = def.id === "sunset-lagoon" ? 1 : 0;

  // ---- Sky
  const skyGeo = new THREE.SphereGeometry(980, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(def.sky[0]) },
      bottom: { value: new THREE.Color(def.sky[1]) },
      sunDir: { value: new THREE.Vector3(0.38, 0.62, 0.42).normalize() },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: `
      varying vec3 vP; uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir;
      void main(){
        vec3 n = normalize(vP);
        float h = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(bottom, top, pow(h, 0.82));
        float horizon = exp(-abs(h - 0.46) * 10.0);
        col += vec3(1.0, 0.72, 0.35) * horizon * 0.28;
        float sun = pow(max(0.0, dot(n, sunDir)), 42.0);
        col += vec3(1.0, 0.92, 0.7) * sun * 1.55;
        float glow = pow(max(0.0, dot(n, sunDir)), 6.0);
        col += vec3(1.0, 0.8, 0.45) * glow * 0.22;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // Clouds
  const cloudTex = cloudTexture();
  const cloudMat = new THREE.SpriteMaterial({
    map: cloudTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
    color: warm ? 0xffe0c0 : 0xffffff,
  });
  for (let i = 0; i < 16; i++) {
    const spr = new THREE.Sprite(cloudMat);
    const ang = rnd() * Math.PI * 2;
    const dist = 220 + rnd() * 380;
    spr.position.set(Math.cos(ang) * dist, 70 + rnd() * 70, Math.sin(ang) * dist);
    const s = 40 + rnd() * 70;
    spr.scale.set(s, s * 0.45, 1);
    group.add(spr);
  }

  // ---- Terrain that hugs the track
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity,
    minY = Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
    minY = Math.min(minY, p.y);
  }
  const pad = 220;
  const tw = maxX - minX + pad * 2;
  const td = maxZ - minZ + pad * 2;
  const segs = 72;
  const terrainGeo = new THREE.PlaneGeometry(tw, td, segs, segs);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  const sampleStep = Math.max(1, Math.floor(pts.length / 180));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + (minX + maxX) / 2;
    const z = pos.getZ(i) + (minZ + maxZ) / 2;
    let nearest = 1e9;
    let ty = minY;
    for (let k = 0; k < pts.length; k += sampleStep) {
      const p = pts[k];
      const dx = p.x - x;
      const dz = p.z - z;
      const d = dx * dx + dz * dz;
      if (d < nearest) {
        nearest = d;
        ty = p.y;
      }
    }
    const dist = Math.sqrt(nearest);
    const n1 = Math.sin(x * 0.017 + z * 0.013) * 4.5 + Math.sin(x * 0.041) * 2.2;
    const n2 = Math.sin(z * 0.009 + x * 0.006) * 9;
    let h = ty - 1.15;
    if (dist > halfW + 2) {
      const t = Math.min(1, (dist - halfW - 2) / 28);
      h = ty - 1.15 + (n1 + n2) * t * t;
    }
    pos.setX(i, x);
    pos.setY(i, h);
    pos.setZ(i, z);
  }
  pos.needsUpdate = true;
  terrainGeo.computeVertexNormals();
  const grassTex = grassTexture(def.grass[0], def.grass[1]);
  grassTex.repeat.set(28, 28);
  const terrain = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshStandardMaterial({
      map: grassTex,
      roughness: 0.95,
      metalness: 0,
      color: 0xd8d8d8,
    }),
  );
  terrain.receiveShadow = true;
  group.add(terrain);

  // Distant mountains
  const mountainMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(def.grass[1]).offsetHSL(0.02, -0.15, -0.18),
    roughness: 1,
    flatShading: true,
  });
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2 + rnd() * 0.2;
    const dist = 380 + rnd() * 180;
    const h = 40 + rnd() * 70;
    const m = new THREE.Mesh(new THREE.ConeGeometry(28 + rnd() * 30, h, 6), mountainMat);
    m.position.set(Math.cos(ang) * dist, minY + h * 0.25, Math.sin(ang) * dist);
    m.rotation.y = rnd() * Math.PI;
    group.add(m);
  }

  // Water plane
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(340, 40),
    new THREE.MeshPhysicalMaterial({
      color: warm ? 0x3a7ea6 : 0x2a6f88,
      roughness: 0.18,
      metalness: 0.35,
      transparent: true,
      opacity: 0.72,
      transmission: 0.15,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set((minX + maxX) / 2 + 40, minY - 10, (minZ + maxZ) / 2 - 30);
  group.add(water);

  // ---- Road + shoulders
  const roadGeo = buildRibbon(pts, halfW, 0.04, path.step, 14);
  const roadTex = asphaltRoadTexture(warm);
  const road = new THREE.Mesh(
    roadGeo,
    new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.62, metalness: 0.12 }),
  );
  road.receiveShadow = true;
  group.add(road);

  const shoulderGeo = buildRibbon(pts, halfW + 3.4, -0.08, path.step, 18);
  const dirtTex = grassTexture("#6b5340", "#4a3a2a");
  dirtTex.repeat.set(1, 18);
  const shoulder = new THREE.Mesh(
    shoulderGeo,
    new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1, metalness: 0 }),
  );
  shoulder.receiveShadow = true;
  group.add(shoulder);

  const under = new THREE.Mesh(
    roadGeo.clone(),
    new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 1, side: THREE.BackSide }),
  );
  under.position.y = -1.8;
  group.add(under);

  // Start grid paint
  const gridGroup = new THREE.Group();
  for (let row = 0; row < 4; row++) {
    for (const lane of [-0.42, 0.42]) {
      const w = path.worldAt(-row * 8, lane);
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 4.2),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14 }),
      );
      tile.rotation.x = -Math.PI / 2;
      tile.rotation.z = -w.yaw;
      tile.position.set(w.x, w.y + 0.06, w.z);
      gridGroup.add(tile);
    }
  }
  group.add(gridGroup);

  // Guardrails
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0x9aa3b0, roughness: 0.28, metalness: 0.82 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2c3340, roughness: 0.4, metalness: 0.7 });
  const reflectorMat = new THREE.MeshStandardMaterial({
    color: 0xffcc33,
    emissive: 0xff9900,
    emissiveIntensity: 0.9,
  });
  for (const sign of [-1, 1] as const) {
    const cps: THREE.Vector3[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      const p = pts[i];
      const sx = Math.cos(p.yaw) * sign;
      const sz = -Math.sin(p.yaw) * sign;
      cps.push(new THREE.Vector3(p.x + sx * (halfW - 0.08), p.y + 0.48, p.z + sz * (halfW - 0.08)));
    }
    const curve = new THREE.CatmullRomCurve3(cps);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, cps.length * 2, 0.11, 6, false), barrierMat);
    rail.castShadow = true;
    group.add(rail);
    const rail2 = rail.clone();
    rail2.position.y = 0.28;
    group.add(rail2);

    for (let i = 0; i < pts.length; i += 8) {
      const p = pts[i];
      const sx = Math.cos(p.yaw) * sign;
      const sz = -Math.sin(p.yaw) * sign;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.95, 0.12), postMat);
      post.position.set(p.x + sx * (halfW - 0.05), p.y + 0.48, p.z + sz * (halfW - 0.05));
      group.add(post);
      if (i % 16 === 0) {
        const ref = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.08), reflectorMat);
        ref.position.set(p.x + sx * (halfW - 0.18), p.y + 0.72, p.z + sz * (halfW - 0.18));
        group.add(ref);
      }
    }
  }

  // ---- Vegetation (instanced)
  const trunkGeo = new THREE.CylinderGeometry(0.38, 0.58, 8, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ map: barkTexture("#5a3a24"), roughness: 0.92 });
  const leafGeo = new THREE.SphereGeometry(2.4, 8, 6);
  const leafMats = [0x2d9a45, 0x3cb85a, 0x1e7a38, 0x58c56a].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.82 }),
  );
  const palmLeafGeo = new THREE.SphereGeometry(1.8, 6, 5);
  const rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b6560, roughness: 0.95, flatShading: true });

  const treeDummy = new THREE.Object3D();
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, 220);
  trunkMesh.castShadow = true;
  const canopyMeshes = leafMats.map((m) => {
    const mesh = new THREE.InstancedMesh(leafGeo, m, 80);
    mesh.castShadow = true;
    return mesh;
  });
  const palmMesh = new THREE.InstancedMesh(
    palmLeafGeo,
    new THREE.MeshStandardMaterial({ color: 0x3dae4a, roughness: 0.8 }),
    70,
  );
  palmMesh.castShadow = true;
  const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, 90);
  rockMesh.castShadow = true;

  let ti = 0;
  let ci = [0, 0, 0, 0];
  let pi = 0;
  let ri = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const p = pts[i];
    for (const sign of [-1, 1]) {
      if (rnd() > 0.55) continue;
      const dist = halfW + 5 + rnd() * 36;
      const sx = Math.cos(p.yaw) * sign;
      const sz = -Math.sin(p.yaw) * sign;
      const x = p.x + sx * dist;
      const z = p.z + sz * dist;
      const yBase = p.y - 1.2;
      const h = 0.85 + rnd() * 1.5;
      if (ti < 220) {
        treeDummy.position.set(x, yBase + 4 * h, z);
        treeDummy.scale.set(0.85 + rnd() * 0.4, h, 0.85 + rnd() * 0.4);
        treeDummy.rotation.y = rnd() * Math.PI;
        treeDummy.updateMatrix();
        trunkMesh.setMatrixAt(ti++, treeDummy.matrix);
      }
      if (warm && rnd() > 0.45 && pi < 70) {
        treeDummy.position.set(x, yBase + 8.2 * h, z);
        treeDummy.scale.set(1.6, 0.35, 1.6);
        treeDummy.updateMatrix();
        palmMesh.setMatrixAt(pi++, treeDummy.matrix);
      } else {
        const idx = Math.floor(rnd() * 4);
        if (ci[idx] < 80) {
          treeDummy.position.set(x + (rnd() - 0.5) * 1.4, yBase + 7.4 * h, z + (rnd() - 0.5));
          const s = 0.85 + rnd() * 1.15;
          treeDummy.scale.set(s, s * (0.7 + rnd() * 0.4), s);
          treeDummy.updateMatrix();
          canopyMeshes[idx].setMatrixAt(ci[idx]++, treeDummy.matrix);
        }
      }
      if (rnd() > 0.72 && ri < 90) {
        treeDummy.position.set(x + sx * 2, yBase + 0.3, z);
        const s = 0.5 + rnd() * 1.3;
        treeDummy.scale.set(s, s * 0.7, s);
        treeDummy.rotation.set(rnd(), rnd() * 6, rnd() * 0.4);
        treeDummy.updateMatrix();
        rockMesh.setMatrixAt(ri++, treeDummy.matrix);
      }
    }
  }
  trunkMesh.count = ti;
  palmMesh.count = pi;
  rockMesh.count = ri;
  canopyMeshes.forEach((m, i) => (m.count = ci[i]));
  group.add(trunkMesh, palmMesh, rockMesh, ...canopyMeshes);

  // Light poles
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 0.35, metalness: 0.78 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: warm ? 0xffc27a : 0x9be7ff,
    emissiveIntensity: 1.6,
  });
  for (let i = 18; i < pts.length - 18; i += 28) {
    const p = pts[i];
    for (const sign of [-1, 1]) {
      const sx = Math.cos(p.yaw) * sign;
      const sz = -Math.sin(p.yaw) * sign;
      const x = p.x + sx * (halfW + 2.8);
      const z = p.z + sz * (halfW + 2.8);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 11, 8), poleMat);
      pole.position.set(x, p.y + 5.4, z);
      pole.castShadow = true;
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 0.45), lampMat);
      lamp.position.set(x - sx * 0.6, p.y + 10.8, z - sz * 0.6);
      lamp.rotation.y = p.yaw;
      group.add(lamp);
    }
  }

  // Trackside banners
  const adColors = [0x00e5ff, 0xff3b6b, 0xffd000, 0xffffff];
  for (let i = 40; i < pts.length - 40; i += 42) {
    const p = pts[i];
    const sign = i % 84 === 40 ? 1 : -1;
    const sx = Math.cos(p.yaw) * sign;
    const sz = -Math.sin(p.yaw) * sign;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.6, 5.2),
      new THREE.MeshStandardMaterial({
        color: adColors[i % adColors.length],
        emissive: adColors[i % adColors.length],
        emissiveIntensity: 0.25,
        roughness: 0.4,
      }),
    );
    board.position.set(p.x + sx * (halfW + 4.2), p.y + 1.4, p.z + sz * (halfW + 4.2));
    board.rotation.y = p.yaw;
    group.add(board);
  }

  // Waterfall for Thunder GP
  if (def.id === "thunder-falls") {
    const mid = pts[Math.floor(pts.length * 0.35)];
    const fall = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 28),
      new THREE.MeshBasicMaterial({ color: 0xbfefff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    fall.position.set(mid.x + 18, mid.y + 10, mid.z - 8);
    group.add(fall);
  }

  // ---- Features
  const featureMeshes: THREE.Object3D[] = [];
  const rampMat = new THREE.MeshStandardMaterial({
    color: 0x00d4ff,
    roughness: 0.22,
    metalness: 0.78,
    emissive: 0x0077aa,
    emissiveIntensity: 0.7,
  });

  for (const f of path.features) {
    const w = path.worldAt(f.s, f.lane);
    let obj: THREE.Object3D;

    if (f.type === "pickup") {
      const gate = new THREE.Group();
      const op = f.op ?? "+";
      const colorHex = op === "+" ? 0x00ff88 : op === "x" ? 0xffd700 : op === "-" ? 0xff7700 : 0xff0055;
      const neonMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 1.15,
        roughness: 0.12,
      });
      const pillarW = 3.4;
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 4.2, 12), neonMat);
        pillar.position.set((pillarW / 2) * side, 2.1, 0);
        gate.add(pillar);
      }
      const topBeam = new THREE.Mesh(new THREE.TorusGeometry(pillarW / 2, 0.1, 8, 20, Math.PI), neonMat);
      topBeam.rotation.z = Math.PI;
      topBeam.position.y = 4.15;
      gate.add(topBeam);

      const tex = symbolTexture(op, f.value);
      const badge = new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 1.22, 0.16, 28),
        new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.22,
          metalness: 0.25,
          emissive: colorHex,
          emissiveIntensity: 0.4,
        }),
      );
      badge.rotation.x = Math.PI / 2;
      badge.position.y = 2.35;
      badge.castShadow = true;
      badge.name = "badge";
      gate.add(badge);

      const aura = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.4, depthWrite: false }),
      );
      aura.scale.set(3, 3, 1);
      aura.position.y = 2.35;
      gate.add(aura);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.45, 0.045, 8, 28),
        new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.7 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 2.35;
      ring.name = "ring";
      gate.add(ring);

      gate.userData.spin = true;
      obj = gate;
    } else if (f.type === "ramp") {
      const rampGroup = new THREE.Group();
      const shape = new THREE.Shape();
      shape.moveTo(-2.2, 0);
      shape.lineTo(2.2, 0);
      shape.lineTo(2.2, 0.15);
      shape.lineTo(-2.2, 1.35);
      shape.closePath();
      const wedge = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3.4, bevelEnabled: false }), rampMat);
      wedge.rotation.y = Math.PI / 2;
      wedge.position.set(1.7, 0, -2.2);
      wedge.castShadow = true;
      rampGroup.add(wedge);
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(3.6, 3.2),
        new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.18 }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.04;
      rampGroup.add(glow);
      obj = rampGroup;
    } else {
      const hazard = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.32, 1.05),
        new THREE.MeshStandardMaterial({
          color: 0xff3344,
          roughness: 0.32,
          emissive: 0xcc0022,
          emissiveIntensity: 0.75,
        }),
      );
      base.position.y = 0.16;
      base.castShadow = true;
      hazard.add(base);
      for (let s = -1; s <= 1; s++) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.22, 0.55, 8),
          new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.4 }),
        );
        cone.position.set(s * 1.15, 0.55, 0);
        hazard.add(cone);
      }
      obj = hazard;
    }

    const wrap = new THREE.Group();
    wrap.position.set(w.x, w.y + 0.04, w.z);
    wrap.rotation.y = w.yaw;
    wrap.add(obj);
    wrap.userData.t0 = f.s * 0.05;
    wrap.userData.spin = obj.userData.spin;
    group.add(wrap);
    featureMeshes.push(wrap);
  }

  // Start / finish gantries
  for (const [s, title, color] of [
    [6, "START", "#5cf0ff"],
    [path.length - 10, "FINISH", "#ffd24a"],
  ] as [number, string, string][]) {
    const w = path.worldAt(s, 0);
    const bannerGroup = new THREE.Group();
    bannerGroup.position.set(w.x, w.y, w.z);
    bannerGroup.rotation.y = w.yaw;

    const tex = bannerTexture(title, color);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(def.width + 5.5, 1.7, 0.35),
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.35,
        metalness: 0.4,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.18,
      }),
    );
    bar.position.y = 7.6;
    bar.castShadow = true;
    bannerGroup.add(bar);

    for (const sign of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.4, 8.2, 10),
        new THREE.MeshStandardMaterial({ color: 0x1b212c, roughness: 0.38, metalness: 0.82 }),
      );
      post.position.set(sign * (halfW + 1.4), 4.1, 0);
      post.castShadow = true;
      bannerGroup.add(post);
    }
    group.add(bannerGroup);
  }

  return { group, featureMeshes };
}
