/*
 * provider-youtube/youtube-transport.server.ts — the ONLY code that speaks HTTP to YouTube (CGO-5).
 *
 * ── THE KEY NEVER LEAVES THIS MODULE'S FRAME ─────────────────────────────────
 *
 * The API key arrives as an argument, is placed on the request URL's `key` parameter, and the URL
 * is used exactly once. No function here returns the URL, logs it, stores it, or puts it in a
 * failure reason. A failure carries a CLASS and a short classified reason; a provider body is read
 * only to classify and is then dropped.
 *
 * ── ALLOWLISTED, LIST-ONLY ──────────────────────────────────────────────────
 *
 * Every request is built from `YOUTUBE_ALLOWED_OPERATIONS`. There is no generic `request(path)`
 * to call with a path somebody typed, so a write cannot be one edited argument away.
 *
 * ── CLASSIFICATION, FROM THE PROVIDER'S OWN WORDS ───────────────────────────
 *
 * Google's error envelope names a `reason` (`keyInvalid`, `accessNotConfigured`, `quotaExceeded`,
 * …). Each maps to ONE `YouTubeFailureClass`; a reason this module has not seen is `malformed`,
 * never `auth` — INT-4's lesson that a real provider returns errors a mock never imagined, and
 * that letting them fall through to an auth class spends credentials for nothing.
 *
 * Server-only.
 */
import {
  MAX_RECENT_VIDEOS,
  YOUTUBE_ALLOWED_OPERATIONS,
  YOUTUBE_API_ORIGIN,
  type YouTubeChannelView,
  type YouTubeFailure,
  type YouTubeFailureClass,
  type YouTubeOperationId,
  type YouTubeResult,
  type YouTubeVideoView,
} from "./contracts";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface YouTubeTransportDeps {
  readonly fetchImpl?: FetchLike;
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("The YouTube transport is server-only.");
  }
}

function fail(failure: YouTubeFailureClass, reason: string): YouTubeFailure {
  return { ok: false, failure, reason };
}

/** Google's `reason` word → the one class it means here. */
function classify(status: number, reason: string | null): YouTubeFailure {
  const r = reason ?? "";
  if (/^(keyInvalid|badRequest|forbidden|API_KEY_INVALID|API_KEY_SERVICE_BLOCKED|ipRefererBlocked)$/i.test(r) && (status === 400 || status === 403)) {
    return fail("auth", `youtube-rejected-key:${r}`);
  }
  if (/^(accessNotConfigured|SERVICE_DISABLED|PERMISSION_DENIED)$/i.test(r)) {
    return fail("disabled", `youtube-api-not-enabled:${r}`);
  }
  if (/^(quotaExceeded|dailyLimitExceeded|rateLimitExceeded|userRateLimitExceeded|RESOURCE_EXHAUSTED)$/i.test(r)) {
    return fail("quota", `youtube-quota:${r}`);
  }
  if (status === 401 || status === 403) return fail("auth", `youtube-http-${status}:${r || "no-reason"}`);
  if (status === 404) return fail("not-found", "youtube-http-404");
  if (status === 429) return fail("quota", "youtube-http-429");
  if (status >= 500) return fail("transport", `youtube-http-${status}`);
  return fail("malformed", `youtube-http-${status}:${r || "no-reason"}`);
}

function reasonFrom(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const errors = (error as { errors?: unknown }).errors;
  if (Array.isArray(errors) && errors[0] && typeof errors[0] === "object") {
    const reason = (errors[0] as { reason?: unknown }).reason;
    if (typeof reason === "string") return reason;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === "string" ? status : null;
}

async function call(
  operation: YouTubeOperationId,
  params: Readonly<Record<string, string>>,
  apiKey: string,
  deps: YouTubeTransportDeps,
): Promise<YouTubeResult<unknown>> {
  assertServerOnly();
  const policy = YOUTUBE_ALLOWED_OPERATIONS.find((op) => op.id === operation);
  if (!policy) return fail("malformed", "operation-not-permitted");
  const url = new URL(`${YOUTUBE_API_ORIGIN}${policy.path}`);
  for (const [name, value] of Object.entries(params)) {
    if (!(policy.params as readonly string[]).includes(name)) return fail("malformed", "parameter-not-permitted");
    url.searchParams.set(name, value);
  }
  url.searchParams.set("key", apiKey);

  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } catch {
    return fail("transport", "youtube-unreachable");
  } finally {
    clearTimeout(timer);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return response.ok ? fail("malformed", "youtube-body-unparseable") : classify(response.status, null);
  }
  if (!response.ok) return classify(response.status, reasonFrom(body));
  return { ok: true, value: body };
}

/* ── Safe projection helpers: only the fields the views name, or null ── */

function items(body: unknown): readonly Record<string, unknown>[] | null {
  if (!body || typeof body !== "object") return null;
  const list = (body as { items?: unknown }).items;
  if (!Array.isArray(list)) return null;
  return list.filter((i): i is Record<string, unknown> => Boolean(i) && typeof i === "object");
}

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function str(o: Record<string, unknown> | null, key: string): string | null {
  const v = o?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** YouTube reports counts as decimal STRINGS. Absent or unparseable → null, never 0. */
function count(o: Record<string, unknown> | null, key: string): number | null {
  const v = o?.[key];
  if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) return v;
  if (typeof v === "string" && /^[0-9]{1,15}$/.test(v)) return Number(v);
  return null;
}

export interface ChannelListing {
  readonly channel: YouTubeChannelView;
  readonly uploadsPlaylistId: string | null;
}

/** channels.list by handle — 1 unit. `not-found` when YouTube reports zero items. */
export async function listChannelByHandle(
  apiKey: string,
  handle: string,
  deps: YouTubeTransportDeps = {},
): Promise<YouTubeResult<ChannelListing>> {
  const result = await call(
    "channels.list",
    { part: "snippet,statistics,contentDetails", forHandle: handle },
    apiKey,
    deps,
  );
  if (!result.ok) return result;
  const list = items(result.value);
  if (list === null) return fail("malformed", "channels-items-missing");
  const first = list[0];
  if (!first) return fail("not-found", "channel-not-found");
  const channelId = str(first, "id");
  const snippet = obj(first["snippet"]);
  const statistics = obj(first["statistics"]);
  const contentDetails = obj(first["contentDetails"]);
  const related = obj(contentDetails?.["relatedPlaylists"]);
  const title = str(snippet, "title");
  if (channelId === null || title === null) return fail("malformed", "channel-identity-missing");
  const hidden = statistics?.["hiddenSubscriberCount"] === true;
  return {
    ok: true,
    value: {
      channel: Object.freeze({
        channelId,
        title,
        handle: str(snippet, "customUrl"),
        publishedAt: str(snippet, "publishedAt"),
        viewCount: count(statistics, "viewCount"),
        subscriberCount: hidden ? null : count(statistics, "subscriberCount"),
        hiddenSubscriberCount: hidden,
        videoCount: count(statistics, "videoCount"),
      }),
      uploadsPlaylistId: str(related, "uploads"),
    },
  };
}

export interface UploadsPage {
  readonly videoIds: readonly string[];
  readonly totalReportedByProvider: number | null;
}

/** playlistItems.list on the uploads playlist — 1 unit, one page, at most MAX_RECENT_VIDEOS. */
export async function listUploadsPage(
  apiKey: string,
  playlistId: string,
  deps: YouTubeTransportDeps = {},
): Promise<YouTubeResult<UploadsPage>> {
  const result = await call(
    "playlistItems.list",
    { part: "contentDetails", playlistId, maxResults: String(MAX_RECENT_VIDEOS) },
    apiKey,
    deps,
  );
  if (!result.ok) return result;
  const list = items(result.value);
  if (list === null) return fail("malformed", "playlist-items-missing");
  const videoIds = list
    .map((item) => str(obj(item["contentDetails"]), "videoId"))
    .filter((id): id is string => id !== null);
  const pageInfo = obj((result.value as Record<string, unknown>)["pageInfo"]);
  return {
    ok: true,
    value: { videoIds, totalReportedByProvider: count(pageInfo, "totalResults") },
  };
}

/** videos.list for up to MAX_RECENT_VIDEOS ids — 1 unit. Order follows the ids given. */
export async function listVideos(
  apiKey: string,
  videoIds: readonly string[],
  deps: YouTubeTransportDeps = {},
): Promise<YouTubeResult<readonly YouTubeVideoView[]>> {
  if (videoIds.length === 0) return { ok: true, value: [] };
  const result = await call(
    "videos.list",
    { part: "snippet,statistics", id: videoIds.slice(0, MAX_RECENT_VIDEOS).join(",") },
    apiKey,
    deps,
  );
  if (!result.ok) return result;
  const list = items(result.value);
  if (list === null) return fail("malformed", "videos-items-missing");
  const byId = new Map<string, YouTubeVideoView>();
  for (const item of list) {
    const videoId = str(item, "id");
    const snippet = obj(item["snippet"]);
    const statistics = obj(item["statistics"]);
    const title = str(snippet, "title");
    if (videoId === null || title === null) continue;
    byId.set(
      videoId,
      Object.freeze({
        videoId,
        title,
        publishedAt: str(snippet, "publishedAt"),
        viewCount: count(statistics, "viewCount"),
        likeCount: count(statistics, "likeCount"),
        commentCount: count(statistics, "commentCount"),
      }),
    );
  }
  return {
    ok: true,
    value: videoIds.map((id) => byId.get(id)).filter((v): v is YouTubeVideoView => v !== undefined),
  };
}
