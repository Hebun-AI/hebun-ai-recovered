import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { GovernanceWorkspaceModel } from "@/features/governance/workspace-model";
import { GovernanceRegion, GovernanceEmptyState, ControlMarker } from "./governance-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Policy & Control Surface (Phase 12 §23) — the primary Governance region.
 *
 * When real governance controls are surfaced, each would carry its identity, scope,
 * applicability, restriction, authority requirement, evidence, and state. None is
 * surfaced through a Director-safe read model, so the region is honestly empty and
 * instead names the REAL policy categories a control can fall under and the real
 * check statuses a control can carry. No example policy is fabricated; the seeded
 * legacy policy set is not surfaced here.
 */

export function PolicyControlSurface({ model }: { model: GovernanceWorkspaceModel }) {
  return (
    <GovernanceRegion
      eyebrow="What rules apply"
      title="Policy & Control Surface"
      accent
      className="h-full"
      action={<ControlMarker label="No controls surfaced" />}
    >
      <div className="flex flex-col gap-3">
        <GovernanceEmptyState
          title="No governance policies or controls surfaced yet"
          detail="A control is a rule that governs an action — its scope, restriction, and the authority it requires. No Director-safe control read model is connected, and none is fabricated. Once connected, each control appears here with its applicability, restriction, authority requirement, evidence, and state."
        />
        <div>
          <p className="mb-2 text-[0.7rem] uppercase tracking-wide text-fg-muted">Categories a control can fall under</p>
          <ul className="flex flex-wrap gap-1.5">
            {model.policyCategories.map((category) => (
              <li
                key={category.category}
                className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg-secondary"
              >
                {category.label}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-[0.7rem] uppercase tracking-wide text-fg-muted">Check status a control can carry</p>
          <ul className="flex flex-wrap gap-1.5">
            {model.checkStatuses.map((status) => (
              <li
                key={status.status}
                className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg-secondary"
              >
                {status.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href="/director/governance/policies"
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          >
            Legacy policy set
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
          <span className="text-[0.7rem] text-fg-muted">Why is nothing surfaced?</span>
          <HebyWhy label="Ask Heby" variant="text" />
        </div>
      </div>
    </GovernanceRegion>
  );
}
