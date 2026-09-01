# WORK-2 — Heby Organizational Work Grounding · Production Acceptance

**Era III, third program (Organizational Work), second milestone.** Heby answered questions about
this organization's real recorded work, in production, through a live provider, and every material
claim it made was corroborated against the authoritative row.

**Release commit:** `4626328`. **Deployed and observed commit:** `4626328` — **identical**.
**Production migration ledger:** **42 → 42.** No migration exists or was needed.
**Release validation:** 632 passed / 0 failed / 632 total, at `4626328`. **Not rerun here.**

**WORK-2 IS CLOSED / PRODUCTION-ACCEPTED,** with limitations recorded in §7 and one consequence in
§5 that is a Director decision rather than a defect.

---

## 1 · IMPLEMENTED, CONNECTED, PRODUCTION-VERIFIED — three different words

```
IMPLEMENTED         the projection, the class, the workspace entry, the substitution exist
CONNECTED           the class reaches the MODEL REQUEST — proved end to end at release
PRODUCTION-VERIFIED a human asked a live provider, in production, and the answer was corroborated
                    against the authoritative row rather than believed
```

WORK-2 is all three. The third is what this document adds.

The now-proven production path, in full:

```
Organizational Work Authority  (work_items, WORK-1)
  -> authority-owned Heby work projection   (heby-work-source.server.ts)
    -> `work` source resolution              (18th class)
      -> Command workspace                   (and only Command)
        -> model context                     (grounding evidence line)
          -> live provider answer            ("Model-assisted · live provider")
            -> human-observed product response
```

---

## 2 · The three probes, and what corroborated them

All three run by the Director through the real `/heby` Command workspace against the deployed
release. Each was checked against production **after** the fact; none was taken on trust.

### Probe A — "What are we currently working on?" · **PASS**

Heby answered: one recorded work item, **Hebun Era III development**, declared active as of
`2026-09-01T14:23:21.224Z`, department **Engineering**, accountable human named readably, declared
state **underway** — and added, unprompted, that this is a *declared* state, that Hebun did not
observe or verify the work, and that **no progress metrics, health status, priority or due date is
recorded**.

| claim | authoritative production state |
|---|---|
| one work item | `work_items` count = **1** |
| title | `"Hebun Era III development"` — exact |
| declared active | `declared_state = active` |
| as of 14:23:21.224Z | `created_at = 2026-09-01T14:23:21.224Z` — exact |
| Engineering | `department_id e40866a8-…`, name `Engineering`, lifecycle active |
| accountable human | `human d5b496df-…`, and the label re-derived (§5) |
| "the only work item carried" | count 1, register not truncated |
| no progress/health/priority/due date | **those columns do not exist** — a truthful absence |

### Probe B — "What is the declared state of Hebun Era III development?" · **PASS**

Heby answered **active — declared underway**, and stated that this is a declared state, *"not an
observed or verified one. Hebun did not watch this work and cannot confirm what actually happened."*

`declared_state = active`. The word "underway" is the released meaning string for `active`, carried
into context by the projection — not invented. **No claim of verification, success or completion
appears anywhere in the answer.**

### Probe C — "What work is currently declared blocked?" · **PASS**

The sharpest test in the milestone, because the honest answer is a stated absence.

Heby answered that the grounding context carries **no work items declared as blocked**, that the
only item is declared active/underway, and — explicitly — *"I cannot invent blocked work items that
were not provided in the grounding context."*

Corroborated: in-service work with `declared_state = 'blocked'` = **0**. The state census is
`active: 1` and nothing else. **The negative answer is true.**

And it is **correctly bounded**. Heby said the *grounding context* carries no blocked work. It did
**not** say "nothing in the company is blocked" — the generalization it must never make, because
Hebun only knows what was recorded.

```
ABSENCE OF RECORDED BLOCKED WORK != PROOF THAT NOTHING IN THE COMPANY IS BLOCKED
```

That distinction survived a live model call, unprompted.

---

## 3 · Non-mutation — zero drift, measured against a pre-probe baseline

A baseline was captured at `2026-09-01T15:22:27Z`, **before** the Director ran any probe. Compared
after:

| | baseline | after | |
|---|---|---|---|
| `work_items` | 1 | 1 | unchanged |
| acceptance row `version` | 1 | **1** | unchanged |
| acceptance row `updated_at` | 14:23:21.224Z | **14:23:21.224Z** | **not mutated** |
| `audit_log` | 38 | 38 | unchanged |
| `decision_records` | 6 | 6 | unchanged |
| `heby_action_requests` | 4 | 4 | unchanged |
| `action_permits` | 1 | 1 | unchanged |
| `action_execution_attempts` | 1 | 1 | unchanged |
| `knowledge_nodes` | 2 | 2 | unchanged |
| `agent_mandates` | 2 | 2 | unchanged |
| `work_artifacts` | 3 | 3 | unchanged |

**Tables drifted: 0.** And the stronger window check: **zero audit rows of any entity type** were
recorded since the pre-probe instant, and **zero work rows** were mutated in it.

**Three live model answers changed nothing.** That is what a read-only grounding milestone is
supposed to look like, and it is measured rather than asserted.

Production ledger remains **42**, prefix verdict `converged`.

---

## 4 · Truth semantics, preserved under a live model

Every one of these survived a real provider call, in the model's own words:

```
RECORDED WORK      != OBSERVED ACTIVITY     "Hebun did not observe or verify the work"
DECLARED STATE     != VERIFIED STATE        "not an observed or verified one"
COMPLETE           != SUCCESSFUL            no completion claimed; no success vocabulary used
ACCOUNTABLE HUMAN  != AUTHORIZED EXECUTOR   attribution only; no authority implied
WORK ITEM          != WORK ARTIFACT         no artifact was confused with a work item
ABSENCE OF BLOCKED != NOTHING IS BLOCKED    bounded to the grounding context, explicitly
```

Heby also volunteered *"the declaration is mutable"* — a property of the record it was never asked
about, carried by the projection and correctly restated.

**This is the result of carrying the semantics as DATA rather than as prompt prose.** The provenance
sentence, the per-item non-claim and each state's meaning string all reached the context, and the
model repeated them because they were facts in front of it rather than instructions behind it.

---

## 5 · The readable-human boundary, and what production revealed

WORK-2 is the first milestone in which a human's readable label enters Heby's model context. That
was authorized and is recorded in the release closure. Production revealed the concrete form it
takes, and it is sharper than "a name":

**The label resolved to an EMAIL ADDRESS.** Re-derived from the legibility authority against
production: the accountable human's `users` row has **`display_name` NULL and `name` NULL**, so the
released `coalesce(display_name, name, email)` expression falls through to the email.

Stated precisely, because it matters:

- **This is not a WORK-2 defect.** The expression is HLR's, released and unchanged; the owner picker
  has rendered the same value since that milestone. WORK-2 changed no label semantics.
- **The resolution was legitimate.** Gated on this organization's Governance authority, tenant-scoped,
  restricted to an id the register already named, and the human satisfies all six eligibility
  conditions. No roster was created and nobody could be enumerated.
- **The authoritative identifier was preserved.** `d5b496df-…` travels beside the label in every
  grounding item. The model chose to print only the readable value, which is a summarization
  decision, not a loss — the identifier was in the context.
- **And the consequence is new:** that value now leaves the process on every Command-workspace
  answer, into a third-party model provider. Before WORK-2 it appeared only in two server-rendered
  pickers.

**Recorded as a Director decision, not closed here.** The cheapest remedies are a display name on
the identity, or a projection that prefers a non-email label and says "name unavailable" otherwise.
Neither is WORK-2's to choose, and neither blocks acceptance.

---

## 6 · Acceptance classification

```
PROBE A (current work)          PASS   every material claim corroborated
PROBE B (declared state)        PASS   declared != verified preserved verbatim
PROBE C (blocked work)          PASS   negative answer TRUE and correctly bounded
AUTHORITATIVE CORROBORATION     PASS   title, lifecycle, state, department, human — all exact
HUMAN LEGIBILITY                PASS   re-derived through the released authority
NON-MUTATION                    PASS   zero drift, zero audit rows, zero work mutations
LEDGER                          PASS   42, converged
GROUNDING PATH                  PASS   authority -> projection -> class -> workspace -> model ->
                                       live provider -> human

WORK-2                          CLOSED / PRODUCTION-ACCEPTED
```

---

## 7 · Known limitations — not failures

- **Work grounding exists only in the Command workspace.** By design; scope is exact.
- **Work state is human-DECLARED, never observed.** Hebun has no observer and no verifier.
- **Heby has no work mutation authority.** It can describe work and can change nothing.
- **Positive blocked-work grounding has NOT been production-observed.** No work is currently blocked,
  so only the *negative* case was exercised in production. The positive case is proved by released
  tests against the real projection. It closes for free the first time work is legitimately blocked.
- **One work item is a narrow acceptance sample.** Multi-item ordering, the 200-item bound and the
  truncation notice are proved by tests and not by production.
- **No outcomes, progress, priority, risk, health or due dates exist** — no authority holds any.
- **No agent has responsibility over work.** An agent cannot even be recorded as accountable.
- **No GitHub, Knowledge or work-artifact relationship exists yet.** Work references a department and
  a human, and nothing else.
- **The readable label is currently an email** — see §5.

---

## 8 · Continuity — unchanged by this ceremony

```
WORK-3:                             NOT AUTHORIZED / NOT STARTED
Pin-debt cleanup:                   NOT AUTHORIZED / NOT STARTED
APF (Agent Plurality Foundation):   DEFERRED
Agent #2:                           NOT JUSTIFIED / NOT CREATED
Governed Internal Action:           DEFERRED
GitHub PR reachability:             STRANDED / not started
ASA:                                BLOCKED / DEFERRED
```

Production ledger **42**. Checkout and production **converged**.
