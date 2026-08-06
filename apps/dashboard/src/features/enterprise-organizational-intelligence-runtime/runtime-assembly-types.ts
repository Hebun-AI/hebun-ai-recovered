/**
 * Enterprise Organizational Intelligence Runtime — Runtime Context & Assembly ontology (Phase 2).
 *
 * Declares what a Runtime Assembly IS: the shapes through which the Runtime binds the
 * three published foundations — Enterprise Memory, Enterprise Memory Reasoning, and
 * Enterprise Organizational Intelligence — into one immutable Runtime Bundle. It
 * introduces the canonical foundation vocabulary, the resolved read-only foundation
 * source, the assembled organization picture, the bundle that packages them, and the
 * request and session shapes that carry an assembly.
 *
 * Phase 2 ONLY assembles. It consumes the three settled foundations read-only. It
 * performs no reasoning, no learning, no optimization, no awareness, no evolution, no
 * orchestration, no AI, no LLM, no execution, no workflow, no planning, no
 * persistence, no API, and no UI. These shapes describe an assembly; they run nothing,
 * hold no state, and mutate nothing. They build only on the Phase 1 Runtime contracts
 * and types.
 */

import type {
  RuntimeDependencyKind,
  RuntimeId,
  RuntimeLifecycleState,
  RuntimeStatus,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type {
  RuntimeContext,
  RuntimeScope,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-types";

/**
 * The three published foundations the Runtime assembles, each consumed read-only. One
 * foundation kind per settled upstream layer. Naming only — declaring a foundation
 * reads nothing and mutates nothing.
 */
export type RuntimeFoundationKind =
  | "enterprise-memory"
  | "enterprise-memory-reasoning"
  | "enterprise-organizational-intelligence";

/** The fixed, canonical properties of a Runtime foundation kind. */
export interface RuntimeFoundationKindDescriptor {
  readonly foundationKind: RuntimeFoundationKind;
  /** The Phase 1 dependency kind this foundation is resolved from. */
  readonly dependencyKind: RuntimeDependencyKind;
  /** A fixed integer for canonical foundation ordering. Ordinal only — not a score. */
  readonly order: number;
}

/**
 * The canonical descriptor for every Runtime foundation kind. Frozen and immutable.
 * Each foundation maps one-to-one onto exactly one Phase 1 settled dependency kind, so
 * the Runtime resolves foundations from the very dependencies a Phase 1 context already
 * declares — it invents no new input surface.
 */
export const RUNTIME_FOUNDATION_KIND_DESCRIPTORS: Readonly<
  Record<RuntimeFoundationKind, RuntimeFoundationKindDescriptor>
> = Object.freeze({
  "enterprise-memory": Object.freeze({
    foundationKind: "enterprise-memory",
    dependencyKind: "memory-context",
    order: 0,
  }),
  "enterprise-memory-reasoning": Object.freeze({
    foundationKind: "enterprise-memory-reasoning",
    dependencyKind: "reasoning-understanding",
    order: 1,
  }),
  "enterprise-organizational-intelligence": Object.freeze({
    foundationKind: "enterprise-organizational-intelligence",
    dependencyKind: "organization-assembly",
    order: 2,
  }),
});

/**
 * One resolved, read-only handle to a settled published foundation: the foundation
 * kind, the Phase 1 dependency kind it was resolved from, and the specific referenced
 * identity and version it is pinned to. A source references a settled input; it reads
 * nothing and holds no content of its own.
 */
export interface RuntimeFoundationSource {
  readonly foundationKind: RuntimeFoundationKind;
  readonly dependencyKind: RuntimeDependencyKind;
  readonly referenceId: RuntimeId;
  readonly version: number;
}

/**
 * The bounded, attributable organization picture the Runtime assembles: the
 * organization and tenant it is bound to, the scope it is declared against, and the
 * three resolved foundation sources it composes — canonically ordered, exactly one per
 * foundation. An assembly composes references; it derives, concludes, and decides
 * nothing.
 */
export interface RuntimeAssembly {
  readonly organizationId: RuntimeId;
  readonly tenantId: RuntimeId;
  readonly scope: RuntimeScope;
  readonly sources: readonly RuntimeFoundationSource[];
}

/**
 * The single immutable Runtime Context the phase produces: an identity, the bound
 * Phase 1 context it was assembled under, the assembled organization picture, and the
 * lifecycle state it rests in. A bundle is the closed, frozen result of an assembly —
 * it carries settled references and their composition, and nothing authoritative.
 */
export interface RuntimeBundle {
  readonly bundleId: RuntimeId;
  readonly context: RuntimeContext;
  readonly assembly: RuntimeAssembly;
  readonly lifecycle: RuntimeLifecycleState;
}

/**
 * The declared request for one Runtime assembly: an identity and the Phase 1 context
 * whose settled dependencies are to be resolved and bound. A request is a declaration
 * of intent and boundary — it performs no assembly on its own.
 */
export interface RuntimeAssemblyRequest {
  readonly requestId: RuntimeId;
  readonly context: RuntimeContext;
}

/**
 * The identity and position of a Runtime assembly: its session identity, the request
 * it realizes, its overall status, and the lifecycle state it rests in. A session is a
 * positional record — it drives nothing and holds no hidden state.
 */
export interface RuntimeAssemblySession {
  readonly sessionId: RuntimeId;
  readonly requestId: RuntimeId;
  readonly status: RuntimeStatus;
  readonly lifecycle: RuntimeLifecycleState;
}

/**
 * A bundle that has passed through Runtime assembly normalization: context, assembly
 * sources, and scope domains de-duplicated and canonically ordered. Structurally a
 * {@link RuntimeBundle}; the alias marks that canonical form has been applied.
 */
export type CanonicalRuntimeBundle = RuntimeBundle;
