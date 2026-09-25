/*
 * provider-google/read-drive-image.server.ts — ONE DRIVE IMAGE, READ AS BYTES (MEDIA-SUPPLIED).
 *
 * The image sibling of KID-1's `readDriveContent`, and deliberately the same gate:
 *
 *   tenant context → closed capability key → the integration authority's availability view →
 *   a Google connection THIS tenant owns → the released token runner → one metadata-first download
 *
 * It does not widen KID-1. KID-1 still reads only text types; this seam reads only the closed image
 * types, and it answers the SAME two content capabilities (Drive-wide or per-file), because reading
 * an image's bytes is exactly what those grants already are. No new scope, no new consent.
 *
 *     PROVIDER READ != MEDIA ADMISSION
 *
 * What comes back is untrusted bytes and Drive's claims. This module writes nothing, imports no
 * Media writer and no Knowledge writer. Admission — verification from the bytes themselves,
 * storage, re-verification, provenance — belongs to the Media authority that calls it.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { getCapabilityAvailability } from "@/features/integration-authority/capability-availability.server";
import {
  GOOGLE_DRIVE_CONTENT_CAPABILITIES,
  GOOGLE_DRIVE_CONTENT_CAPABILITY,
  type GoogleDriveImage,
  type GoogleFailureClass,
} from "./contracts";
import { readDriveFileImage } from "./google-transport.server";
import { withGoogleAccessToken, type GoogleAuthorizedCallDeps } from "./google-authorized-call.server";

export type DriveImageRefusal =
  | "no-authorized-tenant-context"
  | "no-document-selected"
  | "capability-not-available"
  | "integration-not-found"
  | "wrong-provider"
  | "unknown-capability";

export type DriveImageResult =
  | { readonly status: "read"; readonly image: GoogleDriveImage; readonly capability: string }
  | { readonly status: "refused"; readonly reason: DriveImageRefusal }
  | { readonly status: "provider-failed"; readonly failure: GoogleFailureClass; readonly reason: string };

export interface DriveImageDeps extends GoogleAuthorizedCallDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

/**
 * Read ONE Drive image for the session's tenant. The caller chooses the file and, from a closed
 * set, which content capability the read is performed under — never a scope, never a connection.
 * The capability actually used is returned so provenance can record it honestly.
 */
export async function readDriveImage(
  tenant: TenantContext | null,
  input: { readonly fileId: string; readonly capability?: string },
  deps: DriveImageDeps = {},
): Promise<DriveImageResult> {
  if (typeof window !== "undefined") throw new Error("Drive image reads are server-only.");

  const capability = input?.capability ?? GOOGLE_DRIVE_CONTENT_CAPABILITY;
  if (!GOOGLE_DRIVE_CONTENT_CAPABILITIES.includes(capability)) {
    return { status: "refused", reason: "unknown-capability" };
  }
  if (!tenant?.tenantId) return { status: "refused", reason: "no-authorized-tenant-context" };
  if (typeof input?.fileId !== "string" || input.fileId.trim().length === 0) {
    return { status: "refused", reason: "no-document-selected" };
  }

  /* THE GATE — before any credential is touched. The view is this tenant's own. */
  const availability = await getCapabilityAvailability(tenant, { getDb: deps.getDb });
  const entry = availability.capabilities.find((c) => c.capability === capability);
  if (!entry || entry.state !== "available") return { status: "refused", reason: "capability-not-available" };
  const source = entry.sources.find((s) => s.readAvailable);
  if (!source) return { status: "refused", reason: "integration-not-found" };
  if (source.providerKey !== "google-workspace") return { status: "refused", reason: "wrong-provider" };

  const outcome = await withGoogleAccessToken(
    tenant,
    source.integrationId,
    async (token) => {
      const result = await readDriveFileImage(token, input.fileId, deps);
      if (!result.ok) return result;
      return { ok: true as const, value: result.image };
    },
    deps,
  );
  if (!outcome.ok) return { status: "provider-failed", failure: outcome.failure, reason: outcome.reason };
  return { status: "read", image: outcome.value, capability };
}
