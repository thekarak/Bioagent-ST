"use client";

/**
 * Verification table: Check | Expected condition | Actual result | Status |
 * Explanation. Values come from checks evaluated against this run's demo
 * artifacts; failures are shown, never converted into successes. The run's
 * evidence contract — the machine-readable agreement the checks implement —
 * is shown alongside.
 */

import { AlertTriangle, Info, ScrollText, ShieldQuestion } from "lucide-react";
import type { RunRecord } from "@/lib/bioagent/types";
import { workflowContract } from "@/lib/bioagent/contracts";
import { CheckStatusBadge } from "@/components/bioagent/common/StatusBadge";
import { EmptyState, SectionHeading, DemoTag } from "@/components/bioagent/common/primitives";
import { verificationSummary } from "@/lib/bioagent/verification";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function RunVerificationTab({ run }: { run: RunRecord }) {
  const checks = run.verification;

  if (!checks || checks.length === 0) {
    return (
      <EmptyState
        icon={<ShieldQuestion className="size-7" />}
        title="Verification not run"
        description={
          run.status === "failed"
            ? "This run failed before reaching the verification stage, so no checks were evaluated. Later stages are not shown as completed."
            : "This run has not reached the verification stage yet."
        }
      />
    );
  }

  const summary = verificationSummary(checks);

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Technical verification"
        description="Checks evaluated against the artifacts this run actually produced. A failure explains what happened and why it matters."
        actions={<DemoTag />}
      />

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <span className="rounded-md border border-verified/25 bg-verified/10 px-2.5 py-1 text-xs font-medium text-verified">
          {summary.pass} passed
        </span>
        <span className="rounded-md border border-warning/25 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
          {summary.warning} warnings
        </span>
        <span className="rounded-md border border-error/25 bg-error/10 px-2.5 py-1 text-xs font-medium text-error">
          {summary.fail} failed
        </span>
        <span className="rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {summary.notRun} not run
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table className="ba-table">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="min-w-[12rem]">
                Check
              </TableHead>
              <TableHead scope="col" className="min-w-[14rem]">
                Expected condition
              </TableHead>
              <TableHead scope="col" className="min-w-[14rem]">
                Actual result
              </TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col" className="min-w-[20rem]">
                Explanation
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checks.map((check) => (
              <TableRow key={check.id}>
                <TableCell className="font-medium">{check.check}</TableCell>
                <TableCell className="text-muted-foreground">{check.expected}</TableCell>
                <TableCell>
                  <span className={check.status === "fail" ? "text-error" : "text-foreground/90"}>
                    {check.actual}
                  </span>
                </TableCell>
                <TableCell>
                  <CheckStatusBadge status={check.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <p className="text-xs leading-relaxed">{check.explanation}</p>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <p className="text-sm leading-relaxed text-foreground/90">
          <span className="font-medium">
            Technical verification does not establish biological validity.
          </span>{" "}
          These checks confirm that expected computational artifacts were produced correctly. They do
          not prove that a clustering, expression pattern or metric is biologically true, causal, or
          clinically meaningful.
        </p>
      </div>

      {run.workflow !== "unsupported_or_ambiguous" && (
        <ContractCard workflow={run.workflow} />
      )}

      <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        In Demo Mode the checks are evaluated locally against this run&apos;s browser-generated
        artifacts — no scientific backend was involved.
      </p>
    </div>
  );
}

function ContractCard({
  workflow,
}: {
  workflow: "quality_assessment" | "spatial_clustering" | "gene_expression";
}) {
  const contract = workflowContract(workflow);
  return (
    <section
      className="rounded-lg border border-border bg-card p-4"
      aria-labelledby="contract-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="contract-heading" className="flex items-center gap-1.5 text-sm font-semibold">
          <ScrollText className="size-4 text-teal" aria-hidden />
          Evidence contract
        </h3>
        <p className="font-mono text-[11px] text-muted-foreground">
          {contract.workflow} · {contract.version}
        </p>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        The machine-readable agreement this run was verified against: what the workflow requires,
        which parameters are allowed, which artifacts must exist, and how it fails.
      </p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
            required inputs
          </p>
          <ul className="mt-1.5 space-y-1">
            {contract.requiredInputs.map((i) => (
              <li key={i.label} className="text-xs leading-snug">
                <span className="font-mono text-[11px] text-foreground/90">{i.label}</span>
                <span className="text-muted-foreground"> — {i.requirement}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
            allowed parameters
          </p>
          <ul className="mt-1.5 space-y-1">
            {contract.allowedParameters.map((p) => (
              <li key={p.label} className="text-xs leading-snug">
                <span className="font-mono text-[11px] text-foreground/90">{p.label}</span>
                <span className="text-muted-foreground"> — {p.range}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
            expected artifacts
          </p>
          <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {contract.expectedArtifacts.join(" · ")}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
            validation checks
          </p>
          <ul className="mt-1.5 space-y-1">
            {contract.validationChecks.map((c) => (
              <li key={c} className="text-xs leading-snug text-muted-foreground">
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3 rounded-md border border-border bg-secondary/50 p-3 text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground/80">Failure policy: </span>
        {contract.failurePolicy}
      </p>
    </section>
  );
}
