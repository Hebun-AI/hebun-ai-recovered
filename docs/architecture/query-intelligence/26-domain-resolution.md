# 26 — Domain Resolution

## Purpose

Domain Resolution identifies the explicit enterprise architecture domain to which a Query and Objective apply without performing broad semantic search or inventing ownership.

## Domain Contract

Each Domain Resolution record contains candidate domain identities, source of each candidate, Query mapping, organizational relationship references, Scope and Tenant, ambiguity, overlap, exclusions, compatibility with the Processing Output Package, and status.

Statuses are `Resolved`, `Multiple Applicable`, `Ambiguous`, `Conflicted`, `Insufficient`, or `Out of Scope`.

## Rules

- **DOMAIN-001:** Domain identity must derive from explicit Query, qualified Context, or canonical references.
- **DOMAIN-002:** Domain names, organizational labels, and capability names must not be treated as interchangeable automatically.
- **DOMAIN-003:** Multiple applicable domains must remain visible and separately scoped.
- **DOMAIN-004:** Ambiguous or missing domain must not default to a popular or current domain.
- **DOMAIN-005:** Domain Resolution must preserve Tenant and organization boundaries.
- **DOMAIN-006:** Resolution must not retrieve evidence, assign ownership, route Runtime work, or reason.

## Enterprise Example

“Customer retention architecture” could map to Sales, Customer Success, or cross-domain capability architecture. If canonical Context supports all three, status remains Multiple Applicable until Scope is bounded.

## Boundaries

No ontology inference, semantic search, domain classifier implementation, ownership decision, or routing service is defined.
