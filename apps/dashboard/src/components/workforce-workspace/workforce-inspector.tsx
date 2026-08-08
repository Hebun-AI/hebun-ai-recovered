import { User, Briefcase, Wrench, ClipboardCheck, ListChecks, ShieldCheck, Activity, Fingerprint } from "lucide-react";
import type { WorkforceWorkspaceModel } from "@/features/workforce/workspace-model";
import { WorkforceRegion, CapabilityMarker } from "./workforce-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Workforce Inspector (Phase 11 §11) — the contextual lens for one worker.
 *
 * Lenses: Identity → Role → Capabilities → Responsibilities → Assignments →
 * Authority → Activity → Provenance. With no worker selected (and none surfaced to
 * select), the inspector shows its honest instructional state and never fabricates
 * an identity, capability, assignment, or authority.
 */

const LENS_ICON: Record<string, typeof User> = {
  Identity: User,
  Role: Briefcase,
  Capabilities: Wrench,
  Responsibilities: ClipboardCheck,
  Assignments: ListChecks,
  Authority: ShieldCheck,
  Activity: Activity,
  Provenance: Fingerprint,
};

export function WorkforceInspector({ model }: { model: WorkforceWorkspaceModel }) {
  return (
    <WorkforceRegion
      eyebrow="Inspect"
      title="Workforce Inspector"
      className="h-full"
      action={<CapabilityMarker label="Nothing selected" />}
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-5 text-fg-secondary">
          Select a worker to inspect them through these lenses. Nothing is surfaced yet, so there is nothing to
          inspect — the inspector never fabricates an identity or capability to fill this space.
        </p>
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface-sunken">
          {model.inspectorLenses.map((lens) => {
            const Icon = LENS_ICON[lens.facet] ?? User;
            return (
              <li key={lens.facet} className="flex items-start gap-2.5 p-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">{lens.facet}</p>
                  <p className="text-[0.7rem] leading-5 text-fg-muted">{lens.question}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-2">
          <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">Want the model explained?</span>
          <HebyWhy label="Ask Heby" variant="text" />
        </div>
      </div>
    </WorkforceRegion>
  );
}
