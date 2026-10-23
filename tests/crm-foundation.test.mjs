import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadTypescript } from './helpers/load-typescript.mjs';

const schemaSource = fs.readFileSync('lib/crm/db/schema.ts', 'utf8');
const toolSource = fs.readFileSync('lib/crm/tools/contract.ts', 'utf8');
const dashboardRoute = fs.readFileSync('app/api/crm/dashboard/route.ts', 'utf8');
const actionRoute = fs.readFileSync('app/api/crm/actions/route.ts', 'utf8');

const requiredTables = [
  'organisations', 'contacts', 'contact_routes', 'relationships', 'relationship_contacts',
  'pipelines', 'pipeline_stages', 'actions', 'applications', 'subscribers', 'subscriber_preferences',
  'safety', 'campaigns', 'campaign_membership', 'identity_aliases', 'external_references',
  'internal_users', 'communication_accounts', 'automations', 'integration_events',
  'system_operations', 'eligibility_checks', 'activity', 'stage_history', 'merge_journal',
  'field_change_audit', 'segments', 'metric_definitions', 'data_dictionary', 'validation_rules',
  'privacy_cases', 'data_governance',
];

test('CRM schema contains the approved N18 foundation entities', () => {
  for (const table of requiredTables) assert.match(schemaSource, new RegExp(`\\"${table}\\"`), `missing ${table}`);
});

test('CRM tool contract exposes bounded operations and no generic SQL tool', () => {
  assert.match(toolSource, /crm_get_dashboard/);
  assert.match(toolSource, /crm_create_action/);
  assert.match(toolSource, /crm_transition_stage/);
  assert.doesNotMatch(toolSource, /execute_sql|run_sql|arbitrary_sql/i);
});

test('CRM APIs require the internal CRM authorisation layer', () => {
  assert.match(dashboardRoute, /requireCrmUser/);
  assert.match(actionRoute, /requireCrmUser/);
});

test('sandbox environment guard rejects production-looking database URLs', () => {
  const originalEnvironment = process.env.CRM_ENVIRONMENT;
  process.env.CRM_ENVIRONMENT = 'sandbox';
  const env = loadTypescript('lib/crm/env.ts');
  assert.throws(() => env.assertNoProductionDatabaseHint('postgresql://x@prod-example/holyhub'), /refused/);
  assert.doesNotThrow(() => env.assertNoProductionDatabaseHint('postgresql://x@sandbox-example/holyhub'));
  if (originalEnvironment === undefined) delete process.env.CRM_ENVIRONMENT;
  else process.env.CRM_ENVIRONMENT = originalEnvironment;
});
