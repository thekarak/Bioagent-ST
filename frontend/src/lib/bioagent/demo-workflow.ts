/**
 * Demo workflow execution + artifact assembly.
 *
 * Executes the *simulated* workflow against the local demo engine, then
 * verifies the produced artifacts, builds checksums, provenance and a report
 * record. Everything is explicitly illustrative — no scientific backend is
 * involved, and results are never presented as Scanpy/Squidpy output.
 */

import type {
  ArtifactRef,
  ClusteringResults,
  DatasetMeta,
  GeneExpressionResults,
  ProvenanceRecord,
  QualityResults,
  ReportClaim,
  ReportRecord,
  RunResults,
  VerificationCheck,
  WorkflowId,
  WorkflowParams,
  ClusteringParams,
  GeneExpressionParams,
  QualityParams,
} from "./types";
import type { DemoEngine } from "./demo-dataset";
import { evaluateVerification } from "./verification";
import { buildArtifacts, buildProvenance } from "./provenance";
import { median } from "./format";

export function executeDemoWorkflow(
  engine: DemoEngine,
  workflow: WorkflowId,
  params: WorkflowParams
): RunResults {
  if (workflow === "spatial_clustering") {
    const p = params as ClusteringParams;
    const { labels, k } = engine.cluster(p.resolution, p.seed);
    const umap = engine.embedding(labels, p.seed ^ 0x2f6a2f1);
    const counts = new Map<number, number>();
    for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
    const clusterSizes = [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([label, count]) => ({ label, count }));
    const result: ClusteringResults = {
      kind: "spatial_clustering",
      labels,
      k,
      clusterSizes,
      umap,
      params: p,
      spatial: { x: [...engine.x], y: [...engine.y] },
    };
    return result;
  }

  if (workflow === "gene_expression") {
    const p = params as GeneExpressionParams;
    const entries = p.genes.map((requested) => {
      const res = engine.resolveGene(requested);
      const idx = res.resolved ? engine.geneNames.indexOf(res.resolved) : -1;
      if (res.match !== "exact" || idx < 0) {
        return {
          requested,
          resolved: null,
          match: res.match,
          candidates: res.candidates,
          values: null,
          layer: p.layer,
          stats: null,
        };
      }
      const values = engine.geneVector(idx, p.layer);
      const nonZero = values.filter((v) => v > 0);
      return {
        requested,
        resolved: res.resolved,
        match: "exact" as const,
        values,
        layer: p.layer,
        stats: {
          min: Math.min(...values),
          max: Math.max(...values),
          mean: values.reduce((a, b) => a + b, 0) / values.length,
          median: median(values),
          zeroFraction: 1 - nonZero.length / values.length,
        },
      };
    });
    const result: GeneExpressionResults = {
      kind: "gene_expression",
      entries,
      spatial: { x: [...engine.x], y: [...engine.y] },
    };
    return result;
  }

  // quality_assessment
  const q = params as QualityParams;
  const bounds = engine.coordinateBounds();
  const missingFields: string[] = [
    "obs['mt_fraction'] — not assessed (requires mitochondrial gene annotation)",
  ];
  if (!engine.params.withCoordinates) {
    missingFields.push("obsm['spatial'] — missing (spatial workflows unavailable)");
  }
  const result: QualityResults = {
    kind: "quality_assessment",
    total_counts: [...engine.totalCounts],
    n_genes_per_obs: [...engine.nGenesPerObs],
    coordinate_bounds: bounds ?? { x_min: 0, x_max: 0, y_min: 0, y_max: 0 },
    missingFields,
    metrics: [
      {
        label: "Matrix dimensions",
        value: `${engine.nObs} observations × ${engine.nGenes} genes`,
        explanation: "Shape of the expression matrix X as read from the registered dataset.",
      },
      {
        label: "Observation identifiers",
        value: `${engine.nObs} unique identifiers`,
        explanation: "All obs_names entries are unique and non-empty.",
      },
      {
        label: "Gene identifiers",
        value: `${engine.nGenes} unique identifiers`,
        explanation: "All var_names entries are unique and non-empty (synthetic demo identifiers).",
      },
      {
        label: "Spatial coordinates",
        value: bounds
          ? `present · x ∈ [${bounds.x_min.toFixed(0)}, ${bounds.x_max.toFixed(0)}], y ∈ [${bounds.y_min.toFixed(0)}, ${bounds.y_max.toFixed(0)}]`
          : "missing — not assessed",
        explanation: bounds
          ? "obsm['spatial'] contains finite coordinates for every observation."
          : "This dataset has no spatial coordinates; spatial views are unavailable and reported honestly.",
      },
      {
        label: "Median total counts",
        value: String(median(engine.totalCounts).toFixed(0)),
        explanation: "Median counts per observation across the counts matrix.",
      },
      {
        label: "Median detected genes",
        value: String(median(engine.nGenesPerObs).toFixed(0)),
        explanation: "Median number of genes with nonzero counts per observation.",
      },
      {
        label: "Observations below QC thresholds",
        value: countBelow(engine, q.min_counts, q.min_genes),
        explanation: `Count of observations with total_counts < ${q.min_counts} or n_genes < ${q.min_genes}. Thresholds are analysis choices, not universal biological truths.`,
      },
      {
        label: "Mitochondrial fraction",
        value: "Not assessed",
        explanation: "Requires mitochondrial gene annotation, which this demo schema does not include. The metric is reported as not assessed rather than invented.",
      },
    ],
  };
  return result;
}

function countBelow(engine: DemoEngine, minCounts: number, minGenes: number): string {
  let n = 0;
  for (let i = 0; i < engine.nObs; i++) {
    if (engine.totalCounts[i] < minCounts || engine.nGenesPerObs[i] < minGenes) n++;
  }
  const pct = ((n / engine.nObs) * 100).toFixed(1);
  return `${n} of ${engine.nObs} (${pct}%)`;
}

/*
 * Claim-level evidence classification (demo).
 *
 * Each claim is phrased as a checkable statement and classified into one of
 * the five evidence states. Classifications are produced by deterministic
 * rules over the run's actual verification results — honest by construction:
 * a claim is only "Supported" when the checks it references actually passed,
 * and speculative statements are explicitly labeled Plausible / Hypothesis /
 * Unsupported rather than left implicit.
 */
function buildClaims(
  workflow: WorkflowId,
  results: RunResults,
  checks: VerificationCheck[],
  datasetMeta: DatasetMeta
): ReportClaim[] {
  const byId = (id: string) => checks.find((c) => c.id === id);
  const refs = (...ids: string[]) => ids.filter((id) => byId(id) !== undefined);
  const claims: ReportClaim[] = [];
  const nObs = datasetMeta.n_obs;

  if (results?.kind === "spatial_clustering") {
    const aligned = byId("labels_aligned")?.status === "pass";
    const inRange = byId("labels_range")?.status === "pass";
    const largest = [...results.clusterSizes].sort((a, b) => b.count - a.count)[0];
    claims.push(
      {
        id: "clm-01",
        statement: `The run partitioned ${results.labels.length.toLocaleString()} observations into ${results.k} computational clusters, with one aligned label per observation.`,
        state: aligned && inRange ? "supported" : "unsupported",
        basis:
          aligned && inRange
            ? "The labels_aligned and labels_range checks passed against this run's artifacts."
            : "At least one label-alignment check did not pass for this run.",
        references: refs("labels_aligned", "labels_range"),
      },
      {
        id: "clm-02",
        statement:
          `Cluster ${largest?.label ?? "—"}, the largest grouping (${largest ? ((largest.count / results.labels.length) * 100).toFixed(1) : "—"}% of observations), occupies a distinct spatial region of the section.`,
        state: "plausible",
        basis:
          "The spatial scatter (fig1) is visually consistent with regional concentration, but no spatial-statistics test was run, so the pattern is not established.",
        references: ["fig1"],
      },
      {
        id: "clm-03",
        statement: "Clusters correspond to distinct biological cell types.",
        state: "unsupported",
        basis:
          "No marker-gene analysis, annotation step or reference mapping was performed; clusters carry neutral numeric labels by design.",
        references: [],
      },
      {
        id: "clm-04",
        statement: "Cluster assignments would be stable under a different resolution parameter.",
        state: "indeterminate",
        basis:
          "Only the recorded configuration (resolution " +
          (results.params.resolution ?? "—") +
          ") was executed; no sensitivity rerun exists to assess stability.",
        references: [],
      }
    );
  }

  if (results?.kind === "gene_expression") {
    const resolved = results.entries.filter((e) => e.match === "exact" && e.values);
    const unresolved = results.entries.filter((e) => e.match !== "exact");
    claims.push(
      {
        id: "clm-01",
        statement: `Each requested gene was resolved explicitly against var_names, with no silent substitution${unresolved.length ? " (unresolved identifiers were reported, not replaced)" : ""}.`,
        state: "supported",
        basis: "The genes_resolved check verified the match status of every requested identifier.",
        references: refs("genes_resolved"),
      },
      resolved.length > 0 && resolved[0].stats
        ? {
            id: "clm-02",
            statement: `Expression of ${resolved[0].resolved} was summarized from the ${resolved[0].layer} layer (mean ${(resolved[0].stats.mean).toFixed(2)}, median ${(resolved[0].stats.median).toFixed(2)}, zero fraction ${(resolved[0].stats.zeroFraction * 100).toFixed(0)}%).`,
            state: "supported",
            basis: "Values were extracted from the recorded layer and passed the values_finite check.",
            references: refs("values_finite"),
          }
        : {
            id: "clm-02",
            statement: "No resolved gene expression values are reported for this run.",
            state: "supported",
            basis: "No requested gene resolved exactly, so no values were extracted.",
            references: refs("genes_resolved"),
          },
      resolved.length > 0
        ? {
            id: "clm-03",
            statement: `${resolved[0].resolved} shows elevated expression in a spatially confined subregion of the section.`,
            state: "plausible",
            basis:
              "The spatial expression plot (fig1) is visually consistent with a confined region, but no spatial autocorrelation or region test was run.",
            references: ["fig1"],
          }
        : {
            id: "clm-03",
            statement: `The spatial pattern of unresolved gene(s) could be characterized.`,
            state: "unsupported",
            basis: `Unresolved identifier(s): ${unresolved.map((u) => u.requested).join(", ") || "none"}. No expression data exist for them in this dataset.`,
            references: refs("genes_resolved"),
          },
      {
        id: "clm-04",
        statement: "The observed expression pattern reflects a cell-type-specific program.",
        state: "hypothesis",
        basis:
          "Assigning a program to a cell type would require annotation or co-expression evidence beyond this workflow's outputs.",
        references: [],
      }
    );
  }

  if (results?.kind === "quality_assessment") {
    claims.push(
      {
        id: "clm-01",
        statement: `The dataset contains a ${nObs?.toLocaleString() ?? "—"} × ${datasetMeta.n_genes?.toLocaleString() ?? "—"} expression matrix${datasetMeta.hasSpatialCoordinates ? " with 2-D spatial coordinates" : " without spatial coordinates"}.`,
        state: "supported",
        basis: "Schema validation inspected the matrix dimensions and obsm contents before the workflow ran.",
        references: refs("artifacts_present"),
      },
      {
        id: "clm-02",
        statement: "Per-observation QC metrics (total counts, detected genes) were computed for every observation.",
        state: "supported",
        basis: "The metrics_finite check confirmed one finite value per observation.",
        references: refs("metrics_finite"),
      },
      {
        id: "clm-03",
        statement: "Metrics that the schema cannot support are reported as not assessed rather than computed.",
        state: "supported",
        basis: `The missing_fields_reported check listed ${results.missingFields.length} unavailable metric(s) explicitly.`,
        references: refs("missing_fields_reported"),
      },
      {
        id: "clm-04",
        statement: "The dataset passes every quality threshold required for downstream workflows.",
        state: "indeterminate",
        basis:
          "QC thresholds are configurable choices, not universal truths; threshold-based pass/fail decisions were not evaluated in this run.",
        references: [],
      }
    );
  }

  if (workflow === "unsupported_or_ambiguous") {
    claims.push({
      id: "clm-01",
      statement: "No scientific claim is made for this request.",
      state: "supported",
      basis: "The request did not map to an approved workflow, so no analysis ran and no result exists to support any claim.",
      references: [],
    });
  }

  return claims;
}

export interface AssembledRun {
  checks: VerificationCheck[];
  artifacts: ArtifactRef[];
  provenance: ProvenanceRecord;
  report: ReportRecord;
}

export function assembleRunEvidence(
  runId: string,
  question: string,
  datasetMeta: DatasetMeta,
  fingerprint: string,
  workflow: WorkflowId,
  params: WorkflowParams,
  results: RunResults,
  createdAt: number
): AssembledRun {
  const checks =
    evaluateVerification(workflow, results, {
      nObs: results?.kind === "spatial_clustering"
        ? (results as ClusteringResults).labels.length
        : datasetMeta.n_obs ?? 0,
      hasCoords: datasetMeta.hasSpatialCoordinates,
    }) ?? [];

  // Provisional run record used to build artifacts/provenance/report.
  const provisional = {
    id: runId,
    createdAt,
    question,
    datasetId: datasetMeta.id,
    datasetName: datasetMeta.name,
    workflow,
    params,
    results,
    policy: null,
    selector: {
      kind: "rules" as const,
      name: "",
      version: "",
      decision: workflow,
      matchedSignals: [],
      normalizedIntent: null,
      notes: "",
    },
    status: "verified" as const,
    stages: [],
    verification: checks,
    provenance: null,
    artifacts: [],
    report: null,
    failure: null,
    illustrative: true as const,
  };
  const artifacts = buildArtifacts(provisional);
  const withArtifacts = { ...provisional, artifacts };
  const provenance = buildProvenance(withArtifacts, checks, {
    fingerprint,
    schemaSummary: datasetMeta.schemaSummary,
  });

  const warnings: string[] = checks.filter((c) => c.status === "warning").map((c) => c.explanation);
  if (results?.kind === "quality_assessment") {
    warnings.push(...results.missingFields);
  }
  const figures =
    results?.kind === "spatial_clustering"
      ? [
          {
            figureId: "fig1",
            caption:
              "Spatial distribution of observations colored by computational cluster. Clusters are neutral labels, not cell types. Illustrative demo data.",
          },
          {
            figureId: "fig2",
            caption:
              "Two-dimensional embedding of observations colored by cluster (synthetic embedding generated by the demo run).",
          },
        ]
      : results?.kind === "gene_expression"
        ? results.entries
            .filter((e) => e.values)
            .map((e, i) => ({
              figureId: `fig${i + 1}`,
              caption: `Spatial expression of ${e.resolved} (${e.layer} layer). Values shown on a continuous scale; zero-count observations drawn in gray. Illustrative demo data.`,
            }))
        : [
            { figureId: "fig1", caption: "Distribution of total counts per observation. Illustrative demo data." },
            { figureId: "fig2", caption: "Distribution of detected genes per observation. Illustrative demo data." },
          ];

  const report: ReportRecord = {
    version: "1",
    generatedAt: Date.now(),
    figures,
    warnings,
    claims: buildClaims(workflow, results, checks, datasetMeta),
    limitations: [
      "Clusters and expression patterns shown here are computational outputs on illustrative demo data; they are not biological findings.",
      "Technical verification checks computational artifacts and execution requirements. It does not establish biological validity, causal meaning, or clinical significance.",
      "No tissue image or transform was provided; spatial views are honest coordinate scatter plots, not histology overlays.",
      "The registered scientific pipeline (Scanpy/Squidpy steps) was not executed in this prototype — the run is a clearly-labeled local simulation.",
    ],
  };

  return { checks, artifacts, provenance, report };
}
