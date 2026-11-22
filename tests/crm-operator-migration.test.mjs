import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const service=fs.readFileSync('lib/crm/services/operator.ts','utf8');
const journal=JSON.parse(fs.readFileSync('db/crm/migrations/meta/_journal.json','utf8'));
const snapshot=JSON.parse(fs.readFileSync('db/crm/migrations/meta/0001_snapshot.json','utf8'));
const migration=fs.readFileSync('db/crm/migrations/0001_n18_safety_retention.sql','utf8');
test('Drizzle migration journal tracks the safety migration and snapshot',()=>{
  assert.equal(journal.entries.at(-1).tag,'0001_n18_safety_retention');
  assert.equal(snapshot.tables['crm.safety'].foreignKeys.safety_contact_route_id_contact_routes_id_fk.onDelete,'set null');
  assert.ok(snapshot.tables['crm.safety'].columns.route_normalised_value);
  assert.match(migration,/statement-breakpoint/);
});
test('eligibility checks route, contact and organisation evidence, not sender account',()=>{
  assert.match(service,/contact_id IS NOT NULL AND contact_id=\$4/);
  assert.match(service,/organisation_key IS NOT NULL AND organisation_key=\$2/);
  assert.match(service,/SELECT contact_id,organisation_id,health FROM crm.contact_routes/);
  assert.doesNotMatch(service,/senderAccountId|communicationAccountId/);
});
