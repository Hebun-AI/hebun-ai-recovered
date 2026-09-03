/*
 * AGENT-PROPOSAL-1 — a durable agent originates a bounded proposal, against a REAL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A human states a GOAL, the durable agent selects the action and its arguments from a
 *    server-built set, and the row that lands says `agent` and names the REAL durable agent —
 *    while creating no permit, no decision, no execution attempt, no membership and no credential,
 *    and while the human `/send` command still records the human."
 *
 * The last clause is half the phase. Two paths must stay truthful at once; a suite that only
 * proved the new one would pass in a world where the old one had quietly become a lie.
 *
 * No live provider: the transport is a fake that returns exactly the text each case needs, through
 * the REAL generator and the REAL parse boundary. No network, no key, no cost.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { originateAgentAction } from "../../src/features/agent-origination/originate-action.server";
import { buildOriginationCandidates } from "../../src/features/agent-origination/candidate-set.server";
import { proposeSendAction } from "../../src/features/heby-action-inlet/send-proposal.server";
import { proposeAgentOriginatedSendAction } from "../../src/features/heby-action-inlet/send-proposal.server";
import {
  resolveAgentProposer,
  isAgentProposer,
  type AgentProposer,
} from "../../src/features/action-authorization/agent-proposer.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { seedAgentMandate } from "../helpers/agent-mandate-seed";
import { retireDurableAgentIdentity } from "../../src/features/agent-identity/retire-durable-agent-identity.server";
import { createWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { createExternalRecipient } from "../../src/features/external-recipients/write-external-recipients.server";
import type { ClaudeTransport } from "../../src/features/heby-model";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-08-27T10:00:00.000Z");
const OWNER_WORKSPACE = "operations";
const GOAL = "Ayşe is waiting on the quarterly summary. Get it in front of the Director for sign-off.";

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

function contextFor(seeded: Seeded, requestId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId: "00000000-0000-4000-8000-000000000000",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId,
    authenticatedAt: NOW.toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ap1_origination");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);

  const dbDeps = { getDb: () => handle.db } as never;
  const writeDeps = { getDb: () => handle.db, now: () => NOW } as never;

  /** A transport that returns exactly one text, through the REAL generator and parser. */
  const transportReturning = (text: string): ClaudeTransport => ({
    async send(request) {
      return {
        id: "req_ap1_fake",
        model: request.model,
        content: [{ type: "text", text }],
        stopReason: "end_turn",
        usage: { inputTokens: 90, outputTokens: 30 },
      };
    },
  });

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-ap1",
      email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-ap1",
      email: "other@globex.test",
    })) as Seeded;
    const acmeCtx = contextFor(acme, "ap1-acme");
    const globexCtx = contextFor(globex, "ap1-globex");

    /* ── Referents both tenants can be tested against ─────────────────────── */
    const recipient = await createExternalRecipient(
      acmeCtx,
      { displayName: "Ayşe Yılmaz", endpointKind: "email", endpointValue: "ayse@example.test" },
      writeDeps,
    );
    assert.equal(recipient.status, "created");
    const recipientRef = recipient.status === "created" ? recipient.recipient.recordRef : "";

    const draft = await createWorkArtifact(
      acmeCtx,
      {
        artifactType: "message-draft",
        title: "Quarterly summary",
        content: "Merhaba Ayşe,\nHere is the quarterly summary.",
      },
      OWNER_WORKSPACE,
      writeDeps,
    );
    assert.equal(draft.status, "created");
    const draftRef = draft.status === "created" ? draft.ref : "";

    const originationDeps = (text: string) => ({
      resolveTenant: async () => acmeCtx,
      env: MODEL_ENV,
      resolveDirectorEnabled: async () => true,
      selectTransport: () => ({ transport: transportReturning(text), transportProvenance: "fake" }),
      newCorrelationId: () => "corr-ap1",
      agentIdentity: dbDeps,
      candidates: { recipients: dbDeps, artifacts: dbDeps },
      proposal: writeDeps,
    }) as never;

    const sendEnvelope = JSON.stringify({
      kind: "send",
      args: { recipientRef, draftRef },
      reason: "The quarterly summary draft answers the goal and Ayşe is a recorded recipient.",
    });

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. WITHOUT A DURABLE AGENT, NOTHING CAN BE ORIGINATED — AND NO MODEL IS CALLED.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      let transportCalls = 0;
      const counting: ClaudeTransport = {
        async send(request) {
          transportCalls += 1;
          return transportReturning(sendEnvelope).send(request);
        },
      };
      const result = await originateAgentAction(
        { goal: GOAL },
        {
          resolveTenant: async () => acmeCtx,
          env: MODEL_ENV,
          resolveDirectorEnabled: async () => true,
          selectTransport: () => ({ transport: counting, transportProvenance: "fake" }),
          agentIdentity: dbDeps,
          candidates: { recipients: dbDeps, artifacts: dbDeps },
          proposal: writeDeps,
        } as never,
      );
      assert.equal(
        result.status,
        "refused",
        "no durable agent means nothing can originate — never a human fallback",
      );
      assert.equal(
        result.status === "refused" ? result.reason : "",
        "no-durable-agent-identity",
      );
      assert.equal(
        transportCalls,
        0,
        "AND NO PROVIDER CALL WAS SPENT — the proposer is resolved before the model is asked",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. WITH A DURABLE AGENT: A HUMAN GOAL BECOMES AN AGENT-ORIGINATED PROPOSAL.
     * ═════════════════════════════════════════════════════════════════════ */
    const established = await createDurableAgentIdentity(acmeCtx, { name: "Heby" }, dbDeps);
    assert.equal(established.status, "established");
    const agentId = established.status === "established" ? established.identity.agentId : "";
    assert.notEqual(agentId, acme.userId);

    /*
     * AMA-2 — THE CEILING IS NOW A PRECONDITION OF PROPOSING AT ALL.
     *
     * Existing is no longer enough. The agent-originated proposal writer refuses `no-agent-mandate`
     * until the organization has recorded what this agent is FOR, so this suite must bound it
     * before the origination it was written to prove can happen. Nothing below is weakened: what
     * this file asserts about attribution, containment and the human path is unchanged, and the
     * mandate admits exactly the released originable vocabulary — it subtracts nothing here.
     */
    await seedAgentMandate(setup, acme, agentId, dbDeps, { tag: "ap1a", now: NOW });

    /*
     * THE PRECONDITION HAS A FOOTPRINT, AND SECTION 3 NOW MEASURES A DELTA INSTEAD OF A ZERO.
     *
     * Section 3 asserted GLOBAL zeros for permits, decisions, Governance sessions and execution
     * attempts. That was true only while nothing in this suite wrote them. Recording a mandate is
     * a real human Governance act — it opens a Governance session and writes decisions — so those
     * tables are legitimately non-empty before origination is even attempted.
     *
     * The CLAIM is unchanged: ORIGINATION CREATED NONE OF THESE. It is now measured across the
     * proposal rather than against an empty database, which is what the claim always meant and is
     * strictly harder to satisfy: a global zero would also pass in a world where origination wrote
     * a permit and something else had deleted it.
     */
    const consequenceCounts = async (): Promise<{
      permits: number;
      decisions: number;
      attempts: number;
      memberships: number;
      credentials: number;
      sessions: number;
      governance: number;
    }> => {
      const r = await setup.query<{
        permits: number;
        decisions: number;
        attempts: number;
        memberships: number;
        credentials: number;
        sessions: number;
        governance: number;
      }>(
        `select (select count(*)::int from action_permits) as permits,
                (select count(*)::int from decision_records) as decisions,
                (select count(*)::int from action_execution_attempts) as attempts,
                (select count(*)::int from memberships where user_id = $1) as memberships,
                (select count(*)::int from auth_credentials) as credentials,
                (select count(*)::int from user_session_contexts) as sessions,
                (select count(*)::int from governance_sessions) as governance`,
        [agentId],
      );
      return r.rows[0]!;
    };
    const beforeOrigination = await consequenceCounts();
    assert.equal(beforeOrigination.permits, 0, "bounding an agent minted NO permit");
    assert.equal(beforeOrigination.attempts, 0, "bounding an agent executed NOTHING");
    assert.equal(beforeOrigination.memberships, 0, "bounding an agent granted it no membership");

    let agentRequestId = "";
    {
      /* The candidate set is server-built and carries NO address. */
      const candidates = await buildOriginationCandidates(acmeCtx, {
        recipients: dbDeps,
        artifacts: dbDeps,
      });
      assert.equal(candidates.recipients.length, 1);
      assert.equal(candidates.drafts.length, 1);
      assert.equal(
        JSON.stringify(candidates).includes("ayse@example.test"),
        false,
        "THE RAW ADDRESS NEVER ENTERS THE AGENT'S CHOICE SPACE",
      );

      const result = await originateAgentAction({ goal: GOAL }, originationDeps(sendEnvelope));
      assert.equal(
        result.status,
        "proposed",
        "a human goal, an agent selection, and a filed proposal",
      );
      if (result.status !== "proposed") throw new Error("unreachable");
      agentRequestId = result.proposal.receipt.requestId;
      assert.equal(result.proposal.receipt.status, "pending-review", "it STOPS at pending review");

      const row = await setup.query<{
        proposerType: string;
        proposerId: string;
        status: string;
        createdBy: string;
        createdByType: string;
        actionKind: string;
      }>(
        `select proposed_by_actor_type as "proposerType", proposed_by_actor_id as "proposerId",
                status, created_by as "createdBy", created_by_type as "createdByType",
                action_kind as "actionKind"
           from heby_action_requests where id = $1`,
        [agentRequestId],
      );
      const filed = row.rows[0]!;
      assert.equal(filed.proposerType, "agent", "THE PROPOSER IS AN AGENT");
      assert.equal(filed.proposerId, agentId, "AND IT IS THE REAL DURABLE AGENT IDENTITY");
      assert.notEqual(
        filed.proposerId,
        acme.userId,
        "THE HUMAN USER ID IS NEVER THE AGENT PROPOSER",
      );
      assert.equal(filed.status, "pending", "the proposal begins, and stays, pending");
      assert.equal(filed.actionKind, "send-external-communication");
      /* The human's authenticated request is what caused the row. Both facts are recorded. */
      assert.equal(filed.createdBy, acme.userId);
      assert.equal(filed.createdByType, "human");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. THE CONSEQUENCE FIREWALL — origination created NOTHING else.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const c = await consequenceCounts();
      const b = beforeOrigination;
      assert.equal(c.permits, b.permits, "NO PERMIT was issued");
      assert.equal(c.decisions, b.decisions, "NO Governance decision was recorded");
      assert.equal(c.attempts, b.attempts, "NOTHING was executed");
      assert.equal(c.memberships, b.memberships, "the agent holds no membership");
      /* `auth_credentials` keys on `auth_identity_id`, and an agent HAS no auth identity — so the
       * honest assertion is that this phase minted no credential for anybody at all. */
      assert.equal(c.credentials, b.credentials, "no credential was issued to anybody");
      assert.equal(c.sessions, b.sessions, "the agent holds no session");
      assert.equal(c.governance, b.governance, "no Governance session was opened");
      /* And the absolute claims that survive a mandate existing, stated absolutely. */
      assert.equal(c.permits, 0, "no permit exists at all");
      assert.equal(c.attempts, 0, "nothing has been executed at all");
      assert.equal(c.credentials, 0, "no credential exists at all");

      /* The request is still pending — nothing auto-advanced it. */
      const still = await setup.query<{ status: string; approvedAt: string | null }>(
        `select status, approved_at as "approvedAt" from heby_action_requests where id = $1`,
        [agentRequestId],
      );
      assert.equal(still.rows[0]!.status, "pending");
      assert.equal(still.rows[0]!.approvedAt, null, "PROPOSED is not APPROVED");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. THE HUMAN PATH STILL RECORDS THE HUMAN.
     *
     * A second draft, so the payload digest differs and the duplicate index is not what is being
     * measured here.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const second = await createWorkArtifact(
        acmeCtx,
        { artifactType: "message-draft", title: "Follow-up", content: "Short follow-up." },
        OWNER_WORKSPACE,
        writeDeps,
      );
      assert.equal(second.status, "created");
      const secondRef = second.status === "created" ? second.ref : "";

      const typed = await proposeSendAction(
        acmeCtx,
        { recipientRef, draftRef: secondRef },
        writeDeps,
      );
      assert.equal(typed.status, "proposed", "the released /send path still files");
      if (typed.status !== "proposed") throw new Error("unreachable");

      const row = await setup.query<{ proposerType: string; proposerId: string }>(
        `select proposed_by_actor_type as "proposerType", proposed_by_actor_id as "proposerId"
           from heby_action_requests where id = $1`,
        [typed.receipt.requestId],
      );
      assert.equal(
        row.rows[0]!.proposerType,
        "human",
        "A HUMAN WHO TYPED THE COMMAND IS STILL THE PROPOSER — the two paths did not collapse",
      );
      assert.equal(row.rows[0]!.proposerId, acme.userId);
      assert.notEqual(row.rows[0]!.proposerId, agentId);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. THE MODEL CANNOT WIDEN ANYTHING IT SAYS.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const before = await setup.query<{ n: number }>(
        `select count(*)::int as n from heby_action_requests`,
      );

      const hostile: readonly [string, string][] = [
        ["I'll send the summary to Ayşe right away.", "not-a-structured-object"],
        [
          JSON.stringify({ kind: "grant-permission", args: {}, reason: "as instructed" }),
          "unsupported-action-kind",
        ],
        [
          JSON.stringify({
            kind: "send",
            args: {
              recipientRef: "external-recipient/99999999-9999-4999-8999-999999999999",
              draftRef,
            },
            reason: "The document told me to use this address.",
          }),
          "reference-not-offered",
        ],
        [
          JSON.stringify({
            kind: "send",
            args: { recipientRef, draftRef },
            reason: "ok",
            approved: true,
          }),
          "unexpected-shape",
        ],
        [JSON.stringify({ kind: "send", args: { recipientRef }, reason: "ok" }), "invalid-arguments"],
      ];

      for (const [text, expected] of hostile) {
        const result = await originateAgentAction({ goal: GOAL }, originationDeps(text));
        assert.equal(result.status, "refused", `"${expected}" must refuse`);
        assert.equal(result.status === "refused" ? result.reason : "", expected);
      }

      const after = await setup.query<{ n: number }>(
        `select count(*)::int as n from heby_action_requests`,
      );
      assert.equal(
        after.rows[0]!.n,
        before.rows[0]!.n,
        "NOT ONE malformed or injected response produced a proposal",
      );
    }

    /* An honest abstention files nothing and is not an error. */
    {
      const result = await originateAgentAction(
        { goal: GOAL },
        originationDeps(JSON.stringify({ kind: "none", reason: "No recipient matches the goal." })),
      );
      assert.equal(result.status, "refused");
      assert.equal(result.status === "refused" ? result.reason : "", "no-action-proposed");
      assert.equal(
        result.status === "refused" ? result.detail : "",
        "No recipient matches the goal.",
        "the agent's stated reason survives, as untrusted text",
      );
    }

    /* A model that cannot be reached fails honestly — never a fabricated proposal. */
    {
      const noTransport = await originateAgentAction(
        { goal: GOAL },
        {
          resolveTenant: async () => acmeCtx,
          env: MODEL_ENV,
          resolveDirectorEnabled: async () => true,
          selectTransport: () => ({}),
          agentIdentity: dbDeps,
          candidates: { recipients: dbDeps, artifacts: dbDeps },
          proposal: writeDeps,
        } as never,
      );
      assert.equal(noTransport.status, "refused");
      assert.equal(
        noTransport.status === "refused" ? noTransport.reason : "",
        "model-unavailable",
      );

      const directorOff = await originateAgentAction(
        { goal: GOAL },
        {
          ...(originationDeps(sendEnvelope) as Record<string, unknown>),
          resolveDirectorEnabled: async () => false,
        } as never,
      );
      assert.equal(directorOff.status, "refused");
      assert.equal(
        directorOff.status === "refused" ? directorOff.reason : "",
        "model-unavailable",
        "the Director's kill switch stops origination like it stops an answer",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. A FORGED PROPOSER CANNOT PROPOSE.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const forged = { agentId } as unknown as AgentProposer;
      assert.equal(isAgentProposer(forged), false, "an unbranded value is not a proposer");

      const third = await createWorkArtifact(
        acmeCtx,
        { artifactType: "message-draft", title: "Third", content: "Third draft." },
        OWNER_WORKSPACE,
        writeDeps,
      );
      const thirdRef = third.status === "created" ? third.ref : "";

      const filed = await proposeAgentOriginatedSendAction(
        acmeCtx,
        { recipientRef, draftRef: thirdRef },
        forged,
        writeDeps,
      );
      assert.equal(
        filed.status,
        "refused",
        "A CLIENT-SUPPLIED AGENT ID CANNOT BECOME A PROPOSER, even when the uuid is real",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. ANOTHER ORGANIZATION'S AGENT IS UNREACHABLE.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const foreign = await resolveAgentProposer(globexCtx, dbDeps);
      assert.equal(foreign.status, "refused", "Globex owns no agent");
      assert.equal(
        foreign.status === "refused" ? foreign.reason : "",
        "no-durable-agent-identity",
      );
      assert.equal(
        JSON.stringify(foreign).includes(agentId),
        false,
        "and Acme's agent id never appears in another tenant's answer",
      );
      assert.equal(
        resolveAgentProposer.length,
        1,
        "the resolver requires a tenant and nothing else — never an agent id",
      );

      /* Globex's own origination sees none of Acme's candidates. */
      const foreignCandidates = await buildOriginationCandidates(globexCtx, {
        recipients: dbDeps,
        artifacts: dbDeps,
      });
      assert.deepEqual(foreignCandidates.recipients, [], "no cross-tenant recipient");
      assert.deepEqual(foreignCandidates.drafts, [], "no cross-tenant draft");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * AMA-4. THE CEILING THAT REFUSED MUST SURVIVE INTO THE DURABLE RECORD.
     *
     * `heby_origination_invocations.filing_refusal` is the only durable trace a refused
     * origination leaves, and it recorded `not-authorizable` for all three mandate states —
     * because the inlet answers that for every writer refusal its own vocabulary cannot name, and
     * this seam stored the inlet's reason rather than the authority's.
     *
     * Production proved the cost: an out-of-mandate refusal was indistinguishable from an
     * unreachable authority and from an unbounded agent, and the cause had to be reconstructed by
     * elimination. The assertion is on the ROW, because the row is what a later reader gets.
     *
     * PLACED HERE, on purpose. It withdraws the ceiling this suite established, so it must come
     * after every section that needs a working one — and BEFORE section 8, which retires the agent
     * that a mandate can no longer be recorded against.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      await seedAgentMandate(setup, acme, agentId, dbDeps, {
        tag: "ap1-withdrawn",
        now: NOW,
        proposalScope: [],
        observedMandateRevision: 1,
      });

      const requestsBefore = (
        await setup.query<{ n: number }>(`select count(*)::int as n from heby_action_requests`)
      ).rows[0]!.n;

      const refusedByCeiling = await originateAgentAction(
        { goal: GOAL },
        originationDeps(sendEnvelope),
      );
      assert.equal(
        refusedByCeiling.status,
        "refused",
        "an empty ceiling admits nothing, so origination is refused",
      );
      assert.equal(
        refusedByCeiling.status === "refused" ? refusedByCeiling.reason : "",
        "proposal-refused",
        "the origination reason is unchanged — this repaired a detail, not a vocabulary",
      );
      assert.equal(
        refusedByCeiling.status === "refused" ? refusedByCeiling.detail : "",
        "action-outside-agent-mandate",
        "and the detail now names the CEILING rather than the inlet's widened answer",
      );

      const invocation = await setup.query<{ refusal: string | null; outcome: string }>(
        `select filing_refusal as "refusal", filing_outcome as "outcome"
           from heby_origination_invocations
          order by created_at desc, id desc limit 1`,
      );
      assert.equal(invocation.rows[0]!.outcome, "refused");
      assert.equal(
        invocation.rows[0]!.refusal,
        "action-outside-agent-mandate",
        "THE DURABLE RECORD NAMES THE CEILING — no reconstruction by elimination",
      );

      assert.equal(
        (await setup.query<{ n: number }>(`select count(*)::int as n from heby_action_requests`))
          .rows[0]!.n,
        requestsBefore,
        "and the refused origination still wrote no request row",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. A RETIRED AGENT ORIGINATES NOTHING.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      /*
       * A FRESH DRAFT, so nothing but retirement can stop this.
       *
       * Reusing the first draft made the duplicate-proposal index the thing that refused, which
       * meant this section would have passed even with the retirement guard removed — a bite proof
       * measured exactly that and it is the reason this draft exists. Defence in depth is real, but
       * a test that cannot tell which defence fired is not proving the one it names.
       */
      const fresh = await createWorkArtifact(
        acmeCtx,
        { artifactType: "message-draft", title: "Post-retirement", content: "Fresh bytes." },
        OWNER_WORKSPACE,
        writeDeps,
      );
      assert.equal(fresh.status, "created");
      const freshEnvelope = JSON.stringify({
        kind: "send",
        args: { recipientRef, draftRef: fresh.status === "created" ? fresh.ref : "" },
        reason: "A different draft, so only the agent's lifecycle can refuse this.",
      });

      const retired = await retireDurableAgentIdentity(acmeCtx, { agentId }, dbDeps);
      assert.equal(retired.status, "retired");

      const result = await originateAgentAction({ goal: GOAL }, originationDeps(freshEnvelope));
      assert.equal(
        result.status,
        "refused",
        "A RETIRED AGENT ORIGINATES NOTHING — proposing at all is the failure",
      );
      assert.equal(
        result.status === "refused" ? result.reason : "",
        "durable-agent-identity-retired",
        "A RETIRED AGENT ORIGINATES NOTHING — and not because something else happened to refuse",
      );

      /* What it proposed while serving is untouched. Retirement is not erasure. */
      const kept = await setup.query<{ n: number }>(
        `select count(*)::int as n from heby_action_requests where proposed_by_actor_id = $1`,
        [agentId],
      );
      assert.equal(kept.rows[0]!.n, 1, "the proposal it originated while in service survives");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 9. THE HUMAN-ONLY CHECKS, AS THE MIGRATED DATABASE HOLDS THEM.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const checks = await setup.query<{ conname: string }>(
        `select conname from pg_constraint
          where contype = 'c' and pg_get_constraintdef(oid) ilike '%human%'
          order by conname`,
      );
      assert.deepEqual(
        checks.rows.map((r) => r.conname),
        [
          "action_permits_human_authorizer_chk",
          /*
           * SIA-3. The census GREW; nothing in it was widened — which is what this assertion has
           * always been about. A new table constrained its OWN AUTHOR to `human`, the strictest
           * direction, so that an agent cannot file an improvement hypothesis about itself.
           *
           * Extending the enumeration is the strict repair. Loosening it to "at least seven" would
           * be the weak one: it would let a future phase DELETE a released CHECK and still pass.
           */
          "agent_improvement_hypotheses_human_author_chk",
          /*
           * AMA-1. The census GREW AGAIN, in the same strict direction and for the same reason.
           * `agent_mandates` constrains its own ESTABLISHER to `human`, so an agent cannot
           * establish — or widen — its own mandate, and that refusal is PostgreSQL's rather than
           * the writer's.
           */
          "agent_mandates_human_establisher_chk",
          "decision_records_bootstrap_human_chk",
          /*
           * OSA-1. `departments` constrains its own OWNER to `human`: an agent cannot be recorded
           * as accountable for part of a human organization, and PostgreSQL refuses it.
           */
          "departments_human_owner_chk",
          "heby_action_requests_human_approver_chk",
          /*
           * PBGA-1. The census GREW AGAIN, in the same strict direction. `heby_action_requests`
           * constrains who may declare ORGANIZATIONAL PURPOSE to `human`: an agent may propose an
           * act and may not say what the organization is doing it for.
           */
          "heby_action_requests_human_purpose_declarer_chk",
          "identity_enrollment_requests_human_approver_chk",
          "knowledge_external_references_human_declarer_chk",
          "knowledge_external_references_human_withdrawer_chk",
          "membership_authorizations_human_authorizer_chk",
          /*
           * WORK-1. The census GREW AGAIN, in the same strict direction. `work_items` constrains
           * its own ACCOUNTABLE PARTY to `human`: an agent cannot be accountable for a unit of the
           * organization's work, and PostgreSQL refuses it — the same guarantee `departments`
           * makes about ownership, made about work.
           */
          /* WEV-1's own human-only CHECK, absent from these censuses since it shipped: a work
           * evidence reference may only be DECLARED by a human. Restored here so the census matches
           * the migrated database it reads. */
          "work_evidence_references_human_declarer_chk",
          "work_items_human_accountable_chk",
        ],
        "the twelve human-only CHECKs are enforced by the database, and this phase widened none of them",
      );

      /* And the approver CHECK really does refuse an agent, on the agent's own proposal. */
      await assert.rejects(
        setup.query(
          `update heby_action_requests set approved_by_actor_type = 'agent' where id = $1`,
          [agentRequestId],
        ),
        /heby_action_requests_human_approver_chk/,
        "AN AGENT CANNOT BE RECORDED AS THE APPROVER OF ITS OWN PROPOSAL",
      );
    }

    console.log("PASS agent-proposal-1 origination (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
