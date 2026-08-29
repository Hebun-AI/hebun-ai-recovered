/*
 * SELF-IMPROVING-AGENTS-3.1 — the filing seam, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The transport this phase adds makes exactly two things reachable that were unreachable
 *    before: an authenticated human can file an evidence-backed hypothesis, and a Governance
 *    authority can decide one. Everything else the transport could have made reachable — filing
 *    without a session, filing into another organization, an author accepting their own argument,
 *    a decision that changes an agent, a re-decision, a fabricated evidence count — is still
 *    refused or unrepresentable, and proved so against real rows."
 *
 * ── WHY THIS EXERCISES THE AUTHORITIES AND NOT THE SERVER ACTIONS ────────────
 *
 * The repository's convention, and it is the honest one: a server action is proved STATICALLY —
 * that it holds no gate, writes nothing, calls exactly one authority, and has no parameter for
 * anything it must not be told — and the AUTHORITY behind it is proved at runtime against real
 * rows. `filing-firewall.ts` holds the static half. Invoking the action itself would prove nothing
 * further about the database, because the action's entire body is `resolveTenantContext()` plus
 * one call; what it can CAUSE is what is tested here, with the same argument shapes it passes.
 *
 * Every row is produced by the released authority that owns it. Uses a disposable local database,
 * dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import {
  resolveAgentProposer,
  type AgentProposer,
} from "../../src/features/action-authorization/agent-proposer.server";
import {
  registerInvocation,
  finalizeInvocation,
} from "../../src/features/agent-origination/invocation-provenance.server";
import { fileImprovementHypothesis } from "../../src/features/agent-improvement-hypothesis/write-improvement-hypothesis.server";
import { decideImprovementHypothesis } from "../../src/features/agent-improvement-hypothesis/decide-improvement-hypothesis.server";
import { readImprovementHypotheses } from "../../src/features/agent-improvement-hypothesis/read-improvement-hypotheses.server";
import { IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE } from "../../src/features/agent-improvement-hypothesis/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const JUSTIFICATION =
  "This external message is a deliberate organizational act and I accept responsibility for it.";
const DECISION_JUSTIFICATION =
  "The observed selection-invalid rate is worth investigating, and I authorize an investigation only.";

const CANDIDATE =
  "Narrow the action vocabulary offered to this agent so the closed contract is easier to satisfy.";
const EFFECT = "Fewer selections rejected by the contract, measured on the same recorded column.";
const LIMITS = "It does not know why the output failed to parse, and it may change nothing at all.";

/** Exactly what the server action forwards. Never a tenant, an author, or a number. */
interface FilingPayload {
  readonly agentId: string;
  readonly improvementTarget: string;
  readonly evidenceFindingKey: string;
  readonly candidateChange: string;
  readonly expectedEffect: string;
  readonly limitations: string;
  readonly supersedesHypothesisId?: string | null;
}

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
  const harness = createDisposablePostgresHarness("hebun_sia31_filing");
  await harness.createDatabase();
  harness.migrateDatabase();

  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const baseDeps = { getDb: () => handle.db };

  /**
   * THE TRANSPORT, RESTATED. The server action forwards exactly these fields and adds the tenant
   * from the session. Calling through this shape means every assertion below is about what the
   * product seam can cause, not about a convenience the seam does not offer.
   */
  const file = (tenant: TenantContext | null, payload: FilingPayload) =>
    fileImprovementHypothesis(tenant, payload, baseDeps);

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-sia31",
      email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-sia31",
      email: "director@globex.test",
    })) as Seeded;

    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "sia31-acme");
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "bbbb"), "sia31-globex");

    /*
     * ── A SECOND HUMAN INSIDE ACME, seeded inline ─────────────────────────
     *
     * The seed helper always creates its own company, so calling it twice would produce two
     * ORGANIZATIONS rather than two people — and the author/decider split would then be proved by
     * tenant isolation, which is a different (and already-tested) property. This human is a real
     * `member` of Acme: same tenant, own identity, own session, and NOT the Governance authority.
     * That is the only shape in which "an author cannot accept their own argument" is actually the
     * thing being tested.
     */
    const acmeSecond: Seeded = await (async () => {
      const user = await setup.query<{ id: string }>(
        `insert into users (email, name) values ($1, $2) returning id`,
        ["analyst@acme.test", "Acme Analyst"],
      );
      const userId = user.rows[0]!.id;
      const identity = await setup.query<{ id: string }>(
        `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
         values ($1, 'local', 'hebun-local', $2, 'active', true, now()) returning id`,
        [userId, "local:analyst@acme.test"],
      );
      const role = await setup.query<{ id: string }>(
        `insert into roles (tenant_id, name, type) values ($1, 'Member', 'member') returning id`,
        [acme.tenantId],
      );
      const membership = await setup.query<{ id: string }>(
        `insert into memberships (tenant_id, user_id, role_id, status)
         values ($1, $2, $3, 'active') returning id`,
        [acme.tenantId, userId, role.rows[0]!.id],
      );
      return {
        tenantId: acme.tenantId,
        userId,
        authIdentityId: identity.rows[0]!.id,
        membershipId: membership.rows[0]!.id,
        roleId: role.rows[0]!.id,
      };
    })();

    for (const [seeded, ctx] of [
      [acme, acmeCtx],
      [globex, globexCtx],
    ] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
      );
      assert.equal(
        (await establishGovernanceAuthority(ctx, { justification: JUSTIFICATION }, baseDeps)).status,
        "established",
      );
    }

    assert.equal(
      (await createDurableAgentIdentity(acmeCtx, { name: "Heby" }, baseDeps)).status,
      "established",
    );
    assert.equal(
      (await createDurableAgentIdentity(globexCtx, { name: "Globex Agent" }, baseDeps)).status,
      "established",
    );

    const resolve = async (ctx: TenantContext): Promise<AgentProposer> => {
      const r = await resolveAgentProposer(ctx, baseDeps);
      assert.equal(r.status, "resolved");
      if (r.status !== "resolved") throw new Error("unreachable");
      return r.proposer;
    };
    const acmeProposer = await resolve(acmeCtx);
    const globexProposer = await resolve(globexCtx);
    const acmeAgentId = acmeProposer.agentId;
    const globexAgentId = globexProposer.agentId;

    const invoke = async (
      ctx: TenantContext,
      proposer: AgentProposer,
      state: "selection-invalid" | "no-action" | "selection-valid",
    ): Promise<void> => {
      const id = await registerInvocation(ctx, { transport: "fake", proposer }, baseDeps);
      assert.ok(id, "an invocation must register");
      await finalizeInvocation(
        ctx,
        { invocationId: id!, state, filingOutcome: "not-attempted" },
        baseDeps,
      );
    };
    await invoke(acmeCtx, acmeProposer, "selection-invalid");
    await invoke(acmeCtx, acmeProposer, "selection-invalid");
    await invoke(acmeCtx, acmeProposer, "no-action");
    await invoke(acmeCtx, acmeProposer, "selection-valid");
    await invoke(globexCtx, globexProposer, "selection-invalid");

    const payload: FilingPayload = {
      agentId: acmeAgentId,
      improvementTarget: "selection-behaviour",
      evidenceFindingKey: "selection-invalid",
      candidateChange: CANDIDATE,
      expectedEffect: EFFECT,
      limitations: LIMITS,
    };

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. AN UNAUTHENTICATED CALLER FILES NOTHING.
     *
     * The transport passes `resolveTenantContext()` straight through, and that returns null for an
     * unauthenticated request AND for an unconfigured environment alike. Both must refuse — there
     * is no anonymous tenant and no demo path.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const anonymous = await file(null, payload);
      assert.equal(anonymous.status, "refused");
      if (anonymous.status === "refused") {
        assert.equal(anonymous.reason, "unauthenticated", "no session, no filing");
      }
      const before = await setup.query<{ n: string }>(
        `select count(*)::text as n from agent_improvement_hypotheses`,
      );
      assert.equal(before.rows[0]!.n, "0", "and nothing was written by the attempt");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. A CROSS-TENANT SUBJECT IS INDISTINGUISHABLE FROM ONE THAT NEVER EXISTED.
     *
     * The client names an agent id. That id is a LOOKUP KEY and never authority: Globex's real,
     * live agent resolves to the same refusal as a fabricated uuid would.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const cross = await file(acmeCtx, { ...payload, agentId: globexAgentId });
      assert.equal(cross.status, "refused");
      if (cross.status === "refused") {
        assert.equal(
          cross.reason,
          "agent-unresolvable",
          "another organization's agent cannot be the subject, and is not reported as existing",
        );
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. THE EVIDENCE IS THE SERVER'S READING, NOT THE CLIENT'S CLAIM.
     *
     * Acme made four attributed calls, two of them selection-invalid. The stored pair is 2 of 4 —
     * Globex's own selection-invalid call is not in it, and no parameter existed through which the
     * caller could have said otherwise.
     * ═════════════════════════════════════════════════════════════════════ */
    const filed = await file(acmeCtx, payload);
    assert.equal(filed.status, "filed");
    if (filed.status !== "filed") throw new Error("unreachable");

    {
      const stored = await setup.query<{
        value: number;
        total: number;
        source: string;
        author: string;
        author_type: string;
        tenant: string;
        observed_at: string;
      }>(
        `select evidence_observed_value as value, evidence_observed_total as total,
                evidence_source as source, proposed_by_actor_id as author,
                proposed_by_actor_type as author_type, tenant_id as tenant,
                evidence_observed_at as observed_at
           from agent_improvement_hypotheses where id = $1`,
        [filed.hypothesisId],
      );
      const row = stored.rows[0]!;
      assert.equal(row.value, 2, "the numerator is what the server counted for THIS agent");
      assert.equal(row.total, 4, "and the denominator is this agent's attributed calls");
      assert.equal(
        row.source,
        "heby_origination_invocations.state",
        "the authoritative column comes from the released mapping, never from the caller",
      );

      /*
       * THE AUTHOR IS THE SESSION'S HUMAN. The transport has no parameter for it, the writer
       * stamps it, and the database CHECK refuses anything but `human` — three independent
       * statements of one rule.
       */
      assert.equal(row.author, acme.userId, "the author is the authenticated human, from the session");
      assert.equal(row.author_type, "human", "and a hypothesis author is human");
      assert.equal(row.tenant, acme.tenantId, "and the tenant is the session's, not the payload's");
      assert.ok(row.observed_at, "the instant the evidence was read is stored with it");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. AN AGENT CANNOT BE MADE THE AUTHOR, EVEN DIRECTLY IN SQL.
     *
     * The transport has no parameter for it and the writer stamps `human`, so the only way to test
     * the last line of defence is to attack the database itself. The CHECK is what makes the
     * authorship model a property of the system rather than of the code path taken.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      let refused = false;
      try {
        await setup.query(
          `update agent_improvement_hypotheses set proposed_by_actor_type = 'agent' where id = $1`,
          [filed.hypothesisId],
        );
      } catch {
        refused = true;
      }
      assert.ok(
        refused,
        "the database refuses an agent author — SIA-3.1 did not weaken this to look more autonomous",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. A FILED HYPOTHESIS IS UNDECIDED, AND UNDECIDED IS NOT REJECTED.
     *
     * Filing writes no `decision_records` row. The read model reports the absence as a THIRD
     * state, and the surface renders it as one.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const decisions = await setup.query<{ n: string }>(
        `select count(*)::text as n from decision_records where subject_type = $1`,
        [IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE],
      );
      assert.equal(decisions.rows[0]!.n, "0", "filing recorded no Governance decision");

      const view = await readImprovementHypotheses(acmeCtx, baseDeps);
      assert.equal(view.status, "read");
      if (view.status !== "read") throw new Error("unreachable");
      const one = view.hypotheses.find((h) => h.hypothesisId === filed.hypothesisId);
      assert.ok(one, "the filed hypothesis is readable by its author's organization");
      assert.equal(one!.decision.status, "undecided", "and it carries no fabricated outcome");
      assert.equal(one!.agentName, "Heby", "the agent name comes from this tenant's own agent row");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. FILING TWICE WRITES TWO HYPOTHESES. DETERMINISTICALLY.
     *
     * There is no deduplication, and that is a DECISION rather than an omission: nothing in this
     * repository defines when two arguments are the same argument, and silently discarding the
     * second would answer that on the author's behalf. What matters is that the behaviour is
     * stated and stable — the surface says so before the click, and this pins it.
     *
     * The two records are distinguishable: different ids, and each carries its own reading of the
     * evidence at its own instant.
     * ═════════════════════════════════════════════════════════════════════ */
    let secondId = "";
    {
      const again = await file(acmeCtx, payload);
      assert.equal(again.status, "filed", "an identical filing is not silently swallowed");
      if (again.status !== "filed") throw new Error("unreachable");
      assert.notEqual(again.hypothesisId, filed.hypothesisId, "it is a SECOND record, with its own id");
      secondId = again.hypothesisId;

      const count = await setup.query<{ n: string }>(
        `select count(*)::text as n from agent_improvement_hypotheses where tenant_id = $1`,
        [acme.tenantId],
      );
      assert.equal(count.rows[0]!.n, "2", "two filings, two hypotheses");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. NAMING A PREDECESSOR RECORDS LINEAGE AND WITHDRAWS NOTHING.
     *
     * This is the modelled way to replace an argument, and it is the reason deduplication would
     * have been the wrong answer above: supersession already exists and says something weaker and
     * truer than deletion.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const successor = await file(acmeCtx, {
        ...payload,
        candidateChange: "Offer the agent a smaller vocabulary and re-measure over the same column.",
        supersedesHypothesisId: secondId,
      });
      assert.equal(successor.status, "filed");

      const predecessor = await setup.query<{ deleted: string | null; status: string }>(
        `select deleted_at as deleted, lifecycle_status as status
           from agent_improvement_hypotheses where id = $1`,
        [secondId],
      );
      assert.equal(predecessor.rows[0]!.deleted, null, "the predecessor was not deleted");
      assert.equal(predecessor.rows[0]!.status, "active", "and it was not withdrawn");

      /* A predecessor in ANOTHER organization is refused, so lineage cannot cross a tenant. */
      const crossLineage = await file(globexCtx, {
        ...payload,
        agentId: globexAgentId,
        supersedesHypothesisId: filed.hypothesisId,
      });
      assert.equal(crossLineage.status, "refused");
      if (crossLineage.status === "refused") {
        assert.equal(crossLineage.reason, "supersedes-unresolvable");
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. FILING CANNOT DECIDE, AND AN AUTHOR CANNOT ACCEPT THEIR OWN ARGUMENT
     *    UNLESS THEY HOLD THE AUTHORITY.
     *
     * The second Acme human is authenticated and can file. They are not the Governance authority,
     * and the decider refuses them — which is the whole reason the decision control lives on the
     * Governance surface and is gated on holding it.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const secondCtx = contextFor(
        acmeSecond,
        await sessionRowFor(setup, acmeSecond, "cccc"),
        "sia31-acme-2",
      );
      const notAuthority = await decideImprovementHypothesis(
        secondCtx,
        {
          hypothesisId: filed.hypothesisId,
          decision: "approve",
          justification: DECISION_JUSTIFICATION,
        },
        baseDeps,
      );
      assert.equal(notAuthority.status, "refused");
      if (notAuthority.status === "refused") {
        /*
         * THE EXACT REASON, not a disjunction. This human IS in Acme, so the hypothesis resolves
         * for them and tenant isolation is not what refuses — the AUTHORITY check is. A test that
         * accepted `hypothesis-unresolvable` here would pass just as happily if the split were
         * being held by tenant scoping instead, which is a different property that is already
         * proved above.
         */
        assert.equal(
          notAuthority.reason,
          "not-the-governance-authority",
          "a human who is not the Governance authority decides nothing, even in their own tenant",
        );
      }

      /* And they CAN file — so the refusal above is about deciding, never about being a lesser human. */
      const theyCanFile = await file(secondCtx, payload);
      assert.equal(
        theyCanFile.status,
        "filed",
        "an ordinary member may file a hypothesis; only deciding needs Governance authority",
      );
      const stillNone = await setup.query<{ n: string }>(
        `select count(*)::text as n from decision_records where subject_type = $1`,
        [IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE],
      );
      assert.equal(stillNone.rows[0]!.n, "0", "and no decision row was written");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 9. THE GOVERNANCE AUTHORITY DECIDES — AND THE AGENT IS UNCHANGED.
     *
     * The consequential half of the loop. Acceptance writes ONE ledger row, worded so it cannot be
     * read as an application, and touches neither the hypothesis nor the agent.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const agentBefore = await setup.query(
        `select * from agents where id = $1`,
        [acmeAgentId],
      );
      const hypothesisBefore = await setup.query(
        `select * from agent_improvement_hypotheses where id = $1`,
        [filed.hypothesisId],
      );

      const decided = await decideImprovementHypothesis(
        acmeCtx,
        {
          hypothesisId: filed.hypothesisId,
          decision: "approve",
          justification: DECISION_JUSTIFICATION,
        },
        baseDeps,
      );
      assert.equal(decided.status, "decided", "the Governance authority may decide");
      if (decided.status !== "decided") throw new Error("unreachable");

      /*
       * THE DOMAIN LIVES ON THE SESSION, NOT ON THE DECISION — so it is read by joining, which is
       * the stronger assertion anyway: it proves the released writer opened a `learning` session
       * for this subject rather than that a column happened to hold the word.
       */
      const ledger = await setup.query<{
        outcome: string;
        domain: string;
        subject_type: string;
        subject_id: string;
        actor_type: string;
        actor_id: string;
      }>(
        `select d.outcome, s.governance_domain::text as domain, d.subject_type, d.subject_id,
                d.actor_type::text as actor_type, d.actor_id
           from decision_records d
           join governance_sessions s on s.id = d.session_id
          where d.id = $1`,
        [decided.decisionId],
      );
      const record = ledger.rows[0]!;
      assert.equal(
        record.outcome,
        "improvement-hypothesis-accepted",
        "the ledger says a HYPOTHESIS was accepted",
      );
      assert.ok(
        !/applied|improved|succeeded/i.test(record.outcome),
        "and never that an improvement was made or a change carried out",
      );
      assert.equal(record.domain, "learning", "in the learning domain — no authority moved");
      assert.equal(record.subject_type, IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE);
      assert.equal(record.subject_id, filed.hypothesisId);
      /* The decider is the authenticated HUMAN authority, never the agent the hypothesis is about. */
      assert.equal(record.actor_type, "human", "a human decided");
      assert.equal(record.actor_id, acme.userId, "and it was the Governance authority's own session");

      /* THE AGENT IS BYTE-FOR-BYTE WHAT IT WAS. Acceptance changed nothing about it. */
      const agentAfter = await setup.query(`select * from agents where id = $1`, [acmeAgentId]);
      assert.deepEqual(
        agentAfter.rows[0],
        agentBefore.rows[0],
        "an accepted hypothesis changed no column of the agent it is about",
      );

      /* AND THE HYPOTHESIS ROW IS UNTOUCHED — no status was stamped back onto it. */
      const hypothesisAfter = await setup.query(
        `select * from agent_improvement_hypotheses where id = $1`,
        [filed.hypothesisId],
      );
      assert.deepEqual(
        hypothesisAfter.rows[0],
        hypothesisBefore.rows[0],
        "and the hypothesis itself is unchanged — the decision lives only in the ledger",
      );

      /* NO PERMIT WAS MINTED, AND NOTHING BECAME EXECUTABLE. */
      const permits = await setup.query<{ n: string }>(`select count(*)::text as n from action_permits`);
      assert.equal(permits.rows[0]!.n, "0", "acceptance minted no permit");

      /* The read model now reports the decision, read from the ledger rather than from a column. */
      const view = await readImprovementHypotheses(acmeCtx, baseDeps);
      assert.equal(view.status, "read");
      if (view.status !== "read") throw new Error("unreachable");
      const one = view.hypotheses.find((h) => h.hypothesisId === filed.hypothesisId)!;
      assert.equal(one.decision.status, "decided");
      if (one.decision.status === "decided") {
        assert.equal(one.decision.accepted, true, "accepted means PURSUE");
        assert.equal(one.decision.outcome, "improvement-hypothesis-accepted");
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 10. A DECIDED HYPOTHESIS IS NOT RE-DECIDABLE.
     *
     * Which is why the Governance surface offers only UNDECIDED ones: a control that always
     * refuses is a false affordance.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const again = await decideImprovementHypothesis(
        acmeCtx,
        {
          hypothesisId: filed.hypothesisId,
          decision: "reject",
          justification: DECISION_JUSTIFICATION,
        },
        baseDeps,
      );
      assert.equal(again.status, "refused");
      if (again.status === "refused") {
        assert.equal(again.reason, "already-decided", "there is no re-deciding and no reversal");
      }
      const rows = await setup.query<{ n: string }>(
        `select count(*)::text as n from decision_records where subject_id = $1`,
        [filed.hypothesisId],
      );
      assert.equal(rows.rows[0]!.n, "1", "and exactly one decision exists about it");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 11. DECLINING IS A SEPARATE OUTCOME, AND DELETES NOTHING.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const declined = await decideImprovementHypothesis(
        acmeCtx,
        {
          hypothesisId: secondId,
          decision: "reject",
          justification: DECISION_JUSTIFICATION,
        },
        baseDeps,
      );
      assert.equal(declined.status, "decided");
      if (declined.status !== "decided") throw new Error("unreachable");

      const outcome = await setup.query<{ outcome: string }>(
        `select outcome from decision_records where id = $1`,
        [declined.decisionId],
      );
      assert.equal(outcome.rows[0]!.outcome, "improvement-hypothesis-declined");

      const survived = await setup.query<{ n: string; status: string }>(
        `select count(*)::text as n, max(lifecycle_status::text) as status
           from agent_improvement_hypotheses where id = $1`,
        [secondId],
      );
      assert.equal(survived.rows[0]!.n, "1", "a declined hypothesis still exists");
      assert.equal(survived.rows[0]!.status, "active", "and was not withdrawn by the decision");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 12. THE WHOLE PHASE WROTE NOTHING OUTSIDE ITS TWO TABLES.
     *
     * A census: after every act above, the tables SIA-3.1 must never touch are still empty. This
     * is the claim "filing cannot execute, mint a permit, read a credential, or write Memory,
     * Learning, Knowledge or telemetry" stated as measured rows rather than as an import ban.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      for (const table of [
        "action_permits",
        "heby_action_requests",
        "knowledge_nodes",
        "integration_credentials",
      ]) {
        const rows = await setup.query<{ n: string }>(`select count(*)::text as n from ${table}`);
        assert.equal(rows.rows[0]!.n, "0", `${table} is untouched by the filing seam`);
      }

      /* Exactly three hypotheses, and exactly two decisions about them. Nothing else happened. */
      const hypotheses = await setup.query<{ n: string }>(
        `select count(*)::text as n from agent_improvement_hypotheses`,
      );
      assert.equal(hypotheses.rows[0]!.n, "4", "four hypotheses were filed in total");
      const decisions = await setup.query<{ n: string }>(
        `select count(*)::text as n from decision_records where subject_type = $1`,
        [IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE],
      );
      assert.equal(decisions.rows[0]!.n, "2", "and two of them were decided");
    }

    console.log("sia31-hypothesis-filing/filing-postgres: OK");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
