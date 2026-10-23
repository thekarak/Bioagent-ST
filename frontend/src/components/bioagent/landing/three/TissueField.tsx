"use client";

/**
 * TissueFigure — the landing hero's "Fig. 1" WebGL viewport.
 *
 * A panel-sized React Three Fiber canvas renders an illustrative
 * spatial-transcriptomics tissue section as a scientific 3D scatter:
 * instanced spot cores in the workspace categorical palette, soft halos
 * (normal blending, tuned for white backgrounds) and faint neighborhood
 * edges. Interactions: drag to orbit with inertia, pointer parallax, hover
 * halos and click-to-inspect with a floating record card positioned inside
 * the panel.
 *
 * Robustness: deterministic data, WebGL capability fallback, in-view
 * frameloop pause, tab-hidden pause, prefers-reduced-motion support, DPR
 * cap and full disposal of GPU resources on unmount.
 */

import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "../motion";
import { useLandingTheme } from "../theme";
import {
  buildFieldEdges,
  buildFieldSpots,
  CLUSTER_GENES,
  FIELD_PALETTE,
  GLOW_FRAGMENT,
  GLOW_VERTEX,
} from "./tissue-field-data";

/* ------------------------------------------------------------------ */
/* Shared mutable figure store (interaction surface  ->  scene)        */
/* ------------------------------------------------------------------ */

export type TissueSpotInfo = {
  i: number;
  cluster: number;
  x: number;
  y: number;
  expr: number;
  gene: string;
};

type FigureStore = {
  dragging: boolean;
  pointerNdc: { x: number; y: number } | null;
  pendingClick: { x: number; y: number } | null;
  selected: number;
  hoverInstance: number;
  parX: number;
  parY: number;
  dragTilt: number;
  ry: number;
  rx: number;
  vy: number;
  onSelect?: (info: TissueSpotInfo | null) => void;
  onHover?: (hovering: boolean) => void;
  cardEl: HTMLDivElement | null;
};

const figureStore: FigureStore = {
  dragging: false,
  pointerNdc: null,
  pendingClick: null,
  selected: -1,
  hoverInstance: -1,
  parX: 0,
  parY: 0,
  dragTilt: 0,
  ry: -0.35,
  rx: 0.2,
  vy: 0,
  cardEl: null,
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

const WHITE = new THREE.Color("#ffffff");

function TissueScene({
  count,
  reduced,
  dark,
}: {
  count: number;
  reduced: boolean;
  dark: boolean;
}) {
  const rigRef = React.useRef<THREE.Group>(null);
  const meshRef = React.useRef<THREE.InstancedMesh>(null);
  const glowRef = React.useRef<THREE.Points>(null);
  const ringRef = React.useRef<THREE.Mesh>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const spots = React.useMemo(() => buildFieldSpots(count), [count]);
  const edges = React.useMemo(
    () => buildFieldEdges(spots, count > 300 ? 130 : 70),
    [spots, count],
  );

  /* Base per-instance scales (for hover/selection scaling). */
  const baseScales = React.useMemo(() => spots.map((s) => 0.026 + s.size * 0.03), [spots]);

  /* Halo point geometry (positions + color/scale/phase attributes). */
  const glowGeom = React.useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(spots.length * 3);
    const col = new Float32Array(spots.length * 3);
    const scl = new Float32Array(spots.length);
    const pha = new Float32Array(spots.length);
    const c = new THREE.Color();
    spots.forEach((s, i) => {
      pos[i * 3] = s.x;
      pos[i * 3 + 1] = s.y;
      pos[i * 3 + 2] = s.z;
      c.set(FIELD_PALETTE[s.cluster]);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
      scl[i] = 0.7 + s.size * 0.85;
      pha[i] = s.phase;
    });
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aScale", new THREE.BufferAttribute(scl, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(pha, 1));
    return g;
  }, [spots]);

  /* Edge line geometry. */
  const edgeGeom = React.useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(edges.length * 6);
    const col = new Float32Array(edges.length * 6);
    const c = new THREE.Color();
    edges.forEach(([a, b], e) => {
      const sa = spots[a];
      const sb = spots[b];
      pos[e * 6] = sa.x;
      pos[e * 6 + 1] = sa.y;
      pos[e * 6 + 2] = sa.z;
      pos[e * 6 + 3] = sb.x;
      pos[e * 6 + 4] = sb.y;
      pos[e * 6 + 5] = sb.z;
      c.set(FIELD_PALETTE[sa.cluster]);
      col[e * 6] = c.r;
      col[e * 6 + 1] = c.g;
      col[e * 6 + 2] = c.b;
      col[e * 6 + 3] = c.r;
      col[e * 6 + 4] = c.g;
      col[e * 6 + 5] = c.b;
    });
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [edges, spots]);

  const glowUniforms = React.useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: dark ? 0.5 : 0.42 },
      uOpacity: { value: dark ? 0.55 : 0.38 },
      uTwinkle: { value: reduced ? 0.25 : 1 },
    }),
    [reduced, dark],
  );

  /* Dispose the imperatively-created geometries on unmount (materials are
     declared in JSX and disposed by R3F). */
  React.useEffect(
    () => () => {
      glowGeom.dispose();
      edgeGeom.dispose();
    },
    [glowGeom, edgeGeom],
  );

  /* Initialize instance matrices and colors. */
  React.useLayoutEffect(() => {
    const im = meshRef.current;
    if (!im) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    spots.forEach((s, i) => {
      const sc = baseScales[i];
      m.makeScale(sc, sc, sc);
      m.setPosition(s.x, s.y, s.z);
      im.setMatrixAt(i, m);
      c.set(FIELD_PALETTE[s.cluster]);
      im.setColorAt(i, c);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }, [spots, baseScales]);

  /* Apply an instance visual state (scale multiplier + white tint). */
  const visuals = React.useRef({ hover: -1, selected: -1 });
  const tmpMatrix = React.useMemo(() => new THREE.Matrix4(), []);
  const tmpColor = React.useMemo(() => new THREE.Color(), []);
  const tmpVec = React.useMemo(() => new THREE.Vector3(), []);

  const applyInstance = React.useCallback(
    (i: number, state: "base" | "hover" | "selected") => {
      const im = meshRef.current;
      if (!im || i < 0 || i >= spots.length) return;
      const mult = state === "hover" ? 1.9 : state === "selected" ? 1.55 : 1;
      const tint = state === "hover" ? 0.35 : state === "selected" ? 0.5 : 0;
      const sc = baseScales[i] * mult;
      tmpMatrix.makeScale(sc, sc, sc);
      tmpMatrix.setPosition(spots[i].x, spots[i].y, spots[i].z);
      im.setMatrixAt(i, tmpMatrix);
      tmpColor.set(FIELD_PALETTE[spots[i].cluster]);
      if (tint > 0) tmpColor.lerp(WHITE, tint);
      im.setColorAt(i, tmpColor);
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    },
    [spots, baseScales, tmpMatrix, tmpColor],
  );

  const makeInfo = React.useCallback(
    (i: number): TissueSpotInfo => {
      const s = spots[i];
      return {
        i,
        cluster: s.cluster,
        x: s.x,
        y: s.y,
        expr: s.expr,
        gene: CLUSTER_GENES[s.cluster],
      };
    },
    [spots],
  );

  useFrame((state, dt) => {
    const f = figureStore;
    const t = state.clock.elapsedTime * (reduced ? 0.35 : 1);
    const g = rigRef.current;
    if (!g) return;

    /* Orbit dynamics: gentle auto-rotation, drag inertia, parallax tilts. */
    if (!f.dragging && !reduced) {
      f.ry += 0.05 * dt;
      if (Math.abs(f.vy) > 0.02) {
        f.ry += f.vy * dt;
        f.vy *= Math.pow(0.04, dt);
      } else {
        f.vy = 0;
      }
    }
    const par = reduced ? 0 : 1;
    const targetRx = clamp(0.2 + f.dragTilt + f.parY * 0.05 * par, -0.5, 0.66);
    f.rx += (targetRx - f.rx) * Math.min(1, dt * 5);

    g.rotation.y = f.ry + f.parX * 0.06 * par;
    g.rotation.x = f.rx;
    g.scale.setScalar(1 + (reduced ? 0 : 0.006 * Math.sin(t * 0.6)));

    /* Halo uniforms. */
    const glowMaterial = glowRef.current?.material as THREE.ShaderMaterial | undefined;
    if (glowMaterial) glowMaterial.uniforms.uTime.value = t;

    /* Screen-space picking (hover) and pending click. */
    const px = f.pointerNdc ? (f.pointerNdc.x * 0.5 + 0.5) * size.width : -1;
    const py = f.pointerNdc ? (-f.pointerNdc.y * 0.5 + 0.5) * size.height : -1;

    const pickNearest = (x: number, y: number, radius: number): number => {
      let best = -1;
      let bd = radius * radius;
      for (let i = 0; i < spots.length; i++) {
        tmpVec.set(spots[i].x, spots[i].y, spots[i].z).applyMatrix4(g.matrixWorld);
        tmpVec.project(camera);
        const sx = (tmpVec.x * 0.5 + 0.5) * size.width;
        const sy = (-tmpVec.y * 0.5 + 0.5) * size.height;
        const d = (sx - x) * (sx - x) + (sy - y) * (sy - y);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      return best;
    };

    if (px >= 0 && !f.dragging) {
      const id = pickNearest(px, py, 15);
      if (id !== f.hoverInstance) {
        if (visuals.current.hover >= 0) applyInstance(visuals.current.hover, "base");
        visuals.current.hover = id;
        if (id >= 0 && id !== visuals.current.selected) applyInstance(id, "hover");
        f.hoverInstance = id;
        f.onHover?.(id >= 0);
      }
    } else if (f.hoverInstance >= 0) {
      if (visuals.current.hover >= 0) applyInstance(visuals.current.hover, "base");
      visuals.current.hover = -1;
      f.hoverInstance = -1;
      f.onHover?.(false);
    }

    if (f.pendingClick) {
      const cx = (f.pendingClick.x * 0.5 + 0.5) * size.width;
      const cy = (-f.pendingClick.y * 0.5 + 0.5) * size.height;
      const id = pickNearest(cx, cy, 19);
      if (visuals.current.selected >= 0) applyInstance(visuals.current.selected, "base");
      visuals.current.selected = id;
      if (id >= 0) applyInstance(id, "selected");
      f.selected = id;
      f.onSelect?.(id >= 0 ? makeInfo(id) : null);
      f.pendingClick = null;
    }

    /* External deselection (Escape / dismiss button) restores visuals. */
    if (f.selected !== visuals.current.selected) {
      if (visuals.current.selected >= 0) applyInstance(visuals.current.selected, "base");
      visuals.current.selected = f.selected;
    }

    /* Selection ring + inspect-card projection (panel-space coordinates). */
    const ring = ringRef.current;
    if (ring) {
      if (f.selected >= 0 && f.selected < spots.length) {
        const s = spots[f.selected];
        tmpVec.set(s.x, s.y, s.z).applyMatrix4(g.matrixWorld);
        ring.position.copy(tmpVec);
        ring.quaternion.copy(camera.quaternion);
        const pulse = 1 + 0.18 * Math.sin(t * 4.2);
        ring.scale.setScalar(0.085 * pulse);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.75;
        ring.visible = true;

        tmpVec.project(camera);
        const el = f.cardEl;
        if (el) {
          const x = clamp((tmpVec.x * 0.5 + 0.5) * size.width, 118, Math.max(118, size.width - 118));
          const rawY = (-tmpVec.y * 0.5 + 0.5) * size.height;
          const y = clamp(rawY, 96, Math.max(96, size.height - 48));
          el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, ${
            rawY > 150 ? "calc(-100% - 14px)" : "14px"
          })`;
          el.style.opacity = "1";
        }
      } else {
        ring.visible = false;
        if (f.cardEl) f.cardEl.style.opacity = "0";
      }
    }
  });

  return (
    <>
      <group ref={rigRef}>
        <instancedMesh
          key={count}
          ref={meshRef}
          args={[undefined, undefined, count]}
          frustumCulled={false}
        >
          <icosahedronGeometry args={[1, 1]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
        <points ref={glowRef} geometry={glowGeom} frustumCulled={false}>
          <shaderMaterial
            vertexShader={GLOW_VERTEX}
            fragmentShader={GLOW_FRAGMENT}
            uniforms={glowUniforms}
            transparent
            depthWrite={false}
            blending={THREE.NormalBlending}
          />
        </points>
        <lineSegments geometry={edgeGeom} frustumCulled={false}>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={dark ? 0.3 : 0.22}
            depthWrite={false}
            toneMapped={false}
          />
        </lineSegments>
      </group>

      {/* Selection ring — always faces the camera, pulses gently. */}
      <mesh ref={ringRef} visible={false} frustumCulled={false} renderOrder={2}>
        <ringGeometry args={[0.82, 1, 48]} />
        <meshBasicMaterial
          color={dark ? "#EDF1F5" : "#111417"}
          transparent
          opacity={0.75}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Figure viewport (canvas + interaction surface)                     */
/* ------------------------------------------------------------------ */

export function TissueFigure({ className }: { className?: string }) {
  const [mounted, setMounted] = React.useState(false);
  const [webgl, setWebgl] = React.useState(false);
  const [count, setCount] = React.useState(420);
  const [inView, setInView] = React.useState(true);
  const [frameloop, setFrameloop] = React.useState<"always" | "never">("always");
  const reduced = usePrefersReducedMotion();
  const { isDark } = useLandingTheme();
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const w = window.innerWidth;
    setCount(w < 640 ? 240 : w < 1024 ? 340 : 420);
    setWebgl(webglAvailable());
    setMounted(true);
    // Reset shared state when the figure mounts.
    const f = figureStore;
    f.dragging = false;
    f.pointerNdc = null;
    f.pendingClick = null;
    f.selected = -1;
    f.hoverInstance = -1;
  }, []);

  /* Pause rendering whenever the panel leaves the viewport or the tab hides. */
  React.useEffect(() => {
    const apply = () => setFrameloop(inView && !document.hidden ? "always" : "never");
    apply();
  }, [inView]);

  React.useEffect(() => {
    const onVis = () => {
      setFrameloop(inView && !document.hidden ? "always" : "never");
    };
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

  return (
    <div ref={wrapRef} aria-hidden className={cn("relative h-full w-full", className)}>
      {mounted && webgl ? (
        <>
          <Canvas
            flat
            frameloop={frameloop}
            dpr={[1, 1.75]}
            camera={{ fov: 46, position: [0, 0, 6.1], near: 0.1, far: 60 }}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: "high-performance",
            }}
            style={{ position: "absolute", inset: 0 }}
          >
            <TissueScene count={count} reduced={reduced} dark={isDark} />
          </Canvas>
          <FigureInteraction />
        </>
      ) : (
        <div className="ba-fallback-dots absolute inset-0" />
      )}
    </div>
  );
}

/**
 * Transparent pointer surface over the figure viewport. Feeds the shared
 * figure store: drag-to-orbit with inertia, pointer parallax (relative to
 * the panel), hover picking and click-to-inspect. Vertical touch panning
 * stays available (touch-pan-y).
 */
function FigureInteraction() {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const f = figureStore;
    let down = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;

    const toNdc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1,
        y: -(((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1),
      };
    };

    const onDown = (e: PointerEvent) => {
      down = true;
      moved = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      f.dragging = true;
      el.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (down) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        moved += Math.abs(dx) + Math.abs(dy);
        f.ry += dx * 0.0055;
        f.vy = clamp(dx * 0.1, -2.5, 2.5);
        f.dragTilt = clamp(f.dragTilt + dy * 0.0035, -0.5, 0.55);
        lastX = e.clientX;
        lastY = e.clientY;
        f.pointerNdc = toNdc(e);
      } else if (e.pointerType === "mouse") {
        const ndc = toNdc(e);
        f.pointerNdc = ndc;
        f.parX = ndc.x;
        f.parY = ndc.y;
      }
    };
    const onUp = (e: PointerEvent) => {
      const wasDrag = moved > 7;
      down = false;
      f.dragging = false;
      el.style.cursor = "grab";
      if (!wasDrag) f.pendingClick = toNdc(e);
    };
    const onLeave = () => {
      f.pointerNdc = null;
      f.parX = 0;
      f.parY = 0;
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointerleave", onLeave);
    f.onHover = (hovering: boolean) => {
      if (!down) el.style.cursor = hovering ? "pointer" : "grab";
    };
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointerleave", onLeave);
      f.onHover = undefined;
      f.dragging = false;
    };
  }, []);

  return <div ref={ref} aria-hidden className="absolute inset-0 cursor-grab touch-pan-y" />;
}

/* ------------------------------------------------------------------ */
/* Floating inspect card (panel-space, follows the selected spot)      */
/* ------------------------------------------------------------------ */

export function TissueInspectCard() {
  const [info, setInfo] = React.useState<TissueSpotInfo | null>(null);

  React.useEffect(() => {
    figureStore.onSelect = setInfo;
    return () => {
      figureStore.onSelect = undefined;
    };
  }, []);

  const dismiss = React.useCallback(() => {
    figureStore.selected = -1;
    setInfo(null);
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && figureStore.selected >= 0) {
        figureStore.selected = -1;
        setInfo(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!info) return null;
  return (
    <div
      ref={(el) => {
        figureStore.cardEl = el;
        return () => {
          figureStore.cardEl = null;
        };
      }}
      role="status"
      className="pointer-events-none absolute left-0 top-0 z-20 opacity-0 will-change-transform"
    >
      <div className="ba-chip w-52 rounded-lg p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ba-muted)]">
            demo · spot_{String(info.i + 1).padStart(5, "0")}
          </p>
          <button
            type="button"
            aria-label="Dismiss spot details"
            onClick={dismiss}
            className="ba-focus pointer-events-auto -m-1 rounded p-1 text-[var(--ba-muted)] transition-colors hover:text-[var(--ba-ink)]"
          >
            <X className="size-3" aria-hidden />
          </button>
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--ba-ink)]">
          <span
            className="size-2 rounded-full"
            style={{ background: FIELD_PALETTE[info.cluster] }}
            aria-hidden
          />
          Cluster {info.cluster}
        </p>
        <dl className="mt-1 space-y-0.5 text-[11px] text-[var(--ba-body)]">
          <div className="flex justify-between gap-2">
            <dt>position</dt>
            <dd className="font-mono text-[var(--ba-ink)]">
              {(info.x * 2000).toFixed(1)}, {(info.y * 2000).toFixed(1)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>{info.gene} expr.</dt>
            <dd className="font-mono text-[var(--ba-ink)]">{info.expr.toFixed(2)}</dd>
          </div>
        </dl>
        <p className="mt-1.5 text-[9px] leading-tight text-[var(--ba-faint)]">
          Illustrative — generated locally in your browser.
        </p>
      </div>
    </div>
  );
}
