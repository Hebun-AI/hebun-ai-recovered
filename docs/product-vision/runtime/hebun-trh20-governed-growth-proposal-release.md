# TRH-20 — Governed Growth Proposal — PRODUCTION-ACCEPTED

A live public YouTube channel observation may now inform whether Turkish Rug House's durable agent
asks a human to record organizational work. The observation is fenced, the ask is bounded, and a
human still decides.

Production acceptance **was** subsequently obtained, and the record of it is at the end of this
document, below the gate it originally stopped at. The gate section is kept as written rather than
rewritten, because what a phase stopped on is part of its history.

## What this phase composed, and what it refused to build

Two released seams, composed, with nothing new underneath either of them:

| Seam | Released by | What it already did |
|---|---|---|
| `readPublicChannelObservation` | CGO-5 | three `list` calls, three quota units, one page, no persistence, capability authority first |
| `originateAgentAction` | AGENT-PROPOSAL-1, TRH-17/18/19 | a durable agent proposes one bounded action for a human to decide, and stops |

What TRH-20 added is a **second fence** and a **composition**. It did not add a Growth authority, an
analytics store, an observation history, a metric table, a recommendation record, a second provider,
a new action kind, a widened mandate, a scheduler, a webhook, a server action, a UI surface, a
schema object or a migration. The migration ledger it inherits is the ledger it leaves.

## The tension it had to resolve, stated plainly

The business question is *what should we do next*. CGO-7's released fence forbids the model from
recommending, ranking or prescribing what the organization should make next.

Both are right, about **different acts**. That fence governs a model **writing a draft**, where a
prescription arrives dressed as the organization's own finding. Origination is the other act: the
model is deciding whether to **ask** a human to record work, and every reply it can make is refused,
filed as `pending`, or nothing at all.

So the fence was **forked, not loosened**. `growth-origination-brief.ts` keeps every denial the
released fence makes about a number, and changes exactly one thing: the model may let the
observation inform *whether* work is worth proposing and what that work is called. The released
fence is untouched and still forbids prescription in a draft.

The facts are **shared by construction**. `observationFactsFor` was extracted from the released
renderer and is now called by both briefs, so two renderings of one observation cannot drift. A test
asserts both blocks end with the same bytes.

## The failure mode this phase's own fence exists for

A model asked a growth question reaches for watch time, retention, click-through rate, impressions,
traffic sources, search terms, audience demographics, subscriber movement, conversions and revenue.
The released provider contract can return **none** of them, and every one is plausible rather than
absurd — which is exactly why they are denied **by name** rather than by category, and why the fence
says they must not be stated, estimated, approximated or inferred.

## Where the supplement lives, and why that placement is the safety argument

It is a **dep of the origination seam**, never a field of `OriginateActionInput`. Ten released
assertions read the browser boundary in `heby/actions.ts` and prove it forwards `{ goal }` and
nothing else; a supplement accepted there would be a channel through which a browser could write
arbitrary text straight into the model's grounding. As a dep it is unreachable from the browser, and
the only module that ever sets it is the composition — which overwrites whatever a caller passed,
including with `undefined`.

It is appended **after** the candidate lines and never merged into them. A candidate is something
the model may NAME; this is something it may READ.

## What is proved, and how

| Claim | Where |
|---|---|
| every denial precedes the first number, at the real model seam | postgres suite, reading the system message the transport received |
| an unavailable metric is denied by name and appears in no reported fact | truth suite |
| the two briefs share their facts and their fences genuinely differ | truth suite |
| the agent may ABSTAIN, and abstaining files nothing | postgres suite |
| the agent may select `record-work`, and one `pending` request lands | postgres suite |
| the mandate ceiling still refuses `send` | postgres suite |
| the rationale is durable, verbatim, and outside the canonical payload | postgres suite |
| the work title carries no figure while the rationale may cite one | postgres suite |
| no permit, no execution, no Governance decision, no Knowledge row, no work item | postgres suite |
| the provider's channel id, handle and rendered counts reach no row | postgres suite |
| a caller-supplied supplement is discarded, not merged | truth suite |
| the provider is still read-only and still public | truth suite |
| the browser boundary is unchanged | truth suite |
| four guards actually bite when the source is mutated | bite proofs (4/4) |

Local verification: `tsc --noEmit` clean, `eslint` 0 errors (15 pre-existing warnings, none in this
phase's files), **694 passed / 0 failed / 694 total**, `next build` green.

## A defect this phase found in a released ceremony

`scripts/youtube-admission.ts` resolved "the Director's tenant" with `limit 1` over their active
memberships. The Director now holds **two**, so re-running it would have connected a provider to
whichever organization happened to sort first — a wrong-workspace write, silently. The ceremony now
requires `--tenant=<slug>` whenever more than one membership exists, and prints the organization it
resolved before writing anything.

The key-equality proof was strengthened at the same time and for a related reason. It probed only the
selected organization's own credentials, so a **new** organization could never prove the loaded
encryption material was production's — the first organization to be connected would always have had
to be admitted under `--accept-unproven-keys`, permanently, by arithmetic rather than by evidence.
The question the check actually asks is whether *these keys* open something production sealed, and
any credential production sealed answers it. The probe now continues through the other organizations
the same Director is an active member of, **each read inside its own tenant context**, and names the
organization that supplied the proof. The bypass flag remains, as the last resort it was meant to be.

## The Director gate

Turkish Rug House holds **zero** provider connections. Everything above is therefore released and
unexercised against a real channel: the acceptance script currently reports
`capability-not-available`, which is the correct fail-closed answer and not a defect.

Two operator commands complete the phase. Neither prints a secret; the key is read from
`.env.hosted.local` by the quiet loader and never echoed.

```bash
npm exec -- tsx scripts/youtube-admission.ts --tenant=turkish-rug-house --dry-run
```

```bash
npm exec -- tsx scripts/youtube-admission.ts --tenant=turkish-rug-house
```

The dry run has already been performed and reported: it resolves Turkish Rug House by name, finds
zero YouTube connections, proves the loaded encryption keys open a credential production sealed, and
stops before any write or provider call. The second command creates one connection, stores one
`api_key`, and makes one real verification call.

Then, once the capability reports `available`:

```bash
npm exec -- tsx scripts/trh20-acceptance.ts --dry
```

```bash
npm exec -- tsx scripts/trh20-acceptance.ts
```

The first observes the channel live and prints the exact fenced block the model would receive,
spending three quota units and no model call. The second runs the whole path and measures the
outcome independently from production rows: the invocation's transport, provider, model, state,
failure code and filing outcome; the action request's kind, status, proposer and rationale; and the
ten tables that must not move.

## What remains deferred, with its gate named

- **Observation persistence and trend.** Blocked on naming the authoritative owner of a stored
  observation, which this phase deliberately did not invent. Until then no question about change over
  time is answerable, and that is stated rather than papered over.
- **Owned-channel analytics.** Blocked on provider app verification for a sensitive analytics scope.
- **Instagram as a provider.** Blocked on account type, application, and provider app review.
- **Digital products.** Blocked on the reach measurement that does not yet exist.

## Never

Autonomous publishing. Advertising spend authority. Automated comments or direct messages. Platform
metrics promoted into ratified organizational Knowledge. A channel handle stored on a connection row,
which would assert an ownership the credential does not carry.


---

# Acceptance — the agent looked at the channel and asked for nothing

Everything above was written while Turkish Rug House held no provider connection. The Director then
ran the connection ceremony and, separately, the two acceptance runs. Two things happened in between
that the release above could not have known, and both are recorded here rather than folded away.

## The first live read failed, and the handle was never the reason

`OBSERVED: no · not-found · youtube-http-404`.

A read-only forensic proved the channel resolves on the first call, with or without its leading
marker, and that the provider reports its own canonical spelling back. The failure was one step
later: **a channel with no public uploads has no uploads playlist to fetch.** The platform
materialises that playlist only once something is in it, so `playlistItems.list` answered
`404 playlistNotFound` — and the released seam read that as *the videos did not answer*. It was
wrong. The platform **did** answer, and `videoCount: 0` in the very same channel response stated the
same fact a second time.

The fix is recorded in its own commit and its own suite. Exactly one state converts: the typed
failure class is `not-found` **and** the channel's own statistics report zero videos. A channel that
claims uploads whose playlist cannot be read is still a real failure; a count the provider did not
report is null, and null is not zero. The decision is made on a class and a number, never by parsing
a reason string — a diagnostic must not be able to change what is believed.

Two smaller repairs travelled with it: quota is now counted at the call site rather than derived from
the shape of the result, and the provider's own word survives a 404 instead of collapsing into one
indistinguishable string.

## The acceptance run

| Step | Result |
|---|---|
| OBSERVED | **yes** — live public read, 2 quota units, third call never made |
| MODEL-CALLED | **yes** — live transport, ~1.4k input / 76 output tokens |
| MODEL-SELECTABLE | **yes** — the reply matched the closed contract |
| PARSE-ACCEPTED | **yes** — recorded as a correct no-action answer, not an invalid one |
| MANDATE-ADMITTED | not reached — nothing was offered to the ceiling |
| PROPOSAL-FILED | **no** |
| ABSTAINED | **yes** |
| GOVERNANCE-AUTHORIZED · PERMITTED · EXECUTED · SUCCESSFUL(external) | no, and none attempted |

The channel reports **no public videos, no public views and no subscribers**. The agent said so, in
its own words, named the channel state without claiming any number proved anything, invented none of
the eleven metrics the fence denies by name, and handed the decision back to a person.

**Abstention is the acceptance, not a shortfall.** A capability that could only succeed by
manufacturing work would not be a governed capability, and the whole point of the fenced brief is
that "propose nothing" stays a correct answer. The durable record keeps it separable from every
neighbouring outcome: the invocation carries the `no-action` state with **no failure code** and a
filing outcome of `not-attempted` — distinct from a malformed reply, from a refused filing, and from
a provider failure.

## Non-effects, measured independently after the run

Exactly **one** row moved in the entire tenant: the origination invocation. Action requests, permits,
execution attempts, Governance decisions, work items, work artifacts, knowledge nodes, knowledge
facts, external references, connections, credentials, answer-source evidence and the audit log all
held their counts.

Direct queries confirm **no** knowledge node, knowledge fact, work item or invocation row anywhere
carries the channel's handle or its provider identifier. The observation informed a decision and
became nothing — which is the sentence this whole phase exists to be able to say.

The organization's earlier proposal, filed a day before by a different phase, is untouched.

## What this does and does not establish

It establishes that a live public platform observation can reach a durable agent inside a fence, and
that the agent's answer lands in the governed record with the right semantics — including the answer
that asks for nothing.

It establishes **nothing about growth**, and the zeros are not a trend. There is no earlier
observation to compare them against, because nothing is stored. That absence is now the sharpest open
question this program has: with a channel at zero, the only interesting future fact is a CHANGE, and
no authority owns one. Naming that owner is the entry condition for any successor phase, and it was
deliberately not invented here.

Ledger 49 throughout. No schema, no migration, no new provider, no new scope, no write capability.
