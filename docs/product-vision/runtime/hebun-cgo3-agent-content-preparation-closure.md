# CGO-3 — Agent Content Preparation — CLOSED / PRODUCTION-ACCEPTED

**Release** `c93cfe407d64250191d8807e5365f691c2d52729` · **ZERO schema** · **Production ledger 47, unchanged** · **Deployment** `dpl_6gddYPjS4tUBEYzoXG7ho9MbbnV6`

---

## What Hebun can now do that it could not

Content had to be typed by a human. Hebun's own intelligence could prepare an operational plan or a
message draft, but never a content draft — the agent path could be *asked* for one and always
failed closed at CGO-1's validator, because no destination could reach it.

    "Draft an Instagram caption about the loom weaving reel."   →  refused, nothing written
                                                               →  now: a durable draft, agent-authored

**One field, through one seam.** The chain was already released and already executable: grounded
model context, the real validator, the tenant's durable agent identity as author, the Work Artifact
Authority as owner. `PrepareWorkArtifactInput` already accepted an `artifactType`, and since CGO-1
that union includes `content-draft`. Only the destination could not travel.

---

## Two decisions worth keeping

**The destination is the human's, never the model's.** It is carried like `title`. The model writes
the bytes; it does not decide where this organization intends to put them. A model that produces a
caption mentioning Instagram has decided nothing about publication. A test asserts no classifier
path exists in the seam.

**No authority changed, and that is asserted rather than argued.** The agent mandate is a
`proposal_scope` governing what an agent may PROPOSE; it has never governed what an artifact may
say, and the artifact domain imports it nowhere. A test asserts that absence alongside the absence
of any transport, scheduler or execution reach. The agent gained one field on a type it could
already author.

The pre-CGO-3 behaviour is kept as a live proof rather than a claim in prose: a content draft with
no declared destination is still refused, and still writes nothing.

---

## Production acceptance

One real, billable model call and one production write, executed under explicit Director
authorization through the released seam at `c93cfe4`.

| Proof | Result |
|---|---|
| Artifact | `6907ca7b-f36b-4562-8a75-7903332d82da`, exactly one new row |
| Type | `content-draft` — content-draft rows 1 → 2 |
| Intended destination | `instagram` |
| Revisions | exactly **1** |
| Digest | `f17044ba…` — recomputed SHA-256 over the stored bytes **matches** |
| Authorship | `agent` / `4ffeeb83-022c-44c9-b98a-6cf13bc1b78d`, resolves to the durable agent "Heby" |
| Not the human | the author id is **not** any `users` row |
| Provenance | `source_message_id` `bde38828…`, an assistant message — produced by the released preparation runtime |
| Work item | "Hebun Era III development", `active`, **v1 — unchanged** |
| WEV-1 association | **0 references** — not created automatically, exactly as instructed |

### The chain proved itself end to end

The model's reply cites the CGO-1 artifact by name and by destination — *"a work artifact titled
«Loom weaving reel — three knots per centimetre» prepared for Instagram"* — before drafting. That is
CGO-2's destination grounding feeding CGO-3's preparation, in production, unprompted. Both content
drafts are now groundable with their destinations, one human-authored and one agent-authored.

Heby receives the new draft as:

    type: content-draft · revision: 1 · prepared for: Instagram · destination is DECLARED ONLY —
    no provider connection exists, nothing is scheduled, nothing was published, nothing was
    delivered and nothing was seen · authored by: agent · digest: f17044bac4bb… · excerpt: truncated

Forbidden readings, judged with the denial text removed so it cannot satisfy its own test:
`scheduled` **false** · `published` **false** · `delivered` **false** · `seen by` **false** ·
`connected` **false** · `authorized` **false** · `posted` **false**.

### Non-effects, measured by delta

**Zero unexpected deltas across ten counted tables.** `work_artifacts` 4→5 and
`work_artifact_revisions` 4→5 are the one authorized write. Everything else moved by **0**:
`work_evidence_references` 2, `decision_records` 7, `heby_action_requests` 5,
`action_execution_attempts` 1, `integration_credentials` 18, `provider_connectivity_controls` 2,
`agent_mandates` 2, `agents` 1. Both mandates carry August timestamps — untouched, neither widened.

No Governance decision, no permit, no execution attempt, no provider call, no scheduling, no
publishing, no credential, no schema and no ledger change.

---

## An honest observation about product quality, not correctness

The stored bytes are the model's whole reply, verbatim — including its preamble and its closing
explanation of the caption. That is the released no-parser doctrine working exactly as designed: a
parser would be a second, silent author deciding what the model meant, and the bytes a human later
approved would be bytes nobody wrote. The artifact is therefore truthful but is **not** a clean
publishable caption; a human revises it, or a later phase gives the preparation prompt a stricter
brief. Nothing here should be read as "Hebun writes finished content".

---

## Validation

FAST discipline: no full repository suite. The new CGO-3 test passed first run, including the
fail-closed proof. Ten directly affected regressions green — all three R3W suites, both CGO-1 tests,
the CGO-2 grounding test, both agent-runtime-0 suites, and both mandate firewalls. Typecheck clean,
lint 0 errors (14 pre-existing warnings in unrelated files), build green.

Two failed launches preceded the authorized call and are recorded because neither was a retry of it:
the first died on module resolution outside the project tree, the second on a shell-mangled
connection string. Both failed before `Client.connect()` returned, no model call was made, and the
production artifact count was re-read as unchanged before proceeding. Exactly **one** billable call
was made.

---

## Truth limits, undiminished

No Instagram, TikTok or YouTube provider. No publishing adapter. No durable scheduler. No
performance observation. No campaign or ad execution. The agent may prepare; it may not schedule,
publish, connect a provider, approve, authorize, execute, spend, change Work lifecycle or widen its
own mandate.

Debts left untouched: schema-release auto-deploy ordering, migration test authority fan-out, and the
17 pre-existing baseline failures.

---

## Status

**CGO-3 — CLOSED / PRODUCTION-ACCEPTED.**

Zero schema · zero new authority · zero provider · zero adapter · zero scheduler · zero mandate
change · one authorized production row.

**CGO-4 is not started and no successor has been selected.**
