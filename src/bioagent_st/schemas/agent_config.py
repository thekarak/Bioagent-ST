"""
schemas/agent_config.py — AgentConfig for ablation control (skill §9.4).

This is the single config object passed through the agent.  Disabling a
component must change ONLY what is documented here; no other code path may
check feature flags outside this schema.
"""

from __future__ import annotations

from typing import Literal

from pydantic import ConfigDict, Field

from bioagent_st.schemas.base import FrozenRecord


class AgentConfig(FrozenRecord):
    """
    Ablation-ready configuration for the BioAgent-ST agent.

    Defaults represent the full system (mode="full").  Ablations are encoded
    as boolean flags so any subset can be disabled independently and results
    compared against the same LLM / prompt / budget.

    See ``docs/ablations.md`` for the exact semantics of each flag.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    mode: Literal["full", "tool_baseline", "schema_baseline", "react_baseline"] = "full"

    # --- Feature flags -------------------------------------------------------
    ledger_enabled: bool = True
    """When False, claims are still generated but no EvidenceRecord is stored."""

    critic_enabled: bool = True
    """When False, the LLM critic node is bypassed; rule_state == state always."""

    gating_enabled: bool = True
    """When False, the policy gate always returns ALLOW (evidence band ignored)."""

    provenance_constraints_enabled: bool = True
    """When False, the report validator is not enforced (provenance still written)."""

    # --- Selector -------------------------------------------------------------
    selector: Literal["rules", "laya", "manual"] = "rules"
    """
    The workflow selector to use.

    * ``rules``  — deterministic keyword rules (default, always available).
    * ``laya``   — official Laya typed-decisions adapter (requires laya extra).
    * ``manual`` — explicit workflow ID passed via ``manual_workflow``.
    """

    manual_workflow: str | None = None
    """Required when selector == 'manual'."""

    # --- Reproducibility -----------------------------------------------------
    seed: int = 0
    max_retries: int = Field(2, ge=0, le=10)
    max_plan_revisions: int = Field(2, ge=0, le=5)
    step_budget: int = Field(20, ge=1, le=100)

    # --- Critic --------------------------------------------------------------
    critic_model: str | None = None
    """
    Model identifier for the LLM critic.  None means use the default provider.
    Stored in provenance for reproducibility.
    """
