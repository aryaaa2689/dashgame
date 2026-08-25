import * as THREE from "three";
import { TrackPath, Feature } from "@/lib/track";

function checkerTexture(a: string, b: string) {
  // Lush mobile-runner style turf, inspired by the reference: a clear green
  // checker ribbon with visible blade fibers and soft mowing streaks.
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const cols = 4;
  const rows = 8;
  const cw = c.width / cols;
  const ch = c.height / rows;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const light = (x + y) % 2 === 0;
      const grad = g.createLinearGradient(0, y * ch, 0, (y + 1) * ch);
      grad.addColorStop(0, light ? "#74df58" : "#34ad38");
      grad.addColorStop(1, light ? a : b);
      g.fillStyle = grad;
      g.fillRect(x * cw, y * ch, cw, ch);
    }
  }

  // vertical turf fibers, like the screenshot's soft racing-lawn surface
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 3 + Math.random() * 10;
    const alpha = 0.06 + Math.random() * 0.14;
    g.strokeStyle = Math.random() > 0.55 ? `rgba(255,255,210,${alpha})` : `rgba(0,80,18,${alpha})`;
    g.lineWidth = 0.7 + Math.random() * 0.8;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 1.6, y + len);
    g.stroke();
  }

  // subtle longitudinal highlight down the driving line
  const center = g.createLinearGradient(0, 0, 512, 0);
  center.addColorStop(0, "rgba(255,255,255,0)");
  center.addColorStop(0.48, "rgba(255,255,210,0.13)");
  center.addColorStop(0.52, "rgba(255,255,210,0.13)");
  center.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = center;
  g.fillRect(0, 0, 512, 512);

  // crisp-but-soft checker grid definition
  g.strokeStyle = "rgba(255,255,255,0.055)";
  g.lineWidth = 2;
  for (let x = 1; x < cols; x++) {
    g.beginPath();
    g.moveTo(x * cw, 0);
    g.lineTo(x * cw, 512);
    g.stroke();
  }
  for (let y = 1; y < rows; y++) {
    g.beginPath();
    g.moveTo(0, y * ch);
    g.lineTo(512, y * ch);
    g.stroke();
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 12;
  return t;
}

function barkTexture(hex: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const base = new THREE.Color(hex);
  g.fillStyle = `#${base.getHexString()}`;
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 128;
    const w = 2 + Math.random() * 5;
    const shade = base.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.16);
    g.fillStyle = `#${shade.getHexString()}`;
    g.fillRect(x, 0, w, 128);
  }
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 1, 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// canvas badge texture showing an arithmetic symbol, e.g. "+3", "-2", "x3"
function symbolTexture(op: "+" | "-" | "x", value: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const label = op === "x" ? `×${value}` : `${op}${value}`;
  const palette =
    op === "+"
      ? { core: "#ffdf55", rim: "#6dffbc", shadow: "#1b3b20" }
      : op === "-"
        ? { core: "#ff5368", rim: "#ffb0b8", shadow: "#4d0010" }
        : { core: "#ff9f2e", rim: "#ffe6a3", shadow: "#4b2500" };

  g.clearRect(0, 0, 256, 256);
  const glow = g.createRadialGradient(128, 128, 18, 128, 128, 128);
  glow.addColorStop(0, palette.core);
  glow.addColorStop(0.46, `${palette.core}88`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, 256, 256);

  const verts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
    verts.push([128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96]);
  }
  g.beginPath();
  verts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  const face = g.createLinearGradient(58, 48, 198, 216);
  face.addColorStop(0, "rgba(255,255,255,0.82)");
  face.addColorStop(0.18, palette.rim);
  face.addColorStop(0.55, palette.core);
  face.addColorStop(1, "rgba(20,28,24,0.9)");
  g.fillStyle = face;
  g.fill();
  g.lineWidth = 9;
  g.shadowColor = palette.core;
  g.shadowBlur = 22;
  g.strokeStyle = "rgba(255,255,255,0.88)";
  g.stroke();
  g.shadowBlur = 0;

  // inner glass reflection and circuit detail
  g.globalAlpha = 0.45;
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.ellipse(108, 82, 54, 20, -0.35, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  g.strokeStyle = "rgba(255,255,255,0.22)";
  g.lineWidth = 2;
  for (const y of [72, 184]) {
    g.beginPath();
    g.moveTo(62, y);
    g.lineTo(194, y);
    g.stroke();
  }

  g.font = "900 108px Arial Black, Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 14;
  g.strokeStyle = palette.shadow;
  g.strokeText(label, 128, 139);
  g.fillStyle = "#ffffff";
  g.fillText(label, 128, 139);

  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

export function buildWorld(scene: THREE.Scene, path: TrackPath) {
  const def = path.def;
  const group = new THREE.Group();
  scene.add(group);

  // ---- sky dome
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(def.sky[0]) },
      bottom: { value: new THREE.Color(def.sky[1]) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){ float h = clamp(vP.y/700.0*0.5+0.5,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h),1.0);} `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // ---- track ribbon
  const halfW = def.width / 2;
  const pts = path.points;
  const positions: number[] = [];
  const uvs: number[] = [];
  const normalsHint: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const sx = Math.cos(p.yaw);
    const sz = -Math.sin(p.yaw);
    positions.push(p.x - sx * halfW, p.y, p.z - sz * halfW);
    positions.push(p.x + sx * halfW, p.y, p.z + sz * halfW);
    const v = (i * path.step) / 7;
    uvs.push(0, v, 1, v);
    normalsHint.push(0, 1, 0, 0, 1, 0);
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
  const tex = checkerTexture(def.grass[0], def.grass[1]);
  const road = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0 }),
  );
  road.receiveShadow = true;
  group.add(road);

  // underside slab (dirt/root texture look)
  const under = new THREE.Mesh(
    geo.clone(),
    new THREE.MeshStandardMaterial({ color: 0x2a1b12, roughness: 1, side: THREE.BackSide }),
  );
  under.position.y = -1.6;
  group.add(under);

  // ---- side barriers: chunky rounded clay/wood rails like the reference image
  const barkTex = barkTexture(def.wall);
  barkTex.repeat.set(1, 28);
  const wallMat = new THREE.MeshStandardMaterial({
    map: barkTex,
    color: 0xb45f36,
    roughness: 0.78,
    metalness: 0.0,
  });
  const topHighlightMat = new THREE.MeshStandardMaterial({
    color: 0xd77a45,
    roughness: 0.8,
    metalness: 0,
  });
  for (const sign of [-1, 1]) {
    const cps: THREE.Vector3[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      const p = pts[i];
      const sx = Math.cos(p.yaw) * sign;
      const sz = -Math.sin(p.yaw) * sign;
      cps.push(new THREE.Vector3(p.x + sx * (halfW - 0.05), p.y + 0.42, p.z + sz * (halfW - 0.05)));
    }
    const curve = new THREE.CatmullRomCurve3(cps);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, cps.length * 2, 1.08, 18, false),
      wallMat,
    );
    tube.castShadow = true;
    tube.receiveShadow = true;
    group.add(tube);

    // warm bevel highlight so the rail reads as rounded and polished rather than flat
    const lip = new THREE.Mesh(new THREE.TubeGeometry(curve, cps.length * 2, 0.28, 12, false), topHighlightMat);
    lip.scale.set(1, 0.5, 1);
    lip.position.y = 0.66;
    lip.castShadow = true;
    group.add(lip);
  }

  // ---- jungle scenery
  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.5, 6, 9);
  const trunkTex = barkTexture("#6b4326");
  trunkTex.repeat.set(1, 3);
  const trunkMat = new THREE.MeshStandardMaterial({ map: trunkTex, roughness: 0.95 });
  const leafGeo = new THREE.SphereGeometry(2.2, 12, 10);
  const leafMats = [0x2f9e4a, 0x39b356, 0x1f7f3c, 0x53c765].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: false }),
  );
  const palmLeafGeo = new THREE.ConeGeometry(0.7, 4.2, 6, 1, true);

  let rs = 1;
  const rnd = () => {
    rs = (rs * 16807) % 2147483647;
    return rs / 2147483647;
  };

  const scenery = new THREE.Group();
  for (let i = 0; i < pts.length; i += 3) {
    const p = pts[i];
    for (const sign of [-1, 1]) {
      if (rnd() > 0.46) continue;
      const dist = halfW + 2 + rnd() * 22;
      const sx = Math.cos(p.yaw) * sign;
      const sz = -Math.sin(p.yaw) * sign;
      const x = p.x + sx * dist;
      const z = p.z + sz * dist;
      const yBase = p.y - 3 - rnd() * 8;
      const kind = rnd();
      if (kind < 0.45) {
        const t = new THREE.Mesh(trunkGeo, trunkMat);
        t.castShadow = true;
        const h = 1 + rnd() * 1.5;
        t.scale.set(1, h, 1);
        t.position.set(x, yBase + 3 * h, z);
        scenery.add(t);
        const canopy = new THREE.Mesh(leafGeo, leafMats[Math.floor(rnd() * leafMats.length)]);
        canopy.castShadow = true;
        canopy.position.set(x, yBase + 6 * h, z);
        canopy.scale.setScalar(0.8 + rnd() * 1.1);
        scenery.add(canopy);
      } else if (kind < 0.75) {
        // palm
        const lean = (rnd() - 0.5) * 0.5;
        const t = new THREE.Mesh(trunkGeo, trunkMat);
        t.castShadow = true;
        const h = 1.6 + rnd() * 1.6;
        t.scale.set(0.6, h, 0.6);
        t.position.set(x, yBase + 3 * h, z);
        t.rotation.z = lean;
        scenery.add(t);
        const top = new THREE.Group();
        top.position.set(x + Math.sin(lean) * 3 * h, yBase + 6 * h, z);
        for (let k = 0; k < 6; k++) {
          const leaf = new THREE.Mesh(palmLeafGeo, leafMats[k % leafMats.length]);
          const holder = new THREE.Group();
          holder.rotation.y = (k / 6) * Math.PI * 2;
          leaf.position.set(1.8, 0, 0);
          leaf.rotation.set(0, 0, -Math.PI / 2 + 0.35);
          holder.add(leaf);
          top.add(holder);
        }
        scenery.add(top);
      } else {
        const bush = new THREE.Mesh(leafGeo, leafMats[Math.floor(rnd() * leafMats.length)]);
        bush.position.set(x, p.y - 0.5 - rnd() * 2, z);
        bush.scale.set(0.5 + rnd() * 0.7, 0.35 + rnd() * 0.4, 0.5 + rnd() * 0.7);
        scenery.add(bush);
      }
    }
  }
  // distant hills
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x86c9a5, roughness: 1, fog: true });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const r = 260 + rnd() * 160;
    const h = new THREE.Mesh(new THREE.ConeGeometry(70 + rnd() * 60, 90 + rnd() * 110, 7), hillMat);
    const mid = pts[Math.floor(pts.length / 2)];
    h.position.set(mid.x + Math.cos(a) * r, mid.y - 40, mid.z + Math.sin(a) * r);
    scenery.add(h);
  }
  group.add(scenery);

  // ---- feature props: arithmetic pickup badges, ramps and bumps
  const featureMeshes: THREE.Object3D[] = [];
  const rampMat = new THREE.MeshStandardMaterial({
    color: 0x303744,
    roughness: 0.34,
    metalness: 0.72,
    emissive: 0x1b2b32,
    emissiveIntensity: 0.35,
  });
  const bumpMat = new THREE.MeshStandardMaterial({
    color: 0xff4960,
    roughness: 0.42,
    metalness: 0.22,
    emissive: 0x3d0010,
    emissiveIntensity: 0.5,
  });

  for (const f of path.features) {
    const w = path.worldAt(f.s, f.lane);
    let obj: THREE.Object3D;
    if (f.type === "pickup") {
      const g = new THREE.Group();
      const tex = symbolTexture(f.op ?? "+", f.value);
      const coin = new THREE.Mesh(
        new THREE.CylinderGeometry(1.05, 1.05, 0.16, 28),
        new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.3,
          metalness: 0.3,
          emissive: f.op === "-" ? 0x330006 : 0x2a1a00,
          emissiveIntensity: 0.25,
        }),
      );
      coin.rotation.x = Math.PI / 2;
      coin.position.y = 1.15;
      coin.castShadow = true;
      g.add(coin);
      const haloColor = f.op === "-" ? 0xff5368 : f.op === "x" ? 0xffb13b : 0x66ffc0;
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(1.42, 0.045, 8, 42),
        new THREE.MeshBasicMaterial({ color: haloColor, transparent: true, opacity: 0.72 }),
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 1.15;
      g.add(halo);
      // soft glow disc behind
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        }),
      );
      glow.scale.set(2.6, 2.6, 1);
      glow.position.y = 1.15;
      g.add(glow);
      g.userData.spin = true;
      g.userData.bob = true;
      obj = g;
    } else if (f.type === "ramp") {
      const wedge = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 3.2, 3, 1), rampMat);
      wedge.rotation.z = Math.PI / 2;
      wedge.rotation.y = Math.PI / 2;
      wedge.position.y = -1.05;
      wedge.castShadow = true;
      const holder = new THREE.Group();
      holder.add(wedge);
      const stripMat = new THREE.MeshBasicMaterial({ color: 0x7fe7ff });
      for (const x of [-1.15, 1.15]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.8), stripMat);
        strip.position.set(x, 0.18, 0);
        holder.add(strip);
      }
      obj = holder;
    } else {
      const hazard = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.26, 1.0), bumpMat);
      base.position.y = 0.18;
      base.castShadow = true;
      hazard.add(base);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffd65a });
      for (const x of [-0.72, 0, 0.72]) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.62, 4), stripeMat);
        spike.position.set(x, 0.62, 0);
        spike.rotation.y = Math.PI / 4;
        hazard.add(spike);
      }
      obj = hazard;
    }
    const wrap = new THREE.Group();
    wrap.position.set(w.x, w.y + 0.05, w.z);
    wrap.rotation.y = w.yaw;
    wrap.add(obj);
    wrap.userData.spin = f.type === "pickup";
    wrap.userData.t0 = f.s * 0.05;
    group.add(wrap);
    featureMeshes.push(wrap);
  }

  // start / finish banners
  for (const [s, color] of [
    [4, 0x3ad1ff],
    [path.length - 6, 0xffd93d],
  ] as [number, number][]) {
    const w = path.worldAt(s, 0);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(def.width + 2, 0.9, 0.6),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 }),
    );
    bar.position.set(w.x, w.y + 6.5, w.z);
    bar.rotation.y = w.yaw;
    bar.castShadow = true;
    group.add(bar);
    for (const sign of [-1, 1]) {
      const wp = path.worldAt(s, sign * 1.02);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 7, 10),
        new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 }),
      );
      post.position.set(wp.x, wp.y + 3.3, wp.z);
      post.castShadow = true;
      group.add(post);
    }
  }

  return { group, featureMeshes };
}
