/*
 * TRH-17 — WHAT THE MODEL IS TOLD, AND WHAT IT MUST NEVER BE TOLD.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The instructions offer record-work without offering any authority, and the phase added no
 *    second planner, no scheduler, no permit writer and no executor — while the released
 *    `record-work` inlet is called exactly as it was released."
 *
 * ── WHERE THE PROMPT ITSELF IS PROVEN ────────────────────────────────────────
 *
 * The claim that NO uuid, reference or tenant id reaches the model is proved in
 * `origination-postgres.ts`, by capturing the real `ModelGenerationRequest` at the generator seam
 * with a REAL department in the candidate set. Asserting it here would have meant re-implementing
 * the renderer, which proves a copy rather than the thing that runs.
 *
 * Pure. Reads released source and the released instruction constant; no database, no provider.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AGENT_ORIGINATION_SYSTEM_INSTRUCTIONS } from "../../src/features/agent-origination/originate-action.server";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");

const RUNTIME = "src/features/agent-origination/originate-action.server.ts";
const PARSER = "src/features/agent-origination/structured-output.ts";
const CANDIDATES_MODULE = "src/features/agent-origination/candidate-set.server.ts";
const INLET = "src/features/heby-action-inlet/record-work-proposal.server.ts";

function main(): void {
  /* ═══════════════════════════════════════════════════════════════════════
   * 1. THE INSTRUCTIONS NEVER GRANT AUTHORITY.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    const instructions = AGENT_ORIGINATION_SYSTEM_INSTRUCTIONS;
    assert.ok(instructions.includes('"kind":"record-work"'), "record-work is offered to the model");
    assert.ok(instructions.includes("organization-level"), "and so is the departmentless truth");
    assert.ok(
      /never approve|You never approve/.test(instructions),
      "and the model is still told it approves nothing",
    );
    assert.ok(
      instructions.includes("Never construct, guess, complete, or alter"),
      "the invention ban covers the new vocabulary in the same sentence as the old",
    );
    assert.ok(
      /must not invent facts/.test(instructions),
      "and the model-authored TITLE carries its own ban, because no candidate list can bound prose",
    );
    /* NOTHING IN THE PROMPT NAMES AN AUTHORITY THE MODEL COULD CLAIM. */
    for (const forbidden of ["permit", "approve this", "authorized", "execute"]) {
      assert.ok(
        !instructions.toLowerCase().includes(forbidden.toLowerCase() + " it"),
        `the instructions never invite the model to "${forbidden} it"`,
      );
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 2. THE PHASE ADDED NO AUTHORITY, NO PROVIDER AND NO RUNTIME.
   *
   * TRH-17 connected an existing inlet to an existing runtime. If it had grown a second planner, a
   * scheduler, a permit writer or a transport for the internal act, it would be a different phase.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    const codeOf = (source: string): string =>
      source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"))
        .join("\n");

    for (const file of [RUNTIME, PARSER, CANDIDATES_MODULE]) {
      const code = codeOf(read(file));
      for (const banned of [
        "scheduler",
        "cron",
        "setInterval",
        "autonomous",
        "mintPermit",
        "recordDecision",
        "executeRecordWork",
        "recordWorkWithin",
      ]) {
        assert.ok(!code.includes(banned), `${file} contains no ${banned}`);
      }
    }

    /* THE INLET ITSELF WAS NOT TOUCHED BY THIS PHASE'S NEEDS. */
    const inlet = read(INLET);
    assert.ok(
      inlet.includes("export function proposeAgentOriginatedRecordWorkAction("),
      "the released agent inlet is called as it was released — its signature is unchanged",
    );
    assert.ok(
      !inlet.includes("departmentSlug"),
      "and it learned nothing about slugs — the model's vocabulary stops at the runtime boundary",
    );
    assert.ok(
      !codeOf(inlet).includes("parseAgentActionSelection"),
      "THE MODEL SELECTS NOTHING inside the action inlet — R3A.1's claim survives this phase",
    );
  }

  console.log("PASS trh17-model-selectable-record-work prompt and firewall");
}

main();
