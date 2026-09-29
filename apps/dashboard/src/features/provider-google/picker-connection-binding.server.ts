/*
 * provider-google/picker-connection-binding.server.ts — THE PICKER CHOSE A FILE THROUGH ONE GOOGLE
 * CONNECTION; THE BYTES ARE READ THROUGH THAT CONNECTION AND NO OTHER
 * (GOOGLE-DRIVE-PICKER-CONNECTION-INTEGRITY-1).
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 *
 * The Picker session and the later Drive read each asked the availability view for "a source that can
 * read `google.drive.file.content.read`" and took the FIRST one. With two `google-workspace`
 * connections in one organization (two Google accounts), nothing tied the read to the account whose
 * token opened the chooser: a disconnect, a health change or a re-order between the two steps made the
 * read run under a different account than the one the human chose the file with. Same tenant, same
 * provider, same capability — and a different provider identity.
 *
 *     CAPABILITY AVAILABLE SOMEWHERE  !=  THE CONNECTION THE FILE WAS CHOSEN WITH
 *     SAME PROVIDER                   !=  SAME ACCOUNT
 *
 * ── THE BINDING ───────────────────────────────────────────────────────────────
 *
 * When the Picker session is minted, the server names the exact connection it spent — its integration
 * id and the Google account (`sub`) the Integration authority has bound to it — together with the
 * tenant, the human, their session context, the per-file capability and an expiry, and SIGNS that.
 * The browser carries the result back unchanged beside the file id. It is opaque to the browser in
 * the sense that matters: it cannot be altered or minted there, and it carries no token, no credential
 * id and no secret — only identifiers the server re-checks.
 *
 * At admission, `resolveBoundDriveFileConnection`:
 *
 *   1. verifies the signature (constant time) BEFORE reading the payload, then version and expiry
 *   2. requires the payload's tenant, human and session context to be the CURRENT ones
 *   3. finds, in THIS tenant's availability view for the per-file capability, the source whose
 *      integration id is EXACTLY the bound one — never "the first", never "the next"
 *   4. requires that source to be a `google-workspace` connection that can read right now
 *   5. reads the connection from the Integration authority and requires its bound account to be
 *      EXACTLY the bound one (GOOGLE-OAUTH-ACCOUNT-INTEGRITY-1 makes an account change a refusal and a
 *      reconnect a NEW row, so either shows up here as a mismatch)
 *
 * Any failure is a refusal. There is no fallback connection, no retry against another account, and no
 * path that reads a Drive file without a verified binding.
 *
 * ── WHY THIS SECRET ──────────────────────────────────────────────────────────
 *
 * `HEBUN_GOOGLE_OAUTH_STATE_SECRET`, under the label `picker-binding:` — the same domain-separated use
 * `oauth-state.server.ts` already makes of it (`state:` and `session:`). An OAuth state can never
 * verify as a binding or the reverse, because each signature covers its own label. No new secret, no
 * new configuration: a deployment that can connect Google can bind a Picker session; one that cannot
 * connect Google has no Picker session to bind.
 *
 * ── NOT SINGLE-USE, BY DESIGN ────────────────────────────────────────────────
 *
 * One Picker session may hand back more than one file (a later batch supply), and every one of them
 * must be read through the same connection — so the binding is bounded by expiry, human, session and
 * tenant, not consumed. Replaying it within those bounds reads through the same connection the human
 * already authorized, which is the property being protected.
 *
 * Server-only. Writes nothing.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { getCapabilityAvailability } from "@/features/integration-authority/capability-availability.server";
import { readConnection } from "@/features/integration-authority/integration-read.server";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { GOOGLE_DRIVE_FILE_CAPABILITY, GOOGLE_PROVIDER_KEY } from "./contracts";
import { resolveGoogleOAuthEnvironment } from "./google-environment.server";

/** Thirty minutes: a chooser, a choice, and the admission that follows it. */
export const PICKER_BINDING_TTL_SECONDS = 1800;

const BINDING_VERSION = "pb1" as const;
const LABEL = "picker-binding:";
/** Far above a real binding (~400 bytes), low enough that a hostile value is refused before parsing. */
const MAX_BINDING_LENGTH = 2048;

export interface PickerBindingPayload {
  readonly version: typeof BINDING_VERSION;
  readonly tenantId: string;
  readonly userId: string;
  readonly sessionContextId: string;
  readonly integrationId: string;
  /** The Google `sub` the Integration authority bound to that connection when the session was minted. */
  readonly externalAccountId: string;
  readonly capability: typeof GOOGLE_DRIVE_FILE_CAPABILITY;
  /** Absolute, seconds since epoch. Inside the signature, so it cannot be extended. */
  readonly expiresAt: number;
}

export type PickerBindingRefusal =
  | "binding-missing"
  | "binding-malformed"
  | "binding-signature-invalid"
  | "binding-expired"
  | "binding-context-mismatch"
  | "bound-connection-unavailable"
  | "bound-account-mismatch"
  | "binding-unconfigured";

export interface PickerBindingDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly nowSeconds?: () => number;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") throw new Error("Picker connection binding is server-only.");
}

function secretFrom(env: Readonly<Record<string, string | undefined>>): string | null {
  const resolution = resolveGoogleOAuthEnvironment(env);
  return resolution.status === "configured" ? resolution.stateSecret : null;
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(`${LABEL}${body}`).digest("base64url");
}

/**
 * Seal the binding for ONE Picker session. Called only by the Picker ceremony, with the connection it
 * is about to spend and the account the Integration authority holds for it.
 */
export function sealPickerBinding(
  tenant: Pick<TenantContext, "tenantId" | "userId" | "sessionContextId">,
  connection: { readonly integrationId: string; readonly externalAccountId: string },
  deps: Pick<PickerBindingDeps, "env" | "nowSeconds"> = {},
): string | null {
  assertServerOnly();
  const secret = secretFrom(deps.env ?? process.env);
  if (!secret) return null;
  const now = (deps.nowSeconds ?? (() => Math.floor(Date.now() / 1000)))();
  const payload: PickerBindingPayload = {
    version: BINDING_VERSION,
    tenantId: tenant.tenantId,
    userId: tenant.userId,
    sessionContextId: tenant.sessionContextId,
    integrationId: connection.integrationId,
    externalAccountId: connection.externalAccountId,
    capability: GOOGLE_DRIVE_FILE_CAPABILITY,
    expiresAt: now + PICKER_BINDING_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

function isPayload(value: unknown): value is PickerBindingPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === BINDING_VERSION &&
    typeof v.tenantId === "string" &&
    typeof v.userId === "string" &&
    typeof v.sessionContextId === "string" &&
    typeof v.integrationId === "string" &&
    typeof v.externalAccountId === "string" &&
    v.externalAccountId.length > 0 &&
    v.capability === GOOGLE_DRIVE_FILE_CAPABILITY &&
    typeof v.expiresAt === "number" &&
    Number.isSafeInteger(v.expiresAt)
  );
}

/** Signature first, then shape, then time. A forged payload never reaches the code that trusts it. */
export function openPickerBinding(
  binding: unknown,
  deps: Pick<PickerBindingDeps, "env" | "nowSeconds"> = {},
): { readonly ok: true; readonly payload: PickerBindingPayload } | { readonly ok: false; readonly reason: PickerBindingRefusal } {
  assertServerOnly();
  if (typeof binding !== "string" || binding.length === 0) return { ok: false, reason: "binding-missing" };
  if (binding.length > MAX_BINDING_LENGTH) return { ok: false, reason: "binding-malformed" };
  const secret = secretFrom(deps.env ?? process.env);
  if (!secret) return { ok: false, reason: "binding-unconfigured" };
  const parts = binding.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "binding-malformed" };
  const [body, signature] = parts as [string, string];
  const given = Buffer.from(signature, "utf8");
  const expected = Buffer.from(sign(body, secret), "utf8");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "binding-signature-invalid" };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "binding-malformed" };
  }
  if (!isPayload(payload)) return { ok: false, reason: "binding-malformed" };
  const now = (deps.nowSeconds ?? (() => Math.floor(Date.now() / 1000)))();
  if (payload.expiresAt <= now) return { ok: false, reason: "binding-expired" };
  return { ok: true, payload };
}

export type BoundDriveFileConnection =
  | { readonly status: "bound"; readonly integrationId: string; readonly externalAccountId: string }
  | { readonly status: "refused"; readonly reason: PickerBindingRefusal };

/**
 * The ONE connection a Drive read for this Picker selection may use — or a refusal. Every check is
 * made against current authoritative state for the current human; nothing is taken from the payload
 * without being matched against it.
 */
export async function resolveBoundDriveFileConnection(
  tenant: TenantContext,
  binding: unknown,
  deps: PickerBindingDeps = {},
): Promise<BoundDriveFileConnection> {
  assertServerOnly();
  const opened = openPickerBinding(binding, deps);
  if (!opened.ok) return { status: "refused", reason: opened.reason };
  const p = opened.payload;
  if (p.tenantId !== tenant.tenantId || p.userId !== tenant.userId || p.sessionContextId !== tenant.sessionContextId) {
    return { status: "refused", reason: "binding-context-mismatch" };
  }

  /* The capability, on EXACTLY the bound connection. Aggregate availability is not enough. */
  const availability = await getCapabilityAvailability(tenant, { getDb: deps.getDb });
  const entry = availability.capabilities.find((c) => c.capability === GOOGLE_DRIVE_FILE_CAPABILITY);
  const source = entry?.sources.find((s) => s.integrationId === p.integrationId);
  if (!source || !source.readAvailable || source.providerKey !== GOOGLE_PROVIDER_KEY) {
    return { status: "refused", reason: "bound-connection-unavailable" };
  }

  /* The account, as the Integration authority holds it NOW, must be the one the chooser ran as. */
  const connection = await readConnection(tenant, p.integrationId, { getDb: deps.getDb });
  if (!connection || connection.providerKey !== GOOGLE_PROVIDER_KEY) {
    return { status: "refused", reason: "bound-connection-unavailable" };
  }
  if (connection.externalAccountId === null || connection.externalAccountId !== p.externalAccountId) {
    return { status: "refused", reason: "bound-account-mismatch" };
  }
  return { status: "bound", integrationId: p.integrationId, externalAccountId: p.externalAccountId };
}
