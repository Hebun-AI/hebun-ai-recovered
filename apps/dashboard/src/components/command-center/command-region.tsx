import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExecutiveHealthState } from "@/features/director-dashboard-executive-overview";
import { healthPresentation } from "./health";

/*
 * Shared Command Center region chrome + honesty primitives.
 *
 * Every region uses the same shell so Command reads as one calm surface, and
 * every "absent" state is explained (spec §17): empty ≠ healthy, unavailable is
 * shown honestly, non-authoritative content is marked.
 */

export function CommandRegion({
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn("flex flex-col rounded-xl border border-border bg-surface", className)}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-fg-muted">{eyebrow}</p>
          )}
          <h2 className="truncate text-sm font-semibold text-fg">{title}</h2>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      <div className="min-w-0 flex-1 p-4">{children}</div>
    </section>
  );
}

/** Honest absence — explains WHY information is missing, never a bare "No data". */
export function RegionEmptyState({
  title,
  detail,
  tone = "calm",
}: {
  title: string;
  detail?: string;
  tone?: "calm" | "blocked";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-dashed p-4",
        tone === "blocked" ? "border-border-strong bg-surface-sunken" : "border-border bg-surface-sunken",
      )}
    >
      <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
        {tone === "blocked" && <Lock className="size-3.5 text-fg-muted" aria-hidden="true" />}
        {title}
      </p>
      {detail && <p className="text-xs leading-5 text-fg-secondary">{detail}</p>}
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
