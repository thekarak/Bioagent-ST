"use client";

/**
 * Evaluation & research protocol workspace.
 *
 * Honest by default: this screen presents the *design* of the evaluation —
 * research questions, hypotheses, fault-injection plan, baselines — which is
 * legitimate planned content. Measured results are shown only when evaluation
 * records exist; the optional layout preview is stamped DEMO DATA throughout
 * and is never presented as a measurement.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck,
  FlaskConical,
  Info,
  LineChart as LineChartIcon,
  Timer,
  ShieldAlert,
  Repeat,
  Route,
  Scale,
  GitBranch,
  Bug,
  ListChecks,
  ExternalLink,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EVIDENCE_CONTRACTS } from "@/lib/bioagent/contracts";

/* ---------- Research questions ---------- */

const RESEARCH_QUESTIONS = [
  {
    id: "RQ1",
    title: "Routing reliability",
    question: "How reliably does the selector map requests to the intended workflow?",
    metrics: ["Accuracy", "Macro-F1", "Confusion matrix", "Per-class performance"],
    method: "Labeled request set routed by both selectors; labels frozen before evaluation.",
  },
  {
    id: "RQ2",
    title: "Fault detection",
    question: "How effectively do evidence contracts detect incomplete or faulty runs?",
    metrics: ["Detection recall", "False-alarm rate", "Severity agreement"],
    method: "Fault-injection suite with known expected outcomes (matrix below).",
  },
  {
    id: "RQ3",
    title: "Traceability",
    question: "Can report elements be traced to run configuration and artifacts?",
    metrics: ["Provenance completeness", "Claim-to-artifact linkage"],
    method: "Provenance audit over recorded runs; every report element resolved to a run record.",
  },
  {
    id: "RQ4",
    title: "Selector comparison",
    question:
      "How does Laya compare with deterministic rules on accuracy, abstention, latency and errors?",
    metrics: ["Accuracy / macro-F1", "Abstention P/R", "Latency", "Error patterns"],
    method: "Same request set, same allowed choices; selector versions recorded.",
  },
  {
    id: "RQ5",
    title: "Safe caution",
    question:
      "Do missing prerequisites and unsupported requests trigger clarification or review rather than silent execution?",
    metrics: ["Clarification / abstention rate", "Unauthorized execution rate (target 0)"],
    method: "Ambiguous and missing-data request subset; policy-gate logs audited.",
  },
] as const;

const HYPOTHESES = [
  {
    id: "H1",
    text: "Contracts detect a measurable share of injected technical faults compared with checks-disabled execution.",
  },
  {
    id: "H2",
    text: "Ledger-backed reports have higher traceability completeness than reports without structured provenance.",
  },
  {
    id: "H3",
    text: "Laya and rules show measurable differences in accuracy, abstention, latency or error patterns; no winner is assumed.",
  },
  {
    id: "H4",
    text: "Missing fields and unsupported requests increase clarification, abstention and review rather than unauthorized execution.",
  },
] as const;

/* ---------- Fault-injection plan ---------- */

const FAULT_PLAN = [
  {
    category: "Schema",
    example: "Empty matrix, wrong dimensions, duplicate IDs, missing metadata",
    expected: "Reject or clarify; record the failed check",
  },
  {
    category: "Coordinates",
    example: "Missing or wrong-shape spatial coordinates",
    expected: "Block workflows that require coordinates",
  },
  {
    category: "Numerical",
    example: "NaN/Inf values, corrupted embeddings",
    expected: "Detect; mark failure or needs-review",
  },
  {
    category: "Gene resolution",
    example: "Unknown or ambiguous gene identifier",
    expected: "Report no/ambiguous match; no silent substitution",
  },
  {
    category: "Execution",
    example: "Forced exception or interrupted run",
    expected: "Mark failed; no success report emitted",
  },
  {
    category: "Artifacts",
    example: "Deleted or corrupted expected output; checksum mismatch",
    expected: "Detect missing/corrupted artifact",
  },
  {
    category: "Selector",
    example: "Unknown label, malformed Laya output, timeout",
    expected: "Reject; documented fallback or review",
  },
  {
    category: "Provenance",
    example: "Missing version, config or input fingerprint",
    expected: "Fail completeness check or mark unavailable",
  },
] as const;

/* ---------- Request-set composition ---------- */

const REQUEST_SET_CATEGORIES = [
  { label: "Three approved workflows", detail: "quality · clustering · gene expression requests" },
  { label: "Ambiguous", detail: "requests that should abstain, not guess" },
  { label: "Unsupported", detail: "tasks outside the v1 allowlist" },
  { label: "Missing-data", detail: "requests whose dataset lacks prerequisites" },
  { label: "Paraphrased", detail: "same intent, different phrasing" },
  { label: "Negated", detail: "requests phrased as negations or contrasts" },
  { label: "Edge cases", detail: "boundary parameter values and odd input" },
] as const;

const BASELINES = [
  {
    name: "Deterministic rules selector",
    detail: "Transparent keyword/threshold rules over the same four-way choice set; the fallback path.",
  },
  {
    name: "Laya selector",
    detail: "Official Laya behind an adapter: non-autoregressive, non-generative typed decisions (single forward pass). Version pinned; malformed output rejected.",
  },
  {
    name: "Manual selection",
    detail: "Optional reference labels — the user chooses the workflow directly.",
  },
  {
    name: "Verification ablation",
    detail: "Selected checks disabled in controlled tests to measure what fault detection loses (H1).",
  },
  {
    name: "Ledger ablation",
    detail: "Traceability completeness compared with and without structured provenance (H2).",
  },
  {
    name: "Free-form LLM baseline",
    detail: "Optional comparison only — never granted execution access of any kind.",
  },
] as const;

/* ---------- Metrics by area (core measurement table) ---------- */

const METRIC_AREAS = [
  {
    icon: Route,
    area: "Routing",
    metrics: "Accuracy · macro-F1 · confusion matrix · per-class performance",
  },
  {
    icon: ShieldAlert,
    area: "Abstention",
    metrics: "Precision / recall on ambiguous & unsupported · unauthorized execution rate",
  },
  {
    icon: ClipboardCheck,
    area: "Fault detection",
    metrics: "Detection recall · false-alarm rate · severity agreement",
  },
  {
    icon: Repeat,
    area: "Traceability",
    metrics: "Required provenance fields present · report outputs linked to artifacts",
  },
  {
    icon: Scale,
    area: "Reproducibility",
    metrics: "Replay success under pinned environment · key-output comparison",
  },
  {
    icon: Timer,
    area: "Performance",
    metrics: "Latency and resource use, per workflow, when instrumented",
  },
] as const;

export function EvaluationPage() {
  const [showDemo, setShowDemo] = React.useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Evaluation</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The research protocol for BioAgent-ST: five research questions, four hypotheses, a
          fault-injection plan and the baselines they will be measured against. This screen
          reports measured results only — the protocol below is design, the numbers are not.
        </p>
      </div>

      {/* Research questions */}
      <section aria-labelledby="rq-heading">
        <h2 id="rq-heading" className="text-base font-semibold tracking-tight">
          Research questions
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {RESEARCH_QUESTIONS.map((rq) => (
            <article key={rq.id} className="flex flex-col rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="rounded border border-teal/40 bg-teal/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-teal">
                  {rq.id}
                </span>
                <h3 className="text-sm font-medium leading-snug">{rq.title}</h3>
              </div>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">{rq.question}</p>
              <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                  metrics
                </p>
                <p className="text-[11px] leading-snug text-foreground/80">{rq.metrics.join(" · ")}</p>
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">method</p>
                <p className="text-[11px] leading-snug text-muted-foreground">{rq.method}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Hypotheses */}
      <section aria-labelledby="hyp-heading">
        <h2 id="hyp-heading" className="text-base font-semibold tracking-tight">
          Hypotheses
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {HYPOTHESES.map((h) => (
            <article key={h.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
              <span className="mt-0.5 rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                {h.id}
              </span>
              <p className="text-xs leading-relaxed text-foreground/90">{h.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Metrics by area */}
      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="text-base font-semibold tracking-tight">
          Metrics by area
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {METRIC_AREAS.map((m) => (
            <article key={m.area} className="rounded-lg border border-border bg-card p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-medium">
                <m.icon className="size-4 text-teal" aria-hidden />
                {m.area}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{m.metrics}</p>
            </article>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Scientific claim-support rate is reviewed only if a defensible annotation protocol exists.
        </p>
      </section>

      {/* Fault injection + request set */}
      <section aria-labelledby="fault-heading">
        <h2 id="fault-heading" className="text-base font-semibold tracking-tight">
          Fault-injection plan
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Injected faults make the verifier testable: each row deliberately introduces a controlled
          problem and defines what the system must do. A detected fault is distinguished from a
          crash; for every case, input condition, expected and actual outcome, detecting check,
          severity and whether anything was executed or published are recorded.
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="ba-table">
              <thead>
                <tr className="hover:bg-transparent">
                  <th scope="col" className="w-[10rem]">
                    <span className="inline-flex items-center gap-1.5">
                      <Bug className="size-3.5" aria-hidden />
                      Category
                    </span>
                  </th>
                  <th scope="col">Example injection</th>
                  <th scope="col" className="w-[13rem]">Expected behavior</th>
                </tr>
              </thead>
              <tbody>
                {FAULT_PLAN.map((f) => (
                  <tr key={f.category}>
                    <td className="font-medium">{f.category}</td>
                    <td className="text-xs text-muted-foreground">{f.example}</td>
                    <td className="text-xs">{f.expected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Route className="size-4 text-teal" aria-hidden />
                Routing request set
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Target 60–120 labeled requests, balanced across:
              </p>
              <ul className="mt-2 space-y-1.5">
                {REQUEST_SET_CATEGORIES.map((c) => (
                  <li key={c.label} className="flex items-baseline gap-2 text-xs">
                    <span className="shrink-0 font-medium text-foreground/80">{c.label}</span>
                    <span className="text-muted-foreground">— {c.detail}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">
                Both teammates independently label at least a subset; disagreements are resolved
                before labels freeze.
              </p>
            </div>

            <div className="rounded-lg border border-warning/40 bg-warning/5 p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-warning">
                <ShieldAlert className="size-4" aria-hidden />
                Leakage discipline
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-foreground/80">
                Split by paraphrase family, not randomly — near-identical sentences never straddle
                train and held-out sets. The held-out evaluation set stays separate from examples
                used to tune rules or prompts. Task set, labels, fault definitions and metrics are
                frozen before final evaluation.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Info className="size-4 text-muted-foreground" aria-hidden />
                Small-sample discipline
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Counts, denominators, uncertainty and failure examples are reported. No overstated
                significance; no generalization from a small benchmark; no external-system
                superiority claims without matched tasks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Baselines & contracts */}
      <section aria-labelledby="baseline-heading">
        <h2 id="baseline-heading" className="text-base font-semibold tracking-tight">
          Baselines, ablations and contracts under test
        </h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <GitBranch className="size-4 text-teal" aria-hidden />
              Baselines and ablations
            </h3>
            <ul className="mt-3 divide-y divide-border rounded-md border border-border">
              {BASELINES.map((b) => (
                <li key={b.name} className="px-3 py-2.5">
                  <p className="text-xs font-medium text-foreground/90">{b.name}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{b.detail}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <ListChecks className="size-4 text-teal" aria-hidden />
              Evidence contracts (v1)
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Machine-readable agreements that define required inputs, allowed parameters, expected
              artifacts, checks and failure policy for each workflow.
            </p>
            <ul className="mt-3 divide-y divide-border rounded-md border border-border">
              {EVIDENCE_CONTRACTS.map((c) => (
                <li key={c.workflow} className="px-3 py-2.5">
                  <p className="flex flex-wrap items-center gap-2 text-xs font-medium">
                    <span className="font-mono text-[11px] text-foreground/90">{c.workflow}</span>
                    <span className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {c.version}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {c.expectedArtifacts.length} artifacts · {c.validationChecks.length} checks
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {c.failurePolicy}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <ExternalLink className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Full contract detail for each workflow appears in the run detail view under
              Verification.
            </p>
          </div>
        </div>
      </section>

      {/* Measured results — honest empty state */}
      <section aria-labelledby="results-heading">
        <h2 id="results-heading" className="text-base font-semibold tracking-tight">
          Measured results
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          None available yet — and presented that way rather than filled with placeholders.
        </p>

        {!showDemo && (
          <div className="mt-3 rounded-lg border border-dashed border-border bg-secondary/40 p-10 text-center" role="status">
            <LineChartIcon className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-medium text-foreground">No evaluation results available yet.</p>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Evaluation requires recorded runs over a labeled request set: selector decisions with
              ground-truth routes, fault-injected executions with known outcomes, and provenance
              audits. Until those records exist, this workspace deliberately shows no numbers —
              planned metrics are not displayed as measured performance.
            </p>
            <p className="mx-auto mt-3 max-w-lg text-xs leading-relaxed text-muted-foreground">
              To populate this screen, connect the scientific backend, run the evaluation protocol
              above (request-set routing, fault injection, replay, provenance audit), and load the
              recorded results. A comparison view for the Laya selector and the deterministic-rules
              baseline appears once both have evaluation records.
            </p>
            <Button variant="outline" size="sm" className="mt-5" onClick={() => setShowDemo(true)}>
              <FlaskConical className="size-3.5" aria-hidden />
              Preview layout with DEMO DATA
            </Button>
          </div>
        )}

        {showDemo && (
          <div className="mt-3 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/5 p-4">
              <div className="flex items-start gap-3">
                <FlaskConical className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <div>
                  <h3 className="text-sm font-semibold text-warning">
                    Evaluation layout preview — DEMO DATA
                  </h3>
                  <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                    Every number, chart and table below is invented layout data used only to
                    demonstrate the interface. These are not measurements of the Laya selector, the
                    rules baseline, or the verifier.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowDemo(false)}>
                Hide preview
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Routing macro-F1", value: "—" },
                { label: "Abstention on ambiguous", value: "—" },
                { label: "Unauthorized executions", value: "0 / 0" },
                { label: "Replay success", value: "0 / 0" },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="mt-1 font-mono text-2xl font-semibold text-foreground">{c.value}</p>
                  <p className="mt-1 inline-flex items-center gap-1 rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                    <FlaskConical className="size-2.5" aria-hidden />
                    DEMO DATA
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  Confusion matrix
                  <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                    DEMO DATA
                  </span>
                </h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="ba-table min-w-[22rem]">
                    <thead>
                      <tr className="hover:bg-transparent">
                        <th scope="col">predicted \ true</th>
                        <th scope="col" className="text-center">quality</th>
                        <th scope="col" className="text-center">clustering</th>
                        <th scope="col" className="text-center">gene</th>
                        <th scope="col" className="text-center">abstain</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["quality", "—", "—", "—", "—"],
                        ["clustering", "—", "—", "—", "—"],
                        ["gene", "—", "—", "—", "—"],
                        ["abstain", "—", "—", "—", "—"],
                      ].map((row) => (
                        <tr key={row[0]}>
                          <td className="font-mono text-xs">{row[0]}</td>
                          {row.slice(1).map((v, i) => (
                            <td key={i} className="text-center font-mono text-xs text-muted-foreground">
                              {v}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Cells remain unfilled until evaluation records exist — invented counts would be
                  presented as performance.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  Selector comparison
                  <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                    DEMO DATA
                  </span>
                </h3>
                <div className="mt-3 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { metric: "Macro-F1", laya: 0, rules: 0 },
                        { metric: "Abstention", laya: 0, rules: 0 },
                        { metric: "Fault recall", laya: 0, rules: 0 },
                      ]}
                      margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#EDF1EF" />
                      <XAxis dataKey="metric" tick={{ fontSize: 11, fill: "#677681" }} stroke="#DDE4E3" />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: "#677681" }} stroke="#DDE4E3" />
                      <ChartTooltip
                        contentStyle={{
                          border: "1px solid #DDE4E3",
                          borderRadius: 6,
                          fontSize: 12,
                          background: "#FFFFFF",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="laya" name="Laya selector (simulated)" fill="#2C7771" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="rules" name="Deterministic rules (demo)" fill="#183345" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Bars sit at zero because no evaluation records exist. The chart demonstrates the
                  comparison view, not performance.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Evaluation configuration and dataset provenance (request-set version, fault-injection
        manifest, package versions) will be recorded with each evaluation run when the protocol is
        executed.
      </p>
    </div>
  );
}
