from typing import Any, Protocol


class LLMClient(Protocol):
    def generate_plan(self, question: str, context: dict[str, Any]) -> dict[str, Any]: ...


class MockLLMClient:
    def generate_plan(self, question: str, context: dict[str, Any]) -> dict[str, Any]:
        dataset_id = str(context["dataset_id"])
        return {
            "plan_id": "plan_mock_001",
            "research_question": question,
            "dataset_id": dataset_id,
            "steps": [
                {
                    "step_id": "step_1",
                    "tool_name": "qc_clustering",
                    "purpose": "Assess data quality and identify expression groups.",
                    "parameters": {},
                    "input_artifact_ids": [],
                    "expected_outputs": ["qc_result", "clustering_result"],
                    "prerequisites": [],
                },
                {
                    "step_id": "step_2",
                    "tool_name": "markers",
                    "purpose": "Compute descriptive group marker statistics.",
                    "parameters": {},
                    "input_artifact_ids": [],
                    "expected_outputs": ["marker_table"],
                    "prerequisites": ["clustering_result"],
                },
                {
                    "step_id": "step_3",
                    "tool_name": "spatial_statistics",
                    "purpose": "Assess spatial graph and autocorrelation statistics.",
                    "parameters": {"n_perms": 10},
                    "input_artifact_ids": [],
                    "expected_outputs": ["spatial_statistics"],
                    "prerequisites": ["clustering_result"],
                },
            ],
            "constraints": ["Do not infer causal interaction from spatial proximity."],
            "created_by_model": "mock-llm-v1",
        }
