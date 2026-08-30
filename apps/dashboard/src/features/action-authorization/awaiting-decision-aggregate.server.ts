/*
 * action-authorization/awaiting-decision-aggregate.server.ts — THE UNBOUNDED READ OVER WHAT IS
 * STILL AWAITING A HUMAN DECISION (E2-4).
 *
 * ── WHY THIS IS A SEPARATE FILE, AND WHY IT HAD TO BE ────────────────────────
 *
 * `read-action-authorizations.server.ts` already reads pending proposals. It could not answer this
 * question, and the reason is exact rather than stylistic:
 *
 *     .orderBy(desc(hebyActionRequests.createdAt)).limit(deps.limit ?? 50)
 *
 * NEWEST FIRST, bounded at fifty. So the OLDEST pending proposal is the first row that reader drops
 * — silently, and precisely when a tenant has enough waiting work for the answer to matter. Taking
 * a minimum from that list would produce a number that is correct on small tenants, wrong on large
 * ones, and indistinguishable between the two.
 *
 * That is R6B's finding restated for time: a bound that is correct for a list is silently wrong for
 * an aggregate. R6B's remedy is the one used here — an aggregate that needs no bound at all,
 * computed in the database over every row that exists.
 *
 * It lives in its own file for R7.1.1's reason: the bounded list reader keeps its `.limit(`, this
 * file contains none, and each property stays checkable where it belongs. A test asserts that this
 * file contains no `.limit(`, `.offset(` or `fetch first` anywhere.
 *
 * ── WHAT IT DERIVES, AND WHAT IT REFUSES TO ──────────────────────────────────
 *
 * A count and an oldest instant. It does not rank, score, classify, or decide that an old proposal
 * is a problem — it reports `min(created_at)` and stops. The elapsed arithmetic happens above it,
 * in a pure module, against an injected instant.
 *
 *     OLDEST != MOST IMPORTANT        A COUNT != A BACKLOG JUDGEMENT
 *
 * ── TENANT-SCOPED BY PREDICATE ───────────────────────────────────────────────
 *
 * Both statements carry `tenant_id = <session tenant>`, bound from the already-resolved server
 * context. There is no parameter through which a caller could name another tenant.
 *
 * READ ONLY. No insert, update, delete or transaction appears in this module.
 *
 * Server-only.
 */
import { sql } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";

export interface AwaitingDecisionDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

/** The tenant's whole awaiting-decision position. Unbounded — every pending row is counted. */
export interface AwaitingDecisionAggregate {
  /** Every proposal still awaiting a human decision. NOT capped at the list reader's fifty. */
  readonly awaiting: number;
  /**
   * `min(created_at)` across those proposals, as ISO — the moment the oldest one was FILED.
   *
   * `null` when nothing is awaiting. That is a measured emptiness, not a failed read: the caller
   * receives `status: "read"` with `awaiting: 0`, which no consumer may render as an age of zero.
   */
  readonly oldestFiledAt: string | null;
}

/**
 * What has been APPROVED and has no execution attempt behind it.
 *
 * SIA-1 already publishes this as a count (`approvedWithoutExecution`). What it has never carried
 * is WHEN — and `heby_action_requests.approved_at` is non-null exactly when `status = 'approved'`,
 * enforced by the released `heby_action_requests_approved_chk`. So the duration is read off an
 * authoritative column, never inferred from a permit's issuance or from anything else.
 *
 *     APPROVED != EXECUTED        NO ATTEMPT != A FAILED ATTEMPT
 */
export interface ApprovedUnexecutedAggregate {
  readonly approvedWithoutAttempt: number;
  /** `min(approved_at)` across them, as ISO. `null` when there are none. */
  readonly oldestApprovedAt: string | null;
}

/** One agent's awaiting-decision position, for attachment to an authoritative agent node. */
export interface AgentAwaitingDecision {
  readonly agentId: string;
  readonly awaiting: number;
  readonly oldestFiledAt: string | null;
}

export type AwaitingDecisionRead<T> =
  | { readonly status: "read"; readonly value: T }
  | { readonly status: "unavailable"; readonly reason: string };

/** How PostgreSQL hands `count()` back through node-postgres: as a STRING. See SIA-1's header. */
function toCount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

/** An instant the driver may hand back as a `Date` or as text. Never invented when absent. */
function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function guard(
  tenant: TenantContext | null,
  deps: AwaitingDecisionDeps,
): { db: ControlPlaneDatabase; tenantId: string } | { reason: string } {
  if (typeof window !== "undefined") {
    throw new Error("Awaiting-decision aggregate reads are server-only.");
  }
  if (!tenant?.tenantId) return { reason: "no-authorized-tenant-context" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { reason: "persistence-not-configured" };
  return { db, tenantId: tenant.tenantId };
}

/**
 * How many proposals are awaiting a human decision, and when the oldest was filed.
 *
 * `status = 'pending'` is the whole population rule, and it is the released one: `approved`,
 * `rejected` and `withdrawn` are decided outcomes, so a decided proposal can never appear here as
 * something still waiting. That distinction is asserted by test — a resolved item that showed up as
 * currently waiting would be the most misleading possible product of this milestone.
 */
export async function readAwaitingDecisionAggregate(
  tenant: TenantContext | null,
  deps: AwaitingDecisionDeps = {},
): Promise<AwaitingDecisionRead<AwaitingDecisionAggregate>> {
  const resolved = guard(tenant, deps);
  if ("reason" in resolved) return { status: "unavailable", reason: resolved.reason };

  const statement = sql`
    select
      count(*)                                     as "awaiting",
      min("heby_action_requests"."created_at")     as "oldestFiledAt"
    from "heby_action_requests"
    where "heby_action_requests"."tenant_id" = ${resolved.tenantId}
      and "heby_action_requests"."status" = 'pending'`;

  try {
    const executed = await resolved.db.execute(statement);
    const row = (executed.rows as unknown as readonly Record<string, unknown>[])[0];
    return {
      status: "read",
      value: { awaiting: toCount(row?.awaiting), oldestFiledAt: toIso(row?.oldestFiledAt) },
    };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}

/**
 * The same position, per AGENT that proposed.
 *
 * `proposed_by_actor_type = 'agent'` is the same attribution rule SIA-1 uses, and the key is the
 * durable agent id so a consumer holding an authoritative agent node can join by identity rather
 * than by name or by position.
 *
 *     AGENT NAME != AGENT IDENTITY        ARRAY POSITION != IDENTITY
 *
 * One statement, grouped, for the whole tenant. Nothing here iterates agents.
 */
export async function readAgentAwaitingDecision(
  tenant: TenantContext | null,
  deps: AwaitingDecisionDeps = {},
): Promise<AwaitingDecisionRead<readonly AgentAwaitingDecision[]>> {
  const resolved = guard(tenant, deps);
  if ("reason" in resolved) return { status: "unavailable", reason: resolved.reason };

  const statement = sql`
    select
      "heby_action_requests"."proposed_by_actor_id"::text as "agentId",
      count(*)                                            as "awaiting",
      min("heby_action_requests"."created_at")            as "oldestFiledAt"
    from "heby_action_requests"
    where "heby_action_requests"."tenant_id" = ${resolved.tenantId}
      and "heby_action_requests"."status" = 'pending'
      and "heby_action_requests"."proposed_by_actor_type" = 'agent'
    group by "heby_action_requests"."proposed_by_actor_id"`;

  try {
    const executed = await resolved.db.execute(statement);
    const rows = executed.rows as unknown as readonly Record<string, unknown>[];
    return {
      status: "read",
      value: rows.map((row) => ({
        agentId: String(row.agentId ?? ""),
        awaiting: toCount(row.awaiting),
        oldestFiledAt: toIso(row.oldestFiledAt),
      })),
    };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}

/**
 * Approved proposals with no execution attempt recorded against them, and when the oldest was
 * approved.
 *
 * `not exists` over `action_execution_attempts`, tenant-scoped on BOTH sides — a correlated
 * subquery that omitted the tenant predicate would let a neighbour's attempt suppress this tenant's
 * row, which is the quietest possible cross-tenant defect. Both predicates are asserted by test.
 *
 * Unbounded, like the two statements above, and for the same reason.
 */
export async function readApprovedUnexecutedAggregate(
  tenant: TenantContext | null,
  deps: AwaitingDecisionDeps = {},
): Promise<AwaitingDecisionRead<ApprovedUnexecutedAggregate>> {
  const resolved = guard(tenant, deps);
  if ("reason" in resolved) return { status: "unavailable", reason: resolved.reason };

  const statement = sql`
    select
      count(*)                                      as "approvedWithoutAttempt",
      min("heby_action_requests"."approved_at")     as "oldestApprovedAt"
    from "heby_action_requests"
    where "heby_action_requests"."tenant_id" = ${resolved.tenantId}
      and "heby_action_requests"."status" = 'approved'
      and not exists (
        select 1
        from "action_execution_attempts"
        where "action_execution_attempts"."action_request_id" = "heby_action_requests"."id"
          and "action_execution_attempts"."tenant_id" = ${resolved.tenantId}
      )`;

  try {
    const executed = await resolved.db.execute(statement);
    const row = (executed.rows as unknown as readonly Record<string, unknown>[])[0];
    return {
      status: "read",
      value: {
        approvedWithoutAttempt: toCount(row?.approvedWithoutAttempt),
        oldestApprovedAt: toIso(row?.oldestApprovedAt),
      },
    };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}
