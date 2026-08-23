/*
 * PUB-2A — the public visual system.
 *
 * PUB-2A is a PRESENTATION phase. Its whole risk is that presentation quietly becomes something
 * else: a claim, a dependency, a second palette, a page that needs JavaScript to be readable, or a
 * decorative device that a reader could reasonably mistake for a product mechanism. Every assertion
 * below is about one of those, and none of them is about whether the page looks good — that is the
 * Director's gate, not a test's.
 *
 *   1. the page still says exactly what it said, and the trace claims nothing
 *   2. no dependency was installed and no JavaScript runs the visual system
 *   3. motion is a progressive enhancement, twice-gated, and never the only copy of anything
 *   4. reduced motion is handled EXPLICITLY, and does not break the trace's geometry
 *   5. the palette did not inflate — no `.public-*` rule introduces a colour of its own
 *   6. the rhythm is genuinely varied, not nominally parameterised
 *   7. one heading per section, no tab semantics, one shared inset
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const abs = (p: string) => path.join(ROOT, p);
const read = (p: string) => readFileSync(abs(p), "utf8");

const HOME = "src/app/(public)/page.tsx";
const SECTION = "src/components/public/public-section.tsx";
const TRACE = "src/components/public/public-trace.tsx";
const GLOBALS = "src/app/globals.css";
const TOKENS = "src/styles/tokens.css";
const PUBLIC_APP = "src/app/(public)";
const PUBLIC_COMPONENTS = "src/components/public";

/** Source with comments stripped: assertions are about CODE and COPY, not about prose ABOUT them. */
function codeOf(source: string): string {
  return source
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/**
 * Rendered COPY: comments stripped, and every `className` value removed.
 *
 * Without the second step a vocabulary ban is unusable on this codebase — Tailwind's own
 * `tracking-[0.12em]` contains the word "tracking", so a firewall meant to stop the site from
 * claiming it observes the reader would instead fail on a letter-spacing utility.
 */
function copyOf(source: string): string {
  return codeOf(source)
    .replace(/className=\{`[^`]*`\}/g, "")
    .replace(/className=\{[^}]*\}/g, "")
    .replace(/className="[^"]*"/g, "")
    .replace(/\bclassName:\s*"[^"]*"/g, "");
}

function collect(dir: string, ext = /\.tsx?$/): string[] {
  const absolute = abs(dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return collect(rel, ext);
    return ext.test(entry.name) ? [rel] : [];
  });
}

/**
 * Every CSS declaration block in `source`, with the stack of at-rule preludes enclosing it.
 *
 * Written rather than regexed because the question these tests ask is a NESTING question — "is this
 * `animation-timeline` inside both gates?" — and a flat search cannot answer it. Comments are
 * stripped first so a prelude quoted in prose can never be mistaken for a gate that is present.
 */
type Block = { readonly selector: string; readonly body: string; readonly at: readonly string[] };

function cssBlocks(source: string): Block[] {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks: Block[] = [];
  const stack: string[] = [];
  let head = "";
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i]!;
    if (ch === "{") {
      const prelude = head.trim();
      head = "";
      if (prelude.startsWith("@")) {
        stack.push(prelude);
      } else {
        /* A declaration block: consume to its matching brace. */
        let depth = 1;
        let j = i + 1;
        for (; j < css.length && depth > 0; j += 1) {
          if (css[j] === "{") depth += 1;
          else if (css[j] === "}") depth -= 1;
        }
        blocks.push({ selector: prelude, body: css.slice(i + 1, j - 1), at: [...stack] });
        i = j - 1;
      }
    } else if (ch === "}") {
      stack.pop();
      head = "";
    } else {
      head += ch;
    }
  }
  return blocks;
}

function main(): void {
  const home = read(HOME);
  const homeCode = codeOf(home);
  const globals = read(GLOBALS);
  const publicFiles = [...collect(PUBLIC_APP), ...collect(PUBLIC_COMPONENTS)];
  const publicSource = publicFiles.map(read).join("\n");
  const publicCode = codeOf(publicSource);
  const publicCopy = copyOf(publicSource);
  const allCopy = codeOf(publicSource).replace(/\s+/g, " ");

  /* ── 1. THE PAGE STILL SAYS WHAT IT SAID, AND THE TRACE CLAIMS NOTHING ─── */
  {
    /*
     * PUB-2A changed composition, not copy. These are the sentences PUB-1 shipped; if a redesign
     * ever needs one of them reworded, that is a claim change and it goes through the claim
     * contract, not through a layout commit.
     */
    for (const sentence of [
      "Authority before action.",
      "Answers name the records behind them.",
      "An action carries a permit before it runs.",
      "Governed acts write durable audit records.",
      "Where an organization keeps what it knows, and who may decide with it.",
      "A chatbot answers. Hebun records.",
      "Every capability is published with the limit that goes with it.",
      "One integration exists. It is Google.",
      "Named mechanisms, not adjectives.",
      "Hebun is not open for self-serve sign-up.",
      "Anything absent from this table is absent from the product.",
      "Hebun holds no compliance certification and claims none.",
      "Field names, not sample data. Hebun shows no record it does not hold.",
      "There are no other integrations. When there are, they will be listed here the same way.",
    ]) {
      /*
       * Asserted over the whole PUBLIC SURFACE, not over `page.tsx`. The rework moved three of
       * these sentences off the page and onto the system plate, and a guard scoped to one file
       * would have called a relocation a deletion. What matters is that the reader still gets the
       * sentence, not which module renders it.
       */
      assert.ok(
        allCopy.includes(sentence),
        `PUB-1 copy was lost in the redesign: ${JSON.stringify(sentence)}`,
      );
    }

    /*
     * THE TRACE MAY NEVER BE DESCRIBED AS OBSERVING THE READER. It is a drawn line whose length
     * follows the viewport's own scroll position; Hebun's audit records are written by governed
     * acts inside a tenant's workspace. A visitor who reads the trace as "the site is recording
     * me" would have been told something untrue, and a visitor who reads it as an instance of the
     * product's audit mechanism would have been sold a demo that is not one.
     *
     * PHRASES, not words: the page legitimately says "records" nine times.
     */
    for (const [pattern, why] of [
      [/\btrack(?:s|ing|ed)?\b/i, "the trace tracks nothing"],
      [/\bmonitor(?:s|ing|ed)?\b/i, "nothing about the reader is monitored"],
      [/\banalytics\b/i, "no analytics run on the public site"],
      [/\btelemetry\b/i, "no telemetry is collected"],
      [/your (?:visit|journey|progress|session)/i, "the reader's visit is not a subject of the page"],
      [/records? (?:your|you)\b/i, "nothing about the reader is recorded"],
      [/audit(?:s|ing)? (?:your|you)\b/i, "the reader is not audited"],
      [/\bwatch(?:es|ing)? (?:your|you)\b/i, "the reader is not watched"],
    ] as const) {
      const hit = pattern.exec(publicCopy);
      assert.equal(hit, null, `public copy claims ${JSON.stringify(hit?.[0])}: ${why}`);
    }
  }

  /* ── 2. NO DEPENDENCY, AND NO JAVASCRIPT RUNS THE VISUAL SYSTEM ────────── */
  {
    const pkg = JSON.parse(read("package.json")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    assert.deepEqual(
      Object.keys(pkg.dependencies).sort(),
      [
        "clsx",
        "drizzle-orm",
        "lucide-react",
        "next",
        "pdfjs-dist",
        "pg",
        "react",
        "react-dom",
        "tailwind-merge",
      ],
      "PUB-2A installed a runtime dependency — the approved route was zero new motion dependency",
    );
    for (const name of [
      "motion",
      "framer-motion",
      "gsap",
      "lenis",
      "@studio-freight/lenis",
      "aos",
      "animejs",
      "react-spring",
      "@react-spring/web",
      "locomotive-scroll",
      "scrollreveal",
    ]) {
      assert.ok(
        !(name in pkg.dependencies) && !(name in pkg.devDependencies),
        `${name} was installed — an animation dependency is a Director decision, not an implementation detail`,
      );
    }

    /*
     * The trace, the reveal and the sticky marker are CSS. Not one public file becomes a client
     * component, and none of them reaches for a scroll listener, an observer or a frame callback —
     * which is also why the page can stay static and cost nothing to render.
     */
    for (const file of publicFiles) {
      const code = codeOf(read(file));
      for (const forbidden of [
        /"use client"/,
        /useEffect/,
        /useState/,
        /useRef/,
        /addEventListener/,
        /IntersectionObserver/,
        /requestAnimationFrame/,
        /window\./,
        /document\./,
      ]) {
        assert.ok(!forbidden.test(code), `${file} runs client JavaScript: ${forbidden}`);
      }
    }
  }

  /* ── 3. MOTION IS A PROGRESSIVE ENHANCEMENT, GATED TWICE ───────────────── */
  {
    const blocks = cssBlocks(globals).filter((b) => b.selector.includes(".public-"));
    assert.ok(blocks.length >= 12, "the public visual system must actually be in the stylesheet");

    const driven = blocks.filter((b) => /animation-timeline\s*:/.test(b.body));
    assert.ok(driven.length >= 3, "the trace, its junctions and the section reveal are scroll-driven");

    for (const block of driven) {
      assert.ok(
        block.at.some((prelude) => /^@supports\s*\(\s*animation-timeline\s*:/.test(prelude)),
        `${block.selector} drives on scroll without an @supports gate — a browser without scroll-driven animation would receive an unfinished page`,
      );
      assert.ok(
        block.at.some((prelude) => /prefers-reduced-motion:\s*no-preference/.test(prelude)),
        `${block.selector} drives on scroll without a reduced-motion gate`,
      );
    }

    /* Every time-based public animation is gated on reduced motion too. */
    const timed = blocks.filter(
      (b) => /animation\s*:/.test(b.body) && !/animation\s*:\s*none/.test(b.body),
    );
    for (const block of timed) {
      assert.ok(
        block.at.some((prelude) => /prefers-reduced-motion:\s*no-preference/.test(prelude)),
        `${block.selector} animates without a reduced-motion gate`,
      );
    }

    /*
     * THE FINISHED STATE IS THE UNGATED ONE. `.public-reveal` and `.public-rise-in` must be visible
     * outside every gate, so the enhancement only ever SUBTRACTS. A rule that hid them by default
     * and revealed them by animation would make the headline depend on animation support.
     */
    const ungated = blocks.filter((b) => b.at.length === 0);
    const reveal = ungated.find((b) => b.selector.includes(".public-reveal"));
    assert.ok(reveal, ".public-reveal must carry an ungated, finished default");
    assert.match(reveal!.body, /clip-path:\s*none/, "the ungated default must be uncovered");
    assert.match(reveal!.body, /opacity:\s*1/, "the ungated default must be visible");

    const progress = ungated.find((b) => b.selector.includes(".public-trace-progress"));
    assert.ok(progress, ".public-trace-progress must carry an ungated default");
    assert.ok(
      !/scale\s*:\s*1\s+0/.test(progress!.body),
      "the trace must not default to zero length — without scroll-driven support it would never be drawn",
    );

    /* The main reveal stays inside the approved budget, and reads it from a token. */
    const dur = /--dur-reveal:\s*(\d+)ms/.exec(read(TOKENS));
    assert.ok(dur, "--dur-reveal must be a token, not a literal in a component");
    assert.ok(
      Number(dur![1]) <= 600,
      `the hero reveal is ${dur![1]}ms — the approved ceiling for the main reveal is 600ms`,
    );
    assert.match(
      globals,
      /animation:\s*public-reveal\s+var\(--dur-reveal\)\s+var\(--ease-out\)/,
      "the reveal must spend the existing easing token, not a second motion system",
    );
    /* A hard, precise uncovering. Not a blur, a spring, a bounce or a typewriter. */
    assert.match(globals, /@keyframes public-reveal[\s\S]*?clip-path: inset\(/, "the reveal is a clip-path reveal");
    const revealFrames = /@keyframes public-reveal\s*\{[\s\S]*?\n\}/.exec(globals)?.[0] ?? "";
    for (const forbidden of [/blur/, /filter/, /rotate/, /skew/, /letter-spacing/]) {
      assert.ok(!forbidden.test(revealFrames), `the hero reveal must stay precise: ${forbidden}`);
    }
  }

  /* ── 4. REDUCED MOTION IS EXPLICIT, AND KEEPS THE TRACE'S GEOMETRY ─────── */
  {
    const reduced = cssBlocks(globals).filter(
      (b) =>
        b.selector.includes(".public-") &&
        b.at.some((prelude) => /prefers-reduced-motion:\s*reduce/.test(prelude)),
    );
    assert.ok(reduced.length >= 3, "reduced motion must be handled explicitly for the public system");

    const names = reduced.map((b) => b.selector).join(" | ");
    for (const required of [".public-reveal", ".public-rise", ".public-trace-progress", ".public-trace-node"]) {
      assert.ok(names.includes(required), `${required} is not neutralised under reduced motion`);
    }

    /*
     * The platform-wide rule earlier in globals.css collapses every DURATION to 0.01ms and leaves
     * DELAYS alone, so a staggered element with `both` fill would hold its opening frame — that is,
     * stay invisible — for the whole delay. The public block must remove the animation outright.
     */
    const revealReset = reduced.find((b) => b.selector.includes(".public-reveal"));
    assert.match(revealReset!.body, /animation:\s*none\s*!important/, "the reveal must be removed, not shortened");
    assert.match(revealReset!.body, /animation-delay:\s*0ms\s*!important/, "a delay must not survive reduced motion");
    assert.match(revealReset!.body, /opacity:\s*1\s*!important/, "content must be present under reduced motion");

    /*
     * GEOMETRY IS NOT MOTION. `translate` and `rotate` are how a junction is centred on the rail and
     * drawn as a survey mark; resetting them here would move every mark off the line it belongs to.
     * Only the animation is removed, and the trace is left complete rather than empty.
     */
    const nodeReset = reduced.find((b) => b.selector === ".public-trace-node");
    assert.ok(nodeReset, "the junction mark needs its own reduced-motion rule");
    assert.ok(
      !/translate\s*:/.test(nodeReset!.body) && !/rotate\s*:\s*none/.test(nodeReset!.body),
      "reduced motion must not reset the junction's centring or its shape — that is a layout defect dressed as an accessibility fix",
    );
    assert.match(
      nodeReset!.body,
      /background:\s*var\(--trace-live\)\s*!important/,
      "under reduced motion every junction is already marked",
    );
    const progressReset = reduced.find((b) => b.selector === ".public-trace-progress");
    assert.match(
      progressReset!.body,
      /scale:\s*1 1\s*!important/,
      "under reduced motion the trace is complete and static, never a line of zero length",
    );
  }

  /* ── 5. THE PALETTE DID NOT INFLATE ───────────────────────────────────── */
  {
    for (const block of cssBlocks(globals).filter((b) => b.selector.includes(".public-"))) {
      const where = `${block.selector}`;
      assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block.body), `${where} hardcodes a hex colour`);
      assert.ok(!/\brgba?\(/.test(block.body), `${where} hardcodes an rgb colour`);
      assert.ok(!/\bhsla?\(/.test(block.body), `${where} hardcodes an hsl colour`);
      assert.ok(
        !/var\(--gradient-/.test(block.body),
        `${where} spends a decorative gradient token — the approved direction is precision, not a gradient-mesh site`,
      );
      assert.ok(!/box-shadow|text-shadow|drop-shadow/.test(block.body), `${where} reaches for a shadow — depth comes from planes, masking and position`);
      assert.ok(!/filter:\s*blur|backdrop-filter/.test(block.body), `${where} reaches for a blur — the trace is a drawn path, not a glow`);
      assert.ok(!/perspective|rotate3d|rotateX|rotateY|translateZ/.test(block.body), `${where} uses a 3D transform, which PUB-2A does not approve`);
    }

    /* The trace rests and advances in colours the site already had. */
    const tokens = read(TOKENS);
    /*
     * The page now alternates between an ink ground and a near-white one, and the trace is ONE
     * overlay crossing both. So the resting colour is DERIVED from the ink as a mid tone rather
     * than taken from either ground's hairline — a value picked for paper vanishes on ink, and the
     * device would be missing from exactly the sections it carries.
     */
    assert.match(
      tokens,
      /--trace-hairline:\s*color-mix\(in srgb, var\(--color-text-primary\)/,
      "the resting trace must be derived from the ink, not chosen",
    );
    assert.match(tokens, /--trace-live:\s*var\(--color-primary\)/, "the advanced trace is Hebun blue and nothing else");
    assert.match(
      tokens,
      /--blueprint-line:\s*color-mix\(in srgb, var\(--color-text-primary\)/,
      "the blueprint line must be DERIVED from the ink, not chosen",
    );
    for (const banned of [/cyan/i, /purple/i, /violet/i, /fuchsia/i, /magenta/i, /neon/i]) {
      const pub2a = tokens.slice(tokens.indexOf("Public visual system (PUB-2A)"), tokens.indexOf("── Radius"));
      assert.ok(!banned.test(pub2a), `the public visual system introduced ${banned}`);
    }

    /* The blueprint must be masked, or it is wallpaper. */
    const blueprint = cssBlocks(globals).find((b) => b.selector === ".public-blueprint");
    assert.ok(blueprint, "the blueprint plane must exist");
    assert.match(blueprint!.body, /mask-image:\s*radial-gradient/, "the blueprint must fade out before it reaches an edge");
    assert.match(blueprint!.body, /-webkit-mask-image:/, "the blueprint mask needs its prefixed form");
    assert.match(blueprint!.body, /pointer-events:\s*none/, "the blueprint must never take a click");
  }

  /* ── 6. THE RHYTHM IS VARIED, NOT NOMINALLY PARAMETERISED ──────────────── */
  {
    const sizes = new Set<string>();
    const layouts = new Set<string>();
    const tones = new Set<string>();
    for (const tag of homeCode.matchAll(/<PublicSection\b([\s\S]*?)>/g)) {
      const attrs = tag[1]!;
      sizes.add(/size="([a-z]+)"/.exec(attrs)?.[1] ?? "default");
      layouts.add(/layout="([a-z]+)"/.exec(attrs)?.[1] ?? "gutter");
      tones.add(/tone="([a-z]+)"/.exec(attrs)?.[1] ?? "plain");
    }
    assert.ok(sizes.size >= 4, `the homepage uses ${sizes.size} section height(s) — PUB-1's flaw was five identical boxes`);
    assert.ok(layouts.size >= 3, `the homepage uses ${layouts.size} heading position(s) — the heading may not sit in the same place five times`);
    assert.ok(tones.size >= 2, "the page must not be one uninterrupted plane");

    /*
     * The named sizes must be a real ORDERING, not four labels for one number. Declared at both
     * breakpoints, and at the desktop breakpoint a tall section is taller than a default one and a
     * default one is taller than a compact one — which is the only thing that makes `size` a
     * composition decision rather than decoration.
     */
    const padAt = (scope: string, name: string): number => {
      const match = new RegExp(`\\.public-section-${name}\\s*\\{\\s*--section-pad-y:\\s*([\\d.]+)rem`).exec(scope);
      assert.ok(match, `.public-section-${name} must declare its own rhythm`);
      return Number(match![1]);
    };
    const lgIndex = globals.indexOf("@media (min-width: 1024px) {\n  .public-section-compact");
    assert.ok(lgIndex > -1, "the section rhythm must scale at the desktop breakpoint");
    const base = globals.slice(globals.indexOf(".public-section-compact"), lgIndex);
    const lg = globals.slice(lgIndex);
    for (const scope of [base, lg]) {
      for (const name of ["compact", "default", "dense", "tall"]) padAt(scope, name);
    }
    assert.ok(
      padAt(lg, "tall") > padAt(lg, "default") && padAt(lg, "default") > padAt(lg, "compact"),
      `the section sizes do not order (compact ${padAt(lg, "compact")} < default ${padAt(lg, "default")} < tall ${padAt(lg, "tall")}) — the property is decoration, not rhythm`,
    );

    /* Every major section is a junction on the trace, and the trace is run exactly once. */
    const traced = [...homeCode.matchAll(/<PublicSection\b([\s\S]*?)>/g)].filter((m) => /\btrace\b/.test(m[1]!));
    assert.equal(traced.length, 5, "all five numbered sections must be junctions on the one trace");
    assert.equal(
      (homeCode.match(/<PublicTrace>/g) ?? []).length,
      1,
      "the homepage runs ONE continuous trace, never two",
    );
    assert.equal(
      (homeCode.match(/<PublicTraceOrigin\s*\/>/g) ?? []).length,
      1,
      "the trace has exactly one visible origin",
    );
  }

  /* ── 7. HEADINGS, TAB SEMANTICS, AND THE ONE SHARED INSET ──────────────── */
  {
    /* One h1 on the page; the sticky marker is the section's REAL h2, rendered once. */
    assert.equal((homeCode.match(/<h1\b/g) ?? []).length, 1, "the homepage has exactly one h1");
    const section = codeOf(read(SECTION));
    assert.equal((section.match(/<h2\b/g) ?? []).length, 1, "a section renders its heading once — a sticky copy would duplicate heading semantics");
    assert.match(section, /public-section-marker/, "the sticky marker must be the heading itself");

    /*
     * The sticky marker is NOT a tab set. Adapting the idea does not license the ARIA: nothing here
     * selects a panel, so `role="tab"` would announce an interaction that does not exist.
     */
    for (const forbidden of [/role="tab"/, /role="tablist"/, /role="tabpanel"/, /aria-selected/, /aria-controls/]) {
      assert.ok(!forbidden.test(publicCode), `the public surface asserts tab semantics it does not have: ${forbidden}`);
    }

    /* Sticky is CSS, and it lives BELOW the header. */
    const markerRule = cssBlocks(globals).find((b) => b.selector === ".public-section-marker");
    assert.ok(markerRule, "the sticky marker must be a stylesheet rule, not inline JavaScript");
    assert.match(markerRule!.body, /position:\s*sticky/, "the marker sticks with CSS");
    assert.match(markerRule!.body, /top:\s*calc\(var\(--topbar-h\)/, "the marker must anchor below the header's own height token");
    assert.match(markerRule!.body, /z-index:\s*0/, "the marker must sit behind the header, which carries z-10");
    assert.ok(
      markerRule!.at.some((prelude) => /min-width:\s*1024px/.test(prelude)),
      "sticky section behaviour is a desktop composition; mobile is simplified",
    );

    /*
     * ONE inset, spent by header, footer, hero and every section. It is what makes the trace land at
     * the same distance from the words on every public surface, so a re-hardcoded padding is not a
     * style nit — it is the trace drifting away from the composition on one page only.
     */
    /*
     * Scoped to the surfaces that share the 1280 composition. `/privacy` and `/terms` are a single
     * centred prose measure with no gutter, no trace and no grid to align to, and they are outside
     * PUB-2A's scope — asserting the composition inset over them would be this test demanding a
     * change the phase was told not to make.
     */
    /*
     * Stated as a PROPERTY OF THE CONTAINER rather than as a ban on a utility pair. Every element
     * that claims the public container's width must also spend the public inset — that is what
     * keeps the trace landing at the same distance from the words on every public surface. The
     * earlier form banned `px-6 sm:px-10` anywhere in a file, which flagged the system plate's own
     * internal padding: a plate is not a container, and its padding is nobody's alignment problem.
     */
    let containers = 0;
    for (const file of [...collect(PUBLIC_APP), ...collect(PUBLIC_COMPONENTS)]) {
      for (const [, value] of codeOf(read(file)).matchAll(/className="([^"]*)"/g)) {
        if (!value.includes("max-w-[var(--container-max)]")) continue;
        containers += 1;
        assert.ok(
          value.includes("public-inset"),
          `${file}: a public container does not spend the shared inset — the trace would land at a different distance from the words here than everywhere else`,
        );
      }
    }
    assert.ok(containers >= 5, `only ${containers} public containers found — the assertion above would be vacuous`);
    for (const file of [HOME, "src/components/public/public-header.tsx", "src/components/public/public-footer.tsx", SECTION]) {
      assert.match(codeOf(read(file)), /public-inset/, `${file} must spend the shared public inset`);
    }

    /* Every piece of the drawing is hidden from assistive technology. */
    const trace = codeOf(read(TRACE));
    for (const cls of ["public-trace-frame", "public-trace-origin"]) {
      const idx = trace.indexOf(cls);
      assert.ok(idx > -1, `${cls} must be rendered by the trace component`);
      assert.ok(
        /aria-hidden="true"/.test(trace.slice(Math.max(0, idx - 220), idx)),
        `${cls} is drawn without aria-hidden`,
      );
    }
    for (const cls of [
      "public-blueprint",
      "public-trace-node",
      "public-field",
      "public-field-wash",
      "public-boundary",
      "public-boundary-gate",
      "public-tick",
      "public-spine",
      "public-station",
      "public-stage-rail",
      "public-stage-cap",
      "public-stage-node",
      "public-boundary-dash",
    ]) {
      for (const file of publicFiles) {
        const code = codeOf(read(file));
        let from = 0;
        for (;;) {
          const idx = code.indexOf(cls, from);
          if (idx < 0) break;
          assert.ok(
            /aria-hidden="true"/.test(code.slice(Math.max(0, idx - 220), idx)),
            `${file}: ${cls} is drawn without aria-hidden`,
          );
          from = idx + cls.length;
        }
      }
    }
  }

  /* ── 8. THE TWO REGISTERS, AND WHAT THE DARK ONE MAY NOT BECOME ────────── */
  {
    const tokens = read(TOKENS);
    /*
     * The scope is identified by the block that DEFINES the ground, not by the first rule that
     * happens to carry the class — a later breakpoint rule also selects `.public-ink`, and matching
     * on the selector alone would let the real scope be renamed away while the guard still found
     * something to inspect.
     */
    const ink = cssBlocks(globals).find(
      (b) => b.selector === ".public-ink" && /--color-surface\s*:/.test(b.body),
    );
    assert.ok(ink, "the ink register must exist as one scope, not as per-component dark classes");

    /*
     * THE DARK GROUND INTRODUCES NO COLOUR. Every declaration in the scope is either a color-mix
     * over `--public-ink`, over white/black, or over `--color-primary`; a hex or an rgb() here
     * would be a second palette entering the product through a marketing page.
     */
    for (const line of ink!.body.split(";")) {
      if (!line.includes(":")) continue;
      assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(line), `the ink register hardcodes a hex: ${line.trim()}`);
      assert.ok(!/\brgba?\(|\bhsla?\(/.test(line), `the ink register hardcodes a colour: ${line.trim()}`);
    }
    assert.match(
      ink!.body,
      /--color-surface:\s*var\(--public-ink\)/,
      "the dark ground must BE the product's ink, not a colour chosen to look like it",
    );
    /*
     * `--public-ink` exists precisely because a custom property may not be redefined and read for
     * its own derivation in one rule. If the scope ever derived from `--color-text-primary` — which
     * it redefines — every colour in it would resolve to nothing.
     */
    assert.ok(
      !/color-mix\([^;]*var\(--color-text-primary\)/.test(ink!.body),
      "the ink scope must derive from --public-ink; deriving from the property it redefines is a cycle",
    );
    assert.match(tokens, /--public-ink:\s*var\(--color-text-primary\)/, "--public-ink must alias the product ink");

    /* Ink is the MECHANISM register and light is the EVIDENCE register — the page must use both. */
    const tones = [...homeCode.matchAll(/<PublicSection\b([\s\S]*?)>/g)].map(
      (m) => /tone="([a-z]+)"/.exec(m[1]!)?.[1] ?? "plain",
    );
    assert.ok(tones.includes("ink"), "the mechanism register must actually be used");
    assert.ok(tones.includes("plain"), "the evidence register must actually be used");
    assert.ok(
      (homeCode.match(/public-ink/g) ?? []).length >= 2,
      "the hero and the close are ink surfaces of their own",
    );

    /*
     * ── THE HEADING SCALE ────────────────────────────────────────────────────
     *
     * The single measurable reason the page read as documentation: a section `<h2>` was
     * `--fs-title`, 18px. A section heading is now a display line, and this pins the floor so a
     * later tidy-up cannot quietly return it to a UI label.
     */
    const statement = /--fs-statement:\s*clamp\(([\d.]+)rem,[^,]+,\s*([\d.]+)rem\)/.exec(tokens);
    assert.ok(statement, "--fs-statement must be a fluid token");
    assert.ok(
      Number(statement![1]) >= 1.75,
      `a section heading floors at ${statement![1]}rem — below 1.75rem it is a label, not a heading`,
    );
    assert.ok(
      Number(statement![2]) >= 3,
      `a section heading tops out at ${statement![2]}rem — the reference sets its section headings at 3rem`,
    );
    const section = codeOf(read(SECTION));
    assert.match(section, /text-statement/, "the section heading must spend the statement step");

    /*
     * Stated over the HOMEPAGE rather than over the component. The shell keeps a modest fallback
     * heading for a section with no claim to make — `/contact` has two of those, and they are a
     * utility page's labels, not statements. What must not happen is a section of the homepage
     * falling back to it: every section here IS a claim, and a claim rendered at card-label size is
     * the exact defect this rework exists to remove.
     */
    for (const tag of homeCode.matchAll(/<PublicSection\b([\s\S]*?)>/g)) {
      const attrs = tag[1]!;
      const which = /index="(\d+)"/.exec(attrs)?.[1] ?? "?";
      assert.match(attrs, /statement=/, `homepage section ${which} has no statement, so its heading falls back to card-label size`);
    }

    /*
     * ── THE PLATE IS NOT A SCREENSHOT, AND NOT A CARD SYSTEM ─────────────────
     *
     * It carries no invented value, no window chrome and no control. And there is a SMALL, FIXED
     * number of plates on the page: the reference solves variety with a card grid, and the approved
     * direction explicitly does not.
     */
    const plateUses = (publicSource.match(/public-plate/g) ?? []).length;
    assert.ok(plateUses >= 2, "the plate must actually be used");
    assert.ok(
      plateUses <= 5,
      `${plateUses} plates — depth was solved with a card grid, which the approved direction refuses`,
    );
    for (const forbidden of [
      /window-controls|traffic-light/i,
      /<canvas\b/,
      /<video\b/,
      /\bmock(?:ed|up)?\b/i,
      /placeholder/i,
      /lorem/i,
    ]) {
      assert.ok(!forbidden.test(publicCode), `the public surface fabricates an interface: ${forbidden}`);
    }
  }

  console.log("PUB-2A public visual system: ok");
}

main();
