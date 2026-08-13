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
