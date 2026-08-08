import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CommandRegion, RegionEmptyState } from "./command-region";

/*
 * Decision Pressure — summary of pending human-authority decisions.
 *
 * The approval/decision data available today is simulated (the Decision Center
 * records local simulated intent only). Per spec §4/§7.3 it must NOT be
 * presented as real decision pressure, so this region shows an honest
 * not-connected state and routes to the dedicated decision surface. No approve
 * or reject control exists here — the authority act lives on its own surface.
 */

export function DecisionPressure() {
  return (
    <CommandRegion eyebrow="Human decision" title="Decision Pressure">
      <RegionEmptyState
        title="Live decision pressure is not yet connected"
        detail="The decision surface currently records simulated Director intent only; it is not surfaced here as real pending approvals. The authority act stays on the decision surface."
      />
      <Link
        href="/approvals"
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors duration-(--dur-fast) hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
      >
        Open decision surface
        <ArrowUpRight className="size-3.5" aria-hidden="true" />
      </Link>
    </CommandRegion>
  );
}
