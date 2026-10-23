"""Rules vs Laya routing evaluation harness.

Evaluates workflow selectors (deterministic keyword rules vs Laya LLM router)
on a standardized benchmark of spatial transcriptomics queries, measuring:
- Accuracy: correctness against ground truth (including appropriate abstentions)
- Abstention rate: frequency of returning 'unsupported_or_ambiguous'
- Latency: execution time statistics (mean, median, p95 ms)
- Error rate: unexpected runtime exceptions or malformed outputs
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
from dataclasses import asdict, dataclass, field
from typing import Any

from bioagent_st.routing import (
    LayaPredictor,
    LayaSelector,
    RuleSelector,
    WorkflowSelector,
)
from bioagent_st.schemas.workflows import (
    SelectorDecision,
    WorkflowId,
)


@dataclass(frozen=True)
class BenchmarkCase:
    question: str
    expected: WorkflowId
    category: str


ROUTING_BENCHMARK: tuple[BenchmarkCase, ...] = (
    # Quality assessment
    BenchmarkCase(
        question="Assess the quality and schema of this dataset",
        expected="quality_assessment",
        category="quality",
    ),
    BenchmarkCase(
        question="Inspect dataset dimensions, sequencing depth, and missing spatial coordinates",
        expected="quality_assessment",
        category="quality",
    ),
    BenchmarkCase(
        question="Run QC filtering and check mitochondrial count fractions",
        expected="quality_assessment",
        category="quality",
    ),
    BenchmarkCase(
        question="Check the dataset structure and validate required obs fields",
        expected="quality_assessment",
        category="quality",
    ),
    # Spatial clustering
    BenchmarkCase(
        question="Identify spatial domains based on expression patterns",
        expected="spatial_clustering",
        category="clustering",
    ),
    BenchmarkCase(
        question="Run Leiden clustering and project spots onto a UMAP embedding",
        expected="spatial_clustering",
        category="clustering",
    ),
    BenchmarkCase(
        question="Group spots into spatial clusters using the neighborhood graph",
        expected="spatial_clustering",
        category="clustering",
    ),
    BenchmarkCase(
        question="Segment tissue regions by spatial domain structure",
        expected="spatial_clustering",
        category="clustering",
    ),
    # Gene expression
    BenchmarkCase(
        question="Show spatial expression of GENE_0000 across the tissue",
        expected="gene_expression",
        category="expression",
    ),
    BenchmarkCase(
        question="Plot the spatial expression level of marker gene ERBB2",
        expected="gene_expression",
        category="expression",
    ),
    BenchmarkCase(
        question="Where is transcript GFAP expressed in this tissue slice?",
        expected="gene_expression",
        category="expression",
    ),
    BenchmarkCase(
        question="Generate a feature plot for gene expression of SNAP25",
        expected="gene_expression",
        category="expression",
    ),
    # Out of scope / Ambiguous / Adversarial (abstention expected)
    BenchmarkCase(
        question="Tell me about this dataset",
        expected="unsupported_or_ambiguous",
        category="abstention",
    ),
    BenchmarkCase(
        question="Cluster quality and show gene markers",
        expected="unsupported_or_ambiguous",
        category="abstention",
    ),
    BenchmarkCase(
        question="Predict patient overall survival and chemotherapy response from spatial data",
        expected="unsupported_or_ambiguous",
        category="abstention",
    ),
    BenchmarkCase(
        question="Identify cell types and validate cell identities automatically",
        expected="unsupported_or_ambiguous",
        category="abstention",
    ),
)


class FakeBenchmarkPredictor(LayaPredictor):
    """Deterministic mock predictor for CI and reproducible evaluation."""

    def __init__(self, simulated_latency_ms: float = 12.0) -> None:
        self.simulated_latency_ms = simulated_latency_ms

    def predict(
        self, state: str, questions: dict[str, Any], *, model: str | None = None
    ) -> dict[str, Any]:
        del questions, model
        time.sleep(self.simulated_latency_ms / 1000.0)
        norm = state.lower()

        # Simulated routing logic mirroring trained Laya behavior
        if any(
            term in norm
            for term in ("quality", "qc", "schema", "depth", "structure", "mitochondrial")
        ):
            if "cluster" in norm:
                # Conflicting signals -> abstain
                return {
                    "answers": {
                        "workflow": {"choice": "unsupported_or_ambiguous", "confidence": 0.45}
                    }
                }
            return {
                "answers": {
                    "workflow": {
                        "choice": "quality_assessment",
                        "confidence": 0.94,
                        "probabilities": {
                            "quality_assessment": 0.94,
                            "spatial_clustering": 0.03,
                            "gene_expression": 0.02,
                            "unsupported_or_ambiguous": 0.01,
                        },
                    }
                }
            }

        if any(term in norm for term in ("cluster", "domains", "leiden", "umap", "segment")):
            return {
                "answers": {
                    "workflow": {
                        "choice": "spatial_clustering",
                        "confidence": 0.92,
                        "probabilities": {
                            "spatial_clustering": 0.92,
                            "gene_expression": 0.04,
                            "quality_assessment": 0.02,
                            "unsupported_or_ambiguous": 0.02,
                        },
                    }
                }
            }

        if any(
            term in norm for term in ("expression", "gene", "transcript", "marker", "feature plot")
        ):
            return {
                "answers": {
                    "workflow": {
                        "choice": "gene_expression",
                        "confidence": 0.96,
                        "probabilities": {
                            "gene_expression": 0.96,
                            "spatial_clustering": 0.02,
                            "quality_assessment": 0.01,
                            "unsupported_or_ambiguous": 0.01,
                        },
                    }
                }
            }

        # Out-of-scope / adversarial
        return {
            "answers": {
                "workflow": {
                    "choice": "unsupported_or_ambiguous",
                    "confidence": 0.88,
                    "probabilities": {
                        "unsupported_or_ambiguous": 0.88,
                        "spatial_clustering": 0.04,
                        "gene_expression": 0.04,
                        "quality_assessment": 0.04,
                    },
                }
            }
        }


@dataclass
class EvaluationSummary:
    selector_name: str
    total_queries: int
    correct: int
    accuracy: float
    abstentions: int
    abstention_rate: float
    error_count: int
    latencies_ms: list[float] = field(default_factory=list)
    mean_latency_ms: float = 0.0
    median_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    details: list[dict[str, Any]] = field(default_factory=list)

    def compute_stats(self) -> None:
        if self.total_queries > 0:
            self.accuracy = self.correct / self.total_queries
            self.abstention_rate = self.abstentions / self.total_queries
        if self.latencies_ms:
            sorted_lat = sorted(self.latencies_ms)
            self.mean_latency_ms = statistics.mean(sorted_lat)
            self.median_latency_ms = statistics.median(sorted_lat)
            p95_idx = int(0.95 * len(sorted_lat))
            self.p95_latency_ms = sorted_lat[min(p95_idx, len(sorted_lat) - 1)]


def evaluate_selector(
    selector: WorkflowSelector,
    benchmark: tuple[BenchmarkCase, ...] = ROUTING_BENCHMARK,
    name: str = "selector",
) -> EvaluationSummary:
    summary = EvaluationSummary(
        selector_name=name,
        total_queries=len(benchmark),
        correct=0,
        accuracy=0.0,
        abstentions=0,
        abstention_rate=0.0,
        error_count=0,
    )

    for case in benchmark:
        started = time.perf_counter()
        error_msg = None
        decision: SelectorDecision | None = None
        try:
            decision = selector.select(case.question)
        except Exception as exc:
            summary.error_count += 1
            error_msg = f"{type(exc).__name__}: {exc}"

        elapsed_ms = (time.perf_counter() - started) * 1000.0
        summary.latencies_ms.append(elapsed_ms)

        predicted_choice: str = decision.decision if decision else "error"
        is_abstention = predicted_choice == "unsupported_or_ambiguous"
        if is_abstention:
            summary.abstentions += 1

        is_correct = predicted_choice == case.expected
        if is_correct:
            summary.correct += 1

        summary.details.append(
            {
                "question": case.question,
                "category": case.category,
                "expected": case.expected,
                "predicted": predicted_choice,
                "correct": is_correct,
                "abstention": is_abstention,
                "latency_ms": round(elapsed_ms, 2),
                "error": error_msg,
            }
        )

    summary.compute_stats()
    return summary


def run_evaluation_harness(
    use_real_laya: bool = False,
    benchmark: tuple[BenchmarkCase, ...] = ROUTING_BENCHMARK,
) -> dict[str, EvaluationSummary]:
    rules_selector = RuleSelector()
    rules_summary = evaluate_selector(rules_selector, benchmark, name="Deterministic Rules")

    if use_real_laya:
        laya_selector = LayaSelector(fallback_to_rules=False)
        laya_summary = evaluate_selector(laya_selector, benchmark, name="Laya Model (Real)")
    else:
        fake_predictor = FakeBenchmarkPredictor()
        laya_selector = LayaSelector(predictor=fake_predictor, fallback_to_rules=False)
        laya_summary = evaluate_selector(laya_selector, benchmark, name="Laya Router (Mock CI)")

    return {
        "rules": rules_summary,
        "laya": laya_summary,
    }


def format_markdown_report(results: dict[str, EvaluationSummary]) -> str:
    lines = [
        "# Rules vs Laya Router Evaluation Report",
        "",
        "| Metric | Deterministic Rules | Laya Router |",
        "|---|---|---|",
    ]
    rules = results["rules"]
    laya = results["laya"]

    lines.append(f"| **Total Queries** | {rules.total_queries} | {laya.total_queries} |")
    lines.append(f"| **Correct** | {rules.correct} | {laya.correct} |")
    lines.append(f"| **Accuracy** | {rules.accuracy:.1%} | {laya.accuracy:.1%} |")
    lines.append(f"| **Abstentions** | {rules.abstentions} | {laya.abstentions} |")
    lines.append(
        f"| **Abstention Rate** | {rules.abstention_rate:.1%} | {laya.abstention_rate:.1%} |"
    )
    r_mean, l_mean = rules.mean_latency_ms, laya.mean_latency_ms
    r_med, l_med = rules.median_latency_ms, laya.median_latency_ms
    r_p95, l_p95 = rules.p95_latency_ms, laya.p95_latency_ms
    lines.append(f"| **Errors** | {rules.error_count} | {laya.error_count} |")
    lines.append(f"| **Mean Latency** | {r_mean:.2f} ms | {l_mean:.2f} ms |")
    lines.append(f"| **Median Latency** | {r_med:.2f} ms | {l_med:.2f} ms |")
    lines.append(f"| **P95 Latency** | {r_p95:.2f} ms | {l_p95:.2f} ms |")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate Deterministic Rules vs Laya Router")
    parser.add_argument("--real", action="store_true", help="Run with real Laya model")
    parser.add_argument(
        "--format", choices=["markdown", "json"], default="markdown", help="Output format"
    )
    parser.add_argument("--output", type=str, default=None, help="Output file path")
    args = parser.parse_args()

    results = run_evaluation_harness(use_real_laya=args.real)

    if args.format == "json":
        payload = {key: asdict(summary) for key, summary in results.items()}
        output_text = json.dumps(payload, indent=2)
    else:
        output_text = format_markdown_report(results)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output_text)
        print(f"Report written to {args.output}")
    else:
        print(output_text)


if __name__ == "__main__":
    main()
