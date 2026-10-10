/*
 * CONTENT-AGENT-2 — static boundaries. What revising from a review may NOT become:
 *
 *   1. the reason never enters the preparation seam: it reads only a yes/no staleness answer
 *   2. the change-request read writes nothing and names no writer
 *   3. the stale-state questions are asked INSIDE the writer's artifact lock, after `for("update")`
 *   4. the review writer still reaches no artifact table and takes only a shared lock
 *   5. no permit, request, execution, mandate or provider vocabulary entered any touched module
 *   6. the UI sends the staleness keys only when the human chose to revise from the review
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { codeOf } from "../helpers/durable-write-detector";

const ROOT = process.cwd();
const read = (f: string) => readFileSync(path.join(ROOT, f), "utf8");
const SEAM = "src/features/work-artifacts/prepare-work-artifact.server.ts";
const WRITER = "src/features/work-artifacts/write-work-artifacts.server.ts";
const READER = "src/features/work-artifact-review/change-request.server.ts";
const REVIEW = "src/features/work-artifact-review/review-revision.server.ts";
const UI = "src/components/operations-preparation/prepare-with-hebun.tsx";
const ACTIONS = "src/app/(dashboard)/operations/actions.ts";

/* 1 · the reason never reaches the model through the seam */
{
  const seam = codeOf(read(SEAM));
  assert.ok(!/justification/.test(seam), "the preparation seam never names a review justification");
  assert.ok(!/readCurrentRevisionChangeRequest/.test(seam), "the seam never reads the reason — only `isReviewBasisCurrent`");
  assert.ok(/isReviewBasisCurrent/.test(seam), "it asks the yes/no staleness question");
  const reader = codeOf(read(READER));
  const basisFn = reader.slice(reader.indexOf("export async function isReviewBasisCurrent"));
  assert.ok(!/justification/.test(basisFn), "the staleness answer never reads the reason text");
}

/* 2 · the read writes nothing */
{
  const reader = codeOf(read(READER));
  for (const banned of [".insert(", ".update(", ".delete(", "for(\"update\")", "write", "Within("]) {
    assert.ok(!reader.includes(banned), `${READER} contains no ${banned}`);
  }
}

/* 3 · the stale-state questions run under the writer's lock */
{
  const writer = codeOf(read(WRITER));
  const lock = writer.indexOf('.for("update")');
  const expected = writer.indexOf('refused("revision-stale")');
  const basis = writer.indexOf('refused("review-basis-stale")');
  const insert = writer.indexOf(".insert(workArtifactRevisions)", lock);
  assert.ok(lock > 0 && expected > lock && basis > lock, "both refusals are decided after the artifact row is locked");
  assert.ok(insert > expected && insert > basis, "and before the revision is inserted");
}

/* 4 · the review writer: a shared lock, still no artifact write */
{
  const review = codeOf(read(REVIEW));
  assert.ok(review.includes('.for("share")'), "the review writer takes the shared artifact lock");
  for (const banned of ["update(workArtifacts)", "insert(workArtifacts)", "currentRevision"]) {
    assert.ok(!review.includes(banned), `the review writer still never reaches ${banned}`);
  }
}

/* 5 · no authority vocabulary */
for (const f of [READER, SEAM, UI]) {
  const code = codeOf(read(f));
  for (const banned of ["actionPermits", "hebyActionRequests", "actionExecutionAttempts", "agentMandate", "standingMutation", "recordActionRequest", "executeAuthorizedAction"]) {
    assert.ok(!code.includes(banned), `${f} names no ${banned}`);
  }
}

/* 6 · the UI sends the staleness keys only from the human's choice */
{
  const ui = codeOf(read(UI));
  assert.ok(/fromReview \? \{ expectedRevisionNo: fromReview\.revisionNo, reviewBasisDecisionId: fromReview\.decisionId \}/.test(ui), "keys come only from `fromReview`");
  assert.ok(/setFromReview\(\{ revisionNo: reason\.revisionNo, decisionId: reason\.decisionId \}\)/.test(ui), "`fromReview` is set only by the human's click on the shown reason");
  const actions = codeOf(read(ACTIONS));
  const fn = actions.slice(actions.indexOf("export async function readRevisionChangeRequestAction"));
  assert.ok(/readCurrentRevisionChangeRequest\(await resolveTenantContext\(\), input\)/.test(fn.slice(0, 400)), "the read action takes the tenant from the session, never the client");
}

/* 7 · LANGUAGE NEVER DECIDES ACCESS. No locale, language or header input reaches the read, the seam or the actions. */
for (const f of [READER, SEAM, ACTIONS]) {
  const code = codeOf(read(f));
  for (const banned of ["navigator.language", "accept-language", "Accept-Language", "locale", "Intl.", "toLocaleLowerCase", "normalize("]) {
    assert.ok(!code.includes(banned), `${f} reads no ${banned}`);
  }
}
{
  /* The reason is rendered as recorded and prefilled verbatim — no transform between the read and the textarea. */
  const ui = codeOf(read(UI));
  assert.ok(/\{reason\.justification\}/.test(ui), "the reason is rendered as recorded");
  assert.ok(/setInstruction\(reason\.justification\)/.test(ui), "and copied into the instruction verbatim");
}

console.log("PASS content-agent-2 surface and firewall");
