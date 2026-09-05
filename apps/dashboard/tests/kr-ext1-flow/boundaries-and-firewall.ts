/*
 * KR-EXT1 — THE BOUNDARY FIREWALL.
 *
 * ── THE PROPERTIES ───────────────────────────────────────────────────────────
 *
 * Knowledge gained the ability to say what a fact is ABOUT. It must NOT thereby have gained the
 * ability to read a provider, to move an integration, to decide Governance, or to edit a knowledge
 * node — and the provider record itself must NOT have become storable.
 *
 * Walked over the real import graph and the shipped schema, so a rename cannot satisfy it and a
 * comment naming a forbidden symbol cannot trip it.
 *
 * No database, no network, no key.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { GOVERNANCE_SUBJECT_TYPES } from "../../src/features/governance-decision/contracts";
import {
  GITHUB_PROVIDER_KEY,
  GITHUB_REPOSITORY_ACTIVITY_CAPABILITY,
} from "../../src/features/provider-github/contracts";
import {
  EXTERNAL_RECORD_KINDS,
  renderExternalReference,
} from "../../src/features/knowledge/external-reference-contracts";
import { getTableColumns } from "drizzle-orm";
import { knowledgeExternalReferences } from "../../src/db/schema/knowledge-external-reference";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const AUTHORITY = "src/features/knowledge/external-reference-authority.server.ts";
const CONTRACTS = "src/features/knowledge/external-reference-contracts.ts";
const SCHEMA = "src/db/schema/knowledge-external-reference.ts";
const MIGRATION_DIR = "src/db/migrations";

function resolveImport(spec: string, from: string): string | null {
  const base = spec.startsWith("@/")
    ? path.join("src", spec.slice(2))
    : spec.startsWith(".")
      ? path.join(path.dirname(from), spec)
      : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const c = base + ext;
    if (existsSync(path.join(ROOT, c)) && statSync(path.join(ROOT, c)).isFile()) return c;
  }
  return null;
}

function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const m of codeOf(read(file)).matchAll(/from\s+"([^"]+)"/g)) {
      const t = resolveImport(m[1]!, file);
      if (t) stack.push(t);
    }
  }
  return seen;
}

function performsNetworkIo(file: string): boolean {
  if (file.startsWith("src/db/schema/")) return false;
  const code = codeOf(read(file));
  return /(?<![\w.$])fetch(?![\w$])/.test(code) || /globalThis\s*\.\s*fetch/.test(code);
}

function main(): void {
  for (const f of [AUTHORITY, CONTRACTS, SCHEMA]) {
    assert.ok(existsSync(path.join(ROOT, f)), `${f} must exist for this suite to mean anything`);
  }
  const graph = reachableFrom(AUTHORITY);
  assert.ok(graph.size > 5, `the graph is real, got ${graph.size}`);

  /* ── 1. DECLARING A REFERENCE CONTACTS NOBODY ────────────────────────────── */
  {
    /*
     * EVERY CROSSING AT ONCE, NOT THE FIRST ONE. Importing a provider read also drags its transport,
     * so a first-failure arrangement reported "a network module appeared" for every boundary and a
     * reader could not tell which one had actually moved. Collecting them makes each failure name
     * what was imported.
     */
    const violations: string[] = [];

    for (const directory of [
      "src/features/provider-github/",
      "src/features/provider-google/",
      "src/features/integration-authority/",
      "src/features/integration-credentials/",
      "src/features/action-authorization/",
      "src/features/action-execution",
      "src/features/heby-",
    ]) {
      const hits = [...graph].filter((f) => f.startsWith(directory));
      if (hits.length > 0) violations.push(`must not reach ${directory} (${hits.sort().join(", ")})`);
    }

    const network = [...graph].filter(performsNetworkIo).sort();
    if (network.length > 0) {
      violations.push(
        "no module reachable from the reference authority may perform network I/O — recording a " +
          `reference is an organizational declaration, never a provider verification (${network.join(", ")})`,
      );
    }

    assert.deepEqual(violations, [], "the reference authority crossed a boundary it may not cross");
  }

  /* ── 2. IT WRITES NO KNOWLEDGE CONTENT, AND NO KNOWLEDGE NODE ────────────── */
  {
    const code = codeOf(read(AUTHORITY));
    assert.ok(
      !/knowledgeNodes/.test(code),
      "the reference authority must never name the knowledge nodes table — K3 stays intact",
    );
    assert.ok(
      !/durable-knowledge-writer|knowledge-supersede|knowledge-create|retract-source|ratify-version/.test(code),
      "and must import no Knowledge content writer",
    );
    /*
     * IT READS `knowledge_facts` AND WRITES ONLY ITS OWN TABLE. Asserted as an exact set, so a
     * later edit that starts updating the fact registry has to be stated here first.
     */
    const written = [...code.matchAll(/\.(?:insert|update|delete)\(\s*([A-Za-z0-9_$]+)\s*\)/g)].map((m) => m[1]!);
    assert.deepEqual(
      [...new Set(written)].sort(),
      ["knowledgeExternalReferences"],
      "the ONLY table this authority writes is its own",
    );
  }

  /* ── 3. K3'S TWO EXCEPTIONS ARE STILL THE ONLY TWO ───────────────────────── */
  {
    /*
     * KR-EXT1 must not have become a third writer of `knowledge_nodes`. This asserts the same
     * property K3 asserts, from this phase's side, so a future edit here fails a suite named after
     * the phase that would have caused it.
     */
    const collect = (dir: string): string[] =>
      readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return collect(p);
        return e.isFile() && /\.tsx?$/.test(p) ? [p] : [];
      });
    const updaters = collect("src")
      .filter((f) => !f.startsWith(path.join("src", "db", "schema")))
      .filter((f) => /\.update\(\s*knowledgeNodes\s*\)/.test(codeOf(read(f))))
      .map((f) => f.replace(/\\/g, "/"))
      .sort();
    assert.deepEqual(
      updaters,
      [
        "src/features/knowledge-ratification/ratify-version.server.ts",
        "src/features/knowledge/retract-source.server.ts",
      ],
      "only ratification and retraction update a knowledge node — KR-EXT1 added no third writer",
    );
  }

  /* ── 4. GOVERNANCE WAS NOT WIDENED ───────────────────────────────────────── */
  {
    assert.deepEqual(
      [...GOVERNANCE_SUBJECT_TYPES],
      ["knowledge_node", "work_artifact_revision"],
      "Governance still addresses the Knowledge node and never the provider record",
    );
    const code = codeOf(read(AUTHORITY));
    assert.ok(
      !/decisionRecords|governanceSessions|GOVERNANCE_SUBJECT_TYPES/.test(code),
      "and the reference authority decides no Governance",
    );
  }

  /* ── 5. THE TABLE STORES A REFERENCE, NEVER A PROVIDER RECORD ────────────── */
  {
    /*
     * THE COLUMN SET IS PINNED EXACTLY. This is the structural half of "a reference is not a copy":
     * there is no column a name, a payload, a status, a URL, a timestamp of the provider's own, or a
     * credential could be written into, so the leak is unrepresentable rather than merely avoided.
     */
    const columns = Object.keys(getTableColumns(knowledgeExternalReferences));
    assert.deepEqual(
      columns.sort(),
      [
        "capability",
        "declaredAt",
        "declaredBy",
        "declaredByType",
        "id",
        "knowledgeFactId",
        "providerKey",
        "recordId",
        "recordType",
        "tenantId",
        "withdrawnAt",
        "withdrawnBy",
        "withdrawnByType",
      ],
      "the reference table's columns are exactly these — adding one is a deliberate edit here",
    );

    const schema = read(SCHEMA);
    for (const forbidden of [
      "fullName",
      "full_name",
      "displayName",
      "payload",
      "response",
      "html_url",
      "url",
      "token",
      "secret",
      "credential",
      "health",
      "status",
      "cached",
      "synced",
    ]) {
      assert.ok(
        !new RegExp(`"${forbidden}"`).test(schema),
        `the reference table must not carry a "${forbidden}" column — it stores a reference, not a record`,
      );
    }
  }

  /* ── 6. THE CONTRACT HAS NO FIELD FOR A NAME, A SECRET, OR A TENANT ──────── */
  {
    const code = codeOf(read(CONTRACTS));
    const shape = code.slice(code.indexOf("export interface ExternalSystemReference"));
    const body = shape.slice(0, shape.indexOf("}"));
    for (const forbidden of ["name", "label", "url", "token", "secret", "tenant", "actor", "payload"]) {
      assert.ok(
        !new RegExp(`readonly\\s+\\w*${forbidden}`, "i").test(body),
        `ExternalSystemReference must have no "${forbidden}" field`,
      );
    }
    assert.ok(!/fetch|process\.env|apiKey/.test(code), "and the contract module reaches nothing");
  }

  /* ── 7. THE MIGRATION IS ADDITIVE AND TOUCHES NO PROTECTED AUTHORITY ─────── */
  {
    const file = readdirSync(path.join(ROOT, MIGRATION_DIR)).find((f) =>
      f.endsWith("_kr_ext1_knowledge_external_references.sql"),
    );
    assert.ok(file, "the KR-EXT1 migration exists");
    const sql = read(path.join(MIGRATION_DIR, file!));

    assert.equal((sql.match(/CREATE TABLE/g) ?? []).length, 1, "exactly one table is created");
    assert.ok(!/\bDROP\b/i.test(sql), "the migration drops nothing");
    assert.ok(!/knowledge_nodes/.test(sql), "and never touches knowledge_nodes");
    assert.ok(!/decision_records|governance_sessions/.test(sql), "and never touches Governance");
    assert.ok(!/\bintegrations\b|integration_credentials/.test(sql), "and never touches an integration table");
    assert.ok(!/INSERT INTO/i.test(sql), "and backfills nothing — no reference is fabricated");

    /*
     * THE ONLY STATEMENT REACHING AN EXISTING TABLE is the composite index a tenant-safe foreign key
     * needs. It adds no uniqueness (`id` is already the primary key) and changes nothing about what
     * a fact IS. Pinned, so a future edit to this migration has to say what else it touched.
     */
    const foreignStatements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.includes("knowledge_external_references"));
    assert.deepEqual(
      foreignStatements.map((s) => s.split("\n")[0]!.replace(/;$/, "")),
      [
        'CREATE UNIQUE INDEX "knowledge_facts_id_tenant_uidx" ON "knowledge_facts" USING btree ("id","tenant_id")',
      ],
      "exactly one statement reaches an existing table, and it is the composite index",
    );

    /* ORDERING IS LOAD-BEARING: the index must exist before a foreign key can reference it. */
    assert.ok(
      sql.indexOf("knowledge_facts_id_tenant_uidx") < sql.indexOf("knowledge_external_references_tenant_fact_fk"),
      "the composite index precedes the foreign key that requires it, or the migration fails to apply",
    );
  }

  /* ── 8. THE HUMAN-DECLARER RULE IS IN THE SCHEMA, NOT ONLY THE WRITER ───── */
  {
    const sql = read(
      path.join(
        MIGRATION_DIR,
        readdirSync(path.join(ROOT, MIGRATION_DIR)).find((f) =>
          f.endsWith("_kr_ext1_knowledge_external_references.sql"),
        )!,
      ),
    );
    assert.match(
      sql,
      /knowledge_external_references_human_declarer_chk[\s\S]*declared_by_type" = 'human'/,
      "the database itself refuses a non-human declarer — the model can never author this relationship",
    );
    assert.match(sql, /knowledge_external_references_withdrawal_pair_chk/, "and both-or-neither on withdrawal");
    assert.match(sql, /knowledge_external_references_bounded_identity_chk/, "and bounded identifiers");
    assert.match(sql, /WHERE "knowledge_external_references"\."withdrawn_at" is null/, "and PARTIAL uniqueness");
  }

  /* ── 9. THE CLOSED KIND LIST STILL MATCHES THE PROVIDER MODULES ─────────── */
  {
    /*
     * The Knowledge UI names provider and capability keys as CONSTANTS rather than reading the
     * provider catalog — the I1 firewall forbids Knowledge from reaching it. Duplication is only
     * safe while it cannot drift, so this asserts the two spellings against the modules that own
     * them. A provider key that changed and left this list behind would silently produce references
     * that no join can ever match.
     */
    const github = EXTERNAL_RECORD_KINDS.find((k) => k.id === "github-repository");
    assert.ok(github, "the GitHub repository kind exists");
    assert.equal(github!.providerKey, GITHUB_PROVIDER_KEY, "the provider key is the released one");
    assert.equal(
      github!.capability,
      GITHUB_REPOSITORY_ACTIVITY_CAPABILITY,
      "and the capability key is the released one",
    );

    /* And the rendered identity is the one INT-5B1 accepted in production. */
    assert.equal(
      renderExternalReference({ ...github!, recordId: "1300480452" }),
      "integrations/github-organization/github.repository.activity.read/repository/1300480452",
    );

    /* NO KIND MAY OFFER A NAME AS THE THING A HUMAN SUPPLIES. */
    for (const kind of EXTERNAL_RECORD_KINDS) {
      assert.ok(
        !/name/i.test(kind.recordIdLabel),
        `${kind.id}: the supplied value must be an id, never a name`,
      );
      assert.match(kind.recordIdHint, /[Nn]ot the name/, `${kind.id}: and the hint says so`);
    }
  }

  /* ── 10. THE UI SAYS WHAT IT IS, AND WHAT IT IS NOT ──────────────────────── */
  {
    const ui = read("src/components/knowledge-workspace/knowledge-external-references.tsx");

    /* The panel must state the four things a reader would otherwise wrongly assume. */
    for (const [claim, pattern] of [
      ["it is the organization's own statement", /organization&rsquo;s own statement/],
      ["no provider data is imported", /imports no provider data/],
      ["nothing is checked with the provider", /checks nothing with the provider/],
      ["withdrawal removes the relationship only", /never the repository/],
    ] as const) {
      assert.match(ui, pattern, `the panel must state that ${claim}`);
    }

    /* WORDS THAT WOULD PROMISE SOMETHING HEBUN DOES NOT DO. */
    const rendered = codeOf(ui);
    for (const forbidden of ["Import", "Sync", "Connect ", "Refresh", "Verify", "Validate"]) {
      assert.ok(
        !new RegExp(`>\\s*${forbidden}`).test(rendered) && !rendered.includes(`"${forbidden}"`),
        `the panel must not offer "${forbidden}" — it does none of those things`,
      );
    }

    /* AND IT REACHES NO PROVIDER. The Knowledge workspace gains no provider read from this phase. */
    for (const forbidden of ["provider-github", "provider-google", "integration-authority", "provider-catalog", "fetch("]) {
      assert.ok(!ui.includes(forbidden), `the panel must not reference "${forbidden}"`);
    }
  }

  console.log("kr-ext1-flow/boundaries-and-firewall: OK");
}

main();
