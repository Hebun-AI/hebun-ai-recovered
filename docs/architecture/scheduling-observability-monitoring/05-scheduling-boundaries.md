# 05 — Scheduling Boundaries

## Purpose

Prevent Scheduling from absorbing execution, Workflow progression, planning, authority, resource allocation, or implementation.

## Required Separations

- Scheduling ≠ Execution
- Scheduling ≠ Workflow Progression
- Scheduling ≠ Planning
- Scheduling ≠ Runtime admission
- Scheduling eligibility ≠ Authorization
- Scheduling priority ≠ Director priority decision
- Temporal condition ≠ command
- Eligible ≠ started

## Boundary Responsibilities

Scheduling owns eligibility determination. Phase 21 owns admitted Runtime responsibility. Phase 22 owns Workflow progression, State, and Events. Governance owns applicable eligibility constraints. The Director retains final authority.

## Prohibited Interpretations

A Schedule cannot be treated as an executable job, queue entry, timer configuration, resource allocation, Agent assignment, workflow transition, event trigger, or approval.

## Rules

- **P23-SCHEDULING-BOUNDARY-001:** Scheduling must never perform or initiate execution.
- **P23-SCHEDULING-BOUNDARY-002:** Scheduling must not alter Workflow progression or State.
- **P23-SCHEDULING-BOUNDARY-003:** Scheduling must not create Events as commands.
- **P23-SCHEDULING-BOUNDARY-004:** Scheduling must not allocate Agents, tools, or infrastructure.
- **P23-SCHEDULING-BOUNDARY-005:** Scheduling must not override Governance or Director authority.
- **P23-SCHEDULING-BOUNDARY-006:** Implementation mechanisms remain outside Phase 23.

## Enterprise Example

A Scheduling determination may show “eligible.” Only a separately valid Runtime boundary may perform admitted work.
