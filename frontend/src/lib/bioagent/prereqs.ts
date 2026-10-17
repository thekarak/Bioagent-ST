/**
 * Prerequisite evaluation for the selected workflow.
 * Checks reflect the dataset metadata and requested inputs that are actually
 * available — statuses are pass / missing / warning / not_assessed, and a
 * green indicator is never shown for a check that has not run.
 */

import type { DatasetMeta, PrerequisiteCheck, WorkflowId, WorkflowParams } from "./types";
import { PARAM_RANGES } from "./workflows";

export interface PrereqInput {
  workflow: WorkflowId;
  dataset: DatasetMeta | null;
  params: WorkflowParams;
  /** Gene resolution results when the workflow needs genes. */
  geneResolutions?: { requested: string; match: "exact" | "not_found" | "ambiguous" }[];
}

export function evaluatePrerequisites(input: PrereqInput): PrerequisiteCheck[] {
  const checks: PrerequisiteCheck[] = [];
  const { workflow, dataset, params } = input;

  const hasMatrix = dataset !== null;
  checks.push({
    id: "expression_matrix",
    label: "Expression matrix present",
    status: hasMatrix ? "pass" : "missing",
    explanation: hasMatrix
      ? `X matrix available (${dataset?.obsCountLabel}, ${dataset?.genesLabel}).`
      : "No dataset is loaded, so the presence of an expression matrix cannot be confirmed.",
    source: "dataset registry",
    required: true,
  });

  checks.push({
    id: "identifiers",
    label: "Required identifiers available",
    status: hasMatrix ? "pass" : "missing",
    explanation: hasMatrix
      ? "Observation and gene identifiers are unique in the registered schema."
      : "Not assessable without a loaded dataset.",
    source: "dataset schema validation",
    required: true,
  });

  const needsCoords = workflow === "spatial_clustering" || workflow === "gene_expression";
  if (needsCoords) {
    const hasCoords = dataset?.hasSpatialCoordinates === true;
    checks.push({
      id: "spatial_coords",
      label: "Spatial coordinates present",
      status: hasCoords ? "pass" : "missing",
      explanation: hasCoords
        ? "obsm['spatial'] is available for spatial display."
        : dataset
          ? "obsm['spatial'] is absent on this dataset. Spatial display and spatial workflows cannot proceed."
          : "Not assessable without a loaded dataset.",
      source: "dataset schema validation",
      required: true,
    });
  }

  if (workflow === "gene_expression") {
    const genes = (params as { genes?: string[] }).genes ?? [];
    const resolutions =
      input.geneResolutions ??
      genes.map((g) => ({ requested: g, match: "not_found" as const }));
    if (genes.length === 0) {
      checks.push({
        id: "genes_resolved",
        label: "Required genes resolved",
        status: "not_assessed",
        explanation: "No genes requested yet. Add between 1 and 5 genes to proceed.",
        source: "gene resolution",
        required: true,
      });
    } else {
      const unresolved = resolutions.filter((r) => r.match !== "exact");
      const ambiguous = resolutions.filter((r) => r.match === "ambiguous");
      checks.push({
        id: "genes_resolved",
        label: "Required genes resolved",
        status: unresolved.length === 0 ? "pass" : ambiguous.length > 0 ? "warning" : "missing",
        explanation:
          unresolved.length === 0
            ? `All ${genes.length} requested gene(s) resolved to exact matches in var_names.`
            : ambiguous.length > 0
              ? `Ambiguous identifier(s): ${ambiguous
                  .map((a) => a.requested)
                  .join(", ")}. Refusing to silently substitute a different gene.`
              : `Unresolved identifier(s): ${resolutions
                  .filter((r) => r.match === "not_found")
                  .map((r) => r.requested)
                  .join(", ")}. The gene is not present in var_names.`,
        source: "gene resolution",
        required: true,
      });
      if (genes.length > PARAM_RANGES.maxGenes) {
        checks.push({
          id: "gene_count",
          label: "Requested genes within allowed range (1–5)",
          status: "missing",
          explanation: `${genes.length} genes requested; the approved workflow supports at most ${PARAM_RANGES.maxGenes}.`,
          source: "workflow specification",
          required: true,
        });
      }
    }
  }

  // Parameter range checks.
  const p = params as Record<string, unknown>;
  const rangeChecks: { id: string; label: string; value: number | null; range: { min: number; max: number } }[] = [];
  if (workflow === "spatial_clustering") {
    rangeChecks.push(
      { id: "param_n_pcs", label: "n_pcs within allowed range", value: numOrNull(p.n_pcs), range: PARAM_RANGES.n_pcs },
      { id: "param_neighbors", label: "n_neighbors within allowed range", value: numOrNull(p.n_neighbors), range: PARAM_RANGES.n_neighbors },
      { id: "param_resolution", label: "resolution within allowed range", value: numOrNull(p.resolution), range: PARAM_RANGES.resolution },
      { id: "param_seed", label: "seed within allowed range", value: numOrNull(p.seed), range: PARAM_RANGES.seed }
    );
  }
  if (workflow === "quality_assessment") {
    rangeChecks.push(
      { id: "param_min_counts", label: "min_counts within allowed range", value: numOrNull(p.min_counts), range: PARAM_RANGES.min_counts },
      { id: "param_min_genes", label: "min_genes within allowed range", value: numOrNull(p.min_genes), range: PARAM_RANGES.min_genes }
    );
  }
  for (const rc of rangeChecks) {
    const inRange = rc.value !== null && rc.value >= rc.range.min && rc.value <= rc.range.max;
    checks.push({
      id: rc.id,
      label: rc.label,
      status: inRange ? "pass" : "missing",
      explanation: inRange
        ? `Value ${rc.value} is within [${rc.range.min}, ${rc.range.max}].`
        : `Value ${
            rc.value === null ? "is empty" : String(rc.value)
          } is outside the allowed range [${rc.range.min}, ${rc.range.max}]. Invalid values are reported, not silently altered.`,
      source: "parameter validation",
      required: true,
    });
  }

  // Workflow support by the dataset.
  if (workflow !== "unsupported_or_ambiguous") {
    const supported =
      dataset !== null &&
      (workflow === "quality_assessment" ||
        (needsCoords ? dataset.hasSpatialCoordinates === true : true));
    checks.push({
      id: "workflow_supported",
      label: "Workflow supported by the available dataset",
      status: supported ? "pass" : "missing",
      explanation: supported
        ? "The selected workflow's requirements are met by this dataset."
        : "The selected workflow requires spatial coordinates, which this dataset does not provide.",
      source: "workflow registry",
      required: true,
    });
  }

  return checks;
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

/**
 * Policy gate: BLOCK when a required prerequisite is missing;
 * REVIEW for unsupported/ambiguous requests or warnings;
 * ALLOW only when the request is fully ready for the approved workflow.
 */
export function evaluatePolicy(
  workflow: WorkflowId,
  prereqs: PrerequisiteCheck[]
): { decision: "ALLOW" | "REVIEW" | "BLOCK"; reason: string; detail: string } {
  const missing = prereqs.filter((c) => c.required && c.status === "missing");
  const warning = prereqs.filter((c) => c.required && c.status === "warning");
  const notAssessed = prereqs.filter((c) => c.required && c.status === "not_assessed");

  if (workflow === "unsupported_or_ambiguous") {
    return {
      decision: "REVIEW",
      reason: "Request is unsupported or ambiguous",
      detail:
        "The selector could not map this request to exactly one approved workflow. BioAgent-ST will not guess a workflow for an ambiguous request. Reformulate the question, or select a workflow manually — manual selections still pass through this gate.",
    };
  }
  if (missing.length > 0) {
    return {
      decision: "BLOCK",
      reason: `Required input missing: ${missing.map((m) => m.label).join("; ")}`,
      detail: `The workflow cannot start because required prerequisites are not met. ${missing
        .map((m) => m.explanation)
        .join(" ")}`,
    };
  }
  if (notAssessed.length > 0) {
    return {
      decision: "REVIEW",
      reason: `Not assessed yet: ${notAssessed.map((m) => m.label).join("; ")}`,
      detail: "Some required inputs have not been provided. Complete the request before running the approved workflow.",
    };
  }
  if (warning.length > 0) {
    return {
      decision: "REVIEW",
      reason: `Needs review: ${warning.map((w) => w.label).join("; ")}`,
      detail: warning.map((w) => w.explanation).join(" "),
    };
  }
  return {
    decision: "ALLOW",
    reason: "All required prerequisites passed",
    detail:
      "Dataset, identifiers, parameters and required inputs satisfy the registered workflow's requirements. Execution will proceed through the approved workflow only.",
  };
}
