"use client";

/**
 * LandingWorld — the persistent WebGL layer behind the whole landing
 * page. A full-viewport canvas renders a deterministic particle field
 * (Points + custom bead shader) that morphs between seven formations as
 * the visitor scrolls: genome, tissue section, pipeline stream, registry
 * lattice, evidence orbits, convergence torus, and a closing open field.
 * Two faint wireframe "observatory domes" sit deep in the background for
 * parallax depth; the camera drifts and tilts with the pointer.
 *
 * Rendering contract (tuned after review):
 *  - particles render at TRUE point scale — a crisp 3-12 px band set by
 *    a world-space size, the device-pixel ratio and distance attenuation
 *    — never the 100 px smears of the first cut;
 *  - colours and alphas are formation-aware: each particle carries two
 *    role-resolved (colour, alpha) pairs — the formations it is currently
 *    morphing between — and the shader cross-fades them with uMix, so a
 *    DNA strand stays one coherent thread of sky beads with amber rungs,
 *    a tissue lobe keeps its cluster colour, and ambient dust stays
 *    faint in both themes;
 *  - both themes composite with normal alpha blending (never additive),
 *    so dark mode shows a defined instrument field, not glowing orbs.
 *
 * The world is decorative (aria-hidden, pointer-events: none) but never
 * random: it shares the categorical palette and the seeded PRNG of the
 * two interactive figures, so all three read as one instrument.
 *
 * Robustness follows the house pattern of DnaHelix/TissueField: WebGL
 * capability check, tab-hidden frameloop pause, prefers-reduced-motion
 * opt-out, DPR cap, dynamic draw usage, and full GPU disposal.
 */

import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { usePrefersReducedMotion } from "../motion";
import { useLandingTheme } from "../theme";
import { mulberry32 } from "./tissue-field-data";
import {
  CHAPTER_COUNT,
  buildWorldAttrs,
  buildWorldFormations,
  trackWorldInput,
  worldState,
  writeFormationColors,
  WORLD_FRAGMENT,
  WORLD_VERTEX,
} from "./world-formations";

const smoothstep = (t: number) => {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
};

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

type WorldPalettes = {
  /** Per-formation linear-space colours, each n * 3. */
  colors: Float32Array[];
  /** Per-formation alphas, each n. */
  alphas: Float32Array[];
};

function WorldScene({ dark, count, narrow }: { dark: boolean; count: number; narrow: boolean }) {
  const groupRef = React.useRef<THREE.Group>(null);
  const dome1Ref = React.useRef<THREE.Mesh>(null);
  const dome2Ref = React.useRef<THREE.Mesh>(null);
  const matRef = React.useRef<THREE.ShaderMaterial>(null);

  const formations = React.useMemo(() => buildWorldFormations(count), [count]);
  const attrs = React.useMemo(() => buildWorldAttrs(count), [count]);

  /* Role-resolved colours for every formation, rebuilt per theme. */
  const palettes = React.useMemo<WorldPalettes>(() => {
    const rnd = mulberry32(dark ? 424242 : 242424);
    const colors: Float32Array[] = [];
    const alphas: Float32Array[] = [];
    for (let f = 0; f < CHAPTER_COUNT; f++) {
      const c = new Float32Array(count * 3);
      const a = new Float32Array(count);
      writeFormationColors(c, a, formations[f], f, dark, rnd);
      colors.push(c);
      alphas.push(a);
    }
    return { colors, alphas };
  }, [dark, formations, count]);

  const geometry = React.useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(formations[0].pos), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    g.setAttribute(
      "aColorA",
      new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage),
    );
    g.setAttribute(
      "aColorB",
      new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage),
    );
    g.setAttribute(
      "aAlphaA",
      new THREE.BufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage),
    );
    g.setAttribute(
      "aAlphaB",
      new THREE.BufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage),
    );
    g.setAttribute("aScale", new THREE.BufferAttribute(attrs.scale, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(attrs.phase, 1));
    /* The field spans the whole frame and is always visible; a generous
       manual bounding sphere avoids per-frame frustum re-computation. */
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -1), 40);
    return g;
  }, [formations, attrs, count]);

  const uniforms = React.useMemo(
    () => ({
      uTime: { value: 0 },
      /* world-space bead radius — lands most particles at 3-5 CSS px */
      uSize: { value: 0.16 },
      uWarp: { value: 0.04 },
      uOpacity: { value: 1.0 },
      uMix: { value: 0 },
      uDpr: { value: 1 },
    }),
    [],
  );

  /* Theme tuning: sizes, warp and gain are rewritten per theme switch.
     Blending stays normal in both — dark mode is a defined field, not a
     glow. The (colour, alpha) buffers refill on the next frame via the
     palette identity check in the render loop. */
  React.useEffect(() => {
    const mat = matRef.current;
    if (mat) {
      mat.uniforms.uSize.value = dark ? 0.18 : 0.205;
      mat.uniforms.uWarp.value = dark ? 0.055 : 0.04;
      mat.uniforms.uOpacity.value = 1.0;
    }
    for (const dome of [dome1Ref.current, dome2Ref.current]) {
      const m = dome?.material as THREE.MeshBasicMaterial | undefined;
      if (m) {
        m.color.set(dark ? "#46617d" : "#64748b");
        m.opacity = 0.1;
      }
    }
  }, [dark]);

  /* Dispose the manually-created geometry on unmount. */
  React.useEffect(() => {
    const g = geometry;
    return () => g.dispose();
  }, [geometry]);

  /* Formation-pair bookkeeping for the colour cross-fade. */
  const pairRef = React.useRef({ key: "", palettes: null as WorldPalettes | null });

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const ch = worldState.chapter;

    /* Continuous formation blend: integer part = current chapter,
       fractional part = smoothstepped position within its section. */
    const i0 = Math.max(0, Math.min(CHAPTER_COUNT - 1, Math.floor(ch)));
    const i1 = Math.min(CHAPTER_COUNT - 1, i0 + 1);
    const frac = i0 === i1 ? 0 : smoothstep(ch - i0);
    const A = formations[i0].pos;
    const B = formations[i1].pos;

    /* Refill the role colour/alpha buffers when the active formation
       pair changes (or the theme rebuilt the palettes). */
    const pair = pairRef.current;
    if (pair.palettes !== palettes || pair.key !== `${i0}:${i1}`) {
      pair.palettes = palettes;
      pair.key = `${i0}:${i1}`;
      const ca = geometry.getAttribute("aColorA") as THREE.BufferAttribute;
      const cb = geometry.getAttribute("aColorB") as THREE.BufferAttribute;
      const aa = geometry.getAttribute("aAlphaA") as THREE.BufferAttribute;
      const ab = geometry.getAttribute("aAlphaB") as THREE.BufferAttribute;
      (ca.array as Float32Array).set(palettes.colors[i0]);
      (cb.array as Float32Array).set(palettes.colors[i1]);
      (aa.array as Float32Array).set(palettes.alphas[i0]);
      (ab.array as Float32Array).set(palettes.alphas[i1]);
      ca.needsUpdate = true;
      cb.needsUpdate = true;
      aa.needsUpdate = true;
      ab.needsUpdate = true;
    }
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = t;
      matRef.current.uniforms.uMix.value = frac;
      matRef.current.uniforms.uDpr.value = state.viewport.dpr;
    }

    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;
    const ease = attrs.ease;
    const k = Math.min(2, dt * 60);
    const n3 = count * 3;
    for (let j = 0; j < n3; j += 3) {
      const e = ease[j / 3] * k;
      pos[j] += (A[j] + (B[j] - A[j]) * frac - pos[j]) * e;
      pos[j + 1] += (A[j + 1] + (B[j + 1] - A[j + 1]) * frac - pos[j + 1]) * e;
      pos[j + 2] += (A[j + 2] + (B[j + 2] - A[j + 2]) * frac - pos[j + 2]) * e;
    }
    posAttr.needsUpdate = true;

    /* Camera: pointer parallax + a slow dolly as the chapters advance.
       Uses state.camera (the live default camera) rather than the hook
       value, keeping the immutability contract of useThree. */
    const cam = state.camera;
    const px = worldState.px;
    const py = worldState.py;
    /* Narrow viewports pull the camera back so wide formations spread
       out instead of compressing into dense vertical strips. */
    const zBase = narrow ? 12.5 : 10;
    cam.position.x += (px * 0.7 - cam.position.x) * 0.05;
    cam.position.y += (py * 0.42 - cam.position.y) * 0.05;
    cam.position.z += (zBase - ch * 0.26 - cam.position.z) * 0.04;
    cam.lookAt(0, 0, 0);

    /* Scene-wide drift — barely perceptible rotation keeps the field
       alive even when the visitor is not scrolling. */
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.05) * 0.05 + ch * 0.05;
      groupRef.current.rotation.x = Math.sin(t * 0.04) * 0.02;
    }
    if (dome1Ref.current) {
      dome1Ref.current.rotation.y += dt * 0.05;
      dome1Ref.current.rotation.z += dt * 0.02;
    }
    if (dome2Ref.current) {
      dome2Ref.current.rotation.y -= dt * 0.04;
      dome2Ref.current.rotation.x += dt * 0.02;
    }
  });

  return (
    <group ref={groupRef}>
      {/* deep observatory domes — parallax depth cues */}
      <mesh ref={dome1Ref} position={[-5.6, 2.1, -4]} rotation={[0.4, 0.2, 0]}>
        <icosahedronGeometry args={[2.9, 1]} />
        <meshBasicMaterial wireframe transparent opacity={0.1} color="#64748b" />
      </mesh>
      <mesh ref={dome2Ref} position={[5.4, -2.3, -5]} rotation={[-0.3, -0.45, 0.2]}>
        <icosahedronGeometry args={[3.5, 1]} />
        <meshBasicMaterial wireframe transparent opacity={0.1} color="#64748b" />
      </mesh>
      {/* the morphing particle field */}
      <points geometry={geometry} frustumCulled={false} renderOrder={1}>
        <shaderMaterial
          ref={matRef}
          vertexShader={WORLD_VERTEX}
          fragmentShader={WORLD_FRAGMENT}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </points>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Mount                                                              */
/* ------------------------------------------------------------------ */

export function LandingWorld() {
  const reduced = usePrefersReducedMotion();
  const { isDark } = useLandingTheme();
  const [mounted, setMounted] = React.useState(false);
  const [tabVisible, setTabVisible] = React.useState(true);
  const [count] = React.useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? 640 : 1800,
  );
  const [narrow] = React.useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );

  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => trackWorldInput(), []);
  React.useEffect(() => {
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const webgl = React.useMemo(() => mounted && webglAvailable(), [mounted]);

  /* Reduced motion: the world is an enhancement, not content — visitors
     who prefer stillness get the clean editorial page. */
  if (reduced || !mounted || !webgl) return null;

  return (
    <Canvas
      flat
      frameloop={tabVisible ? "always" : "never"}
      dpr={[1, 1.75]}
      camera={{
        fov: 42,
        position: [0, 0, narrow ? 12.5 : 10],
        near: 0.1,
        far: 60,
      }}
      gl={{
        antialias: false,
        alpha: true,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
      }}
      style={{ position: "absolute", inset: 0 }}
    >
      <WorldScene dark={isDark} count={count} narrow={narrow} />
    </Canvas>
  );
}
