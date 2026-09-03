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

  /* ── 1 · THE PROPOSAL A HUMAN TYPED IS ATTRIBUTED TO THAT HUMAN ────────────
   *
   * AGENT-PROPOSAL-1 MOVED THIS CODE; IT DID NOT CHANGE THIS CLAIM. The writer now has two entry
   * points, and the literal pair no longer sits at the insert — it sits in the HUMAN one, which is
   * where the claim always belonged. What A1a asserted about `/send` is asserted here about the
   * function `/send` actually calls.
   */
  {
    /*
     * NO IDENTIFIER IS EVER MINTED TO SATISFY THE COLUMN. `proposed_by_actor_id` is NOT NULL, which
     * is exactly the pressure that produces a fabricated uuid; the absence of any generator in this
     * module is what makes that impossible rather than merely unattempted. Asserted FIRST so a
     * mutation that fabricates an id is reported as a fabrication rather than as a wrong literal.
     */
    assert.equal(
      /randomUUID|crypto\./.test(writer),
      false,
      "no proposer identifier is fabricated to satisfy a NOT NULL column",
    );
    /*
     * THE PAIR LITERAL AT THE CALL SITE, NOT THE TYPE THAT DESCRIBES IT.
     *
     * `ActionProposerPair` declares `{ readonly actorType: "human"; ... }`, so a bare
     * /actorType:\s*"human"/ matches the TYPE DECLARATION and passes even when the human entry
     * point has been changed to say `agent`. Measured: that spelling let a bite proof survive. The
     * anchor is therefore the object literal — `{ actorType:` with no `readonly` — which only the
     * call site can produce.
     */
    assert.ok(
      /\{\s*actorType:\s*"human"/.test(writer),
      "the proposer type is human — a person typed the command and both references",
    );
    assert.ok(
      /actorId:\s*tenant\.userId/.test(writer),
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
    assert.equal(keys, 1, "the proposer type is written in exactly one place");
    /*
     * STRICTER THAN THE LITERAL IT REPLACES. A1a asserted the value was the literal "human", which
     * a writer could satisfy while taking the ID half from somewhere else entirely — the precise
     * defect A1a existed to remove. AGENT-PROPOSAL-1 makes both halves come from ONE resolved pair,
     * so this asserts that instead: the two columns cannot disagree about which actor they describe,
     * whatever value the pair happens to hold.
     */
    const typeSources = [...writer.matchAll(/proposedByActorType:\s*([A-Za-z_.]+)/g)].map((m) => m[1]);
    const idSources = [...writer.matchAll(/proposedByActorId:\s*([A-Za-z_.]+)/g)].map((m) => m[1]);
    assert.deepEqual(
      [...new Set(typeSources)],
      ["proposer.actorType"],
      "the actor type comes from the single resolved pair, never a ternary or a lookup",
    );
    assert.deepEqual(
      [...new Set(idSources)],
      ["proposer.actorId"],
      "and the actor id comes from that SAME pair — the two halves describe one actor",
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
    /*
     * SCOPED TO THE TABLE IT WAS ALWAYS ABOUT (repaired by SIA-3).
     *
     * This read `!/proposed_by_actor_type[^;]{0,400}CHECK/`, over every migration concatenated —
     * a claim about a COLUMN NAME anywhere in the corpus, when the invariant it defends is about
     * ONE table: an agent may one day propose an ACTION, so `heby_action_requests` must not
     * constrain its proposer to human.
     *
     * SIA-3 added `agent_improvement_hypotheses`, which also has a `proposed_by_actor_type` — and
     * DOES constrain it to human, deliberately, because only a human may file a hypothesis about
     * an agent. That is a different table making a different claim, and it takes nothing away from
     * an agent's ability to propose an action.
     *
     * The repair is STRICTER, not weaker: it now names the exact qualified column, so a CHECK
     * added to `heby_action_requests.proposed_by_actor_type` fails here however it is worded —
     * whereas the old regex could be evaded by more than 400 characters of distance.
     */
    assert.ok(
      !/CHECK[^;]{0,600}"heby_action_requests"\."proposed_by_actor_type"/i.test(sql),
      "no CHECK constrains an ACTION proposal's proposer — an agent may propose when one exists",
    );
    /*
     * And the exception is ENUMERATED rather than left as a hole: exactly one other table
     * constrains a proposer to human, it is SIA-3's, and it is named here so a THIRD one fails.
     */
    assert.deepEqual(
      [...sql.matchAll(/CONSTRAINT "([a-z0-9_]+)" CHECK \("([a-z0-9_]+)"\."proposed_by_actor_type"/g)].map(
        (m) => m[1]!,
      ),
      ["agent_improvement_hypotheses_human_author_chk"],
      "and exactly one table constrains a proposer to human — SIA-3's hypothesis author",
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
    assert.equal(journal.entries.length, 47, "A1a adds no migration — the ledger carries none of its authoring"); /* WEV-1 grew the ledger 44 -> 45; PBGA-1 45 -> 46; CGO-1 46 -> 47 (content-draft + destination). */
  }

  console.log("a1a-flow/attribution-firewall: OK");
}

main();
