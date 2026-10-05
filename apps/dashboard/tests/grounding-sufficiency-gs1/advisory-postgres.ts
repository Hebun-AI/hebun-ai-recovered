/*
 * GROUNDING SUFFICIENCY GS-1 — the advisory grounding check on the reviewer's revision-evidence read,
 * against a DISPOSABLE database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "The reviewer's read derives the check from THIS revision's stored copy and the evidence stored
 *    with the message that generated it — never a fresh search, never today's Knowledge. One
 *    unsupported sentence makes the revision insufficient; bounded-universe and matched evidence
 *    support nothing by themselves; missing or unreadable evidence is never support. Reading writes
 *    nothing and changes no review, readiness, Governance or Knowledge state, and reaches no network."
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import { supersedeKnowledgeFact } from "../../src/features/knowledge/knowledge-supersede.server";
import { listKnowledgeSources, searchKnowledge } from "../../src/features/knowledge/knowledge-read.server";
import { createDurableKnowledgeWriter } from "../../src/features/knowledge/durable-knowledge-writer.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import { toStoredEvidence } from "../../src/features/heby-conversation/answer-evidence";
import { buildBoundedUniverseEvidence, buildRetrievalEvidence, type RetrievalEvidenceSet } from "../../src/features/knowledge-retrieval";
import { readRevisionGenerationEvidence } from "../../src/features/heby-answer/revision-generation-evidence.server";
import { GROUNDING_CHECK_VERDICT } from "../../src/features/heby-answer/revision-generation-evidence";
import { CONTENT_PACKAGE_BLOCKERS } from "../../src/features/content-composition/contracts";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { KnowledgeSourceRecord } from "../../src/features/knowledge/contracts";

const NOW = new Date("2026-10-05T09:00:00.000Z");
const ROOT = path.resolve(__dirname, "../..");
const code = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* 16 · no network anywhere in this file. */
globalThis.fetch = (() => {
  throw new Error("GS-1 must not reach the network");
}) as typeof fetch;

const A = "Zanzibar sells handmade rugs and kilims.";
const B = "Zanzibar sells kilims.";

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_gs1_advisory");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  try {
    harness.migrateDatabase();
    await setup.connect();
    const writer = createDurableKnowledgeWriter(handle.db);
    const knowledgeRepo = createDurableKnowledgeRepository(handle.db);
    const conversations = createDurableConversationRepository(handle.db);
    const knowledgeDeps = {
      resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
      getWriter: () => writer,
      getRepo: () => knowledgeRepo,
      getRepository: () => knowledgeRepo,
      now: () => NOW,
    } as never;
    const readDeps = { getDb: () => handle.db, getConversationRepo: () => conversations };

    const seeded = await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-gs1", email: "alice@gs1.test" });
    const ctx = asHumanTenantContext({
      tenantId: seeded.tenantId, userId: seeded.userId, authIdentityId: seeded.authIdentityId, membershipId: seeded.membershipId,
      membershipVersion: 1, roleId: seeded.roleId, sessionContextId: randomUUID(), provider: "local", assuranceLevel: "aal1",
      mfaVerified: false, requestId: "gs1", authenticatedAt: NOW.toISOString(),
    });

    /* Knowledge version A — what generation will be given. */
    const created = await createKnowledgeFact(ctx, { factKey: "gs1.offering", domainKey: "products", scope: "company-wide", title: "Offering", statement: A }, knowledgeDeps);
    if (created.status !== "created") throw new Error(`create: ${created.status}`);
    const listed = await listKnowledgeSources(ctx, knowledgeDeps);
    if (listed.status !== "read") throw new Error("listing");
    const recordA = listed.records.find((r) => r.factId === created.identity.factId)!;

    const turn = async (evidence: RetrievalEvidenceSet | undefined) =>
      (await conversations.persistExchange(
        { tenantId: ctx.tenantId, actorId: ctx.userId },
        { subject: "gs1", userContent: "draft", assistant: { role: "assistant", content: "draft", origin: "model" }, ...(evidence ? { evidence: toStoredEvidence(evidence) } : {}) },
      )).assistantMessageId;
    const artifactId = (await setup.query<{ id: string }>(
      `insert into work_artifacts (tenant_id, artifact_type, title, owner_workspace, current_revision, intended_destination)
       values ($1, 'content-draft', 'GS-1 draft', 'operations', 1, 'instagram') returning id`,
      [ctx.tenantId],
    )).rows[0]!.id;
    let revisionNo = 0;
    const revision = async (content: string, sourceMessageId: string | null) => {
      revisionNo += 1;
      return (await setup.query<{ id: string }>(
        `insert into work_artifact_revisions (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id, source_message_id)
         values ($1, $2, $3, $4, $5, 'human', $6, $7) returning id`,
        [ctx.tenantId, artifactId, revisionNo, content, createHash("sha256").update(content).digest("hex"), randomUUID(), sourceMessageId],
      )).rows[0]!.id;
    };
    const read = async (revisionId: string) => readRevisionGenerationEvidence(ctx, { artifactId, revisionId }, readDeps);
    const grounding = async (revisionId: string) => {
      const seen = await read(revisionId);
      if (seen.status !== "recorded") throw new Error(`expected recorded, got ${seen.status}`);
      return seen;
    };

    const bounded = await turn(buildBoundedUniverseEvidence([recordA]));
    const revExact = await revision(A, bounded);
    const revMixed = await revision(`${A} Every rug is hand-knotted by master artisans.`, bounded);
    const revQuiet = await revision("We love what we make.", bounded);
    const matched = await turn(buildRetrievalEvidence(await searchKnowledge(ctx, { queryText: "zanzibar kilims" }, knowledgeDeps), "zanzibar kilims"));
    const revMatched = await revision("Zanzibar makes the finest kilims in Europe.", matched);
    const noMatch = await turn(buildRetrievalEvidence(await searchKnowledge(ctx, { queryText: "xylophone" }, knowledgeDeps), "xylophone"));
    const revNoMatch = await revision(A, noMatch);
    const unreadable = await turn(buildRetrievalEvidence({ status: "unavailable", reason: "read-failed" }, "q"));
    const revUnreadable = await revision(A, unreadable);
    const revUnrecorded = await revision(A, await turn(undefined));
    const revHuman = await revision(A, null);

    /* 1 · 2 · 5 · 10 · the stored copy against the stored evidence; bounded-universe alone supports nothing. */
    {
      const seen = await grounding(revExact);
      assert.equal(seen.selection.status, "bounded-universe", "20 · the candidate provenance stays visible beside the check");
      assert.deepEqual(seen.grounding.claims.map((c) => [c.text, c.support.status]), [[A, "supported"]]);
      assert.equal(seen.grounding.status, "supported");
      assert.match(GROUNDING_CHECK_VERDICT.supported, /not a review decision or a publication approval/, "10 · supported is advisory");
      assert.equal((await grounding(revQuiet)).grounding.status, "undetermined", "5 · supplied (bounded-universe) is not support");
    }

    /* 7 · one unsupported sentence is never averaged away. */
    {
      const seen = await grounding(revMixed);
      assert.equal(seen.grounding.status, "insufficient");
      assert.deepEqual(seen.grounding.claims.map((c) => c.support.status), ["supported", "insufficient"]);
    }

    /* 6 · 8 · matched is not support; undetermined stays undetermined. */
    {
      const seen = await grounding(revMatched);
      assert.equal(seen.selection.status, "matched");
      assert.equal(seen.grounding.status, "insufficient", "a matched record does not carry 'finest' or 'Europe'");
      assert.match(GROUNDING_CHECK_VERDICT.undetermined, /could not determine/);
    }

    /* 9 · missing or unreadable evidence is never support. */
    assert.equal((await grounding(revNoMatch)).grounding.claims[0]!.support.status, "insufficient", "nothing supplied");
    assert.equal((await grounding(revUnreadable)).grounding.status, "unavailable");
    assert.deepEqual(await read(revUnrecorded), { status: "no-retrieval-recorded", revisionNo: 7 });
    assert.deepEqual(await read(revHuman), { status: "no-generation-message", revisionNo: 8 });

    /* 4 · HISTORY: Knowledge moves from A to B; the check still reads what generation was given. */
    {
      const superseded = await supersedeKnowledgeFact(ctx, { factId: created.identity.factId, title: "Offering", statement: B, observedKnowledgeVersion: 1 }, knowledgeDeps);
      assert.equal(superseded.status, "superseded");
      const now = await listKnowledgeSources(ctx, knowledgeDeps);
      assert.equal(now.status === "read" ? now.records[0]!.statement : "", B, "today's Knowledge is B");
      const seen = await grounding(revExact);
      assert.equal(seen.items[0]!.excerpt, A);
      assert.equal(seen.grounding.status, "supported", "the revision is still checked against A, which it repeats word for word");
      const later = await revision(B, bounded);
      assert.equal((await grounding(later)).grounding.status, "undetermined", "B was never supplied to that generation, so it is not supported by it");
    }

    /* A cut excerpt is never support for its cut fragment. */
    {
      const lead = `${"Our wool comes from small farms near the coast and is washed by hand ".repeat(3).trim()}.`.padEnd(222, "x").slice(0, 221) + ".";
      const statement = `${lead} Our rugs are dyed in no circumstances.`;
      const record = { ...recordA, statement } as KnowledgeSourceRecord;
      const set = buildBoundedUniverseEvidence([record]);
      assert.ok(set.items[0]!.excerptTruncated && set.items[0]!.excerpt!.endsWith("Our rugs are dyed"), "fixture: the stored excerpt ends mid-sentence");
      const rev = await revision("Our rugs are dyed.", await turn(set));
      assert.notEqual((await grounding(rev)).grounding.status, "supported", "a truncated record's cut fragment supports nothing");
    }

    /* 3 · 11 – 15 · reading writes nothing anywhere, and nothing else reads the check. */
    {
      const counts = async () =>
        (await setup.query(
          `select (select count(*) from decision_records)::int d, (select count(*) from audit_log)::int a,
                  (select count(*) from knowledge_nodes)::int n, (select count(*) from knowledge_facts)::int f,
                  (select count(*) from heby_answer_evidence_set)::int s, (select count(*) from heby_answer_evidence_item)::int i,
                  (select count(*) from work_artifact_revisions)::int r, (select count(*) from governance_sessions)::int g`,
        )).rows[0];
      const before = await counts();
      for (const id of [revExact, revMixed, revMatched, revUnreadable]) await read(id);
      assert.deepEqual(await counts(), before, "the advisory read writes nothing");

      const server = code("src/features/heby-answer/revision-generation-evidence.server.ts");
      for (const banned of ["searchKnowledge", "listKnowledgeSources", "knowledge-read", "durable-knowledge", "knowledge-evidence", ".insert(", ".update(", "fetch("]) {
        assert.ok(!server.includes(banned), `the reviewer read does not use ${banned}`);
      }
      assert.ok(!CONTENT_PACKAGE_BLOCKERS.some((b) => /ground|support|claim/.test(b)), "11 · no grounding readiness blocker");
      for (const authority of [
        "src/features/content-composition/contracts.ts",
        "src/features/content-composition/read-content-package.server.ts",
        "src/features/work-artifact-review/review-revision.server.ts",
        "src/features/work-artifact-review/contracts.ts",
      ]) {
        assert.ok(!/claim-support|grounding/.test(code(authority)), `12 · ${authority} does not read the grounding check`);
      }
    }

    /* UI · the check renders inside the existing evidence panel, below the supplied records; absence says "not available". */
    {
      const ui = code("src/components/operations-preparation/revision-generation-evidence.tsx");
      assert.ok(ui.indexOf("<ItemRow") < ui.indexOf("<GroundingCheck grounding={evidence.grounding} />"), "evidence first, then the check");
      assert.match(ui, /GROUNDING_CHECK_VERDICT\[grounding\.status\]/);
      assert.match(ui, /grounding\.claims\.map/);
      assert.match(ui, /GROUNDING_CHECK_NOT_RUN/);
      assert.ok(!/approve|reject|Action|readiness/i.test(ui.slice(ui.indexOf("function GroundingCheck"), ui.indexOf("export function RevisionGenerationEvidence"))), "the check renders no decision control");
    }

    console.log("PASS grounding-sufficiency-gs1 advisory-postgres");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
