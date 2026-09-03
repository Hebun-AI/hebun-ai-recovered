# CGO-7 — Observed Public Performance as Preparation Evidence — CLOSED / PRODUCTION-ACCEPTED

**Release** `020c4ec` · **ZERO schema** · **Production ledger 47, unchanged** · **Deployment**
`dpl_Ck7jf47rAZZ8rWFV6MztUj8ehCbz`, running `020c4ec` on `main`, aliased to `www.hebuntech.com`

---

## The enterprise job

> Hebun should be able to use real public platform observation together with organizational context
> to improve preparation of the next content, **without turning provider-derived metrics into
> organizational truth.**

CGO-6 closed by naming this as the next gap, and by naming the thing that makes it hard: the
capability is not "read YouTube" — CGO-5 released that and it was production-accepted. The capability
is truth semantics strong enough that *high views* never reaches a model as *good content*.

    Before:  organizational purpose + recorded knowledge + prior drafts → next content
    After:   + what a public platform reported about a public channel at one moment,
             fenced, unstored, and never this organization's own record

---

## The architecture decision this phase turned on

CGO-6 refused to add a provider class to the Operations workspace profile, and gave a reason:
a view count is not an organizational record, and folding it in beside classes that ARE the
organization's own would make an outside number read like something this organization established.

**That reason did not expire when this phase decided to use the observation. It decided WHERE.**

The model receives two separately-labelled channels, and they have different semantics:

| | Grounding context | Preparation brief |
|---|---|---|
| Carries | this organization's own records | instruction to the model |
| Honoured for | every answer | only a `prepares: true` intent |
| Stored | as durable answer-source evidence (G6D) | never, anywhere |
| Is evidence | yes | no |
| CGO-6 asserts | contains no provider material | — |

A provider observation enters the **brief**. Not the grounding context, not a message row, not
`heby_answer_source_evidence`, not any table.

**No source class was minted, and the omission is the design.** Minting one would have put a provider
metric into the evidence channel with organizational standing, persisted it as this answer's
evidence, and made every ordinary answer from a profile declaring it spend provider quota. All three
are costs the capability does not need to pay to do its job. CGO-6's closure predicted a new class
would be required; discovery found the brief channel already had exactly the semantics needed, and
the prediction is superseded rather than followed.

---

## What was built

| Module | What it is |
|---|---|
| `content-observation/observation-brief.ts` | Pure. Renders one observation as a fenced supplement. Imports the provider **vocabulary** and nothing that can make a call. |
| `content-observation/prepare-with-observation.server.ts` | The composition root. The only new module that reaches a provider. |
| `work-artifacts/preparation-brief.ts` | Gains one optional **string**; still imports `./contracts` and nothing else. |
| `work-artifacts/prepare-work-artifact.server.ts` | Gains one optional **string** field and **not one import**. |

**No server-action boundary was added, and the omission is deliberate.** Ten released tests pin the
exact set of `src/app/**/actions.ts` files so that adding one is a visible act rather than a side
effect. This capability needs none: it is reached exactly as `prepareWorkArtifact` itself is — as a
server seam — and CGO-3, CGO-4 and CGO-6 were each released and production-accepted that way. An
action wrapping a seam no surface calls would have been ten pin edits bought with nothing. The
consequence is stated plainly under *Reachability* below.

**Zero schema. Zero new provider operation, scope or credential. No new authority. No new source
class. No ninth workspace. No persistence of any kind.**

`src/features/work-artifacts/` still reaches no provider transport, credential frame or read seam —
proved by walking the real import graph, not by a token scan, because a token scan cannot see a
provider reached through an import. That is why the composition is a separate module and why what
crosses into preparation is a string.

R3W's firewall names `operations/actions.ts` and claims no R3W file reaches an outbound call. That
claim is still true, unchanged, and was worth keeping true — which is a second reason the
composition lives in its own feature module rather than inside the Operations action file.

---

## Authority and provenance

| Truth | Owner | Standing |
|---|---|---|
| The observation | YouTube, via the CGO-5 provider-observation authority | `authoritative: false`, provider-derived, live, unstored |
| Knowledge in the same preparation | Organizational Knowledge authority | unchanged — carries its own lifecycle |
| Declared work | WORK-1's record | unchanged — **declared, never observed** |
| The prepared draft | the tenant's durable agent | unchanged — prepared, not approved |

Every distinction the capability could destroy is **said to the model, before the first number**:

    provider observation  ≠  organizational Knowledge
    declared Work         ≠  observed performance
    views/likes/comments  ≠  content quality
    a high number         ≠  success
    absent                ≠  zero
    observation           ≠  recommendation
    recommendation        ≠  decision
    prepared              ≠  approved

Adjacency, not mere presence — the rule CGO-2 established. A test asserts every denial precedes the
first rendered number, and that the reported-facts half of the block contains no judgement,
no ranking and no recommendation. Videos are rendered in **publication order, never metric order**:
sorting by views would be the renderer deciding which video did better, the exact judgement it holds
no evidence for.

---

## Bounds

- **One observation per preparation.** Three quota units — CGO-5's cost, not a second budget.
- **One page**, at most 10 uploads, and it says when it is partial.
- **10 second budget.** An elapsed budget is its own disposition: *nothing is known*.
- **Only a content draft.** The other two artifact types carry no brief, so naming a channel for one
  is refused **before any read** and spends no quota.
- **A failed observation never costs a human their draft.** It degrades to exactly CGO-6 behaviour,
  and the disposition says which of five things happened, so degrading is never silent.

---

## Also repaired

`scripts/cgo6-acceptance.ts` did not typecheck at `11496b4` — it read `prepared.revision` and
`prepared.content`, neither of which the seam returns. `tsc --noEmit` had been failing on `main`
since CGO-6 released; `tsx` strips types, so the script ran anyway and printed
*"(content not returned by the seam)"* where the draft should have been. Repaired to the real fields.

---

## Reachability, stated separately

| | |
|---|---|
| **designed** | yes |
| **implemented** | yes — two modules, two one-field edits |
| **configured** | nothing to configure. No new env, no new scope, no new credential |
| **connected** | yes — the production YouTube connection CGO-5 established, unchanged |
| **verified** | yes — full local suite, one live production observation |
| **available** | as a **server seam**, not as a product surface. There is no UI and no server action, exactly as CGO-3, CGO-4 and CGO-6 are today. `prepareWorkArtifactAction` itself has no caller either |
| **executed** | **yes** — one live observation and one real production draft, below |

---

## Truth limitations

- **Observed is not understood.** Hebun can report what a platform said. It cannot say why.
- **No causal claim is made or measurable.** Nothing here proves a draft written with an observation
  is better than one written without it, and nothing in the repository could prove that today.
- **The observation is a single moment.** No history is kept, no trend is computed, and asking again
  re-observes rather than comparing.
- **A public channel is not this organization's channel.** The handle is a runtime argument and
  asserts no ownership; the API key identifies nobody.
- **The model is told nothing about an absent observation**, deliberately: a brief describing what is
  missing would invite writing about the absence. The human sees the disposition instead.
- **The fence is instruction, not enforcement.** It is the strongest available control at the
  generation boundary and it is not a guarantee about what a model writes. The released output
  validator is unchanged and judges the reply exactly as before.
- **Prepared is not approved, approved is not scheduled, scheduled is not published,
  published is not delivered, delivered is not seen.** Unchanged.

---

## Production acceptance

Executed against production data through the released code at the deployed commit. **One real live
YouTube observation** and **one real billable model call**, end to end.

### What happened

| | |
|---|---|
| **OBSERVED** | `@Candamlalari` — *Can Damlaları*, 140 public videos, 967,685 public views, 3,930 subscribers, **10 recent uploads**, **3 quota units**, read live in **1,250 ms** |
| **PREPARED** | artifact `18a0ac6e-eaea-4218-bd22-5aa6f2139784`, revision 1, `content-draft` · `instagram` · `operations`, in **5,872 ms** |
| **Disposition** | `observed` — the supplement was built and handed to the preparation seam |

The stored draft, verbatim and in full:

> Three knots per centimetre. Hours of hand-knotting become something whole. Then comes the
> water—rinsing away the dust of making—and the sun does what only sun can do. Finished, cleaned,
> alive in the light. This is what patience looks like when it's drying.

**It contains no number, no metric, no performance claim, no ranking and no recommendation** — which
is what the fence exists to produce, and is reported as an observation of one draft rather than as
proof the fence cannot be broken.

### The central claim, measured in production

The observation reached the model and reached **nothing else**:

| Where a leak would show | Measured |
|---|---|
| The stored draft | `0` revisions containing `viewCount`, `subscriber` or `youtube` |
| Durable answer-source evidence | `0` rows with a YouTube source class or a `youtube/` record ref |
| Message rows | `0` messages naming the channel, the handle or any observed figure |
| Knowledge | `knowledge_nodes` **2, unchanged** — observing a public channel admitted nothing |

The 22 evidence rows the accepting answer *did* record are the organization's own, exactly as CGO-6
released them:

| Source class | Rows | Authoritative |
|---|---|---|
| `governance` | 3 | yes |
| `work` | 2 | yes |
| `operations` | 11 | no |
| `work-artifacts` | 6 | no |

`knowledge` resolved nothing for this prompt — the pre-existing production retrieval limitation
(`pg_trgm` is not installed), not an effect of this phase.

### Non-effects, measured

| Claim | How it was proved |
|---|---|
| Zero schema | Production migration ledger **47**, unchanged |
| Exactly one artifact | `work_artifacts` 6 → **7**, `work_artifact_revisions` 6 → **7** |
| No Knowledge written | `knowledge_nodes` **2**, unchanged |
| No Work written | `work_items` **2**, unchanged |
| No connection lifecycle change | `integrations` **3**, unchanged; the YouTube connection untouched |
| No credential change, no Google refresh | `integration_credentials` **21**, unchanged across the run |
| No Governance, no proposal, no execution | `decision_records` **7**, `heby_action_requests` **5**, `action_execution_attempts` **1** — all unchanged |
| No provider write, publishing or scheduling | None exists to make: the provider exposes three `list` operations and no write half |

### What this acceptance did NOT do, stated plainly

- **It made no causal claim, and none is available.** The draft is not shown to be better than one
  prepared without the observation, and nothing in the repository could measure that today.
- **The observation's arrival in the model's system prompt is proved BY TEST, not by a production
  capture.** In production it is established to the level of the released code path and the
  `observed` disposition; the byte-level proof that the supplement lands in `systemInstructions` and
  never in the grounding context is `tests/cgo7-observed-content-preparation/`, run against the real
  model-answer path with the built request captured. No production capture seam exists.
- **The draft's imagery of rinsing and drying is not attributed to the observation.** The observed
  channel publishes nothing of the sort. Attributing it would be exactly the causal claim above.

### A correction to CGO-6's recorded limitation

CGO-6's closure states *"the model runtime is connected only in the deployed environment"* and its
acceptance refused with `no-model-answer`. **That was a script gap, not an environment fact.**
`scripts/cgo6-acceptance.ts` loaded only `.env.hosted.local`, which carries the production database
and the encryption keys and no model configuration at all; the configuration is in `.env.local` and
always was. `scripts/cgo7-acceptance.ts` names the seven model variables explicitly — and only those,
so that file's local `DATABASE_URL` is never imported — and the model call succeeded on the first
attempt. CGO-6's *"the confirming step is one preparation in the deployed Operations workspace"* is
superseded: the ceremony runs from an operator machine.

---

## Suite

**673 passed, 2 failed, 675 total.** Both failures are **pre-existing at `11496b4`** and were
verified to fail identically before this phase's first line:

- `tests/ama1-agent-mandate/bite-proofs.ts` — a bite-proof expecting reference equality of a frozen
  action-kind array, failing on structure-equal-but-not-reference-equal.
- `tests/hebycap1-flow/capability-truth.ts` — `/work-activity` has no capability binding.

Neither is touched here. Ten further failures WERE caused by this phase — every test pinning the
exact set of server-action boundary files — and were resolved by not adding one, which is the
outcome those pins exist to force.

`tsc --noEmit` is clean for the first time since CGO-6 released. `npm run lint`: 0 errors.
`npm run build`: green.

---

## Repository parity

`HEAD` = `origin/main` = `020c4ec`. Fast-forward `11496b4..020c4ec`. The deployment serving
`www.hebuntech.com` runs the release commit on `main`.

---

## Next newly exposed product gap

The loop now reads: **organizational purpose + recorded knowledge + prior prepared content + live
public observation → next content preparation.**

What is missing is the half after preparation. Every phase of this program ends at *prepared*, and
`prepared ≠ approved` is still a wall with nothing on the other side reachable from a content draft:
there is no surface on which a human reviews one, no decision that promotes it, and no record of a
draft having been accepted or rejected. `/operations` has server seams and **no caller**, which is
why five consecutive milestones have been accepted by operator script.

The narrowest honest next capability is therefore **making prepared content reachable by the human
who must review it** — a surface, not a new authority. It needs no schema, no provider, no
Governance widening and no model. It was not started.

A second, smaller gap this phase exposed and did not take: **an observation is a single moment with
no memory.** Comparing two observations over time would be the first thing in this program that
needs persistence, and the first that could manufacture a trend — it is named here so that a future
phase decides it deliberately rather than drifting into it.

CGO-8 has not been selected, scoped, or started.
