import { Info, Wrench, Network, Sliders, Activity, ShieldCheck, Fingerprint } from "lucide-react";
import type { PlatformWorkspaceModel } from "@/features/platform/workspace-model";
import { PlatformRegion, TechnicalMarker } from "./platform-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Platform Inspector (Phase 13 §24) — the contextual lens for one connection or
 * dependency.
 *
 * Lenses: Overview → Capabilities → Dependencies → Configuration → Health →
 * Governance → Provenance. With nothing selected (and nothing surfaced to select),
 * the inspector shows its honest instructional state and never fabricates a
 * configuration value — and never a secret.
 */

const LENS_ICON: Record<string, typeof Info> = {
  Overview: Info,
  Capabilities: Wrench,
  Dependencies: Network,
  Configuration: Sliders,
  Health: Activity,
  Governance: ShieldCheck,
  Provenance: Fingerprint,
};

export function PlatformInspector({ model }: { model: PlatformWorkspaceModel }) {
  return (
    <PlatformRegion
      eyebrow="Inspect"
      title="Platform Inspector"
      className="h-full"
      action={<TechnicalMarker label="Nothing selected" />}
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-5 text-fg-secondary">
          Select a connection or dependency to inspect it through these lenses. Nothing is surfaced yet, so
          there is nothing to inspect — the inspector never fabricates a configuration value or a secret.
        </p>
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface-sunken">
          {model.inspectorLenses.map((lens) => {
            const Icon = LENS_ICON[lens.facet] ?? Info;
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
    </PlatformRegion>
  );
}
