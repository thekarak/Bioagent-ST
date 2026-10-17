/**
 * Provenance manifest construction (demo).
 *
 * Checksums are computed with FNV-1a over the serialized demo artifacts that
 * actually exist in this browser session. Fields that were not recorded are
 * shown as "Not recorded" or "Unavailable" — never silently filled.
 */

import { fnv1a } from "./rng";
import type {
  ArtifactRef,
  GeneExpressionResults,
  ClusteringResults,
  QualityResults,
  ProvenanceField,
  ProvenanceRecord,
  RunRecord,
  VerificationCheck,
} from "./types";
import { formatTimestamp } from "./format";
import { workflowSpec } from "./workflows";

export function buildArtifacts(run: RunRecord): ArtifactRef[] {
  const artifacts: ArtifactRef[] = [];
  const note = "FNV-1a over the serialized demo artifact (local, illustrative)";
  if (run.results?.kind === "spatial_clustering") {
    const r = run.results as ClusteringResults;
    const labelsCsv =
      "obs_id,cluster\n" +
      r.labels.map((l, i) => `${runIdObs(i)},${l}`).join("\n") +
      "\n";
    const umapCsv =
      "obs_id,umap_1,umap_2\n" +
      r.umap.x.map((x, i) => `${runIdObs(i)},${x.toFixed(4)},${r.umap.y[i].toFixed(4)}`).join("\n") +
      "\n";
    const tableCsv =
      "cluster,count,fraction\n" +
      r.clusterSizes.map((c) => `${c.label},${c.count},${(c.count / r.labels.length).toFixed(4)}`).join("\n") +
      "\n";
    artifacts.push(
      {
        id: "cluster_labels.csv",
        kind: "Cluster labels",
        format: "CSV",
        bytesLabel: bytes(labelsCsv),
        checksum: `fnv1a:${fnv1a(labelsCsv)}`,
        checksumNote: note,
      },
      {
        id: "umap_embedding.csv",
        kind: "UMAP embedding",
        format: "CSV",
        bytesLabel: bytes(umapCsv),
        checksum: `fnv1a:${fnv1a(umapCsv)}`,
        checksumNote: note,
      },
      {
        id: "cluster_table.csv",
        kind: "Cluster size table",
        format: "CSV",
        bytesLabel: bytes(tableCsv),
        checksum: `fnv1a:${fnv1a(tableCsv)}`,
        checksumNote: note,
      }
    );
  }
  if (run.results?.kind === "gene_expression") {
    const r = run.results as GeneExpressionResults;
    for (const e of r.entries) {
      if (!e.values) continue;
      const csv =
        "obs_id,expression\n" +
        e.values.map((v, i) => `${runIdObs(i)},${v.toFixed(4)}`).join("\n") +
        "\n";
      artifacts.push({
        id: `expression_${e.resolved ?? e.requested}.csv`,
        kind: `Expression vector — ${e.resolved ?? e.requested}`,
        format: "CSV",
        bytesLabel: bytes(csv),
        checksum: `fnv1a:${fnv1a(csv)}`,
        checksumNote: note,
      });
    }
  }
  if (run.results?.kind === "quality_assessment") {
    const r = run.results as QualityResults;
    const metricsCsv =
      "obs_id,total_counts,n_genes\n" +
      r.total_counts.map((t, i) => `${runIdObs(i)},${t},${r.n_genes_per_obs[i]}`).join("\n") +
      "\n";
    const schemaJson = JSON.stringify(
      { run: run.id, n_obs: r.total_counts.length, missing_fields: r.missingFields },
      null,
      2
    );
    artifacts.push(
      {
        id: "qc_metrics.csv",
        kind: "Per-observation QC metrics",
        format: "CSV",
        bytesLabel: bytes(metricsCsv),
        checksum: `fnv1a:${fnv1a(metricsCsv)}`,
        checksumNote: note,
      },
      {
        id: "schema_report.json",
        kind: "Machine-readable schema report",
        format: "JSON",
        bytesLabel: bytes(schemaJson),
        checksum: `fnv1a:${fnv1a(schemaJson)}`,
        checksumNote: note,
      }
    );
  }
  const manifest = JSON.stringify({ run: run.id, workflow: run.workflow, params: run.params }, null, 2);
  artifacts.push({
    id: "run_manifest.json",
    kind: "Run configuration manifest",
    format: "JSON",
    bytesLabel: bytes(manifest),
    checksum: `fnv1a:${fnv1a(manifest)}`,
    checksumNote: note,
  });
  return artifacts;
}

function runIdObs(i: number): string {
  return `spot_${String(i + 1).padStart(5, "0")}`;
}

function bytes(s: string): string {
  return `${s.length} B`;
}

export function buildProvenance(
  run: RunRecord,
  checks: VerificationCheck[] | null,
  datasetInfo: { fingerprint: string | null; schemaSummary: string | null }
): ProvenanceRecord {
  const spec = workflowSpec(run.workflow);
  const fields: ProvenanceField[] = [];
  const f = (field: string, value: string, availability: ProvenanceField["availability"], mono = false) =>
    fields.push({ field, value, availability, mono });

  f("Run ID", run.id, "recorded", true);
  f("Created", formatTimestamp(run.createdAt), "recorded");
  f("Original research question", run.question, "recorded");
  f(
    "Normalized request intent",
    run.selector.normalizedIntent ?? "Not recorded",
    run.selector.normalizedIntent ? "recorded" : "not_recorded"
  );
  f("Dataset reference", `${run.datasetId} (${run.datasetName})`, "recorded", true);
  f(
    "Dataset fingerprint",
    datasetInfo.fingerprint ?? "Unavailable (dataset not loaded in this session)",
    datasetInfo.fingerprint ? "recorded" : "unavailable",
    true
  );
  f(
    "Dataset schema summary",
    datasetInfo.schemaSummary ?? "Not recorded",
    datasetInfo.schemaSummary ? "recorded" : "not_recorded"
  );
  f("Selector", `${run.selector.name} v${run.selector.version}`, "recorded");
  f("Selector decision", run.selector.decision, "recorded", true);
  f(
    "Policy outcome",
    run.policy ? `${run.policy.decision} — ${run.policy.reason}` : "Not recorded",
    run.policy ? "recorded" : "not_recorded"
  );
  f(
    "Workflow",
    spec ? `${spec.title} (registered v1)` : "Unsupported / ambiguous — no workflow executed",
    spec ? "recorded" : "not_recorded"
  );
  f("Configuration and random seed", JSON.stringify(run.params), "recorded", true);
  f(
    "Package versions",
    "Frontend demo adapter 0.1.0; Scanpy/Squidpy versions unavailable — scientific backend not connected",
    "unavailable"
  );
  f(
    "Expected artifacts",
    spec ? spec.representativeOutput : "None — execution did not proceed",
    spec ? "recorded" : "not_recorded"
  );
  f("Artifact checksums", `${run.artifacts.length} artifact(s) with FNV-1a checksums`, "recorded");
  f(
    "Verification results",
    checks
      ? `${checks.filter((c) => c.status === "pass").length} pass, ${checks.filter((c) => c.status === "warning").length} warning, ${checks.filter((c) => c.status === "fail").length} fail`
      : "Not run — execution did not reach verification",
    checks ? "recorded" : "not_recorded"
  );
  f(
    "Warnings and failure details",
    run.failure
      ? `${run.failure.title}: ${run.failure.message}`
      : checks?.some((c) => c.status === "warning")
        ? checks.filter((c) => c.status === "warning").map((c) => c.check).join("; ")
        : "None recorded",
    run.failure || checks?.some((c) => c.status === "warning") ? "recorded" : "not_recorded"
  );
  f(
    "Report version",
    run.report ? `report v${run.report.version}` : "Not generated",
    run.report ? "recorded" : "not_recorded"
  );
  f(
    "Explicit limitations",
    "Technical verification checks computational artifacts only; it does not establish biological validity, causality, or clinical significance.",
    "recorded"
  );

  return { runId: run.id, createdAt: run.createdAt, fields, artifactCount: run.artifacts.length };
}
