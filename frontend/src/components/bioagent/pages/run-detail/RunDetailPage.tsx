"use client";

/** Run detail: header, status, failure notice, and the stage timeline. */

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  Map,
  ScrollText,
  XCircle,
} from "lucide-react";
import { useBioAgentStore } from "@/lib/bioagent/store";
import { navigateTo, APP_ROUTES } from "@/lib/bioagent/router";
import type { RunRecord } from "@/lib/bioagent/types";
import { RunStatusBadge, PolicyBadge } from "@/components/bioagent/common/StatusBadge";
import { DemoTag, EmptyState, InfoRow, MonoId, SectionHeading } from "@/components/bioagent/common/primitives";
import { formatTime, formatTimestamp, relativeTime } from "@/lib/bioagent/format";
import { STAGE_LABEL } from "@/lib/bioagent/demo-runs";
import { workflowSpec } from "@/lib/bioagent/workflows";
import { cn } from "@/lib/utils";
import { RunVizTab } from "./RunVizTab";
import { RunVerificationTab } from "./RunVerificationTab";
import { RunProvenanceTab } from "./RunProvenanceTab";
import { RunReportTab } from "./RunReportTab";

export function RunDetailPage({ runId, initialTab = "overview" }: { runId: string; initialTab?: string }) {
  const runs = useBioAgentStore((s) => s.runs);
  const run = runs.find((r) => r.id === runId);

  if (!run) {
    return (
      <EmptyState
        title="Run not found"
        description={`No run with ID “${runId}” exists in this workspace. It may have been created in a different session.`}
        actions={
          <Button size="sm" variant="outline" onClick={() => navigateTo(APP_ROUTES.runs)}>
            <ChevronLeft className="size-3.5" aria-hidden />
            Back to runs
          </Button>
        }
      />
    );
  }

  const spec = workflowSpec(run.workflow);
  const hasViz = run.results?.kind === "spatial_clustering" || run.results?.kind === "gene_expression";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="mb-1 h-7 px-2 text-xs text-muted-foreground"
            onClick={() => navigateTo(APP_ROUTES.runs)}
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            Runs
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-lg font-semibold tracking-tight">{run.id}</h1>
            <RunStatusBadge status={run.status} />
            <DemoTag compact />
          </div>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">“{run.question}”</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => navigateTo(APP_ROUTES.evidence)}>
            <ScrollText className="size-3.5" aria-hidden />
            Evidence ledger
          </Button>
          {run.report && (
            <Button size="sm" onClick={() => navigateTo(APP_ROUTES.report(run.id))}>
              <FileText className="size-3.5" aria-hidden />
              Open report
            </Button>
          )}
        </div>
      </div>

      {/* Failure notice */}
      {run.failure && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-4" role="alert">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-error">
                {run.failure.title}
                <span className="ml-2 font-mono text-[10px] font-normal text-muted-foreground">
                  {run.failure.code}
                </span>
              </p>
              <p className="mt-1 text-sm leading-relaxed text-foreground/90">{run.failure.message}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground/80">What to do: </span>
                {run.failure.suggestion}
              </p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                stage: {STAGE_LABEL[run.failure.stage]}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Needs-review notice */}
      {run.status === "needs_review" && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4" role="status">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-warning">This request needs clarification</p>
              <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                {run.policy?.detail ??
                  "The selector abstained because the request does not map to exactly one approved workflow."}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => navigateTo(APP_ROUTES.newAnalysis)}
              >
                Reformulate in New Analysis
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Tabs key={run.id} defaultValue={initialTab} className="gap-4">
        <TabsList aria-label="Run detail sections" className="max-w-full overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="viz" disabled={!hasViz}>
            <Map className="size-3.5" aria-hidden />
            Visualization
          </TabsTrigger>
          <TabsTrigger value="verification">
            <ClipboardCheck className="size-3.5" aria-hidden />
            Verification
          </TabsTrigger>
          <TabsTrigger value="provenance">
            <ScrollText className="size-3.5" aria-hidden />
            Provenance
          </TabsTrigger>
          <TabsTrigger value="report" disabled={!run.report}>
            <FileText className="size-3.5" aria-hidden />
            Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <RunOverviewTab run={run} />
        </TabsContent>
        <TabsContent value="viz">
          <RunVizTab run={run} />
        </TabsContent>
        <TabsContent value="verification">
          <RunVerificationTab run={run} />
        </TabsContent>
        <TabsContent value="provenance">
          <RunProvenanceTab run={run} />
        </TabsContent>
        <TabsContent value="report">
          <RunReportTab run={run} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RunOverviewTab({ run }: { run: RunRecord }) {
  const spec = workflowSpec(run.workflow);
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="run-summary-heading">
        <SectionHeading id="run-summary-heading" title="Run summary" />
        <dl className="mt-3 divide-y divide-border border-t border-border">
          <InfoRow label="Run ID" value={<MonoId value={run.id} copy={false} />} mono />
          <InfoRow label="Created" value={`${formatTimestamp(run.createdAt)} (${relativeTime(run.createdAt)})`} />
          <InfoRow label="Research question" value={run.question} />
          <InfoRow
            label="Dataset"
            value={
              <span>
                {run.datasetName} <span className="font-mono text-xs text-muted-foreground">({run.datasetId})</span>
              </span>
            }
          />
          <InfoRow
            label="Selector"
            value={`${run.selector.name} v${run.selector.version} → ${run.selector.decision}`}
          />
          <InfoRow
            label="Policy"
            value={run.policy ? <PolicyBadge decision={run.policy.decision} /> : <span className="text-muted-foreground">Not reached</span>}
          />
          <InfoRow label="Workflow" value={spec ? spec.title : "Unsupported / ambiguous — not executed"} />
          <InfoRow label="Configuration" value={<span className="font-mono text-xs">{JSON.stringify(run.params)}</span>} mono />
          <InfoRow label="Artifacts" value={`${run.artifacts.length} recorded`} />
          <InfoRow
            label="Report"
            value={run.report ? `report v${run.report.version}` : <span className="text-muted-foreground">Not generated</span>}
          />
        </dl>
        {run.policy && run.policy.reason && (
          <p className="mt-3 rounded-md border border-border bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground/80">Policy reason: </span>
            {run.policy.reason}. {run.policy.detail}
          </p>
        )}
        {spec && (
          <div className="mt-4 rounded-md border border-border p-3">
            <p className="text-xs font-medium text-foreground">Registered pipeline (documented steps)</p>
            <ol className="mt-1.5 list-inside list-decimal space-y-0.5 text-xs text-muted-foreground">
              {spec.plannedBackendSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p className="mt-2 text-[11px] italic text-muted-foreground">
              Documented specification of the backend workflow. In this demo the steps are simulated,
              not executed.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="timeline-heading">
        <SectionHeading
          id="timeline-heading"
          title="Run timeline"
          description="Each stage shows its own state and time. Later stages are only marked complete when they actually completed."
        />
        <ol className="mt-4 space-y-0" aria-label="Run timeline">
          {run.stages.map((stage, i) => (
            <li key={stage.stage} className="relative flex gap-3 pb-4 last:pb-0">
              {i < run.stages.length - 1 && (
                <span
                  className={cn(
                    "absolute left-[7px] top-5 h-full w-px",
                    stage.state === "done" ? "bg-verified/40" : "bg-border"
                  )}
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  "relative z-10 mt-0.5 flex size-[15px] shrink-0 items-center justify-center rounded-full border-2 bg-card",
                  stage.state === "done" && "border-verified",
                  stage.state === "failed" && "border-error",
                  stage.state === "active" && "animate-pulse border-teal",
                  (stage.state === "pending" || stage.state === "skipped") && "border-border"
                )}
                aria-hidden
              >
                {stage.state === "failed" && <span className="size-1.5 rounded-full bg-error" />}
                {stage.state === "active" && <span className="size-1.5 rounded-full bg-teal" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      stage.state === "skipped" || stage.state === "pending"
                        ? "text-muted-foreground"
                        : "text-foreground"
                    )}
                  >
                    {STAGE_LABEL[stage.stage]}
                  </p>
                  <p className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {formatTime(stage.timestamp)}
                  </p>
                </div>
                {stage.detail && (
                  <p
                    className={cn(
                      "mt-0.5 text-xs leading-relaxed",
                      stage.state === "failed" ? "text-error" : "text-muted-foreground"
                    )}
                  >
                    {stage.detail}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
