/*
 * media-assets/read-supplied-source-provenance.server.ts — WHICH GOOGLE CONNECTION, AND WHICH ACCOUNT,
 * SUPPLIED THIS ASSET? (SUPPLIED-MEDIA-ACCOUNT-PROVENANCE-1)
 *
 * An INTERNAL / operator read. It is not wired into the Media gallery, Content Composition or Heby:
 * a Google account identifier is not something every surface should carry, and nothing there needs it.
 *
 * Two authorities, each asked only its own question:
 *
 *   Media        which connection the admission recorded (`supplied_source_integration_id`)
 *   Integration  which Google account that connection is bound to (`readConnection`)
 *
 * The account is read from the connection, not copied onto the asset: the Integration authority keeps
 * a connection's account write-once (its only writer refuses a change, a reconnect is a NEW row, a
 * terminal row keeps its account and no path deletes one), so following the reference years later
 * gives the same account the admission verified. The connection's CURRENT state is returned beside it
 * and labelled as current — it says nothing about the admission.
 *
 *   recorded     the admission named a connection
 *   unknown      a supplied asset admitted before the connection was recorded — NOT "no account"
 *   not-supplied a generated or derived asset: it has no Drive source at all
 *   not-found    no such asset in THIS tenant (another tenant's is indistinguishable from none)
 *
 * Server-only. Reads only; returns no token, credential, binding or URL.
 */
import { and, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { mediaAssets } from "@/db/schema/media-asset";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { readConnection } from "@/features/integration-authority/integration-read.server";
import { isUuid } from "./contracts";
import { resolveMediaDbOrNull } from "./media-db.server";

export type SuppliedSourceProvenance =
  | {
      readonly status: "recorded";
      readonly integrationId: string;
      /** Integration authority's answer. Null only if the connection row is unreadable right now. */
      readonly providerKey: string | null;
      readonly externalAccountId: string | null;
      /** The connection TODAY. Not a statement about the admission. */
      readonly currentConnectionState: string | null;
    }
  | { readonly status: "unknown" }
  | { readonly status: "not-supplied" }
  | { readonly status: "not-found" }
  | { readonly status: "unavailable" };

export async function readSuppliedSourceProvenance(
  tenant: Pick<TenantContext, "tenantId"> | null,
  assetId: string,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null } = {},
): Promise<SuppliedSourceProvenance> {
  if (typeof window !== "undefined") throw new Error("Supplied provenance reads are server-only.");
  if (!tenant?.tenantId || !isUuid(assetId)) return { status: "not-found" };
  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return { status: "unavailable" };
  let row: { readonly suppliedSource: string | null; readonly integrationId: string | null } | undefined;
  try {
    row = (
      await db
        .select({ suppliedSource: mediaAssets.suppliedSource, integrationId: mediaAssets.suppliedSourceIntegrationId })
        .from(mediaAssets)
        .where(and(eq(mediaAssets.tenantId, tenant.tenantId), eq(mediaAssets.id, assetId.toLowerCase())))
        .limit(1)
    )[0];
  } catch {
    return { status: "unavailable" };
  }
  if (!row) return { status: "not-found" };
  if (row.suppliedSource === null) return { status: "not-supplied" };
  if (row.integrationId === null) return { status: "unknown" };
  const connection = await readConnection(tenant, row.integrationId, { getDb: () => db });
  return {
    status: "recorded",
    integrationId: row.integrationId,
    providerKey: connection?.providerKey ?? null,
    externalAccountId: connection?.externalAccountId ?? null,
    currentConnectionState: connection?.connectionState ?? null,
  };
}
