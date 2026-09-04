# REV-2 — Row-Level Authorship on the Prepared-Work List — CLOSED / PRODUCTION-ACCEPTED

**Release** `b9ec9a9` · **ZERO schema** · **Production ledger 47, unchanged** · **Deployment**
`dpl_FHvEcKsXeNGXbFJLd6uhS32TPg3s` (`b9ec9a9`), superseded in place by the closure commit's own
auto-deploy — both serving byte-identical surface code, proved below — aliased to
`www.hebuntech.com`

**Both halves are accepted, and they were accepted by different means.** The data half was accepted
from an operator shell through the released seam. The rendered half was accepted by the **Director,
on the deployed authenticated surface**. Neither half is an automated browser check, and this record
does not claim one.

---

## What Hebun can now do that it could not

REV-1 made authorship legible **one revision at a time, behind History**. A reader scanning seven
drafts had to open seven histories to learn which a model wrote. At seventy, the question stops
being answerable at all.

    Before:  a list of titles, types, revision numbers and destinations
    After:   + who wrote the revision each row names

The column, the writer and the vocabulary were **all already released**. What was missing was the
fact reaching the place the reader actually is.

---

## The decision this phase turned on

**It is the CURRENT REVISION's author, not the artifact's** — and that is the capability, not a
caveat attached to it.

An artifact has no author. Revision 1 can be agent-written and revision 2 written by the person who
rewrote it, and *"who wrote this draft"* then has two true answers. `currentRevisionAuthoredByActorType`
answers exactly one question — who wrote revision `currentRevision` — which is the revision the row
already names and the one `currentRef` points at.

So the list states the bound **once, above the rows**, before any label is read:

> Authorship shown in this list is the author of each artifact's CURRENT revision only. An earlier
> revision may have been written by someone else; History shows the whole sequence.

Production has `distinct_authors = 1` on every artifact today, so the mixed case does not yet exist
there. It is proved by test instead: an agent-written draft that a person revises reads as
person-written on the row, while the agent revision stays in history and is not erased.

---

## Three boundaries that did not move

**A classification, never an identifier.** `authoredByActorId` stays withheld, in both views.
OPS-P1's firewall passes **unchanged** — `authoredByActorType` had already legitimately left that
withheld set in REV-1, and nothing rendered here is an identifier or a digest.

**A LEFT join, never an INNER one.** An INNER join would DROP any artifact whose current revision did
not resolve — hiding prepared work from a reviewing human in order to protect a label, which is the
wrong trade in a listing whose whole job is to show what exists. The row still appears; its
authorship arrives as the empty string and renders as REV-1's explicit *"unknown, not human"*.

**A superseded author is never promoted.** `resolveWorkArtifactReference` resolves an EXACT revision,
which may be superseded. Handing that revision's author to the artifact view would put a superseded
author in a field contracted to mean *current* — the same silent upgrade this module refuses
everywhere else, running the other way. It is used only when the resolved revision IS the current
one, and looked up otherwise.

---

## The regression this phase created and then pinned

`agent-origination/candidate-set.server.ts` reads this same listing seam and states in its own words
that nothing but `ref` and `label` is carried — *"no digest, no id, no tenant, no actor"*.

Putting an **actor classification** on the view it reads made that claim load-bearing in a way it was
not before. It is now asserted rather than trusted: every candidate has exactly the keys `ref` and
`label`, and the candidate builder never names the new field. **The agent gained nothing.**

---

## What this is NOT

**No approval, no review, no rejection.** Those states still do not exist in this authority, and
nothing here creates them. Lifecycle remains exactly `draft | retired`, asserted by test.

**No new authority, no new persistence, no schema, no migration, no provider call, no source class,
no workspace, no server action.** One field on an existing view, one JOIN in an existing read seam,
one line on an existing surface, and REV-1's already-released label vocabulary.

**Seeing who wrote it is still not reviewing it.** REV-1's non-claims are unchanged and still
rendered beside History.

---

## Production acceptance — data half, ACCEPTED

Executed against production data through the released seam at the deployed commit. **No model call,
no provider call, no credential opened, no write.**

The released `listWorkArtifacts` returned, for the Director's real tenant:

| Artifact | Current revision author |
|---|---|
| CGO-7 observed reel caption | **agent** |
| Rug washing video caption | **agent** |
| Agent-prepared reel caption — hand-knotted weaving | **agent** |
| Loom weaving reel — three knots per centimetre | person |
| Provenance Acceptance Note | person |
| Hebun Production Acceptance Note | person |
| Test Email | person |

**Tally: agent 3 · human 4**, matching an independent SQL scan of
`work_artifact_revisions` taken before the change was written. `authoredByActorId` is absent from
every row. Every counter — artifacts, revisions, knowledge, work, integrations, credentials,
decisions, proposals, executions — identical before and after: **reading recorded nothing.**

### Accepted — the rendered half, by the Director

**Director UI acceptance: PASS.** `Operations → Prepared work` was inspected on the deployed
authenticated surface. It visibly rendered:

1. **The list-level semantic qualification**, once, above the rows —
   *"Authorship shown in this list is the author of each artifact's CURRENT revision only. An
   earlier revision may have been written by someone else; History shows the whole sequence."*
2. **Per-artifact current-revision authorship**, including rows reading
   *"revision 1: Written by this organization's durable agent"*.
3. **Multiple** prepared-work rows carrying the classification.

**This is Director-observed production UI evidence. It is real acceptance evidence and it is NOT an
automated test.** No browser automation ran against the authenticated surface at any point in this
phase, and none is claimed. The distinction is kept deliberately: what a person confirms they saw is
different in kind from what a suite asserts, and collapsing the two would misdescribe the evidence.

---

## Post-acceptance verification — READ-ONLY, against production

Run after the Director's view, against the baseline `scripts/rev2-acceptance.ts` recorded before it.

**The rendered rows still come from the authoritative seam.** The released `listWorkArtifacts`
returns **7 rows**, tally **agent 3 · human 4**. Exactly **3** rows carry
*"Written by this organization's durable agent"* — matching the Director's *"multiple rows"* — and
one of them is *"CGO-7 observed reel caption", revision 1*, the same artifact and revision reported
from the surface.

**Current-revision semantics hold exactly.** Every row's `currentRevisionAuthoredByActorType` and
`currentRevision` were compared against the database's own answer for that artifact's current
revision: **0 mismatches**.

**`authoredByActorId` is absent from every row.**

**Nothing transitioned because it was viewed.** All 7 artifacts `draft`; **max `version` 1**; **0
artifacts whose `updated_at` differs from `created_at`** — no row has been touched since it was
written. The `approvals` table holds **0 rows**.

**All nine baseline counters identical** — artifacts, revisions, knowledge, work, integrations,
credentials, decisions, proposals, executions.

**Provider state unchanged and untouched by reading**: `youtube` v3, `google-workspace` v9,
`github-organization` v3, all `connected`/`healthy`; **0 audit rows in the last three hours**
(`audit_log` total 50). No provider call, no credential lifecycle, no scheduling, no publishing.

### The deployed identity, and what could not be measured

Production auto-deploys the closure commit after a push, so the surface the Director inspected ran
either the release `b9ec9a9` or its docs-only successor. **Which one could not be measured at
closure time**: `vercel inspect` does not expose git metadata, and the REST API rejected the stored
token (`invalidToken`). That limitation is recorded rather than papered over.

It does not affect the acceptance, and the reason is measurable locally: the closure commit adds
**207 lines across one document and `learnings.md`, and zero files under `apps/dashboard/src/`**.
All three surface files hash identically at both commits:

    prepared-work-section.tsx      e7ac2995558b48f9
    read-work-artifacts.server.ts  cad99dfe5e5f6228
    work-artifacts/contracts.ts    cd89f14e22aff22d

So whichever of the two production served, **the surface the Director inspected is the released
surface**.

---

## Tests

New: `tests/rev2-row-authorship/row-authorship-and-boundaries.ts` — the vocabulary bound, the
surface rendering a classification only, the seam still read-only and LEFT-joining, both authorship
kinds through the real writers, the mixed-authorship case, the superseded-reference case, tenant
isolation both ways, an unauthenticated read that is `unavailable` rather than empty, repeated reads
mutating nothing, the two lifecycle states, and the agent candidate set.

**Suite 676/677.** The single failure — `tests/hebycap1-flow/capability-truth.ts`, `/work-activity`
has no capability binding — is pre-existing and untouched. `tests/ama1-agent-mandate/bite-proofs.ts`,
which failed in earlier full-suite runs, passed here and 3/3 in isolation: it is **intermittent under
suite ordering**, and is neither caused nor fixed by this phase.

`tsc --noEmit` clean · `npm run lint` 0 errors · `npm run build` green.

Re-run at closure with no source change since the release: `tsc --noEmit` clean, lint 0 errors, and
the twelve directly-governing suites — REV-2, REV-1, OPS-P1, R3W and AGENT-PROPOSAL-2 — all green.
The full suite was not re-run, because the closure commit changes no source file.

---

## Truth limitations

- **Reachable is not reviewed.** A label a human can see is not a review, and no review exists.
- **The row is about one revision.** It says nothing about the artifact's history, and the list says
  so before any label is read.
- **A retired artifact still reports its author** — retirement is not an erasure — and still does not
  mean rejected.
- **Unknown is a real outcome.** An unresolved current revision renders as unknown, and that sentence
  is the honest state, not a failure to look.
- **The render was confirmed by a person, not by a machine.** One human, one surface, one session.
  It establishes that the qualification and the labels render and read truthfully — not that every
  artifact, browser, viewport or future row does.
- **The deployed commit identity was unmeasurable at closure** (Vercel token rejected). The
  substitute is a byte-identity proof, which is weaker in provenance than an API answer and is
  stated as such.

---

## Repository parity

`HEAD` = `origin/main` at closure. The deployment serving `www.hebuntech.com` runs the release
commit's surface code, byte-identical as proved above.

---

## Next newly exposed gap, NOT started

**Retirement is the only human disposition this lifecycle records, and it is invisible.**
`retireWorkArtifact` already writes `updatedBy`, `updatedByType` and `updatedAt` through a released
writer, and `toArtifactView` projects none of them — so a retired row reads as a state with no actor
and no time, indistinguishable from something the system did.

It was **not selected here, on evidence**, and the evidence was **re-checked at closure**: production
still has `retired = 0`, **max `version` 1**, and **0 artifacts whose `updated_at` differs from
`created_at`**. Nothing has ever been retired or updated, so accepting the capability would mean
retiring a real draft to manufacture its own proof. It becomes available the first time a human
genuinely sets a draft aside — and not before.

Approval remains genuinely undefined and is still not a capability — adopting it is an architecture
decision (an artifact becomes a Governance subject type, or this authority grows its own state),
and neither has been made.
