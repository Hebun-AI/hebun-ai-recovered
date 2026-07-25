# 05 — Validation Principles

The invariants that relationship data must satisfy to be valid. This document defines **what** must hold, not **how** it is checked. No algorithms, no implementation — the enforcement mechanism is deferred to the implementation phase behind the Director gate.

Each principle is an invariant of the graph. A relationship set that violates one is invalid by definition, and future validation exists to detect the violation and reject it.

## Duplicate ownership

**Invariant.** Every owned node has exactly one `owns` edge into it.

Ownership is single-sourced. Two owners for the same node is a contradiction the model must reject — it is what makes impact analysis complete and non-ambiguous. Support, responsibility, and use may be many; authoritative ownership is always one.

## Circular dependency detection

**Invariant.** Dependency and hierarchy relationships are acyclic.

`depends_on`, `contains`, `parent_of`, and `reports_to` must not form cycles. A capability that transitively depends on itself, or a unit that contains its own ancestor, is invalid. Cycles are permitted only where a relationship is explicitly declared symmetric (`collaborates_with`); everywhere else a cycle is an error to be surfaced.

## Illegal hierarchy

**Invariant.** Structural and reporting edges connect compatible node types in permitted directions.

A hierarchy must respect the node model: containment and reporting flow between the node types the contract allows, in the allowed direction. An edge that places an actor as the structural parent of an organization, or reverses a reporting line, is illegal regardless of cycles. The type-and-direction rules of each relationship are part of its contract.

## Workspace isolation

**Invariant.** No edge crosses a workspace boundary.

Both endpoints of every relationship share one workspace. Reachability is total within a workspace and zero across workspaces. This is the hard tenant boundary from the [design principles](../relationship-graph/06-design-principles.md), enforced at the relationship level — an edge spanning two workspaces is invalid on its face.

## Broken references

**Invariant.** Both endpoints of every edge resolve to existing nodes.

A relationship references its source and target by canonical id. Both must exist and be of the type the relationship permits. A dangling edge — one whose endpoint does not resolve — is invalid. Retiring a node without resolving its edges leaves broken references the model must reject.

## Relationship consistency

**Invariant.** The relationship set is internally consistent.

Beyond any single edge, the set as a whole must not contradict itself: no inverse pair stored twice as independent facts, no symmetric relationship stored without its canonical ordering, no multiplicity violated in aggregate (e.g. a second owner arriving via a different edge). Consistency is a property of the whole graph, not just of individual edges.

---

## Character of validation

- **Declarative.** Validation checks invariants over inert relationship data. It computes nothing beyond validity.
- **Read-only.** Validation inspects; it never repairs or mutates. It reports invalid relationships; correcting them is a separate, gated act.
- **Complete and consistent.** Because relationships are explicit and single-stated, these invariants are checkable without ambiguity.

These principles define the target. The Phase 5A contracts already demonstrate the shape this enforcement takes — `create`/`validate` pairs over immutable data — and the relationship-contract implementation will follow the same discipline once approved. This document commits to no mechanism here.
