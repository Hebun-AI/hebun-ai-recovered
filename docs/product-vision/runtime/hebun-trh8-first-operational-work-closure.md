# TRH-8 — Turkish Rug House First Operational Work and Grounded Content Draft — CLOSED / PRODUCTION-ACCEPTED

**One Work item, one artifact, two revisions, four evidence declarations** · **ZERO schema** ·
**ZERO source change** · **Production migration ledger 47, unchanged** · **Production cluster**
`7675444875863894887` / `neondb` · **Predecessor** [TRH-7](hebun-trh7-first-durable-agent-identity-closure.md)
at `05194c5`

**This is the phase where Hebun stopped only understanding Turkish Rug House and started preparing
work for it.** Knowledge the organization authored became a Work item a human recorded, which became
a social-content draft its own agent wrote, which cites the exact Knowledge it stood on — and then
stopped, at the human review boundary, with nothing connected and nothing sent.

    CONTENT DRAFT != PUBLISHED SOCIAL POST

---

## The chain, end to end

    TRH authoritative Knowledge  (5 facts, 1 ratified)
      -> organizational Work      recordWork, human Governance authority
        -> Heby-authored draft    prepareWorkArtifact, one live model call
          -> evidence references  declareWorkEvidenceReference x4, Work Authority
            -> human review boundary
              -> STOP

Three released seams, three separate authorities, in that order. No fourth act exists.

---

## What was created

| | |
|---|---|
| Work item | `1cd01021-cc4d-429e-99a7-ff6b45cf1a18` |
| title | *Turkish Rug House ilk sosyal medya içerik taslağını hazırla* |
| `declared_state` | `planned` · no department · created by the Director, `created_by_type = human` |
| Artifact | `aa96978d-28ff-4bf8-a86f-23bd9b088dfb` |
| type / destination | `content-draft` / `instagram` |
| `artifact_lifecycle_status` | `draft` · `owner_workspace = operations` |
| `current_revision` | **2** |
| Revisions | **2**, both authored by `agent` `67f4460c…` — Turkish Rug House's own Heby |
| Evidence references | **4**, none withdrawn, no duplicates |

---

## Two revisions, and the first one was not accepted

**Revision 1 — HISTORICAL / INCOMPLETE / NOT ACCEPTED.**
`ffa53af0…`, 902 bytes, digest `30d7c48c…`, 300 output tokens. The Director rejected it for two
reasons, both real:

1. It **truncated** at the configured 300-token ceiling, ending mid-word at `#ElYap`. The Turkish
   hashtag list was cut off.
2. It carried **`#TurkishTextiles`**, a provenance implication Turkish Rug House Knowledge does not
   establish — the sourcing record says products come from wholesalers and names no country of
   manufacture.

**It was neither edited nor deleted.** Its bytes, digest, author and ordinal are untouched, and its
digest was recomputed at acceptance and matched: `sha256(content) = 30d7c48c… = content_digest`.
A rejected revision is evidence of what happened, not a mistake to erase.

**Revision 2 — CURRENT / COMPLETE / REVIEWABLE.**
710 bytes, digest `45b962ad…`, **248 output tokens — inside the ceiling, not truncated.** Both
language versions complete, four hashtags each.

> **Primary Version — English**
> Handcrafted Rugs, Kilims & Cushions
> Discover authentic handmade home textiles. Turkish Rug House brings you rugs, kilims, and
> cushions—each piece carefully crafted and selected for quality. Transform your space with
> textiles that carry tradition and artistry into your home.
> `#HomeDecor #HandmadeCrafts #InteriorStyle #TextileArt`
>
> **Alternative Version — Turkish**
> El Yapımı Halılar, Kilimler ve Minderler
> Özgün el yapımı ev tekstillerini keşfedin. Turkish Rug House halılar, kilimler ve minderler
> sunmaktadır—her parça kalite için dikkatle seçilmiş ve işlenmiştir. Evinize gelenek ve
> sanatçılığı taşıyan tekstilleri getirin.
> `#EvDekorasyonu #ElYapımıÜrünler #İçMimari #TekstilSanatı`

### The ceiling was not raised

`MODEL_OUTPUT_TOKEN_CEILING = 300` is a **released source constant**, not configuration. Three
guards make it unreachable from outside: the env variable returns **0** (misconfigured, model
unavailable) if it exceeds the constant; the request is clamped by `Math.min` — *"A caller may ask
for LESS than the deployment allows; it may never ask for more"*; and the live transport enforces
the same imported value before the wire.

Its own comment had already ruled on this case: *"If a real provider answer turns out not to fit…
inside 300 tokens, that is a MEASURED finding for the acceptance gate to report — not a reason to
pre-emptively widen the bound here."* The finding was reported, and **the Director kept the bound**.
The request was shortened to fit the spend boundary instead of widening the boundary to fit the
request. **Zero source, configuration, transport or deployment change was made.**

---

## Grounding — two tiers, kept apart

    RATIFIED FACT USED AS PUBLIC FACT  !=  PROVISIONAL CONTEXT USED FOR REASONING/TONE

| Fact | Node / v | Standing | Tier |
|---|---|---|---|
| `trh-product-offering` | `a1105902…` v1 | draft · provisional · **RATIFIED** | **RATIFIED FACT USED AS PUBLIC FACT** — the only sentence permitted as a direct public claim: handmade rugs, kilims, cushions |
| `trh-brand-positioning` | `acccc91e…` v1 | draft · provisional · unratified | **PROVISIONAL CONTEXT** — tone only |
| `trh-sales-markets` | `f3e12fe6…` v1 | draft · provisional · unratified | **PROVISIONAL CONTEXT** — language and audience only |

**Two of the three cited facts are unratified, and all five TRH facts remain `provisional`.** One
ratified fact among the grounding promotes nothing. The draft cites Knowledge; it does not inherit
its standing, and the artifact makes no authority claim at all.

**Deliberately excluded from grounding:** `trh-sourcing-sales-model` (wholesaler relationship and
margin — internal commercial information) and `trh-current-business-objectives` (the reason for the
work, not material for the post). The sourcing fact was never in the model's context, which is why
its absence from the output is structural rather than lucky.

### Evidence references

Four, declared through the **Work Authority** — never by the artifact writer — all by the Director
as `declared_by_type = human`, none withdrawn:

    knowledge-fact  2197217f…   trh-product-offering
    knowledge-fact  08b747d6…   trh-brand-positioning
    knowledge-fact  07f88607…   trh-sales-markets
    work-artifact   aa96978d…   the draft itself

**References name the ARTIFACT, not a revision** — *"a declaration about what work concerns must not
go stale when its subject is revised"* — so revision 2 required **no new declaration**, and none was
made. Four references before, four after.

Their own caveat holds and is not softened here: declaring a reference *"does not say the referent
is current, ratified, or authoritative."*

---

## Content audit — revision 2 against every approved restriction

| Restriction | Verdict |
|---|---|
| Public factual claim limited to the ratified product fact | **PASS** — rugs, kilims, cushions, handmade |
| `#TurkishTextiles` | **ABSENT** |
| `#MadeInTurkey` | **ABSENT** |
| `#TurkishMade` | **ABSENT** |
| Equivalent provenance/origin/culture implication in any hashtag | **NONE** — all eight name décor, craft, interiors or textile art; **not one names a country, origin or culture** |
| "koleksiyonluk" · "uygun fiyatlı" · "Amerika pazarı" · "Avrupa" · "Asya" as public claims | **ABSENT** — revision 2 does not even carry revision 1's "collection" |
| Internal commercial info (sourcing model, wholesaler, margin) | **ABSENT** — and structurally so: never in context |
| price · discount · campaign · stock · dimensions · shipping · delivery · testimonial · availability · URL · store policy | **ABSENT** |
| material composition | **ABSENT** — "home textiles" is a category, no fibre named |
| Claims Instagram is connected | **DOES NOT** |
| Both versions complete, hashtag lists unbroken | **PASS** — 248 tokens, no truncation |

**Two adjectives recorded for the reviewing human, not as violations.** "authentic" and "selected
for quality" are unsupported *quality* claims. Neither appears in the approved prohibition list —
which enumerated price, origin, material, availability and the rest — and neither asserts
provenance. They are exactly the sort of thing a human review boundary exists to catch, and this
record surfaces them rather than letting a clean table imply they were never noticed.

---

## Authorship is not authorization

    AGENT AUTHORSHIP  !=  HUMAN AUTHORIZATION

Both revisions carry `authored_by_actor_type = agent` and `authored_by_actor_id = 67f4460c…` —
**Turkish Rug House's own Heby**, established in TRH-7, distinct from Hebun AI's identically named
agent. The artifact row itself carries `created_by_type = human` (the Director), and all four
evidence declarations carry `declared_by_type = human`.

The agent wrote the bytes. The human authorized every act. The agent holds no credential, no
session, no permission, no mandate and no execution reach, and could not have reached any of these
authorities on its own. Authorship is a name in a column; it is not a right.

**The model call was real:** provider `claude`, model `claude-haiku-4-5-20251001`, transport `live`.
Revision 1: 5,338 in / 300 out. Revision 2: 5,928 in / 248 out. Two billable calls, to the model
provider and to nothing else.

---

## Non-effects, measured

    work_items 1 · work_artifacts 1 · revisions 2 · evidence refs 4 (0 withdrawn)

    agent_mandates             0        integrations               0
    integration_credentials    0        external_recipients        0
    heby_action_requests       0        action_permits             0
    action_execution_attempts  0

**Knowledge unchanged** — every fact's `updated_at` still at its authoring or ratification time;
`trh-product-offering` still `2026-09-05T10:36:51.165Z`, its TRH-4 ratification. **Governance
unchanged** — 2 decisions, 2 sessions. **Ratified nodes still 1.** **Hebun AI untouched** — 7
artifacts, audit 50.

**No provider was connected. No credential was created. No mandate was recorded. No permit was
minted. Nothing was published, sent or executed.** Google Drive is not connected and Higgsfield does
not exist in this repository at any level; neither was touched and neither is claimed.

`instagram` is a metadata label on a draft. No Instagram provider, adapter, credential or
publication path exists anywhere in the deployment.

---

## Audit — the ledger gap, again

TRH `audit_log` **9 → 14**, five rows, all `human` / the Director / `committed` / `simulation false`
/ source `organizational-work`:

    work.recorded            x1
    work.reference-declared  x4

**Artifact preparation wrote no audit row** — neither for revision 1 nor revision 2. This is the
same ledger gap TRH-7 recorded for agent genesis: the act is self-attributing on its own row
(`authored_by_actor_*`, `created_by`, `source_message_id`, a content digest and an immutable
revision ordinal), but it does not reach the audit ledger. **Recorded, not repaired, and not
fabricated after the fact.** It now has two occurrences in two different authorities and deserves
its own decision.

---

## Verification

Nine released suites, all passing:

    work1-organizational-work/work-firewall          wev1-work-evidence/evidence-postgres
    wev1-work-evidence/evidence-firewall             r3w-flow/boundaries-and-firewall
    agent-runtime-0/attribution-postgres             cgo3-agent-content-preparation
    cgo1-content-draft/content-draft-postgres        cgo1-content-draft/content-draft-truth
    ama1-agent-mandate/mandate-firewall

**Mandate not consulted, and not required.** Mandates are enforced on the action-request/origination
path; a search of the entire artifact-preparation feature for any mandate, integration, credential or
provider reference returns nothing. The selected workflow originates no action request. **No mandate
was created**, and the `/agents` surface offering the form is not a reason to fill it in.

---

## Limitations

1. **Artifact preparation is unaudited** — second occurrence of the ledger gap.
2. **Two unsupported quality adjectives** in revision 2, recorded above for the reviewing human.
3. **The 300-token ceiling shaped the deliverable.** The draft is deliberately compact because the
   spend bound was kept. A longer draft is a source change, not a configuration change.
4. **Revision 1 remains in the record as a rejected revision.** That is intended, not residue.
5. **This was executed through the operator acceptance-script seam**, the released pattern CGO-3,
   CGO-4 and CGO-6 used, calling the same writers the product actions call with a genuine
   `asHumanTenantContext` assembled from real membership and auth-identity rows, pinned to the TRH
   tenant. Two honest caveats: `sessionContextId` is a synthetic constant and `requestId` is the
   script label. **No SQL write was performed at any point.**
6. **Route-level rendered acceptance of `/operations` and `/director/work` remains unproven by
   test**, as it does for `/knowledge` and `/agents`.

---

## The ladder, exact

    UNDERSTAND THE COMPANY  ->  PREPARE WORK FOR THE COMPANY  ->  [human review]  ->  publish

    Turkish Rug House, TRH-8:
      Knowledge grounded          YES   — 3 facts cited, 2 of them unratified, standing preserved
      Work recorded               YES   — human Governance authority, declared not observed
      Draft prepared              YES   — agent-authored, 2 revisions, current is complete
      Evidence declared           YES   — 4 references, artifact-scoped
      Human review boundary       REACHED — and not crossed
      Published                   NO    — no provider, no permit, no path

    CONTENT DRAFT              != PUBLISHED SOCIAL POST
    RATIFIED FACT AS PUBLIC FACT != PROVISIONAL CONTEXT FOR TONE
    AGENT AUTHORSHIP           != HUMAN AUTHORIZATION
