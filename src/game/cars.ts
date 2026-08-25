import * as THREE from "three";

export type CarParts = {
  root: THREE.Group;
  body: THREE.Group;
  wheels: THREE.Mesh[];
  frontSteerHubs: THREE.Group[];
  flame: THREE.Mesh;
  flameLight: THREE.PointLight;
  headlights: THREE.Mesh[];
  sirenLight?: { red: THREE.Mesh; blue: THREE.Mesh };
};

const wheelTireGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 24);
const wheelRimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.29, 16);
const carBodyGeo = new THREE.BoxGeometry(1.6, 0.65, 3.2);

function carPaintMaterial(hex: string) {
  const c = new THREE.Color(hex);
  return new THREE.MeshPhysicalMaterial({
    color: c,
    roughness: 0.22,
    metalness: 0.35,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    reflectivity: 0.9,
  });
}

export function makeCar(color: string, hat: string): CarParts {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const paintMat = carPaintMaterial(color);
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.5, metalness: 0.4 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe0e6ed, roughness: 0.1, metalness: 0.9 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0c141f,
    roughness: 0.1,
    metalness: 0.2,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.82,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.8, metalness: 0.1 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd2d8e0, roughness: 0.2, metalness: 0.8 });
  const rimAccentMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.3, metalness: 0.5 });
  const headLightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f7ff,
    emissiveIntensity: 0.9,
    roughness: 0.1,
  });
  const tailLightMat = new THREE.MeshStandardMaterial({
    color: 0xff2233,
    emissive: 0xff1122,
    emissiveIntensity: 0.8,
    roughness: 0.2,
  });

  // ---- Main Chassis Body
  const chassis = new THREE.Group();
  body.add(chassis);

  // Lower main tub
  const mainTub = new THREE.Mesh(carBodyGeo, paintMat);
  mainTub.position.y = 0.42;
  mainTub.castShadow = true;
  mainTub.receiveShadow = true;
  chassis.add(mainTub);

  // Front wedge nose / splitter
  const noseGeo = new THREE.BoxGeometry(1.54, 0.22, 0.9);
  const nose = new THREE.Mesh(noseGeo, paintMat);
  nose.position.set(0, 0.25, 1.8);
  nose.castShadow = true;
  chassis.add(nose);

  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.06, 0.4), darkMat);
  splitter.position.set(0, 0.12, 2.05);
  chassis.add(splitter);

  // Front grille intake
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.08), darkMat);
  grille.position.set(0, 0.28, 2.22);
  chassis.add(grille);

  // Side skirts & air intakes
  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 2.2), darkMat);
    skirt.position.set(0.84 * side, 0.22, 0);
    chassis.add(skirt);

    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.4), darkMat);
    intake.position.set(0.82 * side, 0.45, -0.4);
    chassis.add(intake);
  }

  // Hood scoop / power bulge
  const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.1, 0.9), paintMat);
  scoop.position.set(0, 0.78, 0.9);
  chassis.add(scoop);

  // Dual racing stripe down the center
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.2 });
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 3.2), stripeMat);
  stripe.position.set(0, 0.75, 0.2);
  chassis.add(stripe);

  // ---- Cockpit Canopy / Windshield
  const cabinGeo = new THREE.BoxGeometry(1.28, 0.52, 1.35);
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, 0.88, -0.15);
  cabin.castShadow = true;
  chassis.add(cabin);

  // Cabin roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.08, 0.8), paintMat);
  roof.position.set(0, 1.15, -0.2);
  chassis.add(roof);

  // Driver Helmet inside cockpit
  const driverGroup = new THREE.Group();
  driverGroup.position.set(0, 0.82, -0.1);
  const helmetMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).clone().offsetHSL(0, 0.2, -0.1), roughness: 0.3 });
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 14), helmetMat);
  driverGroup.add(helmet);
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.09, 0.12),
    new THREE.MeshPhysicalMaterial({ color: 0x111d2b, roughness: 0.1, clearcoat: 1 }),
  );
  visor.position.set(0, 0.02, 0.16);
  driverGroup.add(visor);
  chassis.add(driverGroup);

  // Headlights & Tail Lights
  const headlights: THREE.Mesh[] = [];
  const taillights: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.08), headLightMat);
    hl.position.set(0.58 * side, 0.42, 2.22);
    chassis.add(hl);
    headlights.push(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.08), tailLightMat);
    tl.position.set(0.56 * side, 0.52, -1.61);
    chassis.add(tl);
    taillights.push(tl);
  }

  // Dual Rear Exhaust Pipes
  const exhausts: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.4, 12), chromeMat);
    ex.rotation.x = Math.PI / 2;
    ex.position.set(0.35 * side, 0.28, -1.7);
    chassis.add(ex);
    exhausts.push(ex);
  }

  // Nitro Exhaust Flame Effect (activated during boost)
  const flameGeo = new THREE.ConeGeometry(0.22, 0.9, 12);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, 0.28, -2.15);
  chassis.add(flame);

  const flameLight = new THREE.PointLight(0x00e1ff, 0, 8);
  flameLight.position.set(0, 0.28, -2.1);
  chassis.add(flameLight);

  // ---- Rear Spoiler / Wing Accessories based on "hat" parameter
  let sirenLight: { red: THREE.Mesh; blue: THREE.Mesh } | undefined = undefined;

  if (hat === "cap") {
    // Carbon Fiber GT Wing
    const wingGroup = new THREE.Group();
    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.4, metalness: 0.6 });
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.45), carbonMat);
    wingBlade.position.set(0, 0.95, -1.45);
    wingBlade.castShadow = true;
    wingGroup.add(wingBlade);
    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.25), carbonMat);
      strut.position.set(0.6 * side, 0.7, -1.45);
      wingGroup.add(strut);
      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.5), paintMat);
      endplate.position.set(0.92 * side, 0.95, -1.45);
      wingGroup.add(endplate);
    }
    chassis.add(wingGroup);
  } else if (hat === "leaf") {
    // Twin Supercharger Turbo Blowers on hood!
    const blowerMat = new THREE.MeshStandardMaterial({ color: 0xff4500, roughness: 0.2, metalness: 0.8 });
    for (const side of [-1, 1]) {
      const blower = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 12), blowerMat);
      blower.rotation.x = Math.PI / 2;
      blower.position.set(0.32 * side, 0.82, 1.1);
      chassis.add(blower);
    }
    // standard rear wing
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.35), paintMat);
    wing.position.set(0, 0.82, -1.45);
    chassis.add(wing);
  } else if (hat === "crown") {
    // Golden Crown Hood Ornament
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.2, metalness: 0.9 });
    const crownOrnament = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.28, 8), crownMat);
    crownOrnament.position.set(0, 0.88, 1.4);
    chassis.add(crownOrnament);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.38), crownMat);
    wing.position.set(0, 0.86, -1.45);
    chassis.add(wing);
  } else if (hat === "goggles") {
    // Police / Safety Siren Lightbar on roof!
    const sirenGroup = new THREE.Group();
    sirenGroup.position.set(0, 1.25, -0.2);
    const sirenBase = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.18), darkMat);
    sirenGroup.add(sirenBase);

    const redLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.12, 0.14),
      new THREE.MeshStandardMaterial({ color: 0xff0022, emissive: 0xff0022, emissiveIntensity: 1 }),
    );
    redLight.position.x = -0.2;
    sirenGroup.add(redLight);

    const blueLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.12, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x0066ff, emissive: 0x0066ff, emissiveIntensity: 1 }),
    );
    blueLight.position.x = 0.2;
    sirenGroup.add(blueLight);

    sirenLight = { red: redLight, blue: blueLight };
    chassis.add(sirenGroup);
  } else {
    // Standard GT Rear Wing
    const wingGroup = new THREE.Group();
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.38), paintMat);
    wingBlade.position.set(0, 0.82, -1.45);
    wingBlade.castShadow = true;
    wingGroup.add(wingBlade);
    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.2), darkMat);
      strut.position.set(0.5 * side, 0.64, -1.45);
      wingGroup.add(strut);
    }
    chassis.add(wingGroup);
  }

  // ---- 4 Wheels Mounted on Steering Hubs
  const wheels: THREE.Mesh[] = [];
  const frontSteerHubs: THREE.Group[] = [];

  const wheelPositions = [
    { x: -0.82, y: 0.36, z: 1.15, isFront: true },  // Front Left
    { x: 0.82, y: 0.36, z: 1.15, isFront: true },   // Front Right
    { x: -0.84, y: 0.38, z: -1.05, isFront: false }, // Rear Left
    { x: 0.84, y: 0.38, z: -1.05, isFront: false },  // Rear Right
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
    const tire = new THREE.Mesh(wheelTireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheelGroup.add(tire);

    // Rim
    const rim = new THREE.Mesh(wheelRimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);

    // Rim spoke accent lines
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.3), rimAccentMat);
    spoke.rotation.z = Math.PI / 2;
    wheelGroup.add(spoke);

    hub.add(wheelGroup);
    wheels.push(tire);
  });

  // Contact Shadow underneath car
  const shadowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
    grad.addColorStop(0, "rgba(0,0,0,0.65)");
    grad.addColorStop(0.6, "rgba(0,0,0,0.3)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();

  const shadowBlob = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 3.8),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  );
  shadowBlob.rotation.x = -Math.PI / 2;
  shadowBlob.position.y = 0.04;
  root.add(shadowBlob);

  return { root, body, wheels, frontSteerHubs, flame, flameLight, headlights, sirenLight };
}

export function animateCar(
  p: CarParts,
  t: number,
  speed01: number,
  airborne: number,
  stumble: number,
  steerAngle: number, // -1 to 1 (left to right)
  boostActive: boolean,
) {
  // Wheels spin proportionally to speed
  const spinSpeed = speed01 * 24;
  for (const w of p.wheels) {
    w.rotation.x += spinSpeed * 0.016;
  }

  // Front wheels turn in direction of steering
  const targetSteer = steerAngle * 0.42; // radians (~24 degrees)
  for (const hub of p.frontSteerHubs) {
    hub.rotation.y = targetSteer;
  }

  // Body roll / tilt into turns
  p.body.rotation.z = -steerAngle * 0.08 + stumble * 0.4;

  // Suspension pitch (pitch back slightly during acceleration, pitch forward during braking/stumble)
  p.body.rotation.x = -speed01 * 0.04 + stumble * 0.2;

  // Body height bounce based on speed & airborne
  const bounce = Math.sin(t * 18) * 0.02 * speed01;
  p.body.position.y = bounce + airborne * 0.35;

  // Nitro Flame Exhaust effect
  if (boostActive || speed01 > 1.05) {
    const intensity = Math.min(1, Math.max(0.4, speed01));
    (p.flame.material as THREE.MeshBasicMaterial).opacity = 0.85;
    p.flame.scale.set(1 + Math.random() * 0.3, 1 + Math.random() * 0.5, 1 + Math.random() * 0.3);
    p.flameLight.intensity = intensity * 4.5;
  } else {
    (p.flame.material as THREE.MeshBasicMaterial).opacity = 0;
    p.flameLight.intensity = 0;
  }

  // Flashing police siren if equipped
  if (p.sirenLight) {
    const flash = Math.floor(t * 12) % 2 === 0;
    (p.sirenLight.red.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 1.5 : 0.1;
    (p.sirenLight.blue.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 0.1 : 1.5;
  }
}
