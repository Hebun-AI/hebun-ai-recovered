/*
 * V1-STAGE-4 — Profile & Team against a disposable PostgreSQL with the canonical migrations.
 * Acme: a director who holds Governance authority and an editor who does not. Globex: a director
 * with no Governance established. Synthetic identities only.
 *
 * Proves: own profile/tenant/role read through the session's own membership only; a forged context
 * mixing tenants reads nothing; display-name edit is self-only, validated, optimistic, audited, and
 * becomes the person's label; the team (members, roles, pending invitations) is visible to the
 * Governance authority only — a member and an unestablished tenant get `authority-only`; no
 * membership, role, invitation or other user row is ever written.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { readOwnProfile, readTeam, updateOwnDisplayName } from "../../src/features/account-profile/account-profile.server";
import { resolveHumanLabels } from "../../src/features/auth-runtime/human-label-read.server";

interface Seeded { readonly tenantId: string; readonly userId: string; readonly authIdentityId: string; readonly membershipId: string; readonly roleId: string }
const JUSTIFICATION = "Establishing Governance for this organization is a deliberate act and I accept responsibility.";

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("v1-account-profile/profile-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_v1_profile");
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
        mfaVerified: false, requestId: "v1-profile-request", authenticatedAt: new Date().toISOString(),
      });
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme Rugs", companySlug: "acme-v1p", email: "director@acme.test", userName: "Ada Director" })) as Seeded;
    const globex = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-v1p", email: "director@globex.test", userName: "Gil Director" })) as Seeded;
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
    const deps = { getDb: () => handle.db, now: () => new Date("2026-11-10T09:00:00.000Z") };

    const n = async (q: string) => (await setup.query<{ n: string }>(q)).rows[0]!.n;
    const authorityRows = async () => ({
      memberships: await n("select count(*)::text || ':' || md5(string_agg(id::text||status::text||coalesce(role_id::text,''), ',' order by id)) n from memberships"),
      roles: await n("select count(*)::text || ':' || md5(string_agg(id::text||name, ',' order by id)) n from roles"),
      invitations: await n("select count(*)::text n from invitations"),
      otherUsers: await n(`select md5(string_agg(id::text||coalesce(display_name,'')||coalesce(name,'')||email, ',' order by id)) n from users where id <> '${acme.userId}'`),
    });
    const before = await authorityRows();

    /* P1 — own profile, tenant, role and authority. */
    const p1 = await readOwnProfile(acmeCtx, deps);
    assert.equal(p1.status, "read", JSON.stringify(p1));
    if (p1.status !== "read") return;
    assert.equal(p1.profile.email, "director@acme.test");
    assert.equal(p1.profile.name, "Ada Director");
    assert.equal(p1.profile.displayName, null);
    assert.deepEqual(p1.profile.tenant, { name: "Acme Rugs", slug: "acme-v1p", status: "active" });
    assert.equal(p1.profile.membership.roleName, "Owner");
    assert.equal(p1.profile.viewerIsGovernanceAuthority, true);
    const e1 = await readOwnProfile(editorCtx, deps);
    assert.ok(e1.status === "read" && e1.profile.membership.roleName === "Editor" && !e1.profile.viewerIsGovernanceAuthority && e1.profile.tenant.name === "Acme Rugs");
    console.log("ok P1 own profile, organization, role and authority read through the session's own membership");

    /* P2 — a forged context mixing tenants reads nothing. */
    const forged = { ...globexCtx, membershipId: acme.membershipId } as TenantContext;
    assert.deepEqual(await readOwnProfile(forged, deps), { status: "unavailable" });
    const forged2 = { ...acmeCtx, userId: globex.userId } as TenantContext;
    assert.deepEqual(await readOwnProfile(forged2, deps), { status: "unavailable" });
    assert.deepEqual(await readOwnProfile(null, deps), { status: "unauthenticated" });
    console.log("ok P2 a context whose tenant, membership and user do not belong together reads nothing");

    /* P3 — display name: validation, optimistic version, audit, self only. */
    for (const bad of ["x".repeat(81), "Ada\u0000", "Ada\u202eDirector", 42, null]) {
      const r = await updateOwnDisplayName(acmeCtx, { displayName: bad, expectedVersion: p1.profile.profileVersion }, deps);
      assert.deepEqual(r, { status: "refused", reason: "invalid-display-name" }, JSON.stringify(bad));
    }
    assert.deepEqual(await updateOwnDisplayName(acmeCtx, { displayName: "Ada", expectedVersion: p1.profile.profileVersion + 5 }, deps), { status: "refused", reason: "stale-version" });
    assert.deepEqual(await updateOwnDisplayName(null, { displayName: "Ada", expectedVersion: 1 }, deps), { status: "refused", reason: "unauthenticated" });
    const v0 = p1.profile.profileVersion;
    const u1 = await updateOwnDisplayName(acmeCtx, { displayName: "  Ada   D.  ", expectedVersion: v0 }, deps);
    assert.deepEqual(u1, { status: "updated", displayName: "Ada D.", profileVersion: v0 + 1 });
    assert.deepEqual(await updateOwnDisplayName(acmeCtx, { displayName: "Ada D.", expectedVersion: v0 + 1 }, deps), { status: "unchanged" });
    const audits = (await setup.query<{ tenant_id: string; actor_id: string; entity_id: string; previous_state: { version: number }; next_state: { version: number }; metadata: Record<string, unknown> }>(
      `select tenant_id, actor_id, entity_id, previous_state, next_state, metadata from audit_log where action='account.display_name.changed'`,
    )).rows;
    assert.equal(audits.length, 1, "one audit row; the unchanged save wrote none");
    assert.deepEqual([audits[0]!.tenant_id, audits[0]!.actor_id, audits[0]!.entity_id], [acme.tenantId, acme.userId, acme.userId]);
    assert.deepEqual([audits[0]!.previous_state, audits[0]!.next_state, audits[0]!.metadata], [{ version: v0 }, { version: v0 + 1 }, { field: "display_name", cleared: false }]);
    assert.ok(!JSON.stringify(audits[0]).includes("Ada"), "the audit row records that the name changed, never the name");
    const labels = await resolveHumanLabels(acmeCtx, [acme.userId], { getDb: () => handle.db });
    assert.equal(labels.get(acme.userId), "Ada D.", "the display name is now the person's label");
    assert.deepEqual(await authorityRows(), before, "no membership, role, invitation or other user row moved");
    const cleared = await updateOwnDisplayName(acmeCtx, { displayName: "   ", expectedVersion: v0 + 1 }, deps);
    assert.deepEqual(cleared, { status: "updated", displayName: null, profileVersion: v0 + 2 });
    console.log("ok P3 own display name: validated, optimistic, audited once per change, becomes the label, clearable; nothing else written");

    /* P4 — another tenant's session can only ever change its own user. */
    await updateOwnDisplayName(acmeCtx, { displayName: "Ada", expectedVersion: v0 + 2 }, deps);
    const g = await readOwnProfile(globexCtx, deps);
    assert.ok(g.status === "read");
    if (g.status === "read") await updateOwnDisplayName(globexCtx, { displayName: "Gil", expectedVersion: g.profile.profileVersion }, deps);
    const rows = (await setup.query<{ id: string; display_name: string | null }>(`select id, display_name from users where id in ($1,$2)`, [acme.userId, globex.userId])).rows;
    assert.deepEqual(Object.fromEntries(rows.map((r) => [r.id, r.display_name])), { [acme.userId]: "Ada", [globex.userId]: "Gil" });
    console.log("ok P4 each session changes only its own user");

    /* P4b — a member can never hold another tenant's role: the schema refuses it (composite FK
       (tenant_id, role_id) → roles), so the role read cannot cross tenants either. */
    await assert.rejects(
      setup.query(`update memberships set role_id = $1 where id = $2`, [globex.roleId, editorMembership]),
      (e: { code?: string }) => e.code === "23503",
      "a cross-tenant role is refused by the database",
    );
    console.log("ok P4b a membership cannot point at another tenant's role (schema-enforced)");

    /* P5 — the team is the Governance authority's view only. */
    const t1 = await readTeam(acmeCtx, deps);
    assert.equal(t1.status, "read", JSON.stringify(t1));
    if (t1.status === "read") {
      const byId = new Map(t1.members.map((m) => [m.userId, m]));
      assert.deepEqual([byId.get(acme.userId)?.label, byId.get(acme.userId)?.roleName, byId.get(acme.userId)?.isViewer], ["Ada", "Owner", true]);
      assert.deepEqual([byId.get(editorUser)?.label, byId.get(editorUser)?.roleName, byId.get(editorUser)?.isViewer], ["Eda Editor", "Editor", false]);
      assert.ok(!byId.has(globex.userId), "no member of another tenant");
      assert.deepEqual(t1.invitations, []);
    }
    assert.deepEqual(await readTeam(editorCtx, deps), { status: "authority-only" }, "a member without authority sees no directory");
    assert.deepEqual(await readTeam(globexCtx, deps), { status: "authority-only" }, "an organization without established Governance shows no directory");
    assert.deepEqual(await readTeam(null, deps), { status: "unauthenticated" });
    console.log("ok P5 members with roles for the Governance authority only; a member and an unestablished tenant get authority-only");
    finished = true;
    console.log("PASS v1 account profile postgres");
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
