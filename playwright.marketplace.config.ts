import { defineConfig } from "@playwright/test";
export default defineConfig({
 testDir:"./tests/marketplace-e2e",workers:1,fullyParallel:false,timeout:90_000,expect:{timeout:20_000},
 use:{baseURL:"http://127.0.0.1:3102",trace:"retain-on-failure",screenshot:"only-on-failure"},
 webServer:[
  {command:"node tests/fixtures/marketplace-api.mjs",url:"http://127.0.0.1:54331/__test/health",timeout:60_000,env:{HOLYHUB_DEMO_API_PORT:"54331"}},
  {command:"npm run dev -- --hostname 127.0.0.1 --port 3102",url:"http://127.0.0.1:3102",timeout:120_000,env:{NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54331",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"local-demo-only",NEXT_PUBLIC_SITE_URL:"http://127.0.0.1:3102",HOLYHUB_LOCAL_DEMO:"true",HOLYHUB_STRIPE_WEBHOOKS_ENABLED:"false",SUPABASE_SERVICE_ROLE_KEY:"",STRIPE_WEBHOOK_SECRET:"",NEXT_TELEMETRY_DISABLED:"1"}}
 ]
});
