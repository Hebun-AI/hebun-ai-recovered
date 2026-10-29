/*
 * RA-EAI-1 — the research purpose and its one platform cell, as pure contracts.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "`research` is a purpose; exactly one platform cell names it — anthropic/messages × research ×
 *    conversation — and every other research pair is UNKNOWN (never allowed); the earlier purposes'
 *    cells are unchanged; the research capability declares exactly that disclosure and is still
 *    performed by nothing; no source file reaches a model, a writer or a web-search transport for it."
 *
 * No database, no provider, no network.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { DATA_CLASSES, PURPOSES } from "../../src/features/external-ai-data-use/contracts";
import { EXTERNAL_AI_PURPOSES_SQL } from "../../src/db/schema/external-ai-data-use";
import {
  decidePlatformDisclosure,
  RECORDED_PLATFORM_DISCLOSURE_POLICY,
} from "../../src/features/external-ai-data-use/platform-disclosure-policy";
import { agentWorkCapability } from "../../src/features/agent-work/capabilities";
import { AGENT_PREPARATION_KINDS } from "../../src/features/agent-mandate/contracts";

const SCOPE = "anthropic/messages" as const;

/* ── E1 · the vocabulary and its SQL mirror ── */
assert.deepEqual([...PURPOSES], ["assistance", "relevance-selection", "agent-origination", "media-generation", "work-planning", "research"]);
assert.deepEqual([...EXTERNAL_AI_PURPOSES_SQL], [...PURPOSES], "the SQL mirror is the vocabulary");

/* ── E2 · exactly one research cell ── */
const research = RECORDED_PLATFORM_DISCLOSURE_POLICY.allowedCells.filter((c) => c.purpose === "research");
assert.equal(research.length, 1, "one research cell");
assert.deepEqual([research[0]!.serviceScope, research[0]!.purpose, research[0]!.dataClass], [SCOPE, "research", "conversation"]);
assert.match(research[0]!.evidence, /web-search tool is NOT covered/, "the evidence says web search is not authorized");
assert.equal(decidePlatformDisclosure({ serviceScope: SCOPE, purpose: "research", dataClass: "conversation" }).decision, "allowed");

/* ── E3 · every other research pair is unknown, on every scope; a denied scope stays denied ── */
for (const dataClass of DATA_CLASSES.filter((c) => c !== "conversation")) {
  assert.equal(decidePlatformDisclosure({ serviceScope: SCOPE, purpose: "research", dataClass }).decision, "unknown", `research × ${dataClass}`);
}
for (const serviceScope of ["openai/images.generations", "openai/images.edits"] as const) {
  assert.equal(decidePlatformDisclosure({ serviceScope, purpose: "research", dataClass: "conversation" }).decision, "unknown", serviceScope);
}
assert.equal(
  decidePlatformDisclosure({ serviceScope: "higgsfield/pixverse-v6/text-to-video", purpose: "research", dataClass: "conversation" }).decision,
  "denied",
);

/* ── E7 · the earlier cells are exactly what they were ── */
assert.deepEqual(
  RECORDED_PLATFORM_DISCLOSURE_POLICY.allowedCells.filter((c) => c.purpose !== "research").map((c) => `${c.serviceScope}|${c.purpose}|${c.dataClass}`),
  [
    "anthropic/messages|assistance|conversation",
    "anthropic/messages|assistance|knowledge",
    "anthropic/messages|assistance|work-artifact",
    "anthropic/messages|agent-origination|conversation",
    "anthropic/messages|agent-origination|organization",
    "anthropic/messages|agent-origination|knowledge",
    "anthropic/messages|work-planning|operational-record",
  ],
);
assert.equal(research[0]!.bounds, RECORDED_PLATFORM_DISCLOSURE_POLICY.allowedCells[0]!.bounds, "the research cell shares the Anthropic bounds, not wider ones");

/* ── E8 · E9 · the capability declares the cell and is still performed by nothing ── */
const capability = agentWorkCapability("prepare-research-report");
assert.deepEqual(capability.dataUse, { purpose: "research", dataClasses: ["conversation"] });
assert.equal(capability.sideEffect, "PREPARATION_ONLY");
assert.equal(capability.authorizationRequired, false);
assert.match(capability.performedBy, /^no seam yet/);
assert.deepEqual([...capability.mandateKindsAnyOf], ["prepare-research"]);
assert.deepEqual([...AGENT_PREPARATION_KINDS], ["prepare-research"], "no new mandate kind");

/* ── E10 · E11 · nothing in src performs research, calls a model for it, writes a report or searches the web ── */
const SRC = path.resolve(__dirname, "../../src");
const files: string[] = [];
const walk = (dir: string): void => {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(name)) files.push(full);
  }
};
walk(SRC);
const rel = (f: string) => path.relative(SRC, f);
const naming = (needle: RegExp) => files.filter((f) => needle.test(readFileSync(f, "utf8"))).map(rel).sort();
/* `"research"` alone also names unrelated pre-existing values (a department owner, a memory kind, an agent role); the PURPOSE is matched by its use. */
assert.deepEqual(naming(/purpose: "research"|"work-planning", "research"\]/), [
  "db/schema/external-ai-data-use.ts",
  "features/agent-work/capabilities.ts",
  "features/external-ai-data-use/contracts.ts",
  "features/external-ai-data-use/platform-disclosure-policy.ts",
], "the research purpose is named only by its vocabulary, its mirror, its cell and its declaration");
/* The contracts that name it in prose (P1's enum, mandate and artifact-type comments) are not seams. */
assert.deepEqual(
  naming(/prepare-research-report/),
  ["db/schema/_enums.ts", "features/agent-mandate/contracts.ts", "features/agent-work/capabilities.ts", "features/work-artifacts/contracts.ts"],
  "no seam names the capability",
);
assert.deepEqual(naming(/web_search|web-search_|webSearch/), [], "no web-search transport exists");

console.log("PASS ra-eai-1 policy-and-boundary");
