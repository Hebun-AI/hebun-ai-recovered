/**
 * Heby Core — canonical identity contracts (Phase 1, Identity Foundation).
 *
 * The technology-neutral vocabulary of Heby's immutable identity: the primitive
 * aliases, the descriptor tables, and the identity shape every later Heby phase will
 * speak. Phase 1 defines the identity ONLY. It performs no interface behaviour, no
 * presentation, no explanation, no intent interpretation, no approval, no governance
 * enforcement, no model call, no runtime consumption, and no execution. There is no
 * engine, no algorithm, no persistence, no AI, no agent, no registry, no cache, no
 * scheduler, no API, and no UI here — only immutable, readonly declarations.
 *
 * Heby is the Executive Intelligence Interface of the organization: the interface
 * between the Director and the enterprise's intelligence systems. It explains,
 * summarizes, clarifies, navigates, exposes Runtime results and Director Briefings,
 * answers Director questions, and prepares information — read-only and non-authoritative.
 * It approves, decides, executes, invents, and automates nothing, and it never becomes
 * Runtime, Memory, Reasoning, Organizational Intelligence, a Workflow, an Orchestrator,
 * an Agent, or a Decision Engine. These descriptors encode that boundary in their shapes.
 *
 * Authority: docs/product-vision/heby-vision.md, heby-architecture.md, heby-roadmap.md.
 */

/** A canonical, opaque identity. Text only — carries no behaviour. */
export type HebyId = string;

/** A short, human-authored statement. Text only — carries no behaviour. */
export type HebyStatement = HebyId;

/** Heby's fixed name. There is exactly one. */
export type HebyName = "Heby";

/** Heby's fixed role. There is exactly one. */
export type HebyRole = "executive-intelligence-interface";

// --- Capabilities (Heby MAY) -------------------------------------------------

/**
 * The things Heby MAY do. Every capability is presentational or interrogative —
 * read-only, non-authoritative, and terminating at the Director. Not one is executive.
 */
export type HebyCapability =
  | "explain"
  | "summarize"
  | "clarify"
  | "navigate"
  | "expose-runtime"
  | "expose-director-briefing"
  | "answer-director-question"
  | "prepare-information";

/** The fixed, canonical properties of one Heby capability. */
export interface HebyCapabilityDescriptor {
  readonly capability: HebyCapability;
  /** A fixed integer for canonical capability ordering. Ordinal only — not a score. */
  readonly order: number;
  /** A short, fixed statement of the capability. Descriptive only. */
  readonly statement: HebyStatement;
}

/** The canonical descriptor for every Heby capability. Frozen and immutable. */
export const HEBY_CAPABILITY_DESCRIPTORS: Readonly<Record<HebyCapability, HebyCapabilityDescriptor>> =
  Object.freeze({
    explain: Object.freeze({ capability: "explain", order: 0, statement: "render meaning in plain terms" }),
    summarize: Object.freeze({ capability: "summarize", order: 1, statement: "synthesize at appropriate depth" }),
    clarify: Object.freeze({ capability: "clarify", order: 2, statement: "resolve ambiguous intent by asking" }),
    navigate: Object.freeze({ capability: "navigate", order: 3, statement: "move through evidence, sources, briefings, history" }),
    "expose-runtime": Object.freeze({ capability: "expose-runtime", order: 4, statement: "surface Runtime results read-only" }),
    "expose-director-briefing": Object.freeze({ capability: "expose-director-briefing", order: 5, statement: "present assembled Director Briefings" }),
    "answer-director-question": Object.freeze({ capability: "answer-director-question", order: 6, statement: "respond within authorized context" }),
    "prepare-information": Object.freeze({ capability: "prepare-information", order: 7, statement: "organize material for a human decision, review, or process" }),
  });

// --- Non-responsibilities (Heby MUST NEVER) ----------------------------------

/**
 * The things Heby MUST NEVER do. Every prohibition is explicit so that no later phase
 * can quietly acquire authority, action, invention, mutation, or Director bypass here.
 */
export type HebyNonResponsibility =
  | "approve"
  | "decide"
  | "execute"
  | "invent"
  | "hallucinate"
  | "modify-runtime"
  | "modify-memory"
  | "modify-reasoning"
  | "modify-organizational-intelligence"
  | "trigger-workflow"
  | "invoke-api"
  | "call-ai-independently"
  | "bypass-director";

/** The fixed, canonical properties of one Heby non-responsibility. */
export interface HebyNonResponsibilityDescriptor {
  readonly nonResponsibility: HebyNonResponsibility;
  /** A fixed integer for canonical non-responsibility ordering. Ordinal only. */
  readonly order: number;
  /** A short, fixed statement of the prohibition. Descriptive only. */
  readonly statement: HebyStatement;
}

/** The canonical descriptor for every Heby non-responsibility. Frozen and immutable. */
export const HEBY_NON_RESPONSIBILITY_DESCRIPTORS: Readonly<
  Record<HebyNonResponsibility, HebyNonResponsibilityDescriptor>
> = Object.freeze({
  approve: Object.freeze({ nonResponsibility: "approve", order: 0, statement: "never grant, infer, or stand in for approval" }),
  decide: Object.freeze({ nonResponsibility: "decide", order: 1, statement: "never make or imply a Director decision" }),
  execute: Object.freeze({ nonResponsibility: "execute", order: 2, statement: "never perform work or execution" }),
  invent: Object.freeze({ nonResponsibility: "invent", order: 3, statement: "never fabricate evidence, sources, or conclusions" }),
  hallucinate: Object.freeze({ nonResponsibility: "hallucinate", order: 4, statement: "never present ungrounded content as grounded" }),
  "modify-runtime": Object.freeze({ nonResponsibility: "modify-runtime", order: 5, statement: "never modify the Runtime" }),
  "modify-memory": Object.freeze({ nonResponsibility: "modify-memory", order: 6, statement: "never modify Memory" }),
  "modify-reasoning": Object.freeze({ nonResponsibility: "modify-reasoning", order: 7, statement: "never modify Reasoning" }),
  "modify-organizational-intelligence": Object.freeze({ nonResponsibility: "modify-organizational-intelligence", order: 8, statement: "never modify Organizational Intelligence" }),
  "trigger-workflow": Object.freeze({ nonResponsibility: "trigger-workflow", order: 9, statement: "never trigger or orchestrate a workflow" }),
  "invoke-api": Object.freeze({ nonResponsibility: "invoke-api", order: 10, statement: "never invoke an API" }),
  "call-ai-independently": Object.freeze({ nonResponsibility: "call-ai-independently", order: 11, statement: "never call AI independently to manufacture authority or bypass the Runtime" }),
  "bypass-director": Object.freeze({ nonResponsibility: "bypass-director", order: 12, statement: "never bypass the Director" }),
});

// --- Non-identities (Heby is NOT) --------------------------------------------

/** The systems and roles Heby is NOT. Heby is only the Director Interface. */
export type HebyNonIdentity =
  | "runtime"
  | "memory"
  | "reasoning"
  | "organizational-intelligence"
  | "workflow"
  | "orchestrator"
  | "agent"
  | "decision-engine";

/** The fixed, canonical properties of one Heby non-identity. */
export interface HebyNonIdentityDescriptor {
  readonly nonIdentity: HebyNonIdentity;
  /** A fixed integer for canonical non-identity ordering. Ordinal only. */
  readonly order: number;
  /** A short, fixed statement of what Heby is not. Descriptive only. */
  readonly statement: HebyStatement;
}

/** The canonical descriptor for every Heby non-identity. Frozen and immutable. */
export const HEBY_NON_IDENTITY_DESCRIPTORS: Readonly<Record<HebyNonIdentity, HebyNonIdentityDescriptor>> =
  Object.freeze({
    runtime: Object.freeze({ nonIdentity: "runtime", order: 0, statement: "Heby is not the Runtime" }),
    memory: Object.freeze({ nonIdentity: "memory", order: 1, statement: "Heby is not Memory" }),
    reasoning: Object.freeze({ nonIdentity: "reasoning", order: 2, statement: "Heby is not Reasoning" }),
    "organizational-intelligence": Object.freeze({ nonIdentity: "organizational-intelligence", order: 3, statement: "Heby is not Organizational Intelligence" }),
    workflow: Object.freeze({ nonIdentity: "workflow", order: 4, statement: "Heby is not a Workflow" }),
    orchestrator: Object.freeze({ nonIdentity: "orchestrator", order: 5, statement: "Heby is not an Orchestrator" }),
    agent: Object.freeze({ nonIdentity: "agent", order: 6, statement: "Heby is not an Agent" }),
    "decision-engine": Object.freeze({ nonIdentity: "decision-engine", order: 7, statement: "Heby is not a Decision Engine" }),
  });

// --- Principle kinds ---------------------------------------------------------

/** The kinds of principle a Heby identity declares. Naming and grouping only. */
export type HebyPrincipleKind = "communication" | "transparency" | "governance";

/**
 * One immutable group of principles: the kind it declares and its ordered, deduplicated
 * statements. Principles are human-authored declarations — they run nothing.
 */
export interface HebyPrincipleGroup {
  readonly kind: HebyPrincipleKind;
  readonly statements: readonly HebyStatement[];
}

// --- Identity ----------------------------------------------------------------

/**
 * Heby's immutable, canonical identity: who Heby is, what it is for, how it communicates,
 * how it treats transparency and governance, how it relates to approval, the Runtime, and
 * the Director, and the closed pair of what it MAY do and MUST NEVER do — plus the systems
 * it is NOT. The identity is technology-neutral: it names no model, vendor, database,
 * schema, or code. It is the constitutional anchor every later Heby phase consumes and
 * none may redefine.
 */
export interface HebyIdentity {
  readonly identity: HebyId;
  readonly name: HebyName;
  readonly role: HebyRole;
  readonly mission: HebyStatement;
  readonly communicationPrinciples: HebyPrincipleGroup;
  readonly transparencyPrinciples: HebyPrincipleGroup;
  readonly governancePrinciples: HebyPrincipleGroup;
  readonly approvalPhilosophy: HebyStatement;
  readonly runtimeRelationship: HebyStatement;
  readonly directorRelationship: HebyStatement;
  readonly capabilities: readonly HebyCapability[];
  readonly nonResponsibilities: readonly HebyNonResponsibility[];
  readonly nonIdentities: readonly HebyNonIdentity[];
}

/**
 * An identity that has passed through Heby identity normalization: capabilities,
 * non-responsibilities, and non-identities de-duplicated and canonically ordered, each
 * principle group deduplicated and ordered, and the whole identity frozen. Structurally a
 * {@link HebyIdentity}; the alias marks that canonical form has been applied.
 */
export type CanonicalHebyIdentity = HebyIdentity;
