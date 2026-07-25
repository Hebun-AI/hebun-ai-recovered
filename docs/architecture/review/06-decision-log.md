# 06 — Decision Log

The major architectural decisions made across Phase 5B, with the reasoning behind each. These are permanent records ([Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md): architecture decisions must not be silently changed). A superseded decision is recorded and replaced, never rewritten.

---

## D-1 — Graph-first architecture

**Decision.** Model organizational relationships as a single, explicit graph rather than embedding relationships as fields on isolated entities.

**Why.** An organization's meaning lives in its connections. A graph makes relationships first-class, single-stated, and uniformly reasoned over, so cross-cutting questions (impact, dependency, accountability) become traversals instead of bespoke per-entity queries. Isolated entities would scatter each relationship across records and make consistency expensive.

## D-2 — Contracts before runtime

**Decision.** Define relationships as canonical, immutable contracts before any runtime consumes them.

**Why.** A shared, authoritative vocabulary prevents drift — the same relationship modeled three ways in three places. It makes runtime a *consumer* that cannot invent relationships, which in turn guarantees consistency, auditability, and safe reasoning. This mirrors the Phase 5A treatment of entities as inert contracts.

## D-3 — Validation before implementation

**Decision.** Design the graph-integrity rules as a distinct layer between contracts and runtime, before any runtime is built.

**Why.** Individually valid edges can still form an incoherent organization (department without organization, capability with two owners). Establishing integrity upstream means runtime consumes only graphs already proven sound, and stays free of defensive integrity logic. Reasoning over an unvalidated graph would produce confident wrong answers.

## D-4 — Workspace isolation as the highest boundary

**Decision.** Make Workspace the hard, terminal security boundary; forbid any edge from crossing it by default.

**Why.** Workspace is the tenant. A cross-workspace edge is a tenant leak — categorically worse than any intra-workspace inconsistency. Enforcing isolation at the graph level (not merely at query time) makes multi-tenancy safe by construction. Federation, if ever needed, is an explicit, governed exception, never an implicit softening.

## D-5 — Canonical directionality

**Decision.** Fix each relationship's direction (and multiplicity) as part of its contract; changes require versioning, not in-place edits.

**Why.** Direction is meaning — `owns` reversed asserts a different accountable party. Traversals and impact analysis are written for fixed directions; a silent reversal would break them with no error. Stable direction lets the graph accumulate meaning: a traversal written today keeps meaning the same thing tomorrow.

## D-6 — Frozen Phase 5A entities

**Decision.** Treat the Phase 5A canonical entities as frozen; introduce no new business entities in Phase 5B and modify no existing contract or enum.

**Why.** Phase 5B is about *relationships between* existing entities, not new entities. Freezing the entity foundation keeps the graph additive and non-breaking, and confines change to a deliberate, gated vocabulary-ratification step rather than churn in the entity layer.

## D-7 — Single-sourced ownership

**Decision.** Every owned node has exactly one `owns` edge; ownership is mandatory where required and never duplicated.

**Why.** Two owners make accountability and impact analysis ambiguous — "who is answerable" has no single answer. Single-sourced ownership is the invariant that makes impact analysis complete and non-contradictory. Support, responsibility, and use may fan out; authoritative ownership stays singular.

## D-8 — Explicit over inferred relationships

**Decision.** Store and validate only explicit relationships; keep inference in the reasoning layer, never written back as edges.

**Why.** If a relationship matters, it is an edge, stated deliberately. Writing inferred edges into the canonical graph would blur stored truth with derived conclusion and make the graph's facts unverifiable. Keeping facts (graph) and meaning (reasoning) separate keeps both trustworthy.

## D-9 — Correction: relationship contracts are Phase 5B.1, not Phase 5C

**Decision.** Relabel relationship-contract work from "Phase 5C" to "Phase 5B.1"; reserve Phase 5C for the Memory Layer.

**Why.** Memory Layer is a distinct architectural phase. Attributing relationship contracts to 5C conflated two unrelated bodies of work. The correction keeps phase numbering meaningful and was applied across the relationship-graph documentation in Phase 5B.1. Recorded here as a decision, not an erasure.

**Later clarification (historical record preserved).** At the time of this decision the Memory Layer was reserved under the label "Phase 5C". It was ultimately delivered as **Phase 6 — Organizational Memory**. This decision is retained as the truthful record of the 5B.1 relabel; the forward references to the Memory Layer elsewhere have since been aligned to Phase 6.

---

Every decision above is traceable to a design document in Phase 5B and consistent with the platform lifecycle. None has been reversed; where a framing was corrected (D-9), the correction is logged rather than the original hidden.
