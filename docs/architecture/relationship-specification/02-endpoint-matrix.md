# 02 — Endpoint Matrix

The canonical matrix of permitted endpoints for every relationship. For each relationship: allowed source nodes, allowed target nodes, forbidden combinations, and expected multiplicity. Node types are the Phase 5A entities — no new entity is introduced. This is specification, not validation logic.

Node abbreviations: **WS** Workspace · **ORG** Organization · **LE** LegalEntity · **OU** OrganizationalUnit · **PTY** Party · **PR** PartyRole · **PER** Person · **ACT** Actor · **AIA** AIAgent · **ROLE** Role · **RESP** Responsibility · **CAP** Capability. *(Tool and Policy are future nodes, shown where relevant.)*

## Endpoint table

| Relationship | Allowed source | Allowed target | Multiplicity |
|---|---|---|---|
| contains | WS, ORG, OU | ORG, OU, ROLE | 1 → many |
| belongs_to | ORG, OU, PTY | WS, ORG | many → 1 |
| parent_of | OU | OU | 1 → many |
| reports_to | OU, ROLE | OU, ROLE | many → 1 |
| plays | ACT, PER, AIA | ROLE | many ↔ many |
| member_of | ACT, PER, AIA | OU | many ↔ many |
| assigned_to | RESP | ROLE, ACT | many ↔ many |
| owns | ORG | CAP, RESP | 1 → many |
| responsible_for | ROLE | RESP, CAP | many ↔ many |
| manages | ROLE, ACT | OU, ROLE | 1 → many |
| governs | Policy | CAP, ROLE, OU, Tool | 1 → many |
| has_capability | ACT, PER, AIA, ROLE | CAP | many ↔ many |
| supports | AIA, ACT, ROLE | CAP, OU, ROLE | many ↔ many |
| provides | ROLE, OU, AIA | OU, CAP | many ↔ many |
| uses | AIA, ROLE, ACT | Tool, CAP | many ↔ many |
| depends_on | CAP, AIA | CAP, AIA | many ↔ many |
| collaborates_with | OU, ACT | OU, ACT | many ↔ many |
| represents | LE, PR | ORG, OU, PTY | many → 1 |

## Forbidden combinations

These are categorically illegal, independent of direction or existence:

- **Any edge crossing a Workspace.** Both endpoints must share one workspace. The single most severe forbidden combination.
- **External node inside the internal hierarchy.** A Party may not `contains`, be `contains`ed by, `member_of`, or `reports_to` internal structural nodes. A Party touches the organization only through PartyRole (`represents`).
- **Inverted structure.** ROLE, PER, ACT, or AIA as the source of `contains` targeting ORG or OU. Participants do not structurally contain the structure.
- **Actor as structural parent.** `parent_of` with any source other than OU, or any target other than OU.
- **Ownership by a non-Organization.** `owns` with a source other than ORG. Actors, roles, and units do not authoritatively own capabilities or responsibilities.
- **Capability owning anything.** CAP, RESP, WS as the source of `owns`. Abilities and duties are owned; they do not own.
- **Self-edges on asymmetric relationships.** A node related to itself via any relationship except an explicitly symmetric one. Even `collaborates_with` requires two distinct endpoints.
- **WorkspaceScope as a target of belonging from another workspace.** A Workspace has no parent and is referenced by no other workspace.

## Multiplicity expectations, restated

- **Singular-target relationships** (`owns`, `belongs_to`, `parent_of`, `reports_to`, `represents`): the target side is constrained. An owned node has one owner; a contained/child node has one parent; a subordinate reports to one superior. A second edge violating this is invalid.
- **Many-to-many relationships** (`plays`, `member_of`, `assigned_to`, `responsible_for`, `has_capability`, `supports`, `provides`, `uses`, `depends_on`, `collaborates_with`): both sides may fan out freely, subject only to the acyclicity of `depends_on`.
- **One-to-many authority** (`contains`, `manages`, `governs`): one source governs/manages/contains many targets; each target's *containing* or *authoritative* edge is singular where the relationship declares it so.

This matrix defines permitted shape. How conformance is checked belongs to [Graph Validation](../graph-validation/README.md) and, later, its implementation — not to this document.
