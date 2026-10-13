/*
 * APF-3 — the scopes a NEW tenant external-AI authorization revision carries.
 *
 * A revision REPLACES the scope set of the one before it. So a ceremony that asks only for the purpose
 * it is adding would silently withdraw every other purpose the organization already authorized. The
 * requested set is therefore always the UNION of what is in force and what is being added, in a stable
 * order: what was authorized first stays first.
 */
import type { ScopePair } from "../../src/features/external-ai-data-use/contracts";

export function nextRevisionScopes(current: readonly ScopePair[], adding: readonly ScopePair[]): ScopePair[] {
  const key = (s: ScopePair) => `${s.purpose}|${s.dataClass}`;
  const seen = new Set(current.map(key));
  return [...current, ...adding.filter((s) => !seen.has(key(s)))].map((s) => ({ purpose: s.purpose, dataClass: s.dataClass }));
}

/** D1/D4 — the scopes of a revision that revokes ONE purpose: what is in force, minus that purpose, in order. */
export function revisionScopesWithout(current: readonly ScopePair[], purpose: ScopePair["purpose"]): ScopePair[] {
  return current.filter((s) => s.purpose !== purpose).map((s) => ({ purpose: s.purpose, dataClass: s.dataClass }));
}
