# 03 — Memory Categories

Organizational memory spans many domains. Categories organize memory by the kind of organizational activity it records, so memory stays navigable and so reasoning can focus on the relevant slice of history. A memory belongs to a primary category; categories are a conceptual grouping, not an implementation.

Each category records the history of a different facet of the organization. Together they form the organization's full remembered life.

## Strategic

**Records.** Direction-setting decisions — vision, positioning, major bets, pivots, and the reasoning behind them.

**Purpose.** Preserve why the organization chose its course, so future strategy is informed by past strategy and its outcomes rather than repeating abandoned directions.

## Operational

**Records.** Day-to-day execution — how work was run, process decisions, operational incidents and their resolutions.

**Purpose.** Retain operational know-how so recurring situations are met with accumulated practice rather than improvisation.

## Financial

**Records.** Financial history — budgets, spend decisions, cost outcomes, ROI results, financial constraints as they applied over time.

**Purpose.** Give financial reasoning a trajectory: what was budgeted, what it cost, what it returned — the basis for sound future allocation.

## Customer

**Records.** The history of external relationships — customer engagements, decisions, escalations, outcomes, and the evolution of each relationship over time.

**Purpose.** Preserve the organization's memory of *who it serves and how that has gone*, anchored to the Party and PartyRole entities of Phase 5.

## Engineering

**Records.** Technical history — architecture decisions, systems built, technical trade-offs, incidents, and lessons from engineering work.

**Purpose.** Keep engineering rationale durable so technical choices are traceable and past technical lessons inform new work rather than being rediscovered.

## Product

**Records.** Product evolution — features shipped, product decisions, user-facing trade-offs, what was tried and what was learned.

**Purpose.** Retain the product's decision history so product reasoning builds on what worked and avoids relitigating settled choices.

## Compliance

**Records.** Regulatory and governance history — compliance decisions, obligations as they applied, audits, and the evidence of conformance over time.

**Purpose.** Provide a durable, auditable record of how the organization met its obligations — memory here is also the substrate of demonstrable compliance.

## AI-generated

**Records.** Memory produced by AI agents — observations, analyses, recommendations, and reasoning the platform's own agents generated.

**Purpose.** Treat AI output as first-class organizational memory, distinguished by its AI Source, so the organization remembers what its agents concluded and can weigh it accordingly.

## Institutional

**Records.** The organization's cross-cutting long-term context — culture, precedent, norms, and knowledge that transcends any single domain or person.

**Purpose.** Preserve the institutional identity that must survive personnel change — the "how we do things and why" that no individual owns but the organization depends on.

---

## Category summary

| Category | Records | Anchored to (Phase 5) |
|---|---|---|
| Strategic | Direction-setting decisions | Organization |
| Operational | Execution and process history | OrganizationalUnit, Role |
| Financial | Budget, cost, ROI history | Organization, Responsibility |
| Customer | External relationship history | Party, PartyRole |
| Engineering | Technical decisions and lessons | OrganizationalUnit, Capability |
| Product | Product evolution and decisions | Capability, OrganizationalUnit |
| Compliance | Regulatory and audit history | LegalEntity, Responsibility |
| AI-generated | Agent observations and analyses | AIAgent (Source) |
| Institutional | Long-term cross-cutting context | Organization |

Categories are stable conceptual groupings. Adding a category is a deliberate architectural act, not a convenience. This document defines organization only — no storage, no implementation.
