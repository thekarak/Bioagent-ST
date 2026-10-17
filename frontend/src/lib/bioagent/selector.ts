/**
 * Request normalization and workflow selection (demo).
 *
 * The "deterministic rules" selector is a transparent keyword router that
 * runs locally. The "Laya" option simulates an external selector's decision
 * shape; it is explicitly labeled as simulated and must never be presented
 * as the real model's measured behavior.
 */

import type { SelectorKind, SelectorDecision, WorkflowId } from "./types";

interface Rule {
  workflow: WorkflowId;
  signals: string[];
}

const RULES: Rule[] = [
  {
    workflow: "quality_assessment",
    signals: [
      "quality",
      "qc",
      "validate",
      "validation",
      "inspect",
      "schema",
      "dimension",
      "structure",
      "missing field",
      "quality control",
      "assess",
      "check the dataset",
    ],
  },
  {
    workflow: "spatial_clustering",
    signals: [
      "cluster",
      "clustering",
      "spatial domains",
      "expression patterns",
      "leiden",
      "umap",
      "neighborhood graph",
      "regions",
      "segment",
      "group spots",
      "spatial organization",
    ],
  },
  {
    workflow: "gene_expression",
    signals: [
      "gene",
      "expression of",
      "marker",
      "expressed",
      "feature plot",
      "expression map",
      "where is",
      "expression level",
      "transcript",
    ],
  },
];

export function normalizeQuestion(question: string): string {
  return question.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface SelectionOutcome {
  decision: WorkflowId;
  matchedSignals: string[];
  normalizedIntent: string | null;
}

/** Transparent deterministic rules — same core routing for both selector modes. */
function routeByRules(normalized: string, catalog: "full" | "laya"): SelectionOutcome {
  const matches: { workflow: WorkflowId; signals: string[] }[] = [];
  for (const rule of RULES) {
    const hits = rule.signals.filter((s) => normalized.includes(s));
    if (hits.length > 0) matches.push({ workflow: rule.workflow, signals: hits });
  }
  if (matches.length === 0) {
    return { decision: "unsupported_or_ambiguous", matchedSignals: [], normalizedIntent: normalized || null };
  }
  matches.sort((a, b) => b.signals.length - a.signals.length);
  const best = matches[0];
  // Conflicting strong matches -> abstain to review rather than guess.
  if (matches.length > 1 && matches[1].signals.length === best.signals.length && catalog === "full") {
    return {
      decision: "unsupported_or_ambiguous",
      matchedSignals: [...best.signals, ...matches[1].signals],
      normalizedIntent: normalized || null,
    };
  }
  return { decision: best.workflow, matchedSignals: best.signals, normalizedIntent: normalized || null };
}

export function selectWorkflow(
  question: string,
  kind: SelectorKind,
  manualChoice?: WorkflowId
): SelectorDecision {
  if (kind === "manual") {
    return {
      kind: "manual",
      name: "Manual selection",
      version: "ui-1",
      decision: manualChoice ?? "unsupported_or_ambiguous",
      matchedSignals: [],
      normalizedIntent: normalizeQuestion(question) || null,
      notes:
        "Workflow selected manually by the researcher. Manual selections still pass through prerequisite validation and the policy gate.",
    };
  }
  if (kind === "laya") {
    const outcome = routeByRules(normalizeQuestion(question), "laya");
    return {
      kind: "laya",
      name: "Laya selector (simulated)",
      version: "demo-sim-0.1",
      decision: outcome.decision,
      matchedSignals: outcome.matchedSignals,
      normalizedIntent: outcome.normalizedIntent,
      notes:
        "Simulated selector decision shown for interface demonstration only. The real Laya selector is not connected in this prototype; this is not a measurement of its behavior.",
    };
  }
  const outcome = routeByRules(normalizeQuestion(question), "full");
  return {
    kind: "rules",
    name: "Deterministic rules (demo)",
    version: "rules-demo-1",
    decision: outcome.decision,
    matchedSignals: outcome.matchedSignals,
    normalizedIntent: outcome.normalizedIntent,
    notes:
      "Transparent keyword rules evaluated locally in your browser. When two workflows match with equal strength the selector abstains (unsupported_or_ambiguous) for review instead of guessing.",
  };
}

/** Example questions shown in the New Analysis form. */
export const EXAMPLE_QUESTIONS: { question: string; workflow: WorkflowId; label: string }[] = [
  {
    question: "Show spatial clusters based on expression patterns in this dataset.",
    workflow: "spatial_clustering",
    label: "Clustering example",
  },
  {
    question: "Assess the quality and schema of this dataset before further analysis.",
    workflow: "quality_assessment",
    label: "Quality assessment example",
  },
  {
    question: "Show spatial expression of Gene0134 and Gene0279.",
    workflow: "gene_expression",
    label: "Gene expression example",
  },
];
