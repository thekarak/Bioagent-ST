"""
schemas/registry.py — Workflow registry with enum-only labels.

This is the single source of truth for which workflow IDs are valid,
what their contracts are, and which executor function handles them.
Importing from this module (not from ad-hoc dicts) guarantees that
a typo in a workflow ID fails loudly at import time.
"""

from __future__ import annotations

from collections.abc import Callable

from pydantic import BaseModel, ConfigDict, Field

from bioagent_st.schemas.workflows import (
    SUPPORTED_WORKFLOWS,
    WORKFLOW_CONTRACTS,
    EvidenceContract,
    SupportedWorkflowId,
)

# ---------------------------------------------------------------------------
# Tool spec (kept for backward compatibility with existing code)
# ---------------------------------------------------------------------------


class ToolSpec(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    name: str
    version: str
    params_model: type[BaseModel]
    prerequisites: list[str] = Field(default_factory=list)
    supported_modalities: list[str] = Field(default_factory=list)
    output_artifact_types: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Workflow registry — enum-only labels enforced at lookup time
# ---------------------------------------------------------------------------


class WorkflowRegistry:
    """
    Immutable registry mapping ``SupportedWorkflowId`` → ``EvidenceContract``.

    Design decisions
    ----------------
    * Only IDs present in ``SUPPORTED_WORKFLOWS`` (the Literal type) are
      registered.  Any other string raises ``KeyError`` at look-up time,
      never silently produces a wrong result.
    * Executors are registered separately (optional) so the registry can be
      used in contexts where tool functions are not yet available.
    """

    def __init__(self) -> None:
        self._contracts: dict[SupportedWorkflowId, EvidenceContract] = dict(WORKFLOW_CONTRACTS)
        self._executors: dict[SupportedWorkflowId, Callable[..., object]] = {}

    # ------------------------------------------------------------------
    # Contract access
    # ------------------------------------------------------------------

    def contract(self, workflow_id: SupportedWorkflowId) -> EvidenceContract:
        """Return the evidence contract for a registered workflow."""
        if workflow_id not in self._contracts:
            raise KeyError(
                f"'{workflow_id}' is not a registered workflow.  "
                f"Supported IDs: {sorted(self._contracts)}"
            )
        return self._contracts[workflow_id]

    def all_contracts(self) -> dict[SupportedWorkflowId, EvidenceContract]:
        return dict(self._contracts)

    # ------------------------------------------------------------------
    # Executor registration (optional)
    # ------------------------------------------------------------------

    def register_executor(
        self,
        workflow_id: SupportedWorkflowId,
        fn: Callable[..., object],
    ) -> None:
        """Associate a callable executor with a workflow ID."""
        if workflow_id not in self._contracts:
            raise KeyError(f"Cannot register executor for unknown workflow '{workflow_id}'")
        self._executors[workflow_id] = fn

    def executor(self, workflow_id: SupportedWorkflowId) -> Callable[..., object]:
        """Return the registered executor; raises KeyError if not registered."""
        if workflow_id not in self._executors:
            raise KeyError(
                f"No executor registered for '{workflow_id}'.  "
                "Call register_executor() before dispatching."
            )
        return self._executors[workflow_id]

    # ------------------------------------------------------------------
    # Validation helpers
    # ------------------------------------------------------------------

    def is_supported(self, workflow_id: str) -> bool:
        """Return True iff *workflow_id* is in the registry."""
        return workflow_id in self._contracts

    def assert_supported(self, workflow_id: str) -> SupportedWorkflowId:
        """
        Validate *workflow_id* is a registered enum label and return it typed.

        Raises
        ------
        ValueError
            If *workflow_id* is not a registered label.
        """
        if not self.is_supported(workflow_id):
            raise ValueError(
                f"'{workflow_id}' is not a supported workflow ID.  "
                f"Allowed values: {sorted(self._contracts)}"
            )
        return workflow_id  # type: ignore[return-value]

    def workflow_ids(self) -> tuple[SupportedWorkflowId, ...]:
        return SUPPORTED_WORKFLOWS

    def __repr__(self) -> str:
        ids = ", ".join(sorted(self._contracts))
        return f"WorkflowRegistry(workflows=[{ids}])"


# ---------------------------------------------------------------------------
# Module-level singleton — use this in all non-test code
# ---------------------------------------------------------------------------

REGISTRY = WorkflowRegistry()
