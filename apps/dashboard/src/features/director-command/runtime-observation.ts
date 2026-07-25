import { deepFreeze, validText } from "./validation";

/*
 * Phase 4E.9 — Runtime Observability Architecture.
 *
 * Canonical immutable observability metadata. A RuntimeObservation describes
 * Runtime execution; it never performs it. It is inert data only: it produces
 * no signal stream, records nothing to any sink, exports nothing, publishes
 * nothing, and reaches no observability SDK, trace-export library, adapter,
 * provider, network, buffer, deferral primitive, store, or UI. The sole
 * exception is the shared construction-time immutability guard, which rejects
 * non-inert input.
 *
 * Position in the canonical flow:
 *   RuntimeError -> RuntimeObservation -> Future Runtime Integration
 * Nothing in an earlier Runtime layer may depend on this file.
 */

export const RUNTIME_OBSERVATION_VERSION = "runtime-observation/v1";

export const RUNTIME_OBSERVATION_TYPES = ["TRACE", "SPAN", "METRIC", "LOG", "EVENT", "STATE"] as const;

export const RUNTIME_OBSERVATION_ORIGIN_LAYERS = [
  "authority",
  "policy",
  "permit",
  "engine",
  "session",
  "pipeline",
  "dispatcher",
  "adapter-invocation",
  "result",
  "retry-compensation",
  "error",
] as const;

export const RUNTIME_METRIC_AGGREGATIONS = ["count", "sum", "gauge", "histogram", "distribution"] as const;

export const RUNTIME_LOG_LEVELS = ["debug", "info", "notice", "warning", "error", "critical"] as const;

export const RUNTIME_OBSERVATION_ERROR_CODES = [
  "INVALID_OBSERVATION",
  "INVALID_TYPE",
  "INVALID_TRACE",
  "INVALID_SPAN",
  "INVALID_METRIC",
  "INVALID_LOG",
  "INVALID_TIMELINE",
  "INVALID_REFERENCE",
  "INVALID_METADATA",
  "INVALID_CORRELATION",
  "IMMUTABILITY_VIOLATION",
] as const;

export type RuntimeObservationType = (typeof RUNTIME_OBSERVATION_TYPES)[number];
export type RuntimeObservationOriginLayer = (typeof RUNTIME_OBSERVATION_ORIGIN_LAYERS)[number];
export type RuntimeMetricAggregation = (typeof RUNTIME_METRIC_AGGREGATIONS)[number];
export type RuntimeLogLevel = (typeof RUNTIME_LOG_LEVELS)[number];
type RuntimeObservationErrorCode = (typeof RUNTIME_OBSERVATION_ERROR_CODES)[number];

type MetadataValue = string | number | boolean | null | readonly MetadataValue[] | { readonly [key: string]: MetadataValue };

export interface RuntimeObservationOrigin {
  readonly layer: RuntimeObservationOriginLayer;
  readonly component: string;
  readonly operation: string;
  readonly executable: false;
  readonly authoritative: false;
}

export interface RuntimeObservationReference {
  readonly executionId: string;
  readonly correlationId: string;
  readonly resultReference: string;
  readonly errorReference: string;
  readonly executable: false;
  readonly authoritative: false;
}

export interface RuntimeObservationCorrelation {
  readonly correlationId: string;
  readonly causationId: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly executable: false;
  readonly authoritative: false;
}

export interface RuntimeObservationTimeline {
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly executable: false;
  readonly authoritative: false;
}

export interface RuntimeObservationMetadata {
  readonly recordedAt: string;
  readonly schemaVersion: string;
  readonly redactionApplied: boolean;
  readonly attributes: Readonly<Record<string, MetadataValue>>;
  readonly executable: false;
  readonly authoritative: false;
}

export interface RuntimeTraceDescriptor {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId: string;
  readonly correlationId: string;
  readonly executable: false;
  readonly authoritative: false;
}

export interface RuntimeSpanDescriptor {
  readonly name: string;
  readonly layer: RuntimeObservationOriginLayer;
  readonly operation: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly attributes: Readonly<Record<string, MetadataValue>>;
  readonly executable: false;
  readonly authoritative: false;
}

export interface RuntimeMetricDescriptor {
  readonly metricId: string;
  readonly name: string;
  readonly unit: string;
  readonly aggregation: RuntimeMetricAggregation;
  readonly dimensions: Readonly<Record<string, string>>;
  readonly executable: false;
  readonly authoritative: false;
}

export interface RuntimeLogDescriptor {
  readonly level: RuntimeLogLevel;
  readonly category: string;
  readonly template: string;
  readonly attributes: Readonly<Record<string, MetadataValue>>;
  readonly executable: false;
  readonly authoritative: false;
}

export interface RuntimeObservation {
  readonly observationId: string;
  readonly type: RuntimeObservationType;
  readonly origin: RuntimeObservationOrigin;
  readonly reference: RuntimeObservationReference;
  readonly correlation: RuntimeObservationCorrelation;
  readonly timeline: RuntimeObservationTimeline;
  readonly metadata: RuntimeObservationMetadata;
  /** Exactly one descriptor is present, matching `type`; the others are absent. */
  readonly trace?: RuntimeTraceDescriptor;
  readonly span?: RuntimeSpanDescriptor;
  readonly metric?: RuntimeMetricDescriptor;
  readonly log?: RuntimeLogDescriptor;
  readonly architectureVersion: typeof RUNTIME_OBSERVATION_VERSION;
  readonly executable: false;
  readonly authoritative: false;
}

export interface RuntimeObservationValidationError {
  readonly code: RuntimeObservationErrorCode;
  readonly message: string;
}

export interface RuntimeObservationValidation {
  readonly status: "valid" | "invalid";
  readonly error?: RuntimeObservationValidationError;
  readonly executable: false;
  readonly authoritative: false;
}

/**
 * Which descriptor a typed observation must carry. EVENT and STATE observations
 * carry none — they are described entirely by their metadata and attributes.
 */
const TYPE_DESCRIPTOR: Readonly<Record<RuntimeObservationType, "trace" | "span" | "metric" | "log" | "none">> = Object.freeze({
  TRACE: "trace",
  SPAN: "span",
  METRIC: "metric",
  LOG: "log",
  EVENT: "none",
  STATE: "none",
});

type InertValue = string | number | boolean | null | readonly InertValue[] | { readonly [key: string]: InertValue };

/**
 * Deep-copies inert data, rejecting anything that could carry behaviour or
 * shared mutable state: functions, promises, symbols, bigints, class
 * instances, cycles, non-finite numbers, and unfrozen references seen twice.
 */
function copy(value: unknown, ancestors = new WeakSet<object>(), mutableReferences = new WeakSet<object>()): InertValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "object" || value instanceof Promise || ancestors.has(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && !Array.isArray(value))) {
    throw new TypeError("Runtime Observation must contain serializable inert data.");
  }
  if (!Object.isFrozen(value) && mutableReferences.has(value)) {
    throw new TypeError("Runtime Observation must not contain shared mutable references.");
  }
  if (!Object.isFrozen(value)) mutableReferences.add(value);
  ancestors.add(value);
  const copied = Array.isArray(value)
    ? value.map((entry) => copy(entry, ancestors, mutableReferences))
    : Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copy(entry, ancestors, mutableReferences)]));
  ancestors.delete(value);
  return copied;
}

function inert(value: unknown): boolean {
  return Boolean(value) && typeof value === "object" && Object.isFrozen(value)
    && (value as { executable?: unknown }).executable === false
    && (value as { authoritative?: unknown }).authoritative === false;
}

function immutableData(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return true;
  if (!value || typeof value !== "object" || !Object.isFrozen(value) || value instanceof Promise || seen.has(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && !Array.isArray(value))) return false;
  seen.add(value);
  const valid = Object.values(value).every((entry) => immutableData(entry, seen));
  seen.delete(value);
  return valid;
}

function invalid(code: RuntimeObservationErrorCode, message: string): RuntimeObservationValidation {
  return deepFreeze({ status: "invalid" as const, error: { code, message }, executable: false as const, authoritative: false as const });
}

function nonNegativeNumber(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** Builds an immutable Runtime Observation. Describes execution; performs none. */
export function createRuntimeObservation(input: Omit<RuntimeObservation, "architectureVersion">): RuntimeObservation {
  const copied = copy(input) as unknown as Omit<RuntimeObservation, "architectureVersion">;
  const structures: readonly unknown[] = [
    copied, copied.origin, copied.reference, copied.correlation, copied.timeline, copied.metadata,
    copied.trace, copied.span, copied.metric, copied.log,
  ].filter(Boolean);
  if (structures.some((value) => (value as { executable?: unknown }).executable !== false
    || (value as { authoritative?: unknown }).authoritative !== false)) {
    throw new TypeError("Invalid Runtime Observation.");
  }
  return deepFreeze({ ...copied, architectureVersion: RUNTIME_OBSERVATION_VERSION });
}

/** Validates observation descriptors only. Never emits, traces, or publishes. */
export function validateRuntimeObservation(value: RuntimeObservation): RuntimeObservationValidation {
  if (!value || typeof value !== "object" || value.architectureVersion !== RUNTIME_OBSERVATION_VERSION
    || !value.origin || !value.reference || !value.correlation || !value.timeline || !value.metadata) {
    return invalid("INVALID_OBSERVATION", "Runtime Observation structure or schema is invalid.");
  }
  const structures = [value, value.origin, value.reference, value.correlation, value.timeline, value.metadata,
    value.trace, value.span, value.metric, value.log].filter(Boolean);
  if (!structures.every(inert) || !immutableData(value)) {
    return invalid("IMMUTABILITY_VIOLATION", "Runtime Observation must be immutable inert metadata.");
  }
  if (!validText(value.observationId)) {
    return invalid("INVALID_OBSERVATION", "Runtime Observation identifier is invalid.");
  }
  if (!(RUNTIME_OBSERVATION_TYPES as readonly string[]).includes(value.type)) {
    return invalid("INVALID_TYPE", "Runtime Observation type is invalid.");
  }
  const origin = value.origin;
  if (!(RUNTIME_OBSERVATION_ORIGIN_LAYERS as readonly string[]).includes(origin.layer)
    || ![origin.component, origin.operation].every(validText)) {
    return invalid("INVALID_OBSERVATION", "Runtime Observation origin is invalid.");
  }
  const reference = value.reference;
  if (![reference.executionId, reference.correlationId, reference.resultReference, reference.errorReference].every(validText)) {
    return invalid("INVALID_REFERENCE", "Runtime Observation reference is invalid.");
  }
  const correlation = value.correlation;
  if (![correlation.correlationId, correlation.causationId, correlation.traceId, correlation.spanId].every(validText)) {
    return invalid("INVALID_CORRELATION", "Runtime Observation correlation is invalid.");
  }
  if (correlation.correlationId !== reference.correlationId) {
    return invalid("INVALID_CORRELATION", "Runtime Observation correlation is inconsistent with its reference.");
  }
  const timeline = value.timeline;
  if (![timeline.startedAt, timeline.completedAt].every(validText) || !nonNegativeNumber(timeline.durationMs)) {
    return invalid("INVALID_TIMELINE", "Runtime Observation timeline is invalid.");
  }
  const metadata = value.metadata;
  if (!validText(metadata.recordedAt) || !validText(metadata.schemaVersion)
    || typeof metadata.redactionApplied !== "boolean"
    || !metadata.attributes || typeof metadata.attributes !== "object") {
    return invalid("INVALID_METADATA", "Runtime Observation metadata is invalid.");
  }
  // Exactly the descriptor matching the type must be present; no others.
  const expected = TYPE_DESCRIPTOR[value.type];
  const present = { trace: Boolean(value.trace), span: Boolean(value.span), metric: Boolean(value.metric), log: Boolean(value.log) };
  for (const [key, isPresent] of Object.entries(present)) {
    if (isPresent !== (expected === key)) {
      return invalid("INVALID_TYPE", `Runtime Observation of type ${value.type} must carry only its matching descriptor.`);
    }
  }
  if (value.trace) {
    const trace = value.trace;
    if (![trace.traceId, trace.spanId, trace.parentSpanId, trace.correlationId].every(validText)
      || trace.correlationId !== correlation.correlationId || trace.traceId !== correlation.traceId) {
      return invalid("INVALID_TRACE", "Runtime Observation trace descriptor is invalid.");
    }
  }
  if (value.span) {
    const span = value.span;
    if (!validText(span.name) || !validText(span.operation)
      || !(RUNTIME_OBSERVATION_ORIGIN_LAYERS as readonly string[]).includes(span.layer)
      || ![span.startedAt, span.completedAt].every(validText)
      || !span.attributes || typeof span.attributes !== "object") {
      return invalid("INVALID_SPAN", "Runtime Observation span descriptor is invalid.");
    }
  }
  if (value.metric) {
    const metric = value.metric;
    if (![metric.metricId, metric.name, metric.unit].every(validText)
      || !(RUNTIME_METRIC_AGGREGATIONS as readonly string[]).includes(metric.aggregation)
      || !metric.dimensions || typeof metric.dimensions !== "object"
      || !Object.values(metric.dimensions).every((dimension) => typeof dimension === "string")) {
      return invalid("INVALID_METRIC", "Runtime Observation metric descriptor is invalid.");
    }
  }
  if (value.log) {
    const log = value.log;
    if (!(RUNTIME_LOG_LEVELS as readonly string[]).includes(log.level)
      || ![log.category, log.template].every(validText)
      || !log.attributes || typeof log.attributes !== "object") {
      return invalid("INVALID_LOG", "Runtime Observation log descriptor is invalid.");
    }
  }
  return deepFreeze({ status: "valid" as const, executable: false as const, authoritative: false as const });
}

export { TYPE_DESCRIPTOR };
