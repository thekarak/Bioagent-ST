import re
import time
from typing import Any, Protocol

from bioagent_st.schemas.workflows import (
    SUPPORTED_WORKFLOWS,
    SelectorDecision,
    SelectorKind,
    SupportedWorkflowId,
    WorkflowId,
)

_NORMALIZE = re.compile(r"\s+")


class SelectorError(RuntimeError):
    pass


class WorkflowSelector(Protocol):
    def select(self, question: str) -> SelectorDecision: ...


class LayaPredictor(Protocol):
    def predict(
        self, state: str, questions: dict[str, Any], *, model: str | None = None
    ) -> dict[str, Any]: ...


_EXPLICIT_ABSTAIN_PATTERNS: tuple[str, ...] = (
    r"\b(ignore|override|bypass)\b.*\b(instructions?|rules?|system|prompt)\b",
    r"\b(admin|root|sudo|system access)\b",
    r"\b(do not|don'?t|never|stop|abort)\b",
    r"\b(cell type|cell types|cell identity|cell identities)\b",
    r"\b(survival|prognosis|chemotherapy|clinical|patient outcome)\b",
    r"\b(hospital|weather|flight|restaurant|stock price)\b",
)

_RULES: dict[SupportedWorkflowId, tuple[str, ...]] = {
    "quality_assessment": (
        "quality",
        "qc",
        "validate",
        "validation",
        "inspect",
        "schema",
        "dimension",
        "dimensions",
        "structure",
        "missing field",
        "missing fields",
        "quality control",
        "assess",
        "check the dataset",
    ),
    "spatial_clustering": (
        "cluster",
        "clustering",
        "clusters",
        "spatial domains",
        "expression patterns",
        "leiden",
        "umap",
        "neighborhood graph",
        "regions",
        "segment",
        "group spots",
        "spatial organization",
    ),
    "gene_expression": (
        "gene",
        "genes",
        "expression of",
        "spatial expression",
        "marker",
        "markers",
        "expressed",
        "feature plot",
        "expression map",
        "expression level",
        "transcript",
        "transcripts",
    ),
}


def normalize_question(question: str) -> str:
    return _NORMALIZE.sub(" ", question.strip().lower())


def _signal_matches(signal: str, normalized: str) -> bool:
    pattern = r"\b" + re.escape(signal) + r"\b"
    return bool(re.search(pattern, normalized))


def select_by_rules(question: str) -> SelectorDecision:
    normalized = normalize_question(question)
    if not normalized:
        return SelectorDecision(
            kind="rules",
            name="Deterministic rules",
            version="rules-v1",
            decision="unsupported_or_ambiguous",
            matched_signals=[],
            normalized_intent=None,
            notes="Empty question; selector abstains.",
        )

    for pattern in _EXPLICIT_ABSTAIN_PATTERNS:
        if re.search(pattern, normalized):
            return SelectorDecision(
                kind="rules",
                name="Deterministic rules",
                version="rules-v1",
                decision="unsupported_or_ambiguous",
                matched_signals=[],
                normalized_intent=normalized,
                notes="Request triggered safety/abstention rule; execution blocked.",
            )

    matches: list[tuple[SupportedWorkflowId, tuple[str, ...]]] = []
    for workflow, signals in _RULES.items():
        hits = tuple(signal for signal in signals if _signal_matches(signal, normalized))
        if hits:
            matches.append((workflow, hits))
    if not matches:
        return SelectorDecision(
            kind="rules",
            name="Deterministic rules",
            version="rules-v1",
            decision="unsupported_or_ambiguous",
            matched_signals=[],
            normalized_intent=normalized or None,
            notes="No approved workflow matched the request; execution is blocked.",
        )
    matches.sort(key=lambda item: len(item[1]), reverse=True)
    best = matches[0]
    if len(matches) > 1 and len(matches[1][1]) == len(best[1]):
        return SelectorDecision(
            kind="rules",
            name="Deterministic rules",
            version="rules-v1",
            decision="unsupported_or_ambiguous",
            matched_signals=[*best[1], *matches[1][1]],
            normalized_intent=normalized or None,
            notes="Two workflows matched with equal strength; the selector abstains for review.",
        )
    return SelectorDecision(
        kind="rules",
        name="Deterministic rules",
        version="rules-v1",
        decision=best[0],
        matched_signals=list(best[1]),
        normalized_intent=normalized or None,
        notes="Transparent keyword rules evaluated locally.",
    )


class RuleSelector:
    def select(self, question: str) -> SelectorDecision:
        return select_by_rules(question)


class ManualSelector:
    def __init__(self, workflow: WorkflowId) -> None:
        self.workflow = workflow

    def select(self, question: str) -> SelectorDecision:
        return SelectorDecision(
            kind="manual",
            name="Manual selection",
            version="manual-v1",
            decision=self.workflow,
            normalized_intent=normalize_question(question) or None,
            notes="Workflow selected manually; prerequisites and contracts still apply.",
        )


class FixedSelector:
    def __init__(self, decision: SelectorDecision) -> None:
        self.decision = decision

    def select(self, question: str) -> SelectorDecision:
        del question
        return self.decision


def _laya_questions() -> dict[str, Any]:
    return {
        "workflow": {
            "type": "choice",
            "instructions": (
                "Choose the single approved BioAgent-ST workflow that the research request asks "
                "for. Choose unsupported_or_ambiguous when the request does not match a workflow, "
                "or when more than one workflow could apply."
            ),
            "criteria": {
                "quality_assessment": (
                    "inspect dataset structure, schema, validation, QC metrics or data quality"
                ),
                "spatial_clustering": (
                    "group spots by expression, find spatial domains, Leiden clusters, "
                    "UMAP or regions"
                ),
                "gene_expression": (
                    "show spatial expression, markers or values for one to five named genes"
                ),
                "unsupported_or_ambiguous": (
                    "the request is unsupported, unclear, or matches multiple workflows equally"
                ),
            },
        }
    }


class LayaSelector:
    def __init__(
        self,
        *,
        model: str = "typed-decisions",
        confidence_threshold: float = 0.55,
        predictor: LayaPredictor | None = None,
        fallback_to_rules: bool = True,
    ) -> None:
        if not 0.0 <= confidence_threshold <= 1.0:
            raise ValueError("confidence_threshold must be within [0, 1]")
        self.model = model
        self.confidence_threshold = confidence_threshold
        self.predictor = predictor
        self.fallback_to_rules = fallback_to_rules
        self._owns_predictor = predictor is None

    def _get_predictor(self) -> LayaPredictor:
        if self.predictor is not None:
            return self.predictor
        try:
            from laya import Router
        except ImportError as error:
            raise SelectorError(
                "Laya is not installed; install the optional dependency with `uv sync --extra laya`"
            ) from error
        self.predictor = Router()
        return self.predictor

    def select(self, question: str) -> SelectorDecision:
        started = time.perf_counter()
        try:
            predictor = self._get_predictor()
            response = predictor.predict(question, _laya_questions(), model=self.model)
            decision = self._parse_response(response, question)
        except Exception as error:
            if not self.fallback_to_rules:
                raise SelectorError(f"Laya selector failed: {error}") from error
            fallback = select_by_rules(question)
            return fallback.model_copy(
                update={
                    "name": "Deterministic rules (Laya fallback)",
                    "notes": f"Laya failed ({type(error).__name__}: {error}); rules fallback used.",
                    "latency_ms": (time.perf_counter() - started) * 1000.0,
                }
            )
        return decision.model_copy(update={"latency_ms": (time.perf_counter() - started) * 1000.0})

    def _parse_response(self, response: dict[str, Any], question: str) -> SelectorDecision:
        answers = response.get("answers")
        if not isinstance(answers, dict):
            raise SelectorError("Laya response is missing an answers object")
        answer = answers.get("workflow")
        if not isinstance(answer, dict):
            raise SelectorError("Laya response is missing the workflow answer")
        label = answer.get("choice")
        if label not in {*SUPPORTED_WORKFLOWS, "unsupported_or_ambiguous"}:
            raise SelectorError(f"Laya returned an unknown workflow label: {label!r}")
        probabilities = answer.get("probabilities")
        if not isinstance(probabilities, dict):
            probabilities = {}
        clean_probabilities = {
            str(key): float(value)
            for key, value in probabilities.items()
            if isinstance(value, int | float)
        }
        confidence = answer.get("confidence")
        confidence_value = float(confidence) if isinstance(confidence, int | float) else None
        if confidence_value is not None and confidence_value < self.confidence_threshold:
            return SelectorDecision(
                kind="laya",
                name=f"Laya {self.model}",
                version="laya-adapter-v1",
                decision="unsupported_or_ambiguous",
                confidence=confidence_value,
                probabilities=clean_probabilities,
                normalized_intent=normalize_question(question) or None,
                notes=(
                    f"Laya confidence {confidence_value:.3f} is below the "
                    f"{self.confidence_threshold:.2f} threshold; abstaining for review."
                ),
            )
        return SelectorDecision(
            kind="laya",
            name=f"Laya {self.model}",
            version="laya-adapter-v1",
            decision=label,
            confidence=confidence_value,
            probabilities=clean_probabilities,
            normalized_intent=normalize_question(question) or None,
            notes="Typed decision from the official Laya checkpoint through the adapter.",
        )


def select_workflow(
    question: str,
    kind: SelectorKind = "rules",
    *,
    manual_workflow: WorkflowId | None = None,
    laya: LayaSelector | None = None,
) -> SelectorDecision:
    if kind == "manual":
        return ManualSelector(manual_workflow or "unsupported_or_ambiguous").select(question)
    if kind == "laya":
        return (laya or LayaSelector()).select(question)
    return select_by_rules(question)
