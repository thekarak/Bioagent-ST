"use client";

/**
 * DnaFigure — the landing hero's WebGL viewport: an interactive B-form DNA
 * duplex, procedurally built (two grooved backbone tubes, 26 instanced base
 * pairs, instanced phosphate nodes), orbited by two hairline rings with
 * travelling satellites and an ambient expression-particle field.
 *
 * Interactions: drag to orbit with inertia, pointer parallax, hover a base
 * pair to highlight it and read its record (bp index, bases, hydrogen bonds)
 * in a floating chip. Light theme renders a lit graphite studio model; the
 * dark theme switches the same geometry to emissive "observatory" materials
 * with additive particles.
 *
 * Robustness mirrors TissueField: deterministic data, WebGL fallback (a
 * static SVG helix over the dot grid), in-view frameloop pause, tab-hidden
 * pause, prefers-reduced-motion support, DPR cap and full GPU disposal.
 */

import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "../motion";
import { useLandingTheme } from "../theme";
import { GLOW_VERTEX, GLOW_FRAGMENT } from "./tissue-field-data";
import {
  BASE_COLORS,
  BP_COUNT,
  buildDnaParticles,
  buildDnaRungs,
  buildRingGeometry,
  buildStrandCurve,
  RING_RADII,
  type DnaRung,
} from "./dna-data";

/* ------------------------------------------------------------------ */
/* Shared mutable figure store (interaction surface  ->  scene)        */
/* ------------------------------------------------------------------ */

type FigureStore = {
  dragging: boolean;
  pointer: { x: number; y: number } | null;
  parX: number;
  parY: number;
  dragTilt: number;
  ry: number;
  rx: number;
  vy: number;
  hoveredBp: number;
  wrapEl: HTMLDivElement | null;
  tipEl: HTMLDivElement | null;
  tipMainEl: HTMLParagraphElement | null;
  tipSubEl: HTMLParagraphElement | null;
};

const figureStore: FigureStore = {
  dragging: false,
  pointer: null,
  parX: 0,
  parY: 0,
  dragTilt: 0,
  ry: -0.35,
  rx: 0.12,
  vy: 0,
  hoveredBp: -1,
  wrapEl: null,
  tipEl: null,
  tipMainEl: null,
  tipSubEl: null,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

const UP = new THREE.Vector3(0, 1, 0);

type RungHalf = {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  lenHalf: number;
  color: string;
};

function buildRungHalves(rungs: DnaRung[]): RungHalf[] {
  const halves: RungHalf[] = [];
  const dir = new THREE.Vector3();
  for (const r of rungs) {
    dir.subVectors(r.b, r.a);
    const len = dir.length();
    const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
    const quarterA = r.a.clone().addScaledVector(dir, 0.25);
    const quarterB = r.a.clone().addScaledVector(dir, 0.75);
    halves.push({ pos: quarterA, quat, lenHalf: len / 2, color: BASE_COLORS[r.baseA] });
    halves.push({ pos: quarterB, quat, lenHalf: len / 2, color: BASE_COLORS[r.baseB] });
  }
  return halves;
}

function DnaScene({ reduced, dark }: { reduced: boolean; dark: boolean }) {
  const rigRef = React.useRef<THREE.Group>(null);
  const rungMeshRef = React.useRef<THREE.InstancedMesh>(null);
  const pickMeshRef = React.useRef<THREE.InstancedMesh>(null);
  const nodeMeshRef = React.useRef<THREE.InstancedMesh>(null);
  const pivot1Ref = React.useRef<THREE.Group>(null);
  const pivot2Ref = React.useRef<THREE.Group>(null);
  const glowRef = React.useRef<THREE.Points>(null);
  const strandMatRef = React.useRef<THREE.MeshStandardMaterial>(null);

  const rungs = React.useMemo(() => buildDnaRungs(), []);
  const halves = React.useMemo(() => buildRungHalves(rungs), [rungs]);

  /* Backbone tubes + orbital rings + particle field (imperative geometry). */
  const strandGeoms = React.useMemo(
    () => [
      new THREE.TubeGeometry(buildStrandCurve(0), BP_COUNT * 8, 0.031, 10, false),
      new THREE.TubeGeometry(buildStrandCurve(1), BP_COUNT * 8, 0.031, 10, false),
    ],
    [],
  );
  const ringGeoms = React.useMemo(() => RING_RADII.map((r) => buildRingGeometry(r)), []);
  const particles = React.useMemo(() => buildDnaParticles(dark), [dark]);
  const particleGeom = React.useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(particles.positions, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(particles.colors, 3));
    g.setAttribute("aScale", new THREE.BufferAttribute(particles.scales, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(particles.phases, 1));
    return g;
  }, [particles]);

  React.useEffect(
    () => () => {
      strandGeoms.forEach((g) => g.dispose());
      ringGeoms.forEach((g) => g.dispose());
      particleGeom.dispose();
    },
    [strandGeoms, ringGeoms, particleGeom],
  );

  const glowUniforms = React.useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: dark ? 0.55 : 0.42 },
      uOpacity: { value: dark ? 0.62 : 0.34 },
      uTwinkle: { value: reduced ? 0.25 : 1 },
    }),
    [dark, reduced],
  );

  /* Instance the base-pair rungs and phosphate nodes. */
  const tmpMatrix = React.useMemo(() => new THREE.Matrix4(), []);
  const tmpScale = React.useMemo(() => new THREE.Vector3(), []);
  const tmpColor = React.useMemo(() => new THREE.Color(), []);

  React.useLayoutEffect(() => {
    const rm = rungMeshRef.current;
    const pm = pickMeshRef.current;
    const nm = nodeMeshRef.current;
    if (!rm || !pm || !nm) return;
    halves.forEach((h, i) => {
      tmpScale.set(1, h.lenHalf, 1);
      tmpMatrix.compose(h.pos, h.quat, tmpScale);
      rm.setMatrixAt(i, tmpMatrix);
      pm.setMatrixAt(i, tmpMatrix);
      rm.setColorAt(i, tmpColor.set(h.color));
    });
    rungs.forEach((r, i) => {
      [r.a, r.b].forEach((p, s) => {
        tmpScale.setScalar(1);
        tmpMatrix.compose(p, new THREE.Quaternion(), tmpScale);
        nm.setMatrixAt(i * 2 + s, tmpMatrix);
      });
      nm.setColorAt(i * 2, tmpColor.set(dark ? "#D9E2EE" : "#22262E"));
      nm.setColorAt(i * 2 + 1, tmpColor.set(dark ? "#D9E2EE" : "#22262E"));
    });
    rm.instanceMatrix.needsUpdate = true;
    pm.instanceMatrix.needsUpdate = true;
    nm.instanceMatrix.needsUpdate = true;
    if (rm.instanceColor) rm.instanceColor.needsUpdate = true;
    if (nm.instanceColor) nm.instanceColor.needsUpdate = true;
  }, [halves, rungs, dark, tmpMatrix, tmpColor, tmpScale]);

  /* Hover emphasis: the two cylinder halves of the hovered base pair grow. */
  const emphasis = React.useRef({ bp: -1, v: 1 });

  const applyHalf = React.useCallback(
    (i: number, mult: number) => {
      const rm = rungMeshRef.current;
      if (!rm) return;
      const h = halves[i];
      tmpScale.set(mult, h.lenHalf, mult);
      tmpMatrix.compose(h.pos, h.quat, tmpScale);
      rm.setMatrixAt(i, tmpMatrix);
      rm.instanceMatrix.needsUpdate = true;
    },
    [halves, tmpMatrix, tmpScale],
  );

  const showTip = React.useCallback((bp: number | null) => {
    const f = figureStore;
    const el = f.tipEl;
    if (!el) return;
    if (bp === null) {
      el.style.opacity = "0";
      return;
    }
    const r = rungs[bp];
    if (f.tipMainEl) {
      f.tipMainEl.textContent = `bp ${String(bp + 1).padStart(2, "0")} / ${BP_COUNT} · ${
        r.baseA
      }${r.bond === "GC" ? "≡" : "="}${r.baseB}`;
    }
    if (f.tipSubEl) {
      f.tipSubEl.textContent = `${r.bond === "GC" ? "3" : "2"} hydrogen bonds · 3.4 Å rise`;
    }
    el.style.opacity = "1";
  }, [rungs]);

  const positionTip = React.useCallback(() => {
    const f = figureStore;
    const el = f.tipEl;
    const wrap = f.wrapEl;
    if (!el || !wrap || !f.pointer) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const x = clamp(f.pointer.x + 16, 8, Math.max(8, w - 168));
    const y = clamp(f.pointer.y + 18, 8, Math.max(8, h - 64));
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }, []);

  const onRungPointer = React.useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const f = figureStore;
      if (f.dragging || e.instanceId === undefined) return;
      const bp = Math.floor(e.instanceId / 2);
      if (bp === emphasis.current.bp) return;
      /* restore previous pair */
      if (emphasis.current.bp >= 0) {
        applyHalf(emphasis.current.bp * 2, 1);
        applyHalf(emphasis.current.bp * 2 + 1, 1);
      }
      emphasis.current = { bp, v: 1 };
      f.hoveredBp = bp;
      showTip(bp);
      positionTip();
      if (f.wrapEl) f.wrapEl.style.cursor = "pointer";
    },
    [applyHalf, positionTip, showTip],
  );

  const onRungOut = React.useCallback(() => {
    const f = figureStore;
    if (emphasis.current.bp >= 0) {
      applyHalf(emphasis.current.bp * 2, 1);
      applyHalf(emphasis.current.bp * 2 + 1, 1);
    }
    emphasis.current = { bp: -1, v: 1 };
    f.hoveredBp = -1;
    showTip(null);
    if (f.wrapEl && !f.dragging) f.wrapEl.style.cursor = "grab";
  }, [applyHalf, showTip]);

  useFrame((state, dt) => {
    const f = figureStore;
    const t = state.clock.elapsedTime * (reduced ? 0.35 : 1);
    const g = rigRef.current;
    if (!g) return;

    /* Entrance: ease-out unspin + settle. */
    const k = reduced ? 1 : Math.min(1, t / 1.4);
    const intro = 1 - Math.pow(1 - k, 3);

    if (!f.dragging && !reduced) {
      f.ry += 0.16 * dt;
      if (Math.abs(f.vy) > 0.02) {
        f.ry += f.vy * dt;
        f.vy *= Math.pow(0.04, dt);
      } else {
        f.vy = 0;
      }
    }
    const par = reduced ? 0 : 1;
    const targetRx = clamp(0.12 + f.dragTilt + f.parY * 0.06 * par, -0.62, 0.85);
    f.rx += (targetRx - f.rx) * Math.min(1, dt * 5);

    g.rotation.y = f.ry + f.parX * 0.05 * par + (1 - intro) * 1.15;
    g.rotation.x = f.rx;
    g.position.y = reduced ? 0 : Math.sin(t * 0.55) * 0.045;
    g.scale.setScalar(0.9 + 0.1 * intro);

    /* Orbital satellites (pivots rotate around the tilted ring planes). */
    if (pivot1Ref.current) pivot1Ref.current.rotation.y = t * 0.22;
    if (pivot2Ref.current) pivot2Ref.current.rotation.y = -t * 0.15;

    /* Particle twinkle. */
    const glowMaterial = glowRef.current?.material as THREE.ShaderMaterial | undefined;
    if (glowMaterial) glowMaterial.uniforms.uTime.value = t;

    /* Soft emissive breathing on the backbones in dark mode. */
    if (strandMatRef.current) {
      strandMatRef.current.emissiveIntensity = dark
        ? 0.22 + (reduced ? 0 : 0.06 * Math.sin(t * 1.8))
        : 0;
    }

    /* Hover emphasis easing + drag dismissal. */
    const emph = emphasis.current;
    if (f.dragging && emph.bp >= 0) {
      applyHalf(emph.bp * 2, 1);
      applyHalf(emph.bp * 2 + 1, 1);
      emph.bp = -1;
      emph.v = 1;
      f.hoveredBp = -1;
      showTip(null);
      if (f.wrapEl) f.wrapEl.style.cursor = "grabbing";
    }
    const target = emph.bp >= 0 ? 1.45 : 1;
    if (Math.abs(target - emph.v) > 0.002) {
      emph.v += (target - emph.v) * Math.min(1, dt * 10);
      if (emph.bp >= 0) {
        applyHalf(emph.bp * 2, emph.v);
        applyHalf(emph.bp * 2 + 1, emph.v);
      }
    }
  });

  const ringColor = dark ? "#56B4E9" : "#111417";
  const ringOpacity = dark ? 0.34 : 0.16;

  return (
    <>
      <hemisphereLight
        args={dark ? ["#7C8CA0", "#05070A", 0.5] : ["#FFFFFF", "#E8EAEC", 1.05]}
      />
      <directionalLight
        position={[3.5, 4, 5]}
        intensity={dark ? 0.85 : 1.5}
        color={dark ? "#EAF2FF" : "#FFFFFF"}
      />
      <directionalLight
        position={[-4, 1.5, -3.5]}
        intensity={dark ? 1.15 : 0.5}
        color={dark ? "#56B4E9" : "#FFFFFF"}
      />

      <group ref={rigRef}>
        {/* backbone strands */}
        {strandGeoms.map((geom, i) => (
          <mesh key={i} geometry={geom} frustumCulled={false}>
            {dark ? (
              <meshStandardMaterial
                ref={i === 0 ? strandMatRef : undefined}
                color="#C7CFDA"
                roughness={0.42}
                metalness={0.32}
                emissive="#9FB4CC"
                emissiveIntensity={0.22}
              />
            ) : (
              <meshStandardMaterial color="#22262E" roughness={0.34} metalness={0.28} />
            )}
          </mesh>
        ))}

        {/* base-pair rungs (instanced halves, per-instance colors) */}
        <instancedMesh
          ref={rungMeshRef}
          args={[undefined, undefined, BP_COUNT * 2]}
          frustumCulled={false}
        >
          <cylinderGeometry args={[0.021, 0.021, 1, 10, 1]} />
          {dark ? (
            <meshBasicMaterial toneMapped={false} />
          ) : (
            <meshStandardMaterial roughness={0.4} metalness={0.08} toneMapped={false} />
          )}
        </instancedMesh>

        {/* invisible fat picking proxies — make hover targeting comfortable */}
        <instancedMesh
          ref={pickMeshRef}
          args={[undefined, undefined, BP_COUNT * 2]}
          frustumCulled={false}
          onPointerMove={onRungPointer}
          onPointerOut={onRungOut}
        >
          <cylinderGeometry args={[0.065, 0.065, 1, 6, 1]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </instancedMesh>

        {/* phosphate nodes */}
        <instancedMesh
          ref={nodeMeshRef}
          args={[undefined, undefined, BP_COUNT * 2]}
          frustumCulled={false}
        >
          <sphereGeometry args={[0.05, 18, 14]} />
          {dark ? (
            <meshStandardMaterial
              color="#D9E2EE"
              roughness={0.4}
              metalness={0.25}
              emissive="#EDF1F5"
              emissiveIntensity={0.28}
            />
          ) : (
            <meshStandardMaterial color="#22262E" roughness={0.34} metalness={0.28} />
          )}
        </instancedMesh>
      </group>

      {/* orbital hairlines + travelling satellites */}
      {[0, 1].map((i) => (
        <group
          key={i}
          rotation={i === 0 ? [Math.PI / 2 - 0.22, 0, 0.18] : [Math.PI / 2 + 0.28, 0, -0.3]}
        >
          <group ref={i === 0 ? pivot1Ref : pivot2Ref}>
            <lineLoop geometry={ringGeoms[i]} frustumCulled={false}>
              <lineBasicMaterial
                color={ringColor}
                transparent
                opacity={ringOpacity}
                depthWrite={false}
                toneMapped={false}
              />
            </lineLoop>
            <mesh position={[RING_RADII[i], 0, 0]}>
              <sphereGeometry args={[0.032, 12, 10]} />
              <meshBasicMaterial color={dark ? "#56B4E9" : "#111417"} toneMapped={false} />
            </mesh>
          </group>
        </group>
      ))}

      {/* ambient expression particles */}
      <points
        key={dark ? "particles-dark" : "particles-light"}
        ref={glowRef}
        geometry={particleGeom}
        frustumCulled={false}
      >
        <shaderMaterial
          vertexShader={GLOW_VERTEX}
          fragmentShader={GLOW_FRAGMENT}
          uniforms={glowUniforms}
          transparent
          depthWrite={false}
          blending={dark ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </points>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Figure viewport (canvas + interaction surface + record chip)        */
/* ------------------------------------------------------------------ */

export function DnaFigure({ className }: { className?: string }) {
  const [mounted, setMounted] = React.useState(false);
  const [webgl, setWebgl] = React.useState(false);
  const [inView, setInView] = React.useState(true);
  const [frameloop, setFrameloop] = React.useState<"always" | "never">("always");
  const reduced = usePrefersReducedMotion();
  const { isDark } = useLandingTheme();
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const tipRef = React.useRef<HTMLDivElement | null>(null);
  const tipMainRef = React.useRef<HTMLParagraphElement | null>(null);
  const tipSubRef = React.useRef<HTMLParagraphElement | null>(null);

  React.useEffect(() => {
    setWebgl(webglAvailable());
    setMounted(true);
    const f = figureStore;
    f.dragging = false;
    f.hoveredBp = -1;
    f.wrapEl = wrapRef.current;
    return () => {
      f.wrapEl = null;
    };
  }, []);

  /* The tooltip renders only once mounted+webgl — register its elements
     with the store at that point (not on first mount). */
  React.useEffect(() => {
    if (!(mounted && webgl)) return;
    const f = figureStore;
    f.tipEl = tipRef.current;
    f.tipMainEl = tipMainRef.current;
    f.tipSubEl = tipSubRef.current;
    return () => {
      f.tipEl = null;
      f.tipMainEl = null;
      f.tipSubEl = null;
    };
  }, [mounted, webgl]);

  /* Pause rendering offscreen / on hidden tabs. */
  React.useEffect(() => {
    const apply = () => setFrameloop(inView && !document.hidden ? "always" : "never");
    apply();
    const onVis = () => apply();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [inView]);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => setInView(entries.some((e) => e.isIntersecting)),
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* Drag-to-orbit with inertia + pointer parallax (bubbled from the canvas,
     so R3F hover raycasting keeps working on the same surface). */
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const f = figureStore;
    let down = false;
    let lastX = 0;
    let lastY = 0;

    const onDown = (e: PointerEvent) => {
      down = true;
      lastX = e.clientX;
      lastY = e.clientY;
      f.dragging = true;
      el.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      f.pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (down) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        f.ry += dx * 0.006;
        f.vy = clamp(dx * 0.1, -2.5, 2.5);
        f.dragTilt = clamp(f.dragTilt + dy * 0.0035, -0.6, 0.6);
      } else if (e.pointerType === "mouse") {
        const ndcX = (f.pointer.x / Math.max(1, r.width)) * 2 - 1;
        const ndcY = -((f.pointer.y / Math.max(1, r.height)) * 2 - 1);
        f.parX = ndcX;
        f.parY = ndcY;
      }
      if (f.hoveredBp >= 0) {
        const tip = f.tipEl;
        if (tip && f.pointer) {
          const x = clamp(f.pointer.x + 16, 8, Math.max(8, el.clientWidth - 168));
          const y = clamp(f.pointer.y + 18, 8, Math.max(8, el.clientHeight - 64));
          tip.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        }
      }
    };
    const onUp = () => {
      down = false;
      f.dragging = false;
      el.style.cursor = f.hoveredBp >= 0 ? "pointer" : "grab";
    };
    const onLeave = () => {
      down = false;
      f.dragging = false;
      f.parX = 0;
      f.parY = 0;
      f.pointer = null;
      el.style.cursor = "grab";
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointerleave", onLeave);
      f.dragging = false;
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className={cn("relative h-full w-full cursor-grab touch-pan-y", className)}
    >
      {mounted && webgl ? (
        <>
          <div aria-hidden className="ba-figure-glow pointer-events-none absolute inset-0" />
          <Canvas
            flat
            frameloop={frameloop}
            dpr={[1, 1.75]}
            camera={{ fov: 40, position: [0, 0, 7.3], near: 0.1, far: 50 }}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            style={{ position: "absolute", inset: 0 }}
          >
            <DnaScene reduced={reduced} dark={isDark} />
          </Canvas>
          {/* base-pair record chip */}
          <div
            ref={tipRef}
            className="pointer-events-none absolute left-0 top-0 z-20 opacity-0 transition-opacity duration-150 will-change-transform"
          >
            <div className="ba-chip w-max rounded-lg px-3 py-2">
              <p
                ref={tipMainRef}
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ba-ink)]"
              />
              <p ref={tipSubRef} className="mt-0.5 font-mono text-[9px] text-[var(--ba-muted)]" />
            </div>
          </div>
        </>
      ) : (
        <DnaFallback />
      )}
    </div>
  );
}

/* Static SVG duplex over the dot grid — shown until WebGL loads, and
   whenever WebGL is unavailable. Stroke uses currentColor so it follows
   the active theme. */
function DnaFallback() {
  const strandPath = (phase: number) => {
    let d = "";
    for (let x = 0; x <= 320; x += 8) {
      const y = 130 + Math.sin((x / 320) * Math.PI * 2.4 + phase) * 66;
      d += `${x === 0 ? "M" : "L"}${x.toFixed(0)} ${y.toFixed(1)}`;
    }
    return d;
  };
  const rungs = Array.from({ length: 11 }, (_, i) => {
    const x = 26 + i * 26.8;
    const y1 = 130 + Math.sin((x / 320) * Math.PI * 2.4) * 66;
    const y2 = 130 + Math.sin((x / 320) * Math.PI * 2.4 + Math.PI) * 66;
    return { x, y1, y2 };
  });
  return (
    <div className="ba-fallback-dots absolute inset-0">
      <svg
        viewBox="0 0 320 260"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full text-[var(--ba-faint)]"
        fill="none"
      >
        <path d={strandPath(0)} stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d={strandPath(Math.PI)} stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        {rungs.map((r, i) => (
          <line
            key={i}
            x1={r.x}
            y1={r.y1}
            x2={r.x}
            y2={r.y2}
            stroke="currentColor"
            strokeWidth="2.5"
            strokeOpacity="0.55"
          />
        ))}
      </svg>
    </div>
  );
}
