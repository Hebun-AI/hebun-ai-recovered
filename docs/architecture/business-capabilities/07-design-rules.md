# 07 — Design Rules

## Purpose

Give the rules for defining business capabilities correctly — the practical constraints that keep future capability definitions faithful to the concept, independent on all three axes, durable, and measurable. These rules are how later phases avoid drifting a capability into an organization, a process, or an agent.

## Core Concepts

The rules operationalize the [capability principles](02-capability-principles.md) into concrete do/don't guidance for whoever later defines actual capabilities. They are guardrails, not a catalog — this phase defines no capabilities.

## Architecture

### The rules

#### R1 — State an ability, not an activity
Define a capability as what the enterprise *can do*, phrased as a durable ability. Never phrase it as a task, step, or project ([what is a capability](01-what-is-a-business-capability.md)).

#### R2 — Never name a department in a capability
A capability definition contains no org unit, seat, or role. If removing the org name breaks the definition, it was a department in disguise ([capability vs department](03-capability-vs-department.md)).

#### R3 — Never name a process in a capability
A capability definition contains no procedure or steps. If it reads like a "how", it is process, not capability ([capability vs process](04-capability-vs-process.md)).

#### R4 — Never name an agent in a capability
A capability definition contains no agent or realizer. If it depends on a specific AI, it is bound to an agent, not an ability ([capability vs agent](05-capability-vs-agent.md)).

#### R5 — Pass the three change tests
A valid capability survives:
- a **reorg** (org-independent),
- a **process rewrite** (process-independent),
- an **agent swap** (agent-independent).
If any change alters the capability's definition, the definition is wrong.

#### R6 — Make it measurable
Define the capability clearly enough that its presence and strength can be assessed ([enterprise thinking](06-enterprise-thinking.md)). An unassessable ability is not a well-formed capability.

#### R7 — Keep it singular and non-overlapping
One capability names one ability. Do not bundle two abilities, and do not let two capabilities claim the same ability ([capability principles](02-capability-principles.md)).

#### R8 — Keep it durable
Capture the lasting ability, not its current realization. If it would need rewriting as often as a procedure, it is process.

#### R9 — Build no catalog in this phase
These rules govern *how* to define capabilities later. This phase defines **none** — no Marketing, Finance, Sales, HR, or any capability map.

## Enterprise Examples

*Illustrative of applying the rules — not a catalog.*

- **Rule check in the abstract:** a candidate that names a department fails R2; one that reads as steps fails R3; one tied to a specific agent fails R4. A candidate that survives reorg, rewrite, and agent swap and can be assessed passes R5–R6.
- **Singularity:** a candidate bundling two distinct abilities fails R7 and should be split into two capabilities.

## Design Principles

- **The three change tests are the master check.** Independence on all three axes is non-negotiable.
- **If in doubt, it's probably process.** Durability and ability-framing separate capability from process.
- **Rules now, capabilities later.** This phase writes the ruler, not the list.

## Boundaries

- Gives **rules for defining capabilities**; defines **no capability.**
- Builds **no catalog, workflow, agent, or process.**

## Future Evolution

Phase 10B and later apply these rules to define the enterprise's actual capabilities and their structure — always passing the three change tests, always measurable, always singular. The rules fixed here are the standard those definitions will be held to.
