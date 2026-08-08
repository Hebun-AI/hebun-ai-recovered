import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Shared chrome + honesty primitives for the Decision & Approval Experience
 * (Hebun UI Phase 14).
 *
 * Human, accountable, calm, consequence-aware, evidence-driven, authority-aware —
 * distinct from Command (attention), Governance (policy), Operations (execution),
 * Intelligence (advice), and Knowledge (evidence). Uses the published design system.
 * Every absent state is EXPLAINED; empty is honest, structural vocabulary is labelled
 * structural, and the UI never implies the system made a decision.
 */

export function DecisionRegion({
  title,
  eyebrow,
  action,
  children,
  variant = "card",
  accent = false,
  className,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  variant?: "card" | "plain";
  accent?: boolean;
  className?: string;
}) {
  const isCard = variant === "card";
  return (
    <section
      aria-label={title}
      className={cn(
        "flex min-w-0 flex-col",
        isCard && "rounded-xl border border-border bg-surface",
        isCard && accent && "border-l-2 border-l-primary",
        className,
      )}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-3",
          isCard ? "border-b border-border px-4 py-3" : "pb-2",
        )}
      >
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-fg-muted">{eyebrow}</p>
          )}
          <h2
            className={cn(
              "truncate font-semibold text-fg",
              isCard ? "text-sm" : "text-[0.8rem] uppercase tracking-wide text-fg-secondary",
            )}
          >
            {title}
          </h2>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      <div className={cn("min-w-0 flex-1", isCard && "p-4")}>{children}</div>
    </section>
  );
}

/** Honest absence — states WHY nothing is here, never a bare "No data". */
export function DecisionEmptyState({
  title,
  detail,
  tone = "calm",
  compact = false,
}: {
  title: string;
  detail?: string;
  tone?: "calm" | "blocked";
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-dashed bg-surface-sunken",
        compact ? "p-3" : "p-4",
        tone === "blocked" ? "border-border-strong" : "border-border",
      )}
    >
      <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
        {tone === "blocked" && <Lock className="size-3.5 text-fg-muted" aria-hidden="true" />}
        {title}
      </p>
      {detail && (
        <p className={cn("leading-5 text-fg-secondary", compact ? "text-[0.7rem]" : "text-xs")}>{detail}</p>
      )}
    </div>
  );
}

/**
 * Calm marker that a surface presents STRUCTURAL contract vocabulary — the shape of
 * the decision process — rather than live decision instances.
 */
export function StructuralMarker({ label = "Structural view" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface-sunken px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-fg-muted">
      {label}
    </span>
  );
}
