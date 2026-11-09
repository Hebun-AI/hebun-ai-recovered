/*
 * V1-STAGE-2 — what a schedule may and may not reach, and that its controls render the same on the
 * server and in any browser zone.
 *
 * A schedule is an intent. It may reach the RELEASED proposal path (proposePackagePublication) and
 * nothing that approves, issues, spends, executes or runs unattended. And nothing that does those
 * things may read the intent table: a schedule must never become an authorization by being read.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScheduleContentPublication, ScheduleRowActions } from "../../src/components/operations-preparation/content-schedule-controls";

const ROOT = path.resolve(__dirname, "../..");
const read = (f: string) => readFileSync(path.join(ROOT, f), "utf8");
const walk = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(tsx?)$/.test(e.name) ? [p] : [];
  });
const importsOf = (code: string) => [...code.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);

/* 1. The schedule feature's reach. */
const FEATURE = walk("src/features/content-schedule");
const FORBIDDEN = /action-execution|governed-machine-execution|machine-delivery|standing-|observation-trigger|cron|decide-action-request|consume-action-permit|human-approval|action-authorization\/(decide|consume|issue)/;
for (const f of FEATURE) {
  for (const spec of importsOf(read(f))) assert.ok(!FORBIDDEN.test(spec), `${f} must not import ${spec}`);
}
const writer = read("src/features/content-schedule/write-content-schedule.server.ts");
assert.deepEqual(
  importsOf(writer).filter((s) => s.startsWith("@/features/heby-action-inlet")),
  ["@/features/heby-action-inlet/package-publication-proposal.server"],
  "the only act-adjacent dependency is the released proposal path",
);
console.log(`ok reach: ${FEATURE.length} schedule modules import no approval, permit, execution, machine or cron module`);

/* 2. Nothing that executes or runs unattended reads the intent table. */
const READERS = walk("src").filter((f) => /contentPublicationIntents|content_publication_intents|content-publication-intent/.test(read(f)));
const ALLOWED = new Set([
  "src/db/schema/content-publication-intent.ts",
  "src/db/schema/index.ts",
  "src/features/content-schedule/write-content-schedule.server.ts",
  "src/features/content-schedule/read-content-schedules.server.ts",
]);
assert.deepEqual(READERS.filter((f) => !ALLOWED.has(f.replace(/\\/g, "/"))), [], "only the schedule writer and reader touch the intent table");
assert.deepEqual(walk("src/app/api").filter((f) => /content-schedule|schedule-actions/.test(read(f))), [], "no API route or cron ingress reaches schedules");
const vercel = JSON.parse(read("vercel.json")) as { crons?: { path: string }[] };
assert.ok(!(vercel.crons ?? []).some((c) => /schedul|publish/.test(c.path)), "no cron for schedules or publishing");
console.log("ok isolation: only the schedule writer/reader touch the table; no API route, no cron");

/* 3. The controls render identically in every zone (the viewer's zone is read after mount). */
const ZONES = ["UTC", "Europe/Istanbul", "America/Los_Angeles", "Asia/Kolkata"];
const render = () =>
  renderToStaticMarkup(createElement("div", null,
    createElement(ScheduleContentPublication, { artifactId: "00000000-0000-4000-8000-000000000001", revisionNo: 1, destination: "youtube" }),
    createElement(ScheduleRowActions, { scheduleId: "00000000-0000-4000-8000-000000000002", version: 1, due: true, stale: false, timeZone: "Europe/Istanbul" }),
  ));
const markups = ZONES.map((z) => {
  process.env.TZ = z;
  return render();
});
assert.equal(new Set(markups).size, 1, "identical markup across zones");
assert.ok(markups[0]!.includes("Schedule publishing") && markups[0]!.includes("Propose publication"));
assert.ok(markups[0]!.includes('value="UTC"'), "server render uses UTC until mount");
console.log(`ok render: schedule controls identical across ${ZONES.length} zones`);
console.log("PASS v1 content schedule firewall and render");
