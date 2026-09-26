/*
 * provider-google/relay-drive-video.server.ts — ONE DRIVE VIDEO, RELAYED AS A STREAM (MV-3).
 *
 * The video sibling of `read-drive-image.server.ts`, behind the SAME gate:
 *
 *   tenant context → the per-file capability (`drive.file`, Picker-chosen files only) → the
 *   integration authority's availability view → a Google connection THIS tenant owns → the released
 *   token runner → one metadata-first download whose body is handed to `consume` as a stream
 *
 * The Google token lives only inside the token runner's callback and is sent only to Google. `consume`
 * — the Media authority's relay into the VPS store — sees bytes and Drive's claims, never the token.
 *
 *     PROVIDER READ != MEDIA ADMISSION
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { getCapabilityAvailability } from "@/features/integration-authority/capability-availability.server";
import {
  GOOGLE_DRIVE_FILE_CAPABILITY,
  GOOGLE_PROVIDER_KEY,
  type GoogleDriveVideoMeta,
  type GoogleFailureClass,
} from "./contracts";
import { relayDriveFileVideo } from "./google-transport.server";
import { withGoogleAccessToken, type GoogleAuthorizedCallDeps } from "./google-authorized-call.server";
import type { DriveImageRefusal } from "./read-drive-image.server";

export type DriveVideoResult<T> =
  | { readonly status: "relayed"; readonly value: T; readonly capability: typeof GOOGLE_DRIVE_FILE_CAPABILITY }
  | { readonly status: "refused"; readonly reason: DriveImageRefusal }
  | { readonly status: "provider-failed"; readonly failure: GoogleFailureClass; readonly reason: string };

export type DriveVideoConsumer<T> = (body: ReadableStream<Uint8Array>, meta: GoogleDriveVideoMeta) => Promise<T>;

export interface DriveVideoDeps extends GoogleAuthorizedCallDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

export async function relayDriveVideo<T>(
  tenant: TenantContext | null,
  input: { readonly fileId: string },
  consume: DriveVideoConsumer<T>,
  deps: DriveVideoDeps = {},
): Promise<DriveVideoResult<T>> {
  if (typeof window !== "undefined") throw new Error("Drive video relays are server-only.");
  const capability = GOOGLE_DRIVE_FILE_CAPABILITY;
  if (!tenant?.tenantId) return { status: "refused", reason: "no-authorized-tenant-context" };
  if (typeof input?.fileId !== "string" || input.fileId.trim().length === 0) {
    return { status: "refused", reason: "no-document-selected" };
  }

  /* THE GATE — before any credential is touched. Only the per-file capability is accepted. */
  const availability = await getCapabilityAvailability(tenant, { getDb: deps.getDb });
  const entry = availability.capabilities.find((c) => c.capability === capability);
  if (!entry || entry.state !== "available") return { status: "refused", reason: "capability-not-available" };
  const source = entry.sources.find((s) => s.readAvailable);
  if (!source) return { status: "refused", reason: "integration-not-found" };
  if (source.providerKey !== GOOGLE_PROVIDER_KEY) return { status: "refused", reason: "wrong-provider" };

  const outcome = await withGoogleAccessToken(
    tenant,
    source.integrationId,
    (token) => relayDriveFileVideo(token, input.fileId, consume, deps),
    deps,
  );
  if (!outcome.ok) return { status: "provider-failed", failure: outcome.failure, reason: outcome.reason };
  return { status: "relayed", value: outcome.value, capability };
}
