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
    /*
     * INT-5A. The same arrangement K1, R3W, R3R and G6C use: this resolver is PURE — it holds no
     * tenant and can open no connection — so it reports the honest default, and the server answer
     * flow substitutes the real tenant-scoped read. A caller with no server seam gets no
     * integration state, which is the truthful outcome rather than a seeded one.
     */
    case "integrations":
      return unavailable(
        "integrations",
        "Integration capability state is read tenant-scoped on the server; no authorized server read was supplied here, so nothing was read.",
      );
    case "intelligence":
      return unavailable("intelligence", "No validated Intelligence candidates are connected.");
    case "workforce":
      return unavailable("workforce", "No connected Workforce retrieval path.");
    /*
     * E2-5. The same arrangement K1, R3W, R3R, G6C, INT-5A and E2-1 use: this resolver is PURE — it
     * holds no tenant and can open no connection — so it reports the honest default, and the server
     * answer flow substitutes the real tenant-scoped read. A caller with no server seam gets no
     * agent observation, which is the truthful outcome rather than a seeded one.
     *
     * The sentence states that the read is tenant-scoped and server-side, NOT that nothing is
     * connected — G6D's correction, for the reason it recorded: this resolution is also what
     * `withAgents` falls back to when the real read THROWS, and reporting a read failure as a
     * permanent absence of connection would be false.
     */
    case "agents":
      return unavailable(
        "agents",
        "Durable agents are read tenant-scoped on the server; no authorized server read was supplied here, so nothing was read.",
      );
    /*
     * E2-6. The same arrangement every connected class uses: this resolver is PURE — it holds no
     * tenant and can open no connection — so it reports the honest default, and the server answer
     * flow substitutes the real tenant-scoped read. G6D's correction applies: it states that the
     * read is server-side, NOT that nothing is connected, because `withRecordedActs` also falls
     * back here when the real read THROWS.
     */
    case "recorded-acts":
      return unavailable(
        "recorded-acts",
        "Recorded acts are read tenant-scoped on the server; no authorized server read was supplied here, so nothing was read.",
      );
    /* E2-7. Same arrangement, same G6D correction: a server read, not an absent connection. */
    case "recorded-act-windows":
      return unavailable(
        "recorded-act-windows",
        "Windowed recorded-act counts are read tenant-scoped on the server; no authorized server read was supplied here, so nothing was read.",
      );
    /*
     * G6D. G6C connected Governance on the server seam exactly as K1 connected Knowledge, and the
     * sentence above is the precedent for what that obliges: state that the read is tenant-scoped
     * and server-side, not that nothing is connected.
     *
     * The old sentence — "Governance structural vocabulary only; no live policy instances
     * connected" — described the world before G6C and is now false in two ways. Governance IS
     * connected (`governance-grounding/heby-governance-source.server.ts`), and this resolution is
     * also what `withGovernance` falls back to when that read THROWS, so a real read failure was
     * being reported as a permanent absence of connection.
     */
    case "governance":
      return unavailable(
        "governance",
        "Governance is read tenant-scoped on the server; no authorized server read was supplied here, so nothing was read.",
      );
    /*
     * G6D. THE VOCABULARY COLLISION, stated rather than left for the reader to trip over.
     *
     * This class is NOT the Governance decision record. `decision_records` is the table Governance
     * owns and the `governance` class above now reads; this class is decision PREPARATION material
     * — the only two workspaces that declare it, `command` and `decisions`, both also declare the
     * `decision-preparation` capability, and neither owns a connected reader for it.
     *
     * The old sentence said "No persisted decision records are connected." On `/approvals` that
     * printed beside an authoritative item this organization's `decision_records` had just
     * supplied, so the one word both meanings share made a true statement read as a false one.
     */
    case "decision-records":
      return unavailable(
        "decision-records",
        "No connected decision-preparation retrieval path. This is not the Governance decision record, which the governance source class reads.",
      );
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
    /*
     * R3R: recorded recipients are durable and tenant-scoped, and they are read exactly the way K1
     * reads Knowledge and R3W reads artifacts — on the server, inside an already-resolved tenant.
     * This resolver is pure: it holds no tenant and can open no connection, so it reports the
     * honest default and the server answer flow substitutes the real tenant-scoped resolution
     * (external-recipients/recipient-evidence.server.ts). A caller with no server seam gets no
     * recipients, which is the truthful outcome rather than a seeded one — and it matters more
     * here than anywhere else, because a fabricated item in this class would be a real person's
     * address that nobody recorded.
     */
    case "external-recipients":
      return unavailable(
        "external-recipients",
        "Recorded recipients are read tenant-scoped on the server; no authorized server read was supplied here, so nothing was read.",
      );
    /*
     * E2-1: the organization IS durable and tenant-scoped, and it is read exactly the way K1 reads
     * Knowledge and G6C reads Governance — on the server, inside an already-resolved tenant. This
     * resolver is pure: it holds no tenant and can open no connection, so it reports the honest
     * default and the server answer flow substitutes the real tenant-scoped resolution
     * (organization-authority/heby-organization-source.server.ts).
     *
     * G6D's rule applies here and is why this sentence explains the seam rather than claiming
     * non-connection: this resolution is ALSO what `withOrganization` falls back to when the real
     * read throws, and reporting a transient read failure as "no organization is connected" would
     * be the exact defect G6D repaired for Governance.
     */
    case "organization":
      return unavailable(
        "organization",
        "The organization is read tenant-scoped on the server; no authorized server read was supplied here, so nothing was read.",
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
