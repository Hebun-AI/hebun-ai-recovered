# 05 — Direction Reference

Every relationship is directed: a defined source and a defined target. Direction carries meaning — reverse it and the relationship asserts the opposite. This reference documents the direction conventions and explains why direction must stay stable once fixed.

## Reading direction

Direction reads **source → target**, and the relationship name is chosen so it reads naturally in that order and awkwardly in reverse. "Organization `contains` Department" reads correctly; "Department `contains` Organization" reads wrong — the name itself signals the direction.

## Canonical direction examples

| Fact | Direction | Reads as |
|---|---|---|
| Organization → Department | `contains` | Organization contains Department |
| Department → Team | `parent_of` / `contains` | Department is parent of Team |
| Department → Capability | `provides` / `has_capability` | Department provides / has Capability |
| Role → Responsibility | `responsible_for` | Role is responsible for Responsibility |
| Responsibility → Role | `assigned_to` | Responsibility is assigned to Role |
| Person → Role | `plays` | Person plays Role |
| Agent → Capability | `has_capability` / `supports` | Agent has / supports Capability |
| Organization → Capability | `owns` | Organization owns Capability |
| Subordinate → Superior | `reports_to` | Subordinate reports to Superior |
| Policy → Capability | `governs` | Policy governs Capability |

Each direction is fixed. The source type and target type in [02 — Endpoint Matrix](02-endpoint-matrix.md) are direction-specific: `owns` runs Organization → Capability and never the reverse.

## Inverse framings

Some facts can be read from either end. Only one direction is stored:

- `contains` (Container → Contained) and `belongs_to` (Member → Owner) describe the **same containment fact**. The graph stores one, not both.
- `reports_to` (Subordinate → Superior) and a hypothetical "manages-reports" reading describe related but **distinct** facts — reporting and operational management are stored separately (`reports_to` and `manages`), because they need not always coincide.

The rule: one fact, one stored direction. Inverse readings are a convenience of interpretation, never a second edge.

## Symmetric relationships

`collaborates_with` has no natural direction — collaboration is mutual. It is nonetheless stored with a **canonical endpoint ordering** so the single fact is recorded once rather than mirrored. Symmetry is a property of meaning; single-statedness is still enforced in storage.

## Why direction must remain stable

- **Direction is meaning.** `owns` reversed is "is owned by" — a different assertion about a different accountable party. A silent reversal silently changes what the graph says about the organization.
- **Consumers depend on it.** Traversals and impact analysis are written for a fixed direction. Reversing an edge's direction breaks every traversal that assumed it, without any error to signal the break.
- **Endpoint types are direction-bound.** The permitted source and target types differ by direction. Reversing direction would also invert which node types are legal, corrupting the endpoint matrix.
- **Stability is a contract.** Direction, like name and multiplicity, is fixed once ratified. Changing it is a **versioned change** with a migration path ([07 — Versioning](07-versioning.md)), never an in-place edit. A relationship whose direction could drift is a relationship no consumer could trust.

Stable direction is what lets the graph accumulate meaning over time: a traversal written today keeps meaning the same thing tomorrow, because the edges it follows cannot quietly turn around.
