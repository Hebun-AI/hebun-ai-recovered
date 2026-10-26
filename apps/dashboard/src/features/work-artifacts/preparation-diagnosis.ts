/*
 * work-artifacts/preparation-diagnosis.ts — ONE structured log line for every preparation in which a
 * model really answered (AOR-1a).
 *
 * ── THE GAP THIS CLOSES ──────────────────────────────────────────────────────
 *
 * A withheld preparation persisted the invocation's provenance (provider, model, tokens) on its message
 * row, but which validator check withheld it was discarded, and the provider's stop reason was read only
 * for the max-tokens note. Neither could be diagnosed from production (AE1-WITHHELD-DIAGNOSABILITY-1).
 *
 * ── IT PERSISTS NOTHING AND DECIDES NOTHING ──────────────────────────────────
 *
 * No table, no column, no state. The line is written to the host's runtime log, the same channel
 * OPERATIONAL-OBSERVABILITY-V1 uses, and changes no outcome, refusal or filing.
 *
 * ── WHAT A LINE MAY CARRY ────────────────────────────────────────────────────
 *
 * The event name, what was served (`model` or `withheld`), the validator's CLOSED codes, the provider's
 * stop reason as a closed class, and the assistant message id — a random row id that joins the line to
 * the provenance already recorded, tenant-scoped, on that row. Never the prompt, the reply, the
 * validator's prose (one line of it quotes a reference the reply carried), a tenant, a user or an agent.
 *
 * A stop reason is not a judgement of the reply: `refusal` is the provider saying it declined, and a reply
 * that declines in ordinary prose ends `end_turn`. Nothing here calls a reply a decline.
 *
 * Pure. No I/O of its own.
 */
import type { HebyModelAnswerResult } from "@/features/heby-answer/model-answer.server";

export const PREPARATION_MODEL_OUTCOME_EVENT = "work-preparation-model-outcome";

/** `null` when no model answered — a preflight refusal, a gate, a provider failure — so there is nothing to diagnose. */
export function preparationDiagnosisLine(answer: HebyModelAnswerResult): string | null {
  if (answer.status !== "answered" || answer.outcome.response.modelInvocationAttempted !== true) return null;
  const response = answer.outcome.response;
  const fallback = response.modelFallback;
  const served = response.origin === "model" ? "model" : fallback?.kind === "withheld" ? "withheld" : "deterministic";
  return JSON.stringify({
    event: PREPARATION_MODEL_OUTCOME_EVENT,
    served,
    issueCodes: fallback?.kind === "withheld" ? (fallback.issueCodes ?? []) : [],
    stopReason: answer.modelStopReason ?? "unreported",
    messageId: answer.persistence.durable ? answer.persistence.assistantMessageId : null,
  });
}
