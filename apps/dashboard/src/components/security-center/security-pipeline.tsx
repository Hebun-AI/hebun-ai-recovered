import type { SecurityCenterModel } from "@/features/security-center";
import { SecurityRegion, stateTone, stateLabel, toneClass } from "./security-region";
import { cn } from "@/lib/utils";

/*
 * Security Signal Pipeline (UI refinement) — a structural, derived-from-contracts view of how
 * Hebun security actually works: source → signal → evidence → correlation → finding → investigation
 * → governance → response option → Phase 17 action → human authority → Phase 18 runtime →
 * receipt/audit. Each stage shows its HONEST availability state (none, not-connected, not-available,
 * derived, structural, human-authority) — an unavailable stage reads as unavailable, not decoration.
 * Semantic HTML/CSS only; horizontal flow on desktop, stacked on mobile. No fabricated activity.
 */

export function SecurityPipeline({ model }: { model: SecurityCenterModel }) {
  return (
    <SecurityRegion eyebrow="How Hebun security works" title="Signal Pipeline">
      <ol className="flex flex-col gap-1.5 lg:flex-row lg:flex-wrap lg:items-stretch">
        {model.pipeline.map((stage, i) => {
          const tone = stateTone(stage.state);
          return (
            <li key={stage.stage} className="flex items-stretch gap-1.5">
              <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-border bg-surface-sunken px-2.5 py-2 lg:w-40 lg:flex-none">
                <span className="text-[0.7rem] font-semibold text-fg">{stage.label}</span>
                <span className={cn("mt-1 inline-flex w-fit items-center rounded-full border px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wider", toneClass(tone))}>
                  {stateLabel(stage.state)}
                </span>
                <span className="mt-1 text-[0.6rem] leading-4 text-fg-muted">{stage.detail}</span>
              </div>
              {i < model.pipeline.length - 1 && (
                <span aria-hidden="true" className="hidden shrink-0 items-center self-center text-fg-muted lg:flex">→</span>
              )}
            </li>
          );
        })}
      </ol>
    </SecurityRegion>
  );
}
