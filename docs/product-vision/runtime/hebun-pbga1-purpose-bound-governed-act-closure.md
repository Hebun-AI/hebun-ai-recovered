# PBGA-1 — PURPOSE-BOUND GOVERNED ACT — CLOSED / PRODUCTION-ACCEPTED

**Release** `5ab5825` · **affordance fix** `d5f70fb` · **seam fix** `9b9bdd6`
**Migration 46 applied** · **Production ledger 45 → 46**, digest `c424a8cd7d0f1c9b48976b5c1c0860b3`
**Production cluster** `7675444875863894887` / `neondb`
**Deployment** `dpl_9ihiqfiB6FqcxeXR5r3L9obLPKBx` and successor, production, aliased `www.hebuntech.com`

---

## What Hebun can now do that it could not

A person approving a consequential action saw its mechanics and nothing about why the organization
was doing it. `heby_action_requests` carried `action_kind`, `target_ref`, `target_label`,
`expected_effect`, `consequences` and `evidence` — and no purpose. Its only reason columns were
`rejection_reason` and `revocation_reason`, both written *after* a refusal. `SendProposalInput` was
`{recipientRef, draftRef}` and nothing else.

Three proposals had sat undecided in production since 27–31 August, each reading
*"send-external-communication · Test Recipient · irreversible"* with nothing to say what initiative
they served.

    "A HUMAN DECLARED THAT THIS ACTION REQUEST SERVES THAT WORK ITEM."

That is the whole new truth. Nothing derived, matched, scored or inferred.

## The design decisions

**Direction, and why it is not a WEV referent.** WEV-1 answers *what is this work ABOUT*. An act is
not what work is about; it is something done in its service. So the column lives on the **request**,
owned by Action Authorization, which keeps owning the request and gains no authority over Work by
naming one.

**Purpose is not evidence.** Deliberately not in `heby_action_requests.evidence`. That column is
load-bearing — `action-preparer.ts` gates `evidenceSufficient` on the lifecycle of what it names, so
a `superseded` referent makes a proposal insufficient. A work item moving to `blocked`, being
retitled, or changing accountable human must never invalidate an authorization a person already
granted. Two meanings, two places.

    PURPOSE != EVIDENCE != PROGRESS != COMPLETION != AUTHORIZATION != NECESSITY

**Four columns, not one.** The truth is *a HUMAN declared*, and one nullable id cannot say who or
when. `heby_action_requests_human_purpose_declarer_chk` makes a non-human declarer a database error,
exactly as the released human-approver CHECK does three columns above it.

**The agent firewall is two independent mechanisms.** `recordActionRequest` (human) takes an optional
purpose written atomically with the insert; `recordAgentOriginatedActionRequest` has **no such
parameter** — the firewall is the shape of the call. The storage CHECK sits underneath it. An agent
may propose an act; it may not say what the organization is doing it for.

**Pre-decision only, and rebinding is refused.** `pending` is the authoritative predicate — the
released approved/rejected CHECKs key off `status`. It lives in the UPDATE's own WHERE clause, so a
concurrent approval cannot be raced past it. `unbound → A` allowed; `A → A` idempotent, writes
nothing; `A → B` **refused**.

---

## Production acceptance — measured

A human opened `/approvals`, selected the work item on an agent-proposed pending request, and
declared the purpose. **No approval, no rejection, no revocation, no permit, no execution, no
provider call.**

| Claim | Measured in production |
|---|---|
| Request still pending | `368d793d` — `status = pending` |
| Proposed by | **`agent`** — the firewall's strongest case: an agent-proposed act gained a human-declared purpose |
| Purpose resolves to the intended work | `purpose_work_item_id = 983d1cb2…` — *Hebun governed internal execution development* |
| Declarer type | **`human`** |
| Declarer identity | `d5b496df…` — the session's human, never a parameter |
| Declaration timestamp | `2026-09-03 08:46:47.361+00` — byte-identical to the surface's report |
| Row version | `1 → 2`, `updated_at` moved with it |
| Audit act | ONE `governance.action.purpose-declared`, `actor_type human`, entity `heby_action_request`, `source action-authorization`, `result committed`, `simulation false`, metadata carries `purposeWorkItemId` and `executed: false` |
| Approval surface | resolves **"Hebun governed internal execution development"**, `purposeUnresolved false`; the work item **id is not projected to the client** |
| Work inverse surface | one item — kind, target label, `pending`, proposed `2026-08-31T18:20:59.878Z`, purpose declared `2026-09-03T08:46:47.361Z`, `truncated false` |
| Recorded activity — a separate surface | 2 acts **on** the work row (`work.reference-declared` human, `work.recorded` system). The declared act appears in neither feed's other half |
| Other four requests | every purpose field **NULL**, `version 1`, `updated_at` unmoved — nothing backfilled |

**Non-effects.** Decisions 7 · sessions 7 · permits 2 · execution attempts 1 · executions 0 · WEV 1
(v1, unwithdrawn) · agent mandates 2 (`[]`, `['send']`, unmoved) · agent invocations 5 · integration
credentials 18. The declared request's `evidence` array is byte-identical to what it carried before —
two entries, unchanged. Work `declared_state` still `planned`, `version 1`.

**Schema, verified live:** four nullable columns; `FOREIGN KEY (tenant_id, purpose_work_item_id)
REFERENCES work_items(tenant_id, id) ON DELETE RESTRICT`; both CHECKs; the inverse index.

---

## Two defects found after release, and what they were

**`d5f70fb` — the affordance.** A Director selected the work and reported the *Declare purpose*
button still disabled. It was not: the shipped bundle carried `disabled: l || "" === n`, so
selecting armed it. What did not change was how it looked — armed and unarmed differed only by
`disabled:opacity-40` on already-muted text, beside a solid primary *Authorize* button. **A correct
predicate the operator cannot see is not a working control.** The predicate is byte-identical; the
two states now differ by border, weight and foreground, and the control names what it would record.

**`9b9bdd6` — one function, two databases.** Found while corroborating this acceptance.
`readPendingActionRequests` honoured `deps.getDb` for its own query and then called
`readWorkRegister(tenant)` with the tenant alone. A caller injecting a database got requests from
the injected handle and titles from the default resolver — and a purpose that was declared and
resolvable came back `purposeUnresolved: true`, which the surface renders as *"unknown, not
absent"*. **An UNKNOWN manufactured by the seam** is the class of untruth this capability exists to
avoid. Deployed behaviour was never wrong (the page injects nothing, so both halves already shared a
resolver); what was wrong is that the seam could not be truthfully exercised against an injected
database — which is exactly how acceptance reads production, and how it surfaced.

---

## What stays deliberately unavailable

- **Purpose is optional, and never mandatory.** A proposal without one is unchanged in every respect.
- **No backfill.** NULL means *no purpose was declared in this record* — never purposeless, unrelated
  to work, or invalid.
- **No inference.** Not from draft, recipient, conversation, department, Knowledge, WEV, agent or
  model output. A closed picker of in-service work is the only input.
- **No agent expansion.** Mandate scope, candidate builder, prompt, `parseAgentActionSelection` and
  `AGENT_ORIGINABLE_ACTION_KINDS` are untouched.
- **No Work lifecycle governance.** Ordinary state transitions remain the released direct human act.
- **A declaration is not a decision.** It creates no Governance decision, no permit, no execution;
  the surface control is styled apart from the authorize control for the same reason.

## Known baseline exceptions

Full suite at release: **658 passed, 3 failed, 661 total.** The repository-wide suite is not green,
and every PBGA-1-owned failure is gone. Each exception was measured at clean `a8859d6`:

| Failure | Class |
|---|---|
| `tests/hebycap1-flow/capability-truth.ts` | **PROVEN PRE-EXISTING PRODUCT DEFECT** — WORK-ACTIVITY-1 capability binding inconsistency: `/work-activity` declares `reachesProvider` with no capability binding. **Not fixed here.** |
| `tests/ama1-agent-mandate/bite-proofs.ts` | **PROVEN PRE-EXISTING** — identical signature at baseline. **Not fixed here.** |
| `tests/k2-flow/create-and-read-postgres.ts` | **HARNESS FLAKE** — an in-test `Promise.all` race on a unique index (`create-and-read-postgres.ts:239`). The runner is strictly sequential, so cross-test concurrency is excluded; nothing leaked during the run. Passes 4/4 isolated. |

**PRE-EXISTING RELEASED TEST DEBT RE-ANCHORED DURING PBGA-1** — test-only, zero runtime change, not
PBGA-1 implementation: the g2 and k2 audit-sink reader allowlists never learned about
SUBJECT-ACT-HISTORY-1's `subject-act-history-read.server.ts`, and four human-only CHECK censuses
never learned about WEV-1's `work_evidence_references_human_declarer_chk`.

**GIA-1, WEV-1, WORK ACTIVITY V1 and SUBJECT ACT HISTORY V1 remain CLOSED / PRODUCTION-ACCEPTED.**

---

**PBGA-1 CLOSED / PRODUCTION-ACCEPTED.**
