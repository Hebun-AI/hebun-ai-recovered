/*
 * AGENT-ID-0.1 — retiring a durable, human-owned agent identity, proved against a REAL PostgreSQL.
 *
 * ── WHY THIS MUST BE A DATABASE TEST ─────────────────────────────────────────
 *
 * Every claim this phase makes is a claim about a row that still exists:
 *
 *   · RETIREMENT IS NOT DELETION — provable only by reading the row back after retiring it and
 *     finding the name, the owner, the creator and `deleted_at IS NULL` exactly as they were;
 *   · (AP-1, inverted) RETIREMENT NEVER REOPENS AN IDENTITY — a retired name may be registered
 *     again, but only as a NEW identity with a new id; the retired row is untouched;
 *   · the columns retirement declines to write are NULL in a real row, not merely absent from an
 *     object literal;
 *   · concurrent retirements of the same identity produce exactly ONE retirement — proved at a
 *     barrier held inside the transactions, because a plain `Promise.all` was MEASURED not to
 *     interleave at all and therefore proved nothing;
 *   · retiring an identity issues no credential, opens no session, grants no permit and records no
 *     governance decision — provable only by counting real tables.
 *
 * A disposable local database, dropped on exit. No production data, no provider contacted.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { seedGovernanceBootstrapRows } from "../helpers/agent-mandate-seed";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { retireDurableAgentIdentity } from "../../src/features/agent-identity/retire-durable-agent-identity.server";
import { readDurableAgentIdentityState } from "../../src/features/agent-identity/read-durable-agent-identity.server";
import {
  asHumanTenantContext,
  type TenantContext,
} from "../../src/features/auth/tenant/tenant-context";

const TENANT_A = "10000000-0000-4000-8000-0000000a1d11";
const TENANT_B = "10000000-0000-4000-8000-0000000a1d12";
const OWNER_A = "20000000-0000-4000-8000-0000000a1d11";
const OTHER_A = "20000000-0000-4000-8000-0000000a1d13";
const OWNER_B = "20000000-0000-4000-8000-0000000a1d12";
const ABSENT_AGENT = "30000000-0000-4000-8000-00000000dead";
const CREATED_AT = new Date("2026-08-27T09:00:00.000Z");
const RETIRED_AT = new Date("2026-08-27T11:30:00.000Z");

function tenantContext(tenantId: string, userId: string): TenantContext {
  return asHumanTenantContext({
    tenantId,
    userId,
    authIdentityId: "auth-identity",
    membershipId: "membership",
    membershipVersion: 1,
    roleId: "role",
    sessionContextId: "session",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "agent-id-0-1",
    authenticatedAt: CREATED_AT.toISOString(),
  });
}

/**
 * What AGENT-ID-0 wrote, and what retirement must leave EXACTLY as it found it. This is the
 * "retirement is not deletion, and does not erase history" claim, expressed as columns.
 */
const SURVIVES_RETIREMENT = [
  "tenant_id",
  "name",
  "human_owner_type",
  "human_owner_id",
  "created_by",
  "created_by_type",
  "created_at",
  "lifecycle_status",
] as const;

/**
 * Columns retirement must NEVER write. `deleted_*` would make a withdrawal look like a deletion;
 * `replaced_by_agent_id` would fabricate a successor that does not exist; `suspended_at` is a
 * different transition this authority does not own.
 */
const MUST_STAY_EMPTY_AFTER_RETIREMENT = [
  "deleted_at",
  "deleted_by",
  "deleted_by_type",
  "replaced_by_agent_id",
  "suspended_at",
  "manager_actor_type",
  "manager_actor_id",
  "department_id",
  "authority_ceiling",
  "agent_type",
  "risk_level",
  "agent_health",
  "execution_posture",
  "allowed_tools",
  "tool_profile",
  "reasoning_profile",
  "working_memory_profile",
] as const;

/** Tables retirement must not touch. Withdrawing an identity buys and spends nothing. */
const MUST_STAY_UNTOUCHED = [
  "auth_credentials",
  "auth_identities",
  "user_session_contexts",
  "memberships",
  "roles",
  "role_permissions",
  "permissions",
  "action_permits",
  "heby_action_requests",
  "action_execution_attempts",
  "decision_records",
  "audit_log",
] as const;

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_agentid01_retirement");
  await harness.createDatabase();

  try {
    harness.migrateDatabase();

    const seed = new Client({ connectionString: harness.dbUrl });
    await seed.connect();
    try {
      await seed.query(
        `insert into companies (id, name, slug)
         values ($1, 'Tenant A', 'agent-id-01-a'), ($2, 'Tenant B', 'agent-id-01-b')`,
        [TENANT_A, TENANT_B],
      );
      await seed.query(
        `insert into users (id, email, name)
         values ($1, 'owner-a@example.com', 'Owner A'),
                ($2, 'other-a@example.com', 'Other A'),
                ($3, 'owner-b@example.com', 'Owner B')`,
        [OWNER_A, OTHER_A, OWNER_B],
      );
      /*
       * APF-1 — creating and retiring an agent need the organization's Governance authority. Each
       * owner holds it; OTHER_A deliberately does not, so the non-owner refusal below is unchanged.
       */
      await seedGovernanceBootstrapRows(seed, TENANT_A, OWNER_A);
      await seedGovernanceBootstrapRows(seed, TENANT_B, OWNER_B);
    } finally {
      await seed.end();
    }

    const handle = createControlPlaneDb(harness.dbUrl);
    const probe = new Client({ connectionString: harness.dbUrl });
    await probe.connect();

    try {
      const createDeps = { getDb: () => handle.db };
      const retireDeps = { getDb: () => handle.db, now: () => RETIRED_AT };
      const A = tenantContext(TENANT_A, OWNER_A);
      const A_OTHER = tenantContext(TENANT_A, OTHER_A);
      const B = tenantContext(TENANT_B, OWNER_B);

      const countOf = async (table: string): Promise<number> => {
        const { rows } = await probe.query(`select count(*)::int as total from ${table}`);
        return rows[0].total as number;
      };
      const rowOf = async (agentId: string, columns: readonly string[]) => {
        const { rows } = await probe.query(
          `select ${columns.map((c) => `"${c}"`).join(", ")} from agents where id = $1`,
          [agentId],
        );
        assert.equal(rows.length, 1, "the identity row still exists — retirement deletes nothing");
        return rows[0] as Record<string, unknown>;
      };

      /* ── 0. TWO TENANTS EACH ESTABLISH ONE IDENTITY ───────────────────────── */
      const madeA = await createDurableAgentIdentity(A, { name: "Atlas", justification: "Register this agent for the test organization." }, createDeps);
      assert.equal(madeA.status, "established", "Tenant A establishes its durable identity");
      if (madeA.status !== "established") throw new Error("unreachable");
      const madeB = await createDurableAgentIdentity(B, { name: "Borea", justification: "Register this agent for the test organization." }, createDeps);
      assert.equal(madeB.status, "established", "Tenant B establishes its durable identity");
      if (madeB.status !== "established") throw new Error("unreachable");

      const AGENT_A = madeA.identity.agentId;
      const AGENT_B = madeB.identity.agentId;
      const beforeRetirement = await rowOf(AGENT_A, SURVIVES_RETIREMENT);

      /* ── 1. REFUSALS COME FIRST, AND NOTHING IS WRITTEN ───────────────────── */
      assert.deepEqual(
        await retireDurableAgentIdentity(null, { agentId: AGENT_A, justification: "Retiring this agent for the test organization (L-1b requires a reason)." }, retireDeps),
        { status: "refused", reason: "no-authorized-tenant-context" },
        "without a server-resolved context there is no human on whose authority to retire",
      );

      for (const bad of ["", "not-a-uuid", `${AGENT_A} `, 7, null, undefined, {}]) {
        assert.deepEqual(
          await retireDurableAgentIdentity(A, { agentId: bad, justification: "Retiring this agent for the test organization (L-1b requires a reason)." }, retireDeps),
          { status: "refused", reason: "malformed-agent-id" },
          `a malformed identifier is refused rather than coerced: ${JSON.stringify(bad)}`,
        );
      }

      assert.deepEqual(
        await retireDurableAgentIdentity(A, { agentId: ABSENT_AGENT, justification: "Retiring this agent for the test organization (L-1b requires a reason)." }, retireDeps),
        { status: "refused", reason: "agent-identity-not-found" },
        "an identifier naming no row is refused",
      );

      /*
       * THE CROSS-TENANT REFUSAL IS THE SAME REFUSAL, BYTE FOR BYTE. A distinct reason would turn
       * this authority into an oracle for which identity uuids exist in other organizations.
       */
      const crossTenant = await retireDurableAgentIdentity(A, { agentId: AGENT_B, justification: "Retiring this agent for the test organization (L-1b requires a reason)." }, retireDeps);
      assert.deepEqual(
        crossTenant,
        { status: "refused", reason: "agent-identity-not-found" },
        "another organization's identity is refused indistinguishably from one that does not exist",
      );

      assert.deepEqual(
        await retireDurableAgentIdentity(A_OTHER, { agentId: AGENT_A, justification: "Retiring this agent for the test organization (L-1b requires a reason)." }, retireDeps),
        { status: "refused", reason: "not-the-human-owner" },
        "a different human in the SAME organization may not retire an identity they do not own",
      );

      assert.deepEqual(
        await rowOf(AGENT_A, SURVIVES_RETIREMENT),
        beforeRetirement,
        "every refusal so far changed nothing — a refused retirement leaves the row untouched",
      );
      assert.equal(
        (await rowOf(AGENT_A, ["retired_at", "agent_lifecycle_status"])).retired_at,
        null,
        "the identity is still in service after the refusals",
      );

      /* ── 2. THE OWNER RETIRES THE IDENTITY ────────────────────────────────── */
      const retired = await retireDurableAgentIdentity(A, { agentId: AGENT_A, justification: "Retiring this agent for the test organization (L-1b requires a reason)." }, retireDeps);
      assert.equal(retired.status, "retired", "the human owner may retire their own identity");
      if (retired.status !== "retired") throw new Error("unreachable");
      assert.deepEqual(
        {
          agentId: retired.retirement.agentId,
          tenantId: retired.retirement.tenantId,
          name: retired.retirement.name,
          retiredAt: retired.retirement.retiredAt,
          retiredByType: retired.retirement.retiredByType,
          retiredById: retired.retirement.retiredById,
        },
        {
          agentId: AGENT_A,
          tenantId: TENANT_A,
          name: "Atlas",
          retiredAt: RETIRED_AT.toISOString(),
          retiredByType: "human",
          retiredById: OWNER_A,
        },
        "the retirement names the identity, its organization, its surviving name and the human who withdrew it",
      );

      /* ── 3. EXACTLY FOUR COLUMNS MOVED ────────────────────────────────────── */
      const after = await rowOf(AGENT_A, [
        "agent_lifecycle_status",
        "retired_at",
        "updated_by",
        "updated_by_type",
        "version",
      ]);
      assert.equal(
        after.agent_lifecycle_status,
        "retired",
        "`agent_lifecycle_status` is `retired` — an existing enum value gains its first writer",
      );
      assert.equal(
        (after.retired_at as Date).toISOString(),
        RETIRED_AT.toISOString(),
        "`retired_at` carries the server's clock, stamped inside the transaction",
      );
      assert.deepEqual(
        { updated_by: after.updated_by, updated_by_type: after.updated_by_type },
        { updated_by: OWNER_A, updated_by_type: "human" },
        "the actor pair is written BOTH-OR-NEITHER — a type with no id is false provenance, not partial attribution",
      );
      assert.equal(after.version, 2, "the row version advanced exactly once");

      /* ── 4. RETIREMENT IS NOT DELETION, AND ERASES NO HISTORY ─────────────── */
      assert.deepEqual(
        await rowOf(AGENT_A, SURVIVES_RETIREMENT),
        beforeRetirement,
        "the name, the ownership pair, the creation pair, the creation time and the record " +
          "lifecycle are all EXACTLY as AGENT-ID-0 wrote them — retirement withdrew a service, not a record",
      );
      const empties = await rowOf(AGENT_A, MUST_STAY_EMPTY_AFTER_RETIREMENT);
      for (const column of MUST_STAY_EMPTY_AFTER_RETIREMENT) {
        assert.equal(
          empties[column],
          null,
          `\`${column}\` is NULL after retirement — no soft delete, no fabricated successor, no invented state`,
        );
      }

      /*
       * ── 5. (AP-1) GENESIS IS NO LONGER A ONE-SHOT ──────────────────────────
       * What replaced "the ceremony stays closed" is proved in §10 below, after the reads that
       * describe this tenant's single retired identity, so those counts stay as they were.
       */

      /* ── 6. RETIREMENT IS TERMINAL ────────────────────────────────────────── */
      assert.deepEqual(
        await retireDurableAgentIdentity(A, { agentId: AGENT_A, justification: "Retiring this agent for the test organization (L-1b requires a reason)." }, retireDeps),
        { status: "refused", reason: "agent-identity-already-retired" },
        "a retired identity cannot be retired again — terminal states are not re-enterable",
      );

      /* ── 7. CONCURRENT RETIREMENT OF THE SAME IDENTITY ────────────────────── */

      /*
       * THE RACE HAS TO BE MADE REAL, OR IT PROVES NOTHING.
       *
       * A plain `Promise.all` of six retirements does NOT interleave: each transaction commits
       * before the next one reads, so every loser is turned away by the ordinary terminal-state
       * guard and the "exactly one winner" assertion passes for the wrong reason. That was measured
       * — the assertion stayed green with BOTH the row lock and the `retired_at is null` update
       * predicate removed, which is precisely the state in which the guarantee does not exist.
       *
       * So the racers are held at a barrier INSIDE their transactions, at the moment after the read
       * and before the judgement. That is the only moment this transition can interleave at.
       *
       * THE BARRIER IS TIME-BOUNDED, AND THAT IS DELIBERATE. When the row lock is present the second
       * and third racers block on `for update` and never arrive, so a barrier that waited for all
       * parties would DEADLOCK — and a hanging proof is not a verdict. The timeout lets the holder
       * proceed, which is exactly the correct behaviour to observe.
       *
       * PARTIES < POOL SIZE. The control-plane pool holds four connections; three racers can all be
       * inside a transaction at once, so the barrier can never be starved by the pool itself.
       */
      const RACERS = 3;
      const BARRIER_TIMEOUT_MS = 750;
      function createReadBarrier(parties: number, timeoutMs: number): () => Promise<void> {
        let arrived = 0;
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const timer: NodeJS.Timeout = setTimeout(() => release(), timeoutMs);
        timer.unref?.();
        return async () => {
          arrived += 1;
          if (arrived >= parties) {
            clearTimeout(timer);
            release();
          }
          await gate;
        };
      }

      assert.equal(
        (await rowOf(AGENT_B, ["retired_at"])).retired_at,
        null,
        "Tenant B's identity is still in service before the race",
      );
      const barrier = createReadBarrier(RACERS, BARRIER_TIMEOUT_MS);
      const racers = await Promise.all(
        Array.from({ length: RACERS }, () =>
          retireDurableAgentIdentity(
            B,
            { agentId: AGENT_B, justification: "Retiring this agent for the test organization (L-1b requires a reason)." },
            { ...retireDeps, afterRead: barrier },
          ),
        ),
      );
      assert.equal(
        racers.filter((r) => r.status === "retired").length,
        1,
        "three simultaneous retirements produce exactly one retirement — the row lock turns the " +
          "losers away early, and the conditional update refuses them even if it does not",
      );
      assert.deepEqual(
        [...new Set(racers.filter((r) => r.status === "refused").map((r) => r.reason))],
        ["agent-identity-already-retired"],
        "every loser is refused for the terminal-state reason, not for a constraint violation leaking upward",
      );
      assert.equal(
        (await rowOf(AGENT_B, ["version"])).version,
        2,
        "the row advanced exactly one version across three concurrent attempts",
      );

      /* ── 8. RETIREMENT BUYS AND SPENDS NOTHING ────────────────────────────── */
      for (const table of MUST_STAY_UNTOUCHED) {
        assert.equal(
          await countOf(table),
          /*
           * APF-1: the two seeded Governance bootstraps. AP-1: plus the two REGISTRATION decisions
           * (Atlas, Borea) and their two audit rows — written at creation, above. L-1b: plus exactly
           * ONE `agent-lifecycle` decision and ONE audit row per committed retirement (Atlas, Borea).
           * Refused and raced attempts add none.
           */
          table === "decision_records" ? 6 : table === "audit_log" ? 4 : 0,
          `\`${table}\` — retiring an identity issues no credential, opens no session, grants no ` +
            `permit and assigns no role; its only records are its own decision and audit event`,
        );
      }
      assert.equal(
        Number(
          (
            await probe.query(
              `select count(*)::int n from decision_records d join governance_sessions s on s.id = d.session_id
                where d.subject_type = 'agent-lifecycle' and d.decision_type = 'revoke'
                  and d.outcome = 'agent-retired' and s.governance_domain = 'agent-lifecycle'`,
            )
          ).rows[0].n,
        ),
        2,
        "L-1b: each committed retirement is one agent-lifecycle decision (revoke → agent-retired)",
      );

      /* ── 9. THE READ REPORTS THE TRUTH, INCLUDING THAT AN IDENTITY ONCE EXISTED ─ */
      const stateA = await readDurableAgentIdentityState(A, { getDb: () => handle.db });
      assert.equal(stateA.status, "known", "the durable identity state is readable");
      if (stateA.status !== "known") throw new Error("unreachable");
      assert.equal(
        stateA.genesisSpent,
        true,
        "`genesisSpent` stays true for a tenant whose only identity is retired — it is history (AP-1: no longer a gate)",
      );
      assert.equal(stateA.identities.length, 1, "the retired identity is still reported, not hidden");
      assert.deepEqual(
        {
          agentId: stateA.identities[0]!.agentId,
          name: stateA.identities[0]!.name,
          humanOwnerId: stateA.identities[0]!.humanOwnerId,
          inService: stateA.identities[0]!.inService,
          serviceStatus: stateA.identities[0]!.serviceStatus,
          retiredAt: stateA.identities[0]!.retiredAt,
        },
        {
          agentId: AGENT_A,
          name: "Atlas",
          humanOwnerId: OWNER_A,
          inService: false,
          /* L-2a: a retirement reads as "retired" — the status, not merely inService false. */
          serviceStatus: "retired",
          retiredAt: RETIRED_AT.toISOString(),
        },
        "a retired identity reads as retired, keeps its name and keeps its owner",
      );

      /* THE READ IS TENANT-SCOPED. Tenant B sees its own identity and nothing of Tenant A's. */
      const stateB = await readDurableAgentIdentityState(B, { getDb: () => handle.db });
      assert.equal(stateB.status, "known", "Tenant B's state is readable");
      if (stateB.status !== "known") throw new Error("unreachable");
      assert.deepEqual(
        stateB.identities.map((identity) => identity.agentId),
        [AGENT_B],
        "the read is tenant-scoped — no organization sees another's identities",
      );

      /* AN UNRESOLVED CONTEXT IS `unavailable`, NEVER AN EMPTY LIST. */
      assert.deepEqual(
        await readDurableAgentIdentityState(null, { getDb: () => handle.db }),
        { status: "unavailable" },
        "no tenant context reads as UNAVAILABLE — never as `this organization holds no identity`",
      );
      assert.deepEqual(
        await readDurableAgentIdentityState(A, { getDb: () => null }),
        { status: "unavailable" },
        "an unreachable control plane reads as UNAVAILABLE, and fails closed rather than reporting absence",
      );

      /*
       * ── 10. AP-1: A RETIRED NAME IS FREE, A RETIRED IDENTITY IS NOT ─────────
       * Registering the retired identity's exact name succeeds as a NEW identity — new id, its own
       * decision — and the retired row is byte-for-byte what it was. Nothing is reinstated.
       */
      const { rows: retiredBefore } = await probe.query("select * from agents where id = $1", [AGENT_A]);
      const reborn = await createDurableAgentIdentity(A, { name: "Atlas", justification: "Register this agent for the test organization." }, createDeps);
      assert.equal(reborn.status, "established", "AP-1: a retired name may be registered again");
      if (reborn.status !== "established") throw new Error("unreachable");
      assert.notEqual(reborn.identity.agentId, AGENT_A, "as a NEW identity — history is told apart by agentId");
      const { rows: retiredAfter } = await probe.query("select * from agents where id = $1", [AGENT_A]);
      assert.deepEqual(retiredAfter, retiredBefore, "the retired identity is untouched — nothing was reinstated");
      const bothA = await readDurableAgentIdentityState(A, { getDb: () => handle.db });
      assert.ok(
        bothA.status === "known" &&
          bothA.identities.filter((i) => i.name === "Atlas").length === 2 &&
          bothA.identities.filter((i) => i.inService).length === 1,
        "two identities named Atlas, exactly one in service",
      );

      console.log(
        "agent-id-0-1/retirement-postgres: identity withdrawn from service, history intact, never reinstated",
      );
    } finally {
      await probe.end();
      await handle.dispose();
    }
  } finally {
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
