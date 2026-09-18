/*
 * media-generation-live/openai-image-transport.server.ts — the OpenAI GPT Image transport (MEDIA-2A).
 *
 * A TRANSPORT, AND NOTHING ELSE. It implements `MediaGenerationTransport`: prompt in, bytes or a closed
 * failure code out. It writes no row, stores no bytes, decides no admission, holds no Governance,
 * storage, publishing or execution authority, and reads no environment — the resolver hands it its
 * credential. Its bytes become a Media Asset only after the Media Asset authority verifies them and
 * writes them through the MediaObjectStore.
 *
 * ── THE CONTRACT IT SPEAKS (verified against OpenAI's API reference, 2026-09-17) ──
 *
 *   POST https://api.openai.com/v1/images/generations
 *   { model, prompt, n: 1, size, quality, output_format, moderation }
 *   → 200 { created, data: [{ b64_json }], usage: { input_tokens, output_tokens, ... } }
 *
 * GPT image models ALWAYS return base64 and never a URL, so this transport never returns a URL and its
 * `allowedDownloadHosts` is empty: the download seam is unreachable from it by construction.
 * `x-request-id` identifies the request; `X-Client-Request-Id` carries the invocation id as a
 * correlation id. Neither is idempotency — OpenAI documents no idempotency key.
 *
 * ── SCOPE (Director, MEDIA-2A) ───────────────────────────────────────────────
 *
 * Text-to-image only. No reference image, no edit, no mask, no streaming, no polling, no webhook,
 * no video. The model snapshot, size, quality and format are pinned constants, not configuration.
 *
 * ── SPEND ───────────────────────────────────────────────────────────────────
 *
 * Every call first spends one unit of the SHARED per-process live-call budget (R2G), the same one the
 * live Claude transport spends — one spend bound, not two. An exhausted budget reports
 * `budget-exhausted` and sends nothing. There is NO automatic retry: a timeout may still have been
 * generated and billed, so trying again is a new human request with a new request key.
 *
 * ── WHAT NEVER LEAVES THIS MODULE ────────────────────────────────────────────
 *
 * The API key, the raw response body, provider error messages, and any base64 text. Only bytes, a
 * validated request id, two token counts, and a closed failure code are returned. Nothing is logged.
 *
 * Server-only.
 */
import type {
  MediaProviderFailure,
  MediaProviderUsage,
} from "@/features/media-assets/contracts";
import type {
  MediaGenerationMode,
  MediaGenerationOutcome,
  MediaGenerationTransport,
} from "@/features/media-assets/media-generation-transport";
import type { LiveSpendBudget } from "@/features/heby-model-live/live-spend-budget.server";

export const OPENAI_IMAGE_GENERATIONS_URL = "https://api.openai.com/v1/images/generations";
/**
 * MEDIA-5 — the image EDIT endpoint. `multipart/form-data`, verified against the current official
 * API reference immediately before this was written.
 *
 * ── WHAT IS DELIBERATELY NOT SENT ───────────────────────────────────────────
 *
 * `input_fidelity` is NOT sent. Official OpenAI surfaces disagree about it: the Go API reference
 * lists `InputFidelity: high | low` for GPT image models, while the image-generation guide and the
 * Python reference do not mention the parameter at all. MEDIA-5 therefore omits it rather than
 * building correctness on a contradiction — and because the released contract here is
 * "source image + instruction -> new image", not "guaranteed composition preservation". Sending an
 * unknown field risks a 400 on a call that may already have been billed, and there is no automatic
 * retry anywhere in this transport to paper over one.
 *
 * `mask` is not sent: MEDIA-5 has no masks. `n` is not sent: the shared parameters pin exactly one
 * output. No Files API is used, so nothing is persisted provider-side and there is nothing to clean
 * up; the image is one part of one request and exists only for its duration.
 */
export const OPENAI_IMAGE_EDITS_URL = "https://api.openai.com/v1/images/edits";
export const OPENAI_IMAGE_PROVIDER = "openai";
/** Pinned dated snapshot (Director, MEDIA-2A). Never an alias that could move under Hebun. */
export const OPENAI_IMAGE_MODEL = "gpt-image-2.5-flare-2026-09-08";

/** The fixed request shape. Only `model` and `prompt` are added to it. */
export const OPENAI_IMAGE_REQUEST_PARAMETERS = Object.freeze({
  n: 1,
  size: "1024x1024",
  quality: "medium",
  output_format: "png",
  moderation: "auto",
} as const);

export const OPENAI_IMAGE_DECLARED_CONTENT_TYPE = "image/png";

/** OpenAI documents complex prompts taking up to 2 minutes; this bounds the wait below any sane function limit. */
export const OPENAI_IMAGE_TIMEOUT_MS = 150_000;

/**
 * A ceiling on the raw response body. A base64 image of the admission maximum (20 MiB) is ~27 MiB of
 * text; anything past this is refused as malformed before it is fully buffered. Between the two, the
 * bytes are handed on and admission refuses them by size — the authority, not the transport, decides.
 */
export const OPENAI_IMAGE_MAX_RESPONSE_BYTES = 32 * 1024 * 1024;

const REQUEST_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

export type OpenAiFetch = (
  input: string,
  init: {
    readonly method: "POST";
    readonly headers: Record<string, string>;
    /* MEDIA-5: a JSON string for text-to-image, multipart FormData for a reference edit. */
    readonly body: string | FormData;
    readonly redirect: "error";
    readonly cache: "no-store";
    readonly signal: AbortSignal;
  },
) => Promise<Response>;

export interface OpenAiImageTransportConfig {
  /** Server-only. Never logged, returned, or persisted. */
  readonly apiKey: string;
  /** The shared per-process live-call budget. */
  readonly spendBudget: LiveSpendBudget;
  readonly fetchImpl?: OpenAiFetch;
  readonly timeoutMs?: number;
}

type Failure = Exclude<MediaProviderFailure, "dispatch-error">;

class BodyTooLarge extends Error {}

async function readCapped(response: Response, limit: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw new BodyTooLarge();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return undefined;
  }
}

function errorCode(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/** HTTP status + OpenAI error code → closed failure. Anything unrecognised is never "success". */
export function classifyOpenAiImageFailure(status: number, code: string | null): Failure {
  if (status === 401 || status === 403) return "authentication-failed";
  if (code === "moderation_blocked") return "moderation-blocked";
  if (status === 429) {
    return code === "credit_balance_exhausted" || code === "insufficient_quota" ? "quota-exhausted" : "rate-limited";
  }
  if (status === 408) return "timeout";
  if (status >= 500) return "provider-unavailable";
  if (status >= 400) return "request-rejected";
  return "malformed-response";
}

function parseUsage(body: unknown): MediaProviderUsage | null {
  const usage = body && typeof body === "object" ? (body as { usage?: unknown }).usage : undefined;
  if (!usage || typeof usage !== "object") return null;
  const input = (usage as { input_tokens?: unknown }).input_tokens;
  const output = (usage as { output_tokens?: unknown }).output_tokens;
  if (!Number.isSafeInteger(input) || !Number.isSafeInteger(output)) return null;
  if ((input as number) < 0 || (output as number) < 0) return null;
  return { inputTokens: input as number, outputTokens: output as number };
}

function decodeImage(body: unknown): Uint8Array | null {
  if (!body || typeof body !== "object") return null;
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length !== 1) return null;
  const item = data[0] as { b64_json?: unknown; url?: unknown } | null;
  if (!item || typeof item !== "object") return null;
  if (item.url !== undefined && item.url !== null) return null;
  const b64 = item.b64_json;
  if (typeof b64 !== "string" || b64.length === 0 || b64.length % 4 !== 0 || !BASE64_RE.test(b64)) return null;
  const bytes = Buffer.from(b64, "base64");
  if (bytes.length === 0) return null;
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function createOpenAiImageTransport(config: OpenAiImageTransportConfig): MediaGenerationTransport {
  if (typeof window !== "undefined") {
    throw new Error("The OpenAI image transport is server-only.");
  }
  const doFetch: OpenAiFetch = config.fetchImpl ?? ((input, init) => fetch(input, init));
  const timeoutMs = config.timeoutMs ?? OPENAI_IMAGE_TIMEOUT_MS;

  return Object.freeze({
    transport: "live" as const,
    provider: OPENAI_IMAGE_PROVIDER,
    model: OPENAI_IMAGE_MODEL,
    allowedDownloadHosts: Object.freeze([]) as readonly string[],
    /* MEDIA-5: this transport does both. The authority checks this BEFORE it registers anything. */
    modes: Object.freeze(["text-to-image", "reference-edit"]) as readonly MediaGenerationMode[],

    async generate(input: Parameters<MediaGenerationTransport["generate"]>[0]): Promise<MediaGenerationOutcome> {
      const failed = (failure: Failure, providerJobId: string | null = null, usage: MediaProviderUsage | null = null): MediaGenerationOutcome =>
        ({ status: "failed", providerJobId, failure, usage });

      if (!config.spendBudget.attempt()) return failed("budget-exhausted");

      /*
       * ── ONE BUDGET, ONE TIMEOUT, ONE SHOT — FOR BOTH MODES ─────────────────
       *
       * The two modes differ ONLY in the URL and the body. Everything that protects Hebun — the
       * spend budget above, the timeout, `redirect: "error"`, the capped read, the closed failure
       * mapping, and the absence of any retry — is written once and applies to both. A second
       * request-building function would have been a second place to forget one of them.
       */
      const edit = input.request.mode === "reference-edit" ? input.request.referenceImage : null;

      /*
       * `content-type` is omitted for multipart ON PURPOSE: fetch derives it from the FormData and
       * appends the boundary. Setting it by hand produces a body the provider cannot parse.
       */
      const headers: Record<string, string> = {
        authorization: `Bearer ${config.apiKey}`,
        "x-client-request-id": input.invocationId,
      };
      let url = OPENAI_IMAGE_GENERATIONS_URL;
      let requestBody: string | FormData;

      if (edit) {
        url = OPENAI_IMAGE_EDITS_URL;
        const form = new FormData();
        form.append("model", OPENAI_IMAGE_MODEL);
        form.append("prompt", input.promptText);
        for (const [name, value] of Object.entries(OPENAI_IMAGE_REQUEST_PARAMETERS)) {
          form.append(name, String(value));
        }
        /* EXACTLY ONE image part. No mask, no second reference, no array form. */
        form.append("image", new Blob([new Uint8Array(edit.bytes)], { type: edit.contentType }), edit.fileName);
        requestBody = form;
      } else {
        headers["content-type"] = "application/json";
        requestBody = JSON.stringify({ model: OPENAI_IMAGE_MODEL, prompt: input.promptText, ...OPENAI_IMAGE_REQUEST_PARAMETERS });
      }

      const signal = AbortSignal.timeout(timeoutMs);
      let response: Response;
      try {
        response = await doFetch(url, {
          method: "POST",
          headers,
          body: requestBody,
          redirect: "error",
          cache: "no-store",
          signal,
        });
      } catch (error) {
        return failed(isTimeout(error) ? "timeout" : "provider-unavailable");
      }

      const rawRequestId = response.headers.get("x-request-id");
      const requestId = rawRequestId && REQUEST_ID_RE.test(rawRequestId) ? rawRequestId : null;

      let raw: Uint8Array;
      try {
        raw = await readCapped(response, OPENAI_IMAGE_MAX_RESPONSE_BYTES);
      } catch (error) {
        if (error instanceof BodyTooLarge) return failed("malformed-response", requestId);
        return failed(isTimeout(error) ? "timeout" : "provider-unavailable", requestId);
      }
      const body = parseJson(raw);
      const usage = parseUsage(body);

      if (response.status !== 200) {
        return failed(classifyOpenAiImageFailure(response.status, errorCode(body)), requestId, usage);
      }
      const bytes = decodeImage(body);
      if (!bytes) return failed("malformed-response", requestId, usage);

      return {
        status: "succeeded",
        providerJobId: requestId,
        output: { kind: "bytes", bytes, declaredContentType: OPENAI_IMAGE_DECLARED_CONTENT_TYPE },
        usage,
      };
    },
  });
}
