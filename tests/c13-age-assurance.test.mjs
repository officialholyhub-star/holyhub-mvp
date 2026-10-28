import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

const signup = read('app/auth/actions.ts');
const onboarding = read('components/customer-onboarding.tsx');
const guard = read('lib/auth/require-user.ts');
const checkout = read('app/checkout/actions.ts');
const listerPage = read('app/lister/apply/page.tsx');
const listerActions = read('app/lister/apply/actions.ts');
const confirmationPage = read('app/account/age-confirmation/page.tsx');
const confirmationActions = read('app/account/age-confirmation/actions.ts');
const migration = read('supabase/migrations/20261028222500_c13_age_assurance.sql');

test('signup requires an explicit unticked-style 18+ confirmation and carries only adult status to auth metadata', () => {
  assert.match(onboarding, /name="confirm_age_18" required/);
  assert.match(onboarding, /I confirm I am 18 or over/);
  assert.match(signup, /formData\.get\("confirm_age_18"\) === "on"/);
  assert.match(signup, /You must confirm that you are 18 or over/);
  assert.match(signup, /age_18_plus_confirmed: true/);
});

test('faith journey remains optional and the religious-belief answer never leaves the client signup component', () => {
  assert.match(onboarding, /Prefer not to say/);
  assert.match(onboarding, /Optional — choose an answer only if you’d like to/);
  assert.match(onboarding, /faith-ui-only/);
  assert.match(onboarding, /faith answer isn’t saved to your HolyHub account/);
  assert.doesNotMatch(signup, /faith/i);
  assert.doesNotMatch(migration, /faith/i);
  assert.doesNotMatch(confirmationActions, /faith/i);
});

test('adult confirmation is persisted in profiles without granting browser update access', () => {
  assert.match(migration, /age_18_plus_confirmed_at timestamptz/);
  assert.match(migration, /age_18_plus_confirmed.*then now\(\)/s);
  assert.match(migration, /do not grant authenticated UPDATE on age_18_plus_confirmed_at/i);
  assert.match(confirmationActions, /createAdminClient\(\)/);
  assert.match(confirmationActions, /age_18_plus_confirmed_at: confirmedAt/);
});

test('legacy unconfirmed accounts are guarded before checkout and lister participation', () => {
  assert.match(guard, /export async function requireAdultUser/);
  assert.match(guard, /age_18_plus_confirmed_at === null/);
  assert.match(guard, /\/account\/age-confirmation\?next=/);
  assert.match(guard, /role === "lister" \? await requireAdultUser\("\/lister"\)/);
  assert.match(checkout, /requireAdultUser\("\/basket"\)/);
  assert.match(listerPage, /requireAdultUser\("\/lister\/apply"\)/);
  assert.match(listerActions, /requireAdultUser\("\/lister\/apply"\)/);
  assert.match(confirmationPage, /Confirm you’re 18 or over/);
});

test('the legacy confirmation path is self-declaration only and collects no DOB, ID or biometric age data', () => {
  for (const source of [onboarding, confirmationPage, confirmationActions, migration]) {
    assert.doesNotMatch(source, /date_of_birth|date of birth|passport|biometric|selfie/i);
  }
});
