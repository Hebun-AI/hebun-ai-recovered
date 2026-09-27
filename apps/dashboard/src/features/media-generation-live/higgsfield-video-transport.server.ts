/*
 * media-generation-live/higgsfield-video-transport.server.ts — the Higgsfield video transport (MV-6).
 *
 * A TRANSPORT, AND NOTHING ELSE. It implements `MediaAsyncGenerationTransport`: `dispatch` asks
 * Higgsfield for one job, `poll` asks how one known job is going. It writes no row, stores no bytes,
 * downloads nothing, decides no admission, holds no Governance, retry, storage, publishing or
 * reconciliation authority, and reads no environment — the resolver hands it its credential. The
 * MV-4 lifecycle writer (`async-generation-lifecycle.server.ts`) remains the only owner of the
 * invocation's state; this module only returns typed observations to it.
 *
 * ── THE CONTRACT IT SPEAKS (official docs.higgsfield.ai, re-read 2026-09-27) ──
 *
 *   POST https://api.higgsfield.ai/<model path>          Authorization: Key <api-key>  (opaque, verbatim)
 *     → 200 { status: "queued", request_id: <uuid>, status_url, cancel_url }
 *   GET  https://api.higgsfield.ai/requests/<request_id>/status
 *     → 200 { status, request_id, error?, video?: { url } }
 *     → 404 "the request does not exist or belongs to another account"
 *   status ∈ queued | in_progress | completed | failed | nsfw | canceled   (last four terminal)
 *
 * ── ONE SHOT. NO RETRY. (the reason this is REST and not an SDK) ──────────────
 *
 * Higgsfield documents no idempotency key and says, in its own errors guide, not to repeat a
 * generation POST after an ambiguous timeout. Both official SDKs nevertheless retry the generation
 * POST by default (TS: ECONNRESET/ETIMEDOUT/5xx; Python: 408/429/5xx). So this module calls `fetch`
 * exactly once per dispatch, with `redirect: "error"`, a bounded timeout and a capped body read.
 * Nothing here loops. A second attempt is a new human request with a new request key.
 *
 * ── WHAT EACH DISPATCH ANSWER MEANS (MV-6 4xx truth gate) ─────────────────────
 *
 *   2xx + a uuid `request_id`                     accepted  → MV-4 provider-pending
 *   a DOCUMENTED synchronous refusal: 400, 401,   rejected  → MV-4 provider-failed (closed code)
 *   403, 404, 422 or 423 WITH Higgsfield's
 *   FastAPI error envelope (`{ "detail": … }`)
 *   everything else — thrown, timed out, 3xx,     unknown   → MV-4 dispatch-unknown
 *   any 5xx, any other 4xx (408, 409, 429, …),
 *   a documented 4xx WITHOUT the envelope, or
 *   a 2xx without a usable id
 *
 * WHY THIS SET AND NO OTHER. Higgsfield's errors guide separates errors that "occur before a request
 * is accepted" — the synchronous table: 400 invalid/rejected input or concurrency reached, 401
 * credentials, 403 insufficient credits, 404 request or model not found for the account, 422 body
 * validation, 423 model temporarily blocked, 500, 503 — from failures of an ACCEPTED request, which
 * finish later as `failed` or `nsfw`. That documented split is the only evidence that a refusal left
 * no job, and it is a classification, not an explicit "no job was created" guarantee (none exists).
 * So a refusal is recorded only where BOTH hold: the status is in that table with a request-refusal
 * meaning, and the body carries the documented envelope, which is what distinguishes Higgsfield's API
 * answering from a proxy, CDN or gateway in front of it. The envelope's text is never read.
 *
 * 5xx stays `unknown` although the table lists 500 and 503: its own safe-retry policy retries only
 * status GETs after a 5xx and forbids repeating an ambiguous POST, and a 5xx can follow a job the
 * backend already accepted. 408, 409 and 429 are not in Higgsfield's table at all (it reports
 * concurrency as 400), so for this provider they are undocumented — `unknown`, never a guessed
 * refusal. Nothing here is retried; a second attempt is a new human request with a new request key.
 *
 * ── WHAT EACH POLL ANSWER MEANS ─────────────────────────────────────────────
 *
 *   queued / in_progress                → pending
 *   completed + a video URL             → succeeded, outputRef = the request_id
 *   nsfw                                → failed: moderation-blocked
 *   failed                              → failed: generation-failed   (MV-6 code; `error` text unread)
 *   canceled                            → failed: provider-canceled   (MV-6 code)
 *   404                                 → NOT RECORDED (see below)
 *   anything unreadable                 → thrown: an observation, not a transition
 *
 * `outputRef` is the request id, never the URL: the provider URL is temporary (retained "at least
 * seven days") and the MV-4 CHECK forbids `/` in the column precisely so an ephemeral link cannot be
 * persisted. Retrieval re-reads the status by id when it needs the URL.
 *
 * ── FAILED, CANCELED AND 404 (Director, MV-6 Gate 1) ─────────────────────────
 *
 * `failed` carries free text and no documented cause, and `canceled` can only come from someone
 * holding the provider account — Hebun cannot cancel. Neither fits an existing closed code, so the
 * Director approved two narrow codes, `generation-failed` and `provider-canceled` (migration
 * `mv6_higgsfield_failure_codes`, CHECK only). A 404 means the provider no longer answers for a job
 * id Hebun holds; that is not a failure Hebun observed, so `poll` THROWS
 * `HiggsfieldObservationNotRecorded("not-found")`, the lifecycle moves nothing and reports
 * `observation-unreadable`, and the row keeps `provider-pending` — the last provider fact it has.
 *
 * ── WHAT NEVER LEAVES THIS MODULE ────────────────────────────────────────────
 *
 * The API key, the Authorization header, the raw body, provider error text, and output
 * URLs. Only a validated request id and closed codes are returned. Nothing is logged. No webhook
 * parameter is sent — webhooks are not part of MV-6's authority.
 *
 * Server-only.
 */
import type { MediaGenerationTransportKind } from "@/features/media-assets/contracts";
import type {
  MediaAsyncDispatchOutcome,
  MediaAsyncGenerationTransport,
  MediaAsyncPollOutcome,
  MediaAsyncProviderFailure,
} from "@/features/media-assets/async-generation-transport";
import type { LiveSpendBudget } from "@/features/heby-model-live/live-spend-budget.server";

export const HIGGSFIELD_API_ORIGIN = "https://api.higgsfield.ai";
export const HIGGSFIELD_PROVIDER = "higgsfield";

/*
 * ── THE ONE MODEL (provisional, MV-6) ────────────────────────────────────────
 *
 * PixVerse V6 text-to-video. Chosen to prove the architecture, not for quality: text-only input (no
 * media upload), the smallest documented output knobs of the text-to-video candidates compared
 * (duration down to 1 s, resolution down to 360p, audio switchable off) and a closed request schema
 * (`additionalProperties: false`), so an unexpected field is refused rather than silently ignored.
 * Higgsfield publishes no per-model price; the choice is PROVISIONAL until the authenticated
 * `POST /estimate/<model path>` confirms it is the cheapest candidate for the Director's account.
 * The request parameters are pinned constants, not configuration, and they are part of `model` so
 * the recorded invocation says exactly what was asked for.
 */
export const HIGGSFIELD_VIDEO_MODEL_PATH = "pixverse/v6/text-to-video";
export const HIGGSFIELD_VIDEO_REQUEST_PARAMETERS = Object.freeze({
  duration: 3,
  resolution: "540p",
  aspect_ratio: "16:9",
  generate_audio: false,
} as const);
export const HIGGSFIELD_VIDEO_MODEL = `${HIGGSFIELD_VIDEO_MODEL_PATH}@3s-540p-16x9-silent`;
export const HIGGSFIELD_VIDEO_SUBMIT_URL = `${HIGGSFIELD_API_ORIGIN}/${HIGGSFIELD_VIDEO_MODEL_PATH}`;

/** The submission "returns immediately" per the docs; this bounds a hung connection, nothing more. */
export const HIGGSFIELD_DISPATCH_TIMEOUT_MS = 30_000;
/** The docs' own polling example uses a 30 s request timeout. */
export const HIGGSFIELD_POLL_TIMEOUT_MS = 30_000;
/** Both documented bodies are a few hundred bytes of JSON. */
export const HIGGSFIELD_MAX_RESPONSE_BYTES = 64 * 1024;

const REQUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDER_STATES = ["queued", "in_progress", "completed", "failed", "nsfw", "canceled"] as const;
export type HiggsfieldRequestState = (typeof PROVIDER_STATES)[number];

export function higgsfieldStatusUrl(requestId: string): string {
  if (!REQUEST_ID_RE.test(requestId)) throw new Error("Not a Higgsfield request id.");
  return `${HIGGSFIELD_API_ORIGIN}/requests/${requestId}/status`;
}

export type HiggsfieldFetch = (
  input: string,
  init: {
    readonly method: "POST" | "GET";
    readonly headers: Record<string, string>;
    readonly body?: string;
    readonly redirect: "error";
    readonly cache: "no-store";
    readonly signal: AbortSignal;
  },
) => Promise<Response>;

/**
 * THE CREDENTIAL IS ONE OPAQUE VALUE. Higgsfield's current key flow (open.higgsfield.ai API keys, and
 * its official quick-start) issues a single "Higgsfield API key", copied as-is and sent as
 * `Authorization: Key <api-key>` — "the complete copied credential, without an added `Key` prefix",
 * and integrations must "not ask users to split or assemble credentials or require a colon". Hebun
 * therefore never splits, joins or inspects it, and a console record id ("Copy ID") is not part of
 * authentication. Server-only; never logged, returned, or persisted.
 */
export interface HiggsfieldCredential {
  readonly apiKey: string;
}

export interface HiggsfieldVideoTransportConfig {
  readonly credential: HiggsfieldCredential;
  /** The shared per-process live-call budget. Spent by dispatch only: a status read bills nothing. */
  readonly spendBudget: LiveSpendBudget;
  readonly fetchImpl?: HiggsfieldFetch;
  readonly dispatchTimeoutMs?: number;
  readonly pollTimeoutMs?: number;
}

/**
 * What one status read observed, before any mapping onto MV-4. Every documented provider state is
 * representable here, including the three MV-4 cannot record yet.
 */
export type HiggsfieldStatusObservation =
  | { readonly kind: "state"; readonly state: HiggsfieldRequestState; readonly hasVideoUrl: boolean }
  | { readonly kind: "not-found" }
  | { readonly kind: "unreadable" };

/** Observed, and deliberately not recorded: the lifecycle has no truthful place for it (see the header). */
export class HiggsfieldObservationNotRecorded extends Error {
  constructor(readonly observed: "not-found") {
    super(`Higgsfield reported "${observed}", which the MV-4 lifecycle cannot record truthfully.`);
    this.name = "HiggsfieldObservationNotRecorded";
  }
}

class Unreadable extends Error {
  constructor() {
    super("The Higgsfield status answer was not readable.");
    this.name = "HiggsfieldStatusUnreadable";
  }
}

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

async function readJson(response: Response): Promise<unknown> {
  try {
    const raw = await readCapped(response, HIGGSFIELD_MAX_RESPONSE_BYTES);
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    return undefined;
  }
}

function field(body: unknown, name: string): unknown {
  return body && typeof body === "object" ? (body as Record<string, unknown>)[name] : undefined;
}

function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== "string" || value.length > 4096) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

type RejectedFailure = Exclude<MediaAsyncProviderFailure, "timeout" | "malformed-response">;

/**
 * The documented synchronous refusals and the closed code each is recorded as. Nothing outside this
 * table is ever a refusal.
 */
export const HIGGSFIELD_DOCUMENTED_DISPATCH_REFUSALS: Readonly<Record<number, RejectedFailure>> = Object.freeze({
  400: "request-rejected", // invalid parameters, rejected input, or concurrency reached
  401: "authentication-failed", // missing or invalid credentials
  403: "quota-exhausted", // insufficient credits
  404: "request-rejected", // request or model not found for this account
  422: "request-rejected", // request body validation failed
  423: "provider-unavailable", // model temporarily blocked
});

/** Higgsfield's documented FastAPI envelope: `detail` is a string, or a list for validation errors. */
export function hasHiggsfieldErrorEnvelope(body: unknown): boolean {
  const detail = field(body, "detail");
  return (typeof detail === "string" && detail.length > 0) || (Array.isArray(detail) && detail.length > 0);
}

/**
 * A dispatch HTTP status and body → rejected (with a closed code) or unknown. Never "accepted":
 * acceptance is decided only by a readable body naming a job.
 */
export function classifyHiggsfieldDispatchStatus(status: number, body: unknown): { readonly rejected: RejectedFailure } | "unknown" {
  const failure = Object.prototype.hasOwnProperty.call(HIGGSFIELD_DOCUMENTED_DISPATCH_REFUSALS, status)
    ? HIGGSFIELD_DOCUMENTED_DISPATCH_REFUSALS[status]
    : undefined;
  if (!failure || !hasHiggsfieldErrorEnvelope(body)) return "unknown";
  return { rejected: failure };
}

/** A status read's HTTP answer and body → one typed observation. Pure. */
export function observeHiggsfieldStatus(httpStatus: number, body: unknown, requestId: string): HiggsfieldStatusObservation {
  if (httpStatus === 404) return { kind: "not-found" };
  if (httpStatus !== 200) return { kind: "unreadable" };
  const state = field(body, "status");
  /* An answer about some other job is not an answer about this one. */
  if (field(body, "request_id") !== requestId) return { kind: "unreadable" };
  if (typeof state !== "string" || !(PROVIDER_STATES as readonly string[]).includes(state)) return { kind: "unreadable" };
  return { kind: "state", state: state as HiggsfieldRequestState, hasVideoUrl: isHttpsUrl(field(field(body, "video"), "url")) };
}

/**
 * The ONLY place a provider state becomes an MV-4 poll outcome. Throws for what MV-4 cannot record,
 * so the lifecycle moves nothing rather than recording a cause nobody observed.
 */
export function toMediaAsyncPollOutcome(observation: HiggsfieldStatusObservation, requestId: string): MediaAsyncPollOutcome {
  if (observation.kind === "not-found") throw new HiggsfieldObservationNotRecorded("not-found");
  if (observation.kind === "unreadable") throw new Unreadable();
  switch (observation.state) {
    case "queued":
    case "in_progress":
      return { status: "pending" };
    case "completed":
      /* "Completed" with no output is not a completion Hebun can use; read it again later. */
      if (!observation.hasVideoUrl) throw new Unreadable();
      return { status: "succeeded", outputRef: requestId };
    case "nsfw":
      return { status: "failed", failure: "moderation-blocked" };
    case "failed":
      /* The provider's free-text `error` is never read: it is not a Hebun taxonomy. */
      return { status: "failed", failure: "generation-failed" };
    case "canceled":
      /* The provider says so. Hebun has no cancel capability and never claims nothing ran or billed. */
      return { status: "failed", failure: "provider-canceled" };
  }
}

/** Printable ASCII with no whitespace — so a pasted "Key …" or "Bearer …" prefix cannot pass. */
const API_KEY_RE = /^[\x21-\x7e]{16,4096}$/;

/**
 * Shape only. A well-formed key is not a working one; nothing is probed. A colon is neither required
 * nor refused: the value is opaque.
 */
export function isHiggsfieldCredentialShaped(credential: { apiKey?: string }): boolean {
  return API_KEY_RE.test(credential.apiKey ?? "");
}

export function createHiggsfieldVideoTransport(config: HiggsfieldVideoTransportConfig): MediaAsyncGenerationTransport {
  if (typeof window !== "undefined") {
    throw new Error("The Higgsfield video transport is server-only.");
  }
  if (!isHiggsfieldCredentialShaped(config.credential)) {
    throw new Error("The Higgsfield video transport needs a credential-shaped API key.");
  }
  const doFetch: HiggsfieldFetch = config.fetchImpl ?? ((input, init) => fetch(input, init));
  const dispatchTimeoutMs = config.dispatchTimeoutMs ?? HIGGSFIELD_DISPATCH_TIMEOUT_MS;
  const pollTimeoutMs = config.pollTimeoutMs ?? HIGGSFIELD_POLL_TIMEOUT_MS;
  /* The documented scheme with the opaque key verbatim — never split, joined or re-encoded. */
  const authorization = () => `Key ${config.credential.apiKey}`;

  return Object.freeze({
    transport: "live" as MediaGenerationTransportKind,
    provider: HIGGSFIELD_PROVIDER,
    model: HIGGSFIELD_VIDEO_MODEL,
    outputMediaKind: "video" as const,

    async dispatch(input: Parameters<MediaAsyncGenerationTransport["dispatch"]>[0]): Promise<MediaAsyncDispatchOutcome> {
      /* Nothing has left Hebun yet, so this refusal is certain. */
      if (!config.spendBudget.attempt()) return { status: "rejected", failure: "budget-exhausted" };

      let response: Response;
      try {
        response = await doFetch(HIGGSFIELD_VIDEO_SUBMIT_URL, {
          method: "POST",
          headers: {
            authorization: authorization(),
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({ prompt: input.promptText, ...HIGGSFIELD_VIDEO_REQUEST_PARAMETERS }),
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(dispatchTimeoutMs),
        });
      } catch {
        /* Timeout, reset, DNS, redirect: whether the POST reached Higgsfield cannot be known. */
        return { status: "unknown" };
      }

      if (response.status >= 200 && response.status < 300) {
        const body = await readJson(response);
        const requestId = field(body, "request_id");
        if (typeof requestId === "string" && REQUEST_ID_RE.test(requestId)) {
          return { status: "accepted", providerJobId: requestId };
        }
        /* A success status naming no job Hebun could ever poll: the job may exist. */
        return { status: "unknown" };
      }
      /* The body is read for the envelope's SHAPE only; its text never leaves this function. */
      const verdict = classifyHiggsfieldDispatchStatus(response.status, await readJson(response));
      return verdict === "unknown" ? { status: "unknown" } : { status: "rejected", failure: verdict.rejected };
    },

    async poll(input: Parameters<MediaAsyncGenerationTransport["poll"]>[0]): Promise<MediaAsyncPollOutcome> {
      const url = higgsfieldStatusUrl(input.providerJobId);
      const response = await doFetch(url, {
        method: "GET",
        headers: { authorization: authorization(), accept: "application/json" },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(pollTimeoutMs),
      }).catch(() => {
        throw new Unreadable();
      });
      const body = await readJson(response);
      return toMediaAsyncPollOutcome(observeHiggsfieldStatus(response.status, body, input.providerJobId), input.providerJobId);
    },
  });
}
