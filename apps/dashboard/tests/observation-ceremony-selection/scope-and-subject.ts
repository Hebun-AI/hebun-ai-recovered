/*
 * OBSERVATION CEREMONIES · which scope, and whose subject.
 *
 * The standing-observation authority was provider-agnostic from the day it was written. The
 * CEREMONIES were not: they named YouTube in their source, so a second observable provider existed
 * that no operator could authorize or observe. These assertions cover the seam that fixed that, and
 * the properties that must survive it.
 *
 * WHAT THIS FILE REFUSES TO LET HAPPEN:
 *
 *   1. A CEREMONY THAT CHOOSES. Ambiguity fails closed, with no first-match anywhere.
 *   2. A SUBJECT FROM NOWHERE. An account-identity subject comes from a connection the provider
 *      confirmed AND that is presently working.
 *   3. A SECOND AUTHORITY. The selection helper writes nothing and executes nothing.
 *   4. A YOUTUBE REGRESSION. Its default, its subject source and its refusals are unchanged.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  resolveObservableScope,
  subjectFromConnection,
  subjectSourceFor,
  type ConnectionRow,
} from "../../scripts/lib/observable-scope";
import { OBSERVABLE_CAPABILITIES } from "../../src/features/standing-observation-authority/contracts";
import {
  INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_ACCOUNT_SUBJECT_KIND,
  INSTAGRAM_PROVIDER_KEY,
  INSTAGRAM_SUBJECT_PREFIX,
} from "../../src/features/provider-instagram/contracts";
import {
  YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
  YOUTUBE_PROVIDER_KEY,
} from "../../src/features/provider-youtube/contracts";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const HELPER = "scripts/lib/observable-scope.ts";
const AUTHORIZE = "scripts/trh23-authorize-standing-observation.ts";
const OBSERVE = "scripts/trh24-observe-once.ts";

const ACCOUNT = "28290000000000000";
const connection = (over: Partial<ConnectionRow> = {}): ConnectionRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  connection_state: "connected",
  health: "healthy",
  external_account_id: ACCOUNT,
  ...over,
});

function main(): void {
  /* ═══ 1. THE SCOPE COMES FROM THE AUTHORITY'S ELIGIBILITY LIST ════════════ */
  const yt = resolveObservableScope(YOUTUBE_PROVIDER_KEY);
  assert.ok(yt.ok, "YouTube resolves");
  assert.equal(yt.ok && yt.scope.capabilityKey, YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY);
  assert.equal(yt.ok && yt.scope.subjectKind, "youtube-channel");

  const ig = resolveObservableScope(INSTAGRAM_PROVIDER_KEY);
  assert.ok(ig.ok, "Instagram resolves");
  assert.equal(ig.ok && ig.scope.capabilityKey, INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY);
  assert.equal(ig.ok && ig.scope.subjectKind, INSTAGRAM_ACCOUNT_SUBJECT_KIND);

  /* A provider the AUTHORITY has not declared observable is refused, whatever the catalog says. */
  for (const unsupported of ["google-workspace", "github-organization", "meta", "", "instagram "]) {
    const r = resolveObservableScope(unsupported);
    assert.ok(!r.ok, `"${unsupported}" is not observable`);
    assert.ok(r.ok || r.reason.includes("no observable capability"), "and the refusal says why");
  }
  /* The ceremony can never reach a scope the authority did not declare. */
  assert.equal(
    OBSERVABLE_CAPABILITIES.length,
    2,
    "two observable scopes exist; a third is a code change in the authority, not in a ceremony",
  );

  /* ═══ 2. WHICH SHAPE — READ OFF THE RELEASED CATALOG ══════════════════════ */
  assert.equal(subjectSourceFor(INSTAGRAM_PROVIDER_KEY), "connection", "an account-bound connection IS the subject");
  assert.equal(subjectSourceFor(YOUTUBE_PROVIDER_KEY), "observation", "a key-only connection binds no account");
  assert.equal(subjectSourceFor("not-a-provider"), null, "an undeclared provider has no shape");

  /* ═══ 3. THE INSTAGRAM SUBJECT IS THE ACCOUNT THE PROVIDER CONFIRMED ══════ */
  const good = subjectFromConnection(INSTAGRAM_ACCOUNT_SUBJECT_KIND, connection());
  assert.ok(good.ok, "a verified, healthy, account-bearing connection yields a subject");
  assert.equal(
    good.ok && good.subjectRef,
    `${INSTAGRAM_SUBJECT_PREFIX}${ACCOUNT}`,
    "and it is the canonical reference the provider's own contracts declare",
  );

  /*
   * FAIL CLOSED ON EVERY LESSER STATE. Authorizing recurring reads against a connection Hebun has
   * not just proved is the claim this repository refuses to make.
   */
  for (const [label, row] of [
    ["draft", connection({ connection_state: "draft" })],
    ["unverified", connection({ connection_state: "unverified" })],
    ["expired", connection({ connection_state: "expired" })],
    ["disconnected", connection({ connection_state: "disconnected" })],
    ["revoked", connection({ connection_state: "revoked" })],
    ["no state", connection({ connection_state: null })],
  ] as const) {
    const r = subjectFromConnection(INSTAGRAM_ACCOUNT_SUBJECT_KIND, row);
    assert.ok(!r.ok, `a ${label} connection yields NO subject`);
    assert.ok(r.ok || r.reason.includes("not connected"), "and says it is not connected");
  }
  for (const [label, row] of [
    ["degraded", connection({ health: "degraded" })],
    ["unknown", connection({ health: "unknown" })],
    ["absent", connection({ health: null })],
  ] as const) {
    const r = subjectFromConnection(INSTAGRAM_ACCOUNT_SUBJECT_KIND, row);
    assert.ok(!r.ok, `a ${label}-health connection yields NO subject`);
    assert.ok(r.ok || r.reason.includes("not healthy"), "and says it is not healthy");
  }
  /* A connected, healthy connection that names no account is still not a subject. */
  for (const missing of [null, ""]) {
    const r = subjectFromConnection(INSTAGRAM_ACCOUNT_SUBJECT_KIND, connection({ external_account_id: missing }));
    assert.ok(!r.ok, "no external account id, no subject");
    assert.ok(r.ok || r.reason.includes("names no external account"), "and it says so");
  }
  /* A subject kind with no declared prefix is refused rather than guessed. */
  const noPrefix = subjectFromConnection("youtube-channel", connection());
  assert.ok(!noPrefix.ok && noPrefix.reason.includes("no canonical subject prefix"),
    "a kind whose owner declares no prefix cannot be assembled here");

  /* ═══ 4. THE HELPER IS NOT AN AUTHORITY ══════════════════════════════════ */
  const helper = codeOf(read(HELPER));
  for (const banned of [
    "insert into", "INSERT INTO", "update ", "UPDATE ", "delete from", "DELETE FROM",
    "authorizeStandingObservation", "observeOnceUnderAuthorization", "mintObservationPrincipal",
    "withConnectionScopedSecret", "withDecryptedSecret", "fetch(", "globalThis.fetch",
    "recordVerifiedConnectionWithin", "storeCredential",
  ]) {
    assert.ok(!helper.includes(banned), `the selection helper contains no \`${banned}\``);
  }
  assert.ok(helper.includes("select id, connection_state"), "it reads the connection row");
  assert.ok(helper.includes("select subject_kind, subject_ref"), "and the observation history");
  /* It spells no provider vocabulary of its own beyond the prefix map's declared owner. */
  assert.ok(
    !helper.includes('"youtube"') && !helper.includes('"instagram"'),
    "no provider key is spelled here — every name comes from its owner",
  );

  /* ═══ 5. THE CEREMONIES ══════════════════════════════════════════════════ */
  const authorize = codeOf(read(AUTHORIZE));
  /* YOUTUBE REMAINS THE DEFAULT, so every released invocation means what it always meant. */
  assert.ok(
    /arg\("provider"\)\s*\?\?\s*YOUTUBE_PROVIDER_KEY/.test(authorize),
    "the authorize ceremony defaults to YouTube",
  );
  assert.ok(
    authorize.includes("resolveObservableScope(providerKey)"),
    "and resolves capability and subject kind from the authority's list",
  );
  assert.ok(
    !authorize.includes("YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY"),
    "no capability is hard-coded any more",
  );
  assert.ok(
    authorize.includes("authorizeStandingObservation(tenant,"),
    "and the SAME released authority still performs the act",
  );
  for (const banned of ["insert into", "INSERT INTO", "update integrations", "delete from"]) {
    assert.ok(!authorize.includes(banned), `the ceremony writes nothing itself (\`${banned}\`)`);
  }

  const observe = codeOf(read(OBSERVE));
  /* AMBIGUITY STILL FAILS CLOSED — the refusal is kept, not replaced by a choice. */
  assert.ok(
    observe.includes("will not choose between them"),
    "more than one candidate is still a refusal",
  );
  assert.ok(
    /if \(candidates\.length > 1\) \{[\s\S]{0,200}fail\(/.test(observe),
    "and that refusal is what happens on ambiguity",
  );
  assert.ok(
    !/candidates\[0\]!?\s*;?\s*$/m.test(observe.split("if (candidates.length > 1)")[0] ?? ""),
    "nothing selects a candidate before the ambiguity check",
  );
  assert.ok(
    observe.includes("observeOnceUnderAuthorization(authorization.authorizationId)"),
    "the runtime is handed an explicit authorization id — the ceremony passes no scope of its own",
  );
  assert.equal(
    (observe.match(/observeOnceUnderAuthorization\(/g) ?? []).length,
    1,
    "and there is exactly one execution site",
  );
  /* Both filters narrow a list the AUTHORITY produced for this tenant — never a query of their own. */
  assert.ok(
    observe.includes("listEffectiveStandingObservations(scopeTenant)"),
    "the candidate list comes from the released reader, scoped to the tenant",
  );
  for (const narrowing of ['candidates.filter((r) => r.providerKey === wantedProvider)',
                           'candidates.filter((r) => r.authorizationId === wantedAuthorization)']) {
    assert.ok(observe.includes(narrowing), `selection narrows: ${narrowing}`);
  }
  for (const banned of ["insert into", "INSERT INTO", "delete from", "withDecryptedSecret"]) {
    assert.ok(!observe.includes(banned), `the observe ceremony gains no authority (\`${banned}\`)`);
  }

  console.log(
    "observation-ceremony-selection/scope-and-subject: scope from the authority's list, Instagram " +
      "subject from a verified healthy connection, every lesser state refused, ambiguity still " +
      "fails closed, YouTube default and subject source unchanged, no second authority",
  );
}

main();
