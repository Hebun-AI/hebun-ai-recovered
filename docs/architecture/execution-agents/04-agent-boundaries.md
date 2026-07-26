# 04 — Agent Boundaries

## Purpose

Agent Boundaries define **what an execution agent must never do**. The agent is where work meets the world — the acting component at the end of the whole chain. Its boundaries are therefore the last line that keeps action within what was approved. This document draws those lines explicitly, for every agent, whatever it performs.

## Architectural role

Agent Boundaries make the [agent principles](01-agent-principles.md) concrete as prohibitions, and complete the [agent responsibilities](03-agent-responsibilities.md): responsibilities say what an agent does, boundaries say what it must not. They define the wall between the performing agent and every role it must not assume — reasoning, planning, deciding, governing, orchestrating, authority.

## An Execution Agent does NOT

### Reason
An agent forms no judgment. When its task meets the unexpected, it does not reason about what it means — it reports. Reasoning is the [Phase 7 domains'](../director-review/README.md) job.

### Redesign plans
An agent changes no plan. It performs the assigned task as given; it does not add, reorder, or reinterpret tasks, even if the plan seems improvable. Re-planning happens upstream, under the Director's authority.

### Make decisions
An agent chooses nothing. Where its task leaves a choice or hits an unforeseen fork, it does not resolve it — it reports the gap. Deciding is the [decision domain's](../director-decision/README.md) job.

### Govern execution
An agent makes no governance judgment. It honors committing-action markers and the Director's approval, but it does not evaluate policy or permission — governance was aligned and enforced upstream ([decision](../director-decision/05-governance-alignment.md), [orchestration](../director-orchestration/05-governance-control.md)).

### Orchestrate other agents
An agent coordinates no one. It performs its own work and directs no other agent. Coordination is orchestration's job ([Phase 8B](../execution-orchestration/README.md)); an agent that directed others would seize authority over them.

### Bypass Director Authority
An agent never manufactures a committing action the Director did not approve, and never proceeds past the Director's control ([Director Authority](../director-reasoning/05-director-authority.md)). It acts only within the approval and assignment it was handed.

## What an agent does with the unexpected

The defining question for the acting component: *what does an agent do when its task does not fit reality?* The answer is the boundary in action — **the agent reports and defers; it never crosses a boundary to fill the gap itself.**

- A missing detail → report it, do not invent it (that would be planning).
- An unforeseen choice → report it, do not resolve it (that would be deciding).
- A task that cannot be performed as given → report it and stop, do not redesign it (that would be re-planning).
- A need to involve another agent → report it to orchestration, do not direct that agent (that would be orchestrating).
- A new committing action → refuse it, do not perform it (that would bypass authority).

An agent's response to the unexpected is always to surface it to orchestration, the reasoning domains, or the Director — never to assume a role it does not hold.

## Boundaries of this document

- It **defines prohibitions, not methods** — what an agent must not do, not how it performs.
- It **describes no concrete agent or runtime** — specific agents and their machinery are later phases.

## Future direction

Future agents will act more capably within these boundaries — handling more of the world's variability by *reporting* it, never by *assuming a role they lack*. The boundaries are fixed: an agent performs, reports, and defers; it never reasons, re-plans, decides, governs, orchestrates, or bypasses authority. Capability grows within the wall; the wall does not move.
