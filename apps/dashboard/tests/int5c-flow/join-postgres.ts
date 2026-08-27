/*
 * INT-5C — THE CROSS-SOURCE JOIN, proved against a REAL PostgreSQL database.
 *
 * ── WHY THIS MUST BE A DATABASE TEST ─────────────────────────────────────────
 *
 * The claim INT-5C makes to an operator is *"nobody in your organization has recorded a Knowledge
 * relationship for this repository."* That is an organizational ABSENCE claim, and the only thing
 * that licenses it is a query that actually ran, over exactly those record ids, under this tenant's
 * predicate, against the real index KR-EXT1 authored for this direction.
 *
 * A fake would prove that a fake agrees with the caller. The tenant isolation in particular is a
 * property of the SQL and of the composite foreign key — two organizations may declare against the
 * same GitHub repository id, and neither may see the other's declaration. That cannot be observed
 * by reading source.
 *
 * Uses a disposable local database, dropped on exit. No production data is touched, and NO PROVIDER
 * IS CONTACTED — this file exercises the Knowledge half alone, which is exactly the half that can
 * make a false absence claim.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createDurableKnowledgeWriter } from "../../src/features/knowledge/durable-knowledge-writer.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import {
  attachExternalReference,
  withdrawExternalReference,
} from "../../src/features/knowledge/external-reference-authority.server";
import {
  MAX_EXTERNAL_RECORD_LOOKUP,
  findKnowledgeFactForExternalRecord,
  findKnowledgeRelationshipsForExternalRecords,
} from "../../src/features/knowledge/external-reference-read.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
const TENANT_A = "10000000-0000-4000-8000-00000000ca01";
const TENANT_B = "10000000-0000-4000-8000-00000000cb01";
const USER_A = "20000000-0000-4000-8000-00000000ca01";
const USER_B = "20000000-0000-4000-8000-00000000cb01";
const NOW = new Date("2026-08-26T09:00:00.000Z");

/** The provider half of the tuple, exactly as INT-5B1 composes its evidence identity. */
const GITHUB = Object.freeze({
  providerKey: "github-organization",
  capability: "github.repository.activity.read",
  recordType: "repository",
});

/** The repository INT-5B1 actually read in production. Expected evidence, never acceptance logic. */
const REAL_REPOSITORY_ID = "1300480452";
const OTHER_REPOSITORY_ID = "999000111";

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
    requestId: "int-5c",
    authenticatedAt: NOW.toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_int5c_join");
  await harness.createDatabase();

  try {
    harness.migrateDatabase();

    const seed = new Client({ connectionString: harness.dbUrl });
    await seed.connect();
    try {
      await seed.query(
        `insert into companies (id, name, slug)
         values ($1, 'Tenant A', 'int-5c-a'), ($2, 'Tenant B', 'int-5c-b')`,
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
      const createDeps = { resolveAuthority: authorized, getWriter: () => writer, now: () => NOW };
      const refDeps = { getDb: () => handle.db, resolveAuthority: authorized };
      const readDeps = { getDb: () => handle.db };
      const A = tenantContext(TENANT_A, USER_A);
      const B = tenantContext(TENANT_B, USER_B);

      const factOf = async (tenant: TenantContext, key: string): Promise<string> => {
        const created = await createKnowledgeFact(
          tenant,
          {
            factKey: key,
            domainKey: "engineering",
            scope: "company-wide",
            title: key,
            statement: `About ${key}.`,
          },
          createDeps,
        );
        assert.equal(created.status, "created", `${key} was created`);
        if (created.status !== "created") throw new Error("unreachable");
        return created.identity.factId;
      };

      const factA = await factOf(A, "hebun-platform");
      const factB = await factOf(B, "other-org-system");

      /* ── 1. NOTHING DECLARED YET: A RESOLVED ANSWER WITH NO DECLARATIONS ──── */
      {
        const before = await findKnowledgeRelationshipsForExternalRecords(
          A,
          GITHUB,
          [REAL_REPOSITORY_ID, OTHER_REPOSITORY_ID],
          readDeps,
        );
        assert.equal(before.status, "resolved", "the query ran, so absence is a real absence");
        if (before.status !== "resolved") return;
        assert.deepEqual(before.declarations, [], "and nothing has been declared yet");
        assert.deepEqual(
          [...before.queried].sort(),
          [OTHER_REPOSITORY_ID, REAL_REPOSITORY_ID].sort(),
          "the answer reports exactly which ids it asked about, so no caller can claim beyond them",
        );
      }

      /* ── 2. AN AUTHORIZED HUMAN DECLARES, AND THE JOIN FINDS IT EXACTLY ──── */
      const declared = await attachExternalReference(
        A,
        { knowledgeFactId: factA, reference: { ...GITHUB, recordId: REAL_REPOSITORY_ID } },
        refDeps,
      );
      assert.equal(declared.status, "declared", "an authorized human may declare the association");

      {
        const found = await findKnowledgeRelationshipsForExternalRecords(
          A,
          GITHUB,
          [REAL_REPOSITORY_ID, OTHER_REPOSITORY_ID],
          readDeps,
        );
        assert.equal(found.status, "resolved");
        if (found.status !== "resolved") return;
        assert.equal(found.declarations.length, 1, "exactly one repository has a declaration");
        const one = found.declarations[0]!;
        assert.equal(one.recordId, REAL_REPOSITORY_ID);
        assert.equal(one.knowledgeFactId, factA);
        assert.equal(one.factKey, "hebun-platform", "the fact's own key comes back, not a uuid alone");
        assert.equal(one.domainKey, "engineering");
        assert.equal(one.hasActiveKnowledgeNode, true, "the fact points at an active Knowledge node");

        /*
         * THE OTHER REPOSITORY IS ABSENT FROM THE RESULT, NOT PRESENT-AND-EMPTY. A caller renders
         * NO_DECLARATION_RECORDED for it, and it may do so because the status is `resolved`.
         */
        assert.ok(
          !found.declarations.some((d) => d.recordId === OTHER_REPOSITORY_ID),
          "the undeclared repository has no row, and the caller may say so",
        );
      }

      /* ── 3. TENANT ISOLATION: THE SAME REPOSITORY, TWO ORGANIZATIONS ─────── */
      {
        /*
         * THE CASE THIS TABLE'S COMPOSITE KEY EXISTS FOR. Tenant B declares against the SAME GitHub
         * repository id. Neither organization may see the other's declaration — the tenant equality
         * is part of the same `and(...)` as the record identity, not a filter applied afterwards.
         */
        const declaredB = await attachExternalReference(
          B,
          { knowledgeFactId: factB, reference: { ...GITHUB, recordId: REAL_REPOSITORY_ID } },
          refDeps,
        );
        assert.equal(declaredB.status, "declared", "two organizations may reference the same record");

        const fromA = await findKnowledgeRelationshipsForExternalRecords(
          A,
          GITHUB,
          [REAL_REPOSITORY_ID],
          readDeps,
        );
        const fromB = await findKnowledgeRelationshipsForExternalRecords(
          B,
          GITHUB,
          [REAL_REPOSITORY_ID],
          readDeps,
        );
        assert.equal(fromA.status, "resolved");
        assert.equal(fromB.status, "resolved");
        if (fromA.status !== "resolved" || fromB.status !== "resolved") return;

        assert.equal(fromA.declarations.length, 1, "A sees exactly one declaration");
        assert.equal(fromB.declarations.length, 1, "B sees exactly one declaration");
        assert.equal(fromA.declarations[0]!.knowledgeFactId, factA, "and A sees only its own");
        assert.equal(fromB.declarations[0]!.knowledgeFactId, factB, "and B sees only its own");
        assert.notEqual(
          fromA.declarations[0]!.knowledgeFactId,
          fromB.declarations[0]!.knowledgeFactId,
          "the two organizations' declarations never mix",
        );
        assert.equal(fromA.declarations[0]!.factKey, "hebun-platform");
        assert.equal(fromB.declarations[0]!.factKey, "other-org-system");
      }

      /* ── 4. A CROSS-TENANT JOIN IS UNREPRESENTABLE ───────────────────────── */
      {
        /*
         * There is no argument through which a caller could name another organization: the tenant
         * arrives as a resolved server context and the reference carries only provider-owned
         * identity. The nearest thing to an attack is passing NO tenant, which REFUSES rather than
         * returning everybody's declarations.
         */
        const noTenant = await findKnowledgeRelationshipsForExternalRecords(
          null,
          GITHUB,
          [REAL_REPOSITORY_ID],
          readDeps,
        );
        assert.equal(noTenant.status, "unavailable", "no tenant is a refusal, never a global read");
        if (noTenant.status !== "unavailable") return;
        assert.equal(noTenant.reason, "no-tenant");
      }

      /* ── 5. WITHDRAWAL REMOVES THE DECLARATION FROM THE JOIN ─────────────── */
      {
        const live = await findKnowledgeFactForExternalRecord(
          A,
          { ...GITHUB, recordId: REAL_REPOSITORY_ID },
          readDeps,
        );
        assert.equal(live, factA, "the released single-record seam still answers, from its new home");

        const rows = await probe.query(
          `select id from knowledge_external_references
            where tenant_id = $1 and record_id = $2 and withdrawn_at is null`,
          [TENANT_A, REAL_REPOSITORY_ID],
        );
        assert.equal(rows.rows.length, 1);
        const withdrawn = await withdrawExternalReference(
          A,
          { referenceId: String(rows.rows[0]!.id) },
          refDeps,
        );
        assert.equal(withdrawn.status, "withdrawn");

        const after = await findKnowledgeRelationshipsForExternalRecords(
          A,
          GITHUB,
          [REAL_REPOSITORY_ID],
          readDeps,
        );
        assert.equal(after.status, "resolved");
        if (after.status !== "resolved") return;
        assert.deepEqual(
          after.declarations,
          [],
          "a withdrawn declaration is gone from the join — the read honours `withdrawn_at is null`",
        );

        /* B's declaration against the same record is untouched by A's withdrawal. */
        const stillB = await findKnowledgeRelationshipsForExternalRecords(
          B,
          GITHUB,
          [REAL_REPOSITORY_ID],
          readDeps,
        );
        assert.equal(stillB.status, "resolved");
        if (stillB.status !== "resolved") return;
        assert.equal(stillB.declarations.length, 1, "the other organization is unaffected");
      }

      /* ── 6. IDENTITY IS THE NUMERIC ID — A RENAME DOES NOT MOVE IT ───────── */
      {
        /*
         * A repository's full name changes on a rename and again on a transfer. The declaration is
         * recorded against GitHub's immutable numeric id, so a rename is INVISIBLE here: there is no
         * name in the tuple to go stale, and the join keeps finding the same fact.
         */
        const reDeclared = await attachExternalReference(
          A,
          { knowledgeFactId: factA, reference: { ...GITHUB, recordId: REAL_REPOSITORY_ID } },
          refDeps,
        );
        assert.equal(reDeclared.status, "declared", "a withdrawn association may be declared again");

        const stored = await probe.query(
          `select record_id, provider_key, capability, record_type
             from knowledge_external_references
            where tenant_id = $1 and withdrawn_at is null`,
          [TENANT_A],
        );
        assert.equal(stored.rows.length, 1);
        const row = stored.rows[0]!;
        assert.equal(String(row.record_id), REAL_REPOSITORY_ID, "identity is the numeric id");
        assert.ok(
          !JSON.stringify(row).includes("/"),
          "no owner/name pair is stored anywhere in the identity — a rename cannot break it",
        );
        assert.equal(String(row.record_type), "repository");
      }

      /* ── 7. THE BATCH IS ONE QUERY, AND ITS CEILING REFUSES RATHER THAN CUTS ─ */
      {
        const many = Array.from({ length: MAX_EXTERNAL_RECORD_LOOKUP + 1 }, (_, i) => `id-${i}`);
        const refused = await findKnowledgeRelationshipsForExternalRecords(A, GITHUB, many, readDeps);
        assert.equal(refused.status, "unavailable", "too many ids REFUSES");
        if (refused.status !== "unavailable") return;
        assert.equal(
          refused.reason,
          "too-many-records",
          "and says so — truncating would turn 'we did not ask' into 'no declaration exists'",
        );

        /* Exactly at the ceiling it runs, and the real declaration is still found among them. */
        const atCeiling = [
          REAL_REPOSITORY_ID,
          ...Array.from({ length: MAX_EXTERNAL_RECORD_LOOKUP - 1 }, (_, i) => `filler-${i}`),
        ];
        const ok = await findKnowledgeRelationshipsForExternalRecords(A, GITHUB, atCeiling, readDeps);
        assert.equal(ok.status, "resolved", "a full page is answered in one query");
        if (ok.status !== "resolved") return;
        assert.equal(ok.declarations.length, 1);
        assert.equal(ok.declarations[0]!.recordId, REAL_REPOSITORY_ID);
        assert.equal(ok.queried.length, MAX_EXTERNAL_RECORD_LOOKUP);
      }

      /* ── 8. A DIFFERENT CAPABILITY IS A DIFFERENT RECORD ─────────────────── */
      {
        /*
         * The tuple is four values, not one. A declaration recorded against the repository-activity
         * capability must not answer a question about some other capability's record of the same id.
         */
        const otherCapability = await findKnowledgeRelationshipsForExternalRecords(
          A,
          { ...GITHUB, capability: "github.pull_request.read" },
          [REAL_REPOSITORY_ID],
          readDeps,
        );
        assert.equal(otherCapability.status, "resolved");
        if (otherCapability.status !== "resolved") return;
        assert.deepEqual(
          otherCapability.declarations,
          [],
          "the capability is part of the identity — a declaration does not leak across capabilities",
        );

        const otherProvider = await findKnowledgeRelationshipsForExternalRecords(
          A,
          { ...GITHUB, providerKey: "google-workspace" },
          [REAL_REPOSITORY_ID],
          readDeps,
        );
        assert.equal(otherProvider.status, "resolved");
        if (otherProvider.status !== "resolved") return;
        assert.deepEqual(otherProvider.declarations, [], "and not across providers either");
      }

      /* ── 9. THE READ MUTATED NOTHING ─────────────────────────────────────── */
      {
        /*
         * Counted rather than asserted. Every lookup above is a `select`; if one of them wrote, the
         * declaration count or the Knowledge node count would have moved.
         */
        const refs = await probe.query(`select count(*)::int as n from knowledge_external_references`);
        const nodes = await probe.query(`select count(*)::int as n from knowledge_nodes`);
        const facts = await probe.query(`select count(*)::int as n from knowledge_facts`);

        for (let i = 0; i < 3; i += 1) {
          await findKnowledgeRelationshipsForExternalRecords(
            A,
            GITHUB,
            [REAL_REPOSITORY_ID, OTHER_REPOSITORY_ID],
            readDeps,
          );
        }

        const refsAfter = await probe.query(`select count(*)::int as n from knowledge_external_references`);
        const nodesAfter = await probe.query(`select count(*)::int as n from knowledge_nodes`);
        const factsAfter = await probe.query(`select count(*)::int as n from knowledge_facts`);

        assert.equal(refsAfter.rows[0]!.n, refs.rows[0]!.n, "reading declarations creates none");
        assert.equal(nodesAfter.rows[0]!.n, nodes.rows[0]!.n, "and writes no Knowledge node");
        assert.equal(factsAfter.rows[0]!.n, facts.rows[0]!.n, "and writes no Knowledge fact");
      }

      /* ── 10. A FAILED QUERY IS NOT AN ABSENCE ────────────────────────────── */
      {
        /*
         * THE DISTINCTION THIS WHOLE PHASE TURNS ON. The seam it replaced swallowed its error into
         * `null`, which a renderer would print as "no declaration recorded". Here a database that
         * throws produces `unavailable`, and the caller is structurally unable to claim absence.
         */
        const broken = {
          getDb: () =>
            ({
              select: () => {
                throw new Error("the database did not answer");
              },
            }) as never,
        };
        const failed = await findKnowledgeRelationshipsForExternalRecords(
          A,
          GITHUB,
          [REAL_REPOSITORY_ID],
          broken,
        );
        assert.equal(failed.status, "unavailable", "a failed query is UNAVAILABLE, never empty");
        if (failed.status !== "unavailable") return;
        assert.equal(failed.reason, "query-failed");

        const noDb = await findKnowledgeRelationshipsForExternalRecords(A, GITHUB, [REAL_REPOSITORY_ID], {
          getDb: () => null,
        });
        assert.equal(noDb.status, "unavailable");
        if (noDb.status !== "unavailable") return;
        assert.equal(noDb.reason, "no-database");
      }
    } finally {
      await probe.end();
      await handle.dispose();
    }
  } finally {
    await harness.dropDatabase();
  }

  console.log("int5c-flow/join-postgres: OK");
}

void main();
