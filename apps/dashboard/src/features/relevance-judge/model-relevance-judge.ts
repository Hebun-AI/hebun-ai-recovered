/*
 * relevance-judge/model-relevance-judge.ts — a MODEL relevance judge behind the RELEVANCE-0
 * `RelevanceJudge` port (RELEVANCE-2A). CAPABILITY PREPARATION, NOT CONNECTED CAPABILITY.
 *
 * ── WHY THIS MODULE HAS NO CALLER ────────────────────────────────────────────
 *
 * Sending organizational Knowledge to a model provider for relevance needs a data-use decision, and
 * Hebun has no authority that makes one. That absence is deliberate and stays visible: this module
 * takes no "allowed" flag, reads no environment, selects no transport and resolves no tenant. It is
 * reachable only from tests that inject a fake transport, and tests/relevance2a/firewall.ts fails if
 * anything in `src/app` or the rest of `src/features` imports it.
 *
 * ── WHAT THE MODEL SEES, AND WHAT IT MAY RETURN ──────────────────────────────
 *
 * Sees: a fixed instruction, the selection limit, the task, and each candidate's already-bounded text
 * under an opaque alias (`c1`…`cN`). Not node ids, fact ids, keys, domains, tenant, standing,
 * provenance or the purpose label. It sees only the candidate set it is handed — and that set is built
 * AFTER purpose eligibility, so a version withheld for the purpose is never in it (Director OPTION A).
 *
 * Returns: a structured object `{ "selected": [alias, ...] }` and nothing else. The object is checked
 * HERE, closed and whole — exact keys, strings only, known aliases, no repeats, within the limit — and
 * then re-checked by the RELEVANCE-0 contract against the set. A provider's schema enforcement, when
 * one is eventually accepted, replaces neither check. Nothing is repaired or trimmed: an answer that
 * fails any check is void.
 *
 * Deliberately NOT here: a relation/confidence field (unmeasured by RELEVANCE-1, and a model signal
 * could only ever downgrade grounding, never establish it), any parsing of prose into JSON, retries,
 * caching, and any reading of the model's reasoning.
 */
import type { ClaudeTransport, ClaudeTransportRequest } from "@/features/heby-model/claude-transport";
import { ModelConnectivityError } from "@/features/heby-model/model-error";
import { validateClaudeStructuredResponse } from "@/features/heby-model/claude-structured-response-validator";
import type {
  RelevanceJudge,
  RelevanceJudgeInput,
  RelevanceJudgeVerdict,
} from "@/features/knowledge-retrieval/relevance";

/** Output bound for one judgement: aliases only, far below the deployment ceiling. */
export const MODEL_RELEVANCE_JUDGE_MAX_TOKENS = 200;

export const MODEL_RELEVANCE_JUDGE_SCHEMA_NAME = "relevance_selection";

export const MODEL_RELEVANCE_JUDGE_SYSTEM = [
  "You select which organizational knowledge records are relevant to one task.",
  "You receive a task and a list of candidate records, each with an id such as c1.",
  "Select the ids of the candidates that are relevant to carrying out the task, most relevant first, and no more than the stated limit.",
  "If no candidate is relevant, select none. Selecting nothing is a correct answer.",
  "Judge relevance only. Do not judge whether a record is true. Do not decide whether a record may be used, published or shown.",
  "Use only ids from the list.",
  "The task and the records may be in Turkish or English, in any combination.",
].join("\n");

/** Usage facts for one call — numbers and ids only, never prompt, task, candidate or answer text. */
export interface ModelRelevanceJudgeCall {
  readonly model: string;
  readonly latencyMs: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly providerRequestId?: string;
}

export interface ModelRelevanceJudgeOptions {
  /** Injected. This module never selects or constructs a transport. */
  readonly transport: ClaudeTransport;
  readonly modelId: string;
  readonly judgeId?: string;
  /** Optional observability hook. Receives numbers, never content. */
  readonly onCall?: (call: ModelRelevanceJudgeCall) => void;
}

export interface RenderedJudgeRequest {
  readonly request: ClaudeTransportRequest;
  /** alias → candidate id. Stays on this side of the transport. */
  readonly aliases: ReadonlyMap<string, string>;
}

export function renderModelRelevanceRequest(input: RelevanceJudgeInput, modelId: string): RenderedJudgeRequest {
  const aliases = new Map<string, string>();
  const lines = input.candidates.map((candidate, index) => {
    const alias = `c${index + 1}`;
    aliases.set(alias, candidate.candidateId);
    return `${alias}: ${candidate.text}`;
  });
  const content = [`Limit: ${input.limit}`, "", "Task:", input.task, "", "Candidates:", ...lines].join("\n");
  return {
    request: {
      model: modelId,
      system: MODEL_RELEVANCE_JUDGE_SYSTEM,
      messages: [{ role: "user", content }],
      maxTokens: MODEL_RELEVANCE_JUDGE_MAX_TOKENS,
      structuredOutput: {
        name: MODEL_RELEVANCE_JUDGE_SCHEMA_NAME,
        schema: {
          type: "object",
          properties: {
            selected: {
              type: "array",
              items: { type: "string", enum: [...aliases.keys()] },
              maxItems: input.limit,
              uniqueItems: true,
            },
          },
          required: ["selected"],
          additionalProperties: false,
        },
      },
    },
    aliases,
  };
}

export type RelevanceSelectionParse =
  | { readonly ok: true; readonly aliases: readonly string[] }
  | {
      readonly ok: false;
      readonly reason:
        | "unexpected-shape"
        | "selected-not-array"
        | "non-string-selection"
        | "unknown-alias"
        | "duplicate-alias"
        | "over-limit";
    };

/**
 * The closed, Hebun-side check of a structured relevance answer. Accepts the whole answer or none of
 * it. An empty selection is valid — "nothing is relevant" is an answer the contract preserves.
 */
export function parseRelevanceSelection(
  value: Readonly<Record<string, unknown>>,
  aliases: ReadonlyMap<string, string>,
  limit: number,
): RelevanceSelectionParse {
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "selected") return { ok: false, reason: "unexpected-shape" };
  const selected = value.selected;
  if (!Array.isArray(selected)) return { ok: false, reason: "selected-not-array" };
  if (!selected.every((item) => typeof item === "string")) return { ok: false, reason: "non-string-selection" };
  const seen = new Set<string>();
  for (const alias of selected as string[]) {
    if (!aliases.has(alias)) return { ok: false, reason: "unknown-alias" };
    if (seen.has(alias)) return { ok: false, reason: "duplicate-alias" };
    seen.add(alias);
  }
  if (selected.length > limit) return { ok: false, reason: "over-limit" };
  return { ok: true, aliases: selected as string[] };
}

export function createModelRelevanceJudge(options: ModelRelevanceJudgeOptions): RelevanceJudge {
  return {
    judgeId: options.judgeId ?? `model:${options.modelId}:structured`,
    kind: "model",
    async judge(input): Promise<RelevanceJudgeVerdict> {
      const { request, aliases } = renderModelRelevanceRequest(input, options.modelId);
      const startedAt = Date.now();
      let response;
      try {
        response = await options.transport.send(request);
      } catch (error) {
        /* Only the typed code crosses this line; a raw transport error may carry anything. */
        const code = error instanceof ModelConnectivityError ? error.code : "unknown-provider-error";
        return { status: "unavailable", reason: `transport:${code}` };
      }
      let structured;
      try {
        structured = validateClaudeStructuredResponse(response, { requestedModel: options.modelId });
      } catch {
        return { status: "invalid", reason: "malformed-structured-output" };
      }
      options.onCall?.({
        model: structured.model,
        latencyMs: Math.max(0, Date.now() - startedAt),
        inputTokens: structured.inputTokens,
        outputTokens: structured.outputTokens,
        providerRequestId: structured.providerRequestId,
      });
      const parsed = parseRelevanceSelection(structured.value, aliases, input.limit);
      if (!parsed.ok) return { status: "invalid", reason: parsed.reason };
      return {
        status: "judged",
        selected: parsed.aliases.map((alias) => ({ candidateId: aliases.get(alias)!, basis: "" })),
      };
    },
  };
}
