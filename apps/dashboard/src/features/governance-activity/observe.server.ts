/*
 * governance-activity/observe.server.ts — the R7.1 composition seam.
 *
 * Joins the authoritative tenant-scoped read to the pure projection and nothing else. It holds no
 * logic of its own beyond deciding which honest unavailable reason applies, so that the counting
 * lives in the database and the shaping lives in a pure function that a test can drive with no
 * database at all.
 *
 * Fails CLOSED. Every failure path returns an `unavailable` reason rather than an empty
 * observation, because a zeroed view is a claim ("Hebun recorded nothing for you") and must never
 * be produced by a read that simply could not run.
 */

import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type {
  ActSubject,
  GovernanceActivityObservationResult,
  RecordedActHistoryResult,
  SubjectActHistoryResult,
} from "./contracts";
import { projectGovernanceActivity } from "./observation";
import { readGovernanceActivityTallies, type GovernanceActivityReadDeps } from "./read.server";
import { readRecordedActPage } from "./act-history-read.server";
import {
  isAddressableActSubject,
  readSubjectActPage,
} from "./subject-act-history-read.server";

export interface ObserveGovernanceActivityDeps extends GovernanceActivityReadDeps {
  /** Injected so `generatedAt` is deterministic under test. Never read inside the projection. */
  readonly now?: () => Date;
}

/**
 * Observe the recorded governance activity of the authorized tenant.
 *
 * The tenant comes from the caller's already-authorized context and is used verbatim as the SQL
 * predicate. This function does not widen it, does not accept a tenant id argument, and offers no
 * cross-tenant or whole-ledger form — a caller cannot ask for "all governance activity", only for
 * its own.
 */
export async function observeGovernanceActivity(
  tenant: Pick<TenantContext, "tenantId"> | null,
  deps: ObserveGovernanceActivityDeps = {},
): Promise<GovernanceActivityObservationResult> {
  if (typeof window !== "undefined") {
    throw new Error("Governance activity reads are server-only.");
  }
  if (!tenant?.tenantId) {
    return { status: "unavailable", reason: "no-authorized-tenant-context" };
  }

  try {
    const tallies = await readGovernanceActivityTallies(tenant.tenantId, deps);
    if (!tallies) {
      /*
       * `null` means the read could not run: no database configured, or an id that is not a uuid
       * and therefore cannot name a tenant. Neither is "this tenant has no activity".
       */
      return { status: "unavailable", reason: "persistence-not-configured" };
    }
    const now = deps.now?.() ?? new Date();
    return {
      status: "observed",
      observation: projectGovernanceActivity(tenant.tenantId, tallies, now),
    };
  } catch (error) {
    return {
      status: "unavailable",
      reason: "read-failed",
      detail: error instanceof Error ? error.message : "governance activity read failed",
    };
  }
}

/**
 * R7.1.1 — observe one tenant's recorded act history.
 *
 * The tenant comes from the caller's already-authorized context and is used verbatim as the SQL
 * predicate. There is NO tenant id parameter a client could supply, no cross-tenant form and no
 * whole-ledger form: a caller can ask for its own history or for nothing. That is the same
 * arrangement `observeGovernanceActivity` established, and it is deliberately not re-litigated
 * here.
 *
 * FAILS CLOSED, and the distinction it fails into is the point of the phase. A read that could not
 * run returns `unavailable`; only a read that SUCCEEDED and found nothing returns `empty`. Zero
 * acts is a statement about the organization, and a broken connection must never be allowed to
 * make it.
 */
export async function observeRecordedActHistory(
  tenant: Pick<TenantContext, "tenantId"> | null,
  deps: ObserveGovernanceActivityDeps = {},
): Promise<RecordedActHistoryResult> {
  if (typeof window !== "undefined") {
    throw new Error("Governance activity reads are server-only.");
  }
  if (!tenant?.tenantId) {
    return { status: "unavailable", reason: "no-authorized-tenant-context" };
  }

  try {
    const page = await readRecordedActPage(tenant.tenantId, deps);
    if (!page) {
      return { status: "unavailable", reason: "persistence-not-configured" };
    }
    const generatedAt = (deps.now?.() ?? new Date()).toISOString();
    if (page.totalRecordedActs === 0) {
      return { status: "empty", tenantId: tenant.tenantId, generatedAt };
    }
    return { status: "recorded", tenantId: tenant.tenantId, generatedAt, page };
  } catch (error) {
    return {
      status: "unavailable",
      reason: "read-failed",
      detail: error instanceof Error ? error.message : "recorded act history read failed",
    };
  }
}

/**
 * SUBJECT-ACT-HISTORY-1 — observe what Hebun recorded doing to ONE subject.
 *
 * ── THE TENANT IS STILL NOT A PARAMETER ──────────────────────────────────────
 *
 * The subject is the only thing a caller supplies. The tenant comes from the caller's already
 * authorized context and is used verbatim, exactly as both released observers arrange it, so
 * naming another organization's work item resolves to that organization's rows for nobody: the
 * predicate is `AND`-ed with a tenant the caller did not choose.
 *
 * ── FOUR OUTCOMES, AND THE THIRD IS THE ONE THIS PHASE EXISTS FOR ────────────
 *
 *   `recorded`             the ledger holds acts for this subject; here is a bounded, ordered page.
 *   `empty`                the ledger was READ SUCCESSFULLY and holds no act for this subject.
 *                          That is a statement about Hebun's record, NOT about the world: work
 *                          done outside Hebun leaves no row here and is no less real.
 *   `unrecognized-subject` the subject was not addressable, so NOTHING WAS READ. Never `empty`:
 *                          a typo must not be able to produce an organizational claim.
 *   `unavailable`          the ledger could not be read. "Nothing was recorded" and "Hebun could
 *                          not look" are different sentences.
 */
export async function observeSubjectActHistory(
  tenant: Pick<TenantContext, "tenantId"> | null,
  subject: ActSubject,
  deps: ObserveGovernanceActivityDeps = {},
): Promise<SubjectActHistoryResult> {
  if (typeof window !== "undefined") {
    throw new Error("Governance activity reads are server-only.");
  }
  if (!tenant?.tenantId) {
    return { status: "unavailable", reason: "no-authorized-tenant-context" };
  }
  if (!isAddressableActSubject(subject)) {
    return { status: "unavailable", reason: "unrecognized-subject" };
  }

  try {
    const page = await readSubjectActPage(tenant.tenantId, subject, deps);
    if (!page) {
      return { status: "unavailable", reason: "persistence-not-configured" };
    }
    const generatedAt = (deps.now?.() ?? new Date()).toISOString();
    if (page.totalRecordedActs === 0) {
      return { status: "empty", tenantId: tenant.tenantId, subject, generatedAt };
    }
    return { status: "recorded", tenantId: tenant.tenantId, subject, generatedAt, page };
  } catch (error) {
    return {
      status: "unavailable",
      reason: "read-failed",
      detail: error instanceof Error ? error.message : "subject act history read failed",
    };
  }
}
