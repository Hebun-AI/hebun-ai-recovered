import Link from "next/link";
import { ArrowUpRight, User, Bot } from "lucide-react";
import type { WorkforceWorkspaceModel } from "@/features/workforce/workspace-model";
import { WorkforceRegion, WorkforceEmptyState, CapabilityMarker } from "./workforce-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Workforce Directory (Phase 11 §10) — the primary Workforce surface.
 *
 * A combined directory (one worker with type, role, capabilities, responsibilities,
 * availability and assignment) is not built. The region names the two entity types
 * and links each to the surface that records it (members → Organization, durable
 * agents → Agents) without counting either: this page reads no records, so any
 * count here would be a claim it cannot back. No profile is fabricated; the seeded
 * agent-crud roster is not surfaced as organizational workforce.
 */

const TYPE_ICON = { human: User, "ai-agent": Bot } as const;

export function WorkforceDirectory({ model }: { model: WorkforceWorkspaceModel }) {
  return (
    <WorkforceRegion
      eyebrow="Who can do the work"
      title="Workforce Directory"
      accent
      className="h-full"
      action={<CapabilityMarker label="Not listed here" />}
    >
      <div className="flex flex-col gap-3">
        <WorkforceEmptyState
          title="This overview lists no workers"
          detail="A workforce identity is a human or AI agent the organization can assign work to and hold responsible. This overview reads no records: members are listed on Organization and recorded AI agents on Agents. A combined directory showing each worker's role, capabilities, responsibilities, availability and assignment together is not built, and none is fabricated here."
        />
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
          {model.entityTypes.map((entity) => {
            const Icon = TYPE_ICON[entity.type];
            return (
              <li key={entity.type} className="flex items-start gap-3 p-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{entity.label}</p>
                  <p className="text-[0.7rem] leading-5 text-fg-muted">{entity.describes}</p>
                </div>
                <Link
                  href={entity.recordedOn.href}
                  className="inline-flex shrink-0 items-center gap-0.5 self-center text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                >
                  {entity.recordedOn.label}
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href="/agents"
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          >
            Agents surface
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
          <span className="text-[0.7rem] text-fg-muted">Where would workforce come from?</span>
          <HebyWhy label="Ask Heby" variant="text" />
        </div>
      </div>
    </WorkforceRegion>
  );
}
