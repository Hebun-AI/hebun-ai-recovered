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
 * - A per-INSTANCE live-call ceiling and a hard output-token ceiling (see MAX_LIVE_CALLS).
 * - Typed, redacted error mapping; the raw provider response never leaves this module.
 *
 * AUTHORITY, AS IT ACTUALLY STANDS. Deployment configuration SELECTS and constructs this
 * transport (`HEBUN_MODEL_TRANSPORT=live` plus a credential to build it); the durable R2E
 * Director connectivity control AUTHORIZES whether a request may be dispatched at all, and is
 * read before any transport is selected. The former `HEBUN_MODEL_LIVE_CALL_AUTHORIZED` env gate
 * is RETIRED and inert — selection no longer reads it. Constructing this performs no I/O; only
 * `send()` would call out.
 */

import {
  ModelConnectivityError,
  type ClaudeTransport,
  type ClaudeTransportContentBlock,
  type ClaudeTransportRequest,
  type ClaudeTransportResponse,
} from "@/features/heby-model";
/*
 * Direct file import, not the package index: `heby-model`'s index re-exports the transport
 * selector, which imports THIS module, so reaching the ceiling through the index would deepen an
 * existing cycle for no reason.
 */
import { MODEL_OUTPUT_TOKEN_CEILING } from "@/features/heby-model/model-connectivity-environment.server";
import {
  getProcessLiveSpendBudget,
  liveBudgetExhaustedError,
  type LiveSpendBudget,
} from "./live-spend-budget.server";

export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";
export const ANTHROPIC_API_KEY_ENV = "ANTHROPIC_API_KEY";

/**
 * How many live calls ONE transport instance will make. It is exactly that, and no more.
 *
 * ── WHAT THIS IS NOT (corrected at R2F.1) ────────────────────────────────────
 *
 * This was described as a "per-process live-call budget". It is not one, and never was. The
 * counter it guards (`calls`) lives in the closure `createLiveClaudeTransport` returns, and
 * `selectModelTransport` builds a FRESH transport on every request — nothing memoises it. So the
 * count resets each time, and the true guarantee is the narrow one stated above: within a single
 * transport instance, and therefore within a single answered request, at most one call goes out.
 *
 * ── AND WHAT NOW STANDS BESIDE IT (R2G) ─────────────────────────────────────
 *
 * That left Hebun with nothing between "Director off" and "unbounded". A shared per-PROCESS
 * budget now fills it — see `live-spend-budget.server.ts` — and this per-instance cap is kept
 * beside it as the narrow guarantee it always was, not as the spend bound it was mistaken for.
 *
 * The per-process budget is honestly per-process: it bounds a BURST inside one instance. It is
 * NOT a durable deployment-wide quota, not tenant billing, not tenant authorization, not
 * Governance, and not a guarantee about total spend across a serverless deployment, where many
 * instances exist and recycle. Who may own a DURABLE spend bound is still unresolved; R2F.1
 * measures usage and deliberately governs none of it.
 */
export const MAX_LIVE_CALLS = 1;

/**
 * The per-request output ceiling — DERIVED, not declared (R2G — K-1).
 *
 * This used to be an independent `300` while the configuration authority defaulted to `1024`,
 * so the released default guaranteed a refusal here before any network I/O. The number is now
 * owned by the configuration module and imported, which is why the two can no longer disagree.
 * The check below stays: it is the last thing before the wire, and defence in depth at a spend
 * boundary is worth one comparison.
 */
export const MAX_LIVE_OUTPUT_TOKENS = MODEL_OUTPUT_TOKEN_CEILING;
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
  /**
   * The shared per-process live-call budget. Defaults to the process singleton, which is what
   * makes the bound survive a new transport instance — see `live-spend-budget.server.ts`.
   */
  readonly spendBudget?: LiveSpendBudget;
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
  const budget = config.spendBudget ?? getProcessLiveSpendBudget();
  let calls = 0;

  return {
    async send(request: ClaudeTransportRequest): Promise<ClaudeTransportResponse> {
      /*
       * EVERY GATE IS CHECKED BEFORE ANY NETWORK I/O, IN THIS ORDER, AND THE ORDER MATTERS.
       *
       *   1. the output bound      — a configuration error, and it costs nothing to detect
       *   2. this instance's cap   — pure, no shared state consumed
       *   3. the PROCESS budget    — the only one that MUTATES, so it is consumed last
       *
       * A refusal from (1) or (2) must not spend a unit of (3): a request that never reached
       * the wire did not cost anything, and a limiter that charged for it would drain the
       * deployment's allowance on misconfiguration alone.
       *
       * Conversely (3) is consumed BEFORE the fetch, not after. A dispatched request may have
       * cost money even if it then times out or errors, so the conservative direction is to
       * count it the moment it is allowed to go out.
       */
      if (request.maxTokens > MAX_LIVE_OUTPUT_TOKENS) {
        throw new ModelConnectivityError(
          "invalid-configuration",
          `Requested output tokens exceed the live budget of ${MAX_LIVE_OUTPUT_TOKENS}.`,
        );
      }
      if (calls >= maxCalls) {
        throw new ModelConnectivityError("rate-limited", "This transport instance has already made its live call.");
      }
      if (!budget.attempt()) {
        throw liveBudgetExhaustedError();
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
