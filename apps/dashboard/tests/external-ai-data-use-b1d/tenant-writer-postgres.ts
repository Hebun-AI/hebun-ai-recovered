/*
 * EXTERNAL-AI-DATA-USE-B1D — the tenant writer under the RECORDED policy, against a REAL but
 * DISPOSABLE PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "With the reviewed B1B record admitted by the real ceremony library and NO injected policy, the
 *    tenant writer accepts the three B1D pairs and refuses every other pair — writing nothing when it
 *    refuses — and the resolver discloses nothing to an organization that never authorized."
 *
 * This is NOT a tenant authorization: the database is created for this file and dropped on exit. No
 * production, no provider, no network, no credential.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import { authorizeTenantExternalAiDataUse } from "../../src/features/external-ai-data-use/authorize-tenant-external-ai-data-use.server";
import { readEffectiveTenantExternalAiDataUse } from "../../src/features/external-ai-data-use/read-tenant-external-ai-data-use.server";
import { readLatestProcessorAttestation } from "../../src/features/external-ai-data-use/read-processor-attestations.server";
import { composeExternalAiDisclosure } from "../../src/features/external-ai-data-use/compose-external-ai-disclosure";
import { RECORDED_PLATFORM_DISCLOSURE_POLICY } from "../../src/features/external-ai-data-use/platform-disclosure-policy";
import { appendProcessorAttestation, parseAttestationRecord } from "../../scripts/lib/processor-attestation";

const REVIEWED_RECORD = "docs/product-vision/runtime/hebun-external-ai-data-use-b1b-anthropic-processor-attestation-record.md";
const REVIEWED_RECORD_REF = `${REVIEWED_RECORD}@dbbe8a30bbaa2d6d396cb914a21e28735537fe33`;
const JUSTIFICATION = "This test organization agrees that its conversations, Knowledge and work artifacts may be processed by the reviewed assistant processor.";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

async function sessionRowFor(client: Client, seeded: Seeded, tag: string): Promise<string> {
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

function contextFor(seeded: Seeded, sessionContextId: string, requestId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
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
  const RECORD = parsed.record;

  const harness = createDisposablePostgresHarness("hebun_external_ai_b1d");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  /* NO `policy` key: every write below is decided by RECORDED_PLATFORM_DISCLOSURE_POLICY. */
  const deps = { getDb: () => handle.db };
  const count = async (table: string) => (await setup.query(`select count(*)::int n from ${table}`)).rows[0].n as number;

  try {
    /* ═══ 1. THE REVIEWED B1B RECORD, ADMITTED BY THE REAL CEREMONY LIBRARY ══════════════════════ */
    const admitted = await appendProcessorAttestation(setup, {
      verb: "admit",
      record: RECORD,
      reviewedRecordRef: REVIEWED_RECORD_REF,
      controlSource: "local-operator-ceremony",
      expectedHead: null,
    });
    assert.equal(admitted.status, "appended");
    const attestationId = (await setup.query(`select id from processor_attestations`)).rows[0].id as string;

    /* ═══ 2. TWO GOVERNANCE ORGANIZATIONS: A will authorize, B never does ═══════════════════════ */
    const a = await seedLocalIdentity(setup, { companyName: "Tenant A", companySlug: "tenant-a-b1d", email: "a@b1d.test", roleType: "owner" });
    const b = await seedLocalIdentity(setup, { companyName: "Tenant B", companySlug: "tenant-b-b1d", email: "b@b1d.test", roleType: "owner" });
    const aTenant = contextFor(a, await sessionRowFor(setup, a, "aaaa1"), "b1d-a");
    const bTenant = contextFor(b, await sessionRowFor(setup, b, "bbbb2"), "b1d-b");
    for (const [seeded, tenant, who] of [[a, aTenant, "A"], [b, bTenant, "B"]] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, tenant.sessionContextId],
      );
      const bootstrap = await establishGovernanceAuthority(
        tenant,
        { justification: `Establishing Tenant ${who}'s Governance authority for this test fixture.` },
        deps,
      );
      assert.equal(bootstrap.status, "established");
    }

    /* ═══ 3. EVERY PAIR OUTSIDE THE THREE CELLS IS REFUSED, AND NOTHING IS WRITTEN ══════════════ */
    for (const outside of [
      [{ purpose: "assistance", dataClass: "organization" }],
      [{ purpose: "assistance", dataClass: "provider-observation" }],
      [{ purpose: "assistance", dataClass: "governance-record" }],
      [{ purpose: "assistance", dataClass: "operational-record" }],
      [{ purpose: "assistance", dataClass: "external-recipient" }],
      [{ purpose: "assistance", dataClass: "media-supplied" }],
      [{ purpose: "relevance-selection", dataClass: "knowledge" }],
      [{ purpose: "agent-origination", dataClass: "work-artifact" }],
      [{ purpose: "media-generation", dataClass: "conversation" }],
      /* One outside pair refuses the whole write, even beside allowed ones. */
      [{ purpose: "assistance", dataClass: "conversation" }, { purpose: "assistance", dataClass: "organization" }],
    ] as const) {
      assert.deepEqual(
        await authorizeTenantExternalAiDataUse(aTenant, { attestationId, scopes: outside, justification: JUSTIFICATION, observedRevision: null }, deps),
        { status: "refused", reason: "platform-not-allowed" },
        JSON.stringify(outside),
      );
    }
    assert.equal(await count("tenant_ai_data_use_authorizations"), 0, "a refusal writes nothing");
    assert.equal(await count("tenant_ai_data_use_scopes"), 0);
    assert.equal(
      (await setup.query(`select count(*)::int n from governance_sessions where governance_domain = 'external-ai-data-use'`)).rows[0].n,
      0,
      "a refusal files no Governance decision",
    );

    /* ═══ 4. THE RESOLVER DISCLOSES NOTHING TO AN ORGANIZATION THAT NEVER AUTHORIZED ═══════════ */
    const latest = await readLatestProcessorAttestation("anthropic/messages", RECORD.accountRef, deps);
    assert.equal(latest.status, "read");
    for (const tenant of [a, b]) {
      const effective = await readEffectiveTenantExternalAiDataUse(tenant.tenantId, "anthropic/messages", RECORD.accountRef, deps);
      assert.equal(effective.status, "absent");
      for (const dataClass of ["conversation", "knowledge", "work-artifact"] as const) {
        const decision = composeExternalAiDisclosure({
          request: { serviceScope: "anthropic/messages", purpose: "assistance", requiredDataClasses: [dataClass], modelId: "claude-haiku-4-5-20251001" },
          policy: RECORDED_PLATFORM_DISCLOSURE_POLICY,
          accountRef: RECORD.accountRef,
          attestation: latest,
          tenant: effective,
          operatorEnabled: true,
          providerAvailable: true,
        });
        assert.equal(decision.disposition, "tenant-not-authorized", `${dataClass}: no tenant authorization, no disclosure`);
        assert.equal(decision.authorizationId, null);
      }
    }

    /* ═══ 5. THE THREE B1D PAIRS ARE ACCEPTED — in this disposable database only ════════════════ */
    const written = await authorizeTenantExternalAiDataUse(
      aTenant,
      {
        attestationId,
        scopes: [
          { purpose: "assistance", dataClass: "conversation" },
          { purpose: "assistance", dataClass: "knowledge" },
          { purpose: "assistance", dataClass: "work-artifact" },
        ],
        justification: JUSTIFICATION,
        observedRevision: null,
      },
      deps,
    );
    assert.equal(written.status, "written", "the recorded policy lets the writer accept exactly the B1D pairs");
    const effectiveA = await readEffectiveTenantExternalAiDataUse(a.tenantId, "anthropic/messages", RECORD.accountRef, deps);
    assert.equal(effectiveA.status, "read");
    if (effectiveA.status !== "read") throw new Error("unreachable");
    assert.equal(effectiveA.effective.boundAttestation?.id, attestationId);
    assert.deepEqual(
      [...effectiveA.effective.scopes].map((s) => `${s.purpose}:${s.dataClass}`).sort(),
      ["assistance:conversation", "assistance:knowledge", "assistance:work-artifact"],
    );
    /* B is untouched by A's act. */
    assert.equal((await readEffectiveTenantExternalAiDataUse(b.tenantId, "anthropic/messages", RECORD.accountRef, deps)).status, "absent");

    console.log("PASS external-ai-data-use-b1d tenant-writer-postgres");
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
