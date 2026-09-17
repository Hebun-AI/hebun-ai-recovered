/*
 * RUNG 1 — THE PRODUCTION ARMING BOUNDARY (pure + structural, no database).
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Production machine-internal-execution becomes reachable only through one deliberate ceremony
 *    that states its blast radius first; the generic connectivity ceremony refuses it — and refuses
 *    every key nobody has decided on — while arming still authorizes nothing and executes nothing."
 *
 * ── WHY IT ALSO RE-PROVES THINGS THE RELEASED SUITES COVER ───────────────────
 *
 * The released narrowing was an ALLOW-BY-DEFAULT equality: it named `external-send` and admitted
 * every other key. Replacing it with a fail-closed enumeration changes the shape the ESA and R2H
 * firewalls were anchored to, so those files were restated to assert the PROPERTY rather than that
 * one conditional's spelling. This file is where the property itself is pinned by value.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DEDICATED_PRODUCTION_CEREMONIES,
  GENERIC_PRODUCTION_REACHABLE_KEYS,
  PROVIDER_KEYS,
  resolveGenericProductionReach,
} from "../../scripts/lib/provider-connectivity";
import {
  evaluateMachineExecutionArming,
  isMachineArmingTransition,
  MACHINE_ARMING_EFFECT,
  MACHINE_ARMING_NON_EFFECTS,
  MACHINE_ARMING_TRANSITIONS,
  MACHINE_EXECUTABLE_SCOPE,
  MACHINE_PRODUCTION_ARMING_CONFIRMATION,
  MACHINE_PRODUCTION_DISARMING_CONFIRMATION,
} from "../../scripts/lib/machine-execution-arming";
import { MACHINE_INTERNAL_EXECUTION_CONTROL_KEY } from "../../src/features/governed-machine-execution/machine-execution-control.server";
import { MACHINE_EXECUTABLE_ACTION_KINDS } from "../../src/features/governed-machine-execution/execute-record-work-as-machine.server";
import { EXTERNAL_SEND_PROVIDER_KEY } from "../../src/features/action-execution/contracts";
import { CLAUDE_PROVIDER_KEY } from "../../src/features/heby-provider-ops/provider-connectivity-control.server";
import { OBSERVATION_READ_CONTROL_KEY } from "../../src/features/standing-observation-authority/contracts";
import { OPENAI_IMAGE_GENERATION_CONTROL_KEY } from "../../src/features/media-generation-live/openai-image-control";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const CLI = "scripts/machine-execution-arming.ts";
const LIB = "scripts/lib/machine-execution-arming.ts";
const GENERIC = "scripts/provider-connectivity.ts";

/* ── A. THE GENERIC PRODUCTION PATH CANNOT REACH THE MACHINE KEY ──────────── */
{
  const verdict = resolveGenericProductionReach(MACHINE_INTERNAL_EXECUTION_CONTROL_KEY);
  assert.equal(verdict.status, "refused", "machine-internal-execution is not generically reachable");
  assert.equal(
    verdict.status === "refused" && verdict.dedicatedCommand,
    "npm run platform:machine-execution -- arm",
    "and the refusal names the gate that owns it",
  );

  /*
   * THE KEY IS STILL EXPRESSIBLE, and that is not a contradiction. The writer refuses every key
   * outside `PROVIDER_KEYS`, so a permission absent from the vocabulary would have no DISARM
   * either. Reachability is decided separately, and fail-closed.
   */
  assert.ok(
    PROVIDER_KEYS.includes(MACHINE_INTERNAL_EXECUTION_CONTROL_KEY),
    "the key is expressible, so the switch has an OFF as well as an ON",
  );
  assert.ok(
    !GENERIC_PRODUCTION_REACHABLE_KEYS.includes(MACHINE_INTERNAL_EXECUTION_CONTROL_KEY),
    "and expressible did not make it production-reachable through the generic path",
  );
}

/* ── A2. THE GENERIC GUARD IS LIVE, ANCHORED, AND REFUSES BEFORE ANY I/O ──── */
{
  const cli = codeOf(read(GENERIC));

  /*
   * ANCHORED TO `if (` IMMEDIATELY FOLLOWED BY THE POSTURE TEST, with the decision CAPTURED as a
   * call rather than matched as a substring. A substring check survives `if (false && ...)`, which
   * reads as present while being permanently dead.
   */
  const guard = cli.match(
    /if\s*\(\s*environment\.posture\.mode\s*===\s*"production"\s*&&\s*([A-Za-z_$][\w$]*)\.status\s*===\s*"refused"\s*\)\s*\{/,
  );
  assert.ok(guard, "the narrowing is a LIVE `if`, not a dead, reshaped or commented condition");

  /* The thing it tests is the released resolver's verdict, not a literal at the call site. */
  const bound = new RegExp(
    `const\\s+${guard![1]}\\s*=\\s*resolveGenericProductionReach\\(providerKey\\)`,
  );
  assert.match(cli, bound, "and what it tests is the fail-closed resolver, given the actual key");

  /* NOT AN EQUALITY AGAINST ONE KEY ANY MORE — that shape is what admitted everything else. */
  assert.doesNotMatch(
    cli,
    /posture\.mode === "production" && providerKey ===/,
    "the allow-by-default equality is gone, not merely supplemented",
  );

  const guardAt = guard!.index!;
  const reads = [...cli.matchAll(/readProviderControl\s*\(/g)].map((m) => m.index!);
  const writes = [...cli.matchAll(/setProviderConnectivity\s*\(/g)].map((m) => m.index!);
  assert.ok(reads.length > 0 && writes.length > 0, "the ceremony does read and write somewhere");

  /* Its own sentence — "nothing was read… nothing was written" — made true. */
  assert.ok(reads.every((at) => guardAt < at), "it refuses BEFORE the control table is read");
  assert.ok(writes.every((at) => guardAt < at), "and BEFORE every control table write");

  /* The branch releases the connection and HALTS — no fall-through, no leaked client. */
  const branch = cli.slice(guardAt, reads[0]);
  assert.match(
    branch,
    /await client\.end\(\)\s*;\s*fail\(/,
    "the guarded branch closes the client and then refuses fatally",
  );

  /* MODEL CONNECTIVITY IS NOT WHAT IS BEING REFUSED — not by constant, and not by literal. */
  assert.doesNotMatch(
    branch,
    /CLAUDE_PROVIDER_KEY|"claude"/,
    "the production refusal does not reach the model key",
  );
}

/* ── D + E. THE RELEASED REACHABILITY DECISIONS ARE PRESERVED, BY VALUE ───── */
{
  assert.deepEqual(
    [...GENERIC_PRODUCTION_REACHABLE_KEYS].sort(),
    [CLAUDE_PROVIDER_KEY, OBSERVATION_READ_CONTROL_KEY, OPENAI_IMAGE_GENERATION_CONTROL_KEY].sort(),
    "R2H's model decision, TRH-25's read decision and MEDIA-2B's generation decision, enumerated",
  );
  assert.equal(resolveGenericProductionReach(CLAUDE_PROVIDER_KEY).status, "reachable");
  assert.equal(resolveGenericProductionReach(OBSERVATION_READ_CONTROL_KEY).status, "reachable");
  /*
   * MEDIA-2B took the production decision for paid image generation, so the generic ceremony now
   * reaches it. REACHABLE IS NOT ARMED: with no row the released reader still answers OFF, and the
   * resolver additionally requires `HEBUN_MEDIA_GENERATION_TRANSPORT=live` and a credential-shaped
   * key on every call. This asserts only that a Director ceremony CAN now decide it.
   */
  assert.equal(resolveGenericProductionReach(OPENAI_IMAGE_GENERATION_CONTROL_KEY).status, "reachable");

  const send = resolveGenericProductionReach(EXTERNAL_SEND_PROVIDER_KEY);
  assert.equal(send.status, "refused", "ESA's refusal survives the reshaping");
  assert.equal(
    send.status === "refused" && send.dedicatedCommand,
    "npm run platform:external-send -- arm",
    "and still sends the operator to ESA's own gate",
  );

  assert.deepEqual(
    Object.keys(DEDICATED_PRODUCTION_CEREMONIES).sort(),
    [EXTERNAL_SEND_PROVIDER_KEY, MACHINE_INTERNAL_EXECUTION_CONTROL_KEY].sort(),
    "exactly two keys hold dedicated gates today",
  );
}

/* ── F. A NEW STRING INHERITS NOTHING ─────────────────────────────────────── */
{
  for (const unknown of [
    "",
    "   ",
    "openai",
    "CLAUDE",
    "Claude",
    "external_send",
    "machine_internal_execution",
    "MACHINE-INTERNAL-EXECUTION",
    "machine-internal-execution-v2",
    "some-capability-a-later-phase-adds",
    undefined,
  ]) {
    const verdict = resolveGenericProductionReach(unknown as string | undefined);
    assert.equal(
      verdict.status,
      "refused",
      `"${String(unknown)}" must not become production-reachable merely by being a string`,
    );
    assert.equal(
      verdict.status === "refused" && verdict.dedicatedCommand,
      null,
      "and a key with no gate is refused with nothing to fall back to",
    );
  }
  /* Whitespace around a reachable key is still that key, not a new one. */
  assert.equal(resolveGenericProductionReach(`  ${CLAUDE_PROVIDER_KEY}  `).status, "reachable");
}

/* ── THE VOCABULARY GREW BY ONE ROW, AND IS STILL ENUMERATED ──────────────── */
{
  assert.deepEqual(
    [...PROVIDER_KEYS].sort(),
    [
      CLAUDE_PROVIDER_KEY,
      EXTERNAL_SEND_PROVIDER_KEY,
      OBSERVATION_READ_CONTROL_KEY,
      MACHINE_INTERNAL_EXECUTION_CONTROL_KEY,
      /* MEDIA-2A: expressible for local arming; refused in production until MEDIA-2B. */
      OPENAI_IMAGE_GENERATION_CONTROL_KEY,
    ].sort(),
    "exactly the five control keys the repository defines",
  );
  assert.ok(Object.isFrozen(PROVIDER_KEYS) && Object.isFrozen(GENERIC_PRODUCTION_REACHABLE_KEYS));
  assert.ok(Object.isFrozen(DEDICATED_PRODUCTION_CEREMONIES));
}

/* ── THE DEDICATED CEREMONY IS PRODUCTION-ONLY, IN BOTH DIRECTIONS ────────── */
{
  for (const transition of MACHINE_ARMING_TRANSITIONS) {
    for (const postureMode of ["local", "refused"] as const) {
      const verdict = evaluateMachineExecutionArming({
        transition,
        postureMode,
        currentlyArmed: transition === "disarm",
      });
      assert.equal(verdict.status, "refused");
      assert.equal(
        verdict.status === "refused" && verdict.reason,
        "not-production-posture",
        `${transition} under ${postureMode} posture is refused before anything else is considered`,
      );
    }
  }
  assert.ok(isMachineArmingTransition("arm") && isMachineArmingTransition("disarm"));
  assert.ok(!isMachineArmingTransition("enable"), "the generic verbs have no representation here");
  assert.ok(!isMachineArmingTransition("execute"), "and neither does anything that sounds like an act");
  assert.ok(!isMachineArmingTransition("trigger"));
}

/* ── DISARMING IS EASIER THAN ARMING, AND NEVER BLOCKED BY A PRECONDITION ── */
{
  /* An empty released scope stops ARMING and does not stop DISARMING. */
  const armWithNoScope = evaluateMachineExecutionArming({
    transition: "arm",
    postureMode: "production",
    currentlyArmed: undefined,
    scope: [],
  });
  assert.equal(
    armWithNoScope.status === "refused" && armWithNoScope.reason,
    "no-machine-executable-scope",
    "arming a capability with nothing it may do is refused",
  );
  const disarmWithNoScope = evaluateMachineExecutionArming({
    transition: "disarm",
    postureMode: "production",
    currentlyArmed: true,
    scope: [],
  });
  assert.equal(
    disarmWithNoScope.status,
    "ready",
    "a kill switch that needed a healthy build to close would fail in the one direction that matters",
  );

  /* Idempotence in both directions, with an absent row reading as disarmed. */
  for (const currentlyArmed of [undefined, false] as const) {
    const verdict = evaluateMachineExecutionArming({
      transition: "disarm",
      postureMode: "production",
      currentlyArmed,
    });
    assert.equal(verdict.status === "refused" && verdict.reason, "not-armed");
  }
  const already = evaluateMachineExecutionArming({
    transition: "arm",
    postureMode: "production",
    currentlyArmed: true,
  });
  assert.equal(already.status === "refused" && already.reason, "already-armed");

  const ready = evaluateMachineExecutionArming({
    transition: "arm",
    postureMode: "production",
    currentlyArmed: undefined,
  });
  assert.equal(ready.status, "ready");
}

/* ── THE SCOPE IS READ FROM THE RELEASED BUILD, NOT RESTATED ──────────────── */
{
  assert.deepEqual(
    [...MACHINE_EXECUTABLE_SCOPE],
    [...MACHINE_EXECUTABLE_ACTION_KINDS].sort(),
    "the ceremony shows exactly what the released frozen set admits",
  );
  assert.ok(Object.isFrozen(MACHINE_EXECUTABLE_SCOPE));
  const lib = codeOf(read(LIB));
  assert.doesNotMatch(
    lib,
    /"record-work"/,
    "and it never hard-codes the scope, which is how a ceremony starts lying about the build",
  );
}

/* ── B + J. THE WRITE AND THE READ ARE THE RELEASED SEAMS, ONCE EACH ──────── */
{
  const cli = codeOf(read(CLI));
  assert.equal(
    (cli.match(/setProviderConnectivity\(/g) ?? []).length,
    1,
    "exactly one write call, through the existing authority",
  );
  assert.match(cli, /readProviderControl\(/, "and the current state comes from the released reader");
  assert.ok(
    !/provider_connectivity_controls/.test(cli),
    "it never writes or reads that table directly — the released seams own the statements",
  );
  assert.match(
    cli,
    /providerKey: MACHINE_INTERNAL_EXECUTION_CONTROL_KEY/,
    "the key it writes is the released constant, never a literal at the call site",
  );
  assert.doesNotMatch(cli, /"machine-internal-execution"/, "and never a restated string");
}

/* ── C + G + H + I. WHAT NEITHER FILE MAY REACH ───────────────────────────── */
{
  for (const file of [CLI, LIB]) {
    /*
     * THE TWO DATABASE CHECK CONSTRAINTS ARE REMOVED BEFORE THE SCAN, AND ONLY THOSE.
     *
     * The ceremony NAMES `action_permits_human_authorizer_chk` and
     * `heby_action_requests_human_approver_chk` in the prose it prints, because telling an operator
     * that human authorization is enforced by the DATABASE is more honest than asserting it. That
     * is a sentence, not a reach. Deleting the two identifiers before the substring scan keeps the
     * table bans BITING on every other occurrence — including `action_permits` in any statement,
     * join, import or query this file could grow.
     */
    const code = codeOf(read(file))
      .toLowerCase()
      .replaceAll("action_permits_human_authorizer_chk", "")
      .replaceAll("heby_action_requests_human_approver_chk", "");

    /* It runs no statement of its own: the released seams own every query. */
    assert.ok(!code.includes("client.query"), `${file} issues no SQL of its own`);

    for (const forbidden of [
      /* C — no second control writer, and no second state. */
      "provider_connectivity_controls",
      "insert into",
      "update ",
      "delete from",
      /* G — arming authorizes nothing. */
      "action_permits",
      "heby_action_requests",
      "action_execution_attempts",
      "decision_records",
      "governance_sessions",
      "audit_log",
      "consumeactionpermit",
      "mintmachineexecutionprincipal",
      /* H — arming triggers nothing. */
      "executerecordworkasmachine",
      "recordworkwithinasmachine",
      "work_items",
      /* I — this gate is not the external-send gate. */
      "external_send_provider_key",
      "external_recipients",
      "api.resend.com",
      /* And it reaches no network of its own. */
      "fetch(",
    ]) {
      assert.ok(
        !code.includes(forbidden),
        `${file} must not reach ${forbidden.trim()} — arming is a boolean, not an act`,
      );
    }
  }
}

/* ── THE CONFIRMATION IS INTERACTIVE, EXACT, AND HARDER THAN THE GENERIC ──── */
{
  const cli = codeOf(read(CLI));
  assert.match(cli, /isTTY/, "a piped confirmation is refused");
  assert.match(cli, /confirmation !== phrase/, "the phrase must match exactly");
  assert.ok(
    MACHINE_PRODUCTION_ARMING_CONFIRMATION.length > MACHINE_INTERNAL_EXECUTION_CONTROL_KEY.length,
    "the phrase is longer than the key the generic ceremony asks for",
  );
  assert.notEqual(MACHINE_PRODUCTION_ARMING_CONFIRMATION, MACHINE_PRODUCTION_DISARMING_CONFIRMATION);
  const guard = cli.indexOf("confirmation !== phrase");
  const write = cli.indexOf("setProviderConnectivity(");
  assert.ok(guard > -1 && write > guard, "and it is checked BEFORE the write");
  assert.match(cli, /process\.env\.NODE_ENV === "production"/, "it refuses the production runtime");
}

/* ── THE BLAST RADIUS AND THE NON-EFFECTS ARE STATED, BY EQUALITY ─────────── */
{
  assert.ok(Object.isFrozen(MACHINE_ARMING_NON_EFFECTS));
  for (const claim of [
    "does not authorize any action",
    "does not create, issue, approve or consume a permit",
    "does not grant standing mutation authority",
  ]) {
    assert.ok(MACHINE_ARMING_NON_EFFECTS.includes(claim), `the ceremony states: ${claim}`);
  }
  /* The one thing it DOES is stated too, and names the human authorization it presupposes. */
  assert.match(MACHINE_ARMING_EFFECT, /TRIGGER/);
  assert.match(MACHINE_ARMING_EFFECT, /human\/Governance-authorized exact permit/);

  const cli = read(CLI);
  assert.match(cli, /Armed is not authorized/, "and it says so where the operator will read it");
  assert.match(cli, /has no tenant_id/, "and claims no tenant containment it lacks");
  assert.match(
    cli,
    /action_permits_human_authorizer_chk/,
    "the mandatory human authorization is named by the constraint that enforces it",
  );
  assert.match(cli, /BLAST RADIUS/, "printed before the prompt, not left to be assumed");
  const radiusAt = cli.indexOf("BLAST RADIUS");
  const promptAt = cli.indexOf("promptVisible(`  Retype");
  assert.ok(radiusAt > -1 && promptAt > radiusAt, "and printed BEFORE it asks");
}

console.log("rung1 production arming gate and firewall checks passed");
