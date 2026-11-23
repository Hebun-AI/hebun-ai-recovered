/*
 * P5-4 — plan entitlements and the BYOK quota (Director decisions 2026-11-23). Real disposable PostgreSQL,
 * the released writers and the released dispatch cap. No network. (The schedule half is proven in
 * tests/p6-4-scheduled-research: the grant and the 08:00 run both refuse a Free plan.)
 *
 *   A1  Free admits one agent and refuses the second, writing nothing
 *   A2  a retired agent frees its place; a suspended one would not (counted until retired)
 *   A3  a plan change takes effect on the next request: Free → Pro admits up to five, refuses the sixth
 *   A4  Founding has no agent limit
 *   Q1  a platform-key model call is refused at the plan quota; a verified tenant-key call is still admitted
 *   Q2  tenant-key calls never consume the plan quota
 *   Q3  an operator-set deployment cap still refuses a tenant-key call, counting every model call of the day
 *   Q4  a plan change takes effect on the next model request
 *   Q5  the media class is counted exactly as before
 *   K1  the operator kill switch still refuses a tenant-key call
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedGovernanceAuthority } from "../helpers/agent-mandate-seed";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { retireDurableAgentIdentity } from "../../src/features/agent-identity/retire-durable-agent-identity.server";
import { admitAiDispatch, AI_DISPATCH_CAP_ENV_KEYS } from "../../src/features/ai-dispatch-cap/ai-dispatch-safety-cap.server";
import { EXTERNAL_AI_DISCLOSURE_AUTHORIZED } from "../../src/features/governance-audit/external-ai-disclosure-audit.server";
import { COMMERCIAL_PLAN_LIMITS, planFeatures } from "../../src/features/tenant-entitlements/plans";
import { composeExternalAiDisclosure } from "../../src/features/external-ai-data-use/compose-external-ai-disclosure";
import { RECORDED_PLATFORM_DISCLOSURE_POLICY } from "../../src/features/external-ai-data-use/platform-disclosure-policy";

let networkCalls = 0;
globalThis.fetch = (() => {
  networkCalls++;
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

const PLATFORM_ACCOUNT = "14ea4a95-7d92-4844-8aca-5de14968a87d";
const WHY = "Register this agent for the P5-4 entitlement proof.";

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("p5-4-plan-entitlements/entitlements-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_p5_4_entitlements");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;
  const n = async (sql: string, params: unknown[] = []) => Number((await setup.query<{ n: number }>(sql, params)).rows[0]!.n);
  const setPlan = (tenantId: string, plan: string) => setup.query(`update companies set plan = $2 where id = $1`, [tenantId, plan]);

  const tenantCtx = async (slug: string): Promise<{ seed: Seeded; ctx: TenantContext }> => {
    const seed = (await seedLocalIdentity(setup, { companyName: slug, companySlug: slug, email: `director@${slug}.test` })) as Seeded;
    const session = (await setup.query<{ id: string }>(
      `insert into user_session_contexts
         (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
          user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
          mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
       values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(), now() + interval '1 day', now() + interval '1 hour')
       returning id`,
      [seed.authIdentityId, createHash("sha256").update(slug).digest("hex"), seed.userId, seed.tenantId, seed.membershipId],
    )).rows[0]!.id;
    const ctx = asHumanTenantContext({
      tenantId: seed.tenantId, userId: seed.userId, authIdentityId: seed.authIdentityId, membershipId: seed.membershipId,
      membershipVersion: 1, roleId: seed.roleId, sessionContextId: session, provider: "local", assuranceLevel: "aal1",
      mfaVerified: false, requestId: "p5-4-request", authenticatedAt: new Date().toISOString(),
    });
    await seedGovernanceAuthority(setup, seed, deps, { ctx, sessionContextId: session });
    return { seed, ctx };
  };
  const register = (ctx: TenantContext, name: string) => createDurableAgentIdentity(ctx, { name, justification: WHY }, deps);
  const agentsOf = (tenantId: string) => n(`select count(*)::int n from agents where tenant_id = $1`, [tenantId]);

  /* A disclosure the cap counts, as the generator records it, on the platform or the tenant's account. */
  const disclosure = (tenantId: string, userId: string, accountRef: string) =>
    setup.query(
      `insert into audit_log (tenant_id, actor_type, actor_id, action, entity_type, entity_id, occurred_at, result, source, metadata)
       values ($1, 'human', $2, $3, 'external-ai-disclosure-decision', gen_random_uuid(), now(), 'committed', 'external-ai-data-use', $4::jsonb)`,
      [tenantId, userId, EXTERNAL_AI_DISCLOSURE_AUTHORIZED, JSON.stringify({ accountRef })],
    );
  /* The tenant's own attested account, which is what makes a disclosure a BYOK one. */
  const tenantAccount = async (seed: Seeded): Promise<string> => {
    const accountRef = `tenant-byok:${seed.tenantId}`;
    await setup.query(
      `insert into processor_attestations
         (service_scope, account_ref, attestation_revision, state, identity_status, contract_surface,
          training, retention_class, zdr, model_treatment_class, model_ids, evidence_refs,
          reviewed_record_ref, attested_at, control_source, owner_tenant_id, attested_by_user_id)
       values ('anthropic/messages', $1, 1, 'active', 'attested', 'anthropic-commercial-terms', 'none', 'bounded-30-days',
               'not-enabled', 'anthropic-standard', array['claude-haiku-4-5-20251001'], array['https://example.test/terms'],
               'docs/test-attestation.md@0000000000000000000000000000000000000000', now(), 'tenant-attestation', $2, $3)`,
      [accountRef, seed.tenantId, seed.userId],
    );
    return accountRef;
  };
  const admit = (seed: Seeded, source: "platform" | "tenant", env: Record<string, string | undefined> = {}, dispatchClass: "model" | "media" = "model") =>
    admitAiDispatch(
      { tenantId: seed.tenantId, dispatchClass, credentialSource: source, actorUserId: seed.userId, commit: async () => "admitted" },
      { getDb: () => handle.db, env },
    );

  try {
    /* ── A1 · Free: one agent ── */
    const free = await tenantCtx("p54-free");
    await setPlan(free.seed.tenantId, "free");
    const first = await register(free.ctx, "First Agent");
    assert.equal(first.status, "established", JSON.stringify(first));
    const before = await n(`select count(*)::int n from decision_records where tenant_id = $1`, [free.seed.tenantId]);
    assert.deepEqual(await register(free.ctx, "Second Agent"), { status: "refused", reason: "plan-agent-limit-reached" }, "A1: Free refuses a second agent");
    assert.equal(await agentsOf(free.seed.tenantId), 1, "A1: no agent written");
    assert.equal(await n(`select count(*)::int n from decision_records where tenant_id = $1`, [free.seed.tenantId]), before, "A1: no decision written");

    /* ── A2 · retirement frees the place ── */
    const retired = await retireDurableAgentIdentity(free.ctx, { agentId: first.status === "established" ? first.identity.agentId : "", justification: WHY }, deps);
    assert.notEqual(retired.status, "refused", JSON.stringify(retired));
    assert.equal((await register(free.ctx, "Second Agent")).status, "established", "A2: a retired agent does not count");

    /* ── A3 · Free → Pro on the next request ── */
    await setPlan(free.seed.tenantId, "pro");
    for (let i = 3; i <= 6; i += 1) assert.equal((await register(free.ctx, `Agent ${i}`)).status, "established", `A3: Pro admits agent ${i - 1} of 5`);
    assert.deepEqual(await register(free.ctx, "Agent 7"), { status: "refused", reason: "plan-agent-limit-reached" }, "A3: Pro refuses the sixth");
    assert.equal(COMMERCIAL_PLAN_LIMITS.pro.agentLimit, 5);
    assert.equal(COMMERCIAL_PLAN_LIMITS.free.agentLimit, 1);

    /* ── A4 · Founding: no limit ── */
    const founding = await tenantCtx("p54-founding");
    for (let i = 1; i <= 7; i += 1) assert.equal((await register(founding.ctx, `Founder ${i}`)).status, "established", `A4: Founding agent ${i}`);
    assert.equal(planFeatures("founding").agentLimit, null);

    /* ── Q1 · the plan quota counts the platform key only ── */
    const q = await tenantCtx("p54-quota");
    await setPlan(q.seed.tenantId, "free");
    const own = await tenantAccount(q.seed);
    for (let i = 0; i < COMMERCIAL_PLAN_LIMITS.free.model; i += 1) await disclosure(q.seed.tenantId, q.seed.userId, PLATFORM_ACCOUNT);
    assert.deepEqual(await admit(q.seed, "platform"), { status: "refused", reason: "dispatch-safety-cap-reached" }, "Q1: the platform key is at the Free quota");
    assert.equal((await admit(q.seed, "tenant")).status, "admitted", "Q1: a tenant-key call is not charged to the plan quota");

    /* ── Q2 · tenant-key calls never consume the plan quota ── */
    const byok = await tenantCtx("p54-byok");
    await setPlan(byok.seed.tenantId, "free");
    const byokAccount = await tenantAccount(byok.seed);
    for (let i = 0; i < 40; i += 1) await disclosure(byok.seed.tenantId, byok.seed.userId, byokAccount);
    assert.equal((await admit(byok.seed, "platform")).status, "admitted", "Q2: forty own-key calls leave the platform quota untouched");
    /* Rows recorded before BYOK carried no accountRef; they are platform calls and still count. */
    const legacy = await tenantCtx("p54-legacy");
    await setPlan(legacy.seed.tenantId, "free");
    for (let i = 0; i < COMMERCIAL_PLAN_LIMITS.free.model; i += 1) {
      await setup.query(
        `insert into audit_log (tenant_id, actor_type, actor_id, action, entity_type, entity_id, occurred_at, result, source)
         values ($1, 'human', $2, $3, 'external-ai-disclosure-decision', gen_random_uuid(), now(), 'committed', 'external-ai-data-use')`,
        [legacy.seed.tenantId, legacy.seed.userId, EXTERNAL_AI_DISCLOSURE_AUTHORIZED],
      );
    }
    assert.equal((await admit(legacy.seed, "platform")).status, "refused", "Q2: a row with no accountRef is a platform call");

    /* ── Q3 · the operator-set deployment cap still bounds a tenant-key call, counting every model call ── */
    const ops = await tenantCtx("p54-ops");
    const opsAccount = await tenantAccount(ops.seed);
    await disclosure(ops.seed.tenantId, ops.seed.userId, PLATFORM_ACCOUNT);
    await disclosure(ops.seed.tenantId, ops.seed.userId, PLATFORM_ACCOUNT);
    await disclosure(ops.seed.tenantId, ops.seed.userId, opsAccount);
    const capped = { [AI_DISPATCH_CAP_ENV_KEYS.model]: "3" };
    assert.deepEqual(await admit(ops.seed, "tenant", capped), { status: "refused", reason: "dispatch-safety-cap-reached" }, "Q3: three of three, platform and own key together");
    assert.equal((await admit(ops.seed, "tenant", { [AI_DISPATCH_CAP_ENV_KEYS.model]: "4" })).status, "admitted", "Q3: under the operator cap");
    assert.equal((await admit(ops.seed, "tenant")).status, "admitted", "Q3: no operator cap, no BYOK limit");

    /* ── Q4 · a plan change takes effect on the next model request ── */
    await setPlan(q.seed.tenantId, "pro");
    assert.equal((await admit(q.seed, "platform")).status, "admitted", "Q4: Pro's quota applies at once");
    void own;

    /* ── Q5 · media is counted exactly as before ── */
    const media = await tenantCtx("p54-media");
    await setPlan(media.seed.tenantId, "free");
    assert.equal((await admit(media.seed, "tenant", {}, "media")).status, "admitted", "Q5: one media unit on Free");
    const mediaSource = readFileSync("src/features/ai-dispatch-cap/ai-dispatch-safety-cap.server.ts", "utf8");
    assert.match(mediaSource, /const tenantKey = input\.dispatchClass === "model" && input\.credentialSource === "tenant";/, "Q5: only a MODEL call can be a tenant-key call");

    /* ── K1 · the kill switch still refuses a tenant-key call ──
     * The operator switch is judged in the disclosure decision, for the tenant's own account exactly as for
     * the platform's; a paused operator refuses before any admission is asked. */
    {
      const attestation = { id: "a", serviceScope: "anthropic/messages", accountRef: `tenant-byok:${byok.seed.tenantId}`, identityStatus: "attested", contractSurface: "anthropic-commercial-terms", training: "none", retentionClass: "bounded-30-days", zdr: "not-enabled", modelTreatmentClass: "anthropic-standard" } as const;
      const decide = (operatorEnabled: boolean) =>
        composeExternalAiDisclosure({
          request: { serviceScope: "anthropic/messages", purpose: "assistance", requiredDataClasses: ["conversation"], modelId: "claude-haiku-4-5-20251001" },
          policy: RECORDED_PLATFORM_DISCLOSURE_POLICY,
          accountRef: attestation.accountRef,
          attestation: { status: "read", latest: { ...attestation, state: "active", modelIds: ["claude-haiku-4-5-20251001"], attestationRevision: 1 } },
          tenant: { status: "read", effective: { authorizationId: "33333333-3333-4333-8333-333333333333", state: "active", boundAttestation: attestation, scopes: [{ purpose: "assistance", dataClass: "conversation" }], authorizationRevision: 1 } },
          operatorEnabled,
          providerAvailable: true,
        } as never);
      assert.equal(decide(true).disposition, "authorized", "K1: the own-key call is authorized with the switch on");
      assert.notEqual(decide(false).disposition, "authorized", "K1: and refused with the operator switch paused");
    }

    /* The generator names the credential source from the transport, never from a client value. */
    assert.match(
      readFileSync("src/features/heby-model/heby-model-generation.server.ts", "utf8"),
      /credentialSource: credential\?\.source === "tenant" \? "tenant" : "platform",/,
    );

    assert.equal(networkCalls, 0, "no network");
    finished = true;
    console.log("p5-4-plan-entitlements/entitlements-postgres: OK");
  } finally {
    await setup.end().catch(() => {});
    await (handle as { dispose?: () => Promise<void> }).dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

void main();
