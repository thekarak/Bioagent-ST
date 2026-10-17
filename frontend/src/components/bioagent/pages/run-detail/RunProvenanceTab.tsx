"use client";

/**
 * Provenance detail: every recorded field, artifacts with checksums, and a
 * downloadable manifest. Missing fields are shown as "Not recorded" or
 * "Unavailable" — never silently filled.
 */

import { Button } from "@/components/ui/button";
import { FileJson, Download } from "lucide-react";
import type { RunRecord } from "@/lib/bioagent/types";
import { EmptyState, MonoId, SectionHeading, CopyButton } from "@/components/bioagent/common/primitives";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadJson } from "@/lib/bioagent/exports";
import { useToast } from "@/hooks/use-toast";

export function RunProvenanceTab({ run }: { run: RunRecord }) {
  const { toast } = useToast();

  if (!run.provenance) {
    return (
      <EmptyState
        title="Provenance not recorded"
        description="This run did not reach the evidence-recording stage, so no provenance manifest exists. The absence is stated rather than filled with defaults."
      />
    );
  }

  const exportManifest = () => {
    downloadJson(`${run.id}-provenance-manifest.json`, {
      run_id: run.id,
      question: run.question,
      dataset: run.datasetId,
      selector: run.selector,
      policy: run.policy,
      workflow: run.workflow,
      params: run.params,
      provenance_fields: run.provenance?.fields,
      artifacts: run.artifacts,
      note: "Demo Mode manifest — all values refer to browser-generated illustrative artifacts.",
    });
    toast({ title: "Manifest downloaded", description: `${run.id}-provenance-manifest.json` });
  };

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Provenance record"
        description="How this result was produced: request, dataset, selector, policy, configuration and artifacts."
        actions={
          <div className="flex gap-2">
            <CopyButton value={run.id} label="Copy run ID" />
            <Button size="sm" variant="outline" onClick={exportManifest}>
              <FileJson className="size-3.5" aria-hidden />
              Download manifest
            </Button>
          </div>
        }
      />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table className="ba-table">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="w-56">
                Field
              </TableHead>
              <TableHead scope="col">Value</TableHead>
              <TableHead scope="col" className="w-28">
                Availability
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {run.provenance.fields.map((f) => (
              <TableRow key={f.field}>
                <TableCell className="font-medium">{f.field}</TableCell>
                <TableCell>
                  {f.mono ? (
                    <MonoId value={f.value} copy={false} truncate={f.value.length > 40} />
                  ) : (
                    <p
                      className={
                        f.availability === "not_recorded" || f.availability === "unavailable"
                          ? "text-muted-foreground italic"
                          : "text-foreground/90"
                      }
                    >
                      {f.value}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className={`text-[11px] font-medium ${
                      f.availability === "recorded"
                        ? "text-verified"
                        : f.availability === "unavailable"
                          ? "text-warning"
                          : "text-muted-foreground"
                    }`}
                  >
                    {f.availability === "recorded"
                      ? "Recorded"
                      : f.availability === "unavailable"
                        ? "Unavailable"
                        : "Not recorded"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <section aria-labelledby="artifacts-heading">
        <SectionHeading
          id="artifacts-heading"
          title="Artifacts"
          description="References and checksums for the artifacts this run produced. Checksums are computed over the serialized demo artifacts (FNV-1a)."
        />
        <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
          <Table className="ba-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">Artifact</TableHead>
                <TableHead scope="col" className="hidden sm:table-cell">
                  Kind
                </TableHead>
                <TableHead scope="col">Format</TableHead>
                <TableHead scope="col" className="hidden md:table-cell">
                  Size
                </TableHead>
                <TableHead scope="col">Checksum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.artifacts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Download className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <MonoId value={a.id} copy={false} />
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{a.kind}</TableCell>
                  <TableCell className="text-muted-foreground">{a.format}</TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                    {a.bytesLabel}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <MonoId value={a.checksum} />
                      <p className="text-[10px] text-muted-foreground">{a.checksumNote}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {run.artifacts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                    No artifacts were produced by this run.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
