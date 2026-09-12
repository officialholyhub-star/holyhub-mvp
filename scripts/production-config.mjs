// Pure validation shared by the deployment preflight and its offline tests.
export function productionConfigErrors(env) {
  const errors = [];
  const origin = (name) => {
    try {
      const value = new URL(env[name] ?? '');
      if (value.protocol !== 'https:' || value.username || value.password || value.search || value.hash || value.pathname !== '/') throw Error();
      return value;
    } catch { errors.push(name + ' must be an HTTPS origin without a path or credentials.'); }
  };
  const database = origin('NEXT_PUBLIC_SUPABASE_URL');
  const site = origin('NEXT_PUBLIC_SITE_URL');
  if (database && (!/^[a-z0-9]{20}\.supabase\.co$/.test(database.hostname))) errors.push('Use the real hosted Supabase project URL, not a local adapter or placeholder.');
  if (site && (site.hostname === 'localhost' || site.hostname.endsWith('.test') || !site.hostname.includes('.') || /^[\d.]+$/.test(site.hostname))) errors.push('Use the public application domain.');
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  if (key.startsWith('sb_secret_') || /service_role|secret|placeholder|YOUR_KEY|demo/i.test(key)) {
    errors.push('The public Supabase key must not be a secret, service-role key or placeholder.');
  } else if (!/^sb_publishable_[a-zA-Z0-9_-]{16,}$/.test(key)) {
    try {
      const parts = key.split('.');
      const payload = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString());
      if (parts.length !== 3 || payload.role !== 'anon' || !payload.exp || payload.exp * 1000 <= Date.now()) throw Error();
      if (database && payload.ref !== database.hostname.split('.')[0]) throw Error();
    } catch { errors.push('Set a valid publishable key or matching, unexpired legacy anon key.'); }
  }
  for (const name of ['HOLYHUB_LOCAL_DEMO','HOLYHUB_DEMO_SAMPLE_DATA','HOLYHUB_STRIPE_WEBHOOKS_ENABLED']) {
    if (env[name] && env[name] !== 'false') errors.push(name + ' must be false for this non-payment launch.');
  }
  return errors;
}

export async function checkHostedServices(env, request = fetch) {
  const base = new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin;
  const headers = { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
  const checks = [];
  const read = async (path, options = {}) => {
    const response = await request(base + path, { ...options, headers, cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Error('Service check unavailable');
    return response.json();
  };
  try {
    const status = await read('/rest/v1/rpc/launch_readiness', { method: 'POST', body: '{}' });
    checks.push({ name: 'Database schema and row-level security', ok: status.schema_version === 8 && status.schema_ready === true });
    checks.push({ name: 'Private image storage', ok: status.storage_ready === true });
    checks.push({ name: 'Active, email-confirmed administrator', ok: status.admin_ready === true });
  } catch { checks.push({ name: 'Database migrations / launch_readiness function', ok: false }); }
  try {
    const auth = await read('/auth/v1/settings');
    checks.push({ name: 'Email signup enabled with confirmation required', ok: auth.disable_signup === false && auth.mailer_autoconfirm === false && auth.external?.email === true });
  } catch { checks.push({ name: 'Authentication service', ok: false }); }
  return checks;
}
