/*
 * RELEVANCE-1 — source-level boundaries of the experiment.
 *
 * The experiment is not wired into runtime, reaches no provider (its live model judge is retired by
 * APF-5), reads no credential, and leaves the shared relevance contract and the RELEVANCE-0 benchmark
 * untouched.
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
  /*
   * APF-5 — the live model judge is retired: it reached Anthropic outside the governed generator.
   * Nothing in the experiment selects a transport, reads a credential or an env file, and no script
   * in the repository can obtain the live transport at all (section 6).
   */
  for (const file of files) {
    const code = codeOf(read(file));
    assert.ok(!code.includes("selectModelTransport"), `${file} selects no transport`);
    assert.ok(!code.includes("process.env"), `${file} reads no environment`);
    assert.ok(!/\.env(\.|")/.test(code), `${file} reads no env file`);
    assert.ok(!code.includes("ANTHROPIC_API_KEY"), `${file} names no credential`);
  }
  assert.ok(run.includes("the live model judge is retired (APF-5)"), "--judge model refuses before anything is read");

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

  /* ── 6. APF-5: no script reaches the live Anthropic transport except through the generator ── */
  for (const file of collect("scripts")) {
    const code = codeOf(read(file));
    for (const banned of ["selectModelTransport", "createLiveClaudeTransport", "claude-http-transport"]) {
      assert.ok(!code.includes(banned), `${file} must not reach the live transport (${banned}) outside the governed generator`);
    }
  }

  console.log("PASS relevance-1 boundaries");
}

main();
