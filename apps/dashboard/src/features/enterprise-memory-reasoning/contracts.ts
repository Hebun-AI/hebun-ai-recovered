/**
 * Enterprise Memory Reasoning — canonical core contracts (Phase 1).
 *
 * This is the shared vocabulary of reasoning: the technology-neutral shapes every
 * later reasoning phase will speak. Phase 1 defines contracts ONLY. It performs
 * no reasoning, no inference, no decision, and produces no understanding. There
 * is no engine, no algorithm, no persistence, no AI, no agent, and no runtime
 * behavior here — only immutable, readonly type definitions.
 *
 * Reasoning consumes an already-assembled memory context (the published Context
 * Assembly output) as its input. It relates and explains what memory supports;
 * it never invents facts and never mutates its input.
 */

export type ReasoningId = string;
export type ReasoningTimestamp = string;

/** A short, human-authored statement of an artifact. Text only. */
export type ReasoningStatement = string;

/**
 * The kinds of artifact the reasoning vocabulary recognizes. Naming only — this
 * enum classifies contract shapes; it triggers no behavior.
 */
export type ReasoningArtifactKind =
  | "goal"
  | "evidence"
  | "relation"
  | "implication"
  | "contradiction"
  | "gap"
  | "confidence"
  | "understanding";

/** The common identity every reasoning artifact carries. */
export interface ReasoningArtifact {
  readonly id: ReasoningId;
  readonly kind: ReasoningArtifactKind;
}
