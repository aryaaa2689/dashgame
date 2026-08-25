import * as THREE from "three";

export type CharParts = {
  root: THREE.Group;
  body: THREE.Group;
  torso: THREE.Mesh;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  head: THREE.Group;
};

const bodyGeo = new THREE.SphereGeometry(1, 32, 24);
const upperLimbGeo = new THREE.CapsuleGeometry(0.155, 0.32, 6, 12);
const lowerLimbGeo = new THREE.CapsuleGeometry(0.13, 0.3, 6, 12);
const shoeGeo = new THREE.CapsuleGeometry(0.18, 0.16, 4, 10);
const eyeWhiteGeo = new THREE.SphereGeometry(0.15, 16, 12);
const pupilGeo = new THREE.SphereGeometry(0.075, 12, 10);

function skinTexture(hex: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const base = new THREE.Color(hex);
  const light = base.clone().offsetHSL(0, -0.05, 0.14);
  const dark = base.clone().offsetHSL(0, 0.05, -0.12);
  const grad = g.createRadialGradient(96, 80, 10, 128, 150, 210);
  grad.addColorStop(0, `#${light.getHexString()}`);
  grad.addColorStop(0.55, `#${base.getHexString()}`);
  grad.addColorStop(1, `#${dark.getHexString()}`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  // faint fresnel-ish rim + fabric noise
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function makeSkinMat(hex: string) {
  return new THREE.MeshPhysicalMaterial({
    map: skinTexture(hex),
    roughness: 0.55,
    metalness: 0.02,
    clearcoat: 0.35,
    clearcoatRoughness: 0.5,
    sheen: 0.4,
    sheenColor: new THREE.Color(hex).offsetHSL(0, 0, 0.2),
  });
}

export function makeCharacter(color: string, hat: string): CharParts {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skinMat = makeSkinMat(color);
  const trimColor = new THREE.Color(color).offsetHSL(0, 0.1, -0.18);
  const trimMat = new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.6, metalness: 0.05 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.5, metalness: 0.1 });
  const skinToneMat = new THREE.MeshPhysicalMaterial({
    color: 0xf3c8a0,
    roughness: 0.5,
    metalness: 0.0,
    clearcoat: 0.25,
  });

  // ---- torso (slightly egg shaped, rounded) with a belt/trim band
  const torso = new THREE.Mesh(bodyGeo, skinMat);
  torso.scale.set(0.66, 0.9, 0.6);
  torso.position.y = 0.98;
  torso.castShadow = true;
  torso.receiveShadow = true;
  body.add(torso);

  const belt = new THREE.Mesh(
    new THREE.TorusGeometry(0.56, 0.09, 10, 24),
    trimMat,
  );
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.64;
  belt.scale.set(1, 1, 0.86);
  body.add(belt);

  // ---- neck + head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.16, 12), skinToneMat);
  neck.position.y = 1.42;
  body.add(neck);

  const head = new THREE.Group();
  head.position.y = 1.62;
  body.add(head);

  const skull = new THREE.Mesh(bodyGeo, skinToneMat);
  skull.scale.set(0.58, 0.56, 0.56);
  skull.castShadow = true;
  head.add(skull);

  // hair cap
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
    new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.75 }),
  );
  hair.position.y = 0.06;
  hair.scale.set(1.0, 0.92, 1.0);
  head.add(hair);

  // eyes: white + pupil for depth, catch-light via clearcoat
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, clearcoat: 0.8 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x1c1e26 });
  for (const side of [-1, 1]) {
    const white = new THREE.Mesh(eyeWhiteGeo, eyeMat);
    white.scale.set(0.85, 1, 0.6);
    white.position.set(0.21 * side, 0.03, 0.48);
    head.add(white);
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(0.21 * side, 0.02, 0.58);
    head.add(pupil);
    const highlight = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    highlight.position.set(0.21 * side + 0.025, 0.05, 0.63);
    head.add(highlight);
  }

  // compact sports visor: makes the racers feel more like modern game
  // avatars and less like oversized toddler dolls while keeping expression.
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.18, 0.055),
    new THREE.MeshPhysicalMaterial({
      color: 0x111923,
      roughness: 0.18,
      metalness: 0.15,
      clearcoat: 1,
      transparent: true,
      opacity: 0.78,
    }),
  );
  visor.position.set(0, 0.035, 0.61);
  head.add(visor);
  const visorGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.025, 0.062),
    new THREE.MeshBasicMaterial({ color: 0x76ffe0, transparent: true, opacity: 0.7 }),
  );
  visorGlow.position.set(0, 0.08, 0.645);
  head.add(visorGlow);

  // small nose + toned-down cheeks for warmth without a childish doll look
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), skinToneMat);
  nose.position.set(0, -0.06, 0.6);
  head.add(nose);
  const cheekMat = new THREE.MeshStandardMaterial({
    color: 0xff96a8,
    transparent: true,
    opacity: 0.12,
    roughness: 1,
  });
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), cheekMat);
    cheek.scale.set(1.2, 0.75, 0.5);
    cheek.position.set(0.36 * side, -0.14, 0.42);
    head.add(cheek);
  }

  if (hat === "cap") {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.63, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xe23f57, roughness: 0.45 }),
    );
    cap.position.y = 0.12;
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.06, 20, 1, false, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xe23f57, roughness: 0.45 }),
    );
    brim.position.set(0, 0.1, 0.42);
    brim.rotation.y = Math.PI;
    head.add(cap, brim);
    hair.visible = false;
  } else if (hat === "leaf") {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0x3fae4c, roughness: 0.6 }),
    );
    leaf.scale.set(0.4, 0.14, 1.15);
    leaf.position.set(0.12, 0.62, -0.08);
    leaf.rotation.z = -0.4;
    head.add(leaf);
  } else if (hat === "crown") {
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.34, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0xffd23d, roughness: 0.25, metalness: 0.7 }),
    );
    crown.position.y = 0.62;
    head.add(crown);
  } else if (hat === "goggles") {
    const g = new THREE.Mesh(
      new THREE.TorusGeometry(0.19, 0.06, 10, 18),
      new THREE.MeshStandardMaterial({ color: 0x2e3340, roughness: 0.35, metalness: 0.4 }),
    );
    g.position.set(-0.21, 0.3, 0.48);
    const g2 = g.clone();
    g2.position.x = 0.21;
    head.add(g, g2);
  }

  // ---- arms as jointed groups (shoulder pivot -> upper -> elbow -> lower)
  function makeArm(side: number) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.62 * side, 1.18, 0);
    const upper = new THREE.Mesh(upperLimbGeo, skinMat);
    upper.position.y = -0.16;
    upper.castShadow = true;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.32;
    upper.add(elbow);
    const lower = new THREE.Mesh(lowerLimbGeo, skinToneMat);
    lower.position.y = -0.15;
    lower.castShadow = true;
    elbow.add(lower);
    return shoulder;
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);
  body.add(armL, armR);

  // ---- legs as jointed groups (hip -> thigh -> knee -> shin -> shoe)
  function makeLeg(side: number) {
    const hip = new THREE.Group();
    hip.position.set(0.28 * side, 0.58, 0);
    const thigh = new THREE.Mesh(upperLimbGeo, trimMat);
    thigh.scale.set(1.05, 1, 1.05);
    thigh.position.y = -0.16;
    thigh.castShadow = true;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.33;
    thigh.add(knee);
    const shin = new THREE.Mesh(lowerLimbGeo, skinToneMat);
    shin.position.y = -0.14;
    shin.castShadow = true;
    knee.add(shin);
    const shoe = new THREE.Mesh(shoeGeo, shoeMat);
    shoe.rotation.x = Math.PI / 2;
    shoe.scale.set(1, 1, 1.5);
    shoe.position.y = -0.3;
    shoe.castShadow = true;
    knee.add(shoe);
    return hip;
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);
  body.add(legL, legR);

  // contact shadow blob (soft, realistic ground contact rather than flat cartoon disc)
  const blobTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, "rgba(0,0,0,0.45)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 24),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  root.add(blob);

  return { root, body, torso, armL, armR, legL, legR, head };
}

export function animateChar(
  p: CharParts,
  t: number,
  speed01: number,
  airborne: number,
  stumble: number,
) {
  const f = t * (7 + speed01 * 9);
  const bounce = Math.abs(Math.sin(f)) * (0.1 + speed01 * 0.14);
  p.body.position.y = bounce + airborne * 0.2;
  p.body.rotation.z = Math.sin(f) * 0.045 + stumble * 0.5;
  p.body.rotation.x = -0.1 - speed01 * 0.14 + stumble * 0.3;
  const swing = Math.sin(f) * (0.75 + speed01 * 0.6);
  p.legL.rotation.x = swing;
  p.legR.rotation.x = -swing;
  p.armL.rotation.x = -swing * 1.1;
  p.armR.rotation.x = swing * 1.1;
  p.armL.rotation.z = 0.28 + airborne * 0.7;
  p.armR.rotation.z = -0.28 - airborne * 0.7;
  p.head.rotation.z = Math.sin(f * 0.5) * 0.05;
  p.head.rotation.x = airborne * -0.15;
  p.head.position.y = 1.62 + Math.sin(f + 1) * 0.025;
  p.torso.rotation.y = Math.sin(f * 0.5) * 0.04;
}
