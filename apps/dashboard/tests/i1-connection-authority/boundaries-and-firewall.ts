/*
 * I1 CONNECTION AUTHORITY — BOUNDARIES AND IMPORT FIREWALLS.
 *
 * Named `i1-connection-authority` and NOT `i1-flow`: that directory already belongs to the
 * Membership Authority phase, which is a different I1. Two phases sharing a test directory makes
 * the suite unable to say which one a failure belongs to.
 *
 * ── WHY THIS WALKS THE IMPORT GRAPH ──────────────────────────────────────────
 *
 * G6C established, with a released counter-example, that a firewall expressed as "no file whose
 * PATH contains X may mention Y" fails in BOTH directions: a module named `work-artifacts` reached
 * a Governance writer through a database-handle import and every path firewall passed, while a file
 * that merely NAMED a writer in a comment in order to promise it did not import one tripped two.
 *
 * So the properties below are tested structurally, by following real import statements in
 * comment-stripped code, and cannot be satisfied by renaming a file. The lexical checks that remain
 * are the ones where lexical is the actual property — a value in a frozen literal, an event name
 * that must not be emitted — and each is scoped to a function body or a specific declaration rather
 * than to a whole module, because a module-wide `includes()` can pass vacuously by matching an
 * import line (the R4C.1 defect).
 *
 * No database. No network. Pure source inspection plus the released catalog value.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  PROVIDER_CATALOG,
  listConnectableCapabilities,
  listConnectableProviders,
} from "../../src/features/provider-catalog/catalog";
import {
  CONNECTION_TRANSITIONS,
  I1_PRODUCIBLE_STATES,
  TERMINAL_CONNECTION_STATES,
  canTransition,
  isTerminalConnectionState,
  type ConnectionState,
} from "../../src/features/integration-authority/contracts";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * The body of one exported function, so an assertion cannot match an import line instead.
 *
 * The parameter list is walked by PAREN depth first. Taking the first `{` after the declaration
 * would find the `= {}` default value of a deps argument and return an empty body — an assertion
 * against which passes or fails for reasons that have nothing to do with the function.
 */
function functionBody(code: string, name: string): string {
  const start = code.search(new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`));
  assert.ok(start >= 0, `expected to find function ${name}`);

  const paramsOpen = code.indexOf("(", start);
  assert.ok(paramsOpen >= 0, `expected a parameter list for ${name}`);
  let parens = 0;
  let afterParams = -1;
  for (let i = paramsOpen; i < code.length; i += 1) {
    if (code[i] === "(") parens += 1;
    else if (code[i] === ")") {
      parens -= 1;
      if (parens === 0) {
        afterParams = i + 1;
        break;
      }
    }
  }
  assert.ok(afterParams > 0, `unbalanced parentheses reading ${name}`);

  const open = code.indexOf("{", afterParams);
  assert.ok(open >= 0, `expected a body for ${name}`);
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === "{") depth += 1;
    else if (code[i] === "}") {
      depth -= 1;
      if (depth === 0) return code.slice(open, i + 1);
    }
  }
  assert.fail(`unbalanced braces reading ${name}`);
}

/**
 * The helper above is itself checked, because a body-extractor that silently returns `{}` makes
 * every assertion built on it pass vacuously — which is exactly the defect it was written to fix.
 */
function assertBodyExtractorWorks(): void {
  const sample = [
    'export async function sample(',
    "  a: string,",
    "  deps: Deps = {},",
    "): Promise<void> {",
    "  const marker = 1;",
    "}",
  ].join("\n");
  const body = functionBody(sample, "sample");
  assert.ok(body.includes("const marker"), "functionBody must return the BODY, not a default value");
  assert.ok(body.length > 20, "functionBody must not return an empty block");
}

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

/** Every module reachable from `entry`, following real import statements in comment-stripped code. */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const code = codeOf(read(file));
    for (const match of code.matchAll(/from\s+"([^"]+)"/g)) {
      const target = resolveImport(match[1]!, file);
      if (target) stack.push(target);
    }
  }
  return seen;
}

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

/** The connection subsystem's entry points — everything a caller can reach. */
const INTEGRATION_ROOTS = [
  "src/features/integration-authority/integration-repository.server.ts",
  "src/features/integration-authority/integration-read.server.ts",
  "src/features/integration-authority/capability-availability.server.ts",
  "src/features/integration-authority/verify-connection.server.ts",
];

/**
 * Acts that authorize or perform a consequential change. Reaching ANY of them from the connection
 * subsystem is what this file forbids: connection is capability, and capability is not permission.
 */
const AUTHORIZATION_AND_EXECUTION_WRITERS = [
  "consumeActionPermit",
  "executeAuthorizedAction",
  "decideActionRequest",
  "recordActionRequest",
  "revokeActionPermit",
  "recordGovernanceDecision",
  "writeGovernanceDecisionWithin",
  "establishGovernanceAuthority",
  "delegateGovernanceAuthority",
  "ratifyKnowledgeVersion",
  "resolveExternalSendAdapter",
] as const;

function main(): void {
  assertBodyExtractorWorks();

  /* ── 1. THE CONNECTION SUBSYSTEM REACHES NO AUTHORIZATION OR EXECUTION ACT ── */
  {
    for (const root of INTEGRATION_ROOTS) {
      assert.ok(existsSync(path.join(ROOT, root)), `${root} must exist for this test to mean anything`);
      const graph = reachableFrom(root);
      assert.ok(graph.size > 5, `the ${root} graph should be real, got ${graph.size}`);

      const offenders: string[] = [];
      for (const file of graph) {
        const code = codeOf(read(file));
        for (const writer of AUTHORIZATION_AND_EXECUTION_WRITERS) {
          if (new RegExp(`export\\s+(?:async\\s+)?function\\s+${writer}\\b`).test(code)) {
            offenders.push(`${file} defines ${writer}`);
          }
        }
      }
      assert.deepEqual(
        offenders,
        [],
        `no module reachable from ${root} may define an authorization or execution act`,
      );

      /* And the module directories themselves are never in the graph. */
      for (const forbidden of ["src/features/action-authorization/", "src/features/action-execution/"]) {
        const reached = [...graph].filter((f) => f.replace(/\\/g, "/").startsWith(forbidden));
        assert.deepEqual(reached, [], `${root} must not reach ${forbidden}`);
      }
    }
  }

  /* ── 2. NOTHING REACHABLE FROM THE SUBSYSTEM CAN MAKE A NETWORK CALL ──────── */
  {
    const ownModules = collect("src/features/integration-authority").concat(
      collect("src/features/provider-catalog"),
    );
    for (const file of ownModules) {
      const code = codeOf(read(file));
      for (const forbidden of ["fetch(", "XMLHttpRequest", "node:http", "node:https", "undici"]) {
        assert.ok(
          !code.includes(forbidden),
          `${file} must not be able to reach a provider — found "${forbidden}"`,
        );
      }
      /* No reversible encryption anywhere in I1: that primitive does not exist yet. */
      for (const forbidden of ["createCipheriv", "createDecipheriv", "subtle.encrypt", "subtle.decrypt"]) {
        assert.ok(!code.includes(forbidden), `${file} must not encrypt anything in I1`);
      }
    }
  }

  /* ── 3. COMMAND DOES NOT READ CONNECTION STATE ───────────────────────────── */
  {
    const commandRoots = [
      "src/features/command-overview/workspace-model.ts",
      "src/components/command-overview/command-overview.tsx",
      "src/app/(dashboard)/command/page.tsx",
    ].filter((p) => existsSync(path.join(ROOT, p)));
    assert.ok(commandRoots.length > 0, "Command surfaces must exist for this test to mean anything");

    /*
     * MEASURED, NOT ASSUMED: `db/client.server.ts` imports the schema BARREL as `* as schema` to
     * construct the drizzle instance, so EVERY table is reachable from EVERY module that touches
     * the database — Command included, via `action-authorization/read-action-authorizations`.
     *
     * That edge is drizzle's schema registration, not an authority link, and asserting on it would
     * be testing a proxy rather than the property (the G6C lesson, in the other direction). So the
     * barrel is excluded by NAME and the real property is tested instead: no module in Command's
     * graph imports the integrations table DIRECTLY, and Command reaches neither the connection
     * subsystem nor the catalog.
     */
    const SCHEMA_BARREL = "src/db/schema/index.ts";

    for (const root of commandRoots) {
      const graph = reachableFrom(root);

      const subsystem = [...graph].filter((f) => {
        const normalized = f.replace(/\\/g, "/");
        return (
          normalized.startsWith("src/features/integration-authority/") ||
          normalized.startsWith("src/features/provider-catalog/")
        );
      });
      assert.deepEqual(
        subsystem,
        [],
        `${root} must not reach the connection subsystem or the connectable-provider catalog`,
      );

      const directImporters = [...graph]
        .filter((f) => f.replace(/\\/g, "/") !== SCHEMA_BARREL)
        .filter((f) => /from\s+"(@\/db\/schema\/integration|[^"]*\/db\/schema\/integration)"/.test(codeOf(read(f))))
        .map((f) => f.replace(/\\/g, "/"));
      assert.deepEqual(
        directImporters,
        [],
        `no module reachable from ${root} may import the integrations table directly`,
      );
    }

    /* `UNCONNECTED_CAPABILITIES` is still Command's own frozen source, untouched by this phase. */
    const commandModel = read("src/features/command-overview/workspace-model.ts");
    assert.ok(
      commandModel.includes("UNCONNECTED_CAPABILITIES"),
      "Command's frozen capability list must still exist",
    );
    assert.ok(
      !commandModel.includes("getCapabilityAvailability"),
      "Command must NOT consume the availability seam in I1 — that is a later gate",
    );
  }

  /* ── 4. NOTHING OUTSIDE THE SUBSYSTEM READS OR WRITES THE integrations TABLE ─ */
  {
    const importers = collect("src")
      .filter((f) => {
        const code = codeOf(read(f));
        return /from\s+"(@\/db\/schema\/integration|.*\/db\/schema\/integration)"/.test(code);
      })
      .map((f) => f.replace(/\\/g, "/"));

    /*
     * EXACTLY TWO, AND BOTH INSIDE THE AUTHORITY. The schema barrel does not appear because it
     * re-exports RELATIVELY (`export * from "./integration"`).
     *
     * ── WHY THIS WENT FROM ONE TO TWO AT INT-5A ─────────────────────────────
     *
     * It was one module because reads and writes lived together. That co-location became the
     * defect the moment a READ-ONLY consumer needed the listing: importing it would have put seven
     * lifecycle writers — including the one that attaches a credential — into Heby's import graph.
     * G6C settled the remedy for exactly this shape, and INT-5A applied it: the reads moved to
     * `integration-read.server.ts`, the writers stayed, and the repository re-exports the reads so
     * no existing caller changed.
     *
     * The PROPERTY this assertion protects is unchanged and is still exact: the integrations table
     * is nameable only from inside `integration-authority`, and the list is pinned so a third
     * importer cannot appear without somebody stating it here.
     */
    assert.deepEqual(
      importers.sort(),
      [
        "src/features/integration-authority/integration-read.server.ts",
        "src/features/integration-authority/integration-repository.server.ts",
      ],
      "only the integration authority's own read and write modules may import the integrations table",
    );
    for (const importer of importers) {
      assert.ok(
        importer.startsWith("src/features/integration-authority/"),
        `${importer} must live inside the integration authority to name the integrations table`,
      );
    }
  }

  /* ── 5. NEITHER GOVERNANCE NOR KNOWLEDGE BECOMES A CONNECTION OWNER ───────── */
  {
    const foreign = collect("src/features/governance-decision")
      .concat(collect("src/features/knowledge"))
      .concat(collect("src/features/governance-genesis"))
      .filter((f) => {
        const code = codeOf(read(f));
        return (
          code.includes("integration-authority") ||
          code.includes("provider-catalog") ||
          /from\s+"@\/db\/schema\/integration"/.test(code)
        );
      });
    assert.deepEqual(
      foreign,
      [],
      "Governance and Knowledge must not own, read or write tenant connections",
    );
  }

  /* ── 6. THE RELEASED CATALOG CLAIMS NO LIVE CONNECTIVITY ─────────────────── */
  {
    /*
     * AMENDED BY INT-3. The rule was never "no provider may be listed" — it was "a provider may be
     * listed only when the code to connect it exists". INT-1 and INT-2 had no verifier, so ZERO was
     * the honest count; INT-3 built the OAuth flow, the credential storage and the verifier, so
     * `google-workspace` earns its entry.
     *
     * The capability list is STILL empty, and that is the half this section now defends: Google
     * grants identity only, so the catalog may not advertise a single readable capability.
     */
    /*
     * ── AMENDED BY GITHUB-2 ────────────────────────────────────────────────
     *
     * The rule this pin defends is unchanged and is not a count: a provider may be listed only
     * when the code to connect it genuinely exists. INT-3 earned Google's entry by building an
     * OAuth flow, a credential store and a verifier; GITHUB-2 earned GitHub's by building an
     * installation verifier that asks GitHub, authenticated as the App, what an installation id
     * names. GITHUB-1 deliberately shipped WITHOUT the entry for exactly this reason.
     *
     * So the list grows by one, named explicitly, and a third entry still has to justify itself
     * here.
     */
    assert.deepEqual(
      listConnectableProviders().map((d) => d.providerKey),
      ["google-workspace", "github-organization"],
      "every connectable provider, and each only because it is genuinely implemented",
    );
    /*
     * ── AMENDED BY INT-4 ──────────────────────────────────────────────────
     *
     * The catalog mapped no capability because nothing could be read. INT-4 reads Drive metadata,
     * so exactly one is mapped. The pin keeps its purpose — no capability may appear that the
     * repository cannot perform — by naming the one that can.
     */
    /*
     * ── AMENDED BY GITHUB-2 ────────────────────────────────────────────────
     *
     * `github.repository.activity.read` joins the list because its provider is now connectable.
     * It is DECLARED and NOT YET EXECUTABLE — GITHUB-2 connects and reads no repository — and the
     * acceptance-reachability gate reports it `NOT-IMPLEMENTED`, which is the truth. A declared
     * capability makes the availability seam able to say "connected but cannot answer this yet";
     * omitting it would make the seam silent about a capability the catalog's provider offers.
     */
    /*
     * KID-1 adds `google.drive.content.read`. It is DECLARED and its scope is a separate consent —
     * a tenant holding the metadata grant reports it `not-connected` until they grant the content
     * scope too, which is exactly the sentence this census exists to keep sayable.
     */
    assert.deepEqual(
      [...listConnectableCapabilities()].sort(),
      [
        "github.repository.activity.read",
        "google.drive.content.read",
        "google.drive.metadata.read",
      ],
      "every mapped capability, and each named by a provider that is genuinely connectable",
    );

    /*
     * AND ZERO ENTRIES OF ANY KIND. The `architecture-fixture` definition that existed during
     * implementation was removed before release: every test that needs a definition injects its
     * own catalog, so the entry supported nothing, and a production value kept only for tests is a
     * fake fact about the deployment however carefully it is labelled.
     */
    /* `assert.equal` on the length, never `deepEqual` against `[]`: deepEqual carries an
     * `asserts actual is T` signature, so it would narrow the catalog to `never[]` and quietly
     * make every assertion below it vacuous at the TYPE level. */
    assert.equal(
      PROVIDER_CATALOG.length,
      2,
      "two entries, and no fixture — a fixture retained for tests that inject their own would " +
        "still be a false entry in a production authority",
    );

    /*
     * AMENDED BY INT-3. Every entry had to be a `fixture` while nothing could connect. Now an entry
     * must be `connectable` AND have a real implementation behind it — which is a stricter test,
     * not a weaker one, because it names the file that must exist.
     */
    /*
     * ── AMENDED BY GITHUB-2: THE VERIFIER IS NOW PER PROVIDER ──────────────
     *
     * This loop asserted that EVERY entry has Google's verifier behind it, which was exact while
     * Google was the only entry and becomes nonsense the moment a second one exists — GitHub would
     * have "passed" on the strength of a Google file.
     *
     * The map below is the same rule stated properly: each key names the seam that justifies its
     * own `connectable` claim, and an entry whose key is not in the map fails outright. Adding a
     * provider therefore requires naming its verifier here, which is stricter than the old loop
     * rather than looser.
     */
    const VERIFIER_FOR: Readonly<Record<string, string>> = {
      "google-workspace": "src/features/provider-google/verify-google-connection.server.ts",
      "github-organization": "src/features/provider-github/verify-installation.server.ts",
    };
    for (const definition of PROVIDER_CATALOG) {
      assert.equal(
        definition.connectivity,
        "connectable",
        `catalog entry "${definition.providerKey}" must be genuinely connectable`,
      );
      const verifier = VERIFIER_FOR[definition.providerKey];
      assert.ok(
        verifier,
        `catalog entry "${definition.providerKey}" names no verifier — a connectable claim needs one`,
      );
      assert.ok(
        existsSync(path.join(ROOT, verifier)),
        `catalog entry "${definition.providerKey}" must have a real verifier behind it: ${verifier}`,
      );
    }

    /*
     * NO VENDOR WITHOUT AN IMPLEMENTATION. A key here offers a connection code must complete.
     *
     * `github` LEAVES THIS LIST, because the premise it encoded — nothing implements it — stopped
     * being true when the verifier above was built. It is not left unguarded: the map above now
     * demands a named, existing verifier for every key in the catalog, which is what the vendor
     * ban was approximating.
     */
    const keys = PROVIDER_CATALOG.map((d) => d.providerKey.toLowerCase()).join(" ");
    for (const vendor of ["slack", "microsoft", "notion", "resend", "anthropic"]) {
      assert.ok(!keys.includes(vendor), `the catalog must not offer "${vendor}" — nothing implements it`);
    }

    /* Frozen at every level — a shallow freeze leaves the entries mutable. */
    assert.ok(Object.isFrozen(PROVIDER_CATALOG), "the catalog array must be frozen");
    for (const definition of PROVIDER_CATALOG) {
      assert.ok(Object.isFrozen(definition), "each definition must be frozen");
      assert.ok(Object.isFrozen(definition.minimumScopes), "each scope list must be frozen");
      assert.ok(Object.isFrozen(definition.capabilityScopes), "the capability map must be frozen");
    }

    /*
     * A definition is DATA. It holds nothing that could reach a provider.
     *
     * AMENDED BY INT-3: the blanket ban on the substring "http" now flags a SCOPE STRING —
     * `https://www.googleapis.com/auth/userinfo.email` is a permission name, not somewhere to send
     * a request, and Google is the party that chose its spelling. So scope URLs under
     * `/auth/` are permitted and every OTHER url is still forbidden, which is a more precise
     * statement of the same rule rather than a relaxation of it.
     */
    const catalogCode = codeOf(read("src/features/provider-catalog/catalog.ts"));
    const nonScopeUrls = [...catalogCode.matchAll(/https?:\/\/[^"'\s]+/g)]
      .map((m) => m[0])
      .filter((url) => !/^https:\/\/www\.googleapis\.com\/auth\//.test(url));
    assert.deepEqual(nonScopeUrls, [], "the catalog may name scopes, never endpoints");
    for (const forbidden of ["fetch", "endpoint", "baseUrl", "createClient", "Authorization"]) {
      assert.ok(
        !catalogCode.toLowerCase().includes(forbidden.toLowerCase()),
        `the catalog must be pure data — found "${forbidden}"`,
      );
    }
  }

  /* ── 7. THE CATALOG IS NOT A SECOND RUNTIME REGISTRY ─────────────────────── */
  {
    const registry = "src/features/action-execution/adapter-registry.server.ts";
    const registryGraph = reachableFrom(registry);
    assert.ok(
      ![...registryGraph].some((f) => f.replace(/\\/g, "/").startsWith("src/features/provider-catalog/")),
      "the adapter registry must remain the sole authority on what may RUN, and must not read " +
        "the connectable-provider catalog",
    );
    const catalogGraph = reachableFrom("src/features/provider-catalog/catalog.ts");
    assert.ok(
      ![...catalogGraph].some((f) => f.replace(/\\/g, "/").includes("adapter-registry")),
      "and the catalog must not reach the adapter registry either",
    );
  }

  /* ── 8. NO SIMULATION ProviderAdapter CAN SURFACE AS A TENANT CONNECTION ──── */
  {
    for (const root of INTEGRATION_ROOTS) {
      const graph = reachableFrom(root);
      const framework = [...graph].filter((f) => {
        const normalized = f.replace(/\\/g, "/");
        return (
          normalized.startsWith("src/features/provider-framework/") ||
          normalized.startsWith("src/features/providers/")
        );
      });
      assert.deepEqual(
        framework,
        [],
        `${root} must not reach the simulation ProviderAdapter framework — a simulation provider ` +
          "can never become a real tenant connection",
      );
    }
    /* And the framework does not reach the connection subsystem either. */
    const contract = reachableFrom("src/features/provider-framework/provider-contract.ts");
    assert.ok(
      ![...contract].some((f) => f.replace(/\\/g, "/").startsWith("src/features/integration-authority/")),
      "the simulation framework must not reach the connection subsystem",
    );
  }

  /* ── 9. THE REPOSITORY CANNOT PRODUCE A VERIFIED STATE ───────────────────── */
  {
    /*
     * AMENDED BY INT-2, deliberately. INT-1 shipped with two producible states because nothing
     * could store a credential; INT-2 built the credential authority, so `unverified` joins them.
     *
     * The half that has NOT moved is the half this section is about: `connected` remains
     * unreachable, and the two INT-1 writers below still cannot write any of the four states they
     * never could. Widening the set without re-proving that would have been the drift this pin
     * exists to catch.
     */
    /*
     * AMENDED BY INT-3, the third deliberate widening of this pin and the last one this program
     * expects. INT-1 shipped two states, INT-2 added `unverified` when a credential could be
     * stored, and INT-3 adds `connected` and `expired` because a real verifier now exists.
     *
     * `revoked` is STILL absent, and that absence is the point: it means the provider explicitly
     * ended the grant, and Google's `invalid_grant` cannot establish that — the same response
     * covers a user revocation, a refresh token that lapsed through disuse, and a testing-mode
     * grant that aged out. The weaker, defensible claim is `expired`.
     */
    assert.deepEqual(
      [...I1_PRODUCIBLE_STATES].sort(),
      ["connected", "disconnected", "draft", "expired", "unverified"],
      "the runtime produces exactly five states after INT-3",
    );
    assert.ok(
      !I1_PRODUCIBLE_STATES.includes("revoked"),
      "and `revoked` is NOT among them — no provider response in this repository establishes it",
    );

    const repository = codeOf(read("src/features/integration-authority/integration-repository.server.ts"));
    /*
     * Scoped to the two writers' BODIES. A module-wide search would match the import of
     * `I1_PRODUCIBLE_STATES` or a type union and pass without proving anything (the R4C.1 defect).
     */
    for (const writer of ["createConnection", "disconnectConnection"]) {
      const body = functionBody(repository, writer);
      for (const forbidden of ["connected", "unverified", "expired", "revoked"]) {
        assert.ok(
          !new RegExp(`nextState[^\\n]*"${forbidden}"|connectionState:\\s*"${forbidden}"`).test(body),
          `${writer} must not be able to write "${forbidden}"`,
        );
      }
      assert.ok(
        /isI1Producible\(nextState\)/.test(body),
        `${writer} must check the phase boundary before writing`,
      );
    }

    /* The credential and verification columns are never assigned by any writer. */
    for (const column of ["lastVerifiedAt", "externalAccountId", "externalAccountLabel", "scopes:"]) {
      assert.ok(
        !new RegExp(`${column}\\s*[:=]\\s*(?!.*COLUMNS)`).test(functionBody(repository, "createConnection")),
        `createConnection must not write ${column} — verification owns it`,
      );
    }
  }

  /* ── 10. VERIFICATION HAS EXACTLY ONE TRUTHFUL OUTCOME IN I1 ─────────────── */
  {
    const verify = codeOf(read("src/features/integration-authority/verify-connection.server.ts"));
    const body = functionBody(verify, "verifyConnection");
    assert.ok(
      body.includes("NO_CREDENTIAL_AUTHORITY"),
      "verification must refuse with the missing authority",
    );
    assert.ok(
      !/ok:\s*true/.test(body),
      "NO code path in I1 may construct a successful verification",
    );
    /*
     * And nothing in the connection subsystem produces one.
     *
     * Scoped to this subsystem deliberately: `{ ok: true }` is an ordinary result shape used by a
     * dozen unrelated domains, so a repository-wide scan would flag Knowledge and the provider
     * framework and prove nothing about VERIFICATION. The property is that no module which can
     * construct a `VerificationOutcome` constructs the successful arm.
     */
    const producers = collect("src/features/integration-authority").filter((f) =>
      codeOf(read(f))
        .split("\n")
        /* `readonly ok: true;` is the DECLARATION in contracts.ts, asserted below. A construction
         * is what this looks for, so the type's own definition does not count as a producer. */
        .some((line) => /\bok:\s*true\b/.test(line) && !/readonly/.test(line)),
    );
    assert.deepEqual(
      producers,
      [],
      "the `ok: true` arm of VerificationOutcome is declared and unreachable until I2",
    );

    /* The type itself still DECLARES it, so I2 adds a producer rather than widening a type. */
    const contractSource = read("src/features/integration-authority/contracts.ts");
    assert.ok(
      /readonly ok: true;/.test(contractSource),
      "the successful arm must remain declared so its consumer is written before I2",
    );
    /* It writes nothing. */
    for (const forbidden of [".update(", ".insert(", ".delete("]) {
      assert.ok(!verify.includes(forbidden), `verification must not write — found "${forbidden}"`);
    }
  }

  /* ── 11. AUDIT: TWO EVENTS, NO I2 EVENT, NO SECOND SINK ──────────────────── */
  {
    const audit = codeOf(read("src/features/governance-audit/integration-lifecycle-audit.server.ts"));
    assert.ok(audit.includes("auditLog"), "the EXISTING shared sink is reused");
    assert.ok(!audit.includes("eventLog"), "event_log is not activated by this phase");
    assert.ok(!audit.includes("pgTable"), "no second audit table is created");

    const contracts = read("src/features/integration-authority/contracts.ts");
    const declared = [...contracts.matchAll(/"(integration\.[a-z.]+)"/g)].map((m) => m[1]!);
    assert.deepEqual(
      [...new Set(declared)].sort(),
      ["integration.connection.created", "integration.connection.disconnected"],
      "exactly the two events I1 can honestly produce are declared",
    );

    /* The metadata type has nowhere to put a secret or a provider payload. */
    const auditSource = read("src/features/governance-audit/integration-lifecycle-audit.server.ts");
    const metadataBlock = auditSource.slice(
      auditSource.indexOf("interface IntegrationLifecycleAuditMetadata"),
    );
    const metadataFields = metadataBlock.slice(0, metadataBlock.indexOf("}"));
    for (const forbidden of ["secret", "token", "ciphertext", "credentialValue", "payload", "response"]) {
      assert.ok(
        !metadataFields.toLowerCase().includes(forbidden.toLowerCase()),
        `audit metadata must have no field named "${forbidden}"`,
      );
    }
  }

  /* ── 12. THE STATE MACHINE IS MECHANICAL, NOT A COMMENT ──────────────────── */
  {
    assert.deepEqual([...TERMINAL_CONNECTION_STATES].sort(), ["disconnected", "revoked"]);
    for (const terminal of TERMINAL_CONNECTION_STATES) {
      assert.ok(isTerminalConnectionState(terminal));
      assert.deepEqual(
        CONNECTION_TRANSITIONS[terminal],
        [],
        `"${terminal}" is terminal — it must have no outgoing transition at all`,
      );
      const all: ConnectionState[] = [
        "draft",
        "unverified",
        "connected",
        "expired",
        "revoked",
        "disconnected",
      ];
      for (const to of all) {
        assert.equal(canTransition(terminal, to), false, `${terminal} → ${to} must be refused`);
      }
    }
    /* Every state is reachable in the table, so no value is decorative. */
    const reachable = new Set(Object.values(CONNECTION_TRANSITIONS).flat());
    for (const state of ["unverified", "connected", "expired", "revoked", "disconnected"] as const) {
      assert.ok(reachable.has(state), `"${state}" must be reachable in the transition table`);
    }
  }

  /* ── 13. THE CONNECTION AUTHORITY HOLDS NO CREDENTIAL, EVEN NOW ──────────── */
  {
    /*
     * AMENDED BY INT-2. This section used to assert that the credential schema, the encryption
     * boundary and the credential repository DID NOT EXIST. INT-2 built all three, so those three
     * assertions had to be replaced rather than deleted — and what replaces them is the half that
     * was actually load-bearing: the CONNECTION authority still holds no secret of any kind.
     *
     * A credential now exists in Hebun. It exists SOMEWHERE ELSE, and this proves it.
     */
    for (const owner of ["src/db/schema/integration-credential.ts", "src/features/secret-encryption", "src/features/integration-credentials"]) {
      assert.ok(existsSync(path.join(ROOT, owner)), `INT-2's ${owner} must exist to be separate from`);
    }

    /* The `integrations` table itself still has no column that could hold secret material. */
    const connectionSchema = codeOf(read("src/db/schema/integration.ts"));
    for (const forbidden of ["ciphertext", "auth_tag", "authTag", "iv:", "key_id", "keyId", "secret", "token"]) {
      assert.ok(
        !connectionSchema.includes(forbidden),
        `the integrations table must not carry "${forbidden}" — the credential table owns that`,
      );
    }

    /* And no module of the connection authority reads the credential COLUMNS. */
    for (const file of collect("src/features/integration-authority")) {
      const code = codeOf(read(file));
      for (const forbidden of ["integrationCredentials", "ciphertext", "authTag", "sealSecret", "openSecret"]) {
        assert.ok(
          !code.includes(forbidden),
          `${file} must not touch credential material — found "${forbidden}"`,
        );
      }
    }

    /*
     * ONE narrow seam is allowed in the other direction: the credential authority asks THIS module
     * whether a live credential exists, and gets a BOOLEAN. Pinned so a later phase cannot widen
     * it into a credential read without deleting this assertion.
     */
    const verify = codeOf(read("src/features/integration-authority/verify-connection.server.ts"));
    assert.ok(
      /hasLiveCredential/.test(verify),
      "verification distinguishes its two refusals by asking whether a credential exists",
    );
    assert.ok(
      !/withDecryptedSecret|listCredentialMetadata|storeCredential/.test(verify),
      "and it may ask nothing else of the credential authority",
    );
  }

  console.log("i1-connection-authority/boundaries-and-firewall: all assertions passed");
}

main();
