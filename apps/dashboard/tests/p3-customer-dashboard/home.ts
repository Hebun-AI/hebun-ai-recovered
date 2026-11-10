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
import { CUSTOMER_NAV, resolveShellExperience } from "../../src/config/customer-nav";
import { landingRouteFor } from "../../src/features/auth-runtime/landing-route";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CustomerHome,
  QUICK_ACTIONS,
  UNAVAILABLE_MESSAGE,
  agentCount,
  waitingCount,
  workCount,
  workspaceStatus,
  type CustomerHomeProps,
} from "../../src/components/customer-home/customer-home";

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

test("workspace status: read counts only, unreadable ones named, never zero", () => {
  const unavailableOrg = { organization: { status: "unavailable", detail: "" }, agents: { status: "unavailable" }, intelligence: { status: "unavailable" }, freshness: "" } as const;
  const none = workspaceStatus({ waiting: { status: "unavailable", reason: "x" }, work: { status: "unavailable", detail: "x" }, organization: unavailableOrg });
  assert.deepEqual(none.stats, [], "nothing read: no stat card at all");
  assert.deepEqual(none.unavailable, ["Decisions waiting", "Work in progress", "AI agents"]);

  const partial = workspaceStatus({
    waiting: { status: "none-waiting" },
    work: { status: "unavailable", detail: "x" },
    organization: { ...unavailableOrg, agents: { status: "counted", count: 2 } },
  });
  assert.deepEqual(partial.stats.map((s) => [s.label, s.value]), [["Decisions waiting", "0"], ["AI agents", "2"]]);
  assert.deepEqual(partial.unavailable, ["Work in progress"], "the unread one is not turned into a number");

  const component = read(COMPONENT);
  assert.match(component, /Workspace information is unavailable in this session\./);
  assert.ok(!component.includes("Not readable"), "no per-card error chip");
});

test("Heby is one real link to /heby, not a fake input", () => {
  const component = read(COMPONENT);
  const heby = component.slice(component.indexOf('aria-labelledby="home-heby"'), component.indexOf("3. Workspace status"));
  assert.equal((heby.match(/href="\/heby"/g) ?? []).length, 1, "one doorway");
  assert.ok(!/<input|<textarea|contentEditable|placeholder|Ask Heby to plan, prepare or explain…/.test(heby), "nothing that looks typeable");
  assert.ok(existsSync(path.join(ROOT, "src/app/(dashboard)/heby/page.tsx")));
});

const NOW = "2026-11-10T12:00:00.000Z";
const render = (props: CustomerHomeProps) => renderToStaticMarkup(createElement(CustomerHome, props));
const UNREAD: CustomerHomeProps = {
  name: null,
  evaluatedAt: NOW,
  organization: { organization: { status: "unavailable", detail: "relation live_map does not exist" }, agents: { status: "unavailable" }, intelligence: { status: "unavailable" }, freshness: "" },
  waiting: { status: "unavailable", reason: "no-authorized-tenant-context" },
  work: { status: "unavailable", detail: "SQL error 42P01 on work_items" },
  activity: { sourceClass: "audit", state: "unavailable", authoritative: false, provenance: "", limits: "", generatedAt: null, acts: [], totalRecordedActs: null, truncated: false, unavailableReason: "connect ECONNREFUSED 127.0.0.1:5432" },
};

test("unreadable panels show one plain sentence, never the reader's reason", () => {
  const html = render(UNREAD);
  for (const internal of ["no-authorized-tenant-context", "42P01", "ECONNREFUSED", "relation live_map", "could not be read"]) {
    assert.ok(!html.includes(internal), `"${internal}" is not shown to the customer`);
  }
  assert.equal(html.split(UNAVAILABLE_MESSAGE).length - 1, 4, "each of the four panels says it once");
  assert.ok(html.includes("Workspace information is unavailable in this session."));
  assert.ok(!/>0</.test(html), "no zero stands in for an unread source");
});

test("real data still renders as before", () => {
  const html = render({
    ...UNREAD,
    name: "Ada",
    organization: { organization: { status: "named", name: "Acme" }, agents: { status: "counted", count: 3 }, intelligence: { status: "unavailable" }, freshness: "" },
    waiting: { status: "waiting", items: [{ requestId: "r1", actionKind: "instagram.publish", targetLabel: "Autumn post", expectedEffect: "Publishes", proposedAt: NOW, waitingFor: null }], boundReached: false, awaitingCount: 1, oldestWaiting: null },
    work: { status: "empty", detail: "none" },
  });
  for (const shown of ["Welcome back, Ada", "Acme", "instagram.publish", "Autumn post", "No work recorded yet", ">3<", ">1<"]) {
    assert.ok(html.includes(shown), `${shown} is rendered`);
  }
  assert.equal(html.split(UNAVAILABLE_MESSAGE).length - 1, 1, "only the still-unread activity panel says unavailable");
  assert.ok(html.includes(">0<"), "a read, known-empty work register is a real zero");
  assert.ok(!html.includes("unavailable in this session"), "every count was read, so no status notice");
});

test("every quick action points at a route that exists", () => {
  for (const action of QUICK_ACTIONS) {
    assert.ok(existsSync(path.join(ROOT, "src/app/(dashboard)", action.href, "page.tsx")), action.href);
  }
});

test("sign-in lands on the shell's home: customer → /home, Director → /command", () => {
  assert.equal(landingRouteFor("customer"), "/home");
  assert.equal(landingRouteFor("director"), "/command");
  for (const value of [undefined, "", "Customer", "admin", "director", "https://evil.example"]) {
    assert.equal(landingRouteFor(resolveShellExperience(value)), "/command", `${String(value)} keeps Director`);
  }
  assert.equal(landingRouteFor(resolveShellExperience("customer")), "/home");
  assert.match(read("src/features/auth-runtime/landing-route.ts"), /resolveShellExperience\(process\.env\.HEBUN_SHELL_EXPERIENCE\)/);
});

test("every sign-in seam uses the one landing route, and no redirect takes a request value", () => {
  const seams = ["src/app/login/page.tsx", "src/app/login/actions.ts", "src/app/login/select-workspace/page.tsx", "src/app/register/page.tsx", "src/app/register/actions.ts"];
  for (const file of seams) {
    const code = read(file);
    assert.ok(!code.includes('redirect("/command")'), `${file} holds no copy of the landing route`);
    /* Each target starts with the landing constant or a fixed internal path ("/x" or `/x?…`): never a request value, never another origin. */
    for (const m of code.matchAll(/redirect\(\s*([^\s,)]+)/g)) {
      assert.ok(/^(AUTHENTICATED_LANDING_ROUTE\b|"\/[a-z]|`\/[a-z])/.test(m[1]!), `${file}: redirect(${m[1]}…) starts with a fixed internal path`);
    }
  }
  assert.ok(read("src/app/login/actions.ts").includes("redirect(AUTHENTICATED_LANDING_ROUTE)"));
});

test("the client picker is handed the landing route; it never reads the setting itself", () => {
  const card = read("src/components/auth/workspace-selection-card.tsx");
  assert.ok(card.includes('"use client"'));
  assert.ok(!card.includes("landing-route") && !card.includes("process.env"), "no server setting in the browser");
  assert.match(card, /router\.replace\(landingRoute\)/);
  assert.match(read("src/app/login/select-workspace/page.tsx"), /landingRoute=\{AUTHENTICATED_LANDING_ROUTE\}/);
});

test("access control is unchanged: /home is protected and sign-in carries no return address", () => {
  const middleware = read("src/middleware.ts");
  const publicBlock = middleware.slice(middleware.indexOf("PUBLIC_PREFIXES"), middleware.indexOf("];", middleware.indexOf("PUBLIC_PREFIXES")));
  assert.ok(!publicBlock.includes('"/home"'), "/home is not public");
  assert.match(middleware, /url\.pathname = "\/login";\s*url\.search = "";/, "the redirect to /login drops every query");
  assert.match(read("src/app/(dashboard)/layout.tsx"), /redirect\("\/login"\)/, "the dashboard gate still refuses an unauthorized session");
});

if (failures > 0) {
  console.error(`\nP3 customer dashboard: ${failures} failure(s)`);
  process.exit(1);
}
console.log("\nP3 customer dashboard: all checks passed");
