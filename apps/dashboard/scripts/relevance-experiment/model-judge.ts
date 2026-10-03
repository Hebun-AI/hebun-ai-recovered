/*
 * RELEVANCE-1 experiment adapter: a MODEL relevance judge behind the RELEVANCE-0 `RelevanceJudge`
 * port. EXPERIMENT-ONLY — not imported by any runtime file, and the shared contract is unchanged.
 *
 * Provider-specific on purpose, and only here: it speaks the existing `ClaudeTransport` port, so the
 * shared relevance contract stays provider-neutral. The transport is supplied by the caller — the
 * experiment runner obtains it from the repository's one selection authority
 * (`selectModelTransport`), never by constructing a live transport itself.
 *
 * WHAT THE MODEL SEES: the purpose, the task, and each candidate's bounded text under an opaque
 * alias (`c1`…`cN`). Not node ids, fact ids, keys, tenant, standing or provenance. WHAT IT MAY
 * RETURN: aliases. An alias it was not given is passed through as an unknown id, so the RELEVANCE-0
 * contract voids the whole verdict — the adapter never repairs or trims a model answer.
 *
 * NOT IMPLEMENTED HERE, ON PURPOSE: structured output. The existing transport sends no output schema
 * and no temperature, and this experiment did not change it. A runtime judge would need that as a
 * separately approved transport change; parsing prose-wrapped JSON is an experiment workaround.
 */
import type { ClaudeTransport, ClaudeTransportRequest } from "../../src/features/heby-model/claude-transport";
import type { RelevanceJudge, RelevanceJudgeInput, RelevanceJudgeVerdict } from "../../src/features/knowledge-retrieval/relevance";

export const MODEL_JUDGE_MAX_TOKENS = 200;

export const MODEL_JUDGE_SYSTEM = [
  "You select which organizational knowledge records are relevant to one task.",
  "You receive a task and a list of candidate records, each with an id such as c1.",
  "Return the ids of the candidates that are relevant to carrying out the task, most relevant first, and no more than the stated limit.",
  "If no candidate is relevant, return an empty list. Returning nothing is a correct answer.",
  "Judge relevance only. Do not judge whether a record is true. Do not decide whether a record may be used, published or shown.",
  "Do not rewrite, summarise or add records. Use only ids from the list.",
  "The task and the records may be in Turkish or English, in any combination.",
  'Respond with exactly one JSON object and nothing else: {"selected": ["c1", "c2"]}',
].join("\n");

export interface ModelJudgeCall {
  readonly latencyMs: number;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly model: string | null;
  readonly result: "parsed" | "malformed" | "transport-error";
  readonly errorCode?: string;
  /** The model's raw answer, truncated — diagnostics for malformed output. Synthetic data only. */
  readonly rawPreview?: string;
  readonly stopReason?: string | null;
}

export interface ModelJudgeOptions {
  /** A FRESH transport per call, as runtime obtains one per request. */
  readonly transport: () => ClaudeTransport | undefined;
  readonly model: string;
  readonly judgeId?: string;
  readonly parseMode?: JudgeParseMode;
  readonly onRequest?: (request: ClaudeTransportRequest) => void;
  readonly onCall?: (call: ModelJudgeCall) => void;
}

export function renderJudgeMessage(input: RelevanceJudgeInput): { readonly text: string; readonly aliases: ReadonlyMap<string, string> } {
  const aliases = new Map<string, string>();
  const lines = input.candidates.map((candidate, index) => {
    const alias = `c${index + 1}`;
    aliases.set(alias, candidate.candidateId);
    return `${alias}: ${candidate.text}`;
  });
  const text = [
    `Purpose (context only): ${input.purpose}`,
    `Limit: ${input.limit}`,
    "",
    "Task:",
    input.task,
    "",
    "Candidates:",
    ...lines,
  ].join("\n");
  return { text, aliases };
}

/**
 * How a model answer is read.
 *
 *   strict        the whole answer is `{"selected": [...]}` (optionally fenced). PRE-REGISTERED.
 *   leading-json  the answer STARTS with that object (optionally fenced); trailing prose is ignored.
 *                 POST-HOC: added after the first live run showed the model appending explanations.
 *
 * Neither mode changes what is validated: the object must hold exactly `selected`, an array of
 * strings, and the RELEVANCE-0 contract still checks every id against the set.
 */
export type JudgeParseMode = "strict" | "leading-json";

export function parseJudgeAnswer(raw: string, mode: JudgeParseMode = "strict"): readonly string[] | null {
  let body = raw.trim();
  if (mode === "leading-json") {
    const leading = /^(?:```(?:json)?\s*)?(\{[^{}]*\})/.exec(body);
    if (!leading) return null;
    body = leading[1]!;
  }
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(body);
  if (fenced) body = fenced[1]!.trim();
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Object.keys(value as object);
  if (keys.length !== 1 || keys[0] !== "selected") return null;
  const selected = (value as { selected: unknown }).selected;
  if (!Array.isArray(selected) || !selected.every((item) => typeof item === "string")) return null;
  return selected as string[];
}

export function createModelRelevanceJudge(options: ModelJudgeOptions): RelevanceJudge {
  return {
    judgeId: options.judgeId ?? `model:${options.model}:${options.parseMode ?? "strict"}`,
    kind: "model",
    async judge(input): Promise<RelevanceJudgeVerdict> {
      const transport = options.transport();
      if (!transport) return { status: "unavailable", reason: "transport-not-selected" };
      const { text, aliases } = renderJudgeMessage(input);
      const request: ClaudeTransportRequest = {
        model: options.model,
        system: MODEL_JUDGE_SYSTEM,
        messages: [{ role: "user", content: text }],
        maxTokens: MODEL_JUDGE_MAX_TOKENS,
      };
      options.onRequest?.(request);
      const started = performance.now();
      let response;
      try {
        response = await transport.send(request);
      } catch (error) {
        const code = (error as { code?: string })?.code ?? "unknown";
        options.onCall?.({ latencyMs: performance.now() - started, inputTokens: null, outputTokens: null, model: null, result: "transport-error", errorCode: code });
        throw error;
      }
      const latencyMs = performance.now() - started;
      const raw = response.content.filter((block) => block.type === "text").map((block) => block.text ?? "").join("");
      const parsed = parseJudgeAnswer(raw, options.parseMode ?? "strict");
      options.onCall?.({
        latencyMs,
        inputTokens: response.usage?.inputTokens ?? null,
        outputTokens: response.usage?.outputTokens ?? null,
        model: response.model ?? null,
        result: parsed ? "parsed" : "malformed",
        rawPreview: raw.slice(0, 300),
        stopReason: response.stopReason ?? null,
      });
      if (!parsed) return { status: "unavailable", reason: "malformed-model-output" };
      return {
        status: "judged",
        /* An alias the model was not given stays unresolved, so the contract voids the verdict. */
        selected: parsed.map((alias) => ({ candidateId: aliases.get(alias) ?? `unknown:${alias}`, basis: "model" })),
      };
    },
  };
}
