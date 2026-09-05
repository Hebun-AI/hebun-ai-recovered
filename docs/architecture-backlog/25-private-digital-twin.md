# 25 — Private Digital Twin

**Priority:** Future
**Status:** Planned — prerequisite-gated, and gated on its own security design (see *Deferment*)

## Purpose

An **identity-bound private context representing one human's explicitly authorized personal knowledge** — preferences, working patterns, goals, routines, and the personal material that person has chosen to make available.

It exists so Heby can understand the person it is talking to *as that person*, and can say honestly whether it knows something about them, where that came from, and whether it is still true.

## What it is not

The Twin is **not** the human, and not an autonomous copy of one. It is also not:

- a Governance authority;
- organizational Knowledge;
- company-wide Memory;
- an agent;
- a Computer Use executor;
- an authorization mechanism;
- an Obsidian vault;
- a second source of truth for any concept an existing subsystem already owns.

It holds understanding. It confers nothing.

## The constitutional basis already exists

This capability is not a new principle. The [Enterprise Constitution](../architecture/00-enterprise-constitution.md) already provides for it and already constrains it:

- **§2.10 Enterprise and Personal Ownership Principle** — *"Organizations own enterprise knowledge... Individuals own personal context within applicable organizational, contractual, legal, and relationship boundaries. Heby owns neither."*
- **§5.7 Enterprise Principle** — *"Organizations own enterprise knowledge. Individuals own personal context. Heby owns neither."*
- **§5.8 Unified Intelligence Invariants** — **`Personal Context ≠ Enterprise Knowledge`**, alongside `Trust ≠ Permission` and `Identity ≠ Access Control`.
- **Individual Approval** is already a named approval category: *"a person's approval for eligible personal context, privacy, consent, or responsibility."*

What is missing is not the principle but the **substrate and the authorization design**. This record names the capability; it does not design either.

## Not to be confused with — the third twin

Three records in this repository model different subjects under the same phrase, and a fourth exists in the capability layer. Keeping them apart is the product principle, not bookkeeping.

| | Models | Derived from | Answers |
|---|---|---|---|
| [21 — Enterprise System Map](21-enterprise-system-map.md) | the **organization** | live capability, agent, task, event and data signals | *how does the company run?* |
| [23 — Director Digital Twin](23-director-digital-twin.md) | the Director's **decision model** | the organization's historical record of Director decisions | *how does the Director tend to evaluate?* |
| **25 — Private Digital Twin** (this record) | one human's **personal context** | that person's own explicitly authorized personal sources | *what does this person actually prefer, and who says so?* |
| Capability Digital Twin — [49 Future Extension Points](../architecture/business-capabilities/49-future-extension-points.md) | a **Capability's** condition | meta model, network, runtime evidence | *what state is this capability in?* |

**23 and 25 are the pair most easily confused, and they differ at the root.** 23 is *organization-derived and about decisions*: it reads the company's record of what the Director decided, to predict how a new proposal would be evaluated. 25 is *person-supplied and about context*: it holds what the person has explicitly authorized about themselves, to help Heby understand them. One infers from organizational history; the other receives from a personal source. Merging them would let organizational inference masquerade as a person's stated preference — which is precisely what [23's own authority firewall forbids](23-director-digital-twin.md).

Also distinct:

- **[09 — Director Memory](09-director-memory.md)** — *organizational* memory: what the organization decided, learned and preferred. 25 is personal and identity-bound; it must not become a private copy of organizational memory, and organizational memory must not absorb it.
- **[19 — Learning Engine](19-learning-engine.md)** — organizational patterns. 25 models one person, and never the organization.

## Authority boundary — the requirement this record exists to fix in advance

**Private Digital Twin data must be bound to the HUMAN IDENTITY, not to tenant ownership and not to an application role.**

Holding any of the following must **not** by itself grant access to another person's Private Digital Twin:

- Owner
- Admin
- Governance authority
- another agent
- another employee
- any role, band, or membership

This is a departure from how every existing Hebun read authority works. Today's substrate is **tenant-scoped**: `resolveGovernanceAuthority`, Knowledge retrieval, work artifacts and recorded recipients all answer "may this tenant see this?" and then "does this caller hold the right authority in that tenant?". Neither question is the right one here. A Governance authority in a tenant legitimately reads that tenant's constitutional record; the same person must **not** thereby read a colleague's personal routines.

The constitution already names the missing piece — **Individual Approval** — but no runtime expression of it exists.

> **This requires its own architecture design and its own security gate.** No authorization mechanism is proposed in this record. Reusing an existing tenant-scoped read authority for personal context would be the failure mode this paragraph exists to prevent.

**That authority is now recorded separately, and it is still not designed.** [26 — Personal Context Authority](26-personal-context-authority.md) names the identity-scoped authority this requirement describes — ownership, explicit admission, identity-bound read authorization, revocation, and personal-context lifecycle semantics. It is a separate record rather than a section here because this record's own promotion criteria demand an authorization model that *"passes its own security gate"*, and a record that refuses to design one cannot also be the place that satisfies it. **26 is not a fourth twin: it models no subject. This capability is what a person experiences; 26 is the authority it reads through.** Neither record designs a schema.

## Personal sources — Obsidian as a candidate first source, not the authority

Conceptual direction only. **Nothing is connected, and no source is selected.**

```
Obsidian vault (a candidate FIRST personal source)
  → explicitly authorized private ingestion
    → provenance-preserving personal context
      → Private Digital Twin
        → Heby
```

Obsidian is a **potential first personal source**, never Hebun's Digital Twin authority. The Twin is the identity-bound context; a vault is one place material may enter it from, with the person's explicit authorization. Other explicitly authorized personal systems may follow, and the design must not assume the first one is the only one.

**A personal vault remains DEFERRED, and the admission step is not optional.** With [26](26-personal-context-authority.md) recorded, the chain has an owner in the middle of it:

```
Person
  → Personal Source / Vault
    → explicit admission
      → Personal Context Authority
        → Twin evaluation
          → Heby
```

**The vault MUST NEVER become authority or a source of truth by itself.** A file appearing in a directory is not a statement, and a directory is not a person. The admission arrow is where a person makes material theirs on the record; a sync that skipped it would have created a second source of truth with no owner, no provenance and no revocation.

### Provenance is the load-bearing part

Hebun must be able to distinguish, per item and at all times:

- an **explicitly stated** preference — the person said so;
- **imported** personal information — it came from an authorized source;
- a **derived inference** — Hebun concluded it;
- **stale** information — it was true, and may not be now;
- **current authoritative organizational** information — which is a different subsystem's, and is not personal context at all.

**An inference must never silently become a stated preference.** This is the same distinction G6D made durable for organizational grounding — `AUTHORITATIVE` must survive persistence and replay without being flattened to `DERIVED` — applied to a person instead of an organization. The lesson transfers directly, and so does the failure mode.

The invariant is stated in its enforceable form by [26 — Personal Context Authority](26-personal-context-authority.md) as **`STATED != IMPORTED != DERIVED`**, together with the temporal pair `CURRENT BELIEF != HISTORICAL BELIEF` and `CURRENT INTENT != HISTORICAL DECISION`. The authority owns those semantics; this capability reads them and must never flatten them on the way to Heby.

## Heby's relationship to it

Heby may eventually **consume** Private Digital Twin context when the authenticated human is authorized to expose that context to the current interaction. Heby does not own it, does not write it, and does not decide who may see it.

The context chain begins with the **person**, not with a source and not with Heby:

```
Director (the identity the context belongs to)
  → Private Digital Twin
    → authorized context
      → Heby
```

The first arrow is the one that carries the authorization. A vault, a file or an import supplies material; only the person makes it available, and only for the interactions they permit.

Take *"Play some music I like."* Before Heby can act usefully or honestly, five separate questions must be answerable:

1. **Does it actually know?** — or is it about to invent a preference.
2. **What established it?** — stated, imported, or inferred, and from which source.
3. **Is it current?** — or stale and worth re-confirming.
4. **Is Heby authorized to use it here?** — this interaction, this surface, this audience.
5. **Does the requested action require another capability?** — playing music is not knowing a preference.

Questions 1–3 are provenance. Question 4 is the authority boundary above. **Question 5 is the point of the next section.**

Heby's existing constraint is unchanged and binding: [§5.3 Heby Authority Boundaries](../architecture/00-enterprise-constitution.md) already forbids Heby to own personal knowledge, bypass privacy, convert trust into permission, or promote observations into truth. Personal context provides **understanding**. It provides **no execution authority**.

## Computer Use boundary

The future chain, stated explicitly so no step can be quietly skipped:

```
Private Digital Twin
  → personal context
    → Heby intent / reasoning
      → capability request
        → authority / policy
          → permit / confirmation where required
            → Computer Use / execution
              → audit
```

Stated as the separate chain it is — context may begin a proposal, and nothing further:

```
Heby / Twin context
  → proposal
    → Governance / execution authority
      → permit
        → execution
          → audit
```

**The two chains meet only at `proposal`.** Personal context can cause a proposal to exist; it can never stand in for the authority that decides it, the permit that authorizes it, or the audit that records it.

**The Twin must never bypass the Computer Use authority model.**

- Knowing a person likes a particular song does **not** authorize Heby to control a browser or a device.
- Knowing a routine does **not** authorize Heby to execute that routine.

Context and execution authority remain separate systems with separate gates. The released architecture already enforces this shape for organizational action — a proposal is filed, a human decides, a permit is minted, and only then may a connected substrate execute, with the kill switch checked before any transport is selected. Personal context enters at the *front* of that chain as an input to reasoning, and gains no shortcut through the rest of it.

## Privacy requirements — future non-negotiables

Recorded now so the eventual design is measured against them rather than reverse-justified. **No schema is designed here.**

- identity-bound access
- explicit source authorization
- tenant isolation where applicable
- provenance, per item
- revocation
- deletion semantics
- stale-context handling
- derived-vs-explicit distinction, preserved end to end
- auditability of sensitive context use
- no automatic organizational exposure
- no automatic agent access
- no automatic Governance access
- no Computer Use authority inherited from personal context

Two of these deserve emphasis because nothing comparable exists in the repository today. **Revocation and deletion semantics** are unresolved even for organizational evidence — `heby_answer_source_evidence` opens its own record noting that retention, expiry and right-to-forget are deliberately undecided. Personal context cannot inherit that deferral; a person must be able to withdraw what they authorized, and the design must state what happens to everything derived from it.

## Dependencies

- **Identity** — a durable human identity distinct from membership and role; the binding this capability requires
- [26 — Personal Context Authority](26-personal-context-authority.md) — **the authority this capability reads through.** It owns admission, identity-bound read authorization, revocation and lifecycle; this record owns none of them
- **Individual Approval** — the constitutional category that exists in principle and has no runtime expression
- [09 — Director Memory](09-director-memory.md) — adjacent and organizational; must not absorb or be absorbed
- [10 — Knowledge Ingestion Engine](10-knowledge-ingestion-engine.md) — the ingestion discipline personal sources would need an authorized, identity-bound equivalent of
- [13 — Policy Engine](13-policy-engine.md) / [14 — Permission Engine](14-permission-engine.md) — where an identity-bound authorization model would live
- [18 — Observability Center](18-observability-center.md) — auditability of sensitive context use
- Heby — the surface that consumes it, and owns none of it
- Governance — the authority the Twin must never acquire, and never route around

## Deferment

**Intentionally deferred.** Two gates, not one:

1. **Prerequisite maturity** — identity, ingestion discipline, provenance and audit must be mature enough that personal context can be held with the same rigour organizational evidence now is.
2. **Its own security design and security gate** — the identity-bound authorization model does not exist and is not designed here. This is the harder gate, and it is the reason this record refuses to sketch one.

**No target phase is assigned. No phase number is invented here.** The [Capability Lifecycle](00-capability-lifecycle.md) assigns a roadmap slot at Stage 3 — Director Review — and listing a capability is explicitly *"documentation, not authorization"*. [23 — Director Digital Twin](23-director-digital-twin.md) records the same refusal for the same reason: scheduling a capability now, merely to make a roadmap look complete, is the opposite of a deferral.

## Promotion criteria

- Prerequisite areas above are mature, in particular a durable human identity independent of role and membership.
- **An identity-bound authorization model is designed and passes its own security gate** — not reusing tenant-scoped or role-based read authority. That model belongs to [26 — Personal Context Authority](26-personal-context-authority.md), so **26 is promoted before or with this capability, never after it**: a Twin admitted first would have to hold its own context, and would become the second source of truth this record forbids.
- Provenance model defined such that explicit, imported, derived and stale context remain structurally distinguishable through persistence and replay.
- Revocation and deletion semantics defined, including for anything derived from withdrawn material.
- Separation from [09](09-director-memory.md), [21](21-enterprise-system-map.md) and [23](23-director-digital-twin.md) explicit in the design.
- Computer Use boundary enforceable by mechanism, not by documentation.
- Director approval.
