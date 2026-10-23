from typing import Any, Protocol

from bioagent_st.schemas.workflows import SUPPORTED_WORKFLOWS, WORKFLOW_CONTRACTS

_DEFAULT_PARAMETERS: dict[str, dict[str, Any]] = {
    "quality_assessment": {"min_genes": 200, "min_counts": 500},
    "spatial_clustering": {"clustering": {"n_pcs": 30, "n_neighbors": 15, "resolution": 0.5}},
    "gene_expression": {"genes": ["GENE_0000"], "layer": "X"},
}


class LLMClient(Protocol):
    def generate_plan(self, question: str, context: dict[str, Any]) -> dict[str, Any]: ...


class MockLLMClient:
    def generate_plan(self, question: str, context: dict[str, Any]) -> dict[str, Any]:
        dataset_id = str(context["dataset_id"])
        workflow = str(context["workflow_id"])
        if workflow not in SUPPORTED_WORKFLOWS:
            raise ValueError(f"unsupported workflow: {workflow}")
        parameters = context.get("parameters")
        if not isinstance(parameters, dict) or not parameters:
            parameters = _DEFAULT_PARAMETERS[workflow]
        contract = WORKFLOW_CONTRACTS[workflow]
        return {
            "plan_id": "plan_mock_001",
            "research_question": question,
            "dataset_id": dataset_id,
            "steps": [
                {
                    "step_id": "step_1",
                    "tool_name": workflow,
                    "purpose": contract.validation_checks[0],
                    "parameters": parameters,
                    "input_artifact_ids": [],
                    "expected_outputs": contract.expected_artifacts,
                    "prerequisites": [],
                }
            ],
            "constraints": [
                "Do not infer causal interaction from spatial proximity.",
                "Do not interpret clusters as validated cell types.",
            ],
            "created_by_model": "mock-llm-v1",
        }
