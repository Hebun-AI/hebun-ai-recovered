/*
 * media-assets/external-generative-eligibility.server.ts — the data-use gate every external generation
 * that takes an admitted asset as INPUT passes through, BEFORE the asset's bytes are read for sending
 * (DATA-USE-MEDIA-GUARD-1).
 *
 * It reads the Media authority's own provenance — nothing else — to classify the source's lineage, and
 * asks the pure decision in `external-generative-data-use.ts`. It reads no Governance state, no review,
 * no selection, no Content Package and no provider switch: none of those is data-use permission.
 *
 * ── THE LINEAGE WALK ─────────────────────────────────────────────────────────
 *
 * From the source asset, one tenant-predicated row at a time:
 *
 *   supplied row                   → the lineage includes a human-supplied asset; stop
 *   derived row (PUBLISH-0 / MV-5) → continue at `derived_from_asset_id`
 *   generated row                  → continue at its invocation's `source_media_asset_id` (MEDIA-5 /
 *                                    IMAGE → VIDEO lineage); a prompt-only invocation is the root
 *
 * A missing row, a row that is none of the three, a cycle, or a lineage deeper than the bound is
 * UNRESOLVABLE, and an unresolvable lineage is `unknown` — refused. Every read is predicated on the
 * session tenant, so another tenant's asset is indistinguishable from an absent one.
 *
 * Server-only. Writes nothing.
 */
import { and, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { mediaAssets, mediaGenerationInvocations } from "@/db/schema/media-asset";
import {
  decideExternalGenerativeDataUse,
  RECORDED_DATA_USE_DECISIONS,
  type DataUseVerdict,
  type ExternalGenerativePurpose,
  type RecordedDataUseDecision,
  type SourceLineage,
} from "./external-generative-data-use";

/** Far above any real chain (derivative of an edit of an edit…), low enough to bound a bad row. */
export const MAX_SOURCE_LINEAGE_DEPTH = 16;

export async function resolveSourceLineage(
  db: Pick<ControlPlaneDatabase, "select">,
  tenantId: string,
  assetId: string,
): Promise<SourceLineage> {
  const seen = new Set<string>();
  let current: string | null = assetId.toLowerCase();
  for (let depth = 0; depth < MAX_SOURCE_LINEAGE_DEPTH && current !== null; depth += 1) {
    if (seen.has(current)) return { status: "unresolvable" };
    seen.add(current);
    const row: {
      readonly invocationId: string | null;
      readonly derivedFromAssetId: string | null;
      readonly suppliedSource: string | null;
      readonly invocationSourceAssetId: string | null;
      readonly invocationTenantId: string | null;
    } | undefined = (
      await db
        .select({
          invocationId: mediaAssets.invocationId,
          derivedFromAssetId: mediaAssets.derivedFromAssetId,
          suppliedSource: mediaAssets.suppliedSource,
          invocationSourceAssetId: mediaGenerationInvocations.sourceMediaAssetId,
          invocationTenantId: mediaGenerationInvocations.tenantId,
        })
        .from(mediaAssets)
        .leftJoin(
          mediaGenerationInvocations,
          and(
            eq(mediaGenerationInvocations.id, mediaAssets.invocationId),
            eq(mediaGenerationInvocations.tenantId, mediaAssets.tenantId),
          ),
        )
        .where(and(eq(mediaAssets.tenantId, tenantId), eq(mediaAssets.id, current)))
        .limit(1)
    )[0];
    if (!row) return { status: "unresolvable" };

    if (row.suppliedSource !== null) return { status: "resolved", lineage: "includes-supplied" };
    if (row.derivedFromAssetId !== null) {
      current = row.derivedFromAssetId.toLowerCase();
      continue;
    }
    if (row.invocationId !== null) {
      /* The invocation must be this tenant's own; the composite FK says so, and the join re-checks it. */
      if (row.invocationTenantId !== tenantId) return { status: "unresolvable" };
      if (row.invocationSourceAssetId === null) return { status: "resolved", lineage: "generated-only" };
      current = row.invocationSourceAssetId.toLowerCase();
      continue;
    }
    return { status: "unresolvable" };
  }
  return { status: "unresolvable" };
}

export interface ExternalGenerativeEligibilityDeps {
  /**
   * Tests only: a different recorded-decision list, so the rest of a generation can be exercised with a
   * simulated provider. No application door passes it; a firewall test pins that.
   */
  readonly dataUseDecisions?: readonly RecordedDataUseDecision[];
}

/**
 * The data-use verdict for sending THIS tenant's asset to `provider` for `purpose`. A database failure
 * is `unknown`, never an exception that a caller could mistake for "no answer, carry on".
 */
export async function resolveExternalGenerativeEligibility(
  db: Pick<ControlPlaneDatabase, "select">,
  tenantId: string,
  assetId: string,
  request: { readonly provider: string; readonly purpose: ExternalGenerativePurpose },
  deps: ExternalGenerativeEligibilityDeps = {},
): Promise<DataUseVerdict> {
  if (typeof window !== "undefined") throw new Error("Data-use eligibility is server-only.");
  let lineage: SourceLineage;
  try {
    lineage = await resolveSourceLineage(db, tenantId, assetId);
  } catch {
    lineage = { status: "unresolvable" };
  }
  return decideExternalGenerativeDataUse(
    { provider: request.provider, purpose: request.purpose, lineage },
    deps.dataUseDecisions ?? RECORDED_DATA_USE_DECISIONS,
  );
}
