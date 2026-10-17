/**
 * Local demo data engine.
 *
 * Generates a small, deterministic, clearly-illustrative spatial
 * transcriptomics-like dataset in the browser. This is NOT real experimental
 * data and NOT Scanpy/Squidpy output: it exists only so the frontend can be
 * demonstrated end-to-end. Every screen that uses it labels it as
 * "illustrative demo data".
 */

import { fnv1a, mulberry32, poisson, gaussian } from "./rng";
import type {
  DatasetSchemaField,
  GeneInfo,
  DatasetMeta,
} from "./types";

export interface TissueParams {
  seed: number;
  nObs: number;
  nGenes: number;
  nLatentClusters: number;
  withCoordinates: boolean;
}

interface Lobe {
  cx: number;
  cy: number;
  sx: number;
  sy: number;
  rot: number;
  count: number;
}

const LATENT_K = 7;

function buildLobes(seed: number, nObs: number, k: number): Lobe[] {
  const rng = mulberry32(seed);
  const lobes: Lobe[] = [];
  // Spread cluster centers across a tissue-like region.
  const anchors: [number, number][] = [
    [0.28, 0.3],
    [0.62, 0.22],
    [0.5, 0.55],
    [0.24, 0.68],
    [0.78, 0.62],
    [0.44, 0.84],
    [0.68, 0.4],
  ];
  for (let c = 0; c < k; c++) {
    const a = anchors[c % anchors.length];
    lobes.push({
      cx: a[0] * 600 + (rng() - 0.5) * 24,
      cy: a[1] * 450 + (rng() - 0.5) * 24,
      sx: 52 + rng() * 34,
      sy: 40 + rng() * 26,
      rot: rng() * Math.PI,
      count: 0,
    });
  }
  // Cluster sizes sum to nObs with a mildly uneven profile.
  const weights = lobes.map((_, i) => 1 + 0.7 * Math.sin((i + 1) * 1.7) ** 2);
  const wSum = weights.reduce((a, b) => a + b, 0);
  lobes.forEach((l, i) => {
    l.count = Math.max(60, Math.round((weights[i] / wSum) * nObs));
  });
  return lobes;
}

function lobePoint(l: Lobe, rng: () => number): [number, number] {
  const u = gaussian(rng, 0, 1);
  const v = gaussian(rng, 0, 1) * 0.82; // slight vertical squash
  const cos = Math.cos(l.rot);
  const sin = Math.sin(l.rot);
  const dx = (u * l.sx) / 2.4;
  const dy = (v * l.sy) / 2.4;
  // Round so that server-side and browser-side rendering produce
  // byte-identical values (avoids hydration mismatches from ULP noise).
  return [round2(l.cx + dx * cos - dy * sin), round2(l.cy + dx * sin + dy * cos)];
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export class DemoEngine {
  readonly params: TissueParams;
  readonly obsIds: string[];
  readonly x: number[];
  readonly y: number[];
  readonly latent: number[];
  readonly geneNames: string[];
  readonly counts: Uint16Array;
  readonly totalCounts: number[];
  readonly nGenesPerObs: number[];
  readonly markerSets: Map<number, number[]>;
  readonly baseLambda: Float32Array;

  constructor(params: TissueParams) {
    this.params = params;
    const { seed, nObs, nGenes } = params;
    const rng = mulberry32(seed);
    const k = LATENT_K;
    const lobes = buildLobes(seed, nObs, k);

    const obsIds: string[] = [];
    const xs: number[] = [];
    const ys: number[] = [];
    const latent: number[] = [];
    let placed = 0;
    for (let c = 0; c < k; c++) {
      for (let i = 0; i < lobes[c].count && placed < nObs; i++, placed++) {
        const [px, py] = lobePoint(lobes[c], rng);
        xs.push(params.withCoordinates ? px : 0);
        ys.push(params.withCoordinates ? py : 0);
        latent.push(c);
        obsIds.push(`spot_${String(placed + 1).padStart(5, "0")}`);
      }
    }
    // Fill any rounding remainder.
    while (placed < nObs) {
      const c = placed % k;
      const [px, py] = lobePoint(lobes[c], rng);
      xs.push(params.withCoordinates ? px : 0);
      ys.push(params.withCoordinates ? py : 0);
      latent.push(c);
      obsIds.push(`spot_${String(placed + 1).padStart(5, "0")}`);
      placed++;
    }
    this.obsIds = obsIds;
    this.x = xs;
    this.y = ys;
    this.latent = latent;

    // Gene identifiers are deliberately synthetic.
    this.geneNames = Array.from({ length: nGenes }, (_, i) => `Gene${String(i + 1).padStart(4, "0")}`);

    // Marker genes per latent cluster (deterministic selection, unique).
    this.markerSets = new Map();
    const used = new Set<number>();
    for (let c = 0; c < k; c++) {
      const markers: number[] = [];
      const candidates = [31 + c * 29, 173 + c * 19, 331 + c * 23, 402 + c * 13];
      for (const cand of candidates) {
        if (cand < nGenes && !used.has(cand)) {
          used.add(cand);
          markers.push(cand);
        }
      }
      this.markerSets.set(c, markers);
    }

    // Base expression intensity per gene (housekeeping-like).
    const baseRng = mulberry32(seed ^ 0x9e3779b9);
    this.baseLambda = new Float32Array(nGenes);
    for (let g = 0; g < nGenes; g++) {
      this.baseLambda[g] = 0.6 + baseRng() * 5.2;
    }

    // Counts matrix (nObs x nGenes), generated once, deterministically.
    this.counts = new Uint16Array(nObs * nGenes);
    this.totalCounts = new Array(nObs).fill(0);
    this.nGenesPerObs = new Array(nObs).fill(0);
    const boost = new Float32Array(nGenes);
    for (let c = 0; c < k; c++) {
      for (const m of this.markerSets.get(c) ?? []) boost[m] = 14 + (c % 3) * 9;
    }
    for (let i = 0; i < nObs; i++) {
      const c = latent[i];
      let total = 0;
      let detected = 0;
      for (let g = 0; g < nGenes; g++) {
        const lam = this.baseLambda[g] + (this.markerSets.get(c)?.includes(g) ? boost[g] : 0);
        const v = poisson(rng, lam);
        if (v > 0) {
          this.counts[i * nGenes + g] = Math.min(v, 400);
          total += Math.min(v, 400);
          detected++;
        }
      }
      this.totalCounts[i] = total;
      this.nGenesPerObs[i] = detected;
    }
  }

  get nObs() {
    return this.params.nObs;
  }
  get nGenes() {
    return this.params.nGenes;
  }

  fingerprint(): string {
    const sample = [this.params, this.obsIds[0], this.obsIds.at(-1), this.x[0], this.y[0], this.totalCounts[0]];
    return `fnv1a:${fnv1a(JSON.stringify(sample))}`;
  }

  geneList(): GeneInfo[] {
    const out: GeneInfo[] = [];
    const n = this.nGenes;
    for (let g = 0; g < n; g++) {
      let sum = 0;
      let det = 0;
      for (let i = 0; i < this.nObs; i++) {
        const v = this.counts[i * n + g];
        sum += v;
        if (v > 0) det++;
      }
      out.push({
        index: g,
        name: this.geneNames[g],
        meanCounts: sum / this.nObs,
        detectedFraction: det / this.nObs,
      });
    }
    return out;
  }

  /** Expression vector for a gene under a given layer. */
  geneVector(geneIndex: number, layer: string): number[] {
    const n = this.nGenes;
    const out = new Array(this.nObs);
    if (layer === "lognorm") {
      for (let i = 0; i < this.nObs; i++) {
        const c = this.counts[i * n + geneIndex];
        out[i] = c === 0 ? 0 : Math.log1p((c / this.totalCounts[i]) * 1e4);
      }
    } else {
      for (let i = 0; i < this.nObs; i++) {
        out[i] = this.counts[i * n + geneIndex];
      }
    }
    return out;
  }

  /** Resolve a requested identifier against the gene list. */
  resolveGene(requested: string): {
    match: "exact" | "not_found" | "ambiguous";
    resolved: string | null;
    candidates: string[];
  } {
    const exact = this.geneNames.indexOf(requested);
    if (exact >= 0) return { match: "exact", resolved: requested, candidates: [] };
    const prefix = this.geneNames.filter((g) => g.toLowerCase().startsWith(requested.toLowerCase()));
    if (prefix.length === 1) {
      return { match: "exact", resolved: prefix[0], candidates: [prefix[0]] };
    }
    if (prefix.length > 1 && prefix.length <= 8) {
      return { match: "ambiguous", resolved: null, candidates: prefix.slice(0, 8) };
    }
    if (prefix.length > 8) {
      return { match: "ambiguous", resolved: null, candidates: prefix.slice(0, 8) };
    }
    return { match: "not_found", resolved: null, candidates: [] };
  }

  /**
   * Simulated clustering output. Resolution changes cluster count by merging
   * (low) or splitting (high) latent domains; seed perturbs the embedding.
   * Deterministic — documented as a simulation, not Leiden output.
   */
  cluster(resolution: number, seed: number): { labels: number[]; k: number } {
    let labels = [...this.latent];
    let k = LATENT_K;
    const target = Math.max(3, Math.min(10, Math.round(4 + resolution * 4)));
    // Merge smallest adjacent latent clusters until k <= target.
    while (k > target) {
      const sizes = new Map<number, number>();
      labels.forEach((l) => sizes.set(l, (sizes.get(l) ?? 0) + 1));
      const order = [...sizes.entries()].sort((a, b) => a[1] - b[1]);
      const small = order[0][0];
      const keep = order[1][0];
      labels = labels.map((l) => (l === small ? keep : l));
      k--;
    }
    // Split largest clusters by x-coordinate until k >= target.
    while (k < target) {
      const sizes = new Map<number, number>();
      labels.forEach((l) => sizes.set(l, (sizes.get(l) ?? 0) + 1));
      const order = [...sizes.entries()].sort((a, b) => b[1] - a[1]);
      const big = order[0][0];
      const idx = labels.map((l, i) => (l === big ? i : -1)).filter((i) => i >= 0);
      const xs = idx.map((i) => this.x[i]).sort((a, b) => a - b);
      const cut = xs[Math.floor(xs.length / 2)];
      labels = labels.map((l, i) => (l === big && this.x[i] > cut ? k : l));
      k++;
    }
    // Relabel compactly 0..k-1 in original order of appearance.
    const remap = new Map<number, number>();
    let next = 0;
    for (const l of labels) {
      if (!remap.has(l)) remap.set(l, next++);
    }
    labels = labels.map((l) => remap.get(l) as number);
    return { labels, k: next };
  }

  /** Synthetic 2-D embedding for the demo (not a real UMAP computation). */
  embedding(labels: number[], seed: number): { x: number[]; y: number[] } {
    const rng = mulberry32(seed ^ 0x5bf03635);
    const k = Math.max(...labels) + 1;
    const centers: [number, number][] = [];
    for (let c = 0; c < k; c++) {
      const ang = (c / k) * Math.PI * 2 + 0.4;
      centers.push([Math.cos(ang) * 8 + 10, Math.sin(ang) * 5.5 + 8]);
    }
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < labels.length; i++) {
      const c = centers[labels[i]];
      x.push(Math.round((c[0] + gaussian(rng, 0, 1.15)) * 1000) / 1000);
      y.push(Math.round((c[1] + gaussian(rng, 0, 0.9)) * 1000) / 1000);
    }
    return { x, y };
  }

  coordinateBounds() {
    if (!this.params.withCoordinates) return null;
    return {
      x_min: Math.min(...this.x),
      x_max: Math.max(...this.x),
      y_min: Math.min(...this.y),
      y_max: Math.max(...this.y),
    };
  }
}

/* ---------- Dataset catalog ---------- */

export const DEMO_DATASET_CATALOG: DatasetMeta[] = [
  {
    id: "ds_demo_tissue_01",
    name: "Illustrative demo — synthetic tissue section",
    shortId: "demo-tissue-01",
    n_obs: 2400,
    n_genes: 500,
    hasSpatialCoordinates: true,
    validation: "validated",
    schemaSummary: "X (counts) 2400 × 500 · obsm['spatial'] · layers: counts, lognorm",
    obsCountLabel: "2,400 observations",
    genesLabel: "500 genes",
    source: "Generated locally in this browser (synthetic, seed 42) — not experimental data",
    citation: null,
    license: null,
    accession: null,
    downloadedAt: null,
    checksumLabel: null,
    loadable: true,
    illustrative: true,
  },
  {
    id: "ds_demo_nospatial_02",
    name: "Illustrative demo — synthetic profiles (no spatial coordinates)",
    shortId: "demo-nospatial-02",
    n_obs: 1800,
    n_genes: 400,
    hasSpatialCoordinates: false,
    validation: "warning",
    schemaSummary: "X (counts) 1800 × 400 · obsm['spatial'] absent · layers: counts",
    obsCountLabel: "1,800 observations",
    genesLabel: "400 genes",
    source: "Generated locally in this browser (synthetic, seed 77) — not experimental data",
    citation: null,
    license: null,
    accession: null,
    downloadedAt: null,
    checksumLabel: null,
    loadable: true,
    illustrative: true,
  },
];

const ENGINE_CACHE = new Map<string, DemoEngine>();

export function getDemoEngine(datasetId: string): DemoEngine {
  let engine = ENGINE_CACHE.get(datasetId);
  if (!engine) {
    if (datasetId === "ds_demo_nospatial_02") {
      engine = new DemoEngine({
        seed: 77,
        nObs: 1800,
        nGenes: 400,
        nLatentClusters: 5,
        withCoordinates: false,
      });
    } else {
      engine = new DemoEngine({
        seed: 42,
        nObs: 2400,
        nGenes: 500,
        nLatentClusters: 7,
        withCoordinates: true,
      });
    }
    ENGINE_CACHE.set(datasetId, engine);
  }
  return engine;
}

/** Small engine used only for the landing-page workspace preview. */
export function getPreviewEngine(): DemoEngine {
  let engine = ENGINE_CACHE.get("preview");
  if (!engine) {
    engine = new DemoEngine({
      seed: 2026,
      nObs: 900,
      nGenes: 300,
      nLatentClusters: 6,
      withCoordinates: true,
    });
    ENGINE_CACHE.set("preview", engine);
  }
  return engine;
}

/* ---------- Schema field descriptions ---------- */

export function schemaFieldsFor(engine: DemoEngine, datasetId: string): {
  obsFields: DatasetSchemaField[];
  varFields: DatasetSchemaField[];
  unavailableFields: string[];
} {
  const withSpatial = engine.params.withCoordinates;
  const obsFields: DatasetSchemaField[] = [
    {
      field: "obs_names",
      location: "obs",
      dtype: "index (str)",
      description: `Observation identifiers (spot_00001 … spot_${String(engine.nObs).padStart(5, "0")})`,
    },
    {
      field: "total_counts",
      location: "obs",
      dtype: "int64",
      description: "Total counts per observation (computed on the counts matrix)",
    },
    {
      field: "n_genes",
      location: "obs",
      dtype: "int64",
      description: "Number of detected genes per observation",
    },
  ];
  const varFields: DatasetSchemaField[] = [
    {
      field: "var_names",
      location: "var",
      dtype: "index (str)",
      description: `Synthetic gene identifiers (Gene0001 … Gene${String(engine.nGenes).padStart(4, "0")})`,
      notes: "Demo identifiers — not real gene symbols",
    },
  ];
  if (withSpatial) {
    obsFields.push({
      field: "obsm['spatial']",
      location: "obsm",
      dtype: "float64 (n_obs × 2)",
      description: "Spatial coordinates (x, y) per observation",
    });
  }
  const unavailable: string[] = [
    "obs['mt_fraction'] — not assessed: requires mitochondrial gene annotation, which the demo schema does not include",
  ];
  if (!withSpatial) {
    unavailable.push(
      "obsm['spatial'] — missing: spatial workflows cannot run on this dataset (demonstrates honest gating)"
    );
  }
  if (datasetId === "ds_demo_tissue_01") {
    unavailable.push("uns['tissue_image'] — not available: no tissue image or transform is provided; plots use an honest coordinate scatter");
  }
  return { obsFields, varFields, unavailableFields: unavailable };
}
