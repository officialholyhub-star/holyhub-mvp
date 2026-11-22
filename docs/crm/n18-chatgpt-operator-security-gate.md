# N18 — ChatGPT-first CRM security gate (22 November 2026)
**Active human:** Anais. **Authority:** A-224, synthetic-only N18 2B test/fix scope. **Status:** Tested limitations; secure permanent real-data writes remain HELD. This is an evidence/runbook document, not approval for a production access change or staff account binding.

## Current accepted workflow

Human (Anais) → **HOLYHUB MVP ChatGPT** → **Neon CRM**. The ChatGPT workspace is the operator cockpit; the Postgres database is the durable source of relationship state. Optional separate Netlify web console remains dormant; A-225/A-226 are preserved and are not necessary for direct synthetic connector testing. No new subscription, Neon project, domain, GitHub account or marketplace login was created.

### What was tested against the existing Neon sandbox

Project `flat-band-06724960`, branch `br-floral-wave-za3jo7o0`, DB `holyhub_crm`; test as runtime role, not database owner.

| Test | Observed evidence | Result |
|---|---|---|
| Database environment | `system_environment=sandbox` | PASS |
| Readonly login | `current_user=hh_crm_readonly_runtime`, has no INSERT on organisations or audit | PASS |
| API runtime login | `current_user=hh_crm_api_runtime`, can INSERT org and audit but not UPDATE protected Config or CREATE database schema | PASS |
| Readonly prohibited INSERT | `INSERT INTO crm.organisations ...` denied SQLSTATE **42501** | PASS |
| API protected-Config UPDATE | `UPDATE crm_config.system_settings ...` denied SQLSTATE **42501** | PASS |
| Migrator CRM SELECT | denied SQLSTATE **42501** | PASS |
| Provisional fictional business + audit | 1 fictional org plus 1 audit row (synthetic Sandbox Operator actor) inserted in transaction; both rolled back; independent readback 0 | PASS (synthetic transaction only) |
| Audit guaranteed on any direct insert? | inserted fictional organisation inside savepoint, then observed 0 automatic audit rows; rollback 0 | **FAIL: not enforced** |
| Is audit actor authenticated against connection principal? | inserted audit naming existing synthetic Sandbox Admin using general SQL role, with no authenticated matching actor; rollback 0 | **FAIL: not enforced** |
| Staff identities bound | 0 rows `auth_provider='supabase'`; existing 2 synthetic fixture roles | NOT YET |
| Existing contact safety | 1 active fictional safety control remained unchanged | PASS |

**No lasting sandbox test data, audit rows, staff bindings, schema, credentials or live outreach changes.** Retain recovery branch `br-weathered-forest-zafk3uti` untouched.

### Precise blocker: connector identity vs database actor

A verified **chat Active human: Anais** is a HolyHub routing rule, **not a cryptographically authenticated Neon session principal**. A general SQL tool may connect as a shared owner or selected SQL runtime role. `crm_audit.activity.actor_internal_user_id` is nullable and a manual actor ID can be asserted without verification, while CRM organisations have no mandatory audit trigger. Therefore **manual "always write an audit" procedures alone are not a security control**. Any persistent real CRM operations through this broad path are held; HubSpot remains canonical until GATE-007.

## No-additional-subscription configuration to evaluate (not implemented)

Neon's current official MCP server documents project-pinning and a fixed SQL login role:
`https://mcp.neon.tech/mcp?readonly=true&projectId=flat-band-06724960&category=querying&roleName=hh_crm_readonly_runtime&secrets=none`

This is a **proposed** project-scoped *synthetic read-only* connection: OAuth/account and consent must be verified by its owner. A pinned SQL role cannot be overridden with the tool's `role_name` argument, and a role that cannot log in fails rather than escalating, per the official Neon MCP documentation. It does not, by itself, authorise reads of actual people, verify that the currently installed HolyHub connector is pinned, or solve durable write attribution.

For real individual **write** access, review a separate narrowly scoped, identity-authenticating CRM connector/gateway or equivalent database-role + signed-session mechanism, where the **server** verifies a unique operator, enforces a bounded allowlist, prevents raw SQL bypass, and atomically writes immutable actor audit + operation ID + evidence + entity change. Require request-specific human approval and re-read before consequential writes. Evaluate secure authentication, revocation and least privilege before design approval or deployment. **Do not** rely on a manually supplied `actor_internal_user_id` or on an unrestricted Neon management connection.

Neon itself cautions against exposing its general management MCP server to production data. Treat its current direct connector as a *sandbox testing/diagnostics* surface, not the finished live CRM. Sources:
- Neon official MCP configuration: https://github.com/neondatabase/mcp-server-neon
- Neon official MCP safety guidance: https://neon.com/blog/mcp-safety-cheatsheet
- Neon per-project permissions, August 2026: https://neon.com/blog/neon-now-has-per-project-permissions

## N19: controlled real two-human concurrency test (still required)

**Must be genuinely performed in separate independently operated Alea/Anais chats; this document is not evidence of its completion.** Do not invent a second human/approve on Alea's behalf. Do not touch real CRM records. Suggested brief sequence:

1. Anais N19 chat: self-identify `Active human: Anais`, read live Project Brief A-069 and Task Book N19. Note the current full N19 row, and request a **read-only** pre-change checkpoint.
2. Alea's *own* N19 chat: self-identify `Active human: Alea`, read the same live N19 row, explicitly verify it does **not** become Anais despite sharing the HolyHub project's resources; independently append one harmless, clearly named **Alea-test-only marker** to N19's existing Notes cell **only on her own explicit write instruction**, preserving the complete previous text and verifying the result. No other cells or tasks.
3. Anais N19 chat: re-read the current N19 cell after Alea's marker; detect that it differs from Anais's earlier version. Do not use a stale replacement. Append one clearly named **Anais-test-only marker** on Anais's explicit instruction, preserving Alea's marker and original content; read back both.
4. In each chat, test that switching to the other Active human **requires an explicit handover**, and decline attempts to infer speaker from the connected account. Log exact source, date, who instructed each action, read-back evidence and any concurrent-write conflict to N19. If any stage fails, N19 stays in progress; do not fake a pass.

The test verifies *chat/canonical-concurrency discipline*, not database authentication or complete C13 staff security.

## C13: minimum Direct Neon operator-specific staff checks

These are relevant narrow controls, separate from C13's broader storefront/Children's Code work:
- Confirm who owns the connected Neon credential and whether the human operator is independently authenticated; avoid shared admin/team owner credentials for durable writes.
- Require MFA/strong session, access revocation and recovery procedure for the person actually accessing CRM records; minimise exposed contact data.
- Define who can approve/perform saves, edits, safety-hold clearances, exports, deletes, imports; segregate admin from operators and read-only.
- Verify direct SQL cannot bypass safety and audit in the selected production-facing connection. Record durable audit actor/operation/reason/source/time and protect against editing the audit trail.
- Verify retention, backup/recovery, privacy notice/controller decisions and lawful processing of identifiable contact data, including consent, objections and failed routes.
- No real staff identity binding until the relevant N19 and C13 checks are documented and met; no real contacts until separately approved data-processing/shadow phase. C13 overall task need not be closed to sign off its CRM-specific criteria.

## Immediate operator capabilities / next release gate

- **Now, already verified:** ChatGPT can inspect the *synthetic* Neon sandbox with `hh_crm_readonly_runtime` and perform reversible synthetic transactions with `hh_crm_api_runtime` under explicit A-224 boundaries.
- **Still blocked:** Real-person-bound permanent changes, live integrations, imports, marketing sends, CRM source-of-truth switch, production database/project, and HubSpot retirement.
- **Next owner actions:** (1) Alea + Anais jointly carry out the N19 controlled two-human test; (2) choose and approve the actual per-person identity/CRM-only access architecture before implementing it; (3) obtain C13 CRM-specific sign-off, then separately approve the real-data phase and subsequent GATE-007.
