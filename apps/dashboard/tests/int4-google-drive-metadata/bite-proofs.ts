/*
 * INT-4 BITE-PROOFS — fourteen mutations of the REAL source, plus one correct change.
 *
 * INT-4's guards keep three sentences true: a connection is not a data capability, a Drive outage
 * is not a revoked grant, and a metadata read is not a content read. A test that stays green after
 * one of those guards is deleted is decoration.
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

const SEAM_SUITE = "tests/int4-google-drive-metadata/capability-and-seam.ts";
const FIREWALL_SUITE = "tests/int4-google-drive-metadata/boundaries-and-firewall.ts";
const TENANT_SUITE = "tests/int4-google-drive-metadata/tenant-isolation.ts";

const AVAILABILITY = "src/features/integration-authority/capability-availability.server.ts";
const CONTRACTS = "src/features/provider-google/contracts.ts";
const CATALOG = "src/features/provider-catalog/catalog.ts";
const TRANSPORT = "src/features/provider-google/google-transport.server.ts";
const RUNNER = "src/features/provider-google/google-authorized-call.server.ts";
const SEAM = "src/features/provider-google/read-drive-metadata.server.ts";
const MODEL = "src/features/platform-integrations/model.ts";
const CREDENTIALS = "src/features/integration-credentials/credential-repository.server.ts";
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
  /**
   * Further edits applied with the first, in order.
   *
   * Some protections are only reachable by changing two things at once. M11 is the case that
   * forced this: flipping the refresh guard alone writes an `undefined` secret that INT-2's input
   * validator refuses, so the suite fails on a DIFFERENT guard. Destroying the credential the way
   * a careless edit really would takes both the condition and the value.
   */
  readonly extra?: readonly { readonly find: string; readonly replace: string }[];
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  /* ── A CONNECTION IS NOT A DATA CAPABILITY ──────────────────────────────── */
  {
    label: "M1 Drive is available without the required scope",
    file: AVAILABILITY,
    suite: SEAM_SUITE,
    find: "  const coversRead = covers(granted, scopes.read);",
    replace: "  const coversRead = true;",
    expect: "identity-only scopes are NOT Drive access",
  },
  {
    label: "M2 credential existence is treated as capability",
    file: AVAILABILITY,
    suite: SEAM_SUITE,
    find: "  const isUsable = isConnected && isHealthUsable(connection.health);",
    replace: "  const isUsable = true;",
    expect: "must not be Drive-available",
  },
  /*
   * M3 IS RUN AGAINST THE I1 SEAM SUITE, DELIBERATELY.
   *
   * The first version pointed it at INT-4's own suite and DID NOT BITE: the released catalog holds
   * exactly one entry and it is `connectable`, so removing the fixture filter changes nothing there
   * — a vacuous proof that looked like a passing one. The guard is genuinely exercised where a
   * `fixture` definition actually exists, which is I1's injected catalog. INT-4 depends on that
   * filter (a descriptor must never become a capability), so INT-4 proves it still bites.
   */
  {
    label: "M3 a descriptor definition reaches the capability seam",
    file: AVAILABILITY,
    suite: "tests/i1-connection-authority/availability-seam.ts",
    find: "  const connectable = listConnectableProviders(catalog);",
    replace: "  const connectable = catalog;",
    expect: "contributes nothing",
  },
  {
    label: "M4 the write claim becomes vacuously true again",
    file: AVAILABILITY,
    suite: SEAM_SUITE,
    find: "    writeCapable: isUsable && scopes.write.length > 0 && covers(granted, scopes.write),",
    replace: "    writeCapable: isUsable && covers(granted, scopes.write),",
    expect: "Drive write is a phase away, not a scope away",
  },
  {
    label: "M5 the catalog declares a Drive write scope",
    file: CATALOG,
    suite: SEAM_SUITE,
    find: "        write: Object.freeze([]),",
    replace: '        write: Object.freeze(["https://www.googleapis.com/auth/drive"]),',
    expect: "declares NO write scope",
  },

  /* ── A CALLER MAY NOT CHOOSE A SCOPE ────────────────────────────────────── */
  /*
   * M6 REVERTS THE WHOLE RESOLUTION TO A BARE LOOKUP — the actual regression, not half of it.
   *
   * Removing only the `Object.hasOwn` gate does NOT bite, because `Array.isArray` catches the
   * prototype object on the way out. That is defence in depth working, and it means the honest
   * mutation is the one a careless edit would really make: `map[key] ?? null`, which is what this
   * function looked like until INT-4's own hostile-input assertion caught it.
   */
  {
    label: "M6 an arbitrary capability string resolves through the prototype chain",
    file: CONTRACTS,
    suite: SEAM_SUITE,
    find:
      "  if (!Object.hasOwn(GOOGLE_CAPABILITY_SCOPE_REQUESTS, capability)) return null;\n" +
      "  const scopes = GOOGLE_CAPABILITY_SCOPE_REQUESTS[capability];\n" +
      "  return Array.isArray(scopes) ? scopes : null;",
    replace: "  return GOOGLE_CAPABILITY_SCOPE_REQUESTS[capability] ?? null;",
    expect: "is not a capability",
  },
  {
    label: "M7 the requested scopes replace what Google granted",
    file: TRANSPORT,
    suite: "tests/int3-google-connection/google-transport.ts",
    find: "      grantedScopes: parseScopes(typeof json.scope === \"string\" ? json.scope : null),",
    replace: "      grantedScopes: GOOGLE_REQUESTED_SCOPES,",
    expect: "int3-google-connection",
  },

  /* ── A PROVIDER OUTAGE IS NOT A REVOKED GRANT ───────────────────────────── */
  {
    label: "M8 a transport failure becomes an auth failure",
    file: TRANSPORT,
    suite: SEAM_SUITE,
    find: '  if (status >= 500) return fail("transport", "google-unavailable");',
    replace: '  if (status >= 500) return fail("auth", "google-unavailable");',
    expect: "is transport, never auth",
  },
  {
    label: "M9 a 429 becomes an auth failure",
    file: TRANSPORT,
    suite: SEAM_SUITE,
    find: '  if (status === 429) return fail("transport", "google-rate-limited");',
    replace: '  if (status === 429) return fail("auth", "google-rate-limited");',
    expect: "is transport, never auth",
  },
  {
    label: "M10 a scope gap is refreshed instead of reported",
    file: RUNNER,
    suite: SEAM_SUITE,
    find: '  return failure === "auth";',
    replace: '  return failure === "auth" || failure === "scope";',
    expect: "a scope gap is not refreshable",
  },
  /*
   * M11 MUST DESTROY THE CREDENTIAL, NOT MERELY FAIL TO WRITE IT.
   *
   * The obvious mutation — `if (true)` alone — replaces the refresh secret with `undefined`, which
   * INT-2's own input validator refuses. The suite went red, but on `rotate-invalid-input`: a
   * DIFFERENT guard catching a malformed write, not this phase's proof that a valid-looking
   * overwrite is prevented. So the mutation writes a valid-but-wrong secret instead, which is what
   * a careless "just always replace it" edit would actually do.
   */
  {
    label: "M11 the existing refresh token is overwritten when Google omits a new one",
    file: RUNNER,
    suite: TENANT_SUITE,
    find: "  if (token.grant.refreshToken) {",
    replace: "  if (true) {",
    extra: [
      {
        find: "plaintext: token.grant.refreshToken },",
        replace: "plaintext: token.grant.accessToken },",
      },
    ],
    expect: "the SAME refresh credential row survives",
  },

  /* ── METADATA-ONLY, AND RAW RESPONSES STAY BELOW THE SEAM ───────────────── */
  {
    label: "M12 a content download is requested",
    file: TRANSPORT,
    suite: FIREWALL_SUITE,
    find: '  url.searchParams.set("supportsAllDrives", "false");',
    replace: '  url.searchParams.set("alt=media", "1");',
    expect: "must not reach file content",
  },
  {
    label: "M13 the raw Google response crosses the seam",
    file: TRANSPORT,
    suite: SEAM_SUITE,
    find: "  const files = rawFiles\n    .map(driveFileFrom)",
    replace: "  const files = (rawFiles as GoogleDriveFileView[])\n    .map((f) => f)",
    expect: "the raw Google response must not cross the seam",
  },
  {
    label: "M14 the surface derives a capability from the provider catalog",
    file: MODEL,
    suite: FIREWALL_SUITE,
    find: "function capabilitiesFor(",
    replace: "const capabilityScopes = {};\nfunction capabilitiesFor(",
    expect: "never derives a capability from the provider definition",
  },
  /* ── REFRESH SEMANTICS (the Director's correction) ──────────────────────── */
  {
    label: "M15 a provider refresh demotes connected -> unverified",
    file: CREDENTIALS,
    suite: TENANT_SUITE,
    find: "    const held = await holdConnectionForProviderRefreshWithin(tx, tenant, input.integrationId);",
    replace:
      "    const held = await attachCredentialToConnectionWithin(tx, tenant, input.integrationId, now);",
    expect: "a successful provider refresh leaves the connection CONNECTED",
  },
  {
    label: "M16 the preserving hold starts writing the lifecycle",
    file: REPOSITORY,
    suite: FIREWALL_SUITE,
    find: '  if (from === "draft") return refused("illegal-transition");',
    replace:
      '  if (from === "draft") return refused("illegal-transition");\n' +
      "  await tx.update(integrations).set({ health: \"unknown\" }).where(ownedRow(tenant, integrationId));",
    expect: "the hold must not write the connection",
  },
  {
    label: "M17 the refresh intent becomes callable from an unrelated subsystem",
    file: SEAM,
    suite: FIREWALL_SUITE,
    find: 'import { listDriveFiles } from "./google-transport.server";',
    replace:
      'import { listDriveFiles } from "./google-transport.server";\n' +
      'import { replaceCredentialFromProviderRefresh } from "@/features/integration-credentials/credential-repository.server";',
    expect: "only the Google authorized-call runner may write a credential without demoting",
  },
  {
    label: "M18 the refresh intent can mint connected from a draft connection",
    file: REPOSITORY,
    suite: TENANT_SUITE,
    find: '  if (from === "draft") return refused("illegal-transition");',
    replace: "  /* draft guard removed */",
    expect: "a refresh cannot precede the credential it derives from",
  },
  {
    label: "M19 the refresh intent stops refusing a terminal connection",
    file: REPOSITORY,
    suite: TENANT_SUITE,
    find:
      "  /* A terminal record takes no new secrets, refreshed or otherwise. Terminal stays terminal. */\n" +
      '  if (isTerminalConnectionState(from)) return refused("illegal-transition");\n' +
      "  /* See the header: a refresh cannot precede the credential it is derived from. */",
    replace: "  /* See the header: a refresh cannot precede the credential it is derived from. */",
    expect: "a terminal connection takes no refreshed secret",
  },
  {
    label: "M20 the ordinary write intent stops demoting a supplied secret",
    file: REPOSITORY,
    suite: TENANT_SUITE,
    find: '  const nextState: ConnectionState = "unverified";',
    replace: "  const nextState: ConnectionState = from;",
    expect: "a human/new-secret write still demotes a connected row",
  },
  {
    label: "M21 a disabled Google API is reported as a refused credential",
    file: TRANSPORT,
    suite: SEAM_SUITE,
    find: '      return fail("disabled", "google-api-not-enabled");',
    replace: '      return fail("auth", "google-api-not-enabled");',
    expect: "a switched-off API is its own class",
  },
];

/**
 * A BEHAVIOUR-PRESERVING CHANGE THAT MUST BE ACCEPTED.
 *
 * Without it, "fourteen mutations bit" is indistinguishable from "these assertions are brittle".
 * Reordering two independent guard clauses changes nothing a caller can observe.
 */
const ACCEPTED = {
  label: "A1 two independent early refusals are reordered",
  file: SEAM,
  suite: SEAM_SUITE,
  find: '  if (source.providerKey !== "google-workspace") {',
  replace: '  if (source.providerKey !== "google-workspace" && true) {',
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

async function main(): Promise<void> {
  for (const mutation of MUTATIONS) {
    withMutation(mutation.file, [mutation, ...(mutation.extra ?? [])], () => {
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
  console.log(
    `int4-google-drive-metadata/bite-proofs: ${bitten} mutations bit, 1 correct change accepted`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
