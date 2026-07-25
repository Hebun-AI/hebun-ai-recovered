# 04 — Relationship Validation

Where [hierarchy validation](03-hierarchy-validation.md) judges chains, this document judges individual relationships and the consistency of the relationship set. Architecture only — the principles that make a relationship valid, not the mechanism that checks it.

## Duplicate relationships

The same relationship, of the same type and direction, between the same two nodes, must appear once. A duplicate edge asserts the same fact twice — harmless-looking, but it corrupts counting, weighting, and any analysis that assumes edges are distinct facts. Validity requires each relationship fact be stated exactly once, consistent with the single-stated principle.

## Missing ownership

Where a node requires an owner, it must have one. A capability or responsibility with no `owns` edge into it is unaccountable — no one is answerable, and impact analysis cannot resolve "who owns this." Missing required ownership is invalid, distinct from *duplicate* ownership (two owners), which is invalid for the opposite reason.

## Invalid direction

Every relationship is directed, and its direction is fixed by contract. An edge stored in the wrong direction inverts its meaning — `reports_to` pointing downward asserts the opposite of reality. Direction must match the canonical contract; a reversed edge is invalid even if both endpoints are otherwise legal.

## Illegal combinations

Some relationships between some node types are meaningless or forbidden, independent of direction and existence. A relationship contract permits specific source and target types; an edge outside that permission is an illegal combination — for example a governance edge from a node that cannot govern, or a participation edge into a node that cannot be participated in. Validity requires each edge respect its contract's type constraints.

## Relationship multiplicity

Each relationship declares its cardinality (`1:1`, `1:N`, `N:1`, `N:N`). The graph must honor it in aggregate. A relationship declared singular on the target side must not accumulate multiple edges into one target — a second owner arriving by a separate edge still violates ownership multiplicity. Multiplicity is a whole-graph constraint, not a per-edge one.

## Relationship consistency

The relationship set must be internally consistent — no edge contradicts another. Inverse framings (`contains` / `belongs_to`) describe one fact and are stored once, not as two independent, potentially-disagreeing edges. Symmetric relationships carry their canonical ordering. Overlapping relationships must agree. Consistency is a property of the whole set, above any single valid edge.

## Explicit vs inferred relationships

Only **explicit** relationships are stored and validated. A relationship that matters is an edge, stated deliberately ([design principle: relationships are explicit](../relationship-graph/06-design-principles.md)).

Inference is a **reasoning-layer** activity that reads explicit edges to derive conclusions — it never writes implied edges back into the graph. Validation applies to what is stored (the explicit set); it does not validate inferred conclusions, because inferences are not part of the canonical graph. This separation keeps the graph's stored truth and its reasoned conclusions cleanly distinct: the graph holds facts, reasoning derives meaning, and validation guards the facts.
