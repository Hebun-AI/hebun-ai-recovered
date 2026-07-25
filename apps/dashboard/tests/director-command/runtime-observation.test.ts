import assert from "node:assert/strict";
import {
  createRuntimeObservation,
  RUNTIME_LOG_LEVELS,
  RUNTIME_METRIC_AGGREGATIONS,
  RUNTIME_OBSERVATION_ORIGIN_LAYERS,
  RUNTIME_OBSERVATION_TYPES,
  RUNTIME_OBSERVATION_VERSION,
  validateRuntimeObservation,
  type RuntimeObservation,
} from "../../src/features/director-command";

const inert = { executable: false as const, authoritative: false as const };

function origin(overrides: Record<string, unknown> = {}) {
  return { layer: "engine" as const, component: "runtime-engine", operation: "invoke", ...inert, ...overrides };
}
function reference(overrides: Record<string, unknown> = {}) {
  return { executionId: "e-1", correlationId: "c-1", resultReference: "r-1", errorReference: "err-1", ...inert, ...overrides };
}
function correlation(overrides: Record<string, unknown> = {}) {
  return { correlationId: "c-1", causationId: "cause-1", traceId: "tr-1", spanId: "sp-1", ...inert, ...overrides };
}
function timeline(overrides: Record<string, unknown> = {}) {
  return { startedAt: "2026-01-01T00:00:00Z", completedAt: "2026-01-01T00:00:01Z", durationMs: 1000, ...inert, ...overrides };
}
function metadata(overrides: Record<string, unknown> = {}) {
  return { recordedAt: "2026-01-01T00:00:01Z", schemaVersion: "1.0.0", redactionApplied: true, attributes: {}, ...inert, ...overrides };
}
function traceDescriptor(overrides: Record<string, unknown> = {}) {
  return { traceId: "tr-1", spanId: "sp-1", parentSpanId: "sp-0", correlationId: "c-1", ...inert, ...overrides };
}
function spanDescriptor(overrides: Record<string, unknown> = {}) {
  return { name: "invoke.span", layer: "engine" as const, operation: "invoke", startedAt: "2026-01-01T00:00:00Z", completedAt: "2026-01-01T00:00:01Z", attributes: { ok: true }, ...inert, ...overrides };
}
function metricDescriptor(overrides: Record<string, unknown> = {}) {
  return { metricId: "m-1", name: "latency", unit: "ms", aggregation: "histogram" as const, dimensions: { region: "eu" }, ...inert, ...overrides };
}
function logDescriptor(overrides: Record<string, unknown> = {}) {
  return { level: "info" as const, category: "runtime.engine", template: "invoked {op}", attributes: { op: "x" }, ...inert, ...overrides };
}
function base(overrides: Record<string, unknown> = {}): Omit<RuntimeObservation, "architectureVersion"> {
  return {
    observationId: "obs-1", type: "EVENT", origin: origin(), reference: reference(),
    correlation: correlation(), timeline: timeline(), metadata: metadata(), ...inert, ...overrides,
  } as Omit<RuntimeObservation, "architectureVersion">;
}
const traceObs = (o: Record<string, unknown> = {}) => base({ type: "TRACE", trace: traceDescriptor(), ...o });
const spanObs = (o: Record<string, unknown> = {}) => base({ type: "SPAN", span: spanDescriptor(), ...o });
const metricObs = (o: Record<string, unknown> = {}) => base({ type: "METRIC", metric: metricDescriptor(), ...o });
const logObs = (o: Record<string, unknown> = {}) => base({ type: "LOG", log: logDescriptor(), ...o });
const v = (input: Omit<RuntimeObservation, "architectureVersion">) => validateRuntimeObservation(createRuntimeObservation(input));

/* ── Construction ──────────────────────────────────────────────── */
function construction(): void {
  const obs = createRuntimeObservation(base());
  assert.equal(obs.architectureVersion, RUNTIME_OBSERVATION_VERSION);
  assert.equal(obs.executable, false);
  assert.equal(obs.authoritative, false);
  assert.equal(validateRuntimeObservation(obs).status, "valid");
  assert.equal(Object.isFrozen(validateRuntimeObservation(obs)), true);
}

/* ── Observation types ─────────────────────────────────────────── */
function observationTypes(): void {
  assert.deepEqual([...RUNTIME_OBSERVATION_TYPES], ["TRACE", "SPAN", "METRIC", "LOG", "EVENT", "STATE"]);
  assert.equal(v(traceObs()).status, "valid");
  assert.equal(v(spanObs()).status, "valid");
  assert.equal(v(metricObs()).status, "valid");
  assert.equal(v(logObs()).status, "valid");
  assert.equal(v(base({ type: "EVENT" })).status, "valid");
  assert.equal(v(base({ type: "STATE" })).status, "valid");
  assert.equal(v(base({ type: "NOISE" as never })).error?.code, "INVALID_TYPE");
  // The descriptor must match the type: exactly one, and the right one.
  assert.equal(v(base({ type: "TRACE" })).error?.code, "INVALID_TYPE"); // missing trace
  assert.equal(v(base({ type: "EVENT", metric: metricDescriptor() })).error?.code, "INVALID_TYPE"); // extra descriptor
  assert.equal(v(traceObs({ span: spanDescriptor() })).error?.code, "INVALID_TYPE"); // two descriptors
}

/* ── Trace descriptor ──────────────────────────────────────────── */
function traceDescriptorModel(): void {
  assert.equal(v(traceObs()).status, "valid");
  assert.equal(v(traceObs({ trace: traceDescriptor({ traceId: "" }) })).error?.code, "INVALID_TRACE");
  assert.equal(v(traceObs({ trace: traceDescriptor({ parentSpanId: "  " }) })).error?.code, "INVALID_TRACE");
  // Trace ids must agree with the observation correlation.
  assert.equal(v(traceObs({ trace: traceDescriptor({ correlationId: "other" }) })).error?.code, "INVALID_TRACE");
  assert.equal(v(traceObs({ trace: traceDescriptor({ traceId: "tr-x" }) })).error?.code, "INVALID_TRACE");
}

/* ── Span descriptor ───────────────────────────────────────────── */
function spanDescriptorModel(): void {
  for (const layer of RUNTIME_OBSERVATION_ORIGIN_LAYERS) {
    assert.equal(v(spanObs({ span: spanDescriptor({ layer }) })).status, "valid");
  }
  assert.equal(v(spanObs({ span: spanDescriptor({ name: "" }) })).error?.code, "INVALID_SPAN");
  assert.equal(v(spanObs({ span: spanDescriptor({ operation: "  " }) })).error?.code, "INVALID_SPAN");
  assert.equal(v(spanObs({ span: spanDescriptor({ layer: "spaceship" }) })).error?.code, "INVALID_SPAN");
  assert.equal(v(spanObs({ span: spanDescriptor({ completedAt: "" }) })).error?.code, "INVALID_SPAN");
}

/* ── Metric descriptor ─────────────────────────────────────────── */
function metricDescriptorModel(): void {
  for (const aggregation of RUNTIME_METRIC_AGGREGATIONS) {
    assert.equal(v(metricObs({ metric: metricDescriptor({ aggregation }) })).status, "valid");
  }
  assert.equal(v(metricObs({ metric: metricDescriptor({ metricId: "" }) })).error?.code, "INVALID_METRIC");
  assert.equal(v(metricObs({ metric: metricDescriptor({ unit: "  " }) })).error?.code, "INVALID_METRIC");
  assert.equal(v(metricObs({ metric: metricDescriptor({ aggregation: "average" }) })).error?.code, "INVALID_METRIC");
  // Dimensions are string-valued only.
  assert.equal(v(metricObs({ metric: metricDescriptor({ dimensions: { n: 1 } }) })).error?.code, "INVALID_METRIC");
  assert.equal(v(metricObs({ metric: metricDescriptor({ dimensions: {} }) })).status, "valid");
}

/* ── Log descriptor ────────────────────────────────────────────── */
function logDescriptorModel(): void {
  for (const level of RUNTIME_LOG_LEVELS) {
    assert.equal(v(logObs({ log: logDescriptor({ level }) })).status, "valid");
  }
  assert.equal(v(logObs({ log: logDescriptor({ level: "trace" }) })).error?.code, "INVALID_LOG");
  assert.equal(v(logObs({ log: logDescriptor({ category: "" }) })).error?.code, "INVALID_LOG");
  assert.equal(v(logObs({ log: logDescriptor({ template: "  " }) })).error?.code, "INVALID_LOG");
}

/* ── Timeline ──────────────────────────────────────────────────── */
function timelineModel(): void {
  assert.equal(v(base({ timeline: timeline({ startedAt: "" }) })).error?.code, "INVALID_TIMELINE");
  assert.equal(v(base({ timeline: timeline({ completedAt: "  " }) })).error?.code, "INVALID_TIMELINE");
  assert.equal(v(base({ timeline: timeline({ durationMs: -1 }) })).error?.code, "INVALID_TIMELINE");
  assert.equal(v(base({ timeline: timeline({ durationMs: 0 }) })).status, "valid");
}

/* ── References ────────────────────────────────────────────────── */
function referenceModel(): void {
  for (const key of ["executionId", "resultReference", "errorReference"]) {
    assert.equal(v(base({ reference: reference({ [key]: "" }) })).error?.code, "INVALID_REFERENCE");
  }
}

/* ── Correlation ───────────────────────────────────────────────── */
function correlationModel(): void {
  for (const key of ["causationId", "traceId", "spanId"]) {
    assert.equal(v(base({ correlation: correlation({ [key]: "" }) })).error?.code, "INVALID_CORRELATION");
  }
  // Correlation id must match the reference.
  assert.equal(v(base({ correlation: correlation({ correlationId: "different" }) })).error?.code, "INVALID_CORRELATION");
}

/* ── Metadata / identifiers ────────────────────────────────────── */
function metadataModel(): void {
  assert.equal(v(base({ observationId: "" })).error?.code, "INVALID_OBSERVATION");
  assert.equal(v(base({ metadata: metadata({ recordedAt: "" }) })).error?.code, "INVALID_METADATA");
  assert.equal(v(base({ metadata: metadata({ redactionApplied: 1 as never }) })).error?.code, "INVALID_METADATA");
  assert.equal(v(base({ metadata: metadata({ attributes: { region: "eu", nested: [1, 2, { ok: true }] } }) })).status, "valid");
}

/* ── Immutability ──────────────────────────────────────────────── */
function immutability(): void {
  const obs = createRuntimeObservation(spanObs());
  for (const nested of [obs, obs.origin, obs.reference, obs.correlation, obs.timeline, obs.metadata, obs.span]) {
    assert.equal(Object.isFrozen(nested), true);
  }
  assert.equal(Object.isFrozen(obs.span?.attributes), true);
  assert.throws(() => { (obs as unknown as { observationId: string }).observationId = "x"; });
  assert.throws(() => { (obs.origin as unknown as { layer: string }).layer = "session"; });
  assert.throws(() => { (obs.span?.attributes as unknown as { a: number }).a = 1; });

  // Construction deep-copies: mutating the source afterward does not leak in.
  const src = metadata();
  const built = createRuntimeObservation(base({ metadata: src }));
  (src as { schemaVersion: string }).schemaVersion = "9.9.9";
  assert.equal(built.metadata.schemaVersion, "1.0.0");

  // A hand-built observation with an unfrozen nested object is caught.
  const tampered = { ...obs, metadata: { ...metadata() } } as RuntimeObservation;
  assert.equal(validateRuntimeObservation(tampered).error?.code, "IMMUTABILITY_VIOLATION");
}

/* ── Adversarial: no behaviour or shared mutable state ─────────── */
function adversarial(): void {
  const cases: readonly [string, () => unknown][] = [
    ["callback injection", () => createRuntimeObservation(spanObs({ span: spanDescriptor({ attributes: { fn: () => 1 } }) }) as never)],
    ["executable descriptor", () => createRuntimeObservation(metricObs({ metric: { ...metricDescriptor(), run: () => undefined } }) as never)],
    ["Promise injection", () => createRuntimeObservation(base({ correlation: Promise.resolve() }) as never)],
    ["Symbol injection", () => createRuntimeObservation(base({ metadata: metadata({ tag: Symbol("s") }) }) as never)],
    ["bigint injection", () => createRuntimeObservation(base({ metadata: metadata({ big: BigInt(1) }) }) as never)],
    ["non-finite number", () => createRuntimeObservation(base({ timeline: timeline({ durationMs: Number.POSITIVE_INFINITY }) }))],
    ["class instance", () => createRuntimeObservation(base({ origin: new (class { layer = "engine"; })() }) as never)],
    ["cyclic object", () => { const c: Record<string, unknown> = { ...inert }; c.self = c; return createRuntimeObservation(base({ timeline: c }) as never); }],
    ["shared mutable reference", () => { const shared = { v: 1 }; return createRuntimeObservation(base({ metadata: { ...metadata(), a: shared, b: shared } }) as never); }],
  ];
  for (const [name, run] of cases) {
    assert.throws(run, TypeError, `${name} must be rejected`);
  }
  // A frozen shared reference used twice carries no mutation risk.
  const frozenShared = Object.freeze({ note: "ok" });
  assert.doesNotThrow(() => createRuntimeObservation(base({ metadata: { ...metadata(), a: frozenShared, b: frozenShared } }) as never));
}

function main(): void {
  construction();
  observationTypes();
  traceDescriptorModel();
  spanDescriptorModel();
  metricDescriptorModel();
  logDescriptorModel();
  timelineModel();
  referenceModel();
  correlationModel();
  metadataModel();
  immutability();
  adversarial();
  console.log("runtime observation architecture checks passed");
}

main();
