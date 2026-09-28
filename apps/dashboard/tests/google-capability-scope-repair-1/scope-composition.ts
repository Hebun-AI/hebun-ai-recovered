/*
 * tests/google-capability-scope-repair-1/scope-composition.ts — GOOGLE-CAPABILITY-SCOPE-REPAIR-1.
 *
 * Granting one Google capability must not silently drop another the connection already holds.
 * Production defect (YOUTUBE-WRITE-1, TRH, 2026-09-28): identity + drive.file, then a YouTube
 * upgrade, recorded identity + youtube.readonly — Drive went to a scope gap.
 *
 * Cases A–T. No real Google call and no database: composition is a pure function, availability runs
 * against a listing stand-in, and the route/callback are read as source where their wiring is the fact.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import {
  GOOGLE_CAPABILITY_SCOPE_REQUESTS,
  GOOGLE_DRIVE_CONTENT_CAPABILITY,
  GOOGLE_DRIVE_CONTENT_SCOPE,
  GOOGLE_DRIVE_FILE_CAPABILITY,
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_DRIVE_METADATA_CAPABILITY,
  GOOGLE_DRIVE_METADATA_SCOPE,
  GOOGLE_REQUESTED_SCOPES,
  GOOGLE_RETAINABLE_CAPABILITY_SCOPES,
  GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY,
  GOOGLE_YOUTUBE_READONLY_SCOPE,
  composeGoogleAuthorizationScopes,
} from "../../src/features/provider-google/contracts";
import { getCapabilityAvailability } from "../../src/features/integration-authority/capability-availability.server";
import type { IntegrationView } from "../../src/features/integration-authority/contracts";
import { connectedFixture, GOOGLE_IDENTITY_SCOPES } from "../helpers/integration-connection-fixtures";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const START = "src/app/api/integrations/google/start/route.ts";
const CALLBACK = "src/app/api/integrations/google/callback/route.ts";
const CONTRACTS = "src/features/provider-google/contracts.ts";

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

async function stateOf(scopes: readonly string[], capability: string): Promise<string | undefined> {
  const view = await getCapabilityAvailability(TENANT, { getDb: dbFor([connectedFixture({ scopes })]) });
  return view.capabilities.find((c) => c.capability === capability)?.state;
}

const IDENTITY = [...GOOGLE_REQUESTED_SCOPES];
const sorted = (xs: readonly string[]) => [...xs].sort();

async function main(): Promise<void> {
  const start = read(START);
  const startCode = codeOnly(start);
  const callbackCode = codeOnly(read(CALLBACK));

  /* A · the client submits a capability; the route takes exactly one parameter and never a scope */
  {
    const reads = [...startCode.matchAll(/searchParams\.get\(\s*"([^"]+)"/g)].map((m) => m[1]!);
    assert.deepEqual(reads, ["capability"], "exactly one request parameter is honoured");
    assert.ok(!/searchParams\.get\(\s*"scope/.test(startCode), "no scope is read from the request");
    assert.ok(
      /composeGoogleAuthorizationScopes\(\s*requestedCapability\s*,\s*existing\?\.scopes\s*\?\?\s*\[\]\s*\)/.test(startCode),
      "the request is composed from the capability name and the resolved connection's observed scopes",
    );
    assert.ok(/authorize\.searchParams\.set\("scope",\s*scopes\.join\(" "\)\)/.test(startCode), "only the composed set reaches Google");
  }

  /* B · an unknown capability adds nothing beyond what the connection already holds */
  for (const junk of ["google.drive.write", "__proto__", "constructor", GOOGLE_DRIVE_FILE_SCOPE, "youtube.upload", ""]) {
    assert.deepEqual([...composeGoogleAuthorizationScopes(junk, [])], IDENTITY, `"${junk}" is not a capability`);
  }
  assert.deepEqual([...composeGoogleAuthorizationScopes(null, [])], IDENTITY);

  /* C · identity scopes are always requested, whatever else is */
  for (const cap of [null, ...Object.keys(GOOGLE_CAPABILITY_SCOPE_REQUESTS)]) {
    const req = composeGoogleAuthorizationScopes(cap, [GOOGLE_DRIVE_FILE_SCOPE]);
    for (const id of IDENTITY) assert.ok(req.includes(id), `${cap} keeps ${id}`);
  }

  /* D · a first Drive upgrade asks for identity + drive.file only */
  assert.deepEqual(
    sorted(composeGoogleAuthorizationScopes(GOOGLE_DRIVE_FILE_CAPABILITY, GOOGLE_IDENTITY_SCOPES)),
    sorted([...IDENTITY, GOOGLE_DRIVE_FILE_SCOPE]),
  );

  /* E · a first YouTube upgrade asks for identity + youtube.readonly only */
  assert.deepEqual(
    sorted(composeGoogleAuthorizationScopes(GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY, GOOGLE_IDENTITY_SCOPES)),
    sorted([...IDENTITY, GOOGLE_YOUTUBE_READONLY_SCOPE]),
  );

  /* F · THE PRODUCTION DEFECT: observed drive.file + YouTube upgrade keeps drive.file */
  assert.deepEqual(
    sorted(composeGoogleAuthorizationScopes(GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY, [...GOOGLE_IDENTITY_SCOPES, GOOGLE_DRIVE_FILE_SCOPE])),
    sorted([...IDENTITY, GOOGLE_DRIVE_FILE_SCOPE, GOOGLE_YOUTUBE_READONLY_SCOPE]),
  );

  /* G · the TRH repair path: observed youtube.readonly + Drive upgrade keeps youtube.readonly */
  assert.deepEqual(
    sorted(composeGoogleAuthorizationScopes(GOOGLE_DRIVE_FILE_CAPABILITY, [...GOOGLE_IDENTITY_SCOPES, GOOGLE_YOUTUBE_READONLY_SCOPE])),
    sorted([...IDENTITY, GOOGLE_DRIVE_FILE_SCOPE, GOOGLE_YOUTUBE_READONLY_SCOPE]),
  );

  /* H · A + B, then C → A + B + C */
  assert.deepEqual(
    sorted(
      composeGoogleAuthorizationScopes(GOOGLE_DRIVE_METADATA_CAPABILITY, [
        ...GOOGLE_IDENTITY_SCOPES, GOOGLE_DRIVE_FILE_SCOPE, GOOGLE_YOUTUBE_READONLY_SCOPE,
      ]),
    ),
    sorted([...IDENTITY, GOOGLE_DRIVE_FILE_SCOPE, GOOGLE_YOUTUBE_READONLY_SCOPE, GOOGLE_DRIVE_METADATA_SCOPE]),
  );
  /* …and re-upgrading a capability already held asks for nothing new (no duplicates) */
  const again = composeGoogleAuthorizationScopes(GOOGLE_DRIVE_FILE_CAPABILITY, [...GOOGLE_IDENTITY_SCOPES, GOOGLE_DRIVE_FILE_SCOPE]);
  assert.equal(new Set(again).size, again.length);

  /* I · another tenant's scopes cannot enter: the only observation is this session's tenant's own connection */
  {
    assert.ok(/const tenant = await resolveTenantContext\(\)/.test(startCode), "the tenant is the session's");
    assert.ok(/listConnections\(tenant,/.test(startCode), "the connection is listed for that tenant only");
    assert.ok(/const existing =\s*\n?\s*listing\.status === "read"/.test(startCode), "the observation comes from that listing");
    const scopeSources = [...startCode.matchAll(/(?<![\w"])(\w+\??\.)?scopes\b(?!")/g)].map((m) => m[0]);
    assert.ok(scopeSources.every((s) => s === "existing?.scopes" || s === "scopes"), `no other scope source: ${scopeSources}`);
    /* composition is pure: its output is a function of its two arguments and nothing else */
    assert.deepEqual(
      [...composeGoogleAuthorizationScopes(GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY, GOOGLE_IDENTITY_SCOPES)],
      [...composeGoogleAuthorizationScopes(GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY, GOOGLE_IDENTITY_SCOPES)],
    );
  }

  /* J · an arbitrary scope in the observation is never re-requested; only the closed capability set is carried */
  {
    const hostile = [
      ...GOOGLE_IDENTITY_SCOPES,
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/youtube.upload",
      "https://evil.example/scope",
    ];
    assert.deepEqual([...composeGoogleAuthorizationScopes(null, hostile)], IDENTITY);
    assert.deepEqual(
      sorted(GOOGLE_RETAINABLE_CAPABILITY_SCOPES),
      sorted([...new Set(Object.values(GOOGLE_CAPABILITY_SCOPE_REQUESTS).flat())]),
      "the carry-forward set is exactly the frozen map's scopes",
    );
  }

  /* K + L · no write scope, and no YouTube upload scope, can ever be requested */
  {
    const everything = composeGoogleAuthorizationScopes(GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY, [
      ...GOOGLE_IDENTITY_SCOPES, ...GOOGLE_RETAINABLE_CAPABILITY_SCOPES,
    ]);
    for (const forbidden of [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube",
      "https://www.googleapis.com/auth/youtube.force-ssl",
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/drive.file.write",
    ]) {
      assert.ok(!everything.includes(forbidden), `${forbidden} is never requested`);
    }
    assert.ok(!/youtube\.upload"/.test(codeOnly(read(CONTRACTS))), "no youtube.upload constant exists");
  }

  /* M · the callback records ONLY Google's statement of the grant — never the request */
  {
    assert.ok(/grantedScopes:\s*grant\.grantedScopes/.test(callbackCode), "observed scopes are what Google returned");
    assert.ok(!/composeGoogleAuthorizationScopes|GOOGLE_RETAINABLE_CAPABILITY_SCOPES|existing\?\.scopes/.test(callbackCode), "no requested or historical scope reaches the record");
    assert.ok(/coversRequiredScopes\(grant\.grantedScopes\)/.test(callbackCode));
  }

  /* N · a scope actually gone from the observed grant makes its capability unavailable */
  assert.equal(await stateOf([...GOOGLE_IDENTITY_SCOPES, GOOGLE_YOUTUBE_READONLY_SCOPE], GOOGLE_DRIVE_FILE_CAPABILITY), "degraded");
  assert.equal(await stateOf([...GOOGLE_IDENTITY_SCOPES, GOOGLE_DRIVE_FILE_SCOPE], GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY), "degraded");

  /* O · not monotonic: after Google's answer drops a scope, the next request does not bring it back */
  {
    const yesterday = [...GOOGLE_IDENTITY_SCOPES, GOOGLE_DRIVE_FILE_SCOPE, GOOGLE_YOUTUBE_READONLY_SCOPE];
    const observedToday = [...GOOGLE_IDENTITY_SCOPES, GOOGLE_YOUTUBE_READONLY_SCOPE]; // drive.file revoked at Google
    assert.ok(composeGoogleAuthorizationScopes(null, yesterday).includes(GOOGLE_DRIVE_FILE_SCOPE));
    assert.ok(!composeGoogleAuthorizationScopes(null, observedToday).includes(GOOGLE_DRIVE_FILE_SCOPE), "revoked stays revoked");
    assert.ok(
      !composeGoogleAuthorizationScopes(GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY, observedToday).includes(GOOGLE_DRIVE_FILE_SCOPE),
    );
  }

  /* P · no schema change and no migration: the repair touches no `src/db` file */
  {
    const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
    assert.equal(migrations.length, 67, "ledger stays 67");
    const touched = execSync("git diff --name-only 4059a176 -- src/db", { cwd: ROOT, encoding: "utf8" }).trim();
    assert.equal(touched, "", "no src/db file changed");
  }

  /* Q · Drive per-file capability still resolves exactly as before */
  assert.equal(await stateOf([...GOOGLE_IDENTITY_SCOPES, GOOGLE_DRIVE_FILE_SCOPE], GOOGLE_DRIVE_FILE_CAPABILITY), "available");
  assert.equal(await stateOf([...GOOGLE_IDENTITY_SCOPES, GOOGLE_DRIVE_CONTENT_SCOPE], GOOGLE_DRIVE_CONTENT_CAPABILITY), "available");

  /* R · YouTube channel identity still resolves; and both at once — the target production state */
  assert.equal(await stateOf([...GOOGLE_IDENTITY_SCOPES, GOOGLE_YOUTUBE_READONLY_SCOPE], GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY), "available");
  {
    const both = [...GOOGLE_IDENTITY_SCOPES, GOOGLE_DRIVE_FILE_SCOPE, GOOGLE_YOUTUBE_READONLY_SCOPE];
    assert.equal(await stateOf(both, GOOGLE_DRIVE_FILE_CAPABILITY), "available");
    assert.equal(await stateOf(both, GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY), "available");
  }

  /* S · no token, secret or log introduced on the authorization path */
  {
    assert.ok(!/console\./.test(startCode), "the start route logs nothing");
    assert.ok(!/withDecryptedSecret|accessToken|refreshToken|credential-repository/.test(startCode), "the start route touches no credential");
    const composer = codeOnly(read(CONTRACTS));
    const body = composer.slice(composer.indexOf("export function composeGoogleAuthorizationScopes"));
    assert.ok(!/await|fetch|process\.env/.test(body.slice(0, body.indexOf("\n}"))), "composition is pure");
  }

  /* T · concurrency: one state cookie per browser, bound to session + tenant, single use */
  {
    assert.ok(/response\.cookies\.set\(\s*GOOGLE_OAUTH_STATE_COOKIE/.test(startCode), "a second start replaces the first flow's cookie");
    assert.ok(/verifyOAuthState\(/.test(callbackCode) && /tenantId: tenant\.tenantId/.test(callbackCode), "state is bound to the tenant");
    assert.ok(/response\.cookies\.delete\(GOOGLE_OAUTH_STATE_COOKIE\)/.test(callbackCode), "single use");
    assert.ok(/include_granted_scopes",\s*"false"/.test(startCode), "per-tenant composition, not Google's per-account union");
  }

  console.log("google-capability-scope-repair-1: A–T passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
