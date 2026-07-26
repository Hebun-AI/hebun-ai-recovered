# 05 — Department Coordination

## Purpose

Department Coordination defines **how departments collaborate** while each stays a bounded owner of its own domain. It is the structural answer to a multi-department enterprise: departments whose domains touch must stay aligned without any department reaching into another's domain or authority.

## Architectural role

Where the department model ([02](02-department-model.md)) defines a single unit and boundaries ([04](04-department-boundaries.md)) fence it, coordination defines *how two or more departments relate*. It is the departmental view of the enterprise's coordination structure ([enterprise organizational coordination](../enterprise-organization/05-organizational-coordination.md)) — coordination among domain owners, not among running work.

## The model

### Departments collaborate through the hierarchy
Departments coordinate through the levels that hold authority over them — ultimately the enterprise level and the Director ([enterprise authority model](../enterprise-organization/04-authority-model.md)). A department never opens a side-channel that bypasses delegated authority to reach another department.

### Domain boundaries are preserved in collaboration
When two departments collaborate on an outcome that spans their domains, each retains exclusive ownership of its own domain's part ([department responsibilities](03-department-responsibilities.md)). Collaboration aligns the owners; it does not merge domains or transfer ownership. No department absorbs another through coordination.

### One outcome, one owning department
Where a cross-domain outcome must have a single owner, one department owns it and the others contribute within their own domains. Coordination assigns contribution; it never dissolves ownership into a committee ([department boundaries](04-department-boundaries.md)).

### Coordination is structural, not operational
Department coordination arranges *which departments collaborate, under what authority, with ownership preserved*. It does not schedule tasks, route messages, or synchronize running work — that is Execution's concern ([execution orchestration](../execution-orchestration/README.md)). The department layer defines the collaboration *structure*; execution operates within it.

### Escalation reaches the Director
Any collaboration that exceeds the delegated authority of the departments involved escalates upward, ultimately to the Director. Coordination never manufactures an authority the collaborating departments did not already hold.

## Relationship to enterprise and execution coordination

- **Enterprise coordination** ([9A](../enterprise-organization/05-organizational-coordination.md)) is the whole-organization structure; department coordination is that structure *between departments specifically*.
- **Execution coordination** ([Phase 8](../execution-orchestration/README.md)) is operational — how running work is distributed. Department coordination is structural and standing. The department frame is what execution's coordination runs inside.

## Inputs

- The **department model** ([02](02-department-model.md)) and **responsibilities** ([03](03-department-responsibilities.md)) — the units and ownership being coordinated.
- The **enterprise coordination and authority structure** ([9A](../enterprise-organization/05-organizational-coordination.md)) — the rules department collaboration follows.

## Outputs

- A **collaboration structure** — how departments relate, under what authority, with ownership preserved — that keeps a multi-department enterprise coherent.

## Boundaries

- Coordinates **departments as seats, not concrete departments** — it names none.
- Performs **no scheduling, routing, or task synchronization** — that is Execution.
- Reasons about **no work** and produces **no plan** — coordination arranges structure, nothing more.

## Future direction

As concrete departments multiply and manager and specialist agents fill their seats, collaboration scales with them — more cross-domain relationships, same rules: through the hierarchy, domain boundaries preserved, single ownership per outcome, Director reachable. The enterprise widens; departments stay distinct while working as one enterprise.
