/*
 * R3A.1 — the boundaries the proposal inlet must never cross.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "`/send` is selected by a human typing a slash command and never by a model; it files a
 *    proposal and cannot approve, authorize, execute or send; and the four bound scalars are a real
 *    binding rather than a decorative one."
 *
 * Structural assertions run over source with comments stripped: they are about what the code can
 * reach, not about what its prose promises.
 *
 * Pure. No database, no network, no model.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { findHebyCommandById, HEBY_COMMANDS } from "../../src/features/heby-commands/registry";
import { planHebyCommand } from "../../src/features/heby-commands/dispatch";
import { parseHebyInput } from "../../src/features/heby-commands/parser";
import { getActionToolByKind } from "../../src/features/heby-actions/action-registry";
import { digestCanonicalAction } from "../../src/features/action-authorization/canonical-payload";
import { isRecipientRef } from "../../src/features/external-recipients/recipient-ref";
import { isWorkArtifactRef } from "../../src/features/work-artifacts/artifact-ref";
import { SEND_PROPOSAL_NON_EFFECTS } from "../../src/features/heby-action-inlet/contracts";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

const INLET_FILES = collect("src/features/heby-action-inlet");
const INLET_CODE = INLET_FILES.map((f) => codeOf(read(f))).join("\n");

const PLAN_CONTEXT = {
  surface: "full-workspace" as const,
  contextLabel: "Heby",
  contextDetail: [],
  evidenceLines: [],
  returnLabel: "Back",
};

const RECIPIENT = "external-recipient/0f2b7d1a-3c4e-4a5b-8c9d-0e1f2a3b4c5d";
const DRAFT = "work-artifact/1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5e@1";

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE MODEL SELECTS NOTHING.
 * ═════════════════════════════════════════════════════════════════════════ */

function actionSelectionIsDeterministic(): void {
  /* No model client, no transport, no provider anywhere in the inlet. */
  for (const forbidden of [
    "provider-invocation",
    "provider-framework",
    "features/providers",
    "anthropic",
    "openai",
    "fetch(",
    "heby-answer",
    "model-answer",
  ]) {
    assert.ok(
      !INLET_CODE.toLowerCase().includes(forbidden.toLowerCase()),
      `the inlet must not reach ${forbidden} — a proposal is never model-selected`,
    );
  }

  /* The action kind is a CONSTANT, not a variable the caller or a model could set. */
  const contracts = codeOf(read("src/features/heby-action-inlet/contracts.ts"));
  assert.ok(
    /SEND_ACTION_KIND\s*=\s*"send-external-communication"\s*as const/.test(contracts),
    "the action kind is a literal constant",
  );

  /* Ordinary prose is a prompt, never a command — there is no classifier to promote it. */
  for (const prose of [
    "send the quarterly summary to Ayşe",
    "please email jane about the invoice",
    "can you send this",
  ]) {
    const parsed = parseHebyInput(prose);
    assert.equal(parsed.kind, "prompt", `"${prose}" is conversation, not an action`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE PLANNER REFUSES ANYTHING THAT DOES NOT NAME RECORDS.
 * ═════════════════════════════════════════════════════════════════════════ */

function plannerRefusesNonReferences(): void {
  const send = findHebyCommandById("send");
  assert.ok(send, "/send is registered");
  assert.equal(send!.kind, "propose");
  assert.equal(send!.availability, "available");
  assert.equal(send!.requiresModel, false, "a proposal never reaches the model");
  assert.equal(send!.requiresExecution, false, "and it is not an execution command");
  assert.ok(
    !/\bsends?\b(?!\s*nothing)/i.test(send!.description) || /Sends nothing/i.test(send!.description),
    "the description must not claim it sends",
  );

  /* The happy shape plans a proposal. */
  const ok = planHebyCommand(send!, [RECIPIENT, DRAFT], PLAN_CONTEXT);
  assert.equal(ok.kind, "propose");

  /* Everything else refuses LOCALLY — before any server call could exist. */
  for (const args of [
    [],
    [RECIPIENT],
    ["the", "invoice"],
    ["ayse@example.com", DRAFT],
    [RECIPIENT, "Merhaba Ayşe"],
    [RECIPIENT.toUpperCase(), DRAFT],
    [`${RECIPIENT} `, DRAFT],
    [RECIPIENT, `${DRAFT}extra`],
    [DRAFT, RECIPIENT],
  ]) {
    const plan = planHebyCommand(send!, args, PLAN_CONTEXT);
    assert.equal(plan.kind, "unavailable", `[${args.join(", ")}] must not become a proposal`);
  }

  /* The planner's patterns and the owning authorities' parsers must agree. */
  const [recipientArg, draftArg] = send!.args;
  assert.ok(recipientArg!.pattern && draftArg!.pattern, "both arguments declare a shape");
  for (const value of [RECIPIENT, RECIPIENT.toUpperCase(), "nope", ""]) {
    assert.equal(
      recipientArg!.pattern!.test(value),
      isRecipientRef(value),
      `registry and R3R must agree on "${value}"`,
    );
  }
  for (const value of [DRAFT, `${DRAFT}0`, "work-artifact/x@1", ""]) {
    assert.equal(
      draftArg!.pattern!.test(value),
      isWorkArtifactRef(value),
      `registry and R3W must agree on "${value}"`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE HUMAN AUTHORITY FIREWALL.
 * ═════════════════════════════════════════════════════════════════════════ */

function authorityFirewall(): void {
  for (const forbidden of [
    "approveActionRequest",
    "rejectActionRequest",
    "revokeActionPermit",
    "consumeActionPermit",
    "writeGovernanceDecision",
    "actionPermits",
    "decisionRecords",
    "governanceSessions",
  ]) {
    assert.ok(!INLET_CODE.includes(forbidden), `the inlet must not reach ${forbidden}`);
  }

  /* /approve and /reject stay reserved and inert in Heby. */
  for (const id of ["approve", "reject", "execute", "run", "deploy", "terminal", "computer-use", "browser"]) {
    const command = findHebyCommandById(id);
    assert.ok(command, `/${id} is registered`);
    assert.equal(command!.kind, "reserved", `/${id} must stay reserved`);
    const plan = planHebyCommand(command!, [], PLAN_CONTEXT);
    assert.equal(plan.kind, "unavailable", `/${id} must dispatch nothing`);
  }

  /* Exactly ONE proposable command exists, so a second cannot appear unnoticed. */
  const proposable = HEBY_COMMANDS.filter((c) => c.kind === "propose").map((c) => c.id);
  assert.deepEqual(proposable, ["send"], "one proposable command");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. NO EXECUTION, NO PROVIDER, NO SECRET — release-critical.
 * ═════════════════════════════════════════════════════════════════════════ */

function executionFirewall(): void {
  for (const forbidden of [
    "nodemailer", "smtp", "sendgrid", "postmark", "mailgun",
    "apiKey", "accessToken", "clientSecret", "credential", "vault",
    "device-runtime", "computer-use", "child_process", "exec(", "spawn(",
    "executions", "schema/execution",
    /*
     * `executionReceipt`, NOT `receipt`. A bare "receipt" matches this domain's own
     * `SendProposalReceipt` — the thing a surface renders after filing — and banning the word would
     * fire on the very type the feature is built around. Ban the EXECUTION concept instead. This is
     * the second time in two phases that a vocabulary ban hit legitimate code; the rule is to
     * assert the claim, never the string.
     */
    "executionReceipt", "deliveryReceipt", "ExecutionReceipt",
  ]) {
    assert.ok(
      !INLET_CODE.toLowerCase().includes(forbidden.toLowerCase()),
      `the inlet must not reach ${forbidden}`,
    );
  }

  /* The tool itself still declares no substrate: approval mints a permit nothing can spend. */
  const tool = getActionToolByKind("send-external-communication");
  assert.ok(tool);
  assert.equal(tool!.substrateConnected, false, "R3A.1 connects NO execution substrate");
  assert.equal(tool!.authorityRequirement, "human-review-required");
  assert.equal(tool!.governanceGated, true);
  assert.equal(tool!.sideEffect, "CONSEQUENTIAL_MUTATION");
  assert.equal(tool!.reversibility, "irreversible");

  /*
   * And the sentences a surface may use are all DENIALS.
   *
   * The obvious form of this check — ban the words "authorized", "approved", "sent" — is wrong, and
   * it fired on the first attempt: the list literally says "nothing is authorized", which is the
   * sentence most worth keeping. The invariant is not vocabulary; it is that every entry NEGATES.
   */
  for (const line of SEND_PROPOSAL_NON_EFFECTS) {
    assert.match(
      line,
      /\b(no|nothing|never|not)\b/i,
      `every non-effect must be a denial, not a claim: "${line}"`,
    );
  }
  const claims = SEND_PROPOSAL_NON_EFFECTS.join(" ").toLowerCase();
  assert.ok(claims.includes("sends nothing"), "and it says plainly that nothing is sent");
  /* No entry may assert a completed act. */
  for (const lie of [/\bwas sent\b/i, /\bhas been approved\b/i, /\bsuccessfully\b/i, /\bscheduled\b/i]) {
    assert.ok(!lie.test(claims), `the non-effects list must not claim ${lie}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. THE INLET CANNOT CREATE A RECIPIENT OR AN ARTIFACT.
 * ═════════════════════════════════════════════════════════════════════════ */

function creationFirewall(): void {
  for (const forbidden of [
    "createExternalRecipient",
    "retireExternalRecipient",
    "createWorkArtifact",
    "reviseWorkArtifact",
    "retireWorkArtifact",
    "prepareWorkArtifact",
  ]) {
    assert.ok(
      !INLET_CODE.includes(forbidden),
      `the inlet must not reach ${forbidden} — "/send" never conjures its own referents`,
    );
  }
  /* It imports the READ side of both authorities and nothing else. */
  assert.ok(INLET_CODE.includes("resolveRecipientReference"), "it resolves a recipient");
  assert.ok(INLET_CODE.includes("resolveWorkArtifactReference"), "it resolves a draft");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. THE PRIVACY BOUNDARY.
 * ═════════════════════════════════════════════════════════════════════════ */

function privacyBoundary(): void {
  /* The raw address is never put into the payload, the receipt or a log. */
  assert.ok(!INLET_CODE.includes("endpointValue"), "the raw address never enters the proposal");
  assert.ok(INLET_CODE.includes("endpointDigest"), "only its digest does");
  assert.ok(!/console\.(log|info|warn|error)/.test(INLET_CODE), "the inlet logs nothing");

  /* The receipt a surface renders carries a label and references, never an address. */
  const contracts = codeOf(read("src/features/heby-action-inlet/contracts.ts"));
  const receipt = contracts.slice(contracts.indexOf("interface SendProposalReceipt"));
  assert.ok(!/email|address|endpointValue/i.test(receipt.slice(0, receipt.indexOf("}"))),
    "the receipt exposes no address field");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE BINDING IS REAL — all four scalars, order-independent.
 * ═════════════════════════════════════════════════════════════════════════ */

function digestIntegrity(): void {
  const tool = getActionToolByKind("send-external-communication")!;
  assert.deepEqual(
    tool.argumentSchema.fields.map((f) => f.name).sort(),
    ["draftRef", "draftRevisionDigest", "recipientEndpointDigest", "recipientRef"],
    "all four are DECLARED arguments — the digests are not smuggled in",
  );
  for (const field of tool.argumentSchema.fields) {
    assert.equal(field.required, true, `${field.name} is required`);
  }

  const A = "a".repeat(64);
  const B = "b".repeat(64);
  const OTHER_RECIPIENT = "external-recipient/22222222-2222-4222-8222-222222222222";
  const OTHER_DRAFT = "work-artifact/1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5e@2";

  const bind = (recipientRef: string, recipientEndpointDigest: string, draftRef: string, draftRevisionDigest: string) =>
    digestCanonicalAction({
      actionKind: "send-external-communication",
      toolId: "heby.operations.send-communication",
      targetKind: "record",
      targetRef: recipientRef,
      payload: { recipientRef, recipientEndpointDigest, draftRef, draftRevisionDigest },
    });

  const approved = bind(RECIPIENT, A, DRAFT, A);
  assert.match(approved, /^[0-9a-f]{64}$/);
  assert.equal(approved, bind(RECIPIENT, A, DRAFT, A), "deterministic");

  /* Each of the four moves it independently. */
  assert.notEqual(approved, bind(OTHER_RECIPIENT, A, DRAFT, A), "a different recipient");
  assert.notEqual(approved, bind(RECIPIENT, B, DRAFT, A), "a different ADDRESS — the retire/recreate case");
  assert.notEqual(approved, bind(RECIPIENT, A, OTHER_DRAFT, A), "a different revision");
  assert.notEqual(approved, bind(RECIPIENT, A, DRAFT, B), "different draft bytes");

  /* Key order does not. */
  const reordered = digestCanonicalAction({
    actionKind: "send-external-communication",
    toolId: "heby.operations.send-communication",
    targetKind: "record",
    targetRef: RECIPIENT,
    payload: { draftRevisionDigest: A, draftRef: DRAFT, recipientEndpointDigest: A, recipientRef: RECIPIENT },
  });
  assert.equal(reordered, approved, "key ORDER does not change the binding");

  /* The FNV action id is never the binding. */
  const inlet = codeOf(read("src/features/heby-action-inlet/send-proposal.server.ts"));
  assert.ok(!/actionId/.test(inlet), "the 32-bit action id is not used as an approval binding");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. THE ANSWER FLOW STILL FILES NOTHING.
 * ═════════════════════════════════════════════════════════════════════════ */

function answerFlowFilesNothing(): void {
  const answer = codeOf(read("src/features/heby-answer/model-answer.server.ts"));
  for (const forbidden of ["recordActionRequest", "proposeSendAction", "heby-action-inlet"]) {
    assert.ok(
      !answer.includes(forbidden),
      `an ordinary Heby answer must not reach ${forbidden} — a proposal has its own seam`,
    );
  }

  /* And exactly one production module calls the R3A writer. */
  const callers = collect("src")
    .filter((f) => codeOf(read(f)).includes("recordActionRequest"))
    .filter((f) => !f.endsWith("record-action-request.server.ts"));
  assert.deepEqual(
    callers,
    ["src/features/heby-action-inlet/send-proposal.server.ts"],
    "exactly one production caller of recordActionRequest",
  );
}

actionSelectionIsDeterministic();
plannerRefusesNonReferences();
authorityFirewall();
executionFirewall();
creationFirewall();
privacyBoundary();
digestIntegrity();
answerFlowFilesNothing();

console.log("PASS r3a1 boundaries and firewall");
