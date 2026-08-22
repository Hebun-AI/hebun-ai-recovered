/*
 * CMD-B2 — the canonical Command L2: three destinations, five surviving routes, one owner.
 *
 * ── WHAT THIS PHASE CHANGED, AND WHAT IT REFUSED TO CHANGE ───────────────────
 *
 * Phase 20B locked eight Command destinations. CMD-A measured what those eight could answer for a
 * real tenant; CMD-B1 rebuilt the Overview on the one connected read that exists. What remained was
 * a menu whose five other rows lead to surfaces with no source at all.
 *
 * CMD-B2 removes those five from the MENU and leaves the PRODUCT alone. No page is deleted, no
 * route is redirected, no model is retired, no authority moves. The distinction this suite exists to
 * make testable is:
 *
 *     A ROUTE EXISTING IS NOT THE SAME CLAIM AS A ROUTE BEING CANONICAL.
 *
 * ── HOW THIS SUITE ARGUES ────────────────────────────────────────────────────
 *
 * Three instruments, chosen per property:
 *
 *   - the CONFIG, for what the canonical menu is;
 *   - the FILESYSTEM, for what still exists and what was not redirected or deleted;
 *   - a real RENDER of `SecondaryNavContent`, for what an operator is actually shown — including
 *     which row is marked active, which is a claim about where they are and was measurably wrong
 *     for `/command/inbox` before this phase.
 *
 * The bite-proofs live in `bite-proofs.ts` beside this file: they mutate the real source, re-run
 * THIS file in a child process, and require it to fail for the intended reason. That indirection is
 * deliberate — a text mutation cannot be re-imported inside one process, so an in-process "mutation"
 * would prove nothing about the config the product actually loads.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  WORKSPACES,
  destinationsForRole,
  getWorkspace,
  resolveActiveWorkspace,
  resolveShellSurface,
} from "../../src/config/workspace-nav";
import { SecondaryNavContent } from "../../src/components/layout/secondary-nav";
import { CommandOverview } from "../../src/components/command-overview/command-overview";
import { getExpressIntentSummary } from "../../src/features/command-overview/workspace-model";
import { getHebyWorkspaceProfile } from "../../src/features/heby-integration/workspace-registry";

const ROOT = process.cwd();
const APP = "src/app/(dashboard)";
const NAV = "src/config/workspace-nav.ts";
const SECONDARY = "src/components/layout/secondary-nav.tsx";
const MOBILE = "src/components/layout/mobile-nav.tsx";
const TABLET = "src/components/layout/tablet-sections.tsx";

/** The canonical three, in order. */
const CANONICAL_LABELS = ["Overview", "Decisions", "Director Intent"] as const;
const CANONICAL_ROUTES = ["/command", "/approvals", "/command/intent"] as const;

/** The five that left the menu and kept their routes. */
const LEGACY = [
  { label: "Inbox", route: "/command/inbox" },
  { label: "Briefings", route: "/command/briefings" },
  { label: "Strategic Goals", route: "/director/goals" },
  { label: "Organization Health", route: "/director/organization-health" },
  { label: "Reports", route: "/director/reports" },
] as const;

/** Pinned so a deletion anywhere in the dashboard is a failure, not a silent shrink. */
const DASHBOARD_ROUTE_COUNT = 127;
/** CMD-B1's pins, restated so this phase cannot move them without saying so. */
const USE_SERVER_MODULES = 9;
const LEDGER_COUNT = 34;
const LEDGER_DIGEST = "3a6e41c7438eb88c";

const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const pageFor = (route: string): string => `${APP}${route}/page.tsx`;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

/** Every real `(dashboard)` route on disk, derived — never a hand-kept list. */
function dashboardRoutes(): string[] {
  const out: string[] = [];
  const rec = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith("[")) continue;
        rec(`${dir}/${entry.name}`, entry.name.startsWith("(") ? prefix : `${prefix}/${entry.name}`);
      } else if (entry.name === "page.tsx") out.push(prefix || "/");
    }
  };
  rec(APP, "");
  return out.sort();
}

const command = getWorkspace("command");

function renderNav(pathname: string): string {
  const workspace = getWorkspace(resolveActiveWorkspace(pathname));
  return renderToStaticMarkup(
    createElement(SecondaryNavContent, { workspace, role: "director" as const, pathname }),
  );
}
const visible = (markup: string): string =>
  markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/* ─────────────────────────────────────────────────────────────────────────────
 * 1–3 · THE CANONICAL THREE
 * ────────────────────────────────────────────────────────────────────────── */
function canonicalThree(): void {
  assert.deepEqual(
    command.destinations.map((d) => d.label),
    [...CANONICAL_LABELS],
    "Command canonical L2 is exactly Overview, Decisions, Director Intent — in that order",
  );
  assert.deepEqual(
    command.destinations.map((d) => d.href),
    [...CANONICAL_ROUTES],
    "and their routes are exactly /command, /approvals, /command/intent",
  );
  assert.equal(command.destinations.length, 3, "exactly three canonical destinations");

  /* 12 · Overview is first — the landing is where the menu starts. */
  assert.equal(command.destinations[0].label, "Overview", "Overview is first");
  assert.equal(command.destinations[0].href, command.href, "and it is the workspace landing route");

  /* 11 · Director Intent is present and still points at its own route. */
  assert.equal(
    command.destinations.find((d) => d.label === "Director Intent")?.href,
    "/command/intent",
    "Director Intent remains, unmoved",
  );

  /* 10 · Decisions keeps its elevated, governed treatment and its route. */
  const decisions = command.destinations.find((d) => d.label === "Decisions");
  assert.ok(decisions, "Decisions is a canonical destination");
  assert.equal(decisions!.href, "/approvals", "Decisions still navigates to /approvals — not a copy");
  assert.equal(decisions!.elevated, true, "Decisions keeps its elevated treatment");
  assert.deepEqual(decisions!.roles, ["director"], "and its director-only display scope");
  assert.ok(
    renderNav("/command").includes("Requires elevated authority"),
    "and the elevated hint is actually rendered",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4–7 · THE FIVE LEFT THE MENU, NOT THE PRODUCT
 * ────────────────────────────────────────────────────────────────────────── */
function legacyRoutesSurvive(): void {
  const labels = command.destinations.map((d) => d.label);
  const hrefs = command.destinations.map((d) => d.href);
  const shown = visible(renderNav("/command"));

  for (const { label, route } of LEGACY) {
    /* 4 · gone from the canonical menu, in the config AND in what a reader is shown. */
    assert.ok(!labels.includes(label), `${label} is not a canonical destination`);
    assert.ok(!hrefs.includes(route), `${route} is not a canonical route`);
    assert.ok(!shown.includes(label), `${label} does not appear in the rendered Command menu`);

    /* 5 · the route still exists on disk. */
    assert.ok(existsSync(path.join(ROOT, pageFor(route))), `${route} still exists (${pageFor(route)})`);

    /* 6 · and still builds as a route: a default export, and no redirect standing in for a page. */
    const src = read(pageFor(route));
    assert.ok(/export default/.test(codeOf(src)), `${route} still exports a page component`);
    assert.ok(
      !/\bredirect\s*\(/.test(codeOf(src)),
      `${route} was not turned into a redirect — removal from the menu is not retirement`,
    );

    /* 7 · resolving the route directly does not put it back in the menu. */
    assert.equal(resolveActiveWorkspace(route), "command", `${route} still belongs to Command`);
    assert.equal(
      getWorkspace(resolveActiveWorkspace(route)).destinations.length,
      3,
      `visiting ${route} does not reinsert it into the canonical L2`,
    );
    const navThere = visible(renderNav(route));
    assert.ok(!navThere.includes(label), `${label} does not reappear in the menu while you are on it`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 8–9, 13 · ONE OWNER, THREE VIEWPORTS
 * ────────────────────────────────────────────────────────────────────────── */
function oneNavigationAuthority(): void {
  /* 13 · exactly one module declares destination lists, and it declares exactly seven of them. */
  const declaring = walk("src").filter((f) => /destinations:\s*\[/.test(read(f)));
  assert.deepEqual(declaring, [NAV], "only workspace-nav declares navigation destinations");
  assert.equal(
    (read(NAV).match(/destinations:\s*\[/g) ?? []).length,
    WORKSPACES.length,
    "one destination list per workspace — no eighth list, no second Command list",
  );
  assert.equal(WORKSPACES.length, 7, "still exactly seven workspaces");

  /* 8 · the desktop column renders the shared content component over the shared filter. */
  const secondary = codeOf(read(SECONDARY));
  assert.ok(/destinationsForRole\(workspace, role\)/.test(secondary), "the L2 list comes from destinationsForRole");
  assert.ok(/export function SecondaryNavContent/.test(secondary), "SecondaryNavContent is the one renderer");
  assert.ok(/<SecondaryNavContent/.test(secondary), "and the desktop column uses it");

  /* 9 · tablet and mobile use the same renderer, and declare no list of their own. */
  for (const file of [MOBILE, TABLET]) {
    const src = codeOf(read(file));
    assert.ok(/SecondaryNavContent/.test(src), `${file} renders the shared Level-2 content`);
    assert.ok(!/destinations:\s*\[/.test(src), `${file} declares no navigation list of its own`);
    assert.ok(
      !/\{\s*label:\s*"(Overview|Decisions|Director Intent)"/.test(src),
      `${file} hard-codes no Command destination`,
    );
  }

  /* All three viewports show the same three rows, because they share the one authority. */
  const rows = visible(renderNav("/command"));
  for (const label of CANONICAL_LABELS) assert.ok(rows.includes(label), `${label} is rendered`);
  assert.equal(destinationsForRole(command, "director").length, 3, "director sees the canonical three");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 14–15 · SHELL IDENTITY STAYS TRUTHFUL
 * ────────────────────────────────────────────────────────────────────────── */
function shellIdentityHonest(): void {
  /* 14 · on /command the shell says Command, and the workspace is Command. */
  const here = resolveShellSurface("/command");
  assert.equal(here.kind, "workspace");
  assert.equal(here.workspace, "command");
  assert.equal(here.label, "Command", "the shell names Command on /command");

  /* 15 · on a legacy Command route the shell still says Command — the route did not change owner. */
  for (const { route } of LEGACY) {
    const surface = resolveShellSurface(route);
    assert.equal(surface.kind, "workspace", `${route} is still a workspace surface`);
    assert.equal(surface.workspace, "command", `${route} is still owned by Command`);
    assert.equal(surface.label, "Command", `${route} is still named Command`);
  }

  /*
   * AND NONE OF THE THREE PRETENDS TO BE THE PAGE YOU ARE ON.
   *
   * Measured before this phase, `/command/inbox` and `/command/briefings` marked **Overview**
   * active, because a legacy route is still a sub-path of `/command` and the longest-prefix rule had
   * lost the more specific row that used to outrank it. The landing now matches by equality, so a
   * non-canonical route highlights nothing — the honest answer, and the reason no removed row had to
   * be added back to manufacture a highlight.
   */
  const activeCount = (markup: string): number => (markup.match(/aria-current="page"/g) ?? []).length;
  for (const route of CANONICAL_ROUTES) {
    assert.equal(activeCount(renderNav(route)), 1, `${route} marks exactly one destination active`);
  }
  assert.equal(activeCount(renderNav("/approvals/anything")), 1, "a Decisions sub-route still highlights Decisions");
  for (const { route } of LEGACY) {
    assert.equal(activeCount(renderNav(route)), 0, `${route} marks no canonical destination active`);
  }
  /* No breadcrumb was invented to fill the gap. */
  assert.ok(!/aria-label="[Bb]readcrumb"/.test(renderNav("/command/inbox")), "no breadcrumb was added");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 16–18 · NOTHING ELSE MOVED
 * ────────────────────────────────────────────────────────────────────────── */
function navigationOnly(): void {
  /* 17 · no page was deleted anywhere in the dashboard. */
  const routes = dashboardRoutes();
  assert.equal(routes.length, DASHBOARD_ROUTE_COUNT, "no dashboard route was deleted or added");
  for (const { route } of LEGACY) assert.ok(routes.includes(route), `${route} is in the route census`);

  /* 16 · this phase introduced no redirect. The only redirecting pages are Phase 20D's, and the
   * five legacy Command routes are not among them (asserted per-route above as well). */
  const redirectors = walk(APP).filter((f) => /\bredirect\s*\(/.test(codeOf(read(f))));
  for (const { route } of LEGACY) {
    assert.ok(!redirectors.includes(pageFor(route)), `${route} is not a redirect`);
  }
  assert.ok(
    !/\bredirect\b/.test(codeOf(read(NAV))),
    "the navigation authority redirects nothing — it is a declaration, not a router",
  );

  /* 18 · no schema, no server action, no authority, no writer. */
  const migrations = readdirSync(path.join(ROOT, "src/db/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  assert.equal(migrations.length, LEDGER_COUNT, "no migration was added or removed");
  assert.equal(
    createHash("sha256").update(migrations.map((f) => read(`src/db/migrations/${f}`)).join("")).digest("hex").slice(0, 16),
    LEDGER_DIGEST,
    "and none was edited",
  );
  assert.equal(
    walk("src").filter((f) => read(f).includes('"use server"')).length,
    USE_SERVER_MODULES,
    "no server action was added",
  );

  /*
   * The two files this phase touches are a declaration and a presentation component. Neither may
   * acquire a read, a writer, a resolver or a session — navigation filtering is convenience, and
   * the server is still the only thing that decides anything.
   */
  /*
   * Asserted as an IMPORT CENSUS, not as a word ban. `workspace-nav.ts` honestly contains the word
   * "governance" — it declares the Governance workspace — and a guard that forbade the word would
   * fail on the file's own correct content. What may not appear is a CAPABILITY: a server module, a
   * database handle, a session, or an authority resolver.
   */
  for (const file of [NAV, SECONDARY]) {
    const src = codeOf(read(file));
    const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    for (const specifier of imports) {
      assert.ok(
        !/\.server$|\/db\/|drizzle|persistence|governance-decision|auth-runtime|action-authorization/.test(specifier),
        `${file} imports no capability module (${specifier})`,
      );
    }
    for (const forbidden of [/"use server"/, /resolveTenantContext/, /resolveSessionFrom/, /decision_records/]) {
      assert.ok(!forbidden.test(src), `${file} does not reach ${forbidden}`);
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 19–20 · CMD-B1 AND HEBY ARE WHERE THEY WERE
 * ────────────────────────────────────────────────────────────────────────── */
function cmdb1AndHebyUntouched(): void {
  /* 19 · the CMD-B1 Overview still renders exactly its three sections, unchanged. */
  const overview = renderToStaticMarkup(
    createElement(CommandOverview, {
      waiting: { status: "none-waiting" as const },
      intent: getExpressIntentSummary(),
    }),
  );
  const sectionIds = [...overview.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ["waiting", "intent", "not-connected"]) {
    assert.ok(sectionIds.includes(id), `CMD-B1 section "${id}" still renders`);
  }
  const shown = visible(overview);
  for (const title of ["Waiting on you", "Express intent", "Not yet connected"]) {
    assert.ok(shown.includes(title), `CMD-B1 section "${title}" is unchanged`);
  }
  assert.ok(
    shown.includes("Nothing is waiting for a human decision"),
    "successful-empty still reads as answered, not unavailable",
  );
  const commandPage = codeOf(read(`${APP}/command/page.tsx`));
  assert.equal(
    (commandPage.match(/resolveTenantContext\(/g) ?? []).length,
    1,
    "the Command route still resolves the tenant exactly once",
  );
  assert.ok(/readPendingActionRequests\(/.test(commandPage), "and still reuses the pending-authority seam");

  /* 20 · Heby stays ambient. It is not a workspace and not a Command destination. */
  assert.ok(
    !command.destinations.some((d) => /heby/i.test(d.label) || /heby/i.test(d.href ?? "")),
    "Heby is not a Command destination",
  );
  assert.ok(!WORKSPACES.some((w) => /heby/i.test(w.id)), "Heby is not a workspace");
  assert.equal(resolveShellSurface("/heby").kind, "ambient", "Heby is an ambient surface");
  assert.equal(resolveShellSurface("/heby").workspace, null, "and belongs to no workspace");
  assert.equal(
    getHebyWorkspaceProfile("command").authority,
    "advisory-only",
    "Heby is still advisory in Command",
  );
}

function main(): void {
  canonicalThree();
  legacyRoutesSurvive();
  oneNavigationAuthority();
  shellIdentityHonest();
  navigationOnly();
  cmdb1AndHebyUntouched();
  console.log("CMD-B2: Command's canonical L2 is three destinations and the five removed routes still resolve");
}

main();
