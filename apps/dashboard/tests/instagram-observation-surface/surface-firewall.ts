/*
 * INSTAGRAM · the observation SECTION's structural rules.
 *
 * Source is read with comments STRIPPED, so no rule here can be satisfied — or tripped — by prose.
 *
 * THE ONE SENTENCE THIS FILE DEFENDS:
 *
 *   A HUMAN OPENING A PAGE READS STORED HISTORY. IT IS NOT AN EVENT THAT MAY REACH A PROVIDER.
 *
 * WHAT IT REFUSES TO LET HAPPEN:
 *
 *   1. A SECOND READ AUTHORITY. The page goes through the released observation seam or not at all.
 *   2. A DIRECT QUERY. No table, no schema, no drizzle in a surface.
 *   3. A CAUSED READ. No provider transport, no observation runtime, no trigger, no scheduler.
 *   4. A CREDENTIAL. No key, no token, no decryption — a surface may not even see one.
 *   5. AN UNBOUNDED READ, or a tenant that came from anywhere but the session.
 *   6. A RENDERED PROVENANCE IDENTIFIER.
 *   7. A DERIVED METRIC, or a freshness verdict nobody owns.
 *   8. A REGRESSION IN THE CONNECTION STATE THIS PAGE ALREADY RENDERED.
 *   9. A NEW AUTHORITY, A NEW PAGE, A NEW NAVIGATION ENTRY, A MIGRATION.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { INSTAGRAM_PROVIDER_KEY } from "../../src/features/provider-instagram/contracts";
import { MAX_OBSERVATIONS_PER_READ } from "../../src/features/provider-observation-history/read-provider-observations.server";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const PAGE = "src/app/(dashboard)/integrations/instagram/page.tsx";
const PROJECTION = "src/features/instagram-connection-surface/latest-observation.ts";
const SURFACE = "src/features/instagram-connection-surface/model.ts";
const READER = "src/features/provider-observation-history/read-provider-observations.server.ts";

function main(): void {
  for (const f of [PAGE, PROJECTION, SURFACE, READER]) {
    assert.ok(existsSync(path.join(ROOT, f)), `${f} exists`);
  }
  const page = codeOf(read(PAGE));
  const projection = codeOf(read(PROJECTION));
  const consumer = `${page}\n${projection}`;

  /* ═══ 1. ONE READ AUTHORITY, REUSED ═══════════════════════════════════════ */
  assert.ok(
    page.includes(
      'from "@/features/provider-observation-history/read-provider-observations.server"',
    ),
    "the page reads observations through the RELEASED authority",
  );
  assert.equal(
    (page.match(/readProviderObservations\(/g) ?? []).length,
    1,
    "from exactly one place — a second call site is a second contract",
  );
  /* AND IT DEFINED NO SEAM OF ITS OWN. */
  for (const f of [PAGE, PROJECTION]) {
    const code = codeOf(read(f));
    for (const minted of ["export async function read", "getControlPlaneDb", "db.select(", "db\n"]) {
      assert.ok(!code.includes(minted), `${f} mints no read seam — no \`${minted}\``);
    }
  }

  /* ═══ 2. NO DIRECT QUERY, NO TABLE, NO SCHEMA ═════════════════════════════ */
  for (const banned of [
    "providerObservations",
    "provider_observations",
    "@/db/schema",
    "@/db/client",
    "drizzle-orm",
    ".insert(",
    ".update(",
    ".delete(",
  ]) {
    assert.ok(!consumer.includes(banned), `the consumer contains no \`${banned}\``);
  }

  /* ═══ 3. NOTHING HERE CAN CAUSE A READ ════════════════════════════════════ */
  for (const banned of [
    "provider-instagram/instagram-transport",
    "provider-instagram/instagram-oauth-transport",
    "provider-instagram/read-account-observation",
    "verify-instagram-connection",
    "observe-once-under-authorization",
    "observe-authorized-subject",
    "observation-trigger",
    "scan-due-observations",
    "standing-observation",
    "write-provider-observation",
    "ObservationPrincipal",
    "fetch(",
    "graph.instagram.com",
    "graph.facebook.com",
    "api.instagram.com",
    "revalidate",
  ]) {
    assert.ok(!consumer.includes(banned), `the consumer cannot reach \`${banned}\``);
  }
  /*
   * THE PAGE'S ONLY REMAINING PROVIDER IMPORT IS THE VOCABULARY — a constant, not a transport.
   * `isInstagramOAuthConfigured` predates this phase and answers with a boolean.
   */
  const providerImports = page.match(/from "@\/features\/provider-instagram\/[a-z.-]+"/g) ?? [];
  assert.deepEqual(
    [...new Set(providerImports)].sort(),
    [
      'from "@/features/provider-instagram/contracts"',
      'from "@/features/provider-instagram/instagram-environment.server"',
    ],
    "the page reaches the provider only for its vocabulary and its configured boolean",
  );

  /* ═══ 4. NO CREDENTIAL, EVER ══════════════════════════════════════════════ */
  for (const banned of [
    "credential-repository",
    "integration-credentials",
    "resolveInstagramOAuthEnvironment",
    "clientSecret",
    "stateSecret",
    "accessToken",
    "decrypt",
    "openSecret",
    "sealSecret",
  ]) {
    assert.ok(!consumer.includes(banned), `the consumer cannot see \`${banned}\``);
  }

  /* ═══ 5. THE QUERY CONTRACT: TENANT FROM THE SESSION, ONE PROVIDER, ONE ROW ═ */
  assert.ok(
    page.includes("resolveTenantContext()"),
    "the tenant comes from the authenticated session",
  );
  assert.ok(
    /readProviderObservations\(\s*tenant,\s*\{\s*providerKey:\s*INSTAGRAM_PROVIDER_KEY,\s*limit:\s*1\s*\}\s*\)/.test(
      page,
    ),
    "the query is exactly: this session's tenant, provider `instagram`, one row",
  );
  assert.equal(INSTAGRAM_PROVIDER_KEY, "instagram", "and the provider key is `instagram`");
  /* NO TENANT MAY BE INFERRED FROM THE ACCOUNT, THE URL OR THE CONNECTION. */
  for (const spoof of [
    'get("tenant")',
    'get("tenantId")',
    'get("organization")',
    'get("account")',
    'get("username")',
    "params.tenant",
    "subjectRef:",
    "tenantId:",
  ]) {
    assert.ok(!page.includes(spoof), `the page never derives a tenant or a subject from \`${spoof}\``);
  }
  /* AND THE READ IS BOUNDED BELOW THE SEAM'S OWN CEILING, not merely by it. */
  assert.ok(MAX_OBSERVATIONS_PER_READ > 1, "the seam's ceiling is a page, not a row");
  assert.ok(
    !page.includes(`limit: ${MAX_OBSERVATIONS_PER_READ}`),
    "the page does not pull a page of history it has no way to show",
  );

  /* ═══ 6. NO PROVENANCE IDENTIFIER IS RENDERED ═════════════════════════════ */
  for (const provenance of [
    "observationId",
    "standingAuthorizationId",
    "invocationId",
    "integrationId",
    "capabilityKey",
    "subjectKind",
    "observedByActorType",
    "recordedAt",
    "accountId",
  ]) {
    assert.ok(
      !page.includes(provenance),
      `the page cannot render \`${provenance}\` — it never names it`,
    );
  }
  /* The projection may NAME a fact key it reads, but must not carry an id into the view. */
  const viewShape = projection.slice(
    projection.indexOf("export interface InstagramObservationView"),
    projection.indexOf("export type InstagramLatestObservation"),
  );
  assert.ok(viewShape.length > 0, "the view shape was located");
  for (const provenance of [
    "observationId",
    "standingAuthorizationId",
    "invocationId",
    "integrationId",
    "accountId",
  ]) {
    assert.ok(!viewShape.includes(provenance), `the view has no \`${provenance}\` field`);
  }

  /* ═══ 7. NOTHING IS DERIVED, AND NO FRESHNESS VERDICT IS INVENTED ═════════ */
  const derived = [
    "trend",
    "growth",
    "delta",
    "rate",
    "score",
    "average",
    "percent",
    "analytics",
    "insight",
    "recommend",
    "stale",
    "fresh",
    "outdated",
    "currently has",
    "now has",
  ];
  const sectionAt = page.indexOf("{INSTAGRAM_OBSERVATION_HEADING}");
  assert.ok(sectionAt > 0, "the rendered observation section was located");
  const section = page.slice(sectionAt);
  const observationProse = `${projection}\n${section}`;
  for (const word of derived) {
    assert.ok(
      !new RegExp(word, "i").test(observationProse),
      `the observation section never says \`${word}\``,
    );
  }
  /* THE INSTANT IS SHOWN AS AN INSTANT. No relative time, no clock arithmetic. */
  for (const clock of ["Date.now(", "new Date(", "toLocale", "ago", "Intl."]) {
    assert.ok(!consumer.includes(clock), `the consumer performs no time arithmetic — no \`${clock}\``);
  }
  assert.ok(
    page.includes("latestObservation.observation.observedAt"),
    "the stored instant itself is what is rendered",
  );
  /* AND THE MEANING IS SAID NEXT TO THE VALUES, not somewhere else on the page. */
  const meaningAt = page.indexOf("{INSTAGRAM_OBSERVATION_MEANING}");
  const valuesAt = page.indexOf("describeInstagramObservation(");
  assert.ok(meaningAt > 0 && valuesAt > meaningAt, "the denial precedes the numbers it qualifies");

  /* ═══ 8. THE CONNECTION THIS PAGE ALREADY RENDERED IS INTACT ══════════════ */
  for (const kept of [
    "buildInstagramConnectionModel(",
    "INSTAGRAM_STATE_SENTENCES[model.state]",
    "model.accountLabel",
    "model.lastVerifiedAt",
    "model.grantedScopes",
    "model.failureReason",
    "model.connectable",
    "isInstagramOAuthConfigured()",
    "listConnections(",
    "/api/integrations/instagram/start",
  ]) {
    assert.ok(page.includes(kept), `the page still renders \`${kept}\``);
  }
  /*
   * AND THE HISTORY IS NOT GATED ON THE CONNECTION. A grant that ended does not un-say what
   * Instagram said: the section is rendered from its own read, never from `model.state`.
   */
  for (const gate of ["model.state", "model.connectable", "connections.length"]) {
    assert.ok(!section.includes(gate), `the observation section is not gated on \`${gate}\``);
  }
  /* Every branch of the read has a sentence, and the two absences are never the same one. */
  for (const branch of [
    'latestObservation.status === "observed"',
    'latestObservation.status === "none"',
    "INSTAGRAM_OBSERVATION_ABSENCE.none",
    "INSTAGRAM_OBSERVATION_ABSENCE[latestObservation.reason]",
  ]) {
    assert.ok(page.includes(branch), `the page answers \`${branch}\``);
  }

  /* ═══ 9. NO NEW PAGE, NO NAVIGATION ENTRY, NO MIGRATION ═══════════════════ */
  const integrationPages = readdirSync(path.join(ROOT, "src/app/(dashboard)/integrations"), {
    withFileTypes: true,
  })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  assert.deepEqual(
    integrationPages,
    ["github", "google", "instagram"],
    "no observation, analytics or history page was created — the existing surface was used",
  );
  const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
    entries: readonly unknown[];
  };
  assert.equal(journal.entries.length, 52, "a consumer adds no migration");

  console.log(
    "instagram-observation-surface/surface-firewall: released seam reused, no query, no provider " +
      "contact, no credential, tenant from session, one row, no provenance rendered, nothing " +
      "derived, connection intact, no new page and no migration",
  );
}

main();
