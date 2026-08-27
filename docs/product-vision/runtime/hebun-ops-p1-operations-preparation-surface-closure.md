# OPS-P1 — Operations Preparation Surface: Release Closure

**Status:** engineering/release record. Not runtime state, not an authority.
**Released implementation:** `9498cae5f800b78a30ab97ca291932cbe12736d5`, authored 2026-08-27 00:45:19 +0300.
**Parent:** `ba1025fc31591a1af8a57cfc13e0627eefb591fb` (A1a).
**Tag:** none — convention **measured**, not assumed. See §10.
**Production deployment:** `dpl_4rjZKxwND81auhC9KoaYxzuGuBxc` — target **production**, state **READY**,
`meta.githubCommitSha` = `9498cae5f800b78a30ab97ca291932cbe12736d5`, ref `main`, repo
`Hebun-AI/hebun-ai-recovered`. Aliased at `www.hebuntech.com`, `hebuntech.com`,
`hebun-ai-recovered.vercel.app`, the project alias and the `git-main` alias. The live alias lookup
for `www.hebuntech.com` resolves to this deployment id.
**Lifecycle reached:** designed · implemented · verified · **released** · **deployed** · **production-accepted**.
**Predecessors:** R3R (external recipient authority); R3W (work artifact authority); R3A.1 (proposal
inlet); `hebun-a1a-proposer-attribution-closure.md` (closed alongside this record).

> **Record provenance, stated so it cannot drift.**
> · Repository state, release commit, staged scope, authority topology, validation, firewall,
>   bite-proofs, schema/migration/ledger state and the canonical reference contracts —
>   **independently verified** by this process against the released tree.
> · Deployment identity, state, deployed SHA and alias set — **independently verified** via the
>   Vercel API.
> · Everything under §7 (the production UI rendering, the recipient, the draft, and their
>   references) — **Director-observed**. This process did not authenticate to production, created
>   no production record, and performed no production mutation.
> · The two canonical references in §7 were additionally **re-validated by this process** against
>   the released parsers, locally. That is a contract check on the strings, not a read of the rows.

---

## 1. What this closes

R3R made an external recipient durable. R3W made a prepared draft durable. Both shipped with an
authority, a reader, a reference format and server actions — and **no interface**. `/send` takes the
two canonical references those authorities mint, and there was nowhere for a human to obtain them.

The gap was never substrate. It was reach. OPS-P1 is the missing view layer and nothing more.

## 2. What shipped, and what emphatically did not

Seven files, `+1063/−0`: one import and one render slot added to the Operations page, four
components under `src/components/operations-preparation/`, and two test files under
`tests/ops-p1-flow/`.

It creates **no** authority, **no** server action, **no** route, **no** navigation destination, **no**
proposal path, **no** permit or execution path, **no** agent reach, **no** Governance widening, **no**
provider call, **no** schema and **no** migration.

## 3. The authorities remain the owners

The surface owns no state, mints no reference and writes nothing. Every mutation crosses a server
action that already shipped — all nine of them, unchanged in file and unchanged in number
(`actions.ts` exports twelve, byte-identical to its state at the parent commit).

`externalRecipients` has **exactly one** insert in the entire codebase, in
`write-external-recipients.server.ts`. `workArtifacts` and `workArtifactRevisions` insert only in
`write-work-artifacts.server.ts`. Those writers pre-date OPS-P1 and were not touched. A row of
either kind can therefore only have come from its authority.

A component holding a writer reference is a component that can be made to write directly, with the
tenant coming from wherever the caller says. None does. The firewall bans the writer modules, `@/db/`
and `drizzle-orm` from all four components, and the one module that *is* named — the work-artifact
read seam — may be named **only by a type import**, which is erased at build and grants no runtime
capability. The check is on the *kind* of import, not on the string: a blanket ban on the module name
would have forbidden a type while leaving a value import of the same module describable.

## 4. Preparation is not proposal

Nothing here proposes, approves, authorizes, executes or sends. There is no "Prepare for approval"
control. `recordActionRequest` keeps the single caller R3A.1 gave it — proved by walking every file
under `src/` for call sites rather than by grepping mentions — and `/send` in Heby remains the only
way a proposal is filed. What this surface produces are the INPUTS a human then names in that command.

## 5. Fields exposed, and fields withheld

Rendered: display name, endpoint kind and value, artifact title, type, current revision, revision
text, and the canonical reference.

Not rendered: `tenantId`, `endpointDigest`, `contentDigest`, `createdByActorType`,
`createdByActorId`, `authoredByActorType`, `authoredByActorId`, `sourceMessageId`, and the raw row
ids. None of these identifiers appears anywhere in the four components — absence is the proof — and
no whole-view spread exists, which is how a withheld field otherwise arrives without being named.

**References are consumed, never constructed.** Each arrives already formed from the authoritative
view (`RecipientView.recordRef`, `WorkArtifactView.currentRef`). A client that assembled
`work-artifact/<id>@<n>` itself could name a revision the server never resolved — exactly the drift
the `@<n>` suffix exists to make unrepresentable. The firewall bans the formatters, the prefix
constants and the template literals.

## 6. Three rules the surface states rather than hides

- **An address is never edited.** R3R has no update path for the address, the kind or the owning
  tenant, and a mutable address would silently re-point every approved-but-unspent permit naming it.
  The surface offers ADD and RETIRE and no third verb, and says so in one line where a human decides.
- **Retirement is not deletion.** The stored address is left exactly as it was, so a permit or audit
  row naming it still resolves to the same bytes. Retired recipients stay readable and are
  deliberately **not proposable** — they carry no reference to copy, because offering one would
  invite a `/send` the authority will refuse.
- **Unavailable is never rendered as empty.** Both authorities distinguish "read successfully, holds
  nothing" from "could not read". Collapsing them would state an organizational fact that was never
  established, so the surface says *unknown rather than empty* instead.

The Operations L2 is unchanged: exactly `Overview · Execution · Runtime & Signals · Execution
Substrate`, a `deepEqual` pin asserted both in the released `operations-legacy` suite and again in
OPS-P1's own firewall, so a fifth destination fails in this phase's suite rather than only in an
inherited one. The surface renders inside the workspace root, because both tools that can name an
artifact as a `record-ref` declare `ownerWorkspace: "operations"`.

## 7. Production acceptance — Director-observed

The Director signed in to production and used the released surface. Observed:

- `/operations` rendered both the **Recipients** and **Prepared work** sections.
- A recipient was created successfully. Canonical reference:
  `external-recipient/487c64be-e498-4a23-9efd-7664b53c0705`
- A prepared work artifact was created successfully — title **Test Email**, type **message-draft**,
  revision **1**. Canonical reference:
  `work-artifact/a45229f8-9776-4e7e-bbb7-9e92a7fe3a2f@1`
- Both references then **resolved successfully through `/send`**.

**This process re-validated both strings against the released parsers**, locally: each is well
formed, the artifact reference parses to `{artifactId, revisionNo: 1}`, and re-formatting it through
`formatWorkArtifactRef` reproduces the string byte-identically. Three malformed variants — a
non-uuid, a reference with no `@n`, and `@0` — are all refused.

That the references *resolved* is the load-bearing part. `proposeSendAction` resolves the recipient
against R3R and the draft against R3W before anything else, both tenant-scoped; a well-formed but
non-existent reference refuses at `recipient-not-found` / `draft-not-found` before reaching any
writer. A fabricated uuid could not have produced a receipt. Both rows therefore exist in
production, tenant-scoped, and — per §3 — could only have been written by their authorities.

**OPS_P1_PRODUCTION_ACCEPTED = YES.**

This process performed **no production mutation**. Its only production contact was read-only
deployment API calls and two unauthenticated `GET`s confirming that `/operations` and `/approvals`
return `307 → /login` — the route exists and the auth gate holds.

## 8. Validation evidence

- **506/506** full suite, rerun fresh in the release session, exit 0, both OPS-P1 suites inside it.
  Not an inherited number. The tree content hash was confirmed identical before and after.
- **12/12 bite-proofs bit.** Every guarantee mutated in the shipped source; each mutation is
  verified to have reached disk, restored in `finally`, asserted byte-identical, bounded at five
  minutes with a timeout reported **VOID rather than counted as a bite**, and matched against the
  *intended* failure reason rather than merely some failure.
- **Residue re-proved after the full suite**, which re-executes those mutating proofs: whole-tree
  hash unchanged, nine per-file checksums OK, `git status` identical to its pre-release state.
- Typecheck clean. Lint **0 errors**; 14 pre-existing warnings live in four unrelated files, none
  belonging to this phase.

## 9. Release mechanics

One commit, seven paths, `+1063/−0`, staged by explicit pathspec — never `git add .`, `-A` or
`commit -a`. Before push the live remote was re-measured with `git ls-remote` and confirmed to be
exactly the commit's parent; the push was fast-forward, with no force, no rebase and no history
rewrite. Seven unrelated untracked items were untouched throughout.

## 10. Tag decision

**Tag: none.** Measured, not assumed: none of the twenty commits preceding this release carries a
tag, and no closure commit in the current convention carries one. The convention in force is
untagged, and creating one here would invent a convention rather than follow it.

## 11. Final truth ledger

| | |
|---|---|
| DESIGNED | **YES** |
| IMPLEMENTED | **YES** |
| VERIFIED | **YES** — 506/506 rerun, 12/12 bit, byte-identical residue, typecheck + lint clean |
| RELEASED | **YES** — `9498cae…`, pushed, remote converged 0/0 |
| DEPLOYED | **YES** — production READY, deployed SHA independently verified |
| PRODUCTION_ACCEPTED | **YES** — Director-observed creation of both records, both references resolved through `/send` |

NEW_AUTHORITY = **NO** · NEW_SERVER_ACTION = **NO** · NEW_ROUTE = **NO** ·
NEW_NAV_DESTINATION = **NO** · NEW_PROPOSAL_PATH = **NO** · EXECUTION = **UNCHANGED** ·
AGENT_SYSTEM = **UNCHANGED** · GOVERNANCE = **UNCHANGED** · SCHEMA_CHANGED = **NO** ·
MIGRATION_ADDED = **NO** · LEDGER = **36**

## 12. Remaining limitations

- **Payload minimization debt.** Full view objects cross the server/client component boundary as
  props, so fields that are never *rendered* may still be serialized into the RSC payload:
  `WorkArtifactView.tenantId`, `RecipientView.endpointDigest`, and the `RecipientView` `createdBy`
  pair. **This is not recorded as a data leak, because the repository evidence does not support that
  stronger claim**: each value belongs to the viewing tenant's own records, reaches only that
  authenticated viewer, and every read remains tenant-scoped server-side. It is recorded as payload
  minimization debt — the surface should hand its client sections a narrowed projection rather than
  the full view. Unfixed, and deliberately out of scope for a view-layer completion.
- **Validation is structural.** No component was rendered and no database opened by the suites; the
  firewall reasons over source. Production behaviour is Director-observed (§7).
- **Duplicate titles.** Two drafts may carry the same title; only the reference distinguishes them.
  Pre-existing R3W behaviour, untouched here.
- **One tenant.** Production holds one organization, so cross-tenant isolation is proved by suite,
  never in production.
- **The `/approvals` presentation problem** surfaced during acceptance is recorded in the A1a
  closure §8 and deferred to a discovery phase. It is not a defect of this phase.

## 13. Closure boundary

OPS-P1 let a human reach two authorities that had shipped without a door. It recorded an address and
a draft, and it did nothing else: it filed no proposal, asked nothing of Governance, issued no
permit, caused no effect, and added no authority to the system it completed.

The lesson worth keeping is that a capability nobody can reach is indistinguishable from a
capability that does not exist — and that closing that distance is a *view* problem, solvable
without touching a single authority, provided the view is disciplined enough to consume references
it is forbidden to construct.
