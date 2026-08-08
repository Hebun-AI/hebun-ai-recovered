import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { WorkforceRegion, CapabilityMarker } from "./workforce-region";

/*
 * Boundaries (Phase 11 §19–24) — Workforce describes capability and ownership; it
 * holds no authority and duplicates no neighbour.
 *
 *   Operations — what is running during execution
 *   Governance — policy, permissions, and authority constraints
 *   Agents     — the existing agent surface (runtime activity, not organizational identity)
 *
 * Workforce may describe authority; it never grants it. There is no approve,
 * assign, grant-permission, or change-role control here — role is not authority,
 * capability is not authority, tool access is not authority.
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
    reason: "What a worker is currently doing during execution lives in Operations. Workforce references active work; it is not an execution timeline.",
    href: "/operations",
    hrefLabel: "Open Operations",
  },
  {
    label: "Governance",
    reason: "Policy, permissions, and authority constraints are owned and enforced in Governance. Workforce may describe a restriction; it never grants or changes authority.",
    href: "/governance",
    hrefLabel: "Open Governance",
  },
  {
    label: "Agents",
    reason: "The existing Agents surface shows agent runtime activity. Those runtime records are not yet an organizational workforce identity model.",
    href: "/agents",
    hrefLabel: "Open Agents",
  },
];

export function WorkforceBoundary() {
  return (
    <WorkforceRegion
      variant="plain"
      eyebrow="Boundary"
      title="Workforce Describes, It Does Not Grant"
      action={<CapabilityMarker label="No authority act here" />}
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
    </WorkforceRegion>
  );
}
