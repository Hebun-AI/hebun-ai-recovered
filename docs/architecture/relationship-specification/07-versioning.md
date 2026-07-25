# 07 — Versioning

How the relationship specification evolves. The vocabulary must stay stable enough to trust and flexible enough to grow. Versioning is how those two needs are reconciled: change happens through new versions and deprecation, never through silent edits. No implementation — philosophy and rules only.

This document specializes the [Relationship Contract lifecycle](../relationship-contracts/04-contract-lifecycle.md) to the specification itself.

## Version stability

The specification is a **slow-moving, high-trust document**. A relationship's name, meaning, direction, multiplicity, and permitted endpoints are fixed once ratified. Consumers — traversals, impact analysis, future capabilities — depend on these staying constant. Stability is the feature: a specification that drifted would make every consumer's assumptions unreliable.

Stability does not mean stasis. It means change is deliberate, versioned, and recorded — never quiet.

## Compatibility

- **Additive change is preferred.** Growing the vocabulary — a new relationship, a new permitted endpoint that does not restrict existing use — is the low-risk path. New capability should extend the specification, not redefine it.
- **Backward compatibility is the default expectation.** A specification change must not invalidate relationships that were valid under the prior version without an explicit, documented migration.
- **Breaking change is exceptional.** Narrowing a multiplicity, reversing a direction, or restricting endpoints breaks existing edges. Such changes are rare, deliberate, and always versioned with a migration path.

## Deprecation

- A relationship or a permitted endpoint that is being retired is **marked deprecated**, not deleted.
- A deprecated element remains **readable and valid** through a defined deprecation window, so existing edges keep conforming while consumers migrate.
- Deprecation names the **replacement**, if any, and the expectation for moving to it.
- Nothing is removed abruptly; abrupt removal is what breaks trust.

## Replacement

- When a relationship is superseded, edges migrate to the replacement along the documented path.
- The superseded version is **retained as a permanent record** — the history of the vocabulary is never erased. This follows the lifecycle rule that architecture decisions are permanent records.
- The specification then reflects the successor as canonical, with the predecessor preserved as deprecated history.

## Migration philosophy

- **Consumers are given a path before the old form is retired.** Replacement and migration are documented first; retirement follows.
- **Migration is gradual, not flag-day.** The old and new forms coexist through the deprecation window so migration can be incremental.
- **The frozen Phase 5A enum is never broken.** Any change aligns with `ORGANIZATIONAL_RELATIONSHIP_TYPES` additively; extensions enter as Phase 5B.1 Candidate Relationship Contracts, ratified behind the Director gate, never as a breaking edit to the existing enum.
- **Every version step is auditable.** Proposal, review, approval, deprecation, replacement — each transition is recorded, consistent with the [contract lifecycle](../relationship-contracts/04-contract-lifecycle.md).

## What versioning does not do

Versioning here governs the **specification** — the meanings. It does not:

- Define how versioned relationships are stored or migrated in any datastore.
- Specify a version-numbering scheme, tooling, or migration mechanism.
- Introduce any runtime behavior.

Those are implementation concerns for the phases after the Director gate. This document commits only to the **discipline**: the specification evolves by versioning and deprecation, additively by default, backward-compatibly unless a breaking change is explicitly ratified, and always recorded.
