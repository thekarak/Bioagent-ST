# Novelty Map & Research Claims — BioAgent-ST

> **Scientific Non-Negotiable (Skill §1.9, Blueprint §2):**  
> *"Nothing is 'novel' or 'confirmed' until tested. The blueprint is a set of hypotheses. Never write text (docs, README, paper drafts, code comments) that claims novelty, superiority, or calibrated confidence without experimental evidence and a literature check."*

This document formalizes the positioning of BioAgent-ST. It establishes a rigorous boundary between **architectural design contributions**, **hypotheses currently under empirical test**, and **explicit non-claims**.

---

## 1. Architectural Contributions (System Design)

BioAgent-ST is an experimental system investigating whether automated scientific agents can be made strictly auditable, evidence-bound, and resistant to hallucinated biology. Its architectural novelty lies in the **synthesis of formal verification mechanisms with agentic orchestration**, specifically:

1. **Deterministic Scientific Execution Layer:**
   Scientific calculations (clustering, differential expression, spatial autocorrelation) are executed entirely by verified underlying libraries (Scanpy, Squidpy, SciPy, statsmodels). The LLM is restricted to planning, tool dispatching, and natural language communication; it is structurally prevented from generating, estimating, or altering numerical values.
2. **Strict Pydantic-Typed Scientific Tools:**
   All operations expose strict Pydantic schemas validating input data contracts, parameter ranges, and output models. Arbitrary Python code execution (e.g. unconstrained REPL/bash) is rejected as a default execution path.
3. **Dual-Loop Orchestration with Downgrade-Only Critic:**
   An outer Planner–Executor workflow coordinates analysis steps, while an inner Verifier–Critic loop evaluates artifacts and claims. Crucially, evidence evaluation is ruled by a deterministic state engine (`ClaimEvaluator`). An LLM Critic provides qualitative biological critique but is strictly constrained by a **downgrade-only invariant**: the critic may downgrade a claim or leave it unchanged, but can **never upgrade** a claim beyond what deterministic statistical checks permit.
4. **Structured Five-State Evidence Ledger:**
   Scientific claims are tracked in a persistent SQLite ledger with five distinct states (`supported`, `plausible`, `hypothesis`, `unsupported`, `indeterminate`). Negative, underpowered, or ambiguous findings are treated as legitimate scientific outcomes rather than execution errors.
5. **Cryptographic Provenance and Offline Replay:**
   Every artifact and claim links to a `ProvenanceRecord` containing dataset SHA-256 hashes, exact parameter sets, pinned random seeds, git commit hashes, and software library versions. The entire analytical trajectory can be replayed and verified offline without invoking an LLM.
6. **Provenance-Bound Report Validation:**
   A dedicated report validator scans final generated narratives and cross-references all cited numbers and statements against registered artifact IDs and evidence entries in the ledger. Reports containing invented, ungrounded, or unverified claims are rejected prior to user delivery.

---

## 2. Hypotheses Under Empirical Test

All performance claims in BioAgent-ST are framed as scientific hypotheses to be tested using the degradation and evaluation harness (`evaluation/degradation.py`, `evaluation/metrics.py`, and `evaluation/replay.py`).

### Hypothesis 1: Active Verification Under Data Degradation
* **Statement:** An agent architecture with active deterministic verification and a five-state evidence ledger maintains a significantly lower **unsupported-claim rate** than unverified tool-using baselines (`tool_baseline`, `react_baseline`) as spatial data undergo synthetic degradation (binomial gene dropout, spot subsampling, library-size noise).
* **Test Method:** Run full evaluation task suite across 5 degradation levels ($p \in [1.0, 0.8, 0.6, 0.4, 0.2]$) and compare the slope of unsupported claims between `full` and baselines.
* **Current Status:** **Hypothesis (Pending frozen-protocol evaluation runs)**.

### Hypothesis 2: Graceful Degradation vs. The Refusal Trap
* **Statement:** Uncertainty-gated autonomy allows the system to transition smoothly from `supported` claims to `indeterminate` or human escalation on low-power tasks, while preserving high **supported-claim recall (utility)** on clean, answerable tasks, thereby avoiding the "refusal trap" (zero utility through universal refusal).
* **Test Method:** Measure utility recall on answerable gold-standard tasks alongside escalation appropriateness on undeterminable and negative-control tasks.
* **Current Status:** **Hypothesis (Pending evaluation runs)**.

### Hypothesis 3: Auditability and Replay Fidelity
* **Statement:** Cryptographic, content-addressed provenance records enable an independent researcher to reconstruct 100% of key numerical findings and analytical decisions within numerical tolerance ($\epsilon < 10^{-5}$) using only the SQLite ledger and raw data hash.
* **Test Method:** Execute `evaluation/replay.py` across all evaluation runs, calculating the percentage of reproduced artifact hashes and numeric outputs.
* **Current Status:** **Hypothesis (Deterministic replay verified on unit test fixtures; pending benchmark dataset runs)**.

### Hypothesis 4: Downgrade-Only Critic Invariant Prevents Hallucination Creep
* **Statement:** Enforcing a downgrade-only constraint on the LLM critic significantly reduces false-positive claim promotions compared to bidirectional LLM critic architectures or self-reflection baselines.
* **Test Method:** Ablation experiment comparing the `full` system against a variant with bidirectional critic permissions (`critic_can_upgrade=True`) on planted negative-control tasks.
* **Current Status:** **Hypothesis (Ablation harness configured; pending full experimental sweep)**.

---

## 3. Differentiators Tracking Matrix

| Architectural Differentiator | Literature Precedent / Baseline Presence | Evidence Currently in Repository | Status |
|---|---|---|---|
| **Pydantic-Typed Scientific Tools** (No arbitrary code execution) | Present in ChemCrow, Toolformer; absent in most single-cell conversational agents (e.g. ChatSpatial, STAT) | Full tool registry with Pydantic parameter schemas (`src/bioagent_st/tools/`) and unit test validation | **Implemented & Unit-Tested** |
| **Five-State Claim Ledger** (`supported`, `plausible`, `hypothesis`, `unsupported`, `indeterminate`) | Distinct from binary pass/fail or single scalar confidence in existing agents | SQLite schema and state transition rules implemented (`src/bioagent_st/ledger/`); tested in `tests/unit/test_ledger.py` | **Implemented & Unit-Tested** |
| **Deterministic Rule Gating with Downgrade-Only Critic** | Absent in known literature; existing systems allow LLM to override or hallucinate validations | Rule evaluator implemented (`src/bioagent_st/verification/`); downgrade-only constraint enforced and tested | **Implemented & Unit-Tested** |
| **Provenance-Native Report Generation** (Validator rejects invented IDs) | Partially present in BioCypher (knowledge-graph sourcing); absent in spatial LLM agents | `ReportValidator` verifies artifact/evidence IDs against ledger; test suite catches hallucinated claims | **Implemented & Unit-Tested** |
| **Empirical Degradation Robustness** | Rare in LLM agent literature; standard practice in robust ST benchmark studies | Degradation pipeline (`evaluation/degradation.py`) and metric definitions implemented | **Testing in Progress** |

---

## 4. Explicit Non-Claims & Scientific Boundaries

To uphold scientific integrity and prevent scope creep, BioAgent-ST makes the following **explicit non-claims**:

1. **No Claim of Automated Cell-Type Discovery:**
   BioAgent-ST does **not** claim to autonomously identify, annotate, or discover novel cell types without human domain-expert validation. Clusters identified by Leiden or Louvain graph partitioning are mathematical groupings of transcriptional profiles, not validated biological cell types.
2. **No Claim of Biological Interaction from Spatial Proximity:**
   BioAgent-ST does **not** claim that spatial co-occurrence or nearest-neighbor enrichment demonstrates causal cell–cell communication or physical ligand-receptor signaling. Proximity is reported strictly as spatial correlation requiring experimental validation.
3. **No Claim of State-of-the-Art (SOTA) Superiority:**
   BioAgent-ST does **not** claim superiority over existing toolkits (Scanpy, Squidpy, Seurat) or agentic systems (SpatialAgent, STAT) until rigorous, pre-registered, multi-seed ablation benchmarks are executed on frozen protocols.
4. **No Claim of Calibrated Probabilistic Confidence:**
   Evidence states are discrete categorical classifications assigned by deterministic heuristics and rules. BioAgent-ST does **not** claim that evidence states represent calibrated Bayesian posterior probabilities of biological ground truth.
5. **No Claim of Universal ST Platform Invariance:**
   Different spatial transcriptomics technologies (e.g. sequencing-based 10x Visium with spot-level mixtures vs. imaging-based MERFISH/Xenium with subcellular single-molecule resolution) have fundamentally distinct noise models, diffusion characteristics, and resolution limits. BioAgent-ST does not claim unified automated analysis across platforms without platform-specific parameterizations.

---

## 5. Scientific Guardrails Enforced Across System

The following operational guardrails are codified in tool definitions, verification rules, and documentation (Skill §14):

* **Absence of Evidence is Not Evidence of Absence:** A non-significant statistical test is reported as underpowered or indeterminate, never as proof that a biological phenomenon does not exist.
* **Circularity Flagging:** Marker genes derived from clusters that were themselves defined by those same marker genes are flagged as circular descriptive associations.
* **Visualization is Not Evidence:** Dimension reduction plots (UMAP, t-SNE) are treated strictly as qualitative visualizations and are prohibited from being cited as quantitative evidence.
* **Multiple Testing Correction:** All high-dimensional gene tests must report effect sizes (log fold change) alongside adjusted p-values (Benjamini-Hochberg FDR).
* **Transparent Method Limitations:** Every analysis report is programmatically required to enumerate the assumptions, limitations, and failure modes of the utilized algorithms.
