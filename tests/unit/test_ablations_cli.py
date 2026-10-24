import argparse
from pathlib import Path

from bioagent_st.agent_cli import build_agent_config, run_agent
from bioagent_st.cli import build_parser
from bioagent_st.schemas.agent_config import AgentConfig


def test_cli_parser_defaults() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "run-agent",
            "--source",
            "synthetic",
            "--question",
            "Cluster spots",
            "--output",
            "runs/test",
        ]
    )
    assert args.mode == "full"
    assert not args.no_ledger
    assert not args.no_critic
    assert not args.no_gating
    assert not args.no_provenance_constraints

    config = build_agent_config(args)
    assert config.mode == "full"
    assert config.ledger_enabled is True
    assert config.critic_enabled is True
    assert config.gating_enabled is True
    assert config.provenance_constraints_enabled is True


def test_cli_parser_ablation_flags() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "run-agent",
            "--source",
            "synthetic",
            "--question",
            "Cluster spots",
            "--output",
            "runs/test",
            "--no-ledger",
            "--no-critic",
            "--no-gating",
            "--no-provenance-constraints",
        ]
    )
    assert args.no_ledger is True
    assert args.no_critic is True
    assert args.no_gating is True
    assert args.no_provenance_constraints is True

    config = build_agent_config(args)
    assert config.mode == "full"
    assert config.ledger_enabled is False
    assert config.critic_enabled is False
    assert config.gating_enabled is False
    assert config.provenance_constraints_enabled is False


def test_cli_parser_baseline_modes() -> None:
    parser = build_parser()
    for mode in ("tool_baseline", "schema_baseline", "react_baseline"):
        args = parser.parse_args(
            [
                "run-agent",
                "--source",
                "synthetic",
                "--question",
                "Cluster spots",
                "--output",
                "runs/test",
                "--mode",
                mode,
            ]
        )
        assert args.mode == mode
        config = build_agent_config(args)
        assert config.mode == mode
        assert config.ledger_enabled is False
        assert config.critic_enabled is False
        assert config.gating_enabled is False
        assert config.provenance_constraints_enabled is True


def test_run_agent_with_no_ledger_and_no_provenance(tmp_path: Path) -> None:
    args = argparse.Namespace(
        source="synthetic",
        dataset=None,
        dataset_id="synthetic",
        question="assess quality",
        experiment_id="exp_test",
        output=str(tmp_path / "exp_out"),
        selector="rules",
        workflow=None,
        genes=None,
        layer="X",
        params_json=None,
        mode="full",
        no_ledger=True,
        no_critic=True,
        no_gating=True,
        no_provenance_constraints=True,
    )
    config = build_agent_config(args)
    assert isinstance(config, AgentConfig)
    assert config.ledger_enabled is False
    assert config.provenance_constraints_enabled is False

    # Should run smoothly without failing on ledger or report validation
    run_agent(args, config=config)
    assert (tmp_path / "exp_out" / "report.md").exists()
