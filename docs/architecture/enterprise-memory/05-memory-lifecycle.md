# 05 — Memory Lifecycle

## Purpose

Define constitutional lifecycle semantics without designing a state machine or Runtime process.

## Lifecycle States

- **Proposed:** submitted for admission; not yet Enterprise Memory.
- **Admitted:** constitutionally accepted for bounded use.
- **Active:** current within its declared Scope and version context.
- **Superseded:** retained but replaced for current use by an identified version.
- **Restricted:** use further limited by Governance, classification, authority, or legal obligation.
- **Deprecated:** discouraged for current use but retained for traceability.
- **Archived:** removed from ordinary active use while history and obligations remain.
- **Disposition Due:** retention outcome requires authorized review.

These are constitutional meanings, not implementation states, transitions, events, jobs, or workflow steps.

## Lifecycle Authority

Lifecycle disposition requires declared organizational authority and applicable Governance participation. A contributor, consumer, Agent, technical custodian, or Runtime component cannot independently change lifecycle meaning.

## History

Every material lifecycle change must preserve prior state, basis, authority, date context, and affected version. Archival, restriction, and supersession never erase provenance.

## Rules

- **P20-LIFECYCLE-001:** Proposed information must not be consumed as admitted Memory.
- **P20-LIFECYCLE-002:** Lifecycle changes must be authorized, attributable, and historically traceable.
- **P20-LIFECYCLE-003:** Supersession must identify both superseding and superseded versions.
- **P20-LIFECYCLE-004:** Archive and deprecation must not erase provenance or prior validity context.
- **P20-LIFECYCLE-005:** Lifecycle status must not imply truth, approval, or execution readiness.
- **P20-LIFECYCLE-006:** Runtime activity must not silently determine constitutional lifecycle.

## Enterprise Example

An approved policy interpretation may later be superseded. The new version becomes current, while the prior version and the period in which it applied remain auditable.
