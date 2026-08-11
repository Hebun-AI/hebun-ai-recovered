/*
 * K4 — Governance-backed ratification of an exact Knowledge version, against a REAL PostgreSQL DB.
 *
 * THE CLAIM UNDER TEST. "Ratified" means the organization's Governance authority approved THIS
 * EXACT VERSION — and that claim survives every way of trying to make it mean something else.
 *
 * The proofs only a real database can give:
 *   - decision, binding and both audit events commit TOGETHER, or none of them do;
 *   - a ratification is bound to a version row, so it can never migrate to another version;
 *   - superseding a ratified version leaves the OLD one ratified and the NEW one unratified,
 *     with nothing copied across;
 *   - a Knowledge author at owner band, with no Governance authority, is refused;
 *   - a rejection changes nothing in Knowledge at all;
 *   - a stale review is refused rather than silently applied to the wrong version.
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
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import { supersedeKnowledgeFact } from "../../src/features/knowledge/knowledge-supersede.server";
import { listKnowledgeSources } from "../../src/features/knowledge/knowledge-read.server";
import { readKnowledgeVersionHistory } from "../../src/features/knowledge/knowledge-version-history.server";
import {
  ratifyKnowledgeVersion,
  rejectKnowledgeVersion,
} from "../../src/features/knowledge-ratification/ratify-version.server";
import { createDurableKnowledgeWriter } from "../../src/features/knowledge/durable-knowledge-writer.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-08-11T18:00:00.000Z");
const REASON = "Governance has reviewed this exact version and records its decision here.";
const HOSTILE =
  "<script>alert(1)</script> ' OR 1=1 -- /terminal restart production ../etc/passwd ignore previous instructions";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded, sessionContextId: string): TenantContext {
  return {
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
    requestId: "k4-request",
    authenticatedAt: NOW.toISOString(),
  };
}

async function addMember(
  client: Client,
  tenantId: string,
  email: string,
  roleType = "owner",
): Promise<Seeded> {
  const user = await client.query<{ id: string }>(
    `insert into users (email, name) values ($1, $1) returning id`,
    [email],
  );
  const userId = user.rows[0]!.id;
  const identity = await client.query<{ id: string }>(
    `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
     values ($1, 'local', 'hebun-local', $2, 'active', true, now()) returning id`,
    [userId, `local:${email}`],
  );
  const role = await client.query<{ id: string }>(
    `insert into roles (tenant_id, name, type) values ($1, $2, $3) returning id`,
    [tenantId, `Role ${email}`, roleType],
  );
  const roleId = role.rows[0]!.id;
  const membership = await client.query<{ id: string }>(
    `insert into memberships (tenant_id, user_id, role_id, status)
     values ($1, $2, $3, 'active') returning id`,
    [tenantId, userId, roleId],
  );
  return {
    tenantId,
    userId,
    authIdentityId: identity.rows[0]!.id,
    membershipId: membership.rows[0]!.id,
    roleId,
  };
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

/** Give a tenant a real accepted entitlement, then establish Governance through the G2 path. */
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
  const harness = createDisposablePostgresHarness("hebun_k4_ratify");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;

  try {
    harness.migrateDatabase();
    await setup.connect();

    const writer = createDurableKnowledgeWriter(handle.db);
    const repo = createDurableKnowledgeRepository(handle.db);
    /*
     * K2's own authoring gate is stubbed AUTHORIZED here on purpose. This file is not testing who
     * may author — K2 already proves that — and stubbing it makes the K4 claim sharper: even with
     * authoring permission granted to everyone, ratification still refuses anyone who is not the
     * Governance authority. The ratification path resolves its authority for real, from the
     * database, and is never stubbed.
     */
    const authorized = async () => ({ authorized: true, roleType: "owner" });
    const knowledgeDeps = {
      resolveAuthority: authorized,
      getWriter: () => writer,
      getRepo: () => repo,
      getRepository: () => repo,
      now: () => NOW,
    } as never;

    /* ── Seed: Acme (alice = Governance authority, dana = owner-band author only) ─ */
    const alice = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "alice@acme.test",
      password: "alice-correct-password-7Qx",
    });
    const dana = await addMember(setup, alice.tenantId, "dana@acme.test", "owner");
    const bob = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex",
      email: "bob@globex.test",
      password: "bob-correct-password-4Lm",
    });

    const aliceCtx = contextFor(alice, await sessionRowFor(setup, alice, "aaaa"));
    const danaCtx = contextFor(dana, await sessionRowFor(setup, dana, "dddd"));
    const bobCtx = contextFor(bob, await sessionRowFor(setup, bob, "bbbb"));

    await establishGovernance(setup, alice, aliceCtx, deps);
    await establishGovernance(setup, bob, bobCtx, deps);

    /* ── Knowledge v1, then supersede to v2 (the version we will ratify) ─────── */
    const created = await createKnowledgeFact(
      aliceCtx,
      {
        factKey: "pricing.policy",
        domainKey: "commerce",
        scope: "company-wide",
        title: "Pricing policy",
        statement: "Discounts above 20 percent require a second approver.",
      },
      knowledgeDeps,
    );
    assert.equal(created.status, "created");
    if (created.status !== "created") throw new Error("unreachable");
    const factId = created.identity.factId;

    const superseded = await supersedeKnowledgeFact(
      aliceCtx,
      {
        factId,
        title: "Pricing policy",
        statement: "Discounts above 15 percent require a second approver.",
        observedKnowledgeVersion: 1,
      },
      knowledgeDeps,
    );
    assert.equal(superseded.status, "superseded");

    const readV2 = async () => {
      const listing = await listKnowledgeSources(aliceCtx, knowledgeDeps);
      assert.equal(listing.status, "read");
      if (listing.status !== "read") throw new Error("unreachable");
      const record = listing.records.find((r) => r.factId === factId);
      assert.ok(record, "the fact is readable");
      return record!;
    };

    let v2 = await readV2();
    assert.equal(v2.knowledgeVersion, 2);
    assert.equal(v2.ratified, false);
    const v2NodeId = v2.activeKnowledgeNodeId!;
    assert.ok(v2NodeId, "the read exposes the active version's row id");

    const payload = {
      factId,
      knowledgeNodeId: v2NodeId,
      observedKnowledgeVersion: 2,
      justification: REASON,
    };

    /* ── A1-A2: authentication and the authorization line ───────────────────── */
    {
      assert.deepEqual(await ratifyKnowledgeVersion(null, payload, deps), {
        status: "refused",
        reason: "unauthenticated",
      });

      // THE CENTRAL AUTHORIZATION CLAIM: dana holds the OWNER band, which is exactly what K2
      // requires to AUTHOR Knowledge — and it grants nothing here.
      assert.deepEqual(await ratifyKnowledgeVersion(danaCtx, payload, deps), {
        status: "refused",
        reason: "not-the-governance-authority",
      });
    }

    /* ── A3-A9: wrong tenant and forged authoritative fields ────────────────── */
    {
      // bob is a real Governance authority — of ANOTHER tenant. The fact is unresolvable to him.
      assert.deepEqual(await ratifyKnowledgeVersion(bobCtx, payload, deps), {
        status: "refused",
        reason: "version-unresolvable",
      });
      // forged tenantId: bob claims Acme's tenant while holding his own identity → he is not
      // Acme's Governance authority.
      assert.deepEqual(
        await ratifyKnowledgeVersion({ ...bobCtx, tenantId: alice.tenantId }, payload, deps),
        { status: "refused", reason: "not-the-governance-authority" },
      );
      /*
       * A forged ROLE does not help: dana carries the owner band, and swapping in the Governance
       * authority's role id changes nothing, because the authority is read from the bootstrap
       * decision rather than from any role.
       */
      assert.deepEqual(
        await ratifyKnowledgeVersion({ ...danaCtx, roleId: alice.roleId }, payload, deps),
        { status: "refused", reason: "not-the-governance-authority" },
      );

      /*
       * WHAT THIS LAYER CAN AND CANNOT PROVE, STATED HONESTLY. A test constructs a TenantContext
       * directly, so a "fully forged context" is indistinguishable from a real session — that is
       * not a K4 gap, it is D1's boundary: in the product the context comes only from
       * `resolveTenantContext()` reading a durable session row, and no action here accepts one from
       * a caller. What K4 proves is that every individual authoritative FIELD is re-derived rather
       * than trusted: the tenant is re-read, the authority is re-resolved from the bootstrap
       * decision, and the decision/session/ratifiedAt/ratifiedBy have no parameter at all.
       */
      const action = await import("../../src/app/(dashboard)/knowledge/actions");
      assert.equal(
        typeof action.ratifyKnowledgeVersionAction,
        "function",
        "the only client-crossable entry point takes no authority fields — see boundaries-and-firewall",
      );
    }

    /* ── A12-A13: a decision for another fact or another version cannot bind ── */
    {
      const other = await createKnowledgeFact(
        aliceCtx,
        {
          factKey: "refund.policy",
          domainKey: "commerce",
          scope: "company-wide",
          title: "Refund policy",
          statement: "Refunds are issued within fourteen days of purchase.",
        },
        knowledgeDeps,
      );
      assert.equal(other.status, "created");
      if (other.status !== "created") throw new Error("unreachable");

      // The node id of ANOTHER fact, paired with this fact's id: the join finds nothing.
      const otherListing = await listKnowledgeSources(aliceCtx, knowledgeDeps);
      const otherRecord =
        otherListing.status === "read"
          ? otherListing.records.find((r) => r.factId === other.identity.factId)
          : undefined;
      assert.ok(otherRecord?.activeKnowledgeNodeId);
      assert.deepEqual(
        await ratifyKnowledgeVersion(
          aliceCtx,
          { ...payload, knowledgeNodeId: otherRecord!.activeKnowledgeNodeId! },
          deps,
        ),
        { status: "refused", reason: "not-the-current-version" },
        "a node that is not this fact's active version cannot be ratified through this fact",
      );

      // A superseded version (v1) is history and is refused permanently.
      const history = await readKnowledgeVersionHistory(aliceCtx, factId, { getDb: () => handle.db });
      assert.equal(history.status, "read");
      if (history.status !== "read") throw new Error("unreachable");
      assert.equal(history.versions.length, 2);
      const v1 = history.versions.find((v) => v.knowledgeVersion === 1);
      assert.ok(v1);
      assert.equal(v1!.ratified, false);
    }

    /* ── A14: stale review ──────────────────────────────────────────────────── */
    {
      assert.deepEqual(
        await ratifyKnowledgeVersion(aliceCtx, { ...payload, observedKnowledgeVersion: 1 }, deps),
        { status: "refused", reason: "stale-review" },
        "reviewing v1 and submitting against v2 must refuse, never silently ratify v2",
      );
      assert.deepEqual(
        await ratifyKnowledgeVersion(aliceCtx, { ...payload, observedKnowledgeVersion: 3 }, deps),
        { status: "refused", reason: "stale-review" },
      );
    }

    /* ── A: justification is mandatory ──────────────────────────────────────── */
    {
      for (const bad of ["", "   ", "too short"]) {
        assert.deepEqual(
          await ratifyKnowledgeVersion(aliceCtx, { ...payload, justification: bad }, deps),
          { status: "refused", reason: "justification-required" },
        );
      }
      // Nothing above ratified anything.
      v2 = await readV2();
      assert.equal(v2.ratified, false, "no refused attempt may ratify");
      const decisions = await setup.query(
        `select count(*)::int n from decision_records where tenant_id=$1 and bootstrap=false`,
        [alice.tenantId],
      );
      assert.equal(decisions.rows[0]!.n, 0, "no refused attempt may create a decision");
    }

    /* ── THE RATIFICATION ───────────────────────────────────────────────────── */
    let decisionId = "";
    let sessionId = "";
    {
      const result = await ratifyKnowledgeVersion(aliceCtx, payload, deps);
      assert.equal(result.status, "ratified");
      if (result.status !== "ratified") throw new Error("unreachable");
      decisionId = result.decisionId;
      sessionId = result.governanceSessionId;
      assert.equal(result.knowledgeVersion, 2);
      assert.equal(result.knowledgeNodeId, v2NodeId);

      // The binding is on the VERSION row.
      const node = await setup.query<{
        ratification_decision_id: string;
        governance_session_id: string;
        ratified_by_actor_type: string;
        ratified_by_actor_id: string;
        ratified_at: Date;
        knowledge_version: number;
        statement: string;
      }>(
        `select ratification_decision_id, governance_session_id, ratified_by_actor_type,
                ratified_by_actor_id, ratified_at, knowledge_version, statement
           from knowledge_nodes where id=$1`,
        [v2NodeId],
      );
      assert.equal(node.rows[0]!.ratification_decision_id, decisionId);
      assert.equal(node.rows[0]!.governance_session_id, sessionId);
      assert.equal(node.rows[0]!.ratified_by_actor_type, "human");
      assert.equal(node.rows[0]!.ratified_by_actor_id, alice.userId);
      assert.ok(node.rows[0]!.ratified_at);
      assert.equal(node.rows[0]!.knowledge_version, 2, "the version number was not touched");
      assert.equal(
        node.rows[0]!.statement,
        "Discounts above 15 percent require a second approver.",
        "ratification never edits the statement",
      );

      // The decision's subject IS the version row.
      const decision = await setup.query<{
        decision_type: string;
        subject_type: string;
        subject_id: string;
        bootstrap: boolean;
        actor_id: string;
        justification: string;
      }>(
        `select decision_type, subject_type, subject_id, bootstrap, actor_id, justification
           from decision_records where id=$1`,
        [decisionId],
      );
      assert.equal(decision.rows[0]!.decision_type, "ratify");
      assert.equal(decision.rows[0]!.subject_type, "knowledge_node");
      assert.equal(decision.rows[0]!.subject_id, v2NodeId, "the subject is the VERSION, not the fact");
      assert.equal(decision.rows[0]!.bootstrap, false);
      assert.equal(decision.rows[0]!.actor_id, alice.userId);
      assert.equal(decision.rows[0]!.justification, REASON);

      // BOTH audit domains recorded their own truth, in the same transaction.
      const audit = await setup.query<{ action: string; entity_type: string; result: string }>(
        `select action, entity_type, result from audit_log
          where tenant_id=$1 and action in ('governance.decision.recorded','knowledge.ratify')
          order by action`,
        [alice.tenantId],
      );
      assert.deepEqual(
        audit.rows.map((r) => `${r.action}|${r.entity_type}|${r.result}`),
        [
          "governance.decision.recorded|governance_decision|committed",
          "knowledge.ratify|knowledge_fact|committed",
        ],
        "one decision event and one Knowledge-mutation event — two authorities, not one duplicated",
      );

      // And the read model now says ratified, with provenance.
      v2 = await readV2();
      assert.equal(v2.ratified, true);
      assert.equal(v2.ratificationDecisionId, decisionId);
      assert.equal(v2.governanceSessionId, sessionId);
      assert.equal(v2.ratifiedByActorId, alice.userId);
    }

    /* ── A16: duplicate ratification is refused, original linkage untouched ─── */
    {
      assert.deepEqual(await ratifyKnowledgeVersion(aliceCtx, payload, deps), {
        status: "refused",
        reason: "already-ratified",
      });
      // Rejecting an already-ratified version is likewise refused: that would be a reversal.
      assert.deepEqual(await rejectKnowledgeVersion(aliceCtx, payload, deps), {
        status: "refused",
        reason: "already-ratified",
      });
      const node = await setup.query<{ ratification_decision_id: string }>(
        `select ratification_decision_id from knowledge_nodes where id=$1`,
        [v2NodeId],
      );
      assert.equal(
        node.rows[0]!.ratification_decision_id,
        decisionId,
        "the original decision linkage must never be overwritten",
      );
      const count = await setup.query(
        `select count(*)::int n from decision_records where subject_id=$1`,
        [v2NodeId],
      );
      assert.equal(count.rows[0]!.n, 1, "no competing decision for the same version");
    }

    /* ── A20-A21: SUPERSESSION CLEARS RATIFICATION, HISTORY KEEPS IT ─────────── */
    {
      const next = await supersedeKnowledgeFact(
        aliceCtx,
        {
          factId,
          title: "Pricing policy",
          statement: "Discounts above 10 percent require a second approver.",
          observedKnowledgeVersion: 2,
        },
        knowledgeDeps,
      );
      assert.equal(next.status, "superseded");

      const v3 = await readV2();
      assert.equal(v3.knowledgeVersion, 3);
      assert.equal(v3.ratified, false, "a superseding version begins UNRATIFIED");
      assert.equal(v3.ratificationDecisionId, null, "nothing was inherited");
      assert.equal(v3.governanceSessionId, null);
      assert.equal(v3.ratifiedByActorId, null);
      assert.equal(v3.ratifiedAt, null);

      // Nothing was copied at the column level either.
      const v3Row = await setup.query<{
        ratification_decision_id: string | null;
        governance_session_id: string | null;
        ratified_by_actor_id: string | null;
        ratified_at: Date | null;
      }>(
        `select ratification_decision_id, governance_session_id, ratified_by_actor_id, ratified_at
           from knowledge_nodes where id=$1`,
        [v3.activeKnowledgeNodeId],
      );
      assert.deepEqual(v3Row.rows[0], {
        ratification_decision_id: null,
        governance_session_id: null,
        ratified_by_actor_id: null,
        ratified_at: null,
      });

      // v2 REMAINS historically ratified.
      const v2Row = await setup.query<{ ratification_decision_id: string }>(
        `select ratification_decision_id from knowledge_nodes where id=$1`,
        [v2NodeId],
      );
      assert.equal(
        v2Row.rows[0]!.ratification_decision_id,
        decisionId,
        "the version that WAS ratified stays ratified — history is not rewritten",
      );

      const history = await readKnowledgeVersionHistory(aliceCtx, factId, { getDb: () => handle.db });
      assert.equal(history.status, "read");
      if (history.status !== "read") throw new Error("unreachable");
      const byVersion = Object.fromEntries(history.versions.map((v) => [v.knowledgeVersion, v]));
      assert.equal(byVersion[1]!.ratified, false);
      assert.equal(byVersion[2]!.ratified, true, "v2 remains ratified in history");
      assert.equal(byVersion[3]!.ratified, false, "v3 requires its own decision");
      assert.equal(byVersion[3]!.active, true);

      // And v2 can no longer be ratified or rejected — it is not the current version.
      assert.deepEqual(
        await ratifyKnowledgeVersion(
          aliceCtx,
          { factId, knowledgeNodeId: v2NodeId, observedKnowledgeVersion: 2, justification: REASON },
          deps,
        ),
        { status: "refused", reason: "not-the-current-version" },
      );
    }

    /* ── A11: a REJECT decision produces no ratified state, and deletes nothing ─ */
    {
      const v3 = await readV2();
      const before = await setup.query<{ n: number }>(
        `select count(*)::int n from knowledge_nodes where tenant_id=$1`,
        [alice.tenantId],
      );

      const rejected = await rejectKnowledgeVersion(
        aliceCtx,
        {
          factId,
          knowledgeNodeId: v3.activeKnowledgeNodeId!,
          observedKnowledgeVersion: 3,
          justification: HOSTILE,
        },
        deps,
      );
      assert.equal(rejected.status, "rejected");
      if (rejected.status !== "rejected") throw new Error("unreachable");

      const after = await readV2();
      assert.equal(after.ratified, false, "a reject decision must never produce a ratified state");
      assert.equal(after.ratificationDecisionId, null);
      assert.equal(after.knowledgeVersion, 3, "the version is unchanged");
      assert.equal(
        after.statement,
        "Discounts above 10 percent require a second approver.",
        "a rejection does not rewrite the statement",
      );

      const nodes = await setup.query<{ n: number }>(
        `select count(*)::int n from knowledge_nodes where tenant_id=$1`,
        [alice.tenantId],
      );
      assert.equal(nodes.rows[0]!.n, before.rows[0]!.n, "a rejection deletes nothing");

      // A22: the hostile justification is stored verbatim and did nothing.
      const stored = await setup.query<{ justification: string }>(
        `select justification from decision_records where id=$1`,
        [rejected.decisionId],
      );
      assert.equal(stored.rows[0]!.justification, HOSTILE.trim());

      // The rejection filed a Governance event and NO Knowledge mutation event.
      const rejectAudit = await setup.query<{ n: number }>(
        `select count(*)::int n from audit_log
          where tenant_id=$1 and entity_type='knowledge_fact' and action='knowledge.ratify'`,
        [alice.tenantId],
      );
      assert.equal(rejectAudit.rows[0]!.n, 1, "still just the one ratification event");
    }

    /* ── A17: an audit failure rolls the whole ratification back ─────────────── */
    {
      // A fresh fact to ratify, so the probe has a clean target.
      const probe = await createKnowledgeFact(
        aliceCtx,
        {
          factKey: "audit.probe",
          domainKey: "commerce",
          scope: "company-wide",
          title: "Audit probe",
          statement: "This version exists to prove the transaction boundary holds.",
        },
        knowledgeDeps,
      );
      assert.equal(probe.status, "created");
      if (probe.status !== "created") throw new Error("unreachable");
      const listing = await listKnowledgeSources(aliceCtx, knowledgeDeps);
      const probeRecord =
        listing.status === "read"
          ? listing.records.find((r) => r.factId === probe.identity.factId)
          : undefined;
      assert.ok(probeRecord?.activeKnowledgeNodeId);

      await setup.query(
        `alter table audit_log add constraint audit_log_k4_rollback_probe
           check (action <> 'knowledge.ratify') not valid`,
      );
      try {
        const result = await ratifyKnowledgeVersion(
          aliceCtx,
          {
            factId: probe.identity.factId,
            knowledgeNodeId: probeRecord!.activeKnowledgeNodeId!,
            observedKnowledgeVersion: 1,
            justification: REASON,
          },
          deps,
        );
        assert.deepEqual(result, { status: "refused", reason: "persistence-unavailable" });

        const state = await setup.query<{ ratified: number; decisions: number; sessions: number }>(
          `select (select count(*)::int from knowledge_nodes
                     where id=$1 and ratification_decision_id is not null) ratified,
                  (select count(*)::int from decision_records
                     where subject_id=$1) decisions,
                  (select count(*)::int from governance_sessions
                     where subject_id=$1) sessions`,
          [probeRecord!.activeKnowledgeNodeId],
        );
        assert.deepEqual(
          state.rows[0],
          { ratified: 0, decisions: 0, sessions: 0 },
          "a failing audit leaves no ratified Knowledge and no orphan decision or session",
        );
      } finally {
        await setup.query(`alter table audit_log drop constraint audit_log_k4_rollback_probe`);
      }
    }

    /* ── A25-A28: nothing outside Governance and Knowledge moved ─────────────── */
    {
      const untouched = await setup.query<{
        providers_on: number;
        perms: number;
        role_perms: number;
      }>(
        `select (select count(*)::int from provider_connectivity_controls where director_enabled) providers_on,
                (select count(*)::int from permissions) perms,
                (select count(*)::int from role_permissions) role_perms`,
      );
      assert.deepEqual(untouched.rows[0], { providers_on: 0, perms: 0, role_perms: 0 });

      // Tenant isolation on reads: bob sees none of Acme's Knowledge.
      const bobListing = await listKnowledgeSources(bobCtx, knowledgeDeps);
      assert.equal(bobListing.status, "read");
      if (bobListing.status !== "read") throw new Error("unreachable");
      assert.deepEqual(bobListing.records, [], "another tenant sees none of this Knowledge");
    }

    console.log("PASS k4 ratification (postgres)");
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
