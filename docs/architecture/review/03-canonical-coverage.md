# 03 — Canonical Coverage

Verifies that every Phase 5A canonical entity is fully addressed by the Phase 5B architecture. For each entity, four coverage dimensions are checked:

- **Architectural purpose** — the entity has a defined role in the graph ([node-types](../relationship-graph/02-node-types.md)).
- **Relationship coverage** — the entity appears as a source and/or target in the relationship vocabulary and endpoint matrix.
- **Validation coverage** — the entity is subject to integrity rules (explicitly or via generic node rules).
- **Specification coverage** — the entity appears in the endpoint matrix and semantics.

## Coverage matrix

| Entity | Purpose | Relationship | Validation | Specification |
|---|---|---|---|---|
| Workspace | ✅ boundary root | ✅ `contains`, isolation | ✅ explicit (rules 1, 7; boundaries doc) | ✅ endpoint matrix |
| Organization | ✅ operating root | ✅ `contains`, `owns`, `belongs_to` | ✅ explicit (root rule 4; failure scenarios) | ✅ matrix + examples |
| LegalEntity | ✅ legal axis | ✅ `represents`, `belongs_to` | ⚠️ generic only (see gap) | ✅ matrix (`represents`) |
| OrganizationalUnit | ✅ structure backbone | ✅ `contains`, `parent_of`, `reports_to` | ✅ explicit (hierarchy doc) | ✅ matrix + examples |
| Party | ✅ external node | ✅ `belongs_to`, via PartyRole | ✅ explicit (forbidden internal-hierarchy) | ✅ matrix + examples |
| PartyRole | ✅ external bridge | ✅ `represents` | ✅ explicit (bridge, temporal) | ✅ matrix + examples |
| Person | ✅ human participant | ✅ `plays`, `member_of` | ✅ explicit (participant) | ✅ matrix + examples |
| Actor | ✅ participant abstraction | ✅ `plays`, `member_of`, `has_capability` | ✅ explicit (participant) | ✅ matrix + examples |
| AIAgent | ✅ AI participant | ✅ `plays`, `supports`, `uses`, `depends_on` | ✅ explicit (agent scenarios) | ✅ matrix + examples |
| Role | ✅ structure↔people pivot | ✅ `responsible_for`, `has_capability`, `manages` | ✅ explicit (hierarchy, duplicate-executive) | ✅ matrix + examples |
| Responsibility | ✅ accountability anchor | ✅ `assigned_to`, `owns` target | ✅ explicit (missing-ownership) | ✅ matrix + semantics |
| Capability | ✅ dependency hub | ✅ `owns`, `has_capability`, `depends_on`, `supports` | ✅ explicit (capability-without-owner) | ✅ matrix + examples |

Legend: ✅ covered · ⚠️ covered generically, no explicit treatment.

## Gaps

### G-1 — LegalEntity has no explicit validation treatment

**Observation.** LegalEntity is covered for purpose, relationship (`represents`), and specification, but the graph-validation body never names it explicitly. It is covered only by generic rules (every node is workspace-scoped; every edge resolves; `represents` endpoints are type-checked).

**Assessment.** **Minor.** Generic node rules apply to LegalEntity as to any node, so it is not *unvalidated* — it simply lacks a called-out example. Legal/compliance validation naturally deepens when the governance capabilities (Policy, Permission) are designed. No Phase 5B rework required; noted for the validation implementation phase.

### G-2 — Governance relationships target future nodes

**Observation.** `governs` targets Policy and `uses` targets Tool — both future backlog nodes, not Phase 5A entities. These relationships are specified but their non-Phase-5A endpoints cannot yet be exercised.

**Assessment.** **Expected, not a gap in coverage of Phase 5A entities.** Every reference is marked "(future)". The Phase 5A entity set is fully covered; these forward relationships are correctly staged for when their target nodes exist.

## Conclusion

**All 12 Phase 5A canonical entities have architectural purpose, relationship coverage, and specification coverage.** Validation coverage is complete for 11 of 12 explicitly and for LegalEntity generically. The two gaps are minor and forward-looking — neither requires Phase 5B rework, and both are appropriately deferred to the phases that introduce the governance nodes they concern. **Coverage is architecturally complete.**
