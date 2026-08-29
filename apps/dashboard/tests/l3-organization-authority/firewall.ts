/*
 * L3 — ORGANIZATION AUTHORITY. THE ARCHITECTURE, NOT THE HAPPY PATH.
 *
 * These assertions are the milestone. The read seam could be rewritten tomorrow and still be
 * correct; what must not change is that exactly one subsystem answers "what organization exists?",
 * that it cannot write, that it cannot authorize, and that nothing else quietly becomes a second
 * answer.
 *
 * No database, no network.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { performsDurableWrite } from "../helpers/durable-write-detector";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const AUTHORITY_DIR = "src/features/organization-authority";
const READER = `${AUTHORITY_DIR}/read-organization.server.ts`;
const CONTRACTS = `${AUTHORITY_DIR}/contracts.ts`;
const PAGE = "src/app/(dashboard)/director/organization/page.tsx";
const PANEL = "src/components/organization-domain/authoritative-organization.tsx";

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(p);
    return entry.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
  });
}

/** Source with comments and string literals removed — a comment must never satisfy or trip a ban. */
function codeOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

/* ── 1 · THE AUTHORITY HOLDS NO WRITER ─────────────────────────────────────── */
function theAuthorityCannotWrite(): void {
  for (const file of walk(AUTHORITY_DIR)) {
    const source = read(file);
    assert.ok(
      !performsDurableWrite(source),
      `${file}: the Organization Authority is read-only and must perform no durable write`,
    );
    const code = codeOf(source);
    for (const banned of ["transaction(", "delete(", "insert(", "update("]) {
      assert.ok(!code.includes(banned), `${file}: must not contain ${banned}`);
    }
  }
}

/* ── 2 · IT CANNOT AUTHORIZE, AND CANNOT REACH SOMETHING THAT DOES ─────────── */
function theAuthorityGrantsNothing(): void {
  const code = codeOf(read(READER)) + codeOf(read(CONTRACTS));

  /*
   * Import-level, not word-level: the contracts file DISCUSSES governance and permissions at length
   * and must be free to, because the SEC-2 gate answer belongs beside the code it constrains. What
   * is forbidden is reaching them.
   */
  const forbiddenImports = [
    "governance-decision",
    "action-authorization",
    "agent-origination",
    "membership-authority",
    "knowledge-write-authority",
    "tenant-role-baseline",
    "identity-enrollment",
    "schema/permission",
    "schema/role-permission",
    "schema/role",
    "schema/organization",
    "schema/department",
  ];
  for (const specifier of forbiddenImports) {
    assert.ok(
      !new RegExp(`from\\s+["'][^"']*${specifier}`).test(read(READER)),
      `the Organization Authority must not import ${specifier}`,
    );
  }

  /* The permission tables stay exactly as unactivated as L3 found them. */
  for (const symbol of ["rolePermissions", "permissions", "organizations", "departments"]) {
    assert.ok(!code.includes(symbol), `the Organization Authority must not reference ${symbol}`);
  }
}

/* ── 3 · THE TENANT IS UNREPRESENTABLE AS AN ARGUMENT ──────────────────────── */
function noCallerCanNameAnotherOrganization(): void {
  const source = read(READER);
  const start = source.indexOf("export async function readOrganizationAuthority");
  assert.ok(start > 0, "the read seam is exported");
  const signature = source.slice(start, source.indexOf("{", source.indexOf(")", start)));

  /* Exactly two parameters: the trusted context and injectable deps. Nothing else. */
  assert.match(signature, /tenant:\s*TenantContext\s*\|\s*null/, "the tenant is the trusted context");
  assert.match(signature, /deps:\s*OrganizationAuthorityDeps/, "the only other parameter is deps");
  for (const name of ["organizationId", "slug", "companyId", "where", "filter"]) {
    assert.ok(
      !new RegExp(`${name}\\s*[?:]`).test(signature),
      `the read seam must take no ${name} parameter`,
    );
  }

  /* Both reads are predicated on the tenant id, and it comes from the context alone. */
  const body = codeOf(source.slice(start));
  assert.equal(
    (body.match(/eq\(companies\.id,\s*tenantId\)/g) ?? []).length,
    1,
    "the company read is predicated on the session's tenant",
  );
  assert.equal(
    (body.match(/eq\(memberships\.tenantId,\s*tenantId\)/g) ?? []).length,
    1,
    "the member count is predicated on the same tenant",
  );
  assert.match(body, /tenant\?\.tenantId\?\.trim\(\)/, "the tenant id has exactly one source");
}

/* ── 4 · EXACTLY ONE SUBSYSTEM ANSWERS THE QUESTION ────────────────────────── */
function thereIsOnlyOneAnswer(): void {
  const callers = walk("src").filter(
    (file) => !file.startsWith(AUTHORITY_DIR) && read(file).includes("readOrganizationAuthority"),
  );
  assert.deepEqual(
    callers.sort(),
    [PAGE],
    "the Organization Authority has exactly one consumer, and it is a page that only renders it",
  );

  /*
   * NOBODY ELSE MAY BECOME THE ANSWER. Heby, Live Map and the provider adapters are named because
   * they are the three the pins forbid; the assertion is that none of them writes the tables L3
   * refuses to write either.
   */
  const forbiddenWriterRoots = [
    "src/features/heby-answer",
    "src/features/heby-runtime",
    "src/features/heby-commands",
    "src/features/provider-github",
    "src/features/provider-google",
  ];
  for (const root of forbiddenWriterRoots) {
    for (const file of walk(root)) {
      const code = codeOf(read(file));
      for (const table of ["companies", "organizations", "departments"]) {
        assert.ok(
          !new RegExp(`(insert|update|delete)\\(${table}\\)`).test(code),
          `${file}: must never write ${table}`,
        );
      }
    }
  }

  /* And Live Map still does not exist, so it cannot own anything. */
  const liveMapFiles = walk("src").filter((f) => /live-?map/i.test(f));
  assert.deepEqual(liveMapFiles, [], "Live Map has no module in src and owns no organizational truth");
}

/* ── 5 · THE UI RENDERS AND CANNOT MUTATE ──────────────────────────────────── */
function theSurfaceIsNotTheAuthority(): void {
  for (const file of [PAGE, PANEL]) {
    const source = read(file);
    assert.ok(!performsDurableWrite(source), `${file}: a surface may not write organizational state`);
    const code = codeOf(source);
    for (const name of ["use server", "getControlPlaneDb", "db/schema"]) {
      assert.ok(!code.includes(name), `${file}: must not contain ${name}`);
    }
  }

  /* The page resolves its own tenant server-side and passes no identifier to the seam. */
  const page = read(PAGE);
  assert.match(page, /readOrganizationAuthority\(await resolveTenantContext\(\)\)/, "tenant from the session only");

  /* L1's disclosure is untouched, and the authoritative panel is separated from the mock. */
  assert.ok(page.includes("Mock projection"), "L1's disclosure badge is preserved");
  /*
   * SCOPED TO THE RENDERED BODY, NOT THE MODULE. Measuring ordering with a module-wide `indexOf`
   * matches the import block first, which makes the claim about the import order rather than about
   * what a reader sees. This repository has been bitten by that exact substitution before.
   */
  const body = page.slice(page.indexOf("return ("));
  assert.ok(body.length > 0, "the page has a render body");

  /*
   * PRESENCE BEFORE ORDER. `indexOf` returns -1 for something that is not there, and -1 is less
   * than every real position — so an ordering check alone is SATISFIED by deleting the element it
   * is supposed to protect. The bite-proof found this by removing the panel and watching the
   * firewall stay green.
   */
  const authoritativeAt = body.indexOf("<AuthoritativeOrganizationPanel");
  const mockAt = body.indexOf("<OrganizationOverview");
  assert.ok(authoritativeAt >= 0, "the authoritative section is rendered at all");
  assert.ok(mockAt >= 0, "the mock projection is still rendered, disclosed, exactly as L1 left it");
  assert.ok(
    authoritativeAt < mockAt,
    "the authoritative section is rendered before the mock projection",
  );
}

/* ── 6 · UNAVAILABLE IS RENDERED AS A SENTENCE, NEVER AS AN EMPTY ORG ─────── */
function unavailableIsNeverAnEmptyOrganization(): void {
  const panel = read(PANEL);
  for (const reason of [
    "no-tenant",
    "persistence-not-configured",
    "organization-not-found",
    "read-failed",
  ]) {
    assert.ok(panel.includes(`"${reason}"`), `the panel states the ${reason} case`);
  }
  /* The unavailable branch renders no field grid — a zero count would read as an empty company. */
  const unavailableBranch = panel.slice(
    panel.indexOf('read.status === "unavailable"'),
    panel.indexOf(") : ("),
  );
  assert.ok(
    !unavailableBranch.includes("humanMemberCount") && !unavailableBranch.includes("<Field"),
    "an unavailable read renders no organization fields",
  );
}

function main(): void {
  theAuthorityCannotWrite();
  theAuthorityGrantsNothing();
  noCallerCanNameAnotherOrganization();
  thereIsOnlyOneAnswer();
  theSurfaceIsNotTheAuthority();
  unavailableIsNeverAnEmptyOrganization();
  console.log("l3 organization authority — firewall checks passed");
}

main();
