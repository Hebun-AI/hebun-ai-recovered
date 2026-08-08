import { CommandRegion, RegionEmptyState } from "./command-region";

/*
 * Recent Significant Changes — derivable from Executive Overview section-state
 * deltas across snapshots. Command renders a single snapshot per request and no
 * change history is persisted yet, so there is insufficient real history to show
 * (spec §8/§17). Honest empty — no telemetry variation is invented into meaning.
 */

export function RecentChanges() {
  return (
    <CommandRegion eyebrow="What changed" title="Recent Significant Changes">
      <RegionEmptyState
        title="No change history available yet"
        detail="Significant changes are derived from differences between system snapshots. No snapshot history is retained yet, so no changes can be shown. No variation is inferred into meaning."
      />
    </CommandRegion>
  );
}
