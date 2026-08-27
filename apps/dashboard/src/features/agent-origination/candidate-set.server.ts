/*
 * agent-origination/candidate-set.server.ts — what a durable agent is allowed to choose from
 * (AGENT-PROPOSAL-1).
 *
 * ── THE SERVER BUILDS THE CHOICE SPACE ───────────────────────────────────────
 *
 * The agent never proposes a reference it thought of. It proposes one of these, or nothing. Both
 * lists come from released, tenant-scoped read seams — `listActiveRecipients` (R3R) and
 * `listWorkArtifacts` (R3W) — so membership in the set already means "this tenant owns this row".
 *
 * ── THE NARROW PROJECTION IS THE PRIVACY BOUNDARY ────────────────────────────
 *
 * `RecipientView` carries `endpointValue`: the actual address. R3A.1 established that the raw
 * address never enters a proposal, and it must not enter a model prompt either. Projecting to
 * `{ ref, label }` here means the address is absent from the agent's context BY CONSTRUCTION —
 * there is no field on the candidate type that could hold one, so no later caller can leak it by
 * forgetting to strip it. Nothing else on either view is carried: no digest, no id, no tenant, no
 * actor, no timestamp, no content.
 *
 * ── ONLY PROPOSABLE THINGS ARE OFFERED ───────────────────────────────────────
 *
 * Retired recipients are excluded by calling the active-only seam, which takes no status parameter
 * precisely so a caller cannot widen the set. Retired artifacts are excluded here, and only the
 * artifact's CURRENT revision reference is offered — R3W's rule is that a superseded revision is
 * not proposable, so offering one would produce a candidate the inlet is required to refuse.
 *
 * Server-only. Reads only; this module writes nothing.
 */
import { listActiveRecipients } from "@/features/external-recipients/read-external-recipients.server";
import type { RecipientReadDeps } from "@/features/external-recipients/read-external-recipients.server";
import { listWorkArtifacts } from "@/features/work-artifacts/read-work-artifacts.server";
import type { WorkArtifactReadDeps } from "@/features/work-artifacts/read-work-artifacts.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { MAX_CANDIDATES_PER_KIND, type OriginationCandidateSet } from "./contracts";

export interface CandidateSetDeps {
  readonly recipients?: RecipientReadDeps;
  readonly artifacts?: WorkArtifactReadDeps;
}

/**
 * Build this tenant's candidate set for one origination attempt.
 *
 * An UNAVAILABLE read is reported as an empty list rather than as a fabricated one. The caller
 * refuses with `no-candidates`, which is honest in both cases: whether the tenant has nothing or
 * the read failed, there is nothing an agent may legitimately choose right now.
 *
 * The bound is a ceiling on the prompt, not a filter on truth: a tenant with more rows than the
 * bound simply offers the first `MAX_CANDIDATES_PER_KIND` in each seam's own released order. It is
 * stated here rather than hidden so nobody reads a short list as "this is everything you own".
 */
export async function buildOriginationCandidates(
  tenant: TenantContext | null,
  deps: CandidateSetDeps = {},
): Promise<OriginationCandidateSet> {
  if (typeof window !== "undefined") {
    throw new Error("Origination candidates are server-only.");
  }
  if (!tenant?.tenantId) return { recipients: [], drafts: [] };

  const recipientListing = await listActiveRecipients(tenant, deps.recipients ?? {});
  const artifactListing = await listWorkArtifacts(tenant, deps.artifacts ?? {});

  const recipients = recipientListing.recipients
    .slice(0, MAX_CANDIDATES_PER_KIND)
    /* `ref` and `label` ONLY. The address has no field to travel in. */
    .map((recipient) => ({ ref: recipient.recordRef, label: recipient.displayName }));

  const drafts =
    artifactListing.status === "read"
      ? artifactListing.artifacts
          .filter((artifact) => artifact.lifecycleStatus === "draft")
          .slice(0, MAX_CANDIDATES_PER_KIND)
          /* The CURRENT revision reference. A superseded one is not proposable. */
          .map((artifact) => ({ ref: artifact.currentRef, label: artifact.title }))
      : [];

  return { recipients, drafts };
}

/** Whether there is anything at all an agent could propose. Both halves are required for a send. */
export function candidatesAreProposable(candidates: OriginationCandidateSet): boolean {
  return candidates.recipients.length > 0 && candidates.drafts.length > 0;
}
