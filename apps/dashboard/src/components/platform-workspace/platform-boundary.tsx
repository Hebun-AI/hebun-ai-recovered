import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PlatformRegion, TechnicalMarker } from "./platform-region";

/*
 * Boundary & Ownership (Phase 13 §12–17/§33) — Platform inspects technical
 * capability; it duplicates no neighbour and holds no authority.
 *
 *   Operations — what is running on the substrate (execution ≠ configuration)
 *   Governance — the policy that constrains a technical action (Platform never edits it)
 *   Knowledge  — the information a source carries (Platform owns only how it connects)
 *
 * Future ownership note: a Hebun Device Runtime & Computer Use capability would,
 * when built, register devices and their technical capability HERE — not as a new
 * top-level workspace. It is not implemented in this phase.
 */

interface BoundaryLink {
  readonly label: string;
  readonly reason: string;
  readonly href: string;
  readonly hrefLabel: string;
}

const LINKS: readonly BoundaryLink[] = [
  {
    label: "Operations",
    reason: "What is running on the substrate lives in Operations. Platform owns the technical capability and dependency state, not the execution timeline.",
    href: "/operations",
    hrefLabel: "Open Operations",
  },
  {
    label: "Governance",
    reason: "The policy that permits or restricts a technical action is owned in Governance. Platform may show a connection is blocked; it never edits the rule.",
    href: "/governance",
    hrefLabel: "Open Governance",
  },
  {
    label: "Knowledge",
    reason: "The information a connected source carries lives in Knowledge. Platform owns only how that source is technically connected, not the content.",
    href: "/knowledge",
    hrefLabel: "Open Knowledge",
  },
];

export function PlatformBoundary() {
  return (
    <PlatformRegion
      variant="plain"
      eyebrow="Boundary"
      title="Platform Inspects, It Does Not Run or Decide"
      action={<TechnicalMarker label="No mutation here" />}
    >
      <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
        {LINKS.map((link) => (
          <li key={link.label} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 items-center gap-2 sm:w-36 sm:shrink-0">
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
      <p className="mt-3 text-[0.7rem] leading-5 text-fg-muted">
        Future: a governed Device Runtime &amp; Computer Use capability would register devices and their
        technical capability here — not as a new workspace. It is not implemented in this phase.
      </p>
    </PlatformRegion>
  );
}
