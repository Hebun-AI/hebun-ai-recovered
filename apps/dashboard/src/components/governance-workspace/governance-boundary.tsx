import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { GovernanceRegion, ControlMarker } from "./governance-region";

/*
 * Boundary & Escalation (Phase 12 §12/§13/§28) — Governance inspects and routes; it
 * holds no decision authority and duplicates no neighbour.
 *
 *   Command       — where a governance condition escalates for Director attention
 *   Approvals     — where the human authority act is performed
 *   Intelligence  — where a risk candidate may originate (a candidate is not a violation)
 *
 * The conceptual flow: a governance condition → requires attention → escalation →
 * Command / Approval surface → human authority. This region shows the routes; it
 * never implies an escalation occurred, and it performs no approval or override.
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
    reason: "A governance condition that needs the Director's attention escalates to Command. Governance investigates; it does not recreate executive attention here.",
    href: "/command",
    hrefLabel: "Open Command",
  },
  {
    label: "Approvals & Decisions",
    reason: "When an action requires human authority, the decision is performed on the dedicated decision surface. Governance describes the requirement; it never approves.",
    href: "/approvals",
    hrefLabel: "Open Approvals",
  },
  {
    label: "Intelligence",
    reason: "A risk may originate as an Intelligence candidate. An Intelligence candidate is not automatically a governance violation — Governance represents the applicable control context.",
    href: "/intelligence",
    hrefLabel: "Open Intelligence",
  },
];

export function GovernanceBoundary() {
  return (
    <GovernanceRegion
      variant="plain"
      eyebrow="Boundary"
      title="Governance Inspects, It Does Not Decide"
      action={<ControlMarker label="No authority act here" />}
    >
      <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
        {LINKS.map((link) => (
          <li key={link.label} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 items-center gap-2 sm:w-44 sm:shrink-0">
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
    </GovernanceRegion>
  );
}
