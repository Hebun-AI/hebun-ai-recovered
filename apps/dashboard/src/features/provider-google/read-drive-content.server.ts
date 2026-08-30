/*
 * provider-google/read-drive-content.server.ts — HEBUN'S FIRST REAL PROVIDER CONTENT READ (KID-1).
 *
 * ── THE DISTINCTION THIS FILE EXISTS TO KEEP ─────────────────────────────────
 *
 * INT-3 proved: a credential existing is not a connection.
 * INT-4 proved: a connection is not a data capability.
 * KID-1 must preserve the next one: reading a document is not admitting it.
 *
 *     PROVIDER READ != KNOWLEDGE        CONTENT READ != KNOWLEDGE ADMISSION
 *     AUTHORIZED READ != PERSISTENCE    CONTENT != INSTRUCTION
 *
 * This seam returns bytes-as-text to a server-side caller and stops. It imports no Knowledge
 * writer, no ingestion path, no external-reference authority and no canonical table — a firewall
 * test asserts that absence, which is what makes "KID-1 cannot persist organizational truth" a
 * mechanical fact rather than a promise.
 *
 * ── IT IS A SECOND CAPABILITY, NOT A WIDER FIRST ONE ─────────────────────────
 *
 * `google.drive.metadata.read` still means exactly what INT-4 made it mean. This gate asks for
 * `google.drive.content.read` and nothing else, so a tenant who granted only the metadata scope is
 * refused here with a reason that says the grant is short — and their metadata reads keep working.
 *
 * ── IT ASKS THE AUTHORITY; IT DOES NOT DECIDE ────────────────────────────────
 *
 * There is no scope comparison in this file, for INT-4's reason: `getCapabilityAvailability` owns
 * the mapping and the provider catalog owns which scopes a capability needs. A second opinion here
 * would be the two-interpreters bug one layer down.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { getCapabilityAvailability } from "@/features/integration-authority/capability-availability.server";
import {
  GOOGLE_DRIVE_CONTENT_CAPABILITIES,
  GOOGLE_DRIVE_CONTENT_CAPABILITY,
  type GoogleDriveContent,
  type GoogleFailureClass,
} from "./contracts";
import { readDriveFileContent } from "./google-transport.server";
import {
  withGoogleAccessToken,
  type GoogleAuthorizedCallDeps,
} from "./google-authorized-call.server";

/**
 * Why a content read did not happen.
 *
 * `capability-not-available` is deliberately the same word INT-4 chose, and for the same reason: a
 * missing grant is not a failure, and a surface should be able to offer the consent that fixes it
 * rather than an error nobody can act on. Here it will be the COMMON case for some time, because
 * the content scope is a separate consent from the metadata one.
 */
export type DriveContentRefusal =
  | "no-authorized-tenant-context"
  | "no-document-selected"
  | "capability-not-available"
  | "integration-not-found"
  | "wrong-provider"
  /**
   * The caller named a capability that is not a Drive content capability.
   *
   * It exists because this seam now serves TWO permission models — KID-1's Drive-wide grant and the
   * least-privilege per-file grant — and the choice between them must be a closed one. A caller
   * naming anything else is refused rather than defaulted, because defaulting would silently
   * perform the read under the wider of the two.
   */
  | "unknown-capability";

export type DriveContentResult =
  | { readonly status: "read"; readonly content: GoogleDriveContent }
  | { readonly status: "refused"; readonly reason: DriveContentRefusal; readonly detail: string }
  | {
      readonly status: "provider-failed";
      readonly failure: GoogleFailureClass;
      readonly reason: string;
    };

export interface DriveContentDeps extends GoogleAuthorizedCallDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Drive content reads are server-only.");
  }
}

/**
 * Read ONE selected Google Drive document's content.
 *
 * The tenant comes from an already-resolved server-side context. Nothing here accepts a tenant id
 * or an integration id — the connection is DISCOVERED from the tenant's own availability view, so
 * naming another tenant's connection is not refused here, it is unrepresentable.
 *
 * The caller chooses exactly one thing: which document. It chooses no scope, no export format, no
 * MIME type and no size bound.
 */
export async function readDriveContent(
  tenant: TenantContext | null,
  input: { readonly fileId: string; readonly capability?: string },
  deps: DriveContentDeps = {},
): Promise<DriveContentResult> {
  assertServerOnly();

  /*
   * ── WHICH PERMISSION IS THIS READ PERFORMED UNDER ──────────────────────────
   *
   * A CAPABILITY KEY, never a scope, and from a CLOSED set — the authorization route's own rule,
   * applied one layer in. A caller can choose between the two content permissions this repository
   * has; it cannot invent a third, and it cannot name a scope.
   *
   * The default is KID-1's capability, so every released caller means exactly what it meant. The
   * per-file caller passes its own key explicitly, which is what makes the provenance honest: the
   * capability recorded against an admitted document is the one the read actually used.
   */
  const capability = input?.capability ?? GOOGLE_DRIVE_CONTENT_CAPABILITY;
  if (!GOOGLE_DRIVE_CONTENT_CAPABILITIES.includes(capability)) {
    return {
      status: "refused",
      reason: "unknown-capability",
      detail: "That is not a Google Drive content capability, so no document was read.",
    };
  }

  if (!tenant?.tenantId) {
    return {
      status: "refused",
      reason: "no-authorized-tenant-context",
      detail: "No organization is resolved for this request, so no connection could be consulted.",
    };
  }
  if (typeof input?.fileId !== "string" || input.fileId.trim().length === 0) {
    return {
      status: "refused",
      reason: "no-document-selected",
      detail: "A document must be selected before its content can be read.",
    };
  }

  /*
   * ── THE GATE. BEFORE ANY CREDENTIAL IS TOUCHED. ────────────────────────────
   *
   * The availability view is per-tenant and derived from the tenant's own connections, so the
   * source it names is one this tenant owns.
   */
  const availability = await getCapabilityAvailability(tenant, { getDb: deps.getDb });
  const entry = availability.capabilities.find((c) => c.capability === capability);

  if (!entry || entry.state !== "available") {
    return {
      status: "refused",
      reason: "capability-not-available",
      detail:
        entry?.reason ??
        "Google Drive content access is not available for this organization right now.",
    };
  }

  const source = entry.sources.find((s) => s.readAvailable);
  if (!source) {
    return {
      status: "refused",
      reason: "integration-not-found",
      detail: "No connection in this organization can currently answer this capability.",
    };
  }

  /* Defence in depth, exactly as INT-4 does it: one comparison makes the binding mechanical. */
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
      const result = await readDriveFileContent(accessToken, input.fileId, deps);
      if (!result.ok) return result;
      return { ok: true as const, value: result.content };
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

  return { status: "read", content: outcome.value };
}
