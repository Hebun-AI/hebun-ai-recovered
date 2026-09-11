/*
 * TRH-21 — PROVIDER OBSERVATION HISTORY. Truth semantics and structure.
 *
 * ── THE ONE SENTENCE THIS FILE DEFENDS ──────────────────────────────────────
 *
 *   A STORED OBSERVATION IS A RECORD THAT A PROVIDER SAID SOMETHING. IT IS NOT A RECORD THAT THIS
 *   ORGANIZATION HOLDS IT, AND IT IS NOT PERMISSION TO ASK AGAIN.
 *
 * Two failure modes are worth more than the rest, and most of this file exists for them:
 *
 *   1. the history quietly acquiring organizational standing (Knowledge, Work, Governance);
 *   2. the history quietly acquiring the ability to CAUSE a read — which would be unattended
 *      collection arriving through the back door of a memory subsystem.
 *
 * Pure: no database, no network, no key, no provider, no model.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  OBSERVATION_SUBJECT_KINDS,
  PROVIDER_OBSERVATION_RECORD_KEYS,
  canonicalizeFacts,
} from "../../src/features/provider-observation-history/contracts";
import { MAX_OBSERVATIONS_PER_READ } from "../../src/features/provider-observation-history/read-provider-observations.server";
import {
  YOUTUBE_CHANNEL_FACT_KEYS,
  YOUTUBE_CHANNEL_SUBJECT_KIND,
  YOUTUBE_VIDEO_FACT_KEYS,
  recordYouTubeChannelObservation,
  youtubeChannelObservationFacts,
  youtubeChannelSubjectRef,
} from "../../src/features/provider-observation-history/record-youtube-channel-observation.server";
import {
  YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
  YOUTUBE_PROVIDER_KEY,
  type YouTubeChannelObservation,
} from "../../src/features/provider-youtube/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const AUTHORITY_DIR = "src/features/provider-observation-history";
const CONTRACTS = `${AUTHORITY_DIR}/contracts.ts`;
const WRITER = `${AUTHORITY_DIR}/write-provider-observation.server.ts`;
const READER = `${AUTHORITY_DIR}/read-provider-observations.server.ts`;
const COMPOSITION = `${AUTHORITY_DIR}/record-youtube-channel-observation.server.ts`;
const TABLE = "src/db/schema/provider-observation.ts";
const YOUTUBE_READ = "src/features/provider-youtube/read-channel-observation.server.ts";
const OBSERVATION_COMMAND_ROOT = "src/features/heby-commands/provider-observation-commands.server.ts";
const MIGRATIONS = "src/db/migrations";

const CONNECTION_ID = "00000000-0000-4000-8000-0000000000c1";

/*
 * A channel with the awkward shape on purpose: a reported ZERO, a withheld count, and a page that
 * is not the whole channel. All three are exactly what the storage rules have to survive.
 */
const OBSERVATION: YouTubeChannelObservation = Object.freeze({
  channel: Object.freeze({
    channelId: "UCfixture",
    title: "Turkish Rug House",
    handle: "@turkishrughouse",
    publishedAt: "2021-04-02T00:00:00.000Z",
    viewCount: 0,
    subscriberCount: null,
    hiddenSubscriberCount: true,
    videoCount: 0,
  }),
  recentVideos: Object.freeze([
    Object.freeze({
      videoId: "v1",
      title: "Knotting the border",
      publishedAt: "2026-08-30T00:00:00.000Z",
      viewCount: 0,
      likeCount: null,
      commentCount: 3,
    }),
  ]),
  moreVideosExist: true,
  observedAt: "2026-09-07T15:00:00.000Z",
  quotaUnitsSpent: 3,
}) as YouTubeChannelObservation;

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. ZERO IS A VALUE. NULL IS AN ABSENCE. THEY NEVER MERGE.
 * ═════════════════════════════════════════════════════════════════════════ */
function zeroAndNullSurviveTheMapper(): void {
  const facts = youtubeChannelObservationFacts(OBSERVATION) as Record<string, unknown>;

  assert.equal(facts.viewCount, 0, "a reported zero stays a zero");
  assert.equal(facts.videoCount, 0);
  assert.strictEqual(facts.subscriberCount, null, "a withheld count stays null, never 0");
  assert.equal(facts.hiddenSubscriberCount, true);

  const video = (facts.recentVideos as Record<string, unknown>[])[0]!;
  assert.equal(video.viewCount, 0, "and the same holds one level down");
  assert.strictEqual(video.likeCount, null);
  assert.equal(video.commentCount, 3);

  /* It survives a JSON round trip, which is how it reaches and leaves the column. */
  const round = JSON.parse(JSON.stringify(facts)) as Record<string, unknown>;
  assert.equal(round.viewCount, 0);
  assert.strictEqual(round.subscriberCount, null);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE KEY SET IS CLOSED. A PROVIDER PAYLOAD HAS NO WAY IN.
 * ═════════════════════════════════════════════════════════════════════════ */
function noRawPayloadCanReachStorage(): void {
  const facts = youtubeChannelObservationFacts(OBSERVATION) as Record<string, unknown>;
  assert.deepEqual(
    Object.keys(facts).sort(),
    [...YOUTUBE_CHANNEL_FACT_KEYS].sort(),
    "the mapper produces exactly its declared keys",
  );
  const video = (facts.recentVideos as Record<string, unknown>[])[0]!;
  assert.deepEqual([...Object.keys(video)].sort(), [...YOUTUBE_VIDEO_FACT_KEYS].sort());

  /* A field YouTube starts returning tomorrow cannot arrive by accident: no spread, no passthrough. */
  const code = codeOf(read(COMPOSITION));
  assert.equal(/\.\.\.\s*(observation|channel|video|outcome|response|body|rest)/.test(code), false, "no spread of provider data");
  assert.equal(code.includes("JSON.parse"), false, "the composition parses no provider body");

  /*
   * And nothing anywhere in the authority names a credential, a URL or a header.
   *
   * ── ONE BAN WAS REPAIRED BY TRH-24, AND MADE MORE PRECISE RATHER THAN WEAKER ──
   *
   * A case-insensitive substring ban on "authorization" was correct while the only thing that word
   * could mean here was an HTTP header. TRH-24 gave this authority a legitimate, governance-shaped
   * use of it: `standingAuthorizationId` — the standing authorization a machine-sourced observation
   * was performed under. That is a Governance reference stored on purpose, not a secret leaking.
   *
   * A guard that fails on the product's own honest vocabulary teaches nothing and gets deleted. So
   * the ban is narrowed to the SPELLINGS AN HTTP HEADER ACTUALLY TAKES — a quoted key, or a header
   * object entry — which still catches every way a request header could be named, and no longer
   * catches a column. Every other banned word is untouched and still a plain substring.
   */
  const HEADER_SPELLINGS = [
    /["'`]authorization["'`]/i,
    /\bauthorization\s*:\s*["'`]/i,
    /headers\b[\s\S]{0,80}authorization/i,
  ];
  for (const file of [CONTRACTS, WRITER, READER, COMPOSITION, TABLE]) {
    const source = codeOf(read(file));
    for (const banned of ["apiKey", "api_key", "bearer", "secret", "token", "http://", "https://", "fetch("]) {
      assert.equal(
        source.toLowerCase().includes(banned.toLowerCase()),
        false,
        `${file} must not name "${banned}"`,
      );
    }
    for (const spelling of HEADER_SPELLINGS) {
      assert.equal(
        spelling.test(source),
        false,
        `${file} must not name an HTTP authorization header (${spelling.source})`,
      );
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE HISTORY CANNOT CAUSE A READ — the failure mode that would be unattended
 *    collection arriving through a memory subsystem.
 * ═════════════════════════════════════════════════════════════════════════ */
function theHistoryCannotObserveAnything(): void {
  for (const file of [CONTRACTS, WRITER, READER]) {
    const source = codeOf(read(file));
    for (const banned of [
      "provider-youtube",
      "withConnectedYouTubeApiKey",
      "readPublicChannelObservation",
      "getCapabilityAvailability",
      "listConnections",
      "credential-repository",
      "setInterval",
      "setTimeout",
      "cron",
      "schedule",
    ]) {
      assert.equal(
        source.includes(banned),
        false,
        `${file} must not reach "${banned}" — memory may not become collection`,
      );
    }
  }

  /*
   * The COMPOSITION is the one file that may name the read seam, and it may only CONSUME one: it
   * receives an outcome and records it. It must hold no timer, no loop and no retry.
   */
  const composition = codeOf(read(COMPOSITION));
  assert.ok(composition.includes("readPublicChannelObservation"), "the composition reads through CGO-5's seam");
  for (const banned of ["setInterval", "setTimeout", "cron", "while (", "for (;;)", "retry"]) {
    assert.equal(composition.includes(banned), false, `the composition must not contain "${banned}"`);
  }
  assert.equal(
    (composition.match(/await observe\(/g) ?? []).length,
    1,
    "exactly ONE provider read per call — never a second",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. IT IS NOT KNOWLEDGE, NOT WORK, NOT GOVERNANCE, NOT EXECUTION.
 * ═════════════════════════════════════════════════════════════════════════ */
function theHistoryGainsNoOrganizationalStanding(): void {
  for (const file of [CONTRACTS, WRITER, READER, COMPOSITION]) {
    const source = codeOf(read(file));
    for (const banned of [
      "@/features/knowledge",
      "ingestKnowledge",
      "knowledgeNodes",
      "knowledgeFacts",
      "@/features/organizational-work",
      "workItems",
      "workArtifacts",
      "@/features/governance",
      "decisionRecords",
      "actionPermits",
      "@/features/action-execution",
      "@/features/heby-action-inlet",
      "resolveGovernanceAuthority",
    ]) {
      assert.equal(source.includes(banned), false, `${file} must not reach "${banned}"`);
    }
  }

  /* The table itself declares no relationship to any of those authorities. */
  const table = codeOf(read(TABLE));
  for (const banned of ["knowledge", "workItems", "decisionRecords", "actionPermits", "messages"]) {
    assert.equal(table.includes(banned), false, `the table must not reference ${banned}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. APPEND-ONLY: NO UPDATE PATH EXISTS IN THE RELEASED AUTHORITY.
 * ═════════════════════════════════════════════════════════════════════════ */
function theAuthorityHasNoMutationPath(): void {
  const writer = codeOf(read(WRITER));
  /*
   * TWO INSERTS SINCE TRH-24, AND BOTH ARE THE SAME ROW WITH DIFFERENT PROVENANCE.
   *
   * `recordProviderObservation` writes a human-caused observation; `recordAuthorizedProviderObservation`
   * writes one performed under a standing authorization. One authority, one table, one append-only
   * rule — the count grew because a second PROVENANCE MODE arrived, not a second writer authority.
   * The bans below are what actually keep this append-only, and they are unchanged.
   */
  /*
   * COUNTED IN BOTH FORMS SINCE THE TRH-25 PREREQUISITE, because one of the two moved.
   *
   * The machine path became a single atomic `insert ... select ... where not exists` statement so
   * the cadence window is claimed by the write itself, which a `.insert(` regex cannot see. The
   * PROPERTY is unchanged and is not relaxed by one row: exactly TWO write entry points exist, both
   * append into `provider_observations`, and the mutation bans below are untouched. Counting only
   * the drizzle form would have reported ONE writer and passed the day a third raw INSERT appeared.
   */
  const drizzleInserts = (writer.match(/\.insert\(providerObservations\)/g) ?? []).length;
  const sqlInserts = (writer.match(/insert into provider_observations/g) ?? []).length;
  assert.equal(
    drizzleInserts + sqlInserts,
    2,
    "exactly two INSERTs — the human entry point and the machine one, into the same table",
  );
  assert.equal(
    (writer.match(/\.insert\(/g) ?? []).length,
    drizzleInserts,
    "and every drizzle insert in this writer targets `provider_observations` and nothing else",
  );
  assert.equal(
    (writer.match(/insert into (?!provider_observations)/g) ?? []).length,
    0,
    "and no raw statement inserts into any other table",
  );
  /*
   * The bans name DATABASE mutation, not the word. `createHash(...).update(...)` is a hash being
   * fed bytes and has nothing to do with a row — a bare `.update(` ban would forbid computing the
   * diagnostic digest, which is the same over-broad-word mistake the released observation ban
   * avoids by naming the ACT of publishing rather than the stem.
   */
  for (const banned of [
    "db.update(",
    "db.delete(",
    ".update(providerObservations",
    ".delete(providerObservations",
    "onConflictDoUpdate",
    "sql`update",
    "truncate",
  ]) {
    assert.equal(writer.includes(banned), false, `the writer must not contain "${banned}"`);
  }
  for (const file of [READER, COMPOSITION, CONTRACTS]) {
    const source = codeOf(read(file));
    for (const banned of [".insert(", "db.update(", "db.delete(", "onConflictDoUpdate"]) {
      assert.equal(source.includes(banned), false, `${file} writes nothing`);
    }
  }

  /* The whole application has exactly ONE writer of this table. */
  const walk = (dir: string): string[] =>
    readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) return walk(p);
      return e.isFile() && p.endsWith(".ts") ? [p] : [];
    });
  const writers = walk("src").filter(
    (f) => f !== TABLE && f !== "src/db/schema/index.ts" && codeOf(read(f)).includes("providerObservations"),
  );
  assert.deepEqual(
    writers.sort(),
    [READER, WRITER].sort(),
    "only the writer and the reader name the table",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. IDEMPOTENCY IS ABOUT THE INSTANT, NEVER ABOUT THE VALUES.
 * ═════════════════════════════════════════════════════════════════════════ */
function deduplicationNeverComparesValues(): void {
  const writer = codeOf(read(WRITER));
  assert.ok(writer.includes("onConflictDoNothing"), "a replay collides and writes nothing");
  assert.ok(writer.includes("providerObservations.observedAt"), "and the instant is part of the key");
  assert.ok(writer.includes("providerObservations.subjectRef"));
  assert.ok(writer.includes("providerObservations.tenantId"));
  /*
   * THE CONFLICT TARGET IS READ OUT AND CHECKED, not pattern-matched. It must be exactly the four
   * identity columns: adding a fact column would turn "the same subject at the same instant" into
   * "the same numbers", which is the value-comparison this contract exists to forbid.
   */
  /*
   * EVERY CONFLICT TARGET, NOT THE FIRST ONE.
   *
   * TRH-24 added a second entry point for machine-sourced provenance, so reading only the first
   * `target: [` would have left the newer insert unchecked — and a rule that inspects one of two
   * writers is a rule that can be walked around by adding a third. Both must carry the SAME four
   * identity columns, because both write the same table under the same idempotency contract.
   */
  /*
   * IN BOTH SPELLINGS, because the machine insert became one atomic statement (TRH-25 prerequisite)
   * and its conflict target is now SQL rather than a drizzle array. Reading only `target: [` would
   * have found ONE target and silently stopped checking the newer writer — the exact failure this
   * block was widened to prevent when the second writer arrived.
   */
  const IDENTITY = ["tenant_id", "provider_key", "subject_ref", "observed_at"];
  const snake = (s: string): string => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

  const drizzleTargets = [...writer.matchAll(/target: \[([\s\S]*?)\]/g)].map((m) =>
    (m[1]!.match(/providerObservations\.(\w+)/g) ?? []).map((x) => snake(x.split(".")[1]!)),
  );
  const sqlTargets = [...writer.matchAll(/on conflict \(([^)]*)\) do nothing/g)].map((m) =>
    m[1]!.split(",").map((c) => c.trim()),
  );
  const conflictTargets = [...drizzleTargets, ...sqlTargets];
  assert.equal(
    conflictTargets.length,
    2,
    "two inserts, two conflict targets — the human and the machine",
  );
  for (const conflictTarget of conflictTargets) {
    assert.deepEqual(
      conflictTarget,
      IDENTITY,
      "the idempotency key is tenant + provider + subject + instant, and nothing else",
    );
    for (const factColumn of ["facts", "facts_digest"]) {
      assert.equal(
        conflictTarget.includes(factColumn),
        false,
        `${factColumn} is stored but never deduplicated on`,
      );
    }
  }
  assert.ok(writer.includes("factsDigest,"), "and the digest is still written");

  const table = read(TABLE);
  assert.ok(
    table.includes("provider_observations_subject_instant_uidx"),
    "the unique index is the subject-and-instant one",
  );
  const target = table.slice(table.indexOf("provider_observations_subject_instant_uidx"));
  const idx = target.slice(0, target.indexOf(")"));
  for (const factColumn of ["facts", "factsDigest", "viewCount", "subscriberCount"]) {
    assert.equal(idx.includes(factColumn), false, `the unique index must not include ${factColumn}`);
  }

  /* The digest is a diagnostic: identical facts hash identically, key order notwithstanding. */
  assert.equal(
    canonicalizeFacts({ b: 1, a: null }),
    canonicalizeFacts({ a: null, b: 1 }),
    "canonicalization is key-order independent",
  );
  assert.notEqual(canonicalizeFacts({ a: 0 }), canonicalizeFacts({ a: null }), "0 and null are different facts");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE SUBJECT IS THE PROVIDER'S, NOT THE HUMAN'S.
 * ═════════════════════════════════════════════════════════════════════════ */
async function theSubjectComesFromTheProviderResponse(): Promise<void> {
  let recorded: Record<string, unknown> | undefined;
  const result = await recordYouTubeChannelObservation(
    { tenantId: "t", userId: "u" } as never,
    "@SomethingAHumanTyped",
    {
      observe: async () => ({ ok: true, value: OBSERVATION, integrationId: CONNECTION_ID }) as never,
      record: (async (_tenant: unknown, rec: Record<string, unknown>) => {
        recorded = rec;
        return { status: "recorded", observationId: "o1" };
      }) as never,
    },
  );

  assert.equal(result.record?.status, "recorded");
  assert.ok(recorded, "the writer was handed a record");
  assert.equal(
    recorded!.subjectRef,
    youtubeChannelSubjectRef("UCfixture"),
    "the subject is the PROVIDER's channel id",
  );
  assert.equal(
    JSON.stringify(recorded).includes("SomethingAHumanTyped"),
    false,
    "the handle a human typed reaches no row",
  );
  assert.equal(recorded!.subjectKind, YOUTUBE_CHANNEL_SUBJECT_KIND);
  assert.equal(recorded!.providerKey, YOUTUBE_PROVIDER_KEY);
  assert.equal(recorded!.capabilityKey, YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY);
  assert.equal(recorded!.integrationId, CONNECTION_ID, "the connection the AUTHORITY chose");
  assert.equal(recorded!.observedAt, OBSERVATION.observedAt, "Hebun's own read instant");
  assert.deepEqual(
    Object.keys(recorded!).sort(),
    [...PROVIDER_OBSERVATION_RECORD_KEYS].sort(),
    "and nothing else is written",
  );

  /* A FAILED READ RECORDS NOTHING. */
  let touched = false;
  const failed = await recordYouTubeChannelObservation({ tenantId: "t", userId: "u" } as never, "@x", {
    observe: async () => ({ ok: false, failure: "quota", reason: "quota-exhausted" }) as never,
    record: (async () => {
      touched = true;
      return { status: "recorded", observationId: "no" };
    }) as never,
  });
  assert.equal(failed.record, undefined, "no record is attempted for a failed observation");
  assert.equal(touched, false, "and the writer is never called");

  /* A REFUSED READ likewise. */
  const refusedRead = await recordYouTubeChannelObservation(null, "@x", {
    observe: async () => ({ ok: false, refusal: "capability-not-available" }) as never,
    record: (async () => {
      touched = true;
      return { status: "recorded", observationId: "no" };
    }) as never,
  });
  assert.equal(refusedRead.record, undefined);
  assert.equal(touched, false);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. THE READ SEAM DERIVES NOTHING.
 * ═════════════════════════════════════════════════════════════════════════ */
function theReaderComputesNoTrend(): void {
  const reader = codeOf(read(READER));
  for (const banned of ["delta", "trend", "growth", "rate", "momentum", "cadence", "average", "percent", "score", "compare"]) {
    assert.equal(
      reader.toLowerCase().includes(banned),
      false,
      `the read seam must not compute "${banned}" — TRH-21 stores history and derives nothing`,
    );
  }
  assert.ok(reader.includes("orderBy"), "it orders");
  assert.ok(reader.includes("limit("), "and it bounds");
  assert.equal(MAX_OBSERVATIONS_PER_READ, 50);

  /* The tenant predicate is not optional and not caller-supplied. */
  assert.ok(reader.includes("eq(providerObservations.tenantId, tenant.tenantId)"), "tenant comes from the context");
  const query = reader.slice(reader.indexOf("export interface ProviderObservationQuery"), reader.indexOf("export type ProviderObservationReadResult"));
  for (const forbidden of ["tenantId", "tenant", "actorId", "userId"]) {
    assert.equal(query.includes(forbidden), false, `the query type must not accept "${forbidden}"`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. THE RELEASED PROVIDER AND COMMAND ROOTS STILL TOUCH NO TABLE.
 * ═════════════════════════════════════════════════════════════════════════ */
function theReleasedFencesAreIntact(): void {
  const walk = (dir: string): string[] =>
    readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) return walk(p);
      return e.isFile() && p.endsWith(".ts") ? [p] : [];
    });

  for (const file of [...walk("src/features/provider-youtube"), OBSERVATION_COMMAND_ROOT]) {
    const code = codeOf(read(file));
    assert.equal(
      /\.insert\(|\.update\(|\.delete\(|@\/db\/schema/.test(code),
      false,
      `${file} still touches no table — TRH-21 put persistence outside it`,
    );
    assert.equal(
      code.includes("provider-observation-history"),
      false,
      `${file} does not reach the history authority — the composition depends on it, never the reverse`,
    );
  }

  /* The command surface still truthfully says nothing was stored, because through it nothing is. */
  const command = read(OBSERVATION_COMMAND_ROOT);
  assert.ok(command.includes("Nothing was stored"), "the command's own sentence is still true");

  /* The read seam names the connection it spent, and only on success. */
  const readSeam = read("src/features/provider-youtube/youtube-api-key-call.server.ts");
  assert.ok(readSeam.includes("readonly integrationId: string"), "success carries the connection");
  const failureBranch = readSeam.slice(readSeam.indexOf("| { readonly ok: false; readonly refusal"));
  assert.equal(
    failureBranch.slice(0, failureBranch.indexOf(";")).includes("integrationId"),
    false,
    "a refusal spent no connection and names none",
  );
  assert.ok(existsSync(path.join(ROOT, YOUTUBE_READ)));
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 10. ONE MIGRATION, ADDITIVE, NO DROP.
 * ═════════════════════════════════════════════════════════════════════════ */
function theMigrationIsAdditiveAndSingular(): void {
  const journal = JSON.parse(read(`${MIGRATIONS}/meta/_journal.json`)) as { entries: { tag: string }[] };
  const trh21 = journal.entries.filter((e) => e.tag.includes("trh21"));
  assert.equal(trh21.length, 1, "TRH-21 authored exactly one migration");
  /*
   * SPLIT BY TRH-23, AND DELIBERATELY NOT REWRITTEN.
   *
   * "TRH-21 grew the ledger 49 -> 50" is a HISTORICAL FACT about this phase and stays true forever.
   * "the ledger has 50 entries" was a LIVE MEASUREMENT that was only ever true until the next
   * migration. Collapsing the two into one number is what makes a pin like this quietly become a
   * lie; keeping them apart is what lets the historical claim survive.
   */
  const trh21Entry = journal.entries.findIndex((e) => /trh21_provider_observation_history/.test(e.tag));
  assert.equal(trh21Entry, 49, "TRH-21 is the 50th entry — it grew the ledger 49 -> 50, and always did");
  assert.equal(journal.entries.length, 53, "and the ledger has moved on since: TRH-23 added the 51st"); /* TRH-24 51 -> 52 (`provider_observations` gains machine provenance: the human actor pair becomes nullable, `standing_authorization_id` and `invocation_id` arrive, and a CHECK admits exactly one provenance mode — schema EVOLUTION, not purely additive DDL). */

  const sql = read(`${MIGRATIONS}/${trh21[0]!.tag}.sql`);
  assert.equal((sql.match(/CREATE TABLE/g) ?? []).length, 1, "one table");
  assert.equal(/DROP|TRUNCATE|ALTER COLUMN|RENAME/i.test(sql), false, "and nothing destructive");
  assert.ok(sql.includes('"provider_observations_tenant_integration_fk"'), "tenant isolation is structural");
  assert.ok(sql.includes("provider_observations_subject_instant_uidx"), "and the idempotency key exists");
  assert.equal(sql.includes("integrations"), true, "the composite FK names the connection authority");

  const sqlFiles = readdirSync(path.join(ROOT, MIGRATIONS)).filter((f) => f.endsWith(".sql"));
  assert.equal(sqlFiles.length, 53, "and the files agree with the journal"); /* TRH-24 51 -> 52 (`provider_observations` gains machine provenance: the human actor pair becomes nullable, `standing_authorization_id` and `invocation_id` arrive, and a CHECK admits exactly one provenance mode — schema EVOLUTION, not purely additive DDL). SELF-SERVICE SIGNUP 52 -> 53 (`companies_provisioning_source_chk` widened to admit `self-service-signup`). */

  /* OBSERVATION SUBJECT KINDS ARRIVE BY MIGRATION-REVIEWED CODE, never by data. */
  /*
   * THE CENSUS GREW WITH A SECOND PROVIDER, and the rule above it is unchanged: a subject kind is a
   * reviewed CODE constant, never a value that arrives from data. `instagram-account` is the second,
   * and a third still has to be added here by somebody who reads this line.
   */
  assert.deepEqual(
    [...OBSERVATION_SUBJECT_KINDS],
    ["youtube-channel", "instagram-account"],
    "two subject kinds ship, both declared in reviewed code",
  );
}

async function main(): Promise<void> {
  zeroAndNullSurviveTheMapper();
  noRawPayloadCanReachStorage();
  theHistoryCannotObserveAnything();
  theHistoryGainsNoOrganizationalStanding();
  theAuthorityHasNoMutationPath();
  deduplicationNeverComparesValues();
  await theSubjectComesFromTheProviderResponse();
  theReaderComputesNoTrend();
  theReleasedFencesAreIntact();
  theMigrationIsAdditiveAndSingular();
  console.log("PASS trh21-provider-observation-history truth and firewall");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
