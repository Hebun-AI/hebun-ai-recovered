/*
 * E2-5 · PRODUCTION DEFECT — OBSERVATION != ACTION CLAIM.
 *
 * The real failure this pins: in authenticated production, "What has Heby proposed, and what became
 * of those proposals?" was WITHHELD. Both the model's prose and Heby's own deterministic
 * composition were refused, with:
 *
 *     Response claims an action ("approved") that did not occur.
 *     Response claims an action ("authorized") that did not occur.
 *
 * Nothing had claimed an action. The offending text was E2-4's evidence labels —
 * "Approved with no execution attempt recorded" and "Authorized and not yet used" — and the honest
 * model sentence "Neither has been approved or rejected". The honest answer to the question is
 * unsayable without the word "approved", so the surface said nothing at all.
 *
 * The guarantee is unchanged and re-proved below: Heby may never claim to have acted.
 *
 *     PAST RECORDED GOVERNANCE STATE != HEBY EXERCISING GOVERNANCE AUTHORITY
 *     NO VERB IS ALLOWLISTED — every one still fails in the shape that matters.
 */
import assert from "node:assert/strict";

import { validateResponse, claimsAnAction } from "../../src/features/heby-runtime/response-validator";
import { buildResponse } from "../../src/features/heby-runtime/response-builder";
import { assembleEvidence } from "../../src/features/heby-runtime/evidence-assembler";
import type { HebyRuntimeResponse, SourceResolution } from "../../src/features/heby-runtime";

/** The two E2-4 labels, verbatim, as production composed them. */
const OPERATIONS: SourceResolution = {
  sourceClass: "operations",
  state: "resolved",
  provenance: "Attention observation — derived elapsed time over authoritative records.",
  authoritative: false,
  items: [
    {
      recordRef: "attention:approved-without-attempt",
      label: "Approved with no execution attempt recorded",
      detail: "0 approved with no attempt · oldest approved no elapsed observation available ago",
      lifecycle: "settled",
    },
    {
      recordRef: "attention:authorized-unspent",
      label: "Authorized and not yet used",
      detail: "0 active · soonest expiry no elapsed observation available",
      lifecycle: "settled",
    },
  ],
};

/** The agent grounding, with production's real shape. */
const AGENTS: SourceResolution = {
  sourceClass: "agents",
  state: "resolved",
  provenance: "Agent Outcome Observation — DERIVED (authoritative: false).",
  authoritative: false,
  items: [
    {
      recordRef: "Heby",
      label: "Heby",
      detail:
        "in service · proposals filed 2 · awaiting a decision 2 · withdrawn 0 · " +
        "governance approvals 0 · governance rejections 0 · permits issued 0 · " +
        "approvals with no execution attempt 0 · execution attempts 0",
      lifecycle: "settled",
    },
  ],
};

function modelAnswer(body: readonly string[]): HebyRuntimeResponse {
  return {
    kind: "EXPLANATION",
    origin: "model",
    title: "command — system state",
    body: [...body],
    evidence: [],
    provenance: [],
    provenanceCovered: [],
    uncertainty: "supported",
    limitations: [],
    authority: "advisory-only",
    modelUsed: true,
  } as HebyRuntimeResponse;
}

function main(): void {
  /* ── 1 · THE PRODUCTION CASE: THE DETERMINISTIC COMPOSITION MUST NOT BE WITHHELD ─── */
  {
    const resolutions = [OPERATIONS, AGENTS];
    const response = buildResponse("INVESTIGATE", { workspace: "command", route: "/heby" }, resolutions);
    const verdict = validateResponse(response, assembleEvidence(resolutions), "advisory-only");
    assert.equal(
      verdict.valid,
      true,
      `the production composition must pass validation; issues: ${verdict.issues.join(" | ")}`,
    );
    assert.notEqual(verdict.response.title, "Response withheld");

    /* The evidence really is present — this is not passing because the body went empty. */
    const body = verdict.response.body.join(" ");
    assert.match(body, /Approved with no execution attempt recorded/);
    assert.match(body, /Authorized and not yet used/);
    assert.match(body, /proposals filed 2/);
  }

  /* ── 2 · THE PRODUCTION QUESTION, ANSWERED BY A MODEL, MUST NOT BE WITHHELD ──────── */
  {
    /* Grounded in the real production numbers: 2 filed, 2 awaiting, 0 approvals, 0 attempts. */
    const answer = modelAnswer([
      "Heby has filed 2 proposals, and both are still awaiting a human decision.",
      "Neither has been approved or rejected, no permit has been issued, and no execution " +
        "attempt has been recorded against either one.",
    ]);
    const verdict = validateResponse(answer, [], "advisory-only");
    assert.equal(
      verdict.valid,
      true,
      `the grounded observational answer must pass; issues: ${verdict.issues.join(" | ")}`,
    );
  }

  /* ── 3 · REPORTING WHOSE AUTHORITY ACTED IS AN OBSERVATION ───────────────────────── */
  {
    for (const sentence of [
      "The proposal was approved by governance.",
      "The action was authorized by the Director.",
      "The permit was rejected by a human reviewer.",
    ]) {
      const verdict = validateResponse(modelAnswer([sentence]), [], "advisory-only");
      assert.equal(verdict.valid, true, `must be permitted as an observation: ${sentence}`);
    }
  }

  /* ── 4 · HEBY STILL MAY NOT CLAIM TO HAVE ACTED ──────────────────────────────────── */
  {
    /*
     * The released negatives from `heby-runtime/runtime.ts` and `r2c-flow/model-answer-flow.ts`
     * are included verbatim, so this file cannot pass while those regress.
     */
    for (const sentence of [
      "The deploy was executed.",
      "The task was executed.",
      "I deleted the records.",
      "Policy updated successfully.",
      "Decision recorded.",
      "I approved the proposal.",
      "I authorized the action.",
      "I executed the action.",
      "We approved it.",
      "Heby approved the proposal.",
      "The proposal was approved by Heby.",
      "The action was executed by me.",
      /* A negation elsewhere in the sentence must not license the claim. */
      "No issues at all, I executed it.",
      "There were no problems and the deploy was executed.",
    ]) {
      const verdict = validateResponse(modelAnswer([sentence]), [], "advisory-only");
      assert.equal(verdict.valid, false, `must still be refused: ${sentence}`);
      assert.equal(verdict.response.title, "Response withheld");
    }
  }

  /* ── 5 · NO VERB WAS ALLOWLISTED ─────────────────────────────────────────────────── */
  {
    /*
     * Each banned verb still fails in the self-attributed shape. A fix that had merely dropped a
     * word from the list would pass sections 1-3 and fail here.
     */
    for (const [verb, sentence] of [
      ["approved", "I approved it."],
      ["rejected", "I rejected it."],
      ["authorized", "I authorized it."],
      ["executed", "I executed it."],
      ["deployed", "I deployed it."],
      ["deleted", "I deleted it."],
      ["policy updated", "Policy updated."],
      ["decision recorded", "Decision recorded."],
    ] as const) {
      assert.equal(claimsAnAction(sentence, verb), true, `"${verb}" must still be refused: ${sentence}`);
    }
  }

  /* ── 6 · THE NEGATED AND DENIED FORMS ARE OBSERVATIONS ───────────────────────────── */
  {
    for (const [verb, sentence] of [
      ["approved", "Nothing has been approved."],
      ["approved", "0 approved with no attempt."],
      ["approved", "Approved with no execution attempt recorded."],
      ["authorized", "Authorized and not yet used."],
      ["executed", "Nothing was executed."],
      ["executed", "The action was never executed."],
      ["approved", "I have not approved anything."],
      ["rejected", "Neither has been approved or rejected."],
    ] as const) {
      assert.equal(claimsAnAction(sentence, verb), false, `must read as an observation: ${sentence}`);
    }
  }

  /* ── 7 · A REFUSAL IN ONE SENTENCE DOES NOT LICENSE THE NEXT ─────────────────────── */
  {
    assert.equal(
      claimsAnAction("Nothing has been approved. I approved the second one.", "approved"),
      true,
      "each sentence is judged on its own",
    );
  }

  console.log("e25-agent-grounding/action-claim-semantics: OK");
}

main();
