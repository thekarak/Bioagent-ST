"use client";

/**
 * Evidence ledger: traceability across runs, sortable and filterable.
 * Clicking a row opens the run's provenance record. Fields that were not
 * recorded are displayed as such — never inferred or silently filled.
 */

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
import { ArrowUpDown, FileJson, Search, ScrollText } from "lucide-react";
import { useBioAgentStore } from "@/lib/bioagent/store";
import { navigateTo, APP_ROUTES } from "@/lib/bioagent/router";
import { RunStatusBadge, PolicyBadge } from "@/components/bioagent/common/StatusBadge";
import { DemoTag, EmptyState, MonoId, SectionHeading, CopyButton } from "@/components/bioagent/common/primitives";
import { formatTimestamp, relativeTime } from "@/lib/bioagent/format";
import { downloadJson } from "@/lib/bioagent/exports";
import { verificationSummary } from "@/lib/bioagent/verification";
import { useToast } from "@/hooks/use-toast";
import type { RunRecord } from "@/lib/bioagent/types";
import { cn } from "@/lib/utils";

type SortKey = "createdAt" | "runId" | "workflow" | "artifacts" | "pass";

export function EvidenceLedgerPage() {
  const runs = useBioAgentStore((s) => s.runs);
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [workflowFilter, setWorkflowFilter] = React.useState("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("createdAt");
  const [sortAsc, setSortAsc] = React.useState(false);

  const withProvenance = runs.filter((r) => r.provenance !== null || r.status === "failed" || r.status === "needs_review");

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = withProvenance.filter((r) => {
      const matchQ =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.question.toLowerCase().includes(q) ||
        r.datasetId.toLowerCase().includes(q) ||
        r.workflow.toLowerCase().includes(q);
      const matchW = workflowFilter === "all" || r.workflow === workflowFilter;
      return matchQ && matchW;
    });
    const dir = sortAsc ? 1 : -1;
    filtered = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "runId":
          return a.id.localeCompare(b.id) * dir;
        case "workflow":
          return a.workflow.localeCompare(b.workflow) * dir;
        case "artifacts":
          return (a.artifacts.length - b.artifacts.length) * dir;
        case "pass":
          return (
            (verificationSummary(a.verification).pass - verificationSummary(b.verification).pass) * dir
          );
        default:
          return (a.createdAt - b.createdAt) * dir;
      }
    });
    return filtered;
  }, [withProvenance, query, workflowFilter, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortAsc((a) => !a);
    } else {
      setSortKey(key);
      setSortAsc(key === "runId" || key === "workflow");
    }
  };

  const sortProps = { sortKey, sortAsc, toggleSort };

  const exportLedger = () => {
    downloadJson("evidence-ledger.json", {
      generated_at: new Date().toISOString(),
      runs: rows.map((r) => ({
        run_id: r.id,
        created: new Date(r.createdAt).toISOString(),
        question: r.question,
        dataset: r.datasetId,
        workflow: r.workflow,
        policy: r.policy?.decision ?? "not recorded",
        artifacts: r.artifacts.length,
        verification: verificationSummary(r.verification),
        provenance_recorded: r.provenance !== null,
      })),
      note: "Demo Mode ledger — all entries refer to browser-generated illustrative runs.",
    });
    toast({ title: "Ledger exported", description: "evidence-ledger.json downloaded." });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Evidence Ledger</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Traceability records for review before citing or discussing a result: what was asked,
            which dataset and workflow were used, what the policy decided, and which artifacts carry
            checksums.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={exportLedger}>
          <FileJson className="size-3.5" aria-hidden />
          Export ledger JSON
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search runs, questions, datasets…"
            className="pl-8"
            aria-label="Search evidence ledger"
          />
        </div>
        <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
          <SelectTrigger className="w-[15rem]" aria-label="Filter by workflow">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All workflows</SelectItem>
            <SelectItem value="quality_assessment">quality_assessment</SelectItem>
            <SelectItem value="spatial_clustering">spatial_clustering</SelectItem>
            <SelectItem value="gene_expression">gene_expression</SelectItem>
            <SelectItem value="unsupported_or_ambiguous">unsupported_or_ambiguous</SelectItem>
          </SelectContent>
        </Select>
        <p className="ml-auto text-xs text-muted-foreground">{rows.length} records</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table className="ba-table">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortHeader label="Run ID" k="runId" {...sortProps} />
              <TableHead scope="col">Question</TableHead>
              <TableHead scope="col" className="hidden lg:table-cell">
                Dataset
              </TableHead>
              <SortHeader label="Workflow" k="workflow" {...sortProps} />
              <TableHead scope="col" className="hidden md:table-cell">
                Policy
              </TableHead>
              <SortHeader label="Artifacts" k="artifacts" className="hidden sm:table-cell" {...sortProps} />
              <SortHeader label="Checks" k="pass" className="hidden sm:table-cell" {...sortProps} />
              <TableHead scope="col">Status</TableHead>
              <SortHeader label="Recorded" k="createdAt" {...sortProps} />
              <TableHead scope="col" className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <LedgerRow key={r.id} run={r} />
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10}>
                  <EmptyState
                    className="border-0 bg-transparent py-8"
                    icon={<ScrollText className="size-6" />}
                    title="No records match the current filters"
                    description="Adjust the search or workflow filter."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <DemoTag compact />
        All ledger entries are illustrative demo records. Runs that failed before evidence recording
        appear with “Not recorded” provenance rather than being hidden or back-filled.
      </p>
    </div>
  );
}

function SortHeader({
  label,
  k,
  className,
  sortKey,
  sortAsc,
  toggleSort,
}: {
  label: string;
  k: SortKey;
  className?: string;
  sortKey: SortKey;
  sortAsc: boolean;
  toggleSort: (key: SortKey) => void;
}) {
  return (
    <TableHead scope="col" className={className} aria-sort={sortKey === k ? (sortAsc ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="ba-focus inline-flex items-center gap-1 rounded text-xs font-medium uppercase tracking-wide hover:text-foreground"
        aria-label={`Sort by ${label}`}
      >
        {label}
        <ArrowUpDown className="size-3" aria-hidden />
      </button>
    </TableHead>
  );
}

function LedgerRow({ run }: { run: RunRecord }) {
  const summary = verificationSummary(run.verification);
  const provenanceRecorded = run.provenance !== null;
  return (
    <TableRow
      className={cn("cursor-pointer", !provenanceRecorded && "opacity-75")}
      onClick={() => navigateTo(APP_ROUTES.run(run.id))}
    >
      <TableCell>
        <MonoId value={run.id} />
      </TableCell>
      <TableCell className="max-w-[16rem]">
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
      <TableCell className="hidden md:table-cell">
        {run.policy ? <PolicyBadge decision={run.policy.decision} /> : <span className="text-xs text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="hidden text-right font-mono text-xs sm:table-cell">
        {provenanceRecorded ? run.artifacts.length : <span className="text-muted-foreground italic">not recorded</span>}
      </TableCell>
      <TableCell className="hidden text-right font-mono text-xs text-muted-foreground sm:table-cell">
        {run.verification && run.verification.length > 0
          ? `${summary.pass}/${run.verification.length}`
          : <span className="italic">not run</span>}
      </TableCell>
      <TableCell>
        <RunStatusBadge status={run.status} />
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <p className="text-xs text-foreground/80">{formatTimestamp(run.createdAt)}</p>
        <p className="text-[10px] text-muted-foreground">{relativeTime(run.createdAt)}</p>
      </TableCell>
      <TableCell>
        <CopyButton value={run.id} label="" size="sm" variant="ghost" />
      </TableCell>
    </TableRow>
  );
}
