import { Pool } from "pg";
import type { PersistenceResult } from "@/features/enterprise-persistence/contracts";
import { persistenceSuccess } from "@/features/enterprise-persistence/contracts";
import type { EnterpriseIntelligenceApplicationProjection } from "@/features/enterprise-intelligence/view-model";
import type {
  DecisionOverviewProjection,
  DirectorWorkspaceProjection,
  HebyEnterpriseContextProjection,
  KnowledgeOverviewProjection,
  OrganizationOverviewProjection,
  TimelineOverviewProjection,
} from "@/features/enterprise-projections";
import type { EnterpriseRepositoryRegistry } from "@/features/enterprise-persistence/ports";
import type { TimelineContextProjection } from "@/features/timeline-domain/view-model";

export interface PostgresEnterpriseRepositoryOptions {
  connectionString: string;
}

export interface PostgresEnterpriseRepositorySet {
  repositories: EnterpriseRepositoryRegistry;
  close(): Promise<void>;
}

interface ProjectionRow<T> {
  payload: T;
}

function classifyPostgresFailure(error: unknown): PersistenceResult<never> {
  if (!(error instanceof Error)) {
    return { status: "PermanentFailure", message: "Unknown PostgreSQL repository failure." };
  }

  const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
  if (code?.startsWith("08") || code === "40001" || code === "40P01" || code === "57P01") {
    return { status: "TemporaryFailure", message: error.message };
  }

  return { status: "PermanentFailure", message: error.message };
}

export function createPostgresEnterpriseRepositories(
  options: PostgresEnterpriseRepositoryOptions,
): PostgresEnterpriseRepositorySet {
  const pool = new Pool({
    connectionString: options.connectionString,
    application_name: "hebun-enterprise-projections",
    max: 4,
    idleTimeoutMillis: 1000,
  });

  async function loadProjection<T>(key: string): Promise<PersistenceResult<T>> {
    try {
      const client = await pool.connect();
      const result = await client.query<ProjectionRow<T>>(
        `select payload from enterprise_projection_snapshots where projection_key = $1`,
        [key],
      ).finally(() => client.release());
      const row = result.rows[0];
      return row
        ? persistenceSuccess(row.payload)
        : { status: "NotFound", message: `Projection ${key} was not found.` };
    } catch (error) {
      return classifyPostgresFailure(error);
    }
  }

  const repositories: EnterpriseRepositoryRegistry = Object.freeze({
    organization: Object.freeze({
      loadOrganization: () => loadProjection<OrganizationOverviewProjection>("organization"),
    }),
    knowledge: Object.freeze({
      loadKnowledge: () => loadProjection<KnowledgeOverviewProjection>("knowledge"),
    }),
    timeline: Object.freeze({
      loadTimeline: () => loadProjection<TimelineOverviewProjection>("timeline"),
      loadRecentContext: () => loadProjection<TimelineContextProjection>("timeline-context"),
    }),
    decision: Object.freeze({
      loadDecisions: () => loadProjection<DecisionOverviewProjection>("decision"),
    }),
    enterpriseIntelligence: Object.freeze({
      loadEnterpriseIntelligence: () => loadProjection<EnterpriseIntelligenceApplicationProjection>("enterprise-intelligence"),
      loadDirectorWorkspace: () => loadProjection<DirectorWorkspaceProjection>("director-workspace"),
    }),
    hebyContext: Object.freeze({
      loadHebyContext: () => loadProjection<HebyEnterpriseContextProjection>("heby-context"),
    }),
  });

  return Object.freeze({
    repositories,
    close: () => pool.end(),
  });
}
