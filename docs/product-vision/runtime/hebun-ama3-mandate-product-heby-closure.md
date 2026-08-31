# AMA-3 — Agent Mandate Product Surface + Heby Grounding · Closure

**Era III, first program, third milestone.** The Agent Mandate Authority becomes reachable by a
human, and Heby can say what it is for.

**Baseline:** `main` at `b1f5748`, equal to `origin/main`, 0 ahead / 0 behind. Migration ledger
**40 → 40 (unchanged)**.

---

## 1 · What AMA-3 is, in one sentence

> A human can read an agent's recorded ceiling, record or revise it through the released writer, and
> Heby can report its own — and none of the three grants the agent anything.

Before this milestone the authority was **live and unreachable**: AMA-1 built it, AMA-2 made it
refuse real proposals, and every mandate in existence had been written by a test or a script.

## 2 · The pins

```
MANDATE     != PERMISSION
MANDATE     != AUTHORIZATION
MANDATE     != EXECUTION AUTHORITY
MANDATE     != CAPABILITY AVAILABILITY
NO MANDATE  != UNLIMITED MANDATE
UNAVAILABLE != NO MANDATE
NO MANDATE  != EMPTY MANDATE
SEEDED      != DURABLE
RENDERING A CEILING  != ENFORCING ONE
GROUNDING ON ONE     != ENFORCING ONE
RECORDED MANDATE     != DERIVED OBSERVATION
PROPOSAL-ENFORCED    != PRODUCTION-ACCEPTED
```

---

## 3 · Existing `/agents` truth classification (Phase 0, measured before anything was edited)

| Region | Class | Owner |
|---|---|---|
| Durable agent identity ceremony | **AUTHORITATIVE** — canonical Postgres | `features/agent-identity` |
| Agent Outcome Observation | **DERIVED** from released records | `features/agent-outcome-observation` |
| Agent Evaluation | **DERIVED purely** from the observation | `features/agent-evaluation` |
| Improvement hypotheses + filing | **AUTHORITATIVE** rows, Governance-undecided | `features/agent-improvement-hypothesis` |
| Agents Truth Surface / registry workspace | **SEEDED · IN-MEMORY · SIMULATED** | `features/agent-crud`, `features/workforce` |

The page was **already** truth-classified by UI Phase 25B and AGENT-ID-0.1: the durable ceremony
renders first, the seeded catalog renders last, every seeded region carries a provenance badge, and
the page header reads *"36 seeded agent definitions · in-memory registry · runtime simulation"*.

**So Phase 6 required no correction, and none was invented.** The finding is recorded as a
measurement, not as work. What AMA-3 added is a firewall that pins it: render order (identity →
mandate → seeded), the seeded modules' inability to reach a mandate, and the mandate surface being
typed on `DurableAgentIdentityRecord` so a seeded definition is **unrepresentable** as a mandate
subject rather than merely filtered out.

---

## 4 · The authoritative product surface

`AgentMandateCard`, rendered directly **below** the identity ceremony and **above** everything
derived. Order is the truth claim: an agent exists, then the organization records what it is FOR,
and only then is there anything to observe about what it proposed.

Six truth classes are kept visually and semantically apart:

| Class | Rendered as |
|---|---|
| Authoritative identity | the ceremony card above |
| Effective mandate | `AUTHORITATIVE` + `REVISION n`, purpose in prose, `MAY PROPOSE` |
| Mandate history | collapsed `<details>`, each revision badged `superseded` |
| **Known absence** | *"No mandate recorded … a measured absence, never a permission"* |
| **Authority unavailable** | *"UNAVAILABLE is not NO MANDATE"* — and **no form is offered** |
| Seeded definitions | untouched, below, provenance-badged |

**Progressive disclosure.** The default view answers the two questions a human has — what is this
agent for, and what may it propose. Mandate ids, Governance decision and session ids, `effective_from`
and the supersession pointer live in `<details>`; CMD-V3 settled that `<details>` layers truth
without hiding it.

**The unavailable state offers no form, deliberately.** A ceiling nobody could read cannot be
responsibly revised: the writer's concurrency token would be a guess.

**Not exposed:** credentials, secrets, provider data, invented permissions, inferred capabilities,
department, manager, dead schema, or `authority_ceiling`.

---

## 5 · The human workflow

`establishAgentMandateAction` — a thin server action in the released `/agents` boundary, in exactly
the shape SIA-3.1's filing action already established.

**It is transport, not authority.** It resolves the tenant and calls `establishAgentMandate`. It
holds no INSERT, no table import, no database handle, no drizzle import and no gate of its own — so
it cannot drift from the rules it fronts, and AMA-1's *"exactly one module writes a mandate"* census
is unchanged.

**The client may send exactly five values:** agent id, purpose, proposal scope, justification, and
the revision it was shown. Every other field is derived server-side — tenant, actor, actor type,
Governance authority, decision id, session id, revision ordinal, predecessor, `effective_from`,
audit rows. They are **unrepresentable** here, not filtered downstream.

**The scope selector renders `MANDATE_SCOPE_VOCABULARY` itself** — no literal action kind appears in
the component, so the UI cannot drift from what the writer and the database CHECK admit. It is not
re-validated in the action: `canonicaliseMandateScope` refuses an inadmissible scope **whole**, and a
second opinion is the one that drifts.

**Withdrawal is an empty scope.** No boolean, no lifecycle, no separate action — the same one
transition, confirmed separately because *"this agent may now propose nothing"* is a consequence a
human must see before it happens.

---

## 6 · Authority and concurrency, proved against a real database

| Case | Result |
|---|---|
| No Governance authority yet | `no-governance-authority`, nothing written |
| Another organization's human, with their own Governance authority | `agent-unresolvable` — indistinguishable from an agent that never existed |
| The Governance authority | records revision 1 |
| Stale observed revision | `stale-mandate-revision` — refused, never merged, effective revision untouched |
| Revision | new row at revision 2; **revision 1 byte-identical**, still readable |
| Withdrawal | revision 3, empty scope |
| Throughout | `agents` row **byte-identical**; 0 permits, 0 execution attempts, 0 proposals, 0 permissions, 0 role_permissions; `authority_ceiling` still unwritten |

The UI reports refusals **truthfully**: each `AgentMandateRefusal` code maps to its own sentence, and
`persistence-unavailable` is never rendered as a permission denial.

---

## 7 · Heby grounding

A **new source class, `agent-mandate`** — the seventeenth — declared on **Command only**, which is
also where `/heby` resolves.

**Why not the existing `agents` class.** That class says of itself that it does not carry *"what it
is for, what it may do … OUTCOME != MANDATE"*. The mechanical reason is stronger: `agents` is
**DERIVED** (`authoritative: false`) because it carries recomputed counts, and
`SourceResolution.authoritative` is ONE boolean per class — so, in its own words, *"a class cannot
assert one standing and cite under another"*. A mandate is a durable row a human wrote under a bound
Governance decision. Filing it under a derived class would give the one thing on that surface a human
actually **decided** the standing of a recomputed number.

**Why not `workforce`.** Chartered for the humans an organization is made of. `RUNTIME AGENT !=
WORKFORCE IDENTITY`.

**Read-only, and provably.** The projection lives inside the mandate authority (G6C's rule: a
projection belongs to the authority that owns the facts). It contains no insert, update, delete or
transaction, and it imports the **read seam module** — never the barrel, which re-exports
`establishAgentMandate`. Banned by exact specifier, since the legitimate import contains the barrel
path as a substring.

**Three answers, kept apart:** an effective mandate, a measured absence, an unreachable authority.
The absence states its consequence — *"an agent with no mandate may propose NOTHING"* — because a
sentence reaches a model alone.

**Wording.** Every item carries `AGENT_MANDATE_NON_CLAIM` with the record rather than trusting a
prompt. Heby may say *"my current mandate allows me to propose X"*; a test asserts that no item's
machine-derived prose contains "authorized to", "permission to", "may execute", "without approval",
"grants", "entitled to" or "can send" — run over what the source **claims**, with the denial
constants stripped first, because denying those words is their job.

The recorded **purpose** is operator-authored prose and travels in `content`, never `detail` —
E2-6's rule, since `detail` flows into Heby's own validated response body.

---

## 8 · Schema and migration truth

**ZERO.** No table, no column, no enum value, no migration. Ledger **unchanged at 40**, pinned as an
exact count. `agents` still has exactly its two identity writers; `permissions` and
`role_permissions` still have zero.

---

## 9 · The census inverted a second time, and was relaxed neither time

AMA-1 measured *"exactly three modules can see a mandate, and none is a proposal path"*. AMA-2 made
it four. AMA-3 makes it **eight**, each named: three product files and one grounding consumer.

**The enforcement claim did not move.** AMA-2's firewall proves separately, against the single seam,
that exactly one module reads a mandate **to constrain an act** — and the four new readers are each
asserted unable to reach the proposal writer, the request table or the ceiling gate.

> **RENDERING A CEILING != ENFORCING ONE.** They were the same sentence only while nothing could
> display a mandate.

Two directory-wide bans became **name-scoped exemptions**: `src/app`/`src/components` (three product
files) and `heby-answer` (the answer flow). Exempting the *directories* would have let any page in
the product, or any file in Heby's answer path, acquire a ceiling of its own.

---

## 10 · Validation

- **Targeted:** `tests/ama3-mandate-product/` — `mandate-grounding.ts` (pure, injected seams),
  `product-firewall.ts` (structural), `product-postgres.ts` (real PostgreSQL, disposable).
- The unavailable state is proved against a real database by renaming `agent_mandates` away while
  every other table stays healthy — the state a surface that merged the two would render as *"this
  organization declined to bound its agent"*.
- **Regressions:** AMA-1 and AMA-2 firewalls, Heby integration contracts, Heby runtime, E2-5, E2-8,
  G6D source-truth, Phase 25B/25C agents truth.
- Typecheck clean. Lint zero errors on owned files.
- **The first full suite found three real failures and all three were fixed, not worked around** —
  AGENT-ID-0.1's boundary firewall and bite-proofs, and CMD-V3's `StateBlock` consumer census. A
  replacement full suite followed.

**The AGENT-ID-0.1 repair is the one worth reading.** Its firewall asserted the `/agents` boundary
*"must not reach `decision-authority`"*, and its own comment explained why Knowledge's boundary
does: *"ratification is a governance act"*. Recording a mandate is a governance act in exactly the
same way — AMA-1's design is that Governance authorizes every transition, inside the mandate
writer's transaction. So the boundary moved from **narrower than the released precedent** to **equal
to it**, and the claim was repaired rather than deleted: the reach is now asserted to exist AND to
run **only through the mandate authority**, proved by re-walking the import graph with that module
cut out. The other three forbidden modules stay unreachable.

> **GOVERNANCE AUTHORIZES A MANDATE != GOVERNANCE OWNS A MANDATE.** AMA-1's census that no
> Governance module names `agentMandates` passed unchanged throughout.

**One guard was re-aimed, again.** A `/unlimited|unrestricted|anything|any action/` ban on the
absent-mandate sentence failed on its own honest clause — *"refused before anything is written"*. The
ban is now on phrases that would assert a permission. Third recurrence of the same shape in this
program; see §12.

---

## 11 · Product verification (Phase 9)

Verified against a **local** dev control plane (`hebun_r1` at `127.0.0.1`), signed in as a real
human, with a real durable agent and two real mandate revisions recorded through the released
writers. Local database migrated 39 → 40 for the check; **no production system was touched**.

Observed on the authenticated `/agents` surface:

- Header: *"36 seeded agent definitions · in-memory registry · runtime simulation"*
- **Durable agent identity** (canonical) → **Agent mandate** → derived observation/evaluation →
  hypotheses → **seeded catalog last**
- Mandate card: `Heby · IN SERVICE`, `AUTHORITATIVE`, `REVISION 2`, purpose in plain prose,
  `MAY PROPOSE: SEND`, and the caveat *"Inside this list a proposal may be FILED. It is not
  approved, not permitted and not executed by being inside it — a human still decides every one."*
- `Governance binding and record identifiers` and `1 superseded revision — never edited, kept exactly
  as authorized` both collapsed
- `Revise this mandate` form present, scope offered as the released vocabulary only

No visual claim suggests mandate = execution permission. No seeded data appears live.

---

## 12 · Learnings this milestone contributes

1. **The class you are tempted to extend may be the wrong one for a mechanical reason.** `agents`
   looked like the home for a mandate; `authoritative` being one boolean per class settled it.
   Standing, not subject, decided the boundary.
2. **A ban on a WORD keeps failing on the sentence that DENIES the word.** Third time in this
   program — AMA-1 on the writer, AMA-2 on a refusal name, AMA-3 on an absence statement. The
   settled remedy: ban the phrase that makes a claim, pin the denial by equality, and scope the
   guard to what the module asserts.
3. **A directory ban and a file ban are different guarantees.** Two directory-wide bans had to
   become name-scoped exemptions; exempting the directories would have silently opened them.
4. **Not every phase that touches a surface owes it a correction.** The seeded catalog was already
   honestly labelled. AMA-3 measured it, pinned it with a firewall, and changed nothing — which is
   the correct outcome, and the one a "we touched /agents so we should tidy it" instinct would have
   spent the milestone on.

---

## 13 · Exact remaining scope for AMA-4

Not selected, and not implied by this closure.

1. **Production acceptance.** No mandate row exists in production. Nothing here has been proved
   against the real control plane, and local evidence never establishes it.
2. **A refusal a human reads in the inlet.** All three AMA-2 mandate refusals still map through the
   inlet's generic branch, naming the reason in the detail string. Whether the operator surface
   should distinguish them is a product decision nobody has taken.
3. **Mandate visibility outside `/agents`.** Live Map, Command and `/approvals` show agents and
   proposals and say nothing about ceilings.
4. **A second agent, agent selection, agent authentication, mandate templates, mandate policy,
   automatic mandate derivation** — all still out of scope, and none is opened by this.

```
AMA-1 = RELEASED
AMA-2 = RELEASED
AMA-3 = RELEASED

Agent Mandate Authority:
  durable                = YES
  Governance-bound       = YES
  proposal-enforced      = YES
  human-product-reachable = YES
  Heby-grounded          = YES
  production-accepted    = NO

ERA III = OPEN · AGENT MANDATE AUTHORITY = ACTIVE PROGRAM · NO AMA-4 SELECTED
```
