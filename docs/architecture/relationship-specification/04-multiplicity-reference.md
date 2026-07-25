# 04 — Multiplicity Reference

Multiplicity is the cardinality a relationship permits between its source and target. It is part of each relationship's contract. This reference explains the four conventions and when each applies. No algorithms — meaning only.

Notation is source → target.

## 1 → 1

**Meaning.** One source relates to exactly one target, and that target to exactly one source.

**When to use.** Exclusive pairings where both sides are singular. Rare in the organizational graph, because most facts fan out on at least one side. Reserved for genuinely one-to-one correspondences.

**Character.** The most restrictive convention. Choose it only when both sides are provably singular; over-applying it makes the model brittle.

## 1 → many

**Meaning.** One source relates to many targets, but each target relates back to only one source.

**When to use.** Containment and single-owner authority. A container holds many nodes, but each node has one container. An owner owns many capabilities, but each capability has one owner.

**Examples.** `contains` (an Organization contains many units; each unit has one container), `owns` (an Organization owns many capabilities; each capability has one owner), `parent_of`, `manages`, `governs`.

**Character.** The workhorse of hierarchy and ownership. The *target* side is the constrained side — this is what makes ownership single-sourced and structure single-parent.

## many → 1

**Meaning.** Many sources relate to one target — the same fact as 1 → many, framed from the many side.

**When to use.** When the natural reading runs from the subordinate/member toward the single scope above it.

**Examples.** `belongs_to` (many units belong to one organization), `reports_to` (many subordinates report to one superior), `represents` (many representatives to one represented).

**Character.** A direction choice, not a different cardinality. `belongs_to` (many → 1) and `contains` (1 → many) describe the same containment; only one is stored per fact.

## many ↔ many

**Meaning.** Many sources relate to many targets, with no singular constraint on either side.

**When to use.** Participation, possession, support, and dependency — wherever both sides legitimately fan out. An actor plays several roles; a role is played by several actors over time. A capability depends on several others; several capabilities depend on it.

**Examples.** `plays`, `member_of`, `assigned_to`, `responsible_for`, `has_capability`, `supports`, `provides`, `uses`, `depends_on`, `collaborates_with`.

**Character.** The most permissive convention, and the correct default for participation and capability wiring. Note that `depends_on`, though many-to-many, remains **acyclic** — permissiveness in cardinality does not relax the no-cycles rule.

## Choosing a multiplicity

- **Is either side inherently singular?** If a target may have only one source (one owner, one container, one parent), use 1 → many (or its many → 1 framing). Singular-target multiplicity is what makes ownership and structure unambiguous.
- **Do both sides fan out?** Use many ↔ many. Participation, ability, support, and dependency all belong here.
- **Are both sides exclusive?** Only then, 1 → 1 — and confirm the exclusivity is real, not merely common.
- **Direction is a separate choice.** many → 1 and 1 → many are the same cardinality seen from opposite ends; pick the direction that reads naturally, and store the fact once.

Multiplicity is fixed by contract. Tightening it (many → one) or loosening it (one → many) changes the relationship's meaning and is a **versioned change**, never an in-place edit — see [07 — Versioning](07-versioning.md).
