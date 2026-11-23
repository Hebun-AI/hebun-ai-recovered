import {
  createCanonicalReadServices,
  type CanonicalReadServices,
} from "@/features/canonical-read";
import {
  createReadComparisonResult,
  createReadComparedAt,
  createUnavailableReadAvailability,
  deriveReadMatchStatus,
  deriveReadPresenceStatus,
  isReadUuidLike,
} from "@/features/canonical-read-platform";
import { readCanonicalReadConfigFromEnv } from "@/features/canonical-read/config";
import { compareExecutionShadow } from "./comparator";
import type {
  ExecutionShadowReadInput,
  ExecutionShadowReadResult,
  MemoryExecutionLineageSummary,
  PostgresExecutionLineageSummary,
} from "./types";

function summarizePostgres(
  result: Awaited<ReturnType<CanonicalReadServices["getExecutionLineage"]>>,
): PostgresExecutionLineageSummary | undefined {
  if (
    !result.execution &&
    !result.command &&
    !result.workflow &&
    !result.task &&
    !result.plan &&
    !result.goal &&
    !result.mission
  ) {
    return undefined;
  }

  return {
    execution: result.execution,
    command: result.command,
    workflow: result.workflow,
    task: result.task,
    plan: result.plan,
    goal: result.goal,
    mission: result.mission,
    completeness: result.completeness,
    warnings: result.warnings.map((warning) => warning.message),
  };
}

export interface ExecutionShadowReadServiceOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly canonicalReadServices?: CanonicalReadServices;
  readonly memorySummary?: MemoryExecutionLineageSummary;
}

export async function runExecutionShadowRead(
  input: ExecutionShadowReadInput,
  options: ExecutionShadowReadServiceOptions = {},
): Promise<ExecutionShadowReadResult> {
  if (!isReadUuidLike(input.tenantId) || !input.executionId.trim()) {
    return createReadComparisonResult({
      kind: "execution-shadow-read",
      input,
      status: "invalid-input",
      postgresAvailability: createUnavailableReadAvailability(),
      postgresReason: "invalid-input",
      diff: {
        mismatches: [],
        matchedFields: [],
        nonComparableFields: [],
        missingFields: [],
        mismatchCategories: [],
      },
      warnings: ["Execution shadow read input is invalid."],
      comparedAt: createReadComparedAt(),
    });
  }

  const ownServices = !options.canonicalReadServices;
  const services =
    options.canonicalReadServices ??
    createCanonicalReadServices(
      readCanonicalReadConfigFromEnv(options.env ?? process.env),
    );

  try {
    // No in-memory execution runtime exists; only an injected memory summary is compared.
    const memorySummary = options.memorySummary;

    const canonical = await services.getExecutionLineage(input);
    const postgresSummary = summarizePostgres(canonical);
    const diff = compareExecutionShadow({
      memory: memorySummary,
      postgres: postgresSummary,
    });
    const warnings = [
      ...(memorySummary?.warnings ?? []),
      ...(postgresSummary?.warnings ?? []),
    ];
    const comparedAt = createReadComparedAt();

    if (canonical.status === "tenant-mismatch") {
      return createReadComparisonResult({
        kind: "execution-shadow-read",
        input,
        status: "tenant-mismatch",
        memorySummary,
        postgresAvailability: canonical.availability,
        postgresReason: canonical.reason,
        diff,
        warnings,
        comparedAt,
      });
    }

    if (canonical.status === "unavailable") {
      return createReadComparisonResult({
        kind: "execution-shadow-read",
        input,
        status: "unavailable",
        memorySummary,
        postgresAvailability: canonical.availability,
        postgresReason: canonical.reason,
        diff,
        warnings,
        comparedAt,
      });
    }

    const presenceStatus = deriveReadPresenceStatus({
      memoryFound: Boolean(memorySummary),
      postgresFound: Boolean(postgresSummary),
    });

    if (presenceStatus === "memory-only") {
      return createReadComparisonResult({
        kind: "execution-shadow-read",
        input,
        status: "memory-only",
        memorySummary,
        postgresAvailability: canonical.availability,
        postgresReason: canonical.reason,
        diff,
        warnings,
        comparedAt,
      });
    }

    if (presenceStatus === "postgres-only") {
      return createReadComparisonResult({
        kind: "execution-shadow-read",
        input,
        status: "postgres-only",
        postgresAvailability: canonical.availability,
        postgresSummary,
        postgresReason: canonical.reason,
        diff,
        warnings,
        comparedAt,
      });
    }

    if (presenceStatus === "not-found") {
      return createReadComparisonResult({
        kind: "execution-shadow-read",
        input,
        status: "not-found",
        postgresAvailability: canonical.availability,
        postgresReason: canonical.reason,
        diff,
        warnings,
        comparedAt,
      });
    }

    const status = deriveReadMatchStatus(diff);

    return createReadComparisonResult({
      kind: "execution-shadow-read",
      input,
      status,
      memorySummary,
      postgresAvailability: canonical.availability,
      postgresSummary,
      postgresReason: canonical.reason,
      diff,
      warnings,
      comparedAt,
    });
  } finally {
    if (ownServices) {
      await services.dispose();
    }
  }
}
