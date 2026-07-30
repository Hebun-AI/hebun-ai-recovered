# Phase 26 — Enterprise Task & Activity Architecture

## Canonical Status

**STATUS: COMPLETE / PUBLISHED**

This document defines the canonical architectural identities of Enterprise Task and Enterprise Activity within Program IV — Enterprise Orchestration.

Phase 26 inherits the published Phase 25 definition of Enterprise Work. It defines architecture only and authorizes no implementation, Runtime execution, workflow, scheduling, assignment, delegation, Agent behavior, or later Program IV phase.

Enterprise Task and Enterprise Activity may be changed only through constitutional amendment. Neither may redefine Enterprise Work.

---

# 1. Architectural Identity

## Enterprise Task Identity

**Enterprise Task** is the canonical Work-derived architectural object through which a bounded portion of Enterprise Work becomes manageable as an intended organizational responsibility with an expected contribution.

Task exists because Enterprise Work can be too broad to govern, relate, assess, or prepare as one undifferentiated responsibility. Task gives a bounded responsibility an identity without turning that responsibility into execution.

Task identity remains stable independently from:

- the actor that may later participate;
- the capability or resource that may later support it;
- the plan, priority, schedule, or workflow that may later reference it;
- the Runtime or technology that may later represent or realize it;
- the number or disposition of associated Activities.

## Enterprise Activity Identity

**Enterprise Activity** is the canonical actor-neutral architectural object that expresses a meaningful action or contribution associated with advancing an authorized Task or Enterprise Work context.

Activity exists because organizations need to distinguish an intended manageable responsibility from the meaningful contributions associated with advancing it. Activity expresses action meaning without becoming execution, an Event, a workflow step, or a log record.

Activity identity remains stable independently from:

- the human, AI, or hybrid actor that may later participate;
- the execution mechanism;
- the temporal placement;
- the workflow or schedule that may later reference it;
- the evidence representation used to observe its contribution.

## Identity Rules

- **P26-TA-001 — Dual Primitive Identity:** Enterprise Task and Enterprise Activity are distinct canonical architectural primitives.
- **P26-TA-002 — Work-Derived Meaning:** Task and Activity must preserve their attributable Enterprise Work context.
- **P26-TA-003 — Stable Task Identity:** Actor, Activity, plan, schedule, workflow, Runtime, or technology changes must not replace Task identity.
- **P26-TA-004 — Stable Activity Identity:** Actor, temporal placement, execution, Event, workflow, Runtime, or technology changes must not replace Activity identity.
- **P26-TA-005 — Non-authority:** Neither Task nor Activity creates authority, approval, permission, or execution eligibility.

---

# 2. Purpose

Enterprise Work identifies an organizationally recognized, value-oriented responsibility. That identity is foundational but is not always sufficiently bounded for manageable organizational coordination.

Enterprise Task exists to:

- identify a manageable Work-derived responsibility;
- preserve a specific expected contribution within Work;
- make responsibility, scope, constraints, relationships, evidence, and completion semantics governable;
- provide a stable architectural reference for future planning, coordination, capability, and resource architecture.

Enterprise Activity exists to:

- express the meaning of a contribution associated with advancing authorized Task or Work context;
- preserve why an action is organizationally relevant;
- distinguish intended responsibility from meaningful contribution;
- make contribution traceable without defining operational execution.

Task and Activity must remain distinct because:

- Task represents intended responsibility and expected contribution;
- Activity represents action or contribution meaning;
- a Task may exist before any Activity is identified;
- a Task may remain valid when Activities change;
- Activity association does not prove Task completion;
- Task cannot be reduced to the sum of Activities.

## Purpose Rules

- **P26-TA-006 — Manageable Responsibility:** Task must bound a manageable portion of Work without redefining Work.
- **P26-TA-007 — Meaningful Contribution:** Activity must express organizationally relevant contribution meaning without defining execution.
- **P26-TA-008 — Distinction Preservation:** Task responsibility and Activity contribution must not collapse into one identity.

---

# 3. Canonical Definitions

## Enterprise Task

> **Enterprise Task is a uniquely identifiable, Work-derived, context-bound and governable unit of intended organizational responsibility and expected contribution that remains traceable to Enterprise Work and independent of its actors, Activities, planning, scheduling, workflow, execution, Runtime, and technical representation.**

## Enterprise Activity

> **Enterprise Activity is a uniquely identifiable, actor-neutral, context-bound and traceable expression of meaningful action or contribution associated with advancing an authorized Enterprise Task or Enterprise Work context, independent of execution, workflow position, scheduling, Events, Runtime, and technical representation.**

These are the authoritative definitions of Enterprise Task and Enterprise Activity for Hebun AI.

They are immutable except through the amendment rules of the Enterprise Constitution and Program IV Constitution. No future architecture, Runtime realization, implementation, actor model, or operating convention may silently narrow, broaden, replace, or reinterpret them.

---

# 4. Architectural Principles

## Work-Derived

Task derives organizational meaning from Enterprise Work. Activity derives organizational meaning from an authorized Task or Work context. Enterprise Work remains independently canonical.

## Context-Bound

Task and Activity must retain the organizational and Work context necessary to interpret their meaning. Context does not become identity or authority.

## Traceable

Task and Activity must remain traceable to origin, Work context, responsibility, purpose or contribution, Governance, relationships, lifecycle history, evidence, and disposition.

## Governable

Task and Activity remain subject to applicable constitutional and organizational Governance. Governance evaluates and constrains them but does not execute or become them.

## Outcome-Oriented

Task identifies an expected contribution. Activity identifies contribution meaning. Neither guarantees outcome achievement, Work completion, or organizational success.

## Action-Expressive

Activity may express what kind of meaningful contribution is relevant without specifying how an actor, tool, workflow, or Runtime performs it.

## Responsibility-Aware

Task preserves intended responsibility context. Activity preserves the responsibility context under which its contribution is meaningful. Neither assigns responsibility operationally.

## Capability-Compatible

Task and Activity may later reference applicable Capabilities without becoming Capabilities or defining capability realization.

## Observable in Principle

Task and Activity must support attributable evidence and visibility. Observation does not change them or automatically establish truth, completion, or approval.

## Actor-Neutral

Canonical meaning must remain identical whether later participation is human, AI, hybrid, organizational, or technological.

## Runtime-Independent

Runtime may later represent or realize approved Tasks and Activities but cannot define their canonical identity or lifecycle meaning.

## Implementation-Independent

Task and Activity do not depend on fields, schemas, APIs, databases, interfaces, models, vendors, infrastructure, or execution technologies.

## Evolvable

Task and Activity may evolve through attributable Governance while preserving identity, history, Work context, prior meaning, and evidence.

---

# 5. Enterprise Task Characteristics

Every Enterprise Task must possess these architectural properties:

| Characteristic | Constitutional requirement |
|---|---|
| Unique identity | The Task is distinguishable from Work, Activities, other Tasks, and adjacent concepts. |
| Work derivation | Its organizational meaning traces to one authorized Enterprise Work context. |
| Purpose | It states why the bounded responsibility exists within Work. |
| Expected contribution | It identifies the result or contribution expected from the responsibility without guaranteeing achievement. |
| Work context | It preserves the relevant Work identity, purpose, boundaries, and constraints. |
| Responsibility context | It identifies the bounded intended responsibility without assigning an actor. |
| Scope | It distinguishes included responsibility from excluded responsibility. |
| Governance applicability | It preserves applicable authority, policy, review, escalation, and constraint boundaries. |
| Relationships | It identifies relevant Work, Task, Activity, organizational, capability, resource, responsibility, and Governance relationships. |
| Completion semantics | It declares the conceptual conditions under which the intended responsibility may be judged complete. |
| Evidence | It preserves attributable support for recognition, evolution, contribution assessment, completion, and disposition. |
| Traceability | It preserves origin, versions, context, dependencies, changes, findings, and history. |
| Evolution | It may change through Governance without losing identity or superseded meaning. |
| Disposition | It preserves the governed conclusion without equating Task completion with Work completion or success. |

“Governance applicability” is not a Runtime state. “Completion semantics” is not an execution status or database field.

## Task Characteristic Rules

- **P26-TA-009 — Work Traceability:** Every Task must trace to authorized Enterprise Work.
- **P26-TA-010 — Responsibility Boundary:** Every Task must express bounded intended responsibility without operational assignment.
- **P26-TA-011 — Completion Separation:** Task completion must not imply Work completion, outcome achievement, or organizational success.
- **P26-TA-012 — Activity Independence:** Task identity and intended contribution must remain valid independently from associated Activity count or change.

---

# 6. Enterprise Activity Characteristics

Every Enterprise Activity must possess these architectural properties:

| Characteristic | Constitutional requirement |
|---|---|
| Unique identity | The Activity is distinguishable from Tasks, Work, execution, Events, logs, workflow steps, and other Activities. |
| Action meaning | It expresses the organizational meaning of a contribution without prescribing execution mechanics. |
| Authorized context | Its meaning traces to an authorized Task or Enterprise Work context. |
| Task context | When associated with a Task, it preserves that Task’s identity, responsibility, expected contribution, and constraints. |
| Work context | It always preserves the Enterprise Work context from which organizational meaning originates. |
| Contribution | It identifies how the Activity is intended to advance or inform Work without claiming completion automatically. |
| Actor neutrality | Its meaning is independent from human, AI, hybrid, organizational, or technical participation. |
| Temporal relevance | It may have a context in which timing matters without defining a schedule or temporal execution mechanism. |
| Governance applicability | It preserves applicable authority, policy, constraint, review, and evidence boundaries. |
| Evidence | It supports attributable claims about recognition, change, association, contribution, and disposition. |
| Traceability | It preserves origin, context, relationships, evolution, and history. |
| Disposition | It preserves a governed conclusion without becoming an Event, execution record, or log entry. |

## Activity Characteristic Rules

- **P26-TA-013 — Context Requirement:** Every Activity must trace to an authorized Task or Work context and always retain Enterprise Work provenance.
- **P26-TA-014 — Action–Execution Separation:** Action meaning must not be interpreted as Runtime execution.
- **P26-TA-015 — Temporal–Scheduling Separation:** Temporal relevance must not become scheduling architecture.
- **P26-TA-016 — Contribution Separation:** Activity contribution must not automatically establish Task completion, Work completion, or outcome achievement.
- **P26-TA-017 — Actor Neutrality:** Actor identity or type must not alter canonical Activity meaning.

---

# 7. Relationship to Enterprise Work

The dependency direction is constitutional:

```text
Enterprise Work
      ↓ supplies organizational meaning
Enterprise Task
      ↓ may provide authorized responsibility context
Enterprise Activity
```

Enterprise Activity may also derive its immediate context directly from authorized Enterprise Work when no Task association is constitutionally required. Direct Work context does not make Activity a Task.

Canonical dependency rules:

1. Enterprise Task derives its organizational meaning from Enterprise Work.
2. Enterprise Work does not derive its identity, existence, purpose, or lifecycle from Task.
3. Task may reference, organize, specialize, constrain, or prepare Work for future architecture but may never define or redefine Work.
4. Enterprise Activity derives organizational meaning from an authorized Task or Work context.
5. Activity may never define or redefine Task or Work.
6. Every Activity retains Enterprise Work provenance, including when associated through Task.
7. Work may exist without Tasks or Activities.
8. Task may exist without Activities.
9. Phase 25’s `P25-WORK-029 — Primitive Dependency Independence` remains binding.

## Work Dependency Rules

- **P26-TA-018 — Work Supremacy:** The published Phase 25 definition of Enterprise Work governs every Task and Activity interpretation.
- **P26-TA-019 — One-Way Derivation:** Task and Activity derive meaning from Work; Work does not derive canonical identity from either.
- **P26-TA-020 — No Silent Redefinition:** No Task or Activity property, relationship, lifecycle condition, or realization may amend Work.
- **P26-TA-021 — Independent Work Existence:** Enterprise Work may exist without Task, Activity, or any future orchestration construct.

---

# 8. Task–Activity Relationship

Task and Activity have a bounded association:

- Task represents a manageable unit of intended organizational responsibility and expected contribution.
- Activity represents a meaningful action or contribution associated with advancing organizational Work.
- A Task may be associated with zero, one, or multiple Activities.
- An Activity may be associated with a Task only within authorized Task and Work context.
- Activity is not automatically equivalent to Task completion.
- Task is not the sum of its Activities.
- Activity association, performance evidence, or disposition does not silently alter Task identity or intended contribution.
- Activities may evolve without redefining Task identity or expected contribution.
- Activity must never be treated as Runtime Execution.

The relationship is not:

- a workflow sequence;
- a schedule;
- an execution plan;
- a state machine;
- an Event stream;
- a log;
- an actor-assignment mechanism.

## Task–Activity Rules

- **P26-TA-022 — Cardinality Independence:** Task identity must support zero, one, or multiple Activity associations.
- **P26-TA-023 — Non-summation:** Task meaning and completion must not be reduced to the sum or disposition of Activities.
- **P26-TA-024 — Association Governance:** Task–Activity association must preserve Work context, responsibility, constraints, and evidence.
- **P26-TA-025 — Evolution Isolation:** Activity evolution must not redefine Task identity or expected contribution.

---

# 9. Enterprise Relationships

These relationships are conceptual. They define no assignment, delegation, approval, dispatch, access control, scheduling, workflow, or execution mechanism.

## Enterprise Work

Work supplies the organizational purpose and constitutional context from which Task and Activity derive meaning. Task and Activity remain subordinate primitives and never replace Work.

## Organization

An Organization may recognize and govern Task and Activity within accountable Work boundaries. Task and Activity are not the Organization and do not create organizational authority.

## Responsibility

Task expresses bounded intended responsibility. Activity expresses contribution meaning within authorized responsibility context. Neither assigns responsibility to an actor or transfers accountability.

## Capability

Task and Activity may reference a Capability that could later support realization. They are not Capabilities and do not define capability realization or availability.

## Resource

Task and Activity may have conceptual relationships to organizational means that could later support realization. They do not define Resources, allocation, eligibility, reservation, or consumption.

## Governance

Governance may evaluate, constrain, review, suspend eligibility, or require escalation for Task and Activity. Governance does not become Task or Activity and does not execute them.

## Human Actors

Humans may later participate under applicable authority, responsibility, privacy, trust, and approval boundaries. This architecture does not assign humans or define Human Architecture.

## AI Actors

AI actors may later participate only within applicable constitutional, Governance, capability, authority, and Runtime boundaries. Task and Activity identity remains independent from AI models or Agents.

## Hybrid Organizational Actors

Human and AI participation may later coexist without creating a new Task or Activity meaning. Hybrid participation does not merge authority, accountability, identity, or approval.

## Actor Relationship Rules

- **P26-TA-026 — Actor Independence:** Task and Activity meaning must remain stable across human, AI, hybrid, organizational, and technical participation.
- **P26-TA-027 — Participation–Assignment Separation:** Conceptual actor relationship must not be interpreted as assignment or dispatch.
- **P26-TA-028 — Accountability Preservation:** Actor participation must not silently transfer Work or Task accountability.

---

# 10. Lifecycle Semantics

Lifecycle semantics describe constitutional evolution. They are not enumerated Runtime statuses, workflow states, scheduling positions, Event processing stages, execution statuses, or database fields.

## Task Lifecycle Meaning

A Task may be:

- recognized as a candidate bounded responsibility within authorized Work;
- qualified for Work derivation, purpose, expected contribution, scope, responsibility context, constraints, and Governance;
- admitted through applicable authority as a canonical Task;
- stewarded while relationships, evidence, and context evolve;
- assessed against its expected contribution and completion semantics;
- determined complete, invalid, cancelled, superseded, or otherwise dispositioned through applicable Governance;
- closed with identity, Work provenance, evidence, relationships, and history preserved.

These are conceptual lifecycle meanings, not a state enumeration or transition model.

## Activity Lifecycle Meaning

An Activity may be:

- recognized as a meaningful contribution within authorized Task or Work context;
- qualified for action meaning, contribution, context, constraints, temporal relevance, and Governance;
- admitted as a canonical Activity;
- associated, reassociated, clarified, constrained, or superseded through attributable Governance;
- assessed for contribution evidence without becoming execution status;
- dispositioned and retained with Work provenance, context, evidence, and history.

These meanings define no execution record, Event, log, workflow step, or schedule item.

## Lifecycle Rules

- **P26-TA-029 — Conceptual Lifecycle:** Task and Activity lifecycle meaning must remain independent from Runtime state.
- **P26-TA-030 — No Automatic Transition:** Time, telemetry, actor activity, Events, or implementation state must not automatically change canonical lifecycle meaning.
- **P26-TA-031 — Evidence Preservation:** Every material lifecycle change must preserve attributable evidence and prior meaning.
- **P26-TA-032 — Authority Preservation:** Lifecycle evolution must not create authority, approval, assignment, or execution eligibility.

---

# 11. Architectural Boundaries

## Enterprise Task Is Not

- Enterprise Work;
- Enterprise Activity;
- a Project;
- a Goal;
- an Initiative;
- a Plan;
- a priority;
- a Workflow;
- a workflow step;
- a Schedule;
- an Event;
- Runtime execution;
- a Runtime object;
- an Agent;
- a Resource;
- a Capability;
- an assignment;
- a delegation;
- an approval;
- a database record;
- an API resource;
- a user-interface item.

## Enterprise Activity Is Not

- Enterprise Task;
- Enterprise Work;
- a workflow step;
- Runtime execution;
- an Event;
- a log entry;
- an Agent action invocation;
- a schedule item;
- a Project;
- a Goal;
- an Initiative;
- a Plan;
- an assignment;
- a delegation;
- an approval;
- a telemetry record;
- an API request;
- a database record.

## Mandatory Separations

- Task ≠ Work
- Task ≠ Activity
- Task ≠ Project
- Task ≠ Goal
- Task ≠ Initiative
- Task ≠ Plan
- Task ≠ Workflow
- Task ≠ Schedule
- Task ≠ Event
- Task ≠ Runtime Execution
- Task ≠ Agent
- Task ≠ Resource
- Activity ≠ Task
- Activity ≠ Work
- Activity ≠ Workflow Step
- Activity ≠ Runtime Execution
- Activity ≠ Event
- Activity ≠ Log Entry
- Activity ≠ Agent Invocation
- Activity ≠ Schedule Item

Technical representation must never become canonical Task or Activity identity.

---

# 12. Architectural Constraints

Future architecture must preserve these binding rules:

1. **P26-TA-033 — Task Cannot Redefine Work:** Task must inherit the canonical Phase 25 Work definition unchanged.
2. **P26-TA-034 — Activity Cannot Redefine Task or Work:** Activity must preserve both upstream identities and dependency direction.
3. **P26-TA-035 — Implementation Independence:** Task and Activity must remain independent from implementation, representation, technology, and infrastructure.
4. **P26-TA-036 — Actor Neutrality:** Human, AI, hybrid, organizational, or technical actors may participate without changing canonical meaning.
5. **P26-TA-037 — Runtime Subordination:** Runtime may represent or execute approved Tasks and Activities but may not define, admit, amend, complete, or close them autonomously.
6. **P26-TA-038 — Workflow Consumption:** Future Workflow architecture may consume Task and Activity primitives but must not redefine them or reduce Activity to workflow steps.
7. **P26-TA-039 — Scheduling Consumption:** Future scheduling architecture may reference temporal eligibility but must not redefine Task or Activity.
8. **P26-TA-040 — Project Boundary:** Future Project architecture may aggregate or govern Tasks and Activities without becoming their canonical identity.
9. **P26-TA-041 — Planning Boundary:** Future Planning architecture may select, prioritize, or sequence Tasks and Activities without redefining them.
10. **P26-TA-042 — Execution Boundary:** Future execution architecture must treat Task and Activity as approved architectural inputs, not execution records or commands.
11. **P26-TA-043 — Evidence Boundary:** Observation, telemetry, Events, logs, and execution evidence must not become Task or Activity truth automatically.
12. **P26-TA-044 — Authority Boundary:** Task, Activity, association, lifecycle, evidence, or completion must not create approval, permission, assignment, or authority.
13. **P26-TA-045 — Traceability Requirement:** Every future use must preserve Work provenance, identity, responsibility context, Governance, and evidence.
14. **P26-TA-046 — Constitutional Evolution:** Change to Task or Activity meaning requires governed amendment.
15. **P26-TA-047 — Fail Closed:** Ambiguous Work derivation, context, authority, identity, responsibility, or boundary blocks canonical admission or change.

These constraints govern future architecture without defining it.

---

# 13. Future Architectural Dependencies

The following later Program IV roadmap phases depend on Phase 26:

| Phase | Canonical roadmap identity | Dependency on Task and Activity |
|---:|---|---|
| 27 | Enterprise Planning & Prioritization | Must consume Task and Activity as stable primitives without redefining Work, Task, or Activity. |
| 28 | Delegation & Coordination Architecture | Must preserve Task responsibility, Activity contribution, actor neutrality, authority, and accountability boundaries. |
| 29 | Capability & Resource Management | Must preserve Task and Activity identity while defining capability and resource relationships. |

Dependency means constitutional inheritance. It does not open these phases or authorize their architecture.

**Phases 27–29 remain CLOSED.**

---

# 14. Success Criteria

Phase 26 is architecturally complete only when:

1. one authoritative Enterprise Task definition is approved;
2. one authoritative Enterprise Activity definition is approved;
3. Task and Activity have distinct identities, purposes, properties, and boundaries;
4. the Work–Task–Activity dependency direction is explicit and preserves `P25-WORK-029`;
5. Task may support zero, one, or multiple Activities without identity loss;
6. Activity association or evidence does not imply Task completion;
7. Task and Activity remain actor-neutral and implementation independent;
8. conceptual lifecycle meaning remains separate from Runtime state, workflow, scheduling, Events, and execution;
9. future Phase 27–29 dependencies match the canonical roadmap;
10. all rule identities, terminology, links, definitions, and boundaries validate;
11. no excluded architecture or implementation leaks into Phase 26;
12. Director review approves Phase 26 closure and publication.

Creation of this document does not itself close or publish Phase 26.

---

# 15. Related Canonical Documents

- [Hebun AI Enterprise Constitution](../../../00-enterprise-constitution.md) — supreme constitutional authority
- [Enterprise Master Roadmap](../../../architecture-intelligence/50-enterprise-architecture-roadmap.md) — Program IV and Phase 26 canonical identity and status
- [Program IV — Enterprise Orchestration Constitution](../constitution.md) — Program Scope, principles, dependencies, gates, and phase membership
- [Phase 25 — Enterprise Work Architecture](../phase-25-enterprise-work-architecture/architecture.md) — published Enterprise Work definition and primitive dependency invariant
- [Business Capability Architecture](../../../business-capabilities/README.md) — Capability identity and realization boundaries
- [Enterprise Organization Architecture](../../../enterprise-organization/README.md) — Organization, accountability, and responsibility boundaries
- [Enterprise Domain Collaboration](../../../enterprise-domain-collaboration/README.md) — constitutional collaboration and participation boundaries
- [Execution Runtime](../../../execution-runtime/README.md) — Runtime realization boundary
- [Workflow, State & Events](../../../workflow-state-events/README.md) — Workflow, State, Event, and operational-progression boundaries
- [Scheduling, Observability & Monitoring](../../../scheduling-observability-monitoring/README.md) — scheduling, visibility, evidence, and observation boundaries
- [Runtime Governance & Operational Resilience](../../../runtime-governance-operational-resilience/README.md) — Runtime Governance and resilience boundaries

---

# Phase Boundary Declaration

Phase 26 defines Enterprise Task and Enterprise Activity only.

It does not define Project Architecture, Goal Architecture, Initiative Architecture, Planning Architecture, Prioritization, Scheduling, Workflow Architecture, workflow steps, Runtime execution, state machines, Event models, APIs, database schemas, user interfaces, dashboard features, Agent orchestration, Agent invocation, human approval workflows, delegation mechanisms, resource allocation, Security, Identity and access control, or observability implementation.

No Phase beyond Phase 26 is opened by this document.

**PHASE 26 STATUS: COMPLETE / PUBLISHED**

**PHASES 27–29: CLOSED**
