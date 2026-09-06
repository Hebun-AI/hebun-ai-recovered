/*
 * governed-internal-action/execute-record-work.server.ts — THE FIRST GOVERNED INTERNAL ACT (GIA-1).
 *
 * ── THE FLOW, AND WHO OWNS EACH STEP ─────────────────────────────────────────
 *
 *   Heby or a human PROPOSES        heby_action_requests        (released)
 *   a human DECIDES                 decision_records            Governance (released)
 *   a permit EXISTS                 action_permits              Action Authorization (released)
 *   the permit is SPENT             consumeActionPermit          Action Authorization (released)
 *   the WORK AUTHORITY mutates      recordWorkWithin             Organizational Work (GIA-1 seam)
 *   the outcome is the work row + its audit event, in that same transaction
 *
 * THIS MODULE OWNS NOTHING. It holds no table, opens no transaction of its own, resolves no
 * authority, and performs no insert: it hands the permit's own transaction to the authority that
 * owns `work_items` and lets that authority do the writing. It is a wiring seam, not an executor
 * authority, and there is deliberately no framework here for a second internal action.
 *
 * ── WHY NOT `action_execution_attempts` ──────────────────────────────────────
 *
 * That ledger is external-send specific in schema and in meaning: `recipient_id` and `adapter_id`
 * are NOT NULL, and `provider_response_class` / `provider_message_id` / `failure_class` describe a
 * provider conversation. Reusing it would mean inventing a recipient for an act that has none.
 *
 * The deeper reason is semantic. That ledger exists because a network send has an AMBIGUOUS PHASE —
 * the request may have arrived even though the caller never learned so. An internal mutation inside
 * the permit's own transaction has no ambiguous phase at all: it committed or it did not.
 *
 *     THE WORK ROW AND ITS AUDIT EVENT ARE THE OUTCOME RECORD.
 *
 * ── WHAT IT PROVES SEPARATELY ────────────────────────────────────────────────
 *
 *     PROPOSED != AUTHORIZED != EXECUTED != SUCCESSFUL
 *
 *   proposed    the request row exists, with its proposer
 *   authorized  a human's decision minted a permit
 *   executed    the permit was spent — `handoff_id` exists and the permit is no longer active
 *   successful  the work row exists, authored `system`, with its audit event
 *
 * A refusal inside the transaction ABORTS it: the permit reverts to active and no work row exists.
 * So "authorized" never silently becomes "successful", and a failed act leaves an authorization a
 * human can spend again rather than a half-performed mutation.
 *
 * ── IDEMPOTENCY ──────────────────────────────────────────────────────────────
 *
 * The replay boundary is the permit. `consumeActionPermit` spends it under a single conditional
 * statement whose row count is the verdict, so a second invocation of this function with the same
 * permit finds nothing to spend and performs no mutation. There is no second guard here, because a
 * second guard would be a second opinion about what "already done" means.
 *
 * ── NO EXTERNAL REACH ────────────────────────────────────────────────────────
 *
 * This module imports no adapter, no transport, no provider and no recipient. A firewall walks its
 * real import graph and proves it, in both directions: the internal path cannot reach an external
 * adapter, and the external adapter contract still receives no tenant, no authority and no database
 * handle.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  consumeActionPermit,
  type PermitConsumptionDeps,
} from "@/features/action-authorization/consume-action-permit.server";
import type { ExecutionAuthorization } from "@/features/action-authorization/contracts";
import {
  recordWorkWithin,
  type WorkWriteResult,
} from "@/features/organizational-work/write-work.server";
import { parseDepartmentRef } from "@/features/organization-authority/department-ref";
import { RECORD_WORK_ACTION_KIND } from "@/features/heby-action-inlet/contracts";

/**
 * The ONE internal action kind, and it is the SAME STRING the proposal froze.
 *
 * Imported rather than respelled: a literal here could drift from the constant the inlet proposes
 * under, and the drift would make this executor refuse every permit a human ever approved — or,
 * worse, accept one that named something else. There is exactly one governed internal act, and a
 * second is a deliberate decision rather than a configuration entry.
 */
export const INTERNAL_ACTION_KIND = RECORD_WORK_ACTION_KIND;

/** Why a governed internal act did not happen. Each value is a fact about THIS invocation. */
export type InternalActRefusal =
  /** No server-resolved tenant. There is no parameter through which a caller supplies one. */
  | "unauthenticated"
  /** The permit could not be spent — already spent, expired, revoked, or not this tenant's. */
  | "permit-not-consumable"
  /** The permit authorizes a different act. The transaction is aborted, so nothing was written. */
  | "action-kind-mismatch"
  /** The approved payload does not describe a work item this authority will accept. */
  | "payload-not-recordable"
  /** The Work Authority refused the mutation. Its own reason is carried, never re-interpreted. */
  | "work-authority-refused"
  /** The control plane could not be reached. Nothing was authorized and nothing was written. */
  | "execution-unavailable";

export type InternalActResult =
  | {
      readonly status: "executed";
      /** The permit spend. Proof of EXECUTION, distinct from the mutation's success. */
      readonly handoffId: string;
      readonly permitId: string;
      /** The Work Authority's own answer. Proof of SUCCESS, and its record, not ours. */
      readonly outcome: WorkWriteResult;
    }
  | {
      readonly status: "refused";
      readonly reason: InternalActRefusal;
      /** The owning authority's own refusal, when it is the one that refused. Never paraphrased. */
      readonly authorityReason?: string;
    };

export interface InternalActDeps extends PermitConsumptionDeps {
  readonly consume?: typeof consumeActionPermit;
  readonly recordWithin?: typeof recordWorkWithin;
}

/**
 * Thrown to ABORT the permit transaction — and the reason is CAPTURED BEFORE THROWING.
 *
 * `consumeActionPermit` catches whatever its callback throws and reports its own
 * `handoff-record-failed`, which is correct for it: from where it stands, the handoff did not
 * record. But that would erase WHY, and "the permit authorized something else" and "the Work
 * Authority refused the title" are different facts a human needs. So the reason is recorded in a
 * closure before the throw, and the throw is left to do the one job it is for: rolling the spend
 * back. The released module is not modified.
 */
class AbortInternalAct extends Error {}

/**
 * The approved payload, narrowed to what the Work Authority accepts.
 *
 * IT READS ONLY WHAT A HUMAN APPROVED. `canonicalPayload` is the digest-bound record of exactly the
 * scalars shown at the decision surface, and `consumeActionPermit` has already re-verified that
 * digest before this runs. Nothing here may add a field, default one, or read anything from
 * anywhere else — a value the human did not see is a value they did not authorize.
 */
function workInputFrom(authorization: ExecutionAuthorization): {
  readonly title: string;
  readonly departmentId: string | null;
} | null {
  const payload = authorization.canonicalPayload;
  const title = payload["title"];
  if (typeof title !== "string" || title.trim().length === 0) return null;

  /*
   * ── THE SCOPE A HUMAN APPROVED, READ AS A DECLARATION (TRH-16) ───────────
   *
   * The payload states which organizational truth was authorized. It is READ, never defaulted: an
   * unrecognised or absent scope is `null` — "not recordable" — rather than quietly becoming
   * organization-level. A value the human did not see is a value they did not authorize, and that
   * rule applies to an ABSENCE exactly as it applies to a value.
   *
   *     EXPLICIT ORGANIZATION-LEVEL  !=  MISSING SCOPE
   */
  const scope = payload["departmentScope"];

  if (scope === "organization-level") {
    /*
     * NOTHING IS PARSED AND NOTHING IS INVENTED. The human approved work this organization holds
     * at organization level; `recordWorkWithin` has always accepted `departmentId = null` and
     * re-applies its own rule, which for null is simply that no department is claimed. A stray
     * reference beside this scope is a contradiction the inlet already refuses, and is refused
     * here too rather than silently ignored.
     */
    if (payload["departmentRef"] !== undefined) return null;
    return { title, departmentId: null };
  }

  if (scope !== "department") return null;

  /*
   * THE REFERENCE IS PARSED, NOT TRUSTED. What a human approved is `department/<uuid>`; what the
   * Work Authority takes is a uuid. Parsing is the only translation performed here, it fails closed
   * on anything that is not exactly one canonical reference, and it invents no department: whether
   * that id names an IN-SERVICE department of this tenant is re-checked by the owning authority
   * inside the transaction, where the answer cannot be stale.
   *
   * NOTHING ELSE IS READ. No declared state, no accountable human, no default — a value the human
   * did not see is a value they did not authorize.
   */
  const parsed = parseDepartmentRef(payload["departmentRef"]);
  if (!parsed) return null;

  return { title, departmentId: parsed.departmentId };
}

/**
 * SPEND ONE PERMIT AND LET THE WORK AUTHORITY RECORD THE WORK, ATOMICALLY.
 *
 * The tenant comes from the server-resolved context and nowhere else; the permit id is the only
 * client-crossing value, and it is a lookup key the spend statement scopes to this tenant. There is
 * no parameter for a title, a department or an accountable human — those come from what a human
 * approved, or the act does not happen.
 */
export async function executeRecordWork(
  tenant: TenantContext | null,
  input: { readonly permitId: string },
  deps: InternalActDeps = {},
): Promise<InternalActResult> {
  if (typeof window !== "undefined") {
    throw new Error("Governed internal acts are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return { status: "refused", reason: "unauthenticated" };

  const consume = deps.consume ?? consumeActionPermit;
  const recordWithin = deps.recordWithin ?? recordWorkWithin;

  let outcome: WorkWriteResult | null = null;
  /* Captured before the throw, because the throw's identity does not survive the released catch. */
  let refusal: InternalActRefusal | null = null;
  let authorityReason: string | undefined;

  const abort = (reason: InternalActRefusal, detail?: string): never => {
    refusal = reason;
    authorityReason = detail;
    throw new AbortInternalAct(reason);
  };

  let consumption: Awaited<ReturnType<typeof consumeActionPermit>>;
  try {
    consumption = await consume(
      tenant,
      { permitId: input.permitId },
      {
        ...deps,
        async onAuthorizedWithin(tx, authorization: ExecutionAuthorization) {
          /*
           * THE KIND IS CHECKED INSIDE THE TRANSACTION, so a permit for a different act aborts the
           * spend rather than being refused after it. A permit that authorized something else must
           * still be spendable for the thing it did authorize.
           */
          if (authorization.actionKind !== INTERNAL_ACTION_KIND) abort("action-kind-mismatch");

          const work = workInputFrom(authorization);
          if (work === null) abort("payload-not-recordable");

          /*
           * THE OWNING AUTHORITY PERFORMS THE MUTATION, in the permit's own transaction, authored
           * `system`. This module does not insert, does not audit, and does not interpret.
           */
          const result = await recordWithin(tx, tenant, work!, { kind: "system" });
          if (result.status !== "recorded") abort("work-authority-refused", result.reason);
          outcome = result;
        },
      },
    );
  } catch {
    return { status: "refused", reason: refusal ?? "execution-unavailable" };
  }

  /*
   * AN ABORT MEANS NOTHING HAPPENED. The permit reverted to active, no work row exists, and the
   * authorization a human granted is still theirs to spend.
   */
  if (refusal !== null) {
    return {
      status: "refused",
      reason: refusal,
      ...(authorityReason === undefined ? {} : { authorityReason }),
    };
  }

  if (consumption.status !== "authorized") {
    return { status: "refused", reason: "permit-not-consumable" };
  }
  if (outcome === null) return { status: "refused", reason: "execution-unavailable" };

  return {
    status: "executed",
    handoffId: consumption.authorization.handoffId,
    permitId: consumption.authorization.permitId,
    outcome,
  };
}
