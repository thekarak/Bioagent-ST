/**
 * Registry of the three approved v1 workflows.
 * The "planned backend steps" text documents the registered scientific
 * pipeline; in this prototype those steps are NOT executed (no scientific
 * backend is connected — runs are clearly-labeled simulations).
 */

import type { WorkflowId, ClusteringParams, GeneExpressionParams, QualityParams } from "./types";

export interface WorkflowSpec {
  id: WorkflowId;
  title: string;
  short: string;
  purpose: string;
  representativeOutput: string;
  plannedBackendSteps: string[];
  paramSummary: (params: Record<string, unknown>) => string;
}

export const WORKFLOWS: Record<
  "quality_assessment" | "spatial_clustering" | "gene_expression",
  WorkflowSpec
> = {
  quality_assessment: {
    id: "quality_assessment",
    title: "Dataset & Quality Assessment",
    short: "Quality assessment",
    purpose:
      "Inspect the structure, schema and quality of a spatial transcriptomics dataset before further analysis.",
    representativeOutput: "Schema report, QC metrics, validation results and run manifest",
    plannedBackendSteps: [
      "Read AnnData object and report matrix dimensions",
      "Check identifier uniqueness and expected fields",
      "Compute supported QC metrics (counts, detected genes)",
      "Mark unsupported metrics as not assessed (e.g. mitochondrial fraction without annotation)",
      "Emit machine-readable schema report and run manifest",
    ],
    paramSummary: (p) =>
      `QC thresholds: min_counts=${String(p.min_counts ?? "—")}, min_genes=${String(p.min_genes ?? "—")}`,
  },
  spatial_clustering: {
    id: "spatial_clustering",
    title: "Expression Clustering & Spatial Visualization",
    short: "Spatial clustering",
    purpose:
      "Group observations by expression patterns and display their spatial arrangement. Clusters are labeled neutrally (Cluster 0, 1, …); they are not cell types.",
    representativeOutput: "Spatial scatter colored by cluster, cluster table, UMAP, parameter manifest",
    plannedBackendSteps: [
      "normalize_total + log1p transformation",
      "Highly variable gene selection",
      "PCA (sc.pp.pca)",
      "Neighbor graph (sc.pp.neighbors)",
      "Leiden clustering (sc.tl.leiden)",
      "UMAP embedding (sc.tl.umap)",
      "Spatial scatterplot via Squidpy (sq.pl.spatial_scatter)",
    ],
    paramSummary: (p) =>
      `norm=${String(p.normalization ?? "—")}, pcs=${String(p.n_pcs ?? "—")}, neighbors=${String(
        p.n_neighbors ?? "—"
      )}, resolution=${String(p.resolution ?? "—")}, seed=${String(p.seed ?? "—")}`,
  },
  gene_expression: {
    id: "gene_expression",
    title: "Selected-Gene Expression Exploration",
    short: "Gene expression",
    purpose:
      "Explore spatial expression for one to five researcher-selected genes with explicit gene-match verification. No silent substitution of unresolved genes.",
    representativeOutput: "Spatial expression plots, distribution summary, gene-match verification",
    plannedBackendSteps: [
      "Resolve requested gene identifiers against var_names (exact / ambiguous / not found)",
      "Extract expression vectors from the requested layer",
      "Render spatial expression plots with a continuous scale",
      "Compute distribution summaries and emit gene-match report",
    ],
    paramSummary: (p) =>
      `genes=${((p.genes as string[]) ?? []).join(", ") || "—"}, layer=${String(p.layer ?? "—")}`,
  },
};

export const WORKFLOW_ORDER: ("quality_assessment" | "spatial_clustering" | "gene_expression")[] = [
  "quality_assessment",
  "spatial_clustering",
  "gene_expression",
];

export function workflowSpec(id: WorkflowId): WorkflowSpec | null {
  if (id === "unsupported_or_ambiguous") return null;
  return WORKFLOWS[id] ?? null;
}

export function defaultClusteringParams(): ClusteringParams {
  return { normalization: "lognorm", n_pcs: 20, n_neighbors: 15, resolution: 0.8, seed: 0 };
}

export function defaultGeneExpressionParams(): GeneExpressionParams {
  return { genes: [], layer: "counts" };
}

export function defaultQualityParams(): QualityParams {
  return { min_counts: 500, min_genes: 200 };
}

/** Parameter validation ranges — invalid values are reported, never silently altered. */
export const PARAM_RANGES = {
  n_pcs: { min: 5, max: 100 },
  n_neighbors: { min: 3, max: 50 },
  resolution: { min: 0.1, max: 3 },
  seed: { min: 0, max: 2 ** 31 - 1 },
  min_counts: { min: 0, max: 100000 },
  min_genes: { min: 0, max: 5000 },
  maxGenes: 5,
} as const;
