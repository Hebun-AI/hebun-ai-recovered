/*
 * media-assets/retire-media-asset.server.ts — the ONE lifecycle transition (MEDIA-1).
 *
 * `admitted → retired`. The tenant saying "we are done with this image". Any authenticated member of
 * the tenant may do it — the same rule `retireWorkArtifact` uses — because retiring confers and
 * removes no authority: the bytes stay, the row stays, every Governance decision about it stays.
 *
 * THIS IS THE ONLY UPDATE OF `media_assets` IN THE REPOSITORY. It sets exactly the three retirement
 * columns. The byte identity — digest, size, MIME, dimensions, storage key, invocation — has no
 * writer anywhere, and a structural test asserts that.
 *
 * NOT A DELETION. There is no purge here and no storage call at all: purge is out of MEDIA-1's scope
 * and the storage port has no delete verb.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { mediaAssets } from "@/db/schema/media-asset";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { isUuid } from "./contracts";
import { resolveMediaDbOrNull } from "./media-db.server";

export type RetireMediaAssetResult =
  | { readonly status: "retired"; readonly assetId: string }
  | {
      readonly status: "refused";
      readonly reason: "unauthenticated" | "asset-not-found" | "persistence-unavailable";
    };

export async function retireMediaAsset(
  tenant: TenantContext | null,
  input: { readonly assetId: string } | null,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null; readonly now?: () => Date } = {},
): Promise<RetireMediaAssetResult> {
  if (typeof window !== "undefined") {
    throw new Error("Media asset retirement is server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return { status: "refused", reason: "unauthenticated" };
  if (!isUuid(input?.assetId)) return { status: "refused", reason: "asset-not-found" };

  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return { status: "refused", reason: "persistence-unavailable" };
  const now = (deps.now ?? (() => new Date()))();

  try {
    const rows = await db
      .update(mediaAssets)
      .set({ assetLifecycleStatus: "retired", retiredAt: now, retiredByActorId: tenant.userId })
      .where(
        and(
          eq(mediaAssets.tenantId, tenant.tenantId),
          eq(mediaAssets.id, input.assetId),
          eq(mediaAssets.assetLifecycleStatus, "admitted"),
        ),
      )
      .returning({ id: mediaAssets.id });
    const retired = rows[0]?.id;
    return retired
      ? { status: "retired", assetId: retired }
      : { status: "refused", reason: "asset-not-found" };
  } catch {
    return { status: "refused", reason: "persistence-unavailable" };
  }
}
