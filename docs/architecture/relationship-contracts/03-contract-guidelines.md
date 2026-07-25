# 03 — Contract Guidelines

The rules a relationship contract must follow to be canonical. These govern how a relationship is named, directed, quantified, owned, versioned, and evolved. They are binding on any future contract work behind the Director gate.

## Naming rules

- **One canonical name per relationship.** A relationship has exactly one official name. Synonyms are not permitted; an alias is either the canonical name or it is nothing.
- **Verb-phrase form.** Names read as a verb or verb phrase that completes "source _____ target": `belongs_to`, `reports_to`, `has_capability`.
- **`snake_case`, lowercase.** Stable, machine-safe, human-readable.
- **Domain language, not implementation language.** Names describe organizational meaning (`manages`), never mechanism (`links`, `joins`, `refs`).
- **No overloading.** A name means one thing. If two situations differ in meaning, they are two relationships, not one name used loosely.

## Relationship naming principles

- **Directional readability.** The name must read correctly in the source → target direction and awkwardly in reverse. This makes direction self-documenting.
- **Asymmetry by default.** Most relationships are asymmetric (`owns` ≠ owned-by). Symmetric relationships are the rare, explicitly-declared exception (`collaborates_with`).
- **Stability over expressiveness.** A slightly plainer name that will not need to change beats a clever name that will. Names are long-lived.

## Direction conventions

- Every relationship is **directed**: a defined source and a defined target.
- Direction is **canonical and fixed** once ratified. It is never reversed in place; a reversal is a new contract.
- **Inverse pairs are single-stated.** Where two names describe the same fact (`contains` / `belongs_to`), only one direction is stored per edge; the other is a reading convenience, not a second edge.
- **Symmetric relationships** are stored with a canonical endpoint ordering so they remain single-stated despite having no natural direction.

## Multiplicity conventions

- Every relationship declares its cardinality: `1:1`, `1:N`, `N:1`, or `N:N`.
- **Ownership is `1:N` from the owner side and singular from the owned side** — an owned node has exactly one owner.
- **Participation and capability relationships are `N:N`** by default.
- **Structural containment is `1:N`** — a contained node has one container.
- Multiplicity is part of the contract. Tightening or loosening it is a versioned change, not an edit.

## Ownership conventions

- **Single canonical owner per relationship contract.** Each relationship is defined once in the canonical layer and owned there.
- **No duplicated ownership of edges.** The `owns` relationship itself is single-sourced: one owner per owned node, enforced as an invariant (see [05 — Validation Principles](05-validation-principles.md)).
- **Consumers reference, never copy.** A feature that needs a relationship references the canonical contract; it does not define its own.

## Versioning rules

- **No in-place meaning change.** A relationship's meaning, direction, or multiplicity never changes silently.
- **Version on semantic change.** Any change to meaning, direction, or multiplicity produces a new contract version; the prior version enters deprecation.
- **Additive-first.** Prefer adding a new relationship over redefining an existing one. New capability should extend the vocabulary, not overload it.
- **Recorded, not rewritten.** A superseded version is retained as a permanent record, consistent with the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md) rule that architecture decisions are permanent.

## Backward compatibility expectations

- **Existing edges keep conforming.** A new contract version must not invalidate edges validly created under a prior version without an explicit, documented migration.
- **Deprecation is gradual.** A deprecated relationship remains readable and traversable through a defined deprecation window; it is not removed abruptly.
- **Consumers are given a path.** When a relationship is superseded, the replacement and the migration expectation are documented before the old one is retired.
- **No frozen Phase 5A enum is broken.** Any extension aligns with the existing `ORGANIZATIONAL_RELATIONSHIP_TYPES` as a Phase 5B.1 Candidate Relationship Contract — additive and ratified, never a breaking edit.
