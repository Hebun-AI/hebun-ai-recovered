# TRH-18 — The Model Is Told Every Bound It Is Held To — PRODUCTION-ACCEPTED / CLOSED

**ZERO schema · ZERO migration · ZERO new authority · ZERO new runtime · ZERO widening** ·
**Migration ledger 48/48, unmoved** · **Release `63a4ff3`** · **Suite 688/688** ·
**Predecessor** [TRH-17](hebun-trh17-model-selectable-record-work-closure.md)

TRH-17 closed with Turkish Rug House's Heby **PROPOSAL-CAPABLE** and **PROPOSAL-FILED: NO**. The
first real production attempt was made on 2026-09-06 at 18:14:52Z and it **failed**. This phase
found why, fixed it, and the second attempt — one attempt, same goal text — filed a pending
proposal.

    MODEL-SELECTABLE → RUNTIME-CONNECTED → LIVE-MODEL-ACCEPTED → PARSE-ACCEPTED
      → MANDATE-ADMITTED → PROPOSAL-FILED → HUMAN REVIEW REQUIRED
                                          ↑ and it stops here

---

## THE ROOT CAUSE

Invocation #1 reached the provider, the provider answered, and the answer was **refused by the
parser** — `state = 'selection-invalid'`. The row said *that* the response was not the contract and
could not say *which bound it broke*: `failure_code` was `NULL`, because on the parse-refusal path
the computed refusal reason was discarded one line after it was produced.

Underneath that diagnostic gap sat the substantive one. The parser enforces bounds the prompt never
stated:

| Parser-enforced | Stated in the prompt before TRH-18 |
|---|---|
| exactly the envelope's keys — none missing, none added | no |
| no prose before or after the object | yes |
| `reason` present, non-blank, ≤ 400 characters | no |
| record-work `title` present, non-blank, ≤ 120 characters, untrimmed rejected | no |
| nothing is trimmed, completed or repaired | no |

**A model could obey every instruction it was given and still be refused for a rule it was never
told.** That is not a containment property; it is a contract with a hidden half.

---

## THE FIX — TWO HALVES, NEITHER OF WHICH WEAKENS ANYTHING

**B · The instruction contract now states every parser-enforced bound relevant to the admitted
envelopes.** Both numbers are **interpolated from the released constants** —
`MAX_ORIGINATION_REASON_LENGTH`, and `MAX_WORK_TITLE_LENGTH` imported from the Work Authority —
never retyped. A literal would be a second copy of a number the parser owns, and the first change to
either side would leave the model told one bound and held to another with nothing failing to say so.

The prompt also now says plainly that a reply breaking any bound is **discarded whole**, and that a
model which cannot comply should **abstain**. Telling a model the rules is not permission to bend
them.

**D · A structured-output parse refusal persists its exact diagnostic code** in the existing
`failure_code` column. The value is a member of the closed `StructuredOutputRefusal` union Hebun
itself wrote — no model bytes, no provider sentence, no goal text and no fragment of the malformed
response can reach the column through it.

`failure_code` now carries **two** closed vocabularies, kept disjoint by `state`
(`selection-invalid` for a parse refusal; `not-dispatched` / `dispatch-failed` for connectivity).
No CHECK enumerates them: a storage constraint migrated in lockstep with two released modules would
eventually make an honest diagnostic **unwritable**, which is the one thing this column must never
do to the row it describes.

**What did not change:** parser validation, malformed-output handling (still reject, never repair),
defaulting (still none), retries (still none), the TRH mandate, candidate membership, Governance,
permits, Work Authority, Organization Authority, provider integrations, and the schema.

---

## THE TWO PRODUCTION INVOCATIONS

Production database `neondb`, system identifier `7675444875863894887`, migration ledger 48.
Turkish Rug House tenant `9947c78e-2080-4331-81c6-456cb4be7a96`, durable agent
`67f4460c-0d44-4ae7-a3ed-729c705e2609`. Both invocations were caused by the same human session and
the same goal text, and both are `transport = live`.

| | **#1 — PRE-FIX, FAILED** | **#2 — POST-FIX, SUCCEEDED** |
|---|---|---|
| invocation id | `17c68432-655c-4d5b-8b90-c6adc70fd157` | `fef09229-92ff-4e1f-91d6-6be1d5fa88cf` |
| created / finalized | 18:14:52.338Z / 18:14:54.840Z | 19:23:41.424Z / 19:23:43.967Z |
| running release | `22ce9fc` (READY 18:09:16Z) | **`63a4ff3`** (READY 19:19:04Z) |
| provider · model | claude · `claude-haiku-4-5-20251001` | claude · `claude-haiku-4-5-20251001` |
| provider request id | `msg_011Cene9iuW5MwXmYsvYezg6` | `msg_011CenjQ6oboRRh72vbjFhEp` |
| input / output tokens | 799 / 178 | **943** / 169 |
| **state** | **`selection-invalid`** | **`selection-valid`** |
| **failure_code** | **NULL** — the gap this phase closed | NULL — no failure occurred |
| filing_outcome | `not-attempted` | **`proposed`** |
| filing_refusal | NULL | NULL |

**The release boundary is not asserted, it is timed.** `22ce9fc` became the production target at
18:09:16Z and `63a4ff3` at 19:19:04Z. #1 ran 5m36s into the first window; #2 ran 4m37s into the
second. The Vercel production target is `dpl_HXUnTiDBQzpwJaG2NsgJVvMBXhWZ`, READY, whose
`meta.githubCommitSha` is `63a4ff3dfaa31f33a431db3ad1414b6abbd1703a`.

**The token delta is the prompt, and it is measurable.** Between the two invocations Turkish Rug
House created **no** artifact, **no** artifact revision, **no** recipient and **no** department, so
the rendered candidate block was byte-identical and the goal text was the same. The system
instructions grew from 2095 to 2716 characters (+621); prompt input tokens grew 799 → 943 (+144).
Nothing else in the request changed.

**`failure_code` on invocation #1 is NULL for ever.** There is no backfill and none is possible
without inventing history. NULL on a pre-TRH-18 row means *Hebun was not yet recording this* — it
does not mean no bound was broken.

---

## WHAT THE SECOND INVOCATION FILED

Exactly one new row in `heby_action_requests`, and it is Turkish Rug House's first.

| field | value |
|---|---|
| request id | `57f488cb-6359-491d-ac76-8125ae5857b7` |
| tenant | `9947c78e-…` — Turkish Rug House |
| proposer | **`agent`** / `67f4460c-…` — the durable Heby, not the human |
| created_by | `d5b496df-…` (`human`) — whose session caused the write |
| action_kind | `record-work` — the REGISTRY kind, not the model's alias |
| status | **`pending`** |
| scope | `organization-level` (`departmentScope`), target `organization/9947c78e-…` |
| title | *Revise Turkish Rug House Instagram draft to remove unsupported authenticity and selection claims* |
| evidence | one settled `organization` reference |
| origination_invocation_id | `fef09229-…` — **invocation #2, exactly** |
| approval / rejection fields | all NULL |

The proposal row was inserted at 19:23:43.949Z and the invocation finalized at 19:23:43.967Z — the
proposal exists *before* its provenance is finalized, which is the designed direction: provenance
must never be able to unmake an act it observes.

---

## THE MANDATE CEILING RAN

`agent_mandates` holds **exactly one** row for this tenant: revision **1**, `proposal_scope`
`{record-work}`, effective from 2026-09-06 08:58:02Z, `supersedes_mandate_id` NULL,
`updated_at` == `created_at`. **No revision was created and no scope was widened.**

The ceiling is not merely narrow, it is **unbypassable on this path**. Every agent-originated
proposal is written by `recordAgentOriginatedActionRequest`, and `mandateCeilingRefusal` has no
third answer: an unreadable authority refuses, an absent mandate refuses, and admission requires
`AGENT_ORIGINABLE_REGISTRY_KIND[alias] === actionKind` for some alias in the stored scope. **The
existence of the row is therefore proof the ceiling was consulted and admitted** — there is no path
that writes without passing it.

`send-external-communication` is not denoted by any alias in `{record-work}`, so `send` remains
outside this mandate. Production already carries the evidence that this refusal is live rather than
theoretical: invocation `36db5791-…` on the Hebun AI tenant records
`filing_refusal = action-outside-agent-mandate`.

**Model selection is not authorization.** The model chose an alias; the ceiling decided whether that
alias was admissible; a human still decides whether the act happens.

---

## NON-EFFECTS, MEASURED BY WINDOW

Across **all 60 production tables carrying `created_at`**, between the release becoming READY
(19:19:04Z) and 19:30:00Z, exactly three rows were written anywhere, in any tenant:

- `heby_origination_invocations` — 1 (invocation #2)
- `heby_action_requests` — 1 (the pending proposal)
- `user_session_contexts` — 2 (the Director signing in)

Every other table wrote **zero**, including `decision_records`, `governance_sessions`,
`action_permits`, `action_execution_attempts`, `work_items`, `work_artifacts`,
`work_artifact_revisions`, `integrations`, `integration_credentials`, `external_recipients`,
`departments`, `agents` and `agent_mandates`. The same window over **all 58 tables carrying
`updated_at`** moved only those same rows plus the sign-in credential.

`audit_log` is keyed on `occurred_at`: **zero** rows in the window, and the most recent audit event
anywhere in production is 2026-09-06 08:58:02Z — the mandate establishment, over ten hours earlier.

Turkish Rug House totals, after the ceremony: **0** permits, **0** execution attempts, **0**
departments, **0** recipients, **1** work item (created 2026-09-05, untouched), **4** decision
records (all predating), **1** pending action request. The Instagram draft named in Heby's stated
reason, artifact `aa96978d-…`, still has exactly **two** revisions, both from 2026-09-05. **No
revision 3 exists.**

    PROPOSED  !=  AUTHORIZED  !=  PERMITTED  !=  EXECUTED

---

## STATUS

| | |
|---|---|
| MODEL-SELECTABLE | **YES** |
| RUNTIME-CONNECTED | **YES** |
| LIVE-MODEL-ACCEPTED | **YES** — real provider, real model, real request id, real usage |
| PARSE-ACCEPTED | **YES** — `state = selection-valid` |
| MANDATE-ADMITTED | **YES** — revision 1, scope `{record-work}`, unbypassable ceiling |
| PROPOSAL-FILED | **YES** — one `pending` request |
| HUMAN-REVIEW-REQUIRED | **YES** — `pending`, every approval field NULL |
| GOVERNANCE-AUTHORIZED | **NO** |
| PERMITTED | **NO** |
| EXECUTED | **NO** |
| SUCCESSFUL | **NO** |

---

## WHAT THIS CLOSURE DOES *NOT* CLAIM

**The D half has no production row demonstrating it.** Invocation #2 parsed cleanly, so no
post-fix parse refusal has occurred in production and `failure_code` has never yet been written with
a `StructuredOutputRefusal`. That path is proven only by the local firewall — seven malformed
responses producing six distinct persisted codes against a real database, each asserting that no
proposal, permit, execution attempt, work item, decision or audit row moved. In production, the
fix's effect is visible as the **absence** of a second parse failure, which is evidence for B and
silence about D.

**The model's stated reason is not persisted.** The justification the Director read in the review UI
is returned by the server action and rendered once; `heby_action_requests` has no column for it. The
durable record carries the title, the scope and the evidence references — not the reason the agent
gave for choosing them. A human approving this proposal tomorrow would not see what they saw today.

**One ceremony is not a rate.** Two live invocations, one of each outcome, is the whole production
sample.
