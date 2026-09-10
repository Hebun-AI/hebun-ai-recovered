# TRH-IG — Instagram Media Card Surface (IG-UI1) — PRODUCTION-ACCEPTED

The recent-media surface stopped looking like an acceptance transcript and became a product.

What shipped is presentation only. The stored observation, the capability-scoped read, the provider
runtime and every authority underneath are byte-for-byte what they were before — and the numbers on
the cards are still measurements, not analytics.

    provider count != analytics
    publication time != observation time
    a test that passes != a property that holds

## What it replaced, and why that mattered

The released surface rendered each stored media as a full-width block carrying its entire caption.
Technically truthful, and unusable: eight posts became a vertical wall of text, captions dominated
the page, and scanning "what did this account post" meant scrolling past everything.

That presentation was right for an acceptance — every value visible, nothing summarised. It was
wrong for a surface a human opens on a Tuesday.

## What it is now

A responsive card grid: one column, two from `sm`, three from `xl`, following the product's most
common grid shape rather than new numbers. Each card carries a media-type badge, the publication
date, a clamped caption, the two provider-reported counts, and a link out.

Deliberate omissions, each with a reason rather than a shrug:

- **No images.** The observation contract stores neither `media_url` nor `thumbnail_url` — both are
  ephemeral signed CDN links whose expiry would make an immutable row claim a fact that had stopped
  being true. So there is nothing to render, and the card invents nothing: no placeholder tile, no
  gradient standing in for a photo, and above all **no fetch of the permalink to scrape a preview**.
  A text-first card that is honest beats a visual card implying content Hebun does not hold.
- **No `mediaId` in the view.** It aligns observations across time; a reader does not need it.
- **`recentMediaCount` is read as stored, never recomputed** from the array, so a disagreement
  between the stored count and the stored items stays visible instead of being quietly reconciled.
- **`moreMediaExist` keeps three answers** — true, false, and `null` for unknown — because an absent
  or malformed fact is not "no more exist".

The caption is **clamped visually, never truncated in the data**: `line-clamp-4` bounds the card, the
stored provider value is untouched, and the whole post stays one click away at its own permalink.
`break-words` is what stops a single unbroken hashtag from widening a column and scrolling the page
sideways.

## Release

    234f766  feat(instagram): redesign recent media as cards        5 files
    7baa359  fix(instagram): label media metrics accessibly         2 files

Both on top of `2ac176a`, the AMA1 maintenance repair that made the full suite green first.

**Zero authority diff.** No provider runtime, no observation authority, no read authority, no
capability, no Governance, no schema or migration, no scheduler, no credential, no Knowledge, no
Heby. The media read is unchanged and still capability-scoped:

    readProviderObservations(tenant, {
      providerKey:   INSTAGRAM_PROVIDER_KEY,
      capabilityKey: INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
      limit:         1,
    })

## The defect production acceptance caught

The first acceptance run did **not** pass, and the reason is the most useful part of this record.

Screen-reader users were being told nothing. Each card's `sr-only` span carried `count.value` — which
for a *reported* count is the bare digit. With both icons `aria-hidden`, assistive technology
announced **"5 … 0"** with no indication of which number was likes and which was comments. The label
string existed in the page's RSC payload as serialised props but was **never rendered**.

Separately, the date rendered bare — `28 Jul 2026` with no cue — directly beneath a header reading
`Observed by Hebun at …`. Two different instants, no on-card word distinguishing them.

**The firewall test had passed.** It asserted that a `sr-only` span existed and that a `count.value`
token appeared in the file. Both were true while the property the test named — *"the full sentence is
carried for screen readers"* — was false.

`7baa359` fixed both: the accessible text now reads `Likes Instagram reported: 5`, the withheld
sentence is preserved unchanged for the unreported path, and the date reads `Published 28 Jul 2026`.
The test was rewritten to read the `sr-only` element itself and require `count.label` inside it, and
**it was bite-proofed** — each defect was reintroduced and confirmed to make the test fail with the
right message, then restored.

## Authenticated production acceptance

Deployment `dpl_GzfekJ283EM1RcQhB5cBPdeMxzJv`, READY, production, `githubCommitSha` verified as
`7baa3598b53ba42c914af4f7607a7324d3b4ce22`, aliased and serving.

Measured on the live page, not eyeballed:

| Check | Result |
|---|---|
| Desktop 1440×900 | 3 columns, rows 3/3/2, **card height spread 0**, no overflow |
| Mobile 375×812 | 1 column, no overflow, 0 elements wider than viewport, CTA usable |
| Caption clamp | computed `line-clamp: 4` |
| Accessible labels | `Likes Instagram reported: N` / `Comments Instagram reported: N` on **8/8** cards |
| Bare number-only sr text | **none** |
| `Published` label | **8/8** cards |
| `Observed by Hebun at` | present and separate |
| Internal identifiers | **0 UUIDs** in the HTML; no account id, no media id |
| Permalinks | 8/8 `https://www.instagram.com`, `rel="noreferrer noopener nofollow"` |
| `<img>` elements | **0**; zero image or CDN resources requested |
| Meta page-load requests | **none** — all requests same-origin |
| Analytics vocabulary | **0** banned phrases in rendered text |

Account and connection sections verified unchanged in the same pass: the account section still reads
its own capability at `08:00:18.986Z` with real values, and the media section its own at
`14:00:19.320Z`.

## What rendering did not cause

Before and after the acceptance, every measured value identical: observation counts, both standing
authorizations (rev 1 active), the integration (`updated_at` untouched), credential version,
Governance decisions, `audit_log`, table count. **A page load remains a read of stored history.**

## Limits, recorded rather than smoothed

1. **No thumbnails**, and adding them is a data-contract decision, not a UI one — it would mean
   either storing an ephemeral URL (corrupting observation immutability) or fetching and storing
   image bytes at observation time. That deserves its own discovery.
2. **No analytics.** The counts are displayed exactly as the provider stated them at one instant.
   Nothing totals, averages, ranks or trends them, and no analytics authority exists.
3. **`null` counts and a truncated window remain test-only** in production terms — this account
   hides nothing and its eight posts fit inside the window of ten.
4. The media type label is transformed for readability (`IMAGE` → `Image`) but the design system's
   badge renders uppercase, so the transform is not visible. Harmless; recorded for accuracy.

## The sentence Hebun can now truthfully say

> A human opening this tenant's Instagram page sees the posts Instagram reported at a stated past
> instant, laid out as a scannable grid with each post's publication date, caption, and the two
> counts the provider gave — read from stored history, contacting nobody, computing nothing, and
> never claiming any of it is still true.

## Related

- `hebun-trh-ig-capability-scoped-observation-surface-closure.md` — the capability-scoped read this
  surface consumes, and the defect that made it necessary.
- `hebun-trh-ig-media-observation-closure.md` — the capability whose stored rows this renders.
