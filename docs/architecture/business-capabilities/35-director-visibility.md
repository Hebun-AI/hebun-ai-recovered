# 35 — Director Visibility

## Purpose

Define **Director Visibility** and **Enterprise Awareness** — how the understanding produced by the intelligence layer reaches the Director, giving the Director awareness of the enterprise's abilities. This is the payoff of Capability Intelligence: the Director can see what the company can do, how well, and where it is at risk. This document defines the visibility architecture, not any dashboard or UI.

## Core Concepts

### Enterprise Awareness — the Director sees the ability model
**Enterprise Awareness** is the Director's understanding of the enterprise's capabilities as a whole — their health, maturity, risk, criticality, and structure. It is what the intelligence layer exists to produce ([capability intelligence](30-capability-intelligence.md)): a true, current picture of what the enterprise can do, surfaced to the one who steers it.

### Director Visibility — the surfacing mechanism
**Director Visibility** is the architectural link by which capability insight ([observation and insight](34-observation-and-insight.md)) is surfaced to the Director. It builds on each capability's Director Visibility field ([capability governance](21-capability-governance.md)) and aggregates the insight into awareness. Visibility is *how understanding reaches the apex*.

### Visibility serves the Director's authority
The Director sits above the whole enterprise ([authority model](../enterprise-organization/04-authority-model.md)). To steer it, the Director must see it. Director Visibility of capabilities is how the Director's oversight reaches the ability model — the Director cannot govern or invest in abilities it cannot see. Visibility is the precondition for Director steering.

### Visibility surfaces; the Director decides
Director Visibility delivers *understanding*, not decisions. It presents the state of the enterprise's abilities; the Director reasons and decides through Director Intelligence ([Phase 7](../director-reasoning/README.md)). The intelligence layer never decides on the Director's behalf, never recommends as authority, and never acts. It makes the enterprise *knowable*; the Director acts on that knowledge.

### Visibility is complete and honest
The Director sees the *whole* ability model — no capability is hidden from the Director ([capability governance](21-capability-governance.md)) — and the picture is truthful: weaknesses, immaturity, and risks are surfaced, not concealed. Awareness that hid problems would defeat its purpose.

## Architecture

- **Enterprise Awareness** — the Director's understanding of the whole ability model.
- **Director Visibility link** — surfacing of insight to the Director, per-capability and aggregate.
- **Precondition for steering** — visibility enables Director governance and investment.
- **Surface, not decide** — visibility delivers understanding; the Director decides.
- **Complete + honest** — nothing hidden, nothing sugar-coated.

## Enterprise Examples

*Illustrative of the visibility architecture only — no dashboard or UI.*

- The *kind* of awareness: the Director can see which abilities are strong, which are immature, which are high-risk single points of failure — across the whole enterprise. This phase defines *how* that understanding reaches the Director; it designs no dashboard and no UI.

## Design Principles

- **Visibility precedes steering.** The Director must see abilities to govern them.
- **Surface understanding; never decide.** Decisions stay with the Director.
- **Complete and honest.** No hidden capabilities, no concealed problems.

## Boundaries

- Defines **Director Visibility and Enterprise Awareness**, not any dashboard, UI, or report.
- No metric, KPI, workflow, process, agent, execution, code, or prompt.

## Future Evolution

Later phases build the surfaces that present awareness to the Director, keeping visibility complete, honest, and understanding-only. This phase fixes that the Director sees the whole ability model and acts on it through Director Intelligence.
