# 02 — Contract Categories

Relationship contracts are grouped into architectural categories. Categories are an **organizing device**, not an implementation: they cluster relationships by the kind of fact they assert, so the vocabulary stays navigable as it grows and so validation and reasoning can treat a whole class uniformly.

A relationship belongs to exactly one primary category. The categories below map onto the relationship vocabulary defined in [relationship-graph / 03 — Relationship Types](../relationship-graph/03-relationship-types.md).

## Structural

Relationships that define the shape of the organization — containment and physical nesting.

- **Asserts:** what encloses what.
- **Representative relationships:** `contains`, `parent_of`.
- **Character:** hierarchical, acyclic, single-parent where applicable.

## Organizational

Relationships that place a node within the operating structure and its lines of scope.

- **Asserts:** where a node belongs and how the structure is scoped.
- **Representative relationships:** `belongs_to`, `reports_to`.
- **Character:** directional toward an owning scope; the backbone of the operating hierarchy.

## Participation

Relationships that connect actors to the structures and functions they take part in.

- **Asserts:** who participates in what.
- **Representative relationships:** `member_of`, `plays`.
- **Character:** many-to-many; the bridge between people/agents and structure.

## Accountability

Relationships that establish who is answerable for what.

- **Asserts:** ownership and responsibility.
- **Representative relationships:** `owns`, `responsible_for`, `manages`.
- **Character:** ownership is single-sourced; responsibility and management may fan out.

## Capability

Relationships that connect nodes to abilities and to the dependencies between abilities.

- **Asserts:** what a node can do and what an ability requires.
- **Representative relationships:** `has_capability`, `depends_on`.
- **Character:** dependency edges are acyclic; capability possession is many-to-many.

## Governance

Relationships that express constraint and authority over a node's permitted behavior.

- **Asserts:** what rules or authority bind a node.
- **Representative relationships:** `governs`.
- **Character:** directional from governor to governed; the attachment point for future policy and permission.

## Operational

Relationships that describe runtime-facing consumption and provision, expressed declaratively.

- **Asserts:** what a node uses or provides in operation.
- **Representative relationships:** `uses`, `provides`.
- **Character:** declarative references only — they name operational links without carrying runtime behavior.

## Support

Relationships that express non-owning enablement and peer collaboration.

- **Asserts:** what backs or works alongside a node.
- **Representative relationships:** `supports`, `collaborates_with`.
- **Character:** enabling rather than owning; `collaborates_with` is the one intentionally symmetric type.

---

## Category summary

| Category | Asserts | Representative relationships |
|---|---|---|
| Structural | Enclosure and nesting | contains, parent_of |
| Organizational | Belonging and reporting scope | belongs_to, reports_to |
| Participation | Who takes part in what | member_of, plays |
| Accountability | Who is answerable | owns, responsible_for, manages |
| Capability | Abilities and their dependencies | has_capability, depends_on |
| Governance | Constraint and authority | governs |
| Operational | Runtime-facing use and provision | uses, provides |
| Support | Enablement and collaboration | supports, collaborates_with |

Categories are stable groupings, versioned with the same discipline as the relationships they hold. Adding a category is a deliberate architectural act, not a convenience. This document defines organization only — no implementation, no runtime.
