/*
 * mock-surface-gating/gate.server.ts — the ONE owner of "may a compiled-in organizational
 * fiction be presented right now?"
 *
 * ── THE PROBLEM THIS SOLVES ──────────────────────────────────────────────────
 *
 * The Director dashboard projection is built from `organization-runtime`, `agent-runtime` and
 * `workflow-runtime`, and every one of those is seeded from a compiled-in mock: the organization
 * builder imports `hr/mock` employees, reviews, tickets, interviews, access requests and
 * offboardings, `agents/mock` departments, and `approvals/mock`; the agent and workflow CRUD
 * adapters seed themselves from `agents/mock` and `workflows/mock`. Read today the projection
 * reports `active-agents: ready, 36` and `active-workflows: ready, 14` — a fictional headcount
 * rendered under the label "Available".
 *
 * That is harmless while nobody real is looking at it, and it is a false claim about the
 * organization the moment a real tenant is. The same projection is ALSO Heby's Executive Overview
 * grounding (`heby-runtime/overview-source.server.ts` reads this exact adapter), so the fiction
 * would not merely be displayed — it would be reasoned over and spoken as organizational fact.
 *
 * ── THE SIGNAL, AND WHY THIS ONE ─────────────────────────────────────────────
 *
 * The narrowest truthful signal that already exists is the AUTHENTICATION ENVIRONMENT, which the
 * dashboard layout already treats as the authority on whether a real tenant is reachable:
 *
 *   disabled    no auth, no database, no cookies — the pre-auth demo shell. Nobody can sign in,
 *               so nothing shown here can be mistaken for a real tenant's organization.
 *   configured  real sessions resolve against the control plane and tenant identity comes from
 *               the session row. A real tenant CAN be looking.
 *   invalid     auth is enabled but misconfigured; the layout redirects to /login.
 *
 * So the question "can a real tenant see this?" is already answered server-side, by an authority
 * that exists, and this module only reads it. It invents no authority, adds no environment
 * variable, reads no tenant id or slug, and touches no database.
 *
 * DELIBERATELY NOT USED as the signal:
 *   - `companies.provisioning_source` — NULL on both seeded tenants today and meaningful as
 *     "no ceremony created this row". Reading NULL as "not production" would make the gate wrong
 *     for exactly the fixtures it must not misjudge, and G1 added the production value without
 *     any production tenant existing yet.
 *   - a tenant id or slug allowlist — brittle, and a fiction about identity rather than about
 *     data provenance.
 *   - `NODE_ENV` — describes how the bundle was built, never who is authenticated against it.
 *
 * ── FAIL CLOSED ──────────────────────────────────────────────────────────────
 *
 * Only an explicitly `disabled` environment permits the demo surfaces. `configured`, `invalid`,
 * and any resolution that throws all withhold them. A gate that fails open would present fiction
 * during exactly the misconfiguration it exists to survive.
 *
 * Server-only. This decides presentation; it is not an authorization boundary, grants nothing,
 * revokes nothing, and no caller may treat it as permission to read or write anything.
 */
import { getAuthEnvironment } from "@/features/auth-runtime/request-session.server";

/** Why a demo organizational surface was withheld. Presentation reason, never an authz reason. */
export type MockSurfaceGateReason = "real-tenant-reachable" | "auth-environment-unresolved";

export interface MockSurfaceGateDecision {
  /** True only in the pre-auth demo shell, where no real tenant can exist. */
  readonly permitted: boolean;
  /** Present only when withheld. */
  readonly reason?: MockSurfaceGateReason;
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Mock surface gating is server-only.");
  }
}

/**
 * May compiled-in organizational demo data be presented in this environment?
 *
 * `true` ONLY when authentication is explicitly disabled — the pre-auth shell, where the seeded
 * dashboard is the intended development and reference experience. Every other outcome withholds
 * it, including a resolution error.
 */
export function resolveMockSurfaceGate(): MockSurfaceGateDecision {
  assertServerRuntime();
  try {
    const environment = getAuthEnvironment();
    if (environment.status === "disabled") return Object.freeze({ permitted: true });
    return Object.freeze({ permitted: false, reason: "real-tenant-reachable" as const });
  } catch {
    /* An environment that cannot be resolved is not an environment that may be trusted to be a
     * demo. Withhold rather than guess. */
    return Object.freeze({ permitted: false, reason: "auth-environment-unresolved" as const });
  }
}

/** Convenience predicate. Same decision, boolean shape. */
export function organizationalDemoDataPermitted(): boolean {
  return resolveMockSurfaceGate().permitted;
}
