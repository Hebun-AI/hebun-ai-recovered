# Hebun AI — Learnings (append-only)

## Phase 23D — Governance legacy + authority closure (2026-08-09)
- Legacy route retirement pattern: replace mock page with `export default function X(): never { permanentRedirect("/canonical") }`. Single-hop, loop/chain-free. Keep the route in `sidebar.config.staticRoutes` so the concrete redirect file wins over the `[...slug]` catch-all placeholder.
- A route with a real `page.tsx` (even a redirect stub) is always served by Next over the catch-all — placeholder shadowing only affects routes with NO concrete file.
- `sidebar.config.sidebarConfig` (moduleIndex) has no value-consumer component — it only feeds `resolveModulePath`/`placeholderPaths`. The live nav is `workspace-nav.ts` (WORKSPACES). So stale moduleIndex labels don't render; don't waste a cleanup pass on them.
- Governance mock `@/features/governance` is LOAD-BEARING (real `features/policy/*` engine + `features/organizational-intelligence/*` + dashboard governance-widget derive from it). Authoritative surfaces dropping their direct import does NOT make it dead. Retain; prove retention with an engine-importer assertion in the closure test.
- Permission "matrix" (role→capability) in a governance context = policy/rule applicability, not IAM and not human authority → folds into Policies & Rules, not a standalone Permissions surface.
- Old-roadmap tags (`phase-NN-complete`) coexist with my `hebun-ui-phase-*` convention; a `phase-23-complete` ancestor tag is NOT my phase and is not a STOP condition — check tag naming + whether it's an ancestor of HEAD before reacting.

### Haftalık 3 soru
1. **What did we learn?** Retirement = redirect + retain load-bearing mock + prove it; never delete a mock just because the new authoritative surface stopped importing it.
2. **How does this improve Turkish Rug House?** A governance console that redirects legacy fakes to honest surfaces means TRH operators never act on invented compliance/risk/approval numbers — the record shows only what the engine can structurally prove.
3. **How does this become part of Hebun AI?** The redirect-and-retain closure pattern + the load-bearing-vs-dead classification is now the reusable playbook for closing every remaining workspace's legacy tail without breaking cross-system consumers.

## R1 — Durable Foundations (2026-08-10, implementation, not yet published)
- The dormant `SupabasePostgresAdapter` is a REAL local-first pg adapter (LOCAL_HOSTS guard refuses non-local unless `HEBUN_PERSISTENCE_POSTGRES_ALLOW_REMOTE=true`), enforces `tenant_id` UUID on every op, and supports `registries/knowledge-nodes/agents/workflows/memories` — NOT identity tables. Durable auth needs its own drizzle control-plane client (`@/db/client.server`), which is the same schema/driver/migrations, not a second framework.
- The `auth` feature is guarded (`tests/authentication-foundation/boundaries.ts`) to stay a pure contract layer: NO pg/drizzle import, NO `process.env` outside its env module. R1 wiring that touches Postgres/cookies must live in a sibling `auth-runtime` feature (repo convention: `X` = contracts, `X-runtime` = wiring). Dashboard surfaces are guarded (`runtime-projection/boundaries.ts`) against importing `*-crud` — re-export the record type from the slice feature instead of importing `registry-crud`.
- Auth is provider-neutral by schema: `auth_identities.provider` is a varchar (`'local'` valid), and session verification is a server-side HMAC digest (`user_session_contexts.provider_session_reference_hash`, char(64)) — so real, enforced auth needs NO Supabase network. Gate enforcement on `HEBUN_AUTH_ENABLED`: disabled = honest pre-auth (unchanged app, build/tests unaffected); configured = fail closed.
- Durable proof ran against an isolated throwaway pg (Homebrew 14 on :55432, data in scratchpad) — never the shared EDB/18 on :5432. The existing `tests/helpers/disposable-postgres` harness (creates/migrates/drops a fresh DB on :5432) is the template for R1 integration tests.

### Haftalık 3 soru
1. **What did we learn?** The first real slice of Hebun is provable end-to-end without any provider or external service: authenticated local identity → durable HMAC session → server-resolved tenant → tenant-scoped durable registry in local Postgres, tenant-isolated, no silent memory fallback. Contracts were already there; R1 wired them.
2. **How does this improve Turkish Rug House?** TRH data can now have a real home: a TRH operator would sign in, resolve to the TRH tenant server-side, and read/write durable records that survive restart and never leak to another tenant — the precondition for trusting anything Hebun stores about the business.
3. **How does this become part of Hebun AI?** R1 establishes the identity/data/service boundary every later phase depends on (R2 provider, R3 execution, R4 onboarding). The contract-vs-runtime split (`auth`/`auth-runtime`), fail-closed durable repos, and local-throwaway-pg proof are the reusable substrate for making the rest real.

## R2D — Live Claude connectivity gate (2026-08-10, one authorized smoke, NOT published)
- **Cached model-id strings are not proof of live validity.** The `claude-api` skill table lists `claude-haiku-4-5` (no date suffix) as current; the live Anthropic API rejected it (HTTP 4xx → typed `invalid-configuration`). The environment's own model list states Haiku 4.5 = `claude-haiku-4-5-20251001`, and it names `claude-opus-4-8` as "the exact model ID". For a one-shot live call, trust the env's stated exact id over a cached skill string — or you burn the single authorized attempt on a config typo.
- **A redacted 4xx still carries signal.** `invalid-configuration` (400/404/422) is NOT `authentication-failed` (401/403): getting a config error means the credential authenticated and the transport reached Anthropic. `447ms` wall latency distinguishes a real round trip from a sub-ms local budget reject. You can prove "auth + reachability" even when the model id is wrong — without ever seeing the raw response.
- **One-attempt discipline held under temptation.** The fix (correct model id) was obvious after the failure, but the authorization was for ONE call; silently rewriting config and re-sending would have violated it. Stop, report, require fresh authorization. The double-gate (`HEBUN_MODEL_TRANSPORT=live` + `HEBUN_MODEL_LIVE_CALL_AUTHORIZED=true` + key) + `MAX_LIVE_CALLS=1` + pre-I/O budget checks did exactly their job.
- **The prepared transport is honest under real fire:** key never left the header (`.next` and git both clean of `sk-ant-`), no persistence (before/after conv=1/msg=2 unchanged — smoke path imports no repo), no retry, no execution/tools. Verified from disk, not assumed.

### Haftalık 3 soru
1. **What did we learn?** Hebun's server-side transport genuinely reaches Anthropic and its credential authenticates — connectivity at the transport+auth layer is real, proven by one controlled request. What is NOT yet proven is a *validated* response, because the configured model id was rejected. "Reached and authenticated" ≠ "connected".
2. **How does this improve Turkish Rug House?** It moves Hebun one concrete, verified step toward answering real TRH questions with a live model instead of a simulation — while proving the safety rails (budget, no-persistence, no-leak, one-attempt) hold under a real network call, so the first TRH-facing live answer won't spend or leak uncontrolled.
3. **How does this become part of Hebun AI?** The live-gate ritual — re-prove from disk, double-gate + hard budget, one attempt, redacted typed failure, before/after persistence + secret audit, spent-authorization stop — is the reusable procedure for every future provider activation (OpenAI, R3 execution, Computer Use). Truth-before-progress is now an executed pattern, not just a doctrine.

## R2D — Live failure diagnostic: root cause = Anthropic credit balance (2026-08-10)
- **The two `invalid-configuration` failures were a billing wall, not a model-id or code bug.** Raw provider response (captured via diagnostic): `HTTP 400 / invalid_request_error / "Your credit balance is too low to access the Anthropic API."` The key authenticates (never 401); Anthropic checks billing and returns 400, which `mapStatus` folds into `invalid-configuration`. Model id `claude-haiku-4-5-20251001` was correct all along.
- **Diagnose a redacted provider error by OBSERVING at the injected seam, never by weakening production redaction.** The live transport takes an injectable `fetchImpl`; a throwaway diagnostic wrapped the real fetch, captured `status`+`error.type`+`error.message`, and replayed the body so the real transport+validator still ran. Production `mapStatus`/redaction untouched. Sanitized output only (status/type/message/request-id) — never the key or raw payload.
- **A safe redaction boundary can hide the ONE fact you need.** Folding 400/401/404/429 into coarse typed codes is right for production safety, but during diagnosis it erased "billing" vs "model" vs "auth". The injectable-fetch seam is what let ground truth through without loosening the boundary.

### Haftalık 3 soru
1. **What did we learn?** Hebun's live Claude path — transport, auth, model id, validation, and every safety rail — is proven correct end to end; the only thing blocking a real answer is that the Anthropic account has no credit. "Broken integration" was actually "unfunded account".
2. **How does this improve Turkish Rug House?** The moment the Anthropic account is funded, Hebun can give a real, validated model answer to a TRH question with no code change — the technical path is done and proven, so the first live TRH answer is one billing action away.
3. **How does this become part of Hebun AI?** The observe-at-the-seam diagnostic (reuse the real transport, wrap the injected fetch, sanitize output, delete after) is the reusable playbook for every future provider's opaque failures — get provider ground truth without ever weakening the production trust boundary.

## R2D — LIVE GATE PASSED (2026-08-10, after billing funded)
- Same model id that returned 400 while unfunded (`claude-haiku-4-5-20251001`) VALIDATED cleanly once credits were active — confirming the earlier diagnosis (billing, not code) and requiring ZERO code change. The value of the ground-truth diagnostic: it stopped us from "fixing" a non-bug.
- One live call through the real path returned a validated result: `origin:model` assigned only after the R2B validator, Anthropic-supplied usage (in 41 / out 12), real text. Proves transport + auth + model access + validation end-to-end. Still isolated (no persistence, nothing published) — connectivity proven ≠ product connected.

### Haftalık 3 soru
1. **What did we learn?** Hebun's R2 model-connectivity path genuinely works against live Anthropic: a real prompt in, a real validated model answer out, with honest provenance and real token accounting — proven by one controlled call, no fake anywhere in the loop.
2. **How does this improve Turkish Rug House?** TRH can now, in principle, receive a real model-generated answer through Hebun's safe boundary — the last technical unknown (does the live path actually validate a real response?) is closed; what remains is wiring it into the durable authenticated product flow and funding/controls, not proving feasibility.
3. **How does this become part of Hebun AI?** This closes R2 connectivity as PROVEN and defines the next surface, R2E (Provider Operations & Control): the Director-facing place where a provider's configured/enabled/connectivity/last-validation/budget state is shown and controlled — turning a proven capability into an operable, governable one.

## R2E — Provider control surface: durable Director kill-switch (2026-08-10, NOT published)
- **Read the authority before naming it.** The obvious `providers.status` column was the WRONG owner — its `providerStatusEnum` is the execution posture that propagates Mission→Command→Execution (World B). Overloading it would have quietly coupled a model-connectivity toggle to execution. A one-minute schema read prevented a cross-boundary mistake; R2E got its own narrow World-A table instead.
- **A real kill-switch is a server-side READ before dispatch, not a UI toggle.** The switch lives in the product choke point (`answerHebyModelRequest`), reads the durable control fail-closed, and blocks BEFORE `selectModelTransport` — so a hand-crafted client call can't dispatch while OFF. The UI toggle only writes; the enforcement is server-side and provable.
- **Fail-closed by default surfaces hidden couplings — as test failures.** Adding the gate broke 2 existing model-path tests (they now got deterministic). That's the gate WORKING: those tests had to opt into Director-ON. Adapting a test to a new legitimate precondition is not weakening it; deleting the assertion would have been.
- **Keep operational states distinct or you lie by collapse.** directorEnabled ≠ configured ≠ credential-present ≠ connected ≠ last-request-ok. The projection carries all five separately, presence-only for the credential, "not-recorded" where no authoritative evidence exists — no fabricated health/%/cost.

### Haftalık 3 soru
1. **What did we learn?** Hebun can now be operated, not just built: a Director can turn Claude connectivity on/off from inside the product, durably, and the switch genuinely gates the model path server-side — proven end-to-end in the browser with zero Anthropic calls.
2. **How does this improve Turkish Rug House?** A TRH operator gets a real control surface — enable Claude when wanted, disable it instantly (a true kill-switch, not a hidden button), with honest status that never overstates "connected" — the governance precondition for trusting an AI in a real business.
3. **How does this become part of Hebun AI?** R2E establishes the provider-operations pattern (durable control authority + fail-closed server-side gate + role-gated mutation + truthful projection) reusable for every future provider and control (OpenAI, budgets, validation, execution activation). It turns proven capability into governable capability — the bridge from R2 connectivity to operable runtime.

## R2E.1 — Placement cleanup: verify the invariant at the authoritative source (2026-08-10)
- Moved the Claude control from Platform Overview to Providers & Models (reused component + projection + action; Overview kept a read-only summary). Placement is IA, not authority — the durable R2E control stayed the sole kill-switch; a placement test asserts exactly one action/card/table/repo (no duplicate).
- **When a UI check looks contradictory, trust the authoritative store, not the DOM.** The browser body showed a fake model answer while the card said "Disabled" — because the throwaway dev DB had accumulated ON toggles from a prior session AND the panel showed restored conversation history. Reading the DB (`provider_connectivity_controls.director_enabled` + the persisted message `origin`) resolved it cleanly: OFF→`origin=deterministic`, ON→`origin=model`. Whole-body DOM regex is contaminated by neighboring copy + restored history; scope to the element or verify server-side.
- Scoped stale blanket copy ("none is connected/invokable") to the offline execution-descriptor catalog and pointed to the separate Director-controlled model-connectivity path — without touching the descriptor catalog model or its honesty test. World A (model connectivity) ≠ World B (execution providers) stayed explicit.

## H1 — Heby product discovery (2026-08-10, discovery only)
- **Read the contract before assuming a big change.** Heby felt like it needed a "conversation architecture", but `ClaudeTransportRequest.messages` already accepts `role:user|assistant` arrays, the durable store already holds the full transcript, and `listConversationMessages` is a ready tenant-scoped reader. The gap is request ASSEMBLY (the client hardcodes one message), not architecture — H1 is small.
- **"Persisted" ≠ "delivered".** Conversations are durably stored and restored on reload, yet the model receives zero history — so "which one / remind me" is impossible today. Auditing what actually reaches the model (not just what's saved) found the real gap in one grep.
- **History is DATA, not authority.** The correct H1 shape keeps four layers separate (system + bounded recent history + fresh current evidence + current request), never promotes prior assistant text to `evidence`, and re-resolves evidence every turn — so continuity never becomes a hallucination vector.
- R2F was deferred into the EXISTING R2 program artifact (§34), not a new roadmap — one source of truth.

### Haftalık 3 soru
1. **What did we learn?** The first real Heby conversation is a small, well-supported change, not a rebuild: feed bounded recent history to the already-multi-turn-capable transport, keep evidence deterministic and fresh, keep the Director kill-switch and execution firewall intact.
2. **How does this improve Turkish Rug House?** A TRH operator will be able to actually converse with Heby about the business ("which issue first?", "remind me") with grounded, tenant-safe answers — the difference between a one-shot lookup and a usable copilot.
3. **How does this become part of Hebun AI?** H1 defines the bounded-context conversational pattern (history-as-data, evidence-fresh-per-turn, provenance-per-turn, firewall-preserved) that every future Heby capability and agent conversation will reuse — the conversational substrate of the runtime.

## H1A+H1B — bounded multi-turn context (2026-08-10, NOT published)
- **The smallest change was the right change.** Because the transport already accepted `role:user|assistant` arrays and the store already held the transcript, H1 was: add `history` to the neutral request, emit `[...history, current]` in translate, load bounded history fail-closed, add one system clause. No migration, no dep, no transport change, no UI redesign — 277/277.
- **History as DATA, evidence as authority — enforced structurally, not just in the prompt.** Prior assistant text rides in `messages` (role-tagged) and is asserted ABSENT from the evidence/system block; `buildModelResponse` still builds evidence from the deterministic set only, so a model can't launder its own words into authority. The system clause is the belt; the code path is the suspenders.
- **Load history only inside the Director-ON branch.** Keeps the R2E kill-switch exact (OFF ⇒ zero dispatch even mid-thread) and avoids a pointless DB read when disabled. Ordering matters: gate first, then context.
- **Fail-closed to empty memory, never fabricated.** No repo / no id / foreign id / repo throws all yield `[]` — the answer still lands (deterministic or model), and no cross-tenant history can leak because the repo re-checks ownership.
- **Honesty ladder:** persisted ≠ loaded ≠ sent-to-model ≠ understood. The first three are structurally proven with the fake transport; "understood" waits for H1D real Claude — do not claim it early.

### Haftalık 3 soru
1. **What did we learn?** Heby can now carry a real conversation: the second question resolves "which one" from bounded recent history while every factual claim stays grounded in fresh current evidence — proven structurally with a fake transport, no live call.
2. **How does this improve Turkish Rug House?** A TRH operator can hold a multi-turn exchange ("what's wrong in ops?" → "which first?" → "remind me") and trust that Heby's memory is conversational context, never a substitute for the current facts — usable and safe.
3. **How does this become part of Hebun AI?** The bounded-context pattern (history-as-data, evidence-fresh-per-turn, gate-before-context, fail-closed memory, honesty ladder) is the conversational substrate every future Heby capability and agent dialogue reuses.

## H1C — conversational UI (2026-08-10, NOT published)
- **One durable authority, rendered — never a second client transcript.** The thread is `buildTurns(durableMessages, latestResponse)`; the durable server conversation wins after every reload. Optimistic state is a single in-flight bubble, cleared when the durable reload returns. Reload proved order intact, no duplication, no stale optimistic surviving as data.
- **Pure presentational split makes UI testable without a browser.** `heby-conversation.tsx` takes props + callbacks (no router/context hooks) → renderToStaticMarkup asserts threading, provenance, evidence, empty/loading states. `buildTurns`/provenance are pure. The browser proof then covers the wiring the SSR tests can't (real auth, persistence, reload, New Conversation, R2E-OFF).
- **Derive route-scoped state from a key; don't reset it in an effect.** Synchronous setState in a useEffect trips React's cascading-render lint error. Keying the session by route and deriving `empty` on mismatch resets cleanly with zero effect writes; the effect does only the async durable load.
- **New Conversation detaches, never deletes.** It drops the localStorage pointer + clears the view; the durable conversation stays (DB count preserved). Proven in-browser + DB.
- **Provenance is product copy, but truthful copy.** "Model-assisted · test transport (simulated — not live Claude)", "Provider disabled by Director", "Deterministic" — human-readable, never "connected/healthy/online". The kill-switch surfaces as a calm state, not an error.

### Haftalık 3 soru
1. **What did we learn?** Heby now reads as a real conversational copilot — threaded turns, restored history, honest provenance, a working kill-switch state — built entirely on the existing durable+bounded-history backend with no new authority and no migration.
2. **How does this improve Turkish Rug House?** A TRH operator gets an actual copilot conversation surface they'd trust: it remembers the thread, survives reload, starts fresh on demand, and never pretends to be connected or to have executed anything.
3. **How does this become part of Hebun AI?** H1C is the reusable conversational shell — durable-authority rendering, pure/testable presentation split, truthful provenance states, text-only firewall — that the future full-screen Heby Workspace and every agent conversation build on.

## H1D pre-live — single operational authority (2026-08-10, NOT published)
- **"Broken product" was an unpromoted temp config, not a bug.** Platform truthfully showed Needs-configuration/Unavailable because the model flags lived only in per-proof temp `.env.local` blocks that were removed at each cleanup. The projection was correct; the durable config was empty. An inert dry-proof (compute the projection under different env sets) reproduced the UI exactly and pinpointed the missing `HEBUN_MODEL_PROVIDER` + `HEBUN_MODEL_TRANSPORT`.
- **Two gates for one permission is a latent outage.** `HEBUN_MODEL_LIVE_CALL_AUTHORIZED` (R2D one-shot smoke gate) plus R2E's durable Director control both gated "may call the provider". The dry-proof showed the failure concretely: full config + Director ON + `transport=live` still selected NO transport unless the hidden env flag was also set. Retire the redundant gate; make the durable, UI-controlled authority the single source of truth.
- **Separate MODE from PERMISSION.** `HEBUN_MODEL_TRANSPORT=live` = which transport to build (deployment). R2E Director ON/OFF = whether a request may dispatch (operation). Selecting the live transport is inert (no I/O); dispatch is what R2E gates. The invariant to prove: OFF blocks dispatch even when `transport=live` is armed — verified via DB message origin=deterministic + zero `anthropic` server logs.
- **Prove the live seam without spending a call.** The real live transport takes an injected `fetchImpl`; a counting fake fetch lets a test drive the full path to the dispatch seam (Director ON → reaches fetch once) with zero network — so "would it call?" is answerable without calling.

### Haftalık 3 soru
1. **What did we learn?** Hebun now has one operational kill-switch (R2E Director), not two; the product is durably configured for live and gated only by the UI toggle, and OFF provably blocks all provider contact even when armed for live.
2. **How does this improve Turkish Rug House?** A TRH operator controls Claude with a single, visible switch — no hidden env flag can silently break or arm the product — and "off" is a real, proven kill-switch, not a hope.
3. **How does this become part of Hebun AI?** Single-authority gating (durable, UI-controlled, fail-closed, mode-vs-permission separated) is the pattern for every future provider and execution surface — the antidote to forgotten-flag outages.

## 2026-08-10 — H1D final clean run (STOPPED at Turn 1)

- `origin=deterministic` NEVER proves "no provider request". `produceAnswer` catches `ModelConnectivityError` and degrades, carrying the typed code in `limitations`. Read the limitation note to classify, not the origin field.
- `authentication-failed` has exactly ONE emitter: `mapStatus(401|403)` in `heby-model-live/claude-http-transport.server.ts`. Seeing it proves the HTTP request reached Anthropic and got 401/403 — a provider fact, not a local config guess.
- H1D Turn 1 hit `authentication-failed` even though the key on disk is well-formed (`sk-ant-`, 108 chars, no quotes/whitespace). Earlier the same day the same path returned HTTP 200. Conclusion: the key was revoked/rotated or lost model access at the provider. A fresh key is required before spending another authorized call.
- Local stack is NOT quiet: a second actor re-logs in as `bob@globex.test` and fires Heby suggestion chips. Re-check for competing sessions immediately BEFORE a live call, not only at setup.
- Browser driving this app: the first click after `navigate` is regularly swallowed (no server-action POST fires). Wait after load, screenshot, click in screenshot coordinate space, and verify the durable DB row instead of trusting the rendered label.
- Test suites use disposable Postgres on :5432, never `hebun_r1` on :55432 — running the full suite cannot contaminate tenant data.

## 2026-08-10 — H1D acceptance PASSED (Heby Product Experience H1 complete)

- Pre-stage before turning the kill-switch ON: open the Heby panel, click New, pre-fill the prompt, THEN flip Director ON in a second tab. Turns the ON window from minutes into seconds. This is what finally made the run succeed after two aborted attempts.
- Rising `input_tokens` across turns (620 → 853 → 1062) is the cheapest live proof that bounded history actually reached the provider. Check it before writing any elaborate structural proof.
- When the API key is replaced, restart the dev server. Next.js loads `.env.local` at process start; a running server keeps serving the revoked key and will burn a call reproducing the old failure. Compare `.env.local` mtime to the server start time first.
- Revoking a competing session does not hold if the surface that minted it is still open — a new session appears within minutes. Close the surface, not just the session. Even then, verify quiescence immediately before the call, not only at setup.
- A model that correctly refuses to recall a recommendation it never made is a STRONGER continuity result than one that produces a tidy answer. Turn 3 recalled both prior turns and said "I didn't recommend prioritizing one over the other" — continuity and honesty in the same response.

## HW1 — Heby Full Workspace (2026-08-10, NOT published)

- **"Demote the drawer" is not a real option — two Heby surfaces is the bug.** Keeping the panel mounted with only contextual triggers would have shipped two competing conversation UIs. Retiring it fully (files deleted, shell overlay removed, every entry point a `<Link>`) was cheaper than it looked: the H1C/R2C/R2D guards were *re-pointed* at the new container, not rewritten, because they assert behaviour, not filenames. Guards that survive a surface swap are guards worth having.
- **Re-pointing a guard onto the live surface strengthens it.** The R2C/R2D credential-boundary and firewall checks used to protect a panel that is no longer the product. Pointing them at `heby-workspace-client.tsx` means they now protect the surface users actually touch — same assertions, more coverage.
- **Make the dispatch invariant a property, not a code review.** The rule "a slash command can never reach Claude" is enforced by `parseHebyInput` never returning `kind:"prompt"` for a `/`-prefixed string, and tested over an adversarial corpus (`/deploy production`, `/run rm -rf /`, `/approve …`). A structural check then proves `askHebyAction` has exactly one call site, after all three command branches return. A future edit cannot quietly open the path.
- **A known command WITH arguments must be an *unknown* command, not a prompt.** `/help me summarize ops` looks like conversation. Treating it as a prompt would be the leak. HW1 rejects argument forms outright until a phase defines what arguments mean.
- **An unread prop is honest; an animated one is a lie.** `audioLevel` exists on the visualizer so a real audio runtime can drive it later, and is provably never read. The tests assert both the reserved hook AND the absence of `getUserMedia`/`AudioContext`/`SpeechRecognition` anywhere on the surface — so "prepared for voice" can never drift into "pretending to have voice".
- **Motion must be evidence of work, not decoration.** Ripples render only while a request is genuinely in flight; `unavailable` does not breathe. A test counts animation declarations and requires every one to be `motion-safe:` gated.
- **The context hint is scope, never authority.** `?from=…` is resolved server-side against the closed workspace identity set before render; hostile values (`../operations`, `<script>`, `__proto__`) fall back to the general context and are never reflected into the label, route, or copy. `/heby` maps EXPLICITLY to Command's organization-wide read models — an intentional mapping, so the general context can be labelled truthfully instead of silently inheriting a default.
- **`min-h` is the wrong primitive for an app-shell workspace.** With `min-h-[calc(100dvh-topbar)]` the page itself scrolled on short viewports. A FIXED height plus `shrink-0` header/composer and `min-h-0` on the thread makes only the conversation scroll and keeps the composer reachable — which is also the responsive requirement.
- **Don't flip the Director's switch to finish your own proof.** The ON path in-browser needed the durable kill-switch flipped. It stayed OFF: the ON behaviour is already proven behaviourally with a counting fake transport, and the switch belongs to the Director. Browser acceptance reported what it actually covered.

### Haftalık 3 soru
1. **What did we learn?** Heby becomes a first-class workspace by *moving* the surface, not by building a second Heby: one route, one conversation authority, one command parser — and the honesty guarantees travel with it because they were written as behavioural guards rather than file-scoped assertions.
2. **How does this improve Turkish Rug House?** A TRH operator gets a real copilot workspace instead of a 440px drawer — full-width thread, evidence in reach, `/context` that states plainly what Heby can and cannot see, and a `/clear` that provably never deletes their history.
3. **How does this become part of Hebun AI?** HW1 defines the primary Heby product shell: server-resolved context, one narrow command dispatcher that cannot reach the provider, a presence element bound to real runtime state with a reserved (inert) audio hook, and an execution firewall re-proven on the live surface — the frame every future Heby capability, and eventually voice, plugs into.

## HW2 — Heby immersive visual refinement (2026-08-10, NOT published)

- **A design reference is a mood, not a spec — and the gap is where the lying starts.** The concept image carried Memory 98%, Reasoning 96%, System Health Excellent, Online, Listening, event/approval counts. Every one of those is a claim Hebun cannot back. HW2 took the *atmosphere* (dark field, green intelligence presence, negative space, conversation emerging beneath) and permanently banned the readouts in a test: a regex list matched against VISIBLE TEXT in four different surface states. The ban is now cheaper to keep than to break.
- **"No authoritative source → no element" beats every placeholder.** The peripheral row shows evidence count and the latest answer's provenance ONLY once an answer exists; before that it renders nothing. No `--`, no `0%`, no "Unknown". A real zero (`0 evidence references`) IS stated, because suppressing a true zero is its own dishonesty — the test pins both directions.
- **A presence element earns its size by being deterministic.** The field is a Fibonacci sphere computed once at module load — no `Math.random`, no `Date` — so SSR and client markup are byte-identical, there is no hydration mismatch, and nothing can drift into looking like live activity. 170 points + 3 orbital ellipses + one radial core reads as an intelligence field; a glowing circle would not have.
- **Motion intensity is a claim, so make it ordered and testable.** Orbit period 52s idle → 34s composing → 13s responding, and the test asserts the ORDERING rather than the numbers. `unavailable` emits no `[animation:` at all: a dimmed-but-moving field reads as "still working", which would be false.
- **Assert the guard, not the implementation.** Counting animation-name occurrences broke the moment a CSS custom property shared the keyframe's name. Replacing it with "no `[animation:` may appear without a `motion-safe:` prefix" survives any restructuring and is a stronger statement of the actual rule. Same lesson for role distinction: `data-heby-role` beat asserting `bg-primary`.
- **An auto-scroll effect is a layout bug in a hero screen.** `scrollTop = scrollHeight` on mount cropped the presence field's top half. Scroll-to-bottom belongs to thread mode only — the fix is a mode guard, not padding.
- **Hero-vs-thread is the honesty fix for immersive surfaces.** The presence dominates while there is nothing to read, and collapses to an inline mark the moment a conversation exists. That is what keeps "immersive" from becoming "trapped in a decorative screen", and it is asserted via `data-heby-mode`.
- **Tablet drops the periphery before it shrinks the subject.** The flanking Context/Authority labels are `hidden lg:block`; the context still lives in the header, so nothing truthful is lost at any width.

### Haftalık 3 soru
1. **What did we learn?** Visual ambition and truthfulness are not in tension if the ban list is executable: HW2 got a distinctive Heby identity by spending the design budget on presence, space and typography instead of on invented numbers — and the numbers are now blocked by a test rather than by discipline.
2. **How does this improve Turkish Rug House?** A TRH operator opens Heby and sees something that reads as an intelligence they can talk to, while every figure on screen is one the system can actually defend — evidence count, provenance, context, authority. Nothing on that surface can mislead them about what Hebun knows.
3. **How does this become part of Hebun AI?** HW2 fixes Heby's visual identity (deterministic presence field, restrained green on near-black, sparse real periphery, hero→thread composition) and the rule that governs every future Heby surface: decoration may suggest presence, never activity.

## HW3 — Heby dual surface + HW2 visual polish (2026-08-11, NOT published)

- **Make the invariant unrepresentable, don't defend it.** "Quick Panel and Full Workspace never both active" is not enforced by guards — the active surface is ONE derived value (`resolveHebySurfaceState`) in which the route wins, and the Full Workspace IS a route. On `/heby` the panel container returns `null`, so there is no hidden panel, no second mounted composer, no second live conversation. A pair of booleans would have needed policing forever.
- **Two surfaces, one seam — extract before you duplicate.** The whole conversation (one `askHebyAction` dispatch site, one parse gate, one detach primitive, one localStorage pointer) moved into `use-heby-conversation.ts`, which both containers call. The old H1C/HW1/R2C/R2D structural tests were re-pointed at that file, which made them *stronger*: one proof now covers both surfaces instead of one.
- **Cross-surface continuity can be architecture, not a feature.** Both surfaces resolve their context through the same closed registry to the same canonical route, and the durable-conversation pointer is keyed by that route — so leaving `/heby` into the Quick Panel on the same workspace restores the same 20-turn conversation with no transfer, no copy, no sync mechanism. Proven live and in a behavioural test.
- **Return targets are an allow-list, never a sanitizer.** `resolveHebyReturnRoute` accepts only one of eight known workspace identities and then reads the route from the registry's own profile, so the caller's string is never echoed into a URL. 20 hostile inputs (`//evil.example`, `javascript:`, traversal, markup, encoded slashes) all land on `/command`. Open redirect is structurally impossible, not filtered.
- **A stronger orb comes from structure, not from glow.** Two nested Fibonacci shells (interior volume), a small crisp nucleus (centre of mass) and one lit rim (silhouette) made Heby recognizable; blur, bigger glow, neon and scattered particles were the shortcuts, and the test now bans them by name (`blur-`, `feGaussianBlur`, `mix-blend`, `Math.random`).
- **Binary hero/thread was too blunt.** HW2 collapsed the presence the instant the first message existed. HW3 added `emerging` between them, driven by the real turn count: hero → compact presence above the transcript → inline mark only. The decorative canvas recedes with it via `data-heby-mode` in CSS. A 20-turn thread is a working surface; a first exchange should not feel like Heby vanished.
- **Proofs must not fail on their own documentation.** Several guards ban a word from the product ("online", "listening", "TenantContext"), and the doc comments legitimately NAME what they ban. Stripping comments before the scan (`codeOf`) is the fix; so is judging execution capability on API shape (`child_process`, `execSync`) rather than on prose like "shell", which collides with `--shell-nav-w`.
- **Scope import bans to the module path.** `heby-conversation` as a bare substring also matched the local `./use-heby-conversation`. `features/heby-conversation` is what the rule actually meant.
- **A dev server that has been hot-reloaded through a provider refactor will lie to you.** The topbar toggle appeared permanently stuck open until a full reload; the same is true of layout measurements taken after `resize` without reflow (an apparent 8px tablet overflow vanished on reload). Re-load before believing a browser symptom, and before reporting it as a defect.
- **JSX eats the space next to an expression at a line break.** `Ask about {label}\n without leaving it` rendered "Operationswithout". `{" "}` is the fix — caught only because the surface was actually looked at.

### Haftalık 3 soru
1. **What did we learn?** A second presentation surface is safe exactly to the degree that presentation state is kept out of authority. HW3 added a whole new surface without adding a backend, a table, a provider path, a parser or a conversation — because the only new module is a pure function over `(pathname, oneBoolean)` and the only new component is a renderer.
2. **How does this improve Turkish Rug House?** A TRH operator can now ask Heby a question without abandoning the screen they are working on, and step into Heby's own workspace when the question deserves room — and it is the same Heby either way: same memory, same evidence, same Director kill-switch, same honest "I can't".
3. **How does this become part of Hebun AI?** HW3 fixes Heby's interaction model (CLOSED / QUICK_PANEL / FULL_WORKSPACE, topbar owns quick, rail owns workspace, one surface at a time) and the rule every later Heby surface inherits: a new surface may add presentation only — the runtime, the conversation, the tenant, the provider boundary and the kill-switch stay singular.

## S1 — Heby slash command registry (2026-08-11, NOT published)

- **Make the taxonomy the enforcement, not a convention.** Each command declares one `kind`, and the pure planner branches on it — only the `advisory` branch can produce a `prompt`. So "a local/read/nav/reserved command called the provider" is not a bug to catch; it has no representation. The exhaustive test walks all 44 commands and asserts every non-advisory plan literally has no `prompt` field.
- **Audit the read seams BEFORE writing the command list.** The registry's availability flags came from reading `source-resolver.ts`, `source-map.ts` and `provider-connectivity-projection.server.ts`, not from what sounded useful: Operations/Platform are real (Executive Overview), knowledge/memory/intelligence/workforce/governance are explicitly unconnected. That audit is why `/agents` reads and `/tasks` refuses — and the refusal names the exact missing source instead of saying "coming soon".
- **The absence of a feed IS the finding.** `/security` is available precisely because the Security Center source map is real: it states per source class what Hebun can and cannot prove, and `hasConnectedSecurityFeed()` is false. Reporting "no live security feed is connected, 0 findings" is more useful and more honest than either hiding the command or inventing an incident count.
- **Refuse shell grammar, do not sanitize it.** `|`, `;`, `&`, backticks, `$()`, `${}`, `<`, `>`, `\` produce an `unsafe-input` refusal that says "Heby's command line is not a terminal". Sanitizing would imply the grammar was meant to accept them.
- **Reserved commands must not even produce a preview.** `/deploy` returning "here's what would happen" would be a fabricated capability. The test bans `would run|dry-run|preview` in a reserved result. It returns one line: the runtime does not exist, nothing was run.
- **A separate server action is a stronger boundary than a flag.** READ commands go through `runHebyReadCommandAction`, which imports no model client and no transport selector — so a read has no path to a provider, proven by import inspection rather than by control flow. The client sends a registry *id*, never behaviour.
- **An alias must share its canonical handler.** `/evidence`→`/sources`, `/summarize`→`/summary` are registry entries with `aliasOf`, hidden from the palette, and a registry invariant forbids an alias with a different handler or kind — so an alias can never drift into a second implementation.
- **Show unavailable commands; never let them look runnable.** Hiding them hurts discovery. The palette dims them, adds a lock, labels the gap ("needs execution runtime", "no source yet"), and sets `aria-disabled`. 23 available / 10 source-blocked / 11 execution-blocked, all visible.
- **Palette selection of an argument-bearing command should TYPE it, not run it.** Running `/go` with no argument only produces a "wrong arguments" refusal; inserting `/go ` is what the operator meant.
- **Zero-dispatch is provable from the durable record, not from the code path alone.** 17 local/read/nav/reserved commands added 0 rows to `messages`; 7 advisory commands added 14 rows, all `origin=deterministic` with null provider/transport under Director OFF. That is stronger evidence than any assertion about intent.
- **`/help` output being byte-identical on both surfaces is the cheapest proof of one registry.** Compared in the browser, not asserted in a comment.

### Haftalık 3 soru
1. **What did we learn?** An extensible command system stays safe when extensibility lives in the DESCRIPTOR and authority lives in the planner. A future provider can contribute commands without touching the parser, palette, or dispatcher — and still cannot grant itself execution, because the planner refuses `reserved` before it looks at anything else.
2. **How does this improve Turkish Rug House?** A TRH operator gets a keyboard layer over what Hebun actually knows — context, evidence, status, providers, security posture — and every command that cannot be answered says which source is missing rather than guessing. The commands that could mislead are the ones that refuse.
3. **How does this become part of Hebun AI?** S1 fixes Heby's command taxonomy (LOCAL / READ / ADVISORY / NAVIGATION / RESERVED), the availability vocabulary (available / requires-source / requires-capability / requires-execution), and the rule every later capability inherits: a command may request a capability, and may never grant itself permission to use one.

## Voice V1 — Real voice I/O around the existing Heby (2026-08-11)

- **Voice is I/O, not an authority — and the proof is that the conversation seam never learned about it.** `use-heby-conversation.ts` contains no reference to voice, audio, microphone or speech. Voice's only outward effect is calling a sink with a STRING that lands in the composer. Everything downstream (S1 parser → planner → single dispatch → R2E) is byte-for-byte the path typed text takes, so voice cannot be a bypass because there is no second road.
- **A microphone must have exactly ONE owner, mounted above every surface.** Per-surface voice runtimes would make "who closes the stream" a question of unmount ordering. `HebyVoiceProvider` sits in the shell, counts its own instances, and throws on a second mount. Switching Quick Panel ↔ Full Workspace was proven in the browser to create zero extra captures.
- **Feature detection is not a permission prompt — but only if it reads properties instead of calling them.** `!!navigator.mediaDevices?.getUserMedia` is a read; `getUserMedia()` is a request. Keeping the single call site inside one function, invoked only when the pure reducer returns `requesting`, makes "no microphone on load" a structural fact.
- **Start capture in the click handler, not in an effect keyed on state.** Running the reducer locally (`hebyVoiceReducer(stateRef.current, event) === "requesting"`) keeps the state machine as the only authority while putting `getUserMedia` inside a genuine user gesture — which browsers prefer — and removes a setState-in-effect cascade.
- **`useSyncExternalStore` is the right primitive for a browser capability.** It legitimately differs between the server render and the client; an effect+setState causes a cascade and a hydration flash, and a lazy `useState` initializer causes a mismatch.
- **Amplitude must decay to EXACTLY zero.** Smoothing that idles at a small positive value keeps the orb alive in a silent room, which is a lie. The normalizer has a noise floor and the smoother collapses its tail to 0.
- **Read the audio level in exactly one state, and prove the count.** The visualizer reads `props.audioLevel` once, gated on `state === "listening"`; the test asserts the occurrence count is 1. A stale reading can then never animate anything after capture ends.
- **Speaking is a state; it is not an amplitude.** `speechSynthesis` exposes no output stream, so no amplitude exists for it. Giving `speaking` its own cadence is honest; giving it a waveform would be fabricated.
- **Reduced motion needs an explicit `transform: none`.** The global reduced-motion rule only flattens durations — a CSS-variable-driven transform survives it. Cancel the movement, never the capability.
- **When an old test bans a word, narrowing it is the honest move — not deleting it.** HW1/HW2/HW3 banned "listening/microphone/voice" outright because none existed. Voice V1 narrowed each to the surviving invariant (a surface with no voice runtime makes no audio claim; only a genuinely-open microphone may say "Listening") and matched on visible copy + accessible name instead of raw markup.
- **Automation browsers block the microphone. Say so.** The Browser pane reported `micPermission: "denied"` and empty device labels. That proved the disclosure gate, the permission request, the denied state and the text fallback — and proved nothing at all about live capture. Do not call a mocked or blocked device "live".

### Haftalık 3 soru
1. **What did we learn?** A new input modality is safe exactly to the degree that it converges on the existing one before reaching any authority. Voice earns nothing new: it produces text, and text already has one parser, one gate, one dispatch and one kill-switch. The dangerous version of this feature is the one that adds a "voice send" path.
2. **How does this improve Turkish Rug House?** An operator on the floor can ask Heby something without a keyboard, read what was heard, correct it, and send it deliberately. The orb finally reacts to a real thing — their own voice — instead of decorating.
3. **How does this become part of Hebun AI?** Voice V1 fixes the modality rule for everything after it: capture, analysis, recognition and synthesis are four separate authorities; recognition egress is disclosed before the first capture, not buried; and any future modality must converge on the composer rather than acquire a dispatch of its own. Wake word is deliberately excluded because it changes the privacy and lifecycle model, not just the UI.

## Voice V1.1 — Production Speech Provider Decision + Real Microphone Acceptance (2026-08-11)

- **The conservative default was right, and it is now also obsolete on one platform.** Voice V1 assumed "recognition leaves the device" because nothing could prove otherwise. Chrome 139+ desktop added `SpeechRecognition.processLocally`, `available({langs, processLocally:true})` and `install({langs})` — so locality became a MEASUREMENT. The rule that survives: only the measured answer earns the favourable sentence; `downloadable` and `downloading` are still "cloud", because a pack that could exist is not a pack that does.
- **Derive the privacy claim, never store it.** `availability` is computed from three preconditions (members exist, an answer exists, the answer is about the CURRENT language). No branch assigns the favourable value, so it can only be relayed from the browser. Storing it would have made a stale Turkish/English answer reachable.
- **Tag an async answer with the input it answered.** The availability answer is per-language; `setAnswered({language, value})` makes a stale answer unusable by construction rather than merely ignored.
- **`react-hooks/set-state-in-effect` is a design signal, not a lint annoyance.** The fix (derive the value, let the effect only write from its async callbacks) produced a strictly better invariant than the version that passed review in my head.
- **Provider seams belong around the replaceable capabilities only.** STT and TTS got provider-neutral interfaces; capture and analysis deliberately did not, and a test bans an adapter for them. A speech provider must never be in a position to open a microphone.
- **Split STT from TTS or the vendor split becomes permanent.** Deepgram is the strongest Turkish streaming STT and has no Turkish TTS at all. One combined adapter would have hidden that and forced a worse decision.
- **A wrong-language recognizer does not fail — it returns confident nonsense.** `navigator.language` was handed to the recognizer on every capture. It is now a one-time seed behind a visible two-option control, locked during a capture.
- **A label that promises what the machine refuses is a bug.** The mic button said "Start voice input again" in `review` while the reducer ignored the press. Enumerating the entry surface into capture (`idle`, `review`, `speaking`, `denied`, `error`) in a test caught it.
- **Safe barge-in needs a press, not an open microphone.** Interruption stops playback synchronously BEFORE the transition, so the two are never both live. Real conversational barge-in needs a standing capture, which changes the privacy model — not this phase.
- **Turkish casing does not round-trip.** `/TERMİNAL` does not lowercase to `/terminal`. The safety claim must not depend on it doing so: an unmatched slash token is an unknown command, which is still not a prompt.
- **Real-mic proof needs a human, not a better browser.** The in-app pane's renderer was dead and the headless daemon was unstable — but even a working automation browser has nobody speaking into it. Report UNAVAILABLE; do not substitute injected audio.

### Haftalık 3 soru
1. **What did we learn?** A privacy claim should be re-audited when the platform changes, not just when the code does. The honest position in V1 ("assume it leaves") and the honest position in V1.1 ("measure, and assume it leaves when you cannot") are the same rule applied to a different platform.
2. **How does this improve Turkish Rug House?** An operator can set Türkçe once and dictate in it, see whether their voice is staying on their own machine while they speak, and interrupt Heby mid-answer by reaching for the microphone.
3. **How does this become part of Hebun AI?** The four-capability split is now enforced by types and by tests: capture and analysis are permanently Hebun's, STT and TTS are adapters behind a Director gate. Any future modality inherits both the seam and the rule that the favourable claim must be measured.

## Voice V1.2 — Real-mic diagnostics & the zero-amplitude defect (2026-08-11)

- **A passive effect cannot gate a requestAnimationFrame loop.** The measurement loop checked `hebyVoiceHasAudioLevel(stateRef.current)`, but `stateRef` is advanced by a passive effect (runs after paint) while rAF runs before paint. The first tick always saw `requesting`, took the exit branch, and killed the loop forever. Structural tests all passed; only a real microphone found it.
- **Separate what follows the DEVICE from what follows the STATE MACHINE.** Measurement is now gated on a synchronous ref set the moment a live analyser exists. The honesty invariant did not move — it lives at the presentation gate (`presentableAudioLevel(level, hebyVoiceHasAudioLevel(state))`), which was always the right place for it.
- **An AudioContext built after `await getUserMedia` starts suspended.** Transient user activation expires while the operator reads a disclosure and answers Chrome's permission prompt. A suspended context feeds the analyser silence bytes forever. Resume it, then verify `state === "running"`, then fail loudly — a dead orb next to the word "Listening" is the one output this architecture must never produce.
- **Two independent defects produced one symptom.** Fixing only the loop would have left the suspended-context failure latent on slower permission flows. When a symptom has two sufficient causes, fix both or the next run is another mystery.
- **Silent failure is the expensive kind.** STT worked, so nothing looked broken; the orb just looked like a quiet room. That cost a whole acceptance round. The answer was a dev-only diagnostic (`__hebyVoiceDiagnostics()`) reporting context state, track flags and sample counters — pulled on demand, attached outside production only, deleted on unmount.
- **Narrow a ban rather than delete it.** The firewall banned `process.env` outright. V1.2 needs exactly `NODE_ENV` to keep the diagnostic out of production, so the test now enumerates every environment read and permits only that one. A credential read still fails.
- **`downloadable` → `cloud` was correct, not a bug.** The locality display and the runtime agreed; the Turkish pack was simply never installed. Reconciling "downloadable" against "localitySeen: cloud" needed no code change — only a diagnostic that could say so.
- **Separate accuracy failure from encoding failure.** The first real transcript scored WER 67% with zero encoding failures: every Turkish character survived intact. Those are different defects and a harness that reports one number hides that.
- **A quality harness must self-verify before its numbers mean anything.** The scorer proves itself against known pairs — including the real observed failure — every time the suite runs.

### Haftalık 3 soru
1. **What did we learn?** Structural tests prove structure, not behaviour. Every claim that depends on browser timing — rAF versus commit, autoplay policy versus user activation — is unproven until real hardware runs it. The fix was to make the runtime say what it actually did, so the next unknown costs one console call instead of one acceptance round.
2. **How does this improve Turkish Rug House?** The orb will finally move to a real voice, and when it does not, the reason is one call away instead of invisible.
3. **How does this become part of Hebun AI?** The rule is now explicit: measurement follows the device, presentation follows the state machine, and anything gated on React commit ordering is a latent silent failure. Every future real-time modality inherits it, plus a dev-only diagnostic seam that cannot become telemetry.

## Voice V1.3 — The "Waiting for microphone permission" hang (2026-08-11)

- **Granting the permission is what broke it.** `beginCapture` guarded its own result with `stateRef.current !== "requesting"`, and `stateRef` is advanced by a passive effect. On the first run the operator spent seconds on Chrome's prompt, so React committed first and the guard passed. Once permission was granted, `getUserMedia` resolved in milliseconds — before paint — the guard saw the stale `disclosure`, stopped the tracks it had just been granted, and returned without dispatching. The UI sat on `requesting` forever. **A bug that only appears after the happy path succeeds once is the worst kind to find.**
- **Same defect class as V1.2, one level up.** Control flow must never depend on React commit ordering. V1.2 fixed it in the measurement loop; the identical mistake was still sitting in the capture guard. When you find a timing-dependency bug, grep for the whole class instead of fixing the instance.
- **An async attempt needs a token, not a state read.** Every operator activation mints one; teardown invalidates it first, before releasing anything. Each await boundary asks "am I still the attempt in flight?" — synchronous, unaffected by any render.
- **Silent returns are how hangs are built.** The old guard returned with no dispatch, no failure, no phase change. Every early return out of an async lifecycle must either transition the machine or be provably unobservable.
- **One user-facing state was hiding four operations.** `requesting` covered permission-requested, media-pending, media-acquired and audio-context-starting. A diagnostic capture phase alongside the reducer (never competing with it) makes "where did it stop?" answerable without adding UI states.
- **Never turn a pending promise into a denial.** A permission prompt can legitimately sit open for minutes. The stall threshold changes WORDS only — it cannot deny, cancel, retry or settle. Timeout-as-denial would have been the easy fix and a lie.
- **Do not name a culprit you cannot see.** The browser never tells the page whether a refusal came from Chrome, the OS, or an admin policy. Messages name both places to look and claim neither.
- **"Nothing happened" was a reporting failure, not a download failure.** The install offer vanished on every outcome — success, no-change and rejection looked identical. Install now has a status separate from availability, and success is only claimed when a re-check proves it.
- **Extract the decision, not the plumbing.** The late-result branch became a pure `decideMediaAdoption`, so the exact logic that caused the hang is enumerable in a test. The token counter stayed in the runtime — two implementations of one rule would have been a second authority.

### Haftalık 3 soru
1. **What did we learn?** The same root cause can hide in several places, and fixing one instance proves nothing about the others. Both V1.2 and V1.3 were "code that assumed React had already committed." That is now a named class we grep for, not a bug we rediscover.
2. **How does this improve Turkish Rug House?** An operator whose microphone request stalls is told what is happening and can get out of it, instead of staring at a sentence that will never change.
3. **How does this become part of Hebun AI?** Async lifecycles get attempt tokens, every early return must be observable, and any promise the browser owns is described honestly while it is pending rather than resolved on Hebun's authority.

## Knowledge Source Expansion K1 — Reading the authority that was already there (2026-08-11)

- **The Knowledge system was never missing — it was unread.** `knowledge_facts` and `knowledge_nodes` had been migrated into the control-plane database for months with zero application read or write code. The instinct on a "give Heby knowledge" brief is to reach for a vector store; the actual gap was that nobody had written a `select`.
- **Filenames lie at this repo's scale.** Ten `knowledge-*` feature directories, ~130 architecture-intelligence documents, and a `documents` table — and exactly one of them was a usable authority. The `documents` table has zero consumers anywhere. Architecture Intelligence has zero code bindings. Classification has to be done by reading implementations, one at a time.
- **A capability family is not one capability.** Listing, named read, search, semantic retrieval, ingestion and embeddings were in three different states. Activating `/search` because `/knowledge` started working would have been the whole failure mode in one line. Report each separately or the report is false.
- **An empty read is a result, not a failure — and the difference has to be said out loud.** "Your organization holds no knowledge records. That is the real state, not a read failure" is the sentence that keeps an honest system from looking broken.
- **The seeded store is always the tempting shortcut.** `knowledge-crud` holds ready-made nodes with a `confidence` number derived from mock health. A test now bans every K1 module from importing it, because the shortcut is one import away and looks like progress.
- **Scope the join on both sides.** Scoping only the fact row would let a fact resolve its content through another tenant's node. Two tenants sharing the fact key `security-policy` in a real database is the test that catches it; a mock never would.
- **Ambiguity is a result too.** A fact key present in two domains returns both candidates. Silently picking the first would be indistinguishable from correctness right up until it wasn't.

### Haftalık 3 soru
1. **What did we learn?** Before building a knowledge system, prove the existing one is actually unusable — not merely unused. K1's whole value came from a read path over tables that already existed, with zero dependencies and zero migrations.
2. **How does this improve Turkish Rug House?** When the shop's policies and procedures do get stored, Heby can already cite them with their authority class, ratification and review date — and today it says plainly that there are none, instead of inventing an answer.
3. **How does this become part of Hebun AI?** One concept, one authority: Knowledge is `knowledge_facts` → `knowledge_nodes`, read tenant-scoped, and settled knowledge never speaks for the current runtime. Every future source class inherits the rule that capabilities are reported one by one.

## K1 Closure — When a word means two things (2026-08-11)

- **The alarming finding was a naming defect, not an inversion.** `knowledge-canonical-repository` marks the seeded in-memory store `authoritative: true` and canonical Postgres `authoritative: false`. Read as "which store owns organizational truth" that is a scandal. In `CanonicalRepositoryDescriptor` the word means *primary participant of this read router* — dual-read migration vocabulary — and the values are correct for that meaning. My own earlier closure report called it "an inversion"; that was imprecise, and re-proving from disk is what caught it.
- **Establish what a field MEANS before deciding whether it is wrong.** The tell was `routeKnowledgeRead` hardcoding `authoritativeProvider: "memory"` — the router and the descriptor agree perfectly. Flipping the booleans would have introduced a real defect while claiming to fix one.
- **"Is it read anywhere?" is the cheapest question in an authority audit.** `descriptor.authoritative` is never read in `src/` — set-only metadata behind a double-gated diagnostics page. That single grep collapsed a suspected authority conflict into a documentation problem.
- **Fix the reading, not the value.** The reconciliation was a doc comment at the field's own definition, a header on the scaffolding, and a test pinning the invariant that actually matters: the seeded store cannot enter a product read path. No refactor, no rename, no moved authority.
- **Pin the invariant, not the symptom.** A test asserting `authoritative === true` proves nothing about safety. The useful guards are: nothing branches on the flag; no product Knowledge module imports the seeded store or the scaffolding; the scaffolding has no consumer outside diagnostics.
- **Do not let a lower-level proof rename itself.** The browser pane would not composite, and `/login` is a server action so a curl POST establishes no session. Running the server seams directly against the real database is good evidence — it is not browser acceptance, and calling it that would have been the easy lie.

### Haftalık 3 soru
1. **What did we learn?** Re-prove your own prior report from disk. The most confident sentence in it was the one that was wrong, and the correction cost one grep.
2. **How does this improve Turkish Rug House?** Nothing seeded can ever present itself to the shop as settled company knowledge — that is now a build failure, not a convention.
3. **How does this become part of Hebun AI?** One concept, one authority, and one meaning per word. Where a word must carry a second meaning, it documents that at its own definition and a test pins what the word does not mean.

## K2 — Humans keep the authority, and a policy's wording broke Heby (2026-08-11)

- **The write authority already existed; the fine-grained one did not.** `permissions` + `role_permissions` is a real allow-only grant model with zero code consumers and zero rows. `roles.type` is the only CONNECTED authorization primitive, and R2E already gates the kill-switch with it. Reusing it was the narrowest legitimate path; building a permission runtime to look rigorous would have been inventing an auth model under a governance gate.
- **Same primitive, separate policy.** Knowledge authorship got its own module rather than importing R2E's role set. They need the same band today; coupling them would mean tightening one silently moves the other.
- **The governance fields are the honesty test.** A human typing a sentence is `draft` + `provisional`, with `ratified_at` and `governance_session_id` left NULL. The form has no field that can say otherwise, so nobody can ratify company policy by filling in a textarea.
- **Attribution was already in the schema.** `rootColumns` carries `created_by` + `created_by_type` on every tenant table, and `knowledge_facts` adds `selected_by_actor_*`. "Who established this?" was answerable with zero migrations — the Director gate on auditability never had to fire.
- **A real corpus broke something an empty one hid.** Heby's validator refuses responses claiming "approved / authorized / deployed / deleted". Once real Knowledge existed, a security policy containing the word "authorized" made Heby look like it had acted, and the ENTIRE answer was withheld. Empty tables are not a passing test; they are an untested path.
- **Fix the field, not the guard.** The validator was right. The mistake was routing verbatim human text into `detail`, which becomes Heby's own prose. Machine-derived standing now goes to `detail`, the human's words to a new `content` that reaches only the model's grounding context. Heby's sentences never quote source text.
- **Prove the gate with real rows, not just injection.** Every gate-order test injected the authority. Only seeding real `roles` rows proved that a member is refused, another tenant's owner role resolves to nothing, and each refusal wrote nothing.

### Haftalık 3 soru
1. **What did we learn?** A read path over an empty table proves almost nothing. The first real record is where the architecture is actually tested — and it found a defect that would have withheld every Knowledge answer in production.
2. **How does this improve Turkish Rug House?** The shop's real policies can now be written down once, attributed, and cited by Heby — while nothing the assistant says or hears can quietly become company truth.
3. **How does this become part of Hebun AI?** Humans establish organizational truth; AI consumes it. Quoted source text is data and never becomes the system's own claim. Governance fields stay NULL until governance actually happens.

## K2.1 — The browser was never broken; the origin was (2026-08-11)

- **Two closure reports said "browser acceptance unproven." Both were half right.** The in-app pane genuinely would not composite — but the deeper failure was mine: loading the app on `127.0.0.1` while Next dev treats `localhost` as the origin. Next blocks cross-origin dev resources, client chunks never hydrate, and every button becomes inert while the page looks perfectly normal. `localhost` instead of `127.0.0.1` fixed it. **A page that renders but does not respond is a hydration problem, not a UI problem — check the dev-server log before blaming the tooling.**
- **When one browser surface fails, try another before declaring it impossible.** Chrome DevTools MCP worked immediately. "Unproven" was honest; it was also premature.
- **Disposable database = fixture cleanup without a delete feature.** K2 deliberately has no delete. Acceptance needed a real record created through the real UI. A throwaway DB + its own dev server gave both: real auth, real write, and total cleanup by dropping the database. Never add a product capability to tidy a test.
- **Hiding the button is not authorization.** Harvesting the real server-action id from the shipped client chunk and replaying it as a `member` — with `tenantId`, `roleId`, `actorId`, `createdBy`, `approvedBy`, `ratifiedAt` and governance ids all forged — returned `forbidden`. That is the proof worth having; the missing button is only cosmetics.
- **Make a limitation a value, not a sentence.** "Coarse role band, not a fine-grained grant" now lives in one exported declaration the resolver derives from and the UI renders verbatim, with a test asserting no code reads the permission tables. A prose caveat rots; a declaration fails the build when it stops being true.
- **Attribution is not an audit log.** Knowing who established the current record is not knowing the sequence of every attempt. Saying so plainly costs nothing and prevents a future phase from assuming coverage that was never there.

### Haftalık 3 soru
1. **What did we learn?** Before accepting an environmental blocker, verify it is environmental. Two phases carried "unproven" that one origin change would have closed.
2. **How does this improve Turkish Rug House?** A real person can now write down a real policy in a real browser, see exactly what it will and will not mean, and know that no one below owner can do it — proven by attacking it, not by trusting the form.
3. **How does this become part of Hebun AI?** Acceptance runs on disposable environments with real identities. Authorization is proven at the server boundary with forged payloads, never at the button. Limitations are declared values that a test can invalidate.

## G1 — The audit sink was already built; nobody had written to it (2026-08-11)

- **Third time this pattern has paid.** K1 found canonical Knowledge tables with no reader. K2 found actor-attribution columns with no writer. G1 found `audit_log` — "the shared, cross-domain, immutable audit sink" — designed, migrated, append-only by construction, with **zero consumers** and a header literally saying immutability "is enforced at the write layer (later)". The instinct on "we need an audit trail" is to design one. Read the schema first.
- **Append-only is a shape, not a promise.** `audit_log` was deliberately built WITHOUT `tenantColumns` — no soft-delete, no `updatedBy`, no version-update. Whoever wrote it encoded the guarantee in what the table *lacks*. `command_audit`, by contrast, uses `tenantColumns` and is therefore structurally mutable, which disqualified it instantly. **Look at which base columns a table refuses.**
- **Same database means the honest answer is a transaction.** Knowledge and its history commit together because both live in the control plane. "Committed but unaudited" and "audited but rolled back" are excluded by the transaction, not by discipline — and no distributed-transaction machinery was needed to say so.
- **A refusal is the event current state cannot record.** A duplicate leaves no row, so attribution columns can never describe it. That single case is the whole justification for a separate history authority.
- **"Authorized" is not an outcome.** Recording committed / rejected / rolled-back — while making authorization the *precondition* for being in the ledger at all — keeps "was allowed to try" from silently reading as "succeeded".
- **Choosing what NOT to log is a design decision, so make it a value.** Forbidden and unauthenticated attempts are events about a principal, not changes to Knowledge. Logging them here would duplicate an authority *and* let an unauthorized user append to a tenant's ledger at will. `KNOWLEDGE_AUDIT_BOUNDARY` is a declared, tested constant — and the resulting gap is written down, not hidden.
- **An audit sink must never become a shadow copy of what it audits.** `previous_state` / `next_state` stay NULL; metadata carries identity and versions only. A test greps the entire sink for the statement text and asserts its absence.
- **Mint the identity before the transaction.** A rolled-back create has no database-assigned id, so its history would have nothing to point at. Generating the fact id up front gives every outcome a stable governed identity.

### Haftalık 3 soru
1. **What did we learn?** Before building governance infrastructure, check whether a previous phase already designed it and left it inert. Three phases in a row, the table existed and the writer did not.
2. **How does this improve Turkish Rug House?** When the shop's policies start changing, there is a record of who tried to change what and whether it was allowed — including the attempts that were refused, which is exactly the part a "who edited this" column can never tell you.
3. **How does this become part of Hebun AI?** Current state and history are separate authorities. What is deliberately not recorded is declared as a value and tested. An audit ledger stores identity, never content.

## K3 — The concurrency test that passed for the wrong reason (2026-08-11)

- **`Promise.all` does not create a race.** Two supersessions fired "concurrently" simply serialized: each read the version the other had just written, and both legitimately succeeded. My first concurrency test asserted a conflict, got two successes, and I nearly read that as a broken guarantee. It was a broken TEST. Forcing the overlap — a third connection holding `SELECT … FOR UPDATE` so both corrections finish their reads and then race for real — is what actually proves it.
- **The browser found what the database test could not.** Compare-and-swap protects two SIMULTANEOUS transactions. It cannot see the slow human case: a form opened against v2, submitted after someone else committed v3, was accepted as v4 — quietly burying a version nobody had read. Every unit test passed. The defect only appeared when a real person's form sat open.
- **Two protections, two different refusals.** The server-read CAS stops lost updates. The version the operator was SHOWN stops silent burial. Neither replaces the other, and conflating them is how you ship half a guarantee.
- **A precondition is not authority.** The observed version travels from the client — which the phase brief nominally forbade — but it can only ever cause a REFUSAL. It selects nothing, grants nothing, and a forged value can only make the request fail. That is the ETag rule, and it is the honest way to satisfy "the client must not hold authority" and "the stale case must refuse" at once.
- **Every field K3 needed already existed.** `supersedes_knowledge_node_id`, `knowledge_version`, `previous_knowledge_node_id`, `fact_version` — all migrated long ago, all unused. Fourth phase running where the schema was ahead of the code.
- **Walk chains iteratively, with a seen-set.** Corrupt data will eventually point backwards. Report `cycle-detected` and stop; never recurse, never "repair" it silently.
- **A legacy in-place edit was hiding in the persistence layer.** `supabase-postgres-adapter` can `update knowledge_nodes set statement = …`. It is unreachable twice over — unrouted, and keyed on a `ref_id` canonical nodes do not have — and both guards are now pinned by test rather than trusted.

### Haftalık 3 soru
1. **What did we learn?** A green concurrency test proves nothing until you prove the two operations actually overlapped. And the case that breaks a versioned system is usually the slow human one, not the simultaneous machine one.
2. **How does this improve Turkish Rug House?** A policy can be corrected without losing what it used to say, and two people correcting it at once cannot silently erase each other — the second is told to look again.
3. **How does this become part of Hebun AI?** Corrections create versions; nothing is edited in place. Restoring old wording makes a new version, never a reactivation. Client-supplied values may refuse an operation, never authorize one.

## K4 — The phase that should not be built yet (2026-08-11)

- **The schema named its own owner, and it was not us.** `governance.ts` says outright: "Governance is the ONLY authority that may approve / ratify / promote / certify…" and "This file is SCHEMA ONLY — NO authorization engine… enforced at the write layer later." Knowledge cannot ratify Knowledge. Reading the header was the whole phase.
- **Zero-migration is not the same as legitimate.** `ratified_at` and `ratified_by_actor_*` are nullable columns. Setting them would have needed no migration, and the K1 read would have flipped `ratified` to true immediately. It would also have meant ratification with no decision, no justification, no accountable actor — and would have quietly turned the coarse owner/director band into a governance authority. The cheapest patch was the dishonest one.
- **Four phases of "the schema was ahead of the code" ended differently here.** K1/K2/G1/K3 each found a table waiting for its first writer, and writing it was correct. K4 found the same shape — and writing it would have created an *authority*, not a feature. Same surface, opposite answer.
- **The schema had already reserved the vocabulary:** `governance_domain: knowledge-ratification`, `decision_type: ratify`. Finding your exact use case pre-declared in someone else's enum is a strong signal that the capability belongs to them.
- **A mock, an in-memory engine, and a read projection are three different kinds of "not an authority."** `approvals/mock.ts` is a fixture, `human-approval/*` computes over simulations with no DB, `decision-runtime` is a dashboard projection. None decides anything, and none of them was close enough to extend.
- **Stopping produced more value than shipping would have.** The blocked report settles the semantics in advance — ratification binds to a version not a fact, stale review must refuse, content never mutates — so the eventual phase starts from decisions already made rather than re-litigating them.

### Haftalık 3 soru
1. **What did we learn?** When the missing piece is an authority rather than a table, no amount of available columns makes it implementable. Check who the schema says owns the verb before checking whether the fields are nullable.
2. **How does this improve Turkish Rug House?** Nothing in the shop's Knowledge will ever be labelled "ratified" without a real recorded human decision behind it — the badge will mean something the first time it appears.
3. **How does this become part of Hebun AI?** One concept, one authority — including for verbs. Ratification belongs to Governance, and Knowledge asks for it rather than granting it to itself.

## G2 — Blocked one level deeper than the last block (2026-08-11)

- **Two gates in a row, and they were not the same gate.** K4 stopped because the governance decision *runtime* was missing. G2 stopped because the *entitlement to be that authority* is not determined by anything in the repository. "Build the missing runtime" was the obvious next move and it was still not implementable.
- **The schema disproved the shortcut by its own design.** The tempting move was to gate governance on the connected owner/director band. But `governance.ts` models the bootstrap decision as "the first authority in a tenant" — authority is something a governance decision *establishes*. If the role band already conferred it, bootstrap would be redundant. The schema argued against the shortcut better than any policy could.
- **A constitutional-sounding sentence is not a grant.** "The Director is the accountable human in whom decision authority resides" lives in Heby's identity boundary and constrains *Heby*. It does not map `roleTypeEnum` to governance entitlement. Quoting it as authorization would have been motivated reading.
- **Check whether the fields are populated, not just present.** `roles.system_role`, `authority_rank`, `policy_refs`, `memberships.authority_scope`, `delegated_by_*` all exist and every one is unset and unread. Five plausible answers, zero of them real.
- **When the blocker is a decision, deliver options, not a shrug.** Three concrete bootstrap models, each zero-migration once chosen, with the fast one explicitly marked rejected and why. A gate report that only says "cannot proceed" wastes the Director's turn.
- **Settle semantics while blocked.** Append-only decisions, mandatory human justification, version-bound subjects, audit through G1, `ratify`/`reject` only, Heby read-never-write — all decided now so the eventual phase starts from a design rather than a debate.

### Haftalık 3 soru
1. **What did we learn?** Unblocking one layer can reveal that the layer beneath was never settled either. Ask "who is entitled?" before "what does the code do?" — entitlement is not derivable from an empty table.
2. **How does this improve Turkish Rug House?** The first person who can ratify company knowledge will be named deliberately, not inherited from whoever happened to hold an owner seat.
3. **How does this become part of Hebun AI?** Authority is established by an explicit human decision, never inferred from a role, a flag, or an empty table. A phase that would have to guess who is entitled stops and asks.

## D1 — Authentication answers "who", never "what may they do" (2026-08-11)

- **The order IS the security property.** No session material is generated until scrypt has verified the password. Resolving membership *after* verification is deliberate: an unknown email, a missing credential and a wrong password all spend the same work and return the same marker, so the login page cannot be used to discover who exists.
- **A credential grants no authorization.** `auth_credentials` carries no tenant, no membership, no role, and never will. Identity = who this human is; credential = what they proved; session = the proof's receipt. Three tables because they are three different facts.
- **Durable lockout, because Postgres is the only shared state.** A process-local counter would claim a protection a second server process would not honour.
- **aal1 is the truth, so aal1 is what is written.** `mfaVerified: false` everywhere, the login page says single-factor out loud, and no code path can inflate it. The honest label is what makes a later step-up phase possible.

### Haftalık 3 soru
1. **What did we learn?** Authentication and authorization are different questions, and keeping them in different tables is what stops one from silently answering the other.
2. **How does this improve Turkish Rug House?** Nobody signs in by typing an email any more — the shop's data sits behind a password that is actually checked.
3. **How does this become part of Hebun AI?** Prove first, issue second. Anything that mints authority before verification is the bug, however convenient.

## D1.1 — Destroy only what you can prove you created (2026-08-11)

- **A prefix is not proof. A naming convention is not proof. "Looks disposable" is not proof.** A real database was destroyed by `list databases → match prefix → drop each match`. The fix was not a better pattern; it was removing the ability to express one.
- **The API is the guard.** `dropDatabase()` takes no arguments — no name, no pattern, no list — and refuses unless *this handle* ran `create database` successfully. A "clean up stale test databases" helper is the same mistake wearing a different hat.
- **Reading the catalogue is fine; pattern-matching it is not.** `where datname = $1` answers "is the one I made gone?". `LIKE 'hebun%'` answers a question nobody should ask.
- **A dev tool must not become a bypass.** Credential provisioning lives outside `src/`, refuses non-local databases and production, takes the password only from a hidden TTY prompt, and reuses the production hasher — so it creates a real credential and never a way around one.

### Haftalık 3 soru
1. **What did we learn?** Make the dangerous operation unrepresentable rather than well-documented.
2. **How does this improve Turkish Rug House?** Test infrastructure can no longer reach the shop's real database, whatever it is told to do.
3. **How does this become part of Hebun AI?** Destructive capability is scoped by ownership proof, never by naming discipline.

## G2.1 — Being who you say you are is not permission to govern (2026-08-11)

- **D1 solved a different problem than the one that was blocking us.** "I proved this is Human A" and "Human A may establish this tenant's first Governance authority" are separate facts, and no amount of authentication produces the second.
- **Every candidate root failed for a different reason, and cataloguing that was the phase.** `permissions`/`role_permissions`: schema-only, zero rows, zero readers. `organizations.owner_actor_*`, `invitations`: never written. `companies.created_by`: NULL everywhere, and provenance is not entitlement. `roles.type`: seeded by a script, never established by any ceremony.
- **The circularity test terminated in exactly one place: possession of the deployment.** Every in-app authority class roots there too, one hop later — so the honest design put the root where it actually is.
- **Two keys, because one is a lie either way.** A CLI alone cannot say which human; a signed-in human alone would be self-nomination. Operator writes `pending`, the named human accepts under a verified session, and no product surface can create a nomination at all.
- **An audit row that cannot name its actor truthfully is worse than no audit row.** The operator ceremony is not written to `audit_log` — `actor_id` is NOT NULL and deployment possession names nobody. The nomination row is that act's record instead.

### Haftalık 3 soru
1. **What did we learn?** When a phase needs a fact the repository does not contain, catalogue every candidate and show why each fails — then the Director decides once, with evidence.
2. **How does this improve Turkish Rug House?** The first human who can govern the shop is named deliberately and accepts it knowingly.
3. **How does this become part of Hebun AI?** Entitlement is granted by an explicit act, never inherited from a seat, a seed, or a login.

## G2 — The constitution moved from a comment into Postgres (2026-08-11)

- **`governance.ts` had documented both invariants since the foundation migration, with the note "enforced at the write layer later".** G2 was that layer. An invariant only the application enforces is not an invariant: two concurrent requests both read "no bootstrap yet" and both insert.
- **A partial unique index and a CHECK are the whole constitutional guarantee.** One genesis per tenant; a genesis actor is always human. Everything else in the phase depends on those two lines holding under concurrency.
- **Consumption is recorded, never inferred.** "A bootstrap decision exists, therefore the entitlement was spent" correlates two facts that could drift apart later. `consumed_at` + `consumed_by_decision_id` say it outright.
- **The role band was refused again, and the schema argued the case.** If `roles.type = owner` conferred Governance authority, the bootstrap decision — described as "the first authority in a tenant" — would be redundant.
- **Post-bootstrap authority was derivable, so no gate was raised.** The bootstrap decision's own actor holds it, because Governance is documented as the only authority that may ratify/certify/delegate, and authority moves only by a decision.

### Haftalık 3 soru
1. **What did we learn?** When a header says "enforced later", the phase that arrives is obliged to actually enforce it — in the database, not in a function.
2. **How does this improve Turkish Rug House?** The shop's governance can begin exactly once, by a named human, with a written reason.
3. **How does this become part of Hebun AI?** Constitutional rules live in constraints; application code may add refusals but never be the only defence.

## K4 — Ratification belongs to a version, not to a name (2026-08-11)

- **G2's subject vocabulary was wrong, and K4 is what exposed it.** A `knowledge_fact` is a timeless identity whose active version moves, so a decision bound to it silently means "whatever is current when you read this". The fix was to bind to `knowledge_node` and to REMOVE the fact-level subject rather than keep both — a leftover fact-level ratify decision would later be mistaken for version ratification.
- **RATIFIED ≠ TRUE.** It means the organization's Governance authority approved that exact version. A test bans confidence, certainty, "guaranteed" and "factually correct" from every K4 surface, because an organizational status quietly becoming an epistemic claim is the failure mode.
- **The old read was a shortcut that became a lie.** `ratificationDecisionId ?? ratifiedAt` was harmless while both columns were always NULL and false the moment a runtime existed: a timestamp with no decision behind it would claim approval nobody gave.
- **Rejection writes nothing.** There is no "rejected" column, and manufacturing one from `knowledge_lifecycle_status` would have invented semantics the repository never defined.
- **Zero migrations, because the schema had been waiting.** Five columns and two foreign keys already pointed at Governance.

### Haftalık 3 soru
1. **What did we learn?** Check what a subject identifier actually identifies before binding authority to it — "the record" and "this version of the record" are different things.
2. **How does this improve Turkish Rug House?** A ratified price policy means someone approved *that wording*; changing it starts again from unratified.
3. **How does this become part of Hebun AI?** A phase may correct an earlier phase's vocabulary when it is wrong, and must say so plainly rather than working around it.

## G3 — Authority is a provenance graph, not a boolean (2026-08-11)

- **Three constitutional questions were not derivable, and guessing any of them would have been permanent.** Who may revoke a peer's delegation; whether genesis can be revoked; whether a tenant may reach zero authorities. Each was put to the Director with options and consequences, not a shrug.
- **The mutex was a row that already existed.** Authority is a query over decisions, so there is nothing to lock — except the tenant's bootstrap decision, unique and always present. Locking it serialized every authority mutation without inventing an active-authority table to keep in sync.
- **Revocation never touches the delegation.** A `revoke` decision names the delegation, and authority resolution is a `NOT EXISTS`. History reads "delegated at T1, revoked at T2" forever, and revocation is not retroactive: decisions made while authorized still stand.
- **Extending one resolver beat adding one.** K4 already called `resolveGovernanceAuthority`, so delegates gained ratification with no K4 change at all — and lost it on revocation the same way.
- **A constant that describes the system must be updated when the system changes.** `POST_BOOTSTRAP_AUTHORITY_MODEL.transferable` flipped to `true`; leaving it `false` would have been the model lying about itself.
- **Delegation prevents stranding; it cannot cure it.** A bootstrap human who disappears before delegating leaves nobody able to delegate. That is A2-a's accepted cost, documented rather than half-solved.

### Haftalık 3 soru
1. **What did we learn?** Model authority as "which decision granted this, and which one ended it" — a boolean role cannot answer who, when, or by whose authority.
2. **How does this improve Turkish Rug House?** Governance no longer depends on one person being available, and every grant and withdrawal stays on the record.
3. **How does this become part of Hebun AI?** Authority changes are decisions with reasons and provenance, and their history is immutable.

## I2 Gate A — Onboarding is blocked by session authority, not by schema (2026-08-12)

- **The artifact chain needs zero migrations.** `invitations` is schema-only but complete: `token_hash char(64)` + `token_version` match `session-digest.server.ts` exactly, `expires_at` is NOT NULL and CHECK'd, revocation columns are all present. Issuance, consumption, expiry, revocation, acceptance and membership creation are all representable today.
- **The blocker is `issueLocalSession` requiring an active membership.** A brand-new human cannot hold a Hebun session before a membership exists, and `user_session_contexts_tenant_membership_chk` makes the membership-less shape unrepresentable at rest. So either the token creates the human (invitation becomes Identity authority — forbidden) or Session authority changes (not I2's to change). No third option exists in the repository.
- **No product code has ever created a `users` row.** Zero writers in `src/`, zero in `scripts/lib/`. Both durable humans came from `scripts/r1-seed.mjs`. `insertPasswordCredential` exists and has no caller. "The function exists" is not "the capability exists".
- **There is no mail runtime, so token possession proves nothing about the address.** Zero dependencies, zero code, zero env keys. `invitations.last_sent_at` and `send_count` describe an act Hebun cannot perform, and writing them would be a claim of delivery.
- **Double-accept is prevented by the wrong table, and that is fine.** Nothing on `invitations` stops two accepts; `memberships_accepted_invitation_uq` does. Read the invariant where it actually lives, not where the name suggests.
- **`memberships` lacks the composite `(tenant_id, role_id)` FK that both `invitations` and `membership_authorizations` have.** Copying the pair from one invitation row is a database-proven pair, not an application check — meaningfully stronger, still not an invariant on the table.

### Haftalık 3 soru
1. **What did we learn?** Before designing a lifecycle, check what the *session* authority can represent — a phase can be schema-complete and still impossible.
2. **How does this improve Turkish Rug House?** Nobody gets invited into a system that cannot let them in; the gap is named before a half-working onboarding is shipped.
3. **How does this become part of Hebun AI?** When ownership of an artifact is undecided, the phase stops and names the decision instead of picking one quietly.

## I2 Blocker Resolution — The deadlock was in the resolver, not the schema (2026-08-12)

- **The previous audit was wrong about Postgres, and re-reading the live constraint is what caught it.** `user_session_contexts_tenant_membership_chk` is `(active_tenant_id IS NULL) = (active_membership_id IS NULL)` — both-NULL passes. The table has always been able to hold a membership-less session. What refuses one is `resolveSessionFromReference:308` and the `TenantContext` type. Read the constraint from `pg_constraint`, not from the schema file's prose.
- **Authentication was never coupled to membership.** In `issueLocalSession`, identity lookup and credential verification touch no membership table; `findPrimaryActiveMembership` is the *fourth* step. "Session requires membership" is true only of normal tenant session issuance. The deadlock was three steps narrower than described.
- **The contract already described a bigger system than the runtime.** `onboarding-required` and `tenant-selection-required` sit in the `AuthenticationResult` union with zero producers and zero consumers, asserted only by a union-membership test. Check the type union before designing a new state — it may already be named.
- **An allow-list route gate makes new auth states safe by construction.** `if (result.status !== "authorized") redirect("/login")` means any status added later reaches nothing. A deny-list would have made the same change dangerous.
- **"Verified" meant nothing.** Both live `auth_identities` rows carry `verified_at` = the seed's `now()`. No verification event ever happened and no code path could perform one. Before trusting a lifecycle column, find the code that writes it.
- **The dev-tool quarantine protects a tool, not a capability.** `provision-dev-credential.ts` never called `insertPasswordCredential` — it duplicates the insert in raw SQL. So the production primitive can be wired up without touching, importing, or weakening the quarantined path.
- **The unanswerable question is the one with no precedent, not the one with no code.** Identity creation had no writer but a fully designed authority, so it was answerable. First-credential proof had no precedent anywhere in the repository, so it was not — that is what a Director decision actually looks like.

### Haftalık 3 soru
1. **What did we learn?** When a blocker is reported, re-derive it from the live constraint and the call order — the layer that actually refuses is often not the layer that was blamed.
2. **How does this improve Turkish Rug House?** Nobody builds a whole authentication phase to solve a coupling that was never there.
3. **How does this become part of Hebun AI?** A phase may overturn the previous phase's finding when the evidence says so, and must say plainly which claim was wrong.

## I1.2 Gate B — A global unique index with no delete is a permanent slot (2026-08-12)

- **The obvious "no new table" answer was the dangerous one.** Using `auth_identities` in its designed `pending` state needed zero schema — and would have let a rejected enrollment permanently burn `users_email_uq` and `auth_identities_provider_issuer_subject_uq`. Both are non-partial, both tables are soft-delete only, and `revoked` keeps the row. A stolen invitation would have harmed the human the second key exists to protect.
- **Read index definitions from `pg_indexes`, not from the schema file.** The absence of a `WHERE` clause is the whole finding, and prose comments do not carry it.
- **A confinement test can eliminate an entire design family.** `tests/d1-flow/boundaries-and-firewall.ts` allows only three files in `src/` to name `secret_hash`. That single rule killed every "hold the hashed credential somewhere until approval" model without further argument.
- **Ordering fell out of the invariants, not from taste.** Once no identity row may exist before approval, the credential cannot exist either (`auth_credentials.auth_identity_id` is NOT NULL), so the secret must arrive after approval. Model C was forced, not chosen.
- **Self-approval needed no new constraint.** A brand-new human has no identity, so no session, so no `TenantContext`, so no `resolveGovernanceAuthority`. The invariant that blocked onboarding is the same one that makes the two keys unforgeable by one person.
- **Provenance belongs where every case can answer it.** A Governance decision, an enrollment row and an audit entry each answer only for identities that came through this phase. The seeded rows and future OIDC rows have none — so `verification_source` on `auth_identities` is the only universal owner. Do not add `verified_by_*` beside it: `decision_records.actor_id` already owns the actor.
- **A composite tenant FK needs its companion unique index.** `invitations` has no `(tenant_id, id)` unique, so structural tenant binding to an invitation is impossible until one exists — `memberships_tenant_id_id_uq` and `roles_tenant_id_id_uq` are the pattern.

### Haftalık 3 soru
1. **What did we learn?** Before reusing an existing table for a rejectable state, ask what a rejection leaves behind — a global unique index with no hard delete makes rejection permanent.
2. **How does this improve Turkish Rug House?** A refused invitation cannot lock the intended person out of ever joining.
3. **How does this become part of Hebun AI?** The narrowest change is the one measured against the live constraints, not the one with the fewest files.

## B-4 necessity proof — absence of a row is an answer, not a gap (2026-08-12)

- **The universality argument that justified `auth_identities.verification_source` refuted itself.** It disqualified the alternatives for not covering the two seeded identities — and then conceded the column would be NULL for exactly those rows. A justification that does not survive its own caveat is not a justification.
- **A missing join row is information.** "No `identity_enrollment_requests` row references this identity" *is* the statement "no Governance ceremony vouched for it". Treating a zero-row result as an unanswered question is how derived columns get invented.
- **`provider` + `issuer` already is the verification method.** That is what a provider-neutral tuple is for. `verification_source='oidc'` beside `provider='oidc'` is a verbatim copy; `verification_source='governance-two-key'` beside `provider='oidc'` collapses five distinct facts into one varchar, and an OIDC identity that also passed the second key is born with two true values.
- **Check who actually reads the column you are extending.** `auth_identities.verified_at` is read by exactly one thing in the whole repository — the CHECK constraint `auth_identities_active_chk`. No TypeScript selects it. A *reason* column would be read even less.
- **I cited a precedent without checking where it lives.** `genesis_nominations.nomination_source` sits on the **ceremony** table and points at `auth_identities`; G2.1 had the same need and added nothing to the identity table. The faithful analogue was the enrollment artifact all along.
- **"Which record wins in a disagreement?" settles duplication fast.** If a foreign-key chain must win over a varchar, the varchar was never the authority — it was a copy with a synchronisation rule attached.

### Haftalık 3 soru
1. **What did we learn?** Before adding a provenance column, write the query that answers the question without it — if it returns strictly more, the column is a read model, not a fact.
2. **How does this improve Turkish Rug House?** One less field that can quietly disagree with the record it summarises.
3. **How does this become part of Hebun AI?** A phase may overturn its own proposal when the necessity proof fails, and must name the flawed step rather than quietly dropping the item.

## I1.2 — The firewalls caught three real violations, and each fix was better than the code it replaced (2026-08-12)

- **Hashing in the feature module leaked credential material into a fourth file.** `tests/d1-flow/boundaries-and-firewall.ts` allows only three files in `src/` to name the stored secret, and it fired the moment the enrollment module held `salt`/`secretHash`. The fix was not a wider allowlist — it was `establishFirstPasswordCredential`: plaintext in, id out, composition owned by Credential authority. The rule forced a better boundary than the one first written.
- **Writing `audit_log` directly tripped three separate tests at once** (g1, g2, k2). The house pattern is a declared sibling writer under `governance-audit/` with its own boundary constant and entity type. Adding a fourth owner is a deliberate three-line edit in three lists; reaching the sink from a feature module is not possible by accident.
- **Firewalls that forbid a literal string forbid it in comments too.** `provision-dev-credential` in a prose sentence and `secret_hash` in a schema header both failed the scan. Reword the prose — the strictness is the point, and narrowing the regex to "code only" would hand the next author a loophole.
- **drizzle-kit emits `ADD CONSTRAINT ... UNIQUE` after the FK that references it.** `ERROR: there is no unique constraint matching given keys` — the generated file was unappliable. Reorder the statements (the set is identical), and add a test asserting the ordering so a regenerated migration cannot silently lose it.
- **`invitations_expiry_chk` means an "expired" fixture must move BOTH timestamps into the past.** Inverting them is a constraint violation, not a shortcut. Anchor test timestamps to the test's own clock, never to `now()`, when the runtime under test has an injected clock.
- **Count deltas, not totals.** Absolute row-count assertions broke the moment a fixture was added three cases earlier. Snapshot immediately before the act under test and assert what THAT act changed.
- **A capability scan must exempt the honest-denial list.** `NON_EFFECTS` names Computer Use and terminal in order to say they do not happen; scanning it as if it were runtime turns a truthful note into a violation and quietly rewards hiding limits.

### Haftalık 3 soru
1. **What did we learn?** When an existing firewall fires, assume it is right — the fix it forces is usually the boundary the design should have had.
2. **How does this improve Turkish Rug House?** A refused enrollment cannot lock the intended person out, and a password never exists anywhere but the authority that owns it.
3. **How does this become part of Hebun AI?** New capability arrives as a declared sibling with its own boundary constant, never as a direct reach into a shared sink.

## I2 — Membership existence is not tenant access, and the difference had to be proven (2026-08-12)

- **The brand-new human's acceptance could not use a session, so it used the credential.** A human who has just enrolled has an identity, a credential and zero memberships, and `issueLocalSession` refuses exactly that shape. Verifying the credential answers "which human?" without minting anything — which is what identity binding actually needs. Requiring a session would have forced a Session-authority change for no gain.
- **The binding must be checked AFTER the password, never before.** Comparing the authenticated email to the invitation's target first would leak which address a stolen capability was issued for. Checked after, a wrong human costs exactly what a wrong password costs, and unknown-email / no-credential / wrong-password / wrong-human all return one sentence.
- **The column name settled a design argument.** `membership_authorizations.consumed_by_invitation_id` is a foreign key to the *invitation*, so consumption happens at issuance — not at acceptance. Read the FK target before deciding what a lifecycle word means.
- **Do the conditional update on the row two callers actually contend for, and do it first.** Acceptance flips the invitation before inserting the membership, so the row lock lands on the invitation. That single ordering is what makes "two humans race one invitation" resolve cleanly.
- **Snapshot counts immediately before the act under test.** Absolute totals drift every time a fixture is added earlier in the file; deltas measure what the act did.
- **A firewall I wrote myself was too strict and had to be corrected, not deleted.** Banning any client component from naming `human-onboarding` would have banned importing pure types — the rule that protects the bundle is "no `.server` module", plus a separate assertion that `contracts.ts` has no I/O.
- **State the limitation as a frozen value, not as prose.** `TENANT_ACCESS_REALITY` and the non-effects list are asserted by test, so "the second membership is unreachable" cannot quietly disappear from the surface when someone edits the copy.

### Haftalık 3 soru
1. **What did we learn?** Finish the transition you own and prove where it stops — a correct membership that nobody can use is a limitation to name, not a success to claim.
2. **How does this improve Turkish Rug House?** Someone can actually be brought into the organization end to end, and nobody is told an email was sent when nothing was.
3. **How does this become part of Hebun AI?** A phase composes existing authorities and adds one canonical truth; when the next step needs a different authority's decision, it stops at the boundary and says so.

## Tenant Selection — the schema had already permitted the state nobody had written (2026-08-12)

- **The pre-tenant session needed no migration.** `user_session_contexts_tenant_membership_chk` is `(tenant IS NULL) = (membership IS NULL)`, so both-NULL was always legal and the composite FK is MATCH SIMPLE. The I1.2 blocker audit proved this months of work earlier; this phase spent it. Findings from an audit are assets — go back and read them before designing.
- **Put the new page under an already-public prefix instead of widening the rule.** `PUBLIC_PREFIXES = ["/login"]` matches `startsWith("/login/")`, so `/login/select-workspace` needed zero middleware change and the dashboard stayed exactly as protected. Choosing the route was cheaper than changing the gate.
- **`membershipId` beats `tenantId` as the selection input.** It names the entitlement itself, so revalidation is one lookup keyed by the thing that must be true. A tenant id would have needed an inference step between the human's intent and the check.
- **Check the binding AFTER the expensive check, and give every failure one sentence.** Guessed uuid, another human's real membership, revoked, stale tenant — all `membership-unavailable`. Any difference turns a picker into a membership-table probe.
- **Issue a fresh receipt; never re-point an old one.** The only session writers were an activity touch and a revocation, and that was the answer: a session is an authentication receipt, so selection writes a new row and revokes the old one. A test extracts every `.update(...).set({…})` and asserts the set of writers, which is a stronger guard than any comment.
- **Take the version from the row you just read, never from the list you showed.** The candidate list is stale by definition; a session carrying a remembered version would be rejected by the resolver on the very next request.
- **When a phase resolves an earlier phase's documented limitation, invert the fixture and say so.** I2's contracts and tests asserted "NOT reachable". Updating them to the new truth — with the reason in the comment — is the honest move; relaxing an invariant to keep an old assertion green is not.

### Haftalık 3 soru
1. **What did we learn?** Before designing new state, re-read what the schema already allows — the cheapest feature is the one the constraints were written for.
2. **How does this improve Turkish Rug House?** Someone who works with two organizations picks which one they are opening, instead of silently landing in the older one.
3. **How does this become part of Hebun AI?** A phase may close an earlier phase's stated limitation, and must rewrite that phase's claims to match rather than leaving two truths on disk.

## I1 — The refusal that exposed a gap instead of hiding it (2026-08-12, recorded late at the P3 commit gate)

- **The right move was to refuse and name it.** I1 permits onboarding into `member` alone, and no tenant had a `member` role, so I1 refused every real tenant. Creating one inside I1 would have closed the gap and hidden it — and every fixture that silently added a role would have hidden it again in the tests. `insert(roles)` appears nowhere in I1's runtime and a test asserts it never will.
- **A product absence gets its own refusal reason.** `no-eligible-role-in-tenant` is separate from `role-unresolvable` on purpose. Reporting "this tenant has no role you could ever name" as a bad input turns a real limitation into a user error, and nobody ever finds it again.
- **Read the role band for the TARGET, never for the CALLER.** I1 reads `roles.type` — but only to decide which band may be onboarded into. Letting the same read answer "may this caller authorize?" is exactly how a role-based authority model gets re-invented by accident. Two questions, two reads, one test keeping them apart.
- **The circular NOT NULL pair needs an id, not a second table.** Decision names authorization, authorization names decision, both columns NOT NULL. Generating the UUID in the application was the authorized answer; minting an `invitations` row to borrow an id would have created token material inside an authority phase and falsified I1's own non-effects list.
- **Refuse a foreign tenant's role as `unresolvable`, never as `forbidden`.** A distinguishable "forbidden" turns the role field into a cross-tenant existence probe. Unresolvable and never-existed must be the same sentence.
- **The pre-flight read is a courtesy; the partial unique index is the invariant.** Two concurrent authorizations both pass the read. Match the unique violation on the Postgres code AND the constraint name, so an unrelated conflict cannot borrow the friendly refusal.
- **Writing the closure record is part of the phase, not paperwork after it.** I1 was built, proven and closed with no closure document, and the omission was invisible until a commit gate audited the record against the implementation. An undocumented phase is also an unsupervised one — see the next entry.

### Haftalık 3 soru
1. **What did we learn?** When a correct authority cannot be used yet, refuse and name the absence — a convenience that makes the refusal disappear also makes the absence disappear.
2. **How does this improve Turkish Rug House?** Nobody is admitted into a role the organization never decided to have, and the reason onboarding is not yet possible is stated instead of guessed.
3. **How does this become part of Hebun AI?** A phase ships its own record; authority that nobody wrote down is authority nobody can audit.

## I1.1 — Closing an earlier phase's limitation is only half the work (2026-08-12, recorded late at the P3 commit gate)

- **The narrowest closing move was two SQL statements.** One `governance_domain` value and one partial unique index. No table, no enum, no column, no new decision type, and no change to I1 — I1 discovers the provisioned role through its ordinary eligible-role read. The test drives I1 across the boundary: `no-eligible-role-in-tenant` before, `authorized` after.
- **Constants instead of parameters is what makes "not role administration" true.** No name parameter, no type parameter, no scope, no update, no delete. "Provision an owner role" is not filtered out — it has no representation to arrive in. A validated parameter would have been a role-creation API wearing a smaller name.
- **Make the uniqueness index partial, and leave the lifecycle predicate off.** `WHERE type = 'member'` alone: privileged bands stay unconstrained, and adding `AND lifecycle_status = 'active'` would have described a state no runtime can reach while quietly weakening the invariant to "one *active* member role".
- **Do not borrow another phase's mutex.** G3 locks the bootstrap decision row because authority has no row of its own. Here the unique thing IS a row, so the index locks it. Reusing G3's lock would have coupled two unrelated invariants and still left the index doing the real work.
- **"Already provisioned" must be true for roles this phase did not create.** The existence read matches on type with no lifecycle predicate, so it asks exactly what the index answers. A seeded role is still the tenant's member role, and claiming otherwise to make the ceremony look load-bearing would be a lie about history.
- **THE REAL DEFECT: I1.1 closed I1's limitation and left I1 still declaring it.** `TENANT_ROLE_BASELINE_GAP` kept saying the gap had no owner and that onboarding was not reachable end to end — on a live Governance page, in the card directly below the control that closes it. The whole suite stayed green *because* a test froze the stale strings. Understating capability is as false a record as inflating it, and a green build is not evidence that a claim is still true.
- **Separate the capability from the deployment.** "No runtime can do this" and "the durable tenant has not run the ceremony" are different facts. Collapsing them into one field is what let the stale claim look plausible for as long as it did; the repair splits them into `capabilityPresent` and `provisionedInDurableTenants`.
- **A firewall banning a symbol bans it in code, comments excepted — reword, never widen.** Naming I1.1's runtime inside I1's contracts tripped the rule that keeps I1 unable to reach the provisioning path. The fix was to name an authority and a surface instead of an importable identifier. The rule was right; the prose was wrong.

### Haftalık 3 soru
1. **What did we learn?** Resolving an earlier phase's limitation is not finished until that phase's own claims, surfaces and tests say so — otherwise the system keeps advertising a gap it already closed.
2. **How does this improve Turkish Rug House?** The person setting up an organization is told which control creates the missing role, instead of being told the capability does not exist.
3. **How does this become part of Hebun AI?** Every honesty constant carries an owner and a supersession, and a test that freezes yesterday's truth is treated as a defect rather than as coverage.

## Post-Login Tenant Switching — The mirror-image firewall beats the widened one (2026-08-13)

- **A refusal that protects a PUBLIC surface must not be widened; give it a sibling instead.** `selectTenantForSession` refused tenant-bound receipts, and the tempting move was to relax that one condition. But the picker lives under `/login`, the one public route prefix — relaxing it would have made a live authorized session re-pointable from a public surface. Two entry points with opposite preconditions, each refusing the other's input, sharing one revalidation reader and one assembly path: no authority duplicated, no firewall weakened.
- **"Authorized enough to act" and "authorized enough to switch" must be the same function, not the same predicates.** Re-implementing the resolver's checks inside the switch would have been fifteen lines that drift. Calling `resolveSessionFromReference` costs one extra query on a rare human-initiated action and makes drift unrepresentable — a session the product refuses can never launder itself into a fresh one.
- **A transition that proves no credential must not restart the credential's clock.** Carrying `authenticated_at` and `absolute_expires_at` over is the whole difference between an absolute TTL and an inactivity TTL with extra steps; a human who switches every eight hours would otherwise never be signed out. Initial selection restarting the window is fine only because the receipt it replaces lives ten minutes.
- **Revoke conditionally and FIRST when the thing being spent is what two callers contend for.** `WHERE revoked_at IS NULL … RETURNING` inside the same transaction as the insert — the invitation authority's own idiom — turns "two concurrent switches" from two live sessions into exactly one winner. Sign-out's unconditional revoke stayed unconditional: it is idempotent by nature, and one writer's needs must not reshape the other's.
- **A test that counts writers is weaker than one that counts writer SHAPES.** Adding a second, legitimate revoke writer broke an assertion comparing the *list* of `.set({…})` shapes. Comparing the deduplicated set keeps the real invariant — nothing may set a session's tenant or membership — while allowing a writer the invariant never forbade.
- **Do not invent an audit trail for an authority that has never written one.** Session authority writes no audit row for sign-in, selection or sign-out. Adding one only for switching would have looked rigorous and would have been a new durable artifact with no owner. The record already existed: the spent row keeps its tenant and gains a reason, the fresh row names what it was issued for.
- **When a concurrency test cannot pin an outcome, assert the invariant and prove the primitive separately.** The losing switch reports `no-active-session` or `switch-superseded` depending on interleaving. Forcing one answer would have made the test lie about the system; asserting "exactly one winner, exactly one new row" and proving single-spend deterministically on its own says what is actually true.
- **A pre-existing gap found mid-phase gets reported, not quietly repaired.** No constraint ties `memberships.role_id` to the membership's tenant. Tightening the shared reader would have retroactively changed I1, I1.1 and the sign-in picker from inside a session phase. The honest move was a test proving switching is *exactly as strict as sign-in, never weaker*, and a named next frontier with its own Gate B.
- **The closure record is part of the phase, and its absence is invisible until a commit gate looks.** This phase was built, proven and closed with the report delivered only in conversation; the document every predecessor has was missing on disk. Second occurrence of exactly the lesson I1 recorded — a phase is not finished when the tests pass, it is finished when the record exists.

### Haftalık 3 soru
1. **What did we learn?** When an old refusal blocks a new capability, first ask what that refusal is protecting — the answer usually names the shape of the correct extension, and it is rarely "delete the condition".
2. **How does this improve Turkish Rug House?** Someone who works with two organizations moves between them without signing out and back in, and the session they leave behind stops working the instant they do.
3. **How does this become part of Hebun AI?** Every session transition mints a new receipt and spends the old one exactly once, so "which tenant was this request for" always has one durable answer and never a rewritten one.

## Membership–Role Tenant Integrity — Two correct foreign keys are not one correct fact (2026-08-13)

- **Tenant ownership encoded only in separate foreign keys is weaker than binding the tenant and the referenced object together.** `memberships.tenant_id → companies.id` was valid. `memberships.role_id → roles.id` was valid. Both valid, and the pair still meaningless: nothing said the role belonged to that tenant. Two independently correct references do not compose into the fact you actually meant.
- **Before designing the fix, look for the same question already answered elsewhere in the schema.** `invitations`, `membership_authorizations` and `role_permissions` all already referenced `roles (tenant_id, id)`. Every table that merely INTENDS a role was structurally unable to name a foreign tenant's; only `memberships` — the row that turns a role into live authority — was not. The design was not a decision, it was a pattern with one hole in it.
- **The parent side is usually already there. Check before adding it.** The obvious candidate was "add UNIQUE (tenant_id, id) to roles, then the composite FK". Half of that was already true: `roles_tenant_id_id_uq` had existed since the auth identity schema foundation. Gate B shrank from two statements to one by reading the migration history instead of trusting the proposal.
- **A dead helper is a recorded decision.** `findRoleForTenant` had sat in the auth repository since R1 with zero call sites. That is the repository saying, in code, that it had considered the runtime-check approach and never adopted it. Adopting it now would have re-litigated a settled question with a weaker mechanism.
- **MATCH SIMPLE is what makes a composite FK on a nullable column safe.** `role_id` is nullable and the resolver treats "no role" as a refusal, not an impossibility. Default MATCH SIMPLE exempts a row where any key column is NULL, so the invariant tightened the cross-tenant case without touching the legitimate one. Worth knowing before reaching for MATCH FULL by reflex.
- **Add, do not drop.** The old single-column FK is now redundant. Removing it was neither authorized nor necessary — a redundant constraint costs a little and removing one you were not asked to remove costs a review.
- **THE REAL FIND: five sibling tests asserted a global migration count as a proxy for "my phase added no migration".** None of them was testing this phase, and all five failed. A phase-scoped claim expressed as a repository-wide constant is falsified by every later authorized migration, so the suite punishes legitimate work and teaches people to edit numbers until it goes green. Filenames are timestamp-prefixed, so the durable form is "the migrations that existed when I closed are intact, and none bears my name — then or since".
- **The test that caught it correctly is the one to copy.** `g3-flow` enumerates every migration permitted beyond G2's, precisely so no phase can add schema silently. It failed for the right reason and was fixed by declaring the new migration, not by loosening the rule. A test that fails because someone did authorized work is either the best test in the suite or the worst one — the difference is whether it names what it permits.
- **Fix the defect in your own work too.** This phase's own boundary test was written with the same frozen count before the pattern was recognised. Repairing four siblings and shipping a fifth copy of the bug would have been the actual lesson going unlearned.

### Haftalık 3 soru
1. **What did we learn?** When a relationship carries a tenant, bind the tenant into the reference itself — and check whether the schema already did it somewhere before designing anything.
2. **How does this improve Turkish Rug House?** A person's role in one organization can never be the authority they hold in another, and that is now the database's promise rather than a habit of the code that happens to write the rows.
3. **How does this become part of Hebun AI?** Invariants live where they cannot be bypassed, and a test asserts what its own phase promised — never a repository-wide number that someone else's authorized work will break.

## Public Onboarding Entry Surface — A runtime with no destination is not a finished runtime (2026-08-14)

- **"Implemented and tested" and "reachable" are different claims, and only the second one ships.** Four authorities — enrollment start, decision, completion, invitation acceptance — were complete, transactional, race-controlled and proven end to end against real Postgres. Every one had zero non-test callers. The ceremony walked forward until that gap became load-bearing and then could not continue. Grep for non-test importers before calling a capability done.
- **THE REAL FIND: the missing piece was three surfaces, not one.** The obvious gap was a public route for the bearer. The one nobody had named was the approval surface for the SECOND key: `decideIdentityEnrollment` had no product caller either, so a bearer could start a ceremony that no human could ever approve. A two-key ceremony needs a surface per key. Counting the keys is the cheap way to find that.
- **A read seam that requires an id the caller cannot obtain is not a read seam.** `readPendingEnrollment(db, tenantId, enrollmentId)` existed and had zero callers, because Act 1 returns the id to the BEARER and Hebun delivers nothing. The approver had no way to learn it. Before building a surface on a read function, ask where the caller gets its arguments.
- **Read the boundary test before choosing a route.** `const PUBLIC_PREFIXES = ["/login"];` is asserted as a source literal by two separate suites. That made the location decision for us: the surface goes under `/login`, exactly where the workspace picker already went, and no middleware changed. A grep of the tests answered in seconds what an architecture debate would have taken an hour to get wrong.
- **When a test forbids a string in client files, pass wording as props instead of finding a clever import path.** No client component may contain `identity-enrollment`; no `page.tsx` may contain `human-onboarding`. Re-exporting the types through a differently-named module would have passed the test and defeated its purpose. The server builds `Record<Union, string>` from the real refusal unions and hands it down — the vocabulary stays out of the bundle, and totality is still checked at compile time.
- **Before inventing a transport for a secret, look for one the repository already trusts.** The continuation reference needed to survive an approval wait. The answer was not a new table or a new token: every cookie in this repo is already an opaque reference whose keyed digest is the durable row, and the continuation reference was already exactly that. An httpOnly path-scoped cookie was a reuse, not an invention — which is why it needed no schema.
- **A short TTL on a non-recoverable secret is a trap; check for the escape hatch first.** 12 hours is only safe because `identity_enrollment_requests_one_live_per_invitation_uq` is partial on `status <> 'rejected'`, so rejecting a stranded ceremony frees the invitation for a retry. That recovery path is now asserted by test, because the TTL silently depends on it.
- **Blunt firewall rules produce false positives that teach you to weaken them.** Forbidding `.delete(` in the boundary file flagged `store.delete(` — a cookie, not a table. The fix was to enumerate every mutating call and require each to be the cookie store, which is both stricter and true. Scan `codeOf()`, never raw source: these modules name `localStorage` in their headers in order to say they do not use it.
- **Run typecheck after writing the tests, not just after writing the source.** Two wrong result field names (`memberRoleId` for `roleId`, `membershipAuthorizationId` for `authorizationId`) reached a run because the last typecheck predated the test file. They surfaced as a swallowed `persistence-unavailable`, which is exactly the failure mode a catch-all refusal is worst at explaining.
- **Say what the browser did not prove.** The page renders publicly and the dashboard still redirects — both verified live. The pane's input automation never focused the form, so the three acts were never driven through a real browser and the cookie wiring is proved structurally only. Recording that is the difference between a verification and a claim.

### Haftalık 3 soru
1. **What did we learn?** A capability with nowhere to be spent is unfinished work, and finding the destination means counting every key the ceremony turns — not just the one the newcomer holds.
2. **How does this improve Turkish Rug House?** A new person can actually join the workspace: they spend the capability they were handed, a human who knows them approves it, and they end up with an account and a membership without anyone editing the database by hand.
3. **How does this become part of Hebun AI?** Product surfaces call authorities and own none, secrets travel in the transport the system already trusts, and every boundary the surface must not cross is a test rather than a convention.

## Invitation Revocation — A status nothing writes is a slot nothing releases (2026-08-14)

- **A partial unique index is only as good as the writer that moves rows out of its predicate.** `invitations_pending_email_uq` keys on `status = 'pending'`, and production wrote exactly two statuses ever: `pending` and `accepted`. `expired` and `revoked` were enum members nothing set. So the index quietly became permanent: any lapsed invitation held its tenant/address slot forever. When you add a partial unique index, ask immediately which writer moves a row out of the predicate — if the answer is "none", the constraint is a one-way door.
- **THE REAL FIND: expiry as a predicate and expiry as a state are different facts, and only one of them frees a slot.** The runtime correctly refused lapsed capabilities by comparing `expires_at` to the clock on every path — that half was right and was even defended by a test. What nobody checked was that the row still read `pending`, so "wait for it to expire and retry" was not slow, it was impossible. A validation predicate does not clean anything up.
- **The schema had already designed the fix; only the writer was missing.** `revoked_at`, `revoked_by_type`, `revoked_by_id`, `revocation_reason`, the enum member, and a CHECK welding them together all pre-existed. Classify a gap as schema / runtime / product BEFORE proposing a design — the answer here turned a feared migration into one new file and zero schema delta.
- **Give the recovery act the same authority as the act it undoes.** Whoever may mint an outstanding bearer secret is exactly who may destroy one, so revocation went through the same `resolveGovernanceAuthority` as issuance — and, like issuance, writes no `decision_records` row. Matching the existing shape meant no new resolver and no new constitutional vocabulary.
- **Do not let a recovery path rewind the thing it recovers from.** The consumed authorization stays `consumed`. Un-consuming it would have been the convenient fix and would have erased the fact that a capability really was issued, letting one Governance decision produce two. The single most important test in the phase asserts a write that must never happen.
- **Eligibility must not gate on the very condition you are recovering from.** Revocation checks `status = 'pending'` and deliberately ignores `expires_at`, because a lapsed invitation is precisely the case that stranded the slot. Gating on expiry would have shipped the fix with the original defect still inside it.
- **A rule expressed as a string match is a proxy; sooner or later legitimate work fails it.** Two sibling tests banned the literal `human-onboarding` from every `page.tsx`. The invariant was "no page reaches the onboarding mutation path" — but a server page legitimately imports read seams, and this phase added one. Narrowed both to name the mutation modules and actions explicitly: stricter about acts, honest about reads.
- **Scan `codeOf()`, not raw source — again.** Two firewall assertions tripped on prose: a contract string quoting the status value it says nothing writes, and a card header naming "Delete/Reset/Recover token/Resend" to disclaim them. Both times the honest fix was to compare code, or to reword my own text rather than loosen someone else's rule.
- **Run the existing suite before writing new tests.** Two structural firewalls failed on the feature alone, and both were real design questions rather than noise. Finding them before the new tests existed kept the question "is this boundary right?" separate from "is my test right?".

### Haftalık 3 soru
1. **What did we learn?** A lifecycle is only complete when something writes every terminal state — an enum value nothing sets is a trap disguised as a feature, and a partial index built on it becomes permanent.
2. **How does this improve Turkish Rug House?** A mistyped or lost invitation can be cleaned up by the person who sent it, instead of locking that email address out of the workspace forever.
3. **How does this become part of Hebun AI?** Recovery is an authorized, audited act that undoes exactly one thing and rewrites no history — the capability dies, the record of it having existed does not.

## Capability Handoff Custody — A successful action that destroys its own output (2026-08-14)

- **THE REAL FIND: an action whose success flips the condition that mounts the component showing its result will destroy that result.** Issuing marks the authorization `consumed` in the same transaction; the card mounted the issuance component behind `!entry.consumed`; the success branch called `router.refresh()` in the same transition that stored the plaintext. So a *successful* issuance unmounted the only thing holding the secret. Whenever a mutation changes the state its own UI branch reads, ask what happens to that component's local state — especially if the state is a one-time secret.
- **"Shown once" is a custody contract, and the component must own it, not race for it.** Whether the human saw anything came down to whether a local state commit painted before a server round-trip landed. It won the first time and lost the second. A contract that holds only when a race falls the right way is not a contract.
- **Fix the mount, not just the refresh.** Removing `router.refresh()` alone would have left the component still mount-gated on server status, so any future refresh from anywhere would have resurrected the bug. Making the parent render it unconditionally and passing the old predicate as `issuable` means no server-side status change can ever unmount a component holding a secret. Two changes, one file — but skipping the first would have left a latent trap.
- **Order the render branches by what is irreversible.** A held plaintext capability now outranks every other path, including "this authorization is spent". The most destructive-to-lose state gets checked first.
- **Do not buy visibility with persistence.** The whole temptation of this bug class is to stash the secret somewhere it survives a remount. Every such fix — storage, cookie, URL, a readback seam — would have traded an inconvenience for a permanent security regression. The capability stayed unrecoverable; only its *visibility* changed.
- **A transport failure is not a decided refusal.** The runtime's refusal vocabulary describes outcomes the server chose; a thrown action means the outcome is unknown and may well have committed. Saying "nothing was changed" there would be a lie, and offering a retry could spend a second authorization. It got its own state and its own honest sentence.
- **Write the negative control.** The regression test was run against the released buggy source and proved it fails there (invariants 1 and 3, plus a missing `acknowledge`). A guard nobody has watched fail is not yet known to guard anything.
- **Say what a structural test is.** This test reads source; it renders no React and clicks nothing. Labelling it end-to-end proof is exactly the habit that let the bug ship past 351 passing tests — the runtime proved the capability was *returned*, and nothing proved it was *seen*.
- **Test-helper bugs look like product bugs.** Three failures in a row were mine, not the component's: a brace matcher that grabbed a destructured props type instead of a function body, a proximity regex flagging an unreachable branch, and a literal string match broken by JSX line wrapping. Fix the assertion when the assertion is what is wrong; do not loosen a rule to make a bad check pass.

### Haftalık 3 soru
1. **What did we learn?** If an operation's success changes the state its own UI is mounted on, the component must be allowed to outlive that change — otherwise the product deletes the very thing the human was supposed to take.
2. **How does this improve Turkish Rug House?** The person handing out an onboarding link actually receives it, once, with a clear instruction to save it and an explicit confirmation before it disappears.
3. **How does this become part of Hebun AI?** One-time secrets are held by the component that shows them, released only on explicit human acknowledgement, and never written anywhere they could be recovered.

## Stranded Approved Enrollment — Permission you cannot spend is not a finished state (2026-08-14)

- **THE REAL FIND: a partial unique index needs an escape hatch reachable from EVERY state it covers, not just the first one.** `identity_enrollment_requests_one_live_per_invitation_uq` is partial on `status <> 'rejected'`, so `pending` and `approved` both block. Rejection released `pending` only — the read seam listed only `pending`, and the decision runtime refused anything else. An approved-but-uncompleted row was therefore invisible, unrejectable and permanently blocking. This is the second time the same shape has bitten: enumerate every status the predicate covers and prove each one has a writer out.
- **Approval is permission, not completion, and the UI must not treat it as terminal.** The read seam filtered on `pending` because "a decided ceremony is history". That reasoning is right for `rejected` and `completed` and wrong for `approved`: the bearer may still fail to spend it. Classify states by *actionable vs terminal*, never by *decided vs undecided*.
- **A promise rendered in the product is a specification.** The card told bearers that "a Governance authority rejects the stranded ceremony, which frees the invitation". Nobody had checked that the sentence was executable, and it was not. Any user-facing recovery instruction deserves a test that performs it.
- **A CHECK constraint can force you to drop data on a transition — check it before designing.** `identity_enrollment_requests_approved_chk` welds the four approval columns to approved/completed in both directions, so approved → rejected is only legal if those columns are nulled. That is acceptable *because* the approval lives in `decision_records`; if the row had been the only record, the design would have needed a different shape. Read the constraint before promising a transition.
- **Widen eligibility on one verb, not the operation.** Rejection gained a state; approval did not. Expressing it as `pending || (!approving && strandedApproved)` and mirroring exactly that in the conditional UPDATE kept the race window unchanged and made "approve twice" still impossible.
- **When behavior legitimately changes, repair sibling tests by asserting the NEW invariant.** Two suites failed. One asserted that rejecting an approved ceremony refuses — that was the bug, not a safety property, so it now asserts the thing it was really protecting (approval is once-only). The other asserted an approved row leaves the list — wrong for exactly one state. Neither was loosened; both were made more precise, with the reason written into the test.
- **State-neutral copy at an unauthenticated boundary.** The public refusal fires for `pending` or `approved` and used to claim "waiting for approval" — false for the stranded bearer who read it. The fix says a ceremony "already exists" and deliberately does not reveal which, because a thief holding a stolen capability must not learn whether it was approved.
- **Audit a suspicious behavior without redesigning it.** Clearing the continuation receipt on mismatch was a compounding defect only while recovery was impossible; once recovery exists, keeping a provably-dead receipt would be worse. It stays, with the one honest cost recorded: it destroys the evidence of why the mismatch happened.

### Haftalık 3 soru
1. **What did we learn?** A state that grants permission but blocks progress is not terminal, and every state a blocking index covers needs a way out that someone can actually reach.
2. **How does this improve Turkish Rug House?** Someone whose sign-up breaks halfway is not locked out forever — whoever invited them can release it, and they finish with the link they already have.
3. **How does this become part of Hebun AI?** Recovery reuses the authority that made the original decision, undoes exactly one thing, reissues nothing, and leaves the ledger intact.

## Knowledge Ingestion — The consumer was built; only the producer was missing (2026-08-15)

- **The codebase named its own gap, twice, and nobody had read it.** `knowledge-evidence.server.ts` returned the sentence "no ingestion path exists to put knowledge there yet" to real users, and `capability-map.ts` listed the `documents` table as having "ZERO consumers anywhere". Before designing anything, grep the repository for what it already admits about itself — the honest error messages of a previous phase are a roadmap.
- **A writer that opens its own transaction cannot be composed.** `durable-knowledge-writer` called `db.transaction()` internally, so N calls were N transactions and "6 of 12 chunks committed" was reachable. The fix was an optional caller-supplied handle — omitted, behaviour is byte-identical; supplied, it joins. **Inside a caller's transaction a failure must THROW, never return a status:** Postgres has already aborted, so a returned `duplicate`/`failed` would invite the caller to keep working in a dead transaction and commit a partial result.
- **Put the content digest in the identity, not just the title.** `<title>#<index>` alone would have refused a *corrected* version of a document as a duplicate of the version it corrects — a refusal that is a lie. Digesting the NORMALIZED text also makes reformatting correctly a non-event.
- **A partial duplicate is an inconsistent state, not a gap to fill.** Ingestion refuses when *any* chunk identity already exists rather than creating the missing ones. Silently completing somebody else's half-finished write is how you turn one bug into an unexplainable record.
- **Bound a new writer by what the existing READ seam can show.** `KNOWLEDGE_LISTING_LIMIT` is 50 and Heby consumes that same listing, so one ingestion is capped at 40 records and a test asserts the two constants cannot drift apart. A feature that writes more than its reader can surface looks successful and is partly invisible.
- **Share the pure function rather than previewing with a second implementation.** The card imports the server's own `normalizeSourceText`/`chunkSource`, so the chunk count shown before submit is the count written. A preview that can disagree with the outcome is worse than no preview.
- **Widening a shared interface breaks its stubs, and that is the interface telling you something.** Adding a read method to the write-only writer broke four test doubles — the right response was not to fix the doubles but to notice the method was a READ and did not belong there. It moved to the orchestrator; the writer kept its provably-write-only identity.
- **A negative assertion must read the code, not the comments.** "The card never implies this is searchable" failed against the header comment that exists to say it is *not* searchable. Strip comments before asserting absence.
- **The sentence your closure doc quotes as "the gap this closes" belongs in the diff.** The first commit gate FAILED: ingestion was built and verified while five shipped strings still told the operator it did not exist — `/knowledge` rendered the ingestion card beside a capability map saying `ingestion → not-connected`, and Heby appended "No ingestion path exists" to every Knowledge read, including reads of records just ingested. Four assertions pinned the lie, so 356/356 was green *because* the stale claims survived. Second phase in a row to hit this shape. At every commit gate, grep the repo for each claim the phase falsifies — constants, rendered copy, and the assertions that freeze them.
- **A firewall that scans raw source cannot tell a denial from an offer.** Writing "ingesting is not ratifying" into a `heby-commands` file tripped the g2 and k4 bans on naming a Governance approval mutation — correctly. The fix is to reword and let the formal statement live in the module that owns it, never to widen the firewall to admit "good" mentions.

### Haftalık 3 soru
1. **What did we learn?** When every consumer, authority and audit path already exists, the honest next phase is the missing producer — and it should reuse all of them rather than becoming a second one.
2. **How does this improve Turkish Rug House?** Someone can paste the actual expense policy into Hebun and have Heby answer from it, with the record showing where it came from and that nobody has ratified it.
3. **How does this become part of Hebun AI?** Ingested knowledge is canonical, provisional, attributed to its source and its ingester, written all-or-none, and never mistaken for ratified organizational truth.

---

## KR2 — Knowledge Retrieval Representation & Quality Benchmark (2026-08-15)

Read/benchmark/architecture gate. No commit, no migration, no production extension. Baseline
re-proven by `git ls-remote`: origin/main = HEAD = `915b543`, 0/0, both knowledge tags on remote.

**Ders 1 — Bir temsili kötü ilan etmeden önce sorgu üreticisini doğrula.** İlk ölçüm dört
PostgreSQL FTS varyantını da ~%4 Recall@1 / ~%96 zero-result gösterdi. Sebep Türkçe değildi:
`plainto_tsquery` bütün terimleri AND'liyor, dolayısıyla "yıllık izin talebi *kime* gönderilir"
sorusu, beş kelimenin dördünü içeren kaydı ıskalıyor. `websearch_to_tsquery` + OR ile aynı korpus
%67 Recall@1 verdi. Yanlış verdict bir satırlık sorgu üretiminden çıkacaktı.

**Ders 2 — `unaccent` Türkçede kozmetik değil, doğruluk meselesi.**
`to_tsvector('turkish','İZİN')` → `'İzİn'`: noktalı büyük İ ne küçültülüyor ne köke iniyor.
Büyük harfle yazılmış Türkçe sorgu sessizce hiçbir şeyle eşleşmiyor. `unaccent` önce uygulanınca
`'iz'` oluyor ve noktasız `ızın` ile de birleşiyor. Sıra da önemli: `lower(unaccent(x))` doğru,
`unaccent(lower(x))` değil.

**Ders 3 — Migration sorusunun tamamı IMMUTABLE'da düğümleniyor.**
`to_tsvector('turkish', label||' '||statement)` üzerinde GIN index KURULDU. Aynı ifade
`unaccent()` ile sarılınca REDDEDİLDİ: "functions in index expression must be marked IMMUTABLE".
En iyi ölçülen temsil, IMMUTABLE bir sarmalayıcı ya da generated column olmadan indekslenemez.

**Ders 4 — Skor, standing'e kördür.** Superseded "Yıllık izin hakkı (eski sürüm)" kaydı, güncel
sürümle sıralamada yan yana (1.00 vs 1.20). KR1'in active-node join'i bunu zaten eliyor; ama
expired / future-effective / archived kayıtlar için hiçbir kapı yok — 46 sorunun 6'sı top-5'inde
yürürlükte olmayan bir kayıt sundu. Eligibility ayrı bir kapıdır, ranking sinyali değil.

**Verdict: B — FTS(turkish+unaccent) + pg_trgm yeterli. Vektör hak edilmedi.** Hibrit %78.3 R@1 /
%89.1 R@3 / MRR 0.827, sıfır zero-result. Leksikal yalnızca eşanlamlıda düşüyor (6/46 soru) ve
pgvector bu makinede zaten yok.

### Haftalık 3 soru
1. **What did we learn?** Ölçüm aracının kendisi bulgu üretebilir: konjonktif sorgu üretimi,
   Türkçe hakkında sahte bir sonuç doğuruyordu. Ayrıca PG14 `turkish` stemmer'ı kendi
   morfolojisinde tutarsız (`izin`→`iz`, `izne`→`izne`, `iznin`→`izn`).
2. **How does this improve Turkish Rug House?** Kargo/iade/fiyat/yetki gibi gerçek Türkçe
   operasyon sorularının hangi temsille bulunabildiği artık ölçülü. İade ve kargo alanlarının
   kelime dağarcığı çakışıyor; retrieval bunu ayırt edebiliyor (cross-domain %100 R@3).
3. **How does this become part of Hebun AI?** Bir sonraki gate, mevcut K1 read seam'ine tek bir
   `query` parametresi ve saf bir ranking modülü ekliyor. Heby tarafında değişecek tek çağrı
   `withKnowledge(...)` — `validation.prompt` zaten kapsamda.

Benchmark artefaktları COMMIT EDİLMEDİ: `apps/dashboard/scripts/kr2-benchmark/`.

---

## KR3 — Knowledge Retrieval Runtime (2026-08-15)

Implemented, verified, UNCOMMITTED. 360/360 test, lint 0 error, build clean.
Şema/migration/extension/dependency delta: **sıfır** (24/24/24, `hebun_r1` extensions=plpgsql).

**Ders 1 — "Kullanılabilir extension" ile "kurulu extension" aynı şey değil, ve bu bir gate'tir.**
KR2'nin ölçtüğü kazanan temsil `unaccent` + `pg_trgm` istiyordu. Canonical DB'de ikisi de yok:
`ERROR: function unaccent(unknown) does not exist`. Bir mimari kapısını sessizce bir extension
migration'ına çevirmek yerine önkoşul yeniden ölçüldü.

**Ders 2 — `translate()` bir built-in ve IMMUTABLE; `unaccent` ile Türkçede AYNI sonucu veriyor.**
Aynı korpus, aynı 46 gold sorgu: R@1/R@3/R@5/MRR/zero-result/distractor — hepsi birebir aynı.
Üstelik `to_tsvector('turkish', translate(...))` üzerinde GIN index KURULUYOR; `unaccent` ile
REDDEDİLİYORDU. Migration gerektirir sanılan önkoşul, aslında bir migration'ı ortadan kaldırdı.
Geriye sadece `pg_trgm` (typo toleransı, +10.9pp R@1) kalıyor — o da ayrı bir Director kararı.

**Ders 3 — Sahte bir bileşen değil, hesaplanmamış bir bileşen: `null`, `0` değil.**
`pg_trgm` yokken trigram skoru `null` dönüyor. `0` dönseydi "hesaplandı, eşleşme yok" ile
"hiç hesaplanmadı" ayırt edilemezdi. Uygulama katmanında sahte benzerlik yazmak yasak.

**Ders 4 — Bir proxy guard korumaya çalıştığı şeyi yakalamaya başlayınca silinir.**
`k1-flow` testi "read-only" kanıtı olarak `execute(` substring'ini banlıyordu; KR3'ün raw SELECT'i
buna takıldı. Aynı şekilde `vector` yasağı `to_tsvector`'ı yakaladı. İkisi de niyeti test edecek
şekilde onarıldı (mutating fiiller + `\bvector\s*\(`), gevşetilmedi.

**Ders 5 — Yeşil bir test, sorunun sorulmadığı için yeşil olabilir.**
K2 testi "İngilizce soru Türkçe kaydı Heby evidence'ına soktu" diye geçiyordu. Geçme sebebi
evidence'ın soru-kör olmasıydı. Artık soru gerekiyor; test Türkçe soruya çevrildi VE
"İngilizce soru Türkçe kaydı bulmaz" ayrıca assert edildi.

**Ders 6 — Chunk-title kirliliği hipotezi ÖLÇÜLDÜ ve çürütüldü.** Sadece statement üzerinden
sıralama R@1 %67.4 → %43.5'e düşüyor; title'ı D ağırlığına indirmek %52.2. Üstelik tek kaynağın
top-k'yı domine etmesi ARTIYOR. `ts_rank_cd` corpus-wide IDF kullanmıyor. En dar düzeltme:
düzeltme yok.

**Ders 7 — `no-match` ile `empty-corpus` ayrı cümlelerdir.** Normalizasyon sırasında yakalanan
gerçek defect: salt noktalama (`???`) token olarak hayatta kalıyor, boş tsquery üretiyor, sıfır satır
dönüyor ve `no-match` olarak raporlanıyordu — yani kullanıcının sormadığı bir soru için
"organizasyonunuz bunu bilmiyor" denecekti. Boşluk artık normalizer'da karara bağlanıyor.

### Haftalık 3 soru
1. **What did we learn?** Ölçüm, mimari kararı tersine çevirebilir: `translate()` hem extension
   ihtiyacını hem index engelini aynı anda kaldırdı. Ve widening yapan her faz, kırdığı guard'ları
   kökünden onarmak zorunda — gevşetmek değil.
2. **How does this improve Turkish Rug House?** Kargo/iade/izin/harcama gibi gerçek Türkçe sorular
   artık doğru kaydı ilk sırada getiriyor; büyük harfli "İZİN" sorgusu sessizce boş dönmüyor.
3. **How does this become part of Hebun AI?** Heby ilk kez sorduğu soruya göre kanıt seçiyor.
   Sıradaki karar tek başlık: `pg_trgm` migration'ı Director onayına sunuldu.

## Deferred Strategic Capabilities — Guided Learning & Director Digital Twin (2026-08-15)

Yalnızca dokümantasyon. Commit `33911fe`: 4 dosya, 293 ekleme, **sıfır silme** — mevcut hiçbir satır
değişmedi. Runtime/test/şema/migration/dependency/DB delta: **sıfır**.

**Ders 1 — Guided Learning sıfırdan başlamıyordu; sunum mimarisi zaten yazılıydı.**
`hebun-information-architecture.md` §5.1 semantic anchor'ları, overlay tiplerini
(HIGHLIGHT/SPOTLIGHT/CIRCLE/UNDERLINE/ARROW/PULSE), navigation target'ı, workspace sahipliğini,
accessibility'yi ve Computer Use sınırını 14 invariant ile **zaten sahipleniyor**. Yeni kayıt buna
referans veriyor — tekrar etmiyor, çatallamıyor. İki yere yazılmış bir ilke, gelecekteki bir çelişkidir.

**Ders 2 — Yeni backlog maddesi yalnızca eksik boyutu ekler.**
Ders modeli, ilerleme durumu, sıralama, müfredat eşlemesi, öğrenen tamamlama semantiği ve
kişiselleştirme uygunluğu. Guided Explanation "baktığım şeyi göster" sorusunu yanıtlar; Guided
Learning "bu konuyu, birkaç yüzeye yayılan, başı ve sonu olan bir ders olarak öğret" sorusunu.

**Ders 3 — Tanımsız bir faz numarasına dayanan gate, gate değildir.**
Kayıt keşfi "KP5 complete"e bağlıyordu. `KP<n>` **repo genelinde hiçbir yerde yok** — yalnızca o
cümlenin içinde. Yeni bir faz numarası uydurulmadı; gate üç mimari önkoşula çevrildi
(Knowledge/Knowledge Retrieval temeli olgun · **stabil** semantic anchor isimlendirme kontratı ·
olgun çekirdek Heby etkileşim mimarisi = Heby Roadmap Faz 3/4/5). Gerekçeyi yazmaya da gerek yoktu:
Product IA bunu tam bu yetenek için zaten karara bağlamış — *"the architectural dependency governs;
speculative phase numbers do not."* **Yeni kural yazmadan önce mevcut otoriteyi ara.** Faz numaraları
değişir, yeniden numaralanır, emekliye ayrılır; mimari önkoşul bunlara rağmen anlamlı kalır.

**Ders 4 — Director Digital Twin türetilmiş bir değerlendiricidir, ikinci bir otorite değil.**
Kanıta dayalı ve türetilmiş; Organization Digital Twin'den (21 — şirketi modeller), Director
Memory'den (09 — saklar, akıl yürütmez), Heby'den (konuşma ve açıklama yüzeyi) ve Governance'tan
(gerçek yetki) ayrı tutulur. Erken kurulan bir Twin, Director'ün adını taşıyan bir persona olurdu;
kayıt tam olarak bunu engellemek için var.

**Ders 5 — Kilit: ACTUAL DIRECTOR DECISION != DIRECTOR TWIN PREDICTION.**
İkisi ayrı kaydedilir ve ayrı okunur. Doğru çıkan bir tahmin karara dönüşmez — **isabet, yetkiye
giden bir yol değildir.**

### Haftalık 3 soru
1. **What did we learn?** Bir yeteneği kaydetmeden önce hangi dokümanın onu zaten sahiplendiğini
   denetle; ve bir deferral gate'ini faz numarasına değil mimariye bağla. Bu turda aranan doktrin
   repoda zaten yazılıydı — yazmak değil, bulmak gerekiyordu.
2. **How does this improve Turkish Rug House?** Bugün doğrudan hiçbir şey değişmiyor; bu bir kayıt
   turu. Dolaylı kazanç: TRH operatörünün Hebun'u gerçek arayüz üzerinde öğrenmesi artık tanımlı bir
   yetenek ve önkoşulu (retrieval temelinin olgunlaşması) yazılı — tek bir kaydı olan korpustan ders
   anlatılamayacağı dahil.
3. **How does this become part of Hebun AI?** İki madde backlog'da, `Status: Planned`, önkoşula
   bağlı. Kayıt yetki vermez; promosyon ayrı bir Director gate'idir.

## KR4 — Knowledge Retrieval Explanation & Evidence UX (2026-08-15)

Uygulandı ve doğrulandı, COMMIT EDİLMEDİ. 363/363 test (+3 yeni dosya), lint 0 error, build clean.
Şema/migration/extension/dependency/DB delta: **sıfır**. Canonical `hebun_r1` bit birebir aynı.

**Ders 1 — Model'e kullanıcıdan DAHA ÇOK şey anlatıyorduk.**
KR3'ün grounding satırı modele başlık + authority/lifecycle/ratified/freshness/scope + verbatim
statement + provenance veriyordu; kullanıcı `knowledge · izin/izin-hakki` görüyordu. Asimetri
`toRetrievalResolution`'da doğuyordu: beş alan tek bir gösterim string'ine düzleştiriliyor,
`diversityPruned`/`truncated`/`excluded`/`degradedReason`/`sourceDigest` tamamen düşüyordu. Bir
sınırın iki tarafını da okumadan "bu bilgi zaten akıyor" denemez.

**Ders 2 — Yazılan ama hiç okunmayan sütun, olmayan sütun gibi davranır.**
`knowledge_nodes.provenance` ve `.source_attribution` K2'den beri YAZILIYORDU; retrieval yolu
ikisini de select etmiyordu. Migration değil, projeksiyon eksikti. **Ve iki ayrı yerde:** paylaşılan
`SELECTION` sabitini genişletmek yetmedi — `searchFacts` kendi açık kolon listesini taşıyor, yani
Heby'yi besleyen yol hâlâ boş dönüyordu. Postgres testi yakaladı. **Bir tabloyu iki farklı
projeksiyon okuyorsa, birini genişletmek diğerini genişletmez.**

**Ders 3 — Katlanmış token'ı kullanıcıya göstermek, doğrulanamaz bir iddiadır.**
`normalizeQuery` katlanmış token döndürüyor; ilk sürüm "Yıllık" yazan kaydın altına `Yillik`
basıyordu — okuyucunun ekranda bulamayacağı bir kelime, üstelik tek işi doğrulanabilir olmak olan
bir panelde. Düzeltme yaklaşık değil kesin: `foldTurkish` = `translate()`, 13 harflik karakter
karşılığı, **uzunluğu değiştirmiyor**, dolayısıyla katlanmış metindeki offset orijinaldeki offset.
Terim artık **kaydın kendi yazımıyla** gösteriliyor.

**Ders 4 — Sıra, kalıcılaştırmadan sonra gelirse garanti olur.**
Evidence açıklaması `persistExchange` DÖNDÜKTEN SONRA response'a ekleniyor. "Writer'a hiç
vermiyoruz" bir söz; "writer çoktan dönmüştü" bir yapı. Türetilmiş bir sunumun kalıcı kayda
sızması artık kaza ile mümkün değil.

**Ders 5 — Yeniden çözümlemek, geçmişi uydurmaktır.**
Mesajlarda evidence snapshot'ı yok. Reload'da retrieval'i tekrar çalıştırmak BUGÜNÜN kayıtlarını
getirirdi — o cevabın hiç görmediği supersession/ratification/expiry sonrası. "O cevabın kanıtı"
diye sunmak uydurma tarih olurdu. Panel bunun yerine düz söylüyor: kanıt saklanmadı.

**Ders 6 — Birden çok kaynak ≠ çelişki, ve sinyali dar tutmak onu doğru yapıyor.**
`conflict` alanı YOK; hiçbir şey iki cümlenin çeliştiğini hesaplamıyor. Yapısal olgu raporlanıyor:
tek domain'de, **farklı kaynaklardan** birden çok uygun kayıt. Tek belgenin iki chunk'ı tek
kaynaktır (yoksa 40 parçalı politika kendini 40 çelişen kaynak sanırdı) ve farklı domain'ler
tetiklemiyor (izin politikası ile seyahat politikası aynı anda doğru olabilir).

### Haftalık 3 soru
1. **What did we learn?** Bir sınırın iki tarafını da okumadan "bilgi akıyor" varsayma; ve aynı
   tabloyu okuyan ikinci bir projeksiyon varsa onu da genişlet. Postgres testi olmasaydı KR4 boş
   kartlarla "tamam" derdi.
2. **How does this improve Turkish Rug House?** Operatör artık Heby'nin hangi kaydı kullandığını,
   hangi kaynaktan geldiğini (İK El Kitabı mı, 2026 İzin Yönergesi mi), ratified olup olmadığını ve
   iki kaynağın aynı soruya birden cevap verdiğini görüyor — 20 gün mü 14 gün mü çelişkisini insan
   fark ediyor, sistem sessizce birini seçmiyor.
3. **How does this become part of Hebun AI?** Kanıt açıklaması türetilmiş bir sunum katmanı olarak
   yerleşti: skor yok, güven yüzdesi yok, cümle bazlı atıf yok, kalıcılık yok. Sıradaki karar
   Director'da — bu fazın commit'i ve ayrıca `/director` üzerindeki sahte confidence yüzeyi.

## Director Truth Surface — sunum katmanı girdisinin yetkisini yükseltemez (2026-08-15)

KR4'ün ertelenmiş bulgusu denetlendi ve onarıldı. Uygulandı, COMMIT EDİLMEDİ. 364/364 test
(+1 yeni dosya), lint 0 error, build clean. Şema/migration/dependency/DB delta: **sıfır**.
Canonical `hebun_r1` bit birebir aynı.

**Ders 1 — Veri katmanı doğruyu söylüyordu; sunum katmanı onu çöpe atıyordu.**
`/director`'ın TÜM projeksiyonları `*/mock.ts`'ten geliyor ve her biri tip sözleşmesinde
`source.kind: "Mock Adapter"` **beyan ediyor**. `hebyEnterpriseContext` daha da ileri gidip
`disclosure: { simulated: true, authoritative: false, executionAllowed: false }` taşıyor.
**Hiçbir bileşen bunların hiçbirini okumuyordu.** Genel kural: **bir sunum katmanı, girdisinin
yetkisini asla yükseltemez.** Güzel render edilmiş bir mock hâlâ mock'tur.

**Ders 2 — "Simulated" yetkiyi reddeder, KESİNLİĞİ reddetmez.**
Panel başlığında zaten "Simulated intelligence · no execution or approval authority." yazıyordu — ve
hemen altında `Confidence 94%` gösteriliyordu. İki ayrı iddia: biri "bu karar veremez", diğeri "bunu
biri ölçtü". İkincisi yanlıştı; Hebun hiçbir yerde confidence hesaplamıyor. **Sahte kesinlik, sahte
yetkiden daha inandırıcı bir yalandır** — çünkü sayı, ölçüm ima eder.

**Ders 3 — Demo işareti TÜRETİLMELİ, sabit yazılmamalı.**
Yeni `ProjectionSourceNotice` uyarıyı `source.kind === "Mock Adapter"` alanından türetiyor. Bu
projeksiyonlar gerçek runtime'a bağlandığı gün uyarı **kendiliğinden kayboluyor**. Elle silinmesi
gereken bir demo etiketi, canlı verinin üstünde unutulan bir demo etiketidir.

**Ders 4 — Sayıyı sil, prozayı bırakma refleksine kapılma; testi kelimeye değil İDDİAYA yaz.**
İlk test `confidence` kelimesini yasakladı ve mock metnindeki dürüst İngilizceye takıldı
("Restores launch confidence"). Yasaklanması gereken kelime değil, **ölçüm**: yüzde işareti ve
sayıya bitişik "confidence". Bu repo daha önce de korumaya çalıştığı şeyi yakalayan guard'lardan
zarar gördü (KR3, `execute(` / `vector`).

**Ders 5 — Boşluğu doldurmak için başka bir katmandan skor ödünç alma.**
Retrieval'in relevance skoru oradaydı ve "confidence" yerine konabilirdi. Konmadı, ve test bunu
kilitliyor: `relevance ≠ confidence`, `ratified ≠ true`, `authoritative ≠ certain`,
`current ≠ correct`, `evidence-backed ≠ Hebun tarafından doğrulanmış`. Eksik bir sayının doğru
karşılığı, uydurulmuş bir sayı değil — **hiçbir sayı**.

### Haftalık 3 soru
1. **What did we learn?** Bir yüzeyin dürüstlüğü, en alttaki veriyle değil, en üstteki render ile
   ölçülür. Sözleşmede duran ama hiç okunmayan bir `disclosure` alanı, olmayan alanla aynıdır.
2. **How does this improve Turkish Rug House?** Direktör `/director`'ı açtığında artık ilk gördüğü
   şey, ekrandaki hiçbir rakamın kendi şirketini tanımlamadığı. Önceden bugünün gerçek tarihi,
   "Updated 09:30" ve "%94 confidence" yan yanaydı.
3. **How does this become part of Hebun AI?** Kural teste bağlandı: mock veri, açık etiket olmadan
   ölçüm gibi render edilemez. `/approvals` üzerindeki `trust: "Verified"` rozeti aynı sınıftan ama
   ayrı bir yüzey — kapsam genişletilmedi, ayrı Director kararı olarak kaydedildi.

## /approvals Trust Denetimi — bir rozet, monte edilmemişse yüzey değildir (2026-08-15)

Denetim yapıldı, **onarım gerekmedi**. Tek bir guard testi eklendi. 365/365, lint 0 error,
build clean. Şema/migration/dependency/DB delta: **sıfır**. Canonical `hebun_r1` bit birebir aynı.

**Ders 1 — Önceki turun bulgusu YANLIŞTI, ve sebebi basename çakışmasıydı.**
`trust: "Verified"` rozetinin "/approvals'ta render edildiği" bildirilmişti. Gerçekte iki ayrı
bileşen var: `components/decision-domain/decision-workspace.tsx` (rozetli, **hiçbir yerden import
edilmiyor**) ve `components/decision-workspace/decision-workspace.tsx` (asıl `/approvals`).
`grep -rl "decision-workspace"` ikisini de yakaladı ve rapor yanlış olanı işaretledi.
**Bir defect'i bildirmeden önce ERİŞİLEBİLİRLİĞİ kanıtla; dosya adı değil, import yolu.**

**Ders 2 — 1028 modüllük erişilebilirlik analizi, üç sahte rozetin de ÖLÜ KOD olduğunu gösterdi.**
`decision-domain/decision-workspace`, `knowledge-domain/knowledge-intelligence` ve
`director-dashboard/item-list` — üçü de `src/app` ağacından ulaşılamıyor. Render edilmeyen bir
rozet kimseyi yanıltmaz. **Ölü kod bir truth-surface defect'i değildir; gizli bir tuzaktır.**
Onarım değil, guard gerekiyordu.

**Ders 3 — `/approvals` reponun en dürüst yüzeyi çıktı, ve bunu kendi kodunda yazıyor.**
`features/decisions/workspace-model.ts` legacy mock projeksiyonu **açıkça reddediyor** ("the legacy
`/approvals` projection (getDecisionProjection) is a mock"), her instance bölgesi için dürüst boş
durum render ediyor ("None connected", "No evidence is attached to a decision"), ve
Approve/Reject affordance'ı YOK çünkü sunucu yetkili bir mutation yolu yok. Denetim, bir defect
aramaya gidip **doğru yapılmış işi** buldu — ve bunu bildirmek de denetimin işi.

**Ders 4 — Kanıt yokluğunda doğru cevap "hayır" değil, "hiçbir şey".**
Hebun'da "bu kanıt Verified" diyebilecek **hiçbir authoritative kayıt yok**. `/approvals` bunu
sahte bir rozetle değil, hiçbir rozet göstermeyerek çözmüş. `Verified` kelimesi bir authority
iddiasıdır: arkasında bir Governance olayı yoksa sunum onu üretemez.

**Ders 5 — Guard'ı stringe değil ERİŞİLEBİLİRLİĞE yaz, ve negatif kontrolle ısır.**
Yeni test `"Verified"` literalini yasaklamıyor (meşru olduğu yerler var); route'tan erişilebilir
bir sahte rozet olmamasını assert ediyor. Silinen dosya testi geçiyor. Testin boş geçmediği,
geçici olarak canlı bir bileşeni listeye ekleyip **fail ettirilerek** kanıtlandı.

### Haftalık 3 soru
1. **What did we learn?** Bir defect raporu, erişilebilirlik kanıtı içermiyorsa yarım rapordur.
   Ve bir denetim "temiz" sonucuyla bitebilmeli — bulgu üretmek için onarım icat edilmez.
2. **How does this improve Turkish Rug House?** Direktör onay ekranında sahte bir "Verified" rozeti
   görmüyor ve hiç görmemişti; artık biri o bileşeni monte etse test durduruyor.
3. **How does this become part of Hebun AI?** `/director` turunda konan invariant guard'a bağlandı:
   arkasında authority olmayan bir doğrulama rozeti hiçbir route'tan erişilebilir olamaz. KR5'in
   önündeki legacy truth-surface engeli kapandı.

## KR5 Tarihsel Cevap Kanıtı — bir anı ile bir gerçek aynı şey değildir (2026-08-15)

368/368 (365→368), lint 0 error, build clean. Şema deltası: **2 tablo + 1 index**, migration: **1**,
dependency: **0**. Canonical `hebun_r1` bit birebir aynı: 34/124/1/1/8/8/17, 24 applied, sadece
`plpgsql`, KR5 tabloları yok, sızan disposable DB yok.

**Ders 1 — Referans tek başına yetmez, çünkü `recordRef` versiyona bağlı DEĞİL.**
`domainKey/factKey` supersession'dan sonra BAŞKA bir metne çözülüyor. Node id'ye referans vermek de
yetmiyor: `provenance`/`sourceAttribution` mutable jsonb, `ratifiedAt` sonradan K4 ile değişebiliyor,
`freshness` ise saatten türetiliyor — yani yeniden hesaplandığında yapısal olarak farklı çıkıyor.
**Kimlik referanslanır, duruş anlık kopyalanır.** İçerikten sadece okuyucunun gördüğü 240 karakterlik
sınırlı excerpt saklanır; `statement` saklansaydı bu tablolar ikinci bir Knowledge deposu olurdu.

**Ders 2 — Sıfır öğeli set BİR İFADEDİR, yokluk değil.**
"Retrieval hiç çalışmadı" ile "çalıştı ve kurumunuzda bu konuda bir şey yok" tamamen farklı iki
cümle. Tek düz tablo bunları ayıramaz — bu yüzden set/item ayrımı var. KR4'ün "dört boş durum dört
farklı şey söyler" disiplini tam da reload anında kaybolacaktı.

**Ders 3 — Bileşik FK, kontrol edilen değil KURULAMAZ bir izolasyon üretir.**
`(message_id, tenant_id) → messages(id, tenant_id)`. Düz bir `message_id` FK'sı, A tenant'ının
kanıtını B'nin mesajına bağlamayı sadece uygulama koduna bıraktı. Ham SQL ile denendi, veritabanı
reddetti. Bunun için `messages(id, tenant_id)` unique gerekti — **ve drizzle-kit ifadeleri YANLIŞ
SIRADA üretti**: FK'yı bağımlı olduğu index'ten önce koydu, migration
`there is no unique constraint matching given keys` ile patladı. İki sıralama da disposable DB'de
denendi; sıra düzeltildi ve teste bağlandı. **Üretilen migration'ı okumadan kabul etme.**

**Ders 4 — Dördüncü bağımsız yazıcı, kapatmaya çalıştığın yalanı üretirdi.**
`persistExchange` üç ayrı await'ti; user ile assistant arasında hata olunca cevapsız soru commit
oluyor ve `durable: false` deniyordu — dürüst bildirimle kalıcı durum çelişiyordu. Kanıtı dördüncü
bağımsız yazım yapsaydık: kalıcı bir assistant + kanıtsız = reload'da "retrieval hiç çalışmadı"dan
AYIRT EDİLEMEZ. Tek transaction; conversation oluşturma da içeride, aksi halde geri alınan tur boş
bir thread bırakırdı. **Hatalar gerçek PostgreSQL hataları ile kanıtlandı (FK, unique, trigger) —
stub sadece kodun atomik olmayı NİYET ettiğini gösterir.** En keskin vaka: hata EN SON ifadede,
her şey eklendikten sonra — hepsi kayboluyor.

**Ders 5 — Modelin bir kaydı "kullandığı" kanıtlanamaz, o yüzden iddia edilmez.**
Kayıt "bu kanıt modele verildi ve okuyucuya gösterildi" der. Ölçülemeyen bir nedenselliği iddia eden
kayıt, uydurulmuş kanıttır. Model çıktısı hiçbir yerde citation için parse EDİLMİYOR — unutulabilir
bir kontrol değil, mekanizmanın tümden yokluğu.

**Ders 6 — Geçmiş faz testleri GELECEK hakkında iddia kurmuştu; onarıldı, zayıflatılmadı.**
İlk çalıştırmada 9 test kırıldı. Yedisi ya global migration sayısı ya da "benim sınırımdan sonra
hiçbir şey yok" diyordu — ikisi de gelecek hakkında iddia, ve Gate B'den geçen meşru bir faz onları
yanlışlıyor. Her biri kendi faz penceresine daraltıldı, sonrası **isimlendirilerek**. İkisi KR4'ün
kendi iddialarıydı ve Director kararıyla geçersiz kaldı; yeni doğruyu söyleyecek şekilde
güncellendi. Bir R2D testi ise **güçlendirildi**: artık sıfır orphan satır assert ediyor.

### Haftalık 3 soru
1. **What did we learn?** Bir anı ile bir gerçek aynı şey değildir, ve arayüz bunu söylemek
   zorundadır. Saklanmış bir snapshot çerçevesiz gösterilirse güncel-durum iddiasına dönüşür.
2. **How does this improve Turkish Rug House?** Altı ay sonra bir karara bakıldığında, o kararın
   hangi kurumsal bilgiye dayandığı — o günkü haliyle — görülebiliyor; bugünkü bilgi değişmiş olsa
   bile geçmiş yeniden yazılmıyor.
3. **How does this become part of Hebun AI?** Heby'nin cevabı artık kendi kanıtını taşıyor ve
   kanıt cevapla aynı transaction'da kalıcı. Retention politikası bilinçli olarak ertelendi; silme
   ebeveyn mesajın cascade'ini izliyor.

## R3A — Durable Authorization to Act (2026-08-16)

**Ders 1 — Hazırlanmış bir eylem bir DEĞERDİ, bir SATIR değil.**
Phase 17 zaten `REQUIRES_HUMAN_REVIEW` üretiyordu ve bu verdict `substrateConnected` kontrolünden
ÖNCE geliyordu — yani mimari "bu imkânsız" değil, "bir insan karar vermeli" diyordu. Karar verecek
yer yoktu: `approvals` tablosu 0 satır / 0 writer, `features/approvals/` sadece `mock.ts`. Uçurum
bir eksik özellik değil, bir kalıcılık boşluğuydu.

**Ders 2 — 32-bit hash bir onayı bağlayamaz.**
`actionId` FNV-1a idi ve kendi kaynağı bunu söylüyordu. Dedupe için doğru, güvenlik bağı için
yanlış: 32 bit saniyeler içinde aranabilir. Onayı bağlayan ayrı bir SHA-256 digest eklendi; tüketimde
üç yönlü doğrulanıyor (yeniden hesaplanan / saklanan / permit'e kopyalanan).

**Ders 3 — Doğrulama TEK bir statement olmalı, sıra değil.**
`check → sonra update` şekli iki çağıranın da `active` okuduğu bir pencere bırakır — bir onayın iki
gönderiye dönüşmesinin tam mekanizması. Tek `UPDATE ... WHERE status='active' AND expires_at > now()`
ve satır sayısı verdict. Sekiz paralel çağıranla kanıtlandı: tam bir kazanan, yedi dürüst ret, tek
audit kaydı. Sıralı bir test bunu ASLA kanıtlayamazdı.

**Ders 4 — Writer'ı olmayan bir state, bir güvenlik özelliği değil bir iddiadır.**
`expired` state'i kasıtlı olarak YOK: Hebun'da scheduler yok, dolayısıyla saklanan bir `expired`
hiçbir şeyin geçiş yaptırmadığı bir state olurdu. Bu repo bunu iki kez ödedi (I1 revocation, invitation
revocation). Aynı sebeple revocation ihraçla AYNI fazda yazıldı — geri alamayacağı bir yetki vermeyi
reddetti.

**Ders 5 — Aynı decision type'ı paylaşan iki faz, outcome sırasına dikkat etmeli.**
Permit revocation, G3'ün delegation'ı sonlandırmak için kullandığı `revoke` type'ını kullanıyor.
Generic `revoke` dalı önce çalışsaydı ledger "Governance yetkisi geri alındı" derdi — oysa sadece bir
eylemin izni bitti. R3A dalı jenerik daldan ÖNCE değerlendiriliyor; bu sıra taşıyıcı.

**Ders 6 — drizzle-kit aynı hatayı yine yaptı, ve gate önce kanıtladı.**
Composite FK, ihtiyaç duyduğu unique index'ten ÖNCE emit edildi — KR5'in birebir aynısı. Önce tek
kullanımlık DB'de hata kanıtlandı (`there is no unique constraint matching given keys`), sonra index
yukarı taşındı. Bir test artık sıralamayı assert ediyor.

**Ders 7 — 11 miras test onarıldı, zayıflatılmadı.**
Yedisi "benim sınırımdan sonrası" listesiydi (gelecek hakkında iddia), üçü audit sink sahip listesi
(beş → altı), biri de kendi yorumunun "running total'ın ait olduğu TEK yer" dediği migration sayısı
(25 → 26). Hiçbiri gevşetilmedi; her biri kendi konusunu doğru söyleyecek şekilde güncellendi.

### Haftalık 3 soru
1. **What did we learn?** Yetkilendirme ile icra arasındaki sınır, kodda değil ŞEMADA durmalı.
   Permit'i decision'sız yazamamak bir NOT NULL FK; ajanın onaylayamaması bir CHECK; çift harcama bir
   partial unique index. Uygulamanın hatırlaması gereken hiçbir kural güvenlik kuralı değildir.
2. **How does this improve Turkish Rug House?** Bir müşteriye e-posta gitmeden önce, kimin neyi tam
   olarak hangi parametrelerle onayladığı — ve o onayın hâlâ geçerli olup olmadığı — yeniden başlatma
   sonrası bile kanıtlanabilir. Onay ile gönderim artık aynı an değil.
3. **How does this become part of Hebun AI?** Hebun artık bir sonuçsal eylemi yetkilendirebiliyor ve
   bunu icra ettiğini ASLA söylemiyor. R3B tek bir sandboxed adapter ile bu izni harcayacak; o gelene
   kadar izin verilmiş ama yapılmamış hâli dürüst son durumdur.

## R3W — Durable Work Artifacts (2026-08-16, implementation, NOT committed / NOT applied to canonical)

**Ders 1 — Gate A'nın bulduğu asıl kusur "eksik tablo" değil, "yalan söyleyen bir yetenek"ti.**
Registry `prepare-operational-plan` için `substrateConnected: true` diyor ve kendi yorumu teslimatın
hazırlanmış paket olduğunu söylüyor — ama o paket bellekte bir değerdi ve buharlaşıyordu. R3A bir kat
yukarıda aynı kusuru kapatmıştı ("prepared action bir değerdi, satır değil"). Teslimat hâlâ değerdi.
Yeni tablo icat etmedik; zaten ilan edilmiş bir yeteneğin dayanağını yazdık.

**Ders 2 — İçerik değişmezliği bir disiplin değil, ŞEMA + FIREWALL meselesi.**
`work_artifact_revisions` bilerek `tenantColumns` KULLANMIYOR: version sayacı, updatedAt, soft delete
mutable satır modelidir. Precedent `audit_log`. Üstüne bir test "hiçbir writer `.update(
workArtifactRevisions)` içermez" diye assert ediyor. Onayın byte'lara bağlanabilmesi tam olarak bunun
üzerinde duruyor.

**Ders 3 — Ref'in İÇİNDE revizyon numarası olmalı; sadece artifact id yetmez.**
R3A'nın canonical payload'ı ref STRING'ini hash'liyor. Çıplak bir ref hareketli hedeftir: "draft X"i
onayla, X'i revize et, aynı string artık başka byte'ları gösterir. `work-artifact/<uuid>@<n>` +
`content_digest` ikilisi ORDINARY SCALAR olduğu için R3A hiç değişmeden bağlamayı kapatıyor. Tek
yazım kuralı şart: `@01`, `@+1`, `@1 `, büyük harfli uuid parse EDİLMEMELİ — dört yazım, dört farklı
hash, dört farklı onay demektir.

**Ders 4 — "Readable" ile "proposable" ayrılmazsa bayat onay canlı onaya dönüşür.**
Superseded revizyon sonsuza dek okunabilir kalır ama YENİ öneriye zemin olamaz. Bir stale ref'i
sessizce current'a yükseltmek, tam olarak bir taslak için verilen onayın başka bir taslağı
yetkilendirmesidir. Foreign tenant ref'i "yok" döner, "senin değil" değil.

**Ders 5 — record-ref argümanı deliği: modül kendi başlığında doğru yeri yazmıştı, orası boştu.**
`arguments.ts` "record-ref'in kanıta çözülüp çözülmediği capability-gate'in işi" diyordu;
capability-gate sadece TARGET'ı kontrol ediyordu. Onarım argüman KIND'ına göre generic yapıldı (alan
adına göre değil) ve `evidenceSufficient` kontrolü human-review dalının ÜSTÜNE taşındı: neye
dokunacağını söyleyemeyen eylem FAILED olur, insana gitmez. `recordActionRequest` yalnız
REQUIRES_HUMAN_REVIEW kabul ettiği için onarım R3A'ya hiç dokunmadan zincire ulaştı.

**Ders 6 — drizzle-kit aynı sıralama hatasını ÜÇÜNCÜ kez yaptı (KR5, R3A, R3W).**
Composite FK, hedefi olan unique index'ten önce emit edildi. Önce 26 önceki migration üstüne tek
kullanımlık DB'de hata kanıtlandı, sonra index yukarı taşındı. Artık bunun tesadüf olmadığı kabul
edilmeli: bu şekle sahip her migration üretimden sonra elle denetlenmeli.

**Ders 7 — "Tablo henüz yok" bir koruma değil, şanstır.**
Testlerden biri write-deps enjekte etmeyi unuttu ve writer ambient `DATABASE_URL`e (yani canonical'a)
çözdü. Yazma başarısız oldu — çünkü tablo orada yok. Canonical hemen doğrulandı, test düzeltildi.
Fail-closed davranış doğruydu ama guard değildi; her entegrasyon testi DB'sini açıkça enjekte etmeli.

**Ders 8 — 9 miras test onarıldı, hiçbiri zayıflatılmadı.**
Yedisi migration allowlist/sayaç (mekanizma tam da tasarlandığı gibi çalıştı), biri source-class
sayısı (artık dokuz sınıfı ADIYLA sayıyor), biri de `heby-actions` fixture'ları: dört vaka
governance/authority/staleness'i test ederken hiçbir şeyi göstermeyen ref'ler (`r-1`, `d-1`, `s-1`)
kullanıyordu. Fixture'lar gerçekten destekli hâle getirildi; assertion'lar aynı kaldı. Deliğe
yaslanıyorlardı, artık yaslanmıyorlar.

### Haftalık 3 soru
1. **What did we learn?** Hazırlanmış iş, organizasyonel gerçek DEĞİLDİR ve onay DEĞİLDİR — ama
   dayanağı olmadan hiçbir sonuçsal eylem dürüstçe önerilemez. Değişmez revizyon + içerik digest'i,
   "incelenen şey ile icra edilecek şey aynıdır"ı bir vaat olmaktan çıkarıp bir yapı hâline getirir.
2. **How does this improve Turkish Rug House?** TRH için yazılan bir e-posta taslağı artık kalıcı,
   tenant'a kapalı, sürümlü ve tam olarak hangi mesajdan doğduğu belli bir kayıt. Direktör 1.
   revizyonu onaylarsa, 2. revizyon o onayı miras alamaz — metin sessizce değişip gönderilemez.
3. **How does this become part of Hebun AI?** R3W, `prepare-information` yeteneğinin gerçek dayanağı.
   `draftRef` artık bir kurgu değil. Kalan tek /send ön koşulu alıcı otoritesi; R3A.1 ve R3B hâlâ
   bloklu ve bu dürüst son durum.

## R3W — Release gate: ambient veritabanı olayı (2026-08-16)

**Ders 9 — "Değişken zaten set değildi" bir güvenlik özelliği DEĞİL, şanstır.**
Enjeksiyonu unutulan bir mutating test, `resolveGovernanceDbOrNull()` üzerinden ambient
`DATABASE_URL`e düşüyordu. Çıplak test sürecinde o değişken set olmadığı için yazma reddedildi —
ilk açıklamam "tablo yoktu" demişti, YANLIŞ; ölçtüm: `DATABASE_URL` set edilirse aynı ihmal
CANONICAL'a yazıyor. `.env.local` source eden her shell bu durumda.

**Ders 10 — Onarım ikinci bir sahiplik sistemi kurmadan, MEVCUT harness'a yapıldı.**
`createDatabase()` başarılı olduktan sonra harness `process.env.DATABASE_URL`i kendi disposable
DB'sine el koyuyor, `dropDatabase()`te aynen geri veriyor. Enjeksiyonu unutulan yazma artık
disposable DB'ye düşer ve onunla birlikte silinir. Aynı ownership kanıtı (`created === true`),
yeni bir mekanizma yok.

**Ders 11 — Bir guard'ı kurarken kendi kendini vurabilir.**
`isProtectedDatabaseName` canlı `DATABASE_URL`i okuyordu; harness el koyunca kendi disposable
DB'sini "korumalı" sayıp drop'u reddedecekti. Çözüm: harness'ın o an sahip olduğu adı hariç tut,
korumayı ise HEM sürecin başlangıç değeri HEM canlı değer üzerinden yap. D1.1'in "DATABASE_URL ne
gösteriyorsa korumalıdır" iddiası bozulmadan korundu.

**Ders 12 — Ambient URL'e el koymak process singleton havuzunu doğurur.**
Enjeksiyonsuz çağrı `getControlPlaneDb()` singleton'ını disposable DB'ye açıyor; `dropDatabase()`
backend'leri öldürünce `terminating connection due to administrator command` unhandled error olarak
patlıyor. Bunu varsaymadım: fix sonrası ilk tam koşuda `k2-flow/create-and-read-postgres.ts` kendi
assertion'larını GEÇTİKTEN sonra teardown'da düştü. Koşulu yaratan harness olduğu için temizliği de
harness yapıyor.

**Ders 13 — Regresyon testi DÜŞMANCA ön koşulla koşmalı.**
`ambient-database-safety.ts` harness'ı kurmadan ÖNCE `DATABASE_URL`i bilerek canonical'a çeviriyor.
Set edilmemiş bir değişkene karşı guard kanıtlamak hiçbir şey kanıtlamaz.

**Ders 14 — Bir release, gideceği veritabanı hakkında MUTLAK iddia yazamaz.**
`ambient-database-safety.ts` "canonical'da 0 `work_artifact` tablosu var, 26 migration uygulanmış"
diye yazmıştı. R3W migration'ı canonical'a uygulanınca — yani release tam da varlık sebebini yerine
getirince — kendi regresyonu kırmızıya döndü. Suite yeşildi ÇÜNKÜ shipped ettiği şey henüz
kullanılmamıştı. Ölçtüm: test düştüğünde korumak istediği invariant aslında GEÇMİŞTİ; enjekte
edilmemiş yazma disposable DB'ye düşmüş, canonical'a dokunulmamıştı. Düşen şey güvenlik özelliği
değil, ortam fotoğrafıydı.

Doğru form: canonical-güvenlik regresyonu "bu test canonical'ı değiştirmedi" der; "canonical sonsuza
kadar testin yazıldığı gün neyse o kalmalı" demez. `captureCanonicalState()` artık migration
KİMLİĞİNİ (sıralı hash dizisi — 27 sayısı 27 yanlış migration ile de sağlanır), tablo adlarını ve
satır sayılarını `number | null` olarak alıyor; `null` = tablo yok, ki bu migration'ın HER İKİ
yakasında da meşru. Tek bir `deepEqual(after, before)` iki mutlak iddianın yerine geçti. Boş-geçmeyi
önlemek için ayrıca non-vacuity guard var: canonical erişilemezse karşılaştırma sessizce "geçemez".

**Ders 15 — İki saat alanı varsa, fixture hangisinin hüküm verdiğini kullanmalı.**
R3A testleri `NOW`u takvim sabitine (`2026-08-16T09:00:00.000Z`) pinlemiş ve bunu ihraç saati olarak
enjekte etmişti. Ama `consumeActionPermit` `expires_at > now()`u VERİTABANI saatine soruyor — bilerek:
kendi `now`unu geçirebilen çağıran, işine gelen bir `now` da geçirebilir. 3600s TTL ile 09:00Z'de
verilen permit, gerçek saat 10:00Z'yi geçince kalıcı olarak harcanamaz oldu. Test suite kendi kendini
imha eden bir zaman bombasıydı; R3A kapanışındaki 218/218 doğruydu, sadece o saat dilimi içinde
koşulmuştu.

Çözüm production'da DEĞİL fixture'da: `select now()` ile hüküm veren saati oku, onu enjekte et.
`now()` predicate'ine dokunulmadı, hiçbir assertion değişmedi, silinen satırlar tam olarak iki adet
`const NOW = new Date(...)`. Yanlış çözüm — `deps.now`u expiry predicate'ine bağlamak — çağırana
kendi süresi dolmuş permit'ini yetkilendirme gücü verirdi.

**Ders 16 — İki tabloyu kopyala-yapıştır etme; DEĞİŞİM BİÇİMİNİ sor.**
R3R'ye `work_artifacts` + `work_artifact_revisions` desenini aynen taşıyacaktım. Yanlış olurdu.
Revision tablosu var çünkü artifact İÇERİĞİ tekrar tekrar DÜZENLENİYOR ve geçmişi anlamlı. Bir adres
hiç düzenlenmez — DEĞİŞTİRİLİR. Satırı immutable yapınca aynı "onaylanan baytlar kayamaz" garantisi
bir tablo eksiğiyle geliyor, ve `@<n>` revizyon eki de gereksizleşiyor: id zaten tam baytları
adlandırıyor. "Jane'in maili değişti" = retire E1 + create E2.

Sonuç: `external-recipient/<uuid>`, `work-artifact/<uuid>@<n>` değil. Kanıt: hiçbir dosyada
`endpointValue`/`endpointDigest`/`endpointKind` bir `.set({...})` içinde geçmiyor — testi `src/`
altındaki her dosyayı tarayıp bunu yapısal olarak doğruluyor.

**Ders 17 — Guard KELİMEYİ değil İDDİAYI yasaklamalı.**
"verified" kelimesini R3R kodunda yasaklayan firewall testim, tam da korumak istediğim cümlede
patladı: provenance satırı "never verified" diyor. Bu bir inkâr, iddia değil. 3e654f5 bu dersi zaten
yazmıştı ("banning the literal is the brittle kind of guard this repository has already been bitten
by twice") ve ben yine düştüm. Doğru form: string literalleri çıkarıp IDENTIFIER'larda ara, olumlu
iddiaları (`is verified`, `verified recipient`) ayrıca yasakla, dürüst inkârın VARLIĞINI ise zorunlu
kıl.

**Ders 18 — Yeni migration + yeni source class = 9 testi kırar, ve bu doğru davranış.**
R3R tek migration ve tek source class ekledi; `npm run verify` 9 testle düştü. Hiçbiri bug değildi:
7 tanesi faz-sınırı listesi ("benim fazımdan sonra şu migration'lar geldi"), 1 tanesi global sayaç
(27→28, aynı dosyada İKİ yerde), 1 tanesi source-class vokabüleri. Bunlar kasıtlı review kapıları —
yeni bir source class biri onu oraya yazmadan ortaya çıkamıyor. R3W de aynı 7 dosyaya dokunmuştu.
Ders: sayaç kıran test aramayı değil, sayaç kıran testi BEKLEMEyi öğren; ilk `verify` kırmızısını
"bir şey bozdum" diye okuma.

**Ders 19 — Kapattığın limitation'ı kendi sabitinde de kapat.**
R3W `RECIPIENT_SUBSTRATE_GAP.statement` içinde "no recipient authority exists in Hebun" diyordu ve
bir test bu cümleyi pinliyordu. R3R onu yanlışladı. Sildim değil, ONARDIM: sabit artık gerçekten
açık olanı söylüyor (action schema'da digest argümanları yok, sahibi R3A.1), test ise eski cümlenin
GİTTİĞİNİ assert ediyor. Aksi halde suite yeşil kalırdı — bayat bir iddia hayatta kaldığı İÇİN.

**Ders 20 — Aynı hatayı üçüncü kez yaptım: guard KELİMEYİ yasakladı, İDDİAYI değil.**
R3A.1 firewall testinde üç kez üst üste kendi meşru kodum patladı: `receipt` yasağı kendi
`SendProposalReceipt` tipimi vurdu; `authorized` yasağı "nothing is authorized" cümlesini vurdu;
`verified` yasağı (R3R'de) "never verified" provenance satırını vurdu. Ders 17'yi yazdım ve yine
düştüm. Kural artık şu: bir firewall testi yazarken önce sor — "bu yasak, korumak istediğim dürüst
İNKÂRIN üzerine basar mı?" Doğru form: string literalleri çıkar, sadece identifier ara; olumlu
iddiaları regex ile yasakla; inkârın VARLIĞINI zorunlu kıl.

Bonus: testin kendisi gerçek bir tutarsızlık yakaladı. `SEND_PROPOSAL_NON_EFFECTS` içinde
"draft ve adres digest ile donduruluyor" cümlesi vardı — bu bir İNKÂR değil, olumlu bir olgu.
Adı NON_EFFECTS olan listede duracak şey değildi; `SEND_PROPOSAL_EFFECTS` diye ayırdım.

**Ders 21 — Argüman SAYMAK yeterli değil; ŞEKLİNİ de doğrula.**
`/send` planner'ı önce sadece "yeterli argüman var mı" diye baktı. Voice testi bunu yakaladı:
dikte "/send the invoice" üretiyor — iki argüman, hiçbiri bir referans. Sayım kontrolü bunu sunucuya
geçirir ve DB bağlantısı açılırdı. Çözüm: `HebyCommandArgument.pattern` — planner saf, yerel,
sunucusuz reddediyor. Yazılan/söylenen çöp artık yazma seam'ine hiç ulaşmıyor.

Ayrıca: bu testi "gevşetmek" yanlış olurdu. `/send the invoice` eskiden "no execution runtime"
diye reddediliyordu; artık o cümle bu komut için YANLIŞ. Testi silmedim, kendi assertion'ına
taşıdım — korunan özellik (dikte edilmiş nesir proposal dosyalayamaz) aynı kaldı, gerekçe düzeldi.

**Ders 22 — Firewall bazen senin tasarımına haklı olarak itiraz eder.**
`heby/actions.ts`'e `revalidatePath("/approvals")` koydum; r2c/r2d testleri "bu modül next/cache
import edemez" diye düştü. Bu bir count-pin değildi, gerçek bir sınırdı: o modül provider, db,
drizzle, execution ve cache yetkilerinin hiçbirini almıyor. Doğru hamle firewall'u genişletmek
değil, `revalidatePath`'i atmaktı — `/approvals` zaten ayrı gezilen, sunucuda render edilen bir
sayfa. Bir kolaylık için güvenlik sınırı genişletilmez.

---

## R3B — First Executed Action (implementation, uncommitted)

**Ders 23 — Şemadaki en önemli parça zaten oradaydı; üretmeye kalkışmak hataydı.**
Idempotency key için yeni bir token üretecektim. `action_permits.handoff_id` zaten var: spend
statement'ının içinde bir kez mint ediliyor, `action_permits_handoff_uq` ile unique, ve
`consumed_chk` sayesinde harcanmamış bir permit'te var olamıyor. Yeni token üretmek "bu hangi
eylem" sorusuna ikinci bir cevap yaratırdı — ve iki cevap er geç çelişir. Yeni bir alan
eklemeden önce mevcut şemanın o soruyu zaten cevaplayıp cevaplamadığına bak.

**Ders 24 — CHECK constraint yazarken satırın DOĞDUĞU durumu test et.**
`(status='refused') = (provider_response_class is null)` yazdım. Mantıklı görünüyordu ve her
`pending` satırını yasaklıyordu — yani her attempt'i, çünkü hepsi pending doğuyor. Doğrusu
"adapter çağrıldı mı" invariant'ıydı: `(prc is not null) = (status in ('accepted','failed',
'unknown'))`. Bir constraint'i sadece terminal durumlarla değil, ilk INSERT'le de sına.

**Ders 25 — drizzle-kit composite FK'yı, ihtiyaç duyduğu unique index'ten ÖNCE yazar.**
`action_permits(tenant_id, id)` unique'ini dosyanın sonuna, ona REFERENCES eden FK'yı ortasına
koydu. Tüm migration tek transaction olduğu için hepsi sessizce rollback oldu — drizzle-kit
`migrate` exit 0 döndürdü, spinner hatayı yuttu. Migration'ı elle yeniden sıraladım. Kural:
generate'den sonra migration'ı tek başına disposable bir DB'ye `psql -v ON_ERROR_STOP=1` ile
uygula; "applied=0" sessiz başarısızlığın imzasıdır.

**Ders 26 — Bir kararı kanıtlayan test, kararı ismiyle daraltılır; silinmez.**
20 test düştü, üçü de beklenen sınıftı: substrate-connected iddiaları, migration count pin'leri,
audit-sink owner allowlist'i. Hiçbirini silmedim. `substrateConnected === false` süpürmelerine
`if (kind !== "send-external-communication") continue` ekledim — koruma diğer üç mutation ve
device tool için aynen duruyor, üstüne "en fazla bir tane bağlı olabilir" cardinality guard'ı
ekledim. Guard'ı silmek yerine güçlendir.

**Ders 27 — Kendi firewall'um, benim atladığım bayat iddiayı yakaladı.**
`staleClaimsRepaired()` testini yazarken `approvals/page.tsx`'in hâlâ "execution substrate is not
connected" dediğini bilmiyordum; test düştü ve buldu. Record-integrity kontrolünü kod yazarken
değil, teste yazarak uygula — insan hafızası dosya taramaz.

**Ders 28 — Timeout'u "failed" saymak, çift gönderim davetidir.**
Claude transport'u her abort'u `timeout`, her throw'u `provider-unavailable` yapıyor. Bir okuma
için doğru, bir SEND için tehlikeli: request yazıldıktan sonraki timeout, sağlayıcının kabul etmiş
olabileceği durumdur. `unreachable` sadece bağlantının hiç kurulmadığını KANITLAYAN kodlarda
(ENOTFOUND, ECONNREFUSED, TLS) verilir; ECONNRESET/EPIPE/ETIMEDOUT dahil kalan her şey
`ambiguous` → UNKNOWN. Yanlış "unreachable" pahalı ve geri dönüşsüz; yanlış "unknown" sadece
insana baktırır.

**Ders 29 — Sağlayıcı seçilince, yapılandırılabilir endpoint bir güvenlik gevşemesidir.**
`HEBUN_EXTERNAL_SEND_ENDPOINT` hiçbir vendor seçilmemişken doğru tasarımdı: kod içine uydurma bir
host yazmamak için. Resend seçildikten sonra aynı değişken *arbitrary-URL yeteneği* haline geldi —
`ADAPTER_SANDBOX_BOUNDARY` "no arbitrary URL" diyor. Sabite çevirdim. Buradaki test de tersine
çevrildi, silinmedi: eskiden "transport'ta https literal olmasın" diyordu, şimdi "tam olarak bir
tane olsun ve Resend'inki olsun" diyor. Bir guard'ın yönü değişebilir; kendisi durur.

**Ders 30 — İç sözleşme, wire sözleşmesi değildir.**
`idempotencyKey` adapter input'unda kalır; Resend onu header olarak aldığı için body'den çıkarıldı.
Body'de bırakmak, okunmayan ikinci bir yetki-taşıyan kopya demekti. Aynı ayrım `endpointKind` için
de geçerli. Adapter'ın ne aldığı ile sağlayıcının ne gördüğü ayrı iki karardır.

**Ders 31 — Bir yasağı kelimeyle değil, mekanizmayla test et.**
"replay yok" testini `LIVE_CODE.includes("replay")` ile yazdım; doktrin değerinin kendisi
`automaticReplay: false` dediği için test düştü — yani *inkârı* ihlal sandı. Doğrusu mekanizmayı
aramak: saat yok (`Date.now`), zamanlayıcı yok, döngü yok, ve tam olarak bir dispatch noktası var.
Kelime taraması, yasağı ilan eden kodu yasağın ihlali olarak okur.

**Ders 32 — Prose bir string literal'e yazılırsa, comment-stripping guard'ı onu yakalar.**
R3A firewall'u `action-authorization/contracts.ts` içinde "credential" kelimesini yasaklıyor
(permit kimlik bilgisi taşımaz). Açıklama metnimi yorum değil string olarak yazdığım için guard
tetiklendi. Guard haklıydı; metni yeniden yazdım. Yasağı gevşetmek yerine cümleyi değiştir.

**Ders 33 — "Caller yok" demeden önce grep desenini doğrula.**
Önceki gate'te "external-send control'ü yazabilecek hiçbir production caller yok" dedim. Yanlıştı:
`platform/actions.ts` Claude control'ünü zaten yazıyordu ve Providers & Models altında tam
çalışan bir R2E yüzeyi vardı — kart, projection, authority resolver. Benim grep'im bozuktu.
Sonuç kötü olmadı ama sebebi şans: doğru bulgu "authority yetim" değil, "authority'nin sadece
external-send yarısı eksik"ti. Bir şeyin YOK olduğunu iddia etmek, VAR olduğunu iddia etmekten
daha dikkatli arama ister.

**Ders 34 — İkinci sağlayıcı, ikinci tablo değil ikinci typed wrapper demektir.**
`setDirectorEnabled(providerKey, …)` zaten generic'ti; Claude'a özel olan sadece wrapper'dı ve bu
kasıtlıydı — client'ın rastgele provider string'i ile satır üretememesi için. Doğru genişletme
wrapper'ı generic yapmak değil, yanına ikinci typed wrapper koymak. Kapalı sözlük kapalı kalır.

**Ders 35 — Türetilmiş durumu persist etme; kompozit durum ham izni gizlemesin.**
Configuration env'den türetilir, DB'ye kopyalanmaz: kopya deployment değişince bayatlar ve yüzeyin
gösterdiği tam da bayat olandır. Ama kompozit `armingState` ham `directorEnabled`'ı yutmamalı —
"izin açık ama config yok" durumu operatöre görünür kalmalı, yoksa açık bir switch'i kimse fark
etmez.

**Ders 36 — Kolon iddiasını dosya metninde değil, kolon bildiriminde ara.**
"Control tablosu `from` taşımamalı" testi ES `import … from` satırına takıldı. Ders 31'in aynısı
başka kılıkta: yasağı doğru granülariteye sor. Dosyada kelime aramak yerine bildirilen kolon
listesini çıkar ve onu iddia et.

**Ders 37 — Sayaç ile kimlik ayrı stream'e yazılırsa kimlik kaybolur, sayaç doğru kalır.**
`384 passed, 1 failed` çıktısı doğruydu; hangi testin düştüğü hiçbir yerde yoktu. Sebep suite değil
runner'dı: `FAIL <label>` stderr'e, güven veren `PASS` satırları ve asıl sayı stdout'a gidiyordu ve
sonda kimse ismi tekrar yazmıyordu. En tehlikeli hata biçimi bu — sayı sana güven veriyor, araştırmak
için gereken tek şey ise zaten silinmiş. Kural: kimliği özetin yanında, aynı stream'de yeniden yaz;
böylece sondan kırpma sayıyı da götürür, sayıyı bırakıp ismi almaz. Ayrıca `result.error` okunmadığı
için ENOBUFS/ENOENT çıplak bir FAIL olarak görünüyordu ve 1MB'lık varsayılan `maxBuffer` hiçbir şey
iddia etmeyen, 0 ile çıkan bir testi **uydurma başarısızlığa** çeviriyordu — runner'ın kendi
raporlaması ürünün doğruluğu kadar denetim ister.

**Ders 38 — Raporlama onarımı, sembolü açıklar; arızanın gerçek olmadığını kanıtlamaz.**
Kimlik kaybını deterministik olarak yeniden üretip düzelttim, ama asıl `1 failed` hiçbir zaman tekrar
etmedi: normal, ters ve iki ayrı ortam dalında 2709 test yürütümü tamamen yeşil. İkisi ayrı ayrı
söylenmeli. "Sebebi buldum" demek için sembolü değil arızayı üretmen gerekir. Elenenler sayıyla
kayda geçti: stdout en kötü 3.069 B/1 MB, `drizzle-kit migrate` 337 B, terminate→drop **90 denemede 0**
başarısızlık, ambient DB **boş** döndü. Ve kendi araçlarım iki kez yanılttı — regex `.dispose?.()`'ı
kaçırdı, `pgrep -f` kendi wrapper shell'ini yakalayıp döngüyü hiç bitirmedi.

**Ders 39 — Bir döngü foreign key ile kapalıysa, "mevcut authority'ye devret" bir çözüm değildir.**
Gate A "ilk root'u governance-genesis'e, rolleri tenant-role-baseline'a devret" demişti. İkisi de
boş bir tenant'tan erişilemez: `provision-member-role` bootstrap decision ister,
`resolveNominationTarget` henüz var olmayan dört tabloyu join eder, `membership_authorizations`
iki NOT NULL FK ile Governance'a bağlıdır ve `genesis_nominations` composite FK ile membership'e.
Kesme noktası `memberships`'ten sonraya taşınamaz — bu yüzden istisna tam olarak üç tablo. Devir
zincirini iddia etmeden önce her halkanın ŞEMASINI oku; yorum satırı değil, FK'ler karar verir.

**Ders 40 — Aktörü olmayan bir tören audit yazamaz; o zaman satırın kendisi kanıt olmalıdır.**
`audit_log.actor_type`/`actor_id` ikisi de NOT NULL. Terminaldeki insanın kimliği yok. G2.1 aynı
sorunu audit yazmayarak ve `nomination_source` kolonunu satıra koyarak çözmüştü. Ben de öyle yaptım.
Kritik nokta: hiçbir şey taşımayan satır kanıt değildir — `created_by` NULL zaten fixture satırlarında
da NULL, yani kolon olmadan tören ile seed ayırt edilemezdi. Audit'i atlıyorsan, satıra "hangi kök"
yazmak zorundasın; "kim" yazmak ise yalan olur.

**Ders 41 — drizzle-kit'in ürettiği migration'ı okumadan kabul etme; snapshot bayatlayabilir.**
`generate` R4A ile ilgisiz dört statement üretti: R3B'nin iki CHECK'ini DROP edip birini geri ADD
ediyordu. Sebep: R3B migration SQL'ini ve şemasını elle düzeltmiş ama snapshot'ı yeniden
üretmemişti. Canonical'ı doğrudan sorguladım — canonical şema ile uyumlu, snapshot ile değil.
O statement'lar canonical'da PATLAYACAKTI (`DROP CONSTRAINT` olmayan bir kısıt üzerinde), ve drizzle
tüm bekleyen migration'ları tek transaction'da uyguladığı için her şey geri alınırdı. SQL'i kendi iki
statement'ıma indirdim, üretilen snapshot'ı ise tuttum: o şemadan hesaplanır, yani gerçeği yazar ve
drift'i iyileştirir. Kural: `generate` çıktısını diff gibi oku, çıktı gibi değil.

**Ders 42 — Bir yasağı ihlal edilebileceği granülarite'de sor.**
"Kimlik bilgisi sızmasın" testini `/credential/i` ile yazdım; CLI reddedilen operatöre
`npm run auth:dev-credential` çalıştırmasını söylediği için düştü — yani kimlik üretmeyi REDDEDİP
sahibini gösteren cümleyi ihlal sandı. Ders 31'in üçüncü tekrarı. Doğrusu mekanizma: credential
taşıyan kolon, hasher import'u, ve secret taşıyabilecek dördüncü argüman. Guard gevşemedi, güçlendi.

**Ders 43 — "Her sonraki migration'ı beyan et" guard'ı tam olarak işini yaptı.**
Yedi faz testi R4A'nın migration'ı yüzünden düştü. Bu bir kırılma değil, tasarım: hiçbir migration
sessizce belirememeli. Onarım sayıyı büyütmek değil, beyanı eklemekti. Buna karşılık
`r3b-flow/execution-postgres.ts` global `29` sabitini pinlemişti — R3R'yi onarmaya zorlayan desenin
aynısı, bu kez R3B'nin kendisinde. Global sayım faz testinde bir iddia değil, gelecekteki her faz
hakkında bir kehanettir; state-relative yapıldı.

**Ders 44 — Enforcement'ın var olması, her yolda çalıştığı anlamına gelmez.**
`tenant_status` dört ayrı session kapısında kontrol ediliyordu ve bu doğru çalışıyordu — ama üç
pre-tenant akış (davet kabulü, enrollment başlangıcı/tamamlanması) tenant'ı **session'dan değil davet
satırından** çözdüğü için o kapıların hiçbiri onlar için hiç çalışmamıştı. Kanıt dosyaydı, tartışma
değil: üçü de `@/db/schema/company`'yi import bile etmiyordu. Bir kuralın uygulandığını "kod var" ile
değil, **o kurala ulaşan her giriş yolunu sayarak** doğrula.

**Ders 45 — Askıya alma yetkisi, askıya almadan sonra da erişilebilir olmalı.**
Tenant içindeki hiçbir authority suspend edemez: `resolveSessionFromReference` her istekte şirket
durumunu yeniden okur, yani suspend eden owner bir sonraki istekte kendi tenant'ına giremez,
Governance çalışamaz ve geri alma yolu kalmaz. Deployment possession tenant'ın aktif olmasına hiç
bağlı olmadığı için **iki yönde de** çalışır. Kural: bir state geçişi, o state'ten çıkarabilecek
yetki hâlâ ulaşılabilirse güvenlidir.

**Ders 46 — Bir yasağı kelimeyle test etme; ama "sıfır" da bir kelime kadar kaba olabilir.**
"R4B audit yazmaz" testini `audit_log = 0` diye yazdım; 10'da düştü — çünkü *fixture zinciri* (genesis,
G2, rol, yetkilendirme, davet, enrollment kararı) meşru olarak audit yazıyor. Global sıfır yalnızca
"hiç fixture çalışmadı"yı kanıtlar. Doğru iddia daha dar ve daha güçlü: bir suspend+reactivate çifti
boyunca sayı **değişmiyor**, hiçbir audit action lifecycle adı taşımıyor, ve var olan her satır gerçek
bir aktör adlandırıyor.

**Ders 47 — Uydurulamayan fixture, dürüst fixture'a zorlar.**
Approved bir enrollment `approval_decision_id` ile `decision_records`'a FK'li. Elle satır yazmak
mümkün değil — bu yüzden test gerçek zinciri çalıştırmak zorunda kaldı: Genesis → kabul → G2 → member
baseline → yetkilendirme → davet → enrollment → onay. Sonuç daha iyi bir test: her ret **tenant**
yüzünden olduğunu kanıtlıyor, eksik seremoni durumu yüzünden değil. Ve en keskin kanıt şu oldu:
suspend'liyken reddedilen **birebir aynı çağrı**, reactivate sonrası başarılı oluyor.

**Ders 48 — Kimlik doğrulanmamış bir akışta ret sebebi seçmek bir güvenlik kararıdır.**
Üç akış da mevcut `capability-not-usable`'ı yeniden kullanıyor; yeni bir "tenant-suspended" sebebi
eklemek, ilişkisini kanıtlamamış bir bearer'a organizasyon hakkında doğru bir bilgi verirdi. Dahası
`accept-invitation` her ret'te `spendEquivalentCredentialWork` harcıyor — benim kontrolüm de harcamak
zorundaydı, yoksa askıya alınmış tenant yanlış paroladan **ölçülebilir biçimde daha hızlı** reddedilir
ve modülün gerçek iş harcayarak kapattığı zamanlama oracle'ı geri açılırdı.

**Ders 49 — Bir byte sınırı seçilmez, türetilir.**
`MAX_FILE_BYTES = MAX_SOURCE_CHARACTERS * 4`. UTF-8 bir code point'e en fazla 4 byte harcar, yani
bu sınırın üstündeki bir dosya zaten mevcut 60 000 karakter sınırını geçemez — reddedilecekti.
Türetilmiş sayı savunma gerektirmez ve koruduğu sınırdan ayrı düşemez. Yuvarlak bir sayı seçmek
(512 KB gibi) iki yıl sonra kimsenin gerekçesini bilmediği bir sabit bırakırdı.

**Ders 50 — Request stream'de uygulanan framework limiti bir ret değildir.**
Next 16 server action gövdesini 1 MB'da keser (`action-handler.js`), ama bunu stream üzerinde yapar:
HTTP 413 action fonksiyonu hiç çalışmadan atılır. Ürün sebebi söyleyemez, sınırı adlandıramaz.
Kural: framework sınırının ALTINDA kendi sınırını koy, ret mesajı senin olsun.

**Ders 51 — `indexOf` tüm modülde ararsa tip tanımını bulur, çağrı yerini değil.**
"Yetki dosyadan önce çözülüyor" assertion'ım `indexOf("resolveAuthority")` ile yazılmıştı; bu,
fonksiyonun üstündeki deps interface'ini buluyordu. Sıra her zaman doğru çıkıyordu — **hiç
başarısız olamayacak bir assertion**. Sırayı bozup test ettiğimde geçti; ancak o zaman gördüm.
Anchor'ı fonksiyon gövdesinin içine taşı. Ve bunu yalnızca "ısırıyor mu" kanıtı ortaya çıkarır.

**Ders 52 — Ret'in SEBEBİNİ assert et, sadece sonucun olmadığını değil.**
`status !== "ratified"` bir crash'te, kayıt yokluğunda, validation kaymasında da geçer — hiçbiri
yetki hakkında bir şey kanıtlamaz. `refused / no-governance-authority` ise Knowledge yazma bandı
ile G2 ratification yetkisinin gerçekten ayrı iki güç olduğunu kanıtlar.

**Ders 53 — Decoder'ı preview ile paylaşmak, chunker'ı paylaşmakla aynı ilkedir.**
Tarayıcının `File.text()`'i varsayılan olarak hoşgörülüdür (bozuk byte'ı U+FFFD yapar); sunucu
`fatal: true` ile katıysa, bir dosya temiz önizlenip sonra reddedilir. Tek decoder, iki runtime.

**Ders 54 — Bir capability haritası, fazla iddia ettiği kadar az iddia ederek de yalan söyler.**
R4C.1 "hiç upload yolu yok" iddiasını yanlışladı. `k1-flow` bu inkârı `canProve` içinde `/file/i`
yasaklayarak koruyordu — onarılmasaydı harita gerçek bir yeteneği **eksik** raporlamaya zorlanacaktı.
Bir faz bir inkârı yanlışlıyorsa, o inkârı bekçilik eden guard AYNI commit'te onarılmalı; yoksa suite
yeşil kalır — çünkü bayat iddia hayatta kalmıştır.

**Ders 55 — Yamalayamadığın bir parser, yamalayabildiğin büyük olandan kötüdür.**
`unpdf` pdf.js'i kendi `dist`'ine gömüyor; `overrides`/`resolutions` başka bir paketin build
çıktısının içine ulaşamaz. Yani 2.1 MB'lik temiz paket, CVE-2026-16633 aralığındaki pdf.js'i
taşıyordu ve tüketici düzeltemezdi. 34.5 MB'lik `pdfjs-dist` upstream'in kendisi ve sürümü bizim
pinimiz. Önce "bunu kendim yamalayabilir miyim?" diye sor, sonra "kaç MB?" diye.

**Ders 56 — Bir bağımlılığın sertleştirme seçeneklerini advisory'den değil, KURULU artefakttan doğrula.**
Gate A `isEvalSupported: false` bekliyordu. 6.2.108'de bu seçenek paketin hiçbir dosyasında yok —
koruduğu eval yolu upstream'den kaldırılmış. Set etmek, hiçbir şeyin uygulamadığı bir korumayı iddia
eden bir yorum bırakırdı. İki tarafı birden assert et: seçenek upstream'de yok VE kod onu set
ediyormuş gibi yapmıyor. Geri gelirse test kontrolü zorunlu kılar.

**Ders 57 — Tek format için yazılmış bir kural, ikinci format gelince iki yönde birden bozulur.**
MIME kuralı `text/*` tolere edip gerisini reddediyordu. `.pdf` gelince hem `application/pdf`'i
(doğru ve en yaygın beyan) reddetti hem de `.pdf` üzerindeki `text/plain`'i tolere edecekti.
Tipe özgü kural tiple birlikte yaşamalı.

**Ders 58 — Fixture'lar üretim kodu kadar denetim ister; sessizce hiçbir şey kanıtlamazlar.**
İkisi de "geçti" ama boştu: xref dışına konan `/Encrypt` sözlüğü sarkan referans oldu, belge normal
açıldı; bütün bir sayfayı tek `Tj`'ye koyunca 111 000 karakterin 2 698'i çıktı, karakter tavanını
aşmayı amaçlayan test tavanın altında kaldı. Bir fixture'ın doğru davrandığını ölç, varsayma.

**Ders 59 — Kaba token taraması string literal'i kod olarak okur.**
"Longer documents exceed what one ingestion can hold" cümlesi `documents` guard'ını tetikledi —
yorum-temizleme bunu yakalamaz, çünkü string literal koddur. Tabloyu ara, İngilizce kelimeyi değil.

**Ders 60 — Global sayım bir faz iddiası değildir (ikinci kez).**
`Object.keys(dependencies).length === 8` "bu faz bir şey eklemedi" gibi okunur ama "hiçbir faz asla
bir şey eklemez" iddia eder. Tek bir incelenmiş bağımlılık, supersession ve membership integrity ile
hiç ilgisi olmayan iki suite'i birden kırdı. Faz iddiasını faz kapsamında yaz.

**Ders 61 — Guard'ın yorumları temizleyip temizlemediğini bil; aynı kuralın iki bekçisi çelişebilir.**
G2 firewall'u kaynağı HAM okur. Yasak modül yolunu *açıklayan* bir yorum, onu *import eden* bir satır
kadar tetikler. Kendi testim `codeOf()` ile yorumları temizlediği için geçti, G2 kaldı. Ders 59'un
tersi: orada string literal kod sayılmıştı, burada yorum kod sayıldı. Yasak bir tokenı yorumda
anlatacaksan, o kuralın bekçisinin ne okuduğunu önce ölç.

**Ders 62 — "Sadece DB handle'ı lazımdı" yine de bir import kenarıdır.**
Aggregation modülü null-safe DB resolver'ı Governance feature'ından aldı, çünkü orada hazırdı.
`heby-*` yüzeylerinin Governance'a uzanması yasak; firewall tam da bu tesadüfi kenar için var.
Kolaylık bir gerekçe değil — kardeş modülün (`provider-authority.server.ts`) zaten yaptığı gibi
handle'ı doğrudan db client'tan al.

**Ders 63 — Bayat iddia başka bir fazın testinde yaşayabilir.**
`/usage`'ı `requires-source` diye sabitleyen pin S1 suite'indeydi, kendi fazımda değil. Yazıldığında
doğruydu, seam ship olduğu anda yanlış oldu. Bir sınırı kapatan faz, o sınırın *her fazdaki* kaydını
onarmak zorunda; sadece kendi dosyalarını taramak yetmez.

**Ders 64 — Ölçülmüş ≠ okunabilir. Write-only kolon, var olmayan yetenektir.**
Token sayıları R2D'den beri doğru yazılıyordu ve üretimde hiçbir yer okumuyordu: sıfır `sum()`,
sıfır `GROUP BY`. Ürün "ne kadar kullandım"a cevap veremiyordu, çünkü eksik olan ölçüm değil
toplama yetkisiydi. Bir kolonun dolu olması, o bilginin sistemde bulunduğu anlamına gelmez —
tüketicisini ara.

**Ders 65 — Disk dolarsa Postgres durur; PGDATA'yı tahmin etme, `postmaster.opts`'a sor.**
Bu makinede benzer isimli üç data dizini var ve Homebrew'unkilerde `hebun_r1` yok. Yanlış olanı
başlatmak sessizce boş bir instance verir. Doğru dizin, o instance'ın kendi `postmaster.opts` ve
`postgresql.conf`'undaki porttur. macOS'ta ayrıca `LC_ALL` gerekir, yoksa
"postmaster became multithreaded during startup" ile düşer.

**Ders 66 — Yetki ile yetkilendirdiği şeyin kapsamı aynı olmalı; JOIN predicate'i bunu ele verir.**
`resolveProviderControlAuthority` rolü `and(eq(roles.id, roleId), eq(roles.tenantId, tenantId))`
ile çözüyordu — bu doğru davranıştı, istemcinin başka tenant'ın rolünü iddia etmesini engelliyor.
Ama koruduğu satırın `tenant_id`'si yoktu ve `provider_key` globalde unique. Yani tenant'a
hapsedilmiş bir yetki, hiç hapsedilmemiş bir yazmayı kapılıyordu. Kanıt canonical'daydı: satırı 29
kez değiştiren kullanıcının tek üyeliği Globex'te, satır Acme'yi de yönetiyordu. Çözüm yetkiyi
genişletmek değil, yazmayı üründen çıkarmaktı.

**Ders 67 — Çağıranı silmek yetmez; yeteneği sil. Aksi halde firewall bir "çağıran sayımı"na döner.**
Server action'ı silip `setDirectorEnabled`'ı repository'de bırakmak, bir sonraki çağıranın bulacağı
bir dikiş bırakırdı. Yetenek kaldırılınca iddia mekanik oluyor: "`src/` altında hiçbir dosya bu
tabloya INSERT/UPDATE/DELETE yapmıyor." Çağıran sayımı yalnızca bir sonraki dosya eklenene kadar
doğrudur; bu, kod tabanının kendisi hakkında doğrudur.

**Ders 68 — Kontrolü gizleme, yokluğunu söyle. Disabled buton yalan söyler.**
Gizlenmiş ya da pasif bir buton, "başkasında olan bir izin sende yok" der. Burada o izin kimsede
yok — yazma tamamen uygulamadan çıktı. Doğru olan, değişikliğin nerede yapıldığını yazan bir cümle.

**Ders 69 — Kaynak taraması yaparken yorumları ayıkla; kendi dokümantasyonun testini düşürür.**
Üç kez aynı sınıf hata: `.env` alt dizesi `process.env`'i yakaladı; `[^"']*` satır sonlarını da
eşleyip uzak tırnaklar arasını yuttu; ve "platform-admin yaratmaz" diyen kendi başlığım
platform-admin taramasına takıldı. Soru "hangi KOD yazabiliyor" ise `codeOf()` uygula, ve mekanizmayı
ara (import ifadesi, fs çağrısı), alt dizeyi değil.

**Ders 70 — ACTOR ≠ SOURCE. Bir güven kökü, işlemi yapan insanı tanımlamadan o işlemin sebebi olabilir.**
ACTOR: kimliği doğrulanmış Hebun principal'i — `actor_type = human` + gerçek `users.id`.
SOURCE: mutasyona sebep olan güven kökü / seremoni — `local-operator-ceremony`.
Deployment possession'ın SOURCE'u vardır, ACTOR'ı yoktur. Bu yüzden `updated_by` ve
`updated_by_type` birlikte NULL kalır. Bir audit şemasını işlemi kabul etsin diye aktör uydurma.

**Ders 71 — Aktör ID'si olmayan aktör tipi kısmi atıf değil, YANLIŞ atıftır.**
Hebun'un gerçek invariant'ı `(x_by_type IS NULL) = (x_by_id IS NULL)` — ikisi de dolu ya da ikisi de
boş. `auth_credentials`, `auth_identities`, `invitations`, `memberships`, `role_permissions` bunu
zaten CHECK ile zorluyor. `updated_by_type = 'human'` yazıp `updated_by = NULL` bırakmak bu kuralı
çiğner. "Eksik ama kabul edilebilir" diye okuma; şema kendi kuralını çoktan yazmış.

**Ders 72 — CHECK, veritabanının gerçekten gözlemleyebildiği bir doğruyu kodlamalı.**
"Yazma bir CLI'dan geldi" bir CHECK ile kanıtlanamaz — DB kimin bağlandığını görmez. CHECK yalnızca
satırdaki DEĞERLERİ kısıtlar. Bu yüzden `CHECK(updated_by_type='human')` yanlış araçtı: izin verdiği
taraf hakkında doğru olmayan bir şey iddia ediyor, üstelik tek yazma yolunu da reddederdi. Yetkiyi
yapısal olarak zorla (yazıcı `src/` altında yok), satır değeriyle değil.

**Ders 73 — Bir sonraki fazın talimatı da bir kayıttır; yanlışsa kod kadar zarar verir.**
R5.1 kapanışı "önce `updated_by_type` doldur, sonra kısıtla" diyordu. Doğrulanmamış bir plan,
dokümana yazıldığı anda doktrin gibi okunuyor. Gate A bunu çürüttü ve düzeltme yalnızca dokümanda
değil, aynı iddiayı tekrarlayan 5 dosyada yapıldı — bunlardan biri (`tests/r2e-flow/...`) beklenen
listede yoktu. Successor talimatını da record-integrity taramasına dahil et.

**Ders 74 — Kolon "hiçbir şey tarafından okunmuyorsa" yanlış iddia da üretmiyordur.**
`provider_connectivity_controls.updated_by` canonical'da bayat bir Globex owner'ı gösteriyor, ama
`getControl`'ün tek çağıranı sadece `directorEnabled` okuyor ve hiçbir UI onu render etmiyor. Yani
düzeltme aciliyeti yok. R2F.1'in tersi: yazılıp okunmayan kolon yetenek değildi; okunmayan kolon da
kimseye yalan söylemiyor. Aciliyeti tüketiciye bak diye ölç.

**Ders 75 — `version` bir geçiş sayacı değildir; predicate'i olmayan writer no-op'ları da sayar.**
Eski R2E writer'ın `onConflictDoUpdate`'inde `where` yoktu, yani her ÇAĞRIDA `version`'ı artırıyordu.
R5.1 seremonisi `where director_enabled is distinct from $2` taşıyor, yani artık yalnızca gerçek
geçişlerde artıyor. `version = 30`, "29 geçiş" değil "29 yazma" demek ve kolon iki rejimi ayırt
edilemez şekilde taşıyor. Sayaçtan tarih üretmeden önce writer'ın predicate'ine bak.

**Ders 76 — Bir read seam'in LİMİTİ onun anlamının parçasıdır; soruyu değiştirince limit de bozulur.**
`listFacts` 50'de kesiyor ve `(domain_key, fact_key)`'e göre sıralı. LİSTE için doğru — çağırana
"kesildi" deniyor. SAYIM için sessizce yanlış: sıralama domain'e göre olduğu için tek tek kayıt
kırpmıyor, alfabetik olarak sondaki KATEGORİLERİN TAMAMINI siliyor. Aynı satırlar, aynı predicate,
aynı tenant — değişen tek şey sorulan soru. Bir seam'i yeniden kullanmadan önce "doğru shape'i mi
dönüyor" değil, "limiti YENİ soru için ne demek" diye sor. `MAX_CHUNKS_PER_SOURCE=40` yüzünden iki
upload bu sınıra yetiyor.

**Ders 77 — Limiti yükseltmek değil, sınırsız ikinci bir STATEMENT yaz.**
`KNOWLEDGE_LISTING_LIMIT` başka davranışlara bağlı (chunker ona göre seçilmiş, Heby evidence cap'i
onu aynalıyor). Yükseltmek modelin context'ini sessizce genişletirdi. Doğru çözüm: kayıt başına değil
DOMAIN başına satır dönen `GROUP BY` — o zaman sınıra ihtiyaç kalmıyor. İkinci statement ikinci
otorite değildir; join'i (`activeNodeJoin`) paylaş ki tenant predicate'i tek ifade kalsın ve bir
clause farkıyla kayamasın.

**Ders 78 — Yanlış bir firewall, firewall'suzluktan kötüdür; kapsamı daralt ve NEDENİNİ yaz.**
R5.1 kalıbı "src/ altında hiçbir dosya bu tabloya yazmaz" burada YANLIŞ olurdu: ölü ama var olan
`supabase-postgres-adapter.ts` raw SQL ile `knowledge_nodes`'a yazıyor. Doğru olan dar iddiayı kur
(R6B modülleri yazmıyor) ve ölü yazıcının varlığını da TESTLE sabitle — böylece daraltma unutulmuş
bir kaza değil, kayıtlı bir karar olur; yazıcı silinirse test kırılır ve firewall meşru şekilde
genişleyebilir.

**Ders 79 — Bite-proof'un başarısız olmaması da bir sonuçtur; nedenini bul, testi zorlama.**
Join'deki node↔fact tenant clause'unu tek başına kaldırdım, test GEÇTİ. Sebep: iki tenant clause'undan
her biri tek başına o senaryoyu engelliyor — savunma derinliği tam olarak budur. Testi "yakalasın diye"
değiştirmek yerine, anlamlı bite'ın ikisini birden kaldırmak olduğunu kaydet. Redundant olan clause
zayıflık değil, tasarım.

**Ders 80 — SQL'e taşınan saf mantık YORUMLA değil, EŞDEĞERLİK TESTİYLE dürüst tutulur.**
`exclusionReasonFor` ve `deriveKnowledgeFreshness` mantığını `count(*) filter` içine kopyalamak
zorundaydım (her satırı çekmemek için). "Aynı sırayı takip ediyor" diyen bir yorum çürür. Bunun
yerine aynı seed'lenmiş satırlar üzerinde ikisini de çalıştırıp uyuştuklarını iddia eden bir test
yaz — iki taraftan biri değişince orada kırılır.

**Ders 81 — Taxonomy SINIFLANDIRIR, asla SİLMEZ.**
Serbest metin `domain_key` üzerinde kapalı bir kategori sözlüğü kurarken, eşleşmeyen her key
`uncategorized` altında görünmek zorunda. Aksi halde projection, veritabanında duran kayıtlar için
"eksik" der — kullanıcının yaptığı işi yok sayar. Ayrıca fold önce, lowercase sonra: `"İ".toLowerCase()`
JS'te `i`+combining dot üretir ve düz `i`'ye asla eşit olmaz.

**Ders 82 — En ucuz yeni yetenek: okuyucuların ZATEN saydığı bir state'in İLK YAZICISI olmak.**
`retired` KR3 eligibility'de terminal, R6B'de `withdrawn` — tanımlı, okunan, ama hiç yazılmayan bir
enum değeriydi. R6D sadece yazıcısını ekledi; Heby ve coverage tek satır değişmeden doğru tepki
verdi. Tasarımı kanıtlayan test, okuyucuların "retract" kelimesini içermesini YASAKLAYAN test.
Okuyucuya yeni state'i öğretmen gerekiyorsa, yanlış state'i seçmişsindir.

**Ders 83 — Zayıf otorite, güçlü otoritenin kararını yan kapıdan geri alamaz.**
Ratification Governance otoritesinin kararı; retraction ise K2 authoring band'ine bağlı. Ratified bir
kaydı authoring band'iyle servisten çekmek, kılık değiştirmiş bir Governance reversal olur — ve K4'ün
reversal runtime'ı yok, kasten. Doğru cevap: **tümünü reddet**, ratified olmayan kardeşleri de.
Kısmi retraction daha kötü: operatör "kaynak gitti" sanır, bir kısmı serviste kalır.

**Ders 84 — `includes()` import satırını yakalar; iddiayı FONKSİYON GÖVDESİNE daralt.**
Aynı dosyada iki yönde de ısırdı: `indexOf(transaction) < indexOf(audit)` import yüzünden hep false
(geçmesi imkânsız), `includes("resolveKnowledgeWriteAuthority")` import yüzünden hep true (kalması
imkânsız). İkincisini sadece **bite-proof** ortaya çıkardı — çağrıyı sildim, test yine geçti. Modül
geneli substring yerine `slice(indexOf("export async function ..."))` ile gövdeye in.

**Ders 85 — Yayınlanmış pin kırıldığında önce SORU'yu sor: iddia mı yanlış, ürün gerçeği mi değişti?**
K3'ün "sadece ratification writer bir node'u update eder" kuralı R6D ile kırıldı. Kuralı gevşetmek
yanlış olurdu; K3'ün gerçekten koruduğu şey **in-place İÇERİK düzenlemesi yok**. Çözüm: yeni yazıcıyı
allow-list'e ekle **ve** `.set({...})` kolonlarını K4'ünki gibi pinle. Sınırı test edilen invariant
yaşar; incelenmemiş allow-list'i olan çürür.

**Ders 86 — İçerik kimliği ≠ yükleme kimliği; hangisini sakladığını bil.**
`provenance.sourceDigest` normalize metnin sha256'sı. Hebun dosyayı saklamıyor (`documents` tüketicisiz,
byte'lar request ile bitiyor), yani "bu yükleme" diye bir kimlik YOK. Aynı byte'lar iki başlıkla
girilirse tek kaynak sayılır — bu dürüst okuma ve daha faydalısı. Kolaylık olsun diye ingestion
tablosu uydurma; var olan en dar kalıcı kimliği kullan ve ne olduğunu söyle.

**Ders 87 — Vekil ölçüm, karşı-örnek çıkana kadar çalışır; kanıt değildir.**
G1/G2/K2 "sink'e kim YAZIYOR" iddiasını `from "@/db/schema/audit-log"` importuyla ölçüyordu. R7.1'e
kadar her importer aynı zamanda writer'dı, yani belirsizlik görünmezdi. Sink'in ilk SALT-OKUR modülü
gelince üç YAZMA firewall'ı birden onu writer sandı. Doğru onarım gevşetmek değil **sıkılaştırmak**:
yazmayı mekanizmayla ölç (`.insert|update|delete(auditLog)`), erişilebilirlik census'unu ise **ayrı**
bir iddia olarak koru. İki ayrı garanti; biri diğerinin yerine geçmez.

**Ders 88 — `LIMIT` nerede ısırır: satırda mı, grupta mı? Fixture'ı doğru olana göre boyutlandır.**
Aggregate'te `LIMIT` **grup** sayısında ısırır, listede **satır** sayısında. 125 satır ama yalnızca 5
farklı `action` içeren fixture'da `.limit(100)` hiçbir şeyi kesmez ve bütün sayım assertion'ları geçer.
Onu reddeden structural `.limit(` yasağıydı, sayım testi değil. **Isırmayan bite en öğreticisidir** —
hangi testin işi yaptığını açıkça yaz; "fixture her ikisini de kapsıyor" demek tam da bu repoda
onarılan aşırı-iddia türüdür.

**Ders 89 — Tamlığın tek sinyali BAĞIMSIZ sayımdır.**
`totalRecordedActs`'i grouped satırlardan toplarsan ikisi inşaat gereği uyuşur ve kesilmeyi gösterecek
tek işaret silinir. Ayrı bir `count(*)` tut, grouped toplamla karşılaştır. R6B'nin kesik-liste kusuru
tam olarak böyle yakalanır (bounded listing'e çevirdiğimde 100'e karşı beklenen 125 verdi).

**Ders 90 — Firewall deseni yanlış pozitif veriyorsa, deseni değil KAPSAMI daralt.**
`/truncate/i` Tailwind'in `truncate` sınıfına çarpıyor. Deseni gevşetmek bir sonraki yazara "bu
kontrolü esnet" dersini verir; gerçek kontrol böyle çürür. Ham-SQL kontrollerini veritabanına
ulaşabilen server modülleriyle sınırla, `.tsx`'i ORM-fiili ve salt-okunur yüzey kontrollerine bırak —
ve bu kapsamı yorumda gerekçesiyle yaz.

**Ders 91 — Kaynak dosyada NUL byte: typecheck, lint, 406 test ve production build'in HEPSİNİ geçer.**
Bir React `key`'inin içine kaçan tek `\x00`, geçerli UTF-8 olduğu ve o key'e hiçbir assertion bakmadığı
için bütün kapılardan geçti. Yakalayan tek şey `git add`'in dosyayı **binary** olarak sınıflaması oldu
(`Bin 0 -> 9021 bytes`). Git'in diff'leyemediği bir kaynak dosya sonsuza dek gözden geçirilemez.
Ders: `git diff --cached --stat` çıktısında **`Bin`** görürsen dur — ve kontrolü teste bağla
(`bytes.indexOf(0) === -1` + UTF-8 round-trip). Ayrıca "sona sıralansın" diye U+FFFF gibi yüksek kod
noktalı sentinel string kullanma; açık `null` kontrolü hem okunur hem bu sınıf hatayı davet etmez.

## G3 — Hosted Infrastructure (2026-08-18)

- An unconfigured production is not a broken production — it is a truthfully-configured
  demo that nobody labelled. G2's mock gate permits fiction when auth resolves `disabled`,
  and a deployment with ZERO env vars resolves exactly that. The gate was correct; the
  deployment was the hazard. A gate keyed to configuration cannot protect an unconfigured
  deployment.
- Prove `HEBUN_AUTH_ENABLED=true` from runtime behaviour, never from a config readback:
  the redirect INVERTS (`/login -> /command` becomes `/command -> /login`).
- Own runtime region at the narrowest seam that already exists. `serverlessFunctionRegion`
  is a Vercel project setting; adding a `vercel.json` would have invented a second
  deployment-authority surface for something the project already owned.
- `sslmode=require` in pg 8.22.0 IS `verify-full` (the branch overrides no ssl option),
  and pg v9 will weaken it to `rejectUnauthorized=false`. Normalizing to `verify-full`
  is a no-op today and a pin against a scheduled library default change. Verify against
  the INSTALLED artifact, not the docs.
- A redirect alone cannot prove the database was reached — a refusal looks identical
  whether the DB answered or the code never asked. Measure it on the DB side:
  `pg_stat_database.xact_commit` delta (control 15s = 1 txn; 25 requests = 28 txns).
  A pooled endpoint hides `application_name` behind `pgbouncer`, so the counter works
  where `pg_stat_activity` cannot.
- A secret scan will trip on a closure document that NAMES the patterns it scanned for.
  The scan is doing its job; the verdict is manual — but strip real host fragments from
  prose anyway.
- `vercel link` may write a REPO-level link (`.vercel/repo.json` at repo root), not a
  project link in the app directory. Audit where it landed before assuming.

## G4 — Platform Operator Production Ceremony (2026-08-18)

- Reachability is not authorization. `HEBUN_CONTROL_PLANE_ALLOW_REMOTE=true` lives forever on the
  web runtime and answers "may this process reach a remote DB" — reusing it as the mutation
  signal would make any environment that can READ production able to PROVISION in it.
- A schema fingerprint cannot identify a deployment. Local canonical and hosted production carry
  the byte-identical 31-migration ledger (digest 212559d1…) because they are the same release.
  The binding is `pg_control_system().system_identifier` — cluster-scoped, not settable from a
  connection string. Proved stable across a real Neon compute restart.
- A refusal must never silently downgrade. A production signal that is set but malformed refuses;
  it does not fall back to local. An operator who mistyped must not get a different ceremony.
- `new URL()` reports bracketed IPv6 as `[::1]`, not `::1`. A membership test against
  ["127.0.0.1","localhost","::1"] therefore misses it — safe in the local-guard direction, a hole
  in the non-local direction.
- `COMMIT` on an aborted PostgreSQL transaction performs an implicit ROLLBACK. So replacing a
  catch's rollback with commit changes nothing: `begin` is the atomicity guarantee, the explicit
  rollback is connection hygiene. A bite-proof that survives can be a true result about the
  system rather than a weak test — check which before "fixing" the test.
- A firewall that forbids a table NAME can forbid the evidence. The preflight report legitimately
  counts audit_log rows to prove they stayed zero. Forbid the write VERBS everywhere; confine
  reads to a closed literal list and assert the list is the only mention.
- Assert a binding whole, not by mention. `includes("posture.source")` survived a mutation that
  prefixed `process.argv[5] ?? ` — the posture was still mentioned, and argv won.
- When a later gate moves a released guard, assert it where it now LIVES. Keeping the old
  call-site regex is satisfied by an unused import: the grep passes while the property rots.
- Don't commit production fingerprints to a public repo even when they are not credentials —
  they grant nothing, and publishing them gains nothing either.

## G5A — First Human Bootstrap Ceremony (2026-08-18)

- "Bootstrap cycle" was the wrong frame. `users` has ZERO outbound FKs, so identity is a ROOT of
  the dependency graph. The tenant-side cycle was already broken by R4A at the nullable
  `memberships.accepted_invitation_id`. The gap was a missing production SEAM, not a cycle.
- A writer whose header says "I do not decide whether this MAY happen — that is the caller's
  authority" is reusable by a new caller without moving ownership. Orchestrate it; never
  reimplement it. Assert "not a writer" by forbidding insert/values/on-conflict in the new files.
- Prose, refusal reasons and denials are made of the same words as the things they forbid. Four
  assertions in this phase failed on the ceremony's own honest text: the banner saying created_by
  stays NULL, the message saying it will not "reset a password", the phrase "ONE password
  credential", and the refusal reason "password-too-short". Strip string literals before checking
  that a VARIABLE reaches a sink; scope name-bans to the file that must not use the column.
- Scope ordering assertions to the FUNCTION BODY. A module-wide indexOf hits the import block —
  which made this one impossible to pass, the mirror of R4C.1 where it made one impossible to fail.
- Choose a lock level by conflict analysis, not caution. SHARE ROW EXCLUSIVE self-conflicts (two
  ceremonies serialize) and conflicts with ROW EXCLUSIVE (what INSERT takes), while leaving
  ACCESS SHARE readers unblocked. EXCLUSIVE also works and blocks SELECT FOR UPDATE for no gain.
- A unique index is not a one-shot guard. users_email_uq stops the same address twice and would
  admit a second, DIFFERENT first human. Count inside the transaction, after the lock.
- Prove a concurrency test is real by weakening the lock and watching it go red. Otherwise it may
  be passing because the two operations happened to serialize.
- An optional field can already encode a distinction the code ignores. The self-attribution fix
  needed no new parameter: `createdByType` existed, and `createdBy` simply wasn't following it.

## G5A.1 — Bootstrap Credential Recovery (2026-08-19)

- A window can be ONE predicate when foreign keys do the rest. `companies = 0` implies zero
  organizational state because 44 tables carry a NOT NULL FK to companies — roles, memberships,
  invitations, membership_authorizations, genesis_nominations, governance_sessions,
  decision_records, identity_enrollment_requests. Derive the implication from pg_constraint in a
  test so a future table that escapes it fails the build instead of widening the window silently.
- Derive a state transition from the schema, never choose it. A PARTIAL unique index on
  (auth_identity_id, credential_type) WHERE status='active' forbids inserting a replacement beside
  the old row and FORCES revoke-then-insert. Update-in-place would satisfy the index and destroy
  the record that a credential existed.
- Hash BEFORE you revoke. The derivation is the only step that can fail for a reason the database
  does not own, and a failure after the revoke would strand the human.
- A bite-proof that HANGS is not a verdict. Pointing the writer at `db` instead of `tx` while the
  outer transaction held SHARE ROW EXCLUSIVE made a second connection block on a lock held by a
  transaction waiting for it — a deadlock, not a failure. Bound every bite-proof with `timeout`
  and report a timeout as VOID, not as pass.
- A bite-proof that fails to APPLY looks exactly like one that failed to bite. Inline python -c
  quoting mangled a mutation and the suite passed for the ordinary reason. Write mutations as
  standalone files and verify each one applied before trusting its verdict.
- Make a safety check impossible to become a selector. `confirmEmail` is COMPARED against the
  human the database already resolved and never reaches a predicate; the resolution query carries
  no bind placeholder at all, so arbitrary targeting is unrepresentable rather than forbidden.
- More assertion-scoping traps, same family as G5A: a regex spanning a whole function matched a
  field in a DIFFERENT statement; a key-list regex missed a SHORTHAND property (no colon); "id ="
  flagged a JOIN condition; and a module-wide indexOf hit the import block for the third time.
  Scope to the statement, the block, or the function body — never the module.

## G5B — Tenant Zero production bootstrap (2026-08-19, tag `hebun-tenant-zero-production-bootstrap-complete`)

- **A one-way door decides the order of the whole phase.** Tenant Zero permanently closes G5A.1
  (`users=1 AND companies=0`), so the bootstrap credential had to be proved good BEFORE the tenant,
  not after. Find the irreversible step first and sequence everything else around it.
- **The cheapest proof of a credential is the real login, run at the moment its failure is still
  recoverable.** Signing in before the tenant existed reached `onboarding-required` — a page only
  reachable after scrypt verification — so one act proved the password AND the honest tenant-less
  state, and cost one TTL-bounded session row.
- **Derive a guard's verdict by calling the guard, never by re-implementing its predicate.**
  `resolveRecoveryEligibility` is read-only, so both sides of the window were measured with the
  released code and zero rotation.
- **ACCEPTED IS NOT AUTHORITY.** Accepted genesis is an unspent entitlement: `consumed_at` NULL,
  `decision_records` 0. Governance needs a separate act that SPENDS it. Read the consuming module
  before naming what a status grants.
- **One row can record two different roots.** `genesis_nominations` carries `created_by` NULL
  (a terminal nominated) and `updated_by = human` (a person accepted). Possession is a SOURCE,
  the human is an ACTOR, and the columns say so without a new field.
- **A vocabulary test cannot catch a sentence defect.** `PRE_TENANT_RECEIPT.grants` and `.diesWhen`
  were both correct and both asserted; the only call site interpolated them without their verbs and
  served "This sign-in step nothing" to the first human in production. Assert the COMPOSITION at the
  seam where fragments become prose, not just the fragments.
- **Report the boundary a proof actually makes.** Tenant provisioning refuses a duplicate slug —
  that is slug uniqueness, NOT one-shot. A different slug would create a second tenant. Say so
  rather than let the refusal imply a guarantee it does not give.
- **Interactive TTY guards are not an obstacle to route around.** Three ceremonies refuse non-TTY
  and one takes a hidden password; the agent orchestrates and verifies, the Director types. Every
  irreversible production write stayed in a human's hands.

## G6A — Governance authority established (2026-08-19, tag `hebun-governance-authority-established-complete`)

- **A claim enforced only by a missing import is enforced by inspection, not by mechanism.** A real
  `roles` insert inside the genesis transaction passed EVERY released assertion, while the surface
  promised "does not change your application role". Count the thing the promise is about, on both
  sides of the act.
- **A bite-proof that does not bite is a result — but first check it is not your own mutation that
  is wrong.** Two non-bites here were my design: the Heby firewall asserts Heby→Governance and I
  mutated Governance→Heby; and an inert import proves nothing about a write. Corrected, both bit.
- **Defence in depth makes single-guard removal a non-verdict.** Dropping `isNull(consumedAt)` left
  the earlier application refusal; dropping the already-bootstrapped read left the unique index,
  which maps to the SAME refusal. Report which layer caught it instead of calling the proof failed.
- **A probe that fails identically on both sides tests nothing.** Moving the audit write from `tx`
  to `db` did not bite because the test induces the failure with a CHECK that rejects either
  connection. Thin coverage on a correct implementation — do not "fix" the code to make a test bite.
- **AUTHORITY MUST COME FROM THE AUTHORITY MODEL, provably.** `resolveGovernanceAuthority` reads
  `decision_records.bootstrap` and consults neither `roles.type`, `authority_rank`,
  `memberships.authority_scope`, `permissions` nor `role_permissions`. Owner is not Governance
  before or after — proved by running the released resolver against production, not by reading it.
- **The genesis names no authority source, and that is the point.** `authority_source_actor_*` NULL
  is the constitution stating there was no prior authority to decide under. Every later decision
  names one.
- **A permanent record cannot be tidied.** A dropped letter in the constitutional justification is
  unrepairable — no update/delete/supersede writer exists and the bootstrap decision is
  non-revocable. Record the fact; raw SQL would be manufacturing history, which is worse.
- **A transient `useState` claim is not a stale live claim.** "No Governance decision exists yet."
  renders only in the post-acceptance transition, where it is true. Check the render condition
  before repairing prose.

## G6B — Governance runtime re-proof (2026-08-19, tag `hebun-governance-runtime-reproof-complete`)

- **Audit the capability against production BEFORE designing the proof.** Three of five Governance
  capabilities were unexercisable: the ordinary-decision subject vocabulary is closed at exactly one
  type (`knowledge_node`) with zero rows, and membership authorization needs a real second human.
  Reporting them unavailable is the result — seeding a subject would have manufactured the truth the
  act was meant to test.
- **A refusal chain can be the architecture working, not a gap.** I1 refused every real tenant
  because only `member` may be onboarded into and no tenant had one; I1.1 exists precisely to close
  that. Read the phase that follows before calling a refusal a defect.
- **Two rows can prove what prose only asserts.** Genesis carries `authority_source_actor_*` NULL
  (no prior authority existed); the next decision names the human. The constitutional chain is
  visible in production columns, not just in a doc.
- **A mutation that changes no behaviour is not a passing test — it is no test.** `eq(...) || true`
  evaluates to the same truthy SQL object; widening a TypeScript type is a no-op at runtime. Six
  attempts produced no verdict; correct them instead of reporting them.
- **Some attacks are UNREPRESENTABLE and cannot be bite-proved.** `writeGovernanceDecisionWithin`
  has no actor parameter, so "client supplies the actor" would require inventing one — which IS the
  security property. Report it as unrepresentable, never as an untested boundary.
- **Prove a one-shot by reading the invariant, not by attempting it.** `roles_one_member_per_tenant_uq`
  and `decision_records_one_bootstrap_per_tenant_uq` were read out of the production database —
  stronger than a replay, and it writes nothing.
- **A closure record's counts are true at commit time, not forever.** Check whether a "stale" claim
  was false when written before rewriting history; and check a render condition before repairing
  prose (a transient `useState` claim is not a live one).

## G6C — Heby Governance grounding (2026-08-19, tag `hebun-heby-governance-grounding-complete`)

- **A module that mixes reads and writes is not a read boundary.** `bootstrap-authority.server.ts`
  exported `readGovernanceAuthority` beside `establishGovernanceAuthority`, so importing it "for the
  read" handed out a reference into the act that creates a government. Split the reads out; do not
  ask a reviewer to check which symbol was taken.
- **Heby grounds on owner-controlled read-only projections, never on writer-bearing authority
  modules.** The projection lives on Governance's side of the boundary and Heby consumes it. Putting
  it under `heby-governance/` was the first draft and five released firewalls rejected it, correctly.
- **Path and module-name firewalls are too weak to be the primary mechanism, and too strong to be
  harmless.** Ban the writer SYMBOLS against comment-stripped code, and prove the real property by
  walking the import graph from the entry points. Keep the path heuristic as an additive second
  layer, never the only one.
- **The path heuristic had been failing since R3W, in production, undetected.**
  `work-artifact-evidence.server.ts` imported `bootstrap-authority.server.ts` for a database handle,
  so Heby's answer graph contained a Governance writer while every firewall passed — the offending
  file's path says `work-artifacts`. Measured: writer-bearing modules on the answer graph **1 → 0**.
- **Governance remains the authority owner; Heby is an evidence-grounded consumer and nothing more.**
  The projection owns no fact, holds no table, defines no authority, and reinterprets none of the
  three owners it reads.
- **AUTHORITATIVE provenance must survive source → evidence → response without being flattened.**
  The response builder stated "derived and non-authoritative" unconditionally, which was true of every
  source connected before this one and would have silently downgraded `decision_records`. Report the
  mix per answer instead of rounding to one class.
- **A grounding connection is not model synthesis.** Production carries no `HEBUN_MODEL_*` variable
  and the provider stays disarmed, so the honest classification is
  **B — GROUNDING CONNECTED / MODEL SYNTHESIS UNAVAILABLE**, not "Heby answers from Governance".
- **Tenant-scoped is not authority-gated.** Only `readRoleBaselineState` gates on
  `resolveGovernanceAuthority`; the roster and genesis reads are scoped to the tenant but visible to
  any member. That is the released G2/G3 read contract — record it as inherited and leave it to its
  own gate rather than tightening it inside a grounding phase.

## G6D — Heby durable grounding (2026-08-19, tag `hebun-heby-durable-grounding-complete`)

- **Authoritative grounding is not finished until its structured provenance survives a reload.**
  G6C's answer prose was durable, but the record identities and the authoritative standing were not.
  An authoritative claim the reader cannot re-examine later is weaker than a derived one they can.
- **Evidence is not a second source of organizational truth.** Governance keeps `decision_records`;
  the Heby row says only "answer X cited record Y, and Y was authoritative when it did". Identity is
  REFERENCED — no foreign key, so answer history survives whatever the authority does next — and
  only what the reader actually saw is snapshotted.
- **Replay must never substitute today's state for the answer's.** Proved by mechanism rather than
  asserted: read Governance at one authority holder, persist, delegate a second, confirm the live
  read now says two, then assert the reload still says one.
- **A new generic path must not absorb an existing owner.** Knowledge evidence stays KR5's, enforced
  twice — the write projection skips it, and a CHECK constraint refuses it in the table. Two records
  of one citation would eventually disagree, and then neither could be trusted.
- **Tenant isolation belongs in the schema, not only in the query.** The composite
  `(message_id, tenant_id)` foreign key makes a cross-tenant citation unconstructible even by hand;
  the application predicate stays anyway, because a read relying on the constraint alone is one
  schema change away from leaking.
- **AUTHORITATIVE and DERIVED must survive persistence AND replay.** The standing is stored per row
  and replayed per source class, so a mixed answer replays as the mixture it was rather than rounded
  to whichever half is more flattering.
- **A source-class description is runtime truth, not copy.** Once a source is connected, a stale
  "not connected" sentence is an architectural correctness defect: it reaches the answer body, and
  the answer body is what gets stored. Repair it the way K1 already did when Knowledge gained a
  server seam — describe the seam, do not deny the connection.
- **Making grounding durable authorizes nothing else.** No provider, credential, model
  configuration, execution or Computer Use came with it, and the arming writer still refuses
  production by construction.
- **A migration ledger identifies a RELEASE, never a deployment.** Canonical and production moved
  31 → 32 with the same migration sha256 and finished with identical schema signatures — which is
  exactly why the ledger cannot be used to tell two deployments apart.
- **Do not absorb someone else's flaky test into your phase.** K2's concurrency classifier maps a
  deadlock/serialization loser to `unavailable` instead of `duplicate`. Reproducing it at the
  pre-phase commit (7/12) versus on the new tree (4/12) is what turns "my change broke it" into a
  separately owned limitation — and reporting the suite as green would have hidden both.

## G7 — Heby spatial canvas + Evidence Surface (pre-release, 420/420)
- Released firewall tests that pin a file BY PATH are an asset: replacing a component in place keeps them guarding the new code. Renaming the file would have meant editing 9 released proofs — the moment a proof stops proving anything.
- A component that spends every colour through CSS variables can be fully re-skinned with zero source change. The Heby presence field changed emerald→amber without touching its file, so its geometry/determinism/truthfulness proofs still guard the new look.
- Check WHERE a token is actually declared before "scoping" it. Heby's emerald was already inside `.heby-surface`; the product palette is blue in `src/styles/tokens.css`. The scoping work was already done.
- Live/stored parity is best made structural, not tested-for: `toResponseSourceEvidence = fromStoredSourceEvidence(toStoredSourceEvidence(x))`. Two views cannot drift when they are one composition.
- A durable field can be dropped by a TYPE DECLARATION, not by missing data. G6D's rows reached the browser and died at `ThreadMessage` — three declarations, no server change, no schema.
- "Reveal on hover" must never be a mounting condition. Keep the control mounted and tabbable; make hover a presentation state, and force it forward on draft/busy/voice/unavailable.
- A rail that renders activity needs a projection with NO branch that can emit an item without a row. Bite-proof it by inserting the mock row from the design reference.
- Bound a flake claim with numbers on BOTH sides: 7/12 fail at baseline vs 4/12 with the change proved K2 pre-existing, even though K2 imports files I changed.
- Verify UI on the REAL authenticated route, not an isolated component render. Three sizing bugs (chips scrolled out, framing line cropped, presence overflowing) were invisible in a harness because the shell bar + canvas header + composer dock take ~270px the harness never sees.
- Size a hero element as a fraction of the height that EXISTS (`min(30rem,32dvh)`), not off a width breakpoint. A breakpoint is a guess about a budget that varies with surrounding chrome; two width-based attempts both cropped the surface.
- When a released test pins COPY rather than an invariant, changing the copy is legitimate — but restate the invariant in the assertion and comment why. Three suites pinned "How can I help?"; the real invariant was "hero carries an invitation, absent once a conversation exists, never in the panel".
- Claude browser pane can die with `Render frame was disposed` and no recovery; chrome-devtools MCP drives a real Chrome and screenshots correctly. Never enter a password — have the Director sign in, then take over the session.

## G7.1 — Focused Heby Mode + reference-locked field (released, 421/421)
- A preference can be lost by NOT BEING APPLIED. Unmounting the control that writes a stored preference also unmounts the effect that applies it: the stored value stayed correct while the product contradicted it. Hide such a control, never unmount it.
- The build pipeline silently DROPS a custom property whose value is a `min()` of mixed absolute and container units. The presence fell back to its `lg` step in the real product while every test stayed green. Same expression works fine inside a utility class — so duplicate the literal and pin the copies to each other with a test.
- Decorative ink IS scrollable overflow. A glow bleeding past its box added 42–115px of phantom scroll. Clipping it draws a visible rectangle (a clip box on a glow is a box); reserving it costs layout — and the reserve must SCALE with the thing that bleeds (measured 0.177 of the presence, twice).
- A two-layer intersected mask rendered as a hard-edged bright rectangle in the real product. One radial ellipse fades on every side and cannot come apart. Prefer one mask over composited ones.
- A decorative band anchored to a container stops dead at that container's edges and reads as a panel drawn on the canvas. Dissolve it before the edges, or anchor it to the frame.
- Make the mode's attribute unreadable to navigation. "No navigation is unmounted" becomes structural once no navigation component may read the mode — a navigation that can see it can `return null` for it, and the way back vanishes with the thing it restores.
- Scope a CSS-rule assertion to the SELECTOR, not the rule body. An exception written against the selector but matched against the body can never fire — the third time this repository has been bitten by a window-scoped assertion.
- Never glob a directory from a Bash call whose own output file lives in it: the loop feeds itself. Same family as `pgrep -f` matching its own wrapper shell.
- `until grep -q <pattern> build.log` on a pattern the tool never prints polls forever. Bound every wait by what the command actually emits, or just run it in the foreground.
- When the Director reverses an earlier strengthening (adaptive rail default → always open), invert the test and SAY SO in it. A silent revert reads later as a regression nobody noticed.

## Stage 0 foundations + canonical Knowledge workspace (released, 422/422)
- A token can be DECLARED and never DEFINED, and nothing fails. `--font-sans: var(--font-jakarta, …)` shipped for 25 UI phases with `--font-jakarta` defined nowhere; the product rendered in the system font while its own token named the brand face. Grep for the definition, not the reference.
- Do not fix a shared primitive that is behaving correctly. The `/finance` collapse was measured — a `shrink-0` badge at 158.3px in a 197px row starving a title to 11.9px of the 93px it needed — and Badge was right both times: a truncated badge is worse than a truncated title. The defect was COMPOSITION, so the rule went into the grammar (a chip never shares a heading's row), not into the 253-consumer primitive.
- `* { min-width: 0 }` in a base layer turns every unshrinkable sibling into a starved one. It also collapsed a `size-10` icon to 2.8px. A global reset earns a global blast radius.
- Extend before duplicating has an exception: when extending would change what RELEASED consumers render. `EmptyState` could not carry a tone without altering six shipped surfaces, so the new primitive supersedes it and `EmptyState` was left untouched — stated in the file, not silently.
- A visual state vocabulary must be keyed to runtime states that already exist, never a renaming of them. 21 distinct state words were already in `src/features`, and three of their labels are verbatim-pinned by a released suite. Presentation maps; it does not rename.
- Absence is the product's most common state, so an empty block may not reserve more room than the thing it stands in for. `min-h-40` plus a stacked mark-and-word is how the way in ends up below the fold on a workspace whose ordinary condition is "nothing yet".
- Make the honest question a REQUIRED prop. `WorkspaceSection.provenance` is non-optional, so a future section cannot be added without answering where its data came from.
- When a released assertion pins a POSITION, ask whether the position was the invariant or its expression. R6B's "coverage before records" was an expression; the invariant was "present, control-free, orienting before the governed acts". Amend to the invariant and add what the old assertion could not say — then bite-proof the amendment.
- A heading fix can be a defect you introduced. Adding a `PageHeader` to a page whose old component already rendered an `<h1>` produced two `<h1>`s reading the same word; only the authenticated product showed it.
- `python3` heredocs can emit a stray NUL byte into a written file, and git then reports the file as binary in `--stat` with no other symptom. Check `file` / byte-count on generated source, and note two files at HEAD already carry NULs.
- Report a suite result with numbers on both sides before calling a failure yours. K2's concurrency classifier failed 3/6 at baseline HEAD and 2/6 on this tree — same flake, not worsened, and a clean 422/422 run exists.
- Never chain a full multi-hundred-file suite onto other commands in one call. One command, one purpose; the suite gets its own invocation or the whole call is lost with no log.

## VI-1 — Visual Integrity Foundation (released, 423/423, tag `hebun-vi1-visual-integrity-foundation`)
- **A return type can be the defect.** `resolveActiveWorkspace(): WorkspaceId` cannot express "none of the seven", so its only possible answer for `/heby` was a workspace — and it answered `Command`, in the topbar and as `aria-current`. The fix was a second resolver that may return `null`, not a change to the first. When a function is forced to lie, look at what its type forbids it from saying.
- **Separate "where am I" from "which way out do I offer".** The same `?? "command"` is a lie as an identity and correct as a navigation default. The mobile drawer now asks both questions on purpose: the active mark is honest, the opening list keeps the fallback — an empty drawer on an ambient surface removes the way out.
- **Test the special case FIRST and by its own constant.** Heby is matched before any workspace prefix, so its ambient standing is structural rather than a side effect of matching nothing. Adding `/heby` to a `match` list later cannot silently reclassify it.
- **`flex-basis: 0` deletes a wrap trigger.** `flex-1` on a title group means the line always "fits", so the row never breaks and the action starves the title exactly as before — the released defect in a different disguise. `shrink grow basis-40` gives the browser a reason to break the line.
- **`shrink-0` on a WRAPPER is what escapes a viewport, not the child.** A 415px pill sat in a 390px viewport because the wrapper claimed max-content and so its child was never asked to shrink. One word, in nine copies.
- **A min-width floor must be able to yield: `min-w-[min(10rem,100%)]`.** A bare `min-w-40` wins over `max-width` in CSS and overflows any container narrower than 160px.
- **Six of nine files were byte-identical — measure duplication with a hash before designing the fix.** `md5` over the extracted header block found the real shape of the problem in one command, and made "one grammar, nine one-line call sites" obviously right over ten local fixes.
- **Unify geometry without unifying typography, and prove it.** A `typeScale` prop preserved all nine surfaces' sizes 1:1, verified by counting the removed size literals (`8 × text-[0.6rem]`, `8 × text-[0.8rem]`, `1 × text-label`, `1 × text-meta`). Folding a sweep in would have made a geometry fix indistinguishable from a typography change.
- **`truncate` is not "yielding" — it is deleting.** The chip's own header comment had claimed since Stage 0 that it "is allowed to wrap"; the implementation truncated. Read what a file says about itself before assuming its behaviour is intentional.
- **Hover is not a disclosure on a touch device.** `title` carried the KIND's meaning and the `sr-only` sentence carried the same; nothing carried the instance DETAIL. Truncated, it was unrecoverable by any means on mobile. Ask which mechanism carries which fact, per fact.
- **A passing bite-proof suite is not a proven one — neuter every guard and re-run.** Sixteen mutations all bit, yet five individual assertions turned out vacuous: each was caught only by a sibling assertion inside the same wholesale mutation. Surgical single-property mutations are what make a named guard load-bearing.
- **Some assertions cannot be isolated, and that is a property of the claim.** Any mutation equalising the authoritative and derived class strings also breaks a border-style assertion. Record it as defence in depth; do not contrive a mutation that isolates nothing.
- **A "not actually a defect" result is worth as much as a defect.** 42 elements outside the viewport on `/finance` were an `inert`, `opacity-0`, `pointer-events-none` closed drawer, and 802 on `/agents` were inside `.ui-table-wrap`. Filter by containing scroll/clip ancestor before counting overflow, or the audit manufactures work.
- **Measure many routes in one page by driving iframes.** One `evaluate_script` sized to 1440×900 or 390×844 measures a dozen routes with correct media queries and viewport units — no per-route navigation, no lost context. Exclude `sr-only` (1px×1px) or every page reports phantom clipping.
- **Naming the sibling you did NOT fix is part of the release.** `command-region.tsx` still holds an unfixed instance of the same starvation class in a different exported component; migrating the file's header would otherwise read as "this file is clean".
- **A true sentence can outgrow its slot.** Giving Heby an honest tagline made the shell's fixed 208px title column clip harder than before. Fixing a truth defect can strengthen the case for the next phase rather than close it.

## VI-2 — Shell readability + label geometry (released, 424/424, tag `hebun-vi2-shell-readability`)
- **A declared design token can emit NO CSS AT ALL, and every source-level test still passes.** `@theme inline { --text-label: var(--fs-label) }` cannot resolve when `--fs-label` lives in an imported plain stylesheet, so Tailwind emits no `.text-label` rule and the element falls back to 16px. All five Stage 0 scale utilities are inert, in 165 live elements of the canonical workspace. Stage 0 fixed `--font-jakarta` for exactly this reason and then created the same defect one level up. **Probe the RENDERED size, never the class string.**
- **`cn()` silently drops an unknown font-size utility.** tailwind-merge does not know `text-label` is a size, classifies it as a colour, and a later `text-*` colour wins. The class never even reached the DOM. A custom scale must be verified in the rendered class list, not the source.
- **Ask whether the thing is a DUPLICATE before making room for it.** The truncated topbar tagline was the same sentence the Level-2 column already rendered in full, wrapped, 208px to the left. The fix was deletion, not width — no token, no breakpoint, no height risk.
- **Widening is a measurable option, not a design opinion.** Topbar child rects gave 503px of slack at 1920, 23px at 1440, 12px at 1024 — so growing the slot would have repaired only the width that was least broken. Measure the gap between siblings before proposing a bigger box.
- **Wrapping can cost literally nothing.** `text-sm` at `leading-5` is 20px a line and the row already reserved `min-h-10` = 40px, so two lines fit exactly and the item height was 40px before and after. Check the reserved height before assuming wrap means growth.
- **Reject a fix that clears the worst case by 0.6px.** Tightening padding gave 164px against a 163.4px label while degrading all thirty items to rescue two. Margin, not just sign, decides whether an arithmetic fix is real.
- **Count the whole population before calling something a class of defect.** Only 2 of 30 Level-2 labels overflowed and only 5 of 7 taglines were cut; the third-widest label fits by 1.5px. Font-metric measurement of every canonical string is cheap and reframes the fix.
- **Text metrics can be measured without authentication.** A hidden span in the running app with the real font gives exact widths for every canonical label — enough to settle a width-token gate while the session is expired.
- **A duplicated CSS declaration defeats an unscoped assertion.** `--secondary-w: 0px` and `@media (min-width: 1024px)` each appear twice in `globals.css`; the guard could not tell which it was reading and a regression in one was invisible. Scope to the block, or assert the COUNT.
- **A window-scoped assertion fails a fourth way: the mutation lands before the window.** Slicing from inside a class list meant a `hidden` added ahead of it was never seen. Anchor on the whole opening tag, not a substring of its attributes.
- **`assert.match(file, /symbol/)` is satisfied by the import line.** Strip imports and assert the CALL, or a component that imports a resolver and never uses it passes.
- **Audit every guard, not a sample.** Neutering all 56 assertions found 12 load-bearing; fourteen surgical single-property mutations raised it to 23. Classify what remains — harness rails, structurally un-mutatable (an imported frozen module cannot be reached by a text mutation), sibling-covered, and assertions about the recorded measurements — rather than inventing mutations that isolate nothing.
- **Finish an identity fix by enumerating every site that renders the name.** VI-1 fixed three of five; the Level-2 column header and the tablet trigger still said "Command" on `/heby`, the trigger unconditionally at 768px because focused mode is desktop-only. Grep for the render, not for the resolver.
- **Two facts, stated as two facts.** An ambient surface needs a way out, so the column names the surface AND names whose sections it lists — the list is not wrong, it just is not the identity.
- **Bound a flake claim on both sides even when the import graph already exonerates you.** K2 failed 3/6 on this tree and 2/6 at baseline with the change stashed, and K2 imports nothing VI-2 touched. Two independent arguments cost one stash.

## Typography contract — proven, and `cn()` repaired (released, 425/425, tag `hebun-typography-contract-proven`)
- **CORRECTION to VI-2 above: the five Stage 0 utilities were never inert.** `@theme inline` resolves fine across an imported plain stylesheet; the production chunk carries `.text-label{font-size:var(--fs-label);…}` and all four siblings, and the browser renders 28/18/16/13/12px. VI-2 measured the DEV chunk, which carries none of the five, and generalised a dev-only divergence into a product defect — then wrote a blocking instruction to "activate the scale" that would have restyled a scale that already worked.
- **"Rendered, not the class string" is right and still not enough — say WHICH BUILD you rendered.** The dev server is not the product. Probe the production build served by `next start` before declaring a stylesheet defect, and grep both chunks in the same breath so the divergence is visible instead of inferred.
- **A class can mean two different things depending on whether it passed through `cn()`.** tailwind-merge builds its groups from Tailwind's DEFAULT scale, so a custom `text-*` step lands in the text-COLOUR group and every merge of a semantic size with a colour deletes one of the two — WHICH one decided purely by authoring order. 76 plain usages were correct and 4 merged ones were broken. When two spellings of one class disagree, the bug is in the merge, never in the call sites.
- **Fix it where the decision is made.** Registering the five in the `font-size` class group is one line in one file, no call site, no token, no stylesheet — and it is the only place that CAN be right, because a call-site fix would have to be repeated forever.
- **Registering a custom scale must keep it behaving like a scale.** Put the steps in a real-but-wrong group (`leading`) and `cn("text-meta","text-label")` stops conflicting and stacks two sizes; the winner then becomes a stylesheet-order accident. Assert that two sizes still conflict, not merely that size and colour coexist.
- **A caching compiler makes every bite-proof lie in the safe direction.** Tailwind's postcss plugin caches by input path: with a fixed `from`, mutated stylesheets returned the BASELINE css, so each proof reported "did not bite" while its guard was fine. Give every compile a unique `from`, or "it did not bite" means nothing.
- **An `async` check with nothing to `await` throws into the void.** Its rejections became unhandled promises the bite harness never observed. If a check has no await, make it synchronous.
- **Reproduce the released defect inside the bite-proof, not an imitation of it.** Importing the unconfigured `twMerge` and asserting `merge("text-meta","text-fg-secondary") === "text-fg-secondary"` proves the mutation reproduces what shipped, so the guard is shown catching the real thing.
- **Recount a number before you inherit it.** "75 plain / 5 merged" did not survive a comment-stripped walk of `src`; the truth is 80 usages in 21 files, 76 plain and 4 merged. A figure copied from a diagnosis you have just proved wrong deserves its own measurement.
- **A full-suite red can be the disk, not the code.** 38 postgres suites failed at once with `53100 No space left on device` from `createDatabase`. Check `df` before reading a stack trace: an environment at 100% fails in the shape of a broad regression.

## CMD-0 — Seeded strategic goals contained (released, 426/426, tag `hebun-cmd0-seeded-goals-contained`)
- **A path-name firewall protects only the paths you already thought of.** The mock ban listed `features/director/mock` and `features/intelligence/mock`; the seed reaching a real tenant lived in `registries/records.ts`. Replace the name list with an OUTCOME the surface must produce — "while a real tenant is reachable this surface presents no goal at all" names no file, so a rename or an intermediate module is contained by construction.
- **A boolean the defect can satisfy is not a guard.** `connected: goals.length > 0` was *satisfied* by the four seeded rows, so the released assertion `connected === goals.length > 0` passed while the lie shipped. Ask what value the defect produces before trusting the assertion that reads it.
- **Withhold, do not relabel.** Marking fabricated rows "Seeded" and showing them anyway still tells the Director their organization holds those goals. G2's precedent — withhold the whole snapshot rather than partially trust it — is the rule, and labelling is the weaker half of it.
- **Prefer consulting an authority that already exists over inventing a signal.** The gate that answers "can a real tenant see this?" already shipped and already withheld the Director dashboard for this exact reason; the repair was one call. No new env var, no allowlist, no second opinion about who is looking.
- **Do not let a repair award an authority by widening an enum.** `GoalProvenance` has no `"authoritative"` member on purpose: if a durable store is ever wired the value reads `unverified`, so establishing a goal authority stays a separate gate instead of becoming a string edit.
- **An injection proves nothing until you prove it is observable.** The rename/intermediate proofs assert the injected row reaches the DEMO surface before asserting it is contained under a closed gate — otherwise the containment assertion is only proving that a stale projection cache is empty.
- **A text mutation cannot be re-imported inside one process, so mutate the real source and re-run.** Ten production-source mutations, each verified applied and each restored byte-identical by `shasum -c`, are the real audit; neutering assertions in-file left 30 of 32 "green" purely because the bite-proof re-checks the same property from another section.
- **`seed()` forcing `lifecycleStatus: "active"` resurrects retired records.** An archived goal was listed as current because the seeder overrode the field the projection filters on. Check what the seeder overwrites before trusting a lifecycle filter.
- **Cookies are scoped by host name, not port.** An authenticated session created on `localhost:3001` verifies a production build served at `localhost:3120`, but not at `127.0.0.1:3120` — which is how a real authenticated production check became possible without minting a credential.
- **A running `next dev` rewrites `next-env.d.ts` under your build.** It flips the reference between `.next/types` and `.next/dev/types` and shows up as an unrelated tracked change; restore it before staging or the release diff is not the reviewed one.
- **Measuring a withheld surface in the demo shell understates it.** Authenticated, `/command` went from 30 to 49 sub-floor elements and from 5 to 8 of 8 clipped labels — "Unavailable" is a wider status word than "Healthy", so the `shrink-0` side takes more and every truncated label loses.

## APP-0 — /approvals stops denying the decision act it offers (released, 427/427, tag `hebun-app0-approvals-truth-consistent`)
- **A phase that connects a capability must re-read every OTHER region's copy about that capability.** R3A wrote "every OTHER region is unchanged" meaning SOURCES — briefing, evidence, recommendation, consequence, history — and it was right about all five. It silently omitted the decision ACT, because R3A *was* the act, so a region three slots below went on saying "no approve, reject, or authorize action is offered here" while the buttons rendered above it.
- **The stalest claims are the ones with no inputs.** This was not a stale literal or a stale model field — it was hard-coded JSX in a component taking no arguments. Nothing could ever invalidate it, which is exactly why nothing did. Grep for prose that asserts connectivity, not just for booleans.
- **Delete a section that owns nothing; do not reword it.** Every condition the copy named as missing was met by the connected region on the same page. Rewording would have produced a second decision surface describing the first.
- **A stale sentence can be false in BOTH directions on one screen.** "Decision Act: not connected" was false because the act shipped; "Decision History: no decision record is connected" was false because deciding writes records. The truthful distinction is finer than either: the records exist, the chronological READ over them does not.
- **Do not ban a substring on a surface whose honest prose contains it.** `/approvals` is *supposed* to say "not connected" about evidence, recommendations and briefings. So the guard renders the regions, strips tags, and asserts the visible sentence — a property of what a reader sees, not of what the tree contains.
- **A count badge is the cheap place to prove empty ≠ unavailable.** `connected ? "N pending" : "Not connected"` gives three renderings from one expression, and asserting the connected and unavailable markup are `notEqual` catches a collapse that reading either one alone would miss.
- **`0 buttons` is a mutation proof.** On an empty queue no affordance renders, so "no approve/reject/revoke/consume was executed" is provable from the DOM plus unchanged row counts — no need to trust that nobody clicked.
- **Scope assertions to the FUNCTION BODY, again.** "The reader resolves no authority" over a whole module would have matched an import; the decide-writer's Governance check had to be asserted inside `approveActionRequest`'s own slice.
- **Session cookies do not survive a browser restart, and a valid session in the database proves nothing about the browser you drive.** `last_verified_at` moving plus a new `user_session_contexts` row proved the human signed in; only the absence of a `/login` redirect proved *my* automation browser could see it. Check both, and ask them to sign in **in the window you control**.

## APP-1 — Decisions surface stale-claim sweep (released, 428/428, tag `hebun-app1-decisions-truth-consistent`)
- **A component that performs no read may not report a connection state.** The state strip's "No source connected" was static copy in a component with no props; removing it beat inverting it, because any claim it made would be a second, unverifiable source of truth about the queue — which is exactly how it went stale in the first place. The region that performs the read is the region that reports it.
- **Narrow a claim when the region really is about a different class; delete it when it is not.** "No decision-request source is connected" was false for consequential action requests and true for prepared review/approval material. Naming both is honest; denying both was not; asserting both are connected would have been worse.
- **Dead state still lies.** `decisionRecordingConnected: false` and `pendingDecisions: []` had ZERO consumers and never reached the DOM — invisible, and still a hard-coded denial of a connected seam sitting in the model a future phase would reach for. Count consumers before you decide whether a stale field matters, and say plainly when the answer is "it was never visible".
- **Ban the SHAPE, not the name.** A guard on `decisionRecordingConnected` alone is defeated by `queueConnected: false`. Asserting `readonly \w*[Cc]onnected\w*: (true|false)` catches the class, and the bite-proof that smuggles the flag back under a new name is the one worth writing.
- **Pin the reader set, not the caller.** "Exactly three files reference this seam — two routes and the module that defines them" is a property that survives refactors and catches a duplicate queue; a caller census by name rots.
- **A bite-proof appended as a COMMENT proves nothing when the guard strips comments.** Mine reported "did not bite" while the guard was working perfectly. A second reader is a second *import*, not a second mention — mutate code, not prose.
- **An assertion that reads `read(FILE)` inside a function that accepts overrides can never fail.** Two of my narrowed-sentence checks ignored the override and were unreachable by any mutation. If a function takes overrides, every read in it must honour them.
- **Choose the instrument the surface allows, and say why.** APP-0 could render its region; these two reach `next/link` and throw outside Next, so they are asserted at source with comments stripped — the same instrument the released `director-truth-surface` suite already uses on this directory, precisely because these files discuss the sentences they no longer render.
- **A more precise sentence can cost pixels.** Mobile document height grew 23px because the narrowed wording wraps one more line. Report it; it is not overflow and not a regression, but it is a real consequence and hiding it would be its own small dishonesty.

## CMD-B1 — Command becomes a canonical Overview (released, 429/429, tag `hebun-cmdb1-command-canonical-overview`)
- **A withheld read and a fabricated zero can live one component apart.** The adapter's own comment forbade the zero — "WITHHELD, NOT ZEROED… A fabricated zero would be its own lie" — and the strip directly above printed `0 critical · 0 warning · 0 AGENTS · 0 WORKFLOWS` anyway. A source of truth cannot defend itself against a presentation layer that never asks it anything; the guard has to live where the rendering happens.
- **Retire a region that has no source; do not reword it.** All eight Command Center components read one withheld projection. There was no honest sentence available to any of them, because the problem was never the words — it was that nothing had been read. Rewording would have produced eight honest labels over eight non-answers.
- **`none-waiting` as its own union member is cheaper than any assertion about it.** Making empty a *state* rather than `items: []` means no consumer can render an unanswered read and an empty list through the same branch by accident. The type does the work the test would otherwise have to keep doing forever.
- **Widening a permitted-importer pin is not always weakening it.** The APP-1 seam pin never meant "only two surfaces may read"; it meant one reader per surface and no duplicated queue. Adding `/command` kept all three properties. Write the property in the pin's comment, or the next phase cannot tell a legitimate addition from a breach — and will either break the architecture or refuse a correct change.
- **Import the seam type-only and the component cannot betray the pin.** `command-overview.tsx` and `workspace-model.ts` name the seam's types and cannot call it. A capability you never receive is one you cannot be tempted to use.
- **Not fetching is a stronger guarantee than not merging.** Permits and pending requests are different lifecycle stages that an executive summary is forever tempted to add together. The way to guarantee that never happens is to leave the second read out of the route entirely.
- **Six not-connected capabilities deserve six reasons, not one grey sentence.** "No source exists", "a contract exists but no runtime does" and "the only source is a seed, so it is withheld" are three different situations. Collapsing them is the same class of defect as collapsing empty into unavailable — a reader loses the ability to tell what would have to change.
- **A required `provenance` field beats a convention about provenance.** CMD-A found 0 ProvenanceChip across all eight Command routes. Making it a required prop on `WorkspaceSection` turns "remember to state your source" into a type error, which is the only version of that rule that survives the next phase.
- **A dead export is safer pinned than swept.** `HealthCell` has zero renderers and lives in a file VI-1 tracks and two workspaces import. Removing one unused export would have put a released visual pin at risk for no behavioural gain; a zero-renderer assertion with a fake-renderer bite-proof holds the same ground at no cost.
- **A session in the database is not a session in the browser you drive.** `user_session_contexts` moved 92 → 94 while the pane I was measuring had **no `POST /login` in its network log at all** — only `GET /login → 200`. The row count proved a human authenticated; the network log proved it was not here. Check the instrument, not the outcome.
- **When the proof cannot be obtained, name it and name what you rejected.** Typing the credential, minting a session, copying the cookie, disabling auth, and rendering the component in a harness were all available and all wrong — the last one because G7 already recorded that the shell eats ~270px a harness never sees. This repository's habit is to write BLOCKED and stop (C3), VOID (G5A.1), "not attempted" (G7), or "unavailable and left that way" (G6B). A recorded gap is worth more than a substituted proof wearing the missing one's name.

## CMD-B2 — Command's canonical L2 becomes three destinations (released, 431/431, tag `hebun-cmdb2-canonical-command-l2`)
- **Removing a row from a menu is not removing a capability, and the difference has to be testable.** The five destinations left `WORKSPACES` while their pages, their route census entry, their workspace ownership and their production build output all stayed exactly as they were. Write the pin as "gone from the menu AND present on disk AND still owned", or the next phase cannot tell an unlisting from a retirement.
- **A guard whose premise you delete stops guarding.** Longest-prefix active matching only worked because a more specific destination always outranked the landing. Remove those destinations and `/command/inbox` lights up **Overview** — a false statement about where the operator is. When you delete rows from a list, go and read what else was quietly relying on those rows being there.
- **A shared component gets a general fix, and you report the extra ground it covers.** Making the landing match by equality also corrected `/governance/authority` and `/governance/genesis`, which had been falsely highlighting Governance Overview. Special-casing Command inside a renderer that serves seven workspaces would have been the worse trade — but the two extra corrections belong in the report, not in the footnotes.
- **A number copied into six other test files is an invariant nobody declared.** The eight-item sequence was pinned in seven suites across six phases. Before changing a shape, grep for the shape itself: the amendment surface, not the implementation, is what makes a "navigation-only" phase large.
- **Amend a pin by asking what it was really for.** Four of the seven used menu membership as a proxy for *ownership*; asserting `resolveActiveWorkspace("/director/goals") === "command"` is truer than asserting the label appears in a list, and it survives the next navigation phase. A freeze that names its own thaw ("frozen until CMD-B2") expires by design — that is not the same as being lifted.
- **A bite-proof that throws for the wrong reason bites against everything, including correctness.** CMD-B1's M12 compared a 7-element `slice(0, 7)` against an 8-element literal. It "passed" every release. Before trusting a proof, ask what it does when the code is RIGHT.
- **Verify the harness, not just the guards.** Running one deliberately harmless mutation through the bite harness and requiring it to be REJECTED is two lines and converts "14 of 14 bit" from a claim into a measurement.
- **Calibrate a probe before you report what it proved.** An unauthenticated production request to `/zzz-not-a-route` also returns `307 → /login`, so status codes cannot separate an existing route from a missing one. The honest artifact was the app-paths manifest. A probe you have not calibrated is not evidence, it is a coincidence you liked.
- **Fix the thing you were sent to fix, and say what you only exposed.** Heby answering `/command/inbox` with `/command` surfaced during this phase, but `/command/does-not-exist → /command` proved it predated it. Reporting that distinction kept two clean authorship histories instead of one commit that appears to have caused a defect it merely revealed.
- **A test suite written against the post-change product cannot ship before the change.** HEBY-NAV-0's proofs bake in CMD-B2's canonical three, so releasing it first would have put a red commit on `main`. Measured in a throwaway worktree at the old HEAD rather than assumed — 4 of 7 checks failed — and the release order was corrected before any history was written. **Check the ordering dependency between a fix and its proofs, not just between the fixes.**
