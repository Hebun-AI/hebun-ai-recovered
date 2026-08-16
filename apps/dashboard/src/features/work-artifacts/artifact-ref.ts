/*
 * work-artifacts/artifact-ref.ts — the stable record reference for one exact revision (R3W).
 *
 * THE FORMAT, AND WHY IT CARRIES A REVISION:
 *
 *   work-artifact/<uuid>@<revision-no>
 *
 * An artifact-only reference would be a moving target: approve "draft X", revise X, and the same
 * string now names different bytes. Gate A found exactly that hole in the R3A binding — the
 * canonical payload hashes the reference STRING, so changing what a bare reference points at
 * leaves the digest untouched. Putting the revision inside the reference makes the drift
 * impossible to express, and pairing it with the content digest makes it impossible to fake.
 *
 * The `<domain>/<key>` shape is the established `recordRef` convention: Knowledge evidence uses
 * `${domainKey}/${factKey}`. The `@<n>` suffix is the addition, and it is the whole point.
 *
 * A REF IS NOT AUTHORITY. It is a lookup key. Holding one grants nothing: every read still
 * resolves inside a server-resolved tenant, and a reference to another tenant's artifact resolves
 * to nothing at all rather than to a refusal that would confirm the row exists.
 *
 * Pure. No I/O, no database, no clock, no authority.
 */

/** The reference namespace. Matches the source class so a reader can tell where to resolve it. */
export const WORK_ARTIFACT_REF_PREFIX = "work-artifact";

/** Accepted on the way IN to `formatWorkArtifactRef`; the output is always lowercased. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/*
 * Anchored, LOWERCASE ONLY, and the revision is digits-only with no sign, no leading zero, and no
 * separator. A permissive parse would let "…@1 ", "…@+1", "…@01" and an upper-case uuid all
 * resolve to the same revision while hashing as four different payload strings — four references
 * to the same bytes carrying four different approvals. Exactly one spelling per revision, or
 * nothing.
 */
const REF_RE = new RegExp(
  `^${WORK_ARTIFACT_REF_PREFIX}/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@([1-9][0-9]{0,8})$`,
);

export interface ParsedWorkArtifactRef {
  readonly artifactId: string;
  readonly revisionNo: number;
}

/**
 * Build the canonical reference for one exact revision.
 *
 * Throws rather than returning a malformed string: a bad reference would travel into an action
 * payload and be hashed into an approval, so the failure has to happen here and loudly.
 */
export function formatWorkArtifactRef(artifactId: string, revisionNo: number): string {
  if (!UUID_RE.test(artifactId)) {
    throw new TypeError("A work-artifact reference requires a uuid artifact id.");
  }
  if (!Number.isInteger(revisionNo) || revisionNo < 1) {
    throw new TypeError("A work-artifact reference requires a positive integer revision number.");
  }
  return `${WORK_ARTIFACT_REF_PREFIX}/${artifactId.toLowerCase()}@${revisionNo}`;
}

/**
 * Parse a reference. Returns `null` for anything that is not exactly one canonical reference —
 * no trimming, no case-folding of the prefix, no coercion. Fails closed.
 */
export function parseWorkArtifactRef(value: unknown): ParsedWorkArtifactRef | null {
  if (typeof value !== "string") return null;
  const match = REF_RE.exec(value);
  if (!match) return null;
  return { artifactId: match[1]!, revisionNo: Number(match[2]!) };
}

/** Whether a value is a syntactically canonical work-artifact reference. */
export function isWorkArtifactRef(value: unknown): value is string {
  return parseWorkArtifactRef(value) !== null;
}
