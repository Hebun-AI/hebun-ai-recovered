/*
 * P4 Platform Admin dashboard — boundaries proven from source. Behaviour is proven in
 * admin-readers-postgres.ts.
 *
 *   - every admin page runs the guard AND reads only through an audited admin reader;
 *   - every reader re-checks grant + MFA itself and reads no request value;
 *   - the readers are new modules: they import no released tenant-scoped reader and select no
 *     tenant content column;
 *   - the UI never claims health it did not check, never shows a cost, and never shows an
 *     unreadable value as zero.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const walk = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(name) ? [rel] : [];
  });
const codeOf = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

let failures = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}\n  ${(error as Error).message}`);
  }
}

const READERS = "src/features/admin-views/platform-readers.server.ts";
const PAGES = walk("src/app/admin/(protected)").filter((f) => f.endsWith("/page.tsx"));
const UI = [...PAGES, ...walk("src/components/admin-views"), "src/app/admin/(protected)/layout.tsx"];

test("every admin page runs the guard and reads through an audited reader", () => {
  assert.equal(PAGES.length, 5);
  for (const page of PAGES) {
    const code = codeOf(read(page));
    assert.match(code, /await requireAdminAccess\(\);/, page);
    assert.match(code, /settleAdminRead\(await (read|list)Platform\w+\(await adminReadContext\(\)/, page);
    assert.ok(!/@\/db\b|getControlPlaneDb|drizzle-orm/.test(code), `${page} queries nothing itself`);
  }
});

test("every exported reader re-checks access; audit precedes the returned data", () => {
  const code = codeOf(read(READERS));
  const readers = [...code.matchAll(/export (?:async )?function (\w+)\(\s*ctx: AdminReadContext/g)].map((m) => m[1]);
  assert.deepEqual(readers.sort(), [
    "listPlatformOrganizations",
    "readPlatformAiUsage",
    "readPlatformOrganizationMetrics",
    "readPlatformOverview",
    "readPlatformServiceStatus",
  ]);
  for (const name of readers) {
    const body = code.slice(code.indexOf(`function ${name}(`)).split(/\nexport /)[0]!;
    assert.match(body, /adminRead\(|evaluateAdminAccess\(/, `${name} checks access itself`);
  }
  const core = code.slice(code.indexOf("async function adminRead"), code.indexOf("const platformWide"));
  assert.ok(core.indexOf("evaluateAdminAccess(") < core.indexOf("await read("), "access before read");
  assert.ok(core.indexOf("writeAdminViewAudit(") < core.indexOf('status: "read"'), "audit before data");
  assert.match(core, /catch \{\s*return \{ status: "audit-failed" \};/, "a failed audit returns no data");
});

test("readers read no request value and select no tenant content", () => {
  const code = codeOf(read(READERS));
  for (const forbidden of ["next/headers", "cookies(", "headers(", "searchParams", "process.env"]) {
    assert.ok(!code.includes(forbidden), `readers must not use ${forbidden}`);
  }
  for (const column of ['"content"', "messages.content", '"subject"', "seal", "secret", "password", "credential", "token_hash"]) {
    assert.ok(!code.toLowerCase().includes(column.toLowerCase()), `readers must not touch ${column}`);
  }
  assert.ok(!/select \*|\.select\(\)/.test(code), "no select-all");
});

test("admin readers are new modules, not modes of released tenant-scoped readers", () => {
  const imports = [...codeOf(read(READERS)).matchAll(/^\} from "([^"]+)";$|^import [^\n]* from "([^"]+)";$/gm)].map((m) => m[1] ?? m[2]);
  assert.deepEqual(
    imports.filter((i) => !["drizzle-orm", "@/db/client.server", "@/db/schema", "@/features/auth/types/authentication-result"].includes(i!)).sort(),
    [
      "@/features/agent-identity/in-service",
      "@/features/governance-audit/operator-authority-audit.server",
      "@/features/heby-provider-ops/usage-contracts",
      "@/features/operator-authority/admin-access.server",
    ],
    "only pure rules, contracts, the access decision and the audit writer",
  );
  const released = read("src/features/heby-provider-ops/provider-usage-aggregation.server.ts");
  assert.match(released, /no unscoped read,[\s*]+no "all tenants" mode/, "the released pin stands");
  assert.ok(!walk("src").some((f) => f !== READERS && /platform-readers\.server/.test(read(f)) && !f.startsWith("src/app/admin/") && !f.startsWith("src/features/admin-views/")),
    "only the admin routes reach the admin readers");
});

test("the UI claims no unchecked health, no cost, and no zero for unreadable data", () => {
  for (const file of UI) {
    const code = codeOf(read(file));
    assert.ok(!/\bHealthy\b/.test(code), `${file} never says Healthy`);
    assert.ok(!/\bcosts?\b|\bprice|\bUSD\b|€|\$\d/i.test(code.replace(/Costs are not shown: no billing source exists\./, "")), `${file} shows no cost`);
  }
  for (const page of PAGES) {
    const code = codeOf(read(page));
    assert.match(code, /ADMIN_UNAVAILABLE/, `${page} has an unavailable state`);
    assert.match(code, /ADMIN_AUDIT_FAILED/, `${page} has an audit-failed state`);
  }
  assert.match(codeOf(read("src/app/admin/(protected)/page.tsx")), /label="Platform Health"\s+value="Not monitored"/);
});

if (failures > 0) {
  console.error(`\nP4 admin dashboard boundaries: ${failures} failure(s)`);
  process.exit(1);
}
console.log("\nP4 admin dashboard boundaries: all checks passed");
