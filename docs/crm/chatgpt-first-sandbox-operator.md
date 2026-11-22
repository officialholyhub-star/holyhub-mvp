# N18 — ChatGPT-first Direct Neon CRM: verified synthetic operation and activation gates
**Date:** 22 November 2026 (UK). **Active human:** Anais. **Authority:** A-224 synthetic-only 2B. **Source of truth:** Live N18 Design Brief/Task Book. **Status:** Sandbox direct ChatGPT read + reversible audited SQL writes validated; actual human-bound permanent writes and real-data activation NOT approved or tested.

## Operating architecture (corrected to original N18 design)
- **ChatGPT in HOLYHUB MVP is the human cockpit.** Neon Postgres holds durable CRM records. Gmail/Tally/Task Book remain their own evidence/operations systems until approved integration work.
- **The optional Netlify CRM browser UI is NOT a prerequisite** for ChatGPT-to-Neon connector access. No site, subscription, Supabase web login or Netlify Pro is needed for today's sandbox connector checks. Earlier conditional A-225/A-226 Netlify approvals are preserved, but dormant for this direct-connector path.
- The existing `anais/n18-crm-sandbox` branch, schema, migration tracker, restricted runtime roles and pre-metadata recovery branch remain unchanged by this checkpoint. Do not rebuild A-146, 2A or 2B.

## Direct connector checks executed
**Connection:** Neon project `flat-band-06724960`; default sandbox branch `br-floral-wave-za3jo7o0`, database `holyhub_crm`.
1. `hh_crm_readonly_runtime` checked `system_environment=sandbox`, two fictional organisations, two fictional contacts, two open fictional actions, one active fictional safety control. Restricted role can read; it cannot access `drizzle` migration-tracking schema.
2. **First fictional write probe:** As `hh_crm_api_runtime`, a transaction inserted a fictional organisation `Example ChatGPT N18 Direct Probe 20261122` under a savepoint, observed one provisional row, rolled back to savepoint, and observed zero rows. Independent separate read-only query confirmed zero persisted.
3. **Second audited fictional write probe:** `hh_crm_api_runtime` transaction:
   - inserted fictional organisation `Example ChatGPT Audited Probe 20261122`;
   - explicitly inserted one linked `crm_audit.activity` row with `source_system='chatgpt_sandbox'`, `activity_type='synthetic_test'`, `payload.fictional=true` and the **existing synthetic Sandbox Operator** actor `00000000-0000-7000-8000-000000000002`;
   - confirmed one provisional organisation **and** one linked audit row;
   - rolled back the savepoint; confirmed **zero** probe organisations and **zero** probe audit rows.
   - This verifies transactional co-writing of data + audit, **not** actual attribution to Anais.
4. Inspection: `crm.organisations` has **no automatic database trigger** to force an audit insert; `crm_audit.activity.actor_internal_user_id` allows null; no `auth_provider='supabase'` real staff identities are bound. The restricted API database role does **not** authenticate a specific ChatGPT human.
5. The installed Neon connector exposes general SQL execution and a role selector. Choosing `hh_crm_readonly_runtime` or `hh_crm_api_runtime` in an invocation is an *operating discipline*, **not evidence of user-level access control**. Individual actor authentication and a narrow mutation boundary are still missing.
6. Neon member listing returned one project member with admin-level role; no independently verified Anais-specific project principal was established. Do not infer connector identity or speaker identity from that membership.

## Current ChatGPT operating rule for this checkpoint
**Permitted immediately:** Restricted **read-only, synthetic-only** CRM queries and targeted nonpersistent tests under A-224; synthesize daily tasks from fictional records while labelling them test data. Re-read exact live governing scope and the current default branch before material operations.

**For all test mutations:** explicit fictional input only; verify `sandbox` DB marker and correct branch; identify `Active human: Anais` in conversation; narrowly list affected table/row; use a single transaction/savepoint, insert matching `crm_audit.activity` with a **synthetic** actor where appropriate, verify provisional row + audit, roll back, re-read zero persistence; never use the owner/admin role, bypass a safety hold or invoke a mail integration. If an operation or audit verification fails, stop; do not assume success.

**Not permitted:** Permanent writes with actual HolyHub people/businesses, importing Gmail/Tally/HubSpot, creating a real staff mapping, external sends, cutover, modifying production, silently opting into new hosting, or claiming the synthetic audit test establishes Anais identity.

## Real person-bound ChatGPT write prerequisite (technical)
Before permanent identifiable CRM records or even *real* staff identity binding, establish and verify:
1. **Individually authenticated principal:** an independently verified Anais-specific session/connected identity or another constrained authenticated gateway; `Active human: Anais` is a conversation-routing assertion, **not a database identity proof**.
2. **Non-bypassable least privilege:** CRM operations must pass a validated allowlist/bounded command contract that cannot be circumvented with unrestricted connector SQL under a project-level/admin credential. Test denied mutating requests, row scoping, restricted Config access and safety clearance separation.
3. **Mandatory audit:** each durable create/update/hold/clear/merge/delete must generate an attributable immutable audit event *in the same transaction*, with actor, operation ID, source, entity, reason/evidence and resulting state; fail closed if an actor or audit entry is missing. Do not equate a nullable audit actor or a manually typed name with proven identity.
4. **Safety concurrency:** N19 two-human controlled parallel-chat test (active-human lock, explicit handover, stale-read/re-read-before-write and conflict handling). Only Alea/Anais themselves can provide independent two-chat evidence. A-226 proves a founder approval was recorded; it is not a witnessed concurrent mutation test.
5. **C13 CRM staff-access review:** individual account access, MFA/session handling, recovery and revocation, minimum staff identity fields, access logging/retention, incident response, and connector-account ownership. A general marketplace C13 check is not automatically a pass for this Direct Neon ChatGPT operator path.
6. **Real-data processing gate:** separately approve exact source, data minimisation, lawful/privacy basis, retention, suppression/failed-route checks, deduplication, migration mapping, rollback, HubSpot read-only shadow reconciliation and operator QA; **HubSpot remains canonical** until explicit GATE-007.

**Architecture choice for the gate:** A human-specific, narrowly permissioned connector/gateway or equivalent verifiable mechanism is needed for *durable* person-bound writes. The existing broad Neon connector is adequate for supervised sandbox tests and read-only checks but not proof of per-human durable write authority. The gateway design must be proposed and independently authorised before implementation; do not assume a free hosting provider is required or sufficient.

## N19 and C13 current status
- N19 remains **In progress**; chat has explicitly locked `Anais`, but full *two-human parallel* demonstration is outstanding.
- C13 remains **In progress** (Alea-owned). Relevant CRM staff-specific safeguards have not been independently documented as cleared.
- The original Monday 23 November target is a scheduling aim, not an override of authorisation or lawful real-data gates.

## Ready-to-use ChatGPT prompts (safe synthetic read)
- “In N18, active human Anais: show the **fictional** outstanding CRM actions in Neon sandbox and their due dates. Read-only.”
- “In N18, active human Anais: show the current **fictional** organisations, their stages and safety hold counts; do not write.”
- “In N18, active human Anais: prepare a proposed update and associated audit plan for a **fictional** record, but do not commit it.”

## Acceptance evidence and backout
- Tests left no net new CRM/audit rows and changed no schema or credentials.
- Retain pre-metadata recovery branch `br-weathered-forest-zafk3uti` untouched. No branch restore/finalization/deletion is needed.
- Decision trace: N18 design A-224, Anais secret destination A-225, Alea conditional browser option A-226 (both still preserved), Task Book All Tasks N18. This checkpoint is an *executed synthetic test*, not a new real-data approval or claim of overall N18 completion.
