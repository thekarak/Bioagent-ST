"use client";

/**
 * TiltCard — a pointer-tracked 3D tilt wrapper for landing cards.
 *
 * On fine-pointer devices the card rotates a few degrees toward the
 * cursor (perspective transform) and a soft specular glare follows the
 * pointer, so every card answers like a physical object in the scene.
 * Updates are rAF-throttled writes to CSS custom properties — no React
 * state churn — and the card eases back to rest when the pointer
 * leaves. Reduced-motion and touch visitors simply get a flat card.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./motion";

export function TiltCard({
  className,
  children,
  max = 4.5,
  glare = true,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  max?: number;
  glare?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const raf = React.useRef(0);
  const reduced = usePrefersReducedMotion();
  const fine = React.useRef(false);

  React.useEffect(() => {
    fine.current =
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || reduced || !fine.current) return;
    const r = el.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.setProperty("--ba-rx", `${(-ny * max).toFixed(2)}deg`);
      el.style.setProperty("--ba-ry", `${(nx * max).toFixed(2)}deg`);
      el.style.setProperty("--ba-gx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
      el.style.setProperty("--ba-gy", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
      el.dataset.tilt = "live";
    });
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(raf.current);
    /* dataset first so the transition applies to the settle-back. */
    el.dataset.tilt = "idle";
    el.style.setProperty("--ba-rx", "0deg");
    el.style.setProperty("--ba-ry", "0deg");
  };

  return (
    <div
      ref={ref}
      data-tilt="idle"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={cn("ba-tilt", className)}
      {...rest}
    >
      {children}
      {glare ? <span aria-hidden className="ba-tilt-glare" /> : null}
    </div>
  );
}
