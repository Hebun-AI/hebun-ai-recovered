/*
 * provider-instagram/instagram-publish-transport.server.ts — the ONE Instagram write path (PUBLISH-0).
 *
 * ── WHAT THIS MODULE CAN EXPRESS, EXHAUSTIVELY ───────────────────────────────
 *
 *   POST  /{ig-user-id}/media           image_url, caption      → a container id
 *   GET   /{container-id}               fields=status_code      → the container's state
 *   POST  /{ig-user-id}/media_publish   creation_id             → the published media id
 *
 * Three operations, each a frozen entry in `INSTAGRAM_PUBLISH_OPERATIONS`. There is no generic
 * `post(path)`, no caller-supplied URL, no caller-supplied host and no caller-supplied parameter
 * name. The host is `INSTAGRAM_API_ORIGIN`, the version is the pinned `INSTAGRAM_API_VERSION`.
 *
 * ── WHAT THIS MODULE IS NOT ──────────────────────────────────────────────────
 *
 * It is not an authority. It receives no tenant, no session, no permit, no database handle and no
 * Governance decision — exactly the sandbox shape of `action-execution/adapter-contract.ts`. It
 * cannot decide whether anyone MAY publish; it can only perform one publish when handed a token,
 * a publishing id and approved bytes, by a caller that already holds that answer.
 *
 * ── THE PHASE DISTINCTION ────────────────────────────────────────────────────
 *
 * A container is not a post. Nothing is visible on Instagram until `/media_publish` succeeds, so any
 * failure BEFORE that call is `rejected` or `unreachable` with no external effect. A fault AFTER the
 * `/media_publish` request may have left is `ambiguous` — the post may exist — and is never
 * reported as a failure. `accepted` requires the media id Meta returned; a success without one is
 * `ambiguous`.
 *
 * ZERO RETRIES of either POST. The status read is a bounded GET poll and nothing more.
 *
 * Server-only. The token travels in the `Authorization` header and never in a URL, a body, a log or
 * a returned value.
 */
import type { FetchLike } from "@/features/provider-youtube/youtube-transport.server";
import { INSTAGRAM_API_ORIGIN, INSTAGRAM_API_VERSION } from "./contracts";

/** The closed operation list. A test pins it; adding an entry is a reviewed change. */
export const INSTAGRAM_PUBLISH_OPERATIONS = Object.freeze([
  Object.freeze({
    id: "container.create",
    method: "POST",
    path: "/{ig-user-id}/media",
    params: Object.freeze(["image_url", "caption"]),
  }),
  Object.freeze({
    id: "container.status",
    method: "GET",
    path: "/{container-id}",
    params: Object.freeze(["fields"]),
  }),
  Object.freeze({
    id: "media.publish",
    method: "POST",
    path: "/{ig-user-id}/media_publish",
    params: Object.freeze(["creation_id"]),
  }),
] as const);

export type InstagramPublishOperationId = (typeof INSTAGRAM_PUBLISH_OPERATIONS)[number]["id"];

/** Every path this module may request, as one closed pattern over interpolated digit ids. */
export const INSTAGRAM_PUBLISH_PATH_PATTERN = /^\/[0-9]{1,32}(?:\/media|\/media_publish)?$/;

/** The adapter id recorded beside any provider id this module returns. Names whose id it is. */
export const INSTAGRAM_PUBLISH_ADAPTER_ID = "instagram-graph-publish-v1" as const;

/** A caption Meta will accept. Meta documents a 2,200-character limit. */
export const INSTAGRAM_MAX_CAPTION_LENGTH = 2200 as const;

const DIGITS = /^[0-9]{1,32}$/;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_STATUS_POLLS = 5;
const DEFAULT_STATUS_INTERVAL_MS = 2_000;

/** Everything a publish is told. No tenant, no authority, no database. */
export interface InstagramPublishInput {
  /** The `user_id` from `/me` — read at the moment of need, never from a record. */
  readonly publishingAccountId: string;
  /** Publicly reachable HTTPS image. Meta fetches it; Hebun never uploads bytes. */
  readonly imageUrl: string;
  /** The exact approved caption. Never model output assembled at execution time. */
  readonly caption: string;
}

/**
 * What happened, in the four shapes the execution ledger already speaks, plus the container id
 * when one was created (a container is an intermediate provider object, not a post).
 */
export type InstagramPublishOutcome =
  | { readonly class: "accepted"; readonly mediaId: string; readonly containerId: string }
  | { readonly class: "rejected"; readonly reason: string; readonly containerId: string | null }
  | { readonly class: "unreachable"; readonly reason: string; readonly containerId: string | null }
  | { readonly class: "ambiguous"; readonly reason: string; readonly containerId: string | null };

export interface InstagramPublishTransportDeps {
  readonly fetchImpl?: FetchLike;
  readonly timeoutMs?: number;
  readonly statusPolls?: number;
  readonly statusIntervalMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("The Instagram publish transport is server-only.");
  }
}

/** Validate the input before anything leaves the process. A refusal here has no external effect. */
export function validatePublishInput(input: InstagramPublishInput): string | null {
  if (!DIGITS.test(input.publishingAccountId)) return "publishing-id-invalid";
  let url: URL;
  try {
    url = new URL(input.imageUrl);
  } catch {
    return "image-url-invalid";
  }
  if (url.protocol !== "https:" || url.username || url.password) return "image-url-invalid";
  if (typeof input.caption !== "string") return "caption-invalid";
  if (input.caption.length > INSTAGRAM_MAX_CAPTION_LENGTH) return "caption-too-long";
  return null;
}

type Sent =
  | { readonly kind: "answered"; readonly status: number; readonly body: Record<string, unknown> | null }
  /** Provably pre-write: the request never got a connection. */
  | { readonly kind: "not-sent" }
  /** The request may have reached Meta. */
  | { readonly kind: "lost" };

/** The ONLY place a URL is built. Path ids are digit-checked; params are checked against the op. */
async function send(
  operationId: InstagramPublishOperationId,
  ids: { readonly igUserId?: string; readonly containerId?: string },
  params: Readonly<Record<string, string>>,
  accessToken: string,
  deps: InstagramPublishTransportDeps,
): Promise<Sent> {
  assertServerOnly();
  const op = INSTAGRAM_PUBLISH_OPERATIONS.find((o) => o.id === operationId);
  if (!op) return { kind: "not-sent" };

  const path = op.path
    .replace("{ig-user-id}", ids.igUserId ?? "")
    .replace("{container-id}", ids.containerId ?? "");
  if (!INSTAGRAM_PUBLISH_PATH_PATTERN.test(path)) return { kind: "not-sent" };
  for (const name of Object.keys(params)) {
    if (!(op.params as readonly string[]).includes(name)) return { kind: "not-sent" };
  }

  const url = new URL(`${INSTAGRAM_API_ORIGIN}/${INSTAGRAM_API_VERSION}${path}`);
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
  let body: string | undefined;
  if (op.method === "GET") {
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(params).toString();
  }

  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(url.toString(), {
      method: op.method,
      headers,
      body,
      signal: controller.signal,
    });
  } catch (error) {
    /*
     * BIAS TOWARD `lost`. Only an error that positively states the connection never established
     * is `not-sent`; an abort or anything else may have followed a write.
     */
    const code = (error as { cause?: { code?: string } })?.cause?.code;
    const preWrite = code === "ENOTFOUND" || code === "ECONNREFUSED" || code === "EAI_AGAIN";
    return preWrite ? { kind: "not-sent" } : { kind: "lost" };
  } finally {
    clearTimeout(timer);
  }

  let json: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = await response.json();
    json = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    json = null;
  }
  return { kind: "answered", status: response.status, body: json };
}

function idFrom(body: Record<string, unknown> | null): string | null {
  const raw = body?.id;
  /* A number above 2^53 was already rounded by `JSON.parse`; only a safe integer is an id. */
  const id = typeof raw === "number" && Number.isSafeInteger(raw) ? String(raw) : raw;
  return typeof id === "string" && DIGITS.test(id) ? id : null;
}

/** A classified reason. Never a provider body, never a token, never a URL. */
function reasonFor(status: number, body: Record<string, unknown> | null): string {
  const error = body?.error as { code?: unknown } | undefined;
  const code = typeof error?.code === "number" ? error.code : null;
  if (status === 429 || code === 4 || code === 9 || code === 32) return "instagram-rate-limited";
  if (code === 190) return "instagram-token-rejected";
  if (code === 10 || code === 200) return "instagram-scope-insufficient";
  if (status >= 500) return `instagram-${status}`;
  return `instagram-rejected-${status}`;
}

/**
 * Publish ONE image to the account `publishingAccountId`, with the given token.
 *
 * Returns — never throws for a provider condition. The container id is returned whenever one was
 * created, so the caller can record it; the media id only on real acceptance.
 */
export async function publishInstagramImage(
  input: InstagramPublishInput,
  accessToken: string,
  deps: InstagramPublishTransportDeps = {},
): Promise<InstagramPublishOutcome> {
  assertServerOnly();
  const invalid = validatePublishInput(input);
  if (invalid) return { class: "rejected", reason: invalid, containerId: null };

  /* ── 1. THE CONTAINER. Not a post: nothing is visible yet. ─────────────── */
  const created = await send(
    "container.create",
    { igUserId: input.publishingAccountId },
    { image_url: input.imageUrl, caption: input.caption },
    accessToken,
    deps,
  );
  if (created.kind === "not-sent") {
    return { class: "unreachable", reason: "instagram-unreachable", containerId: null };
  }
  /*
   * A lost container answer is not ambiguous about a POST: no post can exist without the
   * `/media_publish` call below, which is never made. At worst an unpublished container exists at
   * Meta and expires on its own.
   */
  if (created.kind === "lost") {
    return { class: "unreachable", reason: "instagram-container-answer-lost", containerId: null };
  }
  const containerId = idFrom(created.body);
  if (created.status < 200 || created.status >= 300 || containerId === null) {
    return { class: "rejected", reason: reasonFor(created.status, created.body), containerId: null };
  }

  /* ── 2. THE CONTAINER'S STATE. A bounded GET poll; no POST is repeated. ── */
  const polls = Math.max(1, deps.statusPolls ?? DEFAULT_STATUS_POLLS);
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let finished = false;
  for (let i = 0; i < polls; i += 1) {
    const status = await send(
      "container.status",
      { containerId },
      { fields: "status_code" },
      accessToken,
      deps,
    );
    if (status.kind === "answered" && status.status >= 200 && status.status < 300) {
      const code = status.body?.status_code;
      if (code === "FINISHED") {
        finished = true;
        break;
      }
      if (code === "ERROR" || code === "EXPIRED" || code === "PUBLISHED") {
        /* PUBLISHED would mean somebody else already spent this container — never publish twice. */
        return { class: "rejected", reason: `instagram-container-${String(code).toLowerCase()}`, containerId };
      }
    }
    if (i < polls - 1) await sleep(deps.statusIntervalMs ?? DEFAULT_STATUS_INTERVAL_MS);
  }
  if (!finished) {
    return { class: "rejected", reason: "instagram-container-not-ready", containerId };
  }

  /* ── 3. THE PUBLISH. The only call with an external, visible effect. ──── */
  const published = await send(
    "media.publish",
    { igUserId: input.publishingAccountId },
    { creation_id: containerId },
    accessToken,
    deps,
  );
  if (published.kind === "not-sent") {
    return { class: "unreachable", reason: "instagram-unreachable", containerId };
  }
  if (published.kind === "lost") {
    return { class: "ambiguous", reason: "instagram-publish-answer-lost", containerId };
  }
  if (published.status >= 500) {
    /* A 5xx after the write left cannot prove the post was not created. */
    return { class: "ambiguous", reason: `instagram-${published.status}`, containerId };
  }
  if (published.status < 200 || published.status >= 300) {
    return { class: "rejected", reason: reasonFor(published.status, published.body), containerId };
  }
  const mediaId = idFrom(published.body);
  if (mediaId === null) {
    /* Success without the id is not acceptance: nothing could reconcile it later. */
    return { class: "ambiguous", reason: "instagram-publish-id-absent", containerId };
  }
  return { class: "accepted", mediaId, containerId };
}
