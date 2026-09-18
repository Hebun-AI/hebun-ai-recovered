/*
 * media-assets/request-media-generation.server.ts — from one draft revision to one admitted image
 * (MEDIA-1).
 *
 * ── PREFLIGHT: NOTHING IS WRITTEN AND NOTHING IS CALLED UNTIL ALL OF THIS HOLDS ─
 *
 *   1. an authenticated human tenant context            unauthenticated
 *   2. well-formed input (uuid ids, bounded prompt)     invalid-input
 *   3. storage is connected                             storage-unavailable
 *   4. a generation transport exists                    generation-transport-unavailable
 *   5. the control-plane database is reachable          persistence-unavailable
 *   6. exactly one in-service durable agent             no-durable-agent
 *   7. the source is THIS tenant's content-draft,
 *      still a draft, at exactly that revision          source-revision-unresolvable
 *
 * ── MEDIA-5 PREFLIGHT, WHEN A SOURCE ASSET IS NAMED ──────────────────────────
 *
 *   7a. the transport declares `reference-edit`         reference-edit-unsupported
 *   7b. the asset is THIS tenant's, by id               source-asset-unresolvable
 *   7c. its custody lifecycle is `admitted`             source-asset-retired
 *   7d. its bytes are read PRIVATELY from the store
 *       and their size AND SHA-256 equal the row        source-asset-unavailable
 *
 * ALL OF IT BEFORE THE INVOCATION ROW EXISTS, so a refusal costs nothing and no unverified byte can
 * reach a provider. The asset is named BY ID; the storage key is derived here from the tenant and the
 * id, never accepted from a caller.
 *
 * GOVERNANCE IS NOT CONSULTED, AND THAT IS THE DESIGN. Approval is a judgement about an image, not a
 * capability grant: accepting may not authorize, so declining may not forbid. An `admitted` asset is
 * eligible whether it is approved, declined or never reviewed. Only the CUSTODY lifecycle gates it.
 *
 * Storage is checked BEFORE the transport is even resolved: an image that could not be kept must not
 * be generated. A refusal in preflight leaves no row and makes no call.
 *
 * ── THE IDEMPOTENT DISPATCH BOUNDARY ─────────────────────────────────────────
 *
 *   8. INSERT the invocation as `registered`, ON CONFLICT (tenant_id, request_key) DO NOTHING.
 *      No row returned ⇒ `duplicate-request`, and the transport is NOT called.
 *
 * The database's unique index is the lock. Two concurrent submissions of one key cannot both register,
 * so they cannot both reach the transport.
 *
 * ── AFTER DISPATCH ───────────────────────────────────────────────────────────
 *
 *   9.  transport throws            → state dispatch-failed, provider_failure dispatch-error
 *       transport reports failure   → state provider-failed, provider_failure = its closed code
 *                                     (a code outside the closed set is recorded malformed-response)
 *       every finalization after dispatch records the provider-reported token usage, if any
 *       transport succeeds          → state provider-succeeded, provider job id recorded
 *   10. obtain bytes (inline, or ONE bounded download inside the transport's allowlist)
 *   11. verify bytes (size, magic bytes, declared-type agreement, dimensions, SHA-256)
 *         refused                   → admission refused + code      (no asset)
 *   12. write through the storage port, write-once, digest-checked
 *         failed                    → admission failed storage-write-failed   (no asset)
 *   13. ONE transaction: insert the asset AND mark the invocation admitted
 *         failed                    → admission failed persistence-failed     (no asset)
 *
 * KNOWN, DOCUMENTED GAP: if step 12 succeeds and step 13 fails, an object exists under a key no row
 * names. It is unreadable through this authority (every read starts from a row), and it is not swept:
 * orphan sweeping is out of MEDIA-1's scope. The invocation records `persistence-failed`, which is
 * exactly the evidence a later sweeper needs.
 *
 * WHAT THIS MODULE NEVER WRITES: the draft, the revision, a Governance decision, an action request, a
 * permit, an execution attempt, Knowledge, or a URL.
 *
 * Server-only.
 */
import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { resolveMediaDbOrNull } from "./media-db.server";
import { mediaAssets, mediaGenerationInvocations } from "@/db/schema/media-asset";
import { workArtifactRevisions, workArtifacts } from "@/db/schema/work-artifact";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveAgentAuthorship } from "@/features/work-artifacts/agent-authorship.server";
import { verifyAdmissibleImage } from "./admission-verification";
import {
  MEDIA_ASSET_LIMITS,
  MEDIA_GENERATION_TRANSPORTS,
  MEDIA_ASSET_MIME_TYPES,
  MEDIA_PROVIDER_FAILURES,
  countCodePoints,
  isUuid,
  mediaAssetStorageKey,
  type MediaAdmissionFailure,
  type MediaAssetMimeType,
  type MediaAdmissionRefusal,
  type MediaGenerationRefusal,
  type MediaProviderFailure,
  type MediaProviderUsage,
  type RequestMediaGenerationInput,
  type RequestMediaGenerationResult,
} from "./contracts";
import { digestMediaGenerationInput } from "./input-digest";
import type {
  MediaGenerationRequest,
  MediaGenerationTransportResolution,
} from "./media-generation-transport";
import { resolveMediaGenerationTransport } from "./media-generation-transport.server";
import type { MediaStorageResolution } from "./media-object-store";
import { resolveMediaObjectStore } from "./media-storage.server";
import { downloadProviderOutput, type ProviderDownloadDeps } from "./provider-output-download.server";

export interface MediaGenerationDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly resolveStorage?: () => MediaStorageResolution;
  readonly resolveTransport?: () => MediaGenerationTransportResolution | Promise<MediaGenerationTransportResolution>;
  readonly download?: ProviderDownloadDeps;
}

function validUsage(value: MediaProviderUsage | null | undefined): MediaProviderUsage | null {
  if (!value) return null;
  const { inputTokens, outputTokens } = value;
  if (!Number.isSafeInteger(inputTokens) || !Number.isSafeInteger(outputTokens)) return null;
  if (inputTokens < 0 || outputTokens < 0 || inputTokens > 2_147_483_647 || outputTokens > 2_147_483_647) return null;
  return { inputTokens, outputTokens };
}

function refused(reason: MediaGenerationRefusal): RequestMediaGenerationResult {
  return { status: "refused", reason };
}

function validInput(input: RequestMediaGenerationInput | null): input is RequestMediaGenerationInput {
  if (!input) return false;
  if (!isUuid(input.artifactId) || !isUuid(input.requestKey)) return false;
  if (!Number.isSafeInteger(input.revisionNo) || input.revisionNo < 1) return false;
  if (typeof input.promptText !== "string" || input.promptText.trim().length === 0) return false;
  if (countCodePoints(input.promptText) > MEDIA_ASSET_LIMITS.maxPromptCodePoints) return false;
  /* MEDIA-5: present-and-unusable is invalid input; absent is text-to-image and always fine. */
  const asset = input.sourceAssetId;
  return asset === undefined || asset === null || isUuid(asset);
}

/** The multipart filename for a reference image. DERIVED — never a caller string, never a path. */
function referenceFileName(assetId: string, mimeType: string): string {
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/jpeg" ? "jpg" : "webp";
  return `${assetId}.${extension}`;
}

export async function requestMediaGeneration(
  tenant: TenantContext | null,
  input: RequestMediaGenerationInput | null,
  deps: MediaGenerationDeps = {},
): Promise<RequestMediaGenerationResult> {
  if (typeof window !== "undefined") {
    throw new Error("Media generation is server-only.");
  }

  /* ── Preflight ─────────────────────────────────────────────────────────── */
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  if (!validInput(input)) return refused("invalid-input");

  const storage = (deps.resolveStorage ?? resolveMediaObjectStore)();
  if (storage.status !== "available") return refused("storage-unavailable");

  let transportResolution: MediaGenerationTransportResolution;
  try {
    transportResolution = await (deps.resolveTransport ?? resolveMediaGenerationTransport)();
  } catch {
    return refused("generation-transport-unavailable");
  }
  if (transportResolution.status !== "available") return refused("generation-transport-unavailable");
  const transport = transportResolution.transport;
  /* The type already forbids anything else; this line forbids it at runtime too. */
  if (!(MEDIA_GENERATION_TRANSPORTS as readonly string[]).includes(transport.transport)) {
    return refused("generation-transport-unavailable");
  }

  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = deps.now ?? (() => new Date());

  const authorship = await resolveAgentAuthorship(tenant, { getDb: () => db });
  if (authorship.status !== "resolved") return refused("no-durable-agent");

  let source: { readonly contentDigest: string } | undefined;
  try {
    const rows = await db
      .select({ contentDigest: workArtifactRevisions.contentDigest })
      .from(workArtifactRevisions)
      .innerJoin(
        workArtifacts,
        and(
          eq(workArtifacts.id, workArtifactRevisions.artifactId),
          eq(workArtifacts.tenantId, workArtifactRevisions.tenantId),
        ),
      )
      .where(
        and(
          eq(workArtifactRevisions.tenantId, tenant.tenantId),
          eq(workArtifactRevisions.artifactId, input.artifactId),
          eq(workArtifactRevisions.revisionNo, input.revisionNo),
          eq(workArtifacts.artifactType, "content-draft"),
          eq(workArtifacts.artifactLifecycleStatus, "draft"),
        ),
      )
      .limit(1);
    source = rows[0];
  } catch {
    return refused("persistence-unavailable");
  }
  if (!source) return refused("source-revision-unresolvable");

  /*
   * ── MEDIA-5: RESOLVE THE SOURCE ASSET, READ ITS BYTES, PROVE THEY ARE THE ADMITTED ONES ──
   *
   * Everything here happens BEFORE the invocation row and therefore before the paid call. The order
   * is deliberate: the cheapest refusal first, the store round-trip last.
   */
  const sourceAssetId = input.sourceAssetId ?? null;
  let generationRequest: MediaGenerationRequest = { mode: "text-to-image" };
  let sourceAssetDigest: string | null = null;

  if (sourceAssetId !== null) {
    if (!transport.modes.includes("reference-edit")) return refused("reference-edit-unsupported");

    let asset: { readonly byteDigest: string; readonly byteSize: number; readonly mimeType: string; readonly lifecycle: string } | undefined;
    try {
      const rows = await db
        .select({
          byteDigest: mediaAssets.byteDigest,
          byteSize: mediaAssets.byteSize,
          mimeType: mediaAssets.mimeType,
          lifecycle: mediaAssets.assetLifecycleStatus,
        })
        .from(mediaAssets)
        /* Predicated on the tenant: another tenant's asset is indistinguishable from no asset. */
        .where(and(eq(mediaAssets.tenantId, tenant.tenantId), eq(mediaAssets.id, sourceAssetId)))
        .limit(1);
      asset = rows[0];
    } catch {
      return refused("persistence-unavailable");
    }
    if (!asset) return refused("source-asset-unresolvable");
    /* Custody, and ONLY custody, decides eligibility. No Governance state is read here at all. */
    if (asset.lifecycle !== "admitted") return refused("source-asset-retired");

    /*
     * The key is DERIVED from the tenant and the asset id by the same function that minted it at
     * admission. No caller supplies it, and the database CHECK guarantees it is the row's own key.
     */
    const key = mediaAssetStorageKey(tenant.tenantId, sourceAssetId);
    /*
     * The row's own type, carried to the store because the store may need it to serve the object at
     * all. `mime_type` is `text` in the column and a closed set in the CHECK constraint, so this
     * narrows what the database already guarantees rather than re-deciding it. A value outside the
     * set could only mean the row and the constraint disagree — a custody fact, refused like any
     * other, before a provider is reached.
     */
    if (!MEDIA_ASSET_MIME_TYPES.includes(asset.mimeType as MediaAssetMimeType)) {
      return refused("source-asset-unavailable");
    }
    const sourceContentType = asset.mimeType as MediaAssetMimeType;
    let read;
    try {
      read = await storage.store.get({
        key,
        contentType: sourceContentType,
        maxBytes: MEDIA_ASSET_LIMITS.maxByteSize,
      });
    } catch {
      return refused("source-asset-unavailable");
    }
    if (read.status !== "read") return refused("source-asset-unavailable");

    /*
     * INDEPENDENT VERIFICATION AGAINST THE AUTHORITATIVE ROW, and it is not optional.
     *
     * The store is trusted to hold bytes, never to describe them. Size and SHA-256 are recomputed
     * here and compared to `media_assets`; a mismatch is a storage custody problem and it stops the
     * request cold — no provider call, no invocation row, nothing spent. This is the same refusal a
     * preview gives, made before bytes can leave Hebun rather than before they can be displayed.
     */
    const actualDigest = createHash("sha256").update(read.bytes).digest("hex");
    if (read.bytes.byteLength !== asset.byteSize || actualDigest !== asset.byteDigest) {
      return refused("source-asset-unavailable");
    }

    sourceAssetDigest = asset.byteDigest;
    generationRequest = {
      mode: "reference-edit",
      referenceImage: {
        bytes: read.bytes,
        contentType: asset.mimeType,
        fileName: referenceFileName(sourceAssetId, asset.mimeType),
      },
    };
  }

  const inputDigest = digestMediaGenerationInput({
    promptText: input.promptText,
    sourceArtifactId: input.artifactId,
    sourceRevisionNo: input.revisionNo,
    sourceContentDigest: source.contentDigest,
    transport: transport.transport,
    provider: transport.provider,
    model: transport.model,
    /* v2 exactly when there is a source asset; a text-to-image digest stays byte-identical to v1. */
    sourceAsset: sourceAssetId && sourceAssetDigest ? { assetId: sourceAssetId, byteDigest: sourceAssetDigest } : null,
  });

  /* ── The idempotent dispatch boundary ─────────────────────────────────── */
  let invocationId: string | undefined;
  try {
    const registered = await db
      .insert(mediaGenerationInvocations)
      .values({
        tenantId: tenant.tenantId,
        requestKey: input.requestKey,
        requestedByActorType: "human",
        requestedByActorId: tenant.userId,
        agentId: authorship.authorship.agentId,
        sourceArtifactId: input.artifactId,
        sourceRevisionNo: input.revisionNo,
        /* MEDIA-5 lineage. NULL for text-to-image — absence is a real request kind, not a gap. */
        sourceMediaAssetId: sourceAssetId,
        promptText: input.promptText,
        inputDigest,
        transport: transport.transport,
        provider: transport.provider,
        model: transport.model,
        state: "registered",
        requestedAt: now(),
      })
      .onConflictDoNothing({
        target: [mediaGenerationInvocations.tenantId, mediaGenerationInvocations.requestKey],
      })
      .returning({ id: mediaGenerationInvocations.id });
    invocationId = registered[0]?.id;
  } catch {
    return refused("persistence-unavailable");
  }
  if (!invocationId) return refused("duplicate-request");
  const thisInvocation = and(
    eq(mediaGenerationInvocations.tenantId, tenant.tenantId),
    eq(mediaGenerationInvocations.id, invocationId),
  );

  /*
   * Usage is recorded as the transport reported it on every finalization after dispatch; a provider
   * failure carries its closed code in `provider_failure`, never in `admission_failure`. There is NO
   * retry on any path: a second attempt is a new human request with a new request key.
   */
  let usage: MediaProviderUsage | null = null;
  const finalize = async (
    state: "dispatch-failed" | "provider-failed" | "provider-succeeded",
    admissionOutcome: "not-attempted" | "refused" | "failed",
    failure: MediaAdmissionRefusal | MediaAdmissionFailure | MediaProviderFailure | null,
    providerJobId: string | null,
  ): Promise<RequestMediaGenerationResult> => {
    const providerFailure = state === "provider-succeeded" ? null : (failure as MediaProviderFailure);
    const admissionFailure = state === "provider-succeeded" ? (failure as MediaAdmissionRefusal | MediaAdmissionFailure | null) : null;
    try {
      await db
        .update(mediaGenerationInvocations)
        .set({
          state,
          admissionOutcome,
          admissionFailure,
          providerFailure,
          providerJobId,
          providerInputTokens: usage?.inputTokens ?? null,
          providerOutputTokens: usage?.outputTokens ?? null,
          finalizedAt: now(),
        })
        .where(and(thisInvocation, eq(mediaGenerationInvocations.state, "registered")));
    } catch {
      /* The attempt row stays `registered`; the result below is still the truth about this call. */
    }
    return { status: "not-admitted", invocationId: invocationId!, state, admissionOutcome, failure };
  };

  /* ── Dispatch ─────────────────────────────────────────────────────────── */
  let outcome;
  try {
    outcome = await transport.generate({
      promptText: input.promptText,
      inputDigest,
      invocationId,
      request: generationRequest,
    });
  } catch {
    return finalize("dispatch-failed", "not-attempted", "dispatch-error", null);
  }
  usage = validUsage(outcome.usage);
  const providerJobId =
    typeof outcome.providerJobId === "string" && outcome.providerJobId.length > 0
      ? outcome.providerJobId.slice(0, 256)
      : null;
  if (outcome.status !== "succeeded") {
    /* A transport that reports a code outside the closed set is itself malformed. */
    const code =
      (MEDIA_PROVIDER_FAILURES as readonly string[]).includes(outcome.failure) && (outcome.failure as string) !== "dispatch-error"
        ? outcome.failure
        : "malformed-response";
    return finalize("provider-failed", "not-attempted", code, providerJobId);
  }

  /* ── Admission ────────────────────────────────────────────────────────── */
  let bytes: Uint8Array;
  let declaredContentType: string | null;
  if (outcome.output.kind === "bytes") {
    bytes = outcome.output.bytes;
    declaredContentType = outcome.output.declaredContentType;
  } else {
    const downloaded = await downloadProviderOutput(
      outcome.output.url,
      transport.allowedDownloadHosts,
      deps.download,
    );
    if (downloaded.status !== "downloaded") {
      return finalize("provider-succeeded", "refused", downloaded.reason, providerJobId);
    }
    bytes = downloaded.bytes;
    declaredContentType = outcome.output.declaredContentType ?? downloaded.declaredContentType;
  }

  const verified = verifyAdmissibleImage(bytes, declaredContentType);
  if (verified.status !== "verified") {
    return finalize("provider-succeeded", "refused", verified.reason, providerJobId);
  }
  const image = verified.image;

  const assetId = randomUUID();
  const storageKey = mediaAssetStorageKey(tenant.tenantId, assetId);
  try {
    await storage.store.put({
      key: storageKey,
      bytes,
      contentType: image.mimeType,
      sha256Hex: image.byteDigest,
    });
  } catch {
    return finalize("provider-succeeded", "failed", "storage-write-failed", providerJobId);
  }

  const admittedAt = now();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(mediaAssets).values({
        id: assetId,
        tenantId: tenant.tenantId,
        invocationId: invocationId!,
        mimeType: image.mimeType,
        byteSize: image.byteSize,
        byteDigest: image.byteDigest,
        width: image.width,
        height: image.height,
        storageBackend: storage.store.backend,
        storageKey,
        admittedAt,
      });
      const marked = await tx
        .update(mediaGenerationInvocations)
        .set({
          state: "provider-succeeded",
          admissionOutcome: "admitted",
          admissionFailure: null,
          providerFailure: null,
          providerJobId,
          providerInputTokens: usage?.inputTokens ?? null,
          providerOutputTokens: usage?.outputTokens ?? null,
          finalizedAt: admittedAt,
        })
        .where(and(thisInvocation, eq(mediaGenerationInvocations.state, "registered")))
        .returning({ id: mediaGenerationInvocations.id });
      if (marked.length !== 1) throw new Error("invocation no longer registered");
    });
  } catch {
    return finalize("provider-succeeded", "failed", "persistence-failed", providerJobId);
  }

  return {
    status: "admitted",
    invocationId,
    assetId,
    mimeType: image.mimeType,
    byteSize: image.byteSize,
    byteDigest: image.byteDigest,
    width: image.width,
    height: image.height,
  };
}
