"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { AgentState } from "@/types/agent";

const CREW_NAMES = ["marketing", "frontend", "backend", "mobile", "images", "planning"];
const CREW_LABELS = ["Marketing", "Frontend", "Backend", "Mobile", "Images", "Planning"];
const CREW_COLORS_HEX = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xf9ca24, 0x6c5ce7, 0x00b894];
const DESK_POSITIONS: [number, number, number][] = [
  [-5, 0, -4], [0, 0, -4], [5, 0, -4],
  [-5, 0, 2],  [0, 0, 2],  [5, 0, 2],
];

function statusHex(status: string): number {
  if (status === "working") return 0x00ff88;
  if (status === "complete") return 0x4fc3f7;
  if (status === "error") return 0xff5252;
  return 0x334466;
}

function mkMesh(geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number]): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  return m;
}

function buildDesk(color: number): THREE.Group {
  const g = new THREE.Group();

  g.add(mkMesh(
    new THREE.BoxGeometry(2, 0.08, 1),
    new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.3, metalness: 0.6 }),
    [0, 0.4, 0]
  ));

  const mon = mkMesh(
    new THREE.BoxGeometry(1.5, 0.9, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x050510, emissive: color, emissiveIntensity: 0.4, roughness: 0.1 }),
    [0, 0.95, -0.35]
  );
  g.add(mon);

  g.add(mkMesh(
    new THREE.BoxGeometry(0.08, 0.5, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x111122 }),
    [0, 0.68, -0.35]
  ));
  g.add(mkMesh(
    new THREE.BoxGeometry(0.7, 0.07, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x16213e }),
    [0, 0.3, 0.8]
  ));
  g.add(mkMesh(
    new THREE.BoxGeometry(0.7, 0.7, 0.07),
    new THREE.MeshStandardMaterial({ color: 0x16213e }),
    [0, 0.65, 1.1]
  ));

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 1.4, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  g.add(ring);

  const light = new THREE.PointLight(color, 0.8, 5);
  light.position.set(0, 2, 0);
  g.add(light);

  (g as any)._monitorMat = mon.material as THREE.MeshStandardMaterial;
  (g as any)._light = light;
  return g;
}

export interface OfficeHandle {
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
}

export default function OfficeScene({
  agentStates,
  onReady,
}: {
  agentStates: Record<string, AgentState>;
  onReady?: (handle: OfficeHandle) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(agentStates);

  // keep latest state accessible inside animation loop
  useEffect(() => { stateRef.current = agentStates; }, [agentStates]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    // ── Renderer ────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x020210, 1);
    el.appendChild(renderer.domElement);

    // ── Scene + Camera ───────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020210, 0.045);

    const camera = new THREE.PerspectiveCamera(75, el.clientWidth / el.clientHeight, 0.1, 100);
    camera.position.set(0, 1.6, 5);
    onReady?.({ camera, renderer });

    // ── Lights ───────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x1a1a4e, 0.5));
    const ceiling = new THREE.PointLight(0x2244aa, 1.5, 20);
    ceiling.position.set(0, 4.5, 0);
    scene.add(ceiling);

    // ── Floor ────────────────────────────────────────────────────────────
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 20),
      new THREE.MeshStandardMaterial({ color: 0x07071a, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    // grid
    scene.add(new THREE.GridHelper(30, 30, 0x1a1a4e, 0x0d0d2e));

    // ── Walls ────────────────────────────────────────────────────────────
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0a0a1f });
    const walls: [number, number, number, number, number, number, number][] = [
      [0, 2.5, -7,   30, 5, 0.2, 0],
      [0, 2.5,  7,   30, 5, 0.2, 0],
      [-8, 2.5, 0,  0.2, 5, 14,  0],
      [ 8, 2.5, 0,  0.2, 5, 14,  0],
      [0, 5,    0,   30, 0.2, 20, 0],
    ];
    walls.forEach(([x, y, z, w, h, d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      m.position.set(x, y, z);
      scene.add(m);
    });

    // ── Neon strips ──────────────────────────────────────────────────────
    const neons = [
      { color: 0xff006e, x: -7.8 },
      { color: 0x3a86ff, x: -7.8, yo: 1.2 },
      { color: 0x8338ec, x: -7.8, yo: 2.4 },
      { color: 0xff006e, x: 7.8 },
      { color: 0x3a86ff, x: 7.8, yo: 1.2 },
      { color: 0x8338ec, x: 7.8, yo: 2.4 },
    ];
    neons.forEach(({ color, x, yo = 0 }) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, 12),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2 })
      );
      m.position.set(x, 1 + yo, 0);
      scene.add(m);
      const light = new THREE.PointLight(color, 0.3, 6);
      light.position.set(x, 1 + yo, 0);
      scene.add(light);
    });
    // ceiling neon
    const cNeon = new THREE.Mesh(
      new THREE.BoxGeometry(14, 0.05, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x00f5ff, emissive: 0x00f5ff, emissiveIntensity: 2 })
    );
    cNeon.position.set(0, 4.9, -6.5);
    scene.add(cNeon);

    // ── Desks ────────────────────────────────────────────────────────────
    const deskGroups: THREE.Group[] = [];
    CREW_NAMES.forEach((crew, i) => {
      const dg = buildDesk(CREW_COLORS_HEX[i]);
      dg.position.set(...DESK_POSITIONS[i]);
      scene.add(dg);
      deskGroups.push(dg);
    });

    // ── FPS Controls ─────────────────────────────────────────────────────
    const keys: Record<string, boolean> = {};
    let yaw = 0, pitch = -0.2;
    let isLocked = false;

    const onKeyDown = (e: KeyboardEvent) => { keys[e.code] = true; };
    const onKeyUp   = (e: KeyboardEvent) => { keys[e.code] = false; };
    const onMouseMove = (e: MouseEvent) => {
      if (!isLocked) return;
      yaw -= e.movementX * 0.002;
      pitch = Math.max(-1.2, Math.min(0.4, pitch - e.movementY * 0.002));
    };
    const onLockChange = () => { isLocked = document.pointerLockElement === renderer.domElement; };
    const onClick = () => { renderer.domElement.requestPointerLock(); };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onLockChange);
    renderer.domElement.addEventListener("click", onClick);

    // ── Resize ───────────────────────────────────────────────────────────
    const onResize = () => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener("resize", onResize);

    // ── Animate ──────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let rafId = 0;

    function animate() {
      rafId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Movement
      const speed = 4 * delta;
      const sinY = Math.sin(yaw), cosY = Math.cos(yaw);
      const fwd = new THREE.Vector3(-sinY, 0, -cosY);
      const right = new THREE.Vector3(cosY, 0, -sinY);
      if (keys["KeyW"] || keys["ArrowUp"])    camera.position.addScaledVector(fwd, speed);
      if (keys["KeyS"] || keys["ArrowDown"])  camera.position.addScaledVector(fwd, -speed);
      if (keys["KeyA"] || keys["ArrowLeft"])  camera.position.addScaledVector(right, -speed);
      if (keys["KeyD"] || keys["ArrowRight"]) camera.position.addScaledVector(right, speed);
      camera.position.x = Math.max(-7, Math.min(7, camera.position.x));
      camera.position.z = Math.max(-6, Math.min(6, camera.position.z));
      camera.position.y = 1.6;

      camera.rotation.order = "YXZ";
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;

      // Update desk lights/glow per agent state
      const states = stateRef.current;
      deskGroups.forEach((dg, i) => {
        const crew = CREW_NAMES[i];
        const st = states[crew]?.status ?? "idle";
        const light = (dg as any)._light as THREE.PointLight;
        const mat = (dg as any)._monitorMat as THREE.MeshStandardMaterial;
        const sc = statusHex(st);
        light.color.setHex(sc);
        if (st === "working") {
          light.intensity = 1.5 + Math.sin(elapsed * 3) * 0.5;
          mat.emissiveIntensity = 0.7 + Math.sin(elapsed * 3) * 0.3;
        } else {
          light.intensity = 0.5;
          mat.emissiveIntensity = 0.2;
        }
      });

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onLockChange);
      renderer.domElement.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []); // only once

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
