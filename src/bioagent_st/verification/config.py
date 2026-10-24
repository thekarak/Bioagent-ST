from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

import yaml

if TYPE_CHECKING:
    from bioagent_st.verification.policy_gate import GateConfig


@dataclass(frozen=True)
class ThresholdConfig:
    values: dict[str, Any]
    provisional: bool
    science_reviewer: str | None = None
    last_reviewed: str | None = None

    def get(self, section: str, key: str, default: Any = None) -> Any:
        section_values = self.values.get(section, {})
        return section_values.get(key, default)

    def to_gate_config(self) -> "GateConfig":
        """Convert policy_gate section of threshold configuration into GateConfig."""
        from bioagent_st.verification.policy_gate import GateConfig

        return GateConfig.from_thresholds(self)


def load_thresholds(path: str | Path = "configs/thresholds.yaml") -> ThresholdConfig:
    source = Path(path)
    if not source.exists():
        raise FileNotFoundError(f"threshold config not found: {source}")
    values = yaml.safe_load(source.read_text(encoding="utf-8")) or {}
    return ThresholdConfig(
        values=values,
        provisional=bool(values.get("provisional", True)),
        science_reviewer=values.get("science_reviewer"),
        last_reviewed=values.get("last_reviewed"),
    )
