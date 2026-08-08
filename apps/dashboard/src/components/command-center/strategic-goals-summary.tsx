import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CommandRegion, RegionEmptyState } from "./command-region";

/*
 * Strategic Goals summary — Command-owned cockpit material. The current goal
 * surface is mock only, so per spec §9/§20 no goal numbers are surfaced here as
 * real. An honest not-connected summary establishes the surface and links to the
 * (mock) detail page without copying its data into Command.
 */

export function StrategicGoalsSummary() {
  return (
    <CommandRegion eyebrow="Direction" title="Strategic Goals">
      <RegionEmptyState
        title="Strategic goals are not connected yet"
        detail="No real goal read model is populated. Goal counts and risk are not shown here to avoid presenting mock data as real."
      />
      <Link
        href="/director/goals"
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors duration-(--dur-fast) hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
      >
        Open goals surface
        <ArrowUpRight className="size-3.5" aria-hidden="true" />
      </Link>
    </CommandRegion>
  );
}
