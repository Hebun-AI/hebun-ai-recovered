# 19 — Learning Engine

**Priority:** High
**Status:** Planned

## Purpose

Continuous organizational learning. Turn accumulated experience into steadily better recommendations and reasoning.

## Responsibilities

- Learn from previous projects
- Improve recommendations
- Capture successful patterns
- Capture failed patterns
- Improve organizational reasoning

## Architectural notes

The Learning Engine reads history and produces improved patterns; it does not store the raw history itself — that is Director Memory's role. Memory holds what happened; the Learning Engine distills why it worked or failed and feeds that back into recommendations.

Its output is declarative: captured patterns, weighted by outcome, consumable by the Consultant and Recommendation Engine. It improves reasoning by supplying better inputs, never by acting directly on the organization.

**Its subject is the customer's organization, not Hebun.** Improving the Hebun product from its own usage and failure signals belongs to [24 — Hebun Self-Evolution System](24-hebun-self-evolution-system.md). The two learn from different records, answer to different authorities, and must not be merged.

## Dependencies

- [09 — Director Memory](09-director-memory.md) — the historical record it learns from
- Organizational Intelligence — the entities patterns are keyed to
- Feeds [03 — Transformation Consultant](03-transformation-consultant.md) and [05 — Department Recommendation Engine](05-department-recommendation-engine.md)

## Promotion criteria

- Director Memory available as the source of historical records.
- Pattern output defined as declarative, outcome-weighted data.
- Boundary clear — improves inputs, does not act.
- Director approval.
