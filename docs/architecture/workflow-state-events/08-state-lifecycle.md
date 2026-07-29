# 08 — State Lifecycle

## Purpose

Define constitutional validity, supersession, history, and closure of State.

## Lifecycle Meanings

- **Proposed:** a candidate condition representation awaits validation.
- **Valid:** evidence and boundaries support use for the declared subject and time.
- **Current:** valid and applicable at the declared observation boundary.
- **Conflicted:** incompatible evidence prevents one unqualified current representation.
- **Superseded:** a later valid State replaces current applicability.
- **Invalidated:** evidence or boundary defects make the representation unusable.
- **Historical:** retained for traceability but not current interpretation.
- **Closed:** State accountability obligations for the subject are complete.

These are semantic qualifications, not state-machine states or transitions.

## History

Supersession and invalidation preserve prior State identity, evidence, effective period, authority context, and reason. Silent overwrite is prohibited.

## Rules

- **P22-STATE-LIFECYCLE-001:** Proposed State must not be represented as valid or current.
- **P22-STATE-LIFECYCLE-002:** Current status requires explicit time and evidence boundaries.
- **P22-STATE-LIFECYCLE-003:** Supersession must preserve historical traceability.
- **P22-STATE-LIFECYCLE-004:** Invalidation must not erase evidence.
- **P22-STATE-LIFECYCLE-005:** Lifecycle qualification must not cause operational transition.
- **P22-STATE-LIFECYCLE-006:** Runtime observation alone must not automatically change constitutional State.

## Enterprise Example

A corrected observation may invalidate a State and support a replacement. The prior State remains historically attributable.
