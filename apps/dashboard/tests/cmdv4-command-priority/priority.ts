/*
 * CMD-V4 — Command visual priority, and the one thing progressive disclosure must never become.
 *
 * ── THE WHOLE PHASE IN ONE SENTENCE ──────────────────────────────────────────
 *
 * Truth may be LAYERED; it may not be HIDDEN. Those two are separated by properties a test can
 * check, and this file checks them rather than trusting the word "disclosure":
 *
 *   LAYERED   every capability NAME and every "Not connected" marker is on screen while the row is
 *             closed; every reason is in the SAME document, one keystroke away, needing no
 *             navigation, no network and no pointer; the widget is the browser's own, so keyboard
 *             and screen-reader behaviour is not something this repository had to reimplement.
 *   HIDDEN    a name that only appears once expanded. A reason behind a link. A tooltip. A reason
 *             shortened, softened, or replaced by a summary of itself. Authoritative or derived
 *             content collapsed at all.
 *
 * CMD-V3 measured the thing that justified this phase: at 390px the six reasons were 1,180px of a
 * 2,416px page, so a Director read half a screen about what Hebun CANNOT do before reaching what it
 * can. CMD-V3 refused to fix that by deleting a reason. This phase does not delete one either — the
 * assertions below compare every rendered reason against the frozen source array, character for
 * character.
 *
 * ── WHAT THIS FILE DOES NOT CLAIM ────────────────────────────────────────────
 *
 * A height. There is no layout engine here; `renderToStaticMarkup` returns a string. Every pixel
 * claim belongs to the authenticated browser measurement and is reported there, with its instrument
 * named. What is provable in process is that the disclosure is real, native, complete, and confined
 * to the tertiary section — and that the shared primitive's released default did not move.
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
  type WaitingOnYouState,
} from "../../src/features/command-overview/workspace-model";

const ROOT = process.cwd();
const OVERVIEW = "src/components/command-overview/command-overview.tsx";
const STATE_BLOCK = "src/components/ui/state-block.tsx";
const MODEL = "src/features/command-overview/workspace-model.ts";
const PAGE = "src/app/(dashboard)/command/page.tsx";

const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const ENT: Readonly<Record<string, string>> = Object.freeze({
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'", "&#39;": "'",
});
const visible = (m: string): string =>
  m.replace(/<[^>]*>/g, " ").replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, (e) => ENT[e] ?? e)
    .replace(/\s+/g, " ").trim();

const INTENT = getExpressIntentSummary();
const EMPTY: WaitingOnYouState = { status: "none-waiting" };
const UNAVAILABLE: WaitingOnYouState = { status: "unavailable", reason: "persistence-not-configured" };

function render(waiting: WaitingOnYouState = EMPTY): string {
  return renderToStaticMarkup(createElement(CommandOverview, { waiting, intent: INTENT }));
}

/** The markup of one section, sliced by its own tags. */
function sectionMarkup(markup: string, id: string): string {
  const at = markup.indexOf(`id="${id}"`);
  assert.ok(at > 0, `the "${id}" section is rendered`);
  const open = markup.lastIndexOf("<section", at);
  const rest = markup.slice(open);
  const end = rest.indexOf("</section>");
  return rest.slice(0, end === -1 ? undefined : end);
}

/** Every `<details>` in a fragment, split into its summary markup and its body markup. */
function disclosures(fragment: string): { summary: string; body: string }[] {
  return [...fragment.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/g)].map((m) => {
    const inner = m[1];
    const s = /<summary\b[^>]*>([\s\S]*?)<\/summary>/.exec(inner);
    assert.ok(s, "every disclosure has a summary");
    return { summary: s![1], body: inner.replace(s![0], "") };
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 12 + 13 + 14 + 21 + 22. LAYERED, NOT HIDDEN
 * ────────────────────────────────────────────────────────────────────────── */
function everyCapabilityIsNamedClosedAndEveryReasonIsReachable(markupOverride?: string): void {
  const markup = markupOverride ?? render();
  const nc = sectionMarkup(markup, "not-connected");
  const rows = disclosures(nc);

  assert.equal(rows.length, 6, `six disclosures, one per capability; found ${rows.length}`);
  assert.equal(UNCONNECTED_CAPABILITIES.length, 6, "and the model still declares six");

  for (const cap of UNCONNECTED_CAPABILITIES) {
    const row = rows.find((r) => visible(r.summary).includes(cap.capability));

    /* 21 — the NAME is in the summary, so it is on screen while the row is closed. */
    assert.ok(row, `"${cap.capability}" is named in a summary, visible while closed`);

    /* The state marker is on the closed row too, as a word — not a colour and not a tooltip. */
    assert.ok(
      /not connected/i.test(visible(row!.summary)),
      `"${cap.capability}" shows its not-connected state while closed`,
    );

    /* 22 + 14 — the reason is in the body, in this document, character for character. */
    assert.ok(
      visible(row!.body).includes(cap.reason),
      `"${cap.capability}" keeps its OWN reason, in full, unshortened`,
    );
    /* And reachable without navigating: nothing in the body is a link or a control. */
    assert.ok(!/<a\b|<button\b|href=/.test(row!.body), `"${cap.capability}" hides no reason behind navigation`);
    assert.ok(!/title="|aria-label="/.test(row!.body), `"${cap.capability}" uses no tooltip-only disclosure`);
  }

  /* No reason was collapsed into a summary of itself: the six are still six distinct strings. */
  assert.equal(new Set(UNCONNECTED_CAPABILITIES.map((r) => r.reason)).size, 6, "six distinct reasons");

  /* The doctrine sentence the retired panel uniquely carried is still on the page. */
  assert.ok(
    visible(nc).includes("None is shown as an empty result, a zero, or a placeholder figure"),
    "the no-fabricated-figure sentence survived the panel that used to carry it",
  );

  /* Still no invented figure, and no connection control. */
  assert.ok(!/\b0\b/.test(visible(nc)), "no zero stands in for a missing source");
  assert.ok(!/%/.test(visible(nc)), "and no percentage");
  for (const invented of [/\bConnect\b/, /Manage connections/, /Ask Heby/, /At a glance/]) {
    assert.ok(!invented.test(visible(nc)), `the disclosure offers no ${invented}`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ONLY THE TERTIARY SECTION MAY COLLAPSE, AND THE WIDGET IS THE BROWSER'S
 * ────────────────────────────────────────────────────────────────────────── */
function disclosureIsNativeAndConfined(overrides: Readonly<Record<string, string>> = {}, markupOverride?: string): void {
  const markup = markupOverride ?? render();

  /* Authoritative and derived content is NEVER behind a click. */
  for (const id of ["waiting", "intent"]) {
    assert.equal(
      disclosures(sectionMarkup(markup, id)).length,
      0,
      `the "${id}" section collapses nothing — a Director may not have to click to learn whether something is waiting on them`,
    );
  }
  assert.equal((markup.match(/<details\b/g) ?? []).length, 6, "every disclosure on the page is a tertiary one");

  /* Native semantics, not a reimplementation. */
  for (const forged of [/<summary[^>]*role=/, /<summary[^>]*tabindex=/, /<summary[^>]*aria-expanded=/]) {
    assert.ok(!forged.test(markup), `the summary keeps the browser's own semantics (${forged})`);
  }
  const src = codeOf(overrides[OVERVIEW] ?? read(OVERVIEW));
  for (const clientish of [/onClick/, /onToggle/, /useState/, /useEffect/, /"use client"/, /aria-expanded/]) {
    assert.ok(!clientish.test(src), `the disclosure needs no client runtime (${clientish})`);
  }
  /* The default marker is suppressed in both engines, or the chevron doubles up. */
  assert.ok(/list-none/.test(src) && /-webkit-details-marker\]:hidden/.test(src), "one marker, not two");
  /* Keyboard reachability is the summary's own; it must still be focusable-visible. */
  assert.ok(/<summary[^>]*focus-visible:/.test(overrides[OVERVIEW] ?? read(OVERVIEW)), "the summary shows focus");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 20. THE SHARED PRIMITIVE'S RELEASED DEFAULT DID NOT MOVE
 * ────────────────────────────────────────────────────────────────────────── */
const RELEASED_STACK = Object.freeze({
  head: "flex items-center gap-2.5",
  title: "text-title font-semibold text-fg text-balance",
  description: "max-w-2xl text-body text-fg-secondary text-pretty",
});
const TONES = ["empty", "unavailable", "restricted", "error", "loading"] as const;

function layoutIsArrangementOnly(overrides: Readonly<Record<string, string>> = {}): void {
  const source = overrides[STATE_BLOCK] ?? read(STATE_BLOCK);

  assert.ok(/layout = "stack"/.test(codeOf(source)), "layout defaults to stack");
  for (const [k, v] of Object.entries(RELEASED_STACK)) {
    assert.ok(source.includes(`${k}: "${v}"`), `the stack ${k} is the released literal, verbatim: "${v}"`);
  }

  const table = /const LAYOUTS[\s\S]*?\n\}\);/.exec(source);
  assert.ok(table, "the layout table is declared in one place");
  for (const forbidden of [
    /eyebrow:/, /role/i, /aria/i, /icon:/,
    /text-(?:fg-muted|primary|warning|error|success)\b/, /bg-/, /border-(?:dashed|solid|border|error)/,
    /* A raw size, or a step below the CMD-V2 floor, in either arrangement. */
    /text-\[/, /\btext-(?:xs|sm|base|lg|xl|\dxl)\b/, /\btext-label\b/,
  ]) {
    assert.ok(!forbidden.test(table![0]), `a layout may not carry ${forbidden} — that is the tone's job, or the floor's`);
  }

  /* Rendered: every tone keeps its word, mark, border, role and live region in BOTH arrangements. */
  for (const tone of TONES) {
    const stack = renderToStaticMarkup(createElement(StateBlock, { tone, title: "T", description: "D" }));
    const row = renderToStaticMarkup(createElement(StateBlock, { tone, title: "T", description: "D", layout: "row" }));
    assert.notEqual(stack, row, `row is a different arrangement for ${tone}`);
    /*
      THE SAME WORDS, NOT THE SAME ORDER. A row moves the eyebrow to the end of the title line, so
      "Empty T D" becomes "T Empty D". Comparing the strings would fail on the arrangement — which
      is the one thing `layout` is ALLOWED to change. Comparing the multiset fails on a word that
      went missing, which is the thing it may not.
    */
    const words = (m: string) => visible(m).split(" ").sort().join(" ");
    assert.equal(words(stack), words(row), `and loses no word in a row for ${tone}`);
    for (const attr of [/data-state-tone="([^"]+)"/, /role="([^"]+)"/, /aria-live="([^"]+)"/]) {
      assert.equal((attr.exec(stack) ?? [])[1], (attr.exec(row) ?? [])[1], `${attr} identical across layouts for ${tone}`);
    }
    assert.equal(/lucide-([a-z-]+)/.exec(stack)?.[1], /lucide-([a-z-]+)/.exec(row)?.[1], `same mark for ${tone}`);
    /* The tone's border treatment is the container's, and the container is untouched by layout. */
    for (const cls of ["border-dashed", "border-solid"]) {
      assert.equal(stack.includes(cls), row.includes(cls), `${tone} keeps its border treatment in a row`);
    }
    assert.ok(stack.includes(RELEASED_STACK.head), `${tone} renders the released stack head`);
  }

  /* Exactly one surface opted in, and it is this phase's. */
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const e of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) out.push(...walk(rel));
      else if (/\.tsx?$/.test(e.name)) out.push(rel);
    }
    return out;
  };
  /*
   * AMENDED BY CMD-FINAL, for the same reason and on the same terms as CMD-V3's `density` pin.
   * Command's operating statement is no longer a StateBlock, so no surface asks for `row`. The
   * empty set fails the moment any surface opts in; the byte-identity of the `stack` default —
   * the property that protects the six untouched consumers — is asserted above and is unchanged.
   */
  assert.deepEqual(
    walk("src").filter((f) => /layout="row"/.test(overrides[f] ?? read(f))),
    [],
    "no surface opts into the row arrangement — CMD-FINAL retired the boxed status",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4 + 5 + 15. THE PRIMARY SECTION STILL TELLS THE TWO STATES APART
 * ────────────────────────────────────────────────────────────────────────── */
function theStatusLineKeptTheDistinction(): void {
  const empty = visible(sectionMarkup(render(EMPTY), "waiting"));
  const unavailable = visible(sectionMarkup(render(UNAVAILABLE), "waiting"));

  assert.ok(/\bEmpty\b/i.test(empty), "the successful empty read still shows its word");
  assert.ok(!/Unavailable/i.test(empty), "and is never labelled unavailable");
  assert.ok(/\bUnavailable\b/i.test(unavailable), "the unanswered read still shows its word");
  assert.ok(unavailable.includes("persistence-not-configured"), "and still names the reason the read gave");
  assert.ok(!/Nothing is waiting/.test(unavailable), "an unanswered read never claims nothing is waiting");
  assert.ok(!/\b0\b/.test(empty) && !/\b0\b/.test(unavailable), "neither fabricates a zero");
  assert.ok(!/\bshown\b/.test(unavailable), "and an unanswered read carries no badge");

  /* 15 — a populated read still expands into real rows, and still offers no act. */
  const populated = render({
    status: "waiting",
    boundReached: false,
    items: [{ requestId: "r1", actionKind: "send-external-communication", targetLabel: "someone@example.test",
              expectedEffect: "Send one message to one recipient.", proposedAt: "2026-08-21T09:00:00.000Z" }],
  });
  const p = visible(sectionMarkup(populated, "waiting"));
  assert.ok(p.includes("send-external-communication") && p.includes("1 shown"), "a populated read renders its rows");
  assert.ok(!/<button|<form|<input/.test(populated), "and still offers no control");
  assert.equal(disclosures(sectionMarkup(populated, "waiting")).length, 0, "and collapses nothing");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1 + 2 + 3 + 11 + 16 + 17. THE CONTRACT UNDER THE COMPOSITION
 * ────────────────────────────────────────────────────────────────────────── */
function theCanonicalContractHolds(overrides: Readonly<Record<string, string>> = {}, markupOverride?: string): void {
  const markup = markupOverride ?? render();
  assert.equal((markup.match(/<section\b/g) ?? []).length, 3, "three canonical sections");
  assert.deepEqual(
    [...markup.matchAll(/<section[^>]*\bid="([^"]+)"/g)].map((m) => m[1]),
    ["waiting", "intent", "not-connected"],
    "in the canonical DOM order",
  );
  assert.deepEqual(
    [...markup.matchAll(/data-provenance="([^"]+)"/g)].map((m) => m[1]),
    ["authoritative", "derived", "not-connected"],
    "with the released provenance mapping",
  );
  assert.ok(!markup.includes("<h1"), "the Overview contributes no h1");
  const levels = [...markup.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  assert.ok(levels.every((l) => l >= 2 && l <= 3), "headings stay between h2 and h3");

  /* 17 — no raw size, no Tailwind step, no inline font-size, in anything this phase touched. */
  for (const f of [OVERVIEW, STATE_BLOCK, MODEL, PAGE]) {
    const code = codeOf(overrides[f] ?? read(f));
    for (const raw of code.matchAll(/text-\[[^\]]+\]/g)) assert.fail(`${path.basename(f)} carries ${raw[0]}`);
    for (const step of code.matchAll(/\btext-(xs|sm|base|lg|xl|\dxl)\b/g)) assert.fail(`${path.basename(f)} names ${step[0]}`);
    assert.ok(!/fontSize\s*:/.test(code), `${path.basename(f)} sets no inline fontSize`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * BITE-PROOFS
 * ────────────────────────────────────────────────────────────────────────── */
function mutate(src: string, from: string | RegExp, to: string): string {
  const after = src.replace(from, to);
  assert.notEqual(after, src, "bite-proof mutation did not APPLY — it would prove nothing");
  return after;
}
let bitten = 0;
function bites(label: string, run: () => void): void {
  let threw = false;
  try { run(); } catch { threw = true; }
  assert.ok(threw, `bite-proof "${label}" did not bite — the assertion does not guard it`);
  bitten += 1;
}
function doesNotBite(label: string, run: () => void): void { void label; run(); }

function biteProofs(): void {
  const M = render();

  /* M1 — a capability name moves out of the summary, so it is invisible while closed. */
  bites("hide a capability name behind the disclosure", () =>
    everyCapabilityIsNamedClosedAndEveryReasonIsReachable(
      mutate(M, `>${UNCONNECTED_CAPABILITIES[2].capability}</span>`, ">Unavailable capability</span>"),
    ),
  );

  /* M2 — the closed row stops saying what state it is in. */
  bites("drop the not-connected marker from the closed rows", () =>
    everyCapabilityIsNamedClosedAndEveryReasonIsReachable(mutate(M, /Not connected/g, "")),
  );

  /* M3 — a reason is summarized away. */
  bites("summarize a reason instead of keeping it", () =>
    everyCapabilityIsNamedClosedAndEveryReasonIsReachable(
      mutate(M, UNCONNECTED_CAPABILITIES[4].reason, "Not available yet."),
    ),
  );

  /* M4 — a reason moves behind navigation instead of behind a keystroke. */
  bites("put a reason behind a link", () =>
    everyCapabilityIsNamedClosedAndEveryReasonIsReachable(
      mutate(M, UNCONNECTED_CAPABILITIES[0].reason, '<a href="/docs">Read why</a>'),
    ),
  );

  /* M5 — a reason becomes a tooltip. */
  bites("turn a reason into a tooltip", () =>
    everyCapabilityIsNamedClosedAndEveryReasonIsReachable(
      mutate(M, UNCONNECTED_CAPABILITIES[1].reason, `" title="${UNCONNECTED_CAPABILITIES[1].reason}`),
    ),
  );

  /* M6 — the doctrine sentence is dropped along with the panel that used to carry it. */
  bites("drop the no-fabricated-figure sentence", () =>
    everyCapabilityIsNamedClosedAndEveryReasonIsReachable(
      mutate(M, "None is shown as an empty result", "Nothing here"),
    ),
  );

  /*
   * M7 — authoritative content gets collapsed.
   *
   * THE FORGERY MUST BE WELL-FORMED OR IT PROVES A DIFFERENT GUARD. A first version injected an
   * unclosed `<details>`, which `disclosures()` could not parse, so the per-section check saw zero
   * and passed and the TOTAL-count assertion three lines later is what threw. It bit, and it bit for
   * the wrong reason. This injects a complete disclosure into the authoritative section, so the
   * assertion that fires is the one that says a Director may not have to click to learn whether
   * something is waiting on them.
   */
  bites("collapse the authoritative section", () =>
    disclosureIsNativeAndConfined(
      {},
      mutate(
        M,
        '<p class="text-meta leading-5 text-fg-muted">',
        '<details><summary>Authority</summary><p>hidden</p></details><p class="text-meta leading-5 text-fg-muted">',
      ),
    ),
  );

  /* M8 — the native widget is replaced by a hand-rolled one. */
  bites("hand-roll the disclosure", () =>
    disclosureIsNativeAndConfined({
      [OVERVIEW]: mutate(read(OVERVIEW), "<ChevronRight", "<span onClick={() => {}} aria-expanded={false} />\n                  <ChevronRight"),
    }),
  );

  /* M8b — the summary loses its focus treatment, so keyboard users cannot see where they are. */
  bites("remove the summary's focus ring", () =>
    disclosureIsNativeAndConfined({
      [OVERVIEW]: mutate(read(OVERVIEW), "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-ring", ""),
    }),
  );

  /* M9 — the shared primitive's default arrangement is changed under six untouched consumers. */
  bites("change the StateBlock default layout to row", () =>
    layoutIsArrangementOnly({ [STATE_BLOCK]: mutate(read(STATE_BLOCK), 'layout = "stack"', 'layout = "row"') }),
  );

  /* M9b — the released stack literals drift. */
  bites("edit the released stack description", () =>
    layoutIsArrangementOnly({
      [STATE_BLOCK]: mutate(read(STATE_BLOCK), `description: "${RELEASED_STACK.description}"`,
        'description: "max-w-2xl text-meta text-fg-secondary text-pretty"'),
    }),
  );

  /* M10 — an arrangement reaches a signal it may not carry. */
  bites("let a layout carry a tone colour", () =>
    layoutIsArrangementOnly({
      [STATE_BLOCK]: mutate(read(STATE_BLOCK), '    eyebrowBesideTitle: true,', '    eyebrowBesideTitle: true,\n    tint: "bg-error-subtle",'),
    }),
  );

  /* M10b — an arrangement drops the title to the floor step. */
  bites("let a layout set the title at the label step", () =>
    layoutIsArrangementOnly({
      [STATE_BLOCK]: mutate(read(STATE_BLOCK), 'title: "min-w-0 flex-1 text-title font-semibold text-fg text-balance"',
        'title: "min-w-0 flex-1 text-label font-semibold text-fg text-balance"'),
    }),
  );

  /* M11 — a second surface quietly adopts the row arrangement. */
  bites("opt an untouched consumer into the row arrangement", () =>
    layoutIsArrangementOnly({
      "src/components/knowledge-workspace/knowledge-records.tsx": mutate(
        read("src/components/knowledge-workspace/knowledge-records.tsx"), "<StateBlock", '<StateBlock layout="row"'),
    }),
  );

  /* M12 — the status line spends the eyebrow that separates empty from unavailable. */
  bites("hide the eyebrow on the row status line", () => {
    const m = renderToStaticMarkup(createElement(StateBlock, {
      tone: "unavailable", layout: "row", density: "compact", hideEyebrow: true,
      title: "Hebun could not read your authorization queue", description: "persistence-not-configured",
    }));
    assert.ok(/\bUnavailable\b/i.test(visible(m)), "the unanswered read still shows its word");
  });

  /* M13 — a fourth section, or a lost provenance chip. */
  bites("add a fourth canonical section", () =>
    theCanonicalContractHolds({}, mutate(M, "</div></div>", '</div><section id="kpi"></section></div>')),
  );
  bites("drop a provenance chip", () =>
    theCanonicalContractHolds({}, mutate(M, /data-provenance="derived"/, 'data-nothing="derived"')),
  );

  /* M14 — sub-floor type enters the disclosure to buy height. */
  bites("shrink the reason below the floor", () =>
    theCanonicalContractHolds({
      [OVERVIEW]: mutate(read(OVERVIEW), 'className="px-3 pb-3 pl-[34px] text-meta leading-5 text-fg-secondary"',
        'className="px-3 pb-3 pl-[34px] text-[0.65rem] leading-5 text-fg-secondary"'),
    }),
  );

  /*
   * THE HARNESS ITSELF. Opening every row by default is a legitimate product choice, not a defect —
   * it layers nothing but hides nothing either. It must pass, or "every mutation bit" means only
   * that these assertions cannot tell a change from a regression.
   */
  doesNotBite("render the disclosures open by default", () =>
    everyCapabilityIsNamedClosedAndEveryReasonIsReachable(mutate(M, /<details /g, "<details open ")),
  );
}

function main(): void {
  everyCapabilityIsNamedClosedAndEveryReasonIsReachable();
  disclosureIsNativeAndConfined();
  layoutIsArrangementOnly();
  theStatusLineKeptTheDistinction();
  theCanonicalContractHolds();
  biteProofs();
  assert.equal(bitten, 18, `every mutation must bite; ${bitten} did`);
  console.log(
    `CMD-V4: Command layers the tertiary disclosure without hiding it — six names and six markers ` +
      `always on screen, six reasons one keystroke away, nothing authoritative collapsed; all ${bitten} ` +
      "bite-proofs bit and the harness accepted a correct change.",
  );
}

main();
