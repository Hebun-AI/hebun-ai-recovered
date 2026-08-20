import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { KnowledgeRegion, ReferenceMarker } from "./knowledge-region";

/*
 * Boundaries (Phase 9 §4/§19/§20) — Knowledge is settled reference, not inference.
 *
 * Knowledge feeds Intelligence and is referenced by it, but must not become
 * Intelligence, a document manager, or a Runtime viewer. This region offers clean
 * drill-through to the surfaces that own the next concern, without duplicating
 * them:
 *
 *   Intelligence — what is inferred from knowledge + signals (references evidence here)
 *   Governance   — access, classification, audit, and the record
 *   Company Memory / Knowledge Graph — the existing deep reference surfaces
 */

interface BoundaryLink {
  readonly label: string;
  readonly reason: string;
  readonly href: string;
  readonly hrefLabel: string;
}

const LINKS: readonly BoundaryLink[] = [
  {
    label: "Intelligence",
    reason: "Knowledge is evidence and input. What the system infers from it lives in Intelligence, which references this evidence — it is not restated here.",
    href: "/intelligence",
    hrefLabel: "Open Intelligence",
  },
  {
    label: "Governance",
    reason: "Access, classification, restrictions, and the record are enforced and audited in Governance. Knowledge respects those boundaries; it does not define them.",
    href: "/governance",
    hrefLabel: "Open Governance",
  },
  {
    label: "Company Memory",
    reason: "The deeper institutional-memory reference surface. Knowledge points to it rather than duplicating it.",
    href: "/director/memory",
    hrefLabel: "Open Company Memory",
  },
];

export function KnowledgeBoundary() {
  return (
    <KnowledgeRegion
      variant="plain"
      eyebrow="Boundary"
      title="Settled Reference"
      action={<ReferenceMarker label="Knowledge references, it does not infer" />}
    >
      <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
        {LINKS.map((link) => (
          <li key={link.label} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 items-center gap-2 sm:w-40 sm:shrink-0">
              <span className="size-1.5 shrink-0 rounded-full bg-fg-muted" aria-hidden="true" />
              <span className="truncate text-sm font-medium text-fg">{link.label}</span>
            </div>
            <p className="min-w-0 flex-1 text-meta leading-5 text-fg-muted">{link.reason}</p>
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
    </KnowledgeRegion>
  );
}
