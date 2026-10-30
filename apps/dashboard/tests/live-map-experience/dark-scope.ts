/*
 * LIVE MAP FAZ 1 — THE DARK SCOPE, AND WHAT IT MAY NOT BECOME.
 *
 * The Live Map's content area is dark by repointing the design tokens inside `[data-live-map]` and
 * nowhere else. The shell, the page header and every other surface keep the product palette, and no
 * Live Map rule spends a colour of its own.
 *
 *     LIVE MAP DARK != HEBY          ACCENT != AMBER          STATUS COLOUR != ACCENT
 *
 * Amber is Heby's identity. `g7-flow` only reads the stylesheet BEFORE `.heby-surface`, and the Live
 * Map block sits after it, so that test cannot see this surface. This file can, and it reads the
 * block whole.
 *
 * Static on purpose: stylesheet and markup only. No database, no browser, no network.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (p: string): string => readFileSync(path.join(process.cwd(), p), "utf8");

const css = read("src/app/globals.css");
const tokens = read("src/styles/tokens.css");
const canvas = read("src/components/live-map/live-map-canvas.tsx");
const page = read("src/app/(dashboard)/live-map/page.tsx");

/* From the scope's first rule to the end of its last one: comments included, nothing skipped. */
const blockStart = css.indexOf("[data-live-map] {");
const blockEnd = css.indexOf("}", css.lastIndexOf("[data-live-map]"));
assert.ok(blockStart > 0 && blockEnd > blockStart, "the Live Map block is present");
const block = css.slice(blockStart, blockEnd);
const scope = block.slice(0, block.indexOf("}"));
const rules = block.slice(block.indexOf("}"));

const declared = (name: string): string | undefined =>
  scope.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();

function test(name: string, fn: () => void): void {
  fn();
  console.log(`PASS ${name}`);
}

/* ── Contrast, computed from the declared values ─────────────────────────── */

type Rgb = readonly [number, number, number];

const hex = (value: string): Rgb => {
  const match = value.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  assert.ok(match, `${value} is a six-digit hex colour`);
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
};

const productToken = (name: string): Rgb => {
  const value = tokens.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6});`, "i"))?.[1];
  assert.ok(value, `${name} is a product token`);
  return hex(value);
};

/* `color-mix(in srgb, var(--token) N%, white)`, the only form the accent is allowed to take. */
const accent = (): Rgb => {
  const value = declared("--color-primary") ?? "";
  const match = value.match(/^color-mix\(in srgb, var\((--color-[a-z-]+)\) (\d+)%, white\)$/);
  assert.ok(match, `the accent is derived from a product token, got: ${value}`);
  const base = productToken(match[1]);
  const share = Number(match[2]) / 100;
  return [0, 1, 2].map((i) => base[i] * share + 255 * (1 - share)) as unknown as Rgb;
};

const luminance = (rgb: Rgb): number => {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const token = (name: string): Rgb => {
  const value = declared(name);
  assert.ok(value, `${name} is declared in the dark scope`);
  return hex(value);
};

/* ── Heby's amber ────────────────────────────────────────────────────────── */

test("Heby's amber identity does not reach the Live Map", () => {
  const compact = block.toLowerCase().replace(/\s+/g, "");
  for (const amber of ["#f0b445", "#e0a137", "#c98a29", "#a97120", "#c88a29", "240,180,69", "200,138,41"]) {
    assert.ok(!compact.includes(amber), `${amber} must not appear in the Live Map`);
  }
  assert.ok(!block.includes("--heby-"), "no Heby token is spent here");
  assert.ok(!canvas.includes("heby-surface"), "the map is not mounted inside the Heby scope");
  assert.ok(!scope.includes("amber"), "the scope does not name it either");
});

/* ── The scope ───────────────────────────────────────────────────────────── */

test("the content area owns its dark ground, so no token resolves against the light page", () => {
  assert.ok(declared("color-scheme") === "dark", "native controls follow the scope");
  assert.ok(scope.includes("background: var(--color-bg)"), "the root paints the ground");
  assert.ok(scope.includes("color: var(--color-text-primary)"), "inherited text is light");
});

test("every colour token a Live Map rule spends is repointed inside the scope", () => {
  const spent = new Set([...rules.matchAll(/var\((--color-[a-z-]+)/g)].map((m) => m[1]));
  /* `text-fg-muted` on the icons resolves through this token. */
  spent.add("--color-text-muted");
  assert.ok(spent.size > 5, "the census found the rules");
  for (const name of spent) {
    assert.ok(declared(name), `${name} would fall through to the light palette`);
  }
});

test("colour literals live in the token scope, and no rule spends one", () => {
  assert.equal(rules.match(/#[0-9a-f]{3,8}\b/gi), null, "no hex in a Live Map rule");
  assert.equal(rules.match(/\brgba?\(/gi), null, "no rgb in a Live Map rule");
});

test("the scope stays a scope: nothing outside the block repoints or reaches into it", () => {
  assert.equal((css.match(/^\[data-live-map\] \{$/gm) ?? []).length, 1, "one token scope, declared once");
  assert.equal((tokens.match(/data-live-map/g) ?? []).length, 0, "the product palette is untouched");
  assert.ok(tokens.includes("--color-primary:        #2563eb"), "the product's primary is unchanged");
  assert.ok(tokens.includes("--color-highlight:      #4f46e5"), "and so is its highlight");
  assert.ok(canvas.includes(`<div className="lm-root" data-live-map`), "the root carries the scope");
  assert.ok(!page.includes("data-live-map"), "the page, and so PageHeader, stays outside it");
});

test("the accent comes from the product palette, not from a new colour", () => {
  assert.match(declared("--color-primary") ?? "", /^color-mix\(in srgb, var\(--color-highlight\)/);
  assert.match(declared("--color-primary-subtle") ?? "", /^color-mix\(in srgb, var\(--color-primary\)/);
  assert.match(declared("--color-primary-ring") ?? "", /^color-mix\(in srgb, var\(--color-primary\)/);
});

test("status colour keeps the product's meaning and stays apart from the accent", () => {
  assert.ok(declared("--color-success") !== declared("--color-primary"));
  assert.ok(declared("--color-warning") !== declared("--color-primary"));
  assert.match(declared("--color-success-subtle") ?? "", /var\(--color-success\)/);
  assert.match(declared("--color-warning-subtle") ?? "", /var\(--color-warning\)/);
});

/* ── Legibility ──────────────────────────────────────────────────────────── */

test("every text token reads at AA on every surface it can sit on", () => {
  const grounds = ["--color-bg", "--color-surface", "--color-surface-raised", "--color-surface-sunken"];
  const inks = ["--color-text-primary", "--color-text-secondary", "--color-text-muted", "--color-success", "--color-warning"];
  for (const ground of grounds) {
    for (const ink of inks) {
      const ratio = contrast(token(ink), token(ground));
      assert.ok(ratio >= 4.5, `${ink} on ${ground} is ${ratio.toFixed(2)}:1`);
    }
    const ratio = contrast(accent(), token(ground));
    assert.ok(ratio >= 4.5, `the accent on ${ground} is ${ratio.toFixed(2)}:1`);
  }
});

test("the drawn relationship reads at 3:1, even where the canvas is brightest", () => {
  const match = (declared("--lm-line") ?? "").match(
    /^color-mix\(in srgb, var\(--color-text-muted\) (\d+)%, var\(--color-surface\)\)$/,
  );
  assert.ok(match, "the line is derived from the scope's own tokens");
  const share = Number(match[1]) / 100;
  const [ink, ground] = [token("--color-text-muted"), token("--color-surface")];
  const line = [0, 1, 2].map((i) => ink[i] * share + ground[i] * (1 - share)) as unknown as Rgb;
  /* `.lm-canvas` washes 6% of the accent over the surface, centred where the spine starts. */
  const washed = [0, 1, 2].map((i) => accent()[i] * 0.06 + ground[i] * 0.94) as unknown as Rgb;
  assert.ok(block.includes("color-mix(in srgb, var(--color-primary) 6%, transparent), transparent 60%)"), "the wash is 6%");
  for (const [name, against] of [["surface", ground], ["washed surface", washed]] as const) {
    const ratio = contrast(line, against);
    assert.ok(ratio >= 3, `the line on the ${name} is ${ratio.toFixed(2)}:1`);
  }
  assert.ok(!/\.lm-branch \{[^}]*linear-gradient/.test(block), "and no gradient fades it below that");
});

test("the focus ring reads at 3:1 on every surface a focusable element sits on", () => {
  const match = (declared("--color-primary-ring") ?? "").match(/ (\d+)%, transparent\)$/);
  assert.ok(match, "the ring states its strength");
  const share = Number(match[1]) / 100;
  for (const name of ["--color-surface", "--color-surface-raised", "--color-surface-sunken"]) {
    const ground = token(name);
    const ring = [0, 1, 2].map((i) => accent()[i] * share + ground[i] * (1 - share)) as unknown as Rgb;
    const ratio = contrast(ring, ground);
    assert.ok(ratio >= 3, `the ring on ${name} is ${ratio.toFixed(2)}:1`);
  }
});

test("the reading hierarchy survives the repoint", () => {
  const ground = token("--color-surface");
  const primary = contrast(token("--color-text-primary"), ground);
  const secondary = contrast(token("--color-text-secondary"), ground);
  const muted = contrast(token("--color-text-muted"), ground);
  assert.ok(primary > secondary && secondary > muted, "primary > secondary > muted");
});

console.log("Live Map dark scope: all checks passed.");
