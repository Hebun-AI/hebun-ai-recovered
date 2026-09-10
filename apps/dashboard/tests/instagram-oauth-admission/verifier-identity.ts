/*
 * INSTAGRAM · the verifier is the identity authority, and `not-professional` is a fact about a TYPE.
 *
 * ── WHAT THIS FILE EXISTS TO PREVENT RECURRING ──────────────────────────────
 *
 * A real production ceremony refused a genuine Business account with
 * `instagram-account-not-professional`. Nothing had read `account_type`: the label came from Meta
 * error 100/33 — "object does not exist, cannot be loaded due to missing permissions, or does not
 * support this operation" — raised because Hebun asked for a node by the wrong id. Meta answers
 * `account_type: "BUSINESS"` for that same token.
 *
 * Every assertion below is aimed at one of the two defects: the id, and the label.
 *
 * The provider is a FAKE FETCH. What is real is the released transport, the released account-type
 * vocabulary and the released by-id guard.
 */
import assert from "node:assert/strict";
import {
  INSTAGRAM_ALLOWED_OPERATIONS,
  INSTAGRAM_NON_PROFESSIONAL_ACCOUNT_TYPES,
  INSTAGRAM_PROFESSIONAL_ACCOUNT_TYPES,
  classifyAccountType,
} from "../../src/features/provider-instagram/contracts";
import {
  readAccount,
  readOwnAccount,
} from "../../src/features/provider-instagram/instagram-transport.server";

/* The two ids Meta reports, and they are DIFFERENT — this is the whole bug in two constants. */
/* Both are fixtures. Neither is derived from a real account. */
const APP_SCOPED_ID = "90000000000000001";
const IG_USER_ID = "17841400000000000";
const TOKEN = "fixture-token-never-real";

const seen: string[] = [];
function fake(handler: (url: string) => Response): (i: string) => Promise<Response> {
  return async (i) => {
    seen.push(String(i));
    return handler(String(i));
  };
}
const ok = (b: unknown): Response =>
  new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
const err = (status: number, code: number, subcode: number | null): Response =>
  new Response(
    JSON.stringify({ error: { code, ...(subcode === null ? {} : { error_subcode: subcode }) } }),
    { status, headers: { "content-type": "application/json" } },
  );

const account = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: APP_SCOPED_ID,
  username: "turkishrughousecom",
  account_type: "BUSINESS",
  followers_count: 1280,
  follows_count: 340,
  media_count: 96,
  ...over,
});

async function main(): Promise<void> {
  /* ═══ 1. THE SELF-READ ASKS `/me`, AND CARRIES NO ID ═══════════════════════ */
  seen.length = 0;
  const self = await readOwnAccount(TOKEN, { fetchImpl: fake(() => ok(account())) as never });
  assert.ok(self.ok, "the self-read succeeds");
  assert.equal(seen.length, 1, "one request");
  assert.ok(seen[0]!.includes("graph.instagram.com"), "at the Instagram Login host");
  assert.ok(/\/me\?/.test(seen[0]!), "at Meta's documented `/me` node");
  for (const id of [APP_SCOPED_ID, IG_USER_ID]) {
    assert.ok(!seen[0]!.includes(id), `no account id is interpolated into the path (${id})`);
  }
  assert.ok(!seen[0]!.includes(TOKEN), "and the token is not in the URL");

  /* ── IDENTITY IS THE PROVIDER'S ANSWER: the node's own app-scoped `id`. ── */
  assert.ok(self.ok && self.value.accountId === APP_SCOPED_ID, "identity is the `/me` node's id");
  assert.ok(self.ok && self.value.username === "turkishrughousecom");
  assert.ok(self.ok && self.value.accountType === "BUSINESS");

  /*
   * THE CASE THAT BROKE PRODUCTION: the token response's `user_id` differs from `/me`'s `id`. The
   * self-read does not consult the former at all, so the difference cannot mislead it.
   */
  seen.length = 0;
  const differing = await readOwnAccount(TOKEN, {
    fetchImpl: fake(() => ok(account({ user_id: IG_USER_ID }))) as never,
  });
  assert.ok(differing.ok && differing.value.accountId === APP_SCOPED_ID, "identity is `id`, never `user_id`");
  assert.notEqual(APP_SCOPED_ID, IG_USER_ID, "the two ids are genuinely different values");

  /* ═══ 2. THE BY-ID READ IS UNCHANGED AND STILL FAILS CLOSED ═══════════════ */
  const bound = await readAccount(TOKEN, IG_USER_ID, {
    fetchImpl: fake(() => ok(account())) as never,
  });
  assert.ok(
    !bound.ok && bound.failure === "malformed" && bound.reason === "instagram-account-id-mismatch",
    "an observation read whose subject answers with a different id is REFUSED — the guard stands",
  );
  const boundOk = await readAccount(TOKEN, APP_SCOPED_ID, {
    fetchImpl: fake(() => ok(account())) as never,
  });
  assert.ok(boundOk.ok, "and the same read succeeds when the subject is the one that answers");

  /* Both operations are declared; nothing reaches an undeclared path. */
  assert.deepEqual(
    INSTAGRAM_ALLOWED_OPERATIONS.map((o) => o.id).sort(),
    ["account.media.read", "account.read", "account.read.self"],
    "exactly three operations exist: the bound read, the self read and the bound media read",
  );
  assert.deepEqual(
    INSTAGRAM_ALLOWED_OPERATIONS.map((o) => o.path).sort(),
    ["/me", "/{account-id}", "/{account-id}/media"],
    "and their paths are the documented ones",
  );

  /* ═══ 3. 100/33 IS NO LONGER A CLAIM ABOUT THE ACCOUNT ════════════════════ */
  const nodeGone = await readOwnAccount(TOKEN, { fetchImpl: fake(() => err(400, 100, 33)) as never });
  assert.ok(!nodeGone.ok, "100/33 is a refusal");
  assert.equal(
    nodeGone.ok ? "" : nodeGone.failure,
    "not-found",
    "100/33 means the NODE was unavailable — never that the account is not professional",
  );
  assert.equal(nodeGone.ok ? "" : nodeGone.reason, "instagram-node-unavailable");
  assert.notEqual(
    nodeGone.ok ? "" : nodeGone.reason,
    "instagram-account-not-professional",
    "the label that refused a real Business account cannot be produced by a node error again",
  );
  /* The other classifications are untouched. */
  for (const [status, code, subcode, expected] of [
    [400, 190, null, "auth"],
    [403, 10, null, "scope"],
    [429, 4, null, "rate-limited"],
    [500, 1, null, "transport"],
    [404, 803, null, "not-found"],
  ] as const) {
    const r = await readOwnAccount(TOKEN, { fetchImpl: fake(() => err(status, code, subcode)) as never });
    assert.equal(r.ok ? "" : r.failure, expected, `HTTP ${status}/code ${code} stays \`${expected}\``);
  }

  /* ═══ 4. ACCOUNT TYPE, NORMALIZED — AND NEVER GUESSED ═════════════════════ */
  for (const professional of [
    "BUSINESS", "Business", "business", " Business ",
    "MEDIA_CREATOR", "Media_Creator", "media creator", "Media-Creator",
    "CREATOR", "Creator",
  ]) {
    assert.equal(
      classifyAccountType(professional),
      "professional",
      `\`${professional}\` is a professional account — casing and separators are normalized`,
    );
  }
  for (const personal of ["PERSONAL", "Personal", "personal"]) {
    assert.equal(classifyAccountType(personal), "non-professional", `\`${personal}\` is not`);
  }
  /* ABSENT IS NOT PERSONAL. Nothing was claimed, so nothing is claimed back. */
  for (const unstated of [undefined, null, ""]) {
    assert.equal(classifyAccountType(unstated), "unstated", "a missing type claims nothing");
  }
  /* AND AN UNKNOWN LITERAL IS NOT SILENTLY BUSINESS. */
  for (const unknown of ["SOMETHING_NEW", "brand", 42, true, {}, ["BUSINESS"]]) {
    assert.equal(
      classifyAccountType(unknown),
      "unrecognized",
      `\`${JSON.stringify(unknown)}\` is refused rather than guessed in either direction`,
    );
  }
  /* The two vocabularies are disjoint and non-empty. */
  assert.ok(INSTAGRAM_PROFESSIONAL_ACCOUNT_TYPES.length > 0);
  for (const p of INSTAGRAM_PROFESSIONAL_ACCOUNT_TYPES) {
    assert.ok(
      !INSTAGRAM_NON_PROFESSIONAL_ACCOUNT_TYPES.includes(p),
      "no type is both professional and not",
    );
  }

  /* ═══ 5. NOTHING LEAKS ════════════════════════════════════════════════════ */
  for (const url of seen) {
    assert.ok(!url.includes(TOKEN), "no request URL carries the token");
    assert.ok(!url.includes("access_token="), "and none carries an access_token parameter");
  }

  console.log(
    "instagram-oauth-admission/verifier-identity: `/me` self-read with no id, identity is the " +
      "provider's own app-scoped id, by-id guard intact, 100/33 is a node fact, account type " +
      "normalized and never guessed",
  );
}

void main();
