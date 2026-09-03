/*
 * CGO-1 — CONTENT DRAFT PREPARATION. Truth semantics, and the claims this capability must NOT make.
 *
 * The whole risk of this phase is one sentence being read as another: "prepared for Instagram"
 * upgraded into "connected to Instagram". Everything below exists to make that upgrade fail a test
 * rather than fail a customer.
 *
 * Pure and structural. No database, no network, no provider, no clock.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  CONTENT_DESTINATION_LABELS,
  CONTENT_DESTINATION_NON_CLAIMS,
  CONTENT_DESTINATIONS,
  CONTENT_DRAFT_TYPE,
  CONTENT_PREPARATION_DISTINCTIONS,
  WORK_ARTIFACT_NON_EFFECTS,
  WORK_ARTIFACT_TYPES,
  isContentDestination,
  isWorkArtifactType,
} from "../../src/features/work-artifacts/contracts";
import { validateWorkArtifactInput } from "../../src/features/work-artifacts/validation";
import { PROVIDER_CATALOG } from "../../src/features/provider-catalog/catalog";
import { listExternalSendAdapters } from "../../src/features/action-execution/adapter-registry.server";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(path.join(REPO_ROOT, relative), "utf8");
}

/** The destination vocabulary is CLOSED — a value cannot be invented by a caller or by a row. */
function destinationVocabularyIsClosed(): void {
  assert.deepEqual(
    [...CONTENT_DESTINATIONS],
    ["instagram", "tiktok", "youtube"],
    "the three destinations the content operating target names, and no more",
  );

  for (const destination of CONTENT_DESTINATIONS) {
    assert.ok(
      CONTENT_DESTINATION_LABELS[destination],
      `${destination} has a human label so a surface never prints a raw enum member`,
    );
  }

  /* Near-misses, casing variants and free text are all refused — the ambiguity this enum prevents. */
  for (const rejected of ["Instagram", "IG", "insta", "facebook", "x", "", "https://instagram.com/a"]) {
    assert.equal(
      isContentDestination(rejected),
      false,
      `"${rejected}" is not a destination: the vocabulary is closed, not fuzzy`,
    );
  }

  assert.equal(isWorkArtifactType(CONTENT_DRAFT_TYPE), true, "content-draft is a registered type");
  assert.ok(
    (WORK_ARTIFACT_TYPES as readonly string[]).includes(CONTENT_DRAFT_TYPE),
    "the type list carries it",
  );
}

/**
 * THE RULE, IN BOTH DIRECTIONS. A content draft must declare a destination; nothing else may carry
 * one. Both halves are asserted because a one-directional rule rots into a convention.
 */
function destinationBindsToContentDraftOnly(): void {
  const base = { title: "A caption", content: "Body text." };

  /* A content draft WITHOUT a destination is incomplete. */
  const missing = validateWorkArtifactInput({ ...base, artifactType: CONTENT_DRAFT_TYPE });
  assert.ok(
    missing.some((p) => p.field === "intendedDestination" && p.code === "required"),
    "a content draft must say what it was prepared for",
  );

  /* A content draft WITH a destination is complete. */
  assert.deepEqual(
    validateWorkArtifactInput({
      ...base,
      artifactType: CONTENT_DRAFT_TYPE,
      intendedDestination: "tiktok",
    }),
    [],
    "a content draft with a registered destination validates",
  );

  /* An UNREGISTERED destination is refused rather than stored as text. */
  assert.ok(
    validateWorkArtifactInput({
      ...base,
      artifactType: CONTENT_DRAFT_TYPE,
      intendedDestination: "linkedin",
    }).some((p) => p.field === "intendedDestination"),
    "an unregistered destination is refused, never coerced",
  );

  /* Every OTHER type may not carry one, and both existing types are checked. */
  for (const otherType of ["operational-plan", "message-draft"] as const) {
    assert.deepEqual(
      validateWorkArtifactInput({ ...base, artifactType: otherType }),
      [],
      `${otherType} validates with no destination`,
    );
    assert.ok(
      validateWorkArtifactInput({
        ...base,
        artifactType: otherType,
        intendedDestination: "instagram",
      }).some((p) => p.field === "intendedDestination" && p.code === "destination-not-permitted"),
      `${otherType} may not carry a destination`,
    );
  }
}

/** The database enforces the same rule structurally, in both directions, not just the validator. */
function databaseEnforcesTheSameRule(): void {
  const schema = read("src/db/schema/work-artifact.ts");

  assert.ok(
    schema.includes("work_artifacts_content_draft_destination_chk"),
    "a content draft without a destination is refused by a CHECK, not only by the validator",
  );
  assert.ok(
    schema.includes("work_artifacts_non_content_destination_chk"),
    "a non-content artifact with a destination is refused by a CHECK",
  );

  /*
   * THE CAST IS LOAD-BEARING, NOT COSMETIC. PostgreSQL refuses to use a newly added enum value in
   * the transaction that added it, and migration 47 adds `content-draft` and these constraints
   * together. The bare-enum form fails on a real database; the text form does not.
   */
  assert.ok(
    schema.includes("${t.artifactType}::text <> 'content-draft'"),
    "the CHECK compares artifact_type AS TEXT so it is creatable in the same transaction",
  );

  const migrations = readdirSync(path.join(REPO_ROOT, "src/db/migrations"))
    .filter((f) => f.endsWith("cgo1_content_draft_destination.sql"));
  assert.equal(migrations.length, 1, "exactly one CGO-1 migration is authored");

  const sql = read(path.join("src/db/migrations", migrations[0]!));
  assert.ok(sql.includes("ADD VALUE 'content-draft'"), "the type gains the value");
  assert.ok(sql.includes('CREATE TYPE "public"."content_destination"'), "the destination enum is created");
  assert.ok(
    sql.includes(`"artifact_type"::text <> 'content-draft'`),
    "the shipped SQL carries the text cast that makes it applicable",
  );
  assert.equal(/\bDROP\b/.test(sql), false, "CGO-1 is additive: zero DROP");
}

/**
 * THE DESTINATION IS WRITTEN ONCE AND NEVER UPDATED.
 *
 * An approval binds to `<ref>@<revision>`. If a destination could be edited afterwards, a human
 * could approve a draft prepared for one destination and have it silently become another. The
 * column sits on a mutable row, so the guarantee is the ABSENCE of a writer — asserted, not
 * trusted, exactly as the revision table's immutability already is.
 */
function destinationIsNeverUpdated(): void {
  const writer = read("src/features/work-artifacts/write-work-artifacts.server.ts");

  assert.ok(
    writer.includes("intendedDestination: input.intendedDestination ?? null"),
    "the destination is written exactly once, at insert",
  );

  /*
   * Scan every `.set({...})` payload in the writer. None may name the destination. This catches a
   * future "let them fix the destination" path, which is precisely the change that would break
   * every approval already bound to an artifact.
   */
  for (const match of writer.matchAll(/\.set\(\{([\s\S]*?)\}\)/g)) {
    assert.equal(
      match[1]!.includes("intendedDestination"),
      false,
      "no UPDATE anywhere in the writer may change a declared destination",
    );
  }
}

/**
 * THE PROVIDER FIREWALL. Declaring a destination reaches nothing, and the repository proves it
 * rather than the prose promising it.
 */
function noProviderIsReachable(): void {
  /*
   * ── REWRITTEN BY CGO-6, BECAUSE CGO-5 CHANGED THE PREMISE AND NOT THE RULE ──
   *
   * This once asserted that no destination NAME appears in the provider catalog, which was true
   * while no destination had a provider at all. CGO-5 connected `youtube` as a real, credential-only
   * PUBLIC-READ provider, so a destination name and a provider key now legitimately coincide — and
   * the old assertion failed on a fact the repository is entitled to have. (It had been failing
   * since CGO-5 released; the coincidence, not this phase, is what broke it.)
   *
   * The rule it was defending never mentioned names: DECLARING A DESTINATION REACHES NOTHING. So it
   * is restated as the thing that actually matters — a destination that happens to be a provider
   * must expose no WRITE half anywhere in its catalog entry. A future destination that acquires a
   * write scope fails here, which the name check could never have caught.
   */
  for (const destination of CONTENT_DESTINATIONS) {
    const entry = PROVIDER_CATALOG.find((candidate) => candidate.providerKey === destination);
    if (!entry) continue; /* Not a provider at all — the strongest possible form of "no reach". */
    for (const [capability, scopes] of Object.entries(entry.capabilityScopes)) {
      assert.deepEqual(
        [...scopes.write],
        [],
        `${destination} may be a connected provider, but ${capability} must carry NO write scope: ` +
          "a destination is a declaration, never a place Hebun may publish",
      );
    }
  }

  /* No adapter can publish. The only external adapter Hebun registers sends email. */
  const adapters = listExternalSendAdapters();
  assert.equal(adapters.length, 1, "exactly one external adapter exists");
  for (const adapter of adapters) {
    for (const destination of CONTENT_DESTINATIONS) {
      assert.equal(
        JSON.stringify(adapter).toLowerCase().includes(destination),
        false,
        `no adapter reaches ${destination}`,
      );
    }
  }

  /*
   * CGO-1 ADDED NO PROVIDER CODE. The feature that owns content drafts holds no transport of any
   * kind — no fetch, no client, no endpoint, no credential, no scope.
   */
  const featureDir = path.join(REPO_ROOT, "src/features/work-artifacts");
  for (const file of readdirSync(featureDir)) {
    const source = readFileSync(path.join(featureDir, file), "utf8");
    /* Strip comments: the prose legitimately NAMES what it refuses to do. */
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    /*
     * PROVIDER TOKENS, NOT WORD FRAGMENTS. An earlier draft of this list banned "scope" and it
     * fired on the honest sentence "Durable and tenant-scoped" — a guard tripping over the
     * product's own truthful prose. Each token below can only appear in transport or credential
     * code, never in a description of what the domain refuses to do.
     */
    for (const forbidden of [
      "fetch(",
      "https://",
      "access_token",
      "client_secret",
      "Bearer ",
      "oauth",
    ]) {
      assert.equal(
        code.includes(forbidden),
        false,
        `work-artifacts/${file} must contain no "${forbidden}" — preparation reaches nothing`,
      );
    }
  }
}

/** The negative semantics exist as data, are non-empty, and say what they must say. */
function negativeSemanticsAreStated(): void {
  assert.equal(CONTENT_DESTINATION_NON_CLAIMS.length, 4, "four non-claims, all stated");
  const joined = CONTENT_DESTINATION_NON_CLAIMS.join(" ").toLowerCase();
  for (const required of ["not a provider connection", "nothing is scheduled", "nothing is published"]) {
    assert.ok(joined.includes(required), `the non-claims state "${required}"`);
  }

  assert.deepEqual(
    [...CONTENT_PREPARATION_DISTINCTIONS],
    [
      "PREPARED is not SCHEDULED",
      "SCHEDULED is not PUBLISHED",
      "PUBLISHED is not DELIVERED",
      "DELIVERED is not SEEN",
    ],
    "the four collapses, in order",
  );

  assert.ok(
    WORK_ARTIFACT_NON_EFFECTS.some((line) => line.toLowerCase().includes("never published")),
    "the artifact non-effects now carry the publication non-effect",
  );

  /* The surface renders them, so the claim is not merely available — it is shown. */
  const ui = read("src/components/operations-preparation/prepared-work-section.tsx");
  assert.ok(ui.includes("CONTENT_DESTINATION_NON_CLAIMS"), "the surface renders the non-claims");
  assert.ok(ui.includes("CONTENT_PREPARATION_DISTINCTIONS"), "the surface renders the distinctions");
  assert.ok(
    ui.includes("prepared for"),
    'the artifact row reads "prepared for", never "publishes to"',
  );
  /*
   * SCAN THE RENDERED TEXT, NOT THE COMMENTS. The comment above the artifact row legitimately
   * NAMES the phrases it refuses to print — a ban that reads its own explanation is a guard
   * failing on the product's own honest prose, which is a defect this repository has already paid
   * for once. Strip comments, then judge what a reader can actually see.
   */
  const rendered = ui.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const forbidden of ["publishes to", "connected to", "will post", "scheduled for"]) {
    assert.equal(
      rendered.toLowerCase().includes(forbidden),
      false,
      `the surface must never say "${forbidden}"`,
    );
  }
}

/** CGO-1 introduced NO scheduler. "Publish twice a day" remains unrepresentable. */
function noSchedulerWasIntroduced(): void {
  const featureDir = path.join(REPO_ROOT, "src/features/work-artifacts");
  for (const file of readdirSync(featureDir)) {
    const code = readFileSync(path.join(featureDir, file), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    for (const forbidden of ["setInterval", "setTimeout", "cron", "publishAt", "scheduledAt"]) {
      assert.equal(
        code.includes(forbidden),
        false,
        `work-artifacts/${file} must contain no "${forbidden}" — nothing here schedules anything`,
      );
    }
  }
}

destinationVocabularyIsClosed();
destinationBindsToContentDraftOnly();
databaseEnforcesTheSameRule();
destinationIsNeverUpdated();
noProviderIsReachable();
negativeSemanticsAreStated();
noSchedulerWasIntroduced();

console.log("PASS cgo1 content draft truth");
