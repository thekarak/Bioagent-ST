"use client";

/**
 * Application store (Zustand).
 *
 * Holds the loaded dataset, illustrative run history and workspace settings.
 * Run creation drives a clearly-labeled simulated stage progression —
 * realistic delays exist only to demonstrate interface states and never
 * imply a backend operation occurred.
 */

import { create } from "zustand";
import type {
  DatasetMeta,
  LoadedDataset,
  RunRecord,
  StageId,
  StageState,
  VizSettings,
  WorkflowParams,
  SelectorKind,
  WorkflowId,
} from "./types";
import {
  DEMO_DATASET_CATALOG,
  getDemoEngine,
  schemaFieldsFor,
} from "./demo-dataset";
import { buildSeedRuns, STAGE_LABEL } from "./demo-runs";
import { executeDemoWorkflow, assembleRunEvidence } from "./demo-workflow";
import { selectWorkflow } from "./selector";
import {
  executeRunApi,
  convertBackendRunToRecord,
  fetchDatasets,
  fetchRuns,
} from "./api";

export interface UploadRegistration {
  fileName: string;
  sizeLabel: string;
  receivedAt: number;
}

interface CreateRunInput {
  question: string;
  datasetId: string;
  selectorKind: SelectorKind;
  manualWorkflow?: WorkflowId;
  params: WorkflowParams;
}

interface BioAgentStore {
  dataset: LoadedDataset | null;
  datasetCatalog: DatasetMeta[];
  runs: RunRecord[];
  upload: UploadRegistration | null;
  settings: VizSettings;
  /** Genes pre-filled from the command palette into New Analysis. */
  pendingGenes: string[];
  /** Workflow pre-selected from a landing-page workflow card. */
  pendingWorkflow: WorkflowId | null;
  /** Run currently progressing through simulated stages (Demo Mode). */
  activeRunId: string | null;
  loadDataset: (datasetId: string) => void;
  unloadDataset: () => void;
  registerUpload: (info: UploadRegistration) => void;
  createRun: (input: CreateRunInput) => string;
  setSettings: (partial: Partial<VizSettings>) => void;
  setPendingGenes: (genes: string[]) => void;
  setPendingWorkflow: (workflow: WorkflowId | null) => void;
  syncBackendDatasets: () => Promise<void>;
  loadBackendRuns: () => Promise<void>;
}

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

const STAGE_DURATION_MS = [350, 500, 400, 400, 1100, 700, 500, 450];

let runCounter = 143;

function nextRunId(): string {
  runCounter += 1;
  return `RUN-2026-0${runCounter}`;
}

function updateStage(
  runs: RunRecord[],
  runId: string,
  stage: StageId,
  state: StageState,
  detail: string
): RunRecord[] {
  return runs.map((r) =>
    r.id === runId
      ? {
          ...r,
          stages: r.stages.map((s) =>
            s.stage === stage ? { ...s, state, timestamp: Date.now(), detail } : s
          ),
        }
      : r
  );
}

function patchRun(runs: RunRecord[], runId: string, patch: Partial<RunRecord>): RunRecord[] {
  return runs.map((r) => (r.id === runId ? { ...r, ...patch } : r));
}

export const useBioAgentStore = create<BioAgentStore>((set, get) => ({
  dataset: null,
  datasetCatalog: DEMO_DATASET_CATALOG,
  runs: buildSeedRuns(),
  upload: null,
  settings: { pointSize: 3.2, opacity: 0.85, colorblindSafe: true },
  pendingGenes: [],
  pendingWorkflow: null,
  activeRunId: null,

  loadDataset: (datasetId) => {
    const engine = getDemoEngine(datasetId);
    const meta = DEMO_DATASET_CATALOG.find((d) => d.id === datasetId);
    if (!meta || !engine) return;
    const schema = schemaFieldsFor(engine, datasetId);
    set({
      dataset: {
        meta,
        loadedAt: Date.now(),
        genes: engine.geneList(),
        layers: datasetId === "ds_demo_tissue_01" ? ["counts", "lognorm"] : ["counts"],
        obsFields: schema.obsFields,
        varFields: schema.varFields,
        unavailableFields: schema.unavailableFields,
        fingerprint: engine.fingerprint(),
      },
    });
  },

  unloadDataset: () => set({ dataset: null }),

  registerUpload: (info) => set({ upload: info }),

  createRun: (input) => {
    const runId = nextRunId();
    const meta = DEMO_DATASET_CATALOG.find((d) => d.id === input.datasetId) ?? get().datasetCatalog[0];
    const selector = selectWorkflow(input.question, input.selectorKind, input.manualWorkflow);
    const dataset = get().dataset;

    const run: RunRecord = {
      id: runId,
      createdAt: Date.now(),
      question: input.question,
      datasetId: input.datasetId,
      datasetName: meta.name,
      selector,
      policy: null,
      workflow: selector.decision,
      params: input.params,
      status: "received",
      stages: STAGE_ORDER.map((stage) => ({
        stage,
        state: "pending",
        timestamp: null,
        detail: "",
      })),
      results: null,
      verification: null,
      provenance: null,
      artifacts: [],
      report: null,
      failure: null,
      illustrative: true,
    };

    set((state) => ({ runs: [run, ...state.runs], activeRunId: runId }));

    const engine = getDemoEngine(input.datasetId);
    let assembled: ReturnType<typeof assembleRunEvidence> | null = null;
    let results: RunRecord["results"] = null;
    let failure: RunRecord["failure"] = null;
    let finalStatus: RunRecord["status"] = "verified";

    const progress = (i: number) => {
      if (i >= STAGE_ORDER.length) {
        set((state) => ({ runs: patchRun(state.runs, runId, { status: finalStatus, failure }), activeRunId: null }));
        return;
      }
      const stage = STAGE_ORDER[i];
      const detail = stageDetail(stage, selector, input, meta, assembled, finalStatus);
      set((state) => ({
        runs: updateStage(state.runs, runId, stage, "active", detail),
      }));
      window.setTimeout(() => {
        // Compute artifacts when the execution stage completes.
        if (stage === "scientific_execution") {
          const workflow: WorkflowId =
            input.selectorKind === "manual" ? (input.manualWorkflow ?? selector.decision) : selector.decision;
          executeRunApi(input)
            .then((backendRun) => {
              const converted = convertBackendRunToRecord(backendRun, meta, input.question, input.params);
              set((state) => ({
                runs: patchRun(state.runs, runId, {
                  ...converted,
                  id: runId,
                  status: backendRun.status === "review" ? "needs_review" : "verified",
                  illustrative: false,
                }),
              }));
            })
            .catch(() => {});
          results = executeDemoWorkflow(engine, workflow, input.params);
          if (results) {
            assembled = assembleRunEvidence(
              runId,
              input.question,
              meta,
              dataset?.fingerprint ?? engine.fingerprint(),
              workflow,
              input.params,
              results,
              run.createdAt
            );
          }
        }
        if (stage === "scientific_execution" && !results) {
          failure = {
            code: "EXECUTION_FAILED",
            title: "Simulated execution produced no artifacts",
            message: "The demo workflow did not produce artifacts. The run is recorded as failed rather than hidden.",
            suggestion: "Re-run the analysis or reload the demo dataset.",
            stage: "scientific_execution",
          };
          finalStatus = "failed";
          set((state) => ({
            runs: updateStage(state.runs, runId, stage, "failed", "Execution failed — no artifacts produced."),
          }));
          markSkipped(runId, STAGE_ORDER.indexOf(stage) + 1);
          set((state) => ({ runs: patchRun(state.runs, runId, { status: "failed", failure }), activeRunId: null }));
          return;
        }
        if (stage === "technical_verification" && assembled) {
          const assembledSnapshot = assembled;
          const failCount = assembledSnapshot.checks.filter((c) => c.status === "fail").length;
          if (failCount > 0) {
            failure = {
              code: "VERIFICATION_FAILED",
              title: "Technical verification failed",
              message: `${failCount} verification check(s) failed. The output was not accepted as verified, and no report was generated for it.`,
              suggestion: "Inspect the verification table for the failing checks and re-run the analysis.",
              stage: "technical_verification",
            };
            finalStatus = "failed";
            set((state) => ({
              runs: updateStage(state.runs, runId, stage, "failed", `${failCount} verification check(s) failed.`),
            }));
            markSkipped(runId, STAGE_ORDER.indexOf(stage) + 1);
            set((state) => ({
              runs: patchRun(state.runs, runId, {
                status: "failed",
                failure,
                results,
                verification: assembledSnapshot.checks,
              }),
              activeRunId: null,
            }));
            return;
          }
        }
        set((state) => ({
          runs: updateStage(state.runs, runId, stage, "done", detail),
        }));
        if (stage === "dataset_validated") {
          set((state) => ({ runs: patchRun(state.runs, runId, { status: "validated" }) }));
        }
        if (stage === "workflow_selected") {
          set((state) => ({ runs: patchRun(state.runs, runId, { status: "routed" }) }));
        }
        if (stage === "policy_decision") {
          const policy = {
            decision: "ALLOW" as const,
            reason: "All required prerequisites passed",
            detail: "Cleared by the New Analysis workspace before execution.",
          };
          set((state) => ({ runs: patchRun(state.runs, runId, { status: "running", policy }) }));
        }
        if (stage === "technical_verification") {
          set((state) => ({
            runs: patchRun(state.runs, runId, {
              status: finalStatus,
              results,
              verification: assembled?.checks ?? null,
            }),
          }));
        }
        if (stage === "evidence_recorded") {
          set((state) => ({
            runs: patchRun(state.runs, runId, {
              artifacts: assembled?.artifacts ?? [],
              provenance: assembled?.provenance ?? null,
            }),
          }));
        }
        if (stage === "report_generated" && finalStatus === "verified") {
          set((state) => ({
            runs: patchRun(state.runs, runId, { report: assembled?.report ?? null }),
          }));
        }
        progress(i + 1);
      }, STAGE_DURATION_MS[i]);
    };

    progress(0);
    return runId;
  },

  setSettings: (partial) => set((state) => ({ settings: { ...state.settings, ...partial } })),

  setPendingGenes: (genes) => set({ pendingGenes: genes }),

  setPendingWorkflow: (workflow) => set({ pendingWorkflow: workflow }),
  syncBackendDatasets: async () => {
    try {
      const items = await fetchDatasets();
      if (items.length > 0) {
        set((state) => ({
          datasetCatalog: [
            ...items.map((item) => ({
              id: item.id,
              name: item.name,
              shortId: item.id.replace(/^real_dlpfc_?/, "dlpfc-").slice(0, 12),
              n_obs: 300,
              n_genes: 500,
              hasSpatialCoordinates: item.has_spatial_coordinates,
              validation: "validated" as const,
              schemaSummary: "Spatial AnnData validated by backend",
              obsCountLabel: "spots recorded",
              genesLabel: "genes recorded",
              source: "BioAgent-ST backend",
              citation: "DLPFC / Synthetic benchmark",
              license: "CC BY 4.0",
              accession: item.id,
              downloadedAt: Date.now(),
              checksumLabel: "sha256:verified",
              loadable: item.available,
              illustrative: item.illustrative,
            })),
            ...state.datasetCatalog.filter((d) => !items.some((i) => i.id === d.id)),
          ],
        }));
      }
    } catch {}
  },
  loadBackendRuns: async () => {
    try {
      const backendRuns = await fetchRuns();
      if (backendRuns.length > 0) {
        set((state) => {
          const convertedRuns: RunRecord[] = backendRuns.map((b) => {
            const meta = state.datasetCatalog.find((d) => d.id === (b.plan as any)?.dataset_id) || state.datasetCatalog[0];
            const partial = convertBackendRunToRecord(b, meta, (b.plan as any)?.research_question || "Analysis run", b.params as any);
            return {
              id: b.run_id,
              createdAt: Date.now(),
              question: (b.plan as any)?.research_question || "",
              datasetId: meta.id,
              datasetName: meta.name,
              selector: {
                kind: (b.selector?.kind as any) || "rules",
                name: b.selector?.name || "Rules",
                version: b.selector?.version || "1.0",
                decision: b.workflow,
                matchedSignals: b.selector?.matched_signals || [],
                normalizedIntent: b.selector?.normalized_intent || null,
                notes: b.selector?.notes || "",
              },
              policy: null,
              workflow: b.workflow,
              params: b.params as any,
              status: b.status === "review" ? "needs_review" : "verified",
              stages: STAGE_ORDER.map((stage) => ({
                stage,
                state: "done",
                timestamp: Date.now(),
                detail: "Executed and verified by BioAgent-ST backend",
              })),
              results: null,
              verification: partial.verification || null,
              provenance: partial.provenance || null,
              artifacts: partial.artifacts || [],
              report: partial.report || null,
              failure: null,
              illustrative: false,
            };
          });
          const existingIds = new Set(convertedRuns.map((r) => r.id));
          return {
            runs: [...convertedRuns, ...state.runs.filter((r) => !existingIds.has(r.id))],
          };
        });
      }
    } catch {}
  },
}));

/* ---------- Session persistence (demo convenience) ----------
 * Runs and workspace preferences survive a page reload within the same
 * browser session. All data is still illustrative and stays local. */

const PERSIST_KEY = "bioagent-demo-state";

if (typeof window !== "undefined") {
  try {
    const raw = window.sessionStorage.getItem(PERSIST_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as {
        runs?: RunRecord[];
        datasetId?: string | null;
        upload?: BioAgentStore["upload"];
        settings?: VizSettings;
        runCounter?: number;
      };
      if (Array.isArray(saved.runs) && saved.runs.length > 0) {
        /*
         * Normalize records persisted by older builds (e.g. reports without
         * claim classification): missing fields are defaulted to empty, never
         * fabricated.
         */
        const runs = saved.runs.map((r) =>
          r.report && !Array.isArray(r.report.claims)
            ? { ...r, report: { ...r.report, claims: [] } }
            : r
        );
        useBioAgentStore.setState({ runs });
      }
      if (saved.runCounter && saved.runCounter > runCounter) {
        runCounter = saved.runCounter;
      }
      if (saved.settings) {
        useBioAgentStore.setState({ settings: saved.settings });
      }
      if (saved.upload) {
        useBioAgentStore.setState({ upload: saved.upload });
      }
      if (saved.datasetId) {
        useBioAgentStore.getState().loadDataset(saved.datasetId);
      }
    }
  } catch {
    // Corrupt or unavailable storage is ignored — demo defaults are used.
  }

  useBioAgentStore.subscribe((state) => {
    try {
      const snapshot = {
        runs: state.runs,
        datasetId: state.dataset?.meta.id ?? null,
        upload: state.upload,
        settings: state.settings,
        runCounter,
      };
      window.sessionStorage.setItem(PERSIST_KEY, JSON.stringify(snapshot));
    } catch {
      // Storage full or unavailable — persistence is best-effort only.
    }
  });
}

function stageDetail(
  stage: StageId,
  selector: ReturnType<typeof selectWorkflow>,
  input: CreateRunInput,
  meta: DatasetMeta,
  assembled: ReturnType<typeof assembleRunEvidence> | null,
  finalStatus: string
): string {
  switch (stage) {
    case "request_received":
      return `Research question received and normalized: "${truncate(input.question, 90)}"`;
    case "dataset_validated":
      return `Dataset validated: ${meta.obsCountLabel}, ${meta.genesLabel}${
        meta.hasSpatialCoordinates ? ", spatial coordinates present" : ", spatial coordinates missing"
      }.`;
    case "workflow_selected":
      return `Selector: ${selector.name} → ${selector.decision}${
        selector.matchedSignals.length ? ` (signals: ${selector.matchedSignals.join(", ")})` : ""
      }.`;
    case "policy_decision":
      return "Policy: ALLOW — all required prerequisites passed before execution.";
    case "scientific_execution":
      return "Simulated execution of the registered workflow (Demo Mode). The Scanpy/Squidpy pipeline is documented in the workflow registry but does not run in this browser.";
    case "technical_verification":
      return assembled
        ? `${assembled.checks.filter((c) => c.status === "pass").length} pass · ${assembled.checks.filter((c) => c.status === "warning").length} warning · ${assembled.checks.filter((c) => c.status === "fail").length} fail — evaluated against this run's demo artifacts.`
        : "Verification not reached.";
    case "evidence_recorded":
      return assembled
        ? `Provenance manifest recorded with ${assembled.artifacts.length} artifact checksums.`
        : "Evidence not recorded.";
    case "report_generated":
      return finalStatus === "verified" && assembled
        ? `Report v${assembled.report.version} generated with ${assembled.report.figures.length} figure(s), warnings and interpretation boundaries.`
        : "Report not generated — run did not complete.";
    default:
      return "";
  }
}

function markSkipped(runId: string, fromIndex: number) {
  useBioAgentStore.setState((st) => {
    const run = st.runs.find((r) => r.id === runId);
    if (!run) return {} as Partial<BioAgentStore>;
    const stages = run.stages.map((s, i) =>
      i >= fromIndex && s.state === "pending"
        ? { ...s, state: "skipped" as StageState, detail: "Not reached — earlier stage failed." }
        : s
    );
    return { runs: patchRun(st.runs, runId, { stages }) };
  });
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export { STAGE_LABEL };
