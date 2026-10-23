from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class ThresholdConfig:
    values: dict[str, Any]
    provisional: bool

    def get(self, section: str, key: str, default: Any = None) -> Any:
        section_values = self.values.get(section, {})
        return section_values.get(key, default)


def load_thresholds(path: str | Path = "configs/thresholds.yaml") -> ThresholdConfig:
    source = Path(path)
    if not source.exists():
        raise FileNotFoundError(f"threshold config not found: {source}")
    values = yaml.safe_load(source.read_text(encoding="utf-8")) or {}
    return ThresholdConfig(values=values, provisional=bool(values.get("provisional", True)))
