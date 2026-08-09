import type { SecurityCenterModel } from "@/features/security-center";
import { SecurityCommandCell, stateTone } from "./security-region";

/*
 * Security Command Strip (UI refinement) — the security equivalent of the Command workspace's
 * operational status strip. Real/structural values only: Not connected, Not available, Derived,
 * None retained, Human required. "0" appears only where structurally known to be zero. No invented
 * value, no threat counter, no score.
 */

export function SecurityCommandStrip({ model }: { model: SecurityCenterModel }) {
  return (
    <section aria-label="Security state" className="rounded-xl border border-border bg-surface p-4">
      <p className="mb-3 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-fg-muted">Security state</p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        {model.stateStrip.map((entry) => (
          <SecurityCommandCell key={entry.label} label={entry.label} value={entry.value} tone={stateTone(entry.status)} />
        ))}
      </dl>
    </section>
  );
}
