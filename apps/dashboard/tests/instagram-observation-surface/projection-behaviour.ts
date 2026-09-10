/*
 * INSTAGRAM · the dashboard's observation projection, exercised against the read seam's own shapes.
 *
 * WHAT THIS PROVES:
 *
 *   1. A stored observation reaches the surface as VALUES + THE INSTANT, together.
 *   2. `null` survives as "not reported" and is NEVER rendered as 0.
 *   3. Zero survives as 0 and is never rendered as "not reported".
 *   4. NO PROVENANCE IDENTIFIER reaches the view — not the observation id, the connection, the
 *      standing authorization or the invocation.
 *   5. An empty read and an unavailable read are DIFFERENT answers with different sentences, and
 *      neither is said as the other.
 *   6. Every fact is treated as untrusted external data: a shape a provider chose can never become
 *      anything but text or a number by the time a component sees it.
 *   7. NOTHING IS DERIVED. No delta, no rate, no trend, no verdict about the instant.
 *
 * Pure: no database, no network, no provider, no credential.
 */
import assert from "node:assert/strict";
import {
  describeInstagramObservation,
  projectLatestInstagramObservation,
  INSTAGRAM_OBSERVATION_ABSENCE,
  INSTAGRAM_OBSERVATION_UNREPORTED,
  type InstagramObservationView,
} from "../../src/features/instagram-connection-surface/latest-observation";
import type { ObservationFacts, StoredProviderObservation } from "../../src/features/provider-observation-history/contracts";
import type { ProviderObservationReadResult } from "../../src/features/provider-observation-history/read-provider-observations.server";
import { INSTAGRAM_PROVIDER_KEY, INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY, INSTAGRAM_ACCOUNT_SUBJECT_KIND } from "../../src/features/provider-instagram/contracts";

/** Values a real row carries, so the test cannot accidentally prove something about a fixture. */
const OBSERVATION_ID = "11111111-1111-4111-8111-111111111111";
const INTEGRATION_ID = "22222222-2222-4222-8222-222222222222";
const AUTHORIZATION_ID = "33333333-3333-4333-8333-333333333333";
const INVOCATION_ID = "44444444-4444-4444-8444-444444444444";
const ACCOUNT_ID = "17841400000000000";
const OBSERVED_AT = "2026-09-09T10:00:20.000Z";

function stored(facts: ObservationFacts): StoredProviderObservation {
  return Object.freeze({
    observationId: OBSERVATION_ID,
    providerKey: INSTAGRAM_PROVIDER_KEY,
    capabilityKey: INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
    subjectKind: INSTAGRAM_ACCOUNT_SUBJECT_KIND,
    subjectRef: `instagram/account/${ACCOUNT_ID}`,
    integrationId: INTEGRATION_ID,
    observedAt: OBSERVED_AT,
    recordedAt: "2026-09-09T10:00:21.000Z",
    provenance: "standing-authorization" as const,
    observedByActorType: null,
    standingAuthorizationId: AUTHORIZATION_ID,
    invocationId: INVOCATION_ID,
    facts,
  });
}

function readOf(...observations: readonly StoredProviderObservation[]): ProviderObservationReadResult {
  return { status: "read", observations };
}

function main(): void {
  /* ═══ 1. VALUES AND THE INSTANT ARRIVE AS ONE ═════════════════════════════ */
  const complete = projectLatestInstagramObservation(
    readOf(
      stored({
        accountId: ACCOUNT_ID,
        username: "turkishrughouse",
        accountType: "BUSINESS",
        followersCount: 412,
        followsCount: 87,
        mediaCount: 0,
      }),
    ),
  );
  assert.equal(complete.status, "observed", "a stored observation is shown");
  if (complete.status !== "observed") return;
  assert.equal(complete.observation.observedAt, OBSERVED_AT, "the instant is the stored instant");
  assert.equal(complete.observation.username, "turkishrughouse");
  assert.equal(complete.observation.accountType, "BUSINESS");
  assert.equal(complete.observation.followersCount, 412);
  assert.equal(complete.observation.followsCount, 87);

  /* ═══ 3. ZERO IS ZERO ═════════════════════════════════════════════════════ */
  assert.equal(complete.observation.mediaCount, 0, "a real zero survives as zero");
  const zeroRow = describeInstagramObservation(complete.observation).find((r) =>
    r.label.startsWith("Media"),
  );
  assert.equal(zeroRow?.value, "0", "and zero is rendered as 0, never as `not reported`");

  /* ═══ 4. NO PROVENANCE IDENTIFIER REACHES THE VIEW ════════════════════════ */
  assert.deepEqual(
    Object.keys(complete.observation).sort(),
    ["accountType", "followersCount", "followsCount", "mediaCount", "observedAt", "username"],
    "the view carries exactly what Instagram said, plus the instant",
  );
  const rendered = JSON.stringify(complete.observation) + JSON.stringify(describeInstagramObservation(complete.observation));
  for (const secret of [OBSERVATION_ID, INTEGRATION_ID, AUTHORIZATION_ID, INVOCATION_ID, ACCOUNT_ID]) {
    assert.ok(!rendered.includes(secret), `the surface never carries \`${secret}\``);
  }

  /* ═══ 2. `null` IS NOT ZERO, ALL THE WAY TO THE SCREEN ════════════════════ */
  const withheld = projectLatestInstagramObservation(
    readOf(
      stored({
        accountId: ACCOUNT_ID,
        username: null,
        accountType: null,
        followersCount: null,
        followsCount: null,
        mediaCount: null,
      }),
    ),
  );
  assert.equal(withheld.status, "observed");
  if (withheld.status !== "observed") return;
  const withheldRows = describeInstagramObservation(withheld.observation);
  assert.equal(withheldRows.length, 5, "five rows, one per fact Instagram may report");
  for (const row of withheldRows) {
    assert.equal(row.value, INSTAGRAM_OBSERVATION_UNREPORTED, `\`${row.label}\` says it was withheld`);
    assert.ok(!/^0$/.test(row.value), "and a withheld count is never shown as 0");
  }

  /* ═══ 6. EVERY FACT IS UNTRUSTED EXTERNAL DATA ════════════════════════════ */
  const hostile = projectLatestInstagramObservation(
    readOf(
      stored({
        accountId: ACCOUNT_ID,
        /* A shape a provider chose. It must not decide how this page renders. */
        username: ["<img src=x onerror=alert(1)>"] as unknown as string,
        accountType: true as unknown as string,
        followersCount: "1000000" as unknown as number,
        followsCount: Number.NaN,
        mediaCount: [1, 2, 3] as unknown as number,
      }),
    ),
  );
  assert.equal(hostile.status, "observed");
  if (hostile.status !== "observed") return;
  const view: InstagramObservationView = hostile.observation;
  assert.equal(view.username, null, "an array is not text");
  assert.equal(view.accountType, null, "a boolean is not text");
  assert.equal(view.followersCount, null, "a numeric STRING is not a count");
  assert.equal(view.followsCount, null, "NaN is not a count");
  assert.equal(view.mediaCount, null, "an array is not a count");
  for (const row of describeInstagramObservation(view)) {
    assert.equal(typeof row.value, "string", "a component is only ever handed text");
    assert.equal(row.value, INSTAGRAM_OBSERVATION_UNREPORTED);
  }
  /*
   * A TEXT FACT IS CARRIED VERBATIM AND IS NOT SANITIZED HERE. React escapes it at the one place
   * it becomes a document; a second escaping in this module would corrupt a legitimate username
   * while proving nothing. What matters is that it stays a STRING.
   */
  const literal = projectLatestInstagramObservation(
    readOf(stored({ username: "<b>not markup</b>", accountType: "BUSINESS" })),
  );
  assert.equal(literal.status, "observed");
  if (literal.status !== "observed") return;
  assert.equal(literal.observation.username, "<b>not markup</b>", "provider text is carried as data");

  /* ═══ 5. EMPTY AND UNAVAILABLE ARE DIFFERENT ANSWERS ══════════════════════ */
  assert.deepEqual(projectLatestInstagramObservation(readOf()), { status: "none" });
  assert.deepEqual(
    projectLatestInstagramObservation({ status: "unavailable", reason: "unauthenticated" }),
    { status: "unavailable", reason: "unauthenticated" },
  );
  assert.deepEqual(
    projectLatestInstagramObservation({ status: "unavailable", reason: "persistence-unavailable" }),
    { status: "unavailable", reason: "persistence-unavailable" },
  );
  const sentences = [
    INSTAGRAM_OBSERVATION_ABSENCE.none,
    INSTAGRAM_OBSERVATION_ABSENCE.unauthenticated,
    INSTAGRAM_OBSERVATION_ABSENCE["persistence-unavailable"],
  ];
  assert.equal(new Set(sentences).size, 3, "three different facts are said three different ways");
  /* The absence sentence never blames Instagram, and the unavailable ones never claim an absence. */
  assert.ok(
    !/instagram (has|had) no|instagram is unavailable|observation failed/i.test(sentences.join(" ")),
    "no absence sentence blames the provider or invents a failure",
  );
  for (const admission of [
    INSTAGRAM_OBSERVATION_ABSENCE.unauthenticated,
    INSTAGRAM_OBSERVATION_ABSENCE["persistence-unavailable"],
  ]) {
    assert.ok(/unknown/i.test(admission), "an unavailable read is said as ignorance, not absence");
  }

  /* ═══ 7. THE NEWEST IS THE FIRST, AND NOTHING IS DERIVED ══════════════════ */
  const first = stored({ followersCount: 500 });
  const second = stored({ followersCount: 400 });
  const pair = projectLatestInstagramObservation(readOf(first, second));
  assert.equal(pair.status, "observed");
  if (pair.status !== "observed") return;
  assert.equal(pair.observation.followersCount, 500, "the seam's ordering is honoured, not redone");
  const rowsOfPair = describeInstagramObservation(pair.observation);
  assert.ok(
    rowsOfPair.every((row) => !/\+|-|%|since|change/i.test(row.value)),
    "two rows produce no comparison — this consumer subtracts nothing",
  );

  console.log(
    "instagram-observation-surface/projection-behaviour: value+instant together, null!=0, 0!=null, " +
      "no provenance id, empty!=unavailable, provider facts are data, nothing derived",
  );
}

main();
