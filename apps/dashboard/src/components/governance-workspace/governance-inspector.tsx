import { Scale, Crosshair, Ban, ShieldCheck, AlertTriangle, FileSearch, Fingerprint, History } from "lucide-react";
import type { GovernanceWorkspaceModel } from "@/features/governance/workspace-model";
import { GovernanceRegion, ControlMarker } from "./governance-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Governance Inspector (Phase 12 §24) — the contextual lens for one control.
 *
 * Lenses: Policy → Applicability → Restriction → Authority → Risk → Evidence →
 * Provenance → History. With no control selected (and none surfaced to select), the
 * inspector shows its honest instructional state and never fabricates a policy,
 * restriction, authority requirement, risk, or evidence record.
 */

const LENS_ICON: Record<string, typeof Scale> = {
  Policy: Scale,
  Applicability: Crosshair,
  Restriction: Ban,
  Authority: ShieldCheck,
  Risk: AlertTriangle,
  Evidence: FileSearch,
  Provenance: Fingerprint,
  History: History,
};

export function GovernanceInspector({ model }: { model: GovernanceWorkspaceModel }) {
  return (
    <GovernanceRegion
      eyebrow="Inspect"
      title="Governance Inspector"
      className="h-full"
      action={<ControlMarker label="Nothing selected" />}
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-5 text-fg-secondary">
          Select a control to inspect it through these lenses. Nothing is surfaced yet, so there is nothing to
          inspect — the inspector never fabricates a policy or restriction to fill this space.
        </p>
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface-sunken">
          {model.inspectorLenses.map((lens) => {
            const Icon = LENS_ICON[lens.facet] ?? Scale;
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
    </GovernanceRegion>
  );
}
