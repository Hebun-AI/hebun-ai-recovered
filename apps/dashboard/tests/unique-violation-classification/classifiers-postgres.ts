/**
 * PACKAGE 3 M2-R4 — EVERY LOST-RACE CLASSIFIER READS THE CODE DRIZZLE ACTUALLY CARRIES.
 *
 * drizzle-orm wraps driver errors in DrizzleQueryError; the Postgres code is on `cause`. Four
 * writers decide "lost race" from that code: Knowledge create (K2, M2-R2), Agent Mandate, Standing
 * Observation and Work Artifact revision. Each now reads the code on the error or one cause level,
 * and nothing else.
 *
 *   1. Over REAL errors captured from Postgres — a direct driver error, a drizzle-wrapped unique
 *      violation, a drizzle-wrapped undefined-table error — and over shapes that must never count:
 *      permission denied, connection refused, null, a string, a two-level cause chain.
 *   2. Work Artifact revision end to end. Its FOR UPDATE lock serializes honest revisers, so the
 *      unique index is reached only by a row the lock never saw; one is planted directly. The
 *      reviser must report revision-conflict and write nothing.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { sql } from "drizzle-orm";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { isUniqueViolation as knowledgeCreate } from "../../src/features/knowledge/durable-knowledge-writer.server";
import { isUniqueViolation as agentMandate } from "../../src/features/agent-mandate/establish-agent-mandate.server";
import { isUniqueViolation as standingObservation } from "../../src/features/standing-observation-authority/authorize-standing-observation.server";
import {
  createWorkArtifact,
  isUniqueViolation as workArtifact,
  reviseWorkArtifact,
} from "../../src/features/work-artifacts/write-work-artifacts.server";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = "10000000-0000-4000-8000-0000000000e4";
const USER = "20000000-0000-4000-8000-0000000000e4";
const NOW = new Date("2026-11-03T12:00:00.000Z");
const CLASSIFIERS = { knowledgeCreate, agentMandate, standingObservation, workArtifact };

const ctx = asHumanTenantContext({
  tenantId: TENANT,
  userId: USER,
  authIdentityId: "identity",
  membershipId: "membership",
  membershipVersion: 1,
  roleId: "role",
  sessionContextId: "session",
  provider: "local",
  assuranceLevel: "aal1",
  mfaVerified: false,
  requestId: "m2-r4",
  authenticatedAt: NOW.toISOString(),
});

async function captured(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error("expected the statement to fail");
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_unique_violation");
  await harness.createDatabase();
  try {
    harness.migrateDatabase();
    const raw = new Client({ connectionString: harness.dbUrl });
    await raw.connect();
    const handle = createControlPlaneDb(harness.dbUrl);
    try {
      /* ── 1. THE CLASSIFIERS ── */
      await raw.query(`create table uv_probe (k text primary key)`);
      await raw.query(`insert into uv_probe values ('a')`);
      const direct = await captured(() => raw.query(`insert into uv_probe values ('a')`));
      const wrapped = await captured(() => handle.db.transaction(async (tx) => { await tx.execute(sql`insert into uv_probe values ('a')`); }));
      const wrappedOther = await captured(() => handle.db.execute(sql`select * from uv_no_such_table`));
      assert.equal((wrapped as Error).constructor.name, "DrizzleQueryError");
      assert.equal((wrapped as { cause?: { code?: unknown } }).cause?.code, "23505");
      assert.equal((wrappedOther as { cause?: { code?: unknown } }).cause?.code, "42P01");

      const cases: readonly (readonly [string, unknown, boolean])[] = [
        ["direct 23505", direct, true],
        ["drizzle-wrapped 23505", wrapped, true],
        ["drizzle-wrapped 42P01", wrappedOther, false],
        ["42501 permission denied", { cause: { code: "42501" } }, false],
        ["ECONNREFUSED", Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }), false],
        ["null", null, false],
        ["a string", "23505", false],
        ["a two-level cause chain", { cause: { cause: { code: "23505" } } }, false],
      ];
      for (const [name, classify] of Object.entries(CLASSIFIERS)) {
        for (const [label, error, expected] of cases) assert.equal(classify(error), expected, `${name}: ${label}`);
      }

      /* ── 2. WORK ARTIFACT REVISION REACHES THE INDEX: revision-conflict, nothing written ── */
      await raw.query(`insert into companies (id, name, slug) values ($1, 'Tenant E', 'tenant-e')`, [TENANT]);
      const deps = { getDb: () => handle.db, now: () => NOW };
      const made = await createWorkArtifact(ctx, { artifactType: "message-draft", title: "t", content: "v1" }, "operations", deps);
      assert.equal(made.status, "created");
      if (made.status !== "created") throw new Error("unreachable");
      await raw.query(
        `insert into work_artifact_revisions (tenant_id, artifact_id, revision_no, content, content_digest,
                                              authored_by_actor_type, authored_by_actor_id, created_at)
         select tenant_id, artifact_id, 2, content, content_digest, authored_by_actor_type, authored_by_actor_id, created_at
           from work_artifact_revisions where artifact_id = $1`,
        [made.artifactId],
      );
      const conflicted = await reviseWorkArtifact(ctx, { artifactId: made.artifactId, content: "v2" }, deps);
      assert.deepEqual(conflicted, { status: "refused", reason: "revision-conflict" }, "a revision the lock never saw is a conflict");
      const state = await raw.query<{ current: number; revisions: number }>(
        `select current_revision as current,
                (select count(*)::int from work_artifact_revisions where artifact_id = $1) as revisions
           from work_artifacts where id = $1`,
        [made.artifactId],
      );
      assert.deepEqual(state.rows[0], { current: 1, revisions: 2 }, "the refused revision wrote nothing and moved nothing");
    } finally {
      await raw.end();
      await handle.dispose();
    }
    console.log(`unique-violation-classification/classifiers-postgres: ${Object.keys(CLASSIFIERS).length} classifiers x 8 shapes; revision-conflict end to end`);
  } finally {
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
