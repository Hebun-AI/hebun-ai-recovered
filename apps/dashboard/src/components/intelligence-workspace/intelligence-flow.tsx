import { ChevronRight } from "lucide-react";
import type { IntelligenceWorkspaceModel } from "@/features/intelligence/workspace-model";
import { WorkspaceRegion, AdvisoryMarker } from "./workspace-region";

/*
 * Intelligence Flow / lifecycle (Phase 8 §15) — a restrained, EXPLANATORY view of
 * the Runtime's real, ordered stages (input → … → output). This is process
 * architecture, not live telemetry: no stage shows progress, a completion
 * percentage, or a live count. It exists to explain how observation becomes a
 * briefing that terminates at the Director — never a fake runtime progress bar.
 */

export function IntelligenceFlow({ model }: { model: IntelligenceWorkspaceModel }) {
  return (
    <WorkspaceRegion
      eyebrow="How intelligence forms"
      title="Runtime Lifecycle"
      action={<AdvisoryMarker label="Process — not live telemetry" />}
    >
      <div className="flex flex-col gap-3">
        <ol className="flex flex-wrap items-stretch gap-1.5">
          {model.stages.map((stage, index) => (
            <li key={stage.stage} className="flex items-stretch gap-1.5">
              <div className="flex min-w-[6.5rem] flex-col gap-0.5 rounded-lg border border-border bg-surface-sunken px-2.5 py-2">
                <span className="flex items-center gap-1.5">
                  <span className="text-[0.6rem] font-semibold tabular-nums text-fg-muted">{stage.order}</span>
                  <span className="truncate text-xs font-semibold text-fg">{stage.label}</span>
                </span>
                <span className="text-[0.62rem] leading-4 text-fg-muted">{stage.describes}</span>
              </div>
              {index < model.stages.length - 1 && (
                <ChevronRight className="hidden size-4 shrink-0 self-center text-fg-muted sm:block" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
        <p className="text-[0.7rem] leading-5 text-fg-muted">
          The lifecycle terminates at the Director. The Runtime organizes, validates, and explains; it never
          decides, approves, or executes.
        </p>
      </div>
    </WorkspaceRegion>
  );
}
