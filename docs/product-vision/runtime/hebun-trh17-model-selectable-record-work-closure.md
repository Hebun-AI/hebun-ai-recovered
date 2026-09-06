# TRH-17 — Heby Can Now Choose To Record Work — CLOSED

**ZERO schema · ZERO migration · ZERO new authority · ZERO new runtime · ZERO production mutation** ·
**Migration ledger 48/48 converged, unmoved** ·
**Predecessors** [TRH-14](hebun-trh14-heby-mandate-closure.md),
[TRH-16](hebun-trh16-departmentless-work-closure.md)

Turkish Rug House's Heby has held a mandate since TRH-14 whose proposal scope is exactly
`["record-work"]`. It has never proposed anything. TRH-16 removed the last *semantic* obstacle —
departmentless work became legitimate — and said plainly that it closed no capability. This phase
closes it.

    ORIGINABLE  !=  MODEL-SELECTABLE  !=  RUNTIME-CONNECTED
                !=  MANDATED  !=  AUTHORIZED  !=  PERMITTED  !=  EXECUTED

---

## THE CORRECTION THIS CLOSURE OWES

The discovery brief for this phase named **one** gap: `record-work` was not in the model's
vocabulary. That was true and it was **not the blocker**.

Measured at `927d235`, `candidatesAreProposable` read:

```ts
return candidates.recipients.length > 0 && candidates.drafts.length > 0;
```

Those are the **send** requirements, and they were the *only* requirements. Turkish Rug House has
zero recipients. So `originateAgentAction` refused `no-candidates` **at step 3, before the model was
ever called** — and widening the model vocabulary alone would have changed nothing for the one
organization the phase existed to serve.

**The vocabulary gap was downstream of a gate nobody had looked at**, because `send` was the only
kind and the gate had therefore never been wrong. Both were fixed; the second one was the real one.

---

## What changed

**1 · The choice space stopped being send-shaped.** `OriginationCandidateSet` gained a `work` half,
built from `readOrganizationAuthority` — the **same** seam the `record-work` inlet already uses, not
a second one. Proposability became a disjunction over two **independent** spaces:

```ts
sendIsProposable(c)        // recipients > 0 && drafts > 0   — unchanged
recordWorkIsProposable(c)  // organizationLevel || departments > 0
```

`organizationLevel || departments > 0`, never `departments > 0`: writing the latter would have
re-imposed at the candidate set the department requirement TRH-16 removed at the authority.

**UNREADABLE IS NOT EMPTY.** An organization Hebun could not read offers nothing and record-work is
not proposable. An organization with no departments offers organization-level and **is** proposable.
OSA-1's three-state structure result is preserved rather than flattened into a count.

**2 · The parser admits a third shape.** Every rule the `send` branch obeys is obeyed by the new one:
exact keys, reject-never-repair, a bounded reason, and exact membership in what the server offered.

**3 · The model names a slug, never an identifier.** This is the one design decision worth recording,
and repository reality forced it rather than taste:

- `departments_tenant_slug_active_uq` makes `slug` **unique per tenant across exactly the set
  offered** — the active ones — enforced by PostgreSQL.
- `departments_slug_chk` makes it canonical: `^[a-z0-9]+(-[a-z0-9]+)*$`.

So the organization's **own word** for a part of itself is already a guaranteed-unique semantic
identity. The model sees `departmentSlug=loom-floor`, and trusted runtime code mints the
authoritative `department/<uuid>` from the very list it offered. **No uuid, no reference, no tenant
id and no agent id reaches the model** — proved by capturing the real `ModelGenerationRequest` at the
generator seam with a real department present, not by re-implementing the renderer.

**4 · The scope is TRH-16's union, restated at the model boundary.** A missing discriminator is
**refused**, never defaulted to organization-level. Defaulting would have reintroduced at the model
boundary the exact fiction TRH-16 removed at the authority boundary.

    EXPLICIT ABSENCE     != MALFORMED REFERENCE
    DEPARTMENTLESS WORK  != FICTIONAL DEPARTMENT

**5 · The title is the one argument membership cannot bound.** `send`'s two arguments were both
references, so membership was the whole containment story. A work title is prose and no candidate
list can contain prose. It is held to `isWellFormedWorkTitle` — **the released Work Authority
predicate, imported rather than restated**, so a model-authored title can never be held to a looser
rule than a person's — and it is read by a human before any decision. That is stated in the source
rather than glossed, because it is the one place this module's containment is not membership.

---

## What did NOT change

- **The `record-work` inlet.** Called exactly as released; its signature is untouched and it learned
  nothing about slugs. R3A.1's claim that *the model selects nothing* inside `heby-action-inlet`
  survives — a firewall re-asserts it.
- **The mandate ceiling.** Still **one** enforcement seam, in
  `recordAgentOriginatedActionRequest`. The candidate set deliberately does **not** read the mandate:
  shaping the offer by mandate would have made a second place decide what an agent may propose.
- **Governance, permits, the executor, Work Authority, Organization Authority, the schema.**
- **`send`.** Its own proposability rule is still conjunctive and its parse branch is byte-identical.

---

## The pins that moved, and why each one had to

No pin was bulk-edited. Three were **inverted**, because this phase deliberately closed the gaps they
recorded, and a pin that merely disappeared would leave nobody stating what replaced it.

| Pin | Was | Now |
|---|---|---|
| `agent-proposal-1/structured-output.ts` §1 | "admits `send` and the abstain value ONLY" | states the distinctions that remain, and §7 proves selection |
| `gia1/internal-act-firewall.ts` | "the model cannot select `record-work` today" | it can; and a selection carries **intent only** — no approval, permit, actor or tenant field exists on it |
| `trh16/departmentless-firewall.ts` §12 | "still cannot select"; "**zero** production callers" | can select; **exactly one** production caller, asserted as an exact list |

One firewall was **strengthened**, not merely updated. `l3-organization-authority/firewall.ts`
censused the Organization Authority's consumers by matching **raw file text**, so a module that only
**named** the seam in a comment counted as a consumer. That is a false positive in the harmless
direction with a twin in the harmful one: *a census a comment can inflate is a census a comment can
be written to explain away.* It now strips comments first. No consumer was removed by the change;
TRH-17 added the fifth, and a sixth still has to argue for itself.

---

## Evidence

- **Bite-proofs: 10 mutations bit, 2 tolerated changes accepted, 0 void.** Three are new and cover
  the new surface: a department slug that was never offered is accepted (**M8**), the model-authored
  title escapes the released bound (**M9**), and a scope with no discriminator defaults to
  organization-level (**M10**).
- **`trh17-model-selectable-record-work/origination-postgres.ts`** proves the whole ladder against a
  real database with a real tenant shaped exactly like Turkish Rug House — zero recipients, zero
  drafts, zero departments, mandate `["record-work"]`:
  - zero send candidates no longer silences the runtime, **and** nothing-of-either-kind still refuses
    `no-candidates` with **zero model calls** — nothing is spent to learn it;
  - the agent selects `record-work`, and **one pending row** lands naming the **agent** as proposer
    while the human whose session caused the write is recorded separately;
  - **zero permits, zero execution attempts, zero work items, zero non-pending requests** — after
    everything;
  - the model's own title is present **verbatim** in the payload a Director reads before deciding;
  - a department-scoped selection freezes the **server-resolved reference**, and the slug the model
    named is provably **not** what was frozen;
  - a fabricated department refuses `reference-not-offered` and files nothing;
  - the human `record-work` path still records a **human** proposer.
- **The mandate ceiling is proved where membership cannot reach it.** TRH refuses `send` at the
  candidate membership check — which means for TRH the ceiling never runs, and *a guard that never
  runs is not a guard that works*. So a second organization was seeded **with** a recipient and a
  draft and **with TRH's mandate shape**; its `send` selection passes membership and is refused
  `action-outside-agent-mandate` by the ceiling itself, filing nothing — while the kind the same
  mandate admits is filed. A ceiling, not a wall.

---

## Status — kept separate, deliberately

| | Turkish Rug House Heby |
|---|---|
| `MODEL-SELECTABLE` | **YES** |
| `RUNTIME-CONNECTED` | **YES** |
| `PROPOSAL-CAPABLE` | **YES** — mandate revision 1 admits `record-work` |
| `PROPOSAL-FILED` | **NO** — no production proposal was created |
| `GOVERNANCE-AUTHORIZED` | **NO** |
| `PERMITTED` | **NO** |
| `EXECUTED` | **NO** |
| `SUCCESSFUL` | **NO** |

---

## What this phase does NOT claim

- **No autonomous origination.** There is no scheduler, no cron, no background runtime anywhere in
  this repository — four API routes exist and all four are OAuth callbacks. A human still states a
  goal. What the human does **not** do is name the action.
- **No conversational inference.** `askHebyAction` still has zero path to origination.
- **`send` behaviour for existing tenants is preserved, not frozen.** The parse branch, the inlet
  call and the proposability rule are unchanged. But the model is now offered two kinds and may
  choose the other — that is inherent to model-selectability and is what the mandate ceiling is for.

---

## Next

**The first real Turkish Rug House Heby-originated `record-work` proposal ceremony.** Not provider
execution.
