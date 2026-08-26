/*
 * INT-5C — BITE-PROOFS.
 *
 * Every guarantee this phase introduces is mutated in the SHIPPED SOURCE, and the suite that
 * defends it must fail — for the INTENDED reason, not merely for some reason.
 *
 * Three conditions per mutation: the mutation changed the file, it reached disk, and the defending
 * suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically, so a failure never leaves mutated source on disk.
 *
 * ── EVERY RUN IS BOUNDED ─────────────────────────────────────────────────────
 *
 * A mutation that makes a command BLOCK rather than refuse would hang this file forever, and a
 * hanging bite-proof is not a verdict — it is an absence of one. So each child gets a timeout, and a
 * child that exceeds it is reported as VOID rather than silently counted as bitten.
 *
 * No production database is touched, no provider is contacted, and no secret is read. The database
 * mutations run against disposable databases the defending suite creates and drops for itself.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const COMMAND_SUITE = "tests/int5c-flow/command-and-provenance.ts";
const JOIN_SUITE = "tests/int5c-flow/join-postgres.ts";
const FIREWALL_SUITE = "tests/int5c-flow/cross-source-firewall.ts";

const CROSS_SOURCE = "src/features/heby-commands/cross-source-commands.server.ts";
const JOIN_SEAM = "src/features/knowledge/external-reference-read.server.ts";
const REGISTRY = "src/features/heby-commands/registry.ts";
const READ_COMMANDS = "src/features/heby-commands/read-commands.server.ts";
const ANSWER = "src/features/heby-answer/model-answer.server.ts";

/** Generous, but finite. The slowest defending suite here migrates a database. */
const CHILD_TIMEOUT_MS = 15 * 60 * 1000;

const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

interface SuiteRun {
  readonly ok: boolean;
  readonly output: string;
  readonly timedOut: boolean;
}

function runSuite(suite: string): SuiteRun {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: CHILD_TIMEOUT_MS,
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    timedOut: result.signal === "SIGTERM" && result.status === null,
  };
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
  /*
   * M1 REMOVES BOTH TENANT PREDICATES, AND THE FIRST ATTEMPT AT IT IS WORTH RECORDING.
   *
   * Removing only the `where` clause's tenant equality did NOT bite: the join to `knowledge_facts`
   * carries its own `eq(knowledgeFacts.tenantId, tenant.tenantId)`, and either predicate ALONE is
   * enough to keep one organization out of another's declarations. That is defence in depth rather
   * than a redundant line, and a bite-proof that survives because a second guard held is a RESULT,
   * not a passing test — so the mutation was strengthened to take both, which is what it takes to
   * make the query cross-tenant at all.
   *
   * The single-predicate variant is deliberately NOT kept as a mutation: this harness requires
   * every mutation to FAIL its suite, and one that survives by design cannot be expressed in it
   * without inverting what a bite means. The property is recorded here and in the seam instead.
   */
  {
    label: "M1 the Knowledge join is made cross-tenant — BOTH tenant predicates removed",
    file: JOIN_SEAM,
    suite: JOIN_SUITE,
    find:
      "          eq(knowledgeFacts.tenantId, tenant.tenantId),\n        ),\n      )\n      .where(\n        and(\n          eq(knowledgeExternalReferences.tenantId, tenant.tenantId),",
    replace:
      "          eq(knowledgeFacts.id, knowledgeExternalReferences.knowledgeFactId),\n        ),\n      )\n      .where(\n        and(",
    expect: "A sees exactly one declaration",
  },
  {
    label: "M2 the repository full_name is used as the join identity instead of the numeric id",
    file: CROSS_SOURCE,
    suite: COMMAND_SUITE,
    find: "  const recordIds = shown.map((repository) => String(repository.repositoryId));",
    replace: "  const recordIds = shown.map((repository) => repository.fullName);",
    expect: "it asks by numeric provider id, never by repository name",
  },
  {
    label: "M3 a model-inferred link is accepted — the join falls back to matching names",
    file: CROSS_SOURCE,
    suite: COMMAND_SUITE,
    find: "    joinedLine(repository, byRecordId.get(String(repository.repositoryId)), resolved),",
    replace:
      "    joinedLine(\n      repository,\n      byRecordId.get(String(repository.repositoryId)) ??\n        [...byRecordId.values()].find((d) => repository.fullName.includes(d.factKey)),\n      resolved,\n    ),",
    expect: "never a name match",
  },
  {
    /*
     * DEFENDED BY THE COMMAND SUITE, NOT THE FIREWALL, AND THAT IS THE HONEST PLACEMENT.
     *
     * `@/db/client.server` opens a handle but WRITES nothing, so the firewall's durable-write walk
     * correctly does not flag it — a graph check cannot tell a persistence intent from a connection.
     * What forbids it is the executor's own source ban, which is where this mutation is aimed.
     */
    label: "M4 the provider record is persisted — the executor gains a database handle",
    file: CROSS_SOURCE,
    suite: COMMAND_SUITE,
    find: 'import { findHebyCommandById } from "./registry";',
    replace:
      'import { getControlPlaneDb } from "@/db/client.server";\nimport { findHebyCommandById } from "./registry";',
    expect: "the cross-source executor must not contain",
  },
  {
    label: "M5 a Knowledge writer becomes reachable — the join imports the attach/withdraw authority",
    file: CROSS_SOURCE,
    suite: FIREWALL_SUITE,
    find: '} from "@/features/knowledge/external-reference-read.server";',
    replace:
      '} from "@/features/knowledge/external-reference-read.server";\nimport { attachExternalReference } from "@/features/knowledge/external-reference-authority.server";\nvoid attachExternalReference;',
    expect: "the attach/withdraw authority is NOT reachable",
  },
  {
    label: "M6 a Governance writer becomes reachable from the cross-source root",
    file: CROSS_SOURCE,
    suite: FIREWALL_SUITE,
    find: 'import { findHebyCommandById } from "./registry";',
    replace:
      'import { establishGovernanceAuthority } from "@/features/governance-decision/bootstrap-authority.server";\nvoid establishGovernanceAuthority;\nimport { findHebyCommandById } from "./registry";',
    expect: "the cross-source subgraph crossed a boundary it may not cross",
  },
  {
    label: "M7 an integration credential accessor becomes reachable",
    file: CROSS_SOURCE,
    suite: FIREWALL_SUITE,
    find: 'import { findHebyCommandById } from "./registry";',
    replace:
      'import { withDecryptedSecret } from "@/features/integration-credentials/credential-repository.server";\nvoid withDecryptedSecret;\nimport { findHebyCommandById } from "./registry";',
    expect: "must not reach src/features/integration-credentials/",
  },
  {
    label: "M8 an integration lifecycle writer becomes reachable",
    file: CROSS_SOURCE,
    suite: FIREWALL_SUITE,
    find: 'import { findHebyCommandById } from "./registry";',
    replace:
      'import { disconnectConnection } from "@/features/integration-authority/integration-repository.server";\nvoid disconnectConnection;\nimport { findHebyCommandById } from "./registry";',
    expect: "cross-source graph must not reach the integration repository",
  },
  {
    label: "M9 action authorization becomes reachable",
    file: CROSS_SOURCE,
    suite: FIREWALL_SUITE,
    find: 'import { findHebyCommandById } from "./registry";',
    replace:
      'import { consumeActionPermit } from "@/features/action-authorization/consume-action-permit.server";\nvoid consumeActionPermit;\nimport { findHebyCommandById } from "./registry";',
    expect: "must not reach src/features/action-authorization/",
  },
  {
    label: "M10 the model transport becomes reachable from the cross-source root",
    file: CROSS_SOURCE,
    suite: FIREWALL_SUITE,
    find: 'import { findHebyCommandById } from "./registry";',
    replace:
      'import { callClaudeOverHttp } from "@/features/heby-model-live/claude-http-transport.server";\nvoid callClaudeOverHttp;\nimport { findHebyCommandById } from "./registry";',
    expect: "the cross-source root's ONLY network reach is the GitHub transport",
  },
  {
    label: "M11 the ordinary read kind gains provider dispatch",
    file: READ_COMMANDS,
    suite: FIREWALL_SUITE,
    find: 'import type { HebyCommandResult } from "./contracts";',
    replace:
      'import { discoverInstallationRepositories } from "@/features/provider-github/discover-installation-repositories.server";\nvoid discoverInstallationRepositories;\nimport type { HebyCommandResult } from "./contracts";',
    expect: "the read root still reaches no provider dispatch seam",
  },
  {
    label: "M12 the model-answer root gains the GitHub transport",
    file: ANSWER,
    suite: FIREWALL_SUITE,
    find: "import {\n  toResponseSourceEvidence,",
    replace:
      'import { callGitHub } from "@/features/provider-github/github-transport.server";\nvoid callGitHub;\nimport {\n  toResponseSourceEvidence,',
    expect: "the answer root still reaches no provider dispatch seam",
  },
  {
    label: "M13 an unavailable Knowledge lookup is collapsed into 'no declaration recorded'",
    file: CROSS_SOURCE,
    suite: COMMAND_SUITE,
    find: '  if (!lookupResolved) {',
    replace: "  if (false as boolean) {",
    expect: 'must NEVER be rendered as "no declaration recorded"',
  },
  {
    label: "M14 a partial provider page is rendered as complete",
    file: CROSS_SOURCE,
    suite: COMMAND_SUITE,
    find: "    ...boundaryLines(discovery, shown.length),",
    replace: "    `Showing ${shown.length} repositories.`,",
    expect: "a truncated provider page is reported as partial",
  },
  {
    label: "M15 the repository fan-out is unbounded — the page ceiling is removed",
    file: CROSS_SOURCE,
    suite: COMMAND_SUITE,
    find: "  const shown = discovery.repositories.slice(0, GITHUB_PROVIDER_READ_BUDGET.maxRecords);",
    replace: "  const shown = discovery.repositories;",
    expect: "an over-long provider page is cut to the ceiling, not fanned out",
  },
  {
    label: "M16 the joined view is declared authoritative",
    file: CROSS_SOURCE,
    suite: COMMAND_SUITE,
    find: '  "ask. KNOWLEDGE RELATIONSHIPS are your organization\'s own durable declarations, each recorded by " +',
    replace:
      '  "ask. This joined view is authoritative: true. KNOWLEDGE RELATIONSHIPS are your organization\'s own durable declarations, each recorded by " +',
    expect: "the provenance must not contain",
  },
  {
    label: "M17 the batched lookup truncates instead of refusing — 'not asked' becomes 'not declared'",
    file: JOIN_SEAM,
    suite: JOIN_SUITE,
    find: "  if (queried.length > MAX_EXTERNAL_RECORD_LOOKUP) {\n    return { status: \"unavailable\", reason: \"too-many-records\" };\n  }",
    replace: "  const capped = queried.slice(0, MAX_EXTERNAL_RECORD_LOOKUP);\n  void capped;",
    expect: "too many ids REFUSES",
  },
  {
    label: "M18 a failed Knowledge query is swallowed into an empty result",
    file: JOIN_SEAM,
    suite: JOIN_SUITE,
    find: '    return { status: "unavailable", reason: "query-failed" };',
    replace: '    return { status: "resolved", declarations: Object.freeze([]), queried };',
    expect: "a failed query is UNAVAILABLE, never empty",
  },
  {
    label: "M19 a withdrawn declaration keeps answering the join",
    file: JOIN_SEAM,
    suite: JOIN_SUITE,
    find: "          inArray(knowledgeExternalReferences.recordId, [...queried]),\n          isNull(knowledgeExternalReferences.withdrawnAt),",
    replace: "          inArray(knowledgeExternalReferences.recordId, [...queried]),",
    expect: "a withdrawn declaration is gone from the join",
  },
  {
    label: "M20 a command claims cross-source reach without declaring it",
    file: REGISTRY,
    suite: COMMAND_SUITE,
    find: '    reachesProvider: kind === "provider-read" || kind === "cross-source-read",',
    replace: '    reachesProvider: kind === "provider-read",',
    expect: "it says out loud that it leaves the building",
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
    assert.equal(
      sha(readFile(mutation.file)),
      sha(mutated),
      `${mutation.label}: the mutation did not reach disk`,
    );
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
        run.timedOut,
        false,
        `${mutation.label}: the defending suite TIMED OUT after ${CHILD_TIMEOUT_MS}ms. That is a ` +
          "VOID result, not a bite.",
      );
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
  console.log(`int5c-flow/bite-proofs: ${bitten} mutations bit`);
}

main();
