import { ChevronRight } from "lucide-react";
import type { WorkforceWorkspaceModel } from "@/features/workforce/workspace-model";
import { WorkforceRegion, WorkforceEmptyState } from "./workforce-region";

/*
 * Capabilities (Phase 11 §12) — what a worker can actually do.
 *
 * Nothing is mapped on this overview; what each durable agent can propose now is
 * read on /agents (WF-2) and is linked to, not restated. Human capabilities have no
 * record. So this region is empty and instead shows the capability chain the model must
 * support without collapsing its links: worker → capability → tool → permission →
 * work. Capability is not permission; permission is granted by Governance. No
 * capability (research, browser use, email, …) is fabricated as current.
 */

export function WorkforceCapabilities({ model }: { model: WorkforceWorkspaceModel }) {
  return (
    <WorkforceRegion variant="plain" eyebrow="What a worker can do" title="Capabilities">
      <div className="flex flex-col gap-3">
        <WorkforceEmptyState
          title="No capabilities mapped here"
          detail="Capabilities describe what a worker can do. What each recorded AI agent can propose now, and what its mandate permits, is shown on Agents. Human capabilities are not recorded. Nothing is fabricated here. A capability is not a permission — permission is granted by Governance, never by capability alone."
          compact
        />
        <ol className="flex flex-wrap items-stretch gap-1.5">
          {model.capabilityChain.map((link, index) => (
            <li key={link.key} className="flex items-stretch gap-1.5">
              <div className="flex min-w-[6.5rem] flex-col gap-0.5 rounded-lg border border-border bg-surface-sunken px-2.5 py-2">
                <span className="text-xs font-semibold text-fg">{link.label}</span>
                <span className="text-[0.62rem] leading-4 text-fg-muted">{link.describes}</span>
              </div>
              {index < model.capabilityChain.length - 1 && (
                <ChevronRight className="hidden size-4 shrink-0 self-center text-fg-muted sm:block" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      </div>
    </WorkforceRegion>
  );
}
