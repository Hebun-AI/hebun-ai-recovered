# TRH-IG — Capability-Scoped Observation Reads + Media Surface — PRODUCTION-ACCEPTED

Turkish Rug House can now see its own recent Instagram posts in Hebun, read from stored history. And
the account section above it has stopped lying.

This release carries two things, and the order matters: **a repair first, a feature second.** The
feature could not be built correctly without the repair, and the repair was only discovered because
somebody went to build the feature.

    PROVIDER KEY != OBSERVATION CAPABILITY

## The defect, and how it was found

Building the media consumer meant asking the read seam for "the latest media observation". The seam
could not express that. `ProviderObservationQuery` was `{ providerKey?, subjectRef?, limit? }` — there
was **no capability predicate** — and the released account consumer therefore asked only for
`{ providerKey: "instagram", limit: 1 }`.

While Instagram had one observable capability that question was unambiguous. From
`2026-09-10T14:00:19Z`, when the first media observation landed, it stopped being: the newest
Instagram row was now a *media* row, whose fact keys are `accountId / recentMediaCount /
moreMediaExist / recentMedia`. The account projection looked for `username`, `accountType`,
`followersCount`, `followsCount`, `mediaCount`, found none of them, and correctly narrowed all five
to `null` — which the surface renders as **"Instagram did not report this."**

So production told the tenant that Instagram had withheld five facts it had actually reported six
hours earlier. Proven before any code was written, by running the released projection's own narrowing
rules over the real stored row:

    query returns   capability = instagram.media.public.read   observed 14:00:19.320Z
    account section username null · accountType null · followers null · following null · media null
    truth at 08:00  username turkishrughousecom · followers 56

**Impact was truthfulness, not security.** No wrong tenant's data was exposed, nothing was mutated,
every stored row was correct. The page misattributed an absence to the provider.

## Root cause, stated precisely

The same ambiguity that broke the authorize ceremony on the same day, surfacing differently.

    the ceremony  could not know which scope a human meant  →  IT REFUSED
    this seam     had to return something                   →  IT RETURNED THE WRONG ROW

A resolver may fail closed. **A read cannot** — it must hand back a row — so the ambiguity was
absorbed silently and a projection described the result. That is the transferable half: when a
selector becomes ambiguous, the component that can refuse will tell you, and the component that must
answer will not.

The second half is about the missing filter itself. **A predicate a caller cannot express is a
predicate every caller silently omits.** No consumer was careless; the seam simply offered no way to
say the thing they all meant.

**Authority owner:** `provider-observation-history/read-provider-observations.server.ts`.

## The repair — narrow, and inside the released authority

An optional `capabilityKey` on the query, and one predicate line. **No second seam**, no new
authority, no schema. Both consumers then say which vocabulary they understand:

    account section → capabilityKey: instagram.account.public.read
    media section   → capabilityKey: instagram.media.public.read

Both remain `limit: 1`, both take the tenant from the session, and neither may be unscoped again: a
test now asserts that **every** `readProviderObservations` call on that page names a capability.

## The media surface

One additional section on the existing page — no new route, no navigation entry. It renders the
stored bounded window: the observed instant, how many media that observation carried, what the window
edge means, and per item the media type, published instant, caption, the two provider-reported counts,
and a link out.

Deliberate omissions, each for a reason. **`mediaId` is not projected** — it aligns observations
across time; a reader does not need it. **`recentMediaCount` is read as stored, never recomputed**
from the array, so a disagreement between the stored count and the stored items stays visible instead
of being quietly reconciled. **`moreMediaExist` has three answers** — `true`, `false`, and `null` for
unknown — because an absent or malformed fact is not "no more exist".

**A permalink is a policy, not a guess:** `https:` only, Instagram hosts only, `rel="noreferrer
noopener nofollow"`. A permalink that fails the policy removes the *link*, not the media. Nothing is
fetched — no image, no preview, no `media_url`, no `thumbnail_url`. Those fields were never stored,
and inventing a placeholder would imply content Hebun does not have.

## Release and deployment

    commit  1cef7b4585801f0448def326a470cbceec21826f
    parent  0b2696100e4961ecfcd4b35d99ce2a75238d1e8d
    scope   6 files · 966 insertions · 11 deletions · no schema, no migration, no cron
    deploy  dpl_zHc7ZMrw21MBhMbWTr9z5uYUPSfU · READY · production

Recorded honestly: the Vercel REST token this session had been using went stale, so `meta.githubCommitSha`
could **not** be read for this deployment, and `vercel inspect` hides git metadata. The binding rests
on the push, on the deployment appearing immediately after it and reaching READY in production, on
`www.hebuntech.com` serving that exact deployment id in every asset URL — and, most convincingly, on
behaviour: the account section could only show the 08:00 instant if the capability-scoped query is
the code actually running.

## Authenticated production acceptance

Under a real Turkish Rug House session, `GET /integrations/instagram → 200`.

**The account section is repaired.** It now reads `2026-09-10T08:00:18.986Z` and renders
`turkishrughousecom · BUSINESS · 56 · 83 · 8`. The five "Instagram did not report this" lines are
gone, and the media instant no longer appears in that section.

**The media section renders** at `2026-09-10T14:00:19.320Z`: eight items, each `IMAGE`, with its
publication instant, full caption, likes (3–5) and comments (all a real `0`, rendered as `0`), and a
working link. The window sentence reads *"Instagram reported no additional media beyond this observed
collection at that instant"* — past tense, because `moreMediaExist` was `false` **at that instant**
and is not a claim about now.

**Measured on the rendered document, not asserted:**

- **Zero UUIDs in the entire HTML.** Observation, integration, authorization, invocation, external
  account id and every `mediaId` are all absent.
- **Zero banned words** — no engagement, growth, trend, top/best post, performance, recommendation,
  analytics, stale, fresh, outdated, "currently has", average or score.
- **Captions render as text.** No `<script>` survives into any rendered element; the hashtags and
  emoji appear as characters. React's escaping is the whole mechanism, and it is sufficient.
- **8 anchors, all `https://www.instagram.com`, all `rel="noreferrer noopener nofollow"`,
  `target="_blank"`.**
- **0 `<img>` elements on the page.**

## What rendering did not cause

| Measure | BEFORE 15:00:40Z | AFTER 15:04:41Z |
|---|---|---|
| Observations (total / TRH account / TRH media / other tenant) | 6 / 1 / 1 / 0 | identical |
| Latest account · media instants | 08:00:18.986Z · 14:00:19.320Z | identical |
| Authorizations | account rev 1 active · media rev 1 active | identical |
| Integration | connected · healthy · v3, `updated_at` 06:57:02Z | identical |
| Credential | `oauth_access` v1 | identical |
| Governance decisions · audit rows | 14 · 82 | 14 · 82 |
| Tables | 68 | 68 |

Every one of 61 browser requests was same-origin. None reached `graph.instagram.com`,
`api.instagram.com` or `graph.facebook.com`. **No provider contact, no observation, no Governance
mutation, no audit row.**

**Credential access during the page read: not directly observable.** No decrypt telemetry exists in
this repository — the credential audit vocabulary is `stored / replaced / revoked / destroyed`, all
lifecycle writes, never a read. Nothing was decrypted to prove nothing was decrypted. The support is
structural: no credential module is reachable from the consumer's import graph, and the credential
row's version and timestamps are unchanged.

## Limits

1. Credential-decrypt observability, above.
2. **Commit-SHA binding is inferential this time**, above.
3. `null` like counts and a truncated window remain **test-only** — this account hides nothing and
   its eight posts fit inside the window of ten.
4. **One observation, one page.** No history list, no second consumer, no pagination.
5. **No freshness authority.** The page shows an instant and refuses to judge it.

## What this did not create

No schema, no migration (68 tables, journal untouched), no scheduler or cron, no new authority, no
new credential kind, no provider runtime change — the diff under `provider-instagram/` is zero. And
nothing downstream: **no Knowledge admission, no Heby consumption, no agent access, no analytics.**
The consumer computes nothing: no total, no average, no rate, no ranking. Storing engagement counts
creates the possibility of analytics and none of the authority for it.

## The sentence Hebun can now truthfully say

> A human holding this tenant's session can see what Instagram reported about the account, and what
> it reported about the account's recent posts, each read from stored history under its own named
> capability — without contacting the provider, opening a credential, spending an authorization,
> writing a row, or claiming any of it is still true.

## Related

- `hebun-trh-ig-media-observation-closure.md` — the capability and its first machine execution.
- `hebun-trh-ig-stored-observation-dashboard-consumption-closure.md` — the account consumer this
  release repaired.
- `hebun-provider-observation-consumption-discovery.md` — why observations do not become Knowledge.
