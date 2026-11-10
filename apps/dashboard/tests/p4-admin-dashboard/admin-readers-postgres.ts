/*
 * P4 Platform Admin dashboard — the five admin readers, proven against a disposable PostgreSQL database.
 *
 * Real sessions (released sign-in), a real operator grant and MFA (the P4 ceremony core and challenge),
 * real tenant rows with real tenant content. Each numbered block is one acceptance item of the task.
 */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb, type ControlPlaneDatabase } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { issueLocalSession, resolveSessionFromReference } from "../../src/features/auth-runtime/session-service.server";
import type {
  AuthenticationDigestKey,
  ConfiguredAuthenticationEnvironment,
} from "../../src/features/auth/environment/auth-environment.server";
import type { AuthenticationResult } from "../../src/features/auth/types/authentication-result";
import { elevateSessionWithMfa } from "../../src/features/operator-authority/admin-access.server";
import { resolveMfaEncryptionKeys } from "../../src/features/operator-mfa/mfa-verification.server";
import { base32Decode, hotp, totpStep } from "../../src/features/operator-mfa/totp";
import {
  ORGANIZATIONS_PAGE_SIZE,
  listPlatformOrganizations,
  parsePage,
  readPlatformAiUsage,
  readPlatformOrganizationMetrics,
  readPlatformOverview,
  readPlatformServiceStatus,
  type AdminRead,
  type AdminReadContext,
} from "../../src/features/admin-views/platform-readers.server";
import {
  beginMfaEnrollment,
  completeMfaEnrollment,
  findIdentityByEmail,
  grantOperator,
  revokeOperator,
  verifyCeremonyActor,
  type OperatorIdentity,
} from "../../scripts/lib/operator-authority";

const T0 = new Date("2026-11-10T10:00:00.000Z");
const at = (minutes: number, seconds = 0) => new Date(T0.getTime() + minutes * 60_000 + seconds * 1000);
const KEY: AuthenticationDigestKey = Object.freeze({ version: 1, secret: "p4-admin-dashboard-digest" });
const PASSWORD = "a-correct-horse-battery-7Qx";
const KEYS = resolveMfaEncryptionKeys({
  HEBUN_MFA_ENCRYPTION_KEYS: `mfa1:${randomBytes(32).toString("base64")}`,
  HEBUN_MFA_ENCRYPTION_ACTIVE_KEY_ID: "mfa1",
});
/* Tenant content that no admin reader may ever return or audit. */
const GLOBEX_SECRET = "GLOBEX-PRIVATE-CONVERSATION-TEXT";
const ACME_SECRET = "ACME-PRIVATE-CONVERSATION-TEXT";

const codeAt = (secret: string, when: Date) => hotp(base32Decode(secret)!, totpStep(when));

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_p4_admin_dashboard");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const db = handle.db;
  const env = {
    status: "configured",
    enabled: true,
    provider: "local",
    controlPlaneDatabaseUrl: harness.dbUrl,
    sessionDigestCurrentKey: KEY,
  } as ConfiguredAuthenticationEnvironment;
  let passed = 0;
  const ok = (label: string) => {
    passed++;
    console.log(`PASS ${label}`);
  };

  try {
    harness.migrateDatabase();
    await setup.connect();
    const acme = await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme", email: "op@acme.test", password: PASSWORD });
    const globex = await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex", email: "dir@globex.test", password: PASSWORD, roleType: "director" });
    const initech = await seedLocalIdentity(setup, { companyName: "Initech", companySlug: "initech", email: "member@initech.test", password: PASSWORD, roleType: "member" });
    await setup.query(`update companies set tenant_status = 'active' where id = any($1)`, [[acme.tenantId, globex.tenantId]]);

    /* Tenant content: conversations and messages with text, live usage with tokens, agents. */
    const conversation = async (tenantId: string) =>
      (await setup.query<{ id: string }>(`insert into conversations (tenant_id, subject) values ($1, $2) returning id`, [tenantId, `${tenantId}-subject`])).rows[0]!.id;
    const message = (tenantId: string, conv: string, content: string, created: string, provider: string | null, tokens: [number, number] | null) =>
      setup.query(
        `insert into messages (tenant_id, conversation_id, role, content, provider, model, transport, input_tokens, output_tokens, created_at)
         values ($1, $2, 'assistant', $3, $4, 'm-1', $5, $6, $7, $8)`,
        [tenantId, conv, content, provider, provider ? "live" : "fake", tokens?.[0] ?? null, tokens?.[1] ?? null, created],
      );
    const gConv = await conversation(globex.tenantId);
    await message(globex.tenantId, gConv, GLOBEX_SECRET, "2026-11-01T09:00:00Z", "anthropic", [100, 50]);
    await message(globex.tenantId, gConv, GLOBEX_SECRET, "2026-11-02T09:00:00Z", "anthropic", [10, 5]);
    await message(globex.tenantId, gConv, GLOBEX_SECRET, "2026-11-03T09:00:00Z", "openai", null); // no token counts
    await message(globex.tenantId, gConv, GLOBEX_SECRET, "2026-11-04T09:00:00Z", null, null); // fake transport: not usage
    const aConv = await conversation(acme.tenantId);
    await message(acme.tenantId, aConv, ACME_SECRET, "2026-10-20T09:00:00Z", "openai", [7, 3]);
    await setup.query(`insert into agents (tenant_id, name) values ($1, 'g-1'), ($1, 'g-2'), ($1, 'g-retired')`, [globex.tenantId]);
    await setup.query(`update agents set retired_at = now() where name = 'g-retired'`);
    await setup.query(`insert into agents (tenant_id, name) values ($1, 'a-1')`, [acme.tenantId]);

    const op = (await findIdentityByEmail(db, "op@acme.test"))!;
    const signIn = async (email: string, when: Date): Promise<string> => {
      const issued = await issueLocalSession(db, env, { email, password: PASSWORD, requestId: randomUUID() }, when);
      assert.equal(issued.result.status, "authorized", `${email} signs in`);
      return issued.reference;
    };
    const ctxFor = async (reference: string, when: Date, over: Partial<AdminReadContext> = {}): Promise<AdminReadContext> => ({
      db,
      authentication: await resolveSessionFromReference(db, env, reference, { requestId: "r" }, when),
      now: when,
      requestId: randomUUID(),
      ...over,
    });
    const allReaders = (ctx: AdminReadContext) =>
      Promise.all([
        readPlatformOverview(ctx),
        listPlatformOrganizations(ctx, 1),
        readPlatformOrganizationMetrics(ctx, globex.tenantId),
        readPlatformAiUsage(ctx),
        readPlatformServiceStatus(ctx),
      ] as const);
    const auditCount = async () =>
      Number((await setup.query(`select count(*) from audit_log where action like 'platform.admin.view.%'`)).rows[0].count);
    const expectEveryReader = async (ctx: AdminReadContext, status: string, label: string) => {
      const before = await auditCount();
      for (const read of (await allReaders(ctx)) as readonly AdminRead<unknown>[]) {
        assert.equal(read.status, "denied", label);
        assert.equal(read.status === "denied" && read.access.status, status, label);
        assert.ok(!("data" in read), `${label}: no data`);
      }
      assert.equal(await auditCount(), before, `${label}: a refused read writes no view row`);
    };

    /* ── 1 · No grant → refused; 5 · Director is not admin; 6 · Customer is not admin ──────── */
    await expectEveryReader(await ctxFor(await signIn("dir@globex.test", at(0)), at(0)), "forbidden", "Director");
    await expectEveryReader(await ctxFor(await signIn("member@initech.test", at(0)), at(0)), "forbidden", "Customer member");
    await expectEveryReader(await ctxFor(await signIn("op@acme.test", at(0)), at(0)), "forbidden", "no grant yet");
    ok("1, 5, 6 · no grant / Director / customer are refused by every reader");
    await setup.query(`update companies set tenant_status = 'suspended' where id = $1`, [initech.tenantId]);

    /* Operator: MFA enrollment + bootstrap grant through the released ceremony core. */
    const boot = await verifyCeremonyActor(db, { email: "op@acme.test", password: PASSWORD }, KEYS, at(1));
    assert.equal(boot.status, "verified");
    const act = (actor: OperatorIdentity, bootstrap: boolean, when: Date) => ({ actor, bootstrap, target: actor, reason: "P4 dashboard test", now: when });
    const started = await beginMfaEnrollment(db, { target: op, actor: op, now: at(2) }, KEYS);
    assert.equal(started.status, "started");
    if (started.status !== "started") throw new Error("unreachable");
    const secret = started.secret;
    assert.equal((await completeMfaEnrollment(db, { ...act(op, true, at(2, 5)), credentialId: started.credentialId, code: codeAt(secret, at(2, 5)) }, KEYS)).status, "done");
    assert.equal((await grantOperator(db, act(op, true, at(3))).then((r) => r.status)), "done");

    /* ── 2 · Grant without MFA on the session → refused ─────────────────────────────────────── */
    const plainRef = await signIn("op@acme.test", at(4));
    await expectEveryReader(await ctxFor(plainRef, at(4)), "mfa-required", "grant without MFA");
    ok("2 · an operator without session MFA is refused by every reader");

    const elevated = await elevateSessionWithMfa(db, env, plainRef, codeAt(secret, at(5)), { requestId: "e" }, KEYS, at(5));
    assert.equal(elevated.status, "elevated");
    if (elevated.status !== "elevated") throw new Error("unreachable");
    const adminRef = elevated.reference;

    /* ── 7 · A forged client claim (an "authorized" result naming the operator) opens nothing ── */
    const forged = {
      status: "authorized",
      applicationSession: { sessionContextId: randomUUID(), authIdentityId: op.authIdentityId, userId: op.userId, assuranceLevel: "aal2", mfaVerified: true },
    } as unknown as AuthenticationResult;
    await expectEveryReader({ db, authentication: forged, now: at(6), requestId: "f" }, "mfa-required", "forged claim");
    ok("7 · a forged grant/MFA claim is ineffective — the session row decides");

    /* ── Granted: the readers answer, each with one audit row ──────────────────────────────── */
    const auditBefore = await auditCount();
    const ctx = await ctxFor(adminRef, at(6));
    const [overview, orgs, gMetrics, usage, status] = await allReaders(ctx);
    for (const r of [overview, orgs, gMetrics, usage, status]) assert.equal(r.status, "read");
    assert.equal(await auditCount(), auditBefore + 5);

    /* ── 16 · Real metrics ─────────────────────────────────────────────────────────────────── */
    if (overview.status !== "read") throw new Error("unreachable");
    assert.deepEqual(Object.keys(overview.data).sort(), ["activeOrganizations", "aiUsage", "totalOrganizations"]);
    assert.equal(overview.data.totalOrganizations, 3);
    assert.equal(overview.data.activeOrganizations, 2);
    assert.equal(overview.data.aiUsage.recordedCalls, 4, "fake-transport rows are not usage");
    assert.equal(overview.data.aiUsage.measuredCalls, 3);
    assert.equal(overview.data.aiUsage.inputTokens, 117);
    assert.equal(overview.data.aiUsage.outputTokens, 58);
    assert.equal(overview.data.aiUsage.firstRecordedAt, "2026-10-20T09:00:00.000Z");
    assert.equal(overview.data.aiUsage.lastRecordedAt, "2026-11-03T09:00:00.000Z");

    if (gMetrics.status !== "read" || !gMetrics.data) throw new Error("unreachable");
    assert.equal(gMetrics.data.organization.name, "Globex");
    assert.equal(gMetrics.data.organization.memberCount, 1);
    assert.equal(gMetrics.data.organization.agentCount, 2, "retired agent not counted");
    assert.equal(gMetrics.data.aiUsage.recordedCalls, 3);
    assert.equal(gMetrics.data.aiUsage.inputTokens, 110, "10: Acme's usage does not leak into Globex");
    assert.equal(gMetrics.data.aiUsage.lastRecordedAt, "2026-11-03T09:00:00.000Z");

    if (usage.status !== "read") throw new Error("unreachable");
    assert.deepEqual(usage.data.byProvider.map((g) => [g.key, g.recordedCalls]), [["anthropic", 2], ["openai", 2]]);
    assert.deepEqual(usage.data.byOrganization.map((g) => [g.label, g.recordedCalls, g.inputTokens]), [["Globex", 3, 110], ["Acme", 1, 7]]);

    if (status.status !== "read") throw new Error("unreachable");
    assert.equal(status.data.database.state, "responding");
    assert.equal(status.data.aiProviders.state, "not-monitored", "no provider health check → not monitored, never healthy");
    assert.equal(status.data.backgroundJobs.state, "not-monitored");
    ok("16 · real counts, usage and status; unmeasured calls are not counted as zero tokens");

    /* ── 8 · Only the listed fields   9 · No tenant content anywhere in any reader's output ──── */
    if (orgs.status !== "read") throw new Error("unreachable");
    for (const row of orgs.data.rows)
      assert.deepEqual(Object.keys(row).sort(), ["agentCount", "createdAt", "id", "memberCount", "name", "slug", "status"]);
    assert.deepEqual(Object.keys(gMetrics.data.organization).sort(), ["agentCount", "createdAt", "id", "memberCount", "name", "slug", "status", "statusChangedAt"]);
    const everything = JSON.stringify([overview, orgs, gMetrics, usage, status]);
    for (const forbidden of [GLOBEX_SECRET, ACME_SECRET, "-subject", "password", "seal_", secret])
      assert.ok(!everything.includes(forbidden), `9: reader output carries no ${forbidden}`);
    ok("8, 9 · readers return only their listed fields and no tenant content");

    /* ── 10 · Acme's own view carries none of Globex's data ─────────────────────────────────── */
    const aMetrics = await readPlatformOrganizationMetrics(await ctxFor(adminRef, at(6)), acme.tenantId);
    if (aMetrics.status !== "read" || !aMetrics.data) throw new Error("unreachable");
    assert.equal(aMetrics.data.aiUsage.recordedCalls, 1);
    assert.equal(aMetrics.data.organization.agentCount, 1);
    assert.ok(!JSON.stringify(aMetrics).includes(globex.tenantId));
    ok("10 · no cross-organization leakage between organization views");

    /* ── 11 · A client-supplied organization id grants nothing ──────────────────────────────── */
    const dirRef = await signIn("dir@globex.test", at(6));
    const dirOwn = await readPlatformOrganizationMetrics(await ctxFor(dirRef, at(6)), globex.tenantId);
    assert.equal(dirOwn.status === "denied" && dirOwn.access.status, "forbidden", "a Director naming their own tenant is still not admin");
    for (const bogus of ["not-a-uuid", "' or 1=1 --", randomUUID()]) {
      const r = await readPlatformOrganizationMetrics(await ctxFor(adminRef, at(6)), bogus);
      assert.equal(r.status, "read");
      assert.equal(r.status === "read" && r.data, null, `unknown id ${bogus} → no organization`);
    }
    ok("11 · an organization id from the client selects, never authorizes; unknown ids return nothing");

    /* ── 12 · Pagination ──────────────────────────────────────────────────────────────────── */
    await setup.query(
      `insert into companies (name, slug, created_at) select 'Bulk ' || g, 'bulk-' || g, now() - (g || ' minutes')::interval from generate_series(1, 27) g`,
    );
    const p1 = await listPlatformOrganizations(await ctxFor(adminRef, at(7)), 1);
    const p2 = await listPlatformOrganizations(await ctxFor(adminRef, at(7)), 2);
    const p99 = await listPlatformOrganizations(await ctxFor(adminRef, at(7)), 99);
    if (p1.status !== "read" || p2.status !== "read" || p99.status !== "read") throw new Error("unreachable");
    assert.equal(p1.data.total, 30);
    assert.equal(p1.data.rows.length, ORGANIZATIONS_PAGE_SIZE);
    assert.equal(p2.data.rows.length, 5);
    assert.equal(new Set([...p1.data.rows, ...p2.data.rows].map((r) => r.id)).size, 30, "pages do not overlap");
    assert.equal(p99.data.rows.length, 0);
    assert.deepEqual(["abc", "-1", "0", "1e3", "999999", "2"].map(parsePage), [1, 1, 1, 1, 1, 2]);
    assert.equal(parsePage(["2"]), 1);
    assert.equal(parsePage(undefined), 1);
    ok("12 · server-side pagination: bounded pages, no overlap, unusable page values → page 1");

    /* ── 14 · Audit write fails → no data ─────────────────────────────────────────────────── */
    const failingDb = new Proxy(db, {
      get(target, prop) {
        if (prop === "insert") return () => { throw new Error("audit sink unavailable"); };
        const value = Reflect.get(target, prop, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as ControlPlaneDatabase;
    for (const r of (await allReaders(await ctxFor(adminRef, at(8), { db: failingDb }))) as readonly AdminRead<unknown>[]) {
      assert.equal(r.status, "audit-failed");
      assert.ok(!("data" in r), "14: no data when the audit row cannot be written");
    }
    ok("14 · a failed audit write returns no data from any reader");

    /* ── 17 · An unreadable source is "unavailable" (audited as rejected), never zero ───────── */
    const brokenRead = new Proxy(db, {
      get(target, prop) {
        if (prop === "execute") return () => Promise.reject(new Error("read failed"));
        const value = Reflect.get(target, prop, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as ControlPlaneDatabase;
    const broken = await readPlatformOverview(await ctxFor(adminRef, at(8), { db: brokenRead }));
    assert.deepEqual(broken, { status: "unavailable" }, "17: no zero stands in for an unreadable count");
    const rejected = (await setup.query(`select result from audit_log where action = 'platform.admin.view.overview' order by recorded_at desc limit 1`)).rows[0];
    assert.equal(rejected?.result, "rejected");
    ok("17 · an unreadable source returns unavailable, audited as rejected");

    /* ── 13 · Audit rows   15 · No secret or tenant content in them ────────────────────────── */
    const rows = (await setup.query(`select * from audit_log where action like 'platform.admin.view.%' order by recorded_at`)).rows;
    assert.ok(rows.length >= 5);
    for (const row of rows) {
      assert.equal(row.authority_source, "platform-admin");
      assert.equal(row.actor_id, op.userId);
      assert.equal(row.actor_type, "human");
      assert.ok(["committed", "rejected"].includes(String(row.result)));
      assert.ok(row.session_context_id && row.request_id && row.occurred_at);
    }
    const orgView = rows.find((r) => r.action === "platform.admin.view.organization" && r.entity_id === globex.tenantId);
    assert.equal(orgView?.tenant_id, globex.tenantId, "13: the viewed tenant is recorded");
    assert.equal(rows.find((r) => r.action === "platform.admin.view.organizations")?.tenant_id, null, "13: platform-wide list → tenant null");
    const unknown = rows.find((r) => r.action === "platform.admin.view.organization" && r.tenant_id === null);
    assert.ok(unknown, "an unknown organization id is audited without a tenant");
    const dump = JSON.stringify(rows);
    for (const forbidden of [GLOBEX_SECRET, ACME_SECRET, secret, PASSWORD, "otpauth"]) assert.ok(!dump.includes(forbidden), `15: no ${forbidden} in audit`);
    ok("13, 15 · one audit row per view, operator + operation + time + result + resource; no secret or content");

    /* ── 3 · Expired MFA (past 60 minutes) → refused ───────────────────────────────────────── */
    /* Keep the session itself alive (30-minute inactivity) so only the MFA window can expire. */
    for (const minute of [25, 50]) assert.equal((await readPlatformOverview(await ctxFor(adminRef, at(minute)))).status, "read", `still open at +${minute}m`);
    await expectEveryReader(await ctxFor(adminRef, at(5 + 61)), "mfa-required", "expired MFA");
    ok("3 · an MFA verification older than 60 minutes is refused");

    /* ── 4 · Revoked grant → refused on the very next read ─────────────────────────────────── */
    const refreshed = await elevateSessionWithMfa(db, env, adminRef, codeAt(secret, at(67)), { requestId: "e2" }, KEYS, at(67));
    const liveRef = refreshed.status === "elevated" ? refreshed.reference : adminRef;
    assert.equal((await readPlatformOverview(await ctxFor(liveRef, at(67, 30)))).status, "read");
    const actor = await verifyCeremonyActor(db, { email: "op@acme.test", password: PASSWORD, code: codeAt(secret, at(68)) }, KEYS, at(68));
    assert.equal(actor.status, "verified");
    assert.equal((await revokeOperator(db, act(op, false, at(68)))).status, "done");
    await expectEveryReader(await ctxFor(liveRef, at(68, 10)), "forbidden", "revoked grant");
    ok("4 · a revoked operator is refused on the next read");

    console.log(`\nP4 admin readers: ${passed} checks passed`);
  } finally {
    await setup.end().catch(() => undefined);
    await handle.dispose();
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
