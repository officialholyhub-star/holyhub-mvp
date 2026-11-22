import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const source=fs.readFileSync('app/admin/crm/console.tsx','utf8');
const page=fs.readFileSync('app/admin/crm/page.tsx','utf8');
test('all seven approved operator areas exist',()=>{
  for(const label of ['Organisations','Contacts','Contact routes','Relationships','Follow-ups','Contact safety','Needs Review']){
    assert.ok(source.includes(label),'missing '+label);
  }
});
test('operator console uses bounded CRM API, not direct credentials or integrations',()=>{
  assert.match(source,/\/api\/crm\/operate/);
  assert.doesNotMatch(source,/CRM_DATABASE_URL|supabase\.auth|gmail\.send|tally\.so|process\.env/);
  assert.match(page,/<CrmConsole/);
});
test('viewer has no write controls and safety clearance needs admin role',()=>{
  assert.match(source,/role==="crm_admin"\|\|role==="crm_operator"/);
  assert.match(source,/tab==="safety"&&role==="crm_admin"/);
  assert.match(source,/role==="crm_viewer"/);
});
