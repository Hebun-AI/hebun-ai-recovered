# TRH-20 — Governed Growth Proposal — RELEASED

A live public YouTube channel observation may now inform whether Turkish Rug House's durable agent
asks a human to record organizational work. The observation is fenced, the ask is bounded, and a
human still decides.

Production acceptance is **NOT** claimed by this document. It is blocked on a Director-operated
provider connection ceremony, described at the end.

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
