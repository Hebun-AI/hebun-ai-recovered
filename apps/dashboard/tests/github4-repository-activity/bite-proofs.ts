/*
 * GITHUB-4 BITE-PROOFS — mutations of the REAL source, plus one correct change that must be
 * accepted.
 *
 * This is the phase that mints a credential able to read every repository an organization
 * selected. Each mutation below removes exactly one thing standing between that token and
 * something it must never reach: a forbidden endpoint, a diff media type, a caller's chosen
 * repository, an unauthorized tenant, a log line. A guard that stays green after being deleted was
 * never protecting anything.
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

const SUITE = "tests/github4-repository-activity/capability.ts";

const TRANSPORT = "src/features/provider-github/github-transport.server.ts";
const AUTHORIZED = "src/features/provider-github/github-authorized-call.server.ts";
const DISCOVERY = "src/features/provider-github/discover-installation-repositories.server.ts";
const PULLS = "src/features/provider-github/read-repository-pull-requests.server.ts";

const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

function runSuite(): { ok: boolean; output: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", SUITE], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 300_000,
  });
  assert.ok(!result.error, `the child run of ${SUITE} failed to execute: ${result.error?.message}`);
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
  /* ── THE FIREWALL ────────────────────────────────────────────────────────── */
  {
    label: "M1 the firewall permits everything",
    file: TRANSPORT,
    find: "  return GITHUB_TRANSPORT_OPERATIONS.some(",
    replace: "  if (candidate) return true;\n  return GITHUB_TRANSPORT_OPERATIONS.some(",
    /* The first refusal the suite checks — a permit-everything firewall fails there first. */
    expect: "a write method on a read address is refused",
  },
  {
    label: "M2 the authentication class stops being part of the key",
    file: TRANSPORT,
    find: "      op.auth === candidate.auth &&",
    replace: "",
    expect: "the App credential may not read a repository",
  },
  {
    label: "M3 the Accept header stops being part of the key",
    file: TRANSPORT,
    find: "      op.accept === candidate.accept,",
    replace: "      true,",
    expect: "a content media type is refused on a permitted address",
  },
  {
    label: "M4 the method stops being part of the key",
    file: TRANSPORT,
    find: "      op.method === candidate.method &&",
    replace: "",
    expect: "a write method on a read address is refused",
  },
  {
    label: "M5 a contents operation is added to the table",
    file: TRANSPORT,
    find: "    accept: GITHUB_ACCEPT_MEDIA_TYPE,\n  }),\n] as const);",
    replace:
      "    accept: GITHUB_ACCEPT_MEDIA_TYPE,\n  }),\n  Object.freeze({\n" +
      '    id: "list-open-pull-requests" as never,\n    method: "GET",\n' +
      '    pathTemplate: "/repos/{owner}/{repo}/contents/{path}",\n    auth: "installation",\n' +
      "    accept: GITHUB_ACCEPT_MEDIA_TYPE,\n  }),\n] as const);",
    expect: "four operations, and no fifth",
  },

  /* ── THE SOURCE-CONTENT FIREWALL ─────────────────────────────────────────── */
  {
    label: "M6 the pull-request read asks for a unified diff",
    file: TRANSPORT,
    find: "    accept: GITHUB_ACCEPT_MEDIA_TYPE,\n  }),\n] as const);",
    replace: '    accept: "application/vnd.github.diff",\n  }),\n] as const);',
    expect: "pins the JSON media type",
  },
  {
    label: "M7 the pull-request read stops pinning state=open",
    file: TRANSPORT,
    find: '    query: { state: "open", per_page: String(MAX_PULL_REQUESTS_PER_PAGE) },',
    replace: "    query: { per_page: String(MAX_PULL_REQUESTS_PER_PAGE) },",
    expect: "the pull-request read pins state=open",
  },

  /* ── THE TOKEN ───────────────────────────────────────────────────────────── */
  {
    label: "M8 the capability verdict is ignored and a token is minted anyway",
    file: AUTHORIZED,
    find:
      "  const source = entry?.sources.find((s) => s.readAvailable && s.providerKey === GITHUB_PROVIDER_KEY);\n" +
      '  if (!entry || entry.state !== "available" || !source) {',
    replace:
      "  const source = entry?.sources.find((s) => s.providerKey === GITHUB_PROVIDER_KEY);\n" +
      "  if (!entry || !source) {",
    expect: "refuses as a capability gap",
  },
  {
    label: "M9 the trusted tenant check is dropped",
    file: AUTHORIZED,
    find: "  if (!tenant?.tenantId) {",
    replace: "  if (false) {",
    expect: "the refusal names the missing tenant, not a capability gap",
  },
  {
    label: "M10 the mint asks for write access",
    file: AUTHORIZED,
    find: '  pull_requests: "read",',
    replace: '  pull_requests: "write",',
    expect: "the requested permission set is exactly the capability's own",
  },
  {
    label: "M11 the installation identity is taken from anywhere",
    file: AUTHORIZED,
    find: "  if (installationId === null) {",
    replace: "  if (false) {",
    expect: "an unusable installation identity refuses as such",
  },
  {
    label: "M12 the token response is echoed when it carries no token",
    file: TRANSPORT,
    find: '      return fail("malformed", "github-token-response-carried-no-token");',
    replace: '      return fail("malformed", `github-token-response-carried-no-token-${JSON.stringify(body)}`);',
    expect: "the body it came from is never echoed",
  },

  /* ── REPOSITORY AUTHORITY ────────────────────────────────────────────────── */
  {
    label: "M13 any repository in the listing satisfies the caller's id",
    file: PULLS,
    find: "r !== null && r.id === repositoryId",
    replace: "r !== null",
    expect: "an unknown repository id is refused",
  },
  {
    label: "M14 a nonsense repository id is no longer bounded",
    file: PULLS,
    find: "  if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0) {",
    replace: "  if (false) {",
    expect: "a nonsense repository id is refused",
  },
  {
    label: "M15 a pull request carries its diff url",
    file: PULLS,
    find: "    createdAt: str(body, \"created_at\"),",
    replace: '    createdAt: str(body, "created_at"),\n    diffUrl: str(body, "diff_url"),',
    expect: "a pull request carries exactly the declared metadata fields",
  },

  /* ── BOUNDS ──────────────────────────────────────────────────────────────── */
  {
    label: "M16 the repository page bound is removed",
    file: DISCOVERY,
    find: "        .slice(0, MAX_REPOSITORIES_PER_PAGE)",
    replace: "        .slice(0)",
    expect: "the page bound is enforced",
  },
  {
    label: "M17 truncation is hidden",
    file: DISCOVERY,
    find: "          truncated: total !== null && total > repositories.length,",
    replace: "          truncated: false,",
    expect: "truncation is stated rather than hidden",
  },
];

/**
 * A behaviour-preserving change that MUST be accepted.
 *
 * The repository page bound written as an equal arithmetic expression. If the suite rejects this,
 * it is testing the spelling of a constant rather than the bound it expresses.
 */
const ACCEPTED = {
  label: "A1 the repository bound is written as an equal expression — identical value",
  file: DISCOVERY,
  find: "        .slice(0, MAX_REPOSITORIES_PER_PAGE)",
  replace: "        .slice(0, MAX_REPOSITORIES_PER_PAGE + 0)",
};

let bitten = 0;

function withMutation(
  file: string,
  edits: ReadonlyArray<{ find: string; replace: string }>,
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
  for (const mutation of MUTATIONS) {
    withMutation(mutation.file, [mutation], () => {
      const run = runSuite();
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
    const run = runSuite();
    assert.ok(
      run.ok,
      `${ACCEPTED.label}: a behaviour-preserving change was REJECTED — the suite tests the ` +
        `spelling rather than the rule.\n--- actual ---\n${run.output.slice(-2000)}`,
    );
  });
  console.log(`ACCEPT ${ACCEPTED.label}`);

  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(
    `github4-repository-activity/bite-proofs: ${bitten} mutations bit, 1 correct change accepted`,
  );
}

main();
