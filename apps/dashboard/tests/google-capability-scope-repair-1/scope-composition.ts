/*
 * tests/google-capability-scope-repair-1/scope-composition.ts — GOOGLE-CAPABILITY-SCOPE-REPAIR-1.
 *
 * Two production facts drive this file:
 *   1. identity + drive.file, then a YouTube upgrade on the same connection, recorded
 *      identity + youtube.readonly — Drive went to a scope gap (TRH, 2026-09-28).
 *   2. composing both families into one request (`bda53bc9`) was refused by Google before consent:
 *      400 invalid_request, "scopes that cannot be requested together" (reason undocumented).
 *
 * So each family has its own connection (`google-workspace` for Drive, `google-youtube` for
 * YouTube) under the same authorities, composition happens only within a family, and no request can
 * ever carry `drive.file` together with `youtube.readonly`.
 *
 * No real Google call and no database: composition is pure, availability runs against a listing
 * stand-in, and the route/callback are read as source where their wiring is the fact.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import {
  GOOGLE_CAPABILITY_CONNECTION,
  GOOGLE_CAPABILITY_SCOPE_REQUESTS,
  GOOGLE_DRIVE_CONTENT_CAPABILITY,
  GOOGLE_DRIVE_CONTENT_SCOPE,
  GOOGLE_DRIVE_FILE_CAPABILITY,
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_DRIVE_METADATA_CAPABILITY,
  GOOGLE_DRIVE_METADATA_SCOPE,
  GOOGLE_OAUTH_PROVIDER_KEYS,
  GOOGLE_PROVIDER_KEY,
  GOOGLE_REQUESTED_SCOPES,
  GOOGLE_RETAINABLE_SCOPES_BY_CONNECTION,
  GOOGLE_UPGRADEABLE_CAPABILITIES,
  GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY,
  GOOGLE_YOUTUBE_PROVIDER_KEY,
  GOOGLE_YOUTUBE_READONLY_SCOPE,
  composeGoogleAuthorizationScopes,
  googleConnectionForCapability,
} from "../../src/features/provider-google/contracts";
import { getCapabilityAvailability } from "../../src/features/integration-authority/capability-availability.server";
import { findProviderDefinition } from "../../src/features/provider-catalog/catalog";
import type { IntegrationView } from "../../src/features/integration-authority/contracts";
import { connectedFixture, GOOGLE_IDENTITY_SCOPES } from "../helpers/integration-connection-fixtures";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const START = "src/app/api/integrations/google/start/route.ts";
const CALLBACK = "src/app/api/integrations/google/callback/route.ts";
const CONTRACTS = "src/features/provider-google/contracts.ts";
const READER = "src/features/provider-google/read-youtube-channel-identity.server.ts";

const TENANT = { tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } as never;
const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const YOUTUBE_ID = "22222222-2222-4222-8222-222222222222";

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

const workspace = (scopes: readonly string[]) => connectedFixture({ integrationId: WORKSPACE_ID, providerKey: GOOGLE_PROVIDER_KEY, scopes });
const youtubeConn = (scopes: readonly string[]) => connectedFixture({ integrationId: YOUTUBE_ID, providerKey: GOOGLE_YOUTUBE_PROVIDER_KEY, scopes });

async function availability(connections: readonly IntegrationView[], capability: string) {
  const view = await getCapabilityAvailability(TENANT, { getDb: dbFor(connections) });
  return view.capabilities.find((c) => c.capability === capability)!;
}

const IDENTITY = [...GOOGLE_REQUESTED_SCOPES];
const sorted = (xs: readonly string[]) => [...xs].sort();
const bothFamilies = (req: readonly string[]) => req.includes(GOOGLE_DRIVE_FILE_SCOPE) && req.includes(GOOGLE_YOUTUBE_READONLY_SCOPE);

async function main(): Promise<void> {
  const startCode = codeOnly(read(START));
  const callbackCode = codeOnly(read(CALLBACK));

  /* 1 · routing: Drive capabilities → google-workspace, YouTube → google-youtube, nothing → workspace */
  {
    for (const cap of [GOOGLE_DRIVE_METADATA_CAPABILITY, GOOGLE_DRIVE_CONTENT_CAPABILITY, GOOGLE_DRIVE_FILE_CAPABILITY]) {
      assert.equal(googleConnectionForCapability(cap), GOOGLE_PROVIDER_KEY, `${cap} routes to google-workspace`);
    }
    assert.equal(googleConnectionForCapability(GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY), GOOGLE_YOUTUBE_PROVIDER_KEY);
    for (const junk of [null, "", "__proto__", "constructor", GOOGLE_YOUTUBE_READONLY_SCOPE, "google.youtube.video.delete"]) {
      assert.equal(googleConnectionForCapability(junk), GOOGLE_PROVIDER_KEY, `"${junk}" is the plain Workspace connect`);
    }
    assert.deepEqual(sorted(Object.keys(GOOGLE_CAPABILITY_CONNECTION)), sorted(GOOGLE_UPGRADEABLE_CAPABILITIES), "every upgradeable capability has exactly one connection");
    /* the catalog agrees: each capability is declared only on the connection the map names */
    for (const [cap, owner] of Object.entries(GOOGLE_CAPABILITY_CONNECTION)) {
      for (const key of GOOGLE_OAUTH_PROVIDER_KEYS) {
        assert.equal(Object.hasOwn(findProviderDefinition(key)!.capabilityScopes, cap), key === owner, `${cap} declared on ${key}? ${key === owner}`);
      }
    }
    assert.equal(findProviderDefinition(GOOGLE_YOUTUBE_PROVIDER_KEY)!.authMethod, "oauth2");
    assert.equal(findProviderDefinition(GOOGLE_YOUTUBE_PROVIDER_KEY)!.accountIdentity, "account");
  }

  /* 2 · the start route resolves the connection from the capability and composes from THAT connection only */
  {
    assert.ok(/const providerKey = googleConnectionForCapability\(requestedCapability\)/.test(startCode));
    assert.ok(/c\.providerKey === providerKey &&/.test(startCode), "the reused connection is of the resolved family");
    assert.ok(/createConnection\(\s*tenant,\s*\{\s*providerKey,/.test(startCode), "a created connection is of the resolved family");
    assert.ok(/composeGoogleAuthorizationScopes\(\s*requestedCapability\s*,\s*existing\?\.scopes\s*\?\?\s*\[\]\s*\)/.test(startCode));
    assert.ok(/authorize\.searchParams\.set\("scope",\s*scopes\.join\(" "\)\)/.test(startCode), "only the composed set reaches Google");
  }

  /* 3 · THE PRODUCTION REFUSAL: no reachable request carries drive.file AND youtube.readonly */
  {
    const everything = [...GOOGLE_IDENTITY_SCOPES, ...Object.values(GOOGLE_CAPABILITY_SCOPE_REQUESTS).flat()];
    for (const cap of [null, "junk", ...GOOGLE_UPGRADEABLE_CAPABILITIES]) {
      for (const observed of [[], GOOGLE_IDENTITY_SCOPES, everything]) {
        const req = composeGoogleAuthorizationScopes(cap, observed);
        assert.equal(bothFamilies(req), false, `${cap} over ${observed.length} observed scopes never mixes families`);
      }
    }
    const [driveFamily, youtubeFamily] = [GOOGLE_RETAINABLE_SCOPES_BY_CONNECTION[GOOGLE_PROVIDER_KEY], GOOGLE_RETAINABLE_SCOPES_BY_CONNECTION[GOOGLE_YOUTUBE_PROVIDER_KEY]];
    assert.equal(driveFamily.some((s) => youtubeFamily.includes(s)), false, "the families are disjoint");
  }

  /* 4 · YouTube consent never requests Drive; Drive consent never requests YouTube */
  {
    const legacyTRH = [...GOOGLE_IDENTITY_SCOPES, GOOGLE_YOUTUBE_READONLY_SCOPE]; // today's TRH workspace row
    const yt = composeGoogleAuthorizationScopes(GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY, [...GOOGLE_IDENTITY_SCOPES, GOOGLE_DRIVE_FILE_SCOPE]);
    assert.deepEqual(sorted(yt), sorted([...IDENTITY, GOOGLE_YOUTUBE_READONLY_SCOPE]));
    const drive = composeGoogleAuthorizationScopes(GOOGLE_DRIVE_FILE_CAPABILITY, legacyTRH);
    assert.deepEqual(sorted(drive), sorted([...IDENTITY, GOOGLE_DRIVE_FILE_SCOPE]), "the legacy youtube scope on the Workspace row is not carried");
    /* first-ever upgrades: identity + exactly one capability */
    assert.deepEqual(sorted(composeGoogleAuthorizationScopes(GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY, [])), sorted([...IDENTITY, GOOGLE_YOUTUBE_READONLY_SCOPE]));
    assert.deepEqual(sorted(composeGoogleAuthorizationScopes(GOOGLE_DRIVE_FILE_CAPABILITY, [])), sorted([...IDENTITY, GOOGLE_DRIVE_FILE_SCOPE]));
  }

  /* 5 · same-family composition still works (the part of bda53bc9 that stays) */
  assert.deepEqual(
    sorted(composeGoogleAuthorizationScopes(GOOGLE_DRIVE_CONTENT_CAPABILITY, [...GOOGLE_IDENTITY_SCOPES, GOOGLE_DRIVE_FILE_SCOPE, GOOGLE_DRIVE_METADATA_SCOPE])),
    sorted([...IDENTITY, GOOGLE_DRIVE_FILE_SCOPE, GOOGLE_DRIVE_METADATA_SCOPE, GOOGLE_DRIVE_CONTENT_SCOPE]),
  );

  /* 6 · the composer throws rather than send a cross-family request (construction guard) */
  {
    const body = codeOnly(read(CONTRACTS));
    const fn = body.slice(body.indexOf("export function composeGoogleAuthorizationScopes"));
    assert.ok(/throw new Error\(`A \$\{connection\} authorization request may not carry a \$\{other\} scope\.`\)/.test(fn));
  }

  /* 7 · arbitrary client scopes impossible: one request parameter, and foreign observed scopes are never carried */
  {
    const reads = [...startCode.matchAll(/searchParams\.get\(\s*"([^"]+)"/g)].map((m) => m[1]!);
    assert.deepEqual(reads, ["capability"], "exactly one request parameter is honoured");
    const hostile = [
      ...GOOGLE_IDENTITY_SCOPES,
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/gmail.send",
      /* `youtube.upload` left this list with YOUTUBE-WRITE-2: it is now a YouTube-family scope. */
      "https://www.googleapis.com/auth/youtube.force-ssl",
      "https://evil.example/scope",
    ];
    assert.deepEqual([...composeGoogleAuthorizationScopes(null, hostile)], IDENTITY);
    assert.deepEqual([...composeGoogleAuthorizationScopes(GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY, hostile)], [...IDENTITY, GOOGLE_YOUTUBE_READONLY_SCOPE]);
  }

  /* 8 · cross-tenant impossible: the only observation is the session tenant's own connection */
  {
    assert.ok(/const tenant = await resolveTenantContext\(\)/.test(startCode));
    assert.ok(/listConnections\(tenant,/.test(startCode));
    const scopeSources = [...startCode.matchAll(/(?<![\w"])(\w+\??\.)?scopes\b(?!")/g)].map((m) => m[0]);
    assert.ok(scopeSources.every((s) => s === "existing?.scopes" || s === "scopes"), `no other scope source: ${scopeSources}`);
    assert.ok(/include_granted_scopes",\s*"false"/.test(startCode), "never Google's per-account union");
  }

  /* 9 · provider-observed scopes stay authoritative: the callback records only Google's answer */
  {
    assert.ok(/grantedScopes:\s*grant\.grantedScopes/.test(callbackCode));
    assert.ok(!/composeGoogleAuthorizationScopes|GOOGLE_RETAINABLE_SCOPES_BY_CONNECTION|existing\?\.scopes/.test(callbackCode));
    /* the callback writes to the integration the signed state names — the one the start route resolved */
    assert.ok(/const integrationId = verified\.payload\.integrationId/.test(callbackCode));
  }

  /* 10 · the target state: both connections, each capability available through its OWN connection */
  {
    const both = [workspace([...GOOGLE_IDENTITY_SCOPES, GOOGLE_DRIVE_FILE_SCOPE]), youtubeConn([...GOOGLE_IDENTITY_SCOPES, GOOGLE_YOUTUBE_READONLY_SCOPE])];
    const drive = await availability(both, GOOGLE_DRIVE_FILE_CAPABILITY);
    const yt = await availability(both, GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY);
    assert.equal(drive.state, "available");
    assert.equal(yt.state, "available");
    assert.deepEqual(drive.sources.filter((s) => s.readAvailable).map((s) => s.integrationId), [WORKSPACE_ID]);
    assert.deepEqual(yt.sources.filter((s) => s.readAvailable).map((s) => s.integrationId), [YOUTUBE_ID]);
  }

  /* 11 · neither derives from the other: a youtube scope on the Workspace row does NOT make YouTube available */
  {
    const legacy = [workspace([...GOOGLE_IDENTITY_SCOPES, GOOGLE_YOUTUBE_READONLY_SCOPE])];
    assert.notEqual((await availability(legacy, GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY)).state, "available");
    const wrongRow = [youtubeConn([...GOOGLE_IDENTITY_SCOPES, GOOGLE_DRIVE_FILE_SCOPE])];
    assert.notEqual((await availability(wrongRow, GOOGLE_DRIVE_FILE_CAPABILITY)).state, "available");
  }

  /* 12 · revocation affects only its own connection */
  {
    const driveRevoked = [workspace([...GOOGLE_IDENTITY_SCOPES]), youtubeConn([...GOOGLE_IDENTITY_SCOPES, GOOGLE_YOUTUBE_READONLY_SCOPE])];
    assert.equal((await availability(driveRevoked, GOOGLE_DRIVE_FILE_CAPABILITY)).state, "degraded");
    assert.equal((await availability(driveRevoked, GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY)).state, "available");
    const ytEnded = [
      workspace([...GOOGLE_IDENTITY_SCOPES, GOOGLE_DRIVE_FILE_SCOPE]),
      connectedFixture({ integrationId: YOUTUBE_ID, providerKey: GOOGLE_YOUTUBE_PROVIDER_KEY, connectionState: "revoked", revokedAt: "2026-09-28T00:00:00.000Z", scopes: [...GOOGLE_IDENTITY_SCOPES, GOOGLE_YOUTUBE_READONLY_SCOPE] }),
    ];
    assert.notEqual((await availability(ytEnded, GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY)).state, "available");
    assert.equal((await availability(ytEnded, GOOGLE_DRIVE_FILE_CAPABILITY)).state, "available");
    /* and a revoked scope, once observed absent, is not asked for again */
    assert.ok(!composeGoogleAuthorizationScopes(null, [...GOOGLE_IDENTITY_SCOPES]).includes(GOOGLE_DRIVE_FILE_SCOPE));
  }

  /* 13 · the YouTube reader accepts only the google-youtube connection */
  {
    const reader = codeOnly(read(READER));
    assert.ok(/source\.providerKey !== GOOGLE_YOUTUBE_PROVIDER_KEY/.test(reader));
    assert.ok(!/"google-workspace"/.test(reader));
  }

  /* 14 · youtube.upload and every write scope stay unavailable */
  {
    const everything = composeGoogleAuthorizationScopes(GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY, [
      ...Object.values(GOOGLE_CAPABILITY_SCOPE_REQUESTS).flat(),
    ]);
    /*
     * YOUTUBE-WRITE-2: `youtube.upload` is a YouTube-family scope now, carried only when the connection
     * already holds it or the upload capability is asked for — never added to an identity request.
     */
    assert.ok(
      !composeGoogleAuthorizationScopes(GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY, [...GOOGLE_IDENTITY_SCOPES, GOOGLE_YOUTUBE_READONLY_SCOPE]).includes("https://www.googleapis.com/auth/youtube.upload"),
      "an identity request never asks for upload",
    );
    for (const forbidden of [
      "https://www.googleapis.com/auth/youtube",
      "https://www.googleapis.com/auth/youtube.force-ssl",
      "https://www.googleapis.com/auth/drive",
    ]) {
      assert.ok(!everything.includes(forbidden), `${forbidden} is never requested`);
    }
    /*
     * YOUTUBE-WRITE-2 adds the ONE write half that exists: `google.youtube.video.upload` on
     * `google-youtube`, writing `youtube.upload` and nothing else. Every other capability stays read-only.
     */
    for (const key of GOOGLE_OAUTH_PROVIDER_KEYS) {
      for (const [cap, s] of Object.entries(findProviderDefinition(key)!.capabilityScopes)) {
        const expected = key === "google-youtube" && cap === "google.youtube.video.upload" ? ["https://www.googleapis.com/auth/youtube.upload"] : [];
        assert.deepEqual([...s.write], expected, `${key} ${cap} write scopes`);
      }
    }
    /* YOUTUBE-WRITE-2 defines exactly one upload scope constant, and nothing wider. */
    assert.equal((codeOnly(read(CONTRACTS)).match(/youtube\.upload"/g) ?? []).length, 1, "exactly one youtube.upload constant");
  }

  /* 15 · no schema change and no migration */
  {
    const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
    /* This repair added none. YOUTUBE-WRITE-2's approved migration 68 widens one CHECK (pinned in its own tests). */
    /* SUPPLIED-MEDIA-ACCOUNT-PROVENANCE-1: ledger 68 -> 69 (media_assets.supplied_source_integration_id: one nullable column, one composite FK, one CHECK; additive). */ 
    /* KT-3: ledger 69 -> 70 (governance_domain += 'knowledge-public-use': one ALTER TYPE ... ADD VALUE; additive). */
    /* EXTERNAL-AI-DATA-USE-1A: ledger 70 -> 71 (inert external-AI data-use authority; additive). */
    /* SCI-2A: ledger 71 -> 72 (knowledge_nodes version-immutability triggers; no schema shape change). */
    /* SCI-2B: ledger 72 -> 73 (knowledge_nodes.integrity_protected_at_insert + stamp trigger). */
    assert.equal(migrations.length, 76, "ledger 74 since AP-1"); /* L-1b: ledger 75 -> 76 (governance_domain gains 'agent-lifecycle'; additive). */ /* AP-4A: ledger 74 -> 75 (work_domains + agent_mandate_responsibilities + work_items work-scope provenance + agent_mandates (tenant_id, id) unique; additive). */ /* AP-1: ledger 73 -> 74 (agents in-service canonical-name unique index + visible-name CHECK). */
    const touched = execSync("git diff --name-only 4059a176 -- src/db", { cwd: ROOT, encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean)
      .filter((f) => !/l1b_agent_lifecycle_domain|20261008143657_snapshot|ap4a_work_domain_foundation|20261007175237_snapshot|schema\/work-domain\.ts$|schema\/agent-mandate-responsibility\.ts$|schema\/agent-mandate\.ts$|schema\/work-item\.ts$|ap1_agent_name_in_service_uniqueness|20261007064348_snapshot|src\/db\/schema\/agent\.ts$|youtube_write2_recipientless_kind|20260928084834_snapshot|supplied_media_account_provenance|20260929134334_snapshot|knowledge_public_use_domain|external_ai_data_use_authority|20261004073713_snapshot|20261003074659_snapshot|sci2a_knowledge_version_immutability|20261006111812_snapshot|sci2b_knowledge_integrity_at_insert|20261006175909_snapshot|schema\/knowledge\.ts$|_journal\.json|schema\/action-execution\.ts$|schema\/media-asset\.ts$|schema\/_enums\.ts$|schema\/index\.ts$|schema\/external-ai-data-use\.ts$|schema\/department-placement\.ts$/.test(f)); /* AP-2: department-placement.ts doctrine comment only. */ /* AP-4A: work domains, mandate responsibility, work-scope provenance and their migration. */ /* EXTERNAL-AI-DATA-USE-1A: its schema module and the barrel export of it. */
    /* L-1b's migration 76 files are allowed above. They were untracked during L-1b's own run, and
       `git diff <commit>` ignores untracked files, so this pin only saw them once committed (L-2a). */
    assert.deepEqual(touched, [], "no other src/db file changed");
  }

  /* 16 · no token, secret or log on the authorization path; composition is pure */
  {
    assert.ok(!/console\./.test(startCode));
    assert.ok(!/withDecryptedSecret|accessToken|refreshToken|credential-repository/.test(startCode));
    const body = codeOnly(read(CONTRACTS));
    const fn = body.slice(body.indexOf("export function composeGoogleAuthorizationScopes"));
    assert.ok(!/await|fetch|process\.env/.test(fn.slice(0, fn.indexOf("\n}"))));
  }

  /* 17 · concurrency: one state cookie per browser, bound to session + tenant + integration, single use */
  {
    assert.ok(/mintOAuthState\(\s*\{\s*tenantId: tenant\.tenantId, sessionReference, integrationId \}/.test(startCode), "state names the resolved connection");
    assert.ok(/response\.cookies\.set\(\s*GOOGLE_OAUTH_STATE_COOKIE/.test(startCode), "a second start replaces the first flow's cookie");
    assert.ok(/tenantId: tenant\.tenantId/.test(callbackCode));
    assert.ok(/response\.cookies\.delete\(GOOGLE_OAUTH_STATE_COOKIE\)/.test(callbackCode), "single use");
  }

  console.log("google-capability-scope-repair-1: 1–17 passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
