import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExecutiveHealthState } from "@/features/director-dashboard-executive-overview";
import { healthPresentation } from "./health";

/*
 * Shared Command Center region chrome + honesty primitives.
 *
 * Two containment weights so the page reads as a hierarchy, not a card wall
 * (Phase 7 §14): `card` for the region that deserves containment (Director
 * Attention), `plain` for fast-scan operational groups. Every "absent" state is
 * still explained honestly (spec §17): empty ≠ healthy.
 */

export function CommandRegion({
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
          <h2 className={cn("truncate font-semibold text-fg", isCard ? "text-sm" : "text-[0.8rem] uppercase tracking-wide text-fg-secondary")}>
            {title}
          </h2>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      <div className={cn("min-w-0 flex-1", isCard && "p-4")}>{children}</div>
    </section>
  );
}

/** Honest absence — explains WHY information is missing, never a bare "No data". */
export function RegionEmptyState({
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
    <div className={cn("flex flex-col gap-1 rounded-lg border border-dashed bg-surface-sunken", compact ? "p-3" : "p-4", tone === "blocked" ? "border-border-strong" : "border-border")}>
      <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
        {tone === "blocked" && <Lock className="size-3.5 text-fg-muted" aria-hidden="true" />}
        {title}
      </p>
      {detail && <p className={cn("leading-5 text-fg-secondary", compact ? "text-[0.7rem]" : "text-xs")}>{detail}</p>}
    </div>
  );
}

/** Small, calm marker that content is non-authoritative (design honesty rules). */
export function NonAuthoritativeMarker({ label = "Non-authoritative" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface-sunken px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-fg-muted">
      {label}
    </span>
  );
}

/** Color-independent health chip: dot tone + label (+ lock for unavailable). */
export function HealthChip({
  state,
  label,
  className,
}: {
  state: ExecutiveHealthState;
  label?: string;
  className?: string;
}) {
  const presentation = healthPresentation(state);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", presentation.text, className)}>
      <span className={cn("size-2 rounded-full", presentation.dot)} aria-hidden="true" />
      {presentation.locked && <Lock className="size-3" aria-hidden="true" />}
      {label ?? presentation.label}
    </span>
  );
}

/** Compact status cell for the operational scan matrix: label + dot, tight. */
export function HealthCell({
  label,
  state,
}: {
  label: string;
  state: ExecutiveHealthState;
}) {
  const presentation = healthPresentation(state);
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/50 py-1.5">
      <span className="min-w-0 truncate text-xs text-fg-secondary">{label}</span>
      <span className={cn("inline-flex shrink-0 items-center gap-1 text-[0.7rem] font-medium", presentation.text)}>
        <span className={cn("size-1.5 rounded-full", presentation.dot)} aria-hidden="true" />
        {presentation.locked && <Lock className="size-2.5" aria-hidden="true" />}
        {presentation.label}
      </span>
    </div>
  );
}
