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
 * ── MV-7: RE-OBSERVING A COMPLETED JOB'S OUTPUT (`locateOutput`) ─────────────
 *
 * The same ONE status GET as `poll`, for a job Hebun already holds the id of. It never dispatches and
 * never touches the spend budget, so it cannot bill a generation. It returns the output URL only
 * inside a `MediaProviderOutputLocation`: `reveal()` is for the provider-output download seam alone,
 * and the location's enumerable facts are its SHAPE — scheme, hostname, query parameter NAMES and path
 * structure. It records nothing; the MV-4 lifecycle and the admission writer own every row.
 *
 * `HIGGSFIELD_OUTPUT_HOSTS` is the EXACT set of hosts an output may be downloaded from. A host enters
 * only after it was observed by re-observation AND the Director approved that exact name: no host is
 * guessed, and no suffix or wildcard exists, so every other host — including any other CloudFront
 * distribution — is refused by the download seam, on the first hop and on every redirect.
 *
 * ── WHAT NEVER LEAVES THIS MODULE ────────────────────────────────────────────
 *
 * The API key, the Authorization header, the raw body and provider error text. An output URL leaves
 * only behind `reveal()` (above). Only validated request ids, closed codes and a URL's shape are
 * returned. Nothing is logged. No webhook parameter is sent — webhooks are not part of MV-6's
 * authority.
 *
 * Server-only.
 */
import type { MediaGenerationTransportKind } from "@/features/media-assets/contracts";
import type {
  MediaAsyncDispatchOutcome,
  MediaAsyncGenerationTransport,
  MediaAsyncOutputLocation,
  MediaAsyncPollOutcome,
  MediaAsyncProviderFailure,
  MediaAsyncSourcePreparation,
  MediaPreparedSourceImage,
  MediaProviderOutputLocation,
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

/*
 * ── MODEL PROFILES: A CLOSED SET, ONE DEFAULT ────────────────────────────────
 *
 * `pixverse-v6` is the pinned production model and the default; the resolver never passes a profile,
 * so production can only ever get it. `hailuo-2.3-standard` exists for MV-6 real-provider acceptance
 * only (the cheapest authenticated estimate, $0.070 for 6 s): it is selectable solely by a caller that
 * constructs the transport itself — the acceptance tooling — and never through configuration.
 *
 * Hailuo's body is exactly its documented fields: `prompt`, `duration: 6` (enum 6 | 10) and
 * `prompt_optimizer: false` (documented default true). Its resolution is fixed at 768P by the
 * endpoint and it documents no audio field, so none is sent — nothing is invented, and because its
 * schema does not declare `additionalProperties: false`, an invented field could be silently ignored.
 */
/*
 * IMAGE → VIDEO (PROVISIONAL, not yet priced). PixVerse V6 image-to-video, per its official page
 * (docs.higgsfield.ai/docs/models/pixverse-v6/image-to-video, read 2026-09-27): `prompt` and
 * `image_url` required, `duration` 1–15, `resolution` 360p|540p|720p|1080p, `generate_audio` default
 * TRUE (so it is sent false), closed schema (`additionalProperties: false`), and NO aspect-ratio
 * field — "framing comes from the input image". `image_url` is the provider `public_url` of a source
 * this transport itself uploaded (see `prepareSourceImage`); it is never a Hebun URL.
 */
export const HIGGSFIELD_IMAGE_TO_VIDEO_MODEL_PATH = "pixverse/v6/image-to-video";
export const HIGGSFIELD_IMAGE_TO_VIDEO_PARAMETERS = Object.freeze({
  duration: 5,
  resolution: "720p",
  generate_audio: false,
} as const);
export const HIGGSFIELD_IMAGE_TO_VIDEO_MODEL = `${HIGGSFIELD_IMAGE_TO_VIDEO_MODEL_PATH}@5s-720p-silent`;

type ProfileParameters = Readonly<Record<string, string | number | boolean>>;
interface HiggsfieldProfileDefinition {
  readonly modelPath: string;
  readonly parameters: ProfileParameters;
  readonly model: string;
  /** `image` profiles take one uploaded source image as `image_url`; `text` profiles take a prompt only. */
  readonly inputMode: "text" | "image";
}

export const HIGGSFIELD_VIDEO_PROFILES = Object.freeze({
  "pixverse-v6": Object.freeze({
    modelPath: HIGGSFIELD_VIDEO_MODEL_PATH,
    parameters: HIGGSFIELD_VIDEO_REQUEST_PARAMETERS as ProfileParameters,
    model: HIGGSFIELD_VIDEO_MODEL,
    inputMode: "text",
  }),
  "hailuo-2.3-standard": Object.freeze({
    modelPath: "minimax/hailuo-2.3/standard/text-to-video",
    parameters: Object.freeze({ duration: 6, prompt_optimizer: false }) as ProfileParameters,
    model: "minimax/hailuo-2.3/standard/text-to-video@6s-768p-no-optimizer",
    inputMode: "text",
  }),
  "pixverse-v6-image-to-video": Object.freeze({
    modelPath: HIGGSFIELD_IMAGE_TO_VIDEO_MODEL_PATH,
    parameters: HIGGSFIELD_IMAGE_TO_VIDEO_PARAMETERS as ProfileParameters,
    model: HIGGSFIELD_IMAGE_TO_VIDEO_MODEL,
    inputMode: "image",
  }),
} satisfies Record<string, HiggsfieldProfileDefinition>);
export type HiggsfieldVideoProfile = keyof typeof HIGGSFIELD_VIDEO_PROFILES;
export const HIGGSFIELD_DEFAULT_VIDEO_PROFILE: HiggsfieldVideoProfile = "pixverse-v6";
/** IMAGE → VIDEO — the one image profile the resolver may return, for an `image` request only. */
export const HIGGSFIELD_IMAGE_TO_VIDEO_PROFILE: HiggsfieldVideoProfile = "pixverse-v6-image-to-video";

/*
 * ── IMAGE → VIDEO: THE SOURCE UPLOAD (Director G1 = B) ───────────────────────
 *
 * Official contract (docs.higgsfield.ai/docs/concepts/file-uploads, read 2026-09-27):
 *
 *   POST https://api.higgsfield.ai/files/generate-upload-url   Authorization: Key <api-key>
 *        { "content_type": "image/png" }
 *     → { public_url, upload_url, content_type, upload_headers }
 *   PUT  <upload_url>   with ONLY the headers in `upload_headers` (Content-Type, x-amz-tagging)
 *        — "Do not send Higgsfield API credentials to the presigned storage URL."
 *   then `image_url: <public_url>` in the generation body.
 *
 * DOCUMENTED: the upload URL expires after one hour; the tagging header carries
 * `retention=temporary`; the PUT content type must equal the one the URL was created for; accepted
 * image types include jpeg, png and webp. UNDOCUMENTED: size limits, how long `public_url` stays
 * readable, error bodies, retry safety of either call. So: no retry, no redirect, bounded bodies, a
 * header set we check rather than trust, and `retention=temporary` REQUIRED — an upload that would not
 * be tagged temporary is not made.
 *
 * Neither call is a generation: no job exists and the live spend budget is not touched. A refusal
 * here means NO generation POST follows. `public_url` and `upload_url` never leave this module except
 * behind the prepared source's `reveal()`, which only `dispatch` calls.
 */
export const HIGGSFIELD_UPLOAD_PREPARE_URL = `${HIGGSFIELD_API_ORIGIN}/files/generate-upload-url`;
/** Media's admitted image types that Higgsfield documents as upload types. Nothing else is uploaded. */
export const HIGGSFIELD_SOURCE_IMAGE_TYPES: readonly string[] = Object.freeze(["image/jpeg", "image/png", "image/webp"]);
/** The only header names a presigned PUT may carry (the documented set), lower-cased. */
const HIGGSFIELD_UPLOAD_HEADER_NAMES: readonly string[] = Object.freeze(["content-type", "x-amz-tagging"]);
export const HIGGSFIELD_UPLOAD_TIMEOUT_MS = 60_000;

/** The submission "returns immediately" per the docs; this bounds a hung connection, nothing more. */
export const HIGGSFIELD_DISPATCH_TIMEOUT_MS = 30_000;
/** The docs' own polling example uses a 30 s request timeout. */
export const HIGGSFIELD_POLL_TIMEOUT_MS = 30_000;
/** Both documented bodies are a few hundred bytes of JSON. */
export const HIGGSFIELD_MAX_RESPONSE_BYTES = 64 * 1024;

/**
 * MV-7 — the EXACT hosts a Higgsfield output may be downloaded from. Exact names only — never a
 * suffix, a wildcard or an IP literal, and never `cloudfront.net` itself.
 *
 *   d3u0tzju9qaucj.cloudfront.net   observed by the MV-7 re-observation of request f23c6488 and
 *                                   approved by the Director, 2026-09-27, as this exact name only
 */
export const HIGGSFIELD_OUTPUT_HOSTS: readonly string[] = Object.freeze(["d3u0tzju9qaucj.cloudfront.net"]);

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
/**
 * IMAGE → VIDEO — the ONE request that is not to Higgsfield's API: the PUT of verified bytes to the
 * presigned storage URL. A separate, narrower type so it can never carry the API credential by
 * construction of the call site, and so the API fetch keeps its exact MV-6 shape.
 */
export type HiggsfieldUploadFetch = (
  input: string,
  init: {
    readonly method: "PUT";
    readonly headers: Record<string, string>;
    readonly body: Uint8Array<ArrayBuffer>;
    readonly redirect: "error";
    readonly cache: "no-store";
    readonly signal: AbortSignal;
  },
) => Promise<Response>;

export interface HiggsfieldCredential {
  readonly apiKey: string;
}

export interface HiggsfieldVideoTransportConfig {
  readonly credential: HiggsfieldCredential;
  /** Omitted everywhere in production: the pinned default. Acceptance tooling may name another. */
  readonly profile?: HiggsfieldVideoProfile;
  /** The shared per-process live-call budget. Spent by dispatch only: a status read bills nothing. */
  readonly spendBudget: LiveSpendBudget;
  readonly fetchImpl?: HiggsfieldFetch;
  /** IMAGE → VIDEO: the presigned-storage PUT. Defaults to global fetch. */
  readonly uploadFetchImpl?: HiggsfieldUploadFetch;
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

const PRINTABLE_PARAM_NAME = /^[A-Za-z0-9._-]{1,64}$/;
const PLAIN_EXTENSION = /\.([a-z0-9]{1,5})$/i;

/**
 * MV-7 — wrap one output URL so that only its SHAPE is enumerable. The URL is reachable solely through
 * `reveal()`; `JSON.stringify` drops the function and nothing here copies the path or a query value.
 */
export function higgsfieldOutputLocation(rawUrl: string, allowedHosts: readonly string[]): MediaProviderOutputLocation {
  const url = new URL(rawUrl);
  /* `match`, not `split`: the MV-6 contract pins that nothing in this module splits a value. */
  const segments = url.pathname.match(/[^/]+/g) ?? [];
  const extension = PLAIN_EXTENSION.exec(segments[segments.length - 1] ?? "");
  const names = [...new Set(url.searchParams.keys())].map((name) => (PRINTABLE_PARAM_NAME.test(name) ? name : "<unprintable>")).sort();
  const shape = Object.freeze({
    scheme: url.protocol.replace(/:$/, ""),
    hostname: url.hostname.toLowerCase(),
    hasPort: url.port !== "",
    hasCredentials: url.username !== "" || url.password !== "",
    queryParameterNames: Object.freeze(names),
    pathSegmentCount: segments.length,
    pathExtension: extension ? `.${extension[1]!.toLowerCase()}` : null,
  });
  return Object.freeze({ shape, allowedHosts: Object.freeze([...allowedHosts]), reveal: () => rawUrl });
}

/** MV-7 — one status read → where the output is, or why it is not located. Pure. */
export function toMediaAsyncOutputLocation(httpStatus: number, body: unknown, requestId: string, allowedHosts: readonly string[]): MediaAsyncOutputLocation {
  const observation = observeHiggsfieldStatus(httpStatus, body, requestId);
  if (observation.kind === "not-found") return { status: "not-found" };
  if (observation.kind === "unreadable") return { status: "unreadable" };
  switch (observation.state) {
    case "queued":
    case "in_progress":
      return { status: "not-located", reason: "pending" };
    case "failed":
    case "nsfw":
    case "canceled":
      return { status: "not-located", reason: "failed" };
    case "completed": {
      const raw = field(field(body, "video"), "url");
      if (!observation.hasVideoUrl || typeof raw !== "string") return { status: "not-located", reason: "no-output" };
      return { status: "located", location: higgsfieldOutputLocation(raw, allowedHosts) };
    }
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

/**
 * IMAGE → VIDEO — the prepare-upload answer, checked. Returns the two URLs and the exact headers the
 * PUT may carry, or null when the answer is not the documented one (then nothing is uploaded).
 */
export function readHiggsfieldUploadGrant(
  body: unknown,
  contentType: string,
): { readonly uploadUrl: string; readonly publicUrl: string; readonly headers: Readonly<Record<string, string>> } | null {
  const uploadUrl = field(body, "upload_url");
  const publicUrl = field(body, "public_url");
  const declaredType = field(body, "content_type");
  const rawHeaders = field(body, "upload_headers");
  if (!isHttpsUrl(uploadUrl) || !isHttpsUrl(publicUrl) || declaredType !== contentType) return null;
  for (const u of [uploadUrl as string, publicUrl as string]) {
    const parsed = new URL(u);
    if (parsed.username !== "" || parsed.password !== "") return null;
  }
  if (!rawHeaders || typeof rawHeaders !== "object" || Array.isArray(rawHeaders)) return null;
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(rawHeaders as Record<string, unknown>)) {
    const lower = name.toLowerCase();
    if (!HIGGSFIELD_UPLOAD_HEADER_NAMES.includes(lower) || typeof value !== "string" || /[\r\n]/.test(value)) return null;
    headers[lower] = value;
  }
  /* The PUT's type must be the created type, and the object must be tagged temporary. */
  if (headers["content-type"] !== contentType) return null;
  const tags: readonly string[] = (headers["x-amz-tagging"] ?? "").match(/[^&]+/g) ?? [];
  if (!tags.includes("retention=temporary")) return null;
  return { uploadUrl: uploadUrl as string, publicUrl: publicUrl as string, headers: Object.freeze(headers) };
}

export function createHiggsfieldVideoTransport(config: HiggsfieldVideoTransportConfig): MediaAsyncGenerationTransport {
  if (typeof window !== "undefined") {
    throw new Error("The Higgsfield video transport is server-only.");
  }
  if (!isHiggsfieldCredentialShaped(config.credential)) {
    throw new Error("The Higgsfield video transport needs a credential-shaped API key.");
  }
  const profileName = config.profile ?? HIGGSFIELD_DEFAULT_VIDEO_PROFILE;
  if (!Object.prototype.hasOwnProperty.call(HIGGSFIELD_VIDEO_PROFILES, profileName)) {
    throw new Error("Unknown Higgsfield video profile.");
  }
  const profile = HIGGSFIELD_VIDEO_PROFILES[profileName];
  const submitUrl = `${HIGGSFIELD_API_ORIGIN}/${profile.modelPath}`;
  const doFetch: HiggsfieldFetch = config.fetchImpl ?? ((input, init) => fetch(input, init));
  const doUpload: HiggsfieldUploadFetch = config.uploadFetchImpl ?? ((input, init) => fetch(input, init));
  const dispatchTimeoutMs = config.dispatchTimeoutMs ?? HIGGSFIELD_DISPATCH_TIMEOUT_MS;
  const pollTimeoutMs = config.pollTimeoutMs ?? HIGGSFIELD_POLL_TIMEOUT_MS;
  /* The documented scheme with the opaque key verbatim — never split, joined or re-encoded. */
  const authorization = () => `Key ${config.credential.apiKey}`;
  const imageMode = profile.inputMode === "image";

  /*
   * IMAGE → VIDEO: one prepare POST to Higgsfield's API, then one PUT of the verified bytes to the
   * presigned storage URL — with the documented headers only, never the credential. No retry.
   */
  async function prepareSourceImage(input: { readonly bytes: Uint8Array; readonly contentType: string }): Promise<MediaAsyncSourcePreparation> {
    if (!HIGGSFIELD_SOURCE_IMAGE_TYPES.includes(input.contentType) || input.bytes.byteLength < 1) {
      return { status: "refused", reason: "unsupported-type" };
    }
    let prepared: Response;
    try {
      prepared = await doFetch(HIGGSFIELD_UPLOAD_PREPARE_URL, {
        method: "POST",
        headers: { authorization: authorization(), "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ content_type: input.contentType }),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(dispatchTimeoutMs),
      });
    } catch {
      return { status: "refused", reason: "upload-unknown" };
    }
    if (prepared.status < 200 || prepared.status >= 300) {
      await prepared.body?.cancel().catch(() => undefined);
      return { status: "refused", reason: "upload-refused" };
    }
    const grant = readHiggsfieldUploadGrant(await readJson(prepared), input.contentType);
    if (!grant) return { status: "refused", reason: "upload-unknown" };

    let put: Response;
    try {
      put = await doUpload(grant.uploadUrl, {
        method: "PUT",
        /* ONLY the documented presigned headers. The Higgsfield credential never goes to storage. */
        headers: { ...grant.headers },
        body: new Uint8Array(input.bytes),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(HIGGSFIELD_UPLOAD_TIMEOUT_MS),
      });
    } catch {
      return { status: "refused", reason: "upload-unknown" };
    }
    await put.body?.cancel().catch(() => undefined);
    if (put.status < 200 || put.status >= 300) return { status: "refused", reason: "upload-refused" };

    const publicUrl = grant.publicUrl;
    const source: MediaPreparedSourceImage = Object.freeze({
      contentType: input.contentType,
      byteSize: input.bytes.byteLength,
      reveal: () => publicUrl,
    });
    return { status: "prepared", source };
  }

  return Object.freeze({
    transport: "live" as MediaGenerationTransportKind,
    provider: HIGGSFIELD_PROVIDER,
    model: profile.model,
    outputMediaKind: "video" as const,
    inputMode: profile.inputMode,
    ...(imageMode ? { prepareSourceImage } : {}),

    async dispatch(input: Parameters<MediaAsyncGenerationTransport["dispatch"]>[0]): Promise<MediaAsyncDispatchOutcome> {
      /*
       * IMAGE → VIDEO: an image profile needs its prepared source; a text profile takes none. Refused
       * locally, before the budget and before any request — certain that nothing left Hebun.
       */
      if (imageMode !== (input.source !== undefined)) return { status: "rejected", failure: "request-rejected" };
      /* Nothing has left Hebun yet, so this refusal is certain. */
      if (!config.spendBudget.attempt()) return { status: "rejected", failure: "budget-exhausted" };

      let response: Response;
      try {
        response = await doFetch(submitUrl, {
          method: "POST",
          headers: {
            authorization: authorization(),
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify(
            input.source
              ? { prompt: input.promptText, image_url: input.source.reveal(), ...profile.parameters }
              : { prompt: input.promptText, ...profile.parameters },
          ),
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

    /* MV-7: the same one status GET as `poll`. No dispatch, no budget, no row — see the header. */
    async locateOutput(input: { readonly providerJobId: string }): Promise<MediaAsyncOutputLocation> {
      let url: string;
      try {
        url = higgsfieldStatusUrl(input.providerJobId);
      } catch {
        return { status: "unreadable" };
      }
      let response: Response;
      try {
        response = await doFetch(url, {
          method: "GET",
          headers: { authorization: authorization(), accept: "application/json" },
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(pollTimeoutMs),
        });
      } catch {
        return { status: "unreadable" };
      }
      return toMediaAsyncOutputLocation(response.status, await readJson(response), input.providerJobId, HIGGSFIELD_OUTPUT_HOSTS);
    },
  });
}
