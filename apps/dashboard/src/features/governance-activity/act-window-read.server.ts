/*
 * governance-activity/act-window-read.server.ts — the UNBOUNDED, WINDOWED read over `audit_log`
 * (E2-7).
 *
 * ── WHY A THIRD FILE IN THIS AUTHORITY ───────────────────────────────────────
 *
 * The split already here is load-bearing and this follows it rather than reopening it:
 *
 *   `read.server.ts`            carries NO `.limit(`, `.offset(` or `fetch first` ANYWHERE. R6B's
 *                               defect was a bound that was right for a list and silently wrong for
 *                               a count, and the guarantee stays checkable only while the file has
 *                               no bound at all.
 *   `act-history-read.server.ts` carries EXACTLY ONE `.limit(`, because a bounded page genuinely
 *                               needs one, and a test asserts it appears once.
 *   this file                   carries no bound either, and must not: a count over a closed
 *                               interval has a finite answer, so bounding it would replace a fact
 *                               with a page length.
 *
 * Putting the windowed counts into either existing file would have forced its released assertion to
 * be narrowed from "this FILE has no bound" / "exactly one bound" to something per-function — a
 * strictly weaker guarantee bought for a smaller diff. Both stay absolute; this earns its own.
 *
 * ── THE INTERVAL IS HALF-OPEN, AND EVERY STATEMENT USES THE SAME SHAPE ───────
 *
 *     occurred_at >= since  AND  occurred_at < until
 *
 * `gte`/`lt`, never `lte`. Adjacent windows built this way partition time with no overlap and no
 * gap, so an act at exactly the boundary is counted in exactly one period. Closed-closed intervals
 * would double-count every boundary instant, which is the defect that quietly makes two period
 * counts incomparable while both look correct.
 *
 * ── THIS IS A READER. IT IS NOT AN AUTHORITY ─────────────────────────────────
 *
 * `audit_log` remains the sole authority for recorded acts, written by the `governance-audit`
 * writers and by nothing else. This module issues `select` and nothing else: no insert, no update,
 * no delete, no transaction. It owns no table, no row, no cache and no state. It also selects only
 * `entity_type` and a count — no payload, no identifier, nothing from
 * `WITHHELD_AUDIT_COLUMNS`.
 *
 * ── AND IT INTERPRETS NOTHING ────────────────────────────────────────────────
 *
 * Two windows in, two counts out. No delta, no direction, no rate, no projection. Subtracting the
 * two would be arithmetic; saying what the difference MEANS is a judgement no authority in Hebun
 * owns, and a field that could hold one is a field a future edit will fill.
 *
 * Server-only.
 */
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { auditLog } from "@/db/schema/audit-log";
import { resolveGovernanceActivityDbOrNull, type GovernanceActivityReadDeps } from "./read.server";
import {
  RECORDED_ACT_WINDOW_DAYS,
  type RecordedActKindCount,
  type RecordedActWindow,
  type RecordedActWindowResult,
} from "./contracts";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";

/** An id that is not a uuid can never match a tenant column; refuse before querying. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Narrow whatever the driver returned to a number. `::int` already did it; this guards text. */
const toCount = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Count this tenant's recorded acts inside one half-open window, grouped by entity kind.
 *
 * ── ONE TENANT PREDICATE, USED BY BOTH STATEMENTS ────────────────────────────
 *
 * `scope` is built once and handed to both queries, exactly as the released page reader does. One
 * expression is one place to audit, and deleting it breaks both statements at once — which is what
 * makes an isolation bite-proof honest. A second, redundant predicate would mask the removal of the
 * first.
 *
 * ── WHY TWO STATEMENTS AND NOT ONE ───────────────────────────────────────────
 *
 * The total is counted INDEPENDENTLY of the grouped rows, not summed from them — R7.1's reason,
 * applied to a window. If a future edit put a bound or a stray predicate on the grouped query, the
 * total would disagree with the sum and a test fails loudly, instead of the surface quietly
 * under-reporting a period.
 *
 * Returns `null` — never an empty window — when the read could not run. An empty window is a claim
 * about a period, and a failed read must never be allowed to make it.
 */
export async function readRecordedActWindow(
  tenantId: string,
  /* NAMED `interval`, NOT `window` — a parameter called `window` shadows the browser global the
     server-only guard below tests for, and the guard would then be checking its own argument. */
  interval: { readonly since: Date; readonly until: Date },
  deps: GovernanceActivityReadDeps = {},
): Promise<RecordedActWindow | null> {
  if (typeof window !== "undefined") {
    throw new Error("Governance activity reads are server-only.");
  }
  if (!UUID_RE.test(tenantId)) return null;
  /* An inverted or empty interval is a caller error, not a period with nothing in it. */
  if (!(interval.since.getTime() < interval.until.getTime())) return null;

  const db = (deps.getDb ?? resolveGovernanceActivityDbOrNull)();
  if (!db) return null;

  const scope = and(
    eq(auditLog.tenantId, tenantId),
    gte(auditLog.occurredAt, interval.since),
    lt(auditLog.occurredAt, interval.until),
  );

  /* The total for the window. Unbounded, and never inferred from the grouped rows. */
  const [totals] = await db
    .select({ acts: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(scope);

  /*
   * The breakdown. ORDERED BY COUNT THEN KIND so a rendering is stable across reads — that is a
   * determinism property, NOT a ranking: nothing here says a larger count matters more.
   */
  const grouped = await db
    .select({ entityType: auditLog.entityType, acts: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(scope)
    .groupBy(auditLog.entityType)
    .orderBy(desc(sql`count(*)`), asc(auditLog.entityType));

  const byEntityKind: readonly RecordedActKindCount[] = grouped.map((row) => ({
    entityType: String(row.entityType ?? ""),
    acts: toCount(row.acts),
  }));

  return {
    since: interval.since.toISOString(),
    until: interval.until.toISOString(),
    acts: toCount(totals?.acts),
    byEntityKind,
  };
}

/**
 * Two ADJACENT, EQUAL-LENGTH windows ending at one pinned instant.
 *
 * ── ONE INSTANT, DERIVED ONCE ────────────────────────────────────────────────
 *
 * Both windows are computed from a single `evaluatedAt`. Reading the clock twice would let the two
 * periods drift apart by the duration of the first query, so the pair would no longer partition a
 * contiguous stretch of time — the boundary between them would be two different instants, and every
 * act in the gap would be counted in neither.
 *
 *     previous = [evaluatedAt - 2d, evaluatedAt - d)
 *     current  = [evaluatedAt - d,  evaluatedAt)
 *     previous.until === current.since, EXACTLY
 *
 * ── FAILS CLOSED, AND FAILS TOGETHER ─────────────────────────────────────────
 *
 * If either window could not be read the whole comparison is `null`. One window plus a fabricated
 * zero would look like a period in which nothing happened, which is a claim about the organization
 * that nobody measured.
 */
export async function readRecordedActWindowPair(
  tenantId: string,
  evaluatedAt: Date,
  windowDays: number,
  deps: GovernanceActivityReadDeps = {},
): Promise<{ readonly current: RecordedActWindow; readonly previous: RecordedActWindow } | null> {
  if (!Number.isFinite(windowDays) || windowDays <= 0) return null;

  const span = windowDays * 24 * 60 * 60 * 1000;
  const currentSince = new Date(evaluatedAt.getTime() - span);
  const previousSince = new Date(evaluatedAt.getTime() - span * 2);

  const current = await readRecordedActWindow(tenantId, { since: currentSince, until: evaluatedAt }, deps);
  if (!current) return null;
  const previous = await readRecordedActWindow(
    tenantId,
    /* Its `until` IS the current window's `since` — one Date object, so they cannot drift apart. */
    { since: previousSince, until: currentSince },
    deps,
  );
  if (!previous) return null;

  return { current, previous };
}

/**
 * Observe this tenant's windowed activity, fail-closed.
 *
 * The tenant comes from the caller's already-authorized context and is used verbatim as the SQL
 * predicate. There is NO tenant id parameter a client could supply, no cross-tenant form and no
 * whole-ledger form — the same arrangement R7.1 and R7.1.1 established and this does not
 * re-litigate.
 *
 * THE WINDOW LENGTH IS A PARAMETER WITH A STATED DEFAULT, not a hidden constant, and the result
 * always carries the exact instants it was measured between. A caller may ask for a different
 * length; nobody, including this module, may call a length "recent".
 */
export async function observeRecordedActWindows(
  tenant: Pick<TenantContext, "tenantId"> | null,
  deps: GovernanceActivityReadDeps & {
    readonly now?: () => Date;
    readonly windowDays?: number;
  } = {},
): Promise<RecordedActWindowResult> {
  if (typeof window !== "undefined") {
    throw new Error("Governance activity reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };

  const windowDays = deps.windowDays ?? RECORDED_ACT_WINDOW_DAYS;
  const evaluatedAt = deps.now?.() ?? new Date();

  try {
    const pair = await readRecordedActWindowPair(tenant.tenantId, evaluatedAt, windowDays, deps);
    if (!pair) return { status: "unavailable", reason: "persistence-not-configured" };
    return {
      status: "observed",
      tenantId: tenant.tenantId,
      comparison: {
        evaluatedAt: evaluatedAt.toISOString(),
        windowDays,
        current: pair.current,
        previous: pair.previous,
      },
    };
  } catch (error) {
    return {
      status: "unavailable",
      reason: "read-failed",
      detail: error instanceof Error ? error.message : "recorded act window read failed",
    };
  }
}
