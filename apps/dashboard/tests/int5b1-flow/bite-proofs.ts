/*
 * INT-5B1 — BITE-PROOFS.
 *
 * Every guarantee this phase introduces is mutated in the SHIPPED SOURCE, and the suite that
 * defends it must fail — for the INTENDED reason, not merely for some reason. A guard that cannot
 * be shown to bite is a comment with a test's syntax.
 *
 * Three conditions per mutation:
 *   1. the mutation CHANGED the file (a find-string that no longer matches proves nothing)
 *   2. the mutation REACHED disk (verified by digest before the suite runs)
 *   3. the defending suite failed, and its output names the intended reason
 *
 * Restoration runs in `finally` and is verified byte-identically, so a failure never leaves mutated
 * source on disk. Nothing here contacts a provider: every mutation is defended by a suite that runs
 * with no network, no key and no database.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const CONTRACT_SUITE = "tests/int5b1-flow/command-contract.ts";
const FAILURE_SUITE = "tests/int5b1-flow/authorization-and-failure.ts";
const EVIDENCE_SUITE = "tests/int5b1-flow/evidence-and-security.ts";
const FIREWALL_SUITE = "tests/int5b1-flow/provider-read-firewall.ts";
const DETECTOR_SUITE = "tests/int5b1-flow/write-detector.ts";

const EXECUTOR = "src/features/heby-commands/provider-read-commands.server.ts";
/*
 * INT-5C moved the provider WORDING — the refusal and fault sentences and the page-bound lines —
 * out of the executor and into its own module, so a second command reading the same provider seam
 * could not fork them into a second interpretation. The executor's own behaviour is unchanged and
 * its public surface is unchanged; the mutations below that aim at a SENTENCE now aim at the file
 * that holds it.
 */
const VOCABULARY = "src/features/heby-commands/provider-read-vocabulary.ts";
const DISPATCH = "src/features/heby-commands/dispatch.ts";
const PARSER = "src/features/heby-commands/parser.ts";
const REGISTRY = "src/features/heby-commands/registry.ts";
const AUTHORIZED_CALL = "src/features/provider-github/github-authorized-call.server.ts";
const ANSWER = "src/features/heby-answer/model-answer.server.ts";
const DETECTOR = "tests/helpers/durable-write-detector.ts";

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
  /** Text the failing run must contain. */
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    /*
     * M1 — the tenant gate at the COMMAND boundary. The ROW-LEVEL predicate is not duplicated here:
     * `tests/i1-connection-authority/bite-proofs.ts` M1 deletes it and runs against a real database,
     * which is the only place that property can be observed. This owns the gate INT-5B1 introduced.
     */
    label: "M1 an unauthenticated caller reaches the provider read",
    file: EXECUTOR,
    suite: FAILURE_SUITE,
    find: '  if (!tenant) return { status: "unauthorized" };',
    replace: '  if (!tenant) { /* mutated: anonymous callers proceed */ }',
    expect: "unauthorized",
  },
  {
    label: "M2 the capability authority is consulted only AFTER a token is minted",
    file: AUTHORIZED_CALL,
    suite: FIREWALL_SUITE,
    find: '  if (!entry || entry.state !== "available" || !source) {\n    return { ok: false, refusal: "capability-not-available" };\n  }',
    replace: "  /* mutated: the authority no longer refuses before spending */",
    expect: "before anything is spent",
  },
  {
    label: "M3 a connection lifecycle writer re-enters the GitHub read graph",
    file: AUTHORIZED_CALL,
    suite: FIREWALL_SUITE,
    find: 'import { listConnections } from "@/features/integration-authority/integration-read.server";',
    replace: 'import { listConnections } from "@/features/integration-authority/integration-repository.server";',
    expect: "must not reach the integration repository",
  },
  {
    label: "M4 the credential repository becomes reachable from the provider read",
    file: EXECUTOR,
    suite: FIREWALL_SUITE,
    find: 'import { findHebyCommandById } from "./registry";',
    replace:
      'import { listCredentialMetadata } from "@/features/integration-credentials/credential-repository.server";\n' +
      'import { findHebyCommandById } from "./registry";\n' +
      "export const __mutated = listCredentialMetadata;",
    expect: "must not reach src/features/integration-credentials/",
  },
  {
    label: "M5 a Knowledge writer becomes reachable from the provider read",
    file: EXECUTOR,
    suite: FIREWALL_SUITE,
    find: 'import { findHebyCommandById } from "./registry";',
    replace:
      'import { readKnowledgeAvailability } from "@/features/knowledge/knowledge-read.server";\n' +
      'import { findHebyCommandById } from "./registry";\n' +
      "export const __mutated = readKnowledgeAvailability;",
    expect: "must not reach src/features/knowledge/",
  },
  {
    label: "M6 the action-authorization surface becomes reachable from the provider read",
    file: EXECUTOR,
    suite: FIREWALL_SUITE,
    find: 'import { findHebyCommandById } from "./registry";',
    replace:
      'import { consumeActionPermit } from "@/features/action-authorization/consume-action-permit.server";\n' +
      'import { findHebyCommandById } from "./registry";\n' +
      "export const __mutated = consumeActionPermit;",
    expect: "must not reach src/features/action-authorization/",
  },
  {
    label: "M7 a rate-limited provider is reported as an empty list",
    file: EXECUTOR,
    suite: FAILURE_SUITE,
    find: "    return unavailable(\n      slash,\n      \"GitHub did not answer\",",
    replace: "    return ok(\n      slash,\n      \"No repositories in this installation\",",
    expect: "must never render in an informational tone",
  },
  {
    label: "M8 a provider timeout is reported as an empty list",
    file: EXECUTOR,
    suite: FAILURE_SUITE,
    find: '    return unavailable(slash, "GitHub did not answer in time", [',
    replace: '    return ok(slash, "No repositories in this installation", [',
    expect: "must never render in an informational tone",
  },
  {
    label: "M9 a partial page is presented as complete",
    file: VOCABULARY,
    suite: FAILURE_SUITE,
    find: "  if (discovery.truncated) {",
    replace: "  if (false) {",
    expect: "PARTIAL, NOT COMPLETE",
  },
  {
    label: "M10 the mutable full name is used as the record identity",
    file: EXECUTOR,
    suite: EVIDENCE_SUITE,
    find: "githubRepositoryRecordRef(repository.repositoryId)",
    replace:
      "`integrations/${GITHUB_PROVIDER_KEY}/${GITHUB_REPOSITORY_ACTIVITY_CAPABILITY}/repository/${repository.fullName}`",
    expect: "the number is the identity",
  },
  {
    label: "M11 provider-derived evidence declares itself authoritative",
    file: EXECUTOR,
    suite: EVIDENCE_SUITE,
    find: '  "tenant (authoritative: false). Provider-derived observation, not organizational truth: nothing " +',
    replace: '  "tenant (authoritative: true). Settled organizational Knowledge, endorsed on read: nothing " +',
    expect: "the provenance must state its own standing",
  },
  {
    label: "M12 the raw provider payload is rendered onto the surface",
    file: EXECUTOR,
    suite: EVIDENCE_SUITE,
    find: "  return `[${githubRepositoryRecordRef(repository.repositoryId)}] ${repository.fullName} — ${flags.join(\" · \")}`;",
    replace:
      "  return `[${githubRepositoryRecordRef(repository.repositoryId)}] ${repository.fullName} — ${flags.join(\" · \")} ${JSON.stringify(repository)}`;",
    expect: "must not carry",
  },
  {
    /*
     * M13 — THE DEFINING BITE OF THIS PHASE. The whole reason `provider-read` is a separate kind is
     * that the ordinary answer path must remain incapable of contacting a provider. Wiring the
     * GitHub reader into it is the exact regression the split firewall exists to catch.
     */
    label: "M13 the ordinary Heby answer path gains GitHub provider reach",
    file: ANSWER,
    suite: FIREWALL_SUITE,
    find: 'import { readIntegrationGroundingSource } from "@/features/integration-authority/heby-integration-source.server";',
    replace:
      'import { readIntegrationGroundingSource } from "@/features/integration-authority/heby-integration-source.server";\n' +
      'import { discoverInstallationRepositories } from "@/features/provider-github/discover-installation-repositories.server";\n' +
      "export const __mutated = discoverInstallationRepositories;",
    expect: "must reach EXACTLY ONE network module",
  },
  {
    label: "M14 the command is unwired from the planner while its imports remain",
    file: DISPATCH,
    suite: CONTRACT_SUITE,
    find: '  if (command.kind === "provider-read") {\n    return { kind: "provider-read", commandId: command.id, handler: command.handler, args };\n  }',
    replace: "  /* mutated: a provider-read command falls through to the handler switch */",
    expect: "the planner branches on the declared kind",
  },
  {
    label: "M15 slash input can be returned to the model as a prompt",
    file: PARSER,
    suite: CONTRACT_SUITE,
    find: '  if (!trimmed.startsWith("/")) return { kind: "prompt", prompt: trimmed };',
    replace: '  return { kind: "prompt", prompt: trimmed };',
    expect: "/repositories parses as a command",
  },
  {
    label: "M16 a command claims external reach it does not have",
    file: REGISTRY,
    suite: CONTRACT_SUITE,
    find: '    reachesProvider: kind === "provider-read" || kind === "cross-source-read",',
    replace: '    reachesProvider: kind === "provider-read" || kind === "read",',
    expect: "reachesProvider must be true exactly for provider-reaching commands",
  },
  {
    label: "M17 the durable-write detector is reverted to the pattern that cried wolf",
    file: DETECTOR,
    suite: DETECTOR_SUITE,
    find: "export function performsDurableWrite(source: string): boolean {\n  const code = codeOf(source);\n  return DRIZZLE_WRITE_CHAIN.test(code) || DATABASE_HANDLE_WRITE.test(code);\n}",
    replace:
      "export function performsDurableWrite(source: string): boolean {\n" +
      "  return /\\.insert\\(|\\.update\\(|\\.delete\\(/.test(codeOf(source));\n}",
    expect: "must NOT call this a durable write",
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
  console.log(`int5b1-flow/bite-proofs: ${bitten} mutations bit`);
}

main();
