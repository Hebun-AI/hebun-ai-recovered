# 16 — Organizational Simulation

**Priority:** High
**Status:** Planned

## Purpose

Scenario simulation. Model organizational what-ifs against the current graph before committing to them in reality.

## Example scenarios

- Hiring simulations
- Budget simulations
- AI adoption simulations
- Organizational restructuring
- ROI estimation

## Architectural notes

Simulation reads the organizational graph, applies a hypothetical change, and projects outcomes — without touching live state. Every run is sandboxed: it operates on a copy, and its results are a report, not a mutation.

Output is a declarative projection consumable by the Transformation Consultant and Recommendation Engine. The simulation reasons over possibilities; it never enacts them. The boundary between "simulate restructuring" and "restructure" is absolute.

## Dependencies

- Organizational Intelligence — the graph it projects over
- [17 — Cost Intelligence](17-cost-intelligence.md) — cost/ROI inputs for budget and adoption scenarios
- Consumed by [03 — Transformation Consultant](03-transformation-consultant.md)

## Promotion criteria

- Organizational graph stable enough to project against.
- Sandbox boundary proven — no run mutates live state.
- Scenario output defined as a declarative projection.
- Director approval.
