/*
 * PROJECTION-POSTGRES-PROOF-1 — the operational planning projection over the REAL released Work
 * readers, a REAL disposable PostgreSQL database and two organizations.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "Each organization's projection is built only from its own work and its own declarations; the
 *    database itself refuses a declaration that links across organizations; a context that names no
 *    member organization sees nothing; reading writes nothing anywhere; and when the evidence read
 *    reaches its 200-row bound — a state in which the released reader really does omit a current
 *    declaration — or the register reaches its bound, the projection is unavailable rather than false."
 *
 * Needs a PostgreSQL 17+ admin URL: the migration ledger uses the builtin `pg_c_utf8` collation
 * (AP-1). Point HEBUN_TEST_ADMIN_DATABASE_URL at one; the harness default (55432) may be older.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { recordDepartment } from "../../src/features/organization-authority/write-structure.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import { declareWorkEvidenceReference, recordWork, withdrawWorkEvidenceReference } from "../../src/features/organizational-work/write-work.server";
import { readWorkRegister } from "../../src/features/organizational-work/read-work.server";
import { MAX_WORK_EVIDENCE_REFERENCES, readWorkEvidenceReferences } from "../../src/features/organizational-work/read-work-evidence.server";
import { MAX_WORK_ITEMS_READ } from "../../src/features/organizational-work/work-contracts";
import { readOperationalPlanningProjection, type OperationalPlanningProjection } from "../../src/features/heby-commands/operational-planning-projection.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const GENESIS = "This organization establishes its founding Governance authority for the projection proof.";
const T0 = new Date("2026-10-01T09:00:00.000Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
const NOW = new Date("2026-10-13T12:00:00.000Z");
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

type Seeded = Awaited<ReturnType<typeof seedLocalIdentity>>;

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_projection_proof");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;
  const writeAt = (when: Date) => ({ getDb: () => handle.db, now: () => when }) as never;

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
    const department = async (name: string) => {
      const d = await recordDepartment(ctx, { name, slug: name.toLowerCase() }, deps);
      assert.equal(d.status, "recorded");
      return d.status === "recorded" ? d.department.departmentId : "";
    };
    const fact = async (key: string) => {
      const f = await createKnowledgeFact(ctx, { factKey: key, domainKey: "operations", scope: "company-wide", title: `Fact ${key}`, statement: `Statement ${key}.` }, deps);
      assert.equal(f.status, "created");
      return f.status === "created" ? f.identity.factId : "";
    };
    const work = async (title: string, departmentId: string, extra: Record<string, unknown> = {}, when = T0) => {
      const w = await recordWork(ctx, { title, departmentId, ...extra }, writeAt(when));
      assert.equal(w.status, "recorded", JSON.stringify(w));
      return w.status === "recorded" ? w.workItem.workItemId : "";
    };
    const declare = async (workItemId: string, factId: string, when: Date) => {
      const r = await declareWorkEvidenceReference(ctx, { workItemId, referent: { kind: "knowledge-fact", referentId: factId } }, writeAt(when));
      assert.equal(r.status, "recorded", JSON.stringify(r));
    };
    return { org, ctx, department, fact, work, declare };
  };

  const project = (ctx: TenantContext | null, scope: string) =>
    readOperationalPlanningProjection(ctx, scope, {
      readWork: (t) => readWorkRegister(t, deps),
      readEvidence: (t) => readWorkEvidenceReferences(t, deps),
      now: () => NOW,
    });
  const projected = (r: OperationalPlanningProjection) => {
    assert.equal(r.status, "projected", JSON.stringify(r));
    return r as Extract<OperationalPlanningProjection, { status: "projected" }>;
  };

  /* A catalogue-derived census of every table's rows, so "writes nothing" is not a hand-written list. */
  const census = async () => {
    const tables = (await setup.query<{ t: string }>(`select tablename as t from pg_tables where schemaname = 'public' order by 1`)).rows.map((r) => r.t);
    const out: Record<string, number> = {};
    for (const t of tables) out[t] = (await setup.query<{ n: number }>(`select count(*)::int as n from "${t}"`)).rows[0]!.n;
    return out;
  };

  try {
    const acme = await organization("proj-acme", "a");
    const globex = await organization("proj-globex", "b");
    const acmeEng = await acme.department("Engineering");
    const acmeMkt = await acme.department("Marketing");
    const globexEng = await globex.department("Engineering");
    const acmeFact = await acme.fact("acme-policy");
    const globexFact = await globex.fact("globex-policy");

    /* Acme: three Engineering items, recorded in order a1, a2, a3. */
    const a1 = await acme.work("Acme blocked pipeline", acmeEng, { declaredState: "blocked" }, at(1));
    const a2 = await acme.work("Acme active migration", acmeEng, { declaredState: "active", accountableUserId: acme.org.userId }, at(2));
    const a3 = await acme.work("Acme planned audit", acmeEng, { declaredState: "planned" }, at(3));
    /* Globex: two Engineering items, both with a declaration. */
    const g1 = await globex.work("Globex secret project", globexEng, { declaredState: "blocked" }, at(1));
    const g2 = await globex.work("Globex confidential merger", globexEng, { declaredState: "active" }, at(2));
    await globex.declare(g1, globexFact, at(10));
    await globex.declare(g2, globexFact, at(11));
    /* Acme declares evidence on a2 only. */
    await acme.declare(a2, acmeFact, at(12));

    /* ── 1 · REGISTER READS ARE TENANT-SCOPED (real rows, real predicate). ─────────────────────── */
    const ownIds = async (tenantId: string) =>
      new Set((await setup.query<{ id: string }>(`select id from work_items where tenant_id = $1`, [tenantId])).rows.map((r) => r.id));
    const acmeRegister = await readWorkRegister(acme.ctx, deps);
    assert.equal(acmeRegister.status, "available");
    const acmeOwn = await ownIds(acme.org.tenantId);
    assert.ok(acmeRegister.status === "available" && acmeRegister.items.every((i) => acmeOwn.has(i.workItemId)), "every register row is acme's");
    assert.ok(acmeRegister.status === "available" && !acmeRegister.items.some((i) => i.workItemId === g1 || i.workItemId === g2), "no globex row");

    /* ── 2 · EVIDENCE READS ARE TENANT-SCOPED. ─────────────────────────────────────────────────── */
    const acmeEvidence = await readWorkEvidenceReferences(acme.ctx, deps);
    assert.ok(acmeEvidence.status === "available");
    assert.deepEqual(acmeEvidence.status === "available" ? acmeEvidence.references.map((r) => r.workItemId) : [], [a2], "acme sees its one declaration, not globex's two");
    const globexEvidence = await readWorkEvidenceReferences(globex.ctx, deps);
    assert.deepEqual(globexEvidence.status === "available" ? globexEvidence.references.map((r) => r.workItemId).sort() : [], [g1, g2].sort());

    /* ── 3 · CROSS-TENANT EVIDENCE CANNOT INFLUENCE ANOTHER PROJECTION. ────────────────────────── */
    const before = await census();
    const acmeProjection = projected(await project(acme.ctx, "Engineering"));
    const globexProjection = projected(await project(globex.ctx, "Engineering"));
    assert.deepEqual([...acmeProjection.aliases.values()], [a3, a2, a1], "acme's aliases map to acme's rows, newest recorded first");
    assert.deepEqual(acmeProjection.projection.items.map((i) => [i.state, i.accountable, i.evidenceDeclared]), [
      ["planned", false, false],
      ["active", true, true],
      ["blocked", false, false],
    ]);
    assert.deepEqual([...globexProjection.aliases.values()], [g2, g1]);
    assert.deepEqual(globexProjection.projection.items.map((i) => i.evidenceDeclared), [true, true], "globex's own declarations count for globex only");
    for (const [label, r] of [["acme", acmeProjection], ["globex", globexProjection]] as const) {
      const wire = JSON.stringify(r.projection);
      assert.doesNotMatch(wire, UUID, `${label}: no id in the projection`);
      for (const leak of ["Acme", "Globex", "secret", "Engineering"]) assert.ok(!wire.includes(leak), `${label}: no ${leak}`);
    }
    /* The database itself refuses a declaration that links across organizations. */
    for (const [tenantId, workItemId, factId, declarer, why] of [
      [globex.org.tenantId, a1, globexFact, globex.org.userId, "globex rows cannot name acme's work"],
      [acme.org.tenantId, a1, globexFact, acme.org.userId, "acme's work cannot cite globex's fact"],
    ] as const) {
      await assert.rejects(
        setup.query(
          `insert into work_evidence_references (tenant_id, work_item_id, knowledge_fact_id, declared_by, declared_by_type) values ($1,$2,$3,$4,'human')`,
          [tenantId, workItemId, factId, declarer],
        ),
        (e: { code?: string }) => e.code === "23503",
        why,
      );
    }

    /* ── 4 · TENANT CONTEXT: none reads nothing; a context naming no member organization sees nothing. ─ */
    assert.deepEqual(await project(null, "Engineering"), { status: "unavailable", reason: "no-tenant" });
    const stranger = asHumanTenantContext({
      tenantId: randomUUID(), userId: acme.org.userId, authIdentityId: acme.org.authIdentityId, membershipId: acme.org.membershipId,
      membershipVersion: 1, roleId: acme.org.roleId, sessionContextId: acme.ctx.sessionContextId, provider: "local", assuranceLevel: "aal1",
      mfaVerified: false, requestId: "stranger", authenticatedAt: new Date().toISOString(),
    });
    assert.deepEqual(await project(stranger, ""), { status: "unavailable", reason: "nothing-in-scope" }, "an unknown tenant id reads no organization's rows");
    assert.deepEqual(await census(), before, "projection reads wrote nothing, in any table");

    /* ── 5 · THE 200-ROW EVIDENCE BOUND: a REAL false negative, refused. ───────────────────────── */
    const facts = [acmeFact, ...(await Promise.all(["p2", "p3", "p4", "p5"].map((k) => acme.fact(`acme-${k}`))))];
    const marketing: string[] = [];
    for (let i = 0; i < 40; i += 1) marketing.push(await acme.work(`Acme campaign ${i}`, acmeMkt, {}, at(20)));
    await acme.declare(a1, acmeFact, at(13)); /* older than everything below */
    let minute = 100;
    for (const workItemId of marketing) for (const factId of facts) await acme.declare(workItemId, factId, at(minute++));
    const total = (await setup.query<{ n: number }>(`select count(*)::int as n from work_evidence_references where tenant_id = $1 and withdrawn_at is null`, [acme.org.tenantId])).rows[0]!.n;
    assert.equal(total, 202, "a1, a2 and 200 newer declarations are current in the database");
    const bounded = await readWorkEvidenceReferences(acme.ctx, deps);
    assert.ok(bounded.status === "available");
    const seen = new Set(bounded.status === "available" ? bounded.references.map((r) => r.workItemId) : []);
    assert.equal(bounded.status === "available" ? bounded.references.length : 0, MAX_WORK_EVIDENCE_REFERENCES);
    assert.ok(!seen.has(a1) && !seen.has(a2), "the released reader really omits a1's and a2's current declarations at its bound");
    assert.deepEqual(await project(acme.ctx, "Engineering"), { status: "unavailable", reason: "evidence-incomplete" }, "unavailable, never a false 'no evidence'");

    /* Below the bound the same items read true again. */
    const newest = bounded.status === "available" ? bounded.references.slice(0, 3) : [];
    for (const reference of newest) {
      assert.equal((await withdrawWorkEvidenceReference(acme.ctx, { referenceId: reference.referenceId }, writeAt(at(minute++)))).status, "recorded");
    }
    const complete = projected(await project(acme.ctx, "Engineering"));
    assert.deepEqual(complete.projection.items.map((i) => i.evidenceDeclared), [false, true, true], "199 current: a2 and a1 are declared, a3 is not");

    /* ── 6 · THE REGISTER BOUND: completeness cannot be established ⇒ unavailable. ─────────────── */
    const count = async () => (await setup.query<{ n: number }>(`select count(*)::int as n from work_items where tenant_id = $1`, [acme.org.tenantId])).rows[0]!.n;
    for (let n = await count(); n <= MAX_WORK_ITEMS_READ; n += 1) await acme.work(`Acme backlog ${n}`, acmeMkt, {}, at(minute++));
    assert.equal(await count(), MAX_WORK_ITEMS_READ + 1);
    assert.deepEqual(await project(acme.ctx, "Engineering"), { status: "unavailable", reason: "register-truncated" });
    /* Globex is untouched by all of acme's volume. */
    assert.deepEqual(projected(await project(globex.ctx, "Engineering")).projection, globexProjection.projection);

    console.log("PASS heby-operational-planning-projection projection-postgres");
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
