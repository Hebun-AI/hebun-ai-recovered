/*
 * HEBY-CAP1 — BITE-PROOFS.
 *
 * Every guarantee this phase introduces is mutated in the SHIPPED SOURCE, and the suite defending it
 * must fail — for the INTENDED reason, not merely for some reason.
 *
 * Three conditions per mutation: the mutation changed the file, it reached disk, and the defending
 * suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically, so a failure never leaves mutated source behind.
 *
 * Each child is bounded. A hanging bite-proof is not a verdict, it is the absence of one, so a
 * child that exceeds its timeout is reported VOID rather than counted as bitten.
 *
 * No database, no network, no provider, no key, no model.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const TRUTH_SUITE = "tests/hebycap1-flow/capability-truth.ts";
const FIREWALL_SUITE = "tests/hebycap1-flow/capability-firewall.ts";
const INT5B1_FIREWALL = "tests/int5b1-flow/provider-read-firewall.ts";

const PROJECTION = "src/features/heby-commands/command-capability-projection.server.ts";
const DISPATCH = "src/features/heby-commands/dispatch.ts";
const PROVIDER_READ = "src/features/heby-commands/provider-read-commands.server.ts";

/** Generous, but finite. These suites open nothing, so they are fast. */
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
    /* THE ORIGINAL DEFECT, PUT BACK. Every tenant told the same thing from a release-time field. */
    label: "M1 static registry availability becomes runtime truth again",
    file: DISPATCH,
    suite: FIREWALL_SUITE,
    find: `  const entry = view?.entries.find((e) => e.commandId === command.id);`,
    replace:
      `  const entry = view?.entries.find((e) => e.commandId === command.id);\n` +
      `  if (command.availability === "available") return "";`,
    expect: "the /help renderer never reads the registry's release-time availability field to AFFIRM",
  },
  {
    /* PRESENCE IS NOT AUTHENTICATION. A stored key does not make a model usable. */
    label: "M2 credential existence is treated as capability",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `    if (ops.availability === "AVAILABLE") {`,
    replace: `    if (ops.availability === "AVAILABLE" || ops.credential === "present") {`,
    expect: "a present credential does not make the model usable",
  },
  {
    /* BEING CONNECTABLE IS A FACT ABOUT THE BUILD, NOT ABOUT THE TENANT. */
    label: "M3 provider catalog readiness becomes capability",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `    const entry = capability.capabilities.find((c) => c.capability === key);`,
    replace:
      `    if (capability.readiness === "catalog-ready") {\n` +
      `      return { ...base, state: "available", reason: "catalog ready", governedBy: "provider-capability" };\n` +
      `    }\n` +
      `    const entry = capability.capabilities.find((c) => c.capability === key);`,
    expect: "is unavailable when nothing is connected",
  },
  {
    /* ON SCREEN IS NOT PERMITTED. */
    label: "M4 UI presence becomes capability — the palette is consulted",
    file: PROJECTION,
    suite: FIREWALL_SUITE,
    find: `import { HEBY_COMMANDS } from "./registry";`,
    replace: `import { HEBY_COMMANDS, HEBY_PALETTE_COMMANDS } from "./registry";\nvoid HEBY_PALETTE_COMMANDS;`,
    expect: "capability is never derived from UI presence",
  },
  {
    /* THE FAIL-OPEN. An outage would become "you may run it". */
    label: "M5 an unanswered authority becomes AVAILABLE",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `    if (!capability) {\n      return {\n        ...base,\n        state: "unknown",\n        reason: UNKNOWN_REASONS.capabilityAuthority,`,
    replace: `    if (!capability) {\n      return {\n        ...base,\n        state: "available",\n        reason: UNKNOWN_REASONS.capabilityAuthority,`,
    expect: "a thrown capability authority produces UNKNOWN",
  },
  {
    /* THE OTHER HALF, AND THE SUBTLER ONE. "Could not find out" rendered as "you cannot". */
    label: "M6 an unanswered authority becomes an ordinary UNAVAILABLE",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `    if (!capability) {\n      return {\n        ...base,\n        state: "unknown",\n        reason: UNKNOWN_REASONS.capabilityAuthority,`,
    replace: `    if (!capability) {\n      return {\n        ...base,\n        state: "unavailable",\n        reason: UNKNOWN_REASONS.capabilityAuthority,`,
    expect: "a thrown capability authority produces UNKNOWN",
  },
  {
    /* NO AUTHORITY MAY ACTIVATE EXECUTION. */
    label: "M7 a reserved execution command becomes available",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `  if (command.kind === "reserved") {`,
    replace: `  if (command.kind === "reserved" && false) {`,
    expect: "stays reserved",
  },
  {
    /* ASKING WHETHER YOU MAY READ GITHUB MUST NEVER READ GITHUB. */
    label: "M8 resolving capability contacts a provider",
    file: PROJECTION,
    suite: FIREWALL_SUITE,
    find: `import { GITHUB_REPOSITORY_ACTIVITY_CAPABILITY } from "@/features/provider-github/contracts";`,
    replace:
      `import { GITHUB_REPOSITORY_ACTIVITY_CAPABILITY } from "@/features/provider-github/contracts";\n` +
      `import { githubTransport } from "@/features/provider-github/github-transport.server";\nvoid githubTransport;`,
    expect: "must not reach src/features/provider-github/github-transport.server.ts",
  },
  {
    /* ONE ORGANIZATION'S ANSWER MUST NEVER BE ANOTHER'S. */
    label: "M9 tenant scoping is removed from the capability read",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `      capability = await readCapability(tenant);`,
    replace: `      capability = await readCapability(null);`,
    expect: "each read carried its own tenant",
  },
  {
    /* A PROJECTION THAT WRITES IS NOT A PROJECTION. */
    label: "M10 the projection gains a database writer",
    file: PROJECTION,
    suite: FIREWALL_SUITE,
    find: `import { HEBY_COMMANDS } from "./registry";`,
    replace:
      `import { getControlPlaneDb } from "@/db/client.server";\n` +
      `import { auditLog } from "@/db/schema/audit-log";\n` +
      `export async function recordCapabilityRead(): Promise<void> {\n` +
      `  await getControlPlaneDb().insert(auditLog).values({});\n` +
      `}\n` +
      `import { HEBY_COMMANDS } from "./registry";`,
    expect: "performs a durable write",
  },
  {
    /* THE ROOTS INT-5B1 AND INT-5C SPLIT MUST NOT BE RE-JOINED TO MAKE THIS PHASE CONVENIENT. */
    label: "M11 the provider-read root is widened to reach Knowledge",
    file: PROVIDER_READ,
    suite: INT5B1_FIREWALL,
    find: `import { findHebyCommandById } from "./registry";`,
    replace:
      `import { attachExternalReference } from "@/features/knowledge/external-reference-authority.server";\n` +
      `void attachExternalReference;\n` +
      `import { findHebyCommandById } from "./registry";`,
    expect: "must not reach",
  },
  {
    /*
     * THE FOURTH-AUTHORITY MUTATION. The projection stops asking the I1 seam and starts deciding
     * for itself what `connected` means — which is how two answers to one question get born.
     */
    label: "M12 a second capability authority is born — the projection re-derives the rules",
    file: PROJECTION,
    suite: FIREWALL_SUITE,
    find: `    const resolved = fromCapabilityState(entry.state, entry.reason);`,
    replace:
      `    const anySource = entry.sources[0] as { connectionState?: string } | undefined;\n` +
      `    if (anySource?.connectionState === "connected") {\n` +
      `      return { ...base, state: "available", reason: "connected", governedBy: "provider-capability" };\n` +
      `    }\n` +
      `    const resolved = fromCapabilityState(entry.state, entry.reason);`,
    expect: "must not re-derive capability from",
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
  assert.equal(
    sha(readFile(mutation.file)),
    before,
    `${mutation.file} was not restored byte-identically`,
  );
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
  console.log(`hebycap1-flow/bite-proofs: ${bitten} mutations bit`);
}

main();
