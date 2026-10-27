/*
 * GOVERNANCE-DECISION-EVIDENCE-READ-1 — reading back recorded review decisions, against a REAL
 * PostgreSQL DB.
 *
 * THE CLAIMS UNDER TEST:
 *   1. a Governance authority reads the decision as STORED: id, outcome, time, actor, authority
 *      source, the justification verbatim, and the evidence the review writer bound;
 *   2. a member without Governance authority gets `not-authorized` and the reader never selects a
 *      revision, a justification or an audit row on their behalf;
 *   3. another tenant's artifact or revision is `not-found`, and nothing of it is returned;
 *   4. the revision is resolved by (artifact, number): a decision on revision 1 is never shown as a
 *      decision on revision 2;
 *   5. evidence that was never recorded is `absent`, evidence of the wrong shape is `malformed`, and
 *      neither is ever filled from the revision itself;
 *   6. the digest comparison is `match`, `mismatch` or `not-recorded` and only compares stored values;
 *   7. audit events are linked by entity id: exactly one expected event is `linked`, extra events are
 *      `multiple` and all shown, a wrong action is `unexpected-action`, none is `missing`;
 *   8. an audit event filed under the same id in ANOTHER tenant is never attached, and the history
 *      reader's new `entityId` filter only narrows within the tenant;
 *   9. no store is `unavailable`, never "no decisions";
 *  12. reading writes nothing.
 *
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { getTableName, type Table } from "drizzle-orm";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb, type ControlPlaneDatabase } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import {
  acceptArtifactRevision,
  requestArtifactRevisionChanges,
} from "../../src/features/work-artifact-review/review-revision.server";
import {
  REVIEW_DECISION_AUDIT_ACTION,
  readRevisionReviewEvidence,
} from "../../src/features/work-artifact-review/read-review-evidence.server";
import { ARTIFACT_REVIEW_ACCEPTED_OUTCOME } from "../../src/features/work-artifact-review/contracts";
import { readGovernanceHistory } from "../../src/features/governance-audit/governance-decision-audit.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-10-28T09:00:00.000Z");
const REASON =
  "The plan, revision 1, has been reviewed and accepted as a proposed internal review plan.\n" +
  "It certifies nothing beyond the quality of the document.";
const REASON_CHANGES = "The ownership sentence contradicts the owner fields; correct it before acceptance.";

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
    requestId: "gder1-request",
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
    [seeded.authIdentityId, createHash("sha256").update(tag).digest("hex"), seeded.userId, seeded.tenantId, seeded.membershipId],
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

/** A second, ordinary member of an existing tenant: a membership, no Governance authority. */
async function seedMember(client: Client, tenantId: string, email: string): Promise<Seeded> {
  const userId = (await client.query<{ id: string }>(`insert into users (email, name) values ($1,$1) returning id`, [email])).rows[0]!.id;
  const authIdentityId = (
    await client.query<{ id: string }>(
      `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
       values ($1,'local','hebun-local',$2,'active',true,now()) returning id`,
      [userId, `local:${email}`],
    )
  ).rows[0]!.id;
  const roleId = (
    await client.query<{ id: string }>(`insert into roles (tenant_id, name, type) values ($1,'Member','member') returning id`, [tenantId])
  ).rows[0]!.id;
  const membershipId = (
    await client.query<{ id: string }>(
      `insert into memberships (tenant_id, user_id, role_id, status) values ($1,$2,$3,'active') returning id`,
      [tenantId, userId, roleId],
    )
  ).rows[0]!.id;
  return { tenantId, userId, authIdentityId, membershipId, roleId };
}

const sha = (content: string) => createHash("sha256").update(content, "utf8").digest("hex");

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
    id = (
      await client.query<{ id: string }>(
        `insert into work_artifacts
           (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace,
            current_revision, intended_destination, created_by, created_by_type)
         values ($1,'operational-plan',$2,'draft','operations',$3,null,$4,'human') returning id`,
        [tenantId, `Plan ${content.slice(0, 20)}`, revisionNo, authorId],
      )
    ).rows[0]!.id;
  } else {
    await client.query(`update work_artifacts set current_revision = $2 where id = $1`, [id, revisionNo]);
  }
  const revision = await client.query<{ id: string }>(
    `insert into work_artifact_revisions
       (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
     values ($1,$2,$3,$4,$5,'agent',$6) returning id`,
    [tenantId, id, revisionNo, content, sha(content), authorId],
  );
  return { artifactId: id!, revisionId: revision.rows[0]!.id };
}

/** A historical decision row written as an older writer might have, with evidence under test. */
async function insertHistoricalDecision(
  client: Client,
  seeded: Seeded,
  revisionId: string,
  evidence: unknown,
  decidedAt: string,
): Promise<string> {
  return (
    await client.query<{ id: string }>(
      `insert into decision_records
         (tenant_id, decision_type, subject_type, subject_id, actor_type, actor_id, outcome,
          justification, evidence, decided_at, created_by, created_by_type)
       values ($1,'approve','work_artifact_revision',$2,'human',$3,$4,$5,$6::jsonb,$7,$3,'human')
       returning id`,
      [seeded.tenantId, revisionId, seeded.userId, ARTIFACT_REVIEW_ACCEPTED_OUTCOME,
       "A historical decision whose evidence shape is under test.", evidence === undefined ? null : JSON.stringify(evidence), decidedAt],
    )
  ).rows[0]!.id;
}

async function insertAuditEvent(client: Client, tenantId: string, actorId: string, entityId: string, action: string): Promise<string> {
  return (
    await client.query<{ id: string }>(
      `insert into audit_log (tenant_id, actor_type, actor_id, action, entity_type, entity_id, occurred_at, result, source, authority_source)
       values ($1,'human',$2,$3,'governance_decision',$4, now(),'committed','governance-authority','membership') returning id`,
      [tenantId, actorId, action, entityId],
    )
  ).rows[0]!.id;
}

async function snapshot(client: Client): Promise<string> {
  const rows = await client.query(
    `select
       (select coalesce(json_agg(t order by t.id), '[]') from work_artifacts t) as artifacts,
       (select coalesce(json_agg(t order by t.id), '[]') from work_artifact_revisions t) as revisions,
       (select coalesce(json_agg(t order by t.id), '[]') from decision_records t) as decisions,
       (select coalesce(json_agg(t order by t.id), '[]') from audit_log t) as audit`,
  );
  return JSON.stringify(rows.rows[0]);
}

/**
 * Records every table a reader selects FROM and every column key it selects, so "never queried the
 * decision text" is measured rather than assumed.
 */
function recordingDb(db: ControlPlaneDatabase) {
  const tables: string[] = [];
  const columns: string[] = [];
  const proxied = new Proxy(db as object, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop !== "select" || typeof value !== "function") return value;
      return (fields?: Record<string, unknown>) => {
        if (fields) columns.push(...Object.keys(fields));
        const builder = (value as (f?: unknown) => { from: (t: Table) => unknown }).call(target, fields);
        return new Proxy(builder as object, {
          get(b, p, r) {
            const v = Reflect.get(b, p, r);
            if (p !== "from" || typeof v !== "function") return v;
            return (table: Table) => {
              tables.push(getTableName(table));
              return (v as (t: Table) => unknown).call(b, table);
            };
          },
        });
      };
    },
  }) as ControlPlaneDatabase;
  return { db: proxied, tables, columns };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_gder1_evidence");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW };
  try {
    harness.migrateDatabase();
    await setup.connect();

    const alice = await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme", email: "alice@acme.test", password: "alice-correct-password-7Qx" });
    const aliceCtx = contextFor(alice, await sessionRowFor(setup, alice, "a1"));
    await establishGovernance(setup, alice, aliceCtx, deps);
    const bob = await seedMember(setup, alice.tenantId, "bob@acme.test");
    const bobCtx = contextFor(bob, await sessionRowFor(setup, bob, "b1"));

    const other = await seedLocalIdentity(setup, { companyName: "Other", companySlug: "other", email: "erin@other.test", password: "erin-correct-password-7Qx" });
    const erinCtx = contextFor(other, await sessionRowFor(setup, other, "e1"));
    await establishGovernance(setup, other, erinCtx, deps);

    const plan = await seedArtifact(setup, alice.tenantId, alice.userId, "# Plan\nThe owner is currently UNKNOWN.");
    const reviewed = await acceptArtifactRevision(aliceCtx, { ...plan, justification: REASON }, deps);
    assert.equal(reviewed.status, "reviewed");
    if (reviewed.status !== "reviewed") throw new Error("unreachable");
    const foreign = await seedArtifact(setup, other.tenantId, other.userId, "another organization's plan");
    const foreignReview = await acceptArtifactRevision(erinCtx, { ...foreign, justification: REASON }, deps);
    assert.equal(foreignReview.status, "reviewed");
    if (foreignReview.status !== "reviewed") throw new Error("unreachable");

    /* ── 1. AUTHORIZED READ — every field as stored ─────────────────────────── */
    const before = await snapshot(setup);
    const read = await readRevisionReviewEvidence(aliceCtx, { artifactId: plan.artifactId, revisionNo: 1 }, deps);
    assert.equal(read.status, "read");
    if (read.status !== "read") throw new Error("unreachable");
    assert.equal(read.revisionId, plan.revisionId);
    assert.equal(read.storedContentDigest, sha("# Plan\nThe owner is currently UNKNOWN."));
    assert.equal(read.decisions.length, 1);
    const d = read.decisions[0]!;
    assert.equal(d.decisionId, reviewed.decisionId);
    assert.equal(d.decision, "accepted");
    assert.equal(d.outcome, ARTIFACT_REVIEW_ACCEPTED_OUTCOME);
    assert.equal(d.decidedAt, NOW.toISOString());
    assert.equal(d.actorType, "human");
    assert.equal(d.actorId, alice.userId);
    assert.ok(!("actorLabel" in d), "no display label is resolved: the human-label census stays closed");
    assert.equal(d.authoritySourceActorId, alice.userId);
    assert.equal(d.justification, REASON, "the justification is returned verbatim, line breaks included");
    assert.deepEqual(d.recordedArtifactId, { status: "recorded", value: plan.artifactId });
    assert.deepEqual(d.recordedRevisionNo, { status: "recorded", value: 1 });
    assert.deepEqual(d.recordedContentDigest, { status: "recorded", value: read.storedContentDigest });
    assert.equal(d.digestComparison, "match");
    /* 7 — linked by entity id, carrying the event the writer filed in the same transaction. */
    assert.equal(d.audit.status, "read");
    if (d.audit.status !== "read") throw new Error("unreachable");
    assert.equal(d.audit.linkage, "linked");
    assert.equal(d.audit.records.length, 1);
    assert.equal(d.audit.records[0]!.entityId, reviewed.decisionId);
    assert.equal(d.audit.records[0]!.action, REVIEW_DECISION_AUDIT_ACTION);
    assert.equal(d.audit.records[0]!.actorId, alice.userId);
    assert.equal(d.audit.records[0]!.outcome, "committed");
    const stored = await setup.query(`select id from audit_log where entity_id = $1`, [reviewed.decisionId]);
    assert.equal(d.audit.records[0]!.auditId, stored.rows[0]!.id, "the event id is the stored row's id");
    /* 12 — reading writes nothing. */
    assert.equal(await snapshot(setup), before, "reading evidence writes nothing anywhere");

    /* ── 2. UNAUTHORIZED — refused before any record is selected ────────────── */
    const watched = recordingDb(handle.db);
    const refused = await readRevisionReviewEvidence(bobCtx, { artifactId: plan.artifactId, revisionNo: 1 }, { getDb: () => watched.db });
    assert.deepEqual(refused, { status: "not-authorized" }, "a member without Governance gets no decision data");
    assert.ok(!watched.tables.includes("work_artifact_revisions"), `no revision was read: ${watched.tables}`);
    assert.ok(!watched.tables.includes("audit_log"), "no audit row was read");
    assert.ok(!watched.columns.includes("justification"), "no justification column was ever selected");
    assert.ok(!watched.columns.includes("evidence"), "no evidence column was ever selected");
    /* Positive control: the same recorder DOES see these on an authorized read. */
    const watchedOk = recordingDb(handle.db);
    await readRevisionReviewEvidence(aliceCtx, { artifactId: plan.artifactId, revisionNo: 1 }, { getDb: () => watchedOk.db });
    assert.ok(watchedOk.tables.includes("work_artifact_revisions") && watchedOk.columns.includes("justification"), "the recorder bites");
    assert.deepEqual(await readRevisionReviewEvidence(null, { artifactId: plan.artifactId, revisionNo: 1 }, deps), { status: "not-authorized" });

    /* ── 3. CROSS-TENANT ────────────────────────────────────────────────────── */
    assert.deepEqual(
      await readRevisionReviewEvidence(aliceCtx, { artifactId: foreign.artifactId, revisionNo: 1 }, deps),
      { status: "not-found" },
      "another tenant's revision is not found, and nothing of it is returned",
    );
    const erinOwn = await readRevisionReviewEvidence(erinCtx, { artifactId: plan.artifactId, revisionNo: 1 }, deps);
    assert.deepEqual(erinOwn, { status: "not-found" }, "a foreign Governance authority cannot read Acme's decision");
    /* A forged tenant field in the target is ignored: the tenant is the session's. */
    assert.deepEqual(
      await readRevisionReviewEvidence(aliceCtx, { artifactId: foreign.artifactId, revisionNo: 1, tenantId: other.tenantId } as never, deps),
      { status: "not-found" },
    );

    /* ── 4. REVISION MISMATCH ───────────────────────────────────────────────── */
    await seedArtifact(setup, alice.tenantId, alice.userId, "# Plan\nRevised bytes.", 2, plan.artifactId);
    const rev2 = await readRevisionReviewEvidence(aliceCtx, { artifactId: plan.artifactId, revisionNo: 2 }, deps);
    assert.equal(rev2.status, "read");
    if (rev2.status === "read") assert.deepEqual(rev2.decisions, [], "a decision on revision 1 is never shown on revision 2");
    assert.deepEqual(await readRevisionReviewEvidence(aliceCtx, { artifactId: plan.artifactId, revisionNo: 3 }, deps), { status: "not-found" });
    for (const bad of [null, {}, { artifactId: "not-a-uuid", revisionNo: 1 }, { artifactId: plan.artifactId, revisionNo: 0 }, { artifactId: plan.artifactId, revisionNo: "1" }]) {
      assert.deepEqual(await readRevisionReviewEvidence(aliceCtx, bad, deps), { status: "not-found" }, `malformed target ${JSON.stringify(bad)}`);
    }

    /* ── 5 + 6. HISTORICAL / MALFORMED EVIDENCE, DIGEST MATCH AND MISMATCH ──── */
    const hist = await seedArtifact(setup, alice.tenantId, alice.userId, "historical plan bytes");
    const noEvidence = await insertHistoricalDecision(setup, alice, hist.revisionId, undefined, "2026-10-01T00:00:00.000Z");
    const emptyEvidence = await insertHistoricalDecision(setup, alice, hist.revisionId, {}, "2026-10-02T00:00:00.000Z");
    const malformed = await insertHistoricalDecision(setup, alice, hist.revisionId, { workArtifactId: "x", revisionNo: "1", contentDigest: "ABC" }, "2026-10-03T00:00:00.000Z");
    const mismatched = await insertHistoricalDecision(setup, alice, hist.revisionId, { workArtifactId: hist.artifactId, revisionNo: 1, contentDigest: sha("other bytes") }, "2026-10-04T00:00:00.000Z");
    const arrayEvidence = await insertHistoricalDecision(setup, alice, hist.revisionId, ["contentDigest"], "2026-10-05T00:00:00.000Z");
    const histRead = await readRevisionReviewEvidence(aliceCtx, { artifactId: hist.artifactId, revisionNo: 1 }, deps);
    assert.equal(histRead.status, "read");
    if (histRead.status !== "read") throw new Error("unreachable");
    const byId = new Map(histRead.decisions.map((x) => [x.decisionId, x]));
    assert.deepEqual(histRead.decisions.map((x) => x.decisionId), [arrayEvidence, mismatched, malformed, emptyEvidence, noEvidence], "newest first, none dropped");
    for (const id of [noEvidence, emptyEvidence, arrayEvidence]) {
      const x = byId.get(id)!;
      assert.deepEqual(x.recordedContentDigest, { status: "absent" });
      assert.deepEqual(x.recordedRevisionNo, { status: "absent" });
      assert.deepEqual(x.recordedArtifactId, { status: "absent" });
      assert.equal(x.digestComparison, "not-recorded", "an unrecorded digest is never a match");
    }
    const m = byId.get(malformed)!;
    assert.deepEqual(m.recordedContentDigest, { status: "malformed" });
    assert.deepEqual(m.recordedRevisionNo, { status: "malformed" }, "a string revision number is not coerced");
    assert.deepEqual(m.recordedArtifactId, { status: "malformed" });
    assert.equal(m.digestComparison, "not-recorded");
    const mm = byId.get(mismatched)!;
    assert.equal(mm.digestComparison, "mismatch", "a different recorded digest is reported, not hidden");
    assert.deepEqual(mm.recordedContentDigest, { status: "recorded", value: sha("other bytes") });

    /* ── 7. AUDIT LINKAGE: missing, multiple, unexpected-action ─────────────── */
    const linkage = (id: string) => {
      const a = byId.get(id)!.audit;
      assert.equal(a.status, "read");
      return a.status === "read" ? a : null;
    };
    assert.equal(linkage(noEvidence)!.linkage, "missing");
    await insertAuditEvent(setup, alice.tenantId, alice.userId, emptyEvidence, "governance.decision.superseded");
    await insertAuditEvent(setup, alice.tenantId, alice.userId, malformed, REVIEW_DECISION_AUDIT_ACTION);
    await insertAuditEvent(setup, alice.tenantId, alice.userId, malformed, REVIEW_DECISION_AUDIT_ACTION);
    const again = await readRevisionReviewEvidence(aliceCtx, { artifactId: hist.artifactId, revisionNo: 1 }, deps);
    if (again.status !== "read") throw new Error("unreachable");
    const againBy = new Map(again.decisions.map((x) => [x.decisionId, x.audit]));
    const unexpected = againBy.get(emptyEvidence)!;
    assert.ok(unexpected.status === "read" && unexpected.linkage === "unexpected-action" && unexpected.records.length === 1);
    const multiple = againBy.get(malformed)!;
    assert.ok(multiple.status === "read" && multiple.linkage === "multiple" && multiple.records.length === 2, "every event is shown");

    /* ── 8. AUDIT TENANT ISOLATION ──────────────────────────────────────────── */
    /* An event filed under Acme's decision id but in ANOTHER tenant is never attached. */
    await insertAuditEvent(setup, other.tenantId, other.userId, reviewed.decisionId, REVIEW_DECISION_AUDIT_ACTION);
    const isolated = await readRevisionReviewEvidence(aliceCtx, { artifactId: plan.artifactId, revisionNo: 1 }, deps);
    if (isolated.status !== "read") throw new Error("unreachable");
    const iso = isolated.decisions[0]!.audit;
    assert.ok(iso.status === "read" && iso.linkage === "linked" && iso.records.length === 1, "the foreign event is not attached");
    const foreignFiltered = await readGovernanceHistory({ tenantId: alice.tenantId }, { getDb: () => handle.db, entityId: foreignReview.decisionId });
    assert.deepEqual(foreignFiltered, { status: "read", records: [] }, "the entityId filter cannot reach another tenant's decision");
    const malformedFilter = await readGovernanceHistory({ tenantId: alice.tenantId }, { getDb: () => handle.db, entityId: "nope" });
    assert.deepEqual(malformedFilter, { status: "read", records: [] }, "a malformed entityId is no events, never an unfiltered history");
    const unfiltered = await readGovernanceHistory({ tenantId: alice.tenantId }, { getDb: () => handle.db });
    assert.equal(unfiltered.status, "read");
    if (unfiltered.status === "read") {
      assert.ok(unfiltered.records.length > 1, "without the filter the released history is unchanged");
      assert.ok(unfiltered.records.every((r) => r.entityId !== foreignReview.decisionId), "and still holds nothing foreign");
    }

    /* A changes-requested decision reads the same way (the reason is a decision's own words too). */
    const second = await seedArtifact(setup, alice.tenantId, alice.userId, "second plan");
    const changes = await requestArtifactRevisionChanges(aliceCtx, { ...second, justification: REASON_CHANGES }, deps);
    assert.equal(changes.status, "reviewed");
    const changesRead = await readRevisionReviewEvidence(aliceCtx, { artifactId: second.artifactId, revisionNo: 1 }, deps);
    assert.ok(changesRead.status === "read" && changesRead.decisions[0]!.decision === "changes-requested" && changesRead.decisions[0]!.justification === REASON_CHANGES);

    /* ── 9. UNAVAILABLE ─────────────────────────────────────────────────────── */
    assert.deepEqual(await readRevisionReviewEvidence(aliceCtx, { artifactId: plan.artifactId, revisionNo: 1 }, { getDb: () => null }), { status: "unavailable" });
    /* A store that fails after authority is established is unavailable, never "no decisions". */
    /* The decision-text query fails: authority was established, so the honest answer is unavailable. */
    const failing = new Proxy(handle.db as object, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (prop === "select" && typeof value === "function") {
          return (fields?: Record<string, unknown>) => {
            if (fields && "justification" in fields) throw new Error("connection lost");
            return (value as (f?: unknown) => unknown).call(target, fields);
          };
        }
        return value;
      },
    }) as ControlPlaneDatabase;
    const lost = await readRevisionReviewEvidence(aliceCtx, { artifactId: plan.artifactId, revisionNo: 1 }, { getDb: () => failing });
    assert.deepEqual(lost, { status: "unavailable" }, "a lost store never reads as 'no decisions'");
    const audit = await readGovernanceHistory({ tenantId: alice.tenantId }, { getDb: () => null, entityId: reviewed.decisionId });
    assert.equal(audit.status, "unavailable");

    console.log(
      "governance-decision-evidence-read-1/evidence-postgres: authorized read verbatim, unauthorized blocked before " +
        "any record, cross-tenant not-found, revision-exact, absent/malformed evidence, digest match/mismatch/not-recorded, " +
        "audit linked/missing/multiple/unexpected, audit tenant isolation, unavailable, read writes nothing",
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
