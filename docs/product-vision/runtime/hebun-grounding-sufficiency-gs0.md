# Grounding Sufficiency — GS-0 (discovery, contract, deterministic benchmark)

Status: BENCHMARK-ONLY. Nothing here is runtime-connected. No schema, no provider call, no
External AI Data-Use change, no readiness or review authority change.

## Definition

**Grounding sufficiency** answers one question: *do the Knowledge records that were supplied to a
generation state what one sentence of the generated revision states?* It is an evaluation, not an
authority. It does not decide truth (Knowledge), ratification or public use (Governance),
eligibility (Phase 5), candidate selection (relevance / bounded-universe), revisions (Work Artifact)
or readiness (Content Package, derived).

How the evidence was chosen — `matched`, `bounded-universe`, `no-match` — is candidate provenance
("why was this supplied?") and is never an input to support. Ratified, allowed and relevant are each
necessary for public grounding and none is sufficient.

## Existing contract reused

`src/features/knowledge-retrieval/grounding.ts` (RELEVANCE-2A) already owns the task-level outcome
(`not-required | unavailable | insufficient | relevant-unverified | sufficient`) and declares that
`sufficient` requires a support verdict from a `deterministic` or `human` verifier — never a model.
No verifier existed. GS-0 adds the first deterministic one, claim-level, in
`knowledge-retrieval/claim-support.ts`, whose `supported` verdict is shape-compatible with that port.
`enterprise-memory-reasoning` implication types are memory-to-memory reasoning, not text-claim
support; not reused.

## Claim-level vocabulary (`assessClaimSupport`)

| status | produced when |
|---|---|
| `supported` | every sentence of the claim is, after normalization, a whole sentence of ONE supplied record |
| `insufficient` | nothing supplied, or the claim states a number, name, superlative, universal, production method, cause or current state that no supplied record states |
| `contradicted` | contract only — a human or a future semantic evaluator; never produced deterministically |
| `undetermined` | everything else (paraphrase, translation, narrowing, joint support, most contradictions) |
| `unavailable` | the evidence record could not be read |

## Measured (synthetic, hand-labelled, 42 cases)

Corpus: `scripts/grounding-benchmark/benchmark.ts` over the RELEVANCE-0 synthetic "Zanzibar
Textiles" facts, public-eligible versions only. Includes q22 / q23 unchanged.

| metric | value |
|---|---|
| false-supported (the dangerous error) | **0 / 42** |
| unsupported-claim detection recall | 23 / 31 (74%) |
| supported retention | 4 / 10 (40%) — exact sentences only |
| supported over-blocked | 3 / 10 (30%) — cross-language names / "el dokuması" vs "handwoven" |
| undetermined (abstention) | 11 / 42 (26%) |
| contradiction labelled as such | 0 / 5 (3 caught as insufficient, 2 undetermined, 0 supported) |
| q22 / q23 | never supported; 3 of 4 claims flagged insufficient, 1 undetermined |

What determinism cannot see: aspiration escalated to fact ("hedefler" → "is"), a standard-size fact
read as "any size", eligible-but-irrelevant evidence, contradictions without a number or a name, and
all positive paraphrase / cross-language / joint support.

## Decision: C

Deterministic signals are a useful partial guardrail (they never claim support and catch three
quarters of unsupported claims) but a quarter of claims stay undetermined, contradiction is not
decidable, and the over-blocking is concentrated exactly in cross-language content. Semantic
evaluation is still needed for the undetermined remainder.

## Semantic evaluator — gated, not started

A model judge would need a NEW External AI purpose. It is not `assistance` (that answers the
operator) and not `relevance-selection` (that ranks candidates). Minimum proposal for Director
review, nothing implemented:

- purpose `grounding-evaluation`; platform cell `anthropic/messages × grounding-evaluation ×
  {knowledge, work-artifact}`; tenant scope granted per tenant by ceremony (TRH remains unauthorized
  until Director decides).
- leaves Hebun: the revision's copy and the statements of the records recorded as supplied to that
  revision's generation (already public-eligible). No conversation, people, organization or ids.
- advisory and downgrade-only: a model verdict may move `undetermined` to `insufficient` or
  `contradicted`, never to `supported` (RELEVANCE-2A doctrine: a model is not a verifier).
- failure (refusal, budget, invalid output) → `undetermined`, never `supported`.
- structured output is required. The live transport still refuses `structuredOutput`
  ("pending provider acceptance"); free-form prose will not be parsed into a verdict. Blocker.

## Placement and persistence

- Before generation (existing `grounding.ts`): request-level only. It cannot see what the model
  then writes, so it does not solve generated-claim grounding.
- After generation, over the persisted revision copy + the generation evidence KT-2 already records:
  sentence-level analysis, transient; revision outcome = `insufficient` if any sentence is,
  `supported` only if every sentence is, otherwise `undetermined`. Deterministic, so it can be
  DERIVED at read time like readiness — no schema, no claim-level persistence.
- Surfacing it to the human copy reviewer is a UI addition. Making it a Content Package blocker
  (e.g. `copy-grounding-insufficient`) is a readiness-policy change → Director gate.
- A model verdict is not re-derivable, so persisting one would need schema → Director gate.

## Next phase (proposed, not started)

GS-1: derive the deterministic revision-level outcome at read time and show it beside the existing
"evidence supplied to generation" panel, advisory only; Director decides separately whether it
becomes a readiness blocker. The semantic evaluator waits on structured output + a
`grounding-evaluation` authorization decision.

## GS-1 (advisory, connected read-only)

The reviewer's revision-evidence read derives the revision outcome on every read from the stored
copy and the evidence stored with the generating message. No readiness, review or Governance change.

## GS-1.1 — realistic business-content benchmark

`scripts/grounding-benchmark/realistic-cases.ts`: 106 hand-labelled synthetic cases, five fictional
organizations (SaaS, manufacturing, professional services, retail, B2B logistics). The case module
imports nothing, so gold cannot follow the evaluator. Each case names the capability a correct
verdict needs (A paraphrase, B cross-language, C multi-fact, D contradiction, E temporal, F goal vs
current fact, G morphology, H unsupported escalation). Production revisions are NOT cases: their
true labels were never established by a person.

### Pass 1 — runtime evaluator unchanged

| metric | value |
|---|---|
| FALSE SUPPORTED (unsupported/unreadable → supported) | **0 / 59** |
| FALSE INSUFFICIENT (supported → warned) | 7 / 47 (14.9%) |
| supported retention | 16 / 47 (34.0%) |
| unsupported detection | 47 / 57 (82.5%) |
| undetermined | 34 / 106 (32.1%) |
| contradictions | 12 / 13 caught as insufficient, 0 labelled contradicted |
| cross-language | 5 / 12 correct, 3 false-insufficient |

Not correct, by need: A 19 · B 6 · C 5 · F 4 · H 5 · D 1 · E 1. False-insufficient causes: hyphenated
compound read as a name (1), weekday names read as names (1), distributive "each month" read as a
universal (1), cross-language names/terms (3), temporal arithmetic (1).

### Pass 2 — experiment only, NOT in runtime (needs Director approval)

Four general rules, each meaningful for any sector: split hyphenated words before the name check;
calendar words are not names; scope quantifiers `unlimited / limitless / worldwide / sınırsız /
dünya çapında` are universals; restating an aspiration sentence's content ("aims / plans / wants
to", "hedefler", …) without the aspiration is a new signal `goal-as-fact`.

| metric | pass 1 | pass 2 |
|---|---|---|
| false supported | 0 | 0 |
| false insufficient | 7 | 5 |
| unsupported detection | 47 | 54 |
| undetermined | 34 | 29 |
| supported retention | 16 | 16 |
| GS-0 synthetic: false supported / detected | 0 / 23 | 0 / 24 |

Risk: the rules were chosen after seeing these failures; there is no held-out set. They can only add
`insufficient` or remove a name signal, so they cannot create a false `supported`. Adding
`goal-as-fact` extends the signal vocabulary.

### Decision B, with the semantic gap measured

Deterministic rules still improve the unsupported side. The supported side cannot move: 30 of 31
missed supported claims need paraphrase (A), translation (B) or joint support (C). A semantic
evaluator would need the revision sentence plus the supplied record statements, paraphrase and
cross-language equivalence, multi-record support and contradiction; temporal reasoning rarely (1
case). Nothing else (conversation, other Knowledge, identities) was needed by any case.

## GS-1.2 — held-out validation of the Pass-2 rules

`scripts/grounding-benchmark/heldout-cases.ts`: 92 new synthetic cases, six fictional organizations in
six sectors none of the earlier sets used (dental clinic, hotel, language school, olive estate,
rooftop solar, Turkish furniture maker). 52 supported · 29 insufficient · 9 contradicted · 2
unavailable; 10 cross-language; every candidate rule has should-fire and must-not-fire cases.

Independence: the module imports nothing; labels were written from meaning only, and the file was
frozen (sha `74ffebdd…`, 2026-10-05T10:46:51Z) before any evaluator ran on it. No record or claim
equals, or shares a 5-word run with, any GS-0 / GS-1.1 string; no organization name is shared. The
test pins all of this. Labels: manually curated by Claude before any evaluator ran, frozen before
evaluation, structurally independent from evaluator output, NOT independently human-validated; no
provider call; the author knew the four rules while writing. The Director accepted this limitation for
this phase only because grounding is read-only advisory with no readiness, publication, Governance or
execution authority. It is not evidence sufficient for any future blocking authority.

### Blind comparison (no tuning)

| metric (92 cases) | A runtime GS-1 | B four rules |
|---|---|---|
| false supported | 0 | 0 |
| false insufficient | 16 / 52 | 16 / 52 |
| supported retention | 9 / 52 | 9 / 52 |
| unsupported detection | 24 / 38 | 28 / 38 |
| undetermined | 41 | 37 |
| contradictions caught | 7 / 9 | 7 / 9 |
| cross-language correct | 1 / 10 | 1 / 10 |
| multi-fact supported retained | 0 / 4 | 0 / 4 |

Per rule, alone over A (held-out FI / detected): hyphen −2 / −2 (the lost detections were accidental
"Xray"-style name hits); calendar 0 / −1 (no benefit; hid a real contradiction, a December stay at a
hotel open April–October); scope +1 / +3; aim-as-fact +1 / +4. The gains are across all six sectors.
The per-rule split uses the held-out set for selection, so it is not itself a held-out estimate.

### Decision

Safety gate holds (0 false supported). Director decision: release the three independently supported
rules — hyphen split, scope escalation, an aim restated as fact — in the existing evaluator. The
calendar rule is REJECTED (no measured benefit; it hid a real contradiction) and is NOT in runtime. No
fourth or fifth rule; no further tuning against this held-out set.

The hyphen rule is a trade-off, not an unconditional accuracy gain: it removes two false warnings and
also removes two detections that had fired for the wrong reason (a hyphenated word read as a name). The aim-as-fact hit is reported under the existing `current-state`
signal, so the verdict and signal vocabulary are unchanged. Runtime on the held-out set: FS 0 · FI
16 · retained 9 · detected 29 / 38 · undetermined 36; on GS-1.1: 0 · 6 · 16 · 54 / 57 · 28.

Still advisory, read-only, no persistence, no provider, no semantic model. The remaining gap is the
supported side: on the held-out set 43 of 52 supported claims are not retained (16 of them falsely
warned). None is a verbatim record sentence — each is reworded, translated or joined across records —
so sentence identity cannot reach them; that is the semantic gap.

## GS-3 — semantic grounding, synthetic benchmark experiment (EXPERIMENT INFRASTRUCTURE ONLY)

`scripts/grounding-semantic/`: frozen contract (`contract.ts`), case adapter over GS-0 / GS-1.1 /
GS-1.2 plus 11 Stage-A fixtures (`cases.ts`), a fail-closed synthetic-only guard (a body is sent only
if byte-identical to the frozen request over one registered synthetic case), a runner and an offline
scorer. Test `tests/grounding-semantic-gs3/contract.ts` (no network). Nothing in `src/` imports it;
the runtime, the transport, the vocabulary, External AI policy and every authority are unchanged.

Mechanism (verified against current Anthropic docs, 2026-10-05): Messages API structured outputs,
`output_config.format = {type: "json_schema", schema}`, GA, constrained decoding, no beta header.
Model `claude-opus-5-5` (adaptive thinking always on, default effort), $4 / $20 per MTok. One
instruction (system); the claim and the evidence travel as ONE JSON data document with opaque labels
E1…En. Output `{relation: entailed|contradicted|not-stated|unclear, citations: [{label, quote}]}`,
re-validated server-side: closed keys, known relation, known label, quote verbatim in the cited
excerpt. `entailed` is a SHADOW label; nothing maps it to `supported`. Unreadable or empty evidence is
never sent.

Contract frozen (sha recorded) before the first call; unchanged across all runs. One post-run,
type-only edit to the validator (narrowing for `tsc`); all 701 recorded answers re-validate identically.

Stage A (11 fixtures, incl. three instruction-injection excerpts): 11/11 expected relations, 0
malformed, all quotes verbatim; injected text stayed evidence. Stage B + C: 230 sendable cases × 3 runs.

| all 240 cases (3 runs agree unless noted) | deterministic | semantic shadow | H1 proposed | H2 upgrade U | H3 upgrade U+I |
|---|---|---|---|---|---|
| false supported | 0 | **0** | 0 | 0 | 0 |
| false insufficient | 25 | 4–5 | 27 | 27 | 4–5 |
| supported retained | 29/109 | 104–105/109 | 29/109 | 82/109 | 104–105/109 |
| unsupported detected | 107/126 | 126/126 | 126/126 | 126/126 | 126/126 |
| contradictions labelled | 0/27 | 24/27 | 24/27 | 24/27 | 24/27 |
| undetermined | 74 | 0 | 53 | 0 | 0 |

H1 = GS-2 proposal (model may only add contradiction or turn an abstention into insufficient). H2/H3
upgrade to `supported` and are MEASURED ONLY. Semantic shadow by family (run 1): paraphrase 35/37
retained vs 0/37 deterministic; cross-language supported 19/19 vs 1/19; multi-record 10/10 vs 0/10; temporal
represented by 2 cases, both correct. Semantic false insufficient (run 1): two held-out claims name
the organization where the record does not (h-checkups, o-sauna), "operates in" read narrower than
"installs panels across" (v-valencia), and "ready to help" added to a headcount (ps-team); runs 2–3
add one universal reading (e-native). Several are arguably label-quality issues; labels were NOT
changed after scoring.

Reliability: 0 provider errors, 0 malformed, 0 invalid labels, 0 unverifiable quotes, 0 case
deviations in 701 calls. Stability: 4/230 cases changed shadow label across runs; none to a false
`supported`. Latency median ~2.4–2.7 s, p95 ~5–6.5 s. Tokens per benchmark run ~183k in / ~14.7k out
(~$1.0); total GS-3 spend ≈ $3.1.

Limits: every label is synthetic and Claude-family authored or curated (GS-1.2: CLAUDE-CURATED ·
FROZEN BEFORE EVALUATION · NOT HUMAN-VALIDATED), and the evaluator is a Claude model — agreement can be
inflated by shared bias, and the sets may be easier than real copy. No adversarial benchmark beyond
the three Stage-A fixtures. One model, default effort. Decision: promising; a human-validated,
independently authored benchmark (including production-like copy labelled by a person who has not
seen model output) is required before any semantic result can carry upgrade or blocking authority.

## GS-4 — human-labelled, Director-validated benchmark · **CLOSED**

`scripts/grounding-semantic/gs4-gold-v1.json` (sha `68856f19…`, case bytes `a3a2a09f…`): 60 synthetic
cases over six fictional businesses, constructed by Claude, labelled by the Director blind to every
evaluator output, to GS-3 results and to Claude's design tags. Labels A supported 19 · B not supported
7 · C contradicted 10 · D cannot determine 24. Batch 1 was shown in the original English; batches 2–6
as Turkish translations, stored per case in the gold. Provenance: **HUMAN-LABELLED · DIRECTOR-VALIDATED
· SEMANTIC OUTPUT NOT SEEN BEFORE LABEL FREEZE.** Single annotator.

Scoring rule v1 (`gs4-evidence/gs4-scoring-rule-v1.txt`, sha `87c092a9…`) was frozen before the run:
false-supported counts over B + C + D, and a semantic `entailed` on a D case is false-supported.
Exactly ONE semantic run (`gs4-evidence/gs4-run1.jsonl`): `claude-opus-5-5`, the GS-3 contract
unchanged, 57 cases with evidence, 0 provider errors, 0 malformed, 0 invalid labels, 0 unverifiable
quotes, ≈ $0.29.

| | deterministic | semantic | H1 | H2 | H3 |
|---|---|---|---|---|---|
| false supported (B + C + D) | 0 | **9** | **0** | **6** | **9** |
| A supported (of 19) | 5 | 14 | 5 | 10 | 14 |
| A warned | 7 | 5 | 9 | 9 | 5 |
| B warned (of 7) | 4 | 7 | 7 | 7 | 7 |
| C recognised as contradiction (of 10) | 0 | 5 | 5 | 5 | 5 |
| D supported / warned / undetermined (of 24) | 0/14/10 | 6/18/0 | 0/20/4 | 4/20/0 | 6/18/0 |

Semantic false supported: D — GS4-003, 011, 018, 022, 053, 060; C — GS4-023, 027, 030. The model reads
support more generously than the Director. The GS-3 synthetic result did not survive independent
human labels. Limits: one annotator; the Director judged translated text for batches 2–6 while the
model saw the original bytes.

**Decision (Director, GS-4 CLOSED):** human benchmark COMPLETE · semantic evaluation EXECUTED exactly
once · semantic support upgrade **REJECTED** · H2 **REJECTED** · H3 **REJECTED** · H1 zero
wrongly-supported on this benchmark, but its value is advisory and downward-only · semantic runtime
integration **NOT JUSTIFIED / NOT CONNECTED** · deterministic grounding unchanged and advisory ·
production readiness **NOT CLAIMED**.
