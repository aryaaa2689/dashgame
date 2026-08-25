import * as THREE from "three";

export type CarParts = {
  root: THREE.Group;
  body: THREE.Group;
  wheels: THREE.Object3D[];
  frontSteerHubs: THREE.Group[];
  flame: THREE.Mesh;
  flameInner: THREE.Mesh;
  flameLight: THREE.PointLight;
  headlights: THREE.Mesh[];
  taillights: THREE.Mesh[];
  sirenLight?: { red: THREE.Mesh; blue: THREE.Mesh };
  shadow: THREE.Mesh;
};

const tireGeo = new THREE.TorusGeometry(0.34, 0.13, 10, 18);
const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.16, 14);

export function makeCar(colorHex: string, hat: string): CarParts {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const paint = new THREE.Color(colorHex);
  const dark = paint.clone().offsetHSL(0, -0.05, -0.22);
  const paintMat = new THREE.MeshStandardMaterial({
    color: paint,
    roughness: 0.28,
    metalness: 0.55,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.32, metalness: 0.5 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.4, metalness: 0.65 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x081018,
    roughness: 0.08,
    metalness: 0.2,
    transparent: true,
    opacity: 0.72,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd5dee8, roughness: 0.2, metalness: 0.85 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbfefff, emissiveIntensity: 1.8 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2040, emissive: 0xff1230, emissiveIntensity: 1.6 });

  // Low GT hull — rounded by stacking tapered volumes
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.38, 3.15), paintMat);
  hull.position.y = 0.46;
  hull.castShadow = true;
  body.add(hull);

  const cabinBase = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.22, 1.7), paintMat);
  cabinBase.position.set(0, 0.68, -0.08);
  cabinBase.castShadow = true;
  body.add(cabinBase);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 0.85), paintMat);
  nose.position.set(0, 0.5, 1.38);
  nose.rotation.x = -0.18;
  body.add(nose);

  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.38), carbon);
  splitter.position.set(0, 0.2, 1.72);
  body.add(splitter);

  const windshield = new THREE.Mesh(new THREE.SphereGeometry(0.78, 14, 10, 0, Math.PI, 0.15, 1.1), glass);
  windshield.scale.set(0.92, 0.55, 0.85);
  windshield.position.set(0, 0.78, 0.18);
  windshield.rotation.x = 0.15;
  body.add(windshield);

  const roof = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8, 0, Math.PI * 2, 0, 1.1), paintMat);
  roof.scale.set(1.05, 0.42, 0.95);
  roof.position.set(0, 0.86, -0.22);
  body.add(roof);

  const rear = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.28, 0.7), darkMat);
  rear.position.set(0, 0.5, -1.38);
  body.add(rear);

  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 2.2), carbon);
    skirt.position.set(0.86 * side, 0.26, 0);
    body.add(skirt);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.1), carbon);
    mirror.position.set(0.88 * side, 0.78, 0.32);
    body.add(mirror);
  }

  const headlights: THREE.Mesh[] = [];
  const taillights: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.22, 4, 8), headMat);
    hl.rotation.z = Math.PI / 2;
    hl.position.set(0.52 * side, 0.44, 1.78);
    body.add(hl);
    headlights.push(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.05), tailMat);
    tl.position.set(0.5 * side, 0.54, -1.74);
    body.add(tl);
    taillights.push(tl);
  }

  let sirenLight: { red: THREE.Mesh; blue: THREE.Mesh } | undefined;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.05, 0.36), hat === "crown" ? new THREE.MeshStandardMaterial({ color: 0xffd24a, metalness: 0.85, roughness: 0.22 }) : hat === "cap" ? carbon : paintMat);
  wing.position.set(0, hat === "cap" ? 1.02 : 0.86, -1.48);
  body.add(wing);
  if (hat === "cap") {
    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.16), carbon);
      strut.position.set(0.55 * side, 0.8, -1.46);
      body.add(strut);
    }
  } else if (hat === "goggles") {
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.14), new THREE.MeshStandardMaterial({ color: 0xff1230, emissive: 0xff1230, emissiveIntensity: 1.6 }));
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.14), new THREE.MeshStandardMaterial({ color: 0x2277ff, emissive: 0x2277ff, emissiveIntensity: 1.6 }));
    red.position.set(-0.18, 1.12, -0.18);
    blue.position.set(0.18, 1.12, -0.18);
    body.add(red, blue);
    sirenLight = { red, blue };
  } else if (hat === "leaf") {
    const blower = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 10), new THREE.MeshStandardMaterial({ color: 0xff4a1a, metalness: 0.7, roughness: 0.25 }));
    blower.rotation.x = Math.PI / 2;
    blower.position.set(0, 0.78, 0.85);
    body.add(blower);
  }

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 1.05, 10),
    new THREE.MeshBasicMaterial({ color: 0x7af7ff, transparent: true, opacity: 0, depthWrite: false }),
  );
  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, 0.28, -2.15);
  body.add(flame);
  const flameInner = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.65, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
  );
  flameInner.rotation.x = -Math.PI / 2;
  flameInner.position.set(0, 0.28, -1.98);
  body.add(flameInner);
  const flameLight = new THREE.PointLight(0x4de8ff, 0, 8);
  flameLight.position.set(0, 0.3, -1.9);
  body.add(flameLight);

  const wheels: THREE.Object3D[] = [];
  const frontSteerHubs: THREE.Group[] = [];
  for (const pos of [
    { x: -0.82, z: 1.08, front: true },
    { x: 0.82, z: 1.08, front: true },
    { x: -0.84, z: -1.08, front: false },
    { x: 0.84, z: -1.08, front: false },
  ]) {
    const hub = new THREE.Group();
    hub.position.set(pos.x, 0.34, pos.z);
    body.add(hub);
    if (pos.front) frontSteerHubs.push(hub);
    const spin = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.y = Math.PI / 2;
    spin.add(tire);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    spin.add(rim);
    hub.add(spin);
    wheels.push(spin);
  }

  const sc = document.createElement("canvas");
  sc.width = sc.height = 64;
  const sg = sc.getContext("2d")!;
  const grd = sg.createRadialGradient(32, 32, 4, 32, 32, 30);
  grd.addColorStop(0, "rgba(0,0,0,0.55)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  sg.fillStyle = grd;
  sg.fillRect(0, 0, 64, 64);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 3.6),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  root.add(shadow);

  return { root, body, wheels, frontSteerHubs, flame, flameInner, flameLight, headlights, taillights, sirenLight, shadow };
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
  for (const w of p.wheels) w.rotation.x += speed01 * 32 * dt;

  const targetSteer = THREE.MathUtils.clamp(steerAngle, -1, 1) * 0.42;
  for (const hub of p.frontSteerHubs) hub.rotation.y += (targetSteer - hub.rotation.y) * Math.min(1, dt * 14);

  const squash = extras?.landSquash ?? 0;
  const slip = extras?.slip ?? 0;
  const lean = THREE.MathUtils.clamp(-steerAngle * 0.08 + slip * 0.05 + stumble * 0.06, -0.14, 0.14);
  p.body.rotation.z += (lean - p.body.rotation.z) * Math.min(1, dt * 10);
  p.body.rotation.x += ((extras?.pitch ?? 0) * 0.08 - speed01 * 0.02 - squash * 0.08 - p.body.rotation.x) * Math.min(1, dt * 10);
  p.body.position.y = airborne * 0.08 - squash * 0.08;

  const on = boostActive || speed01 > 1.12;
  const fm = p.flame.material as THREE.MeshBasicMaterial;
  const im = p.flameInner.material as THREE.MeshBasicMaterial;
  if (on) {
    fm.opacity = 0.82;
    im.opacity = 0.65;
    p.flame.scale.set(0.9 + Math.random() * 0.25, 0.85 + Math.random() * 0.4, 1);
    p.flameLight.intensity = 3.4;
  } else {
    fm.opacity = Math.max(0, fm.opacity - dt * 8);
    im.opacity = Math.max(0, im.opacity - dt * 8);
    p.flameLight.intensity = 0;
  }

  if (p.sirenLight) {
    const flash = Math.floor(t * 10) % 2 === 0;
    (p.sirenLight.red.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 2 : 0.1;
    (p.sirenLight.blue.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 0.1 : 2;
  }
  (p.shadow.material as THREE.MeshBasicMaterial).opacity = airborne > 0.05 ? 0.22 : 0.8;
}
