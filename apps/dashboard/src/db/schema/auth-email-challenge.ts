/*
 * auth_email_challenges — the EMAIL OWNERSHIP CHALLENGE authority (AUTH-EMAIL-OWNERSHIP-1).
 *
 * One row is one single-use proof request sent to one address for one identity. It answers exactly
 * one question — "did the human signed in as this identity also read mail at this address?" — and
 * grants nothing: no tenant, no membership, no role, no Governance. The only consequence a consumed
 * row has anywhere is `auth_identities.email_ownership_verified_at`, written by the Identity
 * authority in the same transaction.
 *
 * SECRET MATERIAL. The raw token is never stored. `token_hash` is a keyed, domain-separated HMAC of it
 * (the same construction `identity_enrollment_requests.continuation_hash` and session digests use),
 * so a leaked row cannot be turned back into a usable link. `token_digest_version` names the session
 * digest key that produced it, so a key rotation does not silently strand open challenges.
 *
 * LIFECYCLE IS A CONSTRAINT, NOT A CONVENTION. A row is open, consumed or superseded — never two of
 * them — and the database refuses every other shape. Exactly one open row may exist per identity and
 * purpose. Rows are never deleted: the consumed row is the provenance of a proof.
 *
 * Uses rootColumns (global, like auth_identities and auth_credentials): a mailbox belongs to a human,
 * not to a tenant, and no tenant id appears anywhere in this table.
 */
import { sql } from "drizzle-orm";
import {
  char,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { rootColumns } from "./_base";
import { authEmailChallengePurposeEnum } from "./_enums";
import { authIdentities } from "./auth-identity";
import { userSessionContexts } from "./user-session-context";

export const authEmailChallenges = pgTable(
  "auth_email_challenges",
  {
    ...rootColumns,
    /** The identity this challenge can prove an address for. RESTRICT: rows are history. */
    authIdentityId: uuid("auth_identity_id")
      .notNull()
      .references(() => authIdentities.id, { onDelete: "restrict" }),
    purpose: authEmailChallengePurposeEnum("purpose").notNull(),
    /** The normalized address the message was sent to. A proof is only ever a proof of THIS address. */
    emailAtIssue: text("email_at_issue").notNull(),
    tokenDigestVersion: integer("token_digest_version").notNull(),
    tokenHash: char("token_hash", { length: 64 }).notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    /** The session that presented the token. A challenge is only consumed by its own identity's session. */
    consumedSessionContextId: uuid("consumed_session_context_id").references(
      () => userSessionContexts.id,
      { onDelete: "restrict" },
    ),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    /** What the mail provider said, once a delivery was attempted. ACCEPTED is not DELIVERED. */
    deliveryOutcome: varchar("delivery_outcome", { length: 16 }),
    deliveryAttemptedAt: timestamp("delivery_attempted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("auth_email_challenges_digest_uq").on(t.tokenDigestVersion, t.tokenHash),
    /* At most one OPEN challenge per identity and purpose; a new issue must supersede the old one. */
    uniqueIndex("auth_email_challenges_open_uq")
      .on(t.authIdentityId, t.purpose)
      .where(sql`${t.consumedAt} is null and ${t.supersededAt} is null`),
    index("auth_email_challenges_rate_idx").on(t.authIdentityId, t.purpose, t.issuedAt),
    index("auth_email_challenges_issued_idx").on(t.issuedAt),

    check(
      "auth_email_challenges_email_chk",
      sql`${t.emailAtIssue} = lower(btrim(${t.emailAtIssue})) and char_length(${t.emailAtIssue}) between 3 and 320`,
    ),
    check("auth_email_challenges_digest_version_chk", sql`${t.tokenDigestVersion} > 0`),
    check("auth_email_challenges_token_hash_chk", sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`),
    check(
      "auth_email_challenges_expiry_chk",
      sql`${t.expiresAt} > ${t.issuedAt} and ${t.expiresAt} <= ${t.issuedAt} + interval '24 hours'`,
    ),
    check(
      "auth_email_challenges_terminal_chk",
      sql`${t.consumedAt} is null or ${t.supersededAt} is null`,
    ),
    check(
      "auth_email_challenges_consumed_session_chk",
      sql`(${t.consumedAt} is null) = (${t.consumedSessionContextId} is null)`,
    ),
    check(
      "auth_email_challenges_consumed_window_chk",
      sql`${t.consumedAt} is null or (${t.consumedAt} >= ${t.issuedAt} and ${t.consumedAt} <= ${t.expiresAt})`,
    ),
    check(
      "auth_email_challenges_superseded_time_chk",
      sql`${t.supersededAt} is null or ${t.supersededAt} >= ${t.issuedAt}`,
    ),
    check(
      "auth_email_challenges_delivery_outcome_chk",
      sql`${t.deliveryOutcome} is null or ${t.deliveryOutcome} in ('accepted', 'rejected', 'unreachable', 'ambiguous')`,
    ),
    check(
      "auth_email_challenges_delivery_pair_chk",
      sql`(${t.deliveryOutcome} is null) = (${t.deliveryAttemptedAt} is null)`,
    ),
  ],
);
