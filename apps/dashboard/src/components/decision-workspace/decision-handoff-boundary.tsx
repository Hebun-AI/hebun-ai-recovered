import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DecisionRegion, DecisionEmptyState, StructuralMarker } from "./decision-region";

/*
 * Execution Handoff (Phase 14 §24) and Boundary & Ownership (§10, §25, §29–34).
 *
 * HANDOFF — a decision is NOT execution. After a human decision, an authorized outcome
 * MAY become eligible for Operations. No real handoff is connected and Phase 14 adds no
 * execution behaviour, so this is a structural boundary only — never a trigger.
 *
 * BOUNDARY — this surface is the human authority surface. It duplicates no neighbour and
 * holds no authority of its own:
 *   Command       — surfaces decision pressure and attention (not the decision act)
 *   Governance    — owns the policy, authority requirements, and restrictions
 *   Knowledge     — owns the evidence and its provenance
 *   Intelligence  — owns advisory analysis, candidates, and recommendations
 *   Operations    — consumes an authorized outcome; a decision is not execution
 *   Heby          — explains and prepares; it never decides, approves, or authorizes
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
    reason: "Where decision pressure and attention are surfaced. Command draws attention to what needs a decision; the decision itself is recorded here.",
    href: "/command",
    hrefLabel: "Open Command",
  },
  {
    label: "Governance",
    reason: "Owns the policy, authority requirements, and restrictions. This surface shows what authority a decision needs; Governance defines the rule.",
    href: "/governance",
    hrefLabel: "Open Governance",
  },
  {
    label: "Knowledge",
    reason: "Owns the evidence and its provenance. A decision references evidence; Knowledge holds it.",
    href: "/knowledge",
    hrefLabel: "Open Knowledge",
  },
  {
    label: "Intelligence",
    reason: "Owns advisory analysis, candidates, and recommendations. A recommendation is advice, never a decision.",
    href: "/intelligence",
    hrefLabel: "Open Intelligence",
  },
  {
    label: "Operations",
    reason: "Consumes an authorized outcome. A decision is not execution — Operations runs the authorized work.",
    href: "/operations",
    hrefLabel: "Open Operations",
  },
];

export function DecisionHandoffAndBoundary() {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DecisionRegion
        eyebrow="What happens after a decision"
        title="Execution Handoff"
        action={<StructuralMarker label="No trigger here" />}
      >
        <DecisionEmptyState
          title="A decision is not execution"
          detail="After a human decision, an authorized outcome may become eligible for Operations. No handoff is connected and this surface starts nothing — the boundary between deciding and executing is deliberate. Operations runs the authorized work; a decision only makes it eligible."
        />
      </DecisionRegion>

      <DecisionRegion
        variant="plain"
        eyebrow="Boundary"
        title="This Surface Records Human Authority — It Does Not Advise, Govern, or Execute"
        action={<StructuralMarker label="No mutation here" />}
      >
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
          {LINKS.map((link) => (
            <li key={link.label} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex min-w-0 items-center gap-2 sm:w-32 sm:shrink-0">
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
          Heby explains and prepares decision material — it never decides, approves, rejects, authorizes,
          executes, or edits policy. Ask Heby &quot;why?&quot; anywhere on this surface.
        </p>
      </DecisionRegion>
    </div>
  );
}
