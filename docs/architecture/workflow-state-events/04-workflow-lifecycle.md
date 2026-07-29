# 04 — Workflow Lifecycle

## Purpose

Define constitutional Workflow lifecycle meanings without creating a workflow engine or state machine.

## Lifecycle Meanings

- **Defined:** identity, responsibility, Scope, and permitted progression meanings are declared.
- **Admitted:** the Workflow is bound to a valid Runtime admission.
- **Active:** admitted responsibility is operationally progressing.
- **Constrained:** progression is limited by an explicit condition.
- **Blocked:** progression cannot continue within current boundaries.
- **Suspended:** continuation is temporarily prohibited.
- **Divergent:** evidence shows material departure from admitted meaning.
- **Terminated:** progression ends without the expected terminal outcome.
- **Completed:** declared terminal meaning has evidence.
- **Closed:** evidence and accountability obligations are satisfied.

These are constitutional meanings, not implemented states, transitions, commands, jobs, events, or timers.

## Rules

- **P22-WORKFLOW-LIFECYCLE-001:** Lifecycle meaning must be evidence-supported and attributable.
- **P22-WORKFLOW-LIFECYCLE-002:** Admitted must remain distinct from authorized execution creation.
- **P22-WORKFLOW-LIFECYCLE-003:** Completed must not imply business acceptance or Director approval.
- **P22-WORKFLOW-LIFECYCLE-004:** Blocked or divergent status must not authorize improvisation.
- **P22-WORKFLOW-LIFECYCLE-005:** Prior lifecycle meaning must remain historically traceable.
- **P22-WORKFLOW-LIFECYCLE-006:** Lifecycle semantics must not be interpreted as an engine or state-machine design.

## Enterprise Example

A Workflow may be blocked by missing authorized evidence. The representation exposes the block; it does not retrieve new evidence or redesign the approved responsibility.
