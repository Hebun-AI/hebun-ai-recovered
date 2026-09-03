/*
 * CGO-2 — CONTENT DESTINATION GROUNDING. What Heby is handed, and what it can never conclude.
 *
 * CGO-1 recorded the destination and showed it to humans; Heby was handed the draft WITHOUT it, so
 * it could not answer "what have we prepared for Instagram?". This phase closes exactly that gap
 * and nothing else — no new authority, no schema, no provider, no write.
 *
 * The risk is one sentence being read as another. Everything here exists to make
 * "prepared for Instagram" → "connected to Instagram" fail a test rather than fail a customer.
 *
 * Uses a disposable local database, dropped on exit. The canonical database is never opened.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { createWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { resolveWorkArtifactSource } from "../../src/features/work-artifacts/work-artifact-evidence.server";
import { CONTENT_DESTINATION_LABELS } from "../../src/features/work-artifacts/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-09-03T13:00:00.000Z");
const OWNER_WORKSPACE = "operations";
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

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
    requestId: "cgo2-request",
    authenticatedAt: NOW.toISOString(),
  });
}

/**
 * THE DESTINATION IS READ, NEVER INFERRED. Asserted structurally as well as behaviourally: the
 * seam must select the durable column, and must not go looking in a title or a body for it.
 */
function destinationComesOnlyFromTheDurableField(): void {
  const seam = readFileSync(
    path.join(REPO_ROOT, "src/features/work-artifacts/work-artifact-evidence.server.ts"),
    "utf8",
  );
  assert.ok(
    seam.includes("intendedDestination: workArtifacts.intendedDestination"),
    "the seam selects the durable CGO-1 column",
  );
  const code = seam.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const inference of ["includes(\"instagram\")", "toLowerCase().includes", "match(/instagram"]) {
    assert.equal(
      code.includes(inference),
      false,
      `the destination must never be inferred from text (${inference})`,
    );
  }
  /* One vocabulary. The labels come from the released contract, never re-spelled here. */
  assert.ok(
    seam.includes("CONTENT_DESTINATION_LABELS"),
    "labels come from the released contract, not a second vocabulary",
  );
}

async function main(): Promise<void> {
  destinationComesOnlyFromTheDurableField();

  const harness = createDisposablePostgresHarness("hebun_cgo2_destination");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;
  const readDeps = { getDb: () => handle.db } as never;

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-cgo2",
      email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-cgo2",
      email: "other@globex.test",
    })) as Seeded;
    const acmeCtx = contextFor(acme);
    const globexCtx = contextFor(globex);

    /* ── 1. A content draft, and a NON-content artifact for contrast ── */
    const draft = await createWorkArtifact(
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
    assert.equal(draft.status, "created", "the content draft is written");

    const plan = await createWorkArtifact(
      acmeCtx,
      { artifactType: "operational-plan", title: "Q4 plan", content: "Ship it." },
      OWNER_WORKSPACE,
      deps,
    );
    assert.equal(plan.status, "created", "the plan is written");

    /* ── 2. HEBY IS HANDED THE DESTINATION ── */
    const resolved = await resolveWorkArtifactSource(acmeCtx, readDeps);
    assert.equal(resolved.state, "resolved", "the seam resolves");
    assert.equal(resolved.authoritative, false, "prepared work is never authoritative");

    const draftItem = resolved.items.find((i) => i.label === "Reel caption — loom weaving");
    assert.ok(draftItem, "the content draft is in the evidence set");
    assert.ok(
      draftItem.detail.includes(`prepared for: ${CONTENT_DESTINATION_LABELS.instagram}`),
      "Heby is told which destination it was prepared for — the gap CGO-2 exists to close",
    );

    /* ── 3. THE DENIAL TRAVELS WITH THE FACT, ADJACENTLY ──
     * Not merely present somewhere in the payload: immediately after the destination, so no
     * truncation or partial quotation can carry the fact without its limit.
     */
    const at = draftItem.detail.indexOf("prepared for:");
    const denialAt = draftItem.detail.indexOf("DECLARED ONLY");
    assert.ok(denialAt > at, "the denial follows the destination");
    assert.equal(
      draftItem.detail.slice(at, denialAt).split("·").length,
      2,
      "the denial is the NEXT segment — nothing may be inserted between the fact and its limit",
    );
    for (const required of ["no provider connection", "nothing is scheduled", "nothing was published"]) {
      assert.ok(draftItem.detail.includes(required), `the denial states "${required}"`);
    }

    /* ── 4. A NON-CONTENT ARTIFACT CARRIES NO DESTINATION, AND NO "none" EITHER ──
     * "destination: none" would read as a deliberate choice not to publish. Absence is the truth.
     */
    const planItem = resolved.items.find((i) => i.label === "Q4 plan");
    assert.ok(planItem, "the plan is in the evidence set");
    assert.equal(
      planItem.detail.includes("prepared for"),
      false,
      "an operational plan is handed no destination at all",
    );
    assert.equal(planItem.detail.includes("none"), false, 'and never the words "none"');

    /* ── 5. WHAT HEBY CANNOT CONCLUDE ──
     * The forbidden readings must be absent as CLAIMS. `scheduled` and `published` appear only
     * inside the denial, so judge the payload with the denial removed.
     */
    const payload = JSON.stringify(resolved);
    const withoutDenial = payload.replace(
      /destination is DECLARED ONLY[^"]*/g,
      "",
    );
    for (const forbidden of ["connected", "authorized", "delivered", "seen by", "posted"]) {
      assert.equal(
        withoutDenial.toLowerCase().includes(forbidden),
        false,
        `Heby must never be handed "${forbidden}" as a claim`,
      );
    }
    /* The two that only ever appear as denials. */
    for (const denied of ["scheduled", "published"]) {
      assert.equal(
        withoutDenial.toLowerCase().includes(denied),
        false,
        `"${denied}" appears ONLY inside the denial, never as a standing claim`,
      );
      assert.ok(payload.toLowerCase().includes(denied), `and the denial itself states "${denied}"`);
    }

    /* ── 6. TENANT ISOLATION — another tenant is handed no destination of ours ── */
    const other = await resolveWorkArtifactSource(globexCtx, readDeps);
    assert.equal(other.state, "unavailable", "the other tenant holds no prepared work");
    assert.equal(
      JSON.stringify(other).toLowerCase().includes("instagram"),
      false,
      "no destination of ours reaches another tenant",
    );

    /* ── 7. GROUNDING READ NOTHING ELSE INTO EXISTENCE ── */
    for (const table of ["decision_records", "heby_action_requests", "action_execution_attempts"]) {
      const { rows } = await setup.query<{ n: number }>(
        `select count(*)::int as n from ${table}`,
      );
      assert.equal(rows[0]!.n, 0, `resolving grounding wrote no ${table} row`);
    }
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }

  console.log("PASS cgo2 content destination grounding");
}

void main();
