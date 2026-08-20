/*
 * VI-1 — Visual Integrity Foundation.
 *
 * ── WHAT THIS SUITE IS FOR ───────────────────────────────────────────────────
 *
 * VI-1 changed no read, no writer, no authority and no row. It changed three things, and all three
 * are the kind of change that has no compiler behind it:
 *
 *   A  the shell stopped claiming `/heby` is Command
 *   B  nine duplicated region headers became one grammar that cannot starve a heading
 *   C  a provenance chip stopped deleting the authority it names in order to fit
 *
 * Every claim below is stated so that the DEFECT — the measured, released behaviour that VI-1
 * removed — makes it fail. Each is followed by a bite-proof that restores that defect and requires
 * the assertion to catch it. A mutation that does not APPLY is rejected before it can be counted:
 * a bite-proof that silently failed to change anything looks exactly like one that failed to bite.
 *
 * The measurements quoted are from the authenticated local product at HEAD 76a8d3a, 1440×900 and
 * 390×844, before any file in this phase was touched.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  HEBY,
  UNASSIGNED_SURFACE_LABEL,
  WORKSPACES,
  getWorkspace,
  resolveActiveWorkspace,
  resolveShellSurface,
  type ShellSurface,
} from "../../src/config/workspace-nav";

const ROOT = process.cwd();

const REGION_HEADER = "src/components/ui/region-header.tsx";
const PROVENANCE_CHIP = "src/components/ui/provenance-chip.tsx";
const TOPBAR = "src/components/layout/topbar.tsx";
const RAIL = "src/components/layout/workspace-rail.tsx";
const MOBILE_NAV = "src/components/layout/mobile-nav.tsx";
const BADGE = "src/components/ui/badge.tsx";
const CARD = "src/components/ui/card.tsx";
const GLOBALS = "src/app/globals.css";

/** The nine workspace regions that used to each carry their own copy of the broken header. */
const REGIONS = [
  "src/components/command-center/command-region.tsx",
  "src/components/decision-workspace/decision-region.tsx",
  "src/components/governance-workspace/governance-region.tsx",
  "src/components/intelligence-workspace/workspace-region.tsx",
  "src/components/knowledge-workspace/knowledge-region.tsx",
  "src/components/operations-workspace/operations-region.tsx",
  "src/components/platform-workspace/platform-region.tsx",
  "src/components/security-center/security-region.tsx",
  "src/components/workforce-workspace/workforce-region.tsx",
];

const TRACKED = [REGION_HEADER, PROVENANCE_CHIP, TOPBAR, RAIL, MOBILE_NAV, BADGE, CARD, GLOBALS, ...REGIONS];

type Sources = Readonly<Record<string, string>>;

function load(): Sources {
  return Object.freeze(
    Object.fromEntries(TRACKED.map((file) => [file, readFileSync(path.join(ROOT, file), "utf8")])),
  );
}

/*
 * Several claims below forbid words that this file's own prose, and the source's, both NAME. Strip
 * comments before proving a prohibition over text — the repository has been bitten by this before.
 */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Produce a source set with one defect restored.
 *
 * The `notEqual` is the point: a mutation that fails to apply produces a source set identical to
 * the real one, the assertion under test passes, and `assert.throws` reports "did not throw" —
 * indistinguishable from a proof that genuinely did not bite. So a non-applying mutation is a hard
 * failure of the bite-proof itself, never a quiet pass.
 */
function withDefect(base: Sources, file: string, from: string | RegExp, to: string): Sources {
  const before = base[file];
  assert.ok(before !== undefined, `bite-proof names an untracked file: ${file}`);
  const after = before.replace(from, to);
  assert.notEqual(after, before, `bite-proof mutation did not APPLY to ${file} — it would prove nothing`);
  return Object.freeze({ ...base, [file]: after });
}

function bites(label: string, check: (s: Sources) => void, mutated: Sources): void {
  assert.throws(() => check(mutated), `bite-proof "${label}" did not bite — the assertion does not guard it`);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. THE SHELL NEVER CALLS `/heby` COMMAND
 *
 * Measured before VI-1, on `/heby`: topbar title "Command", topbar tagline "Executive operating
 * surface — situational overview and the human decision.", and Command carrying `aria-current`
 * in the rail. The cause was a resolver whose return type could not say "none of the seven".
 * ────────────────────────────────────────────────────────────────────────── */
function hebyIsNeverCommand(resolve: (pathname: string) => ShellSurface): void {
  const command = getWorkspace("command");

  for (const pathname of ["/heby", "/heby/anything"]) {
    const surface = resolve(pathname);
    assert.equal(surface.workspace, null, `${pathname} belongs to none of the seven workspaces`);
    assert.notEqual(surface.label, command.label, `${pathname} must not be labelled Command`);
    assert.notEqual(surface.tagline, command.tagline, `${pathname} must not borrow Command's sentence`);
    assert.equal(surface.kind, "ambient", `${pathname} is the ambient layer, named as such`);
    assert.equal(surface.label, HEBY.label, `${pathname} is named by Heby's own constant`);
  }

  /* And an ordinary workspace is still resolved as itself — the fix removes a lie, not a capability. */
  for (const workspace of WORKSPACES) {
    const surface = resolve(workspace.href);
    assert.equal(surface.workspace, workspace.id, `${workspace.href} still resolves to ${workspace.id}`);
    assert.equal(surface.kind, "workspace");
    assert.equal(surface.tagline, workspace.tagline);
  }
}

function navigationIdentityIsHonest(sources: Sources): void {
  hebyIsNeverCommand(resolveShellSurface);

  /*
   * BITE-PROOF — restore the bare Command fallback, behaviourally. This is the exact resolver the
   * product shipped: `getWorkspace(resolveActiveWorkspace(pathname))`, whose answer for `/heby` is
   * Command. `resolveActiveWorkspace` is deliberately still exported and still behaves that way, so
   * this reconstruction is the released defect itself and not an imitation of it.
   */
  const released = (pathname: string): ShellSurface => {
    const id = resolveActiveWorkspace(pathname);
    const workspace = getWorkspace(id);
    return { kind: "workspace", label: workspace.label, tagline: workspace.tagline, workspace: id };
  };
  assert.equal(released("/heby").label, "Command", "the released defect is reproduced, not imagined");
  assert.throws(
    () => hebyIsNeverCommand(released),
    "restoring the bare Command fallback must fail this proof",
  );

  /* The product must actually be wired to the honest resolver, or the behaviour proof is decorative. */
  for (const file of [TOPBAR, RAIL]) {
    const code = codeOf(sources[file]!);
    assert.match(code, /resolveShellSurface/, `${file} names the surface with the resolver that may answer null`);
    assert.ok(
      !/resolveActiveWorkspace/.test(code),
      `${file} states an identity, so it may not use the resolver that cannot say "none of the seven"`,
    );
  }

  /*
   * The mobile drawer is the one place both questions are asked, on purpose: the active MARK is the
   * honest resolver, and the drawer's opening list keeps the fallback so an ambient surface still
   * offers a way out. Removing the way out is the mistake this repository already learned once.
   */
  const drawer = codeOf(sources[MOBILE_NAV]!);
  assert.match(drawer, /activeWorkspace = resolveShellSurface\(pathname\)\.workspace/, "the mark is honest");
  assert.match(drawer, /selected \?\? resolveActiveWorkspace\(pathname\)/, "the way out is preserved");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. THE SEVEN ARE STILL SEVEN, AND HEBY IS NOT ONE OF THEM
 * ────────────────────────────────────────────────────────────────────────── */
function sevenWorkspacesRemainSeven(): void {
  assert.equal(WORKSPACES.length, 7, "the top level is exactly seven workspaces and does not grow");
  assert.deepEqual(
    WORKSPACES.map((w) => w.id),
    ["command", "intelligence", "knowledge", "operations", "workforce", "governance", "platform"],
    "the seven ids are unchanged by VI-1",
  );
  assert.ok(
    !WORKSPACES.some((w) => (w.href as string) === HEBY.href),
    "naming Heby honestly did not make it an eighth workspace",
  );
  assert.ok(
    !WORKSPACES.some((w) => (w.match ?? []).some((m) => m === HEBY.href || HEBY.href.startsWith(`${m}/`))),
    "no workspace may claim Heby's route through a legacy match prefix",
  );
  /* Heby's identity is its own constant, and it carries a tagline that is about Heby. */
  assert.match(HEBY.tagline, /ambient/i, "Heby's own sentence says what it is");
  assert.ok(!/operating surface/i.test(HEBY.tagline), "and it is not Command's sentence reworded");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. `/foundation` IS LEFT EXPLICITLY UNASSIGNED
 *
 * Its information-architecture decision is deferred. A shell that guessed a workspace for it would
 * make the deferral invisible — which is how it came to read "Command" in the first place.
 * ────────────────────────────────────────────────────────────────────────── */
function foundationStaysDeferred(): void {
  const surface = resolveShellSurface("/foundation");
  assert.equal(surface.kind, "unassigned", "/foundation is not assigned to a workspace");
  assert.equal(surface.workspace, null, "and it is not silently mapped to one");
  assert.equal(surface.label, UNASSIGNED_SURFACE_LABEL, "it is named by the product, claiming nothing further");
  assert.equal(surface.tagline, undefined, "no tagline is invented where none is true");
  assert.notEqual(surface.label, getWorkspace("command").label, "and above all it is not Command");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4 + 5 + 6 + 7. ONE REGION GRAMMAR, AND IT CANNOT STARVE A HEADING
 *
 * Measured before VI-1: `/knowledge` @1440 gave the h2 "Evidence & Provenance" 96px of the 153px
 * it needed; `/command` @1440 gave eight labels 57px of the 78–140px they needed; `/knowledge`
 * @390 rendered a 415px action block inside a 390px viewport.
 * ────────────────────────────────────────────────────────────────────────── */
function regionHeadingMayWrapAndIsNeverTruncated(sources: Sources): void {
  const header = sources[REGION_HEADER]!;
  const code = codeOf(header);

  assert.ok(!/truncate/.test(code), "a region heading is never truncated — it states what its rows are");
  assert.ok(!/line-clamp/.test(code), "nor clamped, which is truncation by another name");
  assert.ok(!/whitespace-nowrap/.test(code), "and it is allowed to wrap, so a long title cannot force overflow");

  /* Scoped to the heading itself, not merely to the file: the h2 must carry no shortening class. */
  const h2 = code.slice(code.indexOf("<h2"), code.indexOf("</h2>"));
  assert.ok(h2.length > 0, "the grammar renders a heading");
  for (const shortening of ["truncate", "line-clamp", "whitespace-nowrap", "overflow-hidden"]) {
    assert.ok(!h2.includes(shortening), `the heading itself carries no ${shortening}`);
  }
}

function regionActionCannotStarveTheHeading(sources: Sources): void {
  const code = codeOf(sources[REGION_HEADER]!);

  /* The row wraps, so the action has somewhere to go other than into the title's space. */
  assert.match(code, /<header[\s\S]{0,400}?flex-wrap/, "the header row itself wraps");

  /*
   * The title group's hypothetical size is 10rem, which is what makes the browser break the line.
   * With `flex-basis: 0` the line would always "fit" and the action would compress the title instead
   * — the released behaviour, in a different disguise.
   */
  const titleGroup = code.slice(code.indexOf('<div className="min-w-'), code.indexOf("<h2"));
  assert.match(titleGroup, /basis-40/, "the title claims a real basis, so the line can break");
  assert.match(titleGroup, /grow/, "and it takes the space the action does not need");
  assert.match(
    titleGroup,
    /min-w-\[min\(10rem,100%\)\]/,
    "a floor that yields before the box does — a bare min-w-40 would overflow a narrower region",
  );
  assert.ok(!/\bflex-1\b/.test(titleGroup), "flex-1 would set basis 0 and delete the wrap trigger");

  /*
   * And the action wrapper yields. `shrink-0` on it is the single word that let a 415px pill sit in
   * a 390px viewport: the wrapper claimed max-content, so its child was never asked to shrink.
   */
  const actionAt = code.indexOf("{action ?");
  const actionWrapper = code.slice(actionAt, actionAt + 220);
  assert.ok(actionAt > 0, "the grammar renders an action slot");
  assert.ok(!actionWrapper.includes("shrink-0"), "the action wrapper yields — it never claims max-content");
  assert.match(actionWrapper, /max-w-full/, "and it is hard-stopped at its container");
  assert.match(actionWrapper, /flex-wrap/, "so a wide action wraps inside the region rather than leaving it");
}

function allNineRegionsUseTheOneGrammar(sources: Sources): void {
  for (const region of REGIONS) {
    const source = sources[region]!;
    const code = codeOf(source);
    assert.match(code, /<RegionHeader\b/, `${region} composes the shared grammar`);
    assert.ok(!/<header\b/.test(code), `${region} no longer carries a header of its own`);
    assert.ok(
      !/truncate font-semibold/.test(code),
      `${region} no longer carries the truncating heading it used to duplicate`,
    );
    assert.ok(
      !/shrink-0 items-center gap-2">\{action\}/.test(code),
      `${region} no longer carries the unyielding action wrapper`,
    );
    assert.match(
      source,
      /from "@\/components\/ui\/region-header"/,
      `${region} imports the one grammar rather than restating it`,
    );
  }

  /*
   * VI-1 unified GEOMETRY, not type. Every size the nine shipped is preserved exactly: eight
   * pre-Stage-0 regions on `legacy`, Knowledge on `stage0`. Folding a typography change in here
   * would have made a geometry fix indistinguishable from a sweep — and `/finance` is the measured
   * record of what happens when text grows inside a row that cannot yield.
   */
  const canonical = codeOf(sources["src/components/knowledge-workspace/knowledge-region.tsx"]!);
  assert.match(canonical, /typeScale="stage0"/, "the canonical workspace keeps the Stage 0 scale");
  const legacyRegions = REGIONS.filter((r) => !r.includes("knowledge-workspace"));
  for (const region of legacyRegions) {
    assert.ok(
      !/typeScale=/.test(codeOf(sources[region]!)),
      `${region} keeps the sizes it already shipped — VI-1 performs no typography sweep`,
    );
  }
  const grammar = codeOf(sources[REGION_HEADER]!);
  assert.match(grammar, /text-\[0\.6rem\]/, "the legacy eyebrow size is preserved, not raised");
  assert.match(grammar, /text-\[0\.8rem\]/, "the legacy plain-title size is preserved, not raised");
  assert.match(grammar, /text-label/, "and the Stage 0 sizes are preserved for the canonical scale");
  assert.match(grammar, /text-meta/);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 8 + 9. PROVENANCE SURVIVES A TOUCH DEVICE, AND KINDS STAY DISTINGUISHABLE
 * ────────────────────────────────────────────────────────────────────────── */
function provenanceDetailIsAvailableWithoutHover(sources: Sources): void {
  const source = sources[PROVENANCE_CHIP]!;
  const code = codeOf(source);

  assert.ok(!/truncate/.test(code), "the chip no longer discards the authority it names");
  assert.ok(!/line-clamp/.test(code), "nor clamps it");
  assert.match(code, /max-w-full/, "it is still bounded by its container");
  assert.match(code, /min-w-0/, "and still yields — by wrapping, which costs height and nothing else");

  /*
   * The detail must be in the rendered tree unconditionally. A hover-, focus- or group-gated
   * disclosure would put it back out of reach of exactly the device that lost it.
   */
  const body = code.slice(code.indexOf("return ("));
  assert.match(body, /\{detail \? <span[^>]*>[^<]*\{detail\}<\/span> : null\}/, "the detail renders inline");
  for (const gate of ["hover:", "group-hover", "peer-hover", "focus-within:", "onMouseEnter", "useState"]) {
    assert.ok(!body.includes(gate), `the detail is not gated behind ${gate}`);
  }

  /* The kind's meaning stays reachable by assistive technology, as it already was. */
  assert.match(body, /sr-only/, "the meaning sentence is still announced");
}

function authoritativeAndDerivedStayDistinct(sources: Sources): void {
  const code = codeOf(sources[PROVENANCE_CHIP]!);
  const specOf = (kind: string): string => {
    const at = code.indexOf(`${kind}: {`);
    assert.ok(at > 0, `the ${kind} spec exists`);
    return code.slice(at, code.indexOf("},", at));
  };
  const authoritative = specOf("authoritative");
  const derived = specOf("derived");

  const classOf = (spec: string): string => /className:\s*"([^"]*)"/.exec(spec)?.[1] ?? "";
  const iconOf = (spec: string): string => /icon:\s*(\w+)/.exec(spec)?.[1] ?? "";
  const labelOf = (spec: string): string => /label:\s*"([^"]*)"/.exec(spec)?.[1] ?? "";

  /*
   * This first assertion CANNOT be isolated by a bite-proof, and that is a property of the claim
   * rather than a gap in the proof. Any mutation that makes the two class strings equal also makes
   * one of them carry `dashed` when it must not, or lack it when it must — so the border-style
   * assertions below fire alongside it, every time. Defence in depth, recorded as such instead of
   * being dressed up with a contrived mutation that isolates nothing.
   */
  assert.notEqual(classOf(authoritative), classOf(derived), "a record and a recomputed view never look alike");
  assert.notEqual(iconOf(authoritative), iconOf(derived), "and they never carry the same mark");
  assert.notEqual(labelOf(authoritative), labelOf(derived), "and never the same word");
  assert.ok(classOf(authoritative).length > 0 && classOf(derived).length > 0, "both are actually styled");

  /* Colour is never the only carrier: the distinction survives a monochrome rendering. */
  assert.match(classOf(derived), /dashed/, "derived is distinguishable by border style, not only by colour");
  assert.ok(!/dashed/.test(classOf(authoritative)), "and authoritative is not");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 10 + 11. WHAT VI-1 WAS FORBIDDEN TO TOUCH
 * ────────────────────────────────────────────────────────────────────────── */
function frozenPrimitivesAreUntouched(sources: Sources): void {
  const badge = sources[BADGE]!;
  assert.match(badge, /shrink-0/, "Badge still refuses to shrink — it was correct, and it is unchanged");
  assert.match(badge, /whitespace-nowrap/, "Badge still never wraps its own word");
  assert.match(badge, /text-\[0\.7rem\]/, "Badge's size is untouched — typography is not this gate's");
  assert.ok(!/truncate/.test(badge), "Badge still never truncates itself");

  const card = sources[CARD]!;
  assert.match(card, /overflow-hidden rounded-xl/, "Card's containment is unchanged");
  assert.match(
    codeOf(card),
    /stacked \? "min-w-0" : "sm:flex-row sm:items-start sm:justify-between"/,
    "CardHeader's default is still the row, and `stacked` is still opt-in",
  );

  /*
   * The global reset stays. It is load-bearing: hundreds of layouts omit `min-w-0` and depend on
   * it, and removing it would CREATE the horizontal overflow this product currently does not have.
   * It is also the amplifier that renders a `size-10` icon at 3.67px on /finance — which is a
   * measured argument for fixing that composition, not for deleting a rule the product leans on.
   */
  const base = sources[GLOBALS]!.slice(sources[GLOBALS]!.indexOf("@layer base"));
  assert.match(base, /\*\s*\{[^}]*min-width:\s*0/, "the global min-width reset is untouched by VI-1");
}

function hebyIsUntouched(sources: Sources): void {
  /* No VI-1 file may reach into the frozen surface, and none of it may carry Heby's vocabulary. */
  for (const file of [REGION_HEADER, PROVENANCE_CHIP, ...REGIONS]) {
    const code = codeOf(sources[file]!);
    assert.ok(!/layout\/heby/.test(code), `${file} does not import anything from the Heby surface`);
    assert.ok(!/heby-surface|--heby-|heby-presence/.test(code), `${file} carries none of Heby's tokens`);
  }
  /* And the new grammar is not adopted INTO Heby, which keeps its own. */
  assert.ok(
    !readFileSync(path.join(ROOT, "src/components/layout/heby/heby-workspace.tsx"), "utf8").includes("RegionHeader"),
    "Heby does not adopt an ordinary-workspace primitive",
  );
  /* Heby's palette scope is where it was: declared inside `.heby-surface`, never at the root. */
  const css = sources[GLOBALS]!;
  const scope = css.slice(css.indexOf(".heby-surface {"), css.indexOf(".heby-surface {") + 3000);
  assert.match(scope, /--color-primary:\s*#e0a137/, "Heby's amber is still scoped to its own surface");
  assert.ok(
    !/^:root\s*\{[\s\S]*?--heby-/m.test(css),
    "and no Heby token leaks to the document root",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 12. ZERO SCHEMA, RUNTIME AND AUTHORITY IMPACT
 * ────────────────────────────────────────────────────────────────────────── */
function nothingBeneathPresentationMoved(sources: Sources): void {
  const CHANGED = [REGION_HEADER, PROVENANCE_CHIP, TOPBAR, RAIL, MOBILE_NAV, ...REGIONS];
  for (const file of CHANGED) {
    const code = codeOf(sources[file]!);
    for (const forbidden of [
      "drizzle",
      "@/db",
      "db/client",
      ".server",
      "use server",
      "resolveTenantContext",
      "tenantId",
      "decision_records",
      "establishGovernance",
      "migrations",
    ]) {
      assert.ok(!code.includes(forbidden), `${file} is presentational — it must not reach ${forbidden}`);
    }
  }
  /* The one new file is server-safe: it holds no state and runs no effect. */
  const grammar = codeOf(sources[REGION_HEADER]!);
  for (const runtime of ["use client", "useState", "useEffect", "fetch(", "window."]) {
    assert.ok(!grammar.includes(runtime), `the shared grammar is server-safe — it must not use ${runtime}`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * BITE-PROOFS — every defect VI-1 removed, restored, and caught.
 * ────────────────────────────────────────────────────────────────────────── */
function biteProofs(sources: Sources): void {
  /* The navigation bite-proof is behavioural and lives inside its own check — see above. */

  bites(
    "reintroduce truncate on the region heading",
    regionHeadingMayWrapAndIsNeverTruncated,
    withDefect(sources, REGION_HEADER, '<h2\n          className={cn(\n            "font-semibold', '<h2\n          className={cn(\n            "truncate font-semibold'),
  );

  bites(
    "restore the released action wrapper wholesale",
    regionActionCannotStarveTheHeading,
    withDefect(sources, REGION_HEADER, '<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">', '<div className="flex shrink-0 items-center gap-2">'),
  );

  /*
   * SURGICAL VARIANTS. The wholesale mutation above deletes three properties at once, so it proves
   * the function bites without proving WHICH assertion does the work — neutering the `shrink-0`
   * line alone left the suite green, which is exactly the vacuity this repository keeps rediscovering.
   * Each mutation below removes exactly one guarantee and nothing else.
   */
  bites(
    "re-add shrink-0 to the action wrapper, changing nothing else",
    regionActionCannotStarveTheHeading,
    withDefect(sources, REGION_HEADER, '<div className="flex min-w-0 max-w-full flex-wrap', '<div className="flex min-w-0 shrink-0 max-w-full flex-wrap'),
  );

  bites(
    "remove only max-w-full from the action wrapper",
    regionActionCannotStarveTheHeading,
    withDefect(sources, REGION_HEADER, '"flex min-w-0 max-w-full flex-wrap items-center gap-2"', '"flex min-w-0 flex-wrap items-center gap-2"'),
  );

  bites(
    "remove only flex-wrap from the action wrapper",
    regionActionCannotStarveTheHeading,
    withDefect(sources, REGION_HEADER, '"flex min-w-0 max-w-full flex-wrap items-center gap-2"', '"flex min-w-0 max-w-full items-center gap-2"'),
  );

  bites(
    "remove only basis-40, leaving flex-basis to default to auto",
    regionActionCannotStarveTheHeading,
    withDefect(sources, REGION_HEADER, "shrink grow basis-40", "shrink grow"),
  );

  bites(
    "remove only grow, so the title no longer takes the space the action does not need",
    regionActionCannotStarveTheHeading,
    withDefect(sources, REGION_HEADER, "shrink grow basis-40", "shrink basis-40"),
  );

  bites(
    "add flex-1 alongside basis-40 — the realistic regression, where the basis survives in the class list and is overridden anyway",
    regionActionCannotStarveTheHeading,
    withDefect(sources, REGION_HEADER, "shrink grow basis-40", "flex-1 shrink grow basis-40"),
  );

  bites(
    "truncate the EYEBROW instead of the heading — invisible to an assertion scoped to the h2",
    regionHeadingMayWrapAndIsNeverTruncated,
    withDefect(sources, REGION_HEADER, '"font-semibold uppercase tracking-[0.14em] text-fg-muted"', '"truncate font-semibold uppercase tracking-[0.14em] text-fg-muted"'),
  );

  bites(
    "remove only the heading's min-width floor",
    regionActionCannotStarveTheHeading,
    withDefect(sources, REGION_HEADER, 'min-w-[min(10rem,100%)] max-w-full', "max-w-full"),
  );

  bites(
    "delete the wrap trigger by giving the title group flex-basis 0",
    regionActionCannotStarveTheHeading,
    withDefect(sources, REGION_HEADER, "shrink grow basis-40", "flex-1"),
  );

  bites(
    "stop the header row from wrapping",
    regionActionCannotStarveTheHeading,
    withDefect(sources, REGION_HEADER, "flex min-w-0 flex-wrap items-center justify-between", "flex min-w-0 items-center justify-between"),
  );

  bites(
    "make one region keep a private copy of the header",
    allNineRegionsUseTheOneGrammar,
    withDefect(
      sources,
      "src/components/command-center/command-region.tsx",
      /<RegionHeader[\s\S]*?\/>/,
      '<header className="flex items-center justify-between gap-3"><h2 className="truncate font-semibold text-fg">{title}</h2></header>',
    ),
  );

  bites(
    "make provenance detail hover-only again",
    provenanceDetailIsAvailableWithoutHover,
    withDefect(sources, PROVENANCE_CHIP, '<span className="min-w-0">', '<span className="min-w-0 truncate">'),
  );

  bites(
    "collapse authoritative and derived into one treatment",
    authoritativeAndDerivedStayDistinct,
    withDefect(
      sources,
      PROVENANCE_CHIP,
      'className: "border border-dashed border-border-strong bg-surface-sunken text-fg-secondary"',
      'className: "border border-border-strong bg-surface text-fg"',
    ),
  );

  bites(
    "touch Badge",
    frozenPrimitivesAreUntouched,
    withDefect(sources, BADGE, "inline-flex shrink-0 items-center", "inline-flex items-center"),
  );

  bites(
    "remove the global min-width reset",
    frozenPrimitivesAreUntouched,
    withDefect(sources, GLOBALS, "    border-color: var(--color-border);\n    min-width: 0;", "    border-color: var(--color-border);"),
  );

  bites(
    "change the CardHeader default",
    frozenPrimitivesAreUntouched,
    withDefect(sources, CARD, 'stacked ? "min-w-0" : "sm:flex-row sm:items-start sm:justify-between"', '"min-w-0"'),
  );

  bites(
    "let the shared grammar reach into Heby",
    hebyIsUntouched,
    withDefect(sources, REGION_HEADER, 'import { cn } from "@/lib/utils";', 'import { cn } from "@/lib/utils";\nimport { x } from "@/components/layout/heby/heby-surface-context";'),
  );

  bites(
    "let a presentational file reach a server seam",
    nothingBeneathPresentationMoved,
    withDefect(sources, REGION_HEADER, 'import { cn } from "@/lib/utils";', 'import { cn } from "@/lib/utils";\nimport { readThing } from "@/features/knowledge/knowledge-read.server";'),
  );
}

function main(): void {
  const sources = load();

  navigationIdentityIsHonest(sources);
  sevenWorkspacesRemainSeven();
  foundationStaysDeferred();
  regionHeadingMayWrapAndIsNeverTruncated(sources);
  regionActionCannotStarveTheHeading(sources);
  allNineRegionsUseTheOneGrammar(sources);
  provenanceDetailIsAvailableWithoutHover(sources);
  authoritativeAndDerivedStayDistinct(sources);
  frozenPrimitivesAreUntouched(sources);
  hebyIsUntouched(sources);
  nothingBeneathPresentationMoved(sources);

  biteProofs(sources);

  console.log("VI-1 visual integrity foundation: all assertions passed, all bite-proofs bit.");
}

main();
