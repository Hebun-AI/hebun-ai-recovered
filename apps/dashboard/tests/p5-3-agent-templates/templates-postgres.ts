/*
 * P5-3 — an agent set up from a template, through the released setup acts only. Real disposable
 * PostgreSQL and the released writers. No network.
 *
 *   T1  each template (Content, Research, Operations) registers the agent, records its mandate with the
 *       template's purpose as the role, the narrowest scope and organization responsibility; with a
 *       department it is placed too. Two Governance decisions (registration, mandate) and, when placed,
 *       one placement audit event; no more.
 *   T2  a member without Governance authority is refused at the first step; nothing is written
 *   T3  a name already in service is refused at the first step; nothing is written
 *   T5  a refused placement leaves identity and mandate and says so (`partial`, step `placement`).
 *       The mandate step shares the identity writer's validators, so no input passes step 1 and fails
 *       step 2 deterministically; its `partial` branch has the same shape and is not separately driven.
 *   T6  an unknown template writes nothing
 *   T7  the template module reaches the database only through the three released writers
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedGovernanceAuthority } from "../helpers/agent-mandate-seed";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { createAgentFromTemplate } from "../../src/features/agent-templates/create-agent-from-template.server";
import { AGENT_TEMPLATES } from "../../src/features/agent-templates/templates";
import { readEffectiveAgentMandate } from "../../src/features/agent-mandate/read-agent-mandate.server";
import { readAgentPlacements } from "../../src/features/organization-authority/read-agent-placement.server";
import { recordDepartment, retireDepartment } from "../../src/features/organization-authority/write-structure.server";

let networkCalls = 0;
globalThis.fetch = (() => {
  networkCalls++;
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

async function sessionRow(client: Client, s: Seeded, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(), now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [s.authIdentityId, createHash("sha256").update(tag).digest("hex"), s.userId, s.tenantId, s.membershipId],
  );
  return row.rows[0]!.id;
}

const contextFor = (s: Seeded, sessionContextId: string): TenantContext =>
  asHumanTenantContext({
    tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId,
    membershipVersion: 1, roleId: s.roleId, sessionContextId, provider: "local", assuranceLevel: "aal1",
    mfaVerified: false, requestId: "p5-3-request", authenticatedAt: new Date().toISOString(),
  });

async function addMember(client: Client, tenantId: string, email: string): Promise<Seeded> {
  const user = (await client.query<{ id: string }>(`insert into users (email, name) values ($1, $1) returning id`, [email])).rows[0]!.id;
  const identity = (await client.query<{ id: string }>(
    `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
     values ($1, 'local', 'hebun-local', $2, 'active', true, now()) returning id`,
    [user, `local:${email}`],
  )).rows[0]!.id;
  const role = (await client.query<{ id: string }>(`insert into roles (tenant_id, name, type) values ($1, $2, 'owner') returning id`, [tenantId, `Role ${email}`])).rows[0]!.id;
  const membership = (await client.query<{ id: string }>(
    `insert into memberships (tenant_id, user_id, role_id, status) values ($1, $2, $3, 'active') returning id`,
    [tenantId, user, role],
  )).rows[0]!.id;
  return { tenantId, userId: user, authIdentityId: identity, membershipId: membership, roleId: role };
}

const WHY = "Set up this agent from its template for the P5-3 proof.";

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("p5-3-agent-templates/templates-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_p5_3_templates");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;
  const n = async (sql: string) => Number((await setup.query<{ n: number }>(sql)).rows[0]!.n);
  const world = async () => ({
    agents: await n("select count(*)::int n from agents"),
    mandates: await n("select count(*)::int n from agent_mandates"),
    placements: await n("select count(*)::int n from agents where department_id is not null"),
    decisions: await n("select count(*)::int n from decision_records"),
    placementAudits: await n("select count(*)::int n from audit_log where action = 'organization.agent-placement.set'"),
  });

  try {
    const acmeSeed = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-p53", email: "director@acme.test" })) as Seeded;
    const acme = contextFor(acmeSeed, await sessionRow(setup, acmeSeed, "p53-acme"));
    await seedGovernanceAuthority(setup, acmeSeed, deps, { ctx: acme, sessionContextId: acme.sessionContextId });
    const memberSeed = await addMember(setup, acmeSeed.tenantId, "member@acme.test");
    const member = contextFor(memberSeed, await sessionRow(setup, memberSeed, "p53-member"));
    const dept = await recordDepartment(acme, { name: "Marketing", slug: "marketing" }, deps);
    assert.equal(dept.status, "recorded", JSON.stringify(dept));
    const departmentId = dept.status === "recorded" ? dept.department.departmentId : "";

    /* ── T1 · every template, end to end ── */
    for (const template of AGENT_TEMPLATES) {
      const before = await world();
      const placeIt = template.id === "content";
      const r = await createAgentFromTemplate(
        acme,
        { templateId: template.id, name: template.name, justification: WHY, ...(placeIt ? { departmentId } : {}) },
        deps,
      );
      assert.equal(r.status, "created", `T1 ${template.id}: ${JSON.stringify(r)}`);
      if (r.status !== "created") throw new Error("unreachable");
      assert.equal(r.name, template.name);
      assert.equal(r.placed, placeIt);
      const mandate = await readEffectiveAgentMandate(acme, r.agentId, deps);
      assert.equal(mandate.status, "known");
      const m = mandate.status === "known" ? mandate.mandate : null;
      assert.equal(m?.purpose, template.purpose, `T1 ${template.id}: the purpose is the template's role`);
      assert.deepEqual(m?.proposalScope, [...template.proposalScope], `T1 ${template.id}: the narrowest scope`);
      const after = await world();
      assert.equal(after.agents - before.agents, 1, `T1 ${template.id}: one agent`);
      assert.equal(after.mandates - before.mandates, 1, `T1 ${template.id}: one mandate revision`);
      assert.equal(after.placements - before.placements, placeIt ? 1 : 0, `T1 ${template.id}: placed only when asked`);
      /* Registration and the mandate are Governance decisions; placement is Governance-gated and audited, not a decision. */
      assert.equal(after.decisions - before.decisions, 2, `T1 ${template.id}: two Governance decisions`);
      assert.equal(after.placementAudits - before.placementAudits, placeIt ? 1 : 0, `T1 ${template.id}: the placement is audited when made`);
    }
    const placements = await readAgentPlacements(acme, deps);
    assert.ok(JSON.stringify(placements).includes(departmentId), "T1: the content agent sits in Marketing");

    /* ── T2 · no Governance authority: refused before anything is written ── */
    {
      const before = await world();
      const r = await createAgentFromTemplate(member, { templateId: "research", name: "Research Two", justification: WHY }, deps);
      assert.equal(r.status, "refused", JSON.stringify(r));
      assert.deepEqual(await world(), before, "T2: nothing written");
    }

    /* ── T3 · a name in service: refused at registration ── */
    {
      const before = await world();
      const r = await createAgentFromTemplate(acme, { templateId: "content", name: "Content Agent", justification: WHY }, deps);
      assert.deepEqual(r, { status: "refused", reason: "agent-name-in-use" });
      assert.deepEqual(await world(), before, "T3: nothing written");
    }

    /* ── T5 · a refused placement leaves identity and mandate, and says which step ── */
    {
      const retiredDept = await recordDepartment(acme, { name: "Legacy", slug: "legacy" }, deps);
      const retiredId = retiredDept.status === "recorded" ? retiredDept.department.departmentId : "";
      const retired = await retireDepartment(acme, { departmentId: retiredId }, deps);
      assert.ok(retired.status !== "refused", JSON.stringify(retired));
      const before = await world();
      const r = await createAgentFromTemplate(acme, { templateId: "research", name: "Research Legacy", justification: WHY, departmentId: retiredId }, deps);
      assert.equal(r.status, "partial", JSON.stringify(r));
      if (r.status !== "partial") throw new Error("unreachable");
      assert.equal(r.failedStep, "placement");
      assert.deepEqual(r.completed, ["identity", "mandate"]);
      const after = await world();
      assert.equal(after.agents - before.agents, 1, "T5: the identity stays");
      assert.equal(after.mandates - before.mandates, 1, "T5: the mandate stays");
      assert.equal(after.placements, before.placements, "T5: no placement");
    }

    /* ── T6 · an unknown template ── */
    {
      const before = await world();
      assert.deepEqual(await createAgentFromTemplate(acme, { templateId: "sales", name: "Sales Agent", justification: WHY }, deps), { status: "refused", reason: "template-unknown" });
      assert.deepEqual(await world(), before, "T6: nothing written");
    }

    /* ── T7 · only the released writers ── */
    {
      const code = readFileSync("src/features/agent-templates/create-agent-from-template.server.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      const imports = [...code.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort();
      assert.deepEqual(imports, [
        "./templates",
        "@/features/agent-identity/create-durable-agent-identity.server",
        "@/features/agent-mandate/establish-agent-mandate.server",
        "@/features/auth/tenant/tenant-context",
        "@/features/organization-authority/write-agent-placement.server",
      ], "T7: three released writers, the template constants and the tenant type — no database, no other writer");
      assert.doesNotMatch(code, /drizzle|getControlPlaneDb|\.insert\(|\.update\(|sql`/, "T7: no direct database access");
    }

    assert.equal(networkCalls, 0, "no network");
    finished = true;
    console.log("p5-3-agent-templates/templates-postgres: OK");
  } finally {
    await setup.end().catch(() => {});
    await (handle as { dispose?: () => Promise<void> }).dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

void main();
