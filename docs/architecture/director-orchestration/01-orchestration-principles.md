# 01 — Orchestration Principles

## Purpose

The Orchestration Principles are the constitution of Director Orchestration — the commitments the coordinating layer must obey. Where the component principles govern *doing* each job, these govern *coordinating* the jobs. Any orchestration that violates one of these is not doing Director Orchestration.

## Architectural role

These principles constrain all the orchestration topics that follow (phase coordination, information flow, feedback loops, governance control, validation). Every subsequent document inherits them first. They keep orchestration a faithful coordinator — ordering and connecting without ever taking over.

## The principles

### 1. Orchestration coordinates; it never does the components' work
Orchestration sequences and connects Reasoning, Planning, Decision, and Verification. It forms no judgment, builds no plan, makes no decision, renders no verdict. The moment orchestration did a component's job, it would stop being a coordinator and start being an authority over the components ([README](README.md)).

### 2. Ordered progression is preserved
The components run in their proper order — reasoning before planning, planning before decision, decision before verification. Orchestration never skips a component or reorders the workflow to shortcut it. The order is the architecture; orchestration enforces it ([phase coordination](02-phase-coordination.md)).

### 3. Responsibilities are never modified
Orchestration coordinates the components; it never changes what each is responsible for. It does not move planning's job into decision, or verification's into orchestration itself. Each layer keeps its charter; orchestration keeps the layers in order.

### 4. Information flows faithfully
Orchestration passes each component's output to the next intact — it routes information; it does not alter, filter to mislead, or fabricate it ([information flow](03-information-flow.md)). A coordinator that tampered with what it carried would corrupt the whole workflow.

### 5. Feedback returns to the responsible component
When verification finds a flaw, orchestration routes the finding back to the component responsible for it — not forward, and not resolved by orchestration itself ([feedback loops](04-feedback-loops.md)). Orchestration directs the correction; the responsible component performs it.

### 6. Governance and authority are enforced across the workflow
Orchestration upholds the Director Gates throughout — it never lets a committing action proceed without the Director's explicit approval, and it never bypasses governance ([governance control](05-governance-control.md), [Director Authority](../director-reasoning/05-director-authority.md)). Coordinating the workflow includes guarding its gates.

### 7. The workflow is fully traceable
Every step orchestration coordinates is recorded — what ran, in what order, with what inputs and outputs, and every feedback loop taken. The whole workflow can be audited end to end. Traceability is not optional; it is how the Director and verification can trust the process ([orchestration validation](06-orchestration-validation.md)).

### 8. Orchestration never executes
Orchestration coordinates the reasoning workflow up to a readiness verdict and the Director's approval; it takes no action in the world. This is what makes coordinating freely safe — moving information between advisory layers commits nothing.

## Inputs

- The **component layers** to be coordinated and their defined responsibilities.
- The **governance context** and the **Director Gates** to be enforced.

## Outputs

- A **principled frame** every orchestration activity operates within — the standard the coordination is held to.

## Boundaries

- These principles **define no method** — they state what orchestration must obey, not how coordination is performed.
- They **authorize no action** — a coordinated workflow still ends in the Director's decision, and committing actions stay gated.

## Future direction

Future orchestration engines may coordinate more capably — sequencing more flexibly, routing feedback more precisely, tracing more richly. The principles are fixed: coordinate not do, preserve order and responsibilities, flow information faithfully, route feedback correctly, enforce gates, stay traceable, never execute. Capability grows; the constitution holds.
