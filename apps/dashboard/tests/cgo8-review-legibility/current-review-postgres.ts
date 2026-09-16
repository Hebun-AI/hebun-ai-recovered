/*
 * CGO-8 — the current-revision review state a Prepared Work row shows, against a REAL PostgreSQL DB.
 *
 * WHAT ONLY A DATABASE CAN PROVE:
 *   - the batched reader derives exactly what the released per-artifact reader derives;
 *   - it answers about the CURRENT revision: a decision about an earlier revision does not make a
 *     newer one look reviewed;
 *   - the latest decision wins, and a reversal is still counted;
 *   - another tenant's artifact resolves to nothing, so its row can only be *Review state unknown*;
 *   - reading writes nothing — the artifact tables and the decision ledger are byte-for-byte unchanged;
 *   - an unreadable ledger or an absent session is `unavailable`, never "awaiting review".
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
  readCurrentRevisionReviewStates,
  requestArtifactRevisionChanges,
} from "../../src/features/work-artifact-review/review-revision.server";
import { artifactRowReviewStatus } from "../../src/features/work-artifact-review/contracts";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-09-16T09:00:00.000Z");
const REASON = "Governance has read these exact bytes and records its decision about them here.";
const REASON_2 = "Governance reconsidered these bytes and records the change of view here.";

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
    requestId: "cgo8-request",
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

async function establishGovernance(client: Client, seeded: Seeded, ctx: TenantContext, deps: unknown): Promise<void> {
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
  assert.equal(result.status, "established");
}

/** One artifact plus one revision, inserted directly: this file tests READING review state. */
async function seedArtifact(
  client: Client,
  tenantId: string,
  authorId: string,
  content: string,
  revisionNo = 1,
  artifactId?: string,
): Promise<{ artifactId: string; revisionId: string }> {
  let id = artifactId;
  if (!id) {
    const artifact = await client.query<{ id: string }>(
      `insert into work_artifacts
         (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace,
          current_revision, intended_destination, created_by, created_by_type)
       values ($1,'content-draft',$2,'draft','operations',$3,'instagram',$4,'human') returning id`,
      [tenantId, `Draft ${content}`, revisionNo, authorId],
    );
    id = artifact.rows[0]!.id;
  } else {
    await client.query(`update work_artifacts set current_revision = $2 where id = $1`, [id, revisionNo]);
  }
  const digest = (
    await client.query<{ d: string }>(`select encode(sha256($1::bytea),'hex') as d`, [content])
  ).rows[0]!.d;
  const revision = await client.query<{ id: string }>(
    `insert into work_artifact_revisions
       (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
     values ($1,$2,$3,$4,$5,'agent',$6) returning id`,
    [tenantId, id, revisionNo, content, digest, authorId],
  );
  return { artifactId: id!, revisionId: revision.rows[0]!.id };
}

async function snapshot(client: Client): Promise<string> {
  const rows = await client.query(
    `select
       (select coalesce(json_agg(t order by t.id), '[]') from work_artifacts t) as artifacts,
       (select coalesce(json_agg(t order by t.id), '[]') from work_artifact_revisions t) as revisions,
       (select coalesce(json_agg(t order by t.id), '[]') from decision_records t) as decisions`,
  );
  return JSON.stringify(rows.rows[0]);
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_cgo8_review");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW };

  try {
    harness.migrateDatabase();
    await setup.connect();

    const alice = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "alice@acme.test",
      password: "alice-correct-password-7Qx",
    });
    const aliceCtx = contextFor(alice, await sessionRowFor(setup, alice, "a1"));
    await establishGovernance(setup, alice, aliceCtx, deps);

    const other = await seedLocalIdentity(setup, {
      companyName: "Other",
      companySlug: "other",
      email: "erin@other.test",
      password: "erin-correct-password-7Qx",
    });
    const erinCtx = contextFor(other, await sessionRowFor(setup, other, "e1"));
    await establishGovernance(setup, other, erinCtx, deps);

    /* Four Acme artifacts, each a different answer; one foreign artifact. */
    const untouched = await seedArtifact(setup, alice.tenantId, alice.userId, "never reviewed");
    const accepted = await seedArtifact(setup, alice.tenantId, alice.userId, "accepted once");
    const reversed = await seedArtifact(setup, alice.tenantId, alice.userId, "changes then accepted");
    const superseded = await seedArtifact(setup, alice.tenantId, alice.userId, "accepted then revised");
    const foreign = await seedArtifact(setup, other.tenantId, other.userId, "another organization");

    const ok = (r: { status: string }) => assert.equal(r.status, "reviewed");
    ok(await acceptArtifactRevision(aliceCtx, { ...accepted, justification: REASON }, deps));
    ok(await requestArtifactRevisionChanges(aliceCtx, { ...reversed, justification: REASON }, deps));
    ok(
      await acceptArtifactRevision(
        aliceCtx,
        { ...reversed, justification: REASON_2 },
        { ...deps, now: () => new Date("2026-09-16T10:00:00.000Z") },
      ),
    );
    ok(await acceptArtifactRevision(aliceCtx, { ...superseded, justification: REASON }, deps));
    /* A newer revision lands AFTER the decision: it must not inherit it. */
    await seedArtifact(setup, alice.tenantId, alice.userId, "the newer bytes", 2, superseded.artifactId);

    const listing = [
      { artifactId: untouched.artifactId, revisionNo: 1 },
      { artifactId: accepted.artifactId, revisionNo: 1 },
      { artifactId: reversed.artifactId, revisionNo: 1 },
      { artifactId: superseded.artifactId, revisionNo: 2 },
      { artifactId: foreign.artifactId, revisionNo: 1 },
    ];

    const before = await snapshot(setup);
    const read = await readCurrentRevisionReviewStates(aliceCtx, listing, deps);
    const after = await snapshot(setup);
    assert.equal(after, before, "reading review state writes nothing to artifacts, revisions or the ledger");

    assert.equal(read.status, "read");
    if (read.status !== "read") throw new Error("unreachable");

    /* ── THE FOUR ROW ANSWERS ───────────────────────────────────────────────── */
    assert.equal(artifactRowReviewStatus(read, untouched.artifactId), "awaiting-review");
    assert.equal(artifactRowReviewStatus(read, accepted.artifactId), "accepted");
    assert.equal(artifactRowReviewStatus(read, reversed.artifactId), "accepted", "the latest decision wins");
    assert.equal(read.states[reversed.artifactId]!.decisionCount, 2, "and the reversal is still counted");
    assert.equal(
      artifactRowReviewStatus(read, superseded.artifactId),
      "awaiting-review",
      "a decision about revision 1 does not make revision 2 look reviewed",
    );
    assert.equal(read.states[superseded.artifactId]!.revisionNo, 2);
    assert.equal(
      artifactRowReviewStatus(read, foreign.artifactId),
      "unknown",
      "another organization's artifact resolves to nothing here",
    );
    assert.equal(read.states[foreign.artifactId], undefined);

    /* ── THE SAME DERIVATION AS THE RELEASED PER-ARTIFACT READER ─────────────── */
    for (const item of listing.slice(0, 4)) {
      const released = await readArtifactRevisionReviewStates(aliceCtx, item.artifactId, deps);
      const releasedCurrent = released.find((s) => s.revisionNo === item.revisionNo);
      assert.deepEqual(read.states[item.artifactId], releasedCurrent, "batched == released, per artifact");
    }

    /* The foreign tenant reading its own artifact sees its own answer, and nothing of Acme's. */
    const erinRead = await readCurrentRevisionReviewStates(erinCtx, listing, deps);
    assert.equal(erinRead.status, "read");
    if (erinRead.status === "read") {
      assert.deepEqual(Object.keys(erinRead.states), [foreign.artifactId]);
      assert.equal(artifactRowReviewStatus(erinRead, foreign.artifactId), "awaiting-review");
    }

    /* ── UNREADABLE IS NOT UNREVIEWED ────────────────────────────────────────── */
    const noDb = await readCurrentRevisionReviewStates(aliceCtx, listing, { getDb: () => null });
    assert.deepEqual(noDb, { status: "unavailable" });
    assert.equal(artifactRowReviewStatus(noDb, untouched.artifactId), "unknown");
    const noSession = await readCurrentRevisionReviewStates(null, listing, deps);
    assert.deepEqual(noSession, { status: "unavailable" });
    const empty = await readCurrentRevisionReviewStates(aliceCtx, [], deps);
    assert.deepEqual(empty, { status: "read", states: {} });

    console.log(
      "cgo8-review-legibility/current-review-postgres: awaiting/accepted/latest-wins/current-revision-only, " +
        "foreign tenant unknown, batched == released derivation, read writes nothing, unreadable != unreviewed",
    );
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
