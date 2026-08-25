"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { makeCar, animateCar } from "@/game/cars";

export default function CharacterPreview({
  color,
  hat,
  height = 200,
}: {
  color: string;
  hat: string;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(32, canvas.clientWidth / canvas.clientHeight, 0.1, 60);
    cam.position.set(3.15, 1.85, 5.4);
    cam.lookAt(0, 0.55, 0);

    scene.add(new THREE.HemisphereLight(0xd7ecff, 0x1a2418, 0.85));
    const key = new THREE.DirectionalLight(0xfff1d6, 2.8);
    key.position.set(3.4, 5.2, 3.6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 20;
    key.shadow.bias = -0.002;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x35e08a, 1.5);
    rim.position.set(-3.5, 2.5, -3);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0x88bbff, 0.5);
    fill.position.set(-2, 1, 3);
    scene.add(fill);

    // studio floor disc that catches the contact shadow
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 48),
      new THREE.ShadowMaterial({ opacity: 0.4 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.8, 1.88, 64),
      new THREE.MeshBasicMaterial({ color: 0x35e08a, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    const parts = makeCar(color, hat);
    parts.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
      }
    });
    scene.add(parts.root);

    let raf = 0;
    const clock = new THREE.Clock();
    let t = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = clock.getDelta();
      t += dt;
      parts.root.rotation.y = Math.sin(t * 0.5) * 0.45 + Math.PI * 0.82;
      const steer = Math.sin(t * 2) * 0.3;
      animateCar(parts, t, 0.2, 0, 0, steer, false);
      ring.rotation.z += dt * 0.4;
      renderer.render(scene, cam);
    };
    loop();

    const onResize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);
    onResize();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
  }, [color, hat]);

  return <canvas ref={ref} style={{ height, width: "100%" }} className="block" />;
}
