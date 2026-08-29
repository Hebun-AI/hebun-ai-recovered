/*
 * L3 — ORGANIZATION AUTHORITY. WHAT IT ANSWERS, AND WHAT IT REFUSES TO INVENT.
 *
 * The read seam's whole value is the distinction between "this organization has nothing" and
 * "Hebun could not establish it". This suite drives every branch and proves that no failure path
 * produces an organization at all — not an empty one, not a zero-member one, not a nameless one.
 *
 * Pure: an injected database handle, no real Postgres, no network. Tenant isolation against a real
 * database is proved separately in `tenant-isolation-postgres.ts`, which is the only place that can
 * prove the SQL rather than the branch.
 */
import assert from "node:assert/strict";
import {
  ORGANIZATION_AUTHORITY_MODEL,
  ORGANIZATION_PROVENANCE_DETAIL,
  ORGANIZATION_STRUCTURE_UNAVAILABLE,
} from "../../src/features/organization-authority/contracts";
import { readOrganizationAuthority } from "../../src/features/organization-authority/read-organization.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = { tenantId: "tenant-l3", userId: "user-l3" } as unknown as TenantContext;

interface CompanyRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly lifecycleStatus: string;
  readonly tenantStatus: string | null;
  readonly provisioningSource: string | null;
}

/**
 * A database stand-in whose two selects answer in order: the company row, then the member count.
 * It records nothing and can express no write — the shape of the fake is itself part of the claim
 * that this seam only reads.
 */
function fakeDb(company: CompanyRow | null, memberCount: number, throwOn?: 1 | 2) {
  let call = 0;
  const chain = (rows: unknown[]) => {
    const thenable = {
      from: () => thenable,
      where: () => thenable,
      limit: () => Promise.resolve(rows),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
    };
    return thenable;
  };
  return {
    select: () => {
      call += 1;
      if (throwOn === call) throw new Error("read failed");
      return call === 1
        ? chain(company ? [company] : [])
        : chain([{ value: memberCount }]);
    },
  } as never;
}

const COMPANY: CompanyRow = {
  id: "tenant-l3",
  name: "Hebun Test Organization",
  slug: "hebun-test",
  lifecycleStatus: "active",
  tenantStatus: "active",
  provisioningSource: "production-operator-ceremony",
};

async function availableOrganizationIsRead(): Promise<void> {
  const read = await readOrganizationAuthority(TENANT, {
    getDb: () => fakeDb(COMPANY, 4),
  });
  assert.equal(read.status, "available");
  if (read.status !== "available") throw new Error("unreachable");

  assert.equal(read.organization.organizationId, "tenant-l3");
  assert.equal(read.organization.name, "Hebun Test Organization");
  assert.equal(read.organization.slug, "hebun-test");
  assert.equal(read.organization.lifecycleStatus, "active");
  assert.equal(read.organization.tenantStatus, "active");
  assert.equal(read.organization.humanMemberCount, 4);
  assert.equal(read.organization.provenance, "production-operator-ceremony");
  /*
   * The SENTENCE comes from the authority, not from the surface. G1's released guard forbids
   * application code from spelling the ceremony vocabulary, and a component holding its own
   * meaning map would be a second place deciding what a provisioning source means.
   */
  assert.equal(
    read.organization.provenanceDetail,
    ORGANIZATION_PROVENANCE_DETAIL["production-operator-ceremony"],
    "the origin sentence is resolved by the authority",
  );

  /* Structure is unavailable even on the happy path. It is a fact, not a failure mode. */
  assert.deepEqual(read.organization.structure, ORGANIZATION_STRUCTURE_UNAVAILABLE);
  assert.equal(read.organization.structure.status, "unavailable");

  /*
   * THE SEAM CARRIES NO AUTHORITY VOCABULARY. Asserted on the serialized value rather than field by
   * field, so a field ADDED later is caught too. This is the SEC-2 gate expressed as a shape.
   */
  const json = JSON.stringify(read).toLowerCase();
  for (const banned of ["role", "permission", "authorityscope", "authorityrank", "credential", "token", "policy"]) {
    assert.ok(!json.includes(banned), `the organization read must not carry "${banned}"`);
  }
}

async function everyUnavailableReasonIsItsOwnAnswer(): Promise<void> {
  const cases: ReadonlyArray<{
    readonly label: string;
    readonly reason: string;
    readonly run: () => Promise<Awaited<ReturnType<typeof readOrganizationAuthority>>>;
  }> = [
    {
      label: "no authorized tenant context",
      reason: "no-tenant",
      run: () => readOrganizationAuthority(null, { getDb: () => fakeDb(COMPANY, 4) }),
    },
    {
      label: "a blank tenant id is not a tenant",
      reason: "no-tenant",
      run: () =>
        readOrganizationAuthority({ tenantId: "   ", userId: "u" } as unknown as TenantContext, {
          getDb: () => fakeDb(COMPANY, 4),
        }),
    },
    {
      label: "no durable persistence",
      reason: "persistence-not-configured",
      run: () => readOrganizationAuthority(TENANT, { getDb: () => null }),
    },
    {
      label: "the session names a tenant with no live row",
      reason: "organization-not-found",
      run: () => readOrganizationAuthority(TENANT, { getDb: () => fakeDb(null, 0) }),
    },
    {
      label: "the company read threw",
      reason: "read-failed",
      run: () => readOrganizationAuthority(TENANT, { getDb: () => fakeDb(COMPANY, 4, 1) }),
    },
    {
      label: "the member count read threw",
      reason: "read-failed",
      run: () => readOrganizationAuthority(TENANT, { getDb: () => fakeDb(COMPANY, 4, 2) }),
    },
  ];

  const seen = new Set<string>();
  for (const scenario of cases) {
    const read = await scenario.run();
    assert.equal(read.status, "unavailable", `${scenario.label}: must be unavailable`);
    if (read.status !== "unavailable") throw new Error("unreachable");
    assert.equal(read.reason, scenario.reason, scenario.label);

    /*
     * THE POINT OF THE MILESTONE. No failure may carry an organization at all — an empty name, a
     * zero member count or an empty structure list would each read as "this organization is empty".
     */
    assert.ok(
      !Object.prototype.hasOwnProperty.call(read, "organization"),
      `${scenario.label}: an unavailable read must carry no organization`,
    );
    seen.add(read.reason);
  }

  /* Every declared reason is actually reachable, so none of the branches above is dead. */
  assert.deepEqual(
    [...seen].sort(),
    ["no-tenant", "organization-not-found", "persistence-not-configured", "read-failed"],
    "every unavailable reason is reachable",
  );
}

async function provenanceIsTranslatedNeverGuessed(): Promise<void> {
  const expected: ReadonlyArray<readonly [string | null, string]> = [
    ["local-operator-ceremony", "local-operator-ceremony"],
    ["production-operator-ceremony", "production-operator-ceremony"],
    [null, "unrecorded"],
    /*
     * The released CHECK makes this unrepresentable in a healthy database. It is still mapped to
     * `unrecorded` rather than passed through: a value this seam does not recognize is a value it
     * cannot vouch for, and echoing it would let a future column widening become a silent claim.
     */
    ["imported-from-provider", "unrecorded"],
  ];

  for (const [column, provenance] of expected) {
    const read = await readOrganizationAuthority(TENANT, {
      getDb: () => fakeDb({ ...COMPANY, provisioningSource: column }, 1),
    });
    assert.equal(read.status, "available");
    if (read.status !== "available") throw new Error("unreachable");
    assert.equal(read.organization.provenance, provenance, `provisioning_source ${String(column)}`);
    assert.equal(
      read.organization.provenanceDetail,
      ORGANIZATION_PROVENANCE_DETAIL[provenance as keyof typeof ORGANIZATION_PROVENANCE_DETAIL],
      `provisioning_source ${String(column)}: its sentence travels with it`,
    );
  }
}

function theModelStatesWhatWasMeasured(): void {
  assert.equal(ORGANIZATION_AUTHORITY_MODEL.writerCreated, false);
  assert.equal(ORGANIZATION_AUTHORITY_MODEL.schemaChanged, false);
  assert.equal(ORGANIZATION_AUTHORITY_MODEL.structuralAuthorityExists, false);
  /* The SEC-2 entry gate answer, readable by a machine and not only by a reviewer. */
  assert.equal(ORGANIZATION_AUTHORITY_MODEL.rolesCarryPermissions, false);
  assert.equal(ORGANIZATION_AUTHORITY_MODEL.permissionRuntimeConnected, false);
  assert.ok(Object.isFrozen(ORGANIZATION_AUTHORITY_MODEL));
  assert.ok(Object.isFrozen(ORGANIZATION_STRUCTURE_UNAVAILABLE));
  assert.ok(Object.isFrozen(ORGANIZATION_PROVENANCE_DETAIL));
  /* Every provenance value has a sentence — an origin with no meaning would render as blank. */
  assert.deepEqual(
    Object.keys(ORGANIZATION_PROVENANCE_DETAIL).sort(),
    ["local-operator-ceremony", "production-operator-ceremony", "unrecorded"],
    "every provenance value carries its own sentence",
  );
}

async function main(): Promise<void> {
  await availableOrganizationIsRead();
  await everyUnavailableReasonIsItsOwnAnswer();
  await provenanceIsTranslatedNeverGuessed();
  theModelStatesWhatWasMeasured();
  console.log("l3 organization authority — truth checks passed");
}

void main();
