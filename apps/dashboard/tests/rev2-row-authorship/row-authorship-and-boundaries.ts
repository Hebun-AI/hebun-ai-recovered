/*
 * REV-2 — ROW-LEVEL AUTHORSHIP. A reviewing human can see which prepared work a model wrote
 * WITHOUT opening each artifact's history.
 *
 * ── THE ONE SENTENCE THIS SUITE DEFENDS ─────────────────────────────────────
 *
 *   THE LISTING NAMES THE AUTHOR OF EACH ARTIFACT'S CURRENT REVISION, AND CLAIMS NOTHING ABOUT
 *   THE ARTIFACT, ITS HISTORY, OR ITS STANDING.
 *
 * REV-1 made authorship legible one revision at a time, behind History. The column, the writer and
 * the vocabulary are all released and are NOT re-tested here. What this phase changes is WHERE the
 * fact is legible, so reachability and truthfulness are what these assertions measure.
 *
 * Runs against the REAL read seam, the REAL writers and a disposable local database. No model, no
 * provider, no key, no network.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";

import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import {
  listWorkArtifacts,
  resolveWorkArtifactReference,
} from "../../src/features/work-artifacts/read-work-artifacts.server";
import { formatWorkArtifactRef } from "../../src/features/work-artifacts/artifact-ref";
import {
  createWorkArtifact,
  retireWorkArtifact,
  reviseWorkArtifact,
} from "../../src/features/work-artifacts/write-work-artifacts.server";
import { createWorkArtifactFromHebyPreparation } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { resolveAgentAuthorship } from "../../src/features/work-artifacts/agent-authorship.server";
import {
  WORK_ARTIFACT_AUTHOR_LABELS,
  WORK_ARTIFACT_AUTHOR_UNKNOWN,
  WORK_ARTIFACT_LIST_AUTHORSHIP_NON_CLAIM,
  workArtifactAuthorLabel,
} from "../../src/features/work-artifacts/contracts";
import { buildOriginationCandidates } from "../../src/features/agent-origination/candidate-set.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SURFACE = "src/components/operations-preparation/prepared-work-section.tsx";
const READ_SEAM = "src/features/work-artifacts/read-work-artifacts.server.ts";
const CANDIDATES = "src/features/agent-origination/candidate-set.server.ts";
const NOW = new Date("2026-09-04T10:00:00.000Z");

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
 * 1. THE CLAIM IS ABOUT A REVISION — asserted on the vocabulary, before any row.
 * ═════════════════════════════════════════════════════════════════════════ */
function theListNonClaimBoundsTheLabel(): void {
  const sentence = WORK_ARTIFACT_LIST_AUTHORSHIP_NON_CLAIM;
  for (const required of ["CURRENT revision only", "earlier", "History"]) {
    assert.ok(sentence.includes(required), `the list non-claim must say "${required}"`);
  }
  /* It must not turn authorship into standing — the risk REV-1 named and this surface inherits. */
  for (const forbidden of ["approv", "review", "endors", "verified", "correct", "publish"]) {
    assert.equal(
      sentence.toLowerCase().includes(forbidden),
      false,
      `the list non-claim must not mention "${forbidden}"`,
    );
  }
  /* REV-1's vocabulary is REUSED, not re-declared. A second table would be a second truth. */
  assert.equal(workArtifactAuthorLabel("agent"), WORK_ARTIFACT_AUTHOR_LABELS.agent);
  assert.equal(workArtifactAuthorLabel("human"), WORK_ARTIFACT_AUTHOR_LABELS.human);
  assert.equal(
    workArtifactAuthorLabel("something-new"),
    WORK_ARTIFACT_AUTHOR_UNKNOWN,
    "an unrecognised actor type says unknown",
  );
  assert.equal(
    workArtifactAuthorLabel(""),
    WORK_ARTIFACT_AUTHOR_UNKNOWN,
    "AND SO DOES AN UNRESOLVED REVISION — the empty string is the read seam's honest value, and it "
      + "must never render as a person",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE SURFACE RENDERS THE CLASSIFICATION AND NOT THE IDENTIFIER.
 * ═════════════════════════════════════════════════════════════════════════ */
function theSurfaceShowsAClassificationOnly(): void {
  const code = codeOf(read(SURFACE));
  assert.ok(
    code.includes("workArtifactAuthorLabel(artifact.currentRevisionAuthoredByActorType)"),
    "the row renders the current revision's author through the released vocabulary",
  );
  assert.ok(
    code.includes("WORK_ARTIFACT_LIST_AUTHORSHIP_NON_CLAIM"),
    "and the list states what that label is about",
  );
  /* REV-1's per-revision line is untouched — this phase adds a place, it does not move one. */
  assert.ok(
    code.includes("workArtifactAuthorLabel(revision.authoredByActorType)"),
    "History still names each revision's author",
  );
  /* The identifier stays withheld, in BOTH views. OPS-P1's boundary is unchanged. */
  for (const withheld of [
    "authoredByActorId",
    "contentDigest",
    "sourceMessageId",
    "artifact.tenantId",
    "revision.tenantId",
  ]) {
    assert.equal(code.includes(withheld), false, `${SURFACE} must not render "${withheld}"`);
  }
  /* The row must say WHICH revision it is talking about, or the label reads as the artifact's. */
  assert.ok(
    /revision \{artifact\.currentRevision\}/.test(code),
    "the authorship line names the revision it describes",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE READ SEAM STILL ONLY READS, AND THE JOIN CANNOT DROP A ROW.
 * ═════════════════════════════════════════════════════════════════════════ */
function theSeamStillOnlyReads(): void {
  const code = codeOf(read(READ_SEAM));
  for (const w of [".insert(", ".update(", ".delete(", ".transaction("]) {
    assert.equal(code.includes(w), false, `${READ_SEAM} must remain read-only ("${w}")`);
  }
  assert.ok(code.includes("leftJoin("), "the listing LEFT joins — an unresolved revision hides no work");
  assert.equal(
    /\.innerJoin\(/.test(code),
    false,
    "and never INNER joins, which would drop an artifact to protect a label",
  );
}

async function main(): Promise<void> {
  theListNonClaimBoundsTheLabel();
  theSurfaceShowsAClassificationOnly();
  theSeamStillOnlyReads();

  const harness = createDisposablePostgresHarness("hebun_rev2_row_authorship");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);

  try {
    const mine = (await seedLocalIdentity(setup, {
      companyName: "Turkish Rug House",
      companySlug: "trh-rev2",
      email: "director@trh.test",
    })) as Seeded;
    const other = (await seedLocalIdentity(setup, {
      companyName: "Other Co",
      companySlug: "other-rev2",
      email: "director@other.test",
    })) as Seeded;
    const tenant = contextFor(mine, "rev2");
    const stranger = contextFor(other, "rev2-other");
    const deps = { getDb: () => handle.db } as never;

    const established = await createDurableAgentIdentity(tenant, { name: "Heby" }, deps);
    assert.equal(established.status, "established");
    const authorship = await resolveAgentAuthorship(tenant, deps);
    assert.equal(authorship.status, "resolved", "the tenant has a durable agent to author with");

    /* ══ 4. A HUMAN DRAFT AND AN AGENT DRAFT, BOTH REAL, THROUGH REAL WRITERS ══ */
    const humanDraft = await createWorkArtifact(
      tenant,
      { artifactType: "message-draft", title: "Written by a person", content: "Human bytes." },
      "operations",
      deps,
    );
    assert.equal(humanDraft.status, "created", JSON.stringify(humanDraft));

    const agentDraft = await createWorkArtifactFromHebyPreparation(
      tenant,
      {
        artifactType: "content-draft",
        intendedDestination: "instagram",
        title: "Written by the agent",
        content: "Agent bytes.",
      },
      "operations",
      (authorship as { authorship: unknown }).authorship as never,
      deps,
    );
    assert.equal(agentDraft.status, "created", JSON.stringify(agentDraft));

    const listed = await listWorkArtifacts(tenant, deps);
    assert.equal(listed.status, "read");
    const byTitle = new Map(
      (listed as { artifacts: readonly { title: string; currentRevisionAuthoredByActorType: string; currentRevision: number }[] })
        .artifacts.map((a) => [a.title, a]),
    );

    assert.equal(
      byTitle.get("Written by a person")!.currentRevisionAuthoredByActorType,
      "human",
      "THE CAPABILITY — the listing names a human author without opening history",
    );
    assert.equal(
      byTitle.get("Written by the agent")!.currentRevisionAuthoredByActorType,
      "agent",
      "THE CAPABILITY — and names the agent one",
    );

    /* ══ 5. IT IS THE CURRENT REVISION'S AUTHOR, NOT THE ARTIFACT'S ═══════════
     *
     * The case production does not have yet and the field must survive: an agent-written draft a
     * PERSON then rewrites. The artifact has two authors and exactly one current one.
     */
    const revised = await reviseWorkArtifact(
      tenant,
      { artifactId: (agentDraft as { artifactId: string }).artifactId, content: "A person rewrote it." },
      deps,
    );
    assert.equal(revised.status, "revised", JSON.stringify(revised));

    const afterRevision = await listWorkArtifacts(tenant, deps);
    const mixed = (afterRevision as { artifacts: readonly { title: string; currentRevisionAuthoredByActorType: string; currentRevision: number }[] })
      .artifacts.find((a) => a.title === "Written by the agent")!;
    assert.equal(mixed.currentRevision, 2, "the artifact now has two revisions");
    assert.equal(
      mixed.currentRevisionAuthoredByActorType,
      "human",
      "THE TRUTH CLAIM — the row follows the CURRENT revision, so an agent draft a person rewrote "
        + "reads as person-written; the agent revision is still in history and is not erased",
    );

    /* And resolving the SUPERSEDED revision still reports the CURRENT author, never its own. */
    const supersededRef = formatWorkArtifactRef((agentDraft as { artifactId: string }).artifactId, 1);
    const resolved = await resolveWorkArtifactReference(tenant, supersededRef, deps);
    assert.equal(resolved.standing, "superseded", "revision 1 is superseded");
    assert.equal(
      resolved.revision!.authoredByActorType,
      "agent",
      "the resolved revision keeps its OWN author",
    );
    assert.equal(
      resolved.artifact!.currentRevisionAuthoredByActorType,
      "human",
      "…while the artifact view reports the CURRENT revision's author — a superseded author is "
        + "never silently promoted into a field contracted to mean 'current'",
    );

    /* ══ 6. TENANCY — another tenant sees none of it, by absence not by refusal ══ */
    const strangerList = await listWorkArtifacts(stranger, deps);
    assert.equal(strangerList.status, "read");
    assert.deepEqual(
      (strangerList as { artifacts: readonly unknown[] }).artifacts,
      [],
      "another tenant's listing is empty — authorship widened the projection, not the scope",
    );
    const strangerResolve = await resolveWorkArtifactReference(stranger, supersededRef, deps);
    assert.equal(strangerResolve.artifact, undefined, "and a foreign ref resolves to nothing");
    assert.equal(strangerResolve.revision, undefined);

    /* An unauthenticated read is unavailable, never an empty list presented as truth. */
    const anonymous = await listWorkArtifacts(null, deps);
    assert.equal(anonymous.status, "unavailable");

    /* ══ 7. READING RECORDS NOTHING — the whole surface is a read ═════════════ */
    const before = await setup.query<{ n: number; v: number; upd: number }>(
      `select count(*)::int as n, coalesce(max(version),0)::int as v,
              count(*) filter (where updated_at <> created_at)::int as upd from work_artifacts`,
    );
    for (let i = 0; i < 3; i += 1) await listWorkArtifacts(tenant, deps);
    await resolveWorkArtifactReference(tenant, supersededRef, deps);
    const after = await setup.query<{ n: number; v: number; upd: number }>(
      `select count(*)::int as n, coalesce(max(version),0)::int as v,
              count(*) filter (where updated_at <> created_at)::int as upd from work_artifacts`,
    );
    assert.deepEqual(after.rows[0], before.rows[0], "listing and resolving mutate nothing");

    /* ══ 8. RETIREMENT IS UNCHANGED — this phase adds no state and no transition ══ */
    const retiredResult = await retireWorkArtifact(
      tenant,
      { artifactId: (humanDraft as { artifactId: string }).artifactId },
      deps,
    );
    assert.equal(retiredResult.status, "retired");
    const states = await setup.query<{ st: string }>(
      `select distinct artifact_lifecycle_status::text as st from work_artifacts order by 1`,
    );
    assert.deepEqual(
      states.rows.map((r) => r.st).sort(),
      ["draft", "retired"],
      "still exactly two states — REV-2 introduced no approval, no review and no third status",
    );
    /* A retired artifact still reports its author: retirement is not an erasure. */
    const afterRetire = await listWorkArtifacts(tenant, deps);
    const retiredRow = (afterRetire as { artifacts: readonly { title: string; currentRevisionAuthoredByActorType: string }[] })
      .artifacts.find((a) => a.title === "Written by a person")!;
    assert.equal(retiredRow.currentRevisionAuthoredByActorType, "human");

    /* ══ 9. THE AGENT'S CANDIDATE SET GAINED NOTHING ══════════════════════════
     *
     * `candidate-set.server.ts` reads THIS seam and states that nothing but ref and label is
     * carried — "no digest, no id, no tenant, no actor". This phase put an ACTOR on the view it
     * reads, so that claim is now load-bearing in a way it was not before, and is asserted rather
     * than trusted.
     */
    const candidates = await buildOriginationCandidates(tenant, { artifacts: deps });
    const artifactCandidates = candidates.drafts as readonly object[];
    assert.ok(artifactCandidates.length > 0, "the agent has draft candidates to offer");
    for (const candidate of artifactCandidates) {
      assert.deepEqual(
        Object.keys(candidate as Record<string, unknown>).sort(),
        ["label", "ref"],
        "a candidate carries ref and label and NOTHING else — authorship did not reach the agent",
      );
    }
    const candidateCode = codeOf(read(CANDIDATES));
    assert.equal(
      candidateCode.includes("currentRevisionAuthoredByActorType"),
      false,
      "and the candidate builder never names the field",
    );

    console.log("rev2-row-authorship/row-authorship-and-boundaries: all assertions passed");
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
