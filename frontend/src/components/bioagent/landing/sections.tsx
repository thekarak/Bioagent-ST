"use client";

/** Landing page sections: nav, pipeline strip, workflow cards, evidence, limitations, footer. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Inbox,
  ScanSearch,
  Route,
  ShieldCheck,
  Cog,
  ClipboardCheck,
  ScrollText,
  FileText,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BookOpen,
  Github,
  ExternalLink,
  FlaskConical,
  CircleDot,
  CircleDashed,
  Bot,
  Lock,
} from "lucide-react";
import { Wordmark } from "@/components/bioagent/common/Wordmark";
import { navigateTo, APP_ROUTES } from "@/lib/bioagent/router";
import { useBioAgentStore } from "@/lib/bioagent/store";
import { WORKFLOWS, WORKFLOW_ORDER } from "@/lib/bioagent/workflows";
import type { WorkflowId } from "@/lib/bioagent/types";
import { cn } from "@/lib/utils";

/* ---------- Navigation ---------- */

const NAV_LINKS = [
  { label: "Overview", href: "#top" },
  { label: "Workflows", href: "#workflows" },
  { label: "Research Approach", href: "#evidence" },
  { label: "Research Context", href: "#research-context" },
  { label: "Documentation", href: "#documentation" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-card/90 backdrop-blur",
        scrolled ? "border-border shadow-[0_1px_2px_rgba(25,42,50,0.04)]" : "border-transparent"
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#top" className="ba-focus rounded" aria-label="BioAgent-ST home">
          <Wordmark />
        </a>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Landing sections">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => navigateTo(APP_ROUTES.overview)}>
          Open Workspace
          <ArrowRight className="size-3.5" aria-hidden />
        </Button>
      </div>
    </header>
  );
}

/* ---------- Pipeline strip ---------- */

const PIPELINE_STAGES = [
  { n: 1, label: "Request", icon: Inbox },
  { n: 2, label: "Validate", icon: ScanSearch },
  { n: 3, label: "Select", icon: Route },
  { n: 4, label: "Policy Gate", icon: ShieldCheck },
  { n: 5, label: "Execute", icon: Cog },
  { n: 6, label: "Verify", icon: ClipboardCheck },
  { n: 7, label: "Record Evidence", icon: ScrollText },
  { n: 8, label: "Report", icon: FileText },
];

export function PipelineStrip() {
  return (
    <section id="workflows" className="border-t border-border bg-card py-12" aria-labelledby="pipeline-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Analysis pipeline
        </p>
        <h2 id="pipeline-title" className="mt-1 text-xl font-semibold tracking-tight">
          Eight stages, two boundaries
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          A research question moves through validation, workflow selection and a policy decision
          before any scientific code runs. Execution, verification and evidence recording follow —
          workflow selection and scientific execution are separate operations.
        </p>

        <div className="mt-7 overflow-x-auto pb-2">
          <ol className="flex min-w-max items-stretch gap-0" aria-label="Pipeline stages">
            {PIPELINE_STAGES.map((s, i) => (
              <React.Fragment key={s.n}>
                <li className="flex w-28 shrink-0 flex-col items-center gap-2 text-center">
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-md border",
                      i >= 3 && i <= 4 ? "border-teal/40 bg-teal/10 text-teal" : "border-border bg-secondary text-primary"
                    )}
                    aria-hidden
                  >
                    <s.icon className="size-4" />
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">{String(s.n).padStart(2, "0")}</span>
                  <span className="text-xs font-medium leading-tight text-foreground">{s.label}</span>
                </li>
                {i < PIPELINE_STAGES.length - 1 && (
                  <li
                    className={cn("flex items-center", i === 3 ? "px-1" : "px-1")}
                    aria-hidden
                  >
                    {i === 3 ? (
                      <span className="mx-1 h-8 w-px border-l border-dashed border-warning/60" title="Decision boundary" />
                    ) : null}
                    <span className="h-px w-4 bg-border" />
                  </li>
                )}
              </React.Fragment>
            ))}
          </ol>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-px border-l border-dashed border-warning/70" aria-hidden />
            Stages 1–4: request handling and policy decision (AI-assisted selection, no arbitrary code)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-[2px] bg-teal/30" aria-hidden />
            Stages 4–8: registered scientific execution and evidence recording
          </span>
        </div>
      </div>
    </section>
  );
}

/* ---------- Workflow cards ---------- */

const WORKFLOW_ICONS = { quality_assessment: ScanSearch, spatial_clustering: Route, gene_expression: Cog } as const;
const WORKFLOW_ICON_COLORS = { quality_assessment: "text-teal", spatial_clustering: "text-primary", gene_expression: "text-verified" } as const;

export function WorkflowCards() {
  const setPendingWorkflow = useBioAgentStore((s) => s.setPendingWorkflow);
  const openWorkflow = (w: WorkflowId) => {
    setPendingWorkflow(w);
    navigateTo(APP_ROUTES.newAnalysis);
  };
  return (
    <section className="border-t border-border bg-background py-12" aria-labelledby="workflow-cards-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Approved workflows
        </p>
        <h2 id="workflow-cards-title" className="mt-1 text-xl font-semibold tracking-tight">
          Three bounded scientific workflows
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          BioAgent-ST constrains analysis to a registered set. Unrestricted AI-generated code does not
          execute scientific operations; requests either map to one of these workflows or are held for
          review.
        </p>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {WORKFLOW_ORDER.map((id) => {
            const spec = WORKFLOWS[id];
            const Icon = WORKFLOW_ICONS[id];
            return (
              <article key={id} className="flex flex-col rounded-lg border border-border bg-card p-5">
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-md border border-border bg-secondary",
                    WORKFLOW_ICON_COLORS[id]
                  )}
                  aria-hidden
                >
                  <Icon className="size-4.5" />
                </span>
                <h3 className="mt-3 text-sm font-semibold">{spec.title}</h3>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{spec.purpose}</p>
                <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">Representative output: </span>
                  {spec.representativeOutput}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full justify-between"
                  onClick={() => openWorkflow(id)}
                >
                  Open workflow
                  <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- Evidence & reproducibility ---------- */

function FragmentRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-xs">
      <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className={cn("shrink-0 text-foreground/90", mono && "font-mono text-[10px]")}>{value}</span>
    </div>
  );
}

export function EvidenceSection() {
  return (
    <section id="evidence" className="border-t border-border bg-card py-12" aria-labelledby="evidence-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Research approach
        </p>
        <h2 id="evidence-title" className="mt-1 text-xl font-semibold tracking-tight">
          Every run should leave an inspectable record.
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Each stage of the pipeline contributes evidence: what was asked, what was validated, which
          workflow was selected, what the policy decided, and which artifacts were produced. The
          interface below previews the four record types a researcher can audit after a run.
        </p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {/* 1. Input & schema validation */}
          <article className="rounded-lg border border-border bg-background p-4">
            <h3 className="text-sm font-semibold">Input and schema validation</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              The dataset is checked before any workflow runs: dimensions, identifiers, coordinate
              availability. Unavailable metrics stay unavailable.
            </p>
            <div className="mt-3 divide-y divide-border rounded-md border border-border bg-card px-3">
              <FragmentRow icon={<CheckCircle2 className="size-3.5 shrink-0 text-verified" aria-hidden />} label="obs × var" value="2,400 × 500" mono />
              <FragmentRow icon={<CheckCircle2 className="size-3.5 shrink-0 text-verified" aria-hidden />} label="obsm['spatial']" value="present" />
              <FragmentRow icon={<AlertTriangle className="size-3.5 shrink-0 text-warning" aria-hidden />} label="obs['mt_fraction']" value="not assessed" />
            </div>
          </article>

          {/* 2. Selection & policy */}
          <article className="rounded-lg border border-border bg-background p-4">
            <h3 className="text-sm font-semibold">Approved workflow selection and policy decision</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              The selector maps the request to a registered workflow; the policy gate decides ALLOW,
              REVIEW or BLOCK with an explicit reason before execution.
            </p>
            <div className="mt-3 divide-y divide-border rounded-md border border-border bg-card px-3">
              <FragmentRow icon={<Route className="size-3.5 shrink-0 text-teal" aria-hidden />} label="selector decision" value="spatial_clustering" mono />
              <FragmentRow icon={<ShieldCheck className="size-3.5 shrink-0 text-verified" aria-hidden />} label="policy" value="ALLOW" />
              <FragmentRow icon={<Inbox className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />} label="matched signals" value="cluster, expression patterns" />
            </div>
          </article>

          {/* 3. Technical verification */}
          <article className="rounded-lg border border-border bg-background p-4">
            <h3 className="text-sm font-semibold">Technical verification of generated outputs</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Expected artifacts, label alignment, finite numerics and readable outputs are checked
              against what the workflow actually produced.
            </p>
            <div className="mt-3 divide-y divide-border rounded-md border border-border bg-card px-3">
              <FragmentRow icon={<CheckCircle2 className="size-3.5 shrink-0 text-verified" aria-hidden />} label="labels aligned to obs" value="2,400 / 2,400" mono />
              <FragmentRow icon={<CheckCircle2 className="size-3.5 shrink-0 text-verified" aria-hidden />} label="embedding finite" value="pass" />
              <FragmentRow icon={<AlertTriangle className="size-3.5 shrink-0 text-warning" aria-hidden />} label="package versions" value="unavailable" />
            </div>
          </article>

          {/* 4. Provenance-linked reporting */}
          <article className="rounded-lg border border-border bg-background p-4">
            <h3 className="text-sm font-semibold">Provenance-linked reporting</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Reports reference the run, dataset fingerprint, configuration, seed and artifact
              checksums, so results can be traced back to their inputs.
            </p>
            <div className="mt-3 divide-y divide-border rounded-md border border-border bg-card px-3">
              <FragmentRow icon={<ScrollText className="size-3.5 shrink-0 text-teal" aria-hidden />} label="run id" value="RUN-2026-0142" mono />
              <FragmentRow icon={<ScanSearch className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />} label="dataset fingerprint" value="fnv1a:9c41d2a7" mono />
              <FragmentRow icon={<FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />} label="report version" value="report v1" />
            </div>
          </article>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {(
            [
              { icon: Cog, label: "3 approved workflows" },
              { icon: Route, label: "4-way typed routing" },
              { icon: ShieldCheck, label: "8 pipeline stages" },
              { icon: ClipboardCheck, label: "5 evidence states" },
            ] as const
          ).map((s) => (
            <span
              key={s.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground/85"
            >
              <s.icon className="size-3.5 text-teal" aria-hidden />
              {s.label}
            </span>
          ))}
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p className="text-sm leading-relaxed text-foreground/90">
            <span className="font-medium">Technical verification helps establish whether expected
            computational checks passed. It does not, by itself, establish biological validity.</span>{" "}
            The interface keeps this distinction visible throughout: green checks describe artifacts
            and execution requirements, never biological truth.
          </p>
        </div>

        {/* Five evidence states */}
        <div className="mt-6 rounded-lg border border-border bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Five evidence states, applied to every claim</h3>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
              in every report
            </p>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Report statements are classified by their linked evidence — not by tone or confidence.
            The same vocabulary is applied to findings, patterns and explicitly unverified
            interpretations.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {EVIDENCE_STATE_ITEMS.map((s) => (
              <div
                key={s.label}
                className="rounded-md border border-border bg-card p-3"
              >
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <s.icon className={cn("size-3.5 shrink-0", s.className)} aria-hidden />
                  {s.label}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{s.hint}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          UI fragments above are illustrative examples of the record types, rendered with local demo
          data. In this build, claim classification is produced by the demo adapter; in the full
          system it is evaluated against the workflow&apos;s evidence contract.
        </p>
      </div>
    </section>
  );
}

const EVIDENCE_STATE_ITEMS = [
  {
    icon: CheckCircle2,
    label: "Supported",
    className: "text-verified",
    hint: "Linked evidence supports the claim under stated checks.",
  },
  {
    icon: CircleDot,
    label: "Plausible",
    className: "text-teal",
    hint: "Consistent with the claim, but does not establish it.",
  },
  {
    icon: FlaskConical,
    label: "Hypothesis",
    className: "text-warning",
    hint: "A possible interpretation needing further testing.",
  },
  {
    icon: XCircle,
    label: "Unsupported",
    className: "text-error",
    hint: "Available evidence does not support the claim as stated.",
  },
  {
    icon: CircleDashed,
    label: "Indeterminate",
    className: "text-muted-foreground",
    hint: "Insufficient information to assess the claim.",
  },
] as const;

/* ---------- Research context ---------- */

const RELATED_WORK = [
  {
    name: "SpatialAgent",
    venue: "bioRxiv · 2025",
    url: "https://www.biorxiv.org/content/10.1101/2025.04.03.646459v1",
    note: "Autonomous agent for spatial biology with dynamic code generation.",
  },
  {
    name: "STAgent",
    venue: "GitHub · LiuLab, Harvard",
    url: "https://github.com/LiuLab-Bioelectronics-Harvard/STAgent",
    note: "Guides spatial analysis input-to-interpretation with generated code.",
  },
  {
    name: "BixBench",
    venue: "arXiv · 2503.00096",
    url: "https://arxiv.org/abs/2503.00096",
    note: "Frontier models reach ≈17% open-answer accuracy on real bioinformatics tasks.",
  },
  {
    name: "BioAgents",
    venue: "Sci Rep · 2025",
    url: "https://www.nature.com/articles/s41598-025-25919-z",
    note: "Multi-agent bioinformatics analysis; gap analysis of agent reliability.",
  },
  {
    name: "Laya",
    venue: "GitHub · selector",
    url: "https://github.com/NandhaKishorM/laya",
    note: "Non-generative typed decision engine — BioAgent-ST's planned selector.",
  },
] as const;

export function ResearchContextSection() {
  return (
    <section
      id="research-context"
      className="border-t border-border bg-card py-12"
      aria-labelledby="research-context-title"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Research context
        </p>
        <h2 id="research-context-title" className="mt-1 text-xl font-semibold tracking-tight">
          Why constrain the agent?
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Autonomous agents for spatial biology can generate and execute analysis code directly. That
          flexibility is powerful, but it moves the hard question — did the right analysis run, on
          suitable data, with checkable outputs? — out of view. BioAgent-ST is an intentionally
          bounded alternative, positioned as a research contribution rather than a product claim.
        </p>

        <div className="mt-7 grid gap-4 lg:grid-cols-2">
          <article className="rounded-lg border border-border bg-background p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Bot className="size-4 text-muted-foreground" aria-hidden />
              The autonomous pattern
            </h3>
            <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
              <li className="flex gap-2.5">
                <XCircle className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
                <span>
                  Model-generated code executes with few structural limits; correctness depends on
                  the model&apos;s judgment in the moment.
                </span>
              </li>
              <li className="flex gap-2.5">
                <XCircle className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
                <span>
                  Benchmarks report low open-ended accuracy for frontier models on real
                  bioinformatics tasks — plausible output is easy, verified output is not.
                </span>
              </li>
              <li className="flex gap-2.5">
                <XCircle className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
                <span>
                  Failures and silent substitutions are hard to detect after the fact when the
                  execution path is not recorded as evidence.
                </span>
              </li>
            </ul>
          </article>

          <article className="rounded-lg border border-teal/30 bg-teal/[0.04] p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Lock className="size-4 text-teal" aria-hidden />
              BioAgent-ST&apos;s constrained stance
            </h3>
            <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-foreground/85">
              <li className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-verified" aria-hidden />
                <span>
                  A typed selector chooses from an allowlist of four outcomes — three workflows plus
                  explicit abstention. No arbitrary code execution, ever.
                </span>
              </li>
              <li className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-verified" aria-hidden />
                <span>
                  Registered deterministic workflows (Scanpy/Squidpy) perform calculations with
                  recorded configuration and seeds.
                </span>
              </li>
              <li className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-verified" aria-hidden />
                <span>
                  Evidence contracts, technical verification and a provenance ledger make every run
                  inspectable, testable and replayable — including its failures.
                </span>
              </li>
            </ul>
          </article>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="rounded-lg border border-border bg-background p-4">
            <h3 className="text-sm font-semibold">Related systems and evidence</h3>
            <ul className="mt-2 divide-y divide-border rounded-md border border-border">
              {RELATED_WORK.map((w) => (
                <li key={w.name} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2">
                  <a
                    href={w.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
                  >
                    {w.name}
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                  <span className="text-[10px] font-mono text-muted-foreground">{w.venue}</span>
                  <span className="basis-full text-[11px] leading-snug text-muted-foreground">
                    {w.note}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Links are provided for context only — listed systems are independent projects; their
              appearance here is not an evaluation or endorsement.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                Working title
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-foreground/85">
                BioAgent-ST: Constrained Workflow Selection and Evidence-Linked Verification for
                Reproducible Spatial Transcriptomics Exploration
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                Evaluation focus
              </p>
              <ul className="mt-1.5 space-y-1 text-[11px] leading-snug text-muted-foreground">
                <li>RQ1 routing reliability · RQ2 fault detection</li>
                <li>RQ3 traceability · RQ4 Laya vs rules</li>
                <li>RQ5 safe caution on unsupported requests</li>
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full justify-between"
                onClick={() => navigateTo(APP_ROUTES.evaluation)}
              >
                Open the evaluation protocol
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Limitations ---------- */

export function LimitationsSection() {
  return (
    <section className="border-t border-border bg-background py-12" aria-labelledby="limitations-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Scope</p>
        <h2 id="limitations-title" className="mt-1 text-xl font-semibold tracking-tight">
          Limitations
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <ul className="space-y-3 rounded-lg border border-border bg-card p-5 text-sm leading-relaxed text-muted-foreground">
            <li className="flex gap-2.5">
              <XCircle className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
              <span>
                BioAgent-ST assists with <span className="font-medium text-foreground">bounded analysis workflows</span>{" "}
                on supported datasets. It is not a system for autonomous biological discovery, and its
                outputs are starting points for researcher review, not conclusions.
              </span>
            </li>
            <li className="flex gap-2.5">
              <XCircle className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
              <span>
                Verification is technical: it checks artifacts, alignment and finiteness. It does not
                prove that a result is biologically valid, causal, or clinically meaningful.
              </span>
            </li>
            <li className="flex gap-2.5">
              <XCircle className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
              <span>
                Computational clusters are groupings of expression patterns. They are not
                automatically cell types, tissue domains or disease mechanisms.
              </span>
            </li>
            <li className="flex gap-2.5">
              <XCircle className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
              <span>
                Evaluation metrics for selector routing, fault detection and traceability are planned
                research measurements. None are reported as measured performance in this prototype.
              </span>
            </li>
          </ul>
          <div className="rounded-lg border border-border bg-secondary/50 p-5">
            <h3 className="text-sm font-semibold">What this prototype is</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A research frontend demonstrating the intended interaction model: constrained workflow
              selection, policy decisions, technical verification and provenance-linked reporting.
              In this build all scientific data is generated locally and labeled as illustrative;
              a real deployment replaces the demo adapter with the scientific backend.
            </p>
            <h3 className="mt-4 text-sm font-semibold">What it does not claim</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The system is not described as hallucination-free, universally reliable, clinically
              validated, or guaranteed to be scientifically correct. Failures and incomplete runs are
              preserved in the interface rather than hidden.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */

export function LandingFooter() {
  return (
    <footer id="documentation" className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Wordmark />
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            An evidence-aware workflow assistant for spatial transcriptomics. Research prototype built
            for the BioAgent-ST project: natural-language questions, approved workflows, technical
            verification and reproducible reports.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-xs sm:grid-cols-3">
          <div>
            <p className="font-medium text-foreground">Sections</p>
            <ul className="mt-2 space-y-1.5 text-muted-foreground">
              {NAV_LINKS.map((l) => (
                <li key={l.label}>
                  <a className="hover:text-foreground" href={l.href}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">Project</p>
            <ul className="mt-2 space-y-1.5 text-muted-foreground">
              <li className="flex items-start gap-1.5">
                <Github className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <a
                  className="hover:text-foreground"
                  href="https://github.com/thekarak/BioAgent-ST"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  BioAgent-ST (backend)
                </a>
              </li>
              <li className="flex items-start gap-1.5">
                <Github className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <a
                  className="hover:text-foreground"
                  href="https://github.com/NandhaKishorM/laya"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Laya selector
                </a>
              </li>
              <li className="flex items-start gap-1.5">
                <Github className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>This frontend repository link will be added when it is published.</span>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">Documentation</p>
            <p className="mt-2 flex items-start gap-1.5 text-muted-foreground">
              <BookOpen className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Project documentation has not been published yet; this link will be added when the
              documentation is available.
            </p>
          </div>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-3 text-[11px] text-muted-foreground sm:px-6">
          BioAgent-ST research prototype · All demo content is illustrative and generated locally in
          your browser.
        </p>
      </div>
    </footer>
  );
}
