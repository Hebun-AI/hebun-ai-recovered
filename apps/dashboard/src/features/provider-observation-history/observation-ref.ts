/*
 * provider-observation-history/observation-ref.ts — the canonical reference for ONE stored provider
 * observation (SOC-ACT1).
 *
 * ── WHY THE OBSERVATION AND NOT SOMETHING ADJACENT ───────────────────────────
 *
 * `requiredEvidenceCount(CONSEQUENTIAL_MUTATION)` is 1, and its question is "does this action refer
 * to anything real?". Work proposed because a measurement moved refers to THE OBSERVATION THAT
 * RECORDED IT — not to the organization, not to a derived comparison, and not to a dashboard view
 * model. The organization is real but is not what the proposal rests on; a comparison is a pure
 * derivation with no durable identity to name; a view model is not an authority at all.
 *
 * So the anchor is `provider_observations.id`: a durable primary key, owned by the authority that
 * owns the row, and the only identifier here that survives a page reload.
 *
 * ── WHAT A REFERENCE IS NOT ──────────────────────────────────────────────────
 *
 * Formatting one asserts NOTHING about existence, ownership or tenancy. This module is pure string
 * work over a uuid the caller already holds; whether that uuid names an observation the reader's own
 * organization owns is a question only Provider Observation History can answer, and the originator
 * asks it there — by re-reading the row under the seam's own tenant predicate — before any evidence
 * is built. A syntactic check that felt like an existence check is exactly how a fabricated
 * reference reaches an approval.
 *
 *     A WELL-FORMED REFERENCE IS NOT A RESOLVED ONE.
 *
 * Anchored and LOWERCASE ONLY, for the reason `department-ref.ts` and `organization-ref.ts` already
 * paid for: several spellings of one id would hash as several different canonical payloads and
 * therefore as several different approvals.
 *
 * Pure. No I/O, no database, no clock, no authority.
 */

/**
 * The reference namespace.
 *
 * Named for the AUTHORITY that owns the row, not for the surface that happens to display it. A
 * `social-observation` prefix would have tied a general provider fact to one workspace's reading of
 * it, and the same row is equally an integrations fact and an intelligence fact.
 */
export const PROVIDER_OBSERVATION_REF_PREFIX = "provider-observation";

/** Accepted on the way IN to the formatter; the output is always lowercased. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REF_RE = new RegExp(
  `^${PROVIDER_OBSERVATION_REF_PREFIX}/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$`,
);

export interface ParsedProviderObservationRef {
  readonly observationId: string;
}

/**
 * Build the canonical reference for one stored observation.
 *
 * Throws rather than returning a malformed string: a bad reference would travel into an action
 * payload and be hashed into an approval, so the failure has to happen here and loudly.
 */
export function formatProviderObservationRef(observationId: string): string {
  if (!UUID_RE.test(observationId)) {
    throw new TypeError("A provider observation reference requires a uuid observation id.");
  }
  return `${PROVIDER_OBSERVATION_REF_PREFIX}/${observationId.toLowerCase()}`;
}

/**
 * Parse a reference. Returns `null` for anything that is not exactly one canonical reference — no
 * trimming, no case-folding of the prefix, no coercion. Fails closed.
 */
export function parseProviderObservationRef(value: unknown): ParsedProviderObservationRef | null {
  if (typeof value !== "string") return null;
  const match = REF_RE.exec(value);
  if (!match) return null;
  return { observationId: match[1]! };
}

/** Whether a value is a syntactically canonical provider observation reference. */
export function isProviderObservationRef(value: unknown): value is string {
  return parseProviderObservationRef(value) !== null;
}
