/*
 * E2-4 — THE AGGREGATE, PROVED AGAINST A REAL POSTGRESQL DATABASE.
 *
 * The injected suite proves the branches. It cannot prove the SQL, and the SQL is where this
 * milestone's one real hazard lives.
 *
 * ── THE BITE THIS FILE EXISTS FOR ────────────────────────────────────────────
 *
 * `readPendingActionRequests` is `orderBy desc(created_at) limit 50`. On a tenant with sixty
 * pending proposals it returns the fifty NEWEST — so the oldest is the first row it drops, and a
 * surface deriving "oldest awaiting" from that list would print a figure that is right on small
 * tenants, wrong on large ones, and indistinguishable between the two. R6B's finding, restated for
 * time. §2 below builds exactly that tenant and measures both answers.
 *
 * Also proved: tenant isolation as a property of the STATEMENTS rather than of a fake, the
 * tenant-scoped `not exists`, and that every read WROTE NOTHING.
 *
 * Uses a disposable local database, dropped on exit. No production data is touched.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import {
  readAgentAwaitingDecision,
  readApprovedUnexecutedAggregate,
  readAwaitingDecisionAggregate,
} from "../../src/features/action-authorization/awaiting-decision-aggregate.server";
import { readPendingActionRequests } from "../../src/features/action-authorization/read-action-authorizations.server";
import { elapsedSince } from "../../src/features/attention-observation/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT_A = "10000000-0000-4000-8000-0000000e2401";
const TENANT_B = "10000000-0000-4000-8000-0000000e2402";
const AGENT_A = "20000000-0000-4000-8000-0000000e2401";
const HUMAN = "30000000-0000-4000-8000-0000000e2401";
const AT = "2026-08-30T12:00:00.000Z";

const ctx = (tenantId: string): TenantContext =>
  ({ tenantId, userId: HUMAN }) as unknown as TenantContext;

/** One proposal. Every NOT NULL column supplied; nothing else is invented. */
async function proposal(
  client: Client,
  tenant: string,
  index: number,
  createdAt: string,
  options: { readonly status?: string; readonly approvedAt?: string; readonly agent?: boolean } = {},
): Promise<void> {
  const status = options.status ?? "pending";
  await client.query(
    `insert into heby_action_requests
       (tenant_id, created_at, action_id, payload_digest, action_kind, tool_id, side_effect,
        reversibility, owner_workspace, requesting_workspace, canonical_payload, expected_effect,
        consequences, proposed_by_actor_type, proposed_by_actor_id, status, approved_at,
        approval_decision_id, approved_by_actor_type, approved_by_actor_id)
     values ($1, $2, $3, $4, 'send-external-communication', 'heby.operations.send-communication',
             'CONSEQUENTIAL_MUTATION', 'irreversible', 'operations', 'operations',
             '{}'::jsonb, 'Send one message.', '[]'::jsonb, $5, $6, $7, $8, $9, $10, $11)`,
    [
      tenant,
      createdAt,
      `action-${tenant.slice(-4)}-${index}`,
      /*
       * A DISTINCT DIGEST PER PROPOSAL. The released
       * `heby_action_requests_one_pending_per_digest_uq` admits at most one LIVE request per exact
       * action per tenant, so sixty pending rows must be sixty different actions — which is what a
       * real queue of sixty is.
       */
      `${tenant.slice(-4)}${String(index).padStart(4, "0")}`.padEnd(64, "b").slice(0, 64),
      options.agent ? "agent" : "human",
      options.agent ? AGENT_A : HUMAN,
      status,
      options.approvedAt ?? null,
      /*
       * `heby_action_requests_approved_chk` is ALL-OR-NOTHING: an approved row must carry its
       * instant, its decision and its actor together. There is no decision record in this fixture,
       * so an approved row would violate the CHECK — which is exactly why the approved cases below
       * use a real decision id seeded alongside.
       */
      options.approvedAt ? APPROVAL_DECISION : null,
      options.approvedAt ? "human" : null,
      options.approvedAt ? HUMAN : null,
    ],
  );
}

const APPROVAL_DECISION = "40000000-0000-4000-8000-0000000e2401";

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_e24_attention");
  await harness.createDatabase();

  try {
    harness.migrateDatabase();
    const client = new Client({ connectionString: harness.dbUrl });
    /*
     * The drop in the outer `finally` terminates this connection. Without a handler that arrives as
     * an unhandled 'error' event and CRASHES the process, replacing whatever assertion actually
     * failed with a connection message — a real failure reported with its evidence removed.
     */
    (client as unknown as { on: (e: string, h: () => void) => void }).on("error", () => undefined);
    await client.connect();

    await client.query(
      `insert into companies (id, name, slug) values ($1, 'Acme', 'acme'), ($2, 'Globex', 'globex')`,
      [TENANT_A, TENANT_B],
    );
    await client.query(
      `insert into users (id, email) values ($1, 'director@example.test')`,
      [HUMAN],
    );
    await client.query(
      `insert into agents (id, tenant_id, name, human_owner_id, human_owner_type)
       values ($1, $2, 'Heby', $3, 'human')`,
      [AGENT_A, TENANT_A, HUMAN],
    );

    const handle = createControlPlaneDb(harness.dbUrl);
    const deps = { getDb: () => handle.db };

    try {
      /* ── 1 · SIXTY PENDING PROPOSALS IN A, ONE IN B ────────────────────── */
      {
        /* The oldest is FIRST, so the newest-first bounded reader is guaranteed to drop it. */
        await proposal(client, TENANT_A, 0, "2026-08-01T00:00:00.000Z", { agent: true });
        for (let i = 1; i < 60; i += 1) {
          await proposal(client, TENANT_A, i, `2026-08-30T${String(i % 24).padStart(2, "0")}:00:00.000Z`);
        }
        await proposal(client, TENANT_B, 0, "2026-07-01T00:00:00.000Z");
      }

      /* ── 2 · THE BITE: THE LIST CANNOT ANSWER, THE AGGREGATE CAN ───────── */
      {
        const list = await readPendingActionRequests(ctx(TENANT_A), deps);
        assert.equal(list.status, "read");
        if (list.status !== "read") throw new Error("unreachable");
        assert.equal(list.items.length, 50, "the released list reader is bounded at fifty");
        const oldestInList = list.items
          .map((item) => item.proposedAt)
          .sort()[0]!;
        assert.notEqual(
          oldestInList,
          "2026-08-01T00:00:00.000Z",
          "the true oldest is NOT in the bounded list — this is the defect the aggregate prevents",
        );

        const aggregate = await readAwaitingDecisionAggregate(ctx(TENANT_A), deps);
        assert.equal(aggregate.status, "read");
        if (aggregate.status !== "read") throw new Error("unreachable");
        assert.equal(aggregate.value.awaiting, 60, "the UNBOUNDED count sees all sixty");
        assert.equal(
          aggregate.value.oldestFiledAt,
          "2026-08-01T00:00:00.000Z",
          "and the oldest is the row the list dropped",
        );
        assert.equal(
          elapsedSince(aggregate.value.oldestFiledAt, AT, "action-request.created_at")?.label,
          "29d 12h",
        );
      }

      /* ── 3 · TENANT ISOLATION IS A PROPERTY OF THE STATEMENT ───────────── */
      {
        const b = await readAwaitingDecisionAggregate(ctx(TENANT_B), deps);
        if (b.status !== "read") throw new Error("unreachable");
        assert.equal(b.value.awaiting, 1, "a sixty-proposal neighbour never inflates this count");
        assert.equal(
          b.value.oldestFiledAt,
          "2026-07-01T00:00:00.000Z",
          "and B's oldest is B's own, not the older row A does not have",
        );

        const bAgents = await readAgentAwaitingDecision(ctx(TENANT_B), deps);
        if (bAgents.status !== "read") throw new Error("unreachable");
        assert.deepEqual(bAgents.value, [], "A's agent proposal never reaches B");

        const aAgents = await readAgentAwaitingDecision(ctx(TENANT_A), deps);
        if (aAgents.status !== "read") throw new Error("unreachable");
        assert.equal(aAgents.value.length, 1, "one agent proposed in A");
        assert.equal(aAgents.value[0]!.agentId, AGENT_A);
        assert.equal(aAgents.value[0]!.awaiting, 1, "only the agent's own proposal is counted");
        assert.equal(aAgents.value[0]!.oldestFiledAt, "2026-08-01T00:00:00.000Z");
      }

      /* ── 4 · DECIDED PROPOSALS ARE NOT WAITING ─────────────────────────── */
      {
        await client.query(
          `insert into decision_records
             (id, tenant_id, decision_type, subject_type, actor_type, actor_id, outcome, justification)
           values ($1, $2, 'approve', 'heby_action_request', 'human', $3, 'approved',
                   'A justification long enough to satisfy the released rule.')`,
          [APPROVAL_DECISION, TENANT_A, HUMAN],
        );

        const before = await readAwaitingDecisionAggregate(ctx(TENANT_A), deps);
        if (before.status !== "read") throw new Error("unreachable");

        await proposal(client, TENANT_A, 900, "2026-08-02T00:00:00.000Z", {
          status: "approved",
          approvedAt: "2026-08-29T12:00:00.000Z",
        });

        const after = await readAwaitingDecisionAggregate(ctx(TENANT_A), deps);
        if (after.status !== "read") throw new Error("unreachable");
        assert.equal(
          after.value.awaiting,
          before.value.awaiting,
          "an APPROVED proposal is a decided one — it never appears as still waiting",
        );
        assert.equal(after.value.oldestFiledAt, before.value.oldestFiledAt);

        /* And it IS counted where it belongs, from its own approval instant. */
        const approved = await readApprovedUnexecutedAggregate(ctx(TENANT_A), deps);
        if (approved.status !== "read") throw new Error("unreachable");
        assert.equal(approved.value.approvedWithoutAttempt, 1);
        assert.equal(approved.value.oldestApprovedAt, "2026-08-29T12:00:00.000Z");
        assert.equal(
          elapsedSince(approved.value.oldestApprovedAt, AT, "action-request.approved_at")?.label,
          "1d",
        );

        const approvedB = await readApprovedUnexecutedAggregate(ctx(TENANT_B), deps);
        if (approvedB.status !== "read") throw new Error("unreachable");
        assert.equal(approvedB.value.approvedWithoutAttempt, 0, "A's approval never reaches B");
        assert.equal(
          approvedB.value.oldestApprovedAt,
          null,
          "none approved is NOT an approval of age zero",
        );
      }

      /* ── 5 · THE READS WROTE NOTHING ───────────────────────────────────── */
      {
        const countOf = async (table: string): Promise<number> => {
          const r = await client.query<{ n: string }>(`select count(*)::text as n from "${table}"`);
          return Number(r.rows[0]!.n);
        };
        const tables = ["heby_action_requests", "action_permits", "action_execution_attempts", "audit_log", "companies", "agents"];
        /* Serial: one `pg` Client cannot run concurrent queries, and pg@9 will refuse outright. */
        const before: number[] = [];
        for (const table of tables) before.push(await countOf(table));
        for (const tenant of [TENANT_A, TENANT_B]) {
          await readAwaitingDecisionAggregate(ctx(tenant), deps);
          await readAgentAwaitingDecision(ctx(tenant), deps);
          await readApprovedUnexecutedAggregate(ctx(tenant), deps);
        }
        const after: number[] = [];
        for (const table of tables) after.push(await countOf(table));
        assert.deepEqual(after, before, "E2-4's reads mutate nothing, measured");
      }
    } finally {
      await handle.dispose();
      await client.end();
    }
  } finally {
    await harness.dropDatabase();
  }

  console.log("E2-4 aggregate (postgres): OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
