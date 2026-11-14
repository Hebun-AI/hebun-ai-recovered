ALTER TABLE "processor_attestations" DROP CONSTRAINT "processor_attestations_control_source_chk";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "credential_source" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "credential_integration_id" uuid;--> statement-breakpoint
ALTER TABLE "processor_attestations" ADD COLUMN "owner_tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "processor_attestations" ADD COLUMN "attested_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_credential_integration_fk" FOREIGN KEY ("credential_integration_id","tenant_id") REFERENCES "public"."integrations"("id","tenant_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processor_attestations" ADD CONSTRAINT "processor_attestations_owner_tenant_id_companies_id_fk" FOREIGN KEY ("owner_tenant_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_credential_source_chk" CHECK (("messages"."credential_source" is null and "messages"."credential_integration_id" is null)
      or ("messages"."credential_source" = 'platform' and "messages"."credential_integration_id" is null and "messages"."transport" = 'live')
      or ("messages"."credential_source" = 'tenant' and "messages"."credential_integration_id" is not null and "messages"."transport" = 'live'));--> statement-breakpoint
ALTER TABLE "processor_attestations" ADD CONSTRAINT "processor_attestations_tenant_owner_chk" CHECK (("processor_attestations"."owner_tenant_id" is not null) = ("processor_attestations"."control_source" = 'tenant-attestation')
        and ("processor_attestations"."owner_tenant_id" is not null) = ("processor_attestations"."attested_by_user_id" is not null)
        and ("processor_attestations"."owner_tenant_id" is not null) = ("processor_attestations"."account_ref" like 'tenant-byok:%')
        and ("processor_attestations"."owner_tenant_id" is null or ("processor_attestations"."service_scope" = 'anthropic/messages' and "processor_attestations"."identity_status" = 'attested')));--> statement-breakpoint
ALTER TABLE "processor_attestations" ADD CONSTRAINT "processor_attestations_control_source_chk" CHECK ("processor_attestations"."control_source" in ('local-operator-ceremony', 'production-operator-ceremony', 'tenant-attestation'));