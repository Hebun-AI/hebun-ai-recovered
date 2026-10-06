/*
 * EXTERNAL-AI-DATA-USE-1A — the tenant authorization authority and the processor attestation table,
 * against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "Release A cannot produce an ACTIVE external-AI data-use authorization: the database refuses an
 *    active revision that names no attestation, no attestation writer exists, and the writer refuses
 *    every cell the recorded platform policy does not ALLOW — which is every cell. When a test
 *    stands in for the later B1 admission (an attestation row and an injected ALLOW), the writer
 *    keeps every standing-authorization invariant: Governance authority, a human authorizer enforced
 *    by PostgreSQL, append-only revisions, the observed-revision CAS, explicit scope snapshots,
 *    tenant containment, and a decision filed in its own domain with its own outcome words."
 *
 * Disposable local database, dropped on exit. No provider, no network, no production.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import {
  authorizeTenantExternalAiDataUse,
  withdrawTenantExternalAiDataUse,
} from "../../src/features/external-ai-data-use/authorize-tenant-external-ai-data-use.server";
import { readEffectiveTenantExternalAiDataUse } from "../../src/features/external-ai-data-use/read-tenant-external-ai-data-use.server";
import { readLatestProcessorAttestation } from "../../src/features/external-ai-data-use/read-processor-attestations.server";
import { composeExternalAiDisclosure } from "../../src/features/external-ai-data-use/compose-external-ai-disclosure";
import {
  EXTERNAL_AI_DATA_USE_DOMAIN,
  TENANT_EXTERNAL_AI_DATA_USE_AUTHORIZED_OUTCOME,
  TENANT_EXTERNAL_AI_DATA_USE_SUBJECT_TYPE,
  TENANT_EXTERNAL_AI_DATA_USE_WITHDRAWN_OUTCOME,
} from "../../src/features/external-ai-data-use/contracts";
import {
  RECORDED_PLATFORM_DISCLOSURE_POLICY,
  type AllowedPlatformCell,
  type PlatformDisclosurePolicy,
} from "../../src/features/external-ai-data-use/platform-disclosure-policy";

const JUSTIFICATION = "This organization agrees that its conversations and Knowledge may be processed by the reviewed assistant processor.";
const WITHDRAW_JUSTIFICATION = "We are withdrawing external processing while we review how it is supervised.";
const ACCOUNT = "org-test-account";

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

/** STANDS IN FOR THE B1 ADMISSION CEREMONY, which does not exist in Release A. Test-only SQL. */
async function insertAttestation(
  client: Client,
  input: { serviceScope: string; revision: number; supersedes: string | null; state?: string; retentionClass?: string },
): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into processor_attestations
       (service_scope, account_ref, attestation_revision, state, identity_status, contract_surface,
        training, retention_class, zdr, model_treatment_class, model_ids, evidence_refs,
        reviewed_record_ref, attested_at, control_source, supersedes_attestation_id)
     values ($1, $2, $3, $4, 'attested', 'anthropic-commercial-terms', 'none', $5, 'not-enabled',
             'anthropic-standard', array['claude-haiku-4-5-20251001'], array['https://example.test/terms'],
             'docs/test-attestation.md@0000000000000000000000000000000000000000', now(),
             'local-operator-ceremony', $6)
     returning id`,
    [input.serviceScope, ACCOUNT, input.revision, input.state ?? "active", input.retentionClass ?? "bounded-30-days", input.supersedes],
  );
  return row.rows[0]!.id;
}

const BOUNDS = {
  maxTraining: "none",
  maxRetention: "bounded-30-days",
  contractSurfaces: ["anthropic-commercial-terms"],
  minimumIdentity: "attested",
  zdrRequired: false,
} as const;
const cell = (dataClass: AllowedPlatformCell["dataClass"]): AllowedPlatformCell => ({
  serviceScope: "anthropic/messages",
  purpose: "assistance",
  dataClass,
  decision: "allowed",
  bounds: BOUNDS,
  evidence: "test fixture standing in for a B1 reviewed ALLOW",
});
/** TEST-ONLY. No runtime caller passes a policy; the firewall file proves the action does not. */
const INJECTED_ALLOW: PlatformDisclosurePolicy = {
  deniedServiceScopes: [],
  allowedCells: [cell("conversation"), cell("knowledge"), cell("organization")],
};

async function constraintViolation(client: Client, sql: string, params: unknown[]): Promise<string> {
  try {
    await client.query(sql, params);
  } catch (error) {
    const e = error as { code?: string; constraint?: string };
    return `${e.code}:${e.constraint ?? ""}`;
  }
  return "inserted";
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_external_ai_1a");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const baseDeps = { getDb: () => handle.db };
  const allowDeps = { ...baseDeps, policy: INJECTED_ALLOW };

  try {
    /* ═══ 0. THE MIGRATION ═══════════════════════════════════════════════════════════════════ */
    const domains = (
      await setup.query<{ v: string }>(
        `select e.enumlabel as v from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'governance_domain'`,
      )
    ).rows.map((r) => r.v);
    assert.ok(domains.includes(EXTERNAL_AI_DATA_USE_DOMAIN), "the Governance domain exists");

    const columnsOf = async (table: string) =>
      (
        await setup.query<{ column_name: string }>(
          `select column_name from information_schema.columns where table_name = $1`,
          [table],
        )
      ).rows.map((r) => r.column_name);
    const attestationColumns = await columnsOf("processor_attestations");
    assert.ok(attestationColumns.length > 0, "processor_attestations exists");
    assert.ok(!attestationColumns.includes("tenant_id"), "a processor attestation is ROOT: it has no tenant");
    const tenantColumns = await columnsOf("tenant_ai_data_use_authorizations");
    for (const c of ["tenant_id", "service_scope", "account_ref", "bound_processor_attestation_id", "governance_decision_id", "authorized_by_actor_type"]) {
      assert.ok(tenantColumns.includes(c), `tenant authorization carries ${c}`);
    }
    assert.ok((await columnsOf("tenant_ai_data_use_scopes")).includes("data_class"));
    assert.ok(!(await columnsOf("provider_connectivity_controls")).includes("tenant_id"), "R2E gained no tenant dimension");
    for (const table of ["messages", "heby_origination_invocations", "heby_answer_evidence_item", "heby_answer_source_evidence"]) {
      const cols = await columnsOf(table);
      assert.ok(
        !cols.some((c) => c.includes("data_use") || c.includes("disclosed") || c.includes("attestation")),
        `${table} gained NO disclosure column in Release A (Amendment 1)`,
      );
    }

    /* ═══ 1. SEED: two Governance tenants and one with no Governance at all ═══════════════════ */
    const a = await seedLocalIdentity(setup, { companyName: "Tenant A", companySlug: "tenant-a-eai", email: "a@eai.test", roleType: "owner" });
    const b = await seedLocalIdentity(setup, { companyName: "Tenant B", companySlug: "tenant-b-eai", email: "b@eai.test", roleType: "owner" });
    const c = await seedLocalIdentity(setup, { companyName: "Tenant C", companySlug: "tenant-c-eai", email: "c@eai.test", roleType: "owner" });
    const aTenant = contextFor(a, await sessionRowFor(setup, a, "aaaa1"), "eai-a");
    const bTenant = contextFor(b, await sessionRowFor(setup, b, "bbbb2"), "eai-b");
    const cTenant = contextFor(c, await sessionRowFor(setup, c, "cccc3"), "eai-c");
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
        baseDeps,
      );
      assert.equal(bootstrap.status, "established");
    }

    /* ═══ 2. INERT BY THE DATABASE: an active revision must name an attestation ═══════════════ */
    const decisionRow = (
      await setup.query<{ id: string; session_id: string }>(
        `select id, session_id from decision_records where tenant_id = $1 and bootstrap = true`,
        [a.tenantId],
      )
    ).rows[0]!;
    const insertTenantRow = (bound: string | null, actorType: string, state = "active", scope = "anthropic/messages") =>
      constraintViolation(
        setup,
        `insert into tenant_ai_data_use_authorizations
           (tenant_id, authorization_revision, state, service_scope, account_ref, bound_processor_attestation_id,
            governance_decision_id, governance_session_id, authorized_by_actor_type, authorized_by_actor_id, authorized_at)
         values ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
        [a.tenantId, state, scope, ACCOUNT, bound, decisionRow.id, decisionRow.session_id, actorType, a.userId],
      );
    assert.equal(
      await insertTenantRow(null, "human"),
      "23514:tenant_ai_data_use_authorizations_bound_attestation_chk",
      "an ACTIVE revision that names no attestation is unrepresentable",
    );
    assert.equal(
      await insertTenantRow("44444444-4444-4444-8444-444444444444", "human"),
      "23503:tenant_ai_data_use_authorizations_bound_attestation_fk",
      "an ACTIVE revision naming an attestation that does not exist is a database error",
    );

    /*
     * ═══ 3. BOUNDED BY THE POLICY: even WITH an attestation, the recorded policy refuses every pair it
     * does not name. Release A pinned "refuses every cell"; B1D (Director, 2026-10-04) ALLOWS exactly
     * assistance × {conversation, knowledge, work-artifact} for anthropic/messages, so this section now
     * offers pairs OUTSIDE those three. The acceptance of an in-scope pair is proven in a throwaway
     * database by tests/external-ai-data-use-b1d/tenant-writer-postgres.ts. ═══════════════════════
     */
    assert.equal(
      (await readLatestProcessorAttestation("anthropic/messages", ACCOUNT, baseDeps)).status,
      "absent",
      "Release A ships no attestation",
    );
    const att1 = await insertAttestation(setup, { serviceScope: "anthropic/messages", revision: 1, supersedes: null });
    const pairs = [
      { purpose: "assistance", dataClass: "conversation" },
      { purpose: "assistance", dataClass: "knowledge" },
    ] as const;
    for (const outside of [
      [{ purpose: "assistance", dataClass: "organization" }],
      [{ purpose: "relevance-selection", dataClass: "conversation" }],
      [{ purpose: "assistance", dataClass: "conversation" }, { purpose: "agent-origination", dataClass: "work-artifact" }],
    ] as const) {
      const recorded = await authorizeTenantExternalAiDataUse(
        aTenant,
        { attestationId: att1, scopes: outside, justification: JUSTIFICATION, observedRevision: null },
        baseDeps,
      );
      assert.deepEqual(
        recorded,
        { status: "refused", reason: "platform-not-allowed" },
        "the RECORDED policy refuses every pair outside the three B1D cells — one outside pair refuses the whole write",
      );
    }
    assert.equal(
      (await setup.query(`select count(*)::int n from tenant_ai_data_use_authorizations`)).rows[0].n,
      0,
      "and nothing was written",
    );

    /* Human supremacy, in PostgreSQL. */
    assert.equal(
      await insertTenantRow(att1, "agent"),
      "23514:tenant_ai_data_use_authorizations_human_authorizer_chk",
      "an agent can never authorize external disclosure",
    );
    /* The bound attestation must belong to the SAME lineage the revision claims. */
    const otherScopeAttestation = await insertAttestation(setup, { serviceScope: "openai/images.edits", revision: 1, supersedes: null });
    assert.equal(
      await insertTenantRow(otherScopeAttestation, "human"),
      "23503:tenant_ai_data_use_authorizations_bound_attestation_fk",
      "an authorization cannot bind to another scope's attestation",
    );

    /* ═══ 4. REFUSALS BEFORE ANY WRITE ════════════════════════════════════════════════════════ */
    assert.deepEqual(
      await authorizeTenantExternalAiDataUse(null, { attestationId: att1, scopes: pairs, justification: JUSTIFICATION, observedRevision: null }, allowDeps),
      { status: "refused", reason: "unauthenticated" },
    );
    assert.deepEqual(
      await authorizeTenantExternalAiDataUse(aTenant, { attestationId: att1, scopes: pairs, justification: "", observedRevision: null }, allowDeps),
      { status: "refused", reason: "justification-required" },
    );
    assert.deepEqual(
      await authorizeTenantExternalAiDataUse(cTenant, { attestationId: att1, scopes: pairs, justification: JUSTIFICATION, observedRevision: null }, allowDeps),
      { status: "refused", reason: "no-governance-authority" },
      "a tenant with no Governance (the self-service shape) cannot authorize anything",
    );
    for (const bad of [
      [],
      [{ purpose: "ai", dataClass: "knowledge" }],
      [{ purpose: "assistance", dataClass: "everything" }],
      [pairs[0], pairs[0]],
    ]) {
      assert.deepEqual(
        await authorizeTenantExternalAiDataUse(
          aTenant,
          { attestationId: att1, scopes: bad as never, justification: JUSTIFICATION, observedRevision: null },
          allowDeps,
        ),
        { status: "refused", reason: "invalid-scope" },
      );
    }
    assert.deepEqual(
      await authorizeTenantExternalAiDataUse(
        aTenant,
        { attestationId: "55555555-5555-4555-8555-555555555555", scopes: pairs, justification: JUSTIFICATION, observedRevision: null },
        allowDeps,
      ),
      { status: "refused", reason: "attestation-unknown" },
    );
    assert.deepEqual(
      await authorizeTenantExternalAiDataUse(
        aTenant,
        { attestationId: att1, scopes: [{ purpose: "agent-origination", dataClass: "knowledge" }], justification: JUSTIFICATION, observedRevision: null },
        allowDeps,
      ),
      { status: "refused", reason: "platform-not-allowed" },
      "even the injected ALLOW covers only its own cells",
    );

    /* ═══ 5. AUTHORIZE (B1 stood in for) ══════════════════════════════════════════════════════ */
    const first = await authorizeTenantExternalAiDataUse(
      aTenant,
      { attestationId: att1, scopes: pairs, justification: JUSTIFICATION, observedRevision: null },
      allowDeps,
    );
    assert.equal(first.status, "written");
    if (first.status !== "written") throw new Error("unreachable");
    assert.equal(first.authorizationRevision, 1);
    assert.equal(first.state, "active");

    const decision = (
      await setup.query<{ decision_type: string; subject_type: string; outcome: string; actor_type: string; governance_domain: string }>(
        `select d.decision_type::text, d.subject_type, d.outcome, d.actor_type::text, s.governance_domain::text
           from decision_records d join governance_sessions s on s.id = d.session_id where d.id = $1`,
        [first.governanceDecisionId],
      )
    ).rows[0]!;
    assert.deepEqual(decision, {
      decision_type: "approve",
      subject_type: TENANT_EXTERNAL_AI_DATA_USE_SUBJECT_TYPE,
      outcome: TENANT_EXTERNAL_AI_DATA_USE_AUTHORIZED_OUTCOME,
      actor_type: "human",
      governance_domain: EXTERNAL_AI_DATA_USE_DOMAIN,
    }, "filed in its own domain with its own words — never `membership-authorized`");

    const effective = await readEffectiveTenantExternalAiDataUse(a.tenantId, "anthropic/messages", ACCOUNT, baseDeps);
    assert.equal(effective.status, "read");
    if (effective.status !== "read") throw new Error("unreachable");
    assert.equal(effective.effective.state, "active");
    assert.equal(effective.effective.boundAttestation?.id, att1);
    assert.deepEqual(
      [...effective.effective.scopes].map((s) => `${s.purpose}:${s.dataClass}`).sort(),
      ["assistance:conversation", "assistance:knowledge"],
    );

    /* Containment: B holds nothing, and A's row is invisible through B's lineage read. */
    assert.equal((await readEffectiveTenantExternalAiDataUse(b.tenantId, "anthropic/messages", ACCOUNT, baseDeps)).status, "absent");

    /*
     * Under the RECORDED policy the composition now follows the tenant's own authorization (B1D), and
     * a class outside the three cells is still UNKNOWN. Release A pinned platform-unknown here. The
     * composer is pure and runtime calls it nowhere yet (B2) — the firewall file proves that.
     */
    const latest = await readLatestProcessorAttestation("anthropic/messages", ACCOUNT, baseDeps);
    assert.equal(latest.status, "read");
    const resolved = composeExternalAiDisclosure({
      request: { serviceScope: "anthropic/messages", purpose: "assistance", requiredDataClasses: ["conversation"], modelId: "claude-haiku-4-5-20251001" },
      policy: RECORDED_PLATFORM_DISCLOSURE_POLICY,
      accountRef: ACCOUNT,
      attestation: latest,
      tenant: effective,
      operatorEnabled: true,
      providerAvailable: true,
    });
    assert.equal(resolved.disposition, "authorized", "this test database's own authorization is honoured for an ALLOWED cell");
    assert.equal(
      composeExternalAiDisclosure({
        request: { serviceScope: "anthropic/messages", purpose: "assistance", requiredDataClasses: ["organization"], modelId: "claude-haiku-4-5-20251001" },
        policy: RECORDED_PLATFORM_DISCLOSURE_POLICY,
        accountRef: ACCOUNT,
        attestation: latest,
        tenant: effective,
        operatorEnabled: true,
        providerAvailable: true,
      }).disposition,
      "platform-unknown",
      "a class outside the three B1D cells is still UNKNOWN",
    );

    /* ═══ 6. CAS, NO-OP, REVISIONS ════════════════════════════════════════════════════════════ */
    assert.deepEqual(
      await authorizeTenantExternalAiDataUse(aTenant, { attestationId: att1, scopes: pairs, justification: JUSTIFICATION, observedRevision: null }, allowDeps),
      { status: "refused", reason: "stale-authorization-revision" },
    );
    assert.deepEqual(
      await authorizeTenantExternalAiDataUse(aTenant, { attestationId: att1, scopes: pairs, justification: JUSTIFICATION, observedRevision: 1 }, allowDeps),
      { status: "refused", reason: "unchanged" },
    );
    const rev1Before = (await setup.query(`select * from tenant_ai_data_use_authorizations where authorization_revision = 1`)).rows[0];
    const second = await authorizeTenantExternalAiDataUse(
      aTenant,
      { attestationId: att1, scopes: [...pairs, { purpose: "assistance", dataClass: "organization" }], justification: JUSTIFICATION, observedRevision: 1 },
      allowDeps,
    );
    assert.equal(second.status, "written");
    if (second.status !== "written") throw new Error("unreachable");
    assert.equal(second.authorizationRevision, 2);
    const rev1After = (await setup.query(`select * from tenant_ai_data_use_authorizations where authorization_revision = 1`)).rows[0];
    assert.deepEqual(rev1After, rev1Before, "revision 1 is byte-identical after revision 2");
    assert.equal(
      (await setup.query(`select count(*)::int n from tenant_ai_data_use_scopes where authorization_id = $1`, [first.authorizationId])).rows[0].n,
      2,
      "revision 1's scope snapshot is unchanged",
    );

    /* A superseded attestation cannot be authorized against. */
    const att2 = await insertAttestation(setup, { serviceScope: "anthropic/messages", revision: 2, supersedes: att1 });
    assert.deepEqual(
      await authorizeTenantExternalAiDataUse(aTenant, { attestationId: att1, scopes: pairs, justification: JUSTIFICATION, observedRevision: 2 }, allowDeps),
      { status: "refused", reason: "attestation-not-current" },
    );
    assert.ok(att2);

    /* ═══ 7. WITHDRAW ═════════════════════════════════════════════════════════════════════════ */
    const withdrawn = await withdrawTenantExternalAiDataUse(
      aTenant,
      { serviceScope: "anthropic/messages", accountRef: ACCOUNT, justification: WITHDRAW_JUSTIFICATION, observedRevision: 2 },
      baseDeps,
    );
    assert.equal(withdrawn.status, "written");
    if (withdrawn.status !== "written") throw new Error("unreachable");
    assert.equal(withdrawn.state, "withdrawn");
    assert.equal(withdrawn.authorizationRevision, 3);
    const withdrawnOutcome = (await setup.query<{ outcome: string; decision_type: string }>(
      `select outcome, decision_type::text from decision_records where id = $1`,
      [withdrawn.governanceDecisionId],
    )).rows[0]!;
    assert.deepEqual(withdrawnOutcome, { outcome: TENANT_EXTERNAL_AI_DATA_USE_WITHDRAWN_OUTCOME, decision_type: "revoke" });
    const afterWithdraw = await readEffectiveTenantExternalAiDataUse(a.tenantId, "anthropic/messages", ACCOUNT, baseDeps);
    assert.ok(afterWithdraw.status === "read" && afterWithdraw.effective.state === "withdrawn" && afterWithdraw.effective.scopes.length === 0);
    assert.deepEqual(
      await withdrawTenantExternalAiDataUse(
        aTenant,
        { serviceScope: "anthropic/messages", accountRef: ACCOUNT, justification: WITHDRAW_JUSTIFICATION, observedRevision: 3 },
        baseDeps,
      ),
      { status: "refused", reason: "no-active-authorization" },
    );
    assert.deepEqual(
      await withdrawTenantExternalAiDataUse(
        bTenant,
        { serviceScope: "anthropic/messages", accountRef: ACCOUNT, justification: WITHDRAW_JUSTIFICATION, observedRevision: null },
        baseDeps,
      ),
      { status: "refused", reason: "no-active-authorization" },
      "B cannot withdraw what it never held — and cannot reach A's lineage",
    );
    /* A lineage cannot open with a withdrawal, at the database. */
    assert.equal(
      await insertTenantRow(null, "human", "withdrawn"),
      "23514:tenant_ai_data_use_authorizations_first_revision_active_chk",
    );

    /* Nothing touched the operational or neighbouring authorities. */
    for (const table of ["provider_connectivity_controls", "tenant_external_send_authorizations", "action_permits", "heby_action_requests"]) {
      assert.equal((await setup.query(`select count(*)::int n from ${table}`)).rows[0].n, 0, `${table} untouched`);
    }

    console.log("PASS external-ai-data-use-1a authority-postgres");
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
