/*
 * TENANT-ACTIVATION-1 — proved against a REAL PostgreSQL database.
 *
 *   - a self-service organization with no nomination reads as awaiting platform review, from its own
 *     session only; an operator-born or seeded organization never does
 *   - a nomination ends the wait; a revoked one frees the slot again, as the partial index does
 *   - `--pending`'s listing names exactly the nominatable self-service tenants and their eligible
 *     humans, and changes NOTHING — fingerprinted before and after, and the transaction is gone
 *   - Organization Readiness words the wait for that organization and only that one
 *
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { createSelfServiceAccount } from "../../src/features/self-service-signup/create-account.server";
import { TENANT_PROVISIONING_SOURCE_SELF_SERVICE } from "../../src/features/tenant-provisioning/contracts";
import {
  listPendingSelfServiceTenants,
  nominateGenesisHuman,
  resolveNominationTarget,
} from "../../scripts/lib/nominate-genesis-human";
import {
  readGenesisActivationOrigin,
  readGenesisNomination,
} from "../../src/features/governance-genesis/genesis-acceptance.server";
import { isAwaitingPlatformReview } from "../../src/features/governance-genesis/contracts";
import { readOrganizationReadiness } from "../../src/features/organization-readiness/read-organization-readiness.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const PASSWORD = "tenant-activation-password-9Kx";

function contextFor(tenantId: string, userId: string, authIdentityId: string): TenantContext {
  return asHumanTenantContext({
    tenantId,
    userId,
    authIdentityId,
    membershipId: "00000000-0000-4000-8000-000000000001",
    membershipVersion: 1,
    roleId: "00000000-0000-4000-8000-000000000002",
    sessionContextId: "00000000-0000-4000-8000-000000000003",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "tenant-activation-1",
    authenticatedAt: new Date().toISOString(),
  });
}

/** Every row of every table the feature could conceivably touch, as one comparable value. */
async function fingerprint(client: Client): Promise<string> {
  const parts: string[] = [];
  for (const table of ["companies", "users", "auth_identities", "memberships", "roles", "genesis_nominations", "decision_records", "governance_sessions", "audit_log"]) {
    const r = await client.query<{ n: string; h: string | null }>(
      `select count(*)::text as n, md5(coalesce(string_agg(t::text, '|' order by t::text), '')) as h from ${table} t`,
    );
    parts.push(`${table}:${r.rows[0]!.n}:${r.rows[0]!.h}`);
  }
  return parts.join(";");
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_tenant_activation_1");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db };
  try {
    harness.migrateDatabase();
    await setup.connect();

    /* ── Seed: two self-service organizations, one seeded, one operator-born ── */
    const signUp = async (email: string, organizationName: string) => {
      const outcome = await createSelfServiceAccount({ fullName: email, email, password: PASSWORD, organizationName }, handle.db);
      assert.equal(outcome.status, "created", JSON.stringify(outcome));
      return outcome.status === "created" ? outcome.account : (undefined as never);
    };
    const ada = await signUp("ada@acme.test", "Acme Rugs");
    const ben = await signUp("ben@globex.test", "Globex Weaving");
    const seeded = await seedLocalIdentity(setup, { companyName: "Seeded", companySlug: "seeded", email: "sam@seeded.test" });
    const operatorBorn = await seedLocalIdentity(setup, { companyName: "Operator Born", companySlug: "operator-born", email: "olga@operator.test" });
    await setup.query(`update companies set provisioning_source = 'production-operator-ceremony' where id = $1`, [operatorBorn.tenantId]);
    const suspendedAccount = await signUp("sue@paused.test", "Paused Looms");
    await setup.query(`update companies set tenant_status = 'suspended', suspended_at = now(), suspension_reason = 'test' where id = $1`, [suspendedAccount.tenantId]);

    const adaCtx = contextFor(ada.tenantId, ada.userId, ada.authIdentityId);
    const benCtx = contextFor(ben.tenantId, ben.userId, ben.authIdentityId);
    const seededCtx = contextFor(seeded.tenantId, seeded.userId, seeded.authIdentityId);
    const operatorCtx = contextFor(operatorBorn.tenantId, operatorBorn.userId, operatorBorn.authIdentityId);

    const awaiting = async (ctx: TenantContext) =>
      isAwaitingPlatformReview(await readGenesisActivationOrigin(ctx, deps), await readGenesisNomination(ctx, deps));

    /* ── T1: origin is each session's own tenant, and only self-service waits ─ */
    assert.deepEqual(await readGenesisActivationOrigin(adaCtx, deps), { status: "read", selfService: true });
    assert.deepEqual(await readGenesisActivationOrigin(seededCtx, deps), { status: "read", selfService: false });
    assert.deepEqual(await readGenesisActivationOrigin(operatorCtx, deps), { status: "read", selfService: false });
    assert.equal(await awaiting(adaCtx), true);
    assert.equal(await awaiting(benCtx), true);
    assert.equal(await awaiting(seededCtx), false, "a seeded tenant is not awaiting review");
    assert.equal(await awaiting(operatorCtx), false, "an operator-born tenant is not awaiting review");

    /* ── T2: fail closed ────────────────────────────────────────────────────── */
    assert.deepEqual(await readGenesisActivationOrigin(null, deps), { status: "unavailable" });
    assert.deepEqual(await readGenesisActivationOrigin(adaCtx, { getDb: () => null }), { status: "unavailable" });
    const ghost = contextFor("00000000-0000-4000-8000-0000000000ff", ada.userId, ada.authIdentityId);
    assert.deepEqual(await readGenesisActivationOrigin(ghost, deps), { status: "unavailable" }, "an unknown tenant is unreadable, not 'not self-service'");

    /* ── T3: the operator listing is exact and writes nothing ────────────────── */
    const before = await fingerprint(setup);
    const pending = await listPendingSelfServiceTenants(setup, TENANT_PROVISIONING_SOURCE_SELF_SERVICE);
    assert.deepEqual(
      pending.map((p) => [p.tenantSlug, p.tenantName, p.memberEmails]),
      [
        ["acme-rugs", "Acme Rugs", ["ada@acme.test"]],
        ["globex-weaving", "Globex Weaving", ["ben@globex.test"]],
      ],
      "only nominatable self-service tenants, oldest first; seeded, operator-born and suspended are absent",
    );
    assert.ok(pending.every((p) => p.createdAt instanceof Date));
    assert.equal(await fingerprint(setup), before, "the listing changed nothing");
    const after = await setup.query<{ ro: string }>(`select current_setting('transaction_read_only') as ro`);
    assert.equal(after.rows[0]!.ro, "off", "the read-only transaction was closed, not left open");
    /* Every listed email is one the existing ceremony would accept. */
    for (const p of pending) {
      assert.ok(await resolveNominationTarget(setup, p.tenantSlug, p.memberEmails[0]!), `${p.tenantSlug} is nominatable`);
    }

    /* ── T4: a nomination ends the wait for that tenant alone ────────────────── */
    const target = await resolveNominationTarget(setup, "acme-rugs", "ada@acme.test");
    const outcome = await nominateGenesisHuman(setup, target!);
    assert.equal(outcome.status, "nominated");
    assert.equal(await awaiting(adaCtx), false, "a pending nomination ends the wait");
    assert.equal(await awaiting(benCtx), true, "and only for its own tenant");
    assert.deepEqual((await listPendingSelfServiceTenants(setup, TENANT_PROVISIONING_SOURCE_SELF_SERVICE)).map((p) => p.tenantSlug), ["globex-weaving"]);

    /* A revoked nomination frees the slot, exactly as the partial unique index does. */
    const benTarget = await resolveNominationTarget(setup, "globex-weaving", "ben@globex.test");
    const benOutcome = await nominateGenesisHuman(setup, benTarget!);
    assert.equal(benOutcome.status, "nominated");
    assert.deepEqual(await listPendingSelfServiceTenants(setup, TENANT_PROVISIONING_SOURCE_SELF_SERVICE), []);
    await setup.query(`update genesis_nominations set status = 'revoked', revoked_at = now(), revocation_reason = 'test' where tenant_id = $1`, [ben.tenantId]);
    assert.deepEqual((await listPendingSelfServiceTenants(setup, TENANT_PROVISIONING_SOURCE_SELF_SERVICE)).map((p) => p.tenantSlug), ["globex-weaving"]);

    /* ── T5: Organization Readiness words it for the session's tenant only ───── */
    const stubs = {
      readGovernance: (async () => ({ status: "read", authority: { bootstrap: null, viewerIsGovernanceAuthority: false } })) as never,
      readExternalAi: (async () => ({ status: "absent" })) as never,
      readModelOps: (async () => ({ dispatch: "permitted" })) as never,
      readCapabilities: (async () => ({ capabilities: [] })) as never,
      readSendOps: (async () => ({ tenantArming: "never-armed", effectiveSend: "blocked" })) as never,
      readDomains: (async () => ({ status: "read", workDomains: [] })) as never,
      readGenesisOrigin: ((t: TenantContext) => readGenesisActivationOrigin(t, deps)) as never,
      readGenesis: ((t: TenantContext) => readGenesisNomination(t, deps)) as never,
    };
    const governanceRow = async (ctx: TenantContext) => {
      const r = await readOrganizationReadiness(ctx, stubs);
      assert.equal(r.status, "read");
      return r.status === "read" ? r.rows.find((row) => row.key === "governance")! : (undefined as never);
    };
    /*
     * A REVOKED nomination is still a row, so the genesis page shows its own "revoked" block and
     * readiness agrees with the page rather than with the operator listing. No released writer
     * produces `revoked` (G2.1 declared it and left it unwritten); this pins the agreement only.
     */
    assert.doesNotMatch((await governanceRow(benCtx)).facts, /awaiting platform review/, "readiness agrees with the page's revoked block");
    assert.equal(await awaiting(benCtx), false);
    await setup.query(`delete from genesis_nominations where tenant_id = $1`, [ben.tenantId]);
    assert.match((await governanceRow(benCtx)).facts, /awaiting platform review/, "a self-service tenant with no nomination waits");
    assert.doesNotMatch((await governanceRow(adaCtx)).facts, /awaiting platform review/, "a nominated tenant is not waiting");
    assert.doesNotMatch((await governanceRow(seededCtx)).facts, /awaiting platform review/);
    assert.doesNotMatch((await governanceRow(operatorCtx)).facts, /awaiting platform review/);
    const brokenOrigin = await readOrganizationReadiness(benCtx, { ...stubs, readGenesisOrigin: (async () => { throw new Error("down"); }) as never });
    assert.ok(brokenOrigin.status === "read" && !/awaiting platform review/.test(brokenOrigin.rows[0]!.facts), "a failing origin read keeps the released row");

    console.log("PASS tenant-activation-1 activation (postgres)");
  } finally {
    await setup.end().catch(() => undefined);
    await handle.dispose?.().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
