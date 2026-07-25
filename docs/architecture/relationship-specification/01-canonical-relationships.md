# 01 — Canonical Relationships

The authoritative definition of every canonical relationship. Each entry fixes name, business meaning, permitted source and target node types, direction, multiplicity, ownership semantics, and an example. Node types are the Phase 5A entities; no new entity is introduced.

**Direction** reads source → target. **Multiplicity** is source:target. Names that extend the frozen `ORGANIZATIONAL_RELATIONSHIP_TYPES` enum are Phase 5B.1 Candidate Relationship Contracts.

---

## contains

- **Business meaning.** The source structurally encloses the target — the target lives inside the source.
- **Source node types.** Workspace, Organization, OrganizationalUnit.
- **Target node types.** Organization, OrganizationalUnit, Role.
- **Direction.** Container → Contained.
- **Multiplicity.** 1 → many.
- **Ownership semantics.** Structural, not authoritative ownership. A contained node has exactly one container.
- **Example.** Organization `contains` OrganizationalUnit (a company contains a Finance department).

## belongs_to

- **Business meaning.** The inverse framing of containment — the source's owning scope is the target. Stored once, in whichever direction reads best.
- **Source node types.** Organization, OrganizationalUnit, Party.
- **Target node types.** Workspace, Organization.
- **Direction.** Member → Owner scope.
- **Multiplicity.** many → 1.
- **Ownership semantics.** Scoping, not authoritative ownership.
- **Example.** OrganizationalUnit `belongs_to` Organization.

## parent_of

- **Business meaning.** Recursive structural nesting between same-typed structural nodes.
- **Source node types.** OrganizationalUnit.
- **Target node types.** OrganizationalUnit.
- **Direction.** Parent → Child.
- **Multiplicity.** 1 → many.
- **Ownership semantics.** Single-parent; a unit has one structural parent.
- **Example.** OrganizationalUnit (Division) `parent_of` OrganizationalUnit (Team).

## reports_to

- **Business meaning.** An accountability reporting line, directed upward.
- **Source node types.** OrganizationalUnit, Role.
- **Target node types.** OrganizationalUnit, Role.
- **Direction.** Subordinate → Superior.
- **Multiplicity.** many → 1.
- **Ownership semantics.** None; expresses accountability direction, not ownership.
- **Example.** Role (Analyst) `reports_to` Role (Finance Director).

## plays

- **Business meaning.** An actor occupies an organizational function.
- **Source node types.** Actor, Person, AIAgent.
- **Target node types.** Role.
- **Direction.** Actor → Role.
- **Multiplicity.** many ↔ many.
- **Ownership semantics.** None; occupancy is temporal, not ownership. Aligns with Phase 5A `FILLS_ROLE`.
- **Example.** Person `plays` Role (a person fills the Finance Director role).

## member_of

- **Business meaning.** An actor belongs to a structural unit.
- **Source node types.** Actor, Person, AIAgent.
- **Target node types.** OrganizationalUnit.
- **Direction.** Actor → OrganizationalUnit.
- **Multiplicity.** many ↔ many.
- **Ownership semantics.** None; membership, not ownership. Aligns with Phase 5A `MEMBER_OF`.
- **Example.** Person `member_of` OrganizationalUnit (a person belongs to the Finance team).

## assigned_to

- **Business meaning.** A duty is placed on a role or actor.
- **Source node types.** Responsibility.
- **Target node types.** Role, Actor.
- **Direction.** Responsibility → Role/Actor.
- **Multiplicity.** many ↔ many.
- **Ownership semantics.** Assignment of accountability, distinct from ownership. Aligns with Phase 5A `ASSIGNED_TO`.
- **Example.** Responsibility (Approve budgets) `assigned_to` Role (Finance Director).

## owns

- **Business meaning.** Authoritative ownership of an ability or duty — the accountable owner.
- **Source node types.** Organization.
- **Target node types.** Capability, Responsibility.
- **Direction.** Owner → Owned.
- **Multiplicity.** 1 → many (each owned node has exactly one owner).
- **Ownership semantics.** The defining ownership relationship. Single-sourced and mandatory where required. Aligns with Phase 5A `OWNS`.
- **Example.** Organization `owns` Capability (the company owns the "Approve Purchase" capability).

## responsible_for

- **Business meaning.** A role is accountable for a duty or ability.
- **Source node types.** Role.
- **Target node types.** Responsibility, Capability.
- **Direction.** Role → Responsibility/Capability.
- **Multiplicity.** many ↔ many.
- **Ownership semantics.** Accountability without authoritative ownership. Aligns with Phase 5A `RESPONSIBLE_FOR`.
- **Example.** Role (Compliance Officer) `responsible_for` Responsibility (Regulatory reporting).

## manages

- **Business meaning.** Supervisory authority over a node's operation.
- **Source node types.** Role, Actor.
- **Target node types.** OrganizationalUnit, Role.
- **Direction.** Manager → Managed.
- **Multiplicity.** 1 → many.
- **Ownership semantics.** Operational authority, not authoritative ownership.
- **Example.** Role (Department Head) `manages` OrganizationalUnit (the department).

## governs

- **Business meaning.** A governing constraint applies to the target.
- **Source node types.** Policy (future governance node).
- **Target node types.** Capability, Role, OrganizationalUnit, Tool (future).
- **Direction.** Governor → Governed.
- **Multiplicity.** 1 → many.
- **Ownership semantics.** Constraint authority, not ownership.
- **Example.** Policy `governs` Capability (a spending policy governs the "Approve Purchase" capability).

## has_capability

- **Business meaning.** An actor or role possesses an ability.
- **Source node types.** Actor, Person, AIAgent, Role.
- **Target node types.** Capability.
- **Direction.** Actor/Role → Capability.
- **Multiplicity.** many ↔ many.
- **Ownership semantics.** Possession, not ownership — the owner of a capability is set by `owns`. Aligns with Phase 5A `HAS_CAPABILITY`.
- **Example.** Role (Buyer) `has_capability` Capability (Approve Purchase).

## supports

- **Business meaning.** A node enables or backs another without owning it.
- **Source node types.** AIAgent, Actor, Role.
- **Target node types.** Capability, OrganizationalUnit, Role.
- **Direction.** Supporter → Supported.
- **Multiplicity.** many ↔ many.
- **Ownership semantics.** Enablement, explicitly non-owning.
- **Example.** AIAgent `supports` Capability (an agent backs the "Draft Contract" capability).

## provides

- **Business meaning.** A node furnishes a capability or service to another.
- **Source node types.** Role, OrganizationalUnit, AIAgent.
- **Target node types.** OrganizationalUnit, Capability.
- **Direction.** Provider → Consumer.
- **Multiplicity.** many ↔ many.
- **Ownership semantics.** Provision, not ownership.
- **Example.** OrganizationalUnit (Shared Services) `provides` Capability to OrganizationalUnit (Sales).

## uses

- **Business meaning.** A node consumes a tool or capability in operation — a declarative reference, not a runtime call.
- **Source node types.** AIAgent, Role, Actor.
- **Target node types.** Tool (future), Capability.
- **Direction.** Consumer → Used.
- **Multiplicity.** many ↔ many.
- **Ownership semantics.** Consumption, not ownership.
- **Example.** AIAgent `uses` Tool (an agent uses the CRM tool).

## depends_on

- **Business meaning.** A functional dependency — the source requires the target to operate.
- **Source node types.** Capability, AIAgent.
- **Target node types.** Capability, AIAgent.
- **Direction.** Dependent → Dependency.
- **Multiplicity.** many ↔ many.
- **Ownership semantics.** None; dependency edges are acyclic.
- **Example.** Capability (Fulfil Order) `depends_on` Capability (Check Inventory).

## collaborates_with

- **Business meaning.** A peer, non-hierarchical working relationship. The one intentionally symmetric relationship.
- **Source node types.** OrganizationalUnit, Actor.
- **Target node types.** OrganizationalUnit, Actor.
- **Direction.** Peer ↔ Peer (stored with a canonical ordering to remain single-stated).
- **Multiplicity.** many ↔ many.
- **Ownership semantics.** None; symmetric, no owner.
- **Example.** OrganizationalUnit (Sales) `collaborates_with` OrganizationalUnit (Marketing).

## represents

- **Business meaning.** A node stands in for another across an axis — legal, delegated, or external.
- **Source node types.** LegalEntity, PartyRole.
- **Target node types.** Organization, OrganizationalUnit, Party.
- **Direction.** Representative → Represented.
- **Multiplicity.** many → 1.
- **Ownership semantics.** Representation, not ownership. Aligns with Phase 5A `REPRESENTS`.
- **Example.** LegalEntity `represents` Organization (a registered entity is the legal form of the operating organization).

---

## Alignment note

Relationships marked "aligns with Phase 5A `…`" map directly onto the frozen enum. The remainder (`contains`, `belongs_to`, `manages`, `governs`, `supports`, `provides`, `uses`, `depends_on`, `collaborates_with`) are Phase 5B.1 Candidate Relationship Contracts — specified here, ratified in the implementation phase behind the Director gate. No enum is modified by this document.
