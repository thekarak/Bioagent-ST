"use client";

/**
 * Shared building blocks for the minimal editorial landing sections:
 * contained section layout, section headers with numbered eyebrows and
 * reusable framer-motion variants. No glass, no glow — hairlines and
 * whitespace carry the design.
 */

import * as React from "react";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { cn } from "@/lib/utils";

/* Staggered entrance variants for grids and lists. */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
};

export const riseItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 20 },
  },
};

/* Landing navigation links (shared by the nav and the footer). */
export const NAV_LINKS = [
  { label: "Overview", href: "#top" },
  { label: "Workflow", href: "#workflows" },
  { label: "Evidence", href: "#evidence" },
  { label: "Research Context", href: "#research-context" },
  { label: "Documentation", href: "#documentation" },
] as const;

/** Contained, centered section. */
export function Section({
  id,
  label,
  className,
  children,
}: {
  id?: string;
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-label={label}
      className={cn("relative mx-auto w-full max-w-6xl px-4 sm:px-6", className)}
    >
      {children}
    </section>
  );
}

/** Numbered eyebrow + headline + lead, revealed on scroll. */
export function SectionHeader({
  eyebrow,
  title,
  lead,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn("max-w-2xl", className)}
    >
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--ba-muted)]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.01em] text-[var(--ba-ink)] sm:text-[32px]">
        {title}
      </h2>
      {lead ? (
        <div className="mt-3 text-[15px] leading-relaxed text-[var(--ba-body)]">{lead}</div>
      ) : null}
    </motion.div>
  );
}
