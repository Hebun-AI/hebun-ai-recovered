/*
 * EVIDENCE-DECISION-BRIEF-1 — the pure brief and the boundary around it.
 *
 *   A. Registry: an available, model-free, execution-free READ in the Knowledge family.
 *   B. Rules: each consideration fires on its own fact and only then; a confirmed record is the only
 *      verified evidence; nothing in the brief recommends, scores or claims a conflict.
 *   C. Reach: what `/brief` adds reaches no model, transport, provider, EAI or writer module (walker
 *      with a positive control and a bite-proof), so no organizational evidence can leave Hebun.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { findHebyCommandById } from "../../src/features/heby-commands";
import { renderDecisionBrief, type BriefRecord } from "../../src/features/heby-commands/decision-brief";
import type { KnowledgeSourceRecord } from "../../src/features/knowledge/contracts";

const rec = (factKey: string, over: Partial<KnowledgeSourceRecord> = {}): KnowledgeSourceRecord =>
  ({
    factKey, title: `T ${factKey}`, domainKey: "policies", scope: "company-wide", statement: `S ${factKey}`,
    lifecycleStatus: "draft", authorityClass: "authoritative", freshness: "within-cadence", ...over,
  }) as KnowledgeSourceRecord;
const item = (record: KnowledgeSourceRecord, confirmed: boolean, unconfirmedClaim = false): BriefRecord => ({
  record, confirmed, unconfirmedClaim, standingLine: confirmed ? "STANDING-CONFIRMED" : unconfirmedClaim ? "STANDING-UNCONFIRMED" : "STANDING-NONE",
});
const text = (lines: readonly string[]) => lines.join("\n");
const consider = (body: string) => body.slice(body.indexOf("E. Decision"), body.indexOf("F. Limitations"));

function resolveModule(fromFile: string, specifier: string): string | null {
  const base = specifier.startsWith("@/") ? join("src", specifier.slice(2)) : specifier.startsWith(".") ? join(dirname(fromFile), specifier) : null;
  if (base === null) return null;
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) if (existsSync(candidate)) return candidate;
  throw new Error(`unresolved local specifier ${specifier} from ${fromFile}`);
}
function valueImports(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return [
    ...code.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm),
    ...code.matchAll(/^import\s+["']([^"']+)["']/gm),
    ...code.matchAll(/\b(?:import|require)\(\s*["']([^"']+)["']\s*\)/g),
  ].map((m) => m[1]!);
}
function reach(entry: string, extra = ""): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const s of valueImports(readFileSync(file, "utf8") + (file === entry ? `\n${extra}` : ""))) {
      const r = resolveModule(file, s);
      if (r) stack.push(r);
    }
  }
  return seen;
}
const FORBIDDEN =
  /^src\/features\/.*(heby-model|anthropic|transport|external-ai-data-use|provider-(github|google|instagram|youtube|content-admission)|knowledge-create|knowledge-supersede|durable-knowledge-writer|ratify-version|governance-decision\/(bootstrap|write))/;
const forbiddenIn = (files: Set<string>) => [...files].filter((f) => FORBIDDEN.test(f));

/* ── A ── */
{
  const brief = findHebyCommandById("brief")!;
  assert.equal(brief.kind, "read");
  assert.equal(brief.category, "knowledge");
  assert.equal(brief.availability, "available");
  assert.equal(brief.requiresModel, false, "no model is asked, so no EAI authorization is needed or used");
  assert.equal(brief.requiresExecution, false);
  assert.equal(brief.safeWhenProviderOff, true);
  assert.match(brief.description, /deterministic, no AI/);
}

/* ── B ── */
{
  const confirmed = rec("c");
  const body = text(renderDecisionBrief("q", {
    kind: "matched",
    records: [item(confirmed, true), item(rec("u"), false, true), item(rec("n"), false)],
    excluded: [], more: false, multipleSourcesOneArea: false, degradedReason: null,
  }));
  const B = body.slice(body.indexOf("B. Verified"), body.indexOf("C. Unverified"));
  assert.ok(B.includes("1. c — T c") && !B.includes(" u — ") && !B.includes(" n — "), "only the confirmed record is verified");
  assert.ok(B.includes("STANDING-CONFIRMED") && B.includes("Source: /source c"));
  assert.match(consider(body), /1 record claims a Governance decision that Governance does not hold/);
  assert.match(consider(body), /1 relevant record has no Governance decision/);
  assert.ok(!/No Governance-confirmed record addresses/.test(body));
  assert.ok(!/review date|no effective or review dates|provisional|not in force|Several sources|More records matched/.test(consider(body)), "no rule fires without its fact");

  const noneBody = text(renderDecisionBrief("q", {
    kind: "matched",
    records: [item(rec("o", { freshness: "review-overdue", authorityClass: "provisional" }), true), item(rec("x", { freshness: "unknown" }), false)],
    excluded: [{ reason: "expired" }], more: true, multipleSourcesOneArea: true, degradedReason: "DEGRADED-REASON",
  }));
  const E = consider(noneBody);
  for (const fired of [/past its review date/, /no effective or review dates/, /classed provisional/, /Several sources in one area/, /not in force/, /More records matched than are shown/]) {
    assert.match(E, fired);
  }
  assert.match(noneBody, /Limits: provisional, not authoritative; past its review date\./, "a confirmed record still states its limits");
  assert.match(noneBody, /D\. Missing[\s\S]*Matched but not served: 1 — 1 expired\.[\s\S]*DEGRADED-REASON/);

  const empty = text(renderDecisionBrief("q", { kind: "no-match", excluded: [], degradedReason: null }));
  assert.match(empty, /Governance-confirmed \(0\)\n  None\./);
  assert.match(consider(empty), /No Governance-confirmed record addresses this question/);

  for (const b of [body, noneBody, empty]) {
    for (const banned of [/\brecommend(?!ation, and not)/i, /\byou should\b/i, /confidence/i, /\bscore\b/i, /contradict/i, /\bconflict(?!s have not been evaluated)/i, /approved fact/i]) {
      assert.ok(!banned.test(b.replace("never an approved fact", "")), `${banned} is not in the brief`);
    }
  }
}

/* ── C ── */
{
  const READS = "src/features/heby-commands/read-commands.server.ts";
  const added = valueImports(readFileSync(READS, "utf8")).filter((s) =>
    ["./decision-brief", "@/features/heby-answer/knowledge-evidence.server", "@/features/knowledge-retrieval", "@/features/knowledge/knowledge-read.server"].includes(s),
  );
  assert.equal(added.length, 4, "the walk covers exactly what /brief reads through");
  for (const s of added) assert.deepEqual(forbiddenIn(reach(resolveModule(READS, s)!)), [], `${s} reaches no model, transport, provider, EAI or writer`);
  assert.ok(forbiddenIn(reach("src/features/heby-answer/model-answer.server.ts")).some((f) => f.includes("heby-model")), "positive control: the walker sees a model where one is reachable");
  assert.ok(forbiddenIn(reach("src/features/heby-commands/decision-brief.ts", `import "@/features/heby-model";`)).length > 0, "bite-proof: a model import is caught");
}

console.log("evidence-decision-brief-1 render + firewall checks passed");
