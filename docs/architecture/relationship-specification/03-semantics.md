# 03 — Semantics

The business meaning of the core relationships, and — more importantly — the distinctions between the ones that look similar. Precise semantics prevent the vocabulary from blurring: `owns` is not `contains`, `manages` is not `governs`. This document draws those lines.

## The relationships, in business terms

### owns
Authoritative accountability for an ability or duty. The owner is the single party answerable for a capability or responsibility — its scope, its use, its retirement. Ownership is singular and mandatory where required. **"Who is answerable for this?"**

### contains
Structural enclosure. The container physically holds the contained node in the org structure. It says *where a node sits*, not *who is accountable for it*. **"What is this inside of?"**

### belongs_to
The mirror of containment, framed from the member's side — the scope a node lives within. Same fact as `contains`, opposite direction, stored once. **"What scope does this fall under?"**

### reports_to
An accountability line, directed upward. It expresses hierarchy of answerability between units or roles, independent of structural containment — a role may report to a superior in a different unit. **"Who does this answer to?"**

### supports
Non-owning enablement. A supporter backs a capability or unit without being accountable for it. An agent that supports a capability helps deliver it but does not own it. **"What backs this without owning it?"**

### depends_on
Functional necessity. The source cannot operate without the target. Dependency is about capability wiring, not accountability — and it is acyclic. **"What does this need to function?"**

### manages
Operational supervision. A manager directs the day-to-day operation of a unit or role. Management is authority over *operation*, not ownership of an *asset* and not a governing *rule*. **"Who runs this?"**

### governs
Constraint authority. A governing node imposes rules — limits, restrictions, policies — on what the governed node may do. Governance bounds behavior; it does not run operations. **"What rules bind this?"**

### uses
Operational consumption. The source consumes a tool or capability while operating, expressed as a declarative reference. It records *what is drawn upon*, not a runtime invocation. **"What does this draw upon?"**

### provides
Operational furnishing — the complement of `uses`. The source makes a capability or service available to a consumer. **"What does this make available to others?"**

### plays
Occupancy of a function. An actor fills a role for a period. The actor is not the role and does not own it; occupancy is temporal and may change. **"What function does this actor fill?"**

### assigned_to
Placement of a duty. A responsibility is assigned onto a role or actor, making them accountable for carrying it. Assignment connects a *duty* to *who must do it*. **"Who carries this duty?"**

## Distinctions that matter

### owns vs contains vs belongs_to
- **owns** — accountability for an asset (Capability, Responsibility). Singular.
- **contains** — structural enclosure of a node (units, roles). Structural, not accountability.
- **belongs_to** — the same enclosure, read from the member's side.

An Organization `owns` a Capability (accountable for it) and `contains` a Department (structurally holds it). These are different facts about different target kinds; neither substitutes for the other.

### manages vs governs vs owns
- **owns** — is answerable for the thing.
- **manages** — runs the thing's operation.
- **governs** — constrains what the thing may do.

A department can be owned (accountability), managed (a head runs it), and governed (a policy limits it) simultaneously — three distinct relationships, three distinct parties.

### supports vs provides vs depends_on
- **supports** — backs something without owning it (helper).
- **provides** — makes something available to a consumer (supplier).
- **depends_on** — cannot function without something (needer).

If A `depends_on` B, then B is necessary to A. If A `supports` B, A helps B but B can exist without A. If A `provides` X to B, A is the source of X for B. Necessity, enablement, and provision are three different strengths of relationship.

### reports_to vs manages
- **reports_to** — the subordinate's upward accountability line.
- **manages** — the superior's operational authority.

They often mirror each other but are stored as distinct, directed facts and need not always pair — a matrixed role may report to one superior while being operationally managed within a unit. Storing both explicitly keeps the two facts independent and non-contradictory.

### plays vs assigned_to vs has_capability
- **plays** — an actor fills a *role*.
- **assigned_to** — a *responsibility* is placed on a role or actor.
- **has_capability** — an actor or role possesses an *ability*.

A person `plays` the Finance Director role; the "Approve budgets" responsibility is `assigned_to` that role; the role `has_capability` "Approve Purchase". Function, duty, and ability are three separate axes meeting at the same actor.
