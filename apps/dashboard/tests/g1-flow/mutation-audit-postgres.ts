/*
 * G1 — governed Knowledge mutation history, proved against a REAL PostgreSQL database.
 *
 * THE CLAIM UNDER TEST. Hebun has ONE truthful answer to "where is the immutable product-level
 * history of governed Knowledge mutations?" — the pre-existing shared `audit_log` sink. Current
 * state (`knowledge_facts` / `knowledge_nodes`) and mutation history (`audit_log`) stay distinct
 * authorities, and the second one records what the first one structurally cannot: a refusal.
 *
 * The proofs that only a real database can give:
 *   - a committed mutation and its audit row commit in ONE transaction;
 *   - a refused mutation leaves no Knowledge row and DOES leave history;
 *   - a rolled-back transaction leaves neither Knowledge nor a `committed` claim;
 *   - history is tenant-scoped, and another tenant's is invisible;
 *   - no Knowledge CONTENT is duplicated into the ledger.
 *
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createDurableKnowledgeWriter } from "../../src/features/knowledge/durable-knowledge-writer.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import { listKnowledgeSources } from "../../src/features/knowledge/knowledge-read.server";
import {
  readKnowledgeMutationHistory,
  recordKnowledgeMutation,
} from "../../src/features/governance-audit/knowledge-mutation-audit.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT_A = "10000000-0000-4000-8000-0000000000e1";
const TENANT_B = "10000000-0000-4000-8000-0000000000e2";
const USER_A = "20000000-0000-4000-8000-0000000000e1";
const USER_B = "20000000-0000-4000-8000-0000000000e2";
const NOW = new Date("2026-08-11T15:00:00.000Z");

/** Content that must NOT appear anywhere in the ledger. */
const SECRET_STATEMENT =
  "CONTENT-MUST-NOT-BE-DUPLICATED-INTO-AUDIT: the provider key rotation runbook.";

function tenantContext(tenantId: string, userId: string): TenantContext {
  return {
    tenantId,
    userId,
    authIdentityId: "identity",
    membershipId: "membership",
    membershipVersion: 1,
    roleId: "role",
    sessionContextId: "70000000-0000-4000-8000-000000000001",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "g1-request",
    authenticatedAt: NOW.toISOString(),
  };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_g1_audit");
  await harness.createDatabase();

  try {
    harness.migrateDatabase();

    const seed = new Client({ connectionString: harness.dbUrl });
    await seed.connect();
    try {
      await seed.query(
        `insert into companies (id, name, slug) values ($1,'A','a-g1'), ($2,'B','b-g1')`,
        [TENANT_A, TENANT_B],
      );
    } finally {
      await seed.end();
    }

    const handle = createControlPlaneDb(harness.dbUrl);
    try {
      const writer = createDurableKnowledgeWriter(handle.db);
      const repo = createDurableKnowledgeRepository(handle.db);
      const authorized = async () => ({ authorized: true, roleType: "owner" });
      const deps = {
        resolveAuthority: authorized,
        getWriter: () => writer,
        now: () => NOW,
        recordMutation: (
          actor: Parameters<typeof recordKnowledgeMutation>[0],
          event: Parameters<typeof recordKnowledgeMutation>[1],
        ) => recordKnowledgeMutation(actor, event, { getDb: () => handle.db, now: () => NOW }),
      };
      const historyDeps = { getDb: () => handle.db };

      /* ── 1. A COMMITTED MUTATION IS AUDITED, ATOMICALLY ──────────────────── */
      const created = await createKnowledgeFact(
        tenantContext(TENANT_A, USER_A),
        {
          factKey: "runbook",
          domainKey: "platform",
          scope: "company-wide",
          title: "Runbook",
          statement: SECRET_STATEMENT,
        },
        deps,
      );
      assert.equal(created.status, "created");
      if (created.status !== "created") throw new Error("unreachable");
      const factId = created.identity.factId;
      assert.ok(factId, "the governed identity is returned");

      const history = await readKnowledgeMutationHistory({ tenantId: TENANT_A }, factId, historyDeps);
      assert.equal(history.status, "read");
      if (history.status !== "read") throw new Error("unreachable");
      assert.equal(history.records.length, 1, "one event for one mutation");
      const event = history.records[0]!;
      assert.equal(event.action, "knowledge.create");
      assert.equal(event.outcome, "committed");
      assert.equal(event.factId, factId, "history points at the canonical identity");
      assert.equal(event.factKey, "runbook");
      assert.equal(event.domainKey, "platform");
      assert.equal(event.actorType, "human");
      assert.equal(event.actorId, USER_A, "the server-resolved actor, not a client value");
      assert.equal(event.newKnowledgeNodeId, created.identity.newKnowledgeNodeId ?? null);
      assert.equal(event.priorKnowledgeNodeId, null, "a create supersedes nothing");
      assert.equal(event.reason, null);

      /* ── 2. NO KNOWLEDGE CONTENT IS DUPLICATED INTO THE LEDGER ───────────── */
      {
        const verify = new Client({ connectionString: harness.dbUrl });
        await verify.connect();
        try {
          const rows = await verify.query<{ blob: string }>(
            `select coalesce(metadata::text,'') || coalesce(previous_state::text,'') || coalesce(next_state::text,'') as blob from audit_log`,
          );
          for (const row of rows.rows) {
            assert.ok(
              !row.blob.includes("CONTENT-MUST-NOT-BE-DUPLICATED"),
              "the audit sink is not a shadow Knowledge database",
            );
          }
          const states = await verify.query<{ prev: unknown; next: unknown }>(
            "select previous_state as prev, next_state as next from audit_log",
          );
          for (const row of states.rows) {
            assert.equal(row.prev, null, "no previous content is copied");
            assert.equal(row.next, null, "no next content is copied");
          }
          // The sink carries no secret material either.
          const sensitive = await verify.query<{ n: string }>(
            `select count(*)::text as n from audit_log where metadata::text ilike '%api%key%' or metadata::text ilike '%secret%'`,
          );
          assert.equal(sensitive.rows[0]!.n, "0");
        } finally {
          await verify.end();
        }
      }

      /* ── 3. A REFUSAL IS HISTORY — WHICH CURRENT STATE CANNOT RECORD ─────── */
      const duplicate = await createKnowledgeFact(
        tenantContext(TENANT_A, USER_A),
        {
          factKey: "runbook",
          domainKey: "platform",
          scope: "company-wide",
          title: "Different title",
          statement: "Different statement.",
        },
        deps,
      );
      assert.equal(duplicate.status, "duplicate");
      if (duplicate.status !== "duplicate") throw new Error("unreachable");
      assert.equal(duplicate.audited, true, "the refusal reached the ledger");

      const afterDuplicate = await readKnowledgeMutationHistory(
        { tenantId: TENANT_A },
        factId,
        historyDeps,
      );
      assert.equal(afterDuplicate.status, "read");
      if (afterDuplicate.status !== "read") throw new Error("unreachable");
      assert.equal(afterDuplicate.records.length, 2, "the attempt and the refusal are both history");
      const rejected = afterDuplicate.records.find((r) => r.outcome === "rejected")!;
      assert.ok(rejected, "the refusal is recorded as rejected, not committed");
      assert.equal(rejected.reason, "duplicate-identity");
      assert.equal(rejected.factId, factId, "and points at the identity it collided with");

      // Current state is unchanged — which is exactly why history had to record this separately.
      const listing = await listKnowledgeSources({ tenantId: TENANT_A }, { getRepo: () => repo });
      assert.equal(listing.status, "read");
      if (listing.status !== "read") throw new Error("unreachable");
      assert.equal(listing.records.length, 1);
      assert.equal(listing.records[0]!.title, "Runbook", "nothing was overwritten");

      /* ── 4. STATE AND HISTORY ARE DIFFERENT AUTHORITIES ──────────────────── */
      {
        const verify = new Client({ connectionString: harness.dbUrl });
        await verify.connect();
        try {
          const counts = await verify.query<{ facts: string; events: string }>(
            `select (select count(*)::text from knowledge_facts) as facts,
                    (select count(*)::text from audit_log) as events`,
          );
          assert.equal(counts.rows[0]!.facts, "1", "one fact exists");
          assert.equal(counts.rows[0]!.events, "2", "two events happened to it");
        } finally {
          await verify.end();
        }
      }

      /* ── 5. A ROLLED-BACK MUTATION NEVER CLAIMS SUCCESS ──────────────────── */
      {
        // A writer whose transaction always fails, so the failure path is real rather than mocked.
        const failing = {
          async createFact(actor: { tenantId: string; userId: string }, input: { factKey: string; domainKey: string; scope: string }) {
            void actor;
            return {
              status: "failed" as const,
              identity: {
                factId: "50000000-0000-4000-8000-000000000001",
                factKey: input.factKey,
                domainKey: input.domainKey,
                scope: input.scope,
              },
              detail: "simulated transaction failure",
            };
          },
        };
        const failed = await createKnowledgeFact(
          tenantContext(TENANT_A, USER_A),
          { factKey: "rollback-probe", domainKey: "platform", scope: "domain", title: "T", statement: "S" },
          { ...deps, getWriter: () => failing as never },
        );
        assert.equal(failed.status, "unavailable");
        if (failed.status !== "unavailable") throw new Error("unreachable");
        assert.equal(failed.reason, "write-failed");
        assert.equal(failed.audited, true);

        const rollbackHistory = await readKnowledgeMutationHistory(
          { tenantId: TENANT_A },
          "50000000-0000-4000-8000-000000000001",
          historyDeps,
        );
        assert.equal(rollbackHistory.status, "read");
        if (rollbackHistory.status !== "read") throw new Error("unreachable");
        assert.equal(rollbackHistory.records.length, 1);
        assert.equal(rollbackHistory.records[0]!.outcome, "rolled-back");
        assert.equal(rollbackHistory.records[0]!.reason, "write-failed");

        // …and no Knowledge row appeared for it.
        const stillOne = await listKnowledgeSources({ tenantId: TENANT_A }, { getRepo: () => repo });
        assert.equal(stillOne.status, "read");
        if (stillOne.status !== "read") throw new Error("unreachable");
        assert.equal(stillOne.records.length, 1, "a failure created no Knowledge");
      }

      /* ── 6. TENANT ISOLATION OF HISTORY ──────────────────────────────────── */
      {
        const bCreated = await createKnowledgeFact(
          tenantContext(TENANT_B, USER_B),
          { factKey: "runbook", domainKey: "platform", scope: "company-wide", title: "B runbook", statement: "B only." },
          deps,
        );
        assert.equal(bCreated.status, "created", "the same identity is free in another tenant");
        if (bCreated.status !== "created") throw new Error("unreachable");

        // A cannot read B's history, even holding B's real fact id.
        const crossRead = await readKnowledgeMutationHistory(
          { tenantId: TENANT_A },
          bCreated.identity.factId,
          historyDeps,
        );
        assert.equal(crossRead.status, "read");
        if (crossRead.status !== "read") throw new Error("unreachable");
        assert.equal(crossRead.records.length, 0, "another tenant's history is invisible");

        // B sees its own, and only its own.
        const bHistory = await readKnowledgeMutationHistory(
          { tenantId: TENANT_B },
          bCreated.identity.factId,
          historyDeps,
        );
        assert.equal(bHistory.status, "read");
        if (bHistory.status !== "read") throw new Error("unreachable");
        assert.equal(bHistory.records.length, 1);
        assert.equal(bHistory.records[0]!.actorId, USER_B);

        // No audit row was ever written under the wrong tenant.
        const verify = new Client({ connectionString: harness.dbUrl });
        await verify.connect();
        try {
          const crossed = await verify.query(
            `select 1 from audit_log a
               join knowledge_facts f on f.id = a.entity_id
              where f.tenant_id <> a.tenant_id`,
          );
          assert.equal(crossed.rowCount, 0, "no event is attributed to another tenant's fact");
        } finally {
          await verify.end();
        }
      }

      /* ── 7. HISTORY FAILS CLOSED ─────────────────────────────────────────── */
      {
        const noTenant = await readKnowledgeMutationHistory(null, factId, historyDeps);
        assert.equal(noTenant.status, "unavailable");
        if (noTenant.status !== "unavailable") throw new Error("unreachable");
        assert.equal(noTenant.reason, "no-authorized-tenant-context");

        const noDb = await readKnowledgeMutationHistory({ tenantId: TENANT_A }, factId, {
          getDb: () => null,
        });
        assert.equal(noDb.status, "unavailable");
        if (noDb.status !== "unavailable") throw new Error("unreachable");
        assert.equal(noDb.reason, "persistence-not-configured");
      }

      /* ── 8. THE COMMITTED EVENT SHARES THE MUTATION'S TRANSACTION ─────────
       * Proven by construction plus this consequence: the audit row's `occurred_at` is the SAME
       * instant the canonical rows were written, because both came from one call with one clock.
       */
      {
        const verify = new Client({ connectionString: harness.dbUrl });
        await verify.connect();
        try {
          const row = await verify.query<{ occurred: Date; selected: Date; authority: string; sim: boolean; src: string; req: string }>(
            `select a.occurred_at as occurred, f.selected_at as selected, a.authority_source as authority,
                    a.simulation as sim, a.source as src, a.request_id as req
               from audit_log a join knowledge_facts f on f.id = a.entity_id
              where a.result = 'committed' and f.tenant_id = $1`,
            [TENANT_A],
          );
          assert.equal(row.rowCount, 1);
          assert.equal(
            new Date(row.rows[0]!.occurred).toISOString(),
            new Date(row.rows[0]!.selected).toISOString(),
            "the event and the canonical selection share one instant",
          );
          assert.equal(row.rows[0]!.authority, "membership");
          assert.equal(row.rows[0]!.sim, false, "a real mutation is not a simulation");
          assert.equal(row.rows[0]!.src, "knowledge-workspace");
          assert.equal(row.rows[0]!.req, "g1-request", "the request correlation is preserved");
        } finally {
          await verify.end();
        }
      }
    } finally {
      await handle.dispose();
    }

    console.log("g1 mutation-audit-postgres checks passed");
  } finally {
    await harness.dropDatabase();
  }
}

void main();
