/*
 * work-domain/work-scope.ts — the WORK SCOPE a human states for one piece of work (AP-4B).
 *
 *   { kind: "organization" }               organization-level work; names no domain
 *   { kind: "domain", workDomainId }       work of one kind this organization recorded
 *
 * A work scope is the human's statement of WHAT KIND of work this is. It is not a department (where
 * the work sits) and it is not eligibility (who may propose it): a mandate's responsibility answers
 * that, against this value. The scope travels in a `record-work` payload as two flat arguments,
 * `workScope` and — for a domain — `workDomainRef`, so it is hashed into the payload digest a human
 * approves and the permit is bound to exactly that scope.
 *
 *   work-domain/<uuid>
 *
 * The reference follows `department-ref.ts`: anchored, lowercase only (several spellings of one id
 * would hash as several approvals), and NOT authority — whether the id names an in-service domain of
 * THIS tenant is answered by the reader that resolves it, never by parsing.
 *
 * Pure. No I/O, no database, no clock, no authority. Client-safe.
 */

export const WORK_SCOPE_KINDS = Object.freeze(["organization", "domain"] as const);
export type WorkScopeKind = (typeof WORK_SCOPE_KINDS)[number];

export type WorkScope =
  | { readonly kind: "organization" }
  | { readonly kind: "domain"; readonly workDomainId: string };

export const WORK_DOMAIN_REF_PREFIX = "work-domain";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const REF_RE = new RegExp(`^${WORK_DOMAIN_REF_PREFIX}/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$`);

/** Throws on a malformed id: a bad reference would be hashed into an approval. */
export function formatWorkDomainRef(workDomainId: string): string {
  const id = typeof workDomainId === "string" ? workDomainId.toLowerCase() : "";
  if (!UUID_RE.test(id)) throw new Error("A work domain reference needs a well-formed id.");
  return `${WORK_DOMAIN_REF_PREFIX}/${id}`;
}

export function parseWorkDomainRef(value: unknown): { readonly workDomainId: string } | null {
  if (typeof value !== "string") return null;
  const match = REF_RE.exec(value);
  return match ? { workDomainId: match[1]! } : null;
}

/**
 * A caller-stated scope, accepted only in its exact shape. Anything else is `null` — never coerced,
 * never defaulted to organization-level: EXPLICIT ORGANIZATION != MISSING SCOPE.
 */
export function parseWorkScope(value: unknown): WorkScope | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as { kind?: unknown; workDomainId?: unknown };
  const keys = Object.keys(v);
  if (v.kind === "organization" && keys.length === 1) return { kind: "organization" };
  if (v.kind === "domain" && keys.length === 2 && typeof v.workDomainId === "string") {
    const id = v.workDomainId.toLowerCase();
    return UUID_RE.test(id) ? { kind: "domain", workDomainId: id } : null;
  }
  return null;
}

/** The payload arguments that carry a scope. */
export function workScopeArguments(scope: WorkScope): Record<string, string> {
  return scope.kind === "organization"
    ? { workScope: "organization" }
    : { workScope: "domain", workDomainRef: formatWorkDomainRef(scope.workDomainId) };
}

/**
 * Read the scope back out of an approved payload. `null` for an absent, unknown or contradictory
 * declaration (an organization scope with a domain reference, a domain scope without one).
 */
export function workScopeFromPayload(payload: Readonly<Record<string, unknown>> | null | undefined): WorkScope | null {
  if (!payload) return null;
  const kind = payload["workScope"];
  if (kind === "organization") return payload["workDomainRef"] === undefined ? { kind: "organization" } : null;
  if (kind !== "domain") return null;
  const parsed = parseWorkDomainRef(payload["workDomainRef"]);
  return parsed ? { kind: "domain", workDomainId: parsed.workDomainId } : null;
}
