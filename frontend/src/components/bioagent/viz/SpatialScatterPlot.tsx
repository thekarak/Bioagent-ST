"use client";

/**
 * SpatialScatterPlot — custom SVG scatter for spatial coordinates.
 *
 * - Preserves the coordinate aspect ratio (spatial view) or fills the panel
 *   (embedding view).
 * - Supports wheel zoom (cursor-anchored), drag pan, reset, point selection
 *   and hover tooltips.
 * - Point rendering is memoized so hover/tooltip updates do not re-render
 *   thousands of circles.
 */

import * as React from "react";
import { ZoomIn, ZoomOut, Maximize2, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ScatterData {
  x: number[];
  y: number[];
}

export interface TooltipContent {
  title: string;
  rows: { k: string; v: string }[];
}

interface PointsLayerProps {
  data: ScatterData;
  colorOf: (i: number) => string;
  dimmed: (i: number) => boolean;
  pointSize: number;
  opacity: number;
  k: number;
  selectedPoint: number | null;
  onHover: (i: number | null) => void;
  onSelect: (i: number) => void;
}

const PointsLayer = React.memo(function PointsLayer({
  data,
  colorOf,
  dimmed,
  pointSize,
  opacity,
  k,
  selectedPoint,
  onHover,
  onSelect,
}: PointsLayerProps) {
  const r = Math.max(0.5, pointSize / Math.max(k, 1e-6));
  const points: React.ReactNode[] = [];
  const n = data.x.length;
  for (let i = 0; i < n; i++) {
    const isDim = dimmed(i);
    const selected = selectedPoint === i;
    points.push(
      <circle
        key={i}
        cx={data.x[i]}
        cy={data.y[i]}
        r={selected ? r * 1.8 : r}
        fill={colorOf(i)}
        fillOpacity={isDim ? opacity * 0.12 : opacity}
        stroke={selected ? "#192A32" : "none"}
        strokeWidth={selected ? Math.max(0.8 / k, 0.6) : 0}
        style={{ cursor: "pointer" }}
        onPointerEnter={() => onHover(i)}
        onPointerLeave={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(i);
        }}
      />
    );
  }
  return <g>{points}</g>;
});

function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span / count)));
  const err = span / count / step;
  const mult = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
  const s = step * mult;
  const ticks: number[] = [];
  const start = Math.ceil(min / s) * s;
  for (let t = start; t <= max + s * 0.001; t += s) ticks.push(Number(t.toFixed(6)));
  return ticks;
}

export interface SpatialScatterPlotProps {
  data: ScatterData;
  colorOf: (i: number) => string;
  tooltipOf?: (i: number) => TooltipContent | null;
  pointSize?: number;
  opacity?: number;
  dimmed?: (i: number) => boolean;
  selectedPoint?: number | null;
  onSelectPoint?: (i: number | null) => void;
  aspect?: "equal" | "auto";
  height?: number;
  svgId: string;
  ariaLabel: string;
  className?: string;
  emptyMessage?: string;
  toolbarExtra?: React.ReactNode;
}

export function SpatialScatterPlot({
  data,
  colorOf,
  tooltipOf,
  pointSize = 3.2,
  opacity = 0.85,
  dimmed,
  selectedPoint = null,
  onSelectPoint,
  aspect = "equal",
  height = 460,
  svgId,
  ariaLabel,
  className,
  emptyMessage = "No plottable data is available for this view.",
  toolbarExtra,
}: SpatialScatterPlotProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(720);
  const [transform, setTransform] = React.useState({ k: 1, tx: 0, ty: 0 });
  const [hover, setHover] = React.useState<number | null>(null);
  const [tipPos, setTipPos] = React.useState<{ x: number; y: number } | null>(null);
  const panning = React.useRef<{ sx: number; sy: number; tx: number; ty: number } | null>(null);
  const [isPanning, setIsPanning] = React.useState(false);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = data.x.length;

  // Data bounds with padding.
  const bounds = React.useMemo(() => {
    if (n === 0) return { x0: 0, y0: 0, w: 100, h: 100 };
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (let i = 0; i < n; i++) {
      if (data.x[i] < xMin) xMin = data.x[i];
      if (data.x[i] > xMax) xMax = data.x[i];
      if (data.y[i] < yMin) yMin = data.y[i];
      if (data.y[i] > yMax) yMax = data.y[i];
    }
    const padX = (xMax - xMin) * 0.04 || 1;
    const padY = (yMax - yMin) * 0.04 || 1;
    return { x0: xMin - padX, y0: yMin - padY, w: xMax - xMin + padX * 2, h: yMax - yMin + padY * 2 };
  }, [data, n]);

  const plotHeight = aspect === "equal" ? Math.max(240, Math.min(height, width * (bounds.h / bounds.w))) : height;
  const vb = aspect === "equal" ? bounds : fitBounds(bounds, width, plotHeight);

  const svgToWorld = React.useCallback(
    (clientX: number, clientY: number) => {
      const svg = containerRef.current?.querySelector("svg");
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const fx = (clientX - rect.left) / rect.width;
      const fy = (clientY - rect.top) / rect.height;
      return {
        x: vb.x0 + fx * vb.w,
        y: vb.y0 + fy * vb.h,
      };
    },
    [vb]
  );

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const p = svgToWorld(e.clientX, e.clientY);
    if (!p) return;
    setTransform((t) => {
      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      const k = Math.max(1, Math.min(60, t.k * factor));
      // Zoom anchored at the world point under the cursor.
      const wx = (p.x - vb.x0 - t.tx) / t.k;
      const wy = (p.y - vb.y0 - t.ty) / t.k;
      const tx = (p.x - vb.x0) - wx * k;
      const ty = (p.y - vb.y0) - wy * k;
      return { k, tx, ty };
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    panning.current = { sx: e.clientX, sy: e.clientY, tx: transform.tx, ty: transform.ty };
    setIsPanning(true);
  };

  const onPointerMoveSvg = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (!panning.current) return;
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return;
    const svgRect = svg.getBoundingClientRect();
    const dx = ((e.clientX - panning.current.sx) / svgRect.width) * vb.w;
    const dy = ((e.clientY - panning.current.sy) / svgRect.height) * vb.h;
    setTransform((t) => ({ ...t, tx: panning.current!.tx + dx, ty: panning.current!.ty + dy }));
  };

  const onPointerUp = () => {
    panning.current = null;
    setIsPanning(false);
  };

  const resetView = () => setTransform({ k: 1, tx: 0, ty: 0 });
  const zoomStep = (factor: number) =>
    setTransform((t) => {
      const k = Math.max(1, Math.min(60, t.k * factor));
      const cx = vb.w / 2;
      const cy = vb.h / 2;
      const wx = (cx - t.tx) / t.k;
      const wy = (cy - t.ty) / t.k;
      return { k, tx: cx - wx * k, ty: cy - wy * k };
    });

  // Visible world range for axis labels.
  const visible = React.useMemo(() => {
    const x0 = vb.x0 + (0 - transform.tx) / transform.k;
    const x1 = vb.x0 + (vb.w - transform.tx) / transform.k;
    const y0 = vb.y0 + (0 - transform.ty) / transform.k;
    const y1 = vb.y0 + (vb.h - transform.ty) / transform.k;
    return { x0, x1, y0, y1 };
  }, [vb, transform]);

  const xTicks = niceTicks(visible.x0, visible.x1);
  const yTicks = niceTicks(visible.y0, visible.y1);

  const dimmedFn = React.useMemo(() => dimmed ?? (() => false), [dimmed]);

  const tooltip = hover !== null && tooltipOf ? tooltipOf(hover) : null;

  if (n === 0) {
    return (
      <div
        className={cn(
          "flex h-64 items-center justify-center rounded-md border border-dashed border-border bg-secondary/40 text-sm text-muted-foreground",
          className
        )}
        role="status"
      >
        {emptyMessage}
      </div>
    );
  }

  const toScreenX = (wx: number) => ((wx - vb.x0) / vb.w) * width;
  const toScreenY = (wy: number) => ((wy - vb.y0) / vb.h) * plotHeight;

  return (
    <div ref={containerRef} className={cn("relative w-full min-w-0", className)}>
      <div className="relative min-w-0 overflow-hidden rounded-md border border-border bg-white">
        <svg
          id={svgId}
          role="img"
          aria-label={ariaLabel}
          width={width}
          height={plotHeight}
          viewBox={`${vb.x0} ${vb.y0} ${vb.w} ${vb.h}`}
          style={{ display: "block", maxWidth: "100%", cursor: isPanning ? "grabbing" : "crosshair", touchAction: "none" }}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMoveSvg}
          onPointerUp={onPointerUp}
          onPointerLeave={() => {
            onPointerUp();
            setHover(null);
          }}
          onDoubleClick={resetView}
          onClick={(e) => {
            if (e.target instanceof SVGSVGElement) onSelectPoint?.(null);
          }}
        >
          {/* Grid in world space */}
          <g transform={`translate(${transform.tx} ${transform.ty}) scale(${transform.k})`}>
            {xTicks.map((t) => (
              <line
                key={`gx${t}`}
                x1={t}
                y1={visible.y0}
                x2={t}
                y2={visible.y1}
                stroke="#EDF1EF"
                strokeWidth={1 / transform.k}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {yTicks.map((t) => (
              <line
                key={`gy${t}`}
                x1={visible.x0}
                y1={t}
                x2={visible.x1}
                y2={t}
                stroke="#EDF1EF"
                strokeWidth={1 / transform.k}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
          <PointsLayer
            data={data}
            colorOf={colorOf}
            dimmed={dimmedFn}
            pointSize={pointSize}
            opacity={opacity}
            k={transform.k}
            selectedPoint={selectedPoint}
            onHover={setHover}
            onSelect={(i) => onSelectPoint?.(i)}
          />
        </svg>

        {/* Axis annotations drawn in screen space */}
        <svg
          aria-hidden
          className="pointer-events-none absolute left-0 top-0"
          width={width}
          height={plotHeight}
        >
          {xTicks.map((t) => {
            const sx = toScreenX(t);
            if (sx < 24 || sx > width - 8) return null;
            return (
              <text key={`tx${t}`} x={sx} y={plotHeight - 6} textAnchor="middle" fontSize={9} fill="#677681">
                {formatTick(t)}
              </text>
            );
          })}
          {yTicks.map((t) => {
            const sy = toScreenY(t);
            if (sy < 8 || sy > plotHeight - 16) return null;
            return (
              <text key={`ty${t}`} x={4} y={sy + 3} fontSize={9} fill="#677681">
                {formatTick(t)}
              </text>
            );
          })}
        </svg>

        {/* Zoom toolbar overlay */}
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-border bg-white/95 p-0.5 shadow-sm">
          <Button variant="ghost" size="icon" className="size-7" aria-label="Zoom in" onClick={() => zoomStep(1.35)}>
            <ZoomIn className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" aria-label="Zoom out" onClick={() => zoomStep(1 / 1.35)}>
            <ZoomOut className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" aria-label="Reset view" onClick={resetView}>
            <Maximize2 className="size-3.5" />
          </Button>
        </div>

        {tooltip && tipPos && (
          <div
            className="pointer-events-none absolute z-10 max-w-xs rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md"
            style={{
              left: Math.min(tipPos.x + 14, width - 200),
              top: Math.min(tipPos.y + 14, plotHeight - 80),
            }}
            role="tooltip"
          >
            <p className="mb-1 font-medium text-foreground">{tooltip.title}</p>
            {tooltip.rows.map((r) => (
              <div key={r.k} className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">{r.k}</span>
                <span className="font-mono text-[11px] text-foreground">{r.v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MousePointerClick className="size-3" aria-hidden />
          Scroll to zoom · drag to pan · click a point for details · double-click to reset
        </span>
        <span className="font-mono">
          zoom ×{transform.k.toFixed(1)} · {n.toLocaleString()} observations
        </span>
        {toolbarExtra}
      </div>
    </div>
  );
}

function fitBounds(b: { x0: number; y0: number; w: number; h: number }, width: number, height: number) {
  // Stretch to the panel aspect (for UMAP-like views).
  const targetAspect = width / Math.max(height, 1);
  const srcAspect = b.w / b.h;
  if (srcAspect >= targetAspect) {
    const newH = b.w / targetAspect;
    return { x0: b.x0, y0: b.y0 - (newH - b.h) / 2, w: b.w, h: newH };
  }
  const newW = b.h * targetAspect;
  return { x0: b.x0 - (newW - b.w) / 2, y0: b.y0, w: newW, h: b.h };
}

function formatTick(t: number): string {
  if (Math.abs(t) >= 1000) return `${(t / 1000).toFixed(1)}k`;
  if (Number.isInteger(t)) return String(t);
  return t.toFixed(1);
}
