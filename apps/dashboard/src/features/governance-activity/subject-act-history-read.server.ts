/*
 * governance-activity/subject-act-history-read.server.ts — the BOUNDED, ordered read over
 * `audit_log` FOR ONE SUBJECT (SUBJECT-ACT-HISTORY-1).
 *
 * ── WHAT CHANGED, AND WHAT DELIBERATELY DID NOT ──────────────────────────────
 *
 * Exactly one thing changed against R7.1.1's page reader: the WHERE clause gained two equalities.
 * The select list, the ordering, the bound, the independent total and the `null`-on-failure
 * contract are the released ones, unchanged, because a narrower question is not a licence to
 * widen an answer.
 *
 * ── WHY IT IS A THIRD FILE AND NOT A PARAMETER ───────────────────────────────
 *
 * `read.server.ts` carries a released, structurally-asserted property: it contains no bound
 * anywhere. `act-history-read.server.ts` carries a different one: its tenant predicate is a single
 * expression, so removing it breaks both of its statements at once and the isolation bite-proof
 * stays honest. Adding an OPTIONAL subject filter to that function would have made both of its
 * statements conditional, and a conditional predicate is exactly the shape a firewall cannot read:
 * "the tenant scope is one expression" would have become "the tenant scope is one expression on
 * whichever branch was taken".
 *
 * So the subject-scoped reader is its own file with its own unconditional predicate. Both files
 * state an absolute, each checkable in isolation, and neither had to be weakened for the other.
 *
 * ── THE SELECT LIST IS THE SECURITY BOUNDARY, AND NOW IT IS ALSO A VALUE ─────
 *
 * The same eight columns R7.1.1 named one by one. None of `metadata`, `previous_state`,
 * `next_state`, `entity_id`, `actor_id`, `correlation_id`, `causation_id`, `request_id`,
 * `session_context_id` or `principal_reference_hash` appears — and the withheld set is the SAME
 * released `WITHHELD_AUDIT_COLUMNS` R7.1.1's firewall already asserts against, not a second list.
 * Two lists is how two readers come to withhold different things while each looks correct alone.
 *
 * `entity_id` is the one worth stating out loud, because it is the one this phase had a reason to
 * want. It stays unselected: the caller SUPPLIED it, the WHERE clause guarantees every row matches
 * it, and echoing it back off the row would turn a filter into a disclosure the moment a future
 * caller passed a subject it had not already resolved.
 *
 * ── THIS IS A READER. IT IS NOT AN AUTHORITY ─────────────────────────────────
 *
 * `audit_log` remains the sole authority for recorded acts, written by the `governance-audit`
 * writers and by nothing else. This module issues `select` and nothing else: no insert, no update,
 * no delete, no transaction. It owns no table, no row, no cache and no state.
 *
 * Server-only.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { auditLog } from "@/db/schema/audit-log";
import { resolveGovernanceActivityDbOrNull, type GovernanceActivityReadDeps } from "./read.server";
import {
  ACT_SUBJECT_ENTITY_TYPE_RE,
  RECORDED_ACT_PAGE_LIMIT,
  type ActSubject,
  type RecordedActPage,
} from "./contracts";

/** An id that is not a uuid can never match a tenant or entity column; refuse before querying. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Narrow whatever the driver returned to a number. `::int` already did it; this guards text. */
const toCount = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

/**
 * True when both halves of a subject are shaped the way their writers write them.
 *
 * Shape is not existence and this function never claims it is. A well-formed subject that no
 * authority ever acted on reads as an empty history, which is the honest answer; a malformed one
 * is refused before a predicate is built, because a caller who cannot spell a subject has not
 * established that the subject has no acts.
 */
export function isAddressableActSubject(subject: ActSubject): boolean {
  return (
    ACT_SUBJECT_ENTITY_TYPE_RE.test(subject.entityType) && UUID_RE.test(subject.entityId)
  );
}

/**
 * One bounded, ordered page of the acts recorded FOR ONE SUBJECT, and the total behind it.
 *
 * ── ONE SCOPE EXPRESSION, THREE EQUALITIES ───────────────────────────────────
 *
 * Tenant, entity type and entity id are ONE `subjectScope` expression shared by both statements,
 * exactly as R7.1.1 shares its tenant scope. One expression is one place to audit, and deleting it
 * breaks the page and the total together — which is what makes both the tenant-isolation and the
 * wrong-subject bite-proofs honest. Three separate predicates would let one be removed while the
 * others masked it.
 *
 * ── WHY THE TOTAL IS COUNTED OVER THE SUBJECT AND NOT THE TENANT ─────────────
 *
 * `totalRecordedActs` is what the page is measured against, so it must count the same population
 * the page was drawn from. A tenant-wide total here would make a five-act subject report
 * "showing 5 of 44" and turn `truncated` into a permanent, meaningless true.
 *
 * ── ORDERING IS TOTAL, NOT MERELY SORTED ─────────────────────────────────────
 *
 * `occurred_at DESC, id DESC`. The writers stamp logical time and two acts written inside one
 * transaction share it — GIA-1's permit consumption and its `work.recorded` act are exactly such a
 * pair — so without the tie-breaker the same subject could yield a different order on each call.
 *
 * Returns `null` — never an empty page — when the read could not run. An empty page is a claim.
 */
export async function readSubjectActPage(
  tenantId: string,
  subject: ActSubject,
  deps: GovernanceActivityReadDeps = {},
): Promise<RecordedActPage | null> {
  if (typeof window !== "undefined") {
    throw new Error("Governance activity reads are server-only.");
  }
  if (!UUID_RE.test(tenantId)) return null;
  if (!isAddressableActSubject(subject)) return null;

  const db = (deps.getDb ?? resolveGovernanceActivityDbOrNull)();
  if (!db) return null;

  const subjectScope = and(
    eq(auditLog.tenantId, tenantId),
    eq(auditLog.entityType, subject.entityType),
    eq(auditLog.entityId, subject.entityId),
  );

  /* The total. Deliberately UNBOUNDED, over the SAME scope the page is drawn from. */
  const [scalars] = await db
    .select({ totalRecordedActs: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(subjectScope);

  const rows = await db
    .select({
      occurredAt: auditLog.occurredAt,
      action: auditLog.action,
      entityType: auditLog.entityType,
      actorType: auditLog.actorType,
      result: auditLog.result,
      source: auditLog.source,
      authoritySource: auditLog.authoritySource,
      simulation: auditLog.simulation,
    })
    .from(auditLog)
    .where(subjectScope)
    .orderBy(desc(auditLog.occurredAt), desc(auditLog.id))
    .limit(RECORDED_ACT_PAGE_LIMIT);

  const totalRecordedActs = toCount(scalars?.totalRecordedActs);
  const acts = rows.flatMap((row) => {
    const at = toDate(row.occurredAt);
    /*
     * `occurred_at` is NOT NULL, so an unusable value means the driver returned something this code
     * does not understand. Dropping the row makes the page disagree with the independent total,
     * which the surface then reports as truncation — visibly incomplete beats an invented time.
     */
    if (!at) return [];
    return [
      {
        occurredAt: at.toISOString(),
        action: row.action,
        entityType: row.entityType,
        actorType: String(row.actorType),
        result: String(row.result),
        source: row.source ?? null,
        authoritySource: row.authoritySource ?? null,
        simulation: Boolean(row.simulation),
      },
    ];
  });

  return { acts, totalRecordedActs, truncated: acts.length < totalRecordedActs };
}
