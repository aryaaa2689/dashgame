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

function asphaltTexture(warm = 0) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d")!;
  const b = 32 + warm * 8;
  g.fillStyle = `rgb(${b + 6},${b},${b - 2})`;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8000; i++) {
    const s = Math.random() > 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${s},${s},${s},${Math.random() * 0.07})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  const kerb = 28;
  for (let y = 0; y < 512; y += 28) {
    g.fillStyle = (y / 28) % 2 === 0 ? "#e23b3b" : "#f3f3f3";
    g.fillRect(0, y, kerb, 28);
    g.fillRect(512 - kerb, y, kerb, 28);
  }
  g.fillStyle = "rgba(255,255,255,0.9)";
  g.fillRect(kerb, 0, 5, 512);
  g.fillRect(507 - kerb, 0, 5, 512);
  g.fillStyle = "#f0c94a";
  g.fillRect(250, 0, 3, 512);
  g.fillRect(259, 0, 3, 512);
  g.fillStyle = "rgba(255,255,255,0.7)";
  for (let y = 0; y < 512; y += 42) {
    g.fillRect(140, y, 4, 24);
    g.fillRect(368, y, 4, 24);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function grassTexture(a: string, b: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = a;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++) {
    g.fillStyle = Math.random() > 0.5 ? b : a;
    g.globalAlpha = 0.4;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 5);
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 2;
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
  glow.addColorStop(0.45, `${core}55`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, 256, 256);
  g.beginPath();
  g.arc(128, 128, 78, 0, Math.PI * 2);
  g.fillStyle = "rgba(8,12,18,0.82)";
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = core;
  g.stroke();
  g.font = "900 92px Arial Black, Arial, sans-serif";
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

export function buildWorld(scene: THREE.Scene, path: TrackPath) {
  const def = path.def;
  const group = new THREE.Group();
  scene.add(group);
  const pts = path.points;
  const halfW = def.width / 2;
  const rnd = mulberry32(def.seed);
  const warm = def.id === "sunset-lagoon" ? 1 : 0;

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 20, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(def.sky[0]) },
        bottom: { value: new THREE.Color(def.sky[1]) },
      },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 bottom;
        void main(){
          float h = clamp(normalize(vP).y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = mix(bottom, top, pow(h, 0.85));
          col += vec3(1.0, 0.78, 0.4) * exp(-abs(h - 0.45) * 12.0) * 0.22;
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  scene.add(sky);

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

  const pad = 180;
  const tw = maxX - minX + pad * 2;
  const td = maxZ - minZ + pad * 2;
  const terrainGeo = new THREE.PlaneGeometry(tw, td, 36, 36);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  const sampleStep = Math.max(1, Math.floor(pts.length / 90));
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
    let h = ty - 0.85;
    if (dist > halfW + 4) {
      const t = Math.min(1, (dist - halfW - 4) / 40);
      h += (Math.sin(x * 0.02) + Math.sin(z * 0.016)) * 3.2 * t * t;
    }
    pos.setXYZ(i, x, h, z);
  }
  pos.needsUpdate = true;
  terrainGeo.computeVertexNormals();
  const grassTex = grassTexture(def.grass[0], def.grass[1]);
  grassTex.repeat.set(18, 18);
  const terrain = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshLambertMaterial({ map: grassTex, color: 0xcfd8c8 }),
  );
  terrain.receiveShadow = true;
  group.add(terrain);

  const hillMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(def.grass[1]).offsetHSL(0.02, -0.2, -0.16),
  });
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2;
    const dist = 340 + rnd() * 80;
    const h = 28 + rnd() * 36;
    const m = new THREE.Mesh(new THREE.ConeGeometry(22 + rnd() * 16, h, 5), hillMat);
    m.position.set(Math.cos(ang) * dist, minY + h * 0.2, Math.sin(ang) * dist);
    group.add(m);
  }

  const road = new THREE.Mesh(
    buildRibbon(pts, halfW, 0.06, path.step, 12),
    new THREE.MeshStandardMaterial({ map: asphaltTexture(warm), roughness: 0.68, metalness: 0.08 }),
  );
  road.receiveShadow = true;
  group.add(road);

  const shoulder = new THREE.Mesh(
    buildRibbon(pts, halfW + 2.6, -0.04, path.step, 16),
    new THREE.MeshLambertMaterial({ color: 0x5a4a38 }),
  );
  shoulder.receiveShadow = true;
  group.add(shoulder);

  const railMat = new THREE.MeshStandardMaterial({ color: 0xb4bcc8, roughness: 0.3, metalness: 0.75 });
  for (const sign of [-1, 1] as const) {
    const cps: THREE.Vector3[] = [];
    for (let i = 0; i < pts.length; i += 3) {
      const p = pts[i];
      const sx = Math.cos(p.yaw) * sign;
      const sz = -Math.sin(p.yaw) * sign;
      cps.push(new THREE.Vector3(p.x + sx * (halfW - 0.12), p.y + 0.42, p.z + sz * (halfW - 0.12)));
    }
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cps), cps.length, 0.09, 5, false), railMat);
    group.add(rail);
  }

  // Upright trees only — always reset the dummy transform
  const dummy = new THREE.Object3D();
  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.28, 0.42, 6.4, 6),
    new THREE.MeshLambertMaterial({ color: 0x5a3d28 }),
    140,
  );
  const canopyMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(2.1, 7, 5),
    new THREE.MeshLambertMaterial({ color: 0x2f9e48 }),
    140,
  );
  const rockMesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.7, 0),
    new THREE.MeshLambertMaterial({ color: 0x6e6862 }),
    40,
  );

  let ti = 0;
  let ri = 0;
  for (let i = 0; i < pts.length; i += 4) {
    const p = pts[i];
    for (const sign of [-1, 1]) {
      if (rnd() > 0.62 || ti >= 140) continue;
      const dist = halfW + 11 + rnd() * 28;
      const sx = Math.cos(p.yaw) * sign;
      const sz = -Math.sin(p.yaw) * sign;
      const x = p.x + sx * dist;
      const z = p.z + sz * dist;
      const h = 0.75 + rnd() * 0.55;
      dummy.position.set(x, p.y - 0.4 + 3.2 * h, z);
      dummy.scale.set(0.85, h, 0.85);
      dummy.rotation.set(0, rnd() * Math.PI, 0);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(ti, dummy.matrix);

      dummy.position.set(x, p.y - 0.4 + 6.2 * h, z);
      dummy.scale.set(0.9 + rnd() * 0.35, 0.7 + rnd() * 0.25, 0.9 + rnd() * 0.35);
      dummy.rotation.set(0, rnd() * Math.PI, 0);
      dummy.updateMatrix();
      canopyMesh.setMatrixAt(ti, dummy.matrix);
      ti++;

      if (ri < 40 && rnd() > 0.78) {
        dummy.position.set(x + sx * 2.4, p.y - 0.15, z);
        dummy.scale.setScalar(0.6 + rnd() * 0.7);
        dummy.rotation.set(rnd() * 0.4, rnd() * 6, rnd() * 0.3);
        dummy.updateMatrix();
        rockMesh.setMatrixAt(ri++, dummy.matrix);
      }
    }
  }
  trunkMesh.count = ti;
  canopyMesh.count = ti;
  rockMesh.count = ri;
  group.add(trunkMesh, canopyMesh, rockMesh);

  const featureMeshes: THREE.Object3D[] = [];
  for (const f of path.features) {
    const w = path.worldAt(f.s, f.lane);
    const wrap = new THREE.Group();
    wrap.position.set(w.x, w.y + 0.05, w.z);
    wrap.rotation.y = w.yaw;

    if (f.type === "pickup") {
      const op = f.op ?? "+";
      const colorHex = op === "+" ? 0x3dff9a : op === "x" ? 0xffd24a : op === "-" ? 0xff8a2a : 0xff3d7a;
      const gate = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: colorHex });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.07, 8, 20), mat);
      ring.rotation.y = Math.PI / 2;
      ring.position.y = 1.35;
      ring.name = "ring";
      gate.add(ring);
      const tex = symbolTexture(op, f.value);
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      badge.scale.set(1.7, 1.7, 1);
      badge.position.y = 1.35;
      badge.name = "badge";
      gate.add(badge);
      gate.userData.spin = true;
      wrap.add(gate);
    } else if (f.type === "ramp") {
      const ramp = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 0.35, 3.2),
        new THREE.MeshStandardMaterial({ color: 0x2ad4ff, emissive: 0x1488aa, emissiveIntensity: 0.45, roughness: 0.35 }),
      );
      ramp.rotation.x = -0.38;
      ramp.position.set(0, 0.35, 0);
      wrap.add(ramp);
    } else {
      const haz = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.28, 0.9),
        new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xaa0022, emissiveIntensity: 0.5 }),
      );
      haz.position.y = 0.16;
      wrap.add(haz);
    }

    wrap.userData.t0 = f.s * 0.05;
    wrap.userData.spin = wrap.children[0]?.userData.spin;
    group.add(wrap);
    featureMeshes.push(wrap);
  }

  for (const [s, title, color] of [
    [5, "START", 0x5cf0ff],
    [path.length - 8, "FINISH", 0xffd24a],
  ] as [number, string, number][]) {
    const w = path.worldAt(s, 0);
    const g = new THREE.Group();
    g.position.set(w.x, w.y, w.z);
    g.rotation.y = w.yaw;
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(def.width + 3.5, 1.1, 0.28),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.4 }),
    );
    bar.position.y = 6.4;
    g.add(bar);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 6.6, 8),
        new THREE.MeshStandardMaterial({ color: 0x1b212c, metalness: 0.7, roughness: 0.4 }),
      );
      post.position.set(side * (halfW + 1.1), 3.3, 0);
      g.add(post);
    }
    group.add(g);
  }

  return { group, featureMeshes };
}
