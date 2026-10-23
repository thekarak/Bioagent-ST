/**
 * Deterministic builders for the landing hero's DNA figure.
 *
 * The helix is a procedurally generated B-form duplex: two sugar-phosphate
 * backbones offset by ~140 degrees (true major/minor grooves), 26 base pairs
 * at a 3.4 A-equivalent rise and 10.5 bp per turn. Base identities come from
 * a seeded PRNG with ~52% GC content, so the figure is identical on every
 * load. Base colors reuse the Okabe-Ito categorical palette — the same
 * colorblind-conscious system the workspace uses for clusters, which keeps
 * the two landing figures in one visual language.
 */

import * as THREE from "three";
import { mulberry32 } from "./tissue-field-data";

/* ---------- helix constants ---------- */

export const BP_COUNT = 26;
export const HELIX_RADIUS = 0.62;
export const BP_RISE = 0.17;
/** 10.5 base pairs per full turn (B-DNA). */
export const TWIST_PER_BP = (Math.PI * 2) / 10.5;
/** Strand separation ~140 deg — gives major/minor grooves instead of a ladder. */
export const STRAND_OFFSET = 2.44;

export const BASES = ["A", "T", "G", "C"] as const;
export type Base = (typeof BASES)[number];

/** Okabe-Ito base palette (shares hues with the tissue figure). */
export const BASE_COLORS: Record<Base, string> = {
  A: "#0072B2", // blue
  T: "#D55E00", // vermillion
  G: "#E69F00", // orange
  C: "#CC79A7", // reddish purple
};

/* ---------- geometry ---------- */

export type DnaRung = {
  y: number;
  /** strand-0 endpoint */
  a: THREE.Vector3;
  /** strand-1 endpoint */
  b: THREE.Vector3;
  baseA: Base;
  baseB: Base;
  /** "GC" pairs use the triple-bond glyph in the tooltip. */
  bond: "GC" | "AT";
};

function strandPoint(t: number, strand: 0 | 1, out = new THREE.Vector3()): THREE.Vector3 {
  const angle = t * TWIST_PER_BP + strand * STRAND_OFFSET;
  return out.set(
    Math.cos(angle) * HELIX_RADIUS,
    (t - BP_COUNT / 2) * BP_RISE,
    Math.sin(angle) * HELIX_RADIUS,
  );
}

/** Deterministic base-pair sequence (~52% GC, random strand orientation). */
export function buildDnaRungs(): DnaRung[] {
  const rnd = mulberry32(20261023);
  const rungs: DnaRung[] = [];
  for (let i = 0; i < BP_COUNT; i++) {
    const gc = rnd() < 0.52;
    const flip = rnd() < 0.5;
    const baseA: Base = gc ? (flip ? "G" : "C") : flip ? "A" : "T";
    const baseB: Base = gc ? (flip ? "C" : "G") : flip ? "T" : "A";
    const t = i + 0.5;
    rungs.push({
      y: (t - BP_COUNT / 2) * BP_RISE,
      a: strandPoint(t, 0),
      b: strandPoint(t, 1),
      baseA,
      baseB,
      bond: gc ? "GC" : "AT",
    });
  }
  return rungs;
}

/** Smooth backbone curve for one strand (4 samples per base pair). */
export function buildStrandCurve(strand: 0 | 1): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= BP_COUNT * 4; i++) {
    pts.push(strandPoint(i / 4, strand, new THREE.Vector3()));
  }
  return new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
}

/* ---------- ambient particle field ---------- */

export type DnaParticles = {
  positions: Float32Array;
  colors: Float32Array;
  scales: Float32Array;
  phases: Float32Array;
  count: number;
};

/**
 * Expression-dust motes around the duplex. Light theme: quiet greys with a
 * few categorical accents. Dark theme: additive sky/white sparks (the
 * "observatory" register) with a handful of base-colored sparks.
 */
export function buildDnaParticles(dark: boolean): DnaParticles {
  const rnd = mulberry32(20261019);
  const count = 120;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const phases = new Float32Array(count);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    /* cylindrical shell around the helix, biased away from the core */
    const angle = rnd() * Math.PI * 2;
    const radius = 1.15 + rnd() * 1.15;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = (rnd() - 0.5) * 4.6;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    const roll = rnd();
    if (dark) {
      c.set(
        roll < 0.42 ? "#EDF1F5" : roll < 0.8 ? "#56B4E9" : BASE_COLORS[BASES[Math.floor(rnd() * 4)]],
      );
    } else {
      c.set(
        roll < 0.62 ? "#C9CED4" : roll < 0.88 ? "#9AA0A6" : BASE_COLORS[BASES[Math.floor(rnd() * 4)]],
      );
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    scales[i] = 0.55 + rnd() * 0.9;
    phases[i] = rnd() * Math.PI * 2;
  }
  return { positions, colors, scales, phases, count };
}

/* ---------- orbital rings ---------- */

export const RING_RADII = [1.45, 1.75] as const;

export function buildRingGeometry(radius: number): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 160; i++) {
    const a = (i / 160) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}
