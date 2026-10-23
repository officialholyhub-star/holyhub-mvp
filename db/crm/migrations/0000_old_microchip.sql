CREATE SCHEMA "crm";
--> statement-breakpoint
CREATE SCHEMA "crm_audit";
--> statement-breakpoint
CREATE SCHEMA "crm_config";
--> statement-breakpoint
CREATE SCHEMA "crm_ops";
--> statement-breakpoint
CREATE TABLE "crm"."actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"organisation_id" uuid,
	"contact_id" uuid,
	"action_type" text NOT NULL,
	"title" text NOT NULL,
	"due_at" timestamp with time zone,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_to_internal_user_id" uuid,
	"planned_channel" text,
	"planned_sender_account_id" uuid,
	"source" text DEFAULT 'manual' NOT NULL,
	"superseded_by_action_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_audit"."activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relationship_id" uuid,
	"organisation_id" uuid,
	"contact_id" uuid,
	"action_id" uuid,
	"activity_type" text NOT NULL,
	"channel" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_internal_user_id" uuid,
	"communication_account_id" uuid,
	"external_reference_id" uuid,
	"source_system" text NOT NULL,
	"summary" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid,
	"relationship_id" uuid NOT NULL,
	"source_system" text NOT NULL,
	"source_submission_id" text NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_internal_user_id" uuid,
	"decision_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_ops"."automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_key" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"purpose" text NOT NULL,
	"owner_internal_user_id" uuid,
	"trigger_type" text NOT NULL,
	"source_system" text,
	"target_system" text DEFAULT 'neon_crm' NOT NULL,
	"permitted_operations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"permitted_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mode" text DEFAULT 'sandbox' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"environment" text NOT NULL,
	"dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"health" text DEFAULT 'disabled' NOT NULL,
	"fallback" text,
	"config_reference" text,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."campaign_membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"organisation_id" uuid,
	"relationship_id" uuid,
	"contact_id" uuid,
	"subscriber_id" uuid,
	"membership_status" text DEFAULT 'active' NOT NULL,
	"source" text NOT NULL,
	"outcome" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exited_at" timestamp with time zone,
	CONSTRAINT "campaign_membership_has_target_ck" CHECK ("crm"."campaign_membership"."organisation_id" IS NOT NULL OR "crm"."campaign_membership"."relationship_id" IS NOT NULL OR "crm"."campaign_membership"."contact_id" IS NOT NULL OR "crm"."campaign_membership"."subscriber_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "crm"."campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"campaign_type" text NOT NULL,
	"purpose" text NOT NULL,
	"owner_internal_user_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"source_code" text,
	"approved_asset_family" text,
	"budget_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_config"."communication_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"channel" text NOT NULL,
	"address_identifier" text,
	"owner_internal_user_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."contact_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid,
	"organisation_id" uuid,
	"channel" text NOT NULL,
	"route_value" text NOT NULL,
	"normalised_value" text NOT NULL,
	"health" text DEFAULT 'unknown' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_routes_has_owner_ck" CHECK ("crm"."contact_routes"."contact_id" IS NOT NULL OR "crm"."contact_routes"."organisation_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "crm"."contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid,
	"given_name" text,
	"family_name" text,
	"display_name" text NOT NULL,
	"job_title" text,
	"lifecycle_state" text DEFAULT 'active' NOT NULL,
	"source_confidence" text DEFAULT 'unresolved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_config"."data_dictionary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_name" text NOT NULL,
	"field_name" text NOT NULL,
	"human_label" text NOT NULL,
	"data_type" text NOT NULL,
	"meaning" text NOT NULL,
	"allowed_values" jsonb,
	"required" boolean DEFAULT false NOT NULL,
	"authoritative_source" text,
	"editable_by" text,
	"automation_controlled" boolean DEFAULT false NOT NULL,
	"sensitivity" text DEFAULT 'internal' NOT NULL,
	"retention_category" text,
	"validation_rule_key" text,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"deprecated" boolean DEFAULT false NOT NULL,
	"replacement_field" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_config"."data_governance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_name" text NOT NULL,
	"retention_category" text,
	"minimisation_notes" text,
	"deletion_review_rule" text,
	"owner_internal_user_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_ops"."eligibility_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relationship_id" uuid,
	"organisation_id" uuid,
	"contact_id" uuid,
	"contact_route_id" uuid,
	"subscriber_id" uuid,
	"purpose" text NOT NULL,
	"channel" text NOT NULL,
	"result" text NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evaluated_by_internal_user_id" uuid,
	"automation_id" uuid
);
--> statement-breakpoint
CREATE TABLE "crm"."external_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"canonical_id" uuid NOT NULL,
	"external_system" text NOT NULL,
	"external_object_type" text NOT NULL,
	"external_id" text NOT NULL,
	"source_reference" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_audit"."field_change_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"actor_internal_user_id" uuid,
	"source" text NOT NULL,
	"reason" text,
	"operation_id" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."identity_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"organisation_id" uuid,
	"contact_id" uuid,
	"relationship_id" uuid,
	"alias_type" text NOT NULL,
	"alias_value" text NOT NULL,
	"normalised_value" text NOT NULL,
	"confidence" text DEFAULT 'unresolved' NOT NULL,
	"source" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_aliases_has_target_ck" CHECK ("crm"."identity_aliases"."organisation_id" IS NOT NULL OR "crm"."identity_aliases"."contact_id" IS NOT NULL OR "crm"."identity_aliases"."relationship_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "crm_ops"."integration_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_system" text NOT NULL,
	"source_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payload_hash" text,
	"validation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"last_error" text,
	"automation_id" uuid,
	"resulting_entity_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_config"."internal_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"auth_provider" text DEFAULT 'supabase' NOT NULL,
	"auth_subject" text,
	"crm_role" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deactivated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_audit"."merge_journal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"survivor_id" uuid NOT NULL,
	"merged_id" uuid NOT NULL,
	"actor_internal_user_id" uuid,
	"reason" text NOT NULL,
	"confidence" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"affected_records" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"previous_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"merged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_config"."metric_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text NOT NULL,
	"calculation_notes" text NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."organisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_name" text NOT NULL,
	"canonical_domain" text,
	"category" text,
	"legal_classification" text,
	"lifecycle_state" text DEFAULT 'active' NOT NULL,
	"merged_into_organisation_id" uuid,
	"source_confidence" text DEFAULT 'unresolved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_config"."pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"name" text NOT NULL,
	"stage_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_terminal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_config"."pipelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"relationship_type" text,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."privacy_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid,
	"contact_id" uuid,
	"subscriber_id" uuid,
	"case_type" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"assigned_to_internal_user_id" uuid,
	"source_reference" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."relationship_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"role_name" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"preferred_for_purpose" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"relationship_type" text NOT NULL,
	"pipeline_id" uuid,
	"current_stage_id" uuid,
	"current_stage_entered_at" timestamp with time zone,
	"owner_internal_user_id" uuid,
	"handler_internal_user_id" uuid,
	"priority" text DEFAULT 'normal' NOT NULL,
	"lifecycle_state" text DEFAULT 'active' NOT NULL,
	"freshness_state" text DEFAULT 'active' NOT NULL,
	"future_review_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm"."safety" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" text NOT NULL,
	"organisation_id" uuid,
	"contact_id" uuid,
	"contact_route_id" uuid,
	"subscriber_id" uuid,
	"channel" text,
	"purpose" text,
	"safety_type" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"reason" text NOT NULL,
	"source_system" text NOT NULL,
	"source_reference" text,
	"active_from" timestamp with time zone DEFAULT now() NOT NULL,
	"cleared_at" timestamp with time zone,
	"cleared_by_internal_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "safety_has_scope_target_ck" CHECK ("crm"."safety"."organisation_id" IS NOT NULL OR "crm"."safety"."contact_id" IS NOT NULL OR "crm"."safety"."contact_route_id" IS NOT NULL OR "crm"."safety"."subscriber_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "crm"."segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"entity_type" text NOT NULL,
	"rule_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"owner_internal_user_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_audit"."stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"previous_stage_id" uuid,
	"new_stage_id" uuid NOT NULL,
	"previous_stage_exited_at" timestamp with time zone,
	"new_stage_entered_at" timestamp with time zone NOT NULL,
	"actor_internal_user_id" uuid,
	"source" text NOT NULL,
	"reason" text,
	"automation_id" uuid,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."subscriber_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscriber_id" uuid NOT NULL,
	"subscription_type_id" uuid NOT NULL,
	"status" text DEFAULT 'inactive' NOT NULL,
	"consent_event_at" timestamp with time zone,
	"consent_wording_version" text,
	"privacy_notice_version" text,
	"source_generic" text,
	"withdrawn_at" timestamp with time zone,
	"reconsent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid,
	"email_normalised" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"consent_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_config"."subscription_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_ops"."system_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_type" text NOT NULL,
	"status" text DEFAULT 'started' NOT NULL,
	"actor_internal_user_id" uuid,
	"automation_id" uuid,
	"integration_event_id" uuid,
	"environment" text NOT NULL,
	"idempotency_key" text,
	"request_hash" text,
	"result" jsonb,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_config"."system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_config"."validation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"entity_name" text,
	"description" text NOT NULL,
	"severity" text DEFAULT 'error' NOT NULL,
	"rule_version" integer DEFAULT 1 NOT NULL,
	"rule_definition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm"."actions" ADD CONSTRAINT "actions_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "crm"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."actions" ADD CONSTRAINT "actions_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "crm"."organisations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."actions" ADD CONSTRAINT "actions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "crm"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."actions" ADD CONSTRAINT "actions_assigned_to_internal_user_id_internal_users_id_fk" FOREIGN KEY ("assigned_to_internal_user_id") REFERENCES "crm_config"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."actions" ADD CONSTRAINT "actions_planned_sender_account_id_communication_accounts_id_fk" FOREIGN KEY ("planned_sender_account_id") REFERENCES "crm_config"."communication_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_audit"."activity" ADD CONSTRAINT "activity_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "crm"."relationships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_audit"."activity" ADD CONSTRAINT "activity_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "crm"."organisations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_audit"."activity" ADD CONSTRAINT "activity_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "crm"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_audit"."activity" ADD CONSTRAINT "activity_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "crm"."actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_audit"."activity" ADD CONSTRAINT "activity_actor_internal_user_id_internal_users_id_fk" FOREIGN KEY ("actor_internal_user_id") REFERENCES "crm_config"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_audit"."activity" ADD CONSTRAINT "activity_communication_account_id_communication_accounts_id_fk" FOREIGN KEY ("communication_account_id") REFERENCES "crm_config"."communication_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_audit"."activity" ADD CONSTRAINT "activity_external_reference_id_external_references_id_fk" FOREIGN KEY ("external_reference_id") REFERENCES "crm"."external_references"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."applications" ADD CONSTRAINT "applications_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "crm"."organisations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."applications" ADD CONSTRAINT "applications_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "crm"."relationships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."applications" ADD CONSTRAINT "applications_reviewed_by_internal_user_id_internal_users_id_fk" FOREIGN KEY ("reviewed_by_internal_user_id") REFERENCES "crm_config"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ops"."automations" ADD CONSTRAINT "automations_owner_internal_user_id_internal_users_id_fk" FOREIGN KEY ("owner_internal_user_id") REFERENCES "crm_config"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."campaign_membership" ADD CONSTRAINT "campaign_membership_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "crm"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."campaign_membership" ADD CONSTRAINT "campaign_membership_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "crm"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."campaign_membership" ADD CONSTRAINT "campaign_membership_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "crm"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."campaign_membership" ADD CONSTRAINT "campaign_membership_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "crm"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."campaign_membership" ADD CONSTRAINT "campaign_membership_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "crm"."subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."campaigns" ADD CONSTRAINT "campaigns_owner_internal_user_id_internal_users_id_fk" FOREIGN KEY ("owner_internal_user_id") REFERENCES "crm_config"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_config"."communication_accounts" ADD CONSTRAINT "communication_accounts_owner_internal_user_id_internal_users_id_fk" FOREIGN KEY ("owner_internal_user_id") REFERENCES "crm_config"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."contact_routes" ADD CONSTRAINT "contact_routes_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "crm"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."contact_routes" ADD CONSTRAINT "contact_routes_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "crm"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."contacts" ADD CONSTRAINT "contacts_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "crm"."organisations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_config"."data_governance" ADD CONSTRAINT "data_governance_owner_internal_user_id_internal_users_id_fk" FOREIGN KEY ("owner_internal_user_id") REFERENCES "crm_config"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ops"."eligibility_checks" ADD CONSTRAINT "eligibility_checks_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "crm"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ops"."eligibility_checks" ADD CONSTRAINT "eligibility_checks_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "crm"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ops"."eligibility_checks" ADD CONSTRAINT "eligibility_checks_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "crm"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ops"."eligibility_checks" ADD CONSTRAINT "eligibility_checks_contact_route_id_contact_routes_id_fk" FOREIGN KEY ("contact_route_id") REFERENCES "crm"."contact_routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ops"."eligibility_checks" ADD CONSTRAINT "eligibility_checks_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "crm"."subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ops"."eligibility_checks" ADD CONSTRAINT "eligibility_checks_evaluated_by_internal_user_id_internal_users_id_fk" FOREIGN KEY ("evaluated_by_internal_user_id") REFERENCES "crm_config"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ops"."eligibility_checks" ADD CONSTRAINT "eligibility_checks_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "crm_ops"."automations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_audit"."field_change_audit" ADD CONSTRAINT "field_change_audit_actor_internal_user_id_internal_users_id_fk" FOREIGN KEY ("actor_internal_user_id") REFERENCES "crm_config"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_audit"."field_change_audit" ADD CONSTRAINT "field_change_audit_operation_id_system_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "crm_ops"."system_operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."identity_aliases" ADD CONSTRAINT "identity_aliases_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "crm"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."identity_aliases" ADD CONSTRAINT "identity_aliases_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "crm"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."identity_aliases" ADD CONSTRAINT "identity_aliases_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "crm"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ops"."integration_events" ADD CONSTRAINT "integration_events_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "crm_ops"."automations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_audit"."merge_journal" ADD CONSTRAINT "merge_journal_actor_internal_user_id_internal_users_id_fk" FOREIGN KEY ("actor_internal_user_id") REFERENCES "crm_config"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_config"."pipeline_stages" ADD CONSTRAINT "pipeline_stages_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "crm_config"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."privacy_cases" ADD CONSTRAINT "privacy_cases_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "crm"."organisations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."privacy_cases" ADD CONSTRAINT "privacy_cases_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "crm"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."privacy_cases" ADD CONSTRAINT "privacy_cases_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "crm"."subscribers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."privacy_cases" ADD CONSTRAINT "privacy_cases_assigned_to_internal_user_id_internal_users_id_fk" FOREIGN KEY ("assigned_to_internal_user_id") REFERENCES "crm_config"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."relationship_contacts" ADD CONSTRAINT "relationship_contacts_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "crm"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."relationship_contacts" ADD CONSTRAINT "relationship_contacts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "crm"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."relationships" ADD CONSTRAINT "relationships_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "crm"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."relationships" ADD CONSTRAINT "relationships_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "crm_config"."pipelines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."relationships" ADD CONSTRAINT "relationships_current_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("current_stage_id") REFERENCES "crm_config"."pipeline_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."relationships" ADD CONSTRAINT "relationships_owner_internal_user_id_internal_users_id_fk" FOREIGN KEY ("owner_internal_user_id") REFERENCES "crm_config"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."relationships" ADD CONSTRAINT "relationships_handler_internal_user_id_internal_users_id_fk" FOREIGN KEY ("handler_internal_user_id") REFERENCES "crm_config"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."safety" ADD CONSTRAINT "safety_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "crm"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."safety" ADD CONSTRAINT "safety_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "crm"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."safety" ADD CONSTRAINT "safety_contact_route_id_contact_routes_id_fk" FOREIGN KEY ("contact_route_id") REFERENCES "crm"."contact_routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."safety" ADD CONSTRAINT "safety_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "crm"."subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."safety" ADD CONSTRAINT "safety_cleared_by_internal_user_id_internal_users_id_fk" FOREIGN KEY ("cleared_by_internal_user_id") REFERENCES "crm_config"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."segments" ADD CONSTRAINT "segments_owner_internal_user_id_internal_users_id_fk" FOREIGN KEY ("owner_internal_user_id") REFERENCES "crm_config"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_audit"."stage_history" ADD CONSTRAINT "stage_history_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "crm"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_audit"."stage_history" ADD CONSTRAINT "stage_history_previous_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("previous_stage_id") REFERENCES "crm_config"."pipeline_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_audit"."stage_history" ADD CONSTRAINT "stage_history_new_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("new_stage_id") REFERENCES "crm_config"."pipeline_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_audit"."stage_history" ADD CONSTRAINT "stage_history_actor_internal_user_id_internal_users_id_fk" FOREIGN KEY ("actor_internal_user_id") REFERENCES "crm_config"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_audit"."stage_history" ADD CONSTRAINT "stage_history_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "crm_ops"."automations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."subscriber_preferences" ADD CONSTRAINT "subscriber_preferences_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "crm"."subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."subscriber_preferences" ADD CONSTRAINT "subscriber_preferences_subscription_type_id_subscription_types_id_fk" FOREIGN KEY ("subscription_type_id") REFERENCES "crm_config"."subscription_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."subscribers" ADD CONSTRAINT "subscribers_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "crm"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ops"."system_operations" ADD CONSTRAINT "system_operations_actor_internal_user_id_internal_users_id_fk" FOREIGN KEY ("actor_internal_user_id") REFERENCES "crm_config"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ops"."system_operations" ADD CONSTRAINT "system_operations_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "crm_ops"."automations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ops"."system_operations" ADD CONSTRAINT "system_operations_integration_event_id_integration_events_id_fk" FOREIGN KEY ("integration_event_id") REFERENCES "crm_ops"."integration_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "actions_due_idx" ON "crm"."actions" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "actions_relationship_idx" ON "crm"."actions" USING btree ("relationship_id");--> statement-breakpoint
CREATE INDEX "actions_assignee_idx" ON "crm"."actions" USING btree ("assigned_to_internal_user_id","status");--> statement-breakpoint
CREATE INDEX "activity_relationship_time_idx" ON "crm_audit"."activity" USING btree ("relationship_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_source_submission_uq" ON "crm"."applications" USING btree ("source_system","source_submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "automations_key_version_uq" ON "crm_ops"."automations" USING btree ("automation_key","version");--> statement-breakpoint
CREATE INDEX "campaign_membership_campaign_idx" ON "crm"."campaign_membership" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_name_uq" ON "crm"."campaigns" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_accounts_channel_address_uq" ON "crm_config"."communication_accounts" USING btree ("channel","address_identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_routes_channel_value_uq" ON "crm"."contact_routes" USING btree ("channel","normalised_value");--> statement-breakpoint
CREATE INDEX "contact_routes_contact_idx" ON "crm"."contact_routes" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "contact_routes_organisation_idx" ON "crm"."contact_routes" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "contacts_organisation_idx" ON "crm"."contacts" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "contacts_display_name_idx" ON "crm"."contacts" USING btree ("display_name");--> statement-breakpoint
CREATE UNIQUE INDEX "data_dictionary_entity_field_uq" ON "crm_config"."data_dictionary" USING btree ("entity_name","field_name","schema_version");--> statement-breakpoint
CREATE UNIQUE INDEX "data_governance_entity_uq" ON "crm_config"."data_governance" USING btree ("entity_name");--> statement-breakpoint
CREATE INDEX "eligibility_checks_subject_idx" ON "crm_ops"."eligibility_checks" USING btree ("relationship_id","evaluated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "external_references_object_uq" ON "crm"."external_references" USING btree ("external_system","external_object_type","external_id");--> statement-breakpoint
CREATE INDEX "field_change_audit_entity_idx" ON "crm_audit"."field_change_audit" USING btree ("entity_type","entity_id","changed_at");--> statement-breakpoint
CREATE INDEX "identity_aliases_lookup_idx" ON "crm"."identity_aliases" USING btree ("alias_type","normalised_value");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_events_source_event_uq" ON "crm_ops"."integration_events" USING btree ("source_system","source_event_id");--> statement-breakpoint
CREATE INDEX "integration_events_status_idx" ON "crm_ops"."integration_events" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE UNIQUE INDEX "internal_users_auth_subject_uq" ON "crm_config"."internal_users" USING btree ("auth_provider","auth_subject");--> statement-breakpoint
CREATE INDEX "internal_users_role_idx" ON "crm_config"."internal_users" USING btree ("crm_role","active");--> statement-breakpoint
CREATE INDEX "merge_journal_survivor_idx" ON "crm_audit"."merge_journal" USING btree ("entity_type","survivor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_definitions_key_version_uq" ON "crm_config"."metric_definitions" USING btree ("key","version");--> statement-breakpoint
CREATE INDEX "organisations_name_idx" ON "crm"."organisations" USING btree ("canonical_name");--> statement-breakpoint
CREATE UNIQUE INDEX "organisations_domain_uq" ON "crm"."organisations" USING btree ("canonical_domain");--> statement-breakpoint
CREATE UNIQUE INDEX "pipeline_stages_name_uq" ON "crm_config"."pipeline_stages" USING btree ("pipeline_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "pipeline_stages_order_uq" ON "crm_config"."pipeline_stages" USING btree ("pipeline_id","stage_order");--> statement-breakpoint
CREATE UNIQUE INDEX "pipelines_name_version_uq" ON "crm_config"."pipelines" USING btree ("name","version");--> statement-breakpoint
CREATE INDEX "privacy_cases_status_idx" ON "crm"."privacy_cases" USING btree ("status","case_type");--> statement-breakpoint
CREATE UNIQUE INDEX "relationship_contacts_role_uq" ON "crm"."relationship_contacts" USING btree ("relationship_id","contact_id","role_name");--> statement-breakpoint
CREATE INDEX "relationships_organisation_idx" ON "crm"."relationships" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "relationships_owner_idx" ON "crm"."relationships" USING btree ("owner_internal_user_id");--> statement-breakpoint
CREATE INDEX "relationships_stage_idx" ON "crm"."relationships" USING btree ("pipeline_id","current_stage_id");--> statement-breakpoint
CREATE INDEX "safety_active_idx" ON "crm"."safety" USING btree ("status","safety_type");--> statement-breakpoint
CREATE UNIQUE INDEX "segments_name_uq" ON "crm"."segments" USING btree ("name");--> statement-breakpoint
CREATE INDEX "stage_history_relationship_idx" ON "crm_audit"."stage_history" USING btree ("relationship_id","new_stage_entered_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriber_preferences_type_uq" ON "crm"."subscriber_preferences" USING btree ("subscriber_id","subscription_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_email_uq" ON "crm"."subscribers" USING btree ("email_normalised");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_types_key_uq" ON "crm_config"."subscription_types" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "system_operations_idempotency_uq" ON "crm_ops"."system_operations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "system_operations_status_idx" ON "crm_ops"."system_operations" USING btree ("status","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "validation_rules_key_version_uq" ON "crm_config"."validation_rules" USING btree ("key","rule_version");