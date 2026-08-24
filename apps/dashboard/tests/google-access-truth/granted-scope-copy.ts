/*
 * Google access copy — WHAT THE PAGE MAY SAY THE TENANT GRANTED.
 *
 * ── THE ONE SENTENCE THIS SUITE DEFENDS ─────────────────────────────────────
 *
 *   THE ACCESS DESCRIPTION IS DERIVED FROM THE GRANT, NEVER FROM THE LIFECYCLE.
 *
 * `GOOGLE_STATE_SENTENCES` is keyed by lifecycle state, which knows nothing about scopes. Its
 * `connected` entry once read "Identity only — no Drive, Calendar or directory access", which was
 * true while identity was the only obtainable grant and became FALSE in production the moment a
 * tenant upgraded to Drive metadata — while the same page rendered `drive.metadata.readonly` in its
 * own scope list. A lifecycle sentence cannot see the grant, so it may not describe the grant.
 *
 * Every assertion below exists so that "Google is connected" can never again carry a claim about
 * what Google permitted, in either direction: not a denial that outlives the grant, and not an
 * overstatement that outruns it.
 */
import assert from "node:assert/strict";

import {
  GOOGLE_STATE_SENTENCES,
  buildGoogleConnectionModel,
  describeGoogleGrantedAccess,
} from "../../src/features/google-connection-surface/model";
import {
  GOOGLE_DRIVE_METADATA_SCOPE,
  GOOGLE_PROVIDER_KEY,
  GOOGLE_REQUIRED_GRANTED_SCOPES,
} from "../../src/features/provider-google/contracts";
import type { IntegrationView } from "../../src/features/integration-authority/contracts";

const IDENTITY_SCOPES = [...GOOGLE_REQUIRED_GRANTED_SCOPES];

/* The four scopes production actually holds, in the order Google returned them. */
const PRODUCTION_SCOPES = [
  GOOGLE_DRIVE_METADATA_SCOPE,
  "openid",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
];

function connection(over: Partial<IntegrationView> = {}): IntegrationView {
  return {
    integrationId: "11111111-1111-1111-1111-111111111111",
    name: "Google Workspace",
    providerKey: GOOGLE_PROVIDER_KEY,
    connectionState: "connected",
    health: "healthy",
    scopes: IDENTITY_SCOPES,
    externalAccountId: "sub-1",
    externalAccountLabel: "someone@example.com",
    lastVerifiedAt: "2026-08-24T06:28:38.885Z",
    lastSuccessAt: "2026-08-24T06:28:38.885Z",
    lastErrorAt: null,
    failureReason: null,
    revokedAt: null,
    createdAt: "2026-08-24T01:19:11.446Z",
    ...over,
  };
}

/** Everything a human reads for one connection: the lifecycle sentence plus the access lines. */
function rendered(view: IntegrationView): string {
  const model = buildGoogleConnectionModel([view], true);
  return [
    GOOGLE_STATE_SENTENCES[model.state],
    ...(model.grantedScopes.length > 0 ? describeGoogleGrantedAccess(model.grantedScopes) : []),
  ].join(" ");
}

const DRIVE_CONTENT_CLAIMS = [
  /\bdownload/i,
  /file contents? (?:can be|is|are) read/i,
  /read (?:your |the )?files?\b/i,
  /full drive/i,
];
const DRIVE_WRITE_CLAIMS = [/\bwrite\b/i, /\bedit\b/i, /\bupload\b/i, /\bdelete\b/i, /\bmodify\b/i];

/* ── 1. IDENTITY ONLY MUST NOT CLAIM DRIVE ──────────────────────────────────── */
function identityOnlyClaimsNoDrive(): void {
  const copy = rendered(connection({ scopes: IDENTITY_SCOPES }));
  assert.match(copy, /Google confirmed this account\./, "the lifecycle sentence still says this");
  assert.match(copy, /Identity only/, "an identity-only grant is described as identity only");
  assert.ok(
    !/Google Drive:/.test(copy),
    "an identity-only grant must not claim any Drive access",
  );
}

/* ── 2. THE GRANTED DRIVE SCOPE IS REPORTED ─────────────────────────────────── */
function driveMetadataIsReported(): void {
  const copy = rendered(connection({ scopes: PRODUCTION_SCOPES }));
  assert.match(copy, /Google Drive:/, "a granted Drive metadata scope is acknowledged");
  assert.ok(
    !/Identity only/.test(copy),
    "the identity-only denial must disappear the moment a broader scope is granted",
  );
  /*
   * THE REGRESSION ITSELF. The released copy carried this clause inside the `connected` lifecycle
   * sentence, so it was emitted beside a Drive grant. It may never return in any form.
   */
  assert.ok(
    !/no Drive, Calendar or directory access/i.test(copy),
    "the stale identity-only claim must not be emitted for a Drive grant",
  );
}

/* ── 3 & 4. METADATA IS NOT CONTENT, AND IS NOT WRITE ───────────────────────── */
function driveMetadataNeverClaimsContentOrWrite(): void {
  const copy = rendered(connection({ scopes: PRODUCTION_SCOPES }));

  /* The denials are stated, and stated in these exact words. */
  assert.match(copy, /No file contents can be read/i, "the content denial is stated explicitly");
  assert.match(
    copy,
    /nothing in Drive can be created, changed or deleted/i,
    "the write denial is stated explicitly",
  );

  /*
   * ── STRIP THE DENIALS BEFORE HUNTING FOR CLAIMS ───────────────────────────
   *
   * A bare pattern fails on the product's own honest denial: "No file contents can be read"
   * contains "file contents can be read", and "nothing in Drive can be created, changed or
   * deleted" contains "deleted". Written as a plain ban, both of these assertions flagged the very
   * sentences that make the copy truthful — this suite failed on exactly that before the denials
   * were removed first. What remains after the strip is the copy's positive claims, and those are
   * what may not overstate.
   */
  const claimsOnly = copy
    .replace(/No file contents can be read/gi, "")
    .replace(/nothing in Drive can be created, changed or deleted/gi, "");

  for (const claim of DRIVE_CONTENT_CLAIMS) {
    assert.ok(
      !claim.test(claimsOnly),
      `Drive metadata must not claim file content access: ${claim}`,
    );
  }
  for (const claim of DRIVE_WRITE_CLAIMS) {
    assert.ok(!claim.test(claimsOnly), `Drive metadata must not claim write access: ${claim}`);
  }
}

/* ── 5 & 6. CALENDAR AND DIRECTORY ARE NEVER CLAIMED WITHOUT A SCOPE ────────── */
function absentScopesAreNeverClaimed(): void {
  for (const scopes of [IDENTITY_SCOPES, PRODUCTION_SCOPES]) {
    const copy = rendered(connection({ scopes }));
    assert.ok(
      !/Google Calendar:/.test(copy) && !/Calendar access is granted/i.test(copy),
      "Calendar is never claimed — no Calendar scope is granted",
    );
    assert.ok(
      !/directory access is granted/i.test(copy) && !/Admin SDK/i.test(copy),
      "directory/admin is never claimed — no such scope is granted",
    );
  }
}

/* ── 7. A CATALOG CAPABILITY IS NOT A GRANT ─────────────────────────────────── */
function catalogCapabilityIsNotGrantedAccess(): void {
  /*
   * The provider catalog declares Drive metadata for EVERY Google connection ever made. If the
   * description read the catalog instead of the grant, this identity-only connection would claim
   * Drive. It reads `grantedScopes`, so it cannot.
   */
  const copy = rendered(connection({ scopes: IDENTITY_SCOPES }));
  assert.ok(!/Google Drive:/.test(copy), "a catalog capability must not read as granted access");

  /* The function takes the grant and nothing else — no connection, no catalog, no credential. */
  assert.equal(describeGoogleGrantedAccess.length, 1, "the grant is the only input");
  assert.deepEqual(
    describeGoogleGrantedAccess([]),
    ["Identity only. Google granted no Drive, Calendar or directory access."],
    "an empty grant claims nothing",
  );
}

/* ── 8. CONNECTED, BY ITSELF, IMPLIES NOTHING BEYOND IDENTITY ───────────────── */
function connectedAloneImpliesNoCapability(): void {
  const sentence = GOOGLE_STATE_SENTENCES.connected;
  assert.equal(sentence, "Google confirmed this account.", "lifecycle says lifecycle, and no more");
  for (const forbidden of [/Drive/i, /Calendar/i, /director/i, /Identity only/i, /scope/i]) {
    assert.ok(
      !forbidden.test(sentence),
      `the connected lifecycle sentence must not mention access: ${forbidden}`,
    );
  }
}

/* ── 9. THE OTHER LIFECYCLE STATES ARE UNCHANGED AND STILL TRUTHFUL ─────────── */
function otherLifecycleStatesRemainTruthful(): void {
  assert.equal(
    GOOGLE_STATE_SENTENCES.unverified,
    "An authorization was recorded but Google has not confirmed it, so nothing is connected yet.",
  );
  assert.equal(
    GOOGLE_STATE_SENTENCES["not-connected"],
    "No Google account is connected for this organization.",
  );
  assert.match(GOOGLE_STATE_SENTENCES.degraded, /^Google is not answering right now\./);
  assert.match(GOOGLE_STATE_SENTENCES.ended, /^This connection was ended\./);

  /* A degraded connection keeps its grant, so the access lines still describe it honestly. */
  const degraded = rendered(connection({ health: "unreachable", scopes: PRODUCTION_SCOPES }));
  assert.match(degraded, /Google is not answering right now\./, "health is reported as health");
  assert.match(degraded, /Google Drive:/, "an unanswered provider has not taken the grant away");

  /* An unverified connection has no grant to describe, and must not borrow one. */
  const unverified = rendered(connection({ connectionState: "draft", scopes: [] }));
  assert.match(unverified, /has not confirmed it/, "a draft is reported as unconfirmed");
  assert.ok(!/Google Drive:/.test(unverified), "a draft claims no access");
  assert.ok(!/Identity only/.test(unverified), "with no grant at all, nothing is described");

  /* An ended connection is ended, whatever it once held. */
  const ended = rendered(connection({ connectionState: "revoked", scopes: [] }));
  assert.match(ended, /This connection was ended\./);
  assert.ok(!/Google Drive:/.test(ended), "an ended connection claims no access");
}

/* ── 10. AN UNRECOGNIZED GRANT IS REPORTED, NOT SILENTLY CALLED IDENTITY ────── */
function anUnrecognizedScopeIsNeverSilentlyDenied(): void {
  const copy = describeGoogleGrantedAccess([
    ...IDENTITY_SCOPES,
    "https://www.googleapis.com/auth/some.future.scope",
  ]).join(" ");
  assert.ok(
    !/Identity only/.test(copy),
    "a grant carrying something unrecognized is not identity only",
  );
  assert.match(copy, /cannot describe/, "an undescribed grant says so rather than denying it");
}

async function main(): Promise<void> {
  identityOnlyClaimsNoDrive();
  driveMetadataIsReported();
  driveMetadataNeverClaimsContentOrWrite();
  absentScopesAreNeverClaimed();
  catalogCapabilityIsNotGrantedAccess();
  connectedAloneImpliesNoCapability();
  otherLifecycleStatesRemainTruthful();
  anUnrecognizedScopeIsNeverSilentlyDenied();
  console.log("google-access-truth/granted-scope-copy: all assertions passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
