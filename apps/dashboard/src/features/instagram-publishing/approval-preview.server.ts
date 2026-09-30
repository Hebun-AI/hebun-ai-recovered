/*
 * instagram-publishing/approval-preview.server.ts — INSTAGRAM-APPROVAL-PREVIEW-1: "what exactly am I
 * authorizing Hebun to publish?", answered for one governed `publish-instagram-media` request.
 *
 * ── THE GOVERNED REQUEST IS THE SUBJECT ──────────────────────────────────────
 *
 * Every fact starts from the request's own frozen payload and is then READ through the authority
 * that owns it, and PROVEN against the payload's digest before it is shown:
 *
 *   caption      the Work Artifact revision the payload names (`draftRef`), exact — never the
 *                current one — and its bytes re-hashed to equal `draftRevisionDigest`
 *   image        the ORIGINAL the payload names (`mediaAssetRef`): its Media row's digest equals
 *                `mediaAssetDigest` and it belongs to the governed draft. Bytes are verified and a
 *                grant is minted ONLY when a human opens it (`openInstagramApprovalImage`), through
 *                the released `readMediaAsset` — the same on-demand rule `/operations` follows
 *   derivative   the `jpeg-publish-v1` lineage between the bound original and the bound derivative,
 *                checked in the database only — no grant, no bytes
 *   account      the bound connection, from the integration authority; no token, no provider call
 *   readiness    CURRENT context from the Content Package verifier — beside the request, never
 *                substituted for it. It decides nothing here; execution enforces it.
 *   acknowledgement
 *                the prior attempt the payload names, as the action ledger recorded it
 *
 * A fact that cannot be proven is UNAVAILABLE or a MISMATCH — never replaced with the workspace's
 * current copy or current selection, and never collapsed into "none".
 *
 * ── WHY IT LIVES HERE AND NOT IN ACTION AUTHORIZATION ────────────────────────
 *
 * The R3W firewall forbids `action-authorization` from depending on the Work Artifact feature, and
 * its pending-request reader resolves no reference by design. The owner of this kind's payload
 * contract is this feature; `youtube-publishing/read-youtube-upload.server.ts` is the precedent for
 * a kind reading its own request row, tenant-predicated, through its own payload parser.
 *
 * READ ONLY. No insert, update, delete or transaction; no decision, permit, execution or provider.
 *
 * Server-only.
 */
import { and, desc, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { hebyActionRequests } from "@/db/schema/action-authorization";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { readContentPublicationState } from "@/features/action-authorization/content-publication-state.server";
import type { ContentPackageBlocker } from "@/features/content-composition/contracts";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import { listConnections } from "@/features/integration-authority/integration-repository.server";
import type { MediaStorageResolution } from "@/features/media-assets/media-object-store";
import { readMediaAsset, selectMediaAssetRecord } from "@/features/media-assets/read-media-assets.server";
import { selectPublishLineage, type PublishLineageFailure } from "@/features/media-assets/read-publish-derivative.server";
import { contentDigestsMatch, digestArtifactContent } from "@/features/work-artifacts/content-digest";
import { parseWorkArtifactRef } from "@/features/work-artifacts/artifact-ref";
import { resolveWorkArtifactReference } from "@/features/work-artifacts/read-work-artifacts.server";
import { PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND, asPublishInstagramMediaPayload } from "./contracts";
import { verifyInstagramPackageReadiness, type InstagramPackageFailure } from "./verify-instagram-package.server";

export type GovernedCaption =
  | { readonly status: "verified"; readonly text: string; readonly revisionStanding: "current" | "superseded" | "retired" }
  /** The governed revision exists but its bytes do not hash to the payload's digest. No text is shown. */
  | { readonly status: "digest-mismatch" }
  | { readonly status: "unavailable" };

export type GovernedImage =
  | {
      /** The Media row IS the bound original: same digest, same draft. Bytes are re-verified on open. */
      readonly status: "bound";
      readonly mimeType: string;
      readonly width: number;
      readonly height: number;
      readonly lifecycle: string;
      readonly origin: "generated" | "supplied";
    }
  | { readonly status: "digest-mismatch" }
  | { readonly status: "not-of-governed-draft" }
  | { readonly status: "unavailable" };

export type GovernedDerivative =
  | { readonly status: "lineage-verified" }
  | { readonly status: "lineage-refused"; readonly reason: PublishLineageFailure }
  | { readonly status: "unavailable" };

export type GovernedAccount =
  | { readonly status: "bound-connection"; readonly label: string | null }
  /** The bound connection now answers for a different account than the one the payload froze. */
  | { readonly status: "account-changed" }
  | { readonly status: "connection-not-found" }
  | { readonly status: "unavailable" };

export type CurrentReadiness =
  | { readonly status: "ready" }
  | { readonly status: "not-ready"; readonly failure: Exclude<InstagramPackageFailure, "persistence-unavailable">; readonly blockers: readonly ContentPackageBlocker[] }
  | { readonly status: "unavailable" };

export type AcknowledgementContext =
  | { readonly status: "none-in-payload" }
  | {
      readonly status: "recorded";
      readonly attemptId: string;
      readonly attemptStatus: string;
      readonly providerResultId: string | null;
    }
  /** The ledger was read and holds no attempt with that id for this revision. */
  | { readonly status: "not-found"; readonly attemptId: string }
  | { readonly status: "unknown"; readonly attemptId: string };

export interface InstagramApprovalPreview {
  readonly requestId: string;
  readonly requestStatus: string;
  readonly governed: {
    readonly draftRef: string;
    readonly revisionNo: number;
    readonly originalAssetId: string;
    readonly publishAssetId: string;
    readonly externalAccountId: string;
  };
  readonly caption: GovernedCaption;
  readonly image: GovernedImage;
  readonly derivative: GovernedDerivative;
  readonly account: GovernedAccount;
  readonly readiness: CurrentReadiness;
  readonly acknowledgement: AcknowledgementContext;
}

export type InstagramApprovalPreviewResult =
  | { readonly status: "read"; readonly preview: InstagramApprovalPreview }
  /** No such Instagram publication request in this tenant (foreign and absent are one answer). */
  | { readonly status: "not-found" }
  /** The stored payload does not parse as this kind's contract. Nothing is resolved from it. */
  | { readonly status: "payload-unreadable" }
  | { readonly status: "unavailable" };

export interface InstagramApprovalPreviewDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly resolveStorage?: () => MediaStorageResolution;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface RequestRow {
  readonly id: string;
  readonly status: string;
  readonly canonicalPayload: unknown;
}

async function selectRequests(
  db: ControlPlaneDatabase,
  tenantId: string,
  filter: { readonly requestId: string } | { readonly pending: true },
): Promise<readonly RequestRow[]> {
  return db
    .select({ id: hebyActionRequests.id, status: hebyActionRequests.status, canonicalPayload: hebyActionRequests.canonicalPayload })
    .from(hebyActionRequests)
    .where(
      and(
        eq(hebyActionRequests.tenantId, tenantId),
        eq(hebyActionRequests.actionKind, PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND),
        "requestId" in filter ? eq(hebyActionRequests.id, filter.requestId) : eq(hebyActionRequests.status, "pending"),
      ),
    )
    .orderBy(desc(hebyActionRequests.createdAt))
    .limit(50);
}

async function previewOf(
  tenant: TenantContext,
  db: ControlPlaneDatabase,
  row: RequestRow,
): Promise<InstagramApprovalPreviewResult> {
  const payload = asPublishInstagramMediaPayload(row.canonicalPayload);
  const ref = payload ? parseWorkArtifactRef(payload.draftRef) : null;
  if (!payload || !ref) return { status: "payload-unreadable" };
  const tenantId = tenant.tenantId!;
  const deps = { getDb: () => db };

  /* ── Caption: exactly the governed revision, and only if its bytes hash to the frozen digest. ── */
  let caption: GovernedCaption = { status: "unavailable" };
  try {
    const resolved = await resolveWorkArtifactReference(tenant, payload.draftRef, deps);
    if (resolved.readable && resolved.revision && resolved.revision.revisionNo === ref.revisionNo && resolved.revision.artifactId === ref.artifactId) {
      const proven =
        contentDigestsMatch(resolved.revision.contentDigest, payload.draftRevisionDigest) &&
        contentDigestsMatch(digestArtifactContent(resolved.revision.content), payload.draftRevisionDigest);
      caption = proven
        ? { status: "verified", text: resolved.revision.content, revisionStanding: resolved.standing as "current" | "superseded" | "retired" }
        : { status: "digest-mismatch" };
    }
  } catch {
    caption = { status: "unavailable" };
  }

  /* ── Image: the bound ORIGINAL's row, proven against the frozen digest and the governed draft. ── */
  let image: GovernedImage = { status: "unavailable" };
  try {
    const asset = await selectMediaAssetRecord(db, tenantId, payload.mediaAssetRef);
    if (asset) {
      if (asset.byteDigest !== payload.mediaAssetDigest) image = { status: "digest-mismatch" };
      else if (asset.sourceArtifactId !== ref.artifactId) image = { status: "not-of-governed-draft" };
      else image = { status: "bound", mimeType: asset.mimeType, width: asset.width, height: asset.height, lifecycle: asset.lifecycle, origin: asset.origin };
    }
  } catch {
    image = { status: "unavailable" };
  }

  /* ── Derivative: database lineage only. No grant, no bytes. ── */
  let derivative: GovernedDerivative = { status: "unavailable" };
  try {
    const lineage = await selectPublishLineage(db, tenantId, {
      originalAssetId: payload.mediaAssetRef,
      originalDigest: payload.mediaAssetDigest,
      derivedAssetId: payload.publishAssetRef,
      derivedDigest: payload.publishAssetDigest,
    });
    derivative = lineage.status === "verified" ? { status: "lineage-verified" } : { status: "lineage-refused", reason: lineage.reason };
  } catch {
    derivative = { status: "unavailable" };
  }

  /* ── Account: the bound connection as the integration authority records it. ── */
  let account: GovernedAccount = { status: "unavailable" };
  try {
    const listing = await listConnections(tenant, deps);
    if (listing.status === "read") {
      const connection = listing.connections.find((c) => c.integrationId === payload.integrationId);
      account = !connection
        ? { status: "connection-not-found" }
        : connection.externalAccountId !== payload.externalAccountId
          ? { status: "account-changed" }
          : { status: "bound-connection", label: connection.externalAccountLabel };
    }
  } catch {
    account = { status: "unavailable" };
  }

  /* ── Current readiness: context from the Content Package verifier, for the BOUND image. ── */
  let readiness: CurrentReadiness = { status: "unavailable" };
  try {
    const verdict = await verifyInstagramPackageReadiness(
      tenant,
      { artifactId: ref.artifactId, revisionNo: ref.revisionNo, mediaAssetId: payload.mediaAssetRef },
      deps,
    );
    if (verdict.ok) readiness = { status: "ready" };
    else if (verdict.failure !== "persistence-unavailable") {
      readiness = { status: "not-ready", failure: verdict.failure, blockers: verdict.blockers ?? [] };
    }
  } catch {
    readiness = { status: "unavailable" };
  }

  /* ── Acknowledgement: only when the payload carries one; the ledger's own record of it. ── */
  let acknowledgement: AcknowledgementContext = { status: "none-in-payload" };
  const ack = payload.acknowledgesPriorAttemptId ?? null;
  if (ack !== null) {
    acknowledgement = { status: "unknown", attemptId: ack };
    try {
      const state = await readContentPublicationState(tenant, { artifactId: ref.artifactId, revisionNo: ref.revisionNo }, deps);
      if (state.status === "no-request-recorded") acknowledgement = { status: "not-found", attemptId: ack };
      else if (state.status === "recorded") {
        const entry = state.entries.find((e) => e.attempt?.attemptId === ack);
        if (entry?.attempt) {
          acknowledgement = {
            status: "recorded",
            attemptId: ack,
            attemptStatus: entry.attempt.status,
            providerResultId: entry.attempt.providerResultId,
          };
        } else if (!state.truncated) {
          acknowledgement = { status: "not-found", attemptId: ack };
        }
      }
    } catch {
      acknowledgement = { status: "unknown", attemptId: ack };
    }
  }

  return {
    status: "read",
    preview: {
      requestId: row.id,
      requestStatus: row.status,
      governed: {
        draftRef: payload.draftRef,
        revisionNo: ref.revisionNo,
        originalAssetId: payload.mediaAssetRef,
        publishAssetId: payload.publishAssetRef,
        externalAccountId: payload.externalAccountId,
      },
      caption,
      image,
      derivative,
      account,
      readiness,
      acknowledgement,
    },
  };
}

/** One Instagram publication request of this tenant, in any status. */
export async function readInstagramApprovalPreview(
  tenant: TenantContext | null,
  input: { readonly requestId: string },
  deps: InstagramApprovalPreviewDeps = {},
): Promise<InstagramApprovalPreviewResult> {
  if (typeof window !== "undefined") throw new Error("Approval previews are server-only.");
  if (!tenant?.tenantId) return { status: "unavailable" };
  if (!UUID.test(input?.requestId ?? "")) return { status: "not-found" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable" };
  let rows;
  try {
    rows = await selectRequests(db, tenant.tenantId, { requestId: input.requestId });
  } catch {
    return { status: "unavailable" };
  }
  const row = rows[0];
  if (!row) return { status: "not-found" };
  return previewOf(tenant, db, row);
}

export type InstagramApprovalPreviewsRead =
  | {
      readonly status: "read";
      /** Keyed by request id. A request whose payload cannot be read maps to `payload-unreadable`. */
      readonly previews: Readonly<Record<string, Exclude<InstagramApprovalPreviewResult, { status: "not-found" }>>>;
    }
  | { readonly status: "unavailable" };

/** Every PENDING Instagram publication request of this tenant — what Approvals renders. */
export async function readPendingInstagramApprovalPreviews(
  tenant: TenantContext | null,
  deps: InstagramApprovalPreviewDeps = {},
): Promise<InstagramApprovalPreviewsRead> {
  if (typeof window !== "undefined") throw new Error("Approval previews are server-only.");
  if (!tenant?.tenantId) return { status: "unavailable" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable" };
  let rows;
  try {
    rows = await selectRequests(db, tenant.tenantId, { pending: true });
  } catch {
    return { status: "unavailable" };
  }
  const previews: Record<string, Exclude<InstagramApprovalPreviewResult, { status: "not-found" }>> = {};
  for (const row of rows) {
    const result = await previewOf(tenant, db, row);
    previews[row.id] = result.status === "not-found" ? { status: "unavailable" } : result;
  }
  return { status: "read", previews };
}

export type InstagramApprovalImageResult =
  | { readonly status: "read"; readonly url: string; readonly expiresAt: string; readonly width: number; readonly height: number }
  | {
      readonly status: "refused";
      readonly reason: "not-found" | "payload-unreadable" | "digest-mismatch" | "not-of-governed-draft" | "unavailable";
    };

/**
 * A short-lived private read grant for the ORIGINAL a governed request binds — requested when a human
 * opens it. The caller names a REQUEST, never an asset: which image is shown is decided by the frozen
 * payload. The released `readMediaAsset` re-verifies size and SHA-256 against the store; the returned
 * row must then equal the payload's digest and draft, or no URL leaves this function.
 */
export async function openInstagramApprovalImage(
  tenant: TenantContext | null,
  input: { readonly requestId: string },
  deps: InstagramApprovalPreviewDeps = {},
): Promise<InstagramApprovalImageResult> {
  if (typeof window !== "undefined") throw new Error("Approval previews are server-only.");
  if (!tenant?.tenantId) return { status: "refused", reason: "unavailable" };
  if (!UUID.test(input?.requestId ?? "")) return { status: "refused", reason: "not-found" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "refused", reason: "unavailable" };
  let rows;
  try {
    rows = await selectRequests(db, tenant.tenantId, { requestId: input.requestId });
  } catch {
    return { status: "refused", reason: "unavailable" };
  }
  const requestRow = rows[0];
  if (!requestRow) return { status: "refused", reason: "not-found" };
  const payload = asPublishInstagramMediaPayload(requestRow.canonicalPayload);
  const ref = payload ? parseWorkArtifactRef(payload.draftRef) : null;
  if (!payload || !ref) return { status: "refused", reason: "payload-unreadable" };

  /* The row must BE the governed original before any grant is minted for it. */
  let row0;
  try {
    row0 = await selectMediaAssetRecord(db, tenant.tenantId, payload.mediaAssetRef);
  } catch {
    return { status: "refused", reason: "unavailable" };
  }
  if (!row0) return { status: "refused", reason: "not-found" };
  if (row0.byteDigest !== payload.mediaAssetDigest) return { status: "refused", reason: "digest-mismatch" };
  if (row0.sourceArtifactId !== ref.artifactId) return { status: "refused", reason: "not-of-governed-draft" };

  const read = await readMediaAsset(tenant, payload.mediaAssetRef, { getDb: () => db, resolveStorage: deps.resolveStorage });
  if (read.status !== "read") return { status: "refused", reason: read.status === "not-found" ? "not-found" : "unavailable" };
  if (read.asset.byteDigest !== payload.mediaAssetDigest) return { status: "refused", reason: "digest-mismatch" };
  if (read.asset.sourceArtifactId !== ref.artifactId) return { status: "refused", reason: "not-of-governed-draft" };
  return { status: "read", url: read.access.url, expiresAt: read.access.expiresAt, width: read.asset.width, height: read.asset.height };
}
