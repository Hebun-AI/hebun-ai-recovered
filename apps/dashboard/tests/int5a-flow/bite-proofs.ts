/*
 * INT-5A — BITE-PROOFS.
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
 * Restoration runs in `finally` and is verified byte-identically, so a failure never leaves
 * mutated source on disk.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const GROUNDING_SUITE = "tests/int5a-flow/connection-grounding.ts";
const FIREWALL_SUITE = "tests/int5a-flow/grounding-firewall.ts";

const SOURCE = "src/features/integration-authority/heby-integration-source.server.ts";
const VALIDATOR = "src/features/heby-runtime/response-validator.ts";
const ANSWER = "src/features/heby-answer/model-answer.server.ts";

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
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
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
    label: "M1 the tenant gate is removed from integration grounding",
    file: SOURCE,
    suite: GROUNDING_SUITE,
    find: '  if (!tenant?.tenantId) return unavailable(INTEGRATIONS_UNAVAILABLE.noTenant);',
    replace: "  /* mutated: an unauthenticated caller is grounded anyway */",
    expect: "noTenant",
  },
  /*
   * THE ROW-LEVEL TENANT PROOF IS NOT DUPLICATED HERE, DELIBERATELY.
   *
   * `tests/i1-connection-authority/bite-proofs.ts` M1 deletes the tenant predicate and runs
   * `tenant-isolation-postgres.ts` against a real database, which is the only place the row-level
   * property can actually be observed. INT-5A moved that predicate into
   * `integration-read.server.ts` and RETARGETED M1 onto it, so the released proof now defends the
   * exact line this phase's grounding depends on.
   *
   * A copy here would run the same mutation against the same suite and prove nothing further. What
   * this file owns instead is M1 above: the tenant gate at the GROUNDING boundary, which is the
   * one INT-5A introduced.
   */
  {
    label: "M3 a degraded capability is reported as settled",
    file: SOURCE,
    suite: GROUNDING_SUITE,
    find: '  if (state === "available") return "settled";',
    replace: '  if (state === "available" || state === "degraded") return "settled";',
    expect: "must map to lifecycle",
  },
  {
    label: "M4 an unavailable read is described as available",
    file: SOURCE,
    suite: GROUNDING_SUITE,
    find: '    parts.push(`read ${source.readAvailable ? "available" : "not available"}`);',
    replace: '    parts.push("read available");',
    expect: "never reads as available",
  },
  {
    label: "M5 a credential-shaped field is injected into a grounding item",
    file: SOURCE,
    suite: GROUNDING_SUITE,
    find: "      lifecycle: lifecycleFor(entry.state),",
    replace:
      "      lifecycle: lifecycleFor(entry.state),\n" +
      '      detail2: `access_token for ${source?.integrationId ?? ""}`,',
    expect: "access_token",
  },
  {
    label: "M6 integration grounding declares itself authoritative",
    file: SOURCE,
    suite: GROUNDING_SUITE,
    find: "    sourceClass: \"integrations\",\n    state: \"resolved\",\n    provenance: INTEGRATIONS_PROVENANCE,\n    authoritative: false,",
    replace: "    sourceClass: \"integrations\",\n    state: \"resolved\",\n    provenance: INTEGRATIONS_PROVENANCE,\n    authoritative: true,",
    expect: "never authoritative",
  },
  {
    label: "M7 a build with no connectable provider is grounded anyway",
    file: SOURCE,
    suite: GROUNDING_SUITE,
    find: '  if (view.readiness === "no-connectable-provider") {',
    replace: "  if (false) {",
    expect: "noConnectableProvider",
  },
  {
    label: "M8 the model may cite an integration identity the resolver never produced",
    file: VALIDATOR,
    suite: GROUNDING_SUITE,
    find: "    if (!isSupportedEvidence(reference, assembledEvidence)) {",
    replace: '    if (false && !isSupportedEvidence(reference, assembledEvidence)) {',
    expect: "model-introduced integration identity",
  },
  {
    label: "M9 the grounding path gains provider I/O",
    file: SOURCE,
    suite: FIREWALL_SUITE,
    find: 'import { getCapabilityAvailability } from "./capability-availability.server";',
    replace:
      'import { getCapabilityAvailability } from "./capability-availability.server";\n' +
      'import { readDriveMetadata } from "@/features/provider-google/read-drive-metadata.server";\n' +
      "export const __mutated = readDriveMetadata;",
    /*
     * The NETWORK assertion is what catches this, and it is the one that matters: the defect is not
     * "a named reader was imported" but "Heby's graph gained a second module that can reach the
     * wire". `readDriveMetadata` pulls in `google-transport.server.ts`, and the firewall names it.
     */
    expect: "may perform network I/O",
  },
  {
    label: "M10 the grounding path gains integration write reach",
    file: SOURCE,
    suite: FIREWALL_SUITE,
    find: 'import { getCapabilityAvailability } from "./capability-availability.server";',
    replace:
      'import { getCapabilityAvailability } from "./capability-availability.server";\n' +
      'import { disconnectConnection } from "./integration-repository.server";\n' +
      "export const __mutated = disconnectConnection;",
    expect: "integration lifecycle writer",
  },
  {
    /*
     * M11 IS DEFENDED BEHAVIOURALLY, NOT STRUCTURALLY, AND THAT IS THE POINT.
     *
     * This mutation was first pointed at the firewall and SURVIVED: deleting the call while leaving
     * the import in place keeps the module reachable, and an import-graph walk cannot tell the
     * difference. A firewall proves reachability; only running the flow proves invocation. The
     * grounding suite drives the real `answerHebyModelRequest` and reads the composed grounding
     * context, so a silently unwired seam fails there.
     */
    label: "M11 the answer flow stops substituting the real tenant-scoped read",
    file: ANSWER,
    suite: GROUNDING_SUITE,
    find: "  const resolutions = await withIntegrations(governanceResolutions, tenant, deps);",
    replace: "  const resolutions = governanceResolutions;",
    expect: "withIntegrations is not wired",
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
  console.log(`int5a-flow/bite-proofs: ${bitten} mutations bit`);
}

main();
