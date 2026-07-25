# 06 — Versioning

How canonical memory contracts evolve without breaking prior architectural decisions. Memory contracts must stay stable enough to keep decades of history interpretable, yet flexible enough to grow as understanding deepens. Versioning reconciles the two: change happens through new versions and deprecation, never through silent edits. Philosophy and rules only — no implementation.

This specializes the [memory contract lifecycle](05-contract-lifecycle.md) to the evolution of the contracts themselves.

## Long-term stability

Memory contracts are the **most stability-sensitive** contracts in the platform, because memory is permanent. A memory recorded today must remain interpretable indefinitely — long after the runtime that recorded it is gone. The contract is the fixed point that guarantees this: as long as `Memory` means what it meant, a memory from years past reads correctly today.

Stability here is not conservatism; it is the core promise of memory. A past whose definition could drift would not be a past worth trusting.

## Compatibility

- **Additive change is preferred.** Extending the memory vocabulary — a new object, a new relationship that does not restrict existing ones — is the low-risk path. New capability should extend the model, not redefine it.
- **Backward compatibility is the default.** A contract change must not render previously recorded memories uninterpretable without an explicit, documented migration. Existing history stays readable.
- **Breaking change is exceptional.** Redefining an object's meaning breaks the interpretation of every memory recorded under it. Such changes are rare, deliberate, and always versioned with a migration path.

## Extension

The primary evolution mechanism is extension, not mutation. New memory objects and new relationships are added alongside existing ones. A new memory category or a new reference kind extends what can be remembered without changing what "Memory" already means. Extension grows the vocabulary while leaving recorded history untouched.

## Deprecation

- A memory object being retired is **marked deprecated**, not deleted.
- Memories already recorded against a deprecated object remain **valid and readable** through and beyond the deprecation window — history is never invalidated by the retirement of the contract that shaped it.
- Deprecation names the **replacement**, if any, and the migration expectation.
- Nothing is removed abruptly; abrupt removal would orphan real history.

## Migration philosophy

- **History is never rewritten to fit a new contract.** Migration adapts how *new* memories are recorded; it does not retroactively alter memories already recorded under the old definition. Those remain as they were — consistent with the never-rewrite-facts principle.
- **Consumers are given a path before the old form is retired.** Replacement and migration are documented first; retirement follows.
- **Migration is gradual.** Old and new forms coexist through the deprecation window so migration is incremental, never a flag-day.
- **Every version step is auditable.** Proposal, review, approval, deprecation, replacement — each recorded, consistent with the lifecycle.

## How memory contracts evolve without breaking prior decisions

The governing rule: **new versions extend the past; they never overwrite it.**

- A superseded contract version is **retained as a permanent record**, because the memories recorded under it are permanent. Erasing the contract would strand its history.
- Prior architectural decisions ([decision log discipline](../../architecture-backlog/00-capability-lifecycle.md)) stay intact — a version change is recorded as a new decision layered over the old, not a rewrite of it.
- Phase 5 and Phase 6A remain untouched by any memory-contract version change; memory contracts evolve within their own layer and only ever *reference* the frozen structure.

## What versioning does not do

Versioning here governs the **contracts** — the definitions of memory objects. It does not:

- Define how versioned memories are stored or migrated in any datastore.
- Specify a version-numbering scheme, tooling, or migration mechanism.
- Introduce any runtime, retrieval, or storage behavior.

Those are implementation concerns for the phases after the Director gate. This document commits only to the **discipline**: memory contracts evolve by versioning and deprecation, additively by default, backward-compatibly unless a breaking change is explicitly ratified, with all history and all prior decisions preserved.
