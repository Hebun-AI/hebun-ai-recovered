/*
 * standing-mutation-authority/read-standing-mutations.server.ts — what a human may see about the
 * standing envelopes their organization has granted (RUNG 2).
 *
 * ── A STANDING AUTHORITY THAT NOBODY CAN SEE IS WORSE THAN NONE ─────────────
 *
 * Every other authority on this surface is visible at the moment it matters: a permit appears on
 * the approvals queue, an execution appears on the ledger. An envelope is different — it sits
 * silently and turns future proposals into permits without anyone watching. So it ships with its
 * read, in the same milestone, and the read answers the questions a human would actually ask:
 * what did I allow, to whom, for how long, how much is left, and can it fire right now.
 *
 * ── EVERYTHING COUNTABLE IS COUNTED, NOT STORED ─────────────────────────────
 *
 * `actsIssued`, `remaining`, `lastIssuedAt` and `exhausted` are all derived from the permits this
 * envelope issued. There is no counter column to drift, and no sweeper to fall behind. The same
 * reason permit expiry is derived and never swept.
 *
 * ── FIVE REFUSALS, NEVER ONE ────────────────────────────────────────────────
 *
 *     WITHDRAWN != EXPIRED != NOT-YET-VALID != EXHAUSTED != ROOT-DISARMED != NOT-ENROLLED
 *
 * "You took this back", "the window closed", "the quota is spent", "an operator stopped
 * everything" and "your organization is not enrolled" call for five different human responses.
 * AMA-4 had to repair exactly this collapse at its own gate, so it is not collapsed here.
 *
 * ── TENANT-SCOPED BY PREDICATE ──────────────────────────────────────────────
 *
 * Every query carries `tenant_id = <session tenant>`. There is no unscoped read and no parameter
 * through which a caller could ask about another organization.
 *
 * READ ONLY. No insert, update, delete or transaction appears in this module.
 *
 * Server-only.
 */
import { and, desc, eq } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import { standingMutationAuthorizations } from "@/db/schema/standing-mutation-authorization";
import { actionPermits } from "@/db/schema/action-authorization";
import { agents } from "@/db/schema/agent";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import { readDurableAgentRuntimeLiveness } from "@/features/agent-identity/read-durable-agent-identity.server";
import { readEffectiveTenantMachineExecution } from "@/features/tenant-machine-execution-authority/read-tenant-machine-execution.server";
import { resolveMachineInternalExecutionEnabled } from "@/features/governed-machine-execution/machine-execution-control.server";
import type {
  StandingMutationReachability,
  StandingMutationState,
} from "./contracts";

export interface StandingMutationView {
  readonly authorizationId: string;
  readonly authorizationRevision: number;
  readonly state: StandingMutationState;
  readonly agentId: string;
  /** The agent's own name, or `null` when it could not be resolved. Never a raw id as a label. */
  readonly agentName: string | null;
  readonly actionKind: string;
  readonly notBefore: string;
  readonly notAfter: string;
  readonly maxActs: number;
  readonly minIntervalMinutes: number;
  /** The human who signed this revision, and the decision that records it. */
  readonly authorizedByActorId: string;
  readonly authorizedAt: string;
  readonly governanceDecisionId: string;
  /** DERIVED: permits issued under this envelope. Never a stored tally. */
  readonly actsIssued: number;
  /** DERIVED: `maxActs - actsIssued`, floored at zero. */
  readonly remaining: number;
  /** DERIVED: when this envelope last issued, or `null` if it never has. */
  readonly lastIssuedAt: string | null;
  /**
   * DERIVED: could this envelope issue RIGHT NOW?
   *
   * Composed from the envelope, the organization's enrolment and the deployment's root control.
   * It is a statement about this instant and never a promise about the next one — the issuing seam
   * and then the executor both re-decide every clause of it against freshly re-read rows.
   */
  readonly reachability: StandingMutationReachability;
}

export type StandingMutationRead =
  | { readonly status: "read"; readonly items: readonly StandingMutationView[] }
  | { readonly status: "unavailable"; readonly reason: "persistence-unavailable" };

export interface StandingMutationReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly rootEnabled?: typeof resolveMachineInternalExecutionEnabled;
  readonly readTenantEnrolment?: typeof readEffectiveTenantMachineExecution;
  readonly readAgentLiveness?: typeof readDurableAgentRuntimeLiveness;
}

const iso = (value: Date | null | undefined): string | null =>
  value instanceof Date ? value.toISOString() : null;

/**
 * Every standing envelope this organization has, effective revision first.
 *
 * Returns the EFFECTIVE revision of each lineage — `max(authorization_revision)` per agent —
 * because that is the one that decides anything. Superseded revisions are history, and a surface
 * that listed them beside the current one would invite a reader to act on a replaced grant.
 */
export async function readStandingMutations(
  tenant: TenantContext | null,
  deps: StandingMutationReadDeps = {},
): Promise<StandingMutationRead> {
  if (typeof window !== "undefined") {
    throw new Error("Standing mutation reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "persistence-unavailable" };

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };
  const now = (deps.now ?? (() => new Date()))();

  try {
    const rows = await db
      .select({
        authorization: standingMutationAuthorizations,
        agentName: agents.name,
      })
      .from(standingMutationAuthorizations)
      .leftJoin(
        agents,
        and(
          eq(agents.id, standingMutationAuthorizations.agentId),
          eq(agents.tenantId, standingMutationAuthorizations.tenantId),
        ),
      )
      .where(eq(standingMutationAuthorizations.tenantId, tenant.tenantId))
      .orderBy(desc(standingMutationAuthorizations.authorizationRevision));

    /* EFFECTIVE REVISION PER LINEAGE. Ordered highest-first, so the first per agent wins. */
    const effective = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!effective.has(row.authorization.agentId)) {
        effective.set(row.authorization.agentId, row);
      }
    }

    /*
     * THE DEPLOYMENT'S MASTER STOP, READ ONCE. It is a property of the deployment, not of any
     * envelope, so asking per row would be asking the same question repeatedly.
     */
    const rootOn = await (deps.rootEnabled ?? resolveMachineInternalExecutionEnabled)({});

    const items: StandingMutationView[] = [];

    for (const { authorization, agentName } of effective.values()) {
      /* DERIVED COUNTS. Every permit this envelope has issued — the quota's only source. */
      const issued = await db
        .select({ issuedAt: actionPermits.issuedAt })
        .from(actionPermits)
        .where(
          and(
            eq(actionPermits.tenantId, tenant.tenantId),
            eq(actionPermits.standingAuthorizationId, authorization.id),
          ),
        )
        .orderBy(desc(actionPermits.issuedAt));

      const actsIssued = issued.length;
      const remaining = Math.max(0, authorization.maxActs - actsIssued);

      const enrolment = await (deps.readTenantEnrolment ?? readEffectiveTenantMachineExecution)(
        tenant.tenantId,
        authorization.actionKind,
        deps.getDb ? { getDb: deps.getDb } : {},
      );
      const liveness = await (deps.readAgentLiveness ?? readDurableAgentRuntimeLiveness)(
        tenant.tenantId,
        authorization.agentId,
        deps.getDb ? { getDb: deps.getDb } : {},
      );

      /*
       * THE ORDER IS PART OF THE CONTRACT, and it is the one TRH-25's revalidator recorded:
       * the MORE SPECIFIC fact wins. "You withdrew this" must never be disguised as "an operator
       * paused everything", because the audit question "did they take it back, or was it never
       * on?" becomes unanswerable exactly when somebody needs to ask it.
       */
      const reachability: StandingMutationReachability =
        authorization.state !== "active"
          ? { status: "unreachable", reason: "withdrawn" }
          : now.getTime() < authorization.notBefore.getTime()
            ? { status: "unreachable", reason: "not-yet-valid" }
            : now.getTime() >= authorization.notAfter.getTime()
              ? { status: "unreachable", reason: "expired" }
              : remaining === 0
                ? { status: "unreachable", reason: "exhausted" }
                : liveness !== "in-service"
                  ? { status: "unreachable", reason: "agent-not-in-service" }
                  : enrolment.status !== "read" || enrolment.effective.state !== "active"
                    ? { status: "unreachable", reason: "tenant-not-enrolled" }
                    : !rootOn
                      ? { status: "unreachable", reason: "root-control-disabled" }
                      : { status: "reachable" };

      items.push({
        authorizationId: authorization.id,
        authorizationRevision: authorization.authorizationRevision,
        state: authorization.state as StandingMutationState,
        agentId: authorization.agentId,
        agentName: agentName ?? null,
        actionKind: authorization.actionKind,
        notBefore: iso(authorization.notBefore) ?? "",
        notAfter: iso(authorization.notAfter) ?? "",
        maxActs: authorization.maxActs,
        minIntervalMinutes: authorization.minIntervalMinutes,
        authorizedByActorId: authorization.authorizedByActorId,
        authorizedAt: iso(authorization.authorizedAt) ?? "",
        governanceDecisionId: authorization.governanceDecisionId,
        actsIssued,
        remaining,
        lastIssuedAt: iso(issued[0]?.issuedAt ?? null),
        reachability,
      });
    }

    return { status: "read", items };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}
