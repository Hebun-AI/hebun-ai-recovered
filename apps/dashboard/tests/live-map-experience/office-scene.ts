/*
 * LIVE MAP PHASE 3B — THE AGENT'S OFFICE, AND WHAT IT MAY NOT SAY.
 *
 * Every agent card carries a small isometric office with a seated robot. It is decoration. It is
 * chosen from an opaque node id, and the lifecycle tone is the only fact it may show, so a reader can
 * never take it for a report of work.
 *
 *     SEATED != WORKING        IN SERVICE != ACTIVE NOW        VARIANT != IDENTITY
 *
 * There is no execution signal in Hebun that could honestly drive motion, so nothing here moves, and
 * nothing here can: the scene is a server component made of static elements.
 *
 * Rendered with `renderToStaticMarkup`. No database, no browser, no network.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AgentOfficeScene,
  AgentOfficeSprite,
  officeVariant,
  type OfficeTone,
} from "../../src/components/live-map/agent-office-scene";
import { LiveMapCanvas } from "../../src/components/live-map/live-map-canvas";
import type { LiveMapNode, LiveMapProjection } from "../../src/features/live-map/contracts";

const read = (p: string): string => readFileSync(path.join(process.cwd(), p), "utf8");
const SOURCE = "src/components/live-map/agent-office-scene.tsx";
const source = read(SOURCE);
const css = read("src/app/globals.css");
const block = css.slice(css.indexOf("[data-live-map] {"), css.indexOf("}", css.lastIndexOf("[data-live-map]")));

function test(name: string, fn: () => void): void {
  fn();
  console.log(`PASS ${name}`);
}

const scene = (nodeId: string, tone?: OfficeTone): string =>
  renderToStaticMarkup(React.createElement(AgentOfficeScene, { nodeId, tone }));

/* Computed independently with a second implementation of FNV-1a, so this pins the algorithm too. */
const PINNED = { room: 3, head: 1 };
const SAMPLE = "agent:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const id = (n: number): string => `agent:${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

/* ── The variant is cosmetic, deterministic and owes nothing to who the agent is ───── */

test("a node id always selects the same office", () => {
  assert.deepEqual(officeVariant(SAMPLE), officeVariant(SAMPLE));
  assert.deepEqual(officeVariant(SAMPLE), PINNED, "the hash is pinned: changing it re-dresses every agent");
});

test("all four rooms and all four heads are reachable, and they vary independently", () => {
  const seen = Array.from({ length: 400 }, (_, n) => officeVariant(id(n)));
  assert.deepEqual([...new Set(seen.map((v) => v.room))].sort(), [1, 2, 3, 4]);
  assert.deepEqual([...new Set(seen.map((v) => v.head))].sort(), [1, 2, 3, 4]);
  assert.ok(new Set(seen.map((v) => `${v.room}-${v.head}`)).size === 16, "every room can hold every head");
});

test("the scene takes an id and a tone, and it is never told a name, a count or an authority", () => {
  assert.match(source, /export function AgentOfficeScene\(\{\s*nodeId,\s*tone,?\s*\}: \{\s*nodeId: string;\s*tone\?: OfficeTone;?\s*\}\)/);
  assert.ok(!source.includes("LiveMapNodeIntelligence") && !source.includes("intelligence"), "no count can reach it");
  assert.ok(!/\.label\b|\.detail\b|sourceAuthority/.test(source), "no word from the projection reaches it");
  assert.ok(!/nodeId\.(split|slice|replace|match|substring)|nodeId\[/.test(source), "the id stays opaque");
});

/* ── The lifecycle tone is the only fact the room shows ───────────────────────────── */

test("each lifecycle word has its own room state", () => {
  const active = scene(SAMPLE, "active");
  assert.ok(active.includes("#lms-robot") && active.includes("#lms-monitor-standby") && active.includes("#lms-lamp-on"));
  const suspended = scene(SAMPLE, "suspended");
  assert.ok(suspended.includes("#lms-robot") && suspended.includes("#lms-monitor-off") && suspended.includes("#lms-lamp-off"));
  const retired = scene(SAMPLE, "retired");
  assert.ok(!retired.includes("#lms-robot") && !retired.includes("#lms-head-"), "a retired agent has an empty chair");
  assert.ok(retired.includes("#lms-chair") && retired.includes("#lms-monitor-off"));
  const unknown = scene(SAMPLE, "indeterminate");
  assert.ok(unknown.includes("#lms-robot") && unknown.includes("#lms-monitor-standby") && unknown.includes("#lms-lamp-off"));
  assert.equal(scene(SAMPLE), unknown, "an absent status claims nothing, so it reads as undetermined");
});

test("in service is not activity: the scene has no state that could mean working", () => {
  assert.ok(!/working|typing|running|busy|executing|in-progress/i.test(source.replace(/\/\*[\s\S]*?\*\//g, "")), "no such state exists");
  assert.ok(!/monitor-(active|work|code|chart)/.test(source), "the only monitor states are standby and off");
});

/* ── Static markup, and nothing that could carry content ──────────────────────────── */

test("the scene is a server component with no behaviour", () => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const banned of ["use client", "useState", "useEffect", "useRef", "dangerouslySetInnerHTML", "onClick", "fetch("]) {
    assert.ok(!code.includes(banned), `the scene must not contain ${banned}`);
  }
});

test("the drawing cannot carry a word, a script, a link or a remote file", () => {
  const markup = renderToStaticMarkup(React.createElement(AgentOfficeSprite)) + scene(SAMPLE, "active");
  for (const element of ["<text", "<title", "<desc", "<script", "<foreignObject", "<image", "<a ", "<style", "<animate", "<set"]) {
    assert.ok(!markup.includes(element), `no ${element} in the drawing`);
  }
  assert.equal(markup.match(/\son[a-z]+=/gi), null, "no event attribute");
  for (const [, target] of markup.matchAll(/href="([^"]*)"/g)) assert.match(target, /^#lms-/, "same document only");
  for (const [, target] of markup.matchAll(/url\(([^)]*)\)/g)) assert.match(target, /^#lms-/, "same document only");
  assert.equal(markup.match(/https?:/g), null, "nothing remote");
});

test("colour comes from the Live Map scope, so the file holds no literal and no identity", () => {
  assert.equal(source.match(/#[0-9a-f]{3,8}\b/gi), null, "no hex in the scene");
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(source), "no agent identity is written down");
  const declared = new Set([...block.matchAll(/(--lms-[a-z0-9-]+):/g)].map((m) => m[1]));
  const spent = new Set([...source.matchAll(/token\("([a-z0-9-]+)"\)/g)].map((m) => `--lms-${m[1]}`));
  for (const [, list] of source.matchAll(/stops=\{\[([^\]]+)\]/g)) {
    for (const [, name] of list.matchAll(/"([a-z0-9-]+)"/g)) spent.add(`--lms-${name}`);
  }
  assert.ok(spent.size > 10, "the census found the palette");
  for (const token of spent) assert.ok(declared.has(token), `${token} is declared in the scope`);
});

test("every id in the drawing is unique, or a reference would resolve to the wrong element", () => {
  const ids = [...renderToStaticMarkup(React.createElement(AgentOfficeSprite)).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length > 20, "the census found the drawing");
  assert.equal(new Set(ids).size, ids.length, `duplicate id in: ${ids.filter((x, i) => ids.indexOf(x) !== i).join(", ")}`);
  for (const target of ["lms-desk", "lms-chair", "lms-robot", "lms-room-1", "lms-head-1"]) assert.ok(ids.includes(target), target);
  const markup = renderToStaticMarkup(React.createElement(AgentOfficeSprite)) + scene(SAMPLE, "active");
  for (const [, reference] of markup.matchAll(/(?:href="#|url\(#)([^")]+)/g)) {
    assert.ok(ids.includes(reference), `${reference} points at nothing`);
  }
  const drawn = renderToStaticMarkup(React.createElement(AgentOfficeSprite));
  for (const group of ["lms-desk", "lms-chair", "lms-robot"]) assert.ok(drawn.includes(`<g id="${group}"`), `${group} is a drawing`);
});

test("the scene is hidden from assistive technology and takes no focus", () => {
  const markup = scene(SAMPLE, "active");
  assert.match(markup, /^<svg[^>]*aria-hidden="true"/);
  assert.match(markup, /^<svg[^>]*focusable="false"/);
  assert.ok(!markup.includes(SAMPLE) && !markup.includes("aaaaaaaa"), "the id is never printed");
  const sprite = renderToStaticMarkup(React.createElement(AgentOfficeSprite));
  assert.match(sprite, /^<svg[^>]*aria-hidden="true"/);
});

/* ── On the card ─────────────────────────────────────────────────────────────────── */

const node = (nodeId: string, label: string, tone: "active" | "retired"): LiveMapNode =>
  ({ nodeId, kind: "agent", label, truth: "authoritative", sourceAuthority: "Durable Agent Identity", detail: [], status: { label: "In service", tone } }) as unknown as LiveMapNode;

const map = (nodes: readonly LiveMapNode[]): string =>
  renderToStaticMarkup(
    React.createElement(LiveMapCanvas, {
      projection: {
        domains: [{ domainId: "agents", label: "Agents", state: nodes.length ? { status: "available", nodes } : { status: "known-empty", detail: "None." } }],
        edges: [],
        freshness: "",
      } as unknown as LiveMapProjection,
    }),
  );

test("one sprite for the whole map, and none on a map with no agent", () => {
  const two = map([node(id(1), "One", "active"), node(id(2), "Two", "active")]);
  assert.equal(two.match(/id="lms-robot"/g)?.length, 1, "two agents share one drawing");
  assert.equal(two.match(/class="lm-scene"/g)?.length, 2, "and each has its own scene");
  assert.ok(!map([]).includes("lms-"), "an empty map draws no office");
});

test("the name never decides the room, and never enters the drawing", () => {
  const room = (m: string): string => m.match(/#lms-room-\d/)?.[0] ?? "";
  assert.equal(room(map([node(SAMPLE, "Heby", "active")])), room(map([node(SAMPLE, "Anything else", "active")])));
  const scenes = map([node(SAMPLE, "Unmistakable Name", "active")]).match(/<svg class="lm-scene".*?<\/svg>/g)?.join("") ?? "";
  assert.ok(scenes.length > 100 && !scenes.includes("Unmistakable"), "the label stays in the text");
});

test("the scene gives way to the words: names wrap, the card grows, the scene keeps its own area", () => {
  assert.ok(!/line-clamp|text-overflow/.test(block), "no name is ever cut");
  assert.ok(/\.lm-node-name \{[^}]*overflow-wrap: anywhere;/.test(block), "a long word still wraps");
  assert.ok(/\.lm-agents \{[^}]*align-items: start;/.test(block), "a long card does not stretch its neighbours");
  assert.ok(/\.lm-agent \{[^}]*container: lm-card \/ inline-size;/.test(block), "the scene follows the card's own width");
  assert.ok(/--lm-scene-width: min\(202px, calc\(100cqw - [0-9.]+rem\)\);/.test(block), "the room is sized from the card");
  assert.ok(/\.lm-scene \{[^}]*width: var\(--lm-scene-width\);/.test(block), "and from nothing else");
  assert.ok(
    /\.lm-field > \.lm-node-body \{ max-width: calc\(100cqw - var\(--lm-scene-width\)/.test(block),
    "beside the room, the text keeps the column the room leaves",
  );
  assert.ok(
    /@container lm-card \(max-width: [0-9.]+rem\) \{[^@]*\.lm-field \{[^}]*padding-bottom: \d+px; \}/.test(css),
    "on a narrow card the scene sits in its own band under the text",
  );
  assert.ok(!/\.lm-scene \{[^}]*scale\(/.test(block), "a fixed scale cannot follow the card, and the words would meet the room");
});

test("high-contrast mode drops the decoration, not the words", () => {
  assert.ok(/@media \(forced-colors: active\) \{[^@]*\.lm-scene \{ display: none; \}/.test(css), "the scene steps aside");
});

test("no part of the scene can move", () => {
  assert.ok(!/animation|@keyframes|transition/.test(block.slice(block.indexOf(".lm-scene"))), "no motion after the scene's rules");
  assert.ok(!/\.lm-scene[^{]*\{[^}]*(animation|transition)/.test(block), "and none on the scene itself");
});

console.log("Live Map office scene: all checks passed.");
