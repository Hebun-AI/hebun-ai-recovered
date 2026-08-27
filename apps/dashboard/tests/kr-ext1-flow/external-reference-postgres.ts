/*
 * KR-EXT1 — the external-system reference, proved against a REAL PostgreSQL database.
 *
 * ── WHY THIS MUST BE A DATABASE TEST ─────────────────────────────────────────
 *
 * Almost every guarantee this phase makes lives in the schema, not in a code path: the composite
 * tenant foreign key, the human-declarer CHECK, the both-or-neither withdrawal pair, the bounded
 * identity, and the PARTIAL unique index that lets a withdrawn association be declared again. None
 * of those can be observed by reading source; a fake would only prove that a fake agrees with a
 * writer.
 *
 * It also proves the sentence the whole phase exists for — that the join is EXACT and needs no model
 * — and the sentence K3 exists for: attaching and withdrawing a reference leaves `knowledge_nodes`
 * byte-for-byte as it was.
 *
 * Uses a disposable local database, dropped on exit. No production data is touched, and no provider
 * is contacted.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createDurableKnowledgeWriter } from "../../src/features/knowledge/durable-knowledge-writer.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import {
  attachExternalReference,
  findKnowledgeFactForExternalRecord,
  listExternalReferences,
  withdrawExternalReference,
} from "../../src/features/knowledge/external-reference-authority.server";
import { renderExternalReference } from "../../src/features/knowledge/external-reference-contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
const TENANT_A = "10000000-0000-4000-8000-00000000ea01";
const TENANT_B = "10000000-0000-4000-8000-00000000eb01";
const USER_A = "20000000-0000-4000-8000-00000000ea01";
const USER_B = "20000000-0000-4000-8000-00000000eb01";
const NOW = new Date("2026-08-26T09:00:00.000Z");

/** The record INT-5B1 actually read in production. Expected evidence, never acceptance logic. */
const GITHUB_REPOSITORY = Object.freeze({
  providerKey: "github-organization",
  capability: "github.repository.activity.read",
  recordType: "repository",
  recordId: "1300480452",
});

function tenantContext(tenantId: string, userId: string): TenantContext {
  return asHumanTenantContext({
    tenantId,
    userId,
    authIdentityId: "identity",
    membershipId: "membership",
    membershipVersion: 1,
    roleId: "role",
    sessionContextId: "session",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "kr-ext1",
    authenticatedAt: NOW.toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_krext1_reference");
  await harness.createDatabase();

  try {
    /* This also proves the migration applies through the SANCTIONED tooling, not only via psql. */
    harness.migrateDatabase();

    const seed = new Client({ connectionString: harness.dbUrl });
    await seed.connect();
    try {
      await seed.query(
        `insert into companies (id, name, slug)
         values ($1, 'Tenant A', 'kr-ext1-a'), ($2, 'Tenant B', 'kr-ext1-b')`,
        [TENANT_A, TENANT_B],
      );
    } finally {
      await seed.end();
    }

    const handle = createControlPlaneDb(harness.dbUrl);
    const probe = new Client({ connectionString: harness.dbUrl });
    await probe.connect();

    try {
      const writer = createDurableKnowledgeWriter(handle.db);
      const authorized = async () => ({ authorized: true, roleType: "owner" });
      const denied = async () => ({ authorized: false, roleType: "member" });
      const createDeps = { resolveAuthority: authorized, getWriter: () => writer, now: () => NOW };
      const refDeps = { getDb: () => handle.db, resolveAuthority: authorized };
      const A = tenantContext(TENANT_A, USER_A);
      const B = tenantContext(TENANT_B, USER_B);

      const factOf = async (tenant: TenantContext, key: string): Promise<string> => {
        const created = await createKnowledgeFact(
          tenant,
          { factKey: key, domainKey: "engineering", scope: "company-wide", title: key, statement: `About ${key}.` },
          createDeps,
        );
        assert.equal(created.status, "created", `${key} was created`);
        if (created.status !== "created") throw new Error("unreachable");
        return created.identity.factId;
      };

      const factA = await factOf(A, "hebun-platform");
      const factB = await factOf(B, "other-org-system");

      /** A fingerprint of every Knowledge node, so K3's invariant can be checked by comparison. */
      const nodeFingerprint = async (): Promise<string> => {
        const r = await probe.query(
          `select md5(string_agg(t::text, '|' order by t::text)) as f from knowledge_nodes t`,
        );
        return String(r.rows[0]?.f ?? "");
      };
      const nodesBefore = await nodeFingerprint();

      /* ── 1. AN AUTHORIZED HUMAN DECLARES THE ASSOCIATION ─────────────────── */
      const declared = await attachExternalReference(
        A,
        { knowledgeFactId: factA, reference: GITHUB_REPOSITORY },
        refDeps,
      );
      assert.equal(declared.status, "declared", "an authorized human may declare the association");
      if (declared.status !== "declared") throw new Error("unreachable");
      assert.equal(declared.reference.recordId, "1300480452");
      assert.ok(declared.reference.declaredAt.length > 0, "the declaration is dated");

      /* ── 2. THE DATABASE RECORDED A HUMAN, AND NOTHING ELSE COULD ────────── */
      {
        const row = await probe.query(
          `select declared_by, declared_by_type, withdrawn_at from knowledge_external_references
           where id = $1`,
          [declared.reference.referenceId],
        );
        assert.equal(row.rowCount, 1);
        assert.equal(row.rows[0]!.declared_by, USER_A, "the declaring actor is the session's human");
        assert.equal(row.rows[0]!.declared_by_type, "human");
        assert.equal(row.rows[0]!.withdrawn_at, null, "a fresh declaration is live");
      }

      /* ── 3. K3 — KNOWLEDGE NODES ARE UNTOUCHED ───────────────────────────── */
      assert.equal(
        await nodeFingerprint(),
        nodesBefore,
        "declaring a reference must not change a single byte of any knowledge node",
      );

      /* ── 4. THE READ SEAM RETURNS THE EXACT IDENTITY ─────────────────────── */
      {
        const listed = await listExternalReferences(A, factA, refDeps);
        assert.equal(listed.length, 1);
        assert.deepEqual(
          { ...listed[0]!, referenceId: undefined, declaredAt: undefined },
          { ...GITHUB_REPOSITORY, referenceId: undefined, declaredAt: undefined },
          "every field of the provider identity survives the round trip",
        );
        assert.equal(
          renderExternalReference(listed[0]!),
          "integrations/github-organization/github.repository.activity.read/repository/1300480452",
          "and renders as the identity INT-5B1 accepted in production",
        );
      }

      /* ── 5. THE DETERMINISTIC JOIN — THE REASON THIS PHASE EXISTS ────────── */
      {
        const found = await findKnowledgeFactForExternalRecord(A, GITHUB_REPOSITORY, refDeps);
        assert.equal(found, factA, "repository 1300480452 resolves to its Knowledge fact, in SQL");

        /* And onward: fact → active node → any Governance decision attached to that node. */
        const chain = await probe.query(
          `select f.id as fact_id, f.active_knowledge_node_id as node_id,
                  (select count(*) from decision_records d
                    where d.subject_type = 'knowledge_node'
                      and d.subject_id = f.active_knowledge_node_id) as decisions
             from knowledge_facts f where f.id = $1`,
          [found],
        );
        assert.equal(chain.rowCount, 1, "the fact resolves");
        assert.ok(chain.rows[0]!.node_id, "and names an active knowledge node");
        assert.equal(
          Number(chain.rows[0]!.decisions),
          0,
          "with zero decisions today — the chain is walkable, and it does not invent one",
        );
      }

      /* ── 5b. THE JOIN IS PRECISE, NOT MERELY PRESENT ─────────────────────── */
      {
        /*
         * A LOOKUP THAT RETURNS THE ONLY ROW IS NOT A PROOF OF A JOIN.
         *
         * With one reference on file, a resolver that ignored the record id entirely would still
         * answer correctly, and this suite would have said so — a mutation that deleted the
         * `recordId` predicate SURVIVED until this section existed. Precision needs a second record
         * to be distinguished FROM, and a third that is referenced by nobody.
         */
        const secondFact = await factOf(A, "hebun-website");
        const SECOND_RECORD = { ...GITHUB_REPOSITORY, recordId: "987654321" };
        const second = await attachExternalReference(
          A,
          { knowledgeFactId: secondFact, reference: SECOND_RECORD },
          refDeps,
        );
        assert.equal(second.status, "declared");

        assert.equal(
          await findKnowledgeFactForExternalRecord(A, GITHUB_REPOSITORY, refDeps),
          factA,
          "1300480452 resolves to ITS fact and not the other one",
        );
        assert.equal(
          await findKnowledgeFactForExternalRecord(A, SECOND_RECORD, refDeps),
          secondFact,
          "and 987654321 resolves to ITS fact — the record id decides, not the row count",
        );
        assert.equal(
          await findKnowledgeFactForExternalRecord(A, { ...GITHUB_REPOSITORY, recordId: "5" }, refDeps),
          null,
          "a record nobody referenced resolves to nothing — UNMATCHED is not a guess",
        );

        /* The other three identity fields are equally load-bearing. */
        for (const near of [
          { ...GITHUB_REPOSITORY, providerKey: "google-workspace" },
          { ...GITHUB_REPOSITORY, capability: "github.repository.activity.write" },
          { ...GITHUB_REPOSITORY, recordType: "pull-request" },
        ]) {
          assert.equal(
            await findKnowledgeFactForExternalRecord(A, near, refDeps),
            null,
            `a near-miss identity resolves to nothing: ${JSON.stringify(near)}`,
          );
        }
      }

      /*
       * Section 5b legitimately created a second Knowledge fact, which inserts a node. So the
       * K3 baseline is re-taken HERE, and everything after this point is reference work only.
       */
      const nodesAfterSetup = await nodeFingerprint();

      /* ── 6. A DUPLICATE LIVE DECLARATION IS REFUSED, NOT DUPLICATED ──────── */
      {
        const again = await attachExternalReference(
          A,
          { knowledgeFactId: factA, reference: GITHUB_REPOSITORY },
          refDeps,
        );
        assert.deepEqual(again, { status: "refused", reason: "already-declared" });
        const count = await probe.query(
          `select count(*)::int as n from knowledge_external_references where knowledge_fact_id = $1`,
          [factA],
        );
        assert.equal(count.rows[0]!.n, 1, "and no second row exists");
      }

      /* ── 7. CROSS-TENANT IS UNREACHABLE IN EVERY DIRECTION ───────────────── */
      {
        const foreignFact = await attachExternalReference(
          B,
          { knowledgeFactId: factA, reference: GITHUB_REPOSITORY },
          refDeps,
        );
        assert.deepEqual(
          foreignFact,
          { status: "refused", reason: "knowledge-fact-not-found" },
          "tenant B cannot attach to tenant A's fact, and cannot tell it exists",
        );

        assert.deepEqual(await listExternalReferences(B, factA, refDeps), [], "nor read its references");
        assert.equal(
          await findKnowledgeFactForExternalRecord(B, GITHUB_REPOSITORY, refDeps),
          null,
          "nor resolve the record through it",
        );
        assert.deepEqual(
          await withdrawExternalReference(B, { referenceId: declared.reference.referenceId }, refDeps),
          { status: "refused", reason: "reference-not-found" },
          "nor withdraw it",
        );

        /* THE FOREIGN KEY REFUSES IT EVEN WITH A HAND-CRAFTED INSERT. */
        await assert.rejects(
          probe.query(
            `insert into knowledge_external_references
               (tenant_id, knowledge_fact_id, provider_key, capability, record_type, record_id,
                declared_by, declared_by_type)
             values ($1,$2,'github-organization','github.repository.activity.read','repository','9',$3,'human')`,
            [TENANT_B, factA, USER_B],
          ),
          /foreign key|violates/i,
          "the composite (fact, tenant) foreign key refuses a cross-tenant row at the database",
        );
      }

      /* ── 8. TWO TENANTS MAY REFERENCE THE SAME RECORD, INDEPENDENTLY ─────── */
      {
        const bDeclared = await attachExternalReference(
          B,
          { knowledgeFactId: factB, reference: GITHUB_REPOSITORY },
          refDeps,
        );
        assert.equal(bDeclared.status, "declared", "the same external record may be referenced by another tenant");
        assert.equal(await findKnowledgeFactForExternalRecord(B, GITHUB_REPOSITORY, refDeps), factB);
        assert.equal(
          await findKnowledgeFactForExternalRecord(A, GITHUB_REPOSITORY, refDeps),
          factA,
          "and neither tenant's answer moves",
        );
      }

      /* ── 9. THE DATABASE REFUSES A NON-HUMAN DECLARER ────────────────────── */
      await assert.rejects(
        probe.query(
          `insert into knowledge_external_references
             (tenant_id, knowledge_fact_id, provider_key, capability, record_type, record_id,
              declared_by, declared_by_type)
           values ($1,$2,'github-organization','github.repository.activity.read','repository','7',$3,'agent')`,
          [TENANT_A, factA, USER_A],
        ),
        /knowledge_external_references_human_declarer_chk/,
        "no agent, system or service may author this relationship — enforced by CHECK",
      );

      /* ── 10. THE DATABASE REFUSES AN IDENTIFIER THAT IS NOT ONE ──────────── */
      for (const [label, recordId] of [
        ["a name with whitespace", "Hebun-AI/hebun ai"],
        ["an over-long value", "x".repeat(129)],
        ["an empty value", ""],
      ] as const) {
        await assert.rejects(
          probe.query(
            `insert into knowledge_external_references
               (tenant_id, knowledge_fact_id, provider_key, capability, record_type, record_id,
                declared_by, declared_by_type)
             values ($1,$2,'github-organization','github.repository.activity.read','repository',$3,$4,'human')`,
            [TENANT_A, factA, recordId, USER_A],
          ),
          /bounded_identity_chk/,
          `${label} is refused as a provider identity`,
        );
      }

      /* ── 11. A MALFORMED REFERENCE NEVER REACHES THE DATABASE ────────────── */
      for (const bad of [
        { ...GITHUB_REPOSITORY, recordId: "1300480452 " },
        { ...GITHUB_REPOSITORY, recordId: "" },
        { ...GITHUB_REPOSITORY, providerKey: 42 },
        { providerKey: "github-organization" },
        "integrations/github-organization/x/repository/1",
      ]) {
        const refused = await attachExternalReference(A, { knowledgeFactId: factA, reference: bad }, refDeps);
        assert.deepEqual(
          refused,
          { status: "refused", reason: "malformed-reference" },
          `a malformed reference is refused in the seam: ${JSON.stringify(bad)}`,
        );
      }

      /* ── 12. AN UNAUTHORIZED ACTOR DECLARES NOTHING ──────────────────────── */
      {
        const refused = await attachExternalReference(
          A,
          { knowledgeFactId: factA, reference: { ...GITHUB_REPOSITORY, recordId: "999" } },
          { getDb: () => handle.db, resolveAuthority: denied },
        );
        assert.deepEqual(refused, { status: "refused", reason: "not-authorized" });
        assert.deepEqual(
          await withdrawExternalReference(
            A,
            { referenceId: declared.reference.referenceId },
            { getDb: () => handle.db, resolveAuthority: denied },
          ),
          { status: "refused", reason: "not-authorized" },
          "and withdraws nothing",
        );
      }

      /* ── 13. AN UNAUTHENTICATED CALLER REACHES NOTHING ───────────────────── */
      assert.deepEqual(
        await attachExternalReference(null, { knowledgeFactId: factA, reference: GITHUB_REPOSITORY }, refDeps),
        { status: "refused", reason: "no-authorized-tenant-context" },
      );
      assert.deepEqual(await listExternalReferences(null, factA, refDeps), []);

      /* ── 14. WITHDRAWAL ENDS THE DECLARATION AND KEEPS THE RECORD ────────── */
      {
        const withdrawn = await withdrawExternalReference(
          A,
          { referenceId: declared.reference.referenceId },
          refDeps,
        );
        assert.deepEqual(withdrawn, { status: "withdrawn" });

        assert.deepEqual(await listExternalReferences(A, factA, refDeps), [], "the live read no longer returns it");
        assert.equal(
          await findKnowledgeFactForExternalRecord(A, GITHUB_REPOSITORY, refDeps),
          null,
          "and the join no longer resolves it",
        );

        const row = await probe.query(
          `select withdrawn_by, withdrawn_by_type, withdrawn_at is not null as ended
             from knowledge_external_references where id = $1`,
          [declared.reference.referenceId],
        );
        assert.equal(row.rowCount, 1, "THE ROW SURVIVES — a withdrawal is a transition, not a delete");
        assert.equal(row.rows[0]!.ended, true);
        assert.equal(row.rows[0]!.withdrawn_by, USER_A, "and it names who ended it");
        assert.equal(row.rows[0]!.withdrawn_by_type, "human");

        /* Withdrawing twice is a no-op, never a second contradictory record of one ending. */
        assert.deepEqual(
          await withdrawExternalReference(A, { referenceId: declared.reference.referenceId }, refDeps),
          { status: "refused", reason: "reference-not-found" },
        );
      }

      /* ── 15. THE SAME ASSOCIATION MAY BE DECLARED AGAIN ──────────────────── */
      {
        const again = await attachExternalReference(
          A,
          { knowledgeFactId: factA, reference: GITHUB_REPOSITORY },
          refDeps,
        );
        assert.equal(again.status, "declared", "the partial index frees the association once withdrawn");
        const rows = await probe.query(
          `select count(*)::int as n from knowledge_external_references where knowledge_fact_id = $1`,
          [factA],
        );
        assert.equal(rows.rows[0]!.n, 2, "and both the ended declaration and the new one exist");
      }

      /* ── 16. NOTHING ELSE MOVED ──────────────────────────────────────────── */
      assert.equal(
        await nodeFingerprint(),
        nodesAfterSetup,
        "no knowledge node changed across attach, duplicate, withdraw and re-attach",
      );
      {
        const integrations = await probe.query(`select count(*)::int as n from integrations`);
        assert.equal(integrations.rows[0]!.n, 0, "no integration row was created or touched");
        const decisions = await probe.query(`select count(*)::int as n from decision_records`);
        assert.equal(decisions.rows[0]!.n, 0, "no Governance decision was recorded");
        const permits = await probe.query(`select count(*)::int as n from action_permits`);
        assert.equal(permits.rows[0]!.n, 0, "no permit was minted");
      }

      console.log("kr-ext1-flow/external-reference-postgres: OK");
    } finally {
      await probe.end();
      await handle.dispose();
    }
  } finally {
    await harness.dropDatabase();
  }
}

void main();
