import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypescript } from './helpers/load-typescript.mjs';
const { onboardingStep, onboardingCookie, hasSubmittedProduct } = loadTypescript('lib/lister-onboarding.ts');
test('onboarding progress rejects invalid cookie values and scopes progress to accounts', () => {
  for (const value of [undefined, '', 'NaN', '0', '6', '2.5', '-1']) assert.equal(onboardingStep(value), 1);
  assert.equal(onboardingStep('4:later'), 4);
  assert.notEqual(onboardingCookie('alice'), onboardingCookie('bob'));
});
test('drafts do not complete onboarding; review submissions do, including rejected products', () => {
  assert.equal(hasSubmittedProduct([]), false);
  assert.equal(hasSubmittedProduct([{review_status:'draft'}]), false);
  for (const review_status of ['pending','approved','rejected']) assert.equal(hasSubmittedProduct([{review_status}]), true);
});
test('leaving and resuming stores an account cookie and preserves role checks', async () => {
  const writes = [];
  const { advanceOnboarding } = loadTypescript('app/lister/onboarding/actions.ts', {
    'next/headers': {cookies: async()=>({set: (...args)=>writes.push(args)})},
    'next/navigation': {redirect: path=>{throw new Error(path);}},
    '@/lib/auth/require-user': {requireRole: async role=>{assert.equal(role,'lister');return {user:{id:'alice'}};}},
  });
  const form = new FormData(); form.set('step','4'); form.set('later','1');
  await assert.rejects(advanceOnboarding(form), /\/lister$/);
  assert.equal(writes[0][0], 'hh-setup-alice');
  assert.equal(writes[0][1], '4:later');
  assert.equal(writes[0][2].httpOnly, true);
  form.delete('later'); form.set('step','5');
  await assert.rejects(advanceOnboarding(form), /\/lister\/products\/new\?onboarding=1/);
});
