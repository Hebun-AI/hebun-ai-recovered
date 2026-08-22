/*
 * I1 CONNECTION AUTHORITY — BITE-PROOFS. Twelve mutations of the REAL source, each re-run in a
 * child process, plus one deliberately CORRECT change that must be accepted.
 *
 * ── WHY A CHILD PROCESS ──────────────────────────────────────────────────────
 *
 * The catalog is a module-level frozen constant and the repository's predicates are closed over at
 * import time. Rewriting a file inside this process would change nothing any already-imported
 * module can see, so an in-process "mutation" would prove only that the harness can lie to itself.
 * Every proof here writes the mutation to disk, re-runs the targeted suite with `node --import
 * tsx`, and requires that run to fail.
 *
 * ── WHAT COUNTS AS A PROOF ───────────────────────────────────────────────────
 *
 * Four conditions, all checked, because three of them have caught a false pass in this repository:
 *
 *   1. THE MUTATION APPLIED. The file on disk differs from the original — a mutation that silently
 *      failed to apply is indistinguishable from a guard that did not bite.
 *   2. THE RUN FAILED. Non-zero exit.
 *   3. IT FAILED FOR THE INTENDED REASON. The expected assertion text appears in the output. A
 *      mutation that trips an unrelated check has proved nothing about the guard it targets.
 *   4. THE FILE CAME BACK BYTE-IDENTICAL. Verified by sha256, not by "we wrote it back".
 *
 * ── AND ONE PROOF IN THE OTHER DIRECTION ─────────────────────────────────────
 *
 * A harness that only shows mutations biting has shown half of what matters. The final case makes
 * a behaviour-preserving change and requires the suite to PASS, which is what separates "these
 * assertions are strict" from "these assertions are brittle".
 *
 * Restoration runs in `finally`, so a failure never leaves mutated source on disk.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const TENANT_SUITE = "tests/i1-connection-authority/tenant-isolation-postgres.ts";
const SEAM_SUITE = "tests/i1-connection-authority/availability-seam.ts";
const FIREWALL_SUITE = "tests/i1-connection-authority/boundaries-and-firewall.ts";

const REPO = "src/features/integration-authority/integration-repository.server.ts";
const VERIFY = "src/features/integration-authority/verify-connection.server.ts";
const SEAM = "src/features/integration-authority/capability-availability.server.ts";
const CATALOG = "src/features/provider-catalog/catalog.ts";

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
  /* A timeout or spawn failure is a VOID proof, never a pass — say so instead of counting it. */
  assert.ok(!result.error, `the child run of ${suite} failed to execute: ${result.error?.message}`);
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

/** THE TEN GUARDS THIS PHASE RESTS ON, plus the two halves of the availability correction. */
const MUTATIONS: readonly Mutation[] = [
  {
    label: "M1 the tenant predicate is deleted",
    file: REPO,
    suite: TENANT_SUITE,
    find: "  return eq(integrations.tenantId, tenant.tenantId);",
    replace: "  return sql`true`;",
    expect: "A cannot READ B's connection",
  },
  {
    label: "M2 creation is allowed to produce `connected`",
    file: REPO,
    suite: TENANT_SUITE,
    find:
      '  const nextState: ConnectionState = "draft";\n' +
      '  if (!isI1Producible(nextState)) return refused("illegal-transition");',
    replace: '  const nextState: ConnectionState = "connected";',
    expect: "creation produces a DRAFT",
  },
  {
    label: "M3 a `fixture` definition is accepted as connectable",
    file: REPO,
    suite: TENANT_SUITE,
    find:
      '  if (definition.connectivity !== "connectable") return refused("provider-not-connectable");',
    replace: "  /* mutated: the connectivity gate removed */",
    expect: "a fixture definition is real and still not connectable",
  },
  {
    label: "M4 a terminal row is allowed to transition again",
    file: REPO,
    suite: TENANT_SUITE,
    find:
      "    if (isTerminalConnectionState(from) || !canTransition(from, nextState)) {\n" +
      '      return refused("illegal-transition");\n' +
      "    }",
    replace: "    /* mutated: the transition gate removed */",
    expect: "a terminal row never transitions again",
  },
  {
    label: "M5 verification claims success without a credential authority",
    file: VERIFY,
    suite: TENANT_SUITE,
    /*
     * AMENDED BY INT-2. The target is the FIRST refusal, not the last: this suite's connections
     * hold no credential, so execution returns here and never reaches the `no-provider-verifier`
     * branch. Mutating the unreachable one produced a mutation that applied, changed real source,
     * and bit nothing — a false pass in the making. INT-2's own bite-proofs cover the second
     * branch, in a suite that actually reaches it.
     */
    find: "  if (!credentialHeld) return { ok: false, reason: NO_CREDENTIAL_AUTHORITY };",
    replace:
      '  if (!credentialHeld) return { ok: true, externalAccountId: "mutated", externalAccountLabel: "mutated", grantedScopes: [] };',
    expect: "verification of one's OWN connection refuses with the missing authority",
  },
  {
    label: "M6 a real vendor is listed as connectable in the RELEASED catalog",
    file: CATALOG,
    suite: FIREWALL_SUITE,
    find: "export const PROVIDER_CATALOG: ProviderCatalog = Object.freeze([]);",
    replace:
      "export const PROVIDER_CATALOG: ProviderCatalog = Object.freeze([\n" +
      "  Object.freeze({\n" +
      '    providerKey: "google-workspace",\n' +
      '    label: "Google Workspace",\n' +
      '    authMethod: "oauth2",\n' +
      '    accountIdentity: "workspace",\n' +
      '    connectivity: "connectable",\n' +
      '    minimumScopes: Object.freeze(["mutated.read"]),\n' +
      "    capabilityScopes: Object.freeze({}),\n" +
      "  }) satisfies ConnectionDefinition,\n" +
      "]);",
    expect: "must contain ZERO connectable providers",
  },
  {
    label: "M7 the availability seam stops requiring `connected`",
    file: SEAM,
    suite: SEAM_SUITE,
    find: "  const isUsable = isConnected && isHealthUsable(connection.health);",
    replace: "  const isUsable = isHealthUsable(connection.health);",
    expect: "must still never be available",
  },
  {
    label: "M8 the seam enumerates fixtures alongside connectable definitions",
    file: SEAM,
    suite: SEAM_SUITE,
    find: "  const connectable = listConnectableProviders(catalog);",
    replace: "  const connectable = catalog;",
    expect: "contributes nothing",
  },
  {
    label: "M9 a CapabilitySource starts carrying authorization",
    file: SEAM,
    suite: SEAM_SUITE,
    find: "    readAvailable: isUsable && coversRead,",
    replace: "    writeAuthorized: true,\n    readAvailable: isUsable && coversRead,",
    expect: 'must not carry "writeAuthorized"',
  },
  {
    label: "M10 a connection is created without an audit record",
    file: REPO,
    suite: TENANT_SUITE,
    find: "      await recordIntegrationLifecycleEventWithin(\n        tx,\n        auditActor(tenant),",
    replace: "      if (false as boolean) await recordIntegrationLifecycleEventWithin(\n        tx,\n        auditActor(tenant),",
    expect: "exactly the two events I1 can honestly produce",
  },
  /* ── THE CORRECTION THIS REVIEW ADDED ─────────────────────────────────────── */
  {
    label: "M11 impaired health stops degrading availability (THE CORRECTED BUG)",
    file: SEAM,
    suite: SEAM_SUITE,
    find: "  const isUsable = isConnected && isHealthUsable(connection.health);",
    replace: "  const isUsable = isConnected;",
    expect: "availability is USABILITY",
  },
  {
    /*
     * The SECOND half of the correction, and a distinct guard: M11 removes the health term
     * altogether, this one keeps it and weakens it to "not observed to have failed" — the reading
     * that would let a connection with NO health observation be reported as available.
     */
    label: "M12 `unknown` health is treated as usable (THE CORRECTED BUG, SECOND HALF)",
    file: SEAM,
    suite: SEAM_SUITE,
    find: "  const isUsable = isConnected && isHealthUsable(connection.health);",
    replace: "  const isUsable = isConnected && !isImpairedHealth(connection.health);",
    expect: "there is no observation behind it",
  },
];

/** Behaviour-preserving. The suite must ACCEPT it, or these assertions are brittle, not strict. */
const ACCEPTED = {
  label: "A1 the usability helper is inlined — identical behaviour",
  file: SEAM,
  suite: SEAM_SUITE,
  find: "  const isUsable = isConnected && isHealthUsable(connection.health);",
  replace: '  const isUsable = isConnected && connection.health === "healthy";',
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
    /* CONDITION 1: it really is on disk. */
    assert.equal(sha(readFile(file)), sha(mutated), `the mutation did not reach ${file}`);
    body();
  } finally {
    writeFileSync(abs(file), original, "utf8");
  }
  /* CONDITION 4: byte-identical restoration, by hash. */
  assert.equal(sha(readFile(file)), before, `${file} was not restored byte-identically`);
}

async function main(): Promise<void> {
  for (const mutation of MUTATIONS) {
    withMutation(mutation.file, [mutation], () => {
      const run = runSuite(mutation.suite);
      /* CONDITION 2 */
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the suite still PASSED — the guard it targets does not bite`,
      );
      /* CONDITION 3 */
      assert.ok(
        run.output.includes(mutation.expect),
        `${mutation.label}: the suite failed, but not for the intended reason. Expected output ` +
          `containing "${mutation.expect}".\n--- actual ---\n${run.output.slice(-3000)}`,
      );
    });
    bitten += 1;
    console.log(`BITE ${mutation.label}`);
  }

  withMutation(
    ACCEPTED.file,
    [{ find: ACCEPTED.find, replace: ACCEPTED.replace }],
    () => {
      const run = runSuite(ACCEPTED.suite);
      assert.ok(
        run.ok,
        `${ACCEPTED.label}: a behaviour-preserving change was REJECTED — the suite is testing ` +
          `the spelling rather than the rule.\n--- actual ---\n${run.output.slice(-3000)}`,
      );
    },
  );
  console.log(`ACCEPT ${ACCEPTED.label}`);

  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(
    `i1-connection-authority/bite-proofs: ${bitten} mutations bit, 1 correct change accepted`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
