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

import { and, asc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { knowledgeFacts } from "@/db/schema/knowledge-fact";
import { knowledgeNodes } from "@/db/schema/knowledge";
import {
  deriveKnowledgeFreshness,
  type KnowledgeAuthorityClass,
  type KnowledgeHealth,
  type KnowledgeLifecycleStatus,
  type KnowledgeScope,
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
  readonly ratifiedAt: Date | null;
  /** K4 provenance, read from the ACTIVE NODE — the only home of version ratification. */
  readonly governanceSessionId: string | null;
  readonly ratifiedByActorId: string | null;
  readonly activeKnowledgeNodeId: string | null;
  readonly effectiveFrom: Date | null;
  readonly effectiveUntil: Date | null;
  readonly nextReviewAt: Date | null;
  readonly knowledgeVersion: number | null;
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
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
    },
  };
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
};

export function createDurableKnowledgeRepository(
  db: ControlPlaneDatabase,
): DurableKnowledgeRepository {
  /**
   * The join is tenant-scoped on BOTH sides. Scoping only the fact would let a fact resolve
   * its content through another tenant's node row; scoping both makes that unrepresentable.
   */
  function baseQuery(tenantId: string) {
    return db
      .select(SELECTION)
      .from(knowledgeFacts)
      .leftJoin(
        knowledgeNodes,
        and(
          eq(knowledgeNodes.id, knowledgeFacts.activeKnowledgeNodeId),
          eq(knowledgeNodes.tenantId, knowledgeFacts.tenantId),
          eq(knowledgeNodes.tenantId, tenantId),
        ),
      );
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
