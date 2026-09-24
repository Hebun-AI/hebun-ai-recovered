/*
 * COMMAND-FINAL — first-viewport composition without invented operating truth.
 *
 * The accepted design (command-final) replaced the CMD-V3 first viewport: the four-card KPI strip,
 * the Heby-runtime and Goals blocks and the Capability Limits disclosure are gone, and the operating
 * model reads People + Heby → Needs your decision → Work in motion. This file pins that structure and
 * keeps every refusal the old one enforced.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";

import { renderCommand } from "../helpers/command-composition";

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

function structureMatchesTheAcceptedDesign(): void {
  const markup = renderCommand();
  assert.equal((markup.match(/cmd-signal-card/g) ?? []).length, 0, "the four-card KPI wall is retired");
  assert.ok(!/data-future-surface=/.test(markup), "no large not-connected block occupies the first viewport");
  assert.match(markup, /href="\/command\/intent"/, "Ask Hebun links to Director Intent");

  const order = ["executive-context", "intent", "people-heby", "waiting", "work-in-motion", "live-map", "connected-systems", "recorded-activity"]
    .map((id) => markup.indexOf(`id="${id}"`));
  assert.ok(order.every((position) => position >= 0), "every operating region exists");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "People + Heby → Decisions → Work precede the lower row");

  const overview = read("src/components/command-overview/command-overview.tsx");
  assert.match(overview, /<PeopleAndHeby[\s\S]*<NeedsYourDecision[\s\S]*<WorkInMotion/);

  const css = read("src/app/globals.css");
  assert.match(css, /\.cmd-card-attention\s*\{/, "the decision card carries the contextual attention surface");
  assert.match(css, /\.cmd-live-map-card\s*\{/, "the Live Map keeps its dark surface");
}

function emptyUnavailableAndDisconnectedRemainDifferent(): void {
  const empty = renderCommand({ waiting: { status: "none-waiting" } });
  assert.match(visible(section(empty, "waiting")), /Nothing needs your decision/);
  assert.match(visible(section(empty, "executive-context")), /Nothing is waiting on your decision/);

  const unread = renderCommand({ waiting: { status: "unavailable", reason: "read-failed" } });
  const unreadWaiting = visible(section(unread, "waiting"));
  assert.match(unreadWaiting, /Decision queue unavailable/);
  assert.ok(!/Nothing needs your decision|\b0 waiting\b/.test(unreadWaiting), "an unread queue is never shown as empty");
  assert.match(visible(section(unread, "executive-context")), /could not be read/, "the hero says the queue was not read");
  const basis = unread.slice(unread.indexOf("data-truth-basis"));
  assert.ok(!/Read\s*·[^<]*decisions/.test(visible(basis.slice(0, basis.indexOf("</div>")))), "an unread source is never listed as read");

  const heby = visible(section(renderCommand(), "people-heby"));
  assert.ok(!/Heby is (live|idle|working|analyzing)|\b\d+%\b/i.test(heby), "Heby claims no current runtime state or progress");
  assert.ok(!/Your next move|Hebun recommends|Do this next/i.test(visible(renderCommand())), "no unsupported recommendation is introduced");
}

function interactionAndTruthRemainSubordinate(): void {
  const markup = renderCommand();
  const primaries = (m: string) => m.match(/<a [^>]*class="[^"]*\bbg-primary\b[^"]*"[^>]*>/g) ?? [];
  const waitingPrimaries = primaries(renderCommand({ waiting: { status: "waiting", items: [], boundReached: false, awaitingCount: 1, oldestWaiting: null } }));
  assert.equal(waitingPrimaries.length, 1, "one primary act when something waits");
  assert.match(waitingPrimaries[0]!, /href="\/approvals"/, "and it leads to Decisions");
  const quietPrimaries = primaries(renderCommand({ waiting: { status: "none-waiting" } }));
  assert.equal(quietPrimaries.length, 1, "one primary act when nothing waits");
  assert.match(quietPrimaries[0]!, /href="\/command\/intent"/, "and it is Ask Hebun");
  for (const id of ["people-heby", "waiting", "work-in-motion", "live-map", "connected-systems", "recorded-activity"]) {
    assert.match(section(markup, id), /data-provenance=/, `${id} keeps its provenance affordance`);
  }
}

function main(): void {
  structureMatchesTheAcceptedDesign();
  emptyUnavailableAndDisconnectedRemainDifferent();
  interactionAndTruthRemainSubordinate();
  console.log("COMMAND-FINAL: first viewport matches the accepted design without invented runtime or goal truth.");
}

main();
