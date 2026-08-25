import * as THREE from "three";

export type CarParts = {
  root: THREE.Group;
  body: THREE.Group;
  wheels: THREE.Mesh[];
  frontSteerHubs: THREE.Group[];
  flame: THREE.Mesh;
  flameInner: THREE.Mesh;
  flameLight: THREE.PointLight;
  headlights: THREE.Mesh[];
  taillights: THREE.Mesh[];
  sirenLight?: { red: THREE.Mesh; blue: THREE.Mesh };
  shadow: THREE.Mesh;
};

const tireGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.28, 28);
const rimGeo = new THREE.CylinderGeometry(0.26, 0.23, 0.3, 22);
const discGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20);
const spokeGeo = new THREE.BoxGeometry(0.07, 0.42, 0.08);

function paintMaterial(color: THREE.Color) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.18,
    metalness: 0.55,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.1,
    reflectivity: 1,
  });
}

export function makeCar(colorHex: string, hat: string): CarParts {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const mainColor = new THREE.Color(colorHex);
  const darkAccent = mainColor.clone().offsetHSL(0, -0.08, -0.28);
  const lightAccent = mainColor.clone().offsetHSL(0, -0.15, 0.18);

  const paintMat = paintMaterial(mainColor);
  const accentPaintMat = paintMaterial(darkAccent);
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x12151c,
    roughness: 0.38,
    metalness: 0.72,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x071018,
    roughness: 0.04,
    metalness: 0.15,
    clearcoat: 1,
    transparent: true,
    opacity: 0.72,
    transmission: 0.15,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xeef3f8,
    roughness: 0.08,
    metalness: 0.96,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x14161a,
    roughness: 0.88,
    metalness: 0.04,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd9e2ec,
    roughness: 0.16,
    metalness: 0.88,
  });
  const discMat = new THREE.MeshStandardMaterial({
    color: 0x3a3f48,
    roughness: 0.35,
    metalness: 0.7,
  });
  const headLightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xbfefff,
    emissiveIntensity: 2.2,
    roughness: 0.12,
  });
  const tailLightMat = new THREE.MeshStandardMaterial({
    color: 0xff1133,
    emissive: 0xff0022,
    emissiveIntensity: 1.8,
    roughness: 0.12,
  });

  const chassis = new THREE.Group();
  body.add(chassis);

  const tub = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.42, 3.55), paintMat);
  tub.position.y = 0.46;
  tub.castShadow = true;
  tub.receiveShadow = true;
  chassis.add(tub);

  const rocker = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.18, 3.2), carbonMat);
  rocker.position.y = 0.22;
  chassis.add(rocker);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.16, 1.35), paintMat);
  hood.position.set(0, 0.64, 1.05);
  hood.rotation.x = -0.16;
  hood.castShadow = true;
  chassis.add(hood);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 0.55), paintMat);
  nose.position.set(0, 0.4, 1.82);
  nose.rotation.x = 0.18;
  chassis.add(nose);

  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.06, 0.48), carbonMat);
  splitter.position.set(0, 0.16, 2.02);
  chassis.add(splitter);

  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.2, 0.08), carbonMat);
  grille.position.set(0, 0.34, 2.08);
  chassis.add(grille);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.015, 3.4),
    new THREE.MeshStandardMaterial({ color: lightAccent, roughness: 0.25, metalness: 0.4 }),
  );
  stripe.position.set(0, 0.68, 0.05);
  chassis.add(stripe);

  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 2.5), carbonMat);
    skirt.position.set(0.92 * side, 0.22, -0.05);
    chassis.add(skirt);

    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, 0.55), accentPaintMat);
    vent.position.set(0.88 * side, 0.52, -0.28);
    chassis.add(vent);

    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.12), carbonMat);
    mirror.position.set(0.92 * side, 0.82, 0.42);
    chassis.add(mirror);
  }

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.48, 1.35), glassMat);
  cabin.position.set(0, 0.92, -0.18);
  cabin.castShadow = true;
  chassis.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.07, 0.82), paintMat);
  roof.position.set(0, 1.18, -0.22);
  chassis.add(roof);

  const aPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.7), carbonMat);
  aPillarL.position.set(-0.6, 0.92, 0.22);
  aPillarL.rotation.x = -0.55;
  chassis.add(aPillarL);
  const aPillarR = aPillarL.clone();
  aPillarR.position.x = 0.6;
  chassis.add(aPillarR);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 14), accentPaintMat);
  helmet.position.set(0, 0.92, -0.12);
  chassis.add(helmet);
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.09, 0.12),
    new THREE.MeshPhysicalMaterial({
      color: 0x00e8ff,
      roughness: 0.08,
      clearcoat: 1,
      emissive: 0x0088aa,
      emissiveIntensity: 0.35,
    }),
  );
  visor.position.set(0, 0.94, 0.08);
  chassis.add(visor);

  const headlights: THREE.Mesh[] = [];
  const taillights: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.06), headLightMat);
    hl.position.set(0.58 * side, 0.44, 2.1);
    chassis.add(hl);
    headlights.push(hl);

    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.03, 0.04),
      new THREE.MeshBasicMaterial({ color: 0xd8fbff }),
    );
    strip.position.set(0.58 * side, 0.52, 2.11);
    chassis.add(strip);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.06), tailLightMat);
    tl.position.set(0.56 * side, 0.56, -1.78);
    chassis.add(tl);
    taillights.push(tl);
  }

  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.4), carbonMat);
  diffuser.position.set(0, 0.2, -1.78);
  chassis.add(diffuser);

  for (const side of [-1, 1]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.38, 14), chromeMat);
    ex.rotation.x = Math.PI / 2;
    ex.position.set(0.32 * side, 0.28, -1.86);
    chassis.add(ex);
  }

  const flameGeo = new THREE.ConeGeometry(0.26, 1.35, 14);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x7af7ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, 0.3, -2.42);
  chassis.add(flame);

  const flameInner = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.85, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
  );
  flameInner.rotation.x = -Math.PI / 2;
  flameInner.position.set(0, 0.3, -2.2);
  chassis.add(flameInner);

  const flameLight = new THREE.PointLight(0x4de8ff, 0, 11);
  flameLight.position.set(0, 0.32, -2.15);
  chassis.add(flameLight);

  let sirenLight: { red: THREE.Mesh; blue: THREE.Mesh } | undefined;

  if (hat === "cap") {
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.07, 0.52), carbonMat);
    wingBlade.position.set(0, 1.12, -1.58);
    wingBlade.rotation.x = -0.12;
    wingBlade.castShadow = true;
    chassis.add(wingBlade);
    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 0.24), carbonMat);
      strut.position.set(0.66 * side, 0.84, -1.55);
      chassis.add(strut);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.34, 0.62), paintMat);
      plate.position.set(1.0 * side, 1.12, -1.58);
      chassis.add(plate);
    }
  } else if (hat === "leaf") {
    const blowerMat = new THREE.MeshStandardMaterial({
      color: 0xff4500,
      roughness: 0.22,
      metalness: 0.82,
      emissive: 0x661100,
      emissiveIntensity: 0.45,
    });
    for (const side of [-1, 1]) {
      const blower = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.42, 14), blowerMat);
      blower.rotation.x = Math.PI / 2;
      blower.position.set(0.32 * side, 0.82, 0.92);
      chassis.add(blower);
    }
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.06, 0.4), paintMat);
    wing.position.set(0, 0.92, -1.56);
    chassis.add(wing);
  } else if (hat === "crown") {
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      roughness: 0.18,
      metalness: 0.92,
      emissive: 0xaa8800,
      emissiveIntensity: 0.28,
    });
    const ornament = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.16, 0.3, 8), crownMat);
    ornament.position.set(0, 0.9, 1.18);
    chassis.add(ornament);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.07, 0.42), crownMat);
    wing.position.set(0, 0.94, -1.56);
    chassis.add(wing);
  } else if (hat === "goggles") {
    const sirenGroup = new THREE.Group();
    sirenGroup.position.set(0, 1.3, -0.2);
    sirenGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.07, 0.2), carbonMat));
    const redLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.13, 0.16),
      new THREE.MeshStandardMaterial({ color: 0xff0022, emissive: 0xff0022, emissiveIntensity: 1.6 }),
    );
    redLight.position.x = -0.22;
    const blueLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.13, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x0066ff, emissive: 0x0066ff, emissiveIntensity: 1.6 }),
    );
    blueLight.position.x = 0.22;
    sirenGroup.add(redLight, blueLight);
    sirenLight = { red: redLight, blue: blueLight };
    chassis.add(sirenGroup);
  } else {
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.06, 0.42), paintMat);
    wingBlade.position.set(0, 0.94, -1.56);
    wingBlade.castShadow = true;
    chassis.add(wingBlade);
    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.2), carbonMat);
      strut.position.set(0.54 * side, 0.76, -1.54);
      chassis.add(strut);
    }
  }

  const wheels: THREE.Mesh[] = [];
  const frontSteerHubs: THREE.Group[] = [];
  const wheelPositions = [
    { x: -0.9, y: 0.4, z: 1.22, isFront: true },
    { x: 0.9, y: 0.4, z: 1.22, isFront: true },
    { x: -0.92, y: 0.4, z: -1.18, isFront: false },
    { x: 0.92, y: 0.4, z: -1.18, isFront: false },
  ];

  wheelPositions.forEach((pos) => {
    const hub = new THREE.Group();
    hub.position.set(pos.x, pos.y, pos.z);
    body.add(hub);
    if (pos.isFront) frontSteerHubs.push(hub);

    const spin = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    spin.add(tire);

    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    spin.add(rim);

    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.z = Math.PI / 2;
    spin.add(disc);

    for (let i = 0; i < 5; i++) {
      const spoke = new THREE.Mesh(spokeGeo, paintMat);
      spoke.rotation.z = Math.PI / 2;
      spoke.rotation.x = (i / 5) * Math.PI;
      spin.add(spoke);
    }

    hub.add(spin);
    wheels.push(spin as unknown as THREE.Mesh);
  });

  const shadowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64);
    grad.addColorStop(0, "rgba(0,0,0,0.62)");
    grad.addColorStop(0.55, "rgba(0,0,0,0.22)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 4.4),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.9 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  root.add(shadow);

  return {
    root,
    body,
    wheels,
    frontSteerHubs,
    flame,
    flameInner,
    flameLight,
    headlights,
    taillights,
    sirenLight,
    shadow,
  };
}

export function animateCar(
  p: CarParts,
  t: number,
  speed01: number,
  airborne: number,
  stumble: number,
  steerAngle: number,
  boostActive: boolean,
  extras?: { pitch?: number; roll?: number; slip?: number; landSquash?: number; dt?: number },
) {
  const dt = extras?.dt ?? 0.016;
  const spinSpeed = speed01 * 28;
  for (const w of p.wheels) w.rotation.x += spinSpeed * dt;

  const targetSteer = THREE.MathUtils.clamp(steerAngle, -1, 1) * 0.48;
  for (const hub of p.frontSteerHubs) {
    hub.rotation.y += (targetSteer - hub.rotation.y) * Math.min(1, dt * 12);
  }

  const slip = extras?.slip ?? 0;
  const squash = extras?.landSquash ?? 0;
  const bodyPitch = (extras?.pitch ?? 0) * 0.15 - speed01 * 0.035 + stumble * 0.18 - squash * 0.12;
  const bodyRoll = -steerAngle * 0.12 + slip * 0.18 + stumble * 0.28 + (extras?.roll ?? 0) * 0.25;

  p.body.rotation.z += (bodyRoll - p.body.rotation.z) * Math.min(1, dt * 8);
  p.body.rotation.x += (bodyPitch - p.body.rotation.x) * Math.min(1, dt * 8);

  const bounce = Math.sin(t * 16) * 0.012 * Math.min(1, speed01) * (1 - airborne);
  p.body.position.y = bounce + airborne * 0.18 - squash * 0.14;
  p.body.scale.y = 1 - squash * 0.12;
  p.body.scale.x = 1 + squash * 0.06;
  p.body.scale.z = 1 + squash * 0.04;

  const flameOn = boostActive || speed01 > 1.08;
  const flameMat = p.flame.material as THREE.MeshBasicMaterial;
  const innerMat = p.flameInner.material as THREE.MeshBasicMaterial;
  if (flameOn) {
    const flick = 0.75 + Math.random() * 0.35;
    flameMat.opacity = 0.85;
    innerMat.opacity = 0.7;
    p.flame.scale.set(0.85 + Math.random() * 0.4, flick, 0.85 + Math.random() * 0.35);
    p.flameInner.scale.set(0.8, 0.7 + Math.random() * 0.5, 0.8);
    p.flameLight.intensity = 4.6 + Math.random() * 2.2;
  } else {
    flameMat.opacity = Math.max(0, flameMat.opacity - dt * 6);
    innerMat.opacity = Math.max(0, innerMat.opacity - dt * 6);
    p.flameLight.intensity *= 1 - Math.min(1, dt * 10);
  }

  const tailBoost = flameOn ? 2.6 : 1.5;
  for (const tl of p.taillights) {
    (tl.material as THREE.MeshStandardMaterial).emissiveIntensity = tailBoost;
  }

  if (p.sirenLight) {
    const flash = Math.floor(t * 12) % 2 === 0;
    (p.sirenLight.red.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 2.1 : 0.08;
    (p.sirenLight.blue.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 0.08 : 2.1;
  }

  const shadowMat = p.shadow.material as THREE.MeshBasicMaterial;
  shadowMat.opacity = airborne > 0.05 ? 0.28 : 0.88;
  p.shadow.scale.setScalar(airborne > 0.05 ? 1.25 : 1);
}
