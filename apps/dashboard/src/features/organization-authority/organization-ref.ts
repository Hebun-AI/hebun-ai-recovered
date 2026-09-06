/*
 * organization-ref.ts — the canonical reference for one organization (TRH-16).
 *
 * ── WHY THIS EXISTS, AND WHY IT IS THE NARROWEST THING THAT COULD ────────────
 *
 * Governed `record-work` gained an organization-level branch: work an organization holds itself,
 * naming no department, because an organization with no departments is a valid organization. But
 * `requiredEvidenceCount(CONSEQUENTIAL_MUTATION)` is 1, and that rule is right — its question is
 * "does this action refer to anything real?" A branch that referred to nothing could not answer it.
 *
 * So organization-level work answers it with the organization ITSELF, which is real, retrievable,
 * and precisely the thing the work is scoped to. This module is only the vocabulary for saying so:
 * the same shape `department-ref.ts` established, for the record one level up.
 *
 *     THE EVIDENCE RULE WAS NOT LOWERED. It was answered.
 *
 * ── WHAT A REFERENCE IS NOT ──────────────────────────────────────────────────
 *
 * Formatting one asserts nothing about existence. `formatOrganizationRef` is pure string work over
 * a uuid the CALLER already resolved; whether that uuid names the reader's own organization is a
 * question only the Organization Authority can answer, and the resolver asks it there. A syntactic
 * check that felt like an existence check is exactly how a fabricated reference reaches an approval.
 *
 * Anchored and LOWERCASE ONLY, for the reason `department-ref.ts` already paid for: several
 * spellings of one id would hash as several different payloads and therefore as several different
 * approvals.
 *
 * Pure. No I/O, no database, no clock, no authority.
 */

/** The reference namespace. Sibling to `department`, one level up, and never a name. */
export const ORGANIZATION_REF_PREFIX = "organization";

/** Accepted on the way IN to `formatOrganizationRef`; the output is always lowercased. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REF_RE = new RegExp(
  `^${ORGANIZATION_REF_PREFIX}/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$`,
);

export interface ParsedOrganizationRef {
  readonly organizationId: string;
}

/**
 * Build the canonical reference for one organization.
 *
 * Throws rather than returning a malformed string: a bad reference would travel into an action
 * payload and be hashed into an approval, so the failure has to happen here and loudly.
 */
export function formatOrganizationRef(organizationId: string): string {
  if (!UUID_RE.test(organizationId)) {
    throw new TypeError("An organization reference requires a uuid organization id.");
  }
  return `${ORGANIZATION_REF_PREFIX}/${organizationId.toLowerCase()}`;
}

/**
 * Parse a reference. Returns `null` for anything that is not exactly one canonical reference — no
 * trimming, no case-folding of the prefix, no coercion. Fails closed.
 */
export function parseOrganizationRef(value: unknown): ParsedOrganizationRef | null {
  if (typeof value !== "string") return null;
  const match = REF_RE.exec(value);
  if (!match) return null;
  return { organizationId: match[1]! };
}

/** Whether a value is a syntactically canonical organization reference. */
export function isOrganizationRef(value: unknown): value is string {
  return parseOrganizationRef(value) !== null;
}
