/*
 * heby-model-live/claude-http-transport.server.ts — the REAL Claude transport (R2D prep).
 *
 * PREPARED, NOT PROVEN. This is the only module in the Heby model stack that can reach the
 * network. It implements the same injectable `ClaudeTransport` seam the R2B fake transport
 * implements, so the existing client + validator turn its output into a validated result with
 * zero new coupling. It lives in its OWN feature so the R2B foundation (`heby-model`) stays
 * provably network-free.
 *
 * Discipline (Steps 14–17):
 * - Server only. Never import from client code.
 * - Direct HTTPS via fetch — zero new dependencies, no SDK, minimal blast radius.
 * - Explicit model id (from the request) and a server-only API key (never logged/returned).
 * - Hard timeout via AbortController; NO automatic retries.
 * - A hard per-process live-call budget and output-token ceiling.
 * - Typed, redacted error mapping; the raw provider response never leaves this module.
 *
 * It is NOT wired to run until the Director authorizes the live-call gate (a double env gate
 * in the transport selector). Constructing it performs no I/O; only `send()` would call out.
 */

import {
  ModelConnectivityError,
  type ClaudeTransport,
  type ClaudeTransportContentBlock,
  type ClaudeTransportRequest,
  type ClaudeTransportResponse,
} from "@/features/heby-model";

export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";
export const ANTHROPIC_API_KEY_ENV = "ANTHROPIC_API_KEY";

/** The hard smoke-test budget. Not exceeded without explicit Director authorization. */
export const MAX_LIVE_CALLS = 1;
export const MAX_LIVE_OUTPUT_TOKENS = 300;
export const LIVE_REQUEST_TIMEOUT_MS = 30_000;

/** Minimal fetch shape — injectable so request/error handling is provable with NO real call. */
export type FetchLike = (
  input: string,
  init: {
    readonly method: string;
    readonly headers: Record<string, string>;
    readonly body: string;
    readonly signal?: AbortSignal;
  },
) => Promise<{ readonly ok: boolean; readonly status: number; json(): Promise<unknown> }>;

export interface LiveClaudeTransportConfig {
  /** Server-only API key. Read once; never logged, returned, or persisted. */
  readonly apiKey: string;
  /** Hard cap on live calls for this transport instance. Defaults to MAX_LIVE_CALLS (1). */
  readonly maxLiveCalls?: number;
  readonly timeoutMs?: number;
  /** Injectable transport for tests. Production uses the global fetch. */
  readonly fetchImpl?: FetchLike;
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("The live Claude transport is server-only.");
  }
}

/** Presence only — never the value. Presence is not authentication, reachability, or success. */
export function isLiveCredentialPresent(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return Boolean(env[ANTHROPIC_API_KEY_ENV]?.trim());
}

/** Map an HTTP status to a typed, redacted connectivity error. No provider text is surfaced. */
function mapStatus(status: number): ModelConnectivityError {
  if (status === 401 || status === 403) return new ModelConnectivityError("authentication-failed");
  if (status === 429) return new ModelConnectivityError("rate-limited");
  if (status === 400 || status === 404 || status === 422) return new ModelConnectivityError("invalid-configuration");
  if (status >= 500) return new ModelConnectivityError("provider-unavailable");
  return new ModelConnectivityError("unknown-provider-error");
}

function asContentBlocks(value: unknown): readonly ClaudeTransportContentBlock[] {
  if (!Array.isArray(value)) return [];
  return value.map((block) => {
    const b = block as { type?: unknown; text?: unknown };
    return {
      type: typeof b.type === "string" ? b.type : "unknown",
      text: typeof b.text === "string" ? b.text : undefined,
    };
  });
}

/** Project the Anthropic payload into the neutral transport response. Unknown fields stay undefined. */
function toTransportResponse(payload: unknown, requestedModel: string): ClaudeTransportResponse {
  const p = (payload ?? {}) as {
    id?: unknown; model?: unknown; content?: unknown; stop_reason?: unknown;
    usage?: { input_tokens?: unknown; output_tokens?: unknown };
  };
  const input = p.usage?.input_tokens;
  const output = p.usage?.output_tokens;
  return {
    id: typeof p.id === "string" ? p.id : undefined,
    model: typeof p.model === "string" ? p.model : requestedModel,
    content: asContentBlocks(p.content),
    stopReason: typeof p.stop_reason === "string" ? p.stop_reason : undefined,
    usage: {
      inputTokens: typeof input === "number" ? input : undefined,
      outputTokens: typeof output === "number" ? output : undefined,
    },
  };
}

/**
 * Build the live Claude transport. Constructing it is inert (no I/O). Only `send()` calls out,
 * and it fails closed on a missing key, an over-budget output bound, or an exhausted call
 * budget — before any request is dispatched.
 */
export function createLiveClaudeTransport(config: LiveClaudeTransportConfig): ClaudeTransport {
  assertServerRuntime();
  const apiKey = config.apiKey?.trim();
  if (!apiKey) {
    throw new ModelConnectivityError("missing-credential", "No Anthropic API key is configured.");
  }
  const maxCalls = config.maxLiveCalls ?? MAX_LIVE_CALLS;
  const timeoutMs = config.timeoutMs ?? LIVE_REQUEST_TIMEOUT_MS;
  const doFetch: FetchLike = config.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  let calls = 0;

  return {
    async send(request: ClaudeTransportRequest): Promise<ClaudeTransportResponse> {
      // Budget gates BEFORE any network I/O.
      if (request.maxTokens > MAX_LIVE_OUTPUT_TOKENS) {
        throw new ModelConnectivityError(
          "invalid-configuration",
          `Requested output tokens exceed the live budget of ${MAX_LIVE_OUTPUT_TOKENS}.`,
        );
      }
      if (calls >= maxCalls) {
        throw new ModelConnectivityError("rate-limited", "Live-call budget exhausted for this process.");
      }
      calls += 1;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: { ok: boolean; status: number; json(): Promise<unknown> };
      try {
        response = await doFetch(ANTHROPIC_MESSAGES_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: request.model,
            system: request.system,
            max_tokens: request.maxTokens,
            messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
          }),
          signal: controller.signal,
        });
      } catch (error) {
        // Abort → timeout; anything else → provider unavailable. The raw error never surfaces.
        const aborted = error instanceof Error && error.name === "AbortError";
        throw new ModelConnectivityError(aborted ? "timeout" : "provider-unavailable");
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) throw mapStatus(response.status);

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new ModelConnectivityError("malformed-response", "Provider returned a non-JSON body.");
      }
      return toTransportResponse(payload, request.model);
    },
  };
}
