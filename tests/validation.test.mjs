import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBusiness, publicWebsite, searchTerm, pageNumber, isUuid } from '../lib/businesses.ts';
import { safeNextPath, siteOrigin } from '../lib/auth/redirects.ts';

function form(overrides = {}) {
  const data = new FormData();
  Object.entries({ name: 'Grace Studio', category: 'Art & Creators', location: 'London', summary: 'Art made with faith and purpose.', description: 'A Christian-owned studio making thoughtful art for your home.', website_url: 'https://example.com', faith_confirmed: 'yes', ...overrides }).forEach(([key, value]) => data.set(key, value));
  return data;
}
test('valid submission is normalised and cannot inject ownership or approval', () => {
  const result = validateBusiness(form({ name: '  Grace Studio  ', owner_id: 'someone-else', status: 'approved' }));
  assert.equal(result.data.name, 'Grace Studio');
  assert.equal(result.data.website_url, 'https://example.com/');
  assert.equal(result.data.status, undefined);
  assert.equal(result.data.owner_id, undefined);
});
test('invalid fields return an error and retain form input', () => {
  for (const [field, value] of Object.entries({ name: 'a', category: 'Unknown', location: '', summary: 'short', description: 'too short', website_url: 'javascript:alert(1)', faith_confirmed: '' })) {
    const result = validateBusiness(form({ [field]: value }));
    assert.ok(result.error, field);
    assert.ok(result.values);
    assert.equal(result.data, undefined);
  }
  assert.ok(validateBusiness(form({ summary: 'a'.repeat(181) })).error);
  assert.ok(validateBusiness(form({ description: 'a'.repeat(3001) })).error);
});
test('business links accept public HTTP(S), not executable or credential URLs', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'https://user:pass@example.com', 'https://localhost', 'https://internal.local']) assert.equal(publicWebsite(url), null);
  assert.equal(publicWebsite('https://instagram.com/gracestudio'), 'https://instagram.com/gracestudio');
});
test('redirects stay on site even for encoded or malformed inputs', () => {
  for (const path of [null, undefined, [], '//evil.com', 'https://evil.com', '/\\evil.com', '/%2fevil.com', '/%5cevil.com', '/\n/evil.com', '/%00hello', '/%ZZ', '/x/..//evil.com', '/%2e%2e//evil.com']) assert.equal(safeNextPath(path), '/account', String(path));
  assert.equal(safeNextPath('/account/business?message=saved'), '/account/business?message=saved');
  assert.equal(siteOrigin('https://app.holyhub.co.uk/'), 'https://app.holyhub.co.uk');
  assert.throws(() => siteOrigin('javascript:alert(1)'));
  assert.throws(() => siteOrigin('https://user:pass@example.com'));
});
test('search filters and pagination are bounded', () => {
  assert.equal(searchTerm('Grace%_,name.eq.admin'), 'Grace name eq admin');
  assert.equal(searchTerm(['one', 'two']), '');
  assert.equal(searchTerm('  Café & art  '), 'Café & art');
  assert.equal(searchTerm('a'.repeat(100)).length, 80);
  for (const value of ['-1', 'NaN', '1.5', 'Infinity', undefined, []]) assert.equal(pageNumber(value), 1);
  assert.equal(pageNumber('2000'), 1000);
  assert.ok(isUuid('11111111-1111-4111-8111-111111111111'));
  assert.equal(isUuid("' or true --"), false);
});
