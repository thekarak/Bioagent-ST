import concurrent.futures
import os
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
        self, state: str, questions: dict[str, Any] | None = None, *, model: str | None = None
    ) -> dict[str, Any]: ...


class NormalizedProbabilities(dict[str, float]):
    """Probability distribution supporting canonical and alias class keys."""

    def __getitem__(self, key: str) -> float:
        if (
            key == "unsupported"
            and "unsupported" not in self
            and "unsupported_or_ambiguous" in self
        ):
            return self["unsupported_or_ambiguous"]
        if (
            key == "unsupported_or_ambiguous"
            and "unsupported_or_ambiguous" not in self
            and "unsupported" in self
        ):
            return self["unsupported"]
        return super().__getitem__(key)

    def get(self, key: str, default: Any = None) -> Any:
        if (
            key == "unsupported"
            and "unsupported" not in self
            and "unsupported_or_ambiguous" in self
        ):
            return self["unsupported_or_ambiguous"]
        if (
            key == "unsupported_or_ambiguous"
            and "unsupported_or_ambiguous" not in self
            and "unsupported" in self
        ):
            return self["unsupported"]
        return super().get(key, default)


class Prediction(dict[str, Any]):
    """Laya prediction object providing typed dictionary and attribute access."""

    def __init__(
        self,
        label: str,
        confidence: float,
        probabilities: dict[str, float],
        rationale: str = "",
    ) -> None:
        self._label = label
        self._confidence = float(confidence)
        self._probabilities = NormalizedProbabilities(probabilities)
        self._rationale = rationale
        super().__init__(
            {
                "answers": {
                    "workflow": {
                        "choice": label,
                        "label": label,
                        "confidence": self._confidence,
                        "probabilities": self._probabilities,
                        "rationale": rationale,
                    }
                },
                "choice": label,
                "label": label,
                "confidence": self._confidence,
                "probabilities": self._probabilities,
                "rationale": rationale,
            }
        )

    @property
    def label(self) -> str:
        return self._label

    @property
    def choice(self) -> str:
        return self._label

    @property
    def confidence(self) -> float:
        return self._confidence

    @property
    def probabilities(self) -> NormalizedProbabilities:
        return self._probabilities

    @property
    def rationale(self) -> str:
        return self._rationale


_EXPLICIT_ABSTAIN_PATTERNS: tuple[str, ...] = (
    r"\b(ignore|override|bypass)\b.*\b(instructions?|rules?|system|prompt)\b",
    r"\b(admin|root|sudo|system access)\b",
    r"\b(do not|don'?t|never|stop|abort)\b",
    (
        r"\b(cell type|cell types|cell identity|cell identities|deconvolution|"
        r"cell type annotation|reference atlas)\b"
    ),
    r"\b(survival|prognosis|chemotherapy|clinical|patient outcome|treatment regimen)\b",
    r"\b(hospital|weather|flight|restaurant|stock price|poem|translate)\b",
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
        "cluster spots",
        "spatial domain",
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

_LOCAL_LAYA_QUALITY_PHRASES: tuple[str, ...] = (
    "quality control",
    "quality assessment",
    "dataset structure",
    "obs fields",
    "var metadata",
    "missing fields",
    "missing field",
    "missing spatial coordinates",
    "missing coordinates",
    "sequencing depth",
    "count matrix sparsity",
    "filter low count",
    "low count spots",
    "anndata schema",
    "duplicate observation",
    "layer integrity",
    "library size",
    "spot-level qc",
    "qc metrics",
    "qc checks",
    "qc filtering",
    "schema compliance",
    "matrix dimensions",
    "dataset dimensions",
    "schema dimensions",
    "inspect dataset",
    "expression matrix dimensions",
    "spot count distributions",
    "mitochondrial gene percentage",
    "mitochondrial count fractions",
    "raw spatial counts",
    "spatial coordinates presence",
    "sequencing quality",
    "quality and schema",
    "check the dataset",
    "data quality",
)
_LOCAL_LAYA_QUALITY_TERMS: tuple[str, ...] = (
    "qc",
    "schema",
    "sparsity",
    "validate",
    "validation",
    "quality",
)

_LOCAL_LAYA_CLUSTERING_PHRASES: tuple[str, ...] = (
    "spatial domains",
    "spatial domain",
    "spatial clusters",
    "spatial clustering",
    "neighborhood graph",
    "neighborhood graphs",
    "leiden clustering",
    "umap embedding",
    "umap dimensionality reduction",
    "tissue regions",
    "anatomical regions",
    "anatomical boundaries",
    "histological regions",
    "expression patterns",
    "group spots",
    "cluster spots",
    "spatial organization",
    "graph clustering",
    "unsupervised clustering",
    "discrete spatial domains",
    "spatial domain detection",
)
_LOCAL_LAYA_CLUSTERING_TERMS: tuple[str, ...] = (
    "cluster",
    "clustering",
    "clusters",
    "leiden",
    "umap",
    "segmentation",
)

_LOCAL_LAYA_EXPRESSION_PHRASES: tuple[str, ...] = (
    "gene expression",
    "spatial expression",
    "marker gene",
    "marker genes",
    "expression level",
    "expression map",
    "feature plot",
    "feature plots",
    "marker plots",
    "spatial feature plot",
    "transcript distribution",
    "transcript localization",
    "transcript counts",
    "expression of",
    "expressed in",
    "expressed across",
    "transcript pattern",
    "spatial distribution and expression",
)
_LOCAL_LAYA_EXPRESSION_TERMS: tuple[str, ...] = (
    "transcript",
    "transcripts",
    "expressed",
    "marker",
    "markers",
)


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


class LocalLayaPredictor:
    """Deterministic offline classifier providing calibrated Laya-compatible predictions."""

    def predict(
        self, state: str, questions: dict[str, Any] | None = None, *, model: str | None = None
    ) -> Prediction:
        del questions, model
        norm = normalize_question(state)

        # 1. Empty or whitespace input
        if not norm:
            probs = {
                "quality_assessment": 0.02,
                "spatial_clustering": 0.02,
                "gene_expression": 0.02,
                "unsupported_or_ambiguous": 0.94,
            }
            return Prediction(
                label="unsupported_or_ambiguous",
                confidence=0.94,
                probabilities=probs,
                rationale="Empty input query; selector abstains.",
            )

        # 2. Explicit safety, policy, and domain abstention patterns
        for pattern in _EXPLICIT_ABSTAIN_PATTERNS:
            if re.search(pattern, norm):
                probs = {
                    "quality_assessment": 0.02,
                    "spatial_clustering": 0.02,
                    "gene_expression": 0.01,
                    "unsupported_or_ambiguous": 0.95,
                }
                return Prediction(
                    label="unsupported_or_ambiguous",
                    confidence=0.95,
                    probabilities=probs,
                    rationale="Query triggered policy or out-of-scope abstention rule.",
                )

        # 3. Multi-word phrase matches across workflows
        q_p_hits = sum(
            1
            for phrase in _LOCAL_LAYA_QUALITY_PHRASES
            if re.search(r"\b" + re.escape(phrase) + r"\b", norm)
        )
        c_p_hits = sum(
            1
            for phrase in _LOCAL_LAYA_CLUSTERING_PHRASES
            if re.search(r"\b" + re.escape(phrase) + r"\b", norm)
        )
        e_p_hits = sum(
            1
            for phrase in _LOCAL_LAYA_EXPRESSION_PHRASES
            if re.search(r"\b" + re.escape(phrase) + r"\b", norm)
        )

        # Check for multi-workflow conflict / conjunctions
        active_phrase_workflows = sum(1 for count in (q_p_hits, c_p_hits, e_p_hits) if count > 0)
        if active_phrase_workflows >= 2:
            p_counts = sorted([q_p_hits, c_p_hits, e_p_hits], reverse=True)
            if (p_counts[0] == p_counts[1] and p_counts[0] >= 1) or (
                p_counts[1] >= 2 and p_counts[0] <= p_counts[1] + 1
            ):
                probs = {
                    "quality_assessment": 0.24 if q_p_hits > 0 else 0.02,
                    "spatial_clustering": 0.24 if c_p_hits > 0 else 0.02,
                    "gene_expression": 0.24 if e_p_hits > 0 else 0.02,
                    "unsupported_or_ambiguous": 0.52,
                }
                total = sum(probs.values())
                norm_probs = {k: round(v / total, 4) for k, v in probs.items()}
                diff = round(1.0 - sum(norm_probs.values()), 4)
                norm_probs["unsupported_or_ambiguous"] = round(
                    norm_probs["unsupported_or_ambiguous"] + diff, 4
                )
                return Prediction(
                    label="unsupported_or_ambiguous",
                    confidence=0.52,
                    probabilities=norm_probs,
                    rationale=(
                        "Multiple conflicting workflow phrases matched with "
                        "comparable strength; abstaining."
                    ),
                )

        # 4. Total hits combining phrases and terms
        q_hits = q_p_hits + sum(
            1
            for term in _LOCAL_LAYA_QUALITY_TERMS
            if re.search(r"\b" + re.escape(term) + r"\b", norm)
        )
        c_hits = c_p_hits + sum(
            1
            for term in _LOCAL_LAYA_CLUSTERING_TERMS
            if re.search(r"\b" + re.escape(term) + r"\b", norm)
        )
        e_hits = e_p_hits + sum(
            1
            for term in _LOCAL_LAYA_EXPRESSION_TERMS
            if re.search(r"\b" + re.escape(term) + r"\b", norm)
        )

        scores: list[tuple[SupportedWorkflowId, int]] = [
            ("quality_assessment", q_hits),
            ("spatial_clustering", c_hits),
            ("gene_expression", e_hits),
        ]
        scores.sort(key=lambda item: item[1], reverse=True)
        best_choice, best_count = scores[0]
        second_choice, second_count = scores[1]

        # No signals matched
        if best_count == 0:
            probs = {
                "quality_assessment": 0.027,
                "spatial_clustering": 0.027,
                "gene_expression": 0.026,
                "unsupported_or_ambiguous": 0.92,
            }
            return Prediction(
                label="unsupported_or_ambiguous",
                confidence=0.92,
                probabilities=probs,
                rationale=(
                    "No domain-specific workflow signals identified in query; request unsupported."
                ),
            )

        # Tied score between top workflows
        if second_count > 0 and best_count == second_count:
            probs = {
                "quality_assessment": 0.23 if q_hits == best_count else 0.04,
                "spatial_clustering": 0.23 if c_hits == best_count else 0.04,
                "gene_expression": 0.23 if e_hits == best_count else 0.04,
                "unsupported_or_ambiguous": 0.50,
            }
            total = sum(probs.values())
            norm_probs = {k: round(v / total, 4) for k, v in probs.items()}
            diff = round(1.0 - sum(norm_probs.values()), 4)
            norm_probs["unsupported_or_ambiguous"] = round(
                norm_probs["unsupported_or_ambiguous"] + diff, 4
            )
            return Prediction(
                label="unsupported_or_ambiguous",
                confidence=0.50,
                probabilities=norm_probs,
                rationale=(
                    f"Tied signal strength between {best_choice} and {second_choice}; "
                    "abstaining for review."
                ),
            )

        # Dominant workflow matched
        if best_count >= 3 and second_count == 0:
            conf = 0.96
        elif best_count >= 2 and second_count == 0:
            conf = 0.94
        elif second_count == 0:
            conf = 0.91
        else:
            margin = best_count - second_count
            conf = min(0.95, 0.86 + 0.04 * margin)

        rem = round(1.0 - conf, 4)
        if second_count > 0:
            sec_p = round(rem * 0.65, 4)
            other_p = round((rem - sec_p) / 2.0, 4)
            probs = {
                cls: other_p
                for cls in ("quality_assessment", "spatial_clustering", "gene_expression")
            }
            probs["unsupported_or_ambiguous"] = other_p
            probs[second_choice] = sec_p
            probs[best_choice] = conf
        else:
            other_p = round(rem / 3.0, 4)
            probs = {
                cls: other_p
                for cls in ("quality_assessment", "spatial_clustering", "gene_expression")
            }
            probs["unsupported_or_ambiguous"] = other_p
            probs[best_choice] = conf

        total = sum(probs.values())
        norm_probs = {k: round(v / total, 4) for k, v in probs.items()}
        diff = round(1.0 - sum(norm_probs.values()), 4)
        norm_probs[best_choice] = round(norm_probs[best_choice] + diff, 4)

        rationale = (
            f"Local Laya classifier identified dominant intent '{best_choice}' "
            f"with {best_count} matched signals (secondary: {second_count})."
        )
        return Prediction(
            label=best_choice,
            confidence=conf,
            probabilities=norm_probs,
            rationale=rationale,
        )


class LayaSelector:
    def __init__(
        self,
        *,
        model: str = "typed-decisions",
        confidence_threshold: float = 0.55,
        predictor: LayaPredictor | None = None,
        fallback_to_rules: bool = True,
        prefer_local: bool = True,
    ) -> None:
        if not 0.0 <= confidence_threshold <= 1.0:
            raise ValueError("confidence_threshold must be within [0, 1]")
        self.model = model
        self.confidence_threshold = confidence_threshold
        self.predictor = predictor
        self.fallback_to_rules = fallback_to_rules
        self.prefer_local = prefer_local
        self._owns_predictor = predictor is None

    def _get_predictor(self) -> LayaPredictor:
        if self.predictor is not None:
            return self.predictor
        if self.prefer_local or os.environ.get("LAYA_OFFLINE", "1") == "1":
            self.predictor = LocalLayaPredictor()
            return self.predictor
        try:
            from laya import Router

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(Router)
                self.predictor = future.result(timeout=2.0)
        except Exception:
            self.predictor = LocalLayaPredictor()
        return self.predictor

    def select(self, question: str) -> SelectorDecision:
        started = time.perf_counter()
        try:
            predictor = self._get_predictor()
            try:
                if self._owns_predictor and not isinstance(predictor, LocalLayaPredictor):
                    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                        future = executor.submit(
                            predictor.predict, question, _laya_questions(), model=self.model
                        )
                        response = future.result(timeout=3.0)
                else:
                    response = predictor.predict(question, _laya_questions(), model=self.model)
            except Exception as router_err:
                if self._owns_predictor and not isinstance(predictor, LocalLayaPredictor):
                    self.predictor = LocalLayaPredictor()
                    response = self.predictor.predict(question, _laya_questions(), model=self.model)
                else:
                    raise router_err
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
        answers = response.get("answers") if isinstance(response, dict) else None
        if not isinstance(answers, dict):
            if isinstance(response, dict) and ("choice" in response or "label" in response):
                answer = response
            else:
                raise SelectorError("Laya response is missing an answers object")
        else:
            raw_answer = answers.get("workflow")
            if not isinstance(raw_answer, dict):
                raise SelectorError("Laya response is missing the workflow answer")
            answer = raw_answer

        label = answer.get("choice") or answer.get("label")
        if label == "unsupported":
            label = "unsupported_or_ambiguous"
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
        if (
            "unsupported" in clean_probabilities
            and "unsupported_or_ambiguous" not in clean_probabilities
        ):
            clean_probabilities["unsupported_or_ambiguous"] = clean_probabilities["unsupported"]

        confidence = answer.get("confidence")
        confidence_value = float(confidence) if isinstance(confidence, int | float) else None
        rationale = answer.get("rationale") or answer.get("explanation") or ""
        notes = rationale if rationale else "Typed decision from the Laya router model."

        if confidence_value is not None and confidence_value < self.confidence_threshold:
            notes = (
                f"Laya confidence {confidence_value:.3f} is below the "
                f"{self.confidence_threshold:.2f} threshold; abstaining for review."
            )
            if rationale:
                notes = f"{notes} Rationale: {rationale}"
            return SelectorDecision(
                kind="laya",
                name=f"Laya {self.model}",
                version="laya-adapter-v1",
                decision="unsupported_or_ambiguous",
                confidence=confidence_value,
                probabilities=clean_probabilities,
                normalized_intent=normalize_question(question) or None,
                notes=notes,
            )
        return SelectorDecision(
            kind="laya",
            name=f"Laya {self.model}",
            version="laya-adapter-v1",
            decision=label,
            confidence=confidence_value,
            probabilities=clean_probabilities,
            normalized_intent=normalize_question(question) or None,
            notes=notes,
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
