-- SCI-2B — the Knowledge integrity-at-insert fact.
--
-- TRUE  = this version was inserted while all three SCI-2A immutability triggers were enabled, so
--         its version-defining content has been protected from the moment it existed.
-- NULL  = not established. Every row older than this column stays NULL (no backfill): Hebun cannot
--         prove what happened to it before protection existed. NULL is not "compromised".
--
-- The database owns the value. A separate BEFORE INSERT trigger overwrites whatever the INSERT
-- supplied, and writes TRUE only after checking the catalog that the SCI-2A guard triggers are
-- present and enabled; if protection is off, the row gets NULL. The SCI-2A guard function is not
-- changed. The new column is not in SCI-2A's post-creation allowlist, so its deny-by-default UPDATE
-- rule freezes it: NULL can never become TRUE, and TRUE can never be cleared.
ALTER TABLE "knowledge_nodes" ADD COLUMN "integrity_protected_at_insert" boolean;--> statement-breakpoint
CREATE FUNCTION "public"."knowledge_nodes_stamp_integrity_at_insert"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.integrity_protected_at_insert := CASE WHEN (
    SELECT count(*)
      FROM pg_catalog.pg_trigger t
      JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE t.tgrelid = TG_RELID
       AND n.nspname = 'public'
       AND p.proname = 'knowledge_nodes_guard_version_immutability'
       AND t.tgname IN ('knowledge_nodes_version_immutable_update',
                        'knowledge_nodes_version_immutable_delete',
                        'knowledge_nodes_version_immutable_truncate')
       AND t.tgenabled <> 'D'
  ) = 3 THEN true ELSE NULL END;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "knowledge_nodes_stamp_integrity_at_insert"
  BEFORE INSERT ON "public"."knowledge_nodes"
  FOR EACH ROW EXECUTE FUNCTION "public"."knowledge_nodes_stamp_integrity_at_insert"();
