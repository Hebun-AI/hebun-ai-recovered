/*
 * V1-STAGE-6 — Plan & Usage against a disposable PostgreSQL with the canonical migrations.
 * Acme (plan "growth") and Globex (plan "free"), synthetic identities only.
 *
 * Proves: the plan is the session tenant's own `companies.plan`; today's admitted model dispatches are
 * counted exactly as the AP-3 cap counts them (yesterday's row and another tenant's rows excluded);
 * recorded token usage is the tenant's own live rows only; a context mixing tenants reads nothing;
 * the read writes nothing.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { readPlanAndUsage } from "../../src/features/plan-usage/plan-usage.server";
import { EXTERNAL_AI_DISCLOSURE_AUTHORIZED } from "../../src/features/governance-audit/external-ai-disclosure-audit.server";

interface Seeded { readonly tenantId: string; readonly userId: string; readonly authIdentityId: string; readonly membershipId: string; readonly roleId: string }

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("v1-plan-usage/plan-usage-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_v1_plan_usage");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;
  try {
    const ctxFor = (s: Seeded): TenantContext =>
      asHumanTenantContext({
        tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId,
        membershipVersion: 1, roleId: s.roleId, sessionContextId: "00000000-0000-4000-8000-000000000006", provider: "local",
        assuranceLevel: "aal1", mfaVerified: false, requestId: "v1-plan-usage", authenticatedAt: new Date().toISOString(),
      });
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme Rugs", companySlug: "acme-v1u", email: "d@acme.test" })) as Seeded;
    const globex = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-v1u", email: "d@globex.test" })) as Seeded;
    await setup.query(`update companies set plan = 'growth' where id = $1`, [acme.tenantId]);

    const disclosure = (s: Seeded, at: string) =>
      setup.query(
        `insert into audit_log (tenant_id, actor_type, actor_id, action, entity_type, entity_id, occurred_at, result, source)
         values ($1, 'human', $2, $3, 'external-ai-disclosure-decision', gen_random_uuid(), ${at}, 'committed', 'external-ai-data-use')`,
        [s.tenantId, s.userId, EXTERNAL_AI_DISCLOSURE_AUTHORIZED],
      );
    for (let i = 0; i < 3; i += 1) await disclosure(acme, "now()");
    await disclosure(acme, "date_trunc('day', now() at time zone 'utc') at time zone 'utc' - interval '1 second'");
    for (let i = 0; i < 7; i += 1) await disclosure(globex, "now()");

    const conversation = async (s: Seeded) =>
      (await setup.query<{ id: string }>(`insert into conversations (tenant_id, subject) values ($1, 'usage fixture') returning id`, [s.tenantId])).rows[0]!.id;
    const message = (s: Seeded, conv: string, transport: string, input: number | null, output: number | null) =>
      setup.query(
        `insert into messages (tenant_id, conversation_id, role, content, origin, transport, provider, model, input_tokens, output_tokens)
         values ($1, $2, 'assistant', 'fixture', 'model', $3, 'anthropic', 'claude-fixture', $4, $5)`,
        [s.tenantId, conv, transport, input, output],
      );
    const acmeConv = await conversation(acme);
    await message(acme, acmeConv, "live", 100, 20);
    await message(acme, acmeConv, "live", null, 5);
    await message(acme, acmeConv, "fake", 0, 0);
    const globexConv = await conversation(globex);
    await message(globex, globexConv, "live", 9000, 9000);

    const writeCounts = async () =>
      (await setup.query<{ n: string }>(
        `select (select count(*) from audit_log) + (select count(*) from messages) + (select count(*) from companies) as n`,
      )).rows[0]!.n;
    const before = await writeCounts();

    /* U1 — the session tenant's own plan, today's measured admissions, its own recorded tokens. */
    const env = { HEBUN_AI_DISPATCH_CAP_MODEL_PER_TENANT_DAY: "40" };
    const a = await readPlanAndUsage(ctxFor(acme), { getDb, env });
    assert.equal(a.status, "read");
    if (a.status !== "read") throw new Error("unreachable");
    assert.deepEqual(a.organization, { name: "Acme Rugs", plan: "growth" });
    assert.equal(a.dispatch.status, "read");
    if (a.dispatch.status !== "read") throw new Error("unreachable");
    assert.deepEqual(
      a.dispatch.classes.map((c) => [c.dispatchClass, c.admittedInWindow, c.capPerTenantUtcDay]),
      [["model", 3, 40], ["media", 0, 5]],
      "U1: today only, this tenant only, the cap as resolved",
    );
    assert.equal(a.dispatch.windowEnd.getTime() - a.dispatch.windowStart.getTime(), 86_400_000);
    assert.equal(a.recorded.status, "read");
    if (a.recorded.status !== "read") throw new Error("unreachable");
    assert.deepEqual(
      [a.recorded.usage.totals.recordedCalls, a.recorded.usage.totals.unknownTokenRows, a.recorded.usage.totals.totalTokens],
      [2, 1, 120],
      "U1: live rows only, the half-reported row counted apart, never summed",
    );
    console.log("ok U1 own plan, today's measured admissions, own recorded tokens");

    /* U2 — the other tenant sees its own figures, never Acme's. */
    const g = await readPlanAndUsage(ctxFor(globex), { getDb });
    assert.ok(g.status === "read" && g.organization.plan === "free" && g.dispatch.status === "read" && g.recorded.status === "read");
    if (g.status !== "read" || g.dispatch.status !== "read" || g.recorded.status !== "read") throw new Error("unreachable");
    assert.equal(g.dispatch.classes[0]!.admittedInWindow, 7);
    assert.equal(g.recorded.usage.totals.totalTokens, 18000);
    console.log("ok U2 tenant isolation");

    /* U3 — a forged context mixing one tenant's membership with another tenant reads nothing. */
    assert.deepEqual(await readPlanAndUsage(ctxFor({ ...acme, tenantId: globex.tenantId }), { getDb }), { status: "unavailable" });
    assert.deepEqual(await readPlanAndUsage(null, { getDb }), { status: "unauthenticated" });
    assert.deepEqual(await readPlanAndUsage(ctxFor(acme), { getDb: () => null }), { status: "unavailable" });
    console.log("ok U3 forged or absent context reads nothing");

    assert.equal(await writeCounts(), before, "U4: the read writes nothing");
    console.log("ok U4 read only");
    finished = true;
    console.log("PASS v1 plan usage postgres");
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
