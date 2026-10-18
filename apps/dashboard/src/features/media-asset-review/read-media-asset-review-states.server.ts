/*
 * media-asset-review/read-media-asset-review-states.server.ts — the review state of many admitted
 * assets, read from the Governance ledger (MEDIA-3).
 *
 * WHY THIS IS ITS OWN MODULE (SUITE-RECOVERY-1, RC-A): Heby's content-media grounding (HEBY-MEDIA-1)
 * reads review state. When this reader lived in `review-media-asset.server.ts`, Heby's answer graph
 * reached the module that writes the review decision, and through it the Governance decision writer
 * — exactly what the G6C authority-reachability firewall forbids. The reader moved here verbatim;
 * `review-media-asset.server.ts` re-exports it, so every existing caller is unchanged. This module
 * imports no Governance writer, no audit writer and no media writer, and it must stay that way.
 *
 * Server-only.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { decisionRecords } from "@/db/schema/governance";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { isUuid } from "@/features/media-assets/contracts";
import { resolveMediaDbOrNull } from "@/features/media-assets/media-db.server";
import {
  MEDIA_ASSET_REVIEW_ACCEPTED_OUTCOME,
  MEDIA_ASSET_REVIEW_DECLINED_OUTCOME,
  MEDIA_ASSET_REVIEW_SUBJECT_TYPE,
  type MediaAssetReviewState,
} from "./contracts";

export interface MediaAssetReviewDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
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
