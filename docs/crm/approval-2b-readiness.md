# N18 Implementation 2B — Monday-readiness evidence (22 November 2026)

**Authority:** A-224 under A-222, Anais-only synthetic sandbox work. Monday 23 November is a *target*, not permission to bypass gates. A-223 accepted the 2A code. No staff binding, credential wiring, deployment or browser access has been approved or performed.

## Verified migration history and recovery

- Project: `flat-band-06724960`; database: `holyhub_crm`; default Sandbox branch: `br-floral-wave-za3jo7o0`.
- Pre-write schema: 34 CRM tables, 398 columns, 70 foreign keys, 82 indexes. The committed 0001 snapshot matched all 34 tables, columns, FKs and named indexes (long PostgreSQL FK names are truncated to 63 characters). No unexpected schema migration drift.
- Baseline counts: 2 organisations, 2 contacts, 1 safety control, 1 activity, 1 integration event and 0 communication accounts.
- Verified pre-write recovery branch: `br-weathered-forest-zafk3uti` (`n18-2b-recovery-before-metadata-20261122`). It was branched from the exact current Sandbox default, then compared with **zero schema differences** and matching synthetic row counts. **Retain this branch** until specifically authorised to dispose of it. This is separate-branch recovery inside Neon, not an off-provider backup.
- Preserved older snapshot: `snap-sparkling-glitter-zar1eiu2` from 23 October; it predates the 2A safety migration and is **not an up-to-date rollback of current state**.
- Previously executed migrations are `0000_old_microchip` (journal time 1792784880158) and `0001_n18_safety_retention` (1795353595560).
- File SHA-256 / Drizzle journal hashes verified against the CI-generated SQL:
  - 0000: `c67faad0d86282e283945b12885c6981dffda010158306b8f1fb483188812139`.
  - 0001: `2b920174a8b8aff2ffb05ba2cda65d1044b9be93756dfa90612972dcfae4e25c`.
- Used Neon's prepared temporary migration branch, tested the tracker with the restricted migrator role, and applied only `drizzle.__drizzle_migrations` metadata plus specific tracking-schema grants. **No historic SQL was replayed.**
- Post-write tracker readback: exactly two rows matching those hashes and journal timestamps. CRM baseline row counts unchanged and schema diff against the recovery branch contains **only** `drizzle` tracker/schema/grants. No CRM table/record changes.
- Restricted migrator has SELECT/INSERT access on tracking only; all API/backup/readonly/migrator runtime roles have no SUPERUSER, CREATEROLE, CREATEDB or BYPASSRLS.

**Known migration-runner limitation:** `npm run crm:migrate` uses Drizzle Kit, which may issue `CREATE SCHEMA IF NOT EXISTS drizzle`. The restricted migrator is deliberately denied DATABASE CREATE, and this statement was confirmed denied even when `drizzle` already exists. Do not grant database-wide CREATE or run the migration CLI against this Sandbox until a separate safe tool/role path is reviewed. The current tracker is reconciled; no new schema migration is required by 2B.

**Rollback:** If tracking metadata is defective, stop migrations and preserve evidence. Verify the branch default, tracker rows, recovery branch ID and current row counts. Review reversal or restoration on a **disposable clone first**; do not restore/finalize or delete the current Sandbox or recovery branch automatically. The pre-metadata recovery branch preserves the 2A data/schema without the new tracking table.

## API and synthetic workflows verified

- `hh_crm_api_runtime` is least-privilege and can perform approved CRM DML while unable to mutate protected configuration or obtain schema CREATE.
- An isolated, role-authenticated synthetic SQL transaction verified fictional organisation/contact/route creation, permanent failed-route control, follow-up action creation/completion, audit append and route-control persistence after contact deletion; all temporary test data rolled back, with zero remaining test rows.
- Automated unit/contract tests verify named service boundaries, safe input, role checks, no self-binding on authentication reads and no external delivery calls.
- Real staff auth and browser-end-to-end verification are **not claimed**.

## Live safety prerequisites and owner handoffs

- **N19 identity/concurrency:** still marked In Progress in the live Task Book, not verified closed. Do not bind Anais's real Supabase auth subject to Neon until safeguards are documented and satisfied.
- **C13 staff privacy/security:** remains In Progress and Alea-owned. Need scoped confirmation of staff CRM identity data, 2FA/account recovery, restricted access, audit and lawful retention. This is narrower than requiring all customer-facing C13 work to finish, but cannot assume clearance.
- **Anais secret-store decision (NOT APPROVED):** proposed destination is the **encrypted Netlify site-specific environment-variable store on an Alea-approved, separate, private CRM preview site**, with `CRM_DATABASE_URL` limited to server/Functions runtime and the restricted `hh_crm_api_runtime` role; `CRM_ENVIRONMENT=sandbox` and DB-side marker checks. Do not store or display the value in Git, chat, preview variables, browser bundles or logs. Await Anais explicit approval of this precise destination *before* provisioning/wiring it.
- **Alea hosting/auth decision (NOT APPROVED):** explicitly authorise a **distinct access-restricted Netlify CRM preview deployment of `anais/n18-crm-sandbox`** and the minimum Alea-owned Supabase application/session configuration needed for Anais-only login (without editing existing website release/identity flows or enabling public access). This is a deployment/auth decision for Alea, separate from Anais's CRM 2B scope.
- Real records and outreach require later legal/safety verification, recipient-level suppression and source-truth migration; **HubSpot remains canonical** until GATE-007. No real data may be added under 2B.

**Monday critical path:** obtain Anais server-side secret-store approval and Alea separate private preview/auth decision; confirm N19/C13 staff safeguards; then finish Anais-only identity binding, wiring and private browser testing under their approved boundaries. No real records, integrations, sends, public release or cutover.
