/*
 * external-recipients/write-external-recipients.server.ts — the ONLY writers of recipients (R3R).
 *
 * Two operations live here because they share one invariant and splitting them would mean two
 * places where somebody could add a third: CREATE records an address, RETIRE closes it. Nothing
 * else writes `external_recipients`, and a structural test asserts that no other module does.
 *
 * ── WHAT IS UNREACHABLE FROM HERE ────────────────────────────────────────────
 *
 * There is NO update path for `endpoint_kind`, `endpoint_value` or `endpoint_digest`. The address
 * is inserted once and never touched again — not corrected, not re-normalized, not repaired. Every
 * "change" is a retire plus a create, and the previous bytes stay byte-identical forever. That is
 * the entire reason a future approval can bind to an endpoint at all: a mutable address column
 * would silently re-point every approved-but-unspent permit.
 *
 * There is no way to write a verification, an approval, a decision, a permit or an execution
 * result: those columns do not exist, and this module imports nothing that owns them.
 *
 * ── WHAT THE CALLER CANNOT SUPPLY ────────────────────────────────────────────
 *
 * The input carries a display name, a channel and a raw address. It has no tenant, no actor, no
 * authority, no status and no digest — the types make them unrepresentable rather than merely
 * discouraged, exactly as `CreateWorkArtifactInput` does. The tenant and actor come from an
 * already-resolved server-side `TenantContext`; the digest is computed here from the normalized
 * value; the status is always `active` at creation.
 *
 * ── HUMAN ONLY, AND WHY THIS DIFFERS FROM R3W ────────────────────────────────
 *
 * R3W lets Heby prepare an artifact without approval, and that asymmetry is deliberate rather than
 * inconsistent. An artifact is INERT TEXT THE TENANT ALREADY OWNS. A recipient is A CLAIM ABOUT A
 * REAL PERSON OUTSIDE THE ORGANIZATION, and it becomes the target of an irreversible act. If a
 * model could mint `jane@exmaple.com` from prose, a human would approve a send to an address the
 * model invented — the exact failure R3W's `record-ref` repair closed one layer up.
 *
 * So `createdByType` is HARD-CODED to `"human"`. It is not a parameter, not an input field and not
 * an entry-point variant: there is no second entry point that could pass `"agent"`. Heby resolves
 * recipients and may not create them.
 *
 * ── NO AUTHORITY IS CONSULTED, AND NONE IS GRANTED ───────────────────────────
 *
 * Recording an address asks nothing of Governance: anyone holding a tenant session may record one.
 * Creating a recipient is not approving communication — the entire cost is paid at the action
 * approval boundary, where a human and a Governance decision are both mandatory. A second approval
 * system inside recipient management would be duplication, and the immutable-endpoint model
 * already closes the post-permit-edit hole that would otherwise justify one.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import { externalRecipients } from "@/db/schema/external-recipient";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/bootstrap-authority.server";
import {
  type CreateRecipientInput,
  type CreateRecipientResult,
  type RecipientRefusal,
  type RetireRecipientResult,
} from "./contracts";
import { digestRecipientEndpoint } from "./endpoint-digest";
import { normalizeRecipientEmail } from "./normalization";
import { parseRecipientRef } from "./recipient-ref";
import { toRecipientView, type RecipientRow } from "./recipient-view";
import { validateCreateRecipientInput } from "./validation";

export interface RecipientWriteDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

/** PostgreSQL's unique_violation. Named because a magic string in a catch block ages badly. */
const UNIQUE_VIOLATION = "23505";

function refused<T extends { status: "refused"; reason: RecipientRefusal }>(
  reason: RecipientRefusal,
): T {
  return { status: "refused", reason } as T;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("External recipients are server-only.");
  }
}

/**
 * PostgreSQL `unique_violation`, read from the driver's CODE and never from the message text.
 *
 * The `cause` branch is not defensive padding: drizzle wraps driver errors, so the code sits one
 * level down and a check that only looked at the top would let a duplicate address escape as an
 * unhandled 500 instead of a typed refusal. `bootstrap-authority.server.ts` walks the same two
 * levels for the same reason.
 */
function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === UNIQUE_VIOLATION) return true;
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause;
  return cause?.code === UNIQUE_VIOLATION;
}

/**
 * Record one addressable recipient.
 *
 * The duplicate case is handled by CATCHING the constraint rather than by reading first and then
 * inserting. A check-then-insert leaves a window in which two concurrent callers both read "no
 * live record" and both insert, and the partial unique index is the only thing that can actually
 * decide the race. Reading first would also be a lie about atomicity: the index is the authority,
 * so the code asks it rather than guessing ahead of it.
 */
export async function createExternalRecipient(
  tenant: TenantContext | null,
  input: CreateRecipientInput | null,
  deps: RecipientWriteDeps = {},
): Promise<CreateRecipientResult> {
  assertServerOnly();
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  if (!input) return refused("invalid-input");

  const problems = validateCreateRecipientInput(input);
  if (problems.length > 0) return { status: "refused", reason: "invalid-input", problems };

  /* Validation already proved this normalizes; the non-null assertion is the validator's promise. */
  const endpointValue = normalizeRecipientEmail(input.endpointValue)!;
  const endpointDigest = digestRecipientEndpoint(endpointValue);

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  try {
    const rows = await db
      .insert(externalRecipients)
      .values({
        tenantId: tenant.tenantId,
        displayName: input.displayName,
        endpointKind: input.endpointKind,
        endpointValue,
        endpointDigest,
        /* Always `active`. There is no input field that could ask for anything else. */
        status: "active",
        createdAt: now,
        updatedAt: now,
        createdBy: tenant.userId,
        /* Hard-coded. See the header: Heby cannot reach this, and there is no variant that can. */
        createdByType: "human",
      })
      .returning();

    const row = rows[0] as RecipientRow | undefined;
    if (!row) return refused("persistence-unavailable");
    return { status: "created", recipient: toRecipientView(row) };
  } catch (error) {
    if (isUniqueViolation(error)) return refused("duplicate-active-endpoint");
    throw error;
  }
}

/**
 * Retire one recipient. The address is left exactly as it was.
 *
 * NOT A DELETE, and not an erasure. The row survives so that a permit or an audit trail naming it
 * still resolves to the same bytes — a deleted recipient would turn every historical reference
 * into a dangling pointer. That also means retirement does NOT satisfy an erasure request: the
 * address is still stored. A real deletion path is separate, unbuilt work and is recorded as a
 * known limitation rather than pretended away here.
 *
 * The `status = 'active'` predicate is part of the UPDATE rather than a read-then-write, so two
 * concurrent retirements cannot both report success: the loser updates zero rows.
 */
export async function retireExternalRecipient(
  tenant: TenantContext | null,
  input: { readonly recipientRef: string } | null,
  deps: RecipientWriteDeps = {},
): Promise<RetireRecipientResult> {
  assertServerOnly();
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");

  const parsed = parseRecipientRef(input?.recipientRef);
  /* A malformed ref is reported as "not found", never as "malformed for a row that exists". */
  if (!parsed) return refused("recipient-not-found");

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  const updated = await db
    .update(externalRecipients)
    .set({ status: "retired", updatedAt: now, updatedBy: tenant.userId, updatedByType: "human" })
    .where(
      and(
        eq(externalRecipients.id, parsed.recipientId),
        eq(externalRecipients.tenantId, tenant.tenantId),
        eq(externalRecipients.status, "active"),
      ),
    )
    .returning();

  const row = updated[0] as RecipientRow | undefined;
  if (row) return { status: "retired", recipient: toRecipientView(row) };

  /*
   * Nothing moved. Distinguish "already retired" from "not found" ONLY inside this tenant — a
   * foreign or absent id gets the same answer, so a probe cannot learn that another tenant holds a
   * recipient by comparing refusals.
   */
  const existing = await db
    .select({ id: externalRecipients.id })
    .from(externalRecipients)
    .where(
      and(
        eq(externalRecipients.id, parsed.recipientId),
        eq(externalRecipients.tenantId, tenant.tenantId),
      ),
    )
    .limit(1);

  return refused(existing.length > 0 ? "recipient-already-retired" : "recipient-not-found");
}
