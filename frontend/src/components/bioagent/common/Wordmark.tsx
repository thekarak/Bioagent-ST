"use client";

/** BioAgent-ST wordmark: a compact spatial-coordinate-grid symbol. */

import { cn } from "@/lib/utils";

export function Wordmark({
  size = 26,
  withText = true,
  className,
}: {
  size?: number;
  withText?: boolean;
  className?: string;
}) {
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
        <rect x="1" y="1" width="24" height="24" rx="4" fill="#F0F4F2" stroke="#DDE4E3" />
        {/* coordinate grid */}
        <line x1="9" y1="2" x2="9" y2="24" stroke="#DDE4E3" strokeWidth="1" />
        <line x1="17" y1="2" x2="17" y2="24" stroke="#DDE4E3" strokeWidth="1" />
        <line x1="2" y1="9" x2="24" y2="9" stroke="#DDE4E3" strokeWidth="1" />
        <line x1="2" y1="17" x2="24" y2="17" stroke="#DDE4E3" strokeWidth="1" />
        {/* observation points */}
        <circle cx="6.5" cy="6.5" r="2.4" fill="#183345" />
        <circle cx="19.5" cy="5.5" r="1.8" fill="#2C7771" />
        <circle cx="13" cy="13" r="2.8" fill="#2C7771" />
        <circle cx="6" cy="19.5" r="1.8" fill="#2C7771" />
        <circle cx="20" cy="19.5" r="2.2" fill="#183345" />
        {/* neighborhood edge */}
        <line x1="13" y1="13" x2="20" y2="19.5" stroke="#2C7771" strokeWidth="1" strokeOpacity="0.55" />
      </svg>
      {withText && (
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          BioAgent<span className="text-teal">-ST</span>
        </span>
      )}
    </span>
  );
}
