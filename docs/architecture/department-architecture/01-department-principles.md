# 01 — Department Principles

## Purpose

The Department Principles are the constitution of a department — the commitments any department must obey. A department is the enterprise's permanent unit of domain ownership; these principles are what keep that ownership bounded, accountable, and always subordinate to the enterprise and the Director. Any department that violates one of these is not doing Department Architecture.

## Architectural role

These principles constrain all the department topics that follow (model, responsibilities, boundaries, coordination, governance). Every subsequent document inherits them first. They keep a department structural, domain-bounded, authority-preserving, governed, and traceable.

## The principles

### 1. A department owns a domain; it does not think or act
A department owns and is accountable for one business domain. It performs no reasoning ([Director Intelligence](../director-reasoning/README.md)) and no work ([Execution](../director-execution/README.md)). It is a standing unit of responsibility — never a participant in reasoning or execution.

### 2. A department's authority is delegated and revocable
A department holds only the authority delegated to it from above, and that delegation is always revocable ([enterprise authority model](../enterprise-organization/04-authority-model.md)). A department never originates authority and never exceeds its grant. Director Authority sits above every department.

### 3. A department owns exactly one domain, bounded
Each department is responsible for a defined business domain and only that domain. Its ownership does not spill into another department's domain, and no domain is owned by two departments. Boundaries are structural, not negotiated at runtime ([department boundaries](04-department-boundaries.md)).

### 4. Accountability runs upward
A department answers to the level above it and ultimately to the Director. Its ownership is accountable — there is no ownership without a line of accountability upward ([department responsibilities](03-department-responsibilities.md)).

### 5. A department is a seat for occupants it does not define
A department provides defined places for future manager agents, future specialist agents, and human participants. It defines the domain, ownership, and authority boundary of those seats — never the concrete occupants ([department model](02-department-model.md)).

### 6. Departments collaborate through the structure
A department works with other departments through the hierarchy, respecting each department's boundary and authority ([department coordination](05-department-coordination.md)). Collaboration never becomes a side-channel that bypasses delegated authority.

### 7. A department is governed and traceable
Every department falls under the enterprise-wide governance regime, and its ownership, authority, and accountability can be reconstructed and audited ([department governance](06-department-governance.md)). No department is outside governance; none is exempt from traceability.

### 8. A department never redesigns plans or decisions
When its domain needs a plan or a decision, a department routes it to Director Intelligence; it produces neither and alters neither. A department frames *which domain owns the outcome* — never the plan or the decision itself ([department boundaries](04-department-boundaries.md)).

## Inputs

- The **Enterprise Organization architecture** ([Phase 9A](../enterprise-organization/README.md)) — the hierarchy and authority a department lives within.
- **Delegated authority** — the bounded, revocable grant a department holds.

## Outputs

- A **principled frame** every department topic operates within — the standard any department is held to.

## Boundaries

- These principles **define no concrete department, agent, or workflow** — they state what a department must obey, not what it contains.
- They **describe no runtime or mechanism** — departmental machinery is a later phase behind the Director gate.

## Future direction

Future concrete departments — each owning a real business domain, each populated with manager and specialist agents and humans — will still obey these principles: domain-owning not acting, delegated authority, single bounded domain, accountable upward, seat for occupants, collaborating through structure, governed, traceable, never re-planning. Departments become real; the constitution holds.
