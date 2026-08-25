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

function loadTex(url: string, repeatS = 1, repeatT = 1) {
  const t = new THREE.TextureLoader().load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatS, repeatT);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function markingsTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 1024;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 512, 1024);

  const kerb = 26;
  for (let y = 0; y < 1024; y += 32) {
    g.fillStyle = (y / 32) % 2 === 0 ? "#d92b2b" : "#f4f4f4";
    g.fillRect(0, y, kerb, 32);
    g.fillRect(512 - kerb, y, kerb, 32);
  }
  g.fillStyle = "rgba(255,255,255,0.92)";
  g.fillRect(kerb, 0, 5, 1024);
  g.fillRect(507 - kerb, 0, 5, 1024);
  g.fillStyle = "#e6c84a";
  g.fillRect(250, 0, 3, 1024);
  g.fillRect(259, 0, 3, 1024);
  g.fillStyle = "rgba(255,255,255,0.78)";
  for (let y = 0; y < 1024; y += 48) {
    g.fillRect(138, y, 4, 26);
    g.fillRect(370, y, 4, 26);
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function symbolTexture(op: PickupOp, value: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const label = op === "x" ? `×${value}` : op === "÷" ? `÷${value}` : `${op}${value}`;
  const core = op === "+" ? "#3dff9a" : op === "x" ? "#ffd24a" : op === "-" ? "#ff8a2a" : "#ff3d7a";
  const glow = g.createRadialGradient(128, 128, 10, 128, 128, 124);
  glow.addColorStop(0, core);
  glow.addColorStop(0.5, `${core}44`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, 256, 256);
  g.beginPath();
  g.arc(128, 128, 74, 0, Math.PI * 2);
  g.fillStyle = "rgba(8,12,18,0.8)";
  g.fill();
  g.lineWidth = 9;
  g.strokeStyle = core;
  g.stroke();
  g.font = "900 88px Arial Black, Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#fff";
  g.fillText(label, 128, 136);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
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

function stamp(
  dummy: THREE.Object3D,
  mesh: THREE.InstancedMesh,
  i: number,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  ry = 0,
  rx = 0,
  rz = 0,
) {
  dummy.position.set(x, y, z);
  dummy.scale.set(sx, sy, sz);
  dummy.rotation.set(rx, ry, rz);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
}

export function buildWorld(scene: THREE.Scene, path: TrackPath) {
  const def = path.def;
  const group = new THREE.Group();
  scene.add(group);
  const pts = path.points;
  const halfW = def.width / 2;
  const rnd = mulberry32(def.seed);
  const warm = def.id === "sunset-lagoon";

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(860, 28, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(warm ? "#f2b06a" : "#7ec8f0") },
        mid: { value: new THREE.Color(warm ? "#ffd7a8" : "#cfe9f8") },
        bottom: { value: new THREE.Color(warm ? "#ffe8c8" : "#e7f3ea") },
        sunDir: { value: new THREE.Vector3(0.35, 0.62, 0.4).normalize() },
      },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 sunDir;
        void main(){
          vec3 n = normalize(vP);
          float h = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = mix(bottom, mid, smoothstep(0.28, 0.52, h));
          col = mix(col, top, smoothstep(0.52, 0.95, h));
          float sun = pow(max(0.0, dot(n, sunDir)), 80.0);
          float halo = pow(max(0.0, dot(n, sunDir)), 8.0);
          col += vec3(1.0, 0.93, 0.75) * sun * 1.6;
          col += vec3(1.0, 0.82, 0.5) * halo * 0.28;
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  scene.add(sky);

  const cloudMat = new THREE.SpriteMaterial({
    map: new THREE.TextureLoader().load("/tex/cloud.png"),
    transparent: true,
    depthWrite: false,
    opacity: 0.72,
    color: warm ? 0xffe0c4 : 0xffffff,
  });
  for (let i = 0; i < 10; i++) {
    const spr = new THREE.Sprite(cloudMat);
    const ang = rnd() * Math.PI * 2;
    const dist = 180 + rnd() * 260;
    spr.position.set(Math.cos(ang) * dist, 55 + rnd() * 40, Math.sin(ang) * dist);
    const s = 28 + rnd() * 36;
    spr.scale.set(s, s * 0.55, 1);
    group.add(spr);
  }

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

  const pad = 200;
  const tw = maxX - minX + pad * 2;
  const td = maxZ - minZ + pad * 2;
  const terrainGeo = new THREE.PlaneGeometry(tw, td, 48, 48);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  const sampleStep = Math.max(1, Math.floor(pts.length / 110));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + (minX + maxX) / 2;
    const z = pos.getZ(i) + (minZ + maxZ) / 2;
    let nearest = 1e9;
    let ty = minY;
    for (let k = 0; k < pts.length; k += sampleStep) {
      const p = pts[k];
      const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
      if (d < nearest) {
        nearest = d;
        ty = p.y;
      }
    }
    const dist = Math.sqrt(nearest);
    let h = ty - 0.55;
    if (dist > halfW + 6) {
      const t = Math.min(1, (dist - halfW - 6) / 55);
      const n =
        Math.sin(x * 0.012) * 2.4 +
        Math.sin(z * 0.01 + 1.7) * 2.1 +
        Math.sin(x * 0.031 + z * 0.02) * 1.3;
      h += n * t * t;
    }
    pos.setXYZ(i, x, h, z);
  }
  pos.needsUpdate = true;
  terrainGeo.computeVertexNormals();
  const grass = loadTex("/tex/grass.jpg", 42, 42);
  const terrain = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95, metalness: 0 }),
  );
  terrain.receiveShadow = true;
  group.add(terrain);

  const rockTex = loadTex("/tex/rock.jpg", 3, 2);
  const hillMat = new THREE.MeshStandardMaterial({ map: rockTex, roughness: 0.92, metalness: 0.04 });
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + rnd() * 0.15;
    const dist = 300 + rnd() * 90;
    const h = 22 + rnd() * 28;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), hillMat);
    m.position.set(Math.cos(ang) * dist, minY + h * 0.15, Math.sin(ang) * dist);
    m.scale.set(18 + rnd() * 14, h, 18 + rnd() * 14);
    m.rotation.y = rnd() * Math.PI;
    group.add(m);
  }

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(280, 48),
    new THREE.MeshPhysicalMaterial({
      color: warm ? 0x3d6f86 : 0x2d6a78,
      roughness: 0.22,
      metalness: 0.15,
      transparent: true,
      opacity: 0.78,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set((minX + maxX) / 2 + 30, minY - 7.5, (minZ + maxZ) / 2 - 20);
  group.add(water);

  const asphalt = loadTex("/tex/asphalt.jpg", 1, 18);
  const road = new THREE.Mesh(
    buildRibbon(pts, halfW, 0.07, path.step, 14),
    new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.78, metalness: 0.06 }),
  );
  road.receiveShadow = true;
  group.add(road);

  const marks = new THREE.Mesh(
    buildRibbon(pts, halfW, 0.085, path.step, 14),
    new THREE.MeshBasicMaterial({ map: markingsTexture(), transparent: true, depthWrite: false }),
  );
  group.add(marks);

  const dirt = loadTex("/tex/dirt.jpg", 1, 16);
  const shoulder = new THREE.Mesh(
    buildRibbon(pts, halfW + 3.2, -0.02, path.step, 16),
    new THREE.MeshStandardMaterial({ map: dirt, roughness: 1, metalness: 0 }),
  );
  shoulder.receiveShadow = true;
  group.add(shoulder);

  const railMat = new THREE.MeshStandardMaterial({ color: 0xa8b0ba, roughness: 0.32, metalness: 0.72 });
  for (const sign of [-1, 1] as const) {
    const cps: THREE.Vector3[] = [];
    for (let i = 0; i < pts.length; i += 3) {
      const p = pts[i];
      const sx = Math.cos(p.yaw) * sign;
      const sz = -Math.sin(p.yaw) * sign;
      cps.push(new THREE.Vector3(p.x + sx * (halfW - 0.15), p.y + 0.4, p.z + sz * (halfW - 0.15)));
    }
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cps), cps.length, 0.075, 5, false), railMat));
  }

  const dummy = new THREE.Object3D();
  const bark = loadTex("/tex/bark.jpg", 1, 2);
  const leaf = loadTex("/tex/leaves.jpg", 1, 1);
  const TREE_N = 110;
  const CAN_N = TREE_N * 3;
  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.32, 0.5, 8, 7),
    new THREE.MeshStandardMaterial({ map: bark, roughness: 0.92 }),
    TREE_N,
  );
  const canopyMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1.85, 8, 6),
    new THREE.MeshStandardMaterial({ map: leaf, roughness: 0.85 }),
    CAN_N,
  );
  trunkMesh.castShadow = true;
  canopyMesh.castShadow = true;
  const rockMesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.75, 0),
    new THREE.MeshStandardMaterial({ map: rockTex, roughness: 0.95 }),
    50,
  );

  let ti = 0;
  let ci = 0;
  let ri = 0;
  for (let i = 0; i < pts.length; i += 5) {
    const p = pts[i];
    for (const sign of [-1, 1]) {
      if (rnd() > 0.7 || ti >= TREE_N) continue;
      const dist = halfW + 13 + rnd() * 26;
      const sx = Math.cos(p.yaw) * sign;
      const sz = -Math.sin(p.yaw) * sign;
      const x = p.x + sx * dist;
      const z = p.z + sz * dist;
      const h = 0.85 + rnd() * 0.55;
      const yaw = rnd() * Math.PI * 2;
      stamp(dummy, trunkMesh, ti, x, p.y - 0.2 + 4 * h, z, 0.9, h, 0.9, yaw);
      for (let k = 0; k < 3 && ci < CAN_N; k++) {
        const ox = (rnd() - 0.5) * 1.6;
        const oz = (rnd() - 0.5) * 1.6;
        const s = 0.85 + rnd() * 0.45;
        stamp(dummy, canopyMesh, ci++, x + ox, p.y - 0.2 + 7.4 * h + rnd() * 0.6, z + oz, s, s * 0.72, s, yaw);
      }
      ti++;
      if (ri < 50 && rnd() > 0.72) {
        stamp(dummy, rockMesh, ri++, x + sx * 2.2, p.y - 0.05, z, 0.7 + rnd() * 0.8, 0.45 + rnd() * 0.4, 0.7 + rnd() * 0.8, rnd() * 6, rnd() * 0.4, rnd() * 0.3);
      }
    }
  }
  trunkMesh.count = ti;
  canopyMesh.count = ci;
  rockMesh.count = ri;
  group.add(trunkMesh, canopyMesh, rockMesh);

  const featureMeshes: THREE.Object3D[] = [];
  for (const f of path.features) {
    const w = path.worldAt(f.s, f.lane);
    const wrap = new THREE.Group();
    wrap.position.set(w.x, w.y + 0.06, w.z);
    wrap.rotation.y = w.yaw;

    if (f.type === "pickup") {
      const op = f.op ?? "+";
      const colorHex = op === "+" ? 0x3dff9a : op === "x" ? 0xffd24a : op === "-" ? 0xff8a2a : 0xff3d7a;
      const gate = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.06, 8, 18), new THREE.MeshBasicMaterial({ color: colorHex }));
      ring.rotation.y = Math.PI / 2;
      ring.position.y = 1.25;
      ring.name = "ring";
      gate.add(ring);
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: symbolTexture(op, f.value), transparent: true, depthWrite: false }));
      badge.scale.set(1.55, 1.55, 1);
      badge.position.y = 1.25;
      badge.name = "badge";
      gate.add(badge);
      gate.userData.spin = true;
      wrap.add(gate);
    } else if (f.type === "ramp") {
      const ramp = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.28, 3.0),
        new THREE.MeshStandardMaterial({ color: 0x2ad4ff, emissive: 0x1488aa, emissiveIntensity: 0.4, roughness: 0.4 }),
      );
      ramp.rotation.x = -0.36;
      ramp.position.set(0, 0.32, 0);
      wrap.add(ramp);
    } else {
      const haz = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.24, 0.85),
        new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xaa0022, emissiveIntensity: 0.45 }),
      );
      haz.position.y = 0.14;
      wrap.add(haz);
    }
    wrap.userData.t0 = f.s * 0.05;
    wrap.userData.spin = wrap.children[0]?.userData.spin;
    group.add(wrap);
    featureMeshes.push(wrap);
  }

  for (const [s, color] of [
    [5, 0x5cf0ff],
    [path.length - 8, 0xffd24a],
  ] as [number, number][]) {
    const w = path.worldAt(s, 0);
    const gantry = new THREE.Group();
    gantry.position.set(w.x, w.y, w.z);
    gantry.rotation.y = w.yaw;
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(def.width + 3.2, 0.9, 0.24),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.28, roughness: 0.4 }),
    );
    bar.position.y = 6.1;
    gantry.add(bar);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.2, 6.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x222831, metalness: 0.7, roughness: 0.38 }),
      );
      post.position.set(side * (halfW + 1.05), 3.1, 0);
      gantry.add(post);
    }
    group.add(gantry);
  }

  return { group, featureMeshes };
}
