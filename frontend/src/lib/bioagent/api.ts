/**
 * BioAgent-ST Scientific Backend API Client.
 *
 * Connects the web frontend to the FastAPI server (apps/api/main.py)
 * providing real deterministic execution, SQLite provenance/evidence ledger,
 * and verified claim reporting.
 */

import type {
  EvidenceContract,
  RunRecord,
  SelectorDecision,
  SelectorKind,
  StageId,
  StageRecord,
  WorkflowId,
  WorkflowParams,
  ArtifactRef,
  VerificationCheck,
  ProvenanceRecord,
  ReportRecord,
  ReportClaim,
} from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export interface BackendDatasetItem {
  id: string;
  name: string;
  available: boolean;
  has_spatial_coordinates: boolean;
  illustrative: boolean;
}

export interface BackendDatasetsResponse {
  datasets: BackendDatasetItem[];
}

export interface BackendSelectResponse {
  selector: Record<string, any>;
  workflow: WorkflowId;
  supported: boolean;
}

export interface BackendRunArtifact {
  artifact_id: string;
  artifact_type: string;
  output_uri: string;
  output_hash: string;
}

export interface BackendEvidenceRecord {
  evidence_id: string;
  claim_id?: string;
  claim_type?: string;
  rule_state: "supported" | "plausible" | "hypothesis" | "unsupported" | "indeterminate";
  critic_state?: string;
  claim: string;
  rationale?: string;
  checks?: Array<{
    check_id: string;
    status: "pass" | "warn" | "fail" | "error" | "not_applicable";
    message?: string;
  }>;
  provenance_ids: string[];
  uncertainty_reasons?: string[];
}

export interface BackendRunRecord {
  run_id: string;
  status: "completed" | "review" | "failed";
  selector: Record<string, any>;
  workflow: WorkflowId;
  plan: Record<string, any>;
  params: Record<string, any>;
  artifact_ids: string[];
  artifacts: BackendRunArtifact[];
  evidence: BackendEvidenceRecord[];
  warnings: string[];
  review_required: boolean;
  report_path?: string;
  error?: string;
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}

export async function fetchWorkflows(): Promise<EvidenceContract[]> {
  const res = await fetch(`${API_BASE_URL}/api/workflows`);
  if (!res.ok) throw new Error(`Failed to fetch workflows: ${res.statusText}`);
  const data = await res.json();
  return data.workflows as EvidenceContract[];
}

export async function fetchDatasets(): Promise<BackendDatasetItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/datasets`);
  if (!res.ok) throw new Error(`Failed to fetch datasets: ${res.statusText}`);
  const data = await res.json();
  return data.datasets as BackendDatasetItem[];
}

export async function selectWorkflowApi(
  question: string,
  selector: SelectorKind,
  workflow?: WorkflowId
): Promise<BackendSelectResponse> {
  const res = await fetch(`${API_BASE_URL}/api/select`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify({ question, selector, workflow: workflow || null }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorBody.detail || `Select error: ${res.status}`);
  }
  return res.json();
}

function jsonStringify(obj: any): string {
  return JSON.stringify(obj);
}

export interface ExecuteRunInput {
  question: string;
  datasetId: string;
  selectorKind: SelectorKind;
  manualWorkflow?: WorkflowId;
  params: WorkflowParams;
}

export async function executeRunApi(input: ExecuteRunInput): Promise<BackendRunRecord> {
  // Map frontend dataset ID if necessary
  const backendDatasetId =
    input.datasetId === "ds_demo_tissue_01" || input.datasetId === "synthetic"
      ? "synthetic"
      : input.datasetId === "real_dlpfc_151673"
      ? "real_dlpfc_151673"
      : input.datasetId === "real_dlpfc"
      ? "real_dlpfc"
      : "synthetic";

  const res = await fetch(`${API_BASE_URL}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: input.question,
      dataset_id: backendDatasetId,
      selector: input.selectorKind,
      workflow: input.manualWorkflow || null,
      parameters: input.params,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(
      typeof err.detail === "string"
        ? err.detail
        : err.detail?.message || JSON.stringify(err.detail) || `Execution error ${res.status}`
    );
  }

  return res.json();
}

export async function fetchRuns(): Promise<BackendRunRecord[]> {
  const res = await fetch(`${API_BASE_URL}/api/runs`);
  if (!res.ok) throw new Error(`Failed to fetch runs: ${res.statusText}`);
  const data = await res.json();
  return data.runs as BackendRunRecord[];
}

export async function fetchRun(runId: string): Promise<BackendRunRecord> {
  const res = await fetch(`${API_BASE_URL}/api/runs/${runId}`);
  if (!res.ok) throw new Error(`Failed to fetch run ${runId}: ${res.statusText}`);
  return res.json();
}

export async function fetchReportMarkdown(runId: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/runs/${runId}/report`);
  if (!res.ok) throw new Error(`Failed to fetch report for ${runId}: ${res.statusText}`);
  const data = await res.json();
  return data.report_markdown as string;
}

export function getArtifactUrl(runId: string, artifactId: string): string {
  return `${API_BASE_URL}/api/runs/${runId}/artifacts/${artifactId}`;
}

export function convertBackendRunToRecord(
  backend: BackendRunRecord,
  meta: { name: string; id: string },
  question: string,
  params: WorkflowParams
): Partial<RunRecord> {
  const artifactRefs: ArtifactRef[] = backend.artifacts.map((art) => ({
    id: art.artifact_id,
    kind: art.artifact_type,
    format: art.output_uri.endsWith(".h5ad")
      ? "AnnData (.h5ad)"
      : art.output_uri.endsWith(".csv")
      ? "Table (.csv)"
      : art.output_uri.endsWith(".png")
      ? "Figure (.png)"
      : "JSON manifest",
    bytesLabel: "Recorded on disk",
    checksum: art.output_hash,
    checksumNote: "SHA-256 content hash",
  }));

  const verificationChecks: VerificationCheck[] = [];
  for (const ev of backend.evidence) {
    if (ev.checks) {
      for (const chk of ev.checks) {
        verificationChecks.push({
          id: chk.check_id,
          check: chk.check_id,
          expected: "pass",
          actual: chk.status,
          status: chk.status === "pass" ? "pass" : chk.status === "warn" ? "warning" : "fail",
          explanation: chk.message || `Check evaluated by deterministic rule engine (${chk.status}).`,
        });
      }
    }
  }

  const provenanceFields = [
    {
      field: "Dataset Hash",
      value: (backend.plan as any)?.dataset_id || "recorded",
      availability: "recorded" as const,
      mono: true,
    },
    {
      field: "Code Commit",
      value: "Recorded in SQLite ledger",
      availability: "recorded" as const,
      mono: true,
    },
    {
      field: "Tool Name & Version",
      value: `${backend.workflow} (0.1.0)`,
      availability: "recorded" as const,
    },
  ];

  const provenanceRecord: ProvenanceRecord = {
    runId: backend.run_id,
    createdAt: Date.now(),
    fields: provenanceFields,
    artifactCount: backend.artifacts.length,
  };

  const claims: ReportClaim[] = backend.evidence.map((ev, index) => ({
    id: ev.evidence_id || `claim_${index + 1}`,
    statement: ev.claim,
    state: ev.rule_state,
    basis:
      ev.rationale ||
      `Rule-engine evaluation against executed artifacts (state: ${ev.rule_state}).`,
    references: ev.provenance_ids || [],
  }));

  const reportRecord: ReportRecord = {
    version: "report-v1",
    generatedAt: Date.now(),
    figures: backend.artifacts
      .filter((a) => a.output_uri.endsWith(".png"))
      .map((a, i) => ({
        figureId: `fig_${i + 1}`,
        caption: `Spatial visualization from ${a.artifact_type} (${a.artifact_id})`,
      })),
    warnings: backend.warnings || [],
    limitations: [
      "Clusters and expression patterns shown here are deterministic computational outputs.",
      "Marker significance is descriptive; do not infer cell types without independent validation.",
    ],
    claims,
  };

  return {
    id: backend.run_id,
    datasetId: meta.id,
    datasetName: meta.name,
    question,
    workflow: backend.workflow,
    params,
    status: backend.status === "review" ? "needs_review" : "verified",
    artifacts: artifactRefs,
    verification: verificationChecks.length > 0 ? verificationChecks : null,
    provenance: provenanceRecord,
    report: reportRecord,
    illustrative: false,
  };
}
