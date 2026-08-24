/*
 * GITHUB-1 BITE-PROOFS — eleven mutations of the REAL source, plus one correct change that must be
 * accepted.
 *
 * This phase's guards keep two worlds apart, keep a write permission unrequestable, and stand
 * between a granted GitHub permission and the source code it would let Hebun read. A test that
 * stays green after such a guard is deleted is not protecting anything, and the source-content
 * boundary here is HEBUN'S rather than the provider's — so it is the one that most needs proving.
 *
 * Four conditions per proof: the mutation APPLIED, the run FAILED, it failed for the INTENDED
 * REASON, and the file came back byte-identical by sha256. Restoration runs in `finally`.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const SUITE = "tests/github1-provider-contract/contract.ts";

const CONTRACTS = "src/features/provider-github/contracts.ts";
const CATALOG = "src/features/provider-catalog/catalog.ts";
const SIMULATION_TYPES = "src/features/providers/github/types.ts";

const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

function runSuite(suite: string): { ok: boolean; output: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 300_000,
  });
  assert.ok(!result.error, `the child run of ${suite} failed to execute: ${result.error?.message}`);
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly find: string;
  readonly replace: string;
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  /* ── THE WORLD A / WORLD B BOUNDARY ─────────────────────────────────────── */
  {
    label: "M1 the real provider takes the simulation's bare key",
    file: CONTRACTS,
    find: 'export const GITHUB_PROVIDER_KEY = "github-organization" as const;',
    replace: 'export const GITHUB_PROVIDER_KEY = "github" as const;',
    expect: "must not be the same string",
  },
  {
    label: "M2 the simulation reaches real connection truth",
    file: SIMULATION_TYPES,
    find: 'export const GITHUB_PROVIDER_ID = "github";',
    /*
     * The id KEEPS its value on purpose. An earlier version of this mutation aliased it to the
     * real catalog key, and M1's distinct-keys assertion fired first — a proof that bit for the
     * wrong reason and would have reported the firewall as tested when it was not. Here the only
     * thing that changes is the import edge.
     */
    replace:
      'import { PROVIDER_CATALOG } from "@/features/provider-catalog/catalog";\n' +
      'export const GITHUB_PROVIDER_ID = PROVIDER_CATALOG.length >= 0 ? "github" : "github";',
    expect: "the simulation may never reach real connection truth",
  },

  /* ── LEAST PRIVILEGE ────────────────────────────────────────────────────── */
  {
    label: "M3 the requested set buys source-file access",
    file: CONTRACTS,
    find: '  "metadata:read",\n  "pull_requests:read",\n]);',
    replace: '  "metadata:read",\n  "pull_requests:read",\n  "contents:read",\n]);',
    expect: "is on the deny list and may never be requested",
  },
  {
    label: "M4 the capability declares a write scope",
    file: CONTRACTS,
    find: "export const GITHUB_REPOSITORY_ACTIVITY_WRITE_PERMISSIONS: readonly string[] = Object.freeze([]);",
    replace:
      "export const GITHUB_REPOSITORY_ACTIVITY_WRITE_PERMISSIONS: readonly string[] = Object.freeze([\n" +
      '  "pull_requests:write",\n]);',
    expect: "write is structurally unreachable",
  },
  {
    label: "M5 a granted write launders into satisfying a read requirement",
    file: CONTRACTS,
    find: "  return GITHUB_REQUIRED_GRANTED_PERMISSIONS.every((required) => granted.includes(required));",
    replace:
      "  return GITHUB_REQUIRED_GRANTED_PERMISSIONS.every((required) =>\n" +
      "    granted.some((entry) => entry.split(\":\")[0] === required.split(\":\")[0]),\n" +
      "  );",
    expect: "a write must never launder into satisfying a read requirement",
  },

  /* ── THE SOURCE-CONTENT FIREWALL ────────────────────────────────────────── */
  {
    label: "M6 the allow list grows an address for a pull request's files",
    file: CONTRACTS,
    find: '  "/repos/{owner}/{repo}/pulls",\n]);',
    replace: '  "/repos/{owner}/{repo}/pulls",\n  "/repos/{owner}/{repo}/pulls/{pull_number}/files",\n]);',
    expect: "that is source content or a",
  },
  {
    label: "M7 the allow list grows an address for file contents",
    file: CONTRACTS,
    find: '  "/repos/{owner}/{repo}/pulls",\n]);',
    replace: '  "/repos/{owner}/{repo}/pulls",\n  "/repos/{owner}/{repo}/contents/{path}",\n]);',
    expect: "that is source content or a",
  },
  {
    label: "M8 the pinned media type becomes a unified diff",
    file: CONTRACTS,
    find: 'export const GITHUB_ACCEPT_MEDIA_TYPE = "application/vnd.github+json" as const;',
    replace: 'export const GITHUB_ACCEPT_MEDIA_TYPE = "application/vnd.github.diff" as const;',
    expect: "must not be a diff, patch or raw media type",
  },
  {
    label: "M9 the pull-request view grows a hole for source content",
    file: CONTRACTS,
    find: "  readonly authorLogin: string | null;",
    replace: "  readonly authorLogin: string | null;\n  readonly patch: string | null;",
    expect: "that is a hole for source content",
  },

  /* ── HOSTILE PROVIDER INPUT ─────────────────────────────────────────────── */
  {
    label: "M10 an unrecognized permission level is normalized anyway",
    file: CONTRACTS,
    find: "    if (!GITHUB_PERMISSION_LEVELS.includes(level as GitHubPermissionLevel)) continue;",
    replace: "    /* mutated: any string is accepted as a level */",
    expect: "an unrecognized level is not a level",
  },
  {
    label: "M11 an inherited permission is read off the prototype chain",
    file: CONTRACTS,
    find: "  for (const name of Object.keys(permissions)) {",
    replace: "  for (const name in permissions) {",
    expect: "an inherited permission is invisible, never accepted",
  },
];

/**
 * Behaviour-preserving. The suite must ACCEPT it, or the assertions test the spelling of the
 * source rather than the rule it encodes. `5e1` and `50` are the same number.
 */
const ACCEPTED = {
  label: "A1 a page bound is written in exponent form — identical value",
  file: CONTRACTS,
  find: "export const MAX_REPOSITORIES_PER_PAGE = 50;",
  replace: "export const MAX_REPOSITORIES_PER_PAGE = 5e1;",
} as const;

let bitten = 0;

function withMutation(
  file: string,
  edits: readonly { find: string; replace: string }[],
  body: () => void,
): void {
  const original = readFile(file);
  const before = sha(original);
  let mutated = original;
  for (const edit of edits) {
    assert.ok(
      mutated.includes(edit.find),
      `the mutation target is not present in ${file} — the proof would be vacuous:\n${edit.find}`,
    );
    mutated = mutated.replace(edit.find, edit.replace);
  }
  assert.notEqual(mutated, original, `the mutation changed nothing in ${file}`);
  try {
    writeFileSync(abs(file), mutated, "utf8");
    assert.equal(sha(readFile(file)), sha(mutated), `the mutation did not reach ${file}`);
    body();
  } finally {
    writeFileSync(abs(file), original, "utf8");
  }
  assert.equal(sha(readFile(file)), before, `${file} was not restored byte-identically`);
}

function main(): void {
  /*
   * THE CATALOG NAMES NO GITHUB PROVIDER YET, and that is a precondition of these proofs rather
   * than an accident. GITHUB-1 deferred the definition to the phase that builds the verifier, so
   * every guard below is defended by `contracts.ts` alone — there is no second place a literal
   * could be restated and quietly escape every mutation here.
   */
  assert.ok(
    !readFile(CATALOG).includes("github"),
    "the catalog must not name GitHub while no code can confirm an installation",
  );

  for (const mutation of MUTATIONS) {
    withMutation(mutation.file, [mutation], () => {
      const run = runSuite(SUITE);
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the suite still PASSED — the guard it targets does not bite`,
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

  withMutation(ACCEPTED.file, [{ find: ACCEPTED.find, replace: ACCEPTED.replace }], () => {
    const run = runSuite(SUITE);
    assert.ok(
      run.ok,
      `${ACCEPTED.label}: a behaviour-preserving change was REJECTED — the suite tests the ` +
        `spelling rather than the rule.\n--- actual ---\n${run.output.slice(-2000)}`,
    );
  });
  console.log(`ACCEPT ${ACCEPTED.label}`);

  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(
    `github1-provider-contract/bite-proofs: ${bitten} mutations bit, 1 correct change accepted`,
  );
}

main();
