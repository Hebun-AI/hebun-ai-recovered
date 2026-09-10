/*
 * INSTAGRAM · the media SECTION's structural rules, and the capability-scoping repair.
 *
 * Source is read with comments STRIPPED, so no rule here can be satisfied — or tripped — by prose.
 *
 * THE ONE SENTENCE THIS FILE DEFENDS:
 *
 *   A CONSUMER THAT UNDERSTANDS ONE FACT VOCABULARY MUST ASK FOR THAT CAPABILITY BY NAME.
 *
 * That is not style. An unscoped read returned the newest observation of ANY Instagram capability,
 * and the account surface rendered a media row through the account projection — reporting five facts
 * as unreported that the provider had reported hours earlier. Both sections now name their
 * capability, and this file makes the omission fail rather than ship.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
} from "../../src/features/provider-instagram/contracts";
import { MAX_OBSERVATIONS_PER_READ } from "../../src/features/provider-observation-history/read-provider-observations.server";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const PAGE = "src/app/(dashboard)/integrations/instagram/page.tsx";
const MEDIA_PROJECTION = "src/features/instagram-connection-surface/latest-media-observation.ts";
const ACCOUNT_PROJECTION = "src/features/instagram-connection-surface/latest-observation.ts";
const SEAM = "src/features/provider-observation-history/read-provider-observations.server.ts";
const CARDS = "src/components/platform-integrations/instagram-media-cards.tsx";

function main(): void {
  for (const f of [PAGE, MEDIA_PROJECTION, ACCOUNT_PROJECTION, SEAM, CARDS]) {
    assert.ok(existsSync(path.join(ROOT, f)), `${f} exists`);
  }
  const page = codeOf(read(PAGE));
  const projection = codeOf(read(MEDIA_PROJECTION));
  const cards = codeOf(read(CARDS));
  /* THE PRESENTATION COMPONENT IS PART OF THE CONSUMER and inherits every ban below. */
  const consumer = `${page}\n${projection}\n${cards}`;
  const seam = codeOf(read(SEAM));

  /* ═══ 1. THE REPAIR: THE SEAM CAN EXPRESS A CAPABILITY, AND USES IT ═══════ */
  assert.ok(
    /readonly capabilityKey\?: string;/.test(seam),
    "the released query can name a capability",
  );
  assert.ok(
    /if \(query\.capabilityKey\) predicates\.push\(\s*eq\(providerObservations\.capabilityKey, query\.capabilityKey\)/.test(
      seam.replace(/\s+/g, " ").replace(/ /g, " "),
    ) || seam.includes("if (query.capabilityKey) predicates.push(eq(providerObservations.capabilityKey, query.capabilityKey));"),
    "and the predicate is actually applied — a declared filter nobody applies is worse than none",
  );

  /* ═══ 2. BOTH SECTIONS NAME THEIR CAPABILITY ═════════════════════════════ */
  const calls = page.match(/readProviderObservations\(tenant, \{[\s\S]*?\}\)/g) ?? [];
  assert.equal(calls.length, 2, "the page performs exactly two stored-observation reads");
  for (const call of calls) {
    assert.ok(call.includes("capabilityKey:"), "every read names a capability — none is unscoped");
    assert.ok(call.includes("limit: 1"), "and asks for one row");
    assert.ok(call.includes("INSTAGRAM_PROVIDER_KEY"), "for this provider");
  }
  assert.ok(
    calls.some((c) => c.includes("INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY")),
    "the account section asks for the ACCOUNT capability",
  );
  assert.ok(
    calls.some((c) => c.includes("INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY")),
    "the media section asks for the MEDIA capability",
  );
  assert.notEqual(
    INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
    INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
    "and they are different keys, so the two reads cannot collapse",
  );
  /* Bounded well below the seam's own ceiling. */
  assert.ok(MAX_OBSERVATIONS_PER_READ > 1);
  assert.ok(!page.includes(`limit: ${MAX_OBSERVATIONS_PER_READ}`), "no page pulls a whole history");

  /* ═══ 3. NO SECOND AUTHORITY, NO DATABASE, NO PROVIDER, NO CREDENTIAL ════ */
  for (const banned of [
    "providerObservations",
    "provider_observations",
    "@/db/schema",
    "@/db/client",
    "drizzle-orm",
    ".insert(",
    ".update(",
    ".delete(",
    "getControlPlaneDb",
  ]) {
    assert.ok(!consumer.includes(banned), `the consumer contains no \`${banned}\``);
  }
  for (const banned of [
    "provider-instagram/instagram-transport",
    "provider-instagram/read-media-observation",
    "provider-instagram/read-account-observation",
    "observe-once-under-authorization",
    "observe-authorized-subject",
    "observation-trigger",
    "scan-due-observations",
    "standing-observation-authority",
    "write-provider-observation",
    "authorizeStandingObservation",
    "fetch(",
    "graph.instagram.com",
    "api.instagram.com",
    "graph.facebook.com",
    "revalidate",
  ]) {
    assert.ok(!consumer.includes(banned), `the consumer cannot reach \`${banned}\``);
  }
  for (const banned of [
    "credential-repository",
    "integration-credentials",
    "withConnectionScopedSecret",
    "withAuthorizedInstagramToken",
    "accessToken",
    "clientSecret",
    "decrypt",
  ]) {
    assert.ok(!consumer.includes(banned), `the consumer cannot see \`${banned}\``);
  }
  for (const banned of ["features/knowledge", "features/heby", "knowledgeNodes", "knowledgeFacts"]) {
    assert.ok(!consumer.includes(banned), `no Knowledge or Heby reach — \`${banned}\``);
  }

  /* ═══ 4. TENANT COMES FROM THE SESSION, NEVER FROM THE CLIENT ════════════ */
  assert.ok(page.includes("resolveTenantContext()"), "the tenant comes from the session");
  for (const spoof of [
    'get("tenant")',
    'get("tenantId")',
    'get("account")',
    'get("capability")',
    "params.tenant",
    "tenantId:",
    "subjectRef:",
  ]) {
    assert.ok(!page.includes(spoof), `no identity or scope is taken from \`${spoof}\``);
  }

  /* ═══ 5. NO INTERNAL IDENTIFIER IS RENDERABLE ════════════════════════════ */
  for (const provenance of [
    "observationId",
    "standingAuthorizationId",
    "invocationId",
    "integrationId",
    "capabilityKey:",
    "subjectKind",
    "recordedAt",
    "observedByActorType",
    "accountId",
    "mediaId",
  ]) {
    const inView = projection.slice(
      projection.indexOf("export interface InstagramMediaItemView"),
      projection.indexOf("export type InstagramLatestMediaObservation"),
    );
    if (provenance !== "capabilityKey:") {
      assert.ok(!inView.includes(provenance), `the item view has no \`${provenance}\` field`);
    }
  }
  /* `mediaId` is deliberately NOT projected: useful for aligning observations, not for a reader. */
  assert.ok(
    !projection.includes("mediaId:"),
    "mediaId is not projected into the UI model — the human display does not need it",
  );

  /* ═══ 6. NO ANALYTICS, AT ALL ════════════════════════════════════════════ */
  for (const derived of [
    "average",
    "engagement",
    "rate",
    "ratio",
    "trend",
    "growth",
    "delta",
    "score",
    "rank",
    "best",
    "worst",
    "percent",
    "recommend",
    "insight",
    "performance",
    "frequency",
  ]) {
    assert.ok(
      !new RegExp(`\\b${derived}`, "i").test(consumer),
      `the consumer never computes or names \`${derived}\``,
    );
  }
  /* Aggregating calls, matched as literals rather than as patterns. */
  for (const aggregate of ["reduce(", "sort(", "filter(", "flatMap("]) {
    assert.ok(!consumer.includes(aggregate), `no aggregation over the window — \`${aggregate}\``);
  }
  /* And no arithmetic over the collection. */
  for (const math of ["/ items.length", "* 100", "Math.max(", "Math.min(", "Math.round("]) {
    assert.ok(!consumer.includes(math), `no arithmetic over the window — \`${math}\``);
  }

  /* ═══ 7. NO CLOCK, NO FRESHNESS VERDICT — BUT FORMATTING IS ALLOWED ══════
   *
   * The original ban included `new Date(` and `Intl.`, which was right while nothing rendered a
   * date. It is too blunt now: FORMATTING A STORED INSTANT is not reading a clock. The distinction
   * this pin defends is the one that matters —
   *
   *   `new Date(storedIso)`  parses a value the provider gave      ALLOWED
   *   `Date.now()`           reads the present                     FORBIDDEN
   *   "28 Jul 2026"          what was said                         ALLOWED
   *   "43 days ago"          a claim about now                     FORBIDDEN
   */
  for (const clock of ["Date.now(", " ago", "stale", "fresh", "outdated", "relative"]) {
    assert.ok(!consumer.includes(clock), `no clock reading or freshness verdict — \`${clock}\``);
  }
  /* Where an instant IS formatted, it must be deterministic: fixed locale, fixed zone. */
  if (projection.includes("Intl.DateTimeFormat")) {
    assert.ok(
      /Intl\.DateTimeFormat\(\s*"en-GB"/.test(projection),
      "a formatted instant uses a FIXED locale, so server and browser cannot disagree",
    );
    assert.ok(
      /timeZone:\s*"UTC"/.test(projection),
      "and a FIXED zone, so the value does not change meaning with the reader",
    );
  }
  /* The page and the component never construct a Date at all — only the projection may. */
  for (const [f, code] of [[PAGE, page], [CARDS, cards]] as const) {
    assert.ok(!code.includes("new Date("), `${f} constructs no Date`);
    assert.ok(!code.includes("Intl."), `${f} formats no instant of its own`);
  }

  /* ═══ 8. THE PERMALINK IS A POLICY, NOT A GUESS ══════════════════════════ */
  assert.ok(
    projection.includes('parsed.protocol !== "https:"'),
    "only https is linkable",
  );
  assert.ok(
    projection.includes("INSTAGRAM_HOSTS.includes(parsed.hostname.toLowerCase())"),
    "and only Instagram's own hosts",
  );
  assert.ok(
    cards.includes('rel="noreferrer noopener nofollow"'),
    "an outbound link carries noreferrer, noopener and nofollow",
  );
  assert.ok(
    cards.includes("item.permalink ? ("),
    "and a link is rendered only when the permalink passed the policy",
  );
  /*
   * NOTHING IS FETCHED, AND NO IMAGE IS IMPLIED — checked across the WHOLE consumer, component
   * included. The observation deliberately stores no asset URL, so there is nothing to render; a
   * placeholder tile or a background gradient standing in for a photo would imply content Hebun does
   * not hold, and scraping the permalink for a preview would be a provider call from a page load.
   */
  for (const asset of [
    "<img",
    "next/image",
    "media_url",
    "mediaUrl",
    "thumbnail",
    "backgroundImage",
    "og:image",
    "opengraph",
  ]) {
    assert.ok(!consumer.includes(asset), `no asset is fetched or implied — \`${asset}\``);
  }

  /* ═══ 8b. THE CARD IS A PRODUCT SURFACE, AND STILL AN HONEST ONE ═════════ */
  assert.ok(/grid-cols-1[\s\S]*sm:grid-cols-2[\s\S]*xl:grid-cols-3/.test(cards),
    "the grid follows the product's existing responsive shape");
  assert.ok(cards.includes("line-clamp-4"), "the caption is CLAMPED visually, not truncated in data");
  assert.ok(
    cards.includes("break-words"),
    "and an unbroken hashtag cannot widen a column and scroll the page sideways",
  );
  assert.ok(
    !/caption[^\n]*\.(slice|substring|substr)\(/.test(cards),
    "the stored caption value is never cut — only its display is bounded",
  );
  assert.ok(!cards.includes("dangerouslySetInnerHTML"), "provider text is never injected as HTML");
  /* AN ICON IS NEVER THE ONLY MEANING. */
  assert.ok(cards.includes('aria-hidden="true"'), "decorative icons are hidden from assistive tech");
  /*
   * ── THIS PIN NOW PROVES MEANING, NOT TOKENS ─────────────────────────────
   *
   * The previous version asserted that a `sr-only` span existed and that `count.value` appeared
   * somewhere in the file. Both were true while the rendered accessible text was the DIGIT ALONE —
   * a screen reader announced "5 … 0" with both icons hidden and nothing saying which was which.
   * Production acceptance found it; this test had reported success.
   *
   * A CHECK THAT CANNOT FAIL FOR THE CASE THAT MATTERS IS NOT A CHECK. So the assertion below reads
   * the sr-only element itself and requires the metric's IDENTITY to be in it.
   */
  const srOnly = cards.match(/className="sr-only">([\s\S]*?)<\/span>/);
  assert.ok(srOnly, "the accessible text is rendered in a sr-only span");
  assert.ok(
    srOnly![1].includes("count.label"),
    "and it carries the metric's IDENTITY — a bare number tells a screen-reader user nothing",
  );
  assert.ok(
    srOnly![1].includes("count.value"),
    "together with its value, so the glyph and the spoken text cannot disagree",
  );
  /* THE WITHHELD SENTENCE IS PRESERVED, not prefixed with a label it would contradict. */
  assert.ok(
    /count\.reported\s*\?/.test(srOnly![1]),
    "and a withheld count keeps its own sentence rather than being labelled as a number",
  );
  assert.ok(cards.includes("count.display"), "the compact glyph comes from the same source");

  /* THE DATE SAYS WHICH INSTANT IT IS. A bare date beside an observation timestamp is ambiguous. */
  assert.ok(
    /Published \$\{publishedOn\}/.test(cards) || cards.includes("`Published ${publishedOn}`"),
    "a card's publication date is labelled `Published`, distinguishing it from the observation instant",
  );
  /* Design-system primitives rather than a parallel visual language, and no hardcoded colours. */
  for (const primitive of ["@/components/ui/card", "@/components/ui/badge"]) {
    assert.ok(cards.includes(primitive), `the card reuses \`${primitive}\``);
  }
  assert.ok(
    !/#[0-9a-fA-F]{3,8}\b/.test(cards) && !/\b(bg|text)-\[/.test(cards),
    "no hardcoded colour — theme tokens only",
  );

  /* ═══ 9. THE ACCOUNT AND CONNECTION SECTIONS SURVIVE ═════════════════════ */
  for (const kept of [
    "buildInstagramConnectionModel(",
    "INSTAGRAM_STATE_SENTENCES[model.state]",
    "model.grantedScopes",
    "model.connectable",
    "projectLatestInstagramObservation(",
    "describeInstagramObservation(",
    "INSTAGRAM_OBSERVATION_HEADING",
    "isInstagramOAuthConfigured()",
  ]) {
    assert.ok(page.includes(kept), `the page still renders \`${kept}\``);
  }
  /* The media section is not gated on the connection's lifecycle. */
  const mediaSection = page.slice(page.indexOf("{INSTAGRAM_MEDIA_HEADING}"));
  for (const gate of ["model.state", "model.connectable", "connections.length"]) {
    assert.ok(!mediaSection.includes(gate), `the media section is not gated on \`${gate}\``);
  }

  /* ═══ 10. NO SCHEMA, NO SCHEDULER ════════════════════════════════════════ */
  const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
    entries: readonly unknown[];
  };
  assert.equal(journal.entries.length, 52, "a consumer adds no migration");
  const cron = JSON.parse(read("vercel.json")) as { crons?: readonly { path: string }[] };
  assert.deepEqual((cron.crons ?? []).map((c) => c.path), ["/api/observation/scan"], "no new cron");

  console.log(
    "instagram-media-surface/media-surface-firewall: both reads capability-scoped, seam predicate " +
      "applied, no db/provider/credential/Knowledge reach, tenant from session, no internal ids, " +
      "no analytics, no clock, permalink policy enforced, existing sections intact, no schema",
  );
}

main();
