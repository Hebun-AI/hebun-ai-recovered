/*
 * PBGA-1 — THE DECLARED PURPOSE AGAINST REAL POSTGRES.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A human can declare which Work item a PENDING request serves; that declaration is tenant-safe,
 *    frozen once the request is decided, refused when it would replace another, and it changes
 *    nothing else about the request, the Work, Governance, permits or execution."
 *
 * Runs against a DISPOSABLE database this file creates, migrates and drops.
 */
import assert from "node:assert/strict";
import { Client, Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
/*
 * THE SCHEMA BARREL FIRST, DELIBERATELY. `_base` -> `company` -> `organization` -> `_base` is a
 * PRE-EXISTING module cycle in the schema package; it resolves only when the barrel establishes the
 * load order, which is what `db/client.server.ts` does in the application (`import * as schema`).
 * A test that reaches a single schema module first can enter that cycle mid-initialization.
 */
import "../../src/db/schema";
import { declareActionRequestPurpose } from "../../src/features/action-authorization/declare-action-purpose.server";
import { readGovernedActionsForWork } from "../../src/features/action-authorization/read-work-purpose-requests.server";
import { readPendingActionRequests } from "../../src/features/action-authorization/read-action-authorizations.server";
import { ACTION_AUDIT_PURPOSE_DECLARED } from "../../src/features/action-authorization/contracts";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import type { ControlPlaneDatabase } from "../../src/db/client.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT_A = "10000000-0000-4000-8000-00000000a001";
const TENANT_B = "10000000-0000-4000-8000-00000000b001";
const HUMAN_A = "20000000-0000-4000-8000-00000000a009";
const HUMAN_B = "20000000-0000-4000-8000-00000000b009";
const AGENT_A = "20000000-0000-4000-8000-0000000000a9";

const WORK_A1 = "40000000-0000-4000-8000-000000000001";
const WORK_A2 = "40000000-0000-4000-8000-000000000002";
const WORK_B1 = "40000000-0000-4000-8000-0000000000b1";

const REQ_PENDING = "50000000-0000-4000-8000-000000000001";
const REQ_HISTORICAL = "50000000-0000-4000-8000-000000000002";
const REQ_APPROVED = "50000000-0000-4000-8000-000000000003";
const REQ_AGENT = "50000000-0000-4000-8000-000000000004";
const REQ_B = "50000000-0000-4000-8000-0000000000b1";
const REQ_REBIND = "50000000-0000-4000-8000-000000000005";
const DECISION_ID = "60000000-0000-4000-8000-000000000001";

const DIGEST = (n: number): string => String(n).padStart(64, "0");

const tenantOf = (tenantId: string, userId: string): TenantContext =>
  ({ tenantId, userId }) as TenantContext;

async function seedCompany(client: Client, id: string, name: string): Promise<void> {
  await client.query(`insert into companies (id, name, slug) values ($1, $2, $3)`, [
    id,
    name,
    name.toLowerCase(),
  ]);
}

async function seedWork(
  client: Client,
  tenantId: string,
  id: string,
  title: string,
): Promise<void> {
  await client.query(
    `insert into work_items (id, tenant_id, title, declared_state) values ($1, $2, $3, 'planned')`,
    [id, tenantId, title],
  );
}

async function seedRequest(
  client: Client,
  request: {
    id: string;
    tenantId: string;
    status?: "pending" | "approved";
    proposedByActorType?: "human" | "agent";
    proposedByActorId?: string;
    evidence?: unknown;
  },
): Promise<void> {
  await client.query(
    `insert into heby_action_requests
       (id, tenant_id, action_id, payload_digest, action_kind, tool_id, side_effect, reversibility,
        owner_workspace, requesting_workspace, canonical_payload, expected_effect, consequences,
        evidence, proposed_by_actor_type, proposed_by_actor_id, status, target_kind, target_ref,
        target_label)
     values ($1, $2, 'act-1', $3, 'send-external-communication', 'heby.operations.send-communication',
             'CONSEQUENTIAL_MUTATION', 'irreversible', 'operations', 'operations', $4,
             'Would send an external communication.', $5, $6, $7, $8, $9, 'record',
             'external-recipient/x', 'Test Recipient')`,
    [
      request.id,
      request.tenantId,
      DIGEST(Number(request.id.slice(-1)) || 1),
      JSON.stringify({ recipientRef: "external-recipient/x" }),
      JSON.stringify(["Would change state irreversibly."]),
      JSON.stringify(
        request.evidence ?? [
          { sourceClass: "external-recipients", recordRef: "external-recipient/x", lifecycle: "settled" },
        ],
      ),
      request.proposedByActorType ?? "human",
      request.proposedByActorId ?? HUMAN_A,
      request.status ?? "pending",
    ],
  );
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_pbga1_purpose");
  await harness.createDatabase();
  harness.migrateDatabase();

  const client = new Client({ connectionString: harness.dbUrl });
  const pool = new Pool({ connectionString: harness.dbUrl });
  await client.connect();

  try {
    const db = drizzle(pool) as unknown as ControlPlaneDatabase;
    const getDb = () => db;

    await seedCompany(client, TENANT_A, "Acme");
    await seedCompany(client, TENANT_B, "Globex");
    await seedWork(client, TENANT_A, WORK_A1, "Hebun governed internal execution development");
    await seedWork(client, TENANT_A, WORK_A2, "A second initiative");
    await seedWork(client, TENANT_B, WORK_B1, "Another organization's work");

    await seedRequest(client, { id: REQ_PENDING, tenantId: TENANT_A });
    await seedRequest(client, { id: REQ_HISTORICAL, tenantId: TENANT_A });
    /*
     * A DECIDED REQUEST NEEDS A REAL DECISION. `heby_action_requests_approved_chk` makes
     * "approved, but we do not know by which decision" unrepresentable, so the fixture supplies
     * one rather than working around the released invariant.
     */
    await client.query(
      `insert into decision_records
         (id, tenant_id, decision_type, subject_type, subject_id, outcome, justification,
          actor_type, actor_id, decided_at)
       values ($1, $2, 'approve', 'heby_action_request', $3, 'action-authorized',
               'Seeded so a decided request exists.', 'human', $4, now())`,
      [DECISION_ID, TENANT_A, REQ_APPROVED, HUMAN_A],
    );
    await seedRequest(client, { id: REQ_APPROVED, tenantId: TENANT_A });
    await client.query(
      /*
       * ONE statement, because `heby_action_requests_approved_chk` is an EQUALITY: setting the four
       * approval columns while the status still reads `pending` is exactly as unrepresentable as
       * the reverse. The released invariant is respected rather than worked around.
       */
      `update heby_action_requests
         set status = 'approved', approval_decision_id = $1, approved_at = now(),
             approved_by_actor_type = 'human', approved_by_actor_id = $2
       where id = $3`,
      [DECISION_ID, HUMAN_A, REQ_APPROVED],
    );
    await seedRequest(client, {
      id: REQ_AGENT,
      tenantId: TENANT_A,
      proposedByActorType: "agent",
      proposedByActorId: AGENT_A,
    });
    await seedRequest(client, { id: REQ_REBIND, tenantId: TENANT_A });
    await seedRequest(client, { id: REQ_B, tenantId: TENANT_B, proposedByActorId: HUMAN_B });

    /* ── 1 · HISTORICAL ROWS CARRY NO PURPOSE, AND NONE WAS BACKFILLED ────── */
    {
      const rows = await client.query(
        `select count(*)::int as n from heby_action_requests where purpose_work_item_id is null`,
      );
      assert.equal(rows.rows[0].n, 6, "every seeded request starts unbound — the migration adds NULL");
    }

    /* ── 2 · A HUMAN BINDS A PENDING REQUEST ─────────────────────────────── */
    {
      const result = await declareActionRequestPurpose(
        tenantOf(TENANT_A, HUMAN_A),
        { requestId: REQ_PENDING, workItemId: WORK_A1 },
        { getDb },
      );
      assert.equal(result.status, "declared");
      if (result.status === "declared") assert.equal(result.idempotent, false);

      const row = await client.query(
        `select purpose_work_item_id, purpose_declared_by_actor_type, purpose_declared_by_actor_id,
                purpose_declared_at, status
         from heby_action_requests where id = $1`,
        [REQ_PENDING],
      );
      assert.equal(row.rows[0].purpose_work_item_id, WORK_A1, "the work is recorded");
      assert.equal(row.rows[0].purpose_declared_by_actor_type, "human", "the declarer is the human");
      assert.equal(row.rows[0].purpose_declared_by_actor_id, HUMAN_A, "and it is THIS human");
      assert.ok(row.rows[0].purpose_declared_at !== null, "with the instant it was declared");
      assert.equal(row.rows[0].status, "pending", "AND THE REQUEST IS STILL PENDING");
    }

    /* ── 3 · THE AUDIT EVENT GOES THROUGH THE RELEASED SEAM ──────────────── */
    {
      const audit = await client.query(
        `select action, actor_type, entity_type, entity_id, source, result, metadata
         from audit_log where action = $1`,
        [ACTION_AUDIT_PURPOSE_DECLARED],
      );
      assert.equal(audit.rows.length, 1, "exactly one act was recorded");
      assert.equal(audit.rows[0].actor_type, "human");
      assert.equal(audit.rows[0].entity_type, "heby_action_request", "the REQUEST is the subject");
      assert.equal(audit.rows[0].entity_id, REQ_PENDING);
      assert.equal(audit.rows[0].source, "action-authorization", "the released authority's source");
      assert.equal(audit.rows[0].result, "committed");
      const metadata = audit.rows[0].metadata as { purposeWorkItemId?: string; executed?: boolean };
      assert.equal(metadata.purposeWorkItemId, WORK_A1);
      assert.equal(metadata.executed, false, "a declaration is not an execution");
    }

    /* ── 4 · IDEMPOTENT ON THE SAME VALUE, AND IT WRITES NOTHING ─────────── */
    {
      const before = await client.query(
        `select purpose_declared_at, version from heby_action_requests where id = $1`,
        [REQ_PENDING],
      );
      const result = await declareActionRequestPurpose(
        tenantOf(TENANT_A, HUMAN_A),
        { requestId: REQ_PENDING, workItemId: WORK_A1 },
        { getDb },
      );
      assert.equal(result.status, "declared");
      if (result.status === "declared") assert.equal(result.idempotent, true);
      const after = await client.query(
        `select purpose_declared_at, version from heby_action_requests where id = $1`,
        [REQ_PENDING],
      );
      assert.deepEqual(after.rows[0], before.rows[0], "the row is byte-identical — nothing written");
      const audit = await client.query(`select count(*)::int as n from audit_log where action = $1`, [
        ACTION_AUDIT_PURPOSE_DECLARED,
      ]);
      assert.equal(audit.rows[0].n, 1, "and no second act was recorded");
    }

    /* ── 5 · REBINDING TO DIFFERENT WORK IS REFUSED, NOT OVERWRITTEN ─────── */
    {
      await declareActionRequestPurpose(
        tenantOf(TENANT_A, HUMAN_A),
        { requestId: REQ_REBIND, workItemId: WORK_A1 },
        { getDb },
      );
      const result = await declareActionRequestPurpose(
        tenantOf(TENANT_A, HUMAN_A),
        { requestId: REQ_REBIND, workItemId: WORK_A2 },
        { getDb },
      );
      assert.equal(
        result.status === "refused" ? result.reason : null,
        "already-declared-for-other-work",
        "A -> B is refused",
      );
      const row = await client.query(
        `select purpose_work_item_id from heby_action_requests where id = $1`,
        [REQ_REBIND],
      );
      assert.equal(row.rows[0].purpose_work_item_id, WORK_A1, "and the first declaration stands");
    }

    /* ── 6 · A DECIDED REQUEST CANNOT GAIN A PURPOSE ─────────────────────── */
    {
      const result = await declareActionRequestPurpose(
        tenantOf(TENANT_A, HUMAN_A),
        { requestId: REQ_APPROVED, workItemId: WORK_A1 },
        { getDb },
      );
      assert.equal(
        result.status === "refused" ? result.reason : null,
        "request-not-pending",
        "the declaration is frozen at the decision boundary",
      );
      const row = await client.query(
        `select purpose_work_item_id from heby_action_requests where id = $1`,
        [REQ_APPROVED],
      );
      assert.equal(row.rows[0].purpose_work_item_id, null, "and nothing was written");
    }

    /* ── 7 · TENANT ISOLATION, BOTH DIRECTIONS ──────────────────────────── */
    {
      /* Another tenant's request is invisible — the same answer as a missing one. */
      const foreignRequest = await declareActionRequestPurpose(
        tenantOf(TENANT_A, HUMAN_A),
        { requestId: REQ_B, workItemId: WORK_A1 },
        { getDb },
      );
      assert.equal(
        foreignRequest.status === "refused" ? foreignRequest.reason : null,
        "request-not-found",
        "a foreign request is not found, and is not distinguishable from absent",
      );

      /* And another tenant's WORK cannot be named — the composite FK refuses it. */
      const foreignWork = await declareActionRequestPurpose(
        tenantOf(TENANT_A, HUMAN_A),
        { requestId: REQ_HISTORICAL, workItemId: WORK_B1 },
        { getDb },
      );
      assert.equal(
        foreignWork.status === "refused" ? foreignWork.reason : null,
        "purpose-work-not-found",
        "cross-tenant work is unrepresentable",
      );

      const nonexistent = await declareActionRequestPurpose(
        tenantOf(TENANT_A, HUMAN_A),
        { requestId: REQ_HISTORICAL, workItemId: "40000000-0000-4000-8000-00000000ffff" },
        { getDb },
      );
      assert.equal(
        nonexistent.status === "refused" ? nonexistent.reason : null,
        "purpose-work-not-found",
        "and so is work that does not exist — ONE answer for both",
      );
    }

    /* ── 8 · THE STORAGE FIREWALL: A NON-HUMAN DECLARER IS A DATABASE ERROR ─
     * The writer cannot produce one — `human` is a constant in that file — so this drives SQL
     * directly. A CHECK that only the application respects is a convention; this is a mechanism.
     */
    {
      await assert.rejects(
        client.query(
          `update heby_action_requests
             set purpose_work_item_id = $1, purpose_declared_by_actor_type = 'agent',
                 purpose_declared_by_actor_id = $2, purpose_declared_at = now()
           where id = $3`,
          [WORK_A1, AGENT_A, REQ_AGENT],
        ),
        /human_purpose_declarer_chk/,
        "an agent cannot declare organizational purpose, at the storage layer",
      );
      await assert.rejects(
        client.query(
          `update heby_action_requests set purpose_work_item_id = $1 where id = $2`,
          [WORK_A1, REQ_AGENT],
        ),
        /purpose_chk/,
        "and a work id without a declarer is unrepresentable",
      );
    }

    /* ── 9 · NOTHING ELSE MOVED ─────────────────────────────────────────── */
    {
      const counts = await client.query(
        `select (select count(*)::int from action_permits) as permits,
                (select count(*)::int from decision_records) as decisions,
                (select count(*)::int from action_execution_attempts) as attempts,
                (select count(*)::int from work_items where declared_state <> 'planned') as moved_work`,
      );
      /*
       * A WINDOW, NOT A ZERO. The fixture deliberately seeds one decision so a decided request can
       * exist, so the honest claim is that the DECLARATIONS added nothing — measured against what
       * seeding established, not against an absolute the fixture never had.
       */
      assert.deepEqual(
        counts.rows[0],
        { permits: 0, decisions: 1, attempts: 0, moved_work: 0 },
        "no permit, no NEW decision, no execution, no Work lifecycle change",
      );

      /* PURPOSE != EVIDENCE. The evidence array is byte-identical to what was seeded. */
      const evidence = await client.query(
        `select evidence from heby_action_requests where id = $1`,
        [REQ_PENDING],
      );
      assert.deepEqual(
        evidence.rows[0].evidence,
        [
          {
            sourceClass: "external-recipients",
            recordRef: "external-recipient/x",
            lifecycle: "settled",
          },
        ],
        "declaring a purpose did not touch the evidence collection",
      );
    }

    /* ── 10 · THE INVERSE READ RETURNS ONLY WHAT WAS DECLARED FOR THAT WORK ─ */
    {
      const read = await readGovernedActionsForWork(tenantOf(TENANT_A, HUMAN_A), WORK_A1, { getDb });
      assert.equal(read.status, "read");
      if (read.status === "read") {
        assert.deepEqual(
          read.items.map((item) => item.requestId).sort(),
          [REQ_PENDING, REQ_REBIND].sort(),
          "exactly the two requests declared for this work",
        );
        assert.equal(read.truncated, false);
        /* SAFE PROJECTION: no payload, no evidence, no digest, no actor id. */
        const serialized = JSON.stringify(read.items);
        for (const forbidden of ["canonicalPayload", "evidence", "payloadDigest", HUMAN_A, DIGEST(1)]) {
          assert.ok(!serialized.includes(forbidden), `the inverse read must not carry ${forbidden}`);
        }
      }

      const other = await readGovernedActionsForWork(tenantOf(TENANT_A, HUMAN_A), WORK_A2, { getDb });
      assert.equal(other.status === "read" ? other.items.length : -1, 0, "and none for the other work");

      /* Tenant isolation on the inverse read: B cannot see A's declarations. */
      const foreign = await readGovernedActionsForWork(tenantOf(TENANT_B, HUMAN_B), WORK_A1, {
        getDb,
      });
      assert.equal(foreign.status === "read" ? foreign.items.length : -1, 0, "and B sees none of A's");
    }

    /* ── 11 · THE APPROVAL READ RESOLVES A SAFE WORK TITLE, AND SAYS SO ──── */
    {
      const read = await readPendingActionRequests(tenantOf(TENANT_A, HUMAN_A), { getDb });
      assert.equal(read.status, "read");
      if (read.status === "read") {
        const bound = read.items.find((item) => item.requestId === REQ_PENDING);
        const unbound = read.items.find((item) => item.requestId === REQ_HISTORICAL);
        assert.equal(
          bound?.purposeWorkTitle,
          "Hebun governed internal execution development",
          "the approver sees the work by NAME",
        );
        assert.equal(bound?.purposeUnresolved, false);
        assert.equal(unbound?.purposeWorkTitle, null, "an unbound request declares nothing");
        assert.equal(unbound?.purposeUnresolved, false, "and that is not an unresolved reference");
        /* The work item ID never crosses to the client. */
        assert.ok(
          !JSON.stringify(read.items).includes(WORK_A1),
          "the work item id is not projected to the surface",
        );
      }
    }

    console.log("pbga1-purpose-bound-act/purpose-postgres: OK");
  } finally {
    await client.end();
    await pool.end();
    await harness.dropDatabase();
  }
}

void main();
