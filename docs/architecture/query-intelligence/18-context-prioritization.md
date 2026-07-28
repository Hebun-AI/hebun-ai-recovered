# 18 — Context Prioritization

## Purpose

Context Prioritization orders already qualified Context references by necessity for Query interpretation and Objective formation. It does not rank evidence or retrieve data.

## Priority Classes

- **Required** — absence blocks safe qualification.
- **Material** — absence permits only limited qualification.
- **Supporting** — improves interpretation but does not change core meaning.
- **Excluded** — irrelevant, unauthorized, out of Scope, expired, or unsafe.
- **Unknown Relevance** — cannot be used until qualified.

## Priority Dimensions

Purpose fit, Scope fit, referential necessity, domain applicability, version and time relevance, authority-reference need, Tenant and classification compatibility, provenance, and privacy minimization.

## Rules

- **CPRIORITY-001:** Priority must be Query-, Intent-, Objective-, and Scope-specific.
- **CPRIORITY-002:** Context priority must not imply evidence weight, truth, authority, or Runtime scheduling.
- **CPRIORITY-003:** Required Context must be minimal and explicitly justified.
- **CPRIORITY-004:** Exclusion requires a traceable rationale and affected-qualification impact.
- **CPRIORITY-005:** Unknown relevance must not default to inclusion.
- **CPRIORITY-006:** Sensitive Context must follow minimization and disclosure constraints.

## Enterprise Example

For “Does it still apply?”, the prior referenced identity is Required, the historical version is Material, and unrelated conversation is Excluded. No evidence ranking occurs.

## Boundaries

No retrieval ranking, search relevance, embedding, cache, memory priority, or scheduling is defined.
