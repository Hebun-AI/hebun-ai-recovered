import type { WorkforceWorkspaceModel } from "@/features/workforce/workspace-model";
import { WorkforceRegion, CapabilityMarker } from "./workforce-region";

/*
 * Workforce model (Phase 11 §4/§13) — the distinct concept layers.
 *
 * The product must keep these separate: Identity, Role, Capability, Responsibility,
 * Assignment, Authority, Availability. None collapses into another. This region
 * makes the distinctions explicit as the workspace's information model — no role,
 * responsibility, or assignment record is fabricated.
 */

export function WorkforceConceptModel({ model }: { model: WorkforceWorkspaceModel }) {
  return (
    <WorkforceRegion
      variant="plain"
      eyebrow="How workforce is modelled"
      title="Roles, Responsibilities & Authority"
      action={<CapabilityMarker label="Kept distinct — none implies another" />}
    >
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {model.conceptLayers.map((layer) => (
          <li key={layer.key} className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface p-3">
            <span className="text-sm font-semibold text-fg">{layer.label}</span>
            <span className="text-[0.65rem] leading-4 text-fg-muted">{layer.question}</span>
            <p className="mt-1 text-[0.7rem] leading-5 text-fg-secondary">{layer.notEqual}</p>
          </li>
        ))}
      </ul>
    </WorkforceRegion>
  );
}
