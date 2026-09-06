# TRH-14 — Turkish Rug House Heby Has a Mandate — CLOSED / PRODUCTION-ACCEPTED

**One mandate row, one Governance decision, one session, two audit rows — and nothing else** ·
**ZERO schema · ZERO migration · ZERO new authority · ZERO permit · ZERO provider** ·
**Migration ledger 48/48 converged, unmoved** · **Deployed SHA `ec16599`** ·
**Predecessor** [TRH-13](hebun-trh13-route-acceptance-closure.md)

**This is the phase where Turkish Rug House's agent stopped being bounded by nothing.** TRH-13 closed
with the product naming its own gap on the page the Director read: *"No mandate recorded."* An agent
in service with no ceiling may, under AMA-2's released enforcement, propose **nothing at all** — every
proposal refuses `no-agent-mandate` before anything durable is written.

    MANDATE RECORDED              !=  PROPOSAL FILED
    PROPOSAL ALLOWED BY CEILING   !=  PROPOSAL STRUCTURALLY VALID
    PROPOSAL FILED                !=  GOVERNANCE AUTHORIZED
    AUTHORIZED                    !=  PERMITTED
    PERMITTED                     !=  EXECUTED
    EXECUTED                      !=  SUCCESSFUL

---

## The mandate, measured from production

| | |
|---|---|
| mandate id | `88a1ff38-01a4-436b-8d64-b8883147410e` |
| tenant | `9947c78e-2080-4331-81c6-456cb4be7a96` — Turkish Rug House |
| agent | `67f4460c-0d44-4ae7-a3ed-729c705e2609` — the durable Heby, in service |
| **`mandate_revision`** | **1** |
| **`supersedes_mandate_id`** | **null** — the first mandate this organization has ever recorded |
| **`proposal_scope`** | **`["record-work"]`** — length exactly 1 |
| **`send`** | **ABSENT** |
| established by | `human` `d5b496df…` — the Director |
| `effective_from` | 2026-09-06T08:58:02.620Z |
| purpose | **249 bytes / 245 chars, byte-identical to the approved text** |

> "Heby serves Turkish Rug House by preparing organization-grounded operational and marketing work —
> drafts, revisions and proposals — for a human to review and decide on. It proposes; it never
> decides, publishes, or acts outside this organization."

### The UI caveat the Director raised was correct, and it mattered

The Director warned that the *"Revise this mandate"* form below the authoritative card offers
checkboxes for **both** `send` and `record-work`, and instructed that the authoritative scope be read
from production rather than inferred from that form.

**Measured: `proposal_scope = ["record-work"]`. `send` is absent.** The revision form's checkboxes
are an input affordance listing the full released vocabulary — `MANDATE_SCOPE_VOCABULARY`, which *is*
`AGENT_ORIGINABLE_ACTION_KINDS` re-exported — not a display of what was recorded. The authoritative
card and the database agree; the form is neither wrong nor authoritative.

---

## The Governance binding

| | |
|---|---|
| decision | `2dfce841-97d4-4ce0-82b8-35c954cc9fa0` |
| session | `0551c098-d881-4b9a-96ea-d67934fde9bd` — matches the mandate row's `governance_session_id` |
| domain | **`agent-mandate`** |
| subject | `agent_mandate` / `88a1ff38…` — **the mandate row, not the agent** |
| decision | `approve` → **`agent-mandate-bounded`** |
| actor | `d5b496df…` — the Director |
| lifecycle | `recorded` |

Evidence carried on the decision row:

```json
{"agentId":"67f4460c-…","proposalScope":["record-work"],"mandateRevision":1,
 "supersedesMandateId":null,"authorityFromBootstrapDecisionId":"7303974e-…"}
```

**The subject is the mandate, not the agent.** A decision bound to the agent would mean "we decided
something about Heby"; bound to the mandate revision it means "we decided *this exact ceiling*" —
and a later revision gets its own decision rather than overwriting the meaning of this one.

The outcome word is **`agent-mandate-bounded`**, not `approved`. A ledger row read years from now
must not suggest an agent was granted anything.

---

## Audit — two rows, one transaction

    governance.decision.recorded  entity governance_decision  committed  simulation false
                                  source governance-authority
    agent-mandate.established     entity agent_mandate        committed  simulation false
                                  source agent-mandate

Both carry `occurred_at = 2026-09-06T08:58:02.620Z` — **identical to the decision's `decided_at`** —
with `recorded_at` 29ms later. Same timestamp because same transaction. That is the atomicity claim,
measured rather than asserted.

### `enforced: false`, and why it is correct

The mandate audit row carries `enforced: false`. This is **not** a defect and **not** a claim that
enforcement is disabled. It is an AMA-1 constant, written on every row by design, and the writer's
own header states why:

> *"AMA-1 records; it does not enforce. Stated on every row."*

Recording a mandate changes what the **organization has recorded**, never what an agent may
instantly do. Enforcement is a separate seam in a separate feature, verified below.

---

## What is now true, and what still is not

**AMA-2's enforcement seam is `action-authorization/record-action-request.server.ts`.** It calls
`readEffectiveAgentMandate` and refuses before anything durable is written:

| condition | refusal |
|---|---|
| no mandate | `no-agent-mandate` |
| kind not admitted | `action-outside-agent-mandate` |
| authority unreadable | `agent-mandate-authority-unavailable` |

**Before this phase:** every TRH Heby proposal refused `no-agent-mandate`.
**After:** a `record-work` proposal passes the *ceiling* check. A `send` proposal refuses
`action-outside-agent-mandate` — the ceiling now says something specific rather than nothing.

### And a record-work proposal still refuses — for a different, honest reason

    PROPOSAL ALLOWED BY CEILING != PROPOSAL STRUCTURALLY VALID

`record-work`'s argument schema requires `departmentRef`, `kind: "record-ref"`, `required: true` —
*"An in-service department: department/&lt;uuid&gt;"*. The registry comment is explicit that the
governed path is deliberately stricter than the human path, so a proposal cannot put a decision
about a fiction in front of the Director.

`heby-action-inlet/record-work-proposal.server.ts` resolves that reference through
`readOrganizationAuthority` — the one seam every consumer calls, taking no organization parameter so
a caller cannot point it at another tenant — and refuses **`department-not-found`** when the
reference names nothing in this organization's structure, or **`department-retired`** when it names
something withdrawn.

**Turkish Rug House has zero departments.** Measured: 1 department exists in the entire deployment,
and it is Hebun AI's *Engineering*. So a TRH `record-work` proposal refuses `department-not-found`
today, and that refusal names a real missing organizational fact rather than a permission failure.

**No department was fabricated to close that gap, and TRH-14 did not create one.**

---

## Why `send` was withheld

Measured, not preferred:

| kind | execution posture | provider required | TRH reality |
|---|---|---|---|
| `record-work` | `internal-authority` | **never** | 0 departments — a missing organizational fact |
| `send` | `external-provider`, **irreversible** | yes | 0 integrations, 0 credentials, 0 recipients |

`record-work` can never reach a provider under any circumstance. `send` cannot reach one *yet*, and
admitting it would have recorded a ceiling implying an external capability this organization has no
path to. Least privilege chose itself.

Turkish Rug House's mandate is narrower than Hebun AI's, which sits at revision 2 with scope
`["send"]`. Two organizations, two different ceilings, one authority.

---

## Production delta — exactly four rows

    agent_mandates        0 -> 1     (+1)
    decision_records      3 -> 4     (+1)
    governance_sessions   3 -> 4     (+1)
    audit_log                        (+2)

**Non-effects, every one measured after the act:**

    action_permits              0     action_execution_attempts   0
    integrations                0     integration_credentials     0
    external_recipients         0     departments                 0
    heby_action_requests        0     work_items                  1
    work_artifacts              1     work_artifact_revisions      2
    knowledge_nodes             5     agents (durable)             1
    migration ledger           48     unmoved

**Recording a mandate filed no proposal.** `heby_action_requests` for Turkish Rug House is 0. No
permit, no execution attempt, no provider, no credential, no recipient, no department, no work item,
no revision 3, no publication.

Turkish Rug House's Governance ledger now reads, in order:

    authority-delegation      | tenant                  | certify -> authority-established
    knowledge-ratification    | knowledge_node          | ratify  -> ratified
    artifact-review           | work_artifact_revision  | reject  -> artifact-revision-changes-requested
    agent-mandate             | agent_mandate           | approve -> agent-mandate-bounded

### Tenant isolation

Hebun AI's mandates remain at **2** (revisions 1 and 2, unchanged) and its own single durable agent.
The act reached one tenant.

---

## Reversal semantics

Append-only. `mandate_revision` increments, `supersedes_mandate_id` links backwards, and
`observedMandateRevision` is a compare-and-swap guard against a human deciding from a stale view.
Nothing is edited or deleted — **including a withdrawal**: an empty scope is admissible and means
"this agent may propose nothing", recorded as a new revision that supersedes this one. The ledger
keeps both, because an organization changing its mind is often the useful part.

---

## Verification

**MEASURED by the assistant:** repository CAS `ec16599`, HEAD == origin/main 0/0; deployed SHA
`ec16599` from the Vercel REST API's `meta.githubCommitSha` on `dpl_EfgAM5ho…`; ledger 48/48
converged, digest `f11fb805e…`; every row, column, timestamp, delta and non-effect above, read
directly from the production database over the direct (non-pooled) endpoint.

**DIRECTOR-OBSERVED — recorded as such; the assistant performed no browser observation:**

> - Heby visibly remains IN SERVICE.
> - The mandate surface visibly shows **AUTHORITATIVE** and **REVISION 1**.
> - The recorded purpose visibly reads *[the text above]*.
> - Under **MAY PROPOSE**, the authoritative mandate visibly shows exactly **RECORD-WORK**.
> - **SEND is not shown** in the authoritative MAY PROPOSE scope.
> - The separate "Revise this mandate" form displays checkboxes for both kinds — flagged by the
>   Director as not authoritative, and confirmed so by direct production read.
> - No second revision was made and no other action performed.

**Tests: 11 narrow suites, all green** — `ama1-agent-mandate` (firewall, bite-proofs, postgres),
`ama2-mandate-enforcement` (firewall, bite-proofs), `ama3-mandate-product`, `agent-id-0`,
`agent-id-0-1`, `trh11-agents-header-truth`, `trh12-mock-gate-reconciliation`. The full suite was not
re-run: no product code changed in this phase, and nothing in the repository moved.

---

## Limitations

1. **No `record-work` proposal has been filed**, deliberately. The ceiling is proved by reading the
   released enforcement seam, not by exercising it — and exercising it today would produce a
   `department-not-found` refusal, which is a fact about TRH's structure rather than about the
   mandate.
2. **`enforced: false` is honest, not a gap**, but a reader who meets it without AMA-1's header will
   misread it. Recorded here for that reason.
3. **The revision form lists the full vocabulary.** Not a defect — it is an input control, and the
   authoritative card beside it shows what was recorded — but it is the kind of adjacency that
   invites a misread, and the Director caught it. Worth watching, not worth changing on this
   evidence.
4. **Route rendering remains Director-observed, not test-proven**, as for every other surface.

---

## The ladder, exact

    organizational knowledge -> durable identity -> MANDATE -> runtime capability
      -> grounded proposal -> Governance decision -> permit -> execution -> outcome -> evaluation

    Turkish Rug House, after TRH-14:
      Knowledge grounded                YES  — 5 facts, 1 ratified
      Durable agent identity            YES  — Heby, in service
      Mandate recorded                  YES  — THIS PHASE, revision 1, ["record-work"]
      Proposal ceiling enforceable      YES  — AMA-2 seam reads it
      Proposal structurally fileable    NO   — no in-service department to name
      Governance decision on a proposal NO   — none filed
      Permit minted                     NO
      Executed                          NO   — record-work needs no provider; send has none
      Published                         NO

Turkish Rug House's agent now has a bounded purpose its organization recorded, a ceiling its
enforcement seam can read, and exactly one thing standing between it and its first legitimate
proposal — and that thing is a department, not a permission.
