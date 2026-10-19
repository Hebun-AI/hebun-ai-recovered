/*
 * EVIDENCE-DECISION-BRIEF-1 — `/brief <question>` against a real PostgreSQL database.
 *
 *   A. Sections A–F in order; the question is restated.
 *   B. Verified = Governance-confirmed only; a forged ratification claim lands in C, never B (L).
 *   C. Every listed record is traceable: its `/source` key opens the same record.
 *   D. A rejected version leaves no text or key; it is counted by reason in D.
 *   E. Considerations are rule-derived and labelled not AI, not a recommendation, not a decision.
 *   F. Tenant isolation; unauthorized; empty, no-match and empty-corpus outcomes.
 *   G. Fail closed (M): rejection read or Governance standing unreadable → no brief, no record.
 *   H. No network: no model or provider is reached.
 *
 * Seeding is the KNOWLEDGE-SEARCH-V1 fixture (released K2/K4 writers). Disposable database.
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
    requestId: "edb1-request",
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
  const harness = createDisposablePostgresHarness("hebun_edb1_brief");
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
    const alice = await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-edb1", email: "alice@edb1.test", password: "alice-correct-password-7Qx" });
    const bob = await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-edb1", email: "bob@edb1.test", password: "bob-correct-password-4Lm" });
    const carol = await seedLocalIdentity(setup, { companyName: "Initech", companySlug: "initech-edb1", email: "carol@edb1.test", password: "carol-correct-password-9Zt" });
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

    const brief = (ctx: TenantContext | null, question: string, extra: Record<string, unknown> = {}) =>
      runHebyReadCommand(
        { commandId: "brief", args: [question], route: "/heby" },
        { resolveTenant: async () => ctx, knowledge: { now: () => NOW }, ...extra },
      );
    const okOf = async (pending: ReturnType<typeof brief>) => {
      const r = await pending;
      assert.equal(r.status, "ok", JSON.stringify(r));
      if (r.status !== "ok") throw new Error("unreachable");
      return { ...r.result, body: r.result.lines.join("\n") };
    };
    const section = (body: string, from: string, to: string) => body.slice(body.indexOf(from), body.indexOf(to));

    /* ── A–E ─────────────────────────────────────────────────────────────────────────────── */
    {
      const r = await okOf(brief(aliceCtx, "refund policy"));
      assert.equal(r.tone, "info");
      const order = ["A. Question: “refund policy”", "B. Verified evidence", "C. Unverified or limited evidence", "D. Missing or unavailable", "E. Decision considerations", "F. Limitations"].map((h) => r.body.indexOf(h));
      assert.ok(order.every((at) => at >= 0) && order.every((at, i) => i === 0 || at > order[i - 1]!), "A: six sections, in order");

      const B = section(r.body, "B. Verified evidence", "C. Unverified");
      const C = section(r.body, "C. Unverified", "D. Missing");
      const D = section(r.body, "D. Missing", "E. Decision");
      const E = section(r.body, "E. Decision", "F. Limitations");
      const F = r.body.slice(r.body.indexOf("F. Limitations"));

      assert.match(B, /Governance-confirmed \(1\)/);
      assert.ok(B.includes("refunds.ratified") && B.includes(RATIFIED), "B: the Governance-confirmed record and its own text");
      for (const notVerified of ["refunds.forged", "refunds.draft", "refunds.superseded", FORGED, DRAFT]) {
        assert.ok(!B.includes(notVerified), `L/B: ${notVerified} is never verified evidence`);
      }
      assert.match(C, /\(3\)/);
      assert.ok(C.includes("refunds.forged") && /NOT confirmed/.test(C), "L: the forged claim is shown, as not confirmed, in C");
      assert.ok(C.includes("refunds.draft") && C.includes("refunds.superseded"));
      assert.ok(!r.body.includes(SUPERSEDED_OLD), "the superseded text is not shown");

      /* Traceable: every listed key opens the same record through /source. */
      const keys = [...r.body.matchAll(/Source: \/source (\S+)$/gm)].map((m) => m[1]!);
      assert.deepEqual([...keys].sort(), ["refunds.draft", "refunds.forged", "refunds.ratified", "refunds.superseded"]);
      for (const key of keys) {
        const opened = await runHebyReadCommand({ commandId: "source", args: [key], route: "/heby" }, { resolveTenant: async () => aliceCtx, knowledge: { now: () => NOW } });
        assert.ok(opened.status === "ok" && opened.result.title === `Knowledge source — ${key}`, `C: /source ${key} opens it`);
      }

      assert.ok(!r.body.includes(REJECTED) && !r.body.includes("refunds.rejected"), "D: a rejected version leaves neither text nor key");
      assert.match(D, /Matched but not served: 1 — 1 a version Governance declined\./, "D: counted by reason only");

      assert.match(E, /Not AI interpretation, not a recommendation, and not an organizational decision\./);
      assert.match(E, /1 record claims a Governance decision that Governance does not hold/);
      assert.match(E, /2 relevant records have no Governance decision/);
      assert.match(E, /matching record is not in force/);
      for (const banned of [/\byou should\b/i, /\bwe recommend\b/i, /\bconfidence\b/i, /\bscore\b/i, /contradict/i]) {
        assert.ok(!banned.test(r.body), `H: no ${banned}`);
      }
      assert.match(F, /Conflicts have not been evaluated\./);
      assert.match(F, /Missing evidence does not establish that the information does not exist\./);
      assert.match(F, /No AI interpretation was used/);
    }

    /* ── F. tenants and outcomes ─────────────────────────────────────────────────────────── */
    {
      const b = await okOf(brief(bobCtx, "refund policy"));
      assert.match(b.body, /Governance-confirmed \(1\)/);
      assert.ok(b.body.includes("refunds.globex"));
      for (const marker of [RATIFIED, DRAFT, FORGED, SUPERSEDED_NEW, "refunds.ratified"]) assert.ok(!b.body.includes(marker), `Acme's ${marker} never reaches Globex`);
      const a = await okOf(brief(aliceCtx, "refund policy"));
      assert.ok(!a.body.includes(BOB) && !a.body.includes("refunds.globex"), "Globex never reaches Acme");

      const miss = await okOf(brief(aliceCtx, "zebra"));
      assert.match(miss.body, /No Knowledge record your organization holds shares words with this question/);
      assert.match(miss.body, /Governance-confirmed \(0\)/);
      assert.match(miss.body, /Missing evidence does not establish/);
      assert.match((await okOf(brief(carolCtx, "refund policy"))).body, /holds no Knowledge records, so there is no organizational evidence to brief from/);
      assert.match((await okOf(brief(aliceCtx, "?!"))).body, /no searchable word/);
      const blank = await okOf(brief(aliceCtx, "  "));
      assert.equal(blank.tone, "unavailable");
      assert.deepEqual(await brief(null, "refund policy"), { status: "unauthorized" });
    }

    /* ── G. fail closed ──────────────────────────────────────────────────────────────────── */
    {
      const blinds = [
        await okOf(brief(aliceCtx, "refund policy", { knowledge: { now: () => NOW, readRejectedKnowledgeVersions: async () => ({ status: "unavailable", reason: "read-failed" }) } })),
        await okOf(brief(aliceCtx, "refund policy", { readKnowledgeStandings: (t: TenantContext, records: never) => readKnowledgeGovernanceStandings(t, records, async () => ({ status: "unavailable" })) })),
        await okOf(brief(aliceCtx, "refund policy", { readKnowledgeStandings: (t: TenantContext, records: never) => readKnowledgeGovernanceStandings(t, records, async () => { throw new Error("reset"); }) })),
      ];
      for (const blind of blinds) {
        assert.equal(blind.tone, "unavailable");
        for (const marker of [RATIFIED, DRAFT, FORGED, SUPERSEDED_NEW, "refunds.", "B. Verified"]) assert.ok(!blind.body.includes(marker), `M: no ${marker}`);
      }
    }

    assert.equal(strayNetwork, 0, "no network call was attempted");
    console.log("evidence-decision-brief-1 postgres checks passed");
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
