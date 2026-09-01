# WORK-2 — Post-Acceptance Privacy Hardening · Model Provider Human-Label Disclosure

**Era III, third program (Organizational Work), post-acceptance hardening of a closed milestone.**
WORK-2 is and remains CLOSED / PRODUCTION-ACCEPTED. This document records a narrow data
minimization change made *after* that acceptance, in response to something the acceptance itself
revealed.

**Entering state:** WORK-2 release `4626328`, closure `4d4bfbe`, production ledger **42**,
Organizational Work Authority LIVE, Heby `work` grounding LIVE in the Command workspace.

**Authority expansion: ZERO.** No schema, no migration, no writer, no Governance decision type, no
action kind, no permit, no mandate, no execution authority, no provider capability, no workspace,
no Heby source class. **Production ledger remains 42.**

---

## 1 · The finding

WORK-2's production acceptance corroborated every factual claim Heby made — and surfaced one
consequence that no test could have surfaced, because it is a property of the *production identity*
rather than of the code.

HLR's released legibility expression is:

```
coalesce(users.display_name, users.name, users.email)
```

The production identity has **neither** `display_name` **nor** `name`. So the "readable name"
WORK-2 puts in front of a model is an **email address**.

```
previous provider-facing fallback   the human's email address
disclosure risk                     that address leaves Hebun's process and is sent to the
                                    configured third-party model provider on every Command answer
authority defect                    NONE
```

It was not a resolution failure and not an authority failure. The read was Governance-gated,
tenant-scoped, fail-closed, eligible, and the authoritative identifier travelled beside it. What
changed at WORK-2 was the **audience**: before, that string appeared only on two server-rendered
pages the organization's own authorized human was reading. After, the same string is composed into
a request bound for an external provider.

```
UI LEGIBILITY       != MODEL PROVIDER DISCLOSURE
AUTHORIZED TO READ  != NECESSARY TO DISCLOSE
```

Being entitled to read a field internally is not a reason to send it outside the process.

---

## 2 · The decision

**The provider-facing label is a NAME, or it is nothing.**

```
display_name present   -> display_name
else name present      -> name
else                   -> "name unavailable"
```

The email address is **never** the provider-facing fallback. The authoritative internal identifier
is **preserved** beside the label in every case, because WORK-2 uses it for reference integrity and
withholding it would be a separate decision this hardening was not authorized to take.

**The released UI legibility policy is deliberately unchanged.** `/director/organization` and
`/director/work` keep `display_name → name → email`. Showing an organization's own authorized human
their own address is not a disclosure, and blanking those pickers would have been a worse product
for no privacy gained. The two questions are not the same question:

| Read | Question it answers | Address fallback |
|---|---|---|
| `resolveHumanLabels` | what should **our own surface** call this person? | **yes** — released, unchanged |
| `resolveHumanNames` | what may be **sent outside this process** about them? | **no** |

---

## 3 · Where the boundary lives, and why there

There was no existing provider-disclosure or data-minimization owner to extend.
`heby-runtime/trust-boundary.ts` classifies **how material may influence Hebun** (instruction vs
data); it says nothing about what may leave. So the smallest legitimate boundary was implemented.

It lives **in Identity**, beside the read it differs from:

```
src/features/auth-runtime/human-label-read.server.ts
    LABEL_EXPRESSION         coalesce(display_name, name, email)   ← released, untouched
    HUMAN_NAME_EXPRESSION    coalesce(display_name, name)          ← new
    resolveHumanLabels()  ─┐
    resolveHumanNames()   ─┴─> resolveByExpression()   one gate, one predicate, one query
```

Both exported reads delegate to the **same** private resolver, so the Governance gate, the tenant
predicate, the soft-delete exclusion and the `MAX_RESOLVABLE_LABELS` bound cannot drift apart
between them. The only difference is the projected expression.

**Identity remains the sole authority for human identity and legibility.** The Work Authority
remains authoritative for accountable-human reference. Heby gained **no** identity read of its own —
it receives a projection, exactly as it receives every other fact. Nothing new was created: this is
one additional projection over rows Identity already owns, reaching no row and no column the
sibling read could not already reach.

### The distinction is field provenance, never a string test

The disclosable value is chosen by **selecting different columns**. There is no `@` test, no regex,
no local-part split, no `isEmail` anywhere in either module — asserted, in both.

A heuristic would be wrong in both directions: a human legitimately named `someone@example.com`
would be erased by it, and a `name` column containing an address would sail past it. The column
that produced the value is the only honest signal, and only Identity holds it.

### Unknown remains unknown

When Identity has no name — none recorded, id unresolvable, caller unauthorized, or Identity
unreachable — the row is **absent from the map**, and the work projection says exactly
`name unavailable` and shows the identifier. Four different situations, one honest answer, because a
model must not be able to tell them apart and the truth is the same in all four: Hebun does not know
what to call this person.

Nothing is derived. Not a local-part, not initials, not a username, not a role, not a department
nickname. `senoltr@gmail.com` does not become `senoltr`, `Senol` or `Şenol`.

---

## 4 · Scope — one path, measured rather than assumed

The Heby answer path's **real import graph** (547 modules, transitively from
`model-answer.server.ts`) was walked and searched for every module whose executable code names an
email. Exactly one reads a human's address as a label: `human-label-read.server.ts`, and its only
grounding consumer is the Work Authority's projection. `TenantContext` carries no email at all, and
no other of the eleven `heby-*source.server.ts` modules resolves a human by any route.

```
affected Heby source(s)                  work  (heby-work-source.server.ts)
workspace                                Command, and only Command
other equivalent live disclosure paths   NONE FOUND
```

`authority-delegation.server.ts` and `canonical-read/actor-resolution.ts` also floor at an email —
both are **product-surface reads outside the Heby grounding graph**, and both are deliberately
untouched. Widening to them would be the broad PII program this hardening is not.

---

## 5 · The released firewall, retained and narrowed

WORK-2 repointed HLR's claim to: *exactly ONE authority-owned projection resolves a human label for
grounding, and it is named.* That claim is **kept and made stricter**, not weakened:

1. no module under `features/heby*` holds a legibility read — Heby receives, it does not read;
2. exactly ONE grounding projection reaches Identity legibility, named exactly;
3. **and that one may reach only `resolveHumanNames`** — a grounding projection reaching the
   address-floored product label now fails, as does a second projection reaching for either.

The HLR expression census legitimately moved from **1 to 2** and is pinned at exactly 2, each
written once, with the name expression asserted to be the label expression **minus the address
floor** — so the two reads can never disagree about what a person is called. A third would still
fail. No other pin was touched; no general pin-debt cleanup was begun.

---

## 6 · Validation

```
targeted        tests/work2-provider-disclosure/provider-bound-name.ts    PASS  (new)
                tests/work2-provider-disclosure/bite-proofs.ts            PASS  (new, 6/6 bit)
                tests/hlr-human-legibility/legibility-postgres.ts §8      PASS  (real SQL)
regressions     work2-heby-work-grounding/work-grounding                  PASS
                work2-heby-work-grounding/reachability-and-firewall       PASS
                hlr-human-legibility/legibility-firewall                  PASS
                work1-organizational-work/{work-firewall,work-postgres}   PASS
typecheck       tsc --noEmit                                              clean
lint            eslint                                                    0 errors (14 pre-existing warnings)
final suite     634 passed / 0 failed / 634 total                         exit 0
```

**Where each claim is proved, and why there.** That an email-only human resolves to *nothing* is
proved against a **real database**, in the HLR postgres suite, against the three fixtures it already
held (`display_name`, name-only, email-only) — a structural assertion can see that `users.email` is
absent from an expression, but only real SQL can show the map comes back without them. That whatever
Identity declines to name arrives at the provider as `name unavailable` is proved by driving the
**real answer flow** and reading the **whole composed request** — not only its evidence field, since
a disclosure through the instruction, question or history would be exactly as much of a disclosure.

**Six mutations, six bites.**

| | mutation | defended by |
|---|---|---|
| D1 | the disclosable expression floors at the email again | postgres |
| D2 | a nameless row is admitted into the map instead of left out | postgres |
| D3 | the work projection reaches for the product label | pure |
| D4 | an unnamed human is given an invented name | pure |
| D5 | the accountable identifier is dropped once a name exists | pure |
| D6 | a released page adopts the provider-safe read | pure |

Two expectations were corrected during the work because the assertion that *actually* fires is not
always the one that reads best — D5 trips an earlier identifier assertion, and D6's import alias
keeps the local name so the *adoption* check catches it rather than the *usage* check. An expectation
that names the wrong assertion is a bite-proof that has not been read.

---

## 7 · Known limitations

- **The address is still what Hebun knows.** This hardening changes what is *disclosed*, not what is
  *stored*. `users.email` is unchanged and still floors the two product surfaces. The cheapest real
  remedy remains a `display_name` on the production identity — a Director action, not a code change.
- **The internal identifier is still disclosed.** WORK-2 uses it for reference integrity and this
  hardening deliberately preserved it. Whether an opaque internal uuid should also be withheld from
  a provider is a **separate Director decision** and was not taken here.
- **Only the Work grounding path is covered.** Two product-surface reads outside the Heby graph
  still floor at an address (§4). They disclose nothing externally today; if either ever becomes
  provider-facing, this same boundary is what it must consume.

---

## 8 · Production acceptance · **PASS**

**Release commit:** `88d2711`. **Deployed and observed commit:** `88d2711` — **identical**, read from
the Vercel REST API's `meta.githubCommitSha` (deployment `dpl_4meoEiZPJCQncSohUizS41f27C7E`, state
`READY`, target production), because `vercel inspect` does not surface git metadata.

**Production migration ledger: 42 → 42.** No migration exists or was needed.
Database identified by `pg_control_system().system_identifier` **7675444875863894887**, database
`neondb` — the same production control plane WORK-1 and WORK-2 were accepted against.

### The condition the hardening exists for is still live in production

```
production identity   display_name  ABSENT
                      name          ABSENT
                      email         present  (never printed; local-part length 7)
```

So this is not a hypothetical: the released product label still resolves to an address for this
human, and the provider-facing path is the only thing that changed.

### The probe, and where it looked

One probe, run against the **production control plane** through the **released answer flow**, with
the `generate` seam captured — so the **actual provider-bound `ModelGenerationRequest`** was
inspected rather than sent. **Zero provider calls, zero billable inference, zero rows written.**

> *Who is accountable for Hebun Era III development?*

The acceptance requirement is **email absent from provider-bound work grounding**, not merely absent
from a model's prose. Reading the final answer would have proved the weaker claim. Every check below
is a boolean over the **entire serialized request** — not only its evidence field, because a
disclosure arriving through the instruction, the question or the history is exactly as much of a
disclosure.

```
work record reference present      true    work-item/<id>
work title present                 true    "Hebun Era III development"
authoritative identifier present   true    d5b496df-…-17672b82dd10
label reads `name unavailable`     true
EMAIL ADDRESS present              FALSE
any `@` present                    FALSE
email local-part present           FALSE
```

The composed clause, verbatim:

```
accountable human: name unavailable (d5b496df-588c-49c5-9cc2-17672b82dd10).
```

```
email absent from provider-bound grounding     YES
guessed name absent                            YES  (local-part hunted in every casing: absent)
authoritative identity reference preserved     YES
```

### Non-effects — measured by the window, not by a remembered baseline

Every `public` table carrying a `created_at` was asked the same question at once: what did you gain
since a timestamp comfortably before the probe? The list is **derived from the catalogue**, so no
table can be forgotten.

```
tables scanned                     58
tables that GREW in the window     NONE
audit_log rows in the window       NONE
work row version                   1 -> 1
work row updated_at                unchanged
ledger before / after              42 / 42
```

No Work mutation, no audit row attributable to Work, no Governance decision, no action request, no
permit, no execution attempt, no Knowledge mutation, no mandate mutation, and **no external provider
call of any kind** — including the model inference, which was deliberately captured rather than
performed.

### What was NOT executed, and why it is recorded rather than waved through

**The live product probe through `/heby` in the deployed Command workspace was not run here.** It
requires an authenticated Director session, which is a Director action and not one this milestone
can perform. WORK-2's three acceptance probes were run that way, by the Director.

It is recorded as **available and not required for this acceptance**: the stated criterion is about
the provider-bound *request*, which was measured directly against production data through the
released composition path. A prose answer would have added a weaker observation at the cost of a
real billable disclosure to a third party.

---

## 9 · Status

```
released                    88d2711, origin/main parity verified
production acceptance       PASS
WORK-2 POST-ACCEPTANCE PRIVACY HARDENING     CLOSED / PRODUCTION-ACCEPTED
```

WORK-2 itself remains CLOSED / PRODUCTION-ACCEPTED, unchanged. **No successor milestone is
authorized. WORK-3 is not authorized. No further privacy or security program is authorized.**
