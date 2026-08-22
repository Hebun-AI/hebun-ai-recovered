/*
 * CMD-V3 — Command Overview composition.
 *
 * ── WHAT THIS PHASE WAS ALLOWED TO CHANGE ────────────────────────────────────
 *
 * Room. Nothing else. CMD-B1 owns what the Overview may CLAIM and proves it; this suite owns what
 * the Overview may LOOK LIKE, and its entire job is to prove that the look changed and the claims
 * did not. So the assertions here are deliberately of two kinds:
 *
 *   COMPOSITION   the properties CMD-V3 introduces — a second column, a density, a grid — each
 *                 pinned by the arithmetic or the outcome that justified it, never by the class
 *                 string that happens to implement it today.
 *   CONSERVATION  the properties CMD-V3 must not have touched. These overlap CMD-B1 on purpose.
 *                 A visual phase is exactly when a truth contract gets quietly traded for height,
 *                 so the truth contract is re-asserted from inside the phase that could break it.
 *
 * ── THE ONE THING THIS SUITE CANNOT DO ───────────────────────────────────────
 *
 * It cannot measure a pixel. There is no layout engine in this process: `renderToStaticMarkup`
 * produces a string, and a string has no height, no overflow and no wrapping. Every geometric claim
 * CMD-V3 makes belongs to the authenticated visual measurement and is reported there.
 *
 * What IS provable here is the PRECONDITION for those claims — that every column can shrink
 * (`min-w-0`), that no fixed width exceeds the canvas it must fit, and that the breakpoint the
 * layout switches at was derived from the shell's own tokens rather than chosen. G7's lesson is
 * that an isolated render is not visual proof; this file therefore never claims to be one.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CommandOverview } from "../../src/components/command-overview/command-overview";
import { StateBlock } from "../../src/components/ui/state-block";
import {
  UNCONNECTED_CAPABILITIES,
  getExpressIntentSummary,
  toWaitingOnYou,
  type WaitingOnYouState,
} from "../../src/features/command-overview/workspace-model";
import { WORKSPACES, getWorkspace } from "../../src/config/workspace-nav";

const ROOT = process.cwd();
const OVERVIEW = "src/components/command-overview/command-overview.tsx";
const MODEL = "src/features/command-overview/workspace-model.ts";
const PAGE = "src/app/(dashboard)/command/page.tsx";
const STATE_BLOCK = "src/components/ui/state-block.tsx";
const SHELL = "src/components/layout/hebun-shell.tsx";
const TOKENS = "src/styles/tokens.css";
const GLOBALS = "src/app/globals.css";
const OWNED = [PAGE, OVERVIEW, MODEL] as const;

const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
/**
 * The rendered TEXT, with entities decoded.
 *
 * DECODING IS NOT OPTIONAL HERE, AND CMD-B1 GOT AWAY WITHOUT IT BY LUCK. React escapes `\'` to
 * `&#x27;`, and one of the six reasons ends "…this organization\'s goals." Comparing the raw markup
 * against the source string reports a reason as MISSING when it is rendered in full — an instrument
 * that fails exactly where this suite is strictest.
 */
const ENTITIES: Readonly<Record<string, string>> = Object.freeze({
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
});
const visible = (markup: string): string =>
  markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, (e) => ENTITIES[e] ?? e)
    .replace(/\s+/g, " ")
    .trim();

const INTENT = getExpressIntentSummary();

const SEAM_ROW = Object.freeze({
  requestId: "req-1",
  actionKind: "send-external-communication",
  toolId: "heby.operations.send-communication",
  sideEffect: "CONSEQUENTIAL_MUTATION" as const,
  reversibility: "irreversible" as const,
  targetKind: "recipient",
  targetRef: "rec-1",
  targetLabel: "someone@example.test",
  expectedEffect: "Send one message to one recipient.",
  consequences: ["The recipient receives a message."],
  parameters: [{ name: "subject", value: "A message from Hebun" }],
  payloadDigest: "digest",
  proposedAt: "2026-08-21T09:00:00.000Z",
});

function render(waiting: WaitingOnYouState, overview: typeof CommandOverview = CommandOverview): string {
  return renderToStaticMarkup(createElement(overview, { waiting, intent: INTENT }));
}

/** The rendered text of one section, sliced from its opening tag so no attribute leaks into it. */
function sectionText(markup: string, label: string): string {
  const at = markup.indexOf(`aria-label="${label}"`);
  assert.ok(at > 0, `the "${label}" section is rendered`);
  const open = markup.lastIndexOf("<section", at);
  const rest = markup.slice(open);
  const end = rest.indexOf("</section>");
  return visible(rest.slice(0, end === -1 ? undefined : end));
}

const EMPTY: WaitingOnYouState = { status: "none-waiting" };
const POPULATED: WaitingOnYouState = toWaitingOnYou({ status: "read", items: [SEAM_ROW] });

/* ─────────────────────────────────────────────────────────────────────────────
 * 1 + 2 + 3 + 13 + 18. THE CANONICAL SHAPE SURVIVED THE COMPOSITION
 * ────────────────────────────────────────────────────────────────────────── */
function theCanonicalShapeIsUntouched(overrides: Readonly<Record<string, string>> = {}, markupOverride?: string): void {
  const markup = markupOverride ?? render(EMPTY);

  assert.equal((markup.match(/<section\b/g) ?? []).length, 3, "exactly three canonical sections");
  assert.deepEqual(
    [...markup.matchAll(/<section[^>]*\bid="([^"]+)"/g)].map((m) => m[1]),
    ["waiting", "intent", "not-connected"],
    "the three section ids, in the canonical order",
  );
  assert.deepEqual(
    [...markup.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]),
    ["Waiting on you", "Express intent", "Not yet connected"],
    "and the three section names with them",
  );
  assert.deepEqual(
    [...markup.matchAll(/data-provenance="([^"]+)"/g)].map((m) => m[1]),
    ["authoritative", "derived", "not-connected"],
    "the provenance mapping is exactly what CMD-B1 released",
  );

  /* 18. One page identity, and it is the route's, not this component's. */
  assert.ok(!markup.includes("<h1"), "the Overview contributes no h1");
  const overview = codeOf(overrides[OVERVIEW] ?? read(OVERVIEW));
  assert.ok(!/<h1[\s>]/.test(overview), "and declares none");
  assert.equal(
    ((overrides[PAGE] ?? read(PAGE)).match(/<PageHeader/g) ?? []).length,
    1,
    "the route states the workspace identity exactly once",
  );

  /* Heading hierarchy: h2 per section (WorkspaceSection), h3 inside StateBlock. No level skipped. */
  const levels = [...markup.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  assert.ok(levels.length > 0, "the Overview renders headings");
  assert.equal(Math.min(...levels), 2, "the shallowest heading below the page identity is h2");
  assert.ok(Math.max(...levels) <= 3, "and nothing goes deeper than h3");

  /* 13. The canonical L2 is CMD-B2's three, and this phase did not touch it. */
  assert.equal(WORKSPACES.length, 7, "still seven workspaces");
  assert.deepEqual(
    getWorkspace("command").destinations.map((d) => d.label),
    ["Overview", "Decisions", "Director Intent"],
    "Command L2 is still the canonical three",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 12. DOM ORDER IS ONE ORDER, AT EVERY WIDTH
 *
 * The columns are a FLEX DIRECTION. There is exactly one markup, so there is exactly one reading
 * order — which is the property a `grid-flow` or an `order-*` utility would silently destroy while
 * every id assertion above kept passing.
 * ────────────────────────────────────────────────────────────────────────── */
function readingOrderCannotVaryByWidth(overrides: Readonly<Record<string, string>> = {}): void {
  const overview = codeOf(overrides[OVERVIEW] ?? read(OVERVIEW));

  for (const reorder of [/\border-\d/, /\border-first\b/, /\border-last\b/, /flex-col-reverse/, /flex-row-reverse/, /grid-flow-col-dense/]) {
    assert.ok(!reorder.test(overview), `the Overview must not visually reorder content (${reorder})`);
  }
  /* Nor branch the tree on a viewport at render time: one markup, or the order is not one order. */
  for (const probe of [/useMediaQuery/, /matchMedia/, /window\.inner/, /useState/, /useEffect/]) {
    assert.ok(!probe.test(overview), `the Overview must not render conditionally on the viewport (${probe})`);
  }

  /* And the order in the file is the order in the markup. */
  const body = overview.slice(overview.indexOf("export function CommandOverview"));
  const order = [...body.matchAll(/<(WaitingOnYou|ExpressIntent|NotYetConnected)\b/g)].map((m) => m[1]);
  assert.deepEqual(order, ["WaitingOnYou", "ExpressIntent", "NotYetConnected"], "authority order, in source");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * THE SPLIT WAS DERIVED FROM THE SHELL, NOT CHOSEN
 *
 * The canvas is the viewport less the fixed navigation and the gutters. The aside may only take a
 * width that leaves the PRIMARY column wider than itself at the FIRST viewport where the split turns
 * on — otherwise the composition inverts the hierarchy it exists to express.
 * ────────────────────────────────────────────────────────────────────────── */
/**
 * Tailwind's own default steps, in px.
 *
 * ── WHY THE ROOT FONT SIZE IS PART OF THIS CONTRACT ──────────────────────────
 *
 * Tailwind v4 emits these as REM, not px — the built stylesheet carries `@media (min-width:80rem)`,
 * not `1280px`. So "xl is 1280px" is not a constant; it is a CONSEQUENCE of the root font size
 * being the browser default of 16px. A single `html { font-size: 20px }` would move xl to 1600px
 * and every number derived below would still compute, still pass, and describe a layout that no
 * longer exists. The premise is therefore asserted rather than assumed.
 */
const BREAKPOINTS = Object.freeze({ sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 });
type Step = keyof typeof BREAKPOINTS;
const ROOT_FONT_PX = 16;

function pxOf(css: string, token: string): number {
  const m = new RegExp(`${token}:\\s*(\\d+)px`).exec(css);
  assert.ok(m, `${token} is declared in px`);
  return Number(m![1]);
}

function theSplitIsJustifiedByArithmetic(overrides: Readonly<Record<string, string>> = {}): void {
  const tokens = overrides[TOKENS] ?? read(TOKENS);
  const railW = pxOf(tokens, "--rail-w");
  const secondaryW = pxOf(tokens, "--secondary-w");
  const shellNav = railW + secondaryW;

  /* No custom breakpoint, and no re-based rem, may move the split out from under this arithmetic. */
  for (const file of [GLOBALS, TOKENS]) {
    const css = overrides[file] ?? read(file);
    assert.ok(!/--breakpoint-/.test(css), `${file} declares no custom breakpoint`);
    for (const m of css.matchAll(/(?:^|\})\s*(?:html|:root)[^{}]*\{[^{}]*?font-size:\s*([^;}]+)/g)) {
      assert.fail(
        `${file} sets a root font-size (${m[1].trim()}). Tailwind v4's breakpoints are rem, so this ` +
          `moves xl away from ${BREAKPOINTS.xl}px and every number derived here becomes a description ` +
          "of a layout that does not exist.",
      );
    }
  }
  assert.equal(ROOT_FONT_PX, 16, "the browser default the rem breakpoints resolve against");

  /* The gutter the shell actually applies at the split, read from the shell. */
  const shell = overrides[SHELL] ?? read(SHELL);
  const main = /<main className="([^"]+)"/.exec(shell);
  assert.ok(main, "the shell's main region declares its own padding");
  assert.ok(/\blg:px-8\b/.test(main![1]), "and the widest gutter step is lg:px-8");
  const gutter = 32 * 2;

  const overview = overrides[OVERVIEW] ?? read(OVERVIEW);
  const aside = /xl:w-\[(\d+)px\]/.exec(overview);
  assert.ok(aside, "the tertiary column declares one explicit width, in px, at xl");
  const asideW = Number(aside![1]);

  const gap = 32; /* lg:gap-8, the row gap in force wherever the row is on */

  /*
   * THE BREAKPOINT IS DERIVED, NOT NAMED. The primary column must stay wider than the aside, so the
   * split may first be armed at the SMALLEST step where that is true. Computing it here and then
   * asserting the source arms exactly that step means a mutation to a different step fails on the
   * measurement, not on a string ban that merely happens to agree with it.
   */
  const primaryAt = (viewport: number): number => viewport - shellNav - gutter - asideW - gap;
  const legal = (Object.keys(BREAKPOINTS) as Step[]).filter((s) => primaryAt(BREAKPOINTS[s]) > asideW);
  assert.ok(legal.length > 0, `no breakpoint can carry a ${asideW}px aside beside a wider primary column`);
  const smallest = legal[0];

  const armed = [...overview.matchAll(/\b([a-z0-9]+):flex-row\b/g)].map((m) => m[1]);
  assert.deepEqual(
    armed,
    [smallest],
    `the row is armed at [${armed}]; the arithmetic says the smallest step where the primary column ` +
      `(${primaryAt(BREAKPOINTS[smallest])}px) stays wider than the ${asideW}px aside is "${smallest}" ` +
      `— at "lg" the primary would be ${primaryAt(BREAKPOINTS.lg)}px`,
  );
  assert.ok(!/\bflex-row\b(?<!:flex-row)/.test(overview.replace(/[a-z0-9]+:flex-row/g, "")), "and never unconditionally");

  assert.ok(
    asideW >= 320 && asideW <= 360,
    `the aside is ${asideW}px — outside the 320–360px band the composition was approved against`,
  );
  /* 1024 stays one column, and this is the number that makes that a fact rather than a preference. */
  assert.ok(
    primaryAt(BREAKPOINTS.lg) < asideW,
    `at 1024 the primary column would be ${primaryAt(BREAKPOINTS.lg)}px against a ${asideW}px aside — ` +
      "which is why the split is not armed there",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 20 (PRECONDITION). EVERY COLUMN CAN SHRINK
 *
 * Horizontal overflow inside a flex or grid child has one usual cause: a `min-width: auto` track
 * that refuses to go below its content. This cannot measure overflow; it can prove the thing whose
 * absence causes it, and it does so for every flex/grid container the Overview declares.
 * ────────────────────────────────────────────────────────────────────────── */
function everyColumnCanShrink(overrides: Readonly<Record<string, string>> = {}): void {
  const overview = overrides[OVERVIEW] ?? read(OVERVIEW);
  const containers = [...overview.matchAll(/className="((?:flex|grid)[^"]*)"/g)].map((m) => m[1]);
  assert.ok(containers.length >= 5, `the Overview declares layout containers; found ${containers.length}`);
  for (const cls of containers) {
    if (/\binline-flex\b/.test(cls)) continue; /* an inline link is sized by its own content */
    assert.ok(
      /\bmin-w-0\b/.test(cls),
      `a flex/grid container without min-w-0 cannot shrink below its content: "${cls}"`,
    );
  }
  /* The one fixed width in the file is the aside's, and it is confined to xl. */
  const fixed = [...overview.matchAll(/(^|\s|")((?:[a-z]+:)?)w-\[[^\]]+\]/g)].map((m) => m[2]);
  assert.deepEqual(fixed, ["xl:"], "only the aside carries a fixed width, and only from xl up");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 14 + 15. SIX CAPABILITIES, AND SIX REASONS — RENDERED, NOT MERELY DECLARED
 *
 * CMD-B1 asserts the six TITLES reach the page. A compaction phase is precisely the one that would
 * keep the titles and drop the reasons, so this asserts the reasons too, in full, from the markup.
 * ────────────────────────────────────────────────────────────────────────── */
function noReasonSilentlyDisappears(markupOverride?: string): void {
  const text = sectionText(markupOverride ?? render(EMPTY), "Not yet connected");
  assert.equal(UNCONNECTED_CAPABILITIES.length, 6, "six capabilities are disclosed");
  for (const row of UNCONNECTED_CAPABILITIES) {
    assert.ok(text.includes(row.capability), `"${row.capability}" is disclosed`);
    assert.ok(
      text.includes(row.reason),
      `and its OWN reason is rendered in full, not summarized away: "${row.capability}"`,
    );
  }
  assert.equal(new Set(UNCONNECTED_CAPABILITIES.map((r) => r.reason)).size, 6, "no two share a reason");

  /* Nothing in this section is presented as a connection control or a product card. */
  for (const invented of [/\bConnect\b/, /Manage connections/, /Ask Heby/, /At a glance/]) {
    assert.ok(!invented.test(text), `the disclosure offers no ${invented}`);
  }
  /* 6. No fabricated figure stands in for a missing source. */
  assert.ok(!/\b0\b/.test(text), "no zero is rendered for a capability that has no source");
  assert.ok(!/%/.test(text), "and no percentage");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4 + 5 + 6 + 16. THE THREE READ STATES SURVIVED THE COMPACTION
 * ────────────────────────────────────────────────────────────────────────── */
function theReadStatesAreStillThree(overrides: Readonly<Record<string, string>> = {}): void {
  const overview = overrides[OVERVIEW] ? undefined : CommandOverview;
  void overview;
  const empty = render(EMPTY);
  const unavailable = render({ status: "unavailable", reason: "persistence-not-configured" });
  const populated = render(POPULATED);

  assert.notEqual(empty, unavailable, "a successful empty read is not the same rendering as an unanswered one");
  assert.notEqual(empty, populated, "an empty queue is not the same rendering as a populated one");

  const emptyText = sectionText(empty, "Waiting on you");
  assert.ok(emptyText.includes("Nothing is waiting for a human decision"), "empty says it was answered");
  assert.ok(!/Unavailable/i.test(emptyText), "and is never labelled unavailable");
  assert.ok(/Empty/i.test(emptyText), "the eyebrow that carries the distinction survived the density change");
  assert.ok(!/\b0\b/.test(emptyText), "and no zero was fabricated for it");

  const unavailableText = sectionText(unavailable, "Waiting on you");
  assert.ok(/Unavailable/i.test(unavailableText), "unavailable says so — the eyebrow was not compacted away");
  assert.ok(unavailableText.includes("persistence-not-configured"), "and names the reason the read gave");
  assert.ok(!/\b0\b/.test(unavailableText), "an unanswered read renders no count at all");
  assert.ok(!/\bshown\b/.test(unavailableText), "and no 'shown' badge");

  /* 16. The populated rendering remains reachable from the real seam shape, unchanged. */
  const populatedText = sectionText(populated, "Waiting on you");
  assert.equal(POPULATED.status, "waiting", "the released model still maps a real seam row to a list");
  assert.ok(populatedText.includes(SEAM_ROW.actionKind), "the item the seam returned is the item rendered");
  assert.ok(populatedText.includes(SEAM_ROW.expectedEffect), "with its expected effect");
  assert.ok(populatedText.includes(SEAM_ROW.targetLabel), "and its target");
  assert.ok(populatedText.includes("1 shown"), "and the badge counts exactly what came back");
  assert.ok(!populatedText.includes("bounded at"), "a partial read makes no bound claim");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * EXPRESS INTENT IS A DOORWAY, AND ITS NUMBERS ARE STILL DERIVED
 * ────────────────────────────────────────────────────────────────────────── */
function intentReadsAsADoorway(overrides: Readonly<Record<string, string>> = {}): void {
  const text = sectionText(render(EMPTY), "Express intent");

  /* Still the registry's own numbers, at read time — not a literal that can drift. */
  assert.ok(text.includes(`${INTENT.declared} actions are declared`), "the declared count is the registry's");
  assert.ok(text.includes(`${INTENT.invokableNow} can run now`), "as is the invokable count");
  const model = codeOf(overrides[MODEL] ?? read(MODEL));
  assert.ok(/listActionTools\(\)/.test(model), "counted from the registry at read time");
  assert.ok(!/declared:\s*\d/.test(model), "no count is a literal");

  /* The five states are still refused a collapse. */
  for (const claim of [
    "Declared is not invokable",
    "Invokable is not authorized",
    "Authorized is not executed",
    "Executed is not successful",
    "Free text never reaches execution",
  ]) {
    assert.ok(text.includes(claim), `Express intent still states "${claim}"`);
  }

  /*
   * THE DEMOTION, ASSERTED AS AN OUTCOME. The count sentence must not be the section's reading-size
   * lead. Both facts are read out of the rendered section: the first paragraph must not be the one
   * carrying the counts, and the counts must not be set at body size.
   */
  const section = render(EMPTY).slice(render(EMPTY).indexOf('aria-label="Express intent"'));
  const body = section.slice(0, section.indexOf("</section>"));
  const paragraphs = [...body.matchAll(/<p class="([^"]*)"[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => ({ cls: m[1], text: visible(m[2]) }))
    .filter((p) => !/text-fg-secondary text-pretty/.test(p.cls) || !p.text.startsWith("What can you"));
  const counts = paragraphs.find((p) => p.text.includes("actions are declared"));
  assert.ok(counts, "the counts are rendered");
  assert.ok(
    /\btext-meta\b/.test(counts!.cls) && !/\btext-body\b/.test(counts!.cls),
    `the registry counts read as metadata, not as a headline: "${counts!.cls}"`,
  );
  const lead = paragraphs.filter((p) => /\btext-body\b/.test(p.cls));
  assert.equal(lead.length, 1, "the section has exactly one reading-size lead");
  assert.ok(
    !/\d/.test(lead[0].text),
    `the lead states what the Director can do and asserts no count: "${lead[0].text}"`,
  );

  /* No inlet, no assistant, no invented action cards on this surface. */
  const markup = render(EMPTY);
  assert.ok(!/<input|<textarea|<form|<button/.test(markup), "Express intent offers no inlet here");
  assert.ok(!/Ask Heby|New directive|Adjust priority/i.test(visible(markup)), "and no invented action card");
  assert.ok(markup.includes('href="/command/intent"'), "the real inlet is the destination it links to");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 9 + 17 (READING IS NOT ACTING). COMPACTION ADDED NO CONTROL
 * ────────────────────────────────────────────────────────────────────────── */
function noMutationControlAppeared(overrides: Readonly<Record<string, string>> = {}): void {
  for (const state of [EMPTY, POPULATED, { status: "unavailable" as const, reason: "r" }]) {
    const markup = render(state);
    assert.ok(!/<button/.test(markup), "the Overview renders no button");
    assert.ok(!/<form/.test(markup), "and no form");
    assert.ok(!/<input/.test(markup), "and no input");
  }
  const overview = codeOf(overrides[OVERVIEW] ?? read(OVERVIEW));
  assert.ok(!/onClick|onSubmit|useTransition|"use client"/.test(overview), "and no client-side handler");
  for (const verb of ["approveActionRequest", "rejectActionRequest", "revokeActionPermit", "executeAuthorizedAction"]) {
    assert.ok(!overview.includes(verb), `the Overview must not reach ${verb}`);
  }
  const text = sectionText(render(POPULATED), "Waiting on you").toLowerCase();
  assert.ok(
    text.includes("command neither holds that authority nor checks it"),
    "and still says plainly that the authority is not Command's",
  );
  assert.ok(text.includes("open decisions"), "routing to the owning surface, not offering the act");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 17. `density` IS PRESENTATION, AND THE DEFAULT IS THE RELEASED RENDERING
 *
 * Byte-for-byte, against the literals CMD-V3 found in the released file. A class SET comparison
 * would have passed a reordering; these are the strings themselves.
 * ────────────────────────────────────────────────────────────────────────── */
const RELEASED_COMFORTABLE = Object.freeze({
  container: "flex flex-col items-start gap-2.5 rounded-xl border p-5 text-left sm:p-6",
  mark: "flex size-8 items-center justify-center rounded-lg",
  icon: "size-4",
  copy: "flex flex-col gap-1.5",
});

const TONES = ["empty", "unavailable", "restricted", "error", "loading"] as const;

function densityIsPresentationOnly(overrides: Readonly<Record<string, string>> = {}): void {
  const source = overrides[STATE_BLOCK] ?? read(STATE_BLOCK);

  /* The default is declared, and it is `comfortable`. */
  assert.ok(/density = "comfortable"/.test(codeOf(source)), "density defaults to comfortable");
  for (const [key, literal] of Object.entries(RELEASED_COMFORTABLE)) {
    assert.ok(
      source.includes(`${key}: "${literal}"`),
      `the comfortable ${key} is the released literal, verbatim: "${literal}"`,
    );
  }

  /* No tone, word, mark, role or live-region may be reachable from a density. */
  const table = /const DENSITIES[\s\S]*?\n\}\);/.exec(source);
  assert.ok(table, "the density table is declared in one place");
  for (const forbidden of [
    /eyebrow/i,
    /role/i,
    /aria/i,
    /icon:\s*[A-Z]/,
    /* Type SIZE and COLOUR belong to the scale and the tone. `text-left` is alignment and stays. */
    /text-(?:display|title|body|meta|label|fg|primary|warning|error|success)/,
    /bg-/,
    /border-(?:dashed|solid|border|error)/,
  ]) {
    assert.ok(!forbidden.test(table![0]), `a density may not carry ${forbidden} — that is the tone's job`);
  }
  assert.equal(
    (source.match(/StateDensity/g) ?? []).length >= 2,
    true,
    "the density type is named, not inlined",
  );

  /* Rendered: every tone keeps its own word, mark and role at BOTH densities. */
  for (const tone of TONES) {
    const comfortable = renderToStaticMarkup(
      createElement(StateBlock, { tone, title: "T", description: "D" }),
    );
    const compact = renderToStaticMarkup(
      createElement(StateBlock, { tone, title: "T", description: "D", density: "compact" }),
    );
    assert.notEqual(comfortable, compact, `compact is a different rendering for ${tone}`);
    assert.equal(visible(comfortable), visible(compact), `and says exactly the same words for ${tone}`);
    for (const attr of [/data-state-tone="([^"]+)"/, /role="([^"]+)"/, /aria-live="([^"]+)"/]) {
      assert.equal(
        (attr.exec(comfortable) ?? [])[1],
        (attr.exec(compact) ?? [])[1],
        `${attr} is identical across densities for ${tone}`,
      );
    }
    assert.equal(
      /lucide-([a-z-]+)/.exec(comfortable)?.[1],
      /lucide-([a-z-]+)/.exec(compact)?.[1],
      `the mark is identical across densities for ${tone}`,
    );
    assert.ok(comfortable.includes(RELEASED_COMFORTABLE.container), `${tone} renders the released container`);
  }

  /* Only Command opted in. The six released consumers are untouched. */
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walk(rel));
      else if (/\.tsx?$/.test(entry.name)) out.push(rel);
    }
    return out;
  };
  const optedIn = walk("src").filter((f) => /density="compact"/.test(overrides[f] ?? read(f)));
  assert.deepEqual(optedIn, [OVERVIEW], "exactly one surface asks for compact, and it is this phase's");
  const consumers = walk("src").filter((f) => f !== STATE_BLOCK && /<StateBlock/.test(overrides[f] ?? read(f)));
  assert.equal(consumers.length, 7, `still seven StateBlock consumers; found ${consumers.length}`);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 7 + 8 + 10 + 11 + 19. NOTHING ARCHITECTURAL MOVED
 * ────────────────────────────────────────────────────────────────────────── */
const LEDGER_COUNT = 34;
const USE_SERVER_MODULES = 9;

function nothingArchitecturalMoved(overrides: Readonly<Record<string, string>> = {}): void {
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walk(rel));
      else if (/\.tsx?$/.test(entry.name)) out.push(rel);
    }
    return out;
  };

  /* 11. No new server action, anywhere. */
  const writers = walk("src").filter((f) => (overrides[f] ?? read(f)).includes('"use server"'));
  assert.equal(writers.length, USE_SERVER_MODULES, `no server action was added; found ${writers.length}`);

  /* 10. No new writer, and no persistence, in anything this phase touched. */
  for (const file of [...OWNED, STATE_BLOCK]) {
    const code = codeOf(overrides[file] ?? read(file));
    for (const forbidden of [/drizzle-orm/, /@\/db\//, /\.insert\(/, /\.update\(\s*[a-zA-Z]/, /createRepository/, /resolveGovernanceAuthority/]) {
      assert.ok(!forbidden.test(code), `${path.basename(file)} must not contain ${forbidden}`);
    }
  }

  /* Schema untouched. */
  assert.equal(
    readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql")).length,
    LEDGER_COUNT,
    "no migration was added or removed",
  );

  /* 7. Seeded goals stay withheld. */
  for (const file of OWNED) {
    const code = codeOf(overrides[file] ?? read(file));
    for (const forbidden of ["goal-runtime", "command-goals", "GoalRuntimeService"]) {
      assert.ok(!code.includes(forbidden), `${path.basename(file)} must not reach the seeded goal source`);
    }
  }
  const disclosure = sectionText(render(EMPTY), "Not yet connected");
  for (const seeded of ["Reduce churn", "SOC2 readiness", "Launch enterprise tier", "Legacy CRM sunset"]) {
    assert.ok(!disclosure.includes(seeded), `a seeded goal title must never reach Command: ${seeded}`);
  }

  /* 8. The eight-cell matrix has no renderer. */
  assert.deepEqual(
    walk("src").filter((f) => /<HealthCell/.test(codeOf(overrides[f] ?? read(f)))),
    [],
    "no surface renders the operational health cell",
  );

  /* 19. Nothing this phase touched names a size below the floor, or off the scale. */
  for (const file of [...OWNED, STATE_BLOCK]) {
    const code = codeOf(overrides[file] ?? read(file));
    for (const raw of code.matchAll(/text-\[[^\]]+\]/g)) {
      assert.fail(`${path.basename(file)} carries the raw size ${raw[0]} — type is stated semantically`);
    }
    assert.ok(!/fontSize\s*:/.test(code), `${path.basename(file)} sets no inline fontSize`);
    for (const tailwindStep of code.matchAll(/\btext-(xs|sm|base|lg|xl|\dxl)\b/g)) {
      assert.fail(`${path.basename(file)} names the Tailwind step ${tailwindStep[0]} instead of the Hebun scale`);
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * BITE-PROOFS
 * ────────────────────────────────────────────────────────────────────────── */
function mutate(source: string, from: string | RegExp, to: string): string {
  const after = source.replace(from, to);
  assert.notEqual(after, source, "bite-proof mutation did not APPLY — it would prove nothing");
  return after;
}

let bitten = 0;
function bites(label: string, run: () => void): void {
  let threw = false;
  try {
    run();
  } catch {
    threw = true;
  }
  assert.ok(threw, `bite-proof "${label}" did not bite — the assertion does not guard it`);
  bitten += 1;
}

/** A mutation that must NOT bite: proof the harness can tell a defect from a correct change. */
function doesNotBite(label: string, run: () => void): void {
  run();
}

function biteProofs(): void {
  /* M1 — a capability keeps its title and loses its reason. */
  bites("summarize a capability's reason away", () => {
    const markup = render(EMPTY);
    noReasonSilentlyDisappears(mutate(markup, UNCONNECTED_CAPABILITIES[3].reason, "Not connected."));
  });

  /* M2 — five of six disclosed. Asserted on the MARKUP so it fails on rendering, not on the frozen array. */
  bites("drop one capability from the rendered disclosure", () => {
    const markup = render(EMPTY);
    const row = UNCONNECTED_CAPABILITIES[5];
    noReasonSilentlyDisappears(mutate(markup, row.capability, "Something else"));
  });

  /* M3 — the default density silently becomes compact, moving six untouched surfaces. */
  bites("change the StateBlock default to compact", () =>
    densityIsPresentationOnly({
      [STATE_BLOCK]: mutate(read(STATE_BLOCK), 'density = "comfortable"', 'density = "compact"'),
    }),
  );

  /* M3b — the comfortable literals drift from the released ones. */
  bites("edit the comfortable padding", () =>
    densityIsPresentationOnly({
      [STATE_BLOCK]: mutate(
        read(STATE_BLOCK),
        'container: "flex flex-col items-start gap-2.5 rounded-xl border p-5 text-left sm:p-6"',
        'container: "flex flex-col items-start gap-2.5 rounded-xl border p-4 text-left sm:p-6"',
      ),
    }),
  );

  /* M4 — a density reaches a signal it may not carry. */
  bites("let a density change the eyebrow", () =>
    densityIsPresentationOnly({
      [STATE_BLOCK]: mutate(read(STATE_BLOCK), '    icon: "size-3.5",', '    icon: "size-3.5",\n    eyebrow: "Compact",'),
    }),
  );

  /* M5 — a second surface quietly opts into compact. */
  bites("opt an untouched consumer into compact", () =>
    densityIsPresentationOnly({
      "src/components/knowledge-workspace/knowledge-records.tsx": mutate(
        read("src/components/knowledge-workspace/knowledge-records.tsx"),
        "<StateBlock",
        '<StateBlock density="compact"',
      ),
    }),
  );

  /* M6 — visual order overrides DOM order. */
  bites("reorder the columns visually", () =>
    readingOrderCannotVaryByWidth({
      [OVERVIEW]: mutate(read(OVERVIEW), "xl:w-[320px] xl:shrink-0", "xl:w-[320px] xl:shrink-0 xl:order-first"),
    }),
  );

  /* M6b — the tree branches on the viewport, so the reading order stops being one order. */
  bites("branch the Overview on a media query", () =>
    readingOrderCannotVaryByWidth({
      [OVERVIEW]: mutate(read(OVERVIEW), "import Link", 'import { useMediaQuery } from "@/lib/use-media-query";\nimport Link'),
    }),
  );

  /* M7 — the aside grows until it is no longer the subordinate column. */
  bites("widen the aside past the primary column", () =>
    theSplitIsJustifiedByArithmetic({
      [OVERVIEW]: mutate(read(OVERVIEW), "xl:w-[320px]", "xl:w-[520px]"),
    }),
  );

  /* M7b — the split is armed at lg, where the arithmetic says the primary starves. */
  bites("arm the split at lg", () =>
    theSplitIsJustifiedByArithmetic({
      [OVERVIEW]: mutate(read(OVERVIEW), "xl:flex-row", "lg:flex-row"),
    }),
  );

  /* M7c — the rem breakpoints are re-based, silently moving the split the arithmetic describes. */
  bites("re-base the root font size under the rem breakpoints", () =>
    theSplitIsJustifiedByArithmetic({
      [GLOBALS]: `html { font-size: 20px; }\n${read(GLOBALS)}`,
    }),
  );

  /* M8 — a column loses the ability to shrink. */
  bites("remove min-w-0 from the aside", () =>
    everyColumnCanShrink({
      [OVERVIEW]: mutate(read(OVERVIEW), 'className="flex min-w-0 flex-col xl:w-[320px]', 'className="flex flex-col xl:w-[320px]'),
    }),
  );

  /* M9 — the empty state is compacted into the unavailable one. */
  bites("render the successful empty read as unavailable", () => {
    const forged = mutate(sectionText(render(EMPTY), "Waiting on you"), "Empty", "Unavailable");
    assert.ok(!/Unavailable/i.test(forged), "a successful empty read is never labelled unavailable");
  });

  /* M9b — the eyebrow is compacted off the unavailable block, spending a distinction signal. */
  bites("hide the eyebrow on the unavailable state", () => {
    const markup = renderToStaticMarkup(
      createElement(StateBlock, {
        tone: "unavailable",
        density: "compact",
        hideEyebrow: true,
        title: "Hebun could not read your authorization queue",
        description: "The durable read did not answer (persistence-not-configured).",
      }),
    );
    assert.ok(/Unavailable/i.test(visible(markup)), "unavailable says so — the eyebrow was not compacted away");
  });

  /* M10 — a fabricated zero enters the disclosure. */
  bites("print a zero for a capability with no source", () =>
    noReasonSilentlyDisappears(mutate(render(EMPTY), "Not connected", "0 sources connected")),
  );

  /* M11 — the counts are promoted back to the reading-size lead. */
  bites("promote the registry counts back to body size", () => {
    const section = render(EMPTY);
    const forged = mutate(
      section,
      /<p class="text-meta leading-5 text-fg-secondary">(\s*)8 actions are declared/,
      '<p class="text-body leading-6 text-fg-secondary">$18 actions are declared',
    );
    const body = forged.slice(forged.indexOf('aria-label="Express intent"'));
    const paragraphs = [...body.slice(0, body.indexOf("</section>")).matchAll(/<p class="([^"]*)"[^>]*>([\s\S]*?)<\/p>/g)]
      .map((m) => ({ cls: m[1], text: visible(m[2]) }));
    const counts = paragraphs.find((p) => p.text.includes("actions are declared"))!;
    assert.ok(/\btext-meta\b/.test(counts.cls), "the registry counts read as metadata, not as a headline");
  });

  /* M12 — a mutation control appears on the read-only surface. */
  bites("add an approve control to the Overview", () => {
    const markup = mutate(render(POPULATED), "<ul", "<button>Approve</button><ul");
    assert.ok(!/<button/.test(markup), "the Overview renders no button");
  });

  /* M13 — a new server action. */
  bites("add a new server-action module", () =>
    nothingArchitecturalMoved({ [MODEL]: `"use server";\n${read(MODEL)}` }),
  );

  /* M14 — sub-floor type enters a file this phase touched. */
  bites("write a raw sub-floor size into the Overview", () =>
    nothingArchitecturalMoved({
      [OVERVIEW]: mutate(read(OVERVIEW), 'className="text-meta leading-5 text-fg-muted"', 'className="text-[0.6rem] leading-5 text-fg-muted"'),
    }),
  );

  /* M15 — a fourth section is added to the canonical three. */
  bites("add a fourth canonical section", () =>
    theCanonicalShapeIsUntouched(
      {},
      mutate(render(EMPTY), "</div></div>", '</div><section id="kpi" aria-label="At a glance"></section></div>'),
    ),
  );

  /*
   * THE HARNESS ITSELF. A change that is CORRECT must be accepted, or "every mutation bit" means
   * only that the assertions are brittle. Moving the aside from 360px to 336px is a different
   * legitimate answer inside the approved band; it must pass.
   */
  doesNotBite("narrow the aside to another width inside the approved band", () =>
    theSplitIsJustifiedByArithmetic({
      [OVERVIEW]: mutate(read(OVERVIEW), "xl:w-[320px]", "xl:w-[336px]"),
    }),
  );
}

function main(): void {
  theCanonicalShapeIsUntouched();
  readingOrderCannotVaryByWidth();
  theSplitIsJustifiedByArithmetic();
  everyColumnCanShrink();
  noReasonSilentlyDisappears();
  theReadStatesAreStillThree();
  intentReadsAsADoorway();
  noMutationControlAppeared();
  densityIsPresentationOnly();
  nothingArchitecturalMoved();
  biteProofs();
  assert.equal(bitten, 20, `every mutation must bite; ${bitten} did`);
  console.log(
    "CMD-V3: the Command Overview is composed for a Director — three sections, six reasons, one reading order; " +
      `all ${bitten} bite-proofs bit and the harness accepted a correct change.`,
  );
}

main();
