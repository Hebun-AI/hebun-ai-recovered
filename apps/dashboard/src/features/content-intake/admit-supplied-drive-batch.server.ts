/*
 * content-intake/admit-supplied-drive-batch.server.ts — ONE Picker ceremony's files, each admitted by
 * the EXISTING per-file Media admission (CONTENT-INTAKE-1).
 *
 * This module is not an authority. It owns no table, writes no row and reads no Drive byte itself. It
 * checks the batch's shape and bound, verifies the Picker binding ONCE before anything is read, and then
 * calls `admitSuppliedDriveImage` / `admitSuppliedDriveVideo` — unchanged — once per file, sequentially,
 * passing the same draft, revision and binding every time. Everything those admissions guarantee holds
 * per file because it is the same code: the exact bound connection (re-resolved per read, never a
 * fallback), the per-file `drive.file` capability, byte verification, the digest, write-once storage,
 * human supplier, and `supplied_source_integration_id` naming the connection the read ran under.
 *
 *     BATCH != TRANSACTION     a file admitted stays admitted when a later one is refused, and a refused
 *                              file is never reported as admitted because another one was
 *
 * ── ORDER ─────────────────────────────────────────────────────────────────────
 *
 *   1. an authenticated human                                    unauthenticated
 *   2. a list of file ids, a draft id, a revision, a binding     invalid-input
 *   3. at least one file, at most the kind's bound               batch-empty / batch-too-large
 *   4. the binding verifies for THIS tenant/human/session and its
 *      connection still reads the per-file capability as the
 *      same Google account                                        drive-connection-not-bound /
 *                                                                 drive-capability-not-available
 *   5. per file, in the order chosen: a repeat of an earlier id is `duplicate-selection` (not read
 *      twice); a file is started only before the kind's cutoff; otherwise the one admission decides
 *   6. a refusal that is not about one file stops the batch; the rest are `not-attempted`
 *
 * Nothing in the input can name a tenant, a human, a connection, an account, a capability or a kind:
 * the tenant comes from the trusted session and the kind from the action the human's control called.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  admitSuppliedDriveImage,
  type AdmitSuppliedDriveImageRefusal,
  type AdmitSuppliedDriveImageResult,
} from "@/features/media-assets/admit-supplied-drive-image.server";
import {
  admitSuppliedDriveVideo,
  type AdmitSuppliedDriveVideoRefusal,
  type AdmitSuppliedDriveVideoResult,
} from "@/features/media-assets/admit-supplied-drive-video.server";
import { driveRefusal } from "@/features/media-assets/supplied-drive-refusal";
import {
  resolveBoundDriveFileConnection,
  type BoundDriveFileConnection,
} from "@/features/provider-google/picker-connection-binding.server";
import {
  CONTENT_INTAKE_BATCH_LIMITS,
  summarizeBatchOutcomes,
  type SuppliedDriveBatchFileOutcome,
  type SuppliedDriveBatchKind,
  type SuppliedDriveBatchResult,
  type SuppliedDriveBatchStop,
} from "./contracts";

export interface AdmitSuppliedDriveBatchInput {
  readonly artifactId: string;
  readonly revisionNo: number;
  /** The file ids Google's chooser returned for ONE ceremony, in the order the human chose them. */
  readonly driveFileIds: readonly string[];
  /** The ONE signed binding that ceremony was opened with. */
  readonly pickerBinding: string;
}

type PerFileInput = {
  readonly artifactId: string;
  readonly revisionNo: number;
  readonly driveFileId: string;
  readonly pickerBinding: string;
};

export interface AdmitSuppliedDriveBatchDeps {
  /** The released per-file admissions. Injected in tests; production uses them unchanged. */
  readonly admitImage?: (tenant: TenantContext, input: PerFileInput) => Promise<AdmitSuppliedDriveImageResult>;
  readonly admitVideo?: (tenant: TenantContext, input: PerFileInput) => Promise<AdmitSuppliedDriveVideoResult>;
  /** The binding gate. Production: the same resolver every Drive read runs. */
  readonly resolveBinding?: (tenant: TenantContext, binding: string) => Promise<BoundDriveFileConnection>;
  /** Milliseconds, monotonic enough for a cutoff. */
  readonly nowMs?: () => number;
}

export type SuppliedDriveBatchRefusalOf<K extends SuppliedDriveBatchKind> = K extends "image"
  ? AdmitSuppliedDriveImageRefusal
  : AdmitSuppliedDriveVideoRefusal;

/*
 * Refusals that describe the REQUEST, not the file: the session, the stores, the draft revision, the
 * binding, the connection. After one of these the next file would meet the same condition — or, for the
 * binding and connection, must not be read under it at all.
 */
const BATCH_CONDITIONS: ReadonlySet<string> = new Set([
  "unauthenticated",
  "storage-unavailable",
  "persistence-unavailable",
  "source-revision-unresolvable",
  "drive-connection-not-bound",
  "drive-capability-not-available",
]);

export async function admitSuppliedDriveBatch<K extends SuppliedDriveBatchKind>(
  kind: K,
  tenant: TenantContext | null,
  input: AdmitSuppliedDriveBatchInput | null,
  deps: AdmitSuppliedDriveBatchDeps = {},
): Promise<SuppliedDriveBatchResult<SuppliedDriveBatchRefusalOf<K>>> {
  if (typeof window !== "undefined") throw new Error("Content intake is server-only.");
  type R = SuppliedDriveBatchRefusalOf<K>;
  const limits = CONTENT_INTAKE_BATCH_LIMITS[kind];
  if (!limits) throw new Error("Unknown batch kind.");

  /* ── 1–3. WHO, WHAT, HOW MANY — before anything is resolved or read. ── */
  if (!tenant?.tenantId || !tenant.userId) return { status: "refused", reason: "unauthenticated" };
  if (!input || !Array.isArray(input.driveFileIds) || typeof input.pickerBinding !== "string") {
    return { status: "refused", reason: "invalid-input" };
  }
  const ids = input.driveFileIds;
  if (ids.length === 0) return { status: "refused", reason: "batch-empty" };
  if (ids.length > limits.maxFiles) return { status: "refused", reason: "batch-too-large", detail: `max-${limits.maxFiles}` };
  if (!ids.every((id) => typeof id === "string")) return { status: "refused", reason: "invalid-input" };

  /* ── 4. THE BINDING, ONCE, BEFORE ANY FILE. Each read re-resolves it again; this is not a substitute. ── */
  let bound: BoundDriveFileConnection;
  try {
    bound = await (deps.resolveBinding ?? ((t, b) => resolveBoundDriveFileConnection(t, b)))(tenant, input.pickerBinding);
  } catch {
    return { status: "refused", reason: "drive-capability-not-available", detail: "binding-unresolvable" };
  }
  if (bound.status !== "bound") {
    const mapped = driveRefusal(bound.reason);
    return {
      status: "refused",
      reason: mapped === "drive-read-failed" ? "drive-connection-not-bound" : mapped,
      detail: bound.reason,
    };
  }

  /* ── 5–6. ONE FILE AT A TIME, through the one admission. ── */
  const admitOne = async (driveFileId: string): Promise<AdmitSuppliedDriveImageResult | AdmitSuppliedDriveVideoResult> => {
    const perFile: PerFileInput = { artifactId: input.artifactId, revisionNo: input.revisionNo, driveFileId, pickerBinding: input.pickerBinding };
    return kind === "image"
      ? (deps.admitImage ?? ((t, i) => admitSuppliedDriveImage(t, i)))(tenant, perFile)
      : (deps.admitVideo ?? ((t, i) => admitSuppliedDriveVideo(t, i)))(tenant, perFile);
  };
  const now = deps.nowMs ?? (() => Date.now());
  const startedAt = now();
  const seen = new Set<string>();
  const files: SuppliedDriveBatchFileOutcome<R>[] = [];
  let stoppedBy: SuppliedDriveBatchStop | null = null;

  for (const fileId of ids) {
    if (seen.has(fileId)) {
      files.push({ fileId, status: "duplicate-selection" });
      continue;
    }
    seen.add(fileId);
    if (stoppedBy === null && now() - startedAt >= limits.startCutoffMs) stoppedBy = "time-budget";
    if (stoppedBy !== null) {
      files.push({ fileId, status: "not-attempted" });
      continue;
    }

    let result: AdmitSuppliedDriveImageResult | AdmitSuppliedDriveVideoResult;
    try {
      result = await admitOne(fileId);
    } catch {
      /* The admission catches its own failures; an escape is ambiguous, so it is reported and not retried. */
      files.push({ fileId, status: "refused", reason: "persistence-unavailable" as R, detail: "admission-threw" });
      stoppedBy = "batch-condition";
      continue;
    }
    if (result.status === "refused") {
      files.push({ fileId, status: "refused", reason: result.reason as R, ...(result.detail ? { detail: result.detail } : {}) });
      if (BATCH_CONDITIONS.has(result.reason)) stoppedBy = "batch-condition";
      continue;
    }
    files.push({
      fileId,
      status: result.status,
      assetId: result.asset.assetId,
      suppliedSourceIntegrationId: result.asset.suppliedSourceIntegrationId,
    });
    /* A NEW row must name the bound connection. (An `existing` row keeps what it was first admitted with.) */
    if (result.status === "admitted" && result.asset.suppliedSourceIntegrationId !== bound.integrationId.toLowerCase()) {
      stoppedBy = "provenance-mismatch";
    }
  }

  return { status: "processed", kind, files, summary: summarizeBatchOutcomes(files), stoppedBy };
}
