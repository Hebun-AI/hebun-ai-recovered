# SCI-1 — Model Instruction-Channel Integrity

**Status: CLOSED / PRODUCTION-ACCEPTED (Director, 2026-10-06).**
Release `390be5381873b79b351993338794c0024b22237d` (`dpl_2BMnm6PupZ3c7UY4Kx4GJvVWibKY`, production),
fast-forward of `ea49e346`. Zero schema, zero migration (ledger 71). No EAI, platform-policy,
tenant-authorization, attestation or provider change. Architecture: SCI-0
([`hebun-sci0-secure-content-ingestion-trust-boundary.md`](hebun-sci0-secure-content-ingestion-trust-boundary.md)).

WF-3 = BLOCKED-BY-SCI · WF-4 = CLOSED / PRODUCTION-ACCEPTED · Agent #2 = STOPPED.

## The invariant

Model instruction authority belongs only to Hebun-minted control text.

    AUTHORIZED FOR DISCLOSURE != AUTHORIZED AS MODEL INSTRUCTION

## What was released

- `heby-runtime/instruction-channel.ts`: `hebunInstruction` mints Hebun-authored text,
  `joinHebunInstructions` combines only minted parts, `isHebunInstruction` is an identity check.
  No content inspection, regex, classifier or caller label. Minting is limited to three owners
  (Heby assistance, agent origination, the preparation brief), pinned by a census test.
- `generateHebyModelAnswer` — the one seam every live Anthropic egress passes — refuses, for a
  live-marked transport, any request whose `systemInstructions` is not exactly a minted value:
  `INSTRUCTION_CHANNEL_REFUSED`, before the EAI gate and before any fetch. Unmarked test transports
  send nothing and are not gated.
- The preparation brief returns `{ instruction, material }`. The revision being revised and any
  observation supplement are **material**: a new `ModelGenerationRequest.material` (TB-1 class
  `untrusted-content`) serialized after the grounding segment under `SUPPLIED_MATERIAL_PREFIX`, so
  grounding stays this organization's records (CGO-6/7). Declared EAI classes are unchanged
  (revision = work-artifact, observation = provider-observation); an observation-bearing preparation
  is still refused at EAI (no assistance × provider-observation platform cell).

## Three segments, one provider field

The Claude transport serializes the Hebun instruction segment, the grounding/data segment and the
supplied-material segment into Anthropic's single `system` field. Only the first carries Hebun's
instruction authority. The separation is Hebun-controlled delimiters within one inference request.
**Delimiters do not prove prompt-injection immunity**, and the provider enforces none of it.

## Evidence

**Tests (L1 + L2):** `tests/sci1-instruction-channel/channel-integrity.ts` through the real
generator and a real live-marked transport with counted fetch — minted instructions pass; user,
Knowledge, provider-observation and prior-revision text, and the pre-SCI-1 "instruction + data"
shape, refuse before the gate with 0 fetch; revision text arrives only in the material segment;
census and wiring pinned. Bite-proofs 6/6. L2: 147 tests importing the touched modules vs
`6be070cf` — the same 22 baseline failures, 22/22 first error identical; pins that encoded the old
brief shape or unminted live-transport instructions updated by name. tsc clean.

**Production (one Director-authorized call, no retry):** Director sent one `/heby` message.
Before → after: audit_log 212 → 213 (+1 `external-ai.disclosure.authorized`, `cf901abb`,
11:01:13.512Z, purpose assistance, declared = authorized = [conversation], platform allowed,
attestation active, model `claude-haiku-4-5-20251001`); conversations 57 → 58; messages 126 → 128
(user + assistant, 11:01:16.268Z). Assistant row: transport `live`, provider request
`msg_011CfksMEv56Ar3QK4bBFyGd`, 716 input / 128 output tokens, origin `deterministic` — the model
output was withheld by the Heby response validator. Unchanged: ledger 71, origination invocations
13, action requests 16, permits 9, work items 6, execution attempts 4, decisions 59, knowledge
nodes 8, work artifacts 11, tenant AI authorizations 2.

Reading, kept apart: the instruction channel ACCEPTED the minted instruction in the production
bundle (the disclosure decision is reached only after that check) · EAI AUTHORIZED the declared
class · exactly one provider request EXECUTED and SUCCEEDED · the model output was NOT ACCEPTED by
the validator (unrelated to SCI-1). The decision record precedes the provider result (APF-5 order).

## What SCI-1 does not prove

Prompt-injection prevention; material-path behavior in production (not exercised); Knowledge
provenance safety; version-level integrity; WF-3 readiness.

## Remaining SCI prerequisites (WF-3 contract, SCI-0 §16)

1. ~~Instruction-channel integrity~~ — released (this phase).
2. Provenance-derived admissibility (incomplete provenance, e.g. Drive without its reference, fails closed).
3. Version-level integrity binding (no per-version digest exists today).
