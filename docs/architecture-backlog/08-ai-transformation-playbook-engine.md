# 08 — AI Transformation Playbook Engine

**Priority:** Medium
**Status:** Planned

## Purpose

Industry-specific AI transformation frameworks. Turns one-off consulting into repeatable, sector-shaped playbooks.

## Example industries

- Manufacturing
- Healthcare
- Legal
- Retail
- Logistics
- Hospitality

## Produces

Repeatable implementation playbooks — the same transformation logic, specialized per industry.

## Architectural notes

Where the Transformation Consultant reasons case by case, the Playbook Engine codifies patterns that recur across an industry. It is the templating layer beneath consulting.

A playbook is a structured, declarative framework: stages, department priorities, and expected outcomes for a sector. The Consultant instantiates a playbook against a specific organization; the engine supplies the reusable frame.

Data, not behavior. A playbook describes an approach; it does not run it.

## Dependencies

- [03 — Transformation Consultant](03-transformation-consultant.md) — the consumer that instantiates playbooks
- [05 — Department Recommendation Engine](05-department-recommendation-engine.md) — department sequencing within a playbook
- Organizational Intelligence canonical contracts — the shape playbooks target

## Promotion criteria

- Consultant and Recommendation Engine operational — the playbook needs consumers.
- Playbook defined as declarative, versioned framework data.
- First industry validated end-to-end before generalizing.
- Director approval.
