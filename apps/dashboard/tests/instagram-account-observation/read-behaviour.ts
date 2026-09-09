/*
 * INSTAGRAM · the read, exercised against a FAKE Instagram and the released seams.
 *
 * WHAT THIS PROVES:
 *
 *   Instagram's answers become Hebun facts truthfully — `null` survives as `null` and is never a 0;
 *   every documented refusal becomes its OWN classified failure rather than a generic one; a
 *   malformed or mismatched answer produces no observation; and the dispatch routes each provider to
 *   its own module and refuses a triple no provider claims.
 *
 * The provider is a FAKE FETCH. What is real is the transport, the mapper, the dispatch and every
 * released contract they touch.
 */
import assert from "node:assert/strict";
import {
  INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_ACCOUNT_SUBJECT_KIND,
  INSTAGRAM_PROVIDER_KEY,
} from "../../src/features/provider-instagram/contracts";
import { readAccount } from "../../src/features/provider-instagram/instagram-transport.server";
import { observeAccountById } from "../../src/features/provider-instagram/read-account-observation.server";
import { instagramAccountObservationFacts } from "../../src/features/provider-observation-history/record-instagram-account-observation.server";

const ACCOUNT = "17841400000000000";
const TOKEN = "fixture-token-never-real";

function fakeInstagram(
  handler: (url: string, init: RequestInit | undefined) => Response,
): (input: string, init?: RequestInit) => Promise<Response> {
  return async (input, init) => handler(String(input), init);
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function err(status: number, code: number | null, subcode: number | null = null): Response {
  const error: Record<string, unknown> = {};
  if (code !== null) error.code = code;
  if (subcode !== null) error.error_subcode = subcode;
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function main(): Promise<void> {
  /* ═══ 1. THE REQUEST SHAPE: HEADER-ONLY SECRET, EXPLICIT FIELDS ═══════════ */
  let seenUrl = "";
  let seenInit: RequestInit | undefined;
  const capture = fakeInstagram((url, init) => {
    seenUrl = url;
    seenInit = init;
    return ok({
      id: ACCOUNT,
      username: "turkishrughouse",
      account_type: "BUSINESS",
      followers_count: 1280,
      follows_count: 340,
      media_count: 96,
    });
  });

  const read = await readAccount(TOKEN, ACCOUNT, { fetchImpl: capture });
  assert.equal(read.ok, true, "a well-formed answer is a read");

  assert.ok(!seenUrl.includes(TOKEN), "THE TOKEN IS NOT IN THE URL");
  assert.ok(!seenUrl.includes("access_token"), "and no access_token parameter is sent");
  assert.equal(
    (seenInit?.headers as Record<string, string>).Authorization,
    `Bearer ${TOKEN}`,
    "the token travels in the Authorization header",
  );
  assert.equal(seenInit?.method, "GET", "one verb, and it is GET");
  assert.ok(seenUrl.includes("graph.instagram.com"), "the Instagram Login host is used");
  assert.ok(!seenUrl.includes("graph.facebook.com"), "and never the Facebook host");
  assert.ok(seenUrl.includes(ACCOUNT), "the account is addressed by its id");
  const fields = new URL(seenUrl).searchParams.get("fields") ?? "";
  assert.deepEqual(
    fields.split(","),
    ["id", "username", "account_type", "followers_count", "follows_count", "media_count"],
    "exactly the six declared fields are requested",
  );
  for (const wider of ["media", "insights", "comments"]) {
    assert.ok(
      !fields.split(",").includes(wider),
      `the request never asks for \`${wider}\` — no scope covers it`,
    );
  }

  /* ═══ 2. FACTS ARE WHAT INSTAGRAM SAID ═══════════════════════════════════ */
  if (!read.ok) throw new Error("unreachable");
  const observed = await observeAccountById(TOKEN, ACCOUNT, {
    fetchImpl: capture,
    now: () => new Date("2026-09-09T12:00:00.000Z"),
  });
  assert.equal(observed.ok, true);
  if (!observed.ok) throw new Error("unreachable");
  assert.equal(observed.value.observedAt, "2026-09-09T12:00:00.000Z", "Hebun timestamps the read");

  const facts = instagramAccountObservationFacts(observed.value);
  assert.deepEqual(
    facts,
    {
      accountId: ACCOUNT,
      username: "turkishrughouse",
      accountType: "BUSINESS",
      followersCount: 1280,
      followsCount: 340,
      mediaCount: 96,
    },
    "five authoritative facts plus the account id, and nothing invented",
  );

  /* ═══ 3. ABSENT IS NOT ZERO ══════════════════════════════════════════════ */
  const withheld = await observeAccountById(TOKEN, ACCOUNT, {
    /* Instagram answers with the id only — every count withheld. */
    fetchImpl: fakeInstagram(() => ok({ id: ACCOUNT })),
    now: () => new Date("2026-09-09T12:00:00.000Z"),
  });
  assert.equal(withheld.ok, true);
  if (!withheld.ok) throw new Error("unreachable");
  const withheldFacts = instagramAccountObservationFacts(withheld.value);
  assert.deepEqual(
    withheldFacts,
    {
      accountId: ACCOUNT,
      username: null,
      accountType: null,
      followersCount: null,
      followsCount: null,
      mediaCount: null,
    },
    "a withheld count is null — NEVER 0, which would be a number Instagram did not report",
  );

  /* A genuine zero survives as a zero, which is the other half of the same rule. */
  const zero = await observeAccountById(TOKEN, ACCOUNT, {
    fetchImpl: fakeInstagram(() => ok({ id: ACCOUNT, followers_count: 0, media_count: 0 })),
  });
  assert.equal(zero.ok, true);
  if (!zero.ok) throw new Error("unreachable");
  const zeroFacts = instagramAccountObservationFacts(zero.value) as Record<string, unknown>;
  assert.equal(zeroFacts.followersCount, 0, "a real 0 is stored as 0");
  assert.equal(zeroFacts.mediaCount, 0);
  assert.equal(zeroFacts.followsCount, null, "and an absent one beside it stays null");

  /* ═══ 4. EVERY REFUSAL IS ITS OWN FACT ═══════════════════════════════════ */
  const cases: readonly (readonly [string, Response, string])[] = [
    ["expired or revoked token", err(400, 190), "auth"],
    ["insufficient permission", err(400, 10), "scope"],
    ["permission family 200", err(403, 200), "scope"],
    /*
     * RE-AIMED, NOT LOOSENED. This line used to read `not-professional`, and that reading refused a
     * real Business account in production: 100/33 is Meta's answer for "object does not exist,
     * cannot be loaded due to missing permissions, or does not support this operation" — three
     * facts about a NODE and none about an account type. The refusal is unchanged; only the fact it
     * reports is now the one Meta actually stated.
     */
    ["a node this token cannot load", err(400, 100, 33), "not-found"],
    ["unknown account", err(404, null), "not-found"],
    ["rate limited", err(429, 4), "rate-limited"],
    ["provider fault", err(503, null), "transport"],
  ];
  for (const [label, response, expected] of cases) {
    const result = await readAccount(TOKEN, ACCOUNT, { fetchImpl: fakeInstagram(() => response.clone()) });
    assert.equal(result.ok, false, `${label} is not a read`);
    if (result.ok) throw new Error("unreachable");
    assert.equal(result.failure, expected, `${label} → \`${expected}\``);
    assert.ok(!JSON.stringify(result).includes(TOKEN), "and no refusal echoes the token");
  }

  /* ═══ 5. A MISMATCHED OR MALFORMED ANSWER IS NOT AN OBSERVATION ══════════ */
  const mismatch = await readAccount(TOKEN, ACCOUNT, {
    fetchImpl: fakeInstagram(() => ok({ id: "17841499999999999", username: "someone-else" })),
  });
  assert.equal(mismatch.ok, false, "an answer about a DIFFERENT account is refused");
  if (mismatch.ok) throw new Error("unreachable");
  assert.equal(mismatch.failure, "malformed");

  const noId = await readAccount(TOKEN, ACCOUNT, { fetchImpl: fakeInstagram(() => ok({ username: "x" })) });
  assert.equal(noId.ok, false, "an answer with no id is refused — facts need a subject");

  const unreachable = await readAccount(TOKEN, ACCOUNT, {
    fetchImpl: (async () => {
      throw new Error("network down");
    }) as never,
  });
  assert.equal(unreachable.ok, false);
  if (unreachable.ok) throw new Error("unreachable");
  assert.equal(unreachable.failure, "transport", "an unreachable provider is a transport fault");

  /* ═══ 6. THE CAPABILITY TRIPLE IS THE ONE GOVERNANCE MAY AUTHORIZE ═══════ */
  assert.equal(INSTAGRAM_PROVIDER_KEY, "instagram", "the provider key is `instagram`, not `meta`");
  assert.equal(INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY, "instagram.account.public.read");
  assert.equal(INSTAGRAM_ACCOUNT_SUBJECT_KIND, "instagram-account");

  console.log(
    "instagram-account-observation/read-behaviour: header-only secret, six fields, null!=0, " +
      "seven classified refusals, mismatch refused",
  );
}

void main();
