# 02 — Human Role Model

## Purpose

The Human Role Model defines **how a human occupies an organizational seat** — and establishes that the seat is defined independently of occupant type. It is the structural heart of Human Organization: a seat is a seat, whether a human or an AI fills it. This document says what "a human in a seat" means, without naming a single concrete role or job title.

## Architectural role

This document connects humans to the existing seats. The human authority ([03](03-human-authority.md)), collaboration ([04](04-human-ai-collaboration.md)), accountability ([05](05-accountability-model.md)), and governance ([06](06-human-governance.md)) topics all build on this: they describe how a human occupant is authorized, collaborates, is accountable, and is governed — always as the seat prescribes.

## The model

### The seat is occupant-agnostic
An organizational seat — manager, specialist, or any level the hierarchy defines ([enterprise organizational model](../enterprise-organization/02-organizational-model.md)) — is defined by its **authority, ownership, accountability, and governance**, never by who fills it. The seat exists and means the same thing whether its occupant is a human, an AI, or (over time) a different occupant. Occupant type is orthogonal to the seat.

### A human is an occupant, nothing more or less
A human participates by **occupying a seat**. In doing so, the human takes on exactly the seat's authority, ownership, accountability, and governance duties ([human participation principles](01-human-participation-principles.md)). A human occupant is not a special kind of seat; it is an ordinary occupant of an ordinary seat.

### Humans may occupy any seat
The model places no ceiling on which seats humans may hold ([enterprise organizational model](../enterprise-organization/02-organizational-model.md)): a human may be a manager governing a department, a specialist owning a capability, or hold an enterprise-level seat. The Director remains the apex; humans occupy seats *beneath* the Director like any occupant.

### Occupancy carries the seat's full obligations
Occupying a seat is not selective. A human manager takes the manager seat's *entire* constitution — delegated authority, oversight, reporting, escalation, governance ([Manager Architecture](../manager-architecture/README.md)). A human specialist takes the specialist seat's *entire* constitution ([Specialist Architecture](../specialist-architecture/README.md)). A human cannot occupy a seat while declining its obligations.

### One seat, one occupant of record
A seat has a single accountable occupant at a time, so accountability stays unambiguous ([accountability model](05-accountability-model.md)). Whether that occupant is human or AI, the seat's line of accountability upward is single and clear. (How occupancy is assigned or changed operationally is out of scope — that is runtime, not architecture.)

### Mixed occupancy is ordinary
Because the seat is occupant-agnostic, a department may have a human manager and AI specialists, an AI manager and human specialists, or any mix ([human–AI collaboration](04-human-ai-collaboration.md)). No mix is special-cased; all are ordinary uses of the one structure.

## Inputs

- The **human participation principles** ([01](01-human-participation-principles.md)) — the constitution the model must satisfy.
- The **existing seats** ([9A](../enterprise-organization/02-organizational-model.md), [9C](../manager-architecture/README.md), [9D](../specialist-architecture/README.md)) — what humans occupy.

## Outputs

- A **defined occupancy model** — the seat is occupant-agnostic; a human occupant carries the seat's full obligations — that authority, collaboration, accountability, and governance build on.

## Boundaries

- Defines **no concrete human role or job title** — only what occupying a seat means.
- Defines **no authentication, permission, assignment mechanism, or UI** — occupancy assignment is runtime, out of scope.
- Performs **no reasoning or work** — it is a model of occupancy, not an actor.

## Future direction

As hybrid organizations form, humans occupy seats throughout the hierarchy alongside AI occupants, each carrying the seat's full obligations. Which seats exist may deepen over time ([future evolution](07-future-evolution.md)), but the rule holds: the seat is occupant-agnostic, and a human is an ordinary occupant of it. Occupants vary; the seat holds.
