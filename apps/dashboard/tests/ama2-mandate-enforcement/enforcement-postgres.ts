/*
 * AMA-2 — THE MANDATE IS A REAL CONSTRAINT ON AGENT-ORIGINATED PROPOSALS.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "An agent-originated proposal proceeds ONLY when the mandate authority answered, a mandate
 *    exists, and the requested action kind is inside its proposal scope. Each of the three failures
 *    is a DIFFERENT named refusal, none of them collapses into another, and every one of them
 *    leaves NO row in `heby_action_requests`. Passing the ceiling authorizes nothing — the proposal
 *    is still pending, no permit exists, nothing executed, and no Governance decision was taken
 *    about the act. The HUMAN path is untouched: a person may still propose the very act the
 *    agent's mandate refuses. And enforcing a bound never changes one — `agent_mandates` is
 *    byte-identical before and after."
 *
 * The pins:
 *
 *   MANDATE AVAILABLE  != MANDATE EXISTS
 *   NO MANDATE         != UNLIMITED MANDATE
 *   UNAVAILABLE        != NO MANDATE
 *   IN MANDATE         != AUTHORIZED
 *   PROPOSAL REFUSED   != GOVERNANCE REJECTION
 *
 * Every row is produced by the released writer that owns it. No adapter, no network, no model, no
 * credential. Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedAgentMandate } from "../helpers/agent-mandate-seed";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { retireDurableAgentIdentity } from "../../src/features/agent-identity/retire-durable-agent-identity.server";
import { createWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { createExternalRecipient } from "../../src/features/external-recipients/write-external-recipients.server";
import { establishAgentMandate } from "../../src/features/agent-mandate/establish-agent-mandate.server";
import { readEffectiveAgentMandate } from "../../src/features/agent-mandate/read-agent-mandate.server";
import {
  resolveAgentProposer,
  type AgentProposer,
} from "../../src/features/action-authorization/agent-proposer.server";
import {
  recordActionRequest,
  recordAgentOriginatedActionRequest,
} from "../../src/features/action-authorization/record-action-request.server";
import {
  proposeAgentOriginatedSendAction,
  proposeSendAction,
} from "../../src/features/heby-action-inlet/send-proposal.server";
import { prepareAction } from "../../src/features/heby-actions/action-preparer";
import type { HebyPreparedAction } from "../../src/features/heby-actions/contracts";
import { SEND_ACTION_KIND } from "../../src/features/heby-action-inlet/contracts";
import { AGENT_ORIGINABLE_ACTION_KINDS } from "../../src/features/agent-origination/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-08-31T09:00:00.000Z");

const OWNER_WORKSPACE = "operations";

const WITHDRAWAL_JUSTIFICATION =
  "I am withdrawing this agent from proposing while we review how it has been performing.";
const WITHDRAWAL_PURPOSE =
  "This agent is withdrawn from proposing anything while we review how it has been performing.";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
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
    authenticatedAt: NOW.toISOString(),
  });
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
    [
      seeded.authIdentityId,
      tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a"),
      seeded.userId,
      seeded.tenantId,
      seeded.membershipId,
    ],
  );
  return row.rows[0]!.id;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ama2_enforcement");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);

  const dbDeps = { getDb: () => handle.db } as never;
  const writeDeps = { getDb: () => handle.db, now: () => NOW } as never;
  /** A control plane that is not configured at all. The mandate authority cannot LOOK. */
  const noDbDeps = { getDb: () => null, now: () => NOW } as never;

  /** Every request row in the whole database, so "no row was written" is measured, not assumed. */
  const requestRows = async (): Promise<number> =>
    (
      await setup.query<{ n: number }>(
        `select count(*)::int as n from heby_action_requests`,
      )
    ).rows[0]!.n;

  /**
   * The mandate table, as a stable fingerprint. Enforcing a ceiling must never touch one, and this
   * is how that is measured rather than promised.
   */
  const mandateFingerprint = async (): Promise<string> =>
    JSON.stringify(
      (
        await setup.query(
          `select id, tenant_id, agent_id, mandate_revision, purpose, proposal_scope,
                  effective_from, governance_decision_id, governance_session_id,
                  established_by_actor_id, established_by_actor_type, supersedes_mandate_id
             from agent_mandates order by tenant_id, agent_id, mandate_revision`,
        )
      ).rows,
    );

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-ama2",
      email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-ama2",
      email: "director@globex.test",
    })) as Seeded;
    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "ama2-acme");
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "bbbb"), "ama2-globex");

    /* ── Referents, in both tenants ────────────────────────────────────────── */
    const recipient = await createExternalRecipient(
      acmeCtx,
      { displayName: "Ayşe Yılmaz", endpointKind: "email", endpointValue: "ayse@example.test" },
      writeDeps,
    );
    assert.equal(recipient.status, "created");
    const recipientRef = recipient.status === "created" ? recipient.recipient.recordRef : "";
    const recipientDigest =
      recipient.status === "created" ? recipient.recipient.endpointDigest : "";

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
    const draftDigest = draft.status === "created" ? draft.contentDigest : "";

    /*
     * A prepared action, built the way the released inlet builds one, so the WRITER can be called
     * directly and its EXACT refusal read. The inlet is exercised too, further down: the writer's
     * vocabulary is the thing this phase adds, and the inlet's mapping of it is a separate fact.
     */
    const prepared: HebyPreparedAction = prepareAction({
      actionKind: SEND_ACTION_KIND,
      requestingWorkspace: OWNER_WORKSPACE,
      target: { kind: "record", ref: recipientRef, label: "Ayşe Yılmaz" },
      proposedArguments: {
        recipientRef,
        recipientEndpointDigest: recipientDigest,
        draftRef,
        draftRevisionDigest: draftDigest,
      },
      evidence: [
        { sourceClass: "external-recipients", recordRef: recipientRef, lifecycle: "settled" },
        { sourceClass: "work-artifacts", recordRef: draftRef, lifecycle: "settled" },
      ],
    });
    assert.equal(
      prepared.lifecycleState,
      "REQUIRES_HUMAN_REVIEW",
      "the fixture really is a proposal that reached the human review boundary",
    );

    /* ── The agents ────────────────────────────────────────────────────────── */
    const acmeAgent = await createDurableAgentIdentity(acmeCtx, { name: "Heby" }, dbDeps);
    assert.equal(acmeAgent.status, "established");
    const acmeAgentId = acmeAgent.status === "established" ? acmeAgent.identity.agentId : "";

    const acmeProposerResult = await resolveAgentProposer(acmeCtx, dbDeps);
    assert.equal(acmeProposerResult.status, "resolved");
    if (acmeProposerResult.status !== "resolved") throw new Error("unreachable");
    const acmeProposer: AgentProposer = acmeProposerResult.proposer;

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. NO MANDATE — REFUSED, AND NOT BECAUSE ANYTHING WAS UNREACHABLE.
     *
     * The load-bearing case. The agent is real, in service, and resolved through the released
     * authority; the mandate authority answered; there is simply no mandate. An UNBOUNDED agent is
     * exactly what a ceiling exists to prevent, so the absence of a bound refuses.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const before = await requestRows();
      const read = await readEffectiveAgentMandate(acmeCtx, acmeAgentId, dbDeps);
      assert.equal(read.status, "known", "the authority ANSWERED");
      assert.equal(read.status === "known" ? read.mandate : undefined, null, "and there is none");

      const result = await recordAgentOriginatedActionRequest(
        acmeCtx,
        prepared,
        acmeProposer,
        writeDeps,
      );
      assert.equal(result.status, "refused", "NO MANDATE != UNLIMITED MANDATE");
      assert.equal(
        result.status === "refused" ? result.reason : "",
        "no-agent-mandate",
        "and it is named as an absent mandate, never as an outage or an out-of-scope act",
      );
      assert.equal(await requestRows(), before, "A REFUSAL WRITES NO REQUEST ROW");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. MANDATE AUTHORITY UNAVAILABLE — A DIFFERENT REFUSAL, AND NEVER A FALLBACK.
     *
     * TWO OUTAGES, BOTH FAIL-CLOSED. First the control plane is not configured at all. Then — the
     * harder case — the writer's database is perfectly healthy and only the MANDATE table is
     * unreadable, which is the state a naive gate would sail straight through.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const before = await requestRows();
      const unconfigured = await recordAgentOriginatedActionRequest(
        acmeCtx,
        prepared,
        acmeProposer,
        noDbDeps,
      );
      assert.equal(unconfigured.status, "refused");
      assert.equal(
        unconfigured.status === "refused" ? unconfigured.reason : "",
        "agent-mandate-authority-unavailable",
        "UNAVAILABLE != NO MANDATE — an unreachable ceiling is not an absent one",
      );

      /*
       * THE MANDATE AUTHORITY ALONE GOES DARK. Renaming the table makes the released read seam's
       * query throw, which it catches and reports as `unavailable`, while every other table the
       * proposal writer needs is untouched. So the writer COULD have written a row here, and the
       * gate is the only thing that stopped it.
       */
      await setup.query(`alter table agent_mandates rename to agent_mandates_hidden`);
      try {
        const dark = await recordAgentOriginatedActionRequest(
          acmeCtx,
          prepared,
          acmeProposer,
          writeDeps,
        );
        assert.equal(dark.status, "refused");
        assert.equal(
          dark.status === "refused" ? dark.reason : "",
          "agent-mandate-authority-unavailable",
          "a healthy writer and a dark mandate authority still refuses",
        );
        assert.notEqual(
          dark.status === "refused" ? dark.reason : "",
          "persistence-unavailable",
          "and it does NOT report a database outage the database is not having",
        );
      } finally {
        await setup.query(`alter table agent_mandates_hidden rename to agent_mandates`);
      }
      assert.equal(await requestRows(), before, "neither outage wrote a request row");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. THE THREE FAIL-CLOSED STATES ARE THREE, AND THE HUMAN PATH IS NOT ONE OF THEM.
     *
     * The same tenant, the same instant, the same act. With the control plane down the HUMAN writer
     * reports a persistence failure and the AGENT writer reports an unreachable ceiling — two
     * different modules answering about two different authorities, which is the whole reason the
     * agent path got its own vocabulary rather than reusing `persistence-unavailable`.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const human = await recordActionRequest(acmeCtx, prepared, noDbDeps);
      assert.equal(human.status, "refused");
      assert.equal(
        human.status === "refused" ? human.reason : "",
        "persistence-unavailable",
        "the human writer consults no mandate and says exactly what went wrong for it",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. A MANDATE THAT ADMITS THE KIND — THE PROPOSAL PROCEEDS, AND AUTHORIZES NOTHING.
     * ═════════════════════════════════════════════════════════════════════ */
    await seedAgentMandate(setup, acme, acmeAgentId, dbDeps, { tag: "ama2a", now: NOW });
    const mandateAfterEstablish = await mandateFingerprint();

    let recordedRequestId = "";
    {
      const before = await requestRows();
      const result = await recordAgentOriginatedActionRequest(
        acmeCtx,
        prepared,
        acmeProposer,
        writeDeps,
      );
      assert.equal(result.status, "recorded", "an in-scope act proceeds through the released path");
      recordedRequestId = result.status === "recorded" ? result.requestId : "";
      assert.equal(await requestRows(), before + 1, "exactly one row was written");

      /*
       * IN MANDATE != AUTHORIZED. The row is pending, nobody approved it, no permit was minted and
       * nothing ran. Passing a ceiling is the removal of an objection, not the granting of a right.
       */
      const row = await setup.query<{
        status: string;
        approvedAt: string | null;
        proposerType: string;
        proposerId: string;
      }>(
        `select status, approved_at as "approvedAt", proposed_by_actor_type as "proposerType",
                proposed_by_actor_id as "proposerId"
           from heby_action_requests where id = $1`,
        [recordedRequestId],
      );
      const filed = row.rows[0]!;
      assert.equal(filed.status, "pending", "the proposal begins, and stays, pending");
      assert.equal(filed.approvedAt, null, "PROPOSED is not APPROVED");
      assert.equal(filed.proposerType, "agent", "and the proposer is still the agent");
      assert.equal(filed.proposerId, acmeAgentId, "the real durable agent, not the human");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. OUT OF MANDATE — REFUSED, AND WITHDRAWAL IS THE FORM IT TAKES HERE.
     *
     * The released originable vocabulary is CLOSED AT ONE KIND, so "a mandate naming some other
     * kind" is not representable — `canonicaliseMandateScope` refuses a scope naming anything
     * outside it, and the table's own CHECK refuses one in SQL. The representable out-of-scope
     * state is therefore the EMPTY scope, which is what withdrawal is: nothing is inside an empty
     * ceiling, so every kind is outside it.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      assert.deepEqual(
        [...AGENT_ORIGINABLE_ACTION_KINDS],
        ["send"],
        "the released vocabulary is one kind, so withdrawal is the representable out-of-scope state",
      );

      const withdrawn = await establishAgentMandate(
        acmeCtx,
        {
          agentId: acmeAgentId,
          purpose: WITHDRAWAL_PURPOSE,
          proposalScope: [],
          justification: WITHDRAWAL_JUSTIFICATION,
          observedMandateRevision: 1,
        },
        writeDeps,
      );
      assert.equal(withdrawn.status, "established", "withdrawal is a revision, not a deletion");

      const effective = await readEffectiveAgentMandate(acmeCtx, acmeAgentId, dbDeps);
      assert.equal(effective.status, "known");
      assert.deepEqual(
        effective.status === "known" ? effective.mandate?.proposalScope : undefined,
        [],
        "the effective ceiling admits nothing",
      );

      const before = await requestRows();
      /* A DIFFERENT act, so `already-pending` cannot be what refuses it. */
      const second = await createWorkArtifact(
        acmeCtx,
        {
          artifactType: "message-draft",
          title: "Second summary",
          content: "Merhaba Ayşe,\nA second summary.",
        },
        OWNER_WORKSPACE,
        writeDeps,
      );
      assert.equal(second.status, "created");
      const secondRef = second.status === "created" ? second.ref : "";
      const secondPrepared = prepareAction({
        actionKind: SEND_ACTION_KIND,
        requestingWorkspace: OWNER_WORKSPACE,
        target: { kind: "record", ref: recipientRef, label: "Ayşe Yılmaz" },
        proposedArguments: {
          recipientRef,
          recipientEndpointDigest: recipientDigest,
          draftRef: secondRef,
          draftRevisionDigest: second.status === "created" ? second.contentDigest : "",
        },
        evidence: [
          { sourceClass: "external-recipients", recordRef: recipientRef, lifecycle: "settled" },
          { sourceClass: "work-artifacts", recordRef: secondRef, lifecycle: "settled" },
        ],
      });
      assert.equal(secondPrepared.lifecycleState, "REQUIRES_HUMAN_REVIEW");

      const refused = await recordAgentOriginatedActionRequest(
        acmeCtx,
        secondPrepared,
        acmeProposer,
        writeDeps,
      );
      assert.equal(
        refused.status,
        "refused",
        "a withdrawn agent proposes NOTHING — an empty ceiling admits nothing",
      );
      assert.equal(
        refused.status === "refused" ? refused.reason : "",
        "action-outside-agent-mandate",
        "a mandate EXISTS and does not admit this kind — a third fact, named as itself",
      );
      assert.equal(await requestRows(), before, "and it wrote no row");

      /* ═════════════════════════════════════════════════════════════════════
       * 6. THE HUMAN PATH IS NOT CONSTRAINED BY THE AGENT'S CEILING.
       *
       * THE SAME ACT the agent was just refused, proposed by a person, is FILED. A mandate
       * constrains agents; it is not a policy about what the organization may do.
       * ═══════════════════════════════════════════════════════════════════ */
      const byHuman = await recordActionRequest(acmeCtx, secondPrepared, writeDeps);
      assert.equal(
        byHuman.status,
        "recorded",
        "AGENT MANDATE CONSTRAINS AGENTS, NOT HUMAN AUTHORITY",
      );
      const humanRow = await setup.query<{ proposerType: string; proposerId: string }>(
        `select proposed_by_actor_type as "proposerType", proposed_by_actor_id as "proposerId"
           from heby_action_requests where id = $1`,
        [byHuman.status === "recorded" ? byHuman.requestId : ""],
      );
      assert.equal(humanRow.rows[0]!.proposerType, "human");
      assert.equal(humanRow.rows[0]!.proposerId, acme.userId);

      /* And the released `/send` inlet — the real human command — is equally unaffected. */
      const third = await createWorkArtifact(
        acmeCtx,
        {
          artifactType: "message-draft",
          title: "Third summary",
          content: "Merhaba Ayşe,\nA third summary.",
        },
        OWNER_WORKSPACE,
        writeDeps,
      );
      const thirdRef = third.status === "created" ? third.ref : "";
      const humanInlet = await proposeSendAction(
        acmeCtx,
        { recipientRef, draftRef: thirdRef },
        writeDeps,
      );
      assert.equal(
        humanInlet.status,
        "proposed",
        "the released /send command still files, with the agent withdrawn",
      );

      /* The same inlet, driven by the agent, refuses — and says which ceiling stopped it. */
      const agentInlet = await proposeAgentOriginatedSendAction(
        acmeCtx,
        { recipientRef, draftRef: thirdRef },
        acmeProposer,
        writeDeps,
      );
      assert.equal(agentInlet.status, "refused", "the agent-originated inlet refuses");
      assert.ok(
        agentInlet.status === "refused" &&
          agentInlet.detail.includes("action-outside-agent-mandate"),
        `the inlet names the ceiling that refused: ${JSON.stringify(agentInlet)}`,
      );

      /* ═════════════════════════════════════════════════════════════════════
       * AMA-4. THE CEILING THAT REFUSED MUST SURVIVE INTO THE DURABLE RECORD.
       *
       * The inlet's own vocabulary has no value for any of the three mandate states, so it
       * answers `not-authorizable` for all of them and carries the authoritative refusal
       * alongside. Asserting only the reason would pass while the cause was being destroyed —
       * which is what production did: `heby_origination_invocations.filing_refusal` recorded
       * `not-authorizable`, and the difference between an unreachable authority, an unbounded
       * agent and an excluded kind had to be reconstructed by elimination.
       * ═══════════════════════════════════════════════════════════════════ */
      assert.equal(
        agentInlet.status === "refused" ? agentInlet.reason : "",
        "not-authorizable",
        "the inlet's released reason is unchanged — no caller's exhaustive switch moved",
      );
      assert.equal(
        agentInlet.status === "refused" ? agentInlet.authorityRefusal : undefined,
        "action-outside-agent-mandate",
        "and the writer's own refusal travels beside it, verbatim",
      );

      /*
       * THE DURABLE HALF IS PROVED IN `agent-proposal-1/origination-postgres`, NOT HERE.
       * `filing_refusal` is written by `originateAgentAction`, which reaches a model — and this
       * suite's closing assertion pins that it called none. Running one here to save a hop would
       * have made that released claim false, so the end-to-end proof lives in the suite that
       * already originates.
       */
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. TENANT ISOLATION — ANOTHER ORGANIZATION'S CEILING IS NOT A CEILING HERE.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const globexAgent = await createDurableAgentIdentity(globexCtx, { name: "Heby" }, dbDeps);
      assert.equal(globexAgent.status, "established");
      const globexProposerResult = await resolveAgentProposer(globexCtx, dbDeps);
      assert.equal(globexProposerResult.status, "resolved");
      if (globexProposerResult.status !== "resolved") throw new Error("unreachable");

      /* Acme's mandate is invisible from Globex, even named by Acme's own agent id. */
      const crossRead = await readEffectiveAgentMandate(globexCtx, acmeAgentId, dbDeps);
      assert.equal(crossRead.status, "known");
      assert.equal(
        crossRead.status === "known" ? crossRead.mandate : undefined,
        null,
        "another tenant's mandate is indistinguishable from one that never existed",
      );

      const before = await requestRows();
      const foreign = await recordAgentOriginatedActionRequest(
        globexCtx,
        prepared,
        globexProposerResult.proposer,
        writeDeps,
      );
      assert.equal(foreign.status, "refused");
      assert.equal(
        foreign.status === "refused" ? foreign.reason : "",
        "no-agent-mandate",
        "Globex's agent is unbounded no matter what Acme recorded",
      );
      assert.equal(await requestRows(), before, "and nothing was written into either tenant");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. RETIREMENT STILL REFUSES BEFORE A MANDATE IS EVEN CONSULTED.
     *
     * AMA-2 changed no agent-identity behaviour. A retired agent has no proposer to resolve, so
     * the refusal comes from the released identity seam and never mentions a mandate.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const retired = await retireDurableAgentIdentity(
        acmeCtx,
        { agentId: acmeAgentId },
        writeDeps,
      );
      assert.equal(retired.status, "retired");

      const resolved = await resolveAgentProposer(acmeCtx, dbDeps);
      assert.equal(resolved.status, "refused");
      assert.equal(
        resolved.status === "refused" ? resolved.reason : "",
        "durable-agent-identity-retired",
        "the released identity refusal is unchanged by this phase",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 9. ENFORCING A CEILING NEVER CHANGED ONE, AND NOTHING WAS AUTHORIZED.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      /*
       * Between the fingerprint taken at establishment and here, one deliberate revision was
       * recorded by the RELEASED WRITER (the withdrawal in section 5) and every other interaction
       * was a read. So the table must hold exactly two revisions, the first byte-identical to the
       * one that was established, and no enforcement path may have touched either.
       */
      const revisions = await setup.query<{
        mandateRevision: number;
        proposalScope: string[] | null;
      }>(
        `select mandate_revision as "mandateRevision", proposal_scope as "proposalScope"
           from agent_mandates where tenant_id = $1 and agent_id = $2 order by mandate_revision`,
        [acme.tenantId, acmeAgentId],
      );
      assert.deepEqual(
        revisions.rows.map((r) => r.mandateRevision),
        [1, 2],
        "exactly the two revisions a human recorded — enforcement added none",
      );
      assert.deepEqual(revisions.rows[0]!.proposalScope, ["send"], "revision 1 is unchanged");
      assert.deepEqual(revisions.rows[1]!.proposalScope, [], "revision 2 is the withdrawal");

      const firstRevisionNow = JSON.parse(await mandateFingerprint()) as unknown[];
      const firstRevisionThen = JSON.parse(mandateAfterEstablish) as unknown[];
      assert.deepEqual(
        firstRevisionNow[0],
        firstRevisionThen[0],
        "REVISION 1 IS BYTE-IDENTICAL — enforcing a bound cannot alter the bound",
      );

      const counts = await setup.query<{
        permits: number;
        attempts: number;
        actionDecisions: number;
        approved: number;
        provenance: number;
      }>(
        `select (select count(*)::int from action_permits) as permits,
                (select count(*)::int from action_execution_attempts) as attempts,
                (select count(*)::int from decision_records
                  where subject_type in ('heby_action_request','action_permit')) as "actionDecisions",
                (select count(*)::int from heby_action_requests where approved_at is not null) as approved,
                (select count(*)::int from heby_origination_invocations) as provenance`,
      );
      const c = counts.rows[0]!;
      assert.equal(c.permits, 0, "NO PERMIT was minted by any of this");
      assert.equal(c.attempts, 0, "NOTHING was executed");
      assert.equal(
        c.actionDecisions,
        0,
        "PROPOSAL REFUSED != GOVERNANCE REJECTION — no decision was taken about any act",
      );
      assert.equal(c.approved, 0, "and nothing was approved");
      assert.equal(
        c.provenance,
        0,
        "NO PROVIDER WAS REACHED — this suite called no model, so no invocation exists",
      );
    }

    console.log("ama2-mandate-enforcement/enforcement-postgres: OK");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
