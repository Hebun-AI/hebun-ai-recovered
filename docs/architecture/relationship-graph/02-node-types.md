# 02 — Node Types

Every node in the graph is a canonical Phase 5A entity, referenced by canonical id within a workspace scope. Nodes are inert: they hold descriptive data and act as edge endpoints. They carry no traversal or graph behavior of their own.

This document catalogues each canonical node, its purpose, its primary relationships, and how it is expected to behave in the graph. Relationship names below reference the vocabulary in [03 — Relationship Types](03-relationship-types.md).

---

## Workspace

**Purpose.** The hard platform boundary — tenant isolation. Every other node lives inside exactly one workspace.

**Primary relationships.** `contains` → all in-scope nodes. It is never a target of a cross-boundary edge.

**Expected graph behavior.** The terminal root of every traversal. Traversal never crosses a workspace boundary; the workspace scopes all reachability. A workspace has no parent and references no other workspace.

## Organization

**Purpose.** A business organization within a workspace — the operating whole beneath which structure hangs.

**Primary relationships.** `belongs_to` → Workspace; `contains` → OrganizationalUnit; `owns` → Capability, Responsibility; related to Party via PartyRole.

**Expected graph behavior.** A primary subtree root inside a workspace. Most organizational traversals begin here and descend through units to actors and roles.

## LegalEntity

**Purpose.** The legal axis — the registered entity an organization or unit is legally embodied by. Distinct from Organization (operating axis) and OrganizationalUnit (structural axis).

**Primary relationships.** `belongs_to` → Workspace; `represents` the legal form of an Organization or OrganizationalUnit.

**Expected graph behavior.** A cross-cutting reference node, not part of the operating hierarchy. Traversed for compliance and accountability questions, not for reporting lines.

## OrganizationalUnit

**Purpose.** A structural node in the operating hierarchy — division, department, team.

**Primary relationships.** `belongs_to` → Organization; `contains` → child OrganizationalUnit (`parent_of`); `contains` / hosts Role; a unit `reports_to` a parent unit.

**Expected graph behavior.** The recursive backbone of the structure hierarchy. Depth is intentional and acyclic — units nest, they do not loop.

## Party

**Purpose.** An external entity interacting with the organization — company, customer, supplier, investor, regulator, individual. A Party is the entity, never the role.

**Primary relationships.** `belongs_to` → Workspace; connected to Organization only through PartyRole.

**Expected graph behavior.** An external node. It never sits inside the internal operating hierarchy; its only link into the organization is via one or more PartyRole edges.

## PartyRole

**Purpose.** The temporal relationship a Party holds with the Organization — CUSTOMER, SUPPLIER, PARTNER, and so on. A relationship, not an entity specialization.

**Primary relationships.** Binds a Party to an Organization for an effective period; a party may hold several concurrent roles.

**Expected graph behavior.** A relationship-bearing node bridging external Party and internal Organization. Its temporal and lifecycle fields make external relationships time-aware — a former customer and a current one are distinguishable by traversal.

## Person

**Purpose.** A human actor specialization — an individual acting within the organization.

**Primary relationships.** `member_of` → OrganizationalUnit; `plays` → Role; employed via a LegalEntity reference.

**Expected graph behavior.** A leaf-level participant. The endpoint of people-facing traversals (organization → units → people) and the human side of accountability paths.

## Actor

**Purpose.** The abstraction over anything that can act — Person, AIAgent, service account, external contact. The common participant type.

**Primary relationships.** `plays` → Role; `assigned_to` → Responsibility; `member_of` → OrganizationalUnit; `has_capability` → Capability.

**Expected graph behavior.** The connective participant node. Most "who does this" traversals resolve to an Actor, then specialize into Person or AIAgent as needed.

## AIAgent

**Purpose.** An AI actor specialization — an autonomous or assisted agent operating within the organization.

**Primary relationships.** `plays` → Role; `supports` → Capability, OrganizationalUnit; `uses` → Tool (future); `depends_on` → other AIAgent.

**Expected graph behavior.** A first-class participant alongside Person. Traversals treat human and AI actors uniformly through the Actor abstraction, specializing only when the question requires it.

## Role

**Purpose.** An organizational function — a named position, occupied or not. A Role is a function; an Actor fills it.

**Primary relationships.** hosted by OrganizationalUnit; `responsible_for` → Responsibility; `has_capability` → Capability; filled by an Actor (`plays`).

**Expected graph behavior.** The pivot between structure and people. Accountability traversals route through Role: capability → responsible role → the actor who plays it.

## Responsibility

**Purpose.** An accountable duty — something that must be owned, categorized by domain and criticality.

**Primary relationships.** `owned_by` → Organization; `assigned_to` a Role or Actor; may be delegated.

**Expected graph behavior.** An accountability anchor. Traversed to answer "who is answerable for this" and to detect unassigned or over-delegated duties.

## Capability

**Purpose.** An organizational ability — what the organization can do, independent of who does it.

**Primary relationships.** `owned_by` → Organization; `supported_by` → Role, Actor, AIAgent; may `depend_on` other Capability.

**Expected graph behavior.** A dependency hub. Capability traversals reveal supporting roles and agents and downstream dependent capabilities — central to both impact and dependency analysis.

---

## Node summary

| Node | Axis | Internal / External | Typical position |
|---|---|---|---|
| Workspace | Boundary | — | Root |
| Organization | Operating | Internal | Subtree root |
| LegalEntity | Legal | Internal | Cross-cutting reference |
| OrganizationalUnit | Structure | Internal | Hierarchy backbone |
| Party | External entity | External | External node |
| PartyRole | External relationship | Bridge | External↔Internal bridge |
| Person | Participant (human) | Internal | Leaf participant |
| Actor | Participant (abstract) | Internal | Connective participant |
| AIAgent | Participant (AI) | Internal | Leaf participant |
| Role | Function | Internal | Structure↔people pivot |
| Responsibility | Accountability | Internal | Accountability anchor |
| Capability | Ability | Internal | Dependency hub |
