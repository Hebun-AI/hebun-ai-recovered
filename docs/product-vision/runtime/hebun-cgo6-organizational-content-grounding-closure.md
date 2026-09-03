# CGO-6 — Organizational Content Grounding — CLOSED / PRODUCTION-ACCEPTED

**Release** `fb0641a` · **ZERO schema** · **Production ledger 47, unchanged** · **Deployment**
`dpl_5ronn58i8j8EXSiw5DvQGpcaFEk1`, running `fb0641a` on `main`, aliased to `www.hebuntech.com`

---

## What Hebun can now do that it could not

`prepareWorkArtifact` declares `WORK_ARTIFACT_OWNER_WORKSPACE = "operations"`, so every
agent-prepared content draft is grounded through that one workspace profile. The profile carried
`operations` — Executive Overview sections the mock-surface gate withholds from a real tenant —
plus `governance` and the artifacts themselves.

    Before:  prior drafts, a governance record, and read-model sections a real tenant cannot see
    After:   + what this organization has recorded as KNOWLEDGE
             + what this organization has DECLARED it is working on

CGO-3 and CGO-4 made preparation agent-authored and review-ready. This is what it was review-ready
**about**.

---

## Three decisions worth keeping

**Two classes, one workspace, and nothing else.** `knowledge` and `work` both already had released,
connected, tenant-scoped readers, and the answer path already substitutes them for any profile that
declares the class. The entire capability is which classes one profile declares. No new source
class, no new reader, no new writer, no new authority, no ninth workspace, no schema.

**No provider observation arrived with it.** A YouTube view count is not an organizational record.
Folding provider material into a profile whose other classes are the organization's own would make
an outside number read like something this organization established. A test asserts no profile
carries a provider or performance class.

**Grounding is not authority.** Operations stays `advisory-only`. Seeing more did not make it able
to decide more, and the widening confers no mandate, no Governance standing and no execution.

---

## Production acceptance

Executed against production data through the released code at the deployed commit, with **no
provider call of any kind** — no Google, no Drive, no YouTube, no credential opened.

The preparation path resolved, for the Director's real tenant:

| Source class | Resolved from production | Standing asserted |
|---|---|---|
| `knowledge` | matched a real node — *"Hebun AI's authoritative source code repository is the GitHub repository maintained by HebunTech."* | `provisional`, `draft`, **not ratified** — carried, not flattened |
| `work` | both real work items, including *"Hebun Era III development"* (declared `active`) | authoritative record, **declared not observed** |
| `work-artifacts` | all six prepared artifacts, three of them content drafts | derived |
| `governance` | the genesis authority and member role baseline | authoritative |

Before CGO-6, `knowledge` and `work` resolved for this route not at all.

**The provenance travelled with the material, which is the half that matters.** The work projection
reached the composition still saying *"This is a DECLARED state, not an observed or verified one.
Hebun did not watch this work and cannot confirm what happened; declared complete is not successful
and is not an outcome"*, and the knowledge item still carried `provisional (NOT settled truth) ·
draft · no ratification recorded`.

### What this acceptance did NOT do, stated plainly

**No billable model call was made in production, so no production draft exists that was written
from this grounding.** The model runtime is connected only in the deployed environment; the operator
ceremony ran with it unavailable and the seam correctly refused with `no-model-answer` rather than
filing a deterministic placeholder as prepared work. Nothing was written: `work_artifacts` stayed at
**6**. One conversation turn was recorded, which is the seam's ordinary behaviour.

CGO-3 and CGO-4 were accepted with a real production model call. This one deviates, and the
deviation is named rather than papered over. The confirming step is one preparation in the deployed
Operations workspace; `scripts/cgo6-acceptance.ts` performs the same ceremony wherever the model
runtime is connected. The end-to-end path from these resolutions into the model's grounding context
is proven by test, against the real model-answer path, with the built request captured.

---

## Non-effects, measured

| Claim | How it was proved |
|---|---|
| Zero schema | Production migration ledger **47**, unchanged |
| No Knowledge written | `knowledge_nodes` **2**, unchanged — reading Knowledge to prepare a draft writes none |
| No Work written | `work_items` **2**, unchanged |
| No artifact written | `work_artifacts` **6**, unchanged |
| **No Google credential exercised** | Google credential rows **19**, live access credential still the one issued `19:30:37Z` expiring `20:30:36Z`, refresh credential untouched, and **no** `provider-refresh` audit row after `19:30:37Z`. The pending GOOGLE-PICKER-1 acceptance window is preserved |
| No YouTube lifecycle change | connection `connected`/`healthy`, version 3, one `api_key` credential |
| No provider write, publishing or scheduling | The grounding context is asserted free of provider material, and the brief still denies scheduling, publishing and delivery in one breath |
| No authority change | Operations `advisory-only`; no mandate, Governance or execution change |

---

## Truth limitations

- **Grounded is not correct.** More context did not make a draft true, and no claim about content
  quality is made or measurable here.
- **`work` is authoritative about the RECORD, never about the world.** Every state is DECLARED.
- **The matched Knowledge node is `provisional` and unratified.** It grounds a draft; it does not
  settle anything, and its own standing travels with it.
- **Knowledge retrieval is lexically degraded in production.** `pg_trgm` is not installed, so no
  trigram similarity is computed and a misspelled term may match nothing. Pre-existing, reported by
  the retrieval seam itself, not introduced here.
- **Prepared is not approved, approved is not scheduled, scheduled is not published.** Unchanged.

---

## Also repaired: a stale assertion CGO-5 had falsified

`tests/cgo1-content-draft/content-draft-truth.ts` asserted that no content destination appears in
the provider catalog — true only while no destination had a provider. CGO-5 legitimately connected
`youtube` as a credential-only public-read provider, and the assertion had been **failing since that
release**. The rule it defended never mentioned names, so it is restated as what matters: a
destination that is also a provider must expose **no write scope** in any capability. A future
destination that acquires one now fails, which a name check could never have caught.

---

## Repository parity

`HEAD` = `origin/main`. The deployment serving `www.hebuntech.com` runs the release commit on `main`.

---

## Next newly exposed product gap

The loop now reads: **organizational purpose + recorded knowledge + prior prepared content → next
content preparation**. The stage still missing is the one CGO-5 made possible and CGO-6 deliberately
refused to take: **real public platform observation as evidence for the next preparation**.

That is a genuinely larger capability, not a registry line. It needs a source class with a different
authority owner and a different provenance, a bounded live provider read inside a preparation, a
decision about quota, and — hardest — truth semantics strong enough that *high views* never reaches
a model as *good content*. It was not started.

CGO-7 has not been selected, scoped, or started.
