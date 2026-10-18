/*
 * media-assets/read-video-generations.server.ts — what Hebun knows about the asynchronous video
 * attempts of several drafts, read from `media_generation_invocations` (VIDEO CONTENT CHAIN).
 *
 * WHY THIS IS ITS OWN MODULE (SUITE-RECOVERY-1, RC-A): Heby's content-media grounding (HEBY-MEDIA-1)
 * lists a draft's video attempts. While the listing lived in `async-generation-lifecycle.server.ts`,
 * Heby's answer graph reached the generation transport resolver and through it the Higgsfield
 * transport's `fetch` — what the INT-5A/INT-5B1/INT-5C network firewalls forbid. The view shape and
 * the listing moved here verbatim (its `deps` type is the `getDb`-only slice it always took);
 * registration, dispatch, poll and the single-attempt read stay in the lifecycle module, which
 * imports and re-exports what moved. This module is a DATABASE read: it resolves no transport,
 * calls no provider and opens no store, and it must stay that way.
 *
 * Server-only.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { mediaGenerationInvocations } from "@/db/schema/media-asset";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { isUuid, type MediaInvocationState } from "./contracts";
import { resolveMediaDbOrNull } from "./media-db.server";

/** The `getDb`-only slice of the lifecycle's deps — all a read ever took. */
export interface AsyncGenerationReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

export interface AsyncGenerationView {
  readonly invocationId: string;
  readonly outputMediaKind: "video";
  readonly state: MediaInvocationState;
  /** `fake` is SIMULATED — a test transport, never a provider's answer. */
  readonly simulated: boolean;
  readonly provider: string;
  readonly model: string;
  readonly providerAcceptedAt: string | null;
  readonly providerCompletedAt: string | null;
  readonly lastPolledAt: string | null;
  readonly pollCount: number;
  readonly providerFailure: string | null;
  /** True when the provider reported an output reference. NOT a Media asset. */
  readonly providerOutputReported: boolean;
  readonly admissionOutcome: string;
}

/*
 * ── VIDEO CONTENT CHAIN: every video attempt of several drafts, in one read ──
 *
 * The same view as `readAsyncMediaGeneration`, listed per draft so a human can see what they asked
 * for and where each attempt stands. A READ: it moves nothing, calls no provider and resolves no
 * transport. The provider output reference stays inside this module — only whether one was reported.
 * `sourceRevisionNo` is the invocation's own source revision (provenance), never "the current one".
 */
export interface AsyncGenerationListing {
  readonly status: "read";
  readonly generations: readonly (AsyncGenerationView & {
    readonly sourceArtifactId: string;
    readonly sourceRevisionNo: number;
    readonly requestedAt: string;
    /** IMAGE → VIDEO: the MEDIA-5 lineage — the admitted image this video is generated from, or null. */
    readonly sourceMediaAssetId: string | null;
  })[];
}

export async function listArtifactVideoGenerations(
  tenant: TenantContext | null,
  input: { readonly artifactIds: readonly string[] } | null,
  deps: AsyncGenerationReadDeps = {},
): Promise<AsyncGenerationListing | { readonly status: "unavailable" }> {
  if (typeof window !== "undefined") throw new Error("Media generation reads are server-only.");
  if (!tenant?.tenantId || !tenant.userId) return { status: "unavailable" };
  const ids = (input?.artifactIds ?? []).filter(isUuid);
  if (ids.length === 0) return { status: "read", generations: [] };
  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return { status: "unavailable" };
  const t = mediaGenerationInvocations;
  let rows;
  try {
    rows = await db
      .select({
        id: t.id,
        state: t.state,
        transport: t.transport,
        provider: t.provider,
        model: t.model,
        providerAcceptedAt: t.providerAcceptedAt,
        providerCompletedAt: t.providerCompletedAt,
        lastPolledAt: t.lastPolledAt,
        pollCount: t.pollCount,
        providerFailure: t.providerFailure,
        outputReported: sql<boolean>`${t.providerOutputRef} is not null`,
        admissionOutcome: t.admissionOutcome,
        sourceArtifactId: t.sourceArtifactId,
        sourceRevisionNo: t.sourceRevisionNo,
        requestedAt: t.requestedAt,
        sourceMediaAssetId: t.sourceMediaAssetId,
      })
      .from(t)
      .where(and(eq(t.tenantId, tenant.tenantId), eq(t.outputMediaKind, "video"), inArray(t.sourceArtifactId, ids)))
      .orderBy(desc(t.requestedAt), desc(t.id));
  } catch {
    return { status: "unavailable" };
  }
  const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
  return {
    status: "read",
    generations: rows.map((r) => ({
      invocationId: r.id,
      outputMediaKind: "video" as const,
      state: r.state as MediaInvocationState,
      simulated: r.transport === "fake",
      provider: r.provider,
      model: r.model,
      providerAcceptedAt: iso(r.providerAcceptedAt),
      providerCompletedAt: iso(r.providerCompletedAt),
      lastPolledAt: iso(r.lastPolledAt),
      pollCount: r.pollCount,
      providerFailure: r.providerFailure,
      providerOutputReported: r.outputReported === true,
      admissionOutcome: r.admissionOutcome,
      sourceArtifactId: r.sourceArtifactId,
      sourceRevisionNo: r.sourceRevisionNo,
      requestedAt: new Date(r.requestedAt).toISOString(),
      sourceMediaAssetId: r.sourceMediaAssetId,
    })),
  };
}
