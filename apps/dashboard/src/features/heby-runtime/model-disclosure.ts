/*
 * heby-runtime/model-disclosure.ts — WHAT THE MODEL RECEIVED FOR ONE ANSWER, as the human sees
 * it (HEBY-GROUNDED-CONVERSATION-1, model-facing legibility). PURE; a client component may import it.
 *
 * Three different facts, kept apart:
 *   - the evidence shown to the HUMAN (Knowledge evidence, cited sources) — unchanged, elsewhere;
 *   - the classes DISCLOSED to the model — the EAI decision's `authorizedDataClasses`, as recorded;
 *   - the classes WITHHELD by authorization — declared, and not authorized.
 *
 * Nothing here decides a permission. Every value comes from the decision record APF-5 wrote for the
 * request whose `correlationId` the assistant message stores. Where that record is missing or
 * cannot be read, the answer is `unavailable` — never inferred from the transport, the origin or
 * the evidence. A turn with no recorded model invocation says exactly that, and no more: R2D's rule
 * is that a missing invocation record is not proof that none happened.
 */

export type ModelDisclosureView =
  /** No model invocation is recorded for this answer (deterministic, nothing returned by a model). */
  | { readonly status: "no-invocation-recorded" }
  /** A model was invoked, but no single authoritative decision record could be read for it. */
  | { readonly status: "unavailable" }
  | {
      readonly status: "recorded";
      /** Classes the model actually received — the decision's authorized set. */
      readonly disclosed: readonly string[];
      /** Classes the request declared that the decision did not authorize; withheld from the model. */
      readonly withheld: readonly string[];
    };

/** The recorded decision, in the closed shape the governance-audit reader returns. */
export interface DisclosureDecisionRecord {
  readonly disposition: "authorized" | "refused";
  readonly declaredDataClasses: readonly string[];
  readonly authorizedDataClasses: readonly string[];
}

/**
 * The disclosure view for one stored assistant message.
 *
 * `decisions` is `null` when the decision record could not be read at all.
 */
export function modelDisclosureOf(
  message: { readonly correlationId: string | null },
  decisions: ReadonlyMap<string, DisclosureDecisionRecord> | null,
): ModelDisclosureView {
  if (!message.correlationId) return { status: "no-invocation-recorded" };
  const decision = decisions?.get(message.correlationId);
  /* A stored invocation always rode an AUTHORIZED decision; anything else is not a record of this answer. */
  if (!decision || decision.disposition !== "authorized") return { status: "unavailable" };
  return {
    status: "recorded",
    disclosed: [...decision.authorizedDataClasses],
    withheld: decision.declaredDataClasses.filter((c) => !decision.authorizedDataClasses.includes(c)),
  };
}

/** Human labels for the recorded class names. An unknown name is shown as recorded, never hidden. */
const LABELS: Readonly<Record<string, string>> = Object.freeze({
  conversation: "your question and this conversation",
  knowledge: "Knowledge",
  "work-artifact": "prepared work",
});
export function disclosureClassLabel(dataClass: string): string {
  return LABELS[dataClass] ?? dataClass;
}

/*
 * HEBY-GENERAL-ADVISORY-1 — general knowledge is not organizational evidence, said on every recorded
 * model answer and derived only from the recorded decision, so a reloaded answer says it too. Having
 * records reach the model is never read as every sentence being grounded in them.
 */
export function generalKnowledgeLines(disclosed: readonly string[]): readonly string[] {
  const organizational = disclosed.some((c) => c !== "conversation");
  return [
    ...(organizational ? [] : ["No organizational records reached the model for this answer."]),
    "Only records listed here are evidence about your organization. Anything else in the answer is the model's general knowledge or advice, not a verified fact about your organization.",
  ];
}
