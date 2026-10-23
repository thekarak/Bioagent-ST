/**
 * Deterministic data builders for the landing-page WebGL tissue figure.
 *
 * The scene must look identical on every load, so all randomness comes from a
 * seeded PRNG (mulberry32). Spots represent an illustrative spatial-transcriptomics
 * section: five computational clusters rendered as a 3D scatter with real depth.
 */

import { CATEGORICAL_PALETTE } from "@/lib/bioagent/colors";

export const CLUSTER_COUNT = 5;
export const CLUSTER_GENES = ["Mbp", "Apoe", "Cx3cr1", "Rgs5", "Col1a1"];

/* Cluster colors — the first five entries of the workspace categorical palette. */
export const FIELD_PALETTE: string[] = CATEGORICAL_PALETTE.slice(0, CLUSTER_COUNT);

export type FieldSpot = {
  x: number;
  y: number;
  z: number;
  cluster: number;
  size: number;
  expr: number;
  phase: number;
};

/* Deterministic PRNG (same on every load, SSR-safe — never called at import time). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CENTERS: ReadonlyArray<readonly [number, number, number]> = [
  [-0.55, 0.3, 0.18],
  [0.16, 0.52, -0.22],
  [0.55, 0.1, 0.1],
  [0.05, -0.42, -0.3],
  [-0.38, -0.2, 0.26],
];
const SIGMA: readonly number[] = [0.26, 0.22, 0.28, 0.24, 0.2];
const SIGMA_Z: readonly number[] = [0.2, 0.16, 0.22, 0.18, 0.15];
const WEIGHTS: readonly number[] = [0.26, 0.2, 0.3, 0.14, 0.1];

/** Build the tissue spots (clustered gaussian point cloud with depth). */
export function buildFieldSpots(count: number): FieldSpot[] {
  const rnd = mulberry32(20261018);
  const gauss = () => {
    const u = Math.max(1e-6, rnd());
    const v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const pts: FieldSpot[] = [];
  for (let i = 0; i < count; i++) {
    let pick = rnd();
    let c = CLUSTER_COUNT - 1;
    for (let k = 0; k < WEIGHTS.length; k++) {
      if (pick < WEIGHTS[k]) {
        c = k;
        break;
      }
      pick -= WEIGHTS[k];
    }
    const [ox, oy, oz] = CENTERS[c];
    pts.push({
      x: ox + gauss() * SIGMA[c] * 0.92,
      y: oy + gauss() * SIGMA[c] * 0.78,
      z: oz + gauss() * SIGMA_Z[c],
      cluster: c,
      size: rnd(),
      expr: rnd(),
      phase: rnd() * Math.PI * 2,
    });
  }
  return pts;
}

/** Nearest same-cluster neighbor pairs — the "neighborhood graph" edges. */
export function buildFieldEdges(
  pts: FieldSpot[],
  limit: number,
): Array<[number, number]> {
  const seen = new Set<string>();
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < pts.length; i += 3) {
    let b1 = -1;
    let b2 = -1;
    let d1 = Infinity;
    let d2 = Infinity;
    for (let j = 0; j < pts.length; j++) {
      if (j === i || pts[j].cluster !== pts[i].cluster) continue;
      const dx = pts[i].x - pts[j].x;
      const dy = pts[i].y - pts[j].y;
      const dz = pts[i].z - pts[j].z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < d1) {
        d2 = d1;
        b2 = b1;
        d1 = d;
        b1 = j;
      } else if (d < d2) {
        d2 = d;
        b2 = j;
      }
    }
    for (const b of [b1, b2]) {
      if (b < 0) continue;
      const key = i < b ? `${i}-${b}` : `${b}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([i, b]);
      }
    }
  }
  return edges.slice(0, limit);
}

/* ---------- soft halo shader (normal blending, for light backgrounds) ---------- */

export const GLOW_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aScale;
  attribute float aPhase;
  uniform float uTime;
  uniform float uSize;
  uniform float uTwinkle;
  varying vec3 vColor;
  varying float vTw;
  void main() {
    vColor = aColor;
    vTw = mix(1.0, 0.72 + 0.28 * sin(uTime * 0.9 + aPhase), uTwinkle);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = min(uSize * aScale * (300.0 / max(0.1, -mv.z)), 160.0);
    gl_Position = projectionMatrix * mv;
  }
`;

export const GLOW_FRAGMENT = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  varying float vTw;
  uniform float uOpacity;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = smoothstep(0.5, 0.02, d);
    a *= a;
    gl_FragColor = vec4(vColor, 1.0) * (a * vTw * uOpacity);
    #include <colorspace_fragment>
  }
`;
