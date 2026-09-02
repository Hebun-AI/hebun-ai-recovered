/*
 * WEV-1 — A WORK ITEM DECLARES WHAT IT CONCERNS, AND OWNS NOTHING ELSE.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A human declares that one work item concerns one referent. The relationship is Organizational
 *    Work's; the referent's title, lifecycle, ratification and authority class stay the referent
 *    authority's and are stored nowhere in Work. A cross-tenant reference and a non-human declarer
 *    are UNREPRESENTABLE — PostgreSQL refuses them. A second identical current declaration is
 *    refused. Withdrawal means only that work no longer declares it: the row stays, the audit keeps
 *    both acts, the referent is untouched, and a later re-declaration is a NEW row. Both directions
 *    are served by the one Work-owned table."
 *
 * The pins:
 *
 *   WORK REFERENCES X   != WORK OWNS X
 *   REFERENCE EXISTS    != REFERENT IS CURRENT != REFERENT IS AUTHORITATIVE
 *   DECLARED BY A HUMAN != INFERRED BY HEBUN
 *   WITHDRAWN           != DELETED != INVALID
 *
 * Every row is produced by the released writer that owns it. No adapter, no network, no model.
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { recordDepartment } from "../../src/features/organization-authority/write-structure.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import { createWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import {
  declareWorkEvidenceReference,
  recordWork,
  retireWork,
  withdrawWorkEvidenceReference,
} from "../../src/features/organizational-work/write-work.server";
import { readWorkEvidenceReferences } from "../../src/features/organizational-work/read-work-evidence.server";
import { readWorkGroundingSource } from "../../src/features/organizational-work/heby-work-source.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-09-02T18:00:00.000Z");
const GENESIS = "I am establishing this organization's Governance authority so work can be recorded.";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded, sessionContextId: string, requestId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId,
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId,
    authenticatedAt: NOW.toISOString(),
  });
}

async function sessionRowFor(client: Client, seeded: Seeded, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
             now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [
      seeded.authIdentityId,
      tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a"),
      seeded.userId,
      seeded.tenantId,
      seeded.membershipId,
    ],
  );
  return row.rows[0]!.id;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_wev1_evidence");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);

  const deps = { getDb: () => handle.db } as never;
  const writeDeps = { getDb: () => handle.db, now: () => NOW } as never;

  const countOf = async (sql: string, params: unknown[] = []): Promise<number> =>
    (await setup.query<{ n: number }>(sql, params)).rows[0]!.n;

  try {
    /* ═══════════════════════════════════════════════════════════════════════
     * 0. TWO ORGANIZATIONS, EACH WITH ONE WORK ITEM AND ONE OF EACH REFERENT.
     * ═════════════════════════════════════════════════════════════════════ */
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-wev1",
      email: "director@acme-wev1.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-wev1",
      email: "director@globex-wev1.test",
    })) as Seeded;
    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "wev1-acme");
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "bbbb"), "wev1-globex");

    for (const [seeded, ctx] of [
      [acme, acmeCtx],
      [globex, globexCtx],
    ] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
      );
      const genesis = await establishGovernanceAuthority(ctx, { justification: GENESIS }, deps);
      assert.equal(genesis.status, "established");
    }

    const dept = await recordDepartment(acmeCtx, { name: "Engineering", slug: "engineering" }, deps);
    assert.equal(dept.status, "recorded");

    const work = await recordWork(acmeCtx, { title: "Q3 supplier audit" }, deps);
    assert.equal(work.status, "recorded");
    const workItemId = work.status === "recorded" ? work.workItem.workItemId : "";

    const otherWork = await recordWork(acmeCtx, { title: "Warehouse safety review" }, deps);
    assert.equal(otherWork.status, "recorded");

    const globexWork = await recordWork(globexCtx, { title: "Legal retainer review" }, deps);
    assert.equal(globexWork.status, "recorded");
    const globexWorkItemId = globexWork.status === "recorded" ? globexWork.workItem.workItemId : "";

    const fact = await createKnowledgeFact(
      acmeCtx,
      {
        factKey: "supplier-policy",
        domainKey: "operations",
        scope: "company-wide",
        title: "Supplier policy",
        statement: "Suppliers are reviewed every quarter.",
      },
      deps,
    );
    assert.equal(fact.status, "created");
    const factId = fact.status === "created" ? fact.identity.factId : "";

    const globexFact = await createKnowledgeFact(
      globexCtx,
      {
        factKey: "retainer-policy",
        domainKey: "operations",
        scope: "company-wide",
        title: "Retainer policy",
        statement: "Counsel is retained annually.",
      },
      deps,
    );
    assert.equal(globexFact.status, "created");
    const globexFactId = globexFact.status === "created" ? globexFact.identity.factId : "";

    const artifact = await createWorkArtifact(
      acmeCtx,
      { artifactType: "operational-plan", title: "Audit plan", content: "Step one." },
      "operations",
      writeDeps,
    );
    assert.equal(artifact.status, "created");
    const artifactId = artifact.status === "created" ? artifact.artifactId : "";

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. A HUMAN DECLARES WHAT THE WORK CONCERNS. TWO KINDS, ONE TABLE.
     * ═════════════════════════════════════════════════════════════════════ */
    assert.equal(await countOf(`select count(*)::int as n from work_evidence_references`), 0);

    const declaredFact = await declareWorkEvidenceReference(
      acmeCtx,
      { workItemId, referent: { kind: "knowledge-fact", referentId: factId } },
      writeDeps,
    );
    assert.equal(declaredFact.status, "recorded", "the knowledge fact was declared");

    const declaredArtifact = await declareWorkEvidenceReference(
      acmeCtx,
      { workItemId, referent: { kind: "work-artifact", referentId: artifactId } },
      writeDeps,
    );
    assert.equal(declaredArtifact.status, "recorded", "and so was the document");

    const rows = await setup.query<{
      id: string;
      tenantId: string;
      workItemId: string;
      knowledgeFactId: string | null;
      workArtifactId: string | null;
      declaredBy: string;
      declaredByType: string;
      withdrawnAt: Date | null;
    }>(
      `select id, tenant_id as "tenantId", work_item_id as "workItemId",
              knowledge_fact_id as "knowledgeFactId", work_artifact_id as "workArtifactId",
              declared_by as "declaredBy", declared_by_type as "declaredByType",
              withdrawn_at as "withdrawnAt"
         from work_evidence_references order by declared_at`,
    );
    assert.equal(rows.rows.length, 2, "exactly two declarations");
    for (const row of rows.rows) {
      assert.equal(row.tenantId, acme.tenantId, "in the declaring organization, and only there");
      assert.equal(row.workItemId, workItemId);
      assert.equal(row.declaredBy, acme.userId);
      assert.equal(row.declaredByType, "human", "DECLARED BY A HUMAN, and the CHECK says so");
      assert.equal(row.withdrawnAt, null);
      /* EXACTLY ONE REFERENT per row — the kind has nowhere to disagree with the referent. */
      const named = [row.knowledgeFactId, row.workArtifactId].filter((v) => v !== null);
      assert.equal(named.length, 1, "exactly one referent column is populated");
    }

    /* NOTHING ABOUT THE REFERENT IS COPIED INTO WORK. */
    const columns = (
      await setup.query<{ column_name: string }>(
        `select column_name from information_schema.columns where table_name = 'work_evidence_references'`,
      )
    ).rows.map((r) => r.column_name);
    for (const forbidden of [
      "title", "label", "statement", "authority_class", "knowledge_authority", "ratified",
      "freshness", "revision", "current_revision", "provider_key", "capability", "record_id",
      "reference_kind", "reference_key", "relation", "rank", "score", "confidence",
    ]) {
      assert.ok(
        !columns.includes(forbidden),
        `Work stores no ${forbidden} — the referent's authority owns it`,
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. THE SAME DECLARATION TWICE IS REFUSED, AND WRITES NOTHING.
     * ═════════════════════════════════════════════════════════════════════ */
    const duplicate = await declareWorkEvidenceReference(
      acmeCtx,
      { workItemId, referent: { kind: "knowledge-fact", referentId: factId } },
      writeDeps,
    );
    assert.equal(duplicate.status, "refused");
    assert.equal(duplicate.status === "refused" ? duplicate.reason : "", "reference-already-declared");
    assert.equal(await countOf(`select count(*)::int as n from work_evidence_references`), 2);

    /* AND THE DATABASE IS THE GUARANTEE, not the pre-check. Proved by attempting it directly. */
    await assert.rejects(
      setup.query(
        `insert into work_evidence_references
           (tenant_id, work_item_id, knowledge_fact_id, declared_by, declared_by_type)
         values ($1,$2,$3,$4,'human')`,
        [acme.tenantId, workItemId, factId, acme.userId],
      ),
      /work_evidence_references_current_fact_uidx/,
      "a second CURRENT declaration of the same referent is refused by PostgreSQL",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. THE UNREPRESENTABLE ONES. PostgreSQL refuses; no application code is involved.
     * ═════════════════════════════════════════════════════════════════════ */
    await assert.rejects(
      setup.query(
        `insert into work_evidence_references
           (tenant_id, work_item_id, knowledge_fact_id, declared_by, declared_by_type)
         values ($1,$2,$3,$4,'human')`,
        [acme.tenantId, workItemId, globexFactId, acme.userId],
      ),
      /work_evidence_references_tenant_fact_fk/,
      "ANOTHER ORGANIZATION'S knowledge fact cannot be referenced — the composite FK refuses it",
    );

    await assert.rejects(
      setup.query(
        `insert into work_evidence_references
           (tenant_id, work_item_id, knowledge_fact_id, declared_by, declared_by_type)
         values ($1,$2,$3,$4,'human')`,
        [acme.tenantId, globexWorkItemId, factId, acme.userId],
      ),
      /work_evidence_references_tenant_work_fk/,
      "and another organization's WORK cannot do the declaring",
    );

    await assert.rejects(
      setup.query(
        `insert into work_evidence_references
           (tenant_id, work_item_id, knowledge_fact_id, declared_by, declared_by_type)
         values ($1,$2,$3,$4,'agent')`,
        [acme.tenantId, workItemId, factId, acme.userId],
      ),
      /work_evidence_references_human_declarer_chk/,
      "AN AGENT CANNOT DECLARE ONE — Hebun does not infer what work is about",
    );

    await assert.rejects(
      setup.query(
        `insert into work_evidence_references
           (tenant_id, work_item_id, declared_by, declared_by_type)
         values ($1,$2,$3,'human')`,
        [acme.tenantId, workItemId, acme.userId],
      ),
      /work_evidence_references_one_referent_chk/,
      "a declaration about NOTHING is unrepresentable",
    );

    await assert.rejects(
      setup.query(
        `insert into work_evidence_references
           (tenant_id, work_item_id, knowledge_fact_id, work_artifact_id, declared_by, declared_by_type)
         values ($1,$2,$3,$4,$5,'human')`,
        [acme.tenantId, workItemId, factId, artifactId, acme.userId],
      ),
      /work_evidence_references_one_referent_chk/,
      "and so is a declaration about TWO things pretending to be one",
    );

    /* A referent that does not exist at all is refused by the writer, truthfully. */
    const absent = await declareWorkEvidenceReference(
      acmeCtx,
      {
        workItemId,
        referent: { kind: "knowledge-fact", referentId: "11111111-2222-3333-4444-555555555555" },
      },
      writeDeps,
    );
    assert.equal(absent.status, "refused");
    assert.equal(absent.status === "refused" ? absent.reason : "", "referent-unresolved");

    /* A FOREIGN organization's referent is NOT FOUND — never refused in a way that confirms it. */
    const foreign = await declareWorkEvidenceReference(
      acmeCtx,
      { workItemId, referent: { kind: "knowledge-fact", referentId: globexFactId } },
      writeDeps,
    );
    assert.equal(foreign.status, "refused");
    assert.equal(
      foreign.status === "refused" ? foreign.reason : "",
      "referent-unresolved",
      "identical to an absent one — the difference does not leak",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. BOTH DIRECTIONS, FROM THE ONE WORK-OWNED TABLE.
     * ═════════════════════════════════════════════════════════════════════ */
    const read = await readWorkEvidenceReferences(acmeCtx, deps);
    assert.equal(read.status, "available");
    if (read.status !== "available") throw new Error("unreachable");
    assert.equal(read.references.length, 2);

    /* WORK → REFERENTS */
    const forWork = read.references.filter((r) => r.workItemId === workItemId);
    assert.equal(forWork.length, 2, "what is this work about");
    /* REFERENT → WORK */
    const forFact = read.references.filter((r) => r.referentId === factId);
    assert.equal(forFact.length, 1, "what work concerns this");
    assert.equal(forFact[0]!.workItemId, workItemId);

    /* THE STANDING COMES FROM THE REFERENT'S OWN AUTHORITY, and says provisional, not ratified. */
    const factView = forFact[0]!;
    assert.equal(factView.kind, "knowledge-fact", "the kind is DERIVED from the populated column");
    assert.ok(factView.referent, "Knowledge answered for its own record");
    assert.match(factView.referent!.label, /supplier-policy — Supplier policy/);
    assert.match(
      factView.referent!.standing,
      /provisional \(NOT settled truth\)/,
      "RATIFIED != AUTHORITATIVE — an unratified fact is not promoted by being referenced",
    );
    assert.match(factView.referent!.standing, /no ratification recorded/);

    const artifactView = read.references.find((r) => r.referentId === artifactId)!;
    assert.equal(artifactView.kind, "work-artifact");
    assert.equal(artifactView.referent!.label, "Audit plan");
    assert.match(artifactView.referent!.standing, /current revision 1/);

    /* GLOBEX SEES NOTHING OF ACME'S. Not filtered — its predicate cannot reach them. */
    const globexRead = await readWorkEvidenceReferences(globexCtx, deps);
    assert.equal(globexRead.status, "available");
    if (globexRead.status !== "available") throw new Error("unreachable");
    assert.equal(globexRead.references.length, 0);

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. HEBY GROUNDS ON THE DECLARATION, AND SAYS IT WAS DECLARED.
     * ═════════════════════════════════════════════════════════════════════ */
    const grounding = await readWorkGroundingSource(acmeCtx, deps);
    assert.equal(grounding.state, "resolved");
    const item = grounding.items.find((i) => i.recordRef === `work-item/${workItemId}`)!;
    assert.ok(item, "the work item is grounded");
    assert.match(item.detail, /A person declared that this work concerns/, "declared, not inferred");
    assert.match(item.detail, /Supplier policy/, "and it names what it concerns");
    assert.match(item.detail, /Audit plan/);
    assert.match(item.detail, /Hebun inferred none of these relationships/);
    assert.match(
      item.detail,
      /says nothing about whether what it names is current, ratified or authoritative/,
      "the relationship never becomes a claim about the referent",
    );
    const bare = grounding.items.find(
      (i) => i.recordRef !== `work-item/${workItemId}` && i.label === "Warehouse safety review",
    )!;
    assert.match(bare.detail, /Nobody has declared what this work concerns/);

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. WITHDRAWAL: NOT DELETION, NOT INVALIDATION, AND RE-DECLARABLE.
     * ═════════════════════════════════════════════════════════════════════ */
    const withdrawn = await withdrawWorkEvidenceReference(
      acmeCtx,
      { referenceId: factView.referenceId },
      writeDeps,
    );
    assert.equal(withdrawn.status, "recorded");

    assert.equal(
      await countOf(`select count(*)::int as n from work_evidence_references`),
      2,
      "WITHDRAWN != DELETED — the row is still there",
    );
    const after = (
      await setup.query<{ withdrawnBy: string; withdrawnByType: string; declaredBy: string }>(
        `select withdrawn_by as "withdrawnBy", withdrawn_by_type as "withdrawnByType",
                declared_by as "declaredBy"
           from work_evidence_references where id = $1`,
        [factView.referenceId],
      )
    ).rows[0]!;
    assert.equal(after.withdrawnBy, acme.userId, "who withdrew it is kept");
    assert.equal(after.withdrawnByType, "human");
    assert.equal(after.declaredBy, acme.userId, "and who declared it is not erased");

    /* THE REFERENT IS UNTOUCHED. */
    const factStill = await countOf(
      `select count(*)::int as n from knowledge_facts where id = $1 and tenant_id = $2`,
      [factId, acme.tenantId],
    );
    assert.equal(factStill, 1, "the knowledge fact is neither deleted nor invalidated");

    /* IT IS NO LONGER CURRENT, so the read stops returning it. */
    const afterRead = await readWorkEvidenceReferences(acmeCtx, deps);
    assert.equal(afterRead.status, "available");
    if (afterRead.status !== "available") throw new Error("unreachable");
    assert.equal(afterRead.references.length, 1, "one current declaration remains");
    assert.equal(afterRead.references[0]!.referentId, artifactId);

    /* WITHDRAWING TWICE IS NOT A SECOND WITHDRAWAL. */
    const again = await withdrawWorkEvidenceReference(
      acmeCtx,
      { referenceId: factView.referenceId },
      writeDeps,
    );
    assert.equal(again.status, "refused");
    assert.equal(again.status === "refused" ? again.reason : "", "reference-unresolved");

    /* RE-DECLARING IS A NEW ROW, not a resurrection — history is not edited. */
    const redeclared = await declareWorkEvidenceReference(
      acmeCtx,
      { workItemId, referent: { kind: "knowledge-fact", referentId: factId } },
      writeDeps,
    );
    assert.equal(redeclared.status, "recorded");
    assert.equal(
      await countOf(`select count(*)::int as n from work_evidence_references`),
      3,
      "three rows: the withdrawn declaration, the artifact, and the new declaration",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. THE AUDIT KEEPS BOTH ACTS, AND THE ACTOR IS THE HUMAN.
     * ═════════════════════════════════════════════════════════════════════ */
    const audit = (
      await setup.query<{ action: string; actorType: string; actorId: string }>(
        `select action, actor_type as "actorType", actor_id as "actorId"
           from audit_log where entity_type = 'work_item' and action like 'work.reference-%'
          order by occurred_at`,
      )
    ).rows;
    assert.deepEqual(
      audit.map((a) => a.action),
      [
        "work.reference-declared",
        "work.reference-declared",
        "work.reference-withdrawn",
        "work.reference-declared",
      ],
      "every declaration and the withdrawal are in the ledger, in order",
    );
    for (const event of audit) {
      assert.equal(event.actorType, "human", "a person did this — not the system, not an agent");
      assert.equal(event.actorId, acme.userId);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. RETIRED WORK DECLARES NOTHING FURTHER.
     * ═════════════════════════════════════════════════════════════════════ */
    const retiredWork = await recordWork(acmeCtx, { title: "Closed initiative" }, deps);
    assert.equal(retiredWork.status, "recorded");
    const retiredId = retiredWork.status === "recorded" ? retiredWork.workItem.workItemId : "";
    assert.equal((await retireWork(acmeCtx, { workItemId: retiredId }, deps)).status, "recorded");

    const onRetired = await declareWorkEvidenceReference(
      acmeCtx,
      { workItemId: retiredId, referent: { kind: "work-artifact", referentId: artifactId } },
      writeDeps,
    );
    assert.equal(onRetired.status, "refused");
    assert.equal(onRetired.status === "refused" ? onRetired.reason : "", "work-retired");

    console.log("wev1-work-evidence/evidence-postgres: OK");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
