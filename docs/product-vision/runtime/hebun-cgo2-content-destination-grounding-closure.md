# CGO-2 — Content Destination Grounding — CLOSED / PRODUCTION-ACCEPTED

**Release** `48f1494` · **ZERO schema** · **Production ledger 47, unchanged** · **Deployment** `dpl_F38tJghCNG9wWSz1H6H3jBfPpyLc`, aliased `www.hebuntech.com`

---

## What Hebun can now do that it could not

CGO-1 recorded where a content draft was prepared to go and showed it to humans. Heby was handed
the draft **without it** — the grounding seam selects its columns explicitly and did not include
`intended_destination`.

    "What content have we prepared for Instagram?"   →  unanswerable
    (Heby could read the draft; it could not say what it was prepared for.)

Answerable now. That gap was named in the CGO-1 closure rather than smoothed over, and this phase
closes exactly it and nothing else.

**One column added to an existing read, and one formatter segment.** No new authority, no schema,
no provider, no adapter, no scheduler, no write boundary, no second content reader.

---

## Two decisions worth keeping

**The destination is READ, never inferred.** A caption mentioning Instagram is not a caption
prepared for it. Inferring from a title or a body would put a fact into evidence that no human ever
declared, and the whole value of the CGO-1 field is that somebody chose it. A test asserts the seam
selects the durable column and contains no text-matching path.

**The denial travels WITH the fact, as the immediately following segment.** Not merely present
somewhere in the payload — adjacent, so that no truncation, reordering or partial quotation can
carry "prepared for Instagram" without the sentence that bounds it. A test asserts the adjacency,
not just the presence:

    type: content-draft · revision: 1 · prepared for: Instagram · destination is DECLARED ONLY —
    no provider connection exists, nothing is scheduled, nothing was published, nothing was
    delivered and nothing was seen · authored by: human · digest: 6406f083be78… · excerpt: complete

The denial is written as a statement about **Hebun**, not about the destination: nothing claims
Instagram is unreachable in the world, only that this organization has established no connection to
it. That is the honest scope of what Hebun knows.

**A non-content artifact is handed nothing at all** — not `destination: none`, which a model could
read as a deliberate choice not to publish. Absence is the truth, and CGO-1's paired CHECKs
guarantee the column is NULL there.

Labels come from the released `CONTENT_DESTINATION_LABELS`; this seam does not re-spell them.

---

## Production acceptance

Performed against the released commit on production, using the **CGO-1 artifact already there** —
no artifact was created for CGO-2. The released seam was resolved read-only, with **zero model
calls** and zero billable cost.

| Proof | Result |
|---|---|
| Seam resolves | `resolved`, 4 items, `authoritative: false` |
| The CGO-1 artifact | `work-artifact/0e19e56c-d8da-4cc2-a767-4b2e4ee35440@1` |
| Destination reaches Heby | `prepared for: Instagram` — **the gap CGO-1 left is closed** |
| Denial adjacency | `destination is DECLARED ONLY …` is the immediately following segment |
| Non-content artifacts | all three silent — no destination, and never the word "none" |
| `instagram` in payload | **true** (it was **false** at CGO-1 closure) |

Forbidden readings, judged with the denial text removed so the denial cannot satisfy its own test:
`scheduled` **false** · `published` **false** · `delivered` **false** · `seen by` **false** ·
`connected` **false** · `authorized` **false** · `posted` **false**.

Heby may now say *this content draft was prepared for Instagram*. It is handed nothing from which
it could conclude Instagram is connected, that anything was scheduled, published, delivered or
seen, or that anyone authorized anything.

### Non-effects

Grounding is a read. Measured after acceptance, **total drift 0**: `work_artifacts` 4,
`work_artifact_revisions` 4, `work_evidence_references` 2, `decision_records` 7,
`heby_action_requests` 5, `action_execution_attempts` 1, `integration_credentials` 18,
`provider_connectivity_controls` 2, `agent_mandates` 2, `agents` 1 — every one unchanged. The
artifact itself is byte-for-byte as CGO-1 left it: revision 1, `version` 1, `updated_by` NULL.

No provider was connected, no credential created, no scope requested, no adapter added, no
scheduler introduced, no Governance decision, no permit, no execution, and no agent mandate widened.

---

## Validation

FAST discipline: no full repository suite was run.

Targeted: the new CGO-2 grounding test (7 groups — vocabulary, adjacency, absence-not-"none",
forbidden claims, tenant isolation, no writes) passed first run. Directly affected regressions all
green: both CGO-1 tests, all three R3W suites, both WORK-2 Heby grounding suites, `ops-p1`
preparation firewall, `kr5` boundaries, and `agent-runtime-0` attribution — the last three being
the other consumers of this seam. Typecheck clean, lint 0 errors (14 pre-existing warnings in
unrelated files), build green.

No migration pin was touched, no baseline failure was fixed, no unrelated architecture refactored.

---

## Technical debt left untouched, deliberately

**SCHEMA RELEASE AUTO-DEPLOY ORDERING.** Git push auto-deploys, so a schema-bearing release cannot
follow push → migration → deploy as stated; CGO-1 ran new code against the old schema for ~20
minutes. It did not bite here — CGO-2 is zero-schema, so the deployment had nothing to be ahead of.
Unowned.

**MIGRATION TEST AUTHORITY FAN-OUT.** One small additive migration costs ~45 pinned test edits
across 30+ files. Did not bite here either, for the same reason. Backlogged, unowned.

**17 pre-existing suite failures**, measured at `4cbb4ef` and unchanged since. Not this phase's.

---

## Status

**CGO-2 — CLOSED / PRODUCTION-ACCEPTED.**

Zero schema · zero new authority · zero provider · zero adapter · zero scheduler · zero write
boundary · zero production row changed.

Still true, and still the honest limit of Era III: **no social provider is connected, no publishing
path exists, and no scheduler exists.** Heby can now say what was prepared and where for. It cannot
say anything was sent, and nothing in this release moves it closer to being able to without a
Director decision.

**CGO-3 is not started and no successor has been selected.**
