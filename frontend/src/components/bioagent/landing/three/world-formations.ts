/**
 * Deterministic data + input tracking for the landing page's persistent
 * WebGL world — the full-page particle field that lives behind every
 * section and morphs between formations as the visitor scrolls.
 *
 * The world is the narrative spine of the page: each formation mirrors the
 * section it accompanies (a genome at the hero, a tissue section at the
 * map, a flow at the pipeline, a registry lattice at the workflows,
 * evidence orbits, a convergence at the research context, and an open
 * field at the close). All randomness comes from the same seeded PRNG as
 * the other figures, so the scene is identical on every load.
 *
 * Beyond positions, every formation assigns each particle a *role*: 0 is
 * ambient dust, 1..N name the structural parts of the figure (the two DNA
 * strands, their base-pair rungs, a tissue cluster, a flow channel, an
 * orbit ring...). Roles are resolved into colour + alpha per theme, so
 * each formation reads as one coherent, labelled instrument — the duplex
 * has two strand colours and orange rungs, the tissue section carries the
 * same categorical cluster palette as Fig. 2, the registry is a bounded
 * blue lattice with a few amber featured nodes. The pair of buffers the
 * GPU sees (aColorA/aColorB, aAlphaA/aAlphaB) cross-fades on scroll, the
 * same way positions do.
 *
 * This module is pure data and math — no three.js import — so the DOM-side
 * chapter rail can subscribe to the tracking store without pulling WebGL
 * code into its bundle.
 */

import { mulberry32 } from "./tissue-field-data";

/* ------------------------------------------------------------------ */
/* Chapter map — the world's formations, keyed to the page sections    */
/* ------------------------------------------------------------------ */

export const CHAPTER_COUNT = 7;

export type WorldChapter = {
  /** Section id whose mid-scroll drives this formation. */
  anchor: string;
  /** Rail label — short, scientific, matches the editorial voice. */
  label: string;
  /** Rail caption shown on hover / active. */
  sub: string;
};

export const CHAPTERS: readonly WorldChapter[] = [
  { anchor: "hero", label: "Genome", sub: "Duplex field" },
  { anchor: "spatial-map", label: "Section", sub: "Tissue field" },
  { anchor: "workflows", label: "Pipeline", sub: "Request stream" },
  { anchor: "approved-workflows", label: "Registry", sub: "Bounded set" },
  { anchor: "evidence", label: "Orbits", sub: "Evidence rings" },
  { anchor: "research-context", label: "Converge", sub: "Claim focus" },
  { anchor: "cta", label: "Field", sub: "Open field" },
];

/* ------------------------------------------------------------------ */
/* Mutable input store (window listeners  ->  render loop)            */
/* ------------------------------------------------------------------ */

/**
 * Written by rAF-throttled window listeners, read every WebGL frame.
 * `chapter` is a continuous 0..CHAPTER_COUNT-1 value: the integer part
 * is the chapter whose section the viewport centre is inside, and the
 * fractional part is a smoothstepped position within that section, so
 * formations cross-fade continuously while scrolling.
 */
export const worldState = {
  /** Normalised pointer, -1..1 (0,0 = centre; y is up). */
  px: 0,
  py: 0,
  /** Continuous chapter position along the page (0..6). */
  chapter: 0,
};

const smoothstep = (t: number) => {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
};

let listeners = 0;
let teardown: (() => void) | null = null;

function attach(): () => void {
  let raf = 0;
  let queued = false;

  const chapterAt = (): number => {
    const probe = window.scrollY + window.innerHeight * 0.5;
    let idx = 0;
    let top = 0;
    let height = 1;
    for (let i = 0; i < CHAPTERS.length; i++) {
      const el = document.getElementById(CHAPTERS[i].anchor);
      if (!el) continue;
      const rectTop = el.getBoundingClientRect().top + window.scrollY;
      if (rectTop <= probe) {
        idx = i;
        top = rectTop;
        height = Math.max(1, el.offsetHeight);
      }
    }
    /* Hold the current formation while its section owns the viewport,
       then cross-fade across the tail of the section — blends land in
       the hand-off zone between sections instead of smearing a 50/50
       mix across the whole read. */
    const t = (probe - top) / height;
    const HOLD = 0.62;
    return idx + smoothstep(t <= HOLD ? 0 : (t - HOLD) / (1 - HOLD));
  };

  const update = () => {
    queued = false;
    worldState.chapter = chapterAt();
  };

  const onScroll = () => {
    if (!queued) {
      queued = true;
      raf = requestAnimationFrame(update);
    }
  };

  const onPointer = (e: PointerEvent) => {
    worldState.px = (e.clientX / window.innerWidth) * 2 - 1;
    worldState.py = -((e.clientY / window.innerHeight) * 2 - 1);
  };

  update();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  window.addEventListener("pointermove", onPointer, { passive: true });
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    window.removeEventListener("pointermove", onPointer);
  };
}

/**
 * Ref-counted attachment of the window listeners. Both the WebGL world
 * and the DOM chapter rail use the store; the last unsubscriber tears
 * the listeners down.
 */
export function trackWorldInput(): () => void {
  if (!teardown) teardown = attach();
  listeners += 1;
  return () => {
    listeners -= 1;
    if (listeners <= 0 && teardown) {
      teardown();
      teardown = null;
    }
  };
}

/* ------------------------------------------------------------------ */
/* Formations — target positions + per-particle roles                  */
/* ------------------------------------------------------------------ */

export type WorldFormation = {
  /** Target positions, n * 3. */
  pos: Float32Array;
  /** 0 = ambient dust, 1..N = structural role within the formation. */
  role: Float32Array;
};

function allocFormation(n: number): WorldFormation {
  return { pos: new Float32Array(n * 3), role: new Float32Array(n) };
}

/** Ambient dust shared by every formation — fills any remaining budget. */
function dustInto(
  f: WorldFormation,
  from: number,
  rnd: () => number,
  spread: readonly [number, number, number],
): void {
  for (let i = from * 3; i < f.pos.length; i += 3) {
    f.pos[i] = (rnd() * 2 - 1) * spread[0];
    f.pos[i + 1] = (rnd() * 2 - 1) * spread[1];
    f.pos[i + 2] = (rnd() * 2 - 1) * spread[2];
    f.role[i / 3] = 0;
  }
}

/**
 * Formation 0 — Genome. A B-form duplex sweeps the upper third behind
 * the hero: strand A (sky) and strand B (teal) rendered as evenly
 * beaded threads, joined by sparse amber rungs — the base pairs. A
 * second, fainter duplex ghosts low on the left, and ambient dust
 * frames the scene. Even spacing + hairline jitter keeps the threads
 * reading as precise lines, not fuzz.
 */
function buildHelix(n: number, rnd: () => number): WorldFormation {
  const f = allocFormation(n);
  const pos = f.pos;
  const role = f.role;

  const helixPoint = (u: number, strand: number): void => {
    const x = -7.6 + u * 13.2; // -7.6 .. 5.6 — right-weighted
    const ang = u * Math.PI * 4.4 + strand;
    hx = x;
    hy = 1.45 + Math.sin(ang) * 0.62;
    hz = Math.cos(ang) * 0.5 - 0.6;
  };
  let hx = 0;
  let hy = 0;
  let hz = 0;

  const strandCount = Math.floor(n * 0.32);
  const rungTriple = Math.floor((n * 0.1) / 3);
  const rungs = Math.max(12, rungTriple);
  const ghostCount = Math.floor(n * 0.08);

  let i = 0;
  /* strand A — role 1 */
  for (let k = 0; k < strandCount; k++, i++) {
    helixPoint(k / (strandCount - 1), 0);
    pos[i * 3] = hx + (rnd() - 0.5) * 0.035;
    pos[i * 3 + 1] = hy + (rnd() - 0.5) * 0.035;
    pos[i * 3 + 2] = hz + (rnd() - 0.5) * 0.05;
    role[i] = 1;
  }
  /* strand B — role 2, half a turn away */
  for (let k = 0; k < strandCount; k++, i++) {
    helixPoint(k / (strandCount - 1), Math.PI);
    pos[i * 3] = hx + (rnd() - 0.5) * 0.035;
    pos[i * 3 + 1] = hy + (rnd() - 0.5) * 0.035;
    pos[i * 3 + 2] = hz + (rnd() - 0.5) * 0.05;
    role[i] = 2;
  }
  /* base-pair rungs — role 3, amber bridges across the duplex */
  for (let r = 0; r < rungs; r++) {
    const u = (r + 0.5) / rungs;
    helixPoint(u, 0);
    const ax = hx;
    const ay = hy;
    const az = hz;
    helixPoint(u, Math.PI);
    for (let q = 0; q < 3; q++, i++) {
      const t = 0.28 + 0.22 * q; // 0.28 / 0.50 / 0.72 across the bridge
      pos[i * 3] = ax + (hx - ax) * t + (rnd() - 0.5) * 0.03;
      pos[i * 3 + 1] = ay + (hy - ay) * t + (rnd() - 0.5) * 0.03;
      pos[i * 3 + 2] = az + (hz - az) * t + (rnd() - 0.5) * 0.04;
      role[i] = 3;
    }
  }
  /* the ghost duplex — role 5, a pale echo low on the left */
  for (let k = 0; k < ghostCount; k++, i++) {
    const u = k / (ghostCount - 1);
    const x = -7.4 + u * 9.5;
    const ang = u * Math.PI * 3.2 + (k % 2) * Math.PI;
    pos[i * 3] = x + (rnd() - 0.5) * 0.05;
    pos[i * 3 + 1] = -2.35 + Math.sin(ang) * 0.5 + (rnd() - 0.5) * 0.04;
    pos[i * 3 + 2] = Math.cos(ang) * 0.42 - 1.6 + (rnd() - 0.5) * 0.06;
    role[i] = 5;
  }
  dustInto(f, i, rnd, [7.6, 3.9, 2.6]);
  return f;
}

/**
 * Formation 1 — Section. Five gaussian lobes like the demo tissue
 * figure, opened up into a wide mid-plane cloud. Each lobe keeps its
 * own cluster colour — the same categorical palette as Fig. 2 — so the
 * background literally echoes the figure floating over it.
 */
function buildTissue(n: number, rnd: () => number): WorldFormation {
  const f = allocFormation(n);
  const pos = f.pos;
  const role = f.role;
  const gauss = () => {
    const u = Math.max(1e-6, rnd());
    const v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const cx = [-4.6, -1.1, 2.6, 5.4, 0.6];
  const cy = [1.7, -0.9, 1.9, -1.4, 0.2];
  const cz = [-0.4, 0.6, -1.2, 0.2, -2.0];
  const w = [0.24, 0.22, 0.26, 0.14, 0.14];
  const s = [0.72, 0.9, 0.78, 0.66, 1.05];
  const lobeCount = Math.floor(n * 0.86);
  for (let i = 0; i < lobeCount; i++) {
    let pick = rnd();
    let c = cx.length - 1;
    for (let k = 0; k < w.length; k++) {
      if (pick < w[k]) {
        c = k;
        break;
      }
      pick -= w[k];
    }
    pos[i * 3] = cx[c] + gauss() * s[c];
    pos[i * 3 + 1] = cy[c] + gauss() * s[c] * 0.62;
    pos[i * 3 + 2] = cz[c] + gauss() * s[c] * 0.7;
    role[i] = 1 + c;
  }
  dustInto(f, lobeCount, rnd, [7.8, 4.1, 2.8]);
  return f;
}

/**
 * Formation 2 — Pipeline. Three advected channels crossing the frame —
 * the request entering on the left, the verified report leaving on the
 * right. Each channel is an evenly beaded thread in its own colour;
 * the centre (sky) channel carries the most particles.
 */
function buildStream(n: number, rnd: () => number): WorldFormation {
  const f = allocFormation(n);
  const pos = f.pos;
  const role = f.role;
  const yc = [-1.55, 0.1, 1.7];
  const zc = [-0.8, 0.2, -1.6];
  const dens = [0.3, 0.44, 0.26];
  const structural = Math.floor(n * 0.92);
  let i = 0;
  for (let c = 0; c < 3; c++) {
    const cnt = Math.floor(structural * dens[c]);
    for (let k = 0; k < cnt; k++, i++) {
      const x = -8.2 + (k / (cnt - 1)) * 16.4;
      pos[i * 3] = x;
      pos[i * 3 + 1] = yc[c] + Math.sin(x * 0.52 + c * 1.9) * 0.42 + (rnd() - 0.5) * 0.07;
      pos[i * 3 + 2] = zc[c] + Math.cos(x * 0.34 + c * 1.2) * 0.3 + (rnd() - 0.5) * 0.09;
      role[i] = 1 + c;
    }
  }
  dustInto(f, i, rnd, [8, 4, 2.6]);
  return f;
}

/**
 * Formation 3 — Registry. A tilted, bounded cubic lattice: the
 * allow-list of approved workflows, deliberately regular, in registry
 * blue with a sparse cadence of amber featured nodes. A faint dust
 * halo holds everything that is *not* in the registry.
 */
function buildLattice(n: number, rnd: () => number): WorldFormation {
  const f = allocFormation(n);
  const pos = f.pos;
  const role = f.role;
  const NX = 30;
  const NY = 13;
  const NZ = 4;
  const total = NX * NY * NZ;
  const nodeCount = Math.min(n, total);
  const ry = 0.32; // baked lattice tilt
  const rx = 0.16;
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  let ix = 0;
  let iy = 0;
  let iz = 0;
  let node = 0;
  for (let i = 0; i < nodeCount; i++) {
    const x0 = (ix - (NX - 1) / 2) * 0.54;
    const y0 = (iy - (NY - 1) / 2) * 0.5;
    const z0 = (iz - (NZ - 1) / 2) * 1.15 - 0.4;
    /* rotate Y then X */
    const x1 = x0 * cosY + z0 * sinY;
    const z1 = -x0 * sinY + z0 * cosY;
    const y1 = y0 * cosX - z1 * sinX;
    const z2 = y0 * sinX + z1 * cosX;
    pos[i * 3] = x1 + (rnd() - 0.5) * 0.04;
    pos[i * 3 + 1] = y1 + (rnd() - 0.5) * 0.04;
    pos[i * 3 + 2] = z2;
    role[i] = node % 31 === 0 ? 2 : 1;
    node += 1;
    ix += 1;
    if (ix === NX) {
      ix = 0;
      iy += 1;
      if (iy === NY) {
        iy = 0;
        iz += 1;
      }
    }
  }
  dustInto(f, nodeCount, rnd, [8.2, 4.2, 3]);
  return f;
}

/**
 * Formation 4 — Orbits. Five inclined rings of records circling a dense
 * amber core: every claim at the centre of the evidence it links to.
 * Rings are evenly beaded so they read as precise orbital chains.
 */
function buildOrbits(n: number, rnd: () => number): WorldFormation {
  const f = allocFormation(n);
  const pos = f.pos;
  const role = f.role;
  const R = [1.35, 2.1, 2.9, 3.7, 4.5];
  /* gentle inclinations — enough for depth, shallow enough that every
     ring still projects as a recognisable circle behind the cards */
  const TILT: ReadonlyArray<readonly [number, number]> = [
    [0.3, 0.1],
    [-0.22, 0.42],
    [0.16, -0.34],
    [-0.36, -0.16],
    [0.24, 0.3],
  ];
  const dens = [0.21, 0.22, 0.24, 0.18, 0.15];
  const structural = Math.floor(n * 0.82);
  const coreEnd = Math.floor(n * 0.92);
  let i = 0;
  for (let r = 0; r < 5; r++) {
    const cnt = Math.floor(structural * dens[r]);
    const [tx, tz] = TILT[r];
    const cosX = Math.cos(tx);
    const sinX = Math.sin(tx);
    const cosZ = Math.cos(tz);
    const sinZ = Math.sin(tz);
    for (let k = 0; k < cnt; k++, i++) {
      const ang = (k / cnt) * Math.PI * 2 + (rnd() - 0.5) * 0.02;
      const rad = R[r] + (rnd() - 0.5) * 0.07;
      const x0 = Math.cos(ang) * rad;
      const y0 = (rnd() - 0.5) * 0.08;
      const z0 = Math.sin(ang) * rad;
      /* tilt X then Z */
      const y1 = y0 * cosX - z0 * sinX;
      const z1 = y0 * sinX + z0 * cosX;
      const x2 = x0 * cosZ - y1 * sinZ;
      const y2 = x0 * sinZ + y1 * cosZ;
      pos[i * 3] = x2;
      pos[i * 3 + 1] = y2;
      pos[i * 3 + 2] = z1 - 0.6;
      role[i] = 1 + r;
    }
  }
  /* the dense core — role 6, amber */
  for (; i < coreEnd; i++) {
    const u = Math.max(1e-6, rnd());
    const v = rnd();
    const g = Math.sqrt(-2 * Math.log(u));
    pos[i * 3] = g * Math.cos(2 * Math.PI * v) * 0.42;
    pos[i * 3 + 1] = g * Math.sin(2 * Math.PI * v) * 0.42;
    pos[i * 3 + 2] = (rnd() - 0.5) * 0.5 - 0.6;
    role[i] = 6;
  }
  dustInto(f, coreEnd, rnd, [8.4, 4.4, 3]);
  return f;
}

/**
 * Formation 5 — Converge. A torus of context tightening around a focal
 * cluster — the literature, benchmarks and design decisions that close
 * into the constrained stance.
 */
function buildConverge(n: number, rnd: () => number): WorldFormation {
  const f = allocFormation(n);
  const pos = f.pos;
  const role = f.role;
  const torusCount = Math.floor(n * 0.58);
  const coreEnd = Math.floor(n * 0.9);
  for (let i = 0; i < torusCount; i++) {
    const u = (i / torusCount) * Math.PI * 2;
    const v = rnd() * Math.PI * 2;
    const R = 3.1;
    const r = 0.48 + (rnd() - 0.5) * 0.24;
    const x = (R + r * Math.cos(v)) * Math.cos(u);
    const y = r * Math.sin(v) * 0.9;
    const z = (R + r * Math.cos(v)) * Math.sin(u) * 0.55 - 0.5;
    /* tilt the whole torus for depth */
    pos[i * 3] = x * Math.cos(0.3) - y * Math.sin(0.3);
    pos[i * 3 + 1] = x * Math.sin(0.3) + y * Math.cos(0.3);
    pos[i * 3 + 2] = z;
    role[i] = 1;
  }
  for (let i = torusCount; i < coreEnd; i++) {
    const u = Math.max(1e-6, rnd());
    const v = rnd();
    const g = Math.sqrt(-2 * Math.log(u));
    pos[i * 3] = g * Math.cos(2 * Math.PI * v) * 0.6;
    pos[i * 3 + 1] = g * Math.sin(2 * Math.PI * v) * 0.6;
    pos[i * 3 + 2] = (rnd() - 0.5) * 0.7 - 0.5;
    role[i] = 2;
  }
  dustInto(f, coreEnd, rnd, [8.4, 4.4, 3.2]);
  return f;
}

/**
 * Formation 6 — Field. The page closes on an open, calm field: wide dust
 * and one faint duplex echo at the top — the same genome the visitor
 * started from, now far away.
 */
function buildField(n: number, rnd: () => number): WorldFormation {
  const f = allocFormation(n);
  const pos = f.pos;
  const role = f.role;
  const helixCount = Math.floor(n * 0.26);
  for (let k = 0; k < helixCount; k++) {
    const u = k / (helixCount - 1);
    const x = -8 + u * 16;
    const ang = u * Math.PI * 3.6 + (k % 2) * Math.PI;
    pos[k * 3] = x + (rnd() - 0.5) * 0.05;
    pos[k * 3 + 1] = 2.9 + Math.sin(ang) * 0.34 + (rnd() - 0.5) * 0.03;
    pos[k * 3 + 2] = Math.cos(ang) * 0.3 - 1.2 + (rnd() - 0.5) * 0.05;
    role[k] = (k % 2) + 1;
  }
  dustInto(f, helixCount, rnd, [8.4, 4.4, 3.4]);
  return f;
}

/** All formations (positions + roles) for a field of `n` particles. */
export function buildWorldFormations(n: number): WorldFormation[] {
  const rnd = mulberry32(20261023);
  return [
    buildHelix(n, rnd),
    buildTissue(n, rnd),
    buildStream(n, rnd),
    buildLattice(n, rnd),
    buildOrbits(n, rnd),
    buildConverge(n, rnd),
    buildField(n, rnd),
  ];
}

/* ------------------------------------------------------------------ */
/* Per-particle attributes (deterministic)                             */
/* ------------------------------------------------------------------ */

export type WorldAttrs = {
  scale: Float32Array;
  phase: Float32Array;
  ease: Float32Array;
};

/** Size / phase / easing-speed per particle. */
export function buildWorldAttrs(n: number): WorldAttrs {
  const rnd = mulberry32(97531);
  const scale = new Float32Array(n);
  const phase = new Float32Array(n);
  const ease = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = rnd();
    /* a few bright "anchor" points, mostly fine beads — the field
       renders at true point scale, so sizes stay in the 3-12 px band. */
    scale[i] = r < 0.05 ? 1.9 + rnd() * 0.9 : 0.5 + rnd() * rnd() * 1.2;
    phase[i] = rnd();
    ease[i] = 0.02 + rnd() * 0.035;
  }
  return { scale, phase, ease };
}

/* ------------------------------------------------------------------ */
/* Palettes — role -> colour + alpha, per formation and theme          */
/* ------------------------------------------------------------------ */

/** [r, g, b (sRGB 0-255), alpha 0-1] for one role. */
export type RoleStyle = readonly [number, number, number, number];

/* Light "paper" roles — the Okabe-Ito categorical set the workspace
   figures use, with sky deepened one step so thin one-bead structures
   (helix strands, ring arcs) keep real contrast on white. */
const LIGHT_ROLES: Readonly<Record<string, RoleStyle>> = {
  dust: [110, 118, 130, 0.34],
  sky: [36, 145, 210, 1.0],
  teal: [0, 152, 110, 1.0],
  orange: [222, 148, 0, 0.95],
  blue: [0, 114, 178, 1.0],
  vermillion: [213, 94, 0, 0.95],
  purple: [196, 106, 155, 0.95],
  ghost: [36, 145, 210, 0.45],
};

/* Dark "observatory" roles — aligned with the dark evidence tokens
   (sky-400 / emerald-400 / amber-400), muted enough to read as an
   instrument, never as neon. */
const DARK_ROLES: Readonly<Record<string, RoleStyle>> = {
  dust: [141, 151, 163, 0.4],
  sky: [56, 189, 248, 0.95],
  teal: [52, 211, 153, 0.95],
  orange: [251, 191, 36, 0.9],
  blue: [96, 165, 250, 0.95],
  vermillion: [248, 113, 113, 0.9],
  purple: [192, 132, 252, 0.9],
  ghost: [56, 189, 248, 0.38],
};

type ThemeRoles = Readonly<Record<string, RoleStyle>>;

function pick(roles: ThemeRoles, name: keyof typeof LIGHT_ROLES): RoleStyle {
  return roles[name];
}

/* Per-formation role tables, indexed by role id (0 = dust). */
const FORMATION_PALETTES: ReadonlyArray<{
  light: readonly RoleStyle[];
  dark: readonly RoleStyle[];
}> = [
  /* 0 Genome: strand A sky, strand B teal, rungs amber, ghost duplex */
  {
    light: [
      pick(LIGHT_ROLES, "dust"),
      pick(LIGHT_ROLES, "sky"),
      pick(LIGHT_ROLES, "teal"),
      pick(LIGHT_ROLES, "orange"),
      pick(LIGHT_ROLES, "dust"),
      pick(LIGHT_ROLES, "ghost"),
    ],
    dark: [
      pick(DARK_ROLES, "dust"),
      pick(DARK_ROLES, "sky"),
      pick(DARK_ROLES, "teal"),
      pick(DARK_ROLES, "orange"),
      pick(DARK_ROLES, "dust"),
      pick(DARK_ROLES, "ghost"),
    ],
  },
  /* 1 Section: the five cluster colours of Fig. 2 */
  {
    light: [
      pick(LIGHT_ROLES, "dust"),
      pick(LIGHT_ROLES, "vermillion"),
      pick(LIGHT_ROLES, "teal"),
      pick(LIGHT_ROLES, "sky"),
      pick(LIGHT_ROLES, "purple"),
      pick(LIGHT_ROLES, "orange"),
    ],
    dark: [
      pick(DARK_ROLES, "dust"),
      pick(DARK_ROLES, "vermillion"),
      pick(DARK_ROLES, "teal"),
      pick(DARK_ROLES, "sky"),
      pick(DARK_ROLES, "purple"),
      pick(DARK_ROLES, "orange"),
    ],
  },
  /* 2 Pipeline: request blue, main sky, verified teal */
  {
    light: [
      pick(LIGHT_ROLES, "dust"),
      pick(LIGHT_ROLES, "blue"),
      pick(LIGHT_ROLES, "sky"),
      pick(LIGHT_ROLES, "teal"),
    ],
    dark: [
      pick(DARK_ROLES, "dust"),
      pick(DARK_ROLES, "blue"),
      pick(DARK_ROLES, "sky"),
      pick(DARK_ROLES, "teal"),
    ],
  },
  /* 3 Registry: bounded lattice sky, featured nodes amber */
  {
    light: [pick(LIGHT_ROLES, "dust"), pick(LIGHT_ROLES, "sky"), pick(LIGHT_ROLES, "orange")],
    dark: [pick(DARK_ROLES, "dust"), pick(DARK_ROLES, "sky"), pick(DARK_ROLES, "orange")],
  },
  /* 4 Orbits: rings sky/teal/blue/purple/sky around an amber core */
  {
    light: [
      pick(LIGHT_ROLES, "dust"),
      pick(LIGHT_ROLES, "sky"),
      pick(LIGHT_ROLES, "teal"),
      pick(LIGHT_ROLES, "blue"),
      pick(LIGHT_ROLES, "purple"),
      pick(LIGHT_ROLES, "sky"),
      pick(LIGHT_ROLES, "orange"),
    ],
    dark: [
      pick(DARK_ROLES, "dust"),
      pick(DARK_ROLES, "sky"),
      pick(DARK_ROLES, "teal"),
      pick(DARK_ROLES, "blue"),
      pick(DARK_ROLES, "purple"),
      pick(DARK_ROLES, "sky"),
      pick(DARK_ROLES, "orange"),
    ],
  },
  /* 5 Converge: torus sky, focal cluster amber */
  {
    light: [pick(LIGHT_ROLES, "dust"), pick(LIGHT_ROLES, "sky"), pick(LIGHT_ROLES, "orange")],
    dark: [pick(DARK_ROLES, "dust"), pick(DARK_ROLES, "sky"), pick(DARK_ROLES, "orange")],
  },
  /* 6 Field: the duplex echo, sky and teal */
  {
    light: [pick(LIGHT_ROLES, "dust"), pick(LIGHT_ROLES, "sky"), pick(LIGHT_ROLES, "teal")],
    dark: [pick(DARK_ROLES, "dust"), pick(DARK_ROLES, "sky"), pick(DARK_ROLES, "teal")],
  },
];

/* sRGB 0-255 -> linear, so the shader's linear->sRGB output encoding
   round-trips the authored colours exactly. */
function srgbToLinear(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Resolves one formation's roles into linear-space colours + alphas.
 * Alpha carries a small deterministic jitter per particle so fields
 * get natural texture without noise on the hue.
 */
export function writeFormationColors(
  colorOut: Float32Array,
  alphaOut: Float32Array,
  formation: WorldFormation,
  formationIndex: number,
  dark: boolean,
  rnd: () => number,
): void {
  const table = FORMATION_PALETTES[formationIndex][dark ? "dark" : "light"];
  const n = formation.role.length;
  for (let i = 0; i < n; i++) {
    const r = Math.min(table.length - 1, formation.role[i]) | 0;
    const style = table[r];
    colorOut[i * 3] = srgbToLinear(style[0]);
    colorOut[i * 3 + 1] = srgbToLinear(style[1]);
    colorOut[i * 3 + 2] = srgbToLinear(style[2]);
    alphaOut[i] = Math.min(1, style[3] * (0.85 + rnd() * 0.3));
  }
}

/* ------------------------------------------------------------------ */
/* Point shader — true-scale beads with depth fade                     */
/* ------------------------------------------------------------------ */

/*
 * uSize is a *world-space* radius factor (not pixels): together with the
 * 300/-z attenuation and the device-pixel ratio it lands the field in a
 * crisp 3-12 px band. vFade dims the far plane so depth reads instantly.
 * Colours cross-fade between the two active formations via uMix, exactly
 * like the CPU-side position morph.
 */
export const WORLD_VERTEX = /* glsl */ `
  attribute vec3 aColorA;
  attribute vec3 aColorB;
  attribute float aAlphaA;
  attribute float aAlphaB;
  attribute float aScale;
  attribute float aPhase;
  uniform float uTime;
  uniform float uSize;
  uniform float uWarp;
  uniform float uMix;
  uniform float uDpr;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vFade;
  void main() {
    vColor = mix(aColorA, aColorB, uMix);
    vec3 p = position;
    float ph = aPhase * 6.28318;
    p.x += sin(uTime * 0.32 + ph + p.y * 0.8) * uWarp;
    p.y += cos(uTime * 0.27 + ph * 1.31 + p.x * 0.55) * uWarp * 0.8;
    p.z += sin(uTime * 0.24 + ph * 0.83) * uWarp * 1.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = max(0.1, -mv.z);
    vFade = clamp(1.45 - dist * 0.06, 0.45, 1.0);
    float tw = 0.8 + 0.2 * sin(uTime * 0.85 + ph);
    vAlpha = mix(aAlphaA, aAlphaB, uMix) * tw;
    gl_PointSize = min(uSize * uDpr * aScale * (300.0 / dist), 26.0 * uDpr);
    gl_Position = projectionMatrix * mv;
  }
`;

/*
 * A defined disc with a soft shoulder — smoothstep(0.5, 0.13) — instead
 * of the old squared falloff, so a particle reads as a dot, not a smear.
 * Alpha composites normally (rgb stays full-strength), which keeps
 * colours true in both themes and never glows.
 */
export const WORLD_FRAGMENT = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vFade;
  uniform float uOpacity;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.11, d);
    float f = a * vAlpha * vFade * uOpacity;
    if (f < 0.01) discard;
    gl_FragColor = vec4(vColor, f);
    #include <colorspace_fragment>
  }
`;
