/**
 * Enterprise Organizational Intelligence — canonical core contracts (Phase 1).
 *
 * The shared vocabulary of Organizational Intelligence: the technology-neutral
 * shapes every later OI phase will speak. Phase 1 defines contracts ONLY. It
 * performs no learning, no optimization, no awareness behaviour, no evolution, no
 * decision, no action, and no runtime. There is no engine, no algorithm, no
 * persistence, no AI, no agent, no dashboard, and no runtime behaviour here — only
 * immutable, readonly type definitions.
 *
 * Organizational Intelligence observes and explains the enterprise; it never
 * acquires authority over it. It consumes governed evidence and published Reasoning
 * understanding read-only, and it decides, reorganizes, executes, and automates
 * nothing. These contracts encode that boundary in their shapes.
 */

export type OrganizationId = string;
export type OrganizationTimestamp = string;

/** A short, human-authored statement. Text only — carries no behaviour. */
export type OrganizationStatement = string;

/**
 * The kinds of artifact the OI vocabulary recognizes within an organization's
 * observed state. Naming only — this classifies contract shapes; it triggers no
 * behaviour and confers no authority.
 */
export type OrganizationArtifactKind =
  | "observation"
  | "constraint"
  | "capability"
  | "opportunity"
  | "risk"
  | "objective";

/** The fixed, canonical properties of an OI artifact kind. */
export interface OrganizationArtifactDescriptor {
  readonly artifactKind: OrganizationArtifactKind;
  /** Whether the kind must be grounded in read-only evidence to be well-formed. */
  readonly requiresBasis: boolean;
  /** A fixed integer for canonical cross-kind ordering. Ordinal only — not a score. */
  readonly layer: number;
}

/**
 * The canonical descriptor for every OI artifact kind. Frozen and immutable.
 * Observations, opportunities, and risks assert something about the enterprise and
 * so must be grounded in evidence; constraints, capabilities, and objectives are
 * declared structure and are not required to carry an evidence basis.
 */
export const ORGANIZATION_ARTIFACT_DESCRIPTORS: Readonly<
  Record<OrganizationArtifactKind, OrganizationArtifactDescriptor>
> = Object.freeze({
  observation: Object.freeze({ artifactKind: "observation", requiresBasis: true, layer: 0 }),
  constraint: Object.freeze({ artifactKind: "constraint", requiresBasis: false, layer: 1 }),
  capability: Object.freeze({ artifactKind: "capability", requiresBasis: false, layer: 2 }),
  opportunity: Object.freeze({ artifactKind: "opportunity", requiresBasis: true, layer: 3 }),
  risk: Object.freeze({ artifactKind: "risk", requiresBasis: true, layer: 4 }),
  objective: Object.freeze({ artifactKind: "objective", requiresBasis: false, layer: 5 }),
});

/** The common identity every OI artifact carries. */
export interface OrganizationArtifact {
  readonly id: OrganizationId;
  readonly kind: OrganizationArtifactKind;
}
