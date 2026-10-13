/*
 * HEBY ORGANIZATIONAL ACTION PLANNING — `/plan` over the REAL released readers, two organizations.
 *
 * The plan reads only the session tenant's work and writes nothing.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedAgentMandate } from "../helpers/agent-mandate-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { recordDepartment } from "../../src/features/organization-authority/write-structure.server";
import { recordWork } from "../../src/features/organizational-work/write-work.server";
import { readWorkRegister } from "../../src/features/organizational-work/read-work.server";
import { readOriginationAvailability } from "../../src/features/origination-availability/read-origination-availability.server";
import { runHebyReadCommand } from "../../src/features/heby-commands/read-commands.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const GENESIS = "This organization establishes its founding Governance authority for the action plan proof.";

type Seeded = Awaited<ReturnType<typeof seedLocalIdentity>>;

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_heby_action_plan");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;

  const organization = async (slug: string, hashChar: string) => {
    const org = (await seedLocalIdentity(setup, { companyName: slug, companySlug: slug, email: `director@${slug}.test` })) as Seeded;
    const session = (
      await setup.query<{ id: string }>(
        `insert into user_session_contexts (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
           user_id, active_tenant_id, active_membership_id, membership_version, assurance_level, mfa_verified, authenticated_at,
           issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
         values ($1,$2,1,$3,$4,$5,1,'aal1',false, now(), now(), now(), now() + interval '1 day', now() + interval '1 day') returning id`,
        [org.authIdentityId, hashChar.repeat(64), org.userId, org.tenantId, org.membershipId],
      )
    ).rows[0]!.id;
    const ctx: TenantContext = asHumanTenantContext({
      tenantId: org.tenantId, userId: org.userId, authIdentityId: org.authIdentityId, membershipId: org.membershipId,
      membershipVersion: 1, roleId: org.roleId, sessionContextId: session, provider: "local", assuranceLevel: "aal1",
      mfaVerified: false, requestId: slug, authenticatedAt: new Date().toISOString(),
    });
    await setup.query(
      `insert into genesis_nominations (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
         accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [org.tenantId, org.authIdentityId, org.userId, session],
    );
    assert.equal((await establishGovernanceAuthority(ctx, { justification: GENESIS }, deps)).status, "established");
    const dept = await recordDepartment(ctx, { name: "Engineering", slug: "engineering" }, deps);
    assert.equal(dept.status, "recorded");
    const departmentId = dept.status === "recorded" ? dept.department.departmentId : "";
    const agent = await createDurableAgentIdentity(ctx, { name: "Heby", justification: "Register this agent for the test organization." }, deps);
    assert.equal(agent.status, "established");
    await seedAgentMandate(setup, org, agent.status === "established" ? agent.identity.agentId : "", deps, { tag: `${slug}1`, proposalScope: ["record-work"] });
    return { ctx, departmentId };
  };

  const counts = async () =>
    (
      await setup.query(
        `select (select count(*) from heby_action_requests)::int r, (select count(*) from action_permits)::int p,
                (select count(*) from decision_records)::int d, (select count(*) from work_items)::int w,
                (select count(*) from audit_log)::int a`,
      )
    ).rows[0];

  try {
    const acme = await organization("plan-acme", "e");
    const globex = await organization("plan-globex", "f");
    for (const [ctx, departmentId, title, declaredState] of [
      [acme.ctx, acme.departmentId, "Acme blocked pipeline", "blocked"],
      [acme.ctx, acme.departmentId, "Acme active migration", "active"],
      [globex.ctx, globex.departmentId, "Globex secret project", "blocked"],
    ] as const) {
      assert.equal((await recordWork(ctx, { title, declaredState, departmentId }, deps)).status, "recorded");
    }

    const plan = async (ctx: TenantContext | null) => {
      const r = await runHebyReadCommand({ commandId: "plan", args: ["Engineering"], route: "/heby" }, {
        resolveTenant: async () => ctx,
        readWork: (t: TenantContext) => readWorkRegister(t, deps),
        readOriginationAvailability: (t: TenantContext) => readOriginationAvailability({ resolveTenant: async () => t, getDb: () => handle.db } as never),
      } as never);
      return r;
    };

    const before = await counts();
    const a = await plan(acme.ctx);
    assert.ok(a.status === "ok", JSON.stringify(a));
    const aText = a.status === "ok" ? a.result.lines.join("\n") : "";
    assert.match(aText, /Fact: 2 work items in service name the Engineering department/);
    assert.match(aText, /Priority 1 — Review the 1 item declared blocked/);
    assert.match(aText, /"Acme blocked pipeline"/);
    assert.doesNotMatch(aText, /Globex/, "no cross-tenant read");
    assert.match(aText, /Execution availability: (Offered now|Not offered right now)/);

    const g = await plan(globex.ctx);
    const gText = g.status === "ok" ? g.result.lines.join("\n") : "";
    assert.match(gText, /"Globex secret project"/);
    assert.doesNotMatch(gText, /Acme/, "and the other way round");

    assert.deepEqual(await plan(null), { status: "unauthorized" });
    assert.deepEqual(await counts(), before, "planning writes nothing: no request, permit, decision, work or audit row");

    console.log("PASS heby-org-action-planning plan-postgres");
  } finally {
    await setup.end().catch(() => {});
    await (handle as { dispose?: () => Promise<void> }).dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
