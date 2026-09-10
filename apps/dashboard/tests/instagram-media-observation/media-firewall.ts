/*
 * INSTAGRAM · MEDIA READ — the structural rules the new capability stands on.
 *
 * Source is read with comments STRIPPED, so no rule here can be satisfied — or tripped — by prose.
 *
 * THE ONE SENTENCE THIS FILE DEFENDS:
 *
 *   READING WHAT WAS POSTED IS NOT PERMISSION TO POST, AND THE ACCOUNT'S AUTHORIZATION IS NOT THE
 *   MEDIA'S AUTHORIZATION.
 *
 * WHAT IT REFUSES TO LET HAPPEN:
 *
 *   1. `/media_publish` becoming reachable because `/media` had to become reachable.
 *   2. A publish, comment, message, insights or moderation surface arriving beside the read.
 *   3. The existing account authorization silently acquiring media authority.
 *   4. A second scheduler, a second writer, a second credential kind or a migration.
 *   5. An unbounded read, a pagination loop, or a URL Hebun fetches on the provider's say-so.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import {
  INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_ACCOUNT_SUBJECT_KIND,
  INSTAGRAM_ALLOWED_OPERATIONS,
  INSTAGRAM_ALLOWED_OPERATION_PATH_PATTERN,
  INSTAGRAM_BUSINESS_BASIC_SCOPE,
  INSTAGRAM_FORBIDDEN_FRAGMENTS,
  INSTAGRAM_FORBIDDEN_VERBS,
  INSTAGRAM_MEDIA_FIELDS,
  INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_OAUTH_TRANSPORT_MODULE,
  INSTAGRAM_PROVIDER_KEY,
  INSTAGRAM_REQUESTED_SCOPES,
  MAX_RECENT_MEDIA,
} from "../../src/features/provider-instagram/contracts";
import {
  OBSERVABLE_CAPABILITIES,
  isObservableCapability,
} from "../../src/features/standing-observation-authority/contracts";
import { findProviderDefinition } from "../../src/features/provider-catalog/catalog";
import {
  INSTAGRAM_MEDIA_FACT_KEYS,
  INSTAGRAM_MEDIA_ITEM_FACT_KEYS,
} from "../../src/features/provider-observation-history/record-instagram-media-observation.server";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const PROVIDER = "src/features/provider-instagram";
const CONTRACTS = `${PROVIDER}/contracts.ts`;
const TRANSPORT = `${PROVIDER}/instagram-transport.server.ts`;
const MEDIA_READ = `${PROVIDER}/read-media-observation.server.ts`;
const MAPPER = "src/features/provider-observation-history/record-instagram-media-observation.server.ts";
const DISPATCH = "src/features/provider-observation-history/observe-authorized-subject.server.ts";

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(rel);
    return /\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

function main(): void {
  for (const f of [CONTRACTS, TRANSPORT, MEDIA_READ, MAPPER, DISPATCH]) {
    assert.ok(existsSync(path.join(ROOT, f)), `${f} exists`);
  }
  const providerFiles = walk(PROVIDER);

  /* ═══ 1. `/media_publish` DID NOT COME ALONG FOR THE RIDE ══════════════════
   *
   * THE WHOLE REASON THIS FILE EXISTS. `/media` is a PREFIX of `/media_publish`, so unbanning the
   * first by deleting a substring would have unbanned the second by accident.
   */
  assert.ok(
    INSTAGRAM_FORBIDDEN_FRAGMENTS.includes("/media_publish"),
    "`/media_publish` is STILL on the ban list — the read did not buy the write",
  );
  assert.ok(
    !INSTAGRAM_FORBIDDEN_FRAGMENTS.includes("/media"),
    "and `/media` left it, deliberately — the ban was re-aimed at paths, not deleted",
  );
  for (const f of providerFiles) {
    if (f === CONTRACTS) continue;
    const code = codeOf(read(f));
    for (const forbidden of INSTAGRAM_FORBIDDEN_FRAGMENTS) {
      assert.ok(!code.includes(forbidden), `${f} contains no \`${forbidden}\``);
    }
  }
  /* And every still-banned surface is named, so a future edit cannot quietly shrink the list. */
  for (const banned of [
    "/media_publish",
    "/comments",
    "/messages",
    "/conversations",
    "/insights",
    "ig_hashtag_search",
    "instagram_business_content_publish",
    "instagram_business_manage_comments",
    "instagram_business_manage_messages",
    "instagram_business_manage_insights",
    "graph.facebook.com",
    "pages_",
  ]) {
    assert.ok(INSTAGRAM_FORBIDDEN_FRAGMENTS.includes(banned), `\`${banned}\` is still forbidden`);
  }

  /* ═══ 2. WHAT REPLACED THE SUBSTRING BAN IS STRICTER ══════════════════════ */
  for (const op of INSTAGRAM_ALLOWED_OPERATIONS) {
    assert.ok(
      INSTAGRAM_ALLOWED_OPERATION_PATH_PATTERN.test(op.path),
      `operation \`${op.id}\` has an enumerated path (${op.path})`,
    );
  }
  /* The pattern is a closed enumeration, so the dangerous neighbours are UNREPRESENTABLE. */
  for (const forbiddenPath of [
    "/{account-id}/media_publish",
    "/{account-id}/comments",
    "/{account-id}/insights",
    "/{account-id}/messages",
    "/me/media_publish",
    "/media/{media-id}/comments",
  ]) {
    assert.ok(
      !INSTAGRAM_ALLOWED_OPERATION_PATH_PATTERN.test(forbiddenPath),
      `\`${forbiddenPath}\` cannot be expressed as an operation path`,
    );
  }
  assert.deepEqual(
    INSTAGRAM_ALLOWED_OPERATIONS.filter((o) => o.path.endsWith("/media")).map((o) => o.id),
    ["account.media.read"],
    "exactly one media operation exists, and it reads BY ID so the authorization binds the subject",
  );

  /* ═══ 3. STILL A READ. No verbs, no body, no write half. ══════════════════ */
  for (const f of providerFiles) {
    if (f === CONTRACTS || f === INSTAGRAM_OAUTH_TRANSPORT_MODULE) continue;
    const code = codeOf(read(f));
    for (const verb of INSTAGRAM_FORBIDDEN_VERBS) {
      assert.ok(!code.includes(verb), `${f} contains no \`${verb}\``);
    }
  }
  const definition = findProviderDefinition(INSTAGRAM_PROVIDER_KEY);
  assert.deepEqual(
    [...definition!.capabilityScopes[INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY]!.write],
    [],
    "the media capability has NO write scope — reading posts is not posting",
  );

  /* ═══ 4. NO NEW SCOPE IS ASKED OF ANY TENANT ══════════════════════════════ */
  assert.deepEqual(
    [...definition!.capabilityScopes[INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY]!.read],
    [INSTAGRAM_BUSINESS_BASIC_SCOPE],
    "media reads under the scope already held — no second consent",
  );
  assert.deepEqual(
    [...INSTAGRAM_REQUESTED_SCOPES],
    [INSTAGRAM_BUSINESS_BASIC_SCOPE],
    "and the ceremony still requests exactly one scope",
  );

  /* ═══ 5. THE ACCOUNT AUTHORIZATION DOES NOT AUTHORIZE MEDIA ═══════════════
   *
   * The strongest isolation claim in this file, asserted in BOTH directions.
   */
  assert.notEqual(
    INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
    INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
    "the capabilities are distinct keys",
  );
  assert.ok(
    isObservableCapability(
      INSTAGRAM_PROVIDER_KEY,
      INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
      INSTAGRAM_ACCOUNT_SUBJECT_KIND,
    ),
    "the media triple is independently observable",
  );
  assert.ok(
    isObservableCapability(
      INSTAGRAM_PROVIDER_KEY,
      INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
      INSTAGRAM_ACCOUNT_SUBJECT_KIND,
    ),
    "and the account triple is untouched",
  );
  /* Nonsense triples still fail closed. */
  for (const bogus of [
    { capabilityKey: "instagram.media.publish", subjectKind: INSTAGRAM_ACCOUNT_SUBJECT_KIND },
    { capabilityKey: "instagram.comments.read", subjectKind: INSTAGRAM_ACCOUNT_SUBJECT_KIND },
    { capabilityKey: "instagram.insights.read", subjectKind: INSTAGRAM_ACCOUNT_SUBJECT_KIND },
    { capabilityKey: INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY, subjectKind: "instagram-media" },
    { capabilityKey: INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY, subjectKind: "youtube-channel" },
  ]) {
    assert.ok(
      !isObservableCapability(INSTAGRAM_PROVIDER_KEY, bogus.capabilityKey, bogus.subjectKind),
      `\`${bogus.capabilityKey}\`/\`${bogus.subjectKind}\` is refused`,
    );
  }
  assert.equal(
    OBSERVABLE_CAPABILITIES.filter((c) => c.providerKey === INSTAGRAM_PROVIDER_KEY).length,
    2,
    "Instagram offers exactly two observable scopes — a third would need justifying here",
  );

  /* ═══ 6. THE DISPATCH ADDED ONE BRANCH AND STILL FAILS CLOSED ═════════════ */
  const dispatch = codeOf(read(DISPATCH));
  assert.equal(
    (dispatch.match(/INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY/g) ?? []).length,
    2,
    "the media capability appears exactly twice: the import and its one branch guard",
  );
  assert.ok(
    dispatch.includes("observeAccountMediaById("),
    "the branch routes to the media composition",
  );
  assert.equal(
    (dispatch.match(/withAuthorizedInstagramToken\(/g) ?? []).length,
    2,
    "both Instagram branches open the credential through the SAME released connection-scoped seam",
  );
  assert.ok(
    dispatch.trimEnd().endsWith('return { status: "unsupported-subject" };\n}'.trimEnd()) ||
      dispatch.includes('return { status: "unsupported-subject" };'),
    "an unclaimed triple still falls through to a refusal",
  );

  /* ═══ 7. BOUNDED, AND IT DOES NOT PAGINATE ════════════════════════════════ */
  assert.equal(MAX_RECENT_MEDIA, 10, "the window matches the released YouTube bound");
  const transport = codeOf(read(TRANSPORT));
  const mediaRead = codeOf(read(MEDIA_READ));
  for (const [f, code] of [[TRANSPORT, transport], [MEDIA_READ, mediaRead]] as const) {
    for (const loop of ["while (", "for (;;)", "paging.next)", "cursors.after)"]) {
      /* `next`/`after` may be READ; they may not be followed. A fetch inside a loop is the risk. */
      if (loop.startsWith("while") || loop.startsWith("for")) {
        assert.ok(!code.includes(loop), `${f} has no \`${loop}\` — it cannot page to exhaustion`);
      }
    }
    assert.ok(
      !/fetchImpl\([^)]*paging/.test(code),
      `${f} never fetches a URL the provider handed back`,
    );
  }
  assert.equal(
    (transport.match(/method:\s*"GET"/g) ?? []).length,
    1,
    "the transport still constructs exactly one request shape, and it is a GET",
  );

  /* ═══ 8. THE FIELD LIST IS CLOSED, AND EPHEMERAL URLS ARE ABSENT ══════════ */
  assert.deepEqual(
    [...INSTAGRAM_MEDIA_FIELDS],
    ["id", "media_type", "caption", "permalink", "timestamp", "like_count", "comments_count"],
    "exactly the seven fields this capability reads",
  );
  for (const excluded of ["media_url", "thumbnail_url", "children", "owner", "insights"]) {
    assert.ok(
      !INSTAGRAM_MEDIA_FIELDS.includes(excluded),
      `\`${excluded}\` is not requested — an observation is not an asset archive`,
    );
  }
  assert.deepEqual(
    [...INSTAGRAM_MEDIA_FACT_KEYS],
    ["accountId", "recentMediaCount", "moreMediaExist", "recentMedia"],
    "the stored top-level shape is a window plus its truncation flag",
  );
  assert.deepEqual(
    [...INSTAGRAM_MEDIA_ITEM_FACT_KEYS],
    ["mediaId", "mediaType", "caption", "permalink", "publishedAt", "likeCount", "commentCount"],
    "and each item carries exactly seven facts",
  );

  /* ═══ 9. NO SECOND AUTHORITY, NO SCHEMA, NO SCHEDULER ═════════════════════ */
  for (const f of [MEDIA_READ]) {
    const code = codeOf(read(f));
    for (const banned of ["@/db/", "drizzle-orm", ".insert(", "providerObservations"]) {
      assert.ok(!code.includes(banned), `${f} touches no table — no \`${banned}\``);
    }
  }
  for (const f of [MEDIA_READ, MAPPER, DISPATCH]) {
    const code = codeOf(read(f));
    for (const banned of [
      "setInterval",
      "setTimeout(",
      "cron",
      "features/knowledge",
      "features/heby",
      "knowledgeNodes",
      "knowledgeFacts",
    ]) {
      assert.ok(!code.includes(banned), `${f} contains no \`${banned}\``);
    }
  }
  const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
    entries: readonly unknown[];
  };
  assert.equal(journal.entries.length, 52, "a new capability added no migration");
  const cron = JSON.parse(read("vercel.json")) as { crons?: readonly { path: string }[] };
  assert.deepEqual(
    (cron.crons ?? []).map((c) => c.path),
    ["/api/observation/scan"],
    "no second scheduler — the released generic scan is still the only cron",
  );

  /* ═══ 10. NO UI REACHES THE PROVIDER ══════════════════════════════════════ */
  const page = codeOf(read("src/app/(dashboard)/integrations/instagram/page.tsx"));
  for (const banned of [
    "observeAccountMediaById",
    "readAccountMedia",
    INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
  ]) {
    assert.ok(!page.includes(banned), `the dashboard does not reach \`${banned}\` — no consumer yet`);
  }

  console.log(
    "instagram-media-observation/media-firewall: /media_publish still banned, paths enumerated, " +
      "account authorization isolated, one dispatch branch, bounded and non-paginating, closed " +
      "fields, no schema, no scheduler, no UI consumer",
  );
}

main();
