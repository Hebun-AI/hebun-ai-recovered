/*
 * heby-provider-ops/provider-usage-aggregation.server.ts — the read seam that TOTALS
 * recorded provider usage (R2F.1).
 *
 * ── WHAT CHANGED AND WHAT DID NOT ────────────────────────────────────────────
 *
 * The measurement already existed. Since R2D, `persistExchange` has written the
 * provider-reported token counts onto the assistant `messages` row along with the
 * tenant, provider, model, transport, correlation id and provider request id. Every
 * one of those columns was written correctly and then never read by anything.
 *
 * This module adds the missing link and only that link: it reads what is already
 * there. It does not measure, does not re-measure, does not estimate, does not
 * reconcile, and does not price. Persistence is untouched.
 *
 * ── TENANT-SCOPED BY PREDICATE, NOT BY CALLER DISCIPLINE ─────────────────────
 *
 * The single query carries `tenant_id = <session tenant>`. There is no unscoped read,
 * no "all tenants" mode, and no parameter through which a caller could ask about
 * another tenant. `tenantId` reaches this module only as a server-internal argument
 * derived from an authenticated `TenantContext`; it is never part of a client contract.
 *
 * ── READ ONLY ────────────────────────────────────────────────────────────────
 *
 * No insert, update, delete or mutating transaction appears here. No transport is
 * imported, no provider is contacted, no network is touched, and nothing is written —
 * including no audit row: reading a total is not a governed state transition, and the
 * `messages` rows are already the evidence.
 *
 * Server-only.
 */
import { sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  REAL_PROVIDER_TRANSPORT,
  UNLABELLED_USAGE_KEY,
  emptyRecordedUsageTotals,
  type RecordedProviderUsage,
  type RecordedProviderUsageRead,
  type RecordedUsageGroup,
  type RecordedUsageTotals,
} from "./usage-contracts";

export interface RecordedProviderUsageDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

/**
 * The control-plane handle, or null when durable storage is not configured.
 *
 * Resolved DIRECTLY from the database client — the same way `provider-authority.server.ts` next
 * door and the durable conversation repository do.
 *
 * It deliberately does NOT borrow the equivalent null-safe helper that the Governance feature
 * exports. The G2 firewall forbids any Heby surface from importing that feature at all, and
 * "I only wanted the database handle it happened to expose" is exactly the kind of incidental
 * edge the firewall exists to keep out of the import graph. This module reaching for it was
 * caught by that suite, not by review.
 *
 * (The firewall reads RAW source, so the forbidden module paths are described here rather than
 * spelled — a comment naming them trips the same guard an import would.)
 */
function resolveUsageDbOrNull(): ControlPlaneDatabase | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * One (provider, model, UTC day) bucket as PostgreSQL returns it.
 *
 * Every numeric arrives as a string: `count()` and `sum()` are `bigint`/`numeric`, and
 * the node-postgres driver hands those back as strings rather than lossy JS numbers.
 * `db.execute()` of raw SQL performs no Drizzle field mapping, so nothing converts
 * them on the way out — this module does it explicitly.
 */
interface UsageBucketRow {
  readonly provider: string | null;
  readonly model: string | null;
  readonly day: string | null;
  readonly recordedCalls: string | number;
  readonly fullyMeasuredCalls: string | number;
  readonly inputTokens: string | number;
  readonly outputTokens: string | number;
}

/** A driver string/number into a safe non-negative integer. Anything unusable → 0. */
function toCount(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

function addTotals(into: MutableTotals, bucket: UsageBucketRow): void {
  const recorded = toCount(bucket.recordedCalls);
  const measured = toCount(bucket.fullyMeasuredCalls);
  into.recordedCalls += recorded;
  into.fullyMeasuredCalls += measured;
  /*
   * Derived by SUBTRACTION rather than counted separately, so the contract's invariant
   * (`recordedCalls === fullyMeasuredCalls + unknownTokenRows`) holds by construction
   * and cannot drift from two independently-computed aggregates.
   */
  into.unknownTokenRows += Math.max(0, recorded - measured);
  into.inputTokens += toCount(bucket.inputTokens);
  into.outputTokens += toCount(bucket.outputTokens);
}

interface MutableTotals {
  recordedCalls: number;
  fullyMeasuredCalls: number;
  unknownTokenRows: number;
  inputTokens: number;
  outputTokens: number;
}

function newMutableTotals(): MutableTotals {
  return {
    recordedCalls: 0,
    fullyMeasuredCalls: 0,
    unknownTokenRows: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
}

function sealTotals(t: MutableTotals): RecordedUsageTotals {
  return {
    recordedCalls: t.recordedCalls,
    fullyMeasuredCalls: t.fullyMeasuredCalls,
    unknownTokenRows: t.unknownTokenRows,
    inputTokens: t.inputTokens,
    outputTokens: t.outputTokens,
    totalTokens: t.inputTokens + t.outputTokens,
  };
}

/** Fold buckets onto one dimension. `order` decides how the groups are presented. */
function groupBy(
  buckets: readonly UsageBucketRow[],
  keyOf: (bucket: UsageBucketRow) => string,
  order: "by-volume" | "newest-first",
): readonly RecordedUsageGroup[] {
  const accumulated = new Map<string, MutableTotals>();
  for (const bucket of buckets) {
    const key = keyOf(bucket);
    const existing = accumulated.get(key) ?? newMutableTotals();
    addTotals(existing, bucket);
    accumulated.set(key, existing);
  }

  const groups = [...accumulated.entries()].map(([key, totals]) => ({
    key,
    ...sealTotals(totals),
  }));

  /*
   * Both orderings are TOTAL — the tie-break on `key` means no two groups can compare
   * equal, so the result is deterministic rather than dependent on Map insertion order
   * (which is itself dependent on however PostgreSQL happened to return the buckets).
   */
  return order === "newest-first"
    ? groups.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0))
    : groups.sort((a, b) =>
        b.recordedCalls - a.recordedCalls || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
      );
}

/**
 * Total this tenant's RECORDED provider usage.
 *
 * ── THE QUERY ────────────────────────────────────────────────────────────────
 *
 * One statement, grouped at the finest granularity any surface needs
 * (provider × model × UTC day). The result set is bounded by the CARDINALITY of those
 * dimensions rather than by the number of messages, so this does not grow into a
 * "select every row and sum it in JavaScript" as history accumulates. The coarser
 * views are folded from those buckets in memory — one round trip, not four.
 *
 * No index is proposed. At the present scale a sequential scan over `messages` is the
 * honest answer, and an index added before any query had ever run would be a guess.
 *
 * ── WHY THE `filter` CLAUSES, AND WHY THE `coalesce` IS SAFE ─────────────────
 *
 * `fully_measured_calls` and both sums are restricted to rows carrying BOTH token
 * counts. That is what keeps a NULL out of the arithmetic: an unmeasured row is
 * excluded from the sums and survives as the difference between the two counts.
 *
 * The `coalesce(..., 0)` wraps a sum over an EMPTY SET — a bucket in which no row was
 * fully measured — where zero is the correct sum and the bucket's unmeasured rows are
 * still reported through `recorded_calls`. It never converts a NULL token value into a
 * zero; the `filter` has already removed those rows from the sum entirely.
 *
 * ── DAY SEMANTICS ────────────────────────────────────────────────────────────
 *
 * Days are UTC calendar days, computed in PostgreSQL with an explicit
 * `at time zone 'UTC'` so the answer never depends on the server's local zone. No
 * tenant timezone exists anywhere in this schema, and R2F.1 does not invent one.
 * `to_char` is used rather than a `::date` cast so the value arrives as a plain
 * `YYYY-MM-DD` string instead of a driver-dependent date object.
 */
export async function readRecordedProviderUsage(
  tenant: TenantContext | null,
  deps: RecordedProviderUsageDeps = {},
): Promise<RecordedProviderUsageRead> {
  if (typeof window !== "undefined") {
    throw new Error("Recorded provider usage reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = (deps.getDb ?? resolveUsageDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };

  const measured = sql`"messages"."input_tokens" is not null and "messages"."output_tokens" is not null`;

  const statement = sql`
    select
      "messages"."provider"                                          as "provider",
      "messages"."model"                                             as "model",
      to_char("messages"."created_at" at time zone 'UTC', 'YYYY-MM-DD') as "day",
      count(*)                                                       as "recordedCalls",
      count(*) filter (where ${measured})                            as "fullyMeasuredCalls",
      coalesce(sum("messages"."input_tokens")  filter (where ${measured}), 0) as "inputTokens",
      coalesce(sum("messages"."output_tokens") filter (where ${measured}), 0) as "outputTokens"
    from "messages"
    where "messages"."tenant_id" = ${tenant.tenantId}
      and "messages"."transport" = ${REAL_PROVIDER_TRANSPORT}
    group by "provider", "model", "day"`;

  let buckets: readonly UsageBucketRow[];
  try {
    const executed = await db.execute(statement);
    buckets = executed.rows as unknown as readonly UsageBucketRow[];
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }

  const totals = newMutableTotals();
  for (const bucket of buckets) addTotals(totals, bucket);

  const usage: RecordedProviderUsage = {
    totals: buckets.length === 0 ? emptyRecordedUsageTotals() : sealTotals(totals),
    byProvider: groupBy(buckets, (b) => b.provider ?? UNLABELLED_USAGE_KEY, "by-volume"),
    byModel: groupBy(buckets, (b) => b.model ?? UNLABELLED_USAGE_KEY, "by-volume"),
    byDay: groupBy(buckets, (b) => b.day ?? UNLABELLED_USAGE_KEY, "newest-first"),
  };

  return { status: "read", usage };
}
