/*
 * V1-STAGE-3 — in-app notifications against a disposable PostgreSQL with the canonical migrations.
 * Acme: a director holding Governance authority and an editor who does not. Globex: its own director,
 * Governance established later in the test. Synthetic identities only; FK-bound fixture rows are
 * inserted with replication-role replica, CHECK constraints still enforced.
 *
 * Proves: the authority sees exactly the pending requests and the failed / refused (7 days) and
 * unknown or stale-pending attempts of its own tenant, split into publication and other actions; a
 * member and a tenant without Governance are not addressed; a forged context mixing tenants is not
 * addressed; nothing identifying leaves the read; the read writes nothing.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { readNotifications } from "../../src/features/notifications/notifications.server";

interface Seeded { readonly tenantId: string; readonly userId: string; readonly authIdentityId: string; readonly membershipId: string; readonly roleId: string }
const JUSTIFICATION = "Establishing Governance for this organization is a deliberate act and I accept responsibility.";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("v1-notifications/notifications-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_v1_notifications");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  try {
    const session = async (s: Seeded, tag: string) =>
      (await setup.query<{ id: string }>(
        `insert into user_session_contexts (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
           user_id, active_tenant_id, active_membership_id, membership_version, assurance_level, mfa_verified, authenticated_at,
           issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
         values ($1,$2,1,$3,$4,$5,1,'aal1',false,now(),now(),now(),now()+interval '1 day',now()+interval '1 hour') returning id`,
        [s.authIdentityId, tag.padEnd(64, "c").slice(0, 64), s.userId, s.tenantId, s.membershipId],
      )).rows[0]!.id;
    const ctxFor = (s: Seeded, sessionContextId: string): TenantContext =>
      asHumanTenantContext({
        tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId,
        membershipVersion: 1, roleId: s.roleId, sessionContextId, provider: "local", assuranceLevel: "aal1",
        mfaVerified: false, requestId: "v1-notifications-request", authenticatedAt: new Date().toISOString(),
      });
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme Rugs", companySlug: "acme-v1n", email: "director@acme.test", userName: "Ada Director" })) as Seeded;
    const globex = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-v1n", email: "director@globex.test", userName: "Gil Director" })) as Seeded;
    /* A second Acme member, an editor without Governance authority. */
    const editorUser = (await setup.query<{ id: string }>(`insert into users (email, name) values ('editor@acme.test','Eda Editor') returning id`)).rows[0]!.id;
    const editorIdentity = (await setup.query<{ id: string }>(
      `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at) values ($1,'local','hebun-local','local:editor@acme.test','active',true,now()) returning id`, [editorUser],
    )).rows[0]!.id;
    const editorRole = (await setup.query<{ id: string }>(`insert into roles (tenant_id, name, type) values ($1,'Editor','member') returning id`, [acme.tenantId])).rows[0]!.id;
    const editorMembership = (await setup.query<{ id: string }>(
      `insert into memberships (tenant_id, user_id, role_id, status) values ($1,$2,$3,'active') returning id`, [acme.tenantId, editorUser, editorRole],
    )).rows[0]!.id;
    const editor: Seeded = { tenantId: acme.tenantId, userId: editorUser, authIdentityId: editorIdentity, membershipId: editorMembership, roleId: editorRole };

    const acmeCtx = ctxFor(acme, await session(acme, "a1"));
    const editorCtx = ctxFor(editor, await session(editor, "e1"));
    const globexCtx = ctxFor(globex, await session(globex, "b2"));
    await setup.query(
      `insert into genesis_nominations (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source, accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [acme.tenantId, acme.authIdentityId, acme.userId, acmeCtx.sessionContextId],
    );
    assert.equal((await establishGovernanceAuthority(acmeCtx, { justification: JUSTIFICATION }, { getDb: () => handle.db })).status, "established");
    const deps = { getDb: () => handle.db };
    const SECRET_TITLE = "Secret launch caption for the Ankara rug";

    const request = async (s: Seeded, kind: string, status: "pending" | "approved") => {
      const payload = { note: SECRET_TITLE, nonce: randomUUID() };
      const approved = status === "approved";
      return (await setup.query<{ id: string }>(
        `insert into heby_action_requests
           (tenant_id, action_id, payload_digest, action_kind, tool_id, side_effect, reversibility, owner_workspace, requesting_workspace,
            canonical_payload, expected_effect, consequences, proposed_by_actor_type, proposed_by_actor_id, target_kind, target_ref,
            status, approved_by_actor_type, approved_by_actor_id, approved_at, approval_decision_id)
         values ($1,$2,$3,$4,'tool.x','external','irreversible','operations','heby',$5::jsonb,'effect','[]'::jsonb,'human',$6,'work-artifact',$7,$8,
                 ${approved ? "'human'" : "null"}, ${approved ? "$6" : "null"}, ${approved ? "now()" : "null"}, ${approved ? "gen_random_uuid()" : "null"})
         returning id`,
        [s.tenantId, randomUUID().replace(/-/g, ""), sha(JSON.stringify(payload)), kind, JSON.stringify(payload), s.userId, `work-artifact/${randomUUID()}@1`, status],
      )).rows[0]!.id;
    };
    /* status, provider response class, failure class, started this long ago. */
    const attempt = async (s: Seeded, kind: string, status: string, response: string | null, failure: string | null, ago: string) => {
      const publish = kind.startsWith("publish-");
      const req = await request(s, kind, "approved");
      await setup.query(
        `insert into action_execution_attempts (tenant_id, permit_id, handoff_id, action_request_id, action_kind, adapter_id, bound_payload_digest, draft_revision_digest,
            recipient_id, recipient_endpoint_digest, status, provider_response_class, provider_message_id, failure_class, started_at, completed_at)
         values ($1, gen_random_uuid(), gen_random_uuid(), $2, $3, 'adapter-v1', $4, $4, $5, $6, $7::action_execution_attempt_status, $8::action_execution_provider_response_class, $9, $10::action_execution_failure_class, now() - $11::interval,
                 case when $7::text = 'pending' then null else now() - $11::interval + interval '1 second' end)`,
        [s.tenantId, req, kind, sha(randomUUID()), publish ? null : randomUUID(), publish ? null : sha("endpoint"), status, response,
         status === "accepted" ? `provider-msg-${SECRET_TITLE}` : null, failure, ago],
      );
    };

    await setup.query("set session_replication_role = replica");
    await request(acme, "send-email", "pending");
    await request(acme, "publish-instagram-media", "pending");
    await attempt(acme, "publish-instagram-media", "failed", "rejected", "provider-rejected", "1 hour");
    await attempt(acme, "publish-youtube-video", "refused", null, "execution-disabled", "2 days");
    await attempt(acme, "publish-instagram-media", "failed", "rejected", "provider-rejected", "8 days");
    await attempt(acme, "publish-instagram-media", "unknown", "ambiguous", null, "30 days");
    await attempt(acme, "publish-instagram-media", "accepted", "accepted", null, "1 hour");
    await attempt(acme, "send-email", "failed", "unreachable", "provider-unreachable", "3 hours");
    await attempt(acme, "send-email", "pending", null, null, "1 hour");
    await attempt(acme, "send-email", "pending", null, null, "10 seconds");
    for (let i = 0; i < 4; i += 1) await attempt(globex, "publish-youtube-video", "failed", "rejected", "provider-rejected", "1 hour");
    await request(globex, "send-email", "pending");
    await setup.query("set session_replication_role = origin");

    const counts = async () =>
      (await setup.query<{ n: string }>(`select (select count(*) from heby_action_requests) + (select count(*) from action_execution_attempts) + (select count(*) from audit_log) as n`)).rows[0]!.n;

    /* N1 — the Governance authority sees its own tenant's attention items, split and windowed. */
    const a = await readNotifications(acmeCtx, deps);
    assert.equal(a.status, "read");
    if (a.status !== "read") throw new Error("unreachable");
    assert.deepEqual(
      a.items.map((i) => [i.kind, i.count, i.href]),
      [
        ["approvals-pending", 2, "/approvals"],
        ["publication-failed", 2, "/approvals"],
        ["publication-outcome-unknown", 1, "/approvals"],
        ["execution-failed", 1, "/approvals"],
        ["execution-outcome-unknown", 1, "/approvals"],
      ],
      "N1: 8-day-old failure, accepted and in-flight pending excluded; unknown counted whatever its age",
    );
    assert.ok(a.items.every((i) => i.at === null || !Number.isNaN(Date.parse(i.at))));
    console.log("ok N1 authority sees own pending approvals, failed and unknown attempts");

    /* N2 — nothing identifying leaves the read. */
    const json = JSON.stringify(a);
    for (const leak of ["Secret", "Ankara", "provider-msg", "work-artifact", acme.tenantId, acme.userId, "provider-rejected", "send-email"]) {
      assert.ok(!json.includes(leak), `N2: the read carries no ${leak}`);
    }
    console.log("ok N2 kinds, counts, instants and links only");

    /* N3 — a member and a tenant without Governance are not addressed; neither is a forged context. */
    assert.deepEqual(await readNotifications(editorCtx, deps), { status: "not-addressed" });
    assert.deepEqual(await readNotifications(globexCtx, deps), { status: "not-addressed" }, "N3: Globex has no Governance yet");
    assert.deepEqual(await readNotifications(null, deps), { status: "unauthenticated" });
    assert.deepEqual(await readNotifications(acmeCtx, { getDb: () => null }), { status: "unavailable" });
    console.log("ok N3 member, unestablished tenant and absent session are not addressed");

    /* N4 — once Globex establishes Governance, it sees its own figures only; a forged mix sees nothing. */
    await setup.query(
      `insert into genesis_nominations (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source, accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [globex.tenantId, globex.authIdentityId, globex.userId, globexCtx.sessionContextId],
    );
    assert.equal((await establishGovernanceAuthority(globexCtx, { justification: JUSTIFICATION }, deps)).status, "established");
    const g = await readNotifications(globexCtx, deps);
    assert.ok(g.status === "read");
    if (g.status !== "read") throw new Error("unreachable");
    assert.deepEqual(g.items.map((i) => [i.kind, i.count]), [["approvals-pending", 1], ["publication-failed", 4]], "N4: Globex's own, never Acme's");
    assert.deepEqual(await readNotifications(asHumanTenantContext({ ...acmeCtx, tenantId: globex.tenantId }), deps), { status: "not-addressed" }, "N4: Acme's authority over Globex's tenant is no authority");
    console.log("ok N4 tenant isolation; forged context not addressed");

    const settled = await counts();
    for (const ctx of [acmeCtx, editorCtx, globexCtx]) await readNotifications(ctx, deps);
    assert.equal(await counts(), settled, "N5: reads write nothing");
    console.log("ok N5 read only");
    finished = true;
    console.log("PASS v1 notifications postgres");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
