import type { SecurityCenterModel } from "@/features/security-center";
import { SecurityRegion, stateTone, stateLabel, toneClass } from "./security-region";
import { cn } from "@/lib/utils";

/*
 * Security Domains (UI refinement) — domain STATUS surfaces, never fake "agents". Each domain shows
 * an honest state: derived (a real technical state exists), not-connected (no feed), or restricted.
 * Unknown / not-connected is NEVER shown as healthy; no health percentage is invented; green is
 * never used to mean "nothing reported".
 */

export function SecurityDomains({ model }: { model: SecurityCenterModel }) {
  return (
    <SecurityRegion eyebrow="Coverage by domain — status, not agents" title="Security Domains">
      <ul className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {model.domains.map((domain) => {
          const tone = stateTone(domain.state);
          return (
            <li key={domain.domain} className="flex flex-col rounded-lg border border-border bg-surface-sunken p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-fg">{domain.label}</span>
                <span className={cn("shrink-0 rounded-full border px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wider", toneClass(tone))}>
                  {stateLabel(domain.state)}
                </span>
              </div>
              <p className="mt-1 text-[0.65rem] leading-4 text-fg-muted">{domain.detail}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[0.65rem] leading-4 text-fg-muted">A domain with no connected feed reads Not connected — never upgraded to a positive status without positively-known state.</p>
    </SecurityRegion>
  );
}
