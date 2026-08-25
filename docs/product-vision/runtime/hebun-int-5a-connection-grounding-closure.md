# INT-5A — Connection Grounding: Release Closure

**Status:** engineering/release record. Not runtime state, not an authority.
**Released implementation:** `5514757f0fc7d738617e58201b6a90ca0ac0a574`.
**Parent:** `286d921899e142be1d2f0ecabaec0895838ce67e`.
**Baseline of this record:** `5514757f0fc7d738617e58201b6a90ca0ac0a574` (`origin/main`, 0 ahead / 0 behind).
**Production deployment:** `dpl_8zBie6uo7MipQzzEd81VLr7ZHrto` — production, Ready, aliased at
`www.hebuntech.com` and `hebuntech.com`.
**Predecessors:** `hebun-github-4-repository-activity-closure.md`;
`hebun-i1-closure-membership-authority.md`. The Google half (INT-3, INT-4) carries no closure
document — it is recorded by the tags `int-3-google-integration-complete` and
`int-4-google-drive-metadata-read` only, which is why those phases are cited by tag here rather
than by path.
**Consumes:** the I1 capability-availability read seam, unchanged.

---

## 1. Released implementation identity

Hebun had accepted three provider integrations and made its model live, and the two had never met.
Google Workspace and GitHub connection state rendered only on pages; Heby's ten source classes
contained no integration class, so a live Claude reasoned about the organization while blind to the
systems that organization had actually connected. The Platform workspace had asked *"Is this
integration or dependency available? What capability does this provider offer?"* since Phase 15 with
nothing able to answer it.

**Scope: 14 files, +1510 / −185.** Five new, nine modified.

| File | What it is |
|---|---|
| `integration-authority/integration-read.server.ts` | **new** — the writer-free half of the integration authority |
| `integration-authority/heby-integration-source.server.ts` | **new** — the authority's own read projection, shaped for Heby grounding |
| `integration-authority/capability-availability.server.ts` | imports the writer-free module; stale I1 prose corrected (§7) |
| `integration-authority/integration-repository.server.ts` | reads excised and re-exported; writers untouched |
| `heby-integration/contracts.ts` | `integrations` added to the closed source-class vocabulary |
| `heby-integration/workspace-registry.ts` | Platform declares the class — and only Platform |
| `heby-runtime/source-resolver.ts` | the pure resolver's honest `unavailable` for the class |
| `heby-answer/model-answer.server.ts` | the `withIntegrations` substitution seam |
| `tests/int5a-flow/{connection-grounding, grounding-firewall, bite-proofs}.ts` | **new** — the phase's own suites |
| `tests/heby-integration/contracts.ts` | released-pin repair — source-class list ten → eleven |
| `tests/i1-connection-authority/{bite-proofs, boundaries-and-firewall}.ts` | released-pin repairs (§8) |

**No new architecture was invented.** The class joins through the seam K1, R3W, R3R and G6C already
established: the pure resolver holds no tenant and reports the honest unavailable; the server answer
flow substitutes a real tenant-scoped read. This is the fifth instance of that arrangement,
deliberately, rather than a sixth pattern.

---

## 2. Authority boundaries

Nothing in this phase became an authority. The grounding passes **through** the existing ones.

| Authority | Owns | May decide | May execute |
|---|---|---|---|
| `integrations` table | connection lifecycle | — | — |
| `capability-availability.server.ts` | the normalized "can this be answered now" | nothing | nothing |
| `heby-integration-source.server.ts` (new) | translation into `SourceResolution` | nothing | nothing |
| Heby answer flow | which classes a workspace reasons over | nothing | nothing |

`getCapabilityAvailability` was written at I1 as *"the one normalized read seam"* and had **zero
production consumers** for two phases. INT-5A is its first. No second capability interpreter exists.

---

## 3. The read/write split — a security boundary, not cleanup

The seam could not be consumed as it stood. It read connections through
`integration-repository.server.ts`, which also exports **seven** lifecycle writers —
`createConnection`, `disconnectConnection`, `attachCredentialToConnectionWithin`,
`holdConnectionForProviderRefreshWithin`, `recordVerifiedConnectionWithin`,
`recordUnverifiedProviderGrantWithin`, `recordVerificationFailureWithin` — plus the lifecycle audit
writer. A Heby module importing that seam would have held a reference into a module that can create
a connection, attach a credential to one, and end one, and no reviewer should have to check which
symbol was taken.

Measured, before and after:

```
BEFORE  seam graph 63 modules → WRITE: integration-repository.server.ts
                                WRITE: integration-lifecycle-audit.server.ts
AFTER   seam graph 62 modules → CLEAN (no fetch, no writer outside schema definitions)
```

G6C settled the remedy for exactly this shape and INT-5A applied it unchanged: stop the read/write
mixing at the module boundary. The reads moved **verbatim** and are re-exported, so all five existing
callers — two API routes, three pages, the GitHub authorized-call seam and the verifier — import
exactly what they imported before. There is still **one** `listConnections` in this repository.

---

## 4. The zero-provider-I/O invariant

This is the invariant a future phase must not break silently.

Measured on the released tree by walking the real import graph:

| Reach | Grounding subgraph (124 modules) | Heby answer graph (601 modules) |
|---|---|---|
| Google / GitHub transport | NONE | NONE |
| provider-record readers | NONE | NONE |
| network-capable modules | NONE | `claude-http-transport.server.ts` **only** |
| integration repository | NONE (unreachable) | NONE (unreachable) |
| credential accessors | NONE | NONE |
| db writers | NONE | pre-existing only; zero integration writers |

Only `provider-google/contracts.ts` and `provider-github/contracts.ts` enter the graph — pure
capability keys and scope constants, via the catalog. Zero network, zero writes.

**A Heby answer therefore cannot contact Google or GitHub, cannot re-verify a connection, cannot
spend a provider rate limit, and cannot read a provider record.** `tests/int5a-flow/grounding-firewall.ts`
proves it structurally and cannot be satisfied by renaming a file.

**One finding worth carrying forward.** The firewall's network detector was originally
`fetch\s*\(`, and this phase's own bite-proof M9 exposed it: `google-transport.server.ts` never
writes that — it writes `const doFetch = deps.fetchImpl ?? fetch;` and calls `doFetch(...)`. The
call-shaped pattern reported the single most network-capable module in the provider stack as inert.
The detector now tests the `fetch` **identity** with lookarounds excluding `doFetch`/`fetchImpl`/
`FetchLike`. "Exactly one network module in Heby's graph" is therefore now measured under a
**strictly stronger** test than before this phase.

---

## 5. What the source says, and what it structurally cannot say

One item per capability, identity joined from keys already owned elsewhere:

```
recordRef   github-organization/github.repository.activity.read
detail      state available · read available · write capability absent ·
            account Hebun-AI · last verified 2026-08-24T16:47:15.300Z
lifecycle   settled          (available only; revoked → retired; every other state → unknown)
```

`authoritative: false` on **every** arm — capability state is derived on each read from the
lifecycle, the last observed health and the granted scopes. It is a statement about what Hebun can
presently do, never organizational truth, and nothing here may be promoted into Knowledge.

**It is a capability state, never a provider record.** No Drive file, no repository, no pull
request, no provider payload. `"Drive metadata can currently be read"` is what this source says;
`"here is a Drive file"` is INT-5B and does not exist.

The integrations row UUID is deliberately **not** the public identity: a capability may be offered
by several connections, and a database id is not a stable identity for a fact about what can be read.

Write capability is **always stated** (`present` / `absent`) rather than omitted, because a silent
omission reads to a model as "unknown, therefore maybe" — and is never worded as permission.

---

## 6. Fail-closed semantics

| Condition | Result |
|---|---|
| no tenant | `unavailable` · `noTenant` |
| no connectable provider in the build | `unavailable` · `noConnectableProvider` |
| no declared capability | `unavailable` · `noCapability` |
| tenant connected nothing | **resolved**, items `state not-connected` — a real, grounded answer |
| degraded / unknown health | `degraded`, the seam's reason carried verbatim |
| seam throws | degrades to the pure resolution; never fabricates, never removes other evidence |

No failure path mutates `connection_state`, triggers verification, or contacts a provider.

---

## 7. The stale-comment correction

`capability-availability.server.ts` stated *"the RELEASED catalog contains zero `connectable`
providers"*. That was true at I1 and had been left behind by two phases: INT-3 built the Google
verifier and INT-4 its Drive-metadata capability; GITHUB-2 built the GitHub verifier and GITHUB-4 its
repository-activity capability. The catalog now holds **two** connectable definitions.

The paragraph was corrected **because repository truth proved it false**, and the mechanism was not
weakened to match: `available` still has exactly one spelling — connected, healthy, covering — and
the repository still cannot manufacture `connected`.

---

## 8. Released-pin repairs

Two released pins were repaired rather than weakened, each stating what arrived:

1. `tests/heby-integration/contracts.ts` — the pinned source-class list moved ten → eleven, naming
   `integrations` and why it earns the review.
2. `tests/i1-connection-authority/boundaries-and-firewall.ts` — "exactly ONE module may import the
   integrations table" became **exactly two, and both inside the authority**, with an added
   assertion that every importer lives under `integration-authority/`. The property is unchanged and
   still exact.
3. `tests/i1-connection-authority/bite-proofs.ts` — M1 (tenant predicate deleted) was **retargeted**
   onto the relocated predicate in the read module, which is a strictly better target: the predicate
   is now the one expression both halves of the authority compose with. Its replacement was also
   made self-contained, because the old ``sql`true` `` needed an import the writer-free module does
   not have and made the mutated file throw for the wrong reason.

---

## 9. Validation evidence

| Check | Result |
|---|---|
| `tests/int5a-flow/connection-grounding.ts` | PASS |
| `tests/int5a-flow/grounding-firewall.ts` | PASS |
| `tests/int5a-flow/bite-proofs.ts` | **10 mutations bit, 0 survivors** |
| `tests/i1-connection-authority/bite-proofs.ts` | **12 bit, 1 behaviour-preserving change accepted** |
| `npm run typecheck` | clean |
| `npx eslint src tests` | 0 errors; 14 pre-existing warnings, **0 in INT-5A files** |
| full suite | **477 passed / 1 failed / 478 total** |

The sole failure is **INT-3 M9** (`an identity without \`sub\` is accepted`) — pre-existing,
unrelated, and proved non-overlapping: it mutates `provider-google/google-transport.server.ts` and
runs `tests/int3-google-connection/google-transport.ts`, neither touched by this phase. Not repaired.

**Two mutations initially survived, and both changed the work rather than the assertion.**

- A row-level tenant mutation survived against the firewall, because a firewall checks shape, not
  rows. It was removed as a duplicate of the released i1 M1, with the pointer documented in place.
- **M11 survived because deleting the `withIntegrations` call while leaving its import in place keeps
  the module reachable.** An import-graph firewall proves *reachability*, never *invocation*. That
  forced a behavioural wiring proof which drives the real `answerHebyModelRequest` on `/platform` and
  asserts the capability reaches the composed grounding context. This is the general lesson: a
  structural firewall cannot defend a wiring call.

---

## 10. Production acceptance

**Operator-observed, through the Platform workspace, on the released deployment.**

| | GitHub Organization | Google Workspace |
|---|---|---|
| capability | `github.repository.activity.read` | `google.drive.metadata.read` |
| state | Available | Available |
| access | Read available · Write capability absent | Read available · Write capability absent |
| account | `Hebun-AI` | `hebuntech@gmail.com` |
| last verified | `2026-08-24T16:47:15.300Z` | `2026-08-24T06:28:38.885Z` |
| evidence | `[integrations/github-organization/github.repository.activity.read]` | `[integrations/google-workspace/google.drive.metadata.read]` |

The answer additionally stated that provenance is non-authoritative, that capability state is derived
from locally stored connection lifecycle, that no provider records were supplied, that neither GitHub
nor Google was contacted for the answer, that current provider-side connectivity was not re-verified,
and that no write capability was claimed.

**Why these identities are strong evidence the resolver produced them.** They match the released
constants exactly — `GITHUB_PROVIDER_KEY = "github-organization"`,
`GITHUB_REPOSITORY_ACTIVITY_CAPABILITY = "github.repository.activity.read"`,
`GOOGLE_PROVIDER_KEY = "google-workspace"`,
`GOOGLE_DRIVE_METADATA_CAPABILITY = "google.drive.metadata.read"`. The pre-acceptance prediction
written into the ceremony brief used the readable short forms (`github/repository-activity`,
`google-workspace/drive.metadata`) taken from catalog prose. A model inventing plausible identities
would far more likely have produced those short forms than the exact released constant strings. The
detail line also matches `detailFor` field-for-field and in order.

**What this does NOT prove, stated so it cannot drift.**

- `Available` is a **locally derived** state: connected + healthy + covering scopes, read from the
  control plane. It is **not** evidence that a provider call succeeded during this turn.
- The `last verified` timestamps are **2026-08-24**, the day before the acceptance. Verification
  happened in an earlier phase, **not during this Heby turn**.
- No provider record was read, and none is available.

---

## 11. The earlier wrong-route attempt — preserved, not erased

The first acceptance prompt was sent through `https://www.hebuntech.com/heby` with no workspace hint.
Executing the released chain:

```
?from=undefined   route=/heby       workspace=command   sources=[intelligence, operations, decision-records]
?from=platform    route=/platform   workspace=platform  sources=[platform, integrations]
/platform panel   route=/platform   workspace=platform  sources=[platform, integrations]
```

`panel-model.ts` maps `/heby` to `command` **explicitly, by HW1 design** — not by fallthrough — and
`command` does not declare `integrations`. `withIntegrations` guards on the class being present, so
it short-circuited and `getCapabilityAvailability` was never called.

The observed answer named all six `OPERATIONS_SECTIONS` (`active-agents`, `active-workflows`,
`monitoring-summary`, `diagnostics-summary`, `evaluation-summary`, `runtime-status`) plus
"Intelligence candidates not connected" and "Decision records retrieval not connected" — precisely
and only `command` = `[intelligence, operations, decision-records]`. Had it run on Platform it would
have shown `platform-status` and `authentication-summary`; it showed neither.

**This was a procedural wrong-route acceptance failure, not an INT-5A runtime defect. No code repair
was required and none was made.** The correctly routed Platform acceptance supersedes it for
acceptance purposes and does not erase it historically.

`command` was deliberately **not** widened to compensate. Its declared capabilities are
intelligence-analysis, operational-inspection, decision-preparation and evidence-tracing — not
platform inspection — and `platform`'s own `mayExplain` already owns this question. Whether the
General Hebun workspace should reach integration capability state is a legitimate product question
for a later gate, recorded here and not acted on.

---

## 12. Final capability truth ledger

```
DESIGNED                        YES
IMPLEMENTED                     YES
CONFIGURED                      YES   two connectable catalog definitions, both verifiers released
CONNECTED                       YES   locally recorded, per capability (§10) — NOT re-verified live
VERIFIED                        YES as of 2026-08-24 timestamps — NOT during the acceptance turn
CAPABILITY_AVAILABLE            YES   locally derived: connected + healthy + covering scopes
GROUNDED                        YES
MODEL_VISIBLE                   YES   as DATA; citable only from resolver-produced identities
RELEASED                        YES   5514757f0fc7d738617e58201b6a90ca0ac0a574
DEPLOYED                        YES   dpl_8zBie6uo7MipQzzEd81VLr7ZHrto
PRODUCTION_ACCEPTANCE           PASSED
PROVIDER_READ_EXECUTED          NO
PROVIDER_RECORD_AVAILABLE       NO
WRITE_CAPABILITY_INTRODUCED     NO
EXECUTION_AUTHORITY_INTRODUCED  NO
SUCCESSFUL                      YES
CLOSED                          YES
```

`CONNECTED` / `VERIFIED` / `CAPABILITY_AVAILABLE` are **locally recorded control-plane truth**, not
fresh provider-side verification. The two are not collapsed anywhere in this record.

---

## 13. Remaining limitations

1. **No provider record is readable.** `"Drive metadata can be read"` is the claim; the contents are
   not. That is INT-5B and is not opened by this record.
2. **Capability state can be stale.** A grant revoked provider-side after the last verification would
   still read `available` until something verifies again. A Heby answer never verifies, by design.
3. **The production control plane was never read directly during this phase.** `platform:preflight`
   refuses non-local targets in local posture, and ad-hoc production queries were blocked by the
   harness. Every production fact in §10 is operator-observed through the UI.
4. **The deployed commit SHA was never read from Vercel.** No available tooling exposes
   `meta.githubCommitSha` for this project scope. Correspondence rests on the `git-main` alias plus
   timing (deployment 61 s after the commit; prior production deployment 69 min earlier) — inference,
   labelled as such.
5. **The General Hebun workspace cannot answer "which systems are connected?"** (§11) — recorded, not
   a defect.
6. **INT-3 M9** — unrelated pre-existing debt in a Google suite, untouched.

---

## 14. Closure boundary

**INT-5A is COMPLETE for its declared meaning: Heby grounds answers in the tenant's integration
capability state, read from the control plane, with zero provider I/O.**

**This does NOT mean Heby can read connected systems.** It knows *what can be read*; it has never
read it. Provider records, request-time provider reads, freshness, caching and write capability are
all outside this closure and outside this phase's declared meaning.

**No INT-5B is opened by this record.** That phase must begin with architecture discovery and decide,
before any implementation, whether live request-time provider reads belong in Heby's request path at
all — and if so, under what read budgets, latency ceilings, timeout and failure isolation, rate
limits, freshness semantics, caching-versus-persistence choice, record provenance, tenant isolation,
credential reach and provider scope. Live request-time reads must not be assumed correct.
