# CGO-8 — Prepared Content Review Legibility — RELEASED / PRODUCTION-ACCEPTED

**Release** `0a4daf2ef0f3400b6443aaf52255779e0ad4eeae` · **ZERO schema, ZERO migration** ·
**Deployment** `dpl_9N8dBWHayeEHU5oEFBLD9x3mSZGp`, READY, serving `www.hebuntech.com`

---

## The job, as CGO-7 named it, and what it turned out to be

CGO-7 closed by naming the next gap: *make prepared content reachable by the human who must review
it — a surface, not a new authority.* By the time CGO-8 was scoped, most of that already existed:

- OPS-P1 and REV-1..3 render prepared artifacts on `/operations`;
- the draft text is readable through History;
- TRH-10 records a Governance review decision per revision.

Two things were still missing:
- A reviewer could not see what awaited a decision without opening every row's History.
- The surface itself denied that review existed ("Hebun holds no review, no approval and no
  rejection"), directly under the TRH-10 review control.

CGO-8 closed those two gaps and created no new review system.

## What shipped

- **Review state on every Prepared work row.** The current revision's Governance review state is
  shown on the row, without opening History. It is one of four closed answers:
  - *Awaiting review*
  - *Changes requested*
  - *Accepted for next internal step*
  - *Review state unknown*

  *Awaiting review* is claimed only when the ledger was read and holds no decision for that exact
  revision. An unreadable ledger, an unresolved revision or an unrecognised outcome is *unknown*.
- **One batched read inside the existing `work-artifact-review` authority.**
  `readCurrentRevisionReviewStates` uses the same tenant predicate, the same
  `work_artifact_revision` subject and the same derivation as the released per-artifact reader. It
  is exposed through one read-only server action.
- **Re-read after acting.** The state is re-read from the ledger after *Accept* / *Request changes*
  or a new revision, so the row does not keep showing the answer from before.
- **Truthful wording.**
  - The surface no longer denies that review exists.
  - A declared destination is not a provider connection, and a connection does not make a draft
    publishable.
  - Hebun holds no provider capability that can publish.
  - Review is no approval to publish, send or execute.
  - The reviewer comment now matches the code: the bootstrap human or an active delegation.

**Unchanged, and pinned by test:**
- The TRH-10 review writers are byte-identical, pinned by digest.
- Artifact persistence is untouched.
- There is no new Governance subject, action kind, reviewer assignment, queue or `/approvals`
  integration.
- There are no provider calls, publishing, generation or arming.

## Verification

- **Final candidate:** `tsc` 0, lint 0, `next build` 0, full suite **781 passed / 0 failed**, each
  measured by its own exit code.
- **Real Postgres:** the batched state equals the released derivation. The latest decision wins.
  A decision on revision 1 does not mark revision 2 reviewed. A foreign tenant's artifact reads
  *unknown*. Reading writes nothing.

## Production acceptance — PASSED

The Director authenticated into the Turkish Rug House workspace and opened `/operations` on the
deployment above. The real prepared artifact rendered on its row:

- `Turkish Rug House — ilk Instagram içerik taslağı`
- current revision **2**, prepared for Instagram
- **`Governance review of revision 2: Changes requested`**, visible on the row without opening
  History.

No Governance decision was created for acceptance. The state shown is the one already recorded in the
ledger. A `no-authorized-tenant-context` screen seen earlier came from a different tenant and session
context and is not a CGO-8 regression.

## Still absent

Review is not publishing:
- Accepting a revision authorizes no publishing, sending, scheduling or execution.
- There is no Instagram, YouTube or TikTok publishing capability.
- There is no image or video generation, and no Higgsfield.
- Agent/model preparation still has no UI trigger.
- Prepared drafts carry no link to a provider connection or observation.

CGO-9 has not been selected, scoped, or started.

> **Superseded by CGO-9 (2026-09-17).** Agent/model preparation now has a UI trigger on `/operations`,
> and CGO-9 is released and production-accepted. See
> `hebun-cgo9-human-reachable-hebun-preparation-closure.md`.
