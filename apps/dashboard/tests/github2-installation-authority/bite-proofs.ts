/*
 * GITHUB-2 BITE-PROOFS — twelve mutations of the REAL source, plus one correct change that must be
 * accepted.
 *
 * This phase decides whether an organization's repositories become visible to a Hebun tenant, on
 * the strength of a number that arrived in a URL anyone can construct. Every guard below stands
 * between a spoofed `installation_id` and a connection, or between a granted permission and a
 * capability claim. A test that stays green after one is deleted is not protecting anything.
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

const SUITE = "tests/github2-installation-authority/installation-authority.ts";

const JWT = "src/features/provider-github/github-app-jwt.server.ts";
const STATE = "src/features/provider-github/install-state.server.ts";
const TRANSPORT = "src/features/provider-github/github-transport.server.ts";
const VERIFIER = "src/features/provider-github/verify-installation.server.ts";
const ORCHESTRATOR = "src/features/provider-github/connect-installation.server.ts";
const SETUP_ROUTE = "src/app/api/integrations/github/setup/route.ts";
const CONTRACTS = "src/features/provider-github/contracts.ts";
const MODEL = "src/features/github-connection-surface/model.ts";

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
  /* ── THE APP ASSERTION ───────────────────────────────────────────────────── */
  {
    label: "M1 the App JWT lifetime exceeds GitHub's ten-minute ceiling",
    file: JWT,
    find: "export const GITHUB_APP_JWT_TTL_SECONDS = 540;",
    replace: "export const GITHUB_APP_JWT_TTL_SECONDS = 600;",
    expect: "GitHub's ceiling is 600s",
  },
  {
    label: "M2 the clock-drift backdating is dropped",
    file: JWT,
    find: "    iat: nowSeconds - GITHUB_APP_JWT_CLOCK_SKEW_SECONDS,",
    replace: "    iat: nowSeconds,",
    expect: "Set this 60 seconds in the past",
  },

  /* ── THE TENANT BINDING ──────────────────────────────────────────────────── */
  {
    label: "M3 a state minted for one tenant completes for another",
    file: STATE,
    find: '  if (payload.tenantId !== input.tenantId) return { ok: false, reason: "tenant-mismatch" };',
    replace: "  /* mutated: any tenant may finish any installation */",
    expect: "another tenant must be refused",
  },
  {
    label: "M4 a state minted in one session completes in another",
    file: STATE,
    find: '    return { ok: false, reason: "session-mismatch" };',
    replace: "    /* mutated: any session may finish any flow */",
    expect: "another session must be refused",
  },
  {
    label: "M5 the state signature is no longer checked",
    file: STATE,
    find: '    return { ok: false, reason: "bad-signature" };',
    replace: "    /* mutated: a forged envelope is accepted */",
    expect: "a forgery must be refused",
  },
  {
    label: "M6 the state never expires",
    file: STATE,
    find: '    return { ok: false, reason: "expired" };',
    replace: "    /* mutated: an old state is accepted forever */",
    expect: "an expired state must be refused",
  },
  {
    label: "M7 the setup route takes the connection from the query string",
    file: SETUP_ROUTE,
    find: "    state.payload.integrationId,",
    replace:
      '    request.nextUrl.searchParams.get("integration_id") ?? state.payload.integrationId,',
    expect: "the setup route reads exactly the two parameters GitHub sends",
  },

  /* ── THE ORGANIZATION-ONLY RULE ──────────────────────────────────────────── */
  {
    label: "M8 a personal installation is silently accepted",
    file: VERIFIER,
    find: '    return fail("identity", "installation-is-not-an-organization");',
    replace: "    /* mutated: a user account is treated as an organization */",
    /*
     * With the gate removed the personal installation is not merely accepted — it runs on to the
     * connection write and trips the suite's database guard. That message is the sharpest available
     * evidence: an installation this product refuses was about to be persisted.
     */
    expect: "THE DATABASE MUST NOT BE REACHED BY A REFUSED INSTALLATION",
  },
  {
    label: "M9 an all-repository installation is accepted",
    file: CONTRACTS,
    find: '  Object.freeze(["selected"]);',
    replace: '  Object.freeze(["selected", "all"]);',
    expect: "Expected values to be strictly deep-equal",
  },

  /* ── GRANTED, NEVER REQUESTED ────────────────────────────────────────────── */
  {
    label: "M10 coverage is measured against what Hebun asked for",
    file: ORCHESTRATOR,
    find: "  if (!coversRequiredPermissions(identity.grantedPermissions)) {",
    replace: "  if (false && !coversRequiredPermissions(identity.grantedPermissions)) {",
    /* Same shape as M8: the under-permissioned installation reaches persistence and trips it. */
    expect: "THE DATABASE MUST NOT BE REACHED BY A REFUSED INSTALLATION",
  },

  /* ── THE SOURCE-CONTENT FIREWALL ─────────────────────────────────────────── */
  {
    label: "M11 the transport grows an address for pull-request files",
    file: TRANSPORT,
    find: "doFetch(`${GITHUB_API_ORIGIN}/app/installations/${installationId}`",
    replace: "doFetch(`${GITHUB_API_ORIGIN}/repos/o/r/pulls/1/files`",
    /*
     * Keyed on the OBSERVED request URL rather than on the source scan, because the behavioural
     * assertion fires first and is the stronger of the two: it proves what was actually sent.
     */
    expect: "the transport requested a data address instead of the installation record",
  },

  /* ── THE SURFACE INVENTS NOTHING ─────────────────────────────────────────── */
  {
    label: "M12 the connection surface derives a pull-request figure",
    file: MODEL,
    find: "  readonly lastVerifiedAt: string | null;",
    replace: "  readonly lastVerifiedAt: string | null;\n  readonly pullRequestCount: number;",
    expect: "must not derive pullRequest",
  },
];

/**
 * Behaviour-preserving. The suite must ACCEPT it, or the assertions test the spelling of the
 * source rather than the rule it encodes. `10_000` and `10000` are the same number.
 */
const ACCEPTED = {
  label: "A1 the transport timeout is written without a separator — identical value",
  file: TRANSPORT,
  find: "const DEFAULT_TIMEOUT_MS = 10_000;",
  replace: "const DEFAULT_TIMEOUT_MS = 10000;",
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
    `github2-installation-authority/bite-proofs: ${bitten} mutations bit, 1 correct change accepted`,
  );
}

main();
