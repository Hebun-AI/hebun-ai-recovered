# TRH-19 — Why The Agent Proposed It Is Now Durable — PRODUCTION-ACCEPTED / CLOSED

**Migration 49 · production ledger 48 → 49 · digest `3054a933444257110870a773d5afe4ce`** ·
**Release `d8cc947` · deployed `dpl_594NSKsiF5iwMrnvvCTXMNZoTEUa`** · **Suite 691/691** ·
**Predecessor** [TRH-18](hebun-trh18-model-contract-and-parse-provenance-closure.md)

TRH-18 proved Turkish Rug House's Heby can file a proposal. It also recorded, in its own closure,
what the ceremony had exposed: the reason the agent gave lived exactly as long as one server-action
response. The origination computed `chosen.reason`, handed the inlet a title and a scope, and
dropped it. A Director who reloaded `/approvals` could see **what** was proposed and not **why**.

    MODEL INVOCATION != AGENT PROPOSAL != PROPOSAL RATIONALE
      != GOVERNANCE JUSTIFICATION != EXECUTION

---

## THE DISCOVERY DECISION, AND WHY IT WAS NOT ASSUMED

The phase began as discovery with the solution deliberately unfixed — *"do not assume the answer is
a new database column."* Six options were compared against repository reality, and three were
refused by released code rather than by preference:

- **The canonical payload** is refused by its own module. `canonical-payload.ts` states that the
  argument schema admits scalars and fails closed on unknown keys, so *"a credential, a token, a
  nested object, or free model prose is structurally unable to reach this function."* Folding a
  rationale in would also change `payload_digest` — the act's identity, the dedup key, and the
  thing a human's approval binds to.
- **The evidence array** carries `{sourceClass, recordRef, lifecycle}` — a reference to a row the
  tenant owns. Prose would need a fabricated `recordRef`, the one thing its contract forbids.
- **`decision_records.justification`** is the human's words at decision time, NOT NULL, and the
  Governance audit explicitly refuses to copy it. Different author, different act, different time.

`reasoning_traces`, `working_memories`, `learning_sessions`, `policies.rationale` and
`approvals.summary` were all measured: **zero rows in production, and `reasoningTraces` has no
reference anywhere outside `src/db/schema/`**. Reviving dead schema to avoid a migration would have
created a second, unowned source of truth.

**Option B was selected because the rationale is a property of the PROPOSAL.** It explains this act,
it is read beside this act, and it outlives the model call. The invocation table owns one sentence
about one CALL and its contract forbids storing what the model said. One truth, one owner.

---

## WHAT WAS BUILT

**Schema.** `heby_action_requests.proposal_rationale text`, nullable, no default, **no index** —
nothing queries by it. Two CHECKs:

| constraint | rule |
|---|---|
| `..._proposal_rationale_chk` | `null or char_length(btrim(...)) > 0` — blank is unrepresentable |
| `..._agent_rationale_chk` | `null or proposed_by_actor_type = 'agent'` — only an agent's proposal may carry an agent's rationale |

**There is deliberately no maximum-length CHECK**, and that was measured rather than preferred: the
bound lives in the parser that admits the value (`MAX_ORIGINATION_REASON_LENGTH`), and **no
maximum-length CHECK exists anywhere in this schema** — while `char_length(btrim(x)) > 0` is the
house convention in nineteen places. A second numeric bound in SQL would be a copy of a number this
table does not own, migrated on a different schedule from the module that does.

**Threading.** `parseAgentActionSelection` → `chosen.reason` → the AGENT entry point of each inlet →
`recordAgentOriginatedActionRequest` → `insertActionRequest` → the column. One parse, one value. It
is not re-validated, not regenerated, not summarized, and it is never the raw provider response.

**Both admitted kinds carry it.** `record-work` and `send`, on identical terms, because the released
architecture already made rationale action-kind-independent: `reason` sits on all three arms of
`AgentActionSelection`, and one writer serves both inlets. There is no `record_work_rationale`.

---

## THE HUMAN-PATH FIREWALL — THREE LAYERS, NOT ONE

A human must not be able to record *"Heby said this because…"*.

1. **No parameter exists.** `recordActionRequest` and both human inlet entry points have none, and
   no client-crossing input type gained a field. The firewall is the SHAPE of the call, exactly as
   PBGA-1 made the agent path unable to declare a purpose.
2. **The insert gates on the resolved pair**, not on the argument: the value is written only when
   the server-derived proposer is an agent.
3. **The database refuses it.** Proven live, not asserted — a direct `UPDATE` setting a rationale on
   a human proposal is rejected, and so is a blank one, and neither changed the stored value.

---

## IT IS NOT PART OF THE ACT

The digest was **recomputed** with the released `digestCanonicalAction` from kind, tool, target and
payload alone — a rationale-free input set — and equals the digest the writer stored. It is
therefore reproducible without the rationale, which is what "not an input" means.

Behaviourally: proposing the identical act again with a **different** reason is still refused
`already-pending`, no second row is created, and the existing rationale is not overwritten.
**A NEW RATIONALE IS NOT A NEW ACT.**

---

## IMMUTABLE BY CONSTRUCTION

One INSERT and three UPDATEs touch this table, enumerated from disk. `decide-action-request` sets
decision columns; `declare-action-purpose` sets purpose columns. Neither can reach this one, and no
later-rationale seam was added. Proven by running one: declaring a purpose bumps `version` 1 → 2 and
leaves the rationale byte-identical.

---

## PRODUCTION

The Director ran the released `platform:migrate` ceremony at a TTY — the only path, and it refuses
piped stdin by design, so it is not something this session could perform.

| measured | value |
|---|---|
| cluster / database | `7675444875863894887` / `neondb`, PostgreSQL 18.6 |
| ledger | **48 → 49**, canonical files 49, journal 49 |
| convergence | `verifyCanonicalMigrationPrefix` → `{"status":"converged","applied":49,"digest":"3054a933444257110870a773d5afe4ce"}` |
| checkout digest | `3054a933444257110870a773d5afe4ce` — identical |
| column | `proposal_rationale`, `text`, nullable, no default |
| constraints | both CHECKs present, predicates exact |
| indexes | 8, all pre-existing — none is a rationale index |

**Deploy order was not a preference.** The read seam selects the new column, so deploying before
migrating would have broken the surface. That was proved rather than assumed: against a database at
ledger 48 the released seam returns `{"status":"unavailable","reason":"read-failed"}`, and with the
column `{"status":"read"}`. The migration therefore preceded the push.

### The migration changed no organizational truth

Across **all 60 production tables carrying `created_at` and all 58 carrying `updated_at`**, in every
tenant, since the last pre-ceremony measurement: the only rows written anywhere are **4 session
contexts and 1 auth credential** — the Director signing in. Zero proposals, decisions, Governance
sessions, permits, execution attempts, work items, artifacts, revisions, Knowledge, integrations,
credentials, recipients, departments, agents or mandates. The latest `audit_log.occurred_at`
anywhere is still `2026-09-06 08:58:02Z`, the mandate establishment.

Turkish Rug House's totals are byte-identical to the TRH-18 closure: 1 request, 4 decisions, 0
permits, 0 execution attempts, 1 work item, 0 departments, 17 audit rows, 2 invocations, mandate
revision 1.

**Migration 49 changed the schema and the migration ledger. That is the entire list.**

---

## THE HISTORICAL PROPOSAL — RATIONALE UNAVAILABLE

`57f488cb-6359-491d-ac76-8125ae5857b7` — still `pending`, `version 1`, `updated_at` unchanged at
`19:23:43.958485Z`, both decision ids null, proposer `agent`, invocation `fef09229…`.

**`proposal_rationale` is NULL, and stays NULL.** Zero rows anywhere in production carry a rationale.
There was no backfill and none is possible: the reason a Director read in the UI on 2026-09-06 was
rendered from a server-action response and never stored. Reconstructing it from a screenshot, the
goal text, the invocation, the model or a closure document would be manufacturing history.

NULL means **a rationale was not durably recorded**. It does not mean the agent gave none, that the
reason was blank, or that a human filed it.

The surface says exactly that. `/approvals` renders the block only for agent proposals — a human one
shows no empty slot — and a null renders as **"Proposal rationale unavailable"** with the denial
adjacent: *"That is what the record says — not that the agent gave no reason."*

Read back from production through the released seam at schema 49:

```
STATUS=read
REQUEST=57f488cb-6359-491d-ac76-8125ae5857b7
  actionKind        = record-work
  proposedByActor   = agent / Heby
  proposalRationale = null
```

---

## SECURITY AND GOVERNANCE

- **Model-controlled text entering persistence** was already true — the record-work `title` in
  production is model-authored. What is new is bounded: non-blank, ≤ the parser's bound, a field of
  a closed envelope.
- **Rendered, never interpreted.** Escaped by React; `dangerouslySetInnerHTML` appears nowhere in
  this repository; the value is not editable and is fed back nowhere.
- **No prompt, no raw response, no provider error, no credential** can reach the column — none of
  them reaches the parser.
- **Tenant isolation** holds in both directions, measured.
- **RATIONALE != AUTHORIZATION.** No decision predicate reads it. It does not prefill, seed or
  populate the Governance justification, which a human types at the decision; a `LIKE` probe
  confirms the rationale text appears in no `decision_records.justification`. Creating it minted no
  permit and executed nothing.

---

## TESTS

Three new suites: a Postgres suite over ten sections, a source firewall over eight, and bite proofs
— **7 mutations bit, 1 tolerated control accepted, 0 void**. The two that matter most are the edits
a reviewer would wave through: folding the rationale into the canonical payload (which silently
rewrites the act's identity) and dropping the proposer gate on the insert.

The first full run was **631/691**. All 60 failures were classified individually rather than
bulk-repinned: 30 ledger COUNT pins, 12 enumerated-LIST pins, 5 DIGEST pins recomputed with each
file's own mechanism, and 14 downstream bite proofs. **Three were strengthened rather than bumped:**

- `a1a-flow` and `app2-decision-truth` banned any CHECK from *mentioning*
  `heby_action_requests.proposed_by_actor_type` — a proxy for the real invariant. TRH-19's CHECK
  mentions it and constrains something else entirely. Both now enumerate the exception by name and
  read its predicate, so a CHECK that really closed the proposer column still fails.
- `pbga1-purpose-bound-act` matched the agent path's insert call exactly — five arguments. It now
  asserts the **purpose slot is literally `undefined`**, which is what it always meant.

Second full run: **691 passed, 0 failed.** Typecheck clean, lint 0 errors.

One prose corruption was introduced by the count pass and caught before commit: a comment reading
*"TRH-10 authored migration 48"* had been bumped to 49. TRH-10 authored 48.

---

## STATUS

| | |
|---|---|
| DESIGNED | **YES** — six options compared, three refused by released code |
| IMPLEMENTED | **YES** |
| TEST-PROVEN | **YES** — 691/691, 7/7 bites |
| MIGRATED | **YES** — 49, converged, digest matched |
| RELEASED | **YES** — `d8cc947`, `HEAD == origin/main` |
| DEPLOYED | **YES** — `dpl_594NSKsiF5iwMrnvvCTXMNZoTEUa`, READY, aliases assigned |
| ROUTE-EXPOSED | **YES** — `/approvals` auth-gated `307`; the released read seam returns the historical proposal from production at schema 49 with `proposalRationale = null` |
| DIRECTOR-OBSERVED | **NO** — no authenticated render has been observed |
| PRODUCTION-ACCEPTED | **YES** — for what this phase claims: the schema, the read and the honest unavailable state. **No production proposal carries a rationale yet.** |

---

## WHAT THIS CLOSURE DOES *NOT* CLAIM

- **No production rationale exists.** The non-null path is proven only against real databases in the
  suite. Proving it in production needs a new live Heby proposal, which is a Director gate and was
  deliberately not spent here.
- **Abstention reasons remain transient.** A `kind: "none"` reply still carries a reason and there is
  no proposal to attach it to. No abstention persistence authority was invented.
- **`origination_invocation_id` and the admitting mandate are still unrendered** on `/approvals`.
  Separate gaps, named in the TRH-19 discovery, untouched here.
- **The raw model response remains non-durable**, by construction and by firewall.
