/*
 * E2-1 — BITE-PROOFS.
 *
 * Every guarantee this milestone introduces is mutated in the SHIPPED SOURCE, and the suite that
 * defends it must fail — for the INTENDED reason, not merely for some reason. A guard that cannot
 * be shown to bite is a comment with a test's syntax.
 *
 * Three conditions per mutation:
 *   1. the mutation CHANGED the file (a find-string that no longer matches proves nothing)
 *   2. the mutation REACHED disk (verified by digest before the suite runs)
 *   3. the defending suite failed, and its output names the intended reason
 *
 * Restoration runs in `finally` and is verified byte-identically, so a failure never leaves mutated
 * source on disk.
 *
 * ── EACH EXPECTATION NAMES THE GUARD THAT ACTUALLY SPOKE ─────────────────────
 *
 * Several of these attacks would be caught by more than one assertion, and the `expect` string
 * names the one that fires FIRST, measured rather than assumed. M6 was written expecting the
 * import-surface pin and is caught a line earlier by the handle-name ban; M1 reaches the pin
 * because a mock module trips no name ban on the way. Writing down the guard you hoped for instead
 * of the one that spoke is how a bite-proof stops describing the code.
 *
 * M8 is the one that deliberately goes AROUND the projection's own import surface, by widening the
 * AUTHORITY it reads instead — so the transitive reachability sweep is proved to bite on its own
 * rather than living behind a pin that would have caught the naive version anyway.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const TRUTH_SUITE = "tests/e21-organization-grounding/organization-grounding.ts";
const FIREWALL_SUITE = "tests/e21-organization-grounding/grounding-firewall.ts";

const PROJECTION = "src/features/organization-authority/heby-organization-source.server.ts";
const AUTHORITY_READER = "src/features/organization-authority/read-organization.server.ts";
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
    label: "M1 the organization projection imports a compiled-in organizational fixture",
    file: PROJECTION,
    suite: FIREWALL_SUITE,
    find: 'import { readOrganizationAuthority } from "./read-organization.server";',
    replace:
      'import { readOrganizationAuthority } from "./read-organization.server";\n' +
      'import { departments } from "@/features/agents/mock";\nvoid departments;',
    expect: "only VALUE import is the authority's read seam",
  },
  {
    label: "M2 structure is emitted as a fabricated arrangement instead of the authority's denial",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    /*
     * OSA-1 moved this clause behind `structureClause`, which carries whichever of the authority's
     * THREE states is true. The defect is unchanged — a fabricated arrangement replacing the
     * authority's own sentence — so the mutation is re-anchored on the call that now produces it.
     */
    find: "    structureClause(organization.structure),",
    replace: '    "departments: Sales, Engineering",',
    expect: "structure-unavailable sentence must travel verbatim",
  },
  {
    label: "M3 a caller may name another organization by slug",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    /*
     * THE PARAMETER IS APPENDED, NOT INSERTED, AND THAT IS THE POINT.
     *
     * The first version of this mutation inserted `organizationSlug` SECOND, which shifted `deps`
     * into it — so the injected seam vanished, the real authority ran with no database, and the
     * suite failed on "unavailable" three sections earlier. It bit, but for a mechanical reason
     * that had nothing to do with widening. Appending keeps every other behaviour identical, so the
     * only thing that changed is the one thing being tested.
     */
    find: "  deps: OrganizationGroundingDeps = {},\n): Promise<SourceResolution> {",
    replace:
      "  deps: OrganizationGroundingDeps = {},\n  organizationSlug?: string,\n): Promise<SourceResolution> {",
    expect: "cross-organization reads are unrepresentable",
  },
  {
    label: "M4 an unavailable organization is reported as a resolved one",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: '    state: "unavailable",\n    provenance: ORGANIZATION_GROUNDING_PROVENANCE,',
    replace: '    state: "resolved",\n    provenance: ORGANIZATION_GROUNDING_PROVENANCE,',
    expect: "UNAVAILABLE != EMPTY",
  },
  {
    label: "M5 the organization record is reported as derived rather than authoritative",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: '    sourceClass: "organization",\n    state: "resolved",\n    provenance: ORGANIZATION_GROUNDING_PROVENANCE,\n    authoritative: true,\n    items: [item],',
    replace:
      '    sourceClass: "organization",\n    state: "resolved",\n    provenance: ORGANIZATION_GROUNDING_PROVENANCE,\n    authoritative: false,\n    items: [item],',
    expect: "the organization is an authoritative record",
  },
  {
    label: "M6 the projection takes a database handle instead of reading through the authority",
    file: PROJECTION,
    suite: FIREWALL_SUITE,
    find: 'import { readOrganizationAuthority } from "./read-organization.server";',
    replace:
      'import { readOrganizationAuthority } from "./read-organization.server";\n' +
      'import { getControlPlaneDb } from "@/db/client.server";\nvoid getControlPlaneDb;',
    /*
     * The handle-name ban fires before the import-surface pin does — both would catch this, and the
     * expectation names the one that actually speaks rather than the one that would have been
     * tidier. A bite-proof that expects the second-place guard is a bite-proof that has not read
     * its own output.
     */
    expect: "must not contain getControlPlaneDb",
  },
  {
    label: "M7 Heby depends on the Live Map presentation projection",
    file: ANSWER,
    suite: FIREWALL_SUITE,
    find: 'import { readOrganizationGroundingSource } from "@/features/organization-authority/heby-organization-source.server";',
    replace:
      'import { readOrganizationGroundingSource } from "@/features/organization-authority/heby-organization-source.server";\n' +
      'import { readLiveMapProjection } from "@/features/live-map/read-live-map.server";\nvoid readLiveMapProjection;',
    expect: "Heby must not depend on Live Map",
  },
  {
    label: "M8 a durable writer enters the projection's closure through the authority it reads",
    file: AUTHORITY_READER,
    suite: FIREWALL_SUITE,
    find: 'import { and, count, eq } from "drizzle-orm";',
    replace:
      'import { and, count, eq } from "drizzle-orm";\n' +
      'import { createDurableAgentIdentity } from "@/features/agent-identity/create-durable-agent-identity.server";\n' +
      "void createDurableAgentIdentity;",
    expect: "must not reach the agent identity writer",
  },
  {
    /*
     * REPAIRED AT E2-4, NOT WEAKENED. This anchored on the line that bound `withOrganization`'s
     * result to `resolutions` — the last link in the chain. E2-4 appended `withOperations` after
     * it, so the variable was renamed and the find-string stopped matching; the harness reported
     * "the mutation would prove nothing" rather than passing, which is the behaviour that makes
     * another phase's proof recoverable instead of silently retired. Fourth recorded instance of a
     * find-string coupled to a BODY rather than to a signature.
     *
     * The mutation is the same one: unwire the organization resolver and keep the chain intact.
     */
    label: "M9 withOrganization is unwired from the answer flow",
    file: ANSWER,
    suite: TRUTH_SUITE,
    find: "  const organizationResolutions = await withOrganization(integrationResolutions, tenant, deps);",
    replace: "  const organizationResolutions = integrationResolutions;",
    expect: "withOrganization is not wired",
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
  console.log(`e21-organization-grounding/bite-proofs: ${bitten} mutations bit`);
}

main();
