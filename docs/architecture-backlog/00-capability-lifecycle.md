# Hebun AI Capability Lifecycle

## Purpose

Defines how every new capability evolves from an idea into a production component, and how it is maintained afterward.

This lifecycle is **mandatory for every future capability**. No capability enters the codebase by any other path. Each stage has explicit entry and exit criteria; a capability advances only when the prior stage's exit criteria are met.

## Lifecycle

```
Idea
  ↓
Architecture Backlog
  ↓
Director Review
  ↓
Architecture Design
  ↓
Canonical Contracts
  ↓
Runtime Implementation
  ↓
UI / API Integration
  ↓
Verification
  ↓
Director Approval
  ↓
Commit / Tag / Release
  ↓
Production
  ↓
Maintenance & Evolution
```

---

## Stages

### 1. Idea

**Purpose.** Capture a candidate capability before it is shaped or committed to.

**Entry criteria.** A capability need is identified — from strategy, research, or operations.

**Exit criteria.** The idea is articulated clearly enough to be recorded: what it is, why it matters.

**Deliverables.** A short written statement of the capability and its rationale.

**Typical activities.** Framing the need; noting constraints; identifying rough dependencies.

**Required approval.** None. Ideas are free.

### 2. Architecture Backlog

**Purpose.** Record the capability as identified but intentionally postponed.

**Entry criteria.** The idea has a clear purpose and a plausible place in the architecture.

**Exit criteria.** A backlog document exists with purpose, dependencies, and promotion criteria. Status is `Planned`.

**Deliverables.** A numbered capability document under `docs/architecture-backlog/`.

**Typical activities.** Writing the capability doc; linking dependencies; setting priority.

**Required approval.** None. Listing is documentation, not authorization.

### 3. Director Review

**Purpose.** Decide whether a backlog item is promoted toward implementation.

**Entry criteria.** The item's dependencies are ready and a roadmap slot is available.

**Exit criteria.** Explicit Director decision — promote or hold. Promotion is per item.

**Deliverables.** A recorded decision. On promotion, a roadmap placement.

**Typical activities.** Reviewing readiness, sequencing, and boundaries against current priorities.

**Required approval.** **Director.** This is the gate that authorizes work to begin.

### 4. Architecture Design

**Purpose.** Define how the capability is built before any code exists.

**Entry criteria.** The item is promoted and has a roadmap slot.

**Exit criteria.** A design is written and passes architectural review: boundaries, dependency direction, and data model are explicit and one-directional (no reverse dependency into the Director core).

**Deliverables.** An architecture design document; defined module boundaries and dependency edges.

**Typical activities.** Boundary definition; dependency mapping; interface sketching; architectural review.

**Required approval.** Architectural review must pass. This precedes any code review.

### 5. Canonical Contracts

**Purpose.** Establish the pure, declarative domain contracts the capability depends on.

**Entry criteria.** Architecture design approved.

**Exit criteria.** Contracts are implemented, immutable, infrastructure-free, and covered by contract and mutation tests. Contracts are completed **before** runtime work begins.

**Deliverables.** Canonical contract modules; contract tests; mutation tests; dependency-boundary tests.

**Typical activities.** Writing `create`/`validate` pairs; enforcing immutability and inertness; proving isolation from runtime, UI, and infrastructure.

**Required approval.** Contract and boundary tests green; architectural boundary intact.

### 6. Runtime Implementation

**Purpose.** Implement the executable behavior over the canonical contracts.

**Entry criteria.** Canonical contracts complete and stable.

**Exit criteria.** Runtime behavior implemented and covered by tests; runtime is completed **before** UI work begins.

**Deliverables.** Runtime modules; runtime and regression tests.

**Typical activities.** Building execution logic; wiring to the provider/adapter layers; runtime testing.

**Required approval.** Runtime and regression tests green.

### 7. UI / API Integration

**Purpose.** Expose the capability through the interface layer.

**Entry criteria.** Runtime complete and stable.

**Exit criteria.** UI and/or API surfaces integrated; presentation depends on runtime, never the reverse.

**Deliverables.** UI components and/or API endpoints; integration tests.

**Typical activities.** Building presentation surfaces; wiring to runtime; integration testing.

**Required approval.** Integration tests green; presentation boundary intact.

### 8. Verification

**Purpose.** Prove the full capability meets its requirements.

**Entry criteria.** Implementation across contracts, runtime, and interface complete.

**Exit criteria.** Full test suite, type checks, lint, build, and mutation verification all pass. Every prior phase already ended with its own verification; this is the whole-capability gate.

**Deliverables.** A verification report with concrete results.

**Typical activities.** Running the full suite; mutation verification; build validation; dashboard checks.

**Required approval.** All checks green, reported with evidence.

### 9. Director Approval

**Purpose.** Authorize release of verified work.

**Entry criteria.** Verification passed with reported evidence.

**Exit criteria.** Explicit Director approval to release.

**Deliverables.** A recorded approval.

**Typical activities.** Presenting verification results; Director decision.

**Required approval.** **Director.** Required before any commit, tag, or push.

### 10. Commit / Tag / Release

**Purpose.** Record the approved work in version control.

**Entry criteria.** Director approval granted.

**Exit criteria.** Intended changeset committed, annotated tag created, commit and tag pushed to origin. Working tree clean; local `main` equals `origin/main`.

**Deliverables.** A commit, an annotated tag, a push confirmation.

**Typical activities.** Staging only the intended files; committing with the approved message; tagging; pushing; final repository audit.

**Required approval.** Director approval (from stage 9) is the precondition. Closure executes only after it.

### 11. Production

**Purpose.** Operate the capability live.

**Entry criteria.** Release pushed and deployed.

**Exit criteria.** Capability running and observed healthy.

**Deliverables.** A live, monitored capability.

**Typical activities.** Deployment; health verification; observability.

**Required approval.** Any production deployment is a Director gate.

### 12. Maintenance & Evolution

**Purpose.** Sustain and improve the capability over its life.

**Entry criteria.** Capability in production.

**Exit criteria.** Ongoing. A material change re-enters the lifecycle at the appropriate stage.

**Deliverables.** Fixes, improvements, and updated documentation.

**Typical activities.** Monitoring; bug fixes; incremental improvement; documentation upkeep.

**Required approval.** Per-change, scaled to impact. Architectural changes return to Architecture Design.

---

## Mandatory Rules

- Being listed in the Architecture Backlog does **not** authorize implementation.
- Every capability requires explicit **Director approval** before implementation begins.
- Every implementation must pass **architectural review before code review**.
- **Canonical Contracts are completed before Runtime.**
- **Runtime is completed before UI.**
- Every phase ends with **verification**.
- **Commit, Tag, and Push happen only after Director approval.**
- Architecture decisions are **permanent records** and must not be silently changed. A superseded decision is recorded and replaced, never quietly rewritten.

---

## Relationship to other documents

This lifecycle governs every item in the [Architecture Backlog](README.md). A backlog document describes *what* a capability is; this document defines *how* it moves from idea to production. The two are read together: the backlog names the destination, the lifecycle defines the path and its gates.
