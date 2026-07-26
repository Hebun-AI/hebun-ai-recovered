# 05 — Organizational Coordination

## Purpose

Organizational Coordination defines **how the units of the enterprise stay coherent** — how responsibilities that span levels or departments are kept aligned without any unit reaching outside its authority. It is the structural answer to a multi-department, multi-agent enterprise: coordination that preserves the hierarchy rather than short-circuiting it.

## Architectural role

Where the organizational model ([02](02-organizational-model.md)) defines the levels and the authority model ([04](04-authority-model.md)) defines who may do what, coordination defines *how those units relate in motion* — how work that touches more than one unit stays consistent. It coordinates structure; it never performs or reasons about the work being coordinated.

## The model

### Coordination follows the hierarchy
Units coordinate through the structure, not around it. A department coordinates with another through the levels that hold authority over both — ultimately the enterprise level and the Director. Coordination never creates a side-channel that bypasses delegated authority ([authority model](04-authority-model.md)).

### Responsibility stays owned during coordination
When several units contribute to one outcome, one level still **owns** that outcome. Coordination aligns contributors; it does not dissolve ownership into a committee. Accountability remains a single, traceable line ([organizational model](02-organizational-model.md)).

### Coordination is structural, not operational
Coordination arranges *who works with whom, under what authority, accountable to whom*. It does not schedule tasks, route messages, or synchronize running work — that is Execution's concern ([execution orchestration](../execution-orchestration/README.md)). The organization defines the coordination *structure*; execution operates within it.

### Cross-department coordination preserves boundaries
Departments remain distinct areas of responsibility. Coordination between them respects each department's boundary and authority; no department absorbs another's responsibility through coordination. The structure supports many departments precisely because coordination keeps them coherent without merging them.

### Director oversight is always reachable
Any coordination that exceeds the delegated authority of the units involved escalates upward, ultimately to the Director. Coordination never manufactures an authority the participating units did not already hold.

## Relationship to Execution's coordination

Enterprise Organization defines *organizational* coordination — the standing structure of how units relate. Execution defines *operational* coordination — how running work is distributed and synchronized ([execution orchestration](../execution-orchestration/README.md)). The first is stable and structural; the second is transient and operational. The organization's coordination is the frame execution's coordination runs inside.

## Inputs

- The **organizational model** ([02](02-organizational-model.md)) — the units to coordinate.
- The **authority model** ([04](04-authority-model.md)) — the bounds coordination respects.

## Outputs

- A **coordination structure** — how units relate, under what authority, with ownership preserved — that keeps a multi-unit enterprise coherent.

## Boundaries

- Coordinates **seats, not concrete participants** — it names no department, agent, or human.
- Performs **no scheduling, routing, or task synchronization** — that is Execution.
- Reasons about **no work** and produces **no plan** — coordination arranges structure, nothing more.

## Future direction

As departments multiply and manager and specialist agents fill their seats, coordination scales with them — more relationships, same rules: through the hierarchy, ownership preserved, boundaries respected, Director reachable. The enterprise widens; coordination keeps it one enterprise.
