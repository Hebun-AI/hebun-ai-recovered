/*
 * knowledge/durable-knowledge-repository.server.ts — the tenant-scoped, READ-ONLY repository
 * over the EXISTING canonical Knowledge tables (Knowledge Source Expansion K1).
 *
 * THIS IS NOT A SECOND KNOWLEDGE SYSTEM. It creates no table, no index, no store, no cache,
 * and no model. It reuses the R1 control-plane Drizzle/Postgres infrastructure — the same
 * schema, the same driver, the same authored migrations — to read the canonical Knowledge
 * model that already exists: `knowledge_facts` (fact identity + active-node selection) joined
 * to `knowledge_nodes` (the knowledge content and its governance metadata). K1 adds the FIRST
 * application read path over them; it adds no write path of any kind.
 *
 * TENANT SAFETY. Every statement is scoped by `tenant_id`, and the tenant id comes only from
 * an already-resolved server-side TenantContext — never from the client. The join to the
 * active node is itself tenant-scoped, so a fact can never resolve its content through another
 * tenant's row. A fact key belonging to another tenant is indistinguishable from one that does
 * not exist: both are simply absent from the result.
 *
 * Fail-closed: no in-memory fallback, no seeded substitute. When the database is absent the
 * caller gets `null` and says so.
 *
 * Server-only. Not re-exported from any client-importable index.
 */

import { and, asc, eq, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { knowledgeFacts } from "@/db/schema/knowledge-fact";
import { knowledgeNodes } from "@/db/schema/knowledge";
import {
  RETRIEVAL_CANDIDATE_POOL,
  TURKISH_FOLD_FROM,
  TURKISH_FOLD_TO,
  foldSql,
} from "@/features/knowledge-retrieval";
import {
  deriveKnowledgeFreshness,
  type KnowledgeAuthorityClass,
  type KnowledgeHealth,
  type KnowledgeLifecycleStatus,
  type KnowledgeRecordProvenance,
  type KnowledgeScope,
  type KnowledgeSourceAttribution,
  type KnowledgeSourceRecord,
  type KnowledgeSourceStub,
} from "./contracts";

/**
 * How many facts a single listing may return. A bound, not a filter: the caller is told when
 * the result was capped rather than being shown a silently partial list as if it were whole.
 */
export const KNOWLEDGE_LISTING_LIMIT = 50;

/** The minimal server-side authority projection this repository needs. */
export interface KnowledgeScopeContext {
  readonly tenantId: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One row of the canonical fact → active node join. */
interface KnowledgeRow {
  readonly factId: string;
  readonly factVersion: number;
  readonly factKey: string;
  readonly domainKey: string;
  readonly scope: string;
  readonly nodeLabel: string | null;
  readonly statement: string | null;
  readonly lifecycleStatus: string | null;
  readonly authorityClass: string | null;
  readonly health: string | null;
  readonly ratificationDecisionId: string | null;
  readonly ratifiedAt: Date | string | null;
  /** K4 provenance, read from the ACTIVE NODE — the only home of version ratification. */
  readonly governanceSessionId: string | null;
  readonly ratifiedByActorId: string | null;
  readonly activeKnowledgeNodeId: string | null;
  readonly effectiveFrom: Date | string | null;
  readonly effectiveUntil: Date | string | null;
  readonly nextReviewAt: Date | string | null;
  readonly knowledgeVersion: number | null;
  /*
   * KR4. `jsonb`, so the row type is honestly `unknown` — whatever was written is what comes back.
   * Every field is type-checked on the way out rather than trusted on the way in.
   */
  readonly provenance: unknown;
  readonly sourceAttribution: unknown;
}

/**
 * Normalize a timestamp column to ISO text.
 *
 * TWO ROW SOURCES REACH THIS, AND THEY DISAGREE. The Drizzle query builder hands back `Date`
 * objects; `db.execute()` of raw SQL hands back the driver's strings, because Drizzle installs its
 * own timestamp parsers and only converts inside the builder. The retrieval statement is raw SQL, so
 * assuming `Date` here threw `value.toISOString is not a function` and surfaced as a `read-failed`
 * retrieval — a shared projector has to accept both shapes rather than trust the caller's.
 */
function iso(value: Date | string | null): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

/* ── KR4: jsonb → typed, defensively ───────────────────────────────────────
 *
 * These columns are `jsonb` and therefore hold whatever was written. Every field is read through a
 * type check and falls to `null` when it is absent or the wrong shape. NOTHING IS DEFAULTED: a
 * record with no recorded source title gets `null`, never a placeholder, because a synthesized
 * attribution would claim an origin the organization never recorded.
 */

function jsonObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function jsonText(bag: Record<string, unknown>, key: string): string | null {
  const value = bag[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function jsonCount(bag: Record<string, unknown>, key: string): number | null {
  const value = bag[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toProvenance(value: unknown): KnowledgeRecordProvenance | null {
  const bag = jsonObject(value);
  if (!bag) return null;
  return {
    origin: jsonText(bag, "origin"),
    authoredThrough: jsonText(bag, "authoredThrough"),
    submittedAt: iso(jsonText(bag, "submittedAt")),
    /*
     * Absent means UNVERIFIED, not verified. The flag exists to stop Hebun implying it checked who
     * wrote the text, so a missing value must fail toward the honest side.
     */
    textOriginUnverified: bag.textOriginUnverified !== false,
    sourceType: jsonText(bag, "sourceType"),
    chunkIndex: jsonCount(bag, "chunkIndex"),
    chunkCount: jsonCount(bag, "chunkCount"),
  };
}

function toSourceAttribution(value: unknown): KnowledgeSourceAttribution | null {
  const bag = jsonObject(value);
  if (!bag) return null;
  return {
    sourceTitle: jsonText(bag, "sourceTitle"),
    sourceType: jsonText(bag, "sourceType"),
    ingestedByActorType: jsonText(bag, "ingestedByActorType"),
    ingestedByActorId: jsonText(bag, "ingestedByActorId"),
    ingestedAt: iso(jsonText(bag, "ingestedAt")),
  };
}

/**
 * Narrow a database text value to a canonical union member, or `null`. A value the schema does
 * not declare is reported as absent rather than passed through as if it were canonical.
 */
function asMember<T extends string>(
  value: string | null,
  members: readonly T[],
): T | null {
  if (!value) return null;
  return (members as readonly string[]).includes(value) ? (value as T) : null;
}

const LIFECYCLE_STATUSES: readonly KnowledgeLifecycleStatus[] = [
  "draft",
  "proposed",
  "under-review",
  "ratified",
  "superseded",
  "deprecated",
  "retired",
  "archived",
];
const AUTHORITY_CLASSES: readonly KnowledgeAuthorityClass[] = ["authoritative", "provisional"];
const HEALTHS: readonly KnowledgeHealth[] = ["unknown", "current", "stale", "contested"];
const SCOPES: readonly KnowledgeScope[] = ["company-wide", "department", "domain"];

/**
 * Project one joined row into either a readable record or an honest stub. A fact whose active
 * node is missing NEVER becomes a record with an invented title.
 */
function toRecordOrStub(
  row: KnowledgeRow,
  now: Date,
): { readonly record: KnowledgeSourceRecord } | { readonly stub: KnowledgeSourceStub } {
  // The scope column is a canonical enum; a value outside it means the row is not projectable.
  const scope = asMember(row.scope, SCOPES) ?? "company-wide";

  if (!row.nodeLabel) {
    return {
      stub: {
        factId: row.factId,
        factKey: row.factKey,
        domainKey: row.domainKey,
        scope,
        reason: "active-node-missing",
      },
    };
  }

  const effectiveFrom = iso(row.effectiveFrom);
  const effectiveUntil = iso(row.effectiveUntil);
  const nextReviewAt = iso(row.nextReviewAt);

  return {
    record: {
      factId: row.factId,
      factVersion: row.factVersion,
      factKey: row.factKey,
      domainKey: row.domainKey,
      scope,
      title: row.nodeLabel,
      statement: row.statement,
      lifecycleStatus: asMember(row.lifecycleStatus, LIFECYCLE_STATUSES),
      authorityClass: asMember(row.authorityClass, AUTHORITY_CLASSES),
      health: asMember(row.health, HEALTHS),
      /*
       * Ratification is a RECORDED fact, never inferred from lifecycle status — and after K4 it
       * requires the GOVERNANCE LINKAGE, not merely a timestamp.
       *
       * This read used to be `ratificationDecisionId ?? ratifiedAt`. That was a reasonable
       * shortcut while no ratification runtime existed and both columns were always NULL; it is
       * false now. A `ratified_at` with no `ratification_decision_id` would be a row claiming the
       * organization approved something with no decision behind it, which is exactly the state K4
       * exists to make impossible. Requiring the decision id means "ratified" can only be true
       * downstream of a real Governance decision.
       */
      ratified: Boolean(row.ratificationDecisionId),
      ratifiedAt: iso(row.ratifiedAt),
      ratificationDecisionId: row.ratificationDecisionId,
      governanceSessionId: row.governanceSessionId,
      ratifiedByActorId: row.ratifiedByActorId,
      activeKnowledgeNodeId: row.activeKnowledgeNodeId,
      effectiveFrom,
      effectiveUntil,
      nextReviewAt,
      knowledgeVersion: row.knowledgeVersion ?? 1,
      freshness: deriveKnowledgeFreshness(
        { effectiveFrom, effectiveUntil, nextReviewAt },
        now,
      ),
      provenance: toProvenance(row.provenance),
      sourceAttribution: toSourceAttribution(row.sourceAttribution),
    },
  };
}

/* ── KR3 retrieval ──────────────────────────────────────────────────────────
 *
 * ONE new statement, over the SAME tenant-scoped active-node join the listing already uses. There is
 * no retrieval table, no search table, no cache table, no embedding table, and no second repository —
 * retrieval is a different WHERE clause and an ORDER BY, not a different system.
 *
 * THE TENANT PREDICATE IS APPLIED IN SQL, BEFORE ANY RANKING. A cross-tenant row is never a
 * candidate, never scored, and never reaches the ranking layer where a cap or a filter might be the
 * only thing standing between it and an answer.
 */

/** The searchable text. Title AND statement — KR2 measured statement-only at 43.5% R@1 vs 69.6%. */
const SEARCH_TEXT = `(coalesce("knowledge_nodes"."label", '') || ' ' || coalesce("knowledge_nodes"."statement", ''))`;

/**
 * The lexical representation, folded with a BUILT-IN.
 *
 * `translate()` — not `unaccent` — because the canonical database has no extensions installed and
 * this is measurably identical on Turkish (KR2/KR3: same Recall@1/3/5, MRR, zero-result and
 * distractor rate on the same corpus). It is also IMMUTABLE, so this exact expression can back a GIN
 * index later without the wrapper `unaccent` would have required.
 */
const SEARCH_VECTOR = `to_tsvector('turkish', ${foldSql(SEARCH_TEXT)})`;

/** One scored candidate row, before eligibility and ranking run over it. */
export interface KnowledgeSearchRow {
  readonly record: KnowledgeSourceRecord;
  /** Raw `ts_rank_cd`. Unbounded — the pure ranking layer squashes it. */
  readonly lexicalRank: number;
  /** `word_similarity` when `pg_trgm` is installed, else `null`. Never a substituted zero. */
  readonly trigram: number | null;
}

export interface KnowledgeSearchNarrowing {
  readonly domainKey?: string;
  readonly scope?: KnowledgeScope;
}

export interface DurableKnowledgeRepository {
  /** Every knowledge fact the tenant owns, bounded. Never another tenant's. */
  listFacts(
    scope: KnowledgeScopeContext,
    now?: Date,
  ): Promise<{
    readonly records: readonly KnowledgeSourceRecord[];
    readonly incomplete: readonly KnowledgeSourceStub[];
    readonly truncated: boolean;
  }>;
  /**
   * Every fact matching this key within the tenant. A key may exist in more than one
   * domain/scope, so this returns ALL matches and lets the caller disambiguate — it never
   * silently picks one.
   */
  findFactsByKey(
    scope: KnowledgeScopeContext,
    factKey: string,
    now?: Date,
  ): Promise<{
    readonly records: readonly KnowledgeSourceRecord[];
    readonly incomplete: readonly KnowledgeSourceStub[];
  }>;
  /**
   * Candidate facts whose text matches `orQuery`, scored, tenant-scoped, bounded.
   *
   * `orQuery` is an already-normalized OR form (see `knowledge-retrieval/query-normalization`); this
   * method does not parse or rewrite a human's question. Eligibility is NOT applied here — the caller
   * partitions the rows so a matched-but-withdrawn record can be reported rather than vanish.
   */
  searchFacts(
    scope: KnowledgeScopeContext,
    orQuery: string,
    rawQuery: string,
    now?: Date,
    narrowing?: KnowledgeSearchNarrowing,
  ): Promise<{
    readonly rows: readonly KnowledgeSearchRow[];
    readonly incomplete: readonly KnowledgeSourceStub[];
    readonly truncated: boolean;
    /** Whether the trigram component could be computed at all in this database. */
    readonly trigramAvailable: boolean;
  }>;
  /** True when `pg_trgm` is installed in the CONNECTED database. Cached per repository instance. */
  hasTrigram(): Promise<boolean>;
  /**
   * One row per `domain_key` this tenant holds, with the facts in it bucketed by standing (R6B).
   *
   * ── WHY THIS EXISTS RATHER THAN COUNTING `listFacts` ─────────────────────────
   *
   * `listFacts` is BOUNDED at {@link KNOWLEDGE_LISTING_LIMIT} and ordered by `(domain_key,
   * fact_key)`. Counting over it would silently lose the alphabetically LAST domains first, so a
   * tenant past the bound would be told an area it has covered is missing — a false negative in
   * the one claim a coverage view makes. Two ingested sources reach the bound
   * (`MAX_CHUNKS_PER_SOURCE` is 40).
   *
   * Raising the listing bound was the other option and is wrong: `MAX_CHUNKS_PER_SOURCE` was
   * chosen against it and Heby's evidence cap mirrors it, so widening it here would silently widen
   * the model's context. This returns one row PER DOMAIN instead of per fact, so it needs no bound
   * at all.
   *
   * It is a second STATEMENT over the same join, never a second authority: no table, no cache, no
   * rollup, no write, no transaction.
   */
  countFactsByDomain(
    scope: KnowledgeScopeContext,
    now?: Date,
  ): Promise<readonly KnowledgeDomainCounts[]>;
  /**
   * One row per INGESTION SOURCE this tenant still holds live Knowledge from (R6D).
   *
   * Grouped by `provenance->>'sourceDigest'`, which ingestion writes identically onto every chunk of
   * one source and hand-authored Knowledge never writes at all — so a single fact authored by hand
   * cannot appear here, and cannot be retracted by a source-level act.
   *
   * A CONTENT identity, not an upload identity. Hebun retains no record that a file was received,
   * so the same bytes ingested twice under two titles share one digest and appear as ONE source
   * carrying both titles. That is the honest reading of what is stored, and it is also the more
   * useful one: retracting the content withdraws both copies.
   *
   * Read-only, tenant-scoped, and uncapped for the same reason the domain counts are.
   */
  listIngestedSources(scope: KnowledgeScopeContext): Promise<readonly IngestedSourceSummary[]>;
  /**
   * Every CURRENT, in-force Knowledge version this tenant holds, as an identity and an authoring
   * instant (KGA).
   *
   * ── IT ANSWERS ABOUT KNOWLEDGE AND NOTHING ELSE ──────────────────────────────
   *
   * It does NOT know what a Governance decision is, does not read `decision_records`, and does not
   * filter on `ratification_decision_id`. "Which of these has been decided" belongs to Governance
   * and is asked separately; a join here would put half of Governance's question inside Knowledge's
   * repository and make the answer unattributable to either owner.
   *
   * The population rule is the SAME in-force predicate {@link countFactsByDomain} already uses —
   * readable, not archived or retired, inside its effective window — so "current version" means
   * exactly one thing across this repository rather than two things that agree by accident.
   *
   * Uncapped, for R6B's reason restated: a bound that is correct for a list is silently wrong for
   * a set the caller is going to subtract from. Dropping rows here would report versions as decided
   * that nobody has looked at.
   *
   * Read-only, tenant-scoped through {@link activeNodeJoin}. No statement, label, domain, scope or
   * provenance is returned — a caller that cannot receive content cannot leak it.
   */
  listCurrentVersions(
    scope: KnowledgeScopeContext,
    now?: Date,
  ): Promise<readonly CurrentKnowledgeVersion[]>;
}

/**
 * One current Knowledge version, reduced to what a review observation legitimately needs.
 *
 * TWO FIELDS, AND THE ABSENCE OF THE OTHERS IS THE POINT. There is no statement, no label, no
 * domain key and no provenance, because the only consumer counts these and measures one duration.
 * A field that carried content would be a field somebody renders.
 */
export interface CurrentKnowledgeVersion {
  /** The `knowledge_nodes` row id — the exact version a Governance decision would name. */
  readonly nodeId: string;
  /** `knowledge_nodes.created_at` as ISO — when this version was authored. */
  readonly authoredAt: string | null;
}

/** One ingestion source, as the retraction surface sees it. */
export interface IngestedSourceSummary {
  /** The full sha256 of the normalized source text, as ingestion recorded it. */
  readonly sourceDigest: string;
  /** Every title this content was ingested under, ascending. Usually one. */
  readonly sourceTitles: readonly string[];
  /** Facts whose active node still carries this digest and is NOT yet retired. */
  readonly liveFactCount: number;
  /** Of those, how many carry a bound Governance ratification. */
  readonly ratifiedFactCount: number;
  /** Facts from this source already withdrawn — reported so a partial state is visible. */
  readonly retiredFactCount: number;
  /** The most recent `updated_at` across the source's active nodes. */
  readonly lastUpdatedAt: string | null;
}

/**
 * The facts in ONE `domain_key`, bucketed by standing.
 *
 * ── THE BUCKETS, AND WHICH OVERLAP ───────────────────────────────────────────
 *
 * `inForce`, `notYetEffective`, `expired`, `withdrawn` and `unreadable` are MUTUALLY EXCLUSIVE and
 * together account for every fact in the domain. Nothing is dropped: a fact Hebun cannot serve is
 * still a fact the organization supplied, and a count that quietly omitted it would understate
 * what Hebun holds.
 *
 * `ratified`, `provisional` and `reviewOverdue` are SUBSETS of `inForce`, not additional buckets.
 * They describe the standing of servable facts and must never be added to a total.
 */
export interface KnowledgeDomainCounts {
  readonly domainKey: string;
  /** Eligible AND readable — the only bucket that establishes coverage. */
  readonly inForce: number;
  /** Subset of `inForce`: carries a bound Governance decision (K4). */
  readonly ratified: number;
  /** Subset of `inForce`: `knowledge_authority` is not `authoritative`. */
  readonly provisional: number;
  /** Subset of `inForce`: `next_review_at` has passed — the freshness `review-overdue`. */
  readonly reviewOverdue: number;
  /** Excluded: `effective_from` is in the future. */
  readonly notYetEffective: number;
  /** Excluded: `effective_until` has passed. */
  readonly expired: number;
  /** Excluded: lifecycle is `archived` or `retired`. */
  readonly withdrawn: number;
  /** Excluded: the fact's active node did not resolve, so it carries no readable statement. */
  readonly unreadable: number;
}

const SELECTION = {
  factId: knowledgeFacts.id,
  factVersion: knowledgeFacts.factVersion,
  factKey: knowledgeFacts.factKey,
  domainKey: knowledgeFacts.domainKey,
  scope: knowledgeFacts.knowledgeScope,
  nodeLabel: knowledgeNodes.label,
  statement: knowledgeNodes.statement,
  lifecycleStatus: knowledgeNodes.knowledgeLifecycleStatus,
  authorityClass: knowledgeNodes.knowledgeAuthority,
  health: knowledgeNodes.knowledgeHealth,
  ratificationDecisionId: knowledgeNodes.ratificationDecisionId,
  ratifiedAt: knowledgeNodes.ratifiedAt,
  governanceSessionId: knowledgeNodes.governanceSessionId,
  ratifiedByActorId: knowledgeNodes.ratifiedByActorId,
  activeKnowledgeNodeId: knowledgeNodes.id,
  effectiveFrom: knowledgeNodes.effectiveFrom,
  effectiveUntil: knowledgeNodes.effectiveUntil,
  nextReviewAt: knowledgeNodes.nextReviewAt,
  knowledgeVersion: knowledgeNodes.knowledgeVersion,
  /*
   * KR4. Two columns that have been written since K2 and read by nobody on this path. No new
   * column, no migration, no writer change — the same row, projected further.
   */
  provenance: knowledgeNodes.provenance,
  sourceAttribution: knowledgeNodes.sourceAttribution,
};

export function createDurableKnowledgeRepository(
  db: ControlPlaneDatabase,
): DurableKnowledgeRepository {
  /*
   * Whether `pg_trgm` exists in THIS database, probed once and remembered. An extension cannot be
   * installed or removed under a running request, so re-asking on every retrieval would be a query
   * per search to learn something that does not change. `undefined` means "not yet asked".
   */
  let trigramCache: boolean | undefined;

  /**
   * The active-node join condition, tenant-scoped on BOTH sides.
   *
   * Scoping only the fact would let a fact resolve its content through another tenant's node row;
   * scoping both makes that unrepresentable. Extracted so every statement in this repository shares
   * ONE expression — a second query that restated the predicate could drift from this one by a
   * single clause and leak, which is exactly the failure a copy invites.
   */
  function activeNodeJoin(tenantId: string) {
    return and(
      eq(knowledgeNodes.id, knowledgeFacts.activeKnowledgeNodeId),
      eq(knowledgeNodes.tenantId, knowledgeFacts.tenantId),
      eq(knowledgeNodes.tenantId, tenantId),
    );
  }

  function baseQuery(tenantId: string) {
    return db.select(SELECTION).from(knowledgeFacts).leftJoin(knowledgeNodes, activeNodeJoin(tenantId));
  }

  function partition(rows: readonly KnowledgeRow[], now: Date) {
    const records: KnowledgeSourceRecord[] = [];
    const incomplete: KnowledgeSourceStub[] = [];
    for (const row of rows) {
      const projected = toRecordOrStub(row, now);
      if ("record" in projected) records.push(projected.record);
      else incomplete.push(projected.stub);
    }
    return { records, incomplete };
  }

  return {
    async listFacts(scope, now = new Date()) {
      // An id that is not a uuid can never match a tenant column; refuse before querying.
      if (!UUID_RE.test(scope.tenantId)) {
        return { records: [], incomplete: [], truncated: false };
      }
      const rows = (await baseQuery(scope.tenantId)
        .where(eq(knowledgeFacts.tenantId, scope.tenantId))
        .orderBy(asc(knowledgeFacts.domainKey), asc(knowledgeFacts.factKey))
        // One extra row is fetched purely to detect truncation honestly.
        .limit(KNOWLEDGE_LISTING_LIMIT + 1)) as readonly KnowledgeRow[];

      const truncated = rows.length > KNOWLEDGE_LISTING_LIMIT;
      const page = truncated ? rows.slice(0, KNOWLEDGE_LISTING_LIMIT) : rows;
      return { ...partition(page, now), truncated };
    },

    async findFactsByKey(scope, factKey, now = new Date()) {
      if (!UUID_RE.test(scope.tenantId)) return { records: [], incomplete: [] };
      const key = factKey.trim();
      if (!key) return { records: [], incomplete: [] };

      const rows = (await baseQuery(scope.tenantId)
        .where(and(eq(knowledgeFacts.tenantId, scope.tenantId), eq(knowledgeFacts.factKey, key)))
        .orderBy(asc(knowledgeFacts.domainKey))
        .limit(KNOWLEDGE_LISTING_LIMIT)) as readonly KnowledgeRow[];

      return partition(rows, now);
    },

    async hasTrigram() {
      if (trigramCache === undefined) {
        try {
          const probe = await db.execute<{ present: boolean }>(
            sql`select exists (select 1 from pg_extension where extname = 'pg_trgm') as present`,
          );
          trigramCache = Boolean(probe.rows[0]?.present);
        } catch {
          // A probe that cannot run is not evidence the extension is present.
          trigramCache = false;
        }
      }
      return trigramCache;
    },

    async searchFacts(scope, orQuery, rawQuery, now = new Date(), narrowing = {}) {
      const empty = { rows: [], incomplete: [], truncated: false, trigramAvailable: false } as const;
      if (!UUID_RE.test(scope.tenantId)) return empty;
      const query = orQuery.trim();
      if (!query) return empty;

      const trigram = await this.hasTrigram();

      /*
       * `word_similarity(query, document)` — NOT `similarity()`. Plain similarity divides by the
       * union of both trigram sets, so a short question against a long policy scores near zero
       * however well it matches. When the extension is absent the column is a literal NULL: the
       * component was NOT COMPUTED, and a substituted 0 would be indistinguishable from a real
       * "no similarity", which is exactly the kind of quiet fabrication this codebase forbids.
       */
      const trigramExpr = trigram
        ? sql`word_similarity(
             lower(translate(${rawQuery}, ${TURKISH_FOLD_FROM}, ${TURKISH_FOLD_TO})),
             lower(${sql.raw(foldSql(SEARCH_TEXT))}))`
        : sql`null::real`;

      /* Narrowing hints can only SHRINK the candidate set; there is no branch that widens it. */
      const domainFilter = narrowing.domainKey?.trim()
        ? sql`and "knowledge_facts"."domain_key" = ${narrowing.domainKey.trim()}`
        : sql``;
      const scopeFilter = narrowing.scope
        ? sql`and "knowledge_facts"."knowledge_scope" = ${narrowing.scope}::knowledge_scope`
        : sql``;

      const vector = sql.raw(SEARCH_VECTOR);
      const tsquery = sql`websearch_to_tsquery('turkish', ${query})`;

      /*
       * KR4 note, kept OUTSIDE the template on purpose — a backtick inside a sql`` literal closes
       * it, which is a syntax error rather than a query bug and costs a debugging cycle to find.
       *
       * This statement carries its OWN column list rather than the shared SELECTION constant, so
       * widening the listing projection did NOT widen this one — and this is the path that feeds
       * Heby's answers. The two provenance columns below are existing columns written since K2:
       * no new column, no migration, no writer change.
       */

      const statement = sql`
        select
          "knowledge_facts"."id"                            as "factId",
          "knowledge_facts"."fact_version"                  as "factVersion",
          "knowledge_facts"."fact_key"                      as "factKey",
          "knowledge_facts"."domain_key"                    as "domainKey",
          "knowledge_facts"."knowledge_scope"::text         as "scope",
          "knowledge_nodes"."label"                         as "nodeLabel",
          "knowledge_nodes"."statement"                     as "statement",
          "knowledge_nodes"."knowledge_lifecycle_status"::text as "lifecycleStatus",
          "knowledge_nodes"."knowledge_authority"::text     as "authorityClass",
          "knowledge_nodes"."knowledge_health"::text        as "health",
          "knowledge_nodes"."ratification_decision_id"      as "ratificationDecisionId",
          "knowledge_nodes"."ratified_at"                   as "ratifiedAt",
          "knowledge_nodes"."governance_session_id"         as "governanceSessionId",
          "knowledge_nodes"."ratified_by_actor_id"          as "ratifiedByActorId",
          "knowledge_nodes"."id"                            as "activeKnowledgeNodeId",
          "knowledge_nodes"."effective_from"                as "effectiveFrom",
          "knowledge_nodes"."effective_until"               as "effectiveUntil",
          "knowledge_nodes"."next_review_at"                as "nextReviewAt",
          "knowledge_nodes"."knowledge_version"             as "knowledgeVersion",
          "knowledge_nodes"."provenance"                    as "provenance",
          "knowledge_nodes"."source_attribution"            as "sourceAttribution",
          ts_rank_cd(${vector}, ${tsquery})                 as "lexicalRank",
          ${trigramExpr}                                    as "trigram"
        from "knowledge_facts"
        join "knowledge_nodes"
          on "knowledge_nodes"."id" = "knowledge_facts"."active_knowledge_node_id"
         and "knowledge_nodes"."tenant_id" = "knowledge_facts"."tenant_id"
         and "knowledge_nodes"."tenant_id" = ${scope.tenantId}
        where "knowledge_facts"."tenant_id" = ${scope.tenantId}
          and "knowledge_facts"."deleted_at" is null
          and "knowledge_nodes"."deleted_at" is null
          ${domainFilter}
          ${scopeFilter}
          and ${vector} @@ ${tsquery}
        order by "lexicalRank" desc,
                 "knowledge_facts"."domain_key" asc,
                 "knowledge_facts"."fact_key" asc
        limit ${RETRIEVAL_CANDIDATE_POOL + 1}`;

      const executed = await db.execute(statement);
      const all = executed.rows as unknown as ReadonlyArray<
        KnowledgeRow & { readonly lexicalRank: unknown; readonly trigram: unknown }
      >;
      const truncated = all.length > RETRIEVAL_CANDIDATE_POOL;
      const page = truncated ? all.slice(0, RETRIEVAL_CANDIDATE_POOL) : all;

      const rows: KnowledgeSearchRow[] = [];
      const incomplete: KnowledgeSourceStub[] = [];
      for (const row of page) {
        const projected = toRecordOrStub(row, now);
        if ("record" in projected) {
          rows.push({
            record: projected.record,
            lexicalRank: Number(row.lexicalRank) || 0,
            trigram: row.trigram === null ? null : Number(row.trigram),
          });
        } else {
          incomplete.push(projected.stub);
        }
      }

      return { rows, incomplete, truncated, trigramAvailable: trigram };
    },

    /*
     * ── ONE ROW PER DOMAIN, UNBOUNDED (R6B) ──────────────────────────────────
     *
     * The join is `activeNodeJoin` — the SAME expression `baseQuery` uses, not a copy of it — so
     * this statement inherits the tenant boundary rather than restating it.
     *
     * The buckets below reproduce `exclusionReasonFor` and `deriveKnowledgeFreshness` IN THE SAME
     * ORDER: unreadable, then withdrawn lifecycle, then the effective window (from before until,
     * exactly as the pure functions check them), then review cadence within what is in force. That
     * duplication is the cost of counting in the database instead of fetching every row, and it is
     * held honest by a test that runs both against the same seeded matrix and asserts they agree —
     * a comment promising they match would rot, an equivalence test cannot.
     */
    async countFactsByDomain(scope, now = new Date()) {
      // An id that is not a uuid can never match a tenant column; refuse before querying.
      if (!UUID_RE.test(scope.tenantId)) return [];

      const at = sql`${now.toISOString()}::timestamptz`;

      /* Readable at all: a fact whose active node did not resolve carries no statement. */
      const readable = sql`${knowledgeNodes.label} is not null`;
      /*
       * `is distinct from` rather than `<>` on purpose: `knowledge_lifecycle_status` is nullable,
       * and a NULL lifecycle is NOT terminal — the same reading `exclusionReasonFor` gives it.
       */
      const live = sql`${readable}
        and ${knowledgeNodes.knowledgeLifecycleStatus} is distinct from 'archived'
        and ${knowledgeNodes.knowledgeLifecycleStatus} is distinct from 'retired'`;
      /* A record with no window makes no claim about one; absent dates never exclude. */
      const started = sql`(${knowledgeNodes.effectiveFrom} is null or ${knowledgeNodes.effectiveFrom} <= ${at})`;
      const unexpired = sql`(${knowledgeNodes.effectiveUntil} is null or ${knowledgeNodes.effectiveUntil} >= ${at})`;
      const inForce = sql`${live} and ${started} and ${unexpired}`;

      const tally = (predicate: ReturnType<typeof sql>) =>
        sql<number>`count(*) filter (where ${predicate})::int`;

      const rows = await db
        .select({
          domainKey: knowledgeFacts.domainKey,
          inForce: tally(inForce),
          ratified: tally(sql`${inForce} and ${knowledgeNodes.ratificationDecisionId} is not null`),
          provisional: tally(
            sql`${inForce} and ${knowledgeNodes.knowledgeAuthority} is distinct from 'authoritative'`,
          ),
          reviewOverdue: tally(
            sql`${inForce} and ${knowledgeNodes.nextReviewAt} is not null and ${knowledgeNodes.nextReviewAt} < ${at}`,
          ),
          notYetEffective: tally(
            sql`${live} and ${knowledgeNodes.effectiveFrom} is not null and ${knowledgeNodes.effectiveFrom} > ${at}`,
          ),
          expired: tally(
            sql`${live} and ${started} and ${knowledgeNodes.effectiveUntil} is not null and ${knowledgeNodes.effectiveUntil} < ${at}`,
          ),
          withdrawn: tally(
            sql`${readable} and (${knowledgeNodes.knowledgeLifecycleStatus} is not distinct from 'archived'
                 or ${knowledgeNodes.knowledgeLifecycleStatus} is not distinct from 'retired')`,
          ),
          unreadable: tally(sql`${knowledgeNodes.label} is null`),
        })
        .from(knowledgeFacts)
        .leftJoin(knowledgeNodes, activeNodeJoin(scope.tenantId))
        .where(eq(knowledgeFacts.tenantId, scope.tenantId))
        .groupBy(knowledgeFacts.domainKey)
        .orderBy(asc(knowledgeFacts.domainKey));

      /* `::int` already narrowed each count; Number() guards a driver that returns text anyway. */
      return rows.map((row) => ({
        domainKey: row.domainKey,
        inForce: Number(row.inForce),
        ratified: Number(row.ratified),
        provisional: Number(row.provisional),
        reviewOverdue: Number(row.reviewOverdue),
        notYetEffective: Number(row.notYetEffective),
        expired: Number(row.expired),
        withdrawn: Number(row.withdrawn),
        unreadable: Number(row.unreadable),
      }));
    },

    /*
     * ── THE SOURCES A RETRACTION COULD TARGET (R6D) ──────────────────────────
     *
     * Same `activeNodeJoin`, so the tenant boundary is inherited rather than restated. The digest is
     * read out of `provenance` jsonb; `is not null` is what excludes hand-authored Knowledge, whose
     * provenance carries no `sourceDigest` key at all.
     *
     * Already-retired facts are COUNTED, not filtered. A source that is half withdrawn is a state an
     * operator needs to see, and hiding it would make a partially applied retraction look like it
     * never happened.
     */
    async listIngestedSources(scope) {
      if (!UUID_RE.test(scope.tenantId)) return [];

      const digest = sql<string>`${knowledgeNodes.provenance}->>'sourceDigest'`;
      const live = sql`${knowledgeNodes.knowledgeLifecycleStatus} is distinct from 'retired'
                       and ${knowledgeNodes.knowledgeLifecycleStatus} is distinct from 'archived'`;

      const rows = await db
        .select({
          sourceDigest: digest,
          sourceTitles: sql<string[]>`array_agg(distinct ${knowledgeNodes.provenance}->>'sourceTitle')`,
          liveFactCount: sql<number>`count(*) filter (where ${live})::int`,
          ratifiedFactCount: sql<number>`count(*) filter (where ${live} and ${knowledgeNodes.ratificationDecisionId} is not null)::int`,
          retiredFactCount: sql<number>`count(*) filter (where not (${live}))::int`,
          lastUpdatedAt: sql<string | null>`max(${knowledgeNodes.updatedAt})`,
        })
        .from(knowledgeFacts)
        .leftJoin(knowledgeNodes, activeNodeJoin(scope.tenantId))
        .where(and(eq(knowledgeFacts.tenantId, scope.tenantId), sql`${digest} is not null`))
        .groupBy(digest)
        .orderBy(asc(digest));

      return rows.map((row) => ({
        sourceDigest: row.sourceDigest,
        /* `array_agg(distinct …)` can carry a NULL when a chunk recorded no title. Drop it here. */
        sourceTitles: (row.sourceTitles ?? []).filter((title): title is string => Boolean(title)).sort(),
        liveFactCount: Number(row.liveFactCount),
        ratifiedFactCount: Number(row.ratifiedFactCount),
        retiredFactCount: Number(row.retiredFactCount),
        lastUpdatedAt: iso(row.lastUpdatedAt),
      }));
    },

    /*
     * ── THE CURRENT VERSIONS, WITHOUT ANY GOVERNANCE OPINION (KGA) ───────────
     *
     * `activeNodeJoin` is an INNER join here rather than a left join, because a fact whose active
     * version did not resolve has no version to decide about. That is the same reading `label is
     * not null` gives elsewhere, expressed as the join instead of as a filter.
     *
     * `ratification_decision_id` is deliberately NOT consulted. A rejected version carries no mark
     * in Knowledge — K4 writes nothing for a rejection, by design — so "unratified" and "undecided"
     * are different populations and this repository can only see the wrong one.
     */
    async listCurrentVersions(scope, now = new Date()) {
      if (!UUID_RE.test(scope.tenantId)) return [];

      const at = sql`${now.toISOString()}::timestamptz`;
      const rows = await db
        .select({ nodeId: knowledgeNodes.id, authoredAt: knowledgeNodes.createdAt })
        .from(knowledgeFacts)
        .innerJoin(knowledgeNodes, activeNodeJoin(scope.tenantId))
        .where(
          and(
            eq(knowledgeFacts.tenantId, scope.tenantId),
            sql`${knowledgeNodes.label} is not null`,
            sql`${knowledgeNodes.knowledgeLifecycleStatus} is distinct from 'archived'`,
            sql`${knowledgeNodes.knowledgeLifecycleStatus} is distinct from 'retired'`,
            sql`(${knowledgeNodes.effectiveFrom} is null or ${knowledgeNodes.effectiveFrom} <= ${at})`,
            sql`(${knowledgeNodes.effectiveUntil} is null or ${knowledgeNodes.effectiveUntil} >= ${at})`,
          ),
        );

      return rows.map((row) => ({ nodeId: String(row.nodeId), authoredAt: iso(row.authoredAt) }));
    },
  };
}

let singleton: DurableKnowledgeRepository | undefined;

/** Process-level durable Knowledge repository over the control-plane database. */
export function getDurableKnowledgeRepository(): DurableKnowledgeRepository {
  if (!singleton) singleton = createDurableKnowledgeRepository(getControlPlaneDb());
  return singleton;
}

/** True only when the control-plane database that holds the Knowledge tables is configured. */
export function isDurableKnowledgeConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env.DATABASE_URL?.trim());
}

/**
 * The production resolver: the durable repository when configured, or an honest `null` when it
 * is not. Never a seeded or in-memory impostor — the seeded knowledge-crud store exists in this
 * repository, and substituting it here is precisely the fabrication K1 forbids.
 */
export function resolveKnowledgeRepoOrNull(): DurableKnowledgeRepository | null {
  if (!isDurableKnowledgeConfigured()) return null;
  try {
    return getDurableKnowledgeRepository();
  } catch {
    return null;
  }
}
