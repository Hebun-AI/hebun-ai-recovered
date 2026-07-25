# 03 — Relationship Types

A relationship is a typed, directed edge from a source node to a target node. Each type has a fixed name, a fixed direction, and a defined multiplicity. Names are canonical and stable — see [06 — Design Principles](06-design-principles.md).

Every edge also carries an effective period, lifecycle, and provenance, exactly as the Phase 5A `OrganizationalRelationship` contract already models. This document defines the *semantic vocabulary*; it does not redefine that contract.

## Reading the definitions

- **Direction.** Source → Target. The name reads naturally in that direction ("source `belongs_to` target").
- **Multiplicity.** Cardinality from source to target: `1:1`, `1:N`, `N:1`, `N:N`.

---

## Structural

### contains
- **Description.** Source structurally encloses the target.
- **Direction.** Container → Contained.
- **Multiplicity.** 1:N.
- **Examples.** Workspace `contains` Organization; Organization `contains` OrganizationalUnit; OrganizationalUnit `contains` Role.

### belongs_to
- **Description.** Inverse framing of containment — the target is the source's owner scope. Stated once, in whichever direction the domain reads best; never both.
- **Direction.** Member → Owner.
- **Multiplicity.** N:1.
- **Examples.** OrganizationalUnit `belongs_to` Organization; Party `belongs_to` Workspace.

### parent_of
- **Description.** Recursive structural nesting between same-typed nodes.
- **Direction.** Parent → Child.
- **Multiplicity.** 1:N.
- **Examples.** OrganizationalUnit `parent_of` OrganizationalUnit.

### reports_to
- **Description.** A reporting line — organizational accountability upward.
- **Direction.** Subordinate → Superior.
- **Multiplicity.** N:1.
- **Examples.** OrganizationalUnit `reports_to` OrganizationalUnit; Role `reports_to` Role.

---

## Participation

### plays
- **Description.** An actor occupies an organizational function.
- **Direction.** Actor → Role.
- **Multiplicity.** N:N.
- **Examples.** Person `plays` Role; AIAgent `plays` Role.

### member_of
- **Description.** An actor belongs to a structural unit.
- **Direction.** Actor → OrganizationalUnit.
- **Multiplicity.** N:N.
- **Examples.** Person `member_of` OrganizationalUnit; Actor `member_of` OrganizationalUnit.

### assigned_to
- **Description.** A duty is placed on a role or actor.
- **Direction.** Responsibility → Role/Actor.
- **Multiplicity.** N:N.
- **Examples.** Responsibility `assigned_to` Role; Responsibility `assigned_to` Actor.

---

## Accountability

### owns
- **Description.** Authoritative ownership of an ability or duty. Exactly one owner per owned node.
- **Direction.** Owner → Owned.
- **Multiplicity.** 1:N (each owned node has a single owner).
- **Examples.** Organization `owns` Capability; Organization `owns` Responsibility.

### responsible_for
- **Description.** A role is accountable for a duty or ability.
- **Direction.** Role → Responsibility/Capability.
- **Multiplicity.** N:N.
- **Examples.** Role `responsible_for` Responsibility.

### manages
- **Description.** Supervisory authority over a node's operation.
- **Direction.** Manager → Managed.
- **Multiplicity.** 1:N.
- **Examples.** Role `manages` OrganizationalUnit; Actor `manages` Role.

### governs
- **Description.** A governing constraint applies to a node. The governance direction for policy and permission edges.
- **Direction.** Governor → Governed.
- **Multiplicity.** 1:N.
- **Examples.** Policy `governs` Capability (future); Policy `governs` Tool (future).

---

## Capability and support

### has_capability
- **Description.** An actor or role possesses an ability.
- **Direction.** Actor/Role → Capability.
- **Multiplicity.** N:N.
- **Examples.** Actor `has_capability` Capability; Role `has_capability` Capability.

### supports
- **Description.** A node enables or backs another without owning it.
- **Direction.** Supporter → Supported.
- **Multiplicity.** N:N.
- **Examples.** AIAgent `supports` Capability; AIAgent `supports` OrganizationalUnit.

### provides
- **Description.** A node furnishes a capability or service to another.
- **Direction.** Provider → Consumer.
- **Multiplicity.** N:N.
- **Examples.** Role `provides` Capability to OrganizationalUnit.

### uses
- **Description.** A node consumes a tool or capability at runtime (declarative reference only).
- **Direction.** Consumer → Used.
- **Multiplicity.** N:N.
- **Examples.** AIAgent `uses` Tool (future); Role `uses` Capability.

### depends_on
- **Description.** A functional dependency — the source requires the target to operate.
- **Direction.** Dependent → Dependency.
- **Multiplicity.** N:N.
- **Examples.** Capability `depends_on` Capability; AIAgent `depends_on` AIAgent.

### collaborates_with
- **Description.** A peer, non-hierarchical working relationship. The one intentionally symmetric type — see principles on cycles.
- **Direction.** Peer ↔ Peer (stored with a canonical ordering to keep it single-stated).
- **Multiplicity.** N:N.
- **Examples.** OrganizationalUnit `collaborates_with` OrganizationalUnit; Actor `collaborates_with` Actor.

### represents
- **Description.** A node stands in for another across an axis — legal, delegated, or external.
- **Direction.** Representative → Represented.
- **Multiplicity.** N:1.
- **Examples.** LegalEntity `represents` Organization; PartyRole `represents` a Party's standing to an Organization.

---

## Alignment with Phase 5A contracts

Phase 5A froze `ORGANIZATIONAL_RELATIONSHIP_TYPES` as a canonical enum. The vocabulary above is a **design-level superset**; several names map directly onto the existing enum, others are Phase 5B.1 Candidate Relationship Contracts to be ratified when the graph contract is revised in the relationship-contract phase (Phase 5B.1).

| Design name | Phase 5A canonical type | State |
|---|---|---|
| member_of | `MEMBER_OF` | exists |
| plays | `FILLS_ROLE` | exists (rename alias) |
| responsible_for | `RESPONSIBLE_FOR` | exists |
| assigned_to | `ASSIGNED_TO` | exists |
| reports_to | `REPORTS_TO` | exists |
| has_capability | `HAS_CAPABILITY` | exists |
| (delegation) | `DELEGATES_TO` | exists |
| represents | `REPRESENTS` | exists |
| parent_of | `PARENT_OF` | exists |
| owns | `OWNS` | exists |
| contains, belongs_to, manages, governs, supports, provides, uses, depends_on, collaborates_with | — | Phase 5B.1 Candidate Relationship Contract |

No enum is modified in this phase. Reconciling the design vocabulary with the frozen contract — deciding which names are aliases and which extend the enum — is an explicit task for the implementation phase, behind the Director gate.
