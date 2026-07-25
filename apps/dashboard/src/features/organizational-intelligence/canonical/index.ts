/*
 * Phase 5A — Organizational Intelligence Canonical Contract Foundation.
 *
 * Pure, declarative, vendor-neutral domain contracts. Immutable, inert,
 * infrastructure-free. This barrel is intentionally separate from the
 * organizational-intelligence engine layer; the engines do not import it and
 * it imports nothing outside this package.
 */

export {
  ORGANIZATIONAL_LIFECYCLE_STATES,
  type MetadataValue,
  type OrganizationalEffectivePeriod,
  type OrganizationalLifecycle,
  type OrganizationalLifecycleStatus,
  type OrganizationalProvenance,
} from "./validation";
export {
  ORGANIZATIONAL_IDENTITY_ERROR_CODES,
  ORGANIZATIONAL_IDENTITY_VERSION,
  createOrganizationalIdentity,
  validateOrganizationalIdentity,
  type ExternalIdentifier,
  type OrganizationalIdentity,
  type OrganizationalIdentityErrorCode,
  type OrganizationalIdentityValidation,
} from "./organizational-identity";
export {
  WORKSPACE_SCOPE_ERROR_CODES,
  WORKSPACE_SCOPE_VERSION,
  createWorkspaceScope,
  validateWorkspaceScope,
  type WorkspaceScope,
  type WorkspaceScopeErrorCode,
  type WorkspaceScopeValidation,
} from "./workspace-scope";
export {
  ORGANIZATION_ERROR_CODES,
  ORGANIZATION_VERSION,
  createOrganization,
  validateOrganization,
  type Organization,
  type OrganizationErrorCode,
  type OrganizationValidation,
} from "./organization";
export {
  LEGAL_ENTITY_ERROR_CODES,
  LEGAL_ENTITY_VERSION,
  createLegalEntity,
  validateLegalEntity,
  type LegalEntity,
  type LegalEntityErrorCode,
  type LegalEntityValidation,
  type RegistrationIdentifier,
} from "./legal-entity";
export {
  ORGANIZATIONAL_UNIT_ERROR_CODES,
  ORGANIZATIONAL_UNIT_KINDS,
  ORGANIZATIONAL_UNIT_VERSION,
  createOrganizationalUnit,
  validateOrganizationalUnit,
  type OrganizationalUnit,
  type OrganizationalUnitErrorCode,
  type OrganizationalUnitKind,
  type OrganizationalUnitValidation,
} from "./organizational-unit";
export {
  ACTOR_ERROR_CODES,
  ACTOR_TYPES,
  ACTOR_VERSION,
  createActor,
  validateActor,
  type Actor,
  type ActorErrorCode,
  type ActorType,
  type ActorValidation,
} from "./actor";
export {
  PERSON_ERROR_CODES,
  PERSON_VERSION,
  createPerson,
  validatePerson,
  type Person,
  type PersonErrorCode,
  type PersonValidation,
} from "./person";
export {
  AI_AGENT_CLASSIFICATIONS,
  AI_AGENT_ERROR_CODES,
  AI_AGENT_VERSION,
  createAIAgent,
  validateAIAgent,
  type AIAgent,
  type AIAgentClassification,
  type AIAgentErrorCode,
  type AIAgentValidation,
} from "./ai-agent";
