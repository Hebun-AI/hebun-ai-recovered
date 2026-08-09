import { Check, Minus } from "lucide-react";
import type { SecurityCenterModel, SecuritySourceStatus } from "@/features/security-center";
import { SecurityRegion } from "./security-region";

/*
 * Security Sources & Coverage (UI refinement) — separates DERIVED sources (a real, non-authoritative
 * technical state Hebun already exposes) from NOT-CONNECTED sources (no feed). For each source it
 * states what it CAN prove and what it CANNOT — the critical distinction that keeps a derived
 * technical state from being over-read as security proof.
 */

function SourceRow({ source }: { source: SecuritySourceStatus }) {
  return (
    <li className="rounded-lg border border-border bg-surface-sunken p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-fg">{source.sourceClass}</span>
        <span className="shrink-0 rounded-full border border-border bg-surface px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wider text-fg-muted">
          {source.state === "not-connected" ? "Not connected" : "Derived"}
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

export function SecuritySources({ model, className }: { model: SecurityCenterModel; className?: string }) {
  const derived = model.sources.filter((s) => s.state === "derived");
  const notConnected = model.sources.filter((s) => s.state === "not-connected");
  return (
    <SecurityRegion className={className} eyebrow="What evidence supports the view" title="Sources & Coverage">
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">Derived sources</p>
          <ul className="flex flex-col gap-2">
            {derived.map((source) => <SourceRow key={source.sourceClass} source={source} />)}
          </ul>
        </div>
        <div>
          <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">Not connected</p>
          <ul className="flex flex-col gap-2">
            {notConnected.map((source) => <SourceRow key={source.sourceClass} source={source} />)}
          </ul>
        </div>
      </div>
    </SecurityRegion>
  );
}
