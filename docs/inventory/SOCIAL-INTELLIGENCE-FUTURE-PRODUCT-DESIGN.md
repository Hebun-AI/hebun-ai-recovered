# Hebun — Social Intelligence: Future Product & Architecture Design Review

> ### DESIGN REVIEW — NOT ROADMAP AUTHORITY
>
> **This document is NOT implementation authority. It is NOT approval to build. It is NOT a
> roadmap.** Nothing recorded here is scheduled, committed, promoted or decided by appearing in it.
>
> It is a **derived** document produced during an evidence wait, for Director review only. The
> authoritative sources remain `docs/product-vision/ui/hebun-social-intelligence-specification.md`
> (SOC-0, §11 reconciled), `docs/MASTER-ROADMAP.md`, the released source, and read-only runtime
> evidence. Where this document and any of those disagree, **they win and this is stale**.
>
> **Baseline:** branch `main`, `HEAD == origin/main == c120bf7418eddc46c965560912bcbb587757515d`,
> 0 ahead / 0 behind, staging empty, single worktree. Production evidence read read-only on
> 2026-09-11 (DB clock 11:59:33Z).
>
> **Nothing regenerates this document.** Any release, new capability, phase closure or authority
> change beyond that baseline requires it to be **re-derived**, not patched by hand.

---

## 0. What was inspected

Released source and contracts, not summaries:

| Area | Read |
|---|---|
| Social Intelligence | `contracts.ts`, `dashboard-model.ts`, `dashboard-read.server.ts`, `platform-presence.ts` |
| Instagram | `provider-instagram/contracts.ts`, `latest-media-observation.ts`, `account-measurement-series.ts`, `account-measurement-comparison.ts` |
| YouTube | `provider-youtube/contracts.ts`, `read-channel-observation.server.ts`, channel series/comparison |
| Observation authority | `provider-observation-history/*`, `record-instagram-media-observation.server.ts`, `standing-observation-authority/revalidate-standing-observation.server.ts`, `observation-trigger/*` |
| Provider admission | `provider-catalog/catalog.ts`, `provider-content-admission/*` |
| Agent / proposal | `agent-origination/contracts.ts`, `originate-action.server.ts`, `content-observation/*`, `agent-mandate/*` |
| Execution | `action-execution/adapter-registry.server.ts`, `approval_state` / `action_permit_status` / `execution_status` enums |
| Heby | `heby-core/*`, `heby-integration/contracts.ts` (source-class registry) |
| Knowledge / Work | `knowledge-ratification`, `organizational-work/*`, `work-artifacts/contracts.ts` |
| Goals | `db/schema/goal.ts`, `db/schema/mission.ts`, `goal-runtime/*`, `command-goals/workspace-model.ts` |
| Enterprise layers | `enterprise-intelligence`, `enterprise-organizational-intelligence`, `organizational-intelligence` |

**Eight measured facts anchor everything below.** Each was verified in source or in production, not
inferred:

1. **Three read capabilities exist in total.** `instagram.account.public.read`,
   `instagram.media.public.read`, `youtube.channel.public.read`.
2. **Zero write capabilities exist for any social provider.** A repository-wide search for a
   publish/post/comment/reply capability key returns nothing. This is not "unbuilt" — the
   vocabulary does not exist.
3. **One execution adapter is registered:** Resend (email). `adapter-registry.server.ts` holds a
   single descriptor.
4. **Two originable action kinds exist:** `AGENT_ORIGINABLE_ACTION_KINDS = ["send", "record-work"]`.
5. **Content preparation for social destinations is already released.** `content_destination` is a
   closed enum — `instagram`, `tiktok`, `youtube` — registered as **declarable, never connectable**.
6. **No runtime organizational goal authority exists.** See §7 — this is the sharpest finding.
7. **No Heby source class covers social or provider-observation evidence.**
8. **Observation → proposal already exists** (TRH-20), but over a *live* provider read, not over
   stored history.

---

## 1. Current maturity: where Social Intelligence actually is

The product is **complete through COMPARE and stops there, deliberately**.

```
CONNECT    ██████████  released — Integration Authority + real Instagram/YouTube connections
OBSERVE    ██████████  released — governed standing observations, 1440-min cadence, machine principal
MEASURE    ██████████  released — IG-AN1, YT-SOC1
COMPARE    █████████░  released for ACCOUNTS (IG-AN2, YT-SOC2); per-POST blocked (IG-AN3)
UNDERSTAND ░░░░░░░░░░  nothing. No pattern, correlation or characteristic derivation exists
EXPLAIN    ░░░░░░░░░░  nothing. No inference layer; Heby cannot see social evidence at all
RECOMMEND  ░░░░░░░░░░  nothing for social
PROPOSE    ███░░░░░░░  the SEAM exists (agent-origination), but no social action kind exists
AUTHORIZE  ██████████  released and generic — Governance decisions, permits, approval states
ACT        ░░░░░░░░░░  structurally impossible: no social write capability, no social adapter
OBSERVE Δ  ░░░░░░░░░░  nothing closes the loop for social
LEARN      ░░░░░░░░░░  a precedent exists for agents (SELF-IMPROVING-AGENTS-1), none for social
```

The honest summary: **Hebun can see, and cannot yet think or act, about social.** The three
right-hand stages are not behind a scheduling decision — they are behind capability, evidence and
authority gates that no amount of UI work reaches.

A second observation worth stating plainly: **the foundation is unusually sound.** The truth-class
firewall (§9 of the spec), capability-scoped reads, `null ≠ 0`, `ONE MEASUREMENT ≠ A SERIES`, and
the refusal to mint cross-provider types are all *already load-bearing in released code*, not
aspirations. Everything below can be built on them. That is the asset.

---

## 2. The product loop, tested step by step

The Director's hypothesis was tested against repository authority rather than accepted. **Two steps
of it are wrong for Hebun**, and are corrected below.

| Step | Authority exists? | Runtime? | Owner | Evidence required | Human gate? |
|---|---|---|---|---|---|
| CONNECT | Yes | Yes | Integration Authority + Credentials | OAuth ceremony | Yes (human connects) |
| OBSERVE | Yes | Yes | Standing Observation Authorization + trigger | Governance authorization | Yes, once (standing) |
| MEASURE | Yes | Yes | **Social Intelligence** | ≥1 usable observation | No |
| COMPARE | Yes | Yes | **Social Intelligence** | ≥2 usable observations | No |
| UNDERSTAND | **No** | No | **Social Intelligence** (calculated) | history depth — see §4 | No |
| EXPLAIN | **No** | No | **Heby** (inferred), not SI | composed view + new source class | No, but must be labelled |
| RECOMMEND | **No** | No | **Heby / agent** (recommends) | a stated objective — see §7 | No |
| PROPOSE | Partly | Partly | Agent Origination + Agent Mandate | mandate scope covering the kind | — |
| AUTHORIZE | Yes | Yes | Governance Decision | a proposal | **Yes, always** |
| ACT | Yes (generic) | Email only | Action Execution + permit | a permit | Permit is the gate |
| OBSERVE RESULT | Partly | No for social | Provider Observation History | post-action observation | No |
| LEARN | Precedent only | No for social | — (unowned) | attributable outcomes | — |

### Two corrections to the hypothesis

**(a) UNDERSTAND and EXPLAIN are different authorities and must not be one stage.**
UNDERSTAND is *calculated* — deterministic, reproducible, defensible from evidence alone (e.g. "this
post's like count moved +3 between two observations"). EXPLAIN is *inferred* — a judgement that
could be wrong (e.g. "it moved because it was a carousel"). The released truth-class firewall already
separates these. Collapsing them into one "insights" stage is the single most likely way this product
loses its integrity, because the UI would render both in the same panel with the same authority.

**(b) RECOMMEND cannot precede a stated objective.** A recommendation is *always* relative to a goal.
Hebun has no goal authority (§7). Building RECOMMEND first would force Social Intelligence to invent
an implicit objective — almost certainly "more followers" — and encode a strategy nobody chose. This
reorders the sequence; see §12.

### What Social Intelligence must never own

Restating the spec's §3 boundary, which this review does **not** redesign, plus three additions this
review surfaces:

| Must not own | Stays with | Why it is at risk |
|---|---|---|
| Knowledge admission | Knowledge Authority | An "insight" feels like knowledge; admission needs a human (KID-2) |
| Governance authorization | Governance Decision | A recommendation surface is one click from an approve button |
| Work records | Organizational Work Authority | "Prepare a content calendar" is *work*, and work already has an owner |
| Execution | Action Execution + permits | — |
| Provider connection | Integration Authority | — |
| Universal recommendation | — (no such authority; do not create one) | — |
| **Organizational goals** | **Nothing yet — see §7** | The tempting fix is to store a goal on the SI surface |
| **Competitor identity** | **Nothing yet — see §5** | "Who are our competitors" is org truth, not social truth |
| **Content strategy** | **Nothing yet — see §13** | — |

---

## 3. The question ladder, mapped to measured capability

| Level | Question | Today | Gate |
|---|---|---|---|
| **A — What exists?** | Connected accounts, followers, posts, videos | **Released.** SOC-UI1 answers all of it | — |
| **B — What changed?** | Audience change between observations | **Released** for accounts (IG-AN2/YT-SOC2) | — |
| | Which posts gained likes/comments | **Evidence-blocked** (IG-AN3) | 2nd media observation |
| **C — What is happening?** | Patterns across time | **Not built.** Needs history depth, not new authority | ~5–10 observations |
| | Characteristics correlated with outcomes | **Not built.** Needs content characteristics *and* depth | see §4 |
| **D — Why might it be?** | Evidence-supported explanations | **Not built.** Requires an inference owner | Heby source class |
| **E — What should we do?** | Actions serving an objective | **Not built.** Requires an objective | **goal authority** |
| **F — Can Hebun do it?** | Available actions | **Answerable today, and the answer is narrow** | see below |
| **G — Did it work?** | Attributable outcome | **Not built** | requires F first |

### Level F deserves its own answer now, because it is answerable now

This is the level most products get wrong by implying capability they lack. Hebun can answer it
exactly, today:

| Candidate action | Available? | What it would actually need |
|---|---|---|
| Record social work for a human to do | **Yes, today** | `record-work` origination kind — already released |
| Draft a caption for Instagram | **Yes, today** | `content-draft` + `content_destination: instagram` — already released (CGO-1…4) |
| Send an email about social results | **Yes, today** | `send` kind + Resend adapter + permit |
| Recommend a posting time | No | An inference authority; no capability needed (it is advice) |
| Publish a post | **No — structurally** | Meta scope `instagram_business_content_publish`, a new capability key, a new adapter, a new originable kind, Governance |
| Reply to a comment | **No — structurally** | Same chain, plus a comment-read capability that does not exist |
| Read impressions / reach | **No** | Meta scope `instagram_business_manage_insights` — named in the catalog, deliberately not requested |
| Launch an advertisement | **No** | Ads API, billing authority, commercial + legal review. Far outside current architecture |

The catalog names the two missing Meta scopes explicitly and records that neither is requested. That
is a *decision already taken*, not an oversight — and it means "publish" is at minimum a new scope, a
new capability, a new adapter and a new governance path.

---

## 4. Content Intelligence

### Tier 1 — Reachable from the released contract

The stored media fact already carries `mediaId`, `mediaType`, `caption`, `permalink`, `publishedAt`,
`likeCount`, `commentCount`. That is more than it appears.

| Concept | Evidence today | Truth class | Assessment |
|---|---|---|---|
| Per-post evolution | `mediaId` + counts, 2 observations | CALCULATED | **IG-AN3.** Blocked on evidence only |
| Content history | accumulating observations | OBSERVED | Free with depth |
| Content type | `mediaType` | PROVIDER REPORTED | Available now |
| Publishing timing | `publishedAt` | PROVIDER REPORTED | Available now |
| Observed engagement counts | like/comment counts | PROVIDER REPORTED | Available now — **counts, not "engagement"** |
| Caption characteristics | `caption` | CALCULATED (length) / INFERRED (tone, theme) | Split hard: length is arithmetic, theme is judgement |
| Audience response | — | — | **Not available.** Requires insights scope |
| Content themes / clusters | — | INFERRED | Needs a model; needs labelled ground truth to be trustworthy |
| Recurring formats | `mediaType` + timing | CALCULATED | Weak but honest with depth |
| Campaign grouping | — | — | **No authority.** Nothing in Hebun groups content into campaigns |
| Content lifecycle | per-post series | CALCULATED | The most valuable Tier 1 item after IG-AN3 |

**The single highest-value Tier 1 item after IG-AN3 is content lifecycle** — how one post's counts
move over its first days. It needs no new authority, no new capability and no inference. It needs
only observation depth, and the cadence produces that for free.

### Tier 2 — Advanced concepts, each answered against the Director's six questions

**Content performance.**
(A) Undefined — it means "good", which is not a measurement. (B) Would require an objective to be
good *for*. (C) Nobody; no authority defines it. (D) Would be INFERRED while looking CALCULATED —
the dangerous combination. (E) Misleading whenever the bounded observation window is mistaken for the
full account, and whenever a post observed for 1 day is compared with one observed for 30.
(F) **No.** Not as a metric. The underlying question is real; "performance" is the wrong name for it.
*Recommendation: reject the term permanently. §11 of the spec already carries it only as a frozen
historical label.*

**Ranking.**
(A) A total order over posts. (B) A comparable scalar per post. (C) Unowned. (D) CALCULATED from an
INFERRED scalar — inherits the scalar's dishonesty. (E) Misleading because posts observed for
different durations are not comparable, and because rank hides magnitude: #1 and #2 may differ by one
like. (F) **Probably not.** If ever, rank on a single provider-reported count with the window stated,
never on a composite.

**Engagement rate.**
(A) Typically interactions ÷ reach, or ÷ followers. (B) Reach requires the **insights scope Hebun
does not hold**. Followers-as-denominator is a substitution, not the metric. (C) Would have to be a
Hebun definition. (D) CALCULATED — but from a denominator that answers a different question.
(E) Deeply misleading: it would be presented as an industry-standard metric while being a Hebun
approximation, and would move when *followers* changed even if nothing about the post changed.
(F) **No** — not without the insights capability. If the capability is ever acquired, revisit.
*This is exactly the "universal engagement score" §12 already defers, and this review agrees.*

**Benchmark.**
(A) Comparison against a reference population. (B) A population Hebun cannot observe. (C) Would be an
external data authority. (D) PROVIDER REPORTED at best, invented at worst. (E) Benchmarks are usually
misleading by construction — the reference cohort is rarely comparable. (F) **No.**

**Competitor comparison.** See §5.

**Forecasting.**
(A) Projecting a measurement forward. (B) Far more history than exists; a stated model; error bars.
(C) Unowned. (D) INFERRED. (E) Misleading because a forecast rendered as a number reads as a fact,
and because social measurements are not stationary. (F) **No, and probably never** in this form. A
cadence-aware "when will the next observation arrive" *is* honest and is a different thing.

**Content recommendation.**
(A) "Post more like X." (B) An objective, a correlation, and enough history to separate signal from
noise. (C) Heby, under a mandate. (D) RECOMMENDS. (E) Misleading whenever correlation is presented as
cause, and when *n* is small — with 8 posts, any correlation is noise. (F) **Eventually yes** — this
is the real product. But it is the *last* stage, not an early one.

> **Design rule this section proposes:** no derived content metric may exist unless a reader can be
> told, in one sentence, exactly which provider-reported numbers produced it and over which
> observation window. Any metric that fails that test is an inference wearing a number's clothes.

---

## 5. Competitor Intelligence

**A genuine asymmetry exists, and it decides this section.**

`read-channel-observation.server.ts` (CGO-5) takes the channel handle as a **runtime argument**:
*"not the tenant's channel"*. It reads whatever YouTube makes public about **any** channel, stores
nothing, and spends three quota units through the capability authority.

So: **the technical substrate for competitor observation already exists on YouTube, and has no
Instagram equivalent.** Instagram's read is bound to the connected business account via
`instagram_business_basic`. There is no public-account read for arbitrary Instagram accounts, and
inventing one would mean either a scope Hebun does not hold or scraping.

| Question | Answer |
|---|---|
| Which competitors matter? | **Unanswerable by Hebun.** This is organizational truth |
| Who defines the set? | A human, through an authority that **does not exist** |
| What may Hebun observe? | YouTube: public channel facts, live, unstored. Instagram: **nothing** |
| Valid comparisons? | Only same-provider, same-metric, same-instant. Never across providers |
| Provenance | Would need a *third* subject kind: observations whose subject is not the tenant |
| Separation from tenant truth | **This is the hard part** — see below |
| Legal / policy | Public data via official APIs within ToS. **Scraping is excluded, not deferred** |

### The structural problem, stated precisely

Every observation today is written with `subject_kind` = the tenant's own account and is scoped by a
tenant predicate. A competitor observation is *about a third party*, stored *under the tenant*. That
breaks an invariant the whole observation history rests on: "these facts are about you."

It also raises a question nobody has asked: is a competitor's public follower count, stored durably
in a tenant's history, **organizational knowledge**? If yes, it belongs to Knowledge Authority and
needs admission. If no, it needs its own retention story.

**Assessment: this is a distinct capability and probably a distinct authority — not an extension of
Social Intelligence.** It should not be approached by widening the existing observation contract.
Recommended disposition: **DEFER**, and if ever pursued, start with the YouTube-only live, unstored
path that already exists, which requires no new storage semantics at all.

---

## 6. Cross-platform composition

The governing rule is already released and already correct: **Instagram and YouTube share
conventions and share no types.** SOC-UI1 goes further than the spec required — the two platforms
never share an axis.

| Candidate | Composable? | Reasoning |
|---|---|---|
| Connected-channel inventory | **Yes** | "Which channels are connected" is provider-independent |
| Observation coverage | **Yes** | "When did Hebun last look" is about *Hebun*, not the provider. Already released |
| Content activity timeline | **Yes, with care** | A timeline of "a post happened" is provider-neutral; the *counts* on it are not |
| Publishing cadence | **Yes** | Counting events over time is provider-independent |
| Audience measurements | **No** | Followers ≠ subscribers. Already enforced |
| Engagement measurements | **No** | Different interaction models entirely |
| Campaign grouping | **Deferred** | No campaign authority exists |
| Business objectives | **Yes, eventually** | Goals are org-level, not provider-level — §7 |

**The reliable test:** compose on the axis where the *provider is incidental*. Time, connection
state, observation coverage and event occurrence are Hebun-side facts and compose cleanly. Anything
the provider *defines* — a follower, a view, an engagement — does not.

`followers + subscribers = total audience` remains forbidden. It is not conservatism: the sum is a
number that no provider reports, that no user can act on, and that changes meaning if a channel is
added. **A metric that changes meaning when you connect a new account is not a metric.**

---

## 7. Goals and strategy — the sharpest finding in this review

**Hebun has no runtime organizational goal authority.** This was verified three ways:

1. `goals` and `missions` tables **exist** in `src/db/schema/`, are exported from the schema barrel,
   and carry a rich design — `missionId`, `successCriteria`, `successMetrics`, `targetValues`,
   `currentProgress`, `ownerActorType`, `reviewCadence`, `confidence`.
2. **No query in the application touches either table.** A search for drizzle
   `.from/.insert/.update/.delete` against them returns nothing. The `goals` identifier appears in 55
   files, but every occurrence checked is either English prose or a function parameter of type
   `GoalRuntimeModel[]` — not the table.
3. The `goal-runtime` that *does* exist is pure and in-memory, and `command-goals/workspace-model.ts`
   states in its own header that its entire content is **a compiled-in seed of four literal rows
   (GO-101…GO-104)**, forced `active`, authored by `"Seed"`.

So the goal authority is **schema-published and runtime-absent** — the same pattern `organizations`
and `departments` showed before L3 built over them.

### Consequences for Social Intelligence

- Social Intelligence **cannot** reference organizational goals today. There are none to reference.
- It **must not** create them. A "social goal" stored on this surface would become a second
  organizational-goal authority by accident — exactly what the Director forbade, and exactly what the
  dead `goals` table was designed to prevent.
- Therefore **Level E is not blocked on analytics maturity. It is blocked on an authority that
  belongs to another program.** No amount of Social Intelligence work reaches it.

The authority chain required to honestly answer *"our goal is qualified traffic — what should we
consider doing next?"*:

```
Goal Authority          states the objective, with success criteria      ← DOES NOT EXIST
  ↓
Attribution evidence    links social activity to the objective           ← DOES NOT EXIST for traffic
  ↓                     (needs link-click or referral evidence; no
                         capability reports it)
Social Intelligence     supplies observed + calculated social facts      ← EXISTS
  ↓
Heby (mandated)         reasons, labelled as inference/recommendation    ← needs a source class
  ↓
Agent Origination       proposes ONE bounded action                      ← exists; no social kind
  ↓
Governance              a human decides                                  ← EXISTS
```

**Two links in that chain do not exist, and neither belongs to Social Intelligence.** Worth stating
because it is the honest answer to a question the product will inevitably be asked: the traffic
example specifically requires *referral evidence Hebun has no capability to observe* — the goal
authority alone would not be enough.

---

## 8. Recommendation → proposal → action

### The state ladder, mapped to released vocabulary

The Director's six states map onto real enums — with one gap:

| Director's state | Released representation | Exists? |
|---|---|---|
| RECOMMENDED | — (no durable representation) | **No** |
| PREPARED | `work_artifact` + `content_destination`; `approval_state: not-required` | **Yes** |
| AUTHORIZED | `approval_state: approved` → `action_permit_status: active` | **Yes** |
| EXECUTABLE | an `active` permit + a registered adapter for the endpoint kind | **Yes** (email only) |
| EXECUTED | `execution_status: completed` | **Yes** |
| SUCCESSFUL | — | **No** |

**Two gaps, both meaningful.**

`RECOMMENDED` has no durable form: a recommendation exists only inside a model reply. It cannot be
tracked, revisited or learned from. If recommendations are ever to be evaluated, this gap must close
first — and it is a *storage* question, not an intelligence one.

`SUCCESSFUL` does not exist, and **should not be added casually**. `completed` means Hebun's attempt
finished — not that an email arrived, was read, or achieved anything. The released work already
carries this distinction (`DELIVERED is not SEEN`), and a "successful" state would quietly erase it.
Outcome, if ever modelled, belongs in *post-action observation*, not in the execution record.

### Candidate actions, each against the real chain

| Action | Capability | Adapter | Originable kind | Verdict |
|---|---|---|---|---|
| Propose a new post | — | — | — | Needs all three. **Far** |
| Draft a caption | released | n/a | via work artifact | **Available today** |
| Prepare a content calendar | none needed | n/a | `record-work` | **Available today** — it is *work*, not publishing |
| Recommend posting time | none needed | n/a | advice only | Needs inference owner, no capability |
| Suggest replying to comments | **comment read missing** | — | — | Cannot even *see* comments individually |
| Prepare a campaign | — | — | — | No campaign authority |
| Publish content | `…content_publish` scope | new | new | **Far**, and a Director decision, not a technical one |
| Modify profile | — | — | — | Not considered; high blast radius |
| Respond to a user | — | — | — | Requires publishing + a response policy |
| Launch an advertisement | — | — | — | **Out of architectural scope.** Money is involved |

**The finding worth acting on:** the two genuinely available actions — *prepare a content draft for
Instagram* and *record social work* — are both **already released and both currently unreachable from
the Social Intelligence surface.** They require no new capability, no new adapter, no new governance
path and no publishing scope. That is a real product opportunity hiding in plain sight, and it is
strictly a *composition* gap.

### One contradiction, recorded rather than repaired

`CONTENT_DESTINATION_NON_CLAIMS[0]` reads:

> "A declared destination is not a provider connection. **No social provider is connectable in
> Hebun.**"

The second sentence was true when written and is **now false**. Instagram is a connectable catalog
entry with a real production connection and two read capabilities. The *intent* of the sentence —
that declaring a destination grants nothing — remains entirely correct; only its supporting claim has
drifted.

**Recorded here, not repaired.** It sits in released source with released tests, and correcting it is
its own reviewed change, not a side effect of a design review.

---

## 9. Provider admission test

The criteria are ordered as **gates**, not as a score. A candidate failing an early gate is not
admitted regardless of later strengths — which is what prevents "it is popular" from becoming a
reason.

| # | Gate | Why it precedes the others |
|---|---|---|
| 1 | **A real tenant account exists for acceptance** | Hebun's discipline is production acceptance on real evidence. No account, no acceptance, no release |
| 2 | **Real customer demand** | Every provider is permanent maintenance surface |
| 3 | **A minimum useful read capability** | If the first honest surface is empty, the work produces nothing |
| 4 | **A scoping model that permits least privilege** | Hebun requests the narrowest scope. A provider forcing broad grants fails this |
| 5 | **Governance feasibility** | Standing authorization must be expressible |
| 6 | **Stable API + acceptable rate/quota cost** | — |
| 7 | **Provider-policy risk** | ToS must permit the use. Scraping is never the fallback |
| 8 | **Action capability** | Desirable, not required. Read-only providers are legitimate |

### High-level assessment — deliberately unranked

| Provider | Notes | Gate status |
|---|---|---|
| Facebook | Same Meta app and graph as Instagram; lowest marginal integration cost | Gates 1–2 **unmeasured** |
| TikTok | Already a declarable content destination; API access is application-gated | Gates 1–2 **unmeasured** |
| LinkedIn | Restrictive API; company-page reads narrow | Gates 1–2 **unmeasured** |
| X | API pricing and stability are commercial questions | Gates 1–2 **unmeasured** |

> **The repository contains no evidence for gates 1 or 2 for any of these four.** No tenant account,
> no recorded customer demand, no commercial analysis. **Therefore this review does not rank them and
> names no winner.** Facebook has the lowest *technical* cost — that is a fact about integration
> effort, not a recommendation, and must not be read as one.

---

## 10. Dashboard information architecture

Derived from the question ladder (§3) and the authority boundaries (§2), not from visual convention.

```
/intelligence/social — OVERVIEW
  ├─ Channel inventory + connection health        Level A   released
  ├─ Audience measurement, per platform           Level A/B released
  ├─ What changed since the last observation      Level B   released (accounts)
  ├─ Observation coverage — "when did Hebun look" Level A   released
  └─ [FUTURE] Heby Social Brief — visually apart  Level D/E needs source class

  /intelligence/social/{platform} — DRILL-DOWN
  ├─ Full measurement history                     Level B/C needs depth
  ├─ Per-post evolution                           Level B   IG-AN3
  └─ Content list + per-post detail               Level A   released (IG) / YT-SOC3

    /intelligence/social/{platform}/content/{post} — CONTENT DETAIL
    └─ One post's lifecycle across observations    Level B/C needs IG-AN3 + depth

ELSEWHERE — and this is the architecture, not a limitation
  Heby        · reasoning, explanation, abstention
  Governance  · every authorization
  Work        · anything a human must do
  Integrations· connection lifecycle and repair
```

**What belongs on the overview** is governed by one test: *would a founder act differently on seeing
it?* Connection health passes — a broken connection needs fixing today. Observation coverage passes —
it tells you how much to trust everything else. A follower count that moved by zero **also** passes,
because "nothing changed" is a real answer.

**What should not exist:** a total-audience number; a performance score; a leaderboard; a sparkline
with no axis; any panel whose honest state is "we don't know" but renders as `0`; and a
recommendations panel before an objective exists to recommend against.

**One structural recommendation.** The overview should eventually separate *"what changed"* from
*"what exists"* more sharply than it does. A founder opening this page daily wants the delta; the
absolute values are reference. That is an information-hierarchy change, not a visual one, and it
needs no new authority — but it should wait until IG-AN3 lands, since per-post change is the content
that makes the section worth having.

---

## 11. Capability map

| Capability | Class | Notes |
|---|---|---|
| Connection + observation foundation | **RELEASED** | — |
| IG-AN1 / YT-SOC1 measurement series | **RELEASED** | — |
| IG-AN2 / YT-SOC2 account comparison | **RELEASED** | production-accepted |
| SOC-UI1 dashboard | **RELEASED** | production visually accepted |
| SOC-UI2 audience evolution | **RELEASED** (satisfied by SOC-UI1) | — |
| SOC-UI3 recent content | **PARTIALLY DELIVERED** | IG half done; YT half is YT-SOC3 |
| IG-AN3 per-post evolution | **EVIDENCE-BLOCKED** | 1 media observation; contract is ready |
| YT-SOC3 YouTube content consumer | **NEW CANDIDATE** — *extension* | Not evidence-blocked; channel reports 0 videos |
| Content lifecycle (per-post over time) | **NEW CANDIDATE** — *extension of IG-AN3* | Highest Tier-1 value; needs only depth |
| Caption length / format characteristics | **NEW CANDIDATE** — *extension* | Arithmetic only; keep separate from theme |
| Cross-platform activity timeline | **NEW CANDIDATE** — *new capability* | Composes on a Hebun-side axis |
| Publishing cadence | **NEW CANDIDATE** — *extension* | — |
| Heby social source class | **NEW CANDIDATE** — *new capability* | Established pattern; would be the 21st (`HEBY_SOURCE_CLASSES` holds 20) |
| Social brief (SOC-HEBY) | **NEW CANDIDATE** — *new phase* | Depends on the source class |
| Durable recommendation record | **NEW CANDIDATE** — *new capability* | Closes the RECOMMENDED gap (§8) |
| Social action from the SI surface (draft / record-work) | **NEW CANDIDATE** — *composition only* | **Both halves already released** |
| Organizational goal authority | **DESIGNED ELSEWHERE** | Schema exists, runtime absent. **Not SI's to build** |
| Campaign grouping | **DESIGNED ELSEWHERE / absent** | No authority |
| Insights (reach, impressions) | **DEFERRED** | Needs a Meta scope not requested |
| Competitor intelligence | **DEFERRED** | Distinct authority; §5 |
| Post publishing / replying | **DEFERRED** | New scope + capability + adapter + governance |
| Content themes / clustering | **DEFERRED** | Inference; needs depth first |
| Engagement rate | **PROBABLY UNNECESSARY** | Denominator unavailable; misleading |
| Content performance score | **PROBABLY UNNECESSARY** | Undefined; reject the term |
| Ranking / leaderboard | **PROBABLY UNNECESSARY** | Hides magnitude; windows incomparable |
| Benchmarks | **PROBABLY UNNECESSARY** | No comparable population |
| Forecasting | **PROBABLY UNNECESSARY** | Renders inference as fact |
| Total audience | **REJECTED** (§12 of spec) | Already decided |

---

## 12. Proposed evolution sequence — with the hypothesis challenged

The Director's sequence was: FOUNDATION → HISTORY → CONTENT EVOLUTION → PATTERN → GOAL-AWARE →
RECOMMENDATIONS → PROPOSALS → ACTIONS → LEARNING.

**Two changes are proposed, both driven by measured evidence.**

**Change 1 — GOAL-AWARE moves earlier, and out of the program.** Goals are a prerequisite for
recommendation, not a refinement of it (§7), and the authority belongs to another program. Placing it
late implies Social Intelligence will deliver it. It will not.

**Change 2 — a new stage inserts before PATTERN: "GOVERNED ACTION, NARROW".** The two already-released
actions (content draft, record-work) need only composition. Delivering them early means the product
reaches *observation → human action* far sooner than the full loop, and it exercises the
recommendation → proposal → governance path on capabilities that already exist — before any
publishing scope is ever contemplated.

| # | Stage | Prerequisite | Authority dep. | Evidence dep. | Product value | Principal risk |
|---|---|---|---|---|---|---|
| 1 | **Foundation** | — | — | — | done | — |
| 2 | **History** | cadence running | — | observations accumulate | Level B complete | **Evidence wait** (IG-AN3) |
| 3 | **Content evolution** | IG-AN3 + YT-SOC3 | — | ≥2 media obs. | First real content answer | Empty YouTube surface |
| 4 | **Governed action, narrow** | stage 3 | Work + Work Artifacts (**both exist**) | — | **Highest value per unit of work** | Looking like publishing when it is not |
| 5 | **Pattern intelligence** | depth | — | ~5–10 observations | Level C | **Small-*n* nonsense** |
| 6 | **Goal authority** | — | **another program** | — | Unlocks Level E | Becoming a 2nd goal authority |
| 7 | **Goal-aware reasoning** | 5 + 6 | Heby source class | composed view | Level D/E | Inference read as fact |
| 8 | **Recommendations** | 7 | Agent Mandate | durable recommendation record | The real product | **Recommending the unexecutable** |
| 9 | **Governed proposals** | 8 | Governance (exists) | — | — | — |
| 10 | **Governed actions (publishing)** | 9 | new scope + capability + adapter | — | — | **Blast radius: public, irreversible** |
| 11 | **Outcome learning** | 10 | post-action observation | attributable outcomes | Closes the loop | **False attribution** |

**Stages 2 and 3 are where the product is now.** Stage 4 is the best available work that is neither
evidence-blocked nor authority-blocked.

---

## 13. DIRECTOR DECISIONS REQUIRED

Only decisions that genuinely need product judgement. None is decided here.

1. **Should Social Intelligence reach the two already-released actions?**
   Composing content drafts and `record-work` onto the SI surface needs no new capability, scope,
   adapter or governance path. It is the highest-value available work. *This review recommends yes,
   but it changes what the surface is — from reading-only to a place where work begins — and the
   spec's §1 currently calls it "a reading surface". That is the Director's call, not an
   implementation detail.*

2. **Should Hebun generate recommendations before it can execute them?**
   Recommending "post more carousels" when Hebun cannot post is either honest advice to a human or an
   implied capability it lacks. *Both readings are defensible; the product must pick one.*

3. **Should content strategy become a distinct capability?**
   Themes, campaigns and calendars keep appearing across §4, §6 and §8 with no owner. Either an
   authority is chartered or these stay permanently deferred. *Drifting is the one bad option.*

4. **Which business objective should drive the first learning loop — and where does the goal live?**
   Blocked on decision 5. The traffic example additionally needs referral evidence no capability
   reports, so the *first* objective should probably be one social evidence can actually speak to.

5. **Who charters the organizational goal authority?**
   A designed-but-unwired schema is sitting there. Someone must own it, and it must not be Social
   Intelligence.

6. **Should competitor intelligence ever exist?**
   YouTube makes it technically reachable today; Instagram does not. It likely needs its own
   authority and raises an unanswered question about whether third-party facts stored under a tenant
   are organizational knowledge.

7. **Should the Meta insights scope be requested?**
   `instagram_business_manage_insights` would unlock reach and impressions and make engagement rate
   *definable*. It also widens the grant. The catalog currently records the narrow choice as
   deliberate.

8. **Which provider is next — and is it being asked too early?**
   No candidate passes gates 1–2 today. *The honest answer may be "none yet."*

9. **Should YT-SOC3 be built against a channel reporting zero videos?**
   Already flagged in §11 of the spec as a Director product call. It remains one.

---

## Appendix — findings recorded, not repaired

1. `CONTENT_DESTINATION_NON_CLAIMS[0]` states "No social provider is connectable in Hebun." **Now
   false**; Instagram is connectable. Intent intact, supporting claim drifted. (§8)
2. `goals` / `missions` tables are exported from the schema barrel with **zero queries** against
   them. (§7)
3. `command-goals` presents **four compiled-in seed rows** as strategic goals. The file says so
   itself. (§7)
4. The standing-observation cadence gate uses `since < intervalMinutes * 60_000` at millisecond
   precision. Because every observation lands ~19s after the hour, the tick exactly 1440 minutes
   later always falls short and each capability **slides one hour later per cycle** — an effective
   25-hour cadence. Measured on both Instagram capabilities. **Not repaired; explicitly out of scope
   for this review.**
5. `enterprise-intelligence`, `enterprise-organizational-intelligence` and
   `organizational-intelligence` contain **no database access** — architecture-published,
   runtime-absent. Consistent with the two-axis finding in the system inventory.
