/*
 * P5 BYOK — the data-use screen's act and the "stop using my key" act, against a disposable PostgreSQL
 * database. No provider call: key checks use a local stub, and fetch is stubbed for the whole process.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { INTEGRATION_ENCRYPTION_ENV_KEYS } from "../../src/features/secret-encryption/key-registry.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { saveByokKey } from "../../src/features/provider-anthropic/byok-key.server";
import { readByokDataUse, recordByokDataUse, stopUsingOwnKey } from "../../src/features/provider-anthropic/byok-account-terms.server";
import { resolveTenantModelCredential } from "../../src/features/provider-anthropic/model-credential.server";
import { authorizeTenantExternalAiDataUse } from "../../src/features/external-ai-data-use/authorize-tenant-external-ai-data-use.server";
import { appendProcessorAttestation, parseAttestationRecord } from "../../scripts/lib/processor-attestation";

globalThis.fetch = (async () => { throw new Error("no network in this test"); }) as typeof fetch;

const REVIEWED_RECORD = "docs/product-vision/runtime/hebun-external-ai-data-use-b1b-anthropic-processor-attestation-record.md";
const ENC = {
  [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: `k1:${randomBytes(32).toString("base64")}`,
  [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: "k1",
};
const ENV = { HEBUN_MODEL_ID: "claude-haiku-4-5-20251001" };
const KEY = `sk-ant-api03-${randomBytes(24).toString("hex")}`;
const TERMS = { training: "none", retentionClass: "bounded-30-days", zdr: "not-enabled", justification: "Our own Anthropic agreement covers assistance." };

interface Seeded { tenantId: string; userId: string; authIdentityId: string; membershipId: string; roleId: string }

async function sessionRowFor(client: Client, s: Seeded, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(), now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [s.authIdentityId, tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a"), s.userId, s.tenantId, s.membershipId],
  );
  return row.rows[0]!.id;
}

function contextFor(s: Seeded, sessionContextId: string, requestId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId,
    membershipVersion: 1, roleId: s.roleId, sessionContextId, provider: "local", assuranceLevel: "aal1",
    mfaVerified: false, requestId, authenticatedAt: new Date().toISOString(),
  });
}

async function main(): Promise<void> {
  const parsed = parseAttestationRecord(readFileSync(path.resolve(__dirname, "../../../..", REVIEWED_RECORD), "utf8"));
  if (parsed.status !== "parsed") throw new Error("reviewed record did not parse");
  const harness = createDisposablePostgresHarness("hebun_p5_byok_data_use");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;
  const deps = { getDb, env: ENV };
  let passed = 0;
  const ok = (label: string) => { passed++; console.log(`PASS ${label}`); };
  try {
    const seed = async (slug: string, tag: string, governance: boolean) => {
      const s = await seedLocalIdentity(setup, { companyName: slug, companySlug: `${slug}-du`, email: `${slug}@du.test`, roleType: "owner" });
      const t = contextFor(s, await sessionRowFor(setup, s, tag), `du-${slug}`);
      if (governance) {
        await setup.query(
          `insert into genesis_nominations (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
             accepted_at, accepted_session_context_id, accepted_assurance_level)
           values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
          [s.tenantId, s.authIdentityId, s.userId, t.sessionContextId],
        );
        assert.equal((await establishGovernanceAuthority(t, { justification: `Establishing ${slug} Governance for this fixture.` }, { getDb })).status, "established");
      }
      return t;
    };
    const A = await seed("acme", "aaaa1", true);
    const B = await seed("globex", "bbbb2", false);
    const probe200 = (async () => new Response(null, { status: 200 })) as typeof fetch;

    /* ── recording terms: needs a connection, Governance authority and acceptable terms ── */
    assert.equal(await recordByokDataUse(A, TERMS, deps), "no-byok-connection");
    assert.equal(await saveByokKey(A, KEY, { getDb, env: ENC, fetchImpl: probe200 }), "verified");
    assert.equal(await saveByokKey(B, KEY, { getDb, env: ENC, fetchImpl: probe200 }), "verified");
    assert.equal(await recordByokDataUse(B, TERMS, deps), "not-the-governance-authority");
    assert.equal(await recordByokDataUse(A, { ...TERMS, training: "whatever" }, deps), "data-use-invalid");
    assert.equal(await recordByokDataUse(A, { ...TERMS, justification: "" }, deps), "data-use-invalid");
    assert.equal((await setup.query(`select count(*)::int as n from processor_attestations`)).rows[0].n, 0, "a refused decision writes no terms");
    const beforeTraining = await readByokDataUse(A, deps);
    assert.equal(beforeTraining.status === "read" && beforeTraining.authorized, false);
    assert.equal(await recordByokDataUse(A, { ...TERMS, training: "provider-default" }, deps), "data-use-invalid", "terms the platform does not accept cannot be authorized");
    const refusedTerms = await readByokDataUse(A, deps);
    assert.equal(refusedTerms.status === "read" && refusedTerms.authorized, false);
    ok("data-use screen: refused without a connection, without Governance authority, or with unacceptable terms");

    assert.equal(await recordByokDataUse(A, TERMS, deps), "data-use-recorded");
    const view = await readByokDataUse(A, deps);
    assert.ok(view.status === "read" && view.authorized && view.attestation?.training === "none" && view.viewerIsGovernanceAuthority);
    const decisions = (await setup.query(`select count(*)::int as n from tenant_ai_data_use_authorizations where tenant_id=$1 and state='active'`, [A.tenantId])).rows[0].n;
    assert.equal(decisions, 1, "one Governance decision recorded the authorization");
    const audits = (await setup.query(`select action from audit_log where tenant_id=$1 and action in ('external-ai.tenant-attestation.recorded','governance.decision.recorded')`, [A.tenantId])).rows.map((r) => r.action);
    assert.ok(audits.includes("external-ai.tenant-attestation.recorded") && audits.includes("governance.decision.recorded"));
    ok("data-use screen: terms recorded, assistance authorized by a Governance decision, both audited");

    /* ── stop using the own key: only onto an authorized platform account ── */
    assert.equal(await stopUsingOwnKey(A, deps), "platform-not-authorized");
    assert.equal((await resolveTenantModelCredential(A, { getDb, env: ENC })).kind, "tenant", "nothing changed");
    assert.equal((await appendProcessorAttestation(setup, { verb: "admit", record: parsed.record, reviewedRecordRef: `${REVIEWED_RECORD}@${"1".repeat(40)}`, controlSource: "local-operator-ceremony", expectedHead: null })).status, "appended");
    const platformAttestation = (await setup.query(`select id from processor_attestations where owner_tenant_id is null`)).rows[0].id as string;
    assert.equal((await authorizeTenantExternalAiDataUse(A, { attestationId: platformAttestation, scopes: [{ purpose: "assistance", dataClass: "conversation" }], justification: "This organization agrees to assistance on the reviewed platform account.", observedRevision: null }, { getDb })).status, "written");
    assert.equal(await stopUsingOwnKey(A, deps), "stopped");
    assert.deepEqual(await resolveTenantModelCredential(A, { getDb, env: ENC }), { kind: "platform" }, "Heby is back on the platform key");
    const row = (await setup.query(`select connection_state from integrations where tenant_id=$1 and provider_key='anthropic'`, [A.tenantId])).rows[0];
    assert.equal(row.connection_state, "disconnected");
    const live = (await setup.query(`select count(*)::int as n from integration_credentials ic join integrations i on i.id=ic.integration_id where i.tenant_id=$1 and ic.revoked_at is null`, [A.tenantId])).rows[0].n;
    assert.equal(live, 0, "the key was revoked, not left live on a disconnected connection");
    assert.equal(await stopUsingOwnKey(A, deps), "no-byok-connection");
    assert.equal((await resolveTenantModelCredential(B, { getDb, env: ENC })).kind, "tenant", "another tenant is untouched");
    ok("stop: refused without a platform authorization; with one, key revoked, connection disconnected, platform key again");

    const dump = JSON.stringify((await setup.query(`select * from audit_log`)).rows) + JSON.stringify((await setup.query(`select * from processor_attestations`)).rows);
    assert.ok(!dump.includes(KEY), "no key in any audit or attestation row");
    ok("no key material in audit or attestation rows");
    console.log(`\nP5 BYOK data use and stop: ${passed} checks passed`);
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
