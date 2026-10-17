/**
 * Color utilities for scientific visualization.
 * Categorical palette is colorblind-conscious (Okabe-Ito derived);
 * sequential ramps are single-hue publication-style gradients.
 */

/** Okabe-Ito derived categorical palette (8 colors), ordered for adjacency contrast. */
export const CATEGORICAL_PALETTE = [
  "#D55E00", // vermillion
  "#009E73", // bluish green
  "#56B4E9", // sky
  "#CC79A7", // reddish purple
  "#E69F00", // orange
  "#0072B2", // blue
  "#A98600", // dark yellow
  "#33454F", // dark slate
];

export function categoricalColor(index: number): string {
  return CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length];
}

/** Single-hue teal sequential ramp for expression values (0..1 -> color). */
const TEAL_RAMP: [number, number, number][] = [
  [242, 247, 245],
  [195, 219, 214],
  [143, 191, 181],
  [94, 160, 153],
  [44, 119, 113],
  [23, 71, 66],
];

export const ZERO_COLOR = "#E7ECEA";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function rampColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (TEAL_RAMP.length - 1);
  const i = Math.min(TEAL_RAMP.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const a = TEAL_RAMP[i];
  const b = TEAL_RAMP[i + 1];
  const r = Math.round(lerp(a[0], b[0], f));
  const g = Math.round(lerp(a[1], b[1], f));
  const bl = Math.round(lerp(a[2], b[2], f));
  return `rgb(${r}, ${g}, ${bl})`;
}

/** Discrete legend samples for a continuous ramp (for the color bar). */
export function rampStops(n = 24): string[] {
  return Array.from({ length: n }, (_, i) => rampColor(i / (n - 1)));
}

/** Colorblind-conscious label text for categorical swatches. */
export function clusterLabel(k: number): string {
  return `Cluster ${k}`;
}

export const STATUS_COLORS = {
  verified: "#247653",
  warning: "#A96516",
  error: "#B54747",
  teal: "#2C7771",
  navy: "#183345",
  muted: "#677681",
} as const;
