/*
 * INT-5B2 — BITE-PROOFS.
 *
 * Every guarantee this phase introduces is mutated in the SHIPPED SOURCE, and the suite that
 * defends it must fail — for the INTENDED reason, not merely for some reason.
 *
 * Three conditions per mutation: the mutation changed the file, it reached disk, and the defending
 * suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically, so a failure never leaves mutated source on disk.
 *
 * Every child run is bounded: a mutation that makes a command BLOCK rather than refuse would hang
 * this file forever, and a hanging bite-proof is not a verdict.
 *
 * No production database is touched, no provider is contacted, and no secret is read.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const COMMAND_SUITE = "tests/int5b2-flow/command-and-provenance.ts";
const FIREWALL_SUITE = "tests/int5b2-flow/pull-request-firewall.ts";

const EXECUTOR = "src/features/heby-commands/provider-read-commands.server.ts";
const REGISTRY = "src/features/heby-commands/registry.ts";
const HOOK = "src/components/layout/heby/use-heby-conversation.ts";
const PROJECTION = "src/features/heby-commands/command-capability-projection.server.ts";

const CHILD_TIMEOUT_MS = 5 * 60 * 1000;

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
  {
    /*
     * THE DEFECT THIS WHOLE COMMAND IS SHAPED AROUND. A repository Hebun could not read, dropped
     * from the answer, is indistinguishable from a repository with nothing open.
     */
    label: "M1 a repository that could not be read is silently dropped instead of named",
    file: EXECUTOR,
    suite: COMMAND_SUITE,
    find: `    lines.push("NOT READ, and therefore not answered for — this is not an absence of pull requests:");
    lines.push(...unread.map((entry) => \`\${entry.repository}: \${entry.why}.\`));`,
    replace: `    lines.push("");`,
    expect: "and the one that did not is NAMED",
  },
  {
    label: "M2 a refusal is rendered as a result instead of an unavailable",
    file: EXECUTOR,
    suite: COMMAND_SUITE,
    find: `      return unavailable(
        slash,
        "Pull requests were not read",
        REFUSAL_LINES[outcome.refusal] ?? [`,
    replace: `      return ok(
        slash,
        "Pull requests were not read",
        REFUSAL_LINES[outcome.refusal] ?? [`,
    expect: "is an unavailable, never a result",
  },
  {
    label: "M3 not one readable repository is reported as an empty answer",
    file: EXECUTOR,
    suite: COMMAND_SUITE,
    find: `    return unavailable(slash, "No repository could be read", [`,
    replace: `    return ok(slash, "No repository could be read", [`,
    expect: "NOT ONE READABLE REPOSITORY IS AN UNAVAILABLE",
  },
  {
    label: "M4 the mutable title is used as the record identity instead of the provider's number",
    file: EXECUTOR,
    suite: COMMAND_SUITE,
    find: `  return \`\${githubRepositoryRecordRef(repositoryId)}/pull-request/\${number}\`;`,
    replace: `  return \`\${githubRepositoryRecordRef(repositoryId)}/pull-request/\${number}\`.toUpperCase();`,
    expect: "THE IDENTITY IS THE REPOSITORY'S REFERENCE PLUS GITHUB'S OWN NUMBER",
  },
  {
    label: "M5 provider-derived evidence declares itself organizational truth",
    file: EXECUTOR,
    suite: COMMAND_SUITE,
    find: `  "tenant (authoritative: false). Provider-derived observation, not organizational truth: nothing " +
  "was stored, indexed or admitted anywhere, and asking again re-reads it. These are OPEN pull "`,
    replace: `  "tenant (authoritative: true). Organizational truth: nothing " +
  "was stored, indexed or admitted anywhere, and asking again re-reads it. These are OPEN pull "`,
    expect: "PROVIDER-DERIVED != ORGANIZATIONAL TRUTH",
  },
  {
    label: "M6 a truncated repository page is presented as complete",
    file: EXECUTOR,
    suite: COMMAND_SUITE,
    find: `    if (entry.truncated) {
      lines.push(
        \`PARTIAL, NOT COMPLETE: GitHub had more open pull requests than one page holds for \` +`,
    replace: `    if (false) {
      lines.push(
        \`PARTIAL, NOT COMPLETE: GitHub had more open pull requests than one page holds for \` +`,
    expect: "PARTIAL, NOT COMPLETE: GitHub had more open pull requests",
  },
  {
    label: "M7 the fan-out ceiling is removed — every repository is read with no declared bound",
    file: EXECUTOR,
    suite: COMMAND_SUITE,
    find: `      const examined = discovered.value.repositories.slice(
        0,
        GITHUB_PULL_REQUEST_READ_BUDGET.maxRepositoriesExamined,
      );`,
    replace: `      const examined = discovered.value.repositories;`,
    expect: "PARTIAL, NOT COMPLETE: this installation covers",
  },
  {
    label: "M8 the command loses its capability binding and its state becomes unknown by omission",
    file: PROJECTION,
    suite: FIREWALL_SUITE,
    find: `  "pull-requests": GITHUB_REPOSITORY_ACTIVITY_CAPABILITY,`,
    replace: ``,
    expect: "it binds the SAME capability key",
  },
  {
    label: "M9 the surface tells the reader the wrong read is happening",
    file: HOOK,
    suite: FIREWALL_SUITE,
    find: `                plan.commandId === "pull-requests"`,
    replace: `                false`,
    expect: "the placeholder is per command",
  },
  {
    /*
     * DEFENDED BY THE REGISTRY VALIDATOR ITSELF, which is the honest placement: `reachesProvider`
     * is DERIVED from the kind, so a descriptor claiming the wrong kind is caught by the registry's
     * own invariants before any assertion of this phase's is reached.
     */
    label: "M10 the command stops declaring that it reaches a provider",
    file: REGISTRY,
    suite: COMMAND_SUITE,
    find: `    availability: "available", handler: "pull-requests", ...base("provider-read"),`,
    replace: `    availability: "available", handler: "pull-requests", ...base("read"),`,
    expect: "the registry invariants hold with it in",
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
        run.timedOut,
        false,
        `${mutation.label}: the defending suite TIMED OUT after ${CHILD_TIMEOUT_MS}ms. That is a VOID result, not a bite.`,
      );
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the mutation SURVIVED — ${mutation.suite} still passed.\n--- actual ---\n${run.output.slice(-2000)}`,
      );
      assert.ok(
        run.output.includes(mutation.expect),
        `${mutation.label}: the suite failed, but not for the intended reason. Expected output containing "${mutation.expect}".\n--- actual ---\n${run.output.slice(-2500)}`,
      );
    });
    bitten += 1;
    console.log(`BITE ${mutation.label}`);
  }
  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(`int5b2-flow/bite-proofs: ${bitten} mutations bit`);
}

main();
