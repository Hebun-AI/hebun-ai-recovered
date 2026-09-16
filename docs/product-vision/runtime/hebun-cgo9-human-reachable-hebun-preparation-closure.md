# CGO-9 — Human-Reachable Hebun Preparation — RELEASED / PRODUCTION-ACCEPTED

**Release** `6d17d0551d087e31df38b6a43b6d8bdc3efa98df` · **ZERO schema, ZERO migration, ZERO new action** ·
**Deployment** `dpl_7EeBdpS3ZWv3wnjFTn9BvWGpgLET`, READY, serving `www.hebuntech.com`

---

## The job

CGO-8 closed with one gap on the preparation side: agent/model preparation had no UI trigger.
`prepareWorkArtifact` was already the one seam that turns a model reply into agent-authored prepared
work, and its output already entered the work-artifact → CGO-8 → TRH-10 review lifecycle. Only scripts
could reach it.

CGO-9 lets an authorized human on `/operations` explicitly ask Hebun to prepare a content draft, or a
new revision of one. The result stays an internal prepared artifact awaiting Governance review. It is
not generation, publishing or execution.

## Authority

**The tenant session is the preparation authority. No role band was added or reused.**

- The released writer states that anyone holding a tenant session may prepare, and that authorship is
  not authority. The cost is paid at Governance review.
- The released `prepareWorkArtifactAction` resolves the tenant session and nothing else. It was reused
  unchanged.
- `KNOWLEDGE_AUTHOR_ROLE_TYPES` governs establishing canonical, authoritative Knowledge. A prepared
  artifact is declared not Knowledge and not authoritative, so that band does not own this act.
- Spend stays bounded by the Director's Claude provider control and the per-process live-call budget.

## What shipped

- **Two controls in Prepared work.**
  - *Prepare with Hebun*: a new `content-draft`, with the human's title, declared destination and
    instruction.
  - *Prepare revision with Hebun*: offered only on a non-retired content draft.
- **Preflight before the model.** `prepareWorkArtifact` now checks, in order: tenant → durable-agent
  authorship → Claude provider control → target and input validity. Only then does it invoke the
  model, validate the durable model answer and write.
- **Revision basis.** A Hebun revision is briefed with the target's current revision text, fenced as
  material rather than instruction. The text is never stored. The target's own type and destination
  brief the model, not the client's restatement of them.
- **Three outcomes, worded as three facts.**

  | Outcome | Model invocation | `messages` | Artifact / revision |
  |---|---|---|---|
  | Preflight refusal | none | none | none |
  | Post-invocation failure | may have happened | kept as provenance | none |
  | Prepared | one | user + assistant turn | exactly one creation or one appended revision |

  Every refusal on screen says either *Hebun was not asked, and nothing was written* or *No prepared
  work was written*. The wording is exhaustive over the seam's refusal type.
- **Deliberate amendment.** The AGENT-RUNTIME-0 and R3W assertions that *the human still receives the
  answer* when no durable agent exists were amended by the Director's decision. When no valid durable
  agent can author the prepared artifact, Hebun does not invoke the model or persist model messages.

## Verification

- **Final candidate:** `tsc` 0, lint 0, `next build` 0, full suite **784 passed / 0 failed**, each
  measured by its own exit code, run once more before commit.
- **Real Postgres** (`tests/cgo9-hebun-preparation/`):
  - every preflight refusal: transport calls, message rows, artifacts and revisions unchanged;
  - post-invocation failure: messages kept, zero artifact and revision writes;
  - prepared work: authored by the durable agent, never the requester; `source_message_id` names the
    assistant turn with provider, model and tokens; revision 1 digest unchanged; *Awaiting review*.
- **Bite proofs:** 7/7 bit, 0 void. P1 restores the pre-CGO-9 order and is caught by both the CGO-9
  suite and the amended AGENT-RUNTIME-0 suite.
- **Local UI:** fixture tenant with no agent; both controls rendered and both refused in preflight
  with zero rows changed.

## Production acceptance — PASSED

Before acceptance, read-only: the Claude `director_enabled` control was `true`, and Turkish Rug House
had exactly one durable agent in service (`Heby`, `67f4460c-0d44-4ae7-a3ed-729c705e2609`).

The Director made the two authorized live preparation calls in Turkish Rug House. The artifact they
produced was verified read-only against production:

**Artifact** `57b57106-2848-41f7-a5b3-d2475e0b7dba` — `Turkish Rug House Instagram içerik taslağı`,
`content-draft`, prepared for Instagram, lifecycle `draft`, `current_revision` **2**.

| | Revision 1 | Revision 2 |
|---|---|---|
| Revision id | `6c2e475d-97da-41d2-b2ec-a451ddb35432` | `e2c0b293-5bea-413d-8cfb-70aecd2a1dd9` |
| Author | agent `67f4460c…` (Heby) | agent `67f4460c…` (Heby) |
| `source_message_id` | `5605df5d-6fb4-4baf-a7f2-431aac0da837` | `902008a2-3da0-4101-9eb1-303a8707f28a` |
| Message | assistant, origin `model`, `claude` / `claude-haiku-4-5-20251001`, `live` | same |
| Tokens (in / out) | 6441 / 107 | 6864 / 119 |
| Provider request id | present | present |
| Stored digest | `2e160fa5…05e1d6` | `7181b2fc…c42455` |
| Digest recomputed from stored content | matches | matches |
| Content equals its source message | yes | yes |

- **Exactly two revisions** exist for the artifact.
- **Requester semantics preserved.** `created_by` is `d5b496df-588c-49c5-9cc2-17672b82dd10`,
  `created_by_type` `human`: a user with membership in the tenant, not an agent.
- **Revision 1 unchanged.** Written at 21:13:26Z, before revision 2 at 21:16:14Z. Its stored digest
  still equals the sha256 of its stored content, and no writer can update revision content.
- **Each call is one conversation of two messages** (user, assistant). The tenant has exactly these
  four messages since 21:00Z, so there was no stray or failed invocation.
- **Governance review of revision 2: Awaiting review.** `decision_records` for either revision: **0**.
  Tenant decisions since the artifact was created: **0**.
- **Nothing followed.** Since the artifact was created, the tenant has 0 action requests, 0 permits
  and 0 execution attempts. No request, permit or attempt references the artifact. No other artifact
  was created.

## Still absent

Preparation is not publishing:
- Accepting a revision authorizes no publishing, sending, scheduling or execution.
- There is no Instagram, YouTube or TikTok publishing capability, and no provider write scope.
- There is no image or video generation, no generated-asset storage and no Higgsfield.
- There is no observation-grounded preparation on the human surface, and no agent-initiated
  preparation.
- There is no prompt digest, no per-tenant spend accounting and no idempotency. A double submission is
  prevented only by the pending state in the UI.
