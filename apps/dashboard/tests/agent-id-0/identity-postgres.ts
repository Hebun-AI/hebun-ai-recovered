/*
 * AGENT-ID-0 — the first durable, human-owned agent identity, proved against a REAL PostgreSQL.
 *
 * ── WHY THIS MUST BE A DATABASE TEST ─────────────────────────────────────────
 *
 * Every guarantee this phase makes is a database fact, not a code path:
 *
 *   · the one-shot holds under CONCURRENCY, and `agents` carries no unique index — the guarantee is
 *     a table lock taken before a count, which a fake cannot exhibit and a fake cannot break;
 *   · the columns this authority declines to write are NULL in a real row, not merely absent from
 *     an object literal;
 *   · the canonical resolver reads the identity through its own SQL, unmodified;
 *   · creating an identity writes no credential, no session, no permit, no role, no membership and
 *     no governance decision — provable only by counting real tables.
 *
 * A disposable local database, dropped on exit. No production data, no provider contacted.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { MAX_AGENT_NAME_LENGTH } from "../../src/features/agent-identity/contracts";
import { createCanonicalReadServices } from "../../src/features/canonical-read";
import {
  asHumanTenantContext,
  type TenantContext,
} from "../../src/features/auth/tenant/tenant-context";

const TENANT_A = "10000000-0000-4000-8000-0000000a1d01";
const TENANT_B = "10000000-0000-4000-8000-0000000a1d02";
const HUMAN_A = "20000000-0000-4000-8000-0000000a1d01";
const HUMAN_B = "20000000-0000-4000-8000-0000000a1d02";
const GHOST = "20000000-0000-4000-8000-00000000dead";
const NOW = new Date("2026-08-27T09:00:00.000Z");

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
    requestId: "agent-id-0",
    authenticatedAt: NOW.toISOString(),
  });
}

/** Columns this authority must NEVER invent. Named individually so a regression names itself. */
const MUST_STAY_EMPTY = [
  "department_id",
  "role",
  "manager_actor_type",
  "manager_actor_id",
  "authority_ceiling",
  "agent_type",
  "risk_level",
  "agent_health",
  "agent_lifecycle_status",
  "suspended_at",
  "retired_at",
  "replaced_by_agent_id",
  "working_memory_profile",
  "long_term_memory_profile",
  "knowledge_profile",
  "reasoning_profile",
  "learning_profile",
  "provider_profile",
  "tool_profile",
  "execution_defaults",
  "execution_posture",
  "preferred_providers",
  "preferred_models",
  "allowed_tools",
  "required_capabilities",
  "supported_strategies",
  "memory_namespaces",
  "knowledge_domains",
  "reasoning_preferences",
  "learning_preferences",
  "cost_limits",
  "performance_targets",
  "telemetry_profile",
] as const;

/** Tables an identity must not touch. An agent identity buys nothing but its own existence. */
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
  const harness = createDisposablePostgresHarness("hebun_agentid0_identity");
  await harness.createDatabase();

  try {
    harness.migrateDatabase();

    const seed = new Client({ connectionString: harness.dbUrl });
    await seed.connect();
    try {
      await seed.query(
        `insert into companies (id, name, slug)
         values ($1, 'Tenant A', 'agent-id-0-a'), ($2, 'Tenant B', 'agent-id-0-b')`,
        [TENANT_A, TENANT_B],
      );
      await seed.query(
        /* `users` is a ROOT table — it carries no tenant_id, because a human is not owned by an org. */
        `insert into users (id, email, name)
         values ($1, 'owner-a@example.com', 'Owner A'), ($2, 'owner-b@example.com', 'Owner B')`,
        [HUMAN_A, HUMAN_B],
      );
    } finally {
      await seed.end();
    }

    const handle = createControlPlaneDb(harness.dbUrl);
    const probe = new Client({ connectionString: harness.dbUrl });
    await probe.connect();

    try {
      const deps = { getDb: () => handle.db };
      const A = tenantContext(TENANT_A, HUMAN_A);
      const B = tenantContext(TENANT_B, HUMAN_B);

      const countOf = async (table: string): Promise<number> => {
        const { rows } = await probe.query(`select count(*)::int as total from ${table}`);
        return rows[0].total as number;
      };

      /* ── 1. REFUSALS COME FIRST, AND NOTHING IS WRITTEN ───────────────────── */
      const before = await countOf("agents");
      assert.equal(before, 0, "the fixture starts with no durable agent identity");

      const noContext = await createDurableAgentIdentity(null, { name: "Atlas" }, deps);
      assert.deepEqual(
        noContext,
        { status: "refused", reason: "no-authorized-tenant-context" },
        "without a server-resolved context there is no tenant to write into",
      );

      for (const bad of ["", " Atlas", "Atlas ", "x".repeat(MAX_AGENT_NAME_LENGTH + 1), 7, null, undefined]) {
        const refused = await createDurableAgentIdentity(A, { name: bad }, deps);
        assert.deepEqual(
          refused,
          { status: "refused", reason: "malformed-agent-name" },
          `a malformed name is refused rather than repaired: ${JSON.stringify(bad)}`,
        );
      }

      const ghostOwner = await createDurableAgentIdentity(
        tenantContext(TENANT_A, GHOST),
        { name: "Atlas" },
        deps,
      );
      assert.deepEqual(
        ghostOwner,
        { status: "refused", reason: "human-owner-unresolved" },
        "ownership must name a live human, not a uuid the authority merely hopes exists",
      );

      assert.equal(
        await countOf("agents"),
        0,
        "every refusal so far wrote nothing — a refused ceremony leaves no partial row",
      );

      /* ── 2. THE FIRST DURABLE IDENTITY ────────────────────────────────────── */
      const established = await createDurableAgentIdentity(A, { name: "Atlas" }, deps);
      assert.equal(established.status, "established", "the first identity is established");
      if (established.status !== "established") throw new Error("unreachable");
      assert.deepEqual(
        {
          tenantId: established.identity.tenantId,
          name: established.identity.name,
          humanOwnerType: established.identity.humanOwnerType,
          humanOwnerId: established.identity.humanOwnerId,
        },
        { tenantId: TENANT_A, name: "Atlas", humanOwnerType: "human", humanOwnerId: HUMAN_A },
        "the identity returned is the identity requested, owned by the human in the context",
      );

      /* ── 3. EXACTLY SIX COLUMNS CARRY A VALUE ─────────────────────────────── */
      const { rows: written } = await probe.query(
        `select tenant_id, name, human_owner_type, human_owner_id,
                created_by, created_by_type, lifecycle_status, version
           from agents where id = $1`,
        [established.identity.agentId],
      );
      assert.equal(written.length, 1, "exactly one durable row exists for the new identity");
      assert.deepEqual(
        {
          tenant_id: written[0].tenant_id,
          name: written[0].name,
          human_owner_type: written[0].human_owner_type,
          human_owner_id: written[0].human_owner_id,
          created_by: written[0].created_by,
          created_by_type: written[0].created_by_type,
        },
        {
          tenant_id: TENANT_A,
          name: "Atlas",
          human_owner_type: "human",
          human_owner_id: HUMAN_A,
          created_by: HUMAN_A,
          created_by_type: "human",
        },
        "the six persisted facts are the tenant, the name, the human owner pair and the human creator pair",
      );

      const { rows: empties } = await probe.query(
        `select ${MUST_STAY_EMPTY.map((c) => `"${c}"`).join(", ")} from agents where id = $1`,
        [established.identity.agentId],
      );
      for (const column of MUST_STAY_EMPTY) {
        assert.equal(
          empties[0][column],
          null,
          `\`${column}\` is NULL — a missing fact stays missing rather than being invented`,
        );
      }

      /* ── 4. THE IDENTITY BUYS NOTHING ─────────────────────────────────────── */
      for (const table of MUST_STAY_UNTOUCHED) {
        assert.equal(
          await countOf(table),
          0,
          `\`${table}\` is still empty — an agent identity is not a credential, a session, a permit, a role or a decision`,
        );
      }

      /* ── 5. ONE-SHOT, AND TENANT-SCOPED ───────────────────────────────────── */
      const second = await createDurableAgentIdentity(A, { name: "Borealis" }, deps);
      assert.deepEqual(
        second,
        { status: "refused", reason: "agent-identity-already-exists" },
        "this authority owns the transition out of nonexistence, and that transition happens once",
      );

      const otherTenant = await createDurableAgentIdentity(B, { name: "Atlas" }, deps);
      assert.equal(
        otherTenant.status,
        "established",
        "the one-shot is tenant-scoped — another organization's first identity is unaffected, same name and all",
      );

      /* ── 6. THE ONE-SHOT SURVIVES CONCURRENCY ─────────────────────────────── */
      /*
       * Each racer gets its OWN pool, and therefore its own connection. Sharing one pool would let
       * the racers queue behind a single warm connection and finish one after another — the suite
       * would then report a one-shot that scheduling produced rather than the lock, and it would
       * stay green with the lock deleted. That is not a hypothetical: it is what this test did
       * before, and the M2 bite-proof is what found it.
       */
      await probe.query("delete from agents where tenant_id = $1", [TENANT_B]);
      const racerHandles = Array.from({ length: 6 }, () => createControlPlaneDb(harness.dbUrl));
      let racers: readonly Awaited<ReturnType<typeof createDurableAgentIdentity>>[];
      try {
        racers = await Promise.all(
          racerHandles.map((racer, i) =>
            createDurableAgentIdentity(B, { name: `Racer ${i}` }, { getDb: () => racer.db }),
          ),
        );
      } finally {
        await Promise.all(racerHandles.map((racer) => racer.dispose()));
      }
      const winners = racers.filter((r) => r.status === "established");
      assert.equal(
        winners.length,
        1,
        "six simultaneous ceremonies produce exactly one identity — the lock is taken before the count",
      );
      assert.deepEqual(
        [...new Set(racers.filter((r) => r.status === "refused").map((r) => r.reason))],
        ["agent-identity-already-exists"],
        "every loser is refused for the one-shot reason, not for a constraint violation leaking upward",
      );
      assert.equal(
        await countOf("agents"),
        2,
        "one identity per tenant survives the race, and no tenant gained a second",
      );

      /* ── 7. THE CANONICAL RESOLVER READS IT, UNMODIFIED ───────────────────── */
      const canonical = createCanonicalReadServices({
        connectionString: harness.dbUrl,
        statementTimeoutMs: 5000,
        connectionTimeoutMs: 2000,
        idleTimeoutMs: 1000,
        appName: "agent-id-0-test",
      });
      try {
        const resolved = await canonical.resolveActor({
          actorType: "agent",
          actorId: established.identity.agentId,
          tenantId: TENANT_A,
        });
        assert.equal(resolved.resolved, true, "the canonical resolver resolves the durable identity");
        assert.equal(resolved.status, "resolved", "the identity resolves cleanly, with no warning status");
        assert.equal(resolved.sourceTable, "agents", "the resolver names `agents` as the source of truth");

        const foreign = await canonical.resolveActor({
          actorType: "agent",
          actorId: established.identity.agentId,
          tenantId: TENANT_B,
        });
        assert.equal(
          foreign.status,
          "tenant-mismatch",
          "another organization asking for this identity gets tenant-mismatch, never the row",
        );
        assert.equal(foreign.resolved, false, "a tenant mismatch resolves nothing");
      } finally {
        await canonical.dispose();
      }

      console.log("agent-id-0/identity-postgres: durable human-owned identity established, one-shot held under concurrency");
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
