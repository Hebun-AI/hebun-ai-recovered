# 05 — Capability vs Agent

## Purpose

Establish, precisely, why a capability is **not** an agent — why *what the company can do* is a different thing from *which AI runs the work* — and why capabilities are defined independently of agents.

## Core Concepts

### Capability = what; Agent = which AI
An agent is an AI participant that runs a piece of work ([execution-agents](../execution-agents/README.md)). A capability is an ability: a durable *can* of the enterprise. A capability says the company *is able to* do X; an agent is one *thing that may run* work exercising X. The ability is a property of the company; the agent is one of its possible realizers.

### One capability, many possible agents (or none, or humans)
A capability may be exercised by an AI agent, by a human, by several agents, or by different agents over time ([human-organization](../human-organization/README.md) established human/AI parity). The capability exists whether or not any particular agent does. Agents realize capabilities; they do not constitute them.

### Why agent changes and capability does not
- **Agents are implementation.** They are added, replaced, upgraded, and retired — normal churn at the execution layer.
- **Capability is identity.** The ability is part of what the company *is*, independent of which realizer is currently wired to it.
- If the capability changed every time an agent was swapped, "what the company can do" would depend on implementation churn — which is false. The capability is the invariant above the agent.

### Why this separation matters
Binding a capability to an agent would make the company's abilities hostage to its AI implementation: retire the agent and the company would appear to *lose* an ability it still has. Keeping them separate lets agents evolve freely while abilities stay stable — and lets the enterprise reason about *what it can do* separately from *what AI happens to run it* ([enterprise thinking](06-enterprise-thinking.md)).

## Architecture

- **Capability node** — the durable ability.
- **Execution attachment (future)** — the point at which an agent (or human) exercises the capability. The realizer attaches to the capability; the capability does not embed the realizer.
- **Agent independence** — swapping, adding, or removing agents leaves the capability node unchanged.

This phase defines the capability side only. Agents are the execution/agent layers ([Phase 8](../execution-agents/README.md) and later); named here only to draw the boundary. **No agent is defined or implemented.**

## Enterprise Examples

*Illustrative only — not a catalog, and no agent implementation.*

- The enterprise's ability to do X persists while the *agent* running X-work is replaced with a newer one: same capability, different realizer.
- The same capability could be exercised by a human today and an AI agent tomorrow — evidence the capability is not identical to any agent.

## Design Principles

- **Never define a capability by its agent.** No agent reference in a capability definition.
- **Realizers attach; they don't constitute.** An agent exercises a capability; it is not the capability.
- **Test with an agent swap.** If replacing the agent would change the capability's definition, the definition is wrong.

## Boundaries

- Distinguishes the two concepts; defines **no agent and no capability.**
- Implements **no agent**, writes **no prompt**, describes **no execution.**

## Future Evolution

Later phases define how agents and humans attach to capabilities as realizers — how a *which* exercises a *what* — while keeping the capability agent-independent. Agents will change constantly; the capabilities they realize will remain the enterprise's stable abilities.
