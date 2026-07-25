# 13 — Policy Engine

**Priority:** High
**Status:** Planned

## Purpose

Enterprise governance. A central place to define and evaluate the rules an organization operates under, so constraints are declared once and enforced everywhere.

## Example policies

- Financial limits
- Security rules
- Compliance rules
- Data residency
- Tool restrictions
- AI safety policies

## Architectural notes

Policies are declarative rules; the engine evaluates them against a proposed action and returns a decision. It is a gate, not an actor — it permits or denies, it never performs the action itself.

Enforcement points (runtime, tools, agents) consult the engine before acting. The engine depends on no capability; capabilities depend on it. This keeps governance central and one-directional.

Distinct from the Permission Engine: policy answers *is this action allowed by the rules?*, permission answers *is this actor allowed to do it?* The two compose.

## Dependencies

- Organizational Intelligence — the entities and scopes policies bind to
- Consumed by runtime, [12 — Tool Registry](12-tool-registry.md), and agents at enforcement points
- Composes with [14 — Permission Engine](14-permission-engine.md)

## Promotion criteria

- Policy defined as declarative, evaluable rules.
- Decision interface specified — permit/deny, no side effects.
- Enforcement points identified.
- Director approval.
