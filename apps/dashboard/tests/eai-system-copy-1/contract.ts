/*
 * EAI-SYSTEM-COPY-INTO-CONVERSATION-1 — contract.
 *
 * Root cause: two released UI paths (CONTENT-AGENT-2, HEBY-WORKFLOW-1) copied a Governance change
 * request's justification into the instruction textarea with one click. The textarea is the human's
 * words and is disclosed as `conversation`, so authoritative Governance data reached the provider
 * under the wrong class. Both copies are removed; everything else stays exactly as released.
 *
 *   1 CONTENT-AGENT-2 has no justification copy control
 *   2 HEBY-WORKFLOW-1 has no justification copy control
 *   3 the justification is still rendered, as recorded, on both surfaces
 *   4 the instruction is still the human's typed input, submitted as the prompt
 *   5 agent choice is still explicit and never preselected
 *   6 revision N → N+1 still carries the staleness keys from the read change request
 *   7 server-side authorization is unchanged (the review-basis right is asked by the seam)
 *   8 egress disclosure classes are unchanged
 *   9 neither the work title nor the justification is added to the model brief
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { codeOf } from "../helpers/durable-write-detector";
import { systemCopyViolations } from "../helpers/system-copy";

const read = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");
const CA2 = "src/components/operations-preparation/prepare-with-hebun.tsx";
const HW1 = "src/components/layout/heby/heby-work-draft-affordance.tsx";
const SEAM = "src/features/work-artifacts/prepare-work-artifact.server.ts";
const ASSIGN = "src/features/agent-work/assign-work-draft.server.ts";
const BRIEF = "src/features/work-artifacts/preparation-brief.ts";

const ca2 = codeOf(read(CA2));
const hw1Full = codeOf(read(HW1));
const hw1 = hw1Full.slice(hw1Full.indexOf("function ReviseWorkDraft("));

/* 1 · 2 — no system copy, by any handler, effect or initial state */
assert.deepEqual(systemCopyViolations(read(CA2)), [], "1: CONTENT-AGENT-2 copies nothing system-owned into the instruction");
assert.deepEqual(systemCopyViolations(read(HW1)), [], "2: HEBY-WORKFLOW-1 copies nothing system-owned into the instruction");
assert.ok(!/Use this reason as my instruction/.test(hw1), "2: the HEBY-WORKFLOW-1 copy control is gone");
assert.ok(!/The reason becomes your instruction/.test(ca2), "1: CONTENT-AGENT-2 no longer promises a copy");

/* 3 — still readable */
assert.ok(/\{reason\.justification\}/.test(ca2), "3: CONTENT-AGENT-2 renders the reason as recorded");
assert.ok(/\{basis\.justification\}/.test(hw1), "3: HEBY-WORKFLOW-1 renders the reason as recorded");

/* 4 — manual instruction */
for (const [name, ui] of [["CONTENT-AGENT-2", ca2], ["HEBY-WORKFLOW-1", hw1]] as const) {
  assert.ok(/onChange=\{\(event\) => setInstruction\(event\.target\.value\)\}/.test(ui), `4: ${name} instruction is typed`);
  assert.ok(/prompt: instruction,/.test(ui), `4: ${name} submits the typed instruction as the prompt`);
}

/* 5 — agent choice */
assert.ok(hw1.includes('const [agentId, setAgentId] = useState("");'), "5: no agent is preselected");
assert.ok(hw1.includes('basis !== null && agentId !== ""'), "5: nothing is asked without a read change request and an explicit agent");
assert.ok(/agentSelectionFor\(agents, agentId\)/.test(ca2), "5: CONTENT-AGENT-2 keeps the released agent selection");

/* 6 — revision N → N+1 */
assert.ok(
  /setFromReview\(\{ revisionNo: reason\.revisionNo, decisionId: reason\.decisionId \}\)/.test(ca2),
  "6: CONTENT-AGENT-2 still binds the revision to the read review",
);
assert.ok(
  /fromReview \? \{ expectedRevisionNo: fromReview\.revisionNo, reviewBasisDecisionId: fromReview\.decisionId \}/.test(ca2),
  "6: and sends the staleness keys only then",
);
assert.ok(/expectedRevisionNo: basis\.revisionNo,\s*reviewBasisDecisionId: basis\.decisionId/.test(hw1), "6: HEBY-WORKFLOW-1 keys");

/* 7 — server authorization */
const seam = codeOf(read(SEAM));
assert.ok(/mayReviseFromReview\(reviewDb, tenant\)/.test(seam), "7: the review-basis right is still asked by the seam");
assert.ok(/isReviewBasisCurrent/.test(seam), "7: and the basis staleness");

/* 8 — disclosure classes */
assert.ok(
  seam.includes('preparationBriefDataClasses: input.observationSupplement ? ["work-artifact", "provider-observation"] : ["work-artifact"]'),
  "8: preparation egress classes unchanged",
);

/* 9 — nothing system-owned joins the brief */
for (const f of [SEAM, ASSIGN, BRIEF]) assert.ok(!/justification/.test(codeOf(read(f))), `9: ${f} never names a justification`);
assert.ok(!/\btitle\b/.test(codeOf(read(BRIEF))), "9: the brief never reads a title");

console.log("PASS eai-system-copy-1 contract");
