/*
 * heby-presence.ts — the ONE place where "what is Heby doing right now" is decided (Voice V1).
 *
 * Before Voice there was one source of presence: the conversation seam. Now there are two real
 * sources — the conversation seam and the voice runtime — and they must never both try to drive the
 * orb. This pure function is the single arbiter, so the precedence is provable instead of being an
 * accident of which component renders last.
 *
 * PRECEDENCE, AND WHY IT IS THIS ORDER:
 *
 *   1. unavailable  the surface has PROVEN it cannot take a question. That outranks everything: a
 *                   listening animation on a surface that cannot answer would be a lie.
 *   2. responding   a model request is genuinely in flight. It outranks voice because it is the
 *                   thing the operator is actually waiting on.
 *   3. listening    a microphone stream is genuinely open. This is the only state with a measured
 *                   amplitude behind it.
 *   4. speaking     an answer is genuinely being played back.
 *   5. composing/idle  the conversation seam's own honest resting states.
 *
 * The voice runtime's other states (`requesting`, `disclosure`, `transcribing`, `review`, `denied`,
 * `error`, `unsupported`) deliberately do NOT change the presence field. They are conversation-
 * neutral: nothing is being heard and nothing is being said, so the orb must not imply otherwise.
 * They are surfaced as text on the voice control, where they belong.
 *
 * Pure: no React, no DOM, no I/O.
 */

import type { HebyVoiceState } from "@/features/heby-voice";
import type { HebyPresenceState } from "./heby-visualizer";

export interface HebyPresenceInput {
  /** What the conversation seam derived on its own. It knows nothing about voice. */
  readonly conversation: HebyPresenceState;
  /** The voice runtime's state, or null on a surface with no voice runtime attached. */
  readonly voice: HebyVoiceState | null;
}

export function resolveHebyPresence(input: HebyPresenceInput): HebyPresenceState {
  if (input.conversation === "unavailable") return "unavailable";
  if (input.conversation === "responding") return "responding";
  if (input.voice === "listening") return "listening";
  if (input.voice === "speaking") return "speaking";
  return input.conversation;
}
