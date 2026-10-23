import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const crm = pgSchema("crm");
export const crmConfig = pgSchema("crm_config");
export const crmAudit = pgSchema("crm_audit");
export const crmOps = pgSchema("crm_ops");

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const systemSettings = crmConfig.table("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: updatedAt(),
});

export const internalUsers = crmConfig.table(
  "internal_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayName: text("display_name").notNull(),
    authProvider: text("auth_provider").notNull().default("supabase"),
    authSubject: text("auth_subject"),
    crmRole: text("crm_role").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("internal_users_auth_subject_uq").on(table.authProvider, table.authSubject),
    index("internal_users_role_idx").on(table.crmRole, table.active),
  ],
);

export const communicationAccounts = crmConfig.table(
  "communication_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    channel: text("channel").notNull(),
    addressIdentifier: text("address_identifier"),
    ownerInternalUserId: uuid("owner_internal_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("communication_accounts_channel_address_uq").on(table.channel, table.addressIdentifier)],
);

export const pipelines = crmConfig.table(
  "pipelines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    relationshipType: text("relationship_type"),
    version: integer("version").notNull().default(1),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("pipelines_name_version_uq").on(table.name, table.version)],
);

export const pipelineStages = crmConfig.table(
  "pipeline_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pipelineId: uuid("pipeline_id").notNull().references(() => pipelines.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    stageOrder: integer("stage_order").notNull(),
    active: boolean("active").notNull().default(true),
    isTerminal: boolean("is_terminal").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("pipeline_stages_name_uq").on(table.pipelineId, table.name),
    uniqueIndex("pipeline_stages_order_uq").on(table.pipelineId, table.stageOrder),
  ],
);

export const subscriptionTypes = crmConfig.table(
  "subscription_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("subscription_types_key_uq").on(table.key)],
);

export const dataDictionary = crmConfig.table(
  "data_dictionary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityName: text("entity_name").notNull(),
    fieldName: text("field_name").notNull(),
    humanLabel: text("human_label").notNull(),
    dataType: text("data_type").notNull(),
    meaning: text("meaning").notNull(),
    allowedValues: jsonb("allowed_values"),
    required: boolean("required").notNull().default(false),
    authoritativeSource: text("authoritative_source"),
    editableBy: text("editable_by"),
    automationControlled: boolean("automation_controlled").notNull().default(false),
    sensitivity: text("sensitivity").notNull().default("internal"),
    retentionCategory: text("retention_category"),
    validationRuleKey: text("validation_rule_key"),
    schemaVersion: integer("schema_version").notNull().default(1),
    deprecated: boolean("deprecated").notNull().default(false),
    replacementField: text("replacement_field"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("data_dictionary_entity_field_uq").on(table.entityName, table.fieldName, table.schemaVersion)],
);

export const validationRules = crmConfig.table(
  "validation_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    entityName: text("entity_name"),
    description: text("description").notNull(),
    severity: text("severity").notNull().default("error"),
    ruleVersion: integer("rule_version").notNull().default(1),
    ruleDefinition: jsonb("rule_definition").notNull().default(sql`'{}'::jsonb`),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("validation_rules_key_version_uq").on(table.key, table.ruleVersion)],
);

export const metricDefinitions = crmConfig.table(
  "metric_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull(),
    calculationNotes: text("calculation_notes").notNull(),
    filters: jsonb("filters").notNull().default(sql`'{}'::jsonb`),
    version: integer("version").notNull().default(1),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("metric_definitions_key_version_uq").on(table.key, table.version)],
);

export const dataGovernance = crmConfig.table(
  "data_governance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityName: text("entity_name").notNull(),
    retentionCategory: text("retention_category"),
    minimisationNotes: text("minimisation_notes"),
    deletionReviewRule: text("deletion_review_rule"),
    ownerInternalUserId: uuid("owner_internal_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("data_governance_entity_uq").on(table.entityName)],
);

export const organisations = crm.table(
  "organisations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canonicalName: text("canonical_name").notNull(),
    canonicalDomain: text("canonical_domain"),
    category: text("category"),
    legalClassification: text("legal_classification"),
    lifecycleState: text("lifecycle_state").notNull().default("active"),
    mergedIntoOrganisationId: uuid("merged_into_organisation_id"),
    sourceConfidence: text("source_confidence").notNull().default("unresolved"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("organisations_name_idx").on(table.canonicalName),
    uniqueIndex("organisations_domain_uq").on(table.canonicalDomain),
  ],
);

export const contacts = crm.table(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "set null" }),
    givenName: text("given_name"),
    familyName: text("family_name"),
    displayName: text("display_name").notNull(),
    jobTitle: text("job_title"),
    lifecycleState: text("lifecycle_state").notNull().default("active"),
    sourceConfidence: text("source_confidence").notNull().default("unresolved"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [index("contacts_organisation_idx").on(table.organisationId), index("contacts_display_name_idx").on(table.displayName)],
);

export const contactRoutes = crm.table(
  "contact_routes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    routeValue: text("route_value").notNull(),
    normalisedValue: text("normalised_value").notNull(),
    health: text("health").notNull().default("unknown"),
    isPrimary: boolean("is_primary").notNull().default(false),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("contact_routes_channel_value_uq").on(table.channel, table.normalisedValue),
    index("contact_routes_contact_idx").on(table.contactId),
    index("contact_routes_organisation_idx").on(table.organisationId),
    check("contact_routes_has_owner_ck", sql`${table.contactId} IS NOT NULL OR ${table.organisationId} IS NOT NULL`),
  ],
);

export const relationships = crm.table(
  "relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "restrict" }),
    relationshipType: text("relationship_type").notNull(),
    pipelineId: uuid("pipeline_id").references(() => pipelines.id, { onDelete: "restrict" }),
    currentStageId: uuid("current_stage_id").references(() => pipelineStages.id, { onDelete: "restrict" }),
    currentStageEnteredAt: timestamp("current_stage_entered_at", { withTimezone: true }),
    ownerInternalUserId: uuid("owner_internal_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
    handlerInternalUserId: uuid("handler_internal_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
    priority: text("priority").notNull().default("normal"),
    lifecycleState: text("lifecycle_state").notNull().default("active"),
    freshnessState: text("freshness_state").notNull().default("active"),
    futureReviewAt: timestamp("future_review_at", { withTimezone: true }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("relationships_organisation_idx").on(table.organisationId),
    index("relationships_owner_idx").on(table.ownerInternalUserId),
    index("relationships_stage_idx").on(table.pipelineId, table.currentStageId),
  ],
);

export const relationshipContacts = crm.table(
  "relationship_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    relationshipId: uuid("relationship_id").notNull().references(() => relationships.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
    roleName: text("role_name").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    preferredForPurpose: text("preferred_for_purpose"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("relationship_contacts_role_uq").on(table.relationshipId, table.contactId, table.roleName)],
);

export const actions = crm.table(
  "actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    relationshipId: uuid("relationship_id").notNull().references(() => relationships.id, { onDelete: "cascade" }),
    organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    actionType: text("action_type").notNull(),
    title: text("title").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: text("status").notNull().default("open"),
    assignedToInternalUserId: uuid("assigned_to_internal_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
    plannedChannel: text("planned_channel"),
    plannedSenderAccountId: uuid("planned_sender_account_id").references(() => communicationAccounts.id, { onDelete: "set null" }),
    source: text("source").notNull().default("manual"),
    supersededByActionId: uuid("superseded_by_action_id"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("actions_due_idx").on(table.status, table.dueAt),
    index("actions_relationship_idx").on(table.relationshipId),
    index("actions_assignee_idx").on(table.assignedToInternalUserId, table.status),
  ],
);

export const applications = crm.table(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "set null" }),
    relationshipId: uuid("relationship_id").notNull().references(() => relationships.id, { onDelete: "restrict" }),
    sourceSystem: text("source_system").notNull(),
    sourceSubmissionId: text("source_submission_id").notNull(),
    status: text("status").notNull().default("submitted"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByInternalUserId: uuid("reviewed_by_internal_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
    decisionReason: text("decision_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("applications_source_submission_uq").on(table.sourceSystem, table.sourceSubmissionId)],
);

export const subscribers = crm.table(
  "subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    emailNormalised: text("email_normalised").notNull(),
    status: text("status").notNull().default("pending"),
    consentCurrent: boolean("consent_current").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("subscribers_email_uq").on(table.emailNormalised)],
);

export const subscriberPreferences = crm.table(
  "subscriber_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriberId: uuid("subscriber_id").notNull().references(() => subscribers.id, { onDelete: "cascade" }),
    subscriptionTypeId: uuid("subscription_type_id").notNull().references(() => subscriptionTypes.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("inactive"),
    consentEventAt: timestamp("consent_event_at", { withTimezone: true }),
    consentWordingVersion: text("consent_wording_version"),
    privacyNoticeVersion: text("privacy_notice_version"),
    sourceGeneric: text("source_generic"),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    reconsentAt: timestamp("reconsent_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("subscriber_preferences_type_uq").on(table.subscriberId, table.subscriptionTypeId)],
);

export const safety = crm.table(
  "safety",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scopeType: text("scope_type").notNull(),
    organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    contactRouteId: uuid("contact_route_id").references(() => contactRoutes.id, { onDelete: "cascade" }),
    subscriberId: uuid("subscriber_id").references(() => subscribers.id, { onDelete: "cascade" }),
    channel: text("channel"),
    purpose: text("purpose"),
    safetyType: text("safety_type").notNull(),
    status: text("status").notNull().default("active"),
    reason: text("reason").notNull(),
    sourceSystem: text("source_system").notNull(),
    sourceReference: text("source_reference"),
    activeFrom: timestamp("active_from", { withTimezone: true }).notNull().defaultNow(),
    clearedAt: timestamp("cleared_at", { withTimezone: true }),
    clearedByInternalUserId: uuid("cleared_by_internal_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("safety_active_idx").on(table.status, table.safetyType),
    check(
      "safety_has_scope_target_ck",
      sql`${table.organisationId} IS NOT NULL OR ${table.contactId} IS NOT NULL OR ${table.contactRouteId} IS NOT NULL OR ${table.subscriberId} IS NOT NULL`,
    ),
  ],
);

export const campaigns = crm.table(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    campaignType: text("campaign_type").notNull(),
    purpose: text("purpose").notNull(),
    ownerInternalUserId: uuid("owner_internal_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
    status: text("status").notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    sourceCode: text("source_code"),
    approvedAssetFamily: text("approved_asset_family"),
    budgetNotes: text("budget_notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("campaigns_name_uq").on(table.name)],
);

export const campaignMembership = crm.table(
  "campaign_membership",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
    organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "cascade" }),
    relationshipId: uuid("relationship_id").references(() => relationships.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    subscriberId: uuid("subscriber_id").references(() => subscribers.id, { onDelete: "cascade" }),
    membershipStatus: text("membership_status").notNull().default("active"),
    source: text("source").notNull(),
    outcome: text("outcome"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    exitedAt: timestamp("exited_at", { withTimezone: true }),
  },
  (table) => [
    index("campaign_membership_campaign_idx").on(table.campaignId),
    check(
      "campaign_membership_has_target_ck",
      sql`${table.organisationId} IS NOT NULL OR ${table.relationshipId} IS NOT NULL OR ${table.contactId} IS NOT NULL OR ${table.subscriberId} IS NOT NULL`,
    ),
  ],
);

export const identityAliases = crm.table(
  "identity_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    relationshipId: uuid("relationship_id").references(() => relationships.id, { onDelete: "cascade" }),
    aliasType: text("alias_type").notNull(),
    aliasValue: text("alias_value").notNull(),
    normalisedValue: text("normalised_value").notNull(),
    confidence: text("confidence").notNull().default("unresolved"),
    source: text("source").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (table) => [
    index("identity_aliases_lookup_idx").on(table.aliasType, table.normalisedValue),
    check(
      "identity_aliases_has_target_ck",
      sql`${table.organisationId} IS NOT NULL OR ${table.contactId} IS NOT NULL OR ${table.relationshipId} IS NOT NULL`,
    ),
  ],
);

export const externalReferences = crm.table(
  "external_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    canonicalId: uuid("canonical_id").notNull(),
    externalSystem: text("external_system").notNull(),
    externalObjectType: text("external_object_type").notNull(),
    externalId: text("external_id").notNull(),
    sourceReference: text("source_reference"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("external_references_object_uq").on(table.externalSystem, table.externalObjectType, table.externalId)],
);

export const segments = crm.table(
  "segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    entityType: text("entity_type").notNull(),
    ruleJson: jsonb("rule_json").notNull().default(sql`'{}'::jsonb`),
    ownerInternalUserId: uuid("owner_internal_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("segments_name_uq").on(table.name)],
);

export const privacyCases = crm.table(
  "privacy_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    subscriberId: uuid("subscriber_id").references(() => subscribers.id, { onDelete: "set null" }),
    caseType: text("case_type").notNull(),
    status: text("status").notNull().default("open"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    assignedToInternalUserId: uuid("assigned_to_internal_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
    sourceReference: text("source_reference"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("privacy_cases_status_idx").on(table.status, table.caseType)],
);

export const automations = crmOps.table(
  "automations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    automationKey: text("automation_key").notNull(),
    version: integer("version").notNull().default(1),
    purpose: text("purpose").notNull(),
    ownerInternalUserId: uuid("owner_internal_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
    triggerType: text("trigger_type").notNull(),
    sourceSystem: text("source_system"),
    targetSystem: text("target_system").notNull().default("neon_crm"),
    permittedOperations: jsonb("permitted_operations").notNull().default(sql`'[]'::jsonb`),
    permittedFields: jsonb("permitted_fields").notNull().default(sql`'[]'::jsonb`),
    mode: text("mode").notNull().default("sandbox"),
    enabled: boolean("enabled").notNull().default(false),
    environment: text("environment").notNull(),
    dependencies: jsonb("dependencies").notNull().default(sql`'[]'::jsonb`),
    health: text("health").notNull().default("disabled"),
    fallback: text("fallback"),
    configReference: text("config_reference"),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("automations_key_version_uq").on(table.automationKey, table.version)],
);

export const integrationEvents = crmOps.table(
  "integration_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceSystem: text("source_system").notNull(),
    sourceEventId: text("source_event_id").notNull(),
    eventType: text("event_type").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    status: text("status").notNull().default("received"),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    payloadHash: text("payload_hash"),
    validation: jsonb("validation").notNull().default(sql`'{}'::jsonb`),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    lastError: text("last_error"),
    automationId: uuid("automation_id").references(() => automations.id, { onDelete: "set null" }),
    resultingEntityIds: jsonb("resulting_entity_ids").notNull().default(sql`'[]'::jsonb`),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("integration_events_source_event_uq").on(table.sourceSystem, table.sourceEventId),
    index("integration_events_status_idx").on(table.status, table.nextRetryAt),
  ],
);

export const systemOperations = crmOps.table(
  "system_operations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operationType: text("operation_type").notNull(),
    status: text("status").notNull().default("started"),
    actorInternalUserId: uuid("actor_internal_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
    automationId: uuid("automation_id").references(() => automations.id, { onDelete: "set null" }),
    integrationEventId: uuid("integration_event_id").references(() => integrationEvents.id, { onDelete: "set null" }),
    environment: text("environment").notNull(),
    idempotencyKey: text("idempotency_key"),
    requestHash: text("request_hash"),
    result: jsonb("result"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("system_operations_idempotency_uq").on(table.idempotencyKey), index("system_operations_status_idx").on(table.status, table.startedAt)],
);

export const eligibilityChecks = crmOps.table(
  "eligibility_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    relationshipId: uuid("relationship_id").references(() => relationships.id, { onDelete: "cascade" }),
    organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    contactRouteId: uuid("contact_route_id").references(() => contactRoutes.id, { onDelete: "cascade" }),
    subscriberId: uuid("subscriber_id").references(() => subscribers.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    channel: text("channel").notNull(),
    result: text("result").notNull(),
    reasons: jsonb("reasons").notNull().default(sql`'[]'::jsonb`),
    context: jsonb("context").notNull().default(sql`'{}'::jsonb`),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull().defaultNow(),
    evaluatedByInternalUserId: uuid("evaluated_by_internal_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
    automationId: uuid("automation_id").references(() => automations.id, { onDelete: "set null" }),
  },
  (table) => [index("eligibility_checks_subject_idx").on(table.relationshipId, table.evaluatedAt)],
);

export const activity = crmAudit.table(
  "activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    relationshipId: uuid("relationship_id").references(() => relationships.id, { onDelete: "set null" }),
    organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    actionId: uuid("action_id").references(() => actions.id, { onDelete: "set null" }),
    activityType: text("activity_type").notNull(),
    channel: text("channel"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    actorInternalUserId: uuid("actor_internal_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
    communicationAccountId: uuid("communication_account_id").references(() => communicationAccounts.id, { onDelete: "set null" }),
    externalReferenceId: uuid("external_reference_id").references(() => externalReferences.id, { onDelete: "set null" }),
    sourceSystem: text("source_system").notNull(),
    summary: text("summary").notNull(),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (table) => [index("activity_relationship_time_idx").on(table.relationshipId, table.occurredAt)],
);

export const stageHistory = crmAudit.table(
  "stage_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    relationshipId: uuid("relationship_id").notNull().references(() => relationships.id, { onDelete: "cascade" }),
    previousStageId: uuid("previous_stage_id").references(() => pipelineStages.id, { onDelete: "set null" }),
    newStageId: uuid("new_stage_id").notNull().references(() => pipelineStages.id, { onDelete: "restrict" }),
    previousStageExitedAt: timestamp("previous_stage_exited_at", { withTimezone: true }),
    newStageEnteredAt: timestamp("new_stage_entered_at", { withTimezone: true }).notNull(),
    actorInternalUserId: uuid("actor_internal_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
    source: text("source").notNull(),
    reason: text("reason"),
    automationId: uuid("automation_id").references(() => automations.id, { onDelete: "set null" }),
    evidence: jsonb("evidence").notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (table) => [index("stage_history_relationship_idx").on(table.relationshipId, table.newStageEnteredAt)],
);

export const mergeJournal = crmAudit.table(
  "merge_journal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    survivorId: uuid("survivor_id").notNull(),
    mergedId: uuid("merged_id").notNull(),
    actorInternalUserId: uuid("actor_internal_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
    reason: text("reason").notNull(),
    confidence: text("confidence").notNull(),
    evidence: jsonb("evidence").notNull().default(sql`'{}'::jsonb`),
    affectedRecords: jsonb("affected_records").notNull().default(sql`'[]'::jsonb`),
    previousValues: jsonb("previous_values").notNull().default(sql`'{}'::jsonb`),
    mergedAt: timestamp("merged_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("merge_journal_survivor_idx").on(table.entityType, table.survivorId)],
);

export const fieldChangeAudit = crmAudit.table(
  "field_change_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    fieldName: text("field_name").notNull(),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    actorInternalUserId: uuid("actor_internal_user_id").references(() => internalUsers.id, { onDelete: "set null" }),
    source: text("source").notNull(),
    reason: text("reason"),
    operationId: uuid("operation_id").references(() => systemOperations.id, { onDelete: "set null" }),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("field_change_audit_entity_idx").on(table.entityType, table.entityId, table.changedAt)],
);
