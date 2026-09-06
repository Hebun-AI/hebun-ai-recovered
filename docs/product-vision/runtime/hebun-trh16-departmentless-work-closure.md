# TRH-16 — Governed `record-work` Declares Its Organizational Scope — CLOSED

**ZERO schema · ZERO migration · ZERO new authority · ZERO production mutation** ·
**Migration ledger 48/48 converged, unmoved** · **Suite 684/684** ·
**Predecessors** [TRH-14](hebun-trh14-heby-mandate-closure.md),
[TRH-15](hebun-trh15-*.md — discovery, no closure: no department was named)

**The governed path was strict in the right spirit and the wrong shape.** It required every
`record-work` proposal to name a department — including proposals from organizations that have
none. `recordWorkWithin`, the authority that OWNS work, has always accepted `departmentId = null`,
and Turkish Rug House's own human-created work item is exactly that. So the rule did not merely
prevent fiction; for such an organization it FORCED one, because the only way to propose was to name
a department that did not exist.

    AGENT STRICTNESS SHOULD PREVENT FICTION, NOT FORCE FICTION.

    NO DEPARTMENT IS A VALID ORGANIZATIONAL STATE
    NULL ORGANIZATIONAL RELATIONSHIP  != MISSING TRUTH
    DEPARTMENTLESS WORK               != FICTIONAL DEPARTMENT
    EXPLICIT ABSENCE                  != OMITTED REQUIRED INPUT
    EXPLICIT ORGANIZATION-LEVEL WORK  != AN INVENTED ORGANIZATIONAL REFERENCE

---

## THE CORRECTION THIS CLOSURE OWES

TRH-14 and TRH-15 both stated that a department was **"the last structural blocker for Heby."**

**That was false, and this phase proves it false.** Measured at `085152b`:

1. **`proposeAgentOriginatedRecordWorkAction` has ZERO production callers.** Only
   `tests/gia1-governed-internal-action/internal-act-postgres.ts` calls it.
2. **`record-work` is not model-selectable.** `structured-output.ts` admits exactly
   `SEND_ORIGINATION_ALIAS` and the abstain value; anything else refuses `unsupported-action-kind`
   before an argument is read. GIA-1 pinned this deliberately: *"ORIGINABLE MEANS MANDATABLE, NOT
   MODEL-SELECTABLE — AND THE DIFFERENCE IS PINNED… It did NOT teach the model to select it."*

And the sharper fact underneath: **Turkish Rug House's mandate admits exactly the one kind the model
cannot select (`record-work`), and excludes the only kind it can (`send`).** Heby can propose
nothing, and creating a department would not have changed that.

**TRH-16 does not close that gap and does not claim to.** A firewall pins both facts so this phase's
scope can never be mistaken for a capability it did not deliver.

---

## What was wrong

The threat the governed path exists to prevent is stated in the action registry:

> *"A proposal that named nothing real would put a decision about a fiction in front of the
> Director."*

**THE THREAT IS FICTION, NOT ABSENCE.** But the contract could not tell the two apart. The resolver
said so in its own comment:

> *"Shape first — a malformed reference is refused exactly as an absent one is."*

Three distinct facts collapsed into one refusal: work deliberately held at organization level, a
caller who forgot the field, and a malformed proposal.

Meanwhile the generic capability gate already had the right semantics for optional references —
*"an optional record-ref that is simply absent is fine; one that is SUPPLIED must resolve"* — so
only `record-work`'s own `required: true` forced the collapse.

---

## The contract

```ts
export type RecordWorkProposalDepartmentScope =
  | { readonly kind: "department"; readonly departmentRef: string }
  | { readonly kind: "organization-level" };
```

Expressed in the registry with existing machinery — no new argument kind:

| field | kind | required |
|---|---|---|
| `departmentScope` | `enum`, closed at `["department", "organization-level"]` | **yes** |
| `departmentRef` | `record-ref` | **no** — supplied only on the department branch |

**The replacement invariant is stricter, not looser.** Before, a proposal had to carry a
*reference*. Now it must carry a *declaration*, and every reference check that existed still runs
unchanged on the branch that declares one:

> every governed `record-work` proposal must EXPLICITLY DECLARE either a real in-service department
> of this tenant, or organization-level work; and no malformed, fabricated, foreign-tenant or
> retired organizational reference may enter Governance

### Three states, distinguishable

| state | outcome |
|---|---|
| `{kind:"department", departmentRef}` | resolved through Organization Authority exactly as before |
| `{kind:"organization-level"}` | explicit; reaches the Work Authority as `departmentId = null` |
| missing / unknown / contradictory discriminator | **`invalid-department-scope`** |

`invalid-department-scope` is deliberately **separate** from `department-not-found`, and separating
them leaks nothing. `department-not-found` stays collapsed across absent, foreign-tenant and
malformed because it answers *"does this department exist?"* — a question about rows a caller may
not be allowed to see. The new refusal answers *"what did you claim?"* — a question about the
caller's own envelope, which it always knows.

A contradictory envelope — `organization-level` carrying a reference — is **refused, not repaired**.
Choosing one of its two claims would be inventing intent.

---

## THE DEVIATION, STATED PLAINLY

**The organization-level branch DOES read the Organization Authority.** The Director's approved
sketch said it would not. It must, and the reason is a released rule this phase refused to weaken:

```
requiredEvidenceCount(CONSEQUENTIAL_MUTATION) = 1
```

Measured directly during implementation:

| evidence supplied | lifecycle |
|---|---|
| zero | **`FAILED`** — *"requires at least 1 evidence reference(s); 0 supplied"* |
| one organization entry | `REQUIRES_HUMAN_REVIEW` |

That rule is global by side-effect class and its question is *"does this action refer to anything
real?"* The department branch answers it by citing the department row it retrieved.
Organization-level work refers to the **organization**, so the honest answer is to retrieve the
organization and cite it.

    THE EVIDENCE RULE WAS NOT LOWERED. IT WAS ANSWERED.

The alternative — lowering the minimum — would have weakened a rule protecting every consequential
tool in the product, to make one branch convenient. It was rejected, and a firewall now pins the
minimum at 1 so nobody can quietly take that shortcut later.

The read goes through **`readOrganizationAuthority`, the same seam the department branch uses** —
not a second one — and it takes no organization parameter, so a caller cannot point it at another
tenant. It resolves `companies`, the tenant's own row, so it is available for an organization with
zero `departments` and zero `organizations` rows. Verified against both production tenants:

    Hebun AI           -> organization/f625b683-3be5-40eb-93a4-53fc56ab38c9
    Turkish Rug House  -> organization/9947c78e-2080-4331-81c6-456cb4be7a96

What that branch must NOT do — and a firewall enumerates it — is resolve a **department**: it
reaches no `structure.departments`, no `parseDepartmentRef`, no `formatDepartmentRef`, no
`department-not-found`. It names no department, so it looks none up, evidences none, and invents
none.

### The new vocabulary, and why it is the smallest possible

`organization-ref.ts` — a pure formatter/parser for `organization/<uuid>`, the exact shape
`department-ref.ts` established one level down. No I/O, no table, no clock, no authority. It reuses
the existing `organization` source class; **no source class was added.**

Formatting asserts nothing about existence — that is the resolver's question. A syntactic check that
felt like an existence check is how a fabricated reference reaches an approval.

---

## Security

**Tenant isolation is structural, not checked.** The cited organization is
`formatOrganizationRef(authoritative.organization.organizationId)` — the authority's answer for this
session's tenant. There is **no input through which another organization could arrive**, so a
cross-tenant or nonexistent organization reference is *unrepresentable* rather than merely rejected.
A firewall pins that no reference is built before the authority has been read.

Unchanged and re-measured green: cross-tenant department refuses, retired department refuses
(`department-retired`, still not collapsed), malformed reference refuses, tenant never crosses the
client boundary, mandate ceiling enforced on the agent branch only, Governance still downstream, no
permit minted, no execution, no provider reached, no department created.

**Nothing is authorized by any of this.** A proposal is still a proposal.

    MANDATE ADMITS ACTION != PROPOSAL STRUCTURALLY VALID != PROPOSAL FILED
    != GOVERNANCE AUTHORIZED != PERMIT != WORK RECORDED

---

## Authority ownership — unchanged

    Work Authority          owns Work persistence and lifecycle, and whether work may be unassigned
    Organization Authority  owns departments, and now names itself
    Agent Mandate           owns the proposal ceiling
    Action Authorization    owns proposal/authorization flow
    Governance              owns consequential decision legitimacy
    Execution               separate

    WORK AUTHORITY OWNS WHETHER WORK MAY BE UNASSIGNED.
    THE PROPOSAL CONTRACT OWNS HOW THAT INTENT IS EXPRESSED SAFELY.

A firewall re-measures that there is still **exactly one** `insert(workItems)` and that
`recordWorkWithin` still accepts a null department and still validates a non-null one.

**Schema impact: NONE.** `work_items.department_id` was already nullable; zero changes under
`src/db`; 48 migrations; ledger unmoved.

---

## Tests

**New:** `tests/trh16-departmentless-work/departmentless-firewall.ts`, **bite-proved against four
real defects**:

| mutation | caught by |
|---|---|
| lower `requiredEvidenceCount(CONSEQUENTIAL_MUTATION)` to 0 | *"the minimum itself is untouched at 1"* |
| make `departmentScope` optional | *"a REQUIRED enum — declaring nothing is not a proposal"* |
| executor defaults an unknown scope to organization-level | *"never defaults to organization-level"* |
| cite a caller-supplied organization instead of the authority's | *"the AUTHORITY's answer for this tenant"* |

**Three released pins amended, each to the invariant it was written to protect — none weakened:**

1. **`gia1/internal-act-firewall.ts`** — a `prepareAction` fixture predating the discriminator.
   Scope declared; `PREPARED != AUTHORIZED` and the reversibility assertions unchanged. All 12
   GIA-1 bite-proof mutations still bite.
2. **`l3-organization-authority/firewall.ts`** — a file census of the Organization Authority.
   `organization-ref.ts` is **named and justified**, not absorbed by incrementing a number. The
   census did exactly what it exists for.
3. **`truth1-organizational-fiction/disclosure-and-firewall.ts`** — see below.

Plus 9 mechanical call-site updates in `gia1/internal-act-postgres.ts`, all department-scoped, each
keeping its invariant (valid, duplicate, cross-tenant, retired).

### A TRH-12 regression this phase found and fixed

The full run surfaced one failure **targeted runs could not have found**: TRUTH-1's census pins the
mock-surface gate's call sites at exactly two, and **TRH-12 added a third — `/agents`** — without
running it. TRH-12 ran only narrow suites and missed it.

Amended by **naming** the third caller. **A third caller is not a second authority**, which is the
whole invariant there; every assertion around it — the gate reads only the environment, cannot see a
tenant, has no rival beside it — is unchanged and passing. Recorded here rather than quietly fixed.

**This is why the full run was justified**: a new source file plus a shared registry change is
exactly the shape that trips directory and consumer censuses, and two of the three amendments above
were censuses doing their job.

**Suite: 684 passed, 0 failed, 684 total.** Typecheck clean, lint 0 errors.

---

## Turkish Rug House — production, read-only, unchanged

    departments               0        department_placements     0
    agents                    1        agent_mandates            1  (revision 1, ["record-work"])
    heby_action_requests      0        action_permits            0
    action_execution_attempts 0        integrations              0
    integration_credentials   0        external_recipients       0
    memberships               1        roles                     1 ("Owner")

No proposal filed, no department created, no mandate revised, no provider, no execution.

### Structural eligibility — four separate answers, not collapsed

| | |
|---|---|
| TRH organization-level `record-work` **contract representable** | **YES** |
| **Human-dictated** governed proposal path structurally reachable | **YES** — `/director/work`, which never consults the mandate |
| Heby agent-originated `record-work` **model-selectable** | **NO** |
| Heby agent-originated production inlet **connected** | **NO** |

The first two moved. The last two did not, and this phase never touched them.

---

## Limitations

1. **No proposal was filed**, deliberately. Representability is proved by executing the contract
   in-process, not by writing a production row.
2. **Route-level rendering remains unproven by test**, as everywhere else.
3. **`send` is unaffected** and remains outside TRH's mandate.
4. **The deviation above is real**: organization-level reads Organization Authority. It is pinned,
   justified and stated rather than hidden.

---

## The ladder, exact

    Turkish Rug House, after TRH-16:
      Mandate recorded                        YES  — revision 1, ["record-work"]
      Organization-level work representable   YES  — THIS PHASE
      Human-dictated proposal reachable       YES  — /director/work
      `record-work` model-selectable          NO   — pinned, deliberately, since GIA-1
      Agent inlet connected in production     NO   — zero callers, pinned
      Proposal filed                          NO
      Governance authorized                   NO
      Permit / executed / published           NO

The contract now lets an organization say what is true about itself. Whether its agent can say
anything at all is the next question, and it is a different one.
