/*
 * heby-conversation-selection.ts — HEBY-CONVERSATION-CONTINUITY-1: which conversation the operator
 * selected LAST.
 *
 * Every selection (open, switch, deep link, restore, detach, ask) claims a token before it awaits
 * the server; when the answer arrives it may write state only if its token is still the current one.
 * So a slow load of conversation A can never overwrite B, and an answer to A can never land in B.
 * Pure and framework-free so the rule can be proven without rendering React.
 */

export interface ConversationSelectionGuard {
  /** A new selection begins; every earlier token becomes stale. */
  claim(): number;
  isCurrent(token: number): boolean;
}

export function createConversationSelectionGuard(): ConversationSelectionGuard {
  let current = 0;
  return {
    claim: () => ++current,
    isCurrent: (token) => token === current,
  };
}
