"use client";

/**
 * Hero preview — a miniature of the actual research workspace, built from
 * the same visualization components used inside the application. Data is
 * generated from the local preview engine and stamped as illustrative.
 */

import * as React from "react";
import { CheckCircle2, AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";
import { getPreviewEngine } from "@/lib/bioagent/demo-dataset";
import { categoricalColor } from "@/lib/bioagent/colors";
import { SpatialScatterPlot } from "@/components/bioagent/viz/SpatialScatterPlot";
import { CategoricalLegend } from "@/components/bioagent/viz/legends";
import { DemoTag } from "@/components/bioagent/common/primitives";

export function HeroPreview() {
  const engine = React.useMemo(() => getPreviewEngine(), []);
  const { labels, k } = React.useMemo(() => engine.cluster(0.8, 3), [engine]);

  const counts = React.useMemo(() => {
    const m = new Map<number, number>();
    labels.forEach((l) => m.set(l, (m.get(l) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([label, count]) => ({ label, count }));
  }, [labels]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {/* Title bar */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="size-2 shrink-0 rounded-full bg-verified" aria-hidden />
          <p className="truncate text-xs font-medium text-foreground">
            RUN-2026-0142 · spatial_clustering
          </p>
        </div>
        <p className="hidden font-mono text-[10px] text-muted-foreground sm:block">demo-tissue-01</p>
      </div>

      <div className="grid min-w-0 gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,11rem)]">
        {/* Spatial plot */}
        <div className="min-w-0 border-r border-border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">Spatial view · clusters</p>
            <DemoTag compact />
          </div>
          <SpatialScatterPlot
            data={{ x: engine.x, y: engine.y }}
            colorOf={(i) => categoricalColor(labels[i])}
            tooltipOf={(i) => ({
              title: `spot_${String(i + 1).padStart(5, "0")}`,
              rows: [
                { k: "cluster", v: `Cluster ${labels[i]}` },
                { k: "x", v: engine.x[i].toFixed(1) },
                { k: "y", v: engine.y[i].toFixed(1) },
              ],
            })}
            pointSize={2.6}
            opacity={0.8}
            height={280}
            svgId="hero-scatter"
            ariaLabel="Illustrative spatial scatter plot colored by computational cluster"
          />
          <div className="mt-2">
            <CategoricalLegend
              labels={counts.map((c) => c.label)}
              counts={counts.map((c) => c.count)}
              total={labels.length}
            />
          </div>
        </div>

        {/* Run rail */}
        <div className="flex flex-col gap-3 p-3">
          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Run timeline
            </p>
            <ol className="space-y-1.5">
              {[
                { label: "Received", state: "done" },
                { label: "Validated", state: "done" },
                { label: "Routed", state: "done" },
                { label: "Policy", state: "done" },
                { label: "Execution", state: "done" },
                { label: "Verification", state: "done" },
              ].map((s) => (
                <li key={s.label} className="flex items-center gap-2 text-[11px] text-foreground">
                  {s.state === "done" ? (
                    <CheckCircle2 className="size-3 shrink-0 text-verified" aria-hidden />
                  ) : (
                    <Loader2 className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  {s.label}
                </li>
              ))}
              <li className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="size-3 shrink-0 rounded-full border border-border" aria-hidden />
                Report
              </li>
            </ol>
          </div>

          <div className="rounded-md border border-border bg-secondary/40 p-2.5">
            <p className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              <ShieldCheck className="size-3 text-verified" aria-hidden />
              Verification
            </p>
            <ul className="space-y-1 text-[11px]">
              <li className="flex items-center justify-between gap-2">
                <span className="truncate text-foreground/90">Labels aligned</span>
                <CheckCircle2 className="size-3 shrink-0 text-verified" aria-label="pass" />
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="truncate text-foreground/90">Embedding finite</span>
                <CheckCircle2 className="size-3 shrink-0 text-verified" aria-label="pass" />
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="truncate text-foreground/90">Package versions</span>
                <AlertTriangle className="size-3 shrink-0 text-warning" aria-label="warning" />
              </li>
            </ul>
            <p className="mt-1.5 border-t border-border pt-1.5 text-[10px] leading-snug text-muted-foreground">
              Policy <span className="font-medium text-verified">ALLOW</span> · resolution 0.8 · seed 0
            </p>
          </div>

          <div className="rounded-md border border-border p-2.5">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Provenance</p>
            <dl className="mt-1 space-y-1 text-[10px] text-muted-foreground">
              <div className="flex items-baseline justify-between gap-2">
                <dt>run</dt>
                <dd className="font-mono text-foreground/80">RUN-2026-0142</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt>fingerprint</dt>
                <dd className="font-mono text-foreground/80">fnv1a:9c41d2a7</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt>artifacts</dt>
                <dd className="font-mono text-foreground/80">4 · checksummed</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <p className="border-t border-border bg-secondary/40 px-3 py-1.5 text-[10px] text-muted-foreground">
        Illustrative preview with locally generated data — the workspace runs in Demo Mode in this
        prototype.
      </p>
    </div>
  );
}
