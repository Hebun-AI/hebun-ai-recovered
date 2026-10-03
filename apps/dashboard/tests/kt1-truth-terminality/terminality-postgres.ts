/*
 * KT-1 — truth terminality and rejection retrieval exclusion, against a REAL PostgreSQL DB.
 *
 * THE CLAIMS UNDER TEST:
 *
 *   undecided → ratified   OR   undecided → rejected.   Nothing else, ever, for one version row.
 *
 *   - a rejected version cannot be ratified and cannot be rejected twice;
 *   - a ratified version cannot be rejected and cannot be ratified twice (K4, preserved);
 *   - a rejection writes NOTHING to Knowledge: the row, the fact's active pointer and the version
 *     history are byte-for-byte what they were;
 *   - a rejected version is not served by retrieval, and is still listed and still in history;
 *   - superseding a rejected version produces a NEW, undecided version that is served again — the
 *     rejection belongs to the old row and does not travel;
 *   - Governance's rejection projection is tenant-scoped, and a retrieval that cannot read it
 *     serves NOTHING rather than serving what it could not vouch for.
 *
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { readRejectedKnowledgeVersions } from "../../src/features/governance-decision/knowledge-rejection-read.server";
import { readDecidedKnowledgeVersions } from "../../src/features/governance-decision/knowledge-decision-read.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import { supersedeKnowledgeFact } from "../../src/features/knowledge/knowledge-supersede.server";
import { listKnowledgeSources, searchKnowledge } from "../../src/features/knowledge/knowledge-read.server";
import { readKnowledgeVersionHistory } from "../../src/features/knowledge/knowledge-version-history.server";
import {
  ratifyKnowledgeVersion,
  rejectKnowledgeVersion,
} from "../../src/features/knowledge-ratification/ratify-version.server";
import { createDurableKnowledgeWriter } from "../../src/features/knowledge/durable-knowledge-writer.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { resolveKnowledgeEvidenceDetailed } from "../../src/features/heby-answer/knowledge-evidence.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-10-02T12:00:00.000Z");
const REASON = "Governance has reviewed this exact version and records its decision here.";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded, sessionContextId: string): TenantContext {
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
    requestId: "kt1-request",
    authenticatedAt: NOW.toISOString(),
  });
}

async function sessionRowFor(client: Client, seeded: Seeded, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
             now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [
      seeded.authIdentityId,
      tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a"),
      seeded.userId,
      seeded.tenantId,
      seeded.membershipId,
    ],
  );
  return row.rows[0]!.id;
}

async function establishGovernance(
  client: Client,
  seeded: Seeded,
  ctx: TenantContext,
  deps: { getDb: () => never; now: () => Date },
): Promise<void> {
  await client.query(
    `insert into genesis_nominations
       (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
        accepted_at, accepted_session_context_id, accepted_assurance_level)
     values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
    [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
  );
  const result = await establishGovernanceAuthority(
    ctx,
    { justification: "Establishing Governance authority so Knowledge can be reviewed." },
    deps as never,
  );
  assert.equal(result.status, "established", "the tenant's Governance authority is real");
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_kt1_terminality");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;

  try {
    harness.migrateDatabase();
    await setup.connect();

    const writer = createDurableKnowledgeWriter(handle.db);
    const repo = createDurableKnowledgeRepository(handle.db);
    const authorized = async () => ({ authorized: true, roleType: "owner" });
    const knowledgeDeps = {
      resolveAuthority: authorized,
      getWriter: () => writer,
      getRepo: () => repo,
      getRepository: () => repo,
      now: () => NOW,
    } as never;
    /** Retrieval, with Governance's projection read from THIS database and nothing stubbed. */
    const searchDeps = {
      getRepo: () => repo,
      now: () => NOW,
      readRejectedKnowledgeVersions: (tenant: { readonly tenantId: string }) =>
        readRejectedKnowledgeVersions(tenant, { getDb: () => handle.db }),
    };

    const alice = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "alice@acme.test",
      password: "alice-correct-password-7Qx",
    });
    const bob = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex",
      email: "bob@globex.test",
      password: "bob-correct-password-4Lm",
    });
    const aliceCtx = contextFor(alice, await sessionRowFor(setup, alice, "aaaa"));
    const bobCtx = contextFor(bob, await sessionRowFor(setup, bob, "bbbb"));
    await establishGovernance(setup, alice, aliceCtx, deps);
    await establishGovernance(setup, bob, bobCtx, deps);

    const create = async (ctx: TenantContext, factKey: string, statement: string) => {
      const created = await createKnowledgeFact(
        ctx,
        { factKey, domainKey: "commerce", scope: "company-wide", title: `Zanzibar ${factKey}`, statement },
        knowledgeDeps,
      );
      assert.equal(created.status, "created");
      if (created.status !== "created") throw new Error("unreachable");
      return created.identity.factId;
    };
    const current = async (ctx: TenantContext, factId: string) => {
      const listing = await listKnowledgeSources(ctx, knowledgeDeps);
      assert.equal(listing.status, "read");
      if (listing.status !== "read") throw new Error("unreachable");
      const record = listing.records.find((r) => r.factId === factId);
      assert.ok(record, "the fact is listed");
      return record!;
    };
    const keysOf = (result: Awaited<ReturnType<typeof searchKnowledge>>) =>
      result.status === "matched" ? result.candidates.map((c) => c.record.factKey) : [];
    const decisionsOn = async (nodeId: string) =>
      (
        await setup.query<{ decision_type: string }>(
          `select decision_type::text from decision_records where subject_id=$1 order by decided_at`,
          [nodeId],
        )
      ).rows.map((r) => r.decision_type);

    const alphaId = await create(aliceCtx, "kt1.alpha", "Zanzibar shipping takes nine days.");
    const betaId = await create(aliceCtx, "kt1.beta", "Zanzibar returns are accepted within thirty days.");
    const alpha = await current(aliceCtx, alphaId);
    const beta = await current(aliceCtx, betaId);
    const alphaNode = alpha.activeKnowledgeNodeId!;
    const betaNode = beta.activeKnowledgeNodeId!;

    /* ── 17: NO REJECTION ANYWHERE → RETRIEVAL IS WHAT IT WAS ─────────────────── */
    let baselineKeys: readonly string[];
    {
      const projected = await readRejectedKnowledgeVersions(aliceCtx, { getDb: () => handle.db });
      assert.deepEqual(projected, { status: "read", rejectedNodeIds: new Set() }, "an empty set is a measured answer");

      const found = await searchKnowledge(aliceCtx, { queryText: "zanzibar" }, searchDeps);
      assert.equal(found.status, "matched");
      baselineKeys = keysOf(found);
      assert.deepEqual([...baselineKeys].sort(), ["kt1.alpha", "kt1.beta"]);
      if (found.status === "matched") assert.deepEqual(found.excluded, []);
    }

    /* ── 1, 6, 3: undecided → ratified; then nothing further ──────────────────── */
    {
      const payload = { factId: alphaId, knowledgeNodeId: alphaNode, observedKnowledgeVersion: 1, justification: REASON };
      const ratified = await ratifyKnowledgeVersion(aliceCtx, payload, deps);
      assert.equal(ratified.status, "ratified");

      assert.deepEqual(await ratifyKnowledgeVersion(aliceCtx, payload, deps), {
        status: "refused",
        reason: "already-ratified",
      });
      assert.deepEqual(await rejectKnowledgeVersion(aliceCtx, payload, deps), {
        status: "refused",
        reason: "already-ratified",
      });
      assert.deepEqual(await decisionsOn(alphaNode), ["ratify"], "one truth decision, and only one");
    }

    /* ── 2, 9, 10: undecided → rejected, and Knowledge is untouched ───────────── */
    const snapshot = async (nodeId: string, factId: string) => ({
      node: (await setup.query(`select row_to_json(n)::text j from knowledge_nodes n where id=$1`, [nodeId])).rows[0]!.j,
      fact: (await setup.query(`select row_to_json(f)::text j from knowledge_facts f where id=$1`, [factId])).rows[0]!.j,
      nodes: (await setup.query(`select count(*)::int n from knowledge_nodes where tenant_id=$1`, [alice.tenantId])).rows[0]!.n,
    });
    const betaPayload = { factId: betaId, knowledgeNodeId: betaNode, observedKnowledgeVersion: 1, justification: REASON };
    {
      const before = await snapshot(betaNode, betaId);
      const rejected = await rejectKnowledgeVersion(aliceCtx, betaPayload, deps);
      assert.equal(rejected.status, "rejected");
      assert.deepEqual(await snapshot(betaNode, betaId), before, "a rejection changes no Knowledge row and no pointer");

      const after = await current(aliceCtx, betaId);
      assert.equal(after.activeKnowledgeNodeId, betaNode, "the fact's active version is the same row — no rollback");
      assert.equal(after.lifecycleStatus, beta.lifecycleStatus, "the lifecycle is what it was");
      assert.equal(after.ratified, false);
    }

    /* ── 5, 4: rejected is terminal ───────────────────────────────────────────── */
    {
      assert.deepEqual(await rejectKnowledgeVersion(aliceCtx, betaPayload, deps), {
        status: "refused",
        reason: "already-rejected",
      });
      assert.deepEqual(await ratifyKnowledgeVersion(aliceCtx, betaPayload, deps), {
        status: "refused",
        reason: "already-rejected",
      });
      assert.deepEqual(await decisionsOn(betaNode), ["reject"], "the refusals wrote no further decision");
      const node = await setup.query<{ d: string | null }>(
        `select ratification_decision_id::text d from knowledge_nodes where id=$1`,
        [betaNode],
      );
      assert.equal(node.rows[0]!.d, null, "a refused ratification binds nothing");
    }

    /* ── 7, 8: not served by retrieval; still listed, still in history ────────── */
    {
      const projected = await readRejectedKnowledgeVersions(aliceCtx, { getDb: () => handle.db });
      assert.deepEqual(projected, { status: "read", rejectedNodeIds: new Set([betaNode]) });

      const found = await searchKnowledge(aliceCtx, { queryText: "zanzibar" }, searchDeps);
      assert.equal(found.status, "matched");
      assert.deepEqual(keysOf(found), ["kt1.alpha"]);
      if (found.status === "matched") {
        assert.deepEqual(found.excluded, [
          { factKey: "kt1.beta", domainKey: "commerce", reason: "governance-rejected" },
        ]);
      }

      // A question only the rejected version answers is a NO-MATCH that says why, not an empty corpus.
      const onlyRejected = await searchKnowledge(aliceCtx, { queryText: "returns thirty" }, searchDeps);
      assert.equal(onlyRejected.status, "no-match");
      if (onlyRejected.status === "no-match") {
        assert.deepEqual(onlyRejected.excluded.map((e) => e.reason), ["governance-rejected"]);
      }

      // Heby's evidence is built from the same retrieval, so the rejected statement is not in it.
      const evidence = await resolveKnowledgeEvidenceDetailed(aliceCtx, "zanzibar", searchDeps);
      assert.ok(!JSON.stringify(evidence).includes("thirty days"), "the rejected statement reaches no evidence");
      assert.ok(JSON.stringify(evidence).includes("nine days"));

      const listed = await current(aliceCtx, betaId);
      assert.equal(listed.statement, "Zanzibar returns are accepted within thirty days.", "listing still shows it");
      const history = await readKnowledgeVersionHistory(aliceCtx, betaId, { getDb: () => handle.db });
      assert.equal(history.status, "read");
      if (history.status === "read") assert.equal(history.versions.length, 1, "and so does history");
    }

    /* ── 11, 12: superseding a rejected version yields a NEW undecided version ── */
    {
      const superseded = await supersedeKnowledgeFact(
        aliceCtx,
        {
          factId: betaId,
          title: "Zanzibar kt1.beta",
          statement: "Zanzibar returns are accepted within fourteen days.",
          observedKnowledgeVersion: 1,
        },
        knowledgeDeps,
      );
      assert.equal(superseded.status, "superseded");

      const v2 = await current(aliceCtx, betaId);
      const v2Node = v2.activeKnowledgeNodeId!;
      assert.notEqual(v2Node, betaNode, "a correction is a new row");
      assert.equal(v2.knowledgeVersion, 2);
      assert.equal(v2.ratified, false);
      assert.deepEqual(await decisionsOn(v2Node), [], "v2 is undecided — nothing was inherited");

      const decided = await readDecidedKnowledgeVersions(aliceCtx, { getDb: () => handle.db });
      assert.equal(decided.status, "read");
      if (decided.status === "read") assert.equal(decided.decidedNodeIds.has(v2Node), false);

      const projected = await readRejectedKnowledgeVersions(aliceCtx, { getDb: () => handle.db });
      assert.deepEqual(projected, { status: "read", rejectedNodeIds: new Set([betaNode]) }, "v1 stays rejected; v2 is not");

      const found = await searchKnowledge(aliceCtx, { queryText: "zanzibar" }, searchDeps);
      assert.deepEqual([...keysOf(found)].sort(), ["kt1.alpha", "kt1.beta"], "the successor is served again");
      if (found.status === "matched") {
        assert.deepEqual(found.excluded, []);
        const served = found.candidates.find((c) => c.record.factKey === "kt1.beta")!;
        assert.equal(served.record.statement, "Zanzibar returns are accepted within fourteen days.");
      }

      const history = await readKnowledgeVersionHistory(aliceCtx, betaId, { getDb: () => handle.db });
      if (history.status === "read") assert.equal(history.versions.length, 2, "the rejected v1 is still history");

      // The old row is not the current version any more; it can be decided by nobody, in either direction.
      assert.deepEqual(await ratifyKnowledgeVersion(aliceCtx, betaPayload, deps), {
        status: "refused",
        reason: "not-the-current-version",
      });
      // And the new, undecided version takes its own decision normally.
      const ratifiedV2 = await ratifyKnowledgeVersion(
        aliceCtx,
        { factId: betaId, knowledgeNodeId: v2Node, observedKnowledgeVersion: 2, justification: REASON },
        deps,
      );
      assert.equal(ratifiedV2.status, "ratified");
    }

    /* ── 13: ONE TENANT'S REJECTION IS INVISIBLE TO ANOTHER ───────────────────── */
    {
      const gammaId = await create(bobCtx, "kt1.gamma", "Zanzibar invoices are issued monthly.");
      const gammaNode = (await current(bobCtx, gammaId)).activeKnowledgeNodeId!;
      const bobSearchDeps = { ...searchDeps };

      const bobProjection = await readRejectedKnowledgeVersions(bobCtx, { getDb: () => handle.db });
      assert.deepEqual(bobProjection, { status: "read", rejectedNodeIds: new Set() }, "Acme's rejection is not Globex's");
      assert.deepEqual(keysOf(await searchKnowledge(bobCtx, { queryText: "zanzibar" }, bobSearchDeps)), ["kt1.gamma"]);

      const rejected = await rejectKnowledgeVersion(
        bobCtx,
        { factId: gammaId, knowledgeNodeId: gammaNode, observedKnowledgeVersion: 1, justification: REASON },
        deps,
      );
      assert.equal(rejected.status, "rejected");
      const bobAfter = await searchKnowledge(bobCtx, { queryText: "zanzibar" }, bobSearchDeps);
      assert.equal(bobAfter.status, "no-match");

      const aliceProjection = await readRejectedKnowledgeVersions(aliceCtx, { getDb: () => handle.db });
      assert.equal(aliceProjection.status, "read");
      if (aliceProjection.status === "read") {
        assert.equal(aliceProjection.rejectedNodeIds.has(gammaNode), false, "Globex's rejection is not Acme's");
      }
      assert.deepEqual(
        [...keysOf(await searchKnowledge(aliceCtx, { queryText: "zanzibar" }, searchDeps))].sort(),
        ["kt1.alpha", "kt1.beta"],
      );
      // A context with no tenant reads nothing at all.
      assert.deepEqual(await readRejectedKnowledgeVersions(null, { getDb: () => handle.db }), {
        status: "unavailable",
        reason: "no-authorized-tenant-context",
      });
    }

    /* ── 14: THE PROJECTION CANNOT BE READ → NOTHING IS SERVED ────────────────── */
    {
      assert.deepEqual(await readRejectedKnowledgeVersions(aliceCtx, { getDb: () => null }), {
        status: "unavailable",
        reason: "persistence-not-configured",
      });
      const broken = { execute: async () => { throw new Error("ledger unreachable"); } } as never;
      assert.deepEqual(await readRejectedKnowledgeVersions(aliceCtx, { getDb: () => broken }), {
        status: "unavailable",
        reason: "read-failed",
      });

      for (const reader of [
        async () => ({ status: "unavailable", reason: "read-failed" }) as const,
        async () => { throw new Error("projection threw"); },
      ]) {
        const closed = await searchKnowledge(
          aliceCtx,
          { queryText: "zanzibar" },
          { getRepo: () => repo, now: () => NOW, readRejectedKnowledgeVersions: reader as never },
        );
        assert.equal(closed.status, "unavailable", "unavailable is not 'nothing rejected'");
        if (closed.status === "unavailable") assert.equal(closed.reason, "governance-rejection-unavailable");

        const evidence = await resolveKnowledgeEvidenceDetailed(aliceCtx, "zanzibar", {
          getRepo: () => repo,
          now: () => NOW,
          readRejectedKnowledgeVersions: reader as never,
        });
        assert.equal(evidence.resolution.state, "unavailable");
        assert.ok(!JSON.stringify(evidence).includes("nine days"), "Heby receives no Knowledge it could not vouch for");
        assert.ok(!JSON.stringify(evidence).includes("fourteen days"));
      }

      // Nothing matched means nothing would be served, so the projection is not what decides it.
      const nothing = await searchKnowledge(
        aliceCtx,
        { queryText: "xylophone" },
        {
          getRepo: () => repo,
          now: () => NOW,
          readRejectedKnowledgeVersions: (async () => ({ status: "unavailable", reason: "read-failed" })) as never,
        },
      );
      assert.equal(nothing.status, "no-match");
    }

    console.log("PASS kt1 truth terminality (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
