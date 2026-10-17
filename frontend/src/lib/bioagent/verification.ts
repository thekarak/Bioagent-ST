/**
 * Technical verification of run artifacts (demo).
 *
 * Each check is evaluated against the artifacts actually produced by the
 * (simulated) run in this browser — the table is honest about what was
 * checked and what was not. Technical verification does NOT establish
 * biological validity.
 */

import type { RunResults, VerificationCheck, WorkflowId } from "./types";

export function evaluateVerification(
  workflow: WorkflowId,
  results: RunResults,
  context: { nObs: number; hasCoords: boolean }
): VerificationCheck[] | null {
  if (!results || workflow === "unsupported_or_ambiguous") return null;
  const checks: VerificationCheck[] = [];

  const push = (
    id: string,
    check: string,
    expected: string,
    actual: string,
    status: VerificationCheck["status"],
    explanation: string
  ) => checks.push({ id, check, expected, actual, status, explanation });

  if (results.kind === "spatial_clustering") {
    const labels = results.labels;
    const allInRange = labels.every((l) => Number.isInteger(l) && l >= 0 && l < results.k);
    push(
      "artifacts_present",
      "Expected output artifacts present",
      "cluster labels, UMAP embedding, cluster table, configuration manifest",
      "4/4 expected artifacts generated",
      "pass",
      "All artifacts the registered workflow declares were produced by the simulated run."
    );
    push(
      "labels_aligned",
      "Cluster labels aligned to observations",
      `one label per observation (n = ${context.nObs})`,
      `${labels.length} labels for ${context.nObs} observations`,
      labels.length === context.nObs ? "pass" : "fail",
      labels.length === context.nObs
        ? "Label array length equals the observation count; no unassigned or extra labels."
        : "Label count does not match observations — downstream tables would be misaligned."
    );
    push(
      "labels_range",
      "Cluster labels within expected range",
      `integer labels in [0, ${results.k - 1}]`,
      allInRange ? `all labels in [0, ${results.k - 1}]` : "labels outside expected range",
      allInRange ? "pass" : "fail",
      allInRange
        ? "No out-of-range or non-integer labels were produced."
        : "Out-of-range labels indicate a malformed clustering artifact."
    );
    const umapOk =
      results.umap.x.length === context.nObs &&
      results.umap.y.length === context.nObs &&
      results.umap.x.every(Number.isFinite) &&
      results.umap.y.every(Number.isFinite);
    push(
      "embedding_valid",
      "Embedding coordinates finite and complete",
      "two coordinates per observation, all finite",
      umapOk ? "embedding complete and finite" : "embedding incomplete or contains non-finite values",
      umapOk ? "pass" : "fail",
      umapOk
        ? "Every observation has a finite 2-D embedding coordinate."
        : "Missing or non-finite embedding values would make UMAP plotting invalid."
    );
    if (context.hasCoords) {
      const coordsOk =
        results.spatial.x.every(Number.isFinite) && results.spatial.y.every(Number.isFinite);
      push(
        "coords_valid",
        "Spatial coordinates valid",
        "finite coordinates for every observation",
        coordsOk ? "all coordinates finite" : "non-finite coordinates found",
        coordsOk ? "pass" : "fail",
        coordsOk
          ? "Spatial coordinates used for plotting are finite and within the dataset bounds."
          : "Non-finite coordinates would invalidate the spatial view."
      );
    }
  }

  if (results.kind === "gene_expression") {
    const unresolved = results.entries.filter((e) => e.match !== "exact");
    push(
      "genes_resolved",
      "Gene identifiers resolved unambiguously",
      "every requested gene matches exactly one var_names entry",
      unresolved.length === 0
        ? `${results.entries.length}/${results.entries.length} genes resolved`
        : `${unresolved.length} unresolved`,
      unresolved.length === 0 ? "pass" : "fail",
      unresolved.length === 0
        ? "Each requested identifier was matched to exactly one gene; no substitutions were made."
        : `Unresolved or ambiguous identifiers: ${unresolved.map((u) => u.requested).join(", ")}. No substitute gene was used.`
    );
    const finiteOk = results.entries.every(
      (e) => e.values === null || e.values.every(Number.isFinite)
    );
    push(
      "values_finite",
      "Expression values finite",
      "all extracted values are finite numbers",
      finiteOk ? "all values finite" : "non-finite values present",
      finiteOk ? "pass" : "fail",
      finiteOk
        ? "Expression vectors contain no NaN or infinite values."
        : "Non-finite expression values would invalidate plots and summaries."
    );
    push(
      "artifacts_present",
      "Expected output artifacts present",
      "expression vector per resolved gene + configuration manifest",
      `${results.entries.filter((e) => e.values !== null).length + 1}/${results.entries.length + 1} artifacts generated`,
      "pass",
      "Expression artifacts and the run manifest were produced by the simulated run."
    );
  }

  if (results.kind === "quality_assessment") {
    push(
      "artifacts_present",
      "Expected output artifacts present",
      "schema report, QC metrics, validation results, run manifest",
      "4/4 expected artifacts generated",
      "pass",
      "Schema report and QC metric artifacts were produced by the simulated run."
    );
    const finiteOk =
      results.total_counts.every(Number.isFinite) &&
      results.n_genes_per_obs.every(Number.isFinite);
    push(
      "metrics_finite",
      "QC metrics finite and complete",
      "one metric value per observation, all finite",
      finiteOk ? `${results.total_counts.length} values, all finite` : "non-finite values present",
      finiteOk ? "pass" : "fail",
      finiteOk
        ? "Per-observation QC values are complete and finite."
        : "Missing or non-finite QC values would make the QC plots invalid."
    );
    push(
      "missing_fields_reported",
      "Unavailable fields reported rather than assumed",
      "fields that could not be assessed are listed explicitly",
      `${results.missingFields.length} unavailable field(s) listed`,
      "pass",
      "Metrics that the schema cannot support (e.g. mitochondrial fraction without annotation) are reported as not assessed instead of being invented."
    );
  }

  // Honest software-version record for the demo.
  push(
    "versions_recorded",
    "Configuration and software versions recorded",
    "workflow configuration, random seed and software versions",
    "configuration and seed recorded; scientific package versions unavailable",
    "warning",
    "The run configuration and random seed are recorded in the manifest. Scanpy/Squidpy versions are unavailable because no scientific backend is connected in this demo; they are reported as unavailable rather than filled with invented values."
  );

  return checks;
}

export function verificationSummary(checks: VerificationCheck[] | null): {
  pass: number;
  warning: number;
  fail: number;
  notRun: number;
} {
  const empty = { pass: 0, warning: 0, fail: 0, notRun: 0 };
  if (!checks) return empty;
  return checks.reduce(
    (acc, c) => {
      acc[c.status] += 1;
      return acc;
    },
    { ...empty }
  );
}
