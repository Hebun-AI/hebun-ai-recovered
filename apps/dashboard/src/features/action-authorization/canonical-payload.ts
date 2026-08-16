/*
 * action-authorization/canonical-payload.ts — WHAT WAS APPROVED == WHAT MAY BE EXECUTED (R3A).
 *
 * A permit is worthless if the parameters can drift between approval and execution. This module
 * is the entire binding: one deterministic serialization, one SHA-256 over it, re-verified at
 * consumption. A mismatch is refused, never repaired.
 *
 * WHY A PLAIN DIGEST AND NOT AN HMAC. The identity-enrollment continuation reference is SECRET
 * material, so it is keyed with `createHmac` and only the digest is ever stored. An action payload
 * is the opposite: it is shown to a human, in full, because a human cannot approve what they
 * cannot read. Keying it would imply a confidentiality this data does not have and would add a
 * key-management dependency to a content check.
 *
 * WHY NOT REUSE `HebyPreparedAction.actionId`. That identity is FNV-1a — a 32-bit non-cryptographic
 * hash, as its own source comments say. It is right for dedupe and wrong for a security binding:
 * 32 bits is searchable in seconds, so a second action could present the same identity and inherit
 * an approval. Both values are carried; only this one binds.
 *
 * WHAT CANNOT ENTER A PAYLOAD. The Heby argument schema admits `string | number | boolean` and
 * fails closed on unknown keys, so a credential, a token, a nested object, or free model prose is
 * structurally unable to reach this function. That is why the digest input is total and stable.
 *
 * Pure. No I/O, no database, no clock, no authority.
 */
import { createHash } from "node:crypto";

/** The only value shapes an approved action may carry. Mirrors `HebyArgumentValue`. */
export type CanonicalScalar = string | number | boolean;

export type CanonicalPayload = Readonly<Record<string, CanonicalScalar>>;

export interface CanonicalActionIdentity {
  readonly actionKind: string;
  readonly toolId: string;
  readonly targetKind: string | null;
  readonly targetRef: string | null;
  readonly payload: CanonicalPayload;
}

/** A scalar's canonical form. Typed rather than stringified loosely, so `1` and `"1"` differ. */
function encodeScalar(value: CanonicalScalar): string {
  if (typeof value === "string") return `s:${value}`;
  if (typeof value === "boolean") return `b:${value ? "1" : "0"}`;
  /*
   * Number.isFinite rather than typeof alone: NaN and ±Infinity have no stable serialization, and
   * a digest that silently accepted them would bind an approval to a value nobody can reproduce.
   */
  if (!Number.isFinite(value)) {
    throw new TypeError("Action payload numbers must be finite.");
  }
  return `n:${value}`;
}

/**
 * Reject anything the schema should already have excluded. Belt and braces: this function is the
 * last point before a value becomes an approval, so it fails closed rather than trusting upstream.
 */
function assertScalar(key: string, value: unknown): asserts value is CanonicalScalar {
  const t = typeof value;
  if (t !== "string" && t !== "number" && t !== "boolean") {
    throw new TypeError(`Action payload key "${key}" is not a permitted scalar.`);
  }
}

/**
 * Deterministic serialization of an action's approvable content.
 *
 * Key order is sorted, so two payloads that differ only in insertion order produce ONE digest.
 * Separators are characters a JSON scalar cannot contain unescaped, so `{"a=1,b": 2}` and
 * `{"a": "1,b=2"}` cannot collide by concatenation — the classic canonicalization bug.
 */
export function serializeCanonicalAction(identity: CanonicalActionIdentity): string {
  const entries = Object.keys(identity.payload)
    .sort()
    .map((key) => {
      const value = identity.payload[key];
      assertScalar(key, value);
      return `${JSON.stringify(key)}${encodeScalar(value)}`;
    });

  return [
    `kind${identity.actionKind}`,
    `tool${identity.toolId}`,
    `target${identity.targetKind ?? ""}${identity.targetRef ?? ""}`,
    `args${entries.join("")}`,
  ].join("");
}

/** SHA-256, lowercase hex, 64 characters — the shape the database CHECK constraints enforce. */
export function digestCanonicalAction(identity: CanonicalActionIdentity): string {
  return createHash("sha256").update(serializeCanonicalAction(identity), "utf8").digest("hex");
}

/**
 * Constant-time-ish equality for two hex digests.
 *
 * Both operands here are server-side values rather than attacker-supplied secrets, so this is
 * defence in depth rather than a required countermeasure; it costs nothing and removes a class of
 * question from review.
 */
export function digestsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length || a.length !== 64) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Narrow an untyped record to a canonical payload, or fail.
 *
 * Used when reading a stored `canonical_payload` back out of jsonb: the column is typed `unknown`
 * at the driver boundary, and a row that somehow holds a non-scalar must refuse consumption rather
 * than be coerced into one.
 */
export function asCanonicalPayload(value: unknown): CanonicalPayload | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, CanonicalScalar> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const t = typeof raw;
    if (t !== "string" && t !== "number" && t !== "boolean") return null;
    if (t === "number" && !Number.isFinite(raw)) return null;
    out[key] = raw as CanonicalScalar;
  }
  return Object.freeze(out);
}
