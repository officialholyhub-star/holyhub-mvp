# C11 final isolated application/setup preflight — 20 October 2026

**C11 FINANCIAL REHEARSAL: NOT READY. No financial rehearsal was started.** Completed 61 application/setup checks: **60 passed; 1 blocked** on full-Supabase RPC EXECUTE permissions. No application or migration fix was authorized or applied. Only this existing report was edited in the repository.

## A. Synthetic users and fixtures

Created four obviously synthetic users through the **real local Auth admin API**, then signed in through local Auth, verified user identity/JWT claims, and assigned application roles locally. Passwords, sessions, signing secret and service-role values stayed in memory; no plaintext credentials were printed or saved. Reused the same fixture identities on the second pass rather than duplicating them. Auth necessarily stores normal password hashes/session records inside its disposable local database; no new `.env`/credential file was created.

| Fixture | Local Auth UUID | Synthetic email | Database roles |
| --- | --- | --- | --- |
| customer | `4c0198ce-80e7-458b-8831-f118d6997076` | `c11-local-customer-20261020@example.invalid` | customer |
| seller_a | `5650ae7e-2c76-4dbe-8d8d-7aa7c8cb11d3` | `c11-local-seller-a-20261020@example.invalid` | customer, lister |
| seller_b | `d2071e4e-8cd5-41b5-a8f8-56925dd03c90` | `c11-local-seller-b-20261020@example.invalid` | customer, lister |
| admin | `15ee6c45-f88a-4457-be10-65288ee4700d` | `c11-local-admin-20261020@example.invalid` | customer, admin |

Created two **unpublished draft** products, stock 20 each, priced £10/£15, and synthetic storefronts with distinct dispatch settings. No real legal identity profile was invented. Created one zero-value **pending_payment** local order placeholder and two unpaid seller portions solely for ownership/RLS validation. Its reference explicitly starts `C11-LOCAL-NO-STRIPE-`; it is not a Stripe Checkout Session. No checkout rows, paid order, allocation, debt or recovery record was created.

Fixture references:

```json
{
  "products": {
    "seller_a": "4b9fdc77-79b6-408e-9c3b-cb60e9303176",
    "seller_b": "84bd1fd7-a30a-4980-ae22-08d0c6c72d89"
  },
  "unpaid_order": {
    "order": "20bbfeaf-cdac-4e6d-b1c6-2a3fd4448729",
    "portions": {
      "seller_a": "beeaa582-4805-4ff1-9efd-2fc7e02302a5",
      "seller_b": "74cf7235-5c4e-446a-af26-e8c06cb31447"
    }
  }
}
```

These fixtures are ready for permission/setup inspection, **not sale-ready**: products remain draft, seller legal-readiness fixtures were not created, and Terms remain inactive as instructed.

## B. Local app → Supabase readiness — PASSED

Made an isolated copy of 193 current application/config/public files under `/tmp/holyhub-c11-isolated/app`, including the uncommitted C11 implementation. Copied **zero `.env*` files**, no `.git`, shared database data or source build output. Reused installed dependencies through a read-only-use `node_modules` symlink; no dependency install was run. Read installed Next.js 16.3.4 CLI guidance before launching its supported Webpack dev mode.

Started that copy on **http://127.0.0.1:3100**, with explicit child-process Supabase URL **http://127.0.0.1:54321**, matching existing local anon/service keys, and explicit local site URL. Supplied a deliberately invalid synthetic Stripe test key solely so Stripe's local signature utility can initialize; **no real Stripe API key was supplied to the isolated app**. No cloud Supabase environment was inherited. The SDK harness rejects any HTTP destination outside the two loopback ports, and the app has no copied environment fallback. JWTs/cookies and app requests used those same local services.

Anonymous/customer/lister admin-page checks exercised actual HTTP routes. Admin successfully rendered `/admin/payments` and loaded server-side financial views through the service client without the page's load-failure warning. Actual Next.js server-action references were extracted from the admin form and submitted with the deliberately unknown action `C11_PERMISSION_ONLY_UNKNOWN_ACTION`: customer and both sellers were redirected to the access-denied account page; admin reached the guarded action handler and its unknown-action error branch. No `run`, `refund` or account-verification action was invoked through the app.

The app and disposable C11 services were stopped after verification. The isolated source copy and non-secret fixture evidence remain available for a later authorized run.

## C. JWT/RLS/RPC permission results — BEHAVIORAL GUARDS PASS; RPC ACL BLOCKER

Passed with genuine local signed-in JWTs:

- Each customer/lister sees only their own profile/role rows. Customer metadata deliberately claiming admin did not grant the database admin role; direct self-assignment was denied (`42501`).
- Each seller sees only their own draft product and seller portion. Seller A could not edit B's draft; A→B and B→A cancellation calls failed at the ownership selection (`P0002`); the customer failed the active-lister check (`42501`). Those failures occurred before any cancellation/refund reservation.
- Customer, both listers and the raw admin JWT were denied direct reads of all nine C11 financial tables (`42501`). Seller A was denied filtered reads of B's allocations and debt/recovery updates. Financial/settlement bodies were not exercised successfully, and no operations were created.
- The app's admin guard allows the service-backed read path only for the local admin. The raw admin JWT is intentionally not equivalent to `service_role`.
- Service-role credentials could read the intended mapping/financial views, and catalog checks show service EXECUTE on C11 RPCs. No successful mutating financial RPC was invoked.

**Blocked:** on the real Supabase baseline, nine of the ten inspected public C11 functions have unexpected explicit EXECUTE grants. Eight service-only functions permit both `anon` and `authenticated`; the authenticated owner-checking cancellation wrapper also permits `anon`. `process_checkout_payment` already has the expected restricted ACL. C11's `REVOKE ... FROM PUBLIC` does not remove explicit grants supplied by Supabase's default privileges.

This was caught when seller A's raw transfer-reservation request failed with RLS/row-not-found rather than an EXECUTE denial. Table/RLS/private-helper protections prevented the tested mutation, so this is **not evidence that money moved or that a data-access bypass succeeded**. It is a real mismatch with the intended service-only RPC boundary and remains a preflight blocker. The first strict assertion failure is retained separately; subsequent independent checks continued without modifying any permissions.

| Function | anon EXECUTE | authenticated EXECUTE | service EXECUTE |
| --- | --- | --- | --- |
| `cancel_seller_order_with_refund(uuid,text,text)` | true | true | true |
| `process_checkout_payment(text,text,text,integer,text,text,jsonb)` | false | false | true |
| `match_payment_charge(uuid,text,text,integer,integer)` | true | true | true |
| `sync_payment_order(uuid)` | true | true | true |
| `request_payment_refund(uuid,text,jsonb,integer,text,boolean)` | true | true | true |
| `reserve_seller_transfer(uuid)` | true | true | true |
| `account_payment_refund(uuid)` | true | true | true |
| `claim_payment_operation(uuid)` | true | true | true |
| `settle_payment_operation(uuid,uuid,text,text,integer,text)` | true | true | true |
| `restore_payment_stock(uuid)` | true | true | true |

### Concrete proposed permission repair — REVIEW ONLY, NOT EXECUTED

If separately authorized, put these explicit grants/revocations in a **new additive migration**, preserving the authenticated owner-checking cancellation wrapper, and replay/retest only locally first. Do not rewrite the existing C11 migration or apply anything to shared stage/production. No global default-privilege change is needed for this narrowly scoped proposal.

```sql
BEGIN;
REVOKE EXECUTE ON FUNCTION
  public.process_checkout_payment(text,text,text,integer,text,text,jsonb),
  public.match_payment_charge(uuid,text,text,integer,integer),
  public.sync_payment_order(uuid),
  public.request_payment_refund(uuid,text,jsonb,integer,text,boolean),
  public.reserve_seller_transfer(uuid),
  public.account_payment_refund(uuid),
  public.claim_payment_operation(uuid),
  public.settle_payment_operation(uuid,uuid,text,text,integer,text),
  public.restore_payment_stock(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.process_checkout_payment(text,text,text,integer,text,text,jsonb),
  public.match_payment_charge(uuid,text,text,integer,integer),
  public.sync_payment_order(uuid),
  public.request_payment_refund(uuid,text,jsonb,integer,text,boolean),
  public.reserve_seller_transfer(uuid),
  public.account_payment_refund(uuid),
  public.claim_payment_operation(uuid),
  public.settle_payment_operation(uuid,uuid,text,text,integer,text),
  public.restore_payment_stock(uuid)
TO service_role;
REVOKE EXECUTE ON FUNCTION public.cancel_seller_order_with_refund(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_seller_order_with_refund(uuid,text,text) TO authenticated, service_role;
COMMIT;
```

## D. Seller A/B local mapping — PASSED

The synthetic local seller records map exactly to the IDs supplied by Alea:

| Synthetic local seller | Existing Stripe TEST account |
| --- | --- |
| `5650ae7e-2c76-4dbe-8d8d-7aa7c8cb11d3` | `acct_1USI80I2TWBygp4T` |
| `d2071e4e-8cd5-41b5-a8f8-56925dd03c90` | `acct_1USI80I2TWmwDvlt` |

The local admin UUID is the mapping verifier. This is an explicitly authorized **test fixture association**, not a real-world seller ownership claim. Stripe capability readiness relies on the previous verified/pre-supplied state; no Stripe API request or account change was made in this turn.

## E. Signed-webhook technical setup — LOCAL SIGNATURE CHECKS PASSED

Exercised the actual isolated `/api/stripe/webhook` route with an ephemeral signing secret held only in process memory:

| Case | HTTP result |
| --- | --- |
| Missing signature | 400 |
| Invalid signature | 400 |
| Valid locally generated signature, unsupported `c11.preflight.signature_only` type | 200 |
| Tampered body with prior signature | 400 |

The supported test payload was explicitly non-financial and exited before every financial/checkout/charge branch. It is **not** proof of provider event delivery or financial event processing. No real payment/refund/transfer event, Stripe CLI trigger/listener, Dashboard endpoint or Stripe login was created/changed. Financial and webhook-event tables remained empty before and after. No new signing secret was persisted, printed or placed in `.env.local`.

## F. Smallest later Stripe/webhook setup step — NOT PERFORMED

A later real Stripe TEST delivery requires a separately authorized ephemeral Stripe CLI listener forwarding the required C11 event types to **http://127.0.0.1:3100/api/stripe/webhook**. Use the existing platform TEST key through `STRIPE_API_KEY` in memory; if supplied directly, CLI login need not be introduced. Privately capture the **listener's own** signing secret and inject it into the isolated app child process's `STRIPE_WEBHOOK_SECRET`, without terminal disclosure or writing a credential file. Do not reuse a shared/live endpoint secret or modify Dashboard endpoints. A secret-capturing launcher/real provider delivery was outside this step and was not started. This is the exact remaining credential/setup boundary; no real provider event was generated.

## Terms fail-closed result

Both lister JWTs received no current active Terms, `seller_terms_are_current=false`, and `accept_current_lister_terms` refused with `Final Lister Terms are not active yet.` Both actual app Terms pages showed the review/inactive message. Database checks confirm **0 active Terms, 0 acceptances and null recovery_terms_version**. No acceptance evidence was fabricated. Even synthetic local-only Terms activation and genuine subsequent synthetic acceptance require separate approval under the current explicit prohibition; real launch Terms remain untouched.

## G–H. Disk, services and firewall cleanup

Only the same 12 exact-IP rules were reused, resolving current IPs before insertion: Kong `.3` → Auth `.4`:9999, REST `.5`:3000/3001, Edge `.6`:8081; Vector `.11` → Analytics `.10`:4000; and the seven configured service IPs → PostgreSQL `.2`:5432, on `br-c11-local` only. All addresses begin `172.19.0`. No port/subnet-wide rule or persistence was added. Published services remained loopback-bound.

All **12 rules were removed**, with zero rollback errors; legacy FORWARD rules exactly match the saved prior state. No C11 containers or local app process remain intentionally running. No image/container/volume/database was deleted. The second run's database/Auth/Realtime/Kong/Analytics/Vector and other configured health checks were healthy; REST/Edge readiness was validated by prior direct checks and this application's Auth/API requests (they have no Docker health check configured).

Final free `/workspaces` space at report generation: **5792968704 bytes (approximately 5.40 GiB)**. Minimum observed during the completed pass: **5791981568 bytes**; the 2 GiB guard never triggered. All **338 source/project/environment-file fingerprints** outside this permitted report matched after cleanup, including `.env.local`. No secret values were printed. No shared Supabase/cloud resources were queried or changed. No commit, push, merge or deployment was performed.

## I–K. Remaining blockers and next approval

**C11 FINANCIAL REHEARSAL: NOT READY.**

1. Authorize the concrete additive C11 RPC EXECUTE hardening above, then run local migration/real-JWT denial checks. This is the immediate next action; it is not authorized by this application/setup-only request.
2. Separately authorize obviously synthetic local sale-readiness fixtures and a local-only synthetic Terms version/activation plus genuine synthetic acceptance if those later rehearsal cases need them. Current products remain draft and Terms deliberately inactive.
3. Separately authorize the private in-memory Stripe TEST listener/signing-secret setup described above. No Dashboard change is needed.
4. Only after these prerequisites pass should Alea consider a distinct, explicit financial-rehearsal approval. No such approval is inferred from this report.

Evidence under `/tmp/holyhub-c11-isolated/`: `application-preflight-result.json`, `application-preflight-first-attempt.json`, `application-orchestration-result.json`, `application-firewall-before.json`, isolated app copy, sanitized harness console evidence and local app log. The non-secret fixture IDs above are mirrored in this report because prior `/tmp` harness artifacts did not survive the session change. Passwords/sessions/signing secrets were not stored for reuse; a later approved run can reauthenticate/reset only these local synthetic users in memory.

References checked: installed Next.js CLI documentation; [Supabase server-side clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Auth admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [Supabase changelog](https://supabase.com/changelog), and [Stripe webhook signatures](https://docs.stripe.com/events/manage-webhook-endpoints). No external documentation substitutes for the local evidence above.

---

## Earlier preflight reports (historical; superseded by the current findings above)

# C11 Vector/firewall and Kong diagnosis — verified 19 October 2026

**Local Supabase service/migration preflight: READY while the tested temporary exact-IP rules are active. Isolated financial rehearsal: NOT READY.** All temporary rules have been removed and all C11 services stopped after verification. This does not authorize a financial rehearsal or claim that isolated application/fixture setup is complete.

## Temporary rule and rollback

Vector `172.19.0.11` → Analytics `172.19.0.10` TCP 4000 was tested on C11 bridge `br-c11-local`, subnet `172.19.0.0/16`, using:

```bash
iptables-legacy -I FORWARD 1 -i br-c11-local -o br-c11-local -p tcp \
  -m conntrack --ctstate NEW,ESTABLISHED \
  --ctorigsrc 172.19.0.11 --ctorigdst 172.19.0.10 --ctorigdstport 4000 \
  -m comment --comment holyhub-c11-vector-kong-test -j ACCEPT
```

Alongside this rule, reused only the prior four exact Kong upstream pairs (Kong `.3` → Auth `.4`:9999, REST `.5`:3000/3001, Edge `.6`:8081), and seven exact service → database `.2`:5432 pairs (Auth `.4`, REST `.5`, Edge `.6`, Realtime `.7`, Storage `.8`, metadata `.9`, Analytics `.10`). All addresses begin `172.19.0`. No subnet-wide ACCEPT, other service port, policy change, public binding or persistent rule was introduced. Published ports remained loopback-bound through the existing C11 network default.

Each diagnostic pass inserted 12 exact-pair rules and removed all 12 in cleanup. Final legacy FORWARD rules match the saved prior rules exactly; no temporary comment/rule remains. All existing C11 containers were stopped without deletion. Source/project work, downloaded images, existing non-C11 resources and C11 database volumes were preserved. No persistent container/project configuration was changed.

## Vector — confirmed healthy

The previously identified generated wrapper waits for Analytics:4000 before launching Vector. The approved flow removed that startup block. Vector logged `Vector has started`, sink health checks passed, its API bound to port 9001, and localhost `/health` returned success. Consecutive Docker health checks exited 0 and Vector became **healthy**, with failing streak 0. Earlier unhealthy samples during the first pass were captured before the delayed Analytics/Vector startup finished; a bounded warmed-up second pass confirmed final health. No Vector configuration or extra port was needed.

## Kong — supported root cause and limits

After bounded warmup, ran six controlled rounds of five gateway GET probes, each with an **8-second** deadline: Auth health, REST products with `select=id&limit=0`, REST OpenAPI root, REST-admin readiness, and Edge internal health. **30/30 returned HTTP 200**, taking **0.008–5.304 seconds**. No rows/customer data were requested by the products probe, and API keys remained in memory.

The prior intermittent **4-second client timeouts** are explained by a recurring approximately **4-second Kong DNS-resolution/retry delay before upstream connection**. Evidence:

- Slow requests reported `X-Kong-Proxy-Latency` approximately 3991–4062 ms, while Auth/Edge/REST-admin upstream latency was generally milliseconds. Fast rounds had proxy latency approximately 0–12 ms.
- Network syscall metadata from the actual Kong worker showed UDP DNS exchanges/retries against Docker resolver `127.0.0.11:53` during the delay, followed by successful upstream TCP connects with socket error 0. DNS/HTTP payloads were not captured or printed.
- Direct IP and direct hostname HTTP probes from Kong to all four approved upstream endpoints returned 200, typically in milliseconds (REST OpenAPI generation took roughly 0.2 seconds after warmup).
- Container hostname lookups through `getent` succeeded in roughly 0.07–0.11 seconds. This does not contradict latency in Kong's own DNS-client path/cache.
- Kong stayed healthy; all container restart counters remained 0 and none was OOM-killed. Steady-state Kong CPU was approximately 0.02%, memory approximately 103 MiB. Upstreams and the database were healthy. Initial cold-start 502/503 responses coincided with upstream startup and disappeared after warmup.

This identifies the failing phase, not the exact reason Docker/Kong's DNS exchanges are delayed. Search-domain expansion, a particular resolver bug or a specific DNS configuration fix was **not proven**, and none is asserted as necessary. No additional service port or configuration change is demonstrated necessary for the tested readiness checks. The original 4-second deadline was shorter than observed successful requests; increasing the diagnostic deadline to 8 seconds was a probe setting only, not an application/configuration edit. The DNS delay remains a measured latency limitation to consider before a future integrated run.

## Service and migration readiness

During the warmed-up test, PostgreSQL, Realtime, Auth, Kong, Analytics, Vector, Storage, PostgreSQL metadata, Studio and mail service reported healthy. REST and Edge Runtime have no Docker health check configured; their direct and gateway HTTP readiness probes returned 200. Vector-to-Analytics health access and all four approved gateway TCP probes succeeded.

Read-only SQL reconfirmed the preserved full-Supabase replay: **34 migration records**, C11 version `20261019105706` named `c11_guarded_payments`, C11 payment table and transfer-reservation function present, **0 financial operations**, and recovery still disabled. No reset/replay over existing data or financial RPC/fixture was run in this diagnosis. The previous complete replay remains intact.

Final `/workspaces` free space: **5,799,755,776 bytes (approximately 5.40 GiB)**. Disk was monitored throughout both passes and never crossed the 2 GiB stop threshold. All 37 preservation fingerprints outside this permitted report match.

## Remaining approval boundary

Service/migration availability is now demonstrated under the temporary approved firewall flows. Those exceptions were removed as required, so the stopped stack is not currently serving requests. A future run must resolve current IPs and reapply only authorized temporary rules, then roll them back.

The isolated HolyHub app environment, synthetic Auth users/roles, genuine local JWT/REST/RPC permission checks, two-seller/product/dispatch/legal-readiness fixtures, genuine synthetic Terms acceptance and redacted ephemeral signed-event setup remain unprepared/unverified as recorded in the original plan. No Stripe change, payment, checkout, transfer, refund, reversal, debt/recovery rehearsal, shared-service write, source/migration/env edit, commit, push, merge, deployment or real Terms activation occurred.

**Exact next approval requested:** authorize completing that remaining isolated application/Auth/fixture/event-forwarding setup preflight only, with the same verified temporary exact-IP firewall flows and complete rollback. No financial rehearsal is included. Any proposed gateway DNS configuration repair would need its own concrete evidence and separate approval; no new port or persistent change is justified by these results.

Evidence artifacts: `/tmp/holyhub-c11-isolated/vector-kong-result.json`, `/tmp/holyhub-c11-isolated/vector-kong-before.json`, and `/tmp/holyhub-c11-isolated/kong-network-metadata.trace`. These are local diagnostic artifacts and contain no printed API credentials. Earlier reports below are retained as historical evidence and are superseded by the findings above.

---

## Earlier findings (historical)

# C11 focused Kong/Vector diagnosis — 19 October 2026

**STOPPED at an additional-port requirement; local Supabase and the isolated financial rehearsal remain NOT READY.** No containers were restarted and no temporary firewall rule was added during this focused diagnosis. No application source, migration, environment, credential, database or Docker resource was changed. Only this existing report was updated.

## Kong finding

The precise cause of intermittent gateway timeouts remains **unproven**. The prior exact-port test established successful direct TCP and HTTP 200 responses from Kong to Auth:9999, REST:3000, REST-admin:3001 and Edge Runtime:8081. Gateway Auth, REST product query with `limit=0`, REST readiness and Edge health also returned HTTP 200 at least once, while repeated root/health requests sometimes timed out. Kong's retained health-check commands exited 0 and reported nginx running. HTTP 499 access-log entries show client timeout/disconnection, not a unique diagnosis of DNS, upstream latency, conntrack or resource pressure. No new repeated-request/live comparison was run: the Vector inspection reached the user's explicit additional-port stop condition first. Do not label Kong's remaining behavior a proven additional firewall-port failure.

## Vector root cause

The generated container command explicitly runs an `until wget ... http://supabase_analytics_holyhub-c11-isolated:4000/health ...; do sleep 2; done` loop **before** `exec vector --config /etc/vector/vector.yaml`. This is a cross-container TCP 4000 dependency, outside the five authorized exact-flow categories. Legacy FORWARD defaults to DROP and has no C11 exception after the previous test's verified rollback.

Vector's generated config enables its own health API at `0.0.0.0:9001` inside the container. The retained Docker health check requests `http://127.0.0.1:9001/health`; its last five runs all failed with connection refused. Container logs are empty, consistent with the wrapper suppressing its waiting-loop wget output and not reaching Vector execution. The API port mismatch is **not** the problem: both config and health check use 9001. The startup wrapper is waiting for Analytics:4000, so Vector has not opened its own health listener.

The same generated config routes collected container logs to Analytics HTTP sinks on port 4000. The narrowly identified additional flow would therefore be **Vector → Analytics TCP 4000**, restricted to those two current C11 container IPs on `br-c11-local`; it would serve both startup health access and log delivery. No such rule was added, no broader rule was proposed as already authorized, and no Vector configuration was modified. Current containers are stopped, so exact active IPs must be resolved at any separately approved restart.

## Is Vector required for C11?

Vector is the container-log/observability pipeline, not a C11 payment execution, Auth, REST or database migration dependency. The earlier full 34-migration replay and internal backend/direct gateway tests passed while Vector was unhealthy. It is nevertheless part of the currently configured full Supabase stack, whose overall healthy-startup claim remains unmet. Excluding/altering observability or accepting degraded startup is a separate decision; neither was done here. This does not waive genuine financial audit/reconciliation evidence or make the financial rehearsal ready.

## State and next approval

Free `/workspaces` space at inspection: **5,796,896,768 bytes (approximately 5.40 GiB)**. Available RAM was approximately 4.3 GiB; that single observation does not establish the absence of transient pressure during earlier gateway failures. All 37 previously fingerprinted preserved files still match. Existing C11 containers remain stopped; project work, downloaded images and database volumes remain preserved. The current legacy FORWARD rules have no C11 exception.

Next requested approval: permit **only Vector → Analytics TCP 4000**, using exact current C11 container IPs and the C11 bridge, temporarily alongside the previously approved exact flows, then resume focused Kong latency/DNS/upstream diagnosis with complete rollback. Alternatively, separately approve an explicitly degraded preflight that excludes optional observability without changing persistent project configuration. No financial rehearsal, extra port or configuration repair is authorized by this report.

---

## Earlier preflight findings (historical; current status is above)

# C11 isolated integration preflight — resumed 19 October 2026

**NOT READY for the isolated financial rehearsal.** The former missing-Stripe-sellers blocker is resolved. The full local Supabase startup failed because Docker's filesystem ran out of space during image extraction. No financial rehearsal was started.

## A. Stripe readiness — READY

Read-only requests used the existing `sk_test_` key; the platform balance response independently returned `livemode=false`. Both specified accounts were retrieved successfully:

| Seller | Test account | charges_enabled | payouts_enabled | transfers | currently_due | past_due |
| --- | --- | --- | --- | --- | --- | --- |
| A | `acct_1USI80I2TWBygp4T` | true | true | active | [] | [] |
| B | `acct_1USI80I2TWmwDvlt` | true | true | active | [] | [] |

No Stripe write, payment, Checkout Session, transfer, refund, reversal, funding, listener startup, or webhook/dashboard configuration change occurred in this resumed preflight. No third seller was inspected. Transfer readiness is verified account state, not proof of the unrun financial flows.

## B. Local Supabase readiness — NOT READY

- Supabase CLI **2.121.0** is cached at `/home/codespace/.npm/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-linux-x64/bin/supabase`; no global `supabase` command or repo-local binary exists. CLI version/help discovery works with required filesystem permissions. The restricted sandbox alone fails because CLI telemetry attempts to write under the read-only home directory.
- Docker client/server **29.7.2-2** works with Docker socket access. Stripe CLI **1.50.11** is available. No host `psql` command was found; container-local `psql` works.
- Initially only `postgres:17` and `postgrest/postgrest:v13.0.7` images were cached. The existing `holyhub-db-check` and `holyhub-rest-check` containers were stopped. Their state/resources were preserved.
- Created a new, unlinked disposable project at `/tmp/holyhub-c11-isolated/stack`, project ID `holyhub-c11-isolated`. The repository still has no `supabase/config.toml`; none was added there. The temporary project has no cloud project reference, copied credentials, shared data or environment files. Seeding was disabled and Auth URLs point to local port 3100.
- Attempted the complete default stack with `supabase --workdir /tmp/holyhub-c11-isolated/stack start`, keeping output private in `/tmp/holyhub-c11-isolated/start.log`. This failed with `ImagePrepullError` and repeated **no space left on device** during extraction of Supabase PostgreSQL `17.11.0.004`, Studio, Storage and Edge Runtime images. It did not reach service startup or full-stack migration replay.
- Docker/root/workspace use a **32 GB** filesystem, which reached 100% full. `/tmp` is on a different filesystem with approximately **39 GB free**, so that free space did not solve Docker image extraction.
- The failed startup process exited. Removed only the eight successfully downloaded image tags introduced by this attempt (Supabase realtime, logflare, postgres-meta, mailpit, gotrue, vector, postgrest v16.4 and kong). No broad prune, existing resource deletion or Docker storage reconfiguration was performed. After this targeted cleanup, the workspace filesystem showed approximately **4.9 GB free**. Final image inventory again contains only the two pre-existing images; final container inventory contains only the two pre-existing stopped containers. This does not establish sufficient space for a retry or guarantee that all failed-pull intermediate content has been reclaimed.
- Final local checks of `http://127.0.0.1:54321/auth/v1/health` and `/rest/v1/` both returned **connection refused**. No full local database/Auth/API stack is available. Real Auth/JWT/PostgREST/RPC integration remains unverified.

## C. Migration/environment readiness — PARTIAL

Source baseline remains branch `alea/stage4-payments`, HEAD `ecebccbab4f69c3d75099b92263843e2f94bfd1a`. All **34** migration files are available and copied byte-for-byte into the disposable project's migration directory. Historical tracked migration files have no working diff. C11 SHA-256 remains `aa275fea4b4b908f4e335e17719b4c8b224e46c9f55838eeb697b54b5577e986`.

A separate **migration-only** replay completed successfully in the new disposable container `holyhub-c11-preflight-replay-20261019`, using cached `postgres:17`, Docker network `none`, no published ports, no shared data/mount, and tmpfs database storage. It reused the existing C11 test's minimal auth/storage bootstrap, then ran every migration in filename order with `ON_ERROR_STOP=1` and a transaction per file. It did **not** run the C11 database test suite or its financial fixtures/scenarios.

All **34 migrations passed**, including `20261019105706_c11_guarded_payments.sql`. Read-only post-replay checks confirmed:

- `public.payment_operations` and `public.reserve_seller_transfer(uuid)` exist.
- `payment_operations` contains **0 rows**.
- Future recovery remains disabled (`payment_policy.recovery_terms_version IS NULL`).
- RLS is enabled on the checked payment operations, seller debts and seller allocations tables.
- `anon` and `authenticated` lack SELECT on payment operations; `service_role` has SELECT.

The replay container was removed after these checks. Results remain at `/tmp/holyhub-c11-isolated/replay-result.json`; the local replay helper is `/tmp/holyhub-c11-isolated/replay.py`. These are disposable preflight artifacts, not repository implementation changes. This proves current SQL replay on PostgreSQL with minimal shims, **not** replay against the real Supabase-managed auth/storage baseline, real JWT/RLS behavior through REST, or financial integration correctness. Previous source-to-stage provenance findings are retained in the archived report; no shared-stage inspection was repeated and no remote migration command was run.

The current checkout's Supabase and site URLs are non-local. Their values/keys were not printed or changed and must not be used for the rehearsal. A future isolated app must copy the current uncommitted source without `.env*`, `.git`, `.next`, credentials or shared data, and inject all local Supabase/app values explicitly. Only the verified Stripe test key may be used remotely. No isolated app copy or child-process environment was created in this resumed preflight.

An isolated two-seller run is feasible in design without shared stage/production or cloud Supabase: local Auth/database/API, local app, synthetic fixtures, the two verified Stripe test accounts, and controlled ephemeral signed event forwarding. That design is **not operationally verified**. The existing `dev:stripe` helper remains unsuitable unchanged: fixed port/current env loading, incomplete event coverage and a path that writes `.env.local`. It was not run or changed.

## D. Remaining blockers

1. **Immediate:** sufficient Docker-backed disk capacity for the full Supabase image set and working data. Full-stack startup failed; do not repeat the same download without capacity remediation.
2. After capacity is resolved: replay the exact 34 migrations on the real local Supabase baseline and verify local DB/Auth/API health plus REST/RPC permissions with actual local JWTs.
3. Prepare/validate the isolated app environment, synthetic buyer/admin/two sellers, seller mappings and product/dispatch/legal-readiness fixtures, and genuine local synthetic Terms acceptance. No users, products, acceptance evidence or financial fixtures were created in this preflight; real Terms remain inactive.
4. Prepare secret-redacted, ephemeral test-only forwarding and matching app signing secret without changing Dashboard endpoints. This was not started. Provider balance/refusal conditions and integrated financial behavior remain untested, and must remain outside preflight.

## E. Isolated C11 financial rehearsal — NOT READY

Stripe prerequisites pass. Full local Supabase and the integrated isolated environment do not. No checkout/payment/transfer/refund/reversal/debt/recovery rehearsal is authorized or has begun. A successful minimal PostgreSQL replay is insufficient to open that gate.

## F. Exact next action requiring Alea approval

**Approve increasing the Codespace/Docker-backed disk capacity (with any resource/cost change explicitly agreed), then repeat the full-local-Supabase preflight only.** Alternatively, Alea can explicitly authorize a reviewed list of existing Docker/cache resources for cleanup; no such existing resource deletion is authorized or proposed blindly here. Do not create cloud Supabase resources or modify Docker's data root as an implicit workaround. Once the local stack and remaining isolated setup checks pass, obtain separate approval for the exact financial rehearsal; today's approval does not cover it.

Only this existing integration-preflight report was edited in the repository. Existing local/uncommitted work is preserved. No shared stage/production Supabase connection or change, source implementation edit, commit, push, merge, deploy, real Terms activation, or real seller/customer data use occurred.

References checked: [Supabase local CLI setup](https://supabase.com/docs/guides/local-development/cli/getting-started), [Supabase changelog](https://supabase.com/changelog), and installed CLI help. Local-only `init`/`start` does not require linking a hosted project; the CLI's actual downloaded image versions and failure above are authoritative for this attempt.

---

## Archived initial preflight (superseded by the resumed findings above)

The original report below is retained for provenance and the detailed future test plan. Its zero-seller stop and unattempted startup statements describe the earlier run, not the current state.

# C11 isolated integration preflight — 19 October 2026

**STOPPED: the verified Stripe test platform currently has zero connected accounts.** The request explicitly requires stopping if two suitable test seller accounts do not already exist. No payment/refund/transfer/reversal rehearsal, local stack startup, seed execution, cloud resource creation, or shared-service mutation was performed.

1. **Checkout and preservation.** Branch `alea/stage4-payments`; HEAD and origin tracking reference both `ecebccbab4f69c3d75099b92263843e2f94bfd1a`. Existing modified/untracked C11 and unrelated work remains present. No application, migration, environment, credential, or historical report file was edited in this turn.

2. **Full local Supabase availability.** Docker works and Supabase CLI `2.121.0` is available through `npx`; Stripe CLI `1.50.11` is installed. Only PostgreSQL 17 and PostgREST images are cached; their old containers are stopped. No full local Supabase Auth/Kong/PostgREST stack is running, and this repository has no `supabase/config.toml`. Full-stack viability is **not yet established**, and no new replay or Auth/JWT/RLS integration is claimed. The account stop condition was reached before initializing it.

3. **Proposed isolation.** A new, clearly named local Supabase CLI project under `/tmp/holyhub-c11-isolated/stack`, plus an isolated app source copy under `/tmp/holyhub-c11-isolated/app` containing the current uncommitted C11 changes. Copy no `.env*`, credentials, `.git`, shared database dumps, or `.next` build output. Use real local Supabase Auth/JWT, API gateway, PostgREST/RPC and RLS, with synthetic users and a local mail inbox. Use an app port such as 3100 and local API port 54321, after verifying availability. Override every Supabase/app/payment environment value in the child process; never fall back to the current checkout's `.env.local`. Stripe test mode is the only remote dependency proposed. No cloud Supabase project or branch is needed in this design, but the local stack still needs to be provisioned and verified.

4. **Migration source/provenance.** No tracked historical migration differs from HEAD. The source baseline is the same updated commit for which the earlier nine-file applied-history mapping was resolved. All 34 local migration files remain present, including uncommitted C11. No local evidence of the former missing-source blocker reappeared. This turn did not repeat remote Supabase provenance queries or the previous replay: setup stopped at the explicit missing-accounts gate. The exact proposed local migration list is below. Do not use it to push/replay old numeric versions into shared stage.

   Current source fingerprints:
   - C11 migration SHA-256: `aa275fea4b4b908f4e335e17719b4c8b224e46c9f55838eeb697b54b5577e986`
   - `lib/payment-operations.ts` SHA-256: `60a8c77d26f7ced00f5f6f3ce54576fd759a8ec17eb396afa5baf99531204d3f`

5. **Synthetic fixtures required, not created.** Use an isolated namespace such as `C11-ISOLATED-20261019`, generated local Auth UUIDs, and `example.invalid` email addresses. Passwords and signing keys must be generated privately, never put in a seed/report or printed. Create users through real local Auth; assign app roles in the local database only. Seller A/B must each have verified synthetic legal profiles and valid dispatch settings. A real local sign-in must call the C9 acceptance RPC for each test seller; never insert fabricated acceptance evidence. A clearly labelled synthetic active Terms version/hash and recovery designation may exist only inside this disposable local database; real launch Terms remain inactive.

| Fixture | Exact planned data/purpose |
| --- | --- |
| Admin | `c11-admin@example.invalid`; customer + admin app roles |
| Buyer | `c11-buyer@example.invalid`; customer role |
| Seller A | `c11-seller-a@example.invalid`; customer + lister roles; synthetic UK sole-trader identity, dispatch 1–2 working days |
| Seller B | `c11-seller-b@example.invalid`; customer + lister roles; separate synthetic identity, dispatch 3–5 working days |
| Seller mappings | Two distinct existing Stripe TEST account references, each verified for the correct synthetic seller and active transfers capability; not currently available |
| Recovery Terms | Local-only version `C11-SYNTHETIC-NOT-FOR-LAUNCH-v1`, immutable synthetic content/hash and genuine local test-seller acceptance; no shared activation |
| A product | Synthetic book, £10 per unit, stock 20, approved/published after readiness gates |
| B product | Synthetic apparel, £15 per unit; M stock 20, L stock 10; aggregate stock 30 |
| Delivery | A £2 once per portion, B £5 once per portion |
| Basket | Two A books + three B M shirts: products £65, delivery £7, one £72 payment; commission A £1, B £2.25 |
| Independent completion | A/B portions of one order, processed separately through dispatch and delivered |
| Pre-transfer refund | Fresh order; A £10 product refund; B unchanged; expected A product commission credit £0.50 |
| Delivery-only refund | Separate order/case; A £1 delivery refund, no commission credit |
| Post-transfer refund | Fresh completed/transferred A portion; £10 product refund, associated reversal/recovery |
| Faulty/damaged return | Fresh case; restore quantity 0 |
| Sellable return | Fresh case; one verified sellable unit restored once; repeat same case reference |
| Apparel | One M unit refund/restoration; L unchanged; aggregate updates once |
| Insufficient reversal/debt | Separate case with maintainer-controlled TEST seller liquidity/refusal; customer refund funded by platform test balance |
| Future recovery | Later A sale after genuine synthetic acceptance; B's proceeds untouched; cap and duplicate checks |
| Exit | A synthetic debtor with no future sales; approved local exit simulation; debt remains |

Keep cases on separate fresh orders where refund limits/lifecycle would interfere. No orders, Checkout Sessions, payments, refunds, transfers, reversals or test liquidity changes were created during this preflight.

6. **Stripe test readiness.** `STRIPE_SECRET_KEY` is present and has the test-secret prefix. A read-only Stripe balance request independently returned `livemode=false`. A read-only connected-account list succeeded and returned zero accounts. The key was passed only in memory to HTTPS authorization headers, never printed or supplied on command arguments. Checkout creation, test funding, transfer capability, signatures and actual financial behavior were not exercised. No platform personal profile, customer/order records, CLI credential contents or secret values were printed.

7. **Two usable accounts?** **No: zero accounts returned by this platform's TEST account listing.** This is the explicit stop blocker. No account was created or modified, and no live-mode request was made.

8. **Required environment names.** App: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. CLI: `STRIPE_API_KEY`, explicitly set from the same verified test key rather than relying on a saved CLI profile. Optional local recovery-cookie signing: `AUTH_RECOVERY_SECRET` (otherwise the local service-role key is used). Disable optional `GOOGLE_PLACES_API_KEY` for this synthetic rehearsal. Suggested isolated in-memory input names: `C11_LOCAL_SUPABASE_URL`, `C11_LOCAL_PUBLISHABLE_KEY`, `C11_LOCAL_SERVICE_ROLE_KEY`, `C11_STRIPE_TEST_SECRET_KEY`, `C11_CLI_WEBHOOK_SECRET`.

   The current Supabase URL and site URL are non-local; the current publishable/service-role and webhook settings are present. Their values were not displayed or changed. They must not be reused as the rehearsal's local Supabase settings. No separate worker secret is required: processing uses authenticated admin actions and the server-only local Supabase client.

9. **Start commands — proposed only, not run or ready.** First prepare and verify the isolated configuration/source copy and memory-only environment injection. Those artifacts were not created because of the stop condition. From the future prepared stack:

   ```bash
   npx --yes supabase --workdir /tmp/holyhub-c11-isolated/stack start
   ```

   App command, only inside the future isolated copy and after all required environment variables are explicitly populated with local/test values:

   ```bash
   cd /tmp/holyhub-c11-isolated/app && npm run dev -- --hostname 127.0.0.1 --port 3100
   ```

   Ephemeral TEST forwarding command core (same test key via `STRIPE_API_KEY`; never `--live` or `--use-configured-webhooks`):

   ```bash
   stripe listen --skip-update --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,charge.succeeded,charge.updated,refund.created,refund.updated,refund.failed,transfer.created,transfer.updated,transfer.reversed --forward-to http://127.0.0.1:3100/api/stripe/webhook
   ```

   **Do not execute the listener core directly in a captured terminal:** Stripe prints its signing secret. The next setup must wrap it with line-buffered secret redaction, capture the matching listener signing secret privately into `STRIPE_WEBHOOK_SECRET`, and start the app with that value in its environment. This guarded launcher was not created or started this turn. The commands above describe component startup, not a tested launcher or an approved rehearsal.

   Do not use the existing `npm run dev:stripe` helper unchanged: it forwards only Checkout events, fixes port 3000, and loads the checkout's existing environment. Its `--listen-only` path also writes `.env.local`. It does not provide the required C11 isolation/event coverage. This is a setup-harness limitation, not evidence of a C11 financial-logic defect; it was not changed.

10. **Files added/changed.** Only this new report: `docs/c11-integration-preflight-2026-10-19.md`. No application/config/harness/seed/migration/env file was changed. Existing local work is preserved.

11. **Shortest manual action for Alea.** Ask the Stripe administrator to create **two clearly labelled synthetic UK connected accounts in this same Stripe TEST environment**, complete their test onboarding using Stripe's synthetic test details, and confirm each account has `capabilities.transfers = active`. Keep live mode and real accounts untouched. Provide their two `acct_…` references and confirm they are test sellers; do not paste any keys, bank details, passwords or signing secrets. If Connect is not enabled, report that separately before changing platform settings. No persistent webhook Dashboard change is needed for the proposed CLI listener.

12. **Blockers.** Missing two usable test connected accounts is the immediate hard stop. Full-stack local Auth/PostgREST/RLS availability, safe isolated app environment injection, secret-redacted all-event forwarding, synthetic seeding and hosted-style role verification remain unprepared/unverified. No cloud fallback, architectural fix or shared-stage action was attempted.

13. **Next sequence.** After the two accounts exist, resume setup only: revalidate branch/status/fingerprints; preserve the workspace; initialize the isolated CLI project and source copy; replay the 34-file baseline locally; verify real Auth/JWT/PostgREST/RPC/RLS with synthetic users; prepare genuine synthetic Terms acceptance, legal/dispatch/product fixtures and account mapping; validate a test-only, redacted ephemeral listener and matching app environment; return the completed setup for Alea's separate approval. **Only after that approval** run single-payment multi-seller checkout, independent delivery transfers, pre/post-transfer refunds, refusal/debt/future recovery, stock, retry and exit scenarios from the C11 founder checklist.

14. **Future Stripe TEST mutations.** Creating/onboarding test connected accounts or changing test liquidity/settings would mutate Stripe TEST resources and was not done. The later approved rehearsal's Checkout Session creation/expiry, customer payments/refunds, seller transfers and transfer reversals also mutate Stripe TEST data. Local seed/auth/acceptance changes would mutate only the disposable local stack. CLI forwarding is ephemeral and need not create a persistent Dashboard endpoint; it still requires controlled setup and must not start a financial rehearsal accidentally.

15. **Shared stage/production.** Untouched. No Supabase connection/query/mutation was made in this turn; the only remote service checks were Stripe TEST read-only balance/account listing and tool update/help discovery. No commits, pushes, merges, deployment, launch Terms activation or real acceptance occurred. Stop remains in effect pending the account prerequisite and a resumed setup; financial rehearsal still requires separate approval.

## Exact proposed local migration sequence

Repository filename order, on a brand-new full local Supabase baseline only. The prior implementation report also records the stage timestamp mapping and the separately tested equivalent stage-order replay. No sequence was executed during this setup turn.

```text
001_stage1_foundation.sql
002_lister_applications.sql
003_stage3_marketplace.sql
004_stage4_checkout.sql
005_stage5_shipping_orders.sql
006_stage6_favourites.sql
007_lister_review_workflow.sql
008_product_review_workflow.sql
009_product_review_status_guard.sql
010_product_images_storage.sql
011_reconcile_product_images_bucket.sql
012_lister_storefront_branding.sql
013_church_profiles.sql
014_product_review_actor_guard.sql
015_checkout_seller_delivery_and_moderation_grants.sql
016_apparel_product_variants.sql
017_product_review_edit_snapshots.sql
018_carrier_neutral_fulfilment.sql
019_order_delivery_address.sql
020_bulk_product_csv.sql
021_product_gallery.sql
022_anonymous_product_variant_reads.sql
023_webhook_order_integrity.sql
024_bulk_product_images.sql
025_stripe_fee_payout_breakdown.sql
026_seller_legal_identity.sql
20261009151400_lister_approval_role_permissions.sql
20261017200000_c6_durable_order_confirmation.sql
20261017200500_c6_dispatch_visibility_gate.sql
20261017201000_c6_notification_worker_primitives.sql
20261017204000_c9_lister_terms_acceptance_gate.sql
20261018010000_audit_readiness_hardening.sql
20261018090000_flexible_dispatch_working_days.sql
20261019105706_c11_guarded_payments.sql
```
