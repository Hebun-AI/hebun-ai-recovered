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
     * EXACTLY ONE. The schema barrel does not appear because it re-exports RELATIVELY
     * (`export * from "./integration"`), so the only module in the whole repository that names the
     * integrations table by path is its single repository.
     */
    assert.deepEqual(
      importers.sort(),
      ["src/features/integration-authority/integration-repository.server.ts"],
      "exactly ONE module may import the integrations table",
    );
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
    assert.deepEqual(
      listConnectableProviders(),
      [],
      "the RELEASED catalog must contain ZERO connectable providers — nothing can be connected " +
        "until a credential store and a verifier exist, which is I2",
    );
    assert.deepEqual(listConnectableCapabilities(), []);

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
      0,
      "the RELEASED catalog must be EMPTY — a fixture retained for tests that inject their own " +
        "is a false entry in a production authority",
    );

    /* Vacuous today by construction; it is the guard that survives the first real entry. */
    for (const definition of PROVIDER_CATALOG) {
      assert.equal(
        definition.connectivity,
        "fixture",
        `catalog entry "${definition.providerKey}" must be a fixture in I1`,
      );
      /* A fixture that reads like a product eventually ships as one. */
      assert.match(
        definition.label,
        /not a real provider|not connectable|fixture/i,
        `catalog entry "${definition.providerKey}" must say what it is in its label`,
      );
    }

    /* NO REAL VENDOR IS LISTED. A key here would offer a connection no code can complete. */
    const keys = PROVIDER_CATALOG.map((d) => d.providerKey.toLowerCase()).join(" ");
    for (const vendor of ["google", "slack", "github", "microsoft", "notion", "resend", "anthropic"]) {
      assert.ok(!keys.includes(vendor), `the catalog must not offer "${vendor}" before I2`);
    }

    /* Frozen at every level — a shallow freeze leaves the entries mutable. */
    assert.ok(Object.isFrozen(PROVIDER_CATALOG), "the catalog array must be frozen");
    for (const definition of PROVIDER_CATALOG) {
      assert.ok(Object.isFrozen(definition), "each definition must be frozen");
      assert.ok(Object.isFrozen(definition.minimumScopes), "each scope list must be frozen");
      assert.ok(Object.isFrozen(definition.capabilityScopes), "the capability map must be frozen");
    }

    /* A definition is DATA. It holds nothing that could reach a provider. */
    const catalogCode = codeOf(read("src/features/provider-catalog/catalog.ts"));
    for (const forbidden of ["http", "fetch", "=>", "endpoint", "baseUrl"]) {
      assert.ok(
        !catalogCode.toLowerCase().includes(forbidden.toLowerCase()) ||
          forbidden === "=>" /* the two helper predicates below the literal */,
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
    assert.deepEqual(
      [...I1_PRODUCIBLE_STATES].sort(),
      ["disconnected", "draft"],
      "I1 produces exactly two states",
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

  /* ── 13. NO CREDENTIAL SCHEMA EXISTS IN I1 ───────────────────────────────── */
  {
    const schemaFiles = collect("src/db/schema");
    for (const file of schemaFiles) {
      const code = codeOf(read(file));
      assert.ok(
        !/integration_credential/.test(code),
        `${file} must not define a credential table — that is I2`,
      );
    }
    assert.ok(
      !existsSync(path.join(ROOT, "src/db/schema/integration-credential.ts")),
      "the credential schema belongs to I2",
    );
    assert.ok(
      !existsSync(path.join(ROOT, "src/features/secret-encryption")),
      "the encryption boundary belongs to I2",
    );
    assert.ok(
      !existsSync(path.join(ROOT, "src/features/integration-credentials")),
      "the credential repository belongs to I2",
    );
  }

  console.log("i1-connection-authority/boundaries-and-firewall: all assertions passed");
}

main();
