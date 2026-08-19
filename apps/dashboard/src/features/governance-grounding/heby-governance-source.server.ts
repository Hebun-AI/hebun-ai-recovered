/*
 * governance-grounding/heby-governance-source.server.ts — GOVERNANCE'S read projection of itself,
 * shaped for Heby grounding (G6C).
 *
 * ── WHY IT LIVES ON THIS SIDE OF THE BOUNDARY ────────────────────────────────
 *
 * The first draft of this file lived under `heby-governance/`, and five independent released
 * firewalls rejected it: G2, G3, I1.1, K4 and the stranded-enrollment gate each assert that NO Heby
 * surface may reference `bootstrap-authority`, `decision-authority`, `authority-delegation` or the
 * ratification modules — reads included.
 *
 * That is not bluntness to be worked around. Those modules MIX reads and writes:
 * `bootstrap-authority.server.ts` exports `readGovernanceAuthority` beside
 * `establishGovernanceAuthority`. A Heby file importing it holds a reference into a module that can
 * establish a government, and no reviewer should have to check which symbol was taken.
 *
 * So the projection belongs to GOVERNANCE, which may read its own owners freely, and Heby consumes
 * the projection. Heby's import surface is now a module containing zero writers instead of one
 * containing the constitution's. The firewalls' property is preserved and strengthened, not dodged —
 * and this file's own test asserts the absence by mechanism rather than by path.
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT ─────────────────────────────────────────
 *
 * It is a READ PROJECTION. It owns no Governance fact, holds no table, and defines no authority.
 * Every value it returns is read through an authority that already owns it:
 *
 *   `readAuthorityRoster`     — who holds Governance authority, since when, and how (G2/G3)
 *   `readGovernanceAuthority` — the bootstrap decision that established it (G2)
 *   `readRoleBaselineState`   — whether the tenant has its ordinary member role (I1.1)
 *
 * It translates their results into the shape Heby's deterministic evidence layer already consumes.
 * It does not reinterpret them, does not aggregate across tenants, and does not answer a question
 * none of them was asked.
 *
 * ── THE SEAM IS THE ONE K1, R3W AND R3R ALREADY ESTABLISHED ──────────────────
 *
 * `heby-runtime/source-resolver.ts` is PURE: it holds no tenant and can open no connection, so it
 * reports `governance` unavailable. Knowledge, prepared work and recorded recipients each solved
 * that the same way — the server answer flow substitutes a real tenant-scoped read for the pure
 * default. This is the fourth instance of that arrangement, deliberately, rather than a new one.
 *
 * ── AUTHORITATIVE, AND SAYING SO ─────────────────────────────────────────────
 *
 * Every other connected source declares `authoritative: false`, because each reads a derived model
 * or an unverified record. This one is different and must say so: `decision_records` IS the
 * Governance record. A tenant's authority is not a summary of something else.
 *
 * That distinction is load-bearing. The response builder previously stated "derived and
 * non-authoritative" unconditionally, which would have flattened this source into the overview's
 * class the moment it connected. It now reports what the resolved sources actually are.
 *
 * ── ZERO WRITERS, PROVED BY MECHANISM ───────────────────────────────────────
 *
 * It imports only read-only modules: `authority-read.server` and `role-baseline-read.server`,
 * neither of which contains an INSERT, UPDATE, DELETE or transaction, and neither of which defines
 * any act that mutates Governance.
 *
 * That absence is not asserted here in prose — naming the forbidden symbols in a comment is how the
 * first draft of this file tripped two firewalls while importing nothing. It is proved by walking
 * the import graph from Heby's entry points in `tests/g6c-flow/authority-reachability.ts`.
 *
 * ── AUTHORITY-GATED READS, NOT AN AUTHORITY GATE ─────────────────────────────
 *
 * Two of the three owners already gate themselves on `resolveGovernanceAuthority`, so a member who
 * is not a Governance authority sees less here than the authority does. That is the owners'
 * decision, inherited rather than re-implemented: this module adds no gate of its own and removes
 * none.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { ResolvedSourceItem, SourceResolution } from "@/features/heby-runtime/contracts";
import {
  BOOTSTRAP_NON_EFFECTS,
  POST_BOOTSTRAP_AUTHORITY_MODEL,
} from "@/features/governance-decision/contracts";
import {
  readAuthorityRoster,
  readGovernanceAuthority,
} from "@/features/governance-decision/authority-read.server";
import { readRoleBaselineState } from "@/features/tenant-role-baseline/role-baseline-read.server";

/**
 * Named for what it is. `decision_records` is the Governance record itself, not a projection of
 * one, so this is the one Heby source that may call itself authoritative.
 */
export const GOVERNANCE_PROVENANCE =
  "Governance decision records — this organization's own constitutional record, tenant-scoped and " +
  "authoritative (authoritative: true).";

/** Why the source could not be resolved. Each is a real state, never a placeholder for zero. */
export const GOVERNANCE_UNAVAILABLE = Object.freeze({
  noTenant: "No authorized tenant context, so no Governance state was read.",
  persistence: "The durable store backing Governance records is not configured.",
  noAuthority:
    "This organization has no Governance authority: no bootstrap decision exists for it. " +
    "That is a read result, not a missing connection.",
});

export interface GovernanceEvidenceDeps {
  readonly readRoster?: typeof readAuthorityRoster;
  readonly readBootstrap?: typeof readGovernanceAuthority;
  readonly readRoleBaseline?: typeof readRoleBaselineState;
}

function unavailable(reason: string): SourceResolution {
  return {
    sourceClass: "governance",
    state: "unavailable",
    provenance: GOVERNANCE_PROVENANCE,
    authoritative: true,
    items: [],
    unavailableReason: reason,
  };
}

/**
 * The authority model's own declared semantics, carried as quoted DATA beside the authority record.
 *
 * These are frozen contract values the Governance surface already renders — not this module's
 * opinion, and not tenant state. They travel in `content`, which reaches only the model's grounding
 * context, so they can answer "does Governance authority enable providers?" without ever entering
 * Heby's own deterministic prose as a claim.
 */
function authorityModelStatement(): string {
  return [
    `Establishing Governance authority ${BOOTSTRAP_NON_EFFECTS.join("; ")}.`,
    `Role band grants authority: ${POST_BOOTSTRAP_AUTHORITY_MODEL.roleBandGrantsAuthority}.`,
    `Permission runtime connected: ${POST_BOOTSTRAP_AUTHORITY_MODEL.permissionRuntimeConnected}.`,
    POST_BOOTSTRAP_AUTHORITY_MODEL.limitation,
  ].join(" ");
}

/**
 * Read this tenant's Governance state for Heby grounding.
 *
 * Tenant-scoped through the owners' own predicates — this module passes the server-resolved
 * `TenantContext` through and constructs no query of its own.
 *
 * A read failure is reported as unavailable. It never degrades to an empty success, because
 * "Governance could not be read" and "this organization has no Governance" are different answers
 * and Heby must not confuse them.
 */
export async function readGovernanceGroundingSource(
  tenant: TenantContext | null,
  deps: GovernanceEvidenceDeps = {},
): Promise<SourceResolution> {
  if (typeof window !== "undefined") {
    throw new Error("Governance grounding reads are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return unavailable(GOVERNANCE_UNAVAILABLE.noTenant);

  const roster = await (deps.readRoster ?? readAuthorityRoster)(tenant);
  if (roster.status !== "read") return unavailable(GOVERNANCE_UNAVAILABLE.persistence);

  const bootstrapLookup = await (deps.readBootstrap ?? readGovernanceAuthority)(tenant);
  if (bootstrapLookup.status !== "read") return unavailable(GOVERNANCE_UNAVAILABLE.persistence);

  const bootstrap = bootstrapLookup.authority.bootstrap;
  /*
   * ZERO RECORDS IS AN ANSWER. A tenant with no bootstrap decision has no Governance, and the
   * reason says exactly that rather than "not connected" — the connection worked and found none.
   */
  if (!bootstrap) return unavailable(GOVERNANCE_UNAVAILABLE.noAuthority);

  const items: ResolvedSourceItem[] = [];

  /*
   * 1. THE AUTHORITY ITSELF, keyed by the decision that established it. `readAuthorityRoster` is
   *    the owner of "who holds authority"; the count comes from its active list rather than from
   *    any query this module wrote.
   */
  const holders = roster.roster.active.length;
  items.push({
    recordRef: bootstrap.decisionId,
    label: "Governance authority",
    detail:
      `established ${bootstrap.decidedAt} · ${holders} active ${holders === 1 ? "holder" : "holders"} · ` +
      `you ${roster.roster.viewerIsAuthority ? "hold it" : "do not hold it"}` +
      (roster.roster.viewerIsBootstrapAuthority ? " as the genesis authority" : ""),
    lifecycle: "settled",
    content: authorityModelStatement(),
  });

  /*
   * 2. THE GENESIS DECISION, keyed by the governance session that contains it, so the two records
   *    are distinguishable in the evidence set rather than collapsing onto one reference.
   *
   * `sessionId` is nullable on the decision view, so the item is omitted when there is no session
   * to point at. An evidence reference to a record that may not exist is worse than one fact fewer.
   */
  if (bootstrap.sessionId) {
    items.push({
      recordRef: bootstrap.sessionId,
      label: "Genesis governance session",
      detail:
        `${bootstrap.decisionType} / ${bootstrap.subjectType} · outcome ${bootstrap.outcome} · ` +
        `actor type ${bootstrap.actorType} · bootstrap ${bootstrap.bootstrap}`,
      lifecycle: "settled",
    });
  }

  /*
   * 3. EVERY ACTIVE AUTHORITY HOLDER BEYOND THE GENESIS, keyed by its delegation decision. Today
   *    Tenant Zero has none, so this loop contributes nothing — which is the truthful outcome and
   *    not a special case.
   */
  for (const entry of roster.roster.active) {
    if (entry.kind === "bootstrap") continue;
    items.push({
      recordRef: entry.decisionId,
      label: "Delegated Governance authority",
      detail: `delegated ${entry.since} · granted by another authority`,
      lifecycle: "settled",
    });
  }

  /*
   * 4. THE ROLE BASELINE. Its owner gates itself on Governance authority, so a non-authority
   *    legitimately gets `memberRoleId: null` and this item is omitted rather than guessed.
   */
  const baseline = await (deps.readRoleBaseline ?? readRoleBaselineState)(tenant);
  if (baseline.status === "read" && baseline.memberRoleId) {
    items.push({
      recordRef: baseline.memberRoleId,
      label: "Member role baseline",
      detail: "this organization has its ordinary member role",
      lifecycle: "settled",
    });
  }

  return {
    sourceClass: "governance",
    state: "resolved",
    provenance: GOVERNANCE_PROVENANCE,
    authoritative: true,
    items,
  };
}
