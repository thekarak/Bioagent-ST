/**
 * Seeded illustrative runs for the demo workspace.
 *
 * Every record is marked illustrative: true and carries an explicit demo
 * origin. The set deliberately includes verified, failed (policy block,
 * interrupted) and needs-review runs so failure states are represented
 * honestly rather than hidden.
 */

import { getDemoEngine, DEMO_DATASET_CATALOG } from "./demo-dataset";
import { executeDemoWorkflow, assembleRunEvidence } from "./demo-workflow";
import type {
  FailureInfo,
  RunRecord,
  SelectorDecision,
  StageId,
  StageRecord,
  RunStatus,
  WorkflowId,
  WorkflowParams,
  PolicyRecord,
} from "./types";

const STAGE_ORDER: StageId[] = [
  "request_received",
  "dataset_validated",
  "workflow_selected",
  "policy_decision",
  "scientific_execution",
  "technical_verification",
  "evidence_recorded",
  "report_generated",
];

const STAGE_LABELS: Record<StageId, string> = {
  request_received: "Request received",
  dataset_validated: "Dataset validated",
  workflow_selected: "Workflow selected",
  policy_decision: "Policy decision",
  scientific_execution: "Scientific execution",
  technical_verification: "Technical verification",
  evidence_recorded: "Evidence recorded",
  report_generated: "Report generated",
};

export const STAGE_LABEL = STAGE_LABELS;

const HOUR = 3600_000;

function stagesFor(
  outcome: "verified" | "blocked" | "needs_review" | "interrupted",
  startAt: number
): StageRecord[] {
  const spacing = 900;
  return STAGE_ORDER.map((stage, i) => {
    const ts = startAt + i * spacing;
    if (outcome === "verified") {
      return { stage, state: "done", timestamp: ts, detail: detailFor(stage, "done") };
    }
    if (outcome === "blocked") {
      if (i < 3) return { stage, state: "done", timestamp: ts, detail: detailFor(stage, "done") };
      if (i === 3)
        return { stage, state: "failed", timestamp: ts, detail: detailFor(stage, "failed") };
      return { stage, state: "skipped", timestamp: null, detail: "Not reached — earlier stage failed." };
    }
    if (outcome === "needs_review") {
      if (i < 3) return { stage, state: "done", timestamp: ts, detail: detailFor(stage, "done") };
      if (i === 3)
        return { stage, state: "done", timestamp: ts, detail: "Policy: REVIEW — clarification requested." };
      return { stage, state: "pending", timestamp: null, detail: "Awaiting clarification; not executed." };
    }
    // interrupted
    if (i < 4) return { stage, state: "done", timestamp: ts, detail: detailFor(stage, "done") };
    if (i === 4)
      return {
        stage,
        state: "failed",
        timestamp: ts,
        detail: "Simulated execution was interrupted before completion (demo failure state).",
      };
    return { stage, state: "skipped", timestamp: null, detail: "Not reached — execution did not complete." };
  });
}

function detailFor(stage: StageId, state: "done" | "failed"): string {
  switch (stage) {
    case "request_received":
      return "Research question received and normalized.";
    case "dataset_validated":
      return "Dataset schema validated: identifiers unique, matrix readable.";
    case "workflow_selected":
      return "Selector routed the request to an approved workflow.";
    case "policy_decision":
      return state === "done" ? "Policy: ALLOW — all required prerequisites passed." : "Policy: BLOCK — required input missing.";
    case "scientific_execution":
      return "Simulated execution of the registered workflow (Demo Mode). No scientific backend was invoked.";
    case "technical_verification":
      return "Checks evaluated against the demo artifacts produced by this run.";
    case "evidence_recorded":
      return "Provenance manifest recorded with artifact checksums.";
    case "report_generated":
      return "Report v1 generated with figures, caveats and reproducibility information.";
    default:
      return "";
  }
}

export function seedRunStatus(outcome: "verified" | "blocked" | "needs_review" | "interrupted"): RunStatus {
  switch (outcome) {
    case "verified":
      return "verified";
    case "blocked":
      return "failed";
    case "needs_review":
      return "needs_review";
    case "interrupted":
      return "failed";
  }
}

interface SeedConfig {
  id: string;
  hoursAgo: number;
  question: string;
  datasetId: string;
  workflow: WorkflowId;
  params: WorkflowParams;
  selector: SelectorDecision;
  policy: PolicyRecord;
  outcome: "verified" | "blocked" | "needs_review" | "interrupted";
  failure?: FailureInfo;
}

function buildSeedRun(cfg: SeedConfig): RunRecord {
  const createdAt = Date.now() - cfg.hoursAgo * HOUR;
  const engine = getDemoEngine(cfg.datasetId);
  const meta = DEMO_DATASET_CATALOG.find((d) => d.id === cfg.datasetId)!;
  const base = {
    id: cfg.id,
    createdAt,
    question: cfg.question,
    datasetId: cfg.datasetId,
    datasetName: meta.name,
    selector: cfg.selector,
    policy: cfg.policy,
    workflow: cfg.workflow,
    params: cfg.params,
    status: seedRunStatus(cfg.outcome),
    stages: stagesFor(cfg.outcome, createdAt + 500),
    failure: cfg.failure ?? null,
    illustrative: true as const,
  };

  if (cfg.outcome === "verified") {
    const results = executeDemoWorkflow(engine, cfg.workflow, cfg.params);
    const assembled = assembleRunEvidence(
      cfg.id,
      cfg.question,
      meta,
      engine.fingerprint(),
      cfg.workflow,
      cfg.params,
      results,
      createdAt
    );
    return {
      ...base,
      results,
      verification: assembled.checks,
      artifacts: assembled.artifacts,
      provenance: assembled.provenance,
      report: assembled.report,
    };
  }
  if (cfg.outcome === "interrupted") {
    return { ...base, results: null, verification: null, artifacts: [], provenance: null, report: null };
  }
  // blocked / needs_review: no execution, no artifacts
  return {
    ...base,
    results: null,
    verification: cfg.outcome === "blocked" ? [] : null,
    artifacts: [],
    provenance: null,
    report: null,
  };
}

export function buildSeedRuns(): RunRecord[] {
  const rulesSelector = (decision: WorkflowId, signals: string[], version = "rules-demo-1"): SelectorDecision => ({
    kind: "rules",
    name: "Deterministic rules (demo)",
    version,
    decision,
    matchedSignals: signals,
    normalizedIntent: null,
    notes: "Transparent keyword rules evaluated locally (illustrative run history).",
  });

  return [
    buildSeedRun({
      id: "RUN-2026-0142",
      hoursAgo: 2,
      question: "Show spatial clusters based on expression patterns in this dataset.",
      datasetId: "ds_demo_tissue_01",
      workflow: "spatial_clustering",
      params: { normalization: "lognorm", n_pcs: 20, n_neighbors: 15, resolution: 0.8, seed: 0 },
      selector: rulesSelector("spatial_clustering", ["cluster", "expression patterns"]),
      policy: { decision: "ALLOW", reason: "All required prerequisites passed", detail: "" },
      outcome: "verified",
    }),
    buildSeedRun({
      id: "RUN-2026-0139",
      hoursAgo: 5,
      question: "Show spatial expression of Gene0134 and Gene0279.",
      datasetId: "ds_demo_tissue_01",
      workflow: "gene_expression",
      params: { genes: ["Gene0134", "Gene0279"], layer: "counts" },
      selector: rulesSelector("gene_expression", ["gene", "expression of"]),
      policy: { decision: "ALLOW", reason: "All required prerequisites passed", detail: "" },
      outcome: "verified",
    }),
    buildSeedRun({
      id: "RUN-2026-0131",
      hoursAgo: 26,
      question: "Assess the quality and schema of this dataset before further analysis.",
      datasetId: "ds_demo_tissue_01",
      workflow: "quality_assessment",
      params: { min_counts: 500, min_genes: 200 },
      selector: rulesSelector("quality_assessment", ["quality", "schema", "assess"]),
      policy: { decision: "ALLOW", reason: "All required prerequisites passed", detail: "" },
      outcome: "verified",
    }),
    buildSeedRun({
      id: "RUN-2026-0127",
      hoursAgo: 30,
      question: "Show spatial expression of Gene9999 in the tissue section.",
      datasetId: "ds_demo_tissue_01",
      workflow: "gene_expression",
      params: { genes: ["Gene9999"], layer: "counts" },
      selector: rulesSelector("gene_expression", ["gene", "expression of"]),
      policy: {
        decision: "BLOCK",
        reason: "Required input missing: Required genes resolved",
        detail:
          "Gene9999 is not present in var_names. BioAgent-ST does not silently substitute a different gene.",
      },
      outcome: "blocked",
      failure: {
        code: "GENE_NOT_RESOLVED",
        title: "Requested gene could not be resolved",
        message:
          "The identifier 'Gene9999' does not match any entry in the dataset's var_names. No similar gene was selected on your behalf.",
        suggestion:
          "Check the identifier spelling, or search the gene table in Datasets to find the exact identifier, then update the request.",
        stage: "policy_decision",
      },
    }),
    buildSeedRun({
      id: "RUN-2026-0124",
      hoursAgo: 49,
      question: "Show spatial clusters based on expression patterns in this dataset.",
      datasetId: "ds_demo_nospatial_02",
      workflow: "spatial_clustering",
      params: { normalization: "lognorm", n_pcs: 20, n_neighbors: 15, resolution: 0.8, seed: 0 },
      selector: rulesSelector("spatial_clustering", ["cluster", "expression patterns"]),
      policy: {
        decision: "BLOCK",
        reason: "Required input missing: Spatial coordinates present",
        detail:
          "This dataset has no obsm['spatial']. Spatial clustering cannot run, and the request was not rerouted to another workflow.",
      },
      outcome: "blocked",
      failure: {
        code: "SPATIAL_COORDS_MISSING",
        title: "Spatial coordinates are missing",
        message:
          "The selected workflow requires spatial coordinates, which this dataset does not provide. The workflow selection was preserved, not silently changed.",
        suggestion:
          "Load a dataset with obsm['spatial'], or run quality assessment to inspect what this dataset supports.",
        stage: "policy_decision",
      },
    }),
    buildSeedRun({
      id: "RUN-2026-0118",
      hoursAgo: 73,
      question: "Cluster the expression data and show the spatial organization.",
      datasetId: "ds_demo_tissue_01",
      workflow: "spatial_clustering",
      params: { normalization: "lognorm", n_pcs: 30, n_neighbors: 20, resolution: 1.0, seed: 7 },
      selector: rulesSelector("spatial_clustering", ["cluster", "spatial organization"]),
      policy: { decision: "ALLOW", reason: "All required prerequisites passed", detail: "" },
      outcome: "interrupted",
      failure: {
        code: "EXECUTION_INTERRUPTED",
        title: "Execution was interrupted",
        message:
          "The simulated scientific execution stopped before producing artifacts. No verification or report was generated for this run.",
        suggestion: "Re-run the analysis. Interrupted runs are kept in the history instead of being hidden.",
        stage: "scientific_execution",
      },
    }),
    buildSeedRun({
      id: "RUN-2026-0111",
      hoursAgo: 96,
      question: "Which genes are responsible for disease progression in this tissue?",
      datasetId: "ds_demo_tissue_01",
      workflow: "unsupported_or_ambiguous",
      params: {},
      selector: rulesSelector("unsupported_or_ambiguous", []),
      policy: {
        decision: "REVIEW",
        reason: "Request is unsupported or ambiguous",
        detail:
          "The request asks for a causal biological claim, which is outside the approved v1 workflows. BioAgent-ST abstains rather than guessing a workflow.",
      },
      outcome: "needs_review",
    }),
  ];
}

export interface ActivityEvent {
  id: string;
  time: number;
  label: string;
  detail: string;
  runId: string;
}

export function activityFromRuns(runs: RunRecord[]): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const run of runs) {
    for (const stage of run.stages) {
      if (stage.state !== "done" && stage.state !== "failed") continue;
      events.push({
        id: `${run.id}-${stage.stage}`,
        time: stage.timestamp ?? run.createdAt,
        label: STAGE_LABELS[stage.stage],
        detail: stage.detail,
        runId: run.id,
      });
    }
  }
  return events.sort((a, b) => b.time - a.time).slice(0, 10);
}
