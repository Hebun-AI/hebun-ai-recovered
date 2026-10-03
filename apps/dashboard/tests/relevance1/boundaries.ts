/*
 * RELEVANCE-1 — source-level boundaries of the experiment.
 *
 * The experiment is not wired into runtime, adds no provider authority (it takes its transport from
 * `selectModelTransport`, the repository's one selection seam), reads only the developer env file's
 * two model keys, and leaves the shared relevance contract and the RELEVANCE-0 benchmark untouched.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const EXP = "scripts/relevance-experiment";
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
  /* ── 1. not wired: no runtime file reaches the experiment ─────────────── */
  for (const file of [...collect("src/app"), ...collect("src/features"), ...collect("src/components"), ...collect("src/lib")]) {
    assert.ok(!importsOf(codeOf(read(file))).some((i) => i.includes("relevance-experiment")), `${file} imports the experiment`);
  }

  /* ── 2. no second provider authority ───────────────────────────────────── */
  const files = collect(EXP);
  const all = files.map((f) => codeOf(read(f))).join("\n");
  assert.ok(!all.includes("createLiveClaudeTransport"), "the experiment never constructs a live transport itself");
  assert.ok(!/\bfetch\(/.test(all), "no direct network call");
  assert.ok(!all.includes("heby-model-live"), "no import of the live transport module");
  const run = codeOf(read(join(EXP, "run.ts")));
  assert.ok(run.includes("selectModelTransport("), "the transport comes from the one selection authority");
  for (const file of files.filter((f) => !f.endsWith("run.ts"))) {
    assert.ok(!codeOf(read(file)).includes("selectModelTransport"), `${file} does not select a transport`);
    assert.ok(!codeOf(read(file)).includes("process.env"), `${file} reads no environment`);
  }

  /* ── 3. env: the developer file, two keys, and the budget the authority defines ── */
  assert.deepEqual([...run.matchAll(/["'](\/[^"']*\.env[^"']*)["']/g)].map((m) => m[1]), ["/Users/senolsevim/Developer/Hebun AI/apps/dashboard/.env.local"]);
  assert.ok(!/\.env\.(production|ceremony|hosted)/.test(run), "no production or ceremony env file");
  assert.deepEqual([...run.matchAll(/readDevValue\(raw, "([A-Z_]+)"\)/g)].map((m) => m[1]).sort(), ["ANTHROPIC_API_KEY", "HEBUN_MODEL_ID"]);
  assert.deepEqual([...run.matchAll(/process\.env\.([A-Z_]+)\s*=/g)].map((m) => m[1]), ["HEBUN_MODEL_LIVE_CALL_BUDGET"], "the only env write is the existing budget key");
  assert.ok(/PROCESS_LIVE_CALL_BUDGET = 100\b/.test(run), "the budget is the authority's documented maximum, not above it");
  assert.ok(run.includes("assertSyntheticRequest(request)"), "every request passes the synthetic guard");
  assert.ok(!/console\.log\([^)]*apiKey/.test(run), "the credential is never printed");

  /* ── 4. the experiment writes no Knowledge, Governance or action record ── */
  for (const file of files) {
    const code = codeOf(read(file));
    for (const banned of [".insert(", ".update(", ".delete(", "writeGovernanceDecision", "recordKnowledgeMutation", "createActionRequest", "issuePermit"]) {
      assert.ok(!code.includes(banned), `${file} must not contain ${banned}`);
    }
  }

  /* ── 5. the shared contract stays provider-neutral and unwired ─────────── */
  const contract = codeOf(read("src/features/knowledge-retrieval/relevance.ts"));
  for (const banned of ["claude", "anthropic", "haiku", "model-judge", "relevance-experiment"]) {
    assert.ok(!contract.toLowerCase().includes(banned), `the shared contract names no ${banned}`);
  }

  console.log("PASS relevance-1 boundaries");
}

main();
