import type { SecurityCenterModel, SecurityResponseDisposition } from "@/features/security-center";
import { SecurityRegion } from "./security-region";

/*
 * Response & Authority (UI refinement). Three tiers, visually separated: ADVISORY (Heby may
 * explain/prepare), HUMAN REVIEW REQUIRED (consequential, routed to Decisions via Phase 17), and
 * NOT AVAILABLE (device-backed, Phase 18 disconnected). It makes the equation obvious —
 * response option ≠ prepared action ≠ authorized action ≠ execution — and shows the authority
 * pipeline. There are NO executable buttons, no Approve/Reject, no Run, no Execute. No action
 * bypasses Phase 17.
 */

const TIERS: readonly { disposition: SecurityResponseDisposition; title: string; note: string }[] = [
  { disposition: "advisory", title: "Advisory", note: "Heby may explain and prepare. No change." },
  { disposition: "requires-human-review", title: "Human review required", note: "Consequential — decided by a human in Decisions." },
  { disposition: "not-available", title: "Not available", note: "Device-backed — Phase 18 Device Runtime is not connected." },
];

const PIPELINE = ["Security Center", "Prepare", "Governance", "Decisions / Human", "Runtime", "Receipt"] as const;

export function SecurityResponse({ model, className }: { model: SecurityCenterModel; className?: string }) {
  return (
    <SecurityRegion className={className} eyebrow="What can happen next" title="Response & Authority">
      <div className="grid min-w-0 gap-3 md:grid-cols-3">
        {TIERS.map((tier) => {
          const options = model.responseOptions.filter((o) => o.disposition === tier.disposition);
          return (
            <div key={tier.disposition} className="flex flex-col rounded-lg border border-border bg-surface-sunken p-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">{tier.title}</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {options.map((o) => (
                  <li key={o.kind} className="text-xs font-medium text-fg">{o.label}</li>
                ))}
              </ul>
              <p className="mt-2 text-[0.65rem] leading-4 text-fg-muted">{tier.note}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">Authority pipeline</p>
        <ol className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
          {PIPELINE.map((step, i) => (
            <li key={step} className="flex items-center gap-1.5">
              <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-[0.7rem] font-medium text-fg-secondary">{step}</span>
              {i < PIPELINE.length - 1 && <span aria-hidden="true" className="text-fg-muted">→</span>}
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-3 rounded-lg border border-dashed border-border bg-surface-sunken p-2.5 text-[0.7rem] leading-5 text-fg-secondary">
        Response option ≠ prepared action ≠ authorized action ≠ execution. An option is never executed here; there is no Approve, Reject, Run, or Execute, and nothing bypasses the Phase 17 pipeline.
      </p>
    </SecurityRegion>
  );
}
