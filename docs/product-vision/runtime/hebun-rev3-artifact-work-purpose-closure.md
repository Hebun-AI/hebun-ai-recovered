# REV-3 — Declared Work Purpose on the Prepared-Work List — CLOSED / PRODUCTION-ACCEPTED

**Release** `98ac029` · **ZERO schema** · **Production ledger 47, unchanged** · **Deployment**
`dpl_8T4NK8uhMKZ5fCbk1SATE7pLRBRG` (`98ac029`), superseded in place by
`dpl_7pao2DtCF1badnSG6y4sCiFMXz3A` (`3f6ffe8`, the closure commit's own auto-deploy) — both serving
byte-identical surface code, proved below — aliased to `www.hebuntech.com`

**Both halves are accepted, and they were accepted by different means.** The data half was accepted
from an operator shell through the released read seams. The rendered half was accepted by the
**Director**, inspecting the real authenticated production `/operations` surface. Neither half is an
automated browser test, and this record claims none.

---

## The name

`WEV-2` was the provisional name and is **rejected**. This phase changes nothing about the
work-evidence relationship — WEV-1 owns it and keeps owning it. What changes is what the
`/operations` prepared-work row says, which is the `REV` line: REV-1 put authorship on the revision
view, REV-2 put it on the row, REV-3 puts the declared work relationship there. The name follows the
surface, because the surface is the only thing this phase touches.

---

## What Hebun can now do that it could not

    Before:  seven prepared drafts, and no way to tell which serve recorded work
    After:   each row says which recorded work declares it — or says plainly that none does

---

## The finding that made this smaller than proposed

Discovery described a missing reverse *read seam*. **It does not exist as a gap.** WEV-1's own header
already says:

> `WORK → REFERENTS` … `REFERENT → WORK` … Both are the SAME Work-owned relationship read the same
> way and grouped differently by the caller. A second seam for the inverse would have been a second
> authority for one relationship.

The schema agrees: `work_evidence_references_tenant_artifact_idx` exists precisely to serve the
inverse. **So no reader was built.** `artifact-work-purpose.ts` performs no query, holds no database
handle, takes no tenant and contains no `await` — it arranges two released Work reads by artifact,
which is exactly the grouping WEV-1 anticipated. A test pins its entire import list to two released
seams' types plus the work vocabulary.

---

## Where the composition lives, and why not in the artifact reader

In the page's **server component**, not inside `listWorkArtifacts`.

`read-work-evidence.server.ts` already imports `listWorkArtifacts` in order to resolve referent
labels. Folding the inverse into the artifact reader would **close an import cycle** and, worse,
make the artifact authority a participant in a relationship it does not own. A test asserts
`read-work-artifacts.server.ts` still names no work-evidence module at all.

The artifact listing this surface has already fetched is passed into the evidence read through the
released `listArtifacts` injection point, so resolving labels costs **no second artifact query**.

---

## Cardinality is many, and is not collapsed

The unique index is `(tenant_id, work_item_id, work_artifact_id) where withdrawn_at is null` — one
artifact may be declared by **several** work items. Production holds exactly one declaration today,
so a projection returning a single work item would be **correct by accident and wrong at the second
declaration**. Every artifact maps to a list, and the suite proves two work items declaring one
artifact **without duplicating its row**.

---

## Three states, deliberately distinct

| State | Rendered |
|---|---|
| Read failed | *"…whether this draft serves recorded work is UNKNOWN — not known to be nothing."* |
| Read succeeded, nothing declared | *"Not declared as evidence for recorded work."* |
| Declared | *"Declared evidence for: `<work item>` · declared `<state>`"*, one line per work item |
| Declared, register could not name it | *"Declared evidence for recorded work Hebun could not name here."* |

A read failure can never render as "serves no work": only an **available** index yields an empty
list. A work item the register could not name is **kept as unresolved rather than dropped**, because
dropping it would turn *"Hebun could not name this work"* into *"this draft serves no work"*.

---

## What a declaration does NOT establish

    DECLARED EVIDENCE != PURPOSE FACT != APPROVAL != USE != OUTCOME

Said above the rows, adjacent to the relationships it bounds: a declaration records that **one human
declared that this work concerns this draft**. It does not say the draft was written for it, that
anyone used it, that it was reviewed, accepted or approved, or that the work progressed because of
it. The work state shown is what the organization **declared**, never what Hebun observed.

**No approval, review or rejection exists in the artifact authority, and none is created here.**
Lifecycle remains exactly `draft | retired`, asserted by test. A retired artifact keeps its
declarations — retirement and withdrawal are two different authorities' acts, and the suite pins it.

---

## Authority, security, non-effects

| | |
|---|---|
| **Relationship owner** | Work Authority (WEV-1), unchanged. No write path exists from this surface |
| **Tenancy** | from the authenticated session; the evidence seam takes no tenant/work/referent parameter, so a cross-organization read is **unrepresentable**, not merely refused |
| **Schema / persistence** | **none** — ledger 47 |
| **Provider / governance / execution** | none invoked, none changed |
| **Withheld** | no tenant id, actor id, digest, declarer, reference id; the work item **id is never displayed** (it is used only as a React list key, asserted) |
| **Reading records nothing** | three repeated reads leave artifacts, work items, references and versions identical |

---

## Production acceptance — data half, ACCEPTED

Through the released seams at the deployed commit, for the Director's real tenant:

| Artifact | Row now says |
|---|---|
| **Loom weaving reel — three knots per centimetre** | **Declared evidence for: Hebun Era III development · declared active** |
| CGO-7 observed reel caption | Not declared as evidence for recorded work. |
| Rug washing video caption | Not declared as evidence for recorded work. |
| Agent-prepared reel caption — hand-knotted weaving | Not declared as evidence for recorded work. |
| Provenance Acceptance Note · Hebun Production Acceptance Note · Test Email | Not declared as evidence for recorded work. |

**LINKED 1 · UNLINKED 6 · total 7**, matching discovery exactly. Declarations per artifact from the
authority's own table: one artifact, one declaration. `authoredByActorId` absent from every row.
**Every counter identical before and after** — artifacts, revisions, work items, evidence references,
knowledge, decisions, proposals, executions, integrations, credentials, audit log.

### Accepted — the rendered half, by the Director

**Director UI acceptance: PASS.** The real authenticated production `/operations` surface was
inspected and visibly rendered **both** cases:

| Case | Rendered |
|---|---|
| **Positive** — *Loom weaving reel — three knots per centimetre* | **"Declared evidence for: Hebun Era III development · declared active"** |
| **Negative** — multiple artifacts | **"Not declared as evidence for recorded work."** |

**This is Director-observed production UI evidence. It is real acceptance evidence and it is NOT an
automated browser test.** No browser automation ran against the authenticated surface at any point in
this phase, no screenshot was produced by this session, and none is claimed. What a person confirms
they saw is different in kind from what a suite asserts, and collapsing the two would misdescribe the
evidence.

**What the render acceptance proves, exactly:** that a declared relationship is visibly rendered when
one exists, that the recorded work item's name is visible, that its declared state is visible, and
that an artifact without a declaration visibly renders the explicit negative.

**What it does not prove, and what nothing in this phase claims:** approval, review, acceptance of
the artifact, publication, usage, work progress caused by the artifact, observed work state,
execution, or provider activity. Those semantics are unchanged.

---

## Post-acceptance corroboration — READ-ONLY, against production

Re-run of the released seams after the Director's inspection, to confirm no repository or production
evidence contradicts what was seen:

- **The positive case still resolves to the exact strings reported**: *Loom weaving reel — three
  knots per centimetre* → *"Declared evidence for: Hebun Era III development · declared active"*.
- **Six artifacts still resolve to the negative**, matching *"multiple negative cases"*.
- **LINKED 1 · UNLINKED 6 · total 7**, one declaration on one artifact from the authority's own table.
- `authoredByActorId` absent from every row.
- **All eleven counters identical before and after** — artifacts, revisions, work items, evidence
  references, knowledge, decisions, proposals, executions, integrations, credentials, audit log.
  **Reading recorded nothing.**

### The deployed identity, measured

Production serves **`3f6ffe8`** — the closure commit, because pushing a closure auto-deploys. Measured
by API rather than inferred: `githubCommitSha 3f6ffe8…`, `ref main`, `READY`, serving
`www.hebuntech.com`.

Its delta from the release `98ac029` is **328 added lines across one script, one document and
`learnings.md`, and zero files under `apps/dashboard/src/`**. All three REV-3 surface files hash
identically at both commits:

    prepared-work-section.tsx    498406bab93050b0
    artifact-work-purpose.ts     7a726964ac3c5994
    operations-preparation.tsx   ad44dc6a3c44d7a4

So the surface the Director inspected **is** the released surface.

---

## Tests

New `tests/rev3-artifact-work-purpose/work-purpose-and-boundaries.ts`: the wording refusing the five
upgrades, the projection proved pure and reader-free, the artifact seam proved still ignorant of
work, the three rendered states distinguished in code, unavailable-in/unavailable-out, the capability
against real writers, **many-to-many cardinality with no row duplication**, tenant isolation both
ways, unauthenticated failing closed, repeated reads mutating nothing, and REV-2/History/retire/two-
lifecycle-states all still behaving.

**Suite 677 passed / 1 failed / 678.** The failure — `tests/hebycap1-flow/capability-truth.ts`,
`/work-activity` has no capability binding — is **pre-existing and deterministic**, untouched.
`tests/ama1-agent-mandate/bite-proofs.ts` passed again: **intermittent** under suite ordering,
neither caused nor fixed here. `tsc --noEmit` clean · lint 0 errors · build green.

### One released pin rewritten, not relaxed

OPS-P1 pinned `operations/actions.ts` at twelve server actions to defend *"this surface adds no new
capability"*. REV-3 adds a thirteenth that is a pure **read**, so a count can no longer tell a read
from a write. The invariant is now asserted directly: the new action's body contains **no
`revalidatePath`** — the tell every mutating action in that file carries — and **no writer name**.

---

## Truth limitations

- **Declared is not used.** Nobody has shown the draft was used for that work, or that the work
  advanced because of it.
- **The work state is declared, never observed**, and travels with that word.
- **Six of seven drafts are attached to nothing**, which is a true statement about declarations and
  not a judgement about the drafts.
- **The relationship is one human's declaration**, recorded by the Work Authority, and this surface
  cannot create, edit or withdraw one.
- **The render was confirmed by a person, not a machine.** One human, one surface, one session. It
  establishes that both states render and read truthfully — not that every artifact, browser,
  viewport or future row does.
- **The many-to-many case has never rendered in production.** Production holds exactly one
  declaration, so the multi-work-item line is proved by test only.

---

## Concurrent work excluded

`docs/…/hebun-google-picker-1-expired-token-refresh-closure.md` (another workstream, modified) and
seven untracked paths — three P3 durable-rollout docs, `.mcp.json`, `.claude/`, `.shots/`,
`scripts/kr2-benchmark/`. None staged; `learnings.md` verified clean before appending.

---

## Repository parity

`HEAD` = `origin/main` at closure. The deployment serving `www.hebuntech.com` runs the release
commit's surface code, byte-identical as proved above.

---

## Next evidence-backed gap, NOT started

**Retirement attribution** — re-measured again at this release and still unavailable: `retired 0`,
max `version` 1, nothing ever updated. Approval remains undefined and must not be invented.
