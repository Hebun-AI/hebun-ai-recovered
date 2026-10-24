/*
 * auth-email-ownership/email-verification.server.ts — the EMAIL OWNERSHIP CHALLENGE authority.
 *
 * The only module that writes `auth_email_challenges`. It issues a link, consumes a link, and reads
 * what a signed-in human may know about their own proof. The proof itself is written by Identity
 * authority (`markEmailOwnershipVerified`) inside the consuming transaction.
 *
 * ── CONCURRENCY ──────────────────────────────────────────────────────────────
 *
 * Every write path locks the IDENTITY row first (`lockIdentityForOwnership`) and only then touches
 * challenge rows. One lock order, so issue/issue, issue/confirm and confirm/confirm serialize per
 * identity instead of deadlocking. Behind the lock, each terminal write is also PREDICATED
 * (`consumed_at is null and superseded_at is null and expires_at > now`), and the partial unique
 * index allows one open link per identity — so correctness never rests on the lock alone.
 *
 * ── DELIVERY ─────────────────────────────────────────────────────────────────
 *
 * The challenge commits BEFORE the send, and the send's outcome is recorded after. A crash between
 * the two leaves a link with no recorded outcome — reported as such, never as sent. There is no
 * retry: a new link supersedes the old one, under the same rate limits.
 *
 * ── WHAT NEVER LEAVES THIS MODULE ────────────────────────────────────────────
 *
 * The raw reference goes to exactly one place — the mail body. It is not returned, logged, stored,
 * or placed in any error.
 */
import { and, count, desc, eq, gt, isNull, lte, max, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { authEmailChallenges } from "@/db/schema/auth-email-challenge";
import { authIdentities } from "@/db/schema/auth-identity";
import { users } from "@/db/schema/user";
import type { FetchLike } from "@/features/action-execution-live/resend-email-transport.server";
import {
  resolveAuthenticationEnvironment,
  type AuthenticationDigestKey,
} from "@/features/auth/environment/auth-environment.server";
import {
  lockIdentityForOwnership,
  markEmailOwnershipVerified,
} from "@/features/auth-runtime/identity-repository.server";

import { resolveAuthMailEnvironment, sendEmailVerificationMessage } from "./auth-mail.server";
import {
  digestEmailVerificationReference,
  generateEmailVerificationReference,
} from "./challenge-digest.server";
import {
  AUTH_MAIL_GLOBAL_HOURLY_LIMIT,
  EMAIL_VERIFICATION_COOLDOWN_SECONDS,
  EMAIL_VERIFICATION_DAILY_LIMIT,
  EMAIL_VERIFICATION_PURPOSE,
  EMAIL_VERIFICATION_TOKEN_PATTERN,
  EMAIL_VERIFICATION_TTL_SECONDS,
  type AuthMailDeliveryOutcome,
  type EmailOwnershipState,
  type EmailVerificationConfirmRefusal,
  type EmailVerificationConfirmResult,
  type EmailVerificationIssueRefusal,
  type EmailVerificationIssueResult,
} from "./contracts";

export interface EmailVerificationDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  /** Mail configuration source. Defaults to `process.env`. */
  readonly mailEnv?: Readonly<Record<string, string | undefined>>;
  /** Test seam only: the transport's fetch, so no test can reach the network. */
  readonly fetchImpl?: FetchLike;
  /** Test seam only: a known reference, so a test can play the human holding the link. */
  readonly mintReference?: () => string;
  /**
   * Test seam only: the session digest keys, current first. In the product they are read here, from
   * the authentication environment, so no server action or page ever names a digest key.
   */
  readonly digestKeys?: readonly AuthenticationDigestKey[];
}

/** The configured session digest keys, current first; empty when authentication is not configured. */
function resolveDigestKeys(deps: EmailVerificationDeps): readonly AuthenticationDigestKey[] {
  if (deps.digestKeys) return deps.digestKeys;
  const env = resolveAuthenticationEnvironment(process.env);
  if (env.status !== "configured") return [];
  return env.sessionDigestPreviousKey
    ? [env.sessionDigestCurrentKey, env.sessionDigestPreviousKey]
    : [env.sessionDigestCurrentKey];
}

/** Aborts a transaction with a typed reason. Never escapes this module. */
class OwnershipAbort extends Error {
  constructor(readonly reason: string) {
    super(`email ownership: ${reason}`);
    this.name = "OwnershipAbort";
  }
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Email ownership verification is server-only.");
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ISSUE
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Issue a new link for ONE identity and mail it to that identity's own address.
 *
 * The caller supplies the identity from a session it already authorized (or from the account it
 * just created) — never from browser input. The recipient is read from the identity's user row under
 * lock; nobody can choose where the link goes. The link is digested under the CURRENT session key.
 *
 * Refuses BEFORE writing anything when this deployment cannot send authentication mail, so a missing
 * configuration never consumes anyone's allowance.
 */
export async function issueEmailVerification(
  authIdentityId: string,
  deps: EmailVerificationDeps = {},
): Promise<EmailVerificationIssueResult> {
  assertServerRuntime();
  const refused = (reason: EmailVerificationIssueRefusal): EmailVerificationIssueResult => ({
    status: "refused",
    reason,
  });

  const digestKey = resolveDigestKeys(deps)[0];
  if (!digestKey) return refused("unauthenticated");
  const mail = resolveAuthMailEnvironment(deps.mailEnv ?? process.env);
  if (mail.status !== "configured") return refused("delivery-unavailable");
  const db = (deps.getDb ?? getControlPlaneDb)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  const reference = (deps.mintReference ?? generateEmailVerificationReference)();
  const tokenHash = digestEmailVerificationReference(reference, digestKey);

  let issued: { readonly challengeId: string; readonly to: string };
  try {
    issued = await db.transaction(async (tx) => {
      const identity = await lockIdentityForOwnership(tx, authIdentityId);
      if (!identity || !identity.usable) throw new OwnershipAbort("identity-unavailable");
      if (identity.emailOwnershipVerifiedAt !== null) throw new OwnershipAbort("already-verified");

      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const [own] = await tx
        .select({
          lastIssuedAt: max(authEmailChallenges.issuedAt),
          inLastDay: sql<number>`count(*) filter (where ${authEmailChallenges.issuedAt} > ${dayAgo})`.mapWith(Number),
        })
        .from(authEmailChallenges)
        .where(
          and(
            eq(authEmailChallenges.authIdentityId, authIdentityId),
            eq(authEmailChallenges.purpose, EMAIL_VERIFICATION_PURPOSE),
          ),
        );
      if (
        own?.lastIssuedAt &&
        now.getTime() - new Date(own.lastIssuedAt).getTime() < EMAIL_VERIFICATION_COOLDOWN_SECONDS * 1000
      ) {
        throw new OwnershipAbort("cooldown");
      }
      if ((own?.inLastDay ?? 0) >= EMAIL_VERIFICATION_DAILY_LIMIT) {
        throw new OwnershipAbort("daily-limit");
      }

      const [global] = await tx
        .select({ n: count() })
        .from(authEmailChallenges)
        .where(gt(authEmailChallenges.issuedAt, new Date(now.getTime() - 60 * 60 * 1000)));
      if ((global?.n ?? 0) >= AUTH_MAIL_GLOBAL_HOURLY_LIMIT) throw new OwnershipAbort("global-limit");

      /* A new link replaces every open one — including an expired one that was never used. */
      await tx
        .update(authEmailChallenges)
        .set({ supersededAt: now, updatedAt: now })
        .where(
          and(
            eq(authEmailChallenges.authIdentityId, authIdentityId),
            eq(authEmailChallenges.purpose, EMAIL_VERIFICATION_PURPOSE),
            isNull(authEmailChallenges.consumedAt),
            isNull(authEmailChallenges.supersededAt),
          ),
        );

      const inserted = await tx
        .insert(authEmailChallenges)
        .values({
          authIdentityId,
          purpose: EMAIL_VERIFICATION_PURPOSE,
          emailAtIssue: identity.normalizedEmail,
          tokenDigestVersion: digestKey.version,
          tokenHash,
          issuedAt: now,
          expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_SECONDS * 1000),
          createdBy: identity.userId,
          createdByType: "human",
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: authEmailChallenges.id });
      return { challengeId: inserted[0]!.id, to: identity.deliveryEmail };
    });
  } catch (error) {
    if (error instanceof OwnershipAbort) return refused(error.reason as EmailVerificationIssueRefusal);
    return refused("persistence-unavailable");
  }

  const delivery = await sendEmailVerificationMessage(
    { to: issued.to, reference, idempotencyKey: issued.challengeId },
    mail,
    { fetchImpl: deps.fetchImpl },
  );
  await recordDeliveryOutcome(db, issued.challengeId, delivery, (deps.now ?? (() => new Date()))());
  return { status: "issued", delivery };
}

/**
 * Record what the provider said, once. Predicated on no outcome yet, so a late or repeated write can
 * never replace the first answer. Best effort: the link exists either way, and a missing outcome is
 * already reported to the human as "not confirmed as sent".
 */
async function recordDeliveryOutcome(
  db: ControlPlaneDatabase,
  challengeId: string,
  outcome: AuthMailDeliveryOutcome,
  at: Date,
): Promise<void> {
  try {
    await db
      .update(authEmailChallenges)
      .set({ deliveryOutcome: outcome, deliveryAttemptedAt: at, updatedAt: at })
      .where(and(eq(authEmailChallenges.id, challengeId), isNull(authEmailChallenges.deliveryOutcome)));
  } catch {
    /* See the header: an unrecorded outcome is shown as unknown, never as delivered. */
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * CONFIRM
 * ═════════════════════════════════════════════════════════════════════════ */

/** The authorized session presenting a link. Server-resolved; never browser input. */
export interface ConfirmingSession {
  readonly authIdentityId: string;
  readonly sessionContextId: string;
}

/**
 * Consume a link presented by an AUTHORIZED session of the identity it was issued to.
 *
 * The session requirement is what makes the link a proof of THIS human's mailbox rather than a proof
 * that somebody clicked: a person who signs up with someone else's address cannot get that person's
 * click to verify it, because that person cannot sign in as the impostor.
 *
 * A link is recognised under the current and (if configured) previous session digest keys, so a
 * link issued just before a key rotation still works for its remaining lifetime.
 */
export async function confirmEmailVerification(
  reference: string,
  session: ConfirmingSession,
  deps: EmailVerificationDeps = {},
): Promise<EmailVerificationConfirmResult> {
  assertServerRuntime();
  const refused = (reason: EmailVerificationConfirmRefusal): EmailVerificationConfirmResult => ({
    status: "refused",
    reason,
  });

  if (typeof reference !== "string" || !EMAIL_VERIFICATION_TOKEN_PATTERN.test(reference)) {
    return refused("invalid-link");
  }
  const digestKeys = resolveDigestKeys(deps);
  if (digestKeys.length === 0) return refused("unauthenticated");
  const db = (deps.getDb ?? getControlPlaneDb)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  try {
    await db.transaction(async (tx) => {
      let challenge:
        | { readonly id: string; readonly authIdentityId: string; readonly emailAtIssue: string }
        | undefined;
      for (const key of digestKeys) {
        const rows = await tx
          .select({
            id: authEmailChallenges.id,
            authIdentityId: authEmailChallenges.authIdentityId,
            emailAtIssue: authEmailChallenges.emailAtIssue,
          })
          .from(authEmailChallenges)
          .where(
            and(
              eq(authEmailChallenges.tokenDigestVersion, key.version),
              eq(authEmailChallenges.tokenHash, digestEmailVerificationReference(reference, key)),
              eq(authEmailChallenges.purpose, EMAIL_VERIFICATION_PURPOSE),
            ),
          )
          .limit(1);
        if (rows[0]) {
          challenge = rows[0];
          break;
        }
      }
      if (!challenge) throw new OwnershipAbort("invalid-link");
      if (challenge.authIdentityId !== session.authIdentityId) {
        throw new OwnershipAbort("different-account");
      }

      const identity = await lockIdentityForOwnership(tx, challenge.authIdentityId);
      if (!identity || !identity.usable) throw new OwnershipAbort("identity-unavailable");
      if (identity.emailOwnershipVerifiedAt !== null) throw new OwnershipAbort("already-verified");
      /* A link proves the address it was mailed to, and only while the identity still has it. */
      if (challenge.emailAtIssue !== identity.normalizedEmail) throw new OwnershipAbort("invalid-link");

      const consumed = await tx
        .update(authEmailChallenges)
        .set({
          consumedAt: now,
          consumedSessionContextId: session.sessionContextId,
          updatedAt: now,
          updatedBy: identity.userId,
          updatedByType: "human",
        })
        .where(
          and(
            eq(authEmailChallenges.id, challenge.id),
            isNull(authEmailChallenges.consumedAt),
            isNull(authEmailChallenges.supersededAt),
            gt(authEmailChallenges.expiresAt, now),
            lte(authEmailChallenges.issuedAt, now),
          ),
        )
        .returning({ id: authEmailChallenges.id });
      if (consumed.length !== 1) throw new OwnershipAbort("invalid-link");

      const marked = await markEmailOwnershipVerified(tx, {
        authIdentityId: identity.authIdentityId,
        challengeId: challenge.id,
        at: now,
      });
      if (!marked) throw new OwnershipAbort("already-verified");
    });
  } catch (error) {
    if (error instanceof OwnershipAbort) {
      return refused(error.reason as EmailVerificationConfirmRefusal);
    }
    return refused("persistence-unavailable");
  }
  return { status: "verified" };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * READ
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The ONE definition of "this identity's CURRENT address is proven", as a SQL predicate over an
 * identity id column, optionally pinned to a specific proving challenge.
 *
 * Proven means: the identity carries a proof, the proving challenge was consumed, and that challenge
 * was mailed to the address the identity's user has NOW. Genesis acceptance embeds this inside its
 * own atomic UPDATE, so a proof is checked by the same statement that grants authority.
 */
export function emailOwnershipProvenPredicate(
  authIdentityIdColumn: AnyPgColumn,
  provingChallengeId?: string,
): SQL {
  return sql`exists (
    select 1
      from ${authIdentities} as eo_i
      join ${users} as eo_u on eo_u.id = eo_i.user_id
      join ${authEmailChallenges} as eo_c on eo_c.id = eo_i.email_ownership_challenge_id
     where eo_i.id = ${authIdentityIdColumn}
       and eo_i.email_ownership_verified_at is not null
       and eo_c.consumed_at is not null
       and eo_c.email_at_issue = lower(btrim(eo_u.email))
       ${provingChallengeId ? sql`and eo_i.email_ownership_challenge_id = ${provingChallengeId}` : sql``}
  )`;
}

export interface EmailOwnershipProof {
  readonly proven: boolean;
  /** The consumed challenge that proves it, when proven. */
  readonly challengeId: string | null;
  readonly verifiedAt: Date | null;
}

/** Is this identity's current address proven? Reads only; the same definition as the predicate. */
export async function readEmailOwnershipProof(
  db: Pick<ControlPlaneDatabase, "select">,
  authIdentityId: string,
): Promise<EmailOwnershipProof> {
  const rows = await db
    .select({
      verifiedAt: authIdentities.emailOwnershipVerifiedAt,
      challengeId: authIdentities.emailOwnershipChallengeId,
      provenNow: sql<boolean>`${emailOwnershipProvenPredicate(authIdentities.id)}`,
    })
    .from(authIdentities)
    .where(eq(authIdentities.id, authIdentityId))
    .limit(1);
  const row = rows[0];
  if (!row || !row.provenNow) {
    return { proven: false, challengeId: null, verifiedAt: row?.verifiedAt ?? null };
  }
  return { proven: true, challengeId: row.challengeId, verifiedAt: row.verifiedAt };
}

/**
 * What a signed-in human may see about their own address: proven or not, and if not, the open link's
 * timing and delivery outcome. Never the token, never the hash, never another identity.
 *
 * A proof whose address no longer matches cannot occur today (Hebun has no email change); if it ever
 * does, it reads as `unavailable` rather than inviting a new link the write-once proof would refuse.
 */
export async function readEmailOwnershipState(
  authIdentityId: string,
  deps: EmailVerificationDeps = {},
): Promise<EmailOwnershipState> {
  assertServerRuntime();
  const db = (deps.getDb ?? getControlPlaneDb)();
  if (!db) return { status: "unavailable" };
  const now = (deps.now ?? (() => new Date()))();
  try {
    const proof = await readEmailOwnershipProof(db, authIdentityId);
    if (proof.proven && proof.verifiedAt) {
      return { status: "verified", verifiedAt: proof.verifiedAt.toISOString() };
    }
    if (proof.verifiedAt) return { status: "unavailable" };

    const open = await db
      .select({
        issuedAt: authEmailChallenges.issuedAt,
        expiresAt: authEmailChallenges.expiresAt,
        delivery: authEmailChallenges.deliveryOutcome,
      })
      .from(authEmailChallenges)
      .where(
        and(
          eq(authEmailChallenges.authIdentityId, authIdentityId),
          eq(authEmailChallenges.purpose, EMAIL_VERIFICATION_PURPOSE),
          isNull(authEmailChallenges.consumedAt),
          isNull(authEmailChallenges.supersededAt),
          gt(authEmailChallenges.expiresAt, now),
        ),
      )
      .orderBy(desc(authEmailChallenges.issuedAt))
      .limit(1);
    const latest = open[0];
    return {
      status: "unverified",
      latest: latest
        ? {
            issuedAt: latest.issuedAt.toISOString(),
            expiresAt: latest.expiresAt.toISOString(),
            delivery: (latest.delivery as AuthMailDeliveryOutcome | null) ?? null,
          }
        : null,
      deliveryAvailable: resolveAuthMailEnvironment(deps.mailEnv ?? process.env).status === "configured",
    };
  } catch {
    return { status: "unavailable" };
  }
}
