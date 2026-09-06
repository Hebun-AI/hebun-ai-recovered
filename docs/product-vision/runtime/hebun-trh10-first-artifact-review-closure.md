# TRH-10 — Governance Reviews One Exact Work Artifact Revision — CLOSED / PRODUCTION-ACCEPTED

**One migration (additive enum value), one Governance decision, ZERO bytes changed** ·
**Migration ledger 47 → 48, repository AND production** · **Production cluster**
`7675444875863894887` / `neondb` · **Release** `25cba81` · **Predecessor**
[TRH-8](hebun-trh8-first-operational-work-closure.md) at `796c029`

**This is the phase where the human review boundary TRH-8 reached became a thing the ledger can
record.** TRH-8 stopped at that boundary and said so honestly: a human had judged revision 1
unacceptable, and the organization had nowhere to write it down. TRH-10 gives that judgement a
subject, a domain, an authority and an audit row — and then stops again, one step further along,
with nothing published and nothing connected.

    CONTENT REVIEW  !=  PUBLICATION AUTHORIZATION
    PUBLICATION AUTHORIZATION  !=  EXECUTION PERMIT
    EXECUTION PERMIT  !=  EXECUTION SUCCESS

    CURRENT REVISION  !=  ACCEPTED REVISION

---

## The lifecycle, stated exactly

| Stage | Status |
|---|---|
| **DESIGNED** | Governance reviews an exact immutable revision; second subject type ever minted |
| **IMPLEMENTED** | `work-artifact-review`, 2 files, no new writer, no new authority |
| **RELEASED** | `25cba81`, pushed to `origin/main`, suite 681/681 |
| **MIGRATED** | Director-executed ceremony, production ledger 47 → 48 |
| **APPLICATION-VERIFIED** | one real Governance decision against a real revision, this document |
| **EXECUTED** | **NO.** Nothing was published, sent, or executed. No provider is connected. |

The migration ceremony said this itself, and it was right: *"Schema converged. This is NOT
application acceptance."* Converging a schema proves a column exists. This document proves a
capability was exercised.

---

## The second subject type, and why it is a version

`GovernanceSubjectType` had exactly one member since G2. TRH-10 mints the second:

```
export type GovernanceSubjectType = "knowledge_node" | "work_artifact_revision";
```

**The subject is a VERSION, not an identity.** Binding a review to `work_artifacts.id` would mean
"whatever revision is current when someone reads this" — the exact approximation `knowledge_fact`
was removed for. `work_artifact_revisions` carries its own uuid primary key, so the exact immutable
bytes a human read are nameable without inventing a composite id.

The promised second server-side existence check lives in `work-artifact-review`. It resolves the
revision inside the caller's tenant **and** inside the named artifact, so a wrong tenant, a wrong
artifact and a missing revision are one indistinguishable refusal.

### The domain is `artifact-review`, not `content-review`

The artifact is the concern; content is one artifact type. The same authority must stay valid for a
generated-media revision, a message draft and an operational plan without minting a domain per
subtype. What the bytes ARE is `work_artifact_type`'s business, not the ledger's.

It is **not** `knowledge-ratification` — that settles an organization's own knowledge, and a
reviewed draft never becomes Knowledge by being accepted. It is **not** `action-authorization` —
that makes one act executable and mints a permit that expires and is consumed; accepting a revision
authorizes nothing, expires never, and is consumed by no runtime.

---

## Schema — one line

```sql
ALTER TYPE "public"."governance_domain" ADD VALUE 'artifact-review';
```

Snapshot diff, measured not asserted: **64 tables before, 64 after, table bodies byte-identical.**
One enum value appended, `governance_domain` 17 → 18 members. No table, no column, no constraint —
the first migration in this repository of that shape, which is why the production ceremony's
convergence probe had to leave `pg_constraint` and follow `pg_enum` instead.

| | repository | production |
|---|---|---|
| canonical migrations | 48 | 48 applied |
| canonical digest | `f11fb805ef8d822e4a59226e4600404e` | `f11fb805ef8d822e4a59226e4600404e` |
| prefix verdict | — | **converged**, exact per-migration sha256 |
| last tag | `20260905212157_trh10_artifact_review_domain` | same, present exactly once |

Backup taken before the ceremony: `hebun_production_pre_migration_20260905-230220.dump`.
Organizational data unchanged across every counted table.

---

## The decision, exact

The Director reviewed revision 2 in `/operations` and **requested changes**.

| | |
|---|---|
| decision id | `8c6e163b-0144-4e75-a2a5-db19e39566cf` |
| tenant | `9947c78e-2080-4331-81c6-456cb4be7a96` — Turkish Rug House |
| `subject_type` | `work_artifact_revision` |
| `subject_id` | `53d06bb1-ad2b-4dc1-8e63-2f50e47fbcaa` — **the revision row, not the artifact** |
| `governance_domain` | `artifact-review` |
| `decision_type` | `reject` |
| `outcome` | **`artifact-revision-changes-requested`** |
| actor / proposer / authority source | `human` `d5b496df…` — the Director, all three |
| governance session | `dffd2cce-e13d-4e03-80a8-0dcd83e1b973`, lifecycle `recorded` |
| `supersedes_decision_id` | `null` — the first decision on these bytes |
| decided at | 2026-09-06T06:49:52.122Z |

Evidence carried on the decision row:

```json
{"revisionNo":2,
 "contentDigest":"45b962ad3dcb2736950d53db54cff63d10216296bc06f981cf92be2d43fc9b6d",
 "workArtifactId":"aa96978d-28ff-4bf8-a86f-23bd9b088dfb",
 "authorityFromBootstrapDecisionId":"7303974e-6e67-4fe9-b0f9-a111b622bb5c"}
```

**The digest rides in the evidence on purpose.** A reader years from now can prove the reviewed text
is the text still stored, without trusting the revision ordinal alone.

### The outcome word is not `rejected`

`artifact-revision-changes-requested`, not `rejected`; `artifact-revision-accepted`, not `approved`.
A ledger row read years later must not suggest a draft was published or that anything was
authorized. What a human judged is A REVISION, for A NEXT INTERNAL STEP.

This also closes a real trap. Artifact review reuses `approve`/`reject`. `reject` matched no branch
in the outcome ladder and would have fallen through to the final `: "rejected"` — accidentally right
for a rejection and **catastrophically wrong for an acceptance**, because `approve` would have
reached the same fallthrough and recorded an ACCEPTED revision as `rejected`, permanently. The
subject check is placed FIRST, which makes both unreachable.

---

## Why changes were requested — the grounding, not the taste

Revision 2's bytes were read from production and put in front of the Director before any mutation.
Two phrases previously flagged were **still present, in both languages**:

- *"Discover **authentic** handmade home textiles"* / *"**Özgün** el yapımı"*
- *"each piece carefully crafted and **selected for quality**"* / *"her parça **kalite için dikkatle
  seçilmiş**"*

Against Turkish Rug House's own record — 5 knowledge nodes, **one ratified**:

| | |
|---|---|
| **RATIFIED** | *"Turkish Rug House el yapımı halılar, kilimler ve minderler satmaktadır."* — it **sells** them |
| **UNRATIFIED** | *"…toptancı şirketlerden temin edilen ürün fotoğrafları üzerinden satışa sunmaktadır. Ürünlere belirli bir marj eklenerek…"* — wholesaler catalogue photographs, priced by margin |

**"Selected for quality" asserts a selection process no recorded fact supports** — the recorded
supply model describes no selection step. **"Authentic" is a provenance claim beyond the single
ratified fact.** The brand-positioning node that comes closest to justifying the tone is itself
unratified.

This was surfaced as a disclosure, not decided by the machine. The Director chose B.

The full justification is on the decision row, 814 characters, and names both phrases in both
languages with the fact each one outruns.

---

## Revision 1 received no decision, and none was invented

TRH-8 recorded that the Director had rejected revision 1 for truncation and for `#TurkishTextiles`.
That was a **descriptive human judgement made before any review authority existed**.

Production carries **zero** decisions with `subject_id = ffa53af0-e27d-4994-8431-728ca24c36fc`.

Backfilling one would have manufactured a Governance act that never happened, to make history
tidier. **Not done.** Revision 1 remains historical and incomplete in descriptive terms only.

---

## Revision integrity — nothing the review touched

| | before | after |
|---|---|---|
| rev 1 `ffa53af0…` digest | `30d7c48c…e37c` | `30d7c48c…e37c` ✓ |
| rev 2 `53d06bb1…` digest | `45b962ad…9b6d` | `45b962ad…9b6d` ✓ |
| stored digest = recomputed | true | true ✓ |
| `current_revision` | 2 | **2** ✓ |
| revision count | 2 | **2** — no revision 3 ✓ |
| artifact lifecycle | `draft` | `draft` ✓ |

Both digests recomputed at acceptance with the product's own `digestArtifactContent`, not a
reimplementation. Revision 1 is 902 characters / 929 UTF-8 bytes; revision 2 is 710 / 748. TRH-8
quoted characters — the same content, a different unit, not a discrepancy.

**"Request changes" created nothing.** No revision was authored, none deleted, none retired. A new
revision appears only when a human runs the preparation act again.

---

## Non-effects, measured

Turkish Rug House, before → after, every one unchanged:

    knowledge_nodes             5 -> 5      (ratified 1 -> 1)
    work_evidence_references    4 -> 4
    work_items                  1 -> 1      declared_state `planned` -> `planned`
    work_artifacts              1 -> 1
    integrations                0 -> 0
    integration_credentials     0 -> 0
    action_permits              0 -> 0
    action_execution_attempts   0 -> 0
    external_recipients         0 -> 0
    agent_mandates              0 -> 0

Global, the entire deployment:

    decision_records            9 -> 10   (+1, the review)
    governance_sessions         9 -> 10   (+1, its session)
    work_artifacts              8 -> 8    (+0)
    work_artifact_revisions     9 -> 9    (+0)
    companies                   2 -> 2    (+0)

**Exactly two rows were written to production by this act**, plus one audit row. Nothing else moved.

No social publication. No provider mutation. No e-commerce mutation. There is no path to one: TRH
has no integration, no credential, no permit and no recipient, so execution is unavailable rather
than merely unattempted.

### Tenant isolation

Hebun AI (`f625b683…`) holds 7 decision records, **none** with `subject_type =
'work_artifact_revision'`. The review reached one tenant.

---

## Audit — written, and atomically

**One row**, `audit_log` `ea5277e9-49fc-4a60-a506-6a0b0660b6cc`:

    action        governance.decision.recorded
    entity_type   governance_decision
    entity_id     8c6e163b-…            <- the decision
    actor         human / d5b496df…
    result        committed             simulation false
    source        governance-authority  authority_source membership
    metadata      subjectType work_artifact_revision
                  subjectId   53d06bb1-…
                  decisionType reject
                  bootstrap   false

`occurred_at` is **06:49:52.122Z — identical to the decision's `decided_at`**, and `recorded_at` is
13ms later. The decision and its audit row share one timestamp because they share one transaction.
That is the atomicity claim, measured rather than asserted.

**This is a change from TRH-7 and TRH-8**, where the act was self-attributing on its own row but
never reached the audit ledger. Review does reach it, because it reuses the Governance audit seam
rather than inventing one.

---

## The authority chain, unwidened

    work artifact / revision authority   (prepare, revise, retire)
      !=  Governance review authority     (this phase)
        !=  action authorization          (makes one act executable)
          !=  execution permit            (expires, is consumed)
            !=  provider execution        (reaches the outside world)

Five authorities, five separate seams, and TRH-10 added exactly one of them.

Measured across the whole source tree at `25cba81`:

- the domain literal `"artifact-review"` appears in **exactly 3 places** — the enum declaration, the
  subject→domain map, and the feature's own constant
- the subject literal `"work_artifact_revision"` in **exactly 3** — the type, the list, the constant
- `writeGovernanceDecisionWithin` still has **exactly one** definition
- **no** agent, Heby, provider, execution, permit, action-authorization or Knowledge module imports
  `work-artifact-review`
- the artifact writer names no review domain, no review subject and no decision writer
- `review-revision.server.ts` contains **zero** `.insert(` / `.update(` / `.delete(` of its own;
  every write goes through the two existing seams. `current_revision` appears once — in prose.

"Review edited the bytes" and "review moved `current_revision`" are **unavailable, not merely
unwritten.**

### Reversal is a new decision

There is no update, no delete and no un-review. Accepting a revision that was rejected records a
SECOND decision; both stay in the ledger and the derived state is the latest. A mutable approval row
would have destroyed the evidence that an organization changed its mind, which is often the useful
part. K4 refuses a second ratification because ratification binds to a write-once column; review
binds to nothing, so a second decision is not a conflict.

---

## Verification

**Production, read-only, over the DIRECT (non-pooled) endpoint.** The pooled endpoint was rejected
for the ceremony on evidence: `acquireMigrationLock` uses session-scoped `pg_try_advisory_lock`,
which must survive a full `pg_dump` and an unbounded interactive prompt — guarantees PgBouncer
transaction pooling does not provide. The apply would likely have succeeded while its serialization
control was silently void, which is worse than failing loudly.

**Commit binding, proved through data rather than a deploy API.** Production wrote the outcome
string `artifact-revision-changes-requested`. That string exists at `25cba81` and is **absent at its
parent `796c029`**. The deployment demonstrably runs TRH-10 code.

**Tests: 14 narrow suites, all green.** The TRH-10 firewall and Postgres suites, plus every suite
that pins the Governance subject vocabulary or the operations action surface: `g2-flow`, `k4-flow`,
`rev1-authorship-legibility`, `ops-p1` firewall and bite-proofs, `app2-decision-truth`,
`wev1-work-evidence`, `work1-organizational-work`, `kr-ext1-flow`, `pub1-public-surface`,
`agent-id-0-1`, `principal-firewall`. The full 681 was **not** re-run — it was green at release and
no repository fact changed since.

---

## UI acceptance — stated in four levels, not collapsed

| | |
|---|---|
| **IMPLEMENTED** | YES — `ArtifactRevisionReview`, per revision, beside the bytes it decides about |
| **EXPOSED IN SOURCE** | YES — both controls, the publication notice, the revision-scope notice, and both non-effect lists render inline beside the buttons, asserted by test |
| **PRODUCTION DATA VERIFIED** | YES — this document |
| **ROUTE-LEVEL RENDERED ACCEPTANCE** | **DIRECTOR-OBSERVED, NOT TEST-PROVEN** |

The Director operated the control on production and it produced a correct decision — the strongest
available evidence, and it is human observation, not a rendered assertion. No automated
authenticated render of `/operations` exists, as it does not for `/knowledge` or `/agents`.

An earlier draft of this closure claimed TRH-10 was the first Governance decision made through the
authenticated product surface rather than an operator script. **That claim was withdrawn**: all
eight governance-decision audit rows in production carry real `request_id` and `session_context_id`
UUIDs, so the audit ledger cannot distinguish the two seams. The distinction may be true; it is not
measurable here, so it is not claimed.

The surface must never imply, and does not:

    ACCEPTED  !=  PUBLISHED
    ACCEPTED  !=  AUTHORIZED TO PUBLISH
    ACCEPTED  !=  PERMIT GRANTED
    ACCEPTED  !=  EXECUTED

The button reads *"Accept for next internal step"*, never *"Approve"*, and the publication notice
sits beside it rather than in a footnote — a human clicking a button labelled only "Approve" on a
draft addressed to Instagram would reasonably believe they had approved it for Instagram.

---

## Limitations

1. **Route-level rendered acceptance of `/operations` remains unproven by test.** Carried forward
   from TRH-8, unchanged by this phase.
2. **The `pg_advisory_lock` / pooled-endpoint interaction is reasoned, not empirically measured.**
   The ceremony ran on the direct endpoint, so the pooled failure mode was avoided rather than
   observed. The reasoning stands on PgBouncer's documented transaction-pooling semantics.
3. **No derived review state is displayed for a revision the reader has not expanded.** The state is
   read in the same click that opens the history; a collapsed row shows no review standing.
4. **One decision exists. The acceptance path has not been exercised against production** — only the
   changes-requested path. Both share one code path and one test suite, and the accept branch is
   covered by `trh10-artifact-review/review-postgres.ts` locally.

---

## Prior audit debt — recorded, not repaired here

**Artifact preparation still writes no audit row**, for either revision. This is the same gap TRH-7
recorded for agent genesis and TRH-8 recorded for artifact preparation: the act is self-attributing
on its own row (`authored_by_actor_*`, `created_by`, `source_message_id`, a content digest and an
immutable revision ordinal) but does not reach the audit ledger.

It now has **three occurrences across three authorities** and deserves its own decision. TRH-10 did
not repair it — reviewing a revision is not the phase that fixes how revisions are audited, and
folding an unrelated repair into this diff would have made both harder to read.

---

## The ladder, exact

    UNDERSTAND  ->  PREPARE  ->  REVIEW  ->  [authorize]  ->  [permit]  ->  publish

    Turkish Rug House, TRH-10:
      Knowledge grounded          YES     — TRH-3, TRH-4
      Work recorded               YES     — TRH-8
      Draft prepared              YES     — TRH-8, 2 revisions
      Evidence declared           YES     — TRH-8, 4 references
      Review recorded             YES     — THIS PHASE, changes requested on revision 2
      Publication authorized      NO      — no action request exists
      Permit minted               NO      — no permit exists
      Published                   NO      — no provider, no credential, no path

    CONTENT REVIEW             != PUBLICATION AUTHORIZATION
    PUBLICATION AUTHORIZATION  != EXECUTION PERMIT
    EXECUTION PERMIT           != EXECUTION SUCCESS
    CURRENT REVISION           != ACCEPTED REVISION

The organization now has somewhere to write down that a draft was not good enough, and a reason
attached to the exact bytes it was said about. Revision 2 is still `current_revision`, still
readable, still unedited — and now carries a recorded judgement that it is not fit to go forward.
