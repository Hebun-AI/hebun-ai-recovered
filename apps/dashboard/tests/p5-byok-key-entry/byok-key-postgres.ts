/*
 * P5 BYOK slice 1 — a tenant's own Anthropic key: store, replace, revoke, tenant isolation, audit,
 * and that the key never comes back out — against a disposable PostgreSQL database.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity, type SeededLocalIdentity } from "../helpers/r1-identity-seed";
import { INTEGRATION_ENCRYPTION_ENV_KEYS } from "../../src/features/secret-encryption/key-registry.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { getCapabilityAvailability } from "../../src/features/integration-authority/capability-availability.server";
import { readByokKeyStatus, revokeByokKey, saveByokKey } from "../../src/features/provider-anthropic/byok-key.server";
import { ANTHROPIC_MODEL_MESSAGES_CAPABILITY } from "../../src/features/provider-anthropic/contracts";

const ENV = {
  [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: `k1:${randomBytes(32).toString("base64")}`,
  [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: "k1",
};
const KEY_1 = `sk-ant-api03-${randomBytes(24).toString("hex")}`;
const KEY_2 = `sk-ant-api03-${randomBytes(24).toString("hex")}`;
const KEY_B = `sk-ant-api03-${randomBytes(24).toString("hex")}`;

function contextFor(s: SeededLocalIdentity): TenantContext {
  return asHumanTenantContext({
    tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId,
    membershipVersion: 1, roleId: s.roleId, sessionContextId: "00000000-0000-4000-8000-000000000051",
    provider: "local", assuranceLevel: "aal1", mfaVerified: false, requestId: "p5-byok",
    authenticatedAt: new Date().toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_p5_byok");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const calls: { url: string; key: string | null }[] = [];
  let nextStatus: number | "network" = 200;
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), key: new Headers(init?.headers).get("x-api-key") });
    if (nextStatus === "network") throw new Error("offline");
    return new Response("{\"data\":[\"SHOULD-NEVER-BE-READ\"]}", { status: nextStatus });
  }) as typeof fetch;
  const deps = { getDb: () => handle.db, env: ENV, fetchImpl };
  let passed = 0;
  const ok = (label: string) => { passed++; console.log(`PASS ${label}`); };
  try {
    harness.migrateDatabase();
    await setup.connect();
    const a = contextFor(await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme", email: "a@acme.test" }));
    const b = contextFor(await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex", email: "b@globex.test" }));
    const dump = async () => JSON.stringify((await setup.query(`select * from integration_credentials`)).rows)
      + JSON.stringify((await setup.query(`select * from audit_log`)).rows)
      + JSON.stringify((await setup.query(`select * from integrations`)).rows);

    /* ── no key yet; nothing without a tenant ── */
    assert.deepEqual(await readByokKeyStatus(a, deps), { status: "none" });
    assert.equal(await saveByokKey(null, KEY_1, deps), "unavailable");
    assert.deepEqual(await readByokKeyStatus(null, deps), { status: "unavailable" });

    /* ── a malformed key is refused before anything is written ── */
    for (const bad of ["", "hello world", "sk-proj-abcdefghijklmnopqrstuvwxyz", `${KEY_1} `, "sk-ant-short"]) {
      assert.equal(await saveByokKey(a, bad, deps), "invalid-key", `refuses ${JSON.stringify(bad.slice(0, 12))}`);
    }
    assert.equal(Number((await setup.query(`select count(*) from integrations`)).rows[0].count), 0, "no connection created");
    assert.equal(calls.length, 0, "a malformed key is never sent to Anthropic");
    ok("malformed keys and missing tenant are refused before any write or provider call");

    /* ── a key Anthropic rejects is never stored ── */
    nextStatus = 401;
    assert.equal(await saveByokKey(a, KEY_1, deps), "rejected");
    assert.equal(Number((await setup.query(`select count(*) from integration_credentials`)).rows[0].count), 0);
    assert.equal(calls.at(-1)?.url, "https://api.anthropic.com/v1/models?limit=1");
    assert.equal(calls.at(-1)?.key, KEY_1, "the probe carries the entered key");
    nextStatus = 200;
    ok("a rejected key is never stored (B5)");

    /* ── no encryption key set → nothing stored ── */
    assert.equal(await saveByokKey(a, KEY_1, { getDb: deps.getDb, env: {}, fetchImpl }), "unavailable");
    assert.equal(Number((await setup.query(`select count(*) from integration_credentials`)).rows[0].count), 0);
    ok("without the integration key set nothing is sealed or stored");

    /* ── store ── */
    assert.equal(await saveByokKey(a, KEY_1, deps), "verified");
    const s1 = await readByokKeyStatus(a, deps);
    assert.equal(s1.status, "stored");
    assert.deepEqual(Object.keys(s1).sort(), ["status", "storedAt", "verified"]);
    assert.equal(s1.status === "stored" && s1.verified, true, "verified after a 200");
    const dumped = await dump();
    assert.ok(!dumped.includes(KEY_1), "the key is not in any row, ciphertext or audit");
    assert.ok(!dumped.includes("SHOULD-NEVER-BE-READ"), "the provider response is never stored");
    ok("store: verified with one models call, sealed, metadata-only status");

    /* ── tenant isolation ── */
    assert.deepEqual(await readByokKeyStatus(b, deps), { status: "none" }, "B sees no key of A");
    assert.equal(await revokeByokKey(b, deps), "no-key", "B cannot revoke A's key");
    nextStatus = "network";
    assert.equal(await saveByokKey(b, KEY_B, deps), "unverified", "unreachable provider: stored, unverified");
    const sb = await readByokKeyStatus(b, deps);
    assert.equal(sb.status === "stored" && sb.verified, false);
    nextStatus = 200;
    const conns = (await setup.query(`select tenant_id, provider_key from integrations where provider_key='anthropic'`)).rows;
    assert.equal(conns.length, 2);
    assert.equal(new Set(conns.map((r) => r.tenant_id)).size, 2, "one connection per tenant");
    ok("tenant isolation: each tenant sees and changes only its own key");

    /* ── replace (rotation) ── */
    nextStatus = 401;
    assert.equal(await saveByokKey(a, KEY_2, deps), "rejected", "a rejected replacement changes nothing");
    assert.equal((await readByokKeyStatus(a, deps)).status, "stored", "the previous key is kept");
    nextStatus = 200;
    assert.equal(await saveByokKey(a, KEY_2, deps), "verified");
    const aCreds = (await setup.query(
      `select ic.revoked_at is null as live from integration_credentials ic join integrations i on i.id=ic.integration_id where i.tenant_id=$1`, [a.tenantId])).rows;
    assert.equal(aCreds.length, 2);
    assert.equal(aCreds.filter((r) => r.live).length, 1, "exactly one live key after rotation");
    assert.ok(!(await dump()).includes(KEY_2));
    ok("replace: old key revoked, one live key");

    /* ── availability follows verification: A verified, B unverified ── */
    const capOf = async (t: TenantContext) =>
      (await getCapabilityAvailability(t, { getDb: deps.getDb })).capabilities.find((c) => c.capability === ANTHROPIC_MODEL_MESSAGES_CAPABILITY);
    assert.equal((await capOf(a))?.state, "available", "only a 200 makes the capability available");
    assert.notEqual((await capOf(b))?.state, "available", "an unverified key never reports it available");
    ok("capability availability exists only after Anthropic accepted the key");

    /* ── revoke ── */
    assert.equal(await revokeByokKey(a, deps), "revoked");
    assert.deepEqual(await readByokKeyStatus(a, deps), { status: "none" });
    assert.equal(await revokeByokKey(a, deps), "no-key");
    assert.equal((await readByokKeyStatus(b, deps)).status, "stored", "B's key untouched by A's revoke");
    ok("revoke: immediate, idempotent refusal after, other tenant untouched");

    /* ── audit ── */
    const audit = (await setup.query(`select action, tenant_id from audit_log where action like 'integration.credential.%' order by occurred_at`)).rows;
    const forA = audit.filter((r) => r.tenant_id === a.tenantId).map((r) => r.action);
    assert.ok(forA.includes("integration.credential.stored"));
    assert.ok(forA.includes("integration.credential.replaced"));
    assert.ok(forA.includes("integration.credential.revoked"));
    const all = await dump();
    for (const k of [KEY_1, KEY_2, KEY_B]) assert.ok(!all.includes(k), "no key in any audit or credential row");
    ok("audit: stored, replaced and revoked rows, no key material");

    console.log(`\nP5 BYOK key entry: ${passed} checks passed`);
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
