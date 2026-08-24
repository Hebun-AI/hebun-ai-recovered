/*
 * PUB-1 — the public claim contract is BOUND to the repository contracts it rests on.
 *
 * ── THE PROBLEM THIS SOLVES ──────────────────────────────────────────────────
 *
 * A marketing surface written once and never checked again becomes false silently: the product
 * moves, the page does not, and nothing in the build has an opinion. `features/public-claims`
 * exists so the copy has ONE home, and this file exists so that home cannot drift away from the
 * code underneath it.
 *
 * Every assertion below reads an AUTHORITATIVE contract — the provider catalog, the Google scope
 * constants, the Knowledge capability map, the governance subject registry, the encryption
 * algorithm — and fails when that contract moves in a way that makes a published sentence stale.
 * The failure is the point: a capability that grows is a capability whose LIMIT must be rewritten
 * before it ships, and this test is what forces that rewrite into the same change.
 *
 * It also pins what is WITHHELD. A claim absent from the public contract on purpose (ratification,
 * a live model runtime, agents, search) is asserted absent, so re-adding one is a test change
 * rather than a copy change.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  GOVERNED_PATH,
  GOVERNED_RECORD_ANATOMY,
  PUBLIC_CAPABILITY_CLAIMS,
  PUBLIC_CAPABILITY_STATE_LABEL,
  SECURITY_MECHANISMS,
  type PublicCapabilityId,
} from "../../src/features/public-claims/capability-claims";
import { PROVIDER_CATALOG } from "../../src/features/provider-catalog/catalog";
import {
  GOOGLE_DRIVE_METADATA_CAPABILITY,
  GOOGLE_DRIVE_METADATA_SCOPE,
} from "../../src/features/provider-google/contracts";
import { findKnowledgeCapability } from "../../src/features/knowledge/capability-map";
import { GOVERNANCE_SUBJECT_TYPES } from "../../src/features/governance-decision/contracts";
import { SECRET_ALGORITHM_AES_256_GCM } from "../../src/features/secret-encryption/authenticated-encryption.server";

const ROOT = process.cwd();
const abs = (p: string) => path.join(ROOT, p);
const read = (p: string) => readFileSync(abs(p), "utf8");

/** The complete published set, restated here so adding a claim is a deliberate two-file change. */
const PUBLISHED: readonly PublicCapabilityId[] = [
  "tenant-workspace",
  "knowledge-ingestion",
  "evidence-backed-answers",
  "coverage-view",
  "governed-action-authorization",
  "google-connection",
  "drive-metadata-read",
];

function claim(id: PublicCapabilityId) {
  const found = PUBLIC_CAPABILITY_CLAIMS.find((entry) => entry.id === id);
  assert.ok(found, `the public contract must publish "${id}"`);
  return found!;
}

function main(): void {
  /* ── 1. THE SET IS CLOSED, AND EVERY STATEMENT IS COMPLETE ─────────────── */
  {
    assert.deepEqual(
      PUBLIC_CAPABILITY_CLAIMS.map((c) => c.id),
      PUBLISHED,
      "the published capability set is closed — adding one is a typed change with a test change",
    );
    for (const entry of PUBLIC_CAPABILITY_CLAIMS) {
      assert.ok(entry.capability.trim().length > 0, `${entry.id}: a capability needs a name`);
      assert.ok(
        entry.limit.trim().length > 20,
        `${entry.id}: a capability published without a real limit is half a claim`,
      );
      assert.ok(
        entry.provenance.includes("src/"),
        `${entry.id}: a public statement must name the repository contract it rests on`,
      );
      assert.ok(
        Object.hasOwn(PUBLIC_CAPABILITY_STATE_LABEL, entry.state),
        `${entry.id}: unknown state ${entry.state}`,
      );
    }
    /* No "coming soon". A capability that cannot be used is absent, not labelled. */
    assert.deepEqual(
      Object.keys(PUBLIC_CAPABILITY_STATE_LABEL).sort(),
      ["available", "read-only"],
      "there is no planned/beta/coming-soon state — an unusable capability is not published",
    );
  }

  /* ── 2. EVERY PROVENANCE PATH RESOLVES ON DISK ─────────────────────────── */
  {
    const referenced = [
      ...PUBLIC_CAPABILITY_CLAIMS.map((c) => c.provenance),
      ...SECURITY_MECHANISMS.map((m) => m.provenance),
    ].join(" ");
    const paths = [...referenced.matchAll(/src\/[A-Za-z0-9_\-./{},*]+/g)].map((m) => m[0]);
    assert.ok(paths.length >= 12, "every published statement must name at least one source");
    for (const raw of paths) {
      /* `a/{x,y}.ts` names several siblings; `dir/*` names a directory. Expand both. */
      const brace = /^(.*)\{([^}]+)\}(.*)$/.exec(raw);
      const candidates = brace
        ? brace[2]!.split(",").map((part) => `${brace[1]}${part}${brace[3]}`)
        : [raw.replace(/\/\*$/, "")];
      for (const candidate of candidates) {
        const cleaned = candidate.replace(/[.,]$/, "");
        assert.ok(
          existsSync(abs(cleaned)),
          `a published statement names ${cleaned}, which does not exist — the provenance has rotted`,
        );
      }
    }
  }

  /* ── 3. GOOGLE: THE SCOPE IS THE CLAIM ─────────────────────────────────── */
  {
    assert.equal(
      GOOGLE_DRIVE_METADATA_SCOPE,
      "https://www.googleapis.com/auth/drive.metadata.readonly",
      "the published scope name and the requested scope are one string",
    );

    /*
     * ── AMENDED BY GITHUB-2: THE PUBLIC CLAIM NO LONGER COUNTS ─────────────
     *
     * The site used to publish "One integration exists. It is Google.", and this pin held that
     * sentence against the catalog — correctly. GITHUB-2 made a second provider connectable and
     * the sentence became FALSE, which is exactly what this guard is for: it caught a public
     * untruth introduced by a runtime change, before release.
     *
     * The remedy was to stop publishing a COUNT rather than to keep restating it. A number on a
     * marketing page is a claim that rots on every future provider, and the thing a reader
     * actually needs is what they can connect today. The site now says an organization can connect
     * a real Google account — which is true, and stays true as the catalog grows.
     *
     * So the assertion follows the claim: Google must be present and connectable, because the
     * sentence promises it. The catalog's SIZE is deliberately no longer asserted here, because
     * the site no longer asserts it either.
     */
    const google = PROVIDER_CATALOG.find((p) => p.providerKey === "google-workspace");
    assert.ok(google, "the site promises a Google connection — the catalog must offer one");
    assert.equal(
      google.connectivity,
      "connectable",
      "the published promise is that it can be connected, not merely listed",
    );

    const scopes = google.capabilityScopes?.[GOOGLE_DRIVE_METADATA_CAPABILITY];
    assert.ok(scopes, "the Drive metadata capability must be in the catalog for the claim to stand");
    assert.deepEqual(
      [...scopes!.read],
      [GOOGLE_DRIVE_METADATA_SCOPE],
      "the Drive read claim must rest on the metadata scope and nothing wider",
    );
    assert.deepEqual(
      [...scopes!.write],
      [],
      'the site says "No Drive write" — the catalog write set must stay empty',
    );

    const drive = claim("drive-metadata-read");
    assert.equal(drive.state, "read-only", "a metadata scope cannot be published as writable");
    assert.match(drive.limit, /drive\.metadata\.readonly/, "the limit must name the exact scope");
    assert.match(drive.limit, /No file content is read/, "the content refusal must be published");
    assert.match(drive.limit, /nothing in Drive is written/, "the write refusal must be published");
    assert.match(
      drive.limit,
      /nothing read from Drive is persisted as knowledge/,
      "the persistence refusal must be published",
    );

    /*
     * The persistence refusal, proved against the reader itself: the Drive seam holds no Knowledge
     * writer, so nothing it reads can become an organizational fact.
     */
    const reader = read("src/features/provider-google/read-drive-metadata.server.ts");
    const readerImports = [...reader.matchAll(/from\s*["']([^"']+)["']/g)].map((m) => m[1]!);
    for (const specifier of readerImports) {
      assert.ok(
        !/knowledge/i.test(specifier),
        `the Drive reader imports ${specifier} — the "not persisted as knowledge" claim would be false`,
      );
    }
  }

  /* ── 4. KNOWLEDGE: WHAT IS CONNECTED, AND WHAT IS DENIED ───────────────── */
  {
    assert.equal(
      findKnowledgeCapability("ingestion").state,
      "connected",
      "the ingestion claim rests on the Knowledge capability map",
    );
    assert.equal(
      findKnowledgeCapability("retrieval").state,
      "connected",
      "the evidence-backed answers claim rests on question-driven retrieval",
    );

    /*
     * The DENIALS are load-bearing too. The published limit says there is no search surface, no
     * semantic matching and no embeddings; if any of those becomes connected, the limit is stale
     * and this fails — which is exactly when the sentence must be rewritten.
     */
    for (const denied of ["search", "semantic-retrieval", "fuzzy-matching", "embeddings"] as const) {
      assert.equal(
        findKnowledgeCapability(denied).state,
        "not-connected",
        `the published limit denies "${denied}" — it must still be unconnected`,
      );
    }

    const answers = claim("evidence-backed-answers");
    assert.match(answers.limit, /no search surface/i, "the search denial must be published");
    assert.match(answers.limit, /no semantic matching/i, "the semantic denial must be published");

    const ingestion = claim("knowledge-ingestion");
    for (const required of [/\.txt/, /\.md/, /PDF/, /No OCR/i, /not retained/i]) {
      assert.match(ingestion.limit, required, `the ingestion limit must state ${required}`);
    }
  }

  /* ── 5. GOVERNANCE: THE DECISION STAGE MAY NOT BE PUBLISHED AS BROAD ───── */
  {
    assert.deepEqual(
      [...GOVERNANCE_SUBJECT_TYPES],
      ["knowledge_node"],
      "governed decisions cover one subject; the published note says so and must stay true",
    );
    const decision = GOVERNED_PATH.find((stage) => stage.name === "Decision");
    assert.ok(decision, "the governed path must carry a Decision stage");
    assert.match(
      decision!.note,
      /one subject: an organization's knowledge records/,
      "the Decision stage must publish the narrowness of the subject registry",
    );

    /* Six stages, each carrying its own boundary — so no rendering can imply equal maturity. */
    assert.equal(GOVERNED_PATH.length, 6, "the governed path is six stages");
    assert.deepEqual(
      GOVERNED_PATH.map((s) => s.name),
      ["Knowledge", "Evidence", "Decision", "Permit", "Action", "Audit record"],
      "the governed path order is the meaning",
    );
    for (const stage of GOVERNED_PATH) {
      assert.ok(
        stage.note.trim().length > 20,
        `${stage.name}: a stage published without its boundary implies a maturity it may not have`,
      );
    }
    assert.match(
      GOVERNED_PATH[5]!.note,
      /Governed acts write durable audit records/,
      "the audit stage must use the durable wording, never a count",
    );
    for (const stage of GOVERNED_PATH) {
      assert.ok(
        !/\bten\b/i.test(`${stage.summary} ${stage.note}`),
        `${stage.name}: a published tally needs marketing maintenance`,
      );
    }

    const authorization = claim("governed-action-authorization");
    assert.match(
      authorization.limit,
      /four separate recorded steps/,
      "the four-step authorization claim must be published with its shape",
    );
    for (const file of [
      "src/features/action-authorization/record-action-request.server.ts",
      "src/features/action-authorization/decide-action-request.server.ts",
      "src/features/action-authorization/consume-action-permit.server.ts",
      "src/features/action-authorization/revoke-action-permit.server.ts",
    ]) {
      assert.ok(existsSync(abs(file)), `the four-step claim rests on ${file}`);
    }
  }

  /* ── 6. SECURITY: MECHANISMS, AND THE ALGORITHM THAT BACKS ONE ─────────── */
  {
    assert.equal(
      SECRET_ALGORITHM_AES_256_GCM,
      "aes-256-gcm",
      "the published credential-encryption claim names the algorithm the code uses",
    );
    const credentials = SECURITY_MECHANISMS.find((m) => m.field === "credentials");
    assert.ok(credentials, "the credential mechanism must be published");
    assert.match(credentials!.statement, /AES-256-GCM/, "the algorithm is published, not an adjective");

    const ADJECTIVES = /enterprise-grade|military-grade|bank-level|zero.trust|world-class|state of the art/i;
    for (const mechanism of SECURITY_MECHANISMS) {
      assert.ok(
        !ADJECTIVES.test(mechanism.statement),
        `${mechanism.field}: security is published as a mechanism, never as an adjective`,
      );
      assert.ok(mechanism.field === mechanism.field.toLowerCase(), `${mechanism.field} is an identifier`);
    }
    assert.ok(
      SECURITY_MECHANISMS.some((m) => m.field === "audit" && /durable audit records/.test(m.statement)),
      "the audit mechanism must use the durable wording",
    );
  }

  /* ── 7. THE RECORD ANATOMY CARRIES FIELD NAMES AND NO SAMPLE DATA ──────── */
  {
    assert.ok(GOVERNED_RECORD_ANATOMY.length >= 5, "the anatomy must actually describe a record");
    for (const entry of GOVERNED_RECORD_ANATOMY) {
      assert.match(
        entry.field,
        /^[a-z][a-z_ ]*$/,
        `${entry.field}: an anatomy entry is a field name, never a value`,
      );
      assert.ok(
        !/@|\bhttps?:|\b\d{4}-\d{2}-\d{2}\b/.test(entry.meaning),
        `${entry.field}: the anatomy must not carry sample data`,
      );
    }
  }

  /* ── 8. WHAT IS WITHHELD, STAYS WITHHELD ───────────────────────────────── */
  {
    const published = new Set<string>(PUBLIC_CAPABILITY_CLAIMS.map((c) => c.id));
    for (const withheld of [
      "ratification",
      "model-runtime",
      "agents",
      "orchestration",
      "computer-use",
      "search",
      "semantic-retrieval",
      "memory",
      "knowledge-graph",
      "external-send",
      "organizational-intelligence",
    ]) {
      assert.ok(!published.has(withheld), `"${withheld}" is withheld by PUB-0 and may not be published`);
    }

    /* The whole contract, scanned for the claims the inventory withheld. */
    const contract = read("src/features/public-claims/capability-claims.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const pattern of [/\bratif/i, /\bAI agents?\b/i, /orchestrat/i, /computer use/i, /semantic search/i]) {
      assert.ok(!pattern.test(contract), `the public contract carries a withheld claim: ${pattern}`);
    }
  }

  console.log("PUB-1 public claim truth: ok");
}

main();
