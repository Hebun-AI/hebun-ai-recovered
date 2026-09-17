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
 *   9.  transport throws            → state dispatch-failed         (finalized, no admission)
 *       transport reports failure   → state provider-failed         (finalized, no admission)
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
import { randomUUID } from "node:crypto";
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
  MEDIA_GENERATION_TRANSPORT,
  countCodePoints,
  isUuid,
  mediaAssetStorageKey,
  type MediaAdmissionFailure,
  type MediaAdmissionRefusal,
  type MediaGenerationRefusal,
  type RequestMediaGenerationInput,
  type RequestMediaGenerationResult,
} from "./contracts";
import { digestMediaGenerationInput } from "./input-digest";
import type { MediaGenerationTransportResolution } from "./media-generation-transport";
import { resolveMediaGenerationTransport } from "./media-generation-transport.server";
import type { MediaStorageResolution } from "./media-object-store";
import { resolveMediaObjectStore } from "./media-storage.server";
import { downloadProviderOutput, type ProviderDownloadDeps } from "./provider-output-download.server";

export interface MediaGenerationDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly resolveStorage?: () => MediaStorageResolution;
  readonly resolveTransport?: () => MediaGenerationTransportResolution;
  readonly download?: ProviderDownloadDeps;
}

function refused(reason: MediaGenerationRefusal): RequestMediaGenerationResult {
  return { status: "refused", reason };
}

function validInput(input: RequestMediaGenerationInput | null): input is RequestMediaGenerationInput {
  if (!input) return false;
  if (!isUuid(input.artifactId) || !isUuid(input.requestKey)) return false;
  if (!Number.isSafeInteger(input.revisionNo) || input.revisionNo < 1) return false;
  if (typeof input.promptText !== "string" || input.promptText.trim().length === 0) return false;
  return countCodePoints(input.promptText) <= MEDIA_ASSET_LIMITS.maxPromptCodePoints;
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

  const transportResolution = (deps.resolveTransport ?? resolveMediaGenerationTransport)();
  if (transportResolution.status !== "available") return refused("generation-transport-unavailable");
  const transport = transportResolution.transport;
  /* The type already forbids anything else; this line forbids it at runtime too. */
  if (transport.transport !== MEDIA_GENERATION_TRANSPORT) return refused("generation-transport-unavailable");

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

  const inputDigest = digestMediaGenerationInput({
    promptText: input.promptText,
    sourceArtifactId: input.artifactId,
    sourceRevisionNo: input.revisionNo,
    sourceContentDigest: source.contentDigest,
    transport: transport.transport,
    provider: transport.provider,
    model: transport.model,
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

  const finalize = async (
    state: "dispatch-failed" | "provider-failed" | "provider-succeeded",
    admissionOutcome: "not-attempted" | "refused" | "failed",
    failure: MediaAdmissionRefusal | MediaAdmissionFailure | null,
    providerJobId: string | null,
  ): Promise<RequestMediaGenerationResult> => {
    try {
      await db
        .update(mediaGenerationInvocations)
        .set({ state, admissionOutcome, admissionFailure: failure, providerJobId, finalizedAt: now() })
        .where(and(thisInvocation, eq(mediaGenerationInvocations.state, "registered")));
    } catch {
      /* The attempt row stays `registered`; the result below is still the truth about this call. */
    }
    return { status: "not-admitted", invocationId: invocationId!, state, admissionOutcome, failure };
  };

  /* ── Dispatch ─────────────────────────────────────────────────────────── */
  let outcome;
  try {
    outcome = await transport.generate({ promptText: input.promptText, inputDigest });
  } catch {
    return finalize("dispatch-failed", "not-attempted", null, null);
  }
  const providerJobId =
    typeof outcome.providerJobId === "string" && outcome.providerJobId.length > 0
      ? outcome.providerJobId.slice(0, 256)
      : null;
  if (outcome.status !== "succeeded") {
    return finalize("provider-failed", "not-attempted", null, providerJobId);
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
          providerJobId,
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
