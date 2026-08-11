# Hebun — Design System Foundation

## Document Status

**DOCUMENT TYPE: PRODUCT VISION — UI PHASE 4 — DESIGN SYSTEM FOUNDATION**

**STATUS: DESIGN SYSTEM DOCUMENTATION ONLY — NO IMPLEMENTATION**

This document defines the canonical visual and interaction design system for Hebun, before App Shell and workspace implementation. It writes no components, no CSS, no Tailwind config. It anchors to the **already-shipped** token system and extends it; it does not restart it.

Layer separation held: System → Capabilities → IA → Navigation → **Design System (this document)** → UI Implementation (later).

**Discovery basis:** branch `main`, HEAD `43093c9`, `HEAD == origin/main`, 0/0, tree clean except pre-existing untracked docs. Read: the three prior UI-phase docs, `src/styles/tokens.css`, `src/app/globals.css`, `src/components/ui/*` (badge, button, card, status-badge, empty/error/loading states).

**Decisive evidence from the codebase — the design system already exists and is disciplined:**
- **Token-driven, Tailwind v4** (`@theme inline` aliases tokens → utilities; rule in-file: *"no raw hex/px/ms in components. Ever."*).
- **Light-mode canonical today.** `--color-bg #f7f8fa`, `--color-text-primary #142033`. **No dark tokens exist.**
- **Font:** Plus Jakarta Sans (`--font-jakarta`), `ss01` on.
- **Muted, enterprise semantics** (success `#047857`, warning `#92400e`, error `#b91c1c`) — not neon.
- **Restraint already encoded:** `glass` is "floating chrome only … never on dense data"; gradients labeled "decorative only"; borders + surface hierarchy over shadows.
- Existing primitives to build on: `ui-table-wrap`, `ui-metric-card/grid`, `ui-skeleton`, `status-badge`, `card`, `button`, `badge`, state components; layout vars `--sidebar-w 264`, `--sidebar-w-collapsed 72`, `--topbar-h 64`, `--gutter 24`; motion `--dur-fast 160ms / --dur-base 240ms`, `--ease-out`; full z-index scale.

**On "dark mode first":** the instruction gates this on product direction. The repository ships **light-first with no dark tokens**. Overriding to dark-first would be a rewrite against evidence. **Resolution: light stays canonical; dark mode is a labeled DESIGN CANDIDATE** with a token strategy (Section 3.6). Surfaced as an open decision (Section 23).

Throughout, values that already exist in `tokens.css` are cited as **existing**; anything new is marked **DESIGN CANDIDATE**.

---

## 1. Product Visual Positioning

Hebun is **executive command software**, not a SaaS dashboard. It should read as:

- **Calm, precise, high-trust.** The Director makes consequential decisions here; the surface must feel governed and honest.
- **Dense when needed, never chaotic.** Command may be information-dense; detail workspaces are calmer, more editorial.
- **Technically advanced, not a game HUD.** Sophistication through typography, spacing, and hierarchy — not neon, glow, or motion.
- **Premium through restraint.** Borders and surface steps over heavy shadows; whitespace over decoration.
- **Operational, not legacy ERP.** Modern density and clarity, not gray toolbars and 11px grids.

Two registers: **Command register** (denser, cockpit) and **Workspace register** (calmer, editorial). Same tokens; different spacing and section budgets.

---

## 2. Design Principles

1. **Honesty over polish.** Confidence, uncertainty, provenance, and the human/AI boundary are shown truthfully, never flattered.
2. **Advice is never authority.** AI advisory content and human decisions are visually unmistakable (Section 11).
3. **Restraint is the aesthetic.** No decorative gradients/glow on data; no card-in-card; no icon soup.
4. **Not color alone.** Every state = color **+** label **+** icon/shape/border (Section 12). Accessibility is structural, not a pass.
5. **Density with hierarchy.** Dense is fine when scannable; clutter is dense without hierarchy.
6. **Token-driven.** Extend `tokens.css`; never hardcode. New semantics become new token families.
7. **Ambient Heby, distinct but not foreign.** Heby is visually its own layer, not a separate app.
8. **One system, seven workspaces.** The same primitives compose all workspaces + Heby; workspace identity comes from accent and content, not different design languages.

---

## 3. Color System

### 3.1 Existing foundation (canonical — from `tokens.css`)
Surfaces `--color-bg #f7f8fa` · `--color-surface #ffffff` · `--color-surface-sunken #f1f4f8` · borders `--color-border #e2e7ef` / `--color-border-strong #c7d0dd`. Text `--color-text-primary #142033` / `-secondary #526075` / `-muted #5b687a` / `-inverse #ffffff`. Brand `--color-primary #2563eb` (+ hover/press) · `--color-accent #0284c7` · `--color-highlight #4f46e5`. Semantic `success #047857` / `warning #92400e` / `error #b91c1c` / `info #1d4ed8`, each with a `-subtle` wash + on-color text. **Reuse these as-is.**

### 3.2 Semantic state pattern (DESIGN CANDIDATE — structure)
Every semantic state is a **token quintet**, not a single color: `{fg, bg-subtle, border, icon, label}`. This is what makes states legible without color (Section 12).

### 3.3 New semantic families needed (DESIGN CANDIDATE)
The new product concepts have no tokens yet. Add these families, tuned to the existing muted palette (no new bright hues where an existing one fits):

- **status.approval-pending** — reuse `warning` family (amber). Attention, not alarm.
- **status.governance-blocked** — reuse `error` family + a **hatch/lock** treatment so it never reads as merely "failed."
- **risk.{low,moderate,high,critical}** — `success → warning → error → error-strong`; each carries a label; never color-only.
- **confidence.{high,medium,low,indeterminate}** — **not hue-coded.** Use text + a 4-step **filled-bar/segment** glyph + label ("High", "Low", "—"). Neutral ink, not green/red (confidence is not good/bad).
- **evidence.grounded** — `info`/neutral with a **source chip**; **evidence.withheld** — muted + hatch + "withheld"; **evidence.missing** — dashed border + "no evidence."
- **uncertainty** — neutral, italic label + `~` glyph; never hidden behind a confident color.
- **authority.\*** — see Section 11 (advisory/recommendation/review/approval/approved/rejected/question/recorded/superseded).
- **agent.\*** — see Section 14 (idle/planning/running/waiting/blocked/review/awaiting-approval/completed/failed).
- **heby.accent** — DESIGN CANDIDATE: `--color-highlight #4f46e5` (indigo) to distinguish Heby from primary blue without a foreign palette.

### 3.4 Restraint rules
- Not every state gets a bright color. Confidence and uncertainty are **ink + glyph**, not rainbow.
- `-subtle` washes for backgrounds; saturated hue only for the icon/label/left-rule.
- Gradients (`--gradient-*`) and `--shadow-glow`: **decorative chrome only**; **banned on data surfaces** (extends the existing token comment).

### 3.5 Workspace accents (DESIGN CANDIDATE)
Each workspace may carry a subtle accent (used only in the header/active-nav, never as data color): Command = primary blue · Intelligence = highlight/indigo · Knowledge = accent/cyan · Operations = teal-green · Workforce = slate · Governance = amber-neutral · Platform = neutral. Accents identify place; they never encode data meaning.

### 3.6 Dark mode (DESIGN CANDIDATE — future)
Strategy when authorized: keep the same semantic **token names**, add a `:root[data-theme="dark"]` (or `@media prefers-color-scheme`) override block mapping surfaces/text/borders to a dark ramp; components already reference aliases, so no component rewrite is needed. Light remains the default until a Director decision opens dark.

---

## 4. Typography

Family: **Plus Jakarta Sans** (existing `--font-sans`/`--font-jakarta`), `ss01`, `text-rendering: optimizeLegibility` (existing). One family for UI. **Monospace for IDs/technical metadata is a DESIGN CANDIDATE** (`ui-monospace, SFMono…`) — none exists today.

Type roles (DESIGN CANDIDATE scale; existing heads use `line-height 1.15`, `letter-spacing -0.02em`, `text-wrap: balance`):

| Role | Use | Size/weight candidate |
|---|---|---|
| Page title | Top of a surface | ~28/700, tight tracking |
| Workspace title | Workspace header | ~20/600 |
| Section title | Group heading | ~15/600 |
| Body | Prose, descriptions | ~14/400, LH 1.5 |
| Secondary | Meta, captions | ~13/400, muted |
| Metric | KPI value | ~24–32/600, **tabular-nums** (existing util) |
| Table | Cell text | ~13/400; header 12/600 uppercase `.08em` (existing) |
| Code/ID | IDs, hashes, technical | ~12/500 monospace *(candidate)* |
| Label | Field/chip labels | ~12/600, `.02–.08em` |
| Badge/chip | Status text | ~11–12/600 |

Restraint: at most **three weights** (400/600/700). Uppercase only for table headers, labels, and small caps of intent. Numbers in data are always tabular.

---

## 5. Spacing

Anchor to existing `--gutter: 24px`. Scale (DESIGN CANDIDATE, 4px base): `space.1 4 · 2 8 · 3 12 · 4 16 · 5 20 · 6 24 · 8 32 · 10 40 · 12 48`.

| Token | Value | Use |
|---|---|---|
| Page gutter | `--gutter` 24 (16 mobile) | Content padding (matches shell `px-4 sm:px-6 lg:px-8`) |
| Workspace section gap | 24 (`ui-section-grid` = 1.5rem, existing) | Between major sections |
| Card padding | 16 (`ui-metric-card` = 1rem, existing) | Inside surfaces |
| Row height (comfortable) | 44 | Default table/list row |
| Row height (dense) | 32–36 | Command/ops dense tables |
| Mobile spacing | −1 step | Tighten gutters, not density-to-illegible |
| Sidebar spacing | `--sidebar-w` 264 / collapsed 72 (existing) | Nav rail |

Command register uses **dense rows**; Workspace register uses **comfortable rows**.

---

## 6. Radius / Border / Shadow

- **Radius (existing):** `sm 6 · md 10 · lg 14 · xl 20 · 2xl 28 · full`. Surfaces `md`/`lg`; compact controls `sm`; chips `full`; modals `lg`/`xl`.
- **Border hierarchy (existing):** `--color-border` default hairline; `--color-border-strong` for emphasis/active; left-rule (3–4px) for authority/attention accents.
- **Shadow policy:** prefer **border + surface step**. `shadow-xs/sm` for raised cards; `shadow-md` for dropdowns/inspectors; `shadow-lg` for modals. **`shadow-glow` = chrome accent only, never on data.** No stacked shadows, no glow-per-card.

---

## 7. Surface Hierarchy

| Surface | Token | Use | Do NOT |
|---|---|---|---|
| App background | `--color-bg` | Root canvas | Put content directly on it |
| Workspace background | `--color-bg` + optional accent header | Workspace canvas | Add texture/gradient |
| Primary surface | `--color-surface` | Cards, panels, tables | Nest inside another primary |
| Secondary surface | `--color-surface-sunken` | Metric tiles, wells, insets | Use for top-level cards |
| Elevated/temporary | `--color-surface-raised` + `shadow-md` | Dropdown, popover, inspector | Persist on the page |
| Inspector/drawer | raised + left border + `shadow-md` | Level-3 drill-down slide-over | Replace full navigation |
| Modal/dialog | surface + `shadow-lg`, scrim | Confirmations, focused tasks | Overuse for routine flows |
| Critical attention | `error`/`warning` `-subtle` + left-rule | Alerts, blocked, approval-required | Apply to non-critical items |
| Heby surface | `heby.accent` left-rule + subtle wash *(candidate)* | Heby panel/home/inline | Look like a chat bubble app |

**One nesting level.** A card may contain rows/tiles, not another bordered card (kills card-in-card).

---

## 8. Navigation Visual Rules

- **Level 1 rail:** icons + labels; active = `border-strong` left-rule + accent + `aria-current`; collapsed = icon-only (`--sidebar-w-collapsed`). Heby launcher visually set apart (accent), pinned.
- **Level 2:** quiet list; active row = subtle fill + accent text; persisted open state (existing `use-sidebar-state`).
- **Level 3 (contextual):** never in the rail — breadcrumb + back in the content/inspector.
- **Topbar (`--topbar-h` 64):** search, palette, Heby, notifications, approvals-attention, org selector, account. `glass` allowed here (chrome), never on data.

---

## 9. Component Primitives (conceptual specs — no React yet)

For each: purpose · anatomy · states · density. Summarized; full behavior in the summary table (Section 25).

- **Primary/Secondary/Contextual nav** — §8.
- **Workspace header** — title + accent + optional actions + Heby affordance; one per surface.
- **Topbar** — global controls (§9 nav / §10 controls).
- **Heby launcher** — persistent accent control; §10.
- **Heby panel** — left-rule accent slide-over; §10.
- **Briefing item** — advisory card: title, synthesis, confidence glyph, source chips, "advisory" label, link-to-evidence; **no approve control**.
- **Metric card** — `ui-metric-card` (existing): label (top) + tabular value (bottom-anchored, existing rule) + optional delta/sparkline. Never a chart-in-a-tile.
- **Status card** — label + `status-badge` (existing) + one supporting line.
- **Table** — `ui-table-wrap` (existing): sticky header, dense/comfortable rows, nowrap + horizontal scroll, tabular numbers.
- **Dense data row / event row / agent row / decision row** — one-line scannable rows: identity + state badge + meta + time; row-click → inspector.
- **Approval item** — attention surface: subject, consequences, risk, required-approval marker, explicit act controls (Director only); visually distinct from advisory.
- **Evidence item / provenance item** — source chip: source name, lifecycle, count, link; grounded/withheld/missing variants.
- **Confidence indicator** — 4-segment glyph + label; ink, not hue.
- **Uncertainty indicator** — `~` + italic label.
- **Governance block** — hatched/locked banner: reason + "blocked", no dismiss-to-proceed.
- **Risk indicator** — labeled chip low→critical.
- **Timeline** — vertical/horizontal sequence for executions/audit; dot + time + label.
- **Audit trail** — immutable list, supersession shown, monospace IDs *(candidate)*.
- **Inspector panel** — §7; the drill-down home.
- **Tabs / segmented control** — within-surface switching; ≤5 items.
- **Dropdown / search / command palette** — raised chrome; palette keyboard-first.
- **Buttons** — existing `button`: primary/secondary/ghost/danger; one primary per view.
- **Form controls** — labeled, 44px targets, error text + icon.
- **Empty / loading / error / blocked states** — existing `empty-state`/`loading-state`/`error-state` + new **blocked state** (governance).

---

## 10. Heby Visual Identity

Heby is an **ambient intelligence layer**, not a chat widget. Visual rules:

- **Launcher:** persistent, `heby.accent` (indigo candidate), pinned in the shell (rail + topbar presence); keyboard shortcut. Distinct from workspace nav.
- **Collapsed state:** a quiet accent control with an attention dot when Heby has a prepared item/answer.
- **Contextual side panel:** slide-over with a **left accent rule**; header shows current-workspace + selected-object context ("On: Execution #123"). Not a bubble stack — an intelligence surface.
- **Expanded interaction mode:** the `/heby` home; full surface for briefings/exploration; same accent, more room.
- **Inline Heby responses:** when Heby answers inside a surface, its content carries the accent rule + an "advisory" marker, so it never masquerades as page data or a human decision.
- **Evidence/source attachments:** source chips under an answer (grounded/withheld/missing).
- **Confidence/uncertainty:** inline glyph + label on every answer (Section 12).
- **Director-boundary state:** a visible band — "Prepared for your decision" — with **no** authoritative act inside Heby; the act lives in Command.
- **Approval-preparation state:** distinct "prepared / pending your review" styling; visibly *not* an approval.
- **Governance-blocked state:** hatched/locked notice with reason; Heby withholds, never dresses ungrounded content as grounded.
- **Workspace/object awareness:** the panel header always names its context; switching workspace re-scopes it.

Distinct, never foreign: same type, spacing, tokens — only the accent rule and advisory markers set it apart.

---

## 11. Director Authority Visual Language

The load-bearing distinction: **AI advisory ≠ human decision; recommendation ≠ approval.** Encoded structurally.

| State | Visual marker (DESIGN CANDIDATE) | Never |
|---|---|---|
| Advisory information | Normal surface + small "Advisory" label | Styled like an action |
| Recommendation | Advisory + lightbulb + "Recommended" | An approve-styled button |
| Review required | Neutral attention + "Review" | Auto-resolvable |
| Approval required | **Amber attention band + lock + "Requires your approval"** + gated act | Pre-checked/implied |
| Approved (human) | **Success + human seal + "Approved by {name} · {time}"** | Shown without who/when |
| Rejected (human) | Error-neutral + "Declined by {name} · {time}" | Ambiguous |
| Unresolved question | Dashed + "Open question" | Hidden |
| Recorded decision | Solid **left authority-rule** + human icon + timestamp | Editable-looking |
| Superseded decision | Muted + strikethrough-meta + "Superseded by …" | Deleted/rewritten |
| Governance block | Hatch/lock + reason | Dismiss-to-proceed |

**Rule:** authority chrome (solid left-rule + human identity + timestamp) appears **only** on human decisions. AI content **never** wears it. An approve affordance exists **only** on an Approval item in Command, **never** in Heby or on a recommendation.

---

## 12. Confidence / Uncertainty / Evidence Grammar

Restrained, **never color-alone**:

| Concept | Grammar (DESIGN CANDIDATE) |
|---|---|
| Grounded | Source chip + "Grounded" + link |
| Source count | "3 sources" numeral chip |
| Evidence strength | Filled-segment glyph (▮▮▯▯) + label |
| Confidence high/med/low/indeterminate | 4-segment glyph + word ("High"/"Low"/"—"); **neutral ink** |
| Explicit uncertainty | `~` + italic "uncertain" |
| Missing evidence | **Dashed border** + "No evidence" |
| Withheld/blocked | **Hatch** + lock + "Withheld" |
| Source provenance | Chip: source · lifecycle · version |
| Historical state | Muted + "as of {time}" |

Every indicator pairs **≥2 channels** (text + glyph, or text + border pattern). Confidence is **not** green/red — it is not a quality judgment.

---

## 13. Governance / Security States

- **Blocked (governance):** hatched surface + lock icon + reason + "Blocked" — visually heavier than a plain error; **no proceed-anyway**.
- **Restricted (permission):** neutral lock + "Restricted"; the surface is present but gated (visibility ≠ authorization; server enforces).
- **Elevated-required (assurance/MFA):** shield + "Requires elevated verification" on Command Console / Approvals act.
- **Tenant/org scope:** the org selector reflects scope; a scoped surface names its tenant; no cross-tenant blend.
- **Audit/immutable:** recorded items look non-editable; changes shown as supersession.

---

## 14. AI Workforce States

Standard **agent state** grammar (badge = color + icon + label; DESIGN CANDIDATE):

| State | Read | Marker |
|---|---|---|
| Idle | neutral | dot |
| Planning | info | pencil |
| Running | primary + subtle pulse (once/loop-off) | activity |
| Waiting | muted | pause |
| Blocked | error + hatch | lock |
| Review required | warning | eye |
| Awaiting approval | amber authority band | lock (→ Command) |
| Completed | success | check |
| Failed | error | alert |

Also: **agent identity** (name + role + department, monogram not avatar), **task ownership** (owner chip), **reviewer/validator relationship** (labeled edges: "reviewed by", "validated by"), **human-approval relation** ("awaiting {Director}"). **No anthropomorphic avatars as primary** — operational clarity first; a small monogram is the most personification allowed.

---

## 15. Command Center Density Rules

- **Max ~5 major sections above the fold:** (1) Attention/approvals, (2) Briefings, (3) Organization health, (4) Live activity/executions, (5) Agents. More → progressive disclosure.
- **Priority hierarchy:** attention → decisions/briefings → health → activity → detail.
- **Progressive disclosure:** summaries on the page; depth in the **inspector** (row-click), not more widgets.
- **Charts vs lists:** charts only for **trend/distribution/relationship**; discrete items (approvals, alerts, agents, events) are **lists**, not gauges.
- **Heby vs page:** the **page shows state**; **Heby answers "why / explain / compare / prepare."** Don't duplicate Heby's Q&A as page widgets.
- **No wall of tiny widgets:** each section earns its place by decision value; a metric with no decision attached is demoted or removed.

Command is the *only* workspace allowed this density; others use the calmer Workspace register.

---

## 16. Data Visualization Rules

| Chart | Use for | Avoid when |
|---|---|---|
| Line | Trend over time | Few discrete categories |
| Bar | Compare discrete values | Time-series with many points |
| Stacked bar | Composition over time (sparingly) | >4 segments |
| Area | Cumulative magnitude | Precise comparison |
| Heatmap | Density across 2 axes | Small n |
| Network graph | Knowledge/org relationships | Simple lists |
| Timeline | Execution/audit sequence | Non-sequential data |
| Matrix | Provider×capability, coverage grids | Single dimension |
| Status distribution | Small segmented bar | (never a pie for >3) |

**Do NOT chart:** a single number (use a metric), decorative backgrounds, 3D, dual-axis, pie for many slices. **Every chart must answer a decision question**; decorative analytics are banned. Charts use the muted palette + tabular labels + a data-table alternative (accessibility).

---

## 17. Responsive Rules

Primary breakpoints (align to Nav phase): **Desktop ≥1280 · Tablet ~768 · Mobile ~375**. (Current shell breaks at `lg` 1024 — **open decision** to align to `xl` 1280; Section 23.)

| Element | Desktop | Tablet | Mobile |
|---|---|---|---|
| Typography | Full scale | −0 to −1 | −1 step |
| Spacing | `--gutter` 24 | 20 | 16 |
| Cards | Multi-col grid (`auto-fit` exists) | 2-col | 1-col stack |
| Tables | Full, dense | Scroll (`ui-table-wrap`) | **Stacked cards** or scroll |
| Drawers/inspector | Side slide-over | Side/overlay | **Full-screen sheet** |
| Heby | Side panel | Side panel | **Full-screen** |
| Workspace header | Full | Condensed | Title + overflow |
| Metrics | Row | 2-up | 1–2-up |
| Charts | Full | Simplified | Sparkline/summary or defer to detail |
| Secondary nav | Column | Drawer | Sheet |

**Mobile must not reproduce desktop density.** Fewer sections, stacked, Heby-first for intelligence.

---

## 18. Accessibility

- **Contrast:** WCAG **AA** (existing ink `#142033` on `#f7f8fa` passes; verify all `-subtle`/on-color pairs). Non-text (icons, borders) ≥ 3:1.
- **Color independence:** every state carries text/icon/shape (Section 12) — never color-only.
- **Focus:** visible `focus-visible` rings (existing on topbar); logical order; skip-to-content.
- **Keyboard:** full nav at all levels; palette keyboard-first; Heby shortcut; drawers trap+restore focus (existing mobile-drawer pattern).
- **Screen reader:** ARIA landmarks (nav/main/complementary=Heby); `aria-current`; `sr-only` counts for attention/notifications (existing).
- **Tables:** header semantics (existing), scroll containers, tabular numerals.
- **Charts:** text/data-table alternative for every chart.
- **Motion:** honor `prefers-reduced-motion` (existing global rule).
- **Targets:** ≥44px on mobile.

---

## 19. Motion

Reuse existing motion tokens (`--dur-fast 160 · --dur-base 240 · --ease-out`). Motion **signals state, never decorates**:

| Event | Motion |
|---|---|
| Panel/drawer/Heby open-close | `--dur-base` slide/fade, `--ease-out` |
| Heby expansion | `--dur-base`, no bounce |
| Data update | `--dur-fast` subtle fade/number roll |
| Status change | `--dur-fast` cross-fade badge |
| Approval attention | **one-time** pulse, not a loop |
| Live operations | subtle activity indicator, **no constant background animation** |

`prefers-reduced-motion` collapses all to ~0 (existing). No ambient/looping motion anywhere.

---

## 20. Token Architecture

Three layers, matching the shipped model:

1. **Primitive** (`tokens.css` `:root`) — raw hex/px/ms. Existing.
2. **Semantic alias** (`globals.css` `@theme inline`) — `color-fg`, `color-surface`, etc. → utilities. Existing.
3. **Component/state families** (DESIGN CANDIDATE, to add) — `status.*`, `confidence.*`, `evidence.*`, `risk.*`, `authority.*`, `agent.*`, `heby.*`, each as a quintet `{fg, bg, border, icon, label}`.

Proposed families:

```text
color.*        (existing primitives)
surface.*      app · workspace · primary · secondary · raised · inspector · modal · critical · heby
text.*         primary · secondary · muted · inverse         (existing)
border.*       default · strong · authority-rule · attention-rule
radius.*       sm md lg xl 2xl full                            (existing)
space.*        1..12 (4px base)                                (candidate, gutter existing)
type.*         page · workspace · section · body · secondary · metric · table · code · label · badge
status.*       approval-pending · governance-blocked · restricted · elevated-required
confidence.*   high · medium · low · indeterminate             (ink + glyph)
evidence.*     grounded · withheld · missing · source-count · strength
risk.*         low · moderate · high · critical
authority.*    advisory · recommendation · review · approval-required · approved · rejected · question · recorded · superseded
agent.*        idle · planning · running · waiting · blocked · review · awaiting-approval · completed · failed
heby.*         accent · surface · launcher
motion.*       dur-fast · dur-base · ease-out                  (existing)
z.*            base · sticky · dropdown · overlay · modal · toast · tooltip  (existing)
```

**Rule preserved:** components reference tokens only; no raw values. New families ship in `tokens.css` + `@theme` before any component uses them.

---

## 21. Existing UI Migration Implications

Good news: the shipped system **already aligns** with this foundation. Extend, don't rewrite.

- **Keep:** all of `tokens.css`, `@theme` aliases, `button`, `badge`, `status-badge`, `card`, `ui-metric-card/grid`, `ui-table-wrap`, `ui-skeleton`, `empty/error/loading` states, layout vars, z-scale, reduced-motion rule.
- **Extend:** add the new token families (Section 20); add `status-badge` variants for authority/agent/confidence/evidence/risk; add a **blocked state** component.
- **Restrain (cleanup):** stop using `--gradient-*` and `--shadow-glow` on data surfaces (retire to chrome only — token comments already say so); enforce one-level nesting; drop any decorative charts.
- **Align:** breakpoint (`lg`→`xl`) and topbar controls (search/notifications currently `disabled` — wire per Nav phase; add palette, Heby launcher, org selector, account).
- **Add net-new:** Heby surfaces (none exist), authority markers, confidence/evidence grammar, agent-state badges, inspector pattern.

No full rewrite is warranted; the foundation is a superset of what ships.

---

## 22. Anti-Patterns (banned)

- Generic SaaS dashboard look; cyberpunk neon; gradient/glow on data; heavy/stacked shadows.
- Huge empty cards; **card-in-card** nesting; wall of tiny widgets; icon overload.
- Decorative charts with no decision value; pie charts for many slices; 3D; dual-axis.
- **Color-only** state encoding; confidence as green/red.
- Anthropomorphic avatars as primary agent identity.
- Heby styled as a chat bubble app; advisory content wearing authority chrome; an approve control outside Command.
- `glass` on dense data (chrome only); constant background motion.

---

## 23. Open Design Decisions

1. **Dark mode.** Instruction preferred dark-first; repo is light-first with no dark tokens. **Proposed: light canonical now, dark as candidate (Section 3.6).** Director confirm.
2. **Breakpoint alignment.** Current shell breaks at `lg` 1024; Nav/Design target `xl` 1280 for full nav. Align to `xl`?
3. **Heby accent color.** Indigo `--color-highlight #4f46e5` proposed to distinguish from primary blue — confirm or pick a dedicated Heby hue.
4. **Monospace font for IDs/audit.** None today; introduce a mono family for technical metadata?
5. **Workspace accents.** Adopt subtle per-workspace accents (Section 3.5) or stay mono-accent (primary only)?
6. **Confidence glyph form.** Segmented bar vs dots vs numeric — pick one canonical form.

---

## 24. Implementation Constraints for the Future App Shell

1. **Token-first, always.** New semantics land in `tokens.css` + `@theme` before components consume them. No raw values (existing rule).
2. **Theme-swap ready.** Reference aliases only, so a dark override is a token block, not a component change.
3. **Authority chrome is reserved.** The authority left-rule + human-identity + timestamp render **only** for human decisions; enforce in the component contract.
4. **No approve affordance outside Command Approvals.** Heby and recommendations must not expose one.
5. **Color-independence is mandatory** on every state component (≥2 channels).
6. **One nesting level** for surfaces; inspector is the depth mechanism, not more cards.
7. **Heby is shell-level** (launcher + panel), not workspace-level.
8. **Charts require a decision question + a data-table alternative.**
9. **Command density budget** (~5 sections) is a shell rule, not a suggestion.
10. **Reuse existing primitives** (`ui-table-wrap`, `ui-metric-card`, state components) rather than reinventing.

---

## 25. Compact Design-System Summary

| Element | Purpose | Visual priority | Interaction | Responsive |
|---|---|---|---|---|
| L1 nav rail | Workspace switch | High, quiet | Click switch, collapse | Icon rail → sheet (mobile) |
| L2 nav | Within-workspace | Medium | Persist open state | Column → drawer → sheet |
| Heby launcher | Global intelligence entry | High (accent) | Shortcut, attention dot | Pinned → button (mobile) |
| Heby panel | Contextual advisor | High (accent rule) | Slide-over, context-aware | Side → full-screen |
| Briefing item | Advisory synthesis | High (advisory) | Link to evidence | Stack |
| Metric card | KPI value | Medium | Static / drill | Grid reflow |
| Table / dense row | Scannable data | Medium | Row → inspector | Scroll → stacked cards |
| Approval item | Human authority act | Highest (attention) | Gated act (Director) | Full-width |
| Evidence/provenance | Grounding | Low-med | Link to source | Inline/stack |
| Confidence/uncertainty | Honesty | Low (ink+glyph) | Static | Inline |
| Governance block | Enforcement | High (hatch/lock) | Non-dismiss | Banner |
| Risk indicator | Risk level | Med (labeled) | Static | Chip |
| Agent row | Workforce state | Medium | Row → inspector | Stack |
| Timeline / audit | Sequence/record | Medium | Expand entries | Vertical stack |
| Inspector | Level-3 depth | High (raised) | Slide-over | Full-screen (mobile) |
| Command palette | Jump/act | On-demand | Keyboard-first | Full-screen (mobile) |

---

## 26. Validation

- **Supports all 7 workspaces** — shared primitives + per-workspace accent; Command dense, others calm.
- **Heby fits globally** — ambient accent layer, shell-level, distinct not foreign (Sections 7, 10).
- **Director authority explicit** — reserved authority chrome; approve only in Command (Sections 11, 24).
- **Approval ≠ AI advice** — structural markers; no approve outside Command (Sections 10, 11).
- **Confidence/uncertainty color-independent** — ink + glyph + label (Section 12).
- **Governance block distinct** — hatch/lock, heavier than error, non-dismiss (Sections 12, 13).
- **Agent states consistent** — one badge grammar (Section 14).
- **Command dense without clutter** — section budget + inspector + Heby-vs-page (Section 15).
- **Mobile usable** — reduced density, full-screen Heby/inspector (Section 17).
- **No internal architecture exposed** — visual system is capability/state-driven, not module-driven.
- **Migrates without rewrite** — foundation is a superset of shipped tokens/components (Section 21).
- **Scales to 100+ routes** — token + primitive reuse; nothing per-route (Sections 20, 21).

---

## 27. Final Report

- **Visual direction.** Enterprise command software — calm, precise, high-trust; dense-when-needed, restraint as aesthetic; borders/surface over shadow; muted enterprise palette. Light-first (matches shipped tokens).
- **Design token families.** color · surface · text · border · radius · space · type · status · confidence · evidence · risk · authority · agent · heby · motion · z (existing families reused; new families are DESIGN CANDIDATES layered on `tokens.css`).
- **Core semantic states.** approval-pending · governance-blocked · restricted · elevated-required · risk(4) · confidence(4) · evidence(grounded/withheld/missing) · uncertainty · authority(10) · agent(9).
- **Heby visual model.** Ambient accent layer (indigo candidate): persistent launcher + context-aware side panel + `/heby` home + inline advisory markers; never a chat widget; approval act excluded.
- **Director authority model.** Reserved authority chrome (left-rule + human identity + timestamp) on human decisions only; recommendation/advisory visibly not authority; approve affordance only on Command Approvals.
- **Command Center density model.** ~5 major sections above fold; priority hierarchy; progressive disclosure via inspector; charts for trend/distribution only; page = state, Heby = why.
- **Responsive model.** Desktop ≥1280 (dense, full nav) · Tablet ~768 (drawers) · Mobile ~375 (stacked, full-screen Heby/inspector, no desktop density). Breakpoint-alignment open.
- **Accessibility model.** WCAG AA; color-independent states; focus/keyboard/SR landmarks; chart data-table alternatives; reduced-motion; 44px targets.
- **Open decisions.** Dark mode (light canonical now); breakpoint `lg`→`xl`; Heby accent; monospace for IDs; workspace accents; confidence glyph form.
- **File created.** `docs/product-vision/ui/hebun-design-system-foundation.md`. No app source, Tailwind, or CSS modified. No commit, tag, or push.

---

**DOCUMENT STATUS: DESIGN SYSTEM DOCUMENTATION ONLY — NO IMPLEMENTATION**
