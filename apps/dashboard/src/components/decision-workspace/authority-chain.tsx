import { UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { DecisionRegion, StructuralMarker } from "./decision-region";
import type { AuthorityChainStep } from "@/features/decisions/workspace-model";

/*
 * The Human Authority Chain (Phase 14 §7, §8) — the structural path from advisory
 * material to an authorized handoff, making the authority chain explicit so the UI
 * never implies the system decided.
 *
 * STRUCTURAL only: it is the shape of the process, drawn from the real Heby Core
 * Phase 6 contract (advice → review/approval, always pending at the Director,
 * terminating at the human). Every step is marked "not connected" because no live
 * instance feeds it, and the single human-authority step is called out — the only
 * point at which authority is exercised, and only ever by a person.
 *
 * Approval, decision, and execution are kept distinct: preparation and review lead
 * to a human decision, which produces a record, which MAY become an authorized
 * handoff. None of these is the same act.
 */

export function AuthorityChain({ steps }: { steps: readonly AuthorityChainStep[] }) {
  return (
    <DecisionRegion
      eyebrow="How authority flows"
      title="The Human Authority Chain"
      action={<StructuralMarker label="Not connected" />}
    >
      <ol className="flex flex-col gap-2">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={cn(
              "flex min-w-0 items-start gap-3 rounded-lg border p-3",
              step.isHumanAuthority
                ? "border-primary/40 bg-primary-subtle/40"
                : "border-border bg-surface-sunken",
            )}
          >
            <span
              className={cn(
                "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold tabular-nums",
                step.isHumanAuthority
                  ? "bg-primary text-on-primary"
                  : "border border-border bg-surface text-fg-muted",
              )}
              aria-hidden="true"
            >
              {step.isHumanAuthority ? <UserCheck className="size-3.5" /> : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium text-fg">{step.label}</span>
                <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-fg-muted">
                  {step.owner}
                </span>
                {step.isHumanAuthority && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wider text-on-primary">
                    Human authority
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[0.7rem] leading-5 text-fg-secondary">{step.describes}</p>
            </div>
            <span className="mt-0.5 shrink-0 text-[0.6rem] font-medium uppercase tracking-wider text-fg-muted">
              Not connected
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[0.7rem] leading-5 text-fg-muted">
        This is the structure of the process, not a live decision. Advisory material and a recommendation are
        never an approval; an approval act and a decision record are not the same thing; a decision is not
        execution.
      </p>
    </DecisionRegion>
  );
}
