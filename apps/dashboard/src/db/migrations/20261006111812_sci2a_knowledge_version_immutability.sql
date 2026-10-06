-- SCI-2A — Knowledge version database immutability.
--
-- Invariant: SAME KNOWLEDGE VERSION ID => SAME VERSION-DEFINING CONTENT.
--
-- Deny-by-default: every knowledge_nodes column is frozen after insert EXCEPT the post-creation
-- state owned by the two existing authorities that update a node in place:
--   ratification (knowledge-ratification/ratify-version.server.ts): ratification_decision_id,
--     governance_session_id, ratified_by_actor_type, ratified_by_actor_id, ratified_at
--   retraction (knowledge/retract-source.server.ts): knowledge_lifecycle_status, retired_at
--   both: updated_at, updated_by, updated_by_type
-- A column added to the table later is frozen until a migration names it here.
--
-- Comparison is semantic (jsonb IS DISTINCT FROM), so an UPDATE that repeats an unchanged
-- protected value succeeds; NULL <-> value transitions are changes.
--
-- DELETE and TRUNCATE are refused: a Knowledge version is a durable historical record, and no
-- authority in the repository removes one. Retraction is a lifecycle transition, not a delete.
--
-- No table, no column, no data rewrite. Rows are protected FROM INSTALLATION FORWARD only; this
-- migration proves nothing about what happened to a row before it was applied. The trigger is not
-- an authority: it decides nothing about who may ratify or retract, only what a version is.
CREATE FUNCTION "public"."knowledge_nodes_guard_version_immutability"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  post_creation_state constant text[] := ARRAY[
    'ratification_decision_id', 'governance_session_id', 'ratified_by_actor_type',
    'ratified_by_actor_id', 'ratified_at',
    'knowledge_lifecycle_status', 'retired_at',
    'updated_at', 'updated_by', 'updated_by_type'
  ];
  before_row jsonb;
  after_row jsonb;
  changed text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'knowledge_nodes: a Knowledge version is a durable record and cannot be removed (%)', TG_OP
      USING ERRCODE = 'restrict_violation';
  END IF;

  before_row := to_jsonb(OLD) - post_creation_state;
  after_row := to_jsonb(NEW) - post_creation_state;
  IF before_row IS DISTINCT FROM after_row THEN
    SELECT string_agg(key, ', ' ORDER BY key) INTO changed
      FROM jsonb_object_keys(before_row || after_row) AS key
     WHERE before_row -> key IS DISTINCT FROM after_row -> key;
    RAISE EXCEPTION 'knowledge_nodes: version-defining columns cannot change on Knowledge version % (%)', OLD.id, changed
      USING ERRCODE = 'restrict_violation',
            HINT = 'A correction inserts a new Knowledge version and moves the fact selection.';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "knowledge_nodes_version_immutable_update"
  BEFORE UPDATE ON "public"."knowledge_nodes"
  FOR EACH ROW EXECUTE FUNCTION "public"."knowledge_nodes_guard_version_immutability"();--> statement-breakpoint
CREATE TRIGGER "knowledge_nodes_version_immutable_delete"
  BEFORE DELETE ON "public"."knowledge_nodes"
  FOR EACH ROW EXECUTE FUNCTION "public"."knowledge_nodes_guard_version_immutability"();--> statement-breakpoint
CREATE TRIGGER "knowledge_nodes_version_immutable_truncate"
  BEFORE TRUNCATE ON "public"."knowledge_nodes"
  FOR EACH STATEMENT EXECUTE FUNCTION "public"."knowledge_nodes_guard_version_immutability"();
