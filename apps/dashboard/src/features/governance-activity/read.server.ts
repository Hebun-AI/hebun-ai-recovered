/*
 * governance-activity/read.server.ts — the tenant-scoped aggregate read over `audit_log` (R7.1).
 *
 * ── THIS IS A READER. IT IS NOT AN AUTHORITY ─────────────────────────────────
 *
 * `audit_log` stays the sole authority for recorded acts. This module adds no table, no writer and
 * no second sink: it issues `select` statements and nothing else. There is no `insert`, no
 * `update`, no `delete` and no transaction here, and a structural test asserts that rather than
 * trusting this sentence.
 *
 * ── WHY AN AGGREGATE AND NOT A LIST ──────────────────────────────────────────
 *
 * The one existing tenant-scoped audit read, `readKnowledgeMutationHistory`, is a bounded list for
 * ONE entity — correct for a history panel and unusable for a count, because `.limit(100)` would
 * silently cap the total. That is exactly the defect R6B found: a read seam's BOUND is part of its
 * meaning, and a count derived from a truncated listing under-reports without saying so.
 *
 * So this counts IN THE DATABASE, with no `LIMIT` anywhere, and never fetches rows to count them
 * in JavaScript.
 *
 * ── THE TENANT PREDICATE IS ONE EXPRESSION ───────────────────────────────────
 *
 * Four statements run, and all four take `tenantScope(tenantId)` — the SAME expression, not four
 * copies of it. A copy is four places for the boundary to drift; one expression is one place to
 * audit, and removing it breaks every statement at once, which is what makes the isolation
 * bite-proof honest. There is no second, redundant predicate here that could mask its removal.
 *
 * ── WHY FOUR STATEMENTS ──────────────────────────────────────────────────────
 *
 * `action`, `result` and `authority_source` are independent groupings of the same rows. One query
 * cannot group by three keys at once without producing the cross-product, whose rows would then
 * have to be re-aggregated in JavaScript — reintroducing exactly the client-side counting this
 * avoids. Four narrow statements over one indexed predicate is the honest shape.
 */

import { and, eq, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { auditLog } from "@/db/schema/audit-log";
import type { GovernanceActivityTallies } from "./contracts";

/** An id that is not a uuid can never match a tenant column; refuse before querying. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface GovernanceActivityReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

/**
 * The control-plane database, or an honest `null` when it is not configured.
 *
 * Resolved locally rather than imported from `governance-audit/knowledge-mutation-audit.server.ts`,
 * which exports an identical helper: that module imports the Knowledge mutation vocabulary, and
 * reaching through it for a database handle would pull the Knowledge authority into R7.1's import
 * graph for no reason. Each of the existing audit writers resolves `getControlPlaneDb` the same
 * way; this follows that precedent rather than inventing a shared seam.
 *
 * R2F.1 already paid for this lesson once: an import taken "just for the DB handle" tripped a
 * firewall.
 */
export function resolveGovernanceActivityDbOrNull(): ControlPlaneDatabase | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

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
 * Read one tenant's recorded governance activity, aggregated.
 *
 * Returns `null` when the tenant id is not a well-formed uuid — a caller cannot probe for another
 * organization's rows with a malformed id, and a malformed id is indistinguishable from a tenant
 * with nothing recorded.
 */
export async function readGovernanceActivityTallies(
  tenantId: string,
  deps: GovernanceActivityReadDeps = {},
): Promise<GovernanceActivityTallies | null> {
  if (typeof window !== "undefined") {
    throw new Error("Governance activity reads are server-only.");
  }
  if (!UUID_RE.test(tenantId)) return null;

  const db = (deps.getDb ?? resolveGovernanceActivityDbOrNull)();
  if (!db) return null;

  /*
   * THE tenant boundary. Every statement below takes this expression; none restates it.
   * `and(...)` wraps a single clause deliberately, so adding a second condition later cannot
   * change the shape of the call sites.
   */
  const tenantScope = and(eq(auditLog.tenantId, tenantId));

  /* Scalars: the independent total, the newest act, and the simulated split — one statement. */
  const [scalars] = await db
    .select({
      totalRecordedActs: sql<number>`count(*)::int`,
      latestOccurredAt: sql<Date | null>`max(${auditLog.occurredAt})`,
      simulatedCount: sql<number>`count(*) filter (where ${auditLog.simulation})::int`,
      nonSimulatedCount: sql<number>`count(*) filter (where not ${auditLog.simulation})::int`,
    })
    .from(auditLog)
    .where(tenantScope);

  const actionRows = await db
    .select({
      action: auditLog.action,
      count: sql<number>`count(*)::int`,
      latestOccurredAt: sql<Date>`max(${auditLog.occurredAt})`,
    })
    .from(auditLog)
    .where(tenantScope)
    .groupBy(auditLog.action);

  const resultRows = await db
    .select({ result: auditLog.result, count: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(tenantScope)
    .groupBy(auditLog.result);

  /*
   * `authority_source` is nullable, so this grouping can and does produce a NULL key. It is kept
   * as a real bucket: dropping it would make these counts sum to less than `totalRecordedActs`.
   */
  const authoritySourceRows = await db
    .select({ authoritySource: auditLog.authoritySource, count: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(tenantScope)
    .groupBy(auditLog.authoritySource);

  return {
    totalRecordedActs: toCount(scalars?.totalRecordedActs),
    latestOccurredAt: toDate(scalars?.latestOccurredAt),
    simulatedCount: toCount(scalars?.simulatedCount),
    nonSimulatedCount: toCount(scalars?.nonSimulatedCount),
    actions: actionRows.flatMap((row) => {
      const at = toDate(row.latestOccurredAt);
      /* A grouped row always has a max; if the driver returned something unusable, drop it rather
       * than inventing a timestamp. The independent total will then disagree, and the completeness
       * test will say so. */
      return at ? [{ action: row.action, count: toCount(row.count), latestOccurredAt: at }] : [];
    }),
    results: resultRows.map((row) => ({ result: String(row.result), count: toCount(row.count) })),
    authoritySources: authoritySourceRows.map((row) => ({
      authoritySource: row.authoritySource ?? null,
      count: toCount(row.count),
    })),
  };
}
