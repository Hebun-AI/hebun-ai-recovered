/*
 * device-runtime/session.ts — bounded device session model + validation (UI Phase 18).
 *
 * A device session is bounded to a tenant, a device, a LEAST-PRIVILEGE capability snapshot, an
 * authority context, and a lifetime. Phase 18 establishes NONE — there is no runtime to establish
 * one — so validation of "the current session" is always non-established. The validator exists so a
 * future runtime checks session state AT INVOCATION TIME (not a stale snapshot): an expired or
 * revoked session blocks, and a capability outside the session's snapshot is escalation and blocks.
 */

import type {
  DeviceCapability,
  DeviceSession,
  DeviceSessionRequirement,
  DeviceSessionState,
} from "./contracts";

/** A device action requires a session scoped to exactly the one capability it needs (least privilege). */
export function deviceSessionRequirement(capability: DeviceCapability): DeviceSessionRequirement {
  return { required: true, leastPrivilegeCapability: capability };
}

export interface SessionValidation {
  readonly valid: boolean;
  readonly state: DeviceSessionState;
  readonly reasons: readonly string[];
}

/**
 * Validate a session for a specific capability at invocation time. A session is valid only when it
 * is active, not expired, not revoked, matches the tenant, and its snapshot INCLUDES the requested
 * capability (no in-session escalation). With no runtime, callers hold no session, so the common
 * path is `not-established`.
 */
export function validateDeviceSession(input: {
  session?: DeviceSession;
  tenantId: string;
  capability: DeviceCapability;
  nowTick?: number;
}): SessionValidation {
  const { session, tenantId, capability, nowTick } = input;

  if (!session) {
    return {
      valid: false,
      state: "not-established",
      reasons: ["No device session is established; no runtime can establish one."],
    };
  }

  const reasons: string[] = [];
  if (session.state === "revoked") reasons.push("Session has been revoked.");
  if (session.state === "expired") reasons.push("Session has expired.");
  if (session.state === "not-established") reasons.push("Session is not established.");
  if (session.tenantId !== tenantId) reasons.push("Session belongs to a different tenant.");
  if (typeof session.expiresAtTick === "number" && typeof nowTick === "number" && nowTick > session.expiresAtTick) {
    reasons.push("Session lifetime has elapsed.");
  }
  // No in-session capability escalation: a new capability requires a new validation.
  if (!session.capabilitySnapshot.includes(capability)) {
    reasons.push(`Capability ${capability} is outside the session's least-privilege snapshot.`);
  }

  const valid = reasons.length === 0 && session.state === "active";
  return {
    valid,
    state: valid ? "active" : session.state === "active" ? "expired" : session.state,
    reasons,
  };
}
