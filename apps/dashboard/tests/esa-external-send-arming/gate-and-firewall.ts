/*
 * ESA — THE PRODUCTION EXTERNAL-SEND ARMING GATE (pure + structural, no database).
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Production external-send becomes reachable only through one deliberate ceremony that proves
 *    configuration, recipients and blast radius first — while the generic connectivity ceremony
 *    still refuses it, and arming still authorizes nothing."
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ARMING_NON_EFFECTS,
  ARMING_TRANSITIONS,
  evaluateExternalSendArming,
  isArmingTransition,
  PRODUCTION_ARMING_CONFIRMATION,
  PRODUCTION_DISARMING_CONFIRMATION,
  readConfigurationPresence,
  type RecipientReach,
} from "../../scripts/lib/external-send-arming";
import {
  EXTERNAL_SEND_API_KEY_ENV,
  EXTERNAL_SEND_FROM_ENV,
  EXTERNAL_SEND_SUBJECT_ENV,
} from "../../src/features/action-execution-live/resend-email-transport.server";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CLI = "scripts/external-send-arming.ts";
const LIB = "scripts/lib/external-send-arming.ts";
const GENERIC = "scripts/provider-connectivity.ts";

/** A complete configuration. NEVER a real credential — presence is all this gate ever reads. */
const CONFIGURED = {
  [EXTERNAL_SEND_API_KEY_ENV]: "not-a-real-key",
  [EXTERNAL_SEND_FROM_ENV]: "sender@example.test",
  [EXTERNAL_SEND_SUBJECT_ENV]: "Fixed subject",
} as const;

const REACHABLE: RecipientReach = { readable: true, activeRecipients: 1, tenantsWithRecipients: 1 };

/* ── 1. THE GENERIC CEREMONY STILL REFUSES EXTERNAL SEND IN PRODUCTION ────── */
{
  const generic = codeOf(read(GENERIC));
  assert.match(
    generic,
    /if \(environment\.posture\.mode === "production" && providerKey === EXTERNAL_SEND_PROVIDER_KEY\) \{/,
    "the released refusal is intact — this gate exists BESIDE it, never instead of it",
  );
  const guard = generic.indexOf('environment.posture.mode === "production" && providerKey');
  const write = generic.indexOf("setProviderConnectivity(client");
  assert.ok(guard > -1 && write > -1 && guard < write, "and it still refuses BEFORE any write");
}

/* ── 2. THE NEW CEREMONY IS PRODUCTION-ONLY, IN BOTH DIRECTIONS ───────────── */
{
  for (const transition of ARMING_TRANSITIONS) {
    for (const postureMode of ["local", "refused"] as const) {
      const verdict = evaluateExternalSendArming({
        transition,
        postureMode,
        currentlyArmed: transition === "disarm",
        reach: REACHABLE,
        env: CONFIGURED,
      });
      assert.equal(verdict.status, "refused");
      assert.equal(
        verdict.status === "refused" && verdict.reason,
        "not-production-posture",
        `${transition} under ${postureMode} posture is refused before anything else is considered`,
      );
    }
  }
  assert.ok(isArmingTransition("arm") && isArmingTransition("disarm"));
  assert.ok(!isArmingTransition("enable"), "the generic verbs have no representation here");
  assert.ok(!isArmingTransition("send"), "and neither does anything that sounds like execution");
}

/* ── 3. ARMING REFUSES INCOMPLETE CONFIGURATION, AND NAMES ONLY THE KEYS ──── */
{
  const cases: ReadonlyArray<readonly [string, Record<string, string>]> = [
    [EXTERNAL_SEND_API_KEY_ENV, { [EXTERNAL_SEND_FROM_ENV]: "s@example.test", [EXTERNAL_SEND_SUBJECT_ENV]: "S" }],
    [EXTERNAL_SEND_FROM_ENV, { [EXTERNAL_SEND_API_KEY_ENV]: "k", [EXTERNAL_SEND_SUBJECT_ENV]: "S" }],
    [EXTERNAL_SEND_SUBJECT_ENV, { [EXTERNAL_SEND_API_KEY_ENV]: "k", [EXTERNAL_SEND_FROM_ENV]: "s@example.test" }],
  ];
  for (const [missing, env] of cases) {
    const verdict = evaluateExternalSendArming({
      transition: "arm",
      postureMode: "production",
      currentlyArmed: undefined,
      reach: REACHABLE,
      env,
    });
    assert.equal(verdict.status === "refused" && verdict.reason, "configuration-incomplete");
    assert.deepEqual(
      verdict.status === "refused" ? verdict.missingKeys : [],
      [missing],
      `${missing} absent is refused, and the diagnostic names the KEY`,
    );
  }
  /* Whitespace is not configuration. */
  const blank = readConfigurationPresence({
    [EXTERNAL_SEND_API_KEY_ENV]: "   ",
    [EXTERNAL_SEND_FROM_ENV]: "\t",
    [EXTERNAL_SEND_SUBJECT_ENV]: "",
  });
  assert.equal(blank.missingKeys.length, 3, "blank values are absent values");
}

/* ── 4. UNREADABLE RECIPIENTS != ZERO RECIPIENTS ──────────────────────────── */
{
  const unreadable = evaluateExternalSendArming({
    transition: "arm",
    postureMode: "production",
    currentlyArmed: undefined,
    reach: { readable: false, activeRecipients: 0, tenantsWithRecipients: 0 },
    env: CONFIGURED,
  });
  assert.equal(
    unreadable.status === "refused" && unreadable.reason,
    "recipient-authority-unavailable",
    "a failed read must never be reported as a deployment holding nobody",
  );

  const empty = evaluateExternalSendArming({
    transition: "arm",
    postureMode: "production",
    currentlyArmed: undefined,
    reach: { readable: true, activeRecipients: 0, tenantsWithRecipients: 0 },
    env: CONFIGURED,
  });
  assert.equal(empty.status === "refused" && empty.reason, "no-active-recipient");
}

/* ── 5. STATE TRANSITIONS ARE EXACT ───────────────────────────────────────── */
{
  const ready = evaluateExternalSendArming({
    transition: "arm",
    postureMode: "production",
    currentlyArmed: undefined,
    reach: REACHABLE,
    env: CONFIGURED,
  });
  assert.equal(ready.status, "ready", "complete configuration + a real recipient may arm");

  const already = evaluateExternalSendArming({
    transition: "arm",
    postureMode: "production",
    currentlyArmed: true,
    reach: REACHABLE,
    env: CONFIGURED,
  });
  assert.equal(already.status === "refused" && already.reason, "already-armed");

  for (const currentlyArmed of [undefined, false] as const) {
    const notArmed = evaluateExternalSendArming({
      transition: "disarm",
      postureMode: "production",
      currentlyArmed,
      reach: REACHABLE,
      env: CONFIGURED,
    });
    assert.equal(
      notArmed.status === "refused" && notArmed.reason,
      "not-armed",
      "an absent row already reads as disarmed everywhere",
    );
  }
}

/* ── 6. DISARMING IS NEVER GATED ON CONFIGURATION OR RECIPIENTS ───────────── */
{
  /*
   * THE KILL SWITCH MUST CLOSE UNDER A DEGRADED DEPLOYMENT. This is the asymmetry the writer
   * already states for its own gate, applied here. A disarm that required a healthy configuration
   * would fail in the one direction that matters.
   */
  const disarm = evaluateExternalSendArming({
    transition: "disarm",
    postureMode: "production",
    currentlyArmed: true,
    reach: { readable: false, activeRecipients: 0, tenantsWithRecipients: 0 },
    env: {},
  });
  assert.equal(disarm.status, "ready", "no credential, no sender, no subject, no readable recipients — and it still closes");
}

/* ── 7. NO SECRET, NO VALUE, ANYWHERE ─────────────────────────────────────── */
{
  for (const file of [LIB, CLI]) {
    const code = codeOf(read(file));
    /* The value-returning resolvers may be CALLED, but no value may be printed or returned. */
    assert.ok(
      !/console\.log\([^)]*resolveExternalSendSender|console\.log\([^)]*resolveExternalSendSubject/.test(code),
      `${file} must never print a configuration value`,
    );
    assert.ok(
      !new RegExp(`${EXTERNAL_SEND_API_KEY_ENV}\\]`).test(code) || file === LIB,
      `${file} must not index the credential out of the environment`,
    );
    assert.ok(!/apiKey\s*[:=]/.test(code), `${file} must hold no apiKey field or variable`);
  }
  /* The presence reader returns booleans and NAMES. Nothing it returns can carry a value. */
  const presence = readConfigurationPresence(CONFIGURED);
  const serialized = JSON.stringify(presence);
  for (const value of Object.values(CONFIGURED)) {
    assert.ok(!serialized.includes(value), "no configured value may appear in the presence report");
  }
  assert.deepEqual(presence, {
    apiKeyPresent: true,
    senderPresent: true,
    subjectPresent: true,
    missingKeys: [],
  });
}

/* ── 8. ARMING TOUCHES NOTHING BUT THE ONE CONTROL ROW ────────────────────── */
{
  for (const file of [LIB, CLI]) {
    const code = codeOf(read(file)).toLowerCase();
    for (const forbidden of [
      "heby_action_requests",
      "action_permits",
      "action_execution_attempts",
      "decision_records",
      "governance_sessions",
      "knowledge_nodes",
      "audit_log",
      "insert into",
      "update ",
      "delete from",
      "fetch(",
      /*
       * NOT a ban on the string "resend": the lib legitimately IMPORTS the presence helpers from
       * the transport module, and banning the vendor name would fail on that honest import. The
       * property is that no transport is ever CONSTRUCTED and no endpoint is ever named.
       */
      "createresendemailtransport",
      "resend_send_endpoint",
      "api.resend.com",
    ]) {
      assert.ok(
        !code.includes(forbidden),
        `${file} must not reach ${forbidden.trim()} — arming is a boolean, not an act`,
      );
    }
  }
  /* The ONLY write is the released writer, called once. */
  const cli = codeOf(read(CLI));
  assert.equal(
    (cli.match(/setProviderConnectivity\(/g) ?? []).length,
    1,
    "exactly one write call, through the existing authority",
  );
  assert.ok(
    !/provider_connectivity_controls/.test(cli),
    "and it never writes that table directly — the released writer owns the statement",
  );
}

/* ── 9. THE CONFIRMATION IS INTERACTIVE, EXACT, AND HARDER THAN THE GENERIC ─ */
{
  const cli = codeOf(read(CLI));
  assert.match(cli, /isTTY/, "a piped confirmation is refused");
  assert.match(cli, /confirmation !== phrase/, "the phrase must match exactly");
  assert.ok(
    PRODUCTION_ARMING_CONFIRMATION.length > "external-send".length,
    "the phrase is longer than the provider key the generic ceremony asks for",
  );
  assert.notEqual(PRODUCTION_ARMING_CONFIRMATION, PRODUCTION_DISARMING_CONFIRMATION);
  const guard = cli.indexOf("confirmation !== phrase");
  const write = cli.indexOf("setProviderConnectivity(");
  assert.ok(guard > -1 && write > guard, "and it is checked BEFORE the write");
  /* NODE_ENV=production refuses, like its sibling. */
  assert.match(cli, /process\.env\.NODE_ENV === "production"/);
}

/* ── 10. THE NON-EFFECTS ARE STATED, BY EQUALITY ──────────────────────────── */
{
  assert.ok(Object.isFrozen(ARMING_NON_EFFECTS));
  for (const claim of [
    "does not approve any action request",
    "does not create, issue or consume a permit",
    "does not execute anything or send any message",
  ]) {
    assert.ok(ARMING_NON_EFFECTS.includes(claim), `the ceremony states: ${claim}`);
  }
  const cli = read(CLI);
  assert.match(cli, /Armed is not authorized/, "and it says so where the operator will read it");
  assert.match(cli, /has no tenant_id/, "and it does not claim tenant containment it lacks");
  assert.match(
    cli,
    /Per-tenant containment does not exist and is required before a second tenant/,
    "the limitation is recorded truthfully at the moment of arming",
  );
}

console.log("ESA gate and firewall: PASS");
