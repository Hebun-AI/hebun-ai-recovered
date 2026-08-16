/*
 * external-recipients/recipient-ref.ts — the stable record reference for one recipient (R3R).
 *
 * THE FORMAT:
 *
 *   external-recipient/<uuid>
 *
 * ── WHY NO `@<n>` SUFFIX, WHEN R3W NEEDED ONE ────────────────────────────────
 *
 * `work-artifact/<uuid>@<revision>` carries a revision because an artifact's content is EDITED
 * repeatedly under one stable identity, so a bare reference would be a moving target. A recipient's
 * address is never edited — the row's `endpoint_*` columns have no writer that updates them, and
 * "changing Jane's email" is retire-plus-create. The id therefore already names exact bytes, and a
 * version suffix would be ceremony with nothing behind it.
 *
 * The `<domain>/<key>` shape is the established `recordRef` convention: Knowledge evidence uses
 * `${domainKey}/${factKey}`, work artifacts use `work-artifact/<uuid>@<n>`.
 *
 * A REF IS NOT AUTHORITY. It is a lookup key. Holding one grants nothing: every read resolves
 * inside a server-resolved tenant, and a reference to another tenant's recipient resolves to
 * NOTHING AT ALL rather than to a refusal that would confirm the row exists.
 *
 * A REF IS NOT PROPOSAL ELIGIBILITY EITHER. A syntactically perfect reference to a RETIRED
 * recipient parses fine and is deliberately not offered as evidence — see
 * `recipient-evidence.server.ts`. Parsing answers "is this a well-formed name"; the resolver
 * answers "may this be proposed today".
 *
 * Pure. No I/O, no database, no clock, no authority.
 */

/** The reference namespace. Matches the source class so a reader can tell where to resolve it. */
export const EXTERNAL_RECIPIENT_REF_PREFIX = "external-recipient";

/** Accepted on the way IN to `formatRecipientRef`; the output is always lowercased. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/*
 * Anchored and LOWERCASE ONLY. A permissive parse would let "…/ABC-…", "… " and "…/abc-…/" all
 * resolve to the same row while hashing as different payload strings — several references to one
 * recipient carrying several different approvals. Exactly one spelling per recipient, or nothing.
 * This is the lesson `artifact-ref.ts` already paid for, applied here before it can bite.
 */
const REF_RE = new RegExp(
  `^${EXTERNAL_RECIPIENT_REF_PREFIX}/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$`,
);

export interface ParsedRecipientRef {
  readonly recipientId: string;
}

/**
 * Build the canonical reference for one recipient.
 *
 * Throws rather than returning a malformed string: a bad reference would travel into an action
 * payload and be hashed into an approval, so the failure has to happen here and loudly.
 */
export function formatRecipientRef(recipientId: string): string {
  if (!UUID_RE.test(recipientId)) {
    throw new TypeError("An external-recipient reference requires a uuid recipient id.");
  }
  return `${EXTERNAL_RECIPIENT_REF_PREFIX}/${recipientId.toLowerCase()}`;
}

/**
 * Parse a reference. Returns `null` for anything that is not exactly one canonical reference —
 * no trimming, no case-folding of the prefix, no coercion. Fails closed.
 */
export function parseRecipientRef(value: unknown): ParsedRecipientRef | null {
  if (typeof value !== "string") return null;
  const match = REF_RE.exec(value);
  if (!match) return null;
  return { recipientId: match[1]! };
}

/** Whether a value is a syntactically canonical external-recipient reference. */
export function isRecipientRef(value: unknown): value is string {
  return parseRecipientRef(value) !== null;
}
