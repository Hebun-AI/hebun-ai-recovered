/*
 * G7 — THE SPATIAL CANVAS, THE EMERGING COMPOSER, AND THE RAIL'S TRUTHFULNESS.
 *
 * The approved reference is a picture of a product that mostly does not exist yet. It shows a
 * document upload, a Governance approval, a completed analysis, a finished task and a detected
 * sales trend flowing down a right-hand rail. Four of those five have no read seam in this
 * repository at all, and the fifth exists only as a tally, which is not an event.
 *
 * So the interesting proofs here are not "does it look like the picture". They are:
 *
 *   - the rail CANNOT be populated by anything but a row a read seam returned,
 *   - "nothing to show" and "could not read" stay different sentences,
 *   - the composer that "emerges" is never actually taken away from anyone,
 *   - the amber language belongs to Heby and did not escape into the product,
 *   - and collapsing the Quick Panel is not closing it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveHebyDock } from "../../src/features/heby-surface/canvas-mode";
import {
  formatStreamInstant,
  toStreamItems,
  type HebyStreamState,
  type PendingRequestRow,
} from "../../src/features/heby-stream/activity-stream";
import { HebyStreamRail } from "../../src/components/layout/heby/heby-stream-rail";
import { HebyWorkspace, type HebyWorkspaceProps } from "../../src/components/layout/heby/heby-workspace";

const read = (path: string) => readFileSync(path, "utf8");
const codeOf = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const textOf = (html: string) => html.replace(/<[^>]*>/g, " ");

const CANVAS = "src/components/layout/heby/heby-workspace.tsx";
const RAIL = "src/components/layout/heby/heby-stream-rail.tsx";
const STREAM = "src/features/heby-stream/activity-stream.ts";
const DOCK = "src/features/heby-surface/canvas-mode.ts";
const PAGE = "src/app/(dashboard)/heby/page.tsx";
const PANEL = "src/components/layout/heby/heby-quick-panel.tsx";
const SOURCE_PANEL = "src/components/layout/heby/heby-source-evidence.tsx";
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

const REST = {
  composition: "hero",
  pointerInDock: false,
  focusInDock: false,
  hasDraft: false,
  busy: false,
  voiceActive: false,
  unavailable: false,
} as const;

const ROW: PendingRequestRow = {
  requestId: "req-1",
  actionKind: "send-external-communication",
  targetLabel: "Acme Ltd — accounts",
  targetRef: "recipient-9",
  expectedEffect: "Would send one message to the recorded address.",
  proposedAt: "2026-08-19T17:05:41.000Z",
};

function main(): void {
  /* ═══════════════════════════════════════════════════════════════════════════
   * 1. THE DOCK RULE. Resting is possible ONLY on the empty canvas, and never while the operator
   *    has something in flight, something typed, a microphone open, or a reason they need to read.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    assert.equal(resolveHebyDock(REST), "resting", "an untouched empty canvas belongs to Heby");

    for (const [field, label] of [
      ["pointerInDock", "the pointer arrived"],
      ["focusInDock", "the keyboard arrived"],
      ["hasDraft", "a draft may never be hidden"],
      ["busy", "an in-flight request may never be hidden"],
      ["voiceActive", "an open microphone may never be hidden"],
      ["unavailable", "the reason Heby cannot answer may never be hidden"],
    ] as const) {
      assert.equal(resolveHebyDock({ ...REST, [field]: true }), "inviting", label);
    }

    /* Once a conversation exists the operator is working; the surface never takes the field away. */
    for (const composition of ["emerging", "conversation"] as const) {
      assert.equal(
        resolveHebyDock({ ...REST, composition }),
        "inviting",
        `${composition}: a working surface always presents its composer`,
      );
    }

    /* Pure: nothing here can consult a clock, a device or a random source. */
    const dock = codeOf(read(DOCK));
    for (const banned of ["Date", "Math.random", "window", "document", "fetch", "useState"]) {
      assert.ok(!dock.includes(banned), `the dock rule must not reach for "${banned}"`);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 2. "EMERGING" IS A PRESENTATION STATE, NEVER A MOUNTING CONDITION.
   *
   * The composer is in the document, labelled, described and reachable in EVERY state — including
   * the resting hero canvas, which is the state the whole reveal exists for. A composer that
   * appeared only on hover would be unreachable by keyboard, by touch and by a screen reader, and
   * would hide the notice explaining why Heby cannot answer.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const resting = renderCanvas({});
    assert.ok(resting.includes('data-heby-dock="resting"'), "the empty canvas rests");
    assert.ok(resting.includes('aria-label="Message Heby"'), "and the composer is still in the document");
    assert.ok(resting.includes('aria-label="Send"'), "with its send control");
    assert.ok(resting.includes("Enter to send, Shift+Enter for a new line"), "and its keyboard semantics");
    assert.ok(resting.includes("data-heby-dock-hint"), "the invitation is stated");
    /* It is dimmed, never removed from the pointer or the tab order. */
    assert.ok(!/pointer-events-none[^"]*opacity-0|opacity-0[^"]*pointer-events-none/.test(resting),
      "the resting dock is not made unclickable");
    assert.ok(!resting.includes('aria-hidden="true" class="mx-auto flex w-full max-w-[52rem]'),
      "the dock is not hidden from assistive technology");

    /* A draft, a request in flight, or an unavailable surface all bring it forward. */
    for (const overrides of [
      { composerValue: "half a question" },
      { busy: true },
      { notice: { tone: "warn" as const, text: "Sign in to ask Heby a question." } },
      { turns: [{ key: "h", role: "heby" as const, content: "a", durable: true }] },
    ]) {
      assert.ok(
        renderCanvas(overrides).includes('data-heby-dock="inviting"'),
        `the dock comes forward for ${JSON.stringify(Object.keys(overrides))}`,
      );
    }

    /* The hint is the resting state's alone — it never nags a working operator. */
    assert.ok(!renderCanvas({ composerValue: "x" }).includes("data-heby-dock-hint"), "no hint once engaged");
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 3. THE DEPTH FLOOR IS DECORATIVE AND STILL.
   *
   * A moving field beneath Heby would be read as activity, and Heby has no activity to report.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const html = renderCanvas({});
    const css = read(CSS);
    const canvas = read(CANVAS);

    for (const layer of ["heby-aurora", "heby-horizon", "heby-floor"]) {
      assert.ok(html.includes(layer), `${layer} is rendered`);
      /* Hidden from assistive technology and untouchable by the pointer. */
      const element = html.slice(html.indexOf(layer) - 260, html.indexOf(layer) + 120);
      assert.ok(element.includes('aria-hidden="true"'), `${layer} is hidden from assistive technology`);
      assert.ok(html.includes(`${layer} pointer-events-none`), `${layer} never takes the pointer`);

      /* STILL. Not one of the three may animate, transition, or move on a clock. */
      const start = css.indexOf(`.${layer} {`);
      assert.ok(start > 0, `${layer} has a rule`);
      const rule = css.slice(start, css.indexOf("}", start));
      assert.ok(!/animation|transition/.test(rule), `${layer} never animates`);

      /*
       * And nothing in the canvas passes it a value. This is the line between atmosphere and
       * fabricated activity: a layer that took a prop could be made to report something, and
       * whatever it reported would not be true.
       */
      const usage = canvas.slice(canvas.indexOf(layer), canvas.indexOf(layer) + 240);
      assert.ok(!usage.includes("${"), `no value is interpolated into ${layer}`);
      assert.ok(!/props\./.test(usage), `${layer} reads no prop`);
    }

    /* The ambient block as a whole holds no state, no clock and no randomness. */
    const ambient = canvas.slice(canvas.indexOf("heby-aurora"), canvas.indexOf("EMERGING"));
    for (const banned of ["Date", "Math.random", "useState", "setInterval", "requestAnimationFrame"]) {
      assert.ok(!ambient.includes(banned), `the ambient layers must not reach for "${banned}"`);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 3b. THE HERO IS HEBY, NOT AN ASSISTANT LANDING PAGE.
   *
   * The Director's correction: a large greeting over two full-width prompt cards made Heby a logo
   * above a chat box. The presence is now the largest thing on the canvas, the greeting is gone,
   * and the invitation is one quiet line on the dock — where the thing being invited actually is.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const hero = renderCanvas({ suggestions: ["Summarize the current picture.", "What changed?"] });

    /* No greeting-shaped heading anywhere on the surface. */
    for (const greeting of [
      "How can I help",
      "What can I help",
      "How may I help",
      "Hi there",
      "Hello",
      "Ask me anything",
    ]) {
      assert.ok(!hero.includes(greeting), `no assistant greeting ("${greeting}")`);
    }

    /* The presence owns the desktop canvas. The lower steps are unchanged; the ceiling was raised. */
    const visualizer = read("src/components/layout/heby/heby-visualizer.tsx");
    assert.ok(visualizer.includes("lg:size-72"), "the existing hero step is unchanged");
    assert.ok(hero.includes('data-heby-size="hero"'), "and it is the hero presence that gets it");

    /*
     * THE CEILING IS RAISED, AND IT IS BOUNDED BY THE HEIGHT THAT ACTUALLY EXISTS.
     *
     * This is the correction the authenticated pass forced, twice. Sized off viewport WIDTH alone
     * the presence cropped the surface it was meant to occupy — inside the Hebun shell, the shell
     * bar, the canvas header and the composer dock take room an isolated component render never
     * sees, and on a 714px window the hero gets about 315px of it. Height breakpoints failed the
     * same way one step later, because a threshold is a guess about a budget that varies with the
     * chrome around it.
     *
     * So the assertion is on the PROPERTY, not on a number: the largest hero step must be a
     * function of the viewport's height. That is what makes "as large as the room allows" and
     * "never larger than the room" the same statement.
     */
    const heroSizes = visualizer.slice(visualizer.indexOf("  hero:"), visualizer.indexOf("compact:"));
    assert.ok(/xl:size-\[min\(\d+rem,\s*\d+dvh\)\]/.test(heroSizes),
      `the widescreen presence is bounded by viewport height (got: ${heroSizes.trim()})`);
    const [, cap, share] = /min\((\d+)rem,\s*(\d+)dvh\)/.exec(heroSizes) ?? [];
    assert.ok(Number(cap) >= 26, `the cap is substantial (got ${cap}rem)`);
    assert.ok(Number(share) >= 30 && Number(share) <= 45,
      `the height share leaves room for the caption and the dock (got ${share}dvh)`);

    /*
     * Suggestions survive as real, usable controls — demoted, not deleted. Removing them would
     * have been the easy way to stop them competing, at the cost of a genuine affordance.
     */
    assert.ok(hero.includes("Summarize the current picture."), "the suggestions the caller passed are rendered");
    assert.ok(!/rounded-2xl border border-border\/70 bg-surface\/60 px-5 py-3/.test(hero),
      "they are no longer full-width cards");

    /* The honest framing line stayed. It says what Heby answers from — it is not a greeting. */
    const heroText = textOf(hero);
    assert.ok(
      heroText.includes("come from the current read models"),
      "the hero still states where the answers come from",
    );
    assert.ok(
      heroText.includes("a plain statement that there is none"),
      "and what happens when there is no evidence — the half a greeting would have dropped",
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 4. THE RAIL CANNOT INVENT AN ENTRY.
   *
   * Every rendered field is traced back to the row it came from by MUTATING the row and watching
   * the output follow. A field that did not move would be a constant wearing a record's authority.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    assert.deepEqual(toStreamItems([]), [], "no rows, no items — there is no default entry");

    const items = toStreamItems([ROW]);
    assert.equal(items.length, 1, "one row, one item");
    const html = renderToStaticMarkup(
      createElement(HebyStreamRail, { stream: { status: "items", items } as HebyStreamState }),
    );
    assert.ok(html.includes("Acme Ltd — accounts"), "the label comes from the row");
    assert.ok(html.includes("Would send one message to the recorded address."), "so does the detail");
    assert.ok(html.includes("2026-08-19 17:05 UTC"), "so does the instant");

    /* Move each field; the output must move with it. */
    const moved = toStreamItems([
      { ...ROW, targetLabel: "MOVED_LABEL", expectedEffect: "MOVED_EFFECT", proposedAt: "2031-01-02T03:04:00.000Z" },
    ]);
    const movedHtml = renderToStaticMarkup(
      createElement(HebyStreamRail, { stream: { status: "items", items: moved } as HebyStreamState }),
    );
    assert.ok(movedHtml.includes("MOVED_LABEL"), "the label is the row's, not a constant");
    assert.ok(movedHtml.includes("MOVED_EFFECT"), "the detail is the row's, not a constant");
    assert.ok(movedHtml.includes("2031-01-02 03:04 UTC"), "the instant is the row's, not a clock reading");

    /* An absent target falls back to the record's own verbatim action kind, never a placeholder. */
    const untargeted = toStreamItems([{ ...ROW, targetLabel: null }]);
    assert.equal(untargeted[0]!.label, "send-external-communication", "the action kind is printed verbatim");

    /* Navigation is fixed by the projection. No row field can steer where a reader is sent. */
    assert.equal(items[0]!.href, "/approvals");
    const hostile = toStreamItems([
      { ...ROW, targetLabel: "https://evil.example", targetRef: "javascript:alert(1)" },
    ]);
    assert.equal(hostile[0]!.href, "/approvals", "a record cannot supply a destination");
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 5. TIME IS COPIED, NEVER COMPUTED.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    assert.equal(formatStreamInstant("2026-08-19T17:05:41.000Z"), "2026-08-19 17:05 UTC");
    /* Deterministic: the same input renders the same way on the server and in the browser. */
    assert.equal(formatStreamInstant(ROW.proposedAt), formatStreamInstant(ROW.proposedAt));
    /* An unexpected shape is returned untouched rather than dressed in a format it does not have. */
    assert.equal(formatStreamInstant("not-a-timestamp"), "not-a-timestamp");
    assert.equal(formatStreamInstant(""), "");

    const stream = codeOf(read(STREAM));
    for (const banned of ["Date", "Math.random", "Intl", "toLocale", "ago", "fetch", "drizzle", "db"]) {
      assert.ok(!stream.includes(banned), `the rail projection must not reach for "${banned}"`);
    }
    /* No relative phrasing anywhere in the rendered rail. */
    const railText = textOf(
      renderToStaticMarkup(
        createElement(HebyStreamRail, {
          stream: { status: "items", items: toStreamItems([ROW]) } as HebyStreamState,
        }),
      ),
    );
    for (const banned of [/\bago\b/i, /\bjust now\b/i, /\bminutes?\b/i, /\bhours?\b/i]) {
      assert.ok(!banned.test(railText), `a computed relative time leaked into the rail: ${banned}`);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 6. EMPTY, UNAVAILABLE AND ABSENT ARE THREE DIFFERENT FACTS.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const empty = renderToStaticMarkup(
      createElement(HebyStreamRail, { stream: { status: "empty" } as HebyStreamState }),
    );
    const unavailable = renderToStaticMarkup(
      createElement(HebyStreamRail, {
        stream: { status: "unavailable", reason: "persistence-not-configured" } as HebyStreamState,
      }),
    );

    assert.ok(empty.includes("data-heby-stream-empty"), "an empty read is addressable");
    assert.ok(unavailable.includes("data-heby-stream-unavailable"), "a failed read is addressable");
    assert.notEqual(textOf(empty).trim(), textOf(unavailable).trim(), "and they do not share a sentence");
    assert.ok(
      unavailable.includes("persistence-not-configured"),
      "the failure names its own reason instead of looking like an empty queue",
    );
    /* Empty is never overstated into a claim about the organization. */
    assert.ok(
      textOf(empty).includes("it is not a statement about what your organization has been doing"),
      "an empty rail refuses the reading that nothing happened",
    );

    /* ABSENT is a third thing: a canvas given no stream renders no rail at all. */
    assert.ok(!renderCanvas({}).includes("Hebun Akışı"), "no stream, no rail frame");
    assert.ok(
      renderCanvas({ stream: { status: "empty" } }).includes("Hebun Akışı"),
      "a stream that was read, and returned nothing, still shows the rail saying so",
    );

    /*
     * AND HEBY CAN BE THE ONLY THING ON THE CANVAS. The rail is dismissible so the presence can own
     * the surface outright. Dismissing is a WIDTH: it reads nothing, marks nothing, and asserts
     * nothing about the records — there is no "mark seen" act anywhere near this control.
     */
    const withRail = renderCanvas({ stream: { status: "empty" } });
    assert.ok(withRail.includes("data-heby-rail-hide"), "the rail can be put away");
    assert.ok(withRail.includes('aria-label="Hide Hebun Akışı"'), "the control names itself");
    assert.ok(withRail.includes("aria-expanded"), "its state is announced, not colour-only");
    const canvasCode = codeOf(read(CANVAS));
    const railBlock = canvasCode.slice(canvasCode.indexOf("data-heby-rail-hide"), canvasCode.indexOf("data-heby-rail-show"));
    assert.ok(railBlock.includes("setRailOpen(false)"), "hiding sets a width");
    for (const act of ["onClose", "acknowledge", "dismissRecord", "markSeen", "resolve"]) {
      assert.ok(!railBlock.includes(act), `hiding the rail must not "${act}"`);
    }
    assert.ok(canvasCode.includes("useState(true)"), "the rail starts open when a read fed it");
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 7. THE RAIL IS NOT NAVIGATION, NOT A STATUS BOARD, AND CARRIES NO FABRICATED EVENT TYPE.
   *
   * These are the five entries the reference depicts. None of them has a read seam, and none of
   * them may appear as vocabulary in the shipped rail.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const html = renderToStaticMarkup(
      createElement(HebyStreamRail, {
        stream: { status: "items", items: toStreamItems([ROW]) } as HebyStreamState,
      }),
    );
    assert.ok(html.includes("<aside"), "the rail is an aside");
    assert.ok(!/<nav/i.test(html), "the Hebun shell already owns navigation");

    const rail = codeOf(read(RAIL));
    for (const fabricated of [
      "uploaded",
      "analysis",
      "analyzing",
      "completed",
      "signal",
      "trend",
      "workflow",
      "agent",
      "online",
      "healthy",
      "synced",
      "scanning",
    ]) {
      assert.ok(
        !new RegExp(fabricated, "i").test(rail),
        `the rail must have no representation for "${fabricated}" — nothing can read it`,
      );
    }
    /* No count, percentage or score may appear in the rail's own copy. */
    assert.ok(!/\d{1,3}\s?%/.test(textOf(html)), "no percentage");
    assert.ok(!/\.length\b/.test(rail), "the rail renders records, never a tally of them");
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 8. THE RAIL AND THE CANVAS PERFORM NO READ AND HOLD NO AUTHORITY.
   *
   * The single read is R3A's own tenant-scoped reader, called from the SERVER page. The client
   * surfaces receive a finished value.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    for (const file of [CANVAS, RAIL, SOURCE_PANEL, STREAM]) {
      const code = codeOf(read(file));
      for (const banned of [".server", "drizzle-orm", "@/db/", "fetch(", "askHebyAction", "resolveTenant"]) {
        assert.ok(!code.includes(banned), `${file} must not reach for "${banned}"`);
      }
    }

    const page = codeOf(read(PAGE));
    assert.ok(
      page.includes("readPendingActionRequests"),
      "the rail is fed by R3A's existing reader, not a new one",
    );
    assert.ok(page.includes("resolveTenantContext"), "the tenant is resolved server-side from the session");
    /* The page invents no query of its own and writes nothing. */
    for (const banned of ["drizzle-orm", "@/db/schema", "insert", "update(", "delete("]) {
      assert.ok(!page.includes(banned), `the Heby route must not "${banned}"`);
    }
    /* An unavailable read stays unavailable — it is never flattened into an empty queue. */
    assert.ok(
      /status:\s*"unavailable",\s*reason:\s*pending\.reason/.test(page),
      "the read's own failure reason is carried, not replaced",
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 8b. G7 ADDED NO WRITER AND NO PROVIDER PATH.
   *
   * A visual migration that quietly acquired the ability to write a row, or to reach a model,
   * would be a change of what Heby IS rather than of what it looks like. Every file G7 introduced
   * or rewrote is swept: none can mutate anything, and none can reach generation.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const G7_FILES = [
      CANVAS,
      RAIL,
      SOURCE_PANEL,
      STREAM,
      DOCK,
      PAGE,
      PANEL,
      "src/features/heby-stream/index.ts",
      "src/components/layout/heby/heby-thread.ts",
      "src/components/layout/heby/heby-turns.tsx",
      "src/components/layout/heby/heby-workspace-client.tsx",
    ];

    for (const file of G7_FILES) {
      const code = codeOf(read(file));
      /* No mutation, in any form the repository uses. */
      for (const writer of [
        ".insert(",
        ".update(",
        ".delete(",
        "transaction(",
        "executeAuthorizedAction",
        "establishGovernanceAuthority",
        "persistExchange",
        "recordActionRequest",
        "approveActionRequest",
      ]) {
        assert.ok(!code.includes(writer), `${file} must have no representation for "${writer}"`);
      }
      /* No path to model generation. G7 does not activate synthesis. */
      for (const provider of [
        "generateHebyModelAnswer",
        "selectModelTransport",
        "claude-model-client",
        "heby-model",
        "anthropic",
        "ANTHROPIC",
      ]) {
        assert.ok(!code.includes(provider), `${file} must not reach the model boundary ("${provider}")`);
      }
      /* And no Live Map or Computer Use, which G7 was explicitly told not to build. */
      for (const outOfScope of ["computer-use", "computerUse", "live-map", "LiveMap"]) {
        assert.ok(!code.includes(outOfScope), `${file} must not reach "${outOfScope}"`);
      }
    }

    /* ZERO SCHEMA. G7 introduced no table and no migration; the durable rows it reads are G6D's. */
    const migrations = readFileSync("src/db/migrations/meta/_journal.json", "utf8");
    assert.ok(
      !/g7/i.test(migrations),
      "G7 added no migration — the evidence it surfaces was already durable at G6D",
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 9. THE AMBER LANGUAGE IS HEBY'S, AND IT DID NOT ESCAPE INTO THE PRODUCT.
   *
   * The Director's instruction was explicit: Heby's surface only, and the shell keeps its existing
   * design-system authority.
   *
   * THE AUDIT FOUND THAT SEPARATION ALREADY EXISTED, and stronger than the plan assumed. The
   * product's tokens live in `src/styles/tokens.css` under `:root`; the emerald that G7 replaces
   * was declared INSIDE `.heby-surface` and was Heby's own identity all along. So the swap is not
   * a scoped override layered on top of a global — it is an edit to a block that was already
   * Heby's, and the shell was never in reach.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const css = read(CSS);
    const tokens = read("src/styles/tokens.css");

    /* The product's own palette, in its own file, untouched. */
    assert.ok(tokens.includes(":root {"), "the product palette is a root scope");
    assert.ok(tokens.includes("--color-primary:        #2563eb"), "the product's primary is unchanged");
    assert.ok(tokens.includes("--color-highlight:      #4f46e5"), "and so is the product's highlight");
    for (const amber of ["#f0b445", "#e0a137", "240, 180, 69"]) {
      assert.ok(!tokens.includes(amber), `${amber} must not reach the product palette`);
    }

    /* Heby's scope, and the amber inside it. */
    const hebyStart = css.indexOf(".heby-surface {");
    const hebyBlock = css.slice(hebyStart, css.indexOf("}", css.indexOf("--heby-floor-lattice")));
    assert.ok(hebyBlock.includes("--color-highlight:      #f0b445"), "Heby's accent is amber");
    assert.ok(hebyBlock.includes("--heby-presence:        #f0b445"), "and so is its presence");

    /* Exactly one Heby token scope: a second block would make "which wins" a question of order. */
    assert.equal(
      (css.match(/^\.heby-surface \{$/gm) ?? []).length,
      1,
      "Heby's tokens are declared in one place",
    );

    /* Every amber literal in this stylesheet is inside that scope. */
    const outsideHeby = css.slice(0, hebyStart);
    for (const amber of ["#f0b445", "#e0a137", "240, 180, 69"]) {
      assert.ok(!outsideHeby.includes(amber), `${amber} must not appear outside the Heby scope`);
    }

    /*
     * STATUS COLOUR IS NOT AN ACCENT. Warning and error keep their own hues inside Heby; pulling
     * them toward amber would make a warning and the accent neighbouring shades of one colour.
     */
    assert.ok(hebyBlock.includes("--color-warning:        #fbbf24"), "warning keeps its own hue");
    assert.ok(hebyBlock.includes("--color-error:          #f87171"), "and so does error");

    /*
     * AND THE COMPONENTS SPEND NO COLOUR OF THEIR OWN. This is why the presence field changed
     * colour with zero source change, and why its released geometry and truthfulness proofs still
     * guard the new look instead of having been rewritten for it.
     */
    for (const file of [CANVAS, RAIL, SOURCE_PANEL, "src/components/layout/heby/heby-visualizer.tsx"]) {
      assert.ok(
        !/#[0-9a-fA-F]{6}\b|rgba?\(/.test(codeOf(read(file))),
        `${file} must carry no colour literal — colour is a scoped token`,
      );
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 10. COLLAPSING THE QUICK PANEL IS NOT CLOSING IT.
   *
   * Closing unmounts the surface and drops the session and the voice claim with it. Collapsing must
   * not: it is a width, and the conversation is still there.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const panel = read(PANEL);
    const code = codeOf(panel);
    assert.ok(code.includes('data-heby-panel-collapse'), "a collapse control exists");
    assert.ok(code.includes('data-heby-panel-expand'), "and it can be undone");
    /* The collapse control calls setCollapsed, never onClose. */
    /*
     * Scoped to the control's OWN element. Slicing to the next occurrence of an icon name would
     * have matched the import line above and produced an empty window — an assertion that can
     * never fail. The window runs from the accessible name to that button's closing tag.
     */
    const collapseStart = code.indexOf('aria-label="Collapse Heby panel"');
    assert.ok(collapseStart > 0, "the collapse control is findable");
    const collapseBlock = code.slice(collapseStart, code.indexOf("</button>", collapseStart));
    assert.ok(collapseBlock.length > 0, "the control's own element was captured");
    assert.ok(collapseBlock.includes("setCollapsed(true)"), "collapsing sets a width");
    assert.ok(!collapseBlock.includes("onClose"), "collapsing never closes the surface");
    /* Both states name themselves for assistive technology. */
    assert.ok(code.includes('aria-expanded={!collapsed}'), "the state is announced, not colour-only");
    /* It starts expanded: a panel the operator opened must show them what they opened. */
    assert.ok(code.includes("useState(false)"), "the panel opens expanded");
  }

  console.log("g7 canvas and firewall checks passed");
}

main();
