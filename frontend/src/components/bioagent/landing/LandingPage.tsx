"use client";

/** Public landing page for BioAgent-ST. */

import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronDown } from "lucide-react";
import { navigateTo, APP_ROUTES } from "@/lib/bioagent/router";
import { LandingNav, PipelineStrip, WorkflowCards, EvidenceSection, ResearchContextSection, LimitationsSection, LandingFooter } from "./sections";
import { HeroPreview } from "./HeroPreview";

export function LandingPage() {
  return (
    <div id="top" className="flex min-h-screen flex-col bg-background">
      <LandingNav />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-12 sm:py-16" aria-labelledby="hero-title">
          <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-teal">
                Spatial transcriptomics · Research prototype
              </p>
              <h1
                id="hero-title"
                className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl"
              >
                Spatial transcriptomics, with{" "}
                <span className="text-teal">evidence at every step</span>.
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                An evidence-aware workflow assistant that connects natural-language research
                questions to approved analysis workflows, technical verification, and reproducible
                reports.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90"
                  onClick={() => navigateTo(APP_ROUTES.overview)}
                >
                  Open Research Workspace
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => document.getElementById("workflows")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Explore the Workflow
                  <ChevronDown className="size-4" aria-hidden />
                </Button>
              </div>
              <p className="mt-6 max-w-lg border-l-2 border-border pl-4 text-xs leading-relaxed text-muted-foreground">
                AI assistance is used to select an approved analysis — never to write unrestricted
                scientific code. Registered workflows perform the calculations; verification checks
                the technical evidence; a provenance ledger records how each result was produced.
              </p>
            </div>
            <HeroPreview />
          </div>
        </section>

        <PipelineStrip />
        <WorkflowCards />
        <EvidenceSection />
        <ResearchContextSection />
        <LimitationsSection />
      </main>

      <LandingFooter />
    </div>
  );
}
