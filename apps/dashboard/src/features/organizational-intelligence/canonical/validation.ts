/*
 * Phase 5A — Organizational Intelligence Canonical Contracts.
 * Shared, inert validation utilities.
 *
 * Pure and infrastructure-free. Nothing here executes, persists, networks,
 * authenticates, authorizes, schedules, emits, logs, or renders. It only
 * copies, freezes, and inspects declarative data.
 */

export type MetadataValue = string | number | boolean | null | readonly MetadataValue[] | { readonly [key: string]: MetadataValue };

/** Canonical lifecycle vocabulary shared by every Phase 5A entity. */
export const ORGANIZATIONAL_LIFECYCLE_STATES = ["draft", "active", "suspended", "archived", "retired"] as const;
export type OrganizationalLifecycleStatus = (typeof ORGANIZATIONAL_LIFECYCLE_STATES)[number];

export interface OrganizationalLifecycle {
  readonly status: OrganizationalLifecycleStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly executable: false;
  readonly authoritative: false;
}

export interface OrganizationalProvenance {
  readonly createdBy: string;
  readonly createdAt: string;
  readonly sourceSystem: string;
  readonly executable: false;
  readonly authoritative: false;
}

export interface OrganizationalEffectivePeriod {
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly executable: false;
  readonly authoritative: false;
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

export function validText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= 256;
}

export function validVersion(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/.test(value);
}

export function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && Number.isFinite(Date.parse(value));
}

/** Only the listed own-keys may be present — blocks smuggled fields (credentials, parents, etc.). */
export function hasOnlyKeys(value: object, allowed: readonly string[]): boolean {
  const permitted = new Set(allowed);
  return Object.keys(value).every((key) => permitted.has(key));
}

/**
 * Deep-copies inert declarative data, rejecting anything that could carry
 * behaviour or shared mutable state: functions, promises, symbols, bigints,
 * non-finite numbers, class instances, cycles, and unfrozen references reused.
 */
export function copy(value: unknown, ancestors = new WeakSet<object>(), mutableReferences = new WeakSet<object>()): MetadataValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "object" || value instanceof Promise || ancestors.has(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && !Array.isArray(value))) {
    throw new TypeError("Organizational contract must contain serializable inert data.");
  }
  if (!Object.isFrozen(value) && mutableReferences.has(value)) {
    throw new TypeError("Organizational contract must not contain shared mutable references.");
  }
  if (!Object.isFrozen(value)) mutableReferences.add(value);
  ancestors.add(value);
  const copied = Array.isArray(value)
    ? value.map((entry) => copy(entry, ancestors, mutableReferences))
    : Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copy(entry, ancestors, mutableReferences)]));
  ancestors.delete(value);
  return copied;
}

export function inert(value: unknown): boolean {
  return Boolean(value) && typeof value === "object" && Object.isFrozen(value)
    && (value as { executable?: unknown }).executable === false
    && (value as { authoritative?: unknown }).authoritative === false;
}

export function immutableData(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return true;
  if (!value || typeof value !== "object" || !Object.isFrozen(value) || value instanceof Promise || seen.has(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && !Array.isArray(value))) return false;
  seen.add(value);
  const valid = Object.values(value).every((entry) => immutableData(entry, seen));
  seen.delete(value);
  return valid;
}

/** A metadata bag must be an inert plain object of serializable values. */
export function validMetadata(value: unknown): value is Readonly<Record<string, MetadataValue>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype && immutableData(value);
}

export function validLifecycle(value: unknown): value is OrganizationalLifecycle {
  const lifecycle = value as OrganizationalLifecycle;
  return inert(value)
    && (ORGANIZATIONAL_LIFECYCLE_STATES as readonly string[]).includes(lifecycle.status)
    && validTimestamp(lifecycle.createdAt) && validTimestamp(lifecycle.updatedAt)
    && Date.parse(lifecycle.updatedAt) >= Date.parse(lifecycle.createdAt)
    && hasOnlyKeys(lifecycle, ["status", "createdAt", "updatedAt", "executable", "authoritative"]);
}

export function validProvenance(value: unknown): value is OrganizationalProvenance {
  const provenance = value as OrganizationalProvenance;
  return inert(value) && validText(provenance.createdBy) && validTimestamp(provenance.createdAt)
    && validText(provenance.sourceSystem)
    && hasOnlyKeys(provenance, ["createdBy", "createdAt", "sourceSystem", "executable", "authoritative"]);
}

export function validEffectivePeriod(value: unknown): value is OrganizationalEffectivePeriod {
  const period = value as OrganizationalEffectivePeriod;
  if (!inert(value) || !validTimestamp(period.validFrom)
    || !hasOnlyKeys(period, ["validFrom", "validTo", "executable", "authoritative"])) return false;
  if (period.validTo === null) return true;
  return validTimestamp(period.validTo) && Date.parse(period.validTo) >= Date.parse(period.validFrom);
}
