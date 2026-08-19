/*
 * governance-decision/persistence.server.ts — the Governance subsystem's shared INFRASTRUCTURE.
 *
 * ── WHY THIS MODULE EXISTS ───────────────────────────────────────────────────
 *
 * These four symbols lived in `bootstrap-authority.server.ts` — the module that also exports
 * `establishGovernanceAuthority`, the act that creates a tenant's government. Measured across the
 * repository, 27 modules imported that file and only ONE of them wanted the writer:
 *
 *   resolveGovernanceDbOrNull          23 importers
 *   GovernanceDeps                      8
 *   validateJustification               7
 *   isGovernancePersistenceConfigured   1
 *   readGovernanceAuthority             2   (an authority READ — now in authority-read.server.ts)
 *   establishGovernanceAuthority        1   (the writer)
 *
 * So the constitution was transitively loaded into two dozen module graphs because it happened to
 * be where a database-handle helper lived. That included Heby's answer path, by way of R3W's
 * work-artifact evidence adapter, which wanted `resolveGovernanceDbOrNull` and nothing else.
 *
 * NONE OF THESE FOUR IS AUTHORITY. A connection helper, a dependency-injection type, a
 * configuration predicate and a length check decide nothing and grant nothing. Keeping them beside
 * a writer made "may this module reach the constitution?" impossible to answer by inspection.
 *
 * ── WHAT MOVED, AND WHAT DID NOT ─────────────────────────────────────────────
 *
 * Implementations MOVED here; none was copied. `bootstrap-authority.server.ts` re-exports them so
 * every existing caller keeps working and no second definition exists anywhere.
 *
 * This module contains no INSERT, no UPDATE, no DELETE, no transaction, and no authority
 * resolution. It is the floor the Governance subsystem stands on, not part of the subsystem's
 * decision-making.
 *
 * Server-only.
 */
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { JUSTIFICATION_LIMITS } from "./contracts";

/** Dependency injection shared by every Governance read and write. Decides nothing itself. */
export interface GovernanceDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

/** The control-plane database, or an honest `null` when it is not configured. */
export function resolveGovernanceDbOrNull(): ControlPlaneDatabase | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

export function isGovernancePersistenceConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env.DATABASE_URL?.trim());
}

/**
 * Normalise and validate a human-authored justification.
 *
 * It is treated as INERT TEXT and nothing else: it is never parsed, never rendered as HTML, never
 * interpolated into SQL (the driver parameterises it), and never read by a model as instruction.
 * `<script>`, `' OR 1=1 --`, `/terminal restart production`, `Ignore previous instructions` and
 * `../etc/passwd` are all just characters that get stored and shown back verbatim.
 *
 * The only rules are length rules, because the only claim being made is "a human wrote a reason".
 */
export function validateJustification(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < JUSTIFICATION_LIMITS.minimumLength) return null;
  if (trimmed.length > JUSTIFICATION_LIMITS.maximumLength) return null;
  return trimmed;
}
