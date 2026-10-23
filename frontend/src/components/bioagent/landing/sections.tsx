"use client";

/**
 * Landing page sections, part 1 — minimal editorial style: fixed navigation,
 * hairline stat band, the scroll-lit pipeline, restrained workflow cards and
 * the evidence section with its interactive five-state legend.
 */

import * as React from "react";
import {
  motion,
  useScroll,
  useSpring,
  useMotionValueEvent,
  AnimatePresence,
} from "framer-motion";
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
} from "lucide-react";
import { Wordmark } from "@/components/bioagent/common/Wordmark";
import { navigateTo, APP_ROUTES } from "@/lib/bioagent/router";
import { useBioAgentStore } from "@/lib/bioagent/store";
import { WORKFLOWS, WORKFLOW_ORDER } from "@/lib/bioagent/workflows";
import type { WorkflowId } from "@/lib/bioagent/types";
import { cn } from "@/lib/utils";
import { useScrollSpy, useReveal, useCountUp } from "./motion";
import { TiltCard } from "./tilt";
import { Section, SectionHeader, NAV_LINKS, staggerContainer, riseItem } from "./section-kit";
import { ThemeToggle } from "./theme";

/* ---------- Navigation ---------- */

const SCROLL_SPY_SECTIONS = ["hero", "workflows", "evidence", "research-context", "documentation"] as const;

export function LandingNav() {
  const [scrolled, setScrolled] = React.useState(false);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });
  const active = useScrollSpy(SCROLL_SPY_SECTIONS, "hero");

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="ba-nav fixed inset-x-0 top-0 z-40" data-scrolled={scrolled}>
      {/* reading progress (spring-smoothed) */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-[2px] overflow-hidden">
        <motion.div style={{ scaleX }} className="h-full origin-left bg-[var(--ba-ink)]" />
      </div>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#top" className="ba-focus rounded-md" aria-label="BioAgent-ST home">
          <Wordmark neutral />
        </a>
        <nav className="hidden items-center gap-6 md:flex" aria-label="Landing sections">
          {NAV_LINKS.map((l) => {
            const id = l.href === "#top" ? "hero" : l.href.slice(1);
            const isActive = active === id;
            return (
              <a
                key={l.label}
                href={l.href}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "ba-focus relative rounded-md py-1 text-[13px] transition-colors",
                  isActive ? "text-[var(--ba-ink)]" : "text-[var(--ba-muted)] hover:text-[var(--ba-ink)]",
                )}
              >
                {l.label}
                {isActive && (
                  <motion.span
                    layoutId="ba-nav-underline"
                    transition={{ type: "spring", stiffness: 380, damping: 34 }}
                    className="absolute inset-x-0 -bottom-0.5 h-px bg-[var(--ba-ink)]"
                    aria-hidden
                  />
                )}
              </a>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            size="sm"
            className="bg-[var(--ba-ink)] text-[var(--ba-bg)] transition-colors hover:bg-[var(--ba-ink-hover)]"
            onClick={() => navigateTo(APP_ROUTES.overview)}
          >
            Open workspace
            <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ---------- Stat band ---------- */

const STATS = [
  { value: 3, label: "Approved workflows" },
  { value: 4, label: "Typed routing outcomes" },
  { value: 8, label: "Pipeline stages" },
  { value: 5, label: "Evidence states" },
] as const;

function StatItem({
  value,
  label,
  delay,
}: {
  value: number;
  label: string;
  delay: number;
}) {
  const [ref, visible] = useReveal<HTMLDivElement>();
  const count = useCountUp(value, visible);
  return (
    <div
      ref={ref}
      data-visible={visible ? "true" : "false"}
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
      className="ba-reveal px-2 py-8 text-center md:py-10"
    >
      <p className="text-3xl font-semibold tabular-nums tracking-tight text-[var(--ba-ink)] sm:text-4xl">
        {count}
      </p>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--ba-muted)]">
        {label}
      </p>
    </div>
  );
}

export function StatBand() {
  return (
    <section aria-label="System highlights" className="ba-glass border-y border-[var(--ba-border)]">
      <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-[var(--ba-border)] px-4 sm:px-6 md:grid-cols-4">
        {STATS.map((s, i) => (
          <StatItem key={s.label} value={s.value} label={s.label} delay={i * 80} />
        ))}
      </div>
    </section>
  );
}

/* ---------- Pipeline: scroll-lit stage strip ---------- */

const PIPELINE_STAGES = [
  { n: 1, label: "Request", icon: Inbox, detail: "A natural-language research question and a dataset reference enter the pipeline." },
  { n: 2, label: "Validate", icon: ScanSearch, detail: "The dataset is checked before anything runs: dimensions, identifiers, spatial coordinates and which metrics are available. Unavailable metrics stay unavailable." },
  { n: 3, label: "Select", icon: Route, detail: "The typed selector maps the request onto the registered workflow set — three workflows plus explicit abstention. No arbitrary code is generated." },
  { n: 4, label: "Policy gate", icon: ShieldCheck, detail: "An explicit ALLOW, REVIEW or BLOCK decision is recorded with its reason before any scientific code runs. This is the boundary between assistance and execution." },
  { n: 5, label: "Execute", icon: Cog, detail: "The registered, deterministic workflow performs the computation with recorded configuration and seed." },
  { n: 6, label: "Verify", icon: ClipboardCheck, detail: "Expected artifacts, label alignment, finite numerics and readable outputs are checked against what the workflow actually produced." },
  { n: 7, label: "Record evidence", icon: ScrollText, detail: "Every input, decision and artifact is written to the provenance ledger, so the run can be inspected and replayed later." },
  { n: 8, label: "Report", icon: FileText, detail: "Findings are assembled into a reproducible report in which every claim carries one of five evidence states." },
] as const;

export function PipelineStrip() {
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ["start 0.85", "end 0.5"],
  });
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 24 });
  const [litCount, setLitCount] = React.useState(0);
  const [focused, setFocused] = React.useState<number | null>(null);

  useMotionValueEvent(smooth, "change", (v) => {
    setLitCount(Math.max(0, Math.min(PIPELINE_STAGES.length, Math.round(v * PIPELINE_STAGES.length))));
  });

  const focusedStage = focused !== null ? PIPELINE_STAGES[focused] : null;

  return (
    <Section id="workflows" className="py-20 sm:py-24">
      <SectionHeader
        eyebrow="02 · Analysis pipeline"
        title="Eight stages, two boundaries"
        lead={
          <p>
            A research question moves through validation, workflow selection and a policy
            decision before any scientific code runs. Execution, verification and evidence
            recording follow — selection and execution are separate operations.{" "}
            <span className="text-[var(--ba-ink)]">Scroll to trace a request through the stages.</span>
          </p>
        }
      />

      <div ref={stageRef} className="mt-12">
        <div className="relative overflow-x-auto pb-2">
          <div className="relative min-w-[640px] px-1 py-6">
            {/* base track + progress fill */}
            <div aria-hidden className="absolute inset-x-0 top-[43px] h-px bg-[var(--ba-border)]" />
            <div
              aria-hidden
              className="ba-pipe-fill absolute left-0 top-[43px] h-px bg-[var(--ba-ink)]"
              style={{ width: `${(litCount / PIPELINE_STAGES.length) * 100}%` }}
            />
            {/* decision boundary between selection (03) and execution (05) */}
            <span
              aria-hidden
              className="absolute left-1/2 top-4 h-16 -translate-x-1/2 border-l border-dashed border-[var(--ba-warn-soft)]"
            />
            <span className="absolute left-1/2 top-[76px] -translate-x-1/2 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--ba-warn)]">
              decision boundary
            </span>

            <ol className="relative flex items-start justify-between" aria-label="Pipeline stages">
              {PIPELINE_STAGES.map((s, i) => {
                const lit = i < litCount;
                const isFocused = focused === i;
                return (
                  <li key={s.n} className="flex w-[72px] shrink-0 flex-col items-center">
                    <button
                      type="button"
                      aria-pressed={isFocused}
                      onClick={() => setFocused(isFocused ? null : i)}
                      data-lit={lit ? "true" : "false"}
                      data-current={lit && i === litCount - 1 ? "true" : "false"}
                      className="ba-pipe-node ba-focus flex w-full flex-col items-center gap-1.5 rounded-lg p-1"
                    >
                      <span
                        className={cn(
                          "ba-pipe-circle relative flex size-11 items-center justify-center rounded-full border transition-colors",
                          lit
                            ? "border-[var(--ba-ink)] bg-[var(--ba-ink)] text-[var(--ba-bg)]"
                            : "border-[var(--ba-border)] bg-[var(--ba-bg)] text-[var(--ba-faint)]",
                          )}
                        aria-hidden
                      >
                        <s.icon className="size-[18px]" />
                      </span>
                      <span className="font-mono text-[10px] text-[var(--ba-faint)]">
                        {String(s.n).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] font-medium leading-tight transition-colors",
                          lit ? "text-[var(--ba-ink)]" : "text-[var(--ba-muted)]",
                        )}
                      >
                        {s.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        {/* stage detail / hint */}
        <div className="mt-6">
          <AnimatePresence mode="wait" initial={false}>
            {focusedStage ? (
              <motion.div
                key={`stage-${focusedStage.n}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="ba-glass-strong rounded-lg border border-[var(--ba-border)] p-5"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--ba-muted)]">
                  Stage {String(focusedStage.n).padStart(2, "0")} —{" "}
                  <span className="font-sans text-[12px] font-medium normal-case tracking-normal text-[var(--ba-ink)]">
                    {focusedStage.label}
                  </span>
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ba-body)]">{focusedStage.detail}</p>
              </motion.div>
            ) : (
              <motion.div
                key="stage-hint"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[var(--ba-muted)]"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-px border-l border-dashed border-[var(--ba-warn-soft)]" aria-hidden />
                  Stages 1–4 — request handling and policy decision (AI-assisted selection, no arbitrary code)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[var(--ba-ink)]" aria-hidden />
                  Stages 4–8 — registered scientific execution and evidence recording
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-mono">↳</span>
                  Click any stage for details
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Section>
  );
}

/* ---------- Workflow cards ---------- */

const WORKFLOW_ICONS = { quality_assessment: ScanSearch, spatial_clustering: Route, gene_expression: Cog } as const;

export function WorkflowCards() {
  const setPendingWorkflow = useBioAgentStore((s) => s.setPendingWorkflow);
  const openWorkflow = (w: WorkflowId) => {
    setPendingWorkflow(w);
    navigateTo(APP_ROUTES.newAnalysis);
  };
  return (
    <section
      id="approved-workflows"
      aria-label="Approved workflows"
      className="border-t border-[var(--ba-border)]"
    >
      <Section className="py-20 sm:py-24">
        <SectionHeader
          eyebrow="03 · Approved workflows"
          title="Three bounded scientific workflows"
          lead={
            <p>
              BioAgent-ST constrains analysis to a registered set. Unrestricted AI-generated code
              does not execute scientific operations; requests either map to one of these
              workflows or are held for review. Each card opens the workflow directly.
            </p>
          }
        />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="mt-10 grid items-stretch gap-4 md:grid-cols-3"
        >
          {WORKFLOW_ORDER.map((id) => {
            const spec = WORKFLOWS[id];
            const Icon = WORKFLOW_ICONS[id];
            return (
              <motion.div key={id} variants={riseItem} className="h-full">
                <TiltCard
                  role="button"
                  tabIndex={0}
                  aria-label={`Open the ${spec.title} workflow`}
                  onClick={() => openWorkflow(id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openWorkflow(id);
                    }
                  }}
                  className="ba-glass ba-focus group relative flex h-full cursor-pointer flex-col rounded-lg border border-[var(--ba-border)] p-6 hover:border-[var(--ba-ink-soft)] hover:shadow-[0_2px_16px_var(--ba-shadow-c)]"
                >
                  <div className="flex items-start justify-between">
                    <span
                      className="flex size-9 items-center justify-center rounded-md border border-[var(--ba-border)] bg-[var(--ba-paper)] text-[var(--ba-ink)]"
                      aria-hidden
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="font-mono text-[11px] text-[var(--ba-faint)]">
                      Workflow {String(WORKFLOW_ORDER.indexOf(id) + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-4 text-[15px] font-semibold text-[var(--ba-ink)]">{spec.title}</h3>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[var(--ba-body)]">
                    {spec.purpose}
                  </p>
                  <p className="mt-4 border-t border-[var(--ba-border)] pt-3 text-xs leading-relaxed text-[var(--ba-muted)]">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em]">
                      Representative output
                    </span>
                    <br />
                    {spec.representativeOutput}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--ba-ink)]">
                    Open workflow
                    <ArrowRight
                      className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </TiltCard>
              </motion.div>
            );
          })}
        </motion.div>
      </Section>
    </section>
  );
}

/* ---------- Evidence & verification ---------- */

function FragmentRow({
  dot,
  label,
  value,
  mono = false,
}: {
  dot: string;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-xs">
      <span className="inline-flex min-w-0 items-center gap-2 text-[var(--ba-body)]">
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: dot }}
          aria-hidden
        />
        <span className="truncate">{label}</span>
      </span>
      <span className={cn("shrink-0 text-[var(--ba-ink)]", mono && "font-mono text-[11px]")}>{value}</span>
    </div>
  );
}

const GREEN = "var(--ba-ok)";
const AMBER = "var(--ba-warn)";
const GREY = "var(--ba-neutral)";
const CYAN = "var(--ba-info)";

export function EvidenceSection() {
  return (
    <section aria-label="Research approach" className="border-t border-[var(--ba-border)]">
      <Section id="evidence" className="py-20 sm:py-24">
        <SectionHeader
          eyebrow="04 · Evidence & verification"
          title="Every run should leave an inspectable record."
          lead={
            <p>
              Each stage of the pipeline contributes evidence: what was asked, what was validated,
              which workflow was selected, what the policy decided, and which artifacts were
              produced. The records below preview the four types a researcher can audit after a
              run.
            </p>
          }
        />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="mt-10 grid gap-4 sm:grid-cols-2"
        >
          {/* 1. Input & schema validation */}
          <motion.article
            variants={riseItem}
            className="h-full"
          >
            <TiltCard className="ba-glass relative h-full rounded-lg border border-[var(--ba-border)] p-5 hover:border-[var(--ba-ink-soft)]">
            <h3 className="text-sm font-semibold text-[var(--ba-ink)]">Input and schema validation</h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--ba-muted)]">
              The dataset is checked before any workflow runs: dimensions, identifiers, coordinate
              availability. Unavailable metrics stay unavailable.
            </p>
            <div className="mt-3 divide-y divide-[var(--ba-divider)] rounded-md border border-[var(--ba-border)] bg-[var(--ba-paper)] px-3">
              <FragmentRow dot={GREEN} label="obs × var" value="2,400 × 500" mono />
              <FragmentRow dot={GREEN} label="obsm['spatial']" value="present" />
              <FragmentRow dot={AMBER} label="obs['mt_fraction']" value="not assessed" />
            </div>
          </TiltCard>
          </motion.article>

          {/* 2. Selection & policy */}
          <motion.article
            variants={riseItem}
            className="h-full"
          >
            <TiltCard className="ba-glass relative h-full rounded-lg border border-[var(--ba-border)] p-5 hover:border-[var(--ba-ink-soft)]">
            <h3 className="text-sm font-semibold text-[var(--ba-ink)]">
              Approved workflow selection and policy decision
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--ba-muted)]">
              The selector maps the request to a registered workflow; the policy gate decides
              ALLOW, REVIEW or BLOCK with an explicit reason before execution.
            </p>
            <div className="mt-3 divide-y divide-[var(--ba-divider)] rounded-md border border-[var(--ba-border)] bg-[var(--ba-paper)] px-3">
              <FragmentRow dot={CYAN} label="selector decision" value="spatial_clustering" mono />
              <FragmentRow dot={GREEN} label="policy" value="ALLOW" />
              <FragmentRow dot={GREY} label="matched signals" value="cluster, expression patterns" />
            </div>
          </TiltCard>
          </motion.article>

          {/* 3. Technical verification */}
          <motion.article
            variants={riseItem}
            className="h-full"
          >
            <TiltCard className="ba-glass relative h-full rounded-lg border border-[var(--ba-border)] p-5 hover:border-[var(--ba-ink-soft)]">
            <h3 className="text-sm font-semibold text-[var(--ba-ink)]">
              Technical verification of generated outputs
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--ba-muted)]">
              Expected artifacts, label alignment, finite numerics and readable outputs are
              checked against what the workflow actually produced.
            </p>
            <div className="mt-3 divide-y divide-[var(--ba-divider)] rounded-md border border-[var(--ba-border)] bg-[var(--ba-paper)] px-3">
              <FragmentRow dot={GREEN} label="labels aligned to obs" value="2,400 / 2,400" mono />
              <FragmentRow dot={GREEN} label="embedding finite" value="pass" />
              <FragmentRow dot={AMBER} label="package versions" value="unavailable" />
            </div>
          </TiltCard>
          </motion.article>

          {/* 4. Provenance-linked reporting */}
          <motion.article
            variants={riseItem}
            className="h-full"
          >
            <TiltCard className="ba-glass relative h-full rounded-lg border border-[var(--ba-border)] p-5 hover:border-[var(--ba-ink-soft)]">
            <h3 className="text-sm font-semibold text-[var(--ba-ink)]">Provenance-linked reporting</h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--ba-muted)]">
              Reports reference the run, dataset fingerprint, configuration, seed and artifact
              checksums, so results can be traced back to their inputs.
            </p>
            <div className="mt-3 divide-y divide-[var(--ba-divider)] rounded-md border border-[var(--ba-border)] bg-[var(--ba-paper)] px-3">
              <FragmentRow dot={CYAN} label="run id" value="RUN-2026-0142" mono />
              <FragmentRow dot={GREY} label="dataset fingerprint" value="fnv1a:9c41d2a7" mono />
              <FragmentRow dot={GREY} label="report version" value="report v1" />
            </div>
          </TiltCard>
          </motion.article>
        </motion.div>

        <div className="mt-6 max-w-3xl border-l-2 border-[var(--ba-ink)] pl-4">
          <p className="text-sm leading-relaxed text-[var(--ba-body)]">
            <span className="font-medium text-[var(--ba-ink)]">
              Technical verification establishes whether expected computational checks passed. It
              does not, by itself, establish biological validity.
            </span>{" "}
            The interface keeps this distinction visible throughout: green checks describe
            artifacts and execution requirements, never biological truth.
          </p>
        </div>

        {/* Five evidence states — interactive legend */}
        <EvidenceStates />

        <p className="mt-6 text-[11px] leading-relaxed text-[var(--ba-faint)]">
          Records above are illustrative examples of the record types, rendered with local demo
          data. In this build, claim classification is produced by the demo adapter; in the full
          system it is evaluated against the workflow&apos;s evidence contract.
        </p>
      </Section>
    </section>
  );
}

/* ---------- Five evidence states: interactive legend ---------- */

const EVIDENCE_STATE_ITEMS = [
  { label: "Supported", color: "var(--ba-ev-supported)", hint: "Linked evidence supports the claim under stated checks." },
  { label: "Plausible", color: "var(--ba-ev-plausible)", hint: "Consistent with the claim, but does not establish it." },
  { label: "Hypothesis", color: "var(--ba-ev-hypothesis)", hint: "A possible interpretation needing further testing." },
  { label: "Unsupported", color: "var(--ba-ev-unsupported)", hint: "Available evidence does not support the claim as stated." },
  { label: "Indeterminate", color: "var(--ba-ev-indeterminate)", hint: "Insufficient information to assess the claim." },
] as const;

const EVIDENCE_EXAMPLES: Record<string, string> = {
  Supported:
    "Cluster 2 shows enriched expression of the queried marker gene — the labels aligned (2,400 / 2,400) and the embedding is finite.",
  Plausible:
    "The Cluster 2 boundary is consistent with a tissue-domain edge, though the current checks do not establish it.",
  Hypothesis:
    "The graded expression across domain 4 may reflect zonation; a targeted follow-up workflow is required.",
  Unsupported:
    "A smooth expression gradient across the whole section is not supported by the computed embedding.",
  Indeterminate:
    "The relationship between domains 1 and 3 cannot be assessed from the recorded evidence.",
};

function EvidenceStates() {
  const [active, setActive] = React.useState<string>("Supported");
  const activeState =
    EVIDENCE_STATE_ITEMS.find((s) => s.label === active) ?? EVIDENCE_STATE_ITEMS[0];

  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] lg:gap-10">
      {/* legend list — the selector */}
      <div>
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--ba-muted)]">
          Five evidence states
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ba-body)]">
          Every statement in a report is classified by its linked evidence — not by tone or
          confidence. Select a state to see how it reads in practice.
        </p>
        <div
          role="tablist"
          aria-label="Evidence states"
          className="mt-4 flex flex-row flex-wrap gap-2 lg:flex-col"
        >
          {EVIDENCE_STATE_ITEMS.map((s) => {
            const isActive = active === s.label;
            return (
              <button
                key={s.label}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(s.label)}
                className={cn(
                  "ba-focus flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors lg:w-full",
                  isActive
                    ? "border-[var(--ba-ink-soft)] bg-[var(--ba-paper)]"
                    : "border-transparent hover:bg-[var(--ba-paper)]",
                )}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: s.color }}
                  aria-hidden
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    isActive ? "text-[var(--ba-ink)]" : "text-[var(--ba-body)]",
                  )}
                >
                  {s.label}
                </span>
                <span className="ml-auto hidden max-w-[190px] text-right text-[11px] leading-tight text-[var(--ba-faint)] xl:block">
                  {s.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* active-state explanation */}
      <div className="ba-glass-strong rounded-lg border border-[var(--ba-border)] p-6 lg:self-start">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="flex items-center gap-2.5">
              <span
                className="size-3 rounded-full"
                style={{ background: activeState.color }}
                aria-hidden
              />
              <span className="text-[15px] font-semibold text-[var(--ba-ink)]">{activeState.label}</span>
              <span className="rounded-full border border-[var(--ba-border)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--ba-muted)]">
                evidence state
              </span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ba-body)]">{activeState.hint}</p>
            <div className="mt-4 rounded-md border border-[var(--ba-border)] bg-[var(--ba-paper)] p-4" aria-live="polite">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--ba-muted)]">
                Example claim
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ba-ink)]">
                {EVIDENCE_EXAMPLES[active]}
              </p>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-[var(--ba-faint)]">
              The same vocabulary is applied to findings, patterns and explicitly unverified
              interpretations. Failures and incomplete runs are preserved in the interface
              rather than hidden.
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
