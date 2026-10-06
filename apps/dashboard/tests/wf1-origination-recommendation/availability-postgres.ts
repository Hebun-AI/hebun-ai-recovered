/*
 * WF-1 — the origination availability projection against the REAL authorities, and proof that it is
 * advisory: when authority changes after AVAILABLE was read, the released origination seam still
 * refuses.
 *
 * Proven here:
 *   - every unavailable reason the projection can return, from real rows (no agent, retired,
 *     several in service, no mandate, mandate without record-work, model not permitted, EAI not
 *     authorized, model not attested, an unreadable authority, no tenant);
 *   - AVAILABLE names the real agent and its effective mandate;
 *   - every projection call writes nothing and reaches no network (row counts and fetch count);
 *   - its declared classes are exactly what the origination seam derives and declares;
 *   - STALE STATE: AVAILABLE → mandate withdrawn / EAI withdrawn / agent retired → the existing
 *     origination seam refuses and files nothing.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedAgentMandate } from "../helpers/agent-mandate-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { retireDurableAgentIdentity } from "../../src/features/agent-identity/retire-durable-agent-identity.server";
import { originateAgentAction } from "../../src/features/agent-origination/originate-action.server";
import {
  authorizeTenantExternalAiDataUse,
  withdrawTenantExternalAiDataUse,
} from "../../src/features/external-ai-data-use/authorize-tenant-external-ai-data-use.server";
import {
  CONFIGURED_ANTHROPIC_ACCOUNT_REF,
  authorizeExternalAiDisclosure,
  type ExternalAiDisclosureDeclaration,
} from "../../src/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import { appendProcessorAttestation, parseAttestationRecord } from "../../scripts/lib/processor-attestation";
import { generateHebyModelAnswer } from "../../src/features/heby-model";
import { recordExternalAiDisclosureDecision } from "../../src/features/governance-audit/external-ai-disclosure-audit.server";
import { createLiveClaudeTransport, type FetchLike } from "../../src/features/heby-model-live/claude-http-transport.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime/contracts";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import {
  ORIGINATION_DECLARED_DATA_CLASSES,
  readOriginationAvailability,
} from "../../src/features/origination-availability/read-origination-availability.server";
import type { ProviderOpsView } from "../../src/features/heby-provider-ops/provider-connectivity-projection.server";

const REVIEWED_RECORD = "docs/product-vision/runtime/hebun-external-ai-data-use-b1b-anthropic-processor-attestation-record.md";
const ATTESTED = "claude-haiku-4-5-20251001";
const ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: ATTESTED,
  HEBUN_MODEL_CREDENTIAL: "sk-fake",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
};
const GOAL = "Record the warehouse floor reorganisation as organizational work.";
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

const ops = (over: Partial<ProviderOpsView> = {}): ProviderOpsView =>
  ({ directorEnabled: true, dispatch: "permitted", model: ATTESTED, ...over }) as ProviderOpsView;

async function main(): Promise<void> {
  const parsed = parseAttestationRecord(readFileSync(path.resolve(__dirname, "../../../..", REVIEWED_RECORD), "utf8"));
  if (parsed.status !== "parsed") throw new Error(`the reviewed record did not parse: ${parsed.reason}`);

  const harness = createDisposablePostgresHarness("hebun_wf1_availability");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;
  const deps = { getDb } as never;

  let fetches = 0;
  const SELECTION = JSON.stringify({ kind: "record-work", args: { title: "Record the floor reorganisation", scope: { kind: "organization-level" } }, reason: "The goal names organization-level work." });
  const fetchImpl: FetchLike = async () => {
    fetches += 1;
    return { ok: true, status: 200, json: async () => ({ id: "msg_wf1", model: ATTESTED, content: [{ type: "text", text: SELECTION }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }) };
  };
  const counts = async (): Promise<Record<string, number>> => {
    const out: Record<string, number> = {};
    for (const t of WATCHED) out[t] = Number((await setup.query(`select count(*)::int n from ${t}`)).rows[0]!.n);
    return out;
  };

  try {
    const org = await seedLocalIdentity(setup, { companyName: "Wf1", companySlug: "wf1-availability", email: "director@wf1.test", roleType: "owner" });
    const session = (
      await setup.query<{ id: string }>(
        `insert into user_session_contexts (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
           user_id, active_tenant_id, active_membership_id, membership_version, assurance_level, mfa_verified, authenticated_at,
           issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
         values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(), now() + interval '1 day', now() + interval '1 hour') returning id`,
        [org.authIdentityId, "b".repeat(64), org.userId, org.tenantId, org.membershipId],
      )
    ).rows[0]!.id;
    const ctx: TenantContext = asHumanTenantContext({
      tenantId: org.tenantId, userId: org.userId, authIdentityId: org.authIdentityId, membershipId: org.membershipId, membershipVersion: 1,
      roleId: org.roleId, sessionContextId: session, provider: "local", assuranceLevel: "aal1", mfaVerified: false, requestId: "wf1",
      authenticatedAt: new Date().toISOString(),
    });
    await setup.query(
      `insert into genesis_nominations (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source, accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [org.tenantId, org.authIdentityId, org.userId, session],
    );
    assert.equal((await establishGovernanceAuthority(ctx, { justification: "Establishing Governance for the WF-1 fixture." }, deps)).status, "established");

    /* Every projection call is checked to write nothing and reach no network. */
    let calls = 0;
    const project = async (over: { tenant?: TenantContext | null; ops?: ProviderOpsView; getDb?: () => unknown } = {}) => {
      const before = await counts();
      const fetchesBefore = fetches;
      const result = await readOriginationAvailability({
        resolveTenant: async () => (over.tenant === undefined ? ctx : over.tenant),
        getDb: (over.getDb ?? getDb) as never,
        readProviderOps: async () => over.ops ?? ops(),
      });
      assert.deepEqual(await counts(), before, `projection ${++calls} wrote nothing`);
      assert.equal(fetches, fetchesBefore, `projection ${calls} reached no network`);
      return result;
    };
    const reasonOf = async (over: Parameters<typeof project>[0] = {}) => {
      const r = await project(over);
      return r.status === "unavailable" ? r.reason : r.status;
    };

    /* ═══ 1. EVERY UNAVAILABLE REASON, FROM REAL ROWS ═══════════════════════════════════════════ */
    assert.equal(await reasonOf({ tenant: null }), "tenant-unavailable");
    assert.equal(await reasonOf(), "no-agent");

    const created = await createDurableAgentIdentity(ctx, { name: "Heby" }, deps);
    assert.equal(created.status, "established");
    const agentId = created.status === "established" ? created.identity.agentId : "";
    assert.equal(await reasonOf(), "mandate-unavailable", "an agent with no mandate is not offered");

    const rev1 = await seedAgentMandate(setup, org, agentId, deps, { tag: "wf1a", proposalScope: ["send"] });
    assert.equal(await reasonOf(), "proposal-scope-unavailable", "a mandate without record-work is not offered");
    const rev2 = await seedAgentMandate(setup, org, agentId, deps, { tag: "wf1b", observedMandateRevision: rev1.mandateRevision });

    assert.equal(await reasonOf(), "external-ai-not-authorized", "no attestation, no tenant authorization");
    assert.equal(
      (await appendProcessorAttestation(setup, { verb: "admit", record: parsed.record, reviewedRecordRef: `${REVIEWED_RECORD}@${"7".repeat(40)}`, controlSource: "local-operator-ceremony", expectedHead: null })).status,
      "appended",
    );
    const attestationId = (await setup.query(`select id from processor_attestations`)).rows[0].id as string;
    const ASSIST = (["conversation", "knowledge", "work-artifact"] as const).map((dataClass) => ({ purpose: "assistance" as const, dataClass }));
    const ORIG = (["conversation", "organization"] as const).map((dataClass) => ({ purpose: "agent-origination" as const, dataClass }));
    const just = "This test organization agrees that its goal and structure may be processed so its agent can propose work.";
    assert.equal((await authorizeTenantExternalAiDataUse(ctx, { attestationId, scopes: ASSIST, justification: just, observedRevision: null }, deps)).status, "written");
    assert.equal(await reasonOf(), "external-ai-not-authorized", "assistance alone does not authorize origination");
    assert.equal((await authorizeTenantExternalAiDataUse(ctx, { attestationId, scopes: [...ASSIST, ...ORIG], justification: just, observedRevision: 1 }, deps)).status, "written");

    /* ═══ 2. AVAILABLE — the real agent and its effective mandate ══════════════════════════════ */
    const available = await project();
    assert.equal(available.status, "available", JSON.stringify(available));
    if (available.status !== "available") throw new Error("unreachable");
    assert.equal(available.agent.name, "Heby");
    assert.equal(available.mandate.revision, rev2.mandateRevision);
    assert.ok(available.mandate.proposalScope.includes("record-work"));
    assert.equal(available.originable, "record-work");
    const shown = JSON.stringify(available);
    for (const secret of [ATTESTED, attestationId, CONFIGURED_ANTHROPIC_ACCOUNT_REF, org.tenantId, agentId, "sk-fake"]) {
      assert.equal(shown.includes(secret), false, `the projection exposes no ${secret}`);
    }

    assert.equal(await reasonOf({ ops: ops({ dispatch: "blocked-by-director", directorEnabled: false }) }), "model-unavailable");
    assert.equal(await reasonOf({ ops: ops({ dispatch: "blocked-by-availability" }) }), "model-unavailable");
    assert.equal(await reasonOf({ ops: ops({ model: "claude-sonnet-4-5" }) }), "external-ai-not-authorized", "a model the attestation does not record is not offered");
    assert.equal(await reasonOf({ getDb: () => null }), "temporarily-unavailable", "an unreadable authority fails closed");

    /* ═══ 3. ITS DECLARATION IS THE ONE ORIGINATION ACTUALLY MAKES ══════════════════════════════ */
    const captured: (ExternalAiDisclosureDeclaration | undefined)[] = [];
    const originationDeps = () =>
      ({
        resolveTenant: async () => ctx,
        env: ENV,
        resolveDirectorEnabled: async () => true,
        selectTransport: () => ({
          transport: createLiveClaudeTransport({ apiKey: "sk-fake", spendBudget: createLiveSpendBudget(9), fetchImpl }),
          transportProvenance: "live",
        }),
        generate: async (request: ModelGenerationRequest, generationDeps: Parameters<typeof generateHebyModelAnswer>[1] = {}) => {
          captured.push(generationDeps.disclosure);
          return generateHebyModelAnswer(request, {
            ...generationDeps,
            resolveOperatorEnabled: async () => true,
            authorizeDisclosure: (d, o, m) => authorizeExternalAiDisclosure(d, o, m, deps),
            recordDisclosure: (e) => recordExternalAiDisclosureDecision(e, deps),
          });
        },
        agentIdentity: deps,
        candidates: { recipients: deps, artifacts: deps, organization: deps, observations: deps },
        proposal: deps,
        recordWork: deps,
        provenance: deps,
      }) as never;

    /* ═══ 4. STALE STATE — AVAILABLE was read; authority changed; the seam still refuses ════════ */
    const requests = async () => Number((await setup.query(`select count(*)::int n from heby_action_requests`)).rows[0]!.n);
    const permits = async () => Number((await setup.query(`select count(*)::int n from action_permits`)).rows[0]!.n);

    /* 4a · Mandate scope withdrawn after the read. The model may answer; filing is refused. */
    const rev3 = await seedAgentMandate(setup, org, agentId, deps, { tag: "wf1c", proposalScope: [], observedMandateRevision: rev2.mandateRevision });
    const r0 = await requests();
    const afterMandate = await originateAgentAction({ goal: GOAL }, originationDeps());
    assert.equal(afterMandate.status, "refused", `withdrawn mandate refuses: ${JSON.stringify(afterMandate)}`);
    assert.equal(await requests(), r0, "nothing filed after the mandate was withdrawn");
    assert.deepEqual(captured.at(-1)?.dataClasses, [...ORIGINATION_DECLARED_DATA_CLASSES], "the projection's declaration is origination's own");
    assert.equal(await reasonOf(), "proposal-scope-unavailable", "and the projection now says so");

    /* 4b · Mandate restored, then the tenant's EAI authorization withdrawn. Refused before the network. */
    await seedAgentMandate(setup, org, agentId, deps, { tag: "wf1d", observedMandateRevision: rev3.mandateRevision });
    assert.equal((await project()).status, "available");
    assert.equal(
      (await withdrawTenantExternalAiDataUse(ctx, { serviceScope: "anthropic/messages", accountRef: CONFIGURED_ANTHROPIC_ACCOUNT_REF, justification: "Withdrawing the WF-1 fixture's external AI data use.", observedRevision: 2 }, deps)).status,
      "written",
    );
    const fetchesBefore = fetches;
    const afterEai = await originateAgentAction({ goal: GOAL }, originationDeps());
    assert.deepEqual(afterEai, { status: "refused", reason: "model-unavailable" }, "withdrawn EAI refuses");
    assert.equal(fetches, fetchesBefore, "refused before the network");
    assert.equal(await requests(), r0, "nothing filed after EAI was withdrawn");
    assert.equal(await reasonOf(), "external-ai-not-authorized");

    /* 4c · Agent retired. Refused before anything. */
    assert.equal((await retireDurableAgentIdentity(ctx, { agentId }, deps)).status, "retired");
    const afterRetire = await originateAgentAction({ goal: GOAL }, originationDeps());
    assert.deepEqual(afterRetire, { status: "refused", reason: "durable-agent-identity-retired" });
    assert.equal(await reasonOf(), "agent-retired");

    /* ═══ 5. SEVERAL AGENTS IN SERVICE — no selection exists, so nothing is offered ═════════════ */
    for (const name of ["A", "B"]) {
      await setup.query(`insert into agents (tenant_id, name, human_owner_type, human_owner_id, created_by, created_by_type) values ($1,$2,'human',$3,$3,'human')`, [org.tenantId, name, org.userId]);
    }
    assert.equal(await reasonOf(), "multiple-agents");

    assert.equal(await requests(), r0, "WF-1 filed nothing across the whole run");
    assert.equal(await permits(), 0, "no permit");
    console.log(`PASS wf1-origination-recommendation availability-postgres (${calls} projections, 0 writes, 0 fetches)`);
  } finally {
    await setup.end().catch(() => {});
    await (handle as { dispose?: () => Promise<void> }).dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
