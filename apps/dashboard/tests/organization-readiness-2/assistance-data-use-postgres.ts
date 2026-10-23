/*
 * ORGANIZATION-READINESS-2 — the in-app assistance decision against a REAL but DISPOSABLE database.
 *
 * Proves, through the composer the server actions call (no injected policy):
 *   1 · the view reads this tenant only, and fails closed when the store is unavailable
 *   2 · only a Governance holder of THIS tenant can authorize; a forged cross-tenant context, a tenant
 *       without Governance, a missing reason and a stale revision are refused and write nothing
 *   3 · authorizing writes exactly the recorded assistance pairs; repeating it is `unchanged`
 *   4 · other purposes in force survive both authorizing and withdrawing assistance
 *   5 · with nothing else in force, withdrawing is the writer's withdrawal, and the resolver then
 *       discloses nothing
 *
 * No production, no provider, no network, no credential. The database is dropped on exit.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity, type SeededLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { authorizeTenantExternalAiDataUse } from "../../src/features/external-ai-data-use/authorize-tenant-external-ai-data-use.server";
import { readEffectiveTenantExternalAiDataUse } from "../../src/features/external-ai-data-use/read-tenant-external-ai-data-use.server";
import { readLatestProcessorAttestation } from "../../src/features/external-ai-data-use/read-processor-attestations.server";
import { composeExternalAiDisclosure } from "../../src/features/external-ai-data-use/compose-external-ai-disclosure";
import { RECORDED_PLATFORM_DISCLOSURE_POLICY } from "../../src/features/external-ai-data-use/platform-disclosure-policy";
import { CONFIGURED_ANTHROPIC_ACCOUNT_REF } from "../../src/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import {
  authorizeAssistanceDataUse,
  readAssistanceDataUse,
  withdrawAssistanceDataUse,
} from "../../src/features/external-ai-data-use/assistance-data-use.server";
import { appendProcessorAttestation, parseAttestationRecord } from "../../scripts/lib/processor-attestation";

const REVIEWED_RECORD = "docs/product-vision/runtime/hebun-external-ai-data-use-b1b-anthropic-processor-attestation-record.md";
const REVIEWED_RECORD_REF = `${REVIEWED_RECORD}@dbbe8a30bbaa2d6d396cb914a21e28735537fe33`;
const REASON = "This test organization agrees its conversations, Knowledge and work artifacts may reach the reviewed assistant.";
const ASSISTANCE = ["assistance:conversation", "assistance:knowledge", "assistance:work-artifact"];

async function sessionRowFor(client: Client, seeded: SeededLocalIdentity, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
             now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [seeded.authIdentityId, tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a"), seeded.userId, seeded.tenantId, seeded.membershipId],
  );
  return row.rows[0]!.id;
}

function contextFor(seeded: SeededLocalIdentity, sessionContextId: string, requestId: string, tenantId = seeded.tenantId): TenantContext {
  return asHumanTenantContext({
    tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId,
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId,
    authenticatedAt: new Date().toISOString(),
  });
}

async function main(): Promise<void> {
  const parsed = parseAttestationRecord(readFileSync(path.resolve(__dirname, "../../../..", REVIEWED_RECORD), "utf8"));
  if (parsed.status !== "parsed") throw new Error(`the reviewed record did not parse: ${parsed.reason}`);
  assert.equal(parsed.record.accountRef, CONFIGURED_ANTHROPIC_ACCOUNT_REF, "the configured account is the reviewed one");

  const harness = createDisposablePostgresHarness("hebun_org_readiness_2");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db };
  const count = async (sql: string) => (await setup.query(sql)).rows[0].n as number;
  const revisions = () => count(`select count(*)::int n from tenant_ai_data_use_authorizations`);
  const scopesOf = async (tenantId: string) => {
    const read = await readEffectiveTenantExternalAiDataUse(tenantId, "anthropic/messages", CONFIGURED_ANTHROPIC_ACCOUNT_REF, deps);
    return read.status === "read" ? { state: read.effective.state, revision: read.effective.authorizationRevision, scopes: read.effective.scopes.map((s) => `${s.purpose}:${s.dataClass}`).sort() } : read.status;
  };

  try {
    /* ═══ SETUP: the reviewed attestation; A and B with Governance, C without ═══════════════════ */
    const admitted = await appendProcessorAttestation(setup, {
      verb: "admit",
      record: parsed.record,
      reviewedRecordRef: REVIEWED_RECORD_REF,
      controlSource: "local-operator-ceremony",
      expectedHead: null,
    });
    assert.equal(admitted.status, "appended");
    const attestationId = (await setup.query(`select id from processor_attestations`)).rows[0].id as string;

    const a = await seedLocalIdentity(setup, { companyName: "Tenant A", companySlug: "tenant-a-or2", email: "a@or2.test", roleType: "owner" });
    const b = await seedLocalIdentity(setup, { companyName: "Tenant B", companySlug: "tenant-b-or2", email: "b@or2.test", roleType: "owner" });
    const c = await seedLocalIdentity(setup, { companyName: "Tenant C", companySlug: "tenant-c-or2", email: "c@or2.test", roleType: "owner" });
    const aTenant = contextFor(a, await sessionRowFor(setup, a, "aaaa1"), "or2-a");
    const bTenant = contextFor(b, await sessionRowFor(setup, b, "bbbb2"), "or2-b");
    const cTenant = contextFor(c, await sessionRowFor(setup, c, "cccc3"), "or2-c");
    for (const [seeded, tenant, who] of [[a, aTenant, "A"], [b, bTenant, "B"]] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, tenant.sessionContextId],
      );
      const bootstrap = await establishGovernanceAuthority(tenant, { justification: `Establishing Tenant ${who}'s Governance authority for this fixture.` }, deps);
      assert.equal(bootstrap.status, "established");
    }

    /* ═══ 1. THE VIEW ═══════════════════════════════════════════════════════════════════════════ */
    const viewA = await readAssistanceDataUse(aTenant, deps);
    assert.equal(viewA.status, "read");
    if (viewA.status !== "read") throw new Error("unreachable");
    assert.equal(viewA.governanceEstablished, true);
    assert.equal(viewA.viewerIsGovernanceAuthority, true);
    assert.deepEqual([...viewA.dataClasses], ["conversation", "knowledge", "work-artifact"], "what may be sent is the recorded policy's");
    assert.equal(viewA.attestation?.id, attestationId);
    assert.ok((viewA.attestation?.modelIds.length ?? 0) > 0);
    assert.equal(viewA.revision, null);
    assert.equal(viewA.assistanceAuthorized, false);
    assert.ok(!JSON.stringify(viewA).includes(CONFIGURED_ANTHROPIC_ACCOUNT_REF), "the view carries no account reference");
    const viewC = await readAssistanceDataUse(cTenant, deps);
    assert.ok(viewC.status === "read" && !viewC.governanceEstablished && !viewC.viewerIsGovernanceAuthority);
    assert.deepEqual(await readAssistanceDataUse(null, deps), { status: "unauthenticated" });
    assert.deepEqual(await readAssistanceDataUse(aTenant, { getDb: () => null }), { status: "unavailable" }, "an unreadable store offers no decision");

    /* ═══ 2. REFUSALS WRITE NOTHING ═════════════════════════════════════════════════════════════ */
    const ok = { attestationId, justification: REASON, observedRevision: null };
    const forged = contextFor(b, bTenant.sessionContextId, "or2-forged", a.tenantId);
    for (const [label, result, reason] of [
      ["unauthenticated", await authorizeAssistanceDataUse(null, ok, deps), "unauthenticated"],
      ["no Governance yet", await authorizeAssistanceDataUse(cTenant, ok, deps), "no-governance-authority"],
      ["B's human, A's tenant", await authorizeAssistanceDataUse(forged, ok, deps), "not-the-governance-authority"],
      ["no reason", await authorizeAssistanceDataUse(aTenant, { ...ok, justification: "  " }, deps), "justification-required"],
      ["stale revision", await authorizeAssistanceDataUse(aTenant, { ...ok, observedRevision: 1 }, deps), "stale-authorization-revision"],
      ["unknown attestation", await authorizeAssistanceDataUse(aTenant, { ...ok, attestationId: "not-a-uuid" }, deps), "attestation-unknown"],
      ["store unavailable", await authorizeAssistanceDataUse(aTenant, ok, { getDb: () => null }), "persistence-unavailable"],
      ["nothing to withdraw", await withdrawAssistanceDataUse(aTenant, { justification: REASON, observedRevision: null }, deps), "no-active-authorization"],
    ] as const) {
      assert.deepEqual(result, { status: "refused", reason }, label);
    }
    assert.equal(await revisions(), 0, "a refusal writes nothing");
    assert.equal(await count(`select count(*)::int n from governance_sessions where governance_domain = 'external-ai-data-use'`), 0);

    /* ═══ 3. AUTHORIZE: exactly the assistance pairs; A only ════════════════════════════════════ */
    const first = await authorizeAssistanceDataUse(aTenant, ok, deps);
    assert.equal(first.status, "written");
    assert.deepEqual(await scopesOf(a.tenantId), { state: "active", revision: 1, scopes: ASSISTANCE });
    assert.equal(await scopesOf(b.tenantId), "absent", "B is untouched by A's decision");
    const afterA = await readAssistanceDataUse(aTenant, deps);
    assert.ok(afterA.status === "read" && afterA.assistanceAuthorized && afterA.revision === 1);
    assert.deepEqual(await authorizeAssistanceDataUse(aTenant, { ...ok, observedRevision: 1 }, deps), { status: "refused", reason: "unchanged" });
    assert.deepEqual(
      await withdrawAssistanceDataUse(bTenant, { justification: REASON, observedRevision: null }, deps),
      { status: "refused", reason: "no-active-authorization" },
      "B cannot withdraw A's authorization",
    );

    /* ═══ 4. OTHER PURPOSES SURVIVE ═════════════════════════════════════════════════════════════ */
    const origination = await authorizeTenantExternalAiDataUse(
      aTenant,
      {
        attestationId,
        scopes: [
          { purpose: "assistance", dataClass: "conversation" },
          { purpose: "assistance", dataClass: "knowledge" },
          { purpose: "assistance", dataClass: "work-artifact" },
          { purpose: "agent-origination", dataClass: "conversation" },
          { purpose: "agent-origination", dataClass: "organization" },
        ],
        justification: REASON,
        observedRevision: 1,
      },
      deps,
    );
    assert.equal(origination.status, "written");
    const ORIGINATION = ["agent-origination:conversation", "agent-origination:organization"];
    assert.deepEqual(
      await withdrawAssistanceDataUse(aTenant, { justification: REASON, observedRevision: 1 }, deps),
      { status: "refused", reason: "stale-authorization-revision" },
    );
    assert.equal((await withdrawAssistanceDataUse(aTenant, { justification: REASON, observedRevision: 2 }, deps)).status, "written");
    assert.deepEqual(await scopesOf(a.tenantId), { state: "active", revision: 3, scopes: ORIGINATION }, "withdrawing assistance keeps origination");
    const keptView = await readAssistanceDataUse(aTenant, deps);
    assert.ok(keptView.status === "read" && !keptView.assistanceAuthorized);
    assert.deepEqual(keptView.status === "read" ? [...keptView.otherPurposes] : null, ["agent-origination"]);
    assert.equal((await authorizeAssistanceDataUse(aTenant, { ...ok, observedRevision: 3 }, deps)).status, "written");
    assert.deepEqual(await scopesOf(a.tenantId), { state: "active", revision: 4, scopes: [...ORIGINATION, ...ASSISTANCE].sort() }, "authorizing assistance keeps origination");

    /* ═══ 5. NOTHING ELSE IN FORCE: withdrawal, and the resolver discloses nothing ════════════════ */
    assert.equal((await authorizeAssistanceDataUse(bTenant, ok, deps)).status, "written");
    assert.equal((await withdrawAssistanceDataUse(bTenant, { justification: REASON, observedRevision: 1 }, deps)).status, "written");
    assert.deepEqual(await scopesOf(b.tenantId), { state: "withdrawn", revision: 2, scopes: [] });
    const latest = await readLatestProcessorAttestation("anthropic/messages", CONFIGURED_ANTHROPIC_ACCOUNT_REF, deps);
    const effectiveB = await readEffectiveTenantExternalAiDataUse(b.tenantId, "anthropic/messages", CONFIGURED_ANTHROPIC_ACCOUNT_REF, deps);
    assert.equal(latest.status, "read");
    const disclosure = composeExternalAiDisclosure({
      request: { serviceScope: "anthropic/messages", purpose: "assistance", requiredDataClasses: ["conversation"], modelId: "claude-haiku-4-5-20251001" },
      policy: RECORDED_PLATFORM_DISCLOSURE_POLICY,
      accountRef: CONFIGURED_ANTHROPIC_ACCOUNT_REF,
      attestation: latest,
      tenant: effectiveB,
      operatorEnabled: true,
      providerAvailable: true,
    });
    assert.equal(disclosure.disposition, "tenant-withdrawn", "a withdrawn organization discloses nothing");
    assert.equal(
      await count(`select count(*)::int n from governance_sessions where governance_domain = 'external-ai-data-use'`),
      await revisions(),
      "every revision carries its own Governance decision",
    );

    console.log("PASS organization-readiness-2 assistance-data-use-postgres");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
