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

## Live A-146 Sandbox checkpoint — 23 Oct 2026

- Neon project: `holyhub-crm-sandbox` (`flat-band-06724960`).
- Region: London / `aws-eu-west-2`.
- Default branch: `sandbox` (`br-soft-cloud-zasaqvgc`).
- Database: `holyhub_crm`.
- No Neon Production project was created.
- The committed Drizzle migration was tested on a temporary Neon migration branch and promoted to the Sandbox default branch.
- Promoted schema verification: 34 foundation tables across `crm`, `crm_config`, `crm_audit`, and `crm_ops`; 70 foreign keys; key application/event/idempotency unique indexes present.
- `crm_config.system_settings.system_environment` is `sandbox`.
- Synthetic fixtures only were loaded using fictional/example-domain records.
- Duplicate Integration Event IDs and duplicate application source-submission IDs are rejected by database uniqueness constraints.
- Dashboard counts reconcile against the synthetic fixture set.
- Snapshot `a146-sandbox-foundation-checkpoint` was created and successfully restored to an isolated validation branch; the restored branch retained the environment marker, synthetic organisations, Safety, Integration Events and stage history.

### Provider role finding

Neon control-plane-created Postgres roles inherit the platform-managed `neon_superuser` membership on this project. They are therefore not suitable as HolyHub's least-privilege runtime identities merely by adding narrower table grants.

The Sandbox now also contains SQL-created restricted runtime-role definitions with no `neon_superuser` membership:

- `hh_crm_migrator_runtime`
- `hh_crm_api_runtime`
- `hh_crm_readonly_runtime`
- `hh_crm_backup_runtime`

Verified ACL intent:

- API runtime: CRM row read/write; config read-only; audit append-only; no schema creation.
- Read-only/backup runtime: read-only.
- Migrator runtime: schema `CREATE` only; no normal CRM row access.

These SQL-created runtime roles currently have no usable connection password because the available automated execution path will not accept password-setting SQL, and Neon's password-reset API will not initialise a passwordless SQL-created role. Do not substitute an elevated Neon-managed role for application runtime. Secure runtime credential provisioning remains an explicit Sandbox acceptance item.

### Sandbox human-auth boundary

The code supports Supabase-authenticated Internal User mapping, but A-146 permits synthetic data only. No actual HolyHub Supabase user ID has been written to Neon and no real human login has been bound to the Sandbox CRM. Human login-to-CRM binding therefore remains inactive at this checkpoint.
