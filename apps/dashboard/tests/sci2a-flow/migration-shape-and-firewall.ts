/*
 * SCI-2A — THE MIGRATION'S SHAPE, AND WHAT IT IS NOT ALLOWED TO BE (structural, no DB).
 *
 *   - exactly one function and three triggers, all on knowledge_nodes;
 *   - no table, no column, no data statement, no DROP: nothing is rewritten or backfilled;
 *   - the Drizzle model is unchanged (the snapshot equals its predecessor);
 *   - the function is not SECURITY DEFINER and names no other table: the trigger is an integrity
 *     rule for one table, not an authority that reaches Governance, EAI, Agents or Execution.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const MIGRATIONS = "src/db/migrations";
const TAG = "_sci2a_knowledge_version_immutability";
const file = readdirSync(MIGRATIONS).find((name) => name.endsWith(`${TAG}.sql`));
assert.ok(file, "the SCI-2A migration exists");
const sql = readFileSync(`${MIGRATIONS}/${file}`, "utf8");
const code = sql.replace(/^--.*$/gm, "");

const statements = code.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean);
assert.equal(statements.length, 4, "one function, three triggers");
assert.match(statements[0]!, /^CREATE FUNCTION "public"\."knowledge_nodes_guard_version_immutability"\(\) RETURNS trigger/);
assert.deepEqual(
  statements.slice(1).map((statement) => /^CREATE TRIGGER "(\w+)"\s+BEFORE (\w+) ON "public"\."knowledge_nodes"/.exec(statement)?.slice(1)),
  [
    ["knowledge_nodes_version_immutable_update", "UPDATE"],
    ["knowledge_nodes_version_immutable_delete", "DELETE"],
    ["knowledge_nodes_version_immutable_truncate", "TRUNCATE"],
  ],
);
for (const statement of statements.slice(1)) {
  assert.match(statement, /EXECUTE FUNCTION "public"\."knowledge_nodes_guard_version_immutability"\(\);?$/);
}

/* No schema shape change and no data change, anywhere in the file. */
for (const forbidden of [
  /\bCREATE\s+TABLE\b/i,
  /\bALTER\s+(TABLE|TYPE)\b/i,
  /\bADD\s+COLUMN\b/i,
  /\bDROP\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\s+"?(public"?\.)?"?\w+"?\s+SET\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bTRUNCATE\s+(?!ON\b)/i,
  /\bSECURITY\s+DEFINER\b/i,
  /\bEXECUTE\s+(format|'|")/i,
]) {
  assert.ok(!forbidden.test(code), `the migration contains no ${forbidden}`);
}

/* The function reads only its own row: no other relation is named in its body. */
const body = statements[0]!.slice(statements[0]!.indexOf("$$"), statements[0]!.lastIndexOf("$$"));
assert.ok(!/\b(from|join)\s/i.test(body.replace(/FROM jsonb_object_keys|DISTINCT FROM/gi, "")), "no table read");

/* The Drizzle model did not move: this migration's snapshot is its predecessor's, re-linked. */
const journal = JSON.parse(readFileSync(`${MIGRATIONS}/meta/_journal.json`, "utf8")) as {
  entries: Array<{ tag: string }>;
};
const index = journal.entries.findIndex((entry) => entry.tag.endsWith(TAG));
assert.ok(index > 0, "the migration is journaled");
const snapshotOf = (tag: string) =>
  JSON.parse(readFileSync(`${MIGRATIONS}/meta/${tag.slice(0, 14)}_snapshot.json`, "utf8")) as Record<string, unknown>;
const mine = snapshotOf(journal.entries[index]!.tag);
const prior = snapshotOf(journal.entries[index - 1]!.tag);
assert.equal(mine.prevId, prior.id, "the snapshot chain is linked");
const shape = (snapshot: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(snapshot).filter(([key]) => key !== "id" && key !== "prevId"));
assert.deepEqual(shape(mine), shape(prior), "no table, column, enum or index changed");

console.log("sci2a migration-shape-and-firewall checks passed");
