/*
 * P2 Design System, Phase 2B — Customer and Platform Admin navigation.
 *
 * Proves, from source:
 *   - the Customer and Platform Admin navigations are separate models, and both are separate from
 *     the Director workspace model;
 *   - every customer row points at a route that exists; areas without a runtime are not rendered;
 *   - the Platform Admin navigation is prepared but mounted nowhere and has no route (no operator
 *     principal exists, so there is no server-side proof to gate it on);
 *   - the shell experience comes from a server setting, defaults to Director, and the Director
 *     shell keeps its role and its unconditional rail;
 *   - the active-row resolver answers by longest prefix and can answer "none".
 * Responsive and keyboard behaviour is verified in the browser; the repository has no DOM runtime.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  CUSTOMER_HIDDEN_AREAS,
  CUSTOMER_NAV,
  PLATFORM_ADMIN_NAV,
  resolveActiveNavHref,
  resolveShellExperience,
} from "../../src/config/customer-nav";
import { WORKSPACES } from "../../src/config/workspace-nav";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

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

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const items = CUSTOMER_NAV.flatMap((g) => g.items);
const labels = items.map((i) => i.label);

test("customer navigation is grouped, not one long list", () => {
  assert.ok(CUSTOMER_NAV.length >= 4);
  for (const group of CUSTOMER_NAV) assert.ok(group.items.length > 0 && group.items.length <= 4, group.label);
  assert.equal(new Set(items.map((i) => i.href)).size, items.length, "no duplicate rows");
});

test("every customer row points at an existing dashboard route", () => {
  for (const item of items) {
    const page = path.join(ROOT, "src/app/(dashboard)", item.href, "page.tsx");
    assert.ok(existsSync(page), `${item.label} → ${item.href} has a page`);
  }
});

test("areas without a runtime are not rendered", () => {
  for (const area of CUSTOMER_HIDDEN_AREAS) assert.ok(!labels.includes(area), `${area} is hidden`);
});

test("customer, admin and director navigations are separate models", () => {
  const workspaceLabels = WORKSPACES.map((w) => w.label);
  assert.ok(labels.every((l) => !workspaceLabels.includes(l)), "no Director workspace is copied");
  const adminLabels = PLATFORM_ADMIN_NAV.map((a) => a.label);
  assert.deepEqual(adminLabels, [
    "Overview", "Customers", "Subscriptions", "AI Operations", "Costs", "Security", "Operations", "Settings",
  ]);
  assert.ok(PLATFORM_ADMIN_NAV.every((a) => !("href" in a)), "admin rows carry no route");
});

test("the admin navigation is mounted nowhere and has no route", () => {
  const src = walk(path.join(ROOT, "src")).filter((f) => /\.(ts|tsx)$/.test(f));
  const users = src.filter(
    (f) => !f.endsWith(path.join("config", "customer-nav.ts")) && readFileSync(f, "utf8").includes("PLATFORM_ADMIN_NAV"),
  );
  assert.deepEqual(users, [], "no component renders PLATFORM_ADMIN_NAV");
  const appDirs = walk(path.join(ROOT, "src/app")).map((f) => path.relative(ROOT, f));
  assert.ok(!appDirs.some((f) => /(^|\/)\(?admin\)?\//.test(f)), "no admin route or layout exists");
  assert.ok(!read("src/app/(dashboard)/layout.tsx").includes('experience="admin"'), "no admin theme scope is mounted");
});

test("the shell experience is a server setting that defaults to Director", () => {
  assert.equal(resolveShellExperience("customer"), "customer");
  for (const value of [undefined, "", "Customer", "admin", "director", " customer"]) {
    assert.equal(resolveShellExperience(value), "director", String(value));
  }
  const layout = read("src/app/(dashboard)/layout.tsx");
  assert.match(layout, /resolveShellExperience\(process\.env\.HEBUN_SHELL_EXPERIENCE\)/);
  assert.ok(!/searchParams|cookies\(|headers\(/.test(layout), "never from a client value");
});

test("the Director shell keeps its role and its unconditional rail", () => {
  const shell = read("src/components/layout/hebun-shell.tsx");
  assert.match(shell, /experience = "director"/);
  assert.match(shell, /<RoleProvider role="director" experience=\{experience\}>/);
  assert.match(shell, /<WorkspaceRail \/>/);
  const rail = read("src/components/layout/workspace-rail.tsx");
  assert.match(rail, /=== "customer" \? <ShellNavRail groups=\{CUSTOMER_NAV\} \/> : <DirectorRail \/>/);
  const mobile = read("src/components/layout/mobile-nav.tsx");
  assert.match(mobile, /=== "customer" \? <ShellNavSheet groups=\{CUSTOMER_NAV\} \/> : <DirectorMobileNav \/>/);
});

test("the shell navigation does not reach Heby or Live Map internals", () => {
  const nav = read("src/components/layout/shell-nav.tsx");
  assert.ok(!/from "\.\/heby|live-map/.test(nav));
});

test("active row: longest prefix, and none when nothing matches", () => {
  assert.equal(resolveActiveNavHref(CUSTOMER_NAV, "/command"), "/command");
  assert.equal(resolveActiveNavHref(CUSTOMER_NAV, "/command/intent"), "/command");
  assert.equal(resolveActiveNavHref(CUSTOMER_NAV, "/intelligence/social/instagram"), "/intelligence/social");
  assert.equal(resolveActiveNavHref(CUSTOMER_NAV, "/heby"), "/heby");
  assert.equal(resolveActiveNavHref(CUSTOMER_NAV, "/hebyx"), null);
  assert.equal(resolveActiveNavHref(CUSTOMER_NAV, "/intelligence"), null);
});

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nP2 Phase 2B navigation: all checks passed");
