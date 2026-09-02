/*
 * SUBJECT-ACT-HISTORY-1 — THE SUBJECT READ AGAINST REAL POSTGRES.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The page shows only the asking tenant's acts FOR THE NAMED SUBJECT, in a deterministic order,
 *    bounded — its total counts that subject and not the tenant — and a subject with no acts is
 *    read successfully rather than guessed at."
 *
 * ── AND THE METADATA FIREWALL IS PROVED AT RUNTIME, NOT ONLY STRUCTURALLY ────
 *
 * Every seeded row carries POISONED `metadata`, `previous_state` and `next_state`. A structural
 * firewall proves the columns are absent from the statement; this proves the poison never reaches a
 * caller through any path — a serialization, a spread, a driver quirk, a later refactor.
 *
 * Runs against a DISPOSABLE database this file creates, migrates and drops. Canonical is never
 * opened: the harness claims `DATABASE_URL` for the duration and restores it on drop.
 */
import assert from "node:assert/strict";
import { Client, Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { readSubjectActPage } from "../../src/features/governance-activity/subject-act-history-read.server";
import { observeSubjectActHistory } from "../../src/features/governance-activity/observe.server";
import {
  RECORDED_ACT_PAGE_LIMIT,
  WITHHELD_AUDIT_COLUMNS,
} from "../../src/features/governance-activity/contracts";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import type { ControlPlaneDatabase } from "../../src/db/client.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT_A = "10000000-0000-4000-8000-00000000a001";
const TENANT_B = "10000000-0000-4000-8000-00000000b001";
const ACTOR = "20000000-0000-4000-8000-000000000009";

/** The subject under test, and three near misses that must never bleed into it. */
const SUBJECT = "40000000-0000-4000-8000-000000000001";
/** The SAME uuid under a different entity type. Only both halves together identify a subject. */
const OTHER_TYPE_SAME_ID = SUBJECT;
/** A different work item of the same tenant. */
const SIBLING = "40000000-0000-4000-8000-000000000002";
/** The same uuid, in another organization. */
const CROSS_TENANT = SUBJECT;
/** A well-formed subject nobody ever acted on. */
const UNTOUCHED = "40000000-0000-4000-8000-00000000000f";

const POISON = "SHOULD-NEVER-SURFACE";

/** Deliberately above the bound, so a missing bound and a wrong total both bite. */
const SUBJECT_ACTS = RECORDED_ACT_PAGE_LIMIT * 2 + 3;

let seq = 0;
const uuid = (): string => {
  seq += 1;
  return `30000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
};

async function seedCompany(client: Client, id: string, name: string): Promise<void> {
  await client.query(`insert into companies (id, name, slug) values ($1, $2, $3)`, [
    id,
    name,
    name.toLowerCase(),
  ]);
}

async function seedAct(
  client: Client,
  act: {
    tenantId: string | null;
    entityType: string;
    entityId: string | null;
    action: string;
    occurredAt: string;
    result?: string;
  },
): Promise<void> {
  await client.query(
    `insert into audit_log
       (id, tenant_id, actor_type, actor_id, action, entity_type, entity_id,
        occurred_at, result, simulation, authority_source, previous_state, next_state, metadata)
     values ($1, $2, 'human', $3, $4, $5, $6, $7, $8, false, 'membership', $9, $10, $11)`,
    [
      uuid(),
      act.tenantId,
      ACTOR,
      act.action,
      act.entityType,
      act.entityId,
      act.occurredAt,
      act.result ?? "committed",
      /* Poisoned on every row: if any of these reaches a caller, §5 fails loudly. */
      JSON.stringify({ secretPrevious: POISON }),
      JSON.stringify({ secretNext: POISON }),
      JSON.stringify({ apiToken: POISON }),
    ],
  );
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_subject_acts");
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

    for (let index = 0; index < SUBJECT_ACTS; index += 1) {
      await seedAct(client, {
        tenantId: TENANT_A,
        entityType: "work_item",
        entityId: SUBJECT,
        action: "work.recorded",
        occurredAt: new Date(Date.UTC(2026, 8, 2, 0, index)).toISOString(),
      });
    }
    /* THE NEAR MISSES. Each differs from the subject in exactly one of the three predicates. */
    await seedAct(client, {
      tenantId: TENANT_A,
      entityType: "knowledge_fact",
      entityId: OTHER_TYPE_SAME_ID,
      action: "knowledge.create",
      occurredAt: "2026-09-02T23:00:00.000Z",
    });
    await seedAct(client, {
      tenantId: TENANT_A,
      entityType: "work_item",
      entityId: SIBLING,
      action: "work.retitled",
      occurredAt: "2026-09-02T23:10:00.000Z",
    });
    await seedAct(client, {
      tenantId: TENANT_B,
      entityType: "work_item",
      entityId: CROSS_TENANT,
      action: "work.recorded",
      occurredAt: "2026-09-02T23:20:00.000Z",
    });
    /* A GLOBAL row on the same subject: `tenant_id` is nullable and belongs to no organization. */
    await seedAct(client, {
      tenantId: null,
      entityType: "work_item",
      entityId: SUBJECT,
      action: "platform.control.updated",
      occurredAt: "2026-09-02T23:30:00.000Z",
    });
    /*
     * THERE IS NO SUBJECTLESS ACT TO SEED. `audit_log.entity_id` is NOT NULL, measured here by
     * attempting one and being refused by the database: every recorded act names a subject, which
     * is why a subject-scoped read can be complete for the subject it names rather than "complete
     * except for the acts nobody attributed".
     */
    await assert.rejects(
      seedAct(client, {
        tenantId: TENANT_A,
        entityType: "work_item",
        entityId: null,
        action: "work.unattributed",
        occurredAt: "2026-09-02T23:40:00.000Z",
      }),
      /entity_id/,
      "every recorded act must name a subject",
    );

    const subject = { entityType: "work_item", entityId: SUBJECT };

    /* ── 1 · THE SUBJECT PREDICATE IS ALL THREE EQUALITIES ────────────────
     * Every near miss is newer than every real act, so any leak lands at the TOP of the page and
     * cannot hide in a tail the bound cut off.
     */
    {
      const page = await readSubjectActPage(TENANT_A, subject, { getDb });
      assert.ok(page);
      assert.equal(page!.totalRecordedActs, SUBJECT_ACTS, "the total counts this subject only");
      assert.ok(
        page!.acts.every((act) => act.action === "work.recorded"),
        "no near-miss row appears: not another type, not a sibling, not another tenant, not global",
      );
      assert.ok(
        page!.acts.every((act) => act.entityType === "work_item"),
        "and every row is of the named entity type",
      );
    }

    /* ── 2 · TENANT ISOLATION — THE SAME SUBJECT ID, TWO ORGANIZATIONS ───── */
    {
      const a = await readSubjectActPage(TENANT_A, subject, { getDb });
      const b = await readSubjectActPage(TENANT_B, subject, { getDb });
      assert.ok(a && b);
      assert.equal(a!.totalRecordedActs, SUBJECT_ACTS, "A sees A's acts");
      assert.equal(b!.totalRecordedActs, 1, "B sees exactly its own one");
      assert.notEqual(a!.totalRecordedActs, b!.totalRecordedActs, "so the two genuinely differ");
    }

    /* ── 3 · THE BOUND BITES, AND THE TOTAL IS NOT THE PAGE ──────────────── */
    {
      const page = await readSubjectActPage(TENANT_A, subject, { getDb });
      assert.ok(page);
      assert.equal(page!.acts.length, RECORDED_ACT_PAGE_LIMIT, "the page is bounded");
      assert.equal(page!.truncated, true, "and says it is truncated");
      assert.notEqual(page!.acts.length, page!.totalRecordedActs, "the total is counted separately");
    }

    /* ── 4 · ORDERING IS TOTAL AND STABLE ─────────────────────────────────
     * Newest first, and the SAME page on a second call — a bounded read that reordered would be
     * showing "the most recent" without being able to say what that means.
     */
    {
      const first = await readSubjectActPage(TENANT_A, subject, { getDb });
      const second = await readSubjectActPage(TENANT_A, subject, { getDb });
      assert.ok(first && second);
      const times = first!.acts.map((act) => act.occurredAt);
      assert.deepEqual(times, [...times].sort().reverse(), "newest first");
      assert.deepEqual(second!.acts, first!.acts, "and the same page twice");
    }

    /* ── 5 · THE POISON NEVER SURFACES ────────────────────────────────────
     * THE REQUIRED BITE. Every seeded row carries a token in `metadata`, `previous_state` and
     * `next_state`. Serializing the ENTIRE result and searching it means no field, nested or not,
     * can carry one past this assertion.
     */
    {
      const page = await readSubjectActPage(TENANT_A, subject, { getDb });
      assert.ok(page);
      const serialized = JSON.stringify(page);
      assert.ok(!serialized.includes(POISON), "no withheld payload reaches a caller");
      assert.ok(!serialized.includes(ACTOR), "and no actor identifier does either");
      assert.ok(!serialized.includes(SUBJECT), "and the entity id is not echoed off the row");
      for (const act of page!.acts) {
        for (const column of WITHHELD_AUDIT_COLUMNS) {
          assert.ok(
            !(column in (act as unknown as Record<string, unknown>)),
            `a returned act must carry no ${column}`,
          );
        }
      }
    }

    /* ── 6 · A SUBJECT WITH NO ACTS IS READ, NOT GUESSED ──────────────────
     * `empty` here means the ledger answered. It is the state the whole phase must not confuse
     * with a failed read, and not with an inactive subject.
     */
    {
      const page = await readSubjectActPage(
        TENANT_A,
        { entityType: "work_item", entityId: UNTOUCHED },
        { getDb },
      );
      assert.ok(page, "a subject with no acts still returns a page — null means could not read");
      assert.equal(page!.totalRecordedActs, 0, "and the total is zero");
      assert.equal(page!.acts.length, 0, "with no acts");
      assert.equal(page!.truncated, false, "and nothing was cut off");

      const observed = await observeSubjectActHistory(
        { tenantId: TENANT_A } as TenantContext,
        { entityType: "work_item", entityId: UNTOUCHED },
        { getDb },
      );
      assert.equal(observed.status, "empty", "the observer calls that empty, never unavailable");
    }

    /* ── 7 · AN UNADDRESSABLE SUBJECT REACHES NO STATEMENT ────────────────── */
    {
      for (const bad of [
        { entityType: "work_item", entityId: "not-a-uuid" },
        { entityType: "work item", entityId: SUBJECT },
        { entityType: "", entityId: SUBJECT },
        { entityType: "work_item' or '1'='1", entityId: SUBJECT },
      ]) {
        assert.equal(
          await readSubjectActPage(TENANT_A, bad, { getDb }),
          null,
          `the reader refuses ${JSON.stringify(bad)} before building a predicate`,
        );
        const observed = await observeSubjectActHistory(
          { tenantId: TENANT_A } as TenantContext,
          bad,
          { getDb },
        );
        assert.equal(
          observed.status === "unavailable" ? observed.reason : null,
          "unrecognized-subject",
          "and the observer refuses it as unrecognized, never as empty",
        );
      }
    }

    /* ── 8 · THE OBSERVER CARRIES THE SUBJECT IT ANSWERED ABOUT ───────────── */
    {
      const observed = await observeSubjectActHistory(
        { tenantId: TENANT_A } as TenantContext,
        subject,
        { getDb },
      );
      assert.equal(observed.status, "recorded");
      if (observed.status === "recorded") {
        assert.deepEqual(observed.subject, subject, "the answer names what it is about");
        assert.equal(observed.tenantId, TENANT_A, "and whose it is");
      }
    }

    console.log("subject-act-history-flow/subject-postgres: OK");
  } finally {
    await client.end();
    await pool.end();
    await harness.dropDatabase();
  }
}

void main();
