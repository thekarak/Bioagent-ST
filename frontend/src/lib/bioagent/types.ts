/**
 * BioAgent-ST domain types.
 *
 * These types describe the intended backend contract (datasets, workflows,
 * runs, verification, provenance, reports). In this prototype the data comes
 * from a clearly-labeled local demo adapter; no scientific backend is
 * connected. Field semantics are written so a real service can replace the
 * adapter without changing the UI contract.
 */

/* ---------- Workflows ---------- */

export type WorkflowId =
  | "quality_assessment"
  | "spatial_clustering"
  | "gene_expression"
  | "unsupported_or_ambiguous";

export type SelectorKind = "laya" | "rules" | "manual";

export type PolicyDecision = "ALLOW" | "REVIEW" | "BLOCK";

/* ---------- Datasets ---------- */

export type ValidationState = "validated" | "warning" | "failed" | "not_assessed";

export interface DatasetSchemaField {
  field: string;
  location: "obs" | "var" | "uns" | "obsm" | "layers" | "X";
  dtype: string;
  description: string;
  notes?: string;
}

export interface DatasetMeta {
  id: string;
  name: string;
  /** Short identifier shown in tables (mono). */
  shortId: string;
  n_obs: number | null;
  n_genes: number | null;
  hasSpatialCoordinates: boolean;
  validation: ValidationState;
  schemaSummary: string;
  obsCountLabel: string;
  genesLabel: string;
  source: string;
  citation: string | null;
  /** Dataset provenance checklist fields; null = not recorded (never invented). */
  license: string | null;
  accession: string | null;
  downloadedAt: number | null;
  checksumLabel: string | null;
  /** Whether this dataset can be loaded in the local demo adapter. */
  loadable: boolean;
  illustrative: boolean;
}

export interface GeneInfo {
  index: number;
  name: string;
  meanCounts: number;
  detectedFraction: number;
}

export interface LoadedDataset {
  meta: DatasetMeta;
  loadedAt: number;
  /** Gene identifiers present in `var`. */
  genes: GeneInfo[];
  layers: string[];
  obsFields: DatasetSchemaField[];
  varFields: DatasetSchemaField[];
  /** Fields the validator could not assess (kept explicit, never invented). */
  unavailableFields: string[];
  /** Honest fingerprint of the local demo data object. */
  fingerprint: string;
}

/* ---------- Runs ---------- */

export type RunStatus =
  | "received"
  | "validated"
  | "routed"
  | "running"
  | "verified"
  | "needs_review"
  | "failed";

export const RUN_STATUS_ORDER: RunStatus[] = [
  "received",
  "validated",
  "routed",
  "running",
  "verified",
  "needs_review",
  "failed",
];

export type StageId =
  | "request_received"
  | "dataset_validated"
  | "workflow_selected"
  | "policy_decision"
  | "scientific_execution"
  | "technical_verification"
  | "evidence_recorded"
  | "report_generated";

export type StageState = "pending" | "active" | "done" | "failed" | "skipped";

export interface StageRecord {
  stage: StageId;
  state: StageState;
  timestamp: number | null;
  detail: string;
}

export interface SelectorDecision {
  kind: SelectorKind;
  /** Human-readable selector identity, honestly labeled when simulated. */
  name: string;
  version: string;
  decision: WorkflowId;
  matchedSignals: string[];
  normalizedIntent: string | null;
  notes: string;
}

export interface PolicyRecord {
  decision: PolicyDecision;
  reason: string;
  detail: string;
}

/* ---------- Parameters ---------- */

export type NormalizationChoice = "lognorm" | "counts";

export interface ClusteringParams {
  normalization: NormalizationChoice;
  n_pcs: number;
  n_neighbors: number;
  resolution: number;
  seed: number;
}

export interface GeneExpressionParams {
  genes: string[];
  layer: string;
}

export interface QualityParams {
  min_counts: number;
  min_genes: number;
}

export type WorkflowParams =
  | ClusteringParams
  | GeneExpressionParams
  | QualityParams
  | Record<string, never>;

/* ---------- Results (demo artifacts) ---------- */

export interface ClusteringResults {
  kind: "spatial_clustering";
  labels: number[];
  k: number;
  clusterSizes: { label: number; count: number }[];
  umap: { x: number[]; y: number[] };
  params: ClusteringParams;
  spatial: { x: number[]; y: number[] };
}

export interface GeneResultEntry {
  requested: string;
  resolved: string | null;
  match: "exact" | "not_found" | "ambiguous";
  candidates?: string[];
  values: number[] | null;
  layer: string;
  stats: {
    min: number;
    max: number;
    mean: number;
    median: number;
    zeroFraction: number;
  } | null;
}

export interface GeneExpressionResults {
  kind: "gene_expression";
  entries: GeneResultEntry[];
  spatial: { x: number[]; y: number[] };
}

export interface QualityResults {
  kind: "quality_assessment";
  total_counts: number[];
  n_genes_per_obs: number[];
  coordinate_bounds: { x_min: number; x_max: number; y_min: number; y_max: number };
  missingFields: string[];
  metrics: { label: string; value: string; explanation: string }[];
}

export type RunResults = ClusteringResults | GeneExpressionResults | QualityResults | null;

/* ---------- Verification ---------- */

export type CheckStatus = "pass" | "fail" | "warning" | "not_run";

export interface VerificationCheck {
  id: string;
  check: string;
  expected: string;
  actual: string;
  status: CheckStatus;
  explanation: string;
}

/* ---------- Provenance ---------- */

export interface ProvenanceField {
  field: string;
  value: string;
  /** Where the value came from; "Not recorded"/"Unavailable" when absent. */
  availability: "recorded" | "not_recorded" | "unavailable";
  mono?: boolean;
}

export interface ProvenanceRecord {
  runId: string;
  createdAt: number;
  fields: ProvenanceField[];
  artifactCount: number;
}

export interface ArtifactRef {
  id: string;
  kind: string;
  format: string;
  bytesLabel: string;
  checksum: string;
  checksumNote: string;
}

/* ---------- Reports ---------- */

export interface ReportFigure {
  figureId: string;
  caption: string;
}

/**
 * Five-state evidence vocabulary for claim-level classification.
 * Implemented by the demo adapter with deterministic rules; a real backend
 * would classify claims against the run's evidence contract.
 */
export type EvidenceState =
  | "supported"
  | "plausible"
  | "hypothesis"
  | "unsupported"
  | "indeterminate";

export interface ReportClaim {
  id: string;
  /** The claim being classified, phrased as a checkable statement. */
  statement: string;
  state: EvidenceState;
  /** Why this classification was assigned — traceable to checks/artifacts. */
  basis: string;
  /** Run-local references (check ids, artifact ids) the classification traces to. */
  references: string[];
}

export interface ReportRecord {
  version: string;
  generatedAt: number;
  figures: ReportFigure[];
  warnings: string[];
  limitations: string[];
  /** Claim-level evidence classification (five states). */
  claims: ReportClaim[];
}

/* ---------- Evidence contracts ---------- */

/**
 * Machine-readable contract that defines what a workflow requires, may use,
 * must produce, and how it fails. Contracts are versioned alongside code.
 */
export interface EvidenceContract {
  workflow: "quality_assessment" | "spatial_clustering" | "gene_expression";
  version: string;
  requiredInputs: { label: string; requirement: string }[];
  allowedParameters: { label: string; range: string }[];
  expectedArtifacts: string[];
  validationChecks: string[];
  failurePolicy: string;
}

/* ---------- Failure ---------- */

export interface FailureInfo {
  code: string;
  title: string;
  message: string;
  suggestion: string;
  stage: StageId;
}

/* ---------- Run record ---------- */

export interface RunRecord {
  id: string;
  createdAt: number;
  question: string;
  datasetId: string;
  datasetName: string;
  selector: SelectorDecision;
  policy: PolicyRecord | null;
  workflow: WorkflowId;
  params: WorkflowParams;
  status: RunStatus;
  stages: StageRecord[];
  results: RunResults;
  verification: VerificationCheck[] | null;
  provenance: ProvenanceRecord | null;
  artifacts: ArtifactRef[];
  report: ReportRecord | null;
  failure: FailureInfo | null;
  illustrative: boolean;
}

/* ---------- Prerequisites ---------- */

export type PrereqStatus = "pass" | "missing" | "warning" | "not_assessed";

export interface PrerequisiteCheck {
  id: string;
  label: string;
  status: PrereqStatus;
  explanation: string;
  source: string;
  required: boolean;
}

/* ---------- Settings ---------- */

export interface VizSettings {
  pointSize: number;
  opacity: number;
  colorblindSafe: boolean;
}
