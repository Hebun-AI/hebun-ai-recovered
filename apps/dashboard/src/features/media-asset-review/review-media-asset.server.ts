/*
 * media-asset-review/review-media-asset.server.ts — binding a Governance decision to one exact
 * admitted image (MEDIA-1).
 *
 * ONE TRANSACTION, OR NOTHING:
 *
 *   BEGIN
 *     1. the authenticated human                       (server-side session)
 *     2. this tenant's Governance authority            (bootstrap or active delegation)
 *     3. the asset, tenant-scoped, still admitted      (the subject existence check)
 *     4. the digest the reviewer was shown == stored   (otherwise nothing is recorded)
 *     5. the approve/reject decision + session         (subject media_asset, domain media-asset-review)
 *     6. the Governance audit event
 *   COMMIT
 *
 * WHAT THIS MODULE DOES NOT DO, AND CANNOT: it imports the media schema to READ and imports no media
 * writer, so it cannot change the asset. It imports no action-authorization, permit or execution
 * module, so accepting cannot create any of them. There is no un-review: reversal is a new decision.
 *
 * Server-only.
 */
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { decisionRecords } from "@/db/schema/governance";
import { mediaAssets } from "@/db/schema/media-asset";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import { writeGovernanceDecisionWithin } from "@/features/governance-decision/decision-authority.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { validateJustification } from "@/features/governance-decision/persistence.server";
import { isByteDigest, isUuid } from "@/features/media-assets/contracts";
import { resolveMediaDbOrNull } from "@/features/media-assets/media-db.server";
import {
  MEDIA_ASSET_REVIEW_ACCEPTED_OUTCOME,
  MEDIA_ASSET_REVIEW_ACCEPT_TYPE,
  MEDIA_ASSET_REVIEW_DECLINED_OUTCOME,
  MEDIA_ASSET_REVIEW_DECLINE_TYPE,
  MEDIA_ASSET_REVIEW_SUBJECT_TYPE,
  type MediaAssetReviewDecision,
  type MediaAssetReviewRefusal,
  type MediaAssetReviewResult,
  type MediaAssetReviewState,
} from "./contracts";

export interface MediaAssetReviewDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

class ReviewAbort extends Error {
  constructor(readonly refusal: MediaAssetReviewRefusal) {
    super(refusal);
    this.name = "ReviewAbort";
  }
}

export interface MediaAssetReviewInput {
  readonly assetId: string;
  /** The SHA-256 the reviewer was SHOWN. Must equal the stored digest, or nothing is recorded. */
  readonly byteDigest: string;
  readonly justification: string;
}

async function review(
  tenant: TenantContext | null,
  input: MediaAssetReviewInput | null,
  decision: MediaAssetReviewDecision,
  deps: MediaAssetReviewDeps,
): Promise<MediaAssetReviewResult> {
  if (typeof window !== "undefined") {
    throw new Error("Media asset review is server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return { status: "refused", reason: "unauthenticated" };
  const justification = validateJustification(input?.justification ?? "");
  if (!justification) return { status: "refused", reason: "justification-required" };
  if (!isUuid(input?.assetId)) return { status: "refused", reason: "asset-unresolvable" };
  if (!isByteDigest(input?.byteDigest)) return { status: "refused", reason: "asset-digest-mismatch" };

  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return { status: "refused", reason: "persistence-unavailable" };
  const now = (deps.now ?? (() => new Date()))();
  const decisionType =
    decision === "accepted" ? MEDIA_ASSET_REVIEW_ACCEPT_TYPE : MEDIA_ASSET_REVIEW_DECLINE_TYPE;

  try {
    const authority = await resolveGovernanceAuthority(tenant, deps);
    if (!authority.bootstrapDecisionId) throw new ReviewAbort("no-governance-authority");
    if (!authority.authorized) throw new ReviewAbort("not-the-governance-authority");

    let outcome: MediaAssetReviewResult | null = null;
    await db.transaction(async (tx) => {
      /* THE SUBJECT EXISTENCE CHECK — tenant-predicated, and locked for the length of the decision. */
      const rows = await tx
        .select({
          id: mediaAssets.id,
          byteDigest: mediaAssets.byteDigest,
          mimeType: mediaAssets.mimeType,
          byteSize: mediaAssets.byteSize,
          width: mediaAssets.width,
          height: mediaAssets.height,
          invocationId: mediaAssets.invocationId,
          lifecycle: mediaAssets.assetLifecycleStatus,
          mediaKind: mediaAssets.mediaKind,
        })
        .from(mediaAssets)
        /*
         * PUBLISH-0: a derived (publish) asset is not a reviewable creative subject.
         * MEDIA-SUPPLIED: neither is an image a human supplied — this is the creative review of
         * GENERATED output, and only a generated asset (one with an invocation) is its subject.
         */
        .where(
          and(
            eq(mediaAssets.tenantId, tenant.tenantId),
            eq(mediaAssets.id, input!.assetId),
            isNull(mediaAssets.derivedFromAssetId),
            isNotNull(mediaAssets.invocationId),
          ),
        )
        .for("share")
        .limit(1);
      const asset = rows[0];
      if (!asset) throw new ReviewAbort("asset-unresolvable");
      /* MV-2 — this is the review of generated IMAGES. A video row is not its subject. */
      if (asset.mediaKind !== "image") throw new ReviewAbort("asset-not-image");
      if (asset.lifecycle !== "admitted") throw new ReviewAbort("asset-retired");
      if (asset.byteDigest !== input!.byteDigest) throw new ReviewAbort("asset-digest-mismatch");

      /* Bound to the ASSET row; the byte digest rides in evidence so the ledger names the bytes. */
      const written = await writeGovernanceDecisionWithin(
        tx as unknown as ControlPlaneDatabase,
        tenant,
        authority,
        {
          decisionType,
          subjectType: MEDIA_ASSET_REVIEW_SUBJECT_TYPE,
          subjectId: asset.id,
          justification,
          evidence: {
            mediaAssetId: asset.id,
            byteDigest: asset.byteDigest,
            mimeType: asset.mimeType,
            byteSize: asset.byteSize,
            width: asset.width,
            height: asset.height,
            invocationId: asset.invocationId,
          },
        },
        now,
      );

      await recordGovernanceEventWithin(
        tx,
        {
          tenantId: tenant.tenantId,
          userId: tenant.userId,
          requestId: tenant.requestId,
          sessionContextId: tenant.sessionContextId,
        },
        {
          action: "governance.decision.recorded",
          outcome: "committed",
          entityId: written.decisionId,
          metadata: {
            governanceSessionId: written.sessionId,
            decisionType,
            subjectType: MEDIA_ASSET_REVIEW_SUBJECT_TYPE,
            subjectId: asset.id,
            bootstrap: false,
          },
        },
        now,
      );

      outcome = {
        status: "reviewed",
        decision,
        assetId: asset.id,
        byteDigest: asset.byteDigest,
        decisionId: written.decisionId,
        governanceSessionId: written.sessionId,
        decidedAt: now.toISOString(),
      };
    });
    return outcome ?? { status: "refused", reason: "persistence-unavailable" };
  } catch (error) {
    if (error instanceof ReviewAbort) return { status: "refused", reason: error.refusal };
    return { status: "refused", reason: "persistence-unavailable" };
  }
}

/** ACCEPT one exact admitted image for the next internal step. Authorizes nothing external. */
export async function acceptMediaAsset(
  tenant: TenantContext | null,
  input: MediaAssetReviewInput | null,
  deps: MediaAssetReviewDeps = {},
): Promise<MediaAssetReviewResult> {
  return review(tenant, input, "accepted", deps);
}

/** RECORD that Governance did not accept one exact image. The asset is unchanged and readable. */
export async function declineMediaAsset(
  tenant: TenantContext | null,
  input: MediaAssetReviewInput | null,
  deps: MediaAssetReviewDeps = {},
): Promise<MediaAssetReviewResult> {
  return review(tenant, input, "declined", deps);
}

/**
 * The DERIVED review state of one asset: the latest decision by `decided_at`, with the count of all
 * of them. An unreadable ledger is `unavailable`, never "no decision".
 */
export async function readMediaAssetReviewState(
  tenant: TenantContext | null,
  assetId: string,
  deps: MediaAssetReviewDeps = {},
): Promise<MediaAssetReviewState> {
  if (!tenant?.tenantId || !isUuid(assetId)) return { status: "unavailable" };
  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return { status: "unavailable" };
  try {
    const decisions = await db
      .select({
        decisionId: decisionRecords.id,
        outcome: decisionRecords.outcome,
        decidedAt: decisionRecords.decidedAt,
      })
      .from(decisionRecords)
      .where(
        and(
          eq(decisionRecords.tenantId, tenant.tenantId),
          eq(decisionRecords.subjectType, MEDIA_ASSET_REVIEW_SUBJECT_TYPE),
          eq(decisionRecords.subjectId, assetId),
        ),
      )
      .orderBy(desc(decisionRecords.decidedAt));
    const latest = decisions[0];
    return {
      status: "read",
      decision: latest
        ? latest.outcome === MEDIA_ASSET_REVIEW_ACCEPTED_OUTCOME
          ? "accepted"
          : latest.outcome === MEDIA_ASSET_REVIEW_DECLINED_OUTCOME
            ? "declined"
            : null
        : null,
      decisionId: latest?.decisionId ?? null,
      decidedAt: latest?.decidedAt ? new Date(latest.decidedAt).toISOString() : null,
      decisionCount: decisions.length,
    };
  } catch {
    return { status: "unavailable" };
  }
}

/*
 * ── MEDIA-3: THE REVIEW STATE OF MANY ASSETS, IN ONE READ ────────────────────
 *
 * A revision's asset list needs each asset's review state, and asking per asset is one query per
 * row. This is the same derivation as `readMediaAssetReviewState`, batched — and it stays a
 * DERIVATION. No approval state is written to, or read from, `media_assets`: the ledger is the only
 * place a decision exists, and an asset with no decision is reported as `decision: null`, which is
 * the released way of saying NOT YET REVIEWED. Absence is never rendered as approval.
 *
 * Assets the caller asked about that have no decision still appear in the map, so a missing key can
 * only ever mean "not asked about" and never "silently unreviewed".
 */
export async function readMediaAssetReviewStates(
  tenant: TenantContext | null,
  assetIds: readonly string[],
  deps: MediaAssetReviewDeps = {},
): Promise<ReadonlyMap<string, MediaAssetReviewState>> {
  const wanted = assetIds.filter(isUuid);
  const empty = new Map<string, MediaAssetReviewState>();
  if (!tenant?.tenantId || wanted.length === 0) return empty;

  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  /* Unreadable is UNAVAILABLE for every asset asked about — never silently "unreviewed". */
  if (!db) return new Map(wanted.map((id) => [id, { status: "unavailable" } as const]));

  try {
    const decisions = await db
      .select({
        subjectId: decisionRecords.subjectId,
        decisionId: decisionRecords.id,
        outcome: decisionRecords.outcome,
        decidedAt: decisionRecords.decidedAt,
      })
      .from(decisionRecords)
      .where(
        and(
          eq(decisionRecords.tenantId, tenant.tenantId),
          eq(decisionRecords.subjectType, MEDIA_ASSET_REVIEW_SUBJECT_TYPE),
          inArray(decisionRecords.subjectId, [...wanted]),
        ),
      )
      .orderBy(desc(decisionRecords.decidedAt));

    const byAsset = new Map<string, MediaAssetReviewState>();
    for (const id of wanted) {
      const mine = decisions.filter((d) => d.subjectId === id);
      const latest = mine[0];
      byAsset.set(id, {
        status: "read",
        decision: latest
          ? latest.outcome === MEDIA_ASSET_REVIEW_ACCEPTED_OUTCOME
            ? "accepted"
            : latest.outcome === MEDIA_ASSET_REVIEW_DECLINED_OUTCOME
              ? "declined"
              : null
          : null,
        decisionId: latest?.decisionId ?? null,
        decidedAt: latest?.decidedAt ? new Date(latest.decidedAt).toISOString() : null,
        decisionCount: mine.length,
      });
    }
    return byAsset;
  } catch {
    return new Map(wanted.map((id) => [id, { status: "unavailable" } as const]));
  }
}
