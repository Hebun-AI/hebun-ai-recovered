/*
 * AMA-3 — A HUMAN RECORDS A MANDATE, AGAINST A REAL DATABASE.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The human the organization established as its Governance authority can record and revise an
 *    agent's mandate through the released writer the product fronts, and nobody else can. A stale
 *    revision fails closed. A revision creates a NEW immutable row and leaves its predecessor
 *    byte-identical. The agent row is untouched. Nothing is authorized, permitted or executed by
 *    any of it. And Heby's grounding, read from the same rows, reports the effective ceiling — and
 *    reports the absence and the outage as three different things."
 *
 * The pins:
 *
 *   MANDATE     != PERMISSION
 *   MANDATE     != AUTHORIZATION
 *   MANDATE     != EXECUTION AUTHORITY
 *   NO MANDATE  != UNLIMITED MANDATE
 *   UNAVAILABLE != NO MANDATE
 *   SEEDED      != DURABLE
 *
 * Every row is produced by the released writer that owns it. No adapter, no network, no model.
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { establishAgentMandate } from "../../src/features/agent-mandate/establish-agent-mandate.server";
import {
  readAgentMandateHistory,
  readEffectiveAgentMandate,
} from "../../src/features/agent-mandate/read-agent-mandate.server";
import { readAgentMandateGroundingSource } from "../../src/features/agent-mandate/heby-mandate-source.server";
import { AGENT_ORIGINABLE_ACTION_KINDS } from "../../src/features/agent-origination/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-08-31T12:00:00.000Z");

const GOVERNANCE_JUSTIFICATION =
  "I am establishing this organization's Governance authority and I accept responsibility for it.";
const MANDATE_JUSTIFICATION =
  "I am bounding what this agent exists to do, and I accept responsibility for that bound.";
const PURPOSE =
  "Draft and propose outbound customer correspondence for review. It proposes; a human decides.";
const REVISED_PURPOSE =
  "Draft and propose outbound correspondence only for accounts already in an active conversation.";
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
  const harness = createDisposablePostgresHarness("hebun_ama3_product");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);

  const dbDeps = { getDb: () => handle.db } as never;
  const writeDeps = { getDb: () => handle.db, now: () => NOW } as never;

  const agentRow = async (agentId: string) =>
    (
      await setup.query(
        `select id, tenant_id, name, agent_lifecycle_status, retired_at, created_by, created_by_type,
                authority_ceiling
           from agents where id = $1`,
        [agentId],
      )
    ).rows[0];

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-ama3",
      email: "director@acme.test",
    })) as Seeded;
    /* A second human in the SAME organization — authenticated, and not the Governance authority. */
    const stranger = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-ama3",
      email: "other@globex.test",
    })) as Seeded;

    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "ama3-acme");
    const strangerCtx = contextFor(
      stranger,
      await sessionRowFor(setup, stranger, "bbbb"),
      "ama3-stranger",
    );

    const established = await createDurableAgentIdentity(acmeCtx, { name: "Heby" }, dbDeps);
    assert.equal(established.status, "established");
    const agentId = established.status === "established" ? established.identity.agentId : "";
    const agentBefore = await agentRow(agentId);

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. BEFORE ANY MANDATE: A KNOWN ABSENCE, AND IT IS NOT A PERMISSION.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const effective = await readEffectiveAgentMandate(acmeCtx, agentId, dbDeps);
      assert.equal(effective.status, "known", "the authority ANSWERED");
      assert.equal(
        effective.status === "known" ? effective.mandate : undefined,
        null,
        "and nobody has bounded this agent — a real answer, never an outage",
      );

      const grounding = await readAgentMandateGroundingSource(acmeCtx, dbDeps as never);
      assert.equal(grounding.state, "resolved");
      assert.ok(
        grounding.items[0]!.detail.includes("propose NOTHING"),
        "NO MANDATE != UNLIMITED MANDATE, from real rows",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. WITHOUT GOVERNANCE AUTHORITY, NO HUMAN MAY RECORD A MANDATE.
     *
     * Asserted BEFORE the authority is established, so the refusal is the organization's real
     * state rather than a contrived one.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const refused = await establishAgentMandate(
        acmeCtx,
        {
          agentId,
          purpose: PURPOSE,
          proposalScope: [...AGENT_ORIGINABLE_ACTION_KINDS],
          justification: MANDATE_JUSTIFICATION,
          observedMandateRevision: null,
        },
        writeDeps,
      );
      assert.equal(refused.status, "refused");
      assert.equal(
        refused.status === "refused" ? refused.reason : "",
        "no-governance-authority",
        "an organization with no Governance authority can bound nothing",
      );
      assert.equal(
        (await setup.query(`select count(*)::int as n from agent_mandates`)).rows[0]!.n,
        0,
        "and nothing was written",
      );
    }

    /* ── Establish Governance authority, as a human ceremony. ─────────────── */
    for (const [seeded, ctx] of [
      [acme, acmeCtx],
      [stranger, strangerCtx],
    ] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
      );
      assert.equal(
        (await establishGovernanceAuthority(ctx, { justification: GOVERNANCE_JUSTIFICATION }, dbDeps))
          .status,
        "established",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. THE GOVERNANCE AUTHORITY RECORDS THE FIRST MANDATE.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const result = await establishAgentMandate(
        acmeCtx,
        {
          agentId,
          purpose: PURPOSE,
          proposalScope: [...AGENT_ORIGINABLE_ACTION_KINDS],
          justification: MANDATE_JUSTIFICATION,
          observedMandateRevision: null,
        },
        writeDeps,
      );
      assert.equal(result.status, "established", "the human product workflow's writer succeeds");
      assert.equal(result.status === "established" ? result.mandate.mandateRevision : 0, 1);
      assert.equal(
        result.status === "established" ? result.mandate.supersedesMandateId : "x",
        null,
        "the first revision supersedes nothing",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. ANOTHER TENANT'S HUMAN — AUTHENTICATED, WITH THEIR OWN GOVERNANCE
     *    AUTHORITY — STILL CANNOT BOUND THIS AGENT.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const foreign = await establishAgentMandate(
        strangerCtx,
        {
          agentId,
          purpose: REVISED_PURPOSE,
          proposalScope: [],
          justification: MANDATE_JUSTIFICATION,
          observedMandateRevision: 1,
        },
        writeDeps,
      );
      assert.equal(foreign.status, "refused");
      assert.equal(
        foreign.status === "refused" ? foreign.reason : "",
        "agent-unresolvable",
        "another organization's agent selects no row — indistinguishable from one that never existed",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. A STALE OBSERVED REVISION FAILS CLOSED, AND OVERWRITES NOTHING.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const stale = await establishAgentMandate(
        acmeCtx,
        {
          agentId,
          purpose: REVISED_PURPOSE,
          proposalScope: [],
          justification: MANDATE_JUSTIFICATION,
          /* The reader believed there was no mandate; there is one. */
          observedMandateRevision: null,
        },
        writeDeps,
      );
      assert.equal(stale.status, "refused");
      assert.equal(
        stale.status === "refused" ? stale.reason : "",
        "stale-mandate-revision",
        "a ceiling that moved since the human was shown it is REFUSED, never merged",
      );
      const effective = await readEffectiveAgentMandate(acmeCtx, agentId, dbDeps);
      assert.equal(
        effective.status === "known" ? effective.mandate?.mandateRevision : 0,
        1,
        "and the effective revision is untouched",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. A REVISION IS A NEW IMMUTABLE ROW; THE PREDECESSOR IS BYTE-IDENTICAL.
     * ═════════════════════════════════════════════════════════════════════ */
    const revisionOneBefore = (
      await setup.query(
        `select id, purpose, proposal_scope, effective_from, governance_decision_id,
                governance_session_id, established_by_actor_id, supersedes_mandate_id
           from agent_mandates where agent_id = $1 and mandate_revision = 1`,
        [agentId],
      )
    ).rows[0];

    {
      const revised = await establishAgentMandate(
        acmeCtx,
        {
          agentId,
          purpose: REVISED_PURPOSE,
          proposalScope: [...AGENT_ORIGINABLE_ACTION_KINDS],
          justification: MANDATE_JUSTIFICATION,
          observedMandateRevision: 1,
        },
        writeDeps,
      );
      assert.equal(revised.status, "established");
      assert.equal(revised.status === "established" ? revised.mandate.mandateRevision : 0, 2);

      const revisionOneAfter = (
        await setup.query(
          `select id, purpose, proposal_scope, effective_from, governance_decision_id,
                  governance_session_id, established_by_actor_id, supersedes_mandate_id
             from agent_mandates where agent_id = $1 and mandate_revision = 1`,
          [agentId],
        )
      ).rows[0];
      assert.deepEqual(
        revisionOneAfter,
        revisionOneBefore,
        "REVISION 1 IS BYTE-IDENTICAL — a superseding write never edits its predecessor",
      );

      /* And it is still readable, which is what makes a change reviewable. */
      const history = await readAgentMandateHistory(acmeCtx, agentId, dbDeps);
      assert.equal(history.status, "known");
      assert.deepEqual(
        history.status === "known" ? history.revisions.map((r) => r.mandateRevision) : [],
        [2, 1],
        "history is newest-first and complete",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. WITHDRAWAL IS AN EMPTY SCOPE, AND HEBY READS IT AS A DECISION.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const withdrawn = await establishAgentMandate(
        acmeCtx,
        {
          agentId,
          purpose: WITHDRAWAL_PURPOSE,
          proposalScope: [],
          justification: MANDATE_JUSTIFICATION,
          observedMandateRevision: 2,
        },
        writeDeps,
      );
      assert.equal(withdrawn.status, "established", "withdrawal is a revision, not a deletion");

      const grounding = await readAgentMandateGroundingSource(acmeCtx, dbDeps as never);
      assert.equal(grounding.state, "resolved");
      assert.equal(grounding.authoritative, true, "a recorded mandate is authoritative");
      const effectiveItem = grounding.items[0]!;
      assert.ok(
        effectiveItem.detail.includes("by decision rather than by absence"),
        "an empty ceiling reads as a DECISION, distinguishable from nobody having bounded it",
      );
      /* The two superseded revisions are cited, and labelled as superseded. */
      const superseded = grounding.items.filter((item) => item.lifecycle === "superseded");
      assert.equal(superseded.length, 2, "both earlier revisions ground, as history");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. NONE OF IT AUTHORIZED, PERMITTED OR EXECUTED ANYTHING — AND THE
     *    AGENT ROW IS UNCHANGED.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      assert.deepEqual(
        await agentRow(agentId),
        agentBefore,
        "THE AGENT ROW IS BYTE-IDENTICAL — bounding an agent never changes the agent",
      );

      const counts = await setup.query<{
        permits: number;
        attempts: number;
        requests: number;
        permissions: number;
        rolePermissions: number;
        mandates: number;
      }>(
        `select (select count(*)::int from action_permits) as permits,
                (select count(*)::int from action_execution_attempts) as attempts,
                (select count(*)::int from heby_action_requests) as requests,
                (select count(*)::int from permissions) as permissions,
                (select count(*)::int from role_permissions) as "rolePermissions",
                (select count(*)::int from agent_mandates) as mandates`,
      );
      const c = counts.rows[0]!;
      assert.equal(c.permits, 0, "NO PERMIT — MANDATE != AUTHORIZATION");
      assert.equal(c.attempts, 0, "NOTHING EXECUTED — MANDATE != EXECUTION AUTHORITY");
      assert.equal(c.requests, 0, "and no proposal was filed by recording a ceiling");
      assert.equal(c.permissions, 0, "MANDATE != PERMISSION — the catalog stays inert");
      assert.equal(c.rolePermissions, 0, "and so does the role catalog");
      assert.equal(c.mandates, 3, "exactly the three revisions a human recorded");

      /*
       * `agents.authority_ceiling` gained no writer. AMA-1 banned the identifier inside the mandate
       * feature because a reader summarizes that column into canonical actor resolution; the
       * product connection must not have started filling it.
       */
      const ceilings = await setup.query<{ n: number }>(
        `select count(*)::int as n from agents where authority_ceiling is not null`,
      );
      assert.equal(ceilings.rows[0]!.n, 0, "authority_ceiling is still unwritten");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 9. UNAVAILABLE IS STILL NOT ABSENCE, AGAINST A REAL DATABASE.
     *
     * The mandate table alone goes dark while every other table stays healthy — the state a
     * surface that merged the two would render as "this organization declined to bound its agent".
     * ═════════════════════════════════════════════════════════════════════ */
    {
      await setup.query(`alter table agent_mandates rename to agent_mandates_hidden`);
      try {
        const effective = await readEffectiveAgentMandate(acmeCtx, agentId, dbDeps);
        assert.equal(effective.status, "unavailable", "the read reports an outage");

        const grounding = await readAgentMandateGroundingSource(acmeCtx, dbDeps as never);
        assert.equal(grounding.state, "unavailable");
        assert.deepEqual(grounding.items, [], "an outage cites nothing");
        assert.ok(
          grounding.unavailableReason?.includes("UNAVAILABLE is not NO MANDATE"),
          "and says so in the reason itself",
        );
      } finally {
        await setup.query(`alter table agent_mandates_hidden rename to agent_mandates`);
      }
    }

    console.log("ama3-mandate-product/product-postgres: OK");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
