/*
 * Production machine-internal-execution arming — THE GATE RUNG 1's ARMING BOUNDARY DEFERRED.
 *
 * ── WHY THIS FILE EXISTS AT ALL ──────────────────────────────────────────────
 *
 * RUNG 1 shipped `machine-internal-execution` as a KEY on the released `resolveDirectorEnabled`
 * seam — a row, not a table — and shipped it with no row anywhere, so the deployed default is
 * DISARMED by absence. What it did not ship was a decision about HOW that row comes to exist in
 * production. The generic connectivity ceremony narrowed production with a single equality against
 * the external-send key, which refused the one key somebody had thought of and admitted every
 * other one. A capability that mutates the organization with no human present at the moment of the
 * act must not inherit its production reachability from a rule shaped like that.
 *
 * So the generic ceremony now refuses this key in production by name, and this is the gate it
 * names. It exists to make the BLAST RADIUS the subject.
 *
 * ── WHAT IT IS NOT ───────────────────────────────────────────────────────────
 *
 * It is NOT a second state owner. `provider_connectivity_controls` remains the one authoritative
 * row, `resolveDirectorEnabled` remains the one reader, and the write still happens through
 * `setProviderConnectivity` — the same function, the same four columns, the same optimistic
 * predicate. This module writes nothing and holds no state of its own.
 *
 * It is NOT a second authority. The root of trust is unchanged: POSSESSION OF THE DEPLOYMENT,
 * proved by G4's released signal and a pinned cluster. No new token, role, principal, allowlist or
 * switch table is introduced, and `updated_by` stays NULL for the reason R5.2 recorded — a trust
 * root causes an operation without identifying the human who operated it.
 *
 * It is NOT an authorization authority, and that is the distinction this whole gate rests on.
 *
 *     ARMING IS CONTROL-PLANE STATE.  AUTHORIZATION IS PERMIT-SPECIFIC.
 *
 * Arming makes machine TRIGGERING reachable. It approves no request, mints no permit, consumes no
 * permit, grants no standing mutation authority and executes nothing. After arming, every single
 * act still requires a human/Governance-authorized permit for that exact act — enforced in the
 * DATABASE by `action_permits_human_authorizer_chk` and `heby_action_requests_human_approver_chk`,
 * not by convention here.
 *
 *     ARMED != AUTHORIZED     REACHABLE != TRIGGERED     TRIGGERABLE != STANDING AUTHORITY
 *
 * ── WHY THE PREREQUISITES ARE SO FEW, DELIBERATELY ───────────────────────────
 *
 * The external-send gate proves configuration and counts recipients because a send needs a
 * credential and somebody to send to. This capability needs neither: it spends no provider quota,
 * calls no external endpoint and reads no customer content. The honest preconditions are therefore
 * only the ones the repository can actually answer — the posture, the current state, and that the
 * RELEASED build still admits exactly the act this arming is about. Requiring an existing permit
 * would be the wrong shape entirely: arming is control-plane state, and a control that could only
 * be turned on while a specific authorization happened to exist would tie two authorities that the
 * architecture keeps apart on purpose.
 *
 * Fabricating a check that reads organizational rows merely to arm a boolean would be security
 * theatre that also widened what this ceremony touches. It touches nothing.
 *
 * ── WHY DISARMING IS EASIER THAN ARMING ──────────────────────────────────────
 *
 * The same asymmetry the sibling gate states in its own words: a kill switch you cannot pull in a
 * hurry is not a kill switch. Disarming satisfies no precondition beyond being armed, and it is
 * reachable in production for exactly that reason. A gate that could arm unattended execution and
 * not close it again would be a one-way door, and building one would be worse than building
 * nothing.
 */
import { MACHINE_EXECUTABLE_ACTION_KINDS } from "../../src/features/governed-machine-execution/execute-record-work-as-machine.server";

/** The closed set of directions. Arming and disarming are one capability seen from both ends. */
export type MachineArmingTransition = "arm" | "disarm";

export const MACHINE_ARMING_TRANSITIONS: readonly MachineArmingTransition[] = Object.freeze([
  "arm",
  "disarm",
]);

export function isMachineArmingTransition(
  value: string | undefined,
): value is MachineArmingTransition {
  return MACHINE_ARMING_TRANSITIONS.includes((value ?? "").trim() as MachineArmingTransition);
}

/**
 * WHAT A MACHINE COULD TRIGGER IF THIS WERE ARMED — read from the released frozen set, never
 * restated. The operator is shown the scope from the same constant the execution seam consults, so
 * the ceremony cannot describe a narrower capability than the build actually holds.
 */
export const MACHINE_EXECUTABLE_SCOPE: readonly string[] = Object.freeze(
  [...MACHINE_EXECUTABLE_ACTION_KINDS].sort(),
);

/** Why arming or disarming was refused. Each names a different thing for a human to go and do. */
export type MachineArmingRefusal =
  /** The posture is not production. Local arming is the generic ceremony's job and still works. */
  | "not-production-posture"
  /**
   * The released build admits no machine-executable act. Arming would enable a capability with
   * nothing it could legitimately do — a switch reading ON whose only function is to mislead.
   */
  | "no-machine-executable-scope"
  /** Already armed. Nothing to do, and this ceremony will not re-write a row. */
  | "already-armed"
  /** Disarm was asked for while it is not armed. An absent row already reads as disarmed. */
  | "not-armed";

export type MachineArmingReadiness =
  | { readonly status: "ready"; readonly scope: readonly string[] }
  | { readonly status: "refused"; readonly reason: MachineArmingRefusal };

export interface MachineArmingEvaluationInput {
  readonly transition: MachineArmingTransition;
  readonly postureMode: "local" | "production" | "refused";
  /** The control's current state. `undefined` when no row exists, which reads as disarmed. */
  readonly currentlyArmed: boolean | undefined;
  /** Injectable so a test can prove the empty-scope refusal without mutating a frozen constant. */
  readonly scope?: readonly string[];
}

/**
 * Decide whether this production arming may proceed. PURE — no connection, no prompt, no clock,
 * no database and no environment.
 *
 * ── THE ORDER IS PART OF THE CONTRACT ────────────────────────────────────────
 *
 * Posture first, so a local operator is sent to the generic ceremony rather than told about scope.
 * Then the current state, so an already-armed deployment is not made to prove preconditions for a
 * change that is not happening — and so DISARM returns before any arming precondition is reached.
 */
export function evaluateMachineExecutionArming(
  input: MachineArmingEvaluationInput,
): MachineArmingReadiness {
  const scope = input.scope ?? MACHINE_EXECUTABLE_SCOPE;

  if (input.postureMode !== "production") {
    return { status: "refused", reason: "not-production-posture" };
  }

  const armed = input.currentlyArmed === true;

  if (input.transition === "disarm") {
    /* NOTHING ELSE IS CHECKED, AND THAT IS THE POINT. See the header. */
    return armed ? { status: "ready", scope } : { status: "refused", reason: "not-armed" };
  }

  if (armed) return { status: "refused", reason: "already-armed" };

  if (scope.length < 1) return { status: "refused", reason: "no-machine-executable-scope" };

  return { status: "ready", scope };
}

/**
 * The exact phrase the operator must retype.
 *
 * Longer than the provider key the generic ceremony asks for, and deliberately unpleasant to type
 * by muscle memory. The generic ceremony guards a boolean; this one guards the moment a deployment
 * becomes able to mutate its own organization with no human present at the moment of the act.
 */
export const MACHINE_PRODUCTION_ARMING_CONFIRMATION =
  "arm production machine internal execution" as const;
export const MACHINE_PRODUCTION_DISARMING_CONFIRMATION =
  "disarm production machine internal execution" as const;

/**
 * WHAT ARMING MEANS. Printed before the prompt, never left for an operator to assume, and phrased
 * so the one thing it DOES is not buried among the things it does not.
 */
export const MACHINE_ARMING_EFFECT: string =
  "permits Hebun to TRIGGER an already human/Governance-authorized exact permit with no human " +
  "Execute click at the moment of the act";

/** What arming does NOT do. Stated by equality so a firewall can assert each claim. */
export const MACHINE_ARMING_NON_EFFECTS: readonly string[] = Object.freeze([
  "does not authorize any action",
  "does not create, issue, approve or consume a permit",
  "does not grant standing mutation authority",
  "does not widen what a machine may trigger: the scope is a frozen set in the released build",
  "does not trigger anything by itself — nothing schedules, times, queues or routes an execution",
  "does not narrow the switch to one tenant: the control row has no tenant_id",
]);
