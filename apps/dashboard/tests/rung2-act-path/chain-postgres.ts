/*
 * RUNG 2 ACT PATH — the COMPLETE chain, against a REAL PostgreSQL.
 *
 * WHAT THIS FILE PROVES, and none of it can be proved with fakes:
 *
 *   "A stored provider observation becomes an AGENT-originated, evidence-bound record-work request
 *    through the released inlet; a standing envelope a human signed covers it; the narrow trigger
 *    offers it to the issuer; the issuer writes ONE ordinary single-use permit; and that permit is
 *    then an ordinary candidate of the released RUNG 1.5 delivery register — which discovers it on
 *    exactly the same terms as a human-approved one."
 *
 * The chain is walked with NO SQL SURGERY ON EVIDENCE. The existing
 * `rung2-standing-mutation/issuance-postgres.ts` had to overwrite `evidence` by hand because no
 * agent path could produce an admitted class; that is precisely the gap this phase closed, so this
 * file exercises the real writer instead and would fail if the gap reopened.
 *
 * Then the refusals, each on its own terms and each proving NOTHING was written.
 *
 * NOTHING IS EXECUTED. No permit is spent, no work row is created, no provider is reached and the
 * deployment's arming control is never touched. `ISSUED` is where this file stops, deliberately.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedAgentMandate } from "../helpers/agent-mandate-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { resolveAgentProposer } from "../../src/features/action-authorization/agent-proposer.server";
import {
  proposeAgentOriginatedObservationWorkAction,
  proposeSocialObservationWorkAction,
} from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { authorizeTenantMachineExecution } from "../../src/features/tenant-machine-execution-authority/authorize-tenant-machine-execution.server";
import { writeStandingMutationAuthorization } from "../../src/features/standing-mutation-authority/authorize-standing-mutation.server";
import { listStandingIssuableRequestsForRuntime } from "../../src/features/action-authorization/read-standing-issuable-requests.server";
import { scanIssuableRequests } from "../../src/features/standing-issuance-trigger/scan-issuable-requests.server";
import { listMachineDeliverablePermitsForRuntime } from "../../src/features/action-authorization/read-machine-deliverable-permits.server";
import { buildOriginationCandidates } from "../../src/features/agent-origination/candidate-set.server";
import { RECORD_WORK_ACTION_KIND } from "../../src/features/heby-action-inlet/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

let NOW = new Date("2026-09-15T12:00:00.000Z");
const GENESIS = "This organization establishes its founding Governance authority for the RUNG 2 act path.";
const ENROLMENT = "This organization agrees its authorized work may be delivered by machine.";
const ENVELOPE =
  "This organization authorizes its agent to record evidenced work without a decision for each one.";

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
     values ($1,$2,1,$3,$4,$5,1,'aal1',false, now(), now(), now(), now() + interval '1 day',
             now() + interval '1 day')
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
  const harness = createDisposablePostgresHarness("hebun_rung2_actpath");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;
  const getDb = () => handle.db;

  try {
    await setup.connect();
    NOW = new Date((await setup.query<{ now: Date }>(`select now() as now`)).rows[0]!.now);

    const countOf = async (table: string): Promise<number> =>
      Number((await setup.query(`select count(*)::int n from ${table}`)).rows[0]!.n);

    /* ── ONE ORGANIZATION, ITS GOVERNANCE, ITS ENROLMENT, ITS AGENT ───────── */

    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-rung2-actpath",
      email: "director@acme-rung2-actpath.test",
    })) as Seeded;
    const ctx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "rung2-actpath");

    await setup.query(
      `insert into genesis_nominations
         (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
          accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [acme.tenantId, acme.authIdentityId, acme.userId, ctx.sessionContextId],
    );
    assert.equal(
      (await establishGovernanceAuthority(ctx, { justification: GENESIS }, deps)).status,
      "established",
    );
    assert.equal(
      (
        await authorizeTenantMachineExecution(
          ctx,
          { capabilityKey: RECORD_WORK_ACTION_KIND, justification: ENROLMENT, observedRevision: null },
          deps,
        )
      ).status,
      "written",
    );

    const agent = await createDurableAgentIdentity(ctx, { name: "Heby" }, deps);
    assert.equal(agent.status, "established");
    const agentId = agent.status === "established" ? agent.identity.agentId : "";
    await seedAgentMandate(setup, acme, agentId, deps, { tag: "rung2actpath", now: NOW });
    const resolved = await resolveAgentProposer(ctx, deps);
    const proposer = resolved.status === "resolved" ? resolved.proposer : null;
    assert.ok(proposer, "the released proposer resolver must mint one for a mandated agent");

    /* ── TWO REAL STORED OBSERVATIONS ─────────────────────────────────────── */

    /*
     * The integration and the observation rows are FIXTURES OF WHAT A PROVIDER REPORTED — external
     * facts, which is exactly what a fixture is entitled to state. Every Hebun authority downstream
     * of them is the released one: the read seam, the candidate builder, the inlet, the envelope
     * writer, the discovery, the trigger and the issuer.
     */
    const connection = (
      await setup.query<{ id: string }>(
        `insert into integrations (tenant_id, provider_key, name, status, connection_state, health,
                                   scopes, created_by, created_by_type)
         values ($1,'youtube','YouTube','connected','connected','healthy','[]'::jsonb,$2,'human')
         returning id`,
        [acme.tenantId, acme.userId],
      )
    ).rows[0]!.id;

    const seedObservation = async (subjectRef: string, observedAt: string): Promise<string> =>
      (
        await setup.query<{ id: string }>(
          `insert into provider_observations (tenant_id, integration_id, provider_key, capability_key,
               subject_kind, subject_ref, observed_at, observed_by_actor_type, observed_by_actor_id,
               facts, facts_digest)
           values ($1,$2,'youtube','youtube.channel.public.read','youtube-channel',$3,$4,'human',$5,
                   '{}'::jsonb,$6) returning id`,
          [acme.tenantId, connection, subjectRef, observedAt, acme.userId, subjectRef.padEnd(64, "0").slice(0, 64)],
        )
      ).rows[0]!.id;

    const observationA = await seedObservation("youtube/channel/UC_A", NOW.toISOString());
    const observationB = await seedObservation(
      "youtube/channel/UC_B",
      new Date(NOW.getTime() - 3_600_000).toISOString(),
    );

    /* ════════════════════════════════════════════════════════════════════════
     * 1 · THE CANDIDATE SPACE OFFERS OBSERVATIONS — AND ONLY SLUGS
     * ══════════════════════════════════════════════════════════════════════ */

    const candidates = await buildOriginationCandidates(ctx, { observations: { getDb } });
    assert.equal(
      candidates.work.observations.length,
      2,
      "both stored observations must be offered to the agent",
    );
    /*
     * THE MODEL NEVER SEES AN ID. The slug is positional and the label is provider-and-instant.
     * A uuid or a `provider-observation/` prefix in either would be the containment failing at the
     * only boundary where it matters.
     */
    for (const candidate of candidates.work.observations) {
      assert.match(candidate.slug, /^observation-\d+$/, "a slug is a positional token, never an id");
      assert.doesNotMatch(
        candidate.label,
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
        "an observation label must not carry a uuid",
      );
      assert.doesNotMatch(
        candidate.label,
        /provider-observation\//,
        "an observation label must not carry a canonical reference",
      );
      assert.match(
        candidate.observationRef,
        /^provider-observation\//,
        "the server-side reference is canonical and never rendered",
      );
    }
    const refA = candidates.work.observations.find((o) => o.observationRef.includes(observationA))!;
    const refB = candidates.work.observations.find((o) => o.observationRef.includes(observationB))!;
    assert.ok(refA && refB, "both observations resolve to canonical references");

    /* ════════════════════════════════════════════════════════════════════════
     * 2 · THE AGENT ORIGINATES EVIDENCE-BOUND WORK — NO SQL SURGERY
     * ══════════════════════════════════════════════════════════════════════ */

    const requestA = await proposeAgentOriginatedObservationWorkAction(
      ctx,
      { title: "Recorded the channel observation", observationRef: refA.observationRef },
      proposer!,
      deps,
    );
    assert.equal(requestA.status, "proposed", JSON.stringify(requestA));
    const requestAId = requestA.status === "proposed" ? requestA.receipt.requestId : "";

    /* THE PROVENANCE AND THE EVIDENCE ARE BOTH WHAT THE ISSUER REQUIRES. */
    const filedA = (
      await setup.query<{ t: string; e: unknown }>(
        `select proposed_by_actor_type t, evidence e from heby_action_requests where id = $1`,
        [requestAId],
      )
    ).rows[0]!;
    assert.equal(filedA.t, "agent", "the released agent inlet must record AGENT provenance");
    assert.deepEqual(
      (filedA.e as { sourceClass: string; recordRef: string }[]).map((x) => x.sourceClass),
      ["provider-observations"],
      "and the evidence must be the ONE admitted class, written by the released seam",
    );
    assert.equal(
      (filedA.e as { recordRef: string }[])[0]!.recordRef,
      refA.observationRef,
      "re-derived from the row that was read, not echoed from the caller",
    );

    /* ════════════════════════════════════════════════════════════════════════
     * 3 · WITHOUT AN ENVELOPE, THE TRIGGER DISCOVERS NOTHING
     * ══════════════════════════════════════════════════════════════════════ */

    const before = await listStandingIssuableRequestsForRuntime({ getDb });
    assert.equal(before.status, "read");
    assert.equal(
      before.status === "read" ? before.requests.length : -1,
      0,
      "a proposal with no standing envelope is not even a candidate",
    );

    const permitsBefore = await countOf("action_permits");

    /* ════════════════════════════════════════════════════════════════════════
     * 4 · A HUMAN SIGNS AN ENVELOPE, AND THE CHAIN COMPLETES
     * ══════════════════════════════════════════════════════════════════════ */

    const envelope = await writeStandingMutationAuthorization(
      ctx,
      "active",
      {
        agentId,
        actionKind: RECORD_WORK_ACTION_KIND,
        notBefore: new Date(NOW.getTime() - 60_000),
        notAfter: new Date(NOW.getTime() + 86_400_000),
        maxActs: 2,
        minIntervalMinutes: 1,
        justification: ENVELOPE,
        observedRevision: null,
      },
      deps,
    );
    assert.equal(envelope.status, "written", JSON.stringify(envelope));

    const discovered = await listStandingIssuableRequestsForRuntime({ getDb });
    assert.equal(discovered.status === "read" ? discovered.requests.length : -1, 1);
    assert.equal(
      discovered.status === "read" ? discovered.requests[0]!.requestId : "",
      requestAId,
      "the covered proposal is now exactly one candidate",
    );

    const decisionsBefore = await countOf("decision_records");
    const scan = await scanIssuableRequests({ getDb, issuerDeps: { getDb } });
    assert.equal(scan.status, "scanned", JSON.stringify(scan));
    assert.equal(scan.status === "scanned" ? scan.issued : -1, 1, "exactly one permit was issued");

    assert.equal(await countOf("action_permits"), permitsBefore + 1);
    /*
     * THE ISSUER WRITES NO GOVERNANCE DECISION. Minting a per-act decision with `actor_type='agent'`
     * would hand Governance to a machine; with `'human'` it would record a deliberation that never
     * happened. Both were refused by name at design time, and this is where that holds or does not.
     */
    assert.equal(
      await countOf("decision_records"),
      decisionsBefore,
      "issuing under a standing envelope creates NO new Governance decision",
    );

    const permit = (
      await setup.query<{
        standing: string | null;
        decision: string;
        authorizer: string;
        atype: string;
        status: string;
      }>(
        `select standing_authorization_id standing, governance_decision_id decision,
                authorized_by_actor_id authorizer, authorized_by_actor_type atype, status
           from action_permits where action_request_id = $1`,
        [requestAId],
      )
    ).rows[0]!;
    assert.ok(permit.standing, "the permit records WHY it needed no click");
    assert.equal(
      permit.atype,
      "human",
      "the human-authorizer invariant is untouched: a machine never appears here",
    );
    assert.equal(
      permit.authorizer,
      acme.userId,
      "and the human named is the person who signed the envelope — accurate, not fabricated",
    );
    assert.equal(
      permit.decision,
      (
        await setup.query<{ d: string }>(
          `select governance_decision_id d from standing_mutation_authorizations where id = $1`,
          [permit.standing],
        )
      ).rows[0]!.d,
      "the permit cites the STANDING decision the human actually took",
    );
    assert.equal(permit.status, "active", "an ordinary single-use permit, in its ordinary state");

    /* ── AND IT IS AN ORDINARY CANDIDATE OF THE RELEASED DELIVERY REGISTER ── */

    const deliverable = await listMachineDeliverablePermitsForRuntime({ getDb });
    assert.equal(deliverable.status, "read");
    assert.equal(
      deliverable.status === "read" ? deliverable.permits.length : -1,
      1,
      "RUNG 1.5 discovers a standing-issued permit on exactly the same terms as any other",
    );

    /* NOTHING WAS EXECUTED. The chain stops at ISSUED, by design. */
    assert.equal(await countOf("work_items"), 0, "no work was recorded by issuance");

    /* ════════════════════════════════════════════════════════════════════════
     * 5 · REPLAY: A SECOND TICK ISSUES NOTHING MORE FOR THE SAME REQUEST
     * ══════════════════════════════════════════════════════════════════════ */

    const rediscovered = await listStandingIssuableRequestsForRuntime({ getDb });
    assert.equal(
      rediscovered.status === "read" ? rediscovered.requests.length : -1,
      0,
      "a request that already holds a permit is no longer a candidate — no tight refusal loop",
    );
    const replay = await scanIssuableRequests({ getDb, issuerDeps: { getDb } });
    assert.equal(replay.status === "scanned" ? replay.issued : -1, 0);
    assert.equal(await countOf("action_permits"), permitsBefore + 1, "replay wrote nothing");

    /* ════════════════════════════════════════════════════════════════════════
     * 6 · THE REFUSALS, EACH ON ITS OWN TERMS
     * ══════════════════════════════════════════════════════════════════════ */

    const { issuePermitUnderStandingAuthorization } = await import(
      "../../src/features/standing-mutation-authority/issue-permit-under-standing-authorization.server"
    );
    const issue = (requestId: string) =>
      issuePermitUnderStandingAuthorization({ requestId }, { getDb });
    const reasonOf = async (requestId: string): Promise<string> => {
      const before = await countOf("action_permits");
      const result = await issue(requestId);
      assert.equal(await countOf("action_permits"), before, "a refusal must write NOTHING");
      return result.status === "refused" ? result.reason : `ISSUED:${result.permitId}`;
    };

    /* A FORGED OBSERVATION REFERENCE NEVER BECOMES A PROPOSAL AT ALL. */
    const forged = await proposeAgentOriginatedObservationWorkAction(
      ctx,
      {
        title: "Work about an observation that does not exist",
        observationRef: "provider-observation/00000000-0000-4000-8000-000000000000",
      },
      proposer!,
      deps,
    );
    assert.equal(forged.status, "refused");
    assert.equal(
      forged.status === "refused" ? forged.reason : "",
      "observation-not-found",
      "an invented reference resolves to nothing and files nothing",
    );

    /* A MALFORMED ONE IS REFUSED BEFORE ANY READ. */
    const malformed = await proposeAgentOriginatedObservationWorkAction(
      ctx,
      { title: "Work about a malformed reference", observationRef: "not-a-reference" },
      proposer!,
      deps,
    );
    assert.equal(
      malformed.status === "refused" ? malformed.reason : "",
      "invalid-observation-ref",
    );

    /* EVIDENCE REUSE: a SECOND proposal citing observation A cannot fund a second act. */
    const reuse = await proposeAgentOriginatedObservationWorkAction(
      ctx,
      { title: "Second work about the same observation", observationRef: refA.observationRef },
      proposer!,
      deps,
    );
    assert.equal(reuse.status, "proposed", JSON.stringify(reuse));
    const reuseId = reuse.status === "proposed" ? reuse.receipt.requestId : "";
    assert.equal(
      await reasonOf(reuseId),
      "evidence-already-consumed",
      "one organizational fact funds exactly one standing-authorized act",
    );

    /* A HUMAN-PROPOSED OBSERVATION PROPOSAL IS NOT THE ENVELOPE'S BUSINESS. */
    const human = await proposeSocialObservationWorkAction(
      ctx,
      { title: "Human-named work about observation B", observationRef: refB.observationRef },
      deps,
    );
    assert.equal(human.status, "proposed", JSON.stringify(human));
    const humanId = human.status === "proposed" ? human.receipt.requestId : "";
    assert.equal(
      await reasonOf(humanId),
      "not-agent-proposed",
      "a human who proposes and walks away has not asked to be authorized without them",
    );
    /* And the discovery never offered it either — the courtesy filter and the authority agree. */
    const afterHuman = await listStandingIssuableRequestsForRuntime({ getDb });
    assert.equal(
      afterHuman.status === "read"
        ? afterHuman.requests.filter((r) => r.requestId === humanId).length
        : -1,
      0,
    );

    /*
     * A HELPER FOR FRESH EVIDENCE. Each act needs its own observation, because one organizational
     * fact funds exactly one act — proved above. Declared before use rather than hoisted into the
     * middle of the assertions it serves.
     */
    const freshObservationRef = async (): Promise<string> => {
      const id = await seedObservation(
        `youtube/channel/UC_${Math.random().toString(36).slice(2, 8)}`,
        new Date(NOW.getTime() - 7_200_000).toISOString(),
      );
      const fresh = await buildOriginationCandidates(ctx, { observations: { getDb } });
      return fresh.work.observations.find((o) => o.observationRef.includes(id))!.observationRef;
    };

    /* CADENCE: a fresh agent proposal, with the envelope's one minute not yet elapsed. */
    const cadence = await proposeAgentOriginatedObservationWorkAction(
      ctx,
      { title: "Work about observation B", observationRef: refB.observationRef },
      proposer!,
      deps,
    );
    assert.equal(cadence.status, "proposed", JSON.stringify(cadence));
    const cadenceId = cadence.status === "proposed" ? cadence.receipt.requestId : "";
    assert.equal(
      await reasonOf(cadenceId),
      "cadence-not-elapsed",
      "the envelope's minimum interval is enforced, and it is the issuer that enforces it",
    );

    /*
     * AGE THE ISSUED PERMIT SO THE CADENCE HAS ELAPSED, and nothing else. The envelope is untouched:
     * this moves the CLOCK's relationship to a past act, which is the only thing cadence measures.
     */
    await setup.query(
      `update action_permits set issued_at = issued_at - interval '2 hours' where tenant_id = $1`,
      [acme.tenantId],
    );
    const secondAct = await issue(cadenceId);
    assert.equal(secondAct.status, "issued", JSON.stringify(secondAct));
    assert.equal(
      secondAct.status === "issued" ? secondAct.actsIssued : -1,
      2,
      "the envelope has now issued both of the two acts it allows",
    );

    /* QUOTA: the envelope allowed TWO acts and both are spent. A third is refused as exhausted. */
    const third = await proposeAgentOriginatedObservationWorkAction(
      ctx,
      { title: "A third act", observationRef: await freshObservationRef() },
      proposer!,
      deps,
    );
    assert.equal(third.status, "proposed", JSON.stringify(third));
    const thirdId = third.status === "proposed" ? third.receipt.requestId : "";
    await setup.query(
      `update action_permits set issued_at = issued_at - interval '2 hours' where tenant_id = $1`,
      [acme.tenantId],
    );
    assert.equal(
      await reasonOf(thirdId),
      "standing-authorization-exhausted",
      "the quota is a ceiling the issuer enforces behind its lock",
    );

    /* WITHDRAWN: the envelope is taken back, and the next candidate is refused for that reason. */
    const withdrawal = await writeStandingMutationAuthorization(
      ctx,
      "withdrawn",
      {
        agentId,
        actionKind: RECORD_WORK_ACTION_KIND,
        notBefore: new Date(NOW.getTime() - 60_000),
        notAfter: new Date(NOW.getTime() + 86_400_000),
        maxActs: 2,
        minIntervalMinutes: 1,
        justification: "This organization takes the standing authorization back.",
        observedRevision: 1,
      },
      deps,
    );
    assert.equal(withdrawal.status, "written", JSON.stringify(withdrawal));

    const afterWithdrawal = await proposeAgentOriginatedObservationWorkAction(
      ctx,
      { title: "Work after withdrawal", observationRef: await freshObservationRef() },
      proposer!,
      deps,
    );
    const afterWithdrawalId =
      afterWithdrawal.status === "proposed" ? afterWithdrawal.receipt.requestId : "";
    assert.equal(
      await reasonOf(afterWithdrawalId),
      "standing-authorization-withdrawn",
      "withdrawal is its own refusal — never collapsed into 'no envelope'",
    );

    /* ════════════════════════════════════════════════════════════════════════
     * 7 · CROSS-TENANT: ANOTHER ORGANIZATION'S ENVELOPE REACHES NOTHING HERE
     * ══════════════════════════════════════════════════════════════════════ */

    const other = (await seedLocalIdentity(setup, {
      companyName: "Beta",
      companySlug: "beta-rung2-actpath",
      email: "director@beta-rung2-actpath.test",
    })) as Seeded;
    const otherCtx = contextFor(other, await sessionRowFor(setup, other, "bbbb"), "rung2-other");

    const otherCandidates = await buildOriginationCandidates(otherCtx, { observations: { getDb } });
    assert.equal(
      otherCandidates.work.observations.length,
      0,
      "another organization's observations are invisible — the read seam's tenant predicate, unchanged",
    );

    const otherDiscovery = await listStandingIssuableRequestsForRuntime({ getDb });
    assert.equal(otherDiscovery.status, "read");
    for (const candidate of otherDiscovery.status === "read" ? otherDiscovery.requests : []) {
      assert.equal(
        candidate.tenantId,
        acme.tenantId,
        "discovery never attributes one organization's request to another",
      );
    }

    /* ── AND NOTHING IN ANY OF THIS EXECUTED ANYTHING ─────────────────────── */
    assert.equal(await countOf("work_items"), 0, "the whole file recorded no work");

    console.log(
      "PASS rung2 act path — observation → agent proposal → envelope → trigger → issuer → one " +
        "ordinary permit, and every refusal on its own terms",
    );
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose?.().catch(() => {});
    harness.dropDatabase();
  }
}

void main();
