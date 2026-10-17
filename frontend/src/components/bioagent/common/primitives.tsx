"use client";

/** Shared small components: demo tag, mono identifiers, empty states, info rows. */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, FlaskConical, FileSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/bioagent/exports";
import { useToast } from "@/hooks/use-toast";

/** Explicit illustrative-data marker, shown next to synthetic data at a glance. */
export function DemoTag({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-warning/40 bg-warning/10 text-warning gap-1", className)}
      title="This content is generated locally as illustrative demo data — not experimental results"
    >
      <FlaskConical className="size-3" aria-hidden />
      {compact ? "DEMO" : "Illustrative demo data"}
    </Badge>
  );
}

/** Monospaced identifier with one-click copy (never breaks layout). */
export function MonoId({
  value,
  copy = true,
  truncate = false,
  className,
}: {
  value: string;
  copy?: boolean;
  truncate?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const { toast } = useToast();
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1", className)}>
      <code
        className={cn(
          "font-mono text-xs text-foreground/90",
          truncate ? "truncate max-w-[16rem] inline-block align-bottom" : ""
        )}
        title={value}
      >
        {value}
      </code>
      {copy && (
        <button
          type="button"
          aria-label={`Copy ${value}`}
          className="ba-focus rounded p-0.5 text-muted-foreground hover:text-foreground"
          onClick={async (e) => {
            e.stopPropagation();
            const ok = await copyToClipboard(value);
            if (ok) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } else {
              toast({ title: "Copy failed", description: "Clipboard is not available in this context." });
            }
          }}
        >
          {copied ? <Check className="size-3 text-verified" /> : <Copy className="size-3" />}
        </button>
      )}
    </span>
  );
}

export function SectionHeading({
  title,
  description,
  actions,
  id,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div>
        <h2 id={id} className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actions,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-secondary/40 px-6 py-10 text-center",
        className
      )}
    >
      <div className="text-muted-foreground" aria-hidden>
        {icon ?? <FileSearch className="size-7" />}
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}

/** Label / value pair used across dataset, provenance and report panels. */
export function InfoRow({
  label,
  value,
  mono = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-[minmax(9rem,auto)_1fr] items-baseline gap-3 py-1.5", className)}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm text-foreground", mono && "font-mono text-xs break-all")}>{value}</dd>
    </div>
  );
}

export function CopyButton({
  value,
  label = "Copy",
  size = "sm",
  variant = "outline",
}: {
  value: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "ghost";
}) {
  const { toast } = useToast();
  return (
    <Button
      size={size}
      variant={variant}
      onClick={async () => {
        const ok = await copyToClipboard(value);
        toast({
          title: ok ? "Copied to clipboard" : "Copy failed",
          description: ok ? value : "Clipboard is not available in this context.",
        });
      }}
    >
      <Copy className="size-3.5" aria-hidden />
      {label}
    </Button>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-secondary px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}
