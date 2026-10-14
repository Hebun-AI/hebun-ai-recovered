/*
 * HEBY-GROUNDED-CONVERSATION-1 — model-facing legibility on the Heby surface.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES, with no database:
 *   "The view derives what the model received ONLY from the recorded decision; a Heby turn always
 *    states it (received / withheld / no invocation recorded / unavailable); the Knowledge evidence
 *    header never says the model used Knowledge unless the record says Knowledge was disclosed; an
 *    unsaved answer never guesses; and the surface module computes no permission of its own."
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { modelDisclosureOf, type DisclosureDecisionRecord } from "../../src/features/heby-runtime/model-disclosure";
import { buildTurns, type ThreadMessage } from "../../src/components/layout/heby/heby-thread";
import { HebyTurnList, type HebyTurnView } from "../../src/components/layout/heby/heby-turns";
import type { RetrievalEvidenceSet } from "../../src/features/knowledge-retrieval";
import type { HebyRuntimeResponse } from "../../src/features/heby-runtime";

const ROOT = path.resolve(__dirname, "../..");
const code = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const KNOWLEDGE: RetrievalEvidenceSet = {
  status: "matched",
  items: [],
  multipleRelevantSources: false,
  truncated: false,
  diversityPruned: 0,
  excludedCount: 0,
  degradedReason: null,
  unavailableReason: null,
} as unknown as RetrievalEvidenceSet;

const authorized = (declared: string[], granted: string[]): DisclosureDecisionRecord => ({
  disposition: "authorized",
  declaredDataClasses: declared,
  authorizedDataClasses: granted,
});
const render = (turns: readonly HebyTurnView[]) => renderToStaticMarkup(createElement(HebyTurnList, { turns, pending: null, asking: false }));

/* ── 1. derivation: only the recorded decision ───────────────────────────────────────────── */
const decisions = new Map<string, DisclosureDecisionRecord>([
  ["c-full", authorized(["conversation", "knowledge"], ["conversation", "knowledge"])],
  ["c-conv", authorized(["conversation", "knowledge"], ["conversation"])],
  ["c-refused", { disposition: "refused", declaredDataClasses: ["conversation", "knowledge"], authorizedDataClasses: [] }],
]);
assert.deepEqual(modelDisclosureOf({ correlationId: "c-full" }, decisions), { status: "recorded", disclosed: ["conversation", "knowledge"], withheld: [] });
assert.deepEqual(modelDisclosureOf({ correlationId: "c-conv" }, decisions), { status: "recorded", disclosed: ["conversation"], withheld: ["knowledge"] });
assert.deepEqual(modelDisclosureOf({ correlationId: null }, decisions), { status: "no-invocation-recorded" });
assert.deepEqual(modelDisclosureOf({ correlationId: "c-missing" }, decisions), { status: "unavailable" }, "no record → unavailable");
assert.deepEqual(modelDisclosureOf({ correlationId: "c-full" }, null), { status: "unavailable" }, "unreadable → unavailable");
assert.deepEqual(modelDisclosureOf({ correlationId: "c-refused" }, decisions), { status: "unavailable" }, "a refusal is not the record of a stored invocation");

/* ── 2. reloaded turns carry it; Knowledge is never implied ──────────────────────────────── */
const heby = (id: string, modelDisclosure?: ThreadMessage["modelDisclosure"]): ThreadMessage => ({
  id, role: "assistant", content: `answer ${id}`, origin: "model", transport: "live", knowledgeEvidence: KNOWLEDGE,
  ...(modelDisclosure ? { modelDisclosure } : {}),
});
const turns = buildTurns(
  [
    heby("full", modelDisclosureOf({ correlationId: "c-full" }, decisions)),
    heby("conv", modelDisclosureOf({ correlationId: "c-conv" }, decisions)),
    heby("none", { status: "no-invocation-recorded" }),
    heby("gone", { status: "unavailable" }),
    heby("legacy"),
  ],
  null,
);
const html = render(turns);
const turnHtml = (n: number) => render([turns[n]!]);

assert.match(turnHtml(0), /Recorded evidence \(0\) · sent to the model/);
assert.match(turnHtml(0), /The model received: your question and this conversation, Knowledge\./);
assert.ok(!/Withheld from the model/.test(turnHtml(0)), "nothing withheld, nothing said");

assert.match(turnHtml(1), /shown to you only, not sent to the model/, "withheld Knowledge is labelled as human-only");
assert.ok(!/· sent to the model/.test(turnHtml(1)), "never implies the model used Knowledge");
assert.match(turnHtml(1), /The model received: your question and this conversation\./);
assert.match(turnHtml(1), /Withheld from the model by your organization(&#x27;|')s AI authorization: Knowledge\./);

assert.match(turnHtml(2), /No model request is recorded for this answer\./);
assert.match(turnHtml(2), /model use not recorded/);
assert.match(turnHtml(3), /What the model received is not available for this answer\./);
assert.match(turnHtml(4), /What the model received is not available for this answer\./, "a turn with no field is unavailable, never assumed");
assert.equal((html.match(/data-model-disclosure=/g) ?? []).length, 5, "every Heby turn states it");

/* ── 3. an unsaved answer never guesses ──────────────────────────────────────────────────── */
const response = (attempted: boolean) =>
  ({ body: ["x"], evidence: [], limitations: [], origin: attempted ? "model" : "deterministic", ...(attempted ? { modelInvocationAttempted: true } : {}) }) as unknown as HebyRuntimeResponse;
const unsavedModel = buildTurns([], { userText: "q", response: response(true), durable: false }).find((t) => t.role === "heby")!;
assert.deepEqual(unsavedModel.modelDisclosure, { status: "unavailable" });
const unsavedDeterministic = buildTurns([], { userText: "q", response: response(false), durable: false }).find((t) => t.role === "heby")!;
assert.deepEqual(unsavedDeterministic.modelDisclosure, { status: "no-invocation-recorded" });

/* ── 4. the surface computes no permission ───────────────────────────────────────────────── */
for (const file of ["src/components/layout/heby/heby-turns.tsx", "src/components/layout/heby/heby-thread.ts", "src/features/heby-runtime/model-disclosure.ts"]) {
  const source = code(file);
  assert.ok(!/external-ai-data-use|platform-disclosure-policy|compose-external-ai-disclosure|governance-audit/.test(source), `${file} reaches no EAI authority`);
}
assert.match(code("src/features/heby-answer/load-conversation.server.ts"), /readExternalAiDisclosureDecisions\)\(tenant\.tenantId, correlationIds\)/, "the loader reads the record, tenant-scoped");

console.log("PASS heby-grounded-conversation-1 model-disclosure-surface");
