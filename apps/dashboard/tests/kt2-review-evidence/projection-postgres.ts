/*
 * KT-2 — the evidence supplied to generation, projected for the reviewer of ONE EXACT revision,
 * against a REAL PostgreSQL DB.
 *
 * THE CLAIMS UNDER TEST:
 *   - the reviewer sees the Knowledge evidence RECORDED WITH the message that generated this exact
 *     revision — and only that revision's;
 *   - the gate is the revision row inside the authenticated tenant: another revision, another
 *     artifact or another tenant resolves to nothing of this one;
 *   - "no Knowledge selected", "no retrieval recorded", "no generating message" and "could not be
 *     read" are four different answers and stay four different answers;
 *   - the evidence is HISTORICAL: superseding or rejecting the Knowledge afterwards does not change
 *     what the projection reports, and current retrieval is never consulted;
 *   - reading writes nothing.
 *
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { readRejectedKnowledgeVersions } from "../../src/features/governance-decision/knowledge-rejection-read.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import { supersedeKnowledgeFact } from "../../src/features/knowledge/knowledge-supersede.server";
import { listKnowledgeSources, searchKnowledge } from "../../src/features/knowledge/knowledge-read.server";
import { rejectKnowledgeVersion } from "../../src/features/knowledge-ratification/ratify-version.server";
import { createDurableKnowledgeWriter } from "../../src/features/knowledge/durable-knowledge-writer.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import { toStoredEvidence } from "../../src/features/heby-conversation/answer-evidence";
import { buildRetrievalEvidence } from "../../src/features/knowledge-retrieval";
import { readRevisionGenerationEvidence } from "../../src/features/heby-answer/revision-generation-evidence.server";
import { readArtifactRevisionReviewStates } from "../../src/features/work-artifact-review/review-revision.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-10-03T09:00:00.000Z");
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
    requestId: "kt2-request",
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

async function establishGovernance(client: Client, seeded: Seeded, ctx: TenantContext, deps: never): Promise<void> {
  await client.query(
    `insert into genesis_nominations
       (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
        accepted_at, accepted_session_context_id, accepted_assurance_level)
     values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
    [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
  );
  const result = await establishGovernanceAuthority(
    ctx,
    { justification: "Establishing Governance authority so prepared work can be reviewed." },
    deps,
  );
  assert.equal(result.status, "established");
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_kt2_review_evidence");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;

  try {
    harness.migrateDatabase();
    await setup.connect();

    const writer = createDurableKnowledgeWriter(handle.db);
    const knowledgeRepo = createDurableKnowledgeRepository(handle.db);
    const conversations = createDurableConversationRepository(handle.db);
    const knowledgeDeps = {
      resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
      getWriter: () => writer,
      getRepo: () => knowledgeRepo,
      getRepository: () => knowledgeRepo,
      now: () => NOW,
    } as never;
    const searchDeps = {
      getRepo: () => knowledgeRepo,
      now: () => NOW,
      readRejectedKnowledgeVersions: (tenant: { readonly tenantId: string }) =>
        readRejectedKnowledgeVersions(tenant, { getDb: () => handle.db }),
    };
    const projectionDeps = { getDb: () => handle.db, getConversationRepo: () => conversations };

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

    /* ── Knowledge the generation will be grounded on ───────────────────────── */
    const created = await createKnowledgeFact(
      aliceCtx,
      {
        factKey: "kt2.offering",
        domainKey: "products",
        scope: "company-wide",
        title: "Zanzibar product offering",
        statement: "Zanzibar sells handmade rugs and kilims.",
      },
      knowledgeDeps,
    );
    assert.equal(created.status, "created");
    if (created.status !== "created") throw new Error("unreachable");
    const factId = created.identity.factId;
    const listing = await listKnowledgeSources(aliceCtx, knowledgeDeps);
    const v1Node = listing.status === "read" ? listing.records.find((r) => r.factId === factId)!.activeKnowledgeNodeId! : "";
    assert.ok(v1Node);

    /** One generated turn, persisted exactly as the answer flow persists it: message + evidence in one transaction. */
    const generatedTurn = async (ctx: TenantContext, query: string, withRetrieval: boolean) => {
      const result = await searchKnowledge(ctx, { queryText: query }, searchDeps);
      const evidence = withRetrieval ? toStoredEvidence(buildRetrievalEvidence(result, query)) : undefined;
      const persisted = await conversations.persistExchange(
        { tenantId: ctx.tenantId, actorId: ctx.userId },
        {
          subject: "kt2",
          userContent: query,
          assistant: { role: "assistant", content: `Draft for: ${query}`, origin: "model" },
          ...(evidence ? { evidence } : {}),
        },
      );
      return persisted.assistantMessageId;
    };

    const artifact = async (tenantId: string, title: string) => {
      const row = await setup.query<{ id: string }>(
        `insert into work_artifacts (tenant_id, artifact_type, title, owner_workspace, current_revision, intended_destination)
         values ($1, 'content-draft', $2, 'operations', 1, 'instagram') returning id`,
        [tenantId, title],
      );
      return row.rows[0]!.id;
    };
    const revision = async (
      tenantId: string,
      artifactId: string,
      revisionNo: number,
      content: string,
      sourceMessageId: string | null,
    ) => {
      const row = await setup.query<{ id: string }>(
        `insert into work_artifact_revisions
           (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type,
            authored_by_actor_id, source_message_id)
         values ($1, $2, $3, $4, $5, 'human', $6, $7) returning id`,
        [
          tenantId,
          artifactId,
          revisionNo,
          content,
          createHash("sha256").update(content).digest("hex"),
          randomUUID(),
          sourceMessageId,
        ],
      );
      await setup.query(`update work_artifacts set current_revision=$2 where id=$1`, [artifactId, revisionNo]);
      return row.rows[0]!.id;
    };

    const draft = await artifact(alice.tenantId, "Zanzibar Instagram draft");
    const groundedMessage = await generatedTurn(aliceCtx, "zanzibar handmade rugs", true);
    const rev1 = await revision(alice.tenantId, draft, 1, "Handmade Zanzibar rugs.", groundedMessage);
    const emptyMessage = await generatedTurn(aliceCtx, "xylophone orchestra", true);
    const rev2 = await revision(alice.tenantId, draft, 2, "A calmer caption.", emptyMessage);
    const unrecordedMessage = await generatedTurn(aliceCtx, "zanzibar handmade rugs", false);
    const rev3 = await revision(alice.tenantId, draft, 3, "Another caption.", unrecordedMessage);
    const rev4 = await revision(alice.tenantId, draft, 4, "Typed by a human.", null);

    /* ── 1, 8: the exact revision's recorded evidence, with its version identity ─ */
    {
      const seen = await readRevisionGenerationEvidence(aliceCtx, { artifactId: draft, revisionId: rev1 }, projectionDeps);
      assert.equal(seen.status, "recorded");
      if (seen.status !== "recorded") throw new Error("unreachable");
      assert.equal(seen.revisionNo, 1);
      assert.equal(seen.selection.status, "matched");
      assert.equal(seen.items.length, 1);
      const item = seen.items[0]!;
      assert.equal(item.factKey, "kt2.offering");
      assert.equal(item.title, "Zanzibar product offering");
      assert.equal(item.knowledgeNodeId, v1Node, "the exact version row the generation was given");
      assert.equal(item.knowledgeVersion, 1);
      assert.equal(item.excerpt, "Zanzibar sells handmade rugs and kilims.");
      assert.equal(item.ratifiedAtGeneration, false, "the standing recorded at generation, not today's");
      assert.ok(!("sourceMessageId" in seen), "the message id is an internal; the reviewer is given the evidence, not the key");
    }

    /* ── 4: retrieval ran and selected nothing — said explicitly ─────────────── */
    {
      const seen = await readRevisionGenerationEvidence(aliceCtx, { artifactId: draft, revisionId: rev2 }, projectionDeps);
      assert.equal(seen.status, "recorded");
      if (seen.status === "recorded") {
        assert.equal(seen.selection.status, "no-match");
        assert.deepEqual(seen.items, [], "no Knowledge evidence was selected");
      }
    }

    /* ── 6: the generating message exists, but no retrieval was recorded with it ─ */
    assert.deepEqual(
      await readRevisionGenerationEvidence(aliceCtx, { artifactId: draft, revisionId: rev3 }, projectionDeps),
      { status: "no-retrieval-recorded", revisionNo: 3 },
    );

    /* ── 5: no generating message at all ──────────────────────────────────────── */
    assert.deepEqual(
      await readRevisionGenerationEvidence(aliceCtx, { artifactId: draft, revisionId: rev4 }, projectionDeps),
      { status: "no-generation-message", revisionNo: 4 },
    );

    /* ── 2: revision A cannot be answered with revision B's evidence ──────────── */
    {
      const other = await artifact(alice.tenantId, "Another draft");
      const foreignRev = await revision(alice.tenantId, other, 1, "Unrelated.", emptyMessage);
      // The pair must belong together: rev1 named under the other artifact resolves to nothing.
      assert.deepEqual(
        await readRevisionGenerationEvidence(aliceCtx, { artifactId: other, revisionId: rev1 }, projectionDeps),
        { status: "revision-unresolvable" },
      );
      const seen = await readRevisionGenerationEvidence(aliceCtx, { artifactId: other, revisionId: foreignRev }, projectionDeps);
      assert.equal(seen.status, "recorded");
      if (seen.status === "recorded") assert.deepEqual(seen.items, [], "each revision answers with its own message's evidence");
      for (const bad of [
        { artifactId: draft, revisionId: randomUUID() },
        { artifactId: "not-a-uuid", revisionId: rev1 },
        { artifactId: draft, revisionId: "'; drop table messages; --" },
      ]) {
        assert.deepEqual(await readRevisionGenerationEvidence(aliceCtx, bad, projectionDeps), { status: "revision-unresolvable" });
      }
    }

    /* ── 3: another tenant reaches nothing of this one ────────────────────────── */
    {
      assert.deepEqual(
        await readRevisionGenerationEvidence(bobCtx, { artifactId: draft, revisionId: rev1 }, projectionDeps),
        { status: "revision-unresolvable" },
        "Globex cannot see — or confirm the existence of — Acme's revision",
      );
      assert.deepEqual(await readRevisionGenerationEvidence(null, { artifactId: draft, revisionId: rev1 }, projectionDeps), {
        status: "unauthorized",
      });
    }

    /* ── 7: provenance that cannot be read fails closed ───────────────────────── */
    {
      assert.deepEqual(
        await readRevisionGenerationEvidence(aliceCtx, { artifactId: draft, revisionId: rev1 }, { getDb: () => null, getConversationRepo: () => conversations }),
        { status: "unavailable", reason: "persistence-unavailable" },
      );
      assert.deepEqual(
        await readRevisionGenerationEvidence(aliceCtx, { artifactId: draft, revisionId: rev1 }, { getDb: () => handle.db, getConversationRepo: () => null }),
        { status: "unavailable", reason: "persistence-unavailable" },
      );
      const broken = { ...conversations, listAnswerEvidence: async () => { throw new Error("evidence store unreachable"); } };
      assert.deepEqual(
        await readRevisionGenerationEvidence(aliceCtx, { artifactId: draft, revisionId: rev1 }, { getDb: () => handle.db, getConversationRepo: () => broken }),
        { status: "unavailable", reason: "provenance-unreadable" },
      );
      const brokenDb = { select: () => { throw new Error("revision store unreachable"); } } as never;
      assert.deepEqual(
        await readRevisionGenerationEvidence(aliceCtx, { artifactId: draft, revisionId: rev1 }, { getDb: () => brokenDb, getConversationRepo: () => conversations }),
        { status: "unavailable", reason: "persistence-unavailable" },
      );
    }

    /* ── 9, 10, 16: later Knowledge changes do not rewrite history ────────────── */
    {
      const superseded = await supersedeKnowledgeFact(
        aliceCtx,
        { factId, title: "Zanzibar product offering", statement: "Zanzibar sells kilims.", observedKnowledgeVersion: 1 },
        knowledgeDeps,
      );
      assert.equal(superseded.status, "superseded");
      const after = await listKnowledgeSources(aliceCtx, knowledgeDeps);
      const v2Node = after.status === "read" ? after.records.find((r) => r.factId === factId)!.activeKnowledgeNodeId! : "";
      // Phase 1 still holds: the current version can be rejected, and is then not served.
      const rejected = await rejectKnowledgeVersion(
        aliceCtx,
        { factId, knowledgeNodeId: v2Node, observedKnowledgeVersion: 2, justification: REASON },
        deps,
      );
      assert.equal(rejected.status, "rejected");
      const current = await searchKnowledge(aliceCtx, { queryText: "zanzibar kilims" }, searchDeps);
      assert.equal(current.status, "no-match", "the rejected current version is not served today");

      const seen = await readRevisionGenerationEvidence(aliceCtx, { artifactId: draft, revisionId: rev1 }, projectionDeps);
      assert.equal(seen.status, "recorded");
      if (seen.status === "recorded") {
        assert.equal(seen.items.length, 1, "what generation was given is still exactly what it was given");
        assert.equal(seen.items[0]!.knowledgeNodeId, v1Node);
        assert.equal(seen.items[0]!.knowledgeVersion, 1);
        assert.equal(seen.items[0]!.excerpt, "Zanzibar sells handmade rugs and kilims.");
      }
    }

    /* ── 11, 12: reading writes nothing, and the review lifecycle is untouched ── */
    {
      const counts = async () =>
        (
          await setup.query(
            `select (select count(*) from decision_records)::int d, (select count(*) from audit_log)::int a,
                    (select count(*) from messages)::int m, (select count(*) from heby_answer_evidence_set)::int s,
                    (select count(*) from heby_answer_evidence_item)::int i, (select count(*) from knowledge_nodes)::int n,
                    (select count(*) from work_artifact_revisions)::int r,
                    (select md5(string_agg(row_to_json(w)::text, '|' order by id)) from work_artifacts w) w`,
          )
        ).rows[0];
      const before = await counts();
      const reviewBefore = await readArtifactRevisionReviewStates(aliceCtx, draft, deps);
      for (const revisionId of [rev1, rev2, rev3, rev4]) {
        await readRevisionGenerationEvidence(aliceCtx, { artifactId: draft, revisionId }, projectionDeps);
      }
      assert.deepEqual(await counts(), before, "the projection wrote nothing anywhere");
      assert.deepEqual(await readArtifactRevisionReviewStates(aliceCtx, draft, deps), reviewBefore, "review state is not touched");
    }

    console.log("PASS kt2 review evidence projection (postgres)");
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
