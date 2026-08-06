/**
 * Enterprise Organizational Intelligence Runtime — assembly rules (Phase 2).
 *
 * Pure, deterministic lookups over the canonical foundation descriptors, and
 * deterministic Runtime Dependency Resolution: projecting a Phase 1 context's declared
 * dependencies into the resolved read-only foundation sources the assembly composes.
 * These answer plain questions — what order is this foundation, which dependency does
 * it resolve from, which foundations does a context reach — and enumerate an assembly's
 * sources. NO runtime behaviour, NO orchestration, NO generation, NO computation beyond
 * table reads and pure projections.
 */

import { RUNTIME_FOUNDATION_KIND_DESCRIPTORS } from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-types";
import type {
  RuntimeAssembly,
  RuntimeBundle,
  RuntimeFoundationKind,
  RuntimeFoundationKindDescriptor,
  RuntimeFoundationSource,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-types";
import type { RuntimeDependencyKind } from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type { RuntimeContext } from "@/features/enterprise-organizational-intelligence-runtime/runtime-types";

// --- Foundation lookups ------------------------------------------------------

export function runtimeFoundationKindDescriptorOf(
  kind: RuntimeFoundationKind,
): RuntimeFoundationKindDescriptor {
  return RUNTIME_FOUNDATION_KIND_DESCRIPTORS[kind];
}

export function runtimeFoundationKindOrderOf(kind: RuntimeFoundationKind): number {
  return RUNTIME_FOUNDATION_KIND_DESCRIPTORS[kind].order;
}

/** The Phase 1 dependency kind a foundation is resolved from. */
export function runtimeFoundationDependencyKindOf(kind: RuntimeFoundationKind): RuntimeDependencyKind {
  return RUNTIME_FOUNDATION_KIND_DESCRIPTORS[kind].dependencyKind;
}

/** Every foundation the Runtime assembles, in canonical order. All three are required. */
export function runtimeRequiredFoundationKinds(): readonly RuntimeFoundationKind[] {
  return Object.values(RUNTIME_FOUNDATION_KIND_DESCRIPTORS)
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((descriptor) => descriptor.foundationKind);
}

// --- Runtime dependency resolution -------------------------------------------

/**
 * Resolves the three foundation sources from a context's declared dependencies, in
 * canonical foundation order. For each required foundation kind, the first declared
 * dependency of its matching dependency kind is bound as a read-only source; each
 * dependency object is carried through UNCHANGED. A foundation whose dependency is not
 * declared is simply not resolved — validation is what fails such a request closed.
 */
export function resolveRuntimeFoundationSources(
  context: RuntimeContext,
): readonly RuntimeFoundationSource[] {
  const sources: RuntimeFoundationSource[] = [];
  for (const foundationKind of runtimeRequiredFoundationKinds()) {
    const dependencyKind = runtimeFoundationDependencyKindOf(foundationKind);
    const dependency = context.dependencies.find((candidate) => candidate.dependencyKind === dependencyKind);
    if (dependency === undefined) continue;
    sources.push({
      foundationKind,
      dependencyKind: dependency.dependencyKind,
      referenceId: dependency.referenceId,
      version: dependency.version,
    });
  }
  return sources;
}

/**
 * True when a context reaches every required foundation — that is, when all three
 * foundations resolve from its declared dependencies. A well-formed assembly binds
 * Enterprise Memory, Enterprise Memory Reasoning, and Enterprise Organizational
 * Intelligence together.
 */
export function reachesAllFoundations(context: RuntimeContext): boolean {
  const resolved = new Set(resolveRuntimeFoundationSources(context).map((source) => source.foundationKind));
  return runtimeRequiredFoundationKinds().every((kind) => resolved.has(kind));
}

// --- Projections -------------------------------------------------------------

/** The resolved foundation sources of an assembly, in natural order. Read-only projection. */
export function foundationSourcesOf(assembly: RuntimeAssembly): readonly RuntimeFoundationSource[] {
  return assembly.sources;
}

/** The assembly a bundle carries. Read-only projection. */
export function assemblyOf(bundle: RuntimeBundle): RuntimeAssembly {
  return bundle.assembly;
}
