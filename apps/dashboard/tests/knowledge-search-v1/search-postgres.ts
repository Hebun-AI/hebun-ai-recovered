/*
 * KNOWLEDGE-SEARCH-V1 — `/search <query>` against a real PostgreSQL database.
 *
 *   A. Matching: ranked results carry key, title, Knowledge status, Governance standing, excerpt and
 *      `/source <key>`; each key opens the same record through `/source`.
 *   B. Standing is Governance's, not the row's: ratified / none recorded / a forged claim NOT confirmed.
 *   C. A rejected version is never shown — not its text, not its key — only counted, by reason.
 *   D. Tenant isolation: another tenant's record never appears, and its key does not open.
 *   E. The other outcomes: empty query, empty corpus, no match, unauthorized.
 *   F. Fail closed: Governance's rejection read or standing read unavailable → no result at all.
 *
 * Released writers (K2 create/supersede, K4 ratify/reject) seed Knowledge. Disposable database,
 * dropped on exit; no network.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity, type SeededLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import { supersedeKnowledgeFact } from "../../src/features/knowledge/knowledge-supersede.server";
import { ratifyKnowledgeVersion, rejectKnowledgeVersion } from "../../src/features/knowledge-ratification/ratify-version.server";
import { createDurableKnowledgeWriter } from "../../src/features/knowledge/durable-knowledge-writer.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { readKnowledgeGovernanceStandings } from "../../src/features/heby-answer/knowledge-evidence.server";
import { runHebyReadCommand } from "../../src/features/heby-commands/read-commands.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-10-19T09:00:00.000Z");
const REASON = "Governance has reviewed this exact version and records its decision here.";

const RATIFIED = "MARK-RATIFIED-ALICE";
const DRAFT = "MARK-DRAFT-ALICE";
const REJECTED = "MARK-REJECTED-VERSION";
const FORGED = "MARK-FORGED-CLAIM";
const SUPERSEDED_OLD = "MARK-SUPERSEDED-OLD";
const SUPERSEDED_NEW = "MARK-SUPERSEDED-NEW";
const BOB = "MARK-GLOBEX-RATIFIED";

function contextFor(seeded: SeededLocalIdentity, sessionContextId: string = randomUUID()): TenantContext {
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
    requestId: "ks1-request",
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

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ks1_search");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const realFetch = globalThis.fetch;
  let strayNetwork = 0;
  globalThis.fetch = (async () => {
    strayNetwork += 1;
    throw new Error("no network in this suite");
  }) as typeof fetch;

  try {
    harness.migrateDatabase();
    await setup.connect();
    // The default Knowledge and Governance readers resolve THIS disposable database.
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
    const alice = await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-ks1", email: "alice@ks1.test", password: "alice-correct-password-7Qx" });
    const bob = await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-ks1", email: "bob@ks1.test", password: "bob-correct-password-4Lm" });
    const carol = await seedLocalIdentity(setup, { companyName: "Initech", companySlug: "initech-ks1", email: "carol@ks1.test", password: "carol-correct-password-9Zt" });
    const aliceCtx = contextFor(alice, await sessionRowFor(setup, alice, "a"));
    const bobCtx = contextFor(bob, await sessionRowFor(setup, bob, "b"));
    const carolCtx = contextFor(carol);

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

    const create = async (ctx: TenantContext, factKey: string, marker: string) => {
      const created = await createKnowledgeFact(ctx, { factKey, domainKey: "policies", scope: "company-wide", title: `Refund policy ${factKey}`, statement: `Refund policy: ${marker}.` }, knowledgeDeps);
      assert.equal(created.status, "created", JSON.stringify(created));
      if (created.status !== "created") throw new Error("unreachable");
      return { factId: created.identity.factId, nodeId: created.identity.newKnowledgeNodeId! };
    };
    const ratify = async (ctx: TenantContext, fact: { factId: string; nodeId: string }) => {
      const r = await ratifyKnowledgeVersion(ctx, { factId: fact.factId, knowledgeNodeId: fact.nodeId, observedKnowledgeVersion: 1, justification: REASON }, deps);
      assert.equal(r.status, "ratified", JSON.stringify(r));
    };

    await ratify(aliceCtx, await create(aliceCtx, "refunds.ratified", RATIFIED));
    await create(aliceCtx, "refunds.draft", DRAFT);
    const rejected = await create(aliceCtx, "refunds.rejected", REJECTED);
    const rj = await rejectKnowledgeVersion(aliceCtx, { factId: rejected.factId, knowledgeNodeId: rejected.nodeId, observedKnowledgeVersion: 1, justification: REASON }, deps);
    assert.equal(rj.status, "rejected", JSON.stringify(rj));
    const old = await create(aliceCtx, "refunds.superseded", SUPERSEDED_OLD);
    await ratify(aliceCtx, old);
    const sup = await supersedeKnowledgeFact(aliceCtx, { factId: old.factId, title: "Refund policy refunds.superseded", statement: `Refund policy: ${SUPERSEDED_NEW}.`, observedKnowledgeVersion: 1 }, knowledgeDeps);
    assert.equal(sup.status, "superseded", JSON.stringify(sup));
    /* A row naming the genuine ratify decision of ANOTHER version: a claim Governance does not hold. */
    const forged = await create(aliceCtx, "refunds.forged", FORGED);
    const genuine = (await setup.query<{ d: string }>("select ratification_decision_id::text d from knowledge_nodes where statement like $1", [`%${RATIFIED}%`])).rows[0]!.d;
    assert.equal((await setup.query("update knowledge_nodes set ratification_decision_id = $1 where id = $2", [genuine, forged.nodeId])).rowCount, 1);
    await ratify(bobCtx, await create(bobCtx, "refunds.globex", BOB));

    const search = (ctx: TenantContext | null, query: string, extra: Record<string, unknown> = {}) =>
      runHebyReadCommand(
        { commandId: "search", args: [query], route: "/heby" },
        { resolveTenant: async () => ctx, knowledge: { now: () => NOW }, ...extra },
      );
    const okOf = async (pending: ReturnType<typeof search>) => {
      const r = await pending;
      assert.equal(r.status, "ok", JSON.stringify(r));
      if (r.status !== "ok") throw new Error("unreachable");
      return { ...r.result, body: r.result.lines.join("\n") };
    };
    /* The block of lines that belongs to one result, from its heading to the next blank line. */
    const blockOf = (body: string, factKey: string) => {
      const start = body.split("\n").findIndex((line) => / [0-9]+\. /.test(` ${line}`) && line.includes(`. ${factKey} — `));
      assert.ok(start >= 0, `${factKey} is listed`);
      const lines = body.split("\n").slice(start);
      return lines.slice(0, lines.indexOf("")).join("\n");
    };

    /* ── A–C. matching, standing, rejection ─────────────────────────────────────────────── */
    {
      const r = await okOf(search(aliceCtx, "refund policy"));
      assert.equal(r.tone, "info");
      assert.match(r.body, /^Results: 4, best text match first\./);
      assert.match(r.provenance, /tenant-scoped and read-only/);

      const ratified = blockOf(r.body, "refunds.ratified");
      /* K4 ratification binds a Governance decision; it does not move the Knowledge lifecycle. Both are shown as they are. */
      assert.match(ratified, /Knowledge status: draft · provisional/);
      assert.match(ratified, /Ratification: ratified — Governance holds the decision/);
      assert.match(ratified, new RegExp(RATIFIED), "the excerpt is the record's own statement");
      assert.match(ratified, /Read it: \/source refunds\.ratified$/);

      assert.match(blockOf(r.body, "refunds.draft"), /Ratification: none recorded\./);
      const forgedBlock = blockOf(r.body, "refunds.forged");
      assert.match(forgedBlock, /Ratification: NOT confirmed/, "a claim Governance does not hold is shown as such");
      assert.ok(!/Governance holds the decision/.test(forgedBlock), "…and never as approval");
      const superseded = blockOf(r.body, "refunds.superseded");
      assert.match(superseded, new RegExp(SUPERSEDED_NEW), "the active version is what is shown");
      assert.match(superseded, /Ratification: none recorded\./, "the old version's decision does not carry over");
      assert.ok(!r.body.includes(SUPERSEDED_OLD), "the superseded text is not shown");

      assert.ok(!r.body.includes(REJECTED) && !r.body.includes("refunds.rejected"), "a rejected version leaves neither text nor key");
      assert.match(r.body, /Matched but not served: 1 — 1 a version Governance declined\./, "it is counted, by reason only");
      assert.match(r.body, /Lexical search/);

      /* /source consistency: every listed key opens the very record that was listed. */
      const keys = [...r.body.matchAll(/Read it: \/source (\S+)$/gm)].map((m) => m[1]!);
      assert.deepEqual([...keys].sort(), ["refunds.draft", "refunds.forged", "refunds.ratified", "refunds.superseded"]);
      for (const key of keys) {
        const opened = await runHebyReadCommand(
          { commandId: "source", args: [key], route: "/heby" },
          { resolveTenant: async () => aliceCtx, knowledge: { now: () => NOW } },
        );
        assert.equal(opened.status, "ok");
        if (opened.status !== "ok") throw new Error("unreachable");
        assert.equal(opened.result.title, `Knowledge source — ${key}`, `/source ${key} opens the listed record`);
      }
    }

    /* ── D. tenant isolation ─────────────────────────────────────────────────────────────── */
    {
      const a = await okOf(search(aliceCtx, "refund policy"));
      assert.ok(!a.body.includes(BOB) && !a.body.includes("refunds.globex"), "Globex never appears for Acme");
      const b = await okOf(search(bobCtx, "refund policy"));
      assert.match(b.body, /^Results: 1,/);
      assert.match(blockOf(b.body, "refunds.globex"), /Ratification: ratified/);
      for (const marker of [RATIFIED, DRAFT, FORGED, SUPERSEDED_NEW, "refunds.ratified"]) {
        assert.ok(!b.body.includes(marker), `Acme's ${marker} never appears for Globex`);
      }
      const cross = await runHebyReadCommand(
        { commandId: "source", args: ["refunds.globex"], route: "/heby" },
        { resolveTenant: async () => aliceCtx, knowledge: { now: () => NOW } },
      );
      assert.ok(cross.status === "ok" && /No knowledge source named/.test(cross.result.lines[0]!), "another tenant's key does not open");
      /* A forged standing read for the wrong tenant answers nothing about Acme's version. */
      const aliceRecords = (await knowledgeRepo.listFacts({ tenantId: alice.tenantId }, NOW)).records.filter((x) => x.factKey === "refunds.ratified");
      const asBob = await readKnowledgeGovernanceStandings(bobCtx, aliceRecords);
      assert.deepEqual(asBob, { status: "read", standings: ["unconfirmed"] }, "Governance's decision is read in the asking tenant only");
    }

    /* ── E. the other outcomes ───────────────────────────────────────────────────────────── */
    {
      const empty = await okOf(search(aliceCtx, "?!"));
      assert.match(empty.body, /has no searchable word in it, so nothing was searched/);
      const none = await okOf(search(carolCtx, "refund policy"));
      assert.match(none.body, /holds no knowledge records, so there is nothing to search/);
      const miss = await okOf(search(aliceCtx, "zebra"));
      assert.match(miss.body, /No knowledge record matched “zebra”\. Your organization does hold knowledge/);
      assert.ok(!miss.body.includes("Matched but not served"), "no exclusion line when the seam reported none");
      const blank = await okOf(search(aliceCtx, "   "));
      assert.equal(blank.tone, "unavailable");
      assert.match(blank.body, /needs words to look for\. Nothing was read\./);
      assert.deepEqual(await search(null, "refund policy"), { status: "unauthorized" }, "no tenant, no read");
    }

    /* ── F. fail closed ──────────────────────────────────────────────────────────────────── */
    {
      const noRejectionRead = await okOf(
        search(aliceCtx, "refund policy", {
          knowledge: { now: () => NOW, readRejectedKnowledgeVersions: async () => ({ status: "unavailable", reason: "read-failed" }) },
        }),
      );
      assert.equal(noRejectionRead.tone, "unavailable");
      const noStanding = await okOf(
        search(aliceCtx, "refund policy", {
          readKnowledgeStandings: (t: TenantContext, records: never) =>
            readKnowledgeGovernanceStandings(t, records, async () => ({ status: "unavailable" })),
        }),
      );
      assert.equal(noStanding.tone, "unavailable");
      assert.match(noStanding.body, /never presented as approval/);
      const throwing = await okOf(
        search(aliceCtx, "refund policy", {
          readKnowledgeStandings: (t: TenantContext, records: never) =>
            readKnowledgeGovernanceStandings(t, records, async () => {
              throw new Error("connection reset");
            }),
        }),
      );
      assert.equal(throwing.tone, "unavailable", "a thrown read is unavailable, never 'none'");
      for (const blind of [noRejectionRead, noStanding, throwing]) {
        for (const marker of [RATIFIED, DRAFT, FORGED, SUPERSEDED_NEW, "refunds."]) {
          assert.ok(!blind.body.includes(marker), `fail-closed shows no ${marker}`);
        }
      }
    }

    assert.equal(strayNetwork, 0, "no network call was attempted");
    console.log("knowledge-search-v1 postgres checks passed");
  } finally {
    globalThis.fetch = realFetch;
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
