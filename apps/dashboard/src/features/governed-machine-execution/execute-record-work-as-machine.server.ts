/*
 * governed-machine-execution/execute-record-work-as-machine.server.ts — a MACHINE spends one exact
 * already-authorized permit and Hebun records the work it authorizes (RUNG 1).
 *
 * ── WHAT THIS IS, STATED AS NARROWLY AS IT IS BUILT ──────────────────────────
 *
 * It is a THIRD CALLER of authorities that already exist, and it is not a second execution engine.
 * Every authority below was released before this module and none of them was widened to admit it:
 *
 *   the arming decision            resolveMachineInternalExecutionEnabled   (RUNG 1 key, released seam)
 *   who may spend                  mintMachineExecutionPrincipal            (Action Authorization)
 *   the single spend               consumeActionPermitAsMachine             (the ONE spend statement)
 *   what the payload means         workInputFrom                            (GIA-1, exported not copied)
 *   the mutation                   recordWorkWithinAsMachine                (Organizational Work)
 *
 * ── WHAT IT DOES NOT DO, AND CANNOT ──────────────────────────────────────────
 *
 * It does not authorize. It cannot: `heby_action_requests_human_approver_chk` and
 * `action_permits_human_authorizer_chk` are DATABASE constraints, so an agent-authorized act is not
 * merely refused here, it is unrepresentable in the control plane. It mints no permit, alters no
 * Governance decision, extends no expiry, and reads no payload the authorization did not carry.
 *
 * It also cannot fall back to a human: there is no `TenantContext` in this module, no parameter that
 * could carry one, and the seams it calls would not accept one if there were.
 *
 * ── ONE ACTION, AND WIDENING IS A CODE CHANGE ────────────────────────────────
 *
 * `MACHINE_EXECUTABLE_ACTION_KINDS` admits exactly `record-work`. It is a frozen set consulted
 * before the permit is touched AND again inside the transaction, and there is no parameter, config
 * value, environment variable or database row that can add to it. Departmental placement and
 * external communication are absent not by omission but by decision: placement moves a second human,
 * and an external send leaves the process, where accepted is not delivered.
 *
 * ── ATOMICITY IS THE PERMIT'S TRANSACTION, NOT THIS MODULE'S ─────────────────
 *
 * The spend, the work row and the audit event commit together or not at all, because the mutation
 * happens inside `onAuthorizedWithin` — the seam R3B added for exactly this. A refusal in the
 * callback throws, the spend rolls back with it, and the permit is still the Director's to spend.
 * This module opens no transaction of its own and holds no database handle it could open one with.
 *
 * ── THERE IS NO TRIGGER HERE ─────────────────────────────────────────────────
 *
 * No scheduler, no timer, no queue, no route and no server action. RUNG 1 makes an authorized act
 * MACHINE-TRIGGERABLE; deciding when to trigger it is a later, separate decision, and a firewall
 * asserts this module has no product-surface caller.
 *
 * Server-only.
 */
import {
  consumeActionPermitAsMachine,
  type PermitConsumptionTx,
} from "@/features/action-authorization/consume-action-permit.server";
import type { ExecutionAuthorization } from "@/features/action-authorization/contracts";
import {
  mintMachineExecutionPrincipal,
  type MachineExecutionPrincipal,
  type MachinePrincipalRefusal,
} from "@/features/action-authorization/machine-execution-principal.server";
import { RECORD_WORK_ACTION_KIND } from "@/features/heby-action-inlet/contracts";
import { workInputFrom } from "@/features/governed-internal-action/execute-record-work.server";
import { recordWorkWithinAsMachine } from "@/features/organizational-work/write-work.server";
import type { WorkWriteResult } from "@/features/organizational-work/write-work.server";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import type { ControlPlaneDatabase } from "@/db/client.server";
import {
  resolveMachineInternalExecutionEnabled,
  type MachineExecutionControlDeps,
} from "./machine-execution-control.server";

/**
 * THE ALLOWLIST. One entry, frozen, and consulted rather than assumed.
 *
 * A `Set` of one looks like overengineering until the alternative is read: an `=== RECORD_WORK`
 * comparison invites the next author to write `|| === SOMETHING_ELSE`, whereas adding a member here
 * is a visible decision in a diff a reviewer reads as one.
 */
export const MACHINE_EXECUTABLE_ACTION_KINDS: ReadonlySet<string> = Object.freeze(
  new Set<string>([RECORD_WORK_ACTION_KIND]),
) as ReadonlySet<string>;

export type MachineRecordWorkRefusal =
  /** The Director has not armed machine-triggered internal execution. Nothing was read. */
  | "machine-execution-disarmed"
  /** The principal could not be minted. Carries the permit authority's own reason. */
  | MachinePrincipalRefusal
  /** The permit authorizes an act no machine may trigger. The spend was rolled back. */
  | "action-kind-not-machine-executable"
  /** The approved payload does not describe recordable work. The spend was rolled back. */
  | "payload-not-recordable"
  /** The Work Authority refused. The spend was rolled back and no row exists. */
  | "work-authority-refused"
  /** The permit could not be spent — already spent, expired, revoked, or gone. */
  | "permit-not-consumable"
  /** The control plane could not be reached. Nothing was authorized and nothing was written. */
  | "execution-unavailable";

export type MachineRecordWorkResult =
  | {
      readonly status: "executed";
      /** Proof of EXECUTION, distinct from the mutation's success. */
      readonly permitId: string;
      readonly handoffId: string;
      /** The run this execution was recorded under, and the audit correlation for it. */
      readonly invocationId: string;
      /** WHO TRIGGERED IT. The durable agent that originated the request. */
      readonly agentId: string;
      readonly outcome: WorkWriteResult;
    }
  | {
      readonly status: "refused";
      readonly reason: MachineRecordWorkRefusal;
      /** The owning authority's own words, when it was the one that refused. */
      readonly authorityReason?: string;
    };

export interface MachineRecordWorkDeps extends MachineExecutionControlDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly consume?: typeof consumeActionPermitAsMachine;
  readonly mint?: typeof mintMachineExecutionPrincipal;
  readonly recordWithin?: typeof recordWorkWithinAsMachine;
  readonly armed?: typeof resolveMachineInternalExecutionEnabled;
}

/** Aborts the callback, and with it the transaction that was spending the permit. */
class AbortMachineAct extends Error {}

/**
 * PERFORM ONE MACHINE-TRIGGERED GOVERNED INTERNAL ACT.
 *
 * The caller supplies a permit id and nothing else — no tenant, no agent, no payload, no action
 * kind. Everything else is read from rows the caller does not control.
 */
export async function executeRecordWorkAsMachine(
  input: { readonly permitId: string },
  deps: MachineRecordWorkDeps = {},
): Promise<MachineRecordWorkResult> {
  if (typeof window !== "undefined") {
    throw new Error("Machine-triggered execution is server-only.");
  }

  const armed = deps.armed ?? resolveMachineInternalExecutionEnabled;
  const mint = deps.mint ?? mintMachineExecutionPrincipal;
  const consume = deps.consume ?? consumeActionPermitAsMachine;
  const recordWithin = deps.recordWithin ?? recordWorkWithinAsMachine;

  /* ARMING IS READ FIRST, so a disarmed deployment never spends a permit to discover it. */
  if (!(await armed(deps))) return { status: "refused", reason: "machine-execution-disarmed" };

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "refused", reason: "execution-unavailable" };

  const minted = await mint(db, { permitId: String(input?.permitId ?? "") });
  if (minted.status !== "minted") return { status: "refused", reason: minted.reason };
  const principal: MachineExecutionPrincipal = minted.principal;

  /*
   * THE ALLOWLIST, BEFORE THE SPEND. Checked again inside the transaction below — not because this
   * check is unreliable, but because the in-transaction check is the one that is atomic with it.
   */
  if (!MACHINE_EXECUTABLE_ACTION_KINDS.has(principal.actionKind)) {
    return { status: "refused", reason: "action-kind-not-machine-executable" };
  }

  let outcome: WorkWriteResult | null = null;
  let refusal: MachineRecordWorkRefusal | null = null;
  /* Read back through a widened alias: the closures below assign it, which TS cannot see. */
  const capturedRefusal = () => refusal as MachineRecordWorkRefusal | null;
  let authorityReason: string | undefined;

  const abort = (reason: MachineRecordWorkRefusal, detail?: string): never => {
    refusal = reason;
    authorityReason = detail;
    throw new AbortMachineAct(reason);
  };

  let consumption: Awaited<ReturnType<typeof consumeActionPermitAsMachine>>;
  try {
    consumption = await consume(principal, {
      ...deps,
      async onAuthorizedWithin(tx: PermitConsumptionTx, authorization: ExecutionAuthorization) {
        /*
         * THE AUTHORIZATION IS RE-READ, NOT THE PRINCIPAL. The principal reported what the request
         * said a moment ago; this is what the spend just proved it says. They agree in every normal
         * case, and when they do not, the transaction is what settles it.
         */
        if (!MACHINE_EXECUTABLE_ACTION_KINDS.has(authorization.actionKind)) {
          abort("action-kind-not-machine-executable");
        }

        const work = workInputFrom(authorization);
        if (work === null) abort("payload-not-recordable");

        const result = await recordWithin(
          tx,
          {
            tenantId: principal.tenantId,
            agentId: principal.agentId,
            invocationId: principal.invocationId,
          },
          work!,
        );
        if (result.status !== "recorded") abort("work-authority-refused", result.reason);
        outcome = result;
      },
    });
  } catch {
    return { status: "refused", reason: capturedRefusal() ?? "execution-unavailable" };
  }

  /*
   * AN ABORT MEANS NOTHING HAPPENED — no work row, no audit row, and a permit that is still active.
   * The captured reason is preferred over whatever the consumer concluded, because the consumer
   * only sees that its callback threw.
   */
  const captured = capturedRefusal();
  if (captured !== null) {
    return { status: "refused", reason: captured, ...(authorityReason ? { authorityReason } : {}) };
  }
  if (consumption.status !== "authorized") {
    return { status: "refused", reason: "permit-not-consumable" };
  }
  if (outcome === null) return { status: "refused", reason: "execution-unavailable" };

  return {
    status: "executed",
    permitId: consumption.authorization.permitId,
    handoffId: consumption.authorization.handoffId,
    invocationId: principal.invocationId,
    agentId: principal.agentId,
    outcome,
  };
}
