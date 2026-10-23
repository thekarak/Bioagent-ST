## 2026-10-23 — Canonical workflow contracts and routing architecture

- **Context:** The system required explicit execution boundaries for research queries, request intent classification, and integration between the web frontend and deterministic scientific backend.
- **Decision:** Restrict execution strictly to three canonical workflows (`quality_assessment`, `spatial_clustering`, `gene_expression`). Route research queries deterministically via transparent keyword rules with Laya LLM classifier fallback. Expose typed REST API endpoints (`/health`, `/api/workflows`, `/api/datasets`, `/api/select`, `/api/runs`) with CORS for web frontend consumption while persisting all run provenance and rule-evaluated claims in SQLite.
- **Alternatives:** Arbitrary code execution or ad-hoc tool calling (rejected due to safety, non-determinism, and reproducibility non-negotiables); frontend-only demo simulation (rejected because the research prototype requires real deterministic execution).
- **Consequences:** Requests outside approved workflows abstain (`unsupported_or_ambiguous`); frontend can run against both local mock and real scientific backend without code duplication.

## 2026-09-25 — Real-first dataset policy and second DLPFC section

- **Context:** The user correctly challenged reliance on synthetic data. The project already had one real DLPFC section; a second section enables basic cross-section real-data checks.
- **Decision:** Real DLPFC Visium sections `151507` and `151673` are primary development inputs. Synthetic data is retained only for deterministic regression, planted truth, and degradation experiments. Both raw files stay gitignored; manifests and reproducible downloaders are committed.
- **Alternatives:** Remove synthetic data entirely (rejected because controlled failure tests require known labels); use only one real section (acceptable but weaker for cross-section checks).
- **Consequences:** Real-data runs are now the default validation path; synthetic runs are explicit controls. Second-section results must not be treated as biological replication claims without a documented study design.

## 2026-09-25 — Add DLPFC 151673

- **Context:** Figshare item `22004273` contains multiple CC BY 4.0 Visium sections; section `151673` is a second real sample from the same collection.
- **Decision:** Download `151673.h5ad`, verify its published MD5 and local SHA-256, record a manifest, and expose it as `real_dlpfc_151673`.
- **Alternatives:** Download all 12 sections (rejected for current scope and storage); use a different tissue/platform (deferred).
- **Consequences:** The agent has two real sections available for development without claiming independent biological replication.

## 2026-09-25 — Phase 3 claims begin conservatively

## 2026-09-25 — Phase 3 claims begin conservatively

- **Context:** The first agent can execute clustering and marker workflows, but cluster stability across seeds/resolutions and marker consistency across neighboring resolutions are not yet computed.
- **Decision:** Generate cluster and marker claims with the checks that are available; allow missing required checks to produce `Indeterminate` rather than filling gaps with LLM prose or optimistic states.
- **Alternatives:** Label claims supported from successful execution alone (rejected); omit claims until all checks exist (rejected because the ledger must be exercised).
- **Consequences:** The MVP report is honest and evidence-bound, but its first claims are expected to be indeterminate until Phase 4/5 adds stability and consistency checks.

## 2026-09-25 — Fix synthetic fixture gene labels

- **Context:** Audit found that `var["gene_symbol"]` existed but AnnData `var_names` remained integer indices, causing numeric marker labels in reports.
- **Decision:** Use the synthetic gene symbols as the DataFrame index/`var_names`, regenerate the fixture and manifest, and add a regression assertion for `GENE_0000`.
- **Alternatives:** Keep integer IDs and report them as genes (rejected); use real gene symbols for synthetic data (rejected as biologically misleading).
- **Consequences:** Synthetic marker reports now identify planted features explicitly as `GENE_####` and remain software-test data.

## 2026-09-25 — Rule state semantics for Phase 2

- **Context:** The rule engine must distinguish inadequate evidence from contradictory evidence and must never let language-model confidence determine state.
- **Decision:** Use hard/soft checks, required-check presence, provenance integrity checks, an explicit contradiction set, and an explicit extrapolation origin. Hard contradiction -> `unsupported`; hard failure without contradiction, missing checks, errors, or integrity failure -> `indeterminate`; passing hard checks with at most one soft warning -> `supported`; other passing combinations -> `plausible`; extrapolation with otherwise passing checks -> `hypothesis`.
- **Alternatives:** Let an LLM classify evidence (rejected); treat every failure as unsupported (rejected); assign `hypothesis` automatically (rejected).
- **Consequences:** The engine is deterministic and testable; all five states have explicit test coverage; later critic logic can only downgrade rule state.

## 2026-09-25 — Marker circularity check

- **Context:** Marker genes are selected from the same expression data used to derive clusters, so marker significance is descriptive rather than independent validation.
- **Decision:** `marker.circularity_flag` is always a soft warning and must be carried into evidence limitations unless an independent validation artifact is provided.
- **Alternatives:** Omit the warning to simplify reports (rejected); treat marker significance as cluster proof (rejected).
- **Consequences:** Marker claims can reach `supported` only as descriptive evidence, never as validated cell identity or causality.

## 2026-09-24 — Size-aware workflow defaults

- **Context:** The 300 × 500 synthetic fixture cannot request the real-data default of 2,000 highly variable genes.
- **Decision:** When the caller does not supply `ClusteringParams`, `run_qc_clustering` caps HVG count and PCs to the available matrix size. Explicit parameters remain strict and are never silently relaxed.
- **Alternatives:** Separate synthetic and real code paths (rejected); silently change explicit parameters (rejected).
- **Consequences:** The same workflow runs on tiny fixtures and real datasets, while invalid explicit requests still fail visibly.

## 2026-09-24 — Phase 1 tool output and thresholds

- **Context:** Phase 1 requires three deterministic workflows with provenance, but all thresholds are provisional until science review.
- **Decision:** Use `configs/thresholds.yaml` defaults for QC and clustering parameters, record all expanded parameters in provenance, and keep marker results descriptive with circularity limitations to be added in Phase 2 verification.
- **Alternatives:** Hard-code thresholds in tools (rejected); present markers as biological validation (rejected).
- **Consequences:** Reproducible artifacts now exist; evidence states and circularity checks are deferred to the next phase as planned.

## 2026-09-24 — Real benchmark dataset: DLPFC Visium 151507

- **Context:** The project needs a real, annotated spatial dataset while retaining a deterministic synthetic fixture. The candidate Figshare collection is public and reports CC BY 4.0; sample 151507 has spatial coordinates and `sce.layer_guess` labels.
- **Decision:** Use Figshare item `10.6084/m9.figshare.22004273.v2`, file `151507.h5ad`, as the first real development dataset. Keep it under gitignored `data/raw/real/`; commit only manifest, citation, checksum, and downloader.
- **Alternatives:** Squidpy's 10x samples (unclear per-dataset labels/license details); 10x Visium examples (larger, less useful for controlled testing); synthetic only (insufficient for real-input validation).
- **Consequences:** The real file is available for integration testing, but its manual layer labels are treated as evaluation annotations, not biological conclusions. The dataset is a benchmark input, not a claim of BioAgent-ST performance.

## 2026-09-24 — One shared ingest validator for all dataset sources

- **Context:** Real, synthetic, and future user datasets must not have separate scientific contracts.
- **Decision:** All sources use `inspect_h5ad()` checks for shape, unique IDs, spatial coordinates, counts-like detection, and label-column discovery. CLI selects `real_dlpfc`, `synthetic`, or `user`; user input is accepted only as `.h5ad` and fails closed on structural errors.
- **Alternatives:** Separate modality-specific validators (deferred); permissive import with downstream failures (rejected).
- **Consequences:** User datasets are supported early without adding arbitrary file parsing or bypassing provenance. Modality-specific checks can be added as registered tools later.

## 2026-09-24 — Python 3.11 via uv

- **Context:** System Python is 3.14.3, but the blueprint and skill require Python 3.11 or 3.12 for the scientific ecosystem.
- **Decision:** Pin `.python-version` and `pyproject.toml` to Python 3.11; use `uv.lock` as the exact environment source.
- **Alternatives:** Python 3.12 (also compatible but not yet project-tested); system Python 3.14 (outside project requirement).
- **Consequences:** Project commands must use `uv run`; the system Python is not used.

## 2026-09-24 — Nested BioAgent-ST Git repository

- **Context:** `BioAgent-st` initially inherited the unrelated `Desktop` repository, which has no commits and contains many unrelated staged/untracked projects.
- **Decision:** Initialize a dedicated repository inside `C:\Users\sfors\OneDrive\Desktop\BioAgent-st`.
- **Alternatives:** Use the Desktop repository (risk of unrelated history and accidental staging); defer Git (violates reproducibility requirements).
- **Consequences:** BioAgent-ST history is isolated; future commits must run from this project directory.

## 2026-09-24 — Skill location and AGENTS.md pointer

- **Context:** User supplied `SKILL (1).md` as the project build skill; opencode loads `AGENTS.md` every session.
- **Decision:** Canonical skill path `skills/bioagent-st-builder/SKILL.md`; `AGENTS.md` is a short pointer plus extracted session protocol, non-negotiables, layout rules, phase order. Keep `SKILL (1).md` as identical source copy (SHA256 match verified).
- **Alternatives:** Inline full skill into AGENTS.md (duplication, drift); delete source copy (loses provenance).
- **Consequences:** Single edit point for skill; AGENTS.md stays short; two copies must be updated together if skill changes.

## 2026-09-24 — Fixture vs "never commit .h5ad" rule

- **Context:** Skill §2.2 says never commit `.h5ad`; skill §6 Phase 0 requires a tiny fixture committed under `data/fixtures/`.
- **Decision:** Treat `data/fixtures/*.h5ad` as the explicit exception (tiny, generated by a committed script, <1 MB). `.gitignore` ignores `*.h5ad` globally with `!data/fixtures/*.h5ad` negation. All other h5ad (raw, artifacts, results) stay ignored.
- **Alternatives:** Commit fixture as CSV/npz (slower, non-standard); skip committed fixture (breaks Phase 0 gate).
- **Consequences:** Tests and replay have a stable, versioned input; still no scientific datasets in git.

## 2026-09-24 — SQLite driver

- **Context:** Skill allows `sqlmodel` or plain `sqlite3`.
- **Decision:** Plain `sqlite3` + JSON columns for Phase 0; records stored as JSON via Pydantic `model_dump_json()`. No ORM dependency until a real query need appears.
- **Alternatives:** sqlmodel (extra dep, little gain for insert/get/list).
- **Consequences:** Thin stores, easy to swap later; queries are hand-written SQL.
