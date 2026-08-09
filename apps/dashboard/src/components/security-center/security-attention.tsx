import { ShieldCheck } from "lucide-react";
import type { SecurityCenterModel } from "@/features/security-center";

/*
 * Security Attention (UI refinement) — the primary region. Prominent even while empty: when no
 * validated finding exists, it states the honest reason and shows the finding lifecycle, making
 * clear that runtime degradation, provider failure, device unavailability, and authentication state
 * are NOT converted into attacks or incidents, and that no "confirmed breach" state is produced.
 */

export function SecurityAttention({ model }: { model: SecurityCenterModel }) {
  const hasFindings = model.findings.length > 0;
  return (
    <section aria-label="Security attention" className="rounded-xl border border-border bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-fg-muted">What requires attention</p>
          <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
            <span className="flex size-6 items-center justify-center rounded-md bg-highlight/15 text-highlight">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
            </span>
            Security Attention
          </h2>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-surface-sunken px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-fg-muted">
          {model.findings.length} validated
        </span>
      </header>

      <div className="flex flex-col gap-4 p-5">
        {!hasFindings && (
          <div className="rounded-xl border border-dashed border-border bg-surface-sunken p-5">
            <p className="text-base font-semibold text-fg">No validated security findings</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-secondary">
              No connected security feed currently provides evidence sufficient to surface a finding. Runtime
              degradation, provider failure, device unavailability, and authentication technical state are not
              converted into attacks or incidents.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">Finding lifecycle</span>
            {model.findingStatuses.map((status, i) => (
              <span key={status} className="flex items-center gap-1.5">
                <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-[0.65rem] font-medium text-fg-secondary">
                  {status.replace(/_/g, " ")}
                </span>
                {i < model.findingStatuses.length - 1 && <span aria-hidden="true" className="text-fg-muted">→</span>}
              </span>
            ))}
          </div>
        </div>
        <p className="text-[0.7rem] leading-5 text-fg-muted">
          No &ldquo;confirmed breach&rdquo; state is currently produced — confirming requires a real authority and evidence path that is not connected.
        </p>
      </div>
    </section>
  );
}
