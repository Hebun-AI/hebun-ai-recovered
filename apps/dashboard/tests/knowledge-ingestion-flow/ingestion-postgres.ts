/*
 * Knowledge ingestion against a REAL PostgreSQL database.
 *
 * WHAT THIS PROVES, AND WHY IT NEEDED A REAL DATABASE:
 *
 *   Ingestion's whole claim is that ONE human paste becomes N canonical facts that commit TOGETHER.
 *   Atomicity is not a property a mock can demonstrate — "chunk 3 failed and chunks 1-2 are gone"
 *   is a statement about a transaction, so the transaction has to be real. The same is true of the
 *   identity guarantee: `knowledge_facts_tenant_domain_scope_fact_key_uidx` is what makes a repeat
 *   ingestion a refusal rather than a duplicate, and only Postgres enforces it.
 *
 *   It also proves the point of the whole phase: after ingesting, the EXISTING K1 seam and the
 *   EXISTING Heby evidence path see the records, with no second retrieval system anywhere.
 *
 * Uses disposable local databases, dropped on exit by their own ownership handle.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { ingestKnowledgeSource } from "../../src/features/knowledge/knowledge-ingest.server";
import { resolveKnowledgeWriteAuthority } from "../../src/features/knowledge/knowledge-write-authority.server";
import { listKnowledgeSources } from "../../src/features/knowledge/knowledge-read.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { toKnowledgeResolution } from "../../src/features/heby-answer/knowledge-evidence.server";
import {
  MAX_CHUNKS_PER_SOURCE,
  chunkSource,
  digestSource,
  normalizeSourceText,
} from "../../src/features/knowledge/ingestion-contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
const NOW = new Date("2026-08-20T09:00:00.000Z");
const DOMAIN = "finance";
const SCOPE = "company-wide" as const;

/** Three paragraphs, deliberately short: one chunk, so the identity assertions stay legible. */
const SMALL_SOURCE = [
  "Expense approvals follow the delegation matrix.",
  "Anything above fifty thousand lira requires the finance director.",
  "Receipts are retained for seven years.",
].join("\n\n");

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded, sessionContextId: string): TenantContext {
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
    requestId: "knowledge-ingestion-request",
    authenticatedAt: NOW.toISOString(),
  });
}

async function addMember(
  client: Client,
  tenantId: string,
  email: string,
  roleType: string,
): Promise<Seeded> {
  const user = await client.query<{ id: string }>(
    `insert into users (email, name) values ($1, $1) returning id`,
    [email],
  );
  const userId = user.rows[0]!.id;
  const identity = await client.query<{ id: string }>(
    `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
     values ($1, 'local', 'hebun-local', $2, 'active', true, now()) returning id`,
    [userId, `local:${email}`],
  );
  const role = await client.query<{ id: string }>(
    `insert into roles (tenant_id, name, type) values ($1, $2, $3) returning id`,
    [tenantId, `Role ${email}`, roleType],
  );
  const roleId = role.rows[0]!.id;
  const membership = await client.query<{ id: string }>(
    `insert into memberships (tenant_id, user_id, role_id, status)
     values ($1, $2, $3, 'active') returning id`,
    [tenantId, userId, roleId],
  );
  return {
    tenantId,
    userId,
    authIdentityId: identity.rows[0]!.id,
    membershipId: membership.rows[0]!.id,
    roleId,
  };
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
  const harness = createDisposablePostgresHarness("hebun_knowledge_ingestion");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  /*
   * The REAL durable role-band resolver, pointed at the disposable database. Stubbing it would make
   * the authority assertions below prove nothing about the band that actually gates Knowledge.
   */
  const deps = {
    getDb: () => handle.db,
    now: () => NOW,
    resolveAuthority: (tenant: TenantContext) => resolveKnowledgeWriteAuthority(tenant, handle.db),
  } as never;
  /* The REAL K1 read seam over the same disposable database — no stub, no second read path. */
  const readDeps = {
    getRepo: () => createDurableKnowledgeRepository(handle.db),
    now: () => NOW,
  } as never;

  try {
    harness.migrateDatabase();
    await setup.connect();

    const A = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "a@acme.test",
      password: "a-correct-password-7Qx",
    });
    const X = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex",
      email: "x@globex.test",
      password: "x-correct-password-4Lm",
    });
    const MEMBER = await addMember(setup, A.tenantId, "member@acme.test", "member");

    const ctxA = contextFor(A, await sessionRowFor(setup, A, "aaaa"));
    const ctxX = contextFor(X, await sessionRowFor(setup, X, "bbbb"));
    const ctxMember = contextFor(MEMBER, await sessionRowFor(setup, MEMBER, "cccc"));

    const counts = async () => {
      const row = await setup.query<Record<string, string>>(`
        select (select count(*) from knowledge_nodes)   nodes,
               (select count(*) from knowledge_facts)   facts,
               (select count(*) from audit_log)         audit,
               (select count(*) from decision_records)  decisions,
               (select count(*) from governance_sessions) sessions,
               (select count(*) from documents)         documents`);
      return row.rows[0]!;
    };

    /* ══ 1. AUTHORITY — the same band K2 requires, and nothing wider ═════════ */
    {
      const before = await counts();
      assert.equal(
        (await ingestKnowledgeSource(null, { sourceTitle: "T", sourceText: SMALL_SOURCE, domainKey: DOMAIN, scope: SCOPE }, deps)).status,
        "unauthorized",
        "an unauthenticated caller is refused before anything is read",
      );
      const asMember = await ingestKnowledgeSource(
        ctxMember,
        { sourceTitle: "T", sourceText: SMALL_SOURCE, domainKey: DOMAIN, scope: SCOPE },
        deps,
      );
      assert.equal(asMember.status, "forbidden", "an ordinary member may not establish Knowledge");
      assert.deepEqual(await counts(), before, "and neither attempt wrote anything");
    }

    /* ══ 2. VALIDATION — emptiness is judged AFTER normalization ════════════ */
    {
      const blank = await ingestKnowledgeSource(
        ctxA,
        { sourceTitle: "Only blank lines", sourceText: "\n\n   \n\t\n\n", domainKey: DOMAIN, scope: SCOPE },
        deps,
      );
      assert.equal(blank.status, "invalid", "whitespace is not a source");
      if (blank.status !== "invalid") throw new Error("unreachable");
      assert.ok(
        blank.problems.some((problem) => problem.field === "sourceText" && problem.code === "required"),
        "and it says the text is empty rather than reporting zero chunks as success",
      );

      /*
       * The 50-record evidence limit is respected honestly, not silently exceeded.
       *
       * Paragraphs of ~900 characters are the case that reaches the CHUNK cap without reaching the
       * SIZE cap: two of them exceed the 1 500 target, so each becomes its own chunk, and 45 of them
       * is only ~40 000 characters. A fixture of larger paragraphs would trip `too-long` first and
       * prove nothing about this bound.
       */
      const huge = Array.from({ length: MAX_CHUNKS_PER_SOURCE + 5 }, (_, i) =>
        `Paragraph ${i} ${"x".repeat(880)}`,
      ).join("\n\n");
      const tooMany = await ingestKnowledgeSource(
        ctxA,
        { sourceTitle: "Too large", sourceText: huge, domainKey: DOMAIN, scope: SCOPE },
        deps,
      );
      assert.equal(tooMany.status, "invalid");
      if (tooMany.status !== "invalid") throw new Error("unreachable");
      assert.ok(
        tooMany.problems.some((problem) => problem.code === "too-many-chunks"),
        "an ingestion larger than the evidence view can show is refused with the real reason",
      );
    }

    /* ══ 3. THE INGESTION ITSELF ════════════════════════════════════════════ */
    const before = await counts();
    const ingested = await ingestKnowledgeSource(
      ctxA,
      { sourceTitle: "Expense policy 2026", sourceText: SMALL_SOURCE, domainKey: DOMAIN, scope: SCOPE },
      deps,
    );
    assert.equal(ingested.status, "ingested");
    if (ingested.status !== "ingested") throw new Error("unreachable");

    const expectedChunks = chunkSource(normalizeSourceText(SMALL_SOURCE));
    assert.equal(
      ingested.source.chunkCount,
      expectedChunks.length,
      "the server wrote exactly the chunks the pure chunker predicts — the UI preview cannot lie",
    );
    assert.equal(
      ingested.source.sourceDigest,
      digestSource(normalizeSourceText(SMALL_SOURCE)),
      "and the digest is of the NORMALIZED text, so reformatting is not new knowledge",
    );

    /* ══ 4. ROWS, PROVENANCE AND STANDING ═══════════════════════════════════ */
    {
      const after = await counts();
      assert.equal(
        Number(after.facts) - Number(before.facts),
        expectedChunks.length,
        "one fact per chunk",
      );
      assert.equal(Number(after.nodes) - Number(before.nodes), expectedChunks.length);
      assert.equal(
        Number(after.audit) - Number(before.audit),
        expectedChunks.length,
        "one audit row per chunk, written inside the same transaction",
      );
      assert.equal(after.documents, before.documents, "the documents table stays unused");
      assert.equal(
        after.decisions,
        before.decisions,
        "ingestion creates no Governance decision — it is not ratification",
      );
      assert.equal(after.sessions, before.sessions, "and no Governance session");

      const rows = await setup.query<{
        label: string;
        statement: string;
        knowledge_lifecycle_status: string;
        knowledge_authority: string;
        ratified_at: string | null;
        provenance: Record<string, unknown>;
        source_attribution: Record<string, unknown>;
        fact_key: string;
      }>(
        `select n.label, n.statement, n.knowledge_lifecycle_status, n.knowledge_authority,
                n.ratified_at, n.provenance, n.source_attribution, f.fact_key
           from knowledge_facts f
           join knowledge_nodes n on n.id = f.active_knowledge_node_id
          where f.tenant_id = $1
          order by f.fact_key`,
        [A.tenantId],
      );
      assert.equal(rows.rows.length, expectedChunks.length);

      for (const [index, row] of rows.rows.entries()) {
        assert.equal(row.knowledge_lifecycle_status, "draft", "every ingested record is a draft");
        assert.equal(row.knowledge_authority, "provisional", "and provisional, never ratified");
        assert.equal(row.ratified_at, null, "with no ratification timestamp");
        assert.equal(row.provenance.origin, "human-ingested", "provenance says how it arrived");
        assert.equal(row.provenance.sourceDigest, ingested.source.sourceDigest);
        assert.equal(row.provenance.chunkIndex, index, "carrying its own position");
        assert.equal(row.provenance.chunkCount, expectedChunks.length, "and the total");
        assert.equal(row.provenance.textOriginUnverified, true, "and still claims no verified origin");
        assert.equal(row.source_attribution.sourceTitle, "Expense policy 2026");
        assert.equal(row.source_attribution.ingestedByActorId, A.userId);
        assert.equal(
          row.statement,
          expectedChunks[index]!.text,
          "the human's words are stored verbatim",
        );
        assert.ok(row.fact_key.startsWith("ingest:"), "and the key says it was ingested");
      }
    }

    /* ══ 5. THE EXISTING K1 SEAM SEES THEM ══════════════════════════════════ */
    const listing = await listKnowledgeSources(ctxA, readDeps);
    assert.equal(listing.status, "read");
    if (listing.status !== "read") throw new Error("unreachable");
    assert.equal(
      listing.records.length,
      expectedChunks.length,
      "no new read path was needed — K1 already lists them",
    );

    /* ══ 6. AND SO DOES HEBY'S EXISTING EVIDENCE PATH ═══════════════════════ */
    {
      const resolution = toKnowledgeResolution(listing);
      assert.equal(
        resolution.state,
        "resolved",
        "the organization now holds knowledge, so the evidence path resolves instead of refusing",
      );
      assert.equal(resolution.items.length, expectedChunks.length);
      assert.ok(
        resolution.items.every((item) => item.detail.includes("ratified: no")),
        "and every item is presented as unratified",
      );
      assert.equal(resolution.authoritative, false, "ingested knowledge is not authoritative");
    }

    /* ══ 7. EXACT RE-INGESTION IS A REFUSAL, NOT A DUPLICATE ════════════════ */
    {
      const beforeRepeat = await counts();
      const again = await ingestKnowledgeSource(
        ctxA,
        { sourceTitle: "Expense policy 2026", sourceText: SMALL_SOURCE, domainKey: DOMAIN, scope: SCOPE },
        deps,
      );
      assert.equal(again.status, "duplicate-ingestion");
      if (again.status !== "duplicate-ingestion") throw new Error("unreachable");
      assert.equal(again.alreadyPresent, expectedChunks.length, "every chunk identity was found");
      assert.deepEqual(await counts(), beforeRepeat, "and nothing was written");

      /* Reformatting is the same knowledge — the digest is of the normalized text. */
      const reformatted = await ingestKnowledgeSource(
        ctxA,
        {
          sourceTitle: "Expense policy 2026",
          sourceText: `\n\n${SMALL_SOURCE.replace(/\n\n/g, "\n\n\n")}   \n`,
          domainKey: DOMAIN,
          scope: SCOPE,
        },
        deps,
      );
      assert.equal(
        reformatted.status,
        "duplicate-ingestion",
        "extra blank lines and trailing spaces are not new knowledge",
      );
    }

    /* ══ 8. SAME TITLE, CHANGED CONTENT IS A DIFFERENT SOURCE ═══════════════ */
    {
      const changed = await ingestKnowledgeSource(
        ctxA,
        {
          sourceTitle: "Expense policy 2026",
          sourceText: `${SMALL_SOURCE}\n\nCards are issued by finance only.`,
          domainKey: DOMAIN,
          scope: SCOPE,
        },
        deps,
      );
      assert.equal(
        changed.status,
        "ingested",
        "a corrected document under the same title is NOT a duplicate — the digest separates them",
      );
      if (changed.status !== "ingested") throw new Error("unreachable");
      assert.notEqual(changed.source.sourceDigest, ingested.source.sourceDigest);

      const survived = await setup.query<{ count: string }>(
        `select count(*) from knowledge_facts where tenant_id=$1 and fact_key = any($2)`,
        [A.tenantId, [...ingested.source.factKeys]],
      );
      assert.equal(
        Number(survived.rows[0]!.count),
        ingested.source.factKeys.length,
        "and the earlier ingestion survives untouched — nothing was superseded or overwritten",
      );
    }

    /* ══ 9. ALL OR NONE ═════════════════════════════════════════════════════ */
    {
      const multi = ["Alpha paragraph.", "Beta paragraph.", "Gamma paragraph."].join("\n\n");
      const beforeFail = await counts();
      const failed = await ingestKnowledgeSource(
        ctxA,
        { sourceTitle: "Rollback proof", sourceText: multi, domainKey: DOMAIN, scope: SCOPE },
        { ...(deps as object), failAfterChunk: 0 } as never,
      );
      assert.equal(failed.status, "failed", "an injected mid-ingestion failure fails the ingestion");
      assert.deepEqual(
        await counts(),
        beforeFail,
        "and ZERO chunks, nodes or audit rows survive — all of it rolled back together",
      );
    }

    /* ══ 10. TENANT ISOLATION ═══════════════════════════════════════════════ */
    {
      const globexListing = await listKnowledgeSources(ctxX, readDeps);
      if (globexListing.status !== "read") throw new Error("unreachable");
      assert.deepEqual(
        globexListing.records,
        [],
        "another tenant sees none of it, and its own emptiness is honest",
      );

      /* The same source ingested by another tenant is a fresh ingestion, not a duplicate. */
      const globex = await ingestKnowledgeSource(
        ctxX,
        { sourceTitle: "Expense policy 2026", sourceText: SMALL_SOURCE, domainKey: DOMAIN, scope: SCOPE },
        deps,
      );
      assert.equal(globex.status, "ingested", "identity is scoped to the tenant");
    }

    console.log("PASS knowledge ingestion");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
