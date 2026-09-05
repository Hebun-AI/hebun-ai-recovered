/*
 * TRH-10 — Governance-backed review of an exact work-artifact revision, against a REAL PostgreSQL DB.
 *
 * THE CLAIM UNDER TEST. "Accepted" means this organization's Governance authority judged THIS EXACT
 * REVISION fit for the next internal step — and that claim survives every way of making it mean
 * something else.
 *
 * The proofs only a real database can give:
 *   - the decision and its audit event commit TOGETHER, or neither does;
 *   - a decision binds to a REVISION row, so it can never migrate to another revision;
 *   - reviewing writes NOTHING to the artifact: bytes, digest and current_revision are untouched;
 *   - an artifact author with no Governance authority is refused;
 *   - a revision from another tenant is refused INDISTINGUISHABLY from one that never existed;
 *   - a revision id that belongs to a different artifact is refused;
 *   - reversal is a second decision, not a mutation — both rows survive;
 *   - a later revision does not erase the decision recorded about an earlier one;
 *   - review mints no permit and attempts no execution.
 *
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import {
  acceptArtifactRevision,
  readArtifactRevisionReviewStates,
  requestArtifactRevisionChanges,
} from "../../src/features/work-artifact-review/review-revision.server";
import {
  ARTIFACT_REVIEW_ACCEPTED_OUTCOME,
  ARTIFACT_REVIEW_DOMAIN,
  ARTIFACT_REVIEW_REJECTED_OUTCOME,
  ARTIFACT_REVIEW_SUBJECT_TYPE,
} from "../../src/features/work-artifact-review/contracts";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-09-06T09:00:00.000Z");
const LATER = new Date("2026-09-06T10:00:00.000Z");
const REASON = "Governance has read these exact bytes and records its decision about them here.";
const REASON_2 = "Governance reconsidered these bytes and records the change of view here.";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded, sessionContextId: string, now: Date): TenantContext {
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
    requestId: "trh10-request",
    authenticatedAt: now.toISOString(),
  });
}

async function addMember(client: Client, tenantId: string, email: string): Promise<Seeded> {
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
    `insert into roles (tenant_id, name, type) values ($1, $2, 'owner') returning id`,
    [tenantId, `Role ${email}`],
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

async function establishGovernance(
  client: Client,
  seeded: Seeded,
  ctx: TenantContext,
  deps: unknown,
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
    { justification: "Establishing Governance authority so prepared work can be reviewed." },
    deps as never,
  );
  assert.equal(result.status, "established", "the tenant's Governance authority is real");
}

/** An artifact and one agent-authored revision, inserted directly: this file tests REVIEW. */
async function seedArtifact(
  client: Client,
  tenantId: string,
  authorId: string,
  content: string,
  revisionNo = 1,
  artifactId?: string,
): Promise<{ artifactId: string; revisionId: string; digest: string }> {
  let id = artifactId;
  if (!id) {
    const artifact = await client.query<{ id: string }>(
      `insert into work_artifacts
         (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace,
          current_revision, intended_destination, created_by, created_by_type)
       values ($1,'content-draft',$2,'draft','operations',$3,'instagram',$4,'human') returning id`,
      [tenantId, "Draft under review", revisionNo, authorId],
    );
    id = artifact.rows[0]!.id;
  } else {
    await client.query(`update work_artifacts set current_revision = $2 where id = $1`, [
      id,
      revisionNo,
    ]);
  }
  const digestRow = await client.query<{ d: string }>(`select encode(sha256($1::bytea),'hex') as d`, [
    content,
  ]);
  const digest = digestRow.rows[0]!.d;
  const revision = await client.query<{ id: string }>(
    `insert into work_artifact_revisions
       (tenant_id, artifact_id, revision_no, content, content_digest,
        authored_by_actor_type, authored_by_actor_id)
     values ($1,$2,$3,$4,$5,'agent',$6) returning id`,
    [tenantId, id, revisionNo, content, digest, authorId],
  );
  return { artifactId: id!, revisionId: revision.rows[0]!.id, digest };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_trh10_review");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW };

  try {
    harness.migrateDatabase();
    await setup.connect();

    /* ── Seed: Acme (alice = Governance authority, dana = author only) + Other tenant ── */
    const alice = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "alice@acme.test",
      password: "alice-correct-password-7Qx",
    });
    const aliceSession = await sessionRowFor(setup, alice, "a1");
    const aliceCtx = contextFor(alice, aliceSession, NOW);
    await establishGovernance(setup, alice, aliceCtx, deps);

    const dana = await addMember(setup, alice.tenantId, "dana@acme.test");
    const danaCtx = contextFor(dana, await sessionRowFor(setup, dana, "d1"), NOW);

    const other = await seedLocalIdentity(setup, {
      companyName: "Other",
      companySlug: "other",
      email: "erin@other.test",
      password: "erin-correct-password-7Qx",
    });
    const erinCtx = contextFor(other, await sessionRowFor(setup, other, "e1"), NOW);
    await establishGovernance(setup, other, erinCtx, deps);

    const CONTENT = "Handcrafted rugs, kilims and cushions.";
    const seeded = await seedArtifact(setup, alice.tenantId, alice.userId, CONTENT);

    const artifactBefore = await setup.query(
      `select current_revision, artifact_lifecycle_status from work_artifacts where id = $1`,
      [seeded.artifactId],
    );

    /* ── 1. THE AUTHOR WITHOUT GOVERNANCE AUTHORITY IS REFUSED ──────────────── */
    {
      const refused = await acceptArtifactRevision(
        danaCtx,
        { artifactId: seeded.artifactId, revisionId: seeded.revisionId, justification: REASON },
        deps,
      );
      assert.equal(refused.status, "refused");
      assert.equal(
        refused.status === "refused" ? refused.reason : "",
        "not-the-governance-authority",
        "preparing work does not confer the authority to decide about it",
      );
    }

    /* ── 2. UNAUTHENTICATED AND UNJUSTIFIED ARE REFUSED BEFORE ANYTHING IS READ ─ */
    {
      const anon = await acceptArtifactRevision(
        null,
        { artifactId: seeded.artifactId, revisionId: seeded.revisionId, justification: REASON },
        deps,
      );
      assert.equal(anon.status === "refused" ? anon.reason : "", "unauthenticated");

      const bare = await acceptArtifactRevision(
        aliceCtx,
        { artifactId: seeded.artifactId, revisionId: seeded.revisionId, justification: "no" },
        deps,
      );
      assert.equal(bare.status === "refused" ? bare.reason : "", "justification-required");
    }

    /* ── 3. CROSS-TENANT AND MISMATCH ARE ONE INDISTINGUISHABLE REFUSAL ─────── */
    {
      const crossTenant = await acceptArtifactRevision(
        erinCtx,
        { artifactId: seeded.artifactId, revisionId: seeded.revisionId, justification: REASON },
        deps,
      );
      const missing = await acceptArtifactRevision(
        erinCtx,
        {
          artifactId: "00000000-0000-4000-8000-000000000001",
          revisionId: "00000000-0000-4000-8000-000000000002",
          justification: REASON,
        },
        deps,
      );
      assert.equal(crossTenant.status === "refused" ? crossTenant.reason : "", "revision-unresolvable");
      assert.equal(missing.status === "refused" ? missing.reason : "", "revision-unresolvable");
      assert.deepEqual(
        crossTenant,
        missing,
        "another tenant's revision is indistinguishable from one that never existed",
      );

      /* A real revision named under the WRONG artifact is refused too. */
      const otherArtifact = await seedArtifact(setup, alice.tenantId, alice.userId, "Other bytes.");
      const mismatch = await acceptArtifactRevision(
        aliceCtx,
        {
          artifactId: otherArtifact.artifactId,
          revisionId: seeded.revisionId,
          justification: REASON,
        },
        deps,
      );
      assert.equal(
        mismatch.status === "refused" ? mismatch.reason : "",
        "revision-unresolvable",
        "a revision may only be reviewed under the artifact it belongs to",
      );
    }

    /* ── 4. THE GOVERNANCE AUTHORITY ACCEPTS THE EXACT REVISION ─────────────── */
    {
      const accepted = await acceptArtifactRevision(
        aliceCtx,
        { artifactId: seeded.artifactId, revisionId: seeded.revisionId, justification: REASON },
        deps,
      );
      assert.equal(accepted.status, "reviewed");
      if (accepted.status !== "reviewed") throw new Error("unreachable");
      assert.equal(accepted.decision, "accepted");
      assert.equal(accepted.revisionId, seeded.revisionId);
      assert.equal(accepted.revisionNo, 1);

      const decision = await setup.query<{
        subject_type: string;
        subject_id: string;
        decision_type: string;
        outcome: string;
        justification: string;
        evidence: Record<string, unknown>;
        actor_type: string;
        bootstrap: boolean;
      }>(`select * from decision_records where id = $1`, [accepted.decisionId]);
      const row = decision.rows[0]!;
      assert.equal(row.subject_type, ARTIFACT_REVIEW_SUBJECT_TYPE);
      assert.equal(row.subject_id, seeded.revisionId, "the decision names the REVISION row");
      assert.equal(row.decision_type, "approve");
      assert.equal(row.outcome, ARTIFACT_REVIEW_ACCEPTED_OUTCOME);
      assert.equal(row.justification, REASON, "the human's reason is stored verbatim");
      assert.equal(row.actor_type, "human");
      assert.equal(row.bootstrap, false);
      assert.equal(
        row.evidence.contentDigest,
        seeded.digest,
        "the ledger records WHICH BYTES were judged",
      );

      const session = await setup.query<{ governance_domain: string; subject_id: string }>(
        `select governance_domain, subject_id from governance_sessions where id = $1`,
        [accepted.governanceSessionId],
      );
      assert.equal(session.rows[0]!.governance_domain, ARTIFACT_REVIEW_DOMAIN);
      assert.equal(session.rows[0]!.subject_id, seeded.revisionId);

      /* ── AUDIT ATOMICITY: the decision and its event are in the same commit ── */
      const audit = await setup.query<{ n: string }>(
        `select count(*)::text as n from audit_log
          where tenant_id = $1 and action = 'governance.decision.recorded'
            and entity_id = $2 and result = 'committed' and simulation = false`,
        [alice.tenantId, accepted.decisionId],
      );
      assert.equal(audit.rows[0]!.n, "1", "exactly one Governance audit event, committed with it");
    }

    /* ── 5. THE ARTIFACT AND ITS BYTES ARE UNTOUCHED ────────────────────────── */
    {
      const artifactAfter = await setup.query<{
        current_revision: number;
        artifact_lifecycle_status: string;
      }>(`select current_revision, artifact_lifecycle_status from work_artifacts where id = $1`, [
        seeded.artifactId,
      ]);
      assert.deepEqual(
        artifactAfter.rows[0],
        artifactBefore.rows[0],
        "review changed neither current_revision nor the artifact lifecycle",
      );

      const revision = await setup.query<{ content: string; digest: string; recomputed: string }>(
        `select content, content_digest as digest, encode(sha256(content::bytea),'hex') as recomputed
           from work_artifact_revisions where id = $1`,
        [seeded.revisionId],
      );
      assert.equal(revision.rows[0]!.content, CONTENT, "the bytes are byte-identical");
      assert.equal(revision.rows[0]!.digest, revision.rows[0]!.recomputed, "the digest still holds");
    }

    /* ── 6. NO PERMIT, NO EXECUTION, NO WORK, NO KNOWLEDGE ──────────────────── */
    {
      for (const table of [
        "action_permits",
        "heby_action_requests",
        "action_execution_attempts",
        "work_items",
        "knowledge_facts",
        "knowledge_nodes",
        "integrations",
      ]) {
        const rows = await setup.query<{ n: string }>(
          `select count(*)::text as n from ${table} where tenant_id = $1`,
          [alice.tenantId],
        );
        assert.equal(rows.rows[0]!.n, "0", `review created no ${table} row`);
      }
    }

    /* ── 7. REVERSAL IS A SECOND DECISION — BOTH ROWS SURVIVE ───────────────── */
    {
      const reversed = await requestArtifactRevisionChanges(
        aliceCtx,
        { artifactId: seeded.artifactId, revisionId: seeded.revisionId, justification: REASON_2 },
        { ...deps, now: () => LATER },
      );
      assert.equal(reversed.status, "reviewed");
      if (reversed.status !== "reviewed") throw new Error("unreachable");
      assert.equal(reversed.decision, "changes-requested");

      const all = await setup.query<{ n: string }>(
        `select count(*)::text as n from decision_records
          where subject_type = $1 and subject_id = $2`,
        [ARTIFACT_REVIEW_SUBJECT_TYPE, seeded.revisionId],
      );
      assert.equal(all.rows[0]!.n, "2", "both decisions persist — nothing was mutated or deleted");

      const outcomes = await setup.query<{ outcome: string }>(
        `select outcome from decision_records
          where subject_type = $1 and subject_id = $2 order by decided_at`,
        [ARTIFACT_REVIEW_SUBJECT_TYPE, seeded.revisionId],
      );
      assert.deepEqual(
        outcomes.rows.map((r) => r.outcome),
        [ARTIFACT_REVIEW_ACCEPTED_OUTCOME, ARTIFACT_REVIEW_REJECTED_OUTCOME],
        "the ledger shows the organization changed its mind, in order",
      );

      /* The DERIVED state is the LATEST decision, and it does not hide the history. */
      const states = await readArtifactRevisionReviewStates(aliceCtx, seeded.artifactId, deps);
      const mine = states.find((s) => s.revisionId === seeded.revisionId)!;
      assert.equal(mine.decision, "changes-requested", "derived state is the latest decision");
      assert.equal(mine.decisionCount, 2, "the reversal is visible, not hidden");
    }

    /* ── 8. A LATER REVISION DOES NOT ERASE THE EARLIER DECISION ────────────── */
    {
      const second = await seedArtifact(
        setup,
        alice.tenantId,
        alice.userId,
        "Revised bytes without the unsupported claim.",
        2,
        seeded.artifactId,
      );
      const states = await readArtifactRevisionReviewStates(aliceCtx, seeded.artifactId, deps);
      const first = states.find((s) => s.revisionId === seeded.revisionId)!;
      const latest = states.find((s) => s.revisionId === second.revisionId)!;

      assert.equal(
        first.decisionCount,
        2,
        "revision 1 keeps its decisions after revision 2 appears",
      );
      assert.equal(latest.decision, null, "a new revision is UNREVIEWED, never inherited");
      assert.equal(latest.decisionCount, 0);

      /* CURRENT REVISION != ACCEPTED REVISION: rev 2 is current and has no decision at all. */
      const current = await setup.query<{ current_revision: number }>(
        `select current_revision from work_artifacts where id = $1`,
        [seeded.artifactId],
      );
      assert.equal(current.rows[0]!.current_revision, 2);
      assert.equal(latest.revisionNo, 2);
      assert.equal(latest.decision, null);
    }

    console.log("PASS trh10 artifact review (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    harness.dropDatabase();
  }
}

void main();
