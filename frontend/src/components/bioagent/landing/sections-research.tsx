"use client";

/**
 * Landing page sections, part 2 — minimal editorial style: research context
 * (autonomous vs constrained comparison + related work), the ink CTA band
 * and the footer. The former "Limitations" section was removed per design
 * review; its honest caveats live on in the workspace UI and evaluation page.
 */

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Github, ExternalLink } from "lucide-react";
import { Wordmark } from "@/components/bioagent/common/Wordmark";
import { navigateTo, APP_ROUTES } from "@/lib/bioagent/router";
import { cn } from "@/lib/utils";
import { Section, SectionHeader, staggerContainer, riseItem } from "./section-kit";
import { TiltCard } from "./tilt";

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

const COMPARISON_ROWS = [
  {
    aspect: "Code execution",
    autonomous: "Model-generated code executes with few structural limits; correctness depends on the model's judgment in the moment.",
    constrained: "A typed selector chooses from an allowlist of four outcomes — three workflows plus explicit abstention. No arbitrary code execution.",
  },
  {
    aspect: "Reliability",
    autonomous: "Benchmarks report low open-ended accuracy for frontier models on real bioinformatics tasks — plausible output is easy, verified output is not.",
    constrained: "Registered deterministic workflows (Scanpy/Squidpy) perform calculations with recorded configuration and seeds.",
  },
  {
    aspect: "Failure handling",
    autonomous: "Failures and silent substitutions are hard to detect after the fact when the execution path is not recorded as evidence.",
    constrained: "Evidence contracts, technical verification and a provenance ledger make every run inspectable, testable and replayable — including its failures.",
  },
] as const;

export function ResearchContextSection() {
  return (
    <section aria-label="Research context" className="border-t border-[var(--ba-border)]">
      <Section id="research-context" className="py-20 sm:py-24">
        <SectionHeader
          eyebrow="05 · Research context"
          title="Why constrain the agent?"
          lead={
            <p>
              Autonomous agents for spatial biology can generate and execute analysis code
              directly. That flexibility is powerful, but it moves the hard question — did the
              right analysis run, on suitable data, with checkable outputs? — out of view.
              BioAgent-ST is an intentionally bounded alternative, positioned as a research
              contribution rather than a product claim.
            </p>
          }
        />

        {/* Comparison table */}
        <motion.div
          variants={riseItem}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="ba-glass-strong mt-10 overflow-x-auto rounded-lg border border-[var(--ba-border)]"
        >
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--ba-border)]">
                <th className="w-[160px] px-5 py-3.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--ba-faint)]">
                  Aspect
                </th>
                <th className="px-5 py-3.5 text-sm font-medium text-[var(--ba-muted)]">
                  The autonomous pattern
                </th>
                <th className="border-l border-[var(--ba-border)] px-5 py-3.5 text-sm font-semibold text-[var(--ba-ink)]">
                  BioAgent-ST&apos;s constrained stance
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.aspect} className="border-b border-[var(--ba-divider)] last:border-b-0">
                  <td className="px-5 py-4 align-top text-[13px] font-medium text-[var(--ba-ink)]">
                    {row.aspect}
                  </td>
                  <td className="px-5 py-4 align-top text-[13px] leading-relaxed text-[var(--ba-muted)]">
                    {row.autonomous}
                  </td>
                  <td className="border-l border-[var(--ba-border)] px-5 py-4 align-top text-[13px] leading-relaxed text-[var(--ba-body)]">
                    {row.constrained}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* Related work + project framing */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
        >
          <motion.div variants={riseItem}>
            <TiltCard className="ba-glass relative h-full rounded-lg border border-[var(--ba-border)] p-5">
            <h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--ba-faint)]">
              Related systems and evidence
            </h3>
            <ol className="mt-3 divide-y divide-[var(--ba-divider)]">
              {RELATED_WORK.map((w, i) => (
                <li key={w.name} className="group flex flex-wrap items-baseline gap-x-2 px-1 py-2.5">
                  <span className="font-mono text-[10px] text-[var(--ba-faint)]">[{i + 1}]</span>
                  <a
                    href={w.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--ba-ink)] transition-colors hover:underline"
                  >
                    {w.name}
                    <ExternalLink className="size-3 text-[var(--ba-faint)]" aria-hidden />
                  </a>
                  <span className="font-mono text-[10px] text-[var(--ba-faint)]">{w.venue}</span>
                  <span className="basis-full pl-6 text-xs leading-snug text-[var(--ba-muted)]">
                    {w.note}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--ba-faint)]">
              Links are provided for context only — listed systems are independent projects; their
              appearance here is not an evaluation or endorsement.
            </p>
            </TiltCard>
          </motion.div>

          <div className="flex flex-col gap-4">
            <motion.div variants={riseItem}>
              <TiltCard className="ba-glass relative h-full rounded-lg border border-[var(--ba-border)] p-5">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--ba-faint)]">
                Working title
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--ba-body)]">
                BioAgent-ST: Constrained Workflow Selection and Evidence-Linked Verification for
                Reproducible Spatial Transcriptomics Exploration
              </p>
              </TiltCard>
            </motion.div>
            <motion.div variants={riseItem}>
              <TiltCard className="ba-glass relative h-full rounded-lg border border-[var(--ba-border)] p-5">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--ba-faint)]">
                Evaluation focus
              </p>
              <ul className="mt-2 space-y-1 font-mono text-[11px] leading-snug text-[var(--ba-muted)]">
                <li>RQ1 routing reliability · RQ2 fault detection</li>
                <li>RQ3 traceability · RQ4 Laya vs rules</li>
                <li>RQ5 safe caution on unsupported requests</li>
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full justify-between border-[var(--ba-input)] bg-[var(--ba-bg)] text-[var(--ba-ink)] hover:bg-[var(--ba-paper)] hover:text-[var(--ba-ink)]"
                onClick={() => navigateTo(APP_ROUTES.evaluation)}
              >
                Open the evaluation protocol
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
              </TiltCard>
            </motion.div>
          </div>
        </motion.div>
      </Section>
    </section>
  );
}

/* ---------- CTA band ---------- */

export function CtaBanner() {
  return (
    <section
      id="cta"
      aria-labelledby="cta-title"
      className="ba-cta py-24 text-[var(--ba-bg)] sm:py-28"
    >
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--ba-onink-soft)]">
            Every stage inspectable
          </p>
          <h2
            id="cta-title"
            className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ba-bg)] sm:text-4xl"
          >
            Step through the pipeline yourself
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--ba-onink)]">
            Open the workspace, run a demo analysis end to end and inspect the evidence it leaves
            behind — every stage is inspectable in this prototype.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              className="bg-[var(--ba-bg)] text-[var(--ba-ink)] transition-colors hover:bg-[var(--ba-hover-soft)]"
              onClick={() => navigateTo(APP_ROUTES.overview)}
            >
              Open research workspace
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-[var(--ba-onink-border)] bg-transparent text-[var(--ba-bg)] transition-colors hover:bg-[var(--ba-onink-wash)] hover:text-[var(--ba-bg)]"
              onClick={() => navigateTo(APP_ROUTES.evaluation)}
            >
              View the evaluation protocol
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */

export function LandingFooter() {
  return (
    <footer id="documentation" className="ba-glass relative z-10 border-t border-[var(--ba-border)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Wordmark neutral />
          <p className="mt-3 text-xs leading-relaxed text-[var(--ba-muted)]">
            An evidence-aware workflow assistant for spatial transcriptomics. Research prototype
            built for the BioAgent-ST project: natural-language questions, approved workflows,
            technical verification and reproducible reports.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-xs sm:grid-cols-3">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--ba-faint)]">
              Sections
            </p>
            <ul className="mt-3 space-y-2 text-[var(--ba-muted)]">
              <li>
                <a className="transition-colors hover:text-[var(--ba-ink)]" href="#top">
                  Overview
                </a>
              </li>
              <li>
                <a className="transition-colors hover:text-[var(--ba-ink)]" href="#workflows">
                  Workflow
                </a>
              </li>
              <li>
                <a className="transition-colors hover:text-[var(--ba-ink)]" href="#evidence">
                  Evidence
                </a>
              </li>
              <li>
                <a className="transition-colors hover:text-[var(--ba-ink)]" href="#research-context">
                  Research context
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--ba-faint)]">
              Project
            </p>
            <ul className="mt-3 space-y-2 text-[var(--ba-muted)]">
              <li className="flex items-start gap-1.5">
                <Github className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <a
                  className="transition-colors hover:text-[var(--ba-ink)]"
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
                  className="transition-colors hover:text-[var(--ba-ink)]"
                  href="https://github.com/NandhaKishorM/laya"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Laya selector
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--ba-faint)]">
              Status
            </p>
            <ul className="mt-3 space-y-2 text-[var(--ba-muted)]">
              <li className="leading-relaxed">
                Documentation and the frontend repository will be published with the first public
                release.
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-[var(--ba-divider)]">
        <p className={cn("mx-auto max-w-6xl px-4 py-3 text-[11px] text-[var(--ba-muted)] sm:px-6")}>
          BioAgent-ST research prototype · All demo content is illustrative and generated locally
          in your browser.
        </p>
      </div>
    </footer>
  );
}
