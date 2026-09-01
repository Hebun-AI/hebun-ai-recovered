/*
 * HEBY-NAV-0 — an exact path is answered exactly, or not at all.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────
 *
 * `resolveNavigation` builds its directory from the CANONICAL navigation model. That is the right
 * source for DISCOVERY — what Heby may suggest when someone describes a place. It is not a register
 * of which routes exist, and the resolver used to treat it as one: a path it could not find fell
 * through into term matching, where `"/command/inbox"` contains `"command"` and was answered with
 * **`/command`**.
 *
 * Measured on the released resolver, three inputs took that path:
 *
 *     "/command/inbox"          -> /command      real, reachable, no longer canonical
 *     "/command/briefings"      -> /command      likewise
 *     "/command/does-not-exist" -> /command      never existed at all
 *
 * The third matters most: the defect was never about legacy routes. ANY path under a workspace
 * prefix was answered with the workspace. CMD-B2 widened the blast radius by two real routes; it did
 * not create the class, and this gate is therefore its own, not a CMD-B2 fixup.
 *
 * ── THE CONTRACT ─────────────────────────────────────────────────────────────
 *
 *   route-shaped input  ->  exact hit in the canonical directory, or NOT-FOUND. Never a neighbour.
 *   described input     ->  fuzzy discovery over the canonical directory, exactly as before.
 *
 * Refusal, not resolution, is the answer for a legacy route — because resolving one CORRECTLY would
 * need an authority for which routes exist and this repository has none. The only candidate,
 * `sidebar.config.ts`'s `staticRoutes`, is missing 34 real routes (`/command` among them) and lists
 * one that has no page. That measurement is re-run below rather than asserted from memory, so the
 * day a real route authority appears, this file says so out loud.
 *
 * ── HOW THIS SUITE ARGUES ────────────────────────────────────────────────────
 *
 * By OUTCOME. Almost every property here calls the real resolver and reads the route it returns.
 * Source-level assertions appear only where the property is about what the module may IMPORT or
 * DECLARE, which no outcome can show.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { resolveNavigation } from "../../src/features/heby-runtime/navigate-tool";
import { invokeTool, NAVIGATE_TOOL_ID } from "../../src/features/heby-runtime";
import { getWorkspace, resolveActiveWorkspace, WORKSPACES } from "../../src/config/workspace-nav";
import { getHebyWorkspaceProfile } from "../../src/features/heby-integration/workspace-registry";
import { staticRoutes } from "../../src/config/sidebar.config";

const ROOT = process.cwd();
const APP = "src/app/(dashboard)";
const TOOL = "src/features/heby-runtime/navigate-tool.ts";
const GATE = "src/features/heby-runtime/tool-gate.ts";
const NAV = "src/config/workspace-nav.ts";

const CANONICAL = ["/command", "/approvals", "/command/intent"] as const;
const LEGACY = [
  "/command/inbox",
  "/command/briefings",
  "/director/goals",
  "/director/organization-health",
  "/director/reports",
] as const;
const LEGACY_LABELS = ["inbox", "briefings", "strategic goals", "organization health", "reports"] as const;
/*
 * AMENDED BY AGENT-ID-0.1, AND STRICTER FOR IT. This was a COUNT of nine `"use server"` modules.
 * AGENT-ID-0.1 adds exactly one — the durable agent identity boundary — so nine became false.
 * Naming the set beats bumping the number: a count tolerates any swap that keeps the total (a
 * governance boundary deleted and another added would still read as nine), and this does not.
 *
 * What this file actually defends is untouched: the per-file assertion above still proves that no
 * Heby navigation module is itself a server action.
 */
const USE_SERVER_MODULES = [
  "src/app/(dashboard)/agents/actions.ts",
  "src/app/(dashboard)/approvals/actions.ts",
  /* OSA-1 — the Organization Structure Authority's product path. Declared, not silent. */
  "src/app/(dashboard)/director/organization/actions.ts",
  /* WORK-1 — the Organizational Work Authority's server actions. They hold no authority either. */
  "src/app/(dashboard)/director/work/actions.ts",
  "src/app/(dashboard)/foundation/actions.ts",
  "src/app/(dashboard)/governance/authority/actions.ts",
  "src/app/(dashboard)/governance/genesis/actions.ts",
  "src/app/(dashboard)/heby/actions.ts",
  "src/app/(dashboard)/knowledge/actions.ts",
  "src/app/(dashboard)/operations/actions.ts",
  "src/app/login/actions.ts",
  "src/app/login/onboarding-actions.ts",
];

const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** The route a query resolves to, or `null` for any negative outcome. */
function routeOf(query: string): string | null {
  const r = resolveNavigation(query);
  return r.found && r.target ? r.target.route : null;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

function dashboardRoutes(): Set<string> {
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
  return new Set(out);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1 · A CANONICAL PATH RESOLVES TO ITSELF
 * ────────────────────────────────────────────────────────────────────────── */
function canonicalExactResolvesExactly(): void {
  for (const route of CANONICAL) {
    assert.equal(routeOf(route), route, `${route} resolves to itself`);
  }
  /* And the label the caller is shown names the destination, not a neighbour. */
  const decisions = resolveNavigation("/approvals");
  assert.ok(decisions.found && decisions.target, "/approvals is found");
  assert.equal(decisions.target!.route, "/approvals");
  assert.deepEqual(
    Object.keys(decisions.target!).sort(),
    ["label", "route"],
    "a resolution carries a destination and nothing else — no authority, no permission, no state",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2–3 · A PATH IT CANNOT PLACE IS REFUSED, NEVER SUBSTITUTED
 * ────────────────────────────────────────────────────────────────────────── */
function unresolvablePathsRefuse(): void {
  /* 2 · a real, reachable, non-canonical route: refused — and above all, not something else. */
  for (const route of LEGACY) {
    const got = routeOf(route);
    assert.notEqual(got, "/command", `${route} is never answered with /command`);
    assert.ok(
      got === null || got === route,
      `${route} is either itself or nothing — never a different destination (got ${got})`,
    );
    const r = resolveNavigation(route);
    assert.equal(r.candidates.length, 0, `${route} offers no fuzzy alternatives either`);
  }

  /* 3 · a path that never existed: refused, and not turned into its workspace. */
  for (const unknown of ["/command/does-not-exist", "/approvals/nope/deeper", "/zzz/nope", "/director/nope"]) {
    assert.equal(routeOf(unknown), null, `${unknown} resolves to nothing`);
    assert.equal(resolveNavigation(unknown).candidates.length, 0, `${unknown} offers no candidates`);
  }

  /* The unslashed path form takes the same road — it reached the same wrong answer. */
  for (const q of ["command/inbox", "director/goals", "command/does-not-exist"]) {
    assert.equal(routeOf(q), null, `${q} is treated as a path, not as a phrase`);
  }

  /* Malformed input is refused rather than coerced. */
  for (const q of ["///", "../../etc/passwd", "/", "  /command/inbox  "]) {
    const got = routeOf(q);
    assert.notEqual(got, "/command", `${JSON.stringify(q)} is not answered with /command`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4–5 · DISCOVERY IS UNCHANGED, AND STAYS CANONICAL-ONLY
 * ────────────────────────────────────────────────────────────────────────── */
function discoveryUnchanged(): void {
  /* 4 · describing a canonical place still works. */
  assert.equal(routeOf("decisions"), "/approvals", "\"decisions\" still finds the Decisions surface");
  assert.equal(routeOf("director intent"), "/command/intent", "\"director intent\" still resolves");
  assert.equal(routeOf("command"), "/command", "\"command\" still resolves to the workspace");
  assert.equal(routeOf("governance"), "/governance", "other workspaces are unaffected");
  assert.equal(routeOf("security center"), "/director/governance/security", "deep canonical labels still resolve");
  /* A phrase with several real matches still offers real candidates rather than guessing. */
  const gov = resolveNavigation("gov");
  assert.ok(!gov.found && gov.candidates.length > 1, "an ambiguous phrase yields candidates, not a guess");

  /* 5 · a removed label does not regain discoverability because its route still exists. */
  for (const label of LEGACY_LABELS) {
    const r = resolveNavigation(label);
    assert.equal(r.found, false, `"${label}" is not discoverable from natural language`);
    for (const candidate of r.candidates) {
      assert.ok(
        !LEGACY.includes(candidate.route as (typeof LEGACY)[number]),
        `"${label}" does not surface ${candidate.route} as a candidate either`,
      );
    }
  }
  /* Nothing in the directory points at a legacy route, by any phrasing. */
  for (const route of LEGACY) {
    for (const q of ["overview", "command", "director", "reports", "health", "goals"]) {
      const r = resolveNavigation(q);
      const offered = [r.target?.route, ...r.candidates.map((c) => c.route)].filter(Boolean);
      assert.ok(!offered.includes(route), `"${q}" does not surface ${route}`);
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6–8, 16–17 · CMD-B2 IS NOT DISTURBED BY THIS REPAIR
 * ────────────────────────────────────────────────────────────────────────── */
function cmdb2Intact(): void {
  const command = getWorkspace("command");
  /* 6 · canonical Command L2 is still exactly three. */
  assert.deepEqual(
    command.destinations.map((d) => d.label),
    /* L4 added Live Map as a fourth canonical Command destination; the list stays exhaustive. */
    ["Overview", "Decisions", "Director Intent", "Live Map"],
    "Command canonical L2 is untouched by HEBY-NAV-0",
  );
  /* 7, 17 · and no legacy route was slipped back into the navigation model to make Heby work. */
  const hrefs = command.destinations.map((d) => d.href);
  for (const route of LEGACY) {
    assert.ok(!hrefs.includes(route), `${route} was not reinserted into WORKSPACES`);
  }
  assert.ok(
    !WORKSPACES.some((w) => w.destinations.some((d) => LEGACY.includes(d.href as (typeof LEGACY)[number]))),
    "no workspace adopted a removed Command route",
  );

  /* 8, 16 · the five route files are still there, and none became a redirect. */
  const routes = dashboardRoutes();
  for (const route of LEGACY) {
    const page = `${APP}${route}/page.tsx`;
    assert.ok(existsSync(path.join(ROOT, page)), `${route} still exists on disk`);
    assert.ok(routes.has(route), `${route} is in the route census`);
    assert.ok(!/\bredirect\s*\(/.test(codeOf(read(page))), `${route} is not a redirect`);
    assert.equal(resolveActiveWorkspace(route), "command", `${route} still belongs to Command`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 9, 11–12 · RESOLUTION IS NOT AUTHORIZATION
 * ────────────────────────────────────────────────────────────────────────── */
function resolutionGrantsNothing(): void {
  /* 9 · resolving the Decisions route says nothing about who may decide. */
  const decisions = invokeTool({ toolId: NAVIGATE_TOOL_ID, query: "/approvals" });
  const serialized = JSON.stringify(decisions);
  assert.ok(/\/approvals/.test(serialized), "the tool resolves the Decisions route");
  for (const forbidden of [/authoriz/i, /approved/i, /permission/i, /granted/i, /governance/i]) {
    assert.ok(!forbidden.test(serialized), `the resolution claims no ${forbidden}`);
  }

  /* A refusal reports Heby's own failure and does not assert what the product contains. */
  const refused = invokeTool({ toolId: NAVIGATE_TOOL_ID, query: "/command/inbox" });
  const message = JSON.stringify(refused);
  assert.ok(!/\/command"/.test(message), "a refusal does not name a substitute route");
  assert.ok(
    !/no real route/i.test(message),
    "a refusal does not claim the route is unreal — Heby does not know which routes exist",
  );

  /* 11–12 · the resolver reaches no capability, and Heby stays advisory in Command. */
  for (const file of [TOOL, GATE]) {
    const src = codeOf(read(file));
    for (const specifier of [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1])) {
      assert.ok(
        !/node:fs|\.next|drizzle|\/db\/|persistence|action-authorization|governance-decision|auth-runtime/.test(specifier),
        `${file} imports no capability or build artifact (${specifier})`,
      );
    }
    assert.ok(!/"use server"/.test(src), `${file} is not a server action`);
  }
  assert.deepEqual(
    walk("src").filter((f) => read(f).includes('"use server"')).sort(),
    USE_SERVER_MODULES,
    "the server-action boundaries are exactly these — AGENT-ID-0.1 added the agents one, OSA-1 " +
      "added the organization one, and nothing else moved",
  );
  assert.equal(getHebyWorkspaceProfile("command").authority, "advisory-only", "Heby stays advisory in Command");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 10 · NO SECOND ROUTE AUTHORITY WAS CREATED
 * ────────────────────────────────────────────────────────────────────────── */
function noSecondRouteAuthority(): void {
  const src = codeOf(read(TOOL));

  /* The directory is derived from the navigation model and from nothing else. */
  assert.ok(/for \(const workspace of WORKSPACES\)/.test(src), "the directory is built from WORKSPACES");
  const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(imports, ["@/config/workspace-nav"], "the resolver imports exactly one source of routes");

  /*
   * And it declares no route list of its own. A hard-coded path anywhere in this module would be a
   * second register of what exists — the thing this gate refused to build.
   */
  /* A bare `"/"` is the separator test in `isRouteShaped`, not a route; a named path is the thing
   * that would make this module a register. */
  const literals = [...src.matchAll(/"(\/[a-z0-9][a-z0-9/-]*)"/g)].map((m) => m[1]);
  assert.deepEqual(literals, [], `the resolver hard-codes no route (${literals.join(", ")})`);

  /*
   * WHY REFUSAL AND NOT CORRECT RESOLUTION — re-measured, never remembered.
   *
   * The only route-ish register in the repository is `staticRoutes`, and it cannot answer "does this
   * route exist": it omits real routes and lists at least one that has no page. If this assertion
   * ever fails because the gap closed, that is the signal that exact legacy resolution became
   * buildable — and this comment is where the next phase should start.
   */
  const real = dashboardRoutes();
  const missing = [...real].filter((r) => !staticRoutes.has(r));
  const phantom = [...staticRoutes].filter((r) => !real.has(r));
  assert.ok(
    missing.length > 0 && phantom.length > 0,
    `staticRoutes is still not a route authority (missing ${missing.length}, phantom ${phantom.length})`,
  );
  assert.ok(missing.includes("/command"), "it does not even contain the Command landing");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 13–15, 18–20 · ORDERING, NEGATIVE OUTCOMES, AND THE SURFACES AROUND IT
 * ────────────────────────────────────────────────────────────────────────── */
function orderingAndNegatives(): void {
  /*
   * 19–20 · exact matching runs BEFORE fuzzy, and a failed route-shaped lookup cannot be rescued by
   * it. Proved by outcome: `/command` is a path that the fuzzy matcher would also match (its term is
   * "command"), while `/command/inbox` is a path the fuzzy matcher matches too — the first resolves,
   * the second refuses. Only exact-then-stop produces that pair.
   */
  assert.equal(routeOf("/command"), "/command", "an exact path is taken exactly");
  assert.equal(routeOf("/command/inbox"), null, "and a path the exact lookup missed is not fuzzed");
  assert.equal(routeOf("command"), "/command", "the same word without a separator is still discoverable");

  /* 18 · every negative outcome is explicit: not found, no target, no candidates. */
  for (const q of ["/command/inbox", "/command/does-not-exist", "zzq-not-a-place", "   "]) {
    const r = resolveNavigation(q);
    assert.equal(r.found, false, `${JSON.stringify(q)} reports found=false`);
    assert.equal(r.target, undefined, `${JSON.stringify(q)} carries no target`);
    assert.ok(Array.isArray(r.candidates), `${JSON.stringify(q)} carries a candidate array`);
  }

  /* 13 · the CMD-B1 Command route is untouched by this gate. */
  const commandPage = codeOf(read(`${APP}/command/page.tsx`));
  assert.equal(
    (commandPage.match(/resolveTenantContext\(/g) ?? []).length,
    1,
    "the Command route still resolves the tenant exactly once",
  );
  assert.ok(/readPendingActionRequests\(/.test(commandPage), "and still reuses the pending-authority seam");

  /* 14 · CMD-B2's secondary-nav behaviour is untouched: the landing still matches by equality. */
  const secondary = codeOf(read("src/components/layout/secondary-nav.tsx"));
  assert.ok(
    /href === landingHref \? pathname === href/.test(secondary),
    "the workspace landing still matches exactly, not by prefix",
  );

  /* 15 · and the navigation authority itself was not edited by this gate. */
  assert.ok(!/\bredirect\b/.test(codeOf(read(NAV))), "the navigation authority redirects nothing");
}

/*
 * `cmdb2Intact` runs SECOND, ahead of the outcome checks, on purpose: the canonical model is the
 * precondition for every resolution below it. If the menu changed, the outcomes are being measured
 * against a different product, and reporting a resolution failure would name the symptom instead of
 * the cause.
 */
function main(): void {
  canonicalExactResolvesExactly();
  cmdb2Intact();
  unresolvablePathsRefuse();
  discoveryUnchanged();
  resolutionGrantsNothing();
  noSecondRouteAuthority();
  orderingAndNegatives();
  console.log("HEBY-NAV-0: an exact path resolves exactly or refuses — it is never answered with a different route");
}

main();
