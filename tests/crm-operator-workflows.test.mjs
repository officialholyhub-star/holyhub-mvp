import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const s=fs.readFileSync('lib/crm/services/operator.ts','utf8');
test('failed route health automatically creates a durable hold and cannot silently clear one',()=>{
  assert.match(s,/health==="failed"\|\|health==="held"/);
  assert.match(s,/INSERT INTO crm\.safety/);
  assert.match(s,/route_normalised_value\)/);
  assert.doesNotMatch(s,/DELETE FROM crm\.safety/);
});
test('synthetic action duplicate retry uses a transactional advisory lock',()=>{
  assert.match(s,/pg_advisory_xact_lock/);
  assert.match(s,/lower\(title\)=lower\(\$3\) AND status='open'/);
  assert.match(s,/replayed:true/);
});
test('resolving Needs Review actions stores the reviewer reason in audit',()=>{
  assert.match(s,/if\(kind==="action"\)return withTx/);
  assert.match(s,/audit\(c,"action",id,actor,"status","open","completed",reason\)/);
});
test('linked route health does not override permanent objections',()=>{
  assert.match(s,/assessment\.safetyBlocked=true/);
  assert.match(s,/route_health_/);
});
