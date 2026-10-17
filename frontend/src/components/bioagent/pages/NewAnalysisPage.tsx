"use client";

/**
 * New Analysis workspace.
 *
 * A structured analysis form (not a conversational product): the researcher
 * writes a question, selects a dataset, reviews the selector's decision,
 * prerequisites and the policy gate, tunes supported parameters, and runs
 * the approved workflow — or is told precisely why the request cannot run.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CircleDashed,
  Plus,
  X,
  Info,
  ArrowRight,
} from "lucide-react";
import { useBioAgentStore } from "@/lib/bioagent/store";
import { navigateTo, APP_ROUTES } from "@/lib/bioagent/router";
import { selectWorkflow, EXAMPLE_QUESTIONS } from "@/lib/bioagent/selector";
import { evaluatePrerequisites, evaluatePolicy } from "@/lib/bioagent/prereqs";
import {
  defaultClusteringParams,
  defaultGeneExpressionParams,
  defaultQualityParams,
  PARAM_RANGES,
} from "@/lib/bioagent/workflows";
import { getDemoEngine } from "@/lib/bioagent/demo-dataset";
import type {
  ClusteringParams,
  GeneExpressionParams,
  QualityParams,
  SelectorKind,
  WorkflowId,
  WorkflowParams,
} from "@/lib/bioagent/types";
import { PolicyBadge, PrereqStatusBadge, ValidationBadge } from "@/components/bioagent/common/StatusBadge";
import { DemoTag, EmptyState, SectionHeading } from "@/components/bioagent/common/primitives";
import { cn } from "@/lib/utils";

export function NewAnalysisPage() {
  const dataset = useBioAgentStore((s) => s.dataset);
  const catalog = useBioAgentStore((s) => s.datasetCatalog);
  const createRun = useBioAgentStore((s) => s.createRun);
  const pendingGenes = useBioAgentStore((s) => s.pendingGenes);
  const pendingWorkflow = useBioAgentStore((s) => s.pendingWorkflow);
  const setPendingGenes = useBioAgentStore((s) => s.setPendingGenes);
  const setPendingWorkflow = useBioAgentStore((s) => s.setPendingWorkflow);

  const [question, setQuestion] = React.useState("");
  const [selectorKind, setSelectorKind] = React.useState<SelectorKind>("rules");
  const [manualWorkflow, setManualWorkflow] = React.useState<WorkflowId>("quality_assessment");
  const [selectedDatasetId, setSelectedDatasetId] = React.useState<string | null>(
    dataset?.meta.id ?? null
  );
  const [clusteringParams, setClusteringParams] = React.useState<ClusteringParams>(defaultClusteringParams());
  const [geneParams, setGeneParams] = React.useState<GeneExpressionParams>(defaultGeneExpressionParams());
  const [qualityParams, setQualityParams] = React.useState<QualityParams>(defaultQualityParams());

  // Consume pre-selections coming from the command palette / landing page.
  React.useEffect(() => {
    if (pendingGenes.length > 0) {
      setGeneParams((p) => ({ ...p, genes: pendingGenes.slice(0, PARAM_RANGES.maxGenes) }));
      setSelectorKind("manual");
      setManualWorkflow("gene_expression");
      setQuestion(
        (q) => q || `Show spatial expression of ${pendingGenes.slice(0, PARAM_RANGES.maxGenes).join(" and ")}.`
      );
      setPendingGenes([]);
    }
    if (pendingWorkflow && pendingWorkflow !== "unsupported_or_ambiguous") {
      setSelectorKind("manual");
      setManualWorkflow(pendingWorkflow);
      setPendingWorkflow(null);
    }
  }, []);

  const selectedMeta = catalog.find((d) => d.id === selectedDatasetId) ?? null;
  const selector = React.useMemo(
    () => selectWorkflow(question, selectorKind, manualWorkflow),
    [question, selectorKind, manualWorkflow]
  );

  const activeWorkflow: WorkflowId = selector.decision;

  const params: WorkflowParams =
    activeWorkflow === "spatial_clustering"
      ? clusteringParams
      : activeWorkflow === "gene_expression"
        ? geneParams
        : activeWorkflow === "quality_assessment"
          ? qualityParams
          : {};

  const geneResolutions = React.useMemo(() => {
    if (activeWorkflow !== "gene_expression" || !selectedDatasetId) return undefined;
    const engine = getDemoEngine(selectedDatasetId);
    return geneParams.genes.map((g) => ({
      requested: g,
      match: engine.resolveGene(g).match,
    }));
  }, [activeWorkflow, selectedDatasetId, geneParams.genes]);

  const prereqs = React.useMemo(
    () => evaluatePrerequisites({ workflow: activeWorkflow, dataset: selectedMeta, params, geneResolutions }),
    [activeWorkflow, selectedMeta, params, geneResolutions]
  );
  const policy = React.useMemo(() => evaluatePolicy(activeWorkflow, prereqs), [activeWorkflow, prereqs]);

  const canRun = policy.decision === "ALLOW" && question.trim().length > 0 && selectedDatasetId !== null;

  const runWorkflow = () => {
    if (!canRun || !selectedDatasetId) return;
    const runId = createRun({
      question: question.trim(),
      datasetId: selectedDatasetId,
      selectorKind,
      manualWorkflow: selectorKind === "manual" ? activeWorkflow : undefined,
      params,
    });
    navigateTo(APP_ROUTES.run(runId));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">New Analysis</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Express a research question, select a dataset, and review the proposed workflow before
          execution. The selector and policy gate run first; the scientific pipeline itself runs only
          through registered workflows.
        </p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,25rem)]">
        {/* Left column: request flow */}
        <div className="space-y-6">
          {/* A. Research request */}
          <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="request-heading">
            <SectionHeading
              id="request-heading"
              title="What would you like to investigate?"
              description="Write the research question in your own words. Example questions demonstrate the three approved workflows; the text stays fully editable."
            />
            <Textarea
              id="question-input"
              aria-labelledby="request-heading"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Show spatial clusters based on expression patterns in this dataset."
              rows={3}
              className="mt-3 resize-y"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLE_QUESTIONS.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => setQuestion(ex.question)}
                  className="ba-focus rounded-md border border-border bg-secondary/60 px-2.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground"
                  title={ex.question}
                >
                  {ex.label}: <span className="text-foreground/80">{ex.question.slice(0, 46)}…</span>
                </button>
              ))}
            </div>
          </section>

          {/* B. Dataset selection */}
          <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="dataset-select-heading">
            <SectionHeading
              id="dataset-select-heading"
              title="Dataset"
              description="Select the dataset to analyze. Prerequisites below update according to what the dataset actually provides."
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Dataset selection">
              {catalog.map((d) => {
                const selected = selectedDatasetId === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedDatasetId(d.id)}
                    className={cn(
                      "ba-focus rounded-lg border p-3 text-left transition-colors",
                      selected
                        ? "border-teal/60 bg-teal/5 ring-1 ring-teal/20"
                        : "border-border hover:border-foreground/25"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">{d.name}</p>
                      <span
                        className={cn(
                          "mt-0.5 size-4 shrink-0 rounded-full border",
                          selected ? "border-teal bg-teal" : "border-border bg-secondary"
                        )}
                        aria-hidden
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <DemoTag compact />
                      <ValidationBadge state={d.validation} />
                    </div>
                    <dl className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      <p>{d.obsCountLabel} · {d.genesLabel}</p>
                      <p>Coordinates: {d.hasSpatialCoordinates ? "available" : "missing"}</p>
                    </dl>
                    {!d.hasSpatialCoordinates && (
                      <p className="mt-2 text-[11px] leading-snug text-warning">
                        Spatial workflows are blocked on this dataset (missing obsm[&apos;spatial&apos;]).
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Inspect schemas in the Datasets section before running. Both entries are illustrative
              demo datasets generated locally.
            </p>
          </section>

          {/* C. Selector choice */}
          <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="selector-heading">
            <SectionHeading
              id="selector-heading"
              title="Workflow selection"
              description="Choose how the request is routed. The selector's decision is shown before anything runs; an unknown label can never pass directly into scientific execution."
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {(
                [
                  { kind: "rules", title: "Deterministic rules", note: "Transparent keyword rules (demo)" },
                  { kind: "laya", title: "Laya selector", note: "Simulated — real selector not connected" },
                  { kind: "manual", title: "Manual selection", note: "Still passes prerequisites and the policy gate" },
                ] as { kind: SelectorKind; title: string; note: string }[]
              ).map((opt) => (
                <button
                  key={opt.kind}
                  type="button"
                  aria-pressed={selectorKind === opt.kind}
                  onClick={() => setSelectorKind(opt.kind)}
                  className={cn(
                    "ba-focus rounded-lg border p-3 text-left transition-colors",
                    selectorKind === opt.kind
                      ? "border-teal/60 bg-teal/5 ring-1 ring-teal/20"
                      : "border-border hover:border-foreground/25"
                  )}
                >
                  <p className="text-sm font-medium">{opt.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{opt.note}</p>
                </button>
              ))}
            </div>

            {selectorKind === "manual" && (
              <div className="mt-4 grid max-w-sm gap-1.5">
                <Label htmlFor="manual-workflow">Manual workflow selection</Label>
                <Select value={manualWorkflow} onValueChange={(v) => setManualWorkflow(v as WorkflowId)}>
                  <SelectTrigger id="manual-workflow">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quality_assessment">quality_assessment</SelectItem>
                    <SelectItem value="spatial_clustering">spatial_clustering</SelectItem>
                    <SelectItem value="gene_expression">gene_expression</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  The allowed labels are exactly the registered v1 workflows.
                </p>
              </div>
            )}

            {/* Selector decision preview */}
            <div className="mt-4 rounded-md border border-border bg-secondary/40 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Selector decision · {selector.name}
                </p>
                <code className="rounded bg-card px-1.5 py-0.5 font-mono text-xs font-medium text-foreground">
                  {selector.decision}
                </code>
              </div>
              {selector.matchedSignals.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Matched signals:{" "}
                  <span className="font-mono text-[11px] text-teal">
                    {selector.matchedSignals.join(" · ")}
                  </span>
                </p>
              )}
              {selector.normalizedIntent && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Normalized intent: <span className="font-mono text-[11px]">{selector.normalizedIntent}</span>
                </p>
              )}
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{selector.notes}</p>
            </div>
          </section>

          {/* F. Parameters */}
          {activeWorkflow !== "unsupported_or_ambiguous" && (
            <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="params-heading">
              <SectionHeading
                id="params-heading"
                title="Parameters"
                description="Only parameters supported by the selected workflow are shown. Invalid values are reported and never silently altered."
              />
              <div className="mt-3">
                {activeWorkflow === "spatial_clustering" && (
                  <ClusteringParamsForm params={clusteringParams} onChange={setClusteringParams} />
                )}
                {activeWorkflow === "gene_expression" && (
                  <GeneParamsForm
                    params={geneParams}
                    onChange={setGeneParams}
                    selectedDatasetId={selectedDatasetId}
                    geneResolutions={geneResolutions}
                  />
                )}
                {activeWorkflow === "quality_assessment" && (
                  <QualityParamsForm params={qualityParams} onChange={setQualityParams} />
                )}
              </div>
            </section>
          )}
        </div>

        {/* Right column: prerequisites, policy, execution */}
        <div className="space-y-6 xl:sticky xl:top-20">
          {/* D. Prerequisites */}
          <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="prereq-heading">
            <SectionHeading
              id="prereq-heading"
              title="Prerequisites"
              description="Evaluated against the selected dataset and request before execution."
            />
            <ul className="mt-3 space-y-2">
              {prereqs.map((check) => (
                <li
                  key={check.id}
                  className={cn(
                    "rounded-md border p-3",
                    check.status === "missing"
                      ? "border-error/30 bg-error/5"
                      : check.status === "warning"
                        ? "border-warning/30 bg-warning/5"
                        : "border-border bg-secondary/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{check.label}</p>
                    <PrereqStatusBadge status={check.status} />
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{check.explanation}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground/80">source: {check.source}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
              {prereqs.some((c) => c.status === "not_assessed") ? (
                <>
                  <CircleDashed className="mt-0.5 size-3 shrink-0" aria-hidden />
                  Checks that have not run yet are shown as “Not assessed” — never as passed.
                </>
              ) : (
                <>
                  <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
                  A green indicator appears only for checks that have actually been evaluated.
                </>
              )}
            </p>
          </section>

          {/* E. Policy gate */}
          <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="policy-heading">
            <SectionHeading id="policy-heading" title="Policy gate" />
            <div
              className={cn(
                "mt-3 rounded-md border p-4",
                policy.decision === "ALLOW"
                  ? "border-verified/30 bg-verified/5"
                  : policy.decision === "REVIEW"
                    ? "border-warning/30 bg-warning/5"
                    : "border-error/30 bg-error/5"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <PolicyBadge decision={policy.decision} />
                {policy.decision !== "ALLOW" && (
                  <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                    execution locked
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">{policy.reason}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{policy.detail}</p>
              {policy.decision === "REVIEW" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setQuestion(
                        "Show spatial clusters based on expression patterns in this dataset."
                      )
                    }
                  >
                    Reformulate to a supported request
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectorKind("manual")}>
                    Select a workflow manually
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* G. Execution */}
          <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="exec-heading">
            <SectionHeading id="exec-heading" title="Execution" />
            <dl className="mt-3 divide-y divide-border border-y border-border text-sm">
              <SummaryRow label="Dataset" value={selectedMeta ? selectedMeta.shortId : "None selected"} mono={!!selectedMeta} />
              <SummaryRow label="Workflow" value={activeWorkflow} mono />
              <SummaryRow
                label="Policy"
                value={
                  <span className="flex items-center gap-2">
                    <PolicyBadge decision={policy.decision} />
                  </span>
                }
              />
              <SummaryRow label="Question" value={question.trim() ? `“${truncateQ(question.trim())}”` : "Empty"} />
            </dl>
            <Button className="mt-4 w-full" size="lg" disabled={!canRun} onClick={runWorkflow}>
              <Play className="size-4" aria-hidden />
              Run Approved Workflow
            </Button>
            {!canRun && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {policy.decision !== "ALLOW"
                  ? "The policy gate must return ALLOW before execution."
                  : !question.trim()
                    ? "Provide a research question first."
                    : "Select a dataset first."}
              </p>
            )}
            <p className="mt-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
              Demo Mode: execution is a clearly-labeled local simulation that demonstrates interface
              states. It does not run Scanpy/Squidpy and does not produce real scientific results.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-baseline gap-3 py-2">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 truncate text-sm text-foreground", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}

function truncateQ(q: string): string {
  return q.length > 60 ? `${q.slice(0, 59)}…` : q;
}

/* ---------- Parameter forms ---------- */

function NumberField({
  id,
  label,
  value,
  onChange,
  range,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  range: { min: number; max: number };
  hint?: string;
}) {
  const invalid = !Number.isFinite(value) || value < range.min || value > range.max;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
        <span className="ml-1 font-mono text-[10px] text-muted-foreground">
          [{range.min}–{range.max}]
        </span>
      </Label>
      <Input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={range.min}
        max={range.max}
        aria-invalid={invalid}
        onChange={(e) => {
          const v = e.target.value === "" ? NaN : Number(e.target.value);
          onChange(v);
        }}
        className={cn("max-w-[10rem]", invalid && "border-error focus-visible:ring-error/30")}
      />
      {invalid ? (
        <p className="text-[11px] text-error">
          Value outside the allowed range [{range.min}–{range.max}]. It will not be silently altered.
        </p>
      ) : (
        hint && <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function ClusteringParamsForm({
  params,
  onChange,
}: {
  params: ClusteringParams;
  onChange: (p: ClusteringParams) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label htmlFor="norm-select" className="text-xs">
          Normalization
        </Label>
        <Select
          value={params.normalization}
          onValueChange={(v) => onChange({ ...params, normalization: v as ClusteringParams["normalization"] })}
        >
          <SelectTrigger id="norm-select" className="max-w-[10rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lognorm">lognorm (normalize_total + log1p)</SelectItem>
            <SelectItem value="counts">counts (none)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">Documented transformation applied before PCA.</p>
      </div>
      <NumberField
        id="n-pcs"
        label="Principal components"
        value={params.n_pcs}
        onChange={(v) => onChange({ ...params, n_pcs: v })}
        range={PARAM_RANGES.n_pcs}
        hint="Dimensions kept after PCA."
      />
      <NumberField
        id="n-neighbors"
        label="Neighbors (k)"
        value={params.n_neighbors}
        onChange={(v) => onChange({ ...params, n_neighbors: v })}
        range={PARAM_RANGES.n_neighbors}
        hint="Nearest neighbors in the graph."
      />
      <NumberField
        id="resolution"
        label="Leiden resolution"
        value={params.resolution}
        onChange={(v) => onChange({ ...params, resolution: v })}
        range={PARAM_RANGES.resolution}
        hint="Higher values yield more clusters."
      />
      <NumberField
        id="seed"
        label="Random seed"
        value={params.seed}
        onChange={(v) => onChange({ ...params, seed: v })}
        range={PARAM_RANGES.seed}
        hint="Recorded in provenance for replay."
      />
    </div>
  );
}

function GeneParamsForm({
  params,
  onChange,
  selectedDatasetId,
  geneResolutions,
}: {
  params: GeneExpressionParams;
  onChange: (p: GeneExpressionParams) => void;
  selectedDatasetId: string | null;
  geneResolutions?: { requested: string; match: "exact" | "not_found" | "ambiguous" }[];
}) {
  const [geneInput, setGeneInput] = React.useState("");
  const dataset = useBioAgentStore((s) => s.dataset);
  const genes = selectedDatasetId === dataset?.meta.id ? dataset.genes : [];
  const engine = selectedDatasetId ? getDemoEngine(selectedDatasetId) : null;
  const layers = selectedDatasetId === "ds_demo_tissue_01" ? ["counts", "lognorm"] : ["counts"];

  const suggestions = React.useMemo(() => {
    const q = geneInput.trim().toLowerCase();
    if (!q || !engine) return [];
    return engine.geneNames.filter((g) => g.toLowerCase().startsWith(q)).slice(0, 6);
  }, [geneInput, engine]);

  const addGene = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (params.genes.length >= PARAM_RANGES.maxGenes) return;
    if (params.genes.some((g) => g.toLowerCase() === trimmed.toLowerCase())) return;
    onChange({ ...params, genes: [...params.genes, trimmed] });
    setGeneInput("");
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="gene-input" className="text-xs">
          Requested genes (1–{PARAM_RANGES.maxGenes})
        </Label>
        <div className="flex max-w-md gap-2">
          <div className="relative flex-1">
            <Input
              id="gene-input"
              value={geneInput}
              onChange={(e) => setGeneInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addGene(geneInput);
                }
              }}
              placeholder="Type an identifier, e.g. Gene0134"
              aria-describedby="gene-help"
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
                {suggestions.map((g) => (
                  <li key={g}>
                    <button
                      type="button"
                      className="ba-focus flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs hover:bg-secondary"
                      onClick={() => addGene(g)}
                    >
                      <span className="font-mono">{g}</span>
                      {genes.find((x) => x.name === g) && (
                        <span className="text-[10px] text-muted-foreground">
                          {(genes.find((x) => x.name === g)!.detectedFraction * 100).toFixed(0)}% detected
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => addGene(geneInput)}
            disabled={!geneInput.trim() || params.genes.length >= PARAM_RANGES.maxGenes}
          >
            <Plus className="size-3.5" aria-hidden />
            Add
          </Button>
        </div>
        <p id="gene-help" className="text-[11px] text-muted-foreground">
          Identifiers are resolved against var_names. Unresolved or ambiguous genes never get
          silently substituted.
        </p>
        {params.genes.length >= PARAM_RANGES.maxGenes && (
          <p className="text-[11px] text-warning">
            Maximum of {PARAM_RANGES.maxGenes} genes reached for this workflow.
          </p>
        )}
      </div>

      {params.genes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Gene resolution</p>
          <ul className="space-y-1.5">
            {params.genes.map((g, i) => {
              const res = geneResolutions?.[i];
              const match = res?.match ?? "not_found";
              const resolved = engine?.resolveGene(g);
              return (
                <li
                  key={g}
                  className={cn(
                    "flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm",
                    match === "exact"
                      ? "border-verified/30 bg-verified/5"
                      : match === "ambiguous"
                        ? "border-warning/30 bg-warning/5"
                        : "border-error/30 bg-error/5"
                  )}
                >
                  <span className="font-mono text-xs">{g}</span>
                  {match === "exact" && (
                    <>
                      <CheckCircle2 className="size-3.5 text-verified" aria-label="resolved" />
                      <span className="text-xs text-muted-foreground">
                        exact match{resolved?.candidates.length ? ` → ${resolved.resolved}` : ""}
                      </span>
                    </>
                  )}
                  {match === "ambiguous" && resolved?.candidates.length ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <AlertTriangle className="size-3.5 text-warning" aria-label="ambiguous" />
                      <span className="text-xs text-muted-foreground">ambiguous — pick one:</span>
                      {resolved.candidates.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className="ba-focus rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] hover:border-teal/50"
                          onClick={() =>
                            onChange({
                              ...params,
                              genes: params.genes.map((x, j) => (j === i ? c : x)),
                            })
                          }
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  ) : (
                    match === "not_found" && (
                      <>
                        <XCircle className="size-3.5 text-error" aria-label="not found" />
                        <span className="text-xs text-muted-foreground">
                          no match in var_names — this will block execution
                        </span>
                      </>
                    )
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${g}`}
                    className="ba-focus ml-auto rounded p-0.5 text-muted-foreground hover:text-error"
                    onClick={() => onChange({ ...params, genes: params.genes.filter((_, j) => j !== i) })}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="layer-select" className="text-xs">
          Expression layer
        </Label>
        <Select
          value={params.layer}
          onValueChange={(v) => onChange({ ...params, layer: v })}
        >
          <SelectTrigger id="layer-select" className="max-w-[12rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {layers.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Only layers the dataset actually provides are listed. The active layer is recorded in the
          run manifest.
        </p>
      </div>
    </div>
  );
}

function QualityParamsForm({
  params,
  onChange,
}: {
  params: QualityParams;
  onChange: (p: QualityParams) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <NumberField
        id="min-counts"
        label="Minimum total counts"
        value={params.min_counts}
        onChange={(v) => onChange({ ...params, min_counts: v })}
        range={PARAM_RANGES.min_counts}
        hint="Observations below this are flagged."
      />
      <NumberField
        id="min-genes"
        label="Minimum detected genes"
        value={params.min_genes}
        onChange={(v) => onChange({ ...params, min_genes: v })}
        range={PARAM_RANGES.min_genes}
        hint="Observations below this are flagged."
      />
      <p className="col-span-full flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground sm:col-span-2">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        QC thresholds are analysis choices made by the researcher — they are not universal biological
        truths. Metrics the schema cannot support (such as mitochondrial fraction without annotation)
        are reported as not assessed.
      </p>
    </div>
  );
}
