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
 * Resolve a free-text navigation phrase to a real route. Deterministic keyword matching —
 * no model. Returns a confident target on a strong match, otherwise real candidates, and
 * never a fabricated route. Empty/blank input yields no match.
 */
export function resolveNavigation(query: string): NavigationResolution {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return { found: false, candidates: [] };

  // Exact route match.
  const exact = DIRECTORY.find((entry) => entry.route === q || entry.route === `/${q}`);
  if (exact) return { found: true, target: { route: exact.route, label: exact.label }, candidates: [] };

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
