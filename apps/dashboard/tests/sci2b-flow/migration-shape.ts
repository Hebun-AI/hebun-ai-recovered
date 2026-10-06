/*
 * SCI-2B — the migration is one nullable column, one stamp function and one INSERT trigger, and
 * nothing else: no backfill, no default, no data statement, and the SCI-2A guard is untouched.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const MIGRATIONS = "src/db/migrations";
const TAG = "_sci2b_knowledge_integrity_at_insert";
const file = readdirSync(MIGRATIONS).find((name) => name.endsWith(`${TAG}.sql`));
assert.ok(file, "the SCI-2B migration exists");
const code = readFileSync(`${MIGRATIONS}/${file}`, "utf8").replace(/^--.*$/gm, "");
const statements = code.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);

assert.equal(statements.length, 3);
assert.equal(statements[0], 'ALTER TABLE "knowledge_nodes" ADD COLUMN "integrity_protected_at_insert" boolean;', "nullable, no default");
assert.match(statements[1]!, /^CREATE FUNCTION "public"\."knowledge_nodes_stamp_integrity_at_insert"\(\) RETURNS trigger/);
assert.match(statements[2]!, /^CREATE TRIGGER "knowledge_nodes_stamp_integrity_at_insert"\s+BEFORE INSERT ON "public"\."knowledge_nodes"\s+FOR EACH ROW EXECUTE FUNCTION "public"\."knowledge_nodes_stamp_integrity_at_insert"\(\);$/);

/* The stamp only ever writes TRUE or NULL, and only after counting the three SCI-2A guards. */
const body = statements[1]!;
assert.match(body, /NEW\.integrity_protected_at_insert := CASE WHEN \([\s\S]*\) = 3 THEN true ELSE NULL END;/);
for (const guard of ["update", "delete", "truncate"]) assert.ok(body.includes(`'knowledge_nodes_version_immutable_${guard}'`), guard);
assert.ok(body.includes("t.tgenabled <> 'D'"), "a disabled guard does not count");

for (const forbidden of [/\bUPDATE\s+"?\w+"?\s+SET\b/i, /\bINSERT\s+INTO\b/i, /\bDELETE\s+FROM\b/i, /\bDROP\b/i, /\bDEFAULT\b/i,
  /\bSECURITY\s+DEFINER\b/i, /\bknowledge_nodes_guard_version_immutability"\(\)/, /\bCREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+"public"\."knowledge_nodes_guard/i]) {
  assert.ok(!forbidden.test(code), `no ${forbidden}`);
}

/* The Drizzle model moved by exactly one column. */
const journal = JSON.parse(readFileSync(`${MIGRATIONS}/meta/_journal.json`, "utf8")) as { entries: Array<{ tag: string }> };
const index = journal.entries.findIndex((entry) => entry.tag.endsWith(TAG));
const snapshot = (tag: string) => JSON.parse(readFileSync(`${MIGRATIONS}/meta/${tag.slice(0, 14)}_snapshot.json`, "utf8"));
const mine = snapshot(journal.entries[index]!.tag);
const prior = snapshot(journal.entries[index - 1]!.tag);
assert.equal(mine.prevId, prior.id);
const nodes = (s: { tables: Record<string, { columns: Record<string, unknown> }> }) => s.tables["public.knowledge_nodes"]!;
assert.deepEqual(
  Object.keys(nodes(mine).columns).filter((c) => !(c in nodes(prior).columns)),
  ["integrity_protected_at_insert"],
);
assert.deepEqual(nodes(mine).columns.integrity_protected_at_insert, {
  name: "integrity_protected_at_insert", type: "boolean", primaryKey: false, notNull: false,
});
const { integrity_protected_at_insert: _added, ...mineColumns } = nodes(mine).columns;
assert.deepEqual({ ...nodes(mine), columns: mineColumns }, nodes(prior), "knowledge_nodes: no index, FK or other column changed");
void _added;
const strip = (s: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries({ ...s, tables: { ...(s.tables as object), "public.knowledge_nodes": null } }).filter(
      ([key]) => key !== "id" && key !== "prevId",
    ),
  );
assert.deepEqual(strip(mine), strip(prior), "no other table, enum or index changed");

console.log("sci2b migration-shape checks passed");
