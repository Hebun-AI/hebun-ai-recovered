/*
 * provider-google/read-drive-metadata.server.ts — HEBUN'S FIRST REAL PROVIDER DATA READ.
 *
 * ── THE DISTINCTION THIS FILE EXISTS TO KEEP ─────────────────────────────────
 *
 * INT-3 proved: a credential existing is not a connection.
 * INT-4 must preserve the next one: a connection is not a data capability.
 *
 * So this seam refuses BEFORE it spends anything unless the availability seam — not this module —
 * says the capability is `available`. That check consults the lifecycle, the health AND the scopes
 * Google actually granted. A connected, healthy Google account with identity-only scopes is
 * refused here, and the reason says the grant is short rather than that something is broken.
 *
 * ── IT ASKS THE AUTHORITY; IT DOES NOT DECIDE ────────────────────────────────
 *
 * There is no scope comparison in this file. `getCapabilityAvailability` owns the mapping, the
 * provider catalog owns which scopes a capability needs, and a second opinion here would be the
 * two-interpreters bug one layer down. This module reads a verdict and honours it.
 *
 * ── WHAT IT CANNOT DO ────────────────────────────────────────────────────────
 *
 * It writes no connection lifecycle, so a Drive read can never end a tenant's grant — a 429 or a
 * 503 comes back as a classified failure and the connection is untouched. It holds no Knowledge
 * writer, so nothing it reads can become an organizational fact by accident. It never sees a
 * plaintext token: the credential is spent inside `withGoogleAccessToken`'s callback.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { getCapabilityAvailability } from "@/features/integration-authority/capability-availability.server";
import {
  GOOGLE_DRIVE_METADATA_CAPABILITY,
  type GoogleDriveListing,
  type GoogleFailureClass,
} from "./contracts";
import { listDriveFiles } from "./google-transport.server";
import {
  withGoogleAccessToken,
  type GoogleAuthorizedCallDeps,
} from "./google-authorized-call.server";

/**
 * Why a Drive read did not happen.
 *
 * `capability-not-available` is the ONE that is not a failure at all: the tenant simply has not
 * granted the scope. It is separated from every provider outcome so a surface can offer the
 * re-consent that fixes it, instead of showing an error nobody can act on.
 */
export type DriveReadRefusal =
  | "no-authorized-tenant-context"
  | "capability-not-available"
  | "integration-not-found"
  | "wrong-provider";

export type DriveMetadataResult =
  | { readonly status: "read"; readonly listing: GoogleDriveListing }
  | { readonly status: "refused"; readonly reason: DriveReadRefusal; readonly detail: string }
  | {
      readonly status: "provider-failed";
      readonly failure: GoogleFailureClass;
      readonly reason: string;
    };

export interface DriveMetadataDeps extends GoogleAuthorizedCallDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Drive metadata reads are server-only.");
  }
}

/**
 * Read one bounded page of this tenant's Google Drive file metadata.
 *
 * The tenant comes from an already-resolved server-side context. Nothing here accepts a tenant id,
 * and nothing derives one from a Google response, an email address or a hosted domain — the
 * account Google names is a LABEL, never an authority.
 */
export async function readDriveMetadata(
  tenant: TenantContext | null,
  options: { readonly pageToken?: string | null } = {},
  deps: DriveMetadataDeps = {},
): Promise<DriveMetadataResult> {
  assertServerOnly();

  if (!tenant?.tenantId) {
    return {
      status: "refused",
      reason: "no-authorized-tenant-context",
      detail: "No organization is resolved for this request, so no connection could be consulted.",
    };
  }

  /*
   * ── THE GATE. BEFORE ANY CREDENTIAL IS TOUCHED. ────────────────────────────
   *
   * The availability view is per-tenant and derived from the tenant's own connections, so the
   * source it names below is one this tenant owns. A caller cannot smuggle another tenant's
   * integration in, because no integration id is accepted as input at all — it is discovered here.
   */
  const availability = await getCapabilityAvailability(tenant, { getDb: deps.getDb });
  const entry = availability.capabilities.find(
    (c) => c.capability === GOOGLE_DRIVE_METADATA_CAPABILITY,
  );

  if (!entry || entry.state !== "available") {
    return {
      status: "refused",
      reason: "capability-not-available",
      detail:
        entry?.reason ??
        "Google Drive metadata access is not available for this organization right now.",
    };
  }

  /*
   * `readAvailable` is the per-source restatement of the same three conditions. A source inside an
   * `available` capability that does not itself report `readAvailable` would be the contradiction
   * the availability contract forbids; taking the first one that does is defence in depth, not a
   * second opinion.
   */
  const source = entry.sources.find((s) => s.readAvailable);
  if (!source) {
    return {
      status: "refused",
      reason: "integration-not-found",
      detail: "No connection in this organization can currently answer this capability.",
    };
  }

  /*
   * The capability is only mapped by the Google definition, so a source reaching here is Google's.
   * Asserting it anyway costs one comparison and makes "the Drive seam only ever runs against a
   * Google connection" a mechanical fact rather than a consequence of catalog authoring.
   */
  if (source.providerKey !== "google-workspace") {
    return {
      status: "refused",
      reason: "wrong-provider",
      detail: "The Google Drive seam refuses any connection that is not a Google connection.",
    };
  }

  const outcome = await withGoogleAccessToken(
    tenant,
    source.integrationId,
    async (accessToken) => {
      const listed = await listDriveFiles(accessToken, { pageToken: options.pageToken }, deps);
      if (!listed.ok) return listed;
      return { ok: true as const, value: listed.listing };
    },
    deps,
  );

  if (!outcome.ok) {
    /*
     * A PROVIDER FAILURE, AND NOTHING MORE. No lifecycle write happens here and none can: this
     * module imports no connection writer. A Drive outage leaves the grant exactly as it was.
     */
    return { status: "provider-failed", failure: outcome.failure, reason: outcome.reason };
  }

  return { status: "read", listing: outcome.value };
}
