/*
 * AP-4A — BITE-PROOFS.
 *
 * Each guarantee is mutated in the SHIPPED SOURCE (or the shipped migration) and the defending suite
 * must fail for the INTENDED reason. Every find-string must be present exactly once, the mutation must
 * reach disk, and restoration is verified byte-identically in `finally`.
 *
 * The postgres suite needs a PG >= 17 instance (migration 74 uses `pg_c_utf8`): point
 * HEBUN_TEST_ADMIN_DATABASE_URL at it, exactly as for the suite itself.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const POSTGRES = "tests/ap4a-work-domain-foundation/foundation-postgres.ts";
const FIREWALL = "tests/ap4a-work-domain-foundation/firewall.ts";
const MIGRATION = "src/db/migrations/20261007175237_ap4a_work_domain_foundation.sql";
const WRITER = "src/features/work-domain/write-work-domain.server.ts";
const MANDATE = "src/features/agent-mandate/establish-agent-mandate.server.ts";
const LIVE_MANDATE_READER = "src/features/agent-mandate/read-agent-mandate.server.ts";
const CHILD_TIMEOUT_MS = 10 * 60 * 1000;

const abs = (f: string) => path.join(ROOT, f);
const readFile = (f: string) => readFileSync(abs(f), "utf8");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly find: string;
  readonly replace: string;
  readonly suite: string;
  readonly expect: string;
}

const SAFE_CHECK =
  `("work_items"."work_scope_kind" is null and "work_items"."work_domain_id" is null)\n` +
  `          or ("work_items"."work_scope_kind" is not null\n` +
  `              and (("work_items"."work_scope_kind" = 'organization' and "work_items"."work_domain_id" is null)\n` +
  `                or ("work_items"."work_scope_kind" = 'domain' and "work_items"."work_domain_id" is not null)))`;
const NULL_UNSAFE_CHECK =
  `("work_items"."work_scope_kind" is null and "work_items"."work_domain_id" is null)\n` +
  `          or ("work_items"."work_scope_kind" = 'organization' and "work_items"."work_domain_id" is null)\n` +
  `          or ("work_items"."work_scope_kind" = 'domain' and "work_items"."work_domain_id" is not null)`;

const MUTATIONS: readonly Mutation[] = [
  {
    label: "B1 slug uniqueness only while active (reuse allowed)",
    file: MIGRATION,
    find: `CREATE UNIQUE INDEX "work_domains_tenant_slug_uq" ON "work_domains" USING btree ("tenant_id","slug");`,
    replace: `CREATE UNIQUE INDEX "work_domains_tenant_slug_uq" ON "work_domains" USING btree ("tenant_id","slug") WHERE "work_domains"."lifecycle_status" = 'active';`,
    suite: POSTGRES,
    expect: "slugs are never reused",
  },
  {
    label: "B2 rename rewrites the slug",
    file: WRITER,
    find: "      .set({\n        name: input.name,\n",
    replace: "      .set({\n        name: input.name,\n        slug: `${current.slug}-renamed`,\n",
    suite: POSTGRES,
    expect: "the slug does not change",
  },
  {
    label: "B3 the writer's lookup is not tenant-scoped",
    file: WRITER,
    find: ".where(and(eq(workDomains.tenantId, gated.tenant.tenantId), eq(workDomains.id, workDomainId)))",
    replace: ".where(eq(workDomains.id, workDomainId))",
    suite: POSTGRES,
    expect: "another tenant's domain is unresolved",
  },
  {
    label: "B4 the Governance gate is removed",
    file: WRITER,
    find: '  if (!authorized) return { ok: false, result: refuse("not-authorized") };\n',
    replace: "",
    suite: POSTGRES,
    expect: "a member without Governance authority is refused",
  },
  {
    /* AP-4B: the five-value entry is gone; the bite is now "a revision drops its stated responsibility". */
    label: "B5 a revision is written without its stated responsibility",
    file: MANDATE,
    find: "return writeMandateRevision(tenant, input, responsibility, deps)",
    replace: "return writeMandateRevision(tenant, input, null, deps)",
    suite: FIREWALL,
    expect: "no revision is written without stated responsibility",
  },
  {
    label: "B6 the grant's domain lookup is not tenant-scoped",
    file: MANDATE,
    find: ".where(and(eq(workDomains.tenantId, authenticated.tenantId), inArray(workDomains.id, grantedDomainIds)));",
    replace: ".where(inArray(workDomains.id, grantedDomainIds));",
    suite: POSTGRES,
    expect: "another tenant's domain",
  },
  {
    label: "B7 a retired domain may be granted",
    file: MANDATE,
    find: "if (found.some((d) => d.lifecycleStatus !== ACTIVE_WORK_DOMAIN_STATUS)) {",
    replace: "if (false) {",
    suite: POSTGRES,
    expect: "retired domain is never granted",
  },
  {
    label: "B8 record-work without responsibility is admitted",
    file: MANDATE,
    find: '  if (scoped && responsibility.length === 0) return refused("responsibility-required");\n',
    replace: "",
    suite: POSTGRES,
    expect: "record-work needs a responsibility",
  },
  {
    label: "B9 the responsibility rows are not written",
    file: MANDATE,
    find: "if (responsibility !== null && responsibility.length > 0) {",
    replace: "if (false) {",
    suite: POSTGRES,
    expect: "two responsibility rows",
  },
  {
    label: "B10 the work scope CHECK is NULL-unsafe",
    file: MIGRATION,
    find: SAFE_CHECK,
    replace: NULL_UNSAFE_CHECK,
    suite: POSTGRES,
    expect: "a domain without a kind is refused",
  },
  {
    label: "B11 a live path reads the operator-only AP-4A responsibility reader",
    file: LIVE_MANDATE_READER,
    find: 'import { getControlPlaneDb',
    replace: 'import "@/features/agent-mandate/read-agent-mandate-responsibility.server";\nimport { getControlPlaneDb',
    suite: FIREWALL,
    expect: "the AP-4A responsibility reader stays operator-only",
  },
  {
    label: "B12 the Work Domain writer reaches departments",
    file: WRITER,
    find: 'import { workDomains } from "@/db/schema/work-domain";',
    replace: 'import { workDomains } from "@/db/schema/work-domain";\nimport "@/db/schema/department";',
    suite: FIREWALL,
    expect: "must not reach schema/department",
  },
  {
    label: "B13 a second insert of agent_mandates",
    file: MANDATE,
    find: "async function writeMandateRevision(",
    replace: "void ((db: ControlPlaneDatabase) => db.insert(agentMandates));\nasync function writeMandateRevision(",
    suite: FIREWALL,
    expect: "and one insert: the private core",
  },
];

function runSuite(suite: string) {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: CHILD_TIMEOUT_MS,
  });
  return {
    ok: result.status === 0,
    timedOut: result.error?.message.includes("ETIMEDOUT") ?? false,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
  };
}

function main(): void {
  for (const suite of [POSTGRES, FIREWALL]) {
    const clean = runSuite(suite);
    assert.ok(clean.ok, `${suite} must pass unmutated before any bite counts.\n${clean.output.slice(-2500)}`);
  }
  let bitten = 0;
  for (const m of MUTATIONS) {
    const original = readFile(m.file);
    const before = sha(original);
    assert.equal(original.split(m.find).length - 1, 1, `${m.label}: find-string must occur exactly once in ${m.file}`);
    const mutated = original.replace(m.find, m.replace);
    try {
      writeFileSync(abs(m.file), mutated, "utf8");
      assert.equal(sha(readFile(m.file)), sha(mutated), `${m.label}: did not reach disk`);
      const run = runSuite(m.suite);
      assert.equal(run.timedOut, false, `${m.label}: the defending suite TIMED OUT — void, not a bite`);
      assert.equal(run.ok, false, `${m.label}: SURVIVED — ${m.suite} still passed`);
      assert.ok(run.output.includes(m.expect), `${m.label}: failed, but not for the intended reason ("${m.expect}").\n${run.output.slice(-2500)}`);
    } finally {
      writeFileSync(abs(m.file), original, "utf8");
    }
    assert.equal(sha(readFile(m.file)), before, `${m.file} not restored byte-identically`);
    bitten += 1;
    console.log(`BITE ${m.label}`);
  }
  assert.equal(bitten, MUTATIONS.length);
  console.log(`ap4a-work-domain-foundation/bite-proofs: ${bitten} mutations bit`);
}

main();
