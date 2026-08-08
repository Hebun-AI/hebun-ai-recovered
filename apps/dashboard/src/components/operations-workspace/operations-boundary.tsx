import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { OperationsRegion, SystemViewMarker } from "./operations-region";

/*
 * Boundaries (Phase 10 §18–20) — Operations observes and drills through; it does
 * not duplicate its neighbours or hold authority.
 *
 *   Command    — the executive summary and the human decision boundary
 *   Workforce  — which agents are doing the work
 *   Governance — what is allowed, blocked, or restricted
 *
 * Operations shows operational detail and routes to the surface that owns the next
 * concern. It never approves, executes, or modifies policy.
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
    reason: "Command summarizes the operational pulse and owns the human decision. Operations holds the detail beneath that summary — it does not repeat the executive cockpit.",
    href: "/command",
    hrefLabel: "Open Command",
  },
  {
    label: "Workforce",
    reason: "Which agents and departments do the work lives in Workforce. Operations shows that an agent is executing; it is not the agent-management surface.",
    href: "/workforce",
    hrefLabel: "Open Workforce",
  },
  {
    label: "Governance",
    reason: "Policy, permissions, and what is blocked are owned and audited in Governance. Operations surfaces that something is blocked; it never modifies the rule.",
    href: "/governance",
    hrefLabel: "Open Governance",
  },
];

export function OperationsBoundary() {
  return (
    <OperationsRegion
      variant="plain"
      eyebrow="Boundary"
      title="Operations Observes"
      action={<SystemViewMarker label="No authority act here" />}
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
    </OperationsRegion>
  );
}
