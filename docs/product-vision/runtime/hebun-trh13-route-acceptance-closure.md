# TRH-13 — Deployment Verification and Route-Level Acceptance — CLOSED

**Closure-only · ZERO product code · ZERO schema · ZERO migration · ZERO production mutation** ·
**Deployed SHA `78666a9` = HEAD = origin/main** · **Migration ledger 48/48 converged** ·
**Predecessors** [TRH-10](hebun-trh10-first-artifact-review-closure.md),
[TRH-11](hebun-trh11-agents-header-truth-closure.md),
[TRH-12](hebun-trh12-mock-gate-reconciliation-closure.md)

**This is the phase where three released capabilities stopped being claims about a repository and
became observed facts about a running deployment.** It changed nothing. Its entire output is
evidence, and the evidence is separated by how it was obtained.

    RELEASED  !=  DEPLOYED  !=  ROUTE-EXPOSED  !=  DIRECTOR-OBSERVED

---

## 1. Deployment — MEASURED, not inferred

The gap TRH-10, TRH-11 and TRH-12 each left open is closed by one authoritative read.

| | |
|---|---|
| Deployed SHA | **`78666a92f5f6cd5146eb661c9c71058cc1b72a37`** |
| Evidence | Vercel REST API `meta.githubCommitSha` on deployment `dpl_HKBBJZHLgRMB1jzdszCsr21p9sDa` |
| Target / state | `production` / `READY` |
| Aliases | `www.hebuntech.com`, `hebuntech.com` |
| Repository `HEAD` | `78666a9` — **identical** |
| `origin/main` | `78666a9` — **identical** |

**`RELEASED == DEPLOYED`, proved rather than assumed.** Prior phases could not make this claim:
`vercel inspect` does not surface git metadata, and earlier attempts recorded the deployed SHA as
unmeasurable. The REST API's `meta` block carries it, read with the CLI's own already-authorized
credentials, which were never printed.

Re-read at closure: same deployment id, same SHA. The Director's authenticated session triggered no
redeploy.

## 2. Schema convergence — MEASURED

Production applied ledger **48**, canonical **48**, prefix verdict **converged** by exact
per-migration sha256, digest `f11fb805ef8d822e4a59226e4600404e` on both sides. Cluster
`7675444875863894887` / `neondb`.

## 3. Route exposure — MEASURED

`GET /agents` and `GET /operations` on `www.hebuntech.com` both return **307 → `/login`**. The routes
are deployed and authentication-gated.

That 307 is also direct evidence of the mock-surface gate's **first** refusal clause. Vercel
Production environment carries both `HEBUN_AUTH_ENABLED` and `DATABASE_URL` — confirmed **by
variable name only**, values never read — so in the production runtime:

```
resolveMockSurfaceGate() → { permitted: false }
    clause 1: auth environment is not "disabled"   → real-tenant-reachable
    clause 2: a control plane is configured        → control-plane-configured
```

**A three-link measured chain, and its honest limit.** The gate's *inputs* are measured in
production; the gate's *logic* is proved by its own released firewall; the route's *deference* to it
is proved by TRH-12's firewall. The chain does not include the rendered page. That link is
Director-observed, below, and is not claimed as measurement.

---

## 4. `/agents` — DIRECTOR-OBSERVED

Recorded verbatim as reported by the Director, authenticated in the Turkish Rug House workspace.
**No browser observation was performed by the assistant, and none is claimed.**

> - `/agents` renders successfully.
> - Page subtitle visibly reads: **"1 durable agent identity · 1 in service"**
> - The durable identity surface visibly renders **Heby**.
> - Heby visibly carries **IN SERVICE**.
> - The durable surface is visibly labelled **CANONICAL DATABASE**.
> - The organization identity shown is Heby, not one of the seeded definitions.
> - **The former 36 seeded/simulated agent definitions were not observed on `/agents`.**
> - No "Agent Definitions" table containing SEO Agent, Sales Agent, Support Agent, etc. was observed.
> - **"36" was not observed as this organization's agent count.**
> - The page visibly distinguishes identity from capability: **NOT AUTHENTICATED · NOT AUTHORIZED ·
>   NOT RUNTIME AVAILABLE · NOT EXECUTABLE**.
> - The Agent mandate surface visibly shows Heby IN SERVICE and **"No mandate recorded."**
> - Activity / Governance / execution / model-usage surfaces render without inventing activity or
>   execution.
> - No simulation registry was observed on the authoritative organizational `/agents` route.

### What this settles

**TRH-11's header holds in production.** The subtitle states durable organizational truth. It is not
a seeded count, and the observed string matches what the released binding computes from the two
production identity rows.

**TRH-12's reconciliation holds in production.** The seeded registry is **withheld** from the
authoritative organizational surface, exactly as the gate decides.

    HIDE SIMULATION SURFACE  !=  DELETE SIMULATION SUBSYSTEM

**The simulation subsystem was NOT deleted and this closure does not claim it was.**
`agents/mock.ts` still compiles its 36 definitions; `agent-crud` still serves them to roughly
thirty-five internal consumers; `/director/registries/agents` does not consult the gate and remains
the dedicated simulation surface in every posture. What changed is where they are *presented*, never
whether they *exist*.

    DURABLE AGENT IDENTITY  !=  SEEDED AGENT DEFINITION

---

## 5. `/operations` — DIRECTOR-OBSERVED

> - Revision 1 and revision 2 are both visibly present.
> - Revision 1 visibly reads: **"Governance review of revision 1: not reviewed"**
> - Revision 2 visibly reads: **"Governance review of revision 2: changes requested"**
> - Revision 2 remains current.
> - No revision 3 is visible.
> - The publication warning is visibly present beside both review controls.
> - No Governance action was performed during verification.
> - Accept and Request changes were not clicked.

### Corroboration — where observation meets measurement

The observed strings are not taken on trust alone. Both live in released source at the deployed SHA:
`"Governance review of revision"`, `"not reviewed"` and `"changes requested"` are all in
`src/components/operations-preparation/artifact-revision-review.tsx`.

And the rendered state matches the ledger, measured independently:

| Rendered (observed) | Production (measured) |
|---|---|
| revision 1 — *"not reviewed"* | **0** decision rows with `subject_id = ffa53af0…` |
| revision 2 — *"changes requested"* | **1** row: `artifact-review` / `reject` → `artifact-revision-changes-requested` |
| revision 2 remains current | `current_revision = 2` |
| no revision 3 | `work_artifact_revisions = 2` |

**Revision 1's "not reviewed" is the honest state, not a fabricated one.** TRH-10 declined to
backfill a Governance rejection for a judgement made before any review authority existed, and the
surface says exactly that: not reviewed. An absence rendered as an absence.

**The decision is bound to the revision, and the render shows it.** Two revisions of one artifact
display two different review states, which is the whole point of binding the subject to the version
rather than the identity.

    CURRENT REVISION           !=  ACCEPTED REVISION
    CONTENT REVIEW             !=  PUBLICATION AUTHORIZATION
    PUBLICATION AUTHORIZATION  !=  EXECUTION PERMIT
    EXECUTION PERMIT           !=  EXECUTION SUCCESS

Revision 2 is simultaneously **current** and **changes-requested**. Nothing collapsed those.

---

## 6. Non-effects — MEASURED, before and after the Director's session

Turkish Rug House, every value unchanged across the entire phase:

    work_items                  1     work_artifacts               1
    work_artifact_revisions     2     knowledge_nodes              5
    work_evidence_references    4     agents (durable)             1
    integrations                0     integration_credentials      0
    agent_mandates              0     action_permits               0
    action_execution_attempts   0     external_recipients          0

    work_item declared_state    planned
    current_revision            2
    artifact_lifecycle_status   draft
    decisions on revision 1     0
    decisions on revision 2     1
    rev 1 digest                30d7c48c…e37c   recomputed, intact
    rev 2 digest                45b962ad…9b6d   recomputed, intact
    migration ledger            48              unmoved

**Reading a page changed nothing.** No Governance act, no mandate, no permit, no execution attempt,
no recipient, no provider, no publication, no revision 3.

### Tenant isolation — MEASURED

Hebun AI holds **0** `work_artifact_revision` decisions and its **own single** durable agent. The
review reached one tenant; the two `Heby` identities remain separate rows in separate tenants.

---

## 7. Status, kept distinct

| | `/agents` | `/operations` |
|---|---|---|
| IMPLEMENTED | ✅ TRH-11, TRH-12 | ✅ TRH-10 |
| TEST-PROVEN | ✅ firewalls, bite-proved | ✅ firewalls, bite-proved |
| RELEASED | ✅ `8ce1c74`, `78666a9` | ✅ `25cba81` |
| **DEPLOYED** | ✅ **SHA-measured** | ✅ **SHA-measured** |
| **ROUTE-EXPOSED** | ✅ 307 → `/login`, measured | ✅ 307 → `/login`, measured |
| **DIRECTOR-OBSERVED** | ✅ **this phase** | ✅ **this phase** |

Six levels, none collapsed. The first five are assistant-measured; the sixth is the Director's, and
is labelled as such wherever it appears.

---

## 8. Why no tests were run

Repository doctrine, followed rather than performed: **no product code changed in this phase**, so
there is no change for a suite to validate. The 18 suites relevant to TRH-10/11/12 were green at
their own releases; running them again would have proved only that an unchanged repository is still
unchanged. Repository and production reality were both re-measured and found consistent, which is
the check this phase actually owed.

---

## 9. Limitations

1. **Route-level rendering is Director-observed, not test-proven.** No automated authenticated
   render harness exists for `/agents` or `/operations`, as it does not for `/knowledge`. This
   closure does not claim otherwise, and the assistant performed no browser observation.
2. **The gate's production refusal is proved by its inputs, not by watching it return.** Both
   clauses are measured in the deployed environment; the return value itself was not observed at
   runtime.
3. **The acceptance path of artifact review remains unexercised against production.** Only
   changes-requested has run. Both share one code path and one suite.
4. **Vercel environment variables were read by NAME only.** No value was retrieved or printed.

---

## 10. What production actually is now

    Turkish Rug House
      durable agents        1  — Heby, IN SERVICE, canonical database
      mandate               NONE RECORDED
      seeded definitions    withheld from /agents
      work item             1, planned
      artifact              1, draft, current_revision 2
      revision 1            not reviewed
      revision 2            changes requested, current
      integrations          0     credentials 0     permits 0
      execution attempts    0     recipients  0     publications 0

    Hebun AI
      durable agents        1  — its own Heby
      review decisions      0

The organization can now be looked at and believed. Every number on those two pages is either a
measured fact about Turkish Rug House or an explicit statement that Hebun does not know.

---

## The ladder, exact

    UNDERSTAND -> PREPARE -> REVIEW -> [authorize] -> [permit] -> publish

    Turkish Rug House, after TRH-13:
      Knowledge grounded             YES  — TRH-3, TRH-4
      Durable agent identity         YES  — TRH-7, observed IN SERVICE
      Agent mandate recorded         NO   — "No mandate recorded", observed
      Work recorded                  YES  — TRH-8
      Draft prepared                 YES  — TRH-8, 2 revisions
      Review recorded                YES  — TRH-10, changes requested
      Review rendered in production  YES  — THIS PHASE, Director-observed
      Publication authorized         NO   — no action request exists
      Permit minted                  NO
      Published                      NO   — no provider, no credential, no path

The next boundary is visible in that table, and the product named it out loud on the page the
Director just read: **"No mandate recorded."** Turkish Rug House's agent exists, is in service, and
is bounded by nothing — so under AMA-2's released enforcement it can propose nothing. That is the
first gap between a durable identity and an agent that can actually do work.
