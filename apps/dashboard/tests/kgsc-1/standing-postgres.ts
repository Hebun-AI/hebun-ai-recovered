/*
 * KGSC-1 — `/source`, `/knowledge` and the version history show ratification as GOVERNANCE states it.
 *
 * Against a real PostgreSQL database, with the released writers (K2 create, K4 ratify) and the shared
 * reader `readKnowledgeGovernanceStandings`:
 *   A. a version Governance ratified reads confirmed;
 *   B. a version whose row names another version's genuine decision (a forged claim) reads NOT
 *      confirmed — and never "ratified";
 *   C. a version with no claim reads "none recorded";
 *   D. when Governance's record cannot be read, every record reads "verification unavailable", is
 *      still shown, and is never called "not confirmed";
 *   E. two tenants holding the same fact key see only their own record and their own standing;
 *   F. `/source` still resolves keys, ambiguity and not-found exactly as before;
 *   G. the version history carries the same reading per version when asked, and nothing when not.
 * Read-only: nothing here writes Knowledge or Governance beyond seeding.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity, type SeededLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import { ratifyKnowledgeVersion } from "../../src/features/knowledge-ratification/ratify-version.server";
import { createDurableKnowledgeWriter } from "../../src/features/knowledge/durable-knowledge-writer.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { readKnowledgeVersionHistory, type KnowledgeVersionHistoryDeps } from "../../src/features/knowledge/knowledge-version-history.server";
import { readKnowledgeGovernanceStandings } from "../../src/features/heby-answer/knowledge-evidence.server";
import { runHebyReadCommand } from "../../src/features/heby-commands/read-commands.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-10-19T09:00:00.000Z");
const REASON = "Governance has reviewed this exact version and records its decision here.";
const CONFIRMED = "Ratification: ratified — Governance holds the decision for this version.";
const NOT_CONFIRMED = "Ratification: NOT confirmed";
const NONE = "Ratification: none recorded.";
const UNAVAILABLE = "Ratification: Governance verification unavailable";

function contextFor(seeded: SeededLocalIdentity, sessionContextId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId,
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "kgsc1-request",
    authenticatedAt: NOW.toISOString(),
  });
}

async function sessionRowFor(client: Client, seeded: SeededLocalIdentity, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
             now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [seeded.authIdentityId, tag.repeat(64).slice(0, 64), seeded.userId, seeded.tenantId, seeded.membershipId],
  );
  return row.rows[0]!.id;
}

/** The lines one record contributes, from its describe line to the next record's. */
function blockOf(body: string, factKey: string): string {
  const lines = body.split("\n");
  const start = lines.findIndex((l) => l.startsWith(`${factKey} — `));
  assert.ok(start >= 0, `${factKey} is listed`);
  const next = lines.findIndex((l, i) => i > start && /^[a-z][\w.-]* — /.test(l));
  return lines.slice(start, next === -1 ? undefined : next).join("\n");
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_kgsc1_standing");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;
  const previousDatabaseUrl = process.env.DATABASE_URL;

  try {
    harness.migrateDatabase();
    await setup.connect();
    process.env.DATABASE_URL = harness.dbUrl;

    const writer = createDurableKnowledgeWriter(handle.db);
    const knowledgeRepo = createDurableKnowledgeRepository(handle.db);
    const knowledgeDeps = {
      resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
      getWriter: () => writer,
      getRepo: () => knowledgeRepo,
      getRepository: () => knowledgeRepo,
      now: () => NOW,
    } as never;
    const alice = await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-kgsc1", email: "alice@kgsc1.test", password: "alice-correct-password-7Qx" });
    const bob = await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-kgsc1", email: "bob@kgsc1.test", password: "bob-correct-password-4Lm" });
    const aliceCtx = contextFor(alice, await sessionRowFor(setup, alice, "a"));
    const bobCtx = contextFor(bob, await sessionRowFor(setup, bob, "b"));
    for (const [seeded, ctx] of [[alice, aliceCtx], [bob, bobCtx]] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
      );
      const established = await establishGovernanceAuthority(ctx, { justification: "Establishing Governance authority so Knowledge can be reviewed." }, deps);
      assert.equal(established.status, "established");
    }

    const create = async (ctx: TenantContext, factKey: string, statement: string, domainKey = "policies") => {
      const created = await createKnowledgeFact(ctx, { factKey, domainKey, scope: "company-wide", title: `Policy ${factKey}`, statement }, knowledgeDeps);
      assert.equal(created.status, "created", JSON.stringify(created));
      if (created.status !== "created") throw new Error("unreachable");
      return { factId: created.identity.factId, nodeId: created.identity.newKnowledgeNodeId! };
    };
    const ratify = async (ctx: TenantContext, fact: { factId: string; nodeId: string }) => {
      const r = await ratifyKnowledgeVersion(ctx, { factId: fact.factId, knowledgeNodeId: fact.nodeId, observedKnowledgeVersion: 1, justification: REASON }, deps);
      assert.equal(r.status, "ratified", JSON.stringify(r));
    };

    const confirmed = await create(aliceCtx, "refunds.confirmed", "MARK-ALICE-CONFIRMED refunds within 30 days.");
    await ratify(aliceCtx, confirmed);
    const forged = await create(aliceCtx, "refunds.forged", "MARK-ALICE-FORGED refunds within 365 days.");
    await create(aliceCtx, "refunds.none", "MARK-ALICE-NONE refunds by store credit.");
    /* The same key in two domains of Alice's tenant: /source must stay ambiguous, with each standing. */
    await create(aliceCtx, "refunds.none", "MARK-ALICE-NONE-OTHER-DOMAIN refunds by voucher.", "finance");
    /* The same key in Bob's tenant, ratified there. */
    const bobFact = await create(bobCtx, "refunds.confirmed", "MARK-BOB-CONFIRMED refunds within 14 days.");
    await ratify(bobCtx, bobFact);

    /* B — the forged row claims Alice's genuine decision, which Governance holds for ANOTHER version. */
    const genuine = (await setup.query<{ d: string }>("select ratification_decision_id::text d from knowledge_nodes where id = $1", [confirmed.nodeId])).rows[0]!.d;
    assert.equal((await setup.query("update knowledge_nodes set ratification_decision_id = $1 where id = $2", [genuine, forged.nodeId])).rowCount, 1);
    const forgedRow = JSON.stringify(await knowledgeRepo.listFacts({ tenantId: alice.tenantId }, NOW));
    assert.ok(forgedRow.includes("MARK-ALICE-FORGED"), "the forged row is active and readable");

    const run = (ctx: TenantContext, commandId: string, args: string[] = [], extra: Record<string, unknown> = {}) =>
      runHebyReadCommand({ commandId, args, route: "/heby" }, { resolveTenant: async () => ctx, knowledge: { now: () => NOW }, ...extra } as never);
    const bodyOf = async (r: ReturnType<typeof run>) => {
      const result = await r;
      assert.equal(result.status, "ok", JSON.stringify(result));
      if (result.status !== "ok") throw new Error("unreachable");
      return result.result.lines.join("\n");
    };

    /* ── /knowledge ─────────────────────────────────────────────────────────────────────────────── */
    const listing = await bodyOf(run(aliceCtx, "knowledge"));
    assert.ok(blockOf(listing, "refunds.confirmed").includes(CONFIRMED), "A: a Governance-ratified version reads confirmed");
    const forgedBlock = blockOf(listing, "refunds.forged");
    assert.ok(forgedBlock.includes(NOT_CONFIRMED), "B: a forged claim reads NOT confirmed");
    assert.ok(!forgedBlock.includes(CONFIRMED) && !/· ratified ·/.test(forgedBlock), "B: …and is never called ratified");
    assert.ok(blockOf(listing, "refunds.none").includes(NONE), "C: no claim, no confirmation");
    for (const line of listing.split("\n").filter((l) => / — Policy /.test(l))) {
      assert.ok(!/· ratified ·|no ratification recorded/.test(line), "the record line no longer carries the record's own claim");
    }
    assert.ok(!listing.includes("MARK-BOB"), "E: another tenant's record is not listed");

    /* D — the real reader, with Governance's record unreadable. */
    const blind = { readKnowledgeStandings: (t: never, r: never) => readKnowledgeGovernanceStandings(t, r, async () => { throw new Error("governance down"); }) };
    const blindListing = await bodyOf(run(aliceCtx, "knowledge", [], blind));
    for (const key of ["refunds.confirmed", "refunds.forged"]) {
      const block = blockOf(blindListing, key);
      assert.ok(block.includes(UNAVAILABLE), `D: ${key} reads verification unavailable`);
      assert.ok(!block.includes(NOT_CONFIRMED) && !block.includes(CONFIRMED), `D: ${key} is neither confirmed nor denied`);
    }
    /* The shared reader answers for the whole set or not at all, so a claim-free record reads unavailable too — never confirmed. */
    assert.ok(blockOf(blindListing, "refunds.none").includes(UNAVAILABLE), "D: the reading is all-or-nothing, as the shared reader defines it");
    assert.ok(blindListing.includes("MARK-ALICE-FORGED"), "D: records stay listed when the reading fails");

    /* ── /source ───────────────────────────────────────────────────────────────────────────────── */
    const source = async (ctx: TenantContext, key: string, extra = {}) => run(ctx, "source", [key], extra);
    const aliceConfirmed = await bodyOf(source(aliceCtx, "refunds.confirmed"));
    assert.ok(aliceConfirmed.includes(CONFIRMED) && aliceConfirmed.includes("MARK-ALICE-CONFIRMED"), "A/F: /source opens the record with Governance's reading");
    assert.ok(!aliceConfirmed.includes("MARK-BOB"), "E: Alice's /source never resolves Bob's record");
    const aliceForged = await bodyOf(source(aliceCtx, "refunds.forged"));
    assert.ok(aliceForged.includes(NOT_CONFIRMED) && !aliceForged.includes(CONFIRMED), "B: /source shows the forged claim as NOT confirmed");
    const bobConfirmed = await bodyOf(source(bobCtx, "refunds.confirmed"));
    assert.ok(bobConfirmed.includes("MARK-BOB-CONFIRMED") && bobConfirmed.includes(CONFIRMED), "E: Bob sees his own record, confirmed by his own Governance");
    assert.ok(!bobConfirmed.includes("MARK-ALICE"), "E: and nothing of Alice's");
    const bobForged = await source(bobCtx, "refunds.forged");
    assert.ok(bobForged.status === "ok" && bobForged.result.tone === "unavailable", "E/F: a key only Alice holds is not found for Bob");
    assert.ok(!JSON.stringify(bobForged).includes("MARK-ALICE"), "E: and leaks nothing of it");
    const blindSource = await bodyOf(source(aliceCtx, "refunds.forged", blind));
    assert.ok(blindSource.includes(UNAVAILABLE) && blindSource.includes("MARK-ALICE-FORGED"), "D: /source still opens the record, verification unavailable");

    /* F — ambiguity is unchanged: both candidates, each with its own reading. */
    const ambiguous = await bodyOf(source(aliceCtx, "refunds.none"));
    assert.ok(ambiguous.includes("matches 2 facts"), "F: an ambiguous key still returns every candidate");
    assert.equal(ambiguous.split(NONE).length - 1, 2, "F: each candidate carries its own reading");
    const missing = await source(aliceCtx, "refunds.nowhere");
    assert.equal(missing.status, "ok");
    if (missing.status === "ok") assert.equal(missing.result.tone, "unavailable", "F: an unknown key is still not found");

    /* ── G. the version history ────────────────────────────────────────────────────────────────── */
    const history = (fact: { factId: string }, readStandings?: KnowledgeVersionHistoryDeps["readStandings"]) =>
      readKnowledgeVersionHistory(aliceCtx, fact.factId, { getDb: () => handle.db, ...(readStandings ? { readStandings } : {}) });
    const shared = (claims: Parameters<typeof readKnowledgeGovernanceStandings>[1]) => readKnowledgeGovernanceStandings(aliceCtx, claims);
    const h1 = await history(confirmed, shared);
    const h2 = await history(forged, shared);
    assert.ok(h1.status === "read" && h1.versions[0]!.governanceStanding === "ratified", "G/A: the ratified version reads ratified");
    assert.ok(h2.status === "read" && h2.versions[0]!.governanceStanding === "unconfirmed", "G/B: the forged version reads unconfirmed");
    assert.ok(h2.status === "read" && h2.versions[0]!.ratified === true, "G: the record's own claim is still reported as what it is");
    const h3 = await history(forged, async () => { throw new Error("governance down"); });
    assert.ok(h3.status === "read" && h3.versions[0]!.governanceStanding === "unavailable", "G/D: an unanswered reading is unavailable");
    const h4 = await history(forged);
    assert.ok(h4.status === "read" && h4.versions[0]!.governanceStanding === undefined, "G: no reader, no standing — the released shape");
    const crossTenant = await readKnowledgeVersionHistory(bobCtx, forged.factId, { getDb: () => handle.db, readStandings: shared });
    assert.equal(crossTenant.status, "unavailable", "E: another tenant's version history is not found");

    console.log("PASS kgsc-1 standing-postgres");
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    await setup.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
