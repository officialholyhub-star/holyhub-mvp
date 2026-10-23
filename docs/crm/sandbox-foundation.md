# N18 CRM Sandbox Foundation

This branch exists only for A-146 synthetic-data Sandbox implementation.

## Frozen branch base

`ecebccbab4f69c3d75099b92263843e2f94bfd1a`

The frozen base is not a Production approval, deployment approval, C2 completion or public-launch approval.

## Environment rules

- `local` and `sandbox` may connect only to the Neon Sandbox project.
- `production` is outside A-146 and must remain unconfigured during Sandbox Foundation work.
- The runtime uses one environment-neutral secret name: `CRM_DATABASE_URL`.
- `CRM_ENVIRONMENT` must be `local`, `sandbox` or `production`.
- A database-side `system_environment` marker must match the runtime before CRM operations proceed.
- No CRM database credential may use a `NEXT_PUBLIC_` variable.

## Current source-of-truth boundary

HubSpot remains HolyHub's live/durable CRM. This branch must not import or mutate live HubSpot, Gmail, Tally, subscriber or outreach state.

## Data rule

Sandbox fixtures must be synthetic. Use reserved/example domains and fictional records. Real HolyHub CRM/customer/lister/subscriber data is outside A-146.

## ChatGPT boundary

The CRM exposes named, bounded service operations. No generic SQL execution endpoint is permitted. Live write-capable ChatGPT CRM connector deployment is outside A-146; Sandbox Foundation tests only the HTTP/tool contract.

## Live A-146 / A-148 Sandbox checkpoint — 23 Oct 2026

- Neon project: `holyhub-crm-sandbox` (`flat-band-06724960`).
- Region: London / `aws-eu-west-2`.
- Current default branch: `sandbox` (`br-floral-wave-za3jo7o0`).
- Database: `holyhub_crm`.
- No Neon Production project was created.
- Git implementation branch: `anais/n18-crm-sandbox`.
- Authorised frozen Git base: `ecebccbab4f69c3d75099b92263843e2f94bfd1a`.
- The committed Drizzle migration was tested on a temporary Neon migration branch and promoted to Sandbox.
- Schema verification: 34 foundation tables across `crm`, `crm_config`, `crm_audit`, and `crm_ops`; 70 foreign keys; key application/event/idempotency unique indexes present.
- `crm_config.system_settings.system_environment` is `sandbox`.
- Synthetic fixtures only were loaded using fictional/example-domain records.
- Duplicate Integration Event IDs and duplicate application source-submission IDs are rejected by database uniqueness constraints.
- Dashboard counts reconcile against the synthetic fixture set.

### Restore/branch identity note

Snapshot `a146-sandbox-foundation-checkpoint` (`snap-sparkling-glitter-zar1eiu2`) was created from the original Sandbox branch. A prior restore was finalized by Neon in a way that swapped branch identities: the restored branch became the current default `sandbox` (`br-floral-wave-za3jo7o0`), while the former branch ID `br-soft-cloud-zasaqvgc` is now named `a146-restore-validation (1)`.

The current default Sandbox has been re-verified after this discovery and contains the expected synthetic schema/data and `system_environment=sandbox` marker. A-148 remediation and final security/data tests must target `br-floral-wave-za3jo7o0` unless live Neon state changes again.

The existing manual snapshot remains intact. Neon Free currently allows only one manual snapshot for this project, so creating a second fresh checkpoint returned the provider's snapshot-limit error. The existing snapshot has already demonstrated successful restore/recovery; no existing snapshot was deleted merely to free capacity. Independent/off-provider Production backup remains a later N18 requirement and is not satisfied by this Sandbox snapshot alone.

### A-148 provider-role remediation

Neon control-plane-created Postgres roles on this project inherited the platform-managed `neon_superuser` membership and were not acceptable HolyHub runtime identities.

After fresh pre-delete verification on the true default Sandbox, the following elevated test roles were removed and verified absent:

- `hh_crm_owner`
- `hh_crm_migrator`
- `hh_crm_api`
- `hh_crm_readonly`
- `hh_crm_backup`

Pre-delete checks confirmed they had no active sessions, owned no required schema/table/routine/type objects and were referenced by no active CRM system settings, automation, communication-account or system-operation record.

The retained restricted runtime identities are:

- `hh_crm_migrator_runtime`
- `hh_crm_api_runtime`
- `hh_crm_readonly_runtime`
- `hh_crm_backup_runtime`
- `holyhub_crm_owner` remains the Neon database owner.

Sandbox-only passwords were initialised and rotated through Neon without placing credential values in Git, documentation or public/client configuration. No Production credential exists.

Actual connection-as-role tests confirmed all four `*_runtime` identities authenticate as themselves and are:

- not superusers;
- not database creators;
- not role creators;
- not `BYPASSRLS`;
- not members of `neon_superuser`.

Verified ACL behaviour:

- API runtime: normal CRM row read/write; no CRM schema `CREATE`; Config cannot be updated; audit Activity can be appended but not rewritten.
- Read-only runtime: CRM reads only; no CRM row writes and no schema creation.
- Backup runtime: CRM reads only; no CRM row writes and no schema creation.
- Migrator runtime: schema `CREATE`; no normal CRM row read/write.

Actual denied-write tests confirmed protected Config and read-only CRM writes fail closed.

### A-148 data/integration retest

Under `hh_crm_api_runtime` on the true default Sandbox:

- environment marker returned `sandbox`;
- Dashboard reconciled to the synthetic baseline: 1 Needs Reply, 0 Follow-Ups Due, 1 Overdue, 1 New Application, 1 Application Awaiting Review, 1 New Subscriber, 0 Calls Due, 0 Needs Review, 1 Safety Issue, 0 Failed Automations;
- duplicate Integration Event `synthetic_tally/event-001` was rejected by `integration_events_source_event_uq`;
- duplicate application submission `synthetic_tally/sandbox-submission-001` was rejected by `applications_source_submission_uq`;
- canonical duplicate-sensitive records remain singletons.

The application code continues to require `CRM_DATABASE_URL` server-side, validates the database-side environment marker, rejects Production-looking URLs from Sandbox/local, requires the CRM Internal User authorisation layer, and exposes bounded CRM operations rather than generic SQL.

### Sandbox human-auth boundary

The code supports Supabase-authenticated Internal User mapping, but A-146 permits synthetic data only. No actual HolyHub Supabase user ID has been written to Neon and no real human login has been bound to the Sandbox CRM. Human login-to-CRM binding remains deliberately inactive.

### Secret-store/deployment boundary

Runtime role credentials now exist securely in Neon and have been used through Neon's credential-resolved connection testing. No credential value is recorded here. A deployed Sandbox application's `CRM_DATABASE_URL` has not been written into Git or client configuration, and no Production secret has been created. External deployment secret-store wiring remains a deployment step and must use an approved server-side secret store; it must not be simulated by committing a credential.
