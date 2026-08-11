/*
 * heby-commands/advisory-prompts.ts — what an ADVISORY slash command actually asks Heby (S1).
 *
 * An advisory command is a shortcut for a question, not a new capability. It produces an ordinary
 * prompt and hands it to the EXISTING Heby answer path, so it inherits every boundary unchanged:
 * the tenant is still resolved server-side, the R2E Director kill-switch is still read before any
 * transport is selected, the grounding evidence is still the deterministic set, the response
 * validator still runs, and persistence still records what actually happened.
 *
 * Each prompt is written to REMOVE pressure toward false confidence. Where a command implies an
 * output the evidence may not support — a ranking, a comparison, a risk list — the prompt names the
 * honest alternative explicitly, so "I can't justify that from what I have" is an expected answer
 * rather than a failure.
 *
 * Pure strings. No model call happens here.
 */

const GROUND_RULE =
  "Use only the grounding context supplied for this turn. If it does not support an answer, say so plainly rather than filling the gap.";

/**
 * Build the prompt for an advisory command. Returns `null` for any command that is not advisory —
 * a caller therefore cannot accidentally manufacture a model request for a local, read, navigation,
 * or reserved command.
 */
export function buildAdvisoryPrompt(handler: string, args: readonly string[]): string | null {
  switch (handler) {
    case "summary":
      return `Summarize the current context. ${GROUND_RULE}`;
    case "risks":
      return `What risks does the current evidence actually support? Name only risks the evidence supports, and say which ones you cannot assess. ${GROUND_RULE}`;
    case "gaps":
      return `What is missing, unknown, or insufficient in the current evidence? List the gaps rather than working around them. ${GROUND_RULE}`;
    case "why":
      return `Explain what the current view rests on: which sources produced it, how far they can be trusted, and what remains uncertain. ${GROUND_RULE}`;
    case "prioritize":
      return `Prioritize what deserves attention here. Rank only if the evidence supports a ranking; if it does not, say that a ranking is not justified and explain why. ${GROUND_RULE}`;
    case "compare": {
      const [first, second] = args;
      if (!first || !second) return null;
      return `Compare “${first}” and “${second}”. If either cannot be grounded in the current context, say which one and stop there rather than comparing them anyway. ${GROUND_RULE}`;
    }
    case "explain": {
      const [item] = args;
      if (!item) return null;
      return `Explain “${item}” from the current context. If it does not appear in the evidence, say so instead of explaining it from general knowledge. ${GROUND_RULE}`;
    }
    default:
      return null;
  }
}
