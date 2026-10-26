/*
 * AOR-1a — the closed diagnosis vocabulary and where it may travel. Pure and static; no database.
 *
 *   C1  every validator check names one closed code beside its prose; an unsupported evidence code
 *       carries no reference from the response
 *   C2  the provider stop reason is classified into a closed set; nothing unknown is carried raw
 *   C3  the diagnosis line: only when a model answered; only declared keys; no answer text
 *   C4  Heby's withheld wording names the class from the codes alone; no codes keeps the old sentence
 *   C5  boundaries: the line module imports types only; the seam logs once, through an injectable sink;
 *       no new filter, schema or authority
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateResponse } from "../../src/features/heby-runtime/response-validator";
import { classifyProviderStopReason, type HebyRuntimeResponse } from "../../src/features/heby-runtime/contracts";
import { preparationDiagnosisLine, PREPARATION_MODEL_OUTCOME_EVENT } from "../../src/features/work-artifacts/preparation-diagnosis";
import type { HebyModelAnswerResult } from "../../src/features/heby-answer/model-answer.server";
import { describeWithheld, WITHHELD_WORDING } from "../../src/components/layout/heby/heby-work-draft-affordance";

const code = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

/* ── C1 · codes beside prose ── */
const base = {
  kind: "ANSWER", origin: "model", title: "Plan", body: ["A plan."], evidence: [], provenance: [], provenanceCovered: [],
  uncertainty: "low", limitations: [], authority: "advisory-only", modelUsed: true,
} as unknown as HebyRuntimeResponse;
const v = (over: Partial<HebyRuntimeResponse>) => validateResponse({ ...base, ...over } as HebyRuntimeResponse, [], "advisory-only" as never);
assert.deepEqual(v({}).codes, [], "a valid response has no codes");
assert.deepEqual(v({ body: [] }).codes, ["missing-title-or-body"]);
assert.deepEqual(v({ authority: "restricted" } as never).codes, ["authority-mismatch"]);
assert.deepEqual(v({ body: ["I approved the release and it is done."] }).codes, ["action-claim:approved"]);
assert.deepEqual(v({ modelUsed: false }).codes, ["model-flag-missing"]);
assert.deepEqual(v({ modelInvocationAttempted: false }).codes, ["attempt-flag-denied"]);
const forged = v({ evidence: [{ sourceClass: "knowledge", recordRef: "INJECTED-REF-9Z" }] as never });
assert.deepEqual(forged.codes, ["unsupported-evidence"]);
assert.ok(forged.issues.some((issue) => issue.includes("INJECTED-REF-9Z")), "the prose still quotes it (unchanged, never logged)");
assert.ok(!JSON.stringify(forged.codes).includes("INJECTED-REF-9Z"), "the code does not");
const many = v({ body: [], authority: "restricted" } as never);
assert.equal(many.codes.length, many.issues.length, "one code per issue");

/* ── C2 · stop reasons ── */
for (const known of ["end_turn", "max_tokens", "stop_sequence", "tool_use", "pause_turn", "refusal"]) {
  assert.equal(classifyProviderStopReason(known), known);
}
assert.equal(classifyProviderStopReason("weird <b>"), "other");
assert.equal(classifyProviderStopReason(""), undefined);
assert.equal(classifyProviderStopReason(undefined), undefined);
assert.equal(classifyProviderStopReason(null), undefined);

/* ── C3 · the line ── */
const answered = (response: Partial<HebyRuntimeResponse>, extra: Record<string, unknown> = {}): HebyModelAnswerResult =>
  ({
    status: "answered",
    outcome: { response: { ...base, body: ["REPLY-TEXT-SENTINEL"], ...response } },
    persistence: { durable: true, conversationId: "c", assistantMessageId: "m-1" },
    ...extra,
  }) as unknown as HebyModelAnswerResult;
assert.equal(preparationDiagnosisLine({ status: "unauthorized" }), null);
assert.equal(preparationDiagnosisLine({ status: "rejected", reason: "empty" } as never), null);
assert.equal(preparationDiagnosisLine(answered({ origin: "deterministic", modelInvocationAttempted: undefined, modelFallback: { kind: "director-disabled" } })), null, "no model answered, nothing to diagnose");
assert.equal(preparationDiagnosisLine(answered({ origin: "deterministic", modelInvocationAttempted: false })), null);
const withheld = preparationDiagnosisLine(
  answered({ origin: "deterministic", modelInvocationAttempted: true, modelFallback: { kind: "withheld", issueCodes: ["action-claim:deployed"], stopReason: "end_turn" } }, { modelStopReason: "end_turn" }),
)!;
assert.deepEqual(JSON.parse(withheld), { event: PREPARATION_MODEL_OUTCOME_EVENT, served: "withheld", issueCodes: ["action-claim:deployed"], stopReason: "end_turn", messageId: "m-1" });
const served = preparationDiagnosisLine(answered({ modelInvocationAttempted: true }))!;
assert.deepEqual(JSON.parse(served), { event: PREPARATION_MODEL_OUTCOME_EVENT, served: "model", issueCodes: [], stopReason: "unreported", messageId: "m-1" });
assert.ok(!served.includes("REPLY-TEXT-SENTINEL") && !withheld.includes("REPLY-TEXT-SENTINEL"), "the reply never travels");
const legacy = preparationDiagnosisLine(answered({ origin: "deterministic", modelInvocationAttempted: true, modelFallback: { kind: "withheld" } }))!;
assert.deepEqual(JSON.parse(legacy).issueCodes, [], "a withheld fallback without codes is tolerated");
const notDurable = preparationDiagnosisLine({ ...(answered({ modelInvocationAttempted: true }) as object), persistence: { durable: false, reason: "persistence-failed" } } as never)!;
assert.equal(JSON.parse(notDurable).messageId, null);

/* ── C4 · Heby's words ── */
assert.equal(describeWithheld({ kind: "withheld" }), WITHHELD_WORDING, "no codes: the pre-AOR sentence");
assert.equal(describeWithheld({ kind: "withheld", issueCodes: [] }), WITHHELD_WORDING);
assert.match(describeWithheld({ kind: "withheld", issueCodes: ["action-claim:approved", "action-claim:deployed"] }), /because it described an act as having happened \(“approved”, “deployed”\), so nothing was filed/);
assert.match(describeWithheld({ kind: "withheld", issueCodes: ["unsupported-evidence"] }), /because it cited a source Hebun did not give it/);
assert.match(describeWithheld({ kind: "withheld", issueCodes: ["missing-title-or-body"] }), /because it failed Hebun's format checks/);
assert.match(describeWithheld({ kind: "withheld", issueCodes: ["action-claim:executed", "unsupported-evidence"] }), /act as having happened \(“executed”\) and it cited a source/);
for (const text of [describeWithheld({ kind: "withheld", issueCodes: ["action-claim:approved"] })]) {
  assert.match(text, /^No draft was written\./);
  assert.doesNotMatch(text, /declin|refus/i, "a withheld answer is never called a decline");
}

/* ── C5 · boundaries ── */
const lineModule = code("src/features/work-artifacts/preparation-diagnosis.ts");
for (const line of lineModule.split("\n").filter((l) => /^import /.test(l))) {
  assert.match(line, /^import type /, `the line module imports types only: ${line.trim()}`);
}
const seam = code("src/features/work-artifacts/prepare-work-artifact.server.ts");
assert.equal((seam.match(/preparationDiagnosisLine\(/g) ?? []).length, 1, "the seam builds the line once");
assert.equal((seam.match(/console\./g) ?? []).length, 1, "and its only console use is the default sink");
assert.match(seam, /if \(diagnosis\) \(deps\.log \?\? \(\(line: string\) => console\.info\(line\)\)\)\(diagnosis\);/);
assert.ok(seam.indexOf("preparationDiagnosisLine(answer)") < seam.indexOf('answer.outcome.response.origin !== "model"'), "logged before anything decides what to do with the answer");
const validator = code("src/features/heby-runtime/response-validator.ts");
assert.match(validator, /const FORBIDDEN_ACTION_CLAIMS = \[\s*"approved",\s*"rejected",\s*"authorized",\s*"executed",\s*"deployed",\s*"deleted",\s*"policy updated",\s*"decision recorded",\s*\] as const;/, "the forbidden verbs are unchanged");
const codeOnly = (src: string) => src.split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
assert.doesNotMatch(codeOnly(lineModule), /declin/i, "the line never classifies a reply as a decline");
assert.doesNotMatch(seam, /I cannot|I can't|I'm unable|as an AI/i, "no phrase-based refusal detection was added");

console.log("aor-1a diagnosis-contract: C1–C5 ok");
