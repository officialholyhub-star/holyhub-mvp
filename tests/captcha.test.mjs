import test from 'node:test';
import assert from 'node:assert/strict';
import { captchaInput } from '../lib/auth/captcha.ts';

test('optional CAPTCHA does not change unconfigured auth and never trusts a token as verification', () => {
  const form=new FormData();assert.deepEqual(captchaInput(form,false),{});
  assert.ok(captchaInput(form,true).error);
  form.set('captcha_token','unverified-token-for-provider-validation');
  assert.deepEqual(captchaInput(form,true),{token:'unverified-token-for-provider-validation'});
  assert.deepEqual(captchaInput(form,false),{});
});

test('CAPTCHA form input rejects files, oversized strings and whitespace', () => {
  const form=new FormData();
  for(const token of ['', ' ', 'token\nmore', 'a'.repeat(2049), new File(['x'],'token.txt')]) {
    form.set('captcha_token',token);assert.ok(captchaInput(form,true).error);assert.equal(captchaInput(form,true).token,undefined);
  }
});
