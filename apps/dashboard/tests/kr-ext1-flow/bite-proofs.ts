/*
 * KR-EXT1 — BITE-PROOFS.
 *
 * Every guarantee this phase introduces is mutated in the SHIPPED SOURCE, and the suite that
 * defends it must fail — for the INTENDED reason, not merely for some reason.
 *
 * Three conditions per mutation: the mutation changed the file, it reached disk, and the defending
 * suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically, so a failure never leaves mutated source on disk.
 *
 * The database mutations run against a DISPOSABLE local database the defending suite creates and
 * drops for itself. No production data is touched and no provider is contacted.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const PG_SUITE = "tests/kr-ext1-flow/external-reference-postgres.ts";
const FIREWALL_SUITE = "tests/kr-ext1-flow/boundaries-and-firewall.ts";

const AUTHORITY = "src/features/knowledge/external-reference-authority.server.ts";
/*
 * INT-5C moved the REVERSE LOOKUP — "which fact concerns this record?" — out of the attach/withdraw
 * authority and into a writer-free read module, so a consumer that only asks the question no longer
 * imports the module that can also create and withdraw a declaration. The query is unchanged and was
 * not forked; this repository still holds exactly one of it. The mutation that aims at the query now
 * aims at the file that holds it.
 */
const READ_SEAM = "src/features/knowledge/external-reference-read.server.ts";
const CONTRACTS = "src/features/knowledge/external-reference-contracts.ts";
const SCHEMA = "src/db/schema/knowledge-external-reference.ts";
const GOVERNANCE = "src/features/governance-decision/contracts.ts";
const UI = "src/components/knowledge-workspace/knowledge-external-references.tsx";

const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

function runSuite(suite: string): { ok: boolean; output: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    label: "M1 the tenant predicate is dropped from the fact-ownership check (cross-tenant attach)",
    file: AUTHORITY,
    suite: PG_SUITE,
    find: ".where(and(eq(knowledgeFacts.id, input.knowledgeFactId), eq(knowledgeFacts.tenantId, tenant.tenantId)))",
    replace: ".where(eq(knowledgeFacts.id, input.knowledgeFactId))",
    expect: "tenant B cannot attach to tenant A's fact",
  },
  {
    label: "M2 the tenant predicate is dropped from withdrawal (cross-tenant detach)",
    file: AUTHORITY,
    suite: PG_SUITE,
    find: "          eq(knowledgeExternalReferences.tenantId, tenant.tenantId),\n          isNull(knowledgeExternalReferences.withdrawnAt),\n        ),\n      )\n      .returning({ id: knowledgeExternalReferences.id });",
    replace: "          isNull(knowledgeExternalReferences.withdrawnAt),\n        ),\n      )\n      .returning({ id: knowledgeExternalReferences.id });",
    expect: "nor withdraw it",
  },
  {
    label: "M3 the writer declares a non-human author",
    file: AUTHORITY,
    suite: PG_SUITE,
    find: '        declaredByType: "human",',
    replace: '        declaredByType: "agent",',
    expect: "an authorized human may declare the association",
  },
  {
    label: "M4 the reference table gains a column a provider payload could live in",
    file: SCHEMA,
    suite: FIREWALL_SUITE,
    find: '    recordId: text("record_id").notNull(),',
    replace: '    recordId: text("record_id").notNull(),\n    payload: text("payload"),',
    expect: "the reference table's columns are exactly these",
  },
  {
    label: "M5 the reference table stores the display name as identity",
    file: SCHEMA,
    suite: FIREWALL_SUITE,
    find: '    recordType: text("record_type").notNull(),',
    replace: '    recordType: text("record_type").notNull(),\n    fullName: text("full_name"),',
    expect: "the reference table's columns are exactly these",
  },
  {
    label: "M6 the reference authority gains provider reach",
    file: AUTHORITY,
    suite: FIREWALL_SUITE,
    find: 'import { resolveKnowledgeWriteAuthority } from "./knowledge-write-authority.server";',
    replace:
      'import { discoverInstallationRepositories } from "@/features/provider-github/discover-installation-repositories.server";\n' +
      'import { resolveKnowledgeWriteAuthority } from "./knowledge-write-authority.server";\n' +
      "export const __mutated = discoverInstallationRepositories;",
    expect: "must not reach src/features/provider-github/",
  },
  {
    label: "M7 the reference authority gains integration-lifecycle reach",
    file: AUTHORITY,
    suite: FIREWALL_SUITE,
    find: 'import { resolveKnowledgeWriteAuthority } from "./knowledge-write-authority.server";',
    replace:
      'import { listConnections } from "@/features/integration-authority/integration-repository.server";\n' +
      'import { resolveKnowledgeWriteAuthority } from "./knowledge-write-authority.server";\n' +
      "export const __mutated = listConnections;",
    expect: "must not reach src/features/integration-authority/",
  },
  {
    label: "M8 the reference authority starts writing the Knowledge fact registry",
    file: AUTHORITY,
    suite: FIREWALL_SUITE,
    find: "    const owned = await db",
    replace: "    await db.update(knowledgeFacts).set({ factVersion: 2 }).where(eq(knowledgeFacts.id, input.knowledgeFactId));\n    const owned = await db",
    expect: "the ONLY table this authority writes is its own",
  },
  {
    label: "M9 withdrawal becomes a physical delete",
    file: AUTHORITY,
    suite: PG_SUITE,
    find:
      "      .update(knowledgeExternalReferences)\n" +
      "      .set({\n" +
      "        withdrawnAt: new Date(),\n" +
      "        withdrawnBy: tenant.userId,\n" +
      '        withdrawnByType: "human",\n' +
      "      })",
    replace: "      .delete(knowledgeExternalReferences)",
    expect: "THE ROW SURVIVES",
  },
  {
    label: "M10 Governance subject types are widened to the provider record",
    file: GOVERNANCE,
    suite: FIREWALL_SUITE,
    find: 'export const GOVERNANCE_SUBJECT_TYPES: readonly GovernanceSubjectType[] = [\n  "knowledge_node",\n  "work_artifact_revision",\n];',
    replace:
      'export const GOVERNANCE_SUBJECT_TYPES: readonly GovernanceSubjectType[] = [\n' +
      '  "knowledge_node",\n  "knowledge_node" as GovernanceSubjectType,\n];',
    expect: "Governance still addresses the Knowledge node",
  },
  {
    label: "M11 the read seam drops the provider record id",
    file: AUTHORITY,
    suite: PG_SUITE,
    find: "        recordType: row.recordType,\n        recordId: row.recordId,\n        declaredAt: iso(row.declaredAt),",
    replace: '        recordType: row.recordType,\n        recordId: "",\n        declaredAt: iso(row.declaredAt),',
    expect: "every field of the provider identity survives the round trip",
  },
  {
    label: "M12 a duplicate live declaration is allowed",
    file: AUTHORITY,
    suite: PG_SUITE,
    find: "      .onConflictDoNothing()",
    replace: "",
    expect: "already-declared",
  },
  {
    label: "M13 the deterministic join degrades to a free-text match",
    file: READ_SEAM,
    suite: PG_SUITE,
    find: "          eq(knowledgeExternalReferences.recordId, reference.recordId),",
    replace: "          isNull(knowledgeExternalReferences.withdrawnAt),",
    expect: "the record id decides, not the row count",
  },
  {
    label: "M14 whitespace in a provider identifier is trimmed instead of refused",
    file: CONTRACTS,
    suite: PG_SUITE,
    find: "  if (/\\s/.test(value)) return null;\n  return value;",
    replace: "  return value.trim();",
    expect: "a malformed reference is refused in the seam",
  },
  {
    label: "M15 an unauthorized actor may declare a reference",
    file: AUTHORITY,
    suite: PG_SUITE,
    find: '  if (!authority.authorized) return { status: "refused", reason: "not-authorized" };\n\n  /* 2 · A CLOSED, VALIDATED IDENTITY.',
    replace: '  void authority;\n\n  /* 2 · A CLOSED, VALIDATED IDENTITY.',
    expect: "not-authorized",
  },
  {
    label: "M16 the UI offers to import provider data",
    file: UI,
    suite: FIREWALL_SUITE,
    find: "                  Record a reference",
    replace: "                  Import",
    expect: 'must not offer "Import"',
  },
];

function withMutation(mutation: Mutation, body: () => void): void {
  const original = readFile(mutation.file);
  const before = sha(original);
  assert.ok(
    original.includes(mutation.find),
    `${mutation.label}: the find-string is not present in ${mutation.file} — the mutation would prove nothing`,
  );
  const mutated = original.replace(mutation.find, mutation.replace);
  assert.notEqual(mutated, original, `${mutation.label}: the mutation changed nothing`);
  try {
    writeFileSync(abs(mutation.file), mutated, "utf8");
    assert.equal(sha(readFile(mutation.file)), sha(mutated), `${mutation.label}: the mutation did not reach disk`);
    body();
  } finally {
    writeFileSync(abs(mutation.file), original, "utf8");
  }
  assert.equal(sha(readFile(mutation.file)), before, `${mutation.file} was not restored byte-identically`);
}

function main(): void {
  let bitten = 0;
  for (const mutation of MUTATIONS) {
    withMutation(mutation, () => {
      const run = runSuite(mutation.suite);
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the mutation SURVIVED — ${mutation.suite} still passed.\n` +
          `--- actual ---\n${run.output.slice(-2000)}`,
      );
      assert.ok(
        run.output.includes(mutation.expect),
        `${mutation.label}: the suite failed, but not for the intended reason. Expected output ` +
          `containing "${mutation.expect}".\n--- actual ---\n${run.output.slice(-2500)}`,
      );
    });
    bitten += 1;
    console.log(`BITE ${mutation.label}`);
  }

  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(`kr-ext1-flow/bite-proofs: ${bitten} mutations bit`);
}

main();
