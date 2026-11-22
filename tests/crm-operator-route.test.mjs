import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const service=fs.readFileSync('lib/crm/services/operator.ts','utf8');
const route=fs.readFileSync('app/api/crm/operate/route.ts','utf8');

test('bounded operator API has separate viewer-read and operator-write guards',()=>{
  assert.match(route,/export async function GET[\s\S]*requireCrmUser\(\)/);
  assert.match(route,/export async function POST[\s\S]*requireCrmUser\(\["crm_admin","crm_operator"\]\)/);
  assert.match(route,/clearSafety[\s\S]*crm_admin/);
  assert.doesNotMatch(route,/sendMail|sendEmail|dispatch|mailTransport/);
});
test('operator code has bounded SQL statements not arbitrary SQL execution',()=>{
  assert.match(service,/switch \(view\)/);
  assert.match(service,/switch \(operation\)/);
  assert.doesNotMatch(service,/SELECT .*\$\{view\}|query\(data\.sql/);
  assert.match(service,/ON CONFLICT DO NOTHING/);
});
test('safety clearance is administrator-only and retains an evidence record',()=>{
  assert.match(service,/role!=="crm_admin"/);
  assert.match(service,/synthetic:review-/);
  assert.match(service,/SET status='cleared'/);
  assert.doesNotMatch(service,/DELETE FROM crm\.safety/);
});
test('synthetic-only data admission is enforced at the write boundary',()=>{
  assert.match(service,/syntheticOnly\(\)/);
  assert.match(service,/isFictionalRoute/);
  assert.match(service,/isFictionalOrganisation/);
  assert.match(service,/startsWith\("synthetic:"\)/);
});
