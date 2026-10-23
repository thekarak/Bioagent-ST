"""Unit tests for schemas/registry.py WorkflowRegistry."""

from __future__ import annotations

import pytest

from bioagent_st.schemas.registry import REGISTRY, WorkflowRegistry
from bioagent_st.schemas.workflows import SUPPORTED_WORKFLOWS


class TestWorkflowRegistry:
    def test_all_supported_workflows_registered(self) -> None:
        for wid in SUPPORTED_WORKFLOWS:
            contract = REGISTRY.contract(wid)
            assert contract.workflow == wid

    def test_unknown_workflow_raises_key_error(self) -> None:
        with pytest.raises(KeyError, match="not a registered"):
            REGISTRY.contract("cell_type_annotation")  # type: ignore[arg-type]

    def test_is_supported_true_for_all_registered(self) -> None:
        for wid in SUPPORTED_WORKFLOWS:
            assert REGISTRY.is_supported(wid)

    def test_is_supported_false_for_unknown(self) -> None:
        assert not REGISTRY.is_supported("novelty_discovery")

    def test_assert_supported_returns_typed_id(self) -> None:
        wid = REGISTRY.assert_supported("quality_assessment")
        assert wid == "quality_assessment"

    def test_assert_supported_raises_for_unknown(self) -> None:
        with pytest.raises(ValueError, match="not a supported"):
            REGISTRY.assert_supported("random_workflow")

    def test_all_contracts_returns_dict_of_all_workflows(self) -> None:
        contracts = REGISTRY.all_contracts()
        assert set(contracts.keys()) == set(SUPPORTED_WORKFLOWS)

    def test_workflow_ids_matches_supported_workflows(self) -> None:
        assert set(REGISTRY.workflow_ids()) == set(SUPPORTED_WORKFLOWS)

    def test_executor_registration_and_lookup(self) -> None:
        reg = WorkflowRegistry()

        def fake_executor(*args: object, **kwargs: object) -> str:
            return "ok"

        reg.register_executor("quality_assessment", fake_executor)
        fn = reg.executor("quality_assessment")
        assert fn() == "ok"

    def test_executor_raises_for_unregistered(self) -> None:
        reg = WorkflowRegistry()
        with pytest.raises(KeyError, match="No executor registered"):
            reg.executor("spatial_clustering")

    def test_register_executor_raises_for_unknown_workflow(self) -> None:
        reg = WorkflowRegistry()
        with pytest.raises(KeyError, match="Cannot register executor"):
            reg.register_executor("bad_workflow", lambda: None)  # type: ignore[arg-type]

    def test_repr_contains_workflow_ids(self) -> None:
        r = repr(REGISTRY)
        assert "quality_assessment" in r
        assert "spatial_clustering" in r
        assert "gene_expression" in r
