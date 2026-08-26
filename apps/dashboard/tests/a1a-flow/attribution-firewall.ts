/*
 * A1a — PROPOSER ATTRIBUTION TRUTH.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A proposal a human typed is attributed to that human, `agent` stays reserved for an actor that
 *    does not exist yet, and nothing about human supremacy moved."
 *
 * ── WHY A HUMAN ID PAIRED WITH `agent` IS THE DEFECT, NOT THE FIX ────────────
 *
 * `proposed_by_actor_type` and `proposed_by_actor_id` are a polymorphic PAIR. Writing `agent` into
 * the type while the id holds `tenant.userId` does not describe a machine acting on a person's
 * behalf — it names a human being as an agent. The same row already says `createdByType: "human"`
 * about that identical id, so the row contradicted itself.
 *
 * Structural + DDL. Nothing here opens a database, contacts anything, or files a proposal.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const WRITER = "src/features/action-authorization/record-action-request.server.ts";
const INLET = "src/features/heby-action-inlet/send-proposal.server.ts";
const COMMANDS = "src/features/heby-action-inlet/propose-commands.server.ts";
const SCHEMA = "src/db/schema/action-authorization.ts";
const MIGRATIONS = "src/db/migrations";

function migrationSql(): string {
  return readdirSync(path.join(ROOT, MIGRATIONS))
    .filter((f) => f.endsWith(".sql"))
    .map((f) => read(path.join(MIGRATIONS, f)))
    .join("\n");
}

function main(): void {
  const writer = codeOf(read(WRITER));

  /* ── 1 · THE PROPOSAL A HUMAN TYPED IS ATTRIBUTED TO THAT HUMAN ──────────── */
  {
    assert.ok(
      /proposedByActorType:\s*"human"/.test(writer),
      "the proposer type is human — a person typed the command and both references",
    );
    assert.ok(
      /proposedByActorId:\s*tenant\.userId/.test(writer),
      "and the proposer id is that authenticated human's user id",
    );
  }

  /* ── 2 · NO HUMAN ID MAY EVER BE PAIRED WITH A NON-HUMAN ACTOR TYPE ──────
   * The exact defect A1a removed. Asserted over the writer's real code, in both orderings, so it
   * cannot come back by moving one line above the other.
   */
  {
    assert.ok(
      !/proposedByActorType:\s*"(agent|system|service)"/.test(writer),
      "no non-human proposer type is written on this path — no such actor exists to name",
    );
    const pairedWrong =
      /proposedByActorType:\s*"(agent|system|service)"[\s\S]{0,200}?proposedByActorId:\s*tenant\.userId/.test(writer) ||
      /proposedByActorId:\s*tenant\.userId[\s\S]{0,200}?proposedByActorType:\s*"(agent|system|service)"/.test(writer);
    assert.ok(!pairedWrong, "a human user id is never paired with a non-human actor type");
  }

  /* ── 3 · THE ACTOR TYPE IS NOT INFERRED FROM A SURFACE OR A COMMAND NAME ──
   * Attribution must come from who acted, never from which button or verb reached the writer.
   */
  {
    /*
     * Counted, not lookahead-tested. `/proposedByActorType:\s*(?!"human")/` LOOKS like it forbids
     * anything but the literal and in fact matches everything: `\s*` backtracks to zero characters,
     * the lookahead then inspects the space rather than the value, and it always succeeds. An
     * assertion that can never fail is worse than none, so the shape is proved by equality of
     * counts: every occurrence of the key is an occurrence of the key with the literal.
     */
    const keys = (writer.match(/proposedByActorType:/g) ?? []).length;
    const literals = (writer.match(/proposedByActorType:\s*"human"/g) ?? []).length;
    assert.equal(keys, 1, "the proposer type is written in exactly one place");
    assert.equal(
      literals,
      keys,
      "and it is a literal there, never a variable, a ternary or a lookup",
    );
    for (const banned of ["command.handler", "input.args", "surface", "route"]) {
      const near = new RegExp(`proposedByActorType[^,]{0,80}${banned}`);
      assert.ok(!near.test(writer), `the proposer type is not derived from "${banned}"`);
    }
  }

  /* ── 4 · THE HUMAN ORIGINATES BOTH REFERENCES ────────────────────────────
   * Read from the real dispatch path rather than asserted from memory.
   */
  {
    const commands = codeOf(read(COMMANDS));
    assert.ok(
      /const \[recipientRef, draftRef\] = input\.args;/.test(commands),
      "both references come from the arguments the human typed",
    );
    const inlet = read(INLET);
    assert.ok(
      /THE MODEL DECIDES NOTHING HERE/.test(inlet),
      "and the inlet still states that the model decides nothing on this path",
    );
    for (const banned of ["classifier", "inferIntent", "parseModelOutput"]) {
      assert.ok(!codeOf(inlet).includes(banned), `the inlet must not reach "${banned}"`);
    }
  }

  /* ── 5 · HUMAN SUPREMACY IS UNTOUCHED, AND PROVED FROM APPLIED DDL ────────
   * Asked of the migration SQL, not only the schema module: the constraints that matter are the
   * ones the database is actually enforcing.
   */
  {
    const sql = migrationSql();
    assert.ok(
      /action_permits_human_authorizer_chk[\s\S]{0,200}authorized_by_actor_type[\s\S]{0,40}=\s*'human'/.test(sql),
      "a permit's authorizer is constrained to human at the storage layer",
    );
    assert.ok(
      /heby_action_requests_human_approver_chk[\s\S]{0,240}approved_by_actor_type[\s\S]{0,80}'human'/.test(sql),
      "and an approval's approver is constrained to human",
    );
    const schema = codeOf(read(SCHEMA));
    assert.ok(schema.includes("action_permits_human_authorizer_chk"), "the permit CHECK is still declared");
    assert.ok(schema.includes("heby_action_requests_human_approver_chk"), "and the approver CHECK is still declared");
  }

  /* ── 6 · `agent` REMAINS RESERVED, NOT REMOVED ───────────────────────────
   * A1a corrects a false claim; it does not close the door the schema deliberately left open.
   */
  {
    const sql = migrationSql();
    assert.ok(
      /CREATE TYPE "public"\."actor_type" AS ENUM\('human', 'agent', 'system', 'service'\)/.test(sql),
      "the actor vocabulary still admits agent, system and service",
    );
    assert.ok(
      !/proposed_by_actor_type[^;]{0,400}CHECK/i.test(sql),
      "and the proposer column carries no human CHECK — an agent may propose when one exists",
    );
  }

  /* ── 7 · NOTHING ELSE MOVED ──────────────────────────────────────────────
   * A1a is one field. No identity was minted, no runtime reached, no authority widened.
   */
  {
    for (const banned of [
      "@/features/agent-runtime", "@/features/agent-crud", "@/features/agents",
      "@/db/schema/agent", "agents/mock", "principals", "serviceAccount",
      "GOVERNANCE_SUBJECT_TYPES", "@/features/action-execution",
    ]) {
      assert.ok(!read(WRITER).includes(banned), `the writer must not reach "${banned}"`);
    }
    /*
     * Only the agents-writer ban belongs here. A `.limit(` prohibition was drafted alongside it and
     * removed: this module legitimately bounds a query, the pin was carried over from a phase whose
     * subject was an unbounded aggregate, and a firewall that forbids something harmless teaches the
     * next author to loosen the pattern.
     */
    assert.ok(
      !/insert\(\s*agents\s*\)/.test(writer),
      "the writer must not become an agents-table writer",
    );
  }

  /* ── 8 · THE LEDGER DID NOT MOVE ─────────────────────────────────────────── */
  {
    const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
      entries: readonly unknown[];
    };
    assert.equal(journal.entries.length, 36, "A1a adds no migration — the ledger stays at 36");
  }

  console.log("a1a-flow/attribution-firewall: OK");
}

main();
