/*
 * knowledge/contracts.ts — the narrowest provider-neutral Knowledge READ contract
 * (Knowledge Source Expansion K1).
 *
 * WHAT THIS IS NOT. It is not a second Knowledge model. The canonical Knowledge model
 * already exists and is owned by the schema: `knowledge_facts` carries fact IDENTITY and
 * active-node selection, `knowledge_nodes` carries the knowledge CONTENT and its governance
 * metadata. These types are a read projection of exactly that, shaped for the one consumer
 * K1 adds (Heby), and nothing else.
 *
 * WHAT IS DELIBERATELY ABSENT. There is no confidence, no relevance score, no trust
 * percentage, no quality figure, and no match strength — this repository has no authority
 * that owns any of them, so inventing one would be the fabrication K1 exists to prevent.
 * Freshness is likewise never invented: it is derived ONLY from timestamps the record itself
 * carries, and is `unknown` when the record carries none.
 *
 * Pure types. No React, no I/O, no server, no authority.
 */

/** The canonical scope of a knowledge fact (`knowledge_scope`). */
export type KnowledgeScope = "company-wide" | "department" | "domain";

/**
 * The canonical lifecycle standing of a knowledge node (`knowledge_lifecycle_status`).
 * `null` when the record does not state one — never defaulted to a flattering value.
 */
export type KnowledgeLifecycleStatus =
  | "draft"
  | "proposed"
  | "under-review"
  | "ratified"
  | "superseded"
  | "deprecated"
  | "retired"
  | "archived";

/**
 * The canonical authority classification (`knowledge_authority`). This is the distinction
 * Step 8 requires Heby to keep: authoritative knowledge and provisional knowledge are not the
 * same kind of truth, and a record that states neither is `null` — not silently promoted.
 */
export type KnowledgeAuthorityClass = "authoritative" | "provisional";

/** The canonical health the record states about itself (`knowledge_health`). */
export type KnowledgeHealth = "unknown" | "current" | "stale" | "contested";

/**
 * Freshness, derived STRICTLY from timestamps the record carries. It is a statement about the
 * record's own declared review cadence — never a claim that the knowledge is true now.
 *
 *   unknown          the record states no review date, so nothing can be said.
 *   within-cadence   its next review date has not passed.
 *   review-overdue   its next review date has passed.
 *   not-yet-effective / expired  derived from effectiveFrom / effectiveUntil.
 */
export type KnowledgeFreshness =
  | "unknown"
  | "within-cadence"
  | "review-overdue"
  | "not-yet-effective"
  | "expired";

/**
 * One knowledge record as Heby may see it.
 *
 * Note what is NOT here: no database row id, no tenant id, no storage path, no internal
 * governance session or decision id, no raw provenance blob. Heby receives the product
 * information it needs to answer and cite, and nothing that only the database needs.
 */
export interface KnowledgeSourceRecord {
  /**
   * The `knowledge_facts` row id. Exposed because K3's correction must target a specific row and a
   * (key, domain, scope) triple is not a handle. It is an opaque reference that grants nothing: the
   * server re-resolves it inside the acting tenant on every use.
   */
  readonly factId: string;
  /** The canonical fact key — the stable, human-meaningful identity of the fact. */
  readonly factKey: string;
  readonly domainKey: string;
  readonly scope: KnowledgeScope;
  /** The active node's label. */
  readonly title: string;
  /** The active node's statement — the knowledge itself. `null` when it carries none. */
  readonly statement: string | null;
  readonly lifecycleStatus: KnowledgeLifecycleStatus | null;
  /** Authoritative vs provisional. NEVER defaulted. */
  readonly authorityClass: KnowledgeAuthorityClass | null;
  /** The health the record declares about itself. */
  readonly health: KnowledgeHealth | null;
  /** Whether a ratification is actually recorded — not inferred from lifecycle. */
  readonly ratified: boolean;
  readonly ratifiedAt: string | null;
  readonly effectiveFrom: string | null;
  readonly effectiveUntil: string | null;
  readonly nextReviewAt: string | null;
  /** The active node's own version counter (`knowledge_version`). */
  readonly knowledgeVersion: number;
  /** The fact's selection version (`fact_version`) — how many times its active node has moved. */
  readonly factVersion: number;
  /** Derived only from the timestamps above. `unknown` when they are absent. */
  readonly freshness: KnowledgeFreshness;
}

/**
 * A knowledge fact whose selected active node is missing or unresolved. The fact identity is
 * real; the content is not readable. Kept as its own shape so a partial record can never be
 * presented as a readable source.
 */
export interface KnowledgeSourceStub {
  readonly factId: string;
  readonly factKey: string;
  readonly domainKey: string;
  readonly scope: KnowledgeScope;
  /** Why the content is not readable. */
  readonly reason: "active-node-missing";
}

/** Why a Knowledge read could not be performed. Each names the missing thing exactly. */
export type KnowledgeUnavailableReason =
  /** No authorized tenant context — the read failed closed and touched nothing. */
  | "no-authorized-tenant-context"
  /** The durable control-plane database is not configured. */
  | "persistence-not-configured"
  /** The query itself failed. */
  | "read-failed";

/** The result of listing the knowledge a tenant actually has. */
export type KnowledgeListing =
  | {
      readonly status: "read";
      /** Readable knowledge records, tenant-scoped. Empty when the tenant has none. */
      readonly records: readonly KnowledgeSourceRecord[];
      /** Facts whose active node is missing. Never merged into `records`. */
      readonly incomplete: readonly KnowledgeSourceStub[];
      /** True when the listing was capped; the operator is told rather than misled. */
      readonly truncated: boolean;
    }
  | {
      readonly status: "unavailable";
      readonly reason: KnowledgeUnavailableReason;
      readonly detail?: string;
    };

/** The result of reading ONE named knowledge source. */
export type KnowledgeSourceRead =
  | { readonly status: "found"; readonly record: KnowledgeSourceRecord }
  /**
   * The name matched several facts across different domains/scopes. The candidates are
   * returned so the operator can disambiguate — one is never silently picked.
   */
  | { readonly status: "ambiguous"; readonly candidates: readonly KnowledgeSourceRecord[] }
  /** The name matched a fact whose active node is unreadable. */
  | { readonly status: "incomplete"; readonly stub: KnowledgeSourceStub }
  /** No fact with that name exists FOR THIS TENANT. A foreign fact is indistinguishable. */
  | { readonly status: "not-found" }
  | {
      readonly status: "unavailable";
      readonly reason: KnowledgeUnavailableReason;
      readonly detail?: string;
    };

/**
 * The provenance line that travels with every Knowledge result. It states the authority, the
 * derivation class, and — critically — the PRECEDENCE rule: settled knowledge describes its own
 * subject, and never describes what the runtime is doing now.
 */
export const KNOWLEDGE_PROVENANCE =
  "Canonical Knowledge authority (knowledge_facts → knowledge_nodes), tenant-scoped and read-only. " +
  "It is settled organizational knowledge about its own subject — it is NOT a statement of current " +
  "runtime, operational, or execution state, and it never overrides a live read model.";

/**
 * Derive freshness from the record's own timestamps. Pure, and honest by construction: with no
 * timestamps there is no freshness, and `unknown` is returned rather than a flattering guess.
 */
export function deriveKnowledgeFreshness(
  input: {
    readonly effectiveFrom: string | null;
    readonly effectiveUntil: string | null;
    readonly nextReviewAt: string | null;
  },
  now: Date,
): KnowledgeFreshness {
  const at = now.getTime();
  const parse = (value: string | null): number | null => {
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const effectiveFrom = parse(input.effectiveFrom);
  if (effectiveFrom !== null && effectiveFrom > at) return "not-yet-effective";

  const effectiveUntil = parse(input.effectiveUntil);
  if (effectiveUntil !== null && effectiveUntil < at) return "expired";

  const nextReview = parse(input.nextReviewAt);
  if (nextReview === null) return "unknown";
  return nextReview < at ? "review-overdue" : "within-cadence";
}
