/*
 * WORK-OUTCOME-CLOSURE-1 — the completion rule, its words, and the boundaries the change must keep.
 * Pure and static; no database.
 *
 *   C1  the rule: every withheld reason, current revision, multiple evidence, retired drafts, unknown
 *   C2  the words: acceptance is never completion, never publication, sending or execution; declaring
 *       complete is a person's declaration that Hebun does not verify
 *   C3  the outcome modules hold no writer, no model seam and no tenant input
 *   C4  the review writer cannot change the work register; acceptance declares nothing
 *   C5  the surfaces declare only on a person's click, only through the existing human writer, only "complete"
 *   C6  the corrected AE-1 / AE-2 wording
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACCEPTANCE_IS_NOT_COMPLETION,
  COMPLETION_SUGGESTION_TEXT,
  COMPLETION_WITHHELD_TEXT,
  OUTCOME_REVIEW_WORDING,
  SUGGESTED_DECLARED_STATE,
  suggestCompletion,
  type WorkOutcomeEvidence,
} from "../../src/features/work-outcome/contracts";
import {
  describeAssignment,
  describeRecommendation,
  REVIEW_WORDING,
  WITHHELD_WORDING,
} from "../../src/components/layout/heby/heby-work-draft-affordance";

const code = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

/* ── C1 · the rule ── */
const ev = (over: Partial<WorkOutcomeEvidence> = {}): WorkOutcomeEvidence => ({
  artifactId: "a", title: "Plan", artifactType: "operational-plan", revisionNo: 1, retired: false, review: "accepted", ...over,
});
const s = (declaredState: "planned" | "active" | "blocked" | "complete" | null, evidence: WorkOutcomeEvidence[] | null, inService = true) =>
  suggestCompletion({ declaredState, inService, evidence });

assert.deepEqual(s("planned", [ev()]), { offered: true });
assert.deepEqual(s("active", [ev()]), { offered: true });
assert.deepEqual(s("blocked", [ev()]), { offered: true });
assert.deepEqual(s("complete", [ev()]), { offered: false, reason: "work-complete" });
assert.deepEqual(s(null, [ev()]), { offered: false, reason: "work-unknown" });
assert.deepEqual(s("planned", [ev()], false), { offered: false, reason: "work-retired" });
assert.deepEqual(s("planned", null), { offered: false, reason: "evidence-unknown" }, "an unanswered read is not evidence");
assert.deepEqual(s("planned", []), { offered: false, reason: "no-evidence" });
/* Current revision: the review is read for the current revision only, so a newer revision is unreviewed. */
assert.deepEqual(s("planned", [ev({ revisionNo: 2, review: "awaiting-review" })]), { offered: false, reason: "awaiting-review" });
/* Multiple evidence. */
assert.deepEqual(s("planned", [ev({ artifactId: "a" }), ev({ artifactId: "b" })]), { offered: true });
assert.deepEqual(s("planned", [ev({ artifactId: "a" }), ev({ artifactId: "b", review: "awaiting-review" })]), { offered: false, reason: "awaiting-review" });
assert.deepEqual(s("planned", [ev({ artifactId: "a" }), ev({ artifactId: "b", review: "changes-requested" })]), { offered: false, reason: "changes-requested" });
assert.deepEqual(
  s("planned", [ev({ artifactId: "a", review: "awaiting-review" }), ev({ artifactId: "b", review: "changes-requested" }), ev({ artifactId: "c", review: "unknown" })]),
  { offered: false, reason: "review-unknown" },
  "unknown is reported first: nothing is inferred over it",
);
/* Retired drafts do not count either way. */
assert.deepEqual(s("planned", [ev({ artifactId: "a" }), ev({ artifactId: "b", retired: true, review: "changes-requested" })]), { offered: true });
assert.deepEqual(s("planned", [ev({ retired: true })]), { offered: false, reason: "no-evidence" });
/* An unresolved draft (the artifact authority could not name it) arrives unknown and withholds. */
assert.deepEqual(s("planned", [ev(), ev({ artifactId: "x", title: null, artifactType: null, revisionNo: null, review: "unknown" })]), { offered: false, reason: "review-unknown" });
assert.equal(SUGGESTED_DECLARED_STATE, "complete");

/* ── C2 · the words ── */
assert.match(ACCEPTANCE_IS_NOT_COMPLETION, /does not change the work's declared state/);
assert.match(ACCEPTANCE_IS_NOT_COMPLETION, /authorizes no publication, sending or execution/);
assert.match(COMPLETION_SUGGESTION_TEXT, /you may declare it complete/);
assert.match(COMPLETION_SUGGESTION_TEXT, /Hebun does not declare it for you/);
assert.match(COMPLETION_SUGGESTION_TEXT, /Hebun verifies nothing/);
for (const [review, words] of Object.entries(OUTCOME_REVIEW_WORDING)) {
  assert.doesNotMatch(words, /complete|publish|approved|verified/i, `${review} is never worded as completion, publication or verification`);
}
for (const [reason, words] of Object.entries(COMPLETION_WITHHELD_TEXT)) {
  assert.doesNotMatch(words, /publish|send|execut/i, `${reason} says nothing about acting`);
}
assert.match(COMPLETION_WITHHELD_TEXT["evidence-unknown"], /read failure, not missing evidence/);

/* ── C3 · the outcome modules ── */
const contracts = code("src/features/work-outcome/contracts.ts");
for (const line of contracts.split("\n").filter((l) => /^import /.test(l))) {
  assert.match(line, /^import type /, `the rule module imports types only: ${line.trim()}`);
}
const reader = code("src/features/work-outcome/read-work-outcome-evidence.server.ts");
const readerImports = reader.split("\n").filter((l) => /^import |^} from /.test(l)).join("\n");
/*
 * CONTENT-WORK-OUTCOME-1 narrowed this pin, deliberately: the reader now asks Action Authorization's
 * READ-ONLY publication projection about content drafts. That one specifier is named and removed before
 * the check; every other Action Authorization module (deciders, permits) and Action Execution stay refused.
 */
const PUBLICATION_READ = '"@/features/action-authorization/content-publication-state.server"';
assert.equal(readerImports.split(PUBLICATION_READ).length - 1, 1, "the reader names the publication projection exactly once");
assert.doesNotMatch(readerImports.replace(PUBLICATION_READ, ""), /write-|decision-authority|governance-audit|heby-model|heby-runtime|prepare-work-artifact|agent-origination|action-authorization|action-execution/, "the reader imports no writer and no model seam");
assert.doesNotMatch(reader, /\.insert\(|\.update\(|\.delete\(|\.transaction\(|acceptArtifactRevision|setWorkDeclaredState/, "the reader writes nothing");
assert.match(reader, /export async function readWorkOutcomeEvidence\(\s*tenant: TenantContext \| null,\s*deps: WorkOutcomeEvidenceDeps = \{\},?\s*\)/, "tenant and deps only: no tenant, work or artifact id input");
assert.match(reader, /references\.length >= MAX_WORK_EVIDENCE_REFERENCES\) return \{ status: "unavailable" \}/, "a full page is refused");

/* ── C4 · review cannot touch work ── */
const reviewWriter = code("src/features/work-artifact-review/review-revision.server.ts");
assert.doesNotMatch(reviewWriter, /organizational-work|work_items|workItems|setWorkDeclaredState|declareWorkState/, "the review writer reaches no work authority");
assert.doesNotMatch(code("src/app/(dashboard)/operations/actions.ts"), /setWorkDeclaredState/, "the review actions declare no work state");

/* ── C5 · surfaces declare only on a click, only through the human writer, only complete ── */
const heby = code("src/components/layout/heby/heby-work-draft-affordance.tsx");
const register = code("src/components/organizational-work/work-register.tsx");
const review = code("src/components/operations-preparation/artifact-revision-review.tsx");
assert.equal((heby.match(/setWorkDeclaredStateAction\(/g) ?? []).length, 1, "Heby calls the declaration once");
assert.match(heby, /onClick=\{\(\) =>\s*start\(async \(\) => \{\s*try \{\s*const declared = await setWorkDeclaredStateAction\(\{ workItemId, declaredState: SUGGESTED_DECLARED_STATE \}\)/, "on the person's click, with the constant state");
assert.match(heby, /choices\.completion\.offered \? \(/, "only when the server offered it");
assert.match(heby, /choices\.mayAssign \? \(/, "and only to a holder of the authority the writer asks");
assert.match(register, /declaredState: SUGGESTED_DECLARED_STATE,/, "the register declares the constant state");
assert.equal((register.match(/setWorkDeclaredStateAction\(/g) ?? []).length, 2, "the register's two human declare controls: Change and the suggestion");
assert.doesNotMatch(review, /setWorkDeclaredStateAction|declareWork/, "the review control declares nothing");
assert.match(review, /\{ACCEPTANCE_IS_NOT_COMPLETION\}/, "the review control says acceptance is not completion");
assert.match(review, /intent === "accept" \? \(\s*<div className="text-xs text-fg-muted" data-review-work-purpose="">/, "at the moment of accepting");
for (const file of [heby, register, review]) {
  for (const line of file.split("\n").filter((l) => /^import /.test(l) && /\.server"/.test(l))) {
    assert.match(line, /^import type /, `client code imports only types from server modules: ${line.trim()}`);
  }
  assert.doesNotMatch(file, /tenantId/, "no client names a tenant");
}
assert.match(code("src/app/(dashboard)/director/work/actions.ts"), /export async function setWorkDeclaredStateAction\(input: \{[\s\S]*?return revalidate\(await setWorkDeclaredState\(tenant, input\)\);/, "the action is the unchanged human writer under the session's tenant");

/* ── C6 · corrected wording ── */
assert.doesNotMatch(REVIEW_WORDING.accepted, /task is complete/);
assert.match(REVIEW_WORDING.accepted, /the work is complete only when a person declares it/);
const read = {
  status: "read", workItemId: "w", mayAssign: true, notResponsible: 0, drafts: [], recommendedAgentId: "s",
  declaredState: "planned", completion: { offered: false, reason: "no-evidence" },
  agents: [
    { agentId: "c", name: "Heby", role: "coordinator", openDraftId: null },
    { agentId: "s", name: "Research Agent", role: "specialist", openDraftId: null },
  ],
} as const;
assert.doesNotMatch(describeRecommendation(read)!, /writes as/);
const prepared = describeAssignment({ status: "prepared", workItemId: "w", artifactId: "a", revisionNo: 1, agentName: "Research Agent", agentRole: "specialist" }, "Research Agent");
assert.doesNotMatch(prepared, /as this work's specialist,/);
assert.match(prepared, /is recorded as its author/);
assert.equal(describeAssignment({ status: "not-prepared", reason: "no-model-answer", modelFallback: { kind: "withheld" } } as never, "Writer"), WITHHELD_WORDING);
assert.match(WITHHELD_WORDING, /withheld the answer, so nothing was filed/);
assert.match(describeAssignment({ status: "not-prepared", reason: "no-model-answer", modelFallback: { kind: "provider-failed", code: "x" } } as never, "Writer"), /^No draft was written\. /);
assert.match(heby, /agentId \? `Assign to \$\{agentName\}` : "Choose an agent to assign"/, "before a choice the button names no agent");

console.log("work-outcome-closure-1 outcome-contract: C1–C6 ok");
