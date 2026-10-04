/*
 * MODEL-FACING IDENTITY MINIMIZATION — the pure projection.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "What Hebun sends to an external model is a MINIMIZED projection of its grounding: raw
 *    identifiers (UUIDs) and e-mail addresses in Hebun-authored labels, details, record references
 *    and Hebun's own earlier answers are withheld, while names, states, departments and every
 *    verbatim source text a human recorded travel unchanged. The projection never edits the
 *    organization's own words, and it is not a claim that free text is free of personal data."
 *
 * Pure. No database, no provider.
 */
import assert from "node:assert/strict";
import {
  MODEL_WITHHELD_ADDRESS,
  MODEL_WITHHELD_IDENTIFIER,
  minimizeModelFacingText,
  modelDisclosedDataClasses,
  modelFacingHistory,
  modelGroundingLines,
} from "../../src/features/heby-answer/model-facing-projection";
import type { SourceResolution } from "../../src/features/heby-runtime";

const USER = "22222222-2222-4222-8222-222222222222";
const DEPT = "44444444-4444-4444-8444-444444444444";
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/* ── 1. Text: a parenthesized identifier disappears; a bare one is withheld; an address too. ── */
assert.equal(minimizeModelFacingText(`Ayşe Yılmaz (${USER}) is recorded as a member`), "Ayşe Yılmaz is recorded as a member");
assert.equal(minimizeModelFacingText(`Finance [finance] in service, owner ${USER}`), `Finance [finance] in service, owner ${MODEL_WITHHELD_IDENTIFIER}`);
assert.equal(minimizeModelFacingText(`works in Sales [sales] (${DEPT.toUpperCase()}).`), "works in Sales [sales].");
assert.equal(minimizeModelFacingText("account ops.lead@acme.example · last verified x"), `account ${MODEL_WITHHELD_ADDRESS} · last verified x`);
assert.equal(minimizeModelFacingText("state available · read available"), "state available · read available", "nothing else changes");

/* ── 2. Grounding lines: refs with identifiers are omitted; source text is never touched. ───── */
const resolutions: SourceResolution[] = [
  {
    sourceClass: "people",
    state: "resolved",
    provenance: "membership authority",
    items: [
      {
        recordRef: `member/${USER}`,
        label: "Ayşe Yılmaz",
        detail: `Ayşe Yılmaz (${USER}) is recorded as a member of this organization.`,
        lifecycle: "settled",
      },
    ],
  } as unknown as SourceResolution,
  {
    sourceClass: "knowledge",
    state: "resolved",
    provenance: "knowledge authority",
    items: [
      {
        recordRef: "policy/refunds",
        label: "Refund policy",
        detail: "ratified · current",
        lifecycle: "settled",
        content: `Refunds go to billing@acme.example; ticket ${USER}.`,
      },
    ],
  } as unknown as SourceResolution,
  {
    sourceClass: "integrations",
    state: "resolved",
    provenance: "capability seam",
    items: [
      {
        recordRef: "google-workspace/drive.metadata",
        label: "google-workspace — drive.metadata",
        detail: "state available · account someone@gmail.com",
        modelDetail: "state available",
        lifecycle: "settled",
      },
    ],
  } as unknown as SourceResolution,
  { sourceClass: "governance", state: "unavailable", unavailableReason: `decision ${USER} could not be read`, items: [] } as unknown as SourceResolution,
];
/*
 * EXTERNAL-AI-DATA-USE-B2: people, integrations and Governance are no longer disclosed at all — the
 * projection withholds them whole. Minimization still governs every class that IS disclosed, so it is
 * pinned on a work artifact below: a UUID reference is dropped and an address in Hebun's text withheld.
 */
resolutions.push(
  {
    sourceClass: "work-artifacts",
    state: "resolved",
    provenance: `prepared work, owner ${USER}`,
    items: [
      {
        recordRef: `work-artifact/${USER}@2`,
        label: `Q4 brief (${USER})`,
        detail: "prepared by ops.lead@acme.example",
        lifecycle: "settled",
        content: `Draft text naming ${USER} and me@acme.example, verbatim.`,
      },
    ],
  } as unknown as SourceResolution,
  { sourceClass: "knowledge", state: "unavailable", unavailableReason: `fact ${USER} could not be read`, items: [] } as unknown as SourceResolution,
);
const lines = modelGroundingLines(resolutions);
const W = "withheld — not disclosed to the external model";
assert.equal(lines.length, 6);
assert.equal(lines[0], `[people] ${W}`, "people are withheld whole");
assert.equal(
  lines[1],
  `[knowledge/policy/refunds] Refund policy — ratified · current | source text: Refunds go to billing@acme.example; ticket ${USER}. | provenance: knowledge authority`,
  "a semantic reference is kept, and the organization's own words are quoted unchanged",
);
assert.equal(lines[2], `[integrations] ${W}`, "integrations are withheld whole — the account cannot reach the model at all");
assert.equal(lines[3], `[governance] ${W}`, "Governance is withheld whole, even when unavailable");
assert.equal(
  lines[4],
  `[work-artifacts] Q4 brief — prepared by ${MODEL_WITHHELD_ADDRESS} | source text: Draft text naming ${USER} and me@acme.example, verbatim. | provenance: prepared work, owner ${MODEL_WITHHELD_IDENTIFIER}`,
  "a disclosed class is still minimized: UUID reference dropped, identifiers and addresses withheld in Hebun's text, source text verbatim",
);
assert.equal(lines[5], `[knowledge] unavailable — fact ${MODEL_WITHHELD_IDENTIFIER} could not be read`);
for (const line of [lines[0]!, lines[2]!, lines[3]!, lines[5]!]) {
  assert.ok(!UUID_RE.test(line), `no identifier: ${line}`);
  assert.ok(!/@/.test(line), `no address: ${line}`);
}
assert.deepEqual([...modelDisclosedDataClasses(resolutions)].sort(), ["knowledge", "work-artifact"], "only the disclosed classes are declared");

/* ── 3. History: Hebun's own earlier answers are minimized; the human's words are not. ─────── */
const history = modelFacingHistory([
  { role: "user", content: `Is ${USER} the owner? Mail me at me@acme.example` },
  { role: "assistant", content: `Ayşe Yılmaz (${USER}) owns Finance; account ops@acme.example is connected.` },
]);
assert.deepEqual(history, [
  { role: "user", content: `Is ${USER} the owner? Mail me at me@acme.example` },
  { role: "assistant", content: `Ayşe Yılmaz owns Finance; account ${MODEL_WITHHELD_ADDRESS} is connected.` },
]);

console.log("PASS model-identity-minimization projection");
