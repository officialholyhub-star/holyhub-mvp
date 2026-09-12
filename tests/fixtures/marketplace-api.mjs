// Loopback-only Supabase protocol adapter for demos/tests. All table/RPC access uses
// the actual migrations and row-level permissions in an ephemeral PGlite database.
// Never deploy this file or expose its port through a tunnel.
import { createServer } from 'node:http';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { marketplaceDatabase } from '../helpers/database.mjs';
import { seedMarketplace,demoPassword } from './marketplace-seed.mjs';

const port=Number(process.env.HOLYHUB_DEMO_API_PORT??54330);
const secret=randomBytes(32),objects=new Map(),links=new Map();
const sampleData=process.env.HOLYHUB_DEMO_SAMPLE_DATA==='true';
let database=await marketplaceDatabase(),accounts=sampleData?await seedMarketplace(database,objects):[];
const tables=new Map();
for(const row of (await database.db.query("select table_name,column_name from information_schema.columns where table_schema='public'")).rows){if(!tables.has(row.table_name))tables.set(row.table_name,new Set());tables.get(row.table_name).add(row.column_name);}
const rpcs=new Set(['launch_readiness','save_event','set_event_status','save_product','set_product_status','set_basket_item','add_basket_item','prepare_order','request_refund','respond_refund','decide_refund','appeal_refund','admin_marketplace','update_fulfillment','mark_notifications_read','register_image','review_business','order_delivery']);
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const sign=value=>createHmac('sha256',secret).update(value).digest('base64url');
const userObject=u=>({id:u.id,email:u.email,aud:'authenticated',role:'authenticated',app_metadata:{provider:'email',providers:['email']},user_metadata:{full_name:u.name},created_at:'2026-01-01T00:00:00Z',email_confirmed_at:'2026-01-01T00:00:00Z'});
function session(u){const token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:u.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})}`;return {access_token:`${token}.${sign(token)}`,refresh_token:`local-${u.id}`,expires_in:3600,token_type:'bearer',user:userObject(u)};}
function authenticate(header){try{const token=header?.replace(/^Bearer /,''),parts=token.split('.'),expected=Buffer.from(sign(`${parts[0]}.${parts[1]}`)),actual=Buffer.from(parts[2]);if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return null;const claims=JSON.parse(Buffer.from(parts[1],'base64url'));return claims.exp>Date.now()/1000?accounts.find(u=>u.id===claims.sub):null;}catch{return null;}}
function identifier(table,name){if(!tables.get(table)?.has(name))throw Error('Unknown demo column');return `"${name}"`;}
function filters(table,params,values){const clauses=[];for(const [key,value] of params){if(['select','order','limit','offset','or'].includes(key))continue;const col=identifier(table,key),index=value.indexOf('.'),op=value.slice(0,index),arg=value.slice(index+1);if(op==='in'){const list=arg.slice(1,-1).split(',').filter(Boolean).map(s=>s.replace(/^"|"$/g,''));clauses.push(list.length?`${col} in (${list.map(s=>{values.push(s);return '$'+values.length;}).join(',')})`:'false');}else{const operators={eq:'=',gt:'>',gte:'>=',lt:'<',lte:'<=',ilike:'ilike'};if(!operators[op])throw Error('Unsupported demo filter');values.push(arg);clauses.push(`${col} ${operators[op]} $${values.length}`);}}
 const or=params.get('or');if(or){const terms=or.slice(1,-1).split(',').map(term=>{const match=term.match(/^(\w+)\.ilike\.(.*)$/);if(!match)throw Error('Unsupported demo search');values.push(match[2]);return `${identifier(table,match[1])} ilike $${values.length}`;});clauses.push(`(${terms.join(' or ')})`);}return clauses.length?' where '+clauses.join(' and '):'';}

const server=createServer(async(request,response)=>{
 const url=new URL(request.url,`http://127.0.0.1:${port}`);
 const send=(status,data,headers={})=>{response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});response.end(request.method==='HEAD'||data===undefined?'':JSON.stringify(data));};
 // No cross-origin browser use, remote access or credential reuse is permitted.
 if(request.headers.origin&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(request.headers.origin))return send(403,{message:'Local demo only'});
 try{
  if(url.pathname==='/__test/health')return send(200,{ok:true});
  if(url.pathname==='/__test/reset'&&request.method==='POST'){const next=await marketplaceDatabase(),newObjects=new Map(),newAccounts=sampleData&&url.searchParams.get('empty')!=='1'?await seedMarketplace(next,newObjects):[],previous=database;database=next;accounts=newAccounts;objects.clear();links.clear();for(const [key,value] of newObjects)objects.set(key,value);setTimeout(()=>previous.db.close(),5000).unref();return send(200,{ok:true});}
  const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>8*1024*1024)return send(413,{message:'Too large'});chunks.push(chunk);}const bytes=Buffer.concat(chunks),body=request.headers['content-type']?.includes('application/json')&&bytes.length?JSON.parse(bytes):{};
  const current=database,u=authenticate(request.headers.authorization),as=fn=>current.as(u?.id??null,fn);
  if(process.env.HOLYHUB_TEST_CAPTCHA==='true'&&['/auth/v1/token','/auth/v1/signup','/auth/v1/recover'].includes(url.pathname)&&body.gotrue_meta_security?.captcha_token!=='holyhub-test-captcha-token')return send(400,{error_code:'captcha_failed',msg:'Isolated test requires the forwarded CAPTCHA token.'});
  if(url.pathname==='/auth/v1/token'){const match=accounts.find(a=>a.email===body.email);return match&&body.password===(match.password??demoPassword)?send(200,session(match)):send(400,{error_code:'invalid_credentials',msg:'Use a local demo account and password.'});}
  if(url.pathname==='/auth/v1/user'){if(!u)return send(401,{msg:'Not signed in'});if(request.method==='PUT'){if(body.password)u.password=body.password;if(body.email)u.email=body.email;}return send(200,userObject(u));}
  if(url.pathname==='/auth/v1/signup'){if(accounts.some(a=>a.email===body.email))return send(400,{msg:'Account exists'});const a={id:randomUUID(),email:body.email,name:body.data?.full_name??'',password:body.password};await database.db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[a.id,{full_name:a.name}]);accounts.push(a);return send(200,userObject(a));}
  if(['/auth/v1/logout','/auth/v1/recover'].includes(url.pathname))return send(200,{});
  if(url.pathname.startsWith('/auth/'))return send(404,{msg:'Email links are not sent by the local demo.'});
  if(url.pathname.startsWith('/storage/v1/')){
   const match=url.pathname.match(/^\/storage\/v1\/object\/(?:(sign)\/)?(product-images|refund-evidence)(?:\/(.*))?$/);if(!match)return send(404,{message:'Unknown storage path'});
   const [,signed,bucket,encodedPath]=match,path=decodeURIComponent(encodedPath??''),key=`${bucket}/${path}`;
   if(signed&&request.method==='GET'){const link=links.get(url.searchParams.get('token'));if(!link||link.key!==key||link.expires<Date.now())return send(403,{message:'Expired image link'});const data=objects.get(key);if(!data)return send(404,{});response.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'private, no-store'});return response.end(data);}
   if(signed&&request.method==='POST'){const rows=await as(tx=>tx.query('select name from storage.objects where bucket_id=$1 and name=$2',[bucket,path]));if(!rows.rows.length)return send(403,{message:'Image unavailable'});const token=randomUUID();links.set(token,{key,expires:Date.now()+60000});return send(200,{signedURL:`/object/sign/${bucket}/${path}?token=${token}`});}
   if(request.method==='POST'&&path){await as(tx=>tx.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,path]));objects.set(key,bytes);return send(200,{Key:key,Id:randomUUID()});}
   if(request.method==='DELETE'){for(const p of body.prefixes??[]){const result=await as(tx=>tx.query('delete from storage.objects where bucket_id=$1 and name=$2 returning name',[bucket,p]));if(result.rows.length)objects.delete(`${bucket}/${p}`);}return send(200,[]);}
   return send(405,{});
  }
  if(url.pathname.startsWith('/rest/v1/rpc/')){const name=url.pathname.split('/').at(-1);if(!rpcs.has(name))return send(404,{message:'Unknown demo procedure'});const values=[],args=Object.entries(body).map(([key,value])=>{if(!/^[a-z_]+$/.test(key))throw Error('Invalid argument');values.push(value);return `"${key}" => $${values.length}`;});if(name==='order_delivery')return send(200,(await as(tx=>tx.query('select * from public.order_delivery($1)',[body.order_id]))).rows);const result=await as(tx=>tx.query(`select public."${name}"(${args.join(',')}) as result`,values));return send(200,result.rows[0]?.result??null);}
  const table=url.pathname.match(/^\/rest\/v1\/(\w+)$/)?.[1];if(!tables.has(table))return send(404,{message:'Unknown demo endpoint'});
  const selection=url.searchParams.get('select')??'*',columns=selection==='*'?'*':selection.split(',').map(c=>identifier(table,c)).join(',');
  const values=[],where=filters(table,url.searchParams,values);let rows,count;
  if(['GET','HEAD'].includes(request.method)){
   const order=url.searchParams.get('order'),sort=order?' order by '+order.split(',').map(s=>{const [col,dir]=s.split('.');return `${identifier(table,col)} ${dir==='desc'?'desc':'asc'}`;}).join(','):'';
   const limit=Math.min(1000,Math.max(0,Number(url.searchParams.get('limit')??1000))),offset=Math.max(0,Number(url.searchParams.get('offset')??0));if(!Number.isSafeInteger(limit)||!Number.isSafeInteger(offset))throw Error('Invalid pagination');
   ({rows,count}=await as(async tx=>({rows:(await tx.query(`select ${columns} from public."${table}"${where}${sort} limit ${limit} offset ${offset}`,values)).rows,count:Number((await tx.query(`select count(*) as n from public."${table}"${where}`,values)).rows[0].n)})));
  }else if(['POST','PATCH'].includes(request.method)&&['profiles','businesses'].includes(table)){
   const entries=Object.entries(body),names=entries.map(([key])=>identifier(table,key));const placeholders=entries.map(([,value])=>{values.push(value);return '$'+values.length;});const query=request.method==='POST'?`insert into public."${table}"(${names.join(',')}) values(${placeholders.join(',')}) returning ${columns}`:`update public."${table}" set ${names.map((name,i)=>`${name}=${placeholders[i]}`).join(',')}${where} returning ${columns}`;rows=(await as(tx=>tx.query(query,values))).rows;count=rows.length;
  }else return send(405,{message:'Read-only demo table'});
  const single=request.headers.accept?.includes('application/vnd.pgrst.object+json');if(single&&rows.length!==1)return send(406,{code:'PGRST116',details:`The result contains ${rows.length} rows`,message:'Cannot coerce to single JSON object'});
  return send(200,single?rows[0]:rows,{'Content-Range':`0-${Math.max(rows.length-1,0)}/${count}`});
 }catch(error){console.error('Local demo request failed:',url.pathname,error.message);return send(error.code==='42501'?403:400,{code:error.code??'DEMO',message:error.message});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Isolated HolyHub demo data: http://127.0.0.1:${port}`));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
