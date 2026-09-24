/*
 * heby-action-inlet/instagram-publish-proposal.server.ts — the deterministic Instagram publish inlet
 * (PUBLISH-0).
 *
 * The same shape as `/send`: the caller names two REFERENCES (a caption revision and an image), and
 * this module resolves each against its owning authority and takes every digest FROM WHAT IT READ.
 * The connection and its verified account id come from the integration authority for the session's
 * tenant — never from input. Nothing here reaches a provider, opens a credential, approves, mints or
 * executes. The result is a pending request on `/approvals`, and nothing more.
 *
 *   caller refs → exact resolution → prepareAction → recordActionRequest → human review
 *
 * PREPARED IS NOT AUTHORIZED. A filed proposal is a question to a human.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordActionRequest } from "@/features/action-authorization/record-action-request.server";
import { prepareAction } from "@/features/heby-actions/action-preparer";
import type { HebyEvidenceReference } from "@/features/heby-integration";
import { PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND } from "@/features/instagram-publishing/contracts";
import {
  derivePublishJpeg,
  type DerivePublishJpegRefusal,
} from "@/features/media-assets/derive-publish-jpeg.server";
import { resolveMediaDbOrNull } from "@/features/media-assets/media-db.server";
import type { MediaStorageResolution } from "@/features/media-assets/media-object-store";
import { selectMediaAssetRecord } from "@/features/media-assets/read-media-assets.server";
import { INSTAGRAM_MAX_CAPTION_LENGTH } from "@/features/provider-instagram/instagram-publish-transport.server";
import { evaluatePublishConnection } from "@/features/provider-instagram/publish-capability";
import { readInstagramPublishFacts } from "@/features/provider-instagram/resolve-publish-capability.server";
import { formatWorkArtifactRef, isWorkArtifactRef } from "@/features/work-artifacts/artifact-ref";
import { resolveWorkArtifactReference } from "@/features/work-artifacts/read-work-artifacts.server";
import { SEND_OWNER_WORKSPACE } from "./contracts";

export interface InstagramPublishProposalInput {
  readonly draftRef: string;
  readonly mediaAssetId: string;
}

export type InstagramPublishProposalRefusal =
  | "unauthenticated"
  | "invalid-input"
  | "persistence-unavailable"
  | "publish-not-possible"
  | "draft-not-found"
  | "draft-retired"
  | "draft-superseded"
  | "draft-not-instagram-content"
  | "caption-too-long"
  | "media-not-found"
  | "media-retired"
  | "media-not-of-this-draft"
  | "media-not-publishable"
  | "already-pending"
  | "not-authorizable";

export type InstagramPublishProposalResult =
  | { readonly status: "proposed"; readonly requestId: string }
  | { readonly status: "refused"; readonly reason: InstagramPublishProposalRefusal; readonly detail?: string };

export interface InstagramPublishProposalDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly resolveStorage?: () => MediaStorageResolution;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const refused = (
  reason: InstagramPublishProposalRefusal,
  detail?: string,
): InstagramPublishProposalResult => ({ status: "refused", reason, ...(detail ? { detail } : {}) });

export async function proposeInstagramPublish(
  tenant: TenantContext | null,
  input: InstagramPublishProposalInput | null,
  deps: InstagramPublishProposalDeps = {},
): Promise<InstagramPublishProposalResult> {
  if (typeof window !== "undefined") throw new Error("Action proposals are server-only.");
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  if (!input || !isWorkArtifactRef(input.draftRef) || !UUID.test(input.mediaAssetId ?? "")) {
    return refused("invalid-input");
  }

  /* ── 1. THE CONNECTION — the tenant's own, connection-side eligible, no credential opened. ── */
  const facts = await readInstagramPublishFacts(tenant, { getDb: deps.getDb });
  if (!facts) return refused("persistence-unavailable");
  const eligibility = evaluatePublishConnection(facts);
  if (eligibility.status === "unavailable") return refused("publish-not-possible", eligibility.reason);
  const connection = eligibility.connection;

  /* ── 2. THE CAPTION — an Instagram content draft, current, not retired. ── */
  const draft = await resolveWorkArtifactReference(tenant, input.draftRef, deps);
  if (!draft.readable || !draft.revision || !draft.artifact) return refused("draft-not-found");
  if (draft.standing === "retired") return refused("draft-retired");
  if (!draft.proposable) return refused("draft-superseded");
  if (draft.artifact.artifactType !== "content-draft" || draft.artifact.intendedDestination !== "instagram") {
    return refused("draft-not-instagram-content");
  }
  if (draft.revision.content.length > INSTAGRAM_MAX_CAPTION_LENGTH) return refused("caption-too-long");

  /* ── 3. THE IMAGE — the generated original: admitted, of THIS draft. Any admitted type. ── */
  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  let asset;
  try {
    asset = await selectMediaAssetRecord(db, tenant.tenantId, input.mediaAssetId);
  } catch {
    return refused("persistence-unavailable");
  }
  if (!asset) return refused("media-not-found");
  if (asset.lifecycle !== "admitted") return refused("media-retired");
  if (asset.sourceArtifactId !== draft.artifact.id) return refused("media-not-of-this-draft");

  /*
   * ── 3b. THE PUBLISH DERIVATIVE — Meta publishes JPEG only. The Media authority produces (or
   * finds) the deterministic `jpeg-publish-v1` JPEG of exactly this original. Derivation is a media
   * write, never an authorization: what it returns is only bound here, for a human to approve.
   */
  const derived = await derivePublishJpeg(
    tenant,
    { originalAssetId: asset.assetId },
    { getDb: () => db, resolveStorage: deps.resolveStorage, now: deps.now },
  );
  if (derived.status === "refused") {
    return derivationRefusal(derived.reason);
  }
  const derivative = derived.derivative;

  /* ── 4. PREPARE through the existing gates, then PERSIST through R3A's writer. ── */
  const draftRef = formatWorkArtifactRef(draft.revision.artifactId, draft.revision.revisionNo);
  const evidence: readonly HebyEvidenceReference[] = [
    { sourceClass: "work-artifacts", recordRef: draftRef, lifecycle: "settled" },
  ];
  const prepared = prepareAction({
    actionKind: PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND,
    requestingWorkspace: SEND_OWNER_WORKSPACE,
    target: { kind: "record", ref: draftRef, label: draft.artifact.title },
    proposedArguments: {
      integrationId: connection.integrationId,
      externalAccountId: connection.externalAccountId,
      draftRef,
      draftRevisionDigest: draft.revision.contentDigest,
      mediaAssetRef: asset.assetId,
      mediaAssetDigest: asset.byteDigest,
      publishAssetRef: derivative.assetId,
      publishAssetDigest: derivative.byteDigest,
    },
    evidence,
  });
  if (prepared.lifecycleState !== "REQUIRES_HUMAN_REVIEW") {
    return refused("not-authorizable", prepared.lifecycleState);
  }

  const recorded = await recordActionRequest(tenant, prepared, deps);
  if (recorded.status === "recorded") return { status: "proposed", requestId: recorded.requestId };
  if (recorded.reason === "already-pending") return refused("already-pending");
  if (recorded.reason === "persistence-unavailable") return refused("persistence-unavailable");
  return refused("not-authorizable", recorded.reason);
}

function derivationRefusal(reason: DerivePublishJpegRefusal): InstagramPublishProposalResult {
  switch (reason) {
    case "storage-unavailable":
    case "persistence-unavailable":
      return refused("persistence-unavailable");
    case "source-retired":
      return refused("media-retired");
    case "source-not-found":
    case "source-not-generated":
      return refused("media-not-found");
    default:
      return refused("media-not-publishable", reason);
  }
}
