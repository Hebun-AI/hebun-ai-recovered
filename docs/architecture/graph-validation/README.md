# Graph Validation — Architecture Design

## Purpose

This is the architecture design for **Graph Validation** — the rules every Organizational Relationship Graph must satisfy to be valid. Phase 5B defined the graph; Phase 5B.1 defined how relationships become canonical contracts. This phase (5B.2) defines the **integrity layer**: the conditions under which a graph built from those contracts is architecturally sound.

It is **design only**. It defines integrity rules, hierarchy and relationship validation principles, workspace boundaries, governance validation, failure scenarios, and the architectural interaction with future runtime. It defines no runtime validation, no algorithms, no storage, no database, and no APIs.

## The integrity layer

Graph Validation sits **between canonical contracts and runtime**:

```
Canonical Relationship Contracts   (5B.1 — the vocabulary)
              │
              ▼
Graph Validation                   (5B.2 — the integrity layer)  ← this phase
              │
              ▼
Runtime                            (consumes a graph already known valid)
```

Contracts say what a relationship *means*. Validation says whether a graph *assembled from those relationships* is coherent — no dangling edges, no duplicate ownership, no cross-tenant leakage, no illegal hierarchy. Runtime is spared these checks because validation guarantees them upstream. A graph that reaches runtime is a graph already known to be sound.

## Documents

| Document | Covers |
|---|---|
| [01 — Validation Philosophy](01-validation-philosophy.md) | Why validation exists; valid vs invalid graph; integrity, consistency, reasoning reliability |
| [02 — Integrity Rules](02-integrity-rules.md) | The core architectural integrity rules |
| [03 — Hierarchy Validation](03-hierarchy-validation.md) | Valid and illegal hierarchies, parents, chains, cycles |
| [04 — Relationship Validation](04-relationship-validation.md) | Duplicates, ownership, direction, multiplicity, consistency |
| [05 — Workspace Boundaries](05-workspace-boundaries.md) | Workspace as the highest security boundary; isolation and federation |
| [06 — Governance Validation](06-governance-validation.md) | Policy, permission, accountability, auditability, compliance |
| [07 — Failure Scenarios](07-failure-scenarios.md) | Concrete invalid graphs and the expected architectural response |
| [08 — Future Runtime](08-future-runtime.md) | How runtime consumes validation rules, architecturally |

## Relationship to other phases

- **Phase 5A** — established the canonical entities and the first edge contract. Validation checks graphs built from these; it modifies none of them.
- **Phase 5B** — designed the graph (nodes, relationships, traversal, impact analysis). Validation enforces the [design principles](../relationship-graph/06-design-principles.md) that phase declared.
- **Phase 5B.1** — defined relationship contracts and named validation invariants at the contract level. This phase expands those invariants into a full graph-integrity model.
- **Phase 6 — Organizational Memory** — a separate architectural phase, the Memory Layer. Out of scope here.

## Director Gate

This phase ends with architecture documentation only. No validation is implemented, no contract is modified, no runtime behavior is introduced. **Phase 5B.3 begins only after explicit Director approval.**
