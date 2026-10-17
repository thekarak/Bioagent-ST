"use client";

/** Reports index: only runs that actually generated a report appear here. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight } from "lucide-react";
import { useBioAgentStore } from "@/lib/bioagent/store";
import { navigateTo, APP_ROUTES } from "@/lib/bioagent/router";
import { RunStatusBadge } from "@/components/bioagent/common/StatusBadge";
import { DemoTag, EmptyState, MonoId, SectionHeading } from "@/components/bioagent/common/primitives";
import { formatTimestamp, relativeTime } from "@/lib/bioagent/format";
import { workflowSpec } from "@/lib/bioagent/workflows";

export function ReportsPage() {
  const runs = useBioAgentStore((s) => s.runs);
  const withReports = runs.filter((r) => r.report !== null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Publication-friendly reports are generated only for runs that passed technical
          verification. Each report links results, verification, warnings and reproducibility
          information.
        </p>
      </div>

      <SectionHeading
        title="Generated reports"
        description={`${withReports.length} report${withReports.length === 1 ? "" : "s"} available in this workspace.`}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {withReports.map((run) => {
          const spec = workflowSpec(run.workflow);
          return (
            <article key={run.id} className="flex flex-col rounded-lg border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <MonoId value={run.id} copy={false} />
                    <RunStatusBadge status={run.status} />
                    <DemoTag compact />
                  </div>
                  <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">
                    {run.question}
                  </h3>
                </div>
                <span className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  report v{run.report?.version}
                </span>
              </div>
              <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground/80">Workflow: </span>
                  {spec?.short ?? run.workflow}
                </p>
                <p>
                  <span className="font-medium text-foreground/80">Dataset: </span>
                  {run.datasetId === "ds_demo_tissue_01" ? "demo-tissue-01" : "demo-nospatial-02"}
                </p>
                <p>
                  <span className="font-medium text-foreground/80">Figures: </span>
                  {run.report?.figures.length ?? 0} · <span className="font-medium text-foreground/80">Warnings: </span>
                  {run.report?.warnings.length ?? 0}
                </p>
                <p>
                  <span className="font-medium text-foreground/80">Classified claims: </span>
                  {run.report?.claims?.length ?? 0}
                  {run.report && (run.report.claims?.length ?? 0) > 0 && (
                    <> · <span className="font-medium text-foreground/80">Supported: </span>
                    {run.report.claims.filter((c) => c.state === "supported").length}</>
                  )}
                </p>
                <p>
                  <span className="font-medium text-foreground/80">Generated: </span>
                  {formatTimestamp(run.report?.generatedAt ?? run.createdAt)} (
                  {relativeTime(run.report?.generatedAt ?? run.createdAt)})
                </p>
              </dl>
              <div className="mt-4 flex gap-2 border-t border-border pt-3">
                <Button size="sm" onClick={() => navigateTo(APP_ROUTES.report(run.id))}>
                  <FileText className="size-3.5" aria-hidden />
                  Open report
                </Button>
                <Button size="sm" variant="ghost" onClick={() => navigateTo(APP_ROUTES.run(run.id))}>
                  Run details
                  <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {withReports.length === 0 && (
        <EmptyState
          icon={<FileText className="size-7" />}
          title="No reports generated yet"
          description="Reports appear here when a run completes technical verification. Runs that failed or need review do not produce reports."
          actions={
            <Button size="sm" variant="outline" onClick={() => navigateTo(APP_ROUTES.newAnalysis)}>
              Start a new analysis
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          }
        />
      )}
    </div>
  );
}
