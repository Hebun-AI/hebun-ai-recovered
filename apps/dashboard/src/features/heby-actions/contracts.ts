/*
 * heby-actions/contracts.ts — the typed ACTION LIFECYCLE that lets Heby PREPARE and ROUTE
 * consequential work without ever silently authorizing or executing it (UI Phase 17).
 *
 * Phase 16 gave Heby a SAFE, read-only tool gate. Phase 17 extends that gate into the full
 * lifecycle the Phase 15 `future-boundaries.ts` reserved:
 *
 *   INTENT → EVIDENCE → PROPOSED ACTION → PREPARATION → CAPABILITY → GOVERNANCE → AUTHORITY
 *          → HUMAN REVIEW (when required) → EXECUTION ELIGIBILITY → CONTROLLED INVOCATION
 *          → RESULT VALIDATION → RECEIPT / PROVENANCE → OUTCOME
 *
 * The core invariant is that these are DISTINCT states that never collapse into one another:
 *
 *   Heby MAY understand, explain, PREPARE, PROPOSE, and ROUTE.
 *   Heby MUST NOT silently AUTHORIZE or EXECUTE a consequential action.
 *
 * So "prepared" ≠ "authorized" ≠ "executed", and "eligible" ≠ "executed". The Director (or an
 * authorized human) remains the decision boundary; nothing here manufactures an approval, an
 * authority decision, an execution receipt, a tool result, or an audit record.
 *
 * Honesty over feature-completeness: discovery proved there is NO real execution dispatcher, NO
 * approval/decision persistence, NO live governance/policy evaluator, NO audit persistence, and
 * NO model provider in this repository (every such surface is contract-only, in-memory, or
 * mock). Phase 17 therefore implements the WHOLE lifecycle while only READ_ONLY actions are
 * actually invokable — every mutation stays honestly non-executable, its requirements reported
 * as unmet/not-connected rather than faked.
 *
 * This file introduces NO model, network, provider, shell, filesystem, device, secret, or
 * timestamp of its own. Time is expressed as an OPTIONAL caller-supplied logical tick, never a
 * fabricated wall clock. It builds on @/features/heby-runtime, @/features/heby-integration, and
 * @/features/heby-core WITHOUT modifying them, and reuses their canonical vocabulary rather than
 * inventing parallel semantics.
 */

import type {
  HebyAuthorityMode,
  HebyEvidenceReference,
  HebyProvenanceFacet,
  HebySourceClass,
  HebyUncertaintyState,
  HebyWorkspaceId,
} from "@/features/heby-integration";
import type {
  HebyToolResult,
  ToolResultState,
  ToolSideEffectClass,
} from "@/features/heby-runtime";

/* Re-export the canonical side-effect vocabulary so callers of heby-actions never redeclare it.
 * Phase 17 carries the Phase 16 classes forward UNCHANGED — no overlapping category is added. */
export type { ToolSideEffectClass, ToolResultState } from "@/features/heby-runtime";

/* ===========================================================================
 * 1. ACTION LIFECYCLE STATE
 *
 * A typed lifecycle. It deliberately REUSES the canonical vocabulary already published by
 * heby-runtime (`ToolResultState`: SUCCESS/UNAVAILABLE/RESTRICTED/FAILED/REQUIRES_HUMAN_REVIEW)
 * and heby-core (approval decisionState pending-only; a decision is a HUMAN act) instead of
 * inventing a second parallel enum. The transient states the Director's brief listed
 * (PREPARING/VALIDATING/EXECUTING) collapse in a synchronous, deterministic runtime: there is
 * no async work to animate, and faking progress would be dishonest. There is intentionally NO
 * `AUTHORIZED` state Heby can produce — authorization is a human act with no persisted substrate
 * here, so an "AUTHORIZED" label would be fabrication. A mutation stays REQUIRES_HUMAN_REVIEW.
 * ========================================================================= */

export type HebyActionLifecycleState =
  /** A typed ActionRequest exists. Nothing has been prepared, checked, or run. */
  | "PROPOSED"
  /** Arguments validated and gate requirements computed. NOT authorized, NOT executed. */
  | "PREPARED"
  /** A governance requirement is unmet or not connected to a live evaluator. Blocks eligibility. */
  | "REQUIRES_GOVERNANCE"
  /** Human authority is required before this could ever run. Heby prepares; it does not decide. */
  | "REQUIRES_HUMAN_REVIEW"
  /** The side-effect class is not permitted to run here (e.g. DEVICE_ACTION). */
  | "RESTRICTED"
  /** The tool/substrate needed to run this is not connected. Honest, not a failure of the user. */
  | "UNAVAILABLE"
  /** All gates pass and the action is READ_ONLY — the only class invokable in Phase 17. */
  | "EXECUTION_ELIGIBLE"
  /** A READ_ONLY invocation completed and produced a validated receipt. */
  | "EXECUTED"
  /** Preparation, validation, invocation, or receipt validation failed closed. */
  | "FAILED"
  /** The preparation was staled by a logical clock, changed target state, or stale evidence. */
  | "EXPIRED"
  /** A human authority declined it. Heby NEVER produces this itself — it is a human outcome. */
  | "REJECTED"
  /** Withdrawn before execution. Heby NEVER produces this itself — it is a caller/human outcome. */
  | "CANCELLED";

export interface HebyActionLifecycleDescriptor {
  readonly state: HebyActionLifecycleState;
  /** Canonical ordering. Ordinal only — not a rank. */
  readonly order: number;
  /** Whether no further transition is expected from this state within a single runtime pass. */
  readonly terminal: boolean;
  /** Whether the deterministic Heby runtime may itself place an action into this state. */
  readonly producedByHeby: boolean;
  /** Whether an action in this state has actually caused a side effect. */
  readonly sideEffectOccurred: boolean;
  readonly label: string;
}

export const HEBY_ACTION_LIFECYCLE_DESCRIPTORS: Readonly<
  Record<HebyActionLifecycleState, HebyActionLifecycleDescriptor>
> = Object.freeze({
  PROPOSED: Object.freeze({ state: "PROPOSED", order: 0, terminal: false, producedByHeby: true, sideEffectOccurred: false, label: "Proposed" }),
  PREPARED: Object.freeze({ state: "PREPARED", order: 1, terminal: false, producedByHeby: true, sideEffectOccurred: false, label: "Prepared" }),
  REQUIRES_GOVERNANCE: Object.freeze({ state: "REQUIRES_GOVERNANCE", order: 2, terminal: true, producedByHeby: true, sideEffectOccurred: false, label: "Requires governance" }),
  REQUIRES_HUMAN_REVIEW: Object.freeze({ state: "REQUIRES_HUMAN_REVIEW", order: 3, terminal: true, producedByHeby: true, sideEffectOccurred: false, label: "Requires human review" }),
  RESTRICTED: Object.freeze({ state: "RESTRICTED", order: 4, terminal: true, producedByHeby: true, sideEffectOccurred: false, label: "Restricted" }),
  UNAVAILABLE: Object.freeze({ state: "UNAVAILABLE", order: 5, terminal: true, producedByHeby: true, sideEffectOccurred: false, label: "Unavailable" }),
  EXECUTION_ELIGIBLE: Object.freeze({ state: "EXECUTION_ELIGIBLE", order: 6, terminal: false, producedByHeby: true, sideEffectOccurred: false, label: "Execution eligible" }),
  EXECUTED: Object.freeze({ state: "EXECUTED", order: 7, terminal: true, producedByHeby: true, sideEffectOccurred: false, label: "Executed" }),
  FAILED: Object.freeze({ state: "FAILED", order: 8, terminal: true, producedByHeby: true, sideEffectOccurred: false, label: "Failed" }),
  EXPIRED: Object.freeze({ state: "EXPIRED", order: 9, terminal: true, producedByHeby: true, sideEffectOccurred: false, label: "Expired" }),
  REJECTED: Object.freeze({ state: "REJECTED", order: 10, terminal: true, producedByHeby: false, sideEffectOccurred: false, label: "Rejected" }),
  CANCELLED: Object.freeze({ state: "CANCELLED", order: 11, terminal: true, producedByHeby: false, sideEffectOccurred: false, label: "Cancelled" }),
});

export const HEBY_ACTION_LIFECYCLE_STATES: readonly HebyActionLifecycleState[] = Object.freeze([
  "PROPOSED", "PREPARED", "REQUIRES_GOVERNANCE", "REQUIRES_HUMAN_REVIEW", "RESTRICTED",
  "UNAVAILABLE", "EXECUTION_ELIGIBLE", "EXECUTED", "FAILED", "EXPIRED", "REJECTED", "CANCELLED",
]);

/* ===========================================================================
 * 2. ARGUMENT SCHEMA (typed — never free-form model text → raw invocation)
 *
 * A tool argument is never a free-form string a model produced. Every argument is a declared,
 * typed field; the argument set is validated against the schema and FAILS CLOSED on an unknown
 * key, a missing required field, a wrong type, or a value outside a declared enum. This is the
 * seam that keeps "model output" from ever becoming a raw call.
 * ========================================================================= */

export type HebyArgumentKind =
  | "string"
  | "number"
  | "boolean"
  /** A value that must be one of `enumValues`. */
  | "enum"
  /** A stable record reference the retrieval layer owns — never invented from prose. */
  | "record-ref"
  /** A real in-app route. */
  | "route"
  /** A known workspace identity. */
  | "workspace";

export interface HebyArgumentField {
  readonly name: string;
  readonly kind: HebyArgumentKind;
  readonly required: boolean;
  /** Allowed values when `kind` is "enum". */
  readonly enumValues?: readonly string[];
  readonly describes: string;
}

export interface HebyArgumentSchema {
  readonly fields: readonly HebyArgumentField[];
}

/** A validated, typed argument value carried on a prepared action. Never secret. */
export type HebyArgumentValue = string | number | boolean;

export type HebyArguments = Readonly<Record<string, HebyArgumentValue>>;

/* ===========================================================================
 * 3. ACTION TARGET
 *
 * The concrete thing an action would affect. Typed and validity-checked — Heby never acts on a
 * target it cannot resolve. A target is DATA, not authority: naming a target grants nothing.
 * ========================================================================= */

export type HebyActionTargetKind = "workspace" | "route" | "record" | "system";

export interface HebyActionTarget {
  readonly kind: HebyActionTargetKind;
  /** For record targets, a stable retrieval reference; for route/workspace, the real id. */
  readonly ref: string;
  readonly label: string;
  /** The source class the target belongs to, when it is a record. */
  readonly sourceClass?: HebySourceClass;
}

/* ===========================================================================
 * 4. ACTION KIND (declared, structural instructional vocabulary)
 *
 * The kind of work an action represents. This is a fixed, structural vocabulary — NOT fabricated
 * data. Each kind maps to a capability, a side-effect class, an owning workspace, and an
 * authority requirement in the action registry. Kinds heavier than READ_ONLY exist so the
 * lifecycle is complete and honest, NOT so they run.
 * ========================================================================= */

export type HebyActionKind =
  | "inspect-system-state"
  | "resolve-navigation"
  | "prepare-operational-plan"
  | "restart-workflow"
  | "send-external-communication"
  /**
   * GIA-1 — THE SECOND, AND LAST, EXECUTABLE KIND.
   *
   * Recording one organizational work item, performed by Hebun inside the transaction that spends a
   * human's permit. It is CONSEQUENTIAL and REVERSIBLE: consequential because a durable
   * organizational record with a real audit trail comes into existence, reversible because the
   * Organizational Work Authority owns a deterministic compensating operation (`retireWork`) for
   * exactly this state.
   *
   * REVERSIBLE DOES NOT MEAN ERASABLE. Retiring the item does not undo the creation, does not
   * remove its audit event, and does not roll a committed transaction backwards. It means the
   * organization can withdraw the item through the authority that owns it — which is what
   * "deterministic inverse" has always meant here and nothing more.
   */
  | "record-work"
  | "grant-permission"
  | "modify-governance-policy"
  | "device-action";

/* ===========================================================================
 * 5. REVERSIBILITY
 *
 * Reversibility is a REAL property, not a hope. A mutation is reversible ONLY when a
 * deterministic inverse/rollback operation exists. "Someone could undo it manually later" is
 * NOT reversible — that is consequential. Absent a proven inverse, an action is consequential.
 * ========================================================================= */

export type HebyReversibility =
  /** No state changes; nothing to reverse. */
  | "none"
  /** A real, deterministic inverse/rollback operation exists and is connected. */
  | "deterministic-inverse"
  /** No proven inverse exists — treat as irreversible / consequential. */
  | "irreversible";

/* ===========================================================================
 * 6. ACTION TOOL (a declared, gated, argument-typed capability)
 *
 * Like a Phase 16 ToolDefinition, but extended for the action lifecycle: it carries a typed
 * argument schema, a reversibility classification, the owning workspace, and whether a real
 * execution substrate is connected for its side-effect class. A tool being *declared* or even
 * *capable* never means Heby may use it — availability and the gates decide that.
 * ========================================================================= */

export interface HebyActionTool {
  readonly toolId: string;
  readonly actionKind: HebyActionKind;
  readonly capability: string;
  readonly sideEffect: ToolSideEffectClass;
  readonly reversibility: HebyReversibility;
  /** The workspace that OWNS this capability. No other workspace may prepare it. */
  readonly ownerWorkspace: HebyWorkspaceId;
  readonly authorityRequirement: HebyAuthorityMode;
  readonly governanceGated: boolean;
  /** Whether a real runtime is connected that could invoke this tool's side-effect class. */
  readonly substrateConnected: boolean;
  readonly argumentSchema: HebyArgumentSchema;
  readonly inputSummary: string;
  readonly outputSummary: string;
  readonly describes: string;
}

/* ===========================================================================
 * 7. ACTION REQUEST (the typed proposal — language never jumps to execution)
 *
 * A request is a TYPED proposal, not a sentence. The system never goes from natural language to
 * execution: a request only ever names a declared action kind, a workspace context, a target,
 * and typed argument values to validate. The evidence it was proposed from rides along so
 * freshness can be checked before anything runs.
 * ========================================================================= */

export interface HebyActionRequest {
  readonly actionKind: HebyActionKind;
  /** The workspace the request is made FROM — used to enforce workspace ownership/authority. */
  readonly requestingWorkspace: HebyWorkspaceId;
  readonly target?: HebyActionTarget;
  /** Raw, still-untrusted argument values to validate against the tool's schema. */
  readonly proposedArguments?: Readonly<Record<string, unknown>>;
  /** Evidence the proposal rests on. Identity comes only from retrieval, never from prose. */
  readonly evidence?: readonly HebyEvidenceReference[];
  /** Optional caller-supplied logical clock (monotonic tick). NEVER a fabricated wall clock. */
  readonly proposedAtTick?: number;
}

/* ===========================================================================
 * 8. GATE RESULTS
 *
 * Each gate returns an HONEST, typed verdict. A requirement is `satisfied`, `unmet`, or
 * `not-connected` — never silently "passed". "not-connected" is the truthful state when a
 * contract exists but no live evaluator/substrate backs it; it is NOT a pass.
 * ========================================================================= */

export type HebyRequirementStatus = "satisfied" | "unmet" | "not-connected" | "not-required";

export interface HebyCapabilityGateResult {
  readonly status: HebyRequirementStatus;
  /** Whether the tool is declared at all. */
  readonly toolExists: boolean;
  /** Whether the tool's substrate is connected and available to run its class. */
  readonly available: boolean;
  /** Whether the requesting workspace OWNS (may prepare) this capability. */
  readonly workspacePermitted: boolean;
  /** Whether the target resolved to a real workspace/route/record. */
  readonly targetValid: boolean;
  /** Whether the evidence supplied is sufficient for this action's class. */
  readonly evidenceSufficient: boolean;
  readonly reasons: readonly string[];
}

export interface HebyGovernanceGateResult {
  readonly status: HebyRequirementStatus;
  /** Whether a governance check is required at all for this side-effect class. */
  readonly required: boolean;
  /** Whether a live governance/policy evaluator is connected. Always false in Phase 17. */
  readonly evaluatorConnected: boolean;
  readonly reasons: readonly string[];
}

export interface HebyAuthorityGateResult {
  readonly status: HebyRequirementStatus;
  readonly requirement: HebyAuthorityMode;
  /** Whether Heby itself may act under this requirement. ALWAYS false. */
  readonly hebyMayAct: false;
  /** Whether human review is required before this could ever run. */
  readonly humanReviewRequired: boolean;
  readonly reasons: readonly string[];
}

/* ===========================================================================
 * 9. EVIDENCE FRESHNESS / STALENESS
 * ========================================================================= */

export type HebyEvidenceFreshness = "fresh" | "stale" | "unknown" | "not-required";

export interface HebyStalenessResult {
  readonly freshness: HebyEvidenceFreshness;
  /** Whether the preparation has expired against a caller-supplied logical clock. */
  readonly expired: boolean;
  readonly reasons: readonly string[];
}

/* ===========================================================================
 * 10. PREPARED ACTION (provider-independent; no secret, no hidden reasoning)
 *
 * The honest, inspectable package a human reviews before anything could run. It carries what
 * would happen, to what target, why, the evidence, the expected effect and consequences, the
 * reversibility, the governance/authority/human-review requirements, and the execution
 * eligibility. It contains NO secret value, NO private chain-of-thought, and NO hidden prompt.
 * Heby Core Phase 6 already models a *prepared approval item* (pending-only, consequence-bearing,
 * terminating at the Director); a prepared ACTION is the tool-execution analogue — a distinct
 * representation because it also carries typed arguments, a side-effect class, reversibility, and
 * execution eligibility, which the approval item does not. The pending/consequences/Director
 * semantics are preserved, not duplicated away.
 * ========================================================================= */

export interface HebyPreparedAction {
  /** A deterministic identity derived from the request (see action-preparer). Not fabricated. */
  readonly actionId: string;
  readonly actionKind: HebyActionKind;
  readonly toolId: string;
  readonly capability: string;
  readonly sideEffect: ToolSideEffectClass;
  readonly reversibility: HebyReversibility;
  readonly ownerWorkspace: HebyWorkspaceId;
  readonly requestingWorkspace: HebyWorkspaceId;
  readonly target?: HebyActionTarget;
  /** The validated, typed arguments (empty when validation failed — see `argumentsValid`). */
  readonly arguments: HebyArguments;
  readonly argumentsValid: boolean;
  readonly evidence: readonly HebyEvidenceReference[];
  readonly provenance: readonly string[];
  readonly provenanceCovered: readonly HebyProvenanceFacet[];
  readonly uncertainty: HebyUncertaintyState;
  /** A concise, honest statement of what would happen. Never a claim that it happened. */
  readonly expectedEffect: string;
  /** Consequences a human must understand before authorizing (Heby Core Phase 6 requirement). */
  readonly consequences: readonly string[];
  readonly capabilityGate: HebyCapabilityGateResult;
  readonly governanceGate: HebyGovernanceGateResult;
  readonly authorityGate: HebyAuthorityGateResult;
  readonly staleness: HebyStalenessResult;
  /** The current lifecycle state of this prepared action. */
  readonly lifecycleState: HebyActionLifecycleState;
  /**
   * An idempotency key derived deterministically from the action identity. Replay protection
   * across runs REQUIRES a persistence substrate that is NOT connected; this key exists so a
   * future substrate can dedupe, and so a single runtime session can guard in-memory. It does
   * NOT by itself guarantee idempotency.
   */
  readonly idempotencyKey: string;
  readonly limitations: readonly string[];
}

/* ===========================================================================
 * 11. EXECUTION ELIGIBILITY (eligible ≠ executed)
 *
 * A single, explicit boolean derived ONLY when every gate is satisfied, the action is not
 * stale/expired, and the side-effect class is permitted to run. Eligibility authorizes NOTHING
 * on its own — it is the precondition an invocation checks, never the invocation.
 * ========================================================================= */

export interface HebyExecutionEligibility {
  readonly actionId: string;
  readonly executionEligible: boolean;
  readonly lifecycleState: HebyActionLifecycleState;
  /** Every unmet precondition, named honestly. Empty only when `executionEligible` is true. */
  readonly blockingReasons: readonly string[];
  /** The side-effect class that would run. Only READ_ONLY can ever be eligible in Phase 17. */
  readonly sideEffect: ToolSideEffectClass;
}

/* ===========================================================================
 * 12. EXECUTION RECEIPT + RUNTIME PROVENANCE (distinct from persisted audit)
 *
 * If (and only if) a READ_ONLY action actually runs, it produces a typed receipt. A receipt is a
 * RUNTIME artifact of THIS pass — it is explicitly NOT a persisted audit record, because no
 * audit persistence path exists. It records no fabricated timestamp and no fabricated actor
 * identity; the optional `observedTick` is a caller-supplied logical clock or nothing at all.
 * ========================================================================= */

export interface HebyActionReceipt {
  readonly actionId: string;
  readonly toolId: string;
  readonly executionState: ToolResultState;
  readonly sideEffect: ToolSideEffectClass;
  /** Whether a side effect actually occurred. READ_ONLY: always false. */
  readonly sideEffectOccurred: boolean;
  readonly target?: HebyActionTarget;
  /** The validated tool result, when the tool ran. Absent when nothing ran. */
  readonly toolResult?: HebyToolResult;
  readonly evidence: readonly HebyEvidenceReference[];
  readonly provenance: readonly string[];
  /** The authority basis under which this ran — for READ_ONLY, "advisory-only". Never invented. */
  readonly authorityBasis: HebyAuthorityMode;
  /** The governance basis — "not-required" for READ_ONLY; never a faked "policy passed". */
  readonly governanceBasis: HebyRequirementStatus;
  /** The rollback availability of any effect. */
  readonly reversibility: HebyReversibility;
  /** Present only when the execution failed or was withheld. */
  readonly failureReason?: string;
  /** Optional caller-supplied logical tick. NEVER a fabricated wall-clock time. */
  readonly observedTick?: number;
}

/** Whether a receipt is a truthful proof that a side-effecting action occurred. */
export interface HebyRuntimeProvenanceLink {
  readonly stage:
    | "proposed"
    | "prepared"
    | "capability-checked"
    | "governance-checked"
    | "authority-checked"
    | "eligibility-derived"
    | "invoked"
    | "result-validated";
  readonly outcome: string;
}

/* ===========================================================================
 * 13. ACTION OUTCOME (the single result of running the lifecycle)
 * ========================================================================= */

export interface HebyActionOutcome {
  readonly prepared: HebyPreparedAction;
  readonly eligibility: HebyExecutionEligibility;
  /** The receipt — present only when a READ_ONLY action actually ran and validated. */
  readonly receipt?: HebyActionReceipt;
  /** The in-memory provenance chain for THIS runtime pass. Not a persisted audit record. */
  readonly provenanceChain: readonly HebyRuntimeProvenanceLink[];
  readonly lifecycleState: HebyActionLifecycleState;
}
