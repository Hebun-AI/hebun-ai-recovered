# 07 — Context Assembly

## Purpose

Context Assembly forms the minimum bounded set of references needed to interpret a Query and formulate a Reasoning Objective. Context frames the request; it is not evidence.

## Context Classes

| Context Class | Purpose | Boundary |
|---|---|---|
| Query Context | original phrasing, origin, purpose, constraints, and ambiguity | not evidence or authority |
| Canonical Context Reference | identifies applicable canonical subjects already represented upstream | does not copy canonical content |
| Processing Context Reference | links the eligible Processing Output Package and its Scope | cannot change Phase 13 Context |
| Historical Context Reference | identifies relevant versions or intervals | recency does not create authority |
| Organizational Context Reference | identifies enterprise and accountable domain | ownership is not decision authority |
| Authority Context Reference | identifies required authority or unresolved authority condition | Query Intelligence does not exercise it |
| Conversation Context | minimum preceding statements required to preserve meaning | temporary, non-canonical, and explicitly bounded |

## Assembly Contract

Every reference records identity, class, source, relevance, Scope, Tenant, classification, provenance, version, uncertainty, limitation, and expiry. Context classes remain isolated even when they refer to the same subject.

## Missing Context

Missing Context is recorded by class, affected Intent or Objective, materiality, clarification need, and permitted limited outcome. It must not be inferred from ambient memory, hidden state, or unrelated conversation.

## Rules

- **QCONTEXT-001:** Context and Evidence must remain distinct.
- **QCONTEXT-002:** Every Context item must declare class, origin, relevance, Tenant, Scope, and limitation.
- **QCONTEXT-003:** Context Assembly must minimize information to the Query purpose.
- **QCONTEXT-004:** Missing material Context must yield ambiguity, limitation, clarification, or refusal.
- **QCONTEXT-005:** Conversation Context must never become canonical truth, authority, evidence, or unrestricted memory.
- **QCONTEXT-006:** Context references must not modify the Processing Output Package.
- **QCONTEXT-007:** Classification, privacy, retention, and disclosure restrictions must propagate.

## Enterprise Example

A follow-up Query says “Does it still apply?” Assembly includes only the prior referenced architecture identity and version needed to preserve meaning. If “it” maps to two subjects, ambiguity remains visible.

## Boundaries

No memory system, context window, retrieval implementation, vector search, prompt construction, or session store is defined.
