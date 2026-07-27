# 01 — What Is a Business Capability

## Purpose

Define, precisely, what a business capability *is* — and is not — so the rest of the layer builds on a clear concept. This document establishes the capability as a stable statement of an ability the enterprise possesses, independent of organization, process, and agent.

## Core Concepts

### A capability is an ability the enterprise has
A business capability is a **stable, named ability of the company** — a statement of *what the enterprise can do*, expressed as a durable fact rather than an activity. It answers "what is this company able to do?", not "who does it", "how is it done", or "which agent runs it".

### A capability is stated as an ability, not an action
A capability is phrased as a *can*: the enterprise *is able to* do X. It is not a task, not a step, not a project. Tasks and steps are process; the capability is the standing ability those tasks would exercise.

### A capability is occupant-, process-, and agent-independent
The same capability holds whether a human or an AI performs it, whether the procedure is old or rewritten, and whichever agent runs the work. The ability is defined by *what* it is, not by any of the things that realize it ([capability vs department](03-capability-vs-department.md), [capability vs process](04-capability-vs-process.md), [capability vs agent](05-capability-vs-agent.md)).

### A capability is long-lived
Capabilities change slowly. Organizations reorganize, processes get rewritten, agents are replaced — the capability persists across all of it. It is one of the most stable facts about a company.

## Architecture

A business capability, architecturally, is a **node in the enterprise's ability model** with these properties:

- **An identity** — a stable name for the ability.
- **A definition** — a statement of what the enterprise can do, at the ability level.
- **Independence** — defined without reference to a department, a process, or an agent.
- **Ownership attachment point** — a place an organizational unit can be made accountable *for* the capability, without the capability depending on that unit ([capability vs department](03-capability-vs-department.md)).
- **Measurability surface** — the capability is defined clearly enough to be reasoned about and assessed ([enterprise thinking](06-enterprise-thinking.md)).

The capability layer is a set of such nodes — an ability model of the enterprise, sitting above organization and orthogonal to process and agent. This phase defines the *node concept*; it instantiates no nodes.

## Enterprise Examples

*Illustrative of the concept only — not a capability catalog.*

- The *distinction* in the abstract: "the enterprise is able to serve a customer through their lifecycle" is a capability (a durable *can*); "the Support Department" is an organization (a *who*); "the ticket-triage procedure" is a process (a *how*); "the triage agent" is an agent (a *which AI*). One ability, three different realizing things.
- A capability persists while its realizations change: the ability itself stays constant even as the owning unit reorganizes, the procedure is rewritten, and the agent is swapped.

These illustrate the *shape* of the concept. This phase defines no actual capabilities.

## Design Principles

- **State abilities, not activities.** A capability is a *can*, not a *do*.
- **Define independently.** Never define a capability by its department, process, or agent.
- **Prefer durability.** If it changes as fast as a procedure, it is process, not capability.

## Boundaries

- Defines **the concept of a capability**, not any capability.
- Describes **no process, agent, workflow, or execution.**
- Builds **no list, map, or catalog.**

## Future Evolution

Later phases define how capability nodes are structured, owned, measured, and eventually related to process and agents — always preserving that a capability is a durable, independent statement of ability. The concept fixed here does not change; it gets built upon.
