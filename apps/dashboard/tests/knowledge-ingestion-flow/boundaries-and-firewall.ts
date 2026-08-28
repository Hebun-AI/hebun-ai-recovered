/*
 * Knowledge ingestion — boundaries and firewall.
 *
 * The PostgreSQL flow proves what ingestion DOES. This file proves what it is not allowed to become,
 * by reading the released source rather than by trusting a description of it. Every assertion here
 * is a promise made in the Gate A architecture, locked so that breaking it fails a test rather than
 * quietly shipping.
 *
 * Pure source assertions — no database, no clock, no network.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CHUNK_TARGET_CHARACTERS,
  MAX_CHUNKS_PER_SOURCE,
  MAX_SOURCE_CHARACTERS,
  chunkFactKey,
  chunkSource,
  digestSource,
  normalizeSourceText,
} from "../../src/features/knowledge/ingestion-contracts";

const ORCHESTRATOR = "src/features/knowledge/knowledge-ingest.server.ts";
const CONTRACTS = "src/features/knowledge/ingestion-contracts.ts";
const WRITER = "src/features/knowledge/durable-knowledge-writer.server.ts";
const CARD = "src/components/knowledge-workspace/knowledge-ingestion-card.tsx";
const ACTIONS = "src/app/(dashboard)/knowledge/actions.ts";

const read = (path: string) => readFileSync(path, "utf8");
/** Strip block and line comments, so prose about a thing is never mistaken for the thing. */
const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function collect(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return collect(path);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function main(): void {
  const orchestrator = read(ORCHESTRATOR);
  const orchestratorCode = codeOf(orchestrator);
  const contracts = read(CONTRACTS);
  const card = read(CARD);

  /* ── 1. THERE IS STILL EXACTLY ONE KNOWLEDGE WRITER ────────────────────── */
  {
    const writers = collect("src/features")
      .concat(collect("src/app"))
      .filter((file) => /\.insert\(knowledgeNodes\)|\.insert\(knowledgeFacts\)/.test(read(file)));
    assert.deepEqual(
      writers.sort(),
      [WRITER],
      "ingestion added a producer, NOT a second writer — canonical rows have one author",
    );
    assert.match(
      orchestratorCode,
      /createDurableKnowledgeWriter/,
      "and the orchestrator delegates to it",
    );
    assert.ok(
      !/\.insert\(|\.update\(|\.delete\(/.test(orchestratorCode),
      "the orchestrator itself writes nothing directly",
    );
  }

  /* ── 2. NOTHING FORBIDDEN IS REACHABLE FROM INGESTION ──────────────────── */
  {
    for (const forbidden of [
      "embedding",
      "pgvector",
      "vector",
      "similarity",
      "rerank",
      "openai",
      "anthropic",
      "provider-framework",
      "provider-invocation",
      "live-dispatch",
      "execution",
      "permit",
      "agent-runtime",
      "computer-use",
      "documents",
      "storage_path",
      "fetch(",
      "readFile",
    ]) {
      assert.ok(
        !orchestratorCode.includes(forbidden),
        `ingestion must not reach ${forbidden}`,
      );
      assert.ok(!codeOf(contracts).includes(forbidden), `the contract must not reach ${forbidden}`);
    }
    /* No ratification, by absence rather than by intent. */
    for (const forbidden of ["ratify", "ratification", "knowledge-ratification", "K4"]) {
      assert.ok(
        !orchestratorCode.includes(forbidden),
        `ingestion must not call ${forbidden} — ingested is not ratified`,
      );
    }
    /*
     * ── REPAIRED BY R4C.1 ─────────────────────────────────────────────────
     *
     * This assertion used to read "no upload path exists", and that was true when it was written.
     * It is not true any more: `knowledge-file-ingest.server.ts` bounds a selected `.txt`/`.md`
     * file, decodes it strictly, and calls this orchestrator with the resulting TEXT.
     *
     * So the claim is narrowed to the part that is still true and still worth locking — the
     * producer for canonical Knowledge takes text and nothing else, whatever the operator chose.
     * A file is decoded BEFORE it, never inside it, which is what keeps every gate below this line
     * indifferent to how the text arrived. Deleting the assertion because a phase outgrew its
     * wording would have removed the property along with the sentence.
     */
    assert.ok(
      !/multipart|formData|File\b|Blob\b|arrayBuffer|TextDecoder/.test(orchestratorCode),
      "the producer still takes text only — bytes are decoded upstream of it, never within it",
    );
    /*
     * And the boundary that DOES read a file is exactly one module, named here so this file cannot
     * be read as a denial that any upload exists. What it is allowed to be is proven in
     * `tests/r4c-flow/file-boundary-and-firewall.ts`.
     */
    const fileReaders = collect("src/features")
      .concat(collect("src/app"))
      .filter((file) => /\.arrayBuffer\(\)/.test(codeOf(read(file))));
    assert.deepEqual(
      fileReaders.sort(),
      ["src/features/knowledge/knowledge-file-ingest.server.ts"],
      "exactly one module reads a selected file's bytes, and it writes nothing itself",
    );
  }

  /* ── 3. THE WRITER'S DEFAULT BEHAVIOUR IS UNCHANGED ────────────────────── */
  {
    const writerCode = codeOf(read(WRITER));
    assert.match(
      writerCode,
      /if \(tx\) \{[\s\S]{0,120}await writeWithin\(tx\);[\s\S]{0,80}\} else \{[\s\S]{0,80}await db\.transaction\(writeWithin\);/,
      "an omitted transaction still opens its own, exactly as before",
    );
    assert.match(
      writerCode,
      /if \(tx\) throw error;/,
      "and inside a caller's transaction a failure throws rather than returning a status, because " +
        "the transaction is already aborted",
    );
    /* The standing K2 writes is still the only standing it can write. */
    assert.match(writerCode, /knowledgeLifecycleStatus: "draft"/);
    assert.match(writerCode, /knowledgeAuthority: "provisional"/);
    assert.ok(
      !/knowledgeAuthority: "(ratified|authoritative)"/.test(writerCode),
      "there is still no path that writes a stronger standing",
    );
    assert.match(
      writerCode,
      /textOriginUnverified: true/,
      "and an ingested chunk claims no more verified an origin than an authored one",
    );
  }

  /* ── 4. ONE TRANSACTION FOR THE WHOLE SOURCE ───────────────────────────── */
  {
    assert.match(
      orchestratorCode,
      /await db\.transaction\(async \(tx\) => \{[\s\S]*?for \(const chunk of chunks\)/,
      "every chunk is written inside ONE transaction the orchestrator opens",
    );
    assert.equal(
      (orchestratorCode.match(/db\.transaction\(/g) ?? []).length,
      1,
      "and there is exactly one — never one per chunk",
    );
  }

  /* ── 5. THE TTL OF THIS PHASE'S HONESTY: ONE CHUNKER, SHARED ───────────── */
  {
    assert.match(
      codeOf(card),
      /import \{[\s\S]*?chunkSource[\s\S]*?normalizeSourceText[\s\S]*?\} from "@\/features\/knowledge\/ingestion-contracts"/,
      "the card previews with the SERVER'S chunker, so the count shown is the count written",
    );
    assert.ok(
      !/function chunk|split\("\\n\\n"\)/.test(codeOf(card)),
      "and it does not carry a second implementation that could disagree",
    );
    /* The standing is stated before the action, not after it. */
    const prose = card.replace(/\s+/g, " ");
    assert.match(prose, /Ingested knowledge is <strong>provisional<\/strong>/);
    assert.match(prose, /not ratified organizational truth/);
    /*
     * Checked against the RENDERED code, not the file: the header comment explains at length that
     * this is not search, and scanning comments would flag that explanation as the very claim it
     * exists to deny.
     */
    assert.ok(
      !/search|semantic|findable/i.test(codeOf(card)),
      "and no rendered copy implies this made anything searchable",
    );
  }

  /* ── 6. THE ACTION IS THE ONLY CLIENT-CROSSABLE ENTRY ──────────────────── */
  {
    const actionsCode = codeOf(read(ACTIONS));
    assert.match(actionsCode, /export async function ingestKnowledgeAction/);
    assert.match(
      actionsCode,
      /const tenant = await resolveTenantContext\(\);[\s\S]{0,200}ingestKnowledgeSource\(tenant/,
      "the tenant is resolved server-side and never accepted from the client",
    );
    assert.ok(
      !/tenantId|roleId|userId|authority/.test(
        actionsCode.slice(actionsCode.indexOf("ingestKnowledgeAction"), actionsCode.indexOf("ingestKnowledgeAction") + 700),
      ),
      "and the client input carries no tenant, actor, role or authority",
    );
    /* Heby cannot reach it: Heby's own actions live elsewhere and do not import this module. */
    const hebyImporters = collect("src/features")
      .filter((file) => /heby/.test(file))
      .filter((file) => read(file).includes("knowledge-ingest.server"));
    assert.deepEqual(hebyImporters, [], "no Heby module can reach the ingestion producer");
  }

  /* ── 7. DETERMINISM, PROVEN RATHER THAN PROMISED ───────────────────────── */
  {
    const source = "Alpha one.\n\n\n\nBeta two.   \r\n\r\nGamma three.";
    const a = normalizeSourceText(source);
    const b = normalizeSourceText(source.replace(/\n/g, "\r\n"));
    assert.equal(a, b, "line endings do not change the normalized form");
    assert.equal(digestSource(a), digestSource(b), "so they cannot change the identity");

    assert.deepEqual(
      chunkSource(a).map((chunk) => chunk.index),
      chunkSource(a).map((chunk) => chunk.index),
      "chunking is stable across runs",
    );
    assert.deepEqual(
      chunkSource(a).map((chunk) => chunk.text),
      ["Alpha one.\n\nBeta two.\n\nGamma three."],
      "short paragraphs pack together in source order",
    );

    /* Identity separates content, not just titles. */
    const first = chunkFactKey("Policy", digestSource("one"), 0);
    const second = chunkFactKey("Policy", digestSource("two"), 0);
    assert.notEqual(
      first,
      second,
      "the same title with different content yields a DIFFERENT identity — a corrected document " +
        "is not refused as a duplicate of the one it corrects",
    );
    assert.equal(
      chunkFactKey("Policy", digestSource("one"), 0),
      first,
      "and the same content always yields the same identity",
    );
    assert.ok(first.startsWith("ingest:"), "an ingested key says so");

    /* Empty in, empty out — never a silent success. */
    assert.deepEqual(chunkSource(normalizeSourceText("\n\n   \n")), []);
  }

  /* ── 8. THE BOUNDS ARE THE ONES THE READ SEAM CAN HONOUR ───────────────── */
  {
    const repo = read("src/features/knowledge/durable-knowledge-repository.server.ts");
    const limit = Number(/KNOWLEDGE_LISTING_LIMIT = (\d+)/.exec(repo)?.[1]);
    assert.ok(Number.isFinite(limit), "the listing limit is a real constant");
    assert.ok(
      MAX_CHUNKS_PER_SOURCE < limit,
      `one ingestion (${MAX_CHUNKS_PER_SOURCE}) must stay under the evidence view's ${limit}, or a ` +
        "successful ingestion would be partly invisible to Heby",
    );
    assert.ok(
      MAX_SOURCE_CHARACTERS > CHUNK_TARGET_CHARACTERS,
      "the size ceiling is larger than one chunk",
    );
  }

  /* ── 9. NO SHIPPED STRING STILL DENIES THAT INGESTION EXISTS ───────────── */
  {
    /*
     * THE PRODUCT MUST NOT SAY BOTH "Ingest a source" AND "no ingestion path exists".
     *
     * This phase's first commit gate failed on exactly that: the capability map reported ingestion
     * as not-connected on the same page as the ingestion card, and Heby appended "No ingestion
     * path exists" to every Knowledge read — including reads of records just ingested. Three
     * assertions held it green. A green suite that is green BECAUSE a stale claim survived is the
     * failure this block exists to make impossible a second time.
     *
     * Scanned over CODE, not comments: the sites repaired above legitimately explain in prose what
     * they used to say, and that explanation is not the claim.
     */
    const DENIALS = [
      /no ingestion path/i,
      /nothing can add knowledge/i,
      /nothing to ingest (?:them )?with/i,
      /no knowledge can enter/i,
    ];
    for (const file of collect("src")) {
      const code = codeOf(read(file));
      for (const denial of DENIALS) {
        assert.ok(
          !denial.test(code),
          `${file} still tells the operator ${denial} — ingestion exists, so that is now false`,
        );
      }
    }
    /* And the capability map reports it positively rather than merely stopping the denial. */
    const map = read("src/features/knowledge/capability-map.ts");
    assert.match(
      map,
      /capability: "ingestion" as const,\s*\n\s*label: "Knowledge ingestion",\s*\n\s*state: "connected" as const,/,
      "the capability map states ingestion as connected",
    );
    /* Connected is not a licence: search, semantic retrieval and embeddings stay absent. */
    for (const stillAbsent of ["search", "semantic-retrieval", "embeddings"]) {
      assert.match(
        map,
        new RegExp(`capability: "${stillAbsent}" as const,[\\s\\S]{0,120}state: "not-connected" as const`),
        `${stillAbsent} is still reported as not connected`,
      );
    }
  }

  /* ── 10. NO SCHEMA, NO MIGRATION ───────────────────────────────────────── */
  {
    /*
     * INGESTION ADDED NO MIGRATION — scoped to this phase, not to the repository forever.
     *
     * The global count and the "nothing sorts after my boundary" check were both claims about the
     * future, and a later Gate-B phase broke them by doing exactly what it was approved to do.
     * Scoping to this phase's own window keeps the real guarantee while naming what legitimately
     * followed, so silent schema still cannot slip past.
     */
    const migrations = readdirSync("src/db/migrations").filter((name) => name.endsWith(".sql"));
    const PHASE_BOUNDARY = "20260813090642_membership_role_tenant_integrity.sql";
    assert.ok(migrations.includes(PHASE_BOUNDARY), "the migration ingestion inherited is intact");
    assert.deepEqual(
      migrations.filter((name) => name > PHASE_BOUNDARY).sort(),
      [
        /* KR5 historical answer evidence — a later Gate-B phase, declared rather than silent. */
        "20260815202736_heby_answer_evidence.sql",
        "20260816063156_r3a_action_authorization.sql",
        "20260816085245_r3w_durable_work_artifacts.sql", "20260816105458_r3r_durable_recipient_authority.sql", "20260816194116_r3b_action_execution_attempts.sql",
        /* R4A tenant bootstrap ceremony — a later Gate-B phase, declared rather than silent. */
        "20260817195446_r4a_tenant_provisioning_source.sql",
        "20260818172455_production_provenance_vocabulary.sql",
        /* G6D generic answer-source evidence — a declared later phase, not this one's. */
        "20260819133901_g6d_answer_source_evidence.sql", "20260822140116_i1_integration_connection_authority.sql", "20260822195716_int2_integration_credential_authority.sql",
      /* R2H — control_source: the column R5.1 designed and deferred. */
      "20260825080110_provider_control_source.sql",
      /* KR-EXT1 — the Knowledge-owned external-system reference table. Additive: one CREATE TABLE,
       * two foreign keys and three indexes, zero DROP, `knowledge_nodes` untouched. */
      "20260826064423_kr_ext1_knowledge_external_references.sql",
      "20260828071500_ap4b_origination_invocation_provenance.sql",
      "20260828173456_sia26_origination_agent_attribution.sql",
      ],
      "ingestion added no migration; everything after its boundary belongs to a declared later phase",
    );
    /* The columns ingestion uses all pre-date this phase. */
    const schema = read("src/db/schema/knowledge.ts");
    for (const column of ["provenance", "source_attribution"]) {
      assert.match(schema, new RegExp(column), `${column} pre-existed this phase`);
    }
    assert.ok(
      statSync("src/db/schema/knowledge.ts").isFile(),
      "and the schema module was not replaced",
    );
  }

  console.log("PASS knowledge ingestion boundaries and firewall");
}

main();
