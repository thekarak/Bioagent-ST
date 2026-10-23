import argparse
import json
from pathlib import Path

from bioagent_st.agent_cli import run_agent
from bioagent_st.datasets import (
    REAL_DLPFC_151673_PATH,
    REAL_DLPFC_PATH,
    SYNTHETIC_PATH,
    inspect_h5ad,
)
from bioagent_st.schemas.datasets import DatasetInspection
from bioagent_st.workflow_cli import workflow_command


def inspect_command(args: argparse.Namespace) -> DatasetInspection:
    if args.source == "real_dlpfc":
        path = REAL_DLPFC_PATH
    elif args.source == "real_dlpfc_151673":
        path = REAL_DLPFC_151673_PATH
    elif args.source == "synthetic":
        path = SYNTHETIC_PATH
    else:
        if not args.dataset:
            raise ValueError("--dataset is required for source=user")
        path = Path(args.dataset)
    return inspect_h5ad(path, dataset_id=args.source)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="bioagent-st")
    subparsers = parser.add_subparsers(dest="command", required=True)
    inspect = subparsers.add_parser("inspect-dataset")
    inspect.add_argument(
        "--source",
        choices=("real_dlpfc", "real_dlpfc_151673", "synthetic", "user"),
        required=True,
    )
    inspect.add_argument("--dataset", type=Path)
    workflow = subparsers.add_parser("run-workflow")
    workflow.add_argument("workflow", choices=("qc_clustering", "markers", "spatial_statistics"))
    workflow.add_argument(
        "--source",
        choices=("real_dlpfc", "real_dlpfc_151673", "synthetic", "user"),
        default="synthetic",
    )
    workflow.add_argument("--dataset", type=Path)
    workflow.add_argument("--output", type=Path, required=True)
    agent = subparsers.add_parser("run-agent")
    agent.add_argument(
        "--source",
        choices=("real_dlpfc", "real_dlpfc_151673", "synthetic", "user"),
        required=True,
    )
    agent.add_argument("--dataset", type=Path)
    agent.add_argument("--dataset-id")
    agent.add_argument("--question", required=True)
    agent.add_argument("--experiment-id", default="experiment_local")
    agent.add_argument("--output", type=Path, required=True)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.command == "run-agent":
        run_agent(args)
    elif args.command == "run-workflow":
        workflow_command(args)
    elif args.command == "inspect-dataset":
        inspection = inspect_command(args)
        print(json.dumps(inspection.model_dump(), indent=2))
        if inspection.errors:
            raise SystemExit(2)


if __name__ == "__main__":
    main()
