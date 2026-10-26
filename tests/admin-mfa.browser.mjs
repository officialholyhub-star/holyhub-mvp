// Actual Next routes, SSR cookies and Server Actions against a loopback-only Supabase fixture.
// No staging/production credentials, real accounts, or secrets are used.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { cpSync, mkdtempSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const tooling = process.env.HOLYHUB_MFA_BROWSER_TOOLS || '/tmp/holyhub-c2-browser';
const { chromium } = createRequire(path.join(tooling,'package.json'))('playwright');
const root = mkdtempSync('/tmp/holyhub-c2-next-');
for (const file of ['app','components','lib','public','next.config.ts','tsconfig.json','package.json','package-lock.json','next-env.d.ts','proxy.ts']) cpSync(path.resolve(file), path.join(root,file), { recursive:true });
writeFileSync(path.join(root,'next.config.ts'), readFileSync(path.join(root,'next.config.ts'),'utf8').replace('const nextConfig: NextConfig = {','const nextConfig: NextConfig = { turbopack: { root: "/" },'));
symlinkSync(path.resolve('node_modules'),path.join(root,'node_modules'),'dir');
const accounts = new Map();
let serial = 0;
function account(email) {
  if (!accounts.has(email)) accounts.set(email,{ id:`11111111-1111-4111-8111-${String(++serial).padStart(12,'0')}`, email, factors: email.startsWith('enrolled') ? [{ id:'primary', factor_type:'totp', status:'verified', friendly_name:'Primary', created_at:new Date().toISOString() }] : [] });
  return accounts.get(email);
}
function user(a) { return { ...a, aud:'authenticated',role:'authenticated', app_metadata:{ provider:'email',providers:['email'] },user_metadata:{},created_at:new Date().toISOString() }; }
function token(a,aal) { return [{alg:'HS256',typ:'JWT'},{sub:a.id,email:a.email,role:'authenticated',aud:'authenticated',aal,amr:[{method:'password'},...(aal==='aal2'?[{method:'totp'}]:[])],exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.')+'.fixture'; }
function session(a,aal) { return {access_token:token(a,aal),refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user:user(a)}; }
const stub = createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  res.setHeader('Access-Control-Allow-Origin','http://localhost:3108');
  res.setHeader('Access-Control-Allow-Headers','authorization, apikey, content-type, x-client-info, x-supabase-api-version');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  if(req.method==='OPTIONS') {res.statusCode=204;return res.end();}
  let raw=''; for await(const chunk of req) raw+=chunk;
  const body=raw?JSON.parse(raw):{};
  const url=new URL(req.url,'http://fixture');
  let claims={}; try { claims=JSON.parse(Buffer.from((req.headers.authorization||'').replace('Bearer ','').split('.')[1],'base64url')); } catch {}
  const a=[...accounts.values()].find(x=>x.id===claims.sub);
  if(url.pathname==='/auth/v1/token') return res.end(JSON.stringify(session(account(body.email),'aal1')));
  if(url.pathname==='/auth/v1/logout') { res.statusCode=204; return res.end(); }
  if(url.pathname==='/auth/v1/user') return res.end(JSON.stringify(user(a)));
  if(url.pathname==='/auth/v1/factors' && req.method==='POST') {
    const factor={id:`factor-${++serial}`,factor_type:'totp',status:'unverified',friendly_name:body.friendly_name,created_at:new Date().toISOString()}; a.factors.push(factor);
    return res.end(JSON.stringify({id:factor.id,type:'totp',totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg"/>',secret:'LOCALTESTKEY',uri:'otpauth://totp/fixture'}}));
  }
  if(url.pathname.endsWith('/challenge')) return res.end(JSON.stringify({id:'challenge-fixture',type:'totp',expires_at:Math.floor(Date.now()/1000)+300}));
  if(url.pathname.endsWith('/verify')) {
    if(body.code!=='123456') {res.statusCode=422;return res.end(JSON.stringify({code:'mfa_verification_failed',msg:'Invalid code'}));}
    const factor=a.factors.find(f=>f.id===url.pathname.split('/')[4]); factor.status='verified';
    return res.end(JSON.stringify(session(a,'aal2')));
  }
  if(url.pathname.startsWith('/rest/v1/')) {
    const table=url.pathname.split('/').at(-1);
    let data=[];
    if(table==='profiles') data=[{id:a.id,account_status:'active',full_name:'Fixture'}];
    if(table==='user_roles') {
      const roles=a.email.startsWith('customer')?['customer']:a.email.startsWith('lister')?['customer','lister']:['customer','admin'];
      data=roles.filter(role=>!url.searchParams.has('role')||url.searchParams.get('role')===`eq.${role}`).map(role=>({user_id:a.id,role}));
    }
    res.setHeader('Content-Range',`0-${Math.max(0,data.length-1)}/${data.length}`);
    if(req.method==='HEAD')return res.end();
    return res.end(JSON.stringify(data));
  }
  res.statusCode=404;res.end('{}');
});
await new Promise(resolve=>stub.listen(0,'127.0.0.1',resolve));
const port=3108; const origin=`http://localhost:${port}`;
const next=spawn(path.resolve('node_modules/.bin/next'),['dev','--port',String(port)],{cwd:root,env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${stub.address().port}`,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-key',SUPABASE_SERVICE_ROLE_KEY:'fixture-only-local-key',NEXT_PUBLIC_SITE_URL:origin},stdio:['ignore','pipe','pipe']});
let output='';next.stdout.on('data',d=>{output+=d;process.stdout.write(d);});next.stderr.on('data',d=>{output+=d;process.stderr.write(d);});
let browser;
try {
  browser=await chromium.launch({headless:true});
  for(let i=0;i<120;i++){if(next.exitCode!==null)throw new Error(output);try{if((await fetch(`${origin}/auth/login`,{signal:AbortSignal.timeout(5000)})).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
  async function login(page,email,nextPath='/admin/products') {
    await page.goto(`${origin}/auth/login?next=${encodeURIComponent(nextPath)}`);
    await page.getByLabel('Email',{exact:true}).fill(email);
    await page.getByLabel('Password',{exact:true}).fill('fixture-password-123');
    await page.getByRole('button',{name:'Log in',exact:true}).click();
  }
  async function verify(page,code='123456') {
    await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Verify and continue'&&!button.disabled));
    await page.getByLabel('Authenticator code',{exact:true}).fill(code);
    await page.getByRole('button',{name:'Verify and continue'}).click();
  }
  const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(60000);
  await login(page,'new-admin@example.test');
  console.log('Submitted first admin login');
  await page.getByRole('heading',{name:'Secure your admin account'}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('next'),'/admin/products');
  await page.getByRole('button',{name:'Set up authenticator'}).click();
  await page.getByAltText('Authenticator enrollment QR code').waitFor();
  await page.getByText('Enter the setup key manually').click();
  assert.ok(await page.getByText('LOCALTESTKEY',{exact:true}).isVisible());
  await verify(page,'000000');await page.getByText("That code couldn't be verified. Use a fresh code and try again.",{exact:true}).waitFor();assert.ok(page.url().includes('/auth/mfa/setup'));
  await verify(page);await page.waitForURL(`${origin}/admin/products`);assert.ok(!page.url().includes('/auth/mfa'));
  await page.goto(`${origin}/admin/security`);await page.getByText('This session has completed MFA.').waitFor();
  await page.getByRole('link',{name:'Add a backup authenticator'}).click();
  await page.getByRole('button',{name:'Set up authenticator'}).click();await page.getByAltText('Authenticator enrollment QR code').waitFor();
  await verify(page);await page.waitForURL(`${origin}/admin/security`);assert.ok(await page.getByText('2 verified authenticators.',{exact:false}).isVisible());
  // Explicit normal password login issues AAL1 again, even with enrolled factors.
  await page.getByRole('button',{name:'Open menu',exact:true}).click();
  await page.getByRole('button',{name:'Log out',exact:true}).click();
  await page.waitForURL(`${origin}/`);
  await login(page,'new-admin@example.test','/admin/orders');
  await page.getByRole('heading',{name:'Enter the code from your authenticator app'}).waitFor();
  await page.goto(`${origin}/admin/analytics`);await page.getByRole('heading',{name:'Enter the code from your authenticator app'}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('next'),'/admin/analytics');
  await verify(page);await page.waitForURL(`${origin}/admin/analytics`);
  await page.getByRole('heading',{name:'Launch metrics',exact:true}).waitFor();
  await context.close();
  for(const [email,destination] of [['customer@example.test','/account'],['lister@example.test','/lister']]) {
    const c=await browser.newContext();const p=await c.newPage();p.setDefaultTimeout(60000);
    await login(p,email,destination);await p.waitForURL(`${origin}${destination}`);
    await p.goto(`${origin}/admin`);await p.waitForURL(/\/account\?error=/);assert.ok(!p.url().includes('/auth/mfa'));
    await c.close();
  }
  console.log('PASS: local browser enrollment/QR/manual key, wrong code, AAL2 cookies, backup, logout/login challenge, direct subpage guard, intended return, and customer/lister AAL1 access.');
} catch(error) { console.error(output.slice(-4000));throw error; }
finally {await browser?.close();next.kill('SIGTERM');await new Promise(resolve=>stub.close(resolve));}
