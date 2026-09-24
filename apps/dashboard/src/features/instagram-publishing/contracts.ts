/*
 * instagram-publishing/contracts.ts — the vocabulary of the `publish-instagram-media` governed act
 * (PUBLISH-0).
 *
 * ── WHERE IT IS WIRED ─────────────────────────────────────────────────────────
 *
 * Proposable through `heby-action-inlet/instagram-publish-proposal.server.ts`, authorizable through
 * the existing Governance decision → digest-bound permit, executable ONLY inside
 * `executeAuthorizedAction` (after the external-send arming conjunction), recorded on the released
 * `action_execution_attempts` ledger with NO recipient — `recipient_binding_chk` requires exactly
 * that for this kind and forbids it for every other.
 *
 * Prepared ≠ authorized ≠ executed ≠ successful. Only a media id Meta returned is success.
 *
 * Pure types and frozen values. No I/O.
 */

/** The governed action kind. One act = one feed image post to one bound Instagram connection. */
export const PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND = "publish-instagram-media" as const;

/**
 * The payload a decision binds, exhaustively. Every field is a REFERENCE plus a DIGEST of the exact
 * bytes a human approved, the same shape `send-external-communication` freezes:
 *
 *   integrationId           which connection (tenant-scoped); never an account id typed by anyone
 *   externalAccountId       the app-scoped id that connection was verified as at decision time
 *   draftRef / digest       the approved caption revision
 *   mediaAssetRef / digest  the approved image — the AUTHORITATIVE generated original
 *   publishAssetRef / digest
 *                           the `jpeg-publish-v1` derivative of exactly that original — the only
 *                           bytes Meta is ever handed a read grant for
 *
 * Both image identities are bound because they answer different questions: the original is what a
 * human reviewed as creative work, the derivative is what leaves Hebun. Execution re-verifies the
 * lineage between them; binding only one would let the other drift unseen.
 *
 * The publishing id (`user_id`) is NOT in the payload. It is read from Meta at execution time and
 * must arrive beside `externalAccountId`; a decision cannot name a different account to publish as.
 */
export interface PublishInstagramMediaPayload {
  readonly integrationId: string;
  readonly externalAccountId: string;
  readonly draftRef: string;
  readonly draftRevisionDigest: string;
  readonly mediaAssetRef: string;
  readonly mediaAssetDigest: string;
  readonly publishAssetRef: string;
  readonly publishAssetDigest: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const DIGITS = /^[0-9]{1,32}$/;

/** The payload if `raw` is exactly this shape, else `null`. Extra keys are refused, not ignored. */
export function asPublishInstagramMediaPayload(raw: unknown): PublishInstagramMediaPayload | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expected = [
    "draftRef",
    "draftRevisionDigest",
    "externalAccountId",
    "integrationId",
    "mediaAssetDigest",
    "mediaAssetRef",
    "publishAssetDigest",
    "publishAssetRef",
  ];
  if (keys.length !== expected.length || keys.some((k, i) => k !== expected[i])) return null;
  const {
    integrationId,
    externalAccountId,
    draftRef,
    draftRevisionDigest,
    mediaAssetRef,
    mediaAssetDigest,
    publishAssetRef,
    publishAssetDigest,
  } = record;
  if (typeof integrationId !== "string" || !UUID.test(integrationId)) return null;
  if (typeof externalAccountId !== "string" || !DIGITS.test(externalAccountId)) return null;
  if (typeof draftRef !== "string" || draftRef.length === 0) return null;
  if (typeof draftRevisionDigest !== "string" || !DIGEST.test(draftRevisionDigest)) return null;
  if (typeof mediaAssetRef !== "string" || !UUID.test(mediaAssetRef)) return null;
  if (typeof mediaAssetDigest !== "string" || !DIGEST.test(mediaAssetDigest)) return null;
  if (typeof publishAssetRef !== "string" || !UUID.test(publishAssetRef)) return null;
  if (typeof publishAssetDigest !== "string" || !DIGEST.test(publishAssetDigest)) return null;
  if (publishAssetRef === mediaAssetRef) return null;
  return {
    integrationId,
    externalAccountId,
    draftRef,
    draftRevisionDigest,
    mediaAssetRef,
    mediaAssetDigest,
    publishAssetRef,
    publishAssetDigest,
  };
}

/** The lifecycle, as values a test can pin. No rung implies the next. */
export const PUBLISH_LIFECYCLE = Object.freeze([
  "prepared",
  "authorized",
  "executable",
  "executed",
  "successful",
] as const);

/** What `accepted` from Meta does NOT mean. Rendered, not implied. */
export const PUBLISH_ACCEPTANCE_NON_CLAIMS: readonly string[] = Object.freeze([
  "does not mean anyone saw the post",
  "does not mean the post stays up",
  "does not mean the post performed",
  "a container id is not a post; only a returned media id is",
]);
