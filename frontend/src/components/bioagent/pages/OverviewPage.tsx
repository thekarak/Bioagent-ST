"use client";

/** Dashboard overview: dataset status, recent runs and recent activity. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Database,
  Upload,
  ArrowRight,
  Activity,
  CircleAlert,
} from "lucide-react";
import { useBioAgentStore } from "@/lib/bioagent/store";
import { navigateTo, APP_ROUTES } from "@/lib/bioagent/router";
import { RunStatusBadge, ValidationBadge } from "@/components/bioagent/common/StatusBadge";
import { DemoTag, EmptyState, InfoRow, MonoId, SectionHeading } from "@/components/bioagent/common/primitives";
import { formatTimestamp, relativeTime } from "@/lib/bioagent/format";
import { activityFromRuns } from "@/lib/bioagent/demo-runs";
import { useToast } from "@/hooks/use-toast";

export function OverviewPage() {
  const dataset = useBioAgentStore((s) => s.dataset);
  const runs = useBioAgentStore((s) => s.runs);
  const loadDataset = useBioAgentStore((s) => s.loadDataset);
  const { toast } = useToast();
  const activity = React.useMemo(() => activityFromRuns(runs), [runs]);

  const openDemo = () => {
    loadDataset("ds_demo_tissue_01");
    toast({
      title: "Demo dataset loaded",
      description:
        "Illustrative synthetic tissue section (2,400 observations, 500 genes) — not experimental data.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Research Workspace</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Inspect datasets, configure approved workflows, and review the evidence behind each
          analysis.
        </p>
      </div>

      {/* Dataset area */}
      <section aria-labelledby="dataset-heading">
        <SectionHeading
          id="dataset-heading"
          title="Dataset"
          description="The active dataset is validated before any workflow runs. Only fields actually returned by the data service are shown."
          actions={
            <Button variant="outline" size="sm" onClick={() => navigateTo(APP_ROUTES.datasets)}>
              <Database className="size-3.5" aria-hidden />
              Dataset library
            </Button>
          }
        />
        <div className="mt-3">
          {dataset ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{dataset.meta.name}</h3>
                    <DemoTag compact />
                    <ValidationBadge state={dataset.meta.validation} />
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {dataset.meta.shortId} · loaded {relativeTime(dataset.loadedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigateTo(APP_ROUTES.datasets)}>
                    Inspect dataset
                  </Button>
                  <Button size="sm" onClick={() => navigateTo(APP_ROUTES.newAnalysis)}>
                    New analysis
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
              <dl className="mt-4 divide-y divide-border border-t border-border">
                <InfoRow label="Observations" value={dataset.meta.obsCountLabel} />
                <InfoRow label="Genes" value={dataset.meta.genesLabel} />
                <InfoRow label="Spatial coordinates" value={dataset.meta.hasSpatialCoordinates ? "Available (obsm['spatial'])" : "Not available on this dataset"} />
                <InfoRow label="Expression layers" value={dataset.layers.join(" · ")} />
                <InfoRow
                  label="Schema validation"
                  value={<ValidationBadge state={dataset.meta.validation} />}
                />
                <InfoRow label="Source" value={dataset.meta.source} />
                <InfoRow label="Citation" value={dataset.meta.citation ?? "Not available"} />
                <InfoRow label="Fingerprint" value={<MonoId value={dataset.fingerprint} />} mono />
              </dl>
              {dataset.unavailableFields.length > 0 && (
                <div className="mt-4 rounded-md border border-warning/30 bg-warning/5 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
                    <CircleAlert className="size-3.5" aria-hidden />
                    Unavailable fields (reported, not invented)
                  </p>
                  <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                    {dataset.unavailableFields.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={<Database className="size-7" />}
              title="No dataset loaded"
              description="Load an AnnData-compatible dataset or open the illustrative demo to explore the interface."
              actions={
                <>
                  <Button size="sm" onClick={() => navigateTo(APP_ROUTES.datasets)}>
                    <Upload className="size-3.5" aria-hidden />
                    Load Dataset
                  </Button>
                  <Button size="sm" variant="outline" onClick={openDemo}>
                    Open Demo Dataset
                  </Button>
                </>
              }
            />
          )}
        </div>
      </section>

      {/* Recent runs */}
      <section aria-labelledby="recent-runs-heading">
        <SectionHeading
          id="recent-runs-heading"
          title="Recent runs"
          description="Run records in this workspace are illustrative demo records, including failures and runs that need review."
          actions={
            <Button variant="outline" size="sm" onClick={() => navigateTo(APP_ROUTES.runs)}>
              All runs
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          }
        />
        <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
          <Table className="ba-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">Run ID</TableHead>
                <TableHead scope="col">Research question</TableHead>
                <TableHead scope="col" className="hidden lg:table-cell">
                  Dataset
                </TableHead>
                <TableHead scope="col">Workflow</TableHead>
                <TableHead scope="col" className="hidden md:table-cell">
                  Selector
                </TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col" className="hidden sm:table-cell">
                  Created
                </TableHead>
                <TableHead scope="col" className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.slice(0, 6).map((run) => (
                <TableRow
                  key={run.id}
                  className="cursor-pointer"
                  onClick={() => navigateTo(APP_ROUTES.run(run.id))}
                >
                  <TableCell>
                    <MonoId value={run.id} copy={false} />
                  </TableCell>
                  <TableCell className="max-w-[18rem]">
                    <p className="truncate text-sm" title={run.question}>
                      {run.question}
                    </p>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                    {run.datasetId === "ds_demo_tissue_01" ? "demo-tissue-01" : "demo-nospatial-02"}
                  </TableCell>
                  <TableCell>
                    <p className="font-mono text-xs">{run.workflow}</p>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                    {run.selector.kind === "rules"
                      ? "rules (demo)"
                      : run.selector.kind === "laya"
                        ? "Laya (simulated)"
                        : "manual"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <RunStatusBadge status={run.status} />
                    </div>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground sm:table-cell">
                    {formatTimestamp(run.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      Details
                      <ArrowRight className="size-3" aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Recent activity */}
      <section aria-labelledby="activity-heading">
        <SectionHeading
          id="activity-heading"
          title="Recent activity"
          description="Scientific events recorded in this demo workspace: validations, selections, verification outcomes and report generation."
        />
        <ol className="mt-3 space-y-2 rounded-lg border border-border bg-card p-4">
          {activity.slice(0, 8).map((ev) => (
            <li key={ev.id} className="flex items-start gap-3 text-sm">
              <Activity className="mt-0.5 size-3.5 shrink-0 text-teal" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-foreground">{ev.label}</span>
                  <button
                    type="button"
                    className="ba-focus rounded font-mono text-[11px] text-teal hover:underline"
                    onClick={() => navigateTo(APP_ROUTES.run(ev.runId))}
                  >
                    {ev.runId}
                  </button>
                  <span className="text-[11px] text-muted-foreground">{relativeTime(ev.time)}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground" title={ev.detail}>
                  {ev.detail}
                </p>
              </div>
              <DemoTag compact />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
