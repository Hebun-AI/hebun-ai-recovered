# R3A.1 — Heby Action Proposal Inlet

**Baseline at start:** HEAD `3ef9bae` = real `origin/main`, 0/0, 28 repo migrations = **28 applied** to `hebun_r1`, `work_artifacts` 0, `work_artifact_revisions` 0, `external_recipients` 0, `heby_action_requests` 0, `action_permits` 0, `plpgsql` only, 379 tests.

**At close:** 28 migrations (**no new migration**), canonical still at 28 with every row count unchanged, **381 tests**, `npm run verify` exit 0.

---

## 1. What this closes

The gap was never substrate. R3A made an approval durable, R3W gave `draftRef` a referent, R3R gave `recipientRef` one — and `recordActionRequest` still had **zero production callers**, so no real pending request could exist. R3A.1 is that caller, and it is the only one.

```
USER TYPES /send  →  closed registry  →  local shape validation
                  →  exact referent resolution (R3R + R3W)
                  →  prepareAction  →  recordActionRequest  →  /approvals
```

## 2. The model selects nothing

There is no classifier, no intent inference, and no parsing of model output anywhere in the delta. The action kind is a **constant** chosen because the user typed `/send`. The inlet imports no model client and constructs no transport — proven structurally, not promised.

Ordinary prose stays prose: "send the quarterly summary to Ayşe" parses as a **prompt**, not a command. "The model inferred you wanted to send" is not expressible.

## 3. `/send` grammar

```
/send external-recipient/<uuid> work-artifact/<uuid>@<n>
```

Both arguments are **references**. Not an address, not a body. A raw address would make the operator or the model the recipient authority instead of R3R; raw text would do the same to R3W.

`/send` **left the reserved block**, and its description changed with it. It used to read *"Send a message on your behalf"* — honest only while the command did nothing. It now reads *"Prepare an external message for Director approval. Sends nothing."*

A new `propose` command kind and an `actions` category were added, because the registry doctrine is `category === "future"` ⟺ `kind === "reserved"` and `/send` is no longer either.

## 4. Argument contract — four, not two

| Argument | Kind | Source |
|---|---|---|
| `recipientRef` | `record-ref` | typed by the operator |
| `recipientEndpointDigest` | `string` | **derived server-side** from the R3R row |
| `draftRef` | `record-ref` | typed by the operator |
| `draftRevisionDigest` | `string` | **derived server-side** from the R3W revision |

**The digests are never user input.** The caller supplies two references; the inlet resolves each against its owning authority and takes the digest from what it actually read. A supplied digest would let somebody name one thing and freeze another — the exact drift R3W and R3R exist to prevent.

`kind: "string"` rather than a new digest kind: `record-ref` carries an evidence-backing obligation a digest cannot satisfy, and a new kind would make every other tool's validator learn a concept only this tool uses.

**R3A was not modified.** All four are ordinary scalars in its existing canonical payload; no schema column, no migration.

## 5. Exact referent resolution

**Draft** — must be `readable` and `proposable`, which R3W defines as the **current** revision of a non-retired artifact. `superseded` refuses with its own reason and **nothing is upgraded to the newer revision**: silently proposing bytes the operator did not name is the failure this chain exists to prevent.

**Recipient** — must resolve in-tenant and be `active`. Retired refuses with its own reason. No raw address is accepted as authority anywhere.

## 6. Evidence gate

The generic `record-ref` backing check is reused unchanged. The two evidence entries exist *because* two tenant-scoped reads returned rows — they are the reads, not a construction to satisfy the gate.

Proven refused: fabricated recipient, fabricated draft, malformed either half, raw address as recipient, raw text as draft, foreign-tenant recipient, retired recipient, retired artifact, superseded revision. **The Director never receives a proposal whose referents resolve to nothing.**

## 7. Transaction boundary

The proposal has its **own** server action and its own module — a third Heby crossing, separate from both the answer action and the read action:

```
failure to answer          ≠  failure to file a proposal
failure to file a proposal ≠  failure to store the conversation
```

Folding this into `askHebyAction` would tie a durable authorization artifact to a model call: a provider timeout would silently drop a proposal a human was waiting on. A test asserts the answer flow reaches neither `recordActionRequest` nor this module.

## 8. Dedup

R3A's, unchanged. `heby_action_requests_one_pending_per_digest_uq` decides it. The same four values produce the same payload digest → `already-pending`; a different revision produces a different digest → a second request. Nothing looks up the original to "helpfully" return it — that would be a second dedup layer reading state the index already adjudicated.

## 9. Heby's response

Runtime data only: request id, action kind, recipient label and ref, draft title and ref, `status: pending review`, and *"Nothing was sent. A human decides in /approvals."*

It never says approved, authorized, executing, sent, successful or scheduled. No confidence figure. No model-authored explanation. `SEND_PROPOSAL_NON_EFFECTS` states the denials in code, and a test asserts **every entry is a denial** — which caught a positive fact sitting in that list and moved it to `SEND_PROPOSAL_EFFECTS`.

## 10. `/approvals` integration

No second review surface. The proposal appears through the existing `readPendingActionRequests` path, and `parameters` — derived from the canonical payload and sorted — makes **all four bound scalars inspectable**, so a human is not asked to approve a binding they cannot read. Approval still goes through the unchanged Governance/R3A writer.

## 11. Authority firewall

The inlet reaches no `approveActionRequest`, `rejectActionRequest`, `revokeActionPermit`, `consumeActionPermit`, Governance writer, `action_permits`, `decision_records` or `governance_sessions`. `/approve`, `/reject`, `/execute`, `/run`, `/deploy`, `/terminal`, `/computer-use`, `/browser` all stay `reserved` and dispatch nothing. Exactly **one** proposable command exists.

## 12. Creation firewalls

**Recipient** — `/send` naming an unknown recipient returns `recipient-not-found`. The inlet imports no recipient writer. No parsing of `"Jane <jane@example.com>"` into a row. R3R creation stays human-only.

**Artifact** — `/send` requires an existing revision. The inlet imports no artifact writer. Preparing content and sending content are not collapsed into one opaque act.

## 13. Execution firewall

Zero send adapter, SMTP, email API, provider fetch, credential, execution attempt, execution receipt, permit consumption, execution queue, Computer Use, browser automation, shell, agent dispatch. `send-external-communication` still declares **`substrateConnected: false`** — approval mints a permit nothing can spend, which is the honest state and not something this command papers over.

## 14. Privacy

The raw address never enters the payload, the receipt, a log or the model's context. The proposal carries the recipient **reference**, the **display label**, and the **endpoint digest**. `endpointValue` appears nowhere in the inlet. The address is visible to the human only through a server-side resolve at the review surface.

## 15. Digest integrity

Deterministic; key-order independent; and each of the four scalars moves the binding independently — a different recipient, a different **address** (the retire/recreate case), a different revision, and different draft bytes all produce different digests. The FNV `actionId` is never used as the binding.

## 16. Stale draft semantics — **A, and it is already the architecture**

Draft rev1 proposed → rev2 created → the filed proposal **stays bound to rev1**, and its payload still names rev1. Approving it approves exactly the bytes that were reviewed, because those bytes are immutable by R3W construction.

A **new** proposal against rev1 is refused `draft-superseded`, because only the current revision is proposable. No new state was invented: `readable` vs `proposable` already drew this line.

## 17. Retired recipient semantics

Proposal filed → E1 retired → **no substitution to E2, ever**. A new proposal naming E1 is refused `recipient-retired`.

An already-filed proposal still names E1, and the digest still matches because the address bytes are immutable — so **only a status check can catch it at approval or execution time**. That re-validation belongs to R3B's consumption path and is deliberately **not** wired here.

## 18. Audit relationship

Filing a proposal emits no Governance audit, because R3A does not — proposing moves no authority. Approval and rejection audit stay owned by R3A/Governance. No duplicate audit truth.

## 19. Schema verdict — **no new table, no migration**

R3A.1 is pure wiring of R3W, R3R, `heby-actions`, `heby-commands` and R3A's request persistence. The repo stayed at 28 migrations and canonical stayed at 28 applied.

## 20. Pre-existing tests repaired

| File | Why R3A.1 falsified it | Repair |
|---|---|---|
| `heby-actions/actions.ts`, `r3w-flow/record-ref-and-binding.ts` | fixtures supplied 2 of 4 required arguments, so validation failed *before* the record-ref gate | supply all four, so each test still measures what it says |
| `hw1-flow/navigation-and-firewall.ts` | "exactly three Heby server actions" | four, plus an assertion that the propose boundary is one of them and takes no cache authority |
| `voice-v1/voice-firewall-s1-r2e.ts` | reserved set 11→10, and `/send the invoice` no longer refuses for "no execution runtime" | `/send` got its own assertion — dictated prose still must not file a proposal, for the now-correct reason |
| `s1-flow/registry-and-parser.ts` | `future ⟺ reserved` | `/send` moved to the new `actions` category |

**One firewall objected to the design and was right.** `r2c`/`r2d` forbid `heby/actions.ts` from importing `next/cache`; my `revalidatePath("/approvals")` violated it. The right move was to drop the call — `/approvals` is a separately navigated, server-rendered page — not to widen a security boundary for a convenience.

## 21. Tests

`tests/r3a1-flow/proposal-postgres.ts` — happy path with both digests frozen from server reads; R3A dedup; a different revision is a different proposal; the filed proposal stays bound to rev1; superseded/retired/fabricated/malformed/foreign/raw-address/raw-text all refused; unauthenticated and unpersisted refusals; the command seam refuses non-propose and unknown commands and resolves the tenant server-side; `/approvals` reads it with all four parameters visible; reconnect durability; zero permits, decisions, sessions, audit events, executions; no recipient or artifact created by the inlet.

`tests/r3a1-flow/boundaries-and-firewall.ts` — no model client or transport; action kind is a literal; prose stays prose; the planner refuses nine non-reference argument shapes **locally**; registry patterns agree with the R3R/R3W parsers; authority, execution, provider, secret and creation firewalls; privacy; four-way digest integrity with order independence; the answer flow files nothing; exactly one production caller of `recordActionRequest`.

## 22. Verification

| Stage | Result |
|---|---|
| lint | PASS — 0 errors, 15 warnings |
| typecheck | PASS |
| tests | **381 passed, 0 failed** (379 → 381) |
| build | PASS |
| `npm run verify` | **exit 0** |
| `git diff --check` | clean |
| leaked disposable databases | 0 |

## 23. Canonical firewall

Before = after: **28 applied**, `work_artifacts` 0, `work_artifact_revisions` 0, `external_recipients` 0, `heby_action_requests` 0, `action_permits` 0, `executions` 0, knowledge 1, `decision_records` 8, `governance_sessions` 8, `audit_log` 17, conversations 34, messages 124, users 3, `plpgsql` only. **No synthetic proposal exists in canonical.**

## 24. Product truth

- **A proposal can now be filed.** `/send` with two exact references creates one durable pending request.
- **Nothing has been proposed.** `heby_action_requests` = 0 everywhere; no substrate exists in canonical to propose against either.
- **Nothing can be sent.** `substrateConnected: false`. Approval mints a permit no consumer can spend.

## 25. Limitations

1. One proposable action. `/send` only.
2. **References must be typed by hand.** There is no picker; the operator needs the exact ref strings.
3. Retired-recipient re-validation at approval time is **not** implemented — that is R3B's.
4. No UI beyond the command result panel.
5. Nothing has been proposed anywhere; the substrate is empty.

## 26. Dependency chain after R3A.1

```
R3A ✅ → R3W ✅ → R3R ✅ → R3A.1 ✅ implemented (this phase) — NOT committed
  ↓  a real pending request can exist for the first time
R3B ❌ + secret store + send adapter + attempt/receipt + execution kill switch
       + retired-endpoint refusal at consumption
       + consumeActionPermit production consumer (still ZERO)
```

## 27. Next gate

**Commit gate.** No commit, tag or push was made in this phase.
