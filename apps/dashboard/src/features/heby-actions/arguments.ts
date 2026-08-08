/*
 * heby-actions/arguments.ts — typed tool-argument validation that FAILS CLOSED (Phase 17).
 *
 * The required boundary: model/user output → PROPOSED typed arguments → schema validation →
 * (later) policy/authority validation → invocation. Free-form text never becomes a raw call.
 * This module owns the schema step: it accepts a still-untrusted `Record<string, unknown>` and
 * returns ONLY a fully typed, schema-conforming argument set, or fails closed with issues and an
 * empty argument set. Any unknown key, missing required field, wrong type, or out-of-enum value
 * is a failure — nothing is coerced, nothing is guessed, nothing is passed through.
 *
 * It performs STRUCTURAL validation only (kind/shape/enum). Whether a `route`/`workspace` names a
 * real destination, or a `record-ref` resolves to retrieved evidence, is a capability/target
 * concern checked in capability-gate — kept separate so this module has no navigation coupling.
 */

import type {
  HebyArgumentField,
  HebyArguments,
  HebyArgumentSchema,
  HebyArgumentValue,
} from "./contracts";

export interface ArgumentValidation {
  readonly valid: boolean;
  /** The typed arguments when valid; ALWAYS empty when invalid (fail closed). */
  readonly arguments: HebyArguments;
  readonly issues: readonly string[];
}

function validateField(
  field: HebyArgumentField,
  raw: Record<string, unknown>,
  present: boolean,
): { value?: HebyArgumentValue; issue?: string } {
  if (!present) {
    if (field.required) return { issue: `Missing required argument "${field.name}".` };
    return {};
  }
  const value = raw[field.name];
  switch (field.kind) {
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return { issue: `Argument "${field.name}" must be a finite number.` };
      }
      return { value };
    case "boolean":
      if (typeof value !== "boolean") return { issue: `Argument "${field.name}" must be a boolean.` };
      return { value };
    case "enum":
      if (typeof value !== "string") return { issue: `Argument "${field.name}" must be a string.` };
      if (!field.enumValues || !field.enumValues.includes(value)) {
        return { issue: `Argument "${field.name}" is not an allowed value.` };
      }
      return { value };
    case "string":
    case "record-ref":
    case "route":
    case "workspace":
      if (typeof value !== "string" || value.trim().length === 0) {
        return { issue: `Argument "${field.name}" must be a non-empty string.` };
      }
      return { value };
    default: {
      // Exhaustiveness guard — an unrecognised kind fails closed rather than passing through.
      const unreachable: never = field.kind;
      return { issue: `Argument "${field.name}" has an unknown kind (${String(unreachable)}).` };
    }
  }
}

/**
 * Validate a raw argument object against a schema. Fails closed: on ANY issue the returned
 * `arguments` is empty and `valid` is false, so a partially-valid set can never reach a tool.
 */
export function validateArguments(
  schema: HebyArgumentSchema,
  proposed: Readonly<Record<string, unknown>> | undefined,
): ArgumentValidation {
  const raw: Record<string, unknown> = { ...(proposed ?? {}) };
  const issues: string[] = [];
  const accepted: Record<string, HebyArgumentValue> = {};

  const knownNames = new Set(schema.fields.map((f) => f.name));

  // Reject unknown keys outright — no silent pass-through of unexpected input.
  for (const key of Object.keys(raw)) {
    if (!knownNames.has(key)) issues.push(`Unknown argument "${key}".`);
  }

  for (const field of schema.fields) {
    const present = Object.prototype.hasOwnProperty.call(raw, field.name);
    const result = validateField(field, raw, present);
    if (result.issue) {
      issues.push(result.issue);
    } else if (result.value !== undefined) {
      accepted[field.name] = result.value;
    }
  }

  if (issues.length > 0) {
    return { valid: false, arguments: {}, issues };
  }
  return { valid: true, arguments: Object.freeze(accepted), issues: [] };
}
