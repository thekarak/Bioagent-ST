"use client";

/** Runs history with search and status filtering. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, Search, History } from "lucide-react";
import { useBioAgentStore } from "@/lib/bioagent/store";
import { navigateTo, APP_ROUTES } from "@/lib/bioagent/router";
import { RunStatusBadge } from "@/components/bioagent/common/StatusBadge";
import { DemoTag, EmptyState, MonoId } from "@/components/bioagent/common/primitives";
import { formatTimestamp } from "@/lib/bioagent/format";
import type { RunStatus } from "@/lib/bioagent/types";
import { RUN_STATUS_ORDER } from "@/lib/bioagent/types";

export function RunsPage() {
  const runs = useBioAgentStore((s) => s.runs);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return runs.filter((r) => {
      const matchQ =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.question.toLowerCase().includes(q) ||
        r.workflow.toLowerCase().includes(q) ||
        r.datasetName.toLowerCase().includes(q);
      const matchS = statusFilter === "all" || r.status === statusFilter;
      return matchQ && matchS;
    });
  }, [runs, query, statusFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Runs</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Every request is recorded — including blocked, interrupted and failed runs. Failed and
          incomplete runs keep their place in the history instead of being hidden.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="runs-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search run ID, question, workflow or dataset…"
            className="pl-8"
            aria-label="Search runs"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[11rem]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {RUN_STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "needs_review" ? "Needs review" : s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {runs.length} runs
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table className="ba-table">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col">Run ID</TableHead>
              <TableHead scope="col">Research question</TableHead>
              <TableHead scope="col" className="hidden md:table-cell">
                Dataset
              </TableHead>
              <TableHead scope="col">Workflow</TableHead>
              <TableHead scope="col" className="hidden lg:table-cell">
                Selector
              </TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col" className="hidden sm:table-cell">
                Created
              </TableHead>
              <TableHead scope="col" className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((run) => (
              <TableRow key={run.id} className="cursor-pointer" onClick={() => navigateTo(APP_ROUTES.run(run.id))}>
                <TableCell>
                  <MonoId value={run.id} copy={false} />
                </TableCell>
                <TableCell className="max-w-[20rem]">
                  <p className="truncate" title={run.question}>
                    {run.question}
                  </p>
                </TableCell>
                <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                  {run.datasetId === "ds_demo_tissue_01" ? "demo-tissue-01" : "demo-nospatial-02"}
                </TableCell>
                <TableCell>
                  <p className="font-mono text-xs">{run.workflow}</p>
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                  {run.selector.kind === "rules"
                    ? "rules (demo)"
                    : run.selector.kind === "laya"
                      ? "Laya (simulated)"
                      : "manual"}
                </TableCell>
                <TableCell>
                  <RunStatusBadge status={run.status} />
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground sm:table-cell">
                  {formatTimestamp(run.createdAt)}
                </TableCell>
                <TableCell>
                  <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    className="border-0 bg-transparent py-8"
                    icon={<History className="size-6" />}
                    title="No runs match the current filters"
                    description="Adjust the search or status filter. All runs in this workspace are illustrative demo records."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <DemoTag compact />
        Run history is illustrative demo data generated locally, including seeded failures used to
        demonstrate honest failure states.
      </p>
    </div>
  );
}
