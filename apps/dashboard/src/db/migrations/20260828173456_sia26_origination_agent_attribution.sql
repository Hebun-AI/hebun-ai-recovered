--> ORDER CORRECTED BY HAND (SIA-2.6).
--> drizzle-kit emitted the composite FOREIGN KEY *before* the UNIQUE INDEX it references, and
--> PostgreSQL refuses that: "there is no unique constraint matching given keys for referenced
--> table agents". The anchor is therefore created first. Same four statements, same final state.
CREATE UNIQUE INDEX "agents_tenant_id_uq" ON "agents" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "heby_origination_invocations" ADD COLUMN "agent_id" uuid;--> statement-breakpoint
ALTER TABLE "heby_origination_invocations" ADD CONSTRAINT "heby_origination_invocations_tenant_agent_fk" FOREIGN KEY ("tenant_id","agent_id") REFERENCES "public"."agents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "heby_origination_invocations_tenant_agent_idx" ON "heby_origination_invocations" USING btree ("tenant_id","agent_id");
