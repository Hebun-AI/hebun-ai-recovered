/*
 * I1 CONNECTION AUTHORITY — THE CAPABILITY-AVAILABILITY SEAM.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The seam reports the truth about this deployment — nothing is connectable — and, when a
 *    connectable definition IS injected, a connection can only become `available` by being
 *    `connected` with covering scopes, which I1 has no way to produce."
 *
 * ── WHY A FIXTURE CATALOG IS INJECTED ────────────────────────────────────────
 *
 * The RELEASED catalog contains zero `connectable` entries, so against production data this seam
 * returns `no-connectable-provider` and nothing else — which is correct, and which would leave the
 * whole mapping untested. Injecting a catalog exercises the classification the day a real provider
 * arrives, WITHOUT a real provider existing now.
 *
 * ── WHY THE `connected` ROWS ARE WRITTEN DIRECTLY ────────────────────────────
 *
 * Every row here that is not `draft` is a FIXTURE, inserted by raw SQL and labelled as such. The
 * repository cannot produce those states — `tenant-isolation-postgres` proves that separately — so
 * constructing them by hand is the only way to test what the seam does with them, and it is never
 * a claim that a runtime reached them.
 *
 * Disposable database, dropped on exit. Canonical is never opened.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { getCapabilityAvailability } from "../../src/features/integration-authority/capability-availability.server";
import { createConnection } from "../../src/features/integration-authority/integration-repository.server";
import { PROVIDER_CATALOG } from "../../src/features/provider-catalog/catalog";
import type {
  CapabilityAvailabilityView,
  ConnectionDefinition,
  ProviderCatalog,
} from "../../src/features/integration-authority/contracts";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = "10000000-0000-4000-8000-00000000c001";
const OTHER = "10000000-0000-4000-8000-00000000d001";
const ACTOR = "20000000-0000-4000-8000-00000000c002";
const NOW = new Date("2026-08-22T12:00:00.000Z");

const CAPABILITY = "test.capability";
const PROVIDER = "test-connectable";

/** TEST-ONLY. See the header — the released catalog has no `connectable` entry. */
const CONNECTABLE_CATALOG: ProviderCatalog = Object.freeze([
  Object.freeze({
    providerKey: PROVIDER,
    label: "Test Connectable Provider (test fixture only)",
    authMethod: "oauth2",
    accountIdentity: "workspace",
    connectivity: "connectable",
    minimumScopes: Object.freeze(["test.read"]),
    capabilityScopes: Object.freeze({
      [CAPABILITY]: Object.freeze({
        read: Object.freeze(["test.read"]),
        write: Object.freeze(["test.write"]),
      }),
    }),
  }) satisfies ConnectionDefinition,
]);

/**
 * TEST-ONLY. A `fixture` definition, declared HERE rather than read out of the released catalog,
 * because the released catalog is empty — see `catalog.ts`. The proof that a fixture reaches no
 * surface is a proof about the seam's filter, so the seam's own test owns the input.
 */
const FIXTURE_ONLY_CATALOG: ProviderCatalog = Object.freeze([
  Object.freeze({
    providerKey: "test-fixture-only",
    label: "Test Fixture Provider (not a real provider, and not connectable)",
    authMethod: "api_key",
    accountIdentity: "account",
    connectivity: "fixture",
    minimumScopes: Object.freeze(["fixture.read"]),
    capabilityScopes: Object.freeze({
      "fixture.capability": Object.freeze({
        read: Object.freeze(["fixture.read"]),
        write: Object.freeze(["fixture.write"]),
      }),
    }),
  }) satisfies ConnectionDefinition,
]);

function tenantOf(tenantId: string): TenantContext {
  return { tenantId, userId: ACTOR, requestId: "test-request" } as TenantContext;
}

function entry(view: CapabilityAvailabilityView, capability: string) {
  const found = view.capabilities.find((c) => c.capability === capability);
  assert.ok(found, `expected an entry for "${capability}"`);
  return found;
}

/** A FIXTURE row in a state the repository cannot produce. Raw SQL, on purpose. */
async function seedFixtureConnection(
  client: Client,
  row: {
    id: string;
    tenantId: string;
    state: string;
    scopes: readonly string[];
    accountId?: string | null;
    label?: string | null;
    /**
     * Overrides the health a real writer would pair with this state. Used ONLY to isolate the
     * lifecycle term — see section 4, where a non-`connected` row is given `healthy` so that the
     * lifecycle is the single remaining thing standing between it and `available`.
     */
    health?: string;
  },
): Promise<void> {
  /*
   * `health` is written ALONGSIDE the state, never left at its default, because a successful
   * verification persists `connected` and `healthy` TOGETHER. A `connected` fixture at `unknown`
   * would be a row no verifier could ever produce, and every assertion resting on it would be
   * about an impossible state.
   */
  await client.query(
    `insert into integrations
       (id, tenant_id, name, provider_key, connection_state, health, scopes, external_account_id,
        external_account_label, last_verified_at)
     values ($1,$2,'fixture connection',$3,$4,$5,$6::jsonb,$7,$8,$9)`,
    [
      row.id,
      row.tenantId,
      PROVIDER,
      row.state,
      row.health ?? (row.state === "connected" ? "healthy" : "unknown"),
      JSON.stringify([...row.scopes]),
      row.accountId ?? null,
      row.label ?? null,
      row.state === "connected" ? NOW : null,
    ],
  );
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_i1_availability");
  await harness.createDatabase();
  harness.migrateDatabase();

  const client = new Client({ connectionString: harness.dbUrl });
  await client.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const db = handle.db;
  const getDb = () => db;

  try {
    await client.query(`insert into companies (id, name, slug) values ($1,$2,$3), ($4,$5,$6)`, [
      TENANT,
      "Acme",
      "acme-avail",
      OTHER,
      "Globex",
      "globex-avail",
    ]);
    const tenant = tenantOf(TENANT);

    /* ── 1. THE RELEASED CATALOG: NOTHING IS CONNECTABLE, AND IT SAYS SO ─────── */
    {
      /*
       * AMENDED BY INT-3. Through INT-1 and INT-2 the released catalog was EMPTY and this asserted
       * `no-connectable-provider` — the honest state of a deployment with no credential store and
       * no verifier. INT-3 built both and added `google-workspace`, so the deployment IS now
       * catalog-ready.
       *
       * The half that did NOT change is the one worth keeping: Google grants identity only, maps
       * no capability, and therefore still offers NOTHING to read. An empty capability list under
       * `catalog-ready` is the truthful shape, and it is asserted rather than assumed.
       */
      const view = await getCapabilityAvailability(tenant, { getDb });
      assert.equal(
        view.readiness,
        "catalog-ready",
        "a real connectable provider exists after INT-3",
      );
/*
       * ── AMENDED BY INT-4 ────────────────────────────────────────────────
       *
       * This pinned the capability list EMPTY because INT-3 requested no scope that reads
       * anything. INT-4 adds the Drive metadata read, so exactly one capability is mapped — and
       * the assertion becomes the stronger one: it is that capability, and for a connection with
       * identity-only scopes it is NOT available. A connection is not a data capability.
       */
      assert.deepEqual(
        view.capabilities.map((c) => c.capability),
        ["google.drive.metadata.read"],
        "INT-4 maps exactly one capability",
      );
      assert.notEqual(
        view.capabilities[0]!.state,
        "available",
        "and an identity-only grant does NOT make it available",
      );
      assert.equal(
        PROVIDER_CATALOG.length,
        1,
        "exactly one released provider: the one with a real implementation behind it",
      );
      assert.equal(PROVIDER_CATALOG[0]!.providerKey, "google-workspace");
    }

    /* ── 2. A FIXTURE CATALOG ENTRY REACHES NO SURFACE ───────────────────────── */
    {
      const view = await getCapabilityAvailability(tenant, {
        getDb,
        catalog: FIXTURE_ONLY_CATALOG,
      });
      assert.equal(
        view.readiness,
        "no-connectable-provider",
        "a `fixture` definition contributes nothing — it can never be presented as a provider",
      );
      assert.deepEqual(view.capabilities, []);
    }

    /* ── 3. NO CONNECTION AT ALL → not-connected, WITH A REASON ──────────────── */
    {
      const view = await getCapabilityAvailability(tenant, {
        getDb,
        catalog: CONNECTABLE_CATALOG,
      });
      assert.equal(view.readiness, "catalog-ready");
      const capability = entry(view, CAPABILITY);
      assert.equal(capability.state, "not-connected");
      assert.ok(capability.reason, "a state that is not `available` always carries a reason");
      assert.deepEqual(capability.sources, []);
    }

    /* ── 4. A DRAFT CONNECTION IS NEVER `available` ──────────────────────────── */
    {
      const created = await createConnection(
        tenant,
        { providerKey: PROVIDER, name: "Acme connection" },
        { getDb, now: () => NOW, catalog: CONNECTABLE_CATALOG },
      );
      assert.ok(created.status === "created");
      assert.equal(created.connection.connectionState, "draft");

      const view = await getCapabilityAvailability(tenant, {
        getDb,
        catalog: CONNECTABLE_CATALOG,
      });
      const capability = entry(view, CAPABILITY);
      assert.equal(
        capability.state,
        "unverified",
        "a connection Hebun created exists but was never verified — and is NOT `not-connected`, " +
          "because a tenant who recorded something deserves to be told it was never confirmed",
      );
      assert.notEqual(capability.state, "available");
      assert.equal(capability.sources.length, 1);
      assert.equal(capability.sources[0]!.readAvailable, false, "a draft can never be read from");
      assert.equal(capability.sources[0]!.writeCapable, false);
      assert.equal(capability.sources[0]!.lastVerifiedAt, null);

      /*
       * ── THE LIFECYCLE CHECK IS LOAD-BEARING, NOT INCIDENTAL ─────────────────
       *
       * The connection above has NO scopes, so `available` was blocked by the scope check and the
       * lifecycle check was never exercised — a bite-proof caught exactly that: forcing
       * `isConnected = true` left this section green, so it was passing for the wrong reason.
       *
       * These two FIXTURE rows carry scopes that FULLY cover the capability AND `healthy` health.
       * The only thing standing between them and `available` is that they are not `connected` —
       * which is what makes this section a test of the LIFECYCLE term and not of the other two.
       * Leaving them at the `unknown` a real writer would pair with these states made the section
       * pass for the wrong reason again: a bite-proof that deletes the lifecycle check stayed
       * green, because the health check was doing the work.
       */
      for (const [id, state] of [
        ["70000000-0000-4000-8000-0000000000d1", "draft"],
        ["70000000-0000-4000-8000-0000000000d2", "unverified"],
      ] as const) {
        await seedFixtureConnection(client, {
          id,
          tenantId: TENANT,
          state,
          health: "healthy",
          scopes: ["test.read", "test.write"],
          accountId: `acct-${state}`,
          label: `${state} fixture`,
        });

        const covered = await getCapabilityAvailability(tenant, {
          getDb,
          catalog: CONNECTABLE_CATALOG,
        });
        const entryForState = entry(covered, CAPABILITY);
        assert.notEqual(
          entryForState.state,
          "available",
          `a "${state}" connection with HEALTHY health and FULLY COVERING scopes must still ` +
            `never be available`,
        );
        const seeded = entryForState.sources.find((source) => source.integrationId === id);
        assert.ok(seeded, `the "${state}" fixture must appear as a source`);
        assert.equal(
          seeded.readAvailable,
          false,
          `"${state}" + healthy + covering scopes must NOT be readable — only \`connected\` may be`,
        );
        assert.equal(
          seeded.writeCapable,
          false,
          `"${state}" + healthy + covering scopes must NOT be write-capable`,
        );

        await client.query(`delete from integrations where id = $1`, [id]);
      }

      /* THE FIREWALL, MEASURED ON THE OBJECT: capability is never authorization. */
      for (const forbidden of [
        "writeAuthorized",
        "permit",
        "permitId",
        "authorized",
        "token",
        "credential",
        "secret",
      ]) {
        assert.ok(
          !(forbidden in (capability.sources[0]! as unknown as Record<string, unknown>)),
          `CapabilitySource must not carry "${forbidden}"`,
        );
      }
    }

    /* ── 5. FIXTURE `connected` + COVERING SCOPES → available ────────────────── */
    {
      await seedFixtureConnection(client, {
        id: "70000000-0000-4000-8000-000000000001",
        tenantId: TENANT,
        state: "connected",
        scopes: ["test.read"],
        accountId: "acct-covering",
        label: "Acme Workspace",
      });

      const view = await getCapabilityAvailability(tenant, {
        getDb,
        catalog: CONNECTABLE_CATALOG,
      });
      const capability = entry(view, CAPABILITY);
      assert.equal(capability.state, "available");
      assert.equal(capability.reason, null, "`available` is the one state with no reason");

      const usable = capability.sources.find((s) => s.readAvailable);
      assert.ok(usable, "the connected fixture is the source");
      assert.equal(usable.accountLabel, "Acme Workspace");
      assert.equal(
        usable.writeCapable,
        false,
        "READ SCOPES DO NOT CONFER WRITE — `test.write` was never granted",
      );
    }

    /* ── 6. WRITE-CAPABLE IS DERIVED FROM SCOPES, AND IS NOT AUTHORIZATION ───── */
    {
      await client.query(
        `update integrations set scopes = '["test.read","test.write"]'::jsonb where id = $1`,
        ["70000000-0000-4000-8000-000000000001"],
      );
      const view = await getCapabilityAvailability(tenant, {
        getDb,
        catalog: CONNECTABLE_CATALOG,
      });
      const source = entry(view, CAPABILITY).sources.find((s) => s.readAvailable);
      assert.ok(source);
      assert.equal(
        source.writeCapable,
        true,
        "write capability follows the GRANTED scope set, recomputed on every read",
      );
      /*
       * And it is still not permission. The whole view is searched for anything a consumer could
       * mistake for one.
       */
      assert.ok(
        !JSON.stringify(view).toLowerCase().includes("authoriz"),
        "no part of the availability view may mention authorization",
      );
    }

    /* ── 7. SCOPES BELOW THE CAPABILITY → degraded, NOT available ────────────── */
    {
      await client.query(
        `update integrations set scopes = '["test.unrelated"]'::jsonb where id = $1`,
        ["70000000-0000-4000-8000-000000000001"],
      );
      const view = await getCapabilityAvailability(tenant, {
        getDb,
        catalog: CONNECTABLE_CATALOG,
      });
      const capability = entry(view, CAPABILITY);
      assert.equal(
        capability.state,
        "degraded",
        "connected, but the grant does not cover this capability",
      );
      assert.ok(capability.reason);
      assert.ok(capability.sources.every((s) => !s.readAvailable));
    }

    /* ── 8. HEALTH DEGRADES AVAILABILITY AND NEVER MOVES THE LIFECYCLE ───────── */
    {
      const ID = "70000000-0000-4000-8000-000000000001";

      /* Scopes fully cover the capability again, so health is the ONLY variable in this section. */
      await client.query(`update integrations set scopes = '["test.read","test.write"]'::jsonb where id = $1`, [ID]);

      /* 8a. HEALTHY — the ONE spelling of available. Everything below differs by one column. */
      await client.query(`update integrations set health = 'healthy' where id = $1`, [ID]);
      assert.equal(
        entry(
          await getCapabilityAvailability(tenant, { getDb, catalog: CONNECTABLE_CATALOG }),
          CAPABILITY,
        ).state,
        "available",
        "connected + healthy + covering scopes is the ONE combination that is available",
      );

      /* 8b. IMPAIRED HEALTH — degraded, with the lifecycle untouched underneath. */
      for (const health of ["unreachable", "degraded"] as const) {
        await client.query(`update integrations set health = $2 where id = $1`, [ID, health]);

        const view = await getCapabilityAvailability(tenant, {
          getDb,
          catalog: CONNECTABLE_CATALOG,
        });
        const capability = entry(view, CAPABILITY);

        assert.notEqual(
          capability.state,
          "available",
          `a "${health}" provider cannot be presently answered from — availability is USABILITY`,
        );
        assert.equal(
          capability.state,
          "degraded",
          `"${health}" health degrades the capability; it does not revoke or unverify it`,
        );
        assert.match(
          capability.reason ?? "",
          /not currently responding/i,
          "and the reason names the OUTAGE, not a scope gap the tenant would try to fix",
        );
        assert.match(
          capability.reason ?? "",
          /grant is unaffected/i,
          "a transient outage must never read as 'reconnect this'",
        );

        /* THE SOURCE AGREES WITH THE STATE. A `readAvailable: true` inside a degraded view would
         * be the same bug one layer down. */
        const source = capability.sources.find((s) => s.integrationId === ID);
        assert.ok(source, "the connection is still listed as a source — it is still connected");
        assert.equal(source.readAvailable, false, `"${health}" cannot be read from right now`);
        assert.equal(source.writeCapable, false, `"${health}" cannot be written to right now`);

        /* THE LIFECYCLE ROW ITSELF. Measured on the column, not inferred from the view. */
        const row = await client.query<{ connection_state: string; health: string }>(
          `select connection_state, health from integrations where id = $1`,
          [ID],
        );
        assert.equal(
          row.rows[0]!.connection_state,
          "connected",
          "a provider outage is NOT a revocation — the tenant's grant is untouched on disk",
        );
        assert.equal(row.rows[0]!.health, health, "and the health column is the only thing that moved");
      }

      /* 8c. THE OUTAGE CLEARS AND THE CAPABILITY RETURNS, WITH NO RECONNECTION. */
      await client.query(`update integrations set health = 'healthy' where id = $1`, [ID]);
      assert.equal(
        entry(
          await getCapabilityAvailability(tenant, { getDb, catalog: CONNECTABLE_CATALOG }),
          CAPABILITY,
        ).state,
        "available",
        "the grant survived the outage, so availability returns on its own",
      );

      /*
       * 8d. `unknown` HEALTH IS NOT AVAILABILITY EITHER — the evidence is MISSING, not negative.
       *
       * A successful verification persists `connected` AND `healthy` together, so a `connected` row
       * sitting at `unknown` is not a freshly-verified connection: it is one Hebun holds no usable
       * health observation for. Claiming availability from no observation is the same untruth as
       * claiming it from a failed one.
       */
      await client.query(`update integrations set health = 'unknown' where id = $1`, [ID]);
      {
        const view = await getCapabilityAvailability(tenant, {
          getDb,
          catalog: CONNECTABLE_CATALOG,
        });
        const capability = entry(view, CAPABILITY);

        assert.notEqual(
          capability.state,
          "available",
          "`unknown` health cannot support an availability claim — there is no observation behind it",
        );
        assert.equal(capability.state, "degraded");
        assert.match(
          capability.reason ?? "",
          /health has not been established/i,
          "and the reason says the observation is MISSING, not that an attempt failed",
        );
        assert.ok(
          !/not currently responding/i.test(capability.reason ?? ""),
          "an unobserved provider must never be reported as one that failed to respond",
        );
        assert.match(
          capability.reason ?? "",
          /grant is unaffected/i,
          "a missing observation is not a reason to reconnect",
        );

        const source = capability.sources.find((s) => s.integrationId === ID);
        assert.ok(source, "the connection is still a listed source — it is still connected");
        assert.equal(source.readAvailable, false, "`unknown` cannot be read from right now");
        assert.equal(source.writeCapable, false, "`unknown` cannot be written to right now");

        /* AND THE LIFECYCLE IS UNTOUCHED. Health being unknown revokes nothing. */
        const row = await client.query<{ connection_state: string; health: string }>(
          `select connection_state, health from integrations where id = $1`,
          [ID],
        );
        assert.equal(
          row.rows[0]!.connection_state,
          "connected",
          "an unestablished health observation is NOT a revocation — the grant is intact on disk",
        );
        assert.equal(row.rows[0]!.health, "unknown");
      }

      /* And it clears the moment an observation exists, with no reconnection. */
      await client.query(`update integrations set health = 'healthy' where id = $1`, [ID]);
      assert.equal(
        entry(
          await getCapabilityAvailability(tenant, { getDb, catalog: CONNECTABLE_CATALOG }),
          CAPABILITY,
        ).state,
        "available",
        "a health observation is all that was missing — nothing was re-granted",
      );

      /* 8e. THE SCOPE GAP OUTRANKS THE HEALTH GAP, because only one of them persists. */
      await client.query(
        `update integrations set scopes = '["test.unrelated"]'::jsonb, health = 'unreachable' where id = $1`,
        [ID],
      );
      const both = entry(
        await getCapabilityAvailability(tenant, { getDb, catalog: CONNECTABLE_CATALOG }),
        CAPABILITY,
      );
      assert.equal(both.state, "degraded");
      assert.match(
        both.reason ?? "",
        /does not cover this capability/i,
        "a scope gap persists until the tenant re-grants; an outage clears itself. Report the " +
          "one that will still be there tomorrow.",
      );

      /* Restored for the sections that follow: connected rows are `healthy`, as a verifier writes them. */
      await client.query(
        `update integrations set scopes = '["test.read"]'::jsonb, health = 'healthy' where id = $1`,
        [ID],
      );
    }

    /* ── 9. A REVOKED CONNECTION IS NOT A SOURCE, AND SAYS WHO ENDED IT ──────── */
    {
      await client.query(`update integrations set connection_state = 'revoked' where tenant_id = $1`, [
        TENANT,
      ]);
      const view = await getCapabilityAvailability(tenant, {
        getDb,
        catalog: CONNECTABLE_CATALOG,
      });
      const capability = entry(view, CAPABILITY);
      assert.equal(capability.state, "revoked");
      assert.match(
        capability.reason ?? "",
        /provider ended this grant/i,
        "a revoked grant tells the tenant the PROVIDER ended it, not that they disconnected",
      );
      assert.deepEqual(capability.sources, [], "a terminal connection is never a source");
    }

    /* ── 10. THE SEAM IS TENANT-SCOPED ───────────────────────────────────────── */
    {
      await seedFixtureConnection(client, {
        id: "70000000-0000-4000-8000-000000000009",
        tenantId: OTHER,
        state: "connected",
        scopes: ["test.read", "test.write"],
        accountId: "acct-other",
        label: "Globex Workspace",
      });

      const view = await getCapabilityAvailability(tenant, {
        getDb,
        catalog: CONNECTABLE_CATALOG,
      });
      const capability = entry(view, CAPABILITY);
      assert.notEqual(
        capability.state,
        "available",
        "ANOTHER TENANT'S connected provider must never make this tenant's capability available",
      );
      assert.ok(
        capability.sources.every((s) => s.integrationId !== "70000000-0000-4000-8000-000000000009"),
        "and its connection is never listed as a source",
      );

      /* The other tenant, meanwhile, genuinely does have it. */
      const otherView = await getCapabilityAvailability(tenantOf(OTHER), {
        getDb,
        catalog: CONNECTABLE_CATALOG,
      });
      assert.equal(entry(otherView, CAPABILITY).state, "available");
    }

    /* ── 11. NO TENANT → EVERY CAPABILITY UNANSWERABLE, WITH A REASON ────────── */
    {
      const view = await getCapabilityAvailability(null, {
        getDb,
        catalog: CONNECTABLE_CATALOG,
      });
      const capability = entry(view, CAPABILITY);
      assert.equal(capability.state, "not-connected");
      assert.ok(capability.reason);
      assert.deepEqual(capability.sources, []);
    }

    console.log("i1-connection-authority/availability-seam: all assertions passed");
  } finally {
    await client.end();
    await handle.dispose();
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
