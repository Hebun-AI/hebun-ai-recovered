# CGO-4 — Review-Ready Content Preparation — CLOSED / PRODUCTION-ACCEPTED

**Release** `c688f75fc274e8f2b2e487833b2171dfd747c98f` · **ZERO schema** · **Production ledger 47, unchanged** · **Deployment** `dpl_5oaRg8nB6p8MGVzmugKyQCXnmwAU`

---

## What Hebun can now do that it could not

CGO-3's first agent-authored content draft stored the model's whole reply: a sentence about what it
was about to do, the caption, and a paragraph explaining the caption. Truthful — every byte was the
model's — and not a caption a human could review as a caption.

    CGO-3:  "Here is a draft… <caption> …This caption draws on…"   →  stored, verbatim
    CGO-4:  "Three knots per centimetre. Hours of hand-knotting…"  →  stored, verbatim

The stored bytes are still the model's reply, verbatim. What changed is what the model was ASKED
for. A content draft now carries a **preparation brief** into the model's system instructions,
after Heby's standing instructions: your entire reply is the draft; return only the content
intended for human review; no preamble, explanation, labels or postscript unless they are the
content; prepared for Instagram — not connected, not scheduled, not published.

**The model authors the durable bytes directly.** No parser, no rewriting, no second call to clean
the first. The no-parser doctrine R3W wrote is unchanged and still asserted by test: a parser would
be a second, silent author, and the bytes a human later approves would be bytes nobody wrote.

---

## Three decisions worth keeping

**The fix is before generation, where authorship is not in question.** Everything downstream —
validator, writer, digest, agent authorship, revision semantics — is untouched. The change is one
pure module (`preparation-brief.ts`), one server-only option on `HebyModelAnswerOptions`, and one
pass-through in the preparation seam.

**A brief is honoured only for intents that prepare.** `systemInstructionsFor` appends the brief
only when `HEBY_INTENT_DESCRIPTORS[intent].prepares` is true. An ordinary Heby answer's system
prompt is byte-identical to what it was before this field existed, and the test proves it by
capturing the server-built request. `operational-plan` and `message-draft` carry no brief and are
prepared exactly as before.

**The model is told "prepared for", never "publishing to".** The destination sentence names the
human's declaration and denies the collapse in the same breath: no account, no connection, not a
system being posted to. No destination-specific copy rules were invented — the destination is a
closed enum with a label, and this repository has declared no content policy.

---

## Production acceptance

One real, billable model call and one production write, executed under explicit Director
authorization through the released seam at `c688f75`, on a DIFFERENT content task from CGO-3.

| Proof | Result |
|---|---|
| Artifact | `ad2054a2-d1c9-4cf4-87fa-7a69e069571c`, exactly one new row |
| Type / destination | `content-draft` · `instagram` · title "Rug washing video caption" |
| Revisions | exactly **1** (`current_revision` 1, lifecycle `draft`) |
| Digest | `588c0b66…` — recomputed SHA-256 over the stored bytes **matches** |
| Authorship | `agent` / `4ffeeb83-022c-44c9-b98a-6cf13bc1b78d`, resolves to the durable agent "Heby"; the id is **not** any `users` row |
| Provenance | `source_message_id` `221ea41b…`, role `assistant`, origin `model`; stored bytes **byte-identical** to that message |
| Model | `claude` / `claude-haiku-4-5-20251001` / transport `live` / correlation `c51468c6…` |
| Brief reached the model | system prompt starts with the standing instructions and carries the exact brief — observed at the generation boundary, 19 grounding lines |
| Opens as content | first bytes `Three knots per centimetre. Hours of han…` — no "Here is", no "I have prepared" |
| No claim | no *scheduled / published / posted / live* in the stored bytes |
| Heby grounds it | `type: content-draft · revision: 1 · prepared for: Instagram · destination is DECLARED ONLY — no provider connection exists, nothing is scheduled, nothing was published, nothing was delivered and nothing was seen · authored by: agent · digest: 588c0b66e277… · excerpt: complete` |
| WEV-1 association | **0 references** to this artifact — not created automatically |

The stored content, 256 bytes, verbatim:

    Three knots per centimetre. Hours of hand-knotting become something whole. Then comes the
    water—rinsing away the dust of making—and the sun does what only sun can do. Finished,
    cleaned, alive in the light. This is what patience looks like when it's drying.

### Non-effects, measured by delta

Twelve counted tables, before and after. `work_artifacts` 5→6, `work_artifact_revisions` 5→6,
`conversations` 32→33 and `messages` 74→76 (the human request and the assistant reply — the same
shape CGO-3 produced) are the authorized write. Everything else moved by **0**:
`work_evidence_references` 2, `decision_records` 7, `heby_action_requests` 5,
`action_execution_attempts` 1, `integration_credentials` 18, `provider_connectivity_controls` 2,
`agent_mandates` 2 (both Aug 31 timestamps — neither widened), `agents` 1. Both `work_items` remain
version 1 with their Sep 1 / Sep 2 timestamps — no Work lifecycle change.

No Governance decision, no permit, no execution attempt, no provider call other than the model
transport, no scheduling, no publishing, no credential, no schema, no ledger change.

The acceptance script itself died on a read-only corroboration query AFTER the write had
committed (it named a column that does not exist). The model call was not retried; corroboration
was re-run through a separate read-only script against the artifact id. Exactly **one** billable
call was made.

---

## What one sample proves, and what it does not

It proves the OUTPUT CONTRACT is materially more review-ready: the first byte is the first byte of
the content, there is no explanation after it, and the bytes are still the model's own. It does not
prove that Hebun writes good captions, that every future draft will open as cleanly, or anything
about performance. One sample is a contract check, not a quality claim.

One released transformation predates this phase and is unchanged: `modelBodyLines` splits the
reply on newlines, trims each line and drops empty ones before the seam joins them with `\n`. Blank
lines between paragraphs do not survive. That is a released message-persistence behaviour shared by
every Heby answer, recorded here as a limit and left alone.

---

## Validation

FAST discipline: no full repository suite. The new CGO-4 test passed first run once its own two
assertion defects were fixed (a multi-line import it mis-scanned; the brief's own prose saying
"answering"). Regressions green: CGO-1 (2), CGO-2, CGO-3, all five R3W suites, all three
agent-runtime-0, AMA-1/2/3 (9), HW1 (5), R2C (2), R2D (5), R2E, R2G, R3A.1, TB1 (2), L2 (2),
G6C (2), KR3, KR5, E2-5 (3), DH-1 firewall, H1 (3), agent-proposal-1 (4). Typecheck clean, lint 0
errors on every touched file. The AMA-1 bite-proof needs Node 24; under Node 20 it prints a version
line and exits — a known environment artifact, green under 24.

---

## Truth limits, undiminished

No Instagram, TikTok or YouTube provider. No publishing adapter. No durable scheduler. No
performance observation. The agent may prepare; it may not schedule, publish, connect a provider,
approve, authorize, execute, spend, change Work lifecycle or widen its own mandate. REVIEW-READY
means a human can read it as the asset — not approved, not scheduled, not published, not delivered,
not seen.

Candidates not selected, recorded: **B — Content Work Association Assist** is not FAST automation:
`work_evidence_references.declared_by_type` is CHECK-constrained to `human`, so an agent or system
declaration is unrepresentable, and making the preparation seam a WEV writer would launder a
system act into a human declaration. **C — YouTube public channel observation** needs a YouTube
Data API v3 key: `api_key` exists as a credential kind, but `PROVIDER_CATALOG` holds only
`google-workspace` and `github`, so it is a new provider definition, a new credential, health and
adapter — STRICT.

Debts left untouched: schema-release auto-deploy ordering, migration test authority fan-out, and the
17 pre-existing baseline failures.

---

## Status

**CGO-4 — CLOSED / PRODUCTION-ACCEPTED.**

Zero schema · zero new authority · zero provider · zero adapter · zero scheduler · zero mandate
change · one authorized production row.

**CGO-5 is not started and no successor has been selected.**
