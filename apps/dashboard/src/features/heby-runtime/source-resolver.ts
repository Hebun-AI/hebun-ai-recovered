/*
 * heby-runtime/source-resolver.ts — the typed, deterministic source-retrieval layer
 * (UI Phase 16).
 *
 * Retrieval is source-specific: there is no magical "search everything" that erases
 * provenance. Two source classes are backed by REAL derived data — Operations and Platform,
 * read from the Executive Overview (a non-authoritative, machine-derived read model already
 * surfaced on Command and Platform). Every other source class is honestly unavailable: no
 * Director-safe Heby data path is connected, and none is fabricated. Seeded memory/provider
 * catalogs are never used as organizational truth, and no result is invented.
 *
 * Provenance is attached at retrieval and survives unchanged into the response.
 */

import type { HebySourceClass } from "@/features/heby-integration";
import type {
  ExecutiveOverviewLike,
  ResolvedSourceItem,
  SourceResolution,
} from "./contracts";

const OVERVIEW_PROVENANCE =
  "Executive Overview read model — derived and non-authoritative (authoritative: false).";

/** Section ids that describe operational work, grouped under the Operations source class. */
const OPERATIONS_SECTIONS = new Set([
  "active-agents",
  "active-workflows",
  "monitoring-summary",
  "diagnostics-summary",
  "evaluation-summary",
  "runtime-status",
]);

/** Section ids that describe the technical substrate, grouped under Platform. */
const PLATFORM_SECTIONS = new Set([
  "platform-status",
  "runtime-status",
  "authentication-summary",
]);

function sectionsToItems(
  overview: ExecutiveOverviewLike,
  belongs: Set<string>,
): ResolvedSourceItem[] {
  return overview.sections
    .filter((section) => belongs.has(section.sectionId))
    .map((section) => ({
      recordRef: section.sectionId,
      label: section.label,
      detail: `health: ${section.health} · ${section.reasonCode} · ${section.recordCount} record${section.recordCount === 1 ? "" : "s"}`,
      lifecycle: "unknown" as const,
    }));
}

function unavailable(sourceClass: HebySourceClass, reason: string): SourceResolution {
  return {
    sourceClass,
    state: "unavailable",
    provenance: "No connected Heby data path.",
    authoritative: false,
    items: [],
    unavailableReason: reason,
  };
}

/**
 * Resolve one source class. Deterministic and pure. Overview-backed classes return real
 * derived items with provenance; everything else returns an honest unavailable state.
 */
export function resolveSource(
  sourceClass: HebySourceClass,
  overview?: ExecutiveOverviewLike,
): SourceResolution {
  switch (sourceClass) {
    case "operations": {
      if (!overview) return unavailable("operations", "System state was not provided to Heby.");
      const items = sectionsToItems(overview, OPERATIONS_SECTIONS);
      return {
        sourceClass: "operations",
        state: items.length > 0 ? "resolved" : "unavailable",
        provenance: OVERVIEW_PROVENANCE,
        authoritative: false,
        items,
        unavailableReason: items.length === 0 ? "No operational sections are readable." : undefined,
      };
    }
    case "platform": {
      if (!overview) return unavailable("platform", "System state was not provided to Heby.");
      const items = sectionsToItems(overview, PLATFORM_SECTIONS);
      return {
        sourceClass: "platform",
        state: items.length > 0 ? "resolved" : "unavailable",
        provenance: OVERVIEW_PROVENANCE,
        authoritative: false,
        items,
        unavailableReason: items.length === 0 ? "No platform sections are readable." : undefined,
      };
    }
    // These source classes have no connected Heby retrieval path. Honest unavailable —
    // seeded memory/intelligence/governance data is never presented as organizational truth.
    //
    // K1: Knowledge DOES have a real read path, but it is tenant-scoped and database-backed, and
    // this resolver is pure — it holds no tenant and can open no connection. So it reports the
    // honest default, and the server answer flow substitutes the real tenant-scoped resolution
    // (heby-answer/knowledge-evidence.server.ts). A caller with no server seam gets no knowledge,
    // which is the truthful outcome rather than a seeded one.
    case "knowledge":
      return unavailable(
        "knowledge",
        "Knowledge is read tenant-scoped on the server; no authorized server read was supplied here, so nothing was read.",
      );
    case "memory":
      return unavailable("memory", "No connected Memory retrieval path.");
    case "intelligence":
      return unavailable("intelligence", "No validated Intelligence candidates are connected.");
    case "workforce":
      return unavailable("workforce", "No connected Workforce retrieval path.");
    case "governance":
      return unavailable("governance", "Governance structural vocabulary only; no live policy instances connected.");
    case "decision-records":
      return unavailable("decision-records", "No persisted decision records are connected.");
    /*
     * R3W: prepared work IS durable and tenant-scoped, and it is read exactly the way K1 reads
     * Knowledge — on the server, inside an already-resolved tenant. This resolver is pure: it
     * holds no tenant and can open no connection, so it reports the honest default and the server
     * answer flow substitutes the real tenant-scoped resolution
     * (work-artifacts/work-artifact-evidence.server.ts). A caller with no server seam gets no
     * artifacts, which is the truthful outcome rather than a seeded one.
     */
    case "work-artifacts":
      return unavailable(
        "work-artifacts",
        "Prepared work is read tenant-scoped on the server; no authorized server read was supplied here, so nothing was read.",
      );
    default: {
      // Exhaustiveness guard — a new source class must be handled explicitly.
      const never: never = sourceClass;
      return never;
    }
  }
}

/** Resolve several source classes at once, preserving order. Pure. */
export function resolveSources(
  sourceClasses: readonly HebySourceClass[],
  overview?: ExecutiveOverviewLike,
): readonly SourceResolution[] {
  return sourceClasses.map((sourceClass) => resolveSource(sourceClass, overview));
}
