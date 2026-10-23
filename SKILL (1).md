---
name: bioagent-st-builder
description: >-
  Step-by-step build guide for BioAgent-ST, a verification-first scientific agent for spatial
  transcriptomics (AnnData, Scanpy, Squidpy, LangGraph, Pydantic, FastAPI). Use this skill whenever
  the user is working in the bioagent-st repository or mentions BioAgent-ST, the evidence ledger,
  five-state claims (supported, plausible, hypothesis, unsupported, indeterminate), provenance
  records, typed scientific tools, Planner-Executor or Verifier-Critic loops, uncertainty-gated
  autonomy, degradation experiments, baselines or ablations for the agent, or asks what to build
  next. Load it at the start of every session, even for small tasks, because it defines the phase
  order, the contracts, the definition of done, and rules that prevent scope creep and invented science.
license: MIT
compatibility: opencode
metadata:
  project: bioagent-st
  team-size: "2"
  language: python
  blueprint-date: "2026-09-20"
---

# BioAgent-ST Builder

You are helping a **two-person research team** build BioAgent-ST: a spatial transcriptomics analysis
agent whose defining property is that **every claim it makes is tied to executed, recorded evidence**,
and that it becomes *more cautious* when data quality drops. The output of this project is a
reproducible prototype **and** a paper, so correctness, traceability and honest evaluation matter more
than features or polish.

Read sections 1 and 2 fully every session. Read the rest as needed for the current phase.

---

## 1. Mission and non-negotiable principles

Each principle has a reason. If a request seems to conflict with one, stop and tell the user rather
than quietly working around it.

1. **Deterministic science, LLM orchestration.** All numbers come from Scanpy, Squidpy, SciPy or
   statsmodels code. The LLM plans, selects approved tools, and phrases text. It never computes,
   estimates, or recalls a result. *Why:* the research claim is about reliability; an LLM-produced
   number destroys the ability to audit anything.
2. **Typed tools, not arbitrary code execution.** The LLM can only call registered tools with
   Pydantic-validated parameters. *Why:* reproducibility, safety, and testability.
3. **Every artifact has provenance.** Nothing is written without a `ProvenanceRecord`. *Why:* the
   "auditability" metric depends on reconstructing results from the ledger alone.
4. **Claims are gated by rules, not by LLM vibes.** A deterministic rule engine assigns the
   evidence state. The critic (LLM) may only **downgrade** a state, never upgrade it. *Why:* otherwise
   the verification layer is just another opinion from the same model.
5. **The report cannot invent.** Every quantitative statement resolves to an artifact ID or evidence ID,
   and a validator rejects reports that reference missing or unknown IDs.
6. **Uncertainty is a feature.** Indeterminate and Unsupported outcomes are legitimate, reported
   results, not errors to be hidden or retried until they disappear.
7. **Avoid the refusal trap.** A system that refuses everything has zero unsupported claims and zero
   value. Always evaluate utility (correct Supported claims on answerable tasks) alongside caution.
8. **Build the vertical slice first.** 3 workflows, 1 to 2 datasets, sequential graph. Active
   interruption, gating and ablations come only after the slice is reproducible.
9. **Nothing is "novel" or "confirmed" until tested.** The blueprint is a set of hypotheses. Never
   write text (docs, README, paper drafts, code comments) that claims novelty, superiority, or
   calibrated confidence without experimental evidence and a literature check.
10. **Both teammates must understand everything.** Prefer small, readable code, short technical notes,
    and tests over cleverness.

---

## 2. Operating protocol for you, the coding agent

### 2.1 Start of every session
1. Read `docs/PROGRESS.md` (create it in Phase 0 if missing) and `docs/DECISIONS.md`.
2. Run `git status` and `git log --oneline -10`.
3. Run the test suite (`uv run pytest -q`). Report failures before writing new code.
4. State which **phase and task** you are working on, and the definition of done for it (section 6).
5. If the user's request is outside the current phase, say so and ask whether to reorder. Do not
   silently jump ahead.

### 2.2 While working
- **Plan, then act.** For any task touching more than two files, write a short plan (files, tests,
  order) and get a go-ahead if the plan involves a design decision not covered here.
- **Test first for scientific code.** Write the test (or at least the expected output contract) before
  the tool. Every tool needs: input validation test, output-schema test, determinism test (same seed
  gives same result), and a regression test on a tiny fixture dataset.
- **Small commits**, conventional style: `feat(analysis): add qc tool`, `test(...)`, `docs(...)`,
  `refactor(...)`. One logical change per commit. Never commit datasets, `.h5ad`, `.zarr`, API keys,
  or generated artifacts (use `.gitignore`).
- **Verify library APIs against the installed version.** Scanpy, Squidpy, LangGraph, AnnData and
  Pydantic change often. Before using a function, check the installed version
  (`uv pip list`, `python -c "import scanpy; print(scanpy.__version__)"`), and read its docstring
  (`python -c "import scanpy as sc; help(sc.tl.leiden)"`) or use any available docs tool. Do not
  rely on memory for argument names or defaults. Record the versions used in provenance.
- **Never invent biology.** If a threshold, marker set, or interpretation is not from a cited source
  or a documented team decision, mark it `# TODO(science-review)` and put it in `configs/thresholds.yaml`
  as a *provisional default*, never hard-coded in logic. Ask the user to confirm scientific choices.
- **Keep the LLM out of the tests.** Use a `MockLLMClient` returning fixed JSON for all unit and
  integration tests. Real-model calls only in explicit `evaluation` runs.
- **Log decisions.** Any non-obvious choice (why Leiden resolution grid X, why permutation count Y)
  goes to `docs/DECISIONS.md` as a dated entry: context, decision, alternatives, consequences.

### 2.3 End of every session
1. All tests pass, `ruff check` and `ruff format --check` clean, type check clean if configured.
2. Update `docs/PROGRESS.md`: what was done, what is next, open questions, known failures.
3. Commit. Summarize to the user in five lines or fewer: done, next, blockers, decisions needed.

### 2.4 When to stop and ask
- A design choice would change an evidence-state rule, a metric definition, or the evaluation protocol.
- A dataset license is unclear.
- A test fails in a way that suggests a scientific (not code) problem.
- You are about to add a dependency, a service (Redis, vector DB, Kubernetes), or a new workflow
  that is not in the roadmap.
- The requested feature belongs to a later phase.

---

## 3. Environment and stack

| Area | Choice | Notes |
|---|---|---|
| Python | 3.11 or 3.12 | Pin in `.python-version` |
| Env / deps | `uv` + `pyproject.toml` + `uv.lock` | Commit the lockfile |
| Core science | `anndata`, `scanpy`, `squidpy`, `numpy`, `pandas`, `scipy`, `statsmodels` | Pin exact versions in the lockfile |
| Clustering backend | `igraph` / `leidenalg` as required by installed Scanpy | Check `sc.tl.leiden` docstring for flavor |
| Schemas | `pydantic` v2 | All plans, params, claims, evidence, provenance |
| Orchestration | `langgraph` | Only after the sequential executor works |
| API | `fastapi`, `uvicorn` | Thin layer over the library; no logic in routes |
| UI | `streamlit` (Phase 6) | Read-only viewer of runs, ledger, reports first |
| Metadata store | SQLite via `sqlmodel` or plain `sqlite3` | JSON columns for records |
| Artifacts | Local filesystem, H5AD or Zarr, CSV, JSON, PNG/SVG | Content-addressed names preferred |
| Experiment tracking | Plain versioned `experiments/results/<run_id>/` first; MLflow optional | Do not add MLflow before Phase 8 |
| Quality | `pytest`, `pytest-cov`, `ruff`, `mypy` or `pyright` | CI via GitHub Actions |
| Container | `docker/Dockerfile` | Add in Phase 8 for the reproducibility package |

**Do not add** (unless the user explicitly overrides): Kubernetes, microservices, Redis/Celery,
vector databases, Node.js backend, custom model training, arbitrary code-execution sandboxes, a
large tool library.

Setup commands for Phase 0 (adapt to installed tooling):
```bash
uv init --package bioagent-st   # or create pyproject manually with src layout
uv add anndata scanpy squidpy scipy statsmodels pandas numpy pydantic pyyaml
uv add langgraph fastapi uvicorn
uv add --dev pytest pytest-cov ruff mypy
```
Set `random_state`-style seeds everywhere and expose a single `seed` in every experiment config.

---

## 4. Repository layout

```
bioagent-st/
├── AGENTS.md                      # short pointer: "load skill bioagent-st-builder"
├── README.md
├── pyproject.toml / uv.lock
├── configs/
│   ├── thresholds.yaml            # provisional check thresholds (science-reviewed)
│   ├── agent.yaml                 # AgentConfig flags (ledger/critic/gating/provenance)
│   └── experiments/               # one YAML per experiment, version-controlled
├── data/
│   ├── raw/                       # gitignored, never modified
│   ├── manifests/                 # committed: source, license, version, sha256, notes
│   └── fixtures/                  # tiny committed test datasets (< 1 MB)
├── artifacts/                     # gitignored: generated H5AD/Zarr, tables, figures, logs
├── docs/
│   ├── PROGRESS.md  DECISIONS.md  ablations.md  eval_protocol.md
│   ├── literature_matrix.md  novelty_map.md
│   └── method_notes/              # one short note per tool: assumptions, inputs, outputs, limits
├── src/bioagent_st/
│   ├── schemas/                   # plans.py evidence.py provenance.py tools.py
│   ├── analysis/                  # qc.py clustering.py markers.py spatial.py statistics.py
│   ├── tools/                     # registry.py, wrappers that add provenance + checks
│   ├── ledger/                    # evidence_store.py provenance_store.py db.py
│   ├── verification/              # checks.py rules.py claim_types.py
│   ├── agents/                    # planner.py executor.py verifier.py critic.py graph.py state.py
│   ├── llm/                       # client.py (Protocol) mock.py providers/
│   ├── reporting/                 # generator.py validator.py templates/
│   ├── evaluation/                # baselines.py degradation.py metrics.py tasks.py replay.py
│   └── utils/                     # hashing.py seeding.py versions.py
├── apps/api/main.py   apps/ui/app.py
├── tests/{unit,integration,evaluation}/
├── experiments/{configs,results}/
└── docker/
```

Rules: raw data is separate from artifacts; analysis code never imports from `agents/`; `agents/`
never imports `scanpy` directly (it goes through `tools/`); `reporting/` reads only from `ledger/`.

---

## 5. Core contracts

Implement these first (Phase 0). They are the spine of the project. Use Pydantic v2 with
`model_config = ConfigDict(frozen=True, extra="forbid")` for records so they cannot be mutated after
creation and typos fail loudly. Use `Field(default_factory=list)` for list defaults.

```python
# schemas/evidence.py
EvidenceState = Literal["supported", "plausible", "hypothesis", "unsupported", "indeterminate"]

class CheckResult(BaseModel):
    check_id: str                      # e.g. "cluster.stability.ari"
    status: Literal["pass", "warn", "fail", "error", "not_applicable"]
    severity: Literal["hard", "soft"]  # hard failures cap the state
    value: float | None = None
    threshold: float | None = None
    detail: str = ""
    artifact_ids: list[str] = Field(default_factory=list)

class EvidenceRecord(BaseModel):
    evidence_id: str
    experiment_id: str
    claim_id: str
    state: EvidenceState
    state_source: Literal["rule_engine", "critic_downgrade"]
    rule_state: EvidenceState          # what the rule engine originally assigned
    claim: str
    supporting_artifacts: list[str]
    contradicting_artifacts: list[str] = Field(default_factory=list)
    checks: list[CheckResult]
    limitations: list[str] = Field(default_factory=list)
    alternatives: list[str] = Field(default_factory=list)
    uncertainty_reasons: list[str] = Field(default_factory=list)
    confidence: float | None = None    # stored but NOT interpreted until calibrated
    provenance_ids: list[str]
    requires_human_review: bool = False
    created_at: datetime
```

```python
# schemas/provenance.py
class ProvenanceRecord(BaseModel):
    artifact_id: str
    artifact_type: str                 # "qc_result", "clustering_result", ...
    dataset_hash: str                  # sha256 of raw input file(s)
    input_artifact_hashes: dict[str, str] = Field(default_factory=dict)
    code_commit: str                   # git rev-parse HEAD (+ "-dirty" if uncommitted)
    tool_name: str
    tool_version: str                  # tool schema version, bump on behavior change
    library_versions: dict[str, str]   # scanpy, squidpy, anndata, numpy, scipy, ...
    parameters: dict[str, Any]         # the validated params, fully expanded with defaults
    random_seed: int | None
    upstream_artifact_ids: list[str]
    output_uri: str
    output_hash: str                   # sha256 of the produced file
    created_at: datetime
    llm_model_id: str | None = None    # model that requested the call, if any
```

Also implement in Phase 0: `AnalysisStep`, `AnalysisPlan` (see blueprint Appendix A.1),
`ClaimRecord` (Appendix A.2, add `claim_type` restricted to registered claim types), `ToolSpec`
(name, params model, prerequisites, supported modalities, output artifact types, version),
and `ToolResult`:

```python
class ToolResult(BaseModel):
    status: Literal["ok", "partial", "error"]
    artifact_ids: list[str]
    metrics: dict[str, float | int | str]
    checks: list[CheckResult]
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None
```

Utilities to write early: `sha256_file()`, `git_commit()`, `library_versions()`, `set_all_seeds(seed)`,
`new_id(prefix)` (sortable, e.g. `art_cluster_20260920T1200_ab12`).

**Important detail on hashing:** hash the *file bytes* for datasets and outputs. AnnData saved twice
may differ in bytes; therefore also store a **content hash** of key arrays (e.g. hash of
`adata.X` data + `obs_names` + `var_names`) so replay can compare content, not just bytes.

---

## 6. Phased roadmap

Each phase ends with a **gate**: the listed checks pass and `PROGRESS.md` is updated. Do not start
the next phase before the gate is passed unless the user says so. Weeks are planning estimates.

### Phase 0: Foundations (weeks 1-2)
Tasks:
- Repo, `uv` env, ruff/pytest config, GitHub Actions running lint + tests.
- Core schemas (section 5) with unit tests (valid and invalid instances).
- Utilities: hashing, seeding, versions, IDs.
- SQLite ledger schema: tables `experiments`, `artifacts` (provenance JSON), `claims`, `evidence`,
  `runs`. Thin `EvidenceStore` and `ProvenanceStore` classes with insert/get/list only.
- Dataset manifest format + first manifests (source URL, version, license, sha256, modality,
  platform, preprocessing state, known limitations).
- `docs/literature_matrix.md` and `docs/novelty_map.md` skeletons (user fills, you scaffold).
- Create a **tiny fixture dataset** (e.g. 300 spots x 500 genes, subsampled from a public dataset,
  with spatial coordinates) committed under `data/fixtures/`.
Gate: `pytest` green; a script can create a `ProvenanceRecord`, store it, and read it back.

### Phase 1: Deterministic analysis layer (weeks 3-4)
Implement three workflows as plain functions plus typed wrappers (section 7):
1. **QC and clustering:** load, QC metrics, filtering, normalization, HVG selection, PCA, neighbors,
   UMAP, Leiden clustering.
2. **Spatial domains and marker evidence:** per-cluster marker statistics with effect sizes and
   multiple-testing correction; spatial scatter of clusters/markers.
3. **Spatial statistics:** spatial neighbor graph, neighborhood enrichment, spatial autocorrelation
   (Moran's I) with permutation-based nulls.
Also: input validators (has `obsm["spatial"]`, counts vs normalized detection, no NaN coords,
gene names unique), figures, provenance on every output, method notes in `docs/method_notes/`.
Gate: `python -m bioagent_st.cli run-workflow qc_clustering --dataset <manifest>` works **with no LLM**,
produces artifacts with provenance, and running it twice yields identical content hashes.

### Phase 2: Verification primitives (weeks 5-6, before the agent)
Building verification before the LLM keeps the science testable.
- `verification/checks.py`: each check is a pure function `(adata_or_artifacts, params) -> CheckResult`.
- `verification/claim_types.py`: registry mapping `claim_type` to required checks (section 8).
- `verification/rules.py`: rule engine `decide_state(claim_type, checks, cfg) -> (state, reasons)`.
- Unit tests for every rule branch, including all five states reachable from synthetic check sets.
Gate: given fixture artifacts, a script produces `EvidenceRecord`s for 2 claim types, all five states
demonstrated in tests.

### Phase 3: First working agent, sequential (weeks 5-6)
- `LLMClient` Protocol, `MockLLMClient`, one real provider adapter.
- Planner producing `AnalysisPlan` (structured JSON validated by Pydantic; reject and re-prompt max 2 times).
- Plan validator: tool exists, params in range, prerequisites satisfied, dataset modality supported.
- Executor loop (plain Python, not LangGraph yet): run steps in order, persist provenance.
- Minimal report generator (section 11) with reference validation.
Gate (**Minimum Viable Research Prototype**): user question + AnnData in, predefined workflow runs,
artifacts and provenance recorded, one or two claims evaluated by rules, report with evidence
references generated, and the report validator passes. Tag the commit `mvp-v0`.

### Phase 4: Ledger, critic, routing (weeks 7-8)
- Port the executor to LangGraph (section 9) with explicit state, no behavior change; tests must still pass.
- Add verifier node (runs checks), ledger-update node, critic node (LLM, downgrade-only), routing.
- Autonomy gating and escalation to `requires_human_review` (section 9.3).
- `AgentConfig` flags for ablations, implemented now, documented in `docs/ablations.md`.
Gate: with degraded fixture data the agent produces Indeterminate/Unsupported claims and a human-review
flag; with clean data it produces Supported claims; both covered by integration tests using the mock LLM.

### Phase 5: Evaluation harness (weeks 9-10)
Section 12. Gate: one full experiment config runs end to end for all baselines on the fixture and
writes metrics to `experiments/results/<run_id>/`.

### Phase 6: Minimal API/UI (any time after Phase 4; keep small)
FastAPI endpoints: submit run, get status, list artifacts, get evidence, get report. Streamlit page
that shows the plan, the artifact list with provenance, the ledger table, and the report. No editing.

### Phase 7: Experiments and paper (weeks 11-12+)
Freeze the protocol (tag `eval-protocol-frozen`), run baselines/ablations/degradation, error analysis,
reproducibility package, draft methods and evaluation sections. Never tune the protocol after seeing
final results.

### Phase 8: Hardening
Docker image, pinned environment, replay test in CI, optional MLflow, README with exact commands.

---

## 7. Scientific tool specification

### 7.1 Wrapper pattern
Keep pure analysis logic in `analysis/` and put governance in `tools/`. A tool wrapper must:
1. Validate params with its Pydantic model (fill defaults, enforce ranges with `Field(ge=..., le=...)`).
2. Check prerequisites (upstream artifacts exist, required `obs`/`obsm` keys present).
3. Set seeds, run the analysis function on a **copy** of the input AnnData (never mutate inputs).
4. Write outputs (H5AD/Zarr, CSV, figures) to `artifacts/<experiment_id>/`.
5. Compute output hash, write the `ProvenanceRecord`, register the artifact.
6. Run the tool's intrinsic checks and return `ToolResult` (errors are returned, not swallowed, and
   partial failures set `status="partial"` with the reason).

```python
class QCParams(BaseModel):
    model_config = ConfigDict(extra="forbid")
    min_genes: int = Field(200, ge=0, le=10_000)
    min_cells: int = Field(3, ge=0)
    max_mito_pct: float = Field(20.0, ge=0, le=100)
    mito_prefix: str = "MT-"          # species-dependent: "mt-" for mouse; validate against var_names

@register_tool(name="run_qc", version="0.1.0", params=QCParams,
               requires=[], modalities=["visium", "generic_spatial"])
def run_qc(ctx: ToolContext, dataset_ref: str, params: QCParams) -> ToolResult: ...
```

### 7.2 Tools to implement (initial set, nothing more)
| Tool | Key params (all with ranges) | Intrinsic checks |
|---|---|---|
| `inspect_dataset` | none | shape, modality guess, counts-like data, spatial keys, duplicate names, NaNs |
| `run_qc` | min_genes, min_cells, max_mito_pct, mito_prefix | fraction removed, min remaining n_obs, mito gene presence |
| `normalize_and_select` | target_sum, n_top_genes, hvg_flavor | HVG count, layer preservation of raw counts |
| `run_embedding` | n_pcs, n_neighbors, seed | variance explained, neighbor graph connectivity |
| `run_clustering` | method=leiden, resolution, seed | number of clusters, min cluster size, seed and resolution recorded |
| `assess_cluster_stability` | resolutions grid, n_seeds | pairwise ARI across seeds/resolutions |
| `find_markers` | groupby, method, n_genes, corr_method | effect sizes, adjusted p-values, group size floor |
| `build_spatial_graph` | coord_type, n_neighs or radius | connectedness, mean degree, isolated nodes |
| `neighborhood_enrichment` | cluster_key, n_perms, seed | permutation null present, min group size, z-score stability across seeds |
| `spatial_autocorr` | genes, mode (moran), n_perms, seed | FDR-adjusted p, graph validity, gene expression sparsity |
| `plot_*` | plot-specific | figure saved with provenance |

Verify Scanpy/Squidpy function names and arguments in the installed version before wrapping (see 2.2).
For Leiden, follow the installed version's recommended flavor and set `random_state`.

### 7.3 Determinism requirements
- Same input hash + params + seed + library versions must reproduce the same *content hash* of results
  (allow documented tolerances for floating-point differences, e.g. `np.allclose` with `rtol=1e-6`).
- Add a test that runs each tool twice and compares content hashes or arrays.
- Document any non-deterministic behavior (multithreading, UMAP) in the method note and in
  `warnings`; do not use UMAP coordinates as evidence for any claim.

---

## 8. Verification layer

### 8.1 Claim types (start with 3 to 4)
Define each in `verification/claim_types.py`:

| claim_type | Example claim | Required checks |
|---|---|---|
| `cluster_reproducible` | "Clustering at resolution r identifies k stable groups" | `cluster.stability.ari`, `cluster.min_size`, `qc.pass` |
| `marker_specific` | "Gene G is a marker of cluster C" | `marker.effect_size`, `marker.fdr`, `marker.group_size`, `marker.consistency_resolution`, `marker.circularity_flag` |
| `spatial_domain_coherent` | "Cluster C forms a spatially coherent domain" | `spatial.graph_valid`, `spatial.enrichment_vs_null`, `spatial.null_stability` |
| `spatial_pattern_gene` | "Gene G is spatially autocorrelated" | `spatial.graph_valid`, `spatial.moran_fdr`, `spatial.expression_sparsity`, `spatial.null_present` |

Never create a `cell_type_identity` or `causal_interaction` claim type in the first prototype. Cell
types need annotation methods and expert review, and spatial proximity is not interaction.

### 8.2 Check catalog (implement as pure functions)
Data-level: `data.min_obs`, `data.spatial_coords_valid`, `data.counts_available`, `data.duplicate_ids`.
Statistics-level: `stat.multiple_testing_applied`, `stat.effect_size_reported`, `stat.permutation_null_present`,
`stat.power_proxy` (group size and expression sparsity floors, documented as a proxy only).
Method-level: `cluster.stability.ari`, `cluster.min_size`, `spatial.graph_valid` (connected components,
mean degree, isolates), `marker.consistency_resolution` (marker still top-ranked at neighboring resolutions).
Integrity-level: `prov.artifacts_exist`, `prov.hashes_match`, `prov.upstream_complete`.
**Circularity flag:** markers computed on clusters derived from the same expression data are
descriptive, not independent evidence that the clusters are biologically distinct. Always emit
`marker.circularity_flag` as `warn` and include it in `limitations` unless an independent validation
(e.g. held-out spots or a second dataset) is provided. This prevents overclaiming.

### 8.3 Rule engine
Thresholds live in `configs/thresholds.yaml` with a `provisional: true` marker until the team's
domain reviewer signs off. Starting-point logic (the science reviewer decides final values):

```
if any check.status == "error" or any integrity check fails      -> indeterminate (reason: "check could not run / provenance broken")
elif any hard check == "fail" and evidence contradicts claim      -> unsupported
elif any hard check == "fail" or required check missing           -> indeterminate
elif all hard checks pass and no soft "fail" and <=1 soft "warn"  -> supported
elif all hard checks pass                                         -> plausible
else                                                              -> indeterminate
"hypothesis" is assigned only to claims explicitly flagged as extrapolation (claim.origin == "extrapolation"),
never to a claim that has a full set of passing checks.
```
Distinguish **unsupported** (evidence contradicts or fails to support with adequate power) from
**indeterminate** (cannot decide because of low power, data quality, or a failed check). A failed
test at low power is *indeterminate*, not unsupported. Encode power proxies to make that separation.

The rule engine returns `(state, reasons)` and never calls an LLM. `EvidenceRecord.rule_state` always
stores its output. The critic may change `state` only along the allowed downgrade paths:
`supported -> plausible -> hypothesis`, or any state `-> indeterminate` or `-> unsupported` with a
reason. Any attempted upgrade is rejected and logged.

### 8.4 Confidence
Do not fabricate numeric confidence. Leave `confidence=None` unless a documented calibration procedure
exists. LLM-verbalized confidence may be stored under a separate field name `llm_reported_confidence`
and must never appear in reports as a probability.

---

## 9. Agent graph

### 9.1 Order of implementation
1. Sequential Python loop (Phase 3).
2. LangGraph port with identical behavior (Phase 4 start).
3. Verifier/critic routing, then gating.
Confirm the installed LangGraph API (state schema, conditional edges, checkpointer) before coding.

### 9.2 State and nodes
State (a Pydantic model or TypedDict): `experiment_id`, `question`, `dataset_ref`, `plan`, `step_index`,
`artifact_ids`, `check_results`, `claims`, `evidence_ids`, `decision_log`, `retry_counts`,
`requires_human_review`, `config` (AgentConfig), `status`.

Nodes: `intake` -> `inspect_dataset` -> `plan` -> `validate_plan` -> `execute_step` -> `verify` ->
`update_ledger` -> `critic` -> `route` -> (`execute_step` | `revise_plan` | `flag` | `escalate` | `report`).

Routing decisions are written to `decision_log` with the reason and the IDs of the checks that
triggered them. This log is part of the audit trail and is used by the auditability metric.

Limits: max 2 retries per step, max plan revisions 2, hard step budget per run, per-run wall-clock
timeout. On budget exhaustion, escalate rather than continue.

### 9.3 Autonomy gating
Compute an `evidence_band` from check results after each verified step:
- **high:** all hard checks pass -> continue normally.
- **medium:** soft warnings or borderline values -> continue but add caveat requirements, request an
  additional check (e.g. stability across seeds) if cheap, and label downstream claims Plausible at best.
- **low or contradictory:** hard failure or error -> stop the branch, allow one revision (e.g. different
  parameters from the allowed range), otherwise set `requires_human_review=True` and finish with
  Indeterminate/Unsupported claims and a report that says so.
Gating must be purely a function of check results plus config, so ablation "no gating" is a simple flag.

### 9.4 AgentConfig (design for ablations now)
```python
class AgentConfig(BaseModel):
    mode: Literal["full", "tool_baseline", "schema_baseline", "react_baseline"] = "full"
    ledger_enabled: bool = True
    critic_enabled: bool = True
    gating_enabled: bool = True
    provenance_constraints_enabled: bool = True   # report validator + provenance-required writes
    seed: int = 0
    max_retries: int = 2
```
Write `docs/ablations.md` defining exactly what each disabled component does (for example: with the
ledger off, claims are still generated but no `EvidenceRecord` is stored and the report uses free
text; with provenance constraints off, the report validator is not enforced but provenance is still
written so replay can *measure* the resulting unsupported numbers). Define this **before** coding it.

---

## 10. LLM layer

- `LLMClient` Protocol: `generate_plan(question, context) -> dict`, `propose_parameters(...)`,
  `critique_claim(claim, evidence) -> dict`, `draft_narrative(evidence_bundle) -> dict`.
- All model outputs are **structured JSON validated by Pydantic**. On validation failure: retry with the
  error message (max 2), then fail the step loudly.
- Temperature 0 (or lowest available) for reproducibility. LLMs are still not fully deterministic, so
  log everything and run repeated trials in evaluation.
- Log per call: model id/version, provider, prompt template id + hash, full prompt, params, raw response,
  token counts, latency. Store under `artifacts/<experiment_id>/llm_calls.jsonl` and reference in provenance.
- Prompts live in `src/bioagent_st/llm/prompts/*.md` with versions; never inline long prompts in code.
- Planner prompt must include the tool registry (names, param schemas, prerequisites) and instruct the
  model to use only listed tools and to state assumptions. It must not include instructions to "be
  confident" or to always produce a conclusion.
- Critic prompt receives claim + evidence + rule state and may only return one of: `keep`, `downgrade`
  with target state and reason, `escalate`. It is told explicitly that upgrading is not allowed.
- Keep secrets in environment variables (`.env` gitignored). Never log API keys.
- Provider adapters: start with one hosted provider and optionally Ollama. Do not build a multi-provider
  framework beyond the Protocol.

---

## 11. Report generation

The report generator is **template-driven**, with the LLM filling narrative slots only.

Structure:
1. Question and dataset (with dataset hash and manifest reference).
2. Executed workflow (table: step, tool, key parameters, artifact IDs).
3. Findings by evidence state: Supported, Plausible, Hypothesis, Unsupported, Indeterminate.
4. Limitations and assumptions (from method notes and check warnings).
5. Human-review items (if any) and recommended additional analyses.
6. Reproducibility appendix (code commit, library versions, seeds, model ids).

Numbers are inserted programmatically from artifacts via placeholders such as
`{{art:art_cluster_001.metrics.n_clusters}}`, resolved by code, never typed by the LLM.
The **report validator** (`reporting/validator.py`) must fail the build when:
- a quantitative statement has no artifact/evidence reference,
- a referenced ID does not exist in the ledger or its file is missing,
- a claim in Findings has no evidence state, or its state differs from the ledger,
- an Unsupported or Indeterminate claim appears in the Supported section, or its wording implies a finding
  (implement with a simple deterministic phrase check plus a test set of known bad rewrites),
- an uncertainty statement lacks a reason.

---

## 12. Evaluation framework

### 12.1 Task suite (`evaluation/tasks.py`, YAML in `experiments/configs/tasks/`)
Each task: `task_id`, `dataset_id`, `question`, `degradation` (type + level), `gold_claims`
`[{claim_type, target, truth: true | false | undeterminable, rationale, source}]`, `answerable: bool`.
Include, per dataset:
- **Answerable-true** tasks (clear structure, known marker/domain).
- **Negative controls** with planted falsehoods: shuffled spatial coordinates (spatial claims should
  fail), permuted cluster labels (marker claims should fail), random gene sets as fake "markers".
- **Undeterminable** tasks: too few spots, extreme dropout, single-replicate ambiguity, ambiguous question.
Gold labels must be written and committed **before** running any system, by someone who has not seen outputs.

### 12.2 Baselines (all share the same tool registry and datasets)
1. `tool_baseline`: planner + executor + tools, no verification layer.
2. `schema_baseline`: adds typed parameter validation and plan validation, no claim-level verification.
3. `react_baseline`: ReAct-style loop with the same tools and less structured control.
4. `full`: ledger + critic + gating + provenance constraints.
Baselines must use the same LLM, same prompts style, same budget. Document any unavoidable difference.
Do not describe a baseline as a reproduction of an external published system unless it truly is one.

### 12.3 Ablations
Flags per section 9.4: no_ledger, no_critic, no_gating, no_provenance_constraints. Run each on the full
task suite with identical seeds.

### 12.4 Degradation (`evaluation/degradation.py`)
Seeded, documented, reproducible perturbations applied to the *raw counts*:
- Gene dropout: binomial thinning of counts with keep-probability p in a grid (e.g. 1.0, 0.8, 0.6, 0.4, 0.2).
- Spot subsampling to fractions of the original (e.g. 1.0, 0.5, 0.25, 0.1).
- Added technical noise (e.g. library-size perturbation).
- Platform shift only where scientifically defensible; discuss with the domain reviewer first.
Each degraded dataset gets its own manifest entry with the perturbation, level, seed and parent hash.
Report a **quality index** per dataset (e.g. median genes per spot, fraction of zeros, n_obs) so the
degradation continuum is on an interpretable axis. Distinguish synthetic degradation from natural
data-quality problems in all reports.

### 12.5 Metrics (`evaluation/metrics.py`), all with definitions in `docs/eval_protocol.md`
| Metric | How to compute |
|---|---|
| Unsupported-claim rate | Fraction of claims (any state stated as a finding: Supported/Plausible) judged unsupported by gold labels or by replay+reviewer |
| Supported-claim precision | Among claims labeled Supported, fraction matching predefined evidence criteria and gold truth |
| Supported-claim recall / utility | Among answerable-true gold claims, fraction the system labels Supported |
| Graceful degradation | Slope and curve of the Indeterminate / human-review rate versus quality index |
| Escalation appropriateness | On undeterminable tasks, fraction escalated or Indeterminate; on answerable tasks, false-escalation rate |
| Auditability | Replay from ledger: fraction of key numbers and decisions reproduced within tolerance |
| Human review | Structured rubric (trustworthiness, usefulness, clarity) with at least two reviewers and agreement (e.g. Cohen's kappa) |
Always report utility metrics next to caution metrics. Use multiple seeds and at least 3 repeated LLM
runs per condition; report bootstrap confidence intervals over tasks. Report failures and negative results.

### 12.6 Replay (`evaluation/replay.py`)
Given an `experiment_id`, reconstruct each tool call from provenance (dataset hash, parameters, seed,
code commit), re-execute, and compare content hashes or arrays with tolerance. Output a per-artifact
match table. This powers the auditability metric and is run in CI on the fixture.

### 12.7 Protocol discipline
Write `docs/eval_protocol.md` first, tag the commit `eval-protocol-frozen`, then run final experiments.
Separate development datasets/tasks from held-out test tasks. Mark exploratory analyses as exploratory.

---

## 13. Testing strategy

| Level | What | Examples |
|---|---|---|
| Unit | schemas, hashing, IDs, each check, rule engine branches | invalid params rejected; all 5 states reachable |
| Tool | each tool on the fixture | determinism (two runs equal), output schema, provenance written, input not mutated |
| Integration | full workflow with `MockLLMClient` | clean fixture gives Supported; degraded gives Indeterminate |
| Report | validator | bad references fail; upgraded wording fails |
| Evaluation | degradation, metrics on synthetic ledgers | metric values match hand-computed cases |
| Replay | fixture experiment replays | all artifacts match within tolerance |
Use `pytest` markers: `@pytest.mark.slow` for real datasets, `@pytest.mark.llm` for real model calls
(excluded by default). Keep the default suite under a couple of minutes.

---

## 14. Scientific guardrails (encode these in code, docs, and report wording)
- A cluster is not a validated cell type. A marker association is not causal evidence.
- Spatial proximity is not biological interaction. Statistical significance is not biological importance.
- A non-significant test may reflect low power, model mismatch, or bad data; do not report it as absence.
- Markers derived from the clusters they define are circular; flag them.
- Always report effect sizes with p-values, apply and name the multiple-testing correction.
- UMAP is for visualization, never evidence.
- Every method has a note listing assumptions, inputs, outputs, limitations, and validation checks.
- Species and platform matter (e.g. mitochondrial prefix, spot vs single-cell resolution); validate rather than assume.

---

## 15. Anti-patterns to refuse or flag

- Letting the LLM write and run arbitrary Python as the default execution path.
- Any number in a report that did not come from an artifact.
- Rule-engine thresholds hard-coded without a config entry and science review.
- Critic or LLM upgrading a claim's evidence state.
- Retrying a step with different parameters until a check passes, without logging each attempt (this is
  p-hacking; log all attempts and count them in the record).
- Adding tools, workflows, or agents before Phase 1 and 2 gates pass.
- Multiple independent LLM "agent personas" before there is evidence they help; use one model with explicit state.
- Reporting confidence as a probability without calibration.
- Tuning thresholds or prompts on the held-out evaluation set.
- Committing data, keys, or `.h5ad` files; editing raw data in place.
- Silent exception handling in tools; partial failures must be visible in `ToolResult`.
- Wording in README/paper such as "novel", "state of the art", "significantly outperforms" without results.

---

## 16. Session kickoff prompts (suggested for the user)

Use these to start a session; you should respond by restating the phase, task, and definition of done.
- "Start Phase 0: set up the repo, env, CI, and core schemas with tests."
- "Implement the `run_qc` tool with provenance, per section 7, tests first."
- "Add the `marker_specific` claim type with checks and rule-engine tests."
- "Port the sequential executor to LangGraph with no behavior change."
- "Implement the degradation pipeline and a quality index; add tests."
- "Audit the repo against the anti-pattern list and the phase gates; report gaps."
- "Write the report validator and a test set of bad reports."

Datasets to consider (verify availability, size, and license before use, and record in a manifest):
public 10x Visium examples, and the small benchmark sets bundled with Squidpy's `squidpy.datasets`
module (for example Visium H&E, seqFISH, MERFISH, Slide-seq variants; check the installed version for
the exact function names). Prefer small, well-characterized datasets first.

---

## 17. Definition of done for the prototype

- [ ] All three workflows run without an LLM and replay reproducibly.
- [ ] Every artifact has provenance; `replay` reproduces fixture results within tolerance.
- [ ] Rule engine assigns all five states with tests; critic downgrade-only enforced by test.
- [ ] Agent (sequential and LangGraph) produces a validated, evidence-bound report.
- [ ] Degraded data produces more Indeterminate/escalation than clean data on the fixture.
- [ ] Baselines and ablations run from config files; metrics computed and stored per run.
- [ ] Evaluation protocol frozen and tagged before final runs.
- [ ] Docs: method notes, decisions log, ablation semantics, dataset manifests, literature matrix.
- [ ] README states exactly what is implemented, what was tested, and what remains hypothesis.

**North star:** build a system that knows what it executed, knows what evidence it has, separates
findings from hypotheses, exposes uncertainty, and can be audited by someone who was not there.
