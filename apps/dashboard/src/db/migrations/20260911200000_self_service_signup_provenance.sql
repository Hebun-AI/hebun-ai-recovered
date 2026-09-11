/*
 * SELF-SERVICE SIGNUP PROVENANCE — one value added to one vocabulary.
 *
 * ── WHY A DROP AND AN ADD IS THE ADDITIVE FORM ──────────────────────────────
 *
 * PostgreSQL cannot widen a CHECK in place, so widening one is always expressed as a drop followed
 * by an add. The pair is exactly the shape `20260818172455_production_provenance_vocabulary.sql`
 * already used to admit `production-operator-ceremony`, and it is applied inside one transaction:
 * there is no window in which `companies.provisioning_source` is unconstrained.
 *
 * THE PREDICATE ONLY GROWS. Every value the old constraint admitted — NULL, `local-operator-ceremony`
 * and `production-operator-ceremony` — is admitted by the new one, with identical meaning. No
 * existing row is read, rewritten or re-classified, and no backfill runs: the two rows seeded by
 * `scripts/r1-seed.mjs` keep their NULL, which truthfully says no ceremony created them, and every
 * ceremony-born tenant keeps the root that produced it.
 *
 * ── WHY `genesis_nominations` IS DELIBERATELY UNTOUCHED ─────────────────────
 *
 * The two vocabularies were widened together last time because both described a CEREMONY root, and
 * a new deployment posture applied to both. This value is not a ceremony root. Self-service signup
 * brings a tenant into existence and stops; it does not nominate Genesis, and
 * `genesis_nominations_source_chk` must keep refusing a nomination that claims to come from it.
 * Widening both here would have made the two constraints look like one shared vocabulary — they are
 * not, and after this migration the difference is visible in the schema itself.
 */
ALTER TABLE "companies" DROP CONSTRAINT "companies_provisioning_source_chk";--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_provisioning_source_chk" CHECK ("companies"."provisioning_source" is null or "companies"."provisioning_source" = 'local-operator-ceremony' or "companies"."provisioning_source" = 'production-operator-ceremony' or "companies"."provisioning_source" = 'self-service-signup');
