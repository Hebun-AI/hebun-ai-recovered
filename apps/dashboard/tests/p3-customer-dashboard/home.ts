/*
 * P3 — Customer Dashboard (`/home`).
 *
 * Proves, from source:
 *   - Home in the customer navigation is the Customer Dashboard, and the Director's `/command` is
 *     untouched;
 *   - the route resolves the tenant itself, server-side, and reads only released, tenant-scoped
 *     read seams — no writer, no request-supplied identity, no client component;
 *   - an unreadable source is never shown as zero, and a known-empty one is;
 *   - every quick action points at a route that exists.
 * Layout, theme and responsive behaviour are verified in the browser.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { CUSTOMER_NAV } from "../../src/config/customer-nav";
import { QUICK_ACTIONS, agentCount, waitingCount, workCount } from "../../src/components/customer-home/customer-home";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const PAGE = "src/app/(dashboard)/home/page.tsx";
const COMPONENT = "src/components/customer-home/customer-home.tsx";

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

test("Home in the customer navigation is the Customer Dashboard", () => {
  const home = CUSTOMER_NAV.flatMap((g) => g.items).find((i) => i.label === "Home");
  assert.equal(home?.href, "/home");
  assert.ok(existsSync(path.join(ROOT, PAGE)));
  assert.match(read("src/app/(dashboard)/command/page.tsx"), /<CommandOverview/, "Director Command is unchanged");
});

test("the route reads only released, tenant-scoped seams, server-side", () => {
  const page = read(PAGE);
  assert.ok(!page.includes('"use client"'), "a server component");
  assert.match(page, /const tenant = await resolveTenantContext\(\);/, "tenant resolved by the route itself");
  assert.ok(!/searchParams|headers\(|cookies\(|params/.test(page), "no request-supplied identity");
  const imports = [...page.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(imports, [
    "@/components/customer-home/customer-home",
    "@/features/action-authorization/awaiting-decision-aggregate.server",
    "@/features/action-authorization/read-action-authorizations.server",
    "@/features/auth-runtime/human-label-read.server",
    "@/features/auth-runtime/request-session.server",
    "@/features/command-overview/workspace-model",
    "@/features/governance-activity/security-observation-source.server",
    "@/features/live-map/awareness",
    "@/features/live-map/read-live-map.server",
    "@/features/organizational-work/read-work.server",
  ]);
  assert.ok(!/\b(insert|update|delete|write|create|approve|reject|execute)[A-Z(]/.test(page), "no writer is called");
});

test("the component reads nothing and takes features as types only", () => {
  const component = read(COMPONENT);
  assert.ok(!component.includes('"use client"'));
  for (const m of component.matchAll(/^import (type )?[^;]*from "(@\/features\/[^"]+)"/gm)) {
    assert.equal(m[1], "type ", `${m[2]} is imported as a type`);
  }
  assert.ok(!component.includes(".server"), "no server reader");
});

test("an unreadable source is never shown as zero", () => {
  assert.equal(waitingCount({ status: "unavailable", reason: "x" }), null);
  assert.equal(waitingCount({ status: "none-waiting" }), "0");
  assert.equal(
    waitingCount({ status: "waiting", items: [], boundReached: true, awaitingCount: null, oldestWaiting: null }),
    "0+",
    "a capped read without a total is a lower bound",
  );
  assert.equal(workCount({ status: "unavailable", detail: "x" }), null);
  assert.equal(workCount({ status: "empty", detail: "x" }), "0");
  const org = (agents: Parameters<typeof agentCount>[0]["agents"]) =>
    ({ organization: { status: "unavailable", detail: "" }, agents, intelligence: { status: "unavailable" }, freshness: "" }) as const;
  assert.equal(agentCount(org({ status: "unavailable" })), null);
  assert.equal(agentCount(org({ status: "known-empty" })), "0");
  assert.equal(agentCount(org({ status: "counted", count: 3 })), "3");
});

test("every quick action points at a route that exists", () => {
  for (const action of QUICK_ACTIONS) {
    assert.ok(existsSync(path.join(ROOT, "src/app/(dashboard)", action.href, "page.tsx")), action.href);
  }
});

if (failures > 0) {
  console.error(`\nP3 customer dashboard: ${failures} failure(s)`);
  process.exit(1);
}
console.log("\nP3 customer dashboard: all checks passed");
