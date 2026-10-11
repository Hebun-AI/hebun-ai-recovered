/*
 * CA-2 PREPARATION FAILURE LEGIBILITY — surface and firewall.
 *
 * Pins: every model fallback carries a closed reason; the browser receives that reason and never the
 * answer; each reason reads as what it is (a provider failure is never worded as a data-use refusal);
 * a thrown action is said, not hidden; and own-caption grounding is neither defaulted nor offered
 * while the released platform policy refuses its data class. Enforcement itself is not touched here.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { modelFallbackSentence } from "../../src/components/operations-preparation/prepare-with-hebun";
import { OWN_CONTENT_GROUNDING_DISCLOSABLE } from "../../src/features/content-grounding/contracts";
import { toPreparationClientResult } from "../../src/features/work-artifacts/prepare-work-artifact.server";
import { decidePlatformDisclosure } from "../../src/features/external-ai-data-use/platform-disclosure-policy";
import type { HebyModelFallback, ModelAvailabilityState } from "../../src/features/heby-runtime/contracts";

const ANSWER = "src/features/heby-answer/model-answer.server.ts";
const ACTIONS = "src/app/(dashboard)/operations/actions.ts";
const SURFACE = "src/components/operations-preparation/prepare-with-hebun.tsx";

function codeOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function everyFallbackIsNamed(): void {
  const code = codeOf(ANSWER);
  const notes = (code.match(/withNote\(\s*deterministic,/g) ?? []).length;
  const named = (code.match(/modelFallback: \{ kind: "/g) ?? []).length;
  assert.equal(notes, 5, "A1 the answer flow has exactly five deterministic fallbacks");
  assert.equal(named, notes, "A2 every deterministic fallback names its closed reason");
  for (const kind of ["public-knowledge-blocked", "director-disabled", "provider-failed", "unavailable", "withheld"]) {
    assert.ok(code.includes(`modelFallback: { kind: "${kind}"`), `A3 the ${kind} fallback is named`);
  }
}

function theBrowserGetsTheReasonNotTheAnswer(): void {
  const actions = codeOf(ACTIONS);
  const body = actions.slice(actions.indexOf("export async function prepareWorkArtifactAction"));
  const fn = body.slice(0, body.indexOf("\n}\n") + 2);
  assert.ok(fn.includes("return { ...toPreparationClientResult(result), grounding: disposition };"), "B1 the action returns only the client-safe result");
  assert.ok(!/return \{ \.\.\.result\b/.test(fn), "B2 the raw seam result never leaves the server");

  const answer = {
    status: "answered",
    outcome: { response: { body: ["secret body"], limitations: ["private note"], modelFallback: { kind: "withheld" } } },
  };
  const refused = toPreparationClientResult({ status: "refused", reason: "no-model-answer", answer } as never);
  assert.deepEqual(refused, { status: "refused", reason: "no-model-answer", modelFallback: { kind: "withheld" } }, "B3 a refusal keeps only its reason and the fallback code");
  const prepared = toPreparationClientResult({
    status: "prepared", artifactId: "a", revisionNo: 2, contentDigest: "d", ref: "r", conversationId: "c", sourceMessageId: "m", answer,
  } as never);
  assert.ok(!("answer" in prepared), "B4 a prepared result carries no answer");
  const preflight = toPreparationClientResult({ status: "refused", reason: "revision-stale" } as never);
  assert.deepEqual(preflight, { status: "refused", reason: "revision-stale" }, "B5 a preflight refusal is unchanged");
}

function eachReasonReadsAsWhatItIs(): void {
  const states: readonly Exclude<ModelAvailabilityState, "AVAILABLE">[] = [
    "DISABLED", "MISCONFIGURED", "CREDENTIAL_UNAVAILABLE", "TRANSPORT_UNAVAILABLE",
    "DATA_USE_NOT_AUTHORIZED", "INSTRUCTION_CHANNEL_REFUSED", "DISPATCH_SAFETY_CAP_REACHED",
  ];
  const all: HebyModelFallback[] = [
    ...states.map((state) => ({ kind: "unavailable", state }) as const),
    { kind: "provider-failed", code: "timeout" },
    { kind: "withheld" },
    { kind: "director-disabled" },
    { kind: "public-knowledge-blocked", reason: "no-public-eligible-knowledge" },
    { kind: "public-knowledge-blocked", reason: "public-eligibility-unavailable" },
  ];
  for (const fallback of all) {
    const sentence = modelFallbackSentence(fallback);
    assert.ok(sentence.endsWith("No revision was written."), `C1 ${JSON.stringify(fallback)} says nothing was written`);
    assert.ok(!/undefined|\[object/.test(sentence), `C2 ${JSON.stringify(fallback)} renders a real sentence`);
  }
  const dataUse = modelFallbackSentence({ kind: "unavailable", state: "DATA_USE_NOT_AUTHORIZED" });
  const provider = modelFallbackSentence({ kind: "provider-failed", code: "timeout" });
  assert.match(dataUse, /data-use authorization/, "C3 a data-use refusal says data use");
  assert.match(dataUse, /model was not asked/, "C4 and that the model was not asked");
  assert.doesNotMatch(provider, /data-use|authoriz/i, "C5 a provider failure is never worded as an authorization refusal");
  assert.match(provider, /not known/, "C6 a provider failure does not claim the provider never received it");
  assert.match(modelFallbackSentence({ kind: "withheld" }), /model answered/, "C7 a withheld answer says the model answered");
}

function aThrownActionIsSaid(): void {
  const code = codeOf(SURFACE);
  assert.equal((code.match(/await prepareWorkArtifactAction\(/g) ?? []).length, 2, "D1 two forms call the action");
  assert.equal((code.match(/\} catch \{\s*setMessage\(ACTION_DID_NOT_COMPLETE\);\s*return;\s*\}/g) ?? []).length, 2, "D2 both forms say when the action did not complete");
  assert.ok(code.includes('result.reason === "no-model-answer" && result.modelFallback'), "D3 no-model-answer shows its named reason");
}

function groundingFollowsThePolicy(): void {
  const policy = decidePlatformDisclosure({ serviceScope: "anthropic/messages", purpose: "assistance", dataClass: "provider-observation" });
  assert.equal(OWN_CONTENT_GROUNDING_DISCLOSABLE, policy.decision === "allowed", "E1 the option is derived from the released policy");
  assert.equal(OWN_CONTENT_GROUNDING_DISCLOSABLE, false, "E2 under the released policy own-caption grounding is not disclosable");
  const code = codeOf(SURFACE);
  assert.ok(!code.includes("useState(true)"), "E3 grounding is not defaulted on");
  assert.ok(code.includes("useState(OWN_CONTENT_GROUNDING_DISCLOSABLE)"), "E4 its default is the policy's answer");
  assert.ok(code.includes("disabled={!OWN_CONTENT_GROUNDING_DISCLOSABLE}"), "E5 it cannot be selected while refused");
}

everyFallbackIsNamed();
theBrowserGetsTheReasonNotTheAnswer();
eachReasonReadsAsWhatItIs();
aThrownActionIsSaid();
groundingFollowsThePolicy();
console.log("ca2-preparation-failure-legibility/surface-and-firewall: all assertions passed");
