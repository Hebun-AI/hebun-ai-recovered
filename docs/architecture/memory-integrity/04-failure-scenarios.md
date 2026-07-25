# 04 — Failure Scenarios

Concrete examples of invalid or ungoverned memory. Each shows the violation, why it is invalid, and the expected **architectural response** — always rejection or prevention, never silent repair. A body of memory is either valid before it is trusted, or it is refused.

---

## A recorded fact is rewritten

**Scenario.** An existing memory is edited in place to change what it recorded.

**Why invalid.** Violates the never-rewrite invariant ([rule 1](02-integrity-rules.md)) and append-only ([rule 2](02-integrity-rules.md)). The past has been altered; history is now fiction.

**Expected response.** Prevented. A correction must be recorded as a *new* memory that supersedes the old, with both retained ([rule 8](02-integrity-rules.md)). No runtime edits a recorded fact.

## A memory has no provenance

**Scenario.** A memory exists with no resolvable Source or time.

**Why invalid.** Violates provenance completeness ([rule 3](02-integrity-rules.md)). The memory cannot be traced, trusted, or governed — it is rumor.

**Expected response.** Rejected. A memory without complete provenance is not admitted. Runtime does not fabricate an origin to make it pass.

## An orphaned (unowned) memory

**Scenario.** A memory exists with no `MemoryOwner`.

**Why invalid.** Violates ownership ([rule 4](02-integrity-rules.md)). No part of the organization is accountable for it; it is ungovernable.

**Expected response.** Rejected. Every memory must be owned by a Phase 5 entity before it is valid. Runtime does not assign a default owner.

## A broken reference

**Scenario.** A `MemoryReference` points at a Phase 5 entity or a memory that no longer exists.

**Why invalid.** Violates reference resolution ([rule 5](02-integrity-rules.md)). Clusters and event chains built on the reference are corrupted.

**Expected response.** Rejected or flagged. References must resolve; retiring a referenced entity requires governing the memories that point at it, not silently breaking them. Runtime does not follow a dangling reference.

## Cross-workspace memory

**Scenario.** A memory is owned across, or references across, a workspace boundary.

**Why invalid.** Violates workspace isolation ([rule 7](02-integrity-rules.md)) — a tenant leak, the most severe class of failure.

**Expected response.** Rejected unconditionally. No convenience admits it. Runtime never bridges tenant memory.

## An inconsistent timeline

**Scenario.** A memory claims to precede its own cause, or an event chain contradicts the times its memories carry.

**Why invalid.** Violates timeline consistency ([rule 6](02-integrity-rules.md)). Trajectory and causation become unreadable.

**Expected response.** Rejected or flagged. The temporal contradiction must be resolved before the memory body is trusted. Runtime does not reorder memory to paper over the inconsistency.

## Silent deletion for retention

**Scenario.** Memory is quietly deleted to save space or to expire it, outside a governed retention decision.

**Why invalid.** Violates append-only ([rule 2](02-integrity-rules.md)) and retention governance ([governance](03-governance.md)). History has a silent gap; continuity is broken.

**Expected response.** Prevented. Any archival or expiry is an explicit, owned, auditable governance decision — never a silent runtime action.

---

## The architectural response, in general

- **Prevention and rejection, not repair.** Invalid or ungoverned memory is refused before it enters the trusted body. Runtime consumes only valid memory, so it never encounters — and never patches — these failures.
- **Surfaced, not silent.** A violation is reported with enough context to locate it.
- **Corrected at authorship or by governance.** The fix is a new superseding memory or a governed decision — never runtime improvising a mutation.
- **No defaulting.** Integrity never invents provenance, an owner, or a reference to make invalid memory pass.
