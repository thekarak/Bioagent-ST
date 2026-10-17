"use client";

/** Legends, color scale bar and distribution histogram for scientific plots. */

import * as React from "react";
import { categoricalColor, rampStops, ZERO_COLOR } from "@/lib/bioagent/colors";
import { histogram, formatNumber } from "@/lib/bioagent/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function CategoricalLegend({
  labels,
  counts,
  selected,
  onSelect,
  total,
}: {
  labels: number[];
  counts?: number[];
  selected?: number | null;
  onSelect?: (label: number | null) => void;
  total?: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5" role="list" aria-label="Cluster legend">
      {labels.map((label, i) => {
        const isSelected = selected === label;
        const count = counts?.[i];
        return (
          <button
            key={label}
            type="button"
            aria-pressed={isSelected}
            aria-label={`Cluster ${label}${count !== undefined ? `, ${count} observations` : ""}`}
            className={cn(
              "ba-focus inline-flex items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-0.5 text-xs transition-colors",
              isSelected ? "bg-secondary font-medium" : "hover:bg-secondary/60"
            )}
            onClick={() => onSelect?.(isSelected ? null : label)}
          >
            <span
              className="size-2.5 shrink-0 rounded-[2px] border border-black/10"
              style={{ backgroundColor: categoricalColor(label) }}
              aria-hidden
            />
            <span className="text-foreground">Cluster {label}</span>
            {count !== undefined && total ? (
              <span className="text-muted-foreground">
                {count} · {((count / total) * 100).toFixed(1)}%
              </span>
            ) : count !== undefined ? (
              <span className="text-muted-foreground">{count}</span>
            ) : null}
          </button>
        );
      })}
      {onSelect && selected !== null && (
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onSelect(null)}>
          Clear highlight
        </Button>
      )}
    </div>
  );
}

export function ContinuousScaleBar({
  min,
  max,
  label,
  units,
  zeroNote,
}: {
  min: number;
  max: number;
  label: string;
  units?: string;
  zeroNote?: string;
}) {
  const stops = rampStops(28);
  return (
    <div className="flex items-center gap-3" aria-label={`${label} color scale`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {zeroNote && (
          <>
            <span
              className="inline-block h-3 w-4 rounded-[2px] border border-black/10"
              style={{ backgroundColor: ZERO_COLOR }}
              aria-label={`zero: ${zeroNote}`}
            />
            <span className="text-[10px] text-muted-foreground">0</span>
            <span className="text-muted-foreground/50">·</span>
          </>
        )}
        <span
          className="h-3 w-40 rounded-[2px] border border-black/10"
          style={{ backgroundImage: `linear-gradient(to right, ${stops.join(",")})` }}
          aria-hidden
        />
        <span className="font-mono text-[10px] text-muted-foreground">{min.toFixed(1)}</span>
        <span className="text-muted-foreground/60 text-[10px]">→</span>
        <span className="font-mono text-[10px] text-muted-foreground">{max.toFixed(1)}</span>
      </div>
      {units && <span className="text-[10px] text-muted-foreground">{units}</span>}
    </div>
  );
}

export function DistributionHistogram({
  values,
  bins = 26,
  color = "#2C7771",
  xLabel,
  className,
  height = 130,
}: {
  values: number[];
  bins?: number;
  color?: string;
  xLabel?: string;
  className?: string;
  height?: number;
}) {
  const binsData = React.useMemo(() => histogram(values, bins), [values, bins]);
  if (binsData.length === 0) {
    return (
      <div className={cn("flex h-24 items-center justify-center text-xs text-muted-foreground", className)}>
        No distribution data available.
      </div>
    );
  }
  const w = 320;
  const h = height;
  const pad = { l: 6, r: 6, t: 6, b: 16 };
  const maxCount = Math.max(...binsData.map((b) => b.count));
  const x0 = binsData[0].x0;
  const x1 = binsData[binsData.length - 1].x1;
  const bw = (w - pad.l - pad.r) / binsData.length;
  return (
    <svg
      role="img"
      aria-label={`Histogram of ${xLabel ?? "values"} (${values.length} observations)`}
      viewBox={`0 0 ${w} ${h}`}
      className={cn("w-full", className)}
    >
      {binsData.map((b, i) => {
        const barH = maxCount > 0 ? (b.count / maxCount) * (h - pad.t - pad.b) : 0;
        return (
          <rect
            key={i}
            x={pad.l + i * bw}
            y={h - pad.b - barH}
            width={Math.max(bw - 1, 1)}
            height={barH}
            fill={color}
            fillOpacity={0.85}
          />
        );
      })}
      <line x1={pad.l} y1={h - pad.b} x2={w - pad.r} y2={h - pad.b} stroke="#DDE4E3" />
      <text x={pad.l} y={h - 4} fontSize={8} fill="#677681">
        {formatNumber(x0)}
      </text>
      <text x={w - pad.r} y={h - 4} fontSize={8} fill="#677681" textAnchor="end">
        {formatNumber(x1)}
      </text>
      <text x={w / 2} y={h - 4} fontSize={8} fill="#677681" textAnchor="middle">
        {xLabel ?? ""} · max bin {formatNumber(maxCount)}
      </text>
    </svg>
  );
}

export function ClusterTable({
  clusterSizes,
  total,
  selected,
  onSelect,
  clusterWord = "cluster",
}: {
  clusterSizes: { label: number; count: number }[];
  total: number;
  selected: number | null;
  onSelect: (label: number | null) => void;
  clusterWord?: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <Table className="ba-table">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col">Label</TableHead>
            <TableHead scope="col" className="text-right">
              Observations
            </TableHead>
            <TableHead scope="col" className="text-right">
              Share
            </TableHead>
            <TableHead scope="col" className="w-24">
              Action
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clusterSizes.map((c) => (
            <TableRow
              key={c.label}
              className={cn("cursor-pointer", selected === c.label && "bg-secondary")}
              onClick={() => onSelect(selected === c.label ? null : c.label)}
            >
              <TableCell>
                <span className="inline-flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-[2px] border border-black/10"
                    style={{ backgroundColor: categoricalColor(c.label) }}
                    aria-hidden
                  />
                  <span className="font-medium">
                    {clusterWord === "cluster" ? "Cluster" : "Group"} {c.label}
                  </span>
                </span>
              </TableCell>
              <TableCell className="text-right font-mono text-xs">{formatNumber(c.count)}</TableCell>
              <TableCell className="text-right font-mono text-xs">
                {((c.count / total) * 100).toFixed(1)}%
              </TableCell>
              <TableCell>
                <span
                  className="text-xs text-teal underline-offset-2 hover:underline"
                  aria-pressed={selected === c.label}
                >
                  {selected === c.label ? "Deselect" : "Select"}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
