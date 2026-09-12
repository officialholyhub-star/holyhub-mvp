// Local browser-test double only. Never used by the application or a deployed environment.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

let users, profiles, roles, businesses;
function reset() {
  users = [makeUser('11111111-1111-4111-8111-111111111111', 'owner@example.test'), makeUser('33333333-3333-4333-8333-333333333333', 'admin@example.test')];
  profiles = users.map(user => ({ id: user.id, full_name: 'Test user', account_status: 'active', created_at: new Date().toISOString() }));
  roles = users.flatMap(user => [{ user_id: user.id, role: 'customer' }, ...(user.email.startsWith('admin') ? [{ user_id: user.id, role: 'admin' }] : [])]);
  businesses = [];
}
function makeUser(id, email) { return { id, email, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: new Date().toISOString(), email_confirmed_at: new Date().toISOString() }; }
function session(user) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })}.test-signature`;
  return { access_token, refresh_token: `test-${user.id}`, token_type: 'bearer', expires_in: 3600, user };
}
reset();
createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:54329');
  const send = (status, data, headers = {}) => { response.writeHead(status, { 'Content-Type': 'application/json', ...headers }); response.end(data === undefined ? '' : JSON.stringify(data)); };
  try {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    let user;
    try { user = users.find(item => item.id === JSON.parse(Buffer.from((request.headers.authorization ?? '').split('.')[1], 'base64url').toString()).sub); } catch { /* anonymous test request */ }
    if (url.pathname === '/__test/reset') { reset(); return send(200, { ok: true }); }
    if (url.pathname === '/__test/health') return send(200, { ok: true });
    if (url.pathname === '/auth/v1/token') {
      const match = users.find(item => item.email === body.email);
      return match && body.password === 'Test-only-password8!' ? send(200, session(match)) : send(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    }
    if (url.pathname === '/auth/v1/signup') {
      const created = makeUser(randomUUID(), body.email); users.push(created);
      profiles.push({ id: created.id, full_name: body.data?.full_name ?? '', account_status: 'active' }); roles.push({ user_id: created.id, role: 'customer' });
      return send(200, created); // No session until email confirmation, like production.
    }
    if (url.pathname === '/auth/v1/verify') return body.token_hash === 'valid-test-link' ? send(200, session(users[0])) : send(403, { msg: 'Expired token' });
    if (url.pathname === '/auth/v1/recover' || url.pathname === '/auth/v1/logout') return send(200, {});
    if (url.pathname === '/auth/v1/user') {
      if (!user) return send(401, { msg: 'Not signed in' });
      if (request.method === 'PUT' && body.email) user.email = body.email;
      return send(200, user);
    }
    const admin = user && roles.some(role => role.user_id === user.id && role.role === 'admin');
    if (url.pathname === '/rest/v1/rpc/review_business') {
      if (!admin) return send(403, { message: 'Not authorised' });
      const listing = businesses.find(item => item.id === body.listing_id && item.updated_at === body.expected_updated_at);
      if (!listing) return send(200, false);
      listing.status = body.decision; listing.updated_at = new Date().toISOString();
      return send(200, true);
    }
    const table = url.pathname.split('/').at(-1);
    const tables = { profiles, user_roles: roles, businesses };
    if (!tables[table]) return send(404, { message: 'Unknown test endpoint' });
    let rows = tables[table].filter(item => table === 'businesses' ? item.status === 'approved' || admin || item.owner_id === user?.id : admin || (item.id ?? item.user_id) === user?.id);
    for (const [key, value] of url.searchParams) if (value.startsWith('eq.')) rows = rows.filter(item => String(item[key]) === value.slice(3));
    const or = url.searchParams.get('or');
    if (or) { const term = or.match(/ilike\.%([^%]+)%/)?.[1].toLowerCase() ?? ''; rows = rows.filter(item => [item.name, item.summary, item.location].some(value => value.toLowerCase().includes(term))); }
    if (request.method === 'POST') {
      if (!user || table !== 'businesses' || body.owner_id !== user.id) return send(403, { message: 'Forbidden' });
      if (businesses.some(item => item.owner_id === user.id)) return send(409, { code: '23505', message: 'Duplicate' });
      const listing = { ...body, id: randomUUID(), status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; businesses.push(listing); rows = [listing];
    }
    if (request.method === 'PATCH') {
      rows = rows.filter(item => (item.owner_id ?? item.id) === user?.id);
      rows.forEach(item => Object.assign(item, body, ...(table === 'businesses' ? [{ status: 'pending', updated_at: new Date().toISOString() }] : [])));
    }
    const count = rows.length;
    rows = rows.slice(Number(url.searchParams.get('offset') ?? 0), Number(url.searchParams.get('offset') ?? 0) + Number(url.searchParams.get('limit') ?? 1000));
    const single = request.headers.accept?.includes('application/vnd.pgrst.object+json');
    if (single && rows.length !== 1) return send(406, { code: 'PGRST116', details: `The result contains ${rows.length} rows`, message: 'Cannot coerce to single JSON object' });
    return send(200, single ? rows[0] : rows, { 'Content-Range': `0-${Math.max(rows.length - 1, 0)}/${count}` });
  } catch (error) { return send(500, { message: error.message }); }
}).listen(54329, '127.0.0.1');
