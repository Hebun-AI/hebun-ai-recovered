/*
 * tests/youtube-write-2/contract-and-transport.ts — YOUTUBE-WRITE-2: the payload contract, the Google
 * capability, and the resumable upload transport against a FAKE fetch. No real Google call.
 */
import assert from "node:assert/strict";
import {
  GOOGLE_CAPABILITY_CONNECTION,
  GOOGLE_DRIVE_FILE_CAPABILITY,
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_PROVIDER_KEY,
  GOOGLE_REQUESTED_SCOPES,
  GOOGLE_YOUTUBE_PROVIDER_KEY,
  GOOGLE_YOUTUBE_READONLY_SCOPE,
  GOOGLE_YOUTUBE_UPLOAD_SCOPE,
  GOOGLE_YOUTUBE_VIDEO_UPLOAD_CAPABILITY,
  composeGoogleAuthorizationScopes,
} from "../../src/features/provider-google/contracts";
import { findProviderDefinition } from "../../src/features/provider-catalog/catalog";
import { getCapabilityAvailability } from "../../src/features/integration-authority/capability-availability.server";
import {
  asPublishYouTubeVideoPayload,
  youtubeMetadataIssues,
  type PublishYouTubeVideoPayload,
} from "../../src/features/youtube-publishing/contracts";
import {
  openYouTubeUploadSession,
  readYouTubeVideo,
  sendYouTubeUploadBytes,
  type YouTubeUploadInput,
} from "../../src/features/provider-google/google-transport.server";
import type { IntegrationView } from "../../src/features/integration-authority/contracts";
import { connectedFixture, GOOGLE_IDENTITY_SCOPES } from "../helpers/integration-connection-fixtures";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

const TOKEN = "FAKE-YT-TOKEN-never-real";
const SESSION = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=abc123";
const TENANT = { tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } as never;

function dbFor(connections: readonly IntegrationView[]) {
  return () =>
    ({
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () =>
                connections.map((c) => ({
                  id: c.integrationId, name: c.name, providerKey: c.providerKey, connectionState: c.connectionState,
                  health: c.health, scopes: c.scopes, externalAccountId: c.externalAccountId, externalAccountLabel: c.externalAccountLabel,
                  lastVerifiedAt: null, lastSuccessAt: null, lastErrorAt: null, failureReason: null, revokedAt: null, createdAt: new Date(c.createdAt),
                })),
            }),
          }),
        }),
      }),
    }) as never;
}

const input: YouTubeUploadInput = {
  bytes: new Uint8Array(Array.from({ length: 1000 }, (_, i) => i % 251)),
  mimeType: "video/mp4",
  title: "Kilim",
  description: "A rug.",
  categoryId: "22",
  privacyStatus: "private",
  selfDeclaredMadeForKids: false,
  containsSyntheticMedia: true,
};

type Call = { url: string; method: string; headers: Record<string, string>; bodyLength: number; body: string | null };
function fakeFetch(responder: (call: Call, index: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const impl = async (url: string, init?: RequestInit) => {
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
    const raw = init?.body;
    const call: Call = {
      url,
      method: init?.method ?? "GET",
      headers,
      bodyLength: raw instanceof Uint8Array ? raw.byteLength : typeof raw === "string" ? raw.length : 0,
      body: typeof raw === "string" ? raw : null,
    };
    calls.push(call);
    return responder(call, calls.length - 1);
  };
  return { impl, calls };
}
const video = (id = "dQw4w9WgXcQ") =>
  new Response(JSON.stringify({ kind: "youtube#video", id, status: { uploadStatus: "uploaded", privacyStatus: "private" } }), { status: 201 });
const noSleep = async () => {};

async function main(): Promise<void> {
  /* ── 1. CAPABILITY: google-youtube only; read = the channel check, write = youtube.upload ── */
  assert.equal(GOOGLE_CAPABILITY_CONNECTION[GOOGLE_YOUTUBE_VIDEO_UPLOAD_CAPABILITY], GOOGLE_YOUTUBE_PROVIDER_KEY);
  const yt = findProviderDefinition(GOOGLE_YOUTUBE_PROVIDER_KEY)!.capabilityScopes[GOOGLE_YOUTUBE_VIDEO_UPLOAD_CAPABILITY]!;
  assert.deepEqual([...yt.read], [GOOGLE_YOUTUBE_READONLY_SCOPE]);
  assert.deepEqual([...yt.write], [GOOGLE_YOUTUBE_UPLOAD_SCOPE]);
  assert.equal(Object.hasOwn(findProviderDefinition(GOOGLE_PROVIDER_KEY)!.capabilityScopes, GOOGLE_YOUTUBE_VIDEO_UPLOAD_CAPABILITY), false);
  assert.equal(GOOGLE_YOUTUBE_UPLOAD_SCOPE, "https://www.googleapis.com/auth/youtube.upload", "the narrowest scope videos.insert accepts");

  /* ── 2. CONSENT: same family only, readonly kept, never Drive, never a wider YouTube scope ── */
  const upgrade = composeGoogleAuthorizationScopes(GOOGLE_YOUTUBE_VIDEO_UPLOAD_CAPABILITY, [...GOOGLE_IDENTITY_SCOPES, GOOGLE_YOUTUBE_READONLY_SCOPE]);
  assert.deepEqual([...upgrade].sort(), [...GOOGLE_REQUESTED_SCOPES, GOOGLE_YOUTUBE_READONLY_SCOPE, GOOGLE_YOUTUBE_UPLOAD_SCOPE].sort());
  for (const forbidden of [GOOGLE_DRIVE_FILE_SCOPE, "https://www.googleapis.com/auth/youtube", "https://www.googleapis.com/auth/youtube.force-ssl", "https://www.googleapis.com/auth/youtubepartner"]) {
    assert.equal(upgrade.includes(forbidden), false, `${forbidden} is never requested`);
  }
  const driveAfterUpload = composeGoogleAuthorizationScopes(GOOGLE_DRIVE_FILE_CAPABILITY, [...GOOGLE_IDENTITY_SCOPES, GOOGLE_YOUTUBE_READONLY_SCOPE, GOOGLE_YOUTUBE_UPLOAD_SCOPE]);
  assert.equal(driveAfterUpload.includes(GOOGLE_YOUTUBE_UPLOAD_SCOPE), false, "a Drive consent never carries the upload scope");

  /* ── 3. AVAILABILITY: readonly alone is NOT write-capable; both scopes → writeCapable ── */
  const stateOf = async (scopes: readonly string[]) => {
    const view = await getCapabilityAvailability(TENANT, { getDb: dbFor([connectedFixture({ providerKey: GOOGLE_YOUTUBE_PROVIDER_KEY, scopes })]) });
    return view.capabilities.find((c) => c.capability === GOOGLE_YOUTUBE_VIDEO_UPLOAD_CAPABILITY)!;
  };
  const readOnly = await stateOf([...GOOGLE_IDENTITY_SCOPES, GOOGLE_YOUTUBE_READONLY_SCOPE]);
  assert.equal(readOnly.sources[0]!.writeCapable, false, "definition ≠ grant: without youtube.upload nothing can upload");
  const granted = await stateOf([...GOOGLE_IDENTITY_SCOPES, GOOGLE_YOUTUBE_READONLY_SCOPE, GOOGLE_YOUTUBE_UPLOAD_SCOPE]);
  assert.equal(granted.state, "available");
  assert.equal(granted.sources[0]!.writeCapable, true);
  const onWorkspace = await getCapabilityAvailability(TENANT, {
    getDb: dbFor([connectedFixture({ scopes: [...GOOGLE_IDENTITY_SCOPES, GOOGLE_YOUTUBE_READONLY_SCOPE, GOOGLE_YOUTUBE_UPLOAD_SCOPE] })]),
  });
  const viaWorkspace = onWorkspace.capabilities.find((c) => c.capability === GOOGLE_YOUTUBE_VIDEO_UPLOAD_CAPABILITY)!;
  assert.equal(viaWorkspace.sources.some((s) => s.writeCapable), false, "never through google-workspace");

  /* ── 4. METADATA: provider limits refused, never truncated ── */
  assert.deepEqual(youtubeMetadataIssues("A".repeat(100), "ok"), []);
  assert.deepEqual(youtubeMetadataIssues("A".repeat(101), "ok"), ["title-too-long"]);
  assert.deepEqual(youtubeMetadataIssues("Ş".repeat(100), "ok"), [], "characters, not bytes, for the title");
  assert.ok(youtubeMetadataIssues("a<b", "ok").includes("title-forbidden-character"));
  assert.ok(youtubeMetadataIssues("ok", "x>y").includes("description-forbidden-character"));
  assert.deepEqual(youtubeMetadataIssues("ok", "a".repeat(5000)), []);
  assert.ok(youtubeMetadataIssues("ok", "ş".repeat(2501)).includes("description-too-long"), "bytes, not characters, for the description");
  assert.ok(youtubeMetadataIssues(" ", "ok").includes("title-empty"));

  /* ── 5. PAYLOAD: exact keys and types, nothing coerced ── */
  const good: PublishYouTubeVideoPayload = {
    integrationId: "11111111-1111-4111-8111-111111111111",
    externalAccountId: "117622225072141590877",
    expectedChannelId: "UC5Yf5U_YOKR0K38tWF82kjA",
    channelTitle: "Turkish Rug House",
    draftRef: "work-artifact/22222222-2222-4222-8222-222222222222@3",
    draftRevisionDigest: "a".repeat(64),
    videoAssetRef: "33333333-3333-4333-8333-333333333333",
    videoAssetDigest: "b".repeat(64),
    title: "Kilim",
    description: "A rug.",
    privacyStatus: "private",
    categoryId: "22",
    selfDeclaredMadeForKids: false,
    containsSyntheticMedia: true,
  };
  assert.deepEqual(asPublishYouTubeVideoPayload(good), good);
  for (const [k, v] of Object.entries({
    expectedChannelId: "UCshort",
    privacyStatus: "friends",
    categoryId: "cat",
    selfDeclaredMadeForKids: "no",
    containsSyntheticMedia: 1,
    title: "x".repeat(101),
    videoAssetDigest: "B".repeat(64),
  })) {
    assert.equal(asPublishYouTubeVideoPayload({ ...good, [k]: v }), null, `${k} must be exact`);
  }
  assert.equal(asPublishYouTubeVideoPayload({ ...good, extra: "x" }), null, "no extra key");
  const missing: Record<string, unknown> = { ...good };
  delete missing.title;
  assert.equal(asPublishYouTubeVideoPayload(missing), null, "no missing key");

  /* ── 6. SESSION: the documented request, only to Google's upload host ── */
  {
    const f = fakeFetch(() => new Response(null, { status: 200, headers: { location: SESSION } }));
    const s = await openYouTubeUploadSession(input, TOKEN, { fetchImpl: f.impl });
    assert.deepEqual(s, { ok: true, sessionUri: SESSION });
    const c = f.calls[0]!;
    assert.equal(c.method, "POST");
    const u = new URL(c.url);
    assert.equal(`${u.origin}${u.pathname}`, "https://www.googleapis.com/upload/youtube/v3/videos");
    assert.equal(u.searchParams.get("uploadType"), "resumable");
    assert.equal(u.searchParams.get("part"), "snippet,status");
    assert.equal(c.headers["x-upload-content-length"], "1000");
    assert.equal(c.headers["x-upload-content-type"], "video/mp4");
    assert.deepEqual(JSON.parse(c.body!), {
      snippet: { title: "Kilim", description: "A rug.", categoryId: "22" },
      status: { privacyStatus: "private", selfDeclaredMadeForKids: false, containsSyntheticMedia: true },
    });
  }
  for (const [location, label] of [
    ["https://evil.example/upload/youtube/v3/videos?upload_id=x", "foreign host"],
    ["http://www.googleapis.com/upload/youtube/v3/videos?upload_id=x", "not https"],
    ["https://www.googleapis.com/upload/youtube/v3/videos", "no upload_id"],
    [null, "absent"],
  ] as const) {
    const f = fakeFetch(() => new Response(null, { status: 200, headers: location ? { location } : {} }));
    const s = await openYouTubeUploadSession(input, TOKEN, { fetchImpl: f.impl });
    assert.equal(s.ok, false, `session URI refused: ${label}`);
  }
  {
    const auth = await openYouTubeUploadSession(input, TOKEN, { fetchImpl: fakeFetch(() => new Response(null, { status: 401 })).impl });
    assert.equal(!auth.ok && auth.failure, "auth", "401 before any byte → refresh-safe auth failure");
    const scope = await openYouTubeUploadSession(input, TOKEN, {
      fetchImpl: fakeFetch(() => new Response(JSON.stringify({ error: { errors: [{ reason: "insufficientPermissions" }] } }), { status: 403 })).impl,
    });
    assert.equal(!scope.ok && scope.failure, "scope");
    const down = await openYouTubeUploadSession(input, TOKEN, { fetchImpl: fakeFetch(() => new Response(null, { status: 503 })).impl });
    assert.equal(!down.ok && down.failure, "transport");
    const refused = await openYouTubeUploadSession(input, TOKEN, { fetchImpl: fakeFetch(() => new Response(null, { status: 400 })).impl });
    assert.equal(!refused.ok && refused.failure, "rejected");
    const lost = await openYouTubeUploadSession(input, TOKEN, { fetchImpl: async () => { throw new Error("ECONNRESET"); } });
    assert.equal(!lost.ok && lost.failure, "transport");
  }

  /* ── 7. BYTES: accepted only with a video id; never a second session ── */
  {
    const f = fakeFetch(() => video());
    const o = await sendYouTubeUploadBytes(SESSION, input, TOKEN, { fetchImpl: f.impl, sleep: noSleep });
    assert.deepEqual(o, { class: "accepted", stage: "video-resource-created", videoId: "dQw4w9WgXcQ", uploadStatus: "uploaded", privacyStatus: "private" });
    assert.equal(f.calls[0]!.method, "PUT");
    assert.equal(f.calls[0]!.url, SESSION);
    assert.equal(f.calls[0]!.bodyLength, 1000);
  }
  {
    const noId = await sendYouTubeUploadBytes(SESSION, input, TOKEN, {
      fetchImpl: fakeFetch(() => new Response(JSON.stringify({ kind: "youtube#video" }), { status: 201 })).impl, sleep: noSleep,
    });
    assert.equal(noId.class, "ambiguous", "a 201 without an id is not a video — and not a failure either");
  }
  assert.equal((await sendYouTubeUploadBytes(SESSION, input, TOKEN, { fetchImpl: fakeFetch(() => new Response(null, { status: 400 })).impl, sleep: noSleep })).class, "rejected");
  assert.equal((await sendYouTubeUploadBytes(SESSION, input, TOKEN, { fetchImpl: fakeFetch(() => new Response(null, { status: 404 })).impl, sleep: noSleep })).class, "rejected", "a dead session on the first PUT holds no video");
  assert.equal((await sendYouTubeUploadBytes("https://evil.example/x?upload_id=1", input, TOKEN, { fetchImpl: fakeFetch(() => video()).impl })).class, "rejected");

  /* ── 8. RECOVERY: only through the documented status query ── */
  {
    /* lost answer → status query says it finished */
    const f = fakeFetch((_c, i) => (i === 0 ? Promise.reject(new Error("timeout")) : video("finished123")));
    const o = await sendYouTubeUploadBytes(SESSION, input, TOKEN, { fetchImpl: f.impl, sleep: noSleep });
    assert.equal(o.class === "accepted" && o.videoId, "finished123");
    assert.equal(f.calls[1]!.headers["content-range"], "bytes */1000");
    assert.equal(f.calls[1]!.url, SESSION);
  }
  {
    /* 503 → 308 Range 0-599 → resume the rest → 201 */
    const f = fakeFetch((_c, i) =>
      i === 0 ? new Response(null, { status: 503 }) : i === 1 ? new Response(null, { status: 308, headers: { range: "bytes=0-599" } }) : video("resumed1234"),
    );
    const o = await sendYouTubeUploadBytes(SESSION, input, TOKEN, { fetchImpl: f.impl, sleep: noSleep });
    assert.equal(o.class === "accepted" && o.videoId, "resumed1234");
    assert.equal(f.calls[2]!.headers["content-range"], "bytes 600-999/1000");
    assert.equal(f.calls[2]!.bodyLength, 400, "only the missing bytes are resent");
  }
  {
    /* answers keep getting lost → ambiguous, bounded */
    const f = fakeFetch(() => Promise.reject(new Error("reset")));
    const o = await sendYouTubeUploadBytes(SESSION, input, TOKEN, { fetchImpl: f.impl, sleep: noSleep });
    assert.equal(o.class, "ambiguous");
    assert.ok(f.calls.length <= 4, "a small fixed number of documented queries");
  }
  {
    /* interrupted, then the session expired → may exist → ambiguous (never rejected) */
    const f = fakeFetch((_c, i) => (i === 0 ? Promise.reject(new Error("reset")) : new Response(null, { status: 404 })));
    assert.equal((await sendYouTubeUploadBytes(SESSION, input, TOKEN, { fetchImpl: f.impl, sleep: noSleep })).class, "ambiguous");
  }
  {
    /* no path in the transport ever POSTs a new session */
    const f = fakeFetch((_c, i) => (i % 2 === 0 ? Promise.reject(new Error("reset")) : new Response(null, { status: 308 })));
    await sendYouTubeUploadBytes(SESSION, input, TOKEN, { fetchImpl: f.impl, sleep: noSleep });
    assert.equal(f.calls.some((c) => c.method === "POST"), false, "recovery never opens a second session");
    assert.ok(f.calls.every((c) => c.url === SESSION));
  }

  /* ── 9. READ-BACK: processing, privacy and channel as YouTube reports them ── */
  {
    const f = fakeFetch(() =>
      new Response(JSON.stringify({ items: [{ id: "dQw4w9WgXcQ", snippet: { channelId: "UC5Yf5U_YOKR0K38tWF82kjA" }, status: { uploadStatus: "processed", privacyStatus: "private" }, processingDetails: { processingStatus: "succeeded" } }] }), { status: 200 }),
    );
    const r = await readYouTubeVideo("dQw4w9WgXcQ", TOKEN, { fetchImpl: f.impl });
    assert.deepEqual(r, {
      ok: true, found: true, videoId: "dQw4w9WgXcQ", channelId: "UC5Yf5U_YOKR0K38tWF82kjA", uploadStatus: "processed",
      failureReason: null, rejectionReason: null, privacyStatus: "private", processingStatus: "succeeded",
    });
    assert.equal(f.calls[0]!.method, "GET");
    assert.deepEqual(await readYouTubeVideo("dQw4w9WgXcQ", TOKEN, { fetchImpl: fakeFetch(() => new Response(JSON.stringify({ items: [] }), { status: 200 })).impl }), { ok: true, found: false });
  }

  /* ── 10. NO TOKEN IN ANY OUTCOME ── */
  const outcomes = JSON.stringify([
    await openYouTubeUploadSession(input, TOKEN, { fetchImpl: fakeFetch(() => new Response(null, { status: 400 })).impl }),
    await sendYouTubeUploadBytes(SESSION, input, TOKEN, { fetchImpl: fakeFetch(() => Promise.reject(new Error(TOKEN))).impl, sleep: noSleep }),
  ]);
  assert.equal(outcomes.includes(TOKEN), false, "no outcome carries the token");
  assert.equal(outcomes.includes("upload_id"), false, "no outcome carries the session URI");

  console.log("PASS youtube-write-2 contract + transport");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
