import * as THREE from "three";
import { TrackPath, Feature } from "@/lib/track";

function checkerTexture(a: string, b: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = a;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = b;
  g.fillRect(0, 0, 128, 128);
  g.fillRect(128, 128, 128, 128);
  // blade-like grass strokes for a more real turf look
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const shade = Math.random() * 0.16 - 0.08;
    g.strokeStyle = `rgba(0,${shade > 0 ? 40 : 0},0,${Math.abs(shade)})`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 3, y - 4 - Math.random() * 4);
    g.stroke();
  }
  // soft vignette per tile edge for definition
  g.strokeStyle = "rgba(0,0,0,0.08)";
  g.lineWidth = 2;
  g.strokeRect(1, 1, 254, 254);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
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
  const colors =
    op === "+" ? ["#fff6c2", "#ffce33"] : op === "-" ? ["#ffd0d0", "#ff3b4e"] : ["#fff0d0", "#ffb020"];
  const grad = g.createRadialGradient(128, 100, 20, 128, 140, 150);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(128, 128, 118, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = "rgba(255,255,255,0.9)";
  g.stroke();
  g.font = "900 118px Arial Black, Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 14;
  g.strokeStyle = op === "-" ? "#6b0010" : "#6a4200";
  g.strokeText(label, 128, 138);
  g.fillStyle = "#ffffff";
  g.fillText(label, 128, 138);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
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
    uvs.push(0, v, 4, v);
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
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0.0 }),
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

  // ---- side barriers (tube) with bark texture + rounded caps
  const barkTex = barkTexture(def.wall);
  barkTex.repeat.set(1, 40);
  const wallMat = new THREE.MeshStandardMaterial({ map: barkTex, roughness: 0.85, metalness: 0.03 });
  for (const sign of [-1, 1]) {
    const cps: THREE.Vector3[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      const p = pts[i];
      const sx = Math.cos(p.yaw) * sign;
      const sz = -Math.sin(p.yaw) * sign;
      cps.push(new THREE.Vector3(p.x + sx * (halfW - 0.2), p.y + 0.6, p.z + sz * (halfW - 0.2)));
    }
    const curve = new THREE.CatmullRomCurve3(cps);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, cps.length * 2, 1.15, 12, false),
      wallMat,
    );
    tube.castShadow = true;
    tube.receiveShadow = true;
    group.add(tube);
    // mossy top highlight strip
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x4e9e4a, roughness: 1 });
    const mossTube = new THREE.Mesh(new THREE.TubeGeometry(curve, cps.length * 2, 1.2, 12, false), mossMat);
    mossTube.scale.set(1, 0.14, 1);
    mossTube.position.y = 0.55;
    group.add(mossTube);
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
      if (rnd() > 0.72) continue;
      const dist = halfW + 3 + rnd() * 26;
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
  const rampMat = new THREE.MeshStandardMaterial({ color: 0xff9f43, roughness: 0.5, metalness: 0.1 });
  const bumpMat = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.85 });

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
      obj = holder;
    } else {
      obj = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 10), bumpMat);
      obj.scale.y = 0.42;
      obj.castShadow = true;
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
