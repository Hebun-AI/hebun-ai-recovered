/*
 * INT-5B1 — THE PROVIDER-READ COMMAND CONTRACT.
 *
 * ── THE PROPERTY ─────────────────────────────────────────────────────────────
 *
 * Hebun gained a command that can leave the building. It must have gained EXACTLY ONE, that command
 * must say so in the registry, and no other command class may have acquired external reach on the
 * way — least of all `read`, whose whole contract is that it has none.
 *
 * Everything here is asserted against the shipped registry, parser and planner. No database, no
 * network, no key.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  HEBY_COMMANDS,
  findHebyCommandById,
  parseHebyInput,
  planHebyCommand,
  validateHebyCommandRegistry,
  type HebyCommandContext,
} from "../../src/features/heby-commands";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const CONTEXT: HebyCommandContext = {
  surface: "full-workspace",
  contextLabel: "Platform",
  contextDetail: ["Platform workspace."],
  evidenceLines: [],
  returnLabel: "Back",
};

function main(): void {
  /* ── 1. THE REGISTRY STILL SATISFIES ITS OWN INVARIANTS ──────────────────── */
  assert.deepEqual(
    validateHebyCommandRegistry(),
    [],
    "the registry invariants must hold with the provider-read kind in it",
  );

  /* ── 2. EXACTLY ONE COMMAND REACHES A PROVIDER, AND IT DECLARES IT ───────── */
  {
    const external = HEBY_COMMANDS.filter((c) => c.kind === "provider-read");
    assert.deepEqual(
      external.map((c) => c.id),
      ["repositories"],
      "INT-5B1 ships exactly one provider-read command; a second is a deliberate edit here",
    );

    /*
     * BOTH DIRECTIONS. A command that reaches out must say so, and a command that says so must be
     * of the one kind permitted to. Either half alone would let a descriptor lie.
     */
    for (const command of HEBY_COMMANDS) {
      assert.equal(
        command.reachesProvider === true,
        command.kind === "provider-read",
        `${command.id}: reachesProvider must be true exactly for provider-read commands`,
      );
    }
  }

  /* ── 3. `read` IS STILL ZERO PROVIDER DISPATCH — THE PIN THIS PHASE KEPT ─── */
  {
    const reads = HEBY_COMMANDS.filter((c) => c.kind === "read");
    assert.ok(reads.length >= 10, `the read class should be substantial, got ${reads.length}`);
    for (const command of reads) {
      assert.notEqual(command.reachesProvider, true, `${command.id}: a read command reaches no provider`);
    }
    /*
     * AND THE SERVER EXECUTOR REFUSES THE NEW KIND. `read-commands.server.ts` was not touched by
     * this phase, and this asserts the consequence rather than the intention: its gate accepts
     * `read` and nothing else, so a provider-read command handed to it reads nothing.
     */
    const readServer = read("src/features/heby-commands/read-commands.server.ts");
    assert.match(
      readServer,
      /if \(command\.kind !== "read"\) return \{ status: "rejected", reason: "not-a-read-command" \};/,
      "the read executor still admits only read commands",
    );
    assert.ok(
      !readServer.includes("provider-github") && !readServer.includes("provider-read"),
      "the read executor names no provider seam and no provider-read concept",
    );
  }

  /* ── 4. THE COMMAND'S OWN SHAPE ──────────────────────────────────────────── */
  {
    const command = findHebyCommandById("repositories");
    assert.ok(command, "/repositories exists in the registry");
    assert.equal(command!.slash, "/repositories");
    assert.equal(command!.kind, "provider-read");
    assert.equal(command!.availability, "available");
    assert.equal(command!.requiresModel, false, "a provider read is not a model request");
    assert.equal(command!.requiresExecution, false, "a provider read needs no execution runtime");
    assert.equal(command!.safeWhenProviderOff, true, "it uses no model, so the kill-switch cannot break it");
    assert.deepEqual(
      command!.args,
      [],
      "it accepts NO arguments — a repository address would be a caller-supplied target",
    );
    assert.ok(!command!.unavailableReason, "an available command carries no unavailable reason");
  }

  /* ── 5. THE PARSER TREATS IT AS A COMMAND, NEVER AS A PROMPT ─────────────── */
  {
    const parsed = parseHebyInput("/repositories");
    assert.equal(parsed.kind, "command", "/repositories parses as a command");
    if (parsed.kind === "command") {
      assert.equal(parsed.command.id, "repositories");
      assert.deepEqual(parsed.args, []);
    }

    /*
     * THE MODEL CANNOT TRIGGER IT. Model output is prose, and prose beginning with "/" is
     * classified here and can never be returned as a prompt. The reverse also holds: ordinary
     * prose naming the command is a PROMPT and reaches no command path.
     */
    const asProse = parseHebyInput("please run /repositories for me");
    assert.equal(asProse.kind, "prompt", "prose mentioning the command is a prompt, not the command");

    const withArgument = parseHebyInput("/repositories hebun-ai/dashboard");
    assert.equal(
      withArgument.kind,
      "invalid-arguments",
      "a caller-supplied repository is refused by the parser, before any server call",
    );

    const shellish = parseHebyInput("/repositories; rm -rf /");
    assert.equal(shellish.kind, "unsafe-input", "shell grammar is refused outright");
  }

  /* ── 6. THE PLANNER EMITS THE PROVIDER-READ PLAN, AND NO PROMPT ──────────── */
  {
    const command = findHebyCommandById("repositories")!;
    const plan = planHebyCommand(command, [], CONTEXT);
    assert.equal(plan.kind, "provider-read", "the planner branches on the declared kind");
    if (plan.kind === "provider-read") {
      assert.equal(plan.commandId, "repositories");
      assert.equal(plan.handler, "repositories");
      assert.deepEqual(plan.args, []);
    }
    assert.ok(!("prompt" in plan), "no provider-read plan may carry a prompt");

    /*
     * ORDERING. The provider-read branch returns BEFORE the handler switch, so a provider-read
     * command can never fall through and be planned as an ordinary `read`. Asserted on the shipped
     * planner body, because the ordering is the guarantee.
     */
    const dispatch = read("src/features/heby-commands/dispatch.ts");
    const body = dispatch.slice(dispatch.indexOf("export function planHebyCommand"));
    const providerAt = body.indexOf('if (command.kind === "provider-read")');
    const switchAt = body.indexOf("switch (command.handler)");
    const availabilityAt = body.indexOf('command.availability !== "available"');
    assert.ok(providerAt > -1, "the planner has a provider-read branch");
    assert.ok(availabilityAt > -1 && availabilityAt < providerAt, "availability is checked FIRST");
    assert.ok(providerAt < switchAt, "the provider-read branch precedes the handler switch");
  }

  /* ── 7. AN UNAVAILABLE PROVIDER-READ COMMAND CONTACTS NOBODY ─────────────── */
  {
    const command = findHebyCommandById("repositories")!;
    const hypothetical = { ...command, availability: "requires-capability" as const, unavailableReason: "x" };
    const plan = planHebyCommand(hypothetical, [], CONTEXT);
    assert.equal(plan.kind, "unavailable", "an unavailable provider-read command never plans a read");
  }

  /* ── 8. THE PALETTE TELLS THE TRUTH ABOUT IT ─────────────────────────────── */
  {
    const command = findHebyCommandById("repositories")!;
    assert.match(
      command.description,
      /GitHub/,
      "the description names the external system, so nobody runs it unaware",
    );
    assert.match(command.description, /[Rr]eads only/, "and says it only reads");
  }

  console.log("int5b1-flow/command-contract: OK");
}

main();
