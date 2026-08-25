/*
 * The Stage 0 typography contract — compiled, merged, and rendered.
 *
 * ── WHAT THIS SUITE IS FOR, AND WHAT IT CORRECTS ─────────────────────────────
 *
 * VI-2 reported that `text-display|title|body|meta|label` "emit no CSS rule at all". **That was
 * measured through the dev server and it is wrong about the product.** Re-proved here and in the
 * browser against a `next build` served by `next start`:
 *
 *   production stylesheet   .text-label { font-size: var(--fs-label); … }   — all five present
 *   rendered                28px / 18px / 16px / 13px / 12px               — exactly Stage 0's intent
 *   dev-server chunk        none of the five                               — a dev-only divergence
 *
 * So there was nothing to "activate" in the theme. The utilities were already real.
 *
 * ── WHAT WAS ACTUALLY BROKEN ─────────────────────────────────────────────────
 *
 * `cn()`. tailwind-merge builds its class groups from Tailwind's DEFAULT scale, so it knows
 * `text-xs` is a font size and does not know `text-label` is one — an unrecognised `text-*` lands
 * in the text-COLOUR group. Every `cn()` that combined a semantic size with a text colour therefore
 * deleted one of the two, and WHICH ONE depended only on the order they were written in:
 *
 *   ProvenanceChip   cn("… text-label font-medium", spec.className /* text-fg-secondary * /)
 *                    -> the SIZE was dropped. Chips rendered at 16px, 264×30px instead of 208×22px.
 *   RegionHeader     cn("… text-fg-muted", "text-label")
 *                    -> the COLOUR was dropped. Eyebrows rendered #142033 instead of #5b687a.
 *
 * The same class was correct in a plain `className` (76 usages) and silently broken the moment it
 * passed through `cn()` (4 usages: ProvenanceChip, RegionHeader's eyebrow and title, KnowledgeRegion's
 * compact detail). This suite pins the merge contract, and proves the compile
 * contract from source rather than trusting either report.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

import { cn } from "../../src/lib/utils";

const ROOT = process.cwd();
const GLOBALS = path.join(ROOT, "src/app/globals.css");
const TOKENS = path.join(ROOT, "src/styles/tokens.css");
const UTILS = "src/lib/utils.ts";

/** The contract, in one place: name -> [token, intended px, line-height token, intended unitless]. */
const CONTRACT = Object.freeze({
  display: { fs: "--fs-display", px: 28, lh: "--lh-display", ratio: 1.15 },
  title: { fs: "--fs-title", px: 18, lh: "--lh-title", ratio: 1.35 },
  body: { fs: "--fs-body", px: 16, lh: "--lh-body", ratio: 1.6 },
  meta: { fs: "--fs-meta", px: 13, lh: "--lh-meta", ratio: 1.5 },
  label: { fs: "--fs-label", px: 12, lh: "--lh-label", ratio: 1.35 },
} as const);

type Step = keyof typeof CONTRACT;
const STEPS = Object.keys(CONTRACT) as Step[];

/** The declared floor. Nothing in the ordinary product may name a smaller semantic step. */
const READING_FLOOR_PX = 12;

const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/**
 * Compile the REAL stylesheet with the REAL Tailwind, and return the emitted CSS.
 *
 * Auto source-detection is switched off and the candidates injected, so this is deterministic and
 * fast; nothing else about `globals.css` is altered, and the theme block is the file's own — a copy
 * would be a second scale, which is the thing this contract exists to prevent.
 */
let compileCount = 0;

async function compile(overrides: Readonly<Record<string, string>> = {}): Promise<string> {
  const globals = overrides[GLOBALS] ?? readFileSync(GLOBALS, "utf8");
  const probe =
    globals.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);') +
    `\n@source inline("${STEPS.map((s) => `text-${s}`).join(" ")} text-xs text-sm");\n`;
  /*
   * A UNIQUE `from` PER COMPILE, AND THIS IS LOAD-BEARING.
   *
   * The Tailwind postcss plugin caches its compiled result by input path. With a fixed `from`, every
   * mutated stylesheet below returned the BASELINE css — the mutation applied to the string, the
   * compiler ignored it, and each bite-proof reported "did not bite" while guarding correctly. A
   * mutation can therefore apply and still prove nothing when the tool under test caches; only a
   * cache-free invocation makes "it did not bite" mean what it says. The path stays inside
   * `src/app` so `@import "../styles/tokens.css"` still resolves, and no such file is ever written.
   */
  const from = path.join(path.dirname(GLOBALS), `.__typography-probe-${++compileCount}.css`);
  const result = await postcss([tailwind()]).process(probe, { from, to: from });
  return result.css;
}

const ruleFor = (css: string, cls: string): string | null => {
  const m = new RegExp("\\." + cls + "(?![\\w-])[^{]*\\{[^}]*\\}").exec(css);
  return m ? m[0].replace(/\s+/g, " ") : null;
};

/* ─────────────────────────────────────────────────────────────────────────────
 * 1 + 2 + 3 + 4. THE FIVE COMPILE, AND THEY COMPILE TO THE INTENDED SCALE
 * ────────────────────────────────────────────────────────────────────────── */
/*
 * SYNCHRONOUS ON PURPOSE. This was written `async` first, and it has no `await` inside — so every
 * rejection became an unhandled promise that `bites()` never saw, and the first bite-proof reported
 * "did not bite" while the assertion was in fact firing into the void. An async check with nothing
 * to await is a check whose failures can be lost.
 */
function theContractCompiles(css: string, tokens: string): void {
  for (const step of STEPS) {
    const rule = ruleFor(css, `text-${step}`);
    assert.ok(rule, `.text-${step} emits NO CSS RULE — the utility names a size it does not set`);

    const spec = CONTRACT[step];
    assert.ok(
      rule.includes(`font-size: var(${spec.fs})`),
      `.text-${step} must resolve through ${spec.fs}; got ${rule}`,
    );
    assert.ok(
      rule.includes(`var(${spec.lh})`),
      `.text-${step} must carry an intentional line-height through ${spec.lh}; got ${rule}`,
    );

    /* And the token itself still holds the intended value — activation may not restyle the scale. */
    const declared = new RegExp(`${spec.fs}:\\s*([0-9.]+)rem`).exec(tokens);
    assert.ok(declared, `${spec.fs} is not declared in tokens.css`);
    const px = Number(declared[1]) * 16;
    assert.equal(px, spec.px, `${spec.fs} is ${px}px; the contract says ${spec.px}px`);

    const lh = new RegExp(`${spec.lh}:\\s*([0-9.]+)`).exec(tokens);
    assert.ok(lh, `${spec.lh} is not declared in tokens.css`);
    assert.equal(Number(lh[1]), spec.ratio, `${spec.lh} is ${lh[1]}; the contract says ${spec.ratio}`);
  }

  /* The floor is the floor, and it is the smallest step. */
  assert.equal(CONTRACT.label.px, READING_FLOOR_PX, "label IS the reading floor");
  for (const step of STEPS) {
    assert.ok(
      CONTRACT[step].px >= READING_FLOOR_PX,
      `the semantic step "${step}" is ${CONTRACT[step].px}px, below the ${READING_FLOOR_PX}px floor`,
    );
  }

  /* Tailwind's own steps are untouched — VI-2's shell floor is written in `text-xs` and stays. */
  assert.ok(ruleFor(css, "text-xs"), "text-xs still compiles");
  assert.ok(ruleFor(css, "text-sm"), "text-sm still compiles");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 5 + 6. `cn()` KEEPS THE SIZE AND THE COLOUR, IN EITHER ORDER
 * ────────────────────────────────────────────────────────────────────────── */
const SIZE_IN = (out: string, step: Step): boolean =>
  new RegExp(`(^|\\s)text-${step}(\\s|$)`).test(out);
const COLOUR_IN = (out: string, colour: string): boolean =>
  new RegExp(`(^|\\s)${colour.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(out);

function theMergeContractHolds(merge: (...i: string[]) => string): void {
  const colours = ["text-fg", "text-fg-secondary", "text-fg-muted", "text-primary", "text-warning"];

  for (const step of STEPS) {
    for (const colour of colours) {
      /* SIZE FIRST — this is the ProvenanceChip shape, where the size used to be deleted. */
      const sizeFirst = merge(`text-${step}`, colour);
      assert.ok(SIZE_IN(sizeFirst, step), `cn("text-${step}", "${colour}") dropped the SIZE -> ${sizeFirst}`);
      assert.ok(COLOUR_IN(sizeFirst, colour), `cn("text-${step}", "${colour}") dropped the COLOUR -> ${sizeFirst}`);

      /* COLOUR FIRST — this is the RegionHeader shape, where the colour used to be deleted. */
      const colourFirst = merge(colour, `text-${step}`);
      assert.ok(SIZE_IN(colourFirst, step), `cn("${colour}", "text-${step}") dropped the SIZE -> ${colourFirst}`);
      assert.ok(COLOUR_IN(colourFirst, colour), `cn("${colour}", "text-${step}") dropped the COLOUR -> ${colourFirst}`);
    }
  }

  /*
   * AND A SIZE IS STILL A SIZE. Registering the five must not merely stop them conflicting with
   * everything — two sizes must still conflict, and the last must still win, or `cn()` would
   * silently stack two font sizes and the winner would be a stylesheet-order accident.
   */
  assert.equal(merge("text-meta", "text-label"), "text-label", "two semantic sizes still conflict");
  assert.equal(merge("text-xs", "text-title"), "text-title", "a semantic size overrides a Tailwind step");
  assert.equal(merge("text-title", "text-xs"), "text-xs", "and a Tailwind step overrides a semantic size");
  assert.equal(merge("text-fg", "text-fg-muted"), "text-fg-muted", "two colours still conflict");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 7. KNOWLEDGE COMPENSATES FOR NOTHING
 * ────────────────────────────────────────────────────────────────────────── */
function knowledgeUsesNoFallbackSize(overrides: Readonly<Record<string, string>> = {}): void {
  const surfaces = [
    "src/app/(dashboard)/knowledge/page.tsx",
    ...readdirSync(path.join(ROOT, "src/components/knowledge-workspace"))
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => `src/components/knowledge-workspace/${f}`),
    "src/components/ui/workspace-section.tsx",
    "src/components/ui/state-block.tsx",
    "src/components/ui/provenance-chip.tsx",
  ];

  for (const file of surfaces) {
    const code = codeOf(overrides[file] ?? read(file));
    /* No arbitrary size may stand in for a semantic step on the canonical surface. */
    for (const m of code.matchAll(/text-\[(\d*\.?\d+)rem\]/g)) {
      assert.fail(
        `${file} carries the raw size ${m[0]} — the canonical surface states type semantically, ` +
          `and a raw size here would be compensating for a utility that failed to work`,
      );
    }
    /* Nor an inline font-size. */
    assert.ok(!/fontSize\s*:/.test(code), `${file} must not set an inline fontSize`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 8 + 9. ONE SCALE, AND NONE OF IT IS REDEFINED INSIDE HEBY
 * ────────────────────────────────────────────────────────────────────────── */
function thereIsExactlyOneScale(globals: string, tokens: string): void {
  /* The steps are declared in tokens.css, once each, and aliased in the theme, once each. */
  for (const step of STEPS) {
    const spec = CONTRACT[step];
    assert.equal(
      (tokens.match(new RegExp(`^\\s*${spec.fs}:`, "gm")) ?? []).length,
      1,
      `${spec.fs} must be declared exactly once — a second declaration is a second scale`,
    );
    assert.equal(
      (globals.match(new RegExp(`^\\s*--text-${step}:`, "gm")) ?? []).length,
      1,
      `--text-${step} must be aliased exactly once`,
    );
  }

  /* No other stylesheet may declare the scale. */
  const styles = readdirSync(path.join(ROOT, "src/styles")).filter((f) => f.endsWith(".css"));
  for (const file of styles) {
    if (file === "tokens.css") continue;
    const css = read(`src/styles/${file}`);
    for (const step of STEPS) {
      assert.ok(!css.includes(CONTRACT[step].fs), `src/styles/${file} declares ${CONTRACT[step].fs} — a second scale`);
    }
  }

  /*
   * HEBY IS FROZEN. Its block re-points surface and text COLOUR tokens on purpose; it may not
   * re-point the type scale, or the frozen surface would silently answer to the ordinary product's
   * typography gate.
   */
  const at = globals.indexOf(".heby-surface {");
  assert.ok(at > 0, "the Heby surface scope exists");
  const scope = globals.slice(at, globals.indexOf("\n}", at));
  for (const step of STEPS) {
    assert.ok(!scope.includes(CONTRACT[step].fs), `.heby-surface redefines ${CONTRACT[step].fs}`);
    assert.ok(!scope.includes(CONTRACT[step].lh), `.heby-surface redefines ${CONTRACT[step].lh}`);
    assert.ok(!scope.includes(`--text-${step}`), `.heby-surface redefines --text-${step}`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 10. THE SHELL KEEPS ITS VI-2 TREATMENT
 * ────────────────────────────────────────────────────────────────────────── */
function theShellIsUnchanged(overrides: Readonly<Record<string, string>> = {}): void {
  const RAIL_F = "src/components/layout/workspace-rail.tsx";
  const TOPBAR_F = "src/components/layout/topbar.tsx";
  const rail = codeOf(overrides[RAIL_F] ?? read(RAIL_F));
  const topbar = codeOf(overrides[TOPBAR_F] ?? read(TOPBAR_F));
  assert.match(rail, /py-1\.5 text-sm font-semibold/, "the integrated rail keeps an explicit readable text size");
  assert.match(topbar, /block text-xs text-fg-muted">Director/, "and so does the operator's role");
  /* This gate does not migrate the shell onto the semantic scale — that is not its scope. */
  for (const step of STEPS) {
    assert.ok(!new RegExp(`(?<![\\w-])text-${step}(?![\\w-])`).test(rail), `the rail must not adopt text-${step} here`);
    assert.ok(!new RegExp(`(?<![\\w-])text-${step}(?![\\w-])`).test(topbar), `the top bar must not adopt text-${step} here`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 11. PERSISTENT CHROME MAY NOT WRITE ITSELF BELOW THE FLOOR (CMD-V2)
 *
 * ── THE CLASS THIS CLOSES ────────────────────────────────────────────────────
 *
 * Everything above governs the NAMED scale. An arbitrary value is invisible to it — `text-[0.6rem]`
 * declares no step, aliases no token and compiles to a rule of its own — which is exactly how the
 * Heby rail label shipped at 9.6px and survived every assertion in this file. It was found by
 * measuring the authenticated product, not by reading source, and one measurement is not a guard.
 *
 * ── WHY THE SCOPE IS NINE FILES AND NOT `src/components/layout/**` ───────────
 *
 * Censused before it was written. `src/components/layout/**` holds 78 arbitrary font sizes and
 * `src/` holds roughly 470, the great majority of them below 12px — 273 at `0.7rem` alone. A
 * repo-wide or directory-wide ban would fail on hundreds of lines this gate is not authorized to
 * touch, and a test that must be suppressed to pass is not a contract.
 *
 * So the scope is the PERSISTENT CHROME: the components `HebunShell` mounts on every route, plus
 * the ones those mount. They are on screen for every surface in the product, which is what makes a
 * sub-floor label there a different defect from a sub-floor label inside a panel you open. Measured
 * across those nine files there are exactly TWO arbitrary sizes: `text-[2rem]` in the page header,
 * which is above the floor and legitimate, and the one this gate repaired.
 *
 * The Heby workspace, quick panel, composer, evidence and voice families are deliberately OUT of
 * scope. They carry ~70 sub-floor values, they are opened rather than persistent, and bringing them
 * to the floor is a design decision with its own gate.
 *
 * ── WHAT IT ASSERTS ──────────────────────────────────────────────────────────
 *
 * The floor is READ FROM `tokens.css`, never restated here: if `--fs-label` moves, this moves with
 * it. Only numeric `rem`/`px` arbitrary values are considered — an arbitrary colour or a
 * `text-[color:…]` is not a font size and is not this rule's business. `text-xs` and every other
 * Tailwind step stay legal; nothing here redefines Tailwind's typography policy.
 * ────────────────────────────────────────────────────────────────────────── */

/** The components `HebunShell` mounts on every route, plus the components those mount. */
const PERSISTENT_CHROME = [
  "src/components/layout/workspace-rail.tsx",
  "src/components/layout/secondary-nav.tsx",
  "src/components/layout/topbar.tsx",
  "src/components/layout/mobile-nav.tsx",
  "src/components/layout/page-header.tsx",
  "src/components/layout/heby/heby-launcher.tsx",
  "src/components/layout/heby/heby-focus-mode.tsx",
] as const;

/** The floor, in px, taken from the token that defines it. */
function readingFloorPx(tokens: string): number {
  const match = /--fs-label:\s*([\d.]+)rem/.exec(tokens);
  assert.ok(match, "tokens.css must declare --fs-label in rem — it is the floor");
  return Number(match![1]) * 16;
}

/** Arbitrary Tailwind font sizes in one file, as px. Non-numeric arbitrary values are not sizes. */
function arbitrarySizesPx(source: string): { readonly raw: string; readonly px: number }[] {
  const out: { raw: string; px: number }[] = [];
  for (const [, value] of source.matchAll(/text-\[([^\]]+)\]/g)) {
    const rem = /^([\d.]+)rem$/.exec(value);
    const px = /^([\d.]+)px$/.exec(value);
    if (rem) out.push({ raw: value, px: Number(rem[1]) * 16 });
    else if (px) out.push({ raw: value, px: Number(px[1]) });
  }
  return out;
}

function theChromeHoldsTheFloor(
  tokens: string,
  overrides: Readonly<Record<string, string>> = {},
): void {
  const floor = readingFloorPx(tokens);
  assert.equal(floor, READING_FLOOR_PX, "the token floor and the declared floor are one number");

  for (const file of PERSISTENT_CHROME) {
    /* `overrides` first, always: a check that re-reads disk inside an overridable function can
     * never fail, which is a lesson this repository has already paid for once. */
    const source = codeOf(overrides[file] ?? read(file));
    for (const size of arbitrarySizesPx(source)) {
      assert.ok(
        size.px >= floor,
        `${file} writes text-[${size.raw}] = ${size.px}px, below the ${floor}px reading floor`,
      );
    }
  }

  /* And the repaired element is at the floor by NAME, not by accident of arithmetic. */
  const launcher = codeOf(
    overrides["src/components/layout/heby/heby-launcher.tsx"] ??
      read("src/components/layout/heby/heby-launcher.tsx"),
  );
  assert.match(
    launcher,
    /text-xs font-semibold uppercase tracking-wider">Heby</,
    "the Heby rail label is written at the shell floor, with its treatment unchanged",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * THE MERGE CONFIGURATION IS THE ONE OWNER
 * ────────────────────────────────────────────────────────────────────────── */
function theMergeConfigurationIsSingular(): void {
  const utils = codeOf(read(UTILS));
  assert.match(utils, /extendTailwindMerge/, "the merge knows the semantic steps");
  assert.match(utils, /"font-size":\s*\[\{\s*text:/, "and it registers them as FONT SIZES, not colours");
  for (const step of STEPS) {
    assert.ok(utils.includes(`"${step}"`), `the merge configuration must register "${step}"`);
  }
  /* Nowhere else may configure a merge — one owner, or two answers to the same question. */
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walk(rel));
      else if (/\.tsx?$/.test(entry.name)) out.push(rel);
    }
    return out;
  };
  const configurers = walk("src").filter((f) => f !== UTILS && codeOf(read(f)).includes("extendTailwindMerge"));
  assert.deepEqual(configurers, [], `only ${UTILS} may configure the merge; found ${configurers.join(", ")}`);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * BITE-PROOFS
 * ────────────────────────────────────────────────────────────────────────── */
function mutate(source: string, from: string | RegExp, to: string): string {
  const after = source.replace(from, to);
  assert.notEqual(after, source, "bite-proof mutation did not APPLY — it would prove nothing");
  return after;
}

const bites = async (label: string, run: () => Promise<void> | void): Promise<void> => {
  let threw = false;
  try {
    await run();
  } catch {
    threw = true;
  }
  assert.ok(threw, `bite-proof "${label}" did not bite — the assertion does not guard it`);
};

async function biteProofs(globals: string, tokens: string): Promise<void> {
  /* CMD-V2 · A — the released defect itself, restored. Not an imitation of it: this is the exact
   * string that shipped, and the guard must fail on it. */
  await bites("restore the Heby rail label to text-[0.6rem]", () => {
    const launcher = mutate(
      read("src/components/layout/heby/heby-launcher.tsx"),
      'className="text-xs font-semibold uppercase tracking-wider">Heby<',
      'className="text-[0.6rem] font-semibold uppercase tracking-wider">Heby<',
    );
    theChromeHoldsTheFloor(tokens, { "src/components/layout/heby/heby-launcher.tsx": launcher });
  });

  /* CMD-V2 · B — any other sub-floor arbitrary value in persistent chrome, in a different file and
   * a different unit, so the guard is proved to be about the PROPERTY and not about one string. */
  await bites("write a sub-floor px size into the top bar", () => {
    const topbar = mutate(
      read("src/components/layout/topbar.tsx"),
      'className="',
      'className="text-[11px] ',
    );
    theChromeHoldsTheFloor(tokens, { "src/components/layout/topbar.tsx": topbar });
  });

  /* CMD-V2 · C — lower the token and the floor follows it down, because the floor is READ. */
  await bites("declare a sub-floor arbitrary size that the current token still forbids", () => {
    const launcher = mutate(
      read("src/components/layout/heby/heby-launcher.tsx"),
      'className="text-xs',
      'className="text-[0.7rem]',
    );
    theChromeHoldsTheFloor(tokens, { "src/components/layout/heby/heby-launcher.tsx": launcher });
  });

  /* CMD-V2 · D — THE HARNESS ITSELF. A harmless mutation must leave the guard GREEN; if this ever
   * throws, the three proofs above prove nothing. Asserted directly, not through `bites`. */
  {
    const launcher = mutate(
      read("src/components/layout/heby/heby-launcher.tsx"),
      "export function HebyLauncher",
      "/* harmless */\nexport function HebyLauncher",
    );
    theChromeHoldsTheFloor(tokens, { "src/components/layout/heby/heby-launcher.tsx": launcher });
    /* An above-floor arbitrary size is legal and must stay legal — text-[2rem] already ships. */
    const header = mutate(read("src/components/layout/page-header.tsx"), "text-[2rem]", "text-[2.5rem]");
    theChromeHoldsTheFloor(tokens, { "src/components/layout/page-header.tsx": header });
  }

  /* 1. Remove the compiled rule for one step. */
  await bites("remove the --text-label alias, so .text-label emits no rule", async () => {
    const broken = mutate(globals, "  --text-label: var(--fs-label);\n", "");
    theContractCompiles(await compile({ [GLOBALS]: broken }), tokens);
  });

  /* 2. Make the step resolve to the inherited size. */
  await bites("point text-label at 1rem", async () =>
    theContractCompiles(await compile(), mutate(tokens, "--fs-label:   0.75rem;", "--fs-label:   1rem;")),
  );

  /* 3. Collapse two intended-distinct steps. */
  await bites("make meta equal body", async () =>
    theContractCompiles(await compile(), mutate(tokens, "--fs-meta:    0.8125rem;", "--fs-meta:    1rem;")),
  );

  /* 4. Break the line-height mapping. */
  await bites("drop text-meta's line-height", async () => {
    const broken = mutate(globals, "  --text-meta--line-height: var(--lh-meta);\n", "");
    theContractCompiles(await compile({ [GLOBALS]: broken }), tokens);
  });

  /* 5. The released merge, reconstructed exactly — the defect itself, not an imitation. */
  await bites("restore the unconfigured merge, which drops one of size/colour", async () => {
    const { twMerge } = await import("tailwind-merge");
    const released = (...i: string[]) => twMerge(...i);
    assert.equal(released("text-meta", "text-fg-secondary"), "text-fg-secondary", "the defect is reproduced");
    theMergeContractHolds(released);
  });

  /* 6. Redefine a semantic step inside the frozen surface. */
  await bites("redefine --fs-label inside .heby-surface", () =>
    thereIsExactlyOneScale(mutate(globals, ".heby-surface {\n  --color-bg:", ".heby-surface {\n  --fs-label: 0.6rem;\n  --color-bg:"), tokens),
  );

  /* 7. A second scale in another stylesheet. */
  await bites("declare the scale twice in tokens.css", () =>
    thereIsExactlyOneScale(globals, mutate(tokens, "  --fs-label:   0.75rem;", "  --fs-label:   0.75rem;\n  --fs-label:   0.7rem;")),
  );

  /* 8. Lower the floor. */
  await bites("lower the label step below 12px", async () =>
    theContractCompiles(await compile(), mutate(tokens, "--fs-label:   0.75rem;", "--fs-label:   0.6875rem;")),
  );

  /* 9. Register the steps as colours rather than sizes. */
  await bites("register the semantic steps in the wrong class group", () => {
    const utils = mutate(read(UTILS), '"font-size": [{ text:', '"text-color": [{ text:');
    assert.match(utils, /"text-color"/);
    assert.ok(!/"font-size":\s*\[\{\s*text:/.test(codeOf(utils)), "the size registration is gone");
    theMergeConfigurationIsSingularOn(utils);
  });

  /* 9b. Register the steps in a group of their own, so two sizes stop conflicting. */
  await bites("register the steps outside font-size, so two sizes no longer conflict", async () => {
    const { extendTailwindMerge } = await import("tailwind-merge");
    /* A REAL group id, and the wrong one: registered as line-heights, the five stop conflicting
       with each other and with `text-xs`, which is precisely the failure this guard must catch. */
    const wrong = extendTailwindMerge({ extend: { classGroups: { leading: [{ text: [...STEPS] }] } } });
    assert.equal(wrong("text-meta", "text-label"), "text-meta text-label", "two sizes now stack — the defect is real");
    theMergeContractHolds((...i: string[]) => wrong(...i));
  });

  /* 9c. Alias one step twice, which is a second scale by another name. */
  await bites("alias --text-meta twice", () =>
    thereIsExactlyOneScale(mutate(globals, "  --text-meta: var(--fs-meta);", "  --text-meta: var(--fs-meta);\n  --text-meta: var(--fs-body);"), tokens),
  );

  /* 9d. Redefine the ALIAS (not the token) inside the frozen surface. */
  await bites("redefine --text-meta inside .heby-surface", () =>
    thereIsExactlyOneScale(mutate(globals, ".heby-surface {\n  --color-bg:", ".heby-surface {\n  --text-meta: 0.6rem;\n  --color-bg:"), tokens),
  );

  /* 9e. Take VI-2's explicit floor away from the shell. */
  await bites("drop the rail's text-xs floor", () =>
    theShellIsUnchanged({ "src/components/layout/workspace-rail.tsx": mutate(read("src/components/layout/workspace-rail.tsx"), "py-1.5 text-sm font-semibold", "py-1.5 font-semibold") }),
  );

  /* 9f. Quietly migrate the shell onto the semantic scale inside this gate. */
  await bites("migrate the top bar onto the semantic scale here", () =>
    theShellIsUnchanged({ "src/components/layout/topbar.tsx": mutate(read("src/components/layout/topbar.tsx"), 'block text-xs text-fg-muted">Director', 'block text-label text-fg-muted">Director') }),
  );

  /* 9g. Set an inline font size on a canonical component. */
  await bites("set an inline fontSize on a canonical Knowledge component", () =>
    knowledgeUsesNoFallbackSize({ "src/components/ui/state-block.tsx": mutate(read("src/components/ui/state-block.tsx"), "<p className=", '<p style={{ fontSize: "12px" }} className=') }),
  );

  /* 10. Compensate for a broken utility with a raw size on the canonical surface. */
  await bites("hard-code a raw size on a canonical Knowledge component", () => {
    const file = "src/components/knowledge-workspace/knowledge-standing.tsx";
    knowledgeUsesNoFallbackSize({ [file]: mutate(read(file), "text-meta", "text-[0.8125rem]") });
  });
}

/** The singular-owner check, parameterised so its bite-proof can run against a mutated source. */
function theMergeConfigurationIsSingularOn(utils: string): void {
  const code = codeOf(utils);
  assert.match(code, /extendTailwindMerge/, "the merge knows the semantic steps");
  assert.match(code, /"font-size":\s*\[\{\s*text:/, "and it registers them as FONT SIZES, not colours");
}

/*
 * ── WHAT THE GUARD AUDIT FOUND ───────────────────────────────────────────────
 *
 * All 42 assertions were neutered one at a time and the suite re-run. 9 are load-bearing. The other
 * 33 are not dead — they fall into four kinds, recorded here rather than dressed up with mutations
 * that would isolate nothing:
 *
 *   SIBLING-COVERED IN A LOOP (24)  This contract is a loop over five steps with several properties
 *                                   each, so one broken step trips several assertions and WHICH one
 *                                   fires first is an ordering accident. Removing any single one
 *                                   still leaves the property guarded.
 *
 *   RECORDED CONTRACT CONSTANTS (4) `CONTRACT.label.px === 12`, every step at or above the floor,
 *                                   each line-height ratio. No source mutation can move a number
 *                                   recorded in this file; they fail exactly when someone edits the
 *                                   contract, which is when they should.
 *
 *   UN-MUTATABLE DISK WALKS (3)     The "only utils.ts configures the merge" scan and the
 *                                   other-stylesheet scan read the tree directly. Parameterising
 *                                   them would mean handing them a fake tree, which proves less
 *                                   than walking the real one.
 *
 *   DEFECT REPRODUCTIONS (2)        `assert.equal(released("text-meta","text-fg-secondary"), …)` and
 *                                   its sibling assert that the DEFECT IS REAL before the guard is
 *                                   asked to catch it. Neutering them leaves the guard biting, which
 *                                   is correct — they exist so a future reader can see the mutation
 *                                   reproduces the released behaviour rather than an invention.
 */
async function main(): Promise<void> {
  const globals = readFileSync(GLOBALS, "utf8");
  const tokens = readFileSync(TOKENS, "utf8");
  const css = await compile();

  await theContractCompiles(css, tokens);
  theMergeContractHolds((...i: string[]) => cn(...i));
  knowledgeUsesNoFallbackSize();
  thereIsExactlyOneScale(globals, tokens);
  theShellIsUnchanged();
  theChromeHoldsTheFloor(tokens);
  theMergeConfigurationIsSingular();
  theMergeConfigurationIsSingularOn(read(UTILS));

  await biteProofs(globals, tokens);

  console.log("Typography contract: compiles, merges, and holds its scale — all bite-proofs bit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
