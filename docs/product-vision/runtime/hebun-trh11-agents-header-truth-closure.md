# TRH-11 — Agent Surface Truth: the `/agents` Header Stops Counting Fiction — CLOSED

**One binding changed · ZERO schema · ZERO migration · ZERO authority · ZERO production rows** ·
**Migration ledger 48, repository and production, unmoved** · **Predecessor**
[TRH-10](hebun-trh10-first-artifact-review-closure.md) at `df48a8d`

**This is the phase where `/agents` stopped introducing itself with somebody else's number.**
The discovery found that almost everything the brief suspected had already been fixed by UI Phase
25B and AGENT-ID-0.1. Exactly one defect survived them, and it survived because it was not in the
simulation at all — it was in the page's own subtitle.

    SEEDED DEFINITION COUNT   !=  ORGANIZATIONAL AGENT COUNT
    SIMULATED DEFINITION      !=  DURABLE AGENT
    SEEDED STATUS             !=  LIVE RUNTIME
    PROVIDER NAME             !=  CONNECTED PROVIDER
    MODEL NAME                !=  ACTIVE MODEL BINDING
    ACTIVE SIMULATION         !=  IN-SERVICE DURABLE IDENTITY
    IN SERVICE                !=  RUNNING
    SCHEMA FIELD EXISTS       !=  ORGANIZATION HAS A VALUE
    UNAVAILABLE TRUTH         !=  FALSE / EMPTY TRUTH

---

## What was wrong — one line, and it was the first line a reader met

```tsx
context={`${model.seededDefinitionCount} seeded agent definitions · in-memory registry · runtime ${model.runtimeMode}`}
```

Rendered, for **every** organization: **"36 seeded agent definitions · in-memory registry · runtime
simulation"**.

None of those three values is tenant-scoped. The 36 come from `src/features/agents/mock.ts`, a file
containing **zero occurrences of the word `tenant`**.

Production holds **two** durable agents — one per organization:

| tenant | agent | id |
|---|---|---|
| Hebun AI | Heby | `4ffeeb83-022c-44c9-b98a-6cf13bc1b78d` |
| Turkish Rug House | Heby | `67f4460c-0d44-4ae7-a3ed-729c705e2609` |

Turkish Rug House has one agent. The header said 36.

### The defect was LOCATION, not wording

This is the part worth keeping. Every honest label about the simulation **already existed** and was
correct. `AgentsTruthSurface` has said, since UI Phase 25B:

    Persistence      memory · not durable        (warning tone)
    Runtime mode     simulation                  (warning tone)
    Live execution   not connected
    Live provider    not connected
    Computer Use     not available
    columns          Definition · Provider (ref) · Model (ref) · Seeded status
    card titles      "Definition is not execution" · "Definition Registry — in-memory CRUD"

A `PageHeader` context is not one of those labels. It is the page's own subtitle — rendered **above
the durable identity card and outside the labelled section** — so the one number a reader met first,
framed as a fact about their organization, was a count of compiled-in fiction. The simulation named
itself perfectly everywhere it lived, and then described the whole page from a place where nothing
qualified it.

---

## What was NOT wrong — measured, not assumed

`learnings.md` carries two warnings that turned out to be about exactly this surface:

> *"A simulation is fixed by making it name itself, not by deleting it."* (`:2209`)
>
> *"Measuring first showed UI Phase 25B and AGENT-ID-0.1 had already done it… The instinct 'we're
> in here anyway, let's tidy' is how a milestone's scope evaporates."* (`:2756`)

Both held. The brief's other suspicions were measured and found already answered:

| Suspicion | Measured |
|---|---|
| Simulation mixed with real identity | Durable card renders **first**, simulation **last** — pinned by `agent-id-0-1:634` |
| "Running" reads as live runtime | Surface states "Live execution: not connected" |
| Providers/models look connected | Columns are literally `Provider (ref)` / `Model (ref)` |
| `/director/registries/agents` competes | Its own header says it is *"the SIMULATION, and nothing else"* |
| **Many empty fields exposed** | **FALSE — see below** |

### The empty-field audit found nothing to fix

The `agents` table has **51 columns**. Both production rows fill **14** and leave **38** NULL.

**The durable read seam selects 7.** `read-durable-agent-identity.server.ts` reads `id`, `name`,
`humanOwnerId`, `humanOwnerType`, `createdAt`, `retiredAt`, `agentLifecycleStatus` — and nothing
else. No `/agents` component references `authorityCeiling`, `providerProfile`, `toolProfile`,
`preferredModels`, `preferredProviders`, `allowedTools`, `riskLevel`, `agentType`, `agentHealth`,
`departmentId`, or any reasoning / memory / learning / execution profile family.

**Nothing empty is rendered.** The narrow read seam had already solved this.

And the fields are correctly empty. Of 28 inspected, **26 have no released writer anywhere in the
source tree**; only `agentLifecycleStatus` and `retiredAt` are written, both by the retirement
authority. Filling any of the other 26 would require inventing an authority to own the transition.

    NO DATA IS THE CORRECT TRUTH HERE.

---

## The authority model, proved

**Durable / authoritative** — `features/agent-identity`, canonical Postgres `agents` table.
Exactly **one** `insert(agents)` exists in the entire source tree
(`create-durable-agent-identity.server.ts:153`). Genesis is one-shot by arithmetic
(`genesisSpent = rows.length > 0`). `inService` is **DERIVED, never stored** — the absence of
retirement. Tenant isolation is `eq(agents.tenantId, tenant.tenantId)`.

**Simulated** — `features/agents/mock.ts` → `agent-crud/agent-adapter`, in-memory, per-process,
writes no canonical row. **Not tenant-scoped, and not dead code:** consumed by roughly 35 source
modules including orchestration, task-planning, execution-queue, agent-context, agent-reasoning,
runtime-projection and the workforce models. Removing it is a subsystem change, not a UI change,
and TRH-11 did not consider it.

**Zero overlap.** Both durable rows are named `Heby`. No simulated definition — SEO Agent, Sales
Agent, Support Agent, Research Agent and the rest of the 36 — has a durable row.

---

## The fix

```tsx
const headerContext = !tenant
  ? "Sign in to see this organization's durable agent identities"
  : identityState.status !== "known"
    ? "Durable agent identity authority unavailable — this is not a claim that none exists"
    : identities.length === 0
      ? "No durable agent identity has been established for this organization"
      : `${identities.length} durable agent ${identities.length === 1 ? "identity" : "identities"} · ` +
        `${identities.filter((identity) => identity.inService).length} in service`;
```

Both real organizations now render: **"1 durable agent identity · 1 in service"**.

### The three facts stay apart

The page already refuses to merge these in `block` and `mandateBlock`, and the header must not undo
it:

    unauthenticated        ->  about the READER
    authority-unavailable  ->  about the CONTROL PLANE, never "none exists"
    known + zero rows      ->  a measured absence

Telling a Director "no durable agent identity" during a database outage would be a fabricated
absence. The unavailable branch says so in its own sentence, and a test asserts that denial is
present rather than merely that the branch exists.

### No runtime is claimed

`inService` is carried through exactly as the identity authority derives it — the absence of
retirement. **Nothing on this page observes a running agent**, so the header may report service
standing and may not rename it into a runtime word. A test bans `running`, `online`, `live`,
`active now` and `executing` from the header expression.

---

## What was retained, unchanged, and why

**Everything else.** The simulated registry keeps its capability, its position, its labels, its
model, its in-memory CRUD and all ~35 dependencies. `AgentsTruthSurface` still receives
`model={model}` unnarrowed and unfiltered; `agents-truth-model.ts` still exposes
`seededDefinitionCount`, which was never wrong — only wrongly placed.

The fix was never that a simulation existed.

### A released gate `/agents` still does not consult — reported, not acted on

`resolveMockSurfaceGate()` is a released authority answering "may compiled-in demo data be presented
in this environment?" In production — auth enabled, control plane configured — it returns
**`permitted: false`**, and it already protects the Director dashboard projection and Heby's
grounding, where the same fiction once produced *"active-agents: ready, 36"*.

**`/agents` never calls it.** Three modules do; `/agents` is not one of them.

Applying it would remove `AgentsTruthSurface` in production — which **fights a released pin**:
`agent-id-0-1/boundaries-and-firewall.ts:630` requires that component to be present. That is a
doctrine conflict between two released decisions, not a defect, and settling it is a Director call.
It was surfaced at the gate, the Director chose the header-only option, and **the gate question
remains open and unresolved.** Recorded here so it is not rediscovered as if it were new.

---

## Tests

**One new suite**, `tests/trh11-agents-header-truth/header-truth.ts`. It pins that the header is
composed from the durable identity authority and from nothing else — `seededDefinitionCount`,
`userDefinedCount`, `runtimeMode`, `persistenceProvider`, `groupingCount` and any `model.` reach are
banned **from the header expression specifically**, not from the file, because the page still
legitimately holds the model and passes it to the simulation.

It deliberately does **not** re-pin the simulation's presence, position or labels beyond confirming
this phase did not disturb them. `agent-id-0-1` owns the ordering invariant; re-asserting a
neighbour's claim would create two places to update when it legitimately moves.

**It bites.** Restoring the old header fails it on the exact sentence:
*"the page header must not be composed from `seededDefinitionCount` — the simulation does not
describe this organization."*

**14 suites run, all green**, chosen as everything that reads `/agents`, the agent identity
authority, the mock registry or the mock gate: `trh11-agents-header-truth`, `agent-id-0-1`
boundaries and acceptance, `agent-id-0` boundaries and bite-proofs, `agent-id-ceremony-disclosure`
completeness and bite-proofs, `phase-25c/workforce-ia`, `phase-25d/closure`,
`mock-surface-gating/gating-and-firewall`, `sia31-hypothesis-filing`, `ama3-mandate-product`,
`hlr-human-legibility`, `a1a-flow/attribution-firewall`.

The full 681 was **not** re-run: one presentation binding changed, typecheck is clean, lint reports
0 errors, and no firewall was touched or weakened.

---

## Production impact — none

    agents (durable)            2  unchanged        agents retired            0  unchanged
    decision_records           10  unchanged        governance_sessions      10  unchanged
    work_artifacts              8  unchanged        work_artifact_revisions   9  unchanged
    companies                   2  unchanged        migration ledger         48  unmoved

`agent_mandates` reads **2**, which is not a change: both belong to Hebun AI and are dated
2026-08-31, six days before this session. An earlier baseline in this phase counted mandates
*scoped to Turkish Rug House*, which is 0 — **the expectation was wrong, not the data**, and it is
recorded that way rather than quietly corrected.

No schema, no migration, no authority, no agent genesis, no retirement, no mandate, no provider, no
execution, no durable row of any kind.

---

## Route acceptance — five levels, not collapsed

| | |
|---|---|
| **IMPLEMENTED** | YES — one binding in `agents/page.tsx` |
| **TEST-PROVEN** | YES — new suite, bite-proved; 14 suites green |
| **RELEASED** | YES — committed and pushed to `origin/main` |
| **ROUTE-EXPOSED** | **NOT YET** — awaits the next deployment |
| **DIRECTOR-OBSERVED** | **NOT YET** |

The header string each production tenant will render was computed from **real production identity
rows**, not from a fixture: both resolve to *"1 durable agent identity · 1 in service"*
(`retired_at` NULL, `agent_lifecycle_status` NULL ≠ `"retired"`, so `inService` derives true). That
is a computation over live data, not a rendered observation, and it is not claimed as one.

---

## Limitations

1. **Route-level rendered acceptance of `/agents` remains unproven by test**, as it does for
   `/operations` and `/knowledge`. Carried forward unchanged.
2. **The mock-surface gate question is open.** `/agents` presents compiled-in definitions in an
   environment where the released gate says they may not be presented. Two released decisions
   disagree; neither was amended.
3. **The 36 definitions remain reachable by ~35 modules.** Nothing about their architectural
   position changed, and nothing here evaluates whether that position is correct.
4. **`agents` still has 38 columns no released authority writes.** They are unrendered and
   unreachable from this surface, so they mislead nobody today — but the schema is far wider than
   the product, and that gap is real.

---

## The ladder, exact

    /agents, TRH-11:
      Durable identity rendered first        YES  — pinned, unchanged
      Simulation labelled at every cell      YES  — pre-existing, unchanged
      Simulation demoted below durable       YES  — pinned, unchanged
      Empty durable fields hidden            YES  — read seam selects 7 of 51
      Page header states durable truth       YES  — THIS PHASE
      Simulation gated out of production     NO   — open question, recorded
      Runtime observed anywhere              NO   — nothing on this page observes one

The objective was never to make `/agents` look fuller. Turkish Rug House has one agent, and the
page now says so.
