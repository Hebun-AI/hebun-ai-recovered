# Provider Observation Consumption · Architecture Discovery (READ-ONLY)

**Status:** DISCOVERY COMPLETE — read-only. No runtime code, schema, migration or production row was
changed to produce it. Both discoveries recorded here **preceded** the release that later consumed
their conclusion, and neither produced a commit of its own.

**Measured against:** `main` at `99d0edb` (the parent of the release), migration ledger **52 entries**
(authored). Repository facts below were re-verified against source at `5d1d0c4` before this document
was written.

**Question put by the Director:** what should happen to provider observations after Hebun stores
them?

The answer turned out to have two halves, which is why they belong in one record: the first says
where observations must **not** go, and the second says how they may be **read** instead.

---

## 0 · The mental model this record exists to protect

A provider observation is historical evidence, and its whole meaning is one sentence:

> Provider P reported facts F about subject S at time T.

It is **not** automatically any of these:

    current provider state · organizational Knowledge · analytics · instruction · authorization

Three pins follow, and the rest of this document is their justification:

    READ != OBSERVE              reading stored history never reaches a provider
    READ != AUTHORIZE            reading evidence is not permission to produce more of it
    READ != KNOWLEDGE ADMISSION  showing a provider's claim is not adopting it as a fact

And the lifecycle pins they sit inside:

    CONNECTED != OBSERVED
    OBSERVED  != KNOWLEDGE
    STORED    != CONSUMED

---

## 1 · The discovery that started it: a subsystem with no reader

Provider Observation History was production-accepted at TRH-21, gained machine provenance at TRH-24,
and gained an automatic trigger at TRH-25. Rows were accumulating on a real cadence, under a real
Governance authorization.

**No product surface read them.** Not the dashboard, not Heby, not an agent, not a report.

The instinct at that point is to ask where the data should be *promoted* to — which is how a
Knowledge bridge gets designed for data nobody has ever displayed. The more useful question came
first:

> Who reads this data today?

The answer was *nobody*, and that reframed the work from promotion into consumption. **A subsystem
can be production-accepted and still have no product consumer.** Acceptance proves the subsystem
works; it says nothing about whether the organization has any use for its output yet.

---

## 2 · Discovery A — Observation → Knowledge

### 2.1 What was measured

There is **no automatic path** from `provider_observations` into Knowledge. Measured by import graph
rather than by reading intentions: at `5d1d0c4` the entire set of modules that import
`provider-observation-history` is the observation subsystem itself — the standing-observation
authority, the observation trigger, its own schema — plus the two files the dashboard consumer added.
No Knowledge module appears in that set, in either direction.

There is no bridge, no promoter, no Knowledge consumer, and no automatic admission runtime. The two
authorities are separate, and the separation is structural rather than conventional.

### 2.2 Why the provider runtime could not write Knowledge even if asked

`TenantContext` is nominally human and has one mint site. The observation runtime does not hold one —
it runs under an ephemeral observation principal, which is exactly why TRH-24 had to invent
provenance columns instead of writing a fake actor. Every Knowledge writer lives inside
`src/features/knowledge/`, and nothing outside that directory reaches one.

Agents hold no Knowledge proposal or admission authority either. So "the provider runtime writes
Knowledge" is not a policy Hebun declines to adopt; it is a sentence the code cannot currently
express.

### 2.3 The temporal gap, stated precisely

This is the claim most likely to be overstated, so it is stated in halves.

`knowledge_nodes` and `knowledge_facts` **do** carry `effective_from` and `effective_until`. The
**reader** interprets them: the durable repository derives `not-yet-effective` and `expired` from
them, and the contracts module classifies in-force state against an instant.

The **durable Knowledge writer never sets them.** At its three insert sites it writes neither column,
so every durably-written node and fact carries `NULL` in both — and the temporal machinery, though
implemented on the read side, is exercised only against nulls.

    Knowledge temporal semantics:  DESIGNED · READ IMPLEMENTED · NEVER WRITTEN

Hebun is therefore **not** temporally aware Knowledge merely because the columns exist. A volatile
provider metric admitted today would be stored as a fact with no validity bounds — that is, as
something permanently true. That single property is what makes metric admission dishonest right now,
independent of any opinion about whether metrics belong in Knowledge at all.

Related and separately verified: `knowledge_authority` is written as `provisional` at exactly two
sites and **nothing in the repository ever writes `authoritative`**. That value still has no
established writer.

### 2.4 Why Instagram's specific facts do not qualify

- **followers, following, media** are volatile point-in-time counts. Without validity bounds they
  cannot be represented honestly, per 2.3.
- **Account identity** is already substantially owned by Integration authority. Duplicating it into
  Knowledge would create a second home for a fact that already has one, and two homes disagree
  eventually.
- **`account_type`** was the only plausibly durable, non-duplicative candidate. One provider field
  does not justify a Knowledge lifecycle, an admission path and a ratification ceremony.

### 2.5 Decision — MODEL A

    PROVIDER OBSERVATIONS REMAIN PROVIDER OBSERVATIONS.

    AUTOMATIC OBSERVATION → KNOWLEDGE   no
    METRICS BELONG IN KNOWLEDGE         no
    HUMAN RATIFICATION                  required, if provider-derived information is ever
                                        deliberately admitted
    SCHEMA CHANGE                       none

Governance remains required for any deliberate admission. Nothing in this decision is a promise that
admission will ever be built.

---

## 3 · Discovery B — the observation read seam

### 3.1 It already existed

`provider-observation-history/read-provider-observations.server.ts` exposes `readProviderObservations`,
released under TRH-21, with these properties verified at source:

- server-only, with an explicit runtime guard;
- tenant comes from `TenantContext` and the tenant predicate is **unconditional** — there is no
  argument that could widen it, so a cross-tenant read is unrepresentable rather than merely
  unlikely;
- bounded: a caller's limit is clamped to a maximum page size;
- ordered by observed instant, descending;
- discriminated `read` / `unavailable` result, so "nothing stored" and "could not read" are different
  answers;
- no provider contact, no mutation, no audit write, no credential dependency, no schema requirement.

### 3.2 Decision — MODEL B

    ONE AUTHORITATIVE OBSERVATION READ SEAM → MANY NARROWED CONSUMERS

Rejected, explicitly:

- **A second read seam.** The seam that exists is correct; a second one would be a second tenant
  predicate to keep right, and the cheapest way to eventually get one of them wrong.
- **Direct table queries from UI, Heby or agents.** The tenant predicate is the security control. A
  consumer that can write its own `where` clause can omit it.
- **A transformed second persistence layer.** A projection of evidence, stored, becomes evidence
  nobody wrote and no provider said.
- **A get-by-id surface.** Nothing needed one, and an id-addressable observation invites callers to
  hold provenance identifiers a consumer should never see.

### 3.3 The seam must not invent a freshness authority

No authority defines when an observation is too old to rely on. The seam therefore returns instants
and refuses verdicts, and consumers inherit that refusal: no `fresh`, no `stale`, no `expired`, no
delta, no rate, no direction. **Two rows are two rows.** Whether they mean anything is a question this
authority cannot answer and does not try to.

### 3.4 Historical evidence survives disconnection

Revocation prevents **future provider contact**. It does not retract what a provider already said.
Stored observations therefore remain readable after a connection is disconnected or revoked, subject
to the ordinary access rules of the page itself, and a consumer must label them historically rather
than hide them. Hiding history on disconnect would quietly rewrite the past to match the present.

---

## 4 · The authority chain, drawn once

    Provider execution authority
        holds the capability, spends the credential, contacts the provider
        → writes an observation

    Observation history authority
        stores it immutably; reads it back, tenant-scoped and bounded
        → the ONLY read seam

    Consumer  (dashboard today; possibly others later)
        narrows for presentation or context
        → holds no authority, causes nothing

    Knowledge authority
        separate; not reachable from any of the above

    Governance
        required for deliberate Knowledge ratification, if ever

---

## 5 · Heby — deferred, and not accidentally implied

Heby does **not** consume stored observations, and this record must not be read as saying otherwise.

A released precedent already exists for how provider material may reach the model when the time
comes: CGO-7 established that observed provider content belongs in the **preparation brief** channel,
never in organizational grounding or evidence. A stored-observation-backed brief is therefore
architecturally plausible later, and would have the pleasant property of spending no provider quota
to produce context.

But as of this record:

    HEBY CONSUMPTION            deferred
    HEBY SOURCE CLASS           none added
    EVIDENCE/GROUNDING CLASS    none added
    AGENT ACCESS                none added
    PROMOTION INTO EVIDENCE     none

---

## 6 · What this record does not claim

- It does not claim Observation → Knowledge admission is implemented. It is not.
- It does not claim Knowledge is temporally aware. Its reader is; its writer is not.
- It does not claim `knowledge_authority = authoritative` is reachable. It has no writer.
- It does not claim Heby or agents read observations. They do not.
- It did not implement anything. The consumer that acted on Model B is released separately at
  `5d1d0c4` and closed in `hebun-trh-ig-stored-observation-dashboard-consumption-closure.md`.

---

## 7 · The transferable lesson

**Before promoting produced data into another authority, first prove who consumes it.**

The pull here was to design an admission path from observations into Knowledge. Asking who reads the
data today answered a different and better question: nobody did, and the seam to let somebody do it
honestly already existed. The result was a consumer of roughly two hundred lines instead of a new
authority, a new table and a ratification ceremony for facts no surface had ever displayed.

The corollary is about proof rather than design. A page that loads without error is not evidence that
it caused no side effect. **Absence of an error is not absence of an effect** — only counts that did
not move are.
