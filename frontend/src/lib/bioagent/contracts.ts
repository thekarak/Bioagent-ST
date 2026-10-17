/**
 * Evidence contracts for the three approved v1 workflows.
 *
 * A contract is the machine-readable agreement between a workflow and the
 * rest of the system: what inputs are required, which parameter ranges are
 * allowed, which artifacts must exist, which checks verify them, and how the
 * workflow fails. Contracts are versioned alongside workflow code.
 *
 * These definitions mirror the planned backend contract schema; in this
 * frontend prototype they drive the contract views (evaluation protocol and
 * run detail) and are clearly labeled as design specifications, not executed
 * validations.
 */

import type { EvidenceContract } from "./types";

export const EVIDENCE_CONTRACTS: EvidenceContract[] = [
  {
    workflow: "quality_assessment",
    version: "v1",
    requiredInputs: [
      { label: "X (or named layer)", requirement: "expression matrix with known semantics" },
      { label: "obs / var IDs", requirement: "unique identifiers (or documented resolution)" },
      { label: "obsm['spatial']", requirement: "not required — absence reported, not assumed" },
    ],
    allowedParameters: [
      { label: "min_counts", range: "0 – 100,000" },
      { label: "min_genes", range: "0 – 5,000" },
    ],
    expectedArtifacts: ["schema_report.json", "qc_table.csv", "qc_plots.png", "manifest.json"],
    validationChecks: [
      "artifacts_present — expected outputs exist and are readable",
      "metrics_finite — one finite value per observation",
      "missing_fields_reported — unsupported metrics listed, never invented",
    ],
    failurePolicy: "Reject or clarify on invalid schema; record failed checks; never silently repair.",
  },
  {
    workflow: "spatial_clustering",
    version: "v1",
    requiredInputs: [
      { label: "X (or named layer)", requirement: "expression matrix with known semantics" },
      { label: "obsm['spatial']", requirement: "shape (n_obs, 2) — required for spatial plots" },
      { label: "obs / var IDs", requirement: "unique identifiers" },
    ],
    allowedParameters: [
      { label: "n_pcs", range: "5 – 100" },
      { label: "n_neighbors", range: "3 – 50" },
      { label: "resolution", range: "0.1 – 3.0" },
      { label: "seed", range: "0 – 2^31-1" },
    ],
    expectedArtifacts: ["cluster_labels.npy", "cluster_table.csv", "umap_coords.npy", "spatial_plot.png", "manifest.json"],
    validationChecks: [
      "labels_aligned — one label per observation",
      "labels_range — integer labels within [0, k-1]",
      "embedding_valid — finite, complete 2-D coordinates",
      "coords_valid — finite spatial coordinates",
    ],
    failurePolicy: "Block when spatial coordinates are missing; mark failed runs; no success report from a failed check.",
  },
  {
    workflow: "gene_expression",
    version: "v1",
    requiredInputs: [
      { label: "X (or named layer)", requirement: "expression matrix with known semantics" },
      { label: "var_names", requirement: "gene identifiers to resolve against" },
      { label: "obsm['spatial']", requirement: "shape (n_obs, 2) — required for spatial plots" },
    ],
    allowedParameters: [
      { label: "genes", range: "1 – 5 identifiers" },
      { label: "layer", range: "layer recorded in the dataset schema" },
    ],
    expectedArtifacts: ["gene_match_report.json", "expression_summary.csv", "spatial_plots.png", "manifest.json"],
    validationChecks: [
      "genes_resolved — exact match required; ambiguous or missing reported, never substituted",
      "values_finite — all extracted expression values are finite",
    ],
    failurePolicy: "Report unresolved genes explicitly; no silent substitution; ambiguous identifiers route to review.",
  },
];

export function workflowContract(
  workflow: "quality_assessment" | "spatial_clustering" | "gene_expression"
): EvidenceContract {
  return EVIDENCE_CONTRACTS.find((c) => c.workflow === workflow)!;
}
