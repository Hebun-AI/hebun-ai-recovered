/**
 * Enterprise Organizational Intelligence Runtime — assembly normalization (Phase 2).
 *
 * Deterministically canonicalizes a Runtime assembly and its bundle:
 *   - resolved foundation sources are de-duplicated by foundation kind and ordered by
 *     canonical foundation order — each source object is carried through UNCHANGED,
 *   - the bound Phase 1 context is canonicalized by reuse of Phase 1 normalization,
 *   - scope domains are de-duplicated and totally ordered (via Phase 1 scope
 *     normalization),
 *   - the whole bundle is emitted immutable and frozen.
 *
 * This is pure canonical normalization — NO runtime behaviour, NO generation, and NO
 * mutation or internal rewriting of any carried value. Ordering and de-duplication
 * happen by canonical key only. Keys use JSON encoding so they are unambiguous,
 * text-safe, UTF-8 stable, and NUL-safe.
 */

import type {
  CanonicalRuntimeBundle,
  RuntimeAssembly,
  RuntimeBundle,
  RuntimeFoundationKind,
  RuntimeFoundationSource,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-types";
import { runtimeFoundationKindOrderOf } from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-rules";
import {
  normalizeContext,
  normalizeScope,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-normalization";

/** An unambiguous, text-safe key for one resolved foundation source. */
export function runtimeFoundationSourceKey(source: RuntimeFoundationSource): string {
  return JSON.stringify([source.foundationKind, source.dependencyKind, source.referenceId, source.version]);
}

/**
 * De-duplicates resolved foundation sources by foundation kind and orders them by
 * canonical foundation order. First occurrence of a kind wins; each source object is
 * carried UNCHANGED.
 */
export function normalizeFoundationSources(
  sources: readonly RuntimeFoundationSource[],
): readonly RuntimeFoundationSource[] {
  const byKind = new Map<RuntimeFoundationKind, RuntimeFoundationSource>();
  for (const source of sources) {
    if (!byKind.has(source.foundationKind)) byKind.set(source.foundationKind, source);
  }
  return [...byKind.values()].sort(
    (left, right) => runtimeFoundationKindOrderOf(left.foundationKind) - runtimeFoundationKindOrderOf(right.foundationKind),
  );
}

/** Canonicalizes an assembly: its scope canonicalized and sources ordered, other fields unchanged. */
export function normalizeAssembly(assembly: RuntimeAssembly): RuntimeAssembly {
  return {
    organizationId: assembly.organizationId,
    tenantId: assembly.tenantId,
    scope: normalizeScope(assembly.scope),
    sources: normalizeFoundationSources(assembly.sources),
  };
}

/** A canonical key for a bundle: its identity, bound context, and ordered assembly sources. */
export function canonicalRuntimeBundleKey(bundle: CanonicalRuntimeBundle): string {
  return JSON.stringify([
    bundle.bundleId,
    bundle.context.organizationId,
    bundle.context.tenantId,
    bundle.context.scope.scopeId,
    bundle.assembly.organizationId,
    bundle.assembly.tenantId,
    bundle.assembly.scope.scopeId,
    bundle.assembly.sources.map(runtimeFoundationSourceKey),
    bundle.lifecycle,
  ]);
}

/**
 * Canonicalizes a Runtime bundle into an immutable, frozen form. Deterministic: the
 * same input always produces the same canonical bundle. Context, assembly, and sources
 * are canonicalized; every carried value is unchanged.
 */
export function normalizeRuntimeBundle(bundle: RuntimeBundle): CanonicalRuntimeBundle {
  const context = normalizeContext(bundle.context);
  const assembly = normalizeAssembly(bundle.assembly);
  return Object.freeze({
    bundleId: bundle.bundleId,
    context: Object.freeze({
      ...context,
      scope: Object.freeze(context.scope),
    }),
    assembly: Object.freeze({
      ...assembly,
      scope: Object.freeze(assembly.scope),
    }),
    lifecycle: bundle.lifecycle,
  });
}
