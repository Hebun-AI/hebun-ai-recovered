/**
 * Heby Core — composition contracts (Phase 9, Integration and Composition Closure).
 *
 * Declares what the end-to-end Heby composition IS: the shapes through which Heby, at closure,
 * COMPOSES the published Phase 1–8 boundaries into one stateless presentation over a fixed
 * identity, a bound context, and settled read-only inputs — proving the complete path from the
 * admitted upstream material to the Director briefing, and closing Heby's composition. It runs
 * each published boundary in order, threads each stage's real output into the next, records an
 * ordered stage ledger as replay proof, and verifies cross-phase consistency at every seam.
 *
 * Phase 9 COMPOSES and VERIFIES ONLY. It introduces no execution path, no hidden state, no
 * autonomy, and no Director bypass. It regenerates and reinterprets nothing — it consumes the
 * published outputs exactly as produced. It creates NO authority that did not exist in Phase
 * 1–8: it never approves, rejects, decides, resolves a decision, advances past the Director,
 * executes, triggers a workflow, orchestrates, invents, fabricates confidence, suppresses
 * uncertainty, waives Governance, reinterprets Security, calls a model, trusts model output,
 * mutates any upstream system, invokes an API, or bypasses the Director. Every boundary holds
 * under composition; identity remains immutable throughout; the pass is idempotent, replayable,
 * and auditable. There is no engine, no algorithm, no persistence, no AI, no agent, no registry,
 * no cache, no scheduler, no API, and no UI here — only immutable, readonly declarations over
 * the composed boundaries.
 *
 * Authority: docs/product-vision/heby-vision.md, heby-architecture.md, heby-roadmap.md.
 * Builds on Heby Core Phases 1–8 (Identity, Input and Context, Presentation, Grounding, Intent,
 * Approval Preparation, Governance and Security, Director Briefing).
 */

import type { HebyId, HebyStatement } from "@/features/heby-core/heby-identity-types";
import type { CanonicalHebyIdentity } from "@/features/heby-core/heby-identity-types";
import type { HebyAdmissionRequest } from "@/features/heby-core/heby-input-context-types";
import type { HebyExplanationEntry, HebyPresentationElement } from "@/features/heby-core/heby-presentation-types";
import type { HebyProposedIntent, HebyUtterance } from "@/features/heby-core/heby-intent-types";
import type { HebyPreparedItem } from "@/features/heby-core/heby-approval-types";
import type { HebyGovernanceScope } from "@/features/heby-core/heby-governance-types";
import type {
  HebyBriefingFinding,
  HebyBriefingHistory,
  HebyCarriedQuestion,
  HebyDirectorBriefing,
  HebyRecordedDecision,
} from "@/features/heby-core/heby-briefing-types";

// --- Composition phase -------------------------------------------------------

/**
 * One stage of the composed directional pass, in the fixed boundary order Heby realizes:
 * identity, context, presentation, grounding, intent, approval, governance, briefing. Naming
 * and ordering only — a phase confers no authority and is never a rank or priority.
 */
export type HebyCompositionPhase =
  | "identity"
  | "context"
  | "presentation"
  | "grounding"
  | "intent"
  | "approval"
  | "governance"
  | "briefing";

/** The fixed, canonical properties of one composition phase. */
export interface HebyCompositionPhaseDescriptor {
  readonly phase: HebyCompositionPhase;
  /** A fixed integer for the canonical stage order. Ordinal only — not a rank or priority. */
  readonly order: number;
  /** A short, fixed statement of the stage. Descriptive only. */
  readonly statement: HebyStatement;
}

/** The canonical descriptor for every composition phase. Frozen and immutable. */
export const HEBY_COMPOSITION_PHASE_DESCRIPTORS: Readonly<
  Record<HebyCompositionPhase, HebyCompositionPhaseDescriptor>
> = Object.freeze({
  identity: Object.freeze({ phase: "identity", order: 0, statement: "the immutable identity anchor" }),
  context: Object.freeze({ phase: "context", order: 1, statement: "the read-only admitted inputs bound to a declared context" }),
  presentation: Object.freeze({ phase: "presentation", order: 2, statement: "the honest presentation of admitted material" }),
  grounding: Object.freeze({ phase: "grounding", order: 3, statement: "the grounded presentation, every element settled-source traced" }),
  intent: Object.freeze({ phase: "intent", order: 4, statement: "the interpreted intent routed to grounded elements" }),
  approval: Object.freeze({ phase: "approval", order: 5, statement: "the prepared items pending at the Director" }),
  governance: Object.freeze({ phase: "governance", order: 6, statement: "the gated presentation, constraints enforced" }),
  briefing: Object.freeze({ phase: "briefing", order: 7, statement: "the Director briefing terminating at the human" }),
});

// --- Composition stage -------------------------------------------------------

/**
 * One recorded stage of the composed pass: the phase and the identity of the artifact that
 * phase produced. The ordered ledger of stages is the replay proof — it records what the
 * composition ran, invents nothing, and confers no authority.
 */
export interface HebyCompositionStage {
  readonly phase: HebyCompositionPhase;
  readonly artifactId: HebyId;
}

// --- Composition request / output --------------------------------------------

/**
 * The declared request for one end-to-end composition: Heby's canonical identity plus the
 * per-phase caller inputs the published boundaries require — the Phase 2 admission, the Phase 3
 * presentation identity, elements, and explanation, the Phase 5 utterance and untrusted proposed
 * intent, the Phase 6 prepared items, and the Phase 8 findings, history, questions, and recorded
 * decisions. A request declares intent — nothing is composed until every boundary passes.
 */
export interface HebyCompositionRequest {
  readonly identity: CanonicalHebyIdentity;
  readonly admission: HebyAdmissionRequest;
  readonly presentationId: HebyId;
  readonly elements: readonly HebyPresentationElement[];
  readonly explanation: readonly HebyExplanationEntry[];
  readonly utterance: HebyUtterance;
  readonly proposed: HebyProposedIntent;
  readonly items: readonly HebyPreparedItem[];
  readonly findings: readonly HebyBriefingFinding[];
  readonly history: readonly HebyBriefingHistory[];
  readonly questions: readonly HebyCarriedQuestion[];
  readonly decisions: readonly HebyRecordedDecision[];
}

/**
 * The deliverable of Phase 9: a verified, reproducible end-to-end Heby composition — the fixed
 * identity, the consistent seam identities threaded through every phase (context, presentation,
 * intent), the isolation scope, the ordered stage ledger that proves the path, and the terminal
 * Director briefing carried UNCHANGED. It composes the published outputs, adds no authority, and
 * terminates at the Director. Every boundary held; identity stayed immutable throughout.
 */
export interface HebyComposition {
  readonly identity: CanonicalHebyIdentity;
  readonly contextId: HebyId;
  readonly presentationId: HebyId;
  readonly intentId: HebyId;
  readonly scope: HebyGovernanceScope;
  readonly stages: readonly HebyCompositionStage[];
  readonly briefing: HebyDirectorBriefing;
}

/**
 * A composition that has passed through composition normalization: the stage ledger ordered by
 * phase, the scope frozen, the terminal briefing carried UNCHANGED (Phase 8 already canonical),
 * and the whole composition deep-frozen. Structurally a {@link HebyComposition}; the alias marks
 * that canonical form has been applied.
 */
export type CanonicalHebyComposition = HebyComposition;
