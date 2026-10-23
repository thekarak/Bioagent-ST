# Progress log — BioAgent-ST

Format: newest session first. Each entry: date, phase/task, done, next, open questions, known failures.

## 2026-10-23 — Canonical workflows, routing evaluation, and FastAPI/Frontend integration

- **Phase/Task:** Workflow canonicalization, routing evaluation (rules vs Laya), FastAPI service, and frontend API integration.
- **Done:**
  - Implemented the three approved canonical workflows with machine-readable contracts: `quality_assessment`, `spatial_clustering`, and `gene_expression`.
  - Refactored `run_spatial_clustering` to use `effective_clustering` with matrix-aware dimension bounds across all artifact writes.
  - Implemented deterministic keyword rules and Laya LLM adapter in `routing.py` with typed decisions, confidence gating, fallback, and malformed output rejection.
  - Added `scripts/evaluate_routing.py` harness measuring accuracy, abstention rate, latency (mean/median/p95), and errors with CI fake predictor and optional real model run.
  - Added optional `laya` dependency to `pyproject.toml` and updated `uv.lock`.
  - Implemented `apps/api/main.py` FastAPI service with `/health`, `/api/workflows`, `/api/datasets`, `/api/select`, and `/api/runs` (list/get/create/report/artifacts) with CORS middleware.
  - Implemented frontend API client (`frontend/src/lib/bioagent/api.ts`) and store integration connecting web UI to the scientific backend.
  - Added unit and integration tests across routing, gene expression (exact/ambiguous/not-found/layer errors), canonical workflow contract artifacts, and planner gene/quality paths.
  - All 71 tests pass; Ruff lint/format clean; `mypy apps src` clean; frontend `tsc --noEmit`, `eslint`, and `next build` clean.
- **Next:** Phase 4 — LangGraph port with identical behavior, downgrade-only critic, uncertainty gating, escalation, and ablation config.
- **Open questions:** Science reviewer must confirm provisional thresholds before interpreting evidence states as biological findings.
- **Known failures:** Third-party AnnData/Squidpy deprecation warnings remain; no project test or build failures.

## 2026-09-25 — Second real dataset added

- **Phase/Task:** Dataset expansion — real-first validation with a second DLPFC Visium section.
- **Done:**
  - Downloaded Figshare `151673.h5ad` under the same CC BY 4.0 collection into gitignored `data/raw/real/dlpfc/`.
  - Verified size `120,647,211` bytes, published MD5, local SHA-256, `3,639 × 33,538` shape, spatial coordinates, and `sce.layer_guess` labels.
  - Added `scripts/download_dlpfc_151673.py`, `data/manifests/libd_dlpfc_151673.yaml`, and `--source real_dlpfc_151673` across CLI interfaces.
  - Ran the full MockLLM agent on `151673`: four artifacts, two evidence records, and validated report.
  - Full test suite remains green: 51 tests passed; lint/format/typecheck passed before this dataset-only addition.
- **Dataset policy:** Real datasets are primary development/evaluation inputs. Synthetic data remains a controlled regression/degradation fixture, not a substitute for real data.
- **Next:** Phase 4 — LangGraph port with identical behavior, downgrade-only critic, uncertainty gating, escalation, and ablations.

## 2026-09-25 — Phase 3 complete (first working agent)

- **Phase/Task:** Phase 3 — sequential MockLLM planner, typed plan validation, executor, ledger updates, claim evaluation, and report validation.
- **Definition of done:** User question + AnnData in; predefined typed workflow runs; artifacts/provenance/evidence persist; one or two claims are rule-evaluated; report validator passes.
- **Audit of Phases 0–2:** Passed 47 tests, provenance round-trip, real/synthetic inspection, real/synthetic deterministic workflows, and all five evidence states. One fixture labeling defect was found and fixed: synthetic gene symbols were stored in `var` but not used as `var_names`.
- **Done:**
  - Added `LLMClient`, `MockLLMClient`, and local `OllamaClient` adapter.
  - Added structured planner with Pydantic validation, two-retry limit, and registered-tool/prerequisite validation.
  - Added sequential executor with shared SQLite provenance/evidence ledger.
  - Added honest cluster and marker claim construction; missing stability/resolution checks produce `Indeterminate`.
  - Added evidence-bound report models, generator, and fail-closed validator for unknown IDs/state mismatches.
  - Added `bioagent-st run-agent` for synthetic, real, and user H5AD sources.
  - Verified end to end on synthetic, real DLPFC, and user-input fixture runs; each produced four artifacts, two evidence records, and a validated report.
  - Final gate: 51 tests passed; Ruff, formatting, and mypy clean.
- **Next:** Phase 4 — LangGraph port with identical behavior, downgrade-only critic, uncertainty gating, escalation, and ablation config.
- **Open questions:** Science review is still required before interpreting provisional thresholds as biological findings.
- **Known failures:** Third-party AnnData/Squidpy compatibility warnings remain; no project test or workflow failures.

## 2026-09-25 — Phase 2 complete (verification primitives)

- **Phase/Task:** Phase 2 — deterministic checks, claim-type registry, five-state rule engine, and evidence-record bridge.
- **Definition of done:** All five evidence states are reachable in tests; evidence records are created for at least two claim types; the rule engine has no LLM dependency.
- **Done:**
  - Added provisional threshold loader backed by `configs/thresholds.yaml`.
  - Added pure data, QC, cluster, marker, spatial, power, and provenance-integrity checks.
  - Added four initial claim types and required-check registry; no cell-type or causal claim types.
  - Added deterministic rule engine with explicit hard/soft check semantics, integrity failure handling, low-power `indeterminate` behavior, and extrapolation-only `hypothesis`.
  - Added `evidence_from_checks()` to convert rule decisions into immutable `EvidenceRecord` objects.
  - Gate verification: focused verification tests pass; Ruff, formatting, and mypy clean.
- **Next:** Phase 3 — sequential LLM planner/executor with MockLLM, typed plan validation, ledger updates, and validated report generation.
- **Open questions:** Science reviewer must confirm provisional thresholds before interpreting evidence states as biological findings.
- **Known failures:** Third-party AnnData/Squidpy warnings remain; no verification logic failures.

## 2026-09-24 — Phase 1 complete (deterministic analysis layer)

- **Phase/Task:** Phase 1 — QC, normalization, embedding, clustering, markers, and spatial statistics.
- **Definition of done:** The three workflows run without an LLM, produce artifacts with provenance, and repeat runs yield identical AnnData content hashes.
- **Done:**
  - Added typed deterministic analysis functions for QC, clustering, markers, spatial graph, Moran autocorrelation, and neighborhood enrichment.
  - Added Scanpy Leiden backends `igraph` and `leidenalg` to the locked environment.
  - Added provenance-producing wrappers and CLI workflows: `qc_clustering`, `markers`, and `spatial_statistics`.
  - Synthetic workflow: 300 spots, 500 genes, 3 clusters; marker table and spatial graph succeeded.
  - Real DLPFC workflow: 2,909 spots retained, 2,000 HVGs, 4 clusters; marker table and spatial graph succeeded.
  - Repeated synthetic `qc_clustering` produced identical `anndata_content_hash`.
  - Gate verification: 25 tests passed; Ruff lint/format clean; mypy clean.
- **Next:** Phase 2 — deterministic verification checks, claim-type registry, and five-state rule engine.
- **Open questions:** Science review must confirm provisional thresholds; marker circularity and manual DLPFC layer labels must remain limitations, not biological claims.
- **Known failures:** Squidpy emits compatibility/deprecation warnings from third-party code; no workflow failures.

## 2026-09-24 — Phase 1 dataset foundation

- **Phase/Task:** Phase 1 — real dataset selection, reproducible ingest, shared user-H5AD interface.
- **Definition of done:** A licensed real spatial dataset and labeled synthetic fixture pass one deterministic input validator; user-supplied `.h5ad` can be selected through the CLI.
- **Done:**
  - Downloaded Figshare `151507.h5ad` from the CC BY 4.0 DLPFC collection into gitignored `data/raw/real/dlpfc/`.
  - Verified file size `104,314,118` bytes, published MD5 `9c1d950fcaadb6a39e5194621482aaa1`, and local SHA-256.
  - Confirmed `4,226 × 33,538`, `obsm['spatial']`, integer-like X, unique IDs, and `sce.layer_guess` labels.
  - Added `scripts/download_dlpfc.py`, a committed manifest, and citation/license/limitations.
  - Added shared `inspect_h5ad()` and `load_dataset(source='real_dlpfc'|'synthetic'|'user')` contracts.
  - Added `bioagent-st inspect-dataset --source real_dlpfc|synthetic|user`; invalid spatial input exits with code 2.
  - Gate verification: 25 tests passed; Ruff lint/format clean; mypy clean; real and synthetic inspections clean.
- **Next:** Implement deterministic QC and normalization tools with provenance.
- **Open questions:** Science reviewer must confirm provisional QC thresholds and decide whether manual layer labels may be used only as evaluation labels, never as automatic cell-type claims.
- **Known failures:** The real file emits AnnData `OldFormatWarning` messages on read; they are compatibility warnings, not validation failures.

## 2026-09-24 — Phase 0 complete (foundations)

- **Phase/Task:** Phase 0 — repository, environment, contracts, utilities, ledger, fixture, CI.
- **Definition of done:** `pytest` green; a script creates, stores, and reads back a `ProvenanceRecord`.
- **Done:**
  - Isolated the project in a nested Git repository; Python 3.11.16 managed by `uv`.
  - Added pinned `uv.lock`, Ruff, strict mypy, pytest markers, and GitHub Actions CI.
  - Implemented frozen Pydantic contracts for plans, tools, claims, evidence, provenance, and dataset manifests.
  - Implemented SHA-256 file/AnnData content hashing, sortable IDs, seeding, and library-version capture.
  - Implemented SQLite tables and thin evidence/provenance stores with JSON records.
  - Generated a deterministic 300-spot × 500-gene spatial fixture (386,342 bytes) and checksummed manifest.
  - Gate verification: 19 tests passed; Ruff lint/format clean; mypy clean; provenance round-trip passed.
- **Next:** Phase 1 — test-first deterministic input inspection and QC tool.
- **Open questions:** Science reviewer must confirm provisional thresholds in `configs/thresholds.yaml`.
- **Known failures:** None. Squidpy import is slow on this Windows environment; keep real-model tests excluded by default.

## 2026-09-24 — Session 0 (pre-Phase-0)

- **Phase/Task:** Setup — paths, skill registration, plan refinement.
- **Done:**
  - Extracted blueprint PDF (16 pages) to `_blueprint_extracted.txt` via pypdf.
  - Installed skill at `skills/bioagent-st-builder/SKILL.md` (canonical), source `SKILL (1).md` kept.
  - Wrote `AGENTS.md` (skill pointer + session protocol + non-negotiables + phase gates).
  - Refined 9-phase plan with dependency map; scope locked: MVP slice, Ollama, Python 3.11, synthetic fixture + H5AD ingest.
- **Next:** Phase 0 — repo env, schemas, utils, SQLite ledger, fixture, tests, CI.
- **Open questions:** none blocking.
- **Known failures:** none.
