# CONTENT-INTEGRITY GS-2 — benchmark movements and pre-release corrections

Status: pre-release. Not pushed, not deployed. Implementation `36e15898`; corrections in the commit that adds
this document. Director gate 2026-10-11.

## Why GS-2 exists

A production revision turned Knowledge saying most of the range is handmade into "Handmade rugs, kilims and
cushions" and added "a carefully selected collection". GS-2 extends the deterministic claim check
(`claim-support.ts`, sha `284e92db…`) with `quality-process`, `qualifier-dropped`, negation for attribute terms,
and handmade / hand-knotted / hand-woven named in either language. The review control opens the evidence and the
check when a reviewer starts to decide. Decisions, their contract and Governance are unchanged.

## Every status movement, baseline `2c6a4129` → candidate

Measured by running both evaluators over all five frozen sets. No gold label changed in any set; the case
modules are byte-identical to baseline. `falseSupported` is 0 on every set, before and after.

| Set | n | Case | Gold | Baseline | Candidate | Direction |
|---|---|---|---|---|---|---|
| GS-0 synthetic | 42 | `s-xlang-handmade` | supported | insufficient (production-method) | undetermined | toward gold |
| GS-1.1 realistic | 106 | `ret-xlang` | supported | insufficient (production-method) | undetermined | toward gold |
| GS-1.2 held-out | 92 | `k-hand-picked` | insufficient | undetermined | insufficient (quality-process) | toward gold |
| GS-3 semantic bench | 240 | the three above (union of GS-0 / GS-1.1 / held-out) | — | — | — | as above |
| GS-4 human-labelled | 60 | `GS4-013` | A (supported) | undetermined | insufficient (quality-process) | **away from the recorded label — human-label review required** |

Signal-only changes (status unchanged, already insufficient): `ret-goal` + qualifier-dropped, `ret-bounded-none`
+ quality-process ("certificate"), `k-organic` + quality-process ("certified" vs "sertifikalıdır": a
cross-language miss on a supported case; its status was already insufficient).

Aggregate effects: GS-0 over-blocked 3 → 2, undetermined +1. GS-1.1 FI 6 → 5, undetermined 28 → 29.
Held-out detected 29 → 30, undetermined 36 → 35. GS-4 deterministic A: falseInsufficient 7 → 8, abstained 7 → 6,
retained 5 unchanged; H1 A unchanged (the semantic run already said insufficient on GS4-013).

The `36e15898` commit message said "both frozen benchmarks moved by one case each". That was incomplete: four of
five sets moved (GS-0 and GS-4 unreported), because the GS-0 test pins floors (`>=`) and the GS-4 test pinned only
deterministic FS and A.retained. Each movement is now pinned by case id. No threshold was lowered.

## GS4-013 — human-label review required

- Claim: "Lingomark's translators are certified native speakers."
- Record: "Lingomark's translators are native speakers."
- Director label: A (supported). Not changed.
- GS-2: insufficient, signal `quality-process` — "certified" is stated by no record. The GS-4 semantic run also
  returned insufficient.

Director decision (2026-10-11): keep the GS-2 assessment; "certified native speakers" is not supported merely by
"native speakers". Keep the human label; record the disagreement. Measured against the recorded label this is one
additional false-insufficient. It is not counted as an improvement. Until the label is reviewed, any GS-4 metric
that includes GS4-013 carries this note.

## Pre-release corrections

- ESLint `react-hooks/set-state-in-effect` in `revision-generation-evidence.tsx` fixed without suppression: the
  open state is adjusted during render from the previous `openWhenDeciding` value; the effect only performs the
  evidence read when the panel is open and nothing has been read. No missing-dependency warning remains.
- The panel starts open if it mounts while deciding.
- The manual-inspection line now appears beside every verdict that is not `supported`, including `unavailable`
  (the original claim; the code covered only insufficient and undetermined).
- The evidence body is exported as `EvidenceRecord` so the closed states can be rendered in isolation.

## UI acceptance

Browser acceptance was not run. The local database (`hebun_r1`) records 53 migrations against 76 in the code, and
it holds no tenant, Governance authority or generated revision with evidence that this flow needs. Running it
would require local migrations and synthetic tenant/Governance data, both excluded by the Director.

The repository's existing UI harness is server rendering without a DOM.
`tests/content-integrity-gs2/review-surface-render.ts` uses it to prove: the panel renders open while deciding and
closed otherwise; insufficient, unavailable-check, unavailable-evidence and supported states render as themselves,
with manual inspection beside every non-supported verdict. The click path (Accept / Request changes only set the
intent; "Record …" is the only submit and requires a 24-character reason) is pinned from source, not dispatched.
