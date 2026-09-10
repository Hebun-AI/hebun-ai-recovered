# Hebun — Social Intelligence Workspace Specification

## Document Status

**DOCUMENT TYPE: PRODUCT VISION — SOCIAL INTELLIGENCE — PRODUCT ARCHITECTURE + INFORMATION ARCHITECTURE**

**STATUS: DESIGN ONLY — NO IMPLEMENTATION.** No sidebar code, no UI, no runtime, no schema, no
provider contact, no production change. This document decides *where* Social Intelligence belongs
and *what it may truthfully say*; it builds none of it.

**Discovery basis:** branch `main`, `HEAD == origin/main == f7354505559672bdea4b7f3c81da944d06a66a19`,
0 ahead / 0 behind, staging empty. Production evidence read read-only through the released
observation history on 2026-09-10T21:07Z. Read: `workspace-nav.ts`, `sidebar.config.ts`,
`hebun-navigation-architecture.md`, `OBSERVABLE_CAPABILITIES`, the Instagram and YouTube provider
contracts, `read-provider-observations.server.ts`, `account-measurement-series.ts`, and the released
navigation-truth tests.

The reference dashboard the Director selected is used as **composition inspiration only**. No
branding, label, colour, geometry, sidebar wording or sample data from it appears here.

---

## 1. Product Purpose

Hebun should eventually answer one question in one place:

> **What is happening across the social channels this organization has actually connected?**

Today that answer is scattered. Instagram has a real surface at `/integrations/instagram`; YouTube
has four stored observations and **no surface at all**; nothing composes them. A Director wanting to
know how the organization's audience is developing has nowhere to look.

Social Intelligence is that place. It is a **reading** surface over stored provider evidence. It
connects nothing, authorizes nothing, and calls no provider.

### The separation this document will not collapse

```
INTEGRATIONS         what systems are connected to Hebun?      → setup, lifecycle, control
SOCIAL INTELLIGENCE  what is happening on those channels?      → analysis, understanding
```

These stay apart because they answer to different authorities and different failure modes. A broken
connection is an *operations* problem; a flat follower count is a *product* fact. Merging them
produces a surface where "we cannot reach Instagram" and "Instagram reports no growth" look alike.

---

## 2. Navigation Decision

### The candidate, and why it was tested rather than accepted

The proposal put to this phase was `Intelligence → Social Intelligence`. It was **not** assumed
correct. Testing it against the repository produced the single most consequential finding here.

### There are two navigation systems, and only one is live

| File | Status | Evidence |
|---|---|---|
| `src/config/workspace-nav.ts` | **LIVE** | imported by `workspace-rail.tsx`, `secondary-nav.tsx`, `mobile-nav.tsx`, `topbar.tsx` — the actual app shell |
| `src/config/sidebar.config.ts` | **LEGACY** | imported only by `module-placeholder.tsx`, `sidebar-item.tsx`, `sidebar-section.tsx` — the catch-all placeholder path |

Any decision taken against `sidebar.config.ts`'s twelve sections (Director, Architecture, Workforce,
Customer Ops, Finance, HR, Legal, Infrastructure, Governance, Learning, Marketplace, Integrations)
would be a decision about a structure users do not navigate. The authoritative model is the **seven
workspaces**: Command · Intelligence · Knowledge · Operations · Workforce · Governance · Platform,
plus ambient Heby.

### Every level of that model is exactly-counted and test-locked

This is the constraint that decides the placement:

| Lock | Where | Asserted in |
|---|---|---|
| Exactly **seven** workspaces | `WORKSPACES.length === 7` | `phase-20d/closure.ts`, `security-center/security-center.ts`, `cmdb2-canonical-command-l2/navigation.ts`, `vi2-shell-readability/foundation.ts` (×2), `governance-overview/overview.ts` |
| Exactly **six** Intelligence surfaces | `intel.destinations.length === 6` | `intelligence-l2/navigation.ts:34` |
| The exact Intelligence label list | label-by-label equality | `phase-20d/closure.ts:70` |
| Top level "does not grow" | principle 2 | `hebun-navigation-architecture.md` §1, restated in `workspace-nav.ts`'s header |

**There is no free slot anywhere.** This is not an obstacle to route around — it is the product
architecture defending itself, and it means the navigation decision below is a deliberate amendment
requiring Director approval, not an entry someone adds.

### Options, measured

**A new eighth workspace — REJECTED.** It contradicts principle 2, breaks six released test files,
and under MASTER-ROADMAP §18 rule 12 a change to the major product-line model requires explicit
Director architectural review. Social Intelligence is normal product growth; principle 2 exists
precisely to stop normal product growth from widening the top level.

**Inside Platform — REJECTED.** Platform is *"providers, integrations, and administration"* and its
`/integrations` destination already owns connection truth. Putting analysis there merges the two
responsibilities this document keeps apart. It is also `roles: ["director", "admin"]`, which would
hide channel performance from operators and specialists who have every reason to read it.

**Inside Intelligence — RECOMMENDED.** Intelligence is *"make sense of what the organization is
learning"*, visible to all four roles, and is already the workspace where observation becomes
understanding. Social Intelligence is that sentence applied to external channels.

### The decision

> **Social Intelligence becomes a Level-2 destination inside the Intelligence workspace, at
> `/intelligence/social`, taking the Intelligence L2 count from six to seven.**
>
> Per-platform drill-down lives at Level 3 — `/intelligence/social/instagram`,
> `/intelligence/social/youtube` — and **never appears in navigation.**

Two consequences must be accepted openly rather than discovered later:

1. `tests/intelligence-l2/navigation.ts` and `tests/phase-20d/closure.ts` must be amended. Both
   encode a *locked IA decision*; amending them is the act of taking a new one. Neither may be
   weakened — the count moves from 6 to 7 and the label list gains one entry.
2. Social Intelligence is **not** part of the Intelligence candidate lifecycle. The existing six
   surfaces (Overview · Signals & Assessments · Candidates · Insights · Readiness & Pathways ·
   Recommendations) trace organizational-intelligence runtime candidate kinds. Social Intelligence
   sits beside that lifecycle over *external provider evidence*, and the surface must not imply a
   social measurement is an organizational "signal" or "candidate".

### Why per-platform entries are forbidden in navigation

This is not taste. `sidebar.config.ts` once carried Gmail, GitHub, Supabase and Vercel entries with
coloured status dots fed by a fixture. All were deleted, the `status` badge variant was removed from
the union so a false badge is *unrepresentable*, and
`tests/navtruth-integration-badges/sidebar-connection-truth.ts` asserts the mechanism stays gone.
Its reasoning applies verbatim here:

> navigation config is a static module literal evaluated once and shared by every request of every
> tenant; connection truth is per-tenant and per-request.

A nav listing "Instagram · YouTube · LinkedIn · TikTok" would assert to every tenant that Hebun has
those channels — the exact claim that was deleted. One stable entry; platforms appear **inside** the
surface, where a per-request read can tell the truth about them.

---

## 3. Responsibility Boundary

**Social Intelligence eventually owns** the answers to:

1. What is happening across our connected social channels?
2. How are those channels changing over time?
3. What content did the providers report, and what did they report about it?
4. What changed between observations?
5. Which numbers came from a provider, and which did Hebun compute?
6. (Later) What does Heby make of it?

**It owns none of this, ever:**

| Not owned | Stays with |
|---|---|
| OAuth, credential storage, decryption | Integration Credentials |
| Connection lifecycle, verification | Integration Authority |
| Provider capability availability | Capability Authority |
| Governance authorization to observe | Standing Observation Authorization |
| Observation execution, scheduling | Observation Trigger + observation seam |
| Durable provider evidence | Provider Observation History |
| Knowledge admission and ratification | Knowledge Authority |

Social Intelligence is a **consumer**. Every fact it shows was written by an authority that already
existed, and it can create no evidence of its own.

---

## 4. Target Dashboard Anatomy

```
/intelligence/social — Social Intelligence Overview

┌──────────────────────────────────────────────────────────────┐
│ TOP · Platform cards — one per CONNECTED platform            │
│   [ Instagram ]  [ YouTube ]        (only what is connected) │
├──────────────────────────────────────────────────────────────┤
│ MAIN · Audience / Account Evolution                          │
│   per-platform series, provenance preserved, never summed    │
├──────────────────────────────────────────────────────────────┤
│ SECONDARY · Content Performance                              │
│   platform-aware; no universal engagement score              │
├──────────────────────────────────────────────────────────────┤
│ RECENT CONTENT                                               │
│   composed from released per-platform consumers              │
├──────────────────────────────────────────────────────────────┤
│ FUTURE · Heby Social Brief — visually and semantically apart │
└──────────────────────────────────────────────────────────────┘
```

Composition qualities taken from the reference: strong overview hierarchy, compact summary cards, one
large central visualization, secondary insight panels, a recent-activity area, generous whitespace,
enterprise density, clear platform identity. Built entirely from existing Hebun tokens, typography,
`Card`/`Badge`/button primitives and layout conventions. **No parallel design system.**

---

## 5. Platform Card Model

One card per platform the tenant has **actually connected**. Never one per provider module Hebun
happens to contain.

### The connection-state trap, found in production

Both live connections read:

```
provider_key  status     connection_state   health
instagram     pending    connected          healthy
youtube       pending    connected          healthy
```

`status` says `pending` for two genuinely connected, healthy providers. A card that renders `status`
would tell every tenant their working channels are pending. **The card must derive live-ness from
`connection_state` (and `health`), through the connection authority — never from `status`, and never
from the existence of a provider module or catalog entry.**

### Card contents, per platform, no forced symmetry

| Slot | Instagram | YouTube |
|---|---|---|
| Identity | `username`, `accountType` | `title`, `handle` |
| Audience | `followersCount` | `subscriberCount` (+ `hiddenSubscriberCount` — a withheld count is not zero) |
| Content volume | `mediaCount` | `videoCount` |
| Reach | — (not reported) | `viewCount` |
| Observed | latest `observedAt` | latest `observedAt` |

Instagram reports `followsCount`; YouTube has no equivalent and the card shows none. **Forcing
identical metrics across providers is how a dashboard starts lying.** A slot with no provider fact
behind it is absent, not zero.

---

## 6. Analytics Visualization Model

### Followers are not subscribers

A unified chart may exist; a unified *metric* may not. Instagram followers and YouTube subscribers
are different provider facts with different semantics — a subscriber can be hidden, a follower
cannot; one implies notification delivery, the other does not. They may share an axis when the
presentation names each series by its provider and its own metric. They may never be added,
averaged, or reported as one "audience" number.

### One measurement is not a series

The released `deriveInstagramAccountMeasurementSeries` (IG-AN1) already encodes the rule this
visualization inherits: five distinguishable states, with `single-measurement` as its own status so
that "nothing is comparable yet" is a type rather than a length check. The chart must render that
state as an honest statement, not as a one-point line implying a trend.

### The empty-room case is real and must render well

YouTube's four observations report `0` subscribers, `0` videos, `0` views — genuine zeros, not
withheld (`hiddenSubscriberCount: false`). The honest chart is a flat line at zero. A design that
only looks right with rising numbers is the wrong design: **this tenant's real data is the flat
case**, and it must not read as an error or as missing data.

---

## 7. Recent Content Model

Compose released consumers; do not re-derive.

- **Instagram** — the released Recent Content card grid already exists
  (`instagram-media-cards.tsx`, IG-UI1, production-accepted). Social Intelligence composes it. It
  renders no images by design: the observation contract deliberately stores no `media_url` or
  `thumbnail_url`, because both are ephemeral signed CDN links an immutable observation must not
  claim. That constraint carries over unchanged.
- **YouTube** — stored `recentVideos` carry `videoId`, `title`, `publishedAt`, `viewCount`,
  `likeCount`, bounded by `MAX_RECENT_VIDEOS = 10`, with `moreVideosExist`. **No consumer exists.**
  One must be built (YT-SOC) before YouTube content can appear.
- Publication time and observation time are different instants and must stay visually distinct —
  the defect production acceptance caught on the Instagram cards, fixed by labelling the date
  `Published …` beside the section's `Observed by Hebun at …`.

---

## 8. Platform Drill-Down Model

Level 3, contextual, never in navigation:

```
/intelligence/social                    unified overview
  → /intelligence/social/instagram      Instagram analytics
  → /intelligence/social/youtube        YouTube analytics
```

These are **analysis** surfaces and are distinct from `/integrations/instagram`, which is a
**connection** surface. Both may exist; each links to the other. The drill-down inherits every
provenance rule below.

---

## 9. Truth and Provenance Semantics

Four layers must stay visibly distinct. The design may not erase them.

| Layer | Meaning | Example |
|---|---|---|
| **PROVIDER REPORTED** | Raw external evidence, as stated | Instagram reported 56 followers |
| **HEBUN OBSERVED** | When Hebun obtained it | at 2026-09-10T08:00:18.986Z |
| **HEBUN CALCULATED** | Deterministic, from sufficient evidence | +5 followers between two observations |
| **HEBUN INFERRED / RECOMMENDS** | Judgement — future | "growth is accelerating" · "post more like X" |

Pinned distinctions, carried from the released Instagram work:

```
CONNECTED        != OBSERVED
OBSERVED         != KNOWLEDGE
STORED           != CONSUMED
PROVIDER COUNT   != ANALYTICS
PUBLICATION TIME != OBSERVATION TIME
null             != 0
ONE MEASUREMENT  != A SERIES
```

`null` means the provider did not report it and must never render as `0`. A real `0` must never
render as absence. Nothing on this surface may claim a stored number is *still* true.

---

## 10. Current Capability Matrix

Measured against production on 2026-09-10T21:07Z, not inferred from plans.

**Stored evidence**

| Provider · capability | Observations | Span |
|---|---|---|
| `instagram.account.public.read` | **1** | 2026-09-10T08:00:18.986Z |
| `instagram.media.public.read` | **1** | 2026-09-10T14:00:19.320Z |
| `youtube.channel.public.read` | **4** | 2026-09-07T14:40Z → 2026-09-10T11:00Z |

All three scopes carry an **active** standing authorization at revision 1, `interval_minutes = 1440`.
`OBSERVABLE_CAPABILITIES` holds exactly these three triples.

**The inversion this discovery produced:** the assumption entering this phase was that Instagram
leads. It does not. **YouTube is the only platform with enough history to compare today** — four
observations against Instagram's one. Instagram has the richer *content* evidence; YouTube has the
only *time series*. The roadmap below follows that measured reality rather than the assumption.

**Per element**

| Element | State |
|---|---|
| Instagram platform card | **AVAILABLE NOW** — connection, identity and four counts stored |
| Instagram recent content | **AVAILABLE NOW** — released consumer, production-accepted |
| Instagram measurement series | **DERIVABLE NOW** — IG-AN1 released; returns `single-measurement` |
| Instagram follower delta / trend / % growth | **WAITING FOR HISTORY** — one observation; nothing to subtract |
| Instagram per-post evolution | **WAITING FOR HISTORY** — one media observation |
| YouTube platform card | **DERIVABLE NOW** — evidence stored, no consumer built |
| YouTube subscriber series | **DERIVABLE NOW** — four points; honest result is flat at zero |
| YouTube subscriber delta | **DERIVABLE NOW** — and the truthful answer is `0` |
| YouTube recent content | **REQUIRES NEW CONSUMER** — `recentVideos` stored, nothing reads it |
| Unified cross-platform overview | **FUTURE** — no composition layer exists |
| LinkedIn · TikTok · Facebook · X | **REQUIRES NEW PROVIDER CAPABILITY** — no module, catalog entry, capability, transport or credential kind. They do not appear on this dashboard, in any state, until they exist. |
| Engagement score, benchmarks, forecasts | **FUTURE / NOT IMPLEMENTED** — no authority defines them |
| Heby social brief | **FUTURE / NOT IMPLEMENTED** |

---

## 11. Dependency Roadmap

Ordered by dependency, not by date. IDs conform to MASTER-ROADMAP §17 (delivery labels, never
authorities); `IG-AN1` keeps its released name — §17 forbids force-renumbering.

| ID | Scope | Depends on | State |
|---|---|---|---|
| **SOC-0** | Product architecture + navigation decision (this document) | — | **THIS PHASE — awaiting Director approval** |
| **IG-AN1** | Instagram account measurement-series foundation | — | **RELEASED** `f735450` |
| **YT-SOC1** | YouTube channel measurement-series derivation, mirroring IG-AN1 | IG-AN1 pattern | **READY** — 4 observations exist |
| **SOC-UI1** | Social Intelligence shell + platform cards | SOC-0, YT-SOC1 | Blocked on SOC-0 approval |
| **IG-AN2** | Instagram account deltas | ≥2 usable observations | **BLOCKED — data.** Next observation expected at the 2026-09-11T09:00Z tick |
| **SOC-UI2** | Audience evolution visualization | YT-SOC1, IG-AN2 | Renders honestly with either |
| **YT-SOC2** | YouTube recent-content consumer | YT-SOC1 | Not started |
| **SOC-UI3** | Content performance + recent content composition | IG-UI1, YT-SOC2 | Not started |
| **IG-AN3** | Instagram per-post measurement evolution | ≥2 media observations | Blocked — data |
| **SOC-PROVIDERS** | Additional platforms | A real connection + capability each | Not started; no candidate exists |
| **SOC-HEBY** | Heby social brief / recommendations | Analytics contracts mature | Deferred |

**The ordering finding:** `YT-SOC1` is the only analytics phase that is not data-blocked. It can be
built and honestly rendered today, where `IG-AN2` cannot. Whether flat-zero YouTube analytics is
worth building first is a Director product call, not a technical one — the technical answer is that
it is available.

---

## 12. Deferred Capabilities

Recorded as decisions, each with its reason:

- **Cross-platform unified audience total** — deferred indefinitely. Summing followers and
  subscribers invents a metric no provider reports.
- **Universal engagement score** — deferred. It would be a Hebun calculation presented as a fact,
  and no authority defines it. If it is ever wanted, it needs its own definition and governance.
- **Thumbnails and media previews** — deferred. Storing an ephemeral CDN URL corrupts observation
  immutability; fetching image bytes at observation time is a data-contract decision needing its
  own discovery. No placeholder tile stands in for a photo.
- **Benchmarks, competitor comparison, forecasting** — not implemented; no evidence supports them.
- **Per-tenant observation pause** — already deferred at the authority level; the provider-read kill
  switch is deployment-global.

---

## 13. Security and Governance Constraints

1. The Social Intelligence UI **never** touches credentials, Meta, YouTube APIs, or raw tables. Its
   only inputs are authorized read seams.
2. Tenant scoping stays owned by `readProviderObservations`, whose tenant predicate is unconditional
   and derived from `TenantContext`. No composition layer may accept a caller-supplied tenant.
3. Every read is **capability-scoped**. An unscoped read caused a live production defect: the
   account section received a newer *media* row and reported five facts as unreported that the
   provider had given hours earlier. `capabilityKey` is mandatory, per platform, per section.
4. No internal identifiers on screen — no tenant UUID, integration id, authorization id, invocation
   id, external account id or media id.
5. Reading is not observing. Rendering this page contacts no provider and spends no quota.
6. Governance authorization remains the only thing that permits recurring observation. This surface
   displays evidence; it can never request more of it.

---

## 14. Future Heby Role

Heby's existing reach is a **provider call**, not a history read: `provider-observation-commands.server.ts`
observes one YouTube channel live and stores nothing. That is not the Social Intelligence path.

The eventual `SOC-HEBY` boundary is a **preparation** step that reads the same composed view model
the UI reads, and produces a brief — what changed, why it may matter, what deserves attention. It
must be:

- **visually and semantically separated** from provider-reported facts and Hebun calculations;
- explicitly labelled as inference or recommendation;
- free to **abstain**. `TRH-20` is the precedent worth keeping: asked to propose growth work against
  a 0/0/0 channel, the agent abstained, and the abstention *was* the acceptance. A social brief with
  nothing to say must say nothing.

Nothing in this phase implements, authorizes, or schedules any of it.

---

## Related

- `docs/product-vision/ui/hebun-navigation-architecture.md` — the seven-workspace model this
  decision amends.
- `docs/MASTER-ROADMAP.md` §20.2 — where the Social Intelligence program is recorded.
- `docs/product-vision/runtime/hebun-trh-ig-media-card-surface-closure.md` — the released Recent
  Content surface this composes, and the accessibility defect that shaped it.
- `docs/product-vision/runtime/hebun-trh-ig-capability-scoped-observation-surface-closure.md` — why
  every read here must name its capability.
