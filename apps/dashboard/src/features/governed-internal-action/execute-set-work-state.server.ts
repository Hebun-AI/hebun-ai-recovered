/*
 * governed-internal-action/execute-set-work-state.server.ts — THE THIRD GOVERNED INTERNAL ACT
 * (WORK-UPDATE V1): change the declared state of one work item a human authorized.
 *
 * ── THE FLOW, AND WHO OWNS EACH STEP ─────────────────────────────────────────
 *
 *   a human chose the item and the state; Heby PROPOSED        heby_action_requests   (released)
 *   a human DECIDES                                            decision_records       Governance
 *   a permit EXISTS                                            action_permits         Action Authorization
 *   the WORK AUTHORITY opens the transaction                   declareWorkStateUnderPermit
 *     the permit is SPENT inside it, as a savepoint            consumeActionPermit    (released, unchanged)
 *     the WORK AUTHORITY re-asks under the row lock and changes one column, authored `system`
 *
 * THIS MODULE OWNS NOTHING. It holds no table, opens no transaction, resolves no authority and
 * writes nothing. It hands the Work Authority a function that spends the permit on the transaction
 * the Work Authority opened, and checks the envelope inside the spend.
 *
 * ── WHY THE NESTING IS INVERTED FOR THIS ACT, AND ONLY THIS ACT ──────────────
 *
 * `record-work` and `place-human-in-department` mutate INSIDE the permit callback, on the permit's
 * `insert | select` transaction (`PermitConsumptionTx`). Changing a state needs an `update`, and that
 * type is deliberately not widened. So the Work Authority owns the transaction and the spend joins
 * it as a savepoint. Spend and change still commit together or not at all. The callback below still
 * writes nothing. This is the Director-approved WORK-UPDATE V1 exception, not a pattern for the next
 * act — see `hebun-work-update-v1-design.md` §14.5.
 *
 *     THE SEAM CHECKS THE ENVELOPE.      THE AUTHORITY CHECKS THE WORLD.
 *
 * There is no automatic rollback. The inverse is the same act with the two states swapped, proposed
 * and authorized again.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { ControlPlaneDatabase } from "@/db/client.server";
import {
  consumeActionPermit,
  type PermitConsumptionDeps,
} from "@/features/action-authorization/consume-action-permit.server";
import type { ExecutionAuthorization } from "@/features/action-authorization/contracts";
import {
  declareWorkStateUnderPermit,
  type GovernedWorkStateChange,
  type GovernedWorkStateResult,
} from "@/features/organizational-work/write-work.server";
import { isWorkDeclaredState, parseWorkItemRef } from "@/features/organizational-work/work-contracts";
import { parseWorkDomainRef } from "@/features/work-domain/work-scope";
import { SET_WORK_DECLARED_STATE_ACTION_KIND } from "@/features/heby-action-inlet/contracts";

/** The one kind this seam performs. A constant, so no caller can aim it at another act. */
export const WORK_STATE_ACTION_KIND = SET_WORK_DECLARED_STATE_ACTION_KIND;

/** Why a governed state change did not happen. Each value is a fact about THIS invocation. */
export type WorkStateActRefusal =
  /** No server-resolved tenant. */
  | "unauthenticated"
  /** The permit could not be spent — already spent, expired, revoked, or not this tenant's. */
  | "permit-not-consumable"
  /** The proposing agent is no longer in service. Nothing was spent. */
  | "agent-not-in-service"
  /** The proposing agent's current mandate or responsibility no longer admits the act. */
  | "agent-mandate-refused"
  /** The permit authorizes a different act. Nothing was spent. */
  | "action-kind-mismatch"
  /** The approved payload is not a work item, two states and a work domain in this act's shapes. */
  | "payload-not-changeable"
  /** The Work Authority refused under its own lock. Its own reason is carried, never re-interpreted. */
  | "work-authority-refused"
  /** The control plane could not be reached. Nothing was authorized and nothing was written. */
  | "execution-unavailable";

export type WorkStateActResult =
  | {
      readonly status: "executed";
      readonly handoffId: string;
      readonly permitId: string;
      readonly outcome: Extract<GovernedWorkStateResult, { status: "recorded" }>;
    }
  | {
      readonly status: "refused";
      readonly reason: WorkStateActRefusal;
      readonly authorityReason?: string;
    };

export interface WorkStateActDeps extends Omit<PermitConsumptionDeps, "onAuthorizedWithin"> {
  readonly consume?: typeof consumeActionPermit;
  readonly declareUnderPermit?: typeof declareWorkStateUnderPermit;
}

class AbortWorkStateAct extends Error {}

/** The approved payload, in this act's shapes, or `null`. SHAPE ONLY — the authority checks the world. */
function changeFrom(
  authorization: ExecutionAuthorization,
): Omit<GovernedWorkStateChange, "handoffId"> | null {
  const payload = authorization.canonicalPayload;
  const item = parseWorkItemRef(payload["workItemRef"]);
  const domain = parseWorkDomainRef(payload["workDomainRef"]);
  const fromState = payload["fromState"];
  const toState = payload["toState"];
  if (!item || !domain || payload["workScope"] !== "domain") return null;
  if (!isWorkDeclaredState(fromState) || !isWorkDeclaredState(toState) || fromState === toState) return null;
  /* The target the request froze must be the item the payload names — never two different items. */
  if (authorization.targetRef !== payload["workItemRef"]) return null;
  return { workItemId: item.workItemId, fromState, toState, workDomainId: domain.workDomainId };
}

/**
 * Perform one authorized declared-state change.
 *
 * The permit id is the ONLY client-crossing value. There is no parameter for a tenant, an item, a
 * state or a domain: the act is entirely described by the permit a human already approved.
 */
export async function executeSetWorkDeclaredState(
  tenant: TenantContext | null,
  input: { readonly permitId: string },
  deps: WorkStateActDeps = {},
): Promise<WorkStateActResult> {
  if (typeof window !== "undefined") {
    throw new Error("Governed internal acts are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return { status: "refused", reason: "unauthenticated" };

  const consume = deps.consume ?? consumeActionPermit;
  const declareUnderPermit = deps.declareUnderPermit ?? declareWorkStateUnderPermit;

  let envelopeRefusal: WorkStateActRefusal | null = null;
  let spendRefusal: WorkStateActRefusal | null = null;
  let spent: { readonly handoffId: string; readonly permitId: string } | null = null;

  const result = await declareUnderPermit(
    tenant,
    async (tx) => {
      let change: Omit<GovernedWorkStateChange, "handoffId"> | null = null;
      const consumption = await consume(
        tenant,
        { permitId: input.permitId },
        {
          ...(deps.now ? { now: deps.now } : {}),
          /* THE WORK AUTHORITY'S TRANSACTION. The released spend nests inside it as a savepoint. */
          getDb: () => tx as unknown as ControlPlaneDatabase,
          async onAuthorizedWithin(_tx, authorization: ExecutionAuthorization) {
            /* Envelope only, and nothing written: a refusal here rolls the spend's savepoint back. */
            if (authorization.actionKind !== WORK_STATE_ACTION_KIND) {
              envelopeRefusal = "action-kind-mismatch";
              throw new AbortWorkStateAct(envelopeRefusal);
            }
            change = changeFrom(authorization);
            if (change === null) {
              envelopeRefusal = "payload-not-changeable";
              throw new AbortWorkStateAct(envelopeRefusal);
            }
          },
        },
      );
      if (consumption.status !== "authorized") {
        const why = consumption.reason;
        spendRefusal =
          why === "agent-not-in-service" || why === "agent-mandate-refused"
            ? why
            : why === "persistence-unavailable"
              ? "execution-unavailable"
              : "permit-not-consumable";
        return { status: "refused" };
      }
      if (change === null) return { status: "refused" };
      spent = { handoffId: consumption.authorization.handoffId, permitId: consumption.authorization.permitId };
      return {
        status: "authorized",
        change: { ...(change as Omit<GovernedWorkStateChange, "handoffId">), handoffId: consumption.authorization.handoffId },
      };
    },
    deps.getDb ? { getDb: deps.getDb, ...(deps.now ? { now: deps.now } : {}) } : deps.now ? { now: deps.now } : {},
  );

  if (result.status === "recorded") {
    const done = spent as { readonly handoffId: string; readonly permitId: string } | null;
    if (!done) return { status: "refused", reason: "execution-unavailable" };
    return { status: "executed", handoffId: done.handoffId, permitId: done.permitId, outcome: result };
  }

  /* NOTHING HAPPENED. The Work Authority's transaction rolled back, so the permit is still `active`. */
  if (envelopeRefusal !== null) return { status: "refused", reason: envelopeRefusal };
  if (spendRefusal !== null) return { status: "refused", reason: spendRefusal };
  if (result.reason === "authority-unavailable") return { status: "refused", reason: "execution-unavailable" };
  return { status: "refused", reason: "work-authority-refused", authorityReason: result.reason };
}
