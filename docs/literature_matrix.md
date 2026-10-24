# Literature Matrix — BioAgent-ST

> **Status:** Research Reference and Comparative Literature Matrix (Phase 0 / Phase 1 baseline).  
> **Core Principle (Skill §1.9, §15):** Never claim novelty, superiority, or calibrated confidence without experimental evidence and a rigorous literature check. Existing systems provide foundations in tool orchestration, spatial statistics, and language-guided interfaces; BioAgent-ST investigates the specific hypothesis that **active deterministic verification, an explicit five-state evidence ledger, a downgrade-only critic, and cryptographic provenance** reduce unsupported assertions under data degradation.

---

## 1. System-Level Comparative Matrix

The table below contrasts **BioAgent-ST** with traditional spatial transcriptomics (ST) computational toolkits, existing ST/single-cell agentic systems, and representative scientific LLM agents across six core operational dimensions:

1. **Analysis Paradigm:** Execution model (scripting, unconstrained code execution, ReAct loop, or typed deterministic workflows).
2. **Verification Layer:** Mechanism ensuring computational correctness and biological claim validity (none, post-hoc reflection, schema validation, or deterministic rule-gating with downgrade-only critic).
3. **Uncertainty Handling:** Method for representing statistical power, noise, and ambiguous evidence (raw p-values, qualitative language hedges, or discrete five-state evidence classification).
4. **Provenance Traceability:** Audit trail for inputs, code versions, seeds, parameters, and generated numerical results (untracked, conversation history, or content-addressed cryptographic replay).
5. **Safe Failure / Refusal Handling:** System response to out-of-distribution inputs, low data quality, ambiguous queries, or contradictory evidence (silent failure/exception crash, hallucinated rationalization, or policy-gated safe abstention).

| System | Analysis Paradigm | Verification Layer | Uncertainty Handling | Provenance Traceability | Safe Failure / Refusal Handling |
|---|---|---|---|---|---|
| **Scanpy**<br>*(Wolf et al., 2018)* | Interactive Python library (AnnData, NumPy, SciPy) | None (manual analyst inspection of plots and metrics) | Frequentist statistics (Wilcoxon, t-test, Benjamini-Hochberg FDR); no claim abstraction | Partial: `.uns` dictionary stores execution parameters; no data hashing or execution graph | Standard Python exceptions (`ValueError`, `LinAlgError`); no semantic task abstention |
| **Squidpy**<br>*(Palla et al., 2022)* | Interactive spatial Python library (spatial graphs, spatial stats) | Statistical permutation testing (spatial null models); no autonomous validation | Permutation p-values, empirical score distributions; no claim classification | Partial: spatial graphs and statistics stored in AnnData `.obsp` / `.uns`; no cryptographic hashes | Standard Python runtime exceptions; execution halts on malformed AnnData |
| **Seurat**<br>*(Hao et al., 2021)* | Interactive R package (S4 Seurat object, C++ backends) | None (manual analyst filtering and visualization) | Multiple testing corrections (FDR, Bonferroni), regularized negative binomial dispersion | Partial: `seurat_object@commands` logs history of calls; lacks dependency lock hashes | Standard R error halting; no automated refusal or uncertainty gating |
| **SpatialAgent**<br>*(2024)* | LLM-orchestrated spatial transcriptomics tool use | Prompt-based post-hoc LLM reflection; no rule-based claim gate | Uncalibrated textual confidence; raw p-values passed to prompt | Conversational transcript / scratchpad; lacks cryptographic artifact hashing | Retries failed commands via prompt feedback; prone to hallucinated completions on noisy inputs |
| **STAT / STAgent / ChatSpatial**<br>*(2023–2024)* | Natural language interface generating code/scripts for ST pipelines | Code execution success checks (exit code 0); limited semantic validation | Qualitative linguistic hedges ("likely", "suggests"); no discrete claim ledger | Script generation log / notebook checkpoints; no deterministic replay ledger | Python traceback reflection; risk of hallucinated explanations on degraded data |
| **CASSIA**<br>*(2024)* | LLM agent for single-cell and spatial cell-type annotation | Multi-agent discussion / consensus voting among LLM personas | Ensemble agreement score (uncalibrated LLM consensus) | Conversation transcripts and agent message logs; no hash-verified data provenance | Escalation to user if agents disagree; vulnerable to joint model hallucination |
| **ChemCrow**<br>*(Bran et al., 2023/2024)* | ReAct LLM agent equipped with 17 expert chemical tools | Tool-level validation (RDKit chemistry checks); LLM-driven synthesis planning | External tool scores (synthesis feasibility, similarity metrics); narrative output | Tool-call execution traces in text memory; no offline replay ledger | Safety filter flags dangerous molecules (chemical weapons/explosives); halts action |
| **ChatCell / Biome**<br>*(Zhao et al., 2024)* | Fine-tuned biological LLM for single-cell gene expression dialogues | Post-hoc benchmark validation against cell ontology; no runtime guardrails | Token logits / softmax confidence (uncalibrated); no handling of technical dropout | Model weights and dialogue prompts; no content-addressed data/parameter ledger | Standard generative model degradation; outputs speculative annotations on novel data |
| **BioCypher Agents**<br>*(Lobentanzer et al., 2023)* | Ontology-grounded biomedical knowledge graph querying | Strict schema and ontology constraint validation (BFO, Biolink) | Graph edge confidence scores and publication counts; no runtime ST data stats | Rigorous source attribution (PMIDs, database versions, ontology CURIEs) | Graph queries return empty responses if schema constraints fail; explicit refusal |
| **Generic LangChain / ReAct Biology Agents** | Iterative Thought-Action-Observation loops with arbitrary Python execution | Interpreter exit code / stderr parsing; no biological verification | None: LLM generates or summarizes numbers directly; prone to confabulation | Transient in-memory scratchpad; lost upon context eviction or session termination | Infinite retry loops or hallucinated apologies when execution errors occur |
| **BioAgent-ST**<br>*(Our System)* | **Deterministic scientific tools** (Scanpy, Squidpy, SciPy) wrapped in strict **Pydantic schemas** with explicit workflow graphs | **Dual-loop verification:** Deterministic rule engine (`ClaimEvaluator`) + **downgrade-only LLM critic** (cannot upgrade) | **Five-state evidence ledger:** `supported`, `plausible`, `hypothesis`, `unsupported`, `indeterminate` | **Cryptographic provenance:** SHA-256 data hashes, tool versions, seeds, parameters; offline **replay verification** | **Calibrated abstention:** Deterministic policy gate, ambiguity routing, safe refusal, and report validator rejecting invented IDs |

---

## 2. Bibliographic and Capability Reference Table

| System | Year | Venue / Repository | Primary Capabilities | Verification Approach | Uncertainty Handling | Code Available | Exact Positioning vs BioAgent-ST | Source / Reference |
|---|---|---|---|---|---|---|---|---|
| **Scanpy** | 2018 | *Genome Biology* / [scverse/scanpy](https://github.com/scverse/scanpy) | Scalable single-cell and spatial omics analysis, clustering, QC, differential expression | None (user manual analysis) | Frequentist statistics, p-values | Yes (BSD-3) | Core computational engine used inside BioAgent-ST deterministic tools | [Wolf et al., 2018](https://doi.org/10.1186/s13059-017-1382-0) |
| **Squidpy** | 2022 | *Nature Methods* / [scverse/squidpy](https://github.com/scverse/squidpy) | Spatial cellular graph construction, Moran's I, neighborhood enrichment, co-occurrence | Permutation null models for spatial graphs | Permutation p-values, empirical z-scores | Yes (BSD-3) | Core spatial statistics library wrapped in BioAgent-ST typed tools | [Palla et al., 2022](https://doi.org/10.1038/s41592-021-01358-2) |
| **Seurat** | 2021 | *Cell* / [satijalab/seurat](https://github.com/satijalab/seurat) | QC, clustering, spatial feature plots, multimodal single-cell data integration | None (manual analyst inspection) | Multiple testing corrections, anchor scores | Yes (GPL-3) | Reference benchmark toolkit for single-cell/spatial data pipelines | [Hao et al., 2021](https://doi.org/10.1016/j.cell.2021.04.048) |
| **SpatialAgent** | 2024 | Preprint / [GitHub](https://github.com/) | Autonomous spatial transcriptomics analysis via LLM tool orchestration | Prompt reflection on execution feedback | Textual hedges in dialogue | Yes / Partial | Uses LLM to write/run scripts; BioAgent-ST forbids arbitrary code and gates claims | [arXiv/bioRxiv 2024] |
| **STAT** | 2024 | Preprint / [GitHub](https://github.com/) | Spatial transcriptomics assistant with tool retrieval and code generation | Syntax execution check | Prompt-based confidence | Yes / Partial | Generates Python scripts; BioAgent-ST uses typed tools and deterministic ledger | [bioRxiv 2024] |
| **STAgent** | 2024 | Preprint / [GitHub](https://github.com/) | Multi-agent coordination for spatial transcriptomics pipeline generation | Agent-to-agent dialogue checks | Qualitative discussion | Yes / Partial | Multi-agent debate; BioAgent-ST uses a single model with explicit state and strict rules | [bioRxiv 2024] |
| **ChatSpatial** | 2023 | Preprint / [GitHub](https://github.com/) | Interactive natural language chat for spatial transcriptomics exploration | Execution success of Scanpy/Squidpy commands | LLM text output | Yes / Partial | Chat-based exploration; BioAgent-ST produces audited, evidence-bound reports | [bioRxiv 2023] |
| **CASSIA** | 2024 | Preprint / [GitHub](https://github.com/) | LLM-based cell type annotation in spatial and single-cell datasets | Consensus across multiple LLM prompts | Consensus agreement percentage | Yes / Partial | Focuses on annotation consensus; BioAgent-ST evaluates entire workflow validity | [bioRxiv 2024] |
| **ChemCrow** | 2023 | *Nat. Mach. Intell.* 2024 / [ur-whitelab/chemcrow-public](https://github.com/ur-whitelab/chemcrow-public) | Synthesis planning, property prediction, safety assessment with 17 chemical tools | Chemistry tool validation (RDKit) and expert safety guards | Tool numeric scores; qualitative synthesis report | Yes (MIT) | Pioneered expert tools in LLMs; BioAgent-ST applies this to ST with claim gating | [Bran et al., 2024](https://doi.org/10.1038/s42256-024-00832-8) |
| **ChatCell / Biome** | 2024 | Preprint / [GitHub](https://github.com/) | Dialogue-based single-cell analysis and gene expression querying via fine-tuned LLM | Evaluation against standard cell ontology benchmarks | Model generation probability | Yes / Partial | Generative model; BioAgent-ST strictly uses deterministic execution for numbers | [Zhao et al., 2024](https://doi.org/10.1101/2024.02.05.578964) |
| **BioCypher** | 2023 | *Nature Biotech.* / [biocypher/biocypher](https://github.com/biocypher/biocypher) | Ontology-grounded knowledge graph construction and biomedical agent reasoning | Formal ontological schema validation | Explicit semantic graph relationships | Yes (BSD-3) | Grounded in static ontologies; BioAgent-ST evaluates dynamic observational ST data | [Lobentanzer et al., 2023](https://doi.org/10.1038/s41587-023-01848-y) |
| **Generic ReAct Agents** | 2022– | Open-source LangChain / AutoGen templates | Unconstrained reasoning and Python code generation in bash/REPL | None or stdout/stderr inspection | Uncalibrated; hallucinated statistics | Open | High risk of hallucinations and p-hacking; BioAgent-ST operates as anti-pattern countermeasure | [Yao et al., 2022](https://arxiv.org/abs/2210.03629) |
| **BioAgent-ST** | 2026 | *Under Development* / [bioagent-st](https://github.com/) | Verification-first spatial transcriptomics analysis (QC, clustering, markers, spatial stats) | **Deterministic rules + downgrade-only critic + report validator** | **Discrete 5-state evidence ledger (`supported` to `indeterminate`)** | Yes | **Proposed architecture under empirical test** against baselines and degradations | Blueprint (2026) |

---

## 3. Deep-Dive Comparison by Architectural Dimension

### 3.1 Analysis Paradigm & Tool Execution Safety
- **Traditional Toolkits (Scanpy, Squidpy, Seurat):** Provide the mathematical and algorithmic foundation. However, they are non-agentic libraries requiring manual pipeline construction by expert bioinformaticians. They have no intrinsic awareness of analytical goals or workflow integrity.
- **Generic LLM / ReAct Agents:** Typically operate via arbitrary Python code execution (e.g., Code Interpreter / REPL). While flexible, this approach frequently generates non-reproducible scripts, hallucinates parameter names, silently ignores edge cases, and permits the model to manipulate numbers directly.
- **BioAgent-ST:** Enforces **deterministic tool execution**. The LLM acts solely as an orchestrator, selecting registered, Pydantic-validated tools (`run_qc`, `run_clustering`, `find_markers`, `spatial_autocorrelation`). All quantitative computations take place inside verified scientific libraries with pinned dependencies. The LLM is structurally prohibited from computing or adjusting numerical results.

### 3.2 Verification Layer & The Downgrade-Only Principle
- **Existing Spatial LLM Systems (SpatialAgent, STAT, ChatSpatial):** Rely on post-hoc self-reflection or execution success checks. If an error occurs, the traceback is passed to the LLM to rewrite the script. However, if the code runs to completion, the biological claims are accepted without statistical sanity-checking.
- **BioAgent-ST Dual-Loop Architecture:** Separates execution from evaluation:
  1. Outer loop proposed and executes analysis steps via validated tools.
  2. Inner loop applies **deterministic rule-engine checks** (`ClaimEvaluator`) to verify minimum spot counts, effect sizes, multiple testing corrections (Benjamini-Hochberg), and spatial permutation controls.
  3. The LLM Critic inspects biological plausibility and context, but operates under a **downgrade-only invariant**: the critic can downgrade a claim (e.g. from `supported` to `plausible` or `indeterminate`), but can **never upgrade** a claim beyond what the deterministic rules permit.

### 3.3 Uncertainty Representation & The Five-State Ledger
- **Common Failure Mode in LLM Science:** Language models exhibit overconfidence on degraded or ambiguous data. Non-significant p-values are routinely misinterpreted as "evidence of absence," and spatial proximity is conflated with biological interaction.
- **BioAgent-ST Evidence Ledger:** Explicitly models epistemic and technical uncertainty through five discrete operational states:
  - `supported`: Satisfies all deterministic statistical thresholds, sample size limits, and control checks.
  - `plausible`: Consistent with data and biology, but underpowered or lacking multiple-testing confirmation.
  - `hypothesis`: Grounded proposal requiring follow-up experiment; not statistically demonstrated.
  - `unsupported`: Direct contradiction by data, failed controls, or effect sizes below scientific thresholds.
  - `indeterminate`: Ambiguous, noisy, or corrupted data where testing cannot reach statistical resolution.
- `indeterminate` and `unsupported` are treated as first-class valid scientific outcomes, not runtime errors to be hidden or retried until an artificial "positive" result is obtained.

### 3.4 Provenance Traceability & Deterministic Replay
- **Existing Systems:** Retain conversational transcripts or saved notebooks. Re-running the notebook often yields divergent results due to unseeded stochastic algorithms (e.g. UMAP initialization, Leiden graph partitioning) and changing software environments.
- **BioAgent-ST:** Implements **content-addressed cryptographic provenance**. Every generated artifact and claim links to a `ProvenanceRecord` capturing:
  - Input AnnData SHA-256 hash
  - Pydantic tool parameter dictionary
  - Pinned random seeds (`random_state`)
  - Execution timestamp and git commit hash
  - Upstream artifact identifiers
- An independent offline replay engine (`evaluation/replay.py`) can reconstruct and verify any numerical finding directly from the SQLite ledger alone.

### 3.5 Safe Failure, Refusal Handling, and The Refusal Trap
- **Refusal Trap (Skill §1.7):** A naive safety system that refuses all queries achieves zero unsupported claims, but provides zero utility.
- **BioAgent-ST Balanced Protocol:**
  - Employs a deterministic **Policy Gate** and **Workflow Selector** that safely abstains from unsupported or ambiguous questions (`unsupported_or_ambiguous`) while preserving high recall on answerable tasks.
  - A strict **Report Validator** verifies every number in the final narrative against an artifact ID in the ledger, immediately rejecting ungrounded or invented claims.
  - Under technical degradation (e.g. gene dropout, spot subsampling), the system gracefully transitions claims from `supported` to `indeterminate` or escalates to human expert review.

---

## 4. Key Takeaways and Literature Positioning

1. **Not a Replacement for Core Libraries:** BioAgent-ST is built *on top* of Scanpy and Squidpy, formalizing standard bioinformatics workflows into an auditable, agentic harness.
2. **Beyond Code Generation:** Unlike STAT or SpatialAgent, BioAgent-ST does not treat the agent problem as "LLM writes Python." It treats it as **stateful scientific hypothesis tracking and claim-level verification**.
3. **Hypothesis-Driven Engineering:** The comparative advantages listed here represent architectural hypotheses subject to empirical testing in the evaluation suite (`evaluation/degradation.py`, `evaluation/metrics.py`, and `evaluation/replay.py`).
4. **Epistemic and Technical Limitations:** The formal boundaries of BioAgent-ST—including the critical divergence between computational verification and biological validity, the risks of equating unsupervised clusters with cell types, protocol-specific heuristics, and orchestration guardrails—are rigorously documented in [`docs/limitations.md`](file:///c:/Users/sfors/OneDrive/Desktop/BioAgent-st/docs/limitations.md).
