# HEBY-CAP1 — Tenant-Resolved Command Capability Truth: Release Closure

**Status:** engineering/release record. Not runtime state, not an authority.
**Released implementation:** `bb20a1a7e8d1f3f1bd69649caa5b0ca2f67def99`, authored 2026-08-26 20:10:54 +0300.
**Parent:** `098699061b8ea48f393321db2a427f7d6a7dc913`.
**Documentation correction (separate commit, no product code):** `9d7a5ca84b79f8c9e18c2fecfb272aeb7f8821ab`.
**Baseline of this record:** `9d7a5ca…` (`origin/main`, 0 ahead / 0 behind at authoring).
**Tag:** none — convention **measured**, not assumed. See §10.
**Production deployment of the product code:** `dpl_3sSU7ET5Cynm5uLytwqaW7L1oGGL` — production,
**Ready**. `gitSource.sha` = `bb20a1a7e8d1f3f1bd69649caa5b0ca2f67def99`.
**Currently serving `www.hebuntech.com`:** `dpl_2GBjyCWJpEjG224adZ2rZbruPbxs`
(`meta.githubCommitSha` = `9d7a5ca…`). `git diff bb20a1a 9d7a5ca -- apps/` is **empty**, so the
serving deployment carries byte-identical product code. Recorded rather than glossed: the aliased
SHA is not the product SHA, and the two are reconciled by a measured empty diff, not by assertion.
**Lifecycle reached:** designed · implemented · verified · **released** · **deployed** · **production-accepted**.
**Predecessors:** `hebun-int-5b1-github-provider-record-read-closure.md`;
`hebun-int-5c-cross-source-grounding-closure.md`; `hebun-github-4-repository-activity-closure.md`.

> **Record provenance, stated so it cannot drift.**
> · Repository, validation, staging and release facts — **independently measured** by this process.
> · Deployment status, deployed SHA and alias set — **independently measured** by this process via
>   the Vercel CLI and REST API.
> · The production `/help` invocation — **Director-observed**. The Director authenticated into
>   production Heby and submitted the command; the rendered text was returned verbatim. This
>   process did **not** execute `/help` and did not authenticate to production.
> · The reconstruction of that text from released source, and the counterfactual renders — **this
>   process**, executed locally against the released module.
> · **No production database census was performed for this phase.** §9 says exactly what that costs.

---

## 1. What this closes

`/help` rendered `HebyCommandDescriptor.availability` directly. That field is **release-time
vocabulary**: it says whether a command shipped in a runnable state, and it has never known
anything about the organization asking. Every tenant was therefore told the same thing.

An organization with no usable GitHub connection was told `/repositories` was available, ran it,
and was refused by the seam that actually knows.

Telling somebody a capability is available and then refusing it is not a UI blemish. It is Hebun
asserting an organizational fact it never established — the one thing this codebase spends its
firewalls preventing everywhere else.

## 2. What shipped, and what emphatically did not

`command-capability-projection.server.ts` is a **projection**. It composes authorities that already
exist and owns no capability state of its own. It is not a capability authority, not a registry,
not a catalog, not a cache. Delete it and no truth is lost — only the composition.

Three authorities, and this phase adds no fourth:

| Authority | Owns | Scope |
|---|---|---|
| `integration-authority/capability-availability.server.ts` (I1) | whether a capability is usable | tenant |
| `heby-provider-ops/provider-connectivity-projection.server.ts` | model availability | global (R5.1) |
| the command registry | what a command **is**, never whether you may run it | release |

`registry.ts` is **untouched**. `HebyCommandKind` is **unchanged**. No provider permission was
expanded. No Governance, Knowledge, or action/execution authority changed. **Zero schema, zero
migration, ledger remains 36.**

## 3. Four states, kept apart on purpose

`CommandCapabilityState` is deliberately **not** `HebyCommandAvailability`. Spelling them the same
way is precisely how one came to be read as the other.

- **`available`** — a released authority affirmatively says this can run now. Permission to
  attempt. Not a promise the attempt succeeds: available ≠ authorized ≠ executable ≠ executed ≠
  successful.
- **`unavailable`** — a released authority affirmatively says it cannot. An **established** denial,
  carrying that authority's own sentence.
- **`unknown`** — no authority answered. **Fails closed.** Never collapsible into either
  neighbour: *"you cannot"* and *"Hebun could not find out"* are different facts. A **thrown**
  authority yields `unknown`, never an empty view — otherwise a database outage would render as
  *"your organization has connected nothing"*.
- **`reserved`** — registered and inert. **Terminal**: checked first, before any authority speaks,
  so no positive answer can un-reserve an execution command.

Availability is never derived from a credential existing, a provider catalog entry, a UI surface
existing, `NODE_ENV`, seeded state, or the **absence** of data.

## 4. The absence of the view is itself meaningful

A surface that resolves no tenant server-side supplies no view, and `/help` then renders
**UNKNOWN** — it never falls back to the registry's release-time field, because *that fallback is
the defect*. But UNKNOWN is not applied indiscriminately, which would be its own untruth:
reserved-ness, and "this shipped needing a source", are facts about the **build** that no tenant
answer overrides.

## 5. Validation evidence

- HEBY-CAP1 targeted suites (`capability-truth`, `capability-firewall`): **pass**.
- **46/46** directly affected released suites: **pass**.
- Bite-proofs: **12/12 mutations bit** (M1–M12). Byte-identical restoration proved by SHA-256
  manifest before and after; the working tree was unchanged.
- typecheck exit 0. lint exit 0 (14 pre-existing warnings, **none** in candidate files).
- Full suite: **`498 passed, 0 failed, 498 total`** — **rerun**, not reused. Candidate identity to
  the previously reported tree could not be cryptographically proved from the release session, so
  the prior figure was not cited as fresh.
- Import graph re-proved by an **independent** closure walker, not only by the suite's own:
  **152 files**, all three authorities reachable, and **zero durable-write shapes** across all 152.

## 6. Production acceptance

The Director authenticated into production Heby and submitted `/help`. The complete rendered output
was returned verbatim.

### Reconstructed character-for-character from released source

`/help` was rendered locally from the released module with the two authorities answering
`available` (for `GITHUB_REPOSITORY_ACTIVITY_CAPABILITY`) and `AVAILABLE` (model), and diffed
against the Director-observed text:

```
diff evidence.txt rendered-available.txt   ->  no difference
sha256  086a864ad7a853deb8a0270dda36225e97dc57170eea33f022f9e1b44797f69d   (both files)
```

**Byte-identical.** The registry holds 46 palette commands; the production output contains exactly
46, in the exact category order `Conversation · Context · Analyze · Navigate · Security · Knowledge
· Platform · Agents · Actions · Future capabilities`.

### The match is discriminating, not vacuous

A reconstruction proves nothing if every input produces the same text. Three counterfactuals were
rendered from the same released module; **none** equals the production evidence:

| Counterfactual | What changes |
|---|---|
| I1 answers `not-connected` | `/repositories` and `/repository-knowledge` gain `— not available now: …` |
| model answers `UNAVAILABLE` | all 7 model-governed commands gain `— not available now: The model is not currently usable (UNAVAILABLE)…` |
| **no capability view at all** | the 7 model-governed commands render `— availability UNKNOWN for your organization right now`, **and** the release-unavailable commands degrade to the generic `— not available yet` |

### Two independent proofs the view was present in production

1. The closing sentence is the `view`-truthy branch, verbatim: *"Availability above was read for
   your organization just now from Hebun's own authorities. It is a CURRENT READ, not a future
   guarantee — and being able to attempt something is not the same as being authorized to do it, or
   as it succeeding."*
2. The seven release-unavailable commands carry their **authoritative** reasons
   (`— not available now: <registry reason>`), not the view-absent generic `— not available yet`.

Tenant-resolved command capability truth therefore reached the production tenant. This is the
load-bearing acceptance fact.

## 7. Per-contract acceptance findings

| Contract point | Production result |
|---|---|
| GitHub-dependent commands reflect the tenant-resolved authority | **PASS** — `/repositories` and `/repository-knowledge` render bare, which requires the I1 seam to have affirmatively answered `available` for this tenant. Counterfactual A proves a different answer renders differently. |
| Unavailable commands carry authoritative refusal reasons | **PASS** — all 7 carry the registry's own `unavailableReason` verbatim, not a generic string. |
| Reserved execution commands remain RESERVED | **PASS** — all 10 render `— reserved, no execution runtime` **while both runtime authorities were answering positively**. Terminality was demonstrated under maximally favourable conditions, which is the only condition under which the claim is worth anything. |
| No UNKNOWN silently converted to AVAILABLE | **PASS** — structurally impossible: `unknown` renders `— UNKNOWN, not denied: <reason>` and no code path renders it bare. Zero UNKNOWN appeared, meaning both authorities answered; nothing was converted. |
| AVAILABLE presented only as permission to attempt | **PASS** — stated verbatim in the closing sentence. |
| Output identifies itself as a current authority read | **PASS** — *"read … just now from Hebun's own authorities … a CURRENT READ, not a future guarantee"*. |

## 8. No provider I/O from `/help`

Static, and independently re-derived for this record:

- `selectModelTransport` contains **zero `fetch` and zero `await`** — a pure synchronous selector.
- `readProviderOpsView` invokes it synchronously; its only `await` is a control-plane read.
- The 152-file closure contains **zero durable-write shapes**.

Measured in production: the output's final line is `LOCAL_PROVENANCE` (`dispatch.ts:129`) —
**"Local — Heby's own interface state. No model was used."** Production stated for itself that
answering `/help` consumed no model.

### One evidence-strength limitation, stated rather than engineered away

The module header presents the no-network guarantee as proved behaviourally by resolving the whole
view under a global `fetch` that throws. All **16** `readCommandCapabilityView` call sites in the
suite inject **both** authorities, so the real `readProviderOpsView` — the reason the transport
appears in the import graph at all — is never executed by that test. The guarantee holds on the
static evidence above; the comment claims more for that one test than it delivers. Not
release-critical: no product behaviour depends on it. Recorded so a later reader does not mistake
the prose for the proof.

## 9. Non-mutation — structural, plus production's own statement

`/help` makes no GitHub request, no Google request, no provider record read; creates no credential,
no Knowledge fact/node/reference, no Governance decision/session, no action permit/request/
execution; persists no capability state; performs no schema or migration operation.

**How strongly that is proved, and how strongly it is not.** The 152-module closure contains zero
write shapes — a structural impossibility argument, and the strongest form available without
touching production. Production's `LOCAL_PROVENANCE` line adds a measured statement that no model
was used.

**There is no measured before/after production database delta for this phase**, and this record
will not manufacture one. No BEFORE census was taken prior to the Director's invocation, and a
BEFORE invented afterwards would be a fabrication rather than evidence. INT-5C's closure carries a
measured census; this one does not, and the difference is real.

## 10. Release mechanics

Two commits, deliberately not mixed:

- `bb20a1a…` — product only. 9 paths: `heby/page.tsx`, `heby-workspace-client.tsx`,
  `use-heby-conversation.ts`, `contracts.ts`, `dispatch.ts`,
  `command-capability-projection.server.ts`, and three `tests/hebycap1-flow/` files.
- `9d7a5ca…` — the INT-5C documentation correction alone.

Staged with explicit pathspecs only; never `git add .`, `-A`, or `commit -a`. Before each push the
live remote was re-measured with `git ls-remote` and confirmed to be exactly the commit's parent;
each push was fast-forward, with no force, no rebase, no history rewrite. 75 unrelated untracked
items were untouched throughout.

**Tag: none.** Measured, not assumed: the most recent tag sits 14+ commits back, and the five phase
releases since it — INT-5A, INT-5B1, GITHUB-4, KR-EXT1 and the production migration authority — are
all untagged. The convention in force is untagged.

## 11. Final truth ledger

| | |
|---|---|
| DESIGNED | **YES** |
| IMPLEMENTED | **YES** |
| VERIFIED | **YES** — 498/498 rerun, 12/12 bit, typecheck + lint clean |
| RELEASED | **YES** — `bb20a1a…`, pushed, remote converged |
| DEPLOYED | **YES** — production Ready, deployed SHA independently verified |
| PRODUCTION_ACCEPTED | **YES** — Director-observed `/help`, reconstructed byte-identically, discriminating against three counterfactuals |

NEW_CAPABILITY_AUTHORITY = **NO** · NEW_REGISTRY = **NO** · EXECUTION_RUNTIME_CREATED = **NO** ·
PROVIDER_PERMISSION_EXPANDED = **NO** · SCHEMA_CHANGED = **NO** · MIGRATION_ADDED = **NO** ·
LEDGER = **36**

## 12. Remaining limitations

- **No measured production database delta** (§9). Non-mutation is structural plus production's own
  provenance line, not a counted before/after.
- **The suite never executes the real authorities** (§8): all 16 call sites inject both, so the
  exploding-`fetch` test proves less than the module header claims for it.
- **The capability seam's affirmative answer was observed, not audited.** Production rendering
  `/repositories` as available establishes that I1 said `available` for this tenant; this record did
  not separately verify the installation state that produced that answer.
- **One tenant.** Cross-tenant capability isolation is proved by suite (`TENANT_A` vs `TENANT_B`),
  never in production, because production has one organization.
- **The aliased deployment is the docs commit**, reconciled to the product SHA by a measured empty
  `apps/` diff rather than by being the same deployment.

## 13. Closure boundary

HEBY-CAP1 made `/help` tell one organization the truth about itself. It created no planning, no
candidate generation, no routing, no natural-language command selection, no orchestration, no
agents, no workflows, no task planning and **no execution runtime**. The ten reserved commands are
exactly as inert after this phase as before it, and were observed to be so in production while both
runtime authorities were answering positively.

Being able to attempt something is still not the same as being authorized to do it, or as it
succeeding. That sentence is now in the product, not only in this record.
