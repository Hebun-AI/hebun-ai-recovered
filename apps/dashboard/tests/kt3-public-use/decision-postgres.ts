/*
 * KT-3 — the public-use decision against a REAL PostgreSQL DB.
 *
 * THE CLAIMS UNDER TEST:
 *   - no decision is UNKNOWN, and UNKNOWN is not DENIED;
 *   - allow / deny / revoke move an exact version through four transitions, and nothing else;
 *   - the decision is bound to the version ROW: a superseding version starts UNKNOWN;
 *   - truth and use are independent in both directions, and the truth lifecycle is unchanged;
 *   - deciding writes the Governance ledger and its audit, and NOTHING in Knowledge;
 *   - a projection that cannot be read is unavailable — never ALLOWED;
 *   - the horizon lists undecided public use as its own source, apart from truth review;
 *   - nothing is enforced yet: retrieval (Phase 1) and the review evidence (Phase 2) are unchanged.
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
import { readDecidedKnowledgeVersions } from "../../src/features/governance-decision/knowledge-decision-read.server";
import { readKnowledgePublicUse } from "../../src/features/governance-decision/knowledge-public-use-read.server";
import { decideKnowledgePublicUse } from "../../src/features/knowledge-public-use/decide-public-use.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import { supersedeKnowledgeFact } from "../../src/features/knowledge/knowledge-supersede.server";
import { listKnowledgeSources, searchKnowledge } from "../../src/features/knowledge/knowledge-read.server";
import { readCurrentKnowledgeVersions } from "../../src/features/knowledge/current-versions-read.server";
import {
  ratifyKnowledgeVersion,
  rejectKnowledgeVersion,
} from "../../src/features/knowledge-ratification/ratify-version.server";
import { createDurableKnowledgeWriter } from "../../src/features/knowledge/durable-knowledge-writer.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import { toStoredEvidence } from "../../src/features/heby-conversation/answer-evidence";
import { buildRetrievalEvidence } from "../../src/features/knowledge-retrieval";
import { readRevisionGenerationEvidence } from "../../src/features/heby-answer/revision-generation-evidence.server";
import { readDecisionHorizon } from "../../src/features/decision-horizon/read-decision-horizon.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-10-03T12:00:00.000Z");
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
    requestId: "kt3-request",
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
    [seeded.authIdentityId, tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a"), seeded.userId, seeded.tenantId, seeded.membershipId],
  );
  return row.rows[0]!.id;
}

async function addMember(client: Client, tenantId: string, email: string): Promise<Seeded> {
  const user = await client.query<{ id: string }>(`insert into users (email, name) values ($1, $1) returning id`, [email]);
  const identity = await client.query<{ id: string }>(
    `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
     values ($1, 'local', 'hebun-local', $2, 'active', true, now()) returning id`,
    [user.rows[0]!.id, `local:${email}`],
  );
  const role = await client.query<{ id: string }>(`insert into roles (tenant_id, name, type) values ($1, $2, 'owner') returning id`, [tenantId, `Role ${email}`]);
  const membership = await client.query<{ id: string }>(
    `insert into memberships (tenant_id, user_id, role_id, status) values ($1, $2, $3, 'active') returning id`,
    [tenantId, user.rows[0]!.id, role.rows[0]!.id],
  );
  return { tenantId, userId: user.rows[0]!.id, authIdentityId: identity.rows[0]!.id, membershipId: membership.rows[0]!.id, roleId: role.rows[0]!.id };
}

async function establishGovernance(client: Client, seeded: Seeded, ctx: TenantContext, deps: never): Promise<void> {
  await client.query(
    `insert into genesis_nominations
       (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
        accepted_at, accepted_session_context_id, accepted_assurance_level)
     values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
    [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
  );
  const result = await establishGovernanceAuthority(ctx, { justification: "Establishing Governance authority so Knowledge can be decided." }, deps);
  assert.equal(result.status, "established");
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_kt3_public_use");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;

  try {
    harness.migrateDatabase();
    await setup.connect();

    const writer = createDurableKnowledgeWriter(handle.db);
    const repo = createDurableKnowledgeRepository(handle.db);
    const knowledgeDeps = {
      resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
      getWriter: () => writer,
      getRepo: () => repo,
      getRepository: () => repo,
      now: () => NOW,
    } as never;
    const projection = (ctx: TenantContext | null) => readKnowledgePublicUse(ctx, { getDb: () => handle.db });
    const stateOf = async (ctx: TenantContext, nodeId: string) => {
      const read = await projection(ctx);
      assert.equal(read.status, "read");
      if (read.status !== "read") throw new Error("unreachable");
      return read.states.get(nodeId) ?? "unknown";
    };

    const alice = await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme", email: "alice@acme.test", password: "alice-correct-password-7Qx" });
    const bob = await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex", email: "bob@globex.test", password: "bob-correct-password-4Lm" });
    const dana = await addMember(setup, alice.tenantId, "dana@acme.test");
    const aliceCtx = contextFor(alice, await sessionRowFor(setup, alice, "aaaa"));
    const bobCtx = contextFor(bob, await sessionRowFor(setup, bob, "bbbb"));
    const danaCtx = contextFor(dana, await sessionRowFor(setup, dana, "dddd"));
    await establishGovernance(setup, alice, aliceCtx, deps);
    await establishGovernance(setup, bob, bobCtx, deps);

    const create = async (ctx: TenantContext, factKey: string, statement: string) => {
      const created = await createKnowledgeFact(ctx, { factKey, domainKey: "products", scope: "company-wide", title: `Zanzibar ${factKey}`, statement }, knowledgeDeps);
      assert.equal(created.status, "created");
      if (created.status !== "created") throw new Error("unreachable");
      const listing = await listKnowledgeSources(ctx, knowledgeDeps);
      const record = listing.status === "read" ? listing.records.find((r) => r.factId === created.identity.factId) : undefined;
      return { factId: created.identity.factId, nodeId: record!.activeKnowledgeNodeId!, record: record! };
    };
    const decide = (ctx: TenantContext, f: { factId: string; nodeId: string }, action: "allow" | "deny" | "revoke", version = 1) =>
      decideKnowledgePublicUse(ctx, { factId: f.factId, knowledgeNodeId: f.nodeId, observedKnowledgeVersion: version, action, justification: REASON }, deps);
    const knowledgeSnapshot = async () =>
      (await setup.query(`select md5(string_agg(row_to_json(n)::text,'|' order by id)) n, (select md5(string_agg(row_to_json(f)::text,'|' order by id)) from knowledge_facts f) f from knowledge_nodes n`)).rows[0];

    const offering = await create(aliceCtx, "kt3.offering", "Zanzibar sells handmade rugs.");
    const sourcing = await create(aliceCtx, "kt3.sourcing", "Zanzibar buys rugs from wholesalers.");
    const pricing = await create(aliceCtx, "kt3.pricing", "Zanzibar adds a fixed margin.");

    /* ── 1, 2: no decision is UNKNOWN, and UNKNOWN is not DENIED ─────────────── */
    assert.equal(await stateOf(aliceCtx, offering.nodeId), "unknown");
    {
      const read = await projection(aliceCtx);
      assert.ok(read.status === "read" && read.states.size === 0, "nothing decided means an empty map, not a map of denials");
    }

    /* ── 3, 5, 6, 18: allow → revoke → allow, and Knowledge never changes ────── */
    {
      const before = await knowledgeSnapshot();
      const allowed = await decide(aliceCtx, offering, "allow");
      assert.equal(allowed.status, "decided");
      if (allowed.status === "decided") assert.equal(allowed.state, "allowed");
      assert.equal(await stateOf(aliceCtx, offering.nodeId), "allowed");

      const revoked = await decide(aliceCtx, offering, "revoke");
      assert.equal(revoked.status, "decided");
      assert.equal(await stateOf(aliceCtx, offering.nodeId), "denied");

      const reallowed = await decide(aliceCtx, offering, "allow");
      assert.equal(reallowed.status, "decided");
      assert.equal(await stateOf(aliceCtx, offering.nodeId), "allowed");
      assert.deepEqual(await knowledgeSnapshot(), before, "no Knowledge row, pointer or version changed");

      const ledger = await setup.query<{ decision_type: string; outcome: string; subject_type: string; domain: string }>(
        `select d.decision_type::text, d.outcome, d.subject_type, s.governance_domain::text domain
           from decision_records d join governance_sessions s on s.id = d.session_id
          where d.subject_id = $1 order by d.decided_at, d.created_at`,
        [offering.nodeId],
      );
      assert.deepEqual(ledger.rows.map((r) => [r.decision_type, r.outcome]), [
        ["approve", "public-use-allowed"],
        ["revoke", "public-use-revoked"],
        ["approve", "public-use-allowed"],
      ]);
      assert.ok(ledger.rows.every((r) => r.subject_type === "knowledge_public_use" && r.domain === "knowledge-public-use"));
      const audit = await setup.query<{ n: number }>(
        `select count(*)::int n from audit_log where action='governance.decision.recorded' and metadata->>'subjectId' = $1`,
        [offering.nodeId],
      );
      assert.equal(audit.rows[0]!.n, 3, "each decision filed its Governance audit event");
      const knowledgeAudit = await setup.query<{ n: number }>(`select count(*)::int n from audit_log where entity_type='knowledge_fact' and entity_id=$1 and action <> 'knowledge.create'`, [offering.factId]);
      assert.equal(knowledgeAudit.rows[0]!.n, 0, "and no Knowledge mutation event");
    }

    /* ── 4, 7: deny from UNKNOWN; every other transition refused ─────────────── */
    {
      const denied = await decide(aliceCtx, sourcing, "deny");
      assert.equal(denied.status, "decided");
      assert.equal(await stateOf(aliceCtx, sourcing.nodeId), "denied");
      for (const [f, action] of [
        [sourcing, "deny"],
        [sourcing, "revoke"],
        [offering, "allow"],
        [offering, "deny"],
        [pricing, "revoke"],
      ] as const) {
        assert.deepEqual(await decide(aliceCtx, f, action), { status: "refused", reason: "invalid-transition" }, `${action} refused`);
      }
      assert.equal(await stateOf(aliceCtx, pricing.nodeId), "unknown", "a refused revoke writes nothing");
      // Authority: a Knowledge author who is not the Governance authority is refused.
      assert.deepEqual(await decide(danaCtx, pricing, "allow"), { status: "refused", reason: "not-the-governance-authority" });
      assert.deepEqual(await decide(null as never, pricing, "allow"), { status: "refused", reason: "unauthenticated" });
      assert.deepEqual(
        await decideKnowledgePublicUse(aliceCtx, { factId: pricing.factId, knowledgeNodeId: pricing.nodeId, observedKnowledgeVersion: 1, action: "allow", justification: "short" }, deps),
        { status: "refused", reason: "justification-required" },
      );
      assert.deepEqual(
        await decideKnowledgePublicUse(aliceCtx, { factId: pricing.factId, knowledgeNodeId: pricing.nodeId, observedKnowledgeVersion: 1, action: "publish" as never, justification: REASON }, deps),
        { status: "refused", reason: "invalid-transition" },
      );
    }

    /* ── 12, 13, 14: truth and use are independent, and truth is unchanged ───── */
    {
      // ALLOWED does not ratify.
      const listing = await listKnowledgeSources(aliceCtx, knowledgeDeps);
      const offeringNow = listing.status === "read" ? listing.records.find((r) => r.factId === offering.factId)! : null;
      assert.equal(offeringNow!.ratified, false, "an allowed version is still unratified");
      const decided = await readDecidedKnowledgeVersions(aliceCtx, { getDb: () => handle.db });
      assert.ok(decided.status === "read" && !decided.decidedNodeIds.has(offering.nodeId), "a use decision is not a truth decision");
      // Ratifying does not allow.
      const ratified = await ratifyKnowledgeVersion(aliceCtx, { factId: pricing.factId, knowledgeNodeId: pricing.nodeId, observedKnowledgeVersion: 1, justification: REASON }, deps);
      assert.equal(ratified.status, "ratified", "truth lifecycle unchanged: an allowed/denied neighbour does not block ratification");
      assert.equal(await stateOf(aliceCtx, pricing.nodeId), "unknown", "ratified + unknown");
      // And the ratified offering-independent truth path still works on a use-decided version.
      const ratifyOffering = await ratifyKnowledgeVersion(aliceCtx, { factId: offering.factId, knowledgeNodeId: offering.nodeId, observedKnowledgeVersion: 1, justification: REASON }, deps);
      assert.equal(ratifyOffering.status, "ratified");
      assert.equal(await stateOf(aliceCtx, offering.nodeId), "allowed", "ratified + allowed — two decisions, neither implied the other");
    }

    /* ── 8, 9: bound to the version row; supersede starts UNKNOWN ────────────── */
    {
      const superseded = await supersedeKnowledgeFact(aliceCtx, { factId: offering.factId, title: "Zanzibar kt3.offering", statement: "Zanzibar sells kilims.", observedKnowledgeVersion: 1 }, knowledgeDeps);
      assert.equal(superseded.status, "superseded");
      const listing = await listKnowledgeSources(aliceCtx, knowledgeDeps);
      const v2 = listing.status === "read" ? listing.records.find((r) => r.factId === offering.factId)!.activeKnowledgeNodeId! : "";
      assert.notEqual(v2, offering.nodeId);
      assert.equal(await stateOf(aliceCtx, v2), "unknown", "v1 ALLOWED does not make v2 ALLOWED");
      assert.equal(await stateOf(aliceCtx, offering.nodeId), "allowed", "v1 keeps its own history");
      // History cannot be decided: only the current version.
      assert.deepEqual(await decide(aliceCtx, offering, "revoke"), { status: "refused", reason: "not-the-current-version" });
      assert.deepEqual(await decide(aliceCtx, { factId: offering.factId, nodeId: v2 }, "allow", 1), { status: "refused", reason: "stale-review" });
      const v2Allowed = await decide(aliceCtx, { factId: offering.factId, nodeId: v2 }, "allow", 2);
      assert.equal(v2Allowed.status, "decided");
      // A version Governance REJECTED as untrue cannot be allowed for public use.
      const rejectedFact = await create(aliceCtx, "kt3.rejected", "Zanzibar ships to the moon.");
      const rejected = await rejectKnowledgeVersion(aliceCtx, { factId: rejectedFact.factId, knowledgeNodeId: rejectedFact.nodeId, observedKnowledgeVersion: 1, justification: REASON }, deps);
      assert.equal(rejected.status, "rejected");
      assert.deepEqual(await decide(aliceCtx, rejectedFact, "allow"), { status: "refused", reason: "truth-rejected" });
      assert.equal(await stateOf(aliceCtx, rejectedFact.nodeId), "unknown");
    }

    /* ── 10: tenant isolation ─────────────────────────────────────────────────── */
    {
      const globex = await create(bobCtx, "kt3.globex", "Zanzibar is not Globex.");
      assert.deepEqual(await decide(bobCtx, offering, "revoke", 1), { status: "refused", reason: "version-unresolvable" }, "Globex cannot name Acme's version");
      const bobRead = await projection(bobCtx);
      assert.ok(bobRead.status === "read" && bobRead.states.size === 0, "Acme's decisions are not Globex's");
      assert.equal((await decide(bobCtx, globex, "deny")).status, "decided");
      assert.equal(await stateOf(aliceCtx, globex.nodeId), "unknown", "and Globex's are not Acme's");
    }

    /* ── 11: a projection that cannot be read is unavailable, never ALLOWED ─── */
    {
      assert.deepEqual(await readKnowledgePublicUse(null), { status: "unavailable", reason: "no-authorized-tenant-context" });
      assert.deepEqual(await readKnowledgePublicUse(aliceCtx, { getDb: () => null }), { status: "unavailable", reason: "persistence-not-configured" });
      const broken = { execute: async () => { throw new Error("ledger unreachable"); } } as never;
      assert.deepEqual(await readKnowledgePublicUse(aliceCtx, { getDb: () => broken }), { status: "unavailable", reason: "read-failed" });
    }

    /* ── 19: the horizon keeps truth review and public use apart ─────────────── */
    {
      const horizonDeps = {
        readActionRequests: async () => ({ status: "read" as const, items: [] }),
        readHypotheses: async () => ({ status: "read" as const, hypotheses: [], truncated: false, limit: 0 }),
        readKnowledgeVersions: (t: TenantContext) => readCurrentKnowledgeVersions(t, { getRepo: () => repo, now: () => NOW }),
        readDecidedKnowledge: (t: TenantContext) => readDecidedKnowledgeVersions(t, { getDb: () => handle.db }),
        readRejectedKnowledge: (t: TenantContext) => readRejectedKnowledgeVersions(t, { getDb: () => handle.db }),
        readPublicUse: (t: TenantContext) => readKnowledgePublicUse(t, { getDb: () => handle.db }),
      } as never;
      const horizon = await readDecisionHorizon(aliceCtx, horizonDeps);
      assert.equal(horizon.status, "read");
      if (horizon.status !== "read") throw new Error("unreachable");
      const block = (source: string) => horizon.blocks.find((b) => b.source === source)!;
      const truth = block("knowledge-review");
      const use = block("knowledge-public-use");
      assert.ok(truth.status === "answered" && use.status === "answered");
      if (truth.status !== "answered" || use.status !== "answered") throw new Error("unreachable");
      const listing = await listKnowledgeSources(aliceCtx, knowledgeDeps);
      const current = listing.status === "read" ? listing.records : [];
      const byKey = (key: string) => current.find((r) => r.factKey === key)!.activeKnowledgeNodeId!;
      // Truth awaiting: current versions with no truth decision — offering v2 and sourcing.
      assert.deepEqual(truth.items.map((i) => i.recordId).sort(), [byKey("kt3.offering"), byKey("kt3.sourcing")].sort());
      // Use awaiting: current, not truth-rejected, no use decision — pricing only (offering v2 allowed, sourcing denied).
      assert.deepEqual(use.items.map((i) => i.recordId), [byKey("kt3.pricing")]);
      assert.ok(use.items.every((i) => i.source === "knowledge-public-use"));
      assert.equal(horizon.completeness, "complete");

      const partial = await readDecisionHorizon(aliceCtx, { ...(horizonDeps as object), readPublicUse: async () => ({ status: "unavailable", reason: "read-failed" }) } as never);
      assert.ok(partial.status === "read" && partial.completeness === "partial" && partial.unavailableSources.includes("knowledge-public-use"));
      const truthStill = partial.status === "read" ? partial.blocks.find((b) => b.source === "knowledge-review") : undefined;
      assert.equal(truthStill?.status, "answered", "an unreadable use source does not hide truth review");
    }

    /* ── 15, 16, 17, 21: nothing is enforced yet ─────────────────────────────── */
    {
      const searchDeps = {
        getRepo: () => repo,
        now: () => NOW,
        readRejectedKnowledgeVersions: (t: { readonly tenantId: string }) => readRejectedKnowledgeVersions(t, { getDb: () => handle.db }),
      };
      const found = await searchKnowledge(aliceCtx, { queryText: "zanzibar" }, searchDeps);
      assert.equal(found.status, "matched");
      const keys = found.status === "matched" ? found.candidates.map((c) => c.record.factKey).sort() : [];
      // DENIED sourcing and UNKNOWN pricing are still served; only the truth-rejected record is not (Phase 1).
      assert.deepEqual(keys, ["kt3.offering", "kt3.pricing", "kt3.sourcing"]);
      if (found.status === "matched") assert.deepEqual(found.excluded.map((e) => [e.factKey, e.reason]), [["kt3.rejected", "governance-rejected"]]);

      // Phase 2: the evidence supplied to a generation is still read back exactly as recorded.
      const conversations = createDurableConversationRepository(handle.db);
      const persisted = await conversations.persistExchange(
        { tenantId: aliceCtx.tenantId, actorId: aliceCtx.userId },
        { subject: "kt3", userContent: "zanzibar", assistant: { role: "assistant", content: "Draft", origin: "model" }, evidence: toStoredEvidence(buildRetrievalEvidence(found, "zanzibar")) },
      );
      const artifact = await setup.query<{ id: string }>(
        `insert into work_artifacts (tenant_id, artifact_type, title, owner_workspace, current_revision, intended_destination) values ($1,'content-draft','kt3 draft','operations',1,'instagram') returning id`,
        [aliceCtx.tenantId],
      );
      const revision = await setup.query<{ id: string }>(
        `insert into work_artifact_revisions (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id, source_message_id)
         values ($1,$2,1,'Draft',$3,'human',$4,$5) returning id`,
        [aliceCtx.tenantId, artifact.rows[0]!.id, createHash("sha256").update("Draft").digest("hex"), randomUUID(), persisted.assistantMessageId],
      );
      const evidence = await readRevisionGenerationEvidence(aliceCtx, { artifactId: artifact.rows[0]!.id, revisionId: revision.rows[0]!.id }, { getDb: () => handle.db, getConversationRepo: () => conversations });
      assert.equal(evidence.status, "recorded");
      if (evidence.status === "recorded") assert.deepEqual(evidence.items.map((i) => i.factKey).sort(), keys);
    }

    console.log("PASS kt3 public-use decision (postgres)");
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
