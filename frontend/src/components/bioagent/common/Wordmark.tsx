"use client";

/** BioAgent-ST wordmark: a compact spatial-coordinate-grid symbol. */

import { cn } from "@/lib/utils";

export function Wordmark({
  size = 26,
  withText = true,
  /** Ink-only rendering for the landing theme — follows the landing token
   *  layer so the mark stays visible in both light and dark. */
  neutral = false,
  className,
}: {
  size?: number;
  withText?: boolean;
  neutral?: boolean;
  className?: string;
}) {
  const gridBg = neutral ? "var(--ba-wm-bg, #F5F5F4)" : "#F0F4F2";
  const gridLine = neutral ? "var(--ba-wm-line, #E7E7E9)" : "#DDE4E3";
  const ink = neutral ? "var(--ba-wm-ink, #111417)" : "#183345";
  const accent = neutral ? "var(--ba-wm-accent, #111417)" : "#2C7771";
  const sub = neutral ? "var(--ba-wm-sub, #3F4650)" : "#183345";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 26 26"
        aria-hidden
        focusable="false"
        className="shrink-0"
      >
        <rect x="1" y="1" width="24" height="24" rx="4" fill={gridBg} stroke={gridLine} />
        {/* coordinate grid */}
        <line x1="9" y1="2" x2="9" y2="24" stroke={gridLine} strokeWidth="1" />
        <line x1="17" y1="2" x2="17" y2="24" stroke={gridLine} strokeWidth="1" />
        <line x2="24" y1="9" x1="2" y2="9" stroke={gridLine} strokeWidth="1" />
        <line x2="24" y1="17" x1="2" y2="17" stroke={gridLine} strokeWidth="1" />
        {/* observation points */}
        <circle cx="6.5" cy="6.5" r="2.4" fill={ink} />
        <circle cx="19.5" cy="5.5" r="1.8" fill={accent} />
        <circle cx="13" cy="13" r="2.8" fill={accent} />
        <circle cx="6" cy="19.5" r="1.8" fill={accent} />
        <circle cx="20" cy="19.5" r="2.2" fill={sub} />
        {/* neighborhood edge */}
        <line x1="13" y1="13" x2="20" y2="19.5" stroke={accent} strokeWidth="1" strokeOpacity="0.55" />
      </svg>
      {withText && (
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          BioAgent<span className="text-teal">-ST</span>
        </span>
      )}
    </span>
  );
}
