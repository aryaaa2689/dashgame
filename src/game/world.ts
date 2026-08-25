import * as THREE from "three";
import { TrackPath, Feature, PickupOp } from "@/lib/track";

function asphaltRoadTexture(grassA: string, grassB: string) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1024;
  const g = c.getContext("2d")!;

  // Dark asphalt surface
  g.fillStyle = "#1e2229";
  g.fillRect(0, 0, 1024, 1024);

  // Asphalt noise / grain
  for (let i = 0; i < 25000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const shade = Math.random() > 0.5 ? 255 : 0;
    const alpha = Math.random() * 0.08;
    g.fillStyle = `rgba(${shade},${shade},${shade},${alpha})`;
    g.fillRect(x, y, 2, 2);
  }

  // Outer red-and-white curb strips (kerbs)
  const kerbWidth = 48;
  const kerbSegmentH = 64;
  for (let y = 0; y < 1024; y += kerbSegmentH) {
    const isRed = (y / kerbSegmentH) % 2 === 0;
    g.fillStyle = isRed ? "#e63946" : "#ffffff";
    // Left kerb
    g.fillRect(0, y, kerbWidth, kerbSegmentH);
    // Right kerb
    g.fillRect(1024 - kerbWidth, y, kerbWidth, kerbSegmentH);
  }

  // Solid white edge lines
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.fillRect(kerbWidth, 0, 12, 1024);
  g.fillRect(1024 - kerbWidth - 12, 0, 12, 1024);

  // Center double yellow line
  g.fillStyle = "#ffc107";
  g.fillRect(506, 0, 6, 1024);
  g.fillRect(518, 0, 6, 1024);

  // Dashed white lane divider lines (4-lane road setup)
  g.fillStyle = "rgba(255,255,255,0.75)";
  const dashH = 56;
  const gapH = 40;
  const laneL = 274;
  const laneR = 750;
  for (let y = 0; y < 1024; y += dashH + gapH) {
    g.fillRect(laneL, y, 8, dashH);
    g.fillRect(laneR, y, 8, dashH);
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
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
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// 3D Pickup Badge Canvas Texture for +, -, x, ÷
function symbolTexture(op: PickupOp, value: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const label = op === "x" ? `×${value}` : op === "÷" ? `÷${value}` : `${op}${value}`;

  const palette =
    op === "+"
      ? { core: "#00ff88", rim: "#a8ffda", shadow: "#033b1f", bg: "rgba(0,40,20,0.85)" }
      : op === "x"
        ? { core: "#ffd700", rim: "#fff2a8", shadow: "#423200", bg: "rgba(45,35,0,0.85)" }
        : op === "-"
          ? { core: "#ff7700", rim: "#ffd2a8", shadow: "#421800", bg: "rgba(45,15,0,0.85)" }
          : { core: "#ff0055", rim: "#ffa8c5", shadow: "#420014", bg: "rgba(45,0,15,0.85)" }; // ÷ Division

  g.clearRect(0, 0, 256, 256);

  // Outer radial neon glow
  const glow = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  glow.addColorStop(0, palette.core);
  glow.addColorStop(0.5, `${palette.core}66`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, 256, 256);

  // Rounded octagon face
  const r = 92;
  const cx = 128;
  const cy = 128;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();

  g.fillStyle = palette.bg;
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = palette.core;
  g.stroke();

  // Glass glare streak
  g.fillStyle = "rgba(255,255,255,0.22)";
  g.beginPath();
  g.ellipse(108, 80, 56, 18, -0.3, 0, Math.PI * 2);
  g.fill();

  // Chunky bold text
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
  return t;
}

export function buildWorld(scene: THREE.Scene, path: TrackPath) {
  const def = path.def;
  const group = new THREE.Group();
  scene.add(group);

  // ---- Sky Dome
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

  // ---- Track Asphalt Ribbon
  const halfW = def.width / 2;
  const pts = path.points;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const sx = Math.cos(p.yaw);
    const sz = -Math.sin(p.yaw);
    positions.push(p.x - sx * halfW, p.y, p.z - sz * halfW);
    positions.push(p.x + sx * halfW, p.y, p.z + sz * halfW);
    const v = (i * path.step) / 12;
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

  const roadTex = asphaltRoadTexture(def.grass[0], def.grass[1]);
  const road = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.6, metalness: 0.1 }),
  );
  road.receiveShadow = true;
  group.add(road);

  // Underside dirt foundation
  const under = new THREE.Mesh(
    geo.clone(),
    new THREE.MeshStandardMaterial({ color: 0x1f1610, roughness: 1, side: THREE.BackSide }),
  );
  under.position.y = -1.6;
  group.add(under);

  // ---- Side Guardrails & Crash Barriers
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0x9099a8, roughness: 0.2, metalness: 0.8 });
  const reflectorMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 0.8 });

  for (const sign of [-1, 1]) {
    const cps: THREE.Vector3[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      const p = pts[i];
      const sx = Math.cos(p.yaw) * sign;
      const sz = -Math.sin(p.yaw) * sign;
      cps.push(new THREE.Vector3(p.x + sx * (halfW - 0.1), p.y + 0.45, p.z + sz * (halfW - 0.1)));
    }
    const curve = new THREE.CatmullRomCurve3(cps);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, cps.length * 2, 0.42, 12, false), barrierMat);
    tube.castShadow = true;
    tube.receiveShadow = true;
    group.add(tube);

    // Glowing yellow reflector posts along the barriers
    for (let i = 0; i < pts.length; i += 12) {
      const p = pts[i];
      const sx = Math.cos(p.yaw) * sign;
      const sz = -Math.sin(p.yaw) * sign;
      const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.18), reflectorMat);
      reflector.position.set(p.x + sx * (halfW - 0.1), p.y + 0.65, p.z + sz * (halfW - 0.1));
      group.add(reflector);
    }
  }

  // ---- Scenery (Trees, Grandstands, Floodlights, Mountains)
  const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 7, 9);
  const trunkTex = barkTexture("#5e3e26");
  trunkTex.repeat.set(1, 3);
  const trunkMat = new THREE.MeshStandardMaterial({ map: trunkTex, roughness: 0.9 });
  const leafGeo = new THREE.SphereGeometry(2.5, 12, 10);
  const leafMats = [0x2f9e4a, 0x39b356, 0x1f7f3c, 0x53c765].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }),
  );

  let rs = 1;
  const rnd = () => {
    rs = (rs * 16807) % 2147483647;
    return rs / 2147483647;
  };

  const scenery = new THREE.Group();
  for (let i = 0; i < pts.length; i += 3) {
    const p = pts[i];
    for (const sign of [-1, 1]) {
      if (rnd() > 0.45) continue;
      const dist = halfW + 3 + rnd() * 24;
      const sx = Math.cos(p.yaw) * sign;
      const sz = -Math.sin(p.yaw) * sign;
      const x = p.x + sx * dist;
      const z = p.z + sz * dist;
      const yBase = p.y - 2 - rnd() * 6;

      const t = new THREE.Mesh(trunkGeo, trunkMat);
      t.castShadow = true;
      const h = 1 + rnd() * 1.4;
      t.scale.set(1, h, 1);
      t.position.set(x, yBase + 3.5 * h, z);
      scenery.add(t);

      const canopy = new THREE.Mesh(leafGeo, leafMats[Math.floor(rnd() * leafMats.length)]);
      canopy.castShadow = true;
      canopy.position.set(x, yBase + 7 * h, z);
      canopy.scale.setScalar(0.9 + rnd() * 1.1);
      scenery.add(canopy);
    }
  }

  // Stadium Floodlight Poles along track
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x404552, roughness: 0.3, metalness: 0.8 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfffae6, emissiveIntensity: 1.5 });

  for (let i = 20; i < pts.length - 20; i += 30) {
    const p = pts[i];
    for (const sign of [-1, 1]) {
      const sx = Math.cos(p.yaw) * sign;
      const sz = -Math.sin(p.yaw) * sign;
      const x = p.x + sx * (halfW + 2.5);
      const z = p.z + sz * (halfW + 2.5);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 12, 10), poleMat);
      pole.position.set(x, p.y + 6, z);
      pole.castShadow = true;
      scenery.add(pole);

      const lightBox = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 0.4), lampMat);
      lightBox.position.set(x - sx * 0.5, p.y + 11.8, z - sz * 0.5);
      lightBox.rotation.y = p.yaw + (sign * Math.PI) / 4;
      scenery.add(lightBox);
    }
  }
  group.add(scenery);

  // ---- Feature Props: High Visibility 3D Gate Archways (+, -, x, ÷)
  const featureMeshes: THREE.Object3D[] = [];
  const rampMat = new THREE.MeshStandardMaterial({
    color: 0x00d9ff,
    roughness: 0.2,
    metalness: 0.8,
    emissive: 0x0066aa,
    emissiveIntensity: 0.5,
  });

  for (const f of path.features) {
    const w = path.worldAt(f.s, f.lane);
    let obj: THREE.Object3D;

    if (f.type === "pickup") {
      const gate = new THREE.Group();
      const op = f.op ?? "+";
      const val = f.value;

      const colorHex =
        op === "+"
          ? 0x00ff88
          : op === "x"
            ? 0xffd700
            : op === "-"
              ? 0xff7700
              : 0xff0055; // ÷

      const neonMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      });

      const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a212d, roughness: 0.4, metalness: 0.7 });

      // Gate Arch Pillars (Left & Right standing posts)
      const pillarW = 4.2;
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.8, 0.35), frameMat);
        pillar.position.set((pillarW / 2) * side, 2.4, 0);
        pillar.castShadow = true;
        gate.add(pillar);

        const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.6, 0.12), neonMat);
        neonStrip.position.set((pillarW / 2) * side, 2.4, 0.16);
        gate.add(neonStrip);
      }

      // Top Arch Bar across the gate
      const topBar = new THREE.Mesh(new THREE.BoxGeometry(pillarW + 0.4, 0.4, 0.4), frameMat);
      topBar.position.set(0, 4.8, 0);
      gate.add(topBar);

      const topNeon = new THREE.Mesh(new THREE.BoxGeometry(pillarW + 0.2, 0.16, 0.16), neonMat);
      topNeon.position.set(0, 4.8, 0.2);
      gate.add(topNeon);

      // Central Floating 3D Arithmetic Symbol Badge
      const tex = symbolTexture(op, val);
      const badge = new THREE.Mesh(
        new THREE.CylinderGeometry(1.35, 1.35, 0.2, 32),
        new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.2,
          metalness: 0.2,
          emissive: colorHex,
          emissiveIntensity: 0.35,
        }),
      );
      badge.rotation.x = Math.PI / 2;
      badge.position.y = 2.6;
      badge.castShadow = true;
      gate.add(badge);

      // Glowing sprite aura behind badge
      const aura = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
        }),
      );
      aura.scale.set(3.4, 3.4, 1);
      aura.position.y = 2.6;
      gate.add(aura);

      // Road chevron marker leading into gate
      const chevron = new THREE.Mesh(
        new THREE.PlaneGeometry(3.6, 2.8),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.65 }),
      );
      chevron.rotation.x = -Math.PI / 2;
      chevron.position.set(0, 0.03, 0.5);
      gate.add(chevron);

      gate.userData.spin = false;
      gate.userData.bob = true;
      obj = gate;
    } else if (f.type === "ramp") {
      const rampGroup = new THREE.Group();
      const wedge = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 4.2, 3, 1), rampMat);
      wedge.rotation.z = Math.PI / 2;
      wedge.rotation.y = Math.PI / 2;
      wedge.position.y = -1.3;
      wedge.castShadow = true;
      rampGroup.add(wedge);
      obj = rampGroup;
    } else {
      const hazard = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 0.35, 1.2),
        new THREE.MeshStandardMaterial({ color: 0xff3344, roughness: 0.3, emissive: 0x990011, emissiveIntensity: 0.6 }),
      );
      base.position.y = 0.18;
      base.castShadow = true;
      hazard.add(base);
      obj = hazard;
    }

    const wrap = new THREE.Group();
    wrap.position.set(w.x, w.y + 0.05, w.z);
    wrap.rotation.y = w.yaw;
    wrap.add(obj);
    wrap.userData.t0 = f.s * 0.05;
    group.add(wrap);
    featureMeshes.push(wrap);
  }

  // Start & Finish Overhead Banners
  for (const [s, title, color] of [
    [4, "START", 0x00f0ff],
    [path.length - 8, "FINISH", 0xffd700],
  ] as [number, string, number][]) {
    const w = path.worldAt(s, 0);
    const bannerGroup = new THREE.Group();
    bannerGroup.position.set(w.x, w.y, w.z);
    bannerGroup.rotation.y = w.yaw;

    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(def.width + 4, 1.2, 0.8),
      new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.5, emissive: color, emissiveIntensity: 0.4 }),
    );
    bar.position.y = 7.5;
    bar.castShadow = true;
    bannerGroup.add(bar);

    for (const sign of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 8, 12),
        new THREE.MeshStandardMaterial({ color: 0x1f242e, roughness: 0.4, metalness: 0.8 }),
      );
      post.position.set(sign * (halfW + 1.2), 4, 0);
      post.castShadow = true;
      bannerGroup.add(post);
    }
    group.add(bannerGroup);
  }

  return { group, featureMeshes };
}
