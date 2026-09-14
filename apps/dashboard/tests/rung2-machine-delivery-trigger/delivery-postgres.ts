/*
 * RUNG 2 — the automatic delivery trigger against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Discovery finds exactly the permits a machine may be handed: active, UNEXPIRED, agent-proposed
 *    and of a machine-executable kind. A stored-`active`-but-EXPIRED permit is not discoverable —
 *    the case that would otherwise loop forever. Consumed, revoked, human-proposed and
 *    wrong-kind permits are not discoverable. Discovery is bounded and ordered oldest-first.
 *
 *    A scan through the released executor spends each discovered permit exactly once and records
 *    exactly one work item. Two scans racing the same permit produce ONE spend and ONE work item —
 *    without the trigger holding any lock, claim or state of its own. A disarmed deployment
 *    delivers nothing and burns nothing. And the trigger writes no table of its own: the row counts
 *    that move are the released authorities', and no claim column exists to move."
 *
 * The database, the authorities, the executor and the concurrency are all REAL.
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
import { recordDepartment } from "../../src/features/organization-authority/write-structure.server";
import { formatDepartmentRef } from "../../src/features/organization-authority/department-ref";
import {
  proposeAgentOriginatedRecordWorkAction,
  proposeRecordWorkAction,
} from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { revokeActionPermit } from "../../src/features/action-authorization/revoke-action-permit.server";
import { authorizeTenantMachineExecution } from "../../src/features/tenant-machine-execution-authority/authorize-tenant-machine-execution.server";
import { listMachineDeliverablePermitsForRuntime } from "../../src/features/action-authorization/read-machine-deliverable-permits.server";
import { scanDeliverablePermits } from "../../src/features/machine-delivery-trigger/scan-deliverable-permits.server";
import { RECORD_WORK_ACTION_KIND } from "../../src/features/heby-action-inlet/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date();
const GENESIS =
  "This organization establishes its founding Governance authority for the automatic delivery proof.";
const APPROVAL = "This work is real and this organization authorizes Hebun to put it on the register.";
const ENROLMENT =
  "Acme agrees that work it has already authorized may be delivered by machine, and I accept responsibility for that.";

const ARMED = { armed: async () => true };
const DISARMED = { armed: async () => false };

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
      /* A 64-character lowercase-hex digest: the column is fixed width and CHECK-constrained. */
      tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a"),
      seeded.userId,
      seeded.tenantId,
      seeded.membershipId,
    ],
  );
  return row.rows[0]!.id;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_rung2_delivery");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;
  const getDb = () => handle.db;

  try {
    await setup.connect();

    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-rung2-delivery",
      email: "director@acme-rung2-delivery.test",
    })) as Seeded;
    const ctx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "rung2-delivery");

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
      "Acme's own Governance enrolled it in machine delivery",
    );

    const dept = await recordDepartment(ctx, { name: "Finance", slug: "finance" }, deps);
    assert.equal(dept.status, "recorded");
    const departmentRef = formatDepartmentRef(
      dept.status === "recorded" ? dept.department.departmentId : "",
    );

    const agent = await createDurableAgentIdentity(ctx, { name: "Heby" }, deps);
    assert.equal(agent.status, "established");
    const agentId = agent.status === "established" ? agent.identity.agentId : "";
    await seedAgentMandate(setup, acme, agentId, deps, {
      tag: "rung2delivery",
      now: NOW,
      proposalScope: ["record-work"],
    });
    const resolved = await resolveAgentProposer(ctx, deps);
    assert.equal(resolved.status, "resolved");
    const proposer = resolved.status === "resolved" ? resolved.proposer : null;
    assert.ok(proposer);

    const countOf = async (table: string): Promise<number> =>
      Number((await setup.query(`select count(*)::int n from ${table}`)).rows[0]!.n);
    const permitRow = async (id: string) =>
      (await setup.query(`select status, consumed_at from action_permits where id = $1`, [id]))
        .rows[0] as { status: string; consumed_at: string | null };
    const discovered = async (): Promise<readonly string[]> => {
      const result = await listMachineDeliverablePermitsForRuntime({ getDb });
      assert.equal(result.status, "read", "discovery must be readable in these cases");
      return result.status === "read" ? result.permits.map((p) => p.permitId) : [];
    };

    /** An AGENT-proposed, Director-authorized record-work permit. */
    const agentPermit = async (title: string): Promise<string> => {
      const proposal = await proposeAgentOriginatedRecordWorkAction(
        ctx,
        { title, department: { kind: "department", departmentRef } },
        proposer!,
        deps,
      );
      assert.equal(proposal.status, "proposed", JSON.stringify(proposal));
      const approval = await approveActionRequest(
        ctx,
        { requestId: proposal.status === "proposed" ? proposal.receipt.requestId : "", justification: APPROVAL },
        deps,
      );
      assert.equal(approval.status, "authorized", JSON.stringify(approval));
      return approval.status === "authorized" ? approval.permitId : "";
    };

    /** A HUMAN-proposed one, through the released human inlet. */
    const humanPermit = async (title: string): Promise<string> => {
      const proposal = await proposeRecordWorkAction(
        ctx,
        { title, department: { kind: "department", departmentRef } },
        deps,
      );
      assert.equal(proposal.status, "proposed", JSON.stringify(proposal));
      const approval = await approveActionRequest(
        ctx,
        { requestId: proposal.status === "proposed" ? proposal.receipt.requestId : "", justification: APPROVAL },
        deps,
      );
      assert.equal(approval.status, "authorized", JSON.stringify(approval));
      return approval.status === "authorized" ? approval.permitId : "";
    };

    /* ═══ 1. NOTHING IS DISCOVERABLE BEFORE ANYTHING IS AUTHORIZED ═════════ */
    assert.deepEqual(await discovered(), [], "an empty deployment offers no candidates");

    /* ═══ 2. AN ACTIVE AGENT-PROPOSED record-work PERMIT IS DISCOVERABLE ═══ */
    const live = await agentPermit("Deliverable work");
    assert.deepEqual(await discovered(), [live], "exactly the one eligible permit is found");

    /* ═══ 3. STORED-ACTIVE BUT EXPIRED IS NOT DISCOVERABLE ═════════════════
     *
     * THE CASE THAT WOULD OTHERWISE LOOP FOREVER. Expiry is DERIVED, never swept: no job rewrites
     * `status` when a permit lapses, so this row keeps saying `active` indefinitely. Production
     * holds exactly such a row. A predicate without the clock would rediscover it every tick.
     */
    const expired = await agentPermit("Lapsed before any tick reached it");
    /*
     * BOTH TIMESTAMPS MOVE. `action_permits_expiry_after_issue_chk` refuses an expiry that precedes
     * its issue, so the database will not hold an incoherent row even for a fixture — which makes
     * this the faithful shape: issued in the past, lapsed in the past, still saying `active`.
     */
    await setup.query(
      `update action_permits
          set issued_at = now() - interval '3 hours', expires_at = now() - interval '1 hour'
        where id = $1`,
      [expired],
    );
    assert.equal(
      (await permitRow(expired)).status,
      "active",
      "the stored column still says active — which is exactly the trap",
    );
    assert.deepEqual(
      await discovered(),
      [live],
      "and the expired permit is NOT a candidate: `expires_at > now()` is applied in the database",
    );

    /* ═══ 4. REVOKED AND HUMAN-PROPOSED ARE NOT DISCOVERABLE ═══════════════ */
    const revoked = await agentPermit("Withdrawn before delivery");
    /*
     * REVOKED THROUGH THE RELEASED SEAM, not by a raw UPDATE. `action_permits_revoked_chk` refuses a
     * `revoked` row without its revocation provenance, so the database would not hold a hand-made
     * one — and the released writer is the only thing entitled to produce the real shape anyway.
     */
    assert.equal(
      (
        await revokeActionPermit(
          ctx,
          {
            permitId: revoked,
            justification:
              "We are withdrawing this authorization before anything delivers it, and I accept responsibility for that.",
            revocationReason: "withdrawn before delivery",
          },
          deps,
        )
      ).status,
      "revoked",
    );
    const byHuman = await humanPermit("A human's own act to perform");
    assert.deepEqual(
      await discovered(),
      [live],
      "a revoked permit and a human-proposed one are both outside the machine's reach",
    );

    /* ═══ 5. AN UNSUPPORTED ACTION KIND IS NOT DISCOVERABLE ════════════════
     *
     * Forced at the row level: the frozen set admits only `record-work`, and the released inlets
     * cannot file anything else as an agent proposal. Rewriting the kind proves the DISCOVERY
     * predicate consults the set rather than assuming what the inlet allows.
     */
    const widened = await agentPermit("An act no machine may perform");
    await setup.query(
      `update heby_action_requests set action_kind = 'send-external-communication'
        where id = (select action_request_id from action_permits where id = $1)`,
      [widened],
    );
    assert.deepEqual(
      await discovered(),
      [live],
      "the frozen machine-executable set is consulted by the discovery predicate",
    );

    /* ═══ 6. ORDER IS OLDEST-FIRST AND THE RESULT IS BOUNDED ═══════════════ */
    const second = await agentPermit("Authorized later");
    assert.deepEqual(await discovered(), [live, second], "oldest issued permit first — nothing starves");
    {
      const capped = await listMachineDeliverablePermitsForRuntime({ getDb, limit: 1 });
      assert.equal(capped.status === "read" && capped.permits.length, 1, "the scan is bounded");
      assert.equal(
        capped.status === "read" && capped.permits[0]!.permitId,
        live,
        "and the bound keeps the oldest, not an arbitrary row",
      );
    }

    /* ═══ 7. A DISARMED DEPLOYMENT DELIVERS NOTHING AND BURNS NOTHING ══════ */
    const workBefore = await countOf("work_items");
    {
      const scan = await scanDeliverablePermits({
        getDb,
        executorDeps: { getDb, ...DISARMED } as never,
      });
      assert.equal(scan.status, "scanned");
      assert.equal(scan.status === "scanned" && scan.considered, 2, "both candidates were offered");
      assert.equal(scan.status === "scanned" && scan.delivered, 0, "and none was delivered");
      assert.ok(
        scan.status === "scanned" &&
          scan.outcomes.every(
            (o) => o.outcome.status === "refused" && o.outcome.reason === "machine-execution-disarmed",
          ),
        "the executor refused every one at the root control",
      );
      assert.equal((await permitRow(live)).status, "active", "no permit was burned to discover that");
      assert.equal(await countOf("work_items"), workBefore, "and no work was recorded");
    }

    /* ═══ 8. ARMED: EACH PERMIT IS SPENT ONCE, AND WORK EXISTS ═════════════ */
    {
      const scan = await scanDeliverablePermits({
        getDb,
        executorDeps: { getDb, ...ARMED } as never,
      });
      assert.equal(scan.status === "scanned" && scan.delivered, 2, "both eligible permits delivered");
      assert.equal((await permitRow(live)).status, "consumed");
      assert.equal((await permitRow(second)).status, "consumed");
      assert.equal(await countOf("work_items"), workBefore + 2, "exactly one work item per spend");
      assert.deepEqual(await discovered(), [], "and a consumed permit is no longer a candidate");
      /* The ineligible rows are untouched by all of it. */
      assert.equal((await permitRow(expired)).status, "active");
      assert.equal((await permitRow(revoked)).status, "revoked");
      assert.equal((await permitRow(byHuman)).status, "active");
      assert.equal((await permitRow(widened)).status, "active");
    }

    /* ═══ 9. TWO SCANS RACING ONE PERMIT: ONE SPEND, ONE WORK ITEM ═════════
     *
     * NO LOCK, NO CLAIM, NO COORDINATION. The released single spend is a conditional UPDATE whose
     * row count is the verdict; the loser matches zero rows and is refused. That is the whole
     * concurrency story, and it is the authority's, not the trigger's.
     */
    {
      const contested = await agentPermit("Two triggers want this one");
      const workNow = await countOf("work_items");
      const [a, b] = await Promise.all([
        scanDeliverablePermits({ getDb, executorDeps: { getDb, ...ARMED } as never }),
        scanDeliverablePermits({ getDb, executorDeps: { getDb, ...ARMED } as never }),
      ]);
      const delivered =
        (a.status === "scanned" ? a.delivered : 0) + (b.status === "scanned" ? b.delivered : 0);
      assert.equal(delivered, 1, "exactly ONE of two concurrent scans spent the permit");
      assert.equal((await permitRow(contested)).status, "consumed");
      assert.equal(await countOf("work_items"), workNow + 1, "and exactly one work item exists");
    }

    /* ═══ 10. THE TRIGGER OWNS NO PERSISTENCE ══════════════════════════════
     *
     * Not asserted by reading the trigger's source — that is the firewall's job — but by asking the
     * DATABASE whether anything shaped like scheduler bookkeeping was created.
     */
    {
      const tables = (
        await setup.query<{ table_name: string }>(
          `select table_name from information_schema.tables
            where table_schema = 'public'
              and (table_name like '%delivery%' or table_name like '%claim%'
                   or table_name like '%queue%' or table_name like '%job%'
                   or table_name like '%scan%' or table_name like '%trigger%')`,
        )
      ).rows.map((r) => r.table_name);
      assert.deepEqual(tables, [], "the trigger created no table of its own");

      const columns = (
        await setup.query<{ column_name: string }>(
          `select column_name from information_schema.columns
            where table_schema = 'public' and table_name = 'action_permits'`,
        )
      ).rows.map((r) => r.column_name);
      for (const invented of ["claimed_at", "claimed_by", "delivery_status", "attempts", "locked_at"]) {
        assert.ok(!columns.includes(invented), `no \`${invented}\` claim column was invented`);
      }
    }

    console.log(
      "rung2 machine delivery trigger — postgres: expired/revoked/human-proposed/wrong-kind are " +
        "not discoverable, discovery is bounded and oldest-first, disarmed burns nothing, armed " +
        "spends each permit once with one work item, two racing scans yield one spend, and the " +
        "trigger owns no table, column or claim",
    );
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose?.().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
