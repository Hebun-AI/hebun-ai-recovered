# HEBY-PROMPT-INJECTION-BOUNDARY-1 — the data in a model request has an end the data cannot forge — Closure

Base `fffb213b` (`origin/main`, production `dpl_HtJDpKYgs8HN6M6uYhNAawRXZjMc`). Worktree
`.claude/worktrees/heby-prompt-injection-boundary-1`, branch `fix/heby-prompt-injection-boundary-1`. Local
commit only; not pushed, not deployed.

Paths are relative to `apps/dashboard/src/`.

## What was already there, and kept

- **Instruction authority (SCI-1).** `systemInstructions` must be a value `hebunInstruction` minted from
  repository text; the generator refuses anything else before EAI is asked (`INSTRUCTION_CHANNEL_REFUSED`).
  Knowledge, provider text and model output never reach that field.
- **Classification (TB-1).** `MODEL_REQUEST_TRUST` types every request field; evidence and material are
  `untrusted-content`; ratified Knowledge is evidence, never instruction.
- **Egress (EAI-B2, APF-5, AP-3).** Director control, model availability, instruction channel, the
  three-authority disclosure decision with attested model ids, audit evidence and the dispatch cap — all
  before the client exists. Unchanged.
- **Output authority.** Model text is advisory; the response validator withholds an answer it rejects, and
  no authorization, decision, permit or execution path reads model output. No tools are sent to the provider.
- **WF-3C** already JSON-quotes Knowledge statements on origination candidate lines.

## The gap

`heby-model/claude-model-client.ts` `translate()` is the one place every model path (Heby answer, AI plan,
origination) turns the typed request into the provider's single `system` string. There the boundary was a
prefix that OPENED a section and nothing that closed it: grounding ran to the end of `system`, records were
joined by bare newlines, material followed under another typed prefix. A Knowledge statement containing
`\n[2] …`, `\nSupplied material (…):`, `\nGrounding context (…):` or `\nSYSTEM: …` produced lines the model
could not tell from Hebun's own — and the last of them sat at the tail of the system prompt.

## What changed

| Piece | Change |
|---|---|
| `heby-runtime/trust-boundary.ts` | `UNTRUSTED_FENCE_NOTE`, `untrustedFence(section, id)`, `oneLineGroundingRecord(line)`; two new `MODEL_CONTEXT_BOUNDARY` facts; the truthful claim names the fence |
| `heby-model/claude-model-client.ts` | each untrusted section between a fence line pair carrying a 128-bit id minted per request (32 hex, not UUID-shaped); a grounding record that spans lines travels as one JSON string; fence id inside the content → `boundary-unavailable`, nothing sent |
| `heby-model/model-error.ts` | `boundary-unavailable` (not retryable) |
| `tests/heby-prompt-injection-boundary-1/` (new) | `boundary-structure` (A, D, H, I, J), `adversarial-postgres` (A–I against the real answer flow) |
| `tests/tb1-trust-boundary/bite-proofs.ts` | T2 and T10 find-strings follow the new assembly (same mutations, same expectations) |
| `tests/trh20-governed-growth-proposal/growth-origination-postgres.ts` | the multi-line observation supplement is now one JSON grounding line; matched in that encoding, and each fence sentence must be FOUND before the first number (the old `indexOf < n` would pass on -1) |

Single-line grounding — every released caller's normal shape, the AI plan's JSON projection included — is
byte-identical inside the fence. Material keeps its lines. An evidence-free request is unchanged. No
instruction text, prompt, provider, scope, permission, Knowledge or Governance policy, table or migration
changed; nothing filters or rewrites content.

## Guarantees, by kind

- **STRUCTURALLY ENFORCED.** Record text cannot reach Hebun's instruction part or a message turn; it cannot
  open, close or forge a section or another record's number; a request whose data extent cannot be stated
  is not sent. Unchanged and still enforced: SCI-1, EAI, tenant scoping, output containment.
- **TESTED WITH SYNTHETIC FIXTURES.** System, developer, Governance and Director spoofs; delimiter, guessed
  fence and marker spoofs; a cross-tenant request; a tool/egress demand; a simulated model answer claiming
  approval, authorization and execution — through `/heby` (ratified only) and the Knowledge workspace
  (unratified, labelled). Result: fenced data only; Globex disclosed nowhere; no decision, approval,
  command audit or Knowledge row; every new `audit_log` row an EAI disclosure decision; the compromised
  answer withheld by the released validator, a normal one still served; no egress without authorization.
- **REAL-PROVIDER VERIFIED.** Nothing. No real model saw the fence or the attacks.
- **NOT VERIFIED.** Whether a real model honours the fence; whether JSON-encoded multi-line grounding
  changes a real model's reading of it (the RUNG 2 growth supplement is such a line).

## Verification (V3)

V3: the change sits in the single transport seam every provider call crosses (provider/execution boundary).
The full suite was run because the focused selection was made by grep, and a suite asserting on the wire
in words the grep did not name would be missed.

| Item | Result |
|---|---|
| Baseline at `fffb213b`, focused set (57 files: tb1, sci1, r2 model generation, h1, every EAI/APF/WF-3/AI-plan/grounded-conversation suite, CGO-4/6/7/9, TRH-20, relevance-2a transport, knowledge-evidence-standing, evidence-decision-brief) | 57 PASS |
| Candidate, same set + 2 new | 59 PASS; first run 3 FAIL: two pins moved in this commit (tb1 T2/T10 find-strings, TRH-20 encoding) and the AI-plan "no identifier crossed" check was right, so the fence id became 32-hex instead of a UUID (code, not pin) |
| Full suite, candidate in the disposable tree | 1052 PASS / 1 FAIL — `r3w-flow/ambient-database-safety` BLOCKED (canonical `hebun_r1` at 127.0.0.1:55432 unreachable; the test says it did not run); 0 REGRESSION |
| Bite-proofs: one-line encoding removed, fence-id check removed, grounding closing fence removed | `boundary-structure` FAILS each time |
| Bite-proof: client restored to `fffb213b` | `adversarial-postgres` FAILS ("the request carries a grounding fence") |
| `tsc --noEmit -p .`, `eslint` on changed files, `npm run build` | exit 0 each |

The no-tools assertion (G) was added to `adversarial-postgres` after the full run and passed on its own.

## Three questions

1. **What did we learn?** A boundary marker the content can type is not a boundary; what makes a data
   section's end trustworthy is an id minted after the content was written, plus one record per line.
2. **How does this improve Turkish Rug House?** Its policies and drafts can reach a model without a line in
   them posing as Hebun, Governance or the Director to the model — before any analytical feature widens use.
3. **How does this become part of Hebun AI?** As the transport's rule for every untrusted section, so any
   new model path (AI-assisted `/brief` included) inherits it without writing its own framing.

## Closure Contract (v1)

- Phase: HEBY-PROMPT-INJECTION-BOUNDARY-1
- Owner: Heby model transport (`heby-model/claude-model-client.ts`) under the TB-1 trust-boundary vocabulary (`heby-runtime/trust-boundary.ts`)
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V3 — single transport seam crossed by every provider call
- Verification evidence: baseline at fffb213b, focused 57 files: 57 PASS; candidate (patch in disposable detached worktree) focused 59 files incl. the 2 new: 59 PASS after 2 pin files moved in this commit with reasons and the fence id made non-UUID for the AI-plan identifier check; full suite on the candidate: 1052 PASS / 1 FAIL, the FAIL being r3w-flow/ambient-database-safety BLOCKED (hebun_r1 at 127.0.0.1:55432 ECONNREFUSED, environment, not run); 0 REGRESSION, 0 PRE-EXISTING, 1 BLOCKED; bite-proofs: removing the one-line encoding, the fence-id check or the grounding closing fence makes boundary-structure FAIL, restoring the baseline client makes adversarial-postgres FAIL; tsc --noEmit -p . exit 0; eslint on changed files exit 0; npm run build exit 0; no real provider
- Test environment: worktree `.claude/worktrees/heby-prompt-injection-boundary-1` (tsc, eslint, build, new tests); disposable detached worktree `.claude/worktrees/hpib1-baseline-fffb213b` at `fffb213b` for the baseline and, with this change applied as a patch, for the candidate, the bite-proofs and the full suite; `node --import tsx` per file; PostgreSQL 18 on 127.0.0.1:55433 via `HEBUN_TEST_ADMIN_DATABASE_URL`, harness-created databases; no `DATABASE_URL`, no model key, no network (fetch injected)
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not released or deployed
- Deferred risks: HPIB1-REAL-PROVIDER-UNVERIFIED-1 (DEFERRED); HPIB1-SINGLE-SYSTEM-STRING-1 (DEFERRED); HPIB1-RELEVANCE-JUDGE-UNFENCED-1 (DEFERRED); HPIB1-REFUSAL-AFTER-ADMISSION-1 (DEFERRED)
- Director approvals: HEBY-PROMPT-INJECTION-BOUNDARY-1 narrow security implementation, synthetic fixtures only, local commit, no push, no deployment (Director, 2026-10-19)

## Deferred risks

- **HPIB1-REAL-PROVIDER-UNVERIFIED-1 (DEFERRED)** — the fence and the one-line encoding are proven on the
  wire, not in a model. Closes with a Director-authorized real-provider adversarial run over synthetic
  records, including one multi-line grounding entry (the RUNG 2 supplement shape).
- **HPIB1-SINGLE-SYSTEM-STRING-1 (DEFERRED)** — instruction and data still share one `system` string;
  `structurallyIsolatedInInferenceRequest` stays false and the separation still rests partly on model
  compliance. Closes with a provider-enforced channel or a Director decision accepting the limit.
- **HPIB1-RELEVANCE-JUDGE-UNFENCED-1 (DEFERRED)** — `relevance-judge/model-relevance-judge.ts` builds its own
  transport request and is not fenced; it is reachable only from tests today. Closes when it is wired
  through the client or fenced the same way, before any runtime caller.
- **HPIB1-REFUSAL-AFTER-ADMISSION-1 (DEFERRED)** — `boundary-unavailable` is decided inside the client, after
  the EAI decision is recorded and the dispatch cap charged; nothing is sent. A collision needs the content
  to contain a fresh 128-bit id. Closes if the check moves before admission.
