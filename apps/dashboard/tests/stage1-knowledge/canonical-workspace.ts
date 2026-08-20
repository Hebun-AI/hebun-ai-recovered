/*
 * Stage 0 + Stage 1 — the foundations, and Knowledge as the first canonical Hebun workspace.
 *
 * ── WHAT THIS SUITE IS FOR ───────────────────────────────────────────────────
 *
 * Stage 1 changed no read, no writer, no authority and no row. Everything it changed is
 * PRESENTATION — which is exactly the class of change that has no compiler behind it and therefore
 * needs proofs. The claims below are the ones that, if they quietly stopped being true, would turn
 * an honest surface into a plausible one:
 *
 *   1  empty is not unavailable            a read that failed may never render as "none"
 *   2  derived is not authoritative        a recomputed view may never carry a record's weight
 *   3  Knowledge cannot ratify             authoring and Governance stay two authorities
 *   4  destruction is not navigation       withdrawal never renders as a passive link
 *   5  no mock reaches the canonical surface
 *   6  Heby stays outside this vocabulary  the frozen surface gains no ordinary-workspace primitive
 *   7  no arbitrary sub-`text-xs` type in the canonical surface
 *   8  a Badge never truncates its own label
 *   9  nothing in the canonical surface can force horizontal page overflow
 *  10  the tenant boundary is unchanged
 *
 * Static analysis over source, in the style the released suites already use: comment-stripped where
 * a prohibition is proved over text, and walked over the real import graph where reachability is
 * the claim — because this file's own prose names most of the things it forbids.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const PAGE = "src/app/(dashboard)/knowledge/page.tsx";

/** The components that make up the canonical surface. The vocabulary disclosure is listed too. */
const CANONICAL = [
  PAGE,
  "src/components/knowledge-workspace/knowledge-records.tsx",
  "src/components/knowledge-workspace/knowledge-standing.tsx",
  "src/components/knowledge-workspace/company-understanding-card.tsx",
  "src/components/knowledge-workspace/knowledge-authoring-card.tsx",
  "src/components/knowledge-workspace/knowledge-ingestion-card.tsx",
  "src/components/knowledge-workspace/knowledge-review-card.tsx",
  "src/components/knowledge-workspace/knowledge-sources-card.tsx",
  "src/components/knowledge-workspace/knowledge-version-control.tsx",
];

const PRIMITIVES = [
  "src/components/ui/state-block.tsx",
  "src/components/ui/provenance-chip.tsx",
  "src/components/ui/workspace-section.tsx",
];

function read(file: string): string {
  return readFileSync(path.join(ROOT, file), "utf8");
}

/* A prohibition proved over raw text is tripped by prose that merely NAMES the thing it forbids. */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Every string literal removed, for checks that must not be satisfied by copy. */
function withoutStringLiterals(source: string): string {
  return codeOf(source)
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

function srcFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== "migrations") walk(rel);
      } else if (/\.tsx?$/.test(entry.name)) out.push(rel);
    }
  };
  walk("src");
  return out;
}

/** Static import graph over src/, so reachability is walked rather than assumed. */
function importGraph(files: string[]): Map<string, Set<string>> {
  const known = new Set(files);
  const resolve = (spec: string, from: string): string | undefined => {
    let base: string;
    if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
    else if (spec.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
    else return undefined;
    for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
      if (known.has(candidate)) return candidate;
    }
    return undefined;
  };
  const graph = new Map<string, Set<string>>();
  for (const file of files) {
    const targets = new Set<string>();
    for (const spec of codeOf(read(file)).matchAll(/from\s+["']([^"']+)["']/g)) {
      const target = resolve(spec[1]!, file);
      if (target) targets.add(target);
    }
    graph.set(file, targets);
  }
  return graph;
}

function reachable(graph: Map<string, Set<string>>, start: string, targets: Set<string>): Set<string> {
  const seen = new Set([start]);
  const stack = [start];
  const hits = new Set<string>();
  while (stack.length) {
    for (const next of graph.get(stack.pop()!) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      if (targets.has(next)) hits.add(next);
      stack.push(next);
    }
  }
  return hits;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. EMPTY IS NOT UNAVAILABLE
 * ────────────────────────────────────────────────────────────────────────── */
function emptyIsNotUnavailable(): void {
  const block = read(PRIMITIVES[0]!);

  /* The two tones exist, and they are two — not one with two names. */
  const tones = [...block.matchAll(/^\s{2}("?)(empty|unavailable|restricted|error|loading)\1:\s*\{/gm)]
    .map((m) => m[2]!);
  for (const tone of ["empty", "unavailable", "restricted", "error", "loading"]) {
    assert.ok(tones.includes(tone), `the ${tone} tone exists`);
  }

  /*
   * They differ by more than colour. Border treatment, mark and word are each compared, because a
   * distinction carried only by a colour token disappears in greyscale and in a screen reader.
   */
  const specOf = (tone: string): string => {
    const at = block.search(new RegExp(`^\\s{2}("?)${tone}\\1:\\s*\\{`, "m"));
    assert.ok(at > 0, `${tone} has a spec`);
    return block.slice(at, block.indexOf("},", at));
  };
  const empty = specOf("empty");
  const unavailable = specOf("unavailable");
  const restricted = specOf("restricted");

  assert.match(empty, /border-dashed/, "empty is dashed");
  assert.match(unavailable, /border-solid/, "unavailable is solid — it is not an answer of none");
  assert.match(restricted, /border-solid/, "restricted is solid");

  const markOf = (spec: string): string => {
    const m = /icon:\s*([A-Za-z]+)/.exec(spec);
    assert.ok(m, "the tone carries its own mark");
    return m![1]!;
  };
  const marks = new Set([markOf(empty), markOf(unavailable), markOf(restricted)]);
  assert.equal(marks.size, 3, "empty, unavailable and restricted each carry a DIFFERENT mark");

  const wordOf = (spec: string): string => /eyebrow:\s*"([^"]+)"/.exec(spec)![1]!;
  const words = new Set([wordOf(empty), wordOf(unavailable), wordOf(restricted)]);
  assert.equal(words.size, 3, "each tone names itself with a different word");

  /*
   * And the surface actually keeps them apart. The records component may only render `unavailable`
   * inside the branch that handles a failed read, and `empty` only where the read succeeded.
   */
  const records = read("src/components/knowledge-workspace/knowledge-records.tsx");
  const failedBranch = records.indexOf('listing.status === "unavailable"');
  const unavailableUse = records.indexOf('tone="unavailable"');
  const emptyUse = records.indexOf('tone="empty"');
  assert.ok(failedBranch > 0 && unavailableUse > failedBranch, "unavailable is rendered from the failed-read branch");
  assert.ok(emptyUse > unavailableUse, "empty is rendered after it, from the succeeded-read path");

  /* A failed read may never be described with the vocabulary of a count. */
  const failedSlice = records.slice(unavailableUse, emptyUse);
  for (const forbidden of ["no records", "0 record", "none found", "nothing found"]) {
    assert.ok(
      !failedSlice.toLowerCase().includes(forbidden),
      `the failed-read rendering must not say "${forbidden}" — that is a claim about the organization`,
    );
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. DERIVED IS NOT AUTHORITATIVE
 * ────────────────────────────────────────────────────────────────────────── */
function derivedIsNotAuthoritative(): void {
  const chip = read(PRIMITIVES[1]!);
  const specOf = (kind: string): string => {
    const at = chip.search(new RegExp(`^\\s{2}("?)${kind}\\1:\\s*\\{`, "m"));
    assert.ok(at > 0, `${kind} has a spec`);
    return chip.slice(at, chip.indexOf("},", at));
  };
  const authoritative = specOf("authoritative");
  const derived = specOf("derived");

  assert.match(derived, /border-dashed/, "derived is dashed — a view, not a record");
  assert.ok(!/border-dashed/.test(authoritative), "authoritative is not dashed");
  assert.match(authoritative, /text-fg\b/, "authoritative reads at full strength");
  assert.match(derived, /text-fg-secondary/, "derived reads quieter than the record it came from");
  assert.notEqual(
    /icon:\s*([A-Za-z]+)/.exec(authoritative)![1],
    /icon:\s*([A-Za-z]+)/.exec(derived)![1],
    "the two kinds carry different marks",
  );

  /* Provenance is a REQUIRED field of a section, so a new section cannot omit the question. */
  const section = read(PRIMITIVES[2]!);
  assert.match(
    section,
    /readonly provenance:\s*Provenance;/,
    "WorkspaceSection requires a provenance — it may not be optional",
  );
  assert.ok(
    !/readonly provenance\?:/.test(section),
    "provenance must not become optional",
  );

  /* Every section on the canonical page states one. */
  const page = read(PAGE);
  const opens = (page.match(/<WorkspaceSection/g) ?? []).length;
  const declared = (page.match(/provenance="/g) ?? []).length;
  assert.ok(opens > 0, "the canonical page is built from sections");
  assert.equal(declared, opens, "every section on the page declares its provenance");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. KNOWLEDGE CANNOT RATIFY — THE TWO AUTHORITIES STAY TWO
 * ────────────────────────────────────────────────────────────────────────── */
function knowledgeCannotRatify(): void {
  const page = read(PAGE);
  const code = codeOf(page);

  /* Both authorities are resolved, separately, and neither is derived from the other. */
  assert.match(code, /resolveKnowledgeWriteAuthority\(tenant\)/, "the authoring band is resolved");
  assert.match(code, /resolveGovernanceAuthority\(tenant\)/, "Governance authority is resolved separately");

  /*
   * The review block is computed from `governance` alone. Proved by taking the block expression's
   * own text — not the module — so an unrelated mention of `authority` elsewhere cannot satisfy it.
   */
  const start = code.indexOf("const reviewBlock");
  assert.ok(start > 0, "the review block is computed");
  const reviewBlock = code.slice(start, code.indexOf(";", code.indexOf("undefined;", start)));
  assert.match(reviewBlock, /governance/, "the review block reads the Governance authority");
  assert.ok(
    !/\bauthority\?\.|\bauthority\./.test(reviewBlock),
    "the review block must not read the Knowledge authoring band — ratification is not authoring",
  );

  /* Conversely the authoring block never reads Governance. */
  const authStart = code.indexOf("const block:");
  const authoringBlock = code.slice(authStart, code.indexOf("undefined;", authStart));
  assert.ok(
    !/governance/.test(authoringBlock),
    "the authoring block must not read Governance — an author is not a ratifier",
  );

  /*
   * And the SURFACE says so, in the section that offers the act. Asserted on the review section's
   * own text, not the module, so a sentence elsewhere on the page cannot stand in for it.
   */
  const reviewSectionAt = page.indexOf('id="review"');
  assert.ok(reviewSectionAt > 0, "ratification has its own section");
  const reviewSection = page.slice(reviewSectionAt, page.indexOf("<KnowledgeReviewCard", reviewSectionAt));
  assert.match(
    reviewSection,
    /a different authority from authoring/,
    "the ratification section names Governance as a different authority, in words",
  );

  /* The Knowledge write authority module knows nothing about ratifying. */
  const band = codeOf(read("src/features/knowledge/knowledge-write-authority.server.ts"));
  for (const forbidden of ["ratify", "decision_records", "decisionRecords", "resolveGovernanceAuthority"]) {
    assert.ok(!band.includes(forbidden), `the authoring band must not reach ${forbidden}`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. A DESTRUCTIVE ACT IS NOT PASSIVE NAVIGATION
 * ────────────────────────────────────────────────────────────────────────── */
function destructionIsNotNavigation(): void {
  const sources = read("src/components/knowledge-workspace/knowledge-sources-card.tsx");
  const code = codeOf(sources);

  /* Withdrawal is a button that calls a server action — never an anchor. */
  assert.match(code, /retractKnowledgeSourceAction/, "withdrawal calls the retraction action");
  const anchorsNearAction = /<(a|Link)[^>]*>[^<]*[Ww]ithdraw/.test(code);
  assert.ok(!anchorsNearAction, "withdrawal is never rendered as a link");
  assert.ok(
    !/href=[^>]*retract/i.test(code),
    "withdrawal is never reachable by following an href",
  );

  /* It is confirmed before it runs: the component holds a confirmation state of its own. */
  assert.match(code, /confirm/i, "withdrawal is confirmed before it runs");

  /*
   * The version-control path makes the same promise for the other irreversible-looking act. Its
   * wording is the architecture: there is no in-place edit, so no control may say there is.
   */
  const version = withoutStringLiterals(read("src/components/knowledge-workspace/knowledge-version-control.tsx"));
  assert.match(version, /confirming/, "creating a new version is confirmed");
  const versionCopy = read("src/components/knowledge-workspace/knowledge-version-control.tsx");
  for (const forbidden of [">Save changes<", ">Update<", ">Edit<"]) {
    assert.ok(
      !versionCopy.includes(forbidden),
      `no control may be labelled ${forbidden} — Hebun performs no in-place edit`,
    );
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 5. NO MOCK REACHES THE CANONICAL SURFACE
 * ────────────────────────────────────────────────────────────────────────── */
function noMockReachesKnowledge(): void {
  const files = srcFiles();
  const graph = importGraph(files);
  const mocks = new Set(files.filter((f) => path.posix.basename(f) === "mock.ts"));
  assert.ok(mocks.size >= 19, `the known mock modules are still present, found ${mocks.size}`);

  const gate = new Set([
    "src/features/mock-surface-gating/gate.server.ts",
    "src/features/director-dashboard-ui/adapter.server.ts",
  ]);

  for (const file of [...CANONICAL, ...PRIMITIVES]) {
    assert.ok(existsSync(path.join(ROOT, file)), `${file} exists`);
    assert.equal(
      reachable(graph, file, mocks).size,
      0,
      `${file} must reach no mock module — the canonical surface is live data`,
    );
    assert.equal(
      reachable(graph, file, gate).size,
      0,
      `${file} must not depend on the demo gate or the dashboard adapter — it has nothing to gate`,
    );
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6. HEBY STAYS OUTSIDE THE ORDINARY WORKSPACE VOCABULARY
 * ────────────────────────────────────────────────────────────────────────── */
function hebyIsNotAnOrdinaryWorkspace(): void {
  const hebyDir = "src/components/layout/heby";
  const hebyFiles = readdirSync(path.join(ROOT, hebyDir))
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => `${hebyDir}/${f}`);
  assert.ok(hebyFiles.length > 10, "the Heby surface is still where it was");

  const graph = importGraph(srcFiles());
  const ordinary = new Set(PRIMITIVES);
  for (const file of hebyFiles) {
    assert.equal(
      reachable(graph, file, ordinary).size,
      0,
      `${file} must not adopt an ordinary-workspace primitive — Heby keeps its own spatial identity`,
    );
  }

  /* And the primitives do not reach into Heby's stylesheet vocabulary. */
  for (const file of PRIMITIVES) {
    const source = codeOf(read(file));
    assert.ok(!/heby-/.test(source), `${file} must not use a Heby class`);
  }

  /*
   * The Stage 0 type scale is declared at the product root and NOT inside `.heby-surface`. Heby
   * inherits the typeface — it always declared it — and gains no ordinary-workspace type step of
   * its own, so nothing in its released geometry is a function of a token added here.
   */
  const globals = read("src/app/globals.css");
  const hebyBlockAt = globals.indexOf(".heby-surface {");
  assert.ok(hebyBlockAt > 0, "the Heby token scope is still present");
  const hebyBlock = globals.slice(hebyBlockAt, globals.indexOf("\n}", hebyBlockAt));
  for (const forbidden of ["--text-", "--fs-", "--lh-", "--font-"]) {
    assert.ok(
      !hebyBlock.includes(forbidden),
      `the Heby scope must not redefine ${forbidden} — Stage 0 typography is the product's, not Heby's`,
    );
  }
  assert.ok(
    globals.indexOf("--text-display:") < hebyBlockAt,
    "the type scale is declared in the product theme, above and outside the Heby scope",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 7. NO ARBITRARY SUB-`text-xs` TYPE IN THE CANONICAL SURFACE
 * ────────────────────────────────────────────────────────────────────────── */
function typographyDoesNotRegress(): void {
  const floorRem = 0.75; // --fs-label

  /* The floor is what the token says it is, so this test cannot drift away from the scale. */
  const tokens = read("src/styles/tokens.css");
  const declared = /--fs-label:\s*([0-9.]+)rem/.exec(tokens);
  assert.ok(declared, "the type floor is declared as a token");
  assert.equal(Number(declared![1]), floorRem, "the floor token is the one this test enforces");

  const workspaceDir = "src/components/knowledge-workspace";
  const inWorkspace = readdirSync(path.join(ROOT, workspaceDir))
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => `${workspaceDir}/${f}`);

  for (const file of [PAGE, ...inWorkspace, ...PRIMITIVES]) {
    const source = read(file);
    for (const match of source.matchAll(/text-\[([0-9.]+)rem\]/g)) {
      assert.fail(
        `${file} uses the off-scale size ${match[0]} — canonical surfaces use the Stage 0 scale, ` +
          `and nothing below ${floorRem}rem is readable at arm's length`,
      );
    }
    for (const match of source.matchAll(/text-\[([0-9.]+)px\]/g)) {
      assert.fail(`${file} uses the off-scale size ${match[0]}`);
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 8. A BADGE NEVER TRUNCATES ITS OWN LABEL
 * ────────────────────────────────────────────────────────────────────────── */
function badgeLabelsStayReadable(): void {
  /*
   * The `/finance` defect was measured, not guessed: a `flex-shrink: 0` badge 158.3px wide inside a
   * 197px row, leaving a title 11.9px against the 93px it needed. Badge is CORRECT there — a
   * truncated badge is worse than a truncated title — so its geometry is unchanged and the rule is
   * placed on composition instead.
   */
  const badge = read("src/components/ui/badge.tsx");
  assert.match(badge, /shrink-0/, "a badge still refuses to shrink — it never truncates its own word");
  assert.match(badge, /whitespace-nowrap/, "a badge still never wraps its own word");
  assert.ok(!/truncate/.test(badge), "a badge never truncates itself");

  /*
   * The canonical grammar puts a provenance chip on its OWN ROW, never opposite a heading, so it
   * cannot starve one. Asserted on the section header's structure.
   */
  const section = read(PRIMITIVES[2]!);
  const headerAt = section.indexOf("<header");
  const header = section.slice(headerAt, section.indexOf("</header>"));
  const titleRow = header.slice(header.indexOf("<div"), header.indexOf("</div>"));
  assert.ok(
    !titleRow.includes("<ProvenanceChip"),
    "a provenance chip may not share the title's row — that is how a heading gets starved",
  );
  assert.match(header, /<h2[^>]*min-w-0/, "the heading may shrink rather than overflow");
  /* And the chip itself can degrade gracefully, unlike a badge. */
  /* Comment-stripped: this file's own prose, and the chip's, both NAME the thing being forbidden. */
  const chip = codeOf(read(PRIMITIVES[1]!));
  assert.match(chip, /max-w-full/, "a chip is bounded by its container");
  assert.match(chip, /truncate/, "a chip truncates itself before it starves a sibling");
  assert.ok(!/uppercase/.test(chip), "a chip is not uppercase — that is what inflates a badge by a third");

  /*
   * A stacked card header keeps a title above its own description at every width, which is the
   * other measured collision: a 62.5px-wide title beside the sentence describing it.
   */
  const card = read("src/components/ui/card.tsx");
  assert.match(card, /stacked = false/, "the stacked header is opt-in — 346 consumers are unchanged");
  assert.match(card, /stacked \? "min-w-0" : "sm:flex-row/, "stacked headers do not become rows");
  for (const file of CANONICAL.filter((f) => f !== PAGE)) {
    const source = read(file);
    const headers = [...source.matchAll(/<CardHeader([^>]*)>([\s\S]*?)<\/CardHeader>/g)];
    for (const [, attrs, body] of headers) {
      if (body!.includes("<CardTitle") && body!.includes("<CardDescription")) {
        assert.match(
          attrs!,
          /\bstacked\b/,
          `${file} puts a title and a description in one header — it must be stacked`,
        );
      }
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 9. NOTHING IN THE CANONICAL SURFACE CAN FORCE HORIZONTAL OVERFLOW
 * ────────────────────────────────────────────────────────────────────────── */
function noHorizontalOverflow(): void {
  for (const file of [PAGE, ...CANONICAL, ...PRIMITIVES]) {
    const source = read(file);

    /* A fixed width in a fluid column is how a narrow viewport starts scrolling sideways. */
    for (const match of source.matchAll(/\bw-\[[0-9]+px\]/g)) {
      assert.fail(`${file} pins a fixed pixel width (${match[0]}) — that is a mobile overflow`);
    }
    for (const match of source.matchAll(/\bmin-w-\[[0-9]{3,}px\]/g)) {
      assert.fail(`${file} pins a large minimum width (${match[0]}) — that is a mobile overflow`);
    }
    /* Viewport-width units inside a shell whose content column is not the viewport. */
    for (const match of source.matchAll(/\bw-screen\b|\b[wm][a-z-]*-\[[0-9.]+vw\]/g)) {
      assert.fail(`${file} sizes against the viewport (${match[0]}) — the content column is narrower`);
    }
  }

  /*
   * Long unbroken text is the other source. Statements are tenant-supplied and can contain a URL or
   * a token with no spaces in it, so the one place a statement is rendered must break it.
   */
  const records = read("src/components/knowledge-workspace/knowledge-records.tsx");
  const statementAt = records.indexOf("{record.statement}");
  assert.ok(statementAt > 0, "the statement is rendered");
  const statementEl = records.slice(records.lastIndexOf("<p", statementAt), statementAt);
  assert.match(statementEl, /break-words/, "a tenant-supplied statement must break rather than overflow");

  /* Grids in the canonical page start at one column and widen, never the reverse. */
  const page = read(PAGE);
  for (const match of page.matchAll(/className="[^"]*\bgrid\b[^"]*"/g)) {
    const cls = match[0]!;
    if (!/grid-cols/.test(cls)) continue;
    assert.ok(
      !/(?<![a-z:])grid-cols-[2-9]/.test(cls),
      `${cls} sets a multi-column grid with no breakpoint — mobile gets columns it has no room for`,
    );
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 10. THE TENANT BOUNDARY IS UNCHANGED
 * ────────────────────────────────────────────────────────────────────────── */
function tenantBoundaryIntact(): void {
  const code = codeOf(read(PAGE));

  /* The tenant is resolved SERVER-SIDE, once, and passed to every read. */
  assert.match(code, /const tenant = await resolveTenantContext\(\)/, "the tenant is resolved server-side");
  for (const reader of [
    "listKnowledgeSources(tenant)",
    "readCompanyUnderstanding(tenant)",
    "listIngestedSources(tenant)",
    "resolveKnowledgeWriteAuthority(tenant)",
    "resolveGovernanceAuthority(tenant)",
  ]) {
    assert.ok(code.includes(reader), `${reader} is called with the resolved tenant`);
  }

  /* Nothing on this page may accept a tenant, a slug or an id from the caller. */
  for (const forbidden of ["searchParams", "params", "tenantId:", "companyId:", "slug"]) {
    assert.ok(
      !code.includes(forbidden),
      `the canonical page must not read ${forbidden} — tenancy comes from the session and nowhere else`,
    );
  }

  /* The client component that filters may only narrow what it was already served. */
  const records = codeOf(read("src/components/knowledge-workspace/knowledge-records.tsx"));
  for (const forbidden of ["fetch(", "resolveTenantContext", "tenantId", "db/client", "drizzle"]) {
    assert.ok(
      !records.includes(forbidden),
      `the records component must not reach ${forbidden} — it filters a served list, it does not read`,
    );
  }
  assert.match(records, /"use client"/, "the filter runs on the client over data it was given");

  /* And the reads themselves still carry the predicate. */
  const readServer = codeOf(read("src/features/knowledge/knowledge-read.server.ts"));
  assert.match(readServer, /tenantId/, "the canonical read is tenant-scoped");
}

function main(): void {
  emptyIsNotUnavailable();
  derivedIsNotAuthoritative();
  knowledgeCannotRatify();
  destructionIsNotNavigation();
  noMockReachesKnowledge();
  hebyIsNotAnOrdinaryWorkspace();
  typographyDoesNotRegress();
  badgeLabelsStayReadable();
  noHorizontalOverflow();
  tenantBoundaryIntact();
  console.log("Stage 1 canonical Knowledge workspace: all assertions passed.");
}

main();
