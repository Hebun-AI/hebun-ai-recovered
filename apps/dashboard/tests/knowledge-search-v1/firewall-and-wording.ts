/*
 * KNOWLEDGE-SEARCH-V1 — what `/search` may reach, and what it may claim.
 *
 *   A. The registry: an available, model-free, execution-free READ that names itself lexical.
 *   B. Governance standing is fail-closed and never inferred: no claim → none; a claim Governance
 *      does not hold → unconfirmed; an unanswerable or throwing read → the whole read unavailable.
 *   C. Import reach: walking the value imports `/search` adds (the KR3 seam and the shared standing
 *      read) reaches no model, transport, provider, EAI or writer module. A positive control proves
 *      the walker finds a model where one is reachable; a bite-proof proves the check fails.
 *   D. Wording: the result never claims semantic search, and `heby-commands` still never names the
 *      ratification mutation (g2/k4 hold for the new code too).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { KnowledgeSourceRecord } from "../../src/features/knowledge/contracts";
import { findHebyCommandById } from "../../src/features/heby-commands";
import {
  describeKnowledgeGovernanceStanding,
  readKnowledgeGovernanceStandings,
} from "../../src/features/heby-answer/knowledge-evidence.server";
import { findKnowledgeCapability } from "../../src/features/knowledge/capability-map";

const TENANT = { tenantId: "t" } as unknown as TenantContext;
const NODE = "11111111-1111-4111-8111-111111111111";
const DECISION = "22222222-2222-4222-8222-222222222222";
const record = (claim: string | null, node: string | null = NODE) =>
  ({ factKey: "k", ratificationDecisionId: claim, activeKnowledgeNodeId: node }) as unknown as KnowledgeSourceRecord;

/* ── value-import walker over src/ ─────────────────────────────────────────────────────────── */
function resolveModule(fromFile: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? join("src", specifier.slice(2))
    : specifier.startsWith(".")
      ? join(dirname(fromFile), specifier)
      : null;
  if (base === null) return null; // a package, not a Hebun module
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), base]) {
    if (existsSync(candidate) && candidate.match(/\.tsx?$/)) return candidate;
  }
  throw new Error(`unresolved local specifier ${specifier} from ${fromFile}`);
}
function valueImports(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  /* Static value imports and re-exports, side-effect imports, dynamic imports and require — any quote. */
  return [
    ...code.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm),
    ...code.matchAll(/^import\s+["']([^"']+)["']/gm),
    ...code.matchAll(/\b(?:import|require)\(\s*["']([^"']+)["']\s*\)/g),
  ].map((m) => m[1]!);
}
function reach(entry: string, extraSource = ""): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8") + (file === entry ? `\n${extraSource}` : "");
    for (const specifier of valueImports(source)) {
      const resolved = resolveModule(file, specifier);
      if (resolved) stack.push(resolved);
    }
  }
  return seen;
}
/* Feature modules only: `src/db/schema/*` table definitions are shared by every reader and grant nothing. */
const FORBIDDEN =
  /^src\/features\/.*(heby-model|anthropic|transport|external-ai-data-use|provider-(github|google|instagram|youtube|content-admission)|knowledge-create|knowledge-supersede|durable-knowledge-writer|ratify-version|governance-decision\/(bootstrap|write))/;
const forbiddenIn = (files: Set<string>) => [...files].filter((file) => FORBIDDEN.test(file));

async function main(): Promise<void> {
  /* ── A. registry ──────────────────────────────────────────────────────────────────────────── */
  {
    const search = findHebyCommandById("search")!;
    assert.equal(search.kind, "read");
    assert.equal(search.availability, "available");
    assert.equal(search.requiresModel, false);
    assert.equal(search.requiresExecution, false);
    assert.equal(search.safeWhenProviderOff, true);
    assert.match(search.description, /lexical, not semantic/i);
    assert.deepEqual(search.args.map((a) => [a.name, a.required]), [["query", true]]);
    assert.equal(findKnowledgeCapability("search").state, "connected");
    assert.equal(findKnowledgeCapability("semantic-retrieval").state, "not-connected");
    assert.equal(findKnowledgeCapability("embeddings").state, "not-connected");
  }

  /* ── B. Governance standing ───────────────────────────────────────────────────────────────── */
  {
    const holds = async () => ({ status: "read" as const, ratifyDecisionIds: new Set([DECISION]) as ReadonlySet<string> });
    const holdsNothing = async () => ({ status: "read" as const, ratifyDecisionIds: new Set<string>() as ReadonlySet<string> });
    let asked = 0;
    const counting = async () => {
      asked += 1;
      return holds();
    };
    assert.deepEqual(
      await readKnowledgeGovernanceStandings(TENANT, [record(DECISION), record(null), record(DECISION, null)], counting),
      { status: "read", standings: ["ratified", "none", "none"] },
    );
    assert.equal(asked, 1, "Governance is asked only about a version that claims a decision");
    assert.deepEqual(await readKnowledgeGovernanceStandings(TENANT, [record(DECISION)], holdsNothing), { status: "read", standings: ["unconfirmed"] });
    assert.deepEqual(
      await readKnowledgeGovernanceStandings(TENANT, [record(null), record(DECISION)], async () => ({ status: "unavailable" as const })),
      { status: "unavailable" },
      "one unanswerable read makes the whole read unavailable",
    );
    assert.deepEqual(
      await readKnowledgeGovernanceStandings(TENANT, [record(DECISION)], async () => {
        throw new Error("boom");
      }),
      { status: "unavailable" },
    );
    assert.match(describeKnowledgeGovernanceStanding("ratified"), /Governance holds the decision/);
    assert.match(describeKnowledgeGovernanceStanding("unconfirmed"), /NOT confirmed.*not treated as ratified/);
    assert.match(describeKnowledgeGovernanceStanding("none"), /none recorded/);
  }

  /* ── C. import reach ──────────────────────────────────────────────────────────────────────── */
  {
    const READS = "src/features/heby-commands/read-commands.server.ts";
    const added = valueImports(readFileSync(READS, "utf8")).filter((s) =>
      ["@/features/knowledge-retrieval", "@/features/heby-answer/knowledge-evidence.server", "@/features/knowledge/knowledge-read.server"].includes(s),
    );
    assert.equal(added.length, 3, "the walk covers exactly what /search imports");
    for (const specifier of added) {
      const entry = resolveModule(READS, specifier)!;
      assert.deepEqual(forbiddenIn(reach(entry)), [], `${specifier} reaches no model, transport, provider, EAI or writer`);
    }
    /* Positive control: the same walker finds the model where it is reachable. */
    assert.ok(
      forbiddenIn(reach("src/features/heby-answer/model-answer.server.ts")).some((f) => f.includes("heby-model")),
      "the walker sees the model from the model answer path",
    );
    /* Bite-proof: one added value import makes the check fail. */
    const evidence = resolveModule(READS, "@/features/heby-answer/knowledge-evidence.server")!;
    for (const mutation of [
      `import { generateHebyModelAnswer } from "@/features/heby-model";`,
      `import '@/features/heby-model';`,
      `const m = await import("@/features/heby-model");`,
      `export { generateHebyModelAnswer } from "@/features/heby-model";`,
    ]) {
      assert.ok(forbiddenIn(reach(evidence, mutation)).length > 0, `bite-proof: ${mutation} is caught`);
    }
    /* And nothing model-facing reads the search command's output. */
    const HOOK = readFileSync("src/components/layout/heby/use-heby-conversation.ts", "utf8");
    assert.ok(/askHebyAction\(\{ prompt, route: contextRoute, conversationId: prior \}\)/.test(HOOK), "the only model crossing carries no command output");
  }

  /* ── D. wording ───────────────────────────────────────────────────────────────────────────── */
  {
    const READS = readFileSync("src/features/heby-commands/read-commands.server.ts", "utf8");
    const handler = READS.slice(READS.indexOf('case "search": {'), READS.indexOf('case "knowledge": {'));
    assert.ok(handler.length > 0);
    assert.ok(!/semantic|embedding|by meaning\b(?! —)/i.test(handler.replace(/not by meaning/g, "")), "the search output claims no semantic capability");
    assert.match(READS, /Lexical search: records are matched and ordered by the words they share/);
    const commandFiles = readdirSync("src/features/heby-commands").map((f) => join("src/features/heby-commands", f));
    assert.deepEqual(commandFiles.filter((f) => /ratif|\/reject|\/approve/i.test(readFileSync(f, "utf8"))), [], "no Heby command file names the ratification mutation");
    assert.ok(!existsSync("src/app/(dashboard)/search"), "no search page was added");
  }

  console.log("knowledge-search-v1 firewall + wording checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
