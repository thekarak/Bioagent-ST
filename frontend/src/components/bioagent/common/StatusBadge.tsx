"use client";

/**
 * Shared status vocabulary.
 * Every status is color-independent: an icon and a text label always
 * accompany color so states remain readable for color-vision-deficient
 * users and in grayscale.
 */

import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CircleDashed,
  CircleDot,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  HelpCircle,
  MinusCircle,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CheckStatus,
  EvidenceState,
  PolicyDecision,
  PrereqStatus,
  RunStatus,
  ValidationState,
} from "@/lib/bioagent/types";

type Tone = "green" | "amber" | "red" | "teal" | "neutral";

const TONE_STYLES: Record<Tone, string> = {
  green: "border-verified/25 bg-verified/10 text-verified",
  amber: "border-warning/25 bg-warning/10 text-warning",
  red: "border-error/25 bg-error/10 text-error",
  teal: "border-teal/25 bg-teal/10 text-teal",
  neutral: "border-border bg-secondary text-secondary-foreground",
};

function StatusChip({
  tone,
  icon,
  label,
  className,
}: {
  tone: Tone;
  icon: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(TONE_STYLES[tone], "gap-1", className)}>
      {icon}
      {label}
    </Badge>
  );
}

const RUN_STATUS_META: Record<
  RunStatus,
  { label: string; tone: Tone; icon: React.ReactNode }
> = {
  received: { label: "Received", tone: "neutral", icon: <CircleDot className="size-3" /> },
  validated: { label: "Validated", tone: "teal", icon: <CheckCircle2 className="size-3" /> },
  routed: { label: "Routed", tone: "teal", icon: <CircleDot className="size-3" /> },
  running: { label: "Running", tone: "teal", icon: <Loader2 className="size-3 animate-spin" /> },
  verified: { label: "Verified", tone: "green", icon: <ShieldCheck className="size-3" /> },
  needs_review: { label: "Needs review", tone: "amber", icon: <AlertTriangle className="size-3" /> },
  failed: { label: "Failed", tone: "red", icon: <XCircle className="size-3" /> },
};

export function RunStatusBadge({ status, className }: { status: RunStatus; className?: string }) {
  const meta = RUN_STATUS_META[status];
  return StatusChip({ tone: meta.tone, icon: meta.icon, label: meta.label, className });
}

const CHECK_STATUS_META: Record<
  CheckStatus,
  { label: string; tone: Tone; icon: React.ReactNode }
> = {
  pass: { label: "Pass", tone: "green", icon: <CheckCircle2 className="size-3" /> },
  warning: { label: "Warning", tone: "amber", icon: <AlertTriangle className="size-3" /> },
  fail: { label: "Fail", tone: "red", icon: <XCircle className="size-3" /> },
  not_run: { label: "Not run", tone: "neutral", icon: <CircleDashed className="size-3" /> },
};

export function CheckStatusBadge({ status, className }: { status: CheckStatus; className?: string }) {
  const meta = CHECK_STATUS_META[status];
  return StatusChip({ tone: meta.tone, icon: meta.icon, label: meta.label, className });
}

const PREREQ_STATUS_META: Record<
  PrereqStatus,
  { label: string; tone: Tone; icon: React.ReactNode }
> = {
  pass: { label: "Passed", tone: "green", icon: <CheckCircle2 className="size-3" /> },
  missing: { label: "Missing", tone: "red", icon: <XCircle className="size-3" /> },
  warning: { label: "Warning", tone: "amber", icon: <AlertTriangle className="size-3" /> },
  not_assessed: { label: "Not assessed", tone: "neutral", icon: <CircleDashed className="size-3" /> },
};

export function PrereqStatusBadge({ status, className }: { status: PrereqStatus; className?: string }) {
  const meta = PREREQ_STATUS_META[status];
  return StatusChip({ tone: meta.tone, icon: meta.icon, label: meta.label, className });
}

const POLICY_META: Record<
  PolicyDecision,
  { label: string; tone: Tone; icon: React.ReactNode }
> = {
  ALLOW: { label: "ALLOW", tone: "green", icon: <ShieldCheck className="size-3" /> },
  REVIEW: { label: "REVIEW", tone: "amber", icon: <ShieldAlert className="size-3" /> },
  BLOCK: { label: "BLOCK", tone: "red", icon: <ShieldX className="size-3" /> },
};

export function PolicyBadge({ decision, className }: { decision: PolicyDecision; className?: string }) {
  const meta = POLICY_META[decision];
  return StatusChip({ tone: meta.tone, icon: meta.icon, label: meta.label, className });
}

const VALIDATION_META: Record<ValidationState, { label: string; tone: Tone; icon: React.ReactNode }> = {
  validated: { label: "Validated", tone: "green", icon: <CheckCircle2 className="size-3" /> },
  warning: { label: "Schema warning", tone: "amber", icon: <AlertTriangle className="size-3" /> },
  failed: { label: "Validation failed", tone: "red", icon: <XCircle className="size-3" /> },
  not_assessed: { label: "Not assessed", tone: "neutral", icon: <CircleDashed className="size-3" /> },
};

export function ValidationBadge({ state, className }: { state: ValidationState; className?: string }) {
  const meta = VALIDATION_META[state];
  return StatusChip({ tone: meta.tone, icon: meta.icon, label: meta.label, className });
}

export function WorkflowBadge({ workflow, className }: { workflow: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-border bg-secondary text-secondary-foreground", className)}>
      {workflow === "unsupported_or_ambiguous" ? (
        <HelpCircle className="size-3" />
      ) : (
        <MinusCircle className="size-3" />
      )}
      {workflow}
    </Badge>
  );
}

/* ---------- Five evidence states for claim classification ---------- */

const EVIDENCE_STATE_META: Record<
  EvidenceState,
  { label: string; tone: Tone; icon: React.ReactNode; hint: string }
> = {
  supported: {
    label: "Supported",
    tone: "green",
    icon: <CheckCircle2 className="size-3" />,
    hint: "Linked evidence supports the claim under the stated checks.",
  },
  plausible: {
    label: "Plausible",
    tone: "teal",
    icon: <CircleDot className="size-3" />,
    hint: "Evidence is consistent with the claim but does not establish it.",
  },
  hypothesis: {
    label: "Hypothesis",
    tone: "amber",
    icon: <Lightbulb className="size-3" />,
    hint: "A possible interpretation that needs further testing.",
  },
  unsupported: {
    label: "Unsupported",
    tone: "red",
    icon: <XCircle className="size-3" />,
    hint: "Available evidence does not support the claim as stated.",
  },
  indeterminate: {
    label: "Indeterminate",
    tone: "neutral",
    icon: <CircleDashed className="size-3" />,
    hint: "Insufficient information to assess the claim.",
  },
};

export function EvidenceStateBadge({
  state,
  className,
}: {
  state: EvidenceState;
  className?: string;
}) {
  const meta = EVIDENCE_STATE_META[state];
  return StatusChip({ tone: meta.tone, icon: meta.icon, label: meta.label, className });
}

export const evidenceStateMeta = EVIDENCE_STATE_META;

export const runStatusMeta = RUN_STATUS_META;
