/*
 * organization-authority/department-ref.ts — the stable record reference for one department (GIA-1).
 *
 * THE FORMAT:
 *
 *   department/<uuid>
 *
 * ── WHY A DEPARTMENT NEEDED A REFERENCE AT ALL ───────────────────────────────
 *
 * Until GIA-1 nothing outside this authority had to NAME a department in a way that survives being
 * frozen into an approval. The governed `record-work` act does: its proposal carries one
 * `record-ref` argument, that argument is hashed into the payload digest a human approves, and the
 * executor resolves it back to an id inside the permit's own transaction. A bare uuid could not do
 * that job — a `record-ref` argument is checked against retrieved evidence by ITS NAMESPACE, and an
 * unqualified id names nothing a reader can resolve.
 *
 * ── WHY NO REVISION SUFFIX ───────────────────────────────────────────────────
 *
 * `work-artifact/<uuid>@<n>` carries one because an artifact's bytes are edited under a stable
 * identity. A department's identity is the thing being named here, not its name text: renaming a
 * department does not make it a different part of the organization, and retirement is a LIFECYCLE
 * fact the resolver answers, never something a reference should encode. This is `recipient-ref.ts`'s
 * reasoning, applied to the same question.
 *
 * ── WHAT A REF IS NOT ────────────────────────────────────────────────────────
 *
 * NOT AUTHORITY. It is a lookup key; holding one grants nothing, and every read resolves inside a
 * server-resolved tenant, so a reference to another organization's department resolves to NOTHING
 * rather than to a refusal that would confirm the row exists.
 *
 * NOT ELIGIBILITY. A syntactically perfect reference to a RETIRED department parses fine here and
 * is refused by the resolver. Parsing answers "is this a well-formed name"; the authority answers
 * "may work be filed against it today".
 *
 * Anchored and LOWERCASE ONLY, for the reason `artifact-ref.ts` already paid for: several spellings
 * of one id would hash as several different payloads and therefore as several different approvals.
 *
 * Pure. No I/O, no database, no clock, no authority.
 */

/** The reference namespace. Matches the department vocabulary a reader already knows. */
export const DEPARTMENT_REF_PREFIX = "department";

/** Accepted on the way IN to `formatDepartmentRef`; the output is always lowercased. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REF_RE = new RegExp(
  `^${DEPARTMENT_REF_PREFIX}/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$`,
);

export interface ParsedDepartmentRef {
  readonly departmentId: string;
}

/**
 * Build the canonical reference for one department.
 *
 * Throws rather than returning a malformed string: a bad reference would travel into an action
 * payload and be hashed into an approval, so the failure has to happen here and loudly.
 */
export function formatDepartmentRef(departmentId: string): string {
  if (!UUID_RE.test(departmentId)) {
    throw new TypeError("A department reference requires a uuid department id.");
  }
  return `${DEPARTMENT_REF_PREFIX}/${departmentId.toLowerCase()}`;
}

/**
 * Parse a reference. Returns `null` for anything that is not exactly one canonical reference — no
 * trimming, no case-folding of the prefix, no coercion. Fails closed.
 */
export function parseDepartmentRef(value: unknown): ParsedDepartmentRef | null {
  if (typeof value !== "string") return null;
  const match = REF_RE.exec(value);
  if (!match) return null;
  return { departmentId: match[1]! };
}

/** Whether a value is a syntactically canonical department reference. */
export function isDepartmentRef(value: unknown): value is string {
  return parseDepartmentRef(value) !== null;
}
