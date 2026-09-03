/*
 * CGO-1 — CONTENT DRAFT PREPARATION, against a real PostgreSQL.
 *
 * The structural test proves the RULES are stated. This one proves the DATABASE enforces them: the
 * paired CHECKs bite, the destination survives a revision unchanged, tenant isolation still holds
 * for the new column, and preparing a content draft writes nothing outside its own two tables.
 *
 * Uses a disposable local database, dropped on exit. The canonical database is never opened.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import {
  createWorkArtifact,
  reviseWorkArtifact,
} from "../../src/features/work-artifacts/write-work-artifacts.server";
import { listWorkArtifacts } from "../../src/features/work-artifacts/read-work-artifacts.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-09-03T09:00:00.000Z");
const OWNER_WORKSPACE = "operations";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded): TenantContext {
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
    requestId: "cgo1-request",
    authenticatedAt: NOW.toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_cgo1_content_draft");
  await harness.createDatabase();
  /* Applies the REAL migration chain, migration 47 included. If 47 could not apply, this throws. */
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;
  const readDeps = { getDb: () => handle.db } as never;

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-cgo1",
      email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-cgo1",
      email: "other@globex.test",
    })) as Seeded;
    const acmeCtx = contextFor(acme);
    const globexCtx = contextFor(globex);

    /* ── 1. The migration reached the database, and the destination type is closed there too ── */
    const enumRows = await setup.query<{ enumlabel: string }>(
      `SELECT enumlabel FROM pg_enum e
         JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'content_destination' ORDER BY e.enumsortorder`,
    );
    assert.deepEqual(
      enumRows.rows.map((r) => r.enumlabel),
      ["instagram", "tiktok", "youtube"],
      "the destination vocabulary is closed IN THE DATABASE, not only in TypeScript",
    );

    /* ── 2. A content draft round-trips with its declared destination ── */
    const created = await createWorkArtifact(
      acmeCtx,
      {
        artifactType: "content-draft",
        title: "Reel caption — loom weaving",
        content: "Three knots per centimetre. That is the whole video.",
        intendedDestination: "instagram",
      },
      OWNER_WORKSPACE,
      deps,
    );
    assert.equal(created.status, "created", "a content draft with a destination is written");
    const artifactId = created.status === "created" ? created.artifactId : "";

    const listed = await listWorkArtifacts(acmeCtx, readDeps);
    assert.equal(listed.status, "read", "the register reads");
    const draft =
      listed.status === "read" ? listed.artifacts.find((a) => a.id === artifactId) : undefined;
    assert.ok(draft, "the content draft appears in its tenant's register");
    assert.equal(draft.artifactType, "content-draft", "the type survives the round trip");
    assert.equal(draft.intendedDestination, "instagram", "the destination survives the round trip");

    /* ── 3. Every OTHER artifact type reads back with a NULL destination ── */
    const plan = await createWorkArtifact(
      acmeCtx,
      { artifactType: "operational-plan", title: "Q4 plan", content: "Ship it." },
      OWNER_WORKSPACE,
      deps,
    );
    assert.equal(plan.status, "created", "an operational plan still writes with no destination");
    const planView =
      listed.status === "read"
        ? (await listWorkArtifacts(acmeCtx, readDeps))
        : listed;
    const planRow =
      planView.status === "read"
        ? planView.artifacts.find((a) => a.artifactType === "operational-plan")
        : undefined;
    assert.ok(planRow, "the plan is in the register");
    assert.equal(
      planRow.intendedDestination,
      null,
      "NULL means 'not a content draft' — never 'destination unknown'",
    );

    /* ── 4. THE DESTINATION SURVIVES A REVISION, UNCHANGED ──
     * Revising appends bytes. It must not touch, clear or rewrite the declared destination, or an
     * approval bound to an earlier revision would silently point somewhere else.
     */
    const revised = await reviseWorkArtifact(
      acmeCtx,
      { artifactId, content: "Four knots. Recount before filming." },
      deps,
    );
    assert.equal(revised.status, "revised", "a content draft revises like any artifact");
    const afterRevision = await listWorkArtifacts(acmeCtx, readDeps);
    const revisedRow =
      afterRevision.status === "read"
        ? afterRevision.artifacts.find((a) => a.id === artifactId)
        : undefined;
    assert.equal(revisedRow?.currentRevision, 2, "the revision advanced");
    assert.equal(
      revisedRow?.intendedDestination,
      "instagram",
      "the declared destination is untouched by a revision",
    );

    /* ── 5. THE PAIRED CHECKS BITE, in both directions, against hand-crafted SQL ──
     * The validator is bypassed deliberately: a rule that only the application enforces is a
     * convention, and the point of the CHECKs is that a direct INSERT cannot break the invariant.
     */
    await assert.rejects(
      () =>
        setup.query(
          `INSERT INTO work_artifacts
             (tenant_id, artifact_type, title, owner_workspace, current_revision, created_by, created_by_type)
           VALUES ($1,'content-draft','No destination','operations',1,$2,'human')`,
          [acme.tenantId, acme.userId],
        ),
      /work_artifacts_content_draft_destination_chk/,
      "a content draft WITHOUT a destination is refused by the database",
    );

    await assert.rejects(
      () =>
        setup.query(
          `INSERT INTO work_artifacts
             (tenant_id, artifact_type, title, owner_workspace, current_revision, created_by, created_by_type, intended_destination)
           VALUES ($1,'operational-plan','Plan with a destination','operations',1,$2,'human','tiktok')`,
          [acme.tenantId, acme.userId],
        ),
      /work_artifacts_non_content_destination_chk/,
      "a NON-content artifact WITH a destination is refused by the database",
    );

    /* ── 6. Tenant isolation holds for the new column too ── */
    const globexView = await listWorkArtifacts(globexCtx, readDeps);
    assert.equal(globexView.status, "read", "the other tenant reads its own register");
    assert.equal(
      globexView.status === "read" ? globexView.artifacts.length : -1,
      0,
      "another tenant sees no content draft and no destination of ours",
    );

    /* ── 7. PREPARING PUBLISHED NOTHING. No decision, no permit, no execution, no provider row ──
     * Counted rather than asserted in prose, because "nothing happened" is exactly the kind of
     * claim that rots into a comment.
     */
    for (const table of [
      "decision_records",
      "heby_action_requests",
      "action_execution_attempts",
      "integration_credentials",
    ]) {
      const { rows } = await setup.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM ${table}`,
      );
      assert.equal(
        rows[0]!.n,
        0,
        `preparing a content draft wrote no ${table} row: preparation is not an act`,
      );
    }
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }

  console.log("PASS cgo1 content draft (postgres)");
}

void main();
