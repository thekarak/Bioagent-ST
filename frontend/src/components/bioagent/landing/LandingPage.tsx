"use client";

/**
 * Public landing page for BioAgent-ST.
 *
 * Structure: the whole page floats over a persistent WebGL world — a
 * deterministic particle field that morphs between seven formations as
 * the visitor scrolls (genome → tissue → pipeline → registry →
 * orbits → convergence → open field), tracked by the slim chapter rail
 * on the right. The interactive B-form DNA figure still anchors the
 * hero ("Fig. 1") and the tissue section follows as its own full-width
 * map ("Fig. 2"), both rendered on frosted-glass panels over the world.
 * The editorial frame stays minimal — hairlines, monospace figure
 * chrome, tabular data — while the dimensionality is ambient: every
 * section, card and figure sits in the same instrument.
 *
 * Themes: light "paper" by default; a scoped `ba-dark` token layer provides
 * the dark "observatory" theme. The inline script at the top of the root
 * applies a stored dark choice before first paint (no white flash), and the
 * workspace at /#/app/... is deliberately unaffected.
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronDown } from "lucide-react";
import { navigateTo, APP_ROUTES } from "@/lib/bioagent/router";
import { cn } from "@/lib/utils";
import { useLandingTheme } from "./theme";
import { BASES, BASE_COLORS, BP_COUNT } from "./three/dna-data";
import {
  LandingNav,
  StatBand,
  PipelineStrip,
  WorkflowCards,
  EvidenceSection,
} from "./sections";
import { TissueMapSection } from "./sections-map";
import {
  ResearchContextSection,
  CtaBanner,
  LandingFooter,
} from "./sections-research";
import { BackToTop } from "./motion";
import { WorldRail } from "./world-rail";

/* The WebGL figures are code-split so three.js stays out of the initial
   bundle. Until a figure loads (and whenever WebGL is unavailable) a static
   dot-grid helix serves as the panel background. */
const DnaFigure = dynamic(
  () => import("./three/DnaHelix").then((m) => m.DnaFigure),
  { ssr: false },
);

/* The persistent world behind every section — also code-split, decorative
   (aria-hidden) and disabled when the visitor prefers reduced motion. */
const WorldCanvas = dynamic(
  () => import("./three/LandingWorld").then((m) => m.LandingWorld),
  { ssr: false },
);

function wd(ms: number): React.CSSProperties {
  return { "--wd": `${ms}ms` } as React.CSSProperties;
}

/* Applies a stored dark-mode choice before first paint — no flash. */
const THEME_BOOT = `(function(){try{if(localStorage.getItem("ba-theme")==="dark"){var r=document.currentScript.closest(".ba-landing");if(r)r.classList.add("ba-dark");}}catch(e){}})();`;

export function LandingPage() {
  const { isDark } = useLandingTheme();
  const scrollToWorkflows = () =>
    document.getElementById("workflows")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div
      id="top"
      suppressHydrationWarning
      className={cn(
        "ba-landing relative flex min-h-screen flex-col bg-[var(--ba-bg)]",
        isDark && "ba-dark",
      )}
    >
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />

      {/* The persistent 3D world — a full-viewport WebGL particle field
          behind every section, morphing with scroll. Decorative only. */}
      <div className="ba-world" aria-hidden="true">
        <WorldCanvas />
      </div>

      <LandingNav />

      <main className="relative z-10 flex-1">
        {/* Hero — pitch on the left, the interactive DNA duplex on the right */}
        <section
          id="hero"
          aria-labelledby="hero-title"
          className="border-b border-[var(--ba-border)]"
        >
          <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-14 lg:pb-24 lg:pt-36">
            <div>
              <p
                className="ba-hero-word font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ba-muted)]"
                style={wd(0)}
              >
                Research prototype · Spatial transcriptomics
              </p>
              <h1
                id="hero-title"
                className="mt-4 text-[38px] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--ba-ink)] sm:text-5xl"
              >
                <span className="ba-hero-word" style={wd(60)}>
                  Spatial transcriptomics,
                </span>{" "}
                <span className="ba-hero-word" style={wd(140)}>
                  with evidence at
                </span>{" "}
                <span className="ba-hero-word" style={wd(220)}>
                  every step.
                </span>
              </h1>
              <p
                className="ba-hero-word mt-5 max-w-md text-[15px] leading-relaxed text-[var(--ba-body)]"
                style={wd(320)}
              >
                An evidence-aware workflow assistant that connects natural-language research
                questions to approved analysis workflows, technical verification, and
                reproducible reports.
              </p>
              <div
                className="ba-hero-word mt-7 flex flex-wrap items-center gap-3"
                style={wd(420)}
              >
                <Button
                  size="lg"
                  className="bg-[var(--ba-ink)] text-[var(--ba-bg)] transition-colors hover:bg-[var(--ba-ink-hover)]"
                  onClick={() => navigateTo(APP_ROUTES.overview)}
                >
                  Open research workspace
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[var(--ba-input)] bg-transparent text-[var(--ba-ink)] transition-colors hover:bg-[var(--ba-paper)] hover:text-[var(--ba-ink)]"
                  onClick={scrollToWorkflows}
                >
                  Explore the workflow
                  <ChevronDown className="size-4" aria-hidden />
                </Button>
              </div>
              <p
                className="ba-hero-word mt-8 max-w-md border-l-2 border-[var(--ba-border)] pl-4 text-[13px] leading-relaxed text-[var(--ba-muted)]"
                style={wd(520)}
              >
                AI assistance selects an approved analysis — it never writes unrestricted
                scientific code. Registered workflows perform the calculations, verification
                checks the technical evidence, and a provenance ledger records how each result
                was produced.
              </p>
            </div>

            {/* The interactive 3D figure — a B-form DNA duplex */}
            <figure className="ba-figure relative overflow-hidden rounded-[10px]">
              <div className="flex items-center justify-between border-b border-[var(--ba-border)] px-4 py-2.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ba-muted)]">
                  Fig. 1 — B-form DNA duplex
                </p>
                <p className="font-mono text-[10px] text-[var(--ba-faint)]">
                  {BP_COUNT} bp · interactive
                </p>
              </div>
              <div className="relative aspect-[4/3] w-full sm:aspect-[4/3.2]">
                <DnaFigure />
                <p className="pointer-events-none absolute bottom-3 right-3 font-mono text-[10px] text-[var(--ba-muted)]">
                  Drag to rotate · hover a base pair
                </p>
              </div>
              <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--ba-border)] px-4 py-2.5">
                <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                  {BASES.map((b) => (
                    <span
                      key={b}
                      className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[var(--ba-muted)]"
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ background: BASE_COLORS[b] }}
                        aria-hidden
                      />
                      {b}
                    </span>
                  ))}
                </span>
                <span className="ml-auto font-mono text-[10px] text-[var(--ba-muted)]">
                  10.5 bp / turn · 3.4 Å rise
                </span>
              </figcaption>
            </figure>
          </div>
        </section>

        <StatBand />
        <TissueMapSection />
        <PipelineStrip />
        <WorkflowCards />
        <EvidenceSection />
        <ResearchContextSection />
        <CtaBanner />
      </main>

      <LandingFooter />
      <WorldRail />
      <BackToTop />
    </div>
  );
}
