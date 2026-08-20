import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { RegionHeader } from "@/components/ui/region-header";

/*
 * Shared chrome + honesty primitives for the Workforce Workspace (Phase 11).
 *
 * Organizational, capability-oriented, calm identity — distinct from Operations
 * (live) and Knowledge (reference). Uses the published design system. Every absent
 * state is explained; empty is honest, never dressed as a populated roster.
 */

export function WorkforceRegion({
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
      <RegionHeader
        title={title}
        eyebrow={eyebrow}
        action={action}
        variant={variant}
      />
      <div className={cn("min-w-0 flex-1", isCard && "p-4")}>{children}</div>
    </section>
  );
}

/** Honest absence — states WHY nothing is here, never a bare "No data". */
export function WorkforceEmptyState({
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

/** Calm marker that a surface is a non-authoritative capability view. */
export function CapabilityMarker({ label = "Capability view" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface-sunken px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-fg-muted">
      {label}
    </span>
  );
}
