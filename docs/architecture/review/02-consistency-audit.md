# 02 — Consistency Audit

Verifies that the four Phase 5B design bodies describe **one architectural model**, not four overlapping ones. Where the cross-reference audit checked mechanics, this checks meaning.

## The four bodies and their roles

| Body | Answers |
|---|---|
| Relationship Graph | *What is the graph?* — nodes, relationships, traversal, reasoning |
| Relationship Contracts | *How are relationships governed?* — philosophy, categories, lifecycle |
| Graph Validation | *When is a graph valid?* — integrity rules and failure modes |
| Relationship Specification | *What does each relationship mean?* — precise semantics and endpoints |

These are four **views of one model**, layered from concept → governance → integrity → precise definition. Consistency means the same facts hold across all four.

## Consistency checks

### Relationship vocabulary

The graph introduces the relationship vocabulary; the specification defines it precisely; validation checks graphs built from it; contracts govern its evolution. All four reference the **same 18 relationships**. The specification's endpoint matrix and the graph's node/relationship descriptions agree on source and target types. **Consistent.**

### Ownership model

"Ownership is single-sourced" appears as a design principle (graph), an integrity rule (validation, rule 6), a semantic distinction (specification, `owns` vs `contains`/`manages`), and a naming/multiplicity rule (contracts). All four state the identical constraint: one owner per owned node, owner is the Organization. **Consistent.**

### Workspace isolation

The hard workspace boundary appears in graph principles, validation (rule 1, rule 7, and a dedicated boundaries document), and the specification's forbidden-combinations list. All agree: every node in one workspace, no edge crosses a workspace, federation only as an explicit future exception. **Consistent.**

### Directionality and multiplicity

The graph declares direction and multiplicity per relationship; the specification fixes them precisely; validation checks them; contracts require them stable. The values agree across graph `03`, specification `01`/`02`/`04`/`05`. **Consistent.**

### Acyclicity

"Cycles only where intentional" is a graph principle, a validation invariant (hierarchy + circular-dependency), and a specification note (`depends_on` acyclic despite N:N). All name the same acyclic set (`contains`, `parent_of`, `reports_to`, `depends_on`) and the same intentional exception (`collaborates_with`). **Consistent.**

### Inert, provenance-bearing edges

Every body inherits the Phase 5A contract shape: inert, immutable, provenance- and lifecycle-carrying. No body proposes a mutable or behavior-bearing edge. **Consistent.**

## Contradictions

**None identified.** No document asserts a fact another denies.

## Ambiguities

- **Design vocabulary vs frozen enum.** The specification marks nine relationships (`contains`, `belongs_to`, `manages`, `governs`, `supports`, `provides`, `uses`, `depends_on`, `collaborates_with`) as Phase 5B.1 Candidate Relationship Contracts extending the frozen `ORGANIZATIONAL_RELATIONSHIP_TYPES`. This is **deliberately** unresolved — ratification is a gated implementation task — but it means the "canonical" vocabulary is partly proposed. Documented, not a contradiction. Tracked in [05 — Open Issues](05-open-issues.md).

## Duplicated concepts

- **Validation appears in two places.** Relationship-contracts `05-validation-principles` and the graph-validation body both discuss validation. On inspection these are **layered, not duplicated**: contracts state contract-level invariants; graph-validation expands them into whole-graph integrity. Consistent framing, no divergence. Noted for awareness only.
- **Future-runtime sections** exist in relationship-contracts, graph-validation, and are implied in the graph. Each scopes to its own layer (contract consumption / validated-graph consumption) and they agree. Not harmful duplication.

## Missing definitions

- **Governance nodes (Policy, Tool) referenced before definition.** `governs` and `uses` reference Policy and Tool as future nodes. This is expected — they are backlog items, not Phase 5A entities — and every reference marks them "(future)". Not a Phase 5B gap; flagged in coverage.

## Conclusion

The four bodies describe **one coherent architectural model**. No contradictions. The ambiguities and cross-references found are deliberate deferrals (enum ratification, future nodes) rather than defects, and are tracked in open issues. **Consistency audit: pass.**
