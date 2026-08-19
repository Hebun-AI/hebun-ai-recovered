/*
 * work-artifacts/work-artifact-evidence.server.ts — the server seam that makes prepared work
 * retrievable (R3W).
 *
 * It produces one `SourceResolution` — the same shape Operations, Platform and Knowledge produce —
 * so an artifact enters the evidence set through the SAME deterministic path as everything else.
 * That matters more than it looks: the response validator rejects any evidence reference the
 * assembler did not build, so a model can never invent `work-artifact/<uuid>@3` and have it
 * accepted as a citation. Evidence identity comes only from a real tenant-scoped read.
 *
 * WHY THE PURE RESOLVER CANNOT DO THIS. `heby-runtime/source-resolver.ts` is pure — it holds no
 * tenant and can open no connection — so it honestly reports `work-artifacts` as unavailable. This
 * module is the server seam that supplies what it cannot. Exactly the K1 arrangement for
 * Knowledge, deliberately not a new pattern.
 *
 * ONLY CURRENT REVISIONS ARE OFFERED AS EVIDENCE. A superseded revision stays readable forever
 * through `resolveWorkArtifactReference`, but it is not surfaced as a proposable referent: an
 * action prepared today should be prepared against what the artifact says today. Retired artifacts
 * are excluded for the same reason.
 *
 * AUTHORITATIVE IS ALWAYS FALSE. Prepared work is never organizational truth, however carefully it
 * was written and whoever wrote it. That is not a hedge; it is the boundary between this domain
 * and Knowledge.
 *
 * Server-only. Reads only.
 */
import { and, desc, eq } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import { workArtifactRevisions, workArtifacts } from "@/db/schema/work-artifact";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { SourceResolution } from "@/features/heby-runtime";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import { formatWorkArtifactRef } from "./artifact-ref";

const WORK_ARTIFACT_PROVENANCE =
  "Work artifacts — prepared work held by your organization. Durable and tenant-scoped, and never authoritative (authoritative: false).";

/** How much of a revision a grounding line may carry. Bounded so evidence never becomes storage. */
const EXCERPT_LIMIT = 400;

export interface WorkArtifactEvidenceDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

function unavailable(reason: string): SourceResolution {
  return {
    sourceClass: "work-artifacts",
    state: "unavailable",
    provenance: WORK_ARTIFACT_PROVENANCE,
    authoritative: false,
    items: [],
    unavailableReason: reason,
  };
}

function excerpt(content: string): { text: string; truncated: boolean } {
  const characters = [...content];
  if (characters.length <= EXCERPT_LIMIT) return { text: content, truncated: false };
  return { text: `${characters.slice(0, EXCERPT_LIMIT).join("")}...`, truncated: true };
}

/**
 * Resolve this tenant's current-revision artifacts into one source resolution.
 *
 * An empty organization resolves to `unavailable`, not to an empty `resolved` — the same
 * distinction `toKnowledgeResolution` draws, and for the same reason: an empty "resolved" source
 * would read as "we searched and found nothing" rather than "there is nothing here yet", and those
 * are different statements about the organization.
 */
export async function resolveWorkArtifactSource(
  tenant: TenantContext | null,
  deps: WorkArtifactEvidenceDeps = {},
): Promise<SourceResolution> {
  if (typeof window !== "undefined") {
    throw new Error("Work artifact evidence is server-only.");
  }
  if (!tenant?.tenantId) return unavailable("No authorized tenant context was supplied.");

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return unavailable("Durable persistence is not configured, so nothing was read.");

  try {
    /*
     * The join is on (tenant_id, artifact_id, revision_no = current_revision), so exactly one
     * revision per artifact comes back and it is always the current one. Doing this in SQL rather
     * than by filtering in memory is what keeps a superseded revision from ever entering the
     * candidate set in the first place.
     */
    const rows = await db
      .select({
        artifactId: workArtifacts.id,
        title: workArtifacts.title,
        artifactType: workArtifacts.artifactType,
        currentRevision: workArtifacts.currentRevision,
        content: workArtifactRevisions.content,
        contentDigest: workArtifactRevisions.contentDigest,
        authoredByActorType: workArtifactRevisions.authoredByActorType,
        createdAt: workArtifactRevisions.createdAt,
      })
      .from(workArtifacts)
      .innerJoin(
        workArtifactRevisions,
        and(
          eq(workArtifactRevisions.tenantId, workArtifacts.tenantId),
          eq(workArtifactRevisions.artifactId, workArtifacts.id),
          eq(workArtifactRevisions.revisionNo, workArtifacts.currentRevision),
        ),
      )
      .where(
        and(
          eq(workArtifacts.tenantId, tenant.tenantId),
          eq(workArtifacts.artifactLifecycleStatus, "draft"),
        ),
      )
      .orderBy(desc(workArtifacts.createdAt));

    if (rows.length === 0) {
      return unavailable(
        "Your organization holds no prepared work. Work artifacts are created through Heby's preparation seam or authored directly; none has been yet.",
      );
    }

    const items = rows.map((row) => {
      const body = excerpt(row.content);
      return {
        recordRef: formatWorkArtifactRef(row.artifactId, row.currentRevision),
        label: row.title,
        detail: [
          `type: ${row.artifactType}`,
          `revision: ${row.currentRevision}`,
          `authored by: ${row.authoredByActorType}`,
          `digest: ${row.contentDigest.slice(0, 12)}…`,
          body.truncated ? "excerpt: truncated" : "excerpt: complete",
        ].join(" · "),
        /*
         * A current revision of a live artifact is `settled` in the evidence vocabulary: it is
         * the standing form of this work. It is NOT a claim that the content is true — lifecycle
         * describes the record's standing, and `authoritative: false` below describes its weight.
         */
        lifecycle: "settled" as const,
        content: body.text,
      };
    });

    return {
      sourceClass: "work-artifacts",
      state: "resolved",
      provenance: WORK_ARTIFACT_PROVENANCE,
      /* Never true. Prepared work is not organizational truth, and no row can make it so. */
      authoritative: false,
      items,
      unavailableReason: undefined,
    };
  } catch {
    return unavailable("Prepared work could not be read.");
  }
}
