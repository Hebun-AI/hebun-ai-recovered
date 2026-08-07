/**
 * Heby Core — input and context contracts (Phase 2, Input and Context Consumption).
 *
 * Declares what an admitted input and a declared context ARE: the shapes through which
 * Heby consumes settled upstream artifacts — Runtime advisory outputs, settled Reasoning
 * understanding, and settled Memory context — READ-ONLY by reference, and binds them to a
 * declared enterprise context (role, domain, subject, authority basis, and applicable
 * constraints). Phase 2 admits and binds ONLY. It performs no interface behaviour, no
 * presentation, no explanation, no intent interpretation, no reasoning, no answer
 * generation, no decision, no approval, no execution, no model call, and no upstream
 * mutation. There is no engine, no algorithm, no persistence, no AI, no agent, no
 * registry, no cache, no scheduler, no API, and no UI here — only immutable, readonly
 * declarations.
 *
 * Heby consumes upstream artifacts by REFERENCE and PROVENANCE only: it never holds,
 * re-derives, or mutates their internal structure, and it never calls the Runtime,
 * Memory, or Reasoning to produce them. An admitted input is an attributable, read-only,
 * eligibility-checked reference to something a governed upstream system already settled.
 *
 * Authority: docs/product-vision/heby-vision.md, heby-architecture.md, heby-roadmap.md.
 * Builds on Heby Core Phase 1 (Identity Foundation).
 */

import type { HebyId, HebyStatement } from "@/features/heby-core/heby-identity-types";

// --- Input kinds -------------------------------------------------------------

/**
 * The three settled upstream sources Heby MAY admit read-only, per the Input Boundary.
 * Naming only — an input kind consumes nothing and confers no authority.
 */
export type HebyInputKind = "runtime-output" | "reasoning-understanding" | "memory-context";

/** The fixed, canonical properties of one admissible input kind. */
export interface HebyInputKindDescriptor {
  readonly kind: HebyInputKind;
  /** A fixed integer for canonical input ordering. Ordinal only — not a score. */
  readonly order: number;
  /** A short, fixed statement of the source. Descriptive only. */
  readonly statement: HebyStatement;
}

/** The canonical descriptor for every admissible input kind. Frozen and immutable. */
export const HEBY_INPUT_KIND_DESCRIPTORS: Readonly<Record<HebyInputKind, HebyInputKindDescriptor>> =
  Object.freeze({
    "runtime-output": Object.freeze({
      kind: "runtime-output",
      order: 0,
      statement: "an Organizational Intelligence Runtime advisory output, consumed read-only",
    }),
    "reasoning-understanding": Object.freeze({
      kind: "reasoning-understanding",
      order: 1,
      statement: "a settled Reasoning understanding, consumed read-only",
    }),
    "memory-context": Object.freeze({
      kind: "memory-context",
      order: 2,
      statement: "a settled Memory context, consumed read-only",
    }),
  });

// --- Source lifecycle --------------------------------------------------------

/**
 * The lifecycle state of a referenced upstream artifact. Only a settled artifact is
 * admissible; a superseded or retired artifact fails admission closed. Naming only.
 */
export type HebySourceLifecycle = "settled" | "superseded" | "retired";

/** The fixed, canonical properties of one source lifecycle state. */
export interface HebySourceLifecycleDescriptor {
  readonly lifecycle: HebySourceLifecycle;
  /** A fixed integer for canonical ordering. Ordinal only. */
  readonly order: number;
  /** Whether an artifact in this state may be admitted. Only "settled" is admissible. */
  readonly admissible: boolean;
}

/** The canonical descriptor for every source lifecycle state. Frozen and immutable. */
export const HEBY_SOURCE_LIFECYCLE_DESCRIPTORS: Readonly<
  Record<HebySourceLifecycle, HebySourceLifecycleDescriptor>
> = Object.freeze({
  settled: Object.freeze({ lifecycle: "settled", order: 0, admissible: true }),
  superseded: Object.freeze({ lifecycle: "superseded", order: 1, admissible: false }),
  retired: Object.freeze({ lifecycle: "retired", order: 2, admissible: false }),
});

// --- Constraint kinds --------------------------------------------------------

/** The kinds of constraint a declared context carries, consumed immutable. Naming only. */
export type HebyConstraintKind = "governance" | "security" | "privacy" | "classification";

/** The fixed, canonical properties of one constraint kind. */
export interface HebyConstraintKindDescriptor {
  readonly constraintKind: HebyConstraintKind;
  /** A fixed integer for canonical constraint ordering. Ordinal only. */
  readonly order: number;
  /** A short, fixed statement of the constraint kind. Descriptive only. */
  readonly statement: HebyStatement;
}

/** The canonical descriptor for every constraint kind. Frozen and immutable. */
export const HEBY_CONSTRAINT_KIND_DESCRIPTORS: Readonly<
  Record<HebyConstraintKind, HebyConstraintKindDescriptor>
> = Object.freeze({
  governance: Object.freeze({ constraintKind: "governance", order: 0, statement: "a Governance constraint, held immutable" }),
  security: Object.freeze({ constraintKind: "security", order: 1, statement: "a Security constraint, held immutable" }),
  privacy: Object.freeze({ constraintKind: "privacy", order: 2, statement: "a privacy constraint, held immutable" }),
  classification: Object.freeze({ constraintKind: "classification", order: 3, statement: "a classification constraint, held immutable" }),
});

// --- Provenance --------------------------------------------------------------

/**
 * The preserved provenance carried with an admitted input: source, attribution, logical
 * version, effective period, and source lifecycle. Distinct from and never a rewrite of
 * the upstream system's own provenance — Heby preserves it, unchanged. The effective
 * period is opaque text carried from the settled source; Heby never generates it.
 */
export interface HebyProvenance {
  readonly source: HebyStatement;
  readonly attribution: HebyStatement;
  /** A logical version number of the referenced artifact. Positive integer. Never a clock. */
  readonly version: number;
  /** Effective period carried from the source as opaque text. Never generated by Heby. */
  readonly effectivePeriod: HebyStatement;
  readonly lifecycle: HebySourceLifecycle;
}

// --- Constraint --------------------------------------------------------------

/**
 * One constraint bound to a declared context: its kind, its identity, and its statement.
 * Constraints are consumed immutable — Heby never enforces, waives, or authors them.
 */
export interface HebyConstraint {
  readonly constraintKind: HebyConstraintKind;
  readonly constraintId: HebyId;
  readonly statement: HebyStatement;
}

// --- Admitted input ----------------------------------------------------------

/**
 * One eligible, settled upstream artifact admitted read-only into Heby: its admission
 * identity, its input kind, the identity of the referenced upstream artifact, its
 * preserved provenance, and whether governance has marked it eligible. Heby holds a
 * reference — it reads nothing back, re-derives nothing, and mutates nothing upstream.
 */
export interface HebyAdmittedInput {
  readonly inputId: HebyId;
  readonly kind: HebyInputKind;
  readonly sourceId: HebyId;
  readonly provenance: HebyProvenance;
  readonly eligible: boolean;
}

// --- Declared context --------------------------------------------------------

/**
 * The declared enterprise context admitted inputs are bound to: its identity, the
 * person's role, the current domain, the subject under discussion, the authority basis,
 * the organization and tenant, and the applicable immutable constraints. Declaring a
 * context grants no authority and widens no scope.
 */
export interface HebyDeclaredContext {
  readonly contextId: HebyId;
  readonly role: HebyStatement;
  readonly domain: HebyStatement;
  readonly subject: HebyStatement;
  readonly authorityBasis: HebyStatement;
  readonly organizationId: HebyId;
  readonly tenantId: HebyId;
  readonly constraints: readonly HebyConstraint[];
}

// --- Admission request / binding ---------------------------------------------

/**
 * The declared request for one admission: an identity, the declared context, and the
 * proposed inputs to admit. A request is a declaration of intent and boundary — it
 * admits nothing on its own; admission happens only through validation at the boundary.
 */
export interface HebyAdmissionRequest {
  readonly requestId: HebyId;
  readonly context: HebyDeclaredContext;
  readonly inputs: readonly HebyAdmittedInput[];
}

/**
 * The deliverable of an admission: the validated, read-only admitted inputs bound to
 * their declared context. A binding is attributable and non-authoritative: it is never a
 * response, a decision, an approval, or an execution artifact. It preserves provenance
 * and source identity intact and terminates before any presentation or reasoning.
 */
export interface HebyContextBinding {
  readonly requestId: HebyId;
  readonly context: HebyDeclaredContext;
  readonly inputs: readonly HebyAdmittedInput[];
}

/**
 * A binding that has passed through input/context normalization: inputs de-duplicated and
 * canonically ordered, constraints de-duplicated and ordered, provenance carried
 * UNCHANGED, and the whole binding deep-frozen. Structurally a {@link HebyContextBinding};
 * the alias marks that canonical form has been applied.
 */
export type CanonicalHebyContextBinding = HebyContextBinding;
