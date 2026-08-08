import Link from "next/link";
import { ArrowUpRight, User, Bot } from "lucide-react";
import type { WorkforceWorkspaceModel } from "@/features/workforce/workspace-model";
import { WorkforceRegion, WorkforceEmptyState, CapabilityMarker } from "./workforce-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Workforce Directory (Phase 11 §10) — the primary Workforce surface.
 *
 * When real workforce identities are connected, each actor would appear here with
 * its type, role, capabilities, responsibilities, availability, and current
 * assignment. None is connected, so the region is honestly empty and instead names
 * the two entity types the model must represent (Human, AI Agent) — each with 0
 * connected. No profile is fabricated; the seeded agent roster on the legacy Agents
 * page is not surfaced as organizational workforce.
 */

const TYPE_ICON = { human: User, "ai-agent": Bot } as const;

export function WorkforceDirectory({ model }: { model: WorkforceWorkspaceModel }) {
  return (
    <WorkforceRegion
      eyebrow="Who can do the work"
      title="Workforce Directory"
      accent
      className="h-full"
      action={<CapabilityMarker label="No identities connected" />}
    >
      <div className="flex flex-col gap-3">
        <WorkforceEmptyState
          title="No workforce identities connected yet"
          detail="A workforce identity is a human or AI agent the organization can assign work to and hold responsible. No identity model is connected, and none is fabricated. Once connected, each worker appears here with its role, capabilities, responsibilities, availability, and current assignment."
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
                <span className="shrink-0 self-center rounded-full border border-border bg-surface-sunken px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-fg-muted">
                  0 connected
                </span>
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
