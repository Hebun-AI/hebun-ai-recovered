/*
 * Production external-send arming — THE GATE R5.1 AND G4 DEFERRED, AND NOTHING MORE.
 *
 * ── WHY THIS FILE EXISTS AT ALL ──────────────────────────────────────────────
 *
 * `provider-connectivity.ts` (the CLI) refuses `external-send` in a production posture, and says
 * why in its own words: "arming it sends real messages to real recipients and that reachability
 * belongs to its own gate… It is a DEFERRAL with a named owner, not a prohibition: production
 * arming earns its own gate, where the send configuration, the recipient authority and the blast
 * radius are the subject rather than a side effect of a connectivity change."
 *
 * This is that gate. It exists to make those three things THE SUBJECT.
 *
 * ── WHAT IT IS NOT ───────────────────────────────────────────────────────────
 *
 * It is NOT a second state owner. `provider_connectivity_controls` remains the one authoritative
 * row, and the write still happens through `setProviderConnectivity` — the same function, with the
 * same four columns, the same optimistic predicate and the same configuration refusal. This module
 * writes nothing and holds no state.
 *
 * It is NOT a second authority. The root of trust is unchanged: POSSESSION OF THE DEPLOYMENT,
 * proved by G4's released signal and a pinned cluster. No new token, role, principal or allowlist
 * is introduced, and `updated_by` stays NULL for the reason R5.2 recorded — a trust root causes an
 * operation without identifying the human who operated it.
 *
 * It is NOT an execution authority. Arming makes external send REACHABLE. It approves no request,
 * mints no permit, performs no send, and touches no request, permit or attempt row. After arming,
 * an execution still requires a Governance decision, a permit, and R3B's own transaction.
 *
 *     ARMED != AUTHORIZED        REACHABLE != APPROVED        CONFIGURED != VERIFIED
 *
 * ── WHY DISARMING IS EASIER THAN ARMING, DELIBERATELY ────────────────────────
 *
 * The writer already states the rule for its own configuration gate: "Only ENABLING is gated: a
 * kill switch that could not be turned off under a degraded configuration would be the wrong
 * failure direction." The same asymmetry governs this gate. Arming must satisfy every precondition
 * below; DISARMING satisfies none of them, because a kill switch you cannot pull in a hurry is not
 * a kill switch. A gate that could arm production sending and not close it again would be a
 * one-way door, and building one would be worse than building nothing.
 *
 * No credential, sender or subject VALUE is read, printed, returned or persisted anywhere in this
 * module. Presence is a boolean; the diagnostics carry environment variable NAMES only, the same
 * rule the Google and Picker environments follow.
 */
import {
  EXTERNAL_SEND_API_KEY_ENV,
  EXTERNAL_SEND_FROM_ENV,
  EXTERNAL_SEND_SUBJECT_ENV,
  isExternalSendCredentialPresent,
  resolveExternalSendSender,
  resolveExternalSendSubject,
} from "../../src/features/action-execution-live/resend-email-transport.server";

/** The closed set of directions. Arming and disarming are one capability seen from both ends. */
export type ArmingTransition = "arm" | "disarm";

export const ARMING_TRANSITIONS: readonly ArmingTransition[] = Object.freeze(["arm", "disarm"]);

export function isArmingTransition(value: string | undefined): value is ArmingTransition {
  return ARMING_TRANSITIONS.includes((value ?? "").trim() as ArmingTransition);
}

/**
 * Which configuration keys are present. NAMES and BOOLEANS ONLY — never a value.
 *
 * `missingKeys` is what an operator needs to act, and it is the same shape
 * `resolveGooglePickerEnvironment` returns for the same reason: a diagnostic that quoted the value
 * would teach somebody to paste configuration where it should not go.
 */
export interface ExternalSendConfigurationPresence {
  readonly apiKeyPresent: boolean;
  readonly senderPresent: boolean;
  readonly subjectPresent: boolean;
  readonly missingKeys: readonly string[];
}

export function readConfigurationPresence(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ExternalSendConfigurationPresence {
  const apiKeyPresent = isExternalSendCredentialPresent(env);
  const senderPresent = resolveExternalSendSender(env) !== null;
  const subjectPresent = resolveExternalSendSubject(env) !== null;
  const missingKeys: string[] = [];
  if (!apiKeyPresent) missingKeys.push(EXTERNAL_SEND_API_KEY_ENV);
  if (!senderPresent) missingKeys.push(EXTERNAL_SEND_FROM_ENV);
  if (!subjectPresent) missingKeys.push(EXTERNAL_SEND_SUBJECT_ENV);
  return Object.freeze({
    apiKeyPresent,
    senderPresent,
    subjectPresent,
    missingKeys: Object.freeze(missingKeys),
  });
}

/**
 * What the ceremony learned about who could be sent to.
 *
 * DEPLOYMENT-WIDE, and named that way on purpose. `listActiveRecipients` is tenant-scoped and this
 * ceremony holds no tenant — the switch it arms has no `tenant_id` either, so the honest matching
 * question is deployment-wide. This is a COUNT read directly from the recipient table, not a call
 * into the recipient authority, and calling it one would be a claim this module cannot support.
 */
export interface RecipientReach {
  /** False when the table could not be read at all — never collapsed into "zero recipients". */
  readonly readable: boolean;
  readonly activeRecipients: number;
  /** How many tenants hold at least one active recipient. The blast radius, counted. */
  readonly tenantsWithRecipients: number;
}

/** Why production arming was refused. Each names a different thing for a human to go and do. */
export type ArmingRefusal =
  /** The posture is not production. Local arming is the generic ceremony's job and still works. */
  | "not-production-posture"
  /** One or more of the three deployment values is absent. `missingKeys` names which. */
  | "configuration-incomplete"
  /** The recipient table could not be read. NOT the same as holding no recipients. */
  | "recipient-authority-unavailable"
  /** The deployment holds no active recipient, so arming would enable sending to nobody. */
  | "no-active-recipient"
  /** External send is already armed. Nothing to do, and this ceremony will not re-write a row. */
  | "already-armed"
  /** Disarm was asked for while external send is not armed. An absent row is already disarmed. */
  | "not-armed";

export type ArmingReadiness =
  | { readonly status: "ready"; readonly reach: RecipientReach }
  | { readonly status: "refused"; readonly reason: ArmingRefusal; readonly missingKeys?: readonly string[] };

export interface ArmingEvaluationInput {
  readonly transition: ArmingTransition;
  readonly postureMode: "local" | "production" | "refused";
  /** The control's current state. `undefined` when no row exists, which reads as disarmed. */
  readonly currentlyArmed: boolean | undefined;
  readonly reach: RecipientReach;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

/**
 * Decide whether this production arming may proceed. PURE — no connection, no prompt, no clock.
 *
 * ── THE ORDER IS PART OF THE CONTRACT ────────────────────────────────────────
 *
 * Posture first, because a local operator must be sent to the generic ceremony rather than told
 * about their configuration. Then the current state, so an already-armed deployment is not made to
 * prove preconditions for a change that is not happening. Only then the preconditions that make
 * arming meaningful, in the order an operator can fix them: configuration they own, then
 * recipients they hold.
 */
export function evaluateExternalSendArming(input: ArmingEvaluationInput): ArmingReadiness {
  if (input.postureMode !== "production") {
    return { status: "refused", reason: "not-production-posture" };
  }

  const armed = input.currentlyArmed === true;

  if (input.transition === "disarm") {
    /*
     * NOTHING ELSE IS CHECKED, AND THAT IS THE POINT. See the header: a kill switch that required a
     * healthy configuration to close would fail in the one direction that matters.
     */
    return armed
      ? { status: "ready", reach: input.reach }
      : { status: "refused", reason: "not-armed" };
  }

  if (armed) return { status: "refused", reason: "already-armed" };

  const configuration = readConfigurationPresence(input.env ?? process.env);
  if (configuration.missingKeys.length > 0) {
    return {
      status: "refused",
      reason: "configuration-incomplete",
      missingKeys: configuration.missingKeys,
    };
  }

  /* Unreadable is NOT zero. One is a failed read; the other is a measured emptiness. */
  if (!input.reach.readable) {
    return { status: "refused", reason: "recipient-authority-unavailable" };
  }
  if (input.reach.activeRecipients < 1) {
    return { status: "refused", reason: "no-active-recipient" };
  }

  return { status: "ready", reach: input.reach };
}

/**
 * The exact phrase the operator must retype to arm production sending.
 *
 * Longer than the provider key the generic ceremony asks for, and deliberately unpleasant to type
 * by muscle memory. The generic ceremony guards a boolean; this one guards the moment a deployment
 * becomes able to send real email to real people.
 */
export const PRODUCTION_ARMING_CONFIRMATION = "arm production external send" as const;
export const PRODUCTION_DISARMING_CONFIRMATION = "disarm production external send" as const;

/** What arming does NOT do. Printed before the prompt, never left for an operator to assume. */
export const ARMING_NON_EFFECTS: readonly string[] = Object.freeze([
  "does not approve any action request",
  "does not create, issue or consume a permit",
  "does not execute anything or send any message",
  "does not verify the credential — configured is not verified, and reachable is not authorized",
  "does not narrow the switch to one tenant: the control row has no tenant_id",
]);
