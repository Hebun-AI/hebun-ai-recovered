/*
 * CMD-V3 PASS 3 — future-ready means structurally prepared, never fabricated.
 *
 * These assertions intentionally inspect both the pure declarations and the rendered Command
 * surface. A declaration alone cannot prove that a numeric fallback or runtime claim did not enter
 * the UI, while markup alone cannot prove that every future surface has an explicit future owner.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";

import { renderCommand } from "../helpers/command-composition";
import { FUTURE_OPERATING_SURFACES } from "../../src/features/command-overview/workspace-model";

const ROOT = process.cwd();
const PAGE = "src/app/(dashboard)/command/page.tsx";
const OVERVIEW = "src/components/command-overview/command-overview.tsx";
const MODEL = "src/features/command-overview/workspace-model.ts";
const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");
const visible = (markup: string): string => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function surfaceMarkup(markup: string, id: string): string {
  const at = markup.indexOf(`data-future-surface="${id}"`);
  assert.ok(at >= 0, `${id} is rendered in the operating horizon`);
  const open = markup.lastIndexOf("<section", at);
  const tail = markup.slice(open);
  const end = tail.indexOf("</section>");
  assert.ok(end >= 0, `${id} closes its own surface`);
  return tail.slice(0, end + "</section>".length);
}

function futureDeclarationsCarryNoTenantFacts(): void {
  assert.deepEqual(
    FUTURE_OPERATING_SURFACES.map((surface) => surface.id),
    ["goals", "heby-runtime", "briefings"],
    "only the three strategically owned future surfaces are admitted",
  );

  for (const surface of FUTURE_OPERATING_SURFACES) {
    assert.equal(surface.state, "not-connected", `${surface.label} is not presented as empty`);
    assert.ok(surface.owner.length > 0, `${surface.label} names its future owner`);
    assert.ok(!/\d|%/.test(JSON.stringify(surface)), `${surface.label} carries no count or progress value`);
    for (const forbidden of ["count", "progress", "percent", "currentTask", "generatedAt", "items"]) {
      assert.ok(!(forbidden in surface), `${surface.label} carries no ${forbidden} fact`);
    }
  }
}

function renderedStatesAreHonestAndDistinct(): void {
  const markup = renderCommand();
  const limitsAt = markup.indexOf('id="not-connected"');
  assert.ok(limitsAt >= 0, "the operating horizon remains the declared Capability Limits region");
  const limits = markup.slice(limitsAt, markup.indexOf("</section>", limitsAt));
  assert.match(limits, /data-provenance="not-connected"/);
  assert.match(limits, /data-read-state="not-connected"/);
  assert.ok(!/data-read-state="empty"/.test(limits), "not-connected is never encoded as a successful empty read");

  for (const surface of FUTURE_OPERATING_SURFACES.filter((candidate) => candidate.id !== "briefings")) {
    const article = surfaceMarkup(markup, surface.id);
    assert.match(article, /data-capability-state="not-connected"/);
    assert.ok(visible(article).includes("Not connected"), `${surface.label} states the lifecycle condition in words`);
    assert.ok(!/\b0\b|%/.test(visible(article)), `${surface.label} renders no fake zero or progress`);
  }

  const runtime = visible(surfaceMarkup(markup, "heby-runtime"));
  assert.ok(!/Heby is (idle|live|working|analyzing|complete|ready)/i.test(runtime), "Heby Runtime claims no current activity");
  assert.match(runtime, /will appear here when runtime telemetry is available/i, "runtime language is explicitly future-conditional");

  assert.ok(!/data-future-surface="briefings"/.test(markup), "Briefings is not promoted to a fabricated first-viewport artifact surface");
  assert.ok(visible(limits).includes("Executive briefings"), "the briefing capability boundary remains disclosed");
  assert.ok(!/\.pdf\b|\d{4}-\d{2}-\d{2}/i.test(visible(limits)), "Briefings fabricates no artifact row or timestamp");

  assert.ok(!/data-future-surface="recommendation"/.test(markup), "no recommendation surface is rendered");
  assert.ok(!/Your next move|Hebun recommends|Do this next/i.test(visible(markup)), "no unsupported next-move claim appears");
}

function existingAuthoritiesRemainSingular(): void {
  const page = read(PAGE);
  for (const [reader, label] of [
    ["readPendingActionRequests", "Decision"],
    ["readWorkRegister", "Work"],
    ["listConnections", "Integration"],
  ] as const) {
    assert.equal((page.match(new RegExp(`\\b${reader}\\(`, "g")) ?? []).length, 1, `${label} keeps one read seam`);
  }
  assert.equal((page.match(/resolveTenantContext\(\)/g) ?? []).length, 1, "the route resolves the tenant exactly once");

  for (const file of [PAGE, OVERVIEW, MODEL]) {
    const source = read(file);
    assert.ok(!/"use client"/.test(source), `${file} remains server-safe`);
    assert.ok(!/\.insert\(|\.update\(|\.delete\(|"use server"/.test(source), `${file} imports no writer`);
    assert.ok(!/tenantId\s*[:=]/.test(source), `${file} introduces no caller-provided tenant id`);
  }
}

function main(): void {
  futureDeclarationsCarryNoTenantFacts();
  renderedStatesAreHonestAndDistinct();
  existingAuthoritiesRemainSingular();
  console.log("CMD-V3 Pass 3: future operating surfaces are owned, explicitly not connected, and fact-free.");
}

main();
