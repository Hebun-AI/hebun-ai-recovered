/*
 * Processor attestation admission — the mechanics behind `npm run platform:processor-attestation`
 * (EXTERNAL-AI-DATA-USE-B1A).
 *
 * ── WHAT THIS WRITES, AND THE ONLY THING IT WRITES ───────────────────────────
 *
 * One `processor_attestations` revision per act, INSERTed, never updated, never deleted. It is the
 * single attestation writer in the repository (Release A's firewall names this file and no other).
 * It writes no tenant authorization, no Governance session or decision, no audit row, no provider
 * control and no platform policy. Admitting an attestation records what Hebun KNOWS about one
 * processing boundary; whether that treatment is acceptable is the platform policy's question
 * (B1D), and whether an organization agrees is its own Governance's.
 *
 * ── WHERE THE VALUES COME FROM ───────────────────────────────────────────────
 *
 * From ONE reviewed repository record, named `<path>@<sha>`, read with `git show` from a commit
 * that is reachable from origin/main. Never from argv beyond that reference, never from the
 * environment, never from a prompt. The record is Director-gated before it can be named here, so
 * the row's `reviewed_record_ref` points at exactly the bytes that were reviewed.
 *
 * ── WHAT A RECORD MAY NOT SAY ────────────────────────────────────────────────
 *
 * It may not declare any field UNKNOWN: a fact that is not established is not admitted, and there is
 * no "unknown" in the closed vocabularies to smuggle it through. It may not claim a `verified`
 * identity: verification means a runtime observation a human admitted, and no such observation
 * mechanism exists before B2. It may not name a state — the ceremony verb decides that.
 *
 * No credential is read here and no network call is made other than `git fetch` against the
 * repository's own origin.
 */
import { spawnSync } from "node:child_process";
import type { Client } from "pg";
import {
  ATTESTATION_CONTROL_SOURCES,
  CONTRACT_SURFACES,
  RETENTION_CLASSES,
  SERVICE_SCOPES,
  TRAINING_TREATMENTS,
  ZDR_STATES,
  type AttestationControlSource,
  type ContractSurface,
  type RetentionClass,
  type ServiceScope,
  type TrainingTreatment,
  type ZdrState,
} from "../../src/features/external-ai-data-use/contracts";
import { organizationalFingerprint, type OrganizationalFingerprint } from "./production-migration";

/* ── The record ──────────────────────────────────────────────────────────────────────────────── */

/** The fenced block's info string. A different version is a different format, never a fallback. */
export const ATTESTATION_RECORD_FORMAT = "hebun-processor-attestation-record/v1";
const RECORD_FAMILY = "hebun-processor-attestation-record/";

export interface ProcessorAttestationRecord {
  readonly serviceScope: ServiceScope;
  readonly accountRef: string;
  /** B1A admits `attested` only. `verified` needs an admitted runtime observation (B2). */
  readonly identityStatus: "attested";
  readonly contractSurface: ContractSurface;
  readonly training: TrainingTreatment;
  readonly retentionClass: RetentionClass;
  readonly zdr: ZdrState;
  readonly modelTreatmentClass: string;
  readonly modelIds: readonly string[];
  /** Compliance metadata only; never an authorization input. */
  readonly region: string | null;
  readonly evidenceRefs: readonly string[];
  /** `YYYY-MM-DD` or a full ISO timestamp — when the facts were attested. */
  readonly attestedAt: string;
}

export type RecordRefusal =
  | "block-missing"
  | "block-ambiguous"
  | "block-malformed"
  | "field-missing"
  | "field-unknown"
  | "field-declared-unknown"
  | "value-out-of-vocabulary"
  | "value-invalid"
  | "identity-not-attested";

export type RecordParseResult =
  | { readonly status: "parsed"; readonly record: ProcessorAttestationRecord }
  | { readonly status: "refused"; readonly reason: RecordRefusal; readonly detail: string };

/** The exact key set, in the record's own snake_case. Nothing missing, nothing extra. */
const RECORD_KEYS = [
  "service_scope",
  "account_ref",
  "identity_status",
  "contract_surface",
  "training",
  "retention_class",
  "zdr",
  "model_treatment_class",
  "model_ids",
  "region",
  "evidence_refs",
  "attested_at",
] as const;

const refuse = (reason: RecordRefusal, detail: string): RecordParseResult => ({ status: "refused", reason, detail });

const isDeclaredUnknown = (value: unknown): boolean =>
  typeof value === "string" ? /^\s*unknown\s*$/i.test(value) : Array.isArray(value) && value.some(isDeclaredUnknown);

/** Trimmed, non-empty, bounded. A padded value is refused, not trimmed: nothing is repaired. */
const isCleanText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value === value.trim() && value.length <= max;

const isCleanList = (value: unknown, max: number): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every((item) => isCleanText(item, max));

function isValidAttestedAt(value: unknown, now: Date): value is string {
  if (typeof value !== "string") return false;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const instant = dateOnly
    ? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])))
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value)
      ? new Date(value)
      : null;
  if (!instant || Number.isNaN(instant.getTime())) return false;
  /* `2026-02-30` would roll over to March; a calendar date must round-trip exactly. */
  if (dateOnly && instant.toISOString().slice(0, 10) !== value) return false;
  return instant.getTime() <= now.getTime();
}

function inList<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/** Parse a reviewed record. Strict: refuse, never repair, never default. Pure. */
export function parseAttestationRecord(markdown: string, now: Date = new Date()): RecordParseResult {
  const blocks = [...markdown.matchAll(/^```([^\n`]*)\n([\s\S]*?)^```[ \t]*$/gm)];
  const family = blocks.filter((b) => b[1]!.trim().startsWith(RECORD_FAMILY));
  const mine = family.filter((b) => b[1]!.trim() === ATTESTATION_RECORD_FORMAT);
  if (mine.length === 0) return refuse("block-missing", `no \`\`\`${ATTESTATION_RECORD_FORMAT} block`);
  if (family.length !== 1) return refuse("block-ambiguous", "more than one attestation record block");

  let parsed: unknown;
  try {
    parsed = JSON.parse(mine[0]![2]!);
  } catch {
    return refuse("block-malformed", "the record block is not JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return refuse("block-malformed", "the record block is not a JSON object");
  }
  const fields = parsed as Record<string, unknown>;

  const extra = Object.keys(fields).filter((key) => !(RECORD_KEYS as readonly string[]).includes(key));
  if (extra.length > 0) return refuse("field-unknown", `unknown field(s): ${extra.join(", ")}`);
  const missing = RECORD_KEYS.filter((key) => !(key in fields));
  if (missing.length > 0) return refuse("field-missing", `missing field(s): ${missing.join(", ")}`);

  const unknown = RECORD_KEYS.filter((key) => isDeclaredUnknown(fields[key]));
  if (unknown.length > 0) {
    return refuse(
      "field-declared-unknown",
      `declared UNKNOWN: ${unknown.join(", ")}. A fact that is not established is not admitted.`,
    );
  }

  if (fields.identity_status !== "attested") {
    return refuse("identity-not-attested", "B1A admits identity_status \"attested\" only");
  }
  for (const [key, list] of [
    ["service_scope", SERVICE_SCOPES],
    ["contract_surface", CONTRACT_SURFACES],
    ["training", TRAINING_TREATMENTS],
    ["retention_class", RETENTION_CLASSES],
    ["zdr", ZDR_STATES],
  ] as const) {
    if (!inList(list, fields[key])) {
      return refuse("value-out-of-vocabulary", `${key} must be one of: ${list.join(", ")}`);
    }
  }

  if (!isCleanText(fields.account_ref, 200)) return refuse("value-invalid", "account_ref must be 1–200 untrimmed-free characters");
  if (!isCleanText(fields.model_treatment_class, 200)) return refuse("value-invalid", "model_treatment_class must be non-blank");
  if (!isCleanList(fields.model_ids, 200)) return refuse("value-invalid", "model_ids must be a non-empty list of non-blank ids");
  if (!isCleanList(fields.evidence_refs, 1000)) return refuse("value-invalid", "evidence_refs must be a non-empty list of non-blank references");
  if (fields.region !== null && !isCleanText(fields.region, 500)) return refuse("value-invalid", "region must be null or non-blank text");
  if (!isValidAttestedAt(fields.attested_at, now)) {
    return refuse("value-invalid", "attested_at must be a real date (YYYY-MM-DD or ISO timestamp) not in the future");
  }

  return {
    status: "parsed",
    record: {
      serviceScope: fields.service_scope as ServiceScope,
      accountRef: fields.account_ref,
      identityStatus: "attested",
      contractSurface: fields.contract_surface as ContractSurface,
      training: fields.training as TrainingTreatment,
      retentionClass: fields.retention_class as RetentionClass,
      zdr: fields.zdr as ZdrState,
      modelTreatmentClass: fields.model_treatment_class,
      modelIds: [...fields.model_ids],
      region: fields.region as string | null,
      evidenceRefs: [...fields.evidence_refs],
      attestedAt: fields.attested_at,
    },
  };
}

/* ── The reference and its binding to origin/main ────────────────────────────────────────────── */

export type ReviewedRecordRefResult =
  | { readonly status: "parsed"; readonly path: string; readonly sha: string; readonly reviewedRecordRef: string }
  | { readonly status: "refused"; readonly detail: string };

/** `<repository-relative path>.md@<40-hex sha>`. A branch name or short sha could move; this cannot. */
export function parseReviewedRecordRef(arg: string | undefined): ReviewedRecordRefResult {
  const match = /^(.+)@([0-9a-f]{40})$/.exec(arg ?? "");
  if (!match) return { status: "refused", detail: "expected <repository-relative path>.md@<full 40-character commit sha>" };
  const recordPath = match[1]!;
  if (recordPath.startsWith("/") || recordPath.includes("\\") || recordPath.split("/").some((part) => part === ".." || part === "." || part === "")) {
    return { status: "refused", detail: "the record path must be repository-relative, with no '.', '..' or empty segment" };
  }
  if (!recordPath.endsWith(".md")) return { status: "refused", detail: "the reviewed record is a Markdown (.md) file" };
  return { status: "parsed", path: recordPath, sha: match[2]!, reviewedRecordRef: `${recordPath}@${match[2]}` };
}

export interface GitResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}
export type GitRunner = (args: readonly string[]) => GitResult;

/** Run git in one directory. Arguments are passed as a vector — never through a shell. */
export function gitRunnerAt(cwd: string): GitRunner {
  return (args) => {
    const result = spawnSync("git", [...args], { cwd, encoding: "utf8" });
    return { status: result.error ? null : result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  };
}

export type ReviewedRecordResult =
  | { readonly status: "read"; readonly markdown: string }
  | { readonly status: "refused"; readonly reason: "fetch-failed" | "commit-unknown" | "not-on-origin-main" | "record-absent"; readonly detail: string };

/**
 * Read the reviewed bytes — only from a commit origin/main contains. The fetch is mandatory: a
 * stale local origin/main must not vouch for a commit the remote has since dropped, and a fetch
 * that fails is a refusal, never a reason to trust what is cached.
 */
export function resolveReviewedRecord(ref: { readonly path: string; readonly sha: string }, git: GitRunner): ReviewedRecordResult {
  const fetched = git(["fetch", "--quiet", "origin", "+refs/heads/main:refs/remotes/origin/main"]);
  if (fetched.status !== 0) {
    return { status: "refused", reason: "fetch-failed", detail: "origin/main could not be fetched, so nothing can vouch for the record" };
  }
  if (git(["cat-file", "-e", `${ref.sha}^{commit}`]).status !== 0) {
    return { status: "refused", reason: "commit-unknown", detail: `commit ${ref.sha} does not exist in this repository` };
  }
  if (git(["merge-base", "--is-ancestor", ref.sha, "refs/remotes/origin/main"]).status !== 0) {
    return { status: "refused", reason: "not-on-origin-main", detail: `commit ${ref.sha} is not reachable from origin/main` };
  }
  const shown = git(["show", `${ref.sha}:${ref.path}`]);
  if (shown.status !== 0) {
    return { status: "refused", reason: "record-absent", detail: `${ref.path} does not exist at ${ref.sha}` };
  }
  return { status: "read", markdown: shown.stdout };
}

/* ── The revision plan ───────────────────────────────────────────────────────────────────────── */

export const ATTESTATION_VERBS = ["admit", "supersede", "withdraw"] as const;
export type AttestationVerb = (typeof ATTESTATION_VERBS)[number];
export const isAttestationVerb = (value: unknown): value is AttestationVerb =>
  typeof value === "string" && (ATTESTATION_VERBS as readonly string[]).includes(value);

export interface LineageHead {
  readonly id: string;
  readonly attestationRevision: number;
  readonly state: "active" | "withdrawn";
}

export type RevisionPlan =
  | { readonly status: "planned"; readonly revision: number; readonly state: "active" | "withdrawn"; readonly supersedesId: string | null }
  | { readonly status: "refused"; readonly reason: "lineage-exists" | "lineage-empty" | "lineage-withdrawn" };

/**
 * Append-only. `admit` starts a lineage; `supersede` and `withdraw` follow an ACTIVE head. A
 * withdrawn lineage is closed here: re-admitting a withdrawn boundary is a decision nobody has
 * made yet, so it is refused rather than inferred. Pure.
 */
export function planAttestationRevision(verb: AttestationVerb, head: LineageHead | null): RevisionPlan {
  if (verb === "admit") {
    return head ? { status: "refused", reason: "lineage-exists" } : { status: "planned", revision: 1, state: "active", supersedesId: null };
  }
  if (!head) return { status: "refused", reason: "lineage-empty" };
  if (head.state !== "active") return { status: "refused", reason: "lineage-withdrawn" };
  return {
    status: "planned",
    revision: head.attestationRevision + 1,
    state: verb === "withdraw" ? "withdrawn" : "active",
    supersedesId: head.id,
  };
}

/* ── The database ────────────────────────────────────────────────────────────────────────────── */

/** The highest revision of one lineage. READ ONLY. */
export async function readLineageHead(client: Client, serviceScope: string, accountRef: string): Promise<LineageHead | null> {
  const result = await client.query<{ id: string; attestation_revision: number; state: "active" | "withdrawn" }>(
    `select id, attestation_revision, state::text as state
       from processor_attestations
      where service_scope = $1 and account_ref = $2
      order by attestation_revision desc
      limit 1`,
    [serviceScope, accountRef],
  );
  const row = result.rows[0];
  return row ? { id: row.id, attestationRevision: row.attestation_revision, state: row.state } : null;
}

const sameHead = (a: LineageHead | null, b: LineageHead | null): boolean =>
  a === null || b === null ? a === b : a.id === b.id && a.attestationRevision === b.attestationRevision && a.state === b.state;

export type AppendResult =
  | { readonly status: "appended"; readonly id: string; readonly revision: number; readonly state: "active" | "withdrawn" }
  | { readonly status: "refused"; readonly reason: "lineage-moved" | "lineage-exists" | "lineage-empty" | "lineage-withdrawn" | "control-source-invalid" };

/**
 * Append one revision in one transaction — only if the lineage head is still exactly the one the
 * operator was shown. A concurrent writer that got there first makes this a refusal (the lineage
 * unique index is the arbiter), never an overwrite and never a silent retry.
 */
export async function appendProcessorAttestation(
  client: Client,
  input: {
    readonly verb: AttestationVerb;
    readonly record: ProcessorAttestationRecord;
    readonly reviewedRecordRef: string;
    readonly controlSource: AttestationControlSource;
    readonly expectedHead: LineageHead | null;
  },
): Promise<AppendResult> {
  if (!(ATTESTATION_CONTROL_SOURCES as readonly string[]).includes(input.controlSource)) {
    return { status: "refused", reason: "control-source-invalid" };
  }
  const { record } = input;
  await client.query("begin");
  try {
    const head = await readLineageHead(client, record.serviceScope, record.accountRef);
    if (!sameHead(head, input.expectedHead)) {
      await client.query("rollback");
      return { status: "refused", reason: "lineage-moved" };
    }
    const plan = planAttestationRevision(input.verb, head);
    if (plan.status === "refused") {
      await client.query("rollback");
      return plan;
    }
    const inserted = await client.query<{ id: string }>(
      `insert into processor_attestations
         (service_scope, account_ref, attestation_revision, state, identity_status, contract_surface,
          training, retention_class, zdr, model_treatment_class, model_ids, region, evidence_refs,
          reviewed_record_ref, attested_at, control_source, supersedes_attestation_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::timestamptz, $16, $17)
       returning id`,
      [
        record.serviceScope,
        record.accountRef,
        plan.revision,
        plan.state,
        record.identityStatus,
        record.contractSurface,
        record.training,
        record.retentionClass,
        record.zdr,
        record.modelTreatmentClass,
        [...record.modelIds],
        record.region,
        [...record.evidenceRefs],
        input.reviewedRecordRef,
        /^\d{4}-\d{2}-\d{2}$/.test(record.attestedAt) ? `${record.attestedAt}T00:00:00Z` : record.attestedAt,
        input.controlSource,
        plan.supersedesId,
      ],
    );
    await client.query("commit");
    return { status: "appended", id: inserted.rows[0]!.id, revision: plan.revision, state: plan.state };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    /* The lineage unique indexes lose the race for us: someone else appended this revision first. */
    if ((error as { code?: string }).code === "23505") return { status: "refused", reason: "lineage-moved" };
    throw error;
  }
}

export interface NonMutationMeasure {
  readonly organizational: OrganizationalFingerprint;
  readonly governanceSessions: number;
  readonly tenantAuthorizations: number;
  readonly tenantAuthorizationScopes: number;
  readonly processorAttestations: number;
}

/** Count what this ceremony must not move, and the one table it may. READ ONLY. */
export async function measureNonMutation(client: Client): Promise<NonMutationMeasure> {
  const count = async (table: string): Promise<number> =>
    Number((await client.query<{ n: string }>(`select count(*)::text as n from ${table}`)).rows[0]!.n);
  return {
    organizational: await organizationalFingerprint(client),
    governanceSessions: await count("governance_sessions"),
    tenantAuthorizations: await count("tenant_ai_data_use_authorizations"),
    tenantAuthorizationScopes: await count("tenant_ai_data_use_scopes"),
    processorAttestations: await count("processor_attestations"),
  };
}
