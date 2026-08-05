/**
 * Enterprise Organizational Intelligence — organization assembly normalization (Phase 2).
 *
 * Deterministically assembles a canonical organization bundle:
 *   - each artifact set is de-duplicated and totally ordered by its canonical id —
 *     each artifact object is carried through UNCHANGED, never rewritten,
 *   - the assembly index (chain), summary, and evidence basis are derived
 *     deterministically from that canonical context,
 *   - the whole bundle is emitted immutable and frozen.
 *
 * This is pure canonical assembly — NO intelligence, NO new artifact, and NO mutation
 * or internal rewriting of any gathered artifact. Ordering and de-duplication happen
 * by canonical id only; the artifact values are the very objects Phase 1 produced.
 * Keys use JSON encoding so they are unambiguous, text-safe, UTF-8 stable, NUL-safe.
 */

import type { Organization } from "@/features/enterprise-organizational-intelligence/organization";
import type { OrganizationScope } from "@/features/enterprise-organizational-intelligence/organization-scope";
import type { OrganizationObjective } from "@/features/enterprise-organizational-intelligence/organization-objective";
import type { OrganizationState } from "@/features/enterprise-organizational-intelligence/organization-state";
import type {
  OrganizationAssembly,
  OrganizationAssemblyBundle,
  OrganizationAssemblyChain,
  OrganizationAssemblyContext,
  OrganizationAssemblyReference,
} from "@/features/enterprise-organizational-intelligence/organization-assembly-types";
import {
  basisOf,
  organizationAssemblyLayerOf,
  referencesOf,
  summaryOf,
} from "@/features/enterprise-organizational-intelligence/organization-assembly-rules";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * De-duplicates and totally orders a set by canonical id, carrying each original
 * object UNCHANGED. First occurrence of a duplicate id wins.
 */
function canonicalizeById<T>(items: readonly T[], idOf: (item: T) => string): readonly T[] {
  const byId = new Map<string, T>();
  for (const item of items) {
    const id = idOf(item);
    if (!byId.has(id)) byId.set(id, item);
  }
  return [...byId.keys()].sort(compareStrings).map((id) => {
    const item = byId.get(id);
    if (item === undefined) throw new Error("canonicalizeById: missing item");
    return item;
  });
}

/** An unambiguous, text-safe key for one assembly reference. */
export function organizationAssemblyReferenceKey(reference: OrganizationAssemblyReference): string {
  return JSON.stringify([reference.artifactKind, reference.artifactId]);
}

/** Deterministic total order over references: by canonical layer, then id, then kind. */
function compareReference(left: OrganizationAssemblyReference, right: OrganizationAssemblyReference): number {
  const byLayer = organizationAssemblyLayerOf(left.artifactKind) - organizationAssemblyLayerOf(right.artifactKind);
  if (byLayer !== 0) return byLayer;
  const byId = compareStrings(left.artifactId, right.artifactId);
  if (byId !== 0) return byId;
  return compareStrings(left.artifactKind, right.artifactKind);
}

/**
 * Canonicalizes every artifact set by de-duplicating and ordering on canonical id.
 * Each artifact is carried UNCHANGED — no internal field is rewritten or re-derived.
 */
export function normalizeContext(context: OrganizationAssemblyContext): OrganizationAssemblyContext {
  const organization: Organization = {
    organizationId: context.organization.organizationId,
    statement: context.organization.statement,
    domains: canonicalizeById(context.organization.domains, (domain) => domain.domainId),
  };
  const scope: OrganizationScope = context.scope;
  const objectives: readonly OrganizationObjective[] = canonicalizeById(
    context.objectives,
    (objective) => objective.objectiveId,
  );
  const state: OrganizationState = {
    observations: canonicalizeById(context.state.observations, (observation) => observation.observationId),
    constraints: canonicalizeById(context.state.constraints, (constraint) => constraint.constraintId),
    capabilities: canonicalizeById(context.state.capabilities, (capability) => capability.capabilityId),
    opportunities: canonicalizeById(context.state.opportunities, (opportunity) => opportunity.opportunityId),
    risks: canonicalizeById(context.state.risks, (risk) => risk.riskId),
  };
  return { organization, scope, objectives, state };
}

/** De-duplicates and totally orders an index of references. */
export function normalizeChain(references: readonly OrganizationAssemblyReference[]): OrganizationAssemblyChain {
  const byKey = new Map<string, OrganizationAssemblyReference>();
  for (const reference of references) {
    const key = organizationAssemblyReferenceKey(reference);
    if (!byKey.has(key)) byKey.set(key, reference);
  }
  return { references: [...byKey.values()].sort(compareReference) };
}

/**
 * Derives the canonical assembly record from an already-normalized context. The
 * chain, summary, and basis are all projections of the context — nothing is invented.
 */
export function assembleOrganization(normalizedContext: OrganizationAssemblyContext): OrganizationAssembly {
  return {
    organizationId: normalizedContext.organization.organizationId,
    scopeId: normalizedContext.scope.scopeId,
    chain: normalizeChain(referencesOf(normalizedContext)),
    summary: summaryOf(normalizedContext),
    basis: basisOf(normalizedContext),
  };
}

/** A canonical key for a bundle: its organization, scope, and ordered reference index. */
export function canonicalOrganizationAssemblyKey(bundle: OrganizationAssemblyBundle): string {
  return JSON.stringify([
    bundle.assembly.organizationId,
    bundle.assembly.scopeId,
    bundle.assembly.chain.references.map(organizationAssemblyReferenceKey),
  ]);
}

/**
 * Assembles a canonical, immutable organization bundle from a proposed context.
 * Deterministic: the same input always produces the same bundle. The context is
 * canonicalized and the assembly index is derived from it.
 */
export function normalizeOrganizationAssemblyBundle(
  context: OrganizationAssemblyContext,
): OrganizationAssemblyBundle {
  const normalizedContext = normalizeContext(context);
  const assembly = assembleOrganization(normalizedContext);
  return Object.freeze({ assembly: Object.freeze(assembly), context: Object.freeze(normalizedContext) });
}
