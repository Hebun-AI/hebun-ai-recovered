/*
 * REV-1 — AUTHORSHIP LEGIBILITY ON THE REVIEW SURFACE.
 *
 * ── THE ONE SENTENCE THIS SUITE DEFENDS ─────────────────────────────────────
 *
 *   A HUMAN REVIEWING PREPARED WORK CAN SEE THAT A MODEL WROTE IT — AND SEEING THAT CHANGES
 *   NOTHING ABOUT THE ARTIFACT, ITS LIFECYCLE, OR ANY AUTHORITY.
 *
 * The reachability half was ALREADY RELEASED. OPS-P1 gave `/operations` a listing, a per-revision
 * history that renders the bytes, and create/revise/retire — so "a human cannot reach prepared
 * content" was false when this phase began, and that is recorded here rather than quietly fixed.
 * What was missing is narrower: OPS-P1 withheld `authoredByActorType`, correctly at the time
 * (every revision then in existence was human-authored), and three later releases falsified the
 * assumption without moving the pin.
 *
 * This phase adds a PURE VOCABULARY and one rendered line. It adds no authority, no persistence, no
 * schema, no lifecycle state, no provider call and no approval semantics — because none of those
 * exist to extend, which section 5 proves from the repository rather than asserting.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { resolveAgentAuthorship } from "../../src/features/work-artifacts/agent-authorship.server";
import {
  createWorkArtifactFromHebyPreparation,
  createWorkArtifact,
} from "../../src/features/work-artifacts/write-work-artifacts.server";
import {
  listWorkArtifacts,
  readWorkArtifactHistory,
} from "../../src/features/work-artifacts/read-work-artifacts.server";
import {
  WORK_ARTIFACT_AUTHORSHIP_NON_CLAIMS,
  WORK_ARTIFACT_AUTHOR_LABELS,
  WORK_ARTIFACT_AUTHOR_UNKNOWN,
  WORK_ARTIFACT_LIFECYCLE_STATUSES,
  workArtifactAuthorLabel,
} from "../../src/features/work-artifacts/contracts";
import { GOVERNANCE_SUBJECT_TYPES } from "../../src/features/governance-decision/contracts";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SURFACE = "src/components/operations-preparation/prepared-work-section.tsx";
const WRAPPER = "src/components/operations-preparation/operations-preparation.tsx";
const READER = "src/features/work-artifacts/read-work-artifacts.server.ts";
const ACTIONS = "src/app/(dashboard)/operations/actions.ts";
const NOW = new Date("2026-09-04T12:00:00.000Z");

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded, requestId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId: "00000000-0000-4000-8000-000000000000",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId,
    authenticatedAt: NOW.toISOString(),
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE VOCABULARY FAILS CLOSED. An unknown actor type is never a person.
 * ═════════════════════════════════════════════════════════════════════════ */
function theVocabularyNeverGuesses(): void {
  /* The four members of the `actor_type` enum each have a sentence. */
  for (const actorType of ["human", "agent", "system", "service"]) {
    const label = workArtifactAuthorLabel(actorType);
    assert.equal(label, WORK_ARTIFACT_AUTHOR_LABELS[actorType], `${actorType} has its own sentence`);
    assert.notEqual(label, WORK_ARTIFACT_AUTHOR_UNKNOWN, `${actorType} is a known class`);
  }

  /* Every unnamed input resolves to UNKNOWN — never silently to the human sentence. */
  for (const unknown of ["", "HUMAN", "robot", "agent ", "undefined", "null", "0"]) {
    assert.equal(
      workArtifactAuthorLabel(unknown),
      WORK_ARTIFACT_AUTHOR_UNKNOWN,
      `"${unknown}" is unknown, not defaulted`,
    );
  }
  assert.notEqual(
    WORK_ARTIFACT_AUTHOR_UNKNOWN,
    WORK_ARTIFACT_AUTHOR_LABELS.human,
    "the unknown sentence is not the human sentence",
  );
  assert.match(WORK_ARTIFACT_AUTHOR_UNKNOWN, /unknown, not human/i, "and it says so");

  /* A human and an agent are DIFFERENT sentences — the whole point of the phase. */
  assert.notEqual(
    WORK_ARTIFACT_AUTHOR_LABELS.human,
    WORK_ARTIFACT_AUTHOR_LABELS.agent,
    "a person and an agent do not read the same",
  );
  assert.match(WORK_ARTIFACT_AUTHOR_LABELS.agent!, /durable agent/i);

  /* Authorship claims nothing about standing, and says so in words a surface renders. */
  assert.ok(WORK_ARTIFACT_AUTHORSHIP_NON_CLAIMS.length >= 3);
  const denials = WORK_ARTIFACT_AUTHORSHIP_NON_CLAIMS.join(" ").toLowerCase();
  for (const required of ["is not a review", "no approval", "records nothing"]) {
    assert.ok(denials.includes(required), `the non-claims must say "${required}"`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE SURFACE READS AND RENDERS. It writes no review and holds no state.
 * ═════════════════════════════════════════════════════════════════════════ */
function theSurfaceRecordsNothing(): void {
  const surface = codeOf(read(SURFACE));

  /* It names the author through the one vocabulary, and never classifies inline. */
  assert.ok(surface.includes("workArtifactAuthorLabel(revision.authoredByActorType)"));
  assert.ok(surface.includes("WORK_ARTIFACT_AUTHORSHIP_NON_CLAIMS"));
  assert.equal(surface.includes("authoredByActorId"), false, "the identifier stays withheld");

  /*
   * NO REVIEW IS RECORDED, AND THERE IS NOTHING TO RECORD IT WITH. Judged on the surface, the
   * wrapper, the read seam and the actions file together: a review verb appearing in ANY of them
   * would be the first half of a review authority arriving without one.
   */
  /*
   * AMENDED AT TRH-10. The ban's own reason was "the first half of a review authority arriving
   * WITHOUT one" — and TRH-10 shipped the other half: review is a Governance decision on an exact
   * revision, with its own subject, domain, writer and tests. So the verbs are no longer forbidden;
   * what is forbidden is the thing the ban was really guarding — this surface RECORDING a review
   * itself. `reviewState` and the Governance-backed action are permitted; a local review column,
   * timestamp or actor is not, because that would be the second approval source of truth.
   */
  for (const file of [SURFACE, WRAPPER, READER, ACTIONS]) {
    const code = codeOf(read(file));
    for (const banned of [
      "markReviewed", "recordReview", "reviewedAt", "reviewedBy",
      "approveArtifact", "rejectArtifact", "approvedAt", "approvedBy",
      "publish", "schedule", "scheduledAt", "publishedAt",
    ]) {
      assert.equal(code.includes(banned), false, `${file} must not contain "${banned}"`);
    }
  }

  /* And the read seam is still read-only, exactly as R3W released it. */
  const reader = codeOf(read(READER));
  for (const banned of [".insert(", ".update(", ".delete(", ".transaction("]) {
    assert.equal(reader.includes(banned), false, `the read seam must stay read-only ("${banned}")`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. NO PROVIDER IS REACHED BY LOOKING AT AN ARTIFACT — the CGO-7 firewall.
 * ═════════════════════════════════════════════════════════════════════════ */
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

function reviewingObservesNothing(): void {
  /*
   * REVIEWING AN ARTIFACT MUST NOT RE-OBSERVE ANYTHING. CGO-7 spends 3 YouTube quota units per
   * PREPARATION; a human opening the history a hundred times must spend none. Judged on `.server.ts`
   * under a provider, because a `contracts.ts` type declaration can contact nothing — the same
   * distinction CGO-7's own firewall draws.
   */
  /*
   * THE GRAPH IS ROOTED AT THE READ SEAM, AND THAT CHOICE IS THE HONEST ONE.
   *
   * `operations/actions.ts` is a SHARED BARREL: it exports the three read actions this surface
   * calls AND `prepareWorkArtifactAction`, which legitimately reaches the whole Heby answer path.
   * Rooting a graph at the component would therefore inherit preparation's entire reach and prove
   * nothing about reviewing — the assertion would be about a module boundary, not about what
   * happens when a human opens a history. That reach is CGO-7's and is firewalled where it lives.
   *
   * What actually executes when a human reviews is `readWorkArtifactHistory`. So that is the root,
   * and the components are judged by token scan below.
   */
  const graph = reachableFrom(READER);

  const callable = [...graph].filter((f) =>
    /^src\/features\/provider-[^/]+\/.*\.server\.tsx?$/.test(f),
  );
  assert.deepEqual(callable, [], "the read seam reaches no provider transport, credential frame or read seam");

  assert.equal(
    graph.has("src/features/content-observation/prepare-with-observation.server.ts"),
    false,
    "and no observed-preparation composition — reviewing is not preparing, and costs no quota",
  );

  const forbidden: readonly [RegExp, string][] = [
    [/^src\/features\/knowledge-crud\//, "the Knowledge writer"],
    [/^src\/features\/knowledge-ratification\//, "the ratification authority"],
    [/^src\/features\/action-execution\/.*\.server\./, "an execution module"],
    [/^src\/features\/heby-action-inlet\//, "the proposal inlet"],
    [/^src\/features\/heby-model-live\//, "the model transport"],
  ];
  for (const [pattern, what] of forbidden) {
    const hits = [...graph].filter((f) => pattern.test(f));
    assert.deepEqual(hits, [], `reading an artifact must not reach ${what}`);
  }

  /*
   * AND THE COMPONENTS CALL NOTHING BUT THE READ ACTIONS. Judged on the exact action names, so a
   * future import of the preparation action — the one export of that barrel that DOES reach a
   * provider — fails here rather than silently making a review spend YouTube quota.
   */
  for (const file of [SURFACE, WRAPPER]) {
    const code = codeOf(read(file));
    for (const banned of [
      "prepareWorkArtifact",
      "prepareContentDraftWithObservation",
      "observeChannelHandle",
      "readPublicChannelObservation",
      "provider-youtube",
      "content-observation",
    ]) {
      assert.equal(code.includes(banned), false, `${file} must not reach preparation ("${banned}")`);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. NOTHING WAS INVENTED — approval still does not exist in this repository.
 * ═════════════════════════════════════════════════════════════════════════ */
function noApprovalSemanticsArrived(): void {
  /*
   * THE STOP CONDITION, ASSERTED RATHER THAN ASSUMED. R3W states in code that an artifact has "no
   * approval field exists to set", its lifecycle is two states, and Governance's subject vocabulary
   * is closed at one entry that is not an artifact. This phase changed none of it — which is why it
   * shipped a rendered sentence and not a transition.
   */
  assert.deepEqual(
    [...WORK_ARTIFACT_LIFECYCLE_STATUSES],
    ["draft", "retired"],
    "the artifact lifecycle is still exactly two states — no `approved`, no `reviewed`",
  );
  assert.deepEqual(
    [...GOVERNANCE_SUBJECT_TYPES],
    ["knowledge_node", "work_artifact_revision"],
    "Governance still decides about exactly one subject type, and it is not a work artifact",
  );
  const contracts = codeOf(read("src/features/work-artifacts/contracts.ts"));
  for (const invented of ["approved", "reviewed", "rejectedAt", "reviewRecord"]) {
    assert.equal(
      new RegExp(`"${invented}"`).test(contracts),
      false,
      `no "${invented}" state was added to the artifact vocabulary`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. RUNTIME — the right tenant sees the author; another tenant sees nothing.
 * ═════════════════════════════════════════════════════════════════════════ */
async function main(): Promise<void> {
  theVocabularyNeverGuesses();
  theSurfaceRecordsNothing();
  reviewingObservesNothing();
  noApprovalSemanticsArrived();

  const harness = createDisposablePostgresHarness("hebun_rev1_authorship");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);

  try {
    const mine = (await seedLocalIdentity(setup, {
      companyName: "Turkish Rug House",
      companySlug: "trh-rev1",
      email: "director@trh.test",
    })) as Seeded;
    const theirs = (await seedLocalIdentity(setup, {
      companyName: "Other Org",
      companySlug: "other-rev1",
      email: "director@other.test",
    })) as Seeded;
    const owner = contextFor(mine, "rev1-owner");
    const stranger = contextFor(theirs, "rev1-stranger");

    const writeDeps = { getDb: () => handle.db } as never;
    const readDeps = { getDb: () => handle.db };
    const agentDeps = { getDb: () => handle.db } as never;

    const agent = await createDurableAgentIdentity(owner, { name: "Heby" }, agentDeps);
    assert.equal(agent.status, "established");

    /*
     * AUTHORSHIP IS RESOLVED THROUGH THE RELEASED SEAM, never hand-constructed. The writer verifies
     * the named agent belongs to this tenant and is in service, and refuses
     * `unverified-agent-authorship` otherwise — so a test that invented the pair would be testing a
     * path production cannot take.
     */
    const authorship = await resolveAgentAuthorship(owner, agentDeps);
    if (authorship.status !== "resolved") {
      throw new Error(`agent authorship must resolve: ${JSON.stringify(authorship)}`);
    }
    const agentAuthorship = authorship.authorship;

    /* One AGENT-authored draft — the case the surface could not distinguish before this phase. */
    const agentWritten = await createWorkArtifactFromHebyPreparation(
      owner,
      {
        artifactType: "content-draft",
        intendedDestination: "instagram",
        title: "Agent-written caption",
        content: "Three knots per centimetre.",
      },
      "operations",
      agentAuthorship,
      writeDeps,
    );
    assert.equal(agentWritten.status, "created", JSON.stringify(agentWritten));

    /* And one HUMAN-authored draft, so the distinction is measured and not assumed. */
    const humanWritten = await createWorkArtifact(
      owner,
      { artifactType: "message-draft", title: "Person-written note", content: "Written by hand." },
      "operations",
      writeDeps,
    );
    assert.equal(humanWritten.status, "created", JSON.stringify(humanWritten));

    /* ── 5a · THE CAPABILITY — the owner reads WHO wrote each revision ── */
    const agentHistory = await readWorkArtifactHistory(owner, agentWritten.artifactId, readDeps);
    assert.equal(agentHistory.length, 1);
    assert.equal(agentHistory[0]!.authoredByActorType, "agent", "the authority recorded the agent");
    assert.equal(
      workArtifactAuthorLabel(agentHistory[0]!.authoredByActorType),
      WORK_ARTIFACT_AUTHOR_LABELS.agent,
      "THE CAPABILITY — a reviewer is told a model wrote these bytes",
    );

    const humanHistory = await readWorkArtifactHistory(owner, humanWritten.artifactId, readDeps);
    assert.equal(
      workArtifactAuthorLabel(humanHistory[0]!.authoredByActorType),
      WORK_ARTIFACT_AUTHOR_LABELS.human,
      "…and told when a person did",
    );
    assert.notEqual(
      workArtifactAuthorLabel(agentHistory[0]!.authoredByActorType),
      workArtifactAuthorLabel(humanHistory[0]!.authoredByActorType),
      "the two read differently — which is the defect this phase removes",
    );

    /* THE STATUS COMES FROM THE AUTHORITY, not from the surface. */
    assert.equal(agentHistory[0]!.current, true, "currency is derived from the artifact's pointer");

    /* ── 5b · ANOTHER TENANT SEES NOTHING, AND CANNOT TELL THE ROW EXISTS ── */
    const foreign = await readWorkArtifactHistory(stranger, agentWritten.artifactId, readDeps);
    assert.deepEqual([...foreign], [], "a foreign artifact id resolves to nothing for another tenant");
    const invented = await readWorkArtifactHistory(
      owner,
      "00000000-0000-4000-8000-00000000dead",
      readDeps,
    );
    assert.deepEqual([...invented], [], "and so does an artifact that does not exist — fail closed");
    assert.deepEqual(
      [...foreign],
      [...invented],
      "the two are INDISTINGUISHABLE — an absent answer confirms no other tenant's row",
    );

    const strangerListing = await listWorkArtifacts(stranger, readDeps);
    assert.equal(strangerListing.status, "read");
    assert.deepEqual(
      strangerListing.status === "read" ? [...strangerListing.artifacts] : null,
      [],
      "the other tenant's listing is empty, not populated with ours",
    );

    /* ── 5c · READING MUTATES NOTHING ── */
    const snapshot = async () =>
      (
        await setup.query(
          `select id, artifact_lifecycle_status::text as st, current_revision, updated_at, version
             from work_artifacts order by created_at`,
        )
      ).rows;
    const before = await snapshot();
    const revisionsBefore = (
      await setup.query<{ n: number }>(`select count(*)::int as n from work_artifact_revisions`)
    ).rows[0]!.n;

    for (let i = 0; i < 5; i += 1) {
      await readWorkArtifactHistory(owner, agentWritten.artifactId, readDeps);
      await listWorkArtifacts(owner, readDeps);
    }

    assert.deepEqual(await snapshot(), before, "five reads changed no artifact row — not even a version");
    assert.equal(
      (await setup.query<{ n: number }>(`select count(*)::int as n from work_artifact_revisions`))
        .rows[0]!.n,
      revisionsBefore,
      "and appended no revision",
    );

    /* ── 5d · NOTHING ELSE WAS TOUCHED BY REVIEWING ── */
    for (const [table, expected] of [
      ["knowledge_nodes", 0],
      ["decision_records", 0],
      ["heby_action_requests", 0],
      ["action_execution_attempts", 0],
    ] as const) {
      const n = (await setup.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0]!
        .n;
      assert.equal(n, expected, `reviewing wrote nothing to ${table}`);
    }

    console.log("rev1-authorship-legibility/authorship-and-boundaries: all assertions passed");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
