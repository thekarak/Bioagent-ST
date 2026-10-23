"use client";

/**
 * Landing section 01 — the spatial map. Promotes the WebGL tissue figure
 * (previously the hero's panel) to a full-width "Fig. 2" viewport: the demo
 * tissue section as an explorable 3D scatter, flanked by the pipeline it
 * feeds. Both landing figures share the Okabe-Ito categorical palette, so
 * cluster colors here and base colors in the hero read as one system.
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { Section, SectionHeader } from "./section-kit";
import { CLUSTER_GENES, FIELD_PALETTE } from "./three/tissue-field-data";

const TissueFigure = dynamic(
  () => import("./three/TissueField").then((m) => m.TissueFigure),
  { ssr: false },
);
const TissueInspectCard = dynamic(
  () => import("./three/TissueField").then((m) => m.TissueInspectCard),
  { ssr: false },
);

const FIGURE_LEGEND = [
  { cluster: 0, gene: "Mbp" },
  { cluster: 1, gene: "Apoe" },
  { cluster: 2, gene: "Cx3cr1" },
  { cluster: 3, gene: "Rgs5" },
  { cluster: 4, gene: "Col1a1" },
] as const;

export function TissueMapSection() {
  return (
    <section aria-label="The spatial map" className="border-t border-[var(--ba-border)]">
      <Section id="spatial-map" className="py-20 sm:py-24">
        <SectionHeader
          eyebrow="01 · The spatial map"
          title="From a tissue section to computational domains."
          lead={
            <p>
              Every workflow starts from a spatially-resolved section: a glass slide of
              measured spots, an expression vector per spot, and structure that only appears
              once position and expression are read together. The figure below is the demo
              dataset this prototype ships with — a 3D scatter in which each spot carries its
              cluster assignment and a marker-gene value.{" "}
              <span className="text-[var(--ba-ink)]">
                Drag to orbit the section; click any spot to read its record.
              </span>
            </p>
          }
        />

        <figure className="ba-figure mt-10 overflow-hidden rounded-[10px]">
          <div className="flex items-center justify-between border-b border-[var(--ba-border)] px-4 py-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ba-muted)]">
              Fig. 2 — Demo tissue section
            </p>
            <p className="font-mono text-[10px] text-[var(--ba-faint)]">
              5 clusters · 3D scatter
            </p>
          </div>
          <div className="relative aspect-[4/3] w-full sm:aspect-[16/8]">
            <TissueFigure />
            <TissueInspectCard />
            <p className="pointer-events-none absolute bottom-3 right-3 font-mono text-[10px] text-[var(--ba-muted)]">
              Drag to orbit · click a spot
            </p>
          </div>
          <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--ba-border)] px-4 py-2.5">
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              {FIGURE_LEGEND.map((l) => (
                <span
                  key={l.cluster}
                  className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[var(--ba-muted)]"
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ background: FIELD_PALETTE[l.cluster] }}
                    aria-hidden
                  />
                  C{l.cluster} · {l.gene}
                </span>
              ))}
            </span>
            <span className="ml-auto font-mono text-[10px] text-[var(--ba-faint)]">
              Demo data — generated locally in your browser
            </span>
          </figcaption>
        </figure>
      </Section>
    </section>
  );
}
