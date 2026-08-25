import * as THREE from "three";

export type CarParts = {
  root: THREE.Group;
  body: THREE.Group;
  wheels: THREE.Mesh[];
  frontSteerHubs: THREE.Group[];
  flame: THREE.Mesh;
  flameLight: THREE.PointLight;
  headlights: THREE.Mesh[];
  taillights: THREE.Mesh[];
  sirenLight?: { red: THREE.Mesh; blue: THREE.Mesh };
};

// High-detail geometries
const tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 28);
const rimGeo = new THREE.CylinderGeometry(0.25, 0.22, 0.33, 20);
const spokeGeo = new THREE.BoxGeometry(0.08, 0.44, 0.34);

export function makeCar(colorHex: string, hat: string): CarParts {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const mainColor = new THREE.Color(colorHex);
  const darkAccent = mainColor.clone().offsetHSL(0, -0.1, -0.25);

  // Materials
  const paintMat = new THREE.MeshPhysicalMaterial({
    color: mainColor,
    roughness: 0.15,
    metalness: 0.45,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 1.0,
  });

  const accentPaintMat = new THREE.MeshPhysicalMaterial({
    color: darkAccent,
    roughness: 0.2,
    metalness: 0.5,
    clearcoat: 0.9,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x12151c,
    roughness: 0.35,
    metalness: 0.7,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x08101a,
    roughness: 0.05,
    metalness: 0.1,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.85,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf0f4f8,
    roughness: 0.08,
    metalness: 0.95,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x181a1e,
    roughness: 0.85,
    metalness: 0.05,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.15,
    metalness: 0.85,
  });

  const headLightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x00f0ff,
    emissiveIntensity: 1.5,
    roughness: 0.1,
  });

  const tailLightMat = new THREE.MeshStandardMaterial({
    color: 0xff1133,
    emissive: 0xff0022,
    emissiveIntensity: 1.6,
    roughness: 0.1,
  });

  // ---- Main Aerodynamic Chassis
  const chassis = new THREE.Group();
  body.add(chassis);

  // Sleek tapered main hull
  const mainTub = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.58, 3.4), paintMat);
  mainTub.position.y = 0.42;
  mainTub.castShadow = true;
  mainTub.receiveShadow = true;
  chassis.add(mainTub);

  // Front sloped hood
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.28, 1.2), paintMat);
  hood.position.set(0, 0.52, 1.1);
  hood.rotation.x = -0.12;
  hood.castShadow = true;
  chassis.add(hood);

  // Front wedge nose & splitter
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.08, 0.45), carbonMat);
  splitter.position.set(0, 0.14, 1.95);
  chassis.add(splitter);

  // Front grille intake
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.24, 0.08), carbonMat);
  grille.position.set(0, 0.32, 2.02);
  chassis.add(grille);

  // Hood central stripe
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.3 });
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.02, 3.35), stripeMat);
  stripe.position.set(0, 0.72, 0.1);
  chassis.add(stripe);

  // Side skirts & rear air diffusers
  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 2.4), carbonMat);
    skirt.position.set(0.88 * side, 0.22, -0.1);
    chassis.add(skirt);

    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.32, 0.5), accentPaintMat);
    scoop.position.set(0.86 * side, 0.52, -0.35);
    chassis.add(scoop);
  }

  // ---- Cockpit Canopy / Windshield
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.54, 1.4), glassMat);
  cabin.position.set(0, 0.88, -0.2);
  cabin.castShadow = true;
  chassis.add(cabin);

  // Roof cap
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.08, 0.85), paintMat);
  roof.position.set(0, 1.16, -0.22);
  chassis.add(roof);

  // Driver Helmet inside
  const driverGroup = new THREE.Group();
  driverGroup.position.set(0, 0.82, -0.15);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14), accentPaintMat);
  driverGroup.add(helmet);
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.1, 0.14),
    new THREE.MeshPhysicalMaterial({ color: 0x00f0ff, roughness: 0.1, clearcoat: 1, emissive: 0x00aacc, emissiveIntensity: 0.4 }),
  );
  visor.position.set(0, 0.02, 0.18);
  driverGroup.add(visor);
  chassis.add(driverGroup);

  // Headlights & Tail Lights
  const headlights: THREE.Mesh[] = [];
  const taillights: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.15, 0.08), headLightMat);
    hl.position.set(0.6 * side, 0.45, 2.02);
    chassis.add(hl);
    headlights.push(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.08), tailLightMat);
    tl.position.set(0.58 * side, 0.54, -1.71);
    chassis.add(tl);
    taillights.push(tl);
  }

  // Dual Rear Exhaust Pipes
  for (const side of [-1, 1]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.45, 14), chromeMat);
    ex.rotation.x = Math.PI / 2;
    ex.position.set(0.38 * side, 0.3, -1.72);
    chassis.add(ex);
  }

  // Nitro Exhaust Flame Effect
  const flameGeo = new THREE.ConeGeometry(0.28, 1.2, 16);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, 0.3, -2.3);
  chassis.add(flame);

  const flameLight = new THREE.PointLight(0x00f0ff, 0, 10);
  flameLight.position.set(0, 0.3, -2.2);
  chassis.add(flameLight);

  // ---- Spoiler Accessories
  let sirenLight: { red: THREE.Mesh; blue: THREE.Mesh } | undefined = undefined;

  if (hat === "cap") {
    // Carbon GT Racing Wing
    const wingGroup = new THREE.Group();
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.5), carbonMat);
    wingBlade.position.set(0, 1.05, -1.52);
    wingBlade.castShadow = true;
    wingGroup.add(wingBlade);

    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.28), carbonMat);
      strut.position.set(0.65 * side, 0.78, -1.52);
      wingGroup.add(strut);
      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.58), paintMat);
      endplate.position.set(0.98 * side, 1.05, -1.52);
      wingGroup.add(endplate);
    }
    chassis.add(wingGroup);
  } else if (hat === "leaf") {
    // Twin Supercharger Blowers
    const blowerMat = new THREE.MeshStandardMaterial({ color: 0xff4500, roughness: 0.2, metalness: 0.8, emissive: 0x661100, emissiveIntensity: 0.4 });
    for (const side of [-1, 1]) {
      const blower = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.45, 14), blowerMat);
      blower.rotation.x = Math.PI / 2;
      blower.position.set(0.35 * side, 0.84, 0.95);
      chassis.add(blower);
    }
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.07, 0.4), paintMat);
    wing.position.set(0, 0.88, -1.52);
    chassis.add(wing);
  } else if (hat === "crown") {
    // Golden Crown Ornament
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.2, metalness: 0.9, emissive: 0xaa8800, emissiveIntensity: 0.3 });
    const crownOrnament = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.18, 0.32, 8), crownMat);
    crownOrnament.position.set(0, 0.92, 1.25);
    chassis.add(crownOrnament);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 0.42), crownMat);
    wing.position.set(0, 0.9, -1.52);
    chassis.add(wing);
  } else if (hat === "goggles") {
    // Police Lightbar
    const sirenGroup = new THREE.Group();
    sirenGroup.position.set(0, 1.28, -0.22);
    const sirenBase = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.2), carbonMat);
    sirenGroup.add(sirenBase);

    const redLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.14, 0.16),
      new THREE.MeshStandardMaterial({ color: 0xff0022, emissive: 0xff0022, emissiveIntensity: 1.5 }),
    );
    redLight.position.x = -0.22;
    sirenGroup.add(redLight);

    const blueLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.14, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x0066ff, emissive: 0x0066ff, emissiveIntensity: 1.5 }),
    );
    blueLight.position.x = 0.22;
    sirenGroup.add(blueLight);

    sirenLight = { red: redLight, blue: blueLight };
    chassis.add(sirenGroup);
  } else {
    // Standard Wing
    const wingGroup = new THREE.Group();
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 0.42), paintMat);
    wingBlade.position.set(0, 0.88, -1.52);
    wingBlade.castShadow = true;
    wingGroup.add(wingBlade);
    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.22), carbonMat);
      strut.position.set(0.55 * side, 0.68, -1.52);
      wingGroup.add(strut);
    }
    chassis.add(wingGroup);
  }

  // ---- 4 Deep-Dish Wheels
  const wheels: THREE.Mesh[] = [];
  const frontSteerHubs: THREE.Group[] = [];

  const wheelPositions = [
    { x: -0.88, y: 0.38, z: 1.18, isFront: true },  // Front Left
    { x: 0.88, y: 0.38, z: 1.18, isFront: true },   // Front Right
    { x: -0.9, y: 0.4, z: -1.1, isFront: false },  // Rear Left
    { x: 0.9, y: 0.4, z: -1.1, isFront: false },   // Rear Right
  ];

  wheelPositions.forEach((pos) => {
    const hub = new THREE.Group();
    hub.position.set(pos.x, pos.y, pos.z);
    body.add(hub);

    if (pos.isFront) {
      frontSteerHubs.push(hub);
    }

    const wheelGroup = new THREE.Group();

    // Tire
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheelGroup.add(tire);

    // Rim
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);

    // Rim spokes
    const spoke = new THREE.Mesh(spokeGeo, paintMat);
    spoke.rotation.z = Math.PI / 2;
    wheelGroup.add(spoke);

    hub.add(wheelGroup);
    wheels.push(tire);
  });

  // Soft Contact Shadow
  const shadowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
    grad.addColorStop(0, "rgba(0,0,0,0.75)");
    grad.addColorStop(0.6, "rgba(0,0,0,0.35)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();

  const shadowBlob = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 4.0),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  );
  shadowBlob.rotation.x = -Math.PI / 2;
  shadowBlob.position.y = 0.04;
  root.add(shadowBlob);

  return { root, body, wheels, frontSteerHubs, flame, flameLight, headlights, taillights, sirenLight };
}

export function animateCar(
  p: CarParts,
  t: number,
  speed01: number,
  airborne: number,
  stumble: number,
  steerAngle: number,
  boostActive: boolean,
) {
  // Wheel spinning
  const spinSpeed = speed01 * 26;
  for (const w of p.wheels) {
    w.rotation.x += spinSpeed * 0.016;
  }

  // Front wheel steering angle
  const targetSteer = steerAngle * 0.42;
  for (const hub of p.frontSteerHubs) {
    hub.rotation.y = targetSteer;
  }

  // Body roll into turns
  p.body.rotation.z = -steerAngle * 0.09 + stumble * 0.35;

  // Pitch on acceleration/stumble
  p.body.rotation.x = -speed01 * 0.05 + stumble * 0.2;

  // Suspension bounce
  const bounce = Math.sin(t * 18) * 0.02 * speed01;
  p.body.position.y = bounce + airborne * 0.35;

  // Nitro Flame Exhaust
  if (boostActive || speed01 > 1.05) {
    const intensity = Math.min(1, Math.max(0.4, speed01));
    (p.flame.material as THREE.MeshBasicMaterial).opacity = 0.9;
    p.flame.scale.set(1 + Math.random() * 0.3, 1 + Math.random() * 0.5, 1 + Math.random() * 0.3);
    p.flameLight.intensity = intensity * 5.0;
  } else {
    (p.flame.material as THREE.MeshBasicMaterial).opacity = 0;
    p.flameLight.intensity = 0;
  }

  // Flashing police siren
  if (p.sirenLight) {
    const flash = Math.floor(t * 12) % 2 === 0;
    (p.sirenLight.red.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 2.0 : 0.1;
    (p.sirenLight.blue.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 0.1 : 2.0;
  }
}
