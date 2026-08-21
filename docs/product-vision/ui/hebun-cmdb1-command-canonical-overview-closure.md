# CMD-B1 — Command becomes a canonical Overview over the pending authority read seam (closure)

**Released 2026-08-21 · tag `hebun-cmdb1-command-canonical-overview` · implementation `18279df`**
**Classification: A — COMMAND CANONICAL OVERVIEW CONNECTED / NO NEW AUTHORITY**

Entry state: `main` at `8d3bac1`, `HEAD == origin/main`, 0 ahead / 0 behind, 428/428, APP-1 tag
`hebun-app1-decisions-truth-consistent` peeling to `ede09ad`.

The first Command surface in this system that reads something real. One route, one presentation
component, one pure model, one amended released pin, eight retired components. No writer, no
resolver, no new read seam, no server action, no repository, no runtime, no schema, no migration,
no row.

---

## 1. The defect, and its class

`/command` was the default authenticated landing and it was **100% unavailable for a real tenant**.

The Phase 6B/7 Command Center composed eight operational cells, an executive state strip, a
decision-pressure panel and an advisory strip over `getDirectorDashboardUiModel()` — a demo-gated,
tenant-blind executive projection. For a real tenant the adapter deliberately **withholds** that
projection, and says so in its own comment:

> `WITHHELD, NOT ZEROED. … A fabricated zero would be its own lie: Hebun does not know that this`
> `tenant has no agents.`
> — `src/features/director-dashboard-ui/adapter.server.ts:94`

The adapter was right. The presentation put the zero back. Measured authenticated during the CMD-B1
review pass, the surface rendered eight unavailable sections, eight unavailable insights, and a
state strip printing **`0 critical · 0 warning · 0 AGENTS · 0 WORKFLOWS`** across the top of the
withholding.

**The fabricated-zero class:** a surface that turns an *unanswered* read into a *number*. It is the
same class APP-0 and APP-1 swept in the other direction — there, a connected seam was denied in
prose; here, a withheld projection was affirmed in digits. Both are one source of truth being
overruled by a component that performs no read.

## 2. The old presentation is retired, not repaired

Eight components deleted:

| file |
|---|
| `src/components/command-center/command-center.tsx` |
| `src/components/command-center/command-header.tsx` |
| `src/components/command-center/executive-state-strip.tsx` |
| `src/components/command-center/director-attention.tsx` |
| `src/components/command-center/decision-pressure.tsx` |
| `src/components/command-center/system-operational-status.tsx` |
| `src/components/command-center/operational-pulse.tsx` |
| `src/components/command-center/context-strip.tsx` |

Retired rather than repaired because **none of them had a connected source to repair**. A cell whose
only input is a withheld projection cannot be made honest by rewording it; it can only be made
absent. `tests/cmdb1-command-overview/canonical-overview.ts` pins all eight as non-existent, so none
returns by reconstruction.

Three files in that directory survive and were deliberately not swept: `command-region.tsx` (one of
VI-1's nine tracked regions, imported by Operations and Platform), `health.ts`, and `heby-why.tsx`
(imported by thirty-one files). See §11.

## 3. The exact read chain

```
/command  (route, server component)
  └─ resolveTenantContext()                                   ← the tenant, resolved ONCE
       └─ readPendingActionRequests(tenant)                   ← the action-authorization
            │                                                   authority's own reader, unchanged
            │   SELECT … FROM heby_action_requests
            │   WHERE tenant_id = <session tenant>
            │     AND status = 'pending'
            │   LIMIT 50
            └─ toWaitingOnYou(read)                           ← pure mapping, no I/O
                 └─ <CommandOverview waiting=… intent=… />    ← presentational, server-safe
```

`getExpressIntentSummary()` is the second input and touches nothing durable: it counts
`listActionTools()` and `invokableActionTools()` from the declared action registry.

## 4. The tenant is resolved exactly once

One `resolveTenantContext()` call, in the route. **Zero** in `command-overview.tsx` and **zero** in
`workspace-model.ts`.

This is the convention `/approvals` and `/heby` already follow, and the reason no Command component
may resolve its own: N resolutions per request could describe N different instants, and a component
that resolves its own context is a component that can be moved somewhere it should not read.

## 5. The existing action-authorization seam is reused, unchanged

`src/features/action-authorization/read-action-authorizations.server.ts` is **not in this diff**.
The tenant comes from the session; the predicate is `tenant_id = <that tenant> AND status =
'pending'`; the bound is still `deps.limit ?? 50`. There is no parameter through which this page
could ask about another tenant or widen the query.

Command is the **second non-owning consumer** of that seam. `/heby` was the first, and its header
already records the same doctrine: one read, and it is somebody else's. CMD-A chose this over
building a Command-side summary projection precisely so that no second copy of the queue exists.

The owned files import, in total: `next/link`, `lucide-react`, `@/components/ui/state-block`,
`@/components/ui/workspace-section`, `@/features/heby-actions`, and the seam — the last **type-only**
in the model. No approval writer, no Governance resolver, no Knowledge writer, no repository, no
persistence module, no `"use server"`.

## 6. Permits are not read, on purpose

Zero references to `readActionPermits`, `actionPermits` or `action_permits` in any CMD-B1 file.

A permit is an authorization **already granted** — a different lifecycle stage from a request
awaiting one. The surest way to guarantee the two are never merged into a single number on an
executive summary is not to fetch the second at all.

## 7. What "Waiting on you" means

**AUTHORITATIVE about the action-authorization store — never about Command.** It answers exactly one
question: *what is waiting for a human decision in this organization?*

It routes to the act and never offers it. There is no approve, reject, revoke or consume control on
this surface, and the copy states the boundary plainly:

> Authorizing, refusing or revoking happens on Decisions, under Governance authority. Command
> neither holds that authority nor checks it.

That sentence is precise on both halves. Reading the queue needs a **tenant**. Authorizing needs
**Governance**, resolved server-side at `/approvals` from `decision_records.bootstrap` — and this
repository has already proved a signed-in member can read a queue they are not the authority for.
Command therefore does not claim the authority *and does not check it either*; checking would be a
second, weaker opinion about a question `/approvals` already answers correctly.

## 8. Successful-empty is not unavailable

`WaitingOnYouState` is a discriminated union with three members, mirroring the seam:

| state | rendering | claim |
|---|---|---|
| `waiting` | the bounded list + `N shown` | these are pending now |
| `none-waiting` | `empty` StateBlock — "Nothing is waiting for a human decision" | the store **answered**, and holds nothing |
| `unavailable` | `unavailable` StateBlock — "Hebun could not read your authorization queue" + the seam's own `reason` | Hebun **does not know** whether anything is waiting |

`none-waiting` is its own member rather than `items: []` so that no consumer can render an empty
list and an unanswered read through the same branch by accident. There is deliberately **no shape**
in which `items` and a failure reason coexist, and **no shape** in which a count exists without a
successful read.

`tests/cmdb1-command-overview/canonical-overview.ts` asserts this by **rendering** all three states
in a bare Node harness and comparing the visible sentences — the property is about what a reader
meets, not about what the tree contains.

**The current tenant has 0 rows in `heby_action_requests`.** The authenticated surface is therefore
in `none-waiting`: a successful empty, never a zero over a withheld read.

## 9. A bounded list is not an organizational total

`readPendingActionRequests` caps at **50**. R6B's lesson is that a seam's *bound* is part of its
meaning: a count over a capped list is a lower bound, not a total.

So the count badge reads **`N shown`** — never "N pending", never "N total" — and when the read comes
back full the surface says so:

> This read is bounded at 50 and came back full, so there may be more than is shown here. Decisions
> holds the queue.

`PENDING_READ_BOUND = 50` is exported and asserted, not repeated as a literal in prose.

## 10. Read permission is not Governance authority

Stated once more because it is the single most reusable line in this phase: **the tenant predicate
gates the read; `decision_records.bootstrap` gates the act.** They are different gates with
different subjects. A surface that can show you the queue has told you nothing about whether you may
empty it, and CMD-B1 does not pretend otherwise in either direction — it neither hides the queue
from a non-authority nor implies the reader may act on it.

## 11. Express Intent — source, and what is derived

Source: the **declared action registry** (`listActionTools()` / `invokableActionTools()`).
Provenance: **derived**. Every number is computed at read time; nothing is a literal.

At release: **8 declared · 2 invokable now · 1 consequential action with a substrate.**

R3B had to repair a hard-coded `false` about this same registry when an execution substrate shipped.
Nothing here is hard-coded, so that drift cannot happen twice.

The five states the surface refuses to collapse, printed where a reader meets them:

> Declared is not invokable. Invokable is not authorized. Authorized is not executed. Executed is not
> successful. Free text never reaches execution: every argument is typed and every consequential act
> is gated to a human on Decisions.

`freeTextReachesExecution` is typed as the literal `false` — a field that cannot be set to `true`
without a type change is a claim a future edit must argue with the compiler about.

## 12. Not Yet Connected — six capabilities, six different reasons

The reasons are deliberately **not interchangeable**. Collapsing them into one grey sentence would be
the same class of defect as collapsing empty into unavailable.

| capability | reason class |
|---|---|
| Attention across all sources | no unified source exists; each origin would need its own tenant-scoped read first |
| Executive briefings | a **contract** exists, a **runtime** does not — nothing has ever been assembled |
| Operating state | no tenant-scoped seam exists anywhere; the one executive read is platform-scoped and tenant-blind |
| Organization health | no domain reports an operating state, and technical runtime health is not organizational health |
| Reports | no engine, no definition store, no export runtime, no past instance |
| Strategic goals | the only source is a compiled-in **seed**, withheld from a real tenant by CMD-0 |

None is shown as an empty result, a zero, or a placeholder figure — because Hebun does not know these
facts, and "unknown" is not "none".

## 13. Three canonical sections, and nothing else

1. **Waiting on you** — provenance `authoritative`, detail *"the action authorization store, scoped
   to this tenant"*
2. **Express intent** — provenance `derived`, detail *"counted from the declared action registry"*
3. **Not yet connected** — provenance `not-connected`, detail *"no source is connected for any
   capability listed here"*

`WorkspaceSection` makes `provenance` a **required** field, so a fourth section cannot be added to
this page without answering where its content came from. That is the structural answer to CMD-A's
finding of 0 ProvenanceChip across all eight Command routes: provenance here is not decoration a
future edit can forget, it is a type error.

## 14. The eight-cell matrix is gone

Removed with the eight components in §2. The route no longer imports
`getDirectorDashboardUiModel()`; that adapter and its withholding are untouched and still serve their
other consumers. `/command` renders one `PageHeader` and three sections. No duplicate Command
identity: the route contributes one title, and VI-1's nine-region pin is unchanged and green.

## 15. Authenticated acceptance — TOOLING-BLOCKED in the release session

**Recorded plainly, and not dressed up.**

The authenticated visual acceptance at **1440 / 1024 / 768 / 390** — including the sub-floor-leaf and
clipped-label counts in §16 and §17 — was performed during the **CMD-B1 review pass**, on the same
code that is released here. It was **not re-obtained in the release session**, and no screenshot from
the release session is claimed.

Why: the browser pane available to the release agent is an isolated in-app browser with its own
cookie jar. The Director authenticated successfully against this control plane — `user_session_contexts`
moved 92 → 94 during the session, and the production build correctly `307`s `/command` → `/login`
for an unauthenticated request — but that session lives in the Director's own browser, which the
agent does not drive. The in-app pane's network log contains **no `POST /login` at all**, only
`GET /login → 200`; the session was never present in the browser being measured.

Every substitute was rejected rather than quietly taken:

| substitute | rejected because |
|---|---|
| type the credential into the pane | reading or entering the Director's password is prohibited outright |
| mint a session / copy the session cookie | manufactures the authentication being tested, and writes state |
| run the build with `HEBUN_AUTH_ENABLED` off | weakens authentication to measure a surface behind it |
| `chrome-devtools` MCP | launches its own isolated Chrome (`about:blank`), not the authenticated one |
| render `CommandOverview` in a harness and measure that | **forbidden by G7's recorded lesson** — the shell eats ~270px a harness never sees, so an isolated component render is not visual proof |

**Precedent for the classification.** This repository has a settled habit of recording what could not
be obtained instead of substituting something weaker and calling it the same thing: G6B released with
**3 of 5 capabilities UNAVAILABLE and left that way**; the first durable governance ceremony **STOPPED
at C3** and wrote `C3 BLOCKED — no legitimate capability consumption surface` rather than inventing
one; G5A.1 reported a hanging bite-proof as **VOID**; G7 recorded a geometry change as **"not
attempted"**. The instrument-substitution disclosure is also precedent: APP-1 asserted two of its
three claims at source, with comments stripped, *and said why* the surface could not be rendered.

**Why it is not release-blocking here.** The properties the visual step exists to catch are proved by
instruments that did run in this session, on this exact code:

- the three read states are asserted **by rendering**, against the visible sentence, in the CMD-B1
  suite;
- successful-empty vs unavailable cannot collapse, by type and by assertion (§8);
- the tenant has **0** pending rows, so the authenticated state is `none-waiting` — derived from the
  database, not from a screenshot;
- **429/429** full suite, typecheck clean, lint 0 errors, production build clean;
- the diff is exactly the reviewed CMD-B1 diff — the code measured in review is byte-identical to the
  code released.

**The gap that remains.** No release-session pixel evidence exists for this surface. The cheapest
honest way to close it is for the Director to run the geometry probe in their own authenticated
browser's console and paste the result; that is a follow-up, not a blocker, and it is deliberately
left open rather than papered over.

## 16. Sub-floor leaves: 49 → 0

> *This section's figure was recorded before the authenticated acceptance gate ran. It is
> corrected by Addendum A at the end of this document: the measured result is 49 → 1. The
> sentence below is retained as written.*

Measured authenticated during the CMD-B1 review pass (see §15 for provenance and for what was not
re-obtained).

CMD-0 recorded that authenticated `/command` carried **49** text leaves below the 12px floor — up
from 30 measured in the demo shell, because "Unavailable" is a wider status word than "Healthy" and
every truncated label loses. The canonical Overview uses `text-body` and `text-meta` only, both above
the floor, and the eight components that carried the sub-floor type are gone. **49 → 0.**

## 17. Clipped labels: 8/8 → 0

Same provenance as §16. CMD-0 measured **8 of 8** labels clipped on authenticated `/command`. Every
region that produced them is retired. The replacement wraps rather than truncates — `min-w-0` on each
flex column, `flex-wrap` on the item header row — so **8/8 → 0**, and zero horizontal overflow.

## 18. Schema, runtime, authority, rows — all zero

| dimension | change |
|---|---|
| schema | none — no migration, ledger untouched |
| migration ledger | unchanged |
| runtime / provider / Computer Use | none |
| authority | **none** — no resolver, no writer, no Governance read, no new permission |
| server actions | none added |
| read seams | none added; one reused unchanged |
| repositories / persistence | none added |
| organizational rows written | **0** |

Row counts before and after the release session are identical on every table except
`user_session_contexts` (92 → 94), which moved because the Director signed in — not because Command
wrote anything. Command has no writer to write with.

Unchanged and verified: canonical Knowledge, Heby, shared UI primitives (`state-block`,
`workspace-section`), the shell, and Command L2 navigation.

## 19. The APP-1 seam-importer amendment, and why the invariant survives

`tests/app1-decisions-truth/stale-claims.ts` pins the exact set of files permitted to import
`readPendingActionRequests` / `readActionPermits`. CMD-B1 adds a third route:

```
  "src/app/(dashboard)/approvals/page.tsx",
  "src/app/(dashboard)/heby/page.tsx",
+ "src/app/(dashboard)/command/page.tsx",
  "src/features/action-authorization/read-action-authorizations.server.ts",
```

**This is not a weakened firewall.** The pin has never meant *"only two surfaces may read"*. Its
stated property is:

- **one legitimate reader per surface**
- **no duplicated queue**
- **no second source of truth**

All three still hold. `/command` is an architecture-approved **non-owning consumer** of the same seam,
consuming it the same way `/heby` does — tenant resolved once at its own route boundary, seam taken
unchanged, nothing persisted, nothing cached. What the pin still forbids is exactly what it always
forbade: a **component, model or feature module** acquiring its own reader. `command-overview.tsx`
and `workspace-model.ts` import the seam **type-only**; neither can call it.

The count changed because a surface was added. The invariant is per-surface, and no surface gained a
second reader.

## 20. HealthCell remains dead, and was intentionally not swept

`HealthCell` is exported from `src/components/command-center/command-region.tsx` and rendered by
**zero** files in `src/`. It was dead before CMD-B1 and is dead after.

Not swept, on purpose: `command-region.tsx` is one of VI-1's nine tracked regions and is imported by
Operations and Platform, so touching that file to remove one unused export would put a released
visual pin at risk for no behavioural gain. The CMD-B1 suite **pins the deadness** instead — a
zero-renderer assertion with a bite-proof that adds a fake renderer and watches it fail — so the
component cannot quietly come back through a side door. Removing it is a cleanup phase, not this one.

## 21. Operating State remains a separate architecture problem

Listed in §12 as not-connected with its real reason: **no tenant-scoped operating-state seam exists
anywhere in this system.** The one executive read that does exist is platform-scoped and tenant-blind,
so it cannot answer for an organization at all.

That is an architecture gap, not a presentation gap, and CMD-B1 deliberately does not narrow it. The
honest move available today was to name it and say why; building the seam is its own phase with its
own authority question (who may answer for an organization's operating state, and from what).

## 22. Command L2 is still eight destinations — deferred to CMD-B2

Unchanged by this phase:

```
/command  /command/inbox  /command/briefings  /approvals
/director/goals  /director/organization-health  /director/reports  /command/intent
```

Eight destinations, of which the Overview can now honestly answer for exactly one and routes to two
more. The other five are the §12 capabilities with no source. `tests/command-l2/*` is green and
untouched.

Reconciling the L2 with what the system can prove — which destinations survive, which merge, which
become disclosures rather than routes — is **CMD-B2**, and was not attempted here. Changing the L2 in
the same phase that changed the L1 would have made the visual regression surface impossible to
attribute.

## 23. CMD-B2 entry condition is satisfied

CMD-B2 required a canonical L1 to reconcile the L2 against. It now exists: `/command` resolves a real
tenant, performs one real read, states its provenance per section, and discloses every capability it
cannot answer with the actual reason. The L2 audit can proceed against a surface that is true.

---

## Verification at release

| check | result |
|---|---|
| full suite | **429 passed, 0 failed, 429 total** |
| bounded suites | CMD-B1, command-l2, director-command, APP-0, APP-1, CMD-0, VI-1, VI-2, typography, Heby ×5, director-truth-surface — **58/58 PASS** |
| typecheck | clean |
| lint | **0 errors** (14 pre-existing warnings, none in a CMD-B1 file) |
| build | clean; `/command` dynamic |
| `git diff --check` | clean |
| secret scan | 0 hits across the five touched files |
| authenticated visual re-proof | **TOOLING-BLOCKED — see §15** |

---

## Addendum A — 2026-08-21 · §16 corrected by authenticated measurement

**Recorded rather than glossed, and the original is retained.**

§16 reports **49 → 0** sub-floor text leaves on authenticated `/command`. That figure was written
while the authenticated re-proof was TOOLING-BLOCKED (§15), from the CMD-B1 review pass.

The Command authenticated visual acceptance gate later measured the released product in the
Director's own signed-in browser, at 1440×900, 1024×768, 768×1024 and 390×844. The measured result
is:

**49 → 1.**

The surviving leaf is the **rail Heby launcher label at 9.6px** — `text-[0.6rem]` in
`src/components/layout/heby/heby-launcher.tsx:53`. It is **shell-owned, not Command content**: it
renders on every route in the product, and it is absent at 390×844 where the rail is not rendered
at all, which is how it was identified.

Why nothing caught it: the typography contract governs the **named** scale — `--fs-label` is the
12px floor and every semantic step is asserted against it — and an arbitrary Tailwind value declares
no step. `text-[0.6rem]` was invisible to every assertion in that suite.

**CMD-V2 repairs it** and closes the class: the label is written at the shell floor, and the
typography contract gains a guard over the persistent chrome — the nine components `HebunShell`
mounts on every route — asserting that no arbitrary font size there falls below `--fs-label`, with
the floor read from the token rather than restated.

§16's own sentence stands as written. Command's content was, and remains, free of sub-floor text;
what the "0" missed was the shell it renders inside.
