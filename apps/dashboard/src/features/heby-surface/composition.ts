/*
 * heby-surface/composition.ts — how the Heby Full Workspace rebalances itself as a conversation
 * grows (HW3).
 *
 * The empty state may prioritize Heby's presence. A long conversation may NOT: the transcript is
 * the working surface, and the operator must never scroll past a hero section to reach what they
 * just asked. This module is the single, pure decision for that balance, derived from REAL
 * conversation state (the rendered turn count and whether a request is genuinely in flight) —
 * never from a timer, a guess, or fabricated activity.
 *
 *   HERO          nothing has been said. Presence is the anchor; negative space is deliberate.
 *   EMERGING      the conversation has just begun. The presence stays visible but compact, so
 *                 Heby's identity does not vanish the instant the first message is sent.
 *   CONVERSATION  the thread is the product. The presence collapses to an inline mark, the
 *                 decorative atmosphere recedes, and reading owns the room.
 *
 * Pure. No React, no DOM, no I/O.
 */

export type HebyComposition = "hero" | "emerging" | "conversation";

/**
 * The last turn count that still keeps a visible presence above the transcript. Two turns is
 * exactly one exchange (the operator's question and Heby's answer) — beyond that the operator is
 * working, not being introduced.
 */
export const HEBY_EMERGING_TURN_LIMIT = 2;

export function resolveHebyComposition(input: {
  /** The number of RENDERED turns. Never an estimate. */
  readonly turnCount: number;
  /** In-flight user text, if any. Its presence means the conversation has started. */
  readonly pending: string | null;
  /** True only while a real request is in flight. */
  readonly asking: boolean;
}): HebyComposition {
  const started = input.turnCount > 0 || input.pending !== null || input.asking;
  if (!started) return "hero";
  return input.turnCount <= HEBY_EMERGING_TURN_LIMIT ? "emerging" : "conversation";
}

/** True when the surface should auto-scroll to the newest turn (i.e. anywhere but the hero). */
export function shouldFollowLatest(composition: HebyComposition): boolean {
  return composition !== "hero";
}
