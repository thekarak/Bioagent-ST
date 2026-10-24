# BioAgent-ST Ablations & Baselines Reference

This document formalizes the evaluation baselines and component ablation flags for **BioAgent-ST**, corresponding to Section 9.4 and Section 12 of the research blueprint (`skills/bioagent-st-builder/SKILL.md`).

---

## 1. Overview & Evaluation Principles

To isolate the scientific contributions of BioAgent-ST and measure the exact impact of each safeguard, every baseline and ablation is configured through a single typed configuration schema: `bioagent_st.schemas.agent_config.AgentConfig`.

### Core Evaluation Guarantees
1. **Shared Foundation:** All baselines and ablations use the same underlying tools (`src/bioagent_st/tools/workflow.py`), the same benchmark datasets (real DLPFC slices and synthetic degradations), identical random seeds, and the same LLM provider / model / prompt templates / step budgets.
2. **Explicit Flagging:** Disabling a component modifies **only** the documented behavior. Feature flags are never checked outside `AgentConfig`.
3. **Auditability:** Even when constraints or verification layers are disabled (e.g. `--no-provenance-constraints`), runtime artifacts and provenance are written to disk whenever possible so that replay audits can measure failure modes (such as hallucinated or unsupported numbers).

---

## 2. Baseline Modes (`--mode`)

The `--mode` flag sets the baseline architecture configuration. Four modes are supported:

### 2.1 `full` (Default)
* **Description:** The full BioAgent-ST autonomous system with all verification, governance, and audit mechanisms enabled.
* **Active Components:**
  - Deterministic tool execution with typed Pydantic parameter validation.
  - Runtime provenance recording (`ProvenanceStore` in SQLite).
  - Deterministic statistical checks and rule-based claim evaluation (`evidence_from_checks`).
  - Evidence ledger recording (`EvidenceStore` in SQLite).
  - Downgrade-only LLM critic node (`critic_enabled=True`).
  - Three-tier policy gate (`ALLOW`, `REVIEW`, `BLOCK`) enforcing evidence bands and confidence thresholds (`gating_enabled=True`).
  - Strict report validator failing-closed on missing evidence, unverified artifacts, or mismatched claims (`provenance_constraints_enabled=True`).

### 2.2 `tool_baseline`
* **Description:** A standard agent architecture consisting of planner + executor + tools only, omitting the verification ledger and policy gate.
* **Component Behavior:**
  - `ledger_enabled = False`: Claims may be drafted, but no formal `EvidenceRecord` entries are committed to the SQLite ledger.
  - `gating_enabled = False`: The policy gate is bypassed; the agent proceeds without checking evidence bands or intermediate quality metrics.
  - `critic_enabled = False`: No second-stage review of findings.
* **Purpose:** Quantifies the hallucination and error propagation rates of an unstructured agent executing bioinformatics pipelines without scientific guardrails.

### 2.3 `schema_baseline`
* **Description:** Adds typed Pydantic parameter schemas and plan-level structural validation to the agent, but omits claim-level verification and policy gating.
* **Component Behavior:**
  - Ensures tool calls conform to strict input signatures (preventing malformed parameters or tool invocation crashes).
  - `ledger_enabled = False`: Claims are not rule-evaluated against statistical thresholds or stored in the ledger.
  - `gating_enabled = False`: No autonomous halt or escalation on statistical degradation.
  - `critic_enabled = False`.
* **Purpose:** Demonstrates the marginal benefit of semantic/statistical verification over syntactic schema validation alone.

### 2.4 `react_baseline`
* **Description:** An iterative ReAct-style loop (Reasoning + Acting) using the same registered tools with looser step orchestration.
* **Component Behavior:**
  - Dynamic tool invocation based on intermediate observation text rather than a pre-validated analysis plan.
  - No deterministic policy gate or claim ledger.
* **Purpose:** Benchmarks against common LLM tool-use patterns that rely purely on model reasoning for execution control and stop criteria.

---

## 3. Component Ablation Flags

Ablations can be toggled individually against the `full` system or any baseline mode to measure each component's specific contribution to precision, safety, and auditability.

| CLI Flag | `AgentConfig` Attribute | Default | Semantics When Disabled |
|---|---|---|---|
| `--no-ledger` | `ledger_enabled=False` | `True` | Claims are generated in memory, but no `EvidenceRecord` is written to `ledger.db`. Report generator cannot verify claim states against the database and relies on unanchored narrative findings. |
| `--no-critic` | `critic_enabled=False` | `True` | Bypasses the LLM critic node entirely. The evidence state remains strictly equal to the deterministic `rule_state` from the rule engine. |
| `--no-gating` | `gating_enabled=False` | `True` | The policy gate returns `ALLOW` for all steps regardless of evidence bands (`low`, `medium`) or low selector confidence, preventing halts or reviews. |
| `--no-provenance-constraints` | `provenance_constraints_enabled=False` | `True` | Provenance records are still written to disk, but `validate_report()` does not fail-close on discrepancies, unverified numbers, or missing files. |

### 3.1 Detailed Ablation Semantics

#### `--no-ledger` (`ledger_enabled=False`)
* **Behavior:** The `EvidenceStore` is not initialized or written to SQLite (`output / "ledger.db"`). The analysis plan executes and produces intermediate arrays and tables, but claims do not receive persistent `evidence_id` anchors in SQLite.
* **Report Impact:** Reports are generated from in-memory records. The report validator skips SQLite database verification for findings, testing whether downstream auditability suffers when evidence persistence is lost.
* **Measured Metric:** Auditability metric (ability of an external auditor to inspect the exact statistical basis of every claim).

#### `--no-critic` (`critic_enabled=False`)
* **Behavior:** The critic node is bypassed. Every claim's final `state` is set directly to its `rule_state` (produced by the deterministic rule engine).
* **Science Rationale:** The critic is restricted by design to **downgrade only** (`supported -> plausible -> hypothesis` or any state `-> indeterminate` / `unsupported`). Bypassing the critic evaluates whether human-like scientific skepticism can catch nuances (e.g., circularity or borderline effect sizes) that deterministic rules pass.
* **Measured Metric:** Unsupported-claim rate on edge-case tasks and tasks with unstated biological assumptions.

#### `--no-gating` (`gating_enabled=False`)
* **Behavior:** When gating is disabled, intermediate check results do not trigger `BLOCK` or `REVIEW` decisions. The agent blindly continues through the entire execution plan even when data quality fails hard checks (e.g. invalid spatial coordinates, zero variance, disconnected spatial graphs).
* **Measured Metric:** Escalation appropriateness and graceful degradation on degraded or negative-control datasets (e.g. spot subsampling, gene dropout).

#### `--no-provenance-constraints` (`provenance_constraints_enabled=False`)
* **Behavior:** The report validation phase (`validate_report`) is skipped. Quantitative statements and findings in the markdown report are not cross-checked against on-disk artifact SHA-256 hashes or ledger IDs. Provenance files are still generated to permit post-hoc replay analysis.
* **Measured Metric:** Hallucination detection rate (measuring discrepancies between numbers in the narrative report and true values in the underlying AnnData or CSV artifacts).

---

## 4. CLI Usage Examples

### Running the Full System
```bash
uv run bioagent-st run-agent \
  --source synthetic \
  --question "Cluster spots and identify markers" \
  --output runs/exp_full \
  --mode full
```

### Running the Tool Baseline (No Ledger, No Gating, No Critic)
```bash
uv run bioagent-st run-agent \
  --source synthetic \
  --question "Cluster spots and identify markers" \
  --output runs/exp_tool_baseline \
  --mode tool_baseline
```

### Individual Component Ablations
```bash
# Disable only the policy gate (test robustness against bad inputs)
uv run bioagent-st run-agent \
  --source synthetic \
  --question "Find spatial patterns in degraded data" \
  --output runs/exp_no_gating \
  --no-gating

# Disable the critic (test deterministic rules alone)
uv run bioagent-st run-agent \
  --source real_dlpfc \
  --question "Identify marker genes" \
  --output runs/exp_no_critic \
  --no-critic

# Disable provenance constraints (measure report hallucinations)
uv run bioagent-st run-agent \
  --source real_dlpfc \
  --question "Assess cluster quality" \
  --output runs/exp_no_provenance \
  --no-provenance-constraints
```

---

## 5. Summary Mapping Table

| Configuration Target | `mode` | `ledger_enabled` | `critic_enabled` | `gating_enabled` | `provenance_constraints_enabled` |
|---|:---:|:---:|:---:|:---:|:---:|
| Full BioAgent-ST | `full` | `True` | `True` | `True` | `True` |
| Tool Baseline | `tool_baseline` | `False` | `False` | `False` | `False` |
| Schema Baseline | `schema_baseline` | `False` | `False` | `False` | `True` |
| ReAct Baseline | `react_baseline` | `False` | `False` | `False` | `False` |
| Ablation: No Ledger | `full` | `False` | `True` | `True` | `True` |
| Ablation: No Critic | `full` | `True` | `False` | `True` | `True` |
| Ablation: No Gating | `full` | `True` | `True` | `False` | `True` |
| Ablation: No Prov Constraints | `full` | `True` | `True` | `True` | `False` |
