/*
 * read-processor-attestations.server.ts — THE ONLY READ of processor attestations
 * (EXTERNAL-AI-DATA-USE-1A).
 *
 * Root-scoped: an attestation describes one reviewed processing boundary of THIS deployment, so the
 * read takes a service scope and an account, never a tenant. It contains no INSERT, UPDATE or
 * DELETE, and Release A ships no attestation writer anywhere — the admission ceremony is B1.
 *
 * Fail closed: an unreadable control plane is `unavailable`, never `absent`.
 *
 * Server-only.
 */
import { and, desc, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { processorAttestations } from "@/db/schema/external-ai-data-use";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import type { AttestationTreatmentView } from "./attestation-change";
import type { AttestationInForce } from "./compose-external-ai-disclosure";
import {
  CONTRACT_SURFACES,
  IDENTITY_STATUSES,
  RETENTION_CLASSES,
  TRAINING_TREATMENTS,
  ZDR_STATES,
  isServiceScope,
  type ContractSurface,
  type IdentityStatus,
  type RetentionClass,
  type ServiceScope,
  type TrainingTreatment,
  type ZdrState,
} from "./contracts";

export interface ProcessorAttestationReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

export type ProcessorAttestationReadResult =
  | { readonly status: "read"; readonly latest: AttestationInForce }
  | { readonly status: "absent" }
  | { readonly status: "unavailable" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Processor attestation reads are server-only.");
  }
}

const SELECTION = {
  id: processorAttestations.id,
  serviceScope: processorAttestations.serviceScope,
  accountRef: processorAttestations.accountRef,
  state: processorAttestations.state,
  identityStatus: processorAttestations.identityStatus,
  contractSurface: processorAttestations.contractSurface,
  training: processorAttestations.training,
  retentionClass: processorAttestations.retentionClass,
  zdr: processorAttestations.zdr,
  modelTreatmentClass: processorAttestations.modelTreatmentClass,
  attestationRevision: processorAttestations.attestationRevision,
};

type SelectedRow = {
  id: string;
  serviceScope: string;
  accountRef: string;
  state: string;
  identityStatus: string;
  contractSurface: string;
  training: string;
  retentionClass: string;
  zdr: string;
  modelTreatmentClass: string;
  attestationRevision: number;
};

const within = <T extends string>(list: readonly T[], value: string): value is T => (list as readonly string[]).includes(value);

/**
 * A row whose stored words fall outside the closed vocabularies cannot be described truthfully, so it
 * is not described at all: the caller sees `unavailable`. The CHECKs make this unreachable today.
 */
export function toAttestationView(row: SelectedRow): (AttestationTreatmentView & { state: "active" | "withdrawn" }) | null {
  if (!isServiceScope(row.serviceScope)) return null;
  if (!within(IDENTITY_STATUSES, row.identityStatus)) return null;
  if (!within(CONTRACT_SURFACES, row.contractSurface)) return null;
  if (!within(TRAINING_TREATMENTS, row.training)) return null;
  if (!within(RETENTION_CLASSES, row.retentionClass)) return null;
  if (!within(ZDR_STATES, row.zdr)) return null;
  if (row.state !== "active" && row.state !== "withdrawn") return null;
  return {
    id: row.id,
    serviceScope: row.serviceScope as ServiceScope,
    accountRef: row.accountRef,
    identityStatus: row.identityStatus as IdentityStatus,
    contractSurface: row.contractSurface as ContractSurface,
    training: row.training as TrainingTreatment,
    retentionClass: row.retentionClass as RetentionClass,
    zdr: row.zdr as ZdrState,
    modelTreatmentClass: row.modelTreatmentClass,
    state: row.state,
  };
}

/** The attestation in force for one lineage: its highest revision, active or withdrawn. */
export async function readLatestProcessorAttestation(
  serviceScope: string,
  accountRef: string,
  deps: ProcessorAttestationReadDeps = {},
): Promise<ProcessorAttestationReadResult> {
  assertServerOnly();
  if (!isServiceScope(serviceScope) || !(accountRef ?? "").trim()) return { status: "absent" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable" };
  try {
    const rows = await db
      .select(SELECTION)
      .from(processorAttestations)
      .where(and(eq(processorAttestations.serviceScope, serviceScope), eq(processorAttestations.accountRef, accountRef)))
      .orderBy(desc(processorAttestations.attestationRevision))
      .limit(1);
    const row = rows[0];
    if (!row) return { status: "absent" };
    const view = toAttestationView(row as SelectedRow);
    return view ? { status: "read", latest: view } : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

/** One exact attestation revision, by id — what a tenant revision is bound to. */
export async function readProcessorAttestationById(
  attestationId: string,
  deps: ProcessorAttestationReadDeps = {},
): Promise<
  | { readonly status: "read"; readonly attestation: AttestationInForce & { readonly attestationRevision: number } }
  | { readonly status: "absent" }
  | { readonly status: "unavailable" }
> {
  assertServerOnly();
  if (!UUID_RE.test((attestationId ?? "").trim())) return { status: "absent" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable" };
  try {
    const rows = await db.select(SELECTION).from(processorAttestations).where(eq(processorAttestations.id, attestationId)).limit(1);
    const row = rows[0];
    if (!row) return { status: "absent" };
    const view = toAttestationView(row as SelectedRow);
    return view ? { status: "read", attestation: { ...view, attestationRevision: row.attestationRevision } } : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}
