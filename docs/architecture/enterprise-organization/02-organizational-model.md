# 02 — Organizational Model

## Purpose

The Organizational Model defines the **enterprise hierarchy** — the levels of the AI-native enterprise and how they relate. It is the structural backbone of Enterprise Organization: it says what levels exist, what each is accountable for, and how they nest, without naming a single concrete department or agent.

## Architectural role

This document gives the organization its shape. The authority model ([04](04-authority-model.md)) delegates *through* these levels; coordination ([05](05-organizational-coordination.md)) keeps *these* units coherent; governance ([06](06-enterprise-governance.md)) applies across *all* of them. The model is the map the other topics operate on.

## The hierarchy (levels, not instances)

The enterprise is a hierarchy of accountability. It defines *kinds of level*, not concrete units:

- **Director** — the top of the hierarchy. Holds ultimate authority; approves, steers, and can override anything below. Not a delegated role — the source of delegation ([authority model](04-authority-model.md)).
- **Enterprise level** — the whole-organization view: where enterprise-wide responsibilities and governance sit, directly beneath the Director.
- **Department level** — a division of the enterprise by area of responsibility. The structure supports *multiple* departments; it defines the *notion* of a department, and names none.
- **Manager level** — a place within a department that coordinates responsibility below it. A defined seat for a future manager agent or a human manager; no concrete manager is defined here.
- **Specialist level** — a place that carries out a focused responsibility within a department. A defined seat for a future specialist agent or a human specialist; no concrete specialist is defined here.

Each level is **accountable to the level above** and ultimately to the Director. Responsibility nests; authority delegates downward; accountability reports upward.

## Participants the model admits (without defining)

The same seat can be held by different kinds of participant:

- **Departments** — many, by area of responsibility.
- **Future manager agents** — at the manager level.
- **Future specialist agents** — at the specialist level.
- **Humans** — at any level, including alongside agents.

The model defines the *seats*; it never defines who fills them. That is a later phase behind the Director gate.

## Inputs

- The **organization principles** ([01](01-organization-principles.md)) — the constitution the model must satisfy.
- **Director Authority** — the apex the hierarchy hangs from.

## Outputs

- A **defined enterprise hierarchy** — levels, their accountability, and how they nest — that authority, coordination, and governance all build on.

## Boundaries

- Defines **no concrete department** — only the notion of a department.
- Defines **no concrete agent** — only the seats agents may later fill.
- Defines **no workflow, runtime, or mechanism** — only the structure of accountability.
- Performs **no reasoning and no work** — it is a map, not an actor.

## Future direction

Future enterprises populate this hierarchy — concrete departments, manager agents, specialist agents, human roles — each added into a defined seat without reshaping the model. The set of levels may deepen over time ([future evolution](07-future-evolution.md)), but every addition remains accountable upward to the Director. The population grows; the shape holds.
