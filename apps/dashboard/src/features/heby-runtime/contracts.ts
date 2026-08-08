/*
 * heby-runtime/contracts.ts — the typed runtime that produces REAL, bounded, provenance-
 * first Heby responses and gates the first SAFE (read-only) tool use (UI Phase 16).
 *
 * Phase 15 declared the integration architecture (context/request/response envelopes,
 * capabilities, sources, authority). Phase 16 adds the RUNTIME that resolves real sources,
 * assembles evidence deterministically, and returns validated responses — WITHOUT a model,
 * because discovery proved no real provider/model/credentials exist in this repository
 * (every provider surface is explicitly "simulation only, no SDK, no network, no
 * credentials, no live inference"). The model boundary therefore reports UNAVAILABLE
 * honestly; it is the seam a future, separately-authorized live runtime would replace.
 *
 * Invariants: model output (when it ever exists) is UNTRUSTED and advisory — it never
 * becomes evidence, authority, approval, policy, memory, or execution. Evidence identity
 * comes only from the retrieval layer, never from generated text. No tool runs because a
 * model suggested it; every tool passes capability → governance → authority gates and only
 * READ_ONLY tools are invokable. No secret, no chain-of-thought, no fabricated result.
 *
 * Builds on @/features/heby-integration and @/features/heby-core without modifying them.
 */

import type {
  HebyAuthorityMode,
  HebyEvidenceReference,
  HebyProductIntent,
  HebyProvenanceFacet,
  HebySourceClass,
  HebyUncertaintyState,
  HebyWorkspaceId,
} from "@/features/heby-integration";

/* ===========================================================================
 * 1. MODEL / REASONING BOUNDARY
 *
 * The honest state of the model runtime. In Phase 16 it is always unavailable; the
 * `reason` is a machine-readable code, never fabricated telemetry.
 * ========================================================================= */

export type ModelAdapterReason =
  | "no-provider-configured"
  | "no-credentials"
  | "provider-unavailable"
  | "not-authorized-for-heby";

export interface ModelAdapterStatus {
  /** Whether a real, authorized model runtime is connected. Always false in Phase 16. */
  readonly available: boolean;
  readonly reason: ModelAdapterReason;
  /** Honest, static explanation for the UI. */
  readonly detail: string;
}

/* ===========================================================================
 * 2. SOURCE RESOLUTION RESULT
 *
 * A per-source-class retrieval result. Source-specific and deterministic; provenance is
 * preserved from retrieval to response. A source is either resolved to real derived
 * material or reported unavailable/restricted — never fabricated.
 * ========================================================================= */

export type SourceResolutionState = "resolved" | "unavailable" | "restricted";

export interface ResolvedSourceItem {
  /** Stable reference the retrieval layer owns — the model can never invent this. */
  readonly recordRef: string;
  readonly label: string;
  /** A short, real, machine-derived detail (e.g. a health state or reason code). */
  readonly detail: string;
  readonly lifecycle: "settled" | "superseded" | "retired" | "unknown";
}

export interface SourceResolution {
  readonly sourceClass: HebySourceClass;
  readonly state: SourceResolutionState;
  /** Provenance statement carried unchanged into the response. */
  readonly provenance: string;
  /** Whether the material is authoritative organizational truth (Executive Overview: no). */
  readonly authoritative: boolean;
  readonly items: readonly ResolvedSourceItem[];
  /** Why the source could not be resolved, when state ≠ resolved. */
  readonly unavailableReason?: string;
}

/* ===========================================================================
 * 3. RESPONSE TYPES
 *
 * The smallest useful typed response classes — never a generic untyped chat string.
 * ========================================================================= */

export type HebyResponseKind =
  | "EXPLANATION"
  | "SUMMARY"
  | "EVIDENCE_TRACE"
  | "UNCERTAINTY_ASSESSMENT"
  | "ADVISORY_RECOMMENDATION"
  | "REVIEW_PREPARATION"
  | "NAVIGATION"
  | "UNAVAILABLE";

/** How the response body was produced — so the UI never styles model prose as truth. */
export type ResponseOrigin = "deterministic" | "model";

export interface HebyRuntimeResponse {
  readonly kind: HebyResponseKind;
  /** Deterministic = assembled from real retrieval; model = validated model output. */
  readonly origin: ResponseOrigin;
  readonly title: string;
  /** Concise, bounded body lines. Rationale/summary only — never chain-of-thought. */
  readonly body: readonly string[];
  readonly evidence: readonly HebyEvidenceReference[];
  readonly provenance: readonly string[];
  readonly provenanceCovered: readonly HebyProvenanceFacet[];
  readonly uncertainty: HebyUncertaintyState;
  readonly limitations: readonly string[];
  readonly authority: HebyAuthorityMode;
  /** Optional in-app navigation target the human may follow (never auto-followed). */
  readonly navigationTarget?: { readonly route: string; readonly label: string };
  /** Whether a real model produced any of this. Always false in Phase 16. */
  readonly modelUsed: boolean;
}

/* ===========================================================================
 * 4. TOOL CONTRACTS
 *
 * A Heby tool is NOT any repo function. It is a declared, gated capability with a
 * side-effect class. Phase 16 registers only READ_ONLY tools.
 * ========================================================================= */

export type ToolSideEffectClass =
  | "READ_ONLY"
  | "PREPARATION_ONLY"
  | "REVERSIBLE_MUTATION"
  | "CONSEQUENTIAL_MUTATION"
  | "DEVICE_ACTION";

/** Side-effect classes a tool may actually be invoked at in Phase 16. */
export const INVOKABLE_SIDE_EFFECTS: readonly ToolSideEffectClass[] = ["READ_ONLY"] as const;

export interface ToolDefinition {
  readonly toolId: string;
  /** The declared Heby capability family this tool serves. */
  readonly capability: string;
  readonly sideEffect: ToolSideEffectClass;
  readonly authorityRequirement: HebyAuthorityMode;
  /** Whether a governance check applies before invocation. */
  readonly governanceGated: boolean;
  /** Whether the tool is connected and invokable now. */
  readonly available: boolean;
  readonly inputSummary: string;
  readonly outputSummary: string;
  readonly describes: string;
}

export type ToolResultState =
  | "SUCCESS"
  | "UNAVAILABLE"
  | "RESTRICTED"
  | "FAILED"
  | "REQUIRES_HUMAN_REVIEW";

export interface HebyToolResult {
  readonly toolId: string;
  readonly state: ToolResultState;
  /** Whether any side effect actually occurred. READ_ONLY tools: always false. */
  readonly sideEffectOccurred: boolean;
  readonly evidence: readonly HebyEvidenceReference[];
  readonly provenance: readonly string[];
  /** Human-readable effect/limitation summary — never a fabricated success. */
  readonly summary: string;
  readonly navigationTarget?: { readonly route: string; readonly label: string };
}

/* ===========================================================================
 * 5. RUNTIME OUTCOME
 * ========================================================================= */

/** The context a runtime request runs in. Overview is real, non-authoritative, optional. */
export interface HebyRuntimeContext {
  readonly workspace: HebyWorkspaceId;
  readonly route: string;
  readonly regionLabel?: string;
  readonly entityLabel?: string;
  /**
   * The real Executive Overview (non-authoritative derived system state), supplied by the
   * server shell when available. Absent = system state cannot be inspected honestly.
   */
  readonly overview?: ExecutiveOverviewLike;
}

/**
 * A structural mirror of the real ExecutiveOverview fields the runtime reads. Declared here
 * (rather than importing the class) so the runtime stays decoupled and the panel can pass a
 * plain serializable object. Values are copied from the real read model, never fabricated.
 */
export interface ExecutiveOverviewLike {
  readonly organizationHealth: string;
  readonly criticalAlertCount: number;
  readonly warningCount: number;
  readonly unavailableCount: number;
  readonly freshness: { readonly state: string; readonly ageSeconds?: number };
  readonly sections: readonly {
    readonly sectionId: string;
    readonly label: string;
    readonly health: string;
    readonly sourceState: string;
    readonly recordCount: number;
    readonly reasonCode: string;
  }[];
  readonly authoritative: false;
}

export interface HebyRuntimeOutcome {
  /**
   * The request label. One of the eight Phase 15 product intents, or "NAVIGATE" — a runtime
   * tool label, NOT a member of the Phase 15 product-intent vocabulary (which stays eight).
   */
  readonly intent: HebyProductIntent | "NAVIGATE";
  readonly response: HebyRuntimeResponse;
  /** The model boundary status at the time of the request. */
  readonly model: ModelAdapterStatus;
}
