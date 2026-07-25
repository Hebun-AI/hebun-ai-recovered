# 09 — Director Memory

**Priority:** High
**Status:** Planned

## Purpose

Persistent organizational memory for the Hebun Director. Long-term recall of what the organization has decided, learned, and preferred, so the Director reasons with continuity rather than from a blank slate each session.

## Responsibilities

- Organizational decisions
- Decision history
- Lessons learned
- Executive preferences
- Long-term organizational context
- Agent observations
- Historical reasoning

## Architectural notes

Memory is state the Director reads and appends to, not a reasoning engine of its own. It stores declarative, provenance-tagged records — decisions, lessons, preferences — keyed to the organizational graph.

Reads inform reasoning; writes are explicit and attributed. Memory never acts. It is the substrate beneath [19 — Learning Engine](19-learning-engine.md): memory holds what happened, the Learning Engine turns it into improved behavior.

## Dependencies

- Organizational Intelligence — the entities memory is keyed to
- Memory Layer — persistence substrate
- Director Runtime — the reader and writer of memory

## Promotion criteria

- Memory Layer available as a persistence substrate.
- Records defined as inert, provenance-tagged, and workspace-scoped.
- Read/write boundary explicit — memory stores, Director reasons.
- Director approval.
