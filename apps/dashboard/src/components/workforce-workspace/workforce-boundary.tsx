import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { WorkforceRegion, CapabilityMarker } from "./workforce-region";

/*
 * Boundaries (Phase 11 §19–24; extended UI Phase 25B) — Workforce answers WHO can perform
 * work: identities, roles, capabilities, and composition. Every other concern is deferred to
 * the workspace that owns it. Workforce holds no authority and duplicates no neighbour.
 *
 *   Operations — how work executes (execution, runtime activity, receipts, failures)
 *   Governance — policy, permissions, and authority constraints
 *   Platform   — providers, models, and technical capabilities
 *   Knowledge  — organizational memory and knowledge
 *   Decisions  — human decision authority (approve / reject / authorize)
 *   Command    — organizational objectives and direction
 *   Agents     — the AI agent definitions surface (seeded, in-memory; not a live workforce)
 *
 * Workforce may describe authority; it never grants it. There is no approve, assign,
 * grant-permission, or change-role control here — role is not authority, capability is not
 * authority, tool access is not authority.
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
    reason: "How work executes — execution, runtime activity, receipts, and failures — lives in Operations. Workforce references active work; it is not an execution timeline.",
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
    label: "Platform",
    reason: "Providers, models, and technical capabilities are owned by Platform. A definition references a provider/model; it does not own or connect one.",
    href: "/platform",
    hrefLabel: "Open Platform",
  },
  {
    label: "Knowledge",
    reason: "Organizational memory and knowledge are owned by Knowledge. Workforce reads memory context; it never keeps a second memory store.",
    href: "/knowledge",
    hrefLabel: "Open Knowledge",
  },
  {
    label: "Decisions",
    reason: "Human decision authority — approve, reject, authorize — is owned by Decisions. Workforce prepares nothing here and grants no authority.",
    href: "/approvals",
    hrefLabel: "Open Decisions",
  },
  {
    label: "Agents",
    reason: "The Agents surface shows seeded, in-memory agent definitions over a simulation runtime. Those definitions are not a live organizational workforce.",
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
      <p className="mb-3 text-xs leading-5 text-fg-muted">
        Workforce answers <span className="font-medium text-fg-secondary">who</span> can perform
        work — identities, roles, and capabilities. Every other concern is deferred to the
        workspace that owns it.
      </p>
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
