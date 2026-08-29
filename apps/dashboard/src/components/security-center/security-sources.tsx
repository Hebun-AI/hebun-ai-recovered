import { Check, Minus } from "lucide-react";
import type { SecurityCenterModel, SecuritySourceStatus } from "@/features/security-center";
import { SecurityRegion, stateLabel, stateTone, toneClass } from "./security-region";
import { cn } from "@/lib/utils";

/*
 * Security Sources & Coverage (UI refinement · E2-2) — separates CONNECTED sources (this surface
 * holds and consumes a real tenant-scoped read path) from DERIVED sources (a real,
 * non-authoritative technical state Hebun already exposes) and NOT-CONNECTED sources (no feed and
 * no read path). For each source it states what it CAN prove and what it CANNOT — the critical
 * distinction that keeps a derived technical state, or a connected read, from being over-read as
 * security proof.
 *
 * ── THE TRUTH BUG E2-2 REPAIRED ──────────────────────────────────────────────
 *
 * This component used to render `state === "not-connected" ? "Not connected" : "Derived"`, and
 * partitioned the list into exactly two columns. That was true while nothing was connected and
 * became a silent falsehood the moment something was: a connected source would have been labelled
 * "Derived" and filed under derived sources, with no error anywhere. The label now comes from the
 * shared `stateLabel` map — one definition, so a fourth state cannot be silently mislabelled here
 * either — and the partition has a third group.
 *
 *     CONNECTED != DERIVED     CONNECTED != AUTHORITATIVE
 */

function SourceRow({ source }: { source: SecuritySourceStatus }) {
  return (
    <li className="rounded-lg border border-border bg-surface-sunken p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-fg">{source.sourceClass}</span>
        <span
          className={cn(
            "shrink-0 rounded-full border bg-surface px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wider",
            toneClass(stateTone(source.state)),
          )}
        >
          {stateLabel(source.state)}
        </span>
      </div>
      <p className="mt-1.5 flex items-start gap-1.5 text-[0.7rem] leading-5 text-fg-secondary">
        <Check className="mt-0.5 size-3 shrink-0 text-highlight" aria-hidden="true" />
        <span><span className="font-medium text-fg-secondary">Can prove:</span> {source.canProve}</span>
      </p>
      <p className="mt-0.5 flex items-start gap-1.5 text-[0.7rem] leading-5 text-fg-muted">
        <Minus className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        <span><span className="font-medium">Cannot prove:</span> {source.cannotProve}</span>
      </p>
    </li>
  );
}

/** One group per state, so a source can never be shown under a heading that misdescribes it. */
const GROUPS = [
  { state: "connected", heading: "Connected sources" },
  { state: "derived", heading: "Derived sources" },
  { state: "not-connected", heading: "Not connected" },
] as const;

export function SecuritySources({ model, className }: { model: SecurityCenterModel; className?: string }) {
  const groups = GROUPS.map((group) => ({
    ...group,
    sources: model.sources.filter((source) => source.state === group.state),
  })).filter((group) => group.sources.length > 0);
  return (
    <SecurityRegion className={className} eyebrow="What evidence supports the view" title="Sources & Coverage">
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <div key={group.state}>
            <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">{group.heading}</p>
            <ul className="flex flex-col gap-2">
              {group.sources.map((source) => <SourceRow key={source.sourceClass} source={source} />)}
            </ul>
          </div>
        ))}
      </div>
    </SecurityRegion>
  );
}
