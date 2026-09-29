/*
 * media-assets/supplied-drive-refusal.ts — how a refused Drive read is named by the supplied-media
 * admissions (image and video alike). Pure; one mapping, so the two paths cannot drift.
 *
 * GOOGLE-DRIVE-PICKER-CONNECTION-INTEGRITY-1: the read runs only through the connection the Picker
 * session was bound to. The bound connection no longer reading the per-file capability is
 * `drive-capability-not-available`; a missing, forged, expired or foreign binding, or a changed
 * account, is `drive-connection-not-bound`; anything else is `drive-read-failed`.
 */
import type { DriveImageRefusal } from "@/features/provider-google/read-drive-image.server";

export function driveRefusal(
  reason: DriveImageRefusal,
): "drive-capability-not-available" | "drive-connection-not-bound" | "drive-read-failed" {
  if (reason === "bound-connection-unavailable") return "drive-capability-not-available";
  if (reason === "bound-account-mismatch" || reason.startsWith("binding-")) return "drive-connection-not-bound";
  return "drive-read-failed";
}
