# Hebun R6 — Customer Knowledge — Phase Closure

**Closed at `172c26f`. 404/404. No code, no schema, no migration, no canonical mutation.**

This is a **phase** closure, not a capability closure. Each R6 capability already carries its own
closure record and its own release tag; this record does one thing those cannot: it states what the
layer as a whole is responsible for, what it is not, and what it still cannot do — so that R7 can be
built against a settled boundary instead of an implied one.

Baseline at closure: HEAD `172c26f` = cached `origin/main` = real remote (`git ls-remote`), 0/0,
tracked tree clean, 30 migration files / 30 journal entries / 30 applied, `knowledge_nodes=1`,
`knowledge_facts=1`, `knowledge_edges=0`, `audit_log=17`, `companies=2`, `users=3`,
attempts/permits/requests `0/0/0`, provider `claude` `version=30` **disarmed**, zero disposable
residue.

---

## What R6 established

R6 established the **Customer Knowledge layer**.

Its responsibility is exactly one question:

> **"What has this organization told Hebun about itself?"**

Everything R6 owns is downstream of that question, and everything R6 refuses is downstream of the
fact that the question is about *what was said*, not *what is true* and not *what is happening*.

---

## What R6 owns

- **Customer-supplied Knowledge** — the records an organization gives Hebun about itself.
- **Ingestion** — bounded text, Markdown and PDF intake into the single governed writer.
- **Provenance** — where a record came from, carried on the record and never inferred.
- **Knowledge standing** — lifecycle, health, scope, freshness, and retrieval eligibility.
- **Ratification linkage** — the binding between a Knowledge record and the Governance decision
  that approved it.
- **Knowledge retrieval evidence** — the grounded evidence path Heby answers from.
- **Company Understanding coverage projection** — per-category counts of what is held in force.
- **Missing-area projection** — the declared areas in which Hebun holds no evidence in force.
- **Source retraction for unratified Knowledge** — one governed human act withdrawing every fact a
  source produced.

---

## What R6 does not own

R6 does not own, and never claimed:

- organizational performance diagnosis
- causal analysis
- process optimization
- workforce effectiveness
- predictive organizational risk
- strategic recommendations
- inferred operational truth
- model-authored organizational authority

The boundary is not a scoping convenience. It follows from what R6's records *are*: a Knowledge
record is a statement the organization made. Reading a judgement out of a statement — that a process
is slow, that a team is ineffective, that a risk is coming — is a different act on different
evidence, and R6 holds neither the evidence nor the authority for it.

R6B stated this in the code itself before R7 existed: a single score over the coverage categories
"would be read as a judgement about the organization, which is a claim this projection cannot
support **and R7's question anyway**." The separation is already load-bearing in released source.

---

## Verification at closure

The full released suite: **404 passed, 0 failed, 404 total**, exit `0`.

No new R6 audit was performed and no R6 capability was redesigned. Only the released invariants were
re-proven, each by its own existing suites:

| # | R6 capability | Proving suites |
|---|---|---|
| 1 | Knowledge ingestion | `knowledge-ingestion-flow/*`, `r4c-flow/*` |
| 2 | PDF ingestion | `r4c2-flow/*` |
| 3 | Knowledge authority | `k1-flow/knowledge-authority`, `k2-flow/authority-and-validation` |
| 4 | Tenant isolation | `k1-flow/tenant-isolation-postgres` |
| 5 | Provenance | `k1-flow/authority-reconciliation`, `k3-flow/*` |
| 6 | Ratification | `k4-flow/*` |
| 7 | Heby Knowledge evidence path | `kr3-flow/*`, `kr4-flow/*`, `kr5-flow/*` |
| 8 | Company Understanding projection | `r6b-flow/*` |
| 9 | Source retraction | `r6d-flow/*` |
| 10 | Agent / model write firewall | `g1-flow/*`, `g2-flow/*`, every `boundaries-and-firewall` |

Canonical was byte-stable across the run: 30 applied, 1 node, 1 fact, 17 audit rows, 2 companies,
`0/0/0` attempts/permits/requests, provider disarmed at `version=30`, and no disposable database
left behind.

No released R6 invariant is broken.

**R6 = COMPLETE.**

---

## Remaining limitations

These are recorded, not reopened. None blocks closure; each is a known edge of the layer.

- **No Governance reversal for ratified Knowledge.** K4 has no reversal runtime, and the authoring
  band may not undo a Governance decision. R6D therefore refuses a ratified source **entirely**
  rather than retracting it in part.
- **No contradiction detection.** Two Knowledge records may assert opposite things and both stay in
  force. Hebun holds what it was given and reconciles none of it.
- **No model-derived Knowledge extraction.** Every Knowledge record is human-authored or
  human-ingested. No model writes Knowledge, and the firewall is tested, not asserted.
- **Provider deliberately disarmed.** `director_enabled = false`. It stays disarmed unless
  deployment possession enables it; production has no write path to that control by design.
- **No hosted real-customer corpus.** Canonical holds one node and one fact from a local ceremony.
  The layer is proven, not populated.
- **Schema-only organizational tables remain schema-only.** `organizations`, `departments`,
  `missions`, `goals`, `plans`, `policies`, `workflows`, `tasks`, `executions`, `telemetry_events`,
  `learning_sessions`, `improvement_proposals`, `event_log`, `commands`, `command_audit`, `agents`,
  `reasoning_traces`, `integrations`, `approvals` and `notifications` are migrated and empty, with
  no writer and no reader. They stay that way unless R7 explicitly earns their activation. A table
  existing is not a capability.

---

## Three questions

**What did we learn?** A phase boundary is worth writing down separately from the capabilities
inside it. R6's capabilities each proved themselves; what none of them could state alone is the
question the layer answers — and it is that question, not the feature list, that tells R7 where it
may not reach.

**How does this improve Turkish Rug House?** The layer that will hold a real business's own
statements about itself is closed and bounded: what it will accept, what standing that gives a
record, and what it will never silently turn that record into.

**How does this become part of Hebun AI?** R6 is the settled floor R7 reads from. The separation
between *what the organization said* and *what can be inferred about how it operates* is now a
recorded phase boundary rather than an implicit one.
