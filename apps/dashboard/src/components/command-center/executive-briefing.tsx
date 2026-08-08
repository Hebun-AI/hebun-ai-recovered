import { CommandRegion, NonAuthoritativeMarker, RegionEmptyState } from "./command-region";
import { HebyWhy } from "./heby-why";

/*
 * Executive Briefing — the future home of Heby-composed advisory synthesis.
 *
 * NOT YET AVAILABLE: no live briefing composer/read model is connected. Per
 * spec §7.6, the surface structure is established (heading, provenance +
 * confidence affordances, Heby explanation) but NO briefing text is generated.
 * No mock intelligence.
 */

export function ExecutiveBriefing() {
  return (
    <CommandRegion
      eyebrow="Advisory"
      title="Executive Briefing"
      action={<NonAuthoritativeMarker label="Advisory" />}
    >
      <RegionEmptyState
        title="No briefing available yet"
        detail="Heby-composed briefings — synthesis with evidence, sources, and confidence — will appear here once a live briefing composer is connected. Nothing is generated in the meantime."
      />
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-fg-muted">
        <span>Evidence &amp; sources · when available</span>
        <span aria-hidden="true">·</span>
        <span>Confidence · —</span>
        <HebyWhy label="Ask Heby" className="ml-auto" />
      </div>
    </CommandRegion>
  );
}
