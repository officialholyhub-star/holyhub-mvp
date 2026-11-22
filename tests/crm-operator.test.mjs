import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadTypescript } from './helpers/load-typescript.mjs';

const rules = loadTypescript('lib/crm/safety/rules.ts');
const migration = fs.readFileSync('db/crm/migrations/0001_n18_safety_retention.sql', 'utf8');
const schema = fs.readFileSync('lib/crm/db/schema.ts', 'utf8');
const auth = fs.readFileSync('lib/crm/auth.ts', 'utf8');

test('real-user binding is not performed on CRM page access', () => {
  assert.doesNotMatch(auth, /getSandboxAdminAuthSubject|\.update\(internalUsers\)/);
  assert.match(auth, /requireUser\(\)/);
});
test('safety migration keeps evidence after contact and route deletion', () => {
  assert.match(migration, /route_normalised_value text/);
  assert.match(migration, /organisation_key text/);
  assert.match(migration, /ON DELETE SET NULL/g);
  assert.doesNotMatch(schema.slice(schema.indexOf('export const safety ='),schema.indexOf('export const campaigns =')), /onDelete: "cascade"/);
});
test('fictional identifiers reject real addresses', () => {
  assert.equal(rules.isFictionalRoute('email','someone@fictional.test'),true);
  assert.equal(rules.isFictionalRoute('email','someone@gmail.com'),false);
  assert.equal(rules.isFictionalRoute('phone','+12025550123'),true);
  assert.equal(rules.isFictionalRoute('phone','+447700900111'),false);
});
test('one objection applies irrespective of sender mailbox', () => {
  const objection={status:'active',scopeType:'contact',safetyType:'marketing_objection',channel:'email',purpose:'marketing',routeNormalisedValue:'stay@fictional.test',organisationKey:null,organisationId:null,contactId:null};
  for(const sender of ['alpha@holyhub.test','beta@holyhub.test','gamma@holyhub.test']){
    const result=rules.assessSyntheticEligibility({channel:'email',routeValue:'stay@fictional.test',purpose:'marketing',sender},[objection]);
    assert.equal(result.allowed,false);assert.equal(result.safetyBlocked,true);assert.ok(result.reasons.includes('marketing_objection'));
  }
});
test('ten failed routes including five unlinked are blocked without inventing contacts', () => {
  const controls=Array.from({length:10},(_,i)=>({status:'active',scopeType:'route',safetyType:'failed_route',channel:'email',purpose:'marketing',routeNormalisedValue:`failed${i}@fictional.test`,organisationId:null,organisationKey:null,contactId:null}));
  for(let i=0;i<10;i++){
    const result=rules.assessSyntheticEligibility({channel:'email',routeValue:`failed${i}@fictional.test`,purpose:'marketing'},controls);
    assert.equal(result.safetyBlocked,true);
  }
});
test('known safety evidence remains useful after linked record deletion',()=>{
  const obj={status:'active',scopeType:'route',safetyType:'failed_route',channel:'email',purpose:'marketing',routeNormalisedValue:'orphan@fictional.test',organisationKey:null,organisationId:null,contactId:null};
  assert.equal(rules.assessSyntheticEligibility({channel:'email',routeValue:'orphan@fictional.test',purpose:'marketing'},[obj]).safetyBlocked,true);
});
test('unknown eligibility fails closed',()=>{
  const r=rules.assessSyntheticEligibility({channel:'email',purpose:'marketing'},[]);
  assert.equal(r.allowed,false);assert.ok(r.reasons.includes('unknown_contact_route'));
});
test('organisation-wide stop matches durable domain independent of record id',()=>{
  const obj={status:'active',scopeType:'organisation',safetyType:'marketing_objection',channel:'email',purpose:'marketing',routeNormalisedValue:null,organisationKey:'brand.fictional.test',organisationId:null,contactId:null};
  assert.equal(rules.assessSyntheticEligibility({channel:'email',routeValue:'contact@fictional.test',organisationKey:'brand.fictional.test',purpose:'marketing'},[obj]).safetyBlocked,true);
});
