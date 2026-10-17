"use client";

/** Dataset library, schema inspector, gene browser and the honest upload flow. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Check,
  FileSearch,
  CircleAlert,
  Info,
} from "lucide-react";
import { useBioAgentStore } from "@/lib/bioagent/store";
import { navigateTo, APP_ROUTES } from "@/lib/bioagent/router";
import { ValidationBadge } from "@/components/bioagent/common/StatusBadge";
import { DemoTag, EmptyState, InfoRow, MonoId, SectionHeading } from "@/components/bioagent/common/primitives";
import { formatFixed } from "@/lib/bioagent/format";
import { useToast } from "@/hooks/use-toast";

export function DatasetsPage() {
  const dataset = useBioAgentStore((s) => s.dataset);
  const catalog = useBioAgentStore((s) => s.datasetCatalog);
  const loadDataset = useBioAgentStore((s) => s.loadDataset);
  const unloadDataset = useBioAgentStore((s) => s.unloadDataset);
  const upload = useBioAgentStore((s) => s.upload);
  const registerUpload = useBioAgentStore((s) => s.registerUpload);
  const { toast } = useToast();
  const [uploadOpen, setUploadOpen] = React.useState(false);

  const onFile = (file: File | null) => {
    if (!file) return;
    registerUpload({ fileName: file.name, sizeLabel: `${(file.size / 1024).toFixed(1)} KB`, receivedAt: Date.now() });
    toast({
      title: "File received locally",
      description:
        "Schema validation requires the scientific backend, which is not connected in Demo Mode. The file was not parsed.",
    });
    setUploadOpen(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Datasets</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          AnnData-compatible datasets registered with the workspace. The intended data model is
          AnnData; compatibility with other formats is not claimed.
        </p>
      </div>

      {/* Upload + library */}
      <section aria-labelledby="library-heading">
        <SectionHeading
          id="library-heading"
          title="Dataset library"
          description="Local demo datasets can be loaded instantly. Registering a real dataset requires the scientific backend."
          actions={
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Upload className="size-3.5" aria-hidden />
                  Load Dataset
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Load an AnnData-compatible dataset</DialogTitle>
                  <DialogDescription>
                    Registration accepts <span className="font-mono text-xs">.h5ad</span> files. In
                    this prototype the scientific backend is not connected, so the file cannot be
                    parsed or schema-validated in the browser — this is disclosed rather than faked.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="dataset-file">Dataset file</Label>
                    <Input
                      id="dataset-file"
                      type="file"
                      accept=".h5ad,.zip"
                      onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  <p className="flex items-start gap-2 rounded-md border border-border bg-secondary/50 p-3 text-xs leading-relaxed text-muted-foreground">
                    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    After the backend is connected, the file would be checksummed, schema-validated
                    (matrix dimensions, identifiers, spatial coordinates) and registered with a
                    provenance entry. None of those steps run here.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          }
        />

        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {catalog.map((d) => {
            const active = dataset?.meta.id === d.id;
            return (
              <article
                key={d.id}
                className={`rounded-lg border bg-card p-4 ${active ? "border-teal/50 ring-1 ring-teal/20" : "border-border"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{d.name}</h3>
                      <DemoTag compact />
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{d.shortId}</p>
                  </div>
                  <ValidationBadge state={d.validation} />
                </div>
                <dl className="mt-3 divide-y divide-border border-t border-b border-border">
                  <InfoRow label="Observations" value={d.obsCountLabel} />
                  <InfoRow label="Genes" value={d.genesLabel} />
                  <InfoRow label="Spatial coordinates" value={d.hasSpatialCoordinates ? "Available" : "Missing"} />
                  <InfoRow label="Schema" value={<span className="font-mono text-[11px]">{d.schemaSummary}</span>} mono />
                  <InfoRow label="Source" value={d.source} />
                </dl>
                <div className="mt-3 flex items-center gap-2">
                  {active ? (
                    <Button size="sm" variant="secondary" disabled>
                      <Check className="size-3.5" aria-hidden />
                      Loaded
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        loadDataset(d.id);
                        toast({
                          title: "Demo dataset loaded",
                          description: `${d.name} — illustrative data generated locally.`,
                        });
                      }}
                    >
                      <Database className="size-3.5" aria-hidden />
                      Load demo dataset
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => navigateTo(APP_ROUTES.newAnalysis)}>
                    Use in analysis
                  </Button>
                </div>
                {!d.hasSpatialCoordinates && (
                  <p className="mt-3 flex items-start gap-1.5 text-xs text-warning">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    Schema warning: no spatial coordinates — spatial workflows will be blocked by the
                    policy gate on this dataset.
                  </p>
                )}
              </article>
            );
          })}
        </div>

        {upload && (
          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium">Last received file (not parsed)</p>
            <dl className="mt-2 divide-y divide-border border-t border-border">
              <InfoRow label="File name" value={<span className="font-mono text-xs">{upload.fileName}</span>} mono />
              <InfoRow label="Size" value={upload.sizeLabel} />
              <InfoRow label="Received" value={new Date(upload.receivedAt).toLocaleString()} />
              <InfoRow
                label="Validation"
                value={
                  <span className="text-muted-foreground">
                    Not performed — requires the scientific backend (not connected in Demo Mode).
                  </span>
                }
              />
            </dl>
          </div>
        )}
      </section>

      {/* Loaded dataset inspector */}
      <section aria-labelledby="inspector-heading">
        <SectionHeading
          id="inspector-heading"
          title="Active dataset"
          description="Fields shown are the ones the data service actually returned. Unknown information is presented as unavailable or not assessed."
          actions={
            dataset && (
              <Button size="sm" variant="outline" onClick={unloadDataset}>
                Unload dataset
              </Button>
            )
          }
        />
        <div className="mt-3">
          {dataset ? (
            <DatasetInspector />
          ) : (
            <EmptyState
              icon={<FileSearch className="size-7" />}
              title="No dataset loaded"
              description="Load one of the demo datasets above to inspect its schema, fields and genes."
            />
          )}
        </div>
      </section>
    </div>
  );
}

function DatasetInspector() {
  const dataset = useBioAgentStore((s) => s.dataset)!;
  const [geneQuery, setGeneQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = geneQuery.trim().toLowerCase();
    const base = q ? dataset.genes.filter((g) => g.name.toLowerCase().startsWith(q)) : dataset.genes;
    return base;
  }, [dataset.genes, geneQuery]);

  const visible = expanded ? filtered.slice(0, 200) : filtered.slice(0, 12);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{dataset.meta.name}</h3>
          <DemoTag compact />
          <ValidationBadge state={dataset.meta.validation} />
        </div>
        <dl className="mt-3 divide-y divide-border border-t border-border">
          <InfoRow label="Dataset ID" value={<MonoId value={dataset.meta.id} />} mono />
          <InfoRow label="Dimensions" value={`${dataset.meta.obsCountLabel} × ${dataset.meta.genesLabel}`} />
          <InfoRow label="Layers" value={dataset.layers.join(" · ")} />
          <InfoRow label="Source" value={dataset.meta.source} />
          <InfoRow label="Citation" value={dataset.meta.citation ?? "Not available"} />
          <InfoRow label="Fingerprint" value={<MonoId value={dataset.fingerprint} />} mono />
        </dl>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">Provenance checklist</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Fields a real dataset must record before it is frozen for analysis. For the synthetic demo
          datasets they are honestly shown as not recorded rather than filled in.
        </p>
        <dl className="mt-3 divide-y divide-border border-t border-border">
          <InfoRow label="License" value={dataset.meta.license ?? "Not recorded"} />
          <InfoRow label="Accession / source URL" value={dataset.meta.accession ?? "Not recorded"} />
          <InfoRow
            label="Download date"
            value={dataset.meta.downloadedAt ? new Date(dataset.meta.downloadedAt).toLocaleDateString() : "Not recorded"}
          />
          <InfoRow label="Source checksum" value={dataset.meta.checksumLabel ?? "Not recorded"} />
        </dl>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Schema fields */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="text-sm font-semibold">Schema fields</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Observed fields as reported by schema validation.
          </p>
          <div className="mt-3 overflow-hidden rounded-md border border-border">
            <Table className="ba-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col">Field</TableHead>
                  <TableHead scope="col">Location</TableHead>
                  <TableHead scope="col" className="hidden sm:table-cell">
                    Description
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...dataset.obsFields, ...dataset.varFields].map((f) => (
                  <TableRow key={`${f.location}:${f.field}`}>
                    <TableCell className="font-mono text-xs">{f.field}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{f.location}</TableCell>
                    <TableCell className="hidden max-w-xs text-xs text-muted-foreground sm:table-cell">
                      <p className="truncate" title={f.description}>
                        {f.description}
                      </p>
                      {f.notes && <p className="text-[11px] text-warning">{f.notes}</p>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 rounded-md border border-warning/30 bg-warning/5 p-3">
            <p className="text-xs font-medium text-warning">Unavailable fields</p>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {dataset.unavailableFields.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Gene browser */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="text-sm font-semibold">Gene browser</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Identifiers present in <span className="font-mono text-[11px]">var_names</span>. Demo
            identifiers are synthetic.
          </p>
          <div className="mt-3">
            <Label htmlFor="gene-search" className="sr-only">
              Search genes
            </Label>
            <Input
              id="gene-search"
              placeholder="Search identifiers (e.g. Gene01)…"
              value={geneQuery}
              onChange={(e) => {
                setGeneQuery(e.target.value);
                setExpanded(false);
              }}
              className="max-w-xs"
            />
          </div>
          <div className="mt-3 overflow-hidden rounded-md border border-border">
            <Table className="ba-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col">Identifier</TableHead>
                  <TableHead scope="col" className="text-right">
                    Mean counts
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Detected fraction
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((g) => (
                  <TableRow key={g.name}>
                    <TableCell className="font-mono text-xs">{g.name}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatFixed(g.meanCounts, 2)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatFixed(g.detectedFraction * 100, 1)}%
                    </TableCell>
                  </TableRow>
                ))}
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-6 text-center text-xs text-muted-foreground">
                      No identifier starts with “{geneQuery}”.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 12 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "Show fewer" : `Show ${Math.min(200, filtered.length)} of ${filtered.length} matches`}
            </Button>
          )}
          {filtered.length > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {filtered.length} identifier{filtered.length === 1 ? "" : "s"} match the current search.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
