/*
 * WF-2 — the capability truth against REAL authorities, for two organizations side by side.
 *
 * Proven here:
 *   - a mandate of send + record-work yields "can propose now: record-work" and
 *     "permitted but not exposed: send" — never send as reachable;
 *   - another organization, read through its OWN session, sees only its own state (unavailable,
 *     external AI not authorized) and nothing of the first organization;
 *   - rendering the card from these reads writes nothing and reaches no network: no origination
 *     invocation, no disclosure audit, no request, decision, permit, work item or agent row.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedAgentMandate } from "../helpers/agent-mandate-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { authorizeTenantExternalAiDataUse } from "../../src/features/external-ai-data-use/authorize-tenant-external-ai-data-use.server";
import { appendProcessorAttestation, parseAttestationRecord } from "../../scripts/lib/processor-attestation";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { readOriginationAvailability } from "../../src/features/origination-availability/read-origination-availability.server";
import { deriveAgentCapabilityTruth } from "../../src/features/origination-availability/capability-truth";
import { AgentCapabilityTruthCard } from "../../src/components/agents/agent-capability-truth";
import type { ProviderOpsView } from "../../src/features/heby-provider-ops/provider-connectivity-projection.server";

const REVIEWED_RECORD = "docs/product-vision/runtime/hebun-external-ai-data-use-b1b-anthropic-processor-attestation-record.md";
const ATTESTED = "claude-haiku-4-5-20251001";
const WATCHED = [
  "audit_log",
  "heby_origination_invocations",
  "heby_action_requests",
  "decision_records",
  "action_permits",
  "work_items",
  "messages",
  "agent_mandates",
  "tenant_ai_data_use_authorizations",
  "agents",
];

async function main(): Promise<void> {
  const parsed = parseAttestationRecord(readFileSync(path.resolve(__dirname, "../../../..", REVIEWED_RECORD), "utf8"));
  if (parsed.status !== "parsed") throw new Error(`the reviewed record did not parse: ${parsed.reason}`);

  const harness = createDisposablePostgresHarness("hebun_wf2_capability");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;
  const deps = { getDb } as never;

  const realFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    fetches += 1;
    return realFetch(...args);
  }) as typeof fetch;

  const counts = async (): Promise<Record<string, number>> => {
    const out: Record<string, number> = {};
    for (const t of WATCHED) out[t] = Number((await setup.query(`select count(*)::int n from ${t}`)).rows[0]!.n);
    return out;
  };

  /* One organization with Governance, a durable agent and the default mandate (send + record-work). */
  const organization = async (slug: string, agentName: string, hashChar: string) => {
    const org = await seedLocalIdentity(setup, { companyName: slug, companySlug: slug, email: `director@${slug}.test`, roleType: "owner" });
    const session = (
      await setup.query<{ id: string }>(
        `insert into user_session_contexts (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
           user_id, active_tenant_id, active_membership_id, membership_version, assurance_level, mfa_verified, authenticated_at,
           issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
         values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(), now() + interval '1 day', now() + interval '1 hour') returning id`,
        [org.authIdentityId, hashChar.repeat(64), org.userId, org.tenantId, org.membershipId],
      )
    ).rows[0]!.id;
    const ctx: TenantContext = asHumanTenantContext({
      tenantId: org.tenantId, userId: org.userId, authIdentityId: org.authIdentityId, membershipId: org.membershipId, membershipVersion: 1,
      roleId: org.roleId, sessionContextId: session, provider: "local", assuranceLevel: "aal1", mfaVerified: false, requestId: slug,
      authenticatedAt: new Date().toISOString(),
    });
    await setup.query(
      `insert into genesis_nominations (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source, accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [org.tenantId, org.authIdentityId, org.userId, session],
    );
    assert.equal((await establishGovernanceAuthority(ctx, { justification: `Establishing Governance for the WF-2 fixture ${slug}.` }, deps)).status, "established");
    const created = await createDurableAgentIdentity(ctx, { name: agentName, justification: "Register this agent for the test organization." }, deps);
    assert.equal(created.status, "established");
    const agentId = created.status === "established" ? created.identity.agentId : "";
    const mandate = await seedAgentMandate(setup, org, agentId, deps, { tag: slug });
    return { org, ctx, agentId, mandate };
  };

  try {
    const a = await organization("wf2-alpha", "Alpha Heby", "a");
    const b = await organization("wf2-beta", "Beta Agent", "b");

    assert.equal(
      (await appendProcessorAttestation(setup, { verb: "admit", record: parsed.record, reviewedRecordRef: `${REVIEWED_RECORD}@${"7".repeat(40)}`, controlSource: "local-operator-ceremony", expectedHead: null })).status,
      "appended",
    );
    const attestationId = (await setup.query(`select id from processor_attestations`)).rows[0].id as string;
    const scopes = [
      ...(["conversation", "knowledge", "work-artifact"] as const).map((dataClass) => ({ purpose: "assistance" as const, dataClass })),
      ...(["conversation", "organization"] as const).map((dataClass) => ({ purpose: "agent-origination" as const, dataClass })),
    ];
    const just = "This test organization agrees that its goal and structure may be processed so its agent can propose work.";
    /* Only Alpha authorizes external AI. Beta does not. */
    assert.equal((await authorizeTenantExternalAiDataUse(a.ctx, { attestationId, scopes, justification: just, observedRevision: null }, deps)).status, "written");

    const ops = async () => ({ directorEnabled: true, dispatch: "permitted", model: ATTESTED }) as ProviderOpsView;
    /* Exactly what the /agents page does: the session's tenant, the projection, the pure derivation, the card. */
    const renderFor = async (ctx: TenantContext) => {
      const truth = deriveAgentCapabilityTruth(
        await readOriginationAvailability({ resolveTenant: async () => ctx, getDb: getDb as never, readProviderOps: ops }),
      );
      return { truth, html: renderToStaticMarkup(createElement(AgentCapabilityTruthCard, { truth })) };
    };

    const before = await counts();
    const fetchesBefore = fetches;
    const alpha = await renderFor(a.ctx);
    const beta = await renderFor(b.ctx);
    assert.deepEqual(await counts(), before, "rendering wrote nothing: no invocation, audit, request, permit, work or agent row");
    assert.equal(fetches, fetchesBefore, "rendering reached no network");

    /* 1 · mandate send + record-work → reachable record-work only. */
    assert.deepEqual(alpha.truth, {
      status: "known",
      mandateRevision: a.mandate.mandateRevision,
      mandatePermits: ["send", "record-work"],
      canProposeNow: ["record-work"],
      permittedButNotExposed: ["send"],
    });
    const canNow = alpha.html.split("Can propose now")[1]!.split("Mandate permits")[0]!;
    assert.ok(canNow.includes("Work proposals"));
    assert.equal(canNow.includes("Send proposals"), false, "send is never shown as reachable now");
    assert.ok(alpha.html.split("not offered by the current proposal path")[1]!.includes("Send proposals"));

    /* 4 · Beta sees only Beta: its own refusal, nothing of Alpha. */
    assert.deepEqual(beta.truth, { status: "unavailable", reason: "external-ai-not-authorized" });
    for (const foreign of ["Alpha Heby", a.agentId, a.org.tenantId, `revision ${a.mandate.mandateRevision}`, "Work proposals"]) {
      assert.equal(beta.html.includes(foreign), false, `Beta's render carries no ${foreign}`);
    }
    for (const secret of [ATTESTED, attestationId, a.org.tenantId, b.org.tenantId, a.agentId, b.agentId]) {
      assert.equal(alpha.html.includes(secret) || beta.html.includes(secret), false, `no render exposes ${secret}`);
    }

    console.log("PASS wf2-agent-capability-truth capability-postgres (2 organizations, 0 writes, 0 fetches)");
  } finally {
    globalThis.fetch = realFetch;
    await setup.end().catch(() => {});
    await (handle as { dispose?: () => Promise<void> }).dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
