"use server";

/*
 * TEMPORARY — DRIVE-FILE-FOLDER-PROBE-1. Removed after the probe.
 *
 * Two doors: open a folder-only Google Picker through the RELEASED Media Picker ceremony (same per-file
 * `drive.file` capability, same connection, same signed binding), and run the read-only probe through
 * exactly the connection that binding names. Tenant from the trusted session; nothing from input can
 * name a tenant, connection, account or scope.
 */
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { authorizeMediaPickerSession, type PickerSessionResult } from "@/features/provider-content-admission/authorize-picker-session.server";
import { runDriveFolderProbe, type DriveFolderProbeResult } from "@/features/provider-google/drive-file-folder-probe.server";

export async function authorizeDriveFolderProbeSessionAction(): Promise<PickerSessionResult> {
  return authorizeMediaPickerSession(await resolveTenantContext());
}

export async function runDriveFolderProbeAction(input: {
  step: "baseline" | "later";
  binding: string;
  folderId: string;
  startPageToken?: string;
  outsideFileId?: string | null;
}): Promise<DriveFolderProbeResult> {
  const i = (input ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return runDriveFolderProbe(
    await resolveTenantContext(),
    i.step === "later"
      ? { step: "later", binding: str(i.binding), folderId: str(i.folderId), startPageToken: str(i.startPageToken), outsideFileId: str(i.outsideFileId) || null }
      : { step: "baseline", binding: str(i.binding), folderId: str(i.folderId) },
  );
}
