# 05 — Workflow Boundaries

## Purpose

Prevent Workflow progression from absorbing execution, planning, scheduling, orchestration, Governance, or implementation.

## Required Separations

- Workflow ≠ Workflow Engine
- Workflow ≠ Runtime
- Workflow ≠ Execution
- Workflow ≠ Planning
- Workflow ≠ Scheduling
- Workflow ≠ Orchestration
- Workflow ≠ State
- Workflow ≠ Event
- Progression ≠ Permission
- Progression order ≠ temporal schedule
- Completion ≠ business acceptance

## Boundary Responsibilities

Workflow owns progression meaning and evidence relationships. Runtime owns admitted operational realization. State owns current-condition meaning. Event owns immutable fact meaning. Governance owns eligibility constraints. The Director owns final authority.

## Prohibited Interpretations

A Workflow definition cannot be treated as a task list, executable graph, command sequence, retry policy, timer, resource allocation, Agent assignment, message route, or implementation contract.

## Rules

- **P22-WORKFLOW-BOUNDARY-001:** Workflow must not initiate or perform execution.
- **P22-WORKFLOW-BOUNDARY-002:** Workflow ordering must not allocate time or resources.
- **P22-WORKFLOW-BOUNDARY-003:** Workflow must not create Agent assignments or orchestration instructions.
- **P22-WORKFLOW-BOUNDARY-004:** Workflow must not replace Governance or Director decisions.
- **P22-WORKFLOW-BOUNDARY-005:** Workflow evidence must remain distinct from Enterprise Memory admission.
- **P22-WORKFLOW-BOUNDARY-006:** Technology behavior must not define constitutional progression.

## Enterprise Example

A progression relationship may require review evidence before closure. It does not invoke a reviewer, send a message, or set a deadline.
