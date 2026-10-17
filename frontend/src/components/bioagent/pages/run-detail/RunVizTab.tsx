"use client";

/**
 * Spatial visualization workspace for clustering and gene-expression runs.
 * Modes appear only when the run actually produced the corresponding data;
 * a spatial coordinate map is never presented as a UMAP projection.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, ImageDown, FileJson, Info } from "lucide-react";
import type { RunRecord, ClusteringResults, GeneExpressionResults, QualityResults } from "@/lib/bioagent/types";
import { getDemoEngine } from "@/lib/bioagent/demo-dataset";
import { categoricalColor, rampColor, ZERO_COLOR } from "@/lib/bioagent/colors";
import { SpatialScatterPlot } from "@/components/bioagent/viz/SpatialScatterPlot";
import { CategoricalLegend, ContinuousScaleBar, DistributionHistogram, ClusterTable } from "@/components/bioagent/viz/legends";
import { DemoTag, EmptyState, MonoId, SectionHeading } from "@/components/bioagent/common/primitives";
import { downloadSvgAsPng, downloadCsv, downloadJson } from "@/lib/bioagent/exports";
import { formatFixed, formatNumber } from "@/lib/bioagent/format";
import { useBioAgentStore } from "@/lib/bioagent/store";
import { useToast } from "@/hooks/use-toast";

type VizMode = "spatial" | "umap" | "gene" | "metadata";

export function RunVizTab({ run }: { run: RunRecord }) {
  const settings = useBioAgentStore((s) => s.settings);
  const [pointSize, setPointSize] = React.useState(settings.pointSize);
  const [opacity, setOpacity] = React.useState(settings.opacity);
  const [selectedCluster, setSelectedCluster] = React.useState<number | null>(null);
  const [selectedPoint, setSelectedPoint] = React.useState<number | null>(null);
  const [mode, setMode] = React.useState<VizMode | null>(null);
  const [activeGeneIdx, setActiveGeneIdx] = React.useState(0);
  const { toast } = useToast();

  const clustering = run.results?.kind === "spatial_clustering" ? (run.results as ClusteringResults) : null;
  const geneRun = run.results?.kind === "gene_expression" ? (run.results as GeneExpressionResults) : null;
  const engine = React.useMemo(() => getDemoEngine(run.datasetId), [run.datasetId]);

  const resolvedGenes = React.useMemo(
    () => (geneRun ? geneRun.entries.filter((e) => e.values !== null) : []),
    [geneRun]
  );
  const metaValues = React.useMemo(() => [...engine.totalCounts], [engine]);

  React.useEffect(() => {
    setActiveGeneIdx(0);
    setSelectedCluster(null);
    setSelectedPoint(null);
    setMode(null);
  }, [run.id]);

  const quality = run.results?.kind === "quality_assessment" ? (run.results as QualityResults) : null;

  if (!clustering && !geneRun && quality) {
    return <QualityResultsPanel run={run} results={quality} />;
  }

  if (!clustering && !geneRun) {
    return (
      <EmptyState
        title="No visualization artifacts for this run"
        description="The run did not produce plottable results (it was blocked or interrupted). Nothing is fabricated to fill this view."
      />
    );
  }

  const modes: { value: VizMode; label: string }[] = [];
  if (clustering) {
    modes.push({ value: "spatial", label: "Spatial View · Clusters" });
    modes.push({ value: "umap", label: "UMAP View" });
    modes.push({ value: "metadata", label: "Metadata View" });
  }
  if (geneRun) {
    modes.push({ value: "gene", label: "Gene Expression View" });
    modes.push({ value: "metadata", label: "Metadata View" });
  }
  const effectiveMode: VizMode =
    mode && modes.some((m) => m.value === mode) ? mode : modes[0].value;
  const setModeSafe = (v: string) => {
    setSelectedPoint(null);
    setMode(v as VizMode);
  };

  const isSpatialData = effectiveMode === "spatial" || effectiveMode === "gene" || effectiveMode === "metadata";
  const coords =
    clustering && effectiveMode !== "umap"
      ? clustering.spatial
      : geneRun && effectiveMode !== "umap"
        ? geneRun.spatial
        : clustering
          ? { x: clustering.umap.x, y: clustering.umap.y }
          : geneRun
            ? geneRun.spatial
            : { x: [], y: [] };

  const activeGene = resolvedGenes[activeGeneIdx] ?? null;
  const geneValues = activeGene?.values ?? null;
  const geneMax = geneValues ? Math.max(...geneValues) : 0;
  const metaMax = Math.max(...metaValues);

  const colorOf = (i: number): string => {
    if (effectiveMode === "spatial" && clustering) return categoricalColor(clustering.labels[i]);
    if (effectiveMode === "umap" && clustering) return categoricalColor(clustering.labels[i]);
    if (effectiveMode === "gene" && geneValues) {
      const v = geneValues[i];
      return v === 0 ? ZERO_COLOR : rampColor(v / geneMax);
    }
    return rampColor(metaValues[i] / metaMax);
  };

  const dimmed =
    (effectiveMode === "spatial" || effectiveMode === "umap") && clustering && selectedCluster !== null
      ? (i: number) => clustering.labels[i] !== selectedCluster
      : undefined;

  const tooltipOf = (i: number) => ({
    title: `spot_${String(i + 1).padStart(5, "0")}`,
    rows: [
      ...(clustering
        ? [
            { k: "cluster", v: `Cluster ${clustering.labels[i]}` },
          ]
        : []),
      ...(effectiveMode === "gene" && geneValues
        ? [
            { k: activeGene?.resolved ?? "expression", v: formatFixed(geneValues[i], 2) },
            { k: "layer", v: activeGene?.layer ?? "" },
          ]
        : []),
      ...(effectiveMode === "metadata" ? [{ k: "total_counts", v: String(metaValues[i]) }] : []),
      ...(isSpatialData
        ? [
            { k: "x", v: coords.x[i]?.toFixed(1) ?? "—" },
            { k: "y", v: coords.y[i]?.toFixed(1) ?? "—" },
          ]
        : [
            { k: "umap_1", v: formatFixed(coords.x[i] ?? 0, 2) },
            { k: "umap_2", v: formatFixed(coords.y[i] ?? 0, 2) },
          ]),
    ],
  });

  const svgId = `viz-${run.id}-${effectiveMode}`;

  const exportPng = async () => {
    const el = document.getElementById(svgId) as SVGSVGElement | null;
    if (!el) return;
    try {
      await downloadSvgAsPng(el, `${run.id}-${effectiveMode}.png`);
      toast({ title: "Plot exported", description: `${run.id}-${effectiveMode}.png downloaded.` });
    } catch {
      toast({ title: "Export failed", description: "The plot could not be rasterized in this browser." });
    }
  };

  const exportCsv = () => {
    if (clustering) {
      const rows: (string | number)[][] = [["obs_id", "cluster"]];
      clustering.labels.forEach((l, i) => rows.push([`spot_${String(i + 1).padStart(5, "0")}`, l]));
      downloadCsv(`${run.id}-cluster_labels.csv`, rows);
    } else if (activeGene && geneValues) {
      const rows: (string | number)[][] = [["obs_id", "expression"]];
      geneValues.forEach((v, i) => rows.push([`spot_${String(i + 1).padStart(5, "0")}`, v.toFixed(4)]));
      downloadCsv(`${run.id}-expression_${activeGene.resolved}.csv`, rows);
    }
  };

  const exportManifest = () => {
    downloadJson(`${run.id}-manifest.json`, {
      run: run.id,
      workflow: run.workflow,
      question: run.question,
      dataset: run.datasetId,
      dataset_fingerprint: engine.fingerprint(),
      params: run.params,
      note: "Demo Mode manifest — artifacts generated locally, illustrative only.",
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            {clustering ? "Spatial clustering results" : "Gene expression results"}
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <MonoId value={run.id} copy={false} />
            <span>·</span>
            <span className="font-mono">{run.datasetId === "ds_demo_tissue_01" ? "demo-tissue-01" : "demo-nospatial-02"}</span>
            <span>·</span>
            <DemoTag compact />
          </p>
        </div>
        <Tabs value={effectiveMode} onValueChange={setModeSafe}>
          <TabsList aria-label="Display mode">
            {modes.map((m) => (
              <TabsTrigger key={m.value} value={m.value}>
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
        {/* Plot column */}
        <div className="min-w-0 rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">
              {effectiveMode === "spatial" && "Spatial distribution of clusters"}
              {effectiveMode === "umap" && "Two-dimensional embedding (synthetic, demo)"}
              {effectiveMode === "gene" && activeGene && `Spatial expression of ${activeGene.resolved}`}
              {effectiveMode === "metadata" && "Observation metadata (total counts)"}
            </p>
            {effectiveMode === "gene" && activeGene && (
              <Select value={String(activeGeneIdx)} onValueChange={(v) => setActiveGeneIdx(Number(v))}>
                <SelectTrigger className="h-8 w-44" aria-label="Select gene">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resolvedGenes.map((g, i) => (
                    <SelectItem key={g.resolved} value={String(i)}>
                      <span className="font-mono text-xs">{g.resolved}</span>
                      <span className="ml-1 text-muted-foreground">({g.layer})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <SpatialScatterPlot
            data={coords}
            colorOf={colorOf}
            tooltipOf={tooltipOf}
            pointSize={pointSize}
            opacity={opacity}
            dimmed={dimmed}
            selectedPoint={selectedPoint}
            onSelectPoint={setSelectedPoint}
            aspect={effectiveMode === "umap" ? "auto" : "equal"}
            height={effectiveMode === "umap" ? 430 : 480}
            svgId={svgId}
            ariaLabel={`Scatter plot for run ${run.id}, mode ${effectiveMode}`}
          />

          <div className="mt-3 border-t border-border pt-3">
            {(effectiveMode === "spatial" || effectiveMode === "umap") && clustering && (
              <CategoricalLegend
                labels={clustering.clusterSizes.map((c) => c.label)}
                counts={clustering.clusterSizes.map((c) => c.count)}
                total={clustering.labels.length}
                selected={selectedCluster}
                onSelect={setSelectedCluster}
              />
            )}
            {effectiveMode === "gene" && activeGene && geneValues && (
              <ContinuousScaleBar
                min={Math.min(...geneValues.filter((v) => v > 0))}
                max={geneMax}
                label={`expression · ${activeGene.layer} layer`}
                zeroNote="zero counts drawn in gray"
                units={activeGene.layer === "counts" ? "counts" : "log1p(CP10K)"}
              />
            )}
            {effectiveMode === "metadata" && (
              <ContinuousScaleBar min={Math.min(...metaValues)} max={metaMax} label="total_counts per observation" units="counts" />
            )}
            {effectiveMode === "umap" && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Embedding coordinates were produced by the demo run (synthetic) — this is not
                presented as spatial histology.
              </p>
            )}
          </div>
        </div>

        {/* Control column */}
        <div className="space-y-4">
          {/* Display controls */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Display controls</h3>
            <div className="mt-3 grid gap-4">
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="point-size" className="text-xs text-muted-foreground">
                    Point size
                  </label>
                  <span className="font-mono text-[10px] text-muted-foreground">{pointSize.toFixed(1)}</span>
                </div>
                <Slider
                  id="point-size"
                  min={1}
                  max={7}
                  step={0.2}
                  value={[pointSize]}
                  onValueChange={(v) => setPointSize(v[0])}
                  aria-label="Point size"
                />
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="point-opacity" className="text-xs text-muted-foreground">
                    Opacity
                  </label>
                  <span className="font-mono text-[10px] text-muted-foreground">{Math.round(opacity * 100)}%</span>
                </div>
                <Slider
                  id="point-opacity"
                  min={0.2}
                  max={1}
                  step={0.05}
                  value={[opacity]}
                  onValueChange={(v) => setOpacity(v[0])}
                  aria-label="Point opacity"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
              <Button size="sm" variant="outline" onClick={exportPng}>
                <ImageDown className="size-3.5" aria-hidden />
                Export PNG
              </Button>
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={!clustering && !geneValues}>
                <Download className="size-3.5" aria-hidden />
                Export CSV
              </Button>
              <Button size="sm" variant="outline" onClick={exportManifest}>
                <FileJson className="size-3.5" aria-hidden />
                Manifest JSON
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Exports are produced locally from this run&apos;s demo artifacts. Only formats the
              implementation genuinely generates are offered.
            </p>
          </div>

          {/* Selected point details */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Selection details</h3>
            {selectedPoint !== null ? (
              <dl className="mt-2 divide-y divide-border border-t border-border">
                <DetailRow label="Observation" value={`spot_${String(selectedPoint + 1).padStart(5, "0")}`} mono />
                {clustering && (
                  <DetailRow
                    label="Cluster"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="size-2.5 rounded-[2px]"
                          style={{ backgroundColor: categoricalColor(clustering.labels[selectedPoint]) }}
                          aria-hidden
                        />
                        Cluster {clustering.labels[selectedPoint]}
                      </span>
                    }
                  />
                )}
                {geneValues && (
                  <DetailRow
                    label={activeGene?.resolved ?? "Expression"}
                    value={formatFixed(geneValues[selectedPoint], 2)}
                  />
                )}
                <DetailRow label="total_counts" value={formatNumber(engine.totalCounts[selectedPoint])} />
                <DetailRow label="n_genes" value={formatNumber(engine.nGenesPerObs[selectedPoint])} />
                {isSpatialData && (
                  <>
                    <DetailRow label="x" value={formatFixed(coords.x[selectedPoint], 2)} />
                    <DetailRow label="y" value={formatFixed(coords.y[selectedPoint], 2)} />
                  </>
                )}
              </dl>
            ) : selectedCluster !== null && clustering ? (
              <div className="mt-2">
                <p className="text-sm">
                  <span
                    className="mr-1.5 inline-block size-2.5 rounded-[2px] align-baseline"
                    style={{ backgroundColor: categoricalColor(selectedCluster) }}
                    aria-hidden
                    />
                  <span className="font-medium">Cluster {selectedCluster}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatNumber(
                    clustering.clusterSizes.find((c) => c.label === selectedCluster)?.count ?? 0
                  )}{" "}
                  observations ·{" "}
                  {(
                    ((clustering.clusterSizes.find((c) => c.label === selectedCluster)?.count ?? 0) /
                      clustering.labels.length) *
                    100
                  ).toFixed(1)}
                  % of the dataset. Computational cluster — not a cell type.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Click a point in the plot for per-observation details.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Click a point in the plot (or a cluster in the table) to inspect it here.
              </p>
            )}
          </div>

          {/* Gene match verification */}
          {geneRun && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-semibold">Gene match verification</h3>
              <ul className="mt-2 space-y-1.5">
                {geneRun.entries.map((e) => (
                  <li
                    key={e.requested}
                    className={`rounded-md border px-2.5 py-1.5 text-xs ${
                      e.match === "exact"
                        ? "border-verified/30 bg-verified/5"
                        : e.match === "ambiguous"
                          ? "border-warning/30 bg-warning/5"
                          : "border-error/30 bg-error/5"
                    }`}
                  >
                    <span className="font-mono">{e.requested}</span>
                    <span className="text-muted-foreground">
                      {" → "}
                      {e.resolved ? (
                        <span className="font-mono">{e.resolved}</span>
                      ) : (
                        e.match.replace("_", " ")
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gene distribution */}
          {effectiveMode === "gene" && activeGene && geneValues && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-semibold">Distribution · {activeGene.resolved}</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {activeGene.layer} layer · {formatNumber(geneValues.length)} observations
              </p>
              <DistributionHistogram values={geneValues} xLabel={`${activeGene.layer} value`} />
              {activeGene.stats && (
                <dl className="mt-2 divide-y divide-border border-t border-border text-xs">
                  <DetailRow label="min" value={formatFixed(activeGene.stats.min, 2)} />
                  <DetailRow label="median" value={formatFixed(activeGene.stats.median, 2)} />
                  <DetailRow label="mean" value={formatFixed(activeGene.stats.mean, 2)} />
                  <DetailRow label="max" value={formatFixed(activeGene.stats.max, 2)} />
                  <DetailRow
                    label="zero fraction"
                    value={`${(activeGene.stats.zeroFraction * 100).toFixed(1)}%`}
                  />
                </dl>
              )}
            </div>
          )}

          {/* Cluster table */}
          {clustering && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-semibold">Cluster table</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Neutral labels — clusters are not cell types.
              </p>
              <div className="mt-2">
                <ClusterTable
                  clusterSizes={clustering.clusterSizes}
                  total={clustering.labels.length}
                  selected={selectedCluster}
                  onSelect={setSelectedCluster}
                />
              </div>
            </div>
          )}

          <p className="flex items-start gap-2 rounded-md border border-border bg-secondary/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Expression alone does not establish gene function, causality, cell identity, or clinical
            significance. Cluster and expression views are computational descriptions of illustrative
            demo data.
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-xs text-foreground ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

/** Quality assessment results: metric table, QC histograms, missing fields. */
function QualityResultsPanel({ run, results }: { run: RunRecord; results: QualityResults }) {
  const { toast } = useToast();
  const exportCsv = () => {
    const rows: (string | number)[][] = [["obs_id", "total_counts", "n_genes"]];
    results.total_counts.forEach((t, i) =>
      rows.push([`spot_${String(i + 1).padStart(5, "0")}`, t, results.n_genes_per_obs[i]])
    );
    downloadCsv(`${run.id}-qc_metrics.csv`, rows);
    toast({ title: "Metrics exported", description: `${run.id}-qc_metrics.csv downloaded.` });
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Quality assessment results</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <MonoId value={run.id} copy={false} />
            <span>·</span>
            <DemoTag compact />
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="size-3.5" aria-hidden />
          Export metrics CSV
        </Button>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">QC metric distributions</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Distributions computed over all {results.total_counts.length} observations.
            </p>
            <div className="mt-3 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-foreground">Total counts per observation</p>
                <DistributionHistogram values={results.total_counts} xLabel="total counts" />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-foreground">Detected genes per observation</p>
                <DistributionHistogram values={results.n_genes_per_obs} xLabel="n_genes" color="#183345" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Unavailable fields</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Reported explicitly — never invented or silently skipped.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {results.missingFields.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Validation metrics</h3>
          <dl className="mt-2 divide-y divide-border border-t border-border">
            {results.metrics.map((m) => (
              <div key={m.label} className="py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs font-medium text-foreground">{m.label}</dt>
                  <dd
                    className={`shrink-0 font-mono text-xs ${
                      m.value === "Not assessed" ? "text-warning" : "text-foreground"
                    }`}
                  >
                    {m.value}
                  </dd>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{m.explanation}</p>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
