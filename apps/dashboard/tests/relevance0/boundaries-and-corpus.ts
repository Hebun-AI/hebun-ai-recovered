/*
 * RELEVANCE-0 — source-level boundaries and corpus integrity.
 *
 * The KR3 firewall (`tests/kr3-flow/boundaries-and-firewall.ts`) already holds every file in
 * `src/features/knowledge-retrieval` to "no writes, no schema, no vectors, no provider". The relevance
 * module lives there, so it inherits that firewall rather than getting a parallel one. This file adds
 * only what RELEVANCE-0 itself claims: the module is pure and NOT WIRED, the benchmark reaches no
 * provider, and the corpus is synthetic, internally consistent and keeps eligibility apart from gold.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  ELIGIBILITY,
  FACTS,
  OTHER_TENANT_FACTS,
  QUERIES,
  SUPERSEDED,
  SYNTHETIC_BENCHMARK,
  SYNTHETIC_ORGANIZATION,
  type QueryClass,
} from "../../scripts/relevance-benchmark/corpus";
import { fixtureEligibility } from "../../scripts/relevance-benchmark/engine";

const RELEVANCE = "src/features/knowledge-retrieval/relevance.ts";
const BENCH_DIR = "scripts/relevance-benchmark";

const read = (file: string) => readFileSync(file, "utf8");
const codeOf = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
function collect(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return collect(path);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}
const importsOf = (code: string) => [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);

function main(): void {
  /* ── 1. the relevance module is pure ───────────────────────────────────── */
  {
    const code = codeOf(read(RELEVANCE));
    assert.deepEqual(
      importsOf(code).sort(),
      ["./contracts"],
      "relevance imports only the retrieval contracts",
    );
    for (const banned of ["process.env", "fetch(", "@/db", "drizzle", "\"pg\"", "server-only", "heby-model", "provider", "Date(", ".insert(", ".update(", ".delete("]) {
      assert.ok(!code.includes(banned), `relevance.ts must not contain ${banned}`);
    }
  }

  /* ── 2. NOT WIRED: no runtime file reaches the contract or the benchmark ── */
  {
    const runtime = [...collect("src/app"), ...collect("src/features"), ...collect("src/components"), ...collect("src/lib")].filter((f) => f !== RELEVANCE);
    for (const file of runtime) {
      const imports = importsOf(codeOf(read(file)));
      assert.ok(!imports.some((i) => /knowledge-retrieval\/relevance$/.test(i)), `${file} imports the relevance contract — RELEVANCE-0 wires nothing`);
      assert.ok(!imports.some((i) => i.includes("relevance-benchmark")), `${file} imports benchmark fixtures — fixtures are not organizational data`);
    }
    assert.ok(!/relevance/.test(codeOf(read("src/features/knowledge-retrieval/index.ts"))), "the retrieval index does not export the contract yet");
  }

  /* ── 3. the benchmark reaches no provider and no non-disposable database ── */
  {
    for (const file of collect(BENCH_DIR)) {
      const code = codeOf(read(file));
      for (const banned of ["fetch(", "heby-model", "claude", "anthropic", "openai", "process.env", "getControlPlaneDb", "resolveKnowledgeRepoOrNull", "child_process"]) {
        assert.ok(!code.toLowerCase().includes(banned.toLowerCase()), `${file} must not reach ${banned}`);
      }
    }
    const run = codeOf(read(join(BENCH_DIR, "run.ts")));
    assert.ok(run.includes("createDisposablePostgresHarness") && run.includes("dropDatabase"), "the benchmark runs on a disposable database it drops");
  }

  /* ── 4. the corpus is synthetic and says so ─────────────────────────────── */
  {
    assert.equal(SYNTHETIC_BENCHMARK, true);
    assert.ok(read(join(BENCH_DIR, "corpus.ts")).includes("SYNTHETIC BENCHMARK DATA — NOT ORGANIZATIONAL TRUTH"));
    const everything = JSON.stringify({ FACTS, SUPERSEDED, OTHER_TENANT_FACTS, QUERIES });
    for (const real of ["Turkish Rug House", "9947c78e", "trh-", "hebuntech"]) {
      assert.ok(!everything.includes(real), `the corpus must not carry real organizational data (${real})`);
    }
    for (const fact of [...FACTS, ...OTHER_TENANT_FACTS]) {
      assert.ok(fact.key.startsWith("z-"), `${fact.key} carries the synthetic key prefix`);
    }
    assert.ok(
      FACTS.filter((f) => f.statement.includes(SYNTHETIC_ORGANIZATION)).length >= 8,
      "the organization name recurs across many facts — the company-name distractor is real",
    );
  }

  /* ── 5. corpus consistency ─────────────────────────────────────────────── */
  {
    const keys = FACTS.map((f) => f.key);
    assert.equal(new Set(keys).size, keys.length, "fact keys are unique");
    assert.deepEqual(Object.keys(ELIGIBILITY).sort(), [...keys].sort(), "every fact has exactly one eligibility fixture");
    for (const q of QUERIES) for (const g of q.gold) assert.ok(keys.includes(g), `${q.id} gold ${g} is a fact`);
    assert.equal(new Set(QUERIES.map((q) => q.id)).size, QUERIES.length, "task ids are unique");
    for (const s of SUPERSEDED) assert.ok(keys.includes(s.factKey), `superseded ${s.factKey} belongs to a fact`);
    for (const [key, e] of Object.entries(ELIGIBILITY)) {
      if (e.rejected) assert.equal(e.publicUse, "unknown", `${key}: a truth-rejected version cannot hold a public-use decision`);
    }
  }

  /* ── 6. coverage of every required class, both directions of language ──── */
  {
    const required: QueryClass[] = [
      "tr-to-tr", "en-to-tr", "tr-to-en", "paraphrase", "low-overlap", "company-name", "generic-noise",
      "multi-relevant", "no-relevant", "internal-distractor", "superseded", "rejected",
      "public-use-unknown", "public-use-denied", "public-use-allowed", "unratified", "voice-only",
    ];
    const present = new Set(QUERIES.flatMap((q) => q.classes));
    for (const cls of required) assert.ok(present.has(cls), `the corpus covers ${cls}`);
    assert.ok(FACTS.some((f) => f.lang === "en") && FACTS.some((f) => f.lang === "tr"), "bilingual facts");
    assert.ok(QUERIES.some((q) => q.grounding === "no-organizational-facts-required"), "tasks that need no organizational facts exist");
    assert.ok(QUERIES.some((q) => q.gold.length === 0 && q.grounding === "organizational-facts-required"), "tasks that need facts nobody holds exist");
  }

  /* ── 7. eligibility and relevance are kept apart, and the gap is testable ── */
  {
    const relevantButDenied = QUERIES.filter((q) => q.gold.some((g) => ELIGIBILITY[g]!.publicUse === "denied"));
    assert.ok(relevantButDenied.length > 0, "some task has a DENIED fact as genuinely relevant");
    const relevantButUnknown = QUERIES.filter((q) => q.gold.some((g) => ELIGIBILITY[g]!.publicUse === "unknown" && !ELIGIBILITY[g]!.rejected));
    assert.ok(relevantButUnknown.length > 0, "some task has an UNKNOWN fact as genuinely relevant");
    assert.ok(QUERIES.some((q) => q.gold.some((g) => ELIGIBILITY[g]!.rejected)), "some task has a rejected fact as relevant");
    assert.ok(Object.values(ELIGIBILITY).some((e) => !e.ratified && e.publicUse === "allowed"), "an ALLOWED but unratified fact exists");
    const corpusSource = codeOf(read(join(BENCH_DIR, "corpus.ts")));
    assert.ok(!/gold[^\n]*publicUse|publicUse[^\n]*gold/.test(corpusSource), "gold labels do not reference eligibility");
  }

  /* ── 8. the benchmark's stand-in gate: internal unchanged, public needs RATIFIED + ALLOWED ── */
  {
    const all = FACTS.map((f) => ({ factKey: f.key }));
    const internal = fixtureEligibility("internal-answer", all);
    assert.equal(internal.eligible.length, FACTS.length, "internal-answer adds no condition");
    const pub = fixtureEligibility("public-content-grounding", all);
    const reasonOf = (key: string) => pub.withheld.find((w) => w.key === key)?.reason ?? null;
    assert.equal(reasonOf("z-products"), null, "ratified + allowed participates");
    assert.equal(reasonOf("z-sourcing"), "public-use-denied");
    assert.equal(reasonOf("z-returns"), "public-use-unknown", "no decision is not permission");
    assert.equal(reasonOf("z-custom"), "not-ratified", "allowed without truth does not ground");
    assert.equal(reasonOf("z-heritage"), "not-ratified", "a rejected version is withheld (and is excluded upstream before this)");
    for (const w of pub.withheld) assert.ok(!pub.eligible.some((e) => e.factKey === w.key), `${w.key} is withheld XOR eligible`);
    assert.ok(!/public-use|publicUse|PublicUse/.test(codeOf(read(RELEVANCE))), "the relevance contract itself knows nothing of public use (KT-3 firewall)");
  }

  console.log("PASS relevance-0 boundaries and corpus");
}

main();
