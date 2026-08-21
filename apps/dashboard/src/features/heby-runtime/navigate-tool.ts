/*
 * heby-runtime/navigate-tool.ts — the first SAFE Heby tool: in-app navigation RESOLUTION
 * (UI Phase 16).
 *
 * This is a READ_ONLY tool. It resolves a target phrase to a REAL, existing product route
 * from the navigation model — it never invents a route, and it never auto-navigates. The
 * runtime returns the resolved target; the human follows it by clicking. Navigation stays
 * within product routing; no external browser navigation. If nothing real matches, it
 * returns not-found rather than fabricating a successful navigation.
 */

import { WORKSPACES } from "@/config/workspace-nav";

export interface NavigationTarget {
  readonly route: string;
  readonly label: string;
}

interface NavEntry extends NavigationTarget {
  /** Lowercased terms that resolve to this route. */
  readonly terms: readonly string[];
}

/** Build the directory of REAL navigable targets from the navigation model. Pure. */
function buildDirectory(): readonly NavEntry[] {
  const entries: NavEntry[] = [];
  for (const workspace of WORKSPACES) {
    entries.push({
      route: workspace.href,
      label: workspace.label,
      terms: [workspace.label.toLowerCase(), workspace.id],
    });
    for (const destination of workspace.destinations) {
      // Only destinations with a real route (not `unavailable`) are navigable.
      if (!destination.href || destination.unavailable) continue;
      entries.push({
        route: destination.href,
        label: `${workspace.label} · ${destination.label}`,
        terms: [destination.label.toLowerCase(), `${workspace.label.toLowerCase()} ${destination.label.toLowerCase()}`],
      });
    }
  }
  return entries;
}

const DIRECTORY = buildDirectory();

export interface NavigationResolution {
  readonly found: boolean;
  readonly target?: NavigationTarget;
  /** Alternative real routes when there is no single confident match. */
  readonly candidates: readonly NavigationTarget[];
}

/**
 * A query is ROUTE-SHAPED when it names a path rather than describing a place: it contains a
 * separator. `"director intent"` describes; `"/command/inbox"` and `"command/inbox"` specify.
 *
 * The unslashed form is included deliberately — it reached the same fuzzy fall-through and produced
 * the same wrong answer, so treating only the leading-slash form as a path would have fixed half a
 * defect and left the other half looking fixed.
 */
function isRouteShaped(query: string): boolean {
  return query.includes("/");
}

/**
 * Resolve a free-text navigation phrase to a real route. Deterministic keyword matching —
 * no model. Returns a confident target on a strong match, otherwise real candidates, and
 * never a fabricated route. Empty/blank input yields no match.
 *
 * ── AN EXACT PATH IS ANSWERED EXACTLY, OR NOT AT ALL (HEBY-NAV-0) ────────────────────────────
 *
 * The directory below is built from the CANONICAL navigation model, which is the right source for
 * DISCOVERY — "what can I suggest when someone describes a place". It is not, and was never, a
 * register of which routes exist. Those are different questions and this function used to collapse
 * them: a path it could not find fell through into term matching, where `"/command/inbox"` contains
 * `"command"` and was therefore answered with **`/command`**.
 *
 * Measured before this repair, three separate inputs took that path:
 *
 *     "/command/inbox"          -> /command      a real, reachable, non-canonical route
 *     "/command/briefings"      -> /command      likewise
 *     "/command/does-not-exist" -> /command      a route that has never existed
 *
 * The third is the one that shows the defect is not about legacy routes at all: ANY path under a
 * workspace prefix was answered with the workspace. Removing five destinations from Command's menu
 * did not create this — it widened it.
 *
 * A navigation assistant may refuse. What it may not do is quietly answer a different destination
 * than the one it was handed. So a route-shaped query gets exactly one chance — the exact lookup —
 * and if that misses, it is NOT-FOUND. It never reaches the fuzzy matcher.
 *
 * That means a legacy route resolves to nothing rather than to something wrong. Resolving it
 * CORRECTLY would need an authority for which routes exist, and this repository has none: the only
 * candidate, `sidebar.config.ts`'s `staticRoutes`, is missing 34 real routes — `/command` among them
 * — and lists one that has no page. Refusing is what can be proved today; inventing a second route
 * list to do better would be a worse trade. Recorded, deliberately, as HEBY-NAV-0's chosen limit.
 */
export function resolveNavigation(query: string): NavigationResolution {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return { found: false, candidates: [] };

  // Exact route match.
  const exact = DIRECTORY.find((entry) => entry.route === q || entry.route === `/${q}`);
  if (exact) return { found: true, target: { route: exact.route, label: exact.label }, candidates: [] };

  /*
   * The caller named a path and the directory does not hold it. Stop here: substituting a fuzzy
   * neighbour would answer a question nobody asked.
   */
  if (isRouteShaped(q)) return { found: false, candidates: [] };

  // Strong term match: an entry whose term the query contains, or vice versa.
  const matches = DIRECTORY.filter((entry) =>
    entry.terms.some((term) => q === term || q.includes(term) || term.includes(q)),
  );

  if (matches.length === 1) {
    return { found: true, target: { route: matches[0].route, label: matches[0].label }, candidates: [] };
  }
  if (matches.length > 1) {
    // Prefer a workspace-landing exact-label hit if present.
    const landing = matches.find((entry) => !entry.label.includes("·") && entry.terms.includes(q));
    if (landing) return { found: true, target: { route: landing.route, label: landing.label }, candidates: [] };
    return {
      found: false,
      candidates: matches.slice(0, 5).map((entry) => ({ route: entry.route, label: entry.label })),
    };
  }
  return { found: false, candidates: [] };
}
