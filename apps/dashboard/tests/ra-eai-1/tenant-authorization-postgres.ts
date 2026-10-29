/*
 * RA-EAI-1 — the research purpose through the EXISTING tenant authorization, against a REAL but
 * DISPOSABLE PostgreSQL database (modelled on B1D's tenant-writer-postgres).
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "Under the recorded policy and the reviewed attestation, the platform cell alone discloses nothing;
 *    the existing Governance writer accepts research × conversation and refuses every other research
 *    pair, writing nothing; one organization's agreement is not another's; a research grant is not an
 *    assistance grant; the existing withdrawal ends it; and no Work artifact is produced."
 *
 * Not a tenant authorization: the database is created for this file and dropped on exit. No
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
import { authorizeTenantExternalAiDataUse, withdrawTenantExternalAiDataUse } from "../../src/features/external-ai-data-use/authorize-tenant-external-ai-data-use.server";
import { readEffectiveTenantExternalAiDataUse } from "../../src/features/external-ai-data-use/read-tenant-external-ai-data-use.server";
import { readLatestProcessorAttestation } from "../../src/features/external-ai-data-use/read-processor-attestations.server";
import { composeExternalAiDisclosure } from "../../src/features/external-ai-data-use/compose-external-ai-disclosure";
import { RECORDED_PLATFORM_DISCLOSURE_POLICY } from "../../src/features/external-ai-data-use/platform-disclosure-policy";
import { appendProcessorAttestation, parseAttestationRecord } from "../../scripts/lib/processor-attestation";

const REVIEWED_RECORD = "docs/product-vision/runtime/hebun-external-ai-data-use-b1b-anthropic-processor-attestation-record.md";
const REVIEWED_RECORD_REF = `${REVIEWED_RECORD}@dbbe8a30bbaa2d6d396cb914a21e28735537fe33`;
const JUSTIFICATION = "This test organization agrees that its research questions may be processed by the reviewed assistant processor.";
const WITHDRAW_JUSTIFICATION = "This test organization withdraws its agreement for research questions to be processed.";
const MODEL = "claude-haiku-4-5-20251001";

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

  const harness = createDisposablePostgresHarness("hebun_ra_eai_1");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  /* NO `policy` key: every write below is decided by RECORDED_PLATFORM_DISCLOSURE_POLICY. */
  const deps = { getDb: () => handle.db };
  const count = async (table: string) => (await setup.query(`select count(*)::int n from ${table}`)).rows[0].n as number;

  try {
    const admitted = await appendProcessorAttestation(setup, {
      verb: "admit",
      record: RECORD,
      reviewedRecordRef: REVIEWED_RECORD_REF,
      controlSource: "local-operator-ceremony",
      expectedHead: null,
    });
    assert.equal(admitted.status, "appended");
    const attestationId = (await setup.query(`select id from processor_attestations`)).rows[0].id as string;

    const a = await seedLocalIdentity(setup, { companyName: "Tenant A", companySlug: "tenant-a-ra-eai", email: "a@ra-eai.test", roleType: "owner" });
    const b = await seedLocalIdentity(setup, { companyName: "Tenant B", companySlug: "tenant-b-ra-eai", email: "b@ra-eai.test", roleType: "owner" });
    const aTenant = contextFor(a, await sessionRowFor(setup, a, "aaaa1"), "ra-eai-a");
    const bTenant = contextFor(b, await sessionRowFor(setup, b, "bbbb2"), "ra-eai-b");
    for (const [seeded, tenant, who] of [[a, aTenant, "A"], [b, bTenant, "B"]] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, tenant.sessionContextId],
      );
      const bootstrap = await establishGovernanceAuthority(tenant, { justification: `Establishing Tenant ${who}'s Governance authority for this test fixture.` }, deps);
      assert.equal(bootstrap.status, "established");
    }
    const latest = await readLatestProcessorAttestation("anthropic/messages", RECORD.accountRef, deps);
    assert.equal(latest.status, "read");
    const decide = async (tenantId: string, requiredDataClasses: readonly ("conversation" | "work-artifact" | "knowledge")[], purpose: "research" | "assistance" = "research", providerAvailable = true) =>
      composeExternalAiDisclosure({
        request: { serviceScope: "anthropic/messages", purpose, requiredDataClasses, modelId: MODEL },
        policy: RECORDED_PLATFORM_DISCLOSURE_POLICY,
        accountRef: RECORD.accountRef,
        attestation: latest,
        tenant: await readEffectiveTenantExternalAiDataUse(tenantId, "anthropic/messages", RECORD.accountRef, deps),
        operatorEnabled: true,
        providerAvailable,
      }).disposition;

    /* ═══ R3 · every research pair but conversation is refused by the writer, and nothing is written ═══ */
    for (const dataClass of ["work-artifact", "knowledge", "organization", "operational-record", "governance-record", "provider-observation", "external-recipient"] as const) {
      assert.deepEqual(
        await authorizeTenantExternalAiDataUse(aTenant, { attestationId, scopes: [{ purpose: "research", dataClass }], justification: JUSTIFICATION, observedRevision: null }, deps),
        { status: "refused", reason: "platform-not-allowed" },
        `research × ${dataClass}`,
      );
    }
    assert.deepEqual(
      await authorizeTenantExternalAiDataUse(
        aTenant,
        { attestationId, scopes: [{ purpose: "research", dataClass: "conversation" }, { purpose: "research", dataClass: "work-artifact" }], justification: JUSTIFICATION, observedRevision: null },
        deps,
      ),
      { status: "refused", reason: "platform-not-allowed" },
      "one outside pair refuses the whole write",
    );
    assert.equal(await count("tenant_ai_data_use_authorizations"), 0, "a refusal writes nothing");
    assert.equal((await setup.query(`select count(*)::int n from governance_sessions where governance_domain = 'external-ai-data-use'`)).rows[0].n, 0, "and files no decision");

    /* ═══ R4 · the platform cell alone authorizes nobody ═══ */
    for (const tenant of [a, b]) assert.equal(await decide(tenant.tenantId, ["conversation"]), "tenant-not-authorized");

    /* ═══ A authorizes research × conversation through the existing Governance writer ═══ */
    const written = await authorizeTenantExternalAiDataUse(
      aTenant,
      { attestationId, scopes: [{ purpose: "research", dataClass: "conversation" }], justification: JUSTIFICATION, observedRevision: null },
      deps,
    );
    assert.equal(written.status, "written");
    assert.equal((await setup.query(`select count(*)::int n from governance_sessions where governance_domain = 'external-ai-data-use'`)).rows[0].n, 1, "one Governance decision, the existing domain");
    assert.equal(await decide(a.tenantId, ["conversation"]), "authorized", "A: research × conversation");
    /* R3 at the resolver: a research request that needs any other class is not disclosed. */
    assert.equal(await decide(a.tenantId, ["conversation", "work-artifact"]), "platform-unknown", "A: research × work-artifact is not a platform cell");
    assert.equal(await decide(a.tenantId, ["knowledge"]), "platform-unknown");
    /* R7 · the grant is per purpose: research authorizes no assistance. */
    assert.equal(await decide(a.tenantId, ["conversation"], "assistance"), "tenant-not-authorized", "A: research grants no assistance");
    /* R5 · B cannot use A's agreement. */
    assert.equal(await decide(b.tenantId, ["conversation"]), "tenant-not-authorized", "B: A's grant is not B's");
    assert.equal((await readEffectiveTenantExternalAiDataUse(b.tenantId, "anthropic/messages", RECORD.accountRef, deps)).status, "absent");
    /* R10 · availability is the provider's and is never assumed: an unavailable provider is a refusal, not a call. */
    assert.equal(await decide(a.tenantId, ["conversation"], "research", false), "provider-unavailable");

    /* ═══ R6 · revoke through the existing withdrawal ═══ */
    const withdrawn = await withdrawTenantExternalAiDataUse(
      aTenant,
      { serviceScope: "anthropic/messages", accountRef: RECORD.accountRef, justification: WITHDRAW_JUSTIFICATION, observedRevision: 1 },
      deps,
    );
    assert.equal(withdrawn.status, "written");
    assert.equal(await decide(a.tenantId, ["conversation"]), "tenant-withdrawn", "A: withdrawn is refused");

    /* R11 · nothing here produced a research artifact or any Work artifact. */
    assert.equal(await count("work_artifacts"), 0);

    console.log("PASS ra-eai-1 tenant-authorization-postgres");
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
