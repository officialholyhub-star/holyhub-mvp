// Starts only local processes. Nothing is deployed and no hosted database is used.
import { spawn } from 'node:child_process';
const port=Number(process.env.PORT??3100),apiPort=Number(process.env.HOLYHUB_DEMO_API_PORT??54330);
const children=[];
function stop(){for(const child of children)child.kill();}
process.on('SIGINT',()=>{stop();process.exit(0);});process.on('SIGTERM',()=>{stop();process.exit(0);});
function start(args,env){const child=spawn(process.execPath,args,{stdio:'inherit',windowsHide:true,env:{...process.env,...env}});children.push(child);child.on('exit',code=>{if(code){stop();process.exit(code);}});return child;}
start(['tests/fixtures/marketplace-api.mjs'],{HOLYHUB_DEMO_API_PORT:String(apiPort)});
let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(`http://127.0.0.1:${apiPort}/__test/health`)).ok;}catch{}if(ready)break;await new Promise(resolve=>setTimeout(resolve,500));}if(!ready){stop();throw Error('Local demo data did not start');}
start(['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',String(port)],{NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${apiPort}`,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'local-demo-only',NEXT_PUBLIC_SITE_URL:`http://127.0.0.1:${port}`,HOLYHUB_LOCAL_DEMO:'true',HOLYHUB_STRIPE_WEBHOOKS_ENABLED:'false',SUPABASE_SERVICE_ROLE_KEY:'',STRIPE_WEBHOOK_SECRET:'',NEXT_TELEMETRY_DISABLED:'1'});
console.log(`\nHolyHub demo: http://127.0.0.1:${port}\nAccounts: customer@holyhub.test, seller@holyhub.test, admin@holyhub.test\nPassword for each: HolyHub-demo-2026!\nFictional data only; resets when restarted.\n`);
