import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/*
 * Decision Pressure — compact secondary state (Phase 7 §10).
 *
 * No real decision-pressure pipeline exists (the decision surface records
 * simulated intent only), so this stays honestly unavailable — but it must not
 * carry the visual weight of real Director Attention. Compact panel, no fake
 * counts, no approve/reject control. It can expand later without a redesign.
 */

export function DecisionPressure() {
  return (
    <section
      aria-label="Decision Pressure"
      className="flex h-full min-w-0 flex-col rounded-xl border border-border bg-surface p-4"
    >
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-fg-muted">Human decision</p>
      <h2 className="text-sm font-semibold text-fg">Decision Pressure</h2>
      <div className="mt-3 flex items-start gap-2">
        <span className="mt-0.5 size-2 shrink-0 rounded-full bg-fg-muted" aria-hidden="true" />
        <p className="text-xs leading-5 text-fg-secondary">
          No live decision pressure connected. The decision surface records simulated intent only; the authority act stays there.
        </p>
      </div>
      <Link
        href="/approvals"
        className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-medium text-primary transition-colors duration-(--dur-fast) hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
      >
        Open decision surface
        <ArrowUpRight className="size-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
}
