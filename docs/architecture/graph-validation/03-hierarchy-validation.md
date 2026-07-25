# 03 — Hierarchy Validation

Hierarchies are the graph's backbone: the structural chain from organization down to people, and the accountability chain of reporting lines. This document defines what makes a hierarchy valid and what makes it illegal. No algorithms — architecture only.

## The canonical structural hierarchy

```
Organization
  ↓ contains
Department        (OrganizationalUnit)
  ↓ contains / parent_of
Team              (OrganizationalUnit)
  ↓ contains
Role
  ↓ plays (filled by)
Person / Actor
```

Each downward step is a canonical structural or participation relationship. The chain descends through node types in a permitted order; it never skips a required level in a way the relationship contracts forbid, and it never inverts.

## Valid hierarchies

A hierarchy is valid when:

- **Types descend in a permitted order.** Organization contains units; units nest and host roles; roles are filled by actors. Each edge connects the node types its relationship allows.
- **It is anchored.** The chain traces up to a root Organization within one workspace ([integrity rule 4](02-integrity-rules.md)).
- **It is acyclic.** No node is its own ancestor along `contains`, `parent_of`, or `reports_to`.
- **Parentage respects multiplicity.** Where a relationship declares a single parent, a node has exactly one.

## Illegal hierarchies

A hierarchy is illegal when any of the following appears:

- **Inverted structure.** A role containing a department, or a person containing an organization — direction or type reversed.
- **Type violation.** A structural edge between node types the contract does not permit (an actor as the structural parent of an organization).
- **Skipped anchoring.** A structural subtree with no path up to a root Organization — a floating hierarchy.
- **Illegal placement.** An external node (Party) inserted into the internal operating hierarchy, which it may only touch through PartyRole.

Illegality here is independent of cycles — a graph can be acyclic and still illegal by type or direction.

## Hierarchy consistency

Consistency means the hierarchy agrees with itself across all its edges. The structural chain (`contains` / `parent_of`) and the reporting chain (`reports_to`) must not contradict — a unit's reporting line should not imply a structure the containment edges deny. Where two chains describe overlapping facts, they align.

## Multiple parents

Structural containment is single-parent: a contained node has exactly one container. Multiple structural parents are invalid — they make "where does this live" unanswerable and break impact analysis' assumption of a single upward path.

Non-structural relationships may legitimately fan in (a role may support several units), but **structural and reporting parentage is singular** unless a relationship contract explicitly declares otherwise.

## Broken chains

A chain is broken when a link is missing: a team whose parent department has been retired without reassignment, leaving the team unanchored; a role whose hosting unit no longer exists. Broken chains produce orphaned subtrees and dangling references — invalid under [integrity rules 2 and 5](02-integrity-rules.md). Retiring a node requires resolving the chains that pass through it.

## Cycles

Structural and reporting hierarchies are strictly acyclic. A cycle — a unit that transitively contains itself, a reporting line that loops back — is always invalid. It makes upward traversal non-terminating and accountability circular. Cycles are permitted only in relationships explicitly declared symmetric (`collaborates_with`), which are not hierarchies. Any cycle in a hierarchy is an error to be surfaced, never tolerated.
