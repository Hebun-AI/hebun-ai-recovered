/*
 * INSTAGRAM · provider read — the structural rules the second integration provider stands on.
 *
 * Source is read with comments STRIPPED, so no rule here can be satisfied — or tripped — by prose.
 *
 * WHAT THIS FILE REFUSES TO LET HAPPEN:
 *
 *   1. A WRITE SURFACE. No publish, comment, message or POST may be expressible.
 *   2. A WIDER SCOPE. One scope is requested and the catalog may not ask for a second.
 *   3. A FACEBOOK DEPENDENCY. No Page, no `graph.facebook.com`, no Commerce surface.
 *   4. A SECOND AUTHORITY. No writer, no scheduler, no persistence, no credential kind.
 *   5. A SECRET IN A URL. The token travels in a header and nowhere else.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  INSTAGRAM_ACCOUNT_FIELDS,
  INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_ACCOUNT_SUBJECT_KIND,
  INSTAGRAM_BUSINESS_BASIC_SCOPE,
  INSTAGRAM_FORBIDDEN_FRAGMENTS,
  INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_FORBIDDEN_VERBS,
  INSTAGRAM_OAUTH_TRANSPORT_MODULE,
  INSTAGRAM_TOKEN_ENDPOINT,
  INSTAGRAM_PROVIDER_KEY,
  accountIdFromSubjectRef,
} from "../../src/features/provider-instagram/contracts";
import { PROVIDER_CATALOG, findProviderDefinition } from "../../src/features/provider-catalog/catalog";
import { OBSERVABLE_CAPABILITIES } from "../../src/features/standing-observation-authority/contracts";
import { OBSERVATION_SUBJECT_KINDS } from "../../src/features/provider-observation-history/contracts";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const PROVIDER = "src/features/provider-instagram";
const CONTRACTS = `${PROVIDER}/contracts.ts`;
const TRANSPORT = `${PROVIDER}/instagram-transport.server.ts`;
const TOKEN_CALL = `${PROVIDER}/instagram-access-token-call.server.ts`;
const READ = `${PROVIDER}/read-account-observation.server.ts`;
const MAPPER = "src/features/provider-observation-history/record-instagram-account-observation.server.ts";
const DISPATCH = "src/features/provider-observation-history/observe-authorized-subject.server.ts";

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(rel);
    return /\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

function main(): void {
  const providerFiles = walk(PROVIDER);

  /* ═══ 1. IT IS A READ, AND CANNOT BECOME A WRITE ═══════════════════════════ */
  for (const f of providerFiles) {
    const code = codeOf(read(f));
    for (const forbidden of INSTAGRAM_FORBIDDEN_FRAGMENTS) {
      /* The contracts file DECLARES the ban list, so it is exempt from its own literals. */
      if (f === CONTRACTS) continue;
      assert.ok(
        !code.includes(forbidden),
        `${f} contains no \`${forbidden}\` — the ban list is asserted, not merely written down`,
      );
    }
  }

  /*
   * ── THE VERB BAN, RE-AIMED RATHER THAN LOOSENED ──────────────────────────
   *
   * `POST` and `DELETE` used to sit in the list above, which covers every provider file. That was
   * expressible while this directory held only a read. Meta documents the authorization-code
   * exchange as a POST with no GET form, so a ceremony cannot exist under a blanket ban.
   *
   * The ban therefore names ONE exempt module and pins what that module may contain: exactly one
   * POST, aimed at the token endpoint. Every other provider file — the observation transport
   * included — is still refused both verbs, so the rule covers strictly more than the sentence it
   * replaced: before, no file could POST; now, no file can POST except one, which can POST once, to
   * one URL. A second POST anywhere, including inside the exempt module, fails here.
   */
  for (const f of providerFiles) {
    if (f === CONTRACTS || f === INSTAGRAM_OAUTH_TRANSPORT_MODULE) continue;
    const code = codeOf(read(f));
    for (const verb of INSTAGRAM_FORBIDDEN_VERBS) {
      assert.ok(!code.includes(verb), `${f} contains no \`${verb}\` — only the ceremony may POST`);
    }
  }
  assert.ok(
    providerFiles.includes(INSTAGRAM_OAUTH_TRANSPORT_MODULE),
    "the exempt module is a real file — an exemption naming nothing is an exemption nobody audits",
  );
  const oauthTransport = codeOf(read(INSTAGRAM_OAUTH_TRANSPORT_MODULE));
  assert.equal(
    (oauthTransport.match(/method:\s*"POST"/g) ?? []).length,
    1,
    "the ceremony constructs exactly one POST",
  );
  assert.ok(
    !oauthTransport.includes("DELETE"),
    "and never a DELETE — the ceremony creates, it does not remove",
  );
  assert.ok(
    oauthTransport.includes("INSTAGRAM_TOKEN_ENDPOINT, { method: \"POST\""),
    "and that POST is aimed at the token endpoint, not at a URL assembled elsewhere",
  );
  assert.equal(
    INSTAGRAM_TOKEN_ENDPOINT,
    "https://api.instagram.com/oauth/access_token",
    "the token endpoint is Meta's documented one for Instagram Login",
  );
  const transport = codeOf(read(TRANSPORT));
  assert.equal(
    (transport.match(/method:\s*"GET"/g) ?? []).length,
    1,
    "the transport declares exactly one verb, and it is GET",
  );
  for (const verb of ['method: "POST"', 'method: "DELETE"', 'method: "PUT"', 'method: "PATCH"']) {
    assert.ok(!transport.includes(verb), `the transport never constructs \`${verb}\``);
  }
  /*
   * NO REQUEST BODY IS EVER BUILT. Aimed at body CONSTRUCTION, not at the word: `let body: unknown`
   * is how the RESPONSE is parsed, and banning the identifier outright would forbid reading a reply.
   * A write needs a serialized payload, and this is the line that makes one impossible.
   */
  assert.ok(
    !transport.includes("JSON.stringify"),
    "the transport serializes nothing — a write would need a payload it cannot build",
  );
  assert.ok(
    !/fetchImpl\([^)]*\{[\s\S]*?\bbody\b\s*:/.test(transport),
    "and no request init carries a body",
  );

  /* ═══ 2. THE SECRET IS NEVER IN THE URL ════════════════════════════════════ */
  assert.ok(
    transport.includes("Authorization: `Bearer ${accessToken}`") ||
      /Authorization:\s*`Bearer \$\{accessToken\}`/.test(transport),
    "the token travels in an Authorization header",
  );
  assert.ok(
    !/searchParams\.set\(\s*"access_token"/.test(transport),
    "and NEVER as an `access_token` query parameter — a secret in a URL reaches logs",
  );
  for (const f of providerFiles.concat([DISPATCH, MAPPER])) {
    const code = codeOf(read(f));
    for (const leak of ["console.log", "console.error", "console.warn"]) {
      assert.ok(!code.includes(leak), `${f} never ${leak}s`);
    }
  }

  /* ═══ 3. NO FACEBOOK, NO PAGE, NO COMMERCE ════════════════════════════════ */
  for (const f of providerFiles) {
    /* `contracts.ts` DECLARES the ban list, so its own literals are the rule, not a violation. */
    if (f === CONTRACTS) continue;
    const code = codeOf(read(f));
    for (const fb of ["graph.facebook.com", "page_id", "pageId", "commerce", "business_manager"]) {
      assert.ok(!code.includes(fb), `${f} has no Facebook dependency (\`${fb}\`)`);
    }
  }
  /* And the origin the transport actually uses is the Instagram-Login host. */
  assert.ok(
    codeOf(read(CONTRACTS)).includes('"https://graph.instagram.com"'),
    "the API origin is graph.instagram.com — the Instagram Login host",
  );

  /* ═══ 4. ONE SCOPE, AND THE CATALOG MAY NOT ASK FOR MORE ══════════════════ */
  const definition = findProviderDefinition(INSTAGRAM_PROVIDER_KEY, PROVIDER_CATALOG);
  assert.ok(definition, "the provider is registered in the released catalog");
  assert.deepEqual(
    [...definition!.minimumScopes],
    [INSTAGRAM_BUSINESS_BASIC_SCOPE],
    "the connection asks for exactly one scope",
  );
  const capabilityScopes = definition!.capabilityScopes[INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY];
  assert.ok(capabilityScopes, "the capability declares its scopes");
  assert.deepEqual([...capabilityScopes!.read], [INSTAGRAM_BUSINESS_BASIC_SCOPE]);
  assert.deepEqual(
    [...capabilityScopes!.write],
    [],
    "the write scope set is EMPTY, so this connection reports writeCapable:false permanently",
  );
  /*
   * TWO CAPABILITIES NOW, AND THE SET IS STILL EXACT. The media read was added as its own key rather
   * than by widening the account key, so this pin grew by one entry and lost none of its force:
   * insights, publishing, comments and messaging are still absent, and a third capability appearing
   * here still fails.
   */
  const mediaScopes = definition!.capabilityScopes[INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY];
  assert.ok(mediaScopes, "the media capability declares its scopes");
  assert.deepEqual(
    [...mediaScopes!.read],
    [INSTAGRAM_BUSINESS_BASIC_SCOPE],
    "media reads under the SAME scope already granted — no second consent is requested",
  );
  assert.deepEqual([...mediaScopes!.write], [], "and it grants no write half either");
  assert.notEqual(
    INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
    INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
    "the two capabilities are distinct keys — media is not a wider account read",
  );
  assert.deepEqual(
    Object.keys(definition!.capabilityScopes).sort(),
    [INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY, INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY].sort(),
    "exactly two capabilities are offered — insights and publishing are not listed",
  );

  /* ═══ 5. THE OBSERVABLE TRIPLE IS REGISTERED WHOLE ════════════════════════ */
  const triple = OBSERVABLE_CAPABILITIES.find((c) => c.providerKey === INSTAGRAM_PROVIDER_KEY);
  assert.ok(triple, "Governance may authorize this scope");
  assert.equal(triple!.capabilityKey, INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY);
  assert.equal(triple!.subjectKind, INSTAGRAM_ACCOUNT_SUBJECT_KIND);
  assert.ok(
    (OBSERVATION_SUBJECT_KINDS as readonly string[]).includes(INSTAGRAM_ACCOUNT_SUBJECT_KIND),
    "and the observation authority can express its subject kind",
  );

  /* EVERY DISPATCH BRANCH MUST BE A REGISTERED TRIPLE. */
  const dispatch = codeOf(read(DISPATCH));
  for (const capability of OBSERVABLE_CAPABILITIES) {
    assert.ok(
      dispatch.includes(capability.providerKey === INSTAGRAM_PROVIDER_KEY
        ? "INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY"
        : "YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY"),
      "the dispatch handles every observable capability",
    );
  }

  /* ═══ 6. THE FIELD LIST IS CLOSED ═════════════════════════════════════════ */
  assert.deepEqual(
    [...INSTAGRAM_ACCOUNT_FIELDS],
    ["id", "username", "account_type", "followers_count", "follows_count", "media_count"],
    "six fields, and a seventh needs a capability that asks for it",
  );
  for (const wider of ["media{", "insights", "comments", "children", "permalink"]) {
    assert.ok(
      !INSTAGRAM_ACCOUNT_FIELDS.some((f) => f.includes(wider)),
      `the field list does not reach \`${wider}\``,
    );
  }

  /* ═══ 7. NO SECOND AUTHORITY ══════════════════════════════════════════════ */
  /*
   * ── AIMED AT A TABLE, NOT AT AN IDENTIFIER ──────────────────────────────
   *
   * A bare `.update(` used to be banned here, and it caught the OAuth ceremony's HMAC —
   * `createHmac(...).update(...)` is a digest, not a write. Banning the method name would have
   * forbidden signing a state cookie, which is the one mechanism that makes the callback safe.
   *
   * So the ban names the QUERY BUILDER — `db.` and `tx.` — and, because that alone would be weaker
   * than what it replaced, it is paired with a ban on importing the schema or the ORM at all. A
   * provider file can now not even reach for a table, which is a stronger claim than never calling
   * one method on one variable name.
   */
  for (const f of providerFiles.concat([MAPPER])) {
    const code = codeOf(read(f));
    const banned = [
      "db.insert(", "db.update(", "db.delete(",
      "tx.insert(", "tx.update(", "tx.delete(",
      "db.transaction(", "setInterval", "cron",
      "drizzle-orm", "@/db/schema",
    ];
    for (const b of banned) {
      assert.ok(!code.includes(b), `${f} contains no \`${b}\` — it owns no table and no clock`);
    }
  }
  assert.ok(
    !codeOf(read(TOKEN_CALL)).includes("withDecryptedSecret"),
    "the token call uses the NARROW opener, never the branded-human one",
  );
  assert.ok(
    codeOf(read(TOKEN_CALL)).includes('"oauth_access"'),
    "and spends an existing credential kind — no fourth kind was invented",
  );

  /* ═══ 8. SUBJECT PARSING IS BY ID, NEVER BY USERNAME ══════════════════════ */
  assert.equal(accountIdFromSubjectRef("instagram/account/17841400000000000"), "17841400000000000");
  for (const bad of [
    "instagram/account/turkishrughouse",
    "instagram/account/",
    "youtube/channel/UC123",
    "instagram/account/123abc",
    "instagram/account/../../etc",
    "",
  ]) {
    assert.equal(accountIdFromSubjectRef(bad), null, `\`${bad}\` is not a subject reference`);
  }

  console.log(
    "instagram-account-observation/provider-firewall: one GET, one scope, one capability, " +
      "header-only secret, no Facebook, no write, no second authority",
  );
}

main();
