/*
 * INT-2 — STRUCTURAL BOUNDARIES AROUND THE CREDENTIAL AUTHORITY.
 *
 * These prove claims about WHAT DOES NOT EXIST and what cannot be reached: no second encryption
 * primitive, no secret in a client bundle, no plaintext-returning accessor, no path from a
 * credential to Governance or to execution, no provider transport, no fingerprint, and no
 * production caller of the test-only failure seams.
 *
 * No database. No network. Source inspection plus the real import graph.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  CREDENTIAL_AUDIT_DESTROYED,
  CREDENTIAL_AUDIT_REPLACED,
  CREDENTIAL_AUDIT_REVOKED,
  CREDENTIAL_AUDIT_STORED,
  INTEGRATION_CREDENTIAL_ENTITY_TYPE,
  credentialAad,
} from "../../src/features/integration-credentials/contracts";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CREDENTIALS = "src/features/integration-credentials";
const ENCRYPTION = "src/features/secret-encryption";
const REPOSITORY = `${CREDENTIALS}/credential-repository.server.ts`;
const PRIMITIVE = `${ENCRYPTION}/authenticated-encryption.server.ts`;
const REGISTRY = `${ENCRYPTION}/key-registry.server.ts`;
const ROTATION = `${CREDENTIALS}/rotate-encryption-key.server.ts`;

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

function resolveImport(spec: string, from: string): string | null {
  const base = spec.startsWith("@/")
    ? path.join("src", spec.slice(2))
    : spec.startsWith(".")
      ? path.join(path.dirname(from), spec)
      : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + ext;
    if (existsSync(path.join(ROOT, candidate)) && statSync(path.join(ROOT, candidate)).isFile()) {
      return candidate;
    }
  }
  return null;
}

/** Every module reachable from `entry`, walking REAL import statements in comment-stripped code. */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of codeOf(read(file)).matchAll(/from\s+"([^"]+)"/g)) {
      const target = resolveImport(match[1]!, file);
      if (target) stack.push(target);
    }
  }
  return seen;
}

function main(): void {
  /* ── 1. THE CREDENTIAL AUTHORITY CANNOT AUTHORIZE OR EXECUTE ─────────────── */
  {
    const graph = reachableFrom(REPOSITORY);
    for (const forbidden of [
      "src/features/action-authorization/",
      "src/features/action-execution/",
      "src/features/action-execution-live/",
      "src/features/governance-decision/",
      "src/features/governance-genesis/",
      "src/features/knowledge/",
      "src/features/command-overview/",
      "src/features/provider-framework/",
      "src/features/providers/",
    ]) {
      const reached = [...graph].filter((f) => f.replace(/\\/g, "/").startsWith(forbidden));
      assert.deepEqual(reached, [], `the credential authority must not reach ${forbidden}`);
    }

    /* Nor can it DEFINE an authorization act, whatever it imports. */
    for (const file of collect(CREDENTIALS).concat(collect(ENCRYPTION))) {
      const code = codeOf(read(file));
      for (const forbidden of ["mintPermit", "actionPermits", "consumeActionPermit", "resolveGovernanceAuthority", "executeAuthorizedAction"]) {
        assert.ok(!code.includes(forbidden), `${file} must not name "${forbidden}"`);
      }
    }
  }

  /* ── 2. NOTHING HERE CAN REACH A PROVIDER ────────────────────────────────── */
  {
    for (const file of collect(CREDENTIALS).concat(collect(ENCRYPTION))) {
      const code = codeOf(read(file));
      for (const forbidden of ["fetch(", "XMLHttpRequest", "node:http", "node:https", "undici", "Anthropic", "resend"]) {
        assert.ok(
          !code.includes(forbidden),
          `${file} must not be able to reach a provider — found "${forbidden}"`,
        );
      }
    }
  }

  /* ── 3. ONE ENCRYPTION PRIMITIVE, AND ONE ONLY ───────────────────────────── */
  {
    const encryptors = collect("src")
      .filter((f) => {
        const code = codeOf(read(f));
        return /createCipheriv|createDecipheriv|subtle\.encrypt|subtle\.decrypt/.test(code);
      })
      .map((f) => f.replace(/\\/g, "/"));
    assert.deepEqual(
      encryptors,
      [PRIMITIVE],
      "exactly ONE module in this repository may perform reversible encryption",
    );

    /* And that module has no database, no environment and no logging. */
    const primitive = codeOf(read(PRIMITIVE));
    for (const forbidden of ["process.env", "drizzle-orm", "@/db/", "console.", "TenantContext"]) {
      assert.ok(
        !primitive.includes(forbidden),
        `the encryption primitive must not reach "${forbidden}" — it does arithmetic and nothing else`,
      );
    }
  }

  /* ── 4. NO PLAINTEXT-RETURNING ACCESSOR EXISTS ───────────────────────────── */
  {
    const repository = codeOf(read(REPOSITORY));
    for (const forbidden of ["export async function getCredential", "export function getCredential", "decryptCredential", "readSecret", "getSecret", "credential.secret"]) {
      assert.ok(!repository.includes(forbidden), `no "${forbidden}" accessor may exist`);
    }

    /* The scoped callback is the ONLY exported function that ever holds a plaintext. */
    const decryptors = collect("src")
      .filter((f) => codeOf(read(f)).includes("openSecret("))
      .map((f) => f.replace(/\\/g, "/"))
      .sort();
    assert.deepEqual(
      decryptors,
      [PRIMITIVE, ROTATION, REPOSITORY].sort(),
      "only the primitive, the scoped-access seam and the rotation ceremony may decrypt",
    );

    /*
     * `withDecryptedSecret` returns the CALLBACK'S value. If the plaintext could be returned, the
     * result type would have somewhere to put it — this asserts on the type, not on the prose.
     */
    const contracts = codeOf(read(`${CREDENTIALS}/contracts.ts`));
    assert.ok(/ScopedSecretResult<T>/.test(contracts));
    assert.ok(
      !/plaintext/.test(contracts.split("ScopedSecretResult")[1]!.slice(0, 400)),
      "the scoped result type must have no plaintext arm",
    );
  }

  /* ── 5. THE PUBLIC METADATA TYPE HAS NO SECRET FIELD ─────────────────────── */
  {
    const contracts = read(`${CREDENTIALS}/contracts.ts`);
    const start = contracts.indexOf("export interface CredentialMetadata");
    const body = contracts.slice(start, contracts.indexOf("}", start));
    /*
     * Matched as a FIELD DECLARATION, not as a substring: `readonly live: boolean` contains the
     * letters `iv`, and a substring test would fail on the field that says a credential is usable.
     */
    for (const forbidden of ["ciphertext", "iv", "authTag", "plaintext", "secret", "material", "fingerprint"]) {
      assert.ok(
        !new RegExp(`\\b${forbidden}\\s*:`).test(body),
        `CredentialMetadata must not declare "${forbidden}" — absent, never redacted`,
      );
    }
    assert.ok(body.includes("keyId") && body.includes("algorithm"), "operational facts ARE present");
  }

  /* ── 6. NO FINGERPRINT ANYWHERE ──────────────────────────────────────────── */
  {
    /*
     * A plaintext-derived fingerprint beside the ciphertext is an ORACLE: it confirms a guessed
     * secret for anyone holding a database dump, without the key. It was designed, audited and
     * REMOVED, and its absence is asserted rather than remembered.
     */
    for (const file of collect(CREDENTIALS).concat(collect(ENCRYPTION), ["src/db/schema/integration-credential.ts"])) {
      const code = codeOf(read(file));
      assert.ok(!/fingerprint/i.test(code), `${file} must not fingerprint a plaintext`);
    }
  }

  /* ── 7. NO SECRET MATERIAL CAN REACH A CLIENT BUNDLE ─────────────────────── */
  {
    /* Every module of both features is server-only by name AND by assertion. */
    for (const file of collect(CREDENTIALS).concat(collect(ENCRYPTION))) {
      if (file.endsWith("contracts.ts")) continue; // pure types, no runtime
      assert.ok(file.endsWith(".server.ts"), `${file} must be named .server.ts`);
      assert.ok(
        codeOf(read(file)).includes('typeof window !== "undefined"'),
        `${file} must refuse to run in a browser`,
      );
    }

    /*
     * And no component or page imports either feature.
     *
     * AMENDED BY INT-3, narrowly. The OAuth CALLBACK is a server-only route handler that must store
     * the tokens Google just issued, so it legitimately reaches the credential authority — and it
     * is the ONLY file under `src/app` allowed to. Everything else, including every component and
     * every page, still cannot: a surface that could reach the vault would eventually render it.
     *
     * `secret-encryption` remains completely unreachable from `src/app`. The callback stores
     * through the credential authority and never touches the cipher.
     */
    const CALLBACK_ROUTE = "src/app/api/integrations/google/callback/route.ts";
    const clientish = collect("src/components").concat(collect("src/app"));
    for (const file of clientish) {
      const normalized = file.replace(/\\/g, "/");
      const code = codeOf(read(file));
      assert.ok(
        !code.includes("secret-encryption"),
        `${file} must not import secret-encryption — the cipher is never a surface's business`,
      );
      if (normalized === CALLBACK_ROUTE) continue;
      assert.ok(
        !code.includes("integration-credentials"),
        `${file} must not import integration-credentials`,
      );
    }
    /* The exemption is real, not decorative: the callback does store credentials. */
    assert.ok(
      codeOf(read(CALLBACK_ROUTE)).includes("integration-credentials"),
      "the exemption above must name a file that actually uses it",
    );
  }

  /* ── 8. THE TEST-ONLY FAILURE SEAMS HAVE NO PRODUCTION CALLER ────────────── */
  {
    /*
     * Atomic replacement is proved by INJECTING a failure, which means the code carries a hook a
     * caller could theoretically use. This is what keeps it theoretical.
     */
    const callers = collect("src")
      .filter((f) => {
        const code = codeOf(read(f));
        return /failAfterRevokeForTest\s*:|recordEventForTest\s*:|failBeforeWriteForTest\s*:/.test(code);
      })
      .map((f) => f.replace(/\\/g, "/"))
      .sort();
    assert.deepEqual(
      callers,
      [],
      "no module under src/ may PASS a test-only failure hook — declaring one is not calling it",
    );
  }

  /* ── 9. THE AUDIT VOCABULARY IS FOUR ACTIONS, AND ITS OWN ENTITY TYPE ────── */
  {
    assert.equal(INTEGRATION_CREDENTIAL_ENTITY_TYPE, "integration_credential");
    assert.notEqual(INTEGRATION_CREDENTIAL_ENTITY_TYPE, "integration");
    const actions = [CREDENTIAL_AUDIT_STORED, CREDENTIAL_AUDIT_REPLACED, CREDENTIAL_AUDIT_REVOKED, CREDENTIAL_AUDIT_DESTROYED];
    assert.equal(new Set(actions).size, 4);

    /* NO ROTATION EVENT, and no invented actor anywhere in the ceremony. */
    const rotation = codeOf(read(ROTATION));
    for (const forbidden of ["auditLog", "audit_log", "recordCredentialEvent", '"system"', "actorType"]) {
      assert.ok(
        !rotation.includes(forbidden),
        `the rotation ceremony must not write an audit row or name an actor — found "${forbidden}"`,
      );
    }
    const script = codeOf(read("scripts/integration-rotate-encryption-key.ts"));
    assert.ok(!script.includes("auditLog"), "and neither does its operator script");

    /* The credential audit writer never accepts an actor type from anywhere. */
    const writer = codeOf(read("src/features/governance-audit/integration-credential-audit.server.ts"));
    assert.ok(/actorType:\s*"human"/.test(writer), "the actor type is fixed, never passed in");
    assert.ok(!/actorType:\s*(actor|event|input)/.test(writer), "and never taken from input");
  }

  /* ── 9b. ROTATION PERSISTS NOTHING, AND SAYS SO ──────────────────────────── */
  {
    /*
     * THE DEBT IS PINNED, not merely written down once. `audit_log` and `event_log` require a NOT
     * NULL actor a terminal cannot supply; `telemetry_events` and `command_audit` are tenant-scoped
     * while an encryption-key rotation is deployment-global. So no authority in this repository can
     * hold this record truthfully, and INT-2 invents neither a table nor an actor.
     *
     * The risk this guards against is a future edit quietly adding a writer — or quietly deleting
     * the sentence that admits the gap while leaving the gap.
     */
    const rotation = read(ROTATION);
    const script = read("scripts/integration-rotate-encryption-key.ts");

    /*
     * STRING LITERALS ARE STRIPPED as well as comments. The script PRINTS the names of the tables
     * it refuses to write — that honest sentence is exactly what a name-matching guard flags, and
     * this repository has been bitten by that before. A guard must read code, not prose.
     */
    const codeOnly = (src: string) =>
      codeOf(src).replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
    for (const table of ["telemetryEvents", "telemetry_events", "commandAudit", "command_audit", "eventLog", "event_log", "auditLog"]) {
      assert.ok(!codeOnly(rotation).includes(table), `the ceremony must not write ${table}`);
      assert.ok(!codeOnly(script).includes(table), `nor may its operator script write ${table}`);
    }
    /* It writes exactly ONE table: the credential rows it is re-wrapping. */
    const written = [...codeOf(rotation).matchAll(/\.update\((\w+)\)|\.insert\((\w+)\)/g)].map(
      (m) => m[1] ?? m[2],
    );
    assert.deepEqual(
      [...new Set(written)],
      ["integrationCredentials"],
      "rotation may write the credential rows and nothing else",
    );

    /* And the limitation is STATED where an operator and a reader will both meet it. */
    for (const [label, text] of [["the module", rotation], ["the script", script]] as const) {
      assert.match(text, /NOT production-authorized/i, `${label} must say rotation is not production-authorized`);
      assert.match(text, /durable/i, `${label} must name the durability gap`);
      assert.match(
        text,
        /platform-principal|platform principal/i,
        `${label} must name what the gap is waiting on`,
      );
    }

    /*
     * AND THE HONEST CLAIM ABOUT THE PLAINTEXT. Re-encryption is decrypt-then-encrypt: the
     * tenant's secret is in server memory for a moment, and a document that implied otherwise
     * would be the most dangerous sentence in this phase.
     */
    assert.match(
      rotation,
      /EXISTS IN\s+\*? ?SERVER MEMORY|in server memory/i,
      "the ceremony must admit that it holds the plaintext transiently",
    );
    for (const text of [rotation, script]) {
      assert.ok(
        !/zeroi[sz]|erase[sd]? (?:the )?memory|wiped from memory/i.test(text),
        "nothing may claim memory zeroization",
      );
    }
  }

  /* ── 10. NO PROVIDER BECAME CONNECTABLE, AND NO REAL VENDOR APPEARED ─────── */
  {
    /*
     * AMENDED BY INT-3, which built the connector INT-2 deliberately did not.
     *
     * INT-2's claim was "the vault exists and nothing is connected", proved by an empty catalog and
     * an absent OAuth surface. Both are now false BY DESIGN. What INT-2 is still entitled to assert
     * — and what this section now checks — is that its own boundaries held: the vault gained no
     * vendor knowledge, and the credential authority never learned to talk to anyone.
     */
    const catalog = codeOf(read("src/features/provider-catalog/catalog.ts"));
    for (const vendor of ["slack", "github", "microsoft", "notion"]) {
      assert.ok(
        !catalog.toLowerCase().includes(vendor.toLowerCase()),
        `only an implemented vendor may appear in the catalog — found "${vendor}"`,
      );
    }
    /* THE VAULT ITSELF KNOWS NO VENDOR. That is INT-2's boundary, and INT-3 did not move it. */
    for (const file of collect(CREDENTIALS).concat(collect(ENCRYPTION))) {
      const code = codeOf(read(file));
      for (const vendor of ["google", "slack", "github", "microsoft", "oauth2Client"]) {
        assert.ok(
          !code.toLowerCase().includes(vendor.toLowerCase()),
          `${file} must know nothing about any vendor — found "${vendor}"`,
        );
      }
    }

    /* No webhook, no scheduler, no sync engine — INT-3 added an OAuth pair and nothing else. */
    for (const forbidden of ["src/app/api/webhooks", "src/features/integration-sync"]) {
      assert.ok(!existsSync(path.join(ROOT, forbidden)), `${forbidden} is not part of INT-2 or INT-3`);
    }
  }

  /* ── 11. THE AAD IS UNAMBIGUOUS AND VERSIONED ────────────────────────────── */
  {
    const encoded = credentialAad("t", "i", "api_key").toString("utf8");
    assert.ok(encoded.startsWith('["v1"'), "the binding is versioned, so a future one cannot be confused with it");
    assert.deepEqual(JSON.parse(encoded), ["v1", "t", "i", "api_key"]);
    /* Boundary-shifting produces DIFFERENT bytes — the property raw concatenation would lose. */
    assert.notEqual(
      credentialAad("ab", "c", "api_key").toString("utf8"),
      credentialAad("a", "bc", "api_key").toString("utf8"),
    );
  }

  /* ── 12. THE KEY REGISTRY NEVER RENDERS MATERIAL ─────────────────────────── */
  {
    const registry = codeOf(read(REGISTRY));
    assert.ok(!registry.includes("console."), "the registry must not log");
    /* Its complaint lists are built from ids and env var names — never from the decoded value. */
    assert.ok(
      !/invalidKeys\.push\((encoded|material|rawKeys!)\)/.test(registry),
      "an invalid-key complaint must never contain key material",
    );
    assert.ok(/invalidKeys\.push\(keyId\)/.test(registry), "it names the id instead");
  }

  console.log("int2-credential-authority/boundaries-and-firewall: all assertions passed");
}

main();
