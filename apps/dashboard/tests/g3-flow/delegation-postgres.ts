/*
 * G3 — Governance authority delegation and revocation, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION, VERBATIM FROM THE BRIEF, IS WHAT THIS FILE PROVES:
 *
 *   "Human B currently has Governance authority in Tenant T because an already-authorized human
 *    explicitly delegated it through a durable Governance decision, and that authority ceases to be
 *    usable after a durable authorized revocation, while the complete historical authority chain
 *    remains intact."
 *
 * Plus the Director's fifteen mandatory policy cases (A1-c / A2-a / A3-a), each marked below.
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
import { readAuthorityRoster, resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import {
  delegateGovernanceAuthority,
  readDelegationCandidates,
  revokeGovernanceAuthority,
} from "../../src/features/governance-decision/authority-delegation.server";
import { ratifyKnowledgeVersion } from "../../src/features/knowledge-ratification/ratify-version.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import { listKnowledgeSources } from "../../src/features/knowledge/knowledge-read.server";
import { createDurableKnowledgeWriter } from "../../src/features/knowledge/durable-knowledge-writer.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-08-11T20:00:00.000Z");
const REASON = "Recording this Governance authority change with an explicit human reason.";

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
    requestId: "g3-request",
    authenticatedAt: NOW.toISOString(),
  };
}

async function addMember(
  client: Client,
  tenantId: string,
  email: string,
  roleType = "member",
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
  /*
   * I1.1 made "at most one ordinary member role per tenant" a constitutional invariant
   * (`roles_one_member_per_tenant_uq`). This fixture used to mint a fresh role per human, which is
   * now unrepresentable for the `member` band — and was never what the product does anyway: many
   * humans share the tenant's one member role. Privileged bands are unconstrained and still get
   * their own row, which is what the owner-band cases below depend on.
   */
  const existing =
    roleType === "member"
      ? await client.query<{ id: string }>(
          `select id from roles where tenant_id = $1 and type = 'member' limit 1`,
          [tenantId],
        )
      : { rows: [] as { id: string }[] };
  const role = existing.rows[0]
    ? existing
    : await client.query<{ id: string }>(
        `insert into roles (tenant_id, name, type) values ($1, $2, $3) returning id`,
        [tenantId, roleType === "member" ? "Member" : `Role ${email}`, roleType],
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

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_g3_delegation");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;

  try {
    harness.migrateDatabase();
    await setup.connect();

    /* ── Seed: Acme (A genesis, B, C, D owner-band peer) + Globex (X genesis) ── */
    const A = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "a@acme.test",
      password: "a-correct-password-7Qx",
    });
    const B = await addMember(setup, A.tenantId, "b@acme.test");
    const C = await addMember(setup, A.tenantId, "c@acme.test");
    // D holds the OWNER band — the strongest role in the product — and no Governance authority.
    const D = await addMember(setup, A.tenantId, "d@acme.test", "owner");
    const X = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex",
      email: "x@globex.test",
      password: "x-correct-password-4Lm",
    });

    const ctxA = contextFor(A, await sessionRowFor(setup, A, "aaaa"));
    const ctxB = contextFor(B, await sessionRowFor(setup, B, "bbbb"));
    const ctxC = contextFor(C, await sessionRowFor(setup, C, "cccc"));
    const ctxD = contextFor(D, await sessionRowFor(setup, D, "dddd"));
    const ctxX = contextFor(X, await sessionRowFor(setup, X, "eeee"));

    const establish = async (seeded: Seeded, ctx: TenantContext) => {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
      );
      const result = await establishGovernanceAuthority(ctx, { justification: REASON }, deps);
      assert.equal(result.status, "established");
    };
    await establish(A, ctxA);
    await establish(X, ctxX);

    /* ── Preconditions: only A governs Acme ──────────────────────────────────── */
    {
      assert.equal((await resolveGovernanceAuthority(ctxA, deps)).authorized, true);
      assert.equal((await resolveGovernanceAuthority(ctxA, deps)).via, "bootstrap");
      for (const ctx of [ctxB, ctxC, ctxD]) {
        assert.equal((await resolveGovernanceAuthority(ctx, deps)).authorized, false);
      }
      // A candidate list is authority-only; a non-authority gets nothing, not a directory.
      assert.deepEqual(await readDelegationCandidates(ctxD, deps), []);
      const candidates = await readDelegationCandidates(ctxA, deps);
      assert.equal(candidates.length, 3, "B, C and D are delegable; A already governs");
    }

    /* ── Refusals before anything is delegated ───────────────────────────────── */
    {
      assert.deepEqual(
        await delegateGovernanceAuthority(null, { toUserId: B.userId, justification: REASON }, deps),
        { status: "refused", reason: "unauthenticated" },
      );
      // The OWNER band grants nothing. This is the shortcut the whole chain refuses.
      assert.deepEqual(
        await delegateGovernanceAuthority(ctxD, { toUserId: C.userId, justification: REASON }, deps),
        { status: "refused", reason: "not-a-governance-authority" },
      );
      // Self-delegation is meaningless.
      assert.deepEqual(
        await delegateGovernanceAuthority(ctxA, { toUserId: A.userId, justification: REASON }, deps),
        { status: "refused", reason: "self-delegation" },
      );
      // A human from another tenant is unresolvable here.
      assert.deepEqual(
        await delegateGovernanceAuthority(ctxA, { toUserId: X.userId, justification: REASON }, deps),
        { status: "refused", reason: "target-unresolvable" },
      );
      // Forged target ids resolve to nothing.
      assert.deepEqual(
        await delegateGovernanceAuthority(
          ctxA,
          { toUserId: "00000000-0000-4000-8000-000000000000", justification: REASON },
          deps,
        ),
        { status: "refused", reason: "target-unresolvable" },
      );
      // A stale/revoked membership is not an active member.
      await setup.query(`update memberships set status='revoked', revoked_at=now() where id=$1`, [
        C.membershipId,
      ]);
      assert.deepEqual(
        await delegateGovernanceAuthority(ctxA, { toUserId: C.userId, justification: REASON }, deps),
        { status: "refused", reason: "target-unresolvable" },
      );
      await setup.query(`update memberships set status='active', revoked_at=null where id=$1`, [
        C.membershipId,
      ]);
      // Justification is mandatory.
      for (const bad of ["", "  ", "too short"]) {
        assert.deepEqual(
          await delegateGovernanceAuthority(ctxA, { toUserId: B.userId, justification: bad }, deps),
          { status: "refused", reason: "justification-required" },
        );
      }
      const none = await setup.query<{ n: number }>(
        `select count(*)::int n from decision_records where decision_type='delegate-authority'`,
      );
      assert.equal(none.rows[0]!.n, 0, "no refused attempt created a delegation");
    }

    /* ── POLICY 1: bootstrap A delegates to B ────────────────────────────────── */
    let aToB = "";
    {
      const result = await delegateGovernanceAuthority(
        ctxA,
        { toUserId: B.userId, justification: REASON },
        deps,
      );
      assert.equal(result.status, "delegated");
      if (result.status !== "delegated") throw new Error("unreachable");
      aToB = result.decisionId;

      const row = await setup.query<{
        decision_type: string;
        subject_type: string;
        subject_id: string;
        actor_id: string;
        bootstrap: boolean;
        outcome: string;
        authority_source_actor_id: string;
        governance_domain: string;
      }>(
        `select d.decision_type, d.subject_type, d.subject_id, d.actor_id, d.bootstrap, d.outcome,
                d.authority_source_actor_id, s.governance_domain
           from decision_records d join governance_sessions s on s.id = d.session_id
          where d.id = $1`,
        [aToB],
      );
      assert.equal(row.rows[0]!.decision_type, "delegate-authority");
      assert.equal(row.rows[0]!.subject_type, "user");
      assert.equal(row.rows[0]!.subject_id, B.userId, "the subject is the receiving human");
      assert.equal(row.rows[0]!.actor_id, A.userId);
      assert.equal(row.rows[0]!.bootstrap, false);
      assert.equal(row.rows[0]!.outcome, "authority-delegated");
      assert.equal(row.rows[0]!.authority_source_actor_id, A.userId);
      assert.equal(row.rows[0]!.governance_domain, "authority-delegation");
    }

    /* ── POLICY 2: B may act as Governance authority ─────────────────────────── */
    {
      const authority = await resolveGovernanceAuthority(ctxB, deps);
      assert.equal(authority.authorized, true);
      assert.equal(authority.via, "delegated");
      assert.equal(authority.delegationDecisionId, aToB);
      assert.equal(authority.grantedByActorId, A.userId, "provenance points at the grantor");

      // Duplicate delegation of the same human is refused.
      assert.deepEqual(
        await delegateGovernanceAuthority(ctxA, { toUserId: B.userId, justification: REASON }, deps),
        { status: "refused", reason: "already-authorized" },
      );
    }

    /* ── POLICY 3: B delegates to C ──────────────────────────────────────────── */
    let bToC = "";
    {
      const result = await delegateGovernanceAuthority(
        ctxB,
        { toUserId: C.userId, justification: REASON },
        deps,
      );
      assert.equal(result.status, "delegated");
      if (result.status !== "delegated") throw new Error("unreachable");
      bToC = result.decisionId;
      assert.equal((await resolveGovernanceAuthority(ctxC, deps)).authorized, true);
      assert.equal((await resolveGovernanceAuthority(ctxC, deps)).grantedByActorId, B.userId);
    }

    /* ── POLICY 7 + 8: C may NOT revoke A→B, nor any grant C did not make ────── */
    {
      assert.deepEqual(
        await revokeGovernanceAuthority(
          ctxC,
          { delegationDecisionId: aToB, justification: REASON },
          deps,
        ),
        { status: "refused", reason: "not-the-grantor" },
        "a delegate may not revoke the grant that created their own grantor",
      );
      // D holds the owner band and no authority at all.
      assert.deepEqual(
        await revokeGovernanceAuthority(
          ctxD,
          { delegationDecisionId: bToC, justification: REASON },
          deps,
        ),
        { status: "refused", reason: "not-a-governance-authority" },
      );
      // Cross-tenant: X governs Globex and cannot see Acme's decisions at all.
      assert.deepEqual(
        await revokeGovernanceAuthority(
          ctxX,
          { delegationDecisionId: aToB, justification: REASON },
          deps,
        ),
        { status: "refused", reason: "delegation-unresolvable" },
      );
    }

    /* ── POLICY 12: bootstrap authority can never be revoked through G3 ──────── */
    {
      const bootstrapId = (
        await setup.query<{ id: string }>(
          `select id from decision_records where tenant_id=$1 and bootstrap`,
          [A.tenantId],
        )
      ).rows[0]!.id;
      for (const ctx of [ctxA, ctxB, ctxC]) {
        assert.deepEqual(
          await revokeGovernanceAuthority(
            ctx,
            { delegationDecisionId: bootstrapId, justification: REASON },
            deps,
          ),
          { status: "refused", reason: "bootstrap-not-revocable" },
          "A2-a: the genesis is constitutional, and not even A may end it",
        );
      }
      // POLICY 13: therefore the tenant can never reach zero authorities.
      const roster = await readAuthorityRoster(ctxA, deps);
      assert.equal(roster.status, "read");
      if (roster.status !== "read") throw new Error("unreachable");
      assert.ok(
        roster.roster.active.some((entry) => entry.kind === "bootstrap"),
        "A3-a: the genesis authority is always present",
      );
    }

    /* ── POLICY 4: B may revoke B→C (its own grant) ──────────────────────────── */
    {
      const result = await revokeGovernanceAuthority(
        ctxB,
        { delegationDecisionId: bToC, justification: REASON },
        deps,
      );
      assert.equal(result.status, "revoked");

      // C's authority is gone — and the delegation decision is untouched.
      assert.equal((await resolveGovernanceAuthority(ctxC, deps)).authorized, false);
      const delegation = await setup.query<{ outcome: string; justification: string }>(
        `select outcome, justification from decision_records where id=$1`,
        [bToC],
      );
      assert.equal(
        delegation.rows[0]!.outcome,
        "authority-delegated",
        "the original delegation decision is never rewritten",
      );

      // POLICY 11: authentication, membership and role are all untouched.
      const cState = await setup.query<{
        credentials: number;
        membership_status: string;
        role_type: string;
      }>(
        `select (select count(*)::int from auth_credentials cr
                   join auth_identities i on i.id=cr.auth_identity_id
                  where i.user_id=$1 and cr.status='active') credentials,
                (select m.status from memberships m where m.user_id=$1) membership_status,
                (select r.type from roles r join memberships m on m.role_id=r.id where m.user_id=$1) role_type`,
        [C.userId],
      );
      assert.equal(cState.rows[0]!.membership_status, "active", "membership is untouched");
      assert.equal(cState.rows[0]!.role_type, "member", "the organizational role is untouched");

      // Duplicate revocation is refused.
      assert.deepEqual(
        await revokeGovernanceAuthority(
          ctxB,
          { delegationDecisionId: bToC, justification: REASON },
          deps,
        ),
        { status: "refused", reason: "already-revoked" },
      );
    }

    /* ── POLICY 6: bootstrap A may revoke a grant A did not make ─────────────── */
    {
      // Re-delegate to C, this time from B again, then let A revoke it.
      const again = await delegateGovernanceAuthority(
        ctxB,
        { toUserId: C.userId, justification: REASON },
        deps,
      );
      assert.equal(again.status, "delegated");
      if (again.status !== "delegated") throw new Error("unreachable");
      assert.equal((await resolveGovernanceAuthority(ctxC, deps)).authorized, true);

      const revoked = await revokeGovernanceAuthority(
        ctxA,
        { delegationDecisionId: again.decisionId, justification: REASON },
        deps,
      );
      assert.equal(
        revoked.status,
        "revoked",
        "A1-c: the bootstrap human may revoke ANY delegation in their tenant",
      );
      assert.equal((await resolveGovernanceAuthority(ctxC, deps)).authorized, false);
    }

    /* ── K4: a delegate ratifies, then loses it — POLICY 10 ──────────────────── */
    {
      const writer = createDurableKnowledgeWriter(handle.db);
      const repo = createDurableKnowledgeRepository(handle.db);
      const knowledgeDeps = {
        resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
        getWriter: () => writer,
        getRepo: () => repo,
        now: () => NOW,
      } as never;

      const created = await createKnowledgeFact(
        ctxA,
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
      const listing = await listKnowledgeSources(ctxA, knowledgeDeps);
      assert.equal(listing.status, "read");
      if (listing.status !== "read") throw new Error("unreachable");
      const record = listing.records[0]!;

      // B holds a delegated authority, so K4 grants ratification WITHOUT any K4 change.
      const ratified = await ratifyKnowledgeVersion(
        ctxB,
        {
          factId: record.factId,
          knowledgeNodeId: record.activeKnowledgeNodeId!,
          observedKnowledgeVersion: record.knowledgeVersion,
          justification: REASON,
        },
        deps,
      );
      assert.equal(ratified.status, "ratified", "a delegate may exercise K4 ratification");

      const attribution = await setup.query<{ actor_id: string; authority_source_actor_id: string }>(
        `select actor_id, authority_source_actor_id from decision_records
          where decision_type='ratify' and subject_type='knowledge_node'`,
      );
      assert.equal(attribution.rows[0]!.actor_id, B.userId, "the ratification attributes B");
      assert.equal(
        attribution.rows[0]!.authority_source_actor_id,
        A.userId,
        "and its authority source traces to the genesis human",
      );

      // POLICY 5: bootstrap A revokes A→B.
      const revoked = await revokeGovernanceAuthority(
        ctxA,
        { delegationDecisionId: aToB, justification: REASON },
        deps,
      );
      assert.equal(revoked.status, "revoked");
      assert.equal((await resolveGovernanceAuthority(ctxB, deps)).authorized, false);

      // POLICY 10: revoked B can no longer ratify.
      const second = await createKnowledgeFact(
        ctxA,
        {
          factKey: "refund.policy",
          domainKey: "commerce",
          scope: "company-wide",
          title: "Refund policy",
          statement: "Refunds are issued within fourteen days of purchase.",
        },
        knowledgeDeps,
      );
      assert.equal(second.status, "created");
      const listing2 = await listKnowledgeSources(ctxA, knowledgeDeps);
      const target =
        listing2.status === "read"
          ? listing2.records.find((r) => r.factKey === "refund.policy")
          : undefined;
      assert.ok(target);
      assert.deepEqual(
        await ratifyKnowledgeVersion(
          ctxB,
          {
            factId: target!.factId,
            knowledgeNodeId: target!.activeKnowledgeNodeId!,
            observedKnowledgeVersion: target!.knowledgeVersion,
            justification: REASON,
          },
          deps,
        ),
        { status: "refused", reason: "not-the-governance-authority" },
        "POLICY 10: a revoked delegate cannot ratify Knowledge",
      );

      // POLICY 9: revoked B cannot create new delegations either.
      assert.deepEqual(
        await delegateGovernanceAuthority(ctxB, { toUserId: C.userId, justification: REASON }, deps),
        { status: "refused", reason: "not-a-governance-authority" },
      );
      // …nor revoke anything.
      assert.deepEqual(
        await revokeGovernanceAuthority(
          ctxB,
          { delegationDecisionId: aToB, justification: REASON },
          deps,
        ),
        { status: "refused", reason: "not-a-governance-authority" },
      );

      // The ratification B made while authorized STANDS. Revocation is not retroactive.
      const stillRatified = await listKnowledgeSources(ctxA, knowledgeDeps);
      const first =
        stillRatified.status === "read"
          ? stillRatified.records.find((r) => r.factKey === "pricing.policy")
          : undefined;
      assert.equal(first?.ratified, true, "decisions made under valid authority remain valid");
    }

    /* ── POLICY 14: the full provenance chain is readable ────────────────────── */
    {
      const roster = await readAuthorityRoster(ctxA, deps);
      assert.equal(roster.status, "read");
      if (roster.status !== "read") throw new Error("unreachable");

      assert.deepEqual(
        roster.roster.active.map((entry) => entry.kind),
        ["bootstrap"],
        "after all revocations only the permanent genesis authority remains",
      );
      assert.equal(roster.roster.active[0]!.actorId, A.userId);
      assert.equal(roster.roster.viewerIsBootstrapAuthority, true);

      // Every revoked delegation is still fully readable: who, by whom, when, why, ended by whom.
      assert.equal(roster.roster.revoked.length, 3, "three delegations were ended, none deleted");
      for (const entry of roster.roster.revoked) {
        assert.ok(entry.actorId);
        assert.ok(entry.grantedByActorId);
        assert.ok(entry.decisionId);
        assert.ok(entry.revocationDecisionId);
        assert.ok(entry.revokedByActorId);
        assert.equal(entry.justification, REASON);
        assert.equal(entry.revocationJustification, REASON);
      }
      const bToCRecord = roster.roster.revoked.find((e) => e.decisionId === bToC);
      assert.ok(bToCRecord);
      assert.equal(bToCRecord!.grantedByActorId, B.userId, "B granted it");
      assert.equal(bToCRecord!.revokedByActorId, B.userId, "B ended it");

      // Nothing was deleted: every decision ever written is still there.
      const counts = await setup.query<{ delegations: number; revocations: number }>(
        `select (select count(*)::int from decision_records where decision_type='delegate-authority') delegations,
                (select count(*)::int from decision_records where decision_type='revoke') revocations`,
      );
      assert.equal(counts.rows[0]!.delegations, 3);
      assert.equal(counts.rows[0]!.revocations, 3);
    }

    /* ── Tenant isolation, audit, and untouched systems ──────────────────────── */
    {
      // X still governs Globex, and never saw any of this.
      assert.equal((await resolveGovernanceAuthority(ctxX, deps)).authorized, true);
      const globex = await readAuthorityRoster(ctxX, deps);
      assert.equal(globex.status, "read");
      if (globex.status !== "read") throw new Error("unreachable");
      assert.equal(globex.roster.active.length, 1, "Globex has only its own genesis authority");
      assert.deepEqual(globex.roster.revoked, [], "and none of Acme's history");

      const audit = await setup.query<{ action: string; result: string; n: number }>(
        `select action, result, count(*)::int n from audit_log
          where tenant_id=$1 and action like 'governance.authority%'
          group by action, result order by action`,
        [A.tenantId],
      );
      assert.deepEqual(
        audit.rows.map((r) => `${r.action}|${r.result}|${r.n}`),
        ["governance.authority.delegated|committed|3", "governance.authority.revoked|committed|3"],
      );
      const metadata = await setup.query<{ metadata: Record<string, unknown> }>(
        `select metadata from audit_log where action='governance.authority.delegated' limit 1`,
      );
      assert.ok(
        !JSON.stringify(metadata.rows[0]!.metadata).includes(REASON),
        "audit must not duplicate the justification — the decision owns it",
      );

      const untouched = await setup.query<{ providers_on: number; perms: number }>(
        `select (select count(*)::int from provider_connectivity_controls where director_enabled) providers_on,
                (select count(*)::int from permissions) perms`,
      );
      assert.deepEqual(untouched.rows[0], { providers_on: 0, perms: 0 });
    }

    console.log("PASS g3 delegation and revocation (postgres)");
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
