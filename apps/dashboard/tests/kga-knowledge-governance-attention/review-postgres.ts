/*
 * KGA — KNOWLEDGE AWAITING A GOVERNANCE DECISION, AGAINST A REAL POSTGRES DATABASE.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A Knowledge version awaits Governance review when, and only when, no Governance decision
 *    names that exact version — never merely because it carries no ratification linkage."
 *
 * ── WHY THIS CANNOT BE A FAKE ────────────────────────────────────────────────
 *
 * The whole milestone turns on a difference that exists only in the database: a REJECTED version
 * carries no mark anywhere in Knowledge, so the `ratification_decision_id is null` population and
 * the "no decision names it" population differ by exactly the rows a hand-written fake would have
 * to be told about. A fake told the right answer proves the fake. These are real rows, real
 * `decision_records`, and a real `distinct` over them.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { readDecidedKnowledgeVersions } from "../../src/features/governance-decision/knowledge-decision-read.server";
import { readAttentionObservation } from "../../src/features/attention-observation/read-attention-observation.server";
import { readAttentionGroundingSource } from "../../src/features/attention-observation/heby-attention-source.server";
import { FORBIDDEN_ATTENTION_VOCABULARY } from "../../src/features/attention-observation/contracts";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import type { ControlPlaneDatabase } from "../../src/db/client.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT_A = "10000000-0000-4000-8000-00000000ca01";
const TENANT_B = "10000000-0000-4000-8000-00000000cb01";
const ACTOR = "20000000-0000-4000-8000-00000000ca09";

/** Pinned, so every duration below is arithmetic a reader can check by hand. */
const NOW = new Date("2026-09-01T12:00:00.000Z");
const AUTHORED_OLD = "2026-08-22T12:00:00.000Z"; /* 10 days before NOW */
const AUTHORED_NEW = "2026-08-31T12:00:00.000Z"; /*  1 day  before NOW */

const tenantOf = (tenantId: string) =>
  ({ tenantId, userId: ACTOR }) as unknown as TenantContext;

let seq = 0;
const uuid = (prefix: string): string => {
  seq += 1;
  return `${prefix}${String(seq).padStart(12, "0")}`;
};

interface SeedVersion {
  readonly tenantId: string;
  readonly factKey: string;
  readonly authoredAt: string;
  /** `ratify` writes the Knowledge linkage too; `reject` writes ONLY a decision, as K4 does. */
  readonly decision?: "ratify" | "reject";
  readonly lifecycle?: string;
}

/** Returns the node id, so a test can name the exact version a decision was about. */
async function seedVersion(client: Client, seed: SeedVersion): Promise<string> {
  const nodeId = uuid("90000000-0000-4000-8000-");
  const factId = uuid("80000000-0000-4000-8000-");
  let decisionId: string | null = null;
  let sessionId: string | null = null;

  if (seed.decision) {
    const session = await client.query<{ id: string }>(
      `insert into governance_sessions
         (tenant_id, governance_domain, decision_type, subject_type, proposer_actor_type, proposer_actor_id)
       values ($1, 'knowledge-ratification', $2, 'knowledge_node', 'human', $3)
       returning id`,
      [seed.tenantId, seed.decision, ACTOR],
    );
    sessionId = session.rows[0]!.id;
    const decision = await client.query<{ id: string }>(
      `insert into decision_records
         (tenant_id, session_id, decision_type, subject_type, subject_id, actor_type, actor_id,
          bootstrap, outcome, justification)
       values ($1, $2, $3, 'knowledge_node', $4, 'human', $5, false, $6,
               'Seeded: a Governance decision naming this exact version.')
       returning id`,
      [
        seed.tenantId,
        sessionId,
        seed.decision,
        nodeId,
        ACTOR,
        seed.decision === "ratify" ? "ratified" : "rejected",
      ],
    );
    decisionId = decision.rows[0]!.id;
  }

  /*
   * K4's ASYMMETRY, REPRODUCED EXACTLY. A ratify writes the Knowledge linkage; a reject writes
   * NOTHING to Knowledge. If this seed wrote a linkage for a rejection it would be testing a
   * system Hebun does not have, and the rejected-version assertion would pass for the wrong reason.
   */
  const bound = seed.decision === "ratify";
  await client.query(
    `insert into knowledge_nodes
       (id, tenant_id, type, label, statement, knowledge_lifecycle_status, knowledge_health,
        knowledge_scope, knowledge_authority, domain_key, knowledge_version, created_at,
        ratification_decision_id, governance_session_id, ratified_at, ratified_by_actor_type,
        ratified_by_actor_id)
     values ($1, $2, 'knowledge-statement', $3, $4, $5, 'unknown', 'company-wide', 'provisional',
             'policies', 1, $6, $7, $8, $9, $10, $11)`,
    [
      nodeId,
      seed.tenantId,
      `policies/${seed.factKey}`,
      `SECRET-STATEMENT-${seed.factKey}`,
      seed.lifecycle ?? "draft",
      seed.authoredAt,
      bound ? decisionId : null,
      bound ? sessionId : null,
      bound ? seed.authoredAt : null,
      bound ? "human" : null,
      bound ? ACTOR : null,
    ],
  );
  await client.query(
    `insert into knowledge_facts
       (id, tenant_id, fact_key, domain_key, knowledge_scope, active_knowledge_node_id, fact_version)
     values ($1, $2, $3, 'policies', 'company-wide', $4, 1)`,
    [factId, seed.tenantId, seed.factKey, nodeId],
  );
  return nodeId;
}

/** Every reader except the two under test answers emptily, so nothing else can colour a result. */
function depsFor(db: ControlPlaneDatabase, repo: ReturnType<typeof createDurableKnowledgeRepository>) {
  return {
    now: () => NOW,
    getDb: () => db,
    getRepo: () => repo,
    readAwaiting: async () => ({ status: "read" as const, value: { awaiting: 0, oldestFiledAt: null } }),
    readApproved: async () => ({
      status: "read" as const,
      value: { approvedWithoutAttempt: 0, oldestApprovedAt: null },
    }),
    readPermits: async () => ({ status: "read" as const, items: [] }),
    readActivity: async () => ({
      status: "observed" as const,
      observation: { totalRecordedActs: 0, latestOccurredAt: null },
    }),
  } as never;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_kga_review");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  const pool = new Client({ connectionString: harness.dbUrl });

  try {
    harness.migrateDatabase();
    await client.connect();
    await pool.connect();
    const db = drizzle(pool) as unknown as ControlPlaneDatabase;
    const repo = createDurableKnowledgeRepository(db);
    const deps = depsFor(db, repo);

    await client.query(
      `insert into companies (id, name, slug) values ($1, 'Tenant A', 'tenant-ka'), ($2, 'Tenant B', 'tenant-kb')`,
      [TENANT_A, TENANT_B],
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. A VERSION NO DECISION NAMES APPEARS, AND ITS DURATION IS AUTHORING TIME.
     * ═════════════════════════════════════════════════════════════════════ */
    await seedVersion(client, { tenantId: TENANT_A, factKey: "undecided-old", authoredAt: AUTHORED_OLD });
    {
      const read = await readAttentionObservation(tenantOf(TENANT_A), deps);
      assert.equal(read.status, "observed");
      const block = read.status === "observed" ? read.observation.knowledgeAwaitingReview : null;
      assert.equal(block?.status, "observed", "both halves answered, so the block is observed");
      assert.equal(block?.status === "observed" && block.value.awaitingReview, 1);
      const oldest = block?.status === "observed" ? block.value.oldestAwaiting : null;
      assert.equal(oldest?.basis, "knowledge-node.created_at", "the duration names the column it came from");
      assert.equal(oldest?.instant, AUTHORED_OLD, "measured from the version's own authoring instant");
      assert.equal(oldest?.milliseconds, 10 * 24 * 60 * 60 * 1000, "ten days, computed not asserted");
      assert.equal(oldest?.direction, "elapsed");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. A RATIFIED VERSION DISAPPEARS.
     * ═════════════════════════════════════════════════════════════════════ */
    await seedVersion(client, {
      tenantId: TENANT_A,
      factKey: "ratified",
      authoredAt: AUTHORED_OLD,
      decision: "ratify",
    });
    {
      const read = await readAttentionObservation(tenantOf(TENANT_A), deps);
      const block = read.status === "observed" ? read.observation.knowledgeAwaitingReview : null;
      assert.equal(
        block?.status === "observed" && block.value.awaitingReview,
        1,
        "a ratified version is decided and is not awaiting anything",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. A REJECTED VERSION DISAPPEARS — the assertion this milestone exists for.
     *
     * It carries NO ratification linkage, so a `ratification_decision_id is null` observation would
     * count it. It is excluded here only because Governance was asked.
     * ═════════════════════════════════════════════════════════════════════ */
    const rejectedNode = await seedVersion(client, {
      tenantId: TENANT_A,
      factKey: "rejected",
      authoredAt: AUTHORED_OLD,
      decision: "reject",
    });
    {
      const linkage = await client.query<{ n: string }>(
        `select count(*)::text as n from knowledge_nodes
          where id = $1 and ratification_decision_id is null and ratified_at is null`,
        [rejectedNode],
      );
      assert.equal(
        Number(linkage.rows[0]!.n),
        1,
        "the rejected version carries no Knowledge mark — this is what makes the naive predicate wrong",
      );

      const read = await readAttentionObservation(tenantOf(TENANT_A), deps);
      const block = read.status === "observed" ? read.observation.knowledgeAwaitingReview : null;
      assert.equal(
        block?.status === "observed" && block.value.awaitingReview,
        1,
        "rejected is DECIDED: nobody still owes an answer about it",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. A DECISION ABOUT ANOTHER VERSION SUPPRESSES NOTHING.
     * ═════════════════════════════════════════════════════════════════════ */
    await seedVersion(client, { tenantId: TENANT_A, factKey: "undecided-new", authoredAt: AUTHORED_NEW });
    {
      const read = await readAttentionObservation(tenantOf(TENANT_A), deps);
      const block = read.status === "observed" ? read.observation.knowledgeAwaitingReview : null;
      assert.equal(
        block?.status === "observed" && block.value.awaitingReview,
        2,
        "two undecided versions; the ratify and reject decisions named other rows",
      );
      const oldest = block?.status === "observed" ? block.value.oldestAwaiting : null;
      assert.equal(oldest?.instant, AUTHORED_OLD, "oldest is the largest elapsed, never the newest");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. TENANT ISOLATION, IN BOTH DIRECTIONS.
     * ═════════════════════════════════════════════════════════════════════ */
    await seedVersion(client, { tenantId: TENANT_B, factKey: "b-undecided", authoredAt: AUTHORED_OLD });
    {
      const a = await readAttentionObservation(tenantOf(TENANT_A), deps);
      const blockA = a.status === "observed" ? a.observation.knowledgeAwaitingReview : null;
      assert.equal(
        blockA?.status === "observed" && blockA.value.awaitingReview,
        2,
        "tenant B's version never appears in tenant A's observation",
      );

      /* And B's decisions cannot suppress A's versions: B has decided nothing at all. */
      const decidedB = await readDecidedKnowledgeVersions(tenantOf(TENANT_B), { getDb: () => db });
      assert.equal(decidedB.status, "read");
      assert.equal(
        decidedB.status === "read" && decidedB.decidedNodeIds.size,
        0,
        "tenant B sees none of tenant A's decisions",
      );

      const decidedA = await readDecidedKnowledgeVersions(tenantOf(TENANT_A), { getDb: () => db });
      assert.equal(
        decidedA.status === "read" && decidedA.decidedNodeIds.size,
        2,
        "tenant A sees exactly its own ratify and reject subjects — decision TYPE is not filtered",
      );
      assert.ok(
        decidedA.status === "read" && decidedA.decidedNodeIds.has(rejectedNode),
        "the rejected subject is in the decided set; that is why it stopped waiting",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. UNAVAILABLE != ZERO, ON EITHER SIDE, INDEPENDENTLY.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const knowledgeDown = await readAttentionObservation(tenantOf(TENANT_A), {
        ...(deps as object),
        readCurrentVersions: async () => ({ status: "unavailable" as const, reason: "read-failed" }),
      } as never);
      const kb = knowledgeDown.status === "observed" ? knowledgeDown.observation.knowledgeAwaitingReview : null;
      assert.equal(kb?.status, "unavailable", "an unreadable Knowledge list is not an empty one");
      assert.match(kb?.status === "unavailable" ? kb.reason : "", /^knowledge:/, "it names which half failed");

      const governanceDown = await readAttentionObservation(tenantOf(TENANT_A), {
        ...(deps as object),
        readDecidedVersions: async () => ({ status: "unavailable" as const, reason: "read-failed" }),
      } as never);
      const gb = governanceDown.status === "observed" ? governanceDown.observation.knowledgeAwaitingReview : null;
      assert.equal(
        gb?.status,
        "unavailable",
        "an unreadable decision set must NOT let every version look undecided",
      );
      assert.match(
        gb?.status === "unavailable" ? gb.reason : "",
        /^governance-decision:/,
        "the two availabilities stay distinguishable",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. NO KNOWLEDGE CONTENT REACHES HEBY, AND NO BANNED VOCABULARY EITHER.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const source = await readAttentionGroundingSource(tenantOf(TENANT_A), deps);
      assert.equal(source.state, "resolved");
      assert.equal(source.authoritative, false, "a derived duration is never an authoritative fact");
      assert.equal(source.items.length, 5, "four released blocks plus this one; nothing was deleted");

      const rendered = source.items.map((i) => `${i.label} ${i.detail}`).join(" ");
      assert.ok(
        !/SECRET-STATEMENT/.test(rendered),
        "no Knowledge statement text may reach Command grounding",
      );
      for (const leak of ["policies/", "undecided-old", "undecided-new", "rejected", "knowledge-statement"]) {
        assert.ok(!rendered.includes(leak), `no Knowledge identity or content may reach Command (${leak})`);
      }
      assert.ok(
        !new RegExp(`${TENANT_A}|${rejectedNode}`).test(rendered),
        "no tenant id and no node id may reach Command",
      );

      const lower = rendered.toLowerCase();
      for (const word of FORBIDDEN_ATTENTION_VOCABULARY) {
        assert.ok(
          !new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower),
          `the grounding source must not use "${word}"`,
        );
      }

      const review = source.items.find((i) => i.recordRef === "attention:knowledge-governance-review");
      assert.ok(review, "the review item exists");
      assert.match(review!.detail, /2 with no ratify or reject decision/, "the count is stated exactly");
      assert.match(review!.detail, /basis knowledge-node\.created_at/, "the basis travels with the number");
      assert.match(review!.detail, /\/knowledge/, "it routes to the authority that owns the act");

      /* THE FOUR RELEASED ITEMS ARE UNCHANGED — E2-4 semantics are extended, never rewritten. */
      for (const ref of [
        "attention:awaiting-decision",
        "attention:approved-without-attempt",
        "attention:authorized-unspent",
        "attention:recorded-act-recency",
      ]) {
        assert.ok(source.items.some((i) => i.recordRef === ref), `${ref} is still contributed`);
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. THE OBSERVATION CAUSED NO DECISION AND NO WRITE.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const decisions = await client.query<{ n: string }>(
        `select count(*)::text as n from decision_records`,
      );
      assert.equal(Number(decisions.rows[0]!.n), 2, "reading created no decision record");
      const permits = await client.query<{ n: string }>(`select count(*)::text as n from action_permits`);
      assert.equal(Number(permits.rows[0]!.n), 0, "no authorization became reachable");
      const attempts = await client.query<{ n: string }>(
        `select count(*)::text as n from action_execution_attempts`,
      );
      assert.equal(Number(attempts.rows[0]!.n), 0, "no execution became reachable");
    }

    console.log("KGA knowledge governance attention (postgres): PASS");
  } finally {
    await client.end().catch(() => {});
    await pool.end().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
