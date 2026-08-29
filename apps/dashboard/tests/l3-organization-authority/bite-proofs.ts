/*
 * L3 — ORGANIZATION AUTHORITY — BITE-PROOFS.
 *
 * Every guarantee this milestone introduces is mutated in the SHIPPED SOURCE, and the suite
 * defending it must fail — for the INTENDED reason, not merely for some reason.
 *
 * Three conditions per mutation: the find-string is present (so the mutation APPLIES — one that
 * cannot be applied looks exactly like one that failed to bite), it reached disk, and the defending
 * suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically, so a failure never leaves mutated source behind.
 *
 * Each child is bounded. A hanging bite-proof is not a verdict, so a child that exceeds its timeout
 * is reported VOID rather than counted as bitten.
 *
 * The tenant-predicate mutations are defended by the POSTGRES suite on purpose: a fake handle
 * ignores the `where` clause entirely, so deleting a tenant predicate would not bite against it.
 * Only a real database can tell a scoped query from an unscoped one.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const TRUTH_SUITE = "tests/l3-organization-authority/authority-and-truth.ts";
const FIREWALL_SUITE = "tests/l3-organization-authority/firewall.ts";
const POSTGRES_SUITE = "tests/l3-organization-authority/tenant-isolation-postgres.ts";

const READER = "src/features/organization-authority/read-organization.server.ts";
const PAGE = "src/app/(dashboard)/director/organization/page.tsx";

/** Generous, but finite. The Postgres suite mints and migrates a database, so it is the slow one. */
const CHILD_TIMEOUT_MS = 10 * 60 * 1000;

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
    /* ONE ORGANIZATION'S ANSWER MUST NEVER BE ANOTHER'S. */
    label: "O1 the tenant predicate is removed from the organization read",
    file: READER,
    suite: POSTGRES_SUITE,
    find: `.where(and(eq(companies.id, tenantId), eq(companies.lifecycleStatus, "active")))`,
    replace: `.where(eq(companies.lifecycleStatus, "active"))`,
    expect: "Acme Operating Company",
  },
  {
    /*
     * THE SUBTLER LEAK. The right organization, the wrong census — a count is exactly the field a
     * reviewer trusts without re-deriving.
     */
    label: "O2 the tenant predicate is removed from the member count",
    file: READER,
    suite: POSTGRES_SUITE,
    find: `.where(and(eq(memberships.tenantId, tenantId), eq(memberships.lifecycleStatus, "active")))`,
    replace: `.where(eq(memberships.lifecycleStatus, "active"))`,
    /*
     * The FIRST assertion the leak trips is A's own count (3 -> 4), not B's. Expecting B's message
     * would be expecting the second failure, which a suite that stops at the first never reaches.
     */
    expect: "A counts its own three members",
  },
  {
    /* A SOFT-DELETED ORGANIZATION IS NOT A LIVE ONE. */
    label: "O3 the lifecycle predicate is dropped and an archived organization answers",
    file: READER,
    suite: POSTGRES_SUITE,
    find: `eq(companies.id, tenantId), eq(companies.lifecycleStatus, "active")`,
    replace: `eq(companies.id, tenantId)`,
    expect: "an archived organization is organization-not-found",
  },
  {
    /*
     * THE DEFECT THE MILESTONE IS NAMED AFTER. "Could not look" rendered as "looked and found
     * nothing" — an organization with no name and no members is a fabrication, not a read.
     */
    label: "O4 an unavailable read fabricates an empty organization",
    file: READER,
    suite: TRUTH_SUITE,
    find: `    if (!row) return { status: "unavailable", reason: "organization-not-found" };`,
    replace:
      `    if (!row) {\n` +
      `      return {\n` +
      `        status: "available",\n` +
      `        organization: {\n` +
      `          organizationId: tenantId, name: "", slug: "", lifecycleStatus: "active",\n` +
      `          tenantStatus: null, provenance: "unrecorded", humanMemberCount: 0,\n` +
      `          structure: ORGANIZATION_STRUCTURE_UNAVAILABLE,\n` +
      `        },\n` +
      `      };\n` +
      `    }`,
    expect: "the session names a tenant with no live row: must be unavailable",
  },
  {
    /* "COULD NOT LOOK" IS NOT "LOOKED AND FOUND NONE" — the other half of the same defect. */
    label: "O5 a failed read degrades to a zero member count",
    file: READER,
    suite: TRUTH_SUITE,
    find: `  } catch {\n    /* "Could not look" is never "looked and found none". */\n    return { status: "unavailable", reason: "read-failed" };`,
    replace: `  } catch {\n    return { status: "unavailable", reason: "organization-not-found" };`,
    expect: "the company read threw",
  },
  {
    /* THE TENANT MUST STAY UNREPRESENTABLE AS AN ARGUMENT. */
    label: "O6 the seam gains an organizationId parameter",
    file: READER,
    suite: FIREWALL_SUITE,
    find: `  tenant: TenantContext | null,\n  deps: OrganizationAuthorityDeps = {},`,
    replace: `  tenant: TenantContext | null,\n  organizationId?: string,\n  deps: OrganizationAuthorityDeps = {},`,
    expect: "the read seam must take no organizationId parameter",
  },
  {
    /*
     * THE SEC-2 GATE, MECHANIZED. Activating the permission tables from inside an organizational
     * read is precisely how a second answer to "may this actor act?" would be born.
     */
    label: "O7 the Organization Authority activates the permission tables",
    file: READER,
    suite: FIREWALL_SUITE,
    find: `import { memberships } from "@/db/schema/membership";`,
    replace:
      `import { memberships } from "@/db/schema/membership";\n` +
      `import { rolePermissions } from "@/db/schema/role-permission";\nvoid rolePermissions;`,
    expect: "must not import",
  },
  {
    /* AN ORGANIZATIONAL READ THAT WRITES IS NOT A READ. */
    label: "O8 the Organization Authority gains a writer",
    file: READER,
    suite: FIREWALL_SUITE,
    find: `export interface OrganizationAuthorityDeps {`,
    replace:
      `export async function touchOrganization(db: ControlPlaneDatabase, id: string): Promise<void> {\n` +
      `  await db.update(companies).set({ name: "renamed" }).where(eq(companies.id, id));\n` +
      `}\n` +
      `export interface OrganizationAuthorityDeps {`,
    expect: "read-only and must perform no durable write",
  },
  {
    /* THE SURFACE IS NOT THE AUTHORITY. */
    label: "O9 the organization page names its own tenant",
    file: PAGE,
    suite: FIREWALL_SUITE,
    find: `readOrganizationAuthority(await resolveTenantContext())`,
    replace: `readOrganizationAuthority(null)`,
    expect: "tenant from the session only",
  },
  {
    /* L1 IS NOT REOPENED, AND THE MOCK IS NEVER PROMOTED BY BEING PUT FIRST. */
    label: "O10 the authoritative section is deleted from the page",
    file: PAGE,
    suite: FIREWALL_SUITE,
    find: `        <AuthoritativeOrganizationPanel read={authoritative} />\n`,
    replace: ``,
    expect: "the authoritative section is rendered at all",
  },
  {
    /*
     * THE ORDERING CLAIM, PROVED ON ITS OWN. O10 removes the element, which is a PRESENCE failure;
     * only a mutation that keeps both and swaps them can show the ordering assertion still works.
     * Both mutations are needed because the first version of this firewall passed O10 — `indexOf`
     * returns -1 for an absent element, and -1 precedes everything.
     */
    label: "O11 the mock projection is rendered above the authoritative section",
    file: PAGE,
    suite: FIREWALL_SUITE,
    find: `        <AuthoritativeOrganizationPanel read={authoritative} />\n        <p className="text-xs leading-5 text-fg-secondary">`,
    replace: `        <OrganizationOverview items={organization.readiness} />\n        <AuthoritativeOrganizationPanel read={authoritative} />\n        <p className="text-xs leading-5 text-fg-secondary">`,
    expect: "the authoritative section is rendered before the mock projection",
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
  console.log(`l3-organization-authority/bite-proofs: ${bitten} mutations bit`);
}

main();
