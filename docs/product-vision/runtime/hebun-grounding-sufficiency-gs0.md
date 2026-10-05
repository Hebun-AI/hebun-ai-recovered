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
