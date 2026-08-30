/*
 * INT-4 — the Drive metadata capability, and the seam that spends a credential to answer it.
 *
 * ── THE ONE SENTENCE THIS SUITE DEFENDS ─────────────────────────────────────
 *
 *   A CONNECTION IS NOT A DATA CAPABILITY.
 *
 * INT-3 proved a credential existing is not a connection. This is the next distinction, and it is
 * easier to lose: a connected, healthy, verified Google account with identity-only scopes is a
 * perfectly good connection AND has no Drive access whatsoever. Every assertion below exists so
 * that "Google is connected" can never quietly become "Hebun can read your Drive".
 */
import assert from "node:assert/strict";

import {
  GOOGLE_DRIVE_METADATA_CAPABILITY,
  GOOGLE_DRIVE_METADATA_SCOPE,
  GOOGLE_DRIVE_CONTENT_CAPABILITY,
  GOOGLE_DRIVE_CONTENT_SCOPE,
  GOOGLE_DRIVE_FILE_CAPABILITY,
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_REQUESTED_SCOPES,
  MAX_DRIVE_FILES_PER_PAGE,
  extraScopesForCapability,
  GOOGLE_UPGRADEABLE_CAPABILITIES,
} from "../../src/features/provider-google/contracts";
import { listDriveFiles } from "../../src/features/provider-google/google-transport.server";
import { isRefreshableFailure } from "../../src/features/provider-google/google-authorized-call.server";
import {
  PROVIDER_CATALOG,
  findProviderDefinition,
  listConnectableCapabilities,
} from "../../src/features/provider-catalog/catalog";
import { getCapabilityAvailability } from "../../src/features/integration-authority/capability-availability.server";
import type { IntegrationView } from "../../src/features/integration-authority/contracts";
import { connectedFixture, GOOGLE_IDENTITY_SCOPES } from "../helpers/integration-connection-fixtures";

const TENANT = { tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } as never;

/** A listing seam standing in for the database, so the availability seam runs against real code. */
function dbFor(connections: readonly IntegrationView[]) {
  return () =>
    ({
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () =>
                connections.map((c) => ({
                  id: c.integrationId,
                  name: c.name,
                  providerKey: c.providerKey,
                  connectionState: c.connectionState,
                  health: c.health,
                  scopes: c.scopes,
                  externalAccountId: c.externalAccountId,
                  externalAccountLabel: c.externalAccountLabel,
                  lastVerifiedAt: c.lastVerifiedAt ? new Date(c.lastVerifiedAt) : null,
                  lastSuccessAt: c.lastSuccessAt ? new Date(c.lastSuccessAt) : null,
                  lastErrorAt: c.lastErrorAt ? new Date(c.lastErrorAt) : null,
                  failureReason: c.failureReason,
                  revokedAt: c.revokedAt ? new Date(c.revokedAt) : null,
                  createdAt: new Date(c.createdAt),
                })),
            }),
          }),
        }),
      }),
    }) as never;
}

const withDrive = (overrides: Partial<IntegrationView> = {}) =>
  connectedFixture({ scopes: [...GOOGLE_IDENTITY_SCOPES, GOOGLE_DRIVE_METADATA_SCOPE], ...overrides });

async function availabilityFor(connections: readonly IntegrationView[]) {
  const view = await getCapabilityAvailability(TENANT, { getDb: dbFor(connections) });
  return view.capabilities.find((c) => c.capability === GOOGLE_DRIVE_METADATA_CAPABILITY)!;
}

/* ── The capability is defined, narrowly ────────────────────────────────────── */

function theCapabilityIsNarrow(): void {
  /*
   * ── AMENDED BY GITHUB-2 ────────────────────────────────────────────────────
   *
   * This suite is INT-4's and its subject is Drive. The catalog now also maps GitHub's repository
   * activity capability, so the assertion states what INT-4 actually cares about — Drive is mapped,
   * exactly once — instead of asserting that Drive is the only capability in the product, which was
   * never the rule it meant to defend.
   */
  const capabilities = [...listConnectableCapabilities()];
  assert.ok(
    capabilities.includes(GOOGLE_DRIVE_METADATA_CAPABILITY),
    "the Drive metadata capability is mapped",
  );
  assert.equal(
    capabilities.filter((c) => c === GOOGLE_DRIVE_METADATA_CAPABILITY).length,
    1,
    "and exactly once",
  );
  assert.ok(
    capabilities.every((c) => c.startsWith("google.") || c.startsWith("github.")),
    "every mapped capability is named by a provider that exists",
  );

  const google = findProviderDefinition("google-workspace")!;
  const scopes = google.capabilityScopes[GOOGLE_DRIVE_METADATA_CAPABILITY]!;
  assert.deepEqual([...scopes.read], [GOOGLE_DRIVE_METADATA_SCOPE]);

  /*
   * NO WRITE SCOPE, AND THAT IS NOT COSMETIC. The availability seam reads this list; an empty one
   * must mean "no write capability exists", never "vacuously satisfied".
   */
  assert.deepEqual([...scopes.write], [], "the Drive capability declares NO write scope");

  /* The base authorization request is untouched: identity-only remains the resting state. */
  assert.deepEqual([...GOOGLE_REQUESTED_SCOPES], ["openid", "email", "profile"]);
  assert.ok(Object.isFrozen(PROVIDER_CATALOG));
}

/* ── M1 · availability tracks the GRANT, not the connection ─────────────────── */

async function identityOnlyGrantIsNotDriveAccess(): Promise<void> {
  const entry = await availabilityFor([connectedFixture()]);
  assert.notEqual(entry.state, "available", "identity-only scopes are NOT Drive access");
  assert.equal(entry.state, "degraded", "the grant is short — the connection is fine");
  assert.ok(entry.reason, "a scope gap always states a reason");
  assert.equal(entry.sources[0]!.readAvailable, false, "and the source says so too");
}

async function theGrantedScopeMakesItAvailable(): Promise<void> {
  const entry = await availabilityFor([withDrive()]);
  assert.equal(entry.state, "available");
  assert.equal(entry.sources[0]!.readAvailable, true);
}

/**
 * REMOVING THE SCOPE MUST REMOVE THE CLAIM. The prompt's explicit requirement, asserted as a
 * transition rather than as two unrelated facts.
 */
async function removingTheScopeStopsTheClaim(): Promise<void> {
  const before = await availabilityFor([withDrive()]);
  const after = await availabilityFor([connectedFixture()]);
  assert.equal(before.state, "available");
  assert.notEqual(after.state, "available", "drop the scope and the capability stops being claimed");
}

/* ── The write claim ────────────────────────────────────────────────────────── */

/**
 * `covers(granted, [])` is vacuously TRUE, so before INT-4's fix a capability with no write scopes
 * reported `writeCapable: true` — "a Drive write is presently possible" — for any healthy
 * connection. This is the assertion that keeps that fixed.
 */
async function noWriteIsEverClaimed(): Promise<void> {
  for (const connection of [withDrive(), connectedFixture()]) {
    const entry = await availabilityFor([connection]);
    for (const source of entry.sources) {
      assert.equal(source.writeCapable, false, "Drive write is a phase away, not a scope away");
    }
  }
  /* Not even with an absurdly generous grant, because no write scope is defined at all. */
  const generous = await availabilityFor([
    withDrive({ scopes: [...GOOGLE_IDENTITY_SCOPES, GOOGLE_DRIVE_METADATA_SCOPE, "https://www.googleapis.com/auth/drive"] }),
  ]);
  assert.equal(generous.sources[0]!.writeCapable, false, "a wider grant still cannot make Hebun a writer");
}

/* ── Lifecycle and health still gate, independently of scope ────────────────── */

async function lifecycleAndHealthStillGate(): Promise<void> {
  for (const [label, connection] of [
    ["unverified", withDrive({ connectionState: "unverified" })],
    ["expired", withDrive({ connectionState: "expired" })],
    ["disconnected", withDrive({ connectionState: "disconnected" })],
    ["degraded health", withDrive({ health: "degraded" })],
    ["unreachable health", withDrive({ health: "unreachable" })],
    ["unknown health", withDrive({ health: "unknown" })],
  ] as const) {
    const entry = await availabilityFor([connection as IntegrationView]);
    assert.notEqual(entry.state, "available", `${label} must not be Drive-available`);
  }
}

/* ── The scope-upgrade request ──────────────────────────────────────────────── */

function theUpgradeRequestIsClosed(): void {
  /*
   * ── AMENDED BY KID-1, THE SAME WAY GITHUB-2 AMENDED THE CENSUS ABOVE ──────
   *
   * This list was `[metadata]` because metadata was the only capability that existed. KID-1 added
   * `google.drive.content.read` behind its own scope and its own consent, so the list is two.
   *
   * What INT-4 was actually defending is asserted immediately below and is UNCHANGED: the map is
   * CLOSED, and the metadata capability still resolves to the metadata scope and nothing wider.
   * A capability arriving here without somebody naming it is what this assertion still prevents.
   */
  /*
   * ── AMENDED AGAIN BY THE GOOGLE LEAST-PRIVILEGE ADAPTATION ───────────────
   *
   * A third capability, `google.drive.file.content.read`, mapping to the NON-SENSITIVE `drive.file`
   * scope. The list is three, and what INT-4 was defending is still asserted below and still
   * unchanged: the map is CLOSED, and each capability resolves to its own scope and nothing wider.
   *
   * The order is the map's own insertion order and is asserted as such, so a capability cannot be
   * quietly reordered into a different meaning either.
   */
  assert.deepEqual(
    [...GOOGLE_UPGRADEABLE_CAPABILITIES],
    [
      GOOGLE_DRIVE_METADATA_CAPABILITY,
      GOOGLE_DRIVE_CONTENT_CAPABILITY,
      GOOGLE_DRIVE_FILE_CAPABILITY,
    ],
  );
  /*
   * AND THE NARROW ONE RESOLVES TO THE NARROW SCOPE. This is the assertion the whole adaptation
   * rests on: the capability the production admission path uses asks Google for `drive.file`, which
   * Google classifies non-sensitive — never for either restricted Drive scope.
   */
  assert.deepEqual(
    [...extraScopesForCapability(GOOGLE_DRIVE_FILE_CAPABILITY)!],
    [GOOGLE_DRIVE_FILE_SCOPE],
    "the per-file capability requests exactly the non-sensitive per-file scope",
  );
  for (const restricted of [GOOGLE_DRIVE_METADATA_SCOPE, GOOGLE_DRIVE_CONTENT_SCOPE]) {
    assert.ok(
      !extraScopesForCapability(GOOGLE_DRIVE_FILE_CAPABILITY)!.includes(restricted),
      `the per-file capability must never request the restricted scope ${restricted}`,
    );
  }
  assert.deepEqual(
    [...extraScopesForCapability(GOOGLE_DRIVE_METADATA_CAPABILITY)!],
    [GOOGLE_DRIVE_METADATA_SCOPE],
    "the metadata capability was not widened by the content capability existing",
  );
  /* Anything else resolves to NOTHING — never to a scope, and never to an echoed error. */
  for (const hostile of [
    "https://www.googleapis.com/auth/drive",
    "google.drive.write",
    "__proto__",
    "constructor",
    "toString",
    "",
    null,
  ]) {
    assert.equal(extraScopesForCapability(hostile), null, `"${hostile}" is not a capability`);
  }
}

/* ── The transport ─────────────────────────────────────────────────────────── */

function driveResponse(body: unknown, status = 200): () => Promise<Response> {
  return async () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function theListingIsNormalizedAndBounded(): Promise<void> {
  let requested = "";
  const result = await listDriveFiles(
    "int4-fixture-access-token",
    {},
    {
      fetchImpl: async (input) => {
        requested = input;
        return new Response(
          JSON.stringify({
            nextPageToken: "page-2",
            files: [
              {
                id: "file-1",
                name: "Handbook.pdf",
                mimeType: "application/pdf",
                modifiedTime: "2026-08-01T10:00:00.000Z",
                size: "12345",
                trashed: false,
                /* Everything below is present in Google's payload and must NOT cross the seam. */
                owners: [{ emailAddress: "someone@example.com" }],
                permissions: [{ role: "owner" }],
                webContentLink: "https://drive.google.com/uc?id=file-1",
                thumbnailLink: "https://lh3.googleusercontent.com/x",
              },
              { id: "native", name: "Plan", mimeType: "application/vnd.google-apps.document", trashed: true },
              { name: "no-id-so-dropped", mimeType: "text/plain" },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  );

  assert.ok(result.ok, "a well-formed Drive response is read");
  if (!result.ok) return;

  /*
   * THE LEAK CHECK COMES FIRST, DELIBERATELY.
   *
   * It used to sit at the end, after a count assertion about dropped entries. A mutation that let
   * the RAW Google objects through therefore reported "an entry with no id is dropped, not fatal"
   * — a robustness detail — instead of the security property that actually broke. Order the
   * assertions so the most consequential one is the one that speaks.
   */
  {
    const json = JSON.stringify(result.listing);
    for (const leaked of ["owners", "permissions", "webContentLink", "thumbnailLink", "emailAddress"]) {
      assert.ok(!json.includes(leaked), `the raw Google response must not cross the seam (${leaked})`);
    }
  }

  /* The projection is a security control: only the declared fields are even requested. */
  assert.ok(requested.startsWith("https://www.googleapis.com/drive/v3/files"), "the frozen endpoint");
  assert.ok(requested.includes("fields=nextPageToken%2Cfiles%28id%2Cname%2CmimeType%2CmodifiedTime%2Csize%2Ctrashed%29"));
  assert.ok(!requested.includes("alt=media"), "no content download is ever requested");
  assert.ok(requested.includes(`pageSize=${MAX_DRIVE_FILES_PER_PAGE}`), "the page is bounded");

  const [first, second] = result.listing.files;
  assert.equal(result.listing.files.length, 2, "an entry with no id is dropped, not fatal");
  assert.deepEqual(first, {
    fileId: "file-1",
    name: "Handbook.pdf",
    mimeType: "application/pdf",
    modifiedAt: "2026-08-01T10:00:00.000Z",
    sizeBytes: 12345,
    trashed: false,
  });
  /* A Google-native file genuinely has no byte size. `null` is the measurement nobody took. */
  assert.equal(second!.sizeBytes, null);
  assert.equal(second!.trashed, true, "a trashed file is reported trashed, never hidden");
  assert.equal(result.listing.nextPageToken, "page-2", "Google's own opaque token, not one Hebun invents");

}

/**
 * M8 / M9 — A PROVIDER HAVING A BAD MINUTE IS NOT A REVOKED GRANT.
 *
 * These classes are what stop a Drive outage from ending a tenant's Google connection, and
 * `isRefreshableFailure` is what stops a refresh token being spent on a problem it cannot fix.
 */
async function transportFailuresAreNeverAuth(): Promise<void> {
  for (const [status, body] of [
    [429, { error: { code: 429, errors: [{ reason: "rateLimitExceeded" }] } }],
    [500, { error: { code: 500 } }],
    [503, { error: { code: 503 } }],
  ] as const) {
    const result = await listDriveFiles("t", {}, { fetchImpl: driveResponse(body, status) });
    assert.ok(!result.ok);
    if (result.ok) continue;
    assert.equal(result.failure, "transport", `${status} is transport, never auth`);
    assert.equal(isRefreshableFailure(result.failure), false, `${status} must not spend a refresh token`);
  }

  /* A network-level failure is equally not a statement about the grant. */
  const unreachable = await listDriveFiles("t", {}, {
    fetchImpl: async () => {
      throw new Error("ECONNRESET");
    },
  });
  assert.ok(!unreachable.ok);
  if (!unreachable.ok) assert.equal(unreachable.failure, "transport");
}

/**
 * Drive answers `error` as an OBJECT while the OAuth endpoints answer it as a STRING. Reading only
 * the string shape would classify a scope gap as `auth` and tell a tenant to reconnect an account
 * nobody disconnected.
 */
async function aScopeGapIsClassifiedAsScope(): Promise<void> {
  const result = await listDriveFiles("t", {}, {
    fetchImpl: driveResponse(
      { error: { code: 403, errors: [{ reason: "insufficientPermissions" }] } },
      403,
    ),
  });
  assert.ok(!result.ok);
  if (!result.ok) {
    assert.equal(result.failure, "scope", "Drive's nested error shape is read");
    assert.equal(isRefreshableFailure(result.failure), false, "a scope gap is not refreshable");
  }

  /* A genuine 401 IS refreshable — the one case a refresh can fix. */
  const refused = await listDriveFiles("t", {}, { fetchImpl: driveResponse({ error: { code: 401 } }, 401) });
  assert.ok(!refused.ok);
  if (!refused.ok) assert.equal(isRefreshableFailure(refused.failure), true);
}

/**
 * A DISABLED API IS NOT A REFUSED CREDENTIAL — found by real acceptance, not by review.
 *
 * Google answers `accessNotConfigured` as a 403 whose reason is neither `insufficientPermissions`
 * nor `insufficient_scope`. It used to fall through to `auth`, which says "Google refused this
 * credential" about a perfect credential — and `auth` is the one class a refresh is attempted for,
 * so Hebun would have spent a refresh token on every call to fix something no token can fix.
 */
async function aDisabledApiIsNotAnAuthFailure(): Promise<void> {
  for (const body of [
    { error: { code: 403, status: "PERMISSION_DENIED", errors: [{ reason: "accessNotConfigured" }] } },
    { error: { code: 403, status: "SERVICE_DISABLED" } },
  ]) {
    const result = await listDriveFiles("t", {}, { fetchImpl: driveResponse(body, 403) });
    assert.ok(!result.ok);
    if (result.ok) continue;
    assert.equal(result.failure, "disabled", "a switched-off API is its own class");
    assert.notEqual(result.failure, "auth", "it is NOT a credential refusal");
    assert.equal(
      isRefreshableFailure(result.failure),
      false,
      "and a refresh token is never spent on it",
    );
  }

  /* An ordinary 403 with no recognized reason is still an auth refusal. */
  const plain = await listDriveFiles("t", {}, { fetchImpl: driveResponse({ error: { code: 403 } }, 403) });
  assert.ok(!plain.ok);
  if (!plain.ok) assert.equal(plain.failure, "auth", "an unexplained 403 is still a refusal");
}

/** No provider payload, no token, no status body may appear in a reason string. */
async function failureReasonsCarryNothing(): Promise<void> {
  const result = await listDriveFiles("int4-fixture-access-token-SECRET", {}, {
    fetchImpl: driveResponse(
      { error: { code: 403, message: "Request had insufficient authentication scopes for token ya29.LEAK" } },
      403,
    ),
  });
  assert.ok(!result.ok);
  if (!result.ok) {
    assert.ok(!result.reason.includes("ya29"), "no token material in a reason");
    assert.ok(!result.reason.includes("SECRET"), "no request token in a reason");
    assert.ok(!/insufficient authentication scopes/i.test(result.reason), "no provider prose in a reason");
  }
}

async function main(): Promise<void> {
  theCapabilityIsNarrow();
  await identityOnlyGrantIsNotDriveAccess();
  await theGrantedScopeMakesItAvailable();
  await removingTheScopeStopsTheClaim();
  await noWriteIsEverClaimed();
  await lifecycleAndHealthStillGate();
  theUpgradeRequestIsClosed();
  await theListingIsNormalizedAndBounded();
  await transportFailuresAreNeverAuth();
  await aScopeGapIsClassifiedAsScope();
  await aDisabledApiIsNotAnAuthFailure();
  await failureReasonsCarryNothing();
  console.log("int4-google-drive-metadata/capability-and-seam: all assertions passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
