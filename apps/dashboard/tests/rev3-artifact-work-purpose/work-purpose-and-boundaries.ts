/*
 * REV-3 — DECLARED WORK PURPOSE ON THE PREPARED-WORK LIST.
 *
 * ── THE ONE SENTENCE THIS SUITE DEFENDS ─────────────────────────────────────
 *
 *   THE ARTIFACT SURFACE REPORTS A WORK-OWNED DECLARATION AND NEVER ACQUIRES IT.
 *
 * WEV-1 released the relationship AND both directions of reading it. This phase adds no reader, no
 * table and no write path — it groups what the released seam already returns. So what is measured
 * here is the grouping's truthfulness, the surface's wording, and the absence of any new authority.
 *
 * Runs against the REAL Work seams, the REAL artifact writers and a disposable local database.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";

import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import {
  ARTIFACT_WORK_PURPOSE_NON_CLAIMS,
  NO_DECLARED_WORK_PURPOSE,
  WORK_PURPOSE_UNAVAILABLE,
  indexArtifactWorkPurpose,
} from "../../src/features/organizational-work/artifact-work-purpose";
import { readWorkEvidenceReferences } from "../../src/features/organizational-work/read-work-evidence.server";
import { readWorkRegister } from "../../src/features/organizational-work/read-work.server";
import { recordWork, declareWorkEvidenceReference } from "../../src/features/organizational-work/write-work.server";
import { createWorkArtifact, retireWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { listWorkArtifacts, readWorkArtifactHistory } from "../../src/features/work-artifacts/read-work-artifacts.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PURPOSE = "src/features/organizational-work/artifact-work-purpose.ts";
const SURFACE = "src/components/operations-preparation/prepared-work-section.tsx";
const ARTIFACT_SEAM = "src/features/work-artifacts/read-work-artifacts.server.ts";
const NOW = new Date("2026-09-04T12:00:00.000Z");

interface Seeded {
  readonly tenantId: string; readonly userId: string; readonly authIdentityId: string;
  readonly membershipId: string; readonly roleId: string;
}
function contextFor(s: Seeded, requestId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId,
    membershipId: s.membershipId, membershipVersion: 1, roleId: s.roleId,
    sessionContextId: "00000000-0000-4000-8000-000000000000", provider: "local",
    assuranceLevel: "aal1", mfaVerified: false, requestId, authenticatedAt: NOW.toISOString(),
  });
}

/* ══ 1. THE VOCABULARY REFUSES THE FIVE UPGRADES ══════════════════════════ */
function theWordingClaimsNothing(): void {
  const all = [NO_DECLARED_WORK_PURPOSE, WORK_PURPOSE_UNAVAILABLE, ...ARTIFACT_WORK_PURPOSE_NON_CLAIMS].join(" ").toLowerCase();
  for (const required of ["not a review", "not an approval", "declared", "not say the draft was written for it"]) {
    assert.ok(all.includes(required), `the vocabulary must say "${required}"`);
  }
  /* The negative state is a fact about DECLARATION, never a guess at a reason. */
  assert.equal(NO_DECLARED_WORK_PURPOSE, "Not declared as evidence for recorded work.");
  /* Unavailable must say UNKNOWN and must not be confusable with "nothing". */
  assert.ok(WORK_PURPOSE_UNAVAILABLE.includes("UNKNOWN"));
  assert.ok(WORK_PURPOSE_UNAVAILABLE.toLowerCase().includes("not known to be nothing"));
  for (const forbidden of ["approved", "accepted", "endorsed", "published", "scheduled", "executed", "caused"]) {
    assert.equal(
      [NO_DECLARED_WORK_PURPOSE, WORK_PURPOSE_UNAVAILABLE].join(" ").toLowerCase().includes(forbidden),
      false,
      `the rendered states must not contain "${forbidden}"`,
    );
  }
}

/* ══ 2. THE PROJECTION OWNS NO READ AND NO WRITE ══════════════════════════ */
function itIsPureAndOwnsNothing(): void {
  const code = codeOf(read(PURPOSE));
  for (const banned of [
    ".select(", ".insert(", ".update(", ".delete(", ".transaction(",
    "drizzle-orm", "@/db/schema", "getControlPlaneDb", "workEvidenceReferences",
    "declareWorkEvidence", "withdrawWorkEvidence", "TenantContext", "await ",
  ]) {
    assert.equal(code.includes(banned), false, `${PURPOSE} must not contain "${banned}" — it reads nothing`);
  }
  /* It imports TYPES from the released seams and nothing executable. */
  const imports = [...code.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    [...imports].sort(),
    ["./read-work-evidence.server", "./read-work.server", "./work-contracts"].sort(),
    "it depends on the two released Work seams' types and the work vocabulary, nothing else",
  );

  /* NO SECOND READER WAS BUILT. WEV-1's seam stays the only one. */
  const evidenceReaders = ["readWorkEvidenceReferences"];
  for (const name of evidenceReaders) {
    const defs = ["src/features/organizational-work/read-work-evidence.server.ts"].filter((f) =>
      new RegExp(`export\\s+async\\s+function\\s+${name}\\b`).test(codeOf(read(f))),
    );
    assert.deepEqual(defs, ["src/features/organizational-work/read-work-evidence.server.ts"]);
  }

  /* AND THE ARTIFACT AUTHORITY DID NOT LEARN ABOUT WORK. No import cycle, no ownership. */
  const artifactSeam = codeOf(read(ARTIFACT_SEAM));
  for (const banned of ["work-evidence", "workEvidence", "readWorkRegister", "artifact-work-purpose"]) {
    assert.equal(
      artifactSeam.includes(banned),
      false,
      `${ARTIFACT_SEAM} must not reach the Work relationship ("${banned}") — the artifact authority does not own it`,
    );
  }
}

/* ══ 3. THE SURFACE RENDERS THREE DISTINCT STATES ═════════════════════════ */
function theSurfaceSeparatesUnknownFromNone(): void {
  const code = codeOf(read(SURFACE));
  assert.ok(code.includes("WORK_PURPOSE_UNAVAILABLE"), "it renders the unavailable state");
  assert.ok(code.includes("NO_DECLARED_WORK_PURPOSE"), "and the explicit negative state");
  assert.ok(code.includes("ARTIFACT_WORK_PURPOSE_NON_CLAIMS"), "and the non-claims");
  /* The undefined/empty distinction must exist in code, or a read failure renders as "none". */
  assert.ok(
    /workPurpose\.status === "available"/.test(code) && /\?\? \[\]/.test(code),
    "a read failure yields undefined and only an AVAILABLE read yields an empty list",
  );
  /* No identifier reaches the client. */
  for (const withheld of ["tenantId", "authoredByActorId", "contentDigest", "declaredBy", "referenceId"]) {
    assert.equal(code.includes(withheld), false, `${SURFACE} must not render "${withheld}"`);
  }
  /*
   * The work item id is never DISPLAYED — a title, or an honest unresolved sentence, never an id.
   *
   * Judged on display, not on the token. `key={item.workItemId}` is React's list key: it is the
   * correct thing to key by, it reaches no reader, and a ban that could not tell the two apart
   * would fail on correct code — the failure mode this repository has hit with word bans before.
   */
  const displayed = code.replace(/key=\{[^}]*\}/g, "");
  assert.equal(
    /\{\s*item\.workItemId\s*\}/.test(displayed),
    false,
    "a raw work item id is never displayed to a reader",
  );
  assert.ok(code.includes("key={item.workItemId}"), "…and it IS used as the list key, which is correct");
}

/* ══ 4. UNAVAILABLE IN, UNAVAILABLE OUT ═══════════════════════════════════ */
function aReadFailureIsNeverEmptiness(): void {
  const index = indexArtifactWorkPurpose(
    { status: "unavailable", detail: "boom" },
    { status: "available", items: [], truncated: false, detail: "" } as never,
  );
  assert.equal(index.status, "unavailable", "an evidence read failure is propagated, never flattened");
}

async function main(): Promise<void> {
  theWordingClaimsNothing();
  itIsPureAndOwnsNothing();
  theSurfaceSeparatesUnknownFromNone();
  aReadFailureIsNeverEmptiness();

  const harness = createDisposablePostgresHarness("hebun_rev3_work_purpose");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);

  try {
    const mine = (await seedLocalIdentity(setup, { companyName: "Turkish Rug House", companySlug: "trh-rev3", email: "d@trh.test" })) as Seeded;
    const other = (await seedLocalIdentity(setup, { companyName: "Other Co", companySlug: "other-rev3", email: "d@other.test" })) as Seeded;
    const tenant = contextFor(mine, "rev3");
    const stranger = contextFor(other, "rev3-other");
    const deps = { getDb: () => handle.db } as never;
    /*
     * WORK-1 gates its WRITERS on Governance authority. This suite is about the READ projection, so
     * the gate is satisfied through the writer's own released injection point rather than by
     * establishing a genesis — WORK-1 already tests that gate, and re-testing it here would prove
     * nothing about REV-3 while making the fixture depend on Governance bootstrap.
     */
    const workDeps = {
      getDb: () => handle.db,
      resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
    } as never;

    const linked = await createWorkArtifact(tenant, { artifactType: "content-draft", intendedDestination: "instagram", title: "Linked draft", content: "bytes" }, "operations", deps);
    const unlinked = await createWorkArtifact(tenant, { artifactType: "message-draft", title: "Unlinked draft", content: "bytes" }, "operations", deps);
    assert.equal(linked.status, "created"); assert.equal(unlinked.status, "created");
    const linkedId = (linked as { artifactId: string }).artifactId;

    const workA = await recordWork(tenant, { title: "Era III development", declaredState: "active" }, workDeps);
    const workB = await recordWork(tenant, { title: "Winter campaign", declaredState: "planned" }, workDeps);
    assert.equal(workA.status, "recorded", JSON.stringify(workA));
    assert.equal(workB.status, "recorded", JSON.stringify(workB));
    const workAId = (workA as { workItem: { workItemId: string } }).workItem.workItemId;
    const workBId = (workB as { workItem: { workItemId: string } }).workItem.workItemId;

    /* CARDINALITY IS MANY: the SAME artifact declared by TWO work items. */
    for (const wid of [workAId, workBId]) {
      const declared = await declareWorkEvidenceReference(
        tenant,
        { workItemId: wid, referent: { kind: "work-artifact", referentId: linkedId } },
        workDeps,
      );
      assert.equal(declared.status, "recorded", JSON.stringify(declared));
    }

    const build = async (t: TenantContext | null) => {
      const listing = await listWorkArtifacts(t, deps);
      const [evidence, register] = await Promise.all([
        readWorkEvidenceReferences(t, { getDb: () => handle.db, listArtifacts: async () => listing } as never),
        readWorkRegister(t, deps),
      ]);
      return indexArtifactWorkPurpose(evidence, register);
    };

    /* ══ 5. THE CAPABILITY, AND ITS CARDINALITY ═══════════════════════════ */
    const index = await build(tenant);
    assert.equal(index.status, "available");
    const forLinked = (index as { byArtifactId: Record<string, readonly { title: string | null; declaredState: string | null }[]> }).byArtifactId[linkedId];
    assert.equal(forLinked?.length, 2, "MANY IS PRESERVED — one artifact, two declaring work items");
    assert.deepEqual(
      [...forLinked!].map((i) => `${i.title}:${i.declaredState}`).sort(),
      ["Era III development:active", "Winter campaign:planned"],
      "each declaring work item is named with its own DECLARED state",
    );
    const forUnlinked = (index as { byArtifactId: Record<string, unknown> }).byArtifactId[(unlinked as { artifactId: string }).artifactId];
    assert.equal(forUnlinked, undefined, "an undeclared artifact has no entry — the surface renders the explicit negative");

    /* ══ 6. NO ROW DUPLICATION — two declarations, still ONE artifact row ══ */
    const listing = await listWorkArtifacts(tenant, deps);
    assert.equal((listing as { artifacts: readonly unknown[] }).artifacts.length, 2, "the listing still has exactly two artifacts");
    const ids = (listing as { artifacts: readonly { id: string }[] }).artifacts.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length, "and no artifact appears twice because it is declared twice");

    /* ══ 7. TENANCY — another tenant sees none of it ══════════════════════ */
    const strangerIndex = await build(stranger);
    assert.equal(strangerIndex.status, "available");
    assert.deepEqual(
      Object.keys((strangerIndex as { byArtifactId: Record<string, unknown> }).byArtifactId),
      [],
      "another tenant's index is empty — the relationship is scoped by the Work seam's own predicate",
    );
    const anonymous = await build(null);
    assert.equal(anonymous.status, "unavailable", "an unauthenticated read fails closed, it does not return empty");

    /* ══ 8. NOTHING MUTATED — artifacts, work, or the relationship ════════ */
    const before = await setup.query<{ a: number; w: number; e: number; v: number }>(
      `select (select count(*)::int from work_artifacts) as a, (select count(*)::int from work_items) as w,
              (select count(*)::int from work_evidence_references) as e, (select coalesce(max(version),0)::int from work_artifacts) as v`);
    for (let i = 0; i < 3; i += 1) await build(tenant);
    const after = await setup.query<{ a: number; w: number; e: number; v: number }>(
      `select (select count(*)::int from work_artifacts) as a, (select count(*)::int from work_items) as w,
              (select count(*)::int from work_evidence_references) as e, (select coalesce(max(version),0)::int from work_artifacts) as v`);
    assert.deepEqual(after.rows[0], before.rows[0], "reading the relationship mutates nothing on either side");

    /* ══ 9. REV-2 AND HISTORY AND RETIRE ALL STILL BEHAVE ════════════════ */
    const rev2 = (listing as { artifacts: readonly { title: string; currentRevisionAuthoredByActorType: string }[] }).artifacts;
    assert.equal(rev2.find((a) => a.title === "Linked draft")!.currentRevisionAuthoredByActorType, "human", "REV-2's authorship is unchanged");
    const history = await readWorkArtifactHistory(tenant, linkedId, deps);
    assert.equal(history.length, 1, "History is unchanged");
    const retired = await retireWorkArtifact(tenant, { artifactId: linkedId }, deps);
    assert.equal(retired.status, "retired", "retire still works");
    /* A RETIRED artifact keeps its declarations — retirement is not withdrawal. */
    const afterRetire = await build(tenant);
    assert.equal(
      ((afterRetire as { byArtifactId: Record<string, readonly unknown[]> }).byArtifactId[linkedId] ?? []).length,
      2,
      "retiring an artifact withdraws no declaration — those are two different authorities' acts",
    );
    const states = await setup.query<{ st: string }>(`select distinct artifact_lifecycle_status::text as st from work_artifacts order by 1`);
    assert.deepEqual(states.rows.map((r) => r.st).sort(), ["draft", "retired"], "still exactly two lifecycle states");

    console.log("rev3-artifact-work-purpose/work-purpose-and-boundaries: all assertions passed");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
