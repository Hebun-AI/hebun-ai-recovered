/*
 * governance-activity/act-history-read.server.ts — the BOUNDED, ordered read over `audit_log`
 * (R7.1.1).
 *
 * ── WHY THIS IS A SEPARATE FILE FROM THE AGGREGATE ───────────────────────────
 *
 * `read.server.ts` carries a released, structurally-asserted property: it contains NO `.limit(`,
 * `.offset(` or `fetch first` ANYWHERE. That is not decoration. R6B's defect was a read seam whose
 * bound was correct for a list and silently wrong for a count, and the only way to keep "this
 * aggregate cannot acquire a bound" checkable is for the file to contain no bound at all.
 *
 * A bounded list genuinely needs a bound. Putting it in that file would have forced the firewall to
 * be narrowed from "no bound in this file" to "no bound in this function" — a strictly weaker
 * guarantee, bought to make a suite green. So the bounded reader lives here instead, and R7.1's
 * file is untouched: both properties stay absolute, each checkable in its own file.
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
import { RECORDED_ACT_PAGE_LIMIT, type RecordedActPage } from "./contracts";

/** An id that is not a uuid can never match a tenant column; refuse before querying. */
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
 * One bounded, ordered page of the tenant's recorded acts, and the total behind it.
 *
 * ── THE SAME TENANT PREDICATE, NOT A SECOND ONE ──────────────────────────────
 *
 * Both statements take ONE `tenantScope` expression, exactly as the aggregate does. One expression
 * is one place to audit, and removing it breaks both statements at once — which is what makes the
 * isolation bite-proof honest. A second, redundant predicate would mask the removal of the first.
 *
 * ── WHY TWO STATEMENTS AND NOT ONE ───────────────────────────────────────────
 *
 * The page is BOUNDED and the total must NOT be. A window function could carry both in one
 * statement, at the cost of the bound and the total sharing a plan — and the entire safety property
 * here is that the total is computed independently of anything the bound touched. `acts.length` is
 * never the total and cannot silently become it.
 *
 * ── ORDERING IS TOTAL, NOT MERELY SORTED ─────────────────────────────────────
 *
 * `occurred_at DESC` alone is not deterministic: the writers stamp logical time, and two acts
 * written inside one transaction share it. `id DESC` is the tie-breaker, so the same ledger always
 * yields the same page rather than whichever order the planner chose. Without it a bounded read
 * could return a different twenty rows on each call while claiming to show "the most recent".
 *
 * ── THE SELECT LIST IS THE SECURITY BOUNDARY ─────────────────────────────────
 *
 * Eight columns, named one by one. No argument-less `select()`, no spread of the table, and none of
 * `previous_state`, `next_state`, `metadata`, `entity_id`, `actor_id`, `correlation_id`,
 * `causation_id`, `request_id`, `session_context_id` or `principal_reference_hash`. Adding a column
 * here is a deliberate, reviewable act — which is the point: a reader that selected the whole row
 * would ship nine writers' private payload shapes to a surface, and no single contract governs
 * their union.
 *
 * Returns `null` — never an empty page — when the read could not run. An empty page is a claim.
 */
export async function readRecordedActPage(
  tenantId: string,
  deps: GovernanceActivityReadDeps = {},
): Promise<RecordedActPage | null> {
  if (typeof window !== "undefined") {
    throw new Error("Governance activity reads are server-only.");
  }
  if (!UUID_RE.test(tenantId)) return null;

  const db = (deps.getDb ?? resolveGovernanceActivityDbOrNull)();
  if (!db) return null;

  const tenantScope = and(eq(auditLog.tenantId, tenantId));

  /* The total. Deliberately UNBOUNDED: it is what the page is measured against. */
  const [scalars] = await db
    .select({ totalRecordedActs: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(tenantScope);

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
    .where(tenantScope)
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
