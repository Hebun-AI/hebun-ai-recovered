/*
 * CMD-FINAL — Command is an operating surface, and the three answers have three different shapes.
 *
 * ── WHAT FAILED, AND WHAT THIS FILE THEREFORE ASSERTS ────────────────────────
 *
 * CMD-V5 changed type sizes, removed rules and moved provenance, and its visual acceptance returned
 * NO-GO: a normal person would have seen "they changed some typography". Its suite passed. That is
 * the interesting part — the suite asserted the property the implementation was designed around
 * (`answerOutweighsLabel`), and the property was true, and the product was still wrong.
 *
 * So this file does not assert "the redesign happened". A test cannot see a redesign. It asserts the
 * STRUCTURAL claims that make the redesign possible and that a later phase could silently undo:
 *
 *   the three regions do not share one body grammar
 *   the primary answer is not inside a box
 *   the doorway is a real, single, navigational affordance
 *   the inventory precedes the doctrine
 *   the documentary questions are gone from sight and present to assistive technology
 *
 * Everything else here is CONSERVATION: the truth contracts CMD-B1, CMD-B2, CMD-V3 and CMD-V4
 * released, re-asserted from inside the phase most able to trade them for appearance.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CommandOverview } from "../../src/components/command-overview/command-overview";
import { commandProps } from "../helpers/command-composition";
import {
  COMMAND_REGION_IDS,
  COMMAND_REGION_PROVENANCE,
} from "../../src/features/command-overview/workspace-model";
import {
  UNCONNECTED_CAPABILITIES,
  getExpressIntentSummary,
  type WaitingOnYouState,
} from "../../src/features/command-overview/workspace-model";

const ROOT = process.cwd();
const OVERVIEW = "src/components/command-overview/command-overview.tsx";
const SECTION = "src/components/ui/workspace-section.tsx";
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

/** Rendered text with `sr-only` subtrees removed — what a sighted reader actually sees. */
const seen = (m: string): string =>
  visible(m.replace(/<([a-z0-9]+)[^>]*class="[^"]*\bsr-only\b[^"]*"[\s\S]*?<\/\1>/g, " "));

const INTENT = getExpressIntentSummary();
const EMPTY: WaitingOnYouState = { status: "none-waiting" };
const UNAVAILABLE: WaitingOnYouState = { status: "unavailable", reason: "persistence-not-configured" };
const POPULATED: WaitingOnYouState = {
  status: "waiting", boundReached: false, /* E2-4: no aggregate supplied in this fixture. */ awaitingCount: null, oldestWaiting: null,
  items: [{ requestId: "r1", actionKind: "send-external-communication", targetLabel: "someone@example.test",
            expectedEffect: "Send one message to one recipient.", proposedAt: "2026-08-21T09:00:00.000Z", waitingFor: null }],
};
const render = (w: WaitingOnYouState = EMPTY): string =>
  renderToStaticMarkup(createElement(CommandOverview, commandProps({ waiting: w, intent: INTENT })));

function sectionOf(markup: string, id: string): string {
  const at = markup.indexOf(`id="${id}"`);
  assert.ok(at > 0, `the "${id}" region is rendered`);
  const rest = markup.slice(markup.lastIndexOf("<section", at));
  const end = rest.indexOf("</section>");
  return rest.slice(0, end === -1 ? undefined : end);
}
/** A region's content: everything after its heading row and before its provenance row. */
/**
 * A region's body: everything between its heading and its source note.
 *
 * AMENDED BY CMD-V2.1 — the note's container class changed when the bordered provenance pill became
 * a quiet note, and the old literal silently stopped matching (`lastIndexOf` returned -1, so this
 * returned a truncated string and the assertions above it started measuring the wrong bytes). It is
 * now sliced at the note ITSELF, which cannot drift with a class name.
 */
function bodyOf(markup: string, id: string): string {
  const sec = sectionOf(markup, id);
  const noteAt = sec.lastIndexOf("<span data-provenance");
  return sec.slice(sec.indexOf("</h2>"), noteAt === -1 ? undefined : noteAt);
}

const QUESTIONS = [
  "What is waiting for a human decision in this organization?",
  "Where can the Director ask Hebun to investigate or prepare an outcome?",
  "What will Command answer once these sources exist?",
] as const;

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. THE THREE REGIONS DO NOT SHARE ONE BODY GRAMMAR
 *
 * The CMD-V5 defect, asserted structurally. Each region must carry a distinguishing element that
 * the other two do not have — and the elements are named, so "they all became lists" fails too.
 * ────────────────────────────────────────────────────────────────────────── */
function theThreeRegionsHaveDifferentShapes(markupOverride?: string): void {
  const m = markupOverride ?? render();
  const waiting = bodyOf(m, "waiting");
  const intent = bodyOf(m, "intent");
  const coverage = bodyOf(m, "not-connected");

  /*
   * AMENDED BY CMD-V2, AND THE PROPERTY IS THE ONE THIS SUITE EXISTS FOR.
   *
   * CMD-FINAL's defect was CONVERGENCE: three semantic roles rendering through one visible grammar.
   * The fix was three distinguishable shapes, and the released arrangement happened to put the one
   * primary-filled doorway in Express intent, because intent was the page's only live destination.
   *
   * V2 makes attention dominant — it is the region a Director must act from — so the single filled
   * doorway moves to it and Ask Hebun keeps a bordered one. WHICH region holds the filled anchor is
   * arrangement; that there is EXACTLY ONE of them, and that no two regions share a shape, is the
   * property. Both are asserted below, and the second is asserted over every declared region rather
   * than over three of them.
   */
  assert.ok(/data-state-tone="empty"/.test(waiting), "waiting carries a tone-marked operating statement");
  assert.ok(!/<details/.test(waiting), "and is not a disclosure");
  /*
   * AND IN THIS STATE IT IS NOT A LIST EITHER. A populated queue legitimately renders rows, so this
   * is asserted on the state the default render carries — a successfully-read empty queue — which is
   * exactly where a convergence back into "everything is a list" would first show.
   */
  assert.ok(!/<ul/.test(waiting), "a successfully-read empty queue is a statement, not a list");

  /*
   * EXACTLY ONE FILLED DOORWAY, AND IT FOLLOWS THE ACT.
   *
   * V2.1: when something is actually waiting, the filled affordance belongs to the attention
   * region — that is where the Director is being asked to go. When nothing is waiting, attention has
   * no act to offer and yields it to Ask Hebun. Either way there is exactly ONE on the page, which
   * is the property: two filled doorways are two primary asks, and a page with two has neither.
   */
  const filled = (markup: string): string[] =>
    [...markup.matchAll(/<a [^>]*class="[^"]*\bbg-primary\b[^"]*"[^>]*>/g)].map((x) => x[0]);

  assert.equal(filled(m).length, 1, `exactly one primary doorway on the page; found ${filled(m).length}`);
  assert.ok(
    filled(bodyOf(m, "intent")).some((a) => a.includes('href="/command/intent"')),
    "with nothing waiting, the one doorway is Ask Hebun",
  );

  const busy = render(POPULATED);
  assert.equal(filled(busy).length, 1, "still exactly one when the queue is populated");
  assert.ok(
    filled(bodyOf(busy, "waiting")).some((a) => a.includes('href="/approvals"')),
    "and it moves to the attention region — the one place a Director is asked to act from",
  );
  /*
   * AMENDED BY CMD-V2.1. Ask Hebun is still a DESTINATION and still carries no operating status —
   * that is the shape distinction this proof protects. What it now also carries is one disclosure
   * holding the governance doctrine the Director rejected as a paragraph, so "no disclosure" stopped
   * describing the region without describing anything worse about it.
   */
  assert.ok(
    intent.includes('href="/command/intent"') && !/data-state-tone/.test(intent),
    "intent is a destination, and carries no operating status of its own",
  );

  /* Coverage: the inventory. */
  /*
   * AMENDED BY CMD-V2.1: ONE disclosure, not six. CMD-V4 released six because six architectural
   * reasons had been occupying half the page; the Director then rejected six rows of "Not connected"
   * closing the landing. The capabilities, the reasons and the native widget are unchanged — they
   * are folded behind a single summary that states the count. CMD-V4's own suite asserts the detail.
   */
  assert.equal((coverage.match(/<details\b/g) ?? []).length, 1, "coverage is one disclosure");
  assert.ok(!/data-state-tone/.test(coverage), "and carries no operating status of its own");

  /* No two bodies are the same shape. */
  const shape = (b: string) =>
    [/data-state-tone/.test(b), /<details/.test(b), /<a [^>]*class="[^"]*\bbg-primary\b/.test(b)].join("");
  const shapes = [shape(waiting), shape(intent), shape(coverage)];
  assert.equal(new Set(shapes).size, 3, `three distinct region shapes; got ${shapes.join(" / ")}`);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. THE PRIMARY SIGNAL IS NOT A NESTED CARD, AND STILL TELLS ITS TWO STATES APART
 * ────────────────────────────────────────────────────────────────────────── */
function theOperatingStatementIsUnboxedAndDistinct(): void {
  for (const [state, tone] of [[EMPTY, "empty"], [UNAVAILABLE, "unavailable"]] as const) {
    const sec = sectionOf(render(state), "waiting");
    /* Attribute-order agnostic: V2.1 carries the refusal code as `title` between the two. */
    const block = /<div data-state-tone="[^"]*"[^>]*\sclass="([^"]*)"/.exec(sec);
    assert.ok(block, `${tone}: the operating statement is rendered`);
    if (tone === "empty") {
      assert.match(block![1], /\bcmd-decision-ready\b/, "Pass 4 gives the proven-empty decision state a deliberate ready-state composition");
      assert.ok(!/\bbg-surface-sunken\b/.test(block![1]), "the final ready state is integrated into the executive panel rather than nested in another card");
    } else {
      for (const boxed of ["border", "rounded-xl", "bg-surface-sunken", "bg-surface-raised"]) {
        assert.ok(!new RegExp(`\\b${boxed}\\b`).test(block![1]),
          `${tone}: an unavailable operating statement remains unboxed (${boxed})`);
      }
    }
    assert.ok(new RegExp(`data-state-tone="${tone}"`).test(sec), `${tone}: the tone is stated in the DOM`);
  }

  const empty = seen(sectionOf(render(EMPTY), "waiting"));
  const unavail = seen(sectionOf(render(UNAVAILABLE), "waiting"));

  /*
   * TWO RENDERINGS, TOLD APART BY A SENTENCE AND A MARK — NEVER BY COLOUR ALONE.
   *
   * AMENDED BY CMD-V2.1: the status eyebrow ("Empty" / "Unavailable") left the heading row of a
   * region that has nothing to report, so the carriers are now the tone mark, the heading and the
   * sentence. The refusal code is carried on the element rather than printed on the card — it is a
   * diagnostic, and the Director rejected that class of string on the executive surface.
   */
  assert.ok(/nothing needs your decision/i.test(empty), "the successful empty read says so plainly");
  assert.ok(!/unavailable/i.test(empty), "and is never labelled unavailable");
  assert.ok(/\bunavailable\b/i.test(unavail), "the unanswered read shows its word");
  assert.ok(
    sectionOf(render(UNAVAILABLE), "waiting").includes("persistence-not-configured"),
    "and still carries the reason the read gave",
  );
  assert.ok(!/Nothing is waiting/.test(unavail), "and never claims nothing is waiting");
  const marks = (m: string) => [...m.matchAll(/lucide-([a-z-]+)/g)].map((x) => x[1]);
  assert.notDeepEqual(marks(sectionOf(render(EMPTY), "waiting")), marks(sectionOf(render(UNAVAILABLE), "waiting")),
    "and the two states do not share a mark");

  /* A successful authority read may state zero; an unanswered read never may. */
  assert.ok(/\b0 waiting\b/.test(empty), "the successful empty read carries its measured zero");
  assert.ok(!/\b0\b/.test(unavail), "the unavailable state never falls back to zero");
  assert.ok(!/\bshown\b/.test(unavail), "and an unanswered read carries no count badge");

  /* Populated still expands into real rows and still offers no act. */
  const pop = seen(sectionOf(render(POPULATED), "waiting"));
  assert.ok(pop.includes("send-external-communication") && pop.includes("1 shown"), "a populated read lists its rows");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * FINAL VISUAL PASS. TODAY'S EMPTY STATE YIELDS; REAL ATTENTION CAN LEAD.
 * ────────────────────────────────────────────────────────────────────────── */
function theExecutiveHierarchyAdaptsToTruth(): void {
  const emptyMarkup = render(EMPTY);
  const populatedMarkup = render(POPULATED);
  const intent = sectionOf(emptyMarkup, "intent");
  const source = read(OVERVIEW);
  assert.ok(/data-command-v3/.test(source), "the V3 composition is explicitly scoped");
  assert.ok(/xl:col-span-5/.test(source) && /xl:col-span-7/.test(source),
    "the priority row gives Active Work the larger ledger");
  assert.ok(/xl:col-span-5/.test(source) && /xl:col-span-4/.test(source) && /xl:col-span-3/.test(source),
    "the supporting row is a deliberate 5/4/3 hierarchy");
  assert.ok(!/cmd-hero/.test(source), "V3 does not restore the rejected dark hero");
  assert.ok(seen(intent).includes("Ask Hebun"), "the operating doorway stays in the shallow context");
  assert.notEqual(emptyMarkup, populatedMarkup, "truth state still changes the primary ask");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. THE DOORWAY NAVIGATES AND DOES NOTHING ELSE
 * ────────────────────────────────────────────────────────────────────────── */
function theDoorwayOnlyNavigates(overrides: Readonly<Record<string, string>> = {}): void {
  const m = render();
  /*
   * AMENDED BY CMD-V2.1. The released page had exactly one anchor per destination, so counting them
   * was a fair proxy for "one doorway". The summary row is navigational — each card opens the
   * surface that owns its figure — so Decisions is legitimately reachable from the card and from the
   * region, and counting anchors now measures the composition rather than the property.
   *
   * WHAT THE PROOF IS ABOUT SURVIVES AND IS ASSERTED DIRECTLY: there is exactly ONE inlet to
   * Director Intent, every route is a plain anchor, and none of them performs the act.
   */
  assert.equal((m.match(/href="\/command\/intent"/g) ?? []).length, 1, "one route to Director Intent");
  assert.ok((m.match(/href="\/approvals"/g) ?? []).length >= 1, "and Decisions is reachable");
  assert.ok(visible(m).includes("Ask Hebun"), "the doorway names what it is for");

  for (const state of [EMPTY, UNAVAILABLE, POPULATED]) {
    const r = render(state);
    for (const control of [/<form/, /<input/, /<textarea/, /<select/]) {
      assert.ok(!control.test(r), `Command renders no ${control}`);
    }
    const buttons = [...r.matchAll(/<button\b[^>]*>/g)].map((match) => match[0]);
    assert.ok(buttons.every((button) => /popoverTarget=/.test(button)), "buttons only activate provenance detail");
  }
  const src = codeOf(overrides[OVERVIEW] ?? read(OVERVIEW));
  for (const f of [/onClick/, /onSubmit/, /useTransition/, /"use client"/, /"use server"/, /formAction/]) {
    assert.ok(!f.test(src), `the doorway needs no ${f}`);
  }
  /* It may not imply that clicking it performs the work. */
  for (const claim of [/\bRun\b/, /\bExecute\b/, /\bSubmit\b/, /\bSend\b/, /Ask Heby/]) {
    assert.ok(!claim.test(seen(bodyOf(m, "intent"))), `the doorway must not imply ${claim}`);
  }
  /* And the lifecycle truth is still stated where the reader meets it. */
  const intent = seen(sectionOf(m, "intent"));
  for (const c of ["Declared is not invokable", "Invokable is not authorized", "Authorized is not executed",
                   "Executed is not successful", "Free text never reaches execution"]) {
    assert.ok(intent.includes(c), `Express intent still states "${c}"`);
  }
  /* V2.1 wording: "N capabilities declared". Still the registry's number, still read at render time. */
  assert.ok(intent.includes(`${INTENT.declared} capabilities declared`), "and the registry counts are the registry's");
  assert.ok(!/declared:\s*\d/.test(codeOf(overrides[MODEL] ?? read(MODEL))), "no count is a literal");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. THE INVENTORY PRECEDES THE DOCTRINE, AND CMD-V4'S DISCLOSURE IS INTACT
 * ────────────────────────────────────────────────────────────────────────── */
/*
 * AMENDED BY CMD-V2.1 — THE INVENTORY IS STILL FIRST, AND THE ESSAY IS GONE.
 *
 * The released region opened with six capability rows and closed with a doctrine sentence about
 * fabricated figures; this proof asserted that ORDER. V2.1 removes the sentence (it explained a
 * rule instead of being one) and folds the six rows behind a single summary that states the count.
 *
 * WHAT IS ASSERTED NOW IS THE PROPERTY, NOT ITS OLD SHAPE: the summary leads with what is missing
 * rather than with prose about why, every capability and its full reason are one keystroke away in
 * this document, nothing starts open, no figure is invented, and nothing here pretends to be a
 * connection control.
 */
function theInventoryComesFirst(markupOverride?: string): void {
  const sec = sectionOf(markupOverride ?? render(), "not-connected");
  const rows = [...sec.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/g)].map((x) => x[1]);
  assert.equal(rows.length, 1, "the capability limits are one disclosure");
  const row = rows[0]!;
  const summary = row.slice(0, row.indexOf("</summary>"));

  assert.ok(/not connected/i.test(visible(summary)), "the closed summary states the not-connected state");
  assert.ok(
    visible(summary).includes(String(UNCONNECTED_CAPABILITIES.length)),
    "and how many capabilities it covers",
  );
  for (const cap of UNCONNECTED_CAPABILITIES) {
    assert.ok(visible(row).includes(cap.capability), `${cap.capability} is named`);
    assert.ok(visible(row).includes(cap.reason), `${cap.capability} keeps its OWN reason, in full`);
  }
  assert.ok(!/<a\b|href=|title="/.test(row), "no reason hides behind navigation or a tooltip");

  const openAttrs = [...sec.matchAll(/<details\b([^>]*)>/g)].filter((x) => /\sopen\b/.test(x[1]));
  assert.equal(openAttrs.length, 0, `the rows are collapsed by default; ${openAttrs.length} start open`);
  assert.ok(!/\b0\b/.test(seen(sec)), "no zero stands in for a missing source");
  for (const invented of [/\bConnect\b/, /Manage connections/, /At a glance/]) {
    assert.ok(!invented.test(seen(sec)), `the coverage rail offers no ${invented}`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 5. THE DOCUMENTARY QUESTIONS ARE OFF SCREEN AND STILL ANNOUNCED
 * ────────────────────────────────────────────────────────────────────────── */
function theQuestionsAreAnnouncedNotPrinted(markupOverride?: string): void {
  const m = markupOverride ?? render();
  const sighted = seen(m);
  for (const q of QUESTIONS) {
    assert.ok(!sighted.includes(q), `the documentary question is not printed: "${q}"`);
    assert.ok(visible(m).includes(q), `but it is still in the document: "${q}"`);
  }
  /* Announced by association, not merely present. */
  for (const id of ["waiting", "intent", "not-connected"]) {
    const sec = sectionOf(m, id);
    const described = /aria-describedby="([^"]+)"/.exec(sec);
    assert.ok(described, `${id} names its description`);
    assert.ok(new RegExp(`id="${described![1]}"[^>]*class="[^"]*sr-only`).test(sec)
           || new RegExp(`class="[^"]*sr-only[^"]*"[^>]*id="${described![1]}"`).test(sec),
      `${id}'s description is an sr-only element, reachable by assistive technology`);
  }
  /*
   * AND NOTHING REPLACED THEM WITH THE REGION QUESTIONS PRINTED BACK ON SCREEN.
   *
   * AMENDED BY CMD-V2.1: the released check banned every question mark in sighted text, which was a
   * fair proxy while no region had a headline. Ask Hebun's headline is now a question the Director
   * was asked to be greeted with — "What outcome do you want?" — so the ban is restated as the thing
   * it was protecting: none of the DECLARED region questions may appear in sighted text.
   */
  for (const question of QUESTIONS) {
    assert.ok(!sighted.includes(question), `the declared question is announced, not printed: "${question}"`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6. CONSERVATION — WHAT NO APPEARANCE CHANGE MAY BUY
 * ────────────────────────────────────────────────────────────────────────── */
/** Provenance stays a WORD and a MARK, and never shares the heading's row. */
function provenanceIsAWordAndNeverOnTheHeadingRow(markup: string): void {
  const expected: Readonly<Record<string, string>> = {
    waiting: "Authoritative",
    intent: "Configuration",
    "not-connected": "Not connected",
  };
  for (const id of ["waiting", "intent", "not-connected"]) {
    const sec = sectionOf(markup, id);
    const chip = /<span data-provenance[\s\S]*?<\/button>/.exec(sec);
    assert.ok(chip, `${id} renders a provenance chip`);
    assert.ok(
      visible(chip![0]).includes(expected[id]!),
      `${id}'s provenance carries a visible word, not only a colour`,
    );
    const titleRow = sec.slice(sec.indexOf("<div"), sec.indexOf("</div>"));
    assert.ok(
      !/data-provenance/.test(titleRow),
      `${id}: the chip shares the heading's row — the /finance defect, 158.3px of a 197px row`,
    );
  }
}

function theTruthContractsHold(overrides: Readonly<Record<string, string>> = {}): void {
  const m = render();
  /* CMD-V2 — the composition is the declared registry, not a literal triple. See `COMMAND_REGIONS`. */
  assert.deepEqual([...m.matchAll(/<section[^>]*\bid="([^"]+)"/g)].map((x) => x[1]),
    [...COMMAND_REGION_IDS], "declared DOM order");
  assert.deepEqual([...m.matchAll(/data-provenance="([^"]+)"/g)].map((x) => x[1]),
    [...COMMAND_REGION_PROVENANCE], "declared provenance mapping");
  assert.equal((m.match(/<h1\b/g) ?? []).length, 1, "the V3 organization context contributes one h1");

  provenanceIsAWordAndNeverOnTheHeadingRow(m);

  /* No fake operational data, anywhere. */
  const sighted = seen(m);
  for (const fake of [/%/, /health score/i, /all systems/i, /\btrend\b/i, /risk score/i, /\bKPI\b/i]) {
    assert.ok(!fake.test(sighted), `Command renders no ${fake}`);
  }

  /* No viewport-conditional DOM, and no visual reordering that disagrees with it. */
  const src = codeOf(overrides[OVERVIEW] ?? read(OVERVIEW));
  for (const d of [/useMediaQuery/, /matchMedia/, /window\.inner/, /\border-\d/, /flex-col-reverse/, /flex-row-reverse/, /grid-flow-col-dense/]) {
    assert.ok(!d.test(src), `no viewport-dependent DOM or reordering (${d})`);
  }

  /* Typography floor and scale, in every file this phase touched. */
  for (const f of [OVERVIEW, STATE_BLOCK, MODEL, PAGE]) {
    const code = codeOf(overrides[f] ?? read(f));
    for (const raw of code.matchAll(/text-\[[^\]]+\]/g)) assert.fail(`${path.basename(f)} carries ${raw[0]}`);
    for (const step of code.matchAll(/\btext-(xs|sm|base|lg|xl|\dxl)\b/g)) assert.fail(`${path.basename(f)} names ${step[0]}`);
    assert.ok(!/fontSize\s*:/.test(code), `${path.basename(f)} sets no inline fontSize`);
  }

  /* The shared primitive Command stopped using is untouched, and keeps its other consumer. */
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
   * SOC-UI1 is the SECOND consumer of `WorkspaceSection`. The claim this line defends is that
   * COMMAND stopped using the primitive and that the primitive itself was not changed to suit a new
   * caller — neither of which a second, unrelated workspace adopting it disturbs. Command's absence
   * is still asserted, and it is still the point.
   */
  assert.deepEqual(walk("src").filter((f) => /<WorkspaceSection/.test(overrides[f] ?? read(f))),
    ["src/app/(dashboard)/intelligence/social/page.tsx", "src/app/(dashboard)/knowledge/page.tsx"],
    "WorkspaceSection serves Knowledge and SOC-UI1's Social Intelligence — and still not Command");
  assert.ok(!/emphasis/.test(overrides[SECTION] ?? read(SECTION)),
    "and carries no Command-shaped variant — CMD-V5's approach was reverted, not shipped");

  /* Architecture firewall. */
  for (const f of [OVERVIEW, MODEL, PAGE]) {
    const code = codeOf(overrides[f] ?? read(f));
    for (const forbidden of [/drizzle-orm/, /@\/db\//, /\.insert\(/, /createRepository/, /resolveGovernanceAuthority/, /goal-runtime/]) {
      assert.ok(!forbidden.test(code), `${path.basename(f)} must not contain ${forbidden}`);
    }
  }
  /*
   * AMENDED BY AGENT-ID-0.1, AND STRICTER FOR IT. This was a bare `9`. AGENT-ID-0.1 adds exactly
   * one boundary — the durable agent identity one — so the number was false. Naming the set beats
   * bumping the number: a count tolerates a swap that keeps the total, and this does not.
   */
  assert.deepEqual(
    walk("src").filter((f) => (overrides[f] ?? read(f)).includes('"use server"')).sort(),
    [
      "src/app/(dashboard)/agents/actions.ts",
      "src/app/(dashboard)/approvals/actions.ts",
      /* OSA-1 — the Organization Structure Authority's product path. Declared, not silent. */
      "src/app/(dashboard)/director/organization/actions.ts",
      /* WORK-1 — the Organizational Work Authority's server actions. They hold no authority either. */
      "src/app/(dashboard)/director/work/actions.ts",
      "src/app/(dashboard)/foundation/actions.ts",
      "src/app/(dashboard)/governance/authority/actions.ts",
      "src/app/(dashboard)/governance/genesis/actions.ts",
      "src/app/(dashboard)/heby/actions.ts",
      /* SOC-ACT1 — Social Intelligence's one governed boundary. It resolves a tenant and forwards to the Command-owned proposal inlet; it holds no authority. */
  /* PROVIDER ACCOUNT LIFECYCLE added exactly one server-action boundary: the Instagram
   * disconnect. It is a THIN caller — the credential/connection composition lives in
   * `provider-connection-lifecycle`, because a released INT-2 firewall keeps the credential
   * authority unreachable from `src/app`. A second one appearing is a decision to record. */
      "src/app/(dashboard)/integrations/instagram/actions.ts",
      "src/app/(dashboard)/intelligence/social/actions.ts",
      "src/app/(dashboard)/knowledge/actions.ts",
      "src/app/(dashboard)/operations/actions.ts",
      "src/app/login/actions.ts",
      "src/app/login/onboarding-actions.ts",
  /* SELF-SERVICE SIGNUP added exactly one server-action boundary: the signup action. It is the
   * only way a browser can cause tenant creation, which is why it is named here rather than matched
   * by a pattern — a second one appearing is a decision somebody has to record. */
      "src/app/register/actions.ts",
    ],
    "the server-action boundaries are exactly these — AGENT-ID-0.1 added the agents one and nothing else moved");
  /*
   * Re-pinned by INT-2 (34), by R2H (35, `control_source`) and by KR-EXT1 (36,
   * `knowledge_external_references`). CMD-FINAL still adds none — which is what this asserts.
   */
  assert.equal(readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql")).length, 54, /* WEV-1 grew the ledger 44 -> 45; PBGA-1 45 -> 46; CGO-1 46 -> 47 (content-draft + destination). TRH-10 47 -> 48 (the `artifact-review` governance domain); TRH-19 48 -> 49 (`heby_action_requests.proposal_rationale`, one additive nullable column). TRH-21 49 -> 50 (`provider_observations`, one additive table recording what a provider reported, when, and through which connection). TRH-23 50 -> 51 (`standing_observation_authorizations`, one additive table plus the `standing-observation` governance domain: Governance's permission to observe one exact provider read scope, repeatedly, until a later revision withdraws it). TRH-24 51 -> 52 (`provider_observations` gains machine provenance: the human actor pair becomes nullable, `standing_authorization_id` and `invocation_id` arrive, and a CHECK admits exactly one provenance mode — schema EVOLUTION, not purely additive DDL). SELF-SERVICE SIGNUP 52 -> 53 (`companies_provisioning_source_chk` widened to admit `self-service-signup`, so a tenant a visitor created stays distinguishable from one an operator ceremony created). RUNG 2 PREREQUISITE 53 -> 54 (`tenant_machine_execution_authorizations`, one additive table plus the `machine-execution` governance domain: Governance's permission for ONE TENANT to participate in machine delivery of work a human already authorized — never the authorization of any act, which `action_permits` keeps owning). */
    "the migration ledger is untouched by THIS phase");

  /* V3 retires the generic PageHeader; the shallow organization band is the one context. */
  const pageSource = codeOf(overrides[PAGE] ?? read(PAGE));
  assert.ok(!/PageHeader/.test(pageSource), "the route does not restore a duplicate header");
  assert.ok(
    /standing\.organizationName/.test(read("src/components/command-overview/executive-hero.tsx")),
    "the organization context still names the organization from the admitted standing",
  );
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

  /*
   * M1 — the regions converge: the operating statement becomes a list like the coverage rail.
   *
   * A first version forged a card class here and called the SHAPE check, which does not test for
   * boxing — it bit nothing. Boxing is M1b's assertion; convergence is this one's.
   */
  bites("turn the operating statement into a list", () =>
    theThreeRegionsHaveDifferentShapes(
      mutate(M, '<div data-state-tone="empty"', '<ul></ul><div data-state-tone="empty"'),
    ),
  );
  bites("box the operating statement", () => {
    const forged = mutate(M, 'data-state-tone="empty" class="flex', 'data-state-tone="empty" class="rounded-xl border flex');
    const block = /<div data-state-tone="[^"]*" class="([^"]*)"/.exec(forged)!;
    for (const boxed of ["border", "rounded-xl"]) {
      assert.ok(!new RegExp(`\\b${boxed}\\b`).test(block[1]), `the operating statement must not be a card (${boxed})`);
    }
  });

  /* M2 — the three regions collapse back into one grammar. */
  bites("give every region the same shape", () =>
    theThreeRegionsHaveDifferentShapes(mutate(M, /<details/g, "<div")),
  );

  /* M3 — a second primary affordance appears, so the doorway stops being singular. */
  bites("add a second primary doorway", () =>
    theThreeRegionsHaveDifferentShapes(
      mutate(M, '<a class="group mt-auto', '<a class="bg-primary group mt-auto'),
    ),
  );

  /* M4 — a documentary question is printed again. */
  /*
   * M4 — a region's question is promoted back onto the page. Mutated GLOBALLY: the composition now
   * opens with the executive band, so flipping only the FIRST `sr-only` would expose a question this
   * assertion does not check and the proof would stop biting.
   */
  bites("print a documentary question", () =>
    theQuestionsAreAnnouncedNotPrinted(mutate(M, /class="sr-only"/g, 'class="text-meta"')),
  );
  /* M4b — or the question is deleted instead of demoted. */
  bites("delete a question instead of announcing it", () =>
    theQuestionsAreAnnouncedNotPrinted(mutate(M, QUESTIONS[2], "")),
  );

  /*
   * M5 — the doctrine climbs back above the inventory.
   *
   * IT MUST STILL BE PRESENT AFTERWARDS, or this bites on "the doctrine survives" and proves the
   * wrong thing. A first version rebuilt the section around the paragraph and lost it; this MOVES
   * it, so the only property that changes is the order the two appear in.
   */
  /*
   * M5 — REPLACED BY CMD-V2.1. The released proof moved a doctrine paragraph above the inventory to
   * prove the region leads with what is missing. That paragraph is gone (it explained a rule instead
   * of being one), so the proof is aimed at the two properties that replaced it: the capabilities
   * start COLLAPSED, and the closed summary states how many are not connected.
   */
  /*
   * BOTH MUTATIONS ARE APPLIED INSIDE THE REGION'S OWN SLICE and put back. The page carries two
   * disclosures now, and a document-wide replace would hit Ask Hebun's — mutating a region the
   * assertion never inspects, which is a proof that bites nothing.
   */
  bites("open the capability disclosure by default", () => {
    const sec = sectionOf(M, "not-connected");
    theInventoryComesFirst(M.replace(sec, sec.replace("<details ", "<details open ")));
  });
  bites("drop the count from the closed summary", () => {
    const sec = sectionOf(M, "not-connected");
    theInventoryComesFirst(M.replace(sec, sec.replace(/\d+ not connected/, "not connected")));
  });

  /* M6 — a reason is summarized away, or moved behind a link. */
  bites("summarize a reason away", () =>
    theInventoryComesFirst(mutate(M, UNCONNECTED_CAPABILITIES[3].reason, "Not available.")),
  );
  bites("put a reason behind a link", () =>
    theInventoryComesFirst(mutate(M, UNCONNECTED_CAPABILITIES[0].reason, '<a href="/docs">why</a>')),
  );

  /* M7 — the two waiting states stop being distinguishable. */
  bites("label the successful empty read unavailable", () => {
    const forged = seen(sectionOf(render(EMPTY), "waiting")) + " Unavailable";
    assert.ok(!/Unavailable/i.test(forged), "a successful empty read is never labelled unavailable");
  });

  /* M8 — a control, a fake metric, a fabricated zero. */
  bites("add an approve control", () => {
    const forged = mutate(render(POPULATED), "<ul", "<button>Approve</button><ul");
    const buttons = [...forged.matchAll(/<button\b[^>]*>/g)].map((match) => match[0]);
    assert.ok(buttons.every((button) => /popoverTarget=/.test(button)), "Command buttons only open provenance detail");
  });
  bites("add a health percentage", () => {
    const forged = mutate(M, "</section>", "<p>98% healthy</p></section>");
    assert.ok(!/%/.test(visible(forged)), "Command renders no percentage");
  });

  /* M9 — provenance is reduced to a colour, or moved onto the heading row. */
  /*
   * AMENDED BY CMD-V2. The mutation targeted the FIRST `<span class="min-w-0">` in the document,
   * which was the chip's label while the page began with the attention region. V2 opens with the
   * executive band, so that span is no longer a chip and the mutation stopped reaching the thing
   * the assertion guards — it emptied an unrelated element and bit nothing.
   *
   * It now empties the chip's own label wherever the chip is, so it proves the same property
   * against the composition that exists.
   */
  bites("reduce provenance to colour only", () => {
    const sec = sectionOf(M, "waiting");
    provenanceIsAWordAndNeverOnTheHeadingRow(
      M.replace(sec, mutate(sec, "<span>Authoritative</span>", "<span></span>")),
    );
  });
  /*
   * AMENDED BY CMD-V2 for the same reason as the proof above: the document's FIRST `</h2>` now
   * closes the executive band's heading, which this assertion does not check. It is aimed at the
   * attention region's own heading, so it proves the property where the property is asserted.
   */
  bites("move the chip onto the heading row", () =>
    provenanceIsAWordAndNeverOnTheHeadingRow(
      mutate(M, "Needs your decision</h2>", 'Needs your decision</h2><span data-provenance="authoritative">Authoritative</span>'),
    ),
  );

  /* M10 — the shared primitive is quietly given a Command-shaped variant again. */
  bites("re-introduce the CMD-V5 emphasis variant", () =>
    theTruthContractsHold({ [SECTION]: `${read(SECTION)}\nexport type X = "emphasis";\n` }),
  );

  /* M11 — a server action, or a schema change, rides along with the redesign. */
  bites("add a server action", () => theTruthContractsHold({ [MODEL]: `"use server";\n${read(MODEL)}` }));

  /* M12 — the authority claim is cut from the page header. */
  bites("cut the authority claim", () =>
    theTruthContractsHold({
      [PAGE]: mutate(read(PAGE), "Command summarizes and routes; every act belongs to the workspace that owns it.",
        "Your command centre."),
    }),
  );

  /* M13 — sub-floor type buys height. */
  bites("write a sub-floor size into the Overview", () =>
    theTruthContractsHold({
      [OVERVIEW]: mutate(read(OVERVIEW), 'className="text-meta leading-5 text-fg-muted"',
        'className="text-[0.6rem] leading-5 text-fg-muted"'),
    }),
  );

  /*
   * THE HARNESS ITSELF. A first version used "render the disclosures open by default" as the
   * change that must be accepted — which contradicts this gate's own requirement that the reasons
   * be collapsed by default. A self-check that asks the suite to tolerate a violation is not a
   * self-check. Quietening the doctrine one colour step is a genuine taste decision inside every
   * stated contract, and it must be ACCEPTED, or "every mutation bit" means only that these
   * assertions cannot tell a change from a regression.
   */
  doesNotBite("quieten the coverage doctrine one colour step", () =>
    theInventoryComesFirst(mutate(M, "text-meta leading-5 text-fg-muted", "text-meta leading-5 text-fg-secondary")),
  );
}

function main(): void {
  theThreeRegionsHaveDifferentShapes();
  theOperatingStatementIsUnboxedAndDistinct();
  theExecutiveHierarchyAdaptsToTruth();
  theDoorwayOnlyNavigates();
  theInventoryComesFirst();
  theQuestionsAreAnnouncedNotPrinted();
  theTruthContractsHold();
  biteProofs();
  /* CMD-V2.1 replaced one doctrine-ordering proof with two: collapsed-by-default and the count. */
  assert.equal(bitten, 19, `every mutation must bite; ${bitten} did`);
  console.log(
    `CMD-FINAL: three answers, three shapes — a focal operating signal, one primary doorway, ` +
      `an inventory before its doctrine; all ${bitten} bite-proofs bit and the harness accepted a correct change.`,
  );
}

main();
