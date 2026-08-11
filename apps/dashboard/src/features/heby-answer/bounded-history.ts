/*
 * heby-answer/bounded-history.ts — the pure bounded recent-history builder (H1A).
 *
 * Turns persisted conversation messages into a small, ordered set of prior turns for CONTINUITY
 * only. This is conversation DATA — never authoritative evidence, never authority. The builder is
 * deterministic and pure; loading failure upstream must pass [] here (fail-closed to no memory).
 *
 * Rules (per H1 discovery):
 *  - only well-formed user/assistant turns (any other role, or empty content, is excluded);
 *  - preserve order (oldest→newest);
 *  - keep at most `maxMessages` most-recent turns AND at most `maxChars` total content;
 *  - drop the OLDEST whole turns first; never split a turn; never change a turn's role.
 *
 * No summarization (deferred). The current turn is not included here — the loader passes only
 * PRIOR persisted messages, so the current prompt is never in this set.
 */
import type { ConversationTurn } from "@/features/heby-runtime";

export const MAX_HISTORY_MESSAGES = 6;
export const MAX_HISTORY_CHARS = 6000;

/** The minimal shape the builder needs from a persisted message. */
export interface HistoryMessageInput {
  readonly role: string;
  readonly content: string;
}

export function buildBoundedHistory(
  messages: readonly HistoryMessageInput[],
  opts: { readonly maxMessages?: number; readonly maxChars?: number } = {},
): readonly ConversationTurn[] {
  const maxMessages = opts.maxMessages ?? MAX_HISTORY_MESSAGES;
  const maxChars = opts.maxChars ?? MAX_HISTORY_CHARS;

  // Keep only well-formed user/assistant turns, preserving order.
  const turns: ConversationTurn[] = [];
  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    const content = typeof message.content === "string" ? message.content.trim() : "";
    if (content.length === 0) continue;
    turns.push({ role: message.role, content });
  }

  // Take the most-recent `maxMessages` (drop oldest first).
  let recent = turns.slice(Math.max(0, turns.length - maxMessages));

  // Enforce the char budget by dropping OLDEST whole turns first — never split a turn.
  const totalChars = (list: readonly ConversationTurn[]): number =>
    list.reduce((sum, turn) => sum + turn.content.length, 0);
  while (recent.length > 0 && totalChars(recent) > maxChars) {
    recent = recent.slice(1);
  }

  return recent;
}
