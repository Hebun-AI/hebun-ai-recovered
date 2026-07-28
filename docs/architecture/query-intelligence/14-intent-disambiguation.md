# 14 — Intent Disambiguation

## Purpose

Intent Disambiguation determines whether candidate interpretations can be safely distinguished using the preserved Query and qualified Context already available.

## Ambiguity Classes

- lexical ambiguity;
- referential ambiguity;
- Scope ambiguity;
- domain ambiguity;
- temporal or version ambiguity;
- outcome ambiguity;
- authority ambiguity;
- multi-intent ambiguity;
- question/command ambiguity.

## Outcomes

- **Resolved** — one interpretation is supported within declared limits.
- **Resolved with Qualification** — one interpretation is usable but limitations remain.
- **Multi-Intent** — several separable purposes are present.
- **Clarification Required** — material ambiguity cannot be resolved safely.
- **Unsupported** — only prohibited outcome semantics remain.
- **Out of Scope** — no permitted architectural intent exists.

## Rules

- **IDISAMBIG-001:** Every material candidate interpretation must remain visible until resolved or rejected with rationale.
- **IDISAMBIG-002:** Ambiguity must never be hidden to force package readiness.
- **IDISAMBIG-003:** Missing Context must not be fabricated or retrieved by Query Intelligence.
- **IDISAMBIG-004:** Clarification Required may identify the ambiguous element but must not answer or recommend.
- **IDISAMBIG-005:** Urgency, frequency, or origin must not break an ambiguity tie.
- **IDISAMBIG-006:** Resolution must preserve original wording, alternatives, evidence basis, and limitations.

## Enterprise Example

“Does the current model violate it?” contains referential, version, and domain ambiguity. If Context cannot bind both “model” and “it,” the outcome is Clarification Required rather than a guessed Objective.

## Boundaries

No conversational dialog, clarification UI, retrieval, model inference, or answer construction is defined.
