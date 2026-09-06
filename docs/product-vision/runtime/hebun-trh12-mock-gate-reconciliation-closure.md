# TRH-12 — `/agents` Obeys the Mock-Surface Gate — CLOSED

**One route consults an authority that already existed · ZERO schema · ZERO migration · ZERO new
authority · ZERO production rows** · **Migration ledger 48, unmoved** · **Predecessor**
[TRH-11](hebun-trh11-agents-header-truth-closure.md) at `8ce1c74`

**There was no contradiction. There was an omission — and the repository had already fixed the
identical one, on a different surface, with the same gate.**

    SIMULATION SUBSYSTEM EXISTS  !=  SIMULATION MUST BE PRODUCT-EXPOSED
    MOCK DEFINITION              !=  DURABLE AGENT
    SEEDED AGENT COUNT           !=  ORGANIZATIONAL AGENT COUNT
    REFERENCE PROVIDER           !=  CONNECTED PROVIDER
    REFERENCE MODEL              !=  ACTIVE MODEL BINDING
    SIMULATION STATUS            !=  LIVE RUNTIME STATUS
    HIDING A MOCK SURFACE        !=  DELETING THE MOCK SUBSYSTEM
    PRODUCT EXPOSURE POLICY HAS ONE OWNER

---

## The chronology, which settles it

| Date | Commit | Decision |
|---|---|---|
| 2026-08-18 | `1821dbd` | **Mock-surface gate introduced** — *"fix: gate mock organizational surfaces"* |
| **2026-08-20** | `5fc7d10` | **CMD-0** — `/director/goals` had the *same* omission and was routed through the gate |
| 2026-08-27 | `bcade6a` | **AGENT-ID-0.1** — the `AgentsTruthSurface` pin |
| 2026-09-04 | `46cd3dd` | Gate hardened with the control-plane clause |

TRH-11 reported these two released decisions as *appearing* to disagree. Traced to their sources,
they do not. They answer different questions, and only one of them was ever asked on `/agents`.

---

## What `resolveMockSurfaceGate()` owns — CMD-0 already said

CMD-0's closure, §4, is titled **"The repair: the gate that already existed"**:

> *"The G2 mock-surface gate already answers 'may a compiled-in organizational fiction be presented
> right now?', and already withholds the Director dashboard for exactly this reason. **It was simply
> never consulted here.** The goals read model now calls it."*

And it pre-answers the objection this phase would otherwise have had to argue from scratch:

> *"**Withheld, not relabelled.** Marking the four rows 'Seeded' and showing them anyway would still
> tell the Director their organization has a SOC2 readiness goal."*

That sentence is `/agents` with the nouns changed. TRH-11 had established that every cell of
`AgentsTruthSurface` is honestly labelled — "memory · not durable", "Live execution: not connected",
"Provider (ref)", "Model (ref)", "Definition is not execution" — and honest labels were never the
question. **Presenting 36 seeded definitions on the authoritative organizational route still tells a
Director their organization has 36 agent definitions.** Turkish Rug House has one durable agent.

### The caller matrix, before this phase

| Surface | Consulted the gate | Production behaviour | What escaped |
|---|---|---|---|
| Director dashboard | YES | withheld | `active-agents: ready, 36` |
| Heby grounding | YES, via the same adapter | withheld | fiction as durable answer-source evidence |
| `/director/goals` | YES, since CMD-0 | withheld | four fictional strategic goals |
| **`/agents`** | **NO** | **36 definitions rendered** | seeded headcount, reference providers and models, seeded departments |
| `/director/registries/agents` | NO — **by design** | renders | *nothing: it is the dedicated simulation route and says so* |

The gate's own firewall pins specific surfaces and contains no global-coverage assertion. But CMD-0
established what to do with an unconsulted surface: **consult the gate**, not grant an exception.

---

## What the AGENT-ID-0.1 pin actually protected

Its own section heading:

```
/* THE DURABLE SURFACE IS RENDERED, AND IT IS RENDERED FIRST. */
```

Its assertion message: *"the durable authority is presented **BEFORE** the simulation, not beneath
it."*

Its commit message states the phase's scope: *"its controls no longer say 'Create Agent', the
sentence a real authority would say. `/director/registries/agents` stopped calling per-process rows
'first-class agent definitions' under a green badge."* **Labelling.**

That commit contains **zero** mentions of the mock-surface gate, of production posture, or of
exposure policy. AGENT-ID-0.1 was written seven days after CMD-0 set the precedent and simply did
not revisit the question.

**The invariant is coexistence ordering, and TRH-12 preserved it exactly.** When the gate permits
exposure, the simulation still renders last, after every durable surface. What this phase added is
the question AGENT-ID-0.1 never asked — whether it may be presented *at all* in an environment
holding real organizations — and that question is deferred to the gate rather than answered here.

### `/agents` exception verdict: NONE EXISTS

No comment, doctrine, closure, learning or test anywhere in the repository says simulated
definitions should remain visible in production `/agents`. The absence of a gate call was an
omission, not a decision, and this phase declined to infer an exception from it.

---

## The change

```tsx
const mockExposurePermitted = organizationalDemoDataPermitted();
...
{mockExposurePermitted ? <AgentsTruthSurface model={model} /> : null}
```

The released predicate, called directly and unmodified. **No route-local exposure policy.** The
route reaches no `NODE_ENV`, no `VERCEL_ENV`, no `process.env`, no `isControlPlaneConfigured` and no
`getAuthEnvironment` — a firewall bans all six, because a route that re-derived the answer from its
own environment reading would satisfy every other assertion and still be the defect: two authorities
for one question, free to disagree.

### Environment semantics

| Posture | Gate | `/agents` |
|---|---|---|
| Production / hosted | refuses (`real-tenant-reachable`) | durable identities only |
| Local dev **with** `DATABASE_URL` | refuses (`control-plane-configured`) | durable identities only |
| Pre-auth demo shell (no auth, no database) | permits | durable identities, then the registry, in that order |
| Environment unresolvable | refuses (fails closed) | durable identities only |

**A developer loses no capability.** `/director/registries/agents` does not consult this gate and
stays reachable in every posture — it is the dedicated simulation route, and its own header calls
itself *"the SIMULATION, and nothing else."* A firewall pins that it remains ungated, so this
mitigation cannot rot silently.

---

## The simulation subsystem survived, whole

    HIDING A MOCK SURFACE != DELETING THE MOCK SUBSYSTEM

`AgentsTruthSurface` has **exactly one product consumer** — `agents/page.tsx` — and is a read-only
presentation component. The 36 definitions reach their roughly thirty-five internal consumers
(orchestration, task-planning, execution-queue, agent-context, agent-reasoning, runtime-projection,
the workforce models) through `agent-crud`, entirely independently of whether this component
renders.

`agents/mock.ts`, `agent-crud/*`, `agents-truth-surface.tsx`, `agents-truth-model.ts` and
`gate.server.ts` are **byte-unchanged**. A firewall re-measures that the adapter still seeds from the
definitions and that the surface's labels are intact.

### Heby was already contained

No Heby module imports `agent-crud` or `agents/mock`. `heby-runtime/overview-source.server.ts` reads
the gated adapter, so the fiction could not reach grounding before this phase and cannot now. The
exposure closed here was to a **human Director reading a page**, not to a model.

---

## Tests

**One pin amended, and only one.** `agent-id-0-1/bite-proofs.ts` M11 — *"the simulation is presented
above the durable authority"* — anchored on the exact text of the render line, which moved when the
guard was added. **Re-anchored, not weakened:** the defect it injects is unchanged (the durable card
relocated below the simulation), and AGENT-ID-0.1's ordering assertion must still bite. All 12 of
that suite's mutations still bite, 4 tolerated changes still accepted, 0 void.

Every other released pin passed untouched, because they are source-text assertions
(`page.includes`, `indexOf`) that a conditional wrapper preserves: `sia1`, `sia2`, `ama3`,
`phase-25b`, `phase-25c`, `phase-25d`, `trh11`, and `agent-id-0-1/boundaries-and-firewall` itself.

**One firewall added**, `tests/trh12-mock-gate-reconciliation/exposure-firewall.ts`, pinning two
claims that are deliberately different:

1. **EXPOSURE** — when the gate refuses, no simulated registry renders on `/agents`.
2. **AUTHORITY** — that decision comes from the released gate and from nothing else.

It does **not** re-pin the ordering invariant; `agent-id-0-1` owns that, and restating a neighbour's
claim would create two places to update when it legitimately moves.

**Bite-proved against three real defects:**

| Mutation | Caught by |
|---|---|
| ungate the surface (restore the pre-TRH-12 render) | *"renders ONLY when mock exposure is permitted"* |
| substitute a route-local `NODE_ENV` policy | *"the exposure decision is the gate's released predicate"* |
| call the gate, then discard its answer (`\|\| true`) | *"…called directly and unmodified"* |

**18 suites run, all green.** Typecheck clean, lint 0 errors. The full 681 was not re-run: one JSX
line and one import changed, and no firewall was weakened.

**Honest note on the firewall's strictness.** A fourth mutation — rewriting the guard as
`{!mockExposurePermitted ? null : <AgentsTruthSurface />}` — is behaviour-preserving, and the suite
rejects it anyway. That assertion pins FORM as well as behaviour. It is recorded rather than
softened: the tighter form is worth more here than tolerance for an equivalent rewrite, but it is
not a defect the suite caught, and this closure does not count it as one.

---

## Impact

**Schema: NONE. Migration: NONE. Production data: NONE.** No ceremony required or performed.
Production re-verified before and after: ledger **48**, digest `f11fb805e…`, prefix **converged**,
2 durable agents, 10 decision records, 8 artifacts, 9 revisions, 2 tenants — all unchanged.

**Security: strictly narrowing.** One surface stopped presenting compiled-in fiction to a human in
an environment holding real organizations. Nothing gained a capability.

**Tenant isolation:** untouched. The durable card reads
`eq(agents.tenantId, tenant.tenantId)` as it always did; the gate is an environment question and
takes no tenant, by its own documented design.

---

## Route acceptance — six levels, not collapsed

| | |
|---|---|
| **IMPLEMENTED** | YES — one import, one binding, one guarded JSX line |
| **TEST-PROVEN** | YES — new firewall bite-proved, 18 suites green |
| **RELEASED** | YES — committed and pushed |
| **DEPLOYED** | **NOT YET** |
| **ROUTE-EXPOSED** | **NOT YET** |
| **DIRECTOR-OBSERVED** | **NOT YET** |

Expected organizational truth once deployed:

    Turkish Rug House /agents  ->  1 durable Heby, and no seeded registry
    Hebun AI          /agents  ->  its own durable Heby, and no seeded registry

    36 simulated definitions   ->  not organizational headcount
                               ->  not durable identities
                               ->  not provider connections
                               ->  not runtime truth
                               ->  still compiled, still served to ~35 internal consumers,
                                   still rendered at /director/registries/agents

---

## Limitations

1. **Route-level rendered acceptance remains unproven by test**, as for `/operations` and
   `/knowledge`. The gate's refusal is proven at source level and by the gate's own released
   firewall, not by an authenticated render of this route.
2. **The exposure firewall pins the guard's FORM**, as recorded above.
3. **The gate's permitted posture is narrow by design** — the pre-auth shell only. Local development
   with a database configured now also hides the registry on `/agents`. Mitigated by the dedicated
   route, and pinned so the mitigation cannot disappear unnoticed.
4. **TRH-11's open question is closed; nothing else in TRH-11 was reopened.** Its header remains the
   durable-truth header and a firewall guards against regression.

---

## The ladder, exact

    /agents:
      Durable identity rendered first          YES  — AGENT-ID-0.1, preserved
      Simulation labelled at every cell        YES  — UI Phase 25B, untouched
      Page header states durable truth         YES  — TRH-11, guarded
      Simulation gated out of production       YES  — THIS PHASE
      Simulation subsystem intact              YES  — 0 files changed under it
      Second exposure policy created           NO   — banned by firewall
      Runtime observed anywhere                NO   — nothing on this page observes one

TRH-11 found the contradiction and refused to resolve it without evidence. The evidence said one
authority already owned the question and one route had never asked it.
