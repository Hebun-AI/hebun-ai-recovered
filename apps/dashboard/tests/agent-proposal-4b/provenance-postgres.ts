/*
 * AGENT-PROPOSAL-4B — agent-origination invocation provenance, against a REAL database.
 *
 * THE SUCCESS CONDITION:
 *
 *   "A future agent-originated proposal can be traced back to the exact model invocation that
 *    caused it — and every invocation that produced NO proposal says truthfully how far it got and
 *    why — while provenance can never veto a valid proposal, and nothing is authorized, permitted,
 *    executed or sent."
 *
 * No live provider: injected transports only. No network, no key, no cost.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { originateAgentAction } from "../../src/features/agent-origination/originate-action.server";
import {
  registerInvocation,
  finalizeInvocation,
  readInvocationProvenance,
} from "../../src/features/agent-origination/invocation-provenance.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { createWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { createExternalRecipient } from "../../src/features/external-recipients/write-external-recipients.server";
import { proposeSendAction } from "../../src/features/heby-action-inlet/send-proposal.server";
import type { ClaudeTransport } from "../../src/features/heby-model";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
/* Import from the SAME module the runtime narrows against: a different class makes
 * `instanceof` fail and every code normalizes to `unknown-provider-error`. */
import { ModelConnectivityError } from "../../src/features/heby-model";

const NOW = new Date("2026-08-28T10:00:00.000Z");
const OWNER_WORKSPACE = "operations";
const GOAL = "Ayşe is waiting on the quarterly summary. Get it in front of her for review.";

const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "300",
} as const;

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(s: Seeded, requestId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: s.tenantId,
    userId: s.userId,
    authIdentityId: s.authIdentityId,
    membershipId: s.membershipId,
    membershipVersion: 1,
    roleId: s.roleId,
    sessionContextId: "00000000-0000-4000-8000-000000000000",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId,
    authenticatedAt: NOW.toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ap4b_provenance");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);

  const dbDeps = { getDb: () => handle.db } as never;
  const writeDeps = { getDb: () => handle.db, now: () => NOW } as never;

  const returning = (text: string): ClaudeTransport => ({
    async send(request) {
      return {
        id: "req_ap4b_0001",
        model: request.model,
        content: [{ type: "text", text }],
        stopReason: "end_turn",
        usage: { inputTokens: 91, outputTokens: 12 },
      };
    },
  });
  const throwing = (code: string): ClaudeTransport => ({
    async send() {
      throw new ModelConnectivityError(code as never);
    },
  });

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-ap4b",
      email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-ap4b",
      email: "other@globex.test",
    })) as Seeded;
    const acmeCtx = contextFor(acme, "ap4b-acme");
    const globexCtx = contextFor(globex, "ap4b-globex");

    const recipient = await createExternalRecipient(
      acmeCtx,
      { displayName: "Ayşe Yılmaz", endpointKind: "email", endpointValue: "ayse@example.test" },
      writeDeps,
    );
    assert.equal(recipient.status, "created");
    const recipientRef = recipient.status === "created" ? recipient.recipient.recordRef : "";

    const draft = await createWorkArtifact(
      acmeCtx,
      { artifactType: "message-draft", title: "Quarterly summary", content: "Merhaba Ayşe," },
      OWNER_WORKSPACE,
      writeDeps,
    );
    assert.equal(draft.status, "created");
    const draftRef = draft.status === "created" ? draft.ref : "";

    const established = await createDurableAgentIdentity(acmeCtx, { name: "Heby" }, dbDeps);
    assert.equal(established.status, "established");

    const sendEnvelope = JSON.stringify({
      kind: "send",
      args: { recipientRef, draftRef },
      reason: "The draft answers the goal and Ayşe is a recorded recipient.",
    });

    const baseDeps = (transport: ClaudeTransport) =>
      ({
        resolveTenant: async () => acmeCtx,
        env: MODEL_ENV,
        resolveDirectorEnabled: async () => true,
        selectTransport: () => ({ transport, transportProvenance: "fake" }),
        agentIdentity: dbDeps,
        candidates: { recipients: dbDeps, artifacts: dbDeps },
        proposal: writeDeps,
        provenance: { getDb: () => handle.db, now: () => NOW },
      }) as never;

    const invocations = async () =>
      (await setup.query(`select * from heby_origination_invocations order by created_at`)).rows;

    /* ═══ 1. REGISTRATION FAILURE PREVENTS PROVIDER INVOCATION ═══ */
    {
      let dispatched = 0;
      const counting: ClaudeTransport = {
        async send(r) {
          dispatched += 1;
          return returning(sendEnvelope).send(r);
        },
      };
      const result = await originateAgentAction({ goal: GOAL }, {
        ...(baseDeps(counting) as object),
        /* Provenance unavailable: no db handle at all. */
        provenance: { getDb: () => null },
      } as never);
      assert.equal(result.status, "refused");
      assert.equal(dispatched, 0, "NO PROVIDER CALL when the invocation could not be registered");
      assert.equal((await invocations()).length, 0, "and nothing was recorded");
    }

    /* ═══ 2/3. PRE-DISPATCH REFUSAL — a registered row must not prove dispatch ═══ */
    {
      const result = await originateAgentAction(
        { goal: GOAL },
        baseDeps(throwing("rate-limited")),
      );
      assert.equal(result.status, "refused");
      const rows = await invocations();
      const row = rows[rows.length - 1]!;
      assert.equal(row.state, "not-dispatched", "a pre-dispatch gate spent nothing");
      assert.equal(row.failure_code, "rate-limited");
      assert.equal(row.provider, null, "no provider facts exist for a call that never went out");
      assert.equal(row.filing_outcome, "not-attempted");
      assert.notEqual(row.state, "registered", "the row was finalized, not left ambiguous");
    }

    /* ═══ 4. DISPATCHED PROVIDER FAILURE ═══ */
    {
      await originateAgentAction({ goal: GOAL }, baseDeps(throwing("provider-unavailable")));
      const rows = await invocations();
      const row = rows[rows.length - 1]!;
      assert.equal(row.state, "dispatch-failed", "this one DID go out");
      assert.equal(row.failure_code, "provider-unavailable");
      assert.equal(row.input_tokens, null, "a failed dispatch returned no usage");
    }

    /* ═══ 6. INVALID SELECTION — result kept, no proposal ═══ */
    {
      await originateAgentAction({ goal: GOAL }, baseDeps(returning("I have executed it.")));
      const rows = await invocations();
      const row = rows[rows.length - 1]!;
      assert.equal(row.state, "selection-invalid");
      assert.equal(row.provider, "claude", "the provider still returned, and that is recorded");
      assert.equal(row.provider_request_id, "req_ap4b_0001");
      assert.equal(row.input_tokens, 91);
      assert.equal(row.output_tokens, 12);
      assert.equal(row.filing_outcome, "not-attempted");
    }

    /* ═══ 7. NO-ACTION — a correct answer, distinct from an invalid one ═══ */
    {
      await originateAgentAction(
        { goal: GOAL },
        baseDeps(returning(JSON.stringify({ kind: "none", reason: "nothing matched" }))),
      );
      const rows = await invocations();
      const row = rows[rows.length - 1]!;
      assert.equal(row.state, "no-action", "declining is not a failure");
      assert.equal(row.provider, "claude");
      assert.equal(row.filing_outcome, "not-attempted");
    }

    /* ═══ 8/9/12. VALID SELECTION → PROPOSAL, CARRYING THE EXACT INVOCATION UUID ═══ */
    let filedInvocationId = "";
    let filedRequestId = "";
    {
      const result = await originateAgentAction({ goal: GOAL }, baseDeps(returning(sendEnvelope)));
      assert.equal(result.status, "proposed", "a valid selection files a proposal");

      const rows = await invocations();
      const row = rows[rows.length - 1]!;
      filedInvocationId = row.id as string;
      assert.equal(row.state, "selection-valid");
      assert.equal(row.filing_outcome, "proposed");
      assert.equal(row.filing_refusal, null);

      const proposals = await setup.query(
        `select id, origination_invocation_id as "invocationId", status,
                proposed_by_actor_type as "actorType"
           from heby_action_requests`,
      );
      assert.equal(proposals.rowCount, 1, "exactly one proposal");
      filedRequestId = proposals.rows[0]!.id as string;
      assert.equal(
        proposals.rows[0]!.invocationId,
        filedInvocationId,
        "THE PROPOSAL CARRIES THE EXACT INVOCATION UUID",
      );
      assert.equal(proposals.rows[0]!.status, "pending");
      assert.equal(proposals.rows[0]!.actorType, "agent");

      /* The read seam resolves the causal link FROM THE PROPOSAL SIDE. */
      const view = await readInvocationProvenance(acmeCtx, filedInvocationId, dbDeps);
      assert.equal(view?.causedActionRequestId, filedRequestId);
      assert.equal(view?.filingOutcome, "proposed");
    }

    /* ═══ 10. DUPLICATE REFUSAL — the released reason is recorded verbatim ═══ */
    {
      const result = await originateAgentAction({ goal: GOAL }, baseDeps(returning(sendEnvelope)));
      assert.equal(result.status, "refused");
      const rows = await invocations();
      const row = rows[rows.length - 1]!;
      assert.equal(row.state, "selection-valid", "the MODEL side succeeded");
      assert.equal(row.filing_outcome, "refused", "the PROPOSAL side refused — two separate axes");
      assert.equal(
        row.filing_refusal,
        "already-pending",
        "a duplicate is distinguishable from every other refusal",
      );
      const proposals = await setup.query(`select count(*)::int n from heby_action_requests`);
      assert.equal(proposals.rows[0]!.n, 1, "no second proposal was created");
    }

    /* ═══ 13. A HUMAN PROPOSAL CARRIES NO INVOCATION ═══ */
    {
      const draft2 = await createWorkArtifact(
        acmeCtx,
        { artifactType: "message-draft", title: "Second note", content: "Another draft" },
        OWNER_WORKSPACE,
        writeDeps,
      );
      assert.equal(draft2.status, "created");
      const humanFiled = await proposeSendAction(
        acmeCtx,
        { recipientRef, draftRef: draft2.status === "created" ? draft2.ref : "" },
        writeDeps,
      );
      assert.equal(humanFiled.status, "proposed");
      const human = await setup.query(
        `select origination_invocation_id as "invocationId", proposed_by_actor_type as "actorType"
           from heby_action_requests where proposed_by_actor_type = 'human'`,
      );
      assert.equal(human.rowCount, 1);
      assert.equal(
        human.rows[0]!.invocationId,
        null,
        "a human dictated the act, so no model invocation caused it",
      );
    }

    /* ═══ 15. TENANT ISOLATION ═══ */
    {
      const foreign = await readInvocationProvenance(globexCtx, filedInvocationId, dbDeps);
      assert.equal(foreign, null, "another tenant cannot read this invocation");

      const finalized = await finalizeInvocation(
        globexCtx,
        { invocationId: filedInvocationId, state: "no-action", filingOutcome: "not-attempted" },
        dbDeps,
      );
      const after = await setup.query(
        `select state from heby_origination_invocations where id = $1`,
        [filedInvocationId],
      );
      assert.equal(
        after.rows[0]!.state,
        "selection-valid",
        "a foreign tenant's finalize changed nothing",
      );
      void finalized;
    }

    /* ═══ 21. IDEMPOTENCY — finalizing twice creates no second fact ═══ */
    {
      const before = (await invocations()).length;
      await finalizeInvocation(
        acmeCtx,
        {
          invocationId: filedInvocationId,
          state: "selection-valid",
          filingOutcome: "proposed",
        },
        dbDeps,
      );
      assert.equal((await invocations()).length, before, "an UPDATE by id adds no row");
    }

    /* ═══ CRASH SEMANTICS — a registered row means UNKNOWN, never "nothing happened" ═══ */
    {
      const stranded = await registerInvocation(acmeCtx, { transport: "fake" }, dbDeps);
      assert.ok(stranded, "registration returns an id");
      const row = await setup.query(
        `select state, finalized_at as "finalizedAt", filing_outcome as "filingOutcome"
           from heby_origination_invocations where id = $1`,
        [stranded],
      );
      assert.equal(row.rows[0]!.state, "registered");
      assert.equal(row.rows[0]!.finalizedAt, null, "an unfinalized row is visibly unfinalized");
      assert.equal(row.rows[0]!.filingOutcome, "not-attempted");
    }

    /* ═══ 16. NO SECRET, NO PROMPT, NO RESPONSE ANYWHERE IN THE TABLE ═══ */
    {
      const dump = JSON.stringify(await invocations());
      for (const forbidden of [
        GOAL,
        "Merhaba",
        "ayse@example.test",
        "sk-",
        "Authorization",
        "I have executed it.",
        "nothing matched",
      ]) {
        assert.equal(
          dump.includes(forbidden),
          false,
          `provenance must not contain ${JSON.stringify(forbidden)}`,
        );
      }
    }

    /* ═══ 17-20. NOTHING WAS AUTHORIZED, PERMITTED, EXECUTED OR SENT ═══ */
    {
      const counts = await setup.query<{
        permits: number;
        decisions: number;
        attempts: number;
        approved: number;
      }>(
        `select (select count(*)::int from action_permits) as permits,
                (select count(*)::int from decision_records) as decisions,
                (select count(*)::int from action_execution_attempts) as attempts,
                (select count(*)::int from heby_action_requests where approved_at is not null) as approved`,
      );
      const c = counts.rows[0]!;
      assert.equal(c.permits, 0, "NO PERMIT");
      assert.equal(c.decisions, 0, "NO Governance decision");
      assert.equal(c.attempts, 0, "NOTHING was executed");
      assert.equal(c.approved, 0, "PROPOSED is not APPROVED");
    }
  } finally {
    await setup.end().catch(() => {});
    /* Close the pool BEFORE the drop: a surviving connection surfaces the drop as
     * "terminating connection due to administrator command", which is a teardown artefact and not
     * a test result. */
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }

  console.log("PASS agent-proposal-4b invocation provenance (postgres)");
}

void main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
