/*
 * live-map/contracts.ts — L4. THE SHAPE OF A MAP THAT CANNOT LIE.
 *
 * ── WHAT LIVE MAP IS ─────────────────────────────────────────────────────────
 *
 *     AUTHORITATIVE SYSTEMS  ->  BOUNDED READ SEAMS  ->  LIVE MAP PROJECTION  ->  USER
 *
 * and never the other way round. Live Map composes facts other subsystems own. Composing them does
 * not make it authoritative over any of them, and it owns no lifecycle, no authorization, no
 * execution, no provider state and no security state.
 *
 * ── THE ADMISSION RULE, ENFORCED BY THE TYPE ─────────────────────────────────
 *
 * `truth` has exactly ONE representable value: `"authoritative"`. That is deliberate and it is the
 * central mechanism of this milestone. A derived, seeded, mock or inferred node is not rejected at
 * runtime by a check somebody has to remember to write — it cannot be constructed at all. The
 * compiled-in organizational fixtures L1 disclosed are therefore unrepresentable here rather than
 * merely discouraged, and widening this union is the single edit a reviewer must refuse.
 *
 * ── WHY AN EDGE IS HARDER TO EARN THAN A NODE ────────────────────────────────
 *
 * A drawn edge asserts a relationship, and a relationship nobody owns is a fabrication with a line
 * through it. Core admits exactly ONE, and it carries the durable column that proves it:
 *
 *     agent  --belongs-to->  organization        basis: `agents.tenant_id`
 *
 * That is not "same tenant, therefore related". L3 established that in Hebun the organization IS
 * the tenant — `AuthoritativeOrganization.organizationId` is the tenant id — so this edge restates
 * one foreign key rather than inferring a peer relationship between two rows that happen to share a
 * scope. Every relationship that would need an inference is absent:
 *
 *     agent -> department      no department authority exists (L3)
 *     agent -> human           `agents.human_owner_id` is durable, but Live Map has no human node
 *                              and no roster read, so the far end does not exist to draw to
 *     human -> department      L3 measured that `roles` carries no `organization_id` at all
 *     agent -> work/goal       no authority
 *
 * ── FOUR DOMAIN STATES, AND THEY ARE NOT INTERCHANGEABLE ─────────────────────
 *
 *     available      the authority answered and there is something to show
 *     known-empty    the authority answered and the answer is genuinely zero
 *     unavailable    the authority could not be reached, or refused
 *     no-authority   nobody in Hebun owns this concept yet
 *
 * `known-empty` is only ever produced where a released seam can actually distinguish it. Today that
 * is exactly one domain — durable agent identity, whose reader separates "this tenant has created
 * no agent" from "the authority could not be reached" in its own type. Structure and people get
 * `no-authority`, because no owner exists to be empty.
 *
 *     UNAVAILABLE != EMPTY        NO DATA != KNOWN ZERO        NO AUTHORITY != ZERO
 *
 * ── NO REAL-TIME CLAIM, AND NO INVENTED TIMESTAMP ────────────────────────────
 *
 * This is a server read performed when the page was requested. It is not a stream, not a
 * subscription and not auto-refreshing, and nothing here records when it happened, because the
 * seams it composes expose no freshness fact and inventing one would be the easiest lie on the
 * surface to believe.
 *
 *     CURRENT READ != REAL-TIME STREAM
 */

/** The only kinds Core admits. Each earned its place from a released, tenant-scoped read seam. */
export type LiveMapNodeKind = "organization" | "agent";

/**
 * The truth classification of a rendered node.
 *
 * ONE VALUE, ON PURPOSE. Core renders authoritative facts or it renders nothing, so "derived",
 * "seeded" and "mock" are absent from the union rather than listed and refused. Adding one is how
 * fiction would enter, and it is a type change a reviewer cannot miss.
 */
export type LiveMapTruth = "authoritative";

/**
 * THE SECOND TRUTH CLASS ON THE SAME OBJECT (E2-3).
 *
 * ONE VALUE, exactly as `LiveMapTruth` has one — and deliberately a DIFFERENT one. A node's `truth`
 * says the node itself was read from an authority that owns it. An attachment's `truthClass` says
 * the numbers beside it were COMPOSED from records other authorities wrote, which is a weaker claim
 * and must never be able to impersonate the stronger one.
 *
 *     AUTHORITATIVE AGENT IDENTITY != AUTHORITATIVE OUTCOME
 *
 * Because the two live in separate fields with disjoint single-value unions, "authoritative" is
 * unrepresentable on an attachment and "derived" is unrepresentable on a node. Neither can drift
 * into the other by an edit somebody makes in good faith.
 */
export type LiveMapDerivedClass = "derived";

/** One number a Director reads, and what it refuses to mean. Counts only; never a proportion. */
export interface LiveMapMeasure {
  readonly label: string;
  readonly value: number;
  /** The sentence that keeps this number from being read as more than it is. */
  readonly note?: string;
}

/** Measures kept in their own groups, because collapsing lifecycle stages loses the distinction. */
export interface LiveMapMeasureGroup {
  readonly groupId: string;
  readonly label: string;
  readonly measures: readonly LiveMapMeasure[];
}

/**
 * Derived observation attached to an authoritative node.
 *
 * `unavailable` is a first-class variant rather than an absent attachment: a node rendered with no
 * numbers and no explanation reads as a node with nothing to show, which is the exact defect the
 * four domain states exist to prevent one level up.
 *
 *     UNAVAILABLE != ZERO ACTIVITY
 */
export type LiveMapNodeIntelligence =
  | {
      readonly status: "observed";
      readonly truthClass: LiveMapDerivedClass;
      /** The subsystem that OWNS this evidence. Live Map is never named here either. */
      readonly sourceAuthority: string;
      /** What the numbers are counted from, and over what span. Cumulative, and it says so. */
      readonly basis: string;
      readonly groups: readonly LiveMapMeasureGroup[];
      /** Rendered, not implied: what these counts do not prove. */
      readonly nonClaims: readonly string[];
    }
  | {
      readonly status: "unavailable";
      readonly truthClass: LiveMapDerivedClass;
      readonly sourceAuthority: string;
      readonly detail: string;
    };

/**
 * A node's own lifecycle state, as DATA rather than as a sentence to be parsed (LMX-1).
 *
 * The prose in `detail` already says this, and a visual map needs the same fact as a value: a
 * surface that decided "retired" by reading the first detail line would be one string edit away
 * from drawing a withdrawn agent as a working one. The authority that knows the state supplies it.
 *
 * It is PRESENTATION, not truth: `tone` selects a rendering, and `label` is the word a reader sees.
 * Neither adds a claim the node did not already make in words.
 */
export interface LiveMapNodeStatus {
  readonly label: string;
  readonly tone: "active" | "retired";
}

export interface LiveMapNode {
  /** Stable projection identity, kind-prefixed. A projection id, never a domain identifier. */
  readonly nodeId: string;
  readonly kind: LiveMapNodeKind;
  readonly label: string;
  readonly truth: LiveMapTruth;
  /** The subsystem that OWNS this fact. Live Map is never named here. */
  readonly sourceAuthority: string;
  /** Bounded provenance/evidence lines, already resolved into sentences by the owning authority. */
  readonly detail: readonly string[];
  /** Where the owning subsystem lives, when a real released route exists. Navigation, not control. */
  readonly openRoute?: string;
  /** The lifecycle word a reader sees on the node itself. Supplied by the owning authority. */
  readonly status?: LiveMapNodeStatus;
  /**
   * DERIVED evidence about this node, kept in its own field and never merged into `detail`.
   *
   * `detail` carries provenance lines the OWNING authority already resolved; this carries numbers
   * composed from a different authority's records. Merging them would put two truth classes in one
   * list of sentences, where a reader could not tell which was which.
   */
  readonly intelligence?: LiveMapNodeIntelligence;
  /**
   * E2-4 — ELAPSED TIME ABOUT THIS NODE, in its OWN field with its OWN authority.
   *
   * It is not folded into {@link intelligence}: that block is attributed to the Agent Outcome
   * Observation and carries cumulative counts, and a duration composed by a different authority
   * sitting inside it would be misattributed to the first. Three truth statements on one node
   * therefore live in three fields — `detail` (authoritative, owner-resolved), `intelligence`
   * (derived counts), `attention` (derived durations) — and a reader is never asked to tell them
   * apart inside one list.
   *
   * NO NODE KIND AND NO EDGE KIND IS ADDED BY THIS FIELD. It annotates a node that already exists,
   * with a fact that already belongs to it.
   */
  readonly attention?: LiveMapNodeAttention;
}

/**
 * A factual elapsed annotation on an existing node.
 *
 * It carries a duration and the column it was measured from. There is no severity, no tone, no
 * class and no flag, because Hebun holds no authority that could fill one — an "attention state"
 * would be a classification, and no policy owner for it exists.
 *
 *     AGE != IMPORTANCE     WAITING != LATE     ANNOTATION != CLASSIFICATION
 */
export interface LiveMapNodeAttention {
  /** Always `derived`. The records are authoritative; the duration is recomputed on read. */
  readonly truthClass: LiveMapDerivedClass;
  /** The subsystem that composed it. Live Map is never named here. */
  readonly sourceAuthority: string;
  /** What the duration is, and what it is not. Travels with the number, never omitted. */
  readonly basis: string;
  /** One line per observation: what it measures, the duration, and the column it came from. */
  readonly measures: readonly {
    readonly label: string;
    /** A DURATION, as words. Deliberately not a number — nothing here may be charted or ranked. */
    readonly value: string;
    readonly basis: string;
  }[];
  readonly nonClaims: readonly string[];
}

/** The one relationship Core can prove. Extending this union requires a durable owner for it. */
export type LiveMapRelation = "belongs-to";

export interface LiveMapEdge {
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly relation: LiveMapRelation;
  /** The durable fact that proves the edge. An edge without one may not be constructed. */
  readonly basis: string;
}

export type LiveMapDomainState =
  | { readonly status: "available"; readonly nodes: readonly LiveMapNode[] }
  | { readonly status: "known-empty"; readonly detail: string }
  | { readonly status: "unavailable"; readonly reason: string; readonly detail: string }
  | { readonly status: "no-authority"; readonly detail: string };

/** A domain Live Map shows, whether or not it can show anything in it. */
export interface LiveMapDomain {
  readonly domainId: string;
  readonly label: string;
  readonly state: LiveMapDomainState;
}

export interface LiveMapProjection {
  readonly domains: readonly LiveMapDomain[];
  /**
   * Edges across the WHOLE projection, drawn only when both endpoints are present. An edge to a
   * node that is not on the map would be a claim about something the reader cannot see.
   */
  readonly edges: readonly LiveMapEdge[];
  /** The honest description of what this reading is. No timestamp; see the header. */
  readonly freshness: string;
  /**
   * How complete the DERIVED attachment is — a statement about the join, never about the nodes.
   *
   * Present whenever the attachment could be read at all. It exists because a join that quietly
   * drops rows produces numbers that look whole, and a map is exactly the surface on which a
   * number that looks whole is believed.
   */
  readonly intelligenceCompleteness?: LiveMapIntelligenceCompleteness;
}

/** The one completeness signal E2-3 can prove, with the sentence that says what it means. */
export interface LiveMapIntelligenceCompleteness {
  readonly unresolvedAgentProposals: number;
  readonly detail: string;
}

export const LIVE_MAP_FRESHNESS =
  "A server read taken when this page was requested. Live Map is not a stream and does not " +
  "refresh on its own — reload to read again.";

/**
 * The domains Core represents, in render order. Structure and people are listed EXPLICITLY rather
 * than omitted: a map that silently leaves out departments reads as an organization that has none.
 */
export const LIVE_MAP_STRUCTURE_ABSENT =
  "Hebun has no authority for internal organizational structure, so departments, teams and " +
  "reporting lines cannot be shown. That is an absent authority, not an organization without them.";

export const LIVE_MAP_PEOPLE_ABSENT =
  "Hebun holds a count of this organization's human members but no authority that lists them, and " +
  "membership carries no departmental placement. People are therefore counted on the organization " +
  "and are not drawn as their own nodes.";

/**
 * The two sentences the derived attachment's completeness signal can say.
 *
 * Frozen so a test reads the milestone's own claim rather than re-deriving it, and so softening
 * either fails here rather than in front of a Director.
 */
export const LIVE_MAP_INTELLIGENCE_COMPLETENESS_WORDING = Object.freeze({
  placed:
    "Every agent-filed proposal this reading counted was placed on an agent identity shown above.",
  unresolved:
    "Proposals attributed to an agent identity this reading could not place. They are counted so " +
    "the numbers above are never quietly short, and no agent was invented to hold them.",
});

/** Frozen so a test can read the milestone's own claims instead of re-deriving them. */
export const LIVE_MAP_PROJECTION_MODEL = Object.freeze({
  kind: "read-only-projection" as const,
  /** Live Map owns no concept it displays. */
  ownsDomainTruth: false as const,
  /** No table, no migration, no persistence of projection state. */
  persistsProjection: false as const,
  writerCreated: false as const,
  /** It cannot authorize, execute, or reach a provider. */
  authorizesAction: false as const,
  executesAction: false as const,
  /** No stream, no subscription, no polling. */
  realTime: false as const,
  /**
   * E2-3. A derived observation may be ATTACHED to an authoritative node; it is never fused into
   * one. The node keeps its own truth, the attachment keeps its own, and they are separate fields.
   */
  attachesDerivedObservation: true as const,
  /** And a count stays a count: nothing here divides one number by another. */
  producesProportion: false as const,
  comparesAgents: false as const,
  producesJudgement: false as const,
  limitation:
    "Live Map shows what other authorities already know. It cannot create, move, rename or retire " +
    "anything it draws, and a domain with no owner is shown as having no owner rather than as empty.",
});
