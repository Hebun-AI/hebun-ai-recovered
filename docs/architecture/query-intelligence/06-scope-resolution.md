# 06 — Scope Resolution

## Purpose

Scope Resolution defines exactly where a Query-derived Objective applies and exposes every material unresolved boundary before a Reasoning Request Package is formed.

## Scope Dimensions

- Tenant and organization;
- enterprise and architecture domain;
- concept, entity, relationship, capability, document, or rule identity;
- lifecycle and approval state;
- version and supersession status;
- effective and historical time interval;
- jurisdiction and language when material;
- included and excluded subjects;
- correlation boundary;
- analytical depth and coverage limits.

## Resolution Status

- **Resolved** — every material boundary is explicit and compatible.
- **Partially Resolved** — separable analysis is safe with named exclusions.
- **Ambiguous** — multiple materially different Scopes remain.
- **Conflicted** — supplied Scope references are incompatible.
- **Insufficient** — required identity, version, lifecycle, or time information is absent.
- **Out of Scope** — no allowed Query Intelligence or Reasoning responsibility applies.

## Resolution Principles

Scope may be narrowed to make an Objective safe but cannot expand beyond the Query or referenced Processing Output Package silently. Query wording, defaults, current Runtime state, popularity, or convenience cannot resolve a canonical identity or version.

## Rules

- **QSCOPE-001:** Every Objective must bind one explicit Query Scope status and version.
- **QSCOPE-002:** Scope cannot exceed the original Query or Processing Output Package boundaries.
- **QSCOPE-003:** Tenant, identity, version, lifecycle, and time ambiguity must remain explicit.
- **QSCOPE-004:** Partial Scope must identify supported and excluded portions separately.
- **QSCOPE-005:** Scope changes require a new rationale, version, and Request Package validation.
- **QSCOPE-006:** Missing Scope must not be filled from unrestricted conversation, memory, or Runtime state.
- **QSCOPE-007:** Scope resolution must not become retrieval, evidence selection, or reasoning.

## Enterprise Example

A Query names a capability but omits its version. If the Processing Output Package covers two materially different versions, Scope remains Ambiguous and clarification is required rather than selecting the latest automatically.

## Boundaries

No entity resolution engine, search, database query, SQL, retrieval, or Runtime filter is defined.
