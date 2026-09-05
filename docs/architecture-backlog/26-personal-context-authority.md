# 26 — Personal Context Authority

**Priority:** Future
**Status:** Planned — prerequisite-gated, and gated on its own security design (see *Deferment*)

## Purpose

An **identity-scoped authority that owns one human's personal context**: what was stated, what was imported, what was derived, when each was true, and who may read it.

It is the missing substrate underneath [25 — Private Digital Twin](25-private-digital-twin.md). 25 names a capability and refuses to design its authorization model; this record names the authority that model would belong to, and still designs no schema. **The Twin is the reader. This is the owner.**

## Why it exists as a separate record

25 states the requirement and then states, correctly, that it will not sketch a solution:

> *"Private Digital Twin data must be bound to the HUMAN IDENTITY, not to tenant ownership and not to an application role."*

That sentence describes an **authority**, not a feature of a Twin. Every read authority Hebun has released answers *"may this tenant see this, and does this caller hold the right authority in that tenant?"* — `resolveGovernanceAuthority`, Knowledge retrieval, work artifacts, recorded recipients. Personal context needs a different question: ***is this the person whose context this is, and did they authorize this use?***

That is a different **axis**, not a stricter filter on the existing one. Folding it into a tenant-scoped authority would not make that authority safer; it would make the personal question unaskable. So it is recorded as its own authority, before anything is built that would have to be un-built.

**The constitution already provides for it and already constrains it.** [§2.10 Enterprise and Personal Ownership Principle](../architecture/00-enterprise-constitution.md) — *"Individuals own personal context... Heby owns neither."* [§5.8 Unified Intelligence Invariants](../architecture/00-enterprise-constitution.md) carries **`Personal Context ≠ Enterprise Knowledge`** alongside `Trust ≠ Permission` and `Identity ≠ Access Control`. **Individual Approval** is already a named approval category. What is missing is not the principle. It is the runtime expression, and a repository search for `individual approval` in application code returns nothing.

## Scope — what this authority owns

- **Ownership of personal context** — every item is bound to one human identity, and that binding is the record's primary fact rather than a column on it.
- **Explicit admission** — the boundary through which material becomes personal context. Nothing becomes personal context by being observed, inferred, ingested or overheard.
- **Identity-bound read authorization** — who may read an item, for which interaction, and on whose authorization.
- **Revocation** — withdrawal of previously admitted material, and of anything derived from it.
- **Personal-context lifecycle semantics** — supersession, reconfirmation, validity over time, historical retention.

## Scope — what this authority MUST NOT own

- **organizational knowledge** — that is the Knowledge authority's, and `Personal Context ≠ Enterprise Knowledge` is constitutional
- **Governance decisions** — Governance owns decision legitimacy; this authority owns none of it
- **derived Director inference** — that is [23 — Director Digital Twin](23-director-digital-twin.md)'s subject, and 23 derives from *organizational* history
- **Twin evaluation** — the Twin reasons; this authority holds and gates
- **execution** — of anything, ever
- **authorization of consequential actions** — it authorizes *reads of personal context*, and nothing else

> **HOLDING PERSONAL CONTEXT CONFERS NOTHING.**
>
> This authority makes a person's own context readable to the interactions that person permits. It grants no organizational capability, no execution reach and no decision weight. An authority that gated personal reads *and* consequential acts would be two authorities wearing one name.

## The provenance invariant

**`STATED != IMPORTED != DERIVED`**

Three origins, structurally distinct, and never silently promoted between:

| Origin | Means | Established by |
|---|---|---|
| **STATED** | the person said so | the person, through explicit admission |
| **IMPORTED** | it came from a source the person authorized | an authorized source, admitted by the person |
| **DERIVED** | Hebun concluded it | Hebun, and it says so |

> **A system inference must NEVER silently become a person's stated preference, belief, goal, value, or intention.**

A derived item may become stated **only** by the person stating it, through the admission boundary — and the result is a *new* stated item whose relationship to the inference is recorded, not an inference relabelled.

This is not a new discipline. **G6D made exactly this survivable for organizational grounding**: `AUTHORITATIVE` must survive persistence and replay without being flattened to `DERIVED`. The lesson transfers to a person unchanged, and so does the failure mode. What does **not** transfer is the storage: `heby_answer_source_evidence` is answer-keyed and tenant-scoped, and reusing it would rebuild the wrong axis.

## Temporal truth

**`CURRENT BELIEF != HISTORICAL BELIEF`**
**`CURRENT PREFERENCE != HISTORICAL PREFERENCE`**
**`CURRENT INTENT != HISTORICAL DECISION`**

A person is not a snapshot. A model that overwrites what someone used to think has destroyed the evidence that they changed their mind — and *that* is often the most useful thing to know about them. Freezing a person into a static persona and forgetting they ever differed are the same defect at two different timescales.

Semantic requirements, recorded so the eventual design is measured against them rather than reverse-justified. **No schema is designed here.**

- **Supersession** — a newer item may replace an older one for the purpose of "what is true now" without deleting it. The superseded item remains readable *as history*, and the reader can always tell which is which.
- **Reconfirmation** — a person may re-assert an item that is still true. Reconfirmation refreshes standing without creating a new belief, and the difference between "still true" and "true again after being false" must be expressible.
- **Revocation** — a person may withdraw an item. What withdrawal means for everything derived from it must be **stated by the design**, not left to inherit an open question. Organizational evidence has not resolved retention, expiry or right-to-forget; personal context cannot borrow that deferral.
- **Validity over time** — an item may state a window it was true in, and an item that states none makes no claim rather than claiming forever. Inventing a window is the same fabrication a freshness derivation refuses.
- **Historical retention** — what is kept, for how long, readable by whom, and what a person's own export contains.

## Active Elicitation — a designed future capability

The Twin may eventually notice that personal context is **missing, stale, or uncertain**, and ask the person a question about it. This is a legitimate future capability and it is recorded here rather than discovered later, because the dangerous version of it is the one nobody wrote down.

```
QUESTION  != ADMISSION
ANSWER    != AUTOMATIC KNOWLEDGE WRITE
INFERENCE != CONFIRMED PREFERENCE
```

A question is an invitation. An answer is an utterance. **Neither is an admission.** A person's answer may become STATED personal context **only** by passing the Personal Context Authority's explicit admission boundary — the same boundary any other stated item passes, with no shortcut for material that arrived in a conversation.

> **Heby and the Twin MUST NOT become independent personal-context writers.**

Heby is the surface the question is asked through. The Twin is what noticed the gap. Neither owns admission, and neither may write personal context by having heard something. If asking a question created a write path, the elicitation capability would have quietly minted a second authority — which is the whole failure this record exists in front of.

Elicitation must also be **refusable without penalty**: a person who declines to answer leaves the gap open, and the gap stays honestly reported rather than filled by inference.

## Decision-centre ceiling

The Twin's reach over Hebun's decision process, stated as a ceiling rather than a direction:

| Level | Permitted | Why |
|---|---|---|
| **READ** | ✅ | context may inform reasoning |
| **ADVISE** | ✅ | it may say what the person might prefer, marked as derived |
| **PROPOSE** | ✅ | it may cause a proposal to exist |
| **AUTHORIZE** | ❌ | that is Governance |
| **impersonate the Director** | ❌ | `DIRECTOR TWIN != DIRECTOR` |
| **become Governance** | ❌ | three subsystems, never collapsed |
| **mint permits** | ❌ | permits come from a decided proposal, never from a prediction |
| **EXECUTE** | ❌ | not even when the prediction is correct |

**Any future proposal must enter the existing governed chain at its beginning** — filed as a proposal, decided by a human, permitted, and only then executed, with the kill switch checked before any transport is selected. Personal context enters at the *front* of that chain and gains no shortcut through the rest of it.

```
Personal context → reasoning → PROPOSAL → authority → permit → execution → audit
                                    ↑
                         the twin's reach ends here
```

**Accuracy is never a route to authority.** A prediction that becomes reliable is still a prediction, and [23's authority firewall](23-director-digital-twin.md) already says so for the Director's decision model. The same sentence governs personal context.

## Personal sources — the vault is deferred, and is never authority

A personal Obsidian vault remains **DEFERRED**. It may later become a **candidate source**, and only that:

```
Person
  → Personal Source / Vault
    → explicit admission
      → Personal Context Authority
        → Twin evaluation
          → Heby
```

**The vault MUST NEVER become authority or a source of truth by itself.** The first arrow carries the authorization: a vault supplies *material*, and only the person makes it available. A file appearing in a directory is not a statement, and a directory is not a person.

Nothing is connected and no source is selected. The design must not assume the first source is the only one — other explicitly authorized personal systems may follow, and an ingestion path shaped around one vault's conventions would have to be rebuilt for the second.

## Not to be confused with

| | Models | Derived from | Owns |
|---|---|---|---|
| [09 — Director Memory](09-director-memory.md) | what the **organization** decided and learned | organizational history | organizational memory |
| [21 — Enterprise System Map](21-enterprise-system-map.md) | the **organization** | live runtime signals | a live map |
| [23 — Director Digital Twin](23-director-digital-twin.md) | the Director's **decision model** | the organization's record of Director decisions | a derived evaluation |
| [25 — Private Digital Twin](25-private-digital-twin.md) | one human's **personal context**, as a capability | that person's authorized sources | the Twin's reading of it |
| **26 — Personal Context Authority** (this record) | nothing — it **owns and gates** | admission by the person | ownership, admission, read authorization, revocation, lifecycle |

**26 is not a fourth twin.** It models no subject. 25 is the capability a person experiences; 26 is the authority that capability reads through. They are recorded separately because 25's own promotion criteria require an authorization model that *"passes its own security gate"* — a requirement that cannot be satisfied by a record that also refuses to design one.

Both remain distinct from Knowledge: **Knowledge does not become the personal-context authority**, and this authority holds no organizational knowledge. Both remain distinct from Governance: **Governance gains no personal-context read authority** — a Governance authority legitimately reads their tenant's constitutional record, and must not thereby read a colleague's routines.

## Enterprise expansion is a future consequence, not current scope

The architecture must not **prevent** identity-bound personal context later existing for founders, CEOs, executives or employees — the authority is identity-scoped, and an identity-scoped authority generalizes to any identity by construction rather than by extension.

**No enterprise product functionality is designed now.** No per-role tiers, no organizational rollout, no administrative view over other people's context, no commercial packaging. Recording that the door is not nailed shut is not the same as opening it.

## Privacy requirements — future non-negotiables

Recorded now so the eventual design is measured against them. **No schema is designed here.**

- identity-bound access — never role-derived, never tenant-derived, never membership-derived
- explicit source authorization, per source
- provenance per item, preserved end to end through persistence and replay
- revocation, including of derivations
- deletion semantics, stated rather than inherited
- stale-context handling
- supersession and reconfirmation, distinguishable
- export — a person can obtain their own context
- auditability of sensitive context use
- no automatic organizational exposure
- no automatic agent access
- no automatic Governance access
- no execution authority inherited from personal context

## Dependencies

- **Identity** — a durable human identity distinct from membership and role. `users` is root-scoped and global, and `auth_identities` carries the provider-neutral mapping; both exist, and neither is yet an authorization axis.
- **Individual Approval** — the constitutional category that exists in principle with no runtime expression
- [25 — Private Digital Twin](25-private-digital-twin.md) — the capability this authority exists underneath
- [23 — Director Digital Twin](23-director-digital-twin.md) — adjacent, organization-derived, and never merged with this
- [10 — Knowledge Ingestion Engine](10-knowledge-ingestion-engine.md) — the ingestion discipline an identity-bound equivalent would learn from, and must not reuse
- [13 — Policy Engine](13-policy-engine.md) / [14 — Permission Engine](14-permission-engine.md) — where an identity-bound authorization model would live
- [18 — Observability Center](18-observability-center.md) — auditability of sensitive context use
- Governance — the authority this must never acquire, and never route around
- Heby — a consumer, never an owner and never a writer

## Deferment

**Intentionally deferred.** Two gates, and the second is the harder one:

1. **Prerequisite maturity** — identity, ingestion discipline, provenance and audit mature enough that personal context can be held with the rigour organizational evidence now is.
2. **Its own security design and security gate** — the identity-bound authorization model does not exist and is not designed here. Reusing a tenant-scoped or role-based read authority for personal context is the failure mode this record exists to prevent, and sketching a mechanism now would invite exactly that reuse.

**No target phase is assigned. No phase number is invented here.** The [Capability Lifecycle](00-capability-lifecycle.md) assigns a roadmap slot at **Stage 3 — Director Review**, and listing a capability is explicitly *"documentation, not authorization"*. [23](23-director-digital-twin.md) and [25](25-private-digital-twin.md) record the same refusal for the same reason.

## Promotion criteria

- Prerequisite areas above are mature, in particular a durable human identity independent of role and membership.
- **An identity-bound authorization model is designed and passes its own security gate** — not reusing tenant-scoped or role-based read authority.
- `STATED != IMPORTED != DERIVED` enforceable by mechanism, surviving persistence and replay.
- Temporal semantics defined: supersession, reconfirmation, revocation, validity, historical retention — including what happens to anything derived from withdrawn material.
- Admission boundary defined such that **no** conversational surface, agent or Twin can write personal context around it.
- Decision-centre ceiling enforceable by mechanism, not by documentation.
- Separation from [09](09-director-memory.md), [21](21-enterprise-system-map.md), [23](23-director-digital-twin.md), [25](25-private-digital-twin.md), Knowledge and Governance explicit in the design.
- Director approval.
