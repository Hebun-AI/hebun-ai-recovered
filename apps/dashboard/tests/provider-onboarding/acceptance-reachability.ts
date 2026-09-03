/*
 * Provider onboarding — THE ACCEPTANCE REACHABILITY GATE.
 *
 * ── THE ONE SENTENCE THIS SUITE DEFENDS ─────────────────────────────────────
 *
 *   AN IMPLEMENTED CAPABILITY WITH NO PRODUCTION CALLER IS NOT ACCEPTANCE-READY.
 *
 * INT-4 built `readDriveMetadata`, gave it a capability gate, a transport, a normalized shape,
 * four test files and a released closure — and nothing under `src/app` ever called it. That was
 * discovered by hand, at the very end, while attempting real-provider acceptance, after the
 * production schema had been migrated and a human had completed a Google consent screen. Every
 * step in that sequence was correct except the order in which the gap became visible.
 *
 * This file makes the gap visible on every test run, WITHOUT naming Google: the question is asked
 * of the provider catalog, which is the authority on what capabilities exist, and of the real
 * import graph, which is the authority on what production can reach.
 *
 * ── WHY THE IMPORT GRAPH, AND NOT A DECLARED FIELD ──────────────────────────
 *
 * A `productionCaller` entry on the catalog would be a claim an author writes, and a claim that
 * outlives its truth is the entire defect class here. The import graph cannot be written; it is
 * walked. A capability becomes reachable the moment a real surface imports its seam and stops
 * being reachable when the last one stops, with no entry to update in either direction.
 *
 * The walker is the released G6C pattern (`tests/g6c-flow/authority-reachability.ts`), reused
 * deliberately: this suite adds no new mechanism, only a new question asked of the same graph.
 *
 * ── WHAT THIS SUITE MAY NEVER DO ────────────────────────────────────────────
 *
 * It calls no provider, starts no OAuth, reads no credential and touches no database. It is a
 * statement about this repository, made entirely from this repository.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { PROVIDER_CATALOG } from "../../src/features/provider-catalog/catalog";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function resolveImport(spec: string, from: string): string | null {
  const base = spec.startsWith("@/")
    ? path.join("src", spec.slice(2))
    : spec.startsWith(".")
      ? path.join(path.dirname(from), spec)
      : null;
  if (!base) return null; // bare package specifier — not our source
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + ext;
    if (existsSync(path.join(ROOT, candidate)) && statSync(path.join(ROOT, candidate)).isFile()) {
      return candidate;
    }
  }
  return null;
}

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

/**
 * ── TYPE-ONLY EDGES ARE NOT EXECUTION EDGES ─────────────────────────────────
 *
 * `import type { X } from "./seam"` disappears at compile time. It cannot call anything, so it
 * cannot make a capability executable — yet a naive `from "..."` match counts it, and that is not
 * hypothetical: this gate reported Drive REACHABLE with its real caller REMOVED, because the
 * discovery CARD still imported the result TYPE from the seam. A card rendering a shape is not a
 * surface spending a credential. Type-only statements are stripped before the graph is walked.
 */
function executableImportsOf(file: string): string[] {
  const code = codeOf(read(file))
    .replace(/import\s+type\s+[^;]*?;/g, "")
    .replace(/export\s+type\s+[^;]*?from\s+"[^"]+"\s*;/g, "");
  return [...code.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
}

/** Every module reachable from `entries` through imports that survive compilation. */
function reachableFrom(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...entries];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of executableImportsOf(file)) {
      const target = resolveImport(spec, file);
      if (target) stack.push(target);
    }
  }
  return seen;
}

/**
 * PRODUCTION ROOTS: everything under `src/app`.
 *
 * Next.js routes every page, layout, route handler and server action from this tree, so it is
 * exactly the set of modules a real request can enter through. A capability seam reachable from
 * none of them cannot be executed by any product surface, whatever its tests do.
 */
const PRODUCTION_ROOTS = collect("src/app");
const FEATURE_MODULES = collect("src/features");

/**
 * ── WHAT COUNTS AS AN EXECUTION SEAM, AND WHY MENTIONING A CAPABILITY IS NOT ──
 *
 * The first version of this file matched modules whose TEXT contained the capability key. It
 * reported Google Drive as REACHABLE, which is false, and it was wrong twice over:
 *
 *   1. It found `platform-integrations/model.ts` — a pure read-model that DISPLAYS the capability
 *      on /integrations. Displaying a capability is not spending one, but that module IS
 *      app-reachable, so an unreachable capability reported green.
 *   2. It never found the real seam at all. `read-drive-metadata.server.ts` refers to the
 *      capability through the CONSTANT `GOOGLE_DRIVE_METADATA_CAPABILITY`, never the literal, so a
 *      text match could not see it.
 *
 * A seam is therefore defined by what it can DO: it refers to the capability — by literal or by a
 * constant declared equal to it — AND can transitively reach a module that performs outbound HTTP
 * to a provider. A read-model reaches no transport, so the mechanism excludes it rather than a
 * name list doing so.
 */
const CAPABILITY_CONSTANT = /export const (\w+)\s*=\s*"([\w.]+)"\s*as const/g;
const OUTBOUND_HTTP = /\bfetch\s*\(|fetchImpl\s*\?\?\s*fetch/;

/** Constant name → declared string value, so a seam may refer to a capability either way. */
function capabilityAliases(capability: string): string[] {
  const names = [capability];
  for (const file of FEATURE_MODULES) {
    for (const m of codeOf(read(file)).matchAll(CAPABILITY_CONSTANT)) {
      if (m[2] === capability) names.push(m[1]!);
    }
  }
  return names;
}

const TRANSPORTS = new Set(
  FEATURE_MODULES.filter((f) => OUTBOUND_HTTP.test(codeOf(read(f)))),
);

/** True when this module can reach a provider transport at all. */
function reachesTransport(file: string): boolean {
  for (const m of reachableFrom([file])) if (TRANSPORTS.has(m)) return true;
  return false;
}

/**
 * Modules that can actually spend the capability: they name it, and they can reach a provider.
 *
 * A transport is excluded from being its own seam — it is the thing spent, not the thing that
 * decides to spend it, and it carries no capability gate.
 */
function executionSeamsFor(capability: string): string[] {
  const aliases = capabilityAliases(capability);
  return FEATURE_MODULES.filter((file) => {
    if (TRANSPORTS.has(file)) return false;
    const code = codeOf(read(file));
    if (!aliases.some((a) => code.includes(a))) return false;
    return reachesTransport(file);
  });
}

const appReachable = reachableFrom(PRODUCTION_ROOTS);

type Verdict = "REACHABLE" | "ACCEPTANCE-UNREACHABLE" | "NOT-IMPLEMENTED";

function verdictFor(capability: string): { verdict: Verdict; seams: string[] } {
  const seams = executionSeamsFor(capability);
  if (seams.length === 0) return { verdict: "NOT-IMPLEMENTED", seams };
  const reachable = seams.filter((s) => appReachable.has(s));
  return { verdict: reachable.length > 0 ? "REACHABLE" : "ACCEPTANCE-UNREACHABLE", seams };
}

/* ── 1. EVERY DECLARED CAPABILITY GETS AN HONEST VERDICT ────────────────────── */
function everyCapabilityHasAnHonestReachabilityVerdict(): void {
  console.log("  acceptance reachability:");
  for (const provider of PROVIDER_CATALOG) {
    for (const capability of Object.keys(provider.capabilityScopes)) {
      const { verdict, seams } = verdictFor(capability);
      console.log(`    ${provider.providerKey} / ${capability}: ${verdict} (${seams.length} seam)`);
      /*
       * ── A REPORT, NOT A FAILURE ───────────────────────────────────────────
       *
       * `ACCEPTANCE-UNREACHABLE` is a TRUE statement about a real repository state. Failing on it
       * would pressure somebody into inventing a caller purely to clear the gate, which is the one
       * remedy this lesson forbids. The gate's job is to make the state impossible to MISS, not
       * impossible to hold. The opposite error — reporting reachable when nothing reaches it — is
       * what is asserted against.
       */
      if (verdict === "REACHABLE") {
        assert.ok(
          seams.some((s) => appReachable.has(s)),
          `${capability} may only report REACHABLE with a seam a production root actually imports`,
        );
      }
      /*
       * ── PER-SEAM, NOT PER-CAPABILITY (INT-5B1) ────────────────────────────
       *
       * One capability key can be spent by several seams, and a verdict on the KEY says nothing
       * about which of them a person can actually reach. `github.repository.activity.read` is
       * spent by BOTH the repository listing and the pull-request reader, so the single word
       * REACHABLE above would let somebody conclude that Hebun can show them pull requests. It
       * cannot: INT-5B1 shipped the listing only.
       *
       * Printing each seam's own verdict is what keeps that from being a thing a reader has to
       * already know.
       */
      for (const seam of seams.slice().sort()) {
        console.log(`        ${appReachable.has(seam) ? "reachable    " : "unreachable  "} ${seam}`);
      }
    }
  }
}

/* ── 2. THE WALKER MUST ACTUALLY WALK ───────────────────────────────────────── */
function theGraphIsRealAndNotEmpty(): void {
  /*
   * A resolver that silently returned null for everything would make every capability
   * ACCEPTANCE-UNREACHABLE and this suite would still pass — a comfortable falsehood in the other
   * direction. These anchors prove the graph is genuinely traversed.
   */
  assert.ok(TRANSPORTS.size > 0, "at least one provider transport exists to reach");
  assert.ok(PRODUCTION_ROOTS.length > 50, "src/app has many entry points");
  assert.ok(appReachable.size > PRODUCTION_ROOTS.length, "the graph reaches beyond its own roots");
  assert.ok(
    [...appReachable].some((f) => f.startsWith("src/features/")),
    "production roots reach feature modules — the resolver resolves @/ specifiers",
  );
  assert.ok(
    appReachable.has("src/features/integration-authority/capability-availability.server.ts"),
    "the availability seam is reachable — /integrations imports it",
  );

  /*
   * A TYPE-ONLY IMPORT MAKES NOTHING EXECUTABLE. Pinned because this gate once said REACHABLE with
   * the real caller removed, on the strength of a card importing a result type.
   */
  const typeOnly = 'import type { Foo } from "@/features/x";';
  assert.equal(
    codeOf(typeOnly).replace(/import\s+type\s+[^;]*?;/g, "").trim(),
    "",
    "a type-only import statement contributes no edge",
  );
}

/* ── 3. NAMING A CAPABILITY IS NOT EXECUTING ONE ────────────────────────────── */
function namingACapabilityIsNotExecutingIt(): void {
  /*
   * THE REGRESSION THIS FILE WAS BORN FROM. The display model renders the Drive capability on
   * /integrations and is reachable from a real page. Counting it made an unreachable capability
   * report REACHABLE. It reaches no transport, so the mechanism excludes it — no name list.
   */
  const display = "src/features/platform-integrations/model.ts";
  assert.ok(FEATURE_MODULES.includes(display), "the display model still exists");
  assert.ok(!reachesTransport(display), "a read-model reaches no provider transport");
  assert.ok(appReachable.has(display), "and it IS app-reachable — which is why it fooled v1");

  for (const provider of PROVIDER_CATALOG) {
    for (const capability of Object.keys(provider.capabilityScopes)) {
      const seams = executionSeamsFor(capability);
      assert.ok(
        !seams.includes(display),
        `${capability}: a module that only displays a capability may never count as a seam`,
      );
      for (const seam of seams) {
        assert.ok(
          reachesTransport(seam),
          `${seam} was counted as a seam but cannot reach any provider transport`,
        );
      }
    }
  }
}

/* ── 4. A READ CAPABILITY MAY NEVER CARRY WRITE SCOPES BY DEFAULT ───────────── */
function readCapabilityNeverImpliesWrite(): void {
  for (const provider of PROVIDER_CATALOG) {
    for (const [capability, scopes] of Object.entries(provider.capabilityScopes)) {
      /*
       * CGO-5 — AN API KEY CARRIES NO SCOPES, AND THE DEFINITION MUST NOT PRETEND OTHERWISE.
       *
       * "Requiring nothing grants everything" stays true, and is bounded rather than exempted: an
       * `api_key` provider may offer exactly ONE capability, may name no minimum scope, and may
       * declare no write scope — so "everything" is that one public read, and a second capability
       * or a write half would have to argue its way past this assertion. Every OAuth or App
       * provider keeps the original rule unchanged.
       */
      if (provider.authMethod === "api_key") {
        assert.equal(scopes.read.length, 0, `${capability}: an API key grants no scope, so the definition names none`);
        assert.equal(provider.minimumScopes.length, 0, `${provider.providerKey}: no minimum scope exists for an API key`);
        assert.equal(Object.keys(provider.capabilityScopes).length, 1, `${provider.providerKey}: exactly one capability behind an API key`);
        assert.equal(scopes.write.length, 0, `${capability}: no write half behind an API key`);
      } else {
        assert.ok(
          scopes.read.length > 0,
          `${capability} declares no read scope — a capability requiring nothing grants everything`,
        );
      }
      /*
       * A write list is permitted but must be DECLARED. `writeCapable` is computed from it, so an
       * empty list makes write structurally unreachable rather than merely unused.
       */
      assert.ok(Array.isArray(scopes.write), `${capability} must declare a write scope list`);
      for (const scope of scopes.write) {
        assert.ok(
          !scopes.read.includes(scope),
          `${capability}: ${scope} is listed as both read and write — one of them is untrue`,
        );
      }
    }
  }
}

/* ── 5. THE CATALOG IS INTERNALLY CONSISTENT ────────────────────────────────── */
function theCatalogIsInternallyConsistent(): void {
  const keys = PROVIDER_CATALOG.map((p) => p.providerKey);
  assert.equal(new Set(keys).size, keys.length, "provider keys are unique");
  for (const provider of PROVIDER_CATALOG) {
    assert.ok(provider.providerKey.length > 0, "a provider key is never empty");
    if (provider.authMethod === "api_key") {
      /* CGO-5: an API key has no scopes; `connected` is separated from `not` by a real verification. */
      assert.equal(provider.minimumScopes.length, 0, `${provider.providerKey}: an API key names no minimum scope`);
    } else {
      assert.ok(
        provider.minimumScopes.length > 0,
        `${provider.providerKey} declares no minimum scope — nothing separates connected from not`,
      );
    }
  }
}

/* ── 6. EXACTLY WHICH GITHUB SEAMS A PERSON CAN REACH (INT-5B1) ─────────────── */
function theReachableGitHubSeamsAreTheOnesThatShipped(): void {
  /*
   * INT-5B1 made ONE seam reachable and deliberately left the other where it was. Both spend the
   * same capability key, so only a per-seam pin can state the difference — and stating it is the
   * point: an unreachable seam is a true fact about this repository, and the moment somebody wires
   * the pull-request reader to a surface they must come here and say so.
   */
  const LISTING = "src/features/provider-github/discover-installation-repositories.server.ts";
  const PULL_REQUESTS = "src/features/provider-github/read-repository-pull-requests.server.ts";

  assert.ok(FEATURE_MODULES.includes(LISTING), "the repository listing seam exists");
  assert.ok(FEATURE_MODULES.includes(PULL_REQUESTS), "the pull-request seam exists");

  assert.ok(
    appReachable.has(LISTING),
    "the repository listing must be reachable from a production root — INT-5B1 wired the " +
      "/repositories provider-read command to it, and the /integrations/github page to it before that",
  );

  /*
   * AND IT IS REACHED THROUGH THE PROVIDER-READ BOUNDARY, not only through a page. This is what
   * makes the command a real production caller rather than a module that merely exists.
   */
  const providerReadReach = reachableFrom([
    "src/features/heby-commands/provider-read-commands.server.ts",
  ]);
  assert.ok(providerReadReach.has(LISTING), "the provider-read executor reaches the listing seam");
  /*
   * ── INT-5B2 IS THE PHASE THIS PIN NAMED ─────────────────────────────────────
   *
   * The two assertions below used to say the pull-request reader had NO production caller, and the
   * second one said in as many words that "this pin must be edited deliberately by whichever phase
   * gives it one". `/pull-requests` is that phase: the seam GITHUB-4 built against the real GitHub
   * API now has exactly one consumer, the provider-read executor, and reaches production through
   * the same boundary `/repositories` does.
   *
   * The pin is INVERTED, not deleted, and it stays exact in both directions: a released provider
   * seam that quietly loses its caller still fails here, and so does one that acquires a second
   * boundary without a deliberate edit.
   */
  assert.ok(
    providerReadReach.has(PULL_REQUESTS),
    "the provider-read executor reaches the pull-request reader — INT-5B2 wired /pull-requests to it",
  );

  assert.ok(
    appReachable.has(PULL_REQUESTS),
    "the pull-request reader now has a production caller, and it is the provider-read command",
  );
}

function main(): void {
  everyCapabilityHasAnHonestReachabilityVerdict();
  theReachableGitHubSeamsAreTheOnesThatShipped();
  theGraphIsRealAndNotEmpty();
  namingACapabilityIsNotExecutingIt();
  readCapabilityNeverImpliesWrite();
  theCatalogIsInternallyConsistent();
  console.log("provider-onboarding/acceptance-reachability: all assertions passed");
}

main();
