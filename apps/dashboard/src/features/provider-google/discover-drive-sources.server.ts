/*
 * provider-google/discover-drive-sources.server.ts — WHAT EXISTS IN A CONNECTED DRIVE.
 *
 * ── WHY THIS LIVES ON THE PROVIDER SIDE ──────────────────────────────────────
 *
 * The obvious home for "which documents could become Knowledge" is the Knowledge feature, and it is
 * FORBIDDEN. I1's released firewall collects every file under `src/features/knowledge` and asserts
 * that none references `integration-authority`, `provider-catalog` or the integrations schema:
 * "Governance and Knowledge must not own, read or write tenant connections." A Knowledge module
 * that read capability state would become a second interpreter of connection truth, which is the
 * defect class that firewall exists to prevent. It was attempted, it failed that suite, and the
 * firewall was left intact.
 *
 * So ownership inverts: the PROVIDER subsystem answers the question, and the Knowledge workspace
 * page — already a composition point that resolves two distinct authorities without deriving
 * either from the other — renders the answer. Knowledge asks. The provider answers. Neither
 * becomes the other.
 *
 * ── DISCOVERED IS NOT IMPORTED ───────────────────────────────────────────────
 *
 * Everything returned here is provider-derived and lives for the length of one request. This module
 * imports no writer, no repository and no Knowledge module, so it cannot persist, index, embed or
 * admit anything — not by policy, by absence of a code path.
 *
 * ── IT ADDS NO AUTHORITY ─────────────────────────────────────────────────────
 *
 * No endpoint, no `fetch`, no credential, no vault, no OAuth, no catalog opinion. It consults the
 * capability authority and calls `readDriveMetadata`, both released, and does nothing else. The
 * bounded request, the capability gate and the credential authority all stay where they already are.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { getCapabilityAvailability } from "@/features/integration-authority/capability-availability.server";
import { GOOGLE_DRIVE_METADATA_CAPABILITY } from "./contracts";
import { readDriveMetadata, type DriveMetadataDeps } from "./read-drive-metadata.server";

/** The providers this projection can discover from today. Named, never inferred. */
export type ExternalSourceProvider = "google-drive";

/**
 * ONE DOCUMENT THAT EXISTS SOMEWHERE ELSE — a CANDIDATE, not a record.
 *
 * Every field is metadata the provider already returned under `drive.metadata.readonly`. There is
 * deliberately no content, no download link, no export link, no permission, no owner and no sharing
 * state: the granted scope cannot produce them, and a shape with a hole for them invites somebody
 * to fill it.
 */
export interface ExternalSourceCandidate {
  readonly provider: ExternalSourceProvider;
  /** The PROVIDER'S identifier. Provider-derived — it carries no Hebun authority of any kind. */
  readonly externalId: string;
  readonly name: string;
  readonly mimeType: string;
  readonly modifiedAt: string | null;
  readonly sizeBytes: number | null;
  readonly trashed: boolean;
}

/**
 * Six outcomes, and they stay six.
 *
 * `empty` and `unavailable` are separate arms because an organization whose Drive holds nothing and
 * one that never granted Drive access are not in the same situation, and a single empty list
 * rendering both would be a third, false answer. `provider-failed` is separate for the same reason:
 * a provider that did not answer has not told us there is nothing there.
 *
 * WHY `unavailable` CARRIES THE AUTHORITY'S OWN WORDS. The capability authority already
 * distinguishes "no connection", "the grant does not cover this" and "the provider is not
 * responding", and it states which in its `reason`. Re-deriving that split here — by comparing
 * granted scopes to required scopes myself — would be a SECOND capability interpretation, the one
 * thing this design may not add. So the verdict is quoted, never recomputed.
 */
export type DriveSourceDiscovery =
  | { readonly status: "unauthenticated" }
  | {
      readonly status: "unavailable";
      /** `not-connected` | `degraded` | `revoked` | … — the authority's own state, verbatim. */
      readonly capabilityState: string;
      readonly reason: string;
    }
  | { readonly status: "provider-failed"; readonly failure: string; readonly reason: string }
  | { readonly status: "empty" }
  | { readonly status: "discovered"; readonly candidates: readonly ExternalSourceCandidate[] };

/** Discover the source candidates a connected Google Drive currently exposes. Reads only. */
export async function discoverDriveSources(
  tenant: TenantContext | null,
  deps: DriveMetadataDeps = {},
): Promise<DriveSourceDiscovery> {
  if (!tenant?.tenantId) return { status: "unauthenticated" };

  const availability = await getCapabilityAvailability(tenant, { getDb: deps.getDb });
  const entry = availability.capabilities.find(
    (c) => c.capability === GOOGLE_DRIVE_METADATA_CAPABILITY,
  );

  if (!entry || entry.state !== "available") {
    return {
      status: "unavailable",
      capabilityState: entry?.state ?? "not-connected",
      reason:
        entry?.reason ??
        "No connection to a provider offering document discovery exists for this organization.",
    };
  }

  const result = await readDriveMetadata(tenant, {}, deps);

  if (result.status === "provider-failed") {
    return { status: "provider-failed", failure: result.failure, reason: result.reason };
  }
  if (result.status === "refused") {
    /*
     * The capability read as available a moment ago and the seam refused anyway — a race, or a
     * disagreement between two reads. Reported as unavailable with the seam's own reason, never as
     * an empty list.
     */
    return { status: "unavailable", capabilityState: "unavailable", reason: result.detail };
  }

  const candidates = result.listing.files.map((file) => ({
    provider: "google-drive" as const,
    externalId: file.fileId,
    name: file.name,
    mimeType: file.mimeType,
    modifiedAt: file.modifiedAt,
    sizeBytes: file.sizeBytes,
    trashed: file.trashed,
  }));

  return candidates.length === 0 ? { status: "empty" } : { status: "discovered", candidates };
}
