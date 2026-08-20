/*
 * FOCUSED HEBY MODE — PRESENTATION ARCHITECTURE, AND NOTHING ELSE.
 *
 * The change under proof gives Heby's own surface the room the approved reference depicts, by
 * standing the shell's workspace navigation down while the operator is on it. That is a claim about
 * LAYOUT. It must therefore be provable that it is ONLY a claim about layout:
 *
 *   - the mode is derived from the route, through the released surface model, and from nothing else,
 *   - it is never persisted, and it never overwrites the operator's own navigation preference,
 *   - it mounts and unmounts no navigation, and it keeps the top bar,
 *   - it does not exist below `lg`, where the shell navigates by drawer and sheet,
 *   - the way back to the navigation is always on screen,
 *   - the presence field is bounded by the room it actually has, on BOTH axes,
 *   - and the contextual rail's new adaptive default still tells the truth about the read — an
 *     unavailable read is never collapsed into the same silence an empty one gets.
 *
 * No new authority, no new read, no new writer, no schema. Those are swept here too.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveHebyFocusMode } from "../../src/components/layout/heby/heby-focus-mode";
import {
  toStreamItems,
  type HebyStreamState,
  type PendingRequestRow,
} from "../../src/features/heby-stream/activity-stream";
import { HebyWorkspace, type HebyWorkspaceProps } from "../../src/components/layout/heby/heby-workspace";
import { HebyStreamRailStrip } from "../../src/components/layout/heby/heby-stream-rail";

const read = (path: string) => readFileSync(path, "utf8");
const codeOf = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const textOf = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const FOCUS = "src/components/layout/heby/heby-focus-mode.tsx";
const SHELL = "src/components/layout/hebun-shell.tsx";
const TOPBAR = "src/components/layout/topbar.tsx";
const RAIL_NAV = "src/components/layout/workspace-rail.tsx";
const SECONDARY = "src/components/layout/secondary-nav.tsx";
const TOGGLE = "src/components/layout/secondary-toggle.tsx";
const CANVAS = "src/components/layout/heby/heby-workspace.tsx";
const VISUALIZER = "src/components/layout/heby/heby-visualizer.tsx";
const CSS = "src/app/globals.css";

const NOOP = () => {};

function renderCanvas(overrides: Partial<HebyWorkspaceProps>): string {
  const props: HebyWorkspaceProps = {
    contextLabel: "Operations",
    authorityLabel: "Advisory only",
    turns: [],
    pending: null,
    asking: false,
    busy: false,
    presence: "idle",
    notice: null,
    commandOutput: null,
    facts: {},
    composerValue: "",
    suggestions: [],
    paletteItems: [],
    paletteIndex: 0,
    returnLabel: "Command",
    onClose: NOOP,
    onComposerChange: NOOP,
    onSubmit: NOOP,
    onNewConversation: NOOP,
    onSuggestion: NOOP,
    onPaletteMove: NOOP,
    onPaletteSelect: NOOP,
    onPaletteClose: NOOP,
    onDismissCommandOutput: NOOP,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(HebyWorkspace, props));
}

const ROW: PendingRequestRow = {
  requestId: "req-1",
  actionKind: "send-external-communication",
  targetLabel: "Acme Ltd — accounts",
  targetRef: "recipient-9",
  expectedEffect: "Would send one message to the recorded address.",
  proposedAt: "2026-08-19T17:05:41.000Z",
};

/** The `@media (min-width: 1024px)` blocks of the stylesheet, and everything outside them. */
function splitByDesktopMedia(css: string): { inside: string; outside: string } {
  let inside = "";
  let outside = "";
  let cursor = 0;
  const marker = "@media (min-width: 1024px) {";
  for (;;) {
    const start = css.indexOf(marker, cursor);
    if (start < 0) {
      outside += css.slice(cursor);
      return { inside, outside };
    }
    outside += css.slice(cursor, start);
    /* Walk the braces so a nested rule cannot end the block early. */
    let depth = 0;
    let index = start + marker.length - 1;
    for (; index < css.length; index += 1) {
      if (css[index] === "{") depth += 1;
      else if (css[index] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    inside += css.slice(start, index + 1);
    cursor = index + 1;
  }
}

function main(): void {
  /* ═══════════════════════════════════════════════════════════════════════════
   * 1. THE MODE IS ROUTE-DERIVED, THROUGH THE RELEASED SURFACE MODEL.
   *
   * Focused mode invents no notion of "where the operator is". It reads the one surface value the
   * shipped model already derives from the route, so a surface that is not Heby's full workspace
   * cannot produce it — including the Quick Panel, which is Heby on someone else's workspace and
   * must leave that workspace's navigation exactly where it was.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    assert.equal(resolveHebyFocusMode({ surface: "full-workspace", restored: false }), "focused");
    assert.equal(resolveHebyFocusMode({ surface: "full-workspace", restored: true }), "restored");
    for (const surface of ["closed", "quick-panel"] as const) {
      assert.equal(
        resolveHebyFocusMode({ surface, restored: false }),
        "unavailable",
        `${surface} is not Heby's own surface, so focused mode is not even available`,
      );
      assert.equal(
        resolveHebyFocusMode({ surface, restored: true }),
        "unavailable",
        `${surface}: a restore request cannot conjure the mode either`,
      );
    }

    /* The rule takes no other input, and can reach for none. */
    const focus = codeOf(read(FOCUS));
    for (const banned of [
      "usePathname",
      "useRouter",
      '"/heby"',
      "Date",
      "Math.random",
      "matchMedia",
      "innerWidth",
      "fetch(",
    ]) {
      assert.ok(!focus.includes(banned), `focused mode must not reach for "${banned}"`);
    }
    assert.ok(focus.includes("useHebySurface"), "it derives the mode from the released surface model");
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 2. IT IS NEVER PERSISTED, AND IT NEVER TOUCHES THE OPERATOR'S OWN PREFERENCE.
   *
   * Two different facts. The first: focused mode is a property of WHERE THE OPERATOR IS, so a
   * stored copy could contradict the route it is derived from. The second: the shell already has a
   * persisted secondary-navigation preference, and focused mode overrides its WIDTH while Heby is
   * on screen without ever writing to it — which is the whole reason leaving Heby restores it.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const focus = codeOf(read(FOCUS));
    for (const store of [
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "indexedDB",
      "hebun.secondary.collapsed",
      "dataset.secondary",
      'data-secondary',
    ]) {
      assert.ok(!focus.includes(store), `focused mode must have no representation for "${store}"`);
    }

    /* The operator's preference and its storage key are exactly where they were. */
    const toggle = read(TOGGLE);
    assert.ok(toggle.includes('const STORAGE_KEY = "hebun.secondary.collapsed"'), "the preference key is unchanged");
    assert.ok(toggle.includes("window.localStorage.setItem(STORAGE_KEY"), "and it is still the only writer of it");
    assert.ok(
      (read(FOCUS) + read(SHELL) + read(TOPBAR) + read(CSS)).split("hebun.secondary.collapsed").length - 1 === 0,
      "nothing this change touched writes or reads that key",
    );

    /* Two attributes, two owners: the mode's own attribute is not the preference's. */
    assert.ok(focus.includes('FOCUS_ATTRIBUTE = "hebyFocus"'), "the mode owns one root attribute");
    const css = read(CSS);
    const focusRules = css.slice(css.indexOf('[data-heby-focus="on"]'));
    assert.ok(!/data-heby-focus="on"[^{]*\{[^}]*data-secondary/.test(focusRules),
      "no focused-mode rule writes or depends on the persisted preference's attribute");
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 3. DESKTOP ONLY. BELOW `lg` THE MODE DOES NOT EXIST.
   *
   * Not "is hidden": every declaration is inside the one desktop media block, so at a phone or
   * tablet width there is no rule to apply. The mobile sheet and the tablet drawer are untouched.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const { inside, outside } = splitByDesktopMedia(read(CSS));
    assert.ok(inside.includes('[data-heby-focus="on"]'), "the mode's rules live in the desktop block");
    assert.ok(!outside.includes("data-heby-focus"), "and NOWHERE else in the stylesheet");

    /* Both controls that operate it are desktop-only too. */
    assert.ok(read(FOCUS).includes("lg:flex"), "the control is desktop-only, like the mode");
    assert.ok(codeOf(read(FOCUS)).includes("hidden size-10"), "and is not merely small on mobile — it is absent");
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 4. THE TOP BAR REMAINS, AND SO DOES EVERY NAVIGATION COMPONENT.
   *
   * There is no second shell. The shell renders the rail, the secondary column and the top bar
   * UNCONDITIONALLY — none of the three is behind a mode test — and focused mode is expressed only
   * as width and visibility. A mode that unmounted navigation would make the shell's structure a
   * function of the route, and would take the way back with it.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const shell = codeOf(read(SHELL));
    for (const component of ["<WorkspaceRail />", "<SecondaryNav />", "<TopBar />"]) {
      assert.ok(shell.includes(component), `${component} is rendered`);
      /* Unconditionally: no ternary, no `&&`, no mode test on the line that renders it. */
      const line = shell.split("\n").find((candidate) => candidate.includes(component)) ?? "";
      assert.ok(!/[?&]{1,2}/.test(line.replace(component, "")), `${component} is rendered unconditionally`);
    }
    /*
     * And focused mode cannot reach any of them. Asserted against the CODE, not the file: the file's
     * own prose names both components while explaining that it never touches them, and a guard that
     * a truthful comment can trip is a guard that punishes documentation.
     */
    const focus = codeOf(read(FOCUS));
    for (const name of ["WorkspaceRail", "SecondaryNav", "TopBar", "SecondaryNavContent", "MobileNav"]) {
      assert.ok(!focus.includes(name), `focused mode must not reach "${name}"`);
    }

    /*
     * The stylesheet's focused block may only move things. It may not remove the top bar, and it
     * may not remove the rail — the rail is the minimal identity and navigation strip the mode
     * keeps, and every workspace stays one click away inside it.
     */
    const { inside } = splitByDesktopMedia(read(CSS));
    const focusBlock = inside.slice(inside.indexOf('[data-heby-focus="on"]'));

    /*
     * THE CHROME RECEDES; IT IS NEVER TAKEN AWAY.
     *
     * Focused mode is allowed to restyle the top bar and the rail — that is how the reference's
     * single continuous field is reached with one shell instead of two. It is not allowed to remove
     * them, shrink them out of existence, or make them unreachable. So every rule that targets
     * either element is read, and the properties that would amount to a removal are forbidden
     * outright. A future edit that hides the top bar has to defeat this, not merely avoid a word.
     */
    /*
     * Each entry is [selector, body]. The body alone is not enough: the exception below is written
     * against the SELECTOR, and matching it against a body would silently never fire — the mistake
     * this repository has now made twice with window-scoped assertions.
     */
    const rulesFor = (handle: string): readonly (readonly [string, string])[] =>
      focusBlock
        .split("}")
        .filter((chunk) => chunk.includes(`[data-shell="${handle}"]`) && chunk.includes("{"))
        .map((chunk) => [chunk.slice(0, chunk.indexOf("{")), chunk.slice(chunk.indexOf("{") + 1)] as const);

    const topbarRules = rulesFor("topbar");
    assert.ok(topbarRules.length > 0, "focused mode does restyle the top bar");
    for (const [, body] of topbarRules) {
      for (const removal of ["display:", "visibility:", "height:", "position:", "transform:"]) {
        assert.ok(!body.includes(removal), `focused mode may not "${removal}" the top bar`);
      }
      assert.ok(!/opacity:\s*0/.test(body), "and may not fade it out of existence");
    }

    /* The rail is narrowed by a width variable; only its LABELS may be display:none. */
    const railRules = rulesFor("rail");
    assert.ok(railRules.length > 0, "focused mode does restyle the rail");
    for (const [selector, body] of railRules) {
      if (selector.includes("data-rail-label")) continue;
      assert.ok(!body.includes("display:"), "the rail itself is narrowed, never removed");
      assert.ok(!/opacity:\s*0/.test(body), "and never faded out of existence");
    }
    assert.ok(
      /\[data-shell="rail"\] \[data-rail-label\]\s*\{\s*display:\s*none/.test(focusBlock),
      "only the rail's labels are dropped",
    );

    /* And the chrome that recedes stays NEUTRAL — the amber belongs to the Heby surface alone. */
    for (const amber of ["#f0b445", "#e0a137", "240, 180, 69"]) {
      assert.ok(!focusBlock.includes(amber), `${amber} must not reach the shell's chrome`);
    }
    assert.ok(focusBlock.includes("--rail-w: 56px"), "the rail becomes a minimal strip");
    assert.ok(focusBlock.includes("--secondary-w: 0px"), "and the secondary column collapses to zero width");
    assert.ok(
      /\[data-shell="secondary"\]\s*\{\s*display:\s*none/.test(focusBlock),
      "the collapsed column leaves the layout exactly as the released collapse does",
    );

    /*
     * AND THE MODE IS CONSUMED BY THE STYLESHEET ALONE.
     *
     * This is the assertion that makes "no navigation is unmounted" structural rather than a
     * reading of today's shell. A navigation component that could see the mode could return null
     * for it — the layout is then a function of the route, the way back can vanish with it, and no
     * amount of care in the shell would prevent the next edit from doing exactly that. So no
     * navigation component may read the attribute, the hook, or the mode in any form.
     */
    for (const navigation of [
      RAIL_NAV,
      SECONDARY,
      TOGGLE,
      "src/components/layout/mobile-nav.tsx",
      "src/components/layout/tablet-sections.tsx",
      "src/components/layout/sidebar-nav.tsx",
    ]) {
      const code = codeOf(read(navigation));
      for (const handle of ["hebyFocus", "data-heby-focus", "useHebyFocus", "HebyFocusControl"]) {
        assert.ok(
          !code.includes(handle),
          `${navigation} must not read the mode ("${handle}") — a navigation that can see it can unmount for it`,
        );
      }
    }

    /* The handles the stylesheet needs are on the components, and the labels are what is dropped. */
    assert.ok(read(RAIL_NAV).includes('data-shell="rail"'), "the rail carries the stylesheet's handle");
    assert.ok(read(RAIL_NAV).includes("data-rail-label"), "and its labels are addressable");
    assert.ok(read(SECONDARY).includes('data-shell="secondary"'), "the secondary column keeps its released handle");
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 5. THE WAY BACK IS ALWAYS ON SCREEN, AND THERE IS EXACTLY ONE OF IT.
   *
   * A mode that hides navigation must never also hide the control that brings it back. The control
   * lives in the top bar — which focused mode keeps — announces its state rather than relying on
   * an icon, and REPLACES the generic secondary toggle while the operator is on Heby, so two
   * controls can never disagree about whether the navigation is showing.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const focus = read(FOCUS);
    assert.ok(focus.includes("export function HebyFocusControl"), "the restore control exists");
    assert.ok(focus.includes("data-heby-focus-control"), "and is addressable");
    assert.ok(focus.includes('aria-label={focused ? "Show workspace navigation"'), "it names what it does");
    assert.ok(focus.includes("aria-pressed={focused}"), "and announces its state, not colour-only");
    assert.ok(focus.includes("onClick={toggle}"), "it toggles the mode");
    /* It restores presentation and nothing else: it navigates nowhere and writes nothing. */
    const control = focus.slice(focus.indexOf("export function HebyFocusControl"));
    for (const banned of ["router", "href", "push(", "localStorage", "onClose"]) {
      assert.ok(!control.includes(banned), `the restore control must not "${banned}"`);
    }
    /* It is rendered whenever the mode is available — including after the navigation is restored. */
    assert.ok(control.includes("if (!eligible) return null"), "absent only where the mode itself is unavailable");

    /*
     * EXACTLY ONE CONTROL IS PRESENTED, AND THE OTHER IS HIDDEN RATHER THAN UNMOUNTED.
     *
     * This is a correction the authenticated pass forced. The generic secondary toggle is what
     * APPLIES the operator's stored preference to the document on mount; unmounting it on Heby
     * meant that restoring the navigation there showed an expanded column to an operator whose
     * saved preference was collapsed. The stored value was never written — it simply stopped being
     * applied, which is a different way to lose a preference and just as real.
     */
    const topbar = codeOf(read(TOPBAR));
    assert.ok(
      /className=\{hebyFocusEligible \? "hidden" : "contents"\}>\s*<SecondaryToggle \/>/.test(topbar),
      "the generic toggle stays mounted on every route and is hidden while Heby owns the decision",
    );
    assert.ok(topbar.includes("<HebyFocusControl />"), "and the focus control is the one presented there");
    assert.ok(
      !/\{hebyFocusEligible \? <HebyFocusControl \/> : <SecondaryToggle \/>\}/.test(topbar),
      "the toggle is never swapped out — unmounting it stops the stored preference being applied",
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 6. THE PRESENCE IS BOUNDED BY THE ROOM IT ACTUALLY HAS — ON BOTH AXES.
   *
   * This is the correction focused mode forced. A viewport-height ceiling was true about the WINDOW
   * and silent about the width, which inside the shell is the window minus the rail, minus the
   * secondary column, minus the contextual rail — every one of which focused mode moves. A single
   * axis bound is therefore not a smaller version of this proof; it is a different, weaker claim.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const visualizer = read(VISUALIZER);
    const css = read(CSS);
    const canvas = read(CANVAS);

    const dual = /xl:size-\[min\((\d+)rem,(\d+)cqh,(\d+)cqw\)\]/.exec(visualizer);
    assert.ok(dual, "the hero ceiling must bound BOTH axes of its container");
    const [expression, cap, tall, wide] = dual!;
    /* Substantial enough to be the presence the reference depicts… */
    assert.ok(Number(cap) >= 30, `the absolute cap is substantial (got ${cap}rem)`);
    assert.ok(Number(tall) >= 45, `the height share is substantial (got ${tall}cqh)`);
    assert.ok(Number(wide) >= 24, `the width share is substantial (got ${wide}cqw)`);
    /* …and bounded enough that the caption, the dock and the peripheral labels keep their room. */
    assert.ok(Number(tall) <= 70, `the height share cannot overflow the hero region (got ${tall}cqh)`);
    assert.ok(Number(wide) <= 40, `the width share leaves the peripheral labels their columns (got ${wide}cqw)`);
    assert.ok(Number(cap) <= 40, `the absolute cap stays inside a real hero region (got ${cap}rem)`);

    /*
     * AND THE HERO RESERVES THE FIELD'S BLEED, AS A FRACTION OF THAT SAME BOUND.
     *
     * The presence bleeds decorative light past its own box; the browser counts it as scrollable
     * overflow, so a hero that does not reserve it scrolls. A FIXED reserve was measured to work at
     * 1512x900 and to leave 30px of phantom scroll at 1920x1080, because the bleed scales with the
     * presence (0.177 of it, measured twice).
     *
     * THE TWO COPIES OF THE BOUND ARE PINNED TO EACH OTHER HERE. They should be one custom
     * property, and they were — the build pipeline silently drops a custom property whose value is
     * a `min()` of mixed absolute and container units, which made the presence fall back to its
     * `lg` step in the real product while every test still passed. So the duplication is deliberate
     * and this assertion is what keeps it honest.
     */
    const inner = expression.slice(expression.indexOf("min("), expression.length - 1);
    const reserve = new RegExp(`pb-\\[max\\(2rem,calc\\(([\\d.]+)\\*${inner.replace(/[()]/g, (c) => "\\" + c)}\\)\\)\\]`);
    const factor = reserve.exec(canvas);
    assert.ok(factor, `the hero reserves the bleed using the SAME bound (looking for ${inner})`);
    assert.ok(Number(factor![1]) >= 0.18, `and a factor that covers the measured bleed (got ${factor![1]})`);

    /*
     * AND THE THING THAT MUST NOT COME BACK: a clip. Clipping the bleed instead of reserving it
     * drew a visible soft-edged rectangle around the presence in the authenticated product — a clip
     * box on a glow is a box.
     */
    assert.ok(!/overflow-clip/.test(canvas), "the presence's bleed is reserved, never clipped");

    assert.ok(css.includes(".heby-hero-room {"), "the hero's room is a declared query container");
    assert.ok(/\.heby-hero-room\s*\{[^}]*container-type:\s*size/.test(css),
      "the hero's room is a query container on BOTH axes");
    assert.ok(canvas.includes("heby-hero-room"), "and the canvas establishes it");
    assert.ok(visualizer.includes("lg:size-72"), "the released lower steps are unchanged");
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 7. "HEBUN AKIŞI" KEEPS THE REFERENCE'S SHAPE AND THE READ'S TRUTH.
   *
   * The reference composition needs the column present for the canvas to read as one space, so the
   * rail opens by default on every read. What differs between reads is what it SAYS:
   *
   *   items        the records, each with its own words and its own instant.
   *   empty        the sentence that the queue is clear — never a placeholder row, never a filled
   *                in example, and never one of the five entry types the reference depicts.
   *   unavailable  the sentence that the read failed, naming its reason.
   *   absent       no rail at all — the surface was never given a stream.
   *
   * And the distinction survives being put away: the collapsed strip still refuses to present a
   * failed read as an empty one.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    /* ITEMS — open, with the record showing, and with the reference's spine and markers. */
    const items = renderCanvas({ stream: { status: "items", items: toStreamItems([ROW]) } });
    assert.ok(items.includes("data-heby-rail-hide"), "a queue with records opens");
    assert.ok(items.includes("Acme Ltd — accounts"), "and shows them");
    assert.ok(items.includes("Would send one message to the recorded address."), "with the row's own detail");
    assert.ok(items.includes("2026-08-19 17:05 UTC"), "and the row's own instant, copied not computed");

    /* EMPTY — the same frame, the read's own answer inside it. */
    const empty = renderCanvas({ stream: { status: "empty" } });
    assert.ok(empty.includes("data-heby-rail-hide"), "an empty read keeps the column");
    assert.ok(empty.includes("Hebun Akışı"), "and the rail's identity");
    assert.ok(empty.includes("data-heby-stream-empty"), "and says the queue is clear");
    /* It may never acquire a row, a marker or a type it did not read. */
    for (const fabricated of ["awaiting a decision", "data-heby-stream-item"]) {
      assert.ok(!empty.includes(fabricated), `an empty read renders no row shape ("${fabricated}")`);
    }

    /* UNAVAILABLE — the same frame again, and a different sentence. */
    const unavailable = renderCanvas({
      stream: { status: "unavailable", reason: "persistence-not-configured" },
    });
    assert.ok(unavailable.includes("data-heby-stream-unavailable"), "a failed read says so");
    assert.ok(unavailable.includes("persistence-not-configured"), "and names its reason");
    assert.notEqual(
      textOf(empty).trim(),
      textOf(unavailable).trim(),
      "an empty read and a failed one may never share a sentence",
    );

    /* AND THE DISTINCTION SURVIVES COLLAPSING. This is the part the default cannot carry. */
    const strip = (stream: HebyStreamState) =>
      renderToStaticMarkup(createElement(HebyStreamRailStrip, { stream, onShow: NOOP }));
    const collapsedEmpty = strip({ status: "empty" });
    const collapsedUnavailable = strip({ status: "unavailable", reason: "persistence-not-configured" });
    assert.ok(collapsedEmpty.includes('data-heby-rail-collapsed="empty"'), "the collapsed strip states its read");
    assert.ok(!collapsedEmpty.includes("data-heby-rail-unavailable"), "an empty read is not marked as a failure");
    assert.ok(collapsedUnavailable.includes("data-heby-rail-unavailable"), "a failed read is marked while collapsed");
    assert.ok(
      textOf(collapsedUnavailable).includes("Could not be read"),
      "in WORDS — a reader must be able to see the failure, not infer it from an icon",
    );
    assert.ok(
      collapsedUnavailable.includes('aria-label="Show Hebun Akışı — it could not be read"'),
      "and the control carries the same fact for assistive technology",
    );
    assert.notEqual(
      textOf(collapsedEmpty.slice(collapsedEmpty.indexOf("data-heby-rail-show"))),
      textOf(collapsedUnavailable.slice(collapsedUnavailable.indexOf("data-heby-rail-show"))),
      "an unavailable read and an empty one may never collapse into the same silence",
    );

    /* ABSENT stays absent: a surface never given a stream renders no rail and no strip. */
    const absent = renderCanvas({});
    assert.ok(!absent.includes("data-heby-rail-show"), "no stream, no strip");
    assert.ok(!absent.includes("Hebun Akışı"), "no stream, no rail");

    /* Collapsing and expanding remain a WIDTH. No state of the rail marks, reads or resolves a row. */
    const canvas = codeOf(read(CANVAS));
    const railBlock = canvas.slice(canvas.indexOf("data-heby-rail-hide"), canvas.indexOf("</div>", canvas.indexOf("data-heby-rail-unavailable")));
    for (const act of ["acknowledge", "markSeen", "dismissRecord", "resolve", "onClose"]) {
      assert.ok(!railBlock.includes(act), `operating the rail must not "${act}"`);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 8. NO NEW TRUTH. The mode reads nothing, writes nothing, and reaches no provider.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    for (const file of [FOCUS, SHELL, TOPBAR, RAIL_NAV]) {
      const code = codeOf(read(file));
      for (const banned of [
        ".insert(",
        ".update(",
        ".delete(",
        "transaction(",
        "drizzle-orm",
        "@/db/",
        ".server",
        "resolveTenant",
        "askHebyAction",
        "generateHebyModelAnswer",
        "anthropic",
        "ANTHROPIC",
        "computer-use",
        "live-map",
      ]) {
        assert.ok(!code.includes(banned), `${file} must have no representation for "${banned}"`);
      }
    }

    /* ZERO SCHEMA. This is a layout change; it may not appear in the migration ledger at all. */
    const journal = read("src/db/migrations/meta/_journal.json");
    assert.ok(!/focus/i.test(journal), "focused mode added no migration");
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 9. THE SPATIAL FIELD IS ATMOSPHERE, AND IT CANNOT BECOME TELEMETRY.
   *
   * The reference's composition is an origin, a sequence of ascending points and a particle
   * landscape. Each is a real layer on the canvas — and each is exactly as data-free as the three
   * G7 already shipped. This is the line the whole visual pass had to hold: a ridge that moved or a
   * point that lit up would be read as something happening in the organization, and nothing here
   * would be reporting anything.
   *
   * The reference's large concentric arcs were built and then REMOVED at the Director's direction —
   * behind the presence they read as a radar sweep, and Heby has nothing to sweep. The assertion
   * below keeps them gone, and keeps the removal from taking the presence's OWN orbital traces with
   * it: those belong to the released presence field and are a different thing entirely.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const html = renderCanvas({});
    const css = read(CSS);
    const canvas = read(CANVAS);

    for (const layer of ["heby-origin", "heby-ascent"]) {
      assert.ok(html.includes(layer), `${layer} is rendered`);
      assert.ok(html.includes(`${layer} pointer-events-none`), `${layer} never takes the pointer`);
      const at = html.indexOf(layer);
      assert.ok(
        html.slice(at - 260, at + 120).includes('aria-hidden="true"'),
        `${layer} is hidden from assistive technology`,
      );

      /* STILL. Not one of them may animate, transition, or move on a clock. */
      const start = css.indexOf(`.${layer} {`);
      assert.ok(start > 0, `${layer} has a rule`);
      const rule = css.slice(start, css.indexOf("}", start));
      assert.ok(!/animation|transition/.test(rule), `${layer} never animates`);

      /* And nothing in the canvas passes it a value. */
      const usage = canvas.slice(canvas.indexOf(`${layer} pointer-events-none`) - 200, canvas.indexOf(`${layer} pointer-events-none`) + 200);
      assert.ok(!usage.includes("${"), `no value is interpolated into ${layer}`);
      assert.ok(!/props\./.test(usage), `${layer} reads no prop`);
    }

    /* The removed layer stays removed — no element, no rule, no token. */
    for (const gone of ["heby-arcs", "--heby-arc:"]) {
      assert.ok(!html.includes(gone), `the radar-like arcs must not return to the canvas ("${gone}")`);
      assert.ok(!css.includes(gone), `nor to the stylesheet ("${gone}")`);
    }
    /* And the presence's own orbital traces — a different thing — are still there. */
    assert.ok(
      /heby-orbit/.test(read("src/components/layout/heby/heby-visualizer.tsx")),
      "the presence keeps its own orbital traces",
    );

    /*
     * THE INTERACTION NODE MAKES NO CLAIM ABOUT THE OPERATOR OR THE ORGANIZATION.
     *
     * The reference labels its node as Heby sensing you and revealing the conversation when you
     * need it. Nothing in this product knows that. What is real is the released dock rule, so the
     * node is rendered in exactly the state that rule describes and its words describe the
     * mechanism — never an awareness, an intent, a need, or a noticing.
     */
    const resting = renderCanvas({});
    assert.ok(resting.includes("data-heby-interaction-node"), "the node is rendered on the resting canvas");
    assert.ok(resting.includes("data-heby-dock-hint"), "and the invitation is still stated in words");
    /* It is gone the moment the operator is engaged — it is the resting affordance, nothing more. */
    assert.ok(
      !renderCanvas({ composerValue: "x" }).includes("data-heby-interaction-node"),
      "an engaged operator is not told how to engage",
    );
    for (const claim of [
      "senses",
      "sensing",
      "notices",
      "noticed",
      "aware",
      "needs you",
      "when you need",
      "detected",
      "watching",
      "listening for",
    ]) {
      assert.ok(
        !new RegExp(claim, "i").test(textOf(resting)),
        `the canvas must not claim "${claim}" — no read seam supports it`,
      );
    }
  }

  console.log("focused heby mode checks passed");
}

main();
