import { KnowledgeWorkspace } from "@/components/knowledge-workspace/knowledge-workspace";
import { KnowledgeAuthoringCard, type KnowledgeAuthoringBlock } from "@/components/knowledge-workspace/knowledge-authoring-card";
import { KnowledgeIngestionCard } from "@/components/knowledge-workspace/knowledge-ingestion-card";
import { KnowledgeRecords } from "@/components/knowledge-workspace/knowledge-records";
import { getKnowledgeWorkspaceModel } from "@/features/knowledge/workspace-model";
import { listKnowledgeSources } from "@/features/knowledge/knowledge-read.server";
import { resolveKnowledgeWriteAuthority } from "@/features/knowledge/knowledge-write-authority.server";
import { isDurableKnowledgeConfigured } from "@/features/knowledge/durable-knowledge-repository.server";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/decision-authority.server";
import {
  KnowledgeReviewCard,
  type ReviewBlock,
} from "@/components/knowledge-workspace/knowledge-review-card";

export const metadata = { title: "Knowledge Overview — Hebun AI" };

/*
 * Knowledge Overview (Phase 9 honesty, refined in UI Phase 21B, extended by K1 and K2) —
 * the Knowledge workspace landing, and the surface that OWNS Knowledge management.
 *
 * K1 added the real tenant-scoped read of the canonical Knowledge authority; K2 adds the governed
 * creation of a record inside it. Both live here rather than inside Heby, because authority
 * ownership decides UI ownership: Heby CONSUMES Knowledge, this workspace GOVERNS it.
 *
 * The tenant, the actor and the write authority are all resolved SERVER-SIDE. An unauthenticated
 * visitor sees an honest sign-in state; an authenticated actor without the owner/director band sees
 * a truthful refusal rather than a form that will fail. Below that, the Phase 21B vocabulary model
 * remains unchanged — it describes what Knowledge IS; the sections above describe what this
 * organization actually HAS.
 */

export default async function KnowledgePage() {
  const tenant = await resolveTenantContext();

  const [listing, authority, governance] = await Promise.all([
    listKnowledgeSources(tenant),
    tenant ? resolveKnowledgeWriteAuthority(tenant) : Promise.resolve(null),
    // K4: Governance authority is a DIFFERENT authority from Knowledge authoring. Resolved
    // separately, and never inferred from the role band above.
    tenant ? resolveGovernanceAuthority(tenant) : Promise.resolve(null),
  ]);

  /*
   * The review block states the REAL reason, in resolution order. A Knowledge author who is not
   * the Governance authority sees a truthful refusal rather than a control that will fail.
   */
  const reviewBlock: ReviewBlock | undefined = !tenant
    ? { kind: "unauthenticated" }
    : !governance?.bootstrapDecisionId
      ? { kind: "no-governance-authority" }
      : !governance.authorized
        ? { kind: "not-the-governance-authority" }
        : undefined;

  const reviewable = listing.status === "read" ? listing.records : [];

  // The authoring block states the REAL reason the form is unusable, in resolution order.
  const block: KnowledgeAuthoringBlock | undefined = !tenant
    ? { kind: "unauthenticated" }
    : !isDurableKnowledgeConfigured()
      ? { kind: "persistence-unavailable" }
      : !authority?.authorized
        ? { kind: "forbidden", roleType: authority?.roleType ?? null }
        : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <KnowledgeRecords listing={listing} canAuthor={block === undefined} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <KnowledgeAuthoringCard block={block} />
          {/*
            Ingestion sits beside authoring because it is the SAME authority doing the same kind of
            act at a different scale — one paste instead of one sentence. The block is shared for
            exactly that reason: whatever stops you authoring stops you ingesting.
          */}
          <KnowledgeIngestionCard block={block} />
        </div>
      </div>
      {reviewable.length > 0 ? (
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          {reviewable.map((record) => (
            <KnowledgeReviewCard key={record.factId} record={record} block={reviewBlock} />
          ))}
        </div>
      ) : null}
      <KnowledgeWorkspace model={getKnowledgeWorkspaceModel()} />
    </div>
  );
}
