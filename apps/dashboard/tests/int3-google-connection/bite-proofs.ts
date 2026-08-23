/*
 * INT-3 BITE-PROOFS — twelve mutations of the REAL source, plus one correct change that must be
 * accepted.
 *
 * This phase's guards protect a tenant from being connected to somebody else's Google account, and
 * from having a valid grant destroyed because Google had a bad minute. A test that stays green
 * after such a guard is deleted is not protecting anything.
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

const STATE_SUITE = "tests/int3-google-connection/oauth-state.ts";
const TRANSPORT_SUITE = "tests/int3-google-connection/google-transport.ts";
const PG_SUITE = "tests/int3-google-connection/connection-postgres.ts";
const FIREWALL_SUITE = "tests/int3-google-connection/boundaries-and-firewall.ts";

const STATE = "src/features/provider-google/oauth-state.server.ts";
const TRANSPORT = "src/features/provider-google/google-transport.server.ts";
const CONTRACTS = "src/features/provider-google/contracts.ts";
const CATALOG = "src/features/provider-catalog/catalog.ts";
const REPOSITORY = "src/features/integration-authority/integration-repository.server.ts";

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
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  /* ── THE STATE BOUNDARY ─────────────────────────────────────────────────── */
  {
    label: "M1 the state signature is no longer checked",
    file: STATE,
    suite: STATE_SUITE,
    find: '    return { ok: false, reason: "bad-signature" };',
    replace: "    /* mutated: a forged envelope is accepted */",
    expect: "must be refused as bad-signature",
  },
  {
    label: "M2 the state never expires",
    file: STATE,
    suite: STATE_SUITE,
    find: '    return { ok: false, reason: "expired" };',
    replace: "    /* mutated: an old state is accepted forever */",
    expect: '"expired" must be refused',
  },
  {
    label: "M3 a state minted in another session is accepted",
    file: STATE,
    suite: STATE_SUITE,
    find: '    return { ok: false, reason: "session-mismatch" };',
    replace: "    /* mutated: any session may finish any flow */",
    expect: '"another session" must be refused',
  },
  {
    label: "M4 the tenant binding is dropped",
    file: STATE,
    suite: STATE_SUITE,
    find: '  if (payload.tenantId !== input.tenantId) return { ok: false, reason: "tenant-mismatch" };',
    replace: "  /* mutated: a state minted for one tenant completes for another */",
    expect: "must not complete while acting as another",
  },
  {
    label: "M5 the nonce Google returned is not compared to the minted one",
    file: STATE,
    suite: STATE_SUITE,
    find: '    return { ok: false, reason: "nonce-mismatch" };',
    replace: "    /* mutated: any nonce matches any cookie */",
    expect: '"another flow\'s nonce" must be refused',
  },
  {
    label: "M6 PKCE degrades to `plain` — the verifier is sent as the challenge",
    file: STATE,
    suite: STATE_SUITE,
    find: "  return b64url(createHash(\"sha256\").update(verifier).digest());",
    replace: "  return verifier;",
    expect: "only its S256 challenge",
  },
  /* ── PROVIDER FAILURE CLASSIFICATION ────────────────────────────────────── */
  {
    label: "M7 a 5xx is treated as a credential failure",
    file: TRANSPORT,
    suite: TRANSPORT_SUITE,
    find: '  if (status >= 500) return fail("transport", "google-unavailable");',
    replace: '  if (status >= 500) return fail("auth", "google-unavailable");',
    expect: '"500" must classify as transport',
  },
  {
    label: "M8 a 429 is treated as a credential failure",
    file: TRANSPORT,
    suite: TRANSPORT_SUITE,
    find: '  if (status === 429) return fail("transport", "google-rate-limited");',
    replace: '  if (status === 429) return fail("auth", "google-rate-limited");',
    expect: '"429 rate limited" must classify as transport',
  },
  {
    label: "M9 an identity without `sub` is accepted",
    file: TRANSPORT,
    suite: TRANSPORT_SUITE,
    find: '  if (!subject) return fail("identity", "google-response-missing-subject");',
    replace: "  /* mutated: a connection may be bound to nothing */",
    expect: "identity",
  },
  /* ── WHAT `connected` COSTS ─────────────────────────────────────────────── */
  {
    label: "M10 a missing scope no longer blocks the connection",
    file: CONTRACTS,
    suite: FIREWALL_SUITE,
    find: "  return GOOGLE_REQUIRED_GRANTED_SCOPES.every((required) => granted.includes(required));",
    replace: "  return true;",
    expect: "the short form is NOT the grant",
  },
  {
    label: "M11 a connection silently rebinds to a different Google account",
    file: REPOSITORY,
    suite: PG_SUITE,
    find:
      "  if (\n" +
      "    current.externalAccountId !== null &&\n" +
      "    current.externalAccountId !== facts.externalAccountId\n" +
      "  ) {\n" +
      '    return { status: "refused", reason: "account-changed" } as const;\n' +
      "  }",
    replace: "  /* mutated: the account may change underneath a connection */",
    expect: "must never silently become another",
  },
  {
    label: "M12 a database row can add a provider (the catalog stops being the authority)",
    file: CATALOG,
    suite: PG_SUITE,
    find: "  return catalog.find((entry) => entry.providerKey === providerKey);",
    replace:
      "  return (\n" +
      "    catalog.find((entry) => entry.providerKey === providerKey) ??\n" +
      "    ({\n" +
      '      providerKey,\n' +
      '      label: providerKey,\n' +
      '      authMethod: "oauth2",\n' +
      '      accountIdentity: "account",\n' +
      '      connectivity: "connectable",\n' +
      "      minimumScopes: [],\n" +
      "      capabilityScopes: {},\n" +
      "    } as ConnectionDefinition)\n" +
      "  );",
    expect: "only Google exists",
  },
];

/** Behaviour-preserving. The suite must ACCEPT it, or the assertions are brittle, not strict. */
const ACCEPTED = {
  label: "A1 the transport's timeout constant is written inline — identical behaviour",
  file: TRANSPORT,
  suite: TRANSPORT_SUITE,
  find: "const DEFAULT_TIMEOUT_MS = 10_000;",
  replace: "const DEFAULT_TIMEOUT_MS = 10000;",
} as const;

let bitten = 0;

function withMutation(file: string, edits: readonly { find: string; replace: string }[], body: () => void): void {
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

async function main(): Promise<void> {
  for (const mutation of MUTATIONS) {
    withMutation(mutation.file, [mutation], () => {
      const run = runSuite(mutation.suite);
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
    const run = runSuite(ACCEPTED.suite);
    assert.ok(
      run.ok,
      `${ACCEPTED.label}: a behaviour-preserving change was REJECTED — the suite tests the ` +
        `spelling rather than the rule.\n--- actual ---\n${run.output.slice(-2000)}`,
    );
  });
  console.log(`ACCEPT ${ACCEPTED.label}`);

  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(`int3-google-connection/bite-proofs: ${bitten} mutations bit, 1 correct change accepted`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
