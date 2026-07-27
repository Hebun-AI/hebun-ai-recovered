# 18 — Capability Inputs and Outputs

## Purpose

Define two required meta-model fields: **Inputs** (what a capability consumes) and **Outputs** (what it produces) — stated at the ability level, never as process steps. These fields describe what an ability takes in and gives out, so capabilities can be related to each other without describing how the work is done.

## Core Concepts

### Inputs — what the ability consumes
A capability's **Inputs** are what it depends on being available in order to exercise the ability — stated as *kinds of thing*, at the ability level. Inputs are not a procedure's steps or a task's parameters; they are the standing "this ability consumes X" facts about the capability.

### Outputs — what the ability produces
A capability's **Outputs** are what exercising the ability yields — again as kinds of thing, at the ability level. Outputs are not a workflow's results per run; they are the standing "this ability produces Y" facts.

### Inputs/Outputs are ability-level, not process-level
This is the critical boundary. Inputs and Outputs describe the *ability's* interface — what it consumes and produces as a capability — **not** the steps by which it does so. The moment inputs/outputs become an ordered procedure, they have become process, which is a different layer ([capability vs process](04-capability-vs-process.md)). The meta model captures the interface; realization (process) captures the steps, below the taxonomy floor ([capability boundaries](12-capability-boundaries.md)).

### Inputs/Outputs connect capabilities
One capability's Outputs may be another's Inputs. This is how capabilities relate at the ability level — the basis for the dependency model ([capability dependencies](19-capability-dependencies.md)). The output→input relationship is an ability-level link, not a data pipeline or a runtime flow.

### Realization-independent
Inputs and Outputs are defined without reference to who, how, or which agent. What the ability consumes and produces is a property of the ability, not of its current process or agent ([03](03-capability-vs-department.md), [05](05-capability-vs-agent.md)).

## Architecture

- **Inputs field** — the kinds of thing the ability consumes (ability-level).
- **Outputs field** — the kinds of thing the ability produces (ability-level).
- **Interface, not procedure** — inputs/outputs are the ability's boundary, never its steps.
- **Linkage** — outputs of one capability may serve as inputs of another ([dependencies](19-capability-dependencies.md)).

## Enterprise Examples

*Illustrative of the fields only — not a capability, no workflow.*

- Inputs/Outputs are the *interface* a capability declares — what it needs and what it yields as an ability. One capability's output serving as another's input illustrates ability-level linkage. This phase defines the fields; it describes no actual inputs/outputs and no procedure.

## Design Principles

- **Interface, not steps.** Inputs/outputs describe the ability's boundary, never its process.
- **Kinds of thing, ability-level.** Not per-run parameters or results.
- **Outputs↔Inputs link capabilities**, feeding the dependency model.

## Boundaries

- Defines **Inputs and Outputs fields**, not any capability.
- No workflow, data pipeline, process, agent, code, UI, prompt, or execution.

## Future Evolution

Later phases declare real inputs/outputs for real capabilities and use output→input links to build the dependency graph. When process is built, the *steps* attach below the interface — the interface fixed here stays ability-level.
