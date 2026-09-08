/*
 * TRH-24 — machine-sourced observation provenance.
 *
 * STATEMENT ORDER IS HAND-CORRECTED, AND ONLY THE ORDER.
 *
 * The generator emitted the composite foreign key BEFORE the unique index it references, and
 * PostgreSQL refused it: "there is no unique constraint matching given keys for referenced table".
 * The index is therefore moved ahead of the key. No statement was added, removed or altered — the
 * set is byte-identical to what drizzle-kit authored, and applying it statement by statement to a
 * disposable database now succeeds.
 *
 * SCHEMA EVOLUTION, NOT PURELY ADDITIVE DDL: two NOT NULL constraints are dropped. Every existing
 * row is human-sourced and already satisfies the new XOR invariant, so there is no backfill and no
 * row changes.
 */
ALTER TABLE "provider_observations" ALTER COLUMN "observed_by_actor_type" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "provider_observations" ALTER COLUMN "observed_by_actor_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "provider_observations" ADD COLUMN "standing_authorization_id" uuid;
--> statement-breakpoint
ALTER TABLE "provider_observations" ADD COLUMN "invocation_id" uuid;
--> statement-breakpoint
CREATE UNIQUE INDEX "standing_observation_authorizations_id_tenant_uq" ON "standing_observation_authorizations" USING btree ("id","tenant_id");
--> statement-breakpoint
ALTER TABLE "provider_observations" ADD CONSTRAINT "provider_observations_tenant_authorization_fk" FOREIGN KEY ("standing_authorization_id","tenant_id") REFERENCES "public"."standing_observation_authorizations"("id","tenant_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "provider_observations_invocation_uidx" ON "provider_observations" USING btree ("invocation_id") WHERE "provider_observations"."invocation_id" is not null;
--> statement-breakpoint
ALTER TABLE "provider_observations" ADD CONSTRAINT "provider_observations_human_actor_pair_chk" CHECK (("provider_observations"."observed_by_actor_type" is null) = ("provider_observations"."observed_by_actor_id" is null));
--> statement-breakpoint
ALTER TABLE "provider_observations" ADD CONSTRAINT "provider_observations_machine_provenance_pair_chk" CHECK (("provider_observations"."standing_authorization_id" is null) = ("provider_observations"."invocation_id" is null));
--> statement-breakpoint
ALTER TABLE "provider_observations" ADD CONSTRAINT "provider_observations_provenance_mode_chk" CHECK (("provider_observations"."observed_by_actor_type" is not null)::int + ("provider_observations"."standing_authorization_id" is not null)::int = 1);
