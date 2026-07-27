# 53 — Context Assembly Model

## Definition

**Context Assembly** is the governed organization of evidence and supporting information needed to evaluate one bounded architecture question. It creates a traceable analytical view while preserving the identity, authority, provenance, lifecycle, version, scope, and uncertainty of every included item.

Context is temporary analytical framing. It is not a new source of truth and does not inherit the authority of the canonical material it references.

## Context Classes

| Context | Purpose | Permitted Content | Authority Boundary |
|---|---|---|---|
| **Canonical Context** | Establish governing architectural meaning | Approved documents, decisions, rules, identities, definitions, relationships, invariants, lifecycle and version declarations | Normative only within its declared scope and lifecycle |
| **Derived Context** | Expose traceable representations of canonical material | Entities, Relationships, Representations, Graph assertions, validation findings, and direct derivations | Subordinate to and correctable from canonical sources |
| **Runtime Context** | Present relevant operational facts without redefining architecture | Explicitly sourced observations, state, telemetry summaries, and execution outcomes when allowed by the question | Evidentiary and non-canonical; cannot override architecture |
| **Historical Context** | Explain superseded or time-bound architectural meaning | Deprecated, archived, prior-version, and past-decision material | Authoritative only for its historical scope; not current by default |
| **Conversation Context** | Preserve the current question and declared constraints | Director question, clarifications, assumptions supplied for evaluation, and requested output boundary | Intent-bearing but non-canonical unless separately approved |
| **Authority Context** | Make governance and decision rights explicit | Source authority, owners, approvals, applicable rules, escalation routes, and decision boundaries | Describes authority; does not create or transfer it |

## Context Assembly Contract

Every assembled item must retain:

- stable source or derived identity;
- context class;
- exact scope;
- lifecycle and applicable version;
- authority classification;
- evidence and provenance path;
- time relevance where applicable;
- interpretation status;
- known uncertainty or conflict;
- reason for inclusion.

Assembly must preserve the original source reference even when a normalized view is used. Cross-context relationships may be recorded, but contexts must not be collapsed into one authority-neutral collection.

## Context Isolation

Canonical Context governs meaning. Derived Context aids navigation and analysis. Runtime Context may support compliance or drift observations. Historical Context explains change. Conversation Context bounds the inquiry. Authority Context controls what may be concluded and who may decide.

An item may be relevant to more than one analytical concern, but it must have one explicit provenance and must not gain authority merely because it appears beside canonical evidence.

## Critical Distinctions

- **Context ≠ Memory** — context is question-bounded analytical framing; memory is a persistence concern outside this phase.
- **Context ≠ Prompt** — context is an architectural information contract; no model instruction or prompt construction is defined.
- **Context ≠ Knowledge Graph** — a graph is a derived representation source; context is a governed selection for one inquiry.
- **Context ≠ Runtime State** — Runtime state may be included as classified evidence but does not become the context model itself.
- **Context Assembly ≠ Evidence Creation** — assembly selects and organizes; it does not invent.
- **Context Proximity ≠ Authority** — placement beside an authoritative source does not transfer authority.

## Assembly Principles

1. Resolve scope and authority before assembly.
2. Prefer canonical evidence for normative questions.
3. Include only information relevant to the resolved question.
4. Label non-canonical information explicitly and visibly.
5. Preserve disagreement rather than normalizing it away.
6. Separate current and historical validity.
7. Record missing required context as a finding.
8. Minimize context without sacrificing material evidence.
9. Keep every conclusion traceable to included evidence.
10. Treat context as disposable; the sources remain durable.

## Enterprise Example

For an inquiry about whether a Runtime observation indicates architectural drift, Canonical Context contains the approved rule, Derived Context contains its traceable representation, Runtime Context contains the observation, Historical Context contains a superseded rule if relevant, Conversation Context contains the Director's time window, and Authority Context identifies who may judge whether a canonical change is needed. The observation may support a drift finding but cannot amend the rule.

## Boundaries

This model defines no memory store, retrieval mechanism, prompt format, token strategy, cache, database, graph query, embedding, agent, API, or Runtime assembly service. It does not permit context to update canonical architecture.

