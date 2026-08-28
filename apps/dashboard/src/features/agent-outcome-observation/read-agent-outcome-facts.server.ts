/*
 * agent-outcome-observation/read-agent-outcome-facts.server.ts — the aggregate reads behind
 * "what happened to what this agent proposed" (SELF-IMPROVING-AGENTS-1).
 *
 * ── WHY AGGREGATES AND NOT THE RELEASED LIST READERS ─────────────────────────
 *
 * `readPendingActionRequests` and `readActionPermits` already exist, and composing them would have
 * been the smaller diff. It would also have been WRONG, for the reason R6B recorded and GE-1 paid
 * for a second time: a bound that is correct for a list is silently wrong for a count. Both readers
 * cap at 50 rows; a tenant with 51 proposals would be told it had 50, with no error and no warning.
 * The first reader also filters to `pending`, so approved and rejected proposals are not even in
 * the population it can see.
 *
 * A per-agent aggregate needs no bound at all — one row per agent, computed in the database over
 * every row that exists. That is why these are `count(*)` statements and not pages.
 *
 * ── WHY RAW SQL ─────────────────────────────────────────────────────────────
 *
 * `count(*) filter (where ...)` is the whole mechanism: it turns five separate statements per
 * concern into one pass over one index. R2F.1 established the idiom in this repository, including
 * the part that bites — PostgreSQL returns `count()` and `sum()` as `bigint`/`numeric`, which the
 * node-postgres driver hands back as STRINGS. Nothing converts them on the way out, so this module
 * does it explicitly. A fake database would have agreed with a wrong implementation here.
 *
 * ── TENANT-SCOPED BY PREDICATE, NOT BY CALLER DISCIPLINE ────────────────────
 *
 * Every statement carries `tenant_id = <session tenant>` on EVERY table it touches, including both
 * sides of every join. There is no unscoped read and no parameter through which a caller could name
 * another tenant: the tenant arrives as an already-resolved server context.
 *
 * READ ONLY. No insert, update, delete or transaction appears in this module.
 *
 * Server-only.
 */
import { sql } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";

export interface AgentOutcomeFactsDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  /** The bound on the provider/model breakdown only. Every count above it is unbounded. */
  readonly distributionLimit?: number;
}

/**
 * The bound on the provider/model breakdown.
 *
 * It is the ONLY bound in this module, and it exists because that result set is the only one whose
 * cardinality is not one row per agent: it is (agent x provider x model). Every count is unbounded,
 * so a truncated breakdown can never shorten a total — and the truncation is reported rather than
 * silent.
 */
export const MODEL_DISTRIBUTION_LIMIT = 50;

/** How PostgreSQL hands numbers back. Every one of these arrives as a string. See the header. */
type DriverNumber = string | number | null | undefined;

/** A driver value into a safe non-negative integer. Anything unusable becomes 0. */
export function toCount(value: DriverNumber): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

/** One agent's proposal counts, straight from `heby_action_requests`. */
export interface AgentProposalFacts {
  readonly agentId: string;
  readonly filed: number;
  readonly pending: number;
  readonly approved: number;
  readonly rejected: number;
  readonly withdrawn: number;
  /** Proposals that name the model invocation which caused them (AGENT-PROPOSAL-4B onward). */
  readonly withInvocationLink: number;
  /** Proposals filed before that record existed. Never inferred, never backfilled. */
  readonly withoutInvocationLink: number;
}

/** One agent's permit counts. `expired` is derived here exactly as the released display derives it. */
export interface AgentPermitFacts {
  readonly agentId: string;
  readonly issued: number;
  readonly active: number;
  readonly expired: number;
  readonly consumed: number;
  readonly revoked: number;
}

/** One agent's execution attempt counts, straight from `action_execution_attempts`. */
export interface AgentExecutionFacts {
  readonly agentId: string;
  readonly attempts: number;
  readonly pending: number;
  readonly accepted: number;
  readonly refused: number;
  readonly failed: number;
  readonly unknown: number;
}

/** One agent's LINKED model invocations. See {@link readAgentInvocationFacts} for what "linked" costs. */
export interface AgentInvocationFacts {
  readonly agentId: string;
  readonly linkedInvocations: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Counted, never summed as zero: a provider that reported nothing is not a provider that used nothing. */
  readonly invocationsWithoutReportedUsage: number;
}

/**
 * One agent's ATTRIBUTED origination invocations, counted by the two closed vocabularies the
 * released provenance table owns (SIA-2.6).
 *
 * ── A DIFFERENT QUESTION FROM {@link AgentInvocationFacts} ───────────────────
 *
 * That one asks "which recorded model calls does one of this agent's PROPOSALS name" and is
 * unchanged. This one asks "which recorded model calls were made ON THIS AGENT'S BEHALF" — and the
 * difference is the entire point of the phase: a call that ended `selection-invalid` or `no-action`
 * produced no proposal, so the first question cannot see it and the second can.
 *
 * A call that DID produce a proposal appears in both, because both statements are true of it.
 *
 * NO CLASS IS COLLAPSED. Six states and four filing outcomes are counted separately because the
 * released schema separates them deliberately: `state` describes the model side and `filing_outcome`
 * describes what the proposal authority returned, and folding either would make distinct causes
 * indistinguishable.
 */
export interface AgentSelectionFacts {
  readonly agentId: string;
  /** Every invocation attributed to this agent, whatever became of it. */
  readonly attributed: number;
  /* ── The model-side lifecycle. `registered` means UNKNOWN, never "nothing happened". ── */
  readonly stateRegistered: number;
  readonly stateNotDispatched: number;
  readonly stateDispatchFailed: number;
  readonly stateSelectionInvalid: number;
  readonly stateNoAction: number;
  readonly stateSelectionValid: number;
  /* ── What the proposal authority returned to the attempt. An observation, never a lifecycle. ── */
  readonly filingNotAttempted: number;
  readonly filingProposed: number;
  readonly filingRefused: number;
  readonly filingFailed: number;
}

/** One (agent, provider, model) bucket. Provider and model are null until a result exists. */
export interface AgentModelDistributionFact {
  readonly agentId: string;
  readonly provider: string | null;
  readonly model: string | null;
  readonly invocations: number;
}

/**
 * Tenant-level provenance integrity (SIA-2.6).
 *
 * `historicallyUnattributed` counts invocations written before attribution existed. They stay NULL
 * for ever — there is no backfill and none is possible without inventing history.
 *
 * `attributionConflicts` counts rows where the invocation names one agent and a proposal naming
 * that invocation names ANOTHER. It must be zero: both values are written from a single resolved
 * proposer inside one request. It is measured rather than assumed, because a projection that
 * silently preferred one side would turn a provenance defect into a confident answer.
 */
export interface InvocationProvenanceIntegrity {
  readonly historicallyUnattributed: number;
  readonly attributionConflicts: number;
}

export type AgentOutcomeFactsRead<T> =
  | { readonly status: "read"; readonly rows: readonly T[] }
  | { readonly status: "unavailable"; readonly reason: string };

function resolveDb(deps: AgentOutcomeFactsDeps): ControlPlaneDatabase | null {
  return (deps.getDb ?? resolveGovernanceDbOrNull)();
}

function guard(
  tenant: TenantContext | null,
  deps: AgentOutcomeFactsDeps,
): { db: ControlPlaneDatabase; tenantId: string } | { reason: string } {
  if (typeof window !== "undefined") throw new Error("Agent outcome facts are server-only.");
  if (!tenant?.tenantId) return { reason: "no-authorized-tenant-context" };
  const db = resolveDb(deps);
  if (!db) return { reason: "persistence-not-configured" };
  return { db, tenantId: tenant.tenantId };
}

/**
 * Proposal counts per agent.
 *
 * `proposed_by_actor_type = 'agent'` is the whole attribution rule, and it is the same column A1a
 * made truthful and AGENT-PROPOSAL-1 taught to carry an agent. A human-typed proposal is not
 * counted here, because a human dictated it — that is the honest reading the origination phase
 * already settled.
 */
export async function readAgentProposalFacts(
  tenant: TenantContext | null,
  deps: AgentOutcomeFactsDeps = {},
): Promise<AgentOutcomeFactsRead<AgentProposalFacts>> {
  const resolved = guard(tenant, deps);
  if ("reason" in resolved) return { status: "unavailable", reason: resolved.reason };

  const statement = sql`
    select
      "heby_action_requests"."proposed_by_actor_id"::text                   as "agentId",
      count(*)                                                              as "filed",
      count(*) filter (where "heby_action_requests"."status" = 'pending')   as "pending",
      count(*) filter (where "heby_action_requests"."status" = 'approved')  as "approved",
      count(*) filter (where "heby_action_requests"."status" = 'rejected')  as "rejected",
      count(*) filter (where "heby_action_requests"."status" = 'withdrawn') as "withdrawn",
      count(*) filter (where "heby_action_requests"."origination_invocation_id" is not null)
                                                                            as "withInvocationLink",
      count(*) filter (where "heby_action_requests"."origination_invocation_id" is null)
                                                                            as "withoutInvocationLink"
    from "heby_action_requests"
    where "heby_action_requests"."tenant_id" = ${resolved.tenantId}
      and "heby_action_requests"."proposed_by_actor_type" = 'agent'
    group by "heby_action_requests"."proposed_by_actor_id"`;

  try {
    const executed = await resolved.db.execute(statement);
    const rows = executed.rows as unknown as readonly Record<string, DriverNumber>[];
    return {
      status: "read",
      rows: rows.map((row) => ({
        agentId: String(row.agentId ?? ""),
        filed: toCount(row.filed),
        pending: toCount(row.pending),
        approved: toCount(row.approved),
        rejected: toCount(row.rejected),
        withdrawn: toCount(row.withdrawn),
        withInvocationLink: toCount(row.withInvocationLink),
        withoutInvocationLink: toCount(row.withoutInvocationLink),
      })),
    };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}

/**
 * Permit counts per agent.
 *
 * THE EXPIRY RULE IS THE RELEASED ONE, RESTATED IN SQL. `action_permit_status` has no `expired`
 * value by design, so expiry is `status = 'active' and expires_at <= now`. `consumed` and `revoked`
 * are terminal and outrank the clock — a permit spent before its expiry was spent. That is exactly
 * `derivePermitState`, and `isExpiredPermit` in this feature's contracts is the pure mirror an
 * equivalence test holds the two together with.
 *
 * `now` is a parameter, not `now()`, so the boundary is testable and the same instant applies to
 * every row in the statement.
 */
export async function readAgentPermitFacts(
  tenant: TenantContext | null,
  deps: AgentOutcomeFactsDeps = {},
): Promise<AgentOutcomeFactsRead<AgentPermitFacts>> {
  const resolved = guard(tenant, deps);
  if ("reason" in resolved) return { status: "unavailable", reason: resolved.reason };
  const now = (deps.now ?? (() => new Date()))();

  const statement = sql`
    select
      "heby_action_requests"."proposed_by_actor_id"::text as "agentId",
      count(*)                                            as "issued",
      count(*) filter (
        where "action_permits"."status" = 'active' and "action_permits"."expires_at" > ${now}
      )                                                   as "active",
      count(*) filter (
        where "action_permits"."status" = 'active' and "action_permits"."expires_at" <= ${now}
      )                                                   as "expired",
      count(*) filter (where "action_permits"."status" = 'consumed') as "consumed",
      count(*) filter (where "action_permits"."status" = 'revoked')  as "revoked"
    from "action_permits"
    join "heby_action_requests"
      on "heby_action_requests"."id" = "action_permits"."action_request_id"
     and "heby_action_requests"."tenant_id" = "action_permits"."tenant_id"
    where "action_permits"."tenant_id" = ${resolved.tenantId}
      and "heby_action_requests"."tenant_id" = ${resolved.tenantId}
      and "heby_action_requests"."proposed_by_actor_type" = 'agent'
    group by "heby_action_requests"."proposed_by_actor_id"`;

  try {
    const executed = await resolved.db.execute(statement);
    const rows = executed.rows as unknown as readonly Record<string, DriverNumber>[];
    return {
      status: "read",
      rows: rows.map((row) => ({
        agentId: String(row.agentId ?? ""),
        issued: toCount(row.issued),
        active: toCount(row.active),
        expired: toCount(row.expired),
        consumed: toCount(row.consumed),
        revoked: toCount(row.revoked),
      })),
    };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}

/**
 * Execution attempt counts per agent.
 *
 * All five statuses are counted separately and none is folded into another. `unknown` in particular
 * is never added to `failed`: the whole reason that state exists is that the external effect may
 * already have happened, and a total that hides it inside a failure count would be the most
 * dangerous number on this page.
 */
export async function readAgentExecutionFacts(
  tenant: TenantContext | null,
  deps: AgentOutcomeFactsDeps = {},
): Promise<AgentOutcomeFactsRead<AgentExecutionFacts>> {
  const resolved = guard(tenant, deps);
  if ("reason" in resolved) return { status: "unavailable", reason: resolved.reason };

  const statement = sql`
    select
      "heby_action_requests"."proposed_by_actor_id"::text as "agentId",
      count(*)                                            as "attempts",
      count(*) filter (where "action_execution_attempts"."status" = 'pending')  as "pending",
      count(*) filter (where "action_execution_attempts"."status" = 'accepted') as "accepted",
      count(*) filter (where "action_execution_attempts"."status" = 'refused')  as "refused",
      count(*) filter (where "action_execution_attempts"."status" = 'failed')   as "failed",
      count(*) filter (where "action_execution_attempts"."status" = 'unknown')  as "unknown"
    from "action_execution_attempts"
    join "heby_action_requests"
      on "heby_action_requests"."id" = "action_execution_attempts"."action_request_id"
     and "heby_action_requests"."tenant_id" = "action_execution_attempts"."tenant_id"
    where "action_execution_attempts"."tenant_id" = ${resolved.tenantId}
      and "heby_action_requests"."tenant_id" = ${resolved.tenantId}
      and "heby_action_requests"."proposed_by_actor_type" = 'agent'
    group by "heby_action_requests"."proposed_by_actor_id"`;

  try {
    const executed = await resolved.db.execute(statement);
    const rows = executed.rows as unknown as readonly Record<string, DriverNumber>[];
    return {
      status: "read",
      rows: rows.map((row) => ({
        agentId: String(row.agentId ?? ""),
        attempts: toCount(row.attempts),
        pending: toCount(row.pending),
        accepted: toCount(row.accepted),
        refused: toCount(row.refused),
        failed: toCount(row.failed),
        unknown: toCount(row.unknown),
      })),
    };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}

/**
 * Model invocation facts per agent — and the boundary that makes this narrower than it sounds.
 *
 * ── THE INVOCATION TABLE HAS NO AGENT COLUMN ────────────────────────────────
 *
 * `heby_origination_invocations` records a model call. It does NOT record which agent the call was
 * made on behalf of, even though the origination seam resolved that agent before registering the
 * row. So the only attribution available is the CAUSAL LINK the proposal carries:
 * `heby_action_requests.origination_invocation_id`, and the proposer columns on that same row.
 *
 * The consequence, stated rather than hidden: an invocation that produced NO proposal — a refused
 * filing, a dispatch failure, an invalid selection, a `no-action` answer — belongs to no agent
 * here. It is not lost; it is counted at the tenant level by
 * {@link readUnattributedInvocationCount}. Adding an agent column would be a schema change and a
 * write path, and this phase is a read.
 *
 * ── TOKENS ARE A LOWER BOUND ────────────────────────────────────────────────
 *
 * The `filter` removes rows the provider did not report usage for BEFORE the sum, so a null is
 * never summed as a zero. Those rows survive as `invocationsWithoutReportedUsage`, which is how a
 * reader knows the totals are a floor rather than a measurement.
 */
export async function readAgentInvocationFacts(
  tenant: TenantContext | null,
  deps: AgentOutcomeFactsDeps = {},
): Promise<AgentOutcomeFactsRead<AgentInvocationFacts>> {
  const resolved = guard(tenant, deps);
  if ("reason" in resolved) return { status: "unavailable", reason: resolved.reason };

  /*
   * FULLY REPORTED, AND NOTHING LESS — the released R2F.1 predicate, restated.
   *
   * `and`, not `or`, and it decides the sums as well as the count. A provider that returned an
   * input count and no output count has reported PART of an invocation's usage, and the OR form
   * would have counted that row as reported while its missing half stayed silently absent from
   * the output total. A reader would then see "no invocation is missing usage" beside a total
   * that was short. Excluding the row from both sums and counting it below makes the totals a
   * strict lower bound and the gap visible, which is the pair R2F.1 settled on.
   */
  const measured = sql`"heby_origination_invocations"."input_tokens" is not null
                   and "heby_origination_invocations"."output_tokens" is not null`;

  const statement = sql`
    select
      "heby_action_requests"."proposed_by_actor_id"::text as "agentId",
      count(*)                                            as "linkedInvocations",
      coalesce(sum("heby_origination_invocations"."input_tokens")
                 filter (where ${measured}), 0)           as "inputTokens",
      coalesce(sum("heby_origination_invocations"."output_tokens")
                 filter (where ${measured}), 0)           as "outputTokens",
      count(*) filter (where not (${measured}))           as "invocationsWithoutReportedUsage"
    from "heby_origination_invocations"
    join "heby_action_requests"
      on "heby_action_requests"."origination_invocation_id" = "heby_origination_invocations"."id"
     and "heby_action_requests"."tenant_id" = "heby_origination_invocations"."tenant_id"
    where "heby_origination_invocations"."tenant_id" = ${resolved.tenantId}
      and "heby_action_requests"."tenant_id" = ${resolved.tenantId}
      and "heby_action_requests"."proposed_by_actor_type" = 'agent'
    group by "heby_action_requests"."proposed_by_actor_id"`;

  try {
    const executed = await resolved.db.execute(statement);
    const rows = executed.rows as unknown as readonly Record<string, DriverNumber>[];
    return {
      status: "read",
      rows: rows.map((row) => ({
        agentId: String(row.agentId ?? ""),
        linkedInvocations: toCount(row.linkedInvocations),
        inputTokens: toCount(row.inputTokens),
        outputTokens: toCount(row.outputTokens),
        invocationsWithoutReportedUsage: toCount(row.invocationsWithoutReportedUsage),
      })),
    };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}

/**
 * The (agent, provider, model) breakdown, for invocations that already persisted those values.
 *
 * `provider` and `model` are nullable on the invocation row — they are written only from a real
 * generation result, so an invocation that never reached a provider carries neither. Null is
 * carried through as null and rendered as "not reported", never repaired into a plausible name.
 *
 * THE ONE BOUND IN THIS MODULE, and it is disclosed. See {@link MODEL_DISTRIBUTION_LIMIT}.
 */
export async function readAgentModelDistribution(
  tenant: TenantContext | null,
  deps: AgentOutcomeFactsDeps = {},
): Promise<AgentOutcomeFactsRead<AgentModelDistributionFact>> {
  const resolved = guard(tenant, deps);
  if ("reason" in resolved) return { status: "unavailable", reason: resolved.reason };
  const limit = deps.distributionLimit ?? MODEL_DISTRIBUTION_LIMIT;

  const statement = sql`
    select
      "heby_action_requests"."proposed_by_actor_id"::text as "agentId",
      "heby_origination_invocations"."provider"          as "provider",
      "heby_origination_invocations"."model"             as "model",
      count(*)                                           as "invocations"
    from "heby_origination_invocations"
    join "heby_action_requests"
      on "heby_action_requests"."origination_invocation_id" = "heby_origination_invocations"."id"
     and "heby_action_requests"."tenant_id" = "heby_origination_invocations"."tenant_id"
    where "heby_origination_invocations"."tenant_id" = ${resolved.tenantId}
      and "heby_action_requests"."tenant_id" = ${resolved.tenantId}
      and "heby_action_requests"."proposed_by_actor_type" = 'agent'
    group by "agentId", "provider", "model"
    order by count(*) desc, "provider" nulls last, "model" nulls last
    limit ${limit}`;

  try {
    const executed = await resolved.db.execute(statement);
    const rows = executed.rows as unknown as readonly Record<string, DriverNumber>[];
    return {
      status: "read",
      rows: rows.map((row) => ({
        agentId: String(row.agentId ?? ""),
        provider: typeof row.provider === "string" ? row.provider : null,
        model: typeof row.model === "string" ? row.model : null,
        invocations: toCount(row.invocations),
      })),
    };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}

/**
 * How many of this tenant's recorded model invocations no proposal names.
 *
 * A tenant-level number by necessity, not by preference: with no agent column on the invocation
 * row there is nobody to attribute these to. Reporting it is what stops the per-agent invocation
 * counts from reading as "every model call this organization made".
 */
export async function readUnattributedInvocationCount(
  tenant: TenantContext | null,
  deps: AgentOutcomeFactsDeps = {},
): Promise<AgentOutcomeFactsRead<number>> {
  const resolved = guard(tenant, deps);
  if ("reason" in resolved) return { status: "unavailable", reason: resolved.reason };

  const statement = sql`
    select count(*) as "unattributed"
    from "heby_origination_invocations"
    where "heby_origination_invocations"."tenant_id" = ${resolved.tenantId}
      and not exists (
        select 1 from "heby_action_requests"
        where "heby_action_requests"."origination_invocation_id" = "heby_origination_invocations"."id"
          and "heby_action_requests"."tenant_id" = ${resolved.tenantId}
      )`;

  try {
    const executed = await resolved.db.execute(statement);
    const rows = executed.rows as unknown as readonly Record<string, DriverNumber>[];
    return { status: "read", rows: [toCount(rows[0]?.unattributed)] };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}

/**
 * Attributed origination invocations per agent, counted by state and by filing outcome.
 *
 * Grouped on `agent_id` DIRECTLY, so an invocation that produced no proposal is counted — which is
 * the whole reason SIA-2.6 exists. Rows with no attribution are excluded by the `is not null`
 * predicate rather than bucketed into an "unknown agent": there is no such agent, and inventing one
 * would be the fabricated absence this lineage has repaired twice.
 *
 * Cross-tenant reads are impossible twice over: the predicate scopes to the session tenant, and the
 * composite foreign key means `agent_id` cannot name an agent outside the row's own tenant.
 */
export async function readAgentSelectionFacts(
  tenant: TenantContext | null,
  deps: AgentOutcomeFactsDeps = {},
): Promise<AgentOutcomeFactsRead<AgentSelectionFacts>> {
  const resolved = guard(tenant, deps);
  if ("reason" in resolved) return { status: "unavailable", reason: resolved.reason };

  const statement = sql`
    select
      "heby_origination_invocations"."agent_id"::text as "agentId",
      count(*)                                        as "attributed",
      count(*) filter (where "heby_origination_invocations"."state" = 'registered')        as "stateRegistered",
      count(*) filter (where "heby_origination_invocations"."state" = 'not-dispatched')    as "stateNotDispatched",
      count(*) filter (where "heby_origination_invocations"."state" = 'dispatch-failed')   as "stateDispatchFailed",
      count(*) filter (where "heby_origination_invocations"."state" = 'selection-invalid') as "stateSelectionInvalid",
      count(*) filter (where "heby_origination_invocations"."state" = 'no-action')         as "stateNoAction",
      count(*) filter (where "heby_origination_invocations"."state" = 'selection-valid')   as "stateSelectionValid",
      count(*) filter (where "heby_origination_invocations"."filing_outcome" = 'not-attempted') as "filingNotAttempted",
      count(*) filter (where "heby_origination_invocations"."filing_outcome" = 'proposed')      as "filingProposed",
      count(*) filter (where "heby_origination_invocations"."filing_outcome" = 'refused')       as "filingRefused",
      count(*) filter (where "heby_origination_invocations"."filing_outcome" = 'failed')        as "filingFailed"
    from "heby_origination_invocations"
    where "heby_origination_invocations"."tenant_id" = ${resolved.tenantId}
      and "heby_origination_invocations"."agent_id" is not null
    group by "heby_origination_invocations"."agent_id"`;

  try {
    const executed = await resolved.db.execute(statement);
    const rows = executed.rows as unknown as readonly Record<string, DriverNumber>[];
    return {
      status: "read",
      rows: rows.map((row) => ({
        agentId: String(row.agentId ?? ""),
        attributed: toCount(row.attributed),
        stateRegistered: toCount(row.stateRegistered),
        stateNotDispatched: toCount(row.stateNotDispatched),
        stateDispatchFailed: toCount(row.stateDispatchFailed),
        stateSelectionInvalid: toCount(row.stateSelectionInvalid),
        stateNoAction: toCount(row.stateNoAction),
        stateSelectionValid: toCount(row.stateSelectionValid),
        filingNotAttempted: toCount(row.filingNotAttempted),
        filingProposed: toCount(row.filingProposed),
        filingRefused: toCount(row.filingRefused),
        filingFailed: toCount(row.filingFailed),
      })),
    };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}

/**
 * Tenant-level provenance integrity: what is historically unattributed, and what disagrees.
 *
 * The conflict predicate compares the invocation's own attribution against the proposer recorded on
 * a proposal that NAMES that invocation. Both are written from one resolved proposer in one
 * request, so the expected answer is zero — and measuring it is how a future defect surfaces as a
 * number a human sees rather than as a silently-preferred side.
 */
export async function readInvocationProvenanceIntegrity(
  tenant: TenantContext | null,
  deps: AgentOutcomeFactsDeps = {},
): Promise<AgentOutcomeFactsRead<InvocationProvenanceIntegrity>> {
  const resolved = guard(tenant, deps);
  if ("reason" in resolved) return { status: "unavailable", reason: resolved.reason };

  const statement = sql`
    select
      count(*) filter (where "heby_origination_invocations"."agent_id" is null) as "historicallyUnattributed",
      count(*) filter (
        where "heby_origination_invocations"."agent_id" is not null
          and exists (
            select 1 from "heby_action_requests"
            where "heby_action_requests"."origination_invocation_id" = "heby_origination_invocations"."id"
              and "heby_action_requests"."tenant_id" = "heby_origination_invocations"."tenant_id"
              and "heby_action_requests"."proposed_by_actor_type" = 'agent'
              and "heby_action_requests"."proposed_by_actor_id" <> "heby_origination_invocations"."agent_id"
          )
      ) as "attributionConflicts"
    from "heby_origination_invocations"
    where "heby_origination_invocations"."tenant_id" = ${resolved.tenantId}`;

  try {
    const executed = await resolved.db.execute(statement);
    const row = (executed.rows as unknown as readonly Record<string, DriverNumber>[])[0];
    return {
      status: "read",
      rows: [
        {
          historicallyUnattributed: toCount(row?.historicallyUnattributed),
          attributionConflicts: toCount(row?.attributionConflicts),
        },
      ],
    };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}
