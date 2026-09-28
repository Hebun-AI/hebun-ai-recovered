/*
 * tests/youtube-write-1/channel-identity.ts — YOUTUBE-WRITE-1: `google.youtube.channel.identity.read`.
 *
 * Cases A–P. No real Google or YouTube call: the availability seam runs against a listing stand-in,
 * the credential spend is a test seam, and every provider response is a fake `fetch`.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY,
  GOOGLE_YOUTUBE_READONLY_SCOPE,
  GOOGLE_YOUTUBE_CHANNELS_ENDPOINT,
  GOOGLE_REQUESTED_SCOPES,
  extraScopesForCapability,
} from "../../src/features/provider-google/contracts";
import { listAuthenticatedYouTubeChannels } from "../../src/features/provider-google/google-transport.server";
import {
  readAuthenticatedYouTubeChannels,
  type YouTubeChannelIdentityDeps,
} from "../../src/features/provider-google/read-youtube-channel-identity.server";
import { findProviderDefinition } from "../../src/features/provider-catalog/catalog";
import { YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY, YOUTUBE_PROVIDER_KEY } from "../../src/features/provider-youtube/contracts";
import type { IntegrationView } from "../../src/features/integration-authority/contracts";
import { connectedFixture, GOOGLE_IDENTITY_SCOPES } from "../helpers/integration-connection-fixtures";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const READER = "src/features/provider-google/read-youtube-channel-identity.server.ts";
const TRANSPORT = "src/features/provider-google/google-transport.server.ts";
const ACTION = "src/app/(dashboard)/integrations/google/actions.ts";
const COMPONENT = "src/app/(dashboard)/integrations/google/youtube-channel-identity.tsx";
const TOKEN = "TEST-ACCESS-TOKEN-SECRET";

const TENANT = { tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } as never;

/** A listing stand-in for the database, so the real availability seam decides. */
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
                  lastVerifiedAt: c.lastVerifiedAt ? new Date(c.lastVerifiedAt) : null, lastSuccessAt: c.lastSuccessAt ? new Date(c.lastSuccessAt) : null,
                  lastErrorAt: c.lastErrorAt ? new Date(c.lastErrorAt) : null, failureReason: c.failureReason,
                  revokedAt: c.revokedAt ? new Date(c.revokedAt) : null, createdAt: new Date(c.createdAt),
                })),
            }),
          }),
        }),
      }),
    }) as never;
}

/* GOOGLE-CAPABILITY-SCOPE-REPAIR-1: the grant lives on the YouTube Google connection. */
const granted = () => connectedFixture({ providerKey: "google-youtube", scopes: [...GOOGLE_IDENTITY_SCOPES, GOOGLE_YOUTUBE_READONLY_SCOPE] });
const identityOnly = () => connectedFixture({ providerKey: "google-youtube", scopes: [...GOOGLE_IDENTITY_SCOPES] });

function harness(connections: readonly IntegrationView[], respond: () => Promise<Response>) {
  const requests: { url: string; init?: RequestInit }[] = [];
  let spends = 0;
  const deps: YouTubeChannelIdentityDeps = {
    getDb: dbFor(connections),
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return respond();
    },
    withToken: (async (_tenant: unknown, _integrationId: string, spend: (t: string) => Promise<unknown>) => {
      spends += 1;
      return spend(TOKEN);
    }) as never,
  };
  return { deps, requests, spends: () => spends };
}

const json = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function main(): Promise<void> {
  /*
   * A · the capability belongs to the existing Google authority — since GOOGLE-CAPABILITY-SCOPE-REPAIR-1
   * on its `google-youtube` definition, never on `google-workspace` — and not to the API-key provider
   */
  const google = findProviderDefinition("google-youtube")!;
  const youtube = findProviderDefinition(YOUTUBE_PROVIDER_KEY)!;
  assert.ok(Object.hasOwn(google.capabilityScopes, GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY));
  assert.equal(Object.hasOwn(findProviderDefinition("google-workspace")!.capabilityScopes, GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY), false);
  assert.equal(Object.hasOwn(youtube.capabilityScopes, GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY), false);
  assert.equal(google.authMethod, "oauth2");

  /* B · only the minimum read scope; D · no write scope */
  const scopes = google.capabilityScopes[GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY]!;
  assert.deepEqual([...scopes.read], ["https://www.googleapis.com/auth/youtube.readonly"]);
  assert.deepEqual([...scopes.write], [], "no write half");
  assert.equal(GOOGLE_REQUESTED_SCOPES.includes(GOOGLE_YOUTUBE_READONLY_SCOPE), false, "connecting Google still asks for identity only");

  /* C · the upgrade is closed: a capability resolves to its own scope, a scope or junk resolves to nothing */
  assert.deepEqual([...extraScopesForCapability(GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY)!], [GOOGLE_YOUTUBE_READONLY_SCOPE]);
  for (const junk of [GOOGLE_YOUTUBE_READONLY_SCOPE, "https://www.googleapis.com/auth/youtube.upload", "google.youtube.video.upload", "__proto__", "constructor"]) {
    assert.equal(extraScopesForCapability(junk), null, `${junk} is not a capability`);
  }

  /* D / M · no upload scope and no upload path anywhere in src */
  const walk = (dir: string): string[] =>
    readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : [],
    );
  for (const f of walk("src")) {
    const c = codeOnly(read(f));
    for (const banned of ["auth/youtube.upload", "auth/youtube.force-ssl", "auth/youtubepartner", "upload/youtube", "videos.insert", "uploadType=resumable"]) {
      assert.equal(c.includes(banned), false, `${f} must not contain ${banned}`);
    }
    assert.equal(/["']https:\/\/www\.googleapis\.com\/auth\/youtube["']/.test(c), false, `${f} must not request the full youtube scope`);
  }

  /* E · no trusted tenant → refused, nothing read */
  {
    const h = harness([granted()], json({ items: [] }));
    for (const t of [null, { tenantId: "x" }]) {
      const r = await readAuthenticatedYouTubeChannels(t as never, h.deps);
      assert.equal(r.status, "refused");
      if (r.status === "refused") assert.equal(r.reason, "no-authorized-tenant-context");
    }
    assert.equal(h.requests.length, 0);
    assert.equal(h.spends(), 0);
  }

  /* F · capability unavailable → neither the credential nor the provider is touched */
  for (const connections of [[identityOnly()], [], [connectedFixture({ scopes: [...GOOGLE_IDENTITY_SCOPES, GOOGLE_YOUTUBE_READONLY_SCOPE], connectionState: "disconnected" } as never)]]) {
    const h = harness(connections, json({ items: [] }));
    const r = await readAuthenticatedYouTubeChannels(TENANT, h.deps);
    assert.equal(r.status, "refused");
    if (r.status === "refused") assert.equal(r.reason, "capability-not-available");
    assert.equal(h.requests.length, 0, "no provider call");
    assert.equal(h.spends(), 0, "no credential spend");
  }

  /* G · zero channels (YouTube omits `items`) */
  {
    const h = harness([granted()], json({}));
    assert.deepEqual(await readAuthenticatedYouTubeChannels(TENANT, h.deps), { status: "no-channel" });
    const h2 = harness([granted()], json({ items: [] }));
    assert.deepEqual(await readAuthenticatedYouTubeChannels(TENANT, h2.deps), { status: "no-channel" });
  }

  /* H · exactly one channel, and the request is exactly the read this phase needs */
  {
    const h = harness([granted()], json({ items: [{ id: "UCone", snippet: { title: "Turkish Rug House", description: "SHOULD-NOT-SURVIVE" }, statistics: { subscriberCount: "9" } }] }));
    const r = await readAuthenticatedYouTubeChannels(TENANT, h.deps);
    assert.deepEqual(r, { status: "one-channel", channel: { channelId: "UCone", title: "Turkish Rug House" } });
    assert.equal(h.requests.length, 1);
    const url = new URL(h.requests[0]!.url);
    assert.equal(`${url.origin}${url.pathname}`, GOOGLE_YOUTUBE_CHANNELS_ENDPOINT);
    assert.deepEqual(Object.fromEntries(url.searchParams), { part: "snippet", mine: "true", maxResults: "50", fields: "nextPageToken,items(id,snippet/title)" });
    assert.equal(h.requests[0]!.init?.method, "GET");
    assert.equal(h.requests[0]!.init?.body, undefined, "no body");
    assert.equal(url.toString().includes(TOKEN), false, "the token is never in the URL");
  }

  /* I / J · several channels: all returned, in YouTube's order, none chosen */
  {
    const items = [{ id: "UCb", snippet: { title: "Brand B" } }, { id: "UCa", snippet: { title: "Brand A" } }];
    const h = harness([granted()], json({ items }));
    const r = await readAuthenticatedYouTubeChannels(TENANT, h.deps);
    assert.deepEqual(r, { status: "multiple-channels", channels: [{ channelId: "UCb", title: "Brand B" }, { channelId: "UCa", title: "Brand A" }], truncated: false });
    assert.equal("channel" in r, false, "no single channel is picked");
    const more = harness([granted()], json({ items: [items[0]], nextPageToken: "NEXT" }));
    const t = await readAuthenticatedYouTubeChannels(TENANT, more.deps);
    assert.equal(t.status, "multiple-channels", "one channel plus a further page is not 'exactly one'");
    if (t.status === "multiple-channels") assert.equal(t.truncated, true);
    assert.doesNotMatch(codeOnly(read(COMPONENT)), /select|primary|save|bind|upload|publish/i, "the UI chooses nothing");
  }

  /* K · the token stays server-side */
  {
    const h = harness([granted()], json({ items: [{ id: "UCone", snippet: { title: "T" } }] }));
    const r = await readAuthenticatedYouTubeChannels(TENANT, h.deps);
    assert.equal(JSON.stringify(r).includes(TOKEN), false);
    assert.equal((h.requests[0]!.init?.headers as Record<string, string>).authorization, `Bearer ${TOKEN}`, "only in the Authorization header");
    for (const f of [ACTION, COMPONENT, READER]) {
      const c = codeOnly(read(f));
      assert.doesNotMatch(c, /console\.|refreshToken|credentialId|withDecryptedSecret|vault/, `${f} holds no credential material and logs nothing`);
    }
    assert.match(codeOnly(read(ACTION)), /export async function readYouTubeChannelIdentityAction\(\): Promise<YouTubeChannelIdentityResult> \{\n\s*return readAuthenticatedYouTubeChannels\(await resolveTenantContext\(\)\);/, "no-input action; session tenant only");
    const fn = codeOnly(read(TRANSPORT));
    const body = fn.slice(fn.indexOf("export async function listAuthenticatedYouTubeChannels"), fn.indexOf("export async function readDriveFileImage"));
    assert.doesNotMatch(body, /console\./);
  }

  /* L · the API-key public read is untouched and separate */
  assert.equal(youtube.authMethod, "api_key");
  assert.deepEqual(Object.keys(youtube.capabilityScopes), [YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY]);
  for (const f of walk("src/features/provider-youtube")) {
    assert.doesNotMatch(read(f), /channel\.identity|youtube\.readonly|provider-google\/read-youtube/, `${f} does not reach the OAuth identity read`);
  }

  /* N · no DB mutation in the reader or the transport read */
  for (const c of [codeOnly(read(READER)), codeOnly(read(TRANSPORT)).slice(codeOnly(read(TRANSPORT)).indexOf("export async function listAuthenticatedYouTubeChannels"), codeOnly(read(TRANSPORT)).indexOf("export async function readDriveFileImage"))]) {
    for (const banned of [".insert(", ".update(", ".delete(", "transaction(", "drizzle", "recordVerified", "replaceCredential"]) {
      assert.equal(c.includes(banned), false, `no ${banned}`);
    }
  }

  /* O · no schema, no migration */
  assert.equal(readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql")).length, 67, "ledger stays 67");
  for (const f of walk("src/db/schema")) assert.doesNotMatch(read(f), /youtube_channel|channel_binding|publish_channel/i);

  /* P · provider failure fails closed and is classified */
  const failures: [() => Promise<Response>, string, string][] = [
    [json({ error: { code: 503 } }, 503), "transport", "google-unavailable"],
    [json({ error: { code: 403, errors: [{ reason: "insufficientPermissions" }] } }, 403), "scope", "google-insufficient-scope"],
    [json({ error: { code: 403, errors: [{ reason: "accessNotConfigured" }] } }, 403), "disabled", "google-api-not-enabled"],
    [json({ items: [{ snippet: { title: "no id" } }] }), "malformed", "google-channel-item-unparseable"],
    [json({ items: "nope" }), "malformed", "google-response-missing-items"],
    [async () => { throw new Error("network"); }, "transport", "google-unreachable"],
  ];
  for (const [respond, failure, reason] of failures) {
    const h = harness([granted()], respond);
    const r = await readAuthenticatedYouTubeChannels(TENANT, h.deps);
    assert.deepEqual(r, { status: "provider-failed", failure, reason });
  }
  const direct = await listAuthenticatedYouTubeChannels(TOKEN, { fetchImpl: json({ error: {} }, 401) });
  assert.equal(direct.ok, false);
  if (!direct.ok) assert.equal(direct.failure, "auth");

  console.log("youtube-write-1/channel-identity: OK");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
