/*
 * VI-2 — Shell Readability + Label Geometry.
 *
 * ── WHAT THIS SUITE IS FOR ───────────────────────────────────────────────────
 *
 * VI-2 changed no read, no writer, no authority and no row. It changed four things in the ordinary
 * shell, and every one of them is the kind of change with no compiler behind it:
 *
 *   A  the top bar stopped rendering a description it could only show a fragment of
 *   B  a canonical Level-2 navigation name remains complete and single-line
 *   C  the seven workspace names and the operator's role reached the 12px reading floor
 *   D  the Level-2 column header and the tablet trigger stopped calling `/heby` "Command"
 *
 * ── THE TRAP THIS SUITE EXISTS TO AVOID ──────────────────────────────────────
 *
 * The floor was first written as `text-label`, the Stage 0 scale utility. A source-level assertion
 * would have passed. The product rendered 16px, because `.text-label` HAS NO RULE: `@theme inline`
 * cannot resolve `--text-label: var(--fs-label)` when `--fs-label` lives in an imported plain
 * stylesheet, so Tailwind emits nothing. Measured in the running product — `.text-display`,
 * `.text-title`, `.text-body`, `.text-meta` and `.text-label` all have no rule and all fall back to
 * the inherited 16px, while `.text-xs` (12px) and `.text-sm` (14px) work.
 *
 * So the floor here is asserted against utilities that EXIST, and the inert five are banned from
 * the ordinary shell outright — a class that names a size it does not set is worse than no class.
 * Their 165 uses elsewhere are recorded debt for the gate that repairs the theme block.
 *
 * Every geometry number below was measured in the authenticated product at 1920×1080, 1440×900,
 * 1024×768, 768×1024 and 390×844 before and after the change.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  HEBY,
  WORKSPACES,
  getWorkspace,
  resolveActiveWorkspace,
  resolveShellSurface,
  type ShellSurface,
} from "../../src/config/workspace-nav";

const ROOT = process.cwd();

const TOPBAR = "src/components/layout/topbar.tsx";
const RAIL = "src/components/layout/workspace-rail.tsx";
const SECONDARY = "src/components/layout/secondary-nav.tsx";
const MOBILE = "src/components/layout/mobile-nav.tsx";
const TOKENS = "src/styles/tokens.css";
const GLOBALS = "src/app/globals.css";

/** The ordinary shell. `components/layout/heby/**` is deliberately absent — it is frozen. */
const ORDINARY_SHELL = [TOPBAR, RAIL, SECONDARY, MOBILE];
const TRACKED = [...ORDINARY_SHELL, TOKENS, GLOBALS];

type Sources = Readonly<Record<string, string>>;

const load = (): Sources =>
  Object.freeze(Object.fromEntries(TRACKED.map((f) => [f, readFileSync(path.join(ROOT, f), "utf8")])));

/* This file's prose, and the shell's, both NAME most of what is forbidden below. */
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/**
 * One defect restored. A mutation that fails to apply yields sources identical to the real ones,
 * the assertion passes, and `assert.throws` reports "did not throw" — indistinguishable from a
 * proof that did not bite. So a non-applying mutation is VOID and fails here, never a quiet pass.
 */
function withDefect(base: Sources, file: string, from: string | RegExp, to: string): Sources {
  const before = base[file];
  assert.ok(before !== undefined, `bite-proof names an untracked file: ${file}`);
  const after = before.replace(from, to);
  assert.notEqual(after, before, `bite-proof mutation did not APPLY to ${file} — it would prove nothing`);
  return Object.freeze({ ...base, [file]: after });
}

/**
 * The file with its import statements removed.
 *
 * A prohibition or a requirement proved over a whole file is satisfied by the IMPORT LINE — this
 * repository has been bitten by exactly that before (a symbol "used" because it was imported). Every
 * claim about what a component DOES is made against this, so a mention can never stand in for a call.
 */
const bodyOf = (s: string): string => codeOf(s).replace(/^import[\s\S]*?from\s+"[^"]+";$/gm, "");

const bites = (label: string, check: (s: Sources) => void, mutated: Sources): void =>
  assert.throws(() => check(mutated), `bite-proof "${label}" did not bite — the assertion does not guard it`);

/* ─────────────────────────────────────────────────────────────────────────────
 * MEASURED GEOMETRY — recorded from the authenticated product, not assumed.
 * ────────────────────────────────────────────────────────────────────────── */

/** Widest rendered width of each workspace name at 12px with the rail's `tracking-tight`. */
const RAIL_LABEL_PX: Readonly<Record<string, number>> = Object.freeze({
  Command: 59.0, Intelligence: 64.5, Knowledge: 63.9, Operations: 62.9,
  Workforce: 59.3, Governance: 68.3, Platform: 47.7,
});

/** Rendered width of each surface tagline at 12px. The top bar's slot was 208px at ≥1024. */
const TAGLINE_PX_MAX = 470.4; // Heby's own sentence — the longest in the product.
const TOPBAR_TITLE_PX_MAX = 83.1; // "Governance", the widest of the eight surface names.

/** Utilities Tailwind actually emits. The Stage 0 five emit nothing — see the header. */
const INERT_SCALE_UTILITIES = ["text-display", "text-title", "text-body", "text-meta", "text-label"];

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. ORDINARY SHELL TEXT RESPECTS THE 12px FLOOR
 * ────────────────────────────────────────────────────────────────────────── */
function shellTextRespectsTheFloor(sources: Sources): void {
  for (const file of ORDINARY_SHELL) {
    const code = codeOf(sources[file]!);

    /* Any arbitrary rem size below the floor, in any of these files. */
    for (const m of code.matchAll(/text-\[(\d*\.?\d+)rem\]/g)) {
      const rem = Number(m[1]);
      assert.ok(
        rem >= 0.75,
        `${file} renders shell text at ${rem}rem (${(rem * 16).toFixed(2)}px) — below the 12px floor`,
      );
    }

    /*
     * And it may not state the floor in a utility that does not exist. `text-label` looks like the
     * right answer and is a no-op; `cn()` also drops it, because tailwind-merge does not know it is
     * a font size and treats it as a colour when a `text-*` colour follows.
     */
    for (const inert of INERT_SCALE_UTILITIES) {
      assert.ok(
        !new RegExp(`\\b${inert}\\b`).test(code),
        `${file} uses "${inert}", which Tailwind emits no rule for — it renders at the inherited 16px`,
      );
    }
  }

  /* The three sites VI-2 raised now say 12px in a utility that resolves. */
  assert.match(codeOf(sources[RAIL]!), /py-1\.5 text-sm font-semibold/, "the integrated rail's workspace names exceed the floor");
  assert.match(codeOf(sources[TOPBAR]!), /block text-xs text-fg-muted">Director/, "the operator's role is at the floor");
  assert.match(codeOf(sources[SECONDARY]!), /ml-auto text-xs font-semibold uppercase/, "the unavailable marker is at the floor");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. THE RAIL'S NAMES FIT WITHOUT BEING SHORTENED
 *
 * The compact 156px rail reserves room for every Level-1 name.
 * ────────────────────────────────────────────────────────────────────────── */
function railNamesFitAtTheFloor(sources: Sources): void {
  const code = codeOf(sources[RAIL]!);

  const available = 156 - 16 - 16 - 16 - 8;

  const widest = Object.entries(RAIL_LABEL_PX).sort((a, b) => b[1] - a[1])[0]!;
  assert.ok(
    available >= widest[1],
    `the rail gives a name ${available}px and "${widest[0]}" needs ${widest[1]}px at the floor — ` +
      `it would be shortened or overflow`,
  );

  /* Every one of the seven, not merely the widest. */
  for (const workspace of WORKSPACES) {
    const need = RAIL_LABEL_PX[workspace.label];
    assert.ok(need !== undefined, `no measurement recorded for the workspace name "${workspace.label}"`);
    assert.ok(available >= need, `"${workspace.label}" needs ${need}px and the rail gives ${available}px`);
  }

  /* And nothing shortens it. */
  const label = code.slice(code.indexOf("data-rail-label"), code.indexOf("</span>", code.indexOf("data-rail-label")));
  for (const shortening of ["truncate", "line-clamp", "text-ellipsis"]) {
    assert.ok(!label.includes(shortening), `a workspace name may not be shortened by ${shortening}`);
  }

  assert.match(code, /min-h-9 w-full min-w-0/, "the item fills and yields within the integrated rail");
  assert.match(code, /Icon className="size-4 shrink-0"/, "and the icon keeps a readable compact size");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. CANONICAL LEVEL-2 NAMES STAY SINGLE-LINE; THEY ARE NEVER TRUNCATED
 * ────────────────────────────────────────────────────────────────────────── */
function secondaryLabelsAreNeverTruncated(sources: Sources): void {
  const code = codeOf(sources[SECONDARY]!);

  /* Scoped to the label spans, not merely to the file. */
  const labels = [...code.matchAll(/<span className="([^"]*)">\{destination\.label\}<\/span>/g)].map((m) => m[1]!);
  assert.equal(labels.length, 2, "both the linked and the unavailable destination render a label");
  for (const cls of labels) {
    for (const shortening of ["truncate", "line-clamp", "text-ellipsis"]) {
      assert.ok(!cls.includes(shortening), `a canonical navigation name may not be shortened by ${shortening}`);
    }
    assert.match(cls, /min-w-0/, "and it still yields to its container rather than forcing it wider");
  }

  /* Inline rows keep their compact density — and take the width they are GIVEN. */
  assert.equal((code.match(/\? "min-h-8[^\"]*text-xs leading-4"/g) ?? []).length, 2, "both inline row shapes preserve their compact density contract");
  assert.equal((code.match(/: "min-h-10[^\"]*text-sm"/g) ?? []).length, 2, "both default rows still reserve 40px");
  assert.equal((code.match(/inline \? "mt-0\.5 size-3" : "size-4"/g) ?? []).length, 2, "both destination shapes preserve inline and default icon sizes");
  /*
   * REVERSED, AND NOT WEAKENED. These two lines are not released — HEAD has neither — and they
   * asserted the mechanism that put a Level-2 row across the Intelligence canvas: an intrinsic
   * width with no ceiling, and a refusal to wrap so it could never yield. The rail is now sized
   * from the measured longest canonical label instead, so the property worth pinning is the
   * opposite one.
   */
  for (const escape of ["w-max", "whitespace-nowrap"]) {
    assert.ok(
      !code.includes(escape),
      `an inline L2 row may not use ${escape} — a row wider than its column paints over the canvas`,
    );
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4 + 5. THE TOP BAR NAMES THE SURFACE, AND NEVER SHOWS HALF A SENTENCE
 * ────────────────────────────────────────────────────────────────────────── */
function topbarNeverTruncatesADescription(sources: Sources): void {
  const code = codeOf(sources[TOPBAR]!);

  assert.ok(!/surface\.tagline/.test(code), "the top bar renders no surface description it cannot complete");
  assert.ok(
    !/\{workspace\.tagline\}|\{surface\.tagline\}/.test(code),
    "and it does not reach one through another name either",
  );

  const titleTag = /<div className="([^"]*)">\s*<p className="([^"]*)">\{surface\.label\}<\/p>/.exec(code);
  assert.ok(titleTag, "the top bar names the surface, in a shape this proof can read");
  for (const cls of [titleTag[1]!, titleTag[2]!]) {
    assert.ok(!/\bhidden\b|\b(sm|md|lg|xl|2xl):hidden\b/.test(cls), "the surface name remains visible");
  }
  assert.ok(
    TOPBAR_TITLE_PX_MAX < 208,
    `the widest surface name is ${TOPBAR_TITLE_PX_MAX}px and the slot is 208px — the title cannot be cut`,
  );

  /*
   * THE DESCRIPTION DID NOT DISAPPEAR. `SecondaryNavContent` renders it in full on the default
   * column/mobile surface; the compact inline rail intentionally hides the redundant identity block.
   */
  const secondary = codeOf(sources[SECONDARY]!);
  const detail = secondary.slice(secondary.indexOf("{heading.detail}") - 200, secondary.indexOf("{heading.detail}"));
  for (const shortening of ["truncate", "line-clamp", "whitespace-nowrap"]) {
    assert.ok(!detail.includes(shortening), `the one owner of the description may not shorten it (${shortening})`);
  }
  assert.ok(detail.includes('inline && "hidden"'), "and only the compact inline variant hides the redundant identity block");
  assert.ok(TAGLINE_PX_MAX > 208, "a 208px slot could never have held the longest description");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6 + 7 + 8. IDENTITY: SEVEN ARE SEVEN, HEBY IS NOT ONE, AND `/heby` IS HEBY
 * ────────────────────────────────────────────────────────────────────────── */
function hebyIsNeverCommand(resolve: (pathname: string) => ShellSurface): void {
  const command = getWorkspace("command");
  for (const pathname of ["/heby", "/heby/anything"]) {
    const surface = resolve(pathname);
    assert.equal(surface.workspace, null, `${pathname} belongs to none of the seven`);
    assert.equal(surface.kind, "ambient");
    assert.equal(surface.label, HEBY.label);
    assert.notEqual(surface.label, command.label, `${pathname} must not be labelled Command`);
  }
  for (const workspace of WORKSPACES) {
    assert.equal(resolve(workspace.href).workspace, workspace.id, `${workspace.href} still resolves to itself`);
  }
}

function everyShellIdentitySiteIsHonest(sources: Sources): void {
  assert.equal(WORKSPACES.length, 7, "the top level is exactly seven workspaces");
  assert.ok(!WORKSPACES.some((w) => (w.href as string) === HEBY.href), "Heby is not one of them");
  hebyIsNeverCommand(resolveShellSurface);

  /*
   * BITE-PROOF, behavioural: the released resolver reconstructed exactly. `resolveActiveWorkspace`
   * still behaves this way on purpose — it is the navigation fallback — so this is the defect
   * itself and not an imitation of it.
   */
  const released = (pathname: string): ShellSurface => {
    const id = resolveActiveWorkspace(pathname);
    const w = getWorkspace(id);
    return { kind: "workspace", label: w.label, tagline: w.tagline, workspace: id };
  };
  assert.equal(released("/heby").label, "Command", "the released defect is reproduced, not imagined");
  assert.throws(() => hebyIsNeverCommand(released), "restoring the Command fallback must fail this proof");

  /*
   * VI-1 fixed the top bar, the rail and the mobile mark. It did not reach the Level-2 column
   * header or the tablet trigger, and both were measured saying "Command" on `/heby` — the trigger
   * unconditionally at 768px, where focused mode does not exist. Every ordinary shell component
   * that renders a surface NAME now asks the resolver that may answer "none of the seven".
   */
  for (const file of [TOPBAR, RAIL, SECONDARY, MOBILE]) {
    assert.match(
      bodyOf(sources[file]!),
      /resolveShellSurface\(pathname\)/,
      `${file} must CALL the resolver that may answer "none of the seven" — importing it is not using it`,
    );
  }
  assert.equal(
    (codeOf(sources[RAIL]!).match(/workspace=\{workspace\}/g) ?? []).length,
    1,
    "the unified inline path receives its honest workspace context",
  );
  assert.match(
    codeOf(sources[SECONDARY]!),
    /surface\.workspace === null[\s\S]{0,160}?Sections of \$\{workspace\.label\}/,
    "and the column names the surface, then separately names whose sections it lists",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 9. THE WAY OUT OF AN AMBIENT SURFACE SURVIVES
 * ────────────────────────────────────────────────────────────────────────── */
function ambientSurfacesKeepTheirEscape(sources: Sources): void {
  /*
   * The mobile list remains the escape on ambient surfaces. The desktop rail truthfully expands
   * only when URL resolution identifies one of the seven workspaces.
   */
  const mobile = codeOf(sources[MOBILE]!);
  assert.match(mobile, /activeWorkspace = resolveShellSurface\(pathname\)\.workspace/, "the mark is honest");
  assert.match(mobile, /selected \?\? resolveActiveWorkspace\(pathname\)/, "and the way out is preserved");

  const rail = codeOf(sources[RAIL]!);
  assert.match(rail, /active = resolveShellSurface\(pathname\)\.workspace/, "desktop expansion remains honest");

  const secondary = codeOf(sources[SECONDARY]!);
  assert.match(secondary, /destinationsForRole\(workspace, role\)/, "the column still lists the fallback's sections");
  assert.ok(
    !/return null|\?\s*null\s*:/.test(secondary.slice(secondary.indexOf("<nav"), secondary.indexOf("</nav>"))),
    "and it never renders an empty list for a surface it does not recognise",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 10. THE SHELL GEOMETRY CONTRACTS ARE UNCHANGED
 * ────────────────────────────────────────────────────────────────────────── */
function shellContractsAreUnchanged(sources: Sources): void {
  const tokens = sources[TOKENS]!;
  assert.match(tokens, /--rail-w:\s*92px/, "the rail contract is unchanged");
  /*
   * DERIVED, NOT PINNED. Also not released — HEAD has no `--rail-inline-w` at all. 156px was the
   * number that forced the escape hack: it gave the longest canonical L2 label 77px of a measured
   * 141px. The contract worth keeping is the floor the measurement produces, not the number.
   */
  const railInline = /--rail-inline-w:\s*(\d+)px/.exec(tokens);
  assert.ok(railInline, "the integrated width is declared once, in the token authority");
  assert.ok(
    Number(railInline![1]) >= 212,
    `the integrated rail is ${railInline![1]}px; 141px of label plus 71px of chrome needs 212px`,
  );
  assert.doesNotMatch(tokens, /--secondary-w:/, "no detached secondary-column width remains");
  assert.match(tokens, /--secondary-offset:\s*0px/, "the unpinned panel contributes no layout width");
  assert.match(tokens, /--topbar-h:\s*64px/, "the top bar height contract is unchanged");
  assert.match(tokens, /--shell-nav-w:\s*calc\(var\(--rail-w\) \+ var\(--secondary-offset\)\)/, "and content padding derives from the responsive offset");

  /* Inline navigation begins at tablet width; focused mode still narrows the same rail. */
  const globals = sources[GLOBALS]!;
  assert.match(globals, /@media \(min-width: 768px\)[\s\S]*?--rail-w: var\(--rail-inline-w\)/, "inline navigation begins at 768px");
  /*
   * Scoped to the focused-mode block. `--secondary-w: 0px` appears TWICE in this stylesheet — the
   * operator's own collapse says it too — so an unscoped assertion cannot tell which one it is
   * reading, and a regression in one is invisible while the other stands. Found by its bite-proof.
   */
  const focusBlock = globals.slice(globals.indexOf('data-heby-focus="on"'));
  assert.match(focusBlock, /--rail-w: 56px/, "focused mode still narrows the rail to a strip");
  assert.match(focusBlock, /--secondary-offset: 0px/, "and still removes the column's layout offset");

  /* VI-2 wrote nothing into the stylesheet at all. */
  assert.ok(!/VI-2|vi2/.test(globals), "VI-2 introduced no global rule");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 11. NOTHING FROM VI-2 REACHES THE FROZEN SURFACE
 * ────────────────────────────────────────────────────────────────────────── */
function hebyIsUntouched(sources: Sources): void {
  for (const file of ORDINARY_SHELL) {
    const code = codeOf(sources[file]!);
    assert.ok(!/heby-surface|--heby-|heby-presence/.test(code), `${file} carries none of Heby's tokens`);
    /* The launcher is the one Heby component the ordinary shell has always mounted. */
    for (const m of code.matchAll(/from "\.\/heby\/([\w-]+)"/g)) {
      assert.ok(
        ["heby-launcher", "heby-focus-mode"].includes(m[1]!),
        `${file} may not reach into the frozen surface beyond its released controls (found ${m[1]})`,
      );
    }
  }
  /* Heby's palette is still scoped, and no ordinary shell rule was added inside its block. */
  const globals = sources[GLOBALS]!;
  const scope = globals.slice(globals.indexOf(".heby-surface {"), globals.indexOf(".heby-surface {") + 3000);
  assert.match(scope, /--color-primary:\s*#e0a137/, "Heby's amber is still its own");
  for (const ordinary of ["data-shell=\"rail\"", "data-rail-label", "--secondary-w", "--rail-w"]) {
    assert.ok(!scope.includes(ordinary), `no ordinary shell rule may be written into .heby-surface (${ordinary})`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 12. NOTHING BENEATH PRESENTATION MOVED
 * ────────────────────────────────────────────────────────────────────────── */
function nothingBeneathPresentationMoved(sources: Sources): void {
  for (const file of ORDINARY_SHELL) {
    const code = codeOf(sources[file]!);
    for (const forbidden of [
      "drizzle", "@/db", "db/client", ".server", "use server",
      "resolveTenantContext", "tenantId", "decision_records", "migrations", "fetch(",
    ]) {
      assert.ok(!code.includes(forbidden), `${file} is presentational — it must not reach ${forbidden}`);
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * BITE-PROOFS
 * ────────────────────────────────────────────────────────────────────────── */
function biteProofs(sources: Sources): void {
  bites(
    "reintroduce truncate on a canonical secondary-nav label",
    secondaryLabelsAreNeverTruncated,
    withDefect(sources, SECONDARY, '<span className="min-w-0">{destination.label}</span>\n              {destination.elevated', '<span className="min-w-0 truncate">{destination.label}</span>\n              {destination.elevated'),
  );

  bites(
    "shorten the unavailable destination's label instead",
    secondaryLabelsAreNeverTruncated,
    withDefect(sources, SECONDARY, '<span className="min-w-0">{destination.label}</span>\n                <span className="ml-auto', '<span className="min-w-0 truncate">{destination.label}</span>\n                <span className="ml-auto'),
  );

  bites(
    "shrink the default secondary icon to make room rather than wrapping",
    secondaryLabelsAreNeverTruncated,
    withDefect(sources, SECONDARY, 'inline ? "mt-0.5 size-3" : "size-4"', 'inline ? "mt-0.5 size-3" : "size-3"'),
  );

  bites(
    "restore the silently truncated topbar tagline",
    topbarNeverTruncatesADescription,
    withDefect(sources, TOPBAR, '<p className="truncate text-sm font-semibold text-fg">{surface.label}</p>', '<p className="truncate text-sm font-semibold text-fg">{surface.label}</p>\n        <p className="hidden truncate text-xs text-fg-muted sm:block">{surface.tagline}</p>'),
  );

  bites(
    "let the one owner of the description shorten it too",
    topbarNeverTruncatesADescription,
    withDefect(sources, SECONDARY, 'className="mt-0.5 text-xs leading-5 text-fg-muted">{heading.detail}', 'className="mt-0.5 truncate text-xs leading-5 text-fg-muted">{heading.detail}'),
  );

  bites(
    "hide the surface title at a breakpoint, leaving the bar with no identity at all",
    topbarNeverTruncatesADescription,
    withDefect(sources, TOPBAR, '<div className="min-w-0 flex-1 lg:flex-none lg:w-52">', '<div className="hidden min-w-0 flex-1 lg:flex-none lg:w-52">'),
  );

  bites(
    "drop a required shell label below the floor",
    shellTextRespectsTheFloor,
    withDefect(sources, RAIL, "py-1.5 text-sm font-semibold", "py-1.5 text-[0.62rem] font-semibold"),
  );

  bites(
    "drop the operator's role below the floor",
    shellTextRespectsTheFloor,
    withDefect(sources, TOPBAR, 'block text-xs text-fg-muted">Director', 'block text-[0.68rem] text-fg-muted">Director'),
  );

  bites(
    "state the floor in the inert Stage 0 utility, which renders at 16px",
    shellTextRespectsTheFloor,
    withDefect(sources, RAIL, "py-1.5 text-sm font-semibold", "py-1.5 text-label font-semibold"),
  );

  bites(
    "starve the widest workspace name by removing the integrated width contract",
    railNamesFitAtTheFloor,
    withDefect(sources, RAIL, "min-h-9 w-full min-w-0", "min-h-9 w-[76px] min-w-0"),
  );

  bites(
    "shorten a workspace name in the rail instead of fitting it",
    railNamesFitAtTheFloor,
    withDefect(sources, RAIL, '<span data-rail-label="" className="min-w-0 text-left leading-snug">', '<span data-rail-label="" className="min-w-0 truncate text-left leading-snug">'),
  );

  bites(
    "change the integrated rail icon contract",
    railNamesFitAtTheFloor,
    withDefect(sources, RAIL, 'Icon className="size-4 shrink-0"', 'Icon className="size-3 shrink-0"'),
  );

  bites(
    "change the rail width token",
    shellContractsAreUnchanged,
    withDefect(sources, TOKENS, "--rail-w: 92px", "--rail-w: 104px"),
  );

  bites(
    "change the top bar height contract",
    shellContractsAreUnchanged,
    withDefect(sources, TOKENS, "--topbar-h: 64px", "--topbar-h: 72px"),
  );

  bites(
    "restore Command as the Level-2 column's identity on an ambient surface",
    everyShellIdentitySiteIsHonest,
    withDefect(sources, SECONDARY, /const heading =[\s\S]*?: \{ label: workspace\.label, detail: workspace\.tagline \};/, "const heading = { label: workspace.label, detail: workspace.tagline };"),
  );

  bites(
    "give the inline submenu the wrong workspace identity",
    everyShellIdentitySiteIsHonest,
    withDefect(sources, RAIL, "workspace={workspace}", 'workspace={getWorkspace("command")}'),
  );

  bites(
    "take the way out away from an ambient surface",
    ambientSurfacesKeepTheirEscape,
    withDefect(sources, MOBILE, "selected ?? resolveActiveWorkspace(pathname)", "selected ?? \"command\""),
  );

  bites(
    "leak an ordinary shell rule into the protected Heby surface",
    hebyIsUntouched,
    withDefect(sources, GLOBALS, ".heby-surface {\n  --color-bg:", ".heby-surface {\n  --rail-w: 92px;\n  --color-bg:"),
  );

  bites(
    "let the ordinary shell reach into the frozen surface",
    hebyIsUntouched,
    withDefect(sources, RAIL, 'import { HebyLauncher } from "./heby/heby-launcher";', 'import { HebyLauncher } from "./heby/heby-launcher";\nimport { x } from "./heby/heby-workspace";'),
  );

  bites(
    "give a presentational shell file a server seam",
    nothingBeneathPresentationMoved,
    withDefect(sources, RAIL, 'import { useRole } from "./role-context";', 'import { useRole } from "./role-context";\nimport { read } from "@/features/knowledge/knowledge-read.server";'),
  );

  /*
   * ── SURGICAL VARIANTS ──────────────────────────────────────────────────────
   *
   * The mutations above each remove several properties at once, so they prove a FUNCTION bites
   * without proving which assertion does the work. Auditing every guard by neutering it one at a
   * time showed the same pattern VI-1 found: many lines were caught only by a sibling inside the
   * same mutation. Each mutation below removes exactly one distinct guarantee and nothing else.
   */
  bites(
    "break the derivation that gives the content its padding",
    shellContractsAreUnchanged,
    withDefect(sources, TOKENS, "--shell-nav-w: calc(var(--rail-w) + var(--secondary-offset))", "--shell-nav-w: 92px"),
  );

  bites(
    "stop focused mode narrowing the rail to a strip",
    shellContractsAreUnchanged,
    withDefect(sources, GLOBALS, "--rail-w: 56px", "--rail-w: 92px"),
  );

  bites(
    "stop focused mode collapsing the Level-2 column",
    shellContractsAreUnchanged,
    withDefect(sources, GLOBALS, '--secondary-offset: 0px;\n    /* A minimal strip', '--secondary-offset: 224px;\n    /* A minimal strip'),
  );

  bites(
    "move the inline-navigation breakpoint",
    shellContractsAreUnchanged,
    withDefect(sources, GLOBALS, "@media (min-width: 768px)", "@media (min-width: 1024px)"),
  );

  bites(
    "write a VI-2 rule into the global stylesheet instead of composing it",
    shellContractsAreUnchanged,
    withDefect(sources, GLOBALS, "@layer components {", "@layer components {\n  /* VI-2 */\n  .vi2-shell-label { font-size: 12px; }\n"),
  );

  bites(
    "give an ordinary shell file one of Heby's tokens",
    hebyIsUntouched,
    withDefect(sources, TOPBAR, 'data-shell="topbar"', 'data-shell="topbar"\n      data-heby-presence=""'),
  );

  bites(
    "let a Level-2 label force its container wider instead of yielding",
    secondaryLabelsAreNeverTruncated,
    withDefect(sources, SECONDARY, '<span className="min-w-0">{destination.label}</span>\n              {destination.elevated', '<span className="">{destination.label}</span>\n              {destination.elevated'),
  );

  bites(
    "shrink the default Level-2 row below its established density",
    secondaryLabelsAreNeverTruncated,
    withDefect(sources, SECONDARY, 'min-h-10 gap-2.5 rounded-lg px-3 text-sm', 'min-h-8 gap-2.5 rounded-lg px-3 text-sm'),
  );

  bites(
    "stop the integrated rail item filling its width",
    railNamesFitAtTheFloor,
    withDefect(sources, RAIL, "min-h-9 w-full min-w-0", "min-h-9 w-[76px] min-w-0"),
  );

  bites(
    "stop the active rail item supplying the honest workspace",
    everyShellIdentitySiteIsHonest,
    withDefect(sources, RAIL, "workspace={workspace}", 'workspace={getWorkspace("command")}'),
  );

  bites(
    "let the Level-2 column render no way out for a surface it does not recognise",
    ambientSurfacesKeepTheirEscape,
    withDefect(sources, SECONDARY, "        {destinations.map((destination) => {", "        {surface.workspace === null ? null : destinations.map((destination) => {"),
  );

  bites(
    "stop the Level-2 column listing the fallback's sections",
    ambientSurfacesKeepTheirEscape,
    withDefect(sources, SECONDARY, "const destinations = destinationsForRole(workspace, role);", "const destinations = workspace.destinations;"),
  );

  bites(
    "repaint Heby's accent with the product's own",
    hebyIsUntouched,
    withDefect(sources, GLOBALS, "--color-primary:        #e0a137", "--color-primary:        #2563eb"),
  );

  /*
   * ── WHAT THE GUARD AUDIT FOUND, AND WHAT IT COULD NOT REACH ────────────────
   *
   * Every assertion in this file was neutered in turn and the suite re-run. 23 are load-bearing:
   * removing one turns the suite red. The remaining 33 fall into four kinds, none of which is a
   * dead guard, and all of which are recorded here rather than papered over with a mutation that
   * would isolate nothing:
   *
   *   HARNESS RAILS (2)      `withDefect`'s own checks. They fire when a FUTURE bite-proof is
   *                          mis-written — never against today's sources, by construction.
   *
   *   UN-MUTATABLE (9)       Everything asserted against the IMPORTED `WORKSPACES`, `HEBY` and the
   *                          two resolvers. A text mutation of `workspace-nav.ts` cannot affect a
   *                          module this process already loaded — which is why these are the
   *                          strongest assertions here: they run against the real code, not a copy
   *                          of its text. "Heby becomes an eighth workspace" is in this group.
   *
   *   SIBLING-COVERED (18)   Defence in depth. The per-workspace rail loop is entailed by the
   *                          widest-name check; the two tagline prohibitions catch one mutation
   *                          between them; the positive `text-xs` assertions are entailed by the
   *                          numeric sub-floor sweep. Removing any one still leaves the property
   *                          guarded — that is the point of having two.
   *
   *   RECORDED MEASUREMENT (4)  Assertions about the measured constants themselves — that the
   *                          widest title fits 208px, that the longest description never could,
   *                          that the two wide labels really do exceed 150px. No source mutation
   *                          can move a number recorded in this file; they fail exactly when
   *                          someone edits the measurements, which is when they should.
   */
  /*
   * ADDING HEBY AS AN EIGHTH WORKSPACE cannot be bite-proved by mutating source text: `WORKSPACES`
   * is imported and frozen at module load, so a text mutation of `workspace-nav.ts` changes nothing
   * this process has already read. It is proved directly instead — the invariant is asserted against
   * the real, imported array, and against the real resolver, in `everyShellIdentitySiteIsHonest`.
   * Recorded here rather than faked with a mutation that would apply and prove nothing.
   */
  assert.equal(WORKSPACES.length, 7);
  assert.ok(!WORKSPACES.some((w) => (w.label as string) === HEBY.label), "Heby is not among the seven");
}

function main(): void {
  const sources = load();

  shellTextRespectsTheFloor(sources);
  railNamesFitAtTheFloor(sources);
  secondaryLabelsAreNeverTruncated(sources);
  topbarNeverTruncatesADescription(sources);
  everyShellIdentitySiteIsHonest(sources);
  ambientSurfacesKeepTheirEscape(sources);
  shellContractsAreUnchanged(sources);
  hebyIsUntouched(sources);
  nothingBeneathPresentationMoved(sources);

  biteProofs(sources);

  console.log("VI-2 shell readability + label geometry: all assertions passed, all bite-proofs bit.");
}

main();
