# 05 — Impact Analysis

## What impact analysis is

Impact analysis answers a single question in many forms: **if this changes, what else is affected?** It is the graph's core reasoning value. Because relationships are explicit and directed, the set of affected nodes is a traversal from the change point, not a guess.

Two complementary directions:

- **Forward (dependency).** What does this node rely on? Follow `depends_on`, `uses`, `supports` outward.
- **Reverse (impact).** What relies on this node? Follow the same edges inward — every node whose function assumes this one.

Impact analysis is reverse traversal from a change point, bounded by the workspace, surfacing the downstream set. It is read-only: it reports consequences, it never applies them.

## Change scenarios

### Department removed

**Change.** An OrganizationalUnit is retired.

**Downstream analysis.**
- Reverse `contains` / `member_of`: actors and child units left without a parent — orphaned participants.
- Reverse `has_capability` through the unit's roles: capabilities that lose their organizational home.
- Reverse `reports_to`: units and roles whose reporting line is severed.
- Reverse `supports`: agents whose supported unit no longer exists.

**Result.** A reassignment worklist — every actor, role, and capability needing a new home before the unit can be safely retired.

### Capability changed

**Change.** A Capability is modified or deprecated.

**Downstream analysis.**
- Reverse `depends_on`: capabilities that require this one — the transitive dependent set.
- Reverse `has_capability`: roles and actors that claim it.
- Reverse `supports`: agents backing it, now potentially mis-scoped.

**Result.** The blast radius of the change — every dependent capability and every role/agent whose stated ability is now inaccurate.

### Agent unavailable

**Change.** An AIAgent goes offline or is retired.

**Downstream analysis.**
- Forward `supports`: capabilities and units that lose support.
- Reverse `depends_on`: agents that depend on this agent.
- Forward `plays`: roles the agent filled, now vacant.

**Result.** A coverage gap report — which capabilities are unsupported and which roles are unfilled until the agent is restored or replaced.

### Policy updated

**Change.** A governing Policy is revised (future node).

**Downstream analysis.**
- Forward `governs`: every node the policy constrains.
- For each governed node, forward `uses` / `depends_on`: downstream nodes indirectly affected by the tightened or relaxed constraint.

**Result.** The compliance surface of the change — every capability, tool, and agent whose permitted behavior shifts.

### Executive replaced

**Change.** A Person filling a senior Role is replaced.

**Downstream analysis.**
- Forward `plays`: the Role vacated.
- From that Role, forward `responsible_for` and `manages`: responsibilities and units left without accountable leadership.
- Reverse `reports_to`: subordinate roles and units whose reporting line now points at a vacancy.

**Result.** A handover map — the responsibilities, managed units, and reporting relationships that must transfer to the successor.

## Why the graph makes this reliable

Each scenario is the same operation with a different start node and edge filter. Because ownership is single-sourced and relationships are explicit, the affected set is **complete and consistent** — nothing is missed because a relationship was recorded in only one of two places, and nothing is double-counted.

Impact analysis is a **reasoning capability over the graph**, consumed by higher layers — Director reasoning, [Organizational Simulation](../../architecture-backlog/16-organizational-simulation.md), the [Learning Engine](../../architecture-backlog/19-learning-engine.md). Those layers act on the analysis; the graph only reports it. The analysis itself performs no mutation and triggers no action.
