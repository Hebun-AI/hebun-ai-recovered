/*
 * P2 Design System, Phase 2A — Light / Dark theme foundation and shared UI components.
 *
 * Proves, from source:
 *   - the preference resolves per experience (customer → Light, admin → Dark) and refuses anything
 *     but the two names;
 *   - Dark re-points only token names that Light already declares, covers every Light colour token,
 *     and every text / fill pair it creates meets WCAG AA (4.5:1), measured here, not restated;
 *   - Light is untouched: its values are read back from tokens.css;
 *   - only the authenticated workspace mounts the scope, so public pages and sign-in stay Light;
 *   - the new components reference tokens only — no hex, no raw palette class.
 * Interaction (focus, keys) is verified in the browser; the repository has no DOM test runtime.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  THEME_DEFAULTS,
  nextTheme,
  resolveTheme,
  themeCookieName,
} from "../../src/features/theme/theme";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

let failures = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}\n  ${(error as Error).message}`);
  }
}

const tokens = read("src/styles/tokens.css");
const dark = read("src/styles/theme-dark.css");
const globals = read("src/app/globals.css");

const DARK_SELECTOR = ':root:has([data-hebun-theme="dark"])';

function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `${selector} block exists`);
  return css.slice(start, css.indexOf("\n}", start));
}

function declarations(css: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) map.set(m[1]!, m[2]!.trim());
  return map;
}

/* The first :root block of tokens.css is the Light palette. */
const light = declarations(tokens.slice(tokens.indexOf(":root {"), tokens.indexOf("/* ── Type scale")));
const darkTokens = declarations(block(dark, DARK_SELECTOR));
const allTokenNames = new Set(declarations(tokens).keys());

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
function hexOf(name: string): string {
  const value = darkTokens.get(name);
  assert.ok(value && /^#[0-9a-f]{6}$/i.test(value), `${name} is a 6-digit hex in Dark (got ${value})`);
  return value!;
}

test("preference resolves per experience and refuses anything but light/dark", () => {
  assert.equal(THEME_DEFAULTS.customer, "light");
  assert.equal(THEME_DEFAULTS.admin, "dark");
  assert.equal(resolveTheme("customer", undefined), "light");
  assert.equal(resolveTheme("admin", undefined), "dark");
  assert.equal(resolveTheme("customer", "dark"), "dark");
  assert.equal(resolveTheme("admin", "light"), "light");
  for (const junk of ["", "DARK", "auto", "dark;", "<script>"]) {
    assert.equal(resolveTheme("customer", junk), "light", `"${junk}" falls back to the default`);
  }
  assert.notEqual(themeCookieName("customer"), themeCookieName("admin"));
  assert.equal(nextTheme("light"), "dark");
  assert.equal(nextTheme("dark"), "light");
});

test("Dark only re-points token names Light already declares", () => {
  for (const name of darkTokens.keys()) {
    assert.ok(allTokenNames.has(name), `${name} in theme-dark.css is not a tokens.css name`);
  }
});

test("Dark covers every Light colour token", () => {
  for (const name of light.keys()) {
    if (!name.startsWith("--color-")) continue;
    assert.ok(darkTokens.has(name), `${name} has no Dark value`);
  }
  assert.ok(darkTokens.has("--color-overlay"), "the overlay has a Dark value");
});

test("Light is unchanged", () => {
  const expected: Record<string, string> = {
    "--color-bg": "#f7f8fa",
    "--color-surface": "#ffffff",
    "--color-text-primary": "#142033",
    "--color-text-secondary": "#526075",
    "--color-primary": "#2563eb",
    "--color-on-primary": "#ffffff",
    "--color-success": "#047857",
    "--color-error": "#b91c1c",
  };
  for (const [name, value] of Object.entries(expected)) assert.equal(light.get(name), value, name);
});

test("every Dark text and fill pair meets WCAG AA (4.5:1)", () => {
  const grounds = ["--color-bg", "--color-surface", "--color-surface-raised", "--color-surface-sunken"];
  const inks = [
    "--color-text-primary",
    "--color-text-secondary",
    "--color-text-muted",
    "--color-primary",
    "--color-highlight",
    "--color-success",
    "--color-warning",
    "--color-error",
    "--color-info",
  ];
  for (const ink of inks) {
    for (const ground of grounds) {
      const ratio = contrast(hexOf(ink), hexOf(ground));
      assert.ok(ratio >= 4.5, `${ink} on ${ground} is ${ratio.toFixed(2)}:1`);
    }
  }
  const fills: [string, string][] = [
    ["--color-on-primary", "--color-primary"],
    ["--color-on-primary", "--color-primary-hover"],
    ["--color-on-primary", "--color-primary-press"],
    ["--color-on-error", "--color-error"],
    ["--color-on-success", "--color-success"],
    ["--color-on-warning", "--color-warning"],
  ];
  for (const [ink, fill] of fills) {
    const ratio = contrast(hexOf(ink), hexOf(fill));
    assert.ok(ratio >= 4.5, `${ink} on ${fill} is ${ratio.toFixed(2)}:1`);
  }
});

test("Dark is applied by a scope, after Light, and only in the authenticated workspace", () => {
  assert.ok(dark.includes(DARK_SELECTOR), "Dark is keyed to the theme scope element");
  assert.ok(block(dark, DARK_SELECTOR).includes("color-scheme: dark"), "native controls follow Dark");
  const tokensAt = globals.indexOf('@import "../styles/tokens.css";');
  const darkAt = globals.indexOf('@import "../styles/theme-dark.css";');
  assert.ok(tokensAt >= 0 && darkAt > tokensAt, "theme-dark.css is imported after tokens.css");
  assert.match(read("src/app/(dashboard)/layout.tsx"), /<ThemeScope experience="customer">/);
  assert.ok(!read("src/app/layout.tsx").includes("ThemeScope"), "the root layout (public pages) mounts no scope");
  assert.ok(!read("src/app/(public)/layout.tsx").includes("ThemeScope"), "public pages mount no scope");
});

test("Live Map and Heby keep their own dark scopes", () => {
  assert.ok(globals.includes("[data-live-map] {"), "Live Map scope is still declared");
  assert.ok(globals.includes(".heby-surface"), "Heby scope is still declared");
});

test("new components reference tokens only", () => {
  const files = [
    "input",
    "select",
    "checkbox",
    "switch",
    "tabs",
    "modal",
    "toast",
    "tooltip",
    "dropdown",
  ].map((name) => `src/components/ui/${name}.tsx`);
  files.push("src/components/theme/theme-toggle.tsx", "src/components/theme/theme-provider.tsx");
  const raw = /#[0-9a-f]{3,8}\b|\b(?:bg|text|border|ring|outline|fill|stroke)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\b/i;
  for (const file of files) {
    const source = read(file);
    const hit = source.match(raw);
    assert.ok(!hit, `${file} uses a raw colour: ${hit?.[0]}`);
  }
});

if (failures > 0) {
  console.error(`P2 theme foundation: ${failures} failed.`);
  process.exit(1);
}
console.log("P2 theme foundation: all checks passed.");
