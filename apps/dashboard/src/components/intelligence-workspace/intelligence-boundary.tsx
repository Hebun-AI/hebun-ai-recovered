import Link from "next/link";
import { ArrowUpRight, Check, Ban } from "lucide-react";
import type { IntelligenceWorkspaceModel } from "@/features/intelligence/workspace-model";
import { WorkspaceRegion, AdvisoryMarker } from "./workspace-region";

/*
 * Authority & Boundaries (Phase 8 §17/§19/§20).
 *
 * Intelligence is advisory. It investigates; it never approves, rejects, or
 * executes — so this region carries no such control. It states the Runtime's REAL,
 * frozen capabilities and prohibitions, and offers legitimate drill-through to the
 * surfaces that DO own the next act:
 *
 *   Command    — "what needs my attention now?"      (escalation lands here)
 *   Approvals  — the human authority act              (Director-only, elevated)
 *   Knowledge  — the settled truth evidence references
 *
 * Boundaries respected: Intelligence does not duplicate Command's operational
 * status, nor become a Knowledge document browser.
 */

interface BoundaryLink {
  readonly label: string;
  readonly reason: string;
  readonly href: string;
  readonly hrefLabel: string;
}

const LINKS: readonly BoundaryLink[] = [
  {
    label: "Command",
    reason: "Intelligence that needs the Director's attention now is escalated to Command — it is not decided here.",
    href: "/command",
    hrefLabel: "Open Command",
  },
  {
    label: "Approvals & Decisions",
    reason: "The human authority act lives on the Decision surface. Intelligence terminates one step before it.",
    href: "/approvals",
    hrefLabel: "Open Approvals",
  },
  {
    label: "Knowledge",
    reason: "Evidence may reference the settled truth. Intelligence points to Knowledge; it does not restate it.",
    href: "/knowledge",
    hrefLabel: "Open Knowledge",
  },
];

export function IntelligenceBoundary({ model }: { model: IntelligenceWorkspaceModel }) {
  return (
    <WorkspaceRegion
      variant="plain"
      eyebrow="Boundary"
      title="Advisory Only"
      action={<AdvisoryMarker label="Intelligence investigates" />}
    >
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-fg-muted">The Runtime may</p>
            <ul className="flex flex-col gap-1">
              {model.capabilities.map((capability) => (
                <li key={capability.token} className="flex items-center gap-1.5 text-xs text-fg-secondary">
                  <Check className="size-3 shrink-0 text-success" aria-hidden="true" />
                  {capability.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-fg-muted">It must never</p>
            <ul className="flex flex-col gap-1">
              {model.prohibitions.map((prohibition) => (
                <li key={prohibition.token} className="flex items-center gap-1.5 text-xs text-fg-secondary">
                  <Ban className="size-3 shrink-0 text-fg-muted" aria-hidden="true" />
                  {prohibition.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
          {LINKS.map((link) => (
            <li key={link.label} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex min-w-0 items-center gap-2 sm:w-40 sm:shrink-0">
                <span className="size-1.5 shrink-0 rounded-full bg-fg-muted" aria-hidden="true" />
                <span className="truncate text-sm font-medium text-fg">{link.label}</span>
              </div>
              <p className="min-w-0 flex-1 text-[0.7rem] leading-5 text-fg-muted">{link.reason}</p>
              <Link
                href={link.href}
                className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
              >
                {link.hrefLabel}
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </WorkspaceRegion>
  );
}
