/* CMD-V3 PASS 4 — first-viewport composition without invented operating truth. */
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";

import { renderCommand } from "../helpers/command-composition";
import { toExecutiveSummary } from "../../src/features/command-overview/workspace-model";
import {
  FIXTURE_CAPABILITY,
  FIXTURE_SECURITY,
  FIXTURE_WORK,
} from "../helpers/command-composition";

const ROOT = process.cwd();
const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");
const visible = (markup: string): string => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function section(markup: string, id: string): string {
  const at = markup.indexOf(`id="${id}"`);
  assert.ok(at >= 0, `${id} is rendered`);
  const start = markup.lastIndexOf("<section", at);
  const tail = markup.slice(start);
  return tail.slice(0, tail.indexOf("</section>") + "</section>".length);
}

function structureMatchesTheReference(): void {
  const markup = renderCommand();
  assert.equal((markup.match(/cmd-signal-card/g) ?? []).length, 4, "four distinct signal cards render");
  assert.match(markup, /grid-cols-2 xl:grid-cols-4/, "signals remain a 2-by-2 grid below desktop");
  assert.match(markup, /group inline-flex size-11/, "Ask Hebun keeps a 44px responsive target");
  assert.match(markup, /cmd-hero-layout absolute inset-0 z-10 grid/, "hero information shares one deliberate layout grid");

  const order = ["waiting", "heby-runtime", "goals", "work-in-motion", "live-map", "connected-systems"]
    .map((id) => markup.indexOf(`id="${id}"`));
  assert.ok(order.every((position) => position >= 0), "every primary and lower operating region exists");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "Decisions → Heby → Goals precede Active Work and the lower grid");

  const overview = read("src/components/command-overview/command-overview.tsx");
  assert.match(overview, /cmd-executive-triad grid/);
  assert.match(overview, /<NeedsYourDecision[\s\S]*<HebyOperatingSurface[\s\S]*<GoalsOperatingSurface/);

  const css = read("src/app/globals.css");
  assert.match(css, /\.cmd-context\s*\{[\s\S]*?min-height:\s*144px/, "desktop hero is shallow");
  assert.match(css, /\.cmd-signal-strip\s*\{[\s\S]*?gap:\s*0\.75rem/, "signal cards are separated by a 12px rhythm");
  assert.match(css, /\.cmd-hero-layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*45fr\)\s*minmax\(0,\s*30fr\)\s*minmax\(13rem,\s*25fr\)/, "desktop hero uses the approved 45/30/25 alignment");
  assert.match(css, /\.cmd-executive-panel\s*\{[\s\S]*?height:\s*272px/, "the three desktop panels share the final compact height");
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1\.16fr\)\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/, "the triad holds the reference-like 37/32/32 balance");
}

function emptyAndDisconnectedRemainDifferent(): void {
  const summary = toExecutiveSummary({
    waiting: { status: "none-waiting" },
    work: FIXTURE_WORK,
    capability: FIXTURE_CAPABILITY,
    security: FIXTURE_SECURITY,
  });
  assert.equal(summary.find((card) => card.key === "attention")?.value, "0", "Decision zero is proven by its authority");
  assert.equal(summary.find((card) => card.key === "work")?.value, "0", "Work zero is proven by its authority");

  const markup = renderCommand();
  const heby = visible(section(markup, "heby-runtime"));
  const goals = visible(section(markup, "goals"));
  assert.match(heby, /Runtime not connected/);
  assert.ok(!/Heby is (live|idle|working|analyzing)|\b\d+%\b/i.test(heby), "Heby claims no current runtime state or progress");
  assert.match(goals, /Not connected/);
  assert.ok(!/\b0\b|%|Reduce churn|SOC2 readiness|Launch enterprise tier/i.test(goals), "Goals shows neither numeric fallback nor seed data");
  assert.ok(!/Your next move|Hebun recommends|Do this next/i.test(visible(markup)), "no unsupported recommendation is introduced");
}

function interactionAndTruthRemainSubordinate(): void {
  const markup = renderCommand();
  assert.equal((markup.match(/<a [^>]*class="[^"]*\bbg-primary\b/g) ?? []).length, 1, "one primary action remains");
  for (const id of ["waiting", "heby-runtime", "goals"]) {
    assert.match(section(markup, id), /data-provenance=/, `${id} keeps its provenance affordance`);
  }
  assert.match(markup, /popoverTarget="heby-operating-surface-provenance"/);
  assert.match(markup, /popoverTarget="goals-operating-surface-provenance"/);
}

function main(): void {
  structureMatchesTheReference();
  emptyAndDisconnectedRemainDifferent();
  interactionAndTruthRemainSubordinate();
  console.log("CMD-V3 Pass 4: first viewport matches the reference structure without invented runtime or goal truth.");
}

main();
