/*
 * SCI-2A — BITE-PROOFS FOR THE KNOWLEDGE VERSION IMMUTABILITY TRIGGER.
 *
 * One probe asks PostgreSQL two questions about a real row: which version-defining columns can
 * still change, and which legitimate post-creation columns can no longer change (plus: does DELETE
 * still fail). Against the SHIPPED migration the answer is "none / none / yes".
 *
 * Each defect is the shipped SQL with one deliberate weakening (or over-tightening), installed
 * inside a transaction that is rolled back. The probe must name the defect every time — so the
 * focused proof cannot pass against a trigger that protects the wrong thing.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";

const MIGRATIONS = "src/db/migrations";
const file = readdirSync(MIGRATIONS).find((name) => name.endsWith("_sci2a_knowledge_version_immutability.sql"));
assert.ok(file, "the SCI-2A migration exists");
const SHIPPED = readFileSync(`${MIGRATIONS}/${file}`, "utf8");
const FUNCTION_SQL = SHIPPED.slice(
  SHIPPED.indexOf("CREATE FUNCTION"),
  SHIPPED.indexOf("--> statement-breakpoint"),
).replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION");

/** A changed value for each column, by column. */
const PROTECTED: Record<string, string> = {
  statement: "'mutated'",
  label: "'mutated'",
  provenance: `'{"forged":true}'::jsonb`,
  tenant_id: "(select id from companies where slug = 'other')",
  supersedes_knowledge_node_id: "(select id from knowledge_nodes where label = 'other')",
  knowledge_version: "99",
  created_at: "now() - interval '1 year'",
};
const LEGITIMATE: Record<string, string> = {
  ratified_at: "now()",
  ratified_by_actor_id: "gen_random_uuid()",
  knowledge_lifecycle_status: "'retired'",
  retired_at: "now()",
  updated_at: "now()",
};

async function attempt(client: Client, sql: string, params: unknown[]): Promise<boolean> {
  await client.query("savepoint probe");
  try {
    await client.query(sql, params);
    await client.query("release savepoint probe");
    return true;
  } catch {
    await client.query("rollback to savepoint probe");
    return false;
  }
}

async function probe(client: Client, nodeId: string): Promise<string[]> {
  const findings: string[] = [];
  for (const [column, value] of Object.entries(PROTECTED)) {
    if (await attempt(client, `update knowledge_nodes set ${column} = ${value} where id = $1`, [nodeId])) {
      findings.push(`mutable:${column}`);
    }
  }
  for (const [column, value] of Object.entries(LEGITIMATE)) {
    if (!(await attempt(client, `update knowledge_nodes set ${column} = ${value} where id = $1`, [nodeId]))) {
      findings.push(`frozen:${column}`);
    }
  }
  if (await attempt(client, "delete from knowledge_nodes where id = $1", [nodeId])) findings.push("deletable");
  return findings;
}

function weaken(allowed: string): string {
  return FUNCTION_SQL.replace("'updated_at', 'updated_by', 'updated_by_type'", `'updated_at', 'updated_by', 'updated_by_type', '${allowed}'`);
}

function freeze(column: string): string {
  const patched = FUNCTION_SQL.replace(`'${column}', `, "").replace(`, '${column}'`, "");
  assert.notEqual(patched, FUNCTION_SQL, `${column} is in the shipped allowlist`);
  return patched;
}

const DEFECTS: ReadonlyArray<readonly [name: string, ddl: string, expected: string[]]> = [
  ["statement removed from protection", weaken("statement"), ["mutable:statement"]],
  ["provenance removed from protection", weaken("provenance"), ["mutable:provenance"]],
  ["tenant_id removed from protection", weaken("tenant_id"), ["mutable:tenant_id"]],
  ["supersedes removed from protection", weaken("supersedes_knowledge_node_id"), ["mutable:supersedes_knowledge_node_id"]],
  ["DELETE protection removed", `DROP TRIGGER "knowledge_nodes_version_immutable_delete" ON "public"."knowledge_nodes"`, ["deletable"]],
  ["ratification field made immutable", freeze("ratified_at"), ["frozen:ratified_at"]],
  ["ratifying actor made immutable", freeze("ratified_by_actor_id"), ["frozen:ratified_by_actor_id"]],
  ["retraction lifecycle made immutable", freeze("knowledge_lifecycle_status"), ["frozen:knowledge_lifecycle_status"]],
  ["retraction timestamp made immutable", freeze("retired_at"), ["frozen:retired_at"]],
];

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_sci2a_bite");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  try {
    harness.migrateDatabase();
    await client.connect();
    const tenants = await client.query<{ id: string }>(
      "insert into companies (name, slug) values ('Acme', 'acme'), ('Other', 'other') returning id",
    );
    await client.query(
      `insert into knowledge_nodes (tenant_id, type, label, statement, provenance)
       values ($1, 'knowledge-statement', 'other', 'Other.', '{}')`,
      [tenants.rows[0]!.id],
    );
    const node = await client.query<{ id: string }>(
      `insert into knowledge_nodes (tenant_id, type, label, statement, provenance, ratified_at)
       values ($1, 'knowledge-statement', 'subject', 'Original.', '{"origin":"human-authored"}', now())
       returning id`,
      [tenants.rows[0]!.id],
    );
    const nodeId = node.rows[0]!.id;

    await client.query("begin");
    assert.deepEqual(await probe(client, nodeId), [], "the shipped trigger: nothing mutable, nothing frozen, no delete");
    await client.query("rollback");

    for (const [name, ddl, expected] of DEFECTS) {
      await client.query("begin");
      try {
        await client.query(ddl);
        assert.deepEqual(await probe(client, nodeId), expected, `the probe catches: ${name}`);
      } finally {
        await client.query("rollback");
      }
    }

    await client.query("begin");
    assert.deepEqual(await probe(client, nodeId), [], "every defect was rolled back");
    await client.query("rollback");
    console.log(`sci2a bite-proofs passed (${DEFECTS.length} defects caught)`);
  } finally {
    await client.end().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
