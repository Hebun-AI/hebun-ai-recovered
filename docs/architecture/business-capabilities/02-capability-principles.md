# 02 — Capability Principles

## Purpose

State the constitution of a business capability — the commitments any capability definition must obey — so the concept stays stable, independent, and measurable across the whole architecture.

## Core Concepts

The principles fix what a capability *must be*. They are the standard every later capability definition is held to, and the guardrails that keep the capability layer from collapsing into organization, process, or agent.

## Architecture

### The principles

#### 1. A capability states an ability, not an activity
A capability is a durable *can* of the enterprise, never a task, step, or project ([what is a capability](01-what-is-a-business-capability.md)). Activities belong to process; the capability is the standing ability.

#### 2. A capability is organization-independent
A capability is defined without reference to who performs it. An organizational unit may be accountable *for* a capability, but the capability does not depend on that unit and survives its reorganization ([capability vs department](03-capability-vs-department.md)).

#### 3. A capability is process-independent
A capability is defined without reference to how it is performed. The process may be rewritten, automated, or replaced; the capability holds unchanged ([capability vs process](04-capability-vs-process.md)).

#### 4. A capability is agent-independent
A capability is defined without reference to which agent runs the work. Agents may be added, replaced, or removed; the capability is unaffected ([capability vs agent](05-capability-vs-agent.md)).

#### 5. A capability is long-lived
Capabilities change slowly and deliberately. If something changes at the speed of a procedure or a reorg, it is process or organization — not capability.

#### 6. A capability is measurable
A capability is defined clearly enough that its presence, strength, and health can be reasoned about ([enterprise thinking](06-enterprise-thinking.md)). An ability no one can assess is not architected as a capability.

#### 7. A capability is singular and non-overlapping
Each capability names one ability. Two capabilities do not claim the same ability, and one capability is not two abilities bundled. Clean boundaries keep the ability model coherent ([design rules](07-design-rules.md)).

#### 8. A capability sits under the enterprise, not above it
The capability layer is architecture *of* the enterprise, under the Director like everything else. It grants no authority and bypasses nothing; it is a model of ability, not a source of power.

## Enterprise Examples

*Illustrative only — not a catalog.*

- **Independence in the abstract:** the same ability holds through a reorg (org-independent), a procedure rewrite (process-independent), and an agent swap (agent-independent). If a candidate "capability" breaks when any of those change, it was misclassified.
- **Durability test:** an ability that survives years of organizational and procedural change is a capability; one that is rewritten each quarter is process.

## Design Principles

- **Independence is the core test.** A true capability survives changes to who/how/which.
- **Durability over detail.** Capture the lasting ability, not its current realization.
- **Measurable or it isn't one.** If it can't be assessed, it isn't a capability.

## Boundaries

- Defines **principles for capabilities**, not any capability.
- Introduces **no process, agent, or execution.**

## Future Evolution

Later phases build the capability structure on these principles: ability-stating, independent on all three axes, long-lived, measurable, singular, enterprise-subordinate. The constitution holds as the layer grows.
