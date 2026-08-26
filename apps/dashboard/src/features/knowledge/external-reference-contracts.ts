/*
 * knowledge/external-reference-contracts.ts — the KR-EXT1 vocabulary (pure).
 *
 * ── WHAT A REFERENCE IS ──────────────────────────────────────────────────────
 *
 *   "This organization declares that this Knowledge fact concerns this external-system record."
 *
 * A DECLARATION, made by a human, owned by Knowledge. Nothing here is a provider record, provider
 * state, provider health, a verification, a cache, or a synchronization. Hebun does not own the
 * referenced thing.
 *
 * ── THE IDENTITY IS STRUCTURED, AND EVERY PART IS ALREADY OWNED ELSEWHERE ────
 *
 * `providerKey` is the provider catalog's key, `capability` is the provider module's capability key,
 * and `recordId` is the PROVIDER'S own stable identifier. KR-EXT1 mints no identifier scheme: the
 * rendered form `integrations/<provider>/<capability>/<type>/<id>` is DERIVED from these four, so
 * one identity has one spelling and an exact join has real columns to filter on.
 *
 * ── A DISPLAY NAME IS NEVER AN IDENTITY ─────────────────────────────────────
 *
 * `Hebun-AI/hebun-ai-recovered` follows a rename and again a transfer; `1300480452` does not. The
 * shape has no field for a name at all, so a caller cannot store one here even by mistake.
 *
 * Pure. No I/O, no database, no clock, no authority.
 */

/** The most a provider identifier may be, mirrored by the table's own CHECK constraint. */
export const MAX_PROVIDER_KEY_LENGTH = 64;
export const MAX_CAPABILITY_LENGTH = 128;
export const MAX_RECORD_TYPE_LENGTH = 64;
export const MAX_RECORD_ID_LENGTH = 128;

/**
 * ONE EXTERNAL-SYSTEM RECORD, AS HEBUN NAMES IT.
 *
 * Four fields, and there is deliberately no fifth. No display name, no URL, no payload, no status,
 * no timestamp of the provider's own — every one of those would be provider STATE, and this type
 * describes only which record is meant.
 */
export interface ExternalSystemReference {
  readonly providerKey: string;
  readonly capability: string;
  readonly recordType: string;
  readonly recordId: string;
}

/** A recorded declaration, as a reader sees it. */
export interface RecordedExternalReference extends ExternalSystemReference {
  /** The row's own id — an opaque handle for withdrawal. It grants nothing. */
  readonly referenceId: string;
  readonly declaredAt: string;
}

/**
 * Why a reference could not be recorded. Each is a real, distinct situation a person acts on
 * differently, which is why they are not one message.
 */
export type ExternalReferenceRefusal =
  | "no-authorized-tenant-context"
  | "not-authorized"
  | "knowledge-fact-not-found"
  | "malformed-reference"
  | "already-declared"
  | "reference-not-found"
  | "authority-unavailable";

/**
 * A provider identifier, or `null`.
 *
 * WHITESPACE IS REFUSED, NOT TRIMMED. A value arriving with spaces was not produced by the provider
 * seam that owns these identifiers; trimming it would silently accept a hand-edited one and make
 * the stored identity depend on how it was typed.
 */
function identifier(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  if (value.length < 1 || value.length > max) return null;
  if (/\s/.test(value)) return null;
  return value;
}

/**
 * Validate a caller-supplied reference into the closed shape, or refuse.
 *
 * TOTAL AND PURE. It accepts no tenant, no actor, no fact and no credential — those are the
 * server's, and there is no field here through which a client could supply one.
 */
export function validateExternalSystemReference(
  input: unknown,
): { readonly ok: true; readonly reference: ExternalSystemReference } | { readonly ok: false } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false };
  const body = input as Record<string, unknown>;

  const providerKey = identifier(body["providerKey"], MAX_PROVIDER_KEY_LENGTH);
  const capability = identifier(body["capability"], MAX_CAPABILITY_LENGTH);
  const recordType = identifier(body["recordType"], MAX_RECORD_TYPE_LENGTH);
  const recordId = identifier(body["recordId"], MAX_RECORD_ID_LENGTH);
  if (!providerKey || !capability || !recordType || !recordId) return { ok: false };

  return {
    ok: true,
    reference: Object.freeze({ providerKey, capability, recordType, recordId }),
  };
}

/**
 * The rendered identity, DERIVED — never stored.
 *
 * It composes exactly as INT-5B1's `githubRepositoryRecordRef` does, from the same four values, so
 * a reference recorded here and an evidence line produced by a provider read spell one identity the
 * same way without either module importing the other.
 */
export function renderExternalReference(reference: ExternalSystemReference): string {
  return `integrations/${reference.providerKey}/${reference.capability}/${reference.recordType}/${reference.recordId}`;
}

/**
 * THE EXTERNAL-RECORD KINDS A HUMAN MAY CHOOSE FROM, TODAY.
 *
 * A CLOSED LIST, deliberately. Three of the four identity fields are therefore chosen from a menu
 * rather than typed, so the only thing a person supplies by hand is the provider's own record id —
 * and a typo in a provider key or a capability key, which would silently make a reference
 * unjoinable, is unrepresentable.
 *
 * ── WHY IT IS A CONSTANT AND NOT A CATALOG READ ─────────────────────────────
 *
 * The provider catalog is the authority on which providers exist, and Knowledge must not consult it:
 * the I1 firewall forbids any file under `src/features/knowledge` from referencing
 * `integration-authority` or `provider-catalog`, because a Knowledge module that read connection
 * truth would become a second interpreter of it. This list names what a REFERENCE may point at,
 * which is a different question from what is connected — an organization may declare that a fact
 * concerns a repository whether or not GitHub is connected right now.
 *
 * The keys are the released ones, and a test asserts they still match the provider modules that own
 * them, so the duplication cannot drift into a lie.
 */
export const EXTERNAL_RECORD_KINDS: readonly {
  readonly id: string;
  readonly label: string;
  readonly providerKey: string;
  readonly capability: string;
  readonly recordType: string;
  /** What the human must supply, in their words. Never a name — see the module header. */
  readonly recordIdLabel: string;
  readonly recordIdHint: string;
}[] = Object.freeze([
  Object.freeze({
    id: "github-repository",
    label: "GitHub repository",
    providerKey: "github-organization",
    capability: "github.repository.activity.read",
    recordType: "repository",
    recordIdLabel: "Repository ID",
    recordIdHint:
      "GitHub's numeric repository id, shown beside each repository in Integrations and in /repositories. Not the name — a name changes on a rename or a transfer.",
  }),
]);

/** The kind for an id, or `undefined`. A kind outside the closed list is not a kind. */
export function findExternalRecordKind(id: string) {
  return EXTERNAL_RECORD_KINDS.find((kind) => kind.id === id);
}
