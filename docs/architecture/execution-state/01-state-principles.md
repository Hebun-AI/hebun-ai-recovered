# 01 — State Principles

## Purpose

The State Principles are the constitution of Execution State & Context — the commitments the continuity layer must obey. They are what make execution state a *trustworthy record of where an execution stands*, safe to pause, resume, checkpoint, and recover from. Any state handling that violates one of these is not valid Execution State.

## Architectural role

These principles constrain all the state topics that follow (lifecycle, context model, checkpoint/recovery, transitions, traceability). Every subsequent document inherits them first. They keep state and context passive, faithful, isolated, and subordinate to the Director — a substrate execution runs on, never an actor of its own.

## The principles

### 1. State faithfully represents the execution
Execution state accurately reflects where the execution actually stands — what has been done, what is running, what remains. It never misrepresents progress or claims a state that did not occur. A faithful state is the precondition for safe resume and recovery.

### 2. State is passive — it never acts
State and context are represented and carried; they form no judgment and take no action. State does not reason, decide, or execute. It is what an execution *is and carries*, held by the layers above, not an agent ([README](README.md)).

### 3. State preserves continuity
State is what lets an execution survive across time and interruption — paused and resumed, checkpointed and recovered, without loss or corruption ([checkpoint & recovery](04-checkpoint-recovery.md)). Continuity is state's central purpose.

### 4. Context integrity is preserved
The context an execution carries — task, scope, approval, history, correlation — stays correct and intact across the whole execution, including across interruption and resume ([context model](03-context-model.md)). A resumed execution runs in the same frame it was paused in.

### 5. Approval context is carried, never overridden
The Director's approval travels with the execution as part of its context. State and context preserve that approval faithfully; they never weaken, drop, or manufacture it ([Director Authority](../director-reasoning/05-director-authority.md)). Resuming or recovering an execution never resumes it beyond what was approved.

### 6. Independent executions are isolated
Separate executions do not bleed into one another. Each has its own state and context; correlation connects the parts of *one* execution, isolation keeps *different* executions apart ([context model](03-context-model.md)). Isolation inherits the workspace boundary — state never crosses tenants.

### 7. State never redesigns the plan
State records and carries execution; it never changes the plan. A recovered or resumed execution runs the *same approved plan* from where it left off; state does not alter what is to be done. Re-planning is upstream ([planning](../director-planning/README.md)), never a state operation.

### 8. State preserves traceability
The execution's history — its states, transitions, checkpoints, and recoveries — is retained and auditable ([traceability & context](06-traceability-context.md)). State is the backbone of the execution's accountability across time.

## Inputs

- The **execution's actual condition** — what agents and tools have done, are doing, and will do.
- The **context** the execution carries — task, scope, approval, history, correlation.

## Outputs

- A **principled frame** every state and context activity operates within — the standard the continuity layer is held to.

## Boundaries

- These principles **define no method** — they state what state must obey, not how it is represented, stored, or moved.
- They **describe no storage, database, serialization, or runtime** — state machinery is a later phase behind the Director gate.

## Future direction

Future state handling may preserve continuity more capably — finer checkpoints, faster recovery, richer context. The principles are fixed: faithful, passive, continuous, context-integral, approval-carrying, isolated, non-redesigning, traceable. Capability grows; the constitution holds.
