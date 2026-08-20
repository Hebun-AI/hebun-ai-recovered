import { Lock, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { RegionHeader } from "@/components/ui/region-header";

/*
 * Shared chrome + honesty primitives for the Security Center (UI Phase 19).
 *
 * Calm, precise, evidence-first, authority-aware — never a Hollywood SOC, neon map, or red-alert
 * wall. Uses the published design system. Every state carries text + icon, never color alone; red
 * means a genuine restricted/critical state, not decoration. Empty is honest, and unavailable is
 * never shown as available.
 */

export function SecurityRegion({
  title,
  eyebrow,
  action,
  children,
  variant = "card",
  className,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  variant?: "card" | "plain";
  className?: string;
}) {
  const isCard = variant === "card";
  return (
    <section
      aria-label={title}
      className={cn("flex min-w-0 flex-col", isCard && "rounded-xl border border-border bg-surface", className)}
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

/** Honest absence — states WHY nothing is here, never a bare "No data" and never a fake incident. */
export function SecurityEmptyState({
  title,
  detail,
  tone = "calm",
}: {
  title: string;
  detail?: string;
  tone?: "calm" | "restricted";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-dashed bg-surface-sunken p-3",
        tone === "restricted" ? "border-border-strong" : "border-border",
      )}
    >
      <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
        {tone === "restricted" && <Lock className="size-3.5 text-fg-muted" aria-hidden="true" />}
        {title}
      </p>
      {detail && <p className="text-[0.7rem] leading-5 text-fg-secondary">{detail}</p>}
    </div>
  );
}

/** A color-independent status pill: always carries a text label, and an icon for restricted states. */
export function SecurityStatusPill({ label, tone = "muted" }: { label: string; tone?: SecurityTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider",
        toneClass(tone),
      )}
    >
      {tone === "restricted" && <ShieldAlert className="size-3" aria-hidden="true" />}
      {label}
    </span>
  );
}

/*
 * Color discipline: red/amber only for genuine restricted/uncertain state; violet is the Hebun
 * structural/authority accent; neutral is unknown/unavailable/no-data. Green is never used — no
 * data is not "healthy". Every tone still carries a text label, so color is never the only signal.
 */
export type SecurityTone = "muted" | "restricted" | "accent";

export function toneClass(tone: SecurityTone): string {
  switch (tone) {
    case "restricted":
      return "border-warning/40 text-warning";
    case "accent":
      return "border-highlight/40 text-highlight";
    default:
      return "border-border bg-surface-sunken text-fg-muted";
  }
}

/** Map any honest availability state string to a color-independent tone. */
export function stateTone(state: string): SecurityTone {
  if (state === "restricted") return "restricted";
  if (state === "structural" || state === "human-authority" || state === "derived") return "accent";
  return "muted"; // not-connected / not-available / none / not-executable / unknown
}

/** A short, human label for an availability state token. */
export function stateLabel(state: string): string {
  const map: Record<string, string> = {
    "not-connected": "Not connected",
    "not-available": "Not available",
    "not-executable": "Not executable",
    "human-authority": "Human authority",
    derived: "Derived",
    structural: "Structural",
    restricted: "Restricted",
    none: "None",
    connected: "Connected",
  };
  return map[state] ?? state;
}

/** One command-strip cell: label + value, with a color-independent tone on the value. */
export function SecurityCommandCell({ label, value, tone = "muted" }: { label: string; value: string; tone?: SecurityTone }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-fg-muted">{label}</p>
      <p className={cn("mt-0.5 truncate text-sm font-semibold", tone === "restricted" ? "text-warning" : tone === "accent" ? "text-fg" : "text-fg")} title={value}>
        {value}
      </p>
    </div>
  );
}
