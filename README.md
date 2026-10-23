# BioAgent-ST

An evidence-aware, verification-first scientific agent for spatial transcriptomics. Scientific computations are deterministic; language models may only propose typed plans and narrative text. Every artifact must receive provenance, and every report claim must resolve to validated evidence.

## Repository Structure

```
BioAgent-ST/
├── frontend/       # Next.js 16 + React 19 + Tailwind CSS + shadcn/ui web workspace
├── src/            # Core agentic workflow engine, verification rules, ledger, analysis tools
├── tests/          # Unit and integration test suites
├── configs/        # Science-reviewed thresholds and agent configuration
├── data/           # Dataset manifests and test fixtures (raw datasets gitignored)
├── docs/           # Progress logs, architecture decisions, and research literature matrices
└── scripts/        # Dataset downloaders and verification scripts
```

### Frontend (`frontend/`)

The web frontend provides the research-workspace UI, interactive spatial visualization, evaluation protocol dashboard, evidence ledger, and claim classification interface.

- See [frontend/README.md](frontend/README.md) for architecture, tech stack, and local development instructions.
- See [frontend/AGENTS.md](frontend/AGENTS.md) for coding agent guidelines.

---

## Core Engine & Analysis Service

### Requirements

- Python 3.11 via `uv`
- Git

### Setup

```powershell
uv sync --locked --all-groups
```

### Quality checks

```powershell
uv run pytest -q
uv run ruff check src tests scripts
uv run ruff format --check src tests scripts
uv run mypy src
```

### Inspect datasets

Regenerate the synthetic test fixture with:

```powershell
uv run python -m bioagent_st.make_fixture
```

The same validator accepts the real benchmark, the synthetic fixture, or a user-supplied H5AD file:

```powershell
uv run bioagent-st inspect-dataset --source real_dlpfc
uv run bioagent-st inspect-dataset --source real_dlpfc_151673
uv run bioagent-st inspect-dataset --source synthetic
uv run bioagent-st inspect-dataset --source user --dataset C:\path\to\user.h5ad
```

The real development datasets are the CC BY 4.0 DLPFC Visium `151507` and `151673` sections from Figshare item `10.6084/m9.figshare.22004273.v2`. They are stored under gitignored `data/raw/`; use the corresponding `scripts/download_dlpfc*.py` script to reproduce a download. Their `sce.layer_guess` labels are evaluation annotations, not automatic cell-type claims.

User inputs must be `.h5ad` files and must provide `obsm['spatial']` with finite numeric coordinates. The CLI reports structural errors and exits non-zero rather than passing an invalid dataset downstream.

### Run the sequential MVP agent

The default test-safe path uses `MockLLMClient`; real Ollama is an explicit provider adapter for later evaluation runs.

```powershell
uv run bioagent-st run-agent --source synthetic --question "What spatial domains are present?" --output artifacts/run001
uv run bioagent-st run-agent --source real_dlpfc --question "Which spatial patterns are supported?" --output artifacts/run002
uv run bioagent-st run-agent --source user --dataset C:\path\to\input.h5ad --question "Describe spatial structure." --output artifacts/run003
```

The agent creates a typed plan, executes only registered deterministic tools, writes provenance/evidence to a local SQLite ledger, and writes `report.md`. Claims remain `Indeterminate` when required stability or consistency checks are unavailable.

## Governing instructions

Read `AGENTS.md` and then `skills/bioagent-st-builder/SKILL.md` before making changes. Phase gates in the skill are mandatory.

## License

This project is licensed under the terms of the [LICENSE](LICENSE) file.
