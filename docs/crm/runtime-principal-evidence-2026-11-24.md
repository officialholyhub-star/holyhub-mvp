# N18 — Fail-closed database login principal (24 November 2026)

**Active human:** Anais. **Authority:** A-224 only, code/tests in isolated synthetic CRM branch. **No database grants, staff mapping, secrets or deployment.**

## Read-only evidence (Neon sandbox)

Using the *same installed ChatGPT Neon connector*, different SQL `role_name` selections returned three different `current_user=session_user` roles:

| Selected role | CRM organisations INSERT | CRM audit activity INSERT |
|---|---:|---:|
| `hh_crm_readonly_runtime` | denied | denied |
| `hh_crm_api_runtime` | permitted | permitted |
| `hh_crm_migrator_runtime` | denied | denied |

Omitting the `role_name` parameter used `holyhub_crm_owner`, which had INSERT on CRM organisations, INSERT on internal users and CREATE on the CRM schema. Therefore, **this installed connector is still administrative and can switch between roles**, even though a single read-only query may be safe. It cannot be treated as a per-human fixed principal; a claimed chat speaker/selected role is not server-verified personal identity.

Current project membership: one Neon project admin. `crm_config.internal_users` has zero real `auth_provider='supabase'` bindings. Existing SQL functions in `crm`, `crm_audit` and `crm_config` (catalogue check): none. A stored-procedure-only / EXECUTE role pathway is **not currently provisioned**. No role/grant/function was created or altered during this review.

Neon documents a *new and separately authorised fixed-consent OAuth connection* using URL options `readonly=true`, `projectId`, `category=querying`, `roleName`, `secrets=none`. Such a distinct connection could enforce synthetic read-only scope; it does **not** automatically prove the human or permit safe audited writes, and **was not installed**. Reference: https://github.com/neondatabase/mcp-server-neon .

## N18 code-only improvement

The N18 server-side CRM database client now reads the configured database environment marker and Postgres `current_user` and `session_user` together. On sandbox it accepts **only** `hh_crm_api_runtime` as both values, rejecting the owner, migrator, read-only and impersonated roles. Production fails closed since there is no approved production CRM principal. Tests cover denial paths. This protects the dormant N18 application boundary from a mistakenly provisioned owner connection **but does not restrict the independent general Neon connector**.

## Safe next steps and holds

- Continue synthetic-only ChatGPT dashboard reads with explicit restricted role. Do not use general Neon connector for durable real-record updates.
- A safe **future** ChatGPT→CRM write path needs operator-verified OAuth or equivalent, a locked per-human server identity, bounded operation allowlist, atomic field/activity audit, database grants that deny arbitrary DML/owner bypass, revocation and logs. N19 conflict/handover and C13 staff privacy/MFA/recovery must pass.
- No custom connector deployment, new OAuth connection, Neon role/function/grant migration, real-data import or paid subscription was authorised. A-225/A-226 remain conditional/dormant, with no website changes. HubSpot remains canonical until GATE-007.
- Current OpenAI help says full custom MCP write support is available to Business and Enterprise/Edu, while Pro custom MCP is read/fetch. Do not assume entitlement. Reference: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt .
