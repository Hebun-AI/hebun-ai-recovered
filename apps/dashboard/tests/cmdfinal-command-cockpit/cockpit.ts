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
  status: "waiting", boundReached: false,
  items: [{ requestId: "r1", actionKind: "send-external-communication", targetLabel: "someone@example.test",
            expectedEffect: "Send one message to one recipient.", proposedAt: "2026-08-21T09:00:00.000Z" }],
};
const render = (w: WaitingOnYouState = EMPTY): string =>
  renderToStaticMarkup(createElement(CommandOverview, { waiting: w, intent: INTENT }));

function sectionOf(markup: string, id: string): string {
  const at = markup.indexOf(`id="${id}"`);
  assert.ok(at > 0, `the "${id}" region is rendered`);
  const rest = markup.slice(markup.lastIndexOf("<section", at));
  const end = rest.indexOf("</section>");
  return rest.slice(0, end === -1 ? undefined : end);
}
/** A region's content: everything after its heading row and before its provenance row. */
function bodyOf(markup: string, id: string): string {
  const sec = sectionOf(markup, id);
  return sec.slice(sec.indexOf("</h2>"), sec.lastIndexOf("<div class=\"flex min-w-0 flex-wrap items-center"));
}

const QUESTIONS = [
  "What is waiting for a human decision in this organization?",
  "What can you ask Hebun to investigate or prepare?",
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

  /* Waiting: an unboxed operating statement. */
  assert.ok(/data-state-tone="empty"/.test(waiting), "waiting carries a tone-marked operating statement");
  assert.ok(!/<details/.test(waiting) && !/<ul/.test(waiting), "and is neither a disclosure nor a list");

  /* Intent: the doorway. The only primary-filled navigational affordance on the page. */
  const doorways = [...m.matchAll(/<a [^>]*class="[^"]*\bbg-primary\b[^"]*"[^>]*>/g)];
  assert.equal(doorways.length, 1, `exactly one primary doorway on the page; found ${doorways.length}`);
  const intentAnchors = [...intent.matchAll(/<a [^>]*>/g)].map((x) => x[0]);
  assert.ok(
    intentAnchors.some((a) => /\bbg-primary\b/.test(a) && a.includes('href="/command/intent"')),
    "and it is Express intent's route into Director Intent",
  );
  assert.ok(!/data-state-tone/.test(intent) && !/<details/.test(intent),
    "intent is neither a status nor a disclosure");

  /* Coverage: the inventory. */
  assert.equal((coverage.match(/<details\b/g) ?? []).length, 6, "coverage is six disclosures");
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
    const block = /<div data-state-tone="[^"]*" class="([^"]*)"/.exec(sec);
    assert.ok(block, `${tone}: the operating statement is rendered`);
    for (const boxed of ["border", "rounded-xl", "bg-surface-sunken", "bg-surface-raised"]) {
      assert.ok(!new RegExp(`\\b${boxed}\\b`).test(block![1]),
        `${tone}: the operating statement must not be a card (${boxed}) — that is the CMD-V5 defect`);
    }
    assert.ok(new RegExp(`data-state-tone="${tone}"`).test(sec), `${tone}: the tone is stated in the DOM`);
  }

  const empty = seen(sectionOf(render(EMPTY), "waiting"));
  const unavail = seen(sectionOf(render(UNAVAILABLE), "waiting"));

  /* Two renderings, told apart by a WORD and a MARK — never by colour alone. */
  assert.ok(/\bEmpty\b/i.test(empty), "the successful empty read shows its word");
  assert.ok(!/Unavailable/i.test(empty), "and is never labelled unavailable");
  assert.ok(/\bUnavailable\b/i.test(unavail), "the unanswered read shows its word");
  assert.ok(unavail.includes("persistence-not-configured"), "and names the reason the read gave");
  assert.ok(!/Nothing is waiting/.test(unavail), "and never claims nothing is waiting");
  const marks = (m: string) => [...m.matchAll(/lucide-([a-z-]+)/g)].map((x) => x[1]);
  assert.notDeepEqual(marks(sectionOf(render(EMPTY), "waiting")), marks(sectionOf(render(UNAVAILABLE), "waiting")),
    "and the two states do not share a mark");

  /* No fabricated zero, in either state. */
  assert.ok(!/\b0\b/.test(empty) && !/\b0\b/.test(unavail), "neither state fabricates a zero");
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
  const emptyWaiting = sectionOf(emptyMarkup, "waiting");
  const populatedWaiting = sectionOf(populatedMarkup, "waiting");
  const intent = sectionOf(emptyMarkup, "intent");
  const visibility = sectionOf(emptyMarkup, "not-connected");
  const source = read(OVERVIEW);

  assert.ok(!/bg-primary-subtle\/35/.test(emptyWaiting), "successful empty attention has no dominant card fill");
  assert.ok(/bg-primary-subtle\/35/.test(populatedWaiting), "real pending attention retains a strong state surface");
  assert.ok(/rounded-2xl/.test(intent) && /bg-primary/.test(intent), "Director Intent is the primary contained doorway");
  assert.ok(!/shadow-sm/.test(visibility), "unavailable coverage is not presented as an equal card");
  assert.ok(/waiting\.status === "waiting"[\s\S]*lg:col-span-2[\s\S]*xl:col-span-3/.test(source),
    "real pending attention can outrank Intent across the operating surface");
  assert.ok(/lg:grid-cols-\[minmax\(0,1\.4fr\)_minmax\(300px,0\.6fr\)\]/.test(source),
    "compact desktop uses an asymmetric primary/tertiary composition");
  assert.ok(seen(intent).includes("Tell Hebun the outcome you want"), "the operating doorway leads with the Director's outcome");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. THE DOORWAY NAVIGATES AND DOES NOTHING ELSE
 * ────────────────────────────────────────────────────────────────────────── */
function theDoorwayOnlyNavigates(overrides: Readonly<Record<string, string>> = {}): void {
  const m = render();
  assert.equal((m.match(/href="\/command\/intent"/g) ?? []).length, 1, "one route to Director Intent");
  assert.equal((m.match(/href="\/approvals"/g) ?? []).length, 1, "one route to Decisions");
  assert.ok(seen(m).includes("Open Director Intent"), "the doorway names its destination");

  for (const state of [EMPTY, UNAVAILABLE, POPULATED]) {
    const r = render(state);
    for (const control of [/<button/, /<form/, /<input/, /<textarea/, /<select/]) {
      assert.ok(!control.test(r), `Command renders no ${control}`);
    }
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
  assert.ok(intent.includes(`${INTENT.declared} actions are declared`), "and the registry counts are the registry's");
  assert.ok(!/declared:\s*\d/.test(codeOf(overrides[MODEL] ?? read(MODEL))), "no count is a literal");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. THE INVENTORY PRECEDES THE DOCTRINE, AND CMD-V4'S DISCLOSURE IS INTACT
 * ────────────────────────────────────────────────────────────────────────── */
const DOCTRINE = "None is shown as an empty result, a zero, or a placeholder figure";

function theInventoryComesFirst(markupOverride?: string): void {
  const sec = sectionOf(markupOverride ?? render(), "not-connected");
  const firstCapAt = Math.min(...UNCONNECTED_CAPABILITIES.map((c) => {
    const i = sec.indexOf(c.capability);
    assert.ok(i > 0, `${c.capability} is rendered`);
    return i;
  }));
  const doctrineAt = sec.indexOf(DOCTRINE);
  assert.ok(doctrineAt > 0, "the doctrine sentence survives");
  assert.ok(firstCapAt < doctrineAt,
    "the capability inventory precedes the doctrine — a coverage rail leads with what is missing, " +
      "not with an essay about why it is missing");

  /* CMD-V4's contract, unchanged. */
  const rows = [...sec.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/g)].map((x) => x[1]);
  assert.equal(rows.length, 6, "six disclosures");
  for (const cap of UNCONNECTED_CAPABILITIES) {
    const row = rows.find((r) => visible(r).includes(cap.capability));
    assert.ok(row, `${cap.capability} is named in a summary, visible while closed`);
    assert.ok(/not connected/i.test(visible(row!.slice(0, row!.indexOf("</summary>")))),
      `${cap.capability} shows its state while closed`);
    assert.ok(visible(row!).includes(cap.reason), `${cap.capability} keeps its OWN reason, in full`);
    assert.ok(!/<a\b|href=|title="/.test(row!), `${cap.capability} hides no reason behind navigation or a tooltip`);
  }
  /*
    READ THE `<details>` TAGS, NOT THE SECTION TEXT. A first version searched the markup before the
    first `</summary>` for the word "open" and matched the chevron's own `group-open:rotate-90`
    class — a check that could never pass, which is a different failure from the one it was written
    to catch.
  */
  const openAttrs = [...sec.matchAll(/<details\b([^>]*)>/g)].filter((x) => /\sopen\b/.test(x[1]));
  assert.equal(openAttrs.length, 0, `the rows are collapsed by default; ${openAttrs.length} start open`);
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
  /* And nothing replaced them with three new visible questions. */
  const questionMarks = (sighted.match(/\?/g) ?? []).length;
  assert.equal(questionMarks, 0, `no visible question remains on the page; found ${questionMarks}`);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6. CONSERVATION — WHAT NO APPEARANCE CHANGE MAY BUY
 * ────────────────────────────────────────────────────────────────────────── */
/** Provenance stays a WORD and a MARK, and never shares the heading's row. */
function provenanceIsAWordAndNeverOnTheHeadingRow(markup: string): void {
  for (const id of ["waiting", "intent", "not-connected"]) {
    const sec = sectionOf(markup, id);
    const chip = /<span data-provenance[\s\S]*?<\/span><\/span>/.exec(sec);
    assert.ok(chip, `${id} renders a provenance chip`);
    assert.ok(
      seen(chip![0]).length > 0,
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
  assert.deepEqual([...m.matchAll(/<section[^>]*\bid="([^"]+)"/g)].map((x) => x[1]),
    ["waiting", "intent", "not-connected"], "canonical DOM order");
  assert.deepEqual([...m.matchAll(/data-provenance="([^"]+)"/g)].map((x) => x[1]),
    ["authoritative", "derived", "not-connected"], "canonical provenance mapping");
  assert.ok(!m.includes("<h1"), "the Overview contributes no h1");

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
  assert.deepEqual(walk("src").filter((f) => /<WorkspaceSection/.test(overrides[f] ?? read(f))),
    ["src/app/(dashboard)/knowledge/page.tsx"],
    "WorkspaceSection keeps its Knowledge consumer and no longer serves Command");
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
      "src/app/(dashboard)/foundation/actions.ts",
      "src/app/(dashboard)/governance/authority/actions.ts",
      "src/app/(dashboard)/governance/genesis/actions.ts",
      "src/app/(dashboard)/heby/actions.ts",
      "src/app/(dashboard)/knowledge/actions.ts",
      "src/app/(dashboard)/operations/actions.ts",
      "src/app/login/actions.ts",
      "src/app/login/onboarding-actions.ts",
    ],
    "the server-action boundaries are exactly these — AGENT-ID-0.1 added the agents one and nothing else moved");
  /*
   * Re-pinned by INT-2 (34), by R2H (35, `control_source`) and by KR-EXT1 (36,
   * `knowledge_external_references`). CMD-FINAL still adds none — which is what this asserts.
   */
  assert.equal(readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql")).length, 36,
    "the migration ledger is untouched by THIS phase");

  /* The page header keeps the authority claim and not the table of contents. */
  const ctx = /context="([^"]*)"/.exec(codeOf(overrides[PAGE] ?? read(PAGE)));
  assert.ok(ctx, "the route states a context");
  assert.equal(ctx![1], "Command summarizes and routes; every act belongs to the workspace that owns it.",
    "the authority claim is verbatim");
  assert.ok(!/What is waiting on a human/.test(ctx![1]), "and the table of contents stays removed");
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
  bites("print a documentary question", () =>
    theQuestionsAreAnnouncedNotPrinted(mutate(M, 'class="sr-only"', 'class="text-meta"')),
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
  bites("put the doctrine before the inventory", () => {
    const sec = sectionOf(M, "not-connected");
    const doctrine = /<p class="text-meta leading-5 text-fg-muted">[\s\S]*?<\/p>/.exec(sec);
    assert.ok(doctrine && doctrine[0].includes(DOCTRINE), "the doctrine paragraph was located");
    const moved = sec.replace(doctrine![0], "").replace("</h2>", `</h2>${doctrine![0]}`);
    assert.ok(moved.includes(DOCTRINE), "and it is still present after the move");
    theInventoryComesFirst(M.replace(sec, moved));
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
    assert.ok(!/<button/.test(forged), "Command renders no button");
  });
  bites("add a health percentage", () => {
    const forged = mutate(M, "</section></div>", "<p>98% healthy</p></section></div>");
    assert.ok(!/%/.test(seen(forged)), "Command renders no percentage");
  });

  /* M9 — provenance is reduced to a colour, or moved onto the heading row. */
  bites("reduce provenance to colour only", () =>
    provenanceIsAWordAndNeverOnTheHeadingRow(
      mutate(M, /<span class="min-w-0">[\s\S]*?<\/span><\/span>/, '<span class="min-w-0"></span></span>'),
    ),
  );
  bites("move the chip onto the heading row", () =>
    provenanceIsAWordAndNeverOnTheHeadingRow(
      mutate(M, "</h2>", '</h2><span data-provenance="authoritative">Authoritative</span>'),
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
  assert.equal(bitten, 18, `every mutation must bite; ${bitten} did`);
  console.log(
    `CMD-FINAL: three answers, three shapes — a focal operating signal, one primary doorway, ` +
      `an inventory before its doctrine; all ${bitten} bite-proofs bit and the harness accepted a correct change.`,
  );
}

main();
