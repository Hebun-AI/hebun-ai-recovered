/*
 * media-assets/media-db.server.ts — the control-plane database handle this authority uses (MEDIA-1).
 *
 * No `DATABASE_URL`, or a handle that cannot be built, is `null` — every caller turns that into its
 * own `persistence-unavailable`, never into an empty answer.
 *
 * Server-only.
 */
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";

export function resolveMediaDbOrNull(): ControlPlaneDatabase | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}
