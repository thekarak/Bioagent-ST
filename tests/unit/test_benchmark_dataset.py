"""Unit tests for the curated routing benchmark datasets."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import pytest

# Ensure scripts/ is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "scripts"))
import evaluate_routing as harness

from bioagent_st.schemas.workflows import WorkflowId

BENCHMARK_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "benchmark"
EVAL_75_PATH = BENCHMARK_DIR / "routing_eval_75.json"
DUAL_25_PATH = BENCHMARK_DIR / "routing_dual_annotated_25.json"

ALL_WORKFLOW_IDS = set(harness.ALL_WORKFLOW_CLASSES)

EXPECTED_CATEGORIES = {
    "quality",
    "clustering",
    "expression",
    "abstention_clinical",
    "abstention_cell_type",
    "abstention_adversarial",
    "abstention_out_of_scope",
    "abstention_ambiguous",
}


class TestRoutingBenchmark75Schema:
    """Verifies that data/benchmark/routing_eval_75.json is frozen and valid."""

    @pytest.fixture(scope="module")
    def benchmark_75(self) -> list[dict]:
        assert EVAL_75_PATH.is_file(), f"File missing: {EVAL_75_PATH}"
        with open(EVAL_75_PATH, encoding="utf-8") as f:
            data = json.load(f)
        assert isinstance(data, list)
        return data

    def test_total_count(self, benchmark_75: list[dict]) -> None:
        assert len(benchmark_75) == 75

    def test_item_schema(self, benchmark_75: list[dict]) -> None:
        required_keys = {"id", "query", "gold_label", "category", "rationale"}
        for item in benchmark_75:
            assert set(item.keys()) == required_keys, f"Malformed item keys: {item}"
            assert isinstance(item["id"], str) and re.match(r"^query_\d{2}$", item["id"])
            assert isinstance(item["query"], str) and len(item["query"].strip()) > 5
            assert isinstance(item["gold_label"], str)
            assert item["gold_label"] in ALL_WORKFLOW_IDS
            assert isinstance(item["category"], str)
            assert item["category"] in EXPECTED_CATEGORIES
            assert isinstance(item["rationale"], str) and len(item["rationale"].strip()) > 10

    def test_unique_ids_and_queries(self, benchmark_75: list[dict]) -> None:
        ids = [item["id"] for item in benchmark_75]
        assert len(ids) == len(set(ids)), "Duplicate query IDs detected"

        queries = [item["query"] for item in benchmark_75]
        assert len(queries) == len(set(queries)), "Duplicate query strings detected"

    def test_class_balance(self, benchmark_75: list[dict]) -> None:
        counts: dict[WorkflowId, int] = {}
        for item in benchmark_75:
            label = item["gold_label"]
            counts[label] = counts.get(label, 0) + 1

        assert counts["quality_assessment"] == 15
        assert counts["spatial_clustering"] == 15
        assert counts["gene_expression"] == 15
        assert counts["unsupported_or_ambiguous"] == 30
        assert sum(counts.values()) == 75


class TestRoutingDualAnnotated25Schema:
    """Verifies the dual-annotation dataset and inter-annotator agreement."""

    @pytest.fixture(scope="module")
    def dual_data(self) -> dict:
        assert DUAL_25_PATH.is_file(), f"File missing: {DUAL_25_PATH}"
        with open(DUAL_25_PATH, encoding="utf-8") as f:
            data = json.load(f)
        assert isinstance(data, dict)
        return data

    def test_metadata_structure(self, dual_data: dict) -> None:
        meta = dual_data.get("benchmark_metadata")
        assert meta is not None
        assert meta.get("subset_size") == 25
        assert len(meta.get("annotators", [])) == 2

        metrics = meta.get("metrics", {})
        assert metrics.get("total_queries") == 25
        assert metrics.get("agreements") == 23
        assert metrics.get("disagreements") == 2
        assert metrics.get("percent_agreement") == 92.0
        assert metrics.get("cohens_kappa") > 0.80  # Almost Perfect Agreement

    def test_annotations_schema(self, dual_data: dict) -> None:
        annotations = dual_data.get("annotations", [])
        assert len(annotations) == 25

        for entry in annotations:
            assert "id" in entry
            assert "query" in entry
            assert "category" in entry
            assert "annotator_1" in entry
            assert "annotator_2" in entry
            assert "agreement" in entry
            assert "consensus_label" in entry
            assert "consensus_rationale" in entry

            a1 = entry["annotator_1"]
            a2 = entry["annotator_2"]
            assert a1["label"] in ALL_WORKFLOW_IDS
            assert a2["label"] in ALL_WORKFLOW_IDS
            assert entry["consensus_label"] in ALL_WORKFLOW_IDS
            assert isinstance(entry["agreement"], bool)
            assert entry["agreement"] == (a1["label"] == a2["label"])

    def test_disagreement_consensus_cases(self, dual_data: dict) -> None:
        """Verifies that the two documented edge cases were resolved properly."""
        annotations = {entry["id"]: entry for entry in dual_data.get("annotations", [])}

        # Query 48: Cell type deconvolution
        q48 = annotations.get("query_48")
        assert q48 is not None
        assert not q48["agreement"]
        assert q48["annotator_1"]["label"] == "unsupported_or_ambiguous"
        assert q48["annotator_2"]["label"] == "spatial_clustering"
        assert q48["consensus_label"] == "unsupported_or_ambiguous"

        # Query 69: Compound QC + Clustering
        q69 = annotations.get("query_69")
        assert q69 is not None
        assert not q69["agreement"]
        assert q69["annotator_1"]["label"] == "unsupported_or_ambiguous"
        assert q69["annotator_2"]["label"] == "quality_assessment"
        assert q69["consensus_label"] == "unsupported_or_ambiguous"


class TestHarnessDataLoader:
    """Verifies that scripts/evaluate_routing.py loads the frozen benchmark."""

    def test_load_routing_benchmark_loads_75_cases(self) -> None:
        benchmark = harness.load_routing_benchmark()
        assert len(benchmark) == 75
        first = benchmark[0]
        assert first.id == "query_01"
        assert first.question == "Assess the quality and schema of this dataset"
        assert first.expected == "quality_assessment"
        assert first.category == "quality"
        assert len(first.rationale) > 0

    def test_load_routing_benchmark_fallback_on_missing_file(self, tmp_path: Path) -> None:
        non_existent = tmp_path / "does_not_exist.json"
        benchmark = harness.load_routing_benchmark(non_existent)
        assert len(benchmark) == len(harness.ROUTING_BENCHMARK)
        assert benchmark == harness.ROUTING_BENCHMARK
