import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { listWorkArtifacts, resolveWorkArtifactReference } from "@/features/work-artifacts/read-work-artifacts.server";
import { readCurrentRevisionReviewStates } from "@/features/work-artifact-review/review-revision.server";
import { readContentPackage } from "@/features/content-composition/read-content-package.server";
import { readContentPublicationStates } from "@/features/action-authorization/content-publication-state.server";
import { readPublicationMeasurements } from "@/features/content-publication-measurement/read-publication-measurement.server";
import { readWorkEvidenceReferences, MAX_WORK_EVIDENCE_REFERENCES } from "@/features/organizational-work/read-work-evidence.server";
import { readWorkRegister } from "@/features/organizational-work/read-work.server";
import { indexArtifactWorkPurpose } from "@/features/organizational-work/artifact-work-purpose";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";

// Presentation composition only. Every fact remains owned by its released reader.
// Bound expensive package reads, and expose that window rather than calling it a tenant total.
export const DASHBOARD_CONTENT_LIMIT = 50;
export async function readApprovalsDashboard(tenant: TenantContext | null) {
  const [listing, evidence, work, authority] = await Promise.all([
    listWorkArtifacts(tenant), readWorkEvidenceReferences(tenant), readWorkRegister(tenant),
    resolveGovernanceAuthority(tenant),
  ]);
  const artifacts = listing.status === "read" ? listing.artifacts.slice(0, DASHBOARD_CONTENT_LIMIT) : [];
  const revisions = artifacts.map((a) => ({ artifactId: a.id, revisionNo: a.currentRevision }));
  const [reviews, publications] = await Promise.all([
    readCurrentRevisionReviewStates(tenant, revisions), readContentPublicationStates(tenant, revisions),
  ]);
  // Reuse the exact same publication read in the stored-measurement projection.
  const measurements = await readPublicationMeasurements(tenant, revisions, {
    readPublicationStates: async () => publications,
  });
  const content = [];
  // Batches avoid a store fan-out proportional to the entire tenant's artifact history.
  for (let offset = 0; offset < artifacts.length; offset += 5) {
    content.push(...await Promise.all(artifacts.slice(offset, offset + 5).map(async (artifact) => {
      const [resolved, pkg] = await Promise.all([
        resolveWorkArtifactReference(tenant, artifact.currentRef),
        readContentPackage(tenant, { artifactId: artifact.id, revisionNo: artifact.currentRevision }),
      ]);
      return {
        artifact: {
          id: artifact.id, title: artifact.title, artifactType: artifact.artifactType,
          lifecycleStatus: artifact.lifecycleStatus, currentRevision: artifact.currentRevision,
          currentRef: artifact.currentRef, intendedDestination: artifact.intendedDestination,
          createdAt: artifact.createdAt,
        },
        // Do not serialize authors or source-message identities the dashboard does not display.
        revision: resolved.revision ? { id: resolved.revision.id, content: resolved.revision.content, createdAt: resolved.revision.createdAt } : null,
        review: reviews.status === "read" ? reviews.states[artifact.id] ?? null : null,
        package: pkg,
        publication: publications.get(artifact.currentRef) ?? null,
        measurement: measurements.get(artifact.currentRef) ?? null,
      };
    })));
  }
  return {
    content, reviewsAvailable: reviews.status === "read", publicationsAvailable: [...publications.values()].every((p) => p.status !== "unknown"),
    authorized: authority.authorized, contentAvailable: listing.status === "read",
    contentTruncated: listing.status === "read" && listing.artifacts.length > artifacts.length,
    purposes: indexArtifactWorkPurpose(evidence, work),
    purposeWindowFull: evidence.status === "available" && evidence.references.length >= MAX_WORK_EVIDENCE_REFERENCES,
  };
}
export type ApprovalsDashboardRead = Awaited<ReturnType<typeof readApprovalsDashboard>>;
export type DashboardContent = ApprovalsDashboardRead["content"][number];
