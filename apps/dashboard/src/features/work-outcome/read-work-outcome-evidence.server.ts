/*
 * work-outcome/read-work-outcome-evidence.server.ts — WORK-OUTCOME-CLOSURE-1: every draft this
 * organization's work declares as evidence, grouped by work item, with the Governance review of each
 * draft's CURRENT revision.
 *
 * Composition only — three released reads, asked once each, in this order:
 *
 *   listWorkArtifacts                 Work Artifacts: what exists, its current revision, retired or not
 *   readWorkEvidenceReferences        Organizational Work (WEV-1): which work declares which draft
 *   readCurrentRevisionReviewStates   Governance ledger (CGO-8): the latest decision on that revision
 *
 * Tenant-scoped by each owner's own predicate; there is no tenant, work item or artifact parameter, so
 * another organization's records are unrepresentable here. No insert, no update, no transaction.
 *
 * ── A PARTIAL ANSWER IS NOT AN ANSWER ────────────────────────────────────────
 *
 * The evidence read is bounded at `MAX_WORK_EVIDENCE_REFERENCES` and carries no truncation flag. A
 * full page may be missing a declaration, and a missing declaration could be the one draft whose
 * changes were requested — so a full page is reported `unavailable`, never as the complete set.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  MAX_WORK_EVIDENCE_REFERENCES,
  readWorkEvidenceReferences,
} from "@/features/organizational-work/read-work-evidence.server";
import { listWorkArtifacts } from "@/features/work-artifacts/read-work-artifacts.server";
import { readCurrentRevisionReviewStates } from "@/features/work-artifact-review/review-revision.server";
import { artifactRowReviewStatus } from "@/features/work-artifact-review/contracts";
import type { WorkOutcomeEvidence } from "./contracts";

export interface WorkOutcomeEvidenceDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

export type WorkOutcomeEvidenceRead =
  | {
      readonly status: "read";
      /** Work item id → the drafts it declares. A work item that declares none is absent. */
      readonly byWorkItem: Readonly<Record<string, readonly WorkOutcomeEvidence[]>>;
    }
  | { readonly status: "unavailable" };

export async function readWorkOutcomeEvidence(
  tenant: TenantContext | null,
  deps: WorkOutcomeEvidenceDeps = {},
): Promise<WorkOutcomeEvidenceRead> {
  if (typeof window !== "undefined") throw new Error("Work outcome reads are server-only.");
  if (!tenant?.tenantId) return { status: "unavailable" };

  const listing = await listWorkArtifacts(tenant, { getDb: deps.getDb });
  if (listing.status !== "read") return { status: "unavailable" };
  const evidence = await readWorkEvidenceReferences(tenant, { getDb: deps.getDb, listArtifacts: async () => listing });
  if (evidence.status !== "available") return { status: "unavailable" };
  if (evidence.references.length >= MAX_WORK_EVIDENCE_REFERENCES) return { status: "unavailable" };

  const drafts = evidence.references.filter((reference) => reference.kind === "work-artifact");
  const artifacts = new Map(listing.artifacts.map((artifact) => [artifact.id, artifact] as const));
  const known = [...new Set(drafts.map((d) => d.referentId))].flatMap((id) => {
    const artifact = artifacts.get(id);
    return artifact ? [{ artifactId: artifact.id, revisionNo: artifact.currentRevision }] : [];
  });
  const reviews = await readCurrentRevisionReviewStates(tenant, known, { getDb: deps.getDb });

  const byWorkItem: Record<string, WorkOutcomeEvidence[]> = {};
  for (const reference of drafts) {
    const artifact = artifacts.get(reference.referentId);
    (byWorkItem[reference.workItemId] ??= []).push(
      artifact
        ? {
            artifactId: artifact.id,
            title: artifact.title,
            artifactType: artifact.artifactType,
            revisionNo: artifact.currentRevision,
            retired: artifact.lifecycleStatus === "retired",
            review: artifactRowReviewStatus(reviews, artifact.id),
          }
        : /* Declared, but the artifact authority does not know it: unresolved, never guessed. */
          { artifactId: reference.referentId, title: null, artifactType: null, revisionNo: null, retired: false, review: "unknown" },
    );
  }
  return { status: "read", byWorkItem };
}
