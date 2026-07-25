# 02 — Integrity Rules

The core architectural rules every valid graph must satisfy. Each is an invariant of the whole graph. This document states **what** must hold and **why**; it defines no mechanism. Violation of any rule makes the graph invalid ([01 — Validation Philosophy](01-validation-philosophy.md)).

---

## Rule 1 — Every node belongs to exactly one Workspace

**Purpose.** Bind every node to a single tenant scope.

**Why it exists.** Workspace is the hard security boundary. A node with no workspace has no tenant; a node in two workspaces breaks isolation. Single-workspace membership is what makes tenant separation absolute.

**Expected outcome.** Every node resolves to exactly one workspace. Reachability is total within a workspace and zero across workspaces.

## Rule 2 — Every relationship references valid nodes

**Purpose.** Forbid dangling edges.

**Why it exists.** A relationship whose source or target does not resolve is meaningless and corrupts traversal — a path that steps into a void. Both endpoints must exist and be of the type the relationship permits.

**Expected outcome.** Every edge connects two real, type-compatible nodes. No reference is broken.

## Rule 3 — Every relationship type must be canonical

**Purpose.** Keep the vocabulary closed.

**Why it exists.** Reasoning assumes a finite, defined set of relationship types. An edge of an unknown or ad-hoc type is one no consumer can interpret and no validation can check. Only ratified [relationship contracts](../relationship-contracts/README.md) may appear.

**Expected outcome.** Every edge's type is a canonical relationship contract. There are no undocumented relationship types in the graph.

## Rule 4 — Every graph has a root Organization

**Purpose.** Anchor the operating structure.

**Why it exists.** The organizational hierarchy needs a top. Without a root Organization beneath the Workspace, structural nodes float with no operating context, and traversals have no defined starting anchor.

**Expected outcome.** Within a workspace, the operating structure descends from at least one root Organization. Structural nodes trace up to it.

## Rule 5 — Orphan nodes are not allowed unless explicitly defined

**Purpose.** Ensure every node has a place.

**Why it exists.** A node with no relationships contributes nothing and signals an incomplete or abandoned model. Some node kinds are legitimately standalone (a newly created entity awaiting linkage, or a deliberately independent reference); those cases are explicit, not accidental.

**Expected outcome.** Every node is either connected into the graph or explicitly declared standalone. No node is orphaned by oversight.

## Rule 6 — Ownership must be unique where required

**Purpose.** Keep authoritative ownership single-sourced.

**Why it exists.** Two owners of one owned node is a contradiction that makes accountability and impact analysis ambiguous. Where a relationship declares singular ownership (`owns`), exactly one such edge may target a node.

**Expected outcome.** Each owned node has exactly one owner. Non-owning relationships (support, responsibility) may still be many.

## Rule 7 — Cross-workspace relationships are forbidden unless explicitly allowed

**Purpose.** Enforce tenant isolation at the edge level.

**Why it exists.** An edge spanning two workspaces is a leak across the highest security boundary. The default is absolute prohibition. Any future exception (federation, shared services) is explicit, narrow, and separately governed — never implicit.

**Expected outcome.** Both endpoints of every edge share one workspace, unless an explicitly defined and governed exception applies.

---

## Character of the rules

- **Whole-graph invariants.** Each rule constrains the assembled graph, not a single edge in isolation.
- **Binary.** A graph either satisfies a rule or it does not; there is no partial compliance.
- **Declarative.** The rules state conditions, not procedures. How they are checked is deferred past the Director gate.
- **Non-recovering.** A rule states what valid looks like; it prescribes no repair. Response to violation is covered in [07 — Failure Scenarios](07-failure-scenarios.md).
