/*
 * action-execution/contracts.ts — the typed vocabulary of "this one act was attempted" (R3B).
 *
 * THE QUESTION THIS PHASE ANSWERS, AND THE ONES IT REFUSES:
 *
 *   ANSWERED   Did Hebun spend this exact authorization on one external act, and what is the
 *              strongest thing it can honestly say about what happened?
 *   REFUSED    Was it delivered? Was it read? Did it work? Should it be retried automatically?
 *              None of those has evidence in this generation, and inventing an answer for any of
 *              them is the failure this phase exists to make structurally impossible.
 *
 * THE FOUR DISTINCTIONS THIS PHASE EXISTS TO KEEP:
 *
 *   APPROVED ≠ EXECUTED
 *   PERMIT CONSUMED ≠ SUCCESS
 *   PROVIDER ACCEPTED ≠ DELIVERED
 *   UNKNOWN ≠ FAILED
 *
 * The last one is the load-bearing member. A lost answer after a dispatched request is not a
 * failure — treating it as one invites a retry that sends twice.
 *
 * Pure types and frozen values. No React, no I/O, no database, no network, no authority.
 */

/**
 * The ONE action kind this generation can execute.
 *
 * Not a list, not configuration, not a lookup. A constant, because "which acts may run" must be a
 * fact you can read in one line rather than a set somebody can extend by adding a row. Gate A
 * ranked all four registered consequential actions and only this one has real substrate on both
 * sides: `restart-workflow`, `grant-permission` and `modify-governance-policy` still point at
 * tables with zero rows and zero writers, and the latter two would additionally create a second
 * Governance authority.
 */
export const EXECUTABLE_ACTION_KIND = "send-external-communication" as const;

/** The tool id backing {@link EXECUTABLE_ACTION_KIND}, pinned so a registry rename cannot drift. */
export const EXECUTABLE_TOOL_ID = "heby.operations.send-communication" as const;

/**
 * The kill-switch key for outbound external sends.
 *
 * A SEPARATE ROW in `provider_connectivity_controls`, never a second table and never the `claude`
 * row. Model connectivity and outbound sending are different permissions with different blast
 * radii, and a Director who enables Hebun to think must not thereby have enabled it to act.
 */
export const EXTERNAL_SEND_PROVIDER_KEY = "external-send" as const;

/** The `audit_log.action` this phase owns. Exactly one — an attempt is one authority-bearing event. */
export const EXECUTION_AUDIT_ATTEMPTED = "governance.action.execution.attempted" as const;

/** The `audit_log.entity_type` for execution events. The entity is the attempt. */
export const EXECUTION_ATTEMPT_ENTITY_TYPE = "action_execution_attempt" as const;

/** Mirrors `action_execution_attempt_status`. See `_enums.ts` for why each value exists. */
export type ExecutionAttemptStatus = "pending" | "accepted" | "refused" | "failed" | "unknown";

/** Mirrors `action_execution_provider_response_class`. */
export type ProviderResponseClass = "accepted" | "rejected" | "unreachable" | "ambiguous";

/** Mirrors `action_execution_failure_class`. */
export type ExecutionFailureClass =
  | "authorization-invalid"
  | "recipient-retired"
  | "artifact-retired"
  | "artifact-unresolvable"
  | "digest-mismatch"
  | "execution-disabled"
  | "credential-unavailable"
  | "adapter-unavailable"
  | "provider-rejected"
  | "provider-unreachable"
  | "internal-persistence-failure";

/**
 * A refusal that happened BEFORE the permit was spent.
 *
 * Distinct from {@link ExecutionFailureClass} on purpose: these leave the permit ACTIVE and write
 * no attempt row, so the Director can fix the cause and execute the same authorization. Collapsing
 * them with post-spend refusals would burn permits for conditions Hebun could see coming.
 */
export type ExecutionPreflightRefusal =
  | "unauthenticated"
  | "persistence-unavailable"
  /** No live permit matched the tenant, id, and active-and-unexpired predicate. */
  | "permit-not-executable"
  /** The permit authorizes an action kind this generation cannot execute. */
  | "action-not-executable"
  | "recipient-retired"
  | "recipient-unresolvable"
  | "artifact-retired"
  | "artifact-unresolvable"
  | "digest-mismatch"
  | "execution-disabled"
  | "adapter-unavailable"
  | "credential-unavailable";

/** What a surface may show about one attempt. Carries no address, no credential, no body. */
export interface ExecutionAttemptView {
  readonly attemptId: string;
  readonly permitId: string;
  readonly handoffId: string;
  readonly requestId: string;
  readonly actionKind: string;
  readonly adapterId: string;
  readonly status: ExecutionAttemptStatus;
  readonly providerResponseClass: ProviderResponseClass | null;
  readonly providerMessageId: string | null;
  readonly failureClass: ExecutionFailureClass | null;
  readonly recipientId: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
}

export type ExecutionResult =
  /** The adapter ran. `attempt.status` carries what the provider said. */
  | { readonly status: "attempted"; readonly attempt: ExecutionAttemptView }
  /**
   * The permit was spent and Hebun then declined — the world changed inside the transaction, or
   * the switch closed between commit and dispatch. An attempt row EXISTS and the permit is spent.
   */
  | { readonly status: "refused-after-spend"; readonly attempt: ExecutionAttemptView }
  /** Nothing was spent and no attempt exists. The same permit can still be executed later. */
  | { readonly status: "refused"; readonly reason: ExecutionPreflightRefusal };

/**
 * THE PRODUCT WORDING, as values rather than prose, so a test can pin what the surface says.
 *
 * Same shape as `ACTION_PERMIT_EFFECT` / `ACTION_PERMIT_NON_EFFECTS`. Every string here is
 * deliberately weaker than the one a reader expects, and that is the point.
 */
export const EXECUTION_OUTCOME_WORDING: Readonly<Record<ExecutionAttemptStatus, string>> =
  Object.freeze({
    pending: "Attempting — the outcome is not yet known.",
    accepted: "Accepted by the provider.",
    refused: "Refused before anything was sent.",
    failed: "Failed — nothing was sent.",
    unknown:
      "Unknown — the request was sent and the answer was lost. The provider may have accepted it. Do not retry blindly.",
  });

/** What claiming `accepted` does NOT mean. Rendered, not implied. */
export const PROVIDER_ACCEPTANCE_NON_CLAIMS: readonly string[] = Object.freeze([
  "does not mean the message was delivered",
  "does not mean the recipient received it",
  "does not mean the recipient read it",
  "does not mean the recipient acted on it",
  "does not mean the address is valid or owned by anyone",
]);

/**
 * THE RETRY DOCTRINE — generation one, stated as a value so a test can assert nothing softened it.
 *
 * There is no backoff, no queue, no worker and no automatic second attempt anywhere in this
 * feature. A second real send is a second external effect, and a second external effect requires a
 * second authorization: a new human decision, a new permit, a new attempt.
 */
export const EXECUTION_RETRY_POLICY = Object.freeze({
  automaticRetries: 0 as const,
  retriesUnknownOutcomes: false as const,
  requiresNewDecisionToRetry: true as const,
  rationale:
    "An UNKNOWN outcome means the provider may already have accepted the request. Retrying it " +
    "automatically would send twice, and no reconciliation feed exists in this generation to " +
    "prove otherwise.",
});
