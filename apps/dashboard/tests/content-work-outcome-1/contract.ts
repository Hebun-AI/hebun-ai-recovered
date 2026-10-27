/*
 * CONTENT-WORK-OUTCOME-1 — the rule, the reduction of the ledger, the surface, and bite-proofs.
 *
 *   R1 draft-only work keeps the released rule (plans and messages carry no publication answer)
 *   R2 a content draft needs a provider-accepted publication of its current revision
 *   R3 Governance acceptance, a pending request and an active permit are not publication
 *   R4 a failed, refused or unknown latest attempt is `failed`
 *   R5 only this revision, to this destination, counts
 *   R6 unknown, missing, truncated or unpublishable (TikTok) is `unavailable`
 *   R7 review reasons still come first
 *   S  the reader asks only content drafts, under the session tenant; the register shows the four states
 *   B  each mutation below re-opens one hole and the checks above must catch it (in memory, no source written)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import * as released from "../../src/features/work-outcome/contracts";
import type { ContentPublicationState, PublicationHistoryEntry } from "../../src/features/action-authorization/content-publication-state";

type Rule = Pick<typeof released, "suggestCompletion" | "workPublicationStatus">;

const read = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");
const CONTRACTS = "src/features/work-outcome/contracts.ts";
const READER = "src/features/work-outcome/read-work-outcome-evidence.server.ts";
const REGISTER = "src/components/organizational-work/work-register.tsx";

const entry = (stage: string, destination = "instagram", providerResultId: string | null = "1789"): PublicationHistoryEntry =>
  ({
    stage,
    destination,
    attempt: stage.startsWith("execution-") ? { status: stage.slice("execution-".length), providerResultId } : null,
  }) as unknown as PublicationHistoryEntry;
const recorded = (entries: PublicationHistoryEntry[], truncated = false): ContentPublicationState =>
  ({ status: "recorded", artifactRef: "work-artifact/x@1", entries, truncated });
const draft = (artifactType: string, review: string, publication?: string) =>
  ({ artifactId: `${artifactType}-${review}-${publication}`, title: "t", artifactType, revisionNo: 1, retired: false, review, publication }) as never;
const suggest = (rule: Rule, ...evidence: never[]) => rule.suggestCompletion({ declaredState: "planned", inService: true, evidence });

function check(rule: Rule): void {
  const status = rule.workPublicationStatus;
  /* R1 */
  assert.deepEqual(suggest(rule, draft("operational-plan", "accepted")), { offered: true }, "R1 plan");
  assert.deepEqual(suggest(rule, draft("message-draft", "accepted")), { offered: true }, "R1 message");
  /* R2 */
  assert.deepEqual(suggest(rule, draft("content-draft", "accepted", "verified")), { offered: true }, "R2 verified");
  assert.deepEqual(suggest(rule, draft("content-draft", "accepted")), { offered: false, reason: "publication-unavailable" }, "R2 no answer is not publication");
  assert.deepEqual(suggest(rule, draft("operational-plan", "accepted"), draft("content-draft", "accepted", "pending")), { offered: false, reason: "publication-pending" }, "R2 plan does not cover content");
  /* R3 */
  assert.equal(status({ status: "no-request-recorded", artifactRef: "work-artifact/x@1" }, "instagram"), "pending", "R3 accepted, nothing requested");
  assert.equal(status(recorded([entry("request-pending")]), "instagram"), "pending", "R3 request pending");
  assert.equal(status(recorded([entry("permit-active")]), "instagram"), "pending", "R3 permit is not publication");
  assert.equal(status(recorded([entry("execution-pending")]), "instagram"), "pending", "R3 attempt started");
  /* R4 */
  for (const stage of ["execution-failed", "execution-refused", "execution-unknown"]) {
    assert.equal(status(recorded([entry(stage)]), "instagram"), "failed", `R4 ${stage}`);
  }
  assert.equal(status(recorded([entry("execution-failed"), entry("execution-accepted")]), "instagram"), "verified", "R4 a later acceptance verifies");
  assert.deepEqual(suggest(rule, draft("content-draft", "accepted", "failed")), { offered: false, reason: "publication-failed" }, "R4");
  /* R5 */
  assert.equal(status(recorded([entry("execution-accepted", "youtube")]), "instagram"), "pending", "R5 another destination");
  assert.equal(status(recorded([entry("execution-accepted", "instagram", null)]), "instagram"), "pending", "R5 no provider id, no verification");
  assert.equal(status(recorded([entry("execution-accepted", "youtube")]), "youtube"), "verified", "R5 YouTube");
  /* R6 */
  assert.equal(status(undefined, "instagram"), "unavailable", "R6 not read");
  assert.equal(status({ status: "unknown", artifactRef: null, reason: "read-failed" }, "instagram"), "unavailable", "R6 unknown");
  assert.equal(status(recorded([entry("execution-failed")], true), "instagram"), "unavailable", "R6 truncated without acceptance");
  assert.equal(status(recorded([entry("execution-accepted")], true), "instagram"), "verified", "R6 an accepted attempt is a fact even in a cut history");
  assert.equal(status(recorded([entry("execution-accepted")]), "tiktok"), "unavailable", "R6 no route to TikTok");
  assert.equal(status(recorded([entry("execution-accepted")]), null), "unavailable", "R6 no destination");
  /* R7 */
  assert.deepEqual(suggest(rule, draft("content-draft", "changes-requested", "verified")), { offered: false, reason: "changes-requested" }, "R7");
  assert.deepEqual(suggest(rule, draft("content-draft", "awaiting-review", "pending")), { offered: false, reason: "awaiting-review" }, "R7");
}

check(released);

/* ── S · surface ── */
const reader = read(READER);
assert.match(reader, /artifacts\.get\(k\.artifactId\)\?\.artifactType === CONTENT_DRAFT_TYPE/, "S: only content drafts are asked about");
assert.match(reader, /\(tenant, contentRevisions, \{\s*getDb: deps\.getDb,\s*\}\)\.catch\(\(\) => new Map\(\)\)/, "S: under the session tenant; a throw reads as unanswered");
assert.match(reader, /`work-artifact\/\$\{artifact\.id\.toLowerCase\(\)\}@\$\{artifact\.currentRevision\}`/, "S: keyed by the CURRENT revision's reference");
assert.match(reader, /artifact\.intendedDestination/, "S: against the draft's own declared destination");
assert.doesNotMatch(reader, /\.insert\(|\.update\(|\.delete\(|\.transaction\(/, "S: the reader writes nothing");
const register = read(REGISTER);
assert.match(register, /WORK_PUBLICATION_WORDING\[draft\.publication \?\? "unavailable"\]/, "S: the register shows the publication state of a content draft");
for (const [state, words] of Object.entries(released.WORK_PUBLICATION_WORDING)) {
  assert.doesNotMatch(words, /\bis live\b|\bpublished\b|complete/i, `S: ${state} never claims a live post or completion`);
}

/* ── B · bite-proofs ── */
const source = read(CONTRACTS);
async function load(mutated: string): Promise<Rule> {
  const js = ts.transpileModule(mutated, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
}
const mutations: [string, string, string][] = [
  ["B1 publication ignored", 'if (publications.includes("pending")) return { offered: false, reason: "publication-pending" };', ""],
  [
    "B2 a permit counts as publication",
    'entry.stage === "execution-accepted" &&\n      entry.destination === destination &&\n      entry.attempt?.status === "accepted" &&\n      entry.attempt.providerResultId !== null,',
    'entry.stage !== "request-pending" && entry.destination === destination,',
  ],
  ["B3 any destination counts", "entry.destination === destination &&", ""],
  ["B4 truncation ignored", 'if (state.truncated) return "unavailable";', ""],
  ["B5 a missing answer read as pending", '.map((evidence) => evidence.publication ?? "unavailable");', '.map((evidence) => evidence.publication ?? "pending");'],
  ["B6 failures read as pending", 'const UNSUCCESSFUL_ATTEMPT_STAGES: readonly string[] = ["execution-failed", "execution-refused", "execution-unknown"];', "const UNSUCCESSFUL_ATTEMPT_STAGES: readonly string[] = [];"],
  ["B7 plans swept in", '.filter((evidence) => evidence.artifactType === "content-draft")', ""],
  ["B8 TikTok assumed publishable", 'const PUBLISHABLE_DESTINATIONS: readonly ContentDestination[] = ["instagram", "youtube"];', 'const PUBLISHABLE_DESTINATIONS: readonly ContentDestination[] = ["instagram", "youtube", "tiktok"];'],
];
async function bites(): Promise<void> {
  for (const [label, from, to] of mutations) {
    assert.equal(source.split(from).length - 1, 1, `${label}: anchor found once`);
    const rule = await load(source.replace(from, to));
    assert.throws(() => check(rule), `${label}: the checks catch it`);
  }
  console.log(`PASS content-work-outcome-1 contract (R1–R7, S, ${mutations.length}/${mutations.length} bites)`);
}

bites().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
