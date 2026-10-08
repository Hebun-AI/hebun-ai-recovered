/*
 * AP-4 RELEASE B PREFLIGHT — LIFECYCLE CLASSES, AGAINST A REAL DATABASE.
 *
 * The preflight must count as a blocker exactly the unscoped `record-work` items a human could still
 * DECIDE or the system could still SPEND after Release B, and nothing else. Every row here is made
 * by the released writer that owns it (propose → decide → spend / revoke), never by hand, except the
 * one anomaly no released writer can produce.
 *
 *   A  approved, permit consumed, work recorded          → history (not a blocker)
 *   B  approved, permit expired | revoked, never spent   → history: spending is refused, and no
 *                                                          second decision or permit is possible
 *   C  pending                                           → blocker
 *      approved, permit active and unexpired             → blocker (listed once, as the permit)
 *      rejected                                          → history
 *      approved with no permit (anomaly)                 → blocker
 *
 * Then the operator script itself is run against the same database: NOT CLEAR while C exists,
 * CLEAR once C is resolved through the released rejection path.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { proposeRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import {
  approveActionRequest,
  rejectActionRequest,
} from "../../src/features/action-authorization/decide-action-request.server";
import { revokeActionPermit } from "../../src/features/action-authorization/revoke-action-permit.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import {
  readUnscopedRecordWorkPermitBlockers,
  readUnscopedRecordWorkRequestBlockers,
} from "../../scripts/lib/ap4-release-b-blockers";

const PAST = new Date("2026-09-02T09:00:00.000Z");
const GENESIS = "I am establishing this organization's Governance authority so consequential acts can be decided.";
const APPROVE = "This work is real and I want it on the organization's register.";
const REJECT = "This proposal is no longer wanted and should not be recorded as work.";
const REVOKE = "The authorization is withdrawn before anyone spends it.";

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ap4b_preflight_lifecycle");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;
  const pastDeps = { getDb: () => handle.db, now: () => PAST } as never;

  try {
    const seeded = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-ap4b",
      email: "director@acme-ap4b.test",
    })) as { tenantId: string; userId: string; authIdentityId: string; membershipId: string; roleId: string };
    const session = (
      await setup.query<{ id: string }>(
        `insert into user_session_contexts
           (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
            user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
            mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
         values ($1, repeat('a', 64), 1, $2, $3, $4, 1, 'aal1', false, now(), now(), now(),
                 now() + interval '1 day', now() + interval '1 hour') returning id`,
        [seeded.authIdentityId, seeded.userId, seeded.tenantId, seeded.membershipId],
      )
    ).rows[0]!.id;
    const ctx: TenantContext = asHumanTenantContext({
      tenantId: seeded.tenantId,
      userId: seeded.userId,
      authIdentityId: seeded.authIdentityId,
      membershipId: seeded.membershipId,
      membershipVersion: 1,
      roleId: seeded.roleId,
      sessionContextId: session,
      provider: "local",
      assuranceLevel: "aal1",
      mfaVerified: false,
      requestId: "ap4b-preflight-lifecycle",
      authenticatedAt: new Date().toISOString(),
    });
    await setup.query(
      `insert into genesis_nominations
         (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
          accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [seeded.tenantId, seeded.authIdentityId, seeded.userId, session],
    );
    assert.equal((await establishGovernanceAuthority(ctx, { justification: GENESIS }, deps)).status, "established");

    const propose = async (title: string): Promise<string> => {
      const p = await proposeRecordWorkAction(ctx, { title, department: { kind: "organization-level" }, workScope: { kind: "organization" } } as never, deps);
      assert.equal(p.status, "proposed", `proposed: ${title}`);
      return p.status === "proposed" ? p.receipt.requestId : "";
    };
    const approve = async (requestId: string, d: never = deps): Promise<string> => {
      const a = await approveActionRequest(ctx, { requestId, justification: APPROVE, requestedTtlSeconds: 60 }, d);
      assert.equal(a.status, "authorized", `authorized ${requestId}`);
      return a.status === "authorized" ? a.permitId : "";
    };
    /*
     * AP-4B. Release B's writers file only SCOPED record-work, so the pre-B rows this preflight exists to
     * classify can no longer be produced by them. The rows below are made by the released writers and
     * then viewed AS LEGACY: the scope arguments are removed from the stored payload just for the
     * classification, and restored before any released writer touches the rows again.
     */
    const asLegacy = async <T>(read: () => Promise<T>): Promise<T> => {
      const saved = (await setup.query<{ id: string; p: unknown }>(`select id, canonical_payload p from heby_action_requests`)).rows;
      await setup.query(`set session_replication_role = replica`);
      await setup.query(`update heby_action_requests set canonical_payload = canonical_payload - 'workScope' - 'workDomainRef'`);
      try {
        return await read();
      } finally {
        for (const row of saved) await setup.query(`update heby_action_requests set canonical_payload = $2 where id = $1`, [row.id, JSON.stringify(row.p)]);
        await setup.query(`set session_replication_role = default`);
      }
    };
    const requestBlockers = async () => (await readUnscopedRecordWorkRequestBlockers(setup)).map((r) => r.id).sort();
    const permitBlockers = async () => (await readUnscopedRecordWorkPermitBlockers(setup)).map((p) => p.request).sort();

    /* A — approved, spent, work recorded. */
    const aRequest = await propose("A consumed and recorded");
    const aPermit = await approve(aRequest);
    assert.equal((await executeRecordWork(ctx, { permitId: aPermit }, deps)).status, "executed");
    const aState = (await setup.query(`select status from action_permits where id=$1`, [aPermit])).rows[0];
    assert.equal(aState.status, "consumed");
    assert.equal(
      (await setup.query(`select count(*)::int n from work_items where title='A consumed and recorded'`)).rows[0].n,
      1,
      "A: the work row exists",
    );

    /* B1 — approved, permit expired before it was spent (approved at a past instant, 60 s TTL). */
    const b1Request = await propose("B1 expired, never spent");
    const b1Permit = await approve(b1Request, pastDeps);
    const b1Spend = await executeRecordWork(ctx, { permitId: b1Permit }, deps);
    assert.notEqual(b1Spend.status, "executed", "B1: an expired permit cannot be spent");
    assert.equal(
      (await setup.query(`select status, expires_at <= now() expired from action_permits where id=$1`, [b1Permit])).rows[0].expired,
      true,
    );

    /* B2 — approved, permit revoked, never spent. */
    const b2Request = await propose("B2 revoked, never spent");
    const b2Permit = await approve(b2Request);
    const revoked = await revokeActionPermit(ctx, { permitId: b2Permit, justification: REVOKE, revocationReason: "withdrawn" }, deps);
    assert.equal(revoked.status, "revoked");
    assert.notEqual((await executeRecordWork(ctx, { permitId: b2Permit }, deps)).status, "executed", "B2: a revoked permit cannot be spent");

    /* B is terminal: an approved request cannot be decided again, so no second permit can appear. */
    for (const id of [b1Request, b2Request]) {
      assert.notEqual((await approveActionRequest(ctx, { requestId: id, justification: APPROVE }, deps)).status, "authorized", "no re-approval");
      assert.notEqual(
        (await rejectActionRequest(ctx, { requestId: id, justification: REJECT, rejectionReason: "late" }, deps)).status,
        "rejected",
        "no late rejection",
      );
    }
    for (const id of [aRequest, b1Request, b2Request]) {
      assert.equal(
        (await setup.query(`select count(*)::int n from action_permits where action_request_id=$1`, [id])).rows[0].n,
        1,
        "one permit per request, ever",
      );
    }

    /* C — pending (decidable), and approved with a live permit (spendable). */
    const cPending = await propose("C pending");
    const cLive = await propose("C live permit");
    const cLivePermit = await approve(cLive);
    /* Rejected — terminal. */
    const rejected = await propose("Rejected");
    assert.equal((await rejectActionRequest(ctx, { requestId: rejected, justification: REJECT, rejectionReason: "not wanted" }, deps)).status, "rejected");

    assert.deepEqual(await asLegacy(requestBlockers), [cPending].sort(), "only the pending request is a request blocker");
    assert.deepEqual(await asLegacy(permitBlockers), [cLive], "only the live permit is a permit blocker");
    assert.deepEqual(await requestBlockers(), [], "AP-4B: a scoped request is no Release B blocker");
    assert.deepEqual(await permitBlockers(), [], "AP-4B: a scoped permit is no Release B blocker");

    /* The operator script, end to end, on the same database. */
    const runPreflight = () =>
      spawnSync(process.execPath, ["--import", "tsx", path.join("scripts", "ap4-release-b-preflight.ts")], {
        cwd: path.resolve(import.meta.dirname, "..", ".."),
        env: { ...process.env, DATABASE_URL: harness.dbUrl },
        encoding: "utf8",
      });
    const notClear = await asLegacy(async () => runPreflight());
    assert.equal(notClear.status, 1, notClear.stdout + notClear.stderr);
    assert.match(notClear.stdout, /NOT CLEAR \(2\)/);
    for (const id of [aRequest, b1Request, b2Request, rejected]) assert.ok(!notClear.stdout.includes(id), `history ${id} is not listed`);

    /* Resolve C through the released paths: reject the pending one, spend the live one. */
    assert.equal((await rejectActionRequest(ctx, { requestId: cPending, justification: REJECT, rejectionReason: "not wanted" }, deps)).status, "rejected");
    assert.equal((await executeRecordWork(ctx, { permitId: cLivePermit }, deps)).status, "executed");
    assert.deepEqual(await asLegacy(requestBlockers), []);
    assert.deepEqual(await asLegacy(permitBlockers), []);
    const clear = await asLegacy(async () => runPreflight());
    assert.equal(clear.status, 0, clear.stdout + clear.stderr);
    assert.match(clear.stdout, /VERDICT: CLEAR/);

    /* Anomaly — an approved request with no permit cannot come from a released writer; it is reported. */
    await setup.query(`set session_replication_role = replica`);
    await setup.query(`delete from action_permits where action_request_id=$1`, [aRequest]);
    await setup.query(`set session_replication_role = default`);
    assert.deepEqual(await asLegacy(requestBlockers), [aRequest], "approved without a permit is a blocker");

    console.log("ap4 release-b preflight lifecycle: A/B history, C blockers, anomaly reported — 1 file passed");
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
