/*
 * provider-google/read-drive-image.server.ts — ONE DRIVE IMAGE, READ AS BYTES (MEDIA-SUPPLIED).
 *
 * The image sibling of KID-1's `readDriveContent`, and deliberately the same gate:
 *
 *   tenant context → the SIGNED Picker binding → EXACTLY the bound connection, re-checked for the
 *   per-file capability and its bound Google account (GOOGLE-DRIVE-PICKER-CONNECTION-INTEGRITY-1) →
 *   the released token runner → one metadata-first download
 *
 * There is no "first available connection": the file was chosen through one connection's token, and
 * its bytes are read through that connection or not at all.
 *
 * It does not widen KID-1. KID-1 still reads only text types; this seam reads only the closed image
 * types, and ONLY under the PER-FILE capability (`drive.file`): the file must be one the human handed
 * to Hebun through the Google Picker. The Drive-wide `drive.readonly` capability is deliberately NOT
 * accepted here — the production-accepted least-privilege model is Picker + `drive.file`, and a
 * pasted link under a Drive-wide grant is exactly what it replaced. No new scope, no new consent.
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
import {
  GOOGLE_DRIVE_FILE_CAPABILITY,
  type GoogleDriveImage,
  type GoogleFailureClass,
} from "./contracts";
import { readDriveFileImage } from "./google-transport.server";
import { withGoogleAccessToken, type GoogleAuthorizedCallDeps } from "./google-authorized-call.server";
import { resolveBoundDriveFileConnection, type PickerBindingRefusal } from "./picker-connection-binding.server";

export type DriveImageRefusal =
  | "no-authorized-tenant-context"
  | "no-document-selected"
  /** GOOGLE-DRIVE-PICKER-CONNECTION-INTEGRITY-1 — the binding, or its connection or account, failed. */
  | PickerBindingRefusal;

export type DriveImageResult =
  | {
      readonly status: "read";
      readonly image: GoogleDriveImage;
      readonly capability: typeof GOOGLE_DRIVE_FILE_CAPABILITY;
      /** SUPPLIED-MEDIA-ACCOUNT-PROVENANCE-1 — the bound connection the read ACTUALLY ran under. */
      readonly integrationId: string;
    }
  | { readonly status: "refused"; readonly reason: DriveImageRefusal }
  | { readonly status: "provider-failed"; readonly failure: GoogleFailureClass; readonly reason: string };

export interface DriveImageDeps extends GoogleAuthorizedCallDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly nowSeconds?: () => number;
}

/**
 * Read ONE Drive image for the session's tenant, through EXACTLY the connection the Picker session was
 * bound to. The caller hands back the file id and the binding it received — no capability, scope or
 * connection of its own. The capability used is returned so provenance records it from the read.
 */
export async function readDriveImage(
  tenant: TenantContext | null,
  input: { readonly fileId: string; readonly binding: string },
  deps: DriveImageDeps = {},
): Promise<DriveImageResult> {
  if (typeof window !== "undefined") throw new Error("Drive image reads are server-only.");

  const capability = GOOGLE_DRIVE_FILE_CAPABILITY;
  if (!tenant?.tenantId) return { status: "refused", reason: "no-authorized-tenant-context" };
  if (typeof input?.fileId !== "string" || input.fileId.trim().length === 0) {
    return { status: "refused", reason: "no-document-selected" };
  }

  /* THE GATE — before any credential is touched: the bound connection, and only it. */
  const bound = await resolveBoundDriveFileConnection(tenant, input.binding, deps);
  if (bound.status !== "bound") return { status: "refused", reason: bound.reason };

  const outcome = await withGoogleAccessToken(
    tenant,
    bound.integrationId,
    async (token) => {
      const result = await readDriveFileImage(token, input.fileId, deps);
      if (!result.ok) return result;
      return { ok: true as const, value: result.image };
    },
    deps,
  );
  if (!outcome.ok) return { status: "provider-failed", failure: outcome.failure, reason: outcome.reason };
  return { status: "read", image: outcome.value, capability, integrationId: bound.integrationId };
}
