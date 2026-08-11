import { KnowledgeWorkspace } from "@/components/knowledge-workspace/knowledge-workspace";
import { KnowledgeAuthoringCard, type KnowledgeAuthoringBlock } from "@/components/knowledge-workspace/knowledge-authoring-card";
import { KnowledgeRecords } from "@/components/knowledge-workspace/knowledge-records";
import { getKnowledgeWorkspaceModel } from "@/features/knowledge/workspace-model";
import { listKnowledgeSources } from "@/features/knowledge/knowledge-read.server";
import { resolveKnowledgeWriteAuthority } from "@/features/knowledge/knowledge-write-authority.server";
import { isDurableKnowledgeConfigured } from "@/features/knowledge/durable-knowledge-repository.server";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";

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

  const [listing, authority] = await Promise.all([
    listKnowledgeSources(tenant),
    tenant ? resolveKnowledgeWriteAuthority(tenant) : Promise.resolve(null),
  ]);

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
        <div className="min-w-0">
          <KnowledgeAuthoringCard block={block} />
        </div>
      </div>
      <KnowledgeWorkspace model={getKnowledgeWorkspaceModel()} />
    </div>
  );
}
