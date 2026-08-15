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
/*
 * A TYPE-ONLY dependency on the retrieval layer. It carries no runtime import, no database and no
 * authority — retrieval already sits below this module (heby-integration names it), and nothing in
 * knowledge-retrieval imports heby-runtime, so the direction stays one-way.
 */
import type { RetrievalEvidenceSet } from "@/features/knowledge-retrieval";

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
  /**
   * VERBATIM SOURCE TEXT, when the source has any — for example the statement a human recorded as
   * organizational Knowledge. It is DATA, and it is kept separate from `detail` for one reason:
   *
   *   `detail` is machine-derived and flows into Heby's OWN prose (the deterministic response body),
   *   which the response validator scans for claims Heby must never make. Quoted source text does
   *   not belong there — an organizational policy that happens to say "the Director authorized this"
   *   would otherwise read as Heby claiming an action, and the whole response would be withheld.
   *
   * `content` therefore travels ONLY into the model's grounding context, where the system
   * instructions already frame grounding as data that must never be obeyed. Heby's own sentences
   * never contain it.
   */
  readonly content?: string;
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
  /**
   * KR4 — the DERIVED evidence explanation for the reader. Optional and additive.
   *
   * `evidence` above stays the authority on identity: it is what the response validator checks, and
   * a model still cannot introduce a reference that is not in it. This field adds nothing to that
   * set — it explains the SAME retrieval to a human (standing, provenance, matched terms, and the
   * set-level truncation / diversity / exclusion facts KR3 discarded before the UI).
   *
   * ABSENT IS MEANINGFUL AND MUST STAY MEANINGFUL. It is undefined when no retrieval ran, when the
   * source is not Knowledge, or when an injected resolver supplied a resolution with no retrieval
   * behind it. In every one of those cases there is genuinely nothing to explain, and synthesizing
   * an empty set would present "not retrieved" as "retrieved and found nothing".
   */
  readonly knowledgeEvidence?: RetrievalEvidenceSet;
  readonly provenance: readonly string[];
  readonly provenanceCovered: readonly HebyProvenanceFacet[];
  readonly uncertainty: HebyUncertaintyState;
  readonly limitations: readonly string[];
  readonly authority: HebyAuthorityMode;
  /** Optional in-app navigation target the human may follow (never auto-followed). */
  readonly navigationTarget?: { readonly route: string; readonly label: string };
  /** Whether a real model produced any of this. Always false in Phase 16. */
  readonly modelUsed: boolean;
  /**
   * Truthful model attribution — present ONLY on an `origin: "model"` response whose
   * text actually passed through the transport and validator (R2C). It is deliberately
   * SEPARATE from `origin` so transport provenance is never conflated with model origin:
   * a `"fake"` transport is a simulated/test path, never a live provider connection.
   */
  readonly modelAttribution?: HebyModelAttribution;
}

/**
 * Attribution for a model-origin response. Transport provenance is explicit and
 * distinct from model origin: `"fake"` is the R2C simulated/test transport (NOT a
 * live provider connection); `"live"` is reserved for a separately-authorized
 * live-connectivity phase (R2D) and is never produced in R2C.
 */
export interface HebyModelAttribution {
  readonly provider: string;
  readonly modelId: string;
  /** "fake" = simulated/test transport. "live" = a real provider call (not R2C). */
  readonly transport: "fake" | "live";
  readonly correlationId: string;
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

/* ===========================================================================
 * 6. MODEL CONNECTIVITY BOUNDARY (R2B)
 *
 * Provider-neutral contracts for the model-generation seam. R2B builds the
 * connectivity FOUNDATION only: the request/result shapes and the availability
 * classification. Vendor-specific translation and transport live entirely in a
 * separate server-only layer — never here — so this module stays deterministic,
 * secret-free, and safe to import from the client panel.
 *
 * Invariants (unchanged from §1): a model result is UNTRUSTED and advisory. It
 * never becomes evidence, authority, approval, policy, memory, a tool result, or
 * execution. It carries only what a read-only text request needs — no tool, no
 * shell, no filesystem, no device, no mutation surface exists in these shapes.
 * ========================================================================= */

/**
 * The authoritative connectivity classification. `configured` is not `connected`;
 * a present credential is not an authenticated one; a present transport is not a
 * reachable one. Only `AVAILABLE` permits an attempt — never a claim of success.
 */
export type ModelAvailabilityState =
  | "DISABLED"
  | "MISCONFIGURED"
  | "CREDENTIAL_UNAVAILABLE"
  | "TRANSPORT_UNAVAILABLE"
  | "AVAILABLE";

/** A provider-neutral, read-only text-generation request. */
/**
 * One prior conversational turn, provider-neutral. Bounded recent history for CONTINUITY only —
 * it is conversation DATA, never authoritative organizational evidence and never authority. A
 * prior assistant turn must never enter the deterministic evidence set or grant any permission.
 */
export interface ConversationTurn {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface ModelGenerationRequest {
  /** Request correlation id (never a secret). */
  readonly correlationId: string;
  /**
   * Tenant attribution. Supplied only server-side from the authoritative R1
   * TenantContext — never accepted as authority from client input. Optional here
   * because the R2C server boundary owns populating it.
   */
  readonly tenantId?: string;
  /** System instructions (bounded; never chain-of-thought elicitation). */
  readonly systemInstructions: string;
  /** The human's question. */
  readonly userPrompt: string;
  /** Grounding context lines. Treated as DATA, never as instructions. */
  readonly evidence: readonly string[];
  /** Explicit model id. Never derived from a seeded/display model record. */
  readonly modelId: string;
  /** Hard output-size bound. */
  readonly maxOutputTokens: number;
  /**
   * Bounded recent conversation history for continuity (oldest→newest), EXCLUDING the current
   * turn. Optional and bounded. It is conversation DATA only — never evidence, never authority.
   * Absent for a fresh conversation.
   */
  readonly history?: readonly ConversationTurn[];
}

/**
 * A validated, provider-neutral model result. Unknown provider values stay
 * `undefined` — never invented. `origin` is `"model"` only because the text
 * actually passed through the transport and validator.
 */
export interface ModelGenerationResult {
  readonly text: string;
  readonly provider: string;
  readonly model: string;
  readonly origin: Extract<ResponseOrigin, "model">;
  readonly correlationId: string;
  /** Provider-assigned request id, when the provider returns one. */
  readonly providerRequestId?: string;
  /** Real token usage, only when the provider reports it. */
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  /** Provider stop reason, when present. */
  readonly stopReason?: string;
  /** Measured wall-clock latency in ms — only when actually measured. */
  readonly latencyMs?: number;
}
