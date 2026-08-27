# APP-2 — Decision Surface Truth Repair and Disclosure Layering: Release Closure

**Status:** engineering/release record. Not runtime state, not an authority.
**Released implementation:** `da7d242bb12bfd18e010a243046152ad45546078`, authored 2026-08-27.
**Parent:** `8387866fd7cbaa96c79948f12761d77e27fe6acc` (A1a closure).
**Tag:** none — convention **measured**, not assumed. No commit in the preceding twenty carries one.
**Production deployment:** `dpl_2LG724NDie5kRTXPDuNdfY4XuSQ9` — target **production**, state **READY**,
`meta.githubCommitSha` = `da7d242bb12bfd18e010a243046152ad45546078`, ref `main`, repo
`Hebun-AI/hebun-ai-recovered`. Aliased at `www.hebuntech.com`, `hebuntech.com`,
`hebun-ai-recovered.vercel.app`, the project alias and the `git-main` alias; the live alias lookup
for both custom domains resolves to this deployment id.
**Lifecycle reached:** designed · implemented · verified · **released** · **deployed** · **production-accepted**.
**Predecessors:** R3A, R3A.1 (action authorization and the proposal inlet); R3B (permit-bound
execution); APP-0, APP-1 (earlier stale-claim sweeps on this surface);
`hebun-a1a-proposer-attribution-closure.md`; `hebun-ops-p1-operations-preparation-surface-closure.md`.

> **Record provenance, stated so it cannot drift.**
> · Repository state, release commit, authority map, projection changes, firewall, bite-proofs,
>   validation and ledger state — **independently verified** by this process against the released tree.
> · Deployment identity, state, deployed SHA and alias resolution — **independently verified** via
>   the Vercel API.
> · Everything in §5 — **Director-observed** in the production UI after deployment. This process did
>   not authenticate to production, did not render the page, and performed no production mutation.
>   **How the page LOOKS is not something this process verified**; its assertions are structural and
>   over pure functions.
> · The INT-3 failure in §4 — **independently reproduced** by this process in a pristine detached
>   worktree at the release parent.

---

## 1. What this closes

`/approvals` went live carrying a real, irreversible, pending action — and three of its regions were
describing a page that no longer existed:

- **Evidence & Provenance** said *"No decision item is connected, so no evidence is shown"* while the
  connected request durably stored **two** evidence references the whole time.
- **Consequences** said *"No decision item is connected, so no stated consequences are shown"*,
  directly beneath a card rendering real ones.
- **Execution Handoff** said *"this surface starts nothing"* — on the page that holds `Execute now`.

A fourth was found during implementation, in the same class: the marker **`No trigger here`**.

None of these was a wording problem, so none was repaired by rewording. The discovery that preceded
this phase had called the situation "a presentation problem, not a truth problem"; that was wrong,
and correcting it set the phase order — **truth first, layering second**, because reordering a false
statement leaves it false.

## 2. The evidence was never missing — it was discarded

`select()` already returned the whole row, so `evidence`, `proposed_by_actor_type` and `side_effect`
were in hand and dropped by the mapping. Projecting them added **no query, no seam and no
authority**: the reader stopped discarding what it already held.

Evidence is now a **three-state** projection, because *"the proposal attached none"* and *"the stored
value could not be interpreted"* are different facts and an empty array says the first while meaning
either. `attached` · `none` · `unreadable`. A partially-parseable set is **`unreadable`, never a
silently truncated `attached`** — presenting a smaller evidence set as if it were the whole one is
the more dangerous of the two errors in front of an irreversible decision. A missing lifecycle reads
`unknown`, never assumed settled. Nothing is resolved, enriched or dereferenced.

## 3. Independently verified

**Authority map — APP-2 became none of them.** One request writer, one permit writer (the decide path
only), execution in its own feature, Governance resolved only in decide/revoke and **never** in the
reader. The pending-request seam has three readers — `/approvals`, Command and Heby, all since
CMD-B1 — and the firewall pins that **census** rather than a monopoly that never existed. Three
surfaces reading one seam is the property worth defending; three surfaces growing three stores is not.

- **NEW_AUTHORITY = NO** · **NEW_EVIDENCE_STORE = NO** · **NEW_EXECUTION_PATH = NO**
- **SCHEMA_CHANGED = NO** · **MIGRATION_ADDED = NO** · **LEDGER = 36**

**Proposer actor class projected.** A1a made `proposed_by_actor_type` truthful and nothing had ever
read it, so a human authorized without being shown who originated the request. The class is now
projected and badged, visually distinct for any non-human class, so the first agent-originated
proposal is legible rather than indistinguishable from a person's.

**The actor ID is deliberately NOT projected into the client surface.** This view crosses into a
`"use client"` component, so every field on it is serialized to the browser; a uuid is not a name, no
identity display seam exists to make it one, and carrying it would ship an unrendered internal
identifier. This is a **stated deviation** from the phase brief, which offered either the id or a safe
display representation: data minimization won, and it is one line to reverse if that judgement is
overruled.

**Consequences truth repair.** The structural region **defers** to the live card rather than
duplicating it. One decision fact, one source — a second authoritative-looking list could drift from
the one a human actually authorizes.

**Execution-handoff truth repair.** Corrected, with the semantics restated verbatim and pinned:
authorizing issues a bounded, revocable, single-spend permit and does **not** execute; execution is a
second, separate, explicit human act; spending a permit is not success; provider acceptance is not
delivery; and what remains genuinely unconnected is the handoff **into Operations**. Nothing was
activated and no availability changed.

**Digest-to-lock presentation.** Raw hex rendered beside the reference it binds reads as a peer field
rather than an integrity value. Digests now read as what they mean — *Draft revision locked*,
*Recipient endpoint locked* — derived from a `/Digest$/` **suffix convention**, not a per-action
allow-list that the next action kind would escape. Raw values stay one disclosure away, beside
`payloadDigest` and a line saying what actually binds: they are integrity evidence, **not secrets**,
and an operator checking a binding by hand must still be able to.

**Server-side payload binding unchanged.** A permit still binds
`boundPayloadDigest: request.payloadDigest`, computed server-side over the whole payload — asserted
from the writer, not from this phase's own files — and no surface file may compute or assign a
binding digest. The irony the discovery found is now resolved in the right direction: the digest that
binds is disclosed alongside the two that do not, and none of them is a primary decision field.

**Structural truth layered, not hidden.** Every structural region sits inside one **closed**
disclosure whose **summary itself** names each unavailable subsystem — prepared review material,
standalone evidence instances, recommendation producer, chronological decision history, Operations
handoff, and the Inspector's absent selection. A reader who never opens it still learns what is not
connected. The decision itself is never behind a disclosure, and that is asserted by **containment
rather than position**: every `<details>` block is deleted from the card and consequences, both
controls, proposer, evidence and locks must survive.

**Human authority untouched, proved from applied DDL** (not merely the schema module):
`heby_action_requests_human_approver_chk` constrains `approved_by_actor_type` to `'human'`;
`action_permits_human_authorizer_chk` constrains `authorized_by_actor_type` to `'human'`; the
proposer column still carries **no** CHECK, so a real agent may propose one day.

### Validation record

- **APP-2 firewall PASS** — sixteen sections.
- **APP-2 bite-proofs 12/12 bit** — verified-applied to disk, restored in `finally`, asserted
  byte-identical, bounded at five minutes with a timeout reported **VOID rather than counted**, and
  matched against the *intended* failure reason.
- **Targeted suites PASS** — APP-0, APP-1, A1a firewall + bite-proofs, R3A, R3A.1 boundaries, R3A.1
  Postgres, CMD-B1, CMD-V3, OPS-P1.
- **Typecheck clean.** **Lint 0 errors**, with only the documented pre-existing warnings in four
  unrelated files.
- **Fresh full suite: 507 passed / 1 failed / 508 total**, run from the exact final tree.
- **Residue byte-identical** — whole-tree hash unchanged across the full suite, which re-executes the
  mutating bite-proofs; migrations and journal identical to the parent.

### Two released pins repaired, not weakened

R3A.1's Postgres pin required all four canonical-payload keys in `parameters`, because that is where
all four were rendered. Its **stated intent** — *"a human is not asked to approve a binding they
cannot read"* — still holds, so the pin now asserts the intent directly: the union of `parameters`
and `locks` equals the four keys (nothing dropped), which half each key lands in, and that the lock
carries the exact server-frozen digest. That is **strictly stronger** than what it replaced — the old
form would have passed a build that silently discarded a lock. Two Command fixtures gained the new
required fields.

### What the phase's own tests caught

Recorded because a passing suite would have hidden all three:

- The firewall **failed against a correct repair**: assertions read raw source, and every repair here
  carries a comment *quoting* the false sentence it replaced. `said()` now strips comments. The same
  trap recurred later in a hand-written verification script.
- An assertion that *"no disclosure precedes the consequences"* **failed against correct code** — the
  locks disclosure legitimately precedes them. Position was the wrong question; containment is the
  right one.
- **A bite-proof survived.** Inserting *"Hebun suggests you approve this"* left the absence sentence
  intact, so nothing bit. The product was fine; the test was weak. The firewall now forbids advisory
  language across every surface file.

## 4. Known pre-existing failure — carried, not cleared

**`tests/int3-google-connection/bite-proofs.ts` FAILS.**

Its M9 mutation trips a **message-less assertion** at `google-transport.ts:188`, so the expected
reason never reaches the output and the bite-proof cannot report why it failed.

- **Reproduced at the pristine parent `8387866`** in a detached worktree, by this process.
- **Failure form unchanged** between that reproduction and the release run.
- **APP-2 modified no INT-3 or Google path** — proved by the release diff itself:
  `git diff 8387866..HEAD` matching `int3|google` is **empty**.
- The release did **not** fix, hide, suppress, relabel or route around it.
- It is a **known pre-existing released defect**, and a real one: a test that cannot state its own
  failure reason is a weakened guard.
- **APP-2 itself remained verified.**

**The full suite is NOT green. It is 507 passed / 1 failed / 508 total**, and this record does not
restate that as 508/508. No other subsystem was made green in order to release this one.

## 5. Production acceptance — Director-observed

Observed by the Director in the production UI after deployment. **This process did not render the
page and does not independently attest to its appearance.**

- `/approvals` shows exactly **one** pending consequential action, presented first.
- Action `SEND-EXTERNAL-COMMUNICATION`, classification **IRREVERSIBLE**, side effect
  `CONSEQUENTIAL_MUTATION`.
- Proposer badge: **PROPOSED BY HUMAN**.
- Target recipient visible; exact draft reference visible —
  `work-artifact/a45229f8-9776-4e7e-bbb7-9e92a7fe3a2f@1`.
- Integrity values are **no longer primary decision fields**: the surface reads **Draft revision
  locked** and **Recipient endpoint locked**, with raw values behind **Show the integrity values**.
- **Evidence & Provenance shows the two real stored sources** —
  `external-recipient/487c64be-e498-4a23-9efd-7664b53c0705` and
  `work-artifact/a45229f8-9776-4e7e-bbb7-9e92a7fe3a2f@1` — both rendered as **settled**.
- Real consequences are visible **before** the decision controls.
- The UI states Heby never authorizes or executes the action, and the control states that authorizing
  does not execute — it issues a bounded, revocable permit.
- **ISSUED PERMITS: None issued.**
- Structural substrate remains visible in the collapsed summary *"How authority works, and what is
  not connected"*, which **explicitly names** what is unavailable rather than hiding it.
- Decision Inspector still truthfully reports it has no selectable item.
- The three stale denials are **gone**.

**APP_2_PRODUCTION_ACCEPTED = YES** — the live pending action is primary; proposer attribution,
stored evidence and real consequences are visible; target and exact revision remain visible;
integrity values read as locks with raw values as secondary disclosure; authorization is visibly
distinct from execution; no permit exists; unavailable substrate stays declared; the stale denials
are gone.

## 6. Non-mutation and human authority

**AUTHORIZED = NO · PERMIT_ISSUED = NO · EXECUTED = NO · SENT = NO.**

The Director clicked none of *Authorize this action*, *Refuse*, *Execute* or *Revoke*. This process
performed no production mutation of any kind; its only production contact was read-only deployment
API calls and one unauthenticated `GET` confirming `/approvals` returns `307 → /login`.

Request `b52ef028-28be-495d-a78f-55d0106e1a17` remains **pending review**.

> Prepared ≠ authorized. Authorized ≠ executed. Executed ≠ successful.

**APP-2 changed presentation and projection only. It did not change decision or execution
authority.** The human-supremacy constraints it would be easiest to assume it touched are exactly the
ones it provably did not.

## 7. Final truth ledger

| | |
|---|---|
| DESIGNED | **YES** |
| IMPLEMENTED | **YES** |
| VERIFIED | **YES** — firewall PASS, 12/12 bit, byte-identical residue, typecheck + lint clean, 507/508 fresh |
| RELEASED | **YES** — `da7d242…`, pushed, remote converged 0/0 |
| DEPLOYED | **YES** — `dpl_2LG724ND…` production READY, deployed SHA independently verified, both custom aliases resolving to it |
| PRODUCTION_ACCEPTED | **YES** — Director-observed (§5) |

NEW_AUTHORITY = **NO** · NEW_EVIDENCE_STORE = **NO** · NEW_EXECUTION_PATH = **NO** ·
AGENT_RUNTIME_CREATED = **NO** · GOVERNANCE_EXPANDED = **NO** · SCHEMA_CHANGED = **NO** ·
MIGRATION_ADDED = **NO** · LEDGER = **36** · TAG = **NONE**

AUTHORIZED = **NO** · PERMIT_ISSUED = **NO** · EXECUTED = **NO** · SENT = **NO**

KNOWN_PREEXISTING_FAILURE = `tests/int3-google-connection/bite-proofs.ts`

## 8. Remaining limitations

- **No chronological decision-history read.** Records are written; no read over them exists here.
- **No recommendation producer.** The absence is now *defended* — the firewall forbids advisory
  language across the surface — not merely stated.
- **The Decision Inspector has no selectable live item.** It remains an honest empty panel, now
  behind disclosure rather than occupying a primary row.
- **The INT-3 bite-proof defect remains open** (§4), untouched by this phase.
- **Payload-minimization debt may remain on other client-crossing view fields.** APP-2 withheld the
  proposer actor id; it did not audit every other view that crosses the boundary, and OPS-P1 recorded
  the same class of debt on its own surface.
- **A future agent proposal will need stronger actor identity presentation.** The badge distinguishes
  the actor CLASS today. When a real agent identity exists, a human authorizing an agent-originated
  irreversible action will need to know *which* agent, on whose authority, and that needs an
  authoritative identity seam that does not exist.
- **Validation is structural plus pure-function execution.** No component was rendered by any suite;
  production appearance is Director-observed only.

## 9. Closure boundary

APP-2 made a surface stop contradicting itself. It projected three columns already being read,
re-presented two integrity values as what they mean, and put the explanation of the act behind the
act instead of in front of it. It added no authority, no store, no execution path, no schema and no
migration, and it left the human-only approval and authorization constraints exactly where it found
them.

The lesson worth keeping: **a surface's claims age against the system underneath it.** Every one of
these sentences was true when written, and each was falsified not by an edit to the sentence but by a
capability shipping elsewhere — R3A connected a queue, R3B added an execute control, `/send` began
storing evidence. Honest prose is not a one-time property; it is a claim with a maintenance cost, and
a phase that ships a new capability owes a pass over what the rest of the product still says about
its absence.
