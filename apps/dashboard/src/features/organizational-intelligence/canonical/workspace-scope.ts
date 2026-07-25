import {
  copy,
  deepFreeze,
  hasOnlyKeys,
  immutableData,
  inert,
  validLifecycle,
  validMetadata,
  validProvenance,
  validText,
  type MetadataValue,
  type OrganizationalLifecycle,
  type OrganizationalProvenance,
} from "./validation";

export const WORKSPACE_SCOPE_VERSION = "workspace-scope/v1";

export const WORKSPACE_SCOPE_ERROR_CODES = [
  "INVALID_WORKSPACE",
  "INVALID_WORKSPACE_ID",
  "CROSS_WORKSPACE_REFERENCE",
  "INVALID_LIFECYCLE",
  "INVALID_PROVENANCE",
  "INVALID_METADATA",
  "IMMUTABILITY_VIOLATION",
] as const;
export type WorkspaceScopeErrorCode = (typeof WORKSPACE_SCOPE_ERROR_CODES)[number];

/**
 * The hard platform boundary: tenant isolation, subscription, deployment, and
 * data boundary. Not a business organization. It has no parent and cannot
 * reference another workspace — the isolation boundary is terminal.
 */
export interface WorkspaceScope {
  readonly workspaceId: string;
  readonly displayName: string;
  readonly isolationBoundary: "hard";
  readonly subscriptionTier: string | null;
  readonly deploymentRegion: string | null;
  readonly lifecycle: OrganizationalLifecycle;
  readonly provenance: OrganizationalProvenance;
  readonly metadata: Readonly<Record<string, MetadataValue>>;
  readonly architectureVersion: typeof WORKSPACE_SCOPE_VERSION;
  readonly executable: false;
  readonly authoritative: false;
}

export interface WorkspaceScopeValidationError {
  readonly code: WorkspaceScopeErrorCode;
  readonly message: string;
}

export interface WorkspaceScopeValidation {
  readonly status: "valid" | "invalid";
  readonly error?: WorkspaceScopeValidationError;
  readonly executable: false;
  readonly authoritative: false;
}

const WORKSPACE_KEYS = [
  "workspaceId", "displayName", "isolationBoundary", "subscriptionTier", "deploymentRegion",
  "lifecycle", "provenance", "metadata", "architectureVersion", "executable", "authoritative",
] as const;
/** Any of these own-keys, or any metadata key mentioning a parent/other workspace, is forbidden. */
const CROSS_WORKSPACE_KEYS = ["parentWorkspaceId", "parentWorkspace", "workspaceRefs", "linkedWorkspaces", "crossWorkspace"];

function invalid(code: WorkspaceScopeErrorCode, message: string): WorkspaceScopeValidation {
  return deepFreeze({ status: "invalid" as const, error: { code, message }, executable: false as const, authoritative: false as const });
}

export function createWorkspaceScope(input: Omit<WorkspaceScope, "architectureVersion">): WorkspaceScope {
  const copied = copy(input) as unknown as Omit<WorkspaceScope, "architectureVersion">;
  if (copied.executable !== false || copied.authoritative !== false) throw new TypeError("Invalid Workspace Scope.");
  return deepFreeze({ ...copied, architectureVersion: WORKSPACE_SCOPE_VERSION });
}

export function validateWorkspaceScope(value: WorkspaceScope): WorkspaceScopeValidation {
  if (!value || typeof value !== "object" || value.architectureVersion !== WORKSPACE_SCOPE_VERSION
    || !value.lifecycle || !value.provenance) {
    return invalid("INVALID_WORKSPACE", "Workspace Scope structure or schema is invalid.");
  }
  if (![value, value.lifecycle, value.provenance].every(inert) || !immutableData(value) || !hasOnlyKeys(value, WORKSPACE_KEYS)) {
    return invalid("IMMUTABILITY_VIOLATION", "Workspace Scope must be immutable inert metadata.");
  }
  if (!validText(value.workspaceId)) return invalid("INVALID_WORKSPACE_ID", "workspaceId is invalid.");
  if (!validText(value.displayName) || value.isolationBoundary !== "hard"
    || (value.subscriptionTier !== null && !validText(value.subscriptionTier))
    || (value.deploymentRegion !== null && !validText(value.deploymentRegion))) {
    return invalid("INVALID_WORKSPACE", "Workspace Scope descriptors are invalid.");
  }
  // No parent or cross-workspace semantics may be smuggled through metadata.
  const metadataKeys = Object.keys(value.metadata).map((key) => key.toLowerCase());
  if (CROSS_WORKSPACE_KEYS.some((forbidden) => metadataKeys.includes(forbidden.toLowerCase()))) {
    return invalid("CROSS_WORKSPACE_REFERENCE", "Workspace Scope cannot reference another workspace.");
  }
  if (!validLifecycle(value.lifecycle)) return invalid("INVALID_LIFECYCLE", "Lifecycle metadata is invalid.");
  if (!validProvenance(value.provenance)) return invalid("INVALID_PROVENANCE", "Provenance metadata is invalid.");
  if (!validMetadata(value.metadata)) return invalid("INVALID_METADATA", "Metadata is invalid.");
  return deepFreeze({ status: "valid" as const, executable: false as const, authoritative: false as const });
}
